// Inventory tracking with biweekly order calculations.
// Separate catalog from Novelties — raw supplies (base mix, boxes, liners, etc.),
// manager-configured (no preset catalog, these are store/supplier-specific).
// Data lives at store.inventoryItems + store.inventoryLastCountedAt — merged onto
// the existing store doc, no new collection.
//
// Order qty = max(0, parLevel - onHand) ("hybrid" approach: manager sets the par,
// but each item keeps a short history of past counts as a reference, not a forecast).
// "Biweekly" is a cadence reminder (no backend cron here) — a banner shows once
// settings.inventory.inventoryCountIntervalDays has elapsed since the last full count.

let inventoryItems = []; // [{ name, category, unit, onHand, parLevel, history: [{date, onHand}] }]
let _inventoryLastCountedAt = null; // populated by applyData() in store-org.js

function openInventory() {
  const overlay = document.getElementById('inventoryOverlay');
  if (!overlay) return;
  renderInventoryPage();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (typeof _applyNewPagesTheme === 'function') _applyNewPagesTheme((_storeSettings && _storeSettings.theme) || 'dark');
}

function closeInventory() {
  const overlay = document.getElementById('inventoryOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

async function saveInventoryData() {
  if (!window._firebaseReady) { showStatusMessage('Offline — inventory saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), {
      inventoryItems,
      inventoryLastCountedAt: _inventoryLastCountedAt
    }, { merge: true });
  } catch (e) {
    console.error('Inventory save error:', e);
    showStatusMessage('⚠ Could not save inventory', 2500);
  }
}

function _countIntervalDays() {
  const cfg = _storeSettings && _storeSettings.inventory;
  return (cfg && cfg.inventoryCountIntervalDays) || 14;
}

function _isCountDue() {
  if (!inventoryItems.length) return false;
  if (!_inventoryLastCountedAt) return true;
  const days = (Date.now() - _inventoryLastCountedAt) / 86400000;
  return days >= _countIntervalDays();
}

function _orderQty(item) {
  return Math.max(0, (item.parLevel || 0) - (item.onHand || 0));
}

// Records today's on-hand into the item's history (capped 6, one entry per day —
// re-editing the same day updates today's entry instead of appending a duplicate).
function _recordHistory(item) {
  const today = todayStr();
  item.history = item.history || [];
  const last = item.history[item.history.length - 1];
  if (last && last.date === today) {
    last.onHand = item.onHand;
  } else {
    item.history.push({ date: today, onHand: item.onHand });
  }
  if (item.history.length > 6) item.history = item.history.slice(-6);
}

function renderInventoryPage() {
  const content = document.getElementById('inventoryContent');
  if (!content) return;
  content.innerHTML = '';

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
    inventoryItems.push({
      name,
      unit: unitInput.value.trim() || 'units',
      onHand: 0,
      parLevel: Math.max(0, parseInt(parInput.value) || 0),
      history: []
    });
    saveInventoryData();
    renderInventoryPage();
  };
  addRow.append(nameInput, unitInput, parInput, addBtn);
  addSection.appendChild(addRow);
  content.appendChild(addSection);

  // ── Item list ───────────────────────────────────────────────────────────
  const listSection = _settingsSection(`Supply Items · ${inventoryItems.length}`);
  if (!inventoryItems.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No supply items yet — add your first one above.';
    listSection.appendChild(empty);
  }
  inventoryItems.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'settings-card';
    row.style.cssText += 'margin-bottom:8px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:13px;font-weight:700;flex:1;min-width:140px;';
    nameEl.textContent = `${item.name} (${item.unit})`;
    topRow.appendChild(nameEl);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑';
    removeBtn.title = 'Remove item';
    removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:4px 6px;';
    removeBtn.onclick = () => {
      const removed = inventoryItems[idx];
      const prevList = [...inventoryItems];
      inventoryItems = inventoryItems.filter((_, i) => i !== idx);
      saveInventoryData();
      renderInventoryPage();
      showUndoToast(`"${removed.name}" removed.`, () => {
        inventoryItems = prevList;
        saveInventoryData();
        renderInventoryPage();
      });
    };
    topRow.appendChild(removeBtn);
    row.appendChild(topRow);

    const fieldsRow = document.createElement('div');
    fieldsRow.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;align-items:flex-end;';

    const onHandField = _settingsInput('On Hand', item.onHand, 'number');
    onHandField.wrap.style.width = '90px';
    const parField = _settingsInput('Par Level', item.parLevel, 'number');
    parField.wrap.style.width = '90px';

    const orderEl = document.createElement('div');
    orderEl.style.cssText = 'font-size:12px;';
    const renderOrder = () => {
      const qty = _orderQty(item);
      orderEl.innerHTML = qty > 0
        ? `<span style="color:#ff8080;font-weight:700;">Order ${qty} ${item.unit}</span>`
        : `<span style="color:#22a05a;font-weight:700;">Stocked</span>`;
    };
    renderOrder();

    // Full re-render on change (not just renderOrder()) — the Order List section
    // below aggregates across all items and would otherwise go stale.
    onHandField.input.onchange = () => {
      item.onHand = Math.max(0, parseInt(onHandField.input.value) || 0);
      _recordHistory(item);
      saveInventoryData();
      renderInventoryPage();
    };
    parField.input.onchange = () => {
      item.parLevel = Math.max(0, parseInt(parField.input.value) || 0);
      saveInventoryData();
      renderInventoryPage();
    };

    fieldsRow.append(onHandField.wrap, parField.wrap, orderEl);
    row.appendChild(fieldsRow);

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
  if (inventoryItems.length) {
    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn btn-green';
    completeBtn.textContent = '✓ Mark Count Complete';
    completeBtn.style.marginBottom = '20px';
    completeBtn.onclick = () => {
      inventoryItems.forEach(item => _recordHistory(item));
      _inventoryLastCountedAt = Date.now();
      saveInventoryData();
      renderInventoryPage();
      showStatusMessage('✓ Inventory count recorded', 2000);
    };
    content.appendChild(completeBtn);
  }

  // ── Order List ────────────────────────────────────────────────────────────
  const toOrder = inventoryItems.filter(i => _orderQty(i) > 0);
  const orderSection = _settingsSection(`Order List · ${toOrder.length}`);
  if (!toOrder.length) {
    const ok = document.createElement('div');
    ok.className = 'settings-note';
    ok.textContent = inventoryItems.length ? 'Nothing needs ordering right now.' : 'Add items above to start tracking orders.';
    orderSection.appendChild(ok);
  } else {
    toOrder.forEach(item => {
      const row = document.createElement('div');
      row.className = 'settings-card';
      row.style.cssText += 'display:flex;justify-content:space-between;margin-bottom:6px;';
      row.innerHTML = `<span>${item.name}</span><span style="font-weight:700;color:#ff8080;">${_orderQty(item)} ${item.unit}</span>`;
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

function printOrderList(items) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const rows = items.map(i => `<tr>
    <td>${i.name}</td>
    <td style="text-align:center">${i.onHand}</td>
    <td style="text-align:center">${i.parLevel}</td>
    <td style="text-align:center;font-weight:bold">${_orderQty(i)} ${i.unit}</td>
  </tr>`).join('');

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
