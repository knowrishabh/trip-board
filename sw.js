/* Two caches with different jobs.

   The app files are network-first: when you push a new app.js the next
   launch with signal picks it up, and the cached copy is only a
   fallback for when there is none. Map tiles are cache-first, because
   a tile never changes and you want the ones you have already seen to
   work on the ground. */
const SHELL = "trip-board-shell-v2";
const TILES = "trip-board-tiles-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["./", "./index.html"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(
      caches.open(TILES).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) c.put(req, res.clone());
          return res;
        } catch (err) {
          return new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") return cache.match("./index.html");
        throw err;
      }
    })()
  );
});
