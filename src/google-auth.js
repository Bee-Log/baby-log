// Google sign-in for the browser (Google Identity Services, "token" model).
// The access token is kept in MEMORY ONLY: never in localStorage or IndexedDB. TEST, LIVE and every other page on
// oudam-meas.github.io share one browser origin, so a stored token could be read by them (ADR-001 note, app-rules "Shared origin").
// The cost is a quiet sign-in each time the app opens. Only the public client ID is used. There is no client secret.
(function (root) {
  var SCRIPT = 'https://accounts.google.com/gsi/client';
  var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var EXPIRY_MARGIN_MS = 60000;
  var SILENT_WAIT_MS = 15000;       // a quiet renewal that Google does not answer in this time counts as "sign-in needed"
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
    var client = null, pending = null;

    function loadScript() {
      if (root.google && root.google.accounts && root.google.accounts.oauth2) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        var tag = doc.createElement('script');
        tag.src = SCRIPT;
        tag.async = true;
        tag.onload = function () { resolve(); };
        tag.onerror = function () { reject(fail('offline', 'Could not load Google sign-in')); };
        doc.head.appendChild(tag);
      });
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

    // prompt '' may show Google's sign-in window (call it from a tap). prompt 'none' never shows one: it only renews quietly.
    // Google does not always answer (a blocked window gives no reply), so every request has a time limit. Only one is open at a time.
    function request(prompt) {
      return getClient().then(function (c) {
        return new Promise(function (resolve, reject) {
          if (pending) pending.reject(fail('auth', 'Replaced by a newer sign-in request'));
          var timer = setTimeout(function () {
            if (pending && pending.timer === timer) { pending = null; reject(fail('auth', 'Google did not answer the sign-in request')); }
          }, prompt === 'none' ? SILENT_WAIT_MS : SIGNIN_WAIT_MS);
          pending = {
            timer: timer,
            resolve: function (t) { clearTimeout(timer); resolve(t); },
            reject: function (e) { clearTimeout(timer); reject(e); }
          };
          c.requestAccessToken({ prompt: prompt });
        });
      });
    }

    function signIn() { return request(''); }
    function isSignedIn() { return !!token && Date.now() < expiresAt - EXPIRY_MARGIN_MS; }
    // A good token, renewed quietly when it has run out. If that fails, the person has to tap "Sign in".
    function getToken() { return isSignedIn() ? Promise.resolve(token) : request('none'); }

    return { signIn: signIn, getToken: getToken, isSignedIn: isSignedIn };
  }

  root.BABYLOG_GOOGLE_AUTH = { create: create, isConfigured: isConfigured, SCOPE: SCOPE };
})(typeof self !== 'undefined' ? self : this);
