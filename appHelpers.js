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
  window._ORG_ID = window.APP_STATE.orgId;
  localStorage.setItem(STORAGE_KEYS.orgId, window.APP_STATE.orgId);
};

window.setStoreId = function(storeId) {
  window.APP_STATE.storeId = storeId;
  window._STORE_ID = storeId;
  if (storeId === undefined || storeId === null) {
    localStorage.removeItem(STORAGE_KEYS.storeId);
  } else {
    localStorage.setItem(STORAGE_KEYS.storeId, storeId);
  }
};

window.setUserRole = function(role) {
  window.APP_STATE.userRole = role;
  window._USER_ROLE = role;
  localStorage.setItem('car_user_role', role);
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

window.getCurrentUserRole = function() {
  return window.APP_STATE.userRole;
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
window.getStoreEventDocRef = function(eventId, orgId = window.getCurrentOrgId(), storeId = window.getCurrentStoreId()) {
  return window._doc(window._db, 'organizations', orgId, 'stores', storeId, 'events', eventId);
};
