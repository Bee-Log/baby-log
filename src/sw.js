/* Service worker: caches the app shell so the app opens with no internet. */
importScripts('config.js');

var CFG = self.BABYLOG_CONFIG;
var CACHE = CFG.storagePrefix + 'baby-log-shell-' + CFG.version;

// Every file the app needs to open offline. tests/build.test.mjs checks each one exists.
var SHELL = [
  './',
  'index.html',
  'offline.html',
  'app.js',
  'config.js',
  'styles.css',
  'manifest.webmanifest',
  'icons/__ICON_PREFIX__icon-192.png',
  'icons/__ICON_PREFIX__icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  // Delete old shell caches of this flavour only. Test caches start with 'test-', so live never matches them.
  var mine = CFG.storagePrefix + 'baby-log-shell-';
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf(mine) === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The live app is served at /baby-log/ and the test app at /baby-log/test/.
  // The live worker must leave test pages alone.
  if (CFG.env === 'live') {
    var testPath = new URL('test/', self.registration.scope).pathname;
    if (url.pathname.indexOf(testPath) === 0) return;
  }

  if (req.mode === 'navigate') {
    // Pages: network first, then the cached page, then the offline page.
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          return hit || caches.match('offline.html');
        });
      })
    );
    return;
  }

  // Other files: cache first, then network.
  event.respondWith(
    caches.match(req).then(function (hit) { return hit || fetch(req); })
  );
});
