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

  // ---- Busy: while a form is open, an update waits instead of reloading the page ----
  var busy = 0;
  var reloadWhenIdle = false;
  function setBusy(on) {
    busy = Math.max(0, busy + (on ? 1 : -1));
    if (!busy && reloadWhenIdle) location.reload();
  }

  // ---- Routes: three tabs, and full screens (the Feed screen) without the tab bar ----
  var FEED_UI = self.BABYLOG_FEED_UI;
  var EDIT_UI = self.BABYLOG_EDIT_UI;
  var SLEEP_UI = self.BABYLOG_SLEEP_UI;
  var PROFILE_UI = self.BABYLOG_PROFILE_UI;
  var SYNC_UI = self.BABYLOG_SYNC_UI;
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
      FEED_UI.hide(); EDIT_UI.hide(); SLEEP_UI.hide(); PROFILE_UI.hide(); SYNC_UI.hide();
      if (screen === 'feed') FEED_UI.show();
      else if (screen === 'sleep') SLEEP_UI.show();
      else if (screen === 'profile') PROFILE_UI.show();
      else if (screen === 'sync') SYNC_UI.show();
      else openEdit(nav.argFromHash(location.hash), location.hash);
      window.scrollTo(0, 0);
      return;
    }
    FEED_UI.hide();
    EDIT_UI.hide();
    SLEEP_UI.hide();
    PROFILE_UI.hide();
    SYNC_UI.hide();
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

  // ---- Today: the last feed card, and the list of feeds, nappies and sleeps ----
  var ICONS = self.BABYLOG_ICONS;
  var S = self.BABYLOG_SLEEP;
  var feedRecord = null;   // the newest feed, kept so the "ago" text can count on without reading the database

  function renderLastFeed() {
    var big = document.getElementById('lf-big'), detail = document.getElementById('lf-detail');
    if (!feedRecord) {
      big.textContent = 'No feed yet';
      detail.textContent = 'Tap Feed to log one';
      return;
    }
    big.textContent = R.agoText(Date.now() - feedRecord.t);
    detail.textContent = R.formatClock(feedRecord.t) + ' · ' + R.feedLabel(feedRecord);
  }
  setInterval(function () { if (!document.getElementById('view-today').hidden) renderLastFeed(); }, 30000);

  function rowElement(row) {
    var li = document.createElement('li');
    li.className = 'row';
    var link = document.createElement('a');
    link.className = 'row-link';
    // Feeds and nappies open their editor. Editing a sleep is not designed yet, so a sleep opens the Sleep page.
    link.href = row.kind === 'sleep' ? '#sleep' : '#edit/' + row.ids.map(encodeURIComponent).join('+');
    var time = document.createElement('span');
    time.className = 'row-time';
    time.textContent = R.formatClock(row.t);
    var icon = document.createElement('span');
    icon.className = 'row-icon ' + row.kind;
    icon.innerHTML = ICONS[row.kind];
    var what = document.createElement('span');
    what.className = 'row-what';
    var strong = document.createElement('strong');
    strong.textContent = row.title;
    what.appendChild(strong);
    what.appendChild(document.createTextNode(' · ' + row.label));
    link.appendChild(time); link.appendChild(icon); link.appendChild(what);
    li.appendChild(link);
    return li;
  }

  function renderToday() {
    return store.all().then(function (records) {
      PROFILE_UI.renderHead(records); // the baby's photo and name at the top
      SLEEP_UI.renderToday(records); // the sleep card above the buttons
      feedRecord = R.latestFeed(records);
      renderLastFeed();
      var w = R.dayWindow(Date.now());
      var rows = R.timelineRows(records.filter(function (r) { return r.t >= w.from && r.t < w.to; }))
        .concat(S.timelineRows(records, w))
        .sort(function (a, b) { return b.t - a.t; });
      var list = document.getElementById('today-list');
      list.textContent = '';
      rows.forEach(function (row) { list.appendChild(rowElement(row)); });
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
    }).then(function () {
      // Show the entry in the list first, then confirm, so the message never runs ahead of the screen.
      return renderToday().then(function () { toast(WORD[type] + ' saved'); });
    }).catch(function (err) {
      console.error('[baby-log] save', err);
      toast('Not saved. Please try again.');
    });
  }

  var quick = document.querySelectorAll('[data-log]');
  for (var q = 0; q < quick.length; q++) {
    quick[q].addEventListener('click', function (e) { log(e.currentTarget.getAttribute('data-log')); });
  }

  // Save changed entries (an edit, or tombstones for a delete) in one step, say so, and go back to Today.
  // `after` are the new versions of the stored entries. Used by the Feed screen and the nappy Edit screen.
  function commitEdit(message, after) {
    return store.putMany(after).then(function () {
      toast(message);
      location.hash = '#today';
    });
  }

  // ---- A short message, for 3.5 seconds. On a full screen it sits at the top, so it never covers a button ----
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(text) {
    clearTimeout(toastTimer);
    document.getElementById('toast-text').textContent = text;
    toastEl.hidden = false;
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3500);
  }

  var shared = { toast: toast, renderToday: renderToday, setBusy: setBusy, commitEdit: commitEdit };
  FEED_UI.init(shared);
  EDIT_UI.init(shared);
  SLEEP_UI.init(shared);
  PROFILE_UI.init(shared);
  SYNC_UI.init(shared);
  route();

  // ---- Offline support ----
  var status = document.getElementById('status');
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'This browser cannot work offline.';
    return;
  }
  // A new version takes over in the background (sw.js skips waiting). Reload once so the page
  // and its scripts come from the same version. Not on the very first visit (no previous controller).
  // While a form is open, wait until the parent is done, so nothing they are typing is lost.
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
