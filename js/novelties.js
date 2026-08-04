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
let _noveltiesSaving = false; // suppresses the noveltiesLog snapshot listener's reaction to our own write
let _unsubscribeNoveltiesSnapshot = null;

const NOVELTY_CATALOG = [
  { category: 'Waffle Cones',             items: ['Chocolate', 'Sprinkles', 'Oreo Crumbs', 'Peanuts'] },
  { category: 'Waffle Bowls',             items: ['Chocolate', 'Sprinkles', 'Oreo Crumbs', 'Peanuts'] },
  { category: 'Handel Pops',              items: ['Vanilla', 'Chocolate', 'Mint Chocolate Chip', 'Flavor of the Month'] },
  { category: 'Ice Cream Sandwiches',     items: ['Vanilla', 'Chocolate', 'Mint Chocolate Chip', 'Flavor of the Month'] },
  { category: 'Chocolate Bananas',        items: ['Chocolate', 'Sprinkles', 'Peanuts'] },
  { category: 'Sundae Bases',             items: ['Brownies', 'Blondies', 'Apple Dumplings'] },
  { category: 'Hurricane Toppings',       items: ['Cookie Dough', 'Heath', "Reese's Peanut Butter Cups", 'Oreos', 'Cheesecake Pieces', 'Brownies', 'Chocolate Chips', 'Butterfinger', 'Snickers'] },
  { category: 'Ice Cream Maker Cambros',  items: ['Oreos', 'Chips Ahoy', 'Coconut Dream', 'Animal Cookie', 'Gingerbread', 'Biscoff'] },
];
const NOVELTY_DEFAULT_PAR = 5;

// Target is the same free-typed number for every category (no upper limit,
// unlike the old shared 0–10 TARGET_OPTIONS dropdown). On Hand is where these
// two categories differ from the rest — they track a bulk container, not a
// simple count, so they get their own input widget in renderNoveltiesPage():
//  - Hurricane Toppings: one container's fill level (Empty/1/4/1/2/3/4/Full).
//  - Ice Cream Maker Cambros: whole cambros *and* a fraction of one more, e.g.
//    "1 1/2" — a whole-count input plus a quarter-fraction select.
// Both store onHand as a plain decimal (0.25 increments), so _toMakeNovelty()
// stays one generic numeric formula for every category; _formatQty() below
// turns the decimal back into a "1 1/2"-style string for display.
const NOVELTY_HURRICANE_CATEGORY = 'Hurricane Toppings';
const NOVELTY_CAMBRO_CATEGORY    = 'Ice Cream Maker Cambros';
const HURRICANE_FILL_OPTIONS = [
  {label:'Empty', value:0},
  {label:'1/4',   value:0.25},
  {label:'1/2',   value:0.5},
  {label:'3/4',   value:0.75},
  {label:'Full',  value:1},
];
const CAMBRO_FRACTION_OPTIONS = [
  {label:'—',   value:0},
  {label:'1/4', value:0.25},
  {label:'1/2', value:0.5},
  {label:'3/4', value:0.75},
];

// Formats a decimal quantity (whole numbers, or quarters like 1.25/1.5/1.75)
// as a mixed-number string, e.g. 0.5 → "1/2", 1.5 → "1 1/2", 3 → "3". Plain
// integers (every category besides the two above) pass through unchanged.
const _QUARTER_LABELS = { 1: '1/4', 2: '1/2', 3: '3/4' };
function _formatQty(n) {
  if (n === undefined || n === null || isNaN(n)) return n;
  const whole = Math.floor(n);
  const quarters = Math.round((n - whole) * 4);
  if (quarters === 0) return String(whole);
  if (quarters === 4) return String(whole + 1);
  const fracStr = _QUARTER_LABELS[quarters];
  return whole > 0 ? `${whole} ${fracStr}` : fracStr;
}

// Ice Cream Maker Cambros' On Hand widget — a compact whole-count number input
// plus a quarter-fraction select, so staff can enter e.g. "1 1/2" (1 whole
// cambro + a half of another). onChange always receives the combined decimal.
function _buildCambroOnHandWidget(value, onChange) {
  const whole = Math.floor(value || 0);
  const frac  = Math.round(((value || 0) - whole) * 4) / 4;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
  const wholeInput = document.createElement('input');
  wholeInput.type = 'number';
  wholeInput.inputMode = 'numeric';
  wholeInput.min = '0';
  wholeInput.value = whole;
  wholeInput.className = 'settings-input novelty-num-input';
  // font-size must stay ≥16px or iOS Safari auto-zooms the whole page on focus.
  // Colors are set inline (not left to the .settings-input class) so they win
  // over the older `td input[type=number]` rule (index.html) that would
  // otherwise force a hardcoded Run-tab color regardless of the Novelties tab's
  // light/dark theme — inline always wins the cascade, and var(--...) still
  // resolves theme-aware even when set inline.
  wholeInput.style.cssText = 'width:40px;text-align:center;padding:6px 2px;margin:0;font-size:16px;min-height:40px;background:var(--panel-bg-alt);color:var(--text-primary);border:1.5px solid var(--panel-border);border-radius:8px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
  const fracSelect = makeSelect(CAMBRO_FRACTION_OPTIONS, frac, commit);
  // `td select` (index.html) sets width:100%, which — unlike a lone select
  // filling its own cell — fights the adjacent wholeInput for space inside this
  // flex row. Pin an explicit width so the two sit side by side predictably.
  fracSelect.style.cssText = 'width:56px;padding:6px 2px;font-size:13px;';
  function commit() {
    const w = Math.max(0, parseInt(wholeInput.value, 10) || 0);
    const f = Number(fracSelect.value);
    onChange(w + f);
  }
  wholeInput.onchange = commit;
  wholeInput.onblur = commit;
  wrap.appendChild(wholeInput);
  wrap.appendChild(fracSelect);
  return wrap;
}

// Shared column widths — same <colgroup> (fixed px, not %) on every category's
// table (see renderNoveltiesPage()) so Item/Target/On Hand/To Make/Made line up
// down the page regardless of category. Fixed px rather than percentages because
// On Hand's stepper (~128px) and the Made/Undo pair (~140px done-state) need a
// guaranteed minimum in actual pixels — percentages of a narrow phone width would
// squeeze them below that and cause overflow instead of alignment. Item gets
// whatever's left (no declared width); on a screen too narrow for all five to
// fit it falls back to the existing tableWrap horizontal-scroll, same pattern
// already used elsewhere in the app rather than clipping content.
const NOVELTY_COLGROUP = `
  <colgroup>
    <col>
    <col style="width:100px">
    <col style="width:140px">
    <col style="width:56px">
    <col style="width:150px">
  </colgroup>`;

function _seedNoveltiesIfEmpty() {
  if (novelties.length) return false;
  novelties = NOVELTY_CATALOG.flatMap(group =>
    group.items.map(name => ({ category: group.category, name, parLevel: NOVELTY_DEFAULT_PAR }))
  );
  return true;
}

// See _makeCoalescedSaver() (appHelpers.js): every Target/On Hand/Made edit
// fires its own save, so without coalescing an older-but-slower write can
// land after a newer one (e.g. Reset) and silently overwrite it — which is
// exactly what made another device's changes appear to vanish here. The
// catalog write shares the Run tab's `_saving` flag since both land on the
// same store doc and are watched by the same listener (loadAll()); the log
// write gets its own `_noveltiesSaving` flag since noveltiesLog/{date} is a
// separate doc with its own listener, wired up below.
async function _saveNoveltiesCatalogOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — catalog saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { novelties }, { merge: true });
  } catch (e) {
    console.error('Novelties catalog save error:', e);
    showStatusMessage('⚠ Could not save novelties catalog', 2500);
  }
}
const saveNoveltiesCatalog = _makeCoalescedSaver(_saveNoveltiesCatalogOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});

async function _saveNoveltiesLogOnce() {
  if (!window._firebaseReady) { showStatusMessage("Offline — today's checklist saved locally only", 3000); return; }
  try {
    await window._setDoc(window.getStoreNoveltiesLogRef(_workingNoveltiesDate || todayStr()), { items: _noveltiesLog, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Novelties log save error:', e);
    showStatusMessage('⚠ Could not save checklist', 2500);
  }
}
const saveNoveltiesLog = _makeCoalescedSaver(_saveNoveltiesLogOnce, {
  onStart:  () => { _noveltiesSaving = true; },
  onSettle: () => { _noveltiesSaving = false; },
});

// Loads (and switches the working date to) a specific date's checklist — this is
// what "recall a past day" does, and also what a fresh tab-open runs on day one.
// Now live: a matching onSnapshot keeps this date's checklist in sync with
// whatever any other device does to it, the same way the Run tab already works.
async function loadNoveltiesForDate(date) {
  _workingNoveltiesDate = date;
  if (_unsubscribeNoveltiesSnapshot) { _unsubscribeNoveltiesSnapshot(); _unsubscribeNoveltiesSnapshot = null; }
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
  if (window._firebaseReady && window._onSnapshot) {
    try {
      _unsubscribeNoveltiesSnapshot = window._onSnapshot(window.getStoreNoveltiesLogRef(date), snap => {
        if (_noveltiesSaving) return;
        _noveltiesLog = snap.exists() ? (snap.data().items || []) : [];
        renderNoveltiesPage();
      }, err => console.error('Novelties snapshot listener error:', err));
    } catch (e) {
      console.error('Failed to start novelties snapshot listener:', e);
    }
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

// Hurricane Toppings has no Target — each topping is one container, so "needs
// filling" just means On Hand hasn't reached Full (1) yet. Every other category
// still diffs against its numeric Target.
function _toMakeNovelty(item, entry) {
  if (item.category === NOVELTY_HURRICANE_CATEGORY) {
    return (entry.onHand || 0) >= 1 ? 0 : 1;
  }
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

// ── Reset ──────────────────────────────────────────────────────────────────
// Resets today's on-hand counts back to 0 (same undo-toast pattern as the
// Run tab's resetDay()) — 5-second recovery window, no confirm() dialog.
let _noveltiesResetSnapshot  = null;
let _noveltiesResetUndoTimer = null;

function resetNoveltiesDay() {
  if (_noveltiesResetUndoTimer) { clearTimeout(_noveltiesResetUndoTimer); _noveltiesResetSnapshot = null; _noveltiesResetUndoTimer = null; }
  _noveltiesResetSnapshot = _noveltiesLog.map(e => ({ ...e }));
  _noveltiesLog.forEach(e => { e.onHand = 0; delete e.madeQty; });
  saveNoveltiesLog();
  renderNoveltiesPage();
  showUndoToast('⟳ Checklist reset — tap Undo to restore', undoNoveltiesReset);
  _noveltiesResetUndoTimer = setTimeout(() => {
    _noveltiesResetSnapshot = null;
    _noveltiesResetUndoTimer = null;
    hideUndoToast();
  }, 5000);
}

function undoNoveltiesReset() {
  if (!_noveltiesResetSnapshot) return;
  clearTimeout(_noveltiesResetUndoTimer);
  _noveltiesLog = _noveltiesResetSnapshot;
  _noveltiesResetSnapshot = null;
  _noveltiesResetUndoTimer = null;
  saveNoveltiesLog();
  renderNoveltiesPage();
  hideUndoToast();
}

// ── Print ──────────────────────────────────────────────────────────────────
function printNovelties() {
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const rows = novelties.map(item => {
    const entry = _getLogEntry(item);
    const need  = _toMakeNovelty(item, entry);
    const isHurricane = item.category === NOVELTY_HURRICANE_CATEGORY;
    return `<tr>
      <td>${item.category}</td>
      <td>${item.name}</td>
      <td style="text-align:center">${isHurricane ? '—' : item.parLevel}</td>
      <td style="text-align:center">${_formatQty(entry.onHand)}</td>
      <td style="text-align:center;font-weight:bold">${need > 0 ? (isHurricane ? 'Fill' : _formatQty(need)) : '—'}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Novelties Checklist — ${today}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; color: #000; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0 0 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 6px 8px; border-bottom: 2px solid #d72627; color: #444; }
    td { padding: 7px 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f9f9f9; }
  </style></head><body>
  <h2>Handel's — Novelties Checklist</h2>
  <p>${today}</p>
  <table>
    <thead><tr>
      <th>Category</th>
      <th>Item</th>
      <th style="text-align:center">Target</th>
      <th style="text-align:center">On Hand</th>
      <th style="text-align:center">To Make</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) { w.document.write(html); w.document.close(); }
  else { alert('Please allow pop-ups for this page to print.'); }
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

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.style.marginBottom = '14px';
  toolbar.innerHTML = `
    <button class="btn btn-red" onclick="resetNoveltiesDay()">&#8635; Reset</button>
    <button class="btn" onclick="printNovelties()">&#128438; Print</button>
  `;
  content.appendChild(toolbar);

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

      const tableWrap = document.createElement('div');
      tableWrap.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch;';

      const table = document.createElement('table');
      // table-layout:fixed + an identical <colgroup> on every category's table is
      // what makes the columns line up all the way down the page — without it each
      // table auto-sizes its own columns from its own content (e.g. longer item
      // names), so Target/On Hand/To Make land at different x-positions per category.
      table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed;';
      table.innerHTML = NOVELTY_COLGROUP;
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
        const isHurricane = item.category === NOVELTY_HURRICANE_CATEGORY;
        // Self-heal: stores that had the (now-reverted) Hurricane/Cambros fill-word
        // Target ('Full', '1/2', etc.) get bumped back to a plain number once, so
        // the free-typed input below always starts from a valid value. Skipped for
        // Hurricane Toppings — it no longer has a Target at all (see below).
        if (!isHurricane && typeof item.parLevel !== 'number') {
          item.parLevel = NOVELTY_DEFAULT_PAR;
          saveNoveltiesCatalog();
        }
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom:1px solid var(--panel-border);';

        const tdName = document.createElement('td');
        tdName.style.cssText = 'padding:9px 4px;font-weight:600;';
        tdName.textContent = item.name;
        tr.appendChild(tdName);

        // Target — free-typed number, same widget for every category except
        // Hurricane Toppings. Each topping only has one container, so there's
        // nothing to set a target quantity for — On Hand reading Full already
        // means nothing needs filling (see _toMakeNovelty()). Persists on the
        // store doc via saveNoveltiesCatalog(), same as before.
        const tdTarget = document.createElement('td');
        tdTarget.style.cssText = 'text-align:center;padding:9px 4px;';
        if (isHurricane) {
          const span = document.createElement('span');
          span.textContent = '—';
          span.style.color = 'var(--text-dim)';
          tdTarget.appendChild(span);
        } else {
          const renderTargetCell = () => {
            tdTarget.innerHTML = '';
            if (_managerUnlocked) {
              const input = document.createElement('input');
              input.type = 'number';
              input.inputMode = 'numeric';
              input.min = '0';
              input.value = item.parLevel || 0;
              input.className = 'settings-input novelty-num-input';
              // See _buildCambroOnHandWidget() for why font-size/colors are set
              // inline: keeps this ≥16px (no iOS auto-zoom on focus) and wins
              // over the older `td input[type=number]` rule that would otherwise
              // force a hardcoded color regardless of the current theme.
              input.style.cssText = 'width:60px;text-align:center;padding:6px 4px;margin:0 auto;font-size:16px;min-height:40px;background:var(--panel-bg-alt);color:var(--text-primary);border:1.5px solid var(--panel-border);border-radius:8px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
              const commit = () => {
                const val = Math.max(0, parseInt(input.value, 10) || 0);
                input.value = val;
                if (val !== item.parLevel) {
                  item.parLevel = val;
                  saveNoveltiesCatalog();
                  renderToMakeCell();
                }
              };
              input.onchange = commit;
              input.onblur = commit;
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
        }
        tr.appendChild(tdTarget);

        // On Hand — a plain −/value/+ stepper for most categories, but the two
        // bulk-container categories get their own widget instead:
        //  - Hurricane Toppings: single container fill level (Empty…Full).
        //  - Ice Cream Maker Cambros: whole cambros + a quarter-fraction of one
        //    more (e.g. "1 1/2"), since more than one can be on hand at once.
        const tdOnHand = document.createElement('td');
        tdOnHand.style.cssText = 'text-align:center;padding:9px 4px;';
        const onChangeOnHand = val => {
          entry.onHand = val;
          saveNoveltiesLog();
          renderToMakeCell();
          checkNoveltiesComplete();
        };
        if (isHurricane) {
          tdOnHand.appendChild(makeSelect(HURRICANE_FILL_OPTIONS, entry.onHand || 0, onChangeOnHand));
        } else if (item.category === NOVELTY_CAMBRO_CATEGORY) {
          tdOnHand.appendChild(_buildCambroOnHandWidget(entry.onHand, onChangeOnHand));
        } else {
          tdOnHand.appendChild(buildQuantityStepper({ value: entry.onHand, max: 999, onChange: onChangeOnHand }));
        }
        tr.appendChild(tdOnHand);

        // To Make
        const tdMake = document.createElement('td');
        tdMake.style.cssText = 'text-align:center;padding:9px 4px;font-weight:700;';
        const renderToMakeCell = () => {
          const need = _toMakeNovelty(item, entry);
          tdMake.textContent = need > 0 ? (isHurricane ? 'Fill' : _formatQty(need)) : '—';
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
            // openMadeStepper() floors via parseInt(), so a fractional need
            // (Ice Cream Maker Cambros) just prefills with its whole-number part.
            value: _toMakeNovelty(item, entry),
            onSubmit: qty => setNoveltyMade(item, entry, qty)
          });
          tdMadeBtn.appendChild(madeBtn);
        }
        tr.appendChild(tdMadeBtn);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      tableWrap.appendChild(table);
      section.appendChild(tableWrap);
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
        const categories = {};
        madeItems.forEach(item => {
          categories[item.category] = (categories[item.category] || 0) + (_getLogEntry(item).madeQty || 0);
        });
        const newEntry = {
          type: 'novelties_completed', items: totalMade, categories, at: Date.now(),
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
