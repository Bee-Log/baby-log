// Build-time settings. scripts/build.mjs fills in the double-underscore tokens.
// Loaded by the page (<script>) and by the service worker (importScripts).
(function (root) {
  var env = '__APP_ENV__'; // 'test' or 'live'
  root.BABYLOG_CONFIG = {
    env: env,
    version: '__APP_VERSION__',
    // Test builds must never touch real data: every storage name gets this prefix.
    storagePrefix: env === 'test' ? 'test-' : '',
    // Drive app-data folder name for sync (ADR-001).
    driveFolder: env === 'test' ? 'baby-log-test' : 'baby-log',
    // The public Google OAuth client ID. 'PLACEHOLDER' keeps sync switched off. Put the real one here when it is ready.
    // It is public and safe to commit. The client secret must never be used or committed.
    googleClientId: 'PLACEHOLDER'
  };
})(typeof self !== 'undefined' ? self : this);
