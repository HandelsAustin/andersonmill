// Manager PIN lock — gates Dashboard/Inventory/Store Settings/Edit Flavors.
// The PIN is a shared secret per store (Firestore field `managerPin` on the store
// doc, populated by applyData() in store-org.js), not per-device — a reset applies
// everywhere immediately. CORPORATE_ADMIN accounts bypass the PIN entirely (already
// personally authenticated); every other signed-in account needs this store's PIN.

let _managerUnlocked  = false;
let _managerTimer     = null;
let _pinCallback      = null;
let _pinMode          = 'enter'; // 'enter' | 'set' | 'confirm'
let _pinSetFirst      = '';
const MANAGER_TIMEOUT = 10 * 60 * 1000; // 10 minutes
let _managerPin = null; // populated by applyData() in store-org.js

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

async function _saveManagerPin(pin) {
  _managerPin = pin;
  if (!window._firebaseReady) { showStatusMessage('Offline — PIN saved locally only', 3000); return; }
  try {
    await window._setDoc(getStoreDocRef(), { managerPin: pin }, { merge: true });
  } catch (e) {
    console.error('PIN save error:', e);
    showStatusMessage('⚠ Could not save PIN', 2500);
  }
}

function submitPin() {
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
      document.getElementById('pinSubtitle').textContent = 'Choose a 4-digit PIN for manager access at this store.';
      return;
    }
    const pin = _pinEntry;
    closePinModal();
    _saveManagerPin(pin);
    unlockManager();
    return;
  }
  // _pinMode === 'enter'
  if (_pinEntry === _managerPin) {
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
  document.getElementById('pinDisplay').style.display = '';
  document.getElementById('pinKeypad').style.display = '';
  document.getElementById('pinForgotLink').style.display = mode === 'set' ? 'none' : '';
  document.getElementById('pinReauthForm').style.display = 'none';
  if (mode === 'set') {
    document.getElementById('pinTitle').textContent = 'Set Manager PIN';
    document.getElementById('pinSubtitle').textContent = 'Choose a 4-digit PIN for manager access at this store.';
  } else {
    document.getElementById('pinTitle').textContent = 'Manager Access';
    document.getElementById('pinSubtitle').textContent = 'Enter your PIN to continue.';
  }
  document.getElementById('pinOverlay').classList.add('open');
}

function closePinModal() {
  document.getElementById('pinOverlay').classList.remove('open');
}

function unlockManager() {
  _managerUnlocked = true;
  if (_managerTimer) clearTimeout(_managerTimer);
  _managerTimer = setTimeout(lockManager, MANAGER_TIMEOUT);
  renderTable(); // re-render so target dropdowns appear
  if (_pinCallback) { const cb = _pinCallback; _pinCallback = null; cb(); }
}

function lockManager() {
  _managerUnlocked = false;
  _managerTimer = null;
  renderTable();
}

// Gates Dashboard / Inventory / Store Settings / Edit Flavors. Corporate accounts
// bypass the PIN entirely — they're already a personally-authenticated, elevated
// account, not the shared store login the PIN exists to distinguish from staff.
function requireManager(callback) {
  if (userHasRole(ROLES.CORPORATE_ADMIN)) { callback(); return; }
  if (_managerUnlocked) { callback(); return; }
  openPinModal(_managerPin ? 'enter' : 'set', callback);
}

// ── Forgot PIN ───────────────────────────────────────────────────────────────
// No email step (confirmed with the user — this app has no backend to send a
// custom "reset your PIN" email). Instead: re-confirm the store login's own
// password via Firebase reauthentication, then set a new PIN immediately.
function startPinReauth() {
  document.getElementById('pinError').textContent = '';
  document.getElementById('pinDisplay').style.display = 'none';
  document.getElementById('pinKeypad').style.display = 'none';
  document.getElementById('pinForgotLink').style.display = 'none';
  document.getElementById('pinReauthForm').style.display = '';
  document.getElementById('pinReauthPassword').value = '';
  document.getElementById('pinTitle').textContent = 'Forgot PIN';
  document.getElementById('pinSubtitle').textContent = window._auth && window._auth.currentUser
    ? `Confirm the password for ${window._auth.currentUser.email}`
    : '';
  setTimeout(() => document.getElementById('pinReauthPassword').focus(), 10);
}

function cancelPinReauth() {
  openPinModal(_managerPin ? 'enter' : 'set', _pinCallback);
}

async function confirmPinReauth() {
  const password = document.getElementById('pinReauthPassword').value;
  const errEl = document.getElementById('pinError');
  document.getElementById('pinReauthForm').style.display = 'none'; // hide while we verify
  errEl.textContent = '';
  if (!password) {
    errEl.textContent = 'Enter the password to continue.';
    document.getElementById('pinReauthForm').style.display = '';
    return;
  }
  const user = window._auth && window._auth.currentUser;
  if (!user) {
    errEl.textContent = 'You must be signed in.';
    document.getElementById('pinReauthForm').style.display = '';
    return;
  }
  try {
    const credential = window._EmailAuthProvider.credential(user.email, password);
    await window._reauthenticateWithCredential(user, credential);
    const cb = _pinCallback;
    openPinModal('set', cb);
  } catch (e) {
    errEl.textContent = 'Incorrect password.';
    document.getElementById('pinReauthForm').style.display = '';
    console.error('PIN reauth error:', e);
  }
}
