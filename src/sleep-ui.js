// The sleep card on Today and the Sleep page (feature 003): Start sleep / Wake up, and the logged sleeps.
// The current sleep is a stored record with end: null, so it survives closing the app and the phone restarting.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var S = root.BABYLOG_SLEEP;
  var store = root.BABYLOG_STORE;
  var PS = root.BABYLOG_PASTSLEEP_UI;

  var ctx = null;          // { toast } from app.js
  var records = [];        // the last entries read, shared by both cards
  var pageOpen = false;
  var tick = null;
  var saving = false;

  function $(id) { return document.getElementById(id); }

  // One card. prefix 'tc' is Today, 'pc' is the Sleep page (which says a little more).
  function renderCard(prefix, page) {
    var now = Date.now();
    var current = S.currentSleep(records);
    var wake = S.lastWake(records);
    var asleep = !!current;
    var card = $(prefix + '-card'), sub = $(prefix + '-sub'), big = $(prefix + '-big'), btn = $(prefix + '-btn');
    card.classList.toggle('asleep', asleep);
    btn.setAttribute('aria-pressed', asleep ? 'true' : 'false');
    btn.querySelector('.sleep-btn-label').textContent = asleep ? 'Wake up' : 'Start sleep';
    btn.querySelector('.ico-moon').hidden = asleep;
    btn.querySelector('.ico-sun').hidden = !asleep;
    if (asleep) {
      sub.textContent = page ? 'Fell asleep at ' + R.formatClock(current.t) : 'Asleep since';
      big.textContent = page ? 'Asleep ' + S.formatElapsed(now - current.t) : R.formatClock(current.t);
    } else if (wake != null) {
      sub.textContent = page ? 'Woke up at ' + R.formatClock(wake) : 'Awake since';
      big.textContent = page ? 'Awake ' + S.formatLength(now - wake) : R.formatClock(wake);
    } else {
      sub.textContent = page ? 'No sleep logged yet' : 'Sleep';
      big.textContent = page ? 'Awake' : 'Not logged yet';
    }
  }

  function renderList() {
    var now = Date.now();
    var rows = S.sleepRows(records);
    var list = $('sleep-list');
    list.textContent = '';
    rows.forEach(function (row) {
      var li = document.createElement('li');
      li.className = 'row';
      var line = document.createElement('a');
      line.className = 'sleep-row';
      line.href = '#edit/' + encodeURIComponent(row.id);
      var icon = document.createElement('span');
      icon.className = 'row-icon sleep';
      icon.innerHTML = root.BABYLOG_ICONS.sleep;
      var range = document.createElement('span');
      range.textContent = S.rangeLabel(row, now);
      var length = document.createElement('span');
      length.className = 'row-length';
      length.textContent = S.formatLength(row.ms);
      line.appendChild(icon); line.appendChild(range); line.appendChild(length);
      li.appendChild(line);
      list.appendChild(li);
    });
    $('sleep-empty').hidden = rows.length > 0;
  }

  function renderPage() {
    renderCard('pc', true);
    renderList();
    PS.refresh(records);
  }

  // Today gives its entries here every time it draws, so the card is always current.
  function renderToday(all) {
    records = all;
    renderCard('tc', false);
    if (pageOpen) renderPage();
  }

  // Start or end a sleep. Reads the stored entries again first, so a double tap or a second tab cannot start two sleeps.
  function toggle() {
    if (saving) return;
    saving = true;
    var now = Date.now();
    Promise.all([store.all(), store.deviceId()]).then(function (r) {
      var current = S.currentSleep(r[0]);
      var rec = current ? S.wake(current, now, r[1]) : S.startSleep({ id: crypto.randomUUID(), now: now, deviceId: r[1] });
      return store.put(rec);
    }).then(function () { return store.all(); }).then(function (all) {
      saving = false;
      renderToday(all);
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] sleep', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function show() {
    var screen = $('screen-sleep');
    pageOpen = true;
    screen.hidden = false;
    screen.removeAttribute('data-ready');
    store.all().then(function (all) {
      if (screen.hidden) return; // the parent already left this screen
      records = all;
      PS.show(all);
      renderPage();
      stopTick();
      // The running time and "Awake ..." count on, once a second.
      tick = setInterval(function () { renderCard('pc', true); }, 1000);
      screen.setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] sleep open', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

  function hide() {
    pageOpen = false;
    PS.hide();
    stopTick();
    $('screen-sleep').hidden = true;
    $('screen-sleep').removeAttribute('data-ready');
  }

  function init(context) {
    ctx = context;
    $('tc-btn').addEventListener('click', toggle);
    $('pc-btn').addEventListener('click', toggle);
    PS.init(context, function (all) { records = all; renderToday(all); });
  }

  root.BABYLOG_SLEEP_UI = { init: init, show: show, hide: hide, renderToday: renderToday };
})(typeof self !== 'undefined' ? self : this);
