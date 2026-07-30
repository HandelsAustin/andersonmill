// Manager PIN lock (local session lock layered on top of role/auth).
// Extracted from index.html — no logic changes.

let _managerUnlocked  = false;
let _managerTimer     = null;
let _pinCallback      = null;
let _pinMode          = 'enter'; // 'enter' | 'set' | 'confirm'
let _pinSetFirst      = '';
const MANAGER_TIMEOUT = 10 * 60 * 1000; // 10 minutes
function buildPinKeypad() {
  const kp = document.getElementById('pinKeypad');
  kp.innerHTML = '';
  [1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].forEach(k => {
    const btn = document.createElement('button');
    btn.className = 'pin-key';
    btn.textContent = k;
    btn.addEventListener('click', () => handlePinKey(String(k)));
    kp.appendChild(btn);
  });
}

let _pinEntry = '';

function updatePinDisplay() {
  const d = document.getElementById('pinDisplay');
  d.textContent = _pinEntry.replace(/./g, '●').padEnd(4,'_');
}

function handlePinKey(k) {
  document.getElementById('pinError').textContent = '';
  if (k === '⌫') {
    _pinEntry = _pinEntry.slice(0, -1);
    updatePinDisplay();
    return;
  }
  if (k === '✓') {
    submitPin();
    return;
  }
  if (_pinEntry.length >= 4) return;
  _pinEntry += k;
  updatePinDisplay();
  if (_pinEntry.length === 4) setTimeout(submitPin, 120);
}

function submitPin() {
  const stored = localStorage.getItem('car_manager_pin');
  if (_pinMode === 'set') {
    _pinSetFirst = _pinEntry;
    _pinEntry = '';
    updatePinDisplay();
    document.getElementById('pinTitle').textContent = 'Confirm PIN';
    document.getElementById('pinSubtitle').textContent = 'Enter your new PIN again to confirm.';
    _pinMode = 'confirm';
    return;
  }
  if (_pinMode === 'confirm') {
    if (_pinEntry !== _pinSetFirst) {
      document.getElementById('pinError').textContent = 'PINs do not match. Try again.';
      _pinEntry = ''; _pinSetFirst = '';
      updatePinDisplay();
      _pinMode = 'set';
      document.getElementById('pinTitle').textContent = 'Set Manager PIN';
      document.getElementById('pinSubtitle').textContent = 'Choose a 4-digit PIN for manager access.';
      return;
    }
    localStorage.setItem('car_manager_pin', _pinEntry);
    closePinModal();
    unlockManager();
    return;
  }
  // _pinMode === 'enter'
  if (_pinEntry === stored) {
    closePinModal();
    unlockManager();
  } else {
    document.getElementById('pinError').textContent = 'Incorrect PIN. Try again.';
    _pinEntry = '';
    updatePinDisplay();
  }
}

function openPinModal(mode, callback) {
  _pinMode   = mode;
  _pinEntry  = '';
  _pinSetFirst = '';
  _pinCallback = callback;
  buildPinKeypad();
  updatePinDisplay();
  document.getElementById('pinError').textContent = '';
  if (mode === 'set') {
    document.getElementById('pinTitle').textContent = 'Set Manager PIN';
    document.getElementById('pinSubtitle').textContent = 'Choose a 4-digit PIN for manager access.';
  } else {
    document.getElementById('pinTitle').textContent = 'Manager Access';
    document.getElementById('pinSubtitle').textContent = 'Enter your PIN to continue.';
  }
  document.getElementById('pinOverlay').classList.add('open');
}

function closePinModal() {
  document.getElementById('pinOverlay').classList.remove('open');
}


// When PIN is used to unlock, treat user as local store manager (fallback)
const _origUnlockManager = unlockManager;
function unlockManager() {
  _managerUnlocked = true;
  if (_managerTimer) clearTimeout(_managerTimer);
  _managerTimer = setTimeout(lockManager, MANAGER_TIMEOUT);
  // If not authenticated, set local role to STORE_MANAGER so UI gating works
  if (!(window._auth && window._auth.currentUser)) {
    window._USER_ROLE = ROLES.STORE_MANAGER;
    localStorage.setItem('car_user_role', window._USER_ROLE);
    updateUserRoleDisplay();
    updateAuthButton();
    updateRoleUIVisibility();
  }
  renderTable(); // re-render so target dropdowns appear
  if (_pinCallback) { const cb = _pinCallback; _pinCallback = null; cb(); }
}

function lockManager() {
  _managerUnlocked = false;
  _managerTimer = null;
  renderTable();
}

function requireManager(callback) {
  if (window._auth && window._auth.currentUser) {
    _managerUnlocked = true;
    callback();
    return;
  }
  showStatusMessage('Sign in as Manager to access this feature.', 2500);
}

// ── CABINET SORT ───────────────────────────────────────────
