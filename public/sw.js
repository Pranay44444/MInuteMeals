// MinuteMeals Service Worker — v2
// Strategy: Network-first for HTML/navigation, Cache-first for hashed static assets

const CACHE_VERSION = 'minutemeals-v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PRECACHE_URLS = ['/manifest.json', '/icon.png'];

// —— INSTALL: precache shell assets + skip waiting ——
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate new SW immediately instead of waiting for old tabs to close
  self.skipWaiting();
});

// —— ACTIVATE: claim clients + purge old caches ——
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// —— FETCH: route requests by type ——
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API/backend requests — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests (HTML pages) → Network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed static assets (Expo bundles) → Cache-first (safe because filenames contain content hashes)
  if (url.pathname.startsWith('/_expo/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (manifest, icons, fonts, etc.) → Network-first
  event.respondWith(networkFirst(request));
});

// —— Network-first: try network, fall back to cache ——
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Only cache valid responses (not redirects, errors, or opaque)
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    // If offline and nothing cached, return a basic offline response for navigation
    if (request.mode === 'navigate') {
      return new Response(
        '<!DOCTYPE html><html><body><h1>Offline</h1><p>Please check your connection and try again.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    throw err;
  }
}

// —— Cache-first: use cache if available, else fetch + cache ——
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    throw err;
  }
}
