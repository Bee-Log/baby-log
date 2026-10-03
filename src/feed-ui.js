// The Feed screen (features 006 and 007): a breast timer and a bottle amount, saved as feed records.
// Opened with #feed. The page markup is in index.html; app.js calls init() once, then show() and hide().
(function (root) {
  var F = root.BABYLOG_FEED;
  var R = root.BABYLOG_RECORDS;
  var store = root.BABYLOG_STORE;
  var TIMER_KEY = 'breastTimer'; // a running timer lives in the phone's meta store, so it survives closing the app

  var ctx = null;               // { toast, renderToday } from app.js
  var timer = null;             // breast timer state (feed.js), or null
  var form = { mode: 'breast', ml: F.DEFAULT_ML, milk: 'Formula', fedAt: '' };
  var tick = null;
  var saving = false;
  var dragging = false;

  function $(id) { return document.getElementById(id); }

  // While a bottle form is open it is not saved anywhere, so an app update must wait (app.js reloads the page).
  // The breast timer is stored on the phone, so it needs no such wait.
  var holdingBusy = false;
  function holdBusy(on) {
    if (on === holdingBusy) return;
    holdingBusy = on;
    ctx.setBusy(on);
  }

  // ---- Breast ----
  function renderBreast() {
    var now = Date.now();
    var t = F.totals(timer, now);
    var running = F.runningSide(timer);
    $('breast-started').textContent = timer ? 'Started ' + R.formatClock(timer.startedAt) : 'Not started yet';
    $('breast-timer').textContent = F.formatTimer(t.total);
    $('breast-sides').textContent = 'Left ' + F.formatTimer(t.Left) + ' · Right ' + F.formatTimer(t.Right);
    ['Left', 'Right'].forEach(function (side) {
      var btn = $('btn-' + side.toLowerCase());
      var on = running === side;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      $('btn-' + side.toLowerCase() + '-sub').textContent = on ? 'Tap to pause' : running ? 'Tap to switch' : 'Tap to start';
    });
    $('feed-save').disabled = !timer;
  }

  function startTick() {
    stopTick();
    // Four times a second, so the display is never more than a quarter of a second behind.
    tick = setInterval(function () { if (form.mode === 'breast') renderBreast(); }, 250);
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

  function tapSide(side) {
    timer = F.tap(timer, side, Date.now());
    renderBreast();
    store.setMeta(TIMER_KEY, timer).catch(function (err) {
      console.error('[baby-log] timer save', err);
      ctx.toast('The timer could not be saved on this phone.');
    });
  }

  // ---- Bottle ----
  function renderBottle() {
    var top = F.yOfMl(form.ml);
    $('bt-milk').setAttribute('y', top.toFixed(1));
    $('bt-milk').setAttribute('height', form.ml > 0 ? (280 - top).toFixed(1) : '0');
    $('bt-edge').setAttribute('y', top.toFixed(1));
    $('bt-line').setAttribute('y1', top.toFixed(1));
    $('bt-line').setAttribute('y2', top.toFixed(1));
    $('bt-handle').setAttribute('transform', 'translate(126 ' + top.toFixed(1) + ')');
    $('bt-svg').setAttribute('aria-label', 'Bottle with ' + form.ml + ' ml. Drag up or down to change.');
    var expressed = form.milk === 'Breast milk';
    $('bt-milk').setAttribute('fill', expressed ? '#fbeee6' : '#f6e7c1');
    $('bt-edge').setAttribute('fill', expressed ? '#e9c9b6' : '#e2c98a');
    if (document.activeElement !== $('bottle-ml')) $('bottle-ml').value = form.ml;
    $('milk-formula').setAttribute('aria-pressed', expressed ? 'false' : 'true');
    $('milk-expressed').setAttribute('aria-pressed', expressed ? 'true' : 'false');
    $('bottle-time').value = form.fedAt;
    $('feed-save').textContent = 'Save · ' + form.ml + ' ml';
    $('feed-save').disabled = false;
  }

  function setMl(v) {
    var ml = F.clampMl(v);
    if (ml == null) return;
    form.ml = ml;
    renderBottle();
  }

  function mlAtPointer(e) {
    var r = $('bt-svg').getBoundingClientRect();
    return F.mlOfY((e.clientY - r.top) * (300 / r.height));
  }

  // ---- Mode ----
  function setMode(mode) {
    form.mode = mode;
    holdBusy(mode === 'bottle');
    var breast = mode === 'breast';
    $('panel-breast').hidden = !breast;
    $('panel-bottle').hidden = breast;
    $('mode-breast').setAttribute('aria-pressed', breast ? 'true' : 'false');
    $('mode-bottle').setAttribute('aria-pressed', breast ? 'false' : 'true');
    $('feed-save').textContent = breast ? 'Stop and save' : 'Save';
    if (breast) renderBreast(); else renderBottle();
  }

  // ---- Save ----
  function save() {
    if (saving) return;
    saving = true;
    var now = Date.now();
    var work;
    if (form.mode === 'breast') {
      var f = F.breastFields(F.stop(timer, now), now);
      if (!f) { saving = false; return; }
      work = { t: f.t, d: f.d, note: $('breast-note').value.trim() };
    } else {
      var t = F.timeOnOrBefore(now, form.fedAt);
      if (t == null) { saving = false; ctx.toast('Please check the time.'); return; }
      work = { t: t, d: { kind: 'Bottle', milk: form.milk, ml: form.ml }, note: '' };
    }
    var wasBreast = form.mode === 'breast';
    store.deviceId().then(function (deviceId) {
      var rec = R.makeRecord({ id: crypto.randomUUID(), type: 'feed', t: work.t, now: now, deviceId: deviceId, d: work.d, note: work.note });
      // A breast feed and its draft timer are saved together, in one step.
      return wasBreast ? store.putClearingMeta(rec, TIMER_KEY) : store.put(rec);
    }).then(function (rec) {
      timer = null;
      saving = false;
      // The message comes first, so an update cannot reload the page between saving and Undo.
      ctx.toast('Feed saved', function () {
        return store.put(R.tombstone(rec, Date.now())).then(ctx.renderToday);
      });
      holdBusy(false);
      location.hash = '#today'; // the Today screen draws the new entry
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] feed save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  // ---- Show / hide ----
  // Opens a fresh form: the last bottle's amount and milk, the current time, and a running timer if there is one.
  function show() {
    var screen = document.getElementById('screen-feed');
    screen.hidden = false;
    screen.removeAttribute('data-ready');
    $('feed-save').disabled = true; // until the saved data has loaded
    $('breast-note').value = '';
    Promise.all([store.getMeta(TIMER_KEY), store.all()]).then(function (r) {
      if (screen.hidden) return; // the parent already left this screen
      timer = r[0];
      var records = r[1];
      var lastBottle = R.lastFeed(records, 'Bottle');
      var lastBreast = R.lastFeed(records, 'Breast');
      var bottle = lastBottle ? lastBottle.d || {} : {};   // records from another phone may lack details
      var breast = lastBreast ? lastBreast.d || {} : {};
      form.ml = bottle.ml != null && F.clampMl(bottle.ml) != null ? F.clampMl(bottle.ml) : F.DEFAULT_ML;
      form.milk = F.MILK.indexOf(bottle.milk) > -1 ? bottle.milk : 'Formula';
      form.fedAt = F.inputTime(Date.now());
      $('breast-last').textContent = lastBreast ? (breast.side || 'Breast') + ' · ' + R.formatClock(lastBreast.t) : 'No breast feed yet';
      $('bottle-last').textContent = lastBottle ? (bottle.ml != null ? bottle.ml + ' ml · ' : '') + R.formatClock(lastBottle.t) : 'No bottle yet';
      // A running timer means a breast feed is under way. Otherwise repeat the kind of the last feed.
      var newest = records.filter(function (x) { return !x.deleted && x.type === 'feed'; })
        .sort(function (a, b) { return b.t - a.t; })[0];
      setMode(timer || !newest || (newest.d || {}).kind !== 'Bottle' ? 'breast' : 'bottle');
      startTick();
      screen.setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] feed open', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function hide() {
    stopTick();
    holdBusy(false);
    document.getElementById('screen-feed').hidden = true;
    document.getElementById('screen-feed').removeAttribute('data-ready');
  }

  function init(context) {
    ctx = context;
    $('mode-breast').addEventListener('click', function () { setMode('breast'); });
    $('mode-bottle').addEventListener('click', function () { setMode('bottle'); });
    $('btn-left').addEventListener('click', function () { tapSide('Left'); });
    $('btn-right').addEventListener('click', function () { tapSide('Right'); });

    var svg = $('bt-svg');
    svg.addEventListener('pointerdown', function (e) {
      if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
      dragging = true;
      setMl(mlAtPointer(e));
    });
    svg.addEventListener('pointermove', function (e) { if (dragging) setMl(mlAtPointer(e)); });
    var end = function () { dragging = false; };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    $('bottle-ml').addEventListener('change', function (e) { setMl(e.target.value); });
    $('bottle-minus').addEventListener('click', function () { setMl(form.ml - F.ML_STEP); });
    $('bottle-plus').addEventListener('click', function () { setMl(form.ml + F.ML_STEP); });
    $('milk-formula').addEventListener('click', function () { form.milk = 'Formula'; renderBottle(); });
    $('milk-expressed').addEventListener('click', function () { form.milk = 'Breast milk'; renderBottle(); });
    $('bottle-time').addEventListener('change', function (e) { if (e.target.value) { form.fedAt = e.target.value; renderBottle(); } });
    $('bottle-time').addEventListener('click', function (e) {
      if (typeof e.currentTarget.showPicker === 'function') { try { e.currentTarget.showPicker(); } catch (err) { /* already open or not allowed */ } }
    });
    $('feed-save').addEventListener('click', save);
  }

  root.BABYLOG_FEED_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
