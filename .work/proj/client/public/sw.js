/* ============================================================================
   MED School — Service Worker (PWA)
   ----------------------------------------------------------------------------
   Responsibilities:
     1. Offline app-shell (installable, works with no network).
     2. Layered caching strategy (research-backed, 2025/2026 best practice):
          • Cache-First  → hashed static assets (JS/CSS/fonts/images) — safe forever.
          • Network-First → HTML navigations — fresh markup, fall back to cache,
                            then to a friendly /offline.html page.
          • Stale-While-Revalidate → read-only GET API (fast paint + freshness).
          • Network-Only → writes / auth / pay / uploads (never cache).
     3. Web Push notifications (in-app bell + browser push).
   The cache VERSION is bumped on every build (see CACHE_VERSION) so old caches
   are cleaned automatically on activate. AI-free, zero external dependencies.
   ========================================================================== */

/* The cache VERSION is stamped at build time (see scripts/stamp-sw.mjs) with the
   app's VERSION.txt so old caches are cleaned automatically on every release.
   The __BUILD_VERSION__ token below is replaced during `npm run build`; if it is
   ever left un-replaced (dev), we fall back to a date so it still changes. */
const CACHE_VERSION = "medschool-__BUILD_VERSION__";  // stamped on build
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;    // app shell (html/offline)
const STATIC_CACHE  = `${CACHE_VERSION}-static`;   // hashed assets
const API_CACHE     = `${CACHE_VERSION}-api`;      // read-only API responses
const IMG_CACHE     = `${CACHE_VERSION}-img`;      // uploaded images (bounded)

const OFFLINE_URL = "/offline.html";

// Minimal shell precached at install so the app opens with zero network.
const SHELL_ASSETS = ["/", "/index.html", OFFLINE_URL, "/manifest.webmanifest", "/icon-192.png"];

// Bounded caches: keep growth in check (research: cap dynamic caches).
// The image cache holds teacher-uploaded slides/micrographs (Cache-First,
// content-addressed by URL); raised from 80 to 220 after measuring that
// histology courses revisit a few hundred images per term.
const LIMITS = { [API_CACHE]: 60, [IMG_CACHE]: 220 };

async function trimCache(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    // delete oldest-first (Cache API preserves insertion order)
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  } catch (_) {}
}

/* ---------------------------------------------------------------- install --- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())            // activate the new SW immediately
      .catch(() => self.skipWaiting())            // never block install on one 404
  );
});

/* --------------------------------------------------------------- activate --- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => !n.startsWith(CACHE_VERSION)).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())          // take control of open tabs
  );
});

/* ------------------------------------------------------- message (update) --- */
// The page can ask a waiting SW to activate right away ("Update available" toast).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  // On sign-out the app asks us to forget cached API bodies (profile, notes,
  // notifications…) so the next person on a shared device cannot see them
  // offline. Auth/pay/admin were never cached; this clears the rest.
  if (event.data && event.data.type === "CLEAR_API_CACHE") {
    event.waitUntil(caches.delete(API_CACHE).catch(() => {}));
  }
});

/* --------------------------------------------------- caching strategies ----- */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const resp = await fetch(request);
  if (resp && resp.ok) {
    cache.put(request, resp.clone());
    if (LIMITS[cacheName]) trimCache(cacheName, LIMITS[cacheName]);
  }
  return resp;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) {
        cache.put(request, resp.clone());
        if (LIMITS[cacheName]) trimCache(cacheName, LIMITS[cacheName]);
      }
      return resp;
    })
    .catch(() => null);
  return cached || network || fetch(request);
}

// HTML navigations: try network, fall back to cached shell, then offline page.
async function networkFirstNav(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) cache.put("/index.html", resp.clone());
    return resp;
  } catch (_) {
    return (
      (await cache.match(request)) ||
      (await cache.match("/index.html")) ||
      (await cache.match(OFFLINE_URL)) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

/* ------------------------------------------------------------------ fetch --- */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;           // never cache writes (Network-Only)

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // only handle same-origin

  // 1) API requests -------------------------------------------------------
  // Data must always be fresh: users create content and expect to see it
  // immediately, so we use Network-First (NOT stale-while-revalidate). When the
  // network is unreachable we fall back to the last cached copy so previously
  // viewed screens still render offline; otherwise a clean 503 the app handles.
  if (url.pathname.startsWith("/api/")) {
    // Never touch auth/pay/upload/admin — always live, never cached.
    if (/^\/api\/(auth|pay|upload|admin)\b/.test(url.pathname)) return;
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(API_CACHE).then((c) => {
              c.put(request, clone);
              trimCache(API_CACHE, LIMITS[API_CACHE]);
            });
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ||
            new Response(JSON.stringify({ error: "offline" }), {
              status: 503, headers: { "Content-Type": "application/json" },
            })
          );
        })
    );
    return;
  }

  // 2) HTML navigations → Network-First w/ offline fallback ---------------
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // 3) Uploaded images → Cache-First (bounded) ----------------------------
  if (url.pathname.startsWith("/uploads/") || request.destination === "image") {
    event.respondWith(cacheFirst(request, IMG_CACHE).catch(() => fetch(request)));
    return;
  }

  // 4) Hashed static assets (JS/CSS/fonts) → Cache-First ------------------
  if (["script", "style", "font"].includes(request.destination) || url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE).catch(() => fetch(request)));
    return;
  }

  // default: try cache, then network.
  event.respondWith(
    caches.match(request).then((c) => c || fetch(request)).catch(() => fetch(request))
  );
});

/* ------------------------------------------------------------- Web Push ----- */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: "MED School", body: event.data && event.data.text() }; }
  const title = data.title || "MED School";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: { link: data.link || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) { if ("focus" in w) return w.focus(); }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
