/*
 * VicisRota service worker. Keeps a saved copy of each person's own page (/me) so they can still
 * see their shifts with no signal, plus the app's static files. Nothing else is stored: manager
 * pages hold other people's information and always need the network.
 * PAGE_CACHE must match src/lib/offline.ts, which clears it on sign out.
 */
const PAGE_CACHE = "vr-pages-v1";
const STATIC_CACHE = "vr-static-v2";
const SAVED_PAGES = ["/me"];
const OFFLINE_PAGE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = [PAGE_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Built files have content hashes in their names, so a stored copy never goes stale.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode !== "navigate") return;
  const saved = SAVED_PAGES.includes(url.pathname);
  // Always try the network first so people see the latest rota whenever they have signal.
  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (saved) {
          const cache = await caches.open(PAGE_CACHE);
          // A redirect means they are signed out or not staff: forget any saved copy.
          if (response.ok && response.type === "basic") await cache.put(url.pathname, response.clone());
          else await cache.delete(url.pathname);
        }
        return response;
      })
      .catch(async () => {
        const copy = saved ? await caches.match(url.pathname, { cacheName: PAGE_CACHE }) : undefined;
        return copy || (await caches.match(OFFLINE_PAGE, { cacheName: STATIC_CACHE })) || Response.error();
      }),
  );
});
