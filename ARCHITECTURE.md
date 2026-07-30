# Architecture

## Current Architecture
Single-page operational web app using:
- Firebase Firestore
- Offline local persistence
- Tablet-focused workflows

## Code Layout
`index.html` holds markup/CSS + the small Firebase-init module script only.
App logic is split into plain classic scripts (no bundler, no build step —
Vercel deploys the repo as-is), loaded via `<script src defer>` in this order:

- `appHelpers.js` — org/store state + Firestore ref helpers, analytics events
- `js/auth.js` — Firebase auth, role loading, auth modal
- `js/roster.js` — master flavor roster, roster CRUD, add-flavor modal/picker, cabinet-sort
- `js/production.js` — production run state, table rendering, run mode, catering, print, run summary
- `js/manager-lock.js` — manager PIN lock (local session lock layered on role/auth)
- `js/store-org.js` — org/store Firestore refs, load/save, org & store picker UI
- `js/dashboard.js` — corporate + manager dashboards, store detail, trend analytics
- `js/app-core.js` — sync status, connectivity, init/bootstrap, entry screen, SW + PWA install

All top-level `let`/`const` declarations share one global lexical scope across
these script tags (standard classic-script behavior), so no module system or
build tooling is needed to keep them talking to each other.

## Current Direction
Evolving toward:
- Multi-tenant SaaS platform
- Multi-store support
- Corporate visibility
- Analytics/reporting
- PWA deployment

## Core Principles
- Keep architecture simple
- Avoid unnecessary abstraction
- Modularize only where valuable
- Preserve maintainability for solo founder

## Planned Structure

### Organizations
organizations/{orgId}

### Stores
organizations/{orgId}/stores/{storeId}

### Planned Modules
- auth
- production
- inventory
- analytics
- offline sync

## Future Goals
- Corporate dashboards
- Cross-store analytics
- Forecasting
- Native app wrapper (later)