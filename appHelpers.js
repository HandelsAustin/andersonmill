// Shared cap for store.storeEvents[] — one array holding BOTH run_completed
// and novelties_completed entries (js/production.js writeRunSummary(),
// js/novelties.js submitNoveltiesSummary()). The Manager/Corporate Dashboards'
// "Last 30 Days"/"Production Trend · 7 Days"/"Top Flavors" sections all filter
// this same array by a time cutoff, but a cap that's too small silently
// contradicts the label — a store logging one run + one novelties checklist
// per day only got ~5 days of combined history out of the old 10-slot cap,
// not 30, regardless of what the date filter itself allowed through.
const STORE_EVENTS_MAX_ENTRIES = 60;

const STORAGE_KEYS = window._STORAGE_KEYS || {
  orgId: 'car_org_id',
  storeId: 'car_store_id',
  backup: 'car_backup'
};
const DEFAULT_USER_ROLE = (window.ROLES && window.ROLES.EMPLOYEE) || 'EMPLOYEE';

window.APP_STATE = window.APP_STATE || {
  orgId: localStorage.getItem(STORAGE_KEYS.orgId) || window.DEFAULT_ORG_ID || 'handels',
  storeId: localStorage.getItem(STORAGE_KEYS.storeId) || undefined,
  userRole: localStorage.getItem('car_user_role') || DEFAULT_USER_ROLE,
  userUid: null,
  isSignedIn: false,
};

window.setOrgId = function(orgId) {
  window.APP_STATE.orgId = orgId || window.DEFAULT_ORG_ID || 'handels';
  localStorage.setItem(STORAGE_KEYS.orgId, window.APP_STATE.orgId);
};

window.setStoreId = function(storeId) {
  window.APP_STATE.storeId = storeId;
  if (storeId === undefined || storeId === null) {
    localStorage.removeItem(STORAGE_KEYS.storeId);
  } else {
    localStorage.setItem(STORAGE_KEYS.storeId, storeId);
  }
};

window.setSignedInUser = function(user) {
  window.APP_STATE.userUid = user?.uid || null;
  window.APP_STATE.isSignedIn = !!user;
};

window.getCurrentOrgId = function() {
  return window.APP_STATE.orgId || window.DEFAULT_ORG_ID || 'handels';
};

window.getCurrentStoreId = function() {
  return window.APP_STATE.storeId;
};

// window._USER_ROLE (js/auth.js) is the live, kept-up-to-date role — it changes
// on every sign-in/out/role-load. APP_STATE.userRole is only ever set once, at
// page-load, from whatever was last cached — it used to be the value read here,
// which meant this could report a stale role (from a previous account on this
// device, or the EMPLOYEE default) for the entire session even after a real
// sign-in updated the live variable. Fall back to it only for the brief window
// before _USER_ROLE itself has been set for the first time.
window.getCurrentUserRole = function() {
  return window._USER_ROLE || window.APP_STATE.userRole;
};

window.isSignedIn = function() {
  return window.APP_STATE.isSignedIn;
};

window.getOrgDocRef = function(orgId = window.getCurrentOrgId()) {
  return window._doc(window._db, 'organizations', orgId);
};

window.getStoreDocRef = function(orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._doc(window._db, 'organizations', orgId, 'stores', storeId);
};

window.getOrgMemberRef = function(uid, orgId = window.getCurrentOrgId()) {
  return window._doc(window._db, 'organizations', orgId, 'members', uid);
};

window.getOrgMembersCollectionRef = function(orgId = window.getCurrentOrgId()) {
  return window._collection(window._db, 'organizations', orgId, 'members');
};

window.getOrgEventsCollectionRef = function(orgId = window.getCurrentOrgId()) {
  return window._collection(window._db, 'organizations', orgId, 'events');
};

window.getOrgStoresCollectionRef = function(orgId = window.getCurrentOrgId()) {
  return window._collection(window._db, 'organizations', orgId, 'stores');
};

// Date-recallable daily logs — one small doc per date, so a day's data can be pulled
// back up and re-edited later without bloating the store doc itself.
window.getStoreRunLogRef = function(date, orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._doc(window._db, 'organizations', orgId, 'stores', storeId, 'runs', date);
};
window.getStoreRunLogCollectionRef = function(orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._collection(window._db, 'organizations', orgId, 'stores', storeId, 'runs');
};
window.getStoreNoveltiesLogRef = function(date, orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._doc(window._db, 'organizations', orgId, 'stores', storeId, 'noveltiesLog', date);
};
window.getStoreNoveltiesLogCollectionRef = function(orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._collection(window._db, 'organizations', orgId, 'stores', storeId, 'noveltiesLog');
};
window.getStoreInventoryLogRef = function(date, orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._doc(window._db, 'organizations', orgId, 'stores', storeId, 'inventoryLog', date);
};
window.getStoreInventoryLogCollectionRef = function(orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._collection(window._db, 'organizations', orgId, 'stores', storeId, 'inventoryLog');
};
window.getStoreTearDownLogRef = function(date, orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._doc(window._db, 'organizations', orgId, 'stores', storeId, 'tearDownLog', date);
};
window.getStoreTearDownLogCollectionRef = function(orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._collection(window._db, 'organizations', orgId, 'stores', storeId, 'tearDownLog');
};
window.getStoreTempLogRef = function(date, orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._doc(window._db, 'organizations', orgId, 'stores', storeId, 'tempLog', date);
};
window.getStoreTempLogCollectionRef = function(orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._collection(window._db, 'organizations', orgId, 'stores', storeId, 'tempLog');
};

// Lazily creates (once) and refreshes the shared <datalist> of every region
// currently in use in the org, so both the "Add Store" form (js/store-org.js:
// renderStoreForm()) and the store detail panel's region editor (js/dashboard.js:
// _editStoreRegion()) offer the same autocomplete regardless of which one
// happens to run first in a given session.
function _ensureRegionDatalist() {
  let datalist = document.getElementById('storeRegionOptions');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'storeRegionOptions';
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = '';
  [...new Set(window.getOrgStores().map(s => s.region).filter(Boolean))].forEach(region => {
    const opt = document.createElement('option');
    opt.value = region;
    datalist.appendChild(opt);
  });
  return datalist;
}

// Coalescing async-write wrapper — used by saveAll() (store-org.js),
// saveNoveltiesCatalog()/saveNoveltiesLog() (novelties.js), and
// saveInventoryCatalog()/saveInventoryLog() (inventory.js).
//
// Every one of those functions fires its own unawaited Firestore write on
// every single field edit (target change, dipping/holding change, a Reset,
// an On Hand tap...). Two overlapping writes to the *same* doc are two
// independent network requests that can complete in either order — if an
// earlier-but-slower write (e.g. a dipping change from a few seconds ago,
// delayed by a weak connection) finishes *after* a newer one (e.g. Reset),
// it silently wins and the newer state is lost. That's what made Reset
// look like it "didn't stick" across devices even though it ran correctly
// on the writing device — the reset write went out fine, then got clobbered
// moments later by a stale write that was still in flight.
//
// The fix: never let two writes for the same target be in flight at once.
// If a write is already running when called again, just flag "run once
// more after this one finishes" instead of firing a second overlapping
// write — and since the eventual re-run reads whatever state is current
// *at that time*, the very last write is always guaranteed to reflect the
// latest state, however many edits landed while the first write was busy.
//
// Optional onStart/onSettle fire exactly once per *session* — when the first
// caller starts a write, and again once every chained re-run has drained —
// not once per call. That matters for callers like `_saving` (store-org.js),
// which flags "ignore my own snapshot echo": if onStart/onSettle instead fired
// per-call, a second overlapping caller settling first would clear that flag
// while the first caller's write was still genuinely in flight, reopening the
// exact same race this whole helper exists to close.
function _makeCoalescedSaver(run, { onStart, onSettle } = {}) {
  let inFlight = false;
  let pending  = false;
  return async function coalescedSave() {
    if (inFlight) { pending = true; return; }
    inFlight = true;
    if (onStart) onStart();
    try {
      do {
        pending = false;
        await run();
      } while (pending);
    } finally {
      inFlight = false;
      if (onSettle) onSettle();
    }
  };
}

// Fallback display name for a raw store-id slug (e.g. "anderson-mill" ->
// "Anderson Mill") — used wherever store.label isn't set.
function _titleCaseSlug(id) {
  if (!id) return id;
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Pure display-name resolver for ANY store (current or not) — safe to use when
// listing multiple stores (picker options, store cards) since it never touches
// the cache. Prefers a real Firestore label, falls back to a title-cased id.
function _storeLabelFor(store) {
  if (!store) return null;
  return store.label || _titleCaseSlug(store.id);
}

// Best-known display name for the CURRENTLY selected store, with self-healing
// cache. Prefers a real Firestore label, then a cached label — UNLESS that
// cache is just the raw id itself (a sign the store was never actually
// labeled, from before `label` was written on creation, and got permanently
// cached that way the first time it was selected) — falling back to a
// title-cased id. Always re-caches the resolved value so a bad old cache
// self-heals the first time this runs. Only call this for the CURRENT store —
// calling it once per row in a multi-store list would repeatedly overwrite the
// cache with whichever store rendered last; use _storeLabelFor() for those.
function _storeDisplayLabel(id, freshLabel) {
  if (freshLabel) {
    try { localStorage.setItem('car_store_label', freshLabel); } catch (e) {}
    return freshLabel;
  }
  const cached = localStorage.getItem('car_store_label');
  if (cached && cached !== 'undefined' && cached !== id) return cached;
  const computed = id ? _titleCaseSlug(id) : null;
  if (computed) { try { localStorage.setItem('car_store_label', computed); } catch (e) {} }
  return computed;
}

window.setOrgStores = function(stores) {
  window.APP_STATE.orgStores = Array.isArray(stores) ? stores : [];
};

window.getOrgStores = function() {
  return window.APP_STATE.orgStores || [];
};
window.getLocalAnalyticsEvents = function(limit = 20) {
  try {
    const raw = localStorage.getItem('car_analytics_events');
    const events = raw ? JSON.parse(raw) : [];
    return Array.isArray(events) ? events.slice(0, limit) : [];
  } catch (e) {
    console.error('Analytics read failed', e);
    return [];
  }
};

window.logOrgEvent = async function(type, payload = {}) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    type,
    orgId: window.getCurrentOrgId(),
    storeId: window.getCurrentStoreId(),
    role: window.getCurrentUserRole(),
    userUid: window.APP_STATE.userUid || null,
    payload,
    createdAt: Date.now(),
    syncedAt: null
  };
  try {
    const raw = localStorage.getItem('car_analytics_events');
    const events = raw ? JSON.parse(raw) : [];
    events.unshift(event);
    localStorage.setItem('car_analytics_events', JSON.stringify(events.slice(0, 80)));
  } catch (e) {
    console.error('Analytics save failed', e);
  }
  if (window._firebaseReady && window._auth && window._auth.currentUser && window._setDoc && window._doc) {
    try {
      const eventRef = window._doc(window._db, 'organizations', window.getCurrentOrgId(), 'events', event.id);
      await window._setDoc(eventRef, { ...event, syncedAt: Date.now() });
      event.syncedAt = Date.now();
      // Mirror the sync back into the persisted queue — without this, every
      // event stays permanently marked unsynced in localStorage even after
      // succeeding here, so flushAnalyticsEvents() (which trusts that flag to
      // skip already-sent events) re-attempts every event on every flush.
      // The events collection intentionally disallows `update` once created
      // (firestore.rules), so that redundant re-send always failed with a
      // permission error — harmless (analytics is best-effort, already
      // caught), but a real bug: found via the local-emulator test harness.
      try {
        const raw = localStorage.getItem('car_analytics_events');
        const events = raw ? JSON.parse(raw) : [];
        const idx = events.findIndex(e => e.id === event.id);
        if (idx >= 0) {
          events[idx].syncedAt = event.syncedAt;
          localStorage.setItem('car_analytics_events', JSON.stringify(events.slice(0, 80)));
        }
      } catch (e) {}
    } catch (e) {
      console.warn('Analytics sync failed', e);
    }
  }
  return event;
};

window.flushAnalyticsEvents = async function() {
  if (!window._firebaseReady || !window._auth || !window._auth.currentUser) return;
  const events = window.getLocalAnalyticsEvents(80);
  if (!events.length) return;
  for (const event of events) {
    if (event.syncedAt) continue;
    try {
      const ref = window._doc(window._db, 'organizations', event.orgId, 'events', event.id);
      await window._setDoc(ref, { ...event, syncedAt: Date.now() });
      event.syncedAt = Date.now();
    } catch (e) {
      console.warn('Analytics flush failed', e);
    }
  }
  localStorage.setItem('car_analytics_events', JSON.stringify(events.slice(0, 80)));
};
