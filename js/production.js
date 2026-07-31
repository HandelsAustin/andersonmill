// Production run state, table rendering, run mode, run prep/catering, print, run summary.
// Extracted from index.html — no logic changes.

let roster = [];        // full list (MASTER_ROSTER + any user-added)
let activeFlavors = []; // flavors on today's list
let runMode = false;
let _storeEvents = [];  // recent activity log for current store (max 10, from storeEvents field)
let _storeDoc    = null; // raw store doc data from last Firestore load (for manager dashboard fallbacks)
let _lastSyncAt  = null; // timestamp of last successful cloud sync (saved or loaded)
let _wasOffline  = false; // tracks previous connectivity state for reconnect detection
let _resetSnapshot  = null; // activeFlavors snapshot before resetDay() — enables 5s undo
let _resetUndoTimer = null;
let _doneRunPending = false; // double-tap guard: first tap of Done mid-run shows warning
let _doneRunTimer   = null;
let _runDurationMs  = 0;    // duration of last completed run in ms (captured at summary time)
let _cateringItems     = []; // [{name, buckets}] — user-added catering entries; persist across recalculations
let _cateringDismissed = []; // [{name, index, action}] — completed/skipped catering buckets; cleared on run end

// ── CATEGORY SORT ──────────────────────────────────────────────────────────
// Converts a category string to a numeric-sortable value.
// Pure-numeric categories sort numerically; alphanumeric sort lexically after.
function buildRow(f, runIndex, runTotal) {
  const idx = activeFlavors.findIndex(x => x.name === f.name);
  const tr = document.createElement('tr');
  const tm = toMake(f);
  const color = typeColor(f.type);

  // Flavor name — colored by type, with full name as tooltip
  const tdName = document.createElement('td');
  tdName.style.cssText = 'font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  tdName.title = f.name;
  const sp = document.createElement('span');
  sp.className = flavorClass(f);
  sp.textContent = f.name;
  tdName.appendChild(sp);
  if (_cabinetSortEnabled && f.cabinet) {
    const badge = document.createElement('span');
    badge.className = 'cabinet-badge';
    badge.textContent = 'C' + f.cabinet;
    tdName.appendChild(badge);
  }
  tr.appendChild(tdName);

  // Category — only shown in run mode
  const tdCat = document.createElement('td');
  tdCat.style.cssText = 'font-size:12px;color:#8fa3be;' + (runMode ? '' : 'display:none;');
  tdCat.textContent = f.category || '—';
  tr.appendChild(tdCat);

  // Type badge — colored by type
  const tdType = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = 'type-badge';
  badge.style.color = color;
  badge.textContent = f.type || '—';
  tdType.appendChild(badge);
  tr.appendChild(tdType);

  if (runMode) {
    // Run mode: completed rows stay visible, muted; incomplete rows show checkboxes + skip
    const doneCount      = runDismissed.filter(d => d.name === f.name).length;
    const cateringTotal  = _cateringItems.filter(c => c.name === f.name).reduce((s, c) => s + c.buckets, 0);
    const cateringDone   = _cateringDismissed.filter(d => d.name === f.name).length;
    const isFullyDone    = doneCount >= tm && cateringDone >= cateringTotal;

    if (isFullyDone) {
      tr.style.opacity    = '0.5';
      tr.style.borderLeft = '3px solid #22a05a';
      sp.style.textDecoration = 'line-through';
    }

    const tdBoxes = document.createElement('td');
    tdBoxes.style.cssText = 'text-align:center;';

    if (isFullyDone) {
      const wasSkipped    = runDismissed.some(d => d.name === f.name && d.action === 'skip');
      const wasSkippedCat = _cateringDismissed.some(d => d.name === f.name && d.action === 'skip');
      const madeCount     = runDismissed.filter(d => d.name === f.name && d.action === 'made').length;
      const catMadeCount  = _cateringDismissed.filter(d => d.name === f.name && d.action === 'made').length;
      const completedWrap = document.createElement('div');
      completedWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;';
      if (tm > 0) {
        const statusLabel = document.createElement('span');
        statusLabel.textContent = wasSkipped ? '— Skipped' : `✓ ${madeCount} made`;
        statusLabel.style.cssText = wasSkipped
          ? 'font-size:12px;color:#8fa3be;font-family:\'Arial Narrow\',Arial,sans-serif;letter-spacing:0.04em;'
          : 'font-size:12px;color:#22a05a;font-family:\'Arial Narrow\',Arial,sans-serif;letter-spacing:0.04em;font-weight:600;';
        completedWrap.appendChild(statusLabel);
      }
      if (cateringTotal > 0) {
        const catLabel = document.createElement('span');
        catLabel.textContent = wasSkippedCat ? '— Catering skipped' : `🍨 ${catMadeCount} catering`;
        catLabel.style.cssText = 'font-size:12px;color:#f0a500;font-family:\'Arial Narrow\',Arial,sans-serif;letter-spacing:0.04em;font-weight:600;';
        completedWrap.appendChild(catLabel);
      }
      const undoBtn = document.createElement('button');
      undoBtn.textContent = 'Undo';
      undoBtn.style.cssText = 'background:none;border:1px solid #4a6a8a;color:#8fa3be;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;font-size:11px;font-weight:700;padding:5px 10px;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:0.04em;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:36px;';
      undoBtn.onclick = () => undoRunRow(f.name);
      completedWrap.appendChild(undoBtn);
      tdBoxes.appendChild(completedWrap);
    } else {
      const boxWrap = document.createElement('div');
      boxWrap.style.cssText = 'display:flex;gap:8px;justify-content:center;align-items:flex-end;flex-wrap:wrap;';
      // Daily production checkboxes
      for (let i = 1; i <= tm; i++) {
        const alreadyDone = runDismissed.find(d => d.name === f.name && d.index === i);
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!alreadyDone;
        cb.disabled = !!alreadyDone;
        cb.style.cssText = 'width:36px;height:36px;cursor:pointer;accent-color:#22a05a;';
        if (!alreadyDone) {
          cb.addEventListener('change', () => {
            if (!cb.checked) return;
            cb.disabled = true;
            dismissRunRow(f.name, i, 'made');
          });
        }
        boxWrap.appendChild(cb);
      }
      // Catering checkboxes — visually distinct with 🍨 badge + amber accent
      if (cateringTotal > 0) {
        if (tm > 0) {
          const sep = document.createElement('div');
          sep.style.cssText = 'width:1px;height:30px;background:#3a4a70;flex-shrink:0;align-self:center;margin:0 2px;';
          boxWrap.appendChild(sep);
        }
        for (let i = 1; i <= cateringTotal; i++) {
          const alreadyDone = _cateringDismissed.find(d => d.name === f.name && d.index === i);
          const cbWrap = document.createElement('div');
          cbWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
          const badge = document.createElement('span');
          badge.textContent = '🍨';
          badge.style.cssText = 'font-size:11px;line-height:1;';
          badge.title = 'Catering bucket';
          cbWrap.appendChild(badge);
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!alreadyDone;
          cb.disabled = !!alreadyDone;
          cb.style.cssText = 'width:36px;height:36px;cursor:pointer;accent-color:#f0a500;';
          cb.title = 'Catering bucket';
          if (!alreadyDone) {
            cb.addEventListener('change', () => {
              if (!cb.checked) return;
              cb.disabled = true;
              _dismissCateringRow(f.name, i, 'made');
            });
          }
          cbWrap.appendChild(cb);
          boxWrap.appendChild(cbWrap);
        }
      }
      tdBoxes.appendChild(boxWrap);
    }
    tr.appendChild(tdBoxes);

    const tdActions = document.createElement('td');
    tdActions.style.cssText = 'text-align:right;white-space:nowrap;';
    if (!isFullyDone) {
      const skipBtn = document.createElement('button');
      skipBtn.textContent = 'Skip';
      skipBtn.style.cssText = 'background:#d72627;border:1.5px solid #d72627;color:#ffffff;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;font-size:13px;font-weight:700;padding:8px 16px;border-radius:7px;cursor:pointer;min-height:44px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;text-transform:uppercase;letter-spacing:0.04em;';
      skipBtn.onclick = () => dismissRunRow(f.name, null, 'skip');
      tdActions.appendChild(skipBtn);
    }
    tr.appendChild(tdActions);
  } else {
    // Normal mode: dropdowns + To Make
    const TARGET_OPTIONS = [
      {label:'—',value:0},{label:'1',value:1},{label:'2',value:2},{label:'3',value:3},
      {label:'4',value:4},{label:'5',value:5},{label:'6',value:6},{label:'7',value:7},
      {label:'8',value:8},{label:'9',value:9},{label:'10',value:10},
    ];
    const tdTarget = document.createElement('td');
    tdTarget.style.cssText = 'text-align:center;';
    if (_managerUnlocked) {
      tdTarget.appendChild(makeSelect(TARGET_OPTIONS, f.target, val => { activeFlavors[idx].target = val; saveAll(); renderTable(); }));
    } else {
      const tval = document.createElement('span');
      tval.textContent = f.target || '—';
      tval.style.cssText = 'font-size:13px;color:#8fa3be;cursor:pointer;';
      tval.title = 'Manager access required';
      tval.addEventListener('click', () => requireManager(() => renderTable()));
      tdTarget.appendChild(tval);
    }
    tr.appendChild(tdTarget);

    const tdDip = document.createElement('td');
    tdDip.style.cssText = 'padding:6px 2px;';
    tdDip.appendChild(makeSelect(DIPPING_OPTIONS, f.dipping, val => { activeFlavors[idx].dipping = val; saveAll(); renderTable(); }));
    tr.appendChild(tdDip);

    const tdHold = document.createElement('td');
    tdHold.style.cssText = 'text-align:center;white-space:nowrap;';
    const holdWrap = document.createElement('div');
    holdWrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';

    const holdMinus = document.createElement('button');
    holdMinus.textContent = '−';
    holdMinus.style.cssText = 'width:44px;height:44px;font-size:20px;font-weight:700;background:#12223a;border:1.5px solid #2e4a70;border-radius:6px;color:#c5d8f0;cursor:pointer;touch-action:manipulation;line-height:1;padding:0;-webkit-tap-highlight-color:transparent;';

    const holdVal = document.createElement('span');
    holdVal.textContent = parseInt(f.holding) || 0;
    holdVal.style.cssText = 'min-width:28px;text-align:center;font-size:15px;font-weight:600;color:#f5f0e8;cursor:pointer;user-select:none;';
    holdVal.title = 'Tap to enter value';

    const holdPlus = document.createElement('button');
    holdPlus.textContent = '+';
    holdPlus.style.cssText = 'width:44px;height:44px;font-size:20px;font-weight:700;background:#12223a;border:1.5px solid #2e4a70;border-radius:6px;color:#c5d8f0;cursor:pointer;touch-action:manipulation;line-height:1;padding:0;-webkit-tap-highlight-color:transparent;';

    // Rapid-fire long-press: increments immediately on press, accelerates on hold, saves once on release
    const _attachRapidPress = (btn, delta) => {
      let timerId = null, delay = 400, pressing = false;
      const tick = () => {
        if (!pressing) return;
        const cur = parseInt(activeFlavors[idx].holding) || 0;
        const next = Math.min(99, Math.max(0, cur + delta));
        activeFlavors[idx].holding = next;
        holdVal.textContent = next;
        delay = Math.max(60, delay * 0.85);
        timerId = setTimeout(tick, delay);
      };
      const start = (e) => {
        e.preventDefault();
        pressing = true;
        delay = 400;
        const cur = parseInt(activeFlavors[idx].holding) || 0;
        const next = Math.min(99, Math.max(0, cur + delta));
        activeFlavors[idx].holding = next;
        holdVal.textContent = next;
        timerId = setTimeout(tick, delay);
      };
      const stop = () => {
        if (!pressing) return;
        pressing = false;
        clearTimeout(timerId);
        saveAll(); renderTable();
      };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup',   stop);
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('pointerleave', stop);
    };
    _attachRapidPress(holdMinus, -1);
    _attachRapidPress(holdPlus, +1);

    // Tap-to-type: click the value display to enter a number directly
    holdVal.addEventListener('click', () => {
      let settled = false;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.inputMode = 'numeric';
      inp.pattern = '[0-9]*';
      inp.value = parseInt(activeFlavors[idx].holding) || 0;
      inp.style.cssText = 'width:52px;font-size:15px;font-weight:600;text-align:center;background:#12223a;border:1.5px solid #98d4e3;border-radius:6px;color:#f5f0e8;padding:4px 2px;';
      holdWrap.replaceChild(inp, holdVal);
      inp.focus();
      inp.select();
      const commit = () => {
        if (settled) return;
        settled = true;
        const val = Math.max(0, parseInt(inp.value) || 0);
        activeFlavors[idx].holding = val;
        holdWrap.replaceChild(holdVal, inp);
        holdVal.textContent = val;
        saveAll(); renderTable();
      };
      inp.addEventListener('blur', commit);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { inp.blur(); }
        if (e.key === 'Escape') {
          if (settled) return;
          settled = true;
          holdWrap.replaceChild(holdVal, inp);
        }
      });
    });

    holdWrap.appendChild(holdMinus);
    holdWrap.appendChild(holdVal);
    holdWrap.appendChild(holdPlus);
    tdHold.appendChild(holdWrap);
    tr.appendChild(tdHold);

    const tdTM = document.createElement('td');
    tdTM.className = 'to-make ' + (tm > 0 ? 'to-make-needed' : 'to-make-ok');
    tdTM.textContent = tm > 0 ? tm : '✓';
    tr.appendChild(tdTM);
  }

  return tr;
}

// ── Date recall ──────────────────────────────────────────────────────────────
// "Which day's Ice Cream Run am I looking at" control — defaults to today,
// lets a manager pull up a past date's run and keep checking it off normally.
function _renderRunDatePicker() {
  const container = document.getElementById('runDatePicker');
  if (!container) return;
  const isToday = _workingRunDate === todayStr();
  container.style.position = 'relative';
  container.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.cssText = 'font-size:12px;padding:8px 12px;';
  btn.textContent = `📅 ${isToday ? 'Today' : _workingRunDate} ▾`;
  btn.onclick = e => { e.stopPropagation(); _toggleRunDateMenu(); };
  container.appendChild(btn);

  if (!isToday) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.style.cssText = 'font-size:12px;padding:8px 12px;margin-left:6px;';
    backBtn.textContent = '↩ Back to Today';
    backBtn.onclick = () => loadRunForDate(todayStr());
    container.appendChild(backBtn);
  }

  const menu = document.createElement('div');
  menu.id = 'runDateMenu';
  menu.style.cssText = 'display:none;position:absolute;top:110%;left:0;background:#1a2744;border:1.5px solid #2e4a70;border-radius:8px;overflow:hidden;z-index:200;min-width:200px;max-height:280px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
  container.appendChild(menu);
}

async function _toggleRunDateMenu() {
  const menu = document.getElementById('runDateMenu');
  if (!menu) return;
  if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
  menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">Loading…</div>';
  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', () => { menu.style.display = 'none'; }, { once: true }), 0);

  const dates = await listRecentRunDates();
  menu.innerHTML = '';
  if (!dates.length) {
    menu.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#8fa3be;">No saved runs yet.</div>';
    return;
  }
  dates.forEach(d => {
    const row = document.createElement('button');
    row.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;border-bottom:1px solid #2e4a70;color:#c5d8f0;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;font-size:13px;cursor:pointer;';
    row.textContent = d === todayStr() ? `${d} (Today)` : d;
    row.onclick = () => { loadRunForDate(d); menu.style.display = 'none'; };
    menu.appendChild(row);
  });
}

function renderTable() {
  // Guard: don't interrupt an active tap-to-type holding edit.
  // applyData() already ran, so Firestore state is current — re-render deferred until commit.
  if (document.querySelector('#mainTbody input[inputmode="numeric"]')) return;

  const tbody = document.getElementById('mainTbody');
  tbody.innerHTML = '';

  // Show/hide column headers for run mode
  const thCategory = document.getElementById('thCategory');
  const thTarget  = document.getElementById('thTarget');
  const thDipping = document.getElementById('thDipping');
  const thHolding = document.getElementById('thHolding');
  const thToMake  = document.getElementById('thToMake');
  const thBucket  = document.getElementById('thBucket');
  const thActions = document.getElementById('thActions');
  if (runMode) {
    thCategory.style.display = '';
    thTarget.style.display  = 'none';
    thDipping.style.display = 'none';
    thHolding.style.display = 'none';
    thToMake.style.display  = 'none';
    thBucket.style.display  = '';
    thActions.style.display = '';
  } else {
    thCategory.style.display = 'none';
    thTarget.style.display  = '';
    thDipping.style.display = '';
    thHolding.style.display = '';
    thToMake.style.display  = '';
    thBucket.style.display  = 'none';
    thActions.style.display = 'none';
  }

  // In run mode: include daily production flavors + catering-only flavors
  let list;
  if (runMode) {
    const dailyFlavors    = activeFlavors.filter(f => toMake(f) > 0);
    const dailyNames      = new Set(dailyFlavors.map(f => f.name));
    const cateringOnly    = activeFlavors.filter(f =>
      !dailyNames.has(f.name) && _cateringItems.some(c => c.name === f.name)
    );
    list = [...dailyFlavors, ...cateringOnly];
  } else {
    list = activeFlavors;
  }
  const sorted = getSorted(list);
  if (!sorted.length) {
    if (runMode) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">🎉 Nothing to make — all flavors are fully stocked!</td></tr>';
    } else if (userCanManage() || _managerUnlocked) {
      // Manager/admin empty state: give a clear first action
      tbody.innerHTML = `<tr><td colspan="7"><div style="text-align:center;padding:2.5rem 1rem;">
        <div style="font-size:26px;margin-bottom:12px;">🧁</div>
        <div style="font-size:15px;font-weight:700;color:#ffffff;margin-bottom:8px;">Set up today's flavors</div>
        <div style="font-size:13px;color:#98d4e3;line-height:1.6;margin-bottom:18px;font-family:'Arial Narrow',Arial,sans-serif;">
          Tap <strong style="color:#ffffff;">&#9776; Edit Flavors</strong> to select which flavors you're running today.
        </div>
        <button class="btn" onclick="requireManager(openAddModal)" style="font-size:14px;padding:12px 22px;">&#9776; Set Up Today's Flavors</button>
      </div></td></tr>`;
    } else {
      // Employee empty state: explain they need a manager
      tbody.innerHTML = `<tr><td colspan="7"><div style="text-align:center;padding:2.5rem 1rem;color:#98d4e3;">
        <div style="font-size:13px;font-family:'Arial Narrow',Arial,sans-serif;line-height:1.8;">
          No flavors on today's list.<br>
          Ask a manager to set up this store's flavor list.
        </div>
      </div></td></tr>`;
    }
    return;
  }
  if (runMode) {
    sorted.forEach(f => tbody.appendChild(buildRow(f, null, null)));
  } else {
    sorted.forEach(f => tbody.appendChild(buildRow(f)));
  }
}

function removeFromActive(idx) {
  if (idx < 0) return;
  activeFlavors.splice(idx, 1);
  saveAll(); renderTable();
}

// ── RUN MODE ───────────────────────────────────────────────────────────────
let runDismissed = []; // tracks {name, index} pairs dismissed during run
// Manager mode
let _runTimerInterval = null;
let _runStartTime = null;
let _totalBucketsMade = 0;

function dismissRunRow(name, index, action) {
  if (action === 'made') {
    runDismissed.push({ name, index, action: 'made' });
    _totalBucketsMade++;
    const idx = activeFlavors.findIndex(f => f.name === name);
    if (idx >= 0) {
      activeFlavors[idx].made = (activeFlavors[idx].made || 0) + 1;
      saveAll();
    }
    const flavorIdx = activeFlavors.findIndex(f => f.name === name);
    const tm = flavorIdx >= 0 ? toMake(activeFlavors[flavorIdx]) : 0;
    const doneCount = runDismissed.filter(d => d.name === name).length;
    if (doneCount >= tm) {
      renderTable(); // transition row to muted/completed state
      checkRunComplete();
    }
  } else if (action === 'skip') {
    const idx = activeFlavors.findIndex(f => f.name === name);
    const tm = idx >= 0 ? toMake(activeFlavors[idx]) : 0;
    for (let i = 1; i <= tm; i++) {
      if (!runDismissed.find(d => d.name === name && d.index === i)) {
        runDismissed.push({ name, index: i, action: 'skip' });
      }
    }
    // Skip catering for this flavor too — "Skip" means skip everything for the flavor
    const cateringTotal = _cateringItems.filter(c => c.name === name).reduce((s, c) => s + c.buckets, 0);
    for (let i = 1; i <= cateringTotal; i++) {
      if (!_cateringDismissed.find(d => d.name === name && d.index === i)) {
        _cateringDismissed.push({ name, index: i, action: 'skip' });
      }
    }
    renderTable();
    checkRunComplete();
  }
  if (runMode) {
    try { localStorage.setItem('car_run_state', JSON.stringify({ made: _totalBucketsMade, at: Date.now(), catering: _cateringItems })); } catch(e) {}
  }
}

function undoRunRow(name) {
  const entries    = runDismissed.filter(d => d.name === name);
  const catEntries = _cateringDismissed.filter(d => d.name === name);
  if (!entries.length && !catEntries.length) return;
  const madeCount = entries.filter(d => d.action === 'made').length;
  runDismissed        = runDismissed.filter(d => d.name !== name);
  _cateringDismissed  = _cateringDismissed.filter(d => d.name !== name);
  _totalBucketsMade   = Math.max(0, _totalBucketsMade - madeCount);
  const idx = activeFlavors.findIndex(f => f.name === name);
  if (idx >= 0 && madeCount > 0) {
    activeFlavors[idx].made = Math.max(0, (activeFlavors[idx].made || 0) - madeCount);
    saveAll();
  }
  try { localStorage.setItem('car_run_state', JSON.stringify({ made: _totalBucketsMade, at: Date.now(), catering: _cateringItems })); } catch(e) {}
  renderTable();
}

function calculateRun() {
  const needed = activeFlavors.filter(f => toMake(f) > 0);
  if (!needed.length && !_cateringItems.length) {
    showStatusMessage('✓ All flavors fully stocked — no production needed.', 3500);
    return;
  }
  showRunPrepOverlay(needed);
}

// ── RUN PREPARATION ─────────────────────────────────────────────────────────
function showRunPrepOverlay(needed) {
  const box = document.getElementById('runPrepBox');
  if (!box) return;
  _renderRunPrepContent(box, needed);
  document.getElementById('runPrepOverlay').classList.add('open');
}

function closeRunPrepOverlay() {
  document.getElementById('runPrepOverlay').classList.remove('open');
}

function _renderRunPrepContent(container, dailyNeeded) {
  container.innerHTML = '';
  const dailyTotal    = dailyNeeded.reduce((s, f) => s + toMake(f), 0);
  const cateringTotal = _cateringItems.reduce((s, c) => s + c.buckets, 0);

  // ── Scrollable body (title + chips + entries + add form) ─────────────────
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:20px 20px 4px;';

  const title = document.createElement('h2');
  title.style.cssText = 'font-family:\'Raiders\',\'Impact\',sans-serif;font-size:18px;color:#ffffff;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.04em;';
  title.textContent = "Today's Run";
  body.appendChild(title);

  // Summary chips
  const summary = document.createElement('div');
  summary.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;';
  [
    { label: 'Daily Production', value: dailyTotal + ' bkt' + (dailyTotal !== 1 ? 's' : ''), color: '#ffffff' },
    { label: 'Catering',         value: cateringTotal + ' bkt' + (cateringTotal !== 1 ? 's' : ''), color: cateringTotal > 0 ? '#f0a500' : '#5a7a9a' },
  ].forEach(({ label, value, color }) => {
    const chip = document.createElement('div');
    chip.style.cssText = 'background:#162053;border:1px solid #2e4a70;border-radius:8px;padding:10px 8px;text-align:center;';
    chip.innerHTML = `<div style="font-size:17px;font-weight:700;color:${color};line-height:1;">${value}</div><div style="font-size:10px;color:#98d4e3;text-transform:uppercase;letter-spacing:0.08em;font-family:'Arial Narrow',Arial,sans-serif;margin-top:3px;">${label}</div>`;
    summary.appendChild(chip);
  });
  body.appendChild(summary);

  // Existing catering entries
  if (_cateringItems.length) {
    const cList = document.createElement('div');
    cList.style.cssText = 'margin-bottom:10px;display:grid;gap:5px;';
    _cateringItems.forEach((c, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(240,165,0,0.07);border:1px solid rgba(240,165,0,0.3);border-radius:7px;';
      row.innerHTML = `<span style="font-size:10px;color:#f0a500;font-weight:700;font-family:'Arial Narrow',Arial,sans-serif;letter-spacing:0.06em;flex-shrink:0;">🍨</span><span style="flex:1;font-size:13px;color:#ffffff;padding:0 4px;">${c.name}</span><span style="font-size:13px;font-weight:700;color:#f0a500;white-space:nowrap;">${c.buckets} bkt${c.buckets !== 1 ? 's' : ''}</span><button onclick="removeCateringEntry(${i})" style="background:none;border:none;color:#8fa3be;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1;touch-action:manipulation;min-width:28px;min-height:28px;" title="Remove">×</button>`;
      cList.appendChild(row);
    });
    body.appendChild(cList);
  }

  // Add catering form — two-line layout so nothing overflows on any screen width
  const addSection = document.createElement('div');
  addSection.style.cssText = 'border:1px dashed rgba(240,165,0,0.3);border-radius:8px;padding:10px;display:grid;gap:7px;';
  const addLabel = document.createElement('div');
  addLabel.style.cssText = 'font-size:10px;color:#f0a500;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;font-family:\'Arial Narrow\',Arial,sans-serif;';
  addLabel.textContent = 'Add Catering Buckets';
  addSection.appendChild(addLabel);

  // Line 1: flavor selector (full width)
  const flavorSel = document.createElement('select');
  flavorSel.id = 'cateringFlavorSelect';
  flavorSel.style.cssText = 'width:100%;padding:7px 6px;font-size:13px;border:1px solid #98d4e3;border-radius:6px;background:#2c3691;color:#ffffff;min-height:38px;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;';
  const defOpt = document.createElement('option');
  defOpt.value = ''; defOpt.textContent = 'Select flavor…'; defOpt.disabled = true; defOpt.selected = true;
  flavorSel.appendChild(defOpt);
  getSorted([...activeFlavors]).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.name; opt.textContent = f.name;
    flavorSel.appendChild(opt);
  });
  addSection.appendChild(flavorSel);

  // Line 2: qty input + Add button
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:7px;align-items:center;';

  const qtyInput = document.createElement('input');
  qtyInput.id = 'cateringQtyInput';
  qtyInput.type = 'number'; qtyInput.min = '1'; qtyInput.max = '20'; qtyInput.value = '1';
  qtyInput.style.cssText = 'width:64px;flex-shrink:0;padding:7px 4px;font-size:14px;font-weight:700;border:1px solid #98d4e3;border-radius:6px;background:#2c3691;color:#ffffff;text-align:center;min-height:38px;';
  addRow.appendChild(qtyInput);

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add Catering Bucket';
  addBtn.style.cssText = 'flex:1;padding:7px 10px;font-size:12px;font-weight:700;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;background:rgba(240,165,0,0.12);border:1.5px solid #f0a500;border-radius:6px;color:#f0a500;cursor:pointer;text-transform:uppercase;letter-spacing:0.04em;touch-action:manipulation;min-height:38px;';
  addBtn.onclick = () => {
    const name = document.getElementById('cateringFlavorSelect')?.value;
    const qty  = Math.max(1, Math.min(20, parseInt(document.getElementById('cateringQtyInput')?.value) || 1));
    if (!name) return;
    addCateringEntry(name, qty);
  };
  addRow.appendChild(addBtn);
  addSection.appendChild(addRow);
  body.appendChild(addSection);
  container.appendChild(body);

  // ── Fixed footer — always visible at bottom ──────────────────────────────
  const footer = document.createElement('div');
  footer.style.cssText = 'flex-shrink:0;padding:12px 20px 20px;border-top:1px solid #2e4a70;display:grid;gap:8px;';

  const total = dailyTotal + cateringTotal;
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-green';
  startBtn.style.cssText = 'width:100%;justify-content:center;font-size:14px;padding:13px;min-height:46px;';
  startBtn.textContent = `Start Production Run — ${total} bucket${total !== 1 ? 's' : ''}`;
  startBtn.onclick = () => _startProductionRun(dailyNeeded);
  footer.appendChild(startBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.style.cssText = 'width:100%;justify-content:center;font-size:13px;border-color:#2e4a70;color:#8fa3be;min-height:38px;padding:8px;';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => closeRunPrepOverlay();
  footer.appendChild(cancelBtn);

  container.appendChild(footer);
}

function addCateringEntry(name, buckets) {
  _cateringItems.push({ name, buckets });
  _renderRunPrepContent(document.getElementById('runPrepBox'), activeFlavors.filter(f => toMake(f) > 0));
}

function removeCateringEntry(index) {
  _cateringItems.splice(index, 1);
  _renderRunPrepContent(document.getElementById('runPrepBox'), activeFlavors.filter(f => toMake(f) > 0));
}

function _startProductionRun(dailyNeeded) {
  closeRunPrepOverlay();
  runMode = true;
  try { localStorage.setItem('car_run_state', JSON.stringify({ made: 0, at: Date.now(), catering: _cateringItems })); } catch(e) {}

  const dailyTotal    = dailyNeeded.reduce((s, f) => s + toMake(f), 0);
  const cateringTotal = _cateringItems.reduce((s, c) => s + c.buckets, 0);
  const total         = dailyTotal + cateringTotal;
  const bannerMsg     = document.getElementById('runBannerMsg');
  bannerMsg.innerHTML =
    `<span style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.2;">${total} bucket${total !== 1 ? 's' : ''}</span>` +
    `<span style="font-size:11px;color:#98d4e3;display:block;margin-top:2px;font-family:'Arial Narrow',Arial,sans-serif;">${dailyNeeded.length} flavor${dailyNeeded.length !== 1 ? 's' : ''} · category order${cateringTotal > 0 ? ' · ' + cateringTotal + ' catering' : ''}</span>`;

  document.getElementById('runBanner').style.display = 'flex';
  renderTable();
  showVariegateModal(dailyNeeded);
}

function _dismissCateringRow(name, index, action) {
  if (action === 'made') {
    _cateringDismissed.push({ name, index, action: 'made' });
    const cateringTotal = _cateringItems.filter(c => c.name === name).reduce((s, c) => s + c.buckets, 0);
    const cateringDone  = _cateringDismissed.filter(d => d.name === name).length;
    if (cateringDone >= cateringTotal) {
      renderTable();
      checkRunComplete();
    }
  }
  if (runMode) {
    try { localStorage.setItem('car_run_state', JSON.stringify({ made: _totalBucketsMade, at: Date.now(), catering: _cateringItems })); } catch(e) {}
  }
}

function togglePrintMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('printMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  if (menu.style.display === 'block') {
    setTimeout(() => document.addEventListener('click', closePrintMenu, { once: true }), 0);
  }
}

function closePrintMenu() {
  const menu = document.getElementById('printMenu');
  if (menu) menu.style.display = 'none';
}

function printInventory() {
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const sorted = getSorted(activeFlavors);

  const rows = sorted.map(f => {
    const dipping = parseFloat(f.dipping) || 0;
    const holding = parseInt(f.holding) || 0;
    const total   = dipping + holding;
    const cab     = (_cabinetSortEnabled && f.cabinet) ? `C${f.cabinet}` : '—';
    return `<tr>
      <td>${f.name}</td>
      <td style="text-align:center">${cab}</td>
      <td style="text-align:center">${dipping > 0 ? dipping : '—'}</td>
      <td style="text-align:center">${holding > 0 ? holding : '—'}</td>
      <td style="text-align:center;font-weight:bold">${total > 0 ? total : '—'}</td>
    </tr>`;
  }).join('');

  const totalBuckets = sorted.reduce((s, f) => s + (parseFloat(f.dipping) || 0) + (parseInt(f.holding) || 0), 0);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Inventory — ${today}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; color: #000; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0 0 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 6px 8px; border-bottom: 2px solid #d72627; color: #444; }
    td { padding: 7px 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .summary { margin-top: 16px; font-size: 13px; font-weight: bold; text-align: right; }
  </style></head><body>
  <h2>Handel's — Current Inventory</h2>
  <p>${today}</p>
  <table>
    <thead><tr>
      <th>Flavor</th>
      <th style="text-align:center">Cabinet</th>
      <th style="text-align:center">In Dipping</th>
      <th style="text-align:center">Holding</th>
      <th style="text-align:center">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">${sorted.length} flavor${sorted.length !== 1 ? 's' : ''} &nbsp;|&nbsp; ${totalBuckets} bucket${totalBuckets !== 1 ? 's' : ''} on hand</div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) { w.document.write(html); w.document.close(); }
  else { alert('Please allow pop-ups for this page to print.'); }
}

function printRun() {
  const needed = activeFlavors.filter(f => toMake(f) > 0);
  const sorted = getSorted(needed);
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  let rows = [];
  sorted.forEach(f => {
    const tm = toMake(f);
    for (let i = 1; i <= tm; i++) {
      rows.push(`<tr>
        <td>${f.name}</td>
        <td style="text-align:center">${f.category || '—'}</td>
        <td style="text-align:center">${f.type || '—'}</td>
        <td style="text-align:center;color:#999">${tm > 1 ? `${i} of ${tm}` : ''}</td>
      </tr>`);
    }
  });

  const total = sorted.reduce((s, f) => s + toMake(f), 0);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Run Sheet — ${today}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 24px; color: #000; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0 0 16px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 6px 8px; border-bottom: 2px solid #d72627; color: #444; }
    td { padding: 7px 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .summary { margin-top: 16px; font-size: 13px; font-weight: bold; text-align: right; }
  </style></head><body>
  <h2>Handel's — Production Run</h2>
  <p>${today}</p>
  <table>
    <thead><tr>
      <th>Flavor</th>
      <th style="text-align:center">Category</th>
      <th style="text-align:center">Type</th>
      <th style="text-align:center">Bucket</th>
    </tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <div class="summary">${sorted.length} flavor${sorted.length !== 1 ? 's' : ''} &nbsp;|&nbsp; ${total} bucket${total !== 1 ? 's' : ''} total</div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    alert('Please allow pop-ups for this page to print the run sheet.');
  }
}

function doneRun() {
  _doneRunPending = false;
  if (_doneRunTimer) { clearTimeout(_doneRunTimer); _doneRunTimer = null; }
  stopRunTimer();
  runMode = false;
  runDismissed = [];
  _cateringDismissed = [];
  _cateringItems = [];
  localStorage.removeItem('car_run_state');
  document.getElementById('runBanner').style.display = 'none';
  renderTable();
}

// Guards against accidentally exiting a partially-complete run.
// If no buckets have been made, exits freely. If work is in progress,
// requires a second tap within 3 seconds to confirm early exit.
function confirmDoneRun() {
  if (_totalBucketsMade === 0) { doneRun(); return; }
  if (_doneRunPending) {
    clearTimeout(_doneRunTimer);
    _doneRunPending = false;
    _doneRunTimer = null;
    doneRun();
    return;
  }
  _doneRunPending = true;
  const b = _totalBucketsMade;
  showStatusMessage(`Run in progress — ${b} bucket${b !== 1 ? 's' : ''} made. Tap Done again to exit early.`, 3000);
  _doneRunTimer = setTimeout(() => {
    _doneRunPending = false;
    _doneRunTimer = null;
  }, 3000);
}

function clearRunView() {
  stopRunTimer();
  runMode = false;
  runDismissed = [];
  _cateringDismissed = [];
  _cateringItems = [];
  localStorage.removeItem('car_run_state');
  document.getElementById('runBanner').style.display = 'none';
  renderTable();
}

async function resetDay() {
  // "Reset" always means "start today fresh" — if a past date is currently
  // recalled, switch back to today first rather than resetting that history.
  if (_workingRunDate !== todayStr()) {
    await loadRunForDate(todayStr());
  }

  // Commit any pending prior reset before starting a new one
  if (_resetUndoTimer) { clearTimeout(_resetUndoTimer); _resetSnapshot = null; _resetUndoTimer = null; }

  // Snapshot current state so the operator can undo within 5 seconds
  _resetSnapshot = activeFlavors.map(f => ({ ...f }));

  // Apply reset immediately — no confirm() dialog; undo toast is the recovery path
  activeFlavors.forEach(f => { f.dipping = 0; f.holding = 0; });
  runMode = false;
  // Clear stale run state — prevents dismissed entries carrying over to the next run
  runDismissed = [];
  _cateringDismissed = [];
  _cateringItems = [];
  _totalBucketsMade = 0;
  localStorage.removeItem('car_run_state');
  document.getElementById('runBanner').style.display = 'none';
  saveAll(); renderTable();

  // Show undo toast — 5-second recovery window
  showUndoToast('⟳ Day reset — tap Undo to restore', undoResetDay);
  _resetUndoTimer = setTimeout(() => {
    _resetSnapshot = null;
    _resetUndoTimer = null;
    hideUndoToast();
  }, 5000);
}

function undoResetDay() {
  if (!_resetSnapshot) return;
  clearTimeout(_resetUndoTimer);
  activeFlavors = _resetSnapshot;
  _resetSnapshot = null;
  _resetUndoTimer = null;
  saveAll(); renderTable();
  hideUndoToast();
}

// ── MODAL / PICKER ─────────────────────────────────────────────────────────
// ── MANAGER MODE ───────────────────────────────────────────────────────────
function fmtTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2,'0');
  const ss = String(s).padStart(2,'0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function roundToHalf(n) {
  return Math.round(n * 2) / 2;
}

function startRunTimer() {
  _runStartTime = Date.now();
  _totalBucketsMade = 0;
  const el = document.getElementById('runTimerDisplay');
  if (_runTimerInterval) clearInterval(_runTimerInterval);
  _runTimerInterval = setInterval(() => {
    if (el) el.textContent = '⏱ ' + fmtClock(Date.now() - _runStartTime);
  }, 1000);
}

function stopRunTimer() {
  if (_runTimerInterval) { clearInterval(_runTimerInterval); _runTimerInterval = null; }
  const el = document.getElementById('runTimerDisplay');
  if (el) el.textContent = '';
}

function checkRunComplete() {
  if (!runMode) return;
  // Check daily production
  const dailyIncomplete = activeFlavors.some(f => {
    const tm   = toMake(f);
    const done = runDismissed.filter(d => d.name === f.name).length;
    return tm > 0 && done < tm;
  });
  // Check catering (aggregate totals per flavor)
  const cateringByFlavor = {};
  _cateringItems.forEach(c => { cateringByFlavor[c.name] = (cateringByFlavor[c.name] || 0) + c.buckets; });
  const cateringIncomplete = Object.entries(cateringByFlavor).some(([name, total]) =>
    _cateringDismissed.filter(d => d.name === name).length < total
  );
  if (!dailyIncomplete && !cateringIncomplete) showRunSummary();
}

function showRunSummary() {
  stopRunTimer();
  const totalMs   = _runStartTime ? Date.now() - _runStartTime : 0;
  _runDurationMs  = totalMs; // captured for writeRunSummary before doneRun() clears _runStartTime
  const totalMins = totalMs / 60000;
  const buckets   = _totalBucketsMade;
  const avgPerBucket = buckets > 0 ? fmtTime(totalMs / buckets) : '—';
  const bph = totalMins > 0 ? roundToHalf((buckets / totalMins) * 60) : 0;

  const body = document.getElementById('summaryBody');
  body.innerHTML = '';

  // ── Primary metric: Total Buckets Made — visually prominent ──────────────
  const primaryRow = document.createElement('tr');
  const primaryL = document.createElement('td');
  primaryL.style.cssText = 'padding:16px 8px 14px;font-size:13px;color:#22a05a;font-weight:700;border-bottom:1px solid rgba(34,160,90,0.25);';
  primaryL.textContent = 'Total Buckets Made';
  const primaryV = document.createElement('td');
  primaryV.style.cssText = 'padding:16px 8px 14px;text-align:right;font-size:32px;font-weight:700;color:#22a05a;letter-spacing:-0.02em;border-bottom:1px solid rgba(34,160,90,0.25);';
  primaryV.textContent = buckets;
  primaryRow.appendChild(primaryL);
  primaryRow.appendChild(primaryV);
  body.appendChild(primaryRow);

  // Catering row (if any)
  const cateringMadeSummary = _cateringDismissed.filter(d => d.action === 'made').length;
  if (cateringMadeSummary > 0) {
    const catRow = document.createElement('tr');
    const catL   = document.createElement('td');
    catL.style.cssText = 'padding:10px 8px;font-size:13px;color:#f0a500;font-weight:700;';
    catL.textContent = '🍨 Catering Buckets Made';
    const catV   = document.createElement('td');
    catV.style.cssText = 'text-align:right;font-size:16px;font-weight:700;color:#f0a500;';
    catV.textContent = cateringMadeSummary;
    catRow.appendChild(catL);
    catRow.appendChild(catV);
    body.appendChild(catRow);
  }

  // ── Secondary metrics — smaller, muted ────────────────────────────────────
  [
    ['Total Run Time',        fmtTime(totalMs)],
    ['Avg. Time per Bucket',  avgPerBucket],
    ['Avg. Buckets per Hour', bph > 0 ? bph : '—'],
  ].forEach(([label, value]) => {
    const tr = document.createElement('tr');
    const tdL = document.createElement('td');
    tdL.textContent = label;
    const tdV = document.createElement('td');
    tdV.textContent = value;
    tr.appendChild(tdL);
    tr.appendChild(tdV);
    body.appendChild(tr);
  });

  document.getElementById('summaryOverlay').classList.add('open');
}

function closeSummary() {
  document.getElementById('summaryOverlay').classList.remove('open');
  writeRunSummary(); // fire-and-forget — non-blocking
  doneRun();
}

// Derives a short operational display name from the signed-in user's email.
// Used for lightweight activity attribution — first segment of the email username, title-cased.
// Returns null when no user is signed in (EMPLOYEE role, unauthenticated).
// Example: sarah.jones@handels.com → "Sarah"
function _currentUserName() {
  const user = window._auth && window._auth.currentUser;
  if (!user || !user.email) return null;
  const segment = user.email.split('@')[0].split(/[._\-]/)[0];
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

// Writes lastRunDate + lastRunBuckets + storeEvents to the store doc on run completion.
// Called from closeSummary() only. Uses merge so it never clobbers production data.
// storeEvents[] keeps the last 10 run entries so the store detail panel can show a timeline
// without any extra Firestore reads — it's part of the store doc already loaded by getDocs.
async function writeRunSummary() {
  const cateringMadeCount = _cateringDismissed.filter(d => d.action === 'made').length;
  if (_totalBucketsMade <= 0 && cateringMadeCount === 0) return;
  if (!window._firebaseReady || !window._auth || !window._auth.currentUser) return;
  // Capture per-flavor daily counts from runDismissed (before doneRun clears it)
  const flavors = {};
  runDismissed.filter(d => d.action === 'made').forEach(d => {
    flavors[d.name] = (flavors[d.name] || 0) + 1;
  });
  // Catering flavor counts
  const cateringFlavors = {};
  _cateringDismissed.filter(d => d.action === 'made').forEach(d => {
    cateringFlavors[d.name] = (cateringFlavors[d.name] || 0) + 1;
  });
  try {
    const userName = _currentUserName();
    const newEntry = {
      type: 'run_completed', buckets: _totalBucketsMade, at: Date.now(),
      ...(userName ? { by: userName } : {}),
      ...(Object.keys(flavors).length ? { flavors } : {}),
      ...(_runDurationMs > 0 ? { durationMs: _runDurationMs } : {}),
      ...(cateringMadeCount > 0 ? { cateringBuckets: cateringMadeCount, cateringFlavors } : {})
    };
    _storeEvents = [..._storeEvents, newEntry].slice(-10);
    await window._setDoc(getStoreDocRef(), {
      lastRunDate:    todayStr(),
      lastRunBuckets: _totalBucketsMade,
      lastRunAt:      Date.now(),
      storeEvents:    _storeEvents
    }, { merge: true });
  } catch (e) {
    console.error('Run summary write error:', e);
  }
}

function showVariegateModal(flavorsInRun) {
  const needed = {};
  flavorsInRun.forEach(f => {
    (VARIEGATES[f.name] || []).forEach(v => {
      if (!needed[v]) needed[v] = [];
      needed[v].push(f.name);
    });
  });
  const list = document.getElementById('varList');
  list.innerHTML = '';
  const keys = Object.keys(needed).sort();
  if (!keys.length) {
    const p = document.createElement('p');
    p.className = 'var-none';
    p.textContent = 'No variegates needed for this run.';
    list.appendChild(p);
  } else {
    keys.forEach(v => {
      const group = document.createElement('div');
      group.className = 'var-group';
      const name = document.createElement('div');
      name.className = 'var-group-name';
      name.textContent = v;
      const flavors = document.createElement('div');
      flavors.className = 'var-flavor-list';
      flavors.textContent = needed[v].join(', ');
      group.appendChild(name);
      group.appendChild(flavors);
      list.appendChild(group);
    });
  }
  document.getElementById('varOverlay').classList.add('open');
}

