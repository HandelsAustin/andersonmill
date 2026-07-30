# TODO

## In Progress (newest session — login/PIN rework)
- ✅ **No more anonymous "Continue as Employee" mode.** The entry screen (`#entryOverlay`) is now the login form itself (email + password + Forgot password, same fields as before) — every session signs in with a shared per-store email/password. `enterEmployeeMode()`, `car_employee_session`, and the standalone `#authOverlay`/`closeAuthModal()` are removed entirely; `openAuthModal()` now just shows the entry screen (or signs out, if already signed in).
- ✅ **Store picker is now actually scoped** (`js/store-org.js`: `_scopedStores()`) — previously `members/{uid}.stores[]` was written on account creation but never used to filter; any org member could see/pick *every* store in the org. Now non-corporate accounts only see the store(s) in their own `stores[]`; CORPORATE_ADMIN still sees all. `loadCurrentUserRole()` (`js/auth.js`) now also captures `window._userStores` from the member doc for this filtering.
- ✅ **All four tabs + Dashboard are always visible** to any signed-in account — no more role-based hiding. `updateRoleUIVisibility()` no longer touches `tabBtnInventory`/`tabBtnSettings`/`dashboardBtn` display at all.
- ✅ **Shared 4-digit manager PIN per store** (`store.managerPin` field, `js/manager-lock.js`) gates Dashboard (store-tier path only)/Inventory/Store Settings/Edit Flavors — replaces role-based hiding as the actual gate. Firestore-backed (not per-device localStorage like the old dead-code version), so a PIN change applies on every device immediately. First-ever access at a store with no PIN set opens in "Set PIN" mode. `requireManager()` — previously only checked Firebase auth and never actually invoked the PIN modal (`openPinModal()` had zero callers anywhere) — is now properly wired up.
- ✅ **CORPORATE_ADMIN bypasses the PIN entirely** (already a personally-authenticated, elevated account) — gets the corporate dashboard *and* any individual store's manager dashboard (`openDashboard()` in `js/dashboard.js`) without a PIN prompt.
- ✅ **"Forgot PIN"** — no email step (confirmed with the user: this app has no backend/Cloud Functions, so a custom "reset your PIN" email isn't feasible without meaningfully new infrastructure). Instead: re-confirm the store login's password via Firebase `reauthenticateWithCredential`, then set a new PIN immediately. New `#pinReauthForm` sub-view inside the existing PIN modal.
- ✅ **Switch Store** section added to the Store Settings tab (`js/settings.js`) — lists the account's accessible stores (same scoped list), one-tap switch via the existing `selectStore()`. Found and fixed a real bug while building this: switching stores didn't reset `_managerUnlocked`, so unlocking the PIN at Store A would silently also unlock Store B's manager features without ever entering Store B's PIN. `selectStore()` now calls `lockManager()` and bounces back to the Run tab on every switch.
- Deliberately deferred (flagged to the user, not silently dropped): corporate-editable master flavor list (`MASTER_ROSTER` is a hardcoded JS array, not Firestore data — migrating it is a separate chunk of work) and extending Users & Roles to let corporate assign additional stores to an existing account (today's bootstrap-a-new-store-login mechanism still works, just isn't self-service for adding a 2nd/3rd store to one account).
- `firestore.rules` — **no changes needed** for this pass; `managerPin` is just a new field on the existing `stores/{storeId}` doc, covered by the existing `isStoreManager()` write rule.

## In Progress (prior session — bottom tab nav + date-recallable history)
- ✅ **Bottom tab bar** replaces the header-button/popup-overlay pattern for Novelties/Inventory/Settings: 4 fixed tabs (Ice Cream Run, Novelties, Inventory, Store Settings) via `switchTab()` in `js/app-core.js`. Ice Cream Run + Novelties visible to everyone; Inventory + Store Settings hidden unless signed in as STORE_MANAGER/CORPORATE_ADMIN (same gating as the old header buttons, now applied to `#tabBtnInventory`/`#tabBtnSettings` in `updateRoleUIVisibility()`). `#settingsOverlay`/`#noveltiesOverlay`/`#inventoryOverlay` (mentioned in earlier entries below) no longer exist as popups — their content divs (`#settingsContent` etc.) now live directly in `#tabPanelSettings`/`#tabPanelNovelties`/`#tabPanelInventory`, in-page. `openSettings()`/`openNovelties()`/`openInventory()` etc. still exist as thin `switchTab()` wrappers for backward compatibility.
- ✅ **Ice Cream Run date recall**: `organizations/{orgId}/stores/{storeId}/runs/{date}` subcollection holds `activeFlavors`/`cateringItems` per day (roster stays on the store doc — persistent, not per-day). `loadRunForDate(date)` swaps the working date, live `onSnapshot` follows whichever date is loaded, `saveAll()` now writes roster fields to the store doc and run fields to `runs/{_workingRunDate}` in the same call. "📅 Today ▾" picker at the top of the Run tab lists recent dates (`orderBy('__name__','desc')` — doc IDs are already `YYYY-MM-DD`) plus a "↩ Back to Today" control. `resetDay()` always snaps back to today first — it starts a fresh day, it doesn't edit history.
- ✅ **Novelties pivoted to a daily make-checklist** (matches the Run's model): `novelties` is now the persistent catalog (category/name/parLevel only); `noveltiesLog/{date}` holds that day's `{onHand, done}` per item. Make qty = `max(0, parLevel - onHand)`, shown per row; "Mark Made" checks an item off for the day (greyed + struck through), live-updating page summary ("N items still need to be made today"). Same date-recall picker pattern as the Run. No live `onSnapshot` for this one (single-session task, load-on-demand is enough).
- ✅ **Inventory overhaul**: catalog renamed `inventoryItems` → `inventoryCatalog`, extended with `pricePerUnit`, `locationOrder`, `distributorOrder`; per-date counts live in `inventoryLog/{date}` (`{name, onHand}` only — order qty/value always computed live from the catalog's current price/par, never duplicated into history). **CSV import** with flexible column-mapping (`_parseCSV()` — quoted-comma-aware parser, since distributor export formats aren't known in advance and can't be hardcoded): upload → detect headers → map each to Name*/Price/Category/Location Order/Distributor Order/Par → preview with duplicate detection → commit. **Dual sort toggle** (`_inventorySortMode`) between store-location order (for physical counting) and distributor-site order (for placing the order) — mirrors the existing cabinet-sort toggle pattern in `roster.js`. **Total Inventory Value** ($ on-hand × price, summed) shown at the top of the tab. Same date-recall picker as the Run/Novelties.
- ✅ `firestore.rules`: added `runs/{date}`, `noveltiesLog/{date}`, `inventoryLog/{date}` under the existing `stores/{storeId}` match (same `isOrgMember()`-read / `isStoreManager()`-write pattern). Verified against a real Firestore emulator with `@firebase/rules-unit-testing` (not just the repo's existing `firebase-admin`-based suite, which bypasses rules entirely and doesn't actually test enforcement) — 12/12 checks passed: manager read+write, employee read-only, non-member/unauthenticated denied entirely, across all three subcollections.
  - ✅ Deployed to production by the user (this environment can't run `firebase deploy` itself — no interactive browser login available in this sandbox).

## In Progress (prior session — Settings/Novelties/Inventory v1, now superseded by tabs above)
- ✅ "Forgot password?" on the Manager Login modal — calls Firebase `sendPasswordResetEmail`; empty-email and malformed-email are validated client-side, and a nonexistent email shows the same non-committal "if an account exists…" message as a real send (avoids leaking which emails have manager accounts). Verified error-handling paths locally; the actual email send can only be confirmed from an authorized domain (Firebase blocks the API key's requests from unauthorized referrers, same constraint as sign-in itself — see "Add Vercel URL to Firebase Console → Authorized domains" below).
- ✅ Modularized `index.html`'s ~3,500-line inline script into `js/auth.js`, `js/roster.js`, `js/production.js`, `js/manager-lock.js`, `js/store-org.js`, `js/dashboard.js`, `js/app-core.js` — mechanical split, zero logic changes, verified via scripted line-coverage check (all 177 top-level declarations accounted for exactly once) + headless-browser smoke test (entry screen + employee/store-picker flow render with zero console errors against live Firestore)
- ✅ `vercel.json`: added `/js/:path*` to the no-aggressive-cache rule (matches `appHelpers.js`/`config.js`) so module updates deploy immediately
- ✅ **Critical bug fix**: `getOrgDocRef()`/`getStoreDocRef()`/`getOrgMemberRef()` were redeclared as local wrapper functions in `store-org.js` that called `window.getOrgDocRef()` etc. — but a top-level `function` declaration overwrites the `window.*` property of the same name, so each wrapper ended up calling itself and recursing infinitely (`RangeError: Maximum call stack size exceeded`), silently breaking every real Firestore read/write through these three refs (org metadata load, `saveAll`, `loadAll`, role load, `writeRunSummary`, store creation). Masked in production by the offline-first try/catch fallback to localStorage. Confirmed pre-existing (present in the pre-split monolith too, not introduced by the modularization). Fixed by removing the redundant wrapper declarations — bare `getOrgDocRef()` calls now correctly resolve to the real `window.getOrgDocRef` from `appHelpers.js`.
- ✅ `saveAll()` now writes with `{ merge: true }` instead of a full-document `setDoc` — previously every flavor toggle/increment would silently wipe `label`, `lastRunDate`, `lastRunBuckets`, `storeEvents`, and (now) `settings` from the store doc
- ✅ Manager Settings page (`js/settings.js`, `#settingsOverlay`, gated `⚙ Settings` header button for STORE_MANAGER/CORPORATE_ADMIN): Store Profile (phone/email/hours), Flavor Roster management entry point + bulk import, Users & Roles (CORPORATE_ADMIN only, role editing via `organizations/{orgId}/members`), Order & Inventory Config (lead time + count interval, feeds the upcoming Inventory phase), App Preferences theme toggle (dark/light) scoped to Settings/Novelties/Inventory overlays only via CSS variables — production/dashboard screens intentionally stay dark-only this pass (inline-style architecture, flagged in the plan)
- ✅ Bulk flavor import (inside Settings → Flavor Roster): paste "Name" or "Name, Type" per line → preview with duplicate detection against the existing roster → commit adds all at once via the existing roster-add shape
- ✅ Novelties page (`js/novelties.js`, `#noveltiesOverlay`, toolbar `🍦 Novelties` button — open to all users like Edit Flavors/Reset, since staff do the daily counting): 37 pre-packaged items seeded from the fixed catalog (Ice Cream Sandwiches, Handel Pops, Hurricane Toppings, Waffle Bowls, Waffle Cones, Ice Cream Maker Cambros, Chocolate Bananas, Sundae Bases), grouped by category, rapid-fire +/- stepper per item (same hold-to-accelerate interaction as the production run counters, generalized into `_attachStepper`), live refill-status chip (Stocked/Low/Refill now) and page-level summary count that updates as counts change, manager-gated (`requireManager`) par-level edit + add/remove items with undo toast
- ✅ Inventory tracking with biweekly order calculations (`js/inventory.js`, `#inventoryOverlay`, gated `📦 Inventory` header button for STORE_MANAGER/CORPORATE_ADMIN): separate manager-configured supply catalog (name/unit/par/on-hand — distinct from Novelties per explicit choice), order qty = max(0, par − on-hand), per-item history (capped 6 entries, one per day) shown as a reference trail alongside the par (the "hybrid" approach), "Mark Count Complete" records history + resets the cadence clock, due-banner shows once `settings.inventory.inventoryCountIntervalDays` (from Settings, default 14) has elapsed since the last full count, Order List section + print view (reuses the `printInventory()`/`printRun()` print-window pattern from `production.js`)

## High Priority
- Per-org Firestore security rules (scope reads/writes to org members)
- Improve offline reliability
- Add `icons/icon-192.png` + `icons/icon-512.png` for full Android Chrome install prompt

## Catering Production (completed this pass)
- ✅ Run Preparation overlay before production starts
- ✅ Inline catering entry: flavor selector + bucket qty + Add/Remove
- ✅ `_cateringItems` persists across recalculations; cleared on run complete
- ✅ Catering checkboxes in run rows: 🍨 badge + amber accent, after daily
- ✅ `isFullyDone` requires both daily + catering completion
- ✅ Skip button skips daily AND catering for a flavor
- ✅ Undo clears both daily and catering dismissals
- ✅ Catering-only flavors appear in run when active flavors have toMake=0
- ✅ Run summary shows catering bucket count separately
- ✅ storeEvents records cateringBuckets + cateringFlavors per run
- ✅ Interrupted-run recovery restores catering items from car_run_state

## Manager Dashboard (completed this pass)
- ✅ `openDashboard()` routes by role: CORPORATE_ADMIN → corporate, STORE_MANAGER → manager
- ✅ Dashboard button visible for both CORPORATE_ADMIN and STORE_MANAGER
- ✅ Today's Production hero: Buckets Made / Flavors / Avg Bkts/Hr (3-column grid)
- ✅ Inventory Health: Stocked / Low / Critical color-coded chips
- ✅ Current Shortages: sorted, tappable → opens Edit Flavors
- ✅ Production Trend · 7 Days: text-only ↑/↓/→ + percentage
- ✅ Top Flavors — Last 30 Days: top 3 from storeEvents[].flavors
- ✅ Bottom Flavors — Last 30 Days: bottom 3 distinct from top 3
- ✅ Store Status: online/offline, last sync, last production
- ✅ `writeRunSummary()` now writes `durationMs` for Avg Bkts/Hr
- ✅ `applyData()` caches raw store data in `_storeDoc` for fallbacks
- Note: avg bph and flavor analytics only for runs after this deploy

## Corporate Dashboard (completed this pass)
- ✅ Email display: `word-break:break-word` prevents overflow; email moved to info bar
- ✅ Current store: shows `store.label` (human-readable), not raw slug ID
- ✅ Org labels: "handels" → "Handel's Homemade Ice Cream" via `_getOrgDisplayName()` + `window._orgName`
- ✅ Removed "Needs Attention" section (`buildAttentionAlerts`, `renderNeedsAttention`)
- ✅ Removed "Recent Activity Log" section (`renderAnalyticsSummary`, `getRecentAnalyticsEvents`)
- ✅ Added "Top Flavors — Last 30 Days" — top 3 flavors by bucket count from storeEvents
- ✅ `writeRunSummary()` now captures `flavors: {name: count}` per run for analytics
- ✅ Dashboard layout: info bar (org name + email + role pill) replaces redundant heading

## Auth & Session (completed this pass)
- ✅ Entry screen: "Continue as Employee" / "Manager Sign In" — identity before store context
- ✅ Employee mode: sessionStorage-scoped, auto-clears on browser close
- ✅ Welcome-back: saved store shown with one-tap Continue on return visits
- ✅ Role loading: automatic from Firestore after sign-in, never manually selected
- ✅ Role selector: removed entirely from UI
- ✅ Store label cached to localStorage for offline welcome-back display

## Deployment (one-time post-Vercel steps)
- [ ] Add Vercel URL to Firebase Console → Authentication → Authorized domains
- [ ] Test sign-in on live URL before inviting store staff
- [ ] Verify SW registers in DevTools → Application → Service Workers
- [ ] Add `icons/icon-192.png` + `icons/icon-512.png` to `manifest.json` for full Android Chrome install prompt (SVG-only works for iOS; PNG required for Android)

## Done (this session)
- ✅ Pilot readiness hardening pass
  - `resetDay()` now clears `runDismissed`, `_totalBucketsMade`, `car_run_state` — prevents stale run state corrupting next run
  - `doneRun()` + `clearRunView()` clear `car_run_state` on completion
  - Interrupted-run recovery: `car_run_state` written at run start + each dismiss; `init()` shows warning toast if < 12h old state found
  - `beforeunload` warning when `runMode && _totalBucketsMade > 0` — browser dialog guards accidental refresh mid-run
  - Store picker close button (`× Not now`) when a store is already loaded — prevents stuck-state from accidental Org tap
  - Escape key dismisses store picker when store already selected
  - iOS install hint suppressed when stale-run recovery toast is active
- ✅ First real store readiness pass
  - Empty state: manager sees 🧁 "Set up today's flavors" + inline action button; employee sees "Ask a manager"; run-mode unchanged
  - `#pickerHint`: "Tap a flavor name to add it to today's list" — shown when 0 selected, hidden on first toggle
  - `car_just_created` localStorage flag: set in `createOrgAndStore()`, consumed in `init()` → 8s setup nudge toast
  - `_showInstallHint()` / `_dismissInstallHint()`: one-time iOS Safari banner → "Share ⬆ → Add to Home Screen"; auto-dismisses 15s; skipped if already installed or not iOS
  - Reconnect copy: "your work is safe" instead of "syncing..."
  - Org button: `title="Switch organization"` tooltip
- ✅ PWA and deployment-readiness hardening pass
  - `manifest.json`: standalone display, brand colors, SVG icon, orientation any
  - `sw.js`: cache-first for app shell + Firebase CDN; bypasses Firestore/Auth APIs; purges old caches on activate; `count-and-run-v1` cache key (bump to bust)
  - `icons/icon.svg`: C&R monogram, brand blue/red, scales to all sizes
  - `index.html`: `viewport-fit=cover`, 6 PWA meta tags, `@supports` safe-area-inset CSS for notch/home-indicator, `#pwaInstallBtn` toolbar button (hidden until `beforeinstallprompt` fires), SW registration with update toast
  - Note: add `icons/icon-192.png` + `icons/icon-512.png` to manifest for full Android Chrome install prompt coverage
- ✅ Operational safety and error-prevention pass
  - `resetDay()`: `confirm()` → instant-apply + 5s undo toast with snapshot restore (matches existing roster-delete undo pattern)
  - `showUndoToast(msg, undoFn)`: now generic — accepts undo callback; two undo windows (reset/roster) commit each other cleanly
  - `confirmDoneRun()`: double-tap guard on ✓ Done — warns if `_totalBucketsMade > 0`, confirms on second tap within 3s; normal flow unaffected
  - `renderTable()`: early-return guard when inline tap-to-type input is active — prevents snapshot from destroying mid-edit value
  - `setSyncStatus('error')`: tappable retry — "tap to retry" text, onclick calls `saveAll()`, cleared on all other states
  - Rapid-fire `+` clamp at 99 — `Math.min(99, ...)` in both `tick` and `start` functions
- ✅ Production workflow speed optimization pass
  - Run banner sticky: `position:sticky; top:0; z-index:50` — Done button always accessible during long runs
  - Dipping dropdown min-height 36→44px (WCAG 2.5.8)
  - Run mode checkboxes 28→36px
  - Skip button min-height 40→44px
  - Hold `+`/`−` rapid-fire: pointer events replace click, accelerating intervals (400ms→60ms), single save on release
  - Tap-to-type on holding value: inline `<input inputmode="numeric">` with `settled` double-commit guard
- ✅ Operational UX refinement pass
  - Hold counter `+`/`−` buttons: 32→44px (WCAG 2.5.8 touch target minimum)
  - Store picker: overlay opens immediately with loading indicator; no more empty-flash on slow connections
  - Store detail accordion: `scrollIntoView` on panel open — panel always visible even when card is near bottom of screen
  - Run summary: "Total Buckets Made" visually prominent (32px green value, separator from secondary metrics)
  - `calculateRun()` 0-bucket guard: skips run mode entirely, shows toast — eliminates confusing dead-end flow
  - Run banner: two-line layout (18px bucket count + 11px sub-line) — readable at tablet arm's length
  - `syncStatus`: 12px font + left-border urgency indicator (amber offline, red error, transparent normal)
  - Picker search focus delay: 60ms→10ms
- ✅ Lightweight sync/offline operational health visibility
  - `_lastSyncAt` — session-level timestamp set on every successful cloud save or load
  - `_wasOffline` — connectivity state tracker for reconnect detection (offline→online transition)
  - `_syncAgeColor(ts)` — pure helper: muted < 1h, amber 1–4h, red > 4h; null-safe fallback
  - `setSyncStatus('reconnected')` — new state: 3s reconnect confirmation then auto-reverts; offline message now shows "— last sync Xm ago" when prior sync exists
  - `updateConnectivityStatus()` — detects offline→online transition via `_wasOffline`; fires `'reconnected'` only after a real prior offline period
  - Store detail "Last sync" timestamp colorized with `_syncAgeColor(store.updatedAt)`
  - Per-store card "last updated" text colorized with `_syncAgeColor(store.updatedAt)`
  - Zero Firestore reads, writes, or new fields; all signals from in-memory session state + existing `updatedAt` field
- ✅ Lightweight operational activity attribution
  - `_currentUserName()` — derives first-name display from auth email, null when unauthenticated
  - `writeRunSummary()` — adds optional `by` field to storeEvents[] entry when signed in
  - `_activityLabel(ev)` — appends `· by [name]` in muted inline span when ev.by is present
  - Zero Firestore reads/writes added; backward-compatible with all pre-attribution events
  - Attribution appears in "Recent Activity" feed in store detail panel
- ✅ Operational Trend Indicators in corporate dashboard
  - `calcStoreTrend(store)` — pure function, splits `storeEvents[]` run history into older/recent halves, compares avg buckets, ±10% threshold for up/down/stable, null below 3 events
  - `_renderTrendBadge(trend)` — compact inline DOM badge (↑ ↓ →), returns null when trend is null
  - Badge shown on per-store cards (before chevron) and inside store detail panel header (below store name)
  - Zero Firestore reads or writes — uses storeEvents[] already in loadOrgStores() result
- ✅ Store Activity Timeline in store detail panel
  - `storeEvents[]` array field on store doc (max 10 entries, oldest trimmed)
  - `writeRunSummary()` appends `run_completed` entry + writes field in same existing setDoc call
  - `applyData()` loads `_storeEvents` from store doc snapshot — no extra reads on write
  - `_activityLabel(ev)` — human-readable event label, extensible for future event types
  - Detail panel "Recent Activity" section: up to 5 entries, newest first, relative timestamps
  - Backward-compat fallback: synthesizes from `lastRunAt`/`lastRunBuckets` for pre-update stores
  - Replaced "Last run" single-line row with full activity feed
- ✅ Store Detail View in corporate dashboard
  - `showStoreDetail(store, anchorEl)` — accordion toggle, one panel open at a time, zero extra Firestore reads
  - `_buildStoreDetailPanel(store, anchorEl)` — status row, metrics (Made Today / Flavors / Shortages), last run, shortage flavor list with `toMake()`, active flavor roster grouped by type
  - Click handlers on Needs Attention alert rows + Store Overview cards
  - `›` chevron expand indicator on per-store cards (rotates on open)
  - `store` reference added to alert objects in `buildAttentionAlerts`
- ✅ Needs Attention section in corporate dashboard
  - `buildAttentionAlerts(stores)` — pure function, 4 alert types: shortages (urgent), no activity (warning), stale data (warning), low production (notice)
  - `renderNeedsAttention(containerEl, alerts)` — compact colored rows or all-clear green state
  - No extra Firestore reads — shares `loadOrgStores()` data with multi-store overview
  - Alerts appear before the per-store overview cards
- ✅ Multi-Store Overview in corporate dashboard
  - `renderMultiStoreOverview(content)` — async, per-store cards with flavor count, shortage count, buckets made today, last-active status
  - Summary chips: Active Today, Shortages, Buckets Made Today (org-wide totals)
  - `writeRunSummary()` — writes `lastRunDate`/`lastRunBuckets` to store doc on run completion
  - Helpers: `todayStr()`, `storeIsActiveToday()`, `storeShortagesCount()`, `storeProductionToday()`, `relativeTime()`
- ✅ Add Store flow in corporate dashboard (CORPORATE_ADMIN only)
  - `renderStoreForm(containerEl, opts)` — shared closure-based form builder, no duplicate IDs
  - `renderAddStoreSection(content)` — dashboard panel calling `renderStoreForm`, shows success + re-renders dashboard
  - `showOrgSetupForm()` refactored to delegate to `renderStoreForm()` — zero logic duplication
  - Removed dead `submitOrgSetup()` — replaced by form closure
- ✅ Org onboarding flow: signed-in manager can create org + first store from within the app
  - `createOrgAndStore()` writes `organizations/{orgId}`, `stores/{storeId}`, and `members/{uid}` (CORPORATE_ADMIN)
  - Store ID auto-generated as URL-safe slug from store name
  - Guards: offline check, auth check, input validation, double-submit protection
- ✅ Firestore path structure `organizations/{orgId}/stores/{storeId}` (in appHelpers.js)
- ✅ Centralized org/store ref helpers in appHelpers.js
- ✅ Removed duplicate `getOrgMemberRef` override in index.html that bypassed helpers
- ✅ `loadCurrentUserRole` and `setCurrentUserRole` now use `getCurrentStoreId()` consistently
- ✅ User role system (CORPORATE_ADMIN, STORE_MANAGER, EMPLOYEE)
- ✅ Lightweight corporate dashboard
- ✅ Analytics event tracking (local + Firestore sync)

## Medium Priority
- Improve mobile production workflows
- Add PWA installability improvements
- Improve sync reliability
- Create reporting foundations

## Future Ideas
- Forecasting
- Waste analytics
- Labor insights
- AI production recommendations
