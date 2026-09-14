// Inventory tracking with biweekly order calculations.
// Separate catalog from Novelties — raw supplies (base mix, boxes, liners, etc.),
// manager-configured, importable from a distributor CSV.
//
// Catalog (name, unit, category, parLevel, pricePerUnit, locationOrder,
// distributorOrder, history) is persistent — store.inventoryCatalog, merged onto
// the existing store doc. Each count session's on-hand numbers live in their own
// small doc, organizations/{orgId}/stores/{storeId}/inventoryLog/{date}, so a past
// count can be pulled back up and continued rather than overwritten.
//
// Order qty = max(0, parLevel - onHand) ("hybrid" approach: manager sets the par,
// each item's history is a reference trail, not a forecast). Value = onHand × price,
// summed for a running total-inventory-value figure.
// "Biweekly" is a cadence reminder (no backend cron here) — a banner shows once
// settings.inventory.inventoryCountIntervalDays has elapsed since the last full count.

let inventoryCatalog = []; // [{ name, unit, category, parLevel, pricePerUnit, locationOrder, distributorOrder, history }]
let _inventoryLog = []; // working date's counts: [{ name, onHand }]
let _workingInventoryDate = null;
let _inventoryLastCountedAt = null; // populated by applyData() in store-org.js
let _inventorySortMode = 'location'; // 'location' | 'distributor'
// Session-only record of the most recent CSV import batch, powering the
// "Remove this import" action in the CSV import panel — not persisted, and
// deliberately scoped to only the single most recent import (see
// _undoLastImport() for why supporting older imports would need more).
let _lastImportBatch = null; // { names: [...], importedAt } | null

// See _makeCoalescedSaver() (appHelpers.js) — same rapid-edit race as the Run
// and Novelties tabs. Catalog shares `_saving` since it lands on the store doc
// alongside everything else that flag already guards; the log write doesn't
// need its own flag since inventoryLog has no live listener (see
// loadInventoryForDate() below).
async function _saveInventoryCatalogOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — catalog saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { inventoryCatalog, inventoryLastCountedAt: _inventoryLastCountedAt }, { merge: true });
  } catch (e) {
    console.error('Inventory catalog save error:', e);
    showStatusMessage('⚠ Could not save catalog', 2500);
  }
}
const saveInventoryCatalog = _makeCoalescedSaver(_saveInventoryCatalogOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});

async function _saveInventoryLogOnce() {
  if (!window._firebaseReady) { showStatusMessage("Offline — this count saved locally only", 3000); return; }
  try {
    await window._setDoc(window.getStoreInventoryLogRef(_workingInventoryDate || todayStr()), { items: _inventoryLog, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Inventory log save error:', e);
    showStatusMessage('⚠ Could not save count', 2500);
  }
}
const saveInventoryLog = _makeCoalescedSaver(_saveInventoryLogOnce);

// Loads (and switches the working date to) a specific count session — same
// recall pattern as the Run and Novelties. No live snapshot listener: inventory
// counts are a periodic, usually single-session task.
async function loadInventoryForDate(date) {
  _workingInventoryDate = date;
  let logData = null;
  if (window._firebaseReady) {
    try {
      const snap = await window._getDoc(window.getStoreInventoryLogRef(date));
      if (snap.exists()) logData = snap.data();
    } catch (e) {
      console.error('Inventory log load error:', e);
    }
  }
  _inventoryLog = logData?.items || [];
  renderInventoryPage();
  // The Admin tab's Current Inventory Value (js/settings.js) reads
  // _inventoryLog too, and may have rendered before this load finished if it
  // was opened without ever visiting the Order tab first this session —
  // refresh it so that figure doesn't stay stuck at whatever it showed
  // (typically $0) before this data actually arrived.
  if (document.getElementById('tabPanelSettings')?.classList.contains('active') && typeof renderSettingsPage === 'function') {
    renderSettingsPage();
  }
}

async function listRecentInventoryDates(max = 60) {
  if (!window._firebaseReady || !window._getDocs || !window._query) return [];
  try {
    const q = window._query(window.getStoreInventoryLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(max));
    const snap = await window._getDocs(q);
    return snap.docs.map(d => d.id);
  } catch (e) {
    console.error('List inventory dates error:', e);
    return [];
  }
}

function _countIntervalDays() {
  const cfg = _storeSettings && _storeSettings.inventory;
  return (cfg && cfg.inventoryCountIntervalDays) || 14;
}

function _isCountDue() {
  if (!inventoryCatalog.length) return false;
  if (!_inventoryLastCountedAt) return true;
  const days = (Date.now() - _inventoryLastCountedAt) / 86400000;
  return days >= _countIntervalDays();
}

// Finds (or lazily creates) this item's entry in the currently-loaded count session.
function _getInventoryEntry(item) {
  let entry = _inventoryLog.find(e => e.name === item.name);
  if (!entry) {
    entry = { name: item.name, onHand: 0 };
    _inventoryLog.push(entry);
  }
  return entry;
}

function _orderQty(item, entry) {
  return Math.max(0, (item.parLevel || 0) - (entry.onHand || 0));
}

function _inventoryValue(item, entry) {
  return (entry.onHand || 0) * (item.pricePerUnit || 0);
}

// Records this count session's on-hand into the item's history (capped 6, one
// entry per date — re-completing the same date's count updates that entry).
function _recordHistory(item, entry) {
  const date = _workingInventoryDate || todayStr();
  item.history = item.history || [];
  const existing = item.history.find(h => h.date === date);
  if (existing) {
    existing.onHand = entry.onHand;
  } else {
    item.history.push({ date, onHand: entry.onHand });
  }
  if (item.history.length > 6) item.history = item.history.slice(-6);
}

function _sortedInventoryCatalog() {
  const key = _inventorySortMode === 'distributor' ? 'distributorOrder' : 'locationOrder';
  return [...inventoryCatalog].sort((a, b) => (a[key] || 0) - (b[key] || 0) || a.name.localeCompare(b.name));
}

// ── Date recall ──────────────────────────────────────────────────────────────
function _renderInventoryDatePicker() {
  const container = document.getElementById('inventoryDatePicker');
  if (!container) return;
  const isToday = _workingInventoryDate === todayStr();
  container.style.position = 'relative';
  container.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.cssText = 'font-size:12px;padding:8px 12px;';
  btn.textContent = `📅 ${isToday ? 'Today' : _workingInventoryDate} ▾`;
  btn.onclick = e => { e.stopPropagation(); _toggleInventoryDateMenu(); };
  container.appendChild(btn);

  if (!isToday) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.style.cssText = 'font-size:12px;padding:8px 12px;margin-left:6px;';
    backBtn.textContent = '↩ Back to Today';
    backBtn.onclick = () => loadInventoryForDate(todayStr());
    container.appendChild(backBtn);
  }

  const menu = document.createElement('div');
  menu.id = 'inventoryDateMenu';
  menu.style.cssText = 'display:none;position:absolute;top:110%;left:0;background:#1a2744;border:1.5px solid #2e4a70;border-radius:8px;overflow:hidden;z-index:200;min-width:200px;max-height:280px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
  container.appendChild(menu);
}

async function _toggleInventoryDateMenu() {
  const menu = document.getElementById('inventoryDateMenu');
  if (!menu) return;
  if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
  menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">Loading…</div>';
  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: true }), 0);

  const dates = await listRecentInventoryDates();
  menu.innerHTML = '';
  if (!dates.length) {
    menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">No saved counts yet.</div>';
    return;
  }
  dates.forEach(d => {
    const row = document.createElement('button');
    row.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;border-bottom:1px solid #2e4a70;color:#c5d8f0;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;font-size:13px;cursor:pointer;';
    row.textContent = d === todayStr() ? `${d} (Today)` : d;
    row.onclick = () => { loadInventoryForDate(d); menu.style.display = 'none'; };
    menu.appendChild(row);
  });
}

// ── CSV import (flexible column mapping) ─────────────────────────────────────
// Distributor CSV formats vary and aren't known in advance, so rather than
// requiring an exact template, we detect whatever columns the file has and let
// the manager map them to our fields.
const INVENTORY_CSV_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'price', label: 'Price' },
  { key: 'source', label: 'Source' },
  { key: 'locationOrder', label: 'Store Location Order (#)' },
  { key: 'distributorOrder', label: 'Item #' },
  { key: 'par', label: 'Par Level' },
];

// Fixed choices for the Source column, plus a free-typed custom option — see
// _buildSourceField() below. Stored as a plain string either way (one of
// these three, or whatever custom text was typed), so CSV import/export and
// display never need to distinguish "fixed" from "custom".
const INVENTORY_SOURCE_OPTIONS = ['Distributor', 'Amazon', 'Grocery Store'];

// A raw substring match against the literal camelCase key (e.g. "locationorder")
// only ever matches a header that already spells the key out — real distributor
// headers like "Location Order", "Aisle", or "Vendor Code" never would, which is
// exactly the two fields TODO.md flagged as unconfirmed against a real export.
// Normalizing punctuation/spaces out of both sides, plus a short synonym list,
// covers the common real-world spellings without requiring an exact template.
const CSV_FIELD_SYNONYMS = {
  name: ['name', 'item', 'itemname', 'description', 'product'],
  price: ['price', 'cost', 'unitprice', 'unitcost'],
  source: ['source', 'vendor', 'supplier'],
  locationOrder: ['locationorder', 'storeorder', 'storelocation', 'aisle', 'shelf'],
  distributorOrder: ['itemnumber', 'itemcode', 'itemno', 'distributororder', 'distributor', 'vendororder', 'vendorcode', 'sku'],
  par: ['par', 'parlevel', 'parqty', 'reorderlevel', 'min'],
};
function _normalizeCsvHeader(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function _guessCsvColumn(headers, fieldKey) {
  const normHeaders = headers.map(_normalizeCsvHeader);
  const candidates = CSV_FIELD_SYNONYMS[fieldKey] || [_normalizeCsvHeader(fieldKey)];
  for (const cand of candidates) {
    const idx = normHeaders.findIndex(h => h.includes(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Source column widget: a select with the fixed options plus "Custom…", which
// reveals a text input for a free-typed source (e.g. a specific local
// supplier). Always resolves to a plain string — one of INVENTORY_SOURCE_OPTIONS,
// or whatever custom text was typed — so storage/display never needs to know
// which kind it is.
function _buildSourceField(value, onChange) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  const label = document.createElement('span');
  label.className = 'settings-label';
  label.textContent = 'Source';
  const select = document.createElement('select');
  select.className = 'settings-input';
  // customSources (Admin "Custom Order Sources", js/settings.js) are saved,
  // reusable sources on top of the three fixed ones — "Custom…" below is
  // still there for a genuine one-off not worth saving to that list.
  const allOptions = [...INVENTORY_SOURCE_OPTIONS, ...customSources];
  const isCustom = !!value && !allOptions.includes(value);
  allOptions.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  });
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = 'Custom…';
  select.appendChild(customOpt);
  select.value = isCustom ? '__custom__' : (value || '');

  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.className = 'settings-input';
  customInput.placeholder = 'Custom source';
  customInput.style.display = isCustom ? '' : 'none';
  customInput.value = isCustom ? value : '';

  select.onchange = () => {
    if (select.value === '__custom__') {
      customInput.style.display = '';
      customInput.focus();
      onChange(customInput.value.trim());
    } else {
      customInput.style.display = 'none';
      onChange(select.value);
    }
  };
  customInput.onchange = () => onChange(customInput.value.trim());

  wrap.append(label, select, customInput);
  return wrap;
}

// Location dropdown — reads from the store-wide `locations` list (Admin
// "Store Locations", js/settings.js), shared with Freezer/Fridge Equipment
// (js/temps.js). Plain <select>, no inline custom-add here — that's a
// deliberate Admin-only action (js/settings.js) so the list stays a single,
// reusable set of names rather than getting created ad hoc from wherever a
// dropdown happens to appear.
function _buildLocationField(value, onChange) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  const label = document.createElement('span');
  label.className = 'settings-label';
  label.textContent = 'Location';
  const select = document.createElement('select');
  select.className = 'settings-input';
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = locations.length ? '— none —' : 'No locations set up (Admin)';
  select.appendChild(noneOpt);
  locations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    if (loc === value) opt.selected = true;
    select.appendChild(opt);
  });
  select.onchange = () => onChange(select.value);
  wrap.append(label, select);
  return wrap;
}

// Minimal RFC4180-ish CSV parser: handles quoted fields, escaped "" quotes,
// commas inside quotes, and CRLF/LF line endings. No external library available.
function _parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map(h => h.trim());
  return { headers, rows: rows.slice(1).filter(r => r.some(c => c.trim() !== '')) };
}

function _buildCsvImportPanel(container) {
  container.innerHTML = '';

  // "Undo last import" — module-level (not local to this closure) so it
  // survives renderInventoryPage() rebuilding this whole panel after a
  // successful commit. Session-only (not persisted), scoped to exactly the
  // items the most recent import added — doesn't attempt to support undoing
  // an older import from history, which would need every catalog item
  // permanently tagged with its import batch.
  if (_lastImportBatch) {
    const undoRow = document.createElement('div');
    undoRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--panel-bg-alt);border:1px solid var(--panel-border);border-radius:8px;padding:10px 12px;margin-bottom:10px;';
    const label = document.createElement('span');
    label.style.cssText = 'font-size:12px;color:var(--text-muted);';
    label.textContent = `Last import: ${_lastImportBatch.names.length} item${_lastImportBatch.names.length !== 1 ? 's' : ''} at ${new Date(_lastImportBatch.importedAt).toLocaleTimeString()}`;
    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn';
    undoBtn.style.cssText = 'font-size:12px;padding:6px 12px;color:#ff8080;border-color:#d72627;';
    undoBtn.textContent = '↺ Remove this import';
    undoBtn.onclick = () => _undoLastImport();
    undoRow.append(label, undoBtn);
    container.appendChild(undoRow);
  }

  let parsed = null;
  let mapSelects = {};
  let parsedItems = [];

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv,text/csv';
  fileInput.className = 'settings-input';
  container.appendChild(fileInput);

  const mapWrap = document.createElement('div');
  mapWrap.style.cssText = 'display:none;margin-top:10px;';
  container.appendChild(mapWrap);

  const previewWrap = document.createElement('div');
  previewWrap.style.cssText = 'margin-top:10px;max-height:220px;overflow:auto;';
  container.appendChild(previewWrap);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
  const previewBtn = document.createElement('button');
  previewBtn.className = 'btn';
  previewBtn.textContent = 'Preview';
  previewBtn.style.display = 'none';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.display = 'none';
  const commitBtn = document.createElement('button');
  commitBtn.className = 'btn btn-green';
  commitBtn.style.display = 'none';
  btnRow.append(previewBtn, cancelBtn, commitBtn);
  container.appendChild(btnRow);

  // Back out of an in-progress import (mid column-mapping or after previewing,
  // before committing anything) — resets this panel to the initial file-picker
  // state without touching the catalog.
  function _resetImportPanel() {
    parsed = null;
    mapSelects = {};
    parsedItems = [];
    fileInput.value = '';
    mapWrap.innerHTML = '';
    mapWrap.style.display = 'none';
    previewWrap.innerHTML = '';
    previewBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    commitBtn.style.display = 'none';
  }
  cancelBtn.onclick = _resetImportPanel;

  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      parsed = _parseCSV(String(reader.result));
      mapWrap.innerHTML = '';
      previewWrap.innerHTML = '';
      commitBtn.style.display = 'none';
      mapSelects = {};
      cancelBtn.style.display = '';
      if (!parsed.headers.length) {
        mapWrap.innerHTML = '<div class="settings-note">Could not read any columns from that file.</div>';
        mapWrap.style.display = '';
        previewBtn.style.display = 'none';
        return;
      }
      INVENTORY_CSV_FIELDS.forEach(fdef => {
        const row = document.createElement('div');
        row.className = 'settings-row';
        const label = document.createElement('span');
        label.className = 'settings-label';
        label.textContent = fdef.label + (fdef.required ? ' *' : '');
        const select = document.createElement('select');
        select.className = 'settings-input';
        if (!fdef.required) {
          const noneOpt = document.createElement('option');
          noneOpt.value = '';
          noneOpt.textContent = '— none —';
          select.appendChild(noneOpt);
        }
        parsed.headers.forEach((h, i) => {
          const opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = h || `Column ${i + 1}`;
          select.appendChild(opt);
        });
        const guessIdx = _guessCsvColumn(parsed.headers, fdef.key);
        if (guessIdx >= 0) select.value = String(guessIdx);
        mapSelects[fdef.key] = select;
        row.append(label, select);
        mapWrap.appendChild(row);
      });
      mapWrap.style.display = '';
      previewBtn.style.display = '';
    };
    reader.readAsText(file);
  };

  previewBtn.onclick = () => {
    if (!parsed) return;
    const nameIdx = parseInt(mapSelects.name.value);
    if (isNaN(nameIdx)) { showStatusMessage('⚠ Map a Name column first', 2500); return; }
    const get = (cols, fieldKey) => {
      const sel = mapSelects[fieldKey];
      if (!sel || sel.value === '') return '';
      return (cols[parseInt(sel.value)] || '').trim();
    };
    const existingNames = new Set(inventoryCatalog.map(i => i.name.toLowerCase()));
    const seen = new Set();
    parsedItems = [];
    previewWrap.innerHTML = '';
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
    parsed.rows.forEach(cols => {
      const name = (cols[nameIdx] || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const row = document.createElement('tr');
      if (existingNames.has(key) || seen.has(key)) {
        row.innerHTML = `<td style="padding:5px 8px;color:var(--text-dim);">${name} — already in catalog, skipped</td>`;
        table.appendChild(row);
        return;
      }
      seen.add(key);
      const priceRaw = get(cols, 'price').replace(/[^0-9.]/g, '');
      const item = {
        name,
        unit: 'units',
        source: get(cols, 'source'),
        locationOrder: parseInt(get(cols, 'locationOrder')) || 0,
        distributorOrder: parseInt(get(cols, 'distributorOrder')) || 0,
        parLevel: parseInt(get(cols, 'par')) || 0,
        pricePerUnit: parseFloat(priceRaw) || 0,
        history: [],
      };
      parsedItems.push(item);
      row.innerHTML = `<td style="padding:5px 8px;">${name}</td><td style="padding:5px 8px;">$${item.pricePerUnit.toFixed(2)}</td><td style="padding:5px 8px;">${item.source || '—'}</td>`;
      table.appendChild(row);
    });
    previewWrap.appendChild(table);
    commitBtn.textContent = `+ Import ${parsedItems.length} Item${parsedItems.length !== 1 ? 's' : ''}`;
    commitBtn.style.display = parsedItems.length ? '' : 'none';
  };

  commitBtn.onclick = () => {
    if (!parsedItems.length) return;
    inventoryCatalog = [...inventoryCatalog, ...parsedItems];
    saveInventoryCatalog();
    _lastImportBatch = { names: parsedItems.map(i => i.name), importedAt: Date.now() };
    showStatusMessage(`✓ Imported ${parsedItems.length} item${parsedItems.length !== 1 ? 's' : ''}`, 2500);
    _resetImportPanel();
    renderInventoryPage();
  };
}

// Removes exactly the items the most recent CSV import added (see
// _lastImportBatch above) — matched by name, same identity key the import's
// own duplicate-skip check uses. Does not attempt to restore an item that
// already existed under the same name before the import (there was nothing
// to restore — that name was skipped as a duplicate at import time).
function _undoLastImport() {
  if (!_lastImportBatch) return;
  const namesToRemove = new Set(_lastImportBatch.names);
  const before = inventoryCatalog.length;
  inventoryCatalog = inventoryCatalog.filter(i => !namesToRemove.has(i.name));
  const removed = before - inventoryCatalog.length;
  saveInventoryCatalog();
  _lastImportBatch = null;
  showStatusMessage(`✓ Removed ${removed} item${removed !== 1 ? 's' : ''} from the last import`, 2500);
  renderInventoryPage();
}

// Called from the Admin tab (js/settings.js "Order Tab Setup", 2026-09-13) —
// used to render inline on the Order tab itself. Catalog setup (this + Add
// Supply Item below) now lives in Admin; the Order tab is daily-use only.
function _renderOrderCsvImportSection(container) {
  const importSection = _settingsSection('Import from Distributor CSV');
  const importPanel = document.createElement('div');
  _buildCsvImportPanel(importPanel);
  importSection.appendChild(importPanel);
  container.appendChild(importSection);
}

// Called from the Admin tab (js/settings.js "Order Tab Setup", 2026-09-13).
// Every column is fillable right here at add time (not just via CSV import)
// — Source/Item #/Location Order # used to only be settable through CSV
// import, defaulting to blank/0 for a manually-added item.
function _renderAddSupplyItemSection(container) {
  const addSection = _settingsSection('Add Supply Item');
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;';
  const nameInput = document.createElement('input');
  nameInput.className = 'settings-input';
  nameInput.placeholder = 'Name (e.g. Vanilla Base Mix)';
  nameInput.style.flex = '2';
  nameInput.style.minWidth = '160px';
  const unitInput = document.createElement('input');
  unitInput.className = 'settings-input';
  unitInput.placeholder = 'Unit (e.g. cases)';
  unitInput.style.flex = '1';
  unitInput.style.minWidth = '90px';
  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.className = 'settings-input';
  priceInput.placeholder = 'Price';
  priceInput.style.width = '80px';
  const parInput = document.createElement('input');
  parInput.type = 'number';
  parInput.className = 'settings-input';
  parInput.placeholder = 'Par';
  parInput.style.width = '70px';
  const itemNumInput = document.createElement('input');
  itemNumInput.type = 'number';
  itemNumInput.className = 'settings-input';
  itemNumInput.placeholder = 'Item #';
  itemNumInput.style.width = '80px';
  const locOrderInput = document.createElement('input');
  locOrderInput.type = 'number';
  locOrderInput.className = 'settings-input';
  locOrderInput.placeholder = 'Store Location #';
  locOrderInput.style.width = '110px';
  let addSource = '';
  const sourceField = _buildSourceField('', v => { addSource = v; });
  sourceField.style.width = '150px';
  let addLocation = '';
  const locationField = _buildLocationField('', v => { addLocation = v; });
  locationField.style.width = '150px';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-green';
  addBtn.textContent = '+ Add';
  addBtn.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    inventoryCatalog.push({
      name,
      unit: unitInput.value.trim() || 'units',
      source: addSource,
      location: addLocation,
      locationOrder: parseInt(locOrderInput.value) || 0,
      distributorOrder: parseInt(itemNumInput.value) || 0,
      pricePerUnit: parseFloat(priceInput.value) || 0,
      parLevel: Math.max(0, parseInt(parInput.value) || 0),
      history: []
    });
    saveInventoryCatalog();
    renderInventoryPage();
  };
  addRow.append(nameInput, unitInput, priceInput, parInput, itemNumInput, locOrderInput, locationField, sourceField, addBtn);
  addSection.appendChild(addRow);
  container.appendChild(addSection);
}

// Admin-tab management list for the Order tab's catalog (2026-09-13) —
// name + a compact info line, "Edit" opens the full field editor
// (openSupplyItemModal() below) instead of everything being inline. Delete
// also lives here now, not on the Order tab, matching "setup lives in
// Admin, the Order tab is daily-use only."
function _renderSupplyItemsSection(container) {
  const section = _settingsSection(`Supply Items · ${inventoryCatalog.length}`);
  if (!inventoryCatalog.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No supply items yet — import a CSV or add one above.';
    section.appendChild(empty);
  }
  [...inventoryCatalog].sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--panel-border);flex-wrap:wrap;';
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:160px;';
    info.innerHTML = `<div style="font-size:13px;font-weight:700;">${item.name}</div><div style="font-size:11px;color:var(--text-muted);">#${item.distributorOrder || '—'} · ${item.location || 'No location'} · ${item.source || 'No source'}</div>`;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.style.cssText = 'font-size:11px;padding:6px 10px;';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openSupplyItemModal(item.name);
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑';
    removeBtn.title = 'Remove item';
    removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:4px 6px;';
    removeBtn.onclick = () => _removeInventoryItem(item.name);
    btnRow.append(editBtn, removeBtn);
    row.append(info, btnRow);
    section.appendChild(row);
  });
  container.appendChild(section);
}

let _supplyItemModalName = null; // which item is currently open in the editor
function openSupplyItemModal(name) {
  const item = inventoryCatalog.find(i => i.name === name);
  if (!item) return;
  _supplyItemModalName = name;
  document.getElementById('supplyItemModalTitle').textContent = item.name;
  const body = document.getElementById('supplyItemModalBody');
  body.innerHTML = '';

  const unitField = _settingsInput('Unit', item.unit || '', 'text');
  const parField = _settingsInput('Par Level', item.parLevel || 0, 'number');
  const priceField = _settingsInput('Price / Unit', item.pricePerUnit || 0, 'number');
  const itemNumField = _settingsInput('Item #', item.distributorOrder || 0, 'number');
  const locOrderField = _settingsInput('Store Location #', item.locationOrder || 0, 'number');
  let modalSource = item.source || '';
  const sourceField = _buildSourceField(modalSource, v => { modalSource = v; });
  let modalLocation = item.location || '';
  const locationField = _buildLocationField(modalLocation, v => { modalLocation = v; });

  body.append(unitField.wrap, parField.wrap, priceField.wrap, itemNumField.wrap, locOrderField.wrap, locationField, sourceField);
  body._fields = { unitField, parField, priceField, itemNumField, locOrderField, getSource: () => modalSource, getLocation: () => modalLocation };

  document.getElementById('supplyItemModalBackdrop').classList.add('open');
}

function closeSupplyItemModal() {
  document.getElementById('supplyItemModalBackdrop').classList.remove('open');
  _supplyItemModalName = null;
}

function saveSupplyItemModal() {
  const item = inventoryCatalog.find(i => i.name === _supplyItemModalName);
  if (!item) { closeSupplyItemModal(); return; }
  const f = document.getElementById('supplyItemModalBody')._fields;
  item.unit = f.unitField.input.value.trim() || 'units';
  item.parLevel = Math.max(0, parseInt(f.parField.input.value) || 0);
  item.pricePerUnit = Math.max(0, parseFloat(f.priceField.input.value) || 0);
  item.distributorOrder = parseInt(f.itemNumField.input.value) || 0;
  item.locationOrder = parseInt(f.locOrderField.input.value) || 0;
  item.source = f.getSource();
  item.location = f.getLocation();
  saveInventoryCatalog();
  closeSupplyItemModal();
  renderSettingsPage();
  if (document.getElementById('tabPanelInventory')?.classList.contains('active')) renderInventoryPage();
  showStatusMessage(`✓ "${item.name}" updated`, 2000);
}

function renderInventoryPage() {
  const content = document.getElementById('inventoryContent');
  if (!content) return;
  if (!_workingInventoryDate) {
    loadInventoryForDate(todayStr()); // async — re-renders once the count session loads
    return;
  }
  if (typeof _applyNewPagesTheme === 'function') _applyNewPagesTheme((_storeSettings && _storeSettings.theme) || 'dark');
  content.innerHTML = '';

  const dateBar = document.createElement('div');
  dateBar.id = 'inventoryDatePicker';
  dateBar.style.marginBottom = '14px';
  content.appendChild(dateBar);
  _renderInventoryDatePicker();

  if (_isCountDue()) {
    const banner = document.createElement('div');
    banner.style.cssText = 'padding:10px 14px;border-radius:8px;background:rgba(240,165,0,0.12);border:1px solid #f0a500;color:#f0a500;font-size:12px;font-weight:700;margin-bottom:14px;';
    banner.textContent = _inventoryLastCountedAt
      ? `⚠ Inventory count due — last counted ${relativeTime(_inventoryLastCountedAt)} (every ${_countIntervalDays()} days)`
      : '⚠ No inventory count on record yet — do an initial count below.';
    content.appendChild(banner);
  } else if (_inventoryLastCountedAt) {
    const ok = document.createElement('div');
    ok.className = 'settings-note';
    ok.style.marginBottom = '14px';
    ok.textContent = `Last counted ${relativeTime(_inventoryLastCountedAt)}.`;
    content.appendChild(ok);
  }

  // Total value display moved to the Manager Dashboard's "Current Inventory
  // Value" (js/dashboard.js), which combines this list with the last
  // completed Ice Cream Run and the misc items list —
  // _inventoryValue()/_orderQty() below are still used by that calculation,
  // just no longer rendered here. CSV import and Add Supply Item moved to
  // the Admin tab (js/settings.js "Order Tab Setup", 2026-09-13) — see
  // _renderOrderCsvImportSection()/_renderAddSupplyItemSection() below.

  // ── Item list ───────────────────────────────────────────────────────────
  const sortLabel = _inventorySortMode === 'distributor' ? 'Item #' : 'Store Location';
  const listSection = _settingsSection(`Supply Items · ${inventoryCatalog.length}`);
  const sortToggle = document.createElement('button');
  sortToggle.className = 'btn';
  sortToggle.style.cssText = 'font-size:12px;padding:6px 10px;margin-bottom:10px;';
  sortToggle.textContent = `Sort: ${sortLabel} (tap to switch)`;
  sortToggle.onclick = () => {
    _inventorySortMode = _inventorySortMode === 'distributor' ? 'location' : 'distributor';
    renderInventoryPage();
  };
  listSection.appendChild(sortToggle);

  if (!inventoryCatalog.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No supply items yet — add one above or import a CSV.';
    listSection.appendChild(empty);
  }
  // Par Level/Price/Item #/Location/Source are now read-only here — set up
  // and edited from Admin's "Supply Items" popup editor (js/inventory.js
  // _renderSupplyItemsSection()/openSupplyItemModal(), 2026-09-13). This tab
  // is daily-use only: view the list, enter On Hand, produce the order.
  _sortedInventoryCatalog().forEach(item => {
    const entry = _getInventoryEntry(item);
    const row = document.createElement('div');
    row.className = 'settings-card';
    row.style.cssText += 'margin-bottom:8px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:13px;font-weight:700;flex:1;min-width:140px;';
    nameEl.textContent = `${item.name} (${item.unit})`;
    topRow.appendChild(nameEl);
    row.appendChild(topRow);

    const infoLine = document.createElement('div');
    infoLine.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:2px;';
    infoLine.textContent = `#${item.distributorOrder || '—'} · ${item.location || 'No location'} · ${item.source || 'No source'} · Par ${item.parLevel || 0}`;
    row.appendChild(infoLine);

    const fieldsRow = document.createElement('div');
    fieldsRow.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;align-items:flex-end;';

    const onHandCaption = document.createElement('span');
    onHandCaption.className = 'settings-label';
    onHandCaption.textContent = 'On Hand';
    const onHandWrap = document.createElement('div');
    onHandWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    // Whole-count + quarter-fraction widget (same as Novelties' Ice Cream
    // Maker Cambros field) — On Hand needs to accept fractions like "1 1/2",
    // not just whole numbers.
    const onHandWidget = _buildCambroOnHandWidget(entry.onHand, (val) => {
      entry.onHand = Math.max(0, val);
      _recordHistory(item, entry);
      saveInventoryLog();
      renderInventoryPage();
    });
    onHandWrap.append(onHandCaption, onHandWidget);

    const orderEl = document.createElement('div');
    orderEl.style.cssText = 'font-size:12px;';
    const qty = _orderQty(item, entry);
    orderEl.innerHTML = qty > 0
      ? `<span style="color:#ff8080;font-weight:700;">Order ${_formatQty(qty)} ${item.unit}</span>`
      : `<span style="color:#22a05a;font-weight:700;">Stocked</span>`;

    fieldsRow.append(onHandWrap, orderEl);
    row.appendChild(fieldsRow);

    const valueLine = document.createElement('div');
    valueLine.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:4px;';
    valueLine.textContent = `Value: $${_inventoryValue(item, entry).toFixed(2)}`;
    row.appendChild(valueLine);

    if (item.history && item.history.length) {
      const histEl = document.createElement('div');
      histEl.className = 'settings-note';
      histEl.style.marginTop = '6px';
      histEl.textContent = 'History: ' + item.history.map(h => `${h.date} → ${_formatQty(h.onHand)}`).join('  ·  ');
      row.appendChild(histEl);
    }

    listSection.appendChild(row);
  });
  content.appendChild(listSection);

  // ── Mark Count Complete ──────────────────────────────────────────────────
  if (inventoryCatalog.length) {
    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn btn-green';
    completeBtn.textContent = '✓ Mark Count Complete';
    completeBtn.style.marginBottom = '20px';
    completeBtn.onclick = () => {
      inventoryCatalog.forEach(item => _recordHistory(item, _getInventoryEntry(item)));
      // Only stamp "last counted now" while today's session is the one being
      // completed — recalling a past date to correct/re-save it must never
      // reset the overdue-count clock, same guard _saveAllOnce() (store-org.js)
      // already applies to currentFlavorList for the same reason.
      if ((_workingInventoryDate || todayStr()) === todayStr()) {
        _inventoryLastCountedAt = Date.now();
      }
      saveInventoryCatalog();
      saveInventoryLog();
      renderInventoryPage();
      showStatusMessage('✓ Inventory count recorded', 2000);
    };
    content.appendChild(completeBtn);
  }

  // ── Order List ────────────────────────────────────────────────────────────
  // Sorted by Item # once produced — the working Supply Items list above
  // stays in whichever sort the manager has it in (Store Location by
  // default) for walking the store during counting, but the order itself is
  // always Item #, matching how it'll be placed with the distributor.
  const toOrder = inventoryCatalog
    .filter(i => _orderQty(i, _getInventoryEntry(i)) > 0)
    .sort((a, b) => (a.distributorOrder || 0) - (b.distributorOrder || 0) || a.name.localeCompare(b.name));
  const orderSection = _settingsSection(`Order List · ${toOrder.length}`);
  if (!toOrder.length) {
    const ok = document.createElement('div');
    ok.className = 'settings-note';
    ok.textContent = inventoryCatalog.length ? 'Nothing needs ordering right now.' : 'Add items above to start tracking orders.';
    orderSection.appendChild(ok);
  } else {
    toOrder.forEach(item => {
      const entry = _getInventoryEntry(item);
      const row = document.createElement('div');
      row.className = 'settings-card';
      row.style.cssText += 'display:flex;justify-content:space-between;margin-bottom:6px;';
      row.innerHTML = `<span>#${item.distributorOrder || '—'} · ${item.name}</span><span style="font-weight:700;color:#ff8080;">${_formatQty(_orderQty(item, entry))} ${item.unit}</span>`;
      orderSection.appendChild(row);
    });
    const printBtn = document.createElement('button');
    printBtn.className = 'btn';
    printBtn.style.marginTop = '8px';
    printBtn.textContent = '🖨 Produce & Print Order List';
    printBtn.onclick = () => printOrderList(toOrder);
    orderSection.appendChild(printBtn);
  }
  content.appendChild(orderSection);

  // ── Flavor Order (js/flavor-order.js) ────────────────────────────────────
  const flavorOrderContainer = document.createElement('div');
  flavorOrderContainer.id = 'flavorOrderSection';
  flavorOrderContainer.style.marginTop = '10px';
  content.appendChild(flavorOrderContainer);
  renderFlavorOrderSection();
}

function _removeInventoryItem(name) {
  const idx = inventoryCatalog.findIndex(i => i.name === name);
  if (idx < 0) return;
  const removed = inventoryCatalog[idx];
  const prevList = [...inventoryCatalog];
  inventoryCatalog = inventoryCatalog.filter((_, i) => i !== idx);
  saveInventoryCatalog();
  renderInventoryPage();
  showUndoToast(`"${removed.name}" removed.`, () => {
    inventoryCatalog = prevList;
    saveInventoryCatalog();
    renderInventoryPage();
  });
}

// items must already be sorted by Item # (distributorOrder) — see the Order
// List section in renderInventoryPage(), which is the only caller.
function printOrderList(items) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const rows = items.map(i => {
    const entry = _getInventoryEntry(i);
    return `<tr>
    <td>${i.distributorOrder || '—'}</td>
    <td>${i.name}</td>
    <td>${i.source || '—'}</td>
    <td style="text-align:center">${_formatQty(entry.onHand)}</td>
    <td style="text-align:center">${i.parLevel}</td>
    <td style="text-align:center;font-weight:bold">${_formatQty(_orderQty(i, entry))} ${i.unit}</td>
  </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Order List — ${today}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; color: #000; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0 0 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 6px 8px; border-bottom: 2px solid #d72627; color: #444; }
    td { padding: 7px 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f9f9f9; }
  </style></head><body>
  <h2>Handel's — Supply Order List</h2>
  <p>${today} — sorted by Item #</p>
  <table>
    <thead><tr>
      <th>Item #</th>
      <th>Item</th>
      <th>Source</th>
      <th style="text-align:center">On Hand</th>
      <th style="text-align:center">Par</th>
      <th style="text-align:center">Order Qty</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) { w.document.write(html); w.document.close(); }
  else { alert('Please allow pop-ups for this page to print.'); }
}
