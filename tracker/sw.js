/* Sprinkler Tracker service worker.
   Bump CACHE when you upload a new index.html, or devices keep serving the old page. */
const CACHE = 'sprinkler-tracker-v8';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;

  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }

  var isDoc = e.request.mode === 'navigate' ||
              url.pathname.endsWith('/') ||
              url.pathname.endsWith('index.html');

  // The page itself: network first so updates land, cache fallback so it opens with no signal.
  if (isDoc && url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(function (resp) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }).catch(function () {});
          return resp;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (r) {
            return r || new Response('Offline and no cached copy yet. Open this once with a signal.',
              { status: 503, headers: { 'Content-Type': 'text/plain' } });
          });
        })
    );
    return;
  }

  // Everything else (icons, fonts): cache first, then network, caching what succeeds.
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        return resp;
      }).catch(function () {
        return hit || Response.error();
      });
    })
  );
});
