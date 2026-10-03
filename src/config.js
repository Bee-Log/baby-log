// Build-time settings. scripts/build.mjs fills in the double-underscore tokens.
// Loaded by the page (<script>) and by the service worker (importScripts).
(function (root) {
  var env = '__APP_ENV__'; // 'test' or 'live'
  root.BABYLOG_CONFIG = {
    env: env,
    version: '__APP_VERSION__',
    // Test builds must never touch real data: every storage name gets this prefix.
    storagePrefix: env === 'test' ? 'test-' : '',
    // Drive app-data folder name for sync (used by a later feature).
    driveFolder: env === 'test' ? 'baby-log-test' : 'baby-log'
  };
})(typeof self !== 'undefined' ? self : this);
