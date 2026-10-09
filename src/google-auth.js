// Google sign-in for the browser (Google Identity Services, "token" model).
// The access token is kept until it expires (about an hour), so a reload or reopening the app within that time does not
// ask again (owner decision 2026-10-05, once the app had its own origin, bee-log.github.io). This file does not touch
// storage itself: the app passes a small "keep" store (sync-ui.js). An expired or refused token is removed.
// Google's window opens ONLY when someone taps "Sign in". On a phone even a "quiet" renewal opens that window, and
// doing it by itself made the app open and close it in a loop. A sign-in lasts about an hour; then the app asks again.
// Google's script is loaded when the app opens (prepare), so a tap opens the window at once. A window opened later,
// after waiting for the script to download, can be blocked by the phone: then the first tap did nothing.
// Sign out works on this phone only: it drops the token here and the next sign-in lets the person choose the account.
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

  // options: { clientId, document, keep }. document is for tests. keep (optional) remembers the sign-in until it expires:
  //   keep.load() -> { token, expiresAt } or { signedOut: true } or null, keep.save(...), keep.remove()
  function create(options) {
    var doc = options.document || root.document;
    var keep = options.keep || null;
    var token = null, expiresAt = 0;
    var saved = keep && keep.load();
    var chooseAccount = !!(saved && saved.signedOut === true);   // after a sign-out the next sign-in shows the account list
    if (saved && typeof saved.token === 'string' && Date.now() < saved.expiresAt - EXPIRY_MARGIN_MS) {
      token = saved.token;
      expiresAt = saved.expiresAt;
    } else if (keep && !chooseAccount) {
      keep.remove();                 // nothing kept, or it has expired
    }
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
                chooseAccount = false;
                if (keep) keep.save({ token: token, expiresAt: expiresAt });
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
        c.requestAccessToken({ prompt: chooseAccount ? 'select_account' : '' });
      });
    }

    function isSignedIn() { return !!token && Date.now() < expiresAt - EXPIRY_MARGIN_MS; }
    // When the sign-in ends (milliseconds), or 0 when not signed in.
    function expiry() { return isSignedIn() ? expiresAt : 0; }
    // The token, while it is good. It never asks Google by itself: without a good token the answer is "sign-in needed".
    function getToken() { return isSignedIn() ? Promise.resolve(token) : Promise.reject(fail('auth', 'Sign-in needed')); }
    // Google refused the token (for example it was taken back): drop it, so nothing keeps trying with it.
    function forget() { token = null; expiresAt = 0; if (keep && !chooseAccount) keep.remove(); }
    // Sign out on this phone: drop the token and remember that the next sign-in must show the account list.
    // The token is not cancelled at Google. Google's cancel removes the app's permission for the whole account, which
    // could also stop the other phone. The unused token runs out by itself within the hour.
    function signOut() { token = null; expiresAt = 0; chooseAccount = true; if (keep) keep.save({ signedOut: true }); }

    return { prepare: prepare, signIn: signIn, signOut: signOut, getToken: getToken, isSignedIn: isSignedIn, expiry: expiry, forget: forget };
  }

  root.BABYLOG_GOOGLE_AUTH = { create: create, isConfigured: isConfigured, SCOPE: SCOPE };
})(typeof self !== 'undefined' ? self : this);
