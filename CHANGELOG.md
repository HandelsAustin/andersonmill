# Changelog

## Current Version
v0.1

---

## Recent Changes

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
