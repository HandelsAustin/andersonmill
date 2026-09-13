# TODO

Detailed history of what's been built lives in `CHANGELOG.md`. This file is just
the current, actionable state — what's left, what needs testing, and what's been
deliberately deferred.

## Needs real-world testing (verified against the local emulator, not yet confirmed live)
- [ ] **Switch Store** (Settings tab) — re-reviewed in the 2026-09-12 audit: `selectStore()` correctly locks the PIN, resets to the Run tab, and reloads everything for the new store. Logic looks right; still no account with multiple stores to test against live.
- [ ] **Inventory CSV import** — column-header auto-guess normalization fixed 2026-09-12; cancel/undo-import added same day, verified against the emulator with a real file end-to-end. Still worth one real-world distributor export to confirm the header-matching.
- [x] **Firestore rules rewrite (2026-09-12)** — deployed to production the same day. The privilege-escalation, cross-store-scoping, and org-bootstrap fixes are covered by an automated emulator test suite (`npm test`, 14/14 passing). Still worth one real end-to-end pass on a live device (sign in as a STORE_MANAGER, confirm normal store access still works and another store's data is now correctly refused) — the emulator tests prove the rules logic, not the live deploy's behavior against a real device/network.
- [ ] **Novelties resilience fix** and **Ice Cream Run day-rollover auto-resume** (2026-09-12) — both verified against the local emulator, including simulating the exact failure mode for Novelties (a rejected `getDoc()`) and a real interrupted-run resume from a seeded "yesterday" doc. What the emulator *can't* reproduce: genuine iOS PWA backgrounding/tab-eviction behavior — worth confirming on an actual device once deployed, especially the "calculate tonight, finish tomorrow" workflow that prompted this fix.
- [ ] **Print-after-submit / Last 30 Days report** (2026-09-12) — both new, verified functionally against the emulator (correct data reaches the print window / the on-screen table); worth a quick look on a real device for layout/print-dialog behavior.
- [ ] **Tear-Down tracking, Stage 2** (2026-09-12) — new feature, verified end-to-end against the emulator: Made-stepper tear-down prompt for `type='TD'` flavors, the pre-submit before/after/additional-flavor question flow, the `tearDownLog/{date}` write (including a real race-condition bug found and fixed during testing — see CHANGELOG), and the Settings recall view. Not yet tried on a real device or with a real multi-flavor `TD` run.
- [ ] **Freezer/Fridge Temp tab, Stage 3** (2026-09-12) — new tab, verified end-to-end against the emulator: equipment add/remove/duplicate-numbering, daily reading entry, submit (including the missing-reading confirmation), the submitted-day lock + manager Reopen flow (added after catching a real data-loss bug — see CHANGELOG), and the Settings recall view. Not yet tried on a real device.
- [ ] **Rules test coverage** — `tests/rules-unit-tests.js` now has an explicit case for `tearDownLog`/`tempLog` cross-store scoping (14/14 passing), but doesn't yet cover the members-collection self-role-escalation guard specifically for these two newer collections' `by`/attribution fields, or the missing-manager-PIN client-side gating (not a rules concern, but worth a manual pass).

## Action needed from you (not a code fix)
- [ ] **Staff getting signed out periodically** (investigated 2026-09-12, see CHANGELOG) — no code bug found; every automatic-sign-out path was traced and none exist. Most likely cause: a device being used as a bookmarked browser tab rather than an installed PWA ("Add to Home Screen") loses its saved sign-in when the browser evicts storage for inactive sites — installing keeps it in a separate, durable storage bucket that isn't evicted the same way. **Please confirm every staff device/tablet has actually done "Add to Home Screen"** (iOS: Share ⬆ → Add to Home Screen; Android/Chrome: the in-app "⬇ Install App" toolbar button, or browser menu → Install app) rather than just having the URL bookmarked or a pinned tab. A note now shows directly on the sign-in screen itself explaining this when it happens, to help staff self-serve without needing you.

## Local emulator test harness (new, 2026-09-12)
- `npm run emulators` (Firestore/Auth/Hosting, leave running) → `npm run seed:emulator` (idempotent baseline data) → `npm run check:app` or a custom Playwright script (see `tests/browser-check.js`, `.claude/skills/run-app/SKILL.md`) — lets changes be verified by actually running the app against isolated local data instead of a live store. Use this before reporting UI/data-flow changes as done going forward.

## Known gaps / deferred by choice
- **Full light/dark theme parity** — Settings/Novelties/Inventory tabs support both; the Ice Cream Run table and both dashboards are still dark-only (the rest of the app uses hardcoded inline colors, not CSS variables — converting it is a separate pass). Revisit when we next touch the Settings tab.
- **Two entry points still bypass Settings for Edit Flavors**: the empty-state "Set Up Today's Flavors" button and the Manager Dashboard's shortage-row click both open the flavor picker directly (both still PIN-gated via `requireManager()`, so nothing insecure — just inconsistent with "Edit Flavors only lives in Settings" now). Confirmed fine to leave as-is for now.
- **Config constants triplicated** (`ROLES`/`DEFAULT_ORG_ID`/`DEFAULT_ORG_META` each independently declared in `config.js`, `js/auth.js`, and copied onto `window` in `index.html`) — flagged in the 2026-09-12 audit as a maintenance smell (editing one without the others would silently diverge), but left alone: collapsing them touches how classic-script global scope resolves identifiers across every file, and the risk of a subtle break wasn't worth it in an audit pass. Worth a careful, isolated pass on its own.

## One-time deployment checklist (predates this session — confirm still true)
- [ ] Firebase Console → Authentication → Authorized domains includes the Vercel production URL (sign-in works today, so this is very likely already done — worth a quick confirmation glance).
- [ ] SW registers correctly in DevTools → Application → Service Workers on the live URL.
- [ ] **Deploy the updated `firestore.rules`** (2026-09-12 audit, now also covering `tearDownLog`/`tempLog`) — this is the single most important follow-up from this session; the fixes only protect the live app once deployed.

## Future ideas
- Forecasting, waste analytics, labor insights, AI production recommendations (long-term, not scoped).
- Corporate renaming/reorganizing master flavor entries beyond code/type — display name is currently immutable by design (see CHANGELOG) since it's the primary key used throughout the app; would need a broader refactor to support safely.
