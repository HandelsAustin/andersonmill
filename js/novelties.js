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

        // Target — same manager-PIN gating as the flavor Target column in the Run tab.
        const tdTarget = document.createElement('td');
        tdTarget.style.cssText = 'text-align:center;padding:9px 4px;';
        const renderTargetCell = () => {
          tdTarget.innerHTML = '';
          if (_managerUnlocked) {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = item.parLevel;
            input.style.cssText = 'width:52px;padding:6px;text-align:center;border-radius:6px;border:1.5px solid var(--panel-border);background:var(--panel-bg-alt);color:var(--text-primary);';
            input.onchange = () => {
              item.parLevel = Math.max(0, parseInt(input.value) || 0);
              saveNoveltiesCatalog();
              renderToMakeCell();
            };
            tdTarget.appendChild(input);
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

        // Made — prompts for a quantity, adds it to on-hand.
        const tdMadeBtn = document.createElement('td');
        tdMadeBtn.style.cssText = 'text-align:right;padding:9px 4px;white-space:nowrap;';
        const madeBtn = document.createElement('button');
        madeBtn.className = 'btn btn-green';
        madeBtn.style.cssText = 'font-size:12px;padding:8px 14px;';
        madeBtn.textContent = 'Made';
        madeBtn.onclick = () => {
          const input = prompt(`How many "${item.name}" did you make?`, '');
          if (input === null) return;
          const qty = parseInt(input);
          if (!Number.isFinite(qty) || qty <= 0) return;
          entry.onHand = Math.min(999, (entry.onHand || 0) + qty);
          tdOnHand.textContent = entry.onHand;
          renderToMakeCell();
          saveNoveltiesLog();
        };
        tdMadeBtn.appendChild(madeBtn);
        tr.appendChild(tdMadeBtn);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      section.appendChild(table);
      content.appendChild(section);
    });
}
