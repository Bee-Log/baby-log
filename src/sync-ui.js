// Sync and export (ADR-001): the sync status, the "Sync and data" screen (#sync), and the work in the background.
// The rules are in sync.js, the Google parts in drive.js and google-auth.js. This file connects them to the screen.
// Until the owner puts a real Google client ID in config.js, sync stays off and the screen says so.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var Sync = root.BABYLOG_SYNC;
  var Auth = root.BABYLOG_GOOGLE_AUTH;
  var Drive = root.BABYLOG_DRIVE;
  var Csv = root.BABYLOG_CSV;
  var Sc = root.BABYLOG_SCHEMA;
  var store = root.BABYLOG_STORE;
  var PUSH_DELAY_MS = 3000;               // wait a moment after a change, so a burst of changes is sent once
  var PULL_EVERY_MS = 3 * 60 * 1000;
  var SYNC_TIMEOUT_MS = 60000;            // a sync that has not finished in a minute is treated as failed, so it can be tried again

  var ctx = null;
  var cfg = root.BABYLOG_CONFIG;
  var auth = null, engine = null;
  var state = 'off';          // 'off' (not set up), 'signin', 'syncing', 'synced', 'offline', 'error'
  var lastSynced = null;
  var running = false, again = false, timer = null;
  var epoch = 0;              // goes up at every sign-out, so a sync that was already running does not undo it
  var lastError = '';         // the technical reason of the last failure, shown on the screen so it can be reported
  var SIGNIN_KEY = cfg.storagePrefix + 'baby-log-google-signin';
  var listeners = [];         // told about every change of state (the Babies screen shows it)

  function $(id) { return document.getElementById(id); }

  var LABEL = {
    off: 'Sync is not set up yet', signin: 'Sign in to sync', syncing: 'Syncing…',
    synced: 'Synced', offline: 'Waiting for network', error: 'Could not sync'
  };
  var DETAIL = {
    off: 'Your entries are saved on this phone. Sync will switch on when the shared Google account is ready.',
    signin: 'Tap Sign in to send and receive entries. Your entries are safe on this phone. Google asks again about once an hour.',
    syncing: 'Sending and receiving entries.',
    synced: 'Entries from both phones are up to date.',
    offline: 'Your entries are safe on this phone. They will be sent when the network is back.',
    error: 'Your entries are safe on this phone. We will try again soon.'
  };

  function render() {
    var until = auth ? auth.expiry() : 0;     // when Google's sign-in ends, while this phone is signed in
    $('sync-link').textContent = LABEL[state] + (state === 'synced' && lastSynced ? ' · ' + R.formatClock(lastSynced) : '');
    $('sy-state').textContent = LABEL[state];
    $('sy-detail').textContent = DETAIL[state] + (state === 'synced' && lastSynced ? ' Last synced at ' + R.formatClock(lastSynced) + '.' : '') +
      (until ? ' This phone stays signed in until ' + R.formatClock(until) + '.' : '');
    $('sy-signin').hidden = state !== 'signin';
    $('sy-signout').hidden = !until;
    $('sy-now').hidden = state === 'off' || state === 'signin';
    $('sy-now').disabled = state === 'syncing';
    $('sy-error').hidden = !lastError || state === 'synced';
    $('sy-error').textContent = lastError ? 'Details: ' + lastError : '';
    $('sync-card').setAttribute('data-state', state);
  }

  // Remembers the Google sign-in on this phone until it expires (google-auth.js), so a reload does not ask again.
  // The app has its own origin (bee-log.github.io), so other websites cannot read it. Storage may be blocked (private mode):
  // then the sign-in simply lasts until the app closes.
  var keep = {
    load: function () { try { return JSON.parse(root.localStorage.getItem(SIGNIN_KEY) || 'null'); } catch (err) { return null; } },
    save: function (v) { try { root.localStorage.setItem(SIGNIN_KEY, JSON.stringify(v)); } catch (err) { /* kept in memory only */ } },
    remove: function () { try { root.localStorage.removeItem(SIGNIN_KEY); } catch (err) { /* nothing to clear */ } }
  };

  function setState(next) {
    state = next;
    render();
    listeners.forEach(function (fn) { fn(state); });
  }
  function onState(fn) { listeners.push(fn); }
  function status() { return { state: state, label: LABEL[state] }; }

  // Sync runs only while the sign-in is good. It never opens Google's window by itself.
  function canRun() { return !!engine && auth.isSignedIn(); }

  // Send ours, read theirs. A change that arrives while this runs makes it run once more.
  function run() {
    if (!engine) return Promise.resolve();
    if (!auth.isSignedIn()) { setState('signin'); return Promise.resolve(); }
    if (running) { again = true; return Promise.resolve(); }
    running = true;
    var myEpoch = epoch;
    lastError = '';
    setState('syncing');
    var limit = new Promise(function (resolve, reject) {
      setTimeout(function () { reject(Object.assign(new Error('Sync took longer than a minute'), { code: 'timeout' })); }, SYNC_TIMEOUT_MS);
    });
    return Promise.race([engine.sync(), limit]).then(function (result) {
      if (result.merged > 0) ctx.dataChanged();      // entries came from the other phone
      if (myEpoch !== epoch) return;                 // signed out while this ran: the screen already says so
      lastSynced = Date.now();
      setState('synced');
    }).catch(function (err) {
      if (myEpoch !== epoch) return;
      console.warn('[baby-log] sync', err);
      if (err.code === 'auth') { auth.forget(); again = false; }
      lastError = (err.code ? err.code + ': ' : '') + (err.message || String(err));
      setState(err.code === 'auth' ? 'signin' : err.code === 'offline' ? 'offline' : 'error');
    }).then(function () {
      running = false;
      if (again && canRun()) { again = false; return run(); }
      again = false;
    });
  }

  function signIn() {
    auth.signIn().then(run).catch(function (err) {
      lastError = (err.code ? err.code + ': ' : '') + (err.message || String(err));
      setState(err.code === 'offline' ? 'offline' : 'signin');
      ctx.toast(err.code === 'offline' ? 'No network. Try again when you are online.' : 'Sign-in did not finish. Please try again.');
    });
  }

  // Sign out on this phone only. The entries stay here, and the other phone stays signed in.
  function signOut() {
    auth.signOut();
    epoch++;
    clearTimeout(timer);
    again = false;
    lastError = '';
    setState('signin');
    ctx.toast('Signed out on this phone. Your entries are still here.');
  }

  // Something changed on this phone: send it soon, if signed in.
  function schedulePush() {
    if (!canRun()) return;
    clearTimeout(timer);
    timer = setTimeout(run, PUSH_DELAY_MS);
  }

  // ---- Export ----
  function download(filename, type, text) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function exportAs(kind) {
    store.all().then(function (records) {
      if (kind === 'csv') download('baby-log-' + stamp() + '.csv', 'text/csv', Csv.toCsv(records));
      else download('baby-log-' + stamp() + '.jsonl', 'application/x-ndjson', Sync.toJsonl(records));
    }).catch(function (err) {
      console.error('[baby-log] export', err);
      ctx.toast('Could not export. Please try again.');
    });
  }

  // Entries this app cannot show are kept and synced, but the parent should know they are there.
  function renderUnreadable() {
    store.all().then(function (records) {
      var n = Sc.unreadable(records), parts = [];
      if (n.newer) parts.push(n.newer + (n.newer === 1 ? ' entry comes' : ' entries come') + ' from a newer version of the app. Close the app and open it again to update.');
      if (n.invalid) parts.push(n.invalid + (n.invalid === 1 ? ' entry' : ' entries') + ' could not be read.');
      $('sy-unreadable').hidden = !parts.length;
      $('sy-unreadable').textContent = parts.length ? parts.join(' ') + ' They are kept safe and are not shown.' : '';
    }).catch(function (err) { console.error('[baby-log] check entries', err); });
  }

  // ---- Screen ----
  function show() { $('screen-sync').hidden = false; renderUnreadable(); }
  function hide() { $('screen-sync').hidden = true; }

  function init(context) {
    ctx = context;
    $('sy-signin').addEventListener('click', signIn);
    $('sy-signout').addEventListener('click', function () { if (auth) signOut(); });
    $('sy-now').addEventListener('click', run);
    $('sy-csv').addEventListener('click', function () { exportAs('csv'); });
    $('sy-jsonl').addEventListener('click', function () { exportAs('jsonl'); });
    if (!Auth.isConfigured(cfg.googleClientId)) { setState('off'); return; }

    auth = Auth.create({ clientId: cfg.googleClientId, keep: keep });
    auth.prepare();                 // load Google's script now, so the Sign in tap opens Google's window at once
    var backend = Drive.create({ getToken: auth.getToken, fetch: root.fetch.bind(root) });
    store.deviceId().then(function (deviceId) {
      engine = Sync.create({ backend: backend, store: store, root: cfg.driveFolder, deviceId: deviceId });
      if (auth.isSignedIn()) run();  // still signed in from earlier this hour
      else setState('signin');
    });
    store.onChange(schedulePush);
    // Coming back to the app, the network coming back, and every few minutes: sync if signed in, else just say so.
    function tick() {
      if (document.hidden || !engine) return;
      if (canRun()) run();
      else if (state !== 'signin' && state !== 'syncing') setState('signin');
    }
    root.addEventListener('online', tick);
    document.addEventListener('visibilitychange', tick);
    setInterval(tick, PULL_EVERY_MS);
  }

  root.BABYLOG_SYNC_UI = { init: init, show: show, hide: hide, signIn: signIn, signOut: signOut, onState: onState, status: status };
})(typeof self !== 'undefined' ? self : this);
