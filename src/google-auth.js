// Google sign-in for the browser (Google Identity Services, "token" model).
// The access token is kept in MEMORY ONLY: never in localStorage or IndexedDB. TEST, LIVE and every other page on
// oudam-meas.github.io share one browser origin, so a stored token could be read by them (ADR-001 note, app-rules "Shared origin").
// Google's window opens ONLY when someone taps "Sign in". On a phone even a "quiet" renewal opens that window, and
// doing it by itself made the app open and close it in a loop. A sign-in lasts about an hour; then the app asks again.
// Google's script is loaded when the app opens (prepare), so a tap opens the window at once. A window opened later,
// after waiting for the script to download, can be blocked by the phone: then the first tap did nothing.
// Only the public client ID is used. There is no client secret.
(function (root) {
  var SCRIPT = 'https://accounts.google.com/gsi/client';
  var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var EXPIRY_MARGIN_MS = 60000;
  var SIGNIN_WAIT_MS = 180000;      // the sign-in window: time to pick an account and agree

  function fail(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  // The client ID is public. 'PLACEHOLDER' means the owner has not created it yet: sync stays off.
  function isConfigured(clientId) { return !!clientId && clientId.indexOf('PLACEHOLDER') !== 0; }

  // options: { clientId, document } (document is for tests)
  function create(options) {
    var doc = options.document || root.document;
    var token = null, expiresAt = 0;
    var client = null, pending = null, loading = null;

    // One download of Google's script at a time. A failed download (no network) can be tried again later.
    function loadScript() {
      if (root.google && root.google.accounts && root.google.accounts.oauth2) return Promise.resolve();
      if (!loading) {
        loading = new Promise(function (resolve, reject) {
          var tag = doc.createElement('script');
          tag.src = SCRIPT;
          tag.async = true;
          tag.onload = function () { resolve(); };
          tag.onerror = function () { loading = null; tag.remove(); reject(fail('offline', 'Could not load Google sign-in')); };
          doc.head.appendChild(tag);
        });
      }
      return loading;
    }

    function getClient() {
      return loadScript().then(function () {
        if (!client) {
          client = root.google.accounts.oauth2.initTokenClient({
            client_id: options.clientId,
            scope: SCOPE,
            callback: function (resp) {
              var p = pending; pending = null;
              if (!p) return;
              if (resp && resp.access_token) {
                token = resp.access_token;
                expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
                p.resolve(token);
              } else {
                p.reject(fail('auth', 'Sign-in needed'));
              }
            },
            error_callback: function () {
              var p = pending; pending = null;
              if (p) p.reject(fail('auth', 'Sign-in needed'));
            }
          });
        }
        return client;
      });
    }

    // Get Google's script and the client ready when the app opens. It opens no window. Without network it is tried
    // again on the tap.
    function prepare() {
      return getClient().then(function () { return true; }, function () { return false; });
    }

    // Opens Google's sign-in window. Call it only from a tap. When prepare() has finished, the window opens inside
    // the tap itself, so the phone does not block it.
    // Google does not always answer (a blocked window gives no reply), so the request has a time limit. Only one is open at a time.
    function signIn() {
      return client ? request(client) : getClient().then(request);
    }
    function request(c) {
      return new Promise(function (resolve, reject) {
        if (pending) pending.reject(fail('auth', 'Replaced by a newer sign-in request'));
        var timer = setTimeout(function () {
          if (pending && pending.timer === timer) { pending = null; reject(fail('auth', 'Google did not answer the sign-in request')); }
        }, SIGNIN_WAIT_MS);
        pending = {
          timer: timer,
          resolve: function (t) { clearTimeout(timer); resolve(t); },
          reject: function (e) { clearTimeout(timer); reject(e); }
        };
        c.requestAccessToken({ prompt: '' });
      });
    }

    function isSignedIn() { return !!token && Date.now() < expiresAt - EXPIRY_MARGIN_MS; }
    // The token, while it is good. It never asks Google by itself: without a good token the answer is "sign-in needed".
    function getToken() { return isSignedIn() ? Promise.resolve(token) : Promise.reject(fail('auth', 'Sign-in needed')); }
    // Google refused the token (for example it was taken back): drop it, so nothing keeps trying with it.
    function forget() { token = null; expiresAt = 0; }

    return { prepare: prepare, signIn: signIn, getToken: getToken, isSignedIn: isSignedIn, forget: forget };
  }

  root.BABYLOG_GOOGLE_AUTH = { create: create, isConfigured: isConfigured, SCOPE: SCOPE };
})(typeof self !== 'undefined' ? self : this);
