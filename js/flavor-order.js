// Flavor Order — Handel's corporate "FLAVORS" order form (flavoring
// ingredients + supply items ordered from the corporate office).
//
// Deliberately separate from Ice Cream Run's flavor roster/MASTER_ROSTER —
// these are supply items to purchase, not ice cream flavors produced
// in-store, and must never be confused with each other despite many sharing
// a flavor name (e.g. "Vanilla" appears on both, meaning two different
// things). Rendered inside the Order tab (js/inventory.js renderInventoryPage()),
// below the main Order list, as its own section.
//
// The item list below is fixed, transcribed from the current paper form
// (2026-09) — not manager-editable like the Order tab's own catalog. If
// Handel's changes the form, update FLAVOR_ORDER_ITEMS here to match.
//
// Target (persistent, store.flavorOrderTargets: {itemName: target}) is set
// once and rarely changed. On Hand is entered each time (a couple times a
// week) and lives in its own log, organizations/{orgId}/stores/{storeId}/
// flavorOrderLog/{date} — mirrors the Order tab's own catalog+log split, but
// simpler: always today's date, no recall picker (this list isn't reviewed
// historically the way Run/Novelties/Inventory are). Order qty = max(0,
// target - onHand), same "hybrid" model as the Order tab's own par levels.
//
// Deliberately excluded from the Admin tab's Current Inventory Value figure
// (js/settings.js) — the PDF this mirrors carries no prices, and per-item
// pricing wasn't wanted for these.

const FLAVOR_ORDER_ITEMS = [
  'Apple (QT Only)',
  'Almond (QT Only)',
  'Amaretto (QT Only)',
  'Banana (QT Only)',
  'Black Cherry',
  'Black Raspberry',
  'Black Walnut (QT Only)',
  'Blue Moon',
  'Butter Pecan',
  'Cinnamon (QT Only)',
  'Coconut',
  'Cotton Candy',
  'Double Coffee',
  'Espresso',
  'Fabri Lemon Powder (lemon ice)',
  'Grape',
  'Green Shade',
  'Green Apple (QT Only)',
  'Lemon (Lemon Bar)',
  'Lemon Dream (Lem. Mer. Pie)',
  'Lime',
  'Orange (QT Only)',
  'Peach Shade (QT Only)',
  'Peppermint',
  'Pineapple',
  'Pink Champagne',
  'Pistachio (QT Only)',
  'Rum (QT Only)',
  'Strawberry',
  'Vanilla',
  'Watermelon',
  'Empty Quart Bottles',
  '50 Gift Card Envelopes',
  'Handel Pop Stickers (500/roll)',
  'Ice Cream Sandwich Stickers (500/roll)',
  'Product Labels (500/roll)',
  'Deliciously Delivered Stickers (500/roll)',
  'Blue Food Dye',
  'Ounce Cups',
  'Chocolate Syrup Pumps',
  'Peanut Butter Pumps',
];

let flavorOrderTargets = {}; // {itemName: target} — populated by applyData() in store-org.js
let _flavorOrderLog = {};    // today's on-hand: {itemName: number}
let _flavorOrderLoaded = false;

async function _saveFlavorOrderTargetsOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — targets saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { flavorOrderTargets }, { merge: true });
  } catch (e) {
    console.error('Flavor order targets save error:', e);
    showStatusMessage('⚠ Could not save targets', 2500);
  }
}
const saveFlavorOrderTargets = _makeCoalescedSaver(_saveFlavorOrderTargetsOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});

async function _saveFlavorOrderLogOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — on-hand saved locally only', 3000); return; }
  try {
    await window._setDoc(window.getStoreFlavorOrderLogRef(todayStr()), { onHand: _flavorOrderLog, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Flavor order log save error:', e);
    showStatusMessage('⚠ Could not save on-hand values', 2500);
  }
}
const saveFlavorOrderLog = _makeCoalescedSaver(_saveFlavorOrderLogOnce);

async function loadFlavorOrderToday() {
  let logData = null;
  if (window._firebaseReady) {
    try {
      const snap = await window._getDoc(window.getStoreFlavorOrderLogRef(todayStr()));
      if (snap.exists()) logData = snap.data();
    } catch (e) {
      console.error('Flavor order log load error:', e);
    }
  }
  _flavorOrderLog = logData?.onHand || {};
  _flavorOrderLoaded = true;
  renderFlavorOrderSection();
}

function _flavorOrderQty(name) {
  return Math.max(0, (flavorOrderTargets[name] || 0) - (_flavorOrderLog[name] || 0));
}

function renderFlavorOrderSection() {
  const container = document.getElementById('flavorOrderSection');
  if (!container) return;
  if (!_flavorOrderLoaded) {
    loadFlavorOrderToday(); // async — re-renders once loaded
    return;
  }
  container.innerHTML = '';

  const section = _settingsSection('Flavor Order');
  const note = document.createElement('div');
  note.className = 'settings-note';
  note.style.marginBottom = '10px';
  note.textContent = "Flavoring & supply items ordered from Handel's corporate office — separate from the Ice Cream Run tab's flavors, even where names match.";
  section.appendChild(note);

  FLAVOR_ORDER_ITEMS.forEach(name => {
    const row = document.createElement('div');
    row.className = 'settings-card';
    row.style.cssText += 'margin-bottom:6px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:13px;flex:1;min-width:200px;';
    nameEl.textContent = name;
    row.appendChild(nameEl);

    const targetField = _settingsInput('Target', flavorOrderTargets[name] || 0, 'number');
    targetField.wrap.style.width = '80px';
    targetField.input.onchange = () => {
      flavorOrderTargets[name] = Math.max(0, parseInt(targetField.input.value) || 0);
      saveFlavorOrderTargets();
      renderFlavorOrderSection();
    };
    row.appendChild(targetField.wrap);

    const onHandLabel = document.createElement('div');
    onHandLabel.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    const onHandCaption = document.createElement('span');
    onHandCaption.className = 'settings-label';
    onHandCaption.textContent = 'On Hand';
    const onHandWidget = _buildCambroOnHandWidget(_flavorOrderLog[name] || 0, (val) => {
      _flavorOrderLog[name] = val;
      saveFlavorOrderLog();
      renderFlavorOrderSection();
    });
    onHandLabel.append(onHandCaption, onHandWidget);
    row.appendChild(onHandLabel);

    const qty = _flavorOrderQty(name);
    const qtyEl = document.createElement('div');
    qtyEl.style.cssText = 'font-size:12px;min-width:80px;';
    qtyEl.innerHTML = qty > 0
      ? `<span style="color:#ff8080;font-weight:700;">Order ${_formatQty(qty)}</span>`
      : `<span style="color:#22a05a;font-weight:700;">Stocked</span>`;
    row.appendChild(qtyEl);

    section.appendChild(row);
  });

  const genBtn = document.createElement('button');
  genBtn.className = 'btn btn-green';
  genBtn.textContent = '📋 Produce Flavor Order Form';
  genBtn.style.marginTop = '10px';
  genBtn.onclick = () => printFlavorOrderForm();
  section.appendChild(genBtn);

  container.appendChild(section);
}

// Print output styled after Handel's actual paper form (Store Name/Location
// header, DESCRIPTION/QTY table, in the same row order as the PDF) so the
// printed page can be filled/emailed to supplies@handelsicecream.com the same
// way the paper form is today.
function printFlavorOrderForm() {
  const store = typeof findStoreById === 'function' ? findStoreById(window.getCurrentStoreId()) : null;
  const storeName = store?.label || '';
  const storeLocation = store?.region || '';
  const rows = FLAVOR_ORDER_ITEMS.map(name => {
    const qty = _flavorOrderQty(name);
    return `<tr><td>${name}</td><td style="text-align:center;">${qty > 0 ? _formatQty(qty) : ''}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Flavor Order</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #000; }
    h1 { font-size: 30px; margin: 0 0 10px; letter-spacing: 0.02em; }
    .meta { margin-bottom: 14px; font-size: 13px; line-height: 1.8; }
    .meta strong { display: inline-block; min-width: 110px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 4px 8px; }
    th { text-align: left; background: #000; color: #fff; text-transform: uppercase; font-size: 11px; }
    td:last-child, th:last-child { text-align: center; width: 80px; }
    tfoot td { font-weight: bold; }
    .footer-note { margin-top: 16px; font-size: 11px; color: #333; }
  </style></head><body>
  <h1>FLAVORS</h1>
  <div class="meta">
    <div><strong>Store Name:</strong> ${storeName}</div>
    <div><strong>Store Location:</strong> ${storeLocation}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Qty</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td><td></td></tr></tfoot>
  </table>
  <p class="footer-note">E-mail completed orders to: supplies@handelsicecream.com — no phone orders accepted.</p>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (w) { w.document.write(html); w.document.close(); }
  else { alert('Please allow pop-ups for this page to print.'); }
}
