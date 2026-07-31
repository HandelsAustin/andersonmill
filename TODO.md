# TODO

Detailed history of what's been built lives in `CHANGELOG.md`. This file is just
the current, actionable state — what's left, what needs testing, and what's been
deliberately deferred.

## Needs real-world testing (built and verified in a sandbox, not yet confirmed live)
- [ ] **Switch Store** (Settings tab) — no account with multiple stores exists yet to test against; logic is verified but unconfirmed live.
- [ ] **Inventory CSV import** — only tested against a synthetic sample file. Try it with a real distributor export; column-mapping should handle whatever headers it has, but worth confirming.

## Known gaps / deferred by choice
- **Full light/dark theme parity** — Settings/Novelties/Inventory tabs support both; the Ice Cream Run table and both dashboards are still dark-only (the rest of the app uses hardcoded inline colors, not CSS variables — converting it is a separate pass). Revisit when we next touch the Settings tab.
- **Two entry points still bypass Settings for Edit Flavors**: the empty-state "Set Up Today's Flavors" button and the Manager Dashboard's shortage-row click both open the flavor picker directly (both still PIN-gated via `requireManager()`, so nothing insecure — just inconsistent with "Edit Flavors only lives in Settings" now). Confirmed fine to leave as-is for now.

## One-time deployment checklist (predates this session — confirm still true)
- [ ] Firebase Console → Authentication → Authorized domains includes the Vercel production URL (sign-in works today, so this is very likely already done — worth a quick confirmation glance).
- [ ] SW registers correctly in DevTools → Application → Service Workers on the live URL.

## Future ideas
- Forecasting, waste analytics, labor insights, AI production recommendations (long-term, not scoped).
- Corporate renaming/reorganizing master flavor entries beyond code/type — display name is currently immutable by design (see CHANGELOG) since it's the primary key used throughout the app; would need a broader refactor to support safely.
