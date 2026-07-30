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

## Roles
- CORPORATE_ADMIN — assigned to org creator on first setup; full access
- STORE_MANAGER — assigned via Firebase auth; store-level access
- EMPLOYEE — default unauthenticated role; production workflow only

## Firestore Structure (Live)

```
organizations/{orgId}
  name, createdAt, createdBy

organizations/{orgId}/stores/{storeId}
  id, label, createdAt, createdBy
  customAdded, removedNames, updatedAt                 ← flavor roster (persistent; NOT per-day)
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
isStoreManager() write, same as the store doc) — ⚠ not yet deployed to production as of
this writing; see TODO.md.

organizations/{orgId}/members/{uid}
  uid, email, role, stores[], createdAt

organizations/{orgId}/events/{eventId}
  type, orgId, storeId, role, userUid, payload, createdAt, syncedAt
```

## Onboarding Flow
1. First load → no saved store → store picker opens
2. No stores in Firestore → if signed in: shows inline "Create first store" form
3. User fills store name → store ID auto-slugged → clicks "Create Store"
4. Writes org doc, store doc, and member doc (CORPORATE_ADMIN)
5. Selects store → app proceeds normally

## Important Constraints
- Mobile-first usability
- Tablet-friendly workflows
- Offline reliability
- Fast production workflows
- Minimal employee friction

## Long-Term Vision
A licensable multi-tenant SaaS platform for food production and operational management.
