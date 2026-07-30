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

// Inventory is now a bottom-tab panel rather than a popup overlay — these wrappers
// stay in case anything still calls them directly.
function openInventory() {
  switchTab('Inventory');
}

function closeInventory() {
  switchTab('Run');
}

async function saveInventoryCatalog() {
  if (!window._firebaseReady) { showStatusMessage('Offline — catalog saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { inventoryCatalog, inventoryLastCountedAt: _inventoryLastCountedAt }, { merge: true });
  } catch (e) {
    console.error('Inventory catalog save error:', e);
    showStatusMessage('⚠ Could not save catalog', 2500);
  }
}

async function saveInventoryLog() {
  if (!window._firebaseReady) { showStatusMessage("Offline — this count saved locally only", 3000); return; }
  try {
    await window._setDoc(window.getStoreInventoryLogRef(_workingInventoryDate || todayStr()), { items: _inventoryLog, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Inventory log save error:', e);
    showStatusMessage('⚠ Could not save count', 2500);
  }
}

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
  { key: 'category', label: 'Category / Location Label' },
  { key: 'locationOrder', label: 'Store Location Order (#)' },
  { key: 'distributorOrder', label: 'Distributor Order (#)' },
  { key: 'par', label: 'Par Level' },
];

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
  const commitBtn = document.createElement('button');
  commitBtn.className = 'btn btn-green';
  commitBtn.style.display = 'none';
  btnRow.append(previewBtn, commitBtn);
  container.appendChild(btnRow);

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
        const guessIdx = parsed.headers.findIndex(h => h.toLowerCase().includes(fdef.key.toLowerCase()));
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
        category: get(cols, 'category'),
        locationOrder: parseInt(get(cols, 'locationOrder')) || 0,
        distributorOrder: parseInt(get(cols, 'distributorOrder')) || 0,
        parLevel: parseInt(get(cols, 'par')) || 0,
        pricePerUnit: parseFloat(priceRaw) || 0,
        history: [],
      };
      parsedItems.push(item);
      row.innerHTML = `<td style="padding:5px 8px;">${name}</td><td style="padding:5px 8px;">$${item.pricePerUnit.toFixed(2)}</td><td style="padding:5px 8px;">${item.category || '—'}</td>`;
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
    showStatusMessage(`✓ Imported ${parsedItems.length} item${parsedItems.length !== 1 ? 's' : ''}`, 2500);
    fileInput.value = '';
    mapWrap.style.display = 'none';
    previewWrap.innerHTML = '';
    previewBtn.style.display = 'none';
    commitBtn.style.display = 'none';
    parsedItems = [];
    renderInventoryPage();
  };
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

  // ── Total value ───────────────────────────────────────────────────────────
  const totalValue = inventoryCatalog.reduce((sum, item) => sum + _inventoryValue(item, _getInventoryEntry(item)), 0);
  const valueEl = document.createElement('div');
  valueEl.style.cssText = 'font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:14px;';
  valueEl.textContent = `Total Inventory Value: $${totalValue.toFixed(2)}`;
  content.appendChild(valueEl);

  // ── CSV import ────────────────────────────────────────────────────────────
  const importSection = _settingsSection('Import from Distributor CSV');
  const importPanel = document.createElement('div');
  _buildCsvImportPanel(importPanel);
  importSection.appendChild(importPanel);
  content.appendChild(importSection);

  // ── Add item ────────────────────────────────────────────────────────────
  const addSection = _settingsSection('Add Supply Item');
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
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
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-green';
  addBtn.textContent = '+ Add';
  addBtn.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    inventoryCatalog.push({
      name,
      unit: unitInput.value.trim() || 'units',
      category: '',
      locationOrder: 0,
      distributorOrder: 0,
      pricePerUnit: parseFloat(priceInput.value) || 0,
      parLevel: Math.max(0, parseInt(parInput.value) || 0),
      history: []
    });
    saveInventoryCatalog();
    renderInventoryPage();
  };
  addRow.append(nameInput, unitInput, priceInput, parInput, addBtn);
  addSection.appendChild(addRow);
  content.appendChild(addSection);

  // ── Item list ───────────────────────────────────────────────────────────
  const sortLabel = _inventorySortMode === 'distributor' ? 'Distributor Order' : 'Store Location';
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
  _sortedInventoryCatalog().forEach(item => {
    const entry = _getInventoryEntry(item);
    const row = document.createElement('div');
    row.className = 'settings-card';
    row.style.cssText += 'margin-bottom:8px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:13px;font-weight:700;flex:1;min-width:140px;';
    nameEl.textContent = `${item.name} (${item.unit})` + (item.category ? ` — ${item.category}` : '');
    topRow.appendChild(nameEl);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑';
    removeBtn.title = 'Remove item';
    removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:4px 6px;';
    removeBtn.onclick = () => _removeInventoryItem(item.name);
    topRow.appendChild(removeBtn);
    row.appendChild(topRow);

    const fieldsRow = document.createElement('div');
    fieldsRow.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;align-items:flex-end;';

    const onHandField = _settingsInput('On Hand', entry.onHand, 'number');
    onHandField.wrap.style.width = '90px';
    const parField = _settingsInput('Par Level', item.parLevel, 'number');
    parField.wrap.style.width = '90px';
    const priceField = _settingsInput('Price / Unit', item.pricePerUnit, 'number');
    priceField.wrap.style.width = '90px';

    const orderEl = document.createElement('div');
    orderEl.style.cssText = 'font-size:12px;';
    const valueLine = document.createElement('div');
    valueLine.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:2px;';
    const renderOrder = () => {
      const qty = _orderQty(item, entry);
      orderEl.innerHTML = qty > 0
        ? `<span style="color:#ff8080;font-weight:700;">Order ${qty} ${item.unit}</span>`
        : `<span style="color:#22a05a;font-weight:700;">Stocked</span>`;
      valueLine.textContent = `Value: $${_inventoryValue(item, entry).toFixed(2)}`;
    };
    renderOrder();

    // Full re-render on change — Total Value and the Order List section below
    // aggregate across all items and would otherwise go stale.
    onHandField.input.onchange = () => {
      entry.onHand = Math.max(0, parseInt(onHandField.input.value) || 0);
      _recordHistory(item, entry);
      saveInventoryLog();
      renderInventoryPage();
    };
    parField.input.onchange = () => {
      item.parLevel = Math.max(0, parseInt(parField.input.value) || 0);
      saveInventoryCatalog();
      renderInventoryPage();
    };
    priceField.input.onchange = () => {
      item.pricePerUnit = Math.max(0, parseFloat(priceField.input.value) || 0);
      saveInventoryCatalog();
      renderInventoryPage();
    };

    fieldsRow.append(onHandField.wrap, parField.wrap, priceField.wrap, orderEl);
    row.appendChild(fieldsRow);
    row.appendChild(valueLine);

    if (item.history && item.history.length) {
      const histEl = document.createElement('div');
      histEl.className = 'settings-note';
      histEl.style.marginTop = '6px';
      histEl.textContent = 'History: ' + item.history.map(h => `${h.date} → ${h.onHand}`).join('  ·  ');
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
      _inventoryLastCountedAt = Date.now();
      saveInventoryCatalog();
      saveInventoryLog();
      renderInventoryPage();
      showStatusMessage('✓ Inventory count recorded', 2000);
    };
    content.appendChild(completeBtn);
  }

  // ── Order List ────────────────────────────────────────────────────────────
  const toOrder = inventoryCatalog.filter(i => _orderQty(i, _getInventoryEntry(i)) > 0);
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
      row.innerHTML = `<span>${item.name}</span><span style="font-weight:700;color:#ff8080;">${_orderQty(item, entry)} ${item.unit}</span>`;
      orderSection.appendChild(row);
    });
    const printBtn = document.createElement('button');
    printBtn.className = 'btn';
    printBtn.style.marginTop = '8px';
    printBtn.textContent = '🖨 Print Order List';
    printBtn.onclick = () => printOrderList(toOrder);
    orderSection.appendChild(printBtn);
  }
  content.appendChild(orderSection);
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

function printOrderList(items) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const rows = items.map(i => {
    const entry = _getInventoryEntry(i);
    return `<tr>
    <td>${i.name}</td>
    <td style="text-align:center">${entry.onHand}</td>
    <td style="text-align:center">${i.parLevel}</td>
    <td style="text-align:center;font-weight:bold">${_orderQty(i, entry)} ${i.unit}</td>
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
  <p>${today}</p>
  <table>
    <thead><tr>
      <th>Item</th>
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
