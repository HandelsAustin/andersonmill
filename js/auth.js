// Firebase Auth + org role loading/UI + auth modal (sign-in/out).
// Extracted from index.html — no logic changes.

// ── MASTER ROSTER (baked in from FlavorOrder.csv) ──────────────────────────
// category is stored internally for run-sort; never shown to user
const ROLES = {
  CORPORATE_ADMIN: 'CORPORATE_ADMIN',
  STORE_MANAGER: 'STORE_MANAGER',
  EMPLOYEE: 'EMPLOYEE'
};
const DEFAULT_ORG_ID = 'handels';
const DEFAULT_ORG_META = {
  name: "Handel's Homemade Ice Cream",
  tagline: "Production Tool",
  createdAt: Date.now(),
  updatedAt: Date.now()
};
const ORGS = [
  { id: DEFAULT_ORG_ID, label: DEFAULT_ORG_META.name }
];
function userHasRole(role) {
  return window._USER_ROLE === role;
}

function userCanManage() {
  return userHasRole(ROLES.CORPORATE_ADMIN) || userHasRole(ROLES.STORE_MANAGER);
}

function updateUserRoleDisplay() {
  _updateHeaderSub();
}

async function loadCurrentUserRole(forceCreate = false) {
  if (!window._auth || !window._auth.currentUser) return;
  try {
    const user = window._auth.currentUser;
    const ref = getOrgMemberRef(user.uid);
    const snap = await window._getDoc(ref);
    if (snap.exists()) {
      const member = snap.data();
      window._USER_ROLE = member.role || ROLES.STORE_MANAGER;
    } else if (forceCreate) {
      window._USER_ROLE = ROLES.STORE_MANAGER;
      await window._setDoc(ref, {
        uid: user.uid,
        email: user.email,
        role: window._USER_ROLE,
        stores: window.getCurrentStoreId() ? [window.getCurrentStoreId()] : [],
        createdAt: Date.now()
      });
    } else {
      window._USER_ROLE = ROLES.STORE_MANAGER;
    }
    localStorage.setItem('car_user_role', window._USER_ROLE);
    updateUserRoleDisplay();
    updateAuthButton();
    updateRoleUIVisibility();
  } catch (e) {
    console.error('Load user role error:', e);
  }
}

  async function setCurrentUserRole(newRole) {
    if (!window._auth || !window._auth.currentUser) return;
    try {
      const user = window._auth.currentUser;
      const ref = getOrgMemberRef(user.uid);
      await window._setDoc(ref, {
        uid: user.uid,
        email: user.email,
        role: newRole,
        stores: window.getCurrentStoreId() ? [window.getCurrentStoreId()] : [],
        updatedAt: Date.now()
      }, { merge: true });
      window._USER_ROLE = newRole;
      localStorage.setItem('car_user_role', window._USER_ROLE);
      updateUserRoleDisplay();
      updateAuthButton();
      updateRoleUIVisibility();
    } catch (e) {
      console.error('Set user role error:', e);
    }
  }

function updateAuthButton() {
  const btn = document.getElementById('authBtn');
  if (!btn) return;
  btn.textContent = window._auth && window._auth.currentUser ? 'Sign Out' : 'Sign In';
}


function updateRoleUIVisibility() {
  const canDash = userHasRole(ROLES.CORPORATE_ADMIN) || userHasRole(ROLES.STORE_MANAGER);
  const dashboardBtn = document.getElementById('dashboardBtn');
  if (dashboardBtn) dashboardBtn.style.display = canDash ? 'inline-flex' : 'none';
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.style.display = canDash ? 'inline-flex' : 'none';
  const inventoryBtn = document.getElementById('inventoryBtn');
  if (inventoryBtn) inventoryBtn.style.display = canDash ? 'inline-flex' : 'none';
  _updateHeaderSub();
}

function _updateHeaderSub() {
  const raw = localStorage.getItem('car_store_label') || (window.getCurrentStoreId && window.getCurrentStoreId());
  // Guard against the literal string "undefined" being stored from a prior session
  const storeLabel = (raw && raw !== 'undefined') ? raw : null;
  if (!storeLabel) return;
  const sub = document.querySelector('.header-sub');
  if (!sub) return;
  let roleTag = '';
  if (window._auth && window._auth.currentUser) {
    if (window._USER_ROLE === ROLES.CORPORATE_ADMIN) roleTag = ' · Corporate Admin';
    else if (window._USER_ROLE === ROLES.STORE_MANAGER) roleTag = ' · Manager';
  }
  sub.textContent = storeLabel + roleTag + " — Handel's Homemade Ice Cream";
}

function openAuthModal() {
  if (window._auth && window._auth.currentUser) {
    signOutUser();
    return;
  }
  document.getElementById('authError').textContent = '';
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authOverlay').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
}

async function signInManager() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const errEl = document.getElementById('authError');
  errEl.textContent = '';
  if (!email || !password) {
    errEl.textContent = 'Email and password are required.';
    return;
  }
  try {
    await window._signInWithEmailAndPassword(window._auth, email, password);
    await loadCurrentUserRole(true);
    await window.logOrgEvent('signed_in', { email });
    closeAuthModal();
    hideEntryScreen();
    sessionStorage.removeItem('car_employee_session');
    updateConnectivityStatus();
    loadCabinetPref();
    if (window._firebaseReady) loadOrgMetadata();
    if (!window.getCurrentStoreId()) {
      await loadOrgStores().catch(() => {});
      showStorePicker();
    }
  } catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      const create = confirm('No account found. Create a new manager account?');
      if (!create) return;
      try {
        await window._createUserWithEmailAndPassword(window._auth, email, password);
        await window._signInWithEmailAndPassword(window._auth, email, password);
        await loadCurrentUserRole(true);
        await window.logOrgEvent('account_created', { email });
        closeAuthModal();
        hideEntryScreen();
        sessionStorage.removeItem('car_employee_session');
        updateConnectivityStatus();
        loadCabinetPref();
        if (window._firebaseReady) loadOrgMetadata();
        if (!window.getCurrentStoreId()) {
          await loadOrgStores().catch(() => {});
          showStorePicker();
        }
      } catch (createErr) {
        errEl.textContent = createErr.message || 'Unable to create account.';
        console.error(createErr);
      }
    } else {
      errEl.textContent = e.message || 'Sign in failed.';
      console.error(e);
    }
  }
}

async function signOutUser() {
  if (!window._auth) return;
  if (_unsubscribeSnapshot) { _unsubscribeSnapshot(); _unsubscribeSnapshot = null; }
  try {
    await window._signOut(window._auth);
    await window.logOrgEvent('signed_out', {});
    window._USER_ROLE = ROLES.EMPLOYEE;
    localStorage.setItem('car_user_role', window._USER_ROLE);
    updateUserRoleDisplay();
    updateAuthButton();
    updateRoleUIVisibility();
  } catch (e) {
    console.error('Sign out failed:', e);
  }
}

async function ensureOrgDoc() {
  if (!window._firebaseReady) return;
  try {
    const ref = getOrgDocRef();
    await window._setDoc(ref, { ...DEFAULT_ORG_META });
    await loadOrgMetadata();
  } catch (e) {
    console.error('Org creation error:', e);
  }
}

// Store doc helper is provided by appHelpers.js

