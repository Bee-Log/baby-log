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
  'nav.js',
  'icons.js',
  'records.js',
  'store.js',
  'feed.js',
  'feed-ui.js',
  'sleep.js',
  'sleep-ui.js',
  'pastsleep.js',
  'pastsleep-ui.js',
  'profile.js',
  'profile-ui.js',
  'edit-ui.js',
  'styles.css',
  'manifest.webmanifest',
  'fonts/atkinson-hyperlegible-400.woff2',
  'fonts/atkinson-hyperlegible-700.woff2',
  'fonts/bricolage-grotesque-700.woff2',
  'icons/__ICON_PREFIX__icon-192.png',
  'icons/__ICON_PREFIX__icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    // cache: 'reload' skips the browser's HTTP cache (GitHub Pages allows 10 minutes),
    // so a new version never stores the previous version's files.
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL.map(function (url) { return new Request(url, { cache: 'reload' }); }));
    })
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
    // Pages: cache first, so the page and its scripts always come from the same version.
    // A new version installs in the background; app.js reloads the page once when it takes over.
    event.respondWith(
      fromCache(req, { ignoreSearch: true }).then(function (hit) {
        return hit || fetch(req).catch(function () { return fromCache('offline.html'); });
      })
    );
    return;
  }

  // Other files: cache first, then network.
  event.respondWith(
    fromCache(req).then(function (hit) { return hit || fetch(req); })
  );
});

// Look only in this version's cache. Test and live share one origin, and old caches may still exist.
function fromCache(req, opts) {
  return caches.open(CACHE).then(function (cache) { return cache.match(req, opts); });
}
