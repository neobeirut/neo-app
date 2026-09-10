const CACHE_NAME = 'flow-admin-cache-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon.png',
  '/flow-logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/maskable-icon-512x512.png'
];

// Install: precache app shell and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('flow-admin-cache-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. Ignore Chrome extension schemes or non-HTTP(S)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Bypass tablet-punch-pwa sub-app (has its own service worker)
  if (url.pathname.startsWith('/tablet-punch-pwa')) {
    return;
  }

  // 4. Bypass dynamic Supabase queries and API endpoints (Never cache API data)
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('railway.app') ||
    url.searchParams.has('apikey')
  ) {
    return;
  }

  // 5. Navigation requests (HTML pages): Network-first with offline cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 6. Static assets (JS, CSS, images, icons, fonts): Cache-first with stale-while-revalidate
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network fetch with cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// Listen for update messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
