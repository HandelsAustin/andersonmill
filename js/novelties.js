// Novelties: daily make-checklist for pre-packaged items (ice cream sandwiches,
// Handel Pops, Hurricane toppings, waffle bowls/cones, Cambros, chocolate bananas,
// sundae bases) — laid out like the Ice Cream Run's flavor table: Item / Target /
// On Hand / To Make / Made, recallable/re-editable by date.
//
// Catalog (category, name, parLevel) is persistent — store.novelties, merged onto
// the existing store doc. Items are a fixed, preset catalog — staff can't add or
// remove items from this page. Each day's on-hand counts live in their own small
// doc, organizations/{orgId}/stores/{storeId}/noveltiesLog/{date}, so a day can be
// pulled back up later without bloating the store doc.

let novelties = []; // catalog: [{ category, name, parLevel }] — populated by applyData() in store-org.js
let _noveltiesLog = []; // working date's data: [{ category, name, onHand }]
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

// Lists recent Saved Lists — in-progress (unsubmitted) checklists only.
async function listRecentNoveltiesDates(max = 60) {
  if (!window._firebaseReady || !window._getDocs || !window._query) return [];
  try {
    const q = window._query(window.getStoreNoveltiesLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(max));
    const snap = await window._getDocs(q);
    return snap.docs.filter(d => d.data().submitted !== true).map(d => d.id);
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

function _noveltyKey(item) {
  return `${item.category}::${item.name}`;
}

// Finds (or lazily creates) this item's entry in the currently-loaded day's log.
function _getLogEntry(item) {
  const key = _noveltyKey(item);
  let entry = _noveltiesLog.find(e => _noveltyKey(e) === key);
  if (!entry) {
    entry = { category: item.category, name: item.name, onHand: 0 };
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
  const needMake = novelties.filter(item => _toMakeNovelty(item, _getLogEntry(item)) > 0).length;
  el.textContent = needMake > 0
    ? `${needMake} item${needMake !== 1 ? 's' : ''} still need to be made today`
    : 'All caught up for today.';
}

// ── Saved Lists ───────────────────────────────────────────────────────────────
// Lists in-progress (unsubmitted) checklists by creation date. Opening one
// resumes exactly where it was left. Once Submitted, a list is excluded from
// this picker (though its data stays in Firestore for Dashboard history).
function _renderNoveltiesDatePicker() {
  const container = document.getElementById('noveltiesDatePicker');
  if (!container) return;
  container.style.position = 'relative';
  container.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.cssText = 'font-size:12px;padding:8px 12px;';
  btn.textContent = '📅 Saved Lists ▾';
  btn.onclick = e => { e.stopPropagation(); _toggleNoveltiesDateMenu(); };
  container.appendChild(btn);

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
    menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">No saved lists in progress.</div>';
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

      const table = document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
      const thead = document.createElement('thead');
      thead.innerHTML = `<tr>
        <th style="text-align:left;padding:6px 4px;color:var(--text-accent);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-family:'Arial Narrow',Arial,sans-serif;">Item</th>
        <th style="text-align:center;padding:6px 4px;color:var(--text-accent);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-family:'Arial Narrow',Arial,sans-serif;">Target</th>
        <th style="text-align:center;padding:6px 4px;color:var(--text-accent);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-family:'Arial Narrow',Arial,sans-serif;">On Hand</th>
        <th style="text-align:center;padding:6px 4px;color:var(--text-accent);font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-family:'Arial Narrow',Arial,sans-serif;">To Make</th>
        <th style="padding:6px 4px;"></th>
      </tr>`;
      table.appendChild(thead);
      const tbody = document.createElement('tbody');

      items.forEach(item => {
        const entry = _getLogEntry(item);
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom:1px solid var(--panel-border);';

        const tdName = document.createElement('td');
        tdName.style.cssText = 'padding:9px 4px;font-weight:600;';
        tdName.textContent = item.name;
        tr.appendChild(tdName);

        // Target — dropdown, same as the flavor Target column in the Run tab
        // (TARGET_OPTIONS is shared, defined in roster.js).
        const tdTarget = document.createElement('td');
        tdTarget.style.cssText = 'text-align:center;padding:9px 4px;';
        const renderTargetCell = () => {
          tdTarget.innerHTML = '';
          if (_managerUnlocked) {
            tdTarget.appendChild(makeSelect(TARGET_OPTIONS, item.parLevel, val => {
              item.parLevel = val;
              saveNoveltiesCatalog();
              renderToMakeCell();
            }));
          } else {
            const span = document.createElement('span');
            span.textContent = item.parLevel || '—';
            span.style.cssText = 'color:var(--text-muted);cursor:pointer;';
            span.title = 'Manager access required';
            span.onclick = () => requireManager(renderTargetCell);
            tdTarget.appendChild(span);
          }
        };
        renderTargetCell();
        tr.appendChild(tdTarget);

        // On Hand
        const tdOnHand = document.createElement('td');
        tdOnHand.style.cssText = 'text-align:center;padding:9px 4px;font-weight:600;';
        tdOnHand.textContent = entry.onHand;
        tr.appendChild(tdOnHand);

        // To Make
        const tdMake = document.createElement('td');
        tdMake.style.cssText = 'text-align:center;padding:9px 4px;font-weight:700;';
        const renderToMakeCell = () => {
          const need = _toMakeNovelty(item, entry);
          tdMake.textContent = need > 0 ? need : '—';
          tdMake.style.color = need > 0 ? '#f0a500' : '#22a05a';
          _updateNoveltiesSummary();
        };
        renderToMakeCell();
        tr.appendChild(tdMake);

        // Made — pre-filled, adjustable stepper; submitted rows show a done
        // status with Undo (same pattern as the Run tab's Made column).
        if (entry.madeQty !== undefined) {
          tr.style.opacity = '0.6';
          tdName.style.textDecoration = 'line-through';
        }
        const tdMadeBtn = document.createElement('td');
        tdMadeBtn.style.cssText = 'text-align:right;padding:9px 4px;white-space:nowrap;';
        if (entry.madeQty !== undefined) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:8px;';
          const label = document.createElement('span');
          label.textContent = `✓ ${entry.madeQty} made`;
          label.style.cssText = 'font-size:12px;color:#22a05a;font-weight:600;font-family:\'Arial Narrow\',Arial,sans-serif;letter-spacing:0.04em;';
          const undoBtn = document.createElement('button');
          undoBtn.textContent = 'Undo';
          undoBtn.style.cssText = 'background:none;border:1px solid #4a6a8a;color:var(--text-muted);font-size:11px;font-weight:700;padding:5px 10px;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:0.04em;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:36px;';
          undoBtn.onclick = () => undoNoveltyMade(item, entry);
          wrap.appendChild(label);
          wrap.appendChild(undoBtn);
          tdMadeBtn.appendChild(wrap);
        } else {
          const madeBtn = document.createElement('button');
          madeBtn.className = 'btn btn-green';
          madeBtn.style.cssText = 'font-size:12px;padding:8px 14px;';
          madeBtn.textContent = 'Made';
          madeBtn.onclick = () => openMadeStepper({
            title: item.name,
            value: _toMakeNovelty(item, entry),
            onSubmit: qty => setNoveltyMade(item, entry, qty)
          });
          tdMadeBtn.appendChild(madeBtn);
        }
        tr.appendChild(tdMadeBtn);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      section.appendChild(table);
      content.appendChild(section);
    });

  const doneFooter = document.createElement('div');
  doneFooter.id = 'noveltiesDoneFooter';
  doneFooter.style.cssText = 'display:none;background:#0f4a2a;border:1.5px solid #98d4e3;border-radius:8px;padding:12px;margin-top:14px;';
  doneFooter.innerHTML = '<button class="btn btn-green" onclick="showNoveltiesSummary()" style="width:100%;justify-content:center;font-size:14px;padding:13px;">&#10003; Done — Review &amp; Submit</button>';
  content.appendChild(doneFooter);
  checkNoveltiesComplete();
}

// Sets this item's made quantity for the day — re-derives on-hand from the
// delta so re-opening Made to adjust a value never double-counts.
function setNoveltyMade(item, entry, qty) {
  const delta = qty - (entry.madeQty || 0);
  entry.onHand = Math.max(0, Math.min(999, (entry.onHand || 0) + delta));
  entry.madeQty = qty;
  saveNoveltiesLog();
  renderNoveltiesPage();
}

function undoNoveltyMade(item, entry) {
  entry.onHand = Math.max(0, (entry.onHand || 0) - (entry.madeQty || 0));
  delete entry.madeQty;
  saveNoveltiesLog();
  renderNoveltiesPage();
}

// Toggles the bottom Done footer — shown once every item is either fully
// stocked already or has been explicitly submitted via Made (0 counts).
function checkNoveltiesComplete() {
  const footer = document.getElementById('noveltiesDoneFooter');
  if (!footer) return;
  const allDone = novelties.length > 0 && novelties.every(item => {
    const entry = _getLogEntry(item);
    return _toMakeNovelty(item, entry) === 0 || entry.madeQty !== undefined;
  });
  footer.style.display = allDone ? '' : 'none';
}

function showNoveltiesSummary() {
  const body = document.getElementById('noveltiesSummaryBody');
  body.innerHTML = '';

  const madeItems = novelties.filter(item => (_getLogEntry(item).madeQty || 0) > 0);
  const totalMade = madeItems.reduce((s, item) => s + (_getLogEntry(item).madeQty || 0), 0);

  const primaryRow = document.createElement('tr');
  const primaryL = document.createElement('td');
  primaryL.style.cssText = 'padding:16px 8px 14px;font-size:13px;color:#22a05a;font-weight:700;border-bottom:1px solid rgba(34,160,90,0.25);';
  primaryL.textContent = 'Total Items Made';
  const primaryV = document.createElement('td');
  primaryV.style.cssText = 'padding:16px 8px 14px;text-align:right;font-size:32px;font-weight:700;color:#22a05a;letter-spacing:-0.02em;border-bottom:1px solid rgba(34,160,90,0.25);';
  primaryV.textContent = totalMade;
  primaryRow.appendChild(primaryL);
  primaryRow.appendChild(primaryV);
  body.appendChild(primaryRow);

  madeItems.forEach(item => {
    const entry = _getLogEntry(item);
    const tr = document.createElement('tr');
    const tdL = document.createElement('td');
    tdL.textContent = item.name;
    const tdV = document.createElement('td');
    tdV.textContent = entry.madeQty;
    tr.appendChild(tdL);
    tr.appendChild(tdV);
    body.appendChild(tr);
  });

  document.getElementById('noveltiesSummaryOverlay').classList.add('open');
}

// Adjust: back out of the review popup — items stay submitted/editable via Undo.
function adjustNoveltiesSummary() {
  document.getElementById('noveltiesSummaryOverlay').classList.remove('open');
}

// Submit: locks the checklist in — writes the Dashboard-facing summary and
// marks the day's log submitted so it drops off the Saved Lists picker.
async function submitNoveltiesSummary() {
  document.getElementById('noveltiesSummaryOverlay').classList.remove('open');
  const madeItems = novelties.filter(item => (_getLogEntry(item).madeQty || 0) > 0);
  const totalMade = madeItems.reduce((s, item) => s + (_getLogEntry(item).madeQty || 0), 0);
  if (window._firebaseReady && window._auth && window._auth.currentUser) {
    if (totalMade > 0) {
      try {
        const userName = _currentUserName();
        const newEntry = {
          type: 'novelties_completed', items: totalMade, at: Date.now(),
          ...(userName ? { by: userName } : {}),
        };
        _storeEvents = [..._storeEvents, newEntry].slice(-10);
        await window._setDoc(getStoreDocRef(), { storeEvents: _storeEvents }, { merge: true });
      } catch (e) { console.error('Novelties summary write error:', e); }
    }
    try {
      await window._setDoc(window.getStoreNoveltiesLogRef(_workingNoveltiesDate || todayStr()), { submitted: true }, { merge: true });
    } catch (e) { console.error('Novelties submitted-flag write error:', e); }
  }
  novelties.forEach(item => { delete _getLogEntry(item).madeQty; });
  saveNoveltiesLog();
  renderNoveltiesPage();
}
