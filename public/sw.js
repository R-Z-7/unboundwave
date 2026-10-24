// These values are filled from the finished Vite output by build-pwa.mjs.
const CACHE = "unboundwave-shell-__BUILD_ID__";
const PRECACHE = __PRECACHE_URLS__;
const SHELL = "/index.html";

self.addEventListener("install", (event) => {
  // Install the complete release; wait for old windows to close before updating.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("unboundwave-shell-") && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  // Keep the page and its assets on the same release, online or offline.
  // Invite query strings remain in the browser URL.
  if (request.mode === "navigate") {
    event.respondWith(caches.open(CACHE).then(async (cache) =>
      (await cache.match(SHELL)) || fetch(request)));
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) =>
      (await cache.match(url.pathname)) || fetch(request)));
  }
  // Never persist account data, relay responses, or arbitrary URLs.
});
