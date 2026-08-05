/* Rutas Antiguas — service worker.
 *
 * Network-first, always. The cache exists only so the app opens without a
 * signal; it is never preferred over a live response. That matters here because
 * the menu is edited from a phone and published live — a cache-first worker
 * would happily show a guest last week's prices.
 *
 * Bump CACHE when the shell changes; old caches are dropped on activate.
 */
var CACHE = 'rutas-antiguas-v1';

var SHELL = [
  './',
  './index.html',
  './assets/app.css',
  './assets/app.js',
  './assets/cloud.js',
  './assets/config.js',
  './tours.json',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  // addAll fails the whole install if any single file 404s, so add them
  // individually and let the worker install even if one is missing.
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (url) {
        return c.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Never touch Supabase — the menu and enquiries must always be live, and a
  // cached POST response would be worse than an error.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
