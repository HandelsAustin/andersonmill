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
      window._userStores = member.stores || [];
    } else if (forceCreate) {
      window._USER_ROLE = ROLES.STORE_MANAGER;
      window._userStores = window.getCurrentStoreId() ? [window.getCurrentStoreId()] : [];
      await window._setDoc(ref, {
        uid: user.uid,
        email: user.email,
        role: window._USER_ROLE,
        stores: window._userStores,
        createdAt: Date.now()
      });
    } else {
      window._USER_ROLE = ROLES.STORE_MANAGER;
      window._userStores = [];
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


// All tabs and the Dashboard button are always visible to any signed-in account —
// Inventory/Store Settings/Dashboard/Edit Flavors are gated at point-of-use by
// requireManager() (the shared per-store PIN) instead of by role-based hiding.
function updateRoleUIVisibility() {
  _updateHeaderSub();
}

function _updateHeaderSub() {
  const storeId = window.getCurrentStoreId && window.getCurrentStoreId();
  // car_store_label (the fallback _storeDisplayLabel() reads when called with
  // no freshLabel) is a single global cache key, not keyed per store — it only
  // ever reflects whichever store last had its label explicitly passed in
  // here, not necessarily the one currently selected. That's fine for a
  // single-store device, but a corporate account switching between stores on
  // one browser would see the PREVIOUS store's name stuck in the header until
  // something else happened to pass the right one in and overwrite it (e.g.
  // opening Store Settings, which does pass it). Look the current store's
  // real label up from the already-loaded org store list first, same as
  // Store Settings does, so the header is correct immediately on switch.
  const stores = (window.getOrgStores && window.getOrgStores()) || [];
  const freshLabel = storeId ? stores.find(s => s.id === storeId)?.label : null;
  const storeLabel = storeId ? _storeDisplayLabel(storeId, freshLabel) : null;
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

// The header's Sign In/Sign Out button. There's no separate auth modal anymore —
// signing in always uses the entry screen's own form (the only login UI in the app).
function openAuthModal() {
  if (window._auth && window._auth.currentUser) {
    signOutUser();
    return;
  }
  const errEl = document.getElementById('authError');
  errEl.textContent = '';
  errEl.style.color = '';
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  showEntryScreen();
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
    _reconcileStoreForSignedInUser();
    await window.logOrgEvent('signed_in', { email });
    hideEntryScreen();
    updateConnectivityStatus();
    loadCabinetPref();
    if (window._firebaseReady) loadOrgMetadata();
    if (!window.getCurrentStoreId()) {
      await loadOrgStores().catch(() => {});
      showStorePicker();
    }
  } catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      const create = confirm('No account found for that email. Create a new store login?');
      if (!create) return;
      try {
        await window._createUserWithEmailAndPassword(window._auth, email, password);
        await window._signInWithEmailAndPassword(window._auth, email, password);
        await loadCurrentUserRole(true);
        await window.logOrgEvent('account_created', { email });
        hideEntryScreen();
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

async function resetPassword() {
  const email = document.getElementById('authEmail').value.trim();
  const errEl = document.getElementById('authError');
  errEl.style.color = '';
  if (!email) {
    errEl.style.color = '#d72627';
    errEl.textContent = 'Enter your email above first, then tap "Forgot password?".';
    return;
  }
  if (!window._firebaseReady || !window._auth) {
    errEl.style.color = '#d72627';
    errEl.textContent = 'You must be online to reset your password.';
    return;
  }
  try {
    await window._sendPasswordResetEmail(window._auth, email);
    errEl.style.color = '#22a05a';
    errEl.textContent = `✓ Password reset email sent to ${email}.`;
  } catch (e) {
    if (e.code === 'auth/invalid-email') {
      errEl.style.color = '#d72627';
      errEl.textContent = 'That email address looks invalid.';
    } else if (e.code === 'auth/user-not-found') {
      // Show the same success-style message either way so this can't be used
      // to probe which emails have manager accounts.
      errEl.style.color = '#22a05a';
      errEl.textContent = `✓ If an account exists for ${email}, a reset email has been sent.`;
    } else {
      errEl.style.color = '#d72627';
      errEl.textContent = e.message || 'Could not send reset email. Try again shortly.';
      console.error('Password reset error:', e);
    }
  }
}

async function signOutUser() {
  if (!window._auth) return;
  if (_unsubscribeSnapshot) { _unsubscribeSnapshot(); _unsubscribeSnapshot = null; }
  if (_unsubscribeRunSnapshot) { _unsubscribeRunSnapshot(); _unsubscribeRunSnapshot = null; }
  try {
    await window._signOut(window._auth);
    await window.logOrgEvent('signed_out', {});
    window._USER_ROLE = ROLES.EMPLOYEE;
    localStorage.setItem('car_user_role', window._USER_ROLE);
    window._userStores = [];
    // Next person on this shared device starts locked out of manager actions again.
    if (typeof lockManager === 'function') lockManager();
    if (typeof switchTab === 'function') switchTab('Run');
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

