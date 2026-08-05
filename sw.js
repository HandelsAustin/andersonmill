/**
 * Count & Run — Service Worker
 * Strategy: cache-first for app shell + Firebase CDN; network-first passthrough for Firestore/Auth API calls.
 *
 * To deploy a new app version that busts the old cache, bump CACHE_VERSION below.
 */

const CACHE_VERSION = 'v27';
const CACHE_NAME    = `count-and-run-${CACHE_VERSION}`;

// App shell — precached on SW install; served from cache immediately on all subsequent loads.
const APP_SHELL = [
  '/',
  '/index.html',
  '/appHelpers.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/js/auth.js',
  '/js/roster.js',
  '/js/made-stepper.js',
  '/js/production.js',
  '/js/manager-lock.js',
  '/js/store-org.js',
  '/js/dashboard.js',
  '/js/settings.js',
  '/js/novelties.js',
  '/js/inventory.js',
  '/js/app-core.js',
];

// Firebase CDN modules — cached on first network fetch, served from cache offline.
// Versioned URLs are stable; safe to cache indefinitely.
const FIREBASE_CDN_BASE  = 'https://www.gstatic.com/firebasejs/10.12.0/';
const FIREBASE_CDN_FILES = [
  'firebase-app.js',
  'firebase-firestore.js',
  'firebase-auth.js',
].map(f => FIREBASE_CDN_BASE + f);

// Firestore / Auth / token API hosts — bypass entirely; let the Firebase SDK manage them.
const BYPASS_HOSTNAMES = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'fcmregistrations.googleapis.com',
];

// ── Install: precache app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  // Activate this SW immediately — don't wait for old SW to be evicted.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // App shell must succeed — if any shell file fails, install fails (intentional).
      const shellPromise = cache.addAll(APP_SHELL);

      // Firebase CDN — best-effort; CORS issues or offline during install won't fail the SW.
      const cdnPromises = FIREBASE_CDN_FILES.map(url =>
        cache.add(url).catch(() => { /* silent — will be cached on first network fetch */ })
      );

      return Promise.all([shellPromise, ...cdnPromises]);
    })
  );
});

// ── Activate: clean up stale caches ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('count-and-run-') && k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim()) // Take control of all open tabs immediately.
  );
});

// ── Fetch: cache-first strategy ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only intercept GET requests.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Skip non-http(s) schemes (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Bypass Firestore/Auth API calls — Firebase SDK manages its own offline persistence.
  if (BYPASS_HOSTNAMES.some(h => url.hostname.includes(h))) return;

  event.respondWith(
    caches.match(req).then(cached => {
      // Cache hit — return immediately (cache-first).
      if (cached) return cached;

      // Cache miss — fetch from network, cache the response for next time.
      return fetch(req).then(response => {
        const isSameOrigin  = url.origin === self.location.origin;
        const isFirebaseCDN = url.hostname === 'www.gstatic.com';

        if (response.ok && (isSameOrigin || isFirebaseCDN)) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, response.clone()));
        }
        return response;
      }).catch(() => {
        // Offline + no cache hit: for navigate requests serve the cached shell.
        if (req.mode === 'navigate') {
          return caches.match('/index.html');
        }
        // For other asset types, just let it fail (browser handles gracefully).
      });
    })
  );
});
