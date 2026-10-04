// The Feed screen (features 006 and 007): a breast timer and a bottle amount, saved as feed records.
// Opened with #feed. The same screen is used to EDIT a saved feed (feature 011): it opens with the entry's values,
// the same Breast / Bottle switch and the same controls, so logging and editing look and work alike.
// The page markup is in index.html; app.js calls init() once, then show() and hide().
(function (root) {
  var F = root.BABYLOG_FEED;
  var R = root.BABYLOG_RECORDS;
  var store = root.BABYLOG_STORE;
  var BABY = root.BABYLOG_BABY;   // a running timer lives in the phone's meta store (one per baby), so it survives closing the app

  var ctx = null;               // { toast, renderToday, setBusy, commitEdit } from app.js
  var editing = null;           // the saved feed being edited, or null when logging a new one
  var timer = null;             // breast timer state (feed.js), or null
  var manual = false;           // logging a breast feed by typing the minutes instead of using the timer
  var form = { mode: 'breast', ml: F.DEFAULT_ML, milk: 'Formula', fedAt: '', note: '', left: 10, right: 0, minTouched: false, splitGuessed: false, fallbackSide: 'Left' };
  var lastText = { breast: '', bottle: '' };   // "Last bottle: 90 ml · 11:50 am", shown under the switch when logging
  var MAX_MIN = 300;
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

  // The note is one value for the feed, shown in both forms, so switching kind never loses it.
  function setNote(text) {
    form.note = text;
    $('breast-note').value = text;
    $('bottle-note').value = text;
  }

  function renderLast() {
    $('last-line').textContent = form.mode === 'breast' ? lastText.breast : lastText.bottle;
  }

  // Delete asks for a second tap, because there is no Undo. The button turns red and says so, then relaxes.
  var armTimer = null;
  function armDelete(button, label, doDelete) {
    if (!button.classList.contains('armed')) {
      button.classList.add('armed');
      button.textContent = 'Tap again to delete';
      armTimer = setTimeout(function () { disarm(button, label); }, 4000);
      return;
    }
    disarm(button, label);
    doDelete();
  }
  function disarm(button, label) {
    clearTimeout(armTimer);
    button.classList.remove('armed');
    button.textContent = label;
  }

  // ---- Breast ----
  // Editing a saved feed: each side row has its own minutes (− / typed / +). The total is their sum, shown at the top.
  function renderBreastEdit() {
    if (document.activeElement !== $('left-min')) $('left-min').value = form.left;
    if (document.activeElement !== $('right-min')) $('right-min').value = form.right;
    $('breast-total').textContent = (form.left + form.right) + ' min';
    $('split-hint').hidden = !(form.splitGuessed && !form.minTouched);
    $('breast-time').value = form.fedAt;
    $('feed-save').textContent = editing ? 'Save changes' : 'Save';
    $('feed-save').disabled = !editing && form.left + form.right === 0;
  }

  // Logging: each side row shows its running time and one button (Start / Pause / Switch).
  function renderBreast() {
    if (editing || manual) { renderBreastEdit(); return; }
    var now = Date.now();
    var t = F.totals(timer, now);
    var running = F.runningSide(timer);
    $('breast-started').textContent = timer ? 'Started ' + R.formatClock(timer.startedAt) : 'Not started yet';
    $('breast-timer').textContent = F.formatTimer(t.total);
    ['Left', 'Right'].forEach(function (side) {
      var key = side.toLowerCase();
      var on = running === side;
      $('row-' + key).classList.toggle('active', on);
      $(key + '-time').textContent = F.formatTimer(t[side]);
      var btn = $('btn-' + key);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? 'Pause' : running ? 'Switch' : 'Start';
    });
    $('feed-save').disabled = !timer;
  }

  function startTick() {
    stopTick();
    // Four times a second, so the display is never more than a quarter of a second behind.
    tick = setInterval(function () { if (form.mode === 'breast' && !editing && !manual) renderBreast(); }, 250);
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

  function tapSide(side) {
    timer = F.tap(timer, side, Date.now());
    applyView();
    renderBreast();
    store.setMeta(BABY.timerKey(), timer).catch(function (err) {
      console.error('[baby-log] timer save', err);
      ctx.toast('The timer could not be saved on this phone.');
    });
  }

  // Edit-form minutes for one side. Typing, − and + all end up here.
  function setSideMin(side, value) {
    var n = clampMin(value);
    if (n == null) return;
    form[side.toLowerCase()] = n;
    form.minTouched = true;
    renderBreastEdit();
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
    $('feed-save').textContent = editing ? 'Save changes' : 'Save · ' + form.ml + ' ml';
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
    holdBusy(mode === 'bottle' || !!editing || manual);
    var breast = mode === 'breast';
    $('panel-breast').hidden = !breast;
    $('panel-bottle').hidden = breast;
    $('mode-breast').setAttribute('aria-pressed', breast ? 'true' : 'false');
    $('mode-bottle').setAttribute('aria-pressed', breast ? 'false' : 'true');
    $('feed-save').textContent = editing ? 'Save changes' : breast && !manual ? 'Stop and save' : 'Save';
    renderLast();
    if (breast) renderBreast(); else renderBottle();
  }

  // Logging shows the timer; editing shows typed minutes, the started time and a Delete button.
  function applyVariant() {
    var e = !!editing;
    applyView();
    $('feed-delete').hidden = !e;
    disarm($('feed-delete'), 'Delete this entry');
    $('h-feed').textContent = e ? 'Edit feed' : 'Feed';
    $('bottle-time').step = e ? '60' : '300';
    $('breast-time').step = '60';
    $('last-line').hidden = e;
  }

  // Typed minutes (editing, or logging by hand) or the timer.
  function applyView() {
    var e = !!editing || manual;
    var logOnly = document.querySelectorAll('.only-log'), editOnly = document.querySelectorAll('.only-edit');
    for (var i = 0; i < logOnly.length; i++) logOnly[i].hidden = e;
    for (var j = 0; j < editOnly.length; j++) editOnly[j].hidden = !e;
    $('split-hint').hidden = true; // shown by renderBreastEdit when it applies
    $('row-left').classList.remove('active');
    $('row-right').classList.remove('active');
    $('row-started').hidden = !e;
    var toggle = $('breast-manual');
    toggle.hidden = !!editing || (!manual && !!timer);   // not while a timer is running
    toggle.textContent = manual ? 'Use the timer instead' : 'Enter time manually';
    toggle.setAttribute('aria-pressed', manual ? 'true' : 'false');
  }

  function setManual(on) {
    if (editing || on === manual || (on && timer)) return;
    manual = on;
    if (on) {
      form.left = 10; form.right = 0; form.minTouched = false;
      form.fedAt = F.inputTime(Date.now() - 10 * 60000);   // it started 10 minutes ago, like the minutes
    }
    applyView();
    setMode('breast');
  }

  // ---- Save ----
  function saveEdit() {
    var now = Date.now();
    var t = R.timeInDay(editing.t, form.fedAt);
    if (t == null) { ctx.toast('Please check the time.'); return; }
    if (t > now + 5 * 60000) { ctx.toast('That time has not happened yet.'); return; }
    var breast = form.mode === 'breast';
    var sameKind = (editing.d || {}).kind === (breast ? 'Breast' : 'Bottle');
    var base = sameKind ? editing.d : {};            // switching Breast <-> Bottle starts the details afresh
    var changes = { t: t, note: form.note.trim() };
    if (breast) {
      // Read what is typed right now, so a tap on Save straight after typing cannot miss it.
      var typedLeft = clampMin($('left-min').value), typedRight = clampMin($('right-min').value);
      if (typedLeft != null && typedLeft !== form.left) { form.left = typedLeft; form.minTouched = true; }
      if (typedRight != null && typedRight !== form.right) { form.right = typedRight; form.minTouched = true; }
      // An old entry (only a total) is left as it is unless the minutes were touched; a new breast form always saves them.
      if (form.minTouched || !sameKind) changes.d = R.withFields(base, F.breastDetails(form.left, form.right, form.fallbackSide), { kind: 'Breast' });
      else changes.d = R.withFields(base, { kind: 'Breast' });
    } else {
      var ml = F.clampMl($('bottle-ml').value);
      if (ml != null) form.ml = ml;
      changes.d = R.withFields(base, { kind: 'Bottle', milk: form.milk, ml: form.ml });
    }
    saving = true;
    store.deviceId().then(function (deviceId) {
      var next = R.revise(editing, changes, now, deviceId);
      if (R.sameContent(next, editing)) { saving = false; holdBusy(false); location.hash = '#today'; return; } // nothing changed
      return ctx.commitEdit('Changes saved', [next]).then(function () { saving = false; holdBusy(false); });
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] feed edit save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function deleteEntry() {
    if (saving || !editing) return;
    saving = true;
    store.deviceId().then(function (deviceId) {
      return ctx.commitEdit('Deleted', [R.tombstone(editing, Date.now(), deviceId)]);
    }).then(function () { saving = false; holdBusy(false); }, function (err) {
      saving = false;
      console.error('[baby-log] feed delete', err);
      ctx.toast('Not deleted. Please try again.');
    });
  }

  function clampMin(v) {
    var n = Math.round(Number(v));
    return isFinite(n) ? Math.max(0, Math.min(MAX_MIN, n)) : null;
  }

  // A breast feed typed by hand: minutes per side and the time it started.
  function saveManual() {
    var now = Date.now();
    var l = clampMin($('left-min').value), r = clampMin($('right-min').value);
    if (l != null) form.left = l;
    if (r != null) form.right = r;
    if (form.left + form.right === 0) { ctx.toast('Please enter the minutes.'); return; }
    var t = F.timeOnOrBefore(now, form.fedAt);
    if (t == null) { ctx.toast('Please check the time.'); return; }
    saving = true;
    store.deviceId().then(function (deviceId) {
      var d = R.withFields({}, F.breastDetails(form.left, form.right, 'Left'), { kind: 'Breast' });
      return store.put(R.makeRecord({ id: crypto.randomUUID(), type: 'feed', babyId: BABY.id(), t: t, now: now, deviceId: deviceId, d: d, note: form.note.trim() }));
    }).then(function () {
      saving = false;
      ctx.toast('Feed saved');
      holdBusy(false);
      location.hash = '#today';
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] manual feed save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function save() {
    if (editing) { if (!saving) saveEdit(); return; }
    if (manual && form.mode === 'breast') { if (!saving) saveManual(); return; }
    if (saving) return;
    saving = true;
    var now = Date.now();
    var work;
    if (form.mode === 'breast') {
      var f = F.breastFields(F.stop(timer, now), now);
      if (!f) { saving = false; return; }
      work = { t: f.t, d: f.d, note: form.note.trim() };
    } else {
      var t = F.timeOnOrBefore(now, form.fedAt);
      if (t == null) { saving = false; ctx.toast('Please check the time.'); return; }
      work = { t: t, d: { kind: 'Bottle', milk: form.milk, ml: form.ml }, note: form.note.trim() };
    }
    var wasBreast = form.mode === 'breast';
    store.deviceId().then(function (deviceId) {
      var rec = R.makeRecord({ id: crypto.randomUUID(), type: 'feed', babyId: BABY.id(), t: work.t, now: now, deviceId: deviceId, d: work.d, note: work.note });
      // A breast feed and its draft timer are saved together, in one step.
      return wasBreast ? store.putClearingMeta(rec, BABY.timerKey()) : store.put(rec);
    }).then(function (rec) {
      timer = null;
      saving = false;
      ctx.toast('Feed saved');
      holdBusy(false);
      location.hash = '#today'; // the Today screen draws the new entry
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] feed save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  // ---- Show / hide ----
  // show(): a fresh form with the last bottle's amount and milk, the current time, and a running timer if there is one.
  // show({ editId }): the same form, filled with that saved feed.
  function show(opts) {
    var editId = opts && opts.editId;
    var screen = document.getElementById('screen-feed');
    screen.hidden = false;
    screen.removeAttribute('data-ready');
    $('feed-save').disabled = true; // until the saved data has loaded
    setNote('');
    var loading = [store.getMeta(BABY.timerKey()), BABY.records()];
    if (editId) loading.push(store.getRecord(editId));
    Promise.all(loading).then(function (r) {
      if (screen.hidden) return; // the parent already left this screen
      var records = r[1];
      var saved = editId ? r[2] : null;
      if (editId && (!saved || saved.deleted || saved.type !== 'feed')) {
        ctx.toast('That entry is not there any more.');
        location.hash = '#today';
        return;
      }
      editing = saved;
      manual = false;
      timer = editing ? null : r[0];
      var lastBottle = R.lastFeed(records, 'Bottle');
      var lastBreast = R.lastFeed(records, 'Breast');
      var bottle = lastBottle ? lastBottle.d || {} : {};   // records from another phone may lack details
      var breast = lastBreast ? lastBreast.d || {} : {};
      form.ml = bottle.ml != null && F.clampMl(bottle.ml) != null ? F.clampMl(bottle.ml) : F.DEFAULT_ML;
      form.milk = F.MILK.indexOf(bottle.milk) > -1 ? bottle.milk : 'Formula';
      form.fedAt = F.inputTime(Date.now());
      form.left = 10; form.right = 0;                  // for a new breast form, and for a bottle switched to breast
      form.minTouched = false; form.splitGuessed = false; form.fallbackSide = 'Left';
      lastText.breast = lastBreast ? 'Last breast feed: ' + (breast.side || 'Breast') + ' · ' + R.formatClock(lastBreast.t) : 'No breast feed yet';
      lastText.bottle = lastBottle ? 'Last bottle: ' + (bottle.ml != null ? bottle.ml + ' ml · ' : '') + R.formatClock(lastBottle.t) : 'No bottle yet';
      var mode;
      if (editing) {
        // Open with this feed's own values. The other kind keeps the defaults above, in case the parent switches.
        var d = editing.d || {};
        form.fedAt = R.hhmm(editing.t);
        setNote(editing.note || '');
        if (d.kind === 'Bottle') {
          if (d.ml != null && F.clampMl(d.ml) != null) form.ml = F.clampMl(d.ml);
          if (F.MILK.indexOf(d.milk) > -1) form.milk = d.milk;
          mode = 'bottle';
        } else {
          var split = F.splitFromDetails(d);
          form.left = split.left; form.right = split.right; form.splitGuessed = split.guessed;
          form.fallbackSide = d.side;
          mode = 'breast';
        }
      } else {
        // A running timer means a breast feed is under way. Otherwise repeat the kind of the last feed.
        var newest = records.filter(function (x) { return !x.deleted && x.type === 'feed'; })
          .sort(function (a, b) { return b.t - a.t; })[0];
        mode = timer || !newest || (newest.d || {}).kind !== 'Bottle' ? 'breast' : 'bottle';
      }
      applyVariant();
      setMode(mode);
      if (!editing) startTick();
      screen.setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] feed open', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function hide() {
    stopTick();
    holdBusy(false);
    editing = null;
    manual = false;
    document.getElementById('screen-feed').hidden = true;
    document.getElementById('screen-feed').removeAttribute('data-ready');
  }

  function init(context) {
    ctx = context;
    $('mode-breast').addEventListener('click', function () { setMode('breast'); });
    $('mode-bottle').addEventListener('click', function () { setMode('bottle'); });
    $('breast-manual').addEventListener('click', function () { setManual(!manual); });
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
    ['Left', 'Right'].forEach(function (side) {
      var key = side.toLowerCase();
      $(key + '-min').addEventListener('change', function (e) { setSideMin(side, e.target.value); });
      $(key + '-minus').addEventListener('click', function () { setSideMin(side, form[key] - 1); });
      $(key + '-plus').addEventListener('click', function () { setSideMin(side, form[key] + 1); });
    });
    $('breast-time').addEventListener('change', function (e) { if (e.target.value) { form.fedAt = e.target.value; renderBreastEdit(); } });
    $('breast-time').addEventListener('click', function (e) {
      if (typeof e.currentTarget.showPicker === 'function') { try { e.currentTarget.showPicker(); } catch (err) { /* already open or not allowed */ } }
    });
    $('feed-save').addEventListener('click', save);
    $('breast-note').addEventListener('input', function (e) { setNote(e.target.value); });
    $('bottle-note').addEventListener('input', function (e) { setNote(e.target.value); });
    $('feed-delete').addEventListener('click', function (e) { armDelete(e.currentTarget, 'Delete this entry', deleteEntry); });
  }

  root.BABYLOG_FEED_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
