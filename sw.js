const CACHE_NAME = "camp-meeting-shell-v2";
const SHELL_FILES = [
  "index.html",
  "styles.css",
  "config.js",
  "db.js",
  "firebase-db.js",
  "app.js",
  "design-pink.jpg",
  "design-purple.jpg",
  "design-black.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for the app shell, network-first fallback for everything else.
// Orders themselves are read/written via localStorage on the page, not
// through this worker, so submitting an order still requires the page to
// be open (this app has no background sync server to push to).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
