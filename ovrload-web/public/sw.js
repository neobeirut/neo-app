// Safe PWA Service Worker (No fetch hijacking to ensure 100% reliable page loads)
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});
