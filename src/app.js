(function () {
  var cfg = self.BABYLOG_CONFIG;
  var nav = self.BABYLOG_NAV;
  var R = self.BABYLOG_RECORDS;
  var store = self.BABYLOG_STORE;
  var isTest = cfg.env === 'test';

  if (isTest) {
    document.getElementById('test-banner').hidden = false;
    document.body.classList.add('is-test');
  }
  document.getElementById('version').textContent =
    '· ' + (isTest ? 'TEST · ' : '') + 'version ' + cfg.version;

  // ---- Busy: while the parent can still undo, an update waits instead of reloading the page ----
  var busy = 0;
  var reloadWhenIdle = false;
  function setBusy(on) {
    busy = Math.max(0, busy + (on ? 1 : -1));
    if (!busy && reloadWhenIdle) location.reload();
  }

  // ---- Tabs ----
  function showTab() {
    var tab = nav.tabFromHash(location.hash);
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].hidden = views[i].getAttribute('data-tab') !== tab;
    var links = document.querySelectorAll('.tabbar a');
    for (var j = 0; j < links.length; j++) {
      if (links[j].getAttribute('data-tab') === tab) links[j].setAttribute('aria-current', 'page');
      else links[j].removeAttribute('aria-current');
    }
    if (tab === 'today') renderToday();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', showTab);

  // ---- Today: nappies (feature 005) ----
  var DROP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"></path></svg>';

  function renderToday() {
    return store.all().then(function (records) {
      var w = R.dayWindow(Date.now());
      var rows = R.nappyRows(records.filter(function (r) { return r.t >= w.from && r.t < w.to; }));
      var list = document.getElementById('today-list');
      list.textContent = '';
      rows.forEach(function (row) {
        var li = document.createElement('li');
        li.className = 'row';
        var time = document.createElement('span');
        time.className = 'row-time';
        time.textContent = R.formatClock(row.t);
        var icon = document.createElement('span');
        icon.className = 'row-icon nappy';
        icon.innerHTML = DROP; // fixed markup, no user data
        var what = document.createElement('span');
        what.className = 'row-what';
        var strong = document.createElement('strong');
        strong.textContent = 'Nappy';
        what.appendChild(strong);
        what.appendChild(document.createTextNode(' · ' + R.nappyLabel(row)));
        li.appendChild(time); li.appendChild(icon); li.appendChild(what);
        list.appendChild(li);
      });
      document.getElementById('today-empty').hidden = rows.length > 0;
    }).catch(function (err) {
      console.error('[baby-log] read', err);
      toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  var WORD = { pee: 'Wee', poop: 'Poo' };
  function log(type) {
    var now = Date.now();
    store.deviceId().then(function (deviceId) {
      var rec = R.makeRecord({ id: crypto.randomUUID(), type: type, t: now, now: now, deviceId: deviceId });
      return store.put(rec);
    }).then(function (rec) {
      // Show the entry in the list first, then confirm, so the message never runs ahead of the screen.
      return renderToday().then(function () {
        toast(WORD[type] + ' saved', function () {
          return store.put(R.tombstone(rec, Date.now())).then(renderToday);
        });
      });
    }).catch(function (err) {
      console.error('[baby-log] save', err);
      toast('Not saved. Please try again.');
    });
  }

  var quick = document.querySelectorAll('[data-log]');
  for (var q = 0; q < quick.length; q++) {
    quick[q].addEventListener('click', function (e) { log(e.currentTarget.getAttribute('data-log')); });
  }

  // ---- Toast with an optional Undo, for 6 seconds ----
  var toastEl = document.getElementById('toast');
  var toastUndo = document.getElementById('toast-undo');
  var toastTimer = null, undoAction = null;
  function toast(text, undo) {
    hideToast();
    document.getElementById('toast-text').textContent = text;
    undoAction = undo || null;
    toastUndo.hidden = !undo;
    toastEl.hidden = false;
    if (undo) setBusy(true);
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    toastEl.hidden = true;
    if (undoAction) { undoAction = null; setBusy(false); }
  }
  toastUndo.addEventListener('click', function () {
    var undo = undoAction;
    undoAction = null; // keep busy until the undo is saved
    toastEl.hidden = true;
    clearTimeout(toastTimer);
    undo().then(function () { toast('Removed'); }, function (err) {
      console.error('[baby-log] undo', err);
      toast('Could not undo. Please try again.');
    }).then(function () { setBusy(false); });
  });

  showTab();

  // ---- Offline support ----
  var status = document.getElementById('status');
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'This browser cannot work offline.';
    return;
  }
  // A new version takes over in the background (sw.js skips waiting). Reload once so the page
  // and its scripts come from the same version. Not on the very first visit (no previous controller).
  // While an Undo is still possible, wait until it is gone, so nothing the parent is doing is lost.
  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || reloading) return;
    reloading = true;
    if (busy) reloadWhenIdle = true;
    else location.reload();
  });
  // Scope './' keeps the test and live service workers apart (/baby-log/test/ vs /baby-log/).
  // updateViaCache 'none': update checks skip the HTTP cache for sw.js and config.js, so a new version is seen at once.
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(function () {
    return navigator.serviceWorker.ready;
  }).then(function () {
    status.textContent = 'Ready to work offline.';
  }).catch(function (err) {
    status.textContent = 'Offline support failed to start.';
    console.error('[baby-log] service worker', err);
  });
})();
