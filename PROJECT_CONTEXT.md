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
  activeFlavors, customAdded, removedNames, updatedAt  ← production data
  lastRunDate, lastRunBuckets, lastRunAt               ← written on run completion
  storeEvents: [{type, buckets, at, by?}]               ← activity log, max 10 entries, trimmed on write; by = first-name attribution (optional, signed-in users only)
  settings: { profile: {phone, email, hours}, inventory: {orderLeadTimeDays, inventoryCountIntervalDays}, theme }
    ← Manager Settings page (js/settings.js); merged onto the store doc, no new collection
  novelties: [{category, name, onHand, parLevel}]
    ← Novelties page (js/novelties.js); daily on-hand/refill tracking for pre-packaged items
  inventoryItems: [{name, unit, onHand, parLevel, history: [{date, onHand}]}], inventoryLastCountedAt
    ← Inventory page (js/inventory.js); separate supply catalog, biweekly order qty = par − on-hand

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
