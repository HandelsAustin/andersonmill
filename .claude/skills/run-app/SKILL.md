---
description: Launch Count & Run locally against the Firebase emulators (Firestore + Auth + Hosting) and drive it with a headless browser, so app behavior can be verified without touching the real production Firebase project or needing a human to field-test.
---

# Running Count & Run locally

This is a plain static PWA (no bundler/build step) pointed at a real Firebase
project (`handels-count-and-run`) in production. To test changes without
touching real data, run everything against the local Firebase Emulator Suite.

## 1. Start the emulators (leave running in the background)

```bash
npm run emulators
```

Starts Firestore (`:8080`), Auth (`:9099`), Hosting (`:5050`, serves the repo
root as static files — that's the actual app), and the Emulator UI (`:4000`,
useful for browsing seeded data/logs visually). Config lives in
`firebase.json`/`.firebaserc` (project id must match `config.js`'s
`FIREBASE_CONFIG.projectId`, currently `handels-count-and-run` — the emulators
are a fully isolated local data store keyed off that id; nothing here ever
reaches the real cloud project).

Data does **not** persist across emulator restarts (no `--import`/
`--export-on-exit` configured) — reseed after every fresh start.

## 2. Seed baseline data

```bash
npm run seed:emulator
```

Idempotent — safe to re-run. Creates, in the seeded emulator:
- Org `handels`, store `test-store`
- `admin@test.local` / `testpass123` — `CORPORATE_ADMIN` (sees every store)
- `manager@test.local` / `testpass123` — `STORE_MANAGER` scoped to `test-store`

Edit `tests/seed-emulator.js` directly to add more stores/accounts/scenarios
(e.g. a second store to test cross-store denial, or a second admin to test the
last-admin-delete guard) — it uses `firebase-admin` against the emulator via
`FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` env vars, which
bypasses rules (appropriate for seeding — NOT appropriate for testing rules
themselves, that's what `tests/rules-unit-tests.js` is for).

## 3. Drive it with a browser

```bash
node tests/browser-check.js
```

That file is a **template**, not a fixed suite — it signs in as the seeded
manager and confirms the Run tab loads, logging console output and saving a
screenshot to `tests/.last-check-screenshot.png` (gitignored). Copy the
pattern (`page.goto`/`page.fill`/`page.click`/`page.waitForTimeout`/
`page.textContent('body')`) and adapt the interaction + assertions for
whatever feature you're actually verifying. `playwright` is a project
devDependency (already installed, browser binary cached by Playwright at
`~/Library/Caches/ms-playwright` — no download needed on a machine that's run
this before).

**Always check for this exact console line before trusting anything else**:
```
🧪 Connected to local Firebase emulators (Firestore :8080, Auth :9099)
```
If it's missing, the page connected to *real production Firebase* instead —
this happens if the app is loaded from anywhere other than
`localhost`/`127.0.0.1` (see the `_isLocalDev` guard in index.html's inline
module script). Never proceed with a test run if this line is absent.

## Gotchas hit while setting this up

- Port `5000` is commonly taken on macOS (AirPlay Receiver) — the Hosting
  emulator is configured for `5050` instead in `firebase.json`.
- The header's "Sign In" button (`#authBtn`, opens the entry screen) and the
  entry screen's actual submit button both render the text "Sign In" —
  disambiguate with `button[onclick="signInManager()"]` for the real one.
- `connectFirestoreEmulator()`/`connectAuthEmulator()` must be called
  immediately after `getFirestore()`/`getAuth()`, before any other operation
  on those instances (including `setPersistence()`) — the SDK throws if you
  try to switch a client to an emulator after it's already made a real call.
- Use Playwright's `waitUntil: 'load'`, never `'networkidle'`, for `goto()`/
  `reload()` — once any tab has an active `onSnapshot` listener, Firestore
  keeps a long-poll connection open indefinitely and the page never reaches
  network idle, so that wait condition just times out.

## What this can't verify

Real device behavior an emulator/headless browser can't reproduce — e.g.
actual iOS PWA backgrounding/eviction, real network flakiness, or anything
needing a live production Firestore/Auth environment. Flag those explicitly
rather than claiming they're covered.
