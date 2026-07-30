// Org/store Firestore refs, load/save, org & store picker UI, store CRUD.
// Extracted from index.html — no logic changes.

let _saving = false;
let _unsubscribeSnapshot = null;
let _unsubscribeRunSnapshot = null;
let _workingRunDate = null; // which date's run is currently loaded/editable — defaults to today in loadAll()

// NOTE: getOrgDocRef/getStoreDocRef/getOrgMemberRef are provided by appHelpers.js
// (as window.getOrgDocRef etc.) and called bare throughout this file and others —
// do not redeclare them here as local wrappers. A top-level `function getOrgDocRef(){}`
// declaration overwrites window.getOrgDocRef (global function declarations bind to the
// global object), so a wrapper that calls `window.getOrgDocRef()` ends up calling itself
// and recurses infinitely. Bare `getOrgDocRef()` calls already resolve correctly to
// window.getOrgDocRef via the shared global scope once no local declaration shadows it.

async function loadOrgMetadata() {
  if (!window._firebaseReady) return;
  try {
    const ref = getOrgDocRef();
    const snap = await window._getDoc(ref);
    if (!snap.exists()) {
      await ensureOrgDoc();
      return;
    }
    const meta = snap.data();
    if (meta?.name) {
      document.title = `${meta.name} — Count & Run`;
      window._orgName = meta.name;
    }
    _orgCustomFlavors = meta?.customFlavors || [];
  } catch (e) {
    console.error('Org metadata load error:', e);
  }
}

function _getOrgDisplayName() {
  return window._orgName || (window.DEFAULT_ORG_META && window.DEFAULT_ORG_META.name) || window.getCurrentOrgId();
}

// Roster/settings/novelties-catalog/inventory-catalog are persistent (store doc).
// activeFlavors/cateringItems are date-specific and live in runs/{date} instead —
// see _applyRunData()/loadRunForDate() below. applyData() re-derives category/type
// on the already-loaded activeFlavors in case the roster changed (e.g. another
// device edited it), but is not the source of activeFlavors itself.
function applyData(data) {
  _storeDoc = data || null;
  const removed = data?.removedNames || [];
  const custom  = data?.customAdded  || []; // legacy per-store custom flavors, kept for backward-compat
  roster = [
    ...MASTER_ROSTER.filter(m => !removed.includes(m.name)),
    ..._orgCustomFlavors, // corporate-added, shared across every store — see loadOrgMetadata()
    ...custom
  ];
  activeFlavors = (activeFlavors || []).map(f => {
    const r = roster.find(x => x.name === f.name);
    return r ? { ...f, category: r.category, type: r.type } : f;
  }).filter(f => roster.find(x => x.name === f.name));
  _storeEvents = data?.storeEvents || [];
  _storeSettings = data?.settings || {};
  novelties = data?.novelties || [];
  inventoryCatalog = data?.inventoryCatalog || [];
  _inventoryLastCountedAt = data?.inventoryLastCountedAt || null;
  _managerPin = data?.managerPin || null;
}

function _applyRunData(runData) {
  const rd = runData || {};
  activeFlavors = (rd.activeFlavors || []).map(f => {
    const r = roster.find(x => x.name === f.name);
    return r ? { ...f, category: r.category, type: r.type } : f;
  }).filter(f => roster.find(x => x.name === f.name));
  _cateringItems = rd.cateringItems || [];
}

async function saveAll() {
  const customAdded  = roster.filter(r => !MASTER_ROSTER.find(m => m.name === r.name));
  const removedNames = MASTER_ROSTER.filter(m => !roster.find(r => r.name === m.name)).map(m => m.name);
  const rosterPayload = { customAdded, removedNames, updatedAt: Date.now() };
  const runPayload = { activeFlavors, cateringItems: _cateringItems, updatedAt: Date.now() };
  localStorage.setItem(window._STORAGE_KEYS.backup, JSON.stringify({ ...rosterPayload, ...runPayload }));
  if (!window._firebaseReady) { setSyncStatus('offline'); return; }
  setSyncStatus('saving');
  _saving = true;
  try {
    await window._setDoc(getStoreDocRef(), rosterPayload, { merge: true });
    await window._setDoc(window.getStoreRunLogRef(_workingRunDate || todayStr()), runPayload, { merge: true });
    setSyncStatus('saved');
  } catch(e) {
    console.error('Firestore save error:', e);
    setSyncStatus('error');
  } finally {
    _saving = false;
  }
}

async function loadAll() {
  if (_unsubscribeSnapshot) { _unsubscribeSnapshot(); _unsubscribeSnapshot = null; }
  if (!_workingRunDate) _workingRunDate = todayStr();
  let data = null;
  let backupParsed = null;
  if (window._firebaseReady) {
    await loadOrgMetadata();
    try {
      const ref = getStoreDocRef();
      const snap = await window._getDoc(ref);
      if (snap.exists()) { data = snap.data(); }
      setSyncStatus('loaded');
    } catch(e) {
      console.error('Firestore load error:', e);
      setSyncStatus('offline');
    }
  }
  if (!data) {
    try {
      const backup = localStorage.getItem(window._STORAGE_KEYS.backup);
      if (backup) { backupParsed = JSON.parse(backup); data = backupParsed; }
      if (!window._firebaseReady) setSyncStatus('offline');
    } catch(e) {}
  }
  applyData(data);
  await loadRunForDate(_workingRunDate, backupParsed);
  if (window._firebaseReady && window._onSnapshot) {
    try {
      const ref = getStoreDocRef();
      _unsubscribeSnapshot = window._onSnapshot(ref, snap => {
        if (_saving) return;
        applyData(snap.exists() ? snap.data() : null);
        if (snap.exists()) localStorage.setItem(window._STORAGE_KEYS.backup, JSON.stringify({ ...snap.data(), activeFlavors, cateringItems: _cateringItems }));
        setSyncStatus('loaded');
        renderTable();
      }, err => {
        console.error('Snapshot listener error:', err);
        setSyncStatus('error');
      });
    } catch(e) {
      console.error('Failed to start snapshot listener:', e);
    }
  }
}

// Loads (and live-subscribes to) a specific date's Ice Cream Run — this is what
// "recall a past day" switches to. offlineFallback is only used for *today* when
// Firestore is unreachable (the local backup is a single most-recent-day cache,
// not a full history, same limitation as before this feature existed).
async function loadRunForDate(date, offlineFallback) {
  _workingRunDate = date;
  if (_unsubscribeRunSnapshot) { _unsubscribeRunSnapshot(); _unsubscribeRunSnapshot = null; }
  let runData = null;
  if (window._firebaseReady) {
    try {
      const snap = await window._getDoc(window.getStoreRunLogRef(date));
      if (snap.exists()) runData = snap.data();
    } catch (e) {
      console.error('Run log load error:', e);
    }
  } else if (offlineFallback && date === todayStr()) {
    runData = offlineFallback;
  }
  _applyRunData(runData);
  renderTable();
  if (typeof _renderRunDatePicker === 'function') _renderRunDatePicker();
  if (window._firebaseReady && window._onSnapshot) {
    try {
      _unsubscribeRunSnapshot = window._onSnapshot(window.getStoreRunLogRef(date), snap => {
        if (_saving) return;
        _applyRunData(snap.exists() ? snap.data() : null);
        renderTable();
      }, err => console.error('Run snapshot listener error:', err));
    } catch (e) {
      console.error('Failed to start run snapshot listener:', e);
    }
  }
}

// Lists recent saved run dates (doc IDs are already YYYY-MM-DD, so ordering by
// document id is a cheap, sortable "date list" with no extra fields needed).
async function listRecentRunDates(max = 60) {
  if (!window._firebaseReady || !window._getDocs || !window._query) return [];
  try {
    const q = window._query(window.getStoreRunLogCollectionRef(), window._orderBy('__name__', 'desc'), window._limit(max));
    const snap = await window._getDocs(q);
    return snap.docs.map(d => d.id);
  } catch (e) {
    console.error('List run dates error:', e);
    return [];
  }
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function showOrgPicker() {
  const input = document.getElementById('orgIdInput');
  if (input) {
    input.value = window.getCurrentOrgId();
  }
  document.getElementById('orgOverlay').classList.add('open');
}


// ── MULTI-STORE OVERVIEW HELPERS ────────────────────────────────────────────

// Returns today's date as YYYY-MM-DD (ISO, locale-stable via en-CA).
function todayStr() {
  return new Date().toLocaleDateString('en-CA');
}

// Store is "active today" if it was updated today OR a run was completed today.
function storeIsActiveToday(store) {
  const today = todayStr();
  if (store.lastRunDate === today) return true;
  if (store.updatedAt) return new Date(store.updatedAt).toLocaleDateString('en-CA') === today;
  return false;
}

// Count flavors currently short (need to make > 0 batches).
function storeShortagesCount(store) {
  return (store.activeFlavors || []).filter(f => toMake(f) > 0).length;
}

// Buckets made today (only if lastRunDate matches today).
function storeProductionToday(store) {
  return store.lastRunDate === todayStr() ? (store.lastRunBuckets || 0) : 0;
}

// Human-readable relative time from a Unix timestamp.
function relativeTime(ts) {
  if (!ts) return 'Never';
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── OPERATIONAL TREND INDICATORS ────────────────────────────────────────────
// Returns a color string for a sync-age timestamp:
//   < 1h  → muted blue  (#5a7a9a) — normal, no concern
//   1–4h  → amber       (#f0a500) — stale, worth noticing
//   > 4h  → red         (#ff8080) — alert, likely offline or disconnected
//   null/undefined → muted blue (safe fallback)
// Pure — no side effects. Used for colorizing sync timestamps in UI.
function _syncAgeColor(ts) {
  if (!ts) return '#5a7a9a';
  const ageMs = Date.now() - ts;
  if (ageMs > 4 * 60 * 60 * 1000) return '#ff8080'; // > 4h — alert
  if (ageMs > 1 * 60 * 60 * 1000) return '#f0a500'; // 1–4h — warning
  return '#5a7a9a'; // < 1h — normal
}

// Pure client-side calculation from storeEvents[] — zero Firestore reads/writes.
// Requires ≥ 3 run_completed events to surface a signal; returns null otherwise.
// Splits runs into two halves (older vs. recent) and compares average bucket counts.

async function selectOrg(orgId) {
  const trimmed = String(orgId || '').trim();
  if (!trimmed) return;
  window.setOrgId(trimmed);
  window.setStoreId(undefined);
  window.setOrgStores([]);
  document.getElementById('orgOverlay').classList.remove('open');
  const sub = document.querySelector('.header-sub');
  if (sub) sub.textContent = `Choose a store — ${trimmed}`;
  await window.logOrgEvent('org_switched', { orgId: trimmed });
  awaitLoadOrgMetaAndShowStorePicker();
  if (window._auth && window._auth.currentUser) {
    await loadCurrentUserRole();
    updateRoleUIVisibility();
  }
}

// Non-corporate accounts only ever see/select the store(s) in their own member doc
// (members/{uid}.stores[]) — corporate accounts see every store in the org.
function _scopedStores(allStores) {
  if (userHasRole(ROLES.CORPORATE_ADMIN)) return allStores;
  const allowed = new Set(window._userStores || []);
  return allStores.filter(s => allowed.has(s.id));
}

async function loadOrgStores() {
  if (!window._firebaseReady || !window._getDocs) return [];
  try {
    const coll = window.getOrgStoresCollectionRef();
    const snap = await window._getDocs(coll);
    window._orgHasAnyStores = snap.docs.length > 0; // distinguishes "brand new org" from "just not assigned to one yet"
    const stores = _scopedStores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    window.setOrgStores(stores);
    return stores;
  } catch (e) {
    console.error('Org store load error:', e);
    return [];
  }
}

async function showStorePicker(skipWelcomeBack = false) {
  const list = document.getElementById('storeList');
  list.innerHTML = '';
  document.getElementById('storeOverlay').classList.add('open');

  // Welcome-back: if returning to a known store, confirm before showing full list
  const savedId = window.getCurrentStoreId();
  const savedLabel = localStorage.getItem('car_store_label') || savedId;
  if (!skipWelcomeBack && savedId && savedLabel) {
    _renderWelcomeBack(list, savedId, savedLabel);
    return;
  }

  // Close button — shown whenever a store is already selected (switching, not first pick)
  const _existingClose = document.getElementById('storeOverlayClose');
  if (_existingClose) _existingClose.remove();
  if (savedId) {
    const closeBtn = document.createElement('button');
    closeBtn.id = 'storeOverlayClose';
    closeBtn.textContent = '× Not now';
    closeBtn.title = 'Close store picker';
    closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:none;border:none;color:#8fa3be;font-size:14px;cursor:pointer;padding:8px 12px;border-radius:6px;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
    closeBtn.onclick = () => { document.getElementById('storeOverlay').classList.remove('open'); };
    document.getElementById('storeOverlay').appendChild(closeBtn);
  }

  let stores = window.getOrgStores();
  if (!stores.length) {
    const loadingEl = document.createElement('div');
    loadingEl.style.cssText = 'text-align:center;color:#8fa3be;font-size:14px;font-family:\'Arial Narrow\',Arial,sans-serif;padding:20px 0;';
    loadingEl.textContent = '⏳ Loading stores…';
    list.appendChild(loadingEl);
    stores = await loadOrgStores();
    list.innerHTML = '';
  }

  if (!stores.length) {
    if (!window._orgHasAnyStores) {
      // Genuinely brand-new org — bootstrap the first store (creator becomes CORPORATE_ADMIN).
      showOrgSetupForm(list);
    } else {
      // Org has stores, but this account isn't assigned to any of them yet.
      const p = document.createElement('p');
      p.style.cssText = 'color:#98d4e3;font-size:13px;line-height:1.6;text-align:center;margin-bottom:20px;';
      p.textContent = "This account isn't assigned to any store yet. Ask your manager or corporate admin to grant access.";
      list.appendChild(p);
      const signOutBtn = document.createElement('button');
      signOutBtn.className = 'store-btn';
      signOutBtn.style.cssText = 'text-align:center;';
      signOutBtn.textContent = 'Sign In as a Different Account';
      signOutBtn.onclick = () => signOutUser();
      list.appendChild(signOutBtn);
    }
  } else {
    stores.forEach(store => {
      const btn = document.createElement('button');
      btn.className = 'store-btn';
      btn.textContent = store.label || store.id;
      btn.onclick = () => selectStore(store.id);
      list.appendChild(btn);
    });
  }
}

function _renderWelcomeBack(list, savedId, savedLabel) {
  list.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'text-align:center;padding:8px 0;';

  const greeting = document.createElement('div');
  greeting.style.cssText = 'font-size:11px;color:#98d4e3;font-family:"Arial Narrow",Arial,sans-serif;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;';
  greeting.textContent = 'Welcome back';
  wrap.appendChild(greeting);

  const storeName = document.createElement('div');
  storeName.style.cssText = 'font-size:24px;font-weight:700;color:#ffffff;margin-bottom:28px;font-family:"Tw Cen MT","Century Gothic",Arial,sans-serif;';
  storeName.textContent = savedLabel;
  wrap.appendChild(storeName);

  const continueBtn = document.createElement('button');
  continueBtn.className = 'store-btn';
  continueBtn.style.cssText = 'text-align:center;background:#0f4a2a;border-color:#98d4e3;font-size:17px;padding:20px 24px;letter-spacing:0.04em;';
  continueBtn.textContent = 'Continue →';
  continueBtn.onclick = () => selectStore(savedId);
  wrap.appendChild(continueBtn);

  const switchBtn = document.createElement('button');
  switchBtn.style.cssText = 'margin-top:14px;display:block;width:100%;padding:12px;background:transparent;border:none;color:#8fa3be;font-family:"Arial Narrow",Arial,sans-serif;font-size:13px;cursor:pointer;touch-action:manipulation;letter-spacing:0.04em;';
  switchBtn.textContent = 'Switch Store';
  switchBtn.onclick = () => showStorePicker(true);
  wrap.appendChild(switchBtn);

  list.appendChild(wrap);
}

// ── STORE FORM (shared helper) ──────────────────────────────────────────────
// Builds a store name/ID form inside `containerEl`.
// opts.submitLabel — button text (default '✓ Create Store')
// opts.onSuccess(storeId, storeLabel) — called after createOrgAndStore() resolves
// Returns { nameInput } so callers can auto-focus if needed.
function renderStoreForm(containerEl, opts) {
  const { submitLabel = '✓ Create Store', onSuccess } = opts || {};
  const INPUT_STYLE = 'width:100%;padding:14px 12px;border-radius:10px;border:1.5px solid #98d4e3;background:#1e2870;color:#ffffff;font-family:\'Tw Cen MT\',\'Century Gothic\',Arial,sans-serif;font-size:14px;';

  function toSlug(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;display:flex;flex-direction:column;gap:10px;';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Store name (e.g. Boardman)';
  nameInput.style.cssText = INPUT_STYLE;
  wrap.appendChild(nameInput);

  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.placeholder = 'Store ID (e.g. boardman)';
  idInput.style.cssText = INPUT_STYLE;
  wrap.appendChild(idInput);

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:11px;color:#8fa3be;font-family:\'Arial Narrow\',Arial,sans-serif;margin-top:-4px;';
  hint.textContent = 'Store ID: lowercase, numbers, hyphens only. Auto-filled from store name.';
  wrap.appendChild(hint);

  const errEl = document.createElement('div');
  errEl.style.cssText = 'color:#d72627;font-size:12px;min-height:18px;font-family:\'Arial Narrow\',Arial,sans-serif;';
  wrap.appendChild(errEl);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'store-btn';
  submitBtn.style.cssText = 'background:#d72627;border-color:#d72627;color:#ffffff;text-align:center;';
  submitBtn.textContent = submitLabel;
  wrap.appendChild(submitBtn);

  nameInput.addEventListener('input', () => { idInput.value = toSlug(nameInput.value); });

  submitBtn.addEventListener('click', async () => {
    const storeLabel = nameInput.value.trim();
    const storeId    = idInput.value.trim();
    errEl.textContent = '';

    if (!storeLabel) { errEl.textContent = 'Store name is required.'; return; }
    if (!storeId)    { errEl.textContent = 'Store ID is required.'; return; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(storeId)) {
      errEl.textContent = 'Store ID must start with a letter or number, and use only lowercase letters, numbers, and hyphens.';
      return;
    }
    if (!navigator.onLine) { errEl.textContent = 'You must be online to create a store.'; return; }
    if (!window._auth || !window._auth.currentUser) { errEl.textContent = 'You must be signed in.'; return; }

    submitBtn.textContent = 'Creating…';
    submitBtn.disabled = true;
    try {
      await createOrgAndStore(storeLabel, storeId);
      if (onSuccess) onSuccess(storeId, storeLabel);
    } catch (e) {
      console.error('Store creation error:', e);
      errEl.textContent = 'Error: ' + (e.message || e.code || 'Could not create store. Check your connection.');
      submitBtn.textContent = submitLabel;
      submitBtn.disabled = false;
    }
  });

  containerEl.appendChild(wrap);
  return { nameInput };
}

// ── ORG ONBOARDING ─────────────────────────────────────────────────────────
// Renders an inline "create first store" form inside the store picker overlay.
// Only shown when: org has no stores AND a manager is signed in.
function showOrgSetupForm(listEl) {
  const overlaySubtitle = document.querySelector('#storeOverlay > p');
  if (overlaySubtitle) overlaySubtitle.textContent = 'Set up your organization to get started.';

  const orgId = window.getCurrentOrgId();

  const info = document.createElement('p');
  info.style.cssText = 'font-size:13px;color:#98d4e3;line-height:1.5;text-align:center;font-family:\'Arial Narrow\',Arial,sans-serif;';
  info.innerHTML = `No stores found for <strong style="color:#ffffff;">${_getOrgDisplayName()}</strong>.<br>Create your first store to get started.`;
  listEl.appendChild(info);

  const { nameInput } = renderStoreForm(listEl, {
    onSuccess: (storeId) => selectStore(storeId)
  });
  setTimeout(() => nameInput.focus(), 100);
}

// ── ADD STORE (dashboard panel) ─────────────────────────────────────────────
// Renders an "Add Another Store" section inside the corporate dashboard.
// Only shown to CORPORATE_ADMIN. Reuses renderStoreForm() — no duplicate logic.
function renderAddStoreSection(content) {
  const section = document.createElement('div');
  section.style.cssText = 'border-top:1px solid #2e4a70;margin-top:16px;padding-top:20px;display:grid;gap:12px;';

  const heading = document.createElement('div');
  heading.style.cssText = 'font-size:15px;color:#ffffff;font-weight:700;';
  heading.textContent = 'Add Another Store';
  section.appendChild(heading);

  const subtext = document.createElement('p');
  subtext.style.cssText = 'font-size:12px;color:#98d4e3;';
  subtext.textContent = `Adding to: ${_getOrgDisplayName()}`;
  section.appendChild(subtext);

  const successEl = document.createElement('div');
  successEl.style.cssText = 'display:none;color:#4caf50;font-size:13px;font-family:\'Arial Narrow\',Arial,sans-serif;';
  section.appendChild(successEl);

  const formWrap = document.createElement('div');
  section.appendChild(formWrap);

  content.appendChild(section);

  renderStoreForm(formWrap, {
    submitLabel: '+ Add Store',
    onSuccess: (storeId, storeLabel) => {
      // Show success banner, hide form, then re-render dashboard with updated store count
      successEl.textContent = `✓ "${storeLabel}" added. Refreshing…`;
      successEl.style.display = '';
      formWrap.style.display = 'none';
      setTimeout(() => showCorporateDashboard(), 1500);
    }
  });
}

async function createOrgAndStore(storeLabel, storeId) {
  const orgId = window.getCurrentOrgId();
  const user  = window._auth.currentUser;
  const now   = Date.now();

  // 1. Create org doc if it doesn't already exist (preserve any existing data)
  const orgRef  = window.getOrgDocRef();
  const orgSnap = await window._getDoc(orgRef);
  if (!orgSnap.exists()) {
    await window._setDoc(orgRef, { name: orgId, createdAt: now, createdBy: user.uid });
  }

  // 2. Create the first store document
  const storeRef = window._doc(window._db, 'organizations', orgId, 'stores', storeId);
  await window._setDoc(storeRef, { id: storeId, label: storeLabel, createdAt: now, createdBy: user.uid });

  // 3. Assign the creator as CORPORATE_ADMIN for this org
  const memberRef = window.getOrgMemberRef(user.uid);
  await window._setDoc(memberRef, {
    uid: user.uid, email: user.email || '', role: ROLES.CORPORATE_ADMIN,
    stores: [storeId], createdAt: now
  }, { merge: true });

  // 4. Update local role state immediately so UI reflects CORPORATE_ADMIN
  window._USER_ROLE = ROLES.CORPORATE_ADMIN;
  localStorage.setItem('car_user_role', ROLES.CORPORATE_ADMIN);
  updateUserRoleDisplay();
  updateAuthButton();
  updateRoleUIVisibility();

  // 5. Add store to in-memory list so selectStore() can find it without a reload
  window.setOrgStores([...window.getOrgStores(), { id: storeId, label: storeLabel }]);

  // 6. Log the event
  await window.logOrgEvent('org_initialized', { orgId, storeId, storeLabel });

  // 7. Signal init() to show setup guidance after store loads
  localStorage.setItem('car_just_created', '1');
}

async function awaitLoadOrgMetaAndShowStorePicker() {
  await loadOrgMetadata();
  await showStorePicker();
}

function findStoreById(id) {
  if (!id) return null;
  return window.getOrgStores().find(s => s.id === id);
}

function selectStore(id) {
  window.setStoreId(id);
  document.getElementById('storeOverlay').classList.remove('open');
  // The manager PIN is per-store — being unlocked at the previous store must not
  // carry over to this one. Bounce back to the Run tab so we're not left showing
  // a manager-gated tab's stale content for a store we're no longer unlocked at.
  if (typeof lockManager === 'function') lockManager();
  if (typeof switchTab === 'function') switchTab('Run');
  const store = findStoreById(id);
  if (store) {
    const displayName = store.label || store.id;
    localStorage.setItem('car_store_label', displayName);
    window.logOrgEvent('store_selected', { storeId: id, label: displayName });
  }
  _updateHeaderSub();
  init();
}

