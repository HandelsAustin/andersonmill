// Novelties: daily make-checklist for pre-packaged items (ice cream sandwiches,
// Handel Pops, Hurricane toppings, waffle bowls/cones, Cambros, chocolate bananas,
// sundae bases) — same model as the Ice Cream Run: qty-to-make = par − on-hand,
// check off as made, recallable/re-editable by date.
//
// Catalog (category, name, parLevel) is persistent — store.novelties, merged onto
// the existing store doc. Each day's on-hand counts + made checkmarks live in their
// own small doc, organizations/{orgId}/stores/{storeId}/noveltiesLog/{date}, so a
// day can be pulled back up later without bloating the store doc.

let novelties = []; // catalog: [{ category, name, parLevel }] — populated by applyData() in store-org.js
let _noveltiesLog = []; // working date's data: [{ category, name, onHand, done }]
let _workingNoveltiesDate = null;

const NOVELTY_CATALOG = [
  { category: 'Ice Cream Sandwiches',     items: ['Vanilla', 'Chocolate', 'Mint Chocolate Chip', 'Flavor of the Month'] },
  { category: 'Handel Pops',              items: ['Vanilla', 'Chocolate', 'Mint Chocolate Chip', 'Flavor of the Month'] },
  { category: 'Hurricane Toppings',       items: ['Cookie Dough', 'Heath', "Reese's Peanut Butter Cups", 'Oreos', 'Cheesecake Pieces', 'Brownies', 'Chocolate Chips', 'Butterfinger', 'Snickers'] },
  { category: 'Waffle Bowls',             items: ['Chocolate', 'Sprinkles', 'Oreo Crumbs', 'Peanuts'] },
  { category: 'Waffle Cones',             items: ['Chocolate', 'Sprinkles', 'Oreo Crumbs', 'Peanuts'] },
  { category: 'Ice Cream Maker Cambros',  items: ['Oreos', 'Chips Ahoy', 'Coconut Dream', 'Animal Cookie', 'Gingerbread', 'Biscoff'] },
  { category: 'Chocolate Bananas',        items: ['Chocolate', 'Sprinkles', 'Peanuts'] },
  { category: 'Sundae Bases',             items: ['Brownies', 'Blondies', 'Apple Dumplings'] },
];
const NOVELTY_DEFAULT_PAR = 5;

function _seedNoveltiesIfEmpty() {
  if (novelties.length) return false;
  novelties = NOVELTY_CATALOG.flatMap(group =>
    group.items.map(name => ({ category: group.category, name, parLevel: NOVELTY_DEFAULT_PAR }))
  );
  return true;
}

async function saveNoveltiesCatalog() {
  if (!window._firebaseReady) { showStatusMessage('Offline — catalog saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { novelties }, { merge: true });
  } catch (e) {
    console.error('Novelties catalog save error:', e);
    showStatusMessage('⚠ Could not save novelties catalog', 2500);
  }
}

async function saveNoveltiesLog() {
  if (!window._firebaseReady) { showStatusMessage("Offline — today's checklist saved locally only", 3000); return; }
  try {
    await window._setDoc(window.getStoreNoveltiesLogRef(_workingNoveltiesDate || todayStr()), { items: _noveltiesLog, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Novelties log save error:', e);
    showStatusMessage('⚠ Could not save checklist', 2500);
  }
}

// Loads (and switches the working date to) a specific date's checklist — this is
// what "recall a past day" does. No live snapshot listener here (unlike the Run):
// Novelties counting is typically single-device/single-session, so load-on-demand
// keeps this simpler.
async function loadNoveltiesForDate(date) {
  _workingNoveltiesDate = date;
  let logData = null;
  if (window._firebaseReady) {
    try {
      const snap = await window._getDoc(window.getStoreNoveltiesLogRef(date));
      if (snap.exists()) logData = snap.data();
    } catch (e) {
      console.error('Novelties log load error:', e);
    }
  }
  _noveltiesLog = logData?.items || [];
  renderNoveltiesPage();
}

async function listRecentNoveltiesDates(max = 60) {
  if (!window._firebaseReady || !window._getDocs || !window._query) return [];
  try {
    const q = window._query(window.getStoreNoveltiesLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(max));
    const snap = await window._getDocs(q);
    return snap.docs.map(d => d.id);
  } catch (e) {
    console.error('List novelties dates error:', e);
    return [];
  }
}

// Novelties is now a bottom-tab panel rather than a popup overlay — these wrappers
// stay in case anything still calls them directly.
function openNovelties() {
  switchTab('Novelties');
}

function closeNovelties() {
  switchTab('Run');
}

// Generic rapid-fire long-press stepper (same interaction as the production run's
// holding +/- counters in production.js, parameterized instead of tied to activeFlavors).
function _attachStepper(btn, delta, getVal, setVal, onSettle) {
  let timerId = null, delay = 400, pressing = false;
  const clamp = v => Math.min(999, Math.max(0, v));
  const tick = () => {
    if (!pressing) return;
    setVal(clamp(getVal() + delta));
    delay = Math.max(60, delay * 0.85);
    timerId = setTimeout(tick, delay);
  };
  const start = e => {
    e.preventDefault();
    pressing = true;
    delay = 400;
    setVal(clamp(getVal() + delta));
    timerId = setTimeout(tick, delay);
  };
  const stop = () => {
    if (!pressing) return;
    pressing = false;
    clearTimeout(timerId);
    if (onSettle) onSettle();
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
}

function _noveltyKey(item) {
  return `${item.category}::${item.name}`;
}

// Finds (or lazily creates) this item's entry in the currently-loaded day's log.
function _getLogEntry(item) {
  const key = _noveltyKey(item);
  let entry = _noveltiesLog.find(e => _noveltyKey(e) === key);
  if (!entry) {
    entry = { category: item.category, name: item.name, onHand: 0, done: false };
    _noveltiesLog.push(entry);
  }
  return entry;
}

function _toMakeNovelty(item, entry) {
  return Math.max(0, (item.parLevel || 0) - (entry.onHand || 0));
}

function _updateNoveltiesSummary() {
  const el = document.getElementById('noveltiesSummary');
  if (!el) return;
  const needMake = novelties.filter(item => {
    const entry = _getLogEntry(item);
    return !entry.done && _toMakeNovelty(item, entry) > 0;
  }).length;
  el.textContent = needMake > 0
    ? `${needMake} item${needMake !== 1 ? 's' : ''} still need to be made today`
    : 'All caught up for today.';
}

// ── Date recall ──────────────────────────────────────────────────────────────
function _renderNoveltiesDatePicker() {
  const container = document.getElementById('noveltiesDatePicker');
  if (!container) return;
  const isToday = _workingNoveltiesDate === todayStr();
  container.style.position = 'relative';
  container.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.cssText = 'font-size:12px;padding:8px 12px;';
  btn.textContent = `📅 ${isToday ? 'Today' : _workingNoveltiesDate} ▾`;
  btn.onclick = e => { e.stopPropagation(); _toggleNoveltiesDateMenu(); };
  container.appendChild(btn);

  if (!isToday) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.style.cssText = 'font-size:12px;padding:8px 12px;margin-left:6px;';
    backBtn.textContent = '↩ Back to Today';
    backBtn.onclick = () => loadNoveltiesForDate(todayStr());
    container.appendChild(backBtn);
  }

  const menu = document.createElement('div');
  menu.id = 'noveltiesDateMenu';
  menu.style.cssText = 'display:none;position:absolute;top:110%;left:0;background:#1a2744;border:1.5px solid #2e4a70;border-radius:8px;overflow:hidden;z-index:200;min-width:200px;max-height:280px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
  container.appendChild(menu);
}

async function _toggleNoveltiesDateMenu() {
  const menu = document.getElementById('noveltiesDateMenu');
  if (!menu) return;
  if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
  menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">Loading…</div>';
  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: true }), 0);

  const dates = await listRecentNoveltiesDates();
  menu.innerHTML = '';
  if (!dates.length) {
    menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">No saved checklists yet.</div>';
    return;
  }
  dates.forEach(d => {
    const row = document.createElement('button');
    row.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;border-bottom:1px solid #2e4a70;color:#c5d8f0;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;font-size:13px;cursor:pointer;';
    row.textContent = d === todayStr() ? `${d} (Today)` : d;
    row.onclick = () => { loadNoveltiesForDate(d); menu.style.display = 'none'; };
    menu.appendChild(row);
  });
}

function renderNoveltiesPage() {
  const content = document.getElementById('noveltiesContent');
  if (!content) return;
  const seeded = _seedNoveltiesIfEmpty();
  if (seeded) saveNoveltiesCatalog();
  if (!_workingNoveltiesDate) {
    loadNoveltiesForDate(todayStr()); // async — re-renders once the day's log loads
    return;
  }
  if (typeof _applyNewPagesTheme === 'function') _applyNewPagesTheme((_storeSettings && _storeSettings.theme) || 'dark');
  content.innerHTML = '';

  const dateBar = document.createElement('div');
  dateBar.id = 'noveltiesDatePicker';
  dateBar.style.marginBottom = '14px';
  content.appendChild(dateBar);
  _renderNoveltiesDatePicker();

  const summary = document.createElement('div');
  summary.id = 'noveltiesSummary';
  summary.className = 'settings-note';
  summary.style.marginBottom = '14px';
  content.appendChild(summary);
  _updateNoveltiesSummary();

  NOVELTY_CATALOG.map(g => g.category)
    .filter((c, i, arr) => arr.indexOf(c) === i) // preserve catalog order; also covers any custom categories added later
    .concat(novelties.map(n => n.category).filter(c => !NOVELTY_CATALOG.some(g => g.category === c)))
    .forEach(category => {
      const items = novelties.filter(n => n.category === category);
      if (!items.length) return;

      const section = _settingsSection(category);

      items.forEach(item => {
        const entry = _getLogEntry(item);
        const row = document.createElement('div');
        row.className = 'settings-card';
        row.style.cssText += 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;flex-wrap:wrap;' + (entry.done ? 'opacity:0.55;' : '');

        const nameWrap = document.createElement('div');
        nameWrap.style.cssText = 'flex:1;min-width:120px;';
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size:13px;font-weight:600;' + (entry.done ? 'text-decoration:line-through;' : '');
        nameEl.textContent = item.name;
        nameWrap.appendChild(nameEl);
        const makeEl = document.createElement('div');
        nameWrap.appendChild(makeEl);
        row.appendChild(nameWrap);

        const stepperWrap = document.createElement('div');
        stepperWrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
        const minusBtn = document.createElement('button');
        minusBtn.textContent = '−';
        minusBtn.className = 'btn';
        minusBtn.style.cssText = 'width:40px;height:40px;padding:0;font-size:18px;';
        const valEl = document.createElement('span');
        valEl.style.cssText = 'min-width:30px;text-align:center;font-size:15px;font-weight:700;';
        valEl.textContent = entry.onHand;
        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.className = 'btn';
        plusBtn.style.cssText = 'width:40px;height:40px;padding:0;font-size:18px;';
        stepperWrap.append(minusBtn, valEl, plusBtn);
        row.appendChild(stepperWrap);

        const rerenderMake = () => {
          const need = _toMakeNovelty(item, entry);
          makeEl.textContent = need > 0 ? `Make ${need}` : 'At par';
          makeEl.style.cssText = `font-size:11px;font-weight:700;margin-top:2px;color:${need > 0 ? '#f0a500' : '#22a05a'};`;
          _updateNoveltiesSummary();
        };
        rerenderMake();

        _attachStepper(minusBtn, -1,
          () => entry.onHand,
          v => { entry.onHand = v; valEl.textContent = v; rerenderMake(); },
          () => saveNoveltiesLog());
        _attachStepper(plusBtn, +1,
          () => entry.onHand,
          v => { entry.onHand = v; valEl.textContent = v; rerenderMake(); },
          () => saveNoveltiesLog());

        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn' + (entry.done ? ' btn-green' : '');
        doneBtn.style.cssText = 'font-size:12px;padding:8px 12px;';
        doneBtn.textContent = entry.done ? '✓ Made' : 'Mark Made';
        doneBtn.onclick = () => {
          entry.done = !entry.done;
          saveNoveltiesLog();
          renderNoveltiesPage();
        };
        row.appendChild(doneBtn);

        // Par level + remove — manager-only catalog edits (not date-specific)
        const parWrap = document.createElement('div');
        parWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
        const parLabel = document.createElement('span');
        parLabel.className = 'settings-label';
        parLabel.textContent = 'Par';
        const parInput = document.createElement('input');
        parInput.type = 'number';
        parInput.className = 'settings-input';
        parInput.style.cssText = 'width:56px;padding:6px;text-align:center;';
        parInput.value = item.parLevel;
        parInput.onchange = () => {
          item.parLevel = Math.max(0, parseInt(parInput.value) || 0);
          rerenderMake();
          saveNoveltiesCatalog();
        };
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '🗑';
        removeBtn.title = 'Remove item';
        removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:6px;';
        removeBtn.onclick = () => requireManager(() => _removeNovelty(novelties.indexOf(item)));
        parWrap.append(parLabel, parInput, removeBtn);
        row.appendChild(parWrap);

        section.appendChild(row);
      });

      const addRow = document.createElement('div');
      addRow.style.cssText = 'display:flex;gap:6px;margin-top:4px;';
      const addInput = document.createElement('input');
      addInput.className = 'settings-input';
      addInput.placeholder = `Add item to ${category}…`;
      addInput.style.flex = '1';
      const addBtn = document.createElement('button');
      addBtn.className = 'btn';
      addBtn.textContent = '+ Add';
      addBtn.onclick = () => requireManager(() => {
        const name = addInput.value.trim();
        if (!name) return;
        novelties.push({ category, name, parLevel: NOVELTY_DEFAULT_PAR });
        saveNoveltiesCatalog();
        renderNoveltiesPage();
      });
      addRow.append(addInput, addBtn);
      section.appendChild(addRow);

      content.appendChild(section);
    });
}

function _removeNovelty(idx) {
  const removed = novelties[idx];
  const prevList = [...novelties];
  novelties = novelties.filter((_, i) => i !== idx);
  saveNoveltiesCatalog();
  renderNoveltiesPage();
  showUndoToast(`"${removed.name}" removed.`, () => {
    novelties = prevList;
    saveNoveltiesCatalog();
    renderNoveltiesPage();
  });
}
