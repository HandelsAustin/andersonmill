// Freezer/Fridge Temp tracking.
//
// Equipment catalog (id, type, label, targetTemp) is persistent — store.tempEquipment,
// merged onto the existing store doc, same pattern as Inventory's catalog
// (js/inventory.js). Adding/removing equipment and changing target temps requires
// the manager PIN (requireManager()) — daily current-temp entry does not, so any
// signed-in user can log today's readings without unlocking anything.
//
// Each day's current-temp readings live in their own small doc,
// organizations/{orgId}/stores/{storeId}/tempLog/{date}, so a day can be recalled
// later (Settings → Freezer/Fridge Temps) without bloating the store doc.

const TEMP_EQUIPMENT_TYPES = [
  'Walk-in Refrigerator',
  'Drink Refrigerator',
  'Sundae Bar',
  'Single Door Freezer',
  'Double Door Freezer',
  'Holding Cabinet',
  'Dipping Cabinet',
  'Chest Freezer',
];

let tempEquipment = []; // [{id, type, label, targetTemp}] — populated by applyData() in store-org.js
// {type: highestNumberUsed} — persisted alongside tempEquipment. Monotonic and
// never decremented on removal, per how duplicate numbering is meant to work:
// deleting "Walk-in Refrigerator #2" and adding a new walk-in later gets #3,
// not a reused #2.
let tempEquipmentCounters = {};
let _tempLog = {}; // working date's readings: { equipmentId: number|null }
let _workingTempDate = null;
let _tempSubmitted = false; // whether the working date's log has already been submitted
let _tempResetSnapshot = null;
let _tempResetUndoTimer = null;
let _submitTempsConfirmSkip = false; // double-tap-to-confirm guard, see submitTempsDay()

// See _makeCoalescedSaver() (appHelpers.js) — same rapid-edit race as every
// other store-doc writer. Shares `_saving` since it lands on the store doc
// alongside everything else that flag already guards.
async function _saveTempEquipmentOnce() {
  if (!window._firebaseReady) { showStatusMessage('Offline — equipment list saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { tempEquipment, tempEquipmentCounters }, { merge: true });
  } catch (e) {
    console.error('Temp equipment save error:', e);
    showStatusMessage('⚠ Could not save equipment list', 2500);
  }
}
const saveTempEquipment = _makeCoalescedSaver(_saveTempEquipmentOnce, {
  onStart:  () => { _saving = true; },
  onSettle: () => { _saving = false; },
});

// Local-backup-before-network-write pattern, same as Novelties (js/novelties.js
// _saveNoveltiesLogOnce()) — an edit made right as the app backgrounds/closes
// still has a local record instead of only existing in an in-flight request.
function _saveTempLocalBackup() {
  try {
    localStorage.setItem('car_temp_backup', JSON.stringify({
      date: _workingTempDate || todayStr(), readings: _tempLog, updatedAt: Date.now()
    }));
  } catch (e) {}
}
function _loadTempLocalBackup(date) {
  try {
    const raw = localStorage.getItem('car_temp_backup');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && parsed.date === date) ? parsed.readings : null;
  } catch (e) { return null; }
}

async function _saveTempLogOnce() {
  _saveTempLocalBackup();
  if (!window._firebaseReady) {
    setSyncStatus('offline');
    showStatusMessage("Offline — today's readings saved locally only", 3000);
    return;
  }
  setSyncStatus('saving');
  try {
    await window._setDoc(window.getStoreTempLogRef(_workingTempDate || todayStr()), { readings: _tempLog, updatedAt: Date.now() }, { merge: true });
    setSyncStatus('saved');
  } catch (e) {
    console.error('Temp log save error:', e);
    setSyncStatus('error');
    showStatusMessage('⚠ Could not save readings', 2500);
  }
}
const saveTempLog = _makeCoalescedSaver(_saveTempLogOnce);

// Loads (and switches the working date to) a specific date's readings — same
// recall pattern as Inventory. Offline/error fallback mirrors Novelties'
// fix (js/novelties.js loadNoveltiesForDate()): a failed read must never look
// the same as "nothing recorded yet," which would wrongly blank real data.
async function loadTempsForDate(date) {
  _workingTempDate = date;
  let logData = null;
  let loadFailed = false;
  if (window._firebaseReady) {
    try {
      const snap = await window._getDoc(window.getStoreTempLogRef(date));
      if (snap.exists()) logData = snap.data();
    } catch (e) {
      console.error('Temp log load error:', e);
      loadFailed = true;
    }
  } else {
    loadFailed = true;
  }
  if (loadFailed) {
    const cached = _loadTempLocalBackup(date);
    _tempLog = cached || {};
    _tempSubmitted = false;
    setSyncStatus('offline');
  } else {
    _tempLog = logData?.readings || {};
    _tempSubmitted = !!(logData && logData.submitted);
    _saveTempLocalBackup();
  }
  renderTempsPage();
}

async function listRecentTempDates(max = 60) {
  if (!window._firebaseReady || !window._getDocs || !window._query) return [];
  try {
    const q = window._query(window.getStoreTempLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(max));
    const snap = await window._getDocs(q);
    return snap.docs.map(d => d.id);
  } catch (e) {
    console.error('List temp dates error:', e);
    return [];
  }
}

// ── Date recall (same pattern as Inventory's picker) ────────────────────────
function _renderTempsDatePicker() {
  const container = document.getElementById('tempsDatePicker');
  if (!container) return;
  const isToday = _workingTempDate === todayStr();
  container.style.position = 'relative';
  container.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.cssText = 'font-size:12px;padding:8px 12px;';
  btn.textContent = `📅 ${isToday ? 'Today' : _workingTempDate} ▾`;
  btn.onclick = e => { e.stopPropagation(); _toggleTempsDateMenu(); };
  container.appendChild(btn);

  if (!isToday) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.style.cssText = 'font-size:12px;padding:8px 12px;margin-left:6px;';
    backBtn.textContent = '↩ Back to Today';
    backBtn.onclick = () => loadTempsForDate(todayStr());
    container.appendChild(backBtn);
  }

  const menu = document.createElement('div');
  menu.id = 'tempsDateMenu';
  menu.style.cssText = 'display:none;position:absolute;top:110%;left:0;background:#1a2744;border:1.5px solid #2e4a70;border-radius:8px;overflow:hidden;z-index:200;min-width:200px;max-height:280px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
  container.appendChild(menu);
}

async function _toggleTempsDateMenu() {
  const menu = document.getElementById('tempsDateMenu');
  if (!menu) return;
  if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
  menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">Loading…</div>';
  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: true }), 0);

  const dates = await listRecentTempDates();
  menu.innerHTML = '';
  if (!dates.length) {
    menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">No saved readings yet.</div>';
    return;
  }
  dates.forEach(d => {
    const row = document.createElement('button');
    row.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;border-bottom:1px solid #2e4a70;color:#c5d8f0;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;font-size:13px;cursor:pointer;';
    row.textContent = d === todayStr() ? `${d} (Today)` : d;
    row.onclick = () => { loadTempsForDate(d); menu.style.display = 'none'; };
    menu.appendChild(row);
  });
}

// ── Equipment CRUD (manager-gated) ──────────────────────────────────────────
function _addTempEquipment(type, targetTemp, location) {
  const nextNum = (tempEquipmentCounters[type] || 0) + 1;
  tempEquipmentCounters[type] = nextNum;
  const label = nextNum === 1 ? type : `${type} #${nextNum}`;
  tempEquipment.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type, label, targetTemp, location: location || ''
  });
  saveTempEquipment();
  renderTempsPage();
}

function _removeTempEquipment(id) {
  const idx = tempEquipment.findIndex(e => e.id === id);
  if (idx < 0) return;
  const removed = tempEquipment[idx];
  const prevList = [...tempEquipment];
  const removedReading = _tempLog[id];
  tempEquipment = tempEquipment.filter((_, i) => i !== idx);
  delete _tempLog[id];
  saveTempEquipment();
  saveTempLog();
  renderTempsPage();
  showUndoToast(`"${removed.label}" removed.`, () => {
    tempEquipment = prevList;
    if (removedReading !== undefined) _tempLog[id] = removedReading;
    saveTempEquipment();
    saveTempLog();
    renderTempsPage();
  });
}

// Add-new-equipment form only — the per-equipment list itself lives in
// renderTempsPage()'s single unified list below (Name/Location/Target/
// Current/Delete), not duplicated here. Location + Target Temp are set here
// at creation time; editing either afterward happens from the Admin tab
// (js/settings.js "Freezer/Fridge Equipment" section), not inline in Temps.
function _buildTempEquipmentManager(container) {
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'settings-input';
  typeSelect.style.flex = '2';
  typeSelect.style.minWidth = '180px';
  TEMP_EQUIPMENT_TYPES.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  const locationField = _settingsInput('Location', '', 'text');
  locationField.wrap.style.width = '140px';

  const targetField = _settingsInput('Target °F', '', 'number');
  targetField.wrap.style.width = '100px';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-green';
  addBtn.textContent = '+ Add';
  addBtn.onclick = () => {
    if (targetField.input.value === '') { targetField.input.focus(); return; }
    _addTempEquipment(typeSelect.value, parseFloat(targetField.input.value), locationField.input.value.trim());
    targetField.input.value = '';
    locationField.input.value = '';
  };
  addRow.append(typeSelect, locationField.wrap, targetField.wrap, addBtn);
  container.appendChild(addRow);
}

// ── Reset / Submit ───────────────────────────────────────────────────────────
// Clears only today's readings — equipment list and target temps are
// untouched, same "reset the day, not the setup" split as every other tab.
// Refuses once the day is already submitted — this is the actual compliance
// record, not in-progress scratch state, so it needs a deliberate manager
// reopen (see reopenTempsDay()) rather than being one accidental tap away
// from being silently overwritten with blanks.
function resetTempsDay() {
  if (_tempSubmitted) {
    showStatusMessage('This day is already submitted — tap "🔓 Reopen to Correct" first if you need to change it.', 3500);
    return;
  }
  if (_tempResetUndoTimer) { clearTimeout(_tempResetUndoTimer); _tempResetSnapshot = null; _tempResetUndoTimer = null; }
  _tempResetSnapshot = { ..._tempLog };
  _tempLog = {};
  saveTempLog();
  renderTempsPage();
  showUndoToast('⟳ Readings reset — tap Undo to restore', undoTempsReset);
  _tempResetUndoTimer = setTimeout(() => {
    _tempResetSnapshot = null;
    _tempResetUndoTimer = null;
    hideUndoToast();
  }, 5000);
}

// Manager-gated escape hatch to correct an already-submitted day — flips the
// local submitted flag back off (a subsequent Submit re-saves submitted:true
// with whatever's current) without touching the stored readings until then.
function reopenTempsDay() {
  requireManager(() => {
    _tempSubmitted = false;
    renderTempsPage();
  });
}

function undoTempsReset() {
  if (!_tempResetSnapshot) return;
  clearTimeout(_tempResetUndoTimer);
  _tempLog = _tempResetSnapshot;
  _tempResetSnapshot = null;
  _tempResetUndoTimer = null;
  saveTempLog();
  renderTempsPage();
  hideUndoToast();
}

// Submitting with missing readings doesn't hard-block — just asks once,
// batched across every missing piece of equipment rather than one at a time,
// so a manager can deliberately skip an out-of-service unit without
// stepping through each item individually.
function submitTempsDay() {
  const missing = tempEquipment.filter(eq => _tempLog[eq.id] === undefined || _tempLog[eq.id] === null || _tempLog[eq.id] === '');
  if (missing.length && !_submitTempsConfirmSkip) {
    _submitTempsConfirmSkip = true;
    showStatusMessage(`⚠ No reading for ${missing.map(m => m.label).join(', ')} — tap Submit again to record anyway.`, 5000);
    setTimeout(() => { _submitTempsConfirmSkip = false; }, 5000);
    return;
  }
  _submitTempsConfirmSkip = false;
  const date = _workingTempDate || todayStr();
  const submittedReadings = { ..._tempLog };
  window._setDoc(window.getStoreTempLogRef(date), {
    readings: submittedReadings, submitted: true, submittedAt: Date.now(), updatedAt: Date.now()
  }, { merge: true }).then(() => {
    showStatusMessage('✓ Temperatures submitted', 2500);
    // Clears the in-memory/on-screen values only — deliberately NOT persisted
    // via saveTempLog(): that write's own {merge:true} still fully replaces
    // the `readings` field (merge is per top-level field, not deep), so
    // saving this cleared state would immediately overwrite the readings
    // doc write above just sent with an empty object. The just-submitted
    // day's record stays intact in Firestore; a reload re-shows it correctly.
    _tempLog = {};
    _tempSubmitted = true;
    renderTempsPage();
  }).catch(e => {
    console.error('Temp submit error:', e);
    showStatusMessage('⚠ Could not submit — check your connection', 3000);
  });
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderTempsPage() {
  const content = document.getElementById('tempsContent');
  if (!content) return;
  if (!_workingTempDate) {
    loadTempsForDate(todayStr()); // async — re-renders once the log loads
    return;
  }
  if (typeof _applyNewPagesTheme === 'function') _applyNewPagesTheme((_storeSettings && _storeSettings.theme) || 'dark');
  content.innerHTML = '';

  const dateBar = document.createElement('div');
  dateBar.id = 'tempsDatePicker';
  dateBar.style.marginBottom = '14px';
  content.appendChild(dateBar);
  _renderTempsDatePicker();

  if (_tempSubmitted) {
    const note = document.createElement('div');
    note.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:8px;background:rgba(34,160,90,0.12);border:1px solid #22a05a;color:#22a05a;font-size:12px;font-weight:700;margin-bottom:14px;';
    const label = document.createElement('span');
    label.textContent = "✓ This day's readings were already submitted.";
    const reopenBtn = document.createElement('button');
    reopenBtn.className = 'btn';
    reopenBtn.style.cssText = 'font-size:11px;padding:6px 10px;';
    reopenBtn.textContent = '🔓 Reopen to Correct';
    reopenBtn.onclick = () => reopenTempsDay();
    note.append(label, reopenBtn);
    content.appendChild(note);
  }

  // ── Manage Equipment (manager-gated: add new equipment only) ─────────────
  const manageSection = _settingsSection('Manage Equipment');
  const canManage = _managerUnlocked || userHasRole(ROLES.CORPORATE_ADMIN);
  if (canManage) {
    _buildTempEquipmentManager(manageSection);
  } else {
    const lockNote = document.createElement('div');
    lockNote.className = 'settings-note';
    lockNote.style.cssText = 'cursor:pointer;';
    lockNote.textContent = '🔒 Manager PIN required to add equipment — tap to unlock.';
    lockNote.onclick = () => requireManager(renderTempsPage);
    manageSection.appendChild(lockNote);
  }
  content.appendChild(manageSection);

  // ── Equipment (single list, open to everyone — was two separate lists of
  // the same equipment before: this one and Manage Equipment's own listing
  // above, both showing every piece with overlapping controls) ────────────
  // Columns left to right: Name, Location, Target Temp, Current Temp (entry),
  // Delete. Location/Target Temp are read-only here — set at creation above,
  // edited afterward from the Admin tab (js/settings.js), not inline here.
  const equipmentSection = _settingsSection(`Equipment · ${tempEquipment.length}`);
  if (!tempEquipment.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-note';
    empty.textContent = 'No equipment set up yet — a manager needs to add some above first.';
    equipmentSection.appendChild(empty);
  }
  tempEquipment.forEach(eq => {
    const row = document.createElement('div');
    row.className = 'settings-card';
    row.style.cssText += 'margin-bottom:8px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:13px;font-weight:700;flex:1;min-width:120px;';
    nameEl.textContent = eq.label;
    row.appendChild(nameEl);

    const locationEl = document.createElement('div');
    locationEl.style.cssText = 'font-size:12px;color:var(--text-muted);min-width:90px;';
    locationEl.textContent = eq.location ? eq.location : '—';
    row.appendChild(locationEl);

    const targetEl = document.createElement('div');
    targetEl.style.cssText = 'font-size:12px;color:var(--text-muted);min-width:80px;';
    targetEl.textContent = `Target: ${eq.targetTemp}°F`;
    row.appendChild(targetEl);

    const currentVal = _tempLog[eq.id];
    const currentField = _settingsInput('Current °F', currentVal === undefined || currentVal === null ? '' : currentVal, 'number');
    currentField.wrap.style.width = '110px';
    if (_tempSubmitted) {
      // Locked once submitted — this doc is the historical record now, not
      // in-progress scratch state. reopenTempsDay() (manager-gated) is the
      // deliberate way back in to correct it.
      currentField.input.disabled = true;
    } else {
      currentField.input.onchange = () => {
        const raw = currentField.input.value;
        _tempLog[eq.id] = raw === '' ? null : parseFloat(raw);
        saveTempLog();
      };
    }
    row.appendChild(currentField.wrap);

    if (canManage) {
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '🗑';
      removeBtn.title = 'Remove equipment';
      removeBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);font-size:15px;cursor:pointer;padding:4px 6px;';
      removeBtn.onclick = () => _removeTempEquipment(eq.id);
      row.appendChild(removeBtn);
    }

    equipmentSection.appendChild(row);
  });
  content.appendChild(equipmentSection);

  // ── Reset / Submit (hidden once submitted — see the Reopen button above) ──
  if (tempEquipment.length && !_tempSubmitted) {
    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = 'display:flex;gap:8px;margin-top:6px;';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn';
    resetBtn.style.cssText = 'background:#8a1f1f;border-color:#d72627;color:#fff;';
    resetBtn.textContent = '⟲ Reset';
    resetBtn.onclick = () => resetTempsDay();
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-green';
    submitBtn.textContent = '✓ Submit Readings';
    submitBtn.onclick = () => submitTempsDay();
    actionsRow.append(resetBtn, submitBtn);
    content.appendChild(actionsRow);
  }
}
