// Manager Settings: store name/switcher, roster management entry, bulk flavor
// import (corporate-only), manager PIN, cabinet numbering default, data export,
// user/role management (CORPORATE_ADMIN only), theme preference.
// New page — data lives at store.settings (merged onto the existing store doc).

let _storeSettings = {}; // populated by applyData() in store-org.js: { theme, cabinetNumbersEnabled }
let flavorPrices = {}; // {flavorName: pricePerBatch} — per-store OVERRIDE, populated by applyData(); Current Inventory Value's ice-cream component
let _orgDefaultFlavorPrices = {}; // {flavorName: pricePerBatch} — corporate-wide baseline, populated by loadOrgMetadata() in store-org.js
let miscInventoryItems = []; // [{name, onHand, pricePerUnit}] — populated by applyData()
let _tempEquipSectionExpanded = false; // session-only UI state — "Freezer/Fridge Equipment" starts collapsed (2026-09-13)

// 2025 annual batch price list (Handel's corporate recipe-cost sheet),
// matched to MASTER_ROSTER's exact flavor names (js/roster.js — each carries
// an appended "(CODE)" the price sheet doesn't use, plus some wording
// differences: "Cheesecake with Oreo" -> "Cheesecake Made with Oreo®", etc.,
// resolved by hand against the sheet). 128 of MASTER_ROSTER's 155 flavors are
// on the sheet; the other 27 (Carrot Cake, the NSA/"No Sugar Added" line,
// Rocky Road, Taro, etc.) genuinely aren't priced there — they'll show the
// "no price set" warning on Current Inventory Value if ever made, same as
// any flavor a store adds later that corporate hasn't priced yet. One-time
// import via _importDefaultIceCreamPrices() below (Admin tab,
// CORPORATE_ADMIN-only) — writes to organizations/{orgId}.defaultFlavorPrices,
// which every store falls back to unless it's entered its own override.
const DEFAULT_ICE_CREAM_PRICES_2025 = {
  "Banana (BAN)": 23.70, "Banana Cream Pie (BCP)": 37.64, "Bananas Foster (BF)": 29.73,
  "Birthday Cake (BDAY)": 40.13, "Black Cherry (BC)": 34.22, "Black Raspberry (BR)": 28.55,
  "Black Raspberry Chunk (BRC)": 37.33, "Black Raspberry Sherbet (BRS)": 23.81, "Black Walnut (BW)": 27.54,
  "Blue Monster (BMON)": 38.12, "Blue Moon (BM)": 24.50, "Blue Moon Ice (BMI)": 12.20,
  "Blueberry Cheesecake Chunk (BBCHZ)": 43.69, "Blueberry Cobbler (BBCOB)": 36.95, "Brownie Dough (BD)": 30.76,
  "Buckeye (BE)": 41.04, "Butter Pecan (BP)": 37.75, "Butterscotch Ripple (BSR)": 25.67,
  "Cake Batter (CB)": 28.94, "Caramel Apple (CAP)": 28.14, "Caramel Latte (CL)": 47.22,
  "Caramel Pretzel Crunch (CPC)": 51.13, "Cheesecake Made with Oreo® (OREOCHZ)": 39.25,
  "Cherry Cordial (CORD)": 39.59, "Cherry Magnolia (CMAG)": 45.21, "Cherry Vanilla (CV)": 40.95,
  "Chocoholic Chunk (CK)": 35.58, "Chocoholic Peanut Butter Ripple (CKPBR)": 37.48, "Chocolate (C)": 23.90,
  "Chocolate Almond (CA)": 34.67, "Chocolate Almond Milk Ice Cream (CAMILK)": 44.10,
  "Chocolate Cake Batter (CCB)": 33.11, "Chocolate Chip (CHOC CHIP)": 29.10,
  "Chocolate Chip Cookie Dough (CD)": 33.10, "Chocolate Malt with Caramel (CMC)": 28.31,
  "Chocolate Marshmallow (CM)": 27.40, "Chocolate Orange (CO)": 26.90,
  "Chocolate Peanut Butter Brownie (CPBB)": 41.28, "Chocolate Pecan (CP)": 38.22,
  "Chocolate Raspberry Truffle (CRT)": 49.49, "Chocolate Made with Oreo® (CHOC OREO)": 30.81,
  "Cinnamon Graham Cracker (CGC)": 32.61, "Cinnamon Roll (CR)": 32.96,
  "Coconut Almond Fudge Ripple (CAFR)": 43.19, "Coconut Caramel Delight (CCD)": 52.23,
  "Coconut Milk Ice Cream (COMILK)": 37.89, "Coconut Pineapple (CPINE)": 29.70, "Coffee (COF)": 30.43,
  "Coffee Chocolate Chip (CCC)": 37.53, "Coffee with Heath (COF w/ H)": 42.68,
  "Confetti Brownie Batter (CBB)": 46.11, "Cotton Candy (CC)": 31.07, "Deep Dish Apple Pie (DDAP)": 36.07,
  "Dulce De Leche (DULCE)": 41.19, "Elvis (ELVIS)": 32.78, "French Silk Pie (FSP)": 38.23,
  "Fudge Ripple (FR)": 28.78, "Fudge Ripple Brownie (FRB)": 37.16, "Graham Canyon (GC)": 38.20,
  "Graham Central Station (GCS)": 38.71, "Grape (G)": 23.42, "Green Tea (GT)": 27.28,
  "Heavenly Hash (HH)": 42.87, "Horchata (HOR)": 48.89, "Key Lime Pie (KLP)": 30.80,
  "Lemon Bar (LB)": 32.81, "Lemon Ice (LEM ICE)": 21.18, "Lemon Meringue Pie (LMP)": 38.73,
  "Lime Sherbet (LS)": 17.34, "Mango Sorbet (MANGO SOR)": 42.02, "Meri's Joy (MJ)": 44.40,
  "Midnight Madness (MM)": 47.53, "Mint Chocolate Chip (MCC)": 28.35, "Mint Made with Oreo® (MO)": 29.88,
  "Mixed Berry Sorbet (MB SOR)": 42.29, "Mocha Almond Fudge Ripple (MAFR)": 48.13,
  "Monkey Business (MB)": 43.64, "Mud Pie (MP)": 37.71, "Orange Dream Cream (ODC)": 18.11,
  "Orange Pineapple (OP)": 34.16, "Orange Sherbet (OS)": 16.05, "Peach (PEACH)": 42.39,
  "Peanut Butter (PB)": 28.90, "Peanut Butter and Jelly (PBJ)": 38.99, "Peanut Butter Parfait (PBP)": 34.68,
  "Peppermint Bark (PBARK)": 35.06, "Peppermint Stick (PS)": 28.60, "Pineapple Sherbet (PINE SH)": 14.88,
  "Pineapple Upside Down Cake (PUDC)": 52.81, "Pink Champagne Sherbet (PC)": 21.12, "Pistachio (PIST)": 45.69,
  "Pomegranate Sorbet (POM SOR)": 45.07, "Praline Pecan (PP)": 39.29, "Pumpkin Cheesecake Chunk (PCHZ)": 37.70,
  "Pumpkin Pecan (PPEC)": 42.49, "Pumpkin Pie (PPIE)": 34.27, "Pumpkin Ripple (PR)": 34.09,
  "Raspberry Cheesecake Chunk (RCHZ)": 49.50, "Red Raspberry Sherbet (RS)": 33.12,
  "Rocky Mocha Blast (RMB)": 40.55, "Salty Caramel Truffle (SCT)": 45.08, "S'Mores (S'M)": 36.80,
  "Snappy Turtle (ST)": 43.24, "Snickerdoodle (SD)": 32.59, "Snix (SNIX)": 42.17,
  "Sour Green Apple Ice (SGA ICE)": 12.66, "Spouse Like A House (SLAH)": 46.19, "Strawberry (STRAW)": 26.48,
  "Strawberry Cheesecake Chunk (SCHZ)": 41.50, "Strawberry Sorbet (STRAW SOR)": 42.29,
  "Tiger Stripes (TS)": 26.22, "Tin Lizzy (TL)": 36.92, "Toasted Almond (TA)": 31.65,
  "Twixter (TWIX)": 44.75, "Vanilla (VAN)": 22.60, "Vanilla Caramel Brownie (VCB)": 35.40,
  "Vanilla Caramel Truffle (VCT)": 35.81, "Vanilla Pineapple Sorbet (VP SOR)": 46.35,
  "Vanilla Raspberry Chip (VRC)": 41.27, "Vanilla Turtle (VT)": 41.34,
  "Vanilla Made with Oreo® (OREO)": 28.91, "Watermelon Ice (WM ICE)": 11.57,
  // Judgment-call matches confirmed with the user 2026-09-13 (wording differs
  // from the roster but is the same flavor):
  "Egg Nog (EGG)": 30.78,                                    // sheet: "Eggnog"
  "Coconut Cream Pie (CCP)": 41.06,                           // sheet: "Coconut Crème Pie"
  "Choc. Chocolate Chip Cheesecake Chunk (CCCHZ)": 43.49,     // sheet: "Chocolate, Chocolate Chip Cheesecake Chunk"
  "Chocolate Ooohh...Dough! (CHOC OD)": 34.53,                // sheet: "Chocolate Oree Dough"
  "Ooohh...Dough! (OD)": 31.86,                               // sheet: "Oree-Dough"
  "New York Style Cheesecake (NYC)": 42.78,                   // sheet: "New York Cheesecake Chunk"
};

async function _importDefaultIceCreamPrices() {
  const n = Object.keys(DEFAULT_ICE_CREAM_PRICES_2025).length;
  if (!confirm(`This sets the corporate-wide default price for ${n} flavors, used by every store that hasn't entered its own override. Continue?`)) return;
  try {
    await window._setDoc(window.getOrgDocRef(), { defaultFlavorPrices: DEFAULT_ICE_CREAM_PRICES_2025 }, { merge: true });
    _orgDefaultFlavorPrices = DEFAULT_ICE_CREAM_PRICES_2025;
    showStatusMessage(`✓ Imported ${n} corporate default prices`, 2500);
    renderSettingsPage();
  } catch (e) {
    console.error('Default price import error:', e);
    showStatusMessage('⚠ Could not import — check your connection', 3000);
  }
}

// A flavor's price is its store-level override if one has been entered, else
// the org-wide default (see organizations/{orgId}.defaultFlavorPrices), else
// unknown. Batch and bucket are the same unit here — "price per batch" is
// just the name the paper price sheet uses.
function _hasFlavorPrice(name) {
  return Object.prototype.hasOwnProperty.call(flavorPrices, name) || Object.prototype.hasOwnProperty.call(_orgDefaultFlavorPrices, name);
}
function _effectiveFlavorPrice(name) {
  if (Object.prototype.hasOwnProperty.call(flavorPrices, name)) return flavorPrices[name];
  if (Object.prototype.hasOwnProperty.call(_orgDefaultFlavorPrices, name)) return _orgDefaultFlavorPrices[name];
  return 0;
}

// Settings is now a bottom-tab panel rather than a popup overlay — kept as a
// wrapper since internal call sites (e.g. the roster-management button below)
// use it to get back to the Run tab.
function closeSettings() {
  switchTab('Run');
}

// See _makeCoalescedSaver() (appHelpers.js) — same store-doc write race as
// saveAll()/saveNoveltiesCatalog()/saveInventoryCatalog(), just lower-odds here
// since settings changes are one tap at a time rather than rapid-fire.
async function _saveStoreSettingsOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — settings saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { settings: _storeSettings }, { merge: true });
    showStatusMessage('✓ Settings saved', 1800);
  } catch (e) {
    console.error('Settings save error:', e);
    showStatusMessage('⚠ Could not save settings', 2500);
  }
}
const _saveStoreSettingsCoalesced = _makeCoalescedSaver(_saveStoreSettingsOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});
async function saveStoreSettings(patch) {
  _storeSettings = { ..._storeSettings, ...patch };
  await _saveStoreSettingsCoalesced();
}

// ── Current Inventory Value (Admin tab) ─────────────────────────────────────
// Combines three sources into one figure — deliberately excludes Flavor Order
// (js/flavor-order.js), which has no per-item pricing (its source PDF carries
// none, and per-item pricing wasn't wanted for it).
async function _saveFlavorPricesOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — prices saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { flavorPrices }, { merge: true });
  } catch (e) {
    console.error('Flavor prices save error:', e);
    showStatusMessage('⚠ Could not save prices', 2500);
  }
}
const saveFlavorPrices = _makeCoalescedSaver(_saveFlavorPricesOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});

async function _saveMiscInventoryItemsOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { miscInventoryItems }, { merge: true });
  } catch (e) {
    console.error('Misc inventory items save error:', e);
    showStatusMessage('⚠ Could not save', 2500);
  }
}
const saveMiscInventoryItems = _makeCoalescedSaver(_saveMiscInventoryItemsOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});

// Most recent 'run_completed' event's per-flavor made-buckets — storeEvents
// already carries this (js/production.js writeRunSummary()), so no extra
// Firestore read is needed. Returns null if no run has ever completed.
function _lastCompletedRunFlavors() {
  for (let i = _storeEvents.length - 1; i >= 0; i--) {
    if (_storeEvents[i].type === 'run_completed') return _storeEvents[i].flavors || {};
  }
  return null;
}

function _iceCreamInventoryValue() {
  const flavors = _lastCompletedRunFlavors();
  if (!flavors) return 0;
  return Object.entries(flavors).reduce((sum, [name, qty]) => sum + qty * _effectiveFlavorPrice(name), 0);
}

// Names of on-hand (last-run) flavors with no price anywhere — not on the
// org's default price sheet and not overridden at this store. Surfaced as a
// warning on Current Inventory Value rather than silently valuing them at $0.
function _unpricedOnHandFlavors() {
  const flavors = _lastCompletedRunFlavors();
  if (!flavors) return [];
  return Object.keys(flavors).filter(name => !_hasFlavorPrice(name));
}

function _miscInventoryValue() {
  return miscInventoryItems.reduce((sum, i) => sum + (i.onHand || 0) * (i.pricePerUnit || 0), 0);
}

function _orderListInventoryValue() {
  return inventoryCatalog.reduce((sum, item) => {
    const entry = _inventoryLog.find(e => e.name === item.name);
    return sum + (entry?.onHand || 0) * (item.pricePerUnit || 0);
  }, 0);
}

function _settingsSection(title) {
  const wrap = document.createElement('div');
  wrap.className = 'settings-section';
  const h = document.createElement('div');
  h.className = 'settings-heading';
  h.textContent = title;
  wrap.appendChild(h);
  return wrap;
}

// Builds a labeled input row. Returns { wrap, input }.
function _settingsInput(label, value, type = 'text') {
  const wrap = document.createElement('div');
  wrap.className = 'settings-row';
  const lbl = document.createElement('span');
  lbl.className = 'settings-label';
  lbl.textContent = label;
  const input = document.createElement('input');
  input.className = 'settings-input';
  input.type = type;
  input.value = value;
  wrap.append(lbl, input);
  return { wrap, input };
}

function renderSettingsPage() {
  const content = document.getElementById('settingsContent');
  if (!content) return;
  content.innerHTML = '';

  // Current Inventory Value itself now lives on the Manager Dashboard
  // (js/dashboard.js showManagerDashboard()), not here — this tab still owns
  // the inputs that feed it (Ice Cream Pricing below, Misc Items, and the
  // Order tab's own catalog).

  // ── Ice Cream Pricing (renamed from "Flavor Pricing" 2026-09-13) ─────────
  // Scoped to whichever flavors actually appear in the last completed run —
  // the ON-HAND flavors, not the full roster (which can run to 60+ names).
  // Each price defaults to the org-wide sheet (organizations/{orgId}.
  // defaultFlavorPrices, corporate-maintained) unless this store has entered
  // its own override — see _effectiveFlavorPrice() above.
  const pricingSection = _settingsSection('Ice Cream Pricing (Last Completed Run)');
  const lastRunFlavors = _lastCompletedRunFlavors();
  if (!lastRunFlavors || !Object.keys(lastRunFlavors).length) {
    const note = document.createElement('div');
    note.className = 'settings-note';
    note.textContent = 'No completed run on record yet — nothing to price.';
    pricingSection.appendChild(note);
  } else {
    const unpriced = _unpricedOnHandFlavors();
    if (unpriced.length) {
      const warn = document.createElement('div');
      warn.style.cssText = 'padding:8px 12px;border-radius:8px;background:rgba(240,165,0,0.12);border:1px solid #f0a500;color:#f0a500;font-size:12px;margin-bottom:10px;';
      warn.textContent = `⚠ No price on the corporate sheet or this store for: ${unpriced.join(', ')} — these are valued at $0 until priced below.`;
      pricingSection.appendChild(warn);
    }
    Object.keys(lastRunFlavors).sort().forEach(name => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--panel-border);flex-wrap:wrap;';
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'flex:1;min-width:140px;font-size:13px;';
      nameEl.textContent = `${name} (${lastRunFlavors[name]} made)`;
      const priceField = _settingsInput('Price / Batch', _effectiveFlavorPrice(name), 'number');
      priceField.wrap.style.width = '100px';
      if (!Object.prototype.hasOwnProperty.call(flavorPrices, name) && Object.prototype.hasOwnProperty.call(_orgDefaultFlavorPrices, name)) {
        priceField.input.title = 'Corporate default — edit to override for this store only';
        priceField.input.style.color = 'var(--text-muted)';
      }
      priceField.input.onchange = () => {
        flavorPrices[name] = Math.max(0, parseFloat(priceField.input.value) || 0);
        saveFlavorPrices();
        renderSettingsPage();
      };
      row.append(nameEl, priceField.wrap);
      pricingSection.appendChild(row);
    });
  }
  content.appendChild(pricingSection);

  // ── Corporate Default Ice Cream Pricing (CORPORATE_ADMIN only) ───────────
  // One-time import of the 2025 batch price sheet into
  // organizations/{orgId}.defaultFlavorPrices — see DEFAULT_ICE_CREAM_PRICES_2025
  // above for the full flavor-matching notes. Every store falls back to these
  // unless it enters its own override in "Ice Cream Pricing" above.
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const importSection = _settingsSection('Corporate Default Ice Cream Pricing');
    const importNote = document.createElement('div');
    importNote.className = 'settings-note';
    importNote.style.marginBottom = '10px';
    const defaultCount = Object.keys(_orgDefaultFlavorPrices).length;
    importNote.textContent = defaultCount
      ? `${defaultCount} flavors currently have a corporate default price set.`
      : 'No corporate default prices set yet.';
    importSection.appendChild(importNote);
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-green';
    importBtn.textContent = `Import 2025 Batch Price List (${Object.keys(DEFAULT_ICE_CREAM_PRICES_2025).length} flavors)`;
    importBtn.onclick = () => _importDefaultIceCreamPrices();
    importSection.appendChild(importBtn);
    content.appendChild(importSection);
  }

  // ── Miscellaneous Inventory Items ────────────────────────────────────────
  // A simple flat list for anything not covered by the Order list, Ice Cream
  // Run, or Flavor Order — On Hand is tracked directly on each item (no dated
  // log/history the way Order/Temps have one) since this list is meant to be
  // low-maintenance.
  const miscSection = _settingsSection('Miscellaneous Inventory Items');
  const miscAddRow = document.createElement('div');
  miscAddRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;';
  const miscNameInput = document.createElement('input');
  miscNameInput.className = 'settings-input';
  miscNameInput.placeholder = 'Name';
  miscNameInput.style.flex = '2';
  miscNameInput.style.minWidth = '140px';
  const miscOnHandInput = document.createElement('input');
  miscOnHandInput.type = 'number';
  miscOnHandInput.className = 'settings-input';
  miscOnHandInput.placeholder = 'On Hand';
  miscOnHandInput.style.width = '90px';
  const miscPriceInput = document.createElement('input');
  miscPriceInput.type = 'number';
  miscPriceInput.className = 'settings-input';
  miscPriceInput.placeholder = 'Price/Unit';
  miscPriceInput.style.width = '90px';
  const miscAddBtn = document.createElement('button');
  miscAddBtn.className = 'btn btn-green';
  miscAddBtn.textContent = '+ Add';
  miscAddBtn.onclick = () => {
    const name = miscNameInput.value.trim();
    if (!name) { miscNameInput.focus(); return; }
    miscInventoryItems.push({
      name,
      onHand: parseFloat(miscOnHandInput.value) || 0,
      pricePerUnit: parseFloat(miscPriceInput.value) || 0,
    });
    saveMiscInventoryItems();
    renderSettingsPage();
  };
  miscAddRow.append(miscNameInput, miscOnHandInput, miscPriceInput, miscAddBtn);
  miscSection.appendChild(miscAddRow);

  if (!miscInventoryItems.length) {
    const note = document.createElement('div');
    note.className = 'settings-note';
    note.textContent = 'Nothing here yet — add anything not already covered by the Order list, Ice Cream Run, or Flavor Order.';
    miscSection.appendChild(note);
  } else {
    miscInventoryItems.forEach((item, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--panel-border);flex-wrap:wrap;';
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'flex:1;min-width:120px;font-size:13px;font-weight:700;';
      nameEl.textContent = item.name;
      const onHandField = _settingsInput('On Hand', item.onHand, 'number');
      onHandField.wrap.style.width = '90px';
      onHandField.input.onchange = () => {
        item.onHand = Math.max(0, parseFloat(onHandField.input.value) || 0);
        saveMiscInventoryItems();
        renderSettingsPage();
      };
      const priceField = _settingsInput('Price/Unit', item.pricePerUnit, 'number');
      priceField.wrap.style.width = '90px';
      priceField.input.onchange = () => {
        item.pricePerUnit = Math.max(0, parseFloat(priceField.input.value) || 0);
        saveMiscInventoryItems();
        renderSettingsPage();
      };
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '🗑';
      removeBtn.title = 'Remove item';
      removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:4px 6px;';
      removeBtn.onclick = () => {
        miscInventoryItems = miscInventoryItems.filter((_, i) => i !== idx);
        saveMiscInventoryItems();
        renderSettingsPage();
      };
      row.append(nameEl, onHandField.wrap, priceField.wrap, removeBtn);
      miscSection.appendChild(row);
    });
  }
  content.appendChild(miscSection);

  // ── Order Tab Setup ───────────────────────────────────────────────────────
  // Moved from the Order tab (js/inventory.js) 2026-09-13 — that tab is now
  // daily-use only (view the list, enter On Hand, produce the order); catalog
  // setup (importing/adding items) lives here instead.
  if (typeof _renderOrderCsvImportSection === 'function') _renderOrderCsvImportSection(content);
  if (typeof _renderAddSupplyItemSection === 'function') _renderAddSupplyItemSection(content);

  // ── Store Name ───────────────────────────────────────────────────────────
  // Same email can be assigned to multiple stores (or, for CORPORATE_ADMIN, every
  // store in the org) — window.getOrgStores() is already scoped accordingly.
  // One store: just displays its name. Multiple: becomes a picker — selecting
  // a different store reloads everything (selectStore() already handles this).
  const nameSection = _settingsSection('Store Name');
  const accessibleStores = window.getOrgStores();
  const currentId = window.getCurrentStoreId();
  const currentStore = accessibleStores.find(s => s.id === currentId);
  const currentLabel = currentId ? _storeDisplayLabel(currentId, currentStore?.label) : 'No store selected';

  if (accessibleStores.length > 1) {
    const picker = document.createElement('select');
    picker.className = 'settings-input';
    picker.style.width = 'auto';
    accessibleStores.forEach(store => {
      const opt = document.createElement('option');
      opt.value = store.id;
      opt.textContent = _storeLabelFor(store);
      if (store.id === currentId) opt.selected = true;
      picker.appendChild(opt);
    });
    picker.onchange = () => selectStore(picker.value);
    nameSection.appendChild(picker);
  } else {
    const nameDisplay = document.createElement('div');
    nameDisplay.style.cssText = 'font-size:18px;font-weight:700;color:var(--text-primary);';
    nameDisplay.textContent = currentLabel;
    nameSection.appendChild(nameDisplay);
  }
  content.appendChild(nameSection);

  // ── Flavor Roster ─────────────────────────────────────────────────────────
  const rosterSection = _settingsSection('Flavor Roster');
  const rosterInfo = document.createElement('div');
  rosterInfo.id = 'settingsRosterInfo';
  rosterInfo.className = 'settings-note';
  rosterInfo.style.marginBottom = '10px';
  rosterInfo.textContent = `${roster.length} flavors in roster · ${activeFlavors.length} active today`;
  rosterSection.appendChild(rosterInfo);

  const rosterBtnRow = document.createElement('div');
  rosterBtnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
  const manageBtn = document.createElement('button');
  manageBtn.className = 'btn';
  manageBtn.textContent = '☰ Manage Flavor Roster';
  manageBtn.onclick = () => { closeSettings(); openAddModal(); };
  rosterBtnRow.appendChild(manageBtn);
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const bulkBtn = document.createElement('button');
    bulkBtn.className = 'btn';
    bulkBtn.textContent = '⇪ Bulk Import Flavors';
    bulkBtn.onclick = () => openBulkImport();
    rosterBtnRow.appendChild(bulkBtn);
    const masterBtn = document.createElement('button');
    masterBtn.className = 'btn';
    masterBtn.textContent = '✏️ Edit Master Flavor List';
    masterBtn.onclick = () => _toggleMasterFlavorPanel();
    rosterBtnRow.appendChild(masterBtn);
  }
  rosterSection.appendChild(rosterBtnRow);

  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const bulkPanel = document.createElement('div');
    bulkPanel.id = 'bulkImportPanel';
    bulkPanel.style.cssText = 'display:none;margin-top:10px;';
    rosterSection.appendChild(bulkPanel);

    const masterPanel = document.createElement('div');
    masterPanel.id = 'masterFlavorPanel';
    masterPanel.style.cssText = 'display:none;margin-top:10px;';
    rosterSection.appendChild(masterPanel);
  }
  content.appendChild(rosterSection);

  // ── Manager PIN (not relevant to CORPORATE_ADMIN — they bypass it entirely) ─
  if (!userHasRole(ROLES.CORPORATE_ADMIN)) {
    const pinSection = _settingsSection('Manager PIN');
    const pinNote = document.createElement('div');
    pinNote.className = 'settings-note';
    pinNote.style.marginBottom = '10px';
    pinNote.textContent = 'Shared across every device signed into this store.';
    pinSection.appendChild(pinNote);
    const changePinBtn = document.createElement('button');
    changePinBtn.className = 'btn';
    changePinBtn.textContent = '🔒 Change Manager PIN';
    changePinBtn.onclick = () => openPinModal('set', () => {});
    pinSection.appendChild(changePinBtn);
    content.appendChild(pinSection);
  }

  // ── Cabinet Numbering ─────────────────────────────────────────────────────
  const cabinetSection = _settingsSection('Cabinet Numbering');
  const cabinetNote = document.createElement('div');
  cabinetNote.className = 'settings-note';
  cabinetNote.style.marginBottom = '10px';
  cabinetNote.textContent = 'Store-wide default — applies to every device at this store, not just this one.';
  cabinetSection.appendChild(cabinetNote);
  const cabinetBtn = document.createElement('button');
  cabinetBtn.className = 'btn';
  cabinetBtn.textContent = _cabinetSortEnabled ? '✕ Turn Off Cabinet Numbers' : '✚ Turn On Cabinet Numbers';
  cabinetBtn.onclick = () => { toggleCabinetNumbers(); renderSettingsPage(); };
  cabinetSection.appendChild(cabinetBtn);
  content.appendChild(cabinetSection);

  // ── Export Data ───────────────────────────────────────────────────────────
  const exportSection = _settingsSection('Export Data');
  const exportNote = document.createElement('div');
  exportNote.className = 'settings-note';
  exportNote.style.marginBottom = '10px';
  exportNote.textContent = "Download this store's recorded history as CSV files.";
  exportSection.appendChild(exportNote);

  const exportBtnRow = document.createElement('div');
  exportBtnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';
  const runsBtn = document.createElement('button');
  runsBtn.className = 'btn';
  runsBtn.textContent = '⬇ Export Runs (CSV)';
  runsBtn.onclick = () => exportRunsCsv();
  const noveltiesBtn = document.createElement('button');
  noveltiesBtn.className = 'btn';
  noveltiesBtn.textContent = '⬇ Export Novelties (CSV)';
  noveltiesBtn.onclick = () => exportNoveltiesCsv();
  const inventoryBtn = document.createElement('button');
  inventoryBtn.className = 'btn';
  inventoryBtn.textContent = '⬇ Export Inventory (CSV)';
  inventoryBtn.onclick = () => exportInventoryCsv();
  exportBtnRow.append(runsBtn, noveltiesBtn, inventoryBtn);
  exportSection.appendChild(exportBtnRow);

  const monthLabel = document.createElement('div');
  monthLabel.className = 'settings-label';
  monthLabel.style.marginBottom = '4px';
  monthLabel.textContent = 'Batches Made per Flavor, by Month';
  exportSection.appendChild(monthLabel);
  const monthRow = document.createElement('div');
  monthRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  const monthInput = document.createElement('input');
  monthInput.type = 'month';
  monthInput.className = 'settings-input';
  monthInput.style.width = 'auto';
  monthInput.value = todayStr().slice(0, 7);
  const monthBtn = document.createElement('button');
  monthBtn.className = 'btn btn-green';
  monthBtn.textContent = '⬇ Download Report';
  monthBtn.onclick = () => exportMonthlyBatchReport(monthInput.value);
  monthRow.append(monthInput, monthBtn);
  exportSection.appendChild(monthRow);
  content.appendChild(exportSection);

  // ── Last 30 Days by Flavor ────────────────────────────────────────────────
  const last30Section = _settingsSection('Last 30 Days by Flavor');
  const last30Note = document.createElement('div');
  last30Note.className = 'settings-note';
  last30Note.style.marginBottom = '10px';
  last30Note.textContent = 'Every active flavor, most buckets made first (includes flavors with none, so you can see what\'s not moving).';
  last30Section.appendChild(last30Note);
  const last30Btn = document.createElement('button');
  last30Btn.className = 'btn';
  last30Btn.textContent = '📊 Show Last 30 Days';
  const last30Results = document.createElement('div');
  last30Results.style.marginTop = '10px';
  last30Btn.onclick = () => _renderLast30DaysReport(last30Results);
  last30Section.append(last30Btn, last30Results);
  content.appendChild(last30Section);

  // ── Tear Down Log ─────────────────────────────────────────────────────────
  const tearDownSection = _settingsSection('Tear Down Log');
  const tearDownNote = document.createElement('div');
  tearDownNote.className = 'settings-note';
  tearDownNote.style.marginBottom = '10px';
  tearDownNote.textContent = 'Recall a past day\'s tear-down / sanitizing answers.';
  tearDownSection.appendChild(tearDownNote);
  const tearDownRow = document.createElement('div');
  tearDownRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  const tearDownDateInput = document.createElement('input');
  tearDownDateInput.type = 'date';
  tearDownDateInput.className = 'settings-input';
  tearDownDateInput.style.width = 'auto';
  tearDownDateInput.value = todayStr();
  const tearDownViewBtn = document.createElement('button');
  tearDownViewBtn.className = 'btn';
  tearDownViewBtn.textContent = 'View';
  const tearDownResults = document.createElement('div');
  tearDownResults.style.marginTop = '10px';
  tearDownViewBtn.onclick = () => _renderTearDownLogView(tearDownDateInput.value, tearDownResults);
  tearDownRow.append(tearDownDateInput, tearDownViewBtn);
  tearDownSection.append(tearDownRow, tearDownResults);
  content.appendChild(tearDownSection);

  // ── Freezer/Fridge Equipment ─────────────────────────────────────────────
  // Adding new equipment (js/temps.js _buildTempEquipmentManager()) moved
  // here from the Temps tab 2026-09-13 — that tab is now view + daily entry
  // only. Editing Location/Target Temp of existing equipment already lived
  // here. Collapsed behind a toggle by default (2026-09-13) to keep this
  // page from growing too long — most visits don't need it.
  const tempEquipSection = _settingsSection('Freezer/Fridge Equipment');
  const tempEquipToggle = document.createElement('button');
  tempEquipToggle.className = 'btn';
  tempEquipToggle.style.cssText = 'font-size:12px;padding:6px 10px;';
  tempEquipToggle.textContent = _tempEquipSectionExpanded ? '▾ Hide' : `▸ Manage (${tempEquipment.length})`;
  tempEquipToggle.onclick = () => {
    _tempEquipSectionExpanded = !_tempEquipSectionExpanded;
    renderSettingsPage();
  };
  tempEquipSection.appendChild(tempEquipToggle);

  if (_tempEquipSectionExpanded) {
    const tempEquipBody = document.createElement('div');
    tempEquipBody.style.marginTop = '10px';
    _buildTempEquipmentManager(tempEquipBody);
    if (!tempEquipment.length) {
      const equipNote = document.createElement('div');
      equipNote.className = 'settings-note';
      equipNote.textContent = 'No equipment set up yet — add one above.';
      tempEquipBody.appendChild(equipNote);
    } else {
      tempEquipment.forEach(eq => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--panel-border);flex-wrap:wrap;';
        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'flex:1;min-width:120px;font-size:13px;font-weight:700;';
        nameEl.textContent = eq.label;
        const locationField = _settingsInput('Location', eq.location || '', 'text');
        locationField.wrap.style.width = '140px';
        locationField.input.onchange = () => {
          eq.location = locationField.input.value.trim();
          saveTempEquipment();
        };
        const targetField = _settingsInput('Target °F', eq.targetTemp, 'number');
        targetField.wrap.style.width = '100px';
        targetField.input.onchange = () => {
          eq.targetTemp = parseFloat(targetField.input.value) || 0;
          saveTempEquipment();
        };
        row.append(nameEl, locationField.wrap, targetField.wrap);
        tempEquipBody.appendChild(row);
      });
    }
    tempEquipSection.appendChild(tempEquipBody);
  }
  content.appendChild(tempEquipSection);

  // ── Freezer/Fridge Temp Log ────────────────────────────────────────────────
  const tempsSection = _settingsSection('Freezer/Fridge Temp Log');
  const tempsNote = document.createElement('div');
  tempsNote.className = 'settings-note';
  tempsNote.style.marginBottom = '10px';
  tempsNote.textContent = 'Recall a past day\'s temperature readings.';
  tempsSection.appendChild(tempsNote);
  const tempsRow = document.createElement('div');
  tempsRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  const tempsDateInput = document.createElement('input');
  tempsDateInput.type = 'date';
  tempsDateInput.className = 'settings-input';
  tempsDateInput.style.width = 'auto';
  tempsDateInput.value = todayStr();
  const tempsViewBtn = document.createElement('button');
  tempsViewBtn.className = 'btn';
  tempsViewBtn.textContent = 'View';
  const tempsResults = document.createElement('div');
  tempsResults.style.marginTop = '10px';
  tempsViewBtn.onclick = () => _renderTempsLogView(tempsDateInput.value, tempsResults);
  tempsRow.append(tempsDateInput, tempsViewBtn);
  tempsSection.append(tempsRow, tempsResults);
  content.appendChild(tempsSection);

  // ── Create Store Owner Account (CORPORATE_ADMIN only) ────────────────────
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const createSection = _settingsSection('Create Store Owner Account');
    const createNote = document.createElement('div');
    createNote.className = 'settings-note';
    createNote.style.marginBottom = '10px';
    createNote.textContent = "Provisions a new login immediately, pre-assigned to whichever store(s) you pick below. There's no email invite — share the password shown after creating it with the store owner yourself; they can change it later via \"Forgot password?\" on the sign-in screen.";
    createSection.appendChild(createNote);
    _renderCreateAccountForm(createSection);
    content.appendChild(createSection);
  }

  // ── Users & Roles (CORPORATE_ADMIN only) ─────────────────────────────────
  if (userHasRole(ROLES.CORPORATE_ADMIN)) {
    const usersSection = _settingsSection('Users & Roles');
    const usersList = document.createElement('div');
    usersList.style.cssText = 'display:grid;gap:6px;';
    const loading = document.createElement('div');
    loading.className = 'settings-note';
    loading.textContent = 'Loading…';
    usersList.appendChild(loading);
    usersSection.appendChild(usersList);
    content.appendChild(usersSection);
    _loadMembersIntoSettings(usersList);
  }

  // ── App Preferences ───────────────────────────────────────────────────────
  const prefSection = _settingsSection('App Preferences');
  const themeRow = document.createElement('div');
  themeRow.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
  const themeLabel = document.createElement('span');
  themeLabel.className = 'settings-label';
  themeLabel.textContent = 'Theme:';
  const themeSelect = document.createElement('select');
  themeSelect.className = 'settings-input';
  themeSelect.style.width = 'auto';
  ['dark', 'light'].forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v === 'dark' ? 'Dark' : 'Light';
    if ((_storeSettings.theme || 'dark') === v) opt.selected = true;
    themeSelect.appendChild(opt);
  });
  themeSelect.onchange = () => {
    saveStoreSettings({ theme: themeSelect.value });
    _applyNewPagesTheme(themeSelect.value);
  };
  themeRow.append(themeLabel, themeSelect);
  prefSection.appendChild(themeRow);
  const themeNote = document.createElement('div');
  themeNote.className = 'settings-note';
  themeNote.textContent = 'Applies to Settings, Novelties, and Inventory pages only — production and dashboard screens stay dark for now.';
  prefSection.appendChild(themeNote);
  content.appendChild(prefSection);

  _applyNewPagesTheme(_storeSettings.theme || 'dark');
}

// Toggles the light/dark CSS-variable scope on the new-page tab panels only
// (see .tab-panel.theme-light in index.html) — the rest of the app is unaffected.
function _applyNewPagesTheme(theme) {
  ['tabPanelSettings', 'tabPanelNovelties', 'tabPanelInventory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('theme-light', theme === 'light');
  });
}

// No ambiguous-looking characters (0/O, 1/l/I) — this gets read aloud or
// retyped by whoever's relaying it to the new store owner.
function _generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// Creates a brand-new Firebase Auth account + member doc, pre-assigned to the
// given role/stores, without touching the corporate admin's own signed-in
// session — see the secondary Firebase App set up in index.html for why a
// plain createUserWithEmailAndPassword() against the primary auth instance
// would otherwise sign the admin out and into the new account instead.
async function createStoreOwnerAccount(email, password, role, storeIds) {
  if (!window._secondaryAuth) throw new Error('Account creation is unavailable right now — try reloading the app.');
  const cred = await window._createUserWithEmailAndPassword(window._secondaryAuth, email, password);
  const newUid = cred.user.uid;
  try { await window._signOut(window._secondaryAuth); } catch (e) { /* secondary session, never reused — not critical */ }
  await window._setDoc(window.getOrgMemberRef(newUid), {
    uid: newUid, email, role, stores: storeIds, createdAt: Date.now()
  });
  await window.logOrgEvent('store_owner_account_created', { email, role, stores: storeIds });
  return newUid;
}

function _renderCreateAccountForm(container) {
  const formFields = document.createElement('div');
  formFields.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'settings-input';
  emailInput.placeholder = 'Store owner email';
  formFields.appendChild(emailInput);

  const pwRow = document.createElement('div');
  pwRow.style.cssText = 'display:flex;gap:6px;';
  const pwInput = document.createElement('input');
  pwInput.type = 'text';
  pwInput.className = 'settings-input';
  pwInput.placeholder = 'Temporary password';
  pwInput.value = _generateTempPassword();
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'btn';
  genBtn.textContent = '↻ New';
  genBtn.style.cssText = 'flex-shrink:0;font-size:12px;padding:8px 10px;';
  genBtn.onclick = () => { pwInput.value = _generateTempPassword(); };
  pwRow.append(pwInput, genBtn);
  formFields.appendChild(pwRow);

  const roleSelect = document.createElement('select');
  roleSelect.className = 'settings-input';
  [ROLES.STORE_MANAGER, ROLES.CORPORATE_ADMIN].forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r === ROLES.CORPORATE_ADMIN ? 'Corporate Admin' : 'Store Manager';
    roleSelect.appendChild(opt);
  });
  formFields.appendChild(roleSelect);

  const storesLabel = document.createElement('div');
  storesLabel.className = 'settings-label';
  storesLabel.style.marginTop = '4px';
  storesLabel.textContent = 'Assign to store(s):';
  formFields.appendChild(storesLabel);

  const storesList = document.createElement('div');
  storesList.style.cssText = 'display:grid;gap:4px;max-height:180px;overflow-y:auto;';
  const storesLoading = document.createElement('div');
  storesLoading.className = 'settings-note';
  storesLoading.textContent = 'Loading stores…';
  storesList.appendChild(storesLoading);
  formFields.appendChild(storesList);

  const selectedStores = new Set();
  loadOrgStores().then(stores => {
    storesList.innerHTML = '';
    if (!stores.length) {
      const empty = document.createElement('div');
      empty.className = 'settings-note';
      empty.textContent = 'No stores yet — create one first.';
      storesList.appendChild(empty);
      return;
    }
    stores.forEach(store => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;cursor:pointer;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.onchange = () => { checkbox.checked ? selectedStores.add(store.id) : selectedStores.delete(store.id); };
      const text = document.createElement('span');
      text.textContent = _storeLabelFor(store);
      label.append(checkbox, text);
      storesList.appendChild(label);
    });
  });

  // Store selection is meaningless for Corporate Admin — that role bypasses
  // stores[] scoping entirely (see _scopedStores(), store-org.js) — so hide it
  // for that role, same as the existing member list below already does.
  const updateStoresVisibility = () => {
    const show = roleSelect.value !== ROLES.CORPORATE_ADMIN;
    storesLabel.style.display = show ? '' : 'none';
    storesList.style.display  = show ? '' : 'none';
  };
  roleSelect.onchange = updateStoresVisibility;
  updateStoresVisibility();

  const errEl = document.createElement('div');
  errEl.style.cssText = 'color:#d72627;font-size:12px;min-height:16px;';
  formFields.appendChild(errEl);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-green';
  submitBtn.textContent = '+ Create Account';
  formFields.appendChild(submitBtn);

  const resultEl = document.createElement('div');
  resultEl.style.display = 'none';

  submitBtn.onclick = async () => {
    const email    = emailInput.value.trim();
    const password = pwInput.value;
    errEl.textContent = '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter a valid email address.'; return; }
    if (!password || password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';
    try {
      const role   = roleSelect.value;
      const stores = role === ROLES.CORPORATE_ADMIN ? [] : [...selectedStores];
      await createStoreOwnerAccount(email, password, role, stores);

      formFields.style.display = 'none';
      resultEl.style.cssText = 'display:block;padding:10px 12px;border-radius:8px;background:rgba(34,160,90,0.12);border:1px solid #1e5c33;font-size:12px;';
      resultEl.innerHTML = `<div style="font-weight:700;color:#22a05a;margin-bottom:4px;">✓ Account created</div><div>Share these with the store owner — this won't be shown again:</div><div style="margin-top:6px;padding:8px;border-radius:6px;background:rgba(0,0,0,0.25);font-family:monospace;font-size:12px;word-break:break-all;">Email: ${email}<br>Password: ${password}</div>`;
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn';
      doneBtn.style.cssText = 'margin-top:8px;font-size:12px;padding:6px 12px;';
      doneBtn.textContent = "Done — I've saved this";
      doneBtn.onclick = () => renderSettingsPage(); // refreshes Users & Roles below with the new account
      resultEl.appendChild(doneBtn);
    } catch (e) {
      console.error('Create account error:', e);
      if (e.code === 'auth/email-already-in-use') {
        errEl.textContent = 'An account already exists for that email — use the "Stores" button next to it below to assign this store instead.';
      } else if (e.code === 'auth/weak-password') {
        errEl.textContent = 'That password is too weak — try a longer one.';
      } else if (e.code === 'auth/invalid-email') {
        errEl.textContent = 'That email address looks invalid.';
      } else {
        errEl.textContent = e.message || 'Could not create the account.';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '+ Create Account';
    }
  };

  container.append(formFields, resultEl);
}

async function _loadMembersIntoSettings(container) {
  if (!window._firebaseReady || !window._getDocs) {
    container.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'settings-note';
    msg.textContent = 'Offline — cannot load users right now.';
    container.appendChild(msg);
    return;
  }
  try {
    const snap = await window._getDocs(window.getOrgMembersCollectionRef());
    const members = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    container.innerHTML = '';
    if (!members.length) {
      const msg = document.createElement('div');
      msg.className = 'settings-note';
      msg.textContent = 'No users found.';
      container.appendChild(msg);
      return;
    }
    const currentUid = window._auth && window._auth.currentUser ? window._auth.currentUser.uid : null;
    members.forEach(m => {
      const wrap = document.createElement('div');
      wrap.style.marginBottom = '6px';

      const row = document.createElement('div');
      row.className = 'settings-card';
      row.style.cssText += 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';

      const info = document.createElement('div');
      info.style.cssText = 'font-size:12px;word-break:break-word;flex:1;min-width:0;';
      info.textContent = m.email || m.uid;
      row.appendChild(info);

      const controlsWrap = document.createElement('div');
      controlsWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

      const roleSelect = document.createElement('select');
      roleSelect.className = 'settings-input';
      roleSelect.style.cssText = 'width:auto;font-size:12px;padding:6px 8px;';
      [ROLES.STORE_MANAGER, ROLES.CORPORATE_ADMIN].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r === ROLES.CORPORATE_ADMIN ? 'Corporate Admin' : 'Store Manager';
        if (m.role === r) opt.selected = true;
        roleSelect.appendChild(opt);
      });
      const isSelf = currentUid && currentUid === m.uid;
      if (isSelf) {
        roleSelect.disabled = true;
        roleSelect.title = "You can't change your own role.";
      }

      // Store-tier accounts are scoped to members/{uid}.stores[] (see _scopedStores()
      // in store-org.js) — corporate accounts see every store regardless, so the
      // stores editor is only meaningful (and only shown) for STORE_MANAGER members.
      const storesBtn = document.createElement('button');
      storesBtn.className = 'btn';
      storesBtn.style.cssText = 'font-size:11px;padding:6px 10px;';
      storesBtn.textContent = `Stores (${(m.stores || []).length})`;
      storesBtn.style.display = m.role === ROLES.CORPORATE_ADMIN ? 'none' : '';

      roleSelect.onchange = async () => {
        try {
          await window._setDoc(window.getOrgMemberRef(m.uid), { role: roleSelect.value }, { merge: true });
          showStatusMessage(`✓ Role updated for ${m.email || m.uid}`, 2000);
          m.role = roleSelect.value;
          storesBtn.style.display = m.role === ROLES.CORPORATE_ADMIN ? 'none' : '';
          storesPanel.style.display = 'none';
        } catch (e) {
          console.error('Role update error:', e);
          showStatusMessage('⚠ Could not update role', 2500);
        }
      };

      // Deletes the member doc only — that's what actually controls access
      // within the app (role, stores[]). There's no client-side way to delete
      // someone else's underlying Firebase Auth login (only a user can delete
      // their own account) without a backend, so their email/password could
      // technically still authenticate — but with no member doc they hit the
      // "not assigned to any store" screen and can't do anything real, same
      // as any account whose store assignment hasn't been set up yet.
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn';
      deleteBtn.style.cssText = 'font-size:11px;padding:6px 10px;color:#ff8080;border-color:#d72627;';
      deleteBtn.textContent = '🗑 Delete';
      if (isSelf) {
        deleteBtn.disabled = true;
        deleteBtn.title = "You can't delete your own account while signed in as it.";
      }
      deleteBtn.onclick = async () => {
        // Guard against locking the org out of corporate features entirely —
        // self-service sign-up only ever creates STORE_MANAGER accounts, so
        // once there's zero Corporate Admins left, nobody could ever grant
        // that role to anyone again. Re-queries live instead of trusting the
        // `members` array this page loaded with: that snapshot goes stale the
        // moment ANOTHER admin session also has Settings open, and two admins
        // each independently seeing "someone else exists" could otherwise
        // both pass this check and delete each other at the same time.
        if (m.role === ROLES.CORPORATE_ADMIN) {
          try {
            const freshSnap = await window._getDocs(window.getOrgMembersCollectionRef());
            const anotherAdminExists = freshSnap.docs.some(d => d.id !== m.uid && d.data().role === ROLES.CORPORATE_ADMIN);
            if (!anotherAdminExists) {
              showStatusMessage("⚠ Can't remove the last Corporate Admin — assign another account first", 3500);
              return;
            }
          } catch (e) {
            console.error('Admin-count re-check failed:', e);
            showStatusMessage('⚠ Could not verify — check your connection and try again', 3000);
            return;
          }
        }
        const label = m.email || m.uid;
        if (!confirm(`Remove ${label}'s access to this organization? They won't be able to sign into any store or use corporate features anymore. This does not delete their login itself — just their access.`)) return;
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Removing…';
        try {
          await window._deleteDoc(window.getOrgMemberRef(m.uid));
          showStatusMessage(`✓ Removed ${label}`, 2000);
          wrap.remove();
          const idx = members.findIndex(x => x.uid === m.uid);
          if (idx >= 0) members.splice(idx, 1);
        } catch (e) {
          console.error('Member delete error:', e);
          showStatusMessage('⚠ Could not remove this account', 2500);
          deleteBtn.disabled = false;
          deleteBtn.textContent = '🗑 Delete';
        }
      };

      controlsWrap.append(roleSelect, storesBtn, deleteBtn);
      row.appendChild(controlsWrap);
      wrap.appendChild(row);

      const storesPanel = document.createElement('div');
      storesPanel.style.cssText = 'display:none;margin-top:6px;padding:10px;';
      storesPanel.classList.add('settings-card');
      wrap.appendChild(storesPanel);

      storesBtn.onclick = async () => {
        const willShow = storesPanel.style.display === 'none';
        storesPanel.style.display = willShow ? '' : 'none';
        if (willShow) await _renderMemberStoresEditor(storesPanel, m, storesBtn);
      };

      container.appendChild(wrap);
    });
  } catch (e) {
    console.error('Members load error:', e);
    container.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'settings-note';
    msg.textContent = 'Could not load users.';
    container.appendChild(msg);
  }
}

// Lets a corporate admin add/remove which store(s) a STORE_MANAGER-tier account
// can sign into — extends what account creation already does (a brand-new email
// signing in while a store is selected auto-scopes to that one store) to existing
// accounts needing a 2nd/3rd store added later.
async function _renderMemberStoresEditor(panel, member, storesBtn) {
  panel.innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'settings-note';
  loading.textContent = 'Loading stores…';
  panel.appendChild(loading);

  const allStores = await loadOrgStores(); // refresh — viewer is corporate, so this is the full org list
  panel.innerHTML = '';
  if (!allStores.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No stores in this org yet.';
    panel.appendChild(empty);
    return;
  }

  const assigned = new Set(member.stores || []);
  allStores.forEach(store => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 0;cursor:pointer;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = assigned.has(store.id);
    checkbox.onchange = async () => {
      if (checkbox.checked) assigned.add(store.id); else assigned.delete(store.id);
      const stores = [...assigned];
      try {
        await window._setDoc(window.getOrgMemberRef(member.uid), { stores }, { merge: true });
        member.stores = stores;
        storesBtn.textContent = `Stores (${stores.length})`;
        showStatusMessage(`✓ Store access updated for ${member.email || member.uid}`, 2000);
      } catch (e) {
        console.error('Member store update error:', e);
        showStatusMessage('⚠ Could not update store access', 2500);
        checkbox.checked = !checkbox.checked; // revert on failure
      }
    };
    const text = document.createElement('span');
    text.textContent = _storeLabelFor(store);
    label.append(checkbox, text);
    panel.appendChild(label);
  });
}

// ── Bulk Flavor Import ───────────────────────────────────────────────────────
// Paste "Name" or "Name, Type" (one per line) → preview against the existing
// roster (flagging duplicates) → commit via the same roster-add shape addNewToRoster() uses.
function openBulkImport() {
  const panel = document.getElementById('bulkImportPanel');
  if (!panel) return;
  const willShow = panel.style.display === 'none';
  panel.style.display = willShow ? '' : 'none';
  if (willShow && !panel.dataset.built) {
    _buildBulkImportPanel(panel);
    panel.dataset.built = '1';
  }
}

function _buildBulkImportPanel(panel) {
  panel.innerHTML = '';

  const hint = document.createElement('div');
  hint.className = 'settings-note';
  hint.style.marginBottom = '6px';
  hint.textContent = 'Paste one flavor per line — "Name" or "Name, Type" (Type: WO or TD).';
  panel.appendChild(hint);

  const textarea = document.createElement('textarea');
  textarea.className = 'settings-input';
  textarea.style.cssText = 'width:100%;min-height:110px;resize:vertical;font-family:monospace;';
  textarea.placeholder = 'Mint Chocolate Chip\nStrawberry Cheesecake, TD';
  panel.appendChild(textarea);

  const previewList = document.createElement('div');
  previewList.style.cssText = 'margin-top:8px;display:grid;gap:4px;max-height:160px;overflow-y:auto;';
  panel.appendChild(previewList);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
  const previewBtn = document.createElement('button');
  previewBtn.className = 'btn';
  previewBtn.textContent = 'Preview';
  const commitBtn = document.createElement('button');
  commitBtn.className = 'btn btn-green';
  commitBtn.style.display = 'none';
  btnRow.append(previewBtn, commitBtn);
  panel.appendChild(btnRow);

  let parsedNew = [];

  previewBtn.onclick = () => {
    const existingNames = new Set(roster.map(r => r.name.toLowerCase()));
    const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
    const seen = new Set();
    parsedNew = [];
    previewList.innerHTML = '';
    lines.forEach(line => {
      const [namePart, typePart] = line.split(',').map(s => s ? s.trim() : '');
      if (!namePart) return;
      const key = namePart.toLowerCase();
      const row = document.createElement('div');
      row.className = 'settings-card';
      row.style.cssText += 'font-size:12px;padding:6px 10px;';
      if (existingNames.has(key) || seen.has(key)) {
        row.style.opacity = '0.55';
        row.textContent = `${namePart} — already in roster, skipped`;
      } else {
        seen.add(key);
        const type = (typePart === 'WO' || typePart === 'TD') ? typePart : '';
        parsedNew.push({ name: namePart, category: '99999', type });
        row.textContent = `${namePart}${type ? ' (' + type + ')' : ''}`;
      }
      previewList.appendChild(row);
    });
    commitBtn.textContent = `+ Add ${parsedNew.length} Flavor${parsedNew.length !== 1 ? 's' : ''}`;
    commitBtn.style.display = parsedNew.length ? '' : 'none';
  };

  commitBtn.onclick = () => {
    if (!parsedNew.length) return;
    roster = [...roster, ...parsedNew];
    saveAll();
    showStatusMessage(`✓ Added ${parsedNew.length} flavor${parsedNew.length !== 1 ? 's' : ''} to roster`, 2500);
    textarea.value = '';
    previewList.innerHTML = '';
    commitBtn.style.display = 'none';
    parsedNew = [];
    const rosterInfo = document.getElementById('settingsRosterInfo');
    if (rosterInfo) rosterInfo.textContent = `${roster.length} flavors in roster · ${activeFlavors.length} active today`;
  };
}

// ── Edit Master Flavor List (CORPORATE_ADMIN only) ──────────────────────────
// Corporate-wide code/type edits and permanent removals — org.js's editOrgFlavor()/
// removeOrgFlavor() apply the change to every store's roster, not just this one.
// Renaming a flavor's display name isn't supported (name is the primary key used
// throughout the app), only its code (category) and type.
function _toggleMasterFlavorPanel() {
  const panel = document.getElementById('masterFlavorPanel');
  if (!panel) return;
  const willShow = panel.style.display === 'none';
  panel.style.display = willShow ? '' : 'none';
  if (willShow) _renderMasterFlavorPanel();
}

function _renderMasterFlavorPanel() {
  const panel = document.getElementById('masterFlavorPanel');
  if (!panel) return;
  panel.innerHTML = '';

  const searchInput = document.createElement('input');
  searchInput.className = 'settings-input';
  searchInput.placeholder = 'Search flavors…';
  searchInput.style.marginBottom = '8px';

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'max-height:360px;overflow-y:auto;display:grid;gap:6px;';

  searchInput.oninput = () => _renderMasterFlavorList(listWrap, searchInput.value);
  panel.append(searchInput, listWrap);
  _renderMasterFlavorList(listWrap, '');
}

function _renderMasterFlavorList(listWrap, query) {
  listWrap.innerHTML = '';
  const q = (query || '').toLowerCase();
  const items = [...roster].filter(r => r.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No matches.';
    listWrap.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'settings-card';
    row.style.cssText += 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'flex:1;min-width:140px;font-size:13px;font-weight:600;';
    nameEl.textContent = item.name;
    row.appendChild(nameEl);

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.className = 'settings-input';
    codeInput.value = item.category;
    codeInput.placeholder = 'Code';
    codeInput.style.cssText = 'width:100px;padding:6px;';
    codeInput.onchange = () => editOrgFlavor(item.name, { category: codeInput.value.trim() });
    row.appendChild(codeInput);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'settings-input';
    typeSelect.style.cssText = 'width:96px;padding:6px;';
    [{ v: '', l: 'Regular' }, { v: 'WO', l: 'WO' }, { v: 'TD', l: 'TD' }].forEach(({ v, l }) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = l;
      if ((item.type || '') === v) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.onchange = () => editOrgFlavor(item.name, { type: typeSelect.value });
    row.appendChild(typeSelect);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑';
    removeBtn.title = "Remove from every store's roster";
    removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:6px;';
    removeBtn.onclick = () => {
      removeOrgFlavor(item.name, () => {
        _renderMasterFlavorList(listWrap, query);
        const rosterInfo = document.getElementById('settingsRosterInfo');
        if (rosterInfo) rosterInfo.textContent = `${roster.length} flavors in roster · ${activeFlavors.length} active today`;
      });
    };
    row.appendChild(removeBtn);

    listWrap.appendChild(row);
  });
}

// ── Export Data ──────────────────────────────────────────────────────────────
// CSV export helper — triggers a browser download of the given rows.
function _downloadCsv(filename, headers, rows) {
  const escape = v => {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// One row per (date, flavor) with daily + catering quantities made, sourced
// from the runs/{date} subcollection — unlike storeEvents (capped at
// STORE_EVENTS_MAX_ENTRIES), every day's run doc persists indefinitely, so
// this reflects full history since runMade/cateringMade started being recorded.
async function exportRunsCsv() {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  showStatusMessage('Preparing export…', 2000);
  try {
    const q = window._query(window.getStoreRunLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(400));
    const snap = await window._getDocs(q);
    const rows = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const runMade = data.runMade || {};
      const cateringMade = data.cateringMade || {};
      const names = new Set([...Object.keys(runMade), ...Object.keys(cateringMade)]);
      names.forEach(name => rows.push([d.id, name, runMade[name] || 0, cateringMade[name] || 0]));
    });
    if (!rows.length) { showStatusMessage('No run history to export yet', 2500); return; }
    _downloadCsv(`runs-${todayStr()}.csv`, ['Date', 'Flavor', 'Made', 'Catering Made'], rows);
  } catch (e) {
    console.error('Export runs error:', e);
    showStatusMessage('⚠ Could not export runs', 2500);
  }
}

// One row per (date, item) from the noveltiesLog/{date} subcollection.
async function exportNoveltiesCsv() {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  showStatusMessage('Preparing export…', 2000);
  try {
    const q = window._query(window.getStoreNoveltiesLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(400));
    const snap = await window._getDocs(q);
    const rows = [];
    snap.docs.forEach(d => {
      (d.data().items || []).forEach(item => rows.push([d.id, item.category, item.name, item.onHand || 0, item.madeQty || 0]));
    });
    if (!rows.length) { showStatusMessage('No novelties history to export yet', 2500); return; }
    _downloadCsv(`novelties-${todayStr()}.csv`, ['Date', 'Category', 'Item', 'On Hand', 'Made'], rows);
  } catch (e) {
    console.error('Export novelties error:', e);
    showStatusMessage('⚠ Could not export novelties', 2500);
  }
}

// One row per (date, item) from the inventoryLog/{date} subcollection.
async function exportInventoryCsv() {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  showStatusMessage('Preparing export…', 2000);
  try {
    const q = window._query(window.getStoreInventoryLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(400));
    const snap = await window._getDocs(q);
    const rows = [];
    snap.docs.forEach(d => {
      (d.data().items || []).forEach(item => rows.push([d.id, item.name, item.onHand || 0]));
    });
    if (!rows.length) { showStatusMessage('No inventory history to export yet', 2500); return; }
    _downloadCsv(`inventory-${todayStr()}.csv`, ['Date', 'Item', 'On Hand'], rows);
  } catch (e) {
    console.error('Export inventory error:', e);
    showStatusMessage('⚠ Could not export inventory', 2500);
  }
}

// Total batches made per flavor for one calendar month — reads each day's run
// doc directly (at most 31 reads) rather than a range query, since doc IDs
// are already plain YYYY-MM-DD strings. Only reflects days that have runMade
// data recorded (i.e. run since the Made-stepper workflow shipped) — earlier
// history recorded under the old checkbox system won't have per-flavor totals.
async function exportMonthlyBatchReport(monthStr) {
  if (!window._firebaseReady) { showStatusMessage('Offline — export needs a connection', 3000); return; }
  if (!monthStr) { showStatusMessage('Pick a month first', 2000); return; }
  showStatusMessage('Preparing monthly report…', 2000);
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  );
  try {
    const docs = await Promise.all(dates.map(date =>
      window._getDoc(window.getStoreRunLogRef(date)).catch(() => null)
    ));
    const totals = {};
    docs.forEach(snap => {
      if (!snap || !snap.exists()) return;
      Object.entries(snap.data().runMade || {}).forEach(([name, qty]) => {
        totals[name] = (totals[name] || 0) + (qty || 0);
      });
    });
    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!rows.length) { showStatusMessage(`No production recorded for ${monthStr}`, 3000); return; }
    _downloadCsv(`batches-by-flavor-${monthStr}.csv`, ['Flavor', 'Batches Made'], rows);
  } catch (e) {
    console.error('Monthly batch report error:', e);
    showStatusMessage('⚠ Could not generate monthly report', 2500);
  }
}

// Same aggregation as exportMonthlyBatchReport() (last 30 calendar days
// instead of one calendar month), rendered inline in Settings rather than
// downloaded — and, unlike that report, always lists every flavor currently
// on the store's active list (zeros included), not just ones with recorded
// production, so a manager can see what ISN'T moving too.
async function _renderLast30DaysReport(container) {
  container.innerHTML = '<div class="settings-note">Loading…</div>';
  if (!window._firebaseReady) { container.innerHTML = '<div class="settings-note">Offline — needs a connection</div>'; return; }
  try {
    const dates = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA')
    );
    const docs = await Promise.all(dates.map(date =>
      window._getDoc(window.getStoreRunLogRef(date)).catch(() => null)
    ));
    const totals = {};
    activeFlavors.forEach(f => { totals[f.name] = 0; });
    docs.forEach(snap => {
      if (!snap || !snap.exists()) return;
      Object.entries(snap.data().runMade || {}).forEach(([name, qty]) => {
        totals[name] = (totals[name] || 0) + (qty || 0);
      });
    });
    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!rows.length) {
      container.innerHTML = '<div class="settings-note">No active flavors to report on.</div>';
      return;
    }
    container.innerHTML = '';
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';
    table.innerHTML = `<thead><tr>
      <th style="text-align:left;padding:6px 8px;border-bottom:1.5px solid var(--panel-border);color:var(--text-accent);font-size:11px;text-transform:uppercase;">Flavor</th>
      <th style="text-align:right;padding:6px 8px;border-bottom:1.5px solid var(--panel-border);color:var(--text-accent);font-size:11px;text-transform:uppercase;">Buckets Made</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');
    rows.forEach(([name, qty]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="padding:6px 8px;border-bottom:1px solid var(--panel-border);">${name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid var(--panel-border);text-align:right;font-weight:${qty > 0 ? 700 : 400};color:${qty > 0 ? 'var(--text-primary)' : 'var(--text-dim)'};">${qty}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
    const csvBtn = document.createElement('button');
    csvBtn.className = 'btn';
    csvBtn.style.cssText = 'margin-top:10px;font-size:12px;padding:8px 12px;';
    csvBtn.textContent = '⬇ Download as CSV';
    csvBtn.onclick = () => _downloadCsv(`last-30-days-by-flavor-${todayStr()}.csv`, ['Flavor', 'Buckets Made'], rows);
    container.appendChild(csvBtn);
  } catch (e) {
    console.error('Last 30 days report error:', e);
    container.innerHTML = '<div class="settings-note">⚠ Could not load the report.</div>';
  }
}

// Read-only recall of one day's tear-down/sanitize answers (see
// js/production.js beginRunSummaryFlow()/writeRunSummary() for how this doc
// is written — only exists for a day whose run actually included a
// type='TD' flavor).
async function _renderTearDownLogView(date, container) {
  if (!date) { container.innerHTML = '<div class="settings-note">Pick a date first.</div>'; return; }
  container.innerHTML = '<div class="settings-note">Loading…</div>';
  if (!window._firebaseReady) { container.innerHTML = '<div class="settings-note">Offline — needs a connection</div>'; return; }
  try {
    const snap = await window._getDoc(window.getStoreTearDownLogRef(date));
    if (!snap.exists()) {
      container.innerHTML = `<div class="settings-note">No tear-down record for ${date} — either no type='TD' flavor was run that day, or the run wasn't submitted yet.</div>`;
      return;
    }
    const data = snap.data();
    const yn = v => v === true ? '✓ Yes' : v === false ? '✕ No' : '—';
    const perFlavorRows = Object.entries(data.perFlavor || {})
      .map(([name, done]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${name}</span><span>${yn(done)}</span></div>`)
      .join('') || '<div class="settings-note">None recorded.</div>';
    const additionalRows = (data.additional || []).length
      ? data.additional.map(name => `<div style="padding:4px 0;">${name}</div>`).join('')
      : '<div class="settings-note">None.</div>';
    container.innerHTML = `
      <div style="display:grid;gap:10px;">
        <div style="display:flex;justify-content:space-between;"><strong>Before run</strong><span>${yn(data.beforeRun)}</span></div>
        <div style="display:flex;justify-content:space-between;"><strong>After run</strong><span>${yn(data.afterRun)}</span></div>
        <div>
          <strong>Per-flavor (Made-time)</strong>
          ${perFlavorRows}
        </div>
        <div>
          <strong>Additional flavors torn down</strong>
          ${additionalRows}
        </div>
        ${data.by ? `<div class="settings-note">Recorded by ${data.by}</div>` : ''}
      </div>`;
  } catch (e) {
    console.error('Tear-down log view error:', e);
    container.innerHTML = '<div class="settings-note">⚠ Could not load this record.</div>';
  }
}

// Read-only recall of one day's freezer/fridge temp readings (js/temps.js).
// Matches equipment ids against the CURRENT tempEquipment list for label/
// target — a piece of equipment removed since that date shows its id instead
// of silently vanishing from the record.
async function _renderTempsLogView(date, container) {
  if (!date) { container.innerHTML = '<div class="settings-note">Pick a date first.</div>'; return; }
  container.innerHTML = '<div class="settings-note">Loading…</div>';
  if (!window._firebaseReady) { container.innerHTML = '<div class="settings-note">Offline — needs a connection</div>'; return; }
  try {
    const snap = await window._getDoc(window.getStoreTempLogRef(date));
    if (!snap.exists()) {
      container.innerHTML = `<div class="settings-note">No temperature record for ${date}.</div>`;
      return;
    }
    const data = snap.data();
    const readings = data.readings || {};
    const ids = Object.keys(readings);
    if (!ids.length) {
      container.innerHTML = '<div class="settings-note">No readings recorded that day.</div>';
      return;
    }
    const rows = ids.map(id => {
      const eq = tempEquipment.find(e => e.id === id);
      const label = eq ? eq.label : `(removed equipment: ${id})`;
      const target = eq ? `${eq.targetTemp}°F` : '—';
      const val = readings[id];
      const current = (val === null || val === undefined) ? '—' : `${val}°F`;
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--panel-border);">
        <span>${label}</span><span>Target ${target} &nbsp;·&nbsp; Reading ${current}</span>
      </div>`;
    }).join('');
    container.innerHTML = `
      <div>
        ${data.submitted ? `<div class="settings-note" style="margin-bottom:8px;">✓ Submitted${data.submittedAt ? ' ' + relativeTime(data.submittedAt) : ''}</div>` : '<div class="settings-note" style="margin-bottom:8px;">Not yet submitted (in progress).</div>'}
        ${rows}
      </div>`;
  } catch (e) {
    console.error('Temps log view error:', e);
    container.innerHTML = '<div class="settings-note">⚠ Could not load this record.</div>';
  }
}
