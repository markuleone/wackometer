// Wackometer service worker: makes the app installable and keeps the shell working offline.
// Pages: network first, fall back to the cached shell. Static files: cache first (they're content-hashed).
// The API is never cached.
const CACHE = "wk-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/fonts/fredoka.woff2", "/data/words.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { if (url.pathname === "/" && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("/", cp)); } return r; }).catch(() => caches.match("/")));
    return;
  }
  if (/^\/(css|js|fonts|icons|data)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
  }
});
