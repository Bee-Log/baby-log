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

  // ---- Routes: three tabs, and full screens (the Feed screen) without the tab bar ----
  var FEED_UI = self.BABYLOG_FEED_UI;
  var EDIT_UI = self.BABYLOG_EDIT_UI;
  // #edit/<ids>: a feed is edited on the Feed screen, a nappy on its own small Edit screen.
  function openEdit(arg, hashAtStart) {
    FEED_UI.hide();
    EDIT_UI.hide();
    var first = String(arg).split('+')[0];
    try { first = decodeURIComponent(first); } catch (err) { /* a broken link just finds nothing */ }
    store.getRecord(first).then(function (rec) {
      if (location.hash !== hashAtStart) return; // the parent already moved on
      if (rec && rec.type === 'feed') FEED_UI.show({ editId: rec.id });
      else EDIT_UI.show(arg);
    }).catch(function (err) {
      console.error('[baby-log] edit lookup', err);
      toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function route() {
    var screen = nav.screenFromHash(location.hash);
    document.body.classList.toggle('on-screen', !!screen);
    if (screen) {
      var hidden = document.querySelectorAll('.view');
      for (var h = 0; h < hidden.length; h++) hidden[h].hidden = true;
      if (screen === 'feed') { EDIT_UI.hide(); FEED_UI.show(); }
      else openEdit(nav.argFromHash(location.hash), location.hash);
      window.scrollTo(0, 0);
      return;
    }
    FEED_UI.hide();
    EDIT_UI.hide();
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
  window.addEventListener('hashchange', route);

  // ---- Today: nappies (005) and feeds (006, 007) ----
  var ICONS = {
    nappy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"></path></svg>',
    feed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2h6"></path><path d="M10 2v3L8 8v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-3V2"></path></svg>'
  };
  var NAMES = { nappy: 'Nappy', feed: 'Feed' };

  function renderToday() {
    return store.all().then(function (records) {
      var w = R.dayWindow(Date.now());
      var rows = R.timelineRows(records.filter(function (r) { return r.t >= w.from && r.t < w.to; }));
      var list = document.getElementById('today-list');
      list.textContent = '';
      rows.forEach(function (row) {
        var li = document.createElement('li');
        li.className = 'row';
        var link = document.createElement('a');
        link.className = 'row-link';
        link.href = '#edit/' + row.ids.map(encodeURIComponent).join('+');
        var time = document.createElement('span');
        time.className = 'row-time';
        time.textContent = R.formatClock(row.t);
        var icon = document.createElement('span');
        icon.className = 'row-icon ' + row.kind;
        icon.innerHTML = ICONS[row.kind]; // fixed markup, no user data
        var what = document.createElement('span');
        what.className = 'row-what';
        var strong = document.createElement('strong');
        strong.textContent = NAMES[row.kind];
        what.appendChild(strong);
        what.appendChild(document.createTextNode(' · ' + row.label));
        link.appendChild(time); link.appendChild(icon); link.appendChild(what);
        li.appendChild(link);
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

  // Save changed entries and offer Undo for 6 seconds. `before` are the entries as stored and `after` their new
  // versions (same ids): an edit, or tombstones for a delete. Undo writes the earlier values back with an
  // updatedAt newer than what is stored now, so it wins everywhere. Used by the Feed screen and the nappy Edit screen.
  function commitEdit(message, before, after) {
    return store.putMany(after).then(function () {
      toast(message, function () {
        var back = before.map(function (b, i) { return R.restore(b, after[i], Date.now(), after[i].deviceId); });
        return store.putMany(back).then(renderToday).then(function () { return message === 'Deleted' ? 'Restored' : 'Change undone'; });
      });
      location.hash = '#today';
    });
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
    undo().then(function (message) { toast(typeof message === 'string' ? message : 'Removed'); }, function (err) {
      console.error('[baby-log] undo', err);
      toast('Could not undo. Please try again.');
    }).then(function () { setBusy(false); });
  });

  var shared = { toast: toast, renderToday: renderToday, setBusy: setBusy, commitEdit: commitEdit };
  FEED_UI.init(shared);
  EDIT_UI.init(shared);
  route();

  // ---- Offline support ----
  var status = document.getElementById('status');
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'This browser cannot work offline.';
    return;
  }
  // A new version takes over in the background (sw.js skips waiting). Reload once so the page
  // and its scripts come from the same version. Not on the very first visit (no previous controller).
  // While an Undo is still possible, or a bottle form is open, wait until that is done, so nothing the parent is doing is lost.
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
