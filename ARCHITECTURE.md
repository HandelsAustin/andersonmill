# Architecture

## Current Architecture
Single-page operational web app using:
- Firebase Firestore
- Offline local persistence
- Tablet-focused workflows

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