// Sync and export (ADR-001): the sync status, the "Sync and data" screen (#sync), and the work in the background.
// The rules are in sync.js, the Google parts in drive.js and google-auth.js. This file connects them to the screen.
// Until the owner puts a real Google client ID in config.js, sync stays off and the screen says so.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var Sync = root.BABYLOG_SYNC;
  var Auth = root.BABYLOG_GOOGLE_AUTH;
  var Drive = root.BABYLOG_DRIVE;
  var Csv = root.BABYLOG_CSV;
  var store = root.BABYLOG_STORE;
  var SIGNED_IN_KEY = 'syncSignedIn';     // only a yes/no hint that this phone signed in before. The token itself is never stored.
  var PUSH_DELAY_MS = 3000;               // wait a moment after a change, so a burst of changes is sent once
  var PULL_EVERY_MS = 3 * 60 * 1000;

  var ctx = null;
  var cfg = root.BABYLOG_CONFIG;
  var auth = null, engine = null;
  var state = 'off';          // 'off' (not set up), 'signin', 'syncing', 'synced', 'offline', 'error'
  var lastSynced = null;
  var running = false, again = false, timer = null;

  function $(id) { return document.getElementById(id); }

  var LABEL = {
    off: 'Sync is not set up yet', signin: 'Sign in to sync', syncing: 'Syncing…',
    synced: 'Synced', offline: 'Waiting for network', error: 'Could not sync'
  };
  var DETAIL = {
    off: 'Your entries are saved on this phone. Sync will switch on when the shared Google account is ready.',
    signin: 'Sign in with the shared Google account to send and receive entries.',
    syncing: 'Sending and receiving entries.',
    synced: 'Entries from both phones are up to date.',
    offline: 'Your entries are safe on this phone. They will be sent when the network is back.',
    error: 'Your entries are safe on this phone. We will try again soon.'
  };

  function render() {
    $('sync-link').textContent = LABEL[state] + (state === 'synced' && lastSynced ? ' · ' + R.formatClock(lastSynced) : '');
    $('sy-state').textContent = LABEL[state];
    $('sy-detail').textContent = DETAIL[state] + (state === 'synced' && lastSynced ? ' Last synced at ' + R.formatClock(lastSynced) + '.' : '');
    $('sy-signin').hidden = state !== 'signin';
    $('sy-now').hidden = state === 'off' || state === 'signin';
    $('sy-now').disabled = state === 'syncing';
    $('sync-card').setAttribute('data-state', state);
  }

  function setState(next) { state = next; render(); }

  // Send ours, read theirs. A change that arrives while this runs makes it run once more.
  function run() {
    if (!engine) return Promise.resolve();
    if (running) { again = true; return Promise.resolve(); }
    running = true;
    setState('syncing');
    return engine.sync().then(function (result) {
      lastSynced = Date.now();
      setState('synced');
      store.setMeta(SIGNED_IN_KEY, true);
      if (result.merged > 0) ctx.renderToday();      // entries came from the other phone
    }).catch(function (err) {
      console.warn('[baby-log] sync', err);
      setState(err.code === 'auth' ? 'signin' : err.code === 'offline' ? 'offline' : 'error');
    }).then(function () {
      running = false;
      if (again) { again = false; return run(); }
    });
  }

  function signIn() {
    auth.signIn().then(run).catch(function (err) {
      setState(err.code === 'offline' ? 'offline' : 'signin');
      ctx.toast(err.code === 'offline' ? 'No network. Try again when you are online.' : 'Sign-in did not finish. Please try again.');
    });
  }

  function schedulePush() {
    if (!engine || state === 'signin') return;
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

  // ---- Screen ----
  function show() { $('screen-sync').hidden = false; }
  function hide() { $('screen-sync').hidden = true; }

  function init(context) {
    ctx = context;
    $('sy-signin').addEventListener('click', signIn);
    $('sy-now').addEventListener('click', run);
    $('sy-csv').addEventListener('click', function () { exportAs('csv'); });
    $('sy-jsonl').addEventListener('click', function () { exportAs('jsonl'); });
    if (!Auth.isConfigured(cfg.googleClientId)) { setState('off'); return; }

    auth = Auth.create({ clientId: cfg.googleClientId });
    var backend = Drive.create({ getToken: auth.getToken, fetch: root.fetch.bind(root) });
    store.deviceId().then(function (deviceId) {
      engine = Sync.create({ backend: backend, store: store, root: cfg.driveFolder, deviceId: deviceId });
      return store.getMeta(SIGNED_IN_KEY);
    }).then(function (signedBefore) {
      if (signedBefore) run(); else setState('signin');   // signed in before: renew quietly now. Otherwise ask.
    });
    store.onChange(schedulePush);
    root.addEventListener('online', run);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && state !== 'signin') run(); });
    setInterval(function () { if (!document.hidden && state !== 'signin') run(); }, PULL_EVERY_MS);
  }

  root.BABYLOG_SYNC_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
