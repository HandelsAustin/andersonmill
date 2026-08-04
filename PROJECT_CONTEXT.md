# Project Context

## Project Name
Count & Run

## Purpose
A multi-store operational SaaS platform for ice cream and food production workflows.

## Current Goals
- Multi-organization support ✅ (onboarding flow implemented)
- Store-level production management
- Corporate dashboard visibility ✅ (multi-store overview implemented)
- Offline-capable tablet workflows
- PWA installability ✅ (manifest, service worker, iOS install hint, Chrome install prompt)
- Analytics event tracking ✅
- First-store readiness ✅ (role-aware empty states, picker hint, post-creation nudge)
- Pilot readiness ✅ (interrupted-run recovery, beforeunload guard, store picker escape, stale run state fixes)

## Current Tech Stack
- HTML/CSS/JavaScript
- Firebase Firestore
- Firebase Authentication
- PWA architecture
- VS Code + Claude Code

## Important Philosophy
- Avoid overengineering
- Prioritize maintainability for a solo founder
- Keep architecture simple but scalable
- Preserve existing workflows
- Work incrementally

## Roles & Access Model
- No anonymous/employee mode — every session signs in with email + password (the entry
  screen *is* the login form). That login is typically a **shared per-store credential**
  ("whoever's on shift" uses the store's login), not one account per employee.
- CORPORATE_ADMIN — assigned to org creator on first setup; sees every store in the org,
  gets the corporate dashboard, and bypasses the manager PIN entirely (already a personally
  authenticated, elevated account).
- STORE_MANAGER — the role every other account gets; scoped to the store(s) in its member
  doc's `stores[]` (enforced client-side in `js/store-org.js`: `_scopedStores()`). No longer
  a distinct "manager tier" for UI purposes — any store login sees all 4 tabs, and a
  **shared 4-digit PIN per store** (`store.managerPin`, `js/manager-lock.js`) gates
  Dashboard/Inventory/Store Settings/Edit Flavors instead.
- `ROLES.EMPLOYEE` constant still exists (harmless) but is never assigned to a real session.

## Firestore Structure (Live)

```
organizations/{orgId}
  name, createdAt, createdBy
  customFlavors: [{name, category, type}]
    ← corporate-added flavors (js/roster.js addNewToRoster()), merged into every store's
      roster alongside MASTER_ROSTER — only CORPORATE_ADMIN can add; applies org-wide

organizations/{orgId}/stores/{storeId}
  id, label, createdAt, createdBy
  managerPin                                           ← shared 4-digit PIN, gates manager features (js/manager-lock.js)
  customAdded, removedNames, updatedAt                 ← flavor roster (persistent; NOT per-day)
  currentFlavorList: [{name, target, cabinet?}]         ← persistent default Today's Flavor List + target numbers;
                                                           written by saveAll() whenever today's list/targets change,
                                                           seeded into any new day's run doc that doesn't exist yet
                                                           (js/store-org.js: loadRunForDate()) so the list survives
                                                           day rollover until a manager edits it again
  lastRunDate, lastRunBuckets, lastRunAt               ← written on run completion
  storeEvents: [{type, buckets, at, by?}]               ← activity log, max 10 entries, trimmed on write; by = first-name attribution (optional, signed-in users only)
  settings: { profile: {phone, email, hours}, inventory: {orderLeadTimeDays, inventoryCountIntervalDays}, theme }
    ← Manager Settings page (js/settings.js); merged onto the store doc, no new collection
  novelties: [{category, name, parLevel}]
    ← Novelties catalog (js/novelties.js) — persistent; daily on-hand/done state lives in noveltiesLog/{date} below
  inventoryCatalog: [{name, unit, category, parLevel, pricePerUnit, locationOrder, distributorOrder, history}], inventoryLastCountedAt
    ← Inventory catalog (js/inventory.js) — persistent; per-count on-hand lives in inventoryLog/{date} below.
      pricePerUnit/locationOrder/distributorOrder support CSV import, dual sort, and $ valuation.

organizations/{orgId}/stores/{storeId}/runs/{date}                 (date = YYYY-MM-DD)
  activeFlavors, cateringItems, updatedAt
  ← One doc per day's Ice Cream Run — recallable/re-editable, not just a rolling summary.
    activeFlavors used to live directly on the store doc; moved here so history doesn't
    bloat the doc that's read on every app load. Live onSnapshot follows whichever date
    is currently loaded (js/store-org.js: loadRunForDate()).

organizations/{orgId}/stores/{storeId}/noveltiesLog/{date}
  items: [{category, name, onHand, done}], updatedAt
  ← One doc per day's Novelties checklist (js/novelties.js: loadNoveltiesForDate()).

organizations/{orgId}/stores/{storeId}/inventoryLog/{date}
  items: [{name, onHand}], updatedAt
  ← One doc per inventory count session (js/inventory.js: loadInventoryForDate()).

All three date-log subcollections are covered by firestore.rules (isOrgMember() read /
isStoreManager() write, same as the store doc) — deployed to production.

organizations/{orgId}/members/{uid}
  uid, email, role, stores[], createdAt

organizations/{orgId}/events/{eventId}
  type, orgId, storeId, role, userUid, payload, createdAt, syncedAt
```

## Onboarding Flow
1. First load → entry screen (login form) → sign in
2. No saved store → store picker opens, scoped to this account's stores[] (or all, for corporate)
3. Brand new org (zero stores exist anywhere) → inline "Create first store" form instead
4. User fills store name → store ID auto-slugged → clicks "Create Store"
5. Writes org doc, store doc, and member doc (CORPORATE_ADMIN)
6. Selects store → prompted to set this store's manager PIN the first time a gated feature is opened → app proceeds normally

## Important Constraints
- Mobile-first usability
- Tablet-friendly workflows
- Offline reliability
- Fast production workflows
- Minimal employee friction

## Long-Term Vision
A licensable multi-tenant SaaS platform for food production and operational management.
