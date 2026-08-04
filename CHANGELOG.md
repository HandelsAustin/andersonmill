# Changelog

## Current Version
v0.2

---

## Recent Changes

### Follow-up: Novelties Fraction Picker Moved to On Hand (2026-08-03)
- **Fixed:** corrects the previous entry below — the Empty/1/4/1/2/3/4/Full picker belonged on **On Hand**, not Target. Target is a free-typed number for all eight categories now (same widget everywhere, `TARGET_OPTIONS`/`FRACTION_OPTIONS` dropdown fully removed); stores that picked up the brief bad version self-heal any non-numeric Target back to the default (5) the first time the page renders.
- **Changed:** Hurricane Toppings' On Hand is the single-container fill picker (`HURRICANE_FILL_OPTIONS`): Empty/1/4/1/2/3/4/Full.
- **Changed:** Ice Cream Maker Cambros' On Hand is a compact whole-count number input plus a quarter-fraction select (`_buildCambroOnHandWidget()`), so staff can enter e.g. "1 1/2" — more than one cambro can be on hand at once, unlike a single topping bin.
- Both store On Hand as a plain decimal internally, so `_toMakeNovelty()` is back to one generic `target − onHand` formula for every category (no more special-cased "Fill" flag) — `_formatQty()` turns the decimal back into a "1 1/2"-style string for the To Make column and the print view.

### Cabinet Numbers 1–6, Novelties Target Rework (2026-08-03)
- **Changed:** the dipping-cabinet picker now offers 1–6 instead of 1–4 (`.cabinet-btns` moved to a 3-column grid so it stays touch-friendly with two rows of three; `index.html` static picker and `js/roster.js`'s `restoreCabinetBox()` both updated).
- **Changed:** Novelties tab — categories reordered to Waffle Cones, Waffle Bowls, Handel Pops, Ice Cream Sandwiches, Chocolate Bananas, Sundae Bases, Hurricane Toppings, Ice Cream Maker Cambros.
- **Changed:** Novelties Target column — Ice Cream Sandwiches, Handel Pops, Chocolate Bananas, Waffle Cones, Waffle Bowls, and Sundae Bases now take a free-typed number (previously capped at the shared 0–10 `TARGET_OPTIONS` dropdown). Hurricane Toppings and Ice Cream Maker Cambros instead get an Empty/1/4/1/2/3/4/Full fill-level picker (`FRACTION_OPTIONS`/`makeStringSelect()`, `js/roster.js`), since those track a bulk container's fill level rather than a countable quantity — existing stores with a legacy numeric value there self-heal to 'Full' the first time the page renders. To Make shows a simple "Fill" flag for those two categories instead of a computed quantity (there's no numeric target to diff On Hand against); Made stays the same quantity-stepper button as every other category. Target still persists on the store doc via `saveNoveltiesCatalog()` exactly as before — it was already never reset day-to-day, unlike the Run tab's flavor list (see below).
- **Changed:** every category's table now shares one fixed-pixel `<colgroup>` (`NOVELTY_COLGROUP`) instead of auto-sizing its own columns from its own content, so Item/Target/On Hand/To Make/Made line up at the same x-position all the way down the page regardless of category.
- Reset already cleared On Hand back to 0 and reset the Made button (`resetNoveltiesDay()`) — confirmed, no change needed.

### Persistent Sign-In, Persistent Flavor List (2026-08-03)
- **Fixed:** the app could appear to "sign users out" on its own even though the underlying Firebase session was never destroyed. Root cause: on cold start, `js/app-core.js`'s `waitForFirebaseAndBootstrap()` has a safety-timeout fallback that shows the login screen if Firebase's auth-state restore (async, reads from IndexedDB) hasn't reported back yet. On a slow/cold device that restore can take longer than the old 3s window, so the timeout won — showing the login screen — and then when the real (still-valid) signed-in session landed a moment later, nothing ever hid that screen or finished loading the store, leaving the device stuck looking signed-out. `bootstrap()` now always calls `hideEntryScreen()` once a user is confirmed, and `index.html`'s `onAuthStateChanged` handler re-runs `bootstrap()` if the timeout already fired without one, so a persisted session self-heals instead of getting stuck. Also bumped the safety window 3s → 6s to make the race itself less likely. No change to Firebase's own persistence — it already keeps a signed-in session until an explicit Sign Out.
- **Added:** Today's Flavor List and each flavor's target number now persist at the store level (`store.currentFlavorList`, `js/store-org.js`) instead of resetting to blank every day. Previously each day's Ice Cream Run was its own empty Firestore doc (`runs/{date}`) until someone rebuilt the list, so a manager had to re-add flavors and re-set targets every morning. `saveAll()` now also writes the current list/targets to the store doc (only while today is the date being edited, so correcting a past date never overwrites tomorrow's default), and `loadRunForDate()` seeds a new day that has no run doc yet from that store-level default. The list only changes when a manager edits it — every device signed into that store sees the same carried-forward list, same as the rest of the store's data (roster, dashboard, novelties, inventory, settings).

### Store Name Fix, Dashboard Metrics Rework, New Settings (2026-07-31)
- **Fixed:** store name display for real this time — the root cause was that `car_store_label` gets permanently cached in `localStorage` the first time a store is selected, using `store.label || store.id` as the fallback. Any store whose Firestore doc was created before the `label` field convention existed (this store, evidently) got the raw slug cached forever, and every later read trusted that cache *before* ever considering title-casing. Replaced with `_storeDisplayLabel()`/`_storeLabelFor()` (new shared helpers in `appHelpers.js`) — the self-healing version re-title-cases and overwrites a bad cached value the moment a fresh label is available, and the pure version is used anywhere multiple stores are listed at once (so it never overwrites the cache with the wrong store's name).
- **Changed:** Manager Dashboard "Today's Production" is now two rows of three: **Buckets Made, Run Duration, Avg Bkts/Hr**, then **Ice Cream Sandwiches, Handel Pops, Bananas** (made-count by novelty category, replacing the previous generic "Novelties Made"/"Flavors" cells). "Production — Last 30 Days" mirrors the same six metrics, summed over 30 days. `js/novelties.js`'s `submitNoveltiesSummary()` now records a per-category breakdown on the `novelties_completed` storeEvent so the Dashboard can read it back.
- **Changed:** "Bottom Flavors — Last 30 Days" now always renders (with an empty-state message) instead of disappearing when there isn't enough distinct flavor history yet — it was already built, just easy to mistake for missing on a lightly-used store.
- **Added:** Settings → **Manager PIN** (change it directly, without needing "Forgot PIN"; hidden for CORPORATE_ADMIN, which never uses one) and **Cabinet Numbering** (now a store-wide default in `store.settings.cabinetNumbersEnabled` instead of a per-device `localStorage` flag — every device at a store agrees on it).
- **Added:** Settings → **Export Data** — CSV downloads for Runs, Novelties, and Inventory history (reads the `runs`/`noveltiesLog`/`inventoryLog` subcollections directly, so history isn't limited by the 10-entry `storeEvents` cap), plus a **monthly batches-made-per-flavor report** (pick a month, downloads total batches per flavor for that month — only reflects days recorded since the Made-stepper workflow shipped, since that's what populates `runMade` per flavor).

### Auto-Update, Dashboard Placement, Settings Cleanup (2026-07-30)
- **Added:** the app now auto-reloads when a new service-worker version takes control of an already-open tab (`js/app-core.js`, `controllerchange` listener), instead of relying on the operator noticing/acting on the "app updated" toast. Skipped mid-run with unsaved progress, where the toast still shows as a fallback. This was the likely cause behind the last two rounds of fixes ("Saved Runs still empty," "On Hand still not editable") appearing not to have landed — the code was correct and deployed, but the previous tab kept running pre-update JS until manually refreshed.
- **Changed:** starting a run now shows an explicit "offline, will save once reconnected" toast if the initial save can't go out at all (previously this specific case failed silently — only a genuine write error got a toast).
- **Changed:** the Dashboard button is now hidden everywhere except Store Settings (previously shown on every tab) — matches how Sign Out was already scoped.
- **Changed:** Store Settings — "Store Profile" (phone/contact/hours, unused elsewhere in the app) and the old per-store-row "Switch Store" list are both replaced by a single **Store Name** section: a plain name display for single-store accounts, or a dropdown picker for multi-store accounts (selecting a store reloads everything via the existing `selectStore()`).
- **Changed:** "Bulk Import Flavors" is now corporate-admin only (previously visible to any signed-in account, inconsistent with "Edit Master Flavor List" right next to it already being corporate-gated).
- **Removed:** the "Order & Inventory Config" section (Order Lead Time / Inventory Count Interval) — `orderLeadTimeDays` was unused everywhere outside its own settings field; `inventoryCountIntervalDays` now just falls back to its existing 14-day default. The now-fully-unused `_settingsSaveButton()` helper in `js/settings.js` was removed along with it.
- **Fixed:** the "Manage Flavor Roster" modal could render taller than the actually-visible area on iOS Safari and clip its Done button below the screen — `100vh` there includes space the collapsing address bar reclaims, which isn't actually visible. Added a `100dvh` override (`index.html`, `@supports` progressive enhancement) that tracks the real visible viewport.

### Novelties On Hand Stepper (2026-07-30)
- **Added:** the Novelties tab's **On Hand** column is now a −/value/+ stepper with tap-to-type (same widget as the Run tab's Holding column, hoisted into a shared `buildQuantityStepper()` in `js/roster.js` and reused by both). Previously the only way On Hand ever changed was indirectly through the Made button (which adds to it) — there was no way to just directly set/correct a physical count, which was the likely cause of Reset appearing not to work (nothing had actually been entered into On Hand to reset). On Hand is intentionally independent from the Made/completion status, same as Holding is independent from a completed Run row.

### Follow-up Fixes: Run-Save Race, Novelties Toolbar, Sign Out Visibility (2026-07-30)
- **Fixed:** "Start Production Run and Save" wasn't reliably creating a Saved Runs entry — `js/production.js` `_startProductionRun()` previously fired two separate, un-awaited Firestore writes to the same run doc (`saveAll()` plus a `submitted:false` reset); collapsed into a single write, still fire-and-forget so entering Run Mode is instant, but now properly sequenced and awaited internally so a genuine save failure surfaces a status toast instead of failing silently.
- **Changed:** Novelties tab — removed the "Saved Lists" date picker (no more multi-day browse/resume for this tab); added **Reset** (clears today's on-hand counts back to 0, 5-second undo toast — same pattern as the Run tab's Reset) and **Print** (`printNovelties()`, same print-window pattern as the Run tab's Print Inventory) buttons in its place.
- **Changed:** Sign Out now only appears in the header on the Store Settings tab — previously hidden only on Settings and Run, now also hidden on Novelties and Inventory (and shown on Settings, reversing the original always-hide-on-Settings behavior).
- **Fixed:** the Ice Cream Run flavor table could render wider than its container on narrow phones (long flavor names plus the fixed-width Holding −/+ buttons exceeded their `<col>` percentage allotment under the table's default auto layout), forcing the *entire page* — header, toolbar, tab bar — to overflow and appear squeezed against the left edge with blank space on the right. Wrapped the table (and Novelties' per-category tables, same underlying risk) in an `overflow-x:auto` container in `index.html`/`js/novelties.js` — the table can now scroll horizontally on its own if needed, without breaking the rest of the page's width.

### Made-Stepper Workflow for Run + Novelties, Dashboard Cleanup (2026-07-30)
Reworks the core daily-production interaction on both the Ice Cream Run and Novelties tabs to a single consistent pattern, and cleans up several Dashboard sections.

- **Added:** shared Made-quantity stepper modal (`js/made-stepper.js`, `#madeStepperOverlay`) — `openMadeStepper({title, value, onSubmit})` pre-fills with the app-calculated quantity and lets the operator adjust with −/+ before submitting. Used by both the Run and Novelties tabs' Made buttons, replacing the Run tab's per-bucket checkboxes and the Novelties tab's plain `prompt()`.
- **Changed:** Ice Cream Run mode — each flavor now tracks a submitted daily quantity (`runMade`) and, when catering applies, a separate submitted catering quantity (`cateringMade`), each with its own Made button and Undo. A numeric **To Make** column (matching Novelties) is now shown in run mode. The **Skip** button is gone — adjusting the stepper down to 0 and submitting is the new equivalent.
- **Added:** a bottom **Done** footer on the Run table, shown once every flavor (daily + catering) has a submitted quantity. Tapping it opens the existing summary popup, now with **Adjust** (closes the popup, run stays exactly as-is) and **Submit** (writes the Dashboard-facing summary, marks the day's run doc `submitted: true`, clears run mode).
- **Changed:** the Run tab's "📅 Today ▾" picker is renamed **Saved Runs** and now lists only in-progress (unsubmitted) runs; opening one resumes straight into Run Mode with prior progress restored. Submitted runs drop off this list but their data stays in Firestore for Dashboard history. The Run Prep overlay's start button is renamed **"Start Production Run and Save"** (same function).
- **Added:** `runMade`/`cateringMade` now autosave to the day's `runs/{date}` doc alongside `activeFlavors`/`cateringItems` (`js/store-org.js` `saveAll()`/`_applyRunData()`), so an interrupted run resumes exactly where it left off.
- **Changed:** Novelties tab mirrors the same pattern — the Target column is now a dropdown (`TARGET_OPTIONS`, hoisted to `js/roster.js` and shared with the Run tab's flavor Target column), the Made button opens the same stepper, a bottom Done footer appears once every item is accounted for, and "📅 Today ▾" is renamed **Saved Lists** with the same in-progress-only/resume/submit behavior. Submitting writes a `novelties_completed` entry to `storeEvents[]` for Dashboard aggregation.
- **Changed:** Manager Dashboard — store name now falls back to a title-cased version of the store-id slug (e.g. "anderson-mill" → "Anderson Mill") instead of the raw slug when no custom label is set (`_titleCaseSlug()`); "Today's Production" gained a **Novelties Made** metric; **Inventory Health** and **Current Shortages** sections are removed; a new **Production — Last 30 Days** section shows the same four metrics (Buckets Made, Novelties Made, Flavors, Avg Bkts/Hr) summed over the trailing 30 days.
- **Changed:** the Sign Out button is now hidden on the Ice Cream Run tab (previously only hidden on Store Settings), in addition to Settings.

### Master Flavor List Management, Store Assignment, PWA Icons (2026-07-30)
Rounds out the corporate-admin tooling and closes a couple of long-standing gaps found while reviewing outstanding work.

- **Added:** Corporate-only "Edit Master Flavor List" panel in Store Settings → Flavor Roster (`js/settings.js`: `_toggleMasterFlavorPanel()`/`_renderMasterFlavorPanel()`/`_renderMasterFlavorList()`) — searchable list of every roster flavor with inline code/type editing and permanent removal, applied org-wide.
- **Added:** `organizations/{orgId}.flavorEdits` (`{[name]: {category?, type?}}`) and `.flavorRemovals` (`[name, ...]`) — new org-level overlay fields, applied on top of `MASTER_ROSTER` + `customFlavors` by `_applyOrgFlavorOverrides()` in `js/store-org.js`. Renaming a flavor's display name is intentionally not supported — name is the primary key used throughout the app (activeFlavors matching, storeEvents flavor tallies), so changing it would silently break historical data linkage.
- **Added:** `editOrgFlavor(name, changes)` / `removeOrgFlavor(name, onDone)` in `js/roster.js` — corporate-gated; removal includes an undo toast and purges the flavor from every store's `activeFlavors` in memory.
- **Added:** Store-assignment editor in Settings → Users & Roles (`_renderMemberStoresEditor()`) — corporate can now add/remove which store(s) an existing STORE_MANAGER-tier account can sign into (checkbox list, per-store, saved to `members/{uid}.stores[]`). Previously the only way to grant store access was the original account-bootstrap flow, which only worked for brand-new emails.
- **Added:** `icons/icon-192.png` + `icons/icon-512.png` (rendered from the existing `icon.svg` via headless Chromium, no new build tooling) and registered in `manifest.json` — closes a long-open gap that degraded the Android "Add to Home Screen" install prompt (iOS was unaffected, SVG-only works there).
- **Fixed:** the undo toast (`showUndoToast()`) and the iOS install hint banner were both `position:fixed` near the bottom of the viewport with a lower `z-index` than the bottom tab bar — same root cause as the modal issue below, just missed in the first pass since they're dynamically-created elements, not overlay classes. Both now sit above the tab bar with a matching `z-index` and a `bottom` offset that clears it.
- **Removed:** dead code — `removeFromRoster()`/`commitRosterDelete()`/`undoRosterDelete()`/`pendingRosterDelete` in `js/roster.js` had no remaining caller since the roster picker's trash icon was repurposed to "unselect" (see below). `resetDay()` in `js/production.js` had a defensive reference to the now-deleted `undoTimer`, which would have thrown a `ReferenceError` — removed along with it.
- **Housekeeping:** consolidated this session's sprawling `TODO.md` "in progress" logs into this changelog and reset `TODO.md` to a clean current-state list.

### Post-Tab-Bar Cleanup Pass (2026-07-30)
- **Fixed:** `.modal-backdrop` (the Edit Flavors modal) had `z-index: 100`, below the new bottom tab bar's `z-index: 250` — its Done button and bottom content were visually covered. Bumped to `260`.
- **Changed:** adding a flavor to the roster is now corporate-only and org-wide (`organizations/{orgId}.customFlavors`, populated into `_orgCustomFlavors` by `loadOrgMetadata()`) instead of a per-store addition any signed-in account could make. Non-corporate accounts can still toggle which existing flavors are active today.
- **Changed:** the roster picker's trash icon now only appears on flavors already selected for today, and just unselects them (same as tapping the name) — it no longer permanently deletes from the roster.
- **Fixed:** `MASTER_ROSTER` entries used "Oreo®️" — the ® followed by U+FE0F (variation selector-16), which forces emoji-style presentation and made the symbol render gray regardless of the surrounding text color. Removed the trailing U+FE0F from all 5 affected entries.
- **Changed:** Sign Out (`#authBtn`) hidden while the Store Settings tab is active; removed the standalone "☰ Edit Flavors" toolbar button from the Ice Cream Run tab (reachable via Settings → Manage Flavor Roster now, already PIN-gated by the Settings tab itself).
- **Changed:** Novelties redesigned to mirror the Ice Cream Run's flavor table — Item / Target (PIN-gated, same as the flavor Target column) / On Hand / To Make / Made columns. Removed the ability to add/remove items (fixed preset catalog now); "Made" prompts for a quantity and adds it to on-hand, replacing the old boolean done/checked-off model.

### Login/PIN Rework: Store Accounts + Shared Manager PIN (2026-07-30)
Replaces the anonymous "Continue as Employee" mode with mandatory sign-in, and replaces role-based feature hiding with a per-store PIN.

- **Removed:** anonymous employee mode entirely — `enterEmployeeMode()`, `car_employee_session`, the standalone `#authOverlay` modal. The entry screen (`#entryOverlay`) is now the login form itself; every session signs in with a shared per-store email/password.
- **Fixed:** the store picker was never actually scoped by `members/{uid}.stores[]` despite that field being written on account creation — any org member could see/pick every store in the org. `_scopedStores()` in `js/store-org.js` now filters to the signed-in account's own stores unless `CORPORATE_ADMIN` (sees all).
- **Changed:** all four bottom tabs + the Dashboard button are always visible to any signed-in account. Dashboard/Inventory/Store Settings/Edit Flavors are gated instead by a shared 4-digit manager PIN per store (`store.managerPin`, Firestore-backed — not per-device like the previous, never-wired-up localStorage version). `requireManager()`/`openPinModal()` are properly connected for the first time.
- **Added:** `CORPORATE_ADMIN` bypasses the PIN entirely (already a personally-authenticated, elevated account) — gets the corporate dashboard and any individual store's manager dashboard with no prompt.
- **Added:** "Forgot PIN" — re-confirms the store login's password via Firebase `reauthenticateWithCredential`, then lets the manager set a new PIN. No email step (no backend/Cloud Functions exist in this app to send one).
- **Added:** Switch Store section in Store Settings — lists the account's accessible stores, one-tap switch via the existing `selectStore()`.
- **Fixed:** switching stores didn't reset `_managerUnlocked`, so unlocking the PIN at one store silently unlocked manager features at another store too, without ever entering its PIN. `selectStore()` now locks manager mode and returns to the Run tab on every switch.

### Bottom Tab Navigation + Date-Recallable History + Inventory Overhaul (2026-07-29)
Replaces the header-button/popup-overlay pattern with a persistent bottom tab bar, and makes the Ice Cream Run, Novelties, and Inventory date-recallable.

- **Added:** 4 fixed bottom tabs — Ice Cream Run, Novelties, Inventory, Store Settings (`switchTab()` in `js/app-core.js`). `#settingsOverlay`/`#noveltiesOverlay`/`#inventoryOverlay` no longer exist as popups — their content lives directly in the corresponding tab panel.
- **Added:** date-recallable Ice Cream Run — `organizations/{orgId}/stores/{storeId}/runs/{date}` holds `activeFlavors`/`cateringItems` per day (roster stays on the store doc, persistent, not per-day). `loadRunForDate(date)` swaps the working date; a "📅 Today ▾" picker lists recent dates. `resetDay()` always snaps back to today first.
- **Changed:** Novelties pivoted from a live on-hand tracker to a daily make-checklist — `novelties` is the persistent catalog (category/name/parLevel), `noveltiesLog/{date}` holds that day's counts. Make qty = `max(0, parLevel - onHand)`.
- **Changed:** Inventory catalog renamed `inventoryItems` → `inventoryCatalog`, extended with `pricePerUnit`/`locationOrder`/`distributorOrder`; per-date counts live in `inventoryLog/{date}`. Added CSV import with flexible column-mapping (`_parseCSV()`, since distributor export formats vary and aren't known in advance), a dual sort toggle (store location vs. distributor site order), and a running Total Inventory Value.
- **Added:** `firestore.rules` for the three new subcollections (`runs`, `noveltiesLog`, `inventoryLog`), verified against a real Firestore emulator with `@firebase/rules-unit-testing` — deployed to production by the user.

### Modularization, Settings/Novelties/Inventory v1, Forgot Password (2026-07-29)
- **Changed:** split `index.html`'s ~3,500-line inline script into `js/auth.js`, `roster.js`, `production.js`, `manager-lock.js`, `store-org.js`, `dashboard.js`, `app-core.js` — mechanical extraction, no logic changes, verified via a line-coverage script (all 177 top-level declarations accounted for exactly once).
- **Fixed:** `getOrgDocRef()`/`getStoreDocRef()`/`getOrgMemberRef()` were redeclared as local wrapper functions that called `window.<same name>()` — since a top-level function declaration overwrites the `window.*` property of the same name, each wrapper recursed into itself infinitely, silently breaking nearly every real Firestore read/write. Present in the pre-split monolith too, not introduced by the modularization; masked in production by the offline-first fallback to localStorage.
- **Fixed:** `saveAll()` used a non-merge `setDoc`, so any routine save could wipe `label`/`lastRunDate`/`storeEvents` from the store doc. Now uses `{ merge: true }`.
- **Added:** Manager Settings page (store profile, roster management, bulk flavor import, Users & Roles, order/inventory config, theme toggle for the new pages), Novelties page (37-item preset catalog, on-hand tracking), Inventory page (par-level tracking, order qty = par − on-hand).
- **Added:** "Forgot password?" on the Manager Login modal (`sendPasswordResetEmail`), with a non-committal message for a nonexistent email so the flow can't be used to enumerate manager accounts.

### Catering Production Support (2026-05-29)
Integrates catering bucket tracking into the existing production run workflow — operationally distinct but visually and structurally unified with regular production.

- **Added:** Run Preparation overlay (`#runPrepOverlay`) — shown when user taps Calculate Run instead of starting immediately. Shows daily bucket count, existing catering entries, inline flavor selector + qty input, and Start / Cancel buttons. Lightweight, fast, minimal clicks.
- **Added:** `showRunPrepOverlay()`, `closeRunPrepOverlay()`, `_renderRunPrepContent()` — builds the prep overlay dynamically each time, preserving existing catering state.
- **Added:** `addCateringEntry(name, buckets)` / `removeCateringEntry(index)` — modify `_cateringItems` in-place and re-render the prep overlay.
- **Added:** `_startProductionRun(dailyNeeded)` — the actual run start (previously inline in `calculateRun`). Sets `runMode = true`, writes `car_run_state` with catering, shows banner + table + variegate modal.
- **Added:** `_dismissCateringRow(name, index, action)` — tracks catering checkbox completions in `_cateringDismissed`; fires `checkRunComplete()` when a flavor's catering is fully done.
- **Added:** State variables `_cateringItems` (persists across recalculations) and `_cateringDismissed` (cleared on run end).
- **Changed:** `calculateRun()` — now opens prep overlay instead of starting directly. Guard updated: shows message only when both daily AND catering are empty.
- **Changed:** `buildRow()` run mode — catering checkboxes appear after daily checkboxes in the same flavor row, separated by a thin vertical line. Each catering checkbox has a 🍨 emoji badge above it and amber `accent-color`. `isFullyDone` now requires both daily and catering completion.
- **Changed:** `renderTable()` run mode — now includes catering-only flavors (active flavors with `toMake()=0` that have catering entries) so they appear in the run.
- **Changed:** `dismissRunRow()` skip action — also skips catering for the same flavor (single Skip button skips everything for a flavor).
- **Changed:** `undoRunRow()` — clears both `runDismissed` and `_cateringDismissed` entries for the flavor.
- **Changed:** `checkRunComplete()` — checks both daily and catering completion before showing run summary.
- **Changed:** `doneRun()`, `clearRunView()`, `resetDay()` — clear both `_cateringDismissed` and `_cateringItems`.
- **Changed:** `showRunSummary()` — adds a 🍨 Catering Buckets Made row to the summary table when catering was completed.
- **Changed:** `writeRunSummary()` — includes optional `cateringBuckets: N` and `cateringFlavors: {name: count}` in the `run_completed` storeEvents entry. Guard updated to allow write when catering-only run.
- **Changed:** `init()` interrupted-run recovery — restores `_cateringItems` from `car_run_state.catering` so catering entries survive page refresh.
- **Changed:** `car_run_state` writes — now include `catering: _cateringItems` for persistence.
- **Firestore cost:** Zero additional reads. Catering adds ~50–200 bytes to existing storeEvents write when catering present.
- **Analytics:** `cateringBuckets` and `cateringFlavors` fields in storeEvents entries enable future catering demand analysis without new infrastructure.

### Manager Dashboard (2026-05-28)
Store-level operational dashboard for signed-in Store Managers. Zero additional Firestore reads — all data from in-memory `activeFlavors`, `_storeEvents`, and `_storeDoc`.

- **Added:** `#managerDashboardOverlay` HTML overlay — 480px max-width, scrollable content area, consistent with app visual language
- **Added:** `openDashboard()` — routes Dashboard button by role: CORPORATE_ADMIN → corporate dashboard, STORE_MANAGER → manager dashboard
- **Added:** `showManagerDashboard()` — builds 7 sections from in-memory data:
  1. **Today's Production** (hero): Buckets Made, Flavors Produced, Avg Buckets/Hr (3-column metric grid)
  2. **Inventory Health**: Stocked / Low (1 needed) / Critical (2+) color-coded chip grid
  3. **Current Shortages**: sorted by most needed first; tapping a shortage row opens Edit Flavors
  4. **Production Trend · 7 Days**: compares recent 7-day vs prior 7-day bucket totals; text-only ↑/↓/→ with percentage
  5. **Top Flavors — Last 30 Days**: top 3 with medal icons (🥇🥈🥉), only from runs with flavor data
  6. **Bottom Flavors — Last 30 Days**: bottom 3 distinct from top 3 (shown only when ≥4 flavors tracked)
  7. **Store Status**: online/offline indicator, last sync time, last production time
- **Added:** `closeManagerDashboard()` — closes overlay, restores scroll
- **Added:** `_renderMgrSection(title, noTopBorder)` — shared section builder (heading + optional divider)
- **Changed:** `updateRoleUIVisibility()` — Dashboard button now shown for STORE_MANAGER in addition to CORPORATE_ADMIN
- **Changed:** `showRunSummary()` — captures `_runDurationMs = totalMs` at run completion for writeRunSummary
- **Changed:** `writeRunSummary()` — adds `durationMs` field to `run_completed` storeEvents entries; used for Avg Bkts/Hr calculation
- **Changed:** `applyData()` — stores raw `data` in `_storeDoc` for fallback access to `lastRunDate`/`lastRunBuckets`/`lastRunAt`
- **Added:** State variables `_storeDoc`, `_runDurationMs`
- **Analytics data sources:** Avg Bkts/Hr uses `storeEvents[].durationMs` (new); Top/Bottom Flavors use `storeEvents[].flavors` (prev deploy); Trend uses `storeEvents[].buckets` + `at` timestamps; Shortages use live `activeFlavors`
- **Retroactive:** Trend/flavor analytics only for runs after respective deploys; bucket counts retroactive via `_storeDoc.lastRunDate` fallback

### Corporate Dashboard Improvements (2026-05-28)
Cleaner, more informative dashboard for corporate users. Removes operational noise, adds flavor analytics, and fixes display issues.

- **Fixed:** Email display — long email addresses no longer overflow the dashboard card. `renderDashboardCard` now uses `word-break:break-word;overflow-wrap:anywhere`. Email is rendered in the info bar at 11px with natural wrap.
- **Fixed:** Current store display — dashboard "Current Store" card now shows the human-readable store label (`store.label`) from `localStorage('car_store_label')` or `getOrgStores()`, falling back to the slug only if no label is available. Previously showed raw Firestore document IDs.
- **Fixed:** Org ID display — "handels" replaced with "Handel's Homemade Ice Cream" everywhere user-facing. `loadOrgMetadata()` now caches `window._orgName = meta.name`. New `_getOrgDisplayName()` helper used in `showOrgSetupForm`, `renderAddStoreSection`, and the dashboard info bar.
- **Removed:** "Needs Attention" section — `buildAttentionAlerts()` and `renderNeedsAttention()` removed entirely. Reduces operational noise during pilot usage.
- **Removed:** "Recent Activity Log" section — `renderAnalyticsSummary()` and `getRecentAnalyticsEvents()` removed. Underlying event tracking architecture (`storeEvents`, attribution, `logOrgEvent`) is preserved.
- **Added:** "Top Flavors — Last 30 Days" section — shows the top 3 flavors by total buckets made across all stores, drawn from `storeEvents[].flavors` data. Begins accumulating from the next completed run. Zero additional Firestore reads (uses `loadOrgStores()` result already in memory).
- **Changed:** `writeRunSummary()` — now captures per-flavor made counts from `runDismissed` at the moment `closeSummary()` fires (before `doneRun()` clears the array). Adds `flavors: {flavorName: count}` to each new `run_completed` storeEvents entry. Same Firestore write — no cost increase.
- **Changed:** Dashboard layout — replaced redundant inner "Corporate Dashboard" heading + "Org ID: handels" with a slim info bar showing org name, email, and role pill. Stats section reduced to 2 cards (Locations, Current Store) in a clean 2-column grid.
- **Changed:** `renderDashboardCard()` — updated to use consistent 10px uppercase title, 15px value with overflow protection, 11px muted note. Cleaner visual hierarchy.

### Identity-First Auth & Entry Screen (2026-05-28)
Restructured the app launch flow so identity is established before store context — production floor optimized, zero ceremony.

- **Added:** Entry screen (`#entryOverlay`) — shown when no auth session and no employee session exists. Two large touch targets: "Continue as Employee" (primary, green, 76px height) and "Manager Sign In" (secondary, outline). Branded with app name, no forms, no complexity.
- **Added:** `enterEmployeeMode()` — sets `sessionStorage('car_employee_session')`, assigns `ROLES.EMPLOYEE` automatically, hides entry screen, proceeds to store picker/welcome-back. Session clears when browser closes (correct behavior for shared tablets).
- **Added:** `showEntryScreen()` / `hideEntryScreen()` — entry overlay control.
- **Added:** Welcome-back state in `showStorePicker()` — if a last-used store is saved, shows "Welcome back · [Store Name]" with a large "Continue →" button and a "Switch Store" escape. One tap to resume daily workflow. `showStorePicker(true)` skips it for explicit switching.
- **Added:** `_renderWelcomeBack(list, savedId, savedLabel)` — builds welcome-back UI into the store picker overlay.
- **Added:** Store label persistence — `selectStore()` now saves `car_store_label` to localStorage so welcome-back shows the name even without a Firestore read (works in employee/offline mode).
- **Changed:** `bootstrap()` — now checks auth/employee session first; shows entry screen and returns early if neither is established. Removed `initRoleUI()` and `renderRoleAudit()` calls.
- **Changed:** `signInManager()` — detects if entry screen was open before sign-in; after success, hides entry screen, clears employee session flag, and proceeds to store picker. Handles both new account and existing account paths.
- **Changed:** `updateUserRoleDisplay()` — now context-aware: "Signed in · Store Manager / Corporate Admin / Employee" for authenticated users, "Employee mode" for session-only employees, empty for entry screen state.
- **Changed:** `updateRoleUIVisibility()` — simplified; only manages Dashboard button visibility (no roleSelect).
- **Removed:** `#roleSelect` dropdown from header HTML — roles are never chosen manually.
- **Removed:** `initRoleUI()` function — no role selector to initialize.
- **Removed:** `logRoleChange()` function — role changes no longer happen client-side.
- **Removed:** `renderRoleAudit()` function and all call sites — audit panel already removed from HTML in prior pass.
- **Preserved:** PIN emergency override (`requireManager()`), manager sign-in modal, all production workflows, offline behavior, Firestore sync, PWA functionality, store/org data structures.

**New flow:**
```
App launch → onAuthStateChanged → bootstrap()
  Returning manager (Firebase token) → load role → welcome-back / store picker → workflow
  Employee session (sessionStorage) → welcome-back / store picker → workflow (limited perms)
  No session → Entry screen → "Continue as Employee" or "Manager Sign In" → ...above
```

### Vercel Deployment Prep (2026-05-28)
Deployment-safe configuration for production hosting on Vercel with Firebase Auth, Firestore, service workers, and PWA installability all functioning correctly.

- **Created:** `vercel.json` — explicit static deployment configuration. Sets `buildCommand: ""` and `outputDirectory: "."` so Vercel skips the Node.js build phase and does not install `firebase-admin` / test dependencies on every deploy. Defines HTTP response headers for all served paths.
- **Fixed:** `sw.js` served with `Cache-Control: no-store` — critical for service worker update detection. Without this, browsers may serve a stale `sw.js` from their HTTP cache and never install updated versions of the app. Includes `Service-Worker-Allowed: /` to explicitly confirm root-scope registration.
- **Fixed:** App shell files (`index.html`, `manifest.json`, `appHelpers.js`, `config.js`) served with `Cache-Control: public, max-age=0, must-revalidate` — forces revalidation on every load so SW cache-version bumps and code changes propagate immediately.
- **Added:** Security headers applied to all routes: `X-Frame-Options: DENY` (clickjacking protection), `X-Content-Type-Options: nosniff` (MIME sniffing protection), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Added:** Icon assets (`/icons/*`) served with `Cache-Control: public, max-age=86400` — 1-day cache appropriate for static assets that rarely change.
- **Fixed:** `appHelpers.js` — removed duplicate `const DEFAULT_ORG_ID` declaration that caused a `SyntaxError` crashing the entire file. All three usages replaced with `window.DEFAULT_ORG_ID || 'handels'`, which reads from the value set by the module script. Resolved cascading `window.flushAnalyticsEvents is not a function` error.
- **Added:** `<meta name="mobile-web-app-capable" content="yes">` — standard (non-vendor-prefixed) PWA meta tag for Android Chrome. Resolves browser deprecation warning about the Apple-prefixed tag. Both tags are now present for maximum compatibility.

**Post-deploy checklist (manual steps after Vercel assigns a URL):**
1. Firebase Console → Authentication → Settings → Authorized domains → add the Vercel URL
2. Test sign-in flow on the live URL before inviting store staff
3. Verify service worker registers successfully (DevTools → Application → Service Workers)

### Pilot Readiness Hardening Pass (2026-05-27)
Operational edge case fixes and safety improvements before real-world daily store usage begins.

- **Fixed:** `resetDay()` now clears `runDismissed`, `_totalBucketsMade`, and `car_run_state` localStorage flag when called during an active run — prevents stale dismissed entries from corrupting the next run's checkbox state.
- **Fixed:** `doneRun()` and `clearRunView()` now both clear the `car_run_state` localStorage flag — ensures recovery flag is always cleaned up on normal run completion.
- **Added:** Interrupted-run detection: `calculateRun()` writes `car_run_state` to localStorage when a run starts; `dismissRunRow()` updates it with each bucket made. On the next `init()`, if a stale run entry is found (< 12 hours old), a toast warns the operator: "⚠️ A run was interrupted — X buckets were made before closing." Recovery flag is always removed on load regardless of age.
- **Added:** `beforeunload` warning when `runMode === true` and `_totalBucketsMade > 0` — browser shows its native "Leave site? Changes may not be saved" dialog if an operator refreshes mid-run. Prevents silent data loss from accidental page refreshes. Suppressed on iOS pull-to-refresh (PWA install bypasses this).
- **Added:** Store picker close affordance — `showStorePicker()` now injects a `× Not now` button (top-right, `id="storeOverlayClose"`) when a store is already selected. Prevents operators from being stuck in the picker if it's opened accidentally via the Org button. Not shown during cold-start (picker is mandatory then).
- **Added:** Escape key dismisses the store picker — `document.addEventListener('keydown', ...)` closes `#storeOverlay` on Escape when a store is already loaded. Same guard as the close button: no Escape exit during mandatory first-time setup.
- **Changed:** `init()` iOS install hint is now suppressed if a stale-run recovery toast is already showing — prevents stacking two toasts on the same load.

### First Real Store Readiness Pass (2026-05-27)
Targeted onboarding clarity, operator confidence, and deployment polish for real-world daily store usage.

- **Changed:** Main table empty state — now role-aware. Managers/admins (signed-in or PIN-unlocked) see a 🧁 heading, "Set up today's flavors" copy, and an inline `☰ Set Up Today's Flavors` button that calls `requireManager(openAddModal)` — the first action is immediately obvious. Employees see "Ask a manager to set up this store's flavor list" — no confusing empty action. Run-mode empty state unchanged ("🎉 Nothing to make").
- **Added:** `#pickerHint` div in the flavor picker modal — "Tap a flavor name to add it to today's list." Shown when 0 flavors are selected (`selCount === 0`), hidden automatically after the first toggle. `renderPicker()` controls visibility. Zero layout shift — element is in DOM always, toggled via `display`.
- **Changed:** `createOrgAndStore()` — sets `localStorage.setItem('car_just_created', '1')` after a successful store creation (step 7 of the write sequence).
- **Changed:** `async function init()` — after `loadAll()` + `renderTable()`: checks `car_just_created`; if set, removes it and shows an 8s status toast ("🎉 Store ready! Tap ☰ Edit Flavors to add today's flavors.") delayed 800ms so the table renders first. If not a just-created store, schedules `_showInstallHint()` after 3s.
- **Added:** `_showInstallHint()` — shown once for iOS Safari non-standalone users. Guards: `(display-mode: standalone)` matchMedia, `navigator.standalone`, `car_install_hint_dismissed` localStorage flag, iOS user-agent check. Renders a dismissable fixed banner at `bottom: 20px` explaining "Tap Share ⬆ → Add to Home Screen — no App Store required." Auto-dismisses after 15s. Chrome/Android users are served by the existing toolbar Install App button instead.
- **Added:** `_dismissInstallHint()` — sets `car_install_hint_dismissed = '1'`, removes banner DOM node. Called by the banner × button and the 15s auto-dismiss timer.
- **Changed:** `setSyncStatus('reconnected')` — text changed from "🔄 Reconnected — syncing..." to "🔄 Reconnected — your work is safe". Same 3s duration, same auto-revert to "✓ Loaded from cloud". Operators who were offline are reassured before they see the revert.
- **Changed:** Org button — added `title="Switch organization"` for discoverability on hover/long-press.

### PWA and Deployment-Readiness Hardening Pass (2026-05-27)
Makes the app installable on device home screens, loads from cache when offline, and delivers update notifications without enterprise infrastructure.

- **Created:** `manifest.json` — PWA web manifest. Name "Count & Run", standalone display, brand blue background/theme color, SVG icon reference, `orientation: "any"` for tablet portrait and landscape. Enables browser install prompts on Chrome for Android and desktop.
- **Created:** `sw.js` — service worker with cache-first strategy. Precaches app shell (`/`, `index.html`, `appHelpers.js`, `config.js`, `manifest.json`, `icons/icon.svg`) on install. Caches Firebase CDN modules (`firebase-app.js`, `firebase-firestore.js`, `firebase-auth.js` from gstatic.com) on first load, serving from cache offline. Explicitly bypasses Firestore/Auth API hostnames — Firebase SDK manages its own offline persistence. Old cache versions are purged on activate. Cache key: `count-and-run-v1`; bump to `v2` to bust on next breaking deployment.
- **Created:** `icons/icon.svg` — SVG app icon with brand blue background, bold C&R monogram, red accent stripe, and "COUNT & RUN" label. Used as apple-touch-icon and manifest icon. Works at all sizes via viewBox scaling. For full Android Chrome install prompt compatibility, add `icons/icon-192.png` and `icons/icon-512.png` to `manifest.json` when PNGs are available.
- **Changed:** `index.html` `<meta name="viewport">` — added `viewport-fit=cover` for iOS notch / Dynamic Island support in standalone mode.
- **Added:** `index.html` head — 6 new PWA tags: `theme-color` (#2c3691), `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (black-translucent), `apple-mobile-web-app-title`, `<link rel="manifest">`, `<link rel="apple-touch-icon">`. iOS standalone mode is now configured correctly.
- **Added:** `index.html` CSS — `@supports (padding: env(safe-area-inset-top))` block. `.app-header` gains `padding-top: max(10px, calc(10px + env(safe-area-inset-top)))`. `body` gains `padding-bottom: env(safe-area-inset-bottom)`. Prevents header and bottom content from clipping behind notch/home-indicator when installed as standalone.
- **Added:** `#pwaInstallBtn` — hidden "⬇ Install App" toolbar button. Appears only when the browser fires `beforeinstallprompt` (Chrome for Android/desktop). Tapping calls `triggerPwaInstall()`, which triggers the native install dialog. Button hides after the user responds or after install. iOS users continue to use Share → Add to Home Screen (iOS does not support `beforeinstallprompt`).
- **Added:** `triggerPwaInstall()`, `beforeinstallprompt` and `appinstalled` listeners — capture the browser's deferred install prompt; expose it through the toolbar button; clean up on install or dismissal.
- **Added:** SW registration — `navigator.serviceWorker.register('/sw.js')` at end of main script. Listens for `updatefound` on the registration object; when a new SW installs while the app is open, calls `showStatusMessage('✨ App updated — refresh for the latest version', 6000)`.

### Operational Safety and Error-Prevention Pass (2026-05-27)
Five targeted changes to reduce the likelihood of operational mistakes and give operators recovery options without adding friction to normal workflows.

- **Changed:** `resetDay()` — removed `confirm()` dialog; replaced with instant-apply + 5-second undo toast ("⟳ Day reset — tap Undo to restore"). Snapshots `activeFlavors` before clearing; Undo restores the snapshot and re-saves. Matches the existing undo pattern from `removeFromRoster()`. Faster on tablet than a confirm dialog; always recoverable within the window.
- **Changed:** `showUndoToast(msg, undoFn)` — now accepts an optional undo callback via `window._undoToastHandler`. Defaults to `undoRosterDelete` for backward compatibility. The two undo windows (roster delete and day reset) commit each other cleanly — no conflict possible.
- **Added:** `confirmDoneRun()` — double-tap guard on the ✓ Done button. If no buckets have been made (`_totalBucketsMade === 0`), exits run mode freely. If work is in progress, first tap shows a 3-second toast ("Run in progress — X buckets made. Tap Done again to exit early."). Second tap within 3 seconds confirms exit. Normal run completion (all flavors checked → run summary → "Done" in summary modal) is completely unaffected.
- **Changed:** `renderTable()` — added early-return guard when an inline tap-to-type holding `<input>` is active. Prevents a background Firestore snapshot from destroying a mid-edit input. `applyData()` still runs (state is current); re-render fires naturally when the user commits via Enter or blur.
- **Changed:** `setSyncStatus('error')` — error text now reads "⚠️ Save failed — tap to retry". The element gains `cursor:pointer` and an `onclick` that calls `saveAll()`. All non-error state transitions clear the handler. Gives operators an explicit, one-tap recovery action instead of waiting for the next change to auto-retry.
- **Changed:** Rapid-fire hold `+` button — clamp added: `Math.min(99, ...)`. Prevents accidental 100+ holding values from extended long-press. Applies in both the initial press and accelerating ticks.

### Production Workflow Speed Optimization Pass (2026-05-27)
Six targeted changes to reduce friction and improve operational throughput during daily production runs. No new features — pure speed and ergonomics.

- **Changed:** Run banner — added `position: sticky; top: 0; z-index: 50;`. The "Done" button and bucket count stay pinned at the top of the viewport while scrolling through long flavor lists. Eliminates the need to scroll back up to finish a run on a tall table.
- **Changed:** Dipping dropdown (`td select`) — `min-height` 36px→44px. Meets WCAG 2.5.8 touch target minimum; consistent with all other primary action controls.
- **Changed:** Run mode bucket checkboxes — 28×28px→36×36px. Larger hit area reduces mis-taps when working through a run quickly.
- **Changed:** Run mode Skip button — `min-height` 40px→44px. Consistent with touch target floor across all action buttons.
- **Changed:** Hold `+`/`−` buttons — replaced click event listeners with pointer-based rapid-fire. `pointerdown` fires an immediate increment, then accelerates: 400ms initial delay, multiplied by 0.85 per tick, minimum 60ms. `saveAll()` and `renderTable()` are called once on `pointerup`/`pointercancel`/`pointerleave`, not per-tick. Prevents Firestore write bursts during fast holds. `e.preventDefault()` on pointerdown suppresses synthetic click events.
- **Added:** Tap-to-type on holding value display. Clicking the numeric span replaces it inline with a focused `<input inputmode="numeric">`. Enter or blur commits the value (with `settled` guard to prevent double-commit on blur after Enter). Escape cancels with no change. Enables fast direct entry when a value needs a large adjustment (e.g., 0→12 without 12 taps).

### Operational UX Refinement Pass (2026-05-27)
Eight targeted improvements to workflow speed, touch ergonomics, and operational clarity. No new features, no redesign — pure usability polish.

- **Changed:** Hold counter `+`/`−` buttons — increased from 32×32px to 44×44px touch targets (font size 18px→20px, value span 24px→28px min-width). Meets Apple HIG and WCAG 2.5.8 minimum for reliable tablet use in production kitchen conditions.
- **Changed:** Store picker — overlay now opens immediately on tap (before the Firestore call). A "⏳ Loading stores…" indicator appears in the list while data loads, then clears. Previously the overlay stayed closed during the async wait, giving no feedback on slow connections.
- **Changed:** Store detail accordion — added `scrollIntoView({ behavior:'smooth', block:'nearest' })` on panel insert (50ms delay for DOM settle). Store cards near the bottom of the screen no longer require the user to manually scroll to see the opened panel.
- **Changed:** Run summary modal — "Total Buckets Made" is now visually prominent: 32px green value, matching green label, subtle border-bottom separator from secondary metrics. Previously all four rows rendered identically, burying the primary metric.
- **Changed:** `calculateRun()` — added 0-bucket guard: if all flavors are fully stocked, run mode is skipped entirely and a brief status toast is shown ("✓ All flavors fully stocked — nothing to make today."). Previously this opened the variegate modal → run banner → empty table, a confusing dead-end.
- **Changed:** Run banner — message is now two lines: large `18px` bucket count (white) as the headline, `11px` muted sub-line with flavor count + sort order. Previously a single dense 13px sentence. Substantially easier to parse at arm's length on a tablet.
- **Changed:** `syncStatus` element — font size 11px→12px; left-border urgency indicator added (`border-left: 2px solid <color>`): amber border for offline, red border for error, transparent for normal states. Introduced `_applyStyle(color, borderColor)` internal helper to keep all 6 states consistent. Previously all states differed only in text color, which was easy to miss.
- **Changed:** Run banner CSS — `align-items: center` → `align-items: flex-start`, padding 9px→12px. Prevents vertical misalignment when the message block has two lines.
- **Changed:** Flavor picker modal — search field focus delay 60ms→10ms. Feels noticeably snappier on fast tablets.

### Lightweight Sync/Offline Operational Health Visibility (2026-05-27)
- **Added:** `let _lastSyncAt = null` — module-level timestamp, set to `Date.now()` whenever `setSyncStatus('saved')` or `setSyncStatus('loaded')` is called. Persists in memory for the session — allows offline message and reconnect display to show how long ago the last successful sync occurred.
- **Added:** `let _wasOffline = false` — module-level boolean, set to `true` when the device goes offline and cleared when it comes back online. Enables reconnect detection without any backend or persistent state.
- **Added:** `_syncAgeColor(ts)` — pure helper. Returns a color string based on how long ago a timestamp occurred: `'#5a7a9a'` (muted, < 1h — normal), `'#f0a500'` (amber, 1–4h — stale), `'#ff8080'` (red, > 4h — alert). Null/undefined input returns the safe muted fallback. Zero side effects.
- **Changed:** `setSyncStatus()` — now records `_lastSyncAt = Date.now()` when state is `'saved'` or `'loaded'`. When state is `'offline'`, appends ` — last sync Xm ago` to the message using `relativeTime(_lastSyncAt)` when a prior sync time is known (omitted on first load before any sync has occurred). Added new `'reconnected'` state: shows `'🔄 Reconnected — syncing...'` for 3 seconds then reverts to `'✓ Loaded from cloud'` — triggered only after a prior offline period, not on normal page load.
- **Changed:** `updateConnectivityStatus()` — now detects the offline→online transition via `_wasOffline`. On reconnect, calls `setSyncStatus('reconnected')` instead of `setSyncStatus('loaded')`, so the user sees a brief visual confirmation that the device recovered. On going offline, sets `_wasOffline = true`. On normal online state (not a reconnect), calls `setSyncStatus('loaded')` as before and clears `_wasOffline`.
- **Changed:** `_buildStoreDetailPanel()` status row — "Last sync: Xm ago" timestamp now colorized using `_syncAgeColor(store.updatedAt)`. Muted for recent sync, amber for 1–4h stale, red for > 4h — gives CORPORATE_ADMIN an at-a-glance data freshness signal without requiring any extra explanation.
- **Changed:** `renderMultiStoreOverview()` per-store card nameBlock — "last updated Xm ago" text now colorized using `_syncAgeColor(store.updatedAt)`. Same threshold logic — muted/amber/red — applied consistently across both the detail panel and the overview card.
- **Firestore cost:** Zero additional reads, zero additional writes, zero new fields. All sync health signals are derived from `_lastSyncAt` (in-memory session state), `store.updatedAt` (existing per-store field), and `navigator.onLine` (browser API).
- **Privacy/scalability:** No sync timestamps are persisted to Firestore, no session state is sent to any backend. `_lastSyncAt` resets on each page load — the behavior is accurate for the current session only. This is appropriate for operational confidence (not audit logging).
- **Result:** Managers and corporate users see lightweight, contextual sync health signals: the "last updated" timestamp on store cards and the "Last sync" field in detail panels turn amber or red when data is stale. Going offline shows how long since the last sync. Coming back online triggers a brief reconnect confirmation. All signals reuse already-loaded data — zero overhead.

### Lightweight Operational Activity Attribution (2026-05-27)
- **Added:** `_currentUserName()` — derives a short operational display name from the signed-in user's email. Takes the first segment before `@`, splits on `.`/`-`/`_`, and title-cases it. `sarah.jones@handels.com` → `"Sarah"`. Returns `null` for unauthenticated users (EMPLOYEE role) — no attribution shown, no data stored.
- **Changed:** `writeRunSummary()` — adds optional `by: userName` field to the `newEntry` object when a user is signed in. Omitted entirely (not stored as `null`) when unauthenticated, keeping payloads clean and the field truly optional.
- **Changed:** `_activityLabel(ev)` — appends muted attribution when `ev.by` is present. Rendered as an inline `<span>` with muted color (`#5a7a9a`) so attribution is visually secondary to the action. Example output: `"Production run — 42 buckets made · by Sarah"`. Backward-compatible — existing entries without `by` render unchanged.
- **Firestore cost:** Zero additional reads or writes. Attribution is stored inside the `storeEvents[]` array entries in the same `setDoc` merge call already happening in `writeRunSummary()`. Payload size increase: ~20 bytes per attributed event entry.
- **Privacy design:** First-name-only from email prefix. Never full email, UID, or aggregate per-user data. Attribution is contextual (shown with the action) — not isolated or ranked. The 10-entry cap on `storeEvents[]` means attribution data naturally rotates out; no long-term personal data accumulates in the store doc.
- **Result:** Managers viewing the "Recent Activity" feed in a store's detail panel see lightweight operational attribution — e.g. "Production run — 42 buckets made · by Sarah" — with no surveillance infrastructure, no employee rankings, and no additional Firestore cost.

### Operational Trend Indicators — Corporate Dashboard (2026-05-27)
- **Added:** `calcStoreTrend(store)` — pure function. Filters `storeEvents[]` to `run_completed` entries, splits them into two chronological halves, compares average bucket counts. Returns `'up'` (≥10% improvement), `'down'` (≥10% decline), or `'stable'`. Returns `null` when fewer than 3 `run_completed` events exist — no badge shown rather than a noisy guess.
- **Added:** `_renderTrendBadge(trend)` — builds a compact inline DOM element for a given trend value. `↑ Trending up` (green), `↓ Declining` (red), `→ Stable` (muted). Returns `null` when trend is null so call sites can do a simple `if (badge)` guard.
- **Changed:** `_buildStoreDetailPanel()` — trend badge added to the title block (below store name and ID slug), visible when the accordion panel is open.
- **Changed:** `renderMultiStoreOverview()` per-store cards — trend badge appended after the metric pills, before the expand chevron.
- **Firestore cost:** Zero reads, zero writes, zero new fields. Calculation uses `store.storeEvents[]` already present in every store doc returned by `loadOrgStores()`.
- **Threshold:** Minimum 3 `run_completed` entries required. With a 10-entry cap, this means the badge appears after a store's third recorded production run.
- **Result:** CORPORATE_ADMIN sees a directional production signal (↑ / → / ↓) on each store card and inside the detail panel. New or sparse stores show no badge rather than a misleading indicator.

### Store Activity Timeline — Corporate Dashboard (2026-05-27)
- **Added:** `_storeEvents` module-level variable — in-memory store for the current store's recent activity entries. Populated by `applyData()` from `store.storeEvents` field, updated locally on each run completion.
- **Changed:** `applyData(data)` — now reads `data.storeEvents || []` into `_storeEvents` so run writes have access to current history without an extra Firestore read.
- **Changed:** `writeRunSummary()` — now appends a `{ type: 'run_completed', buckets: N, at: timestamp }` entry to `_storeEvents`, trims to last 10, and writes `storeEvents` alongside `lastRunDate`/`lastRunBuckets`/`lastRunAt` in the same existing `setDoc` merge call. Zero additional Firestore writes beyond what was already happening.
- **Added:** `_activityLabel(ev)` — converts a `storeEvents[]` entry to a human-readable label. Currently handles `run_completed`; extensible for future event types.
- **Changed:** `_buildStoreDetailPanel()` — replaced the "Last run" single-line row with a full "Recent Activity" feed section:
  - Shows up to 5 most recent entries from `store.storeEvents[]`, newest first
  - Each row: `● [label] · [relative time]`
  - If more than 5 entries exist: `+ N older entries` hint row
  - **Backward-compatible fallback:** if `storeEvents` is empty but `lastRunAt` exists (stores that ran before this update), synthesizes one entry from `lastRunAt` + `lastRunBuckets` — no data lost
  - Empty state: "No production runs recorded yet."
- **Firestore cost:** Zero additional reads. `storeEvents` is included in the store doc returned by the existing `getDocs` in `loadOrgStores()`. Zero additional writes — appended to the same `setDoc` already happening in `writeRunSummary()`.
- **Firestore structure update:** `storeEvents: [{type, buckets, at}]` field added to `organizations/{orgId}/stores/{storeId}`. Array, max 10 entries, oldest trimmed on each run completion write.
- **Result:** CORPORATE_ADMIN sees a chronological production run history inside each store's detail panel — e.g. "Production run — 42 buckets made · 2h ago" — with no additional Firestore reads or writes.

### Store Detail View — Corporate Dashboard (2026-05-27)
- **Added:** `showStoreDetail(store, anchorEl)` — toggle function. Opens an inline accordion panel below the clicked anchor element (store card or alert row). If the same anchor is clicked again, collapses the panel. Only one panel open at a time across the dashboard.
- **Added:** `_closeStoreDetail(anchorEl)` — removes the active detail panel, resets the chevron rotation, clears the `_activeDetailAnchor` tracking variable.
- **Added:** `_buildStoreDetailPanel(store, anchorEl)` — builds the full detail panel from the in-memory store object. Sections:
  1. **Header** — store label + store ID slug + `×` close button (44px touch target)
  2. **Status row** — colored dot, active/inactive label, last sync timestamp flush right
  3. **Metrics row** — Made Today / Active Flavors / Shortages (3-cell grid, Shortages in red if > 0)
  4. **Last run** — relative time + bucket count (rendered only if `lastRunAt` exists)
  5. **Flavors Short** — per-flavor shortage rows with `toMake(f)` count and flavor type tag (rendered only if shortages > 0)
  6. **Active Flavors roster** — grouped by type (Regular / Take & Dip / Walk-Out) as comma-joined name lists
- **Changed:** `buildAttentionAlerts` — each alert object now includes `store` (full store reference) so `renderNeedsAttention` can pass it to `showStoreDetail` on click.
- **Changed:** `renderNeedsAttention` alert rows — added `cursor:pointer`, `title` tooltip, and `onclick → showStoreDetail(store, row)`.
- **Changed:** `renderMultiStoreOverview` per-store cards — added `cursor:pointer`, `title` tooltip, `onclick → showStoreDetail(store, card)`, and a `›` chevron expand indicator (rotates 90° when panel is open).
- **Firestore cost:** Zero additional reads. All panel data comes from the `loadOrgStores()` result already in memory. `toMake(f)` is computed client-side from `activeFlavors` fields.
- **Result:** CORPORATE_ADMIN can tap any store card or alert row to see full operational detail inline — shortages by flavor, production summary, flavor roster — without leaving the dashboard or opening a modal.

### Needs Attention — Corporate Dashboard (2026-05-27)
- **Added:** `buildAttentionAlerts(stores)` — pure function that derives operational alerts from already-loaded store data. Detects four conditions sorted by priority (urgent → warning → notice):
  1. **Flavors short** (urgent 🔴): `storeShortagesCount(store) > 0`
  2. **No activity today** (warning 🟡): store has active flavors but `storeIsActiveToday()` is false
  3. **Stale data** (warning 🟡): store is active today but `updatedAt > 4h` ago (device went offline after run)
  4. **Low production** (notice 🔵): `lastRunBuckets < 50%` of org average; requires ≥2 active stores and avg > 2 to filter noise
- **Added:** `renderNeedsAttention(containerEl, alerts)` — renders a compact colored alert list if any alerts exist, or a compact green "all stores operational" all-clear row if none.
- **Changed:** `renderMultiStoreOverview` — loading state now covers both the "Needs Attention" section and "Store Overview" section. After data loads: `renderNeedsAttention` fires first (alerts at top), then "Store Overview" heading + chips + per-store cards. Pre-load "Store Overview" heading removed — heading now appears after data resolves.
- **Firestore cost:** Zero additional reads — alerts are derived from the same `loadOrgStores()` result already used by the overview. One `getDocs` covers both sections.
- **Result:** CORPORATE_ADMIN sees a compact operational health summary at the top of the async dashboard section: urgent shortages and inactive/stale stores surface immediately, with the full per-store grid below.

### Multi-Store Overview — Corporate Dashboard (2026-05-26)
- **Added:** `todayStr()` — returns today's date as YYYY-MM-DD (`en-CA` locale, consistent across environments).
- **Added:** `writeRunSummary()` — async, writes `lastRunDate`, `lastRunBuckets`, and `lastRunAt` to the current store doc (merge) after each completed run. Fire-and-forget from `closeSummary()`. Only writes if at least 1 bucket was made.
- **Changed:** `closeSummary()` now calls `writeRunSummary()` before `doneRun()`.
- **Added:** `storeIsActiveToday(store)` — true if `lastRunDate === today` OR `updatedAt` date matches today.
- **Added:** `storeShortagesCount(store)` — count of active flavors where `toMake(f) > 0`. Reuses existing `toMake()`.
- **Added:** `storeProductionToday(store)` — returns `lastRunBuckets` if `lastRunDate` matches today, else 0.
- **Added:** `relativeTime(ts)` — human-readable relative timestamp (e.g. "12m ago", "3h ago").
- **Added:** `renderMultiStoreOverview(content)` — async function that fetches full store docs (`loadOrgStores()`), renders 3 summary chips (Active Today, Shortages, Buckets Made Today), then a per-store card for each store showing: name, active status, last updated, flavor count, shortages, and buckets made today.
- **Changed:** `showCorporateDashboard()` now calls `renderMultiStoreOverview(content)` immediately after the stats cards. The overview appends with a loading state and resolves independently — dashboard renders instantly, overview fills in async.
- **Firestore cost:** 1 `getDocs` per dashboard open (already paid by `loadOrgStores()`). 1 `setDoc` merge per completed run. No new indexes needed.
- **Result:** CORPORATE_ADMIN gets an at-a-glance operational view of all stores in the org: which are active today, how many shortages exist across stores, and how many buckets each store made in today's run.

### Add Store Flow — Corporate Dashboard (2026-05-26)
- **Added:** `renderStoreForm(containerEl, opts)` — shared form helper that builds the store name/ID input pair, slug auto-fill, validation, offline + auth guards, and double-submit protection. Closure-based — no element IDs, safe to render in multiple places simultaneously.
- **Refactored:** `showOrgSetupForm(listEl)` now delegates to `renderStoreForm()` — zero duplicated logic.
- **Removed:** `submitOrgSetup()` — replaced by the closure inside `renderStoreForm()`.
- **Added:** `renderAddStoreSection(content)` — renders an "Add Another Store" panel at the bottom of the corporate dashboard. Calls `renderStoreForm()` with `onSuccess` that shows a brief confirmation then re-renders the dashboard to reflect the updated store count.
- **Changed:** `showCorporateDashboard()` now calls `renderAddStoreSection()` when the signed-in user is `CORPORATE_ADMIN`.
- **Result:** A CORPORATE_ADMIN can add a second (or subsequent) store to an existing org directly from the corporate dashboard, using the same validated form and `createOrgAndStore()` logic as initial setup — no code duplication.

### Org Onboarding Flow (2026-05-26)
- **Added:** `showOrgSetupForm(listEl)` — renders inline "Create first store" form inside the store picker overlay when an org has no stores and a manager is signed in.
- **Added:** `submitOrgSetup()` — validates the form (store name + auto-generated store ID slug) and guards against offline state, missing auth, and invalid IDs before writing.
- **Added:** `createOrgAndStore(storeLabel, storeId)` — writes all three Firestore documents in sequence:
  1. `organizations/{orgId}` (skips write if doc already exists)
  2. `organizations/{orgId}/stores/{storeId}` (new store document)
  3. `organizations/{orgId}/members/{uid}` (assigns creator as `CORPORATE_ADMIN`)
  Then updates local role state and adds the new store to the in-memory list so `selectStore()` can proceed without a page reload.
- **Changed:** `showStorePicker()` no-stores branch now shows the setup form for signed-in users; shows a "sign in to set up" message for unauthenticated users.
- **Result:** A signed-in manager can fully initialize a brand-new org and first store from within the app — no Firestore console access required.

### Multi-Org Foundation Cleanup (2026-05-26)
- **Fixed:** Removed duplicate `getOrgMemberRef` override in `index.html` that bypassed `appHelpers.js` and hardcoded `window._ORG_ID` directly into the Firestore member path.
- **Fixed:** Replaced two direct `window._STORE_ID` usages in `loadCurrentUserRole` and `setCurrentUserRole` with `window.getCurrentStoreId()`.
- **Result:** All Firestore member document references now go through a single source of truth in `appHelpers.js`.

### Initial Refactor Phase
- Began modularizing application
- Improved offline handling
- Added Firebase synchronization improvements
- Added multi-store foundations
- Began architecture cleanup

---

## Upcoming Changes
- Per-org Firestore security rules
- PWA installability improvements
