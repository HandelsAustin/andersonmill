// Master flavor roster, roster CRUD, add-flavor modal/picker, cabinet-sort prefs.
// Extracted from index.html — no logic changes.

const MASTER_ROSTER = [
  {category:"90301", name:"Banana (BAN)", type:"TD"},
  {category:"90302", name:"Banana Cream Pie (BCP)", type:"TD"},
  {category:"90300", name:"Bananas Foster (BF)", type:"WO"},
  {category:"701", name:"Birthday Cake (BDAY)", type:""},
  {category:"600", name:"Black Cherry (BC)", type:""},
  {category:"603", name:"Black Raspberry (BR)", type:""},
  {category:"604", name:"Black Raspberry Chunk (BRC)", type:""},
  {category:"SH83000", name:"Black Raspberry Sherbet (BRS)", type:"WO"},
  {category:"1850", name:"Black Walnut (BW)", type:"WO"},
  {category:"82300", name:"Blue Monster (BMON)", type:"WO"},
  {category:"82350", name:"Blue Moon (BM)", type:"WO"},
  {category:"TDICE81800", name:"Blue Moon Ice (BMI)", type:"WO"},
  {category:"802", name:"Blueberry Cheesecake Chunk (BBCHZ)", type:""},
  {category:"105", name:"Blueberry Cobbler (BBCOB)", type:""},
  {category:"201", name:"Brownie Dough (BD)", type:""},
  {category:"90500", name:"Buckeye (BE)", type:"TD"},
  {category:"121", name:"Butter Pecan (BP)", type:""},
  {category:"103", name:"Butterscotch Ripple (BSR)", type:""},
  {category:"700", name:"Cake Batter (CB)", type:""},
  {category:"1301", name:"Caramel Apple (CAP)", type:""},
  {category:"903", name:"Caramel Latte (CL)", type:""},
  {category:"901", name:"Caramel Pretzel Crunch (CPC)", type:""},
  {category:"93003", name:"Carrot Cake (CARROT)", type:"TD"},
  {category:"800", name:"Cheesecake Made with Oreo®️ (OREOCHZ)", type:""},
  {category:"92800", name:"Cherry Cordial (CORD)", type:"TD"},
  {category:"601", name:"Cherry Magnolia (CMAG)", type:""},
  {category:"111", name:"Cherry Vanilla (CV)", type:""},
  {category:"805", name:"Choc. Chocolate Chip Cheesecake Chunk (CCCHZ)", type:""},
  {category:"214", name:"Chocoholic Chunk (CK)", type:""},
  {category:"215", name:"Chocoholic Peanut Butter Ripple (CKPBR)", type:""},
  {category:"205", name:"Chocolate (C)", type:""},
  {category:"202", name:"Chocolate Almond (CA)", type:""},
  {category:"V000002", name:"Chocolate Almond Milk Ice Cream (CAMILK)", type:"TD"},
  {category:"218", name:"Chocolate Cake Batter (CCB)", type:""},
  {category:"113", name:"Chocolate Chip (CHOC CHIP)", type:""},
  {category:"108", name:"Chocolate Chip Cookie Dough (CD)", type:""},
  {category:"92100", name:"Chocolate Covered Strawberry (CCS)", type:"TD"},
  {category:"212", name:"Chocolate Made with Oreo®️ (CHOC OREO)", type:""},
  {category:"200", name:"Chocolate Malt with Caramel (CMC)", type:""},
  {category:"209", name:"Chocolate Marshmallow (CM)", type:""},
  {category:"213", name:"Chocolate Ooohh...Dough! (CHOC OD)", type:""},
  {category:"301", name:"Chocolate Orange (CO)", type:"WO"},
  {category:"211", name:"Chocolate Peanut Butter Brownie (CPBB)", type:""},
  {category:"207", name:"Chocolate Pecan (CP)", type:""},
  {category:"217", name:"Chocolate Raspberry Truffle (CRT)", type:""},
  {category:"82400", name:"Cinnamon Graham Cracker (CGC)", type:"WO"},
  {category:"92900", name:"Cinnamon Pecan (CNP)", type:"WO"},
  {category:"702", name:"Cinnamon Roll (CR)", type:"WO"},
  {category:"91003", name:"Coconut Almond Fudge Ripple (CAFR)", type:"TD"},
  {category:"91001", name:"Coconut Caramel Delight (CCD)", type:"TD"},
  {category:"91000", name:"Coconut Cream Pie (CCP)", type:"TD"},
  {category:"V000001", name:"Coconut Milk Ice Cream (COMILK)", type:"WO"},
  {category:"91004", name:"Coconut Pineapple (CPINE)", type:"TD"},
  {category:"122", name:"Coffee (COF)", type:""},
  {category:"123", name:"Coffee Chocolate Chip (CCC)", type:""},
  {category:"124", name:"Coffee with Heath (COF w/ H)", type:""},
  {category:"219", name:"Confetti Brownie Batter (CBB)", type:""},
  {category:"81900", name:"Cotton Candy (CC)", type:"WO"},
  {category:"1300", name:"Deep Dish Apple Pie (DDAP)", type:""},
  {category:"900", name:"Dulce De Leche (DULCE)", type:""},
  {category:"1700", name:"Egg Nog (EGG)", type:"WO"},
  {category:"90303", name:"Elvis (ELVIS)", type:"TD"},
  {category:"204", name:"French Silk Pie (FSP)", type:""},
  {category:"82850", name:"Frosted Animal Cookie (FAC)", type:"WO"},
  {category:"106", name:"Fudge Ripple (FR)", type:""},
  {category:"107", name:"Fudge Ripple Brownie (FRB)", type:""},
  {category:"83200", name:"Gingerbread Cookie (GBC)", type:"WO"},
  {category:"1102", name:"Graham Canyon (GC)", type:""},
  {category:"1100", name:"Graham Central Station (GCS)", type:""},
  {category:"602", name:"Grape (G)", type:""},
  {category:"94100", name:"Green Monster (GMON)", type:"WO"},
  {category:"300", name:"Green Tea (GT)", type:"WO"},
  {category:"206", name:"Heavenly Hash (HH)", type:""},
  {category:"83100", name:"Horchata (HOR)", type:"WO"},
  {category:"82500", name:"Key Lime Pie (KLP)", type:"WO"},
  {category:"82800", name:"Knot Your Average Dough (KYAD)", type:"WO"},
  {category:"82600", name:"Lemon Bar (LB)", type:"WO"},
  {category:"TDICE82200", name:"Lemon Ice (LEM ICE)", type:"WO"},
  {category:"82601", name:"Lemon Meringue Pie (LMP)", type:"WO"},
  {category:"SH83100", name:"Lime Sherbet (LS)", type:"WO"},
  {category:"SO82200", name:"Mango Sorbet (MANGO SOR)", type:"TD"},
  {category:"91002", name:"Meri's Joy (MJ)", type:"TD"},
  {category:"216", name:"Midnight Madness (MM)", type:""},
  {category:"407", name:"Mint Chocolate Chip (MCC)", type:""},
  {category:"405", name:"Mint Made with Oreo®️ (MO)", type:""},
  {category:"SO82400", name:"Mixed Berry Sorbet (MB SOR)", type:"TD"},
  {category:"125", name:"Mocha Almond Fudge Ripple (MAFR)", type:""},
  {category:"90304", name:"Monkey Business (MB)", type:"TD"},
  {category:"126", name:"Mud Pie (MP)", type:""},
  {category:"801", name:"New York Style Cheesecake (NYC)", type:""},
  {category:"1503", name:"NSA Banana Fudge", type:""},
  {category:"1502", name:"NSA Butter Pecan", type:""},
  {category:"1501", name:"NSA Chocolate Ripple", type:""},
  {category:"1600", name:"NSA Coffee", type:""},
  {category:"1601", name:"NSA Coffee Chocolate Ripple", type:""},
  {category:"1504", name:"NSA Strawberry Banana", type:""},
  {category:"1500", name:"NSA Vanilla", type:""},
  {category:"110", name:"Ooohh...Dough! (OD)", type:""},
  {category:"93001", name:"Orange Dream Cream (ODC)", type:"TD"},
  {category:"92750", name:"Orange Pineapple (OP)", type:"TD"},
  {category:"93000", name:"Orange Sherbet (OS)", type:"TD"},
  {category:"93200", name:"Peach (PEACH)", type:"TD"},
  {category:"90501", name:"Peanut Butter (PB)", type:"TD"},
  {category:"90503", name:"Peanut Butter and Jelly (PBJ)", type:"TD"},
  {category:"203", name:"Peanut Butter Parfait (PBP)", type:""},
  {category:"403", name:"Peppermint Bark (PBARK)", type:""},
  {category:"402", name:"Peppermint Stick (PS)", type:""},
  {category:"SH83200", name:"Pineapple Sherbet (PINE SH)", type:"WO"},
  {category:"92700", name:"Pineapple Upside Down Cake (PUDC)", type:"TD"},
  {category:"SH82800", name:"Pink Champagne Sherbet (PC)", type:"WO"},
  {category:"82700", name:"Pink Lemonade (PL)", type:"WO"},
  {category:"401", name:"Pistachio (PIST)", type:""},
  {category:"SO82500", name:"Pomegranate Sorbet (POM SOR)", type:"TD"},
  {category:"102", name:"Praline Pecan (PP)", type:""},
  {category:"1403", name:"Pumpkin Cheesecake Chunk (PCHZ)", type:""},
  {category:"1402", name:"Pumpkin Pecan (PPEC)", type:""},
  {category:"1400", name:"Pumpkin Pie (PPIE)", type:""},
  {category:"1401", name:"Pumpkin Ripple (PR)", type:""},
  {category:"804", name:"Raspberry Cheesecake Chunk (RCHZ)", type:""},
  {category:"SH82901", name:"Raspberry Dream Cream (RDC)", type:"TD"},
  {category:"82875", name:"Raspberry Sheet Cake (RSC)", type:"WO"},
  {category:"SH82900", name:"Red Raspberry Sherbet (RS)", type:"WO"},
  {category:"127", name:"Rocky Mocha Blast (RMB)", type:"WO"},
  {category:"210", name:"Rocky Road (RR)", type:""},
  {category:"1101", name:"S'Mores (S'M)", type:""},
  {category:"902", name:"Salty Caramel Truffle (SCT)", type:""},
  {category:"208", name:"Snappy Turtle (ST)", type:""},
  {category:"1800", name:"Snickerdoodle (SD)", type:"WO"},
  {category:"90502", name:"Snix (SNIX)", type:"TD"},
  {category:"100", name:"Soft Vanilla (VAN)", type:""},
  {category:"TDICE82300", name:"Sour Green Apple Ice (SGA ICE)", type:"WO"},
  {category:"81200", name:"Spouse Like A House (SLAH)", type:"WO"},
  {category:"90504", name:"Sticky Fingers (SF)", type:"TD"},
  {category:"92000", name:"Strawberry (STRAW)", type:"TD"},
  {category:"803", name:"Strawberry Cheesecake Chunk (SCHZ)", type:""},
  {category:"SO82300", name:"Strawberry Sorbet (STRAW SOR)", type:"TD"},
  {category:"2000", name:"Taro (T)", type:"WO"},
  {category:"94200", name:"Tiger Stripes (TS)", type:""},
  {category:"104", name:"Tin Lizzy (TL)", type:""},
  {category:"400", name:"Toasted Almond (TA)", type:"WO"},
  {category:"112", name:"Twixter (TWIX)", type:""},
  {category:"101", name:"Vanilla (VAN)", type:""},
  {category:"114", name:"Vanilla Caramel Brownie (VCB)", type:""},
  {category:"115", name:"Vanilla Caramel Truffle (VCT)", type:""},
  {category:"109", name:"Vanilla Made with Oreo®️ (OREO)", type:""},
  {category:"119", name:"Vanilla Peanut Butter Chip (VPBC)", type:""},
  {category:"118", name:"Vanilla Peanut Butter Ripple (VPBR)", type:""},
  {category:"SO82600", name:"Vanilla Pineapple Sorbet (VP SOR)", type:"TD"},
  {category:"116", name:"Vanilla Raspberry Chip (VRC)", type:""},
  {category:"117", name:"Vanilla Turtle (VT)", type:""},
  {category:"120", name:"Vanilla with Reese's Peanut Butter Cup®️ (VRPBC)", type:""},
  {category:"TDICE82100", name:"Watermelon Ice (WM ICE)", type:"WO"},
];

// ── STATE ──────────────────────────────────────────────────────────────────
function categorySort(cat) {
  const s = String(cat || '');
  const n = Number(s);
  if (!isNaN(n) && s.trim() !== '') return n;
  // prefix letters → push after numerics by adding a large base
  return 1e9 + s.charCodeAt(0) * 1e6 + (parseInt(s.replace(/\D/g,'')) || 0);
}

// ── PERSISTENCE ────────────────────────────────────────────────────────────
function toMake(f) {
  return Math.max(0, (parseInt(f.target) || 0) - Math.round((Number(f.dipping) || 0) - 0.1) - (parseInt(f.holding) || 0));
}

function typeColor(type) {
  if (type === 'TD') return '#ff7a7a';
  if (type === 'WO') return '#a8d8f0';
  return '#6ab0ff';
}

function flavorClass(f) {
  const t = (f.type || '').toUpperCase();
  if (t === 'WO') return 'flavor-wo';
  if (t === 'TD') return 'flavor-td';
  return 'flavor-regular';
}

// Sort: alphabetical normally; by category number in run mode
function getSorted(list) {
  return [...list].sort((a, b) => {
    if (runMode) return categorySort(a.category) - categorySort(b.category);
    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
  });
}

// ── DROPDOWNS ──────────────────────────────────────────────────────────────
const DIPPING_OPTIONS = [
  {label:'—', value:0},
  {label:'¼ Bucket', value:0.25},
  {label:'½ Bucket', value:0.5},
  {label:'¾ Bucket', value:0.75},
  {label:'Full Bucket', value:1},
];
const HOLDING_OPTIONS = [
  {label:'—',value:0},{label:'1',value:1},{label:'2',value:2},{label:'3',value:3},
  {label:'4',value:4},{label:'5',value:5},{label:'6',value:6},{label:'7',value:7},
  {label:'8',value:8},{label:'9',value:9},{label:'10',value:10},
];

function makeSelect(options, currentVal, fn) {
  const sel = document.createElement('select');
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (Number(currentVal) === opt.value) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = e => fn(Number(e.target.value));
  return sel;
}

// ── TABLE ──────────────────────────────────────────────────────────────────
let _cabinetSortEnabled = false;
let _cabinetCallback    = null;
function loadCabinetPref() {
  const val = localStorage.getItem('car_cabinet_sort');
  _cabinetSortEnabled = val === 'true';
}

function saveCabinetPref(val) {
  _cabinetSortEnabled = val;
  localStorage.setItem('car_cabinet_sort', val ? 'true' : 'false');
}

function resetCabinetSort() {
  if (!confirm('Turn off cabinet assignments? This will clear all cabinet numbers.')) return;
  localStorage.setItem('car_cabinet_sort', 'false');
  _cabinetSortEnabled = false;
  activeFlavors.forEach(f => { delete f.cabinet; });
  saveAll();
  updateSortToggleUI();
  renderPicker();
  renderTable();
}

function updateSortToggleUI() {
  const row = document.getElementById('sortToggleRow');
  const label = document.getElementById('sortToggleLabel');
  const btn = document.getElementById('cabinetToggleBtn');
  if (!row) return;
  row.style.display = 'flex';
  if (_cabinetSortEnabled) {
    label.textContent = 'Cabinet numbers assigned';
    if (btn) { btn.textContent = '✕ Turn Off Cabinet Numbers'; btn.style.borderColor = '#d72627'; btn.style.color = '#ffffff'; btn.style.background = '#d72627'; }
  } else {
    label.textContent = 'Cabinet numbers not assigned';
    if (btn) { btn.textContent = '✚ Turn On Cabinet Numbers'; btn.style.borderColor = '#98d4e3'; btn.style.color = '#ffffff'; btn.style.background = '#2c3691'; }
  }
}

function toggleCabinetNumbers() {
  if (_cabinetSortEnabled) {
    resetCabinetSort();
  } else {
    // Turn on — assign cabinets to all active flavors that don't have one
    saveCabinetPref(true);
    const missing = activeFlavors.filter(f => !f.cabinet);
    assignMissingCabinets(missing, () => {
      saveAll();
      updateSortToggleUI();
      renderPicker();
    });
  }
}

function showCabinetPicker(flavorName, subtitle, callback) {
  document.getElementById('cabinetTitle').textContent = flavorName;
  document.getElementById('cabinetSub').textContent = subtitle || '';
  _cabinetCallback = callback;
  document.getElementById('cabinetOverlay').classList.add('open');
}

function selectCabinet(num) {
  document.getElementById('cabinetOverlay').classList.remove('open');
  if (_cabinetCallback) { _cabinetCallback(num); _cabinetCallback = null; }
}

function assignMissingCabinets(queue, onComplete) {
  if (!queue.length) { onComplete(); return; }
  const f = queue[0];
  showCabinetPicker(f.name, 'Which dipping cabinet is this flavor in?', (num) => {
    const idx = activeFlavors.findIndex(a => a.name === f.name);
    if (idx >= 0) activeFlavors[idx].cabinet = num;
    assignMissingCabinets(queue.slice(1), onComplete);
  });
}

function askCabinetPreference() {
  const box = document.querySelector('.cabinet-box');
  box.innerHTML = `
    <h2 style="font-family:'Raiders','Impact',sans-serif;font-size:17px;color:#ffffff;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">Assign cabinet numbers?</h2>
    <p style="font-size:12px;color:#8fa3be;margin-bottom:20px;">Would you like to assign dipping cabinet numbers to your flavors? Cabinet numbers will appear next to each flavor name.</p>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <button class="cabinet-btn" style="font-size:15px;padding:16px 8px;" onclick="chooseCabinetPref(true)">Yes, assign cabinets</button>
      <button class="cabinet-btn" style="font-size:15px;padding:16px 8px;" onclick="chooseCabinetPref(false)">No thanks</button>
    </div>`;
  document.getElementById('cabinetOverlay').classList.add('open');
}

function restoreCabinetBox() {
  document.querySelector('.cabinet-box').innerHTML = `
    <h2 id="cabinetTitle">Which dipping cabinet?</h2>
    <p id="cabinetSub"></p>
    <div class="cabinet-btns">
      <button class="cabinet-btn" onclick="selectCabinet(1)">1</button>
      <button class="cabinet-btn" onclick="selectCabinet(2)">2</button>
      <button class="cabinet-btn" onclick="selectCabinet(3)">3</button>
      <button class="cabinet-btn" onclick="selectCabinet(4)">4</button>
    </div>`;
}

function chooseCabinetPref(enabled) {
  document.getElementById('cabinetOverlay').classList.remove('open');
  restoreCabinetBox();
  if (!enabled) {
    saveCabinetPref(false);
    updateSortToggleUI();
    renderPicker();
    return;
  }
  saveCabinetPref(true);
  const missing = activeFlavors.filter(f => !f.cabinet);
  assignMissingCabinets(missing, () => {
    saveAll();
    updateSortToggleUI();
    renderPicker();
  });
}

function openAddModal() {
  document.getElementById('pickerSearch').value = '';
  document.getElementById('newFlavorName').value = '';
  document.getElementById('newFlavorType').value = '';
  document.getElementById('modalBackdrop').classList.add('open');
  updateSortToggleUI();
  renderPicker();
  setTimeout(() => document.getElementById('pickerSearch').focus(), 10);
  if (localStorage.getItem('car_cabinet_sort') === null) {
    setTimeout(() => askCabinetPreference(), 200);
  }
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  renderTable();
}

function backdropClick(e) {
  if (e.target === document.getElementById('modalBackdrop')) closeModal();
}

function toggleFlavor(name) {
  const idx = activeFlavors.findIndex(f => f.name === name);
  if (idx >= 0) {
    activeFlavors.splice(idx, 1);
    saveAll(); renderPicker();
  } else {
    const r = roster.find(r => r.name === name);
    activeFlavors.push({ name, category: r ? r.category : '', type: r ? r.type || '' : '', target: 0, dipping: 0, holding: 0 });
    if (_cabinetSortEnabled) {
      showCabinetPicker(name, 'Which dipping cabinet is this flavor in?', (num) => {
        const fi = activeFlavors.findIndex(f => f.name === name);
        if (fi >= 0) activeFlavors[fi].cabinet = num;
        saveAll(); renderPicker();
      });
    } else {
      saveAll(); renderPicker();
    }
  }
}

let pendingRosterDelete = null;
let undoTimer = null;

function removeFromRoster(name) {
  // Stage deletion — show undo toast for 5 seconds
  if (undoTimer) { clearTimeout(undoTimer); commitRosterDelete(); }
  // Also commit any pending day-reset undo so the two don't conflict
  if (_resetUndoTimer) { clearTimeout(_resetUndoTimer); _resetSnapshot = null; _resetUndoTimer = null; }
  pendingRosterDelete = { name, roster: [...roster], active: [...activeFlavors] };
  roster = roster.filter(r => r.name !== name);
  activeFlavors = activeFlavors.filter(f => f.name !== name);
  saveAll(); renderPicker();
  showUndoToast(`"${name}" removed.`, undoRosterDelete);
  undoTimer = setTimeout(() => { commitRosterDelete(); }, 5000);
}

function commitRosterDelete() {
  pendingRosterDelete = null;
  undoTimer = null;
  hideUndoToast();
}

function undoRosterDelete() {
  if (!pendingRosterDelete) return;
  clearTimeout(undoTimer);
  roster = pendingRosterDelete.roster;
  activeFlavors = pendingRosterDelete.active;
  pendingRosterDelete = null;
  undoTimer = null;
  saveAll(); renderPicker();
  hideUndoToast();
}

// Generic undo toast — undoFn is stored globally so the inline onclick can call it.
// Defaults to undoRosterDelete for backward compatibility.
function showUndoToast(msg, undoFn) {
  window._undoToastHandler = undoFn || undoRosterDelete;
  let t = document.getElementById('undoToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'undoToast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2f52;border:1.5px solid #4a7ab5;color:#c5d8f0;padding:12px 18px;border-radius:8px;display:flex;align-items:center;gap:14px;z-index:200;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    document.body.appendChild(t);
  }
  t.innerHTML = `<span>${msg}</span><button onclick="window._undoToastHandler && window._undoToastHandler()" style="background:#d72627;border:none;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation;">Undo</button>`;
  t.style.display = 'flex';
}

function hideUndoToast() {
  const t = document.getElementById('undoToast');
  if (t) t.style.display = 'none';
}

function renderPicker() {
  const q = document.getElementById('pickerSearch').value.toLowerCase();
  const activeNames = new Set(activeFlavors.map(f => f.name));
  const items = roster
    .filter(r => r.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aOn = activeNames.has(a.name), bOn = activeNames.has(b.name);
      if (aOn && !bOn) return -1;
      if (!aOn && bOn) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

  const selCount = activeFlavors.length;
  const rosCount = roster.length;
  document.getElementById('pickerStats').textContent =
    `${selCount} of ${rosCount} flavor${rosCount !== 1 ? 's' : ''} selected`;
  // Show first-use hint when nothing is selected yet; hides after first flavor is toggled
  const hintEl = document.getElementById('pickerHint');
  if (hintEl) hintEl.style.display = selCount === 0 ? '' : 'none';

  const list = document.getElementById('pickerList');
  list.innerHTML = '';

  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'picker-empty';
    e.style.cssText = 'padding:1rem;font-size:12px;color:#4a6a90;text-align:center;';
    e.textContent = q ? 'No matches found' : 'Roster is empty';
    list.appendChild(e);
    return;
  }

  items.forEach(r => {
    const isActive = activeNames.has(r.name);
    const color = typeColor(r.type);

    const div = document.createElement('div');
    div.className = 'picker-item' + (isActive ? ' active' : '');

    // Checkmark
    const check = document.createElement('span');
    check.className = 'picker-check';
    check.textContent = isActive ? '✓' : '';
    div.appendChild(check);

    // Name — colored by type, no category shown
    const nameSpan = document.createElement('span');
    nameSpan.className = 'picker-name';
    nameSpan.style.color = color;
    nameSpan.textContent = r.name;
    nameSpan.addEventListener('click', () => toggleFlavor(r.name));
    div.appendChild(nameSpan);

    // Type badge — colored by type
    const typeBadge = document.createElement('span');
    typeBadge.className = 'picker-type-badge';
    typeBadge.style.color = color;
    typeBadge.textContent = r.type || '—';
    div.appendChild(typeBadge);

    // Remove from roster
    const removeBtn = document.createElement('button');
    removeBtn.className = 'picker-remove';
    removeBtn.textContent = '🗑';
    removeBtn.title = 'Remove from roster';
    removeBtn.addEventListener('click', e => { e.stopPropagation(); removeFromRoster(r.name); });
    div.appendChild(removeBtn);

    list.appendChild(div);
  });
}

function addNewToRoster() {
  const name = document.getElementById('newFlavorName').value.trim();
  const type = document.getElementById('newFlavorType').value;
  if (!name) { document.getElementById('newFlavorName').focus(); return; }
  if (roster.find(r => r.name.toLowerCase() === name.toLowerCase())) {
    alert(`"${name}" is already in the roster.`); return;
  }
  // Custom flavors get a high category number so they sort to the end in run mode
  roster.push({ name, category: '99999', type });
  saveAll(); renderPicker();
}

// ── VARIEGATES ──────────────────────────────────────────────────────────────
const VARIEGATES = {
  'Deep Dish Apple Pie (DDAP)': ['Applesauce'],
  'Birthday Cake (BDAY)': ['Blue Icing'],
  'Blueberry Cheesecake Chunk (BBCHZ)': ['Blueberry'],
  'Blueberry Cobbler (BBCOB)': ['Blueberry'],
  'Cinnamon Roll (CR)': ['Brown Sugar Cinnamon'],
  'Butterscotch Ripple (BSR)': ['Butterscotch'],
  'Praline Pecan (PP)': ['Butterscotch'],
  'Tin Lizzy (TL)': ['Butterscotch'],
  'Bananas Foster (BF)': ['Caramel'],
  'Caramel Apple (CAP)': ['Caramel'],
  'Caramel Pretzel Crunch (CPC)': ['Caramel'],
  'Chocolate Malt with Caramel (CMC)': ['Caramel'],
  'Coconut Caramel Delight (CCD)': ['Caramel'],
  'Dulce De Leche (DULCE)': ['Caramel'],
  'Graham Canyon (GC)': ['Caramel'],
  'Monkey Business (MB)': ['Caramel'],
  'Snappy Turtle (ST)': ['Caramel'],
  'Sticky Fingers (SF)': ['Caramel'],
  'Twixter (TWIX)': ['Caramel'],
  'Vanilla Caramel Brownie (VCB)': ['Caramel'],
  'Vanilla Caramel Truffle (VCT)': ['Caramel'],
  'Vanilla Turtle (VT)': ['Caramel'],
  'Snix (SNIX)': ['Caramel Ripple'],
  'Caramel Latte (CL)': ['Chocolate Espresso'],
  'Buckeye (BE)': ['Fudge'],
  'Chocolate Covered Strawberry (CCS)': ['Fudge'],
  'Coconut Almond Fudge Ripple (CAFR)': ['Fudge'],
  'Fudge Ripple (FR)': ['Fudge'],
  'Fudge Ripple Brownie (FRB)': ['Fudge'],
  'Mocha Almond Fudge Ripple (MAFR)': ['Fudge'],
  'Mud Pie (MP)': ['Fudge'],
  'Cinnamon Graham Cracker (CGC)': ['Graham Cracker'],
  'French Silk Pie (FSP)': ['Graham Cracker'],
  'Graham Central Station (GCS)': ['Graham Cracker'],
  'Key Lime Pie (KLP)': ['Graham Cracker'],
  'Lemon Bar (LB)': ['Graham Cracker'],
  'New York Style Cheesecake (NYC)': ['Graham Cracker'],
  'Pumpkin Pie (PPIE)': ['Graham Cracker'],
  'Banana Cream Pie (BCP)': ['Marshmallow'],
  'Coconut Cream Pie (CCP)': ['Marshmallow'],
  'Heavenly Hash (HH)': ['Marshmallow'],
  'Lemon Meringue Pie (LMP)': ['Marshmallow'],
  'Pumpkin Ripple (PR)': ['Marshmallow'],
  "S'Mores (S'M)": ['Marshmallow'],
  'Chocoholic Peanut Butter Ripple (CKPBR)': ['Peanut Butter'],
  'Chocolate Peanut Butter Brownie (CPBB)': ['Peanut Butter'],
  'Midnight Madness (MM)': ['Peanut Butter'],
  'Peanut Butter Parfait (PBP)': ['Peanut Butter'],
  'Spouse Like A House (SLAH)': ['Peanut Butter'],
  'Vanilla Peanut Butter Chip (VPBC)': ['Peanut Butter'],
  'Vanilla Peanut Butter Ripple (VPBR)': ['Peanut Butter'],
  'Chocolate Raspberry Truffle (CRT)': ['Raspberry'],
  'Raspberry Cheesecake Chunk (RCHZ)': ['Raspberry'],
  'Raspberry Sheet Cake (RSC)': ['Raspberry'],
  'Vanilla Raspberry Chip (VRC)': ['Raspberry'],
  'Knot Your Average Dough (KYAD)': ['Salted Pretzel'],
  'Peanut Butter and Jelly (PBJ)': ['Strawberry'],
  'Strawberry Cheesecake Chunk (SCHZ)': ['Strawberry'],
  'Frosted Animal Cookie (FAC)': ['White Icing'],
};

