// The "Add a nappy" screen (#nappy): log a wee, a poo or both for a date and time that a parent chooses.
// The one-tap Wee and Poo buttons on Today still log "now" at once. This screen is the optional way to pick the date and time
// (a nappy that was forgotten, or one from yesterday). The date and time start at now, so Save alone also works.
// Wee and Poo together are two entries with the same time (feature 005).
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var store = root.BABYLOG_STORE;
  var BABY = root.BABYLOG_BABY;

  var ctx = null;                 // { toast, setBusy, commitEdit } from app.js
  var holding = false;
  var saving = false;

  var MESSAGE = {
    none: '',
    date: 'Please check the date and time.',
    future: 'That time has not happened yet.'
  };

  function $(id) { return document.getElementById(id); }

  // The form is not saved anywhere until "Save nappy", so an app update waits (app.js reloads the page).
  function holdBusy(on) {
    if (on === holding) return;
    holding = on;
    ctx.setBusy(on);
  }

  function chosen() {
    var types = [];
    if ($('np-pee').getAttribute('aria-pressed') === 'true') types.push('pee');
    if ($('np-poop').getAttribute('aria-pressed') === 'true') types.push('poop');
    return types;
  }

  // Why it cannot be saved yet: 'none' (nothing chosen), 'date', 'future', or null.
  function problem() {
    var t = R.parseDateTime($('np-when').value);
    if (t == null) return 'date';
    if (R.isFuture(t, Date.now())) return 'future';
    return chosen().length ? null : 'none';
  }

  function validate() {
    var p = problem();
    $('np-hint').hidden = !MESSAGE[p];
    $('np-hint').textContent = MESSAGE[p] || '';
    $('np-save').disabled = saving || !!p;
    return !p;
  }

  function toggle(id) {
    var button = $(id);
    button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    validate();
  }

  function show() {
    var screen = $('screen-nappy');
    screen.hidden = false;
    saving = false;
    $('np-pee').setAttribute('aria-pressed', 'false');
    $('np-poop').setAttribute('aria-pressed', 'false');
    $('np-when').value = R.dateTimeValue(Date.now());
    holdBusy(true);
    validate();
    screen.setAttribute('data-ready', '');
  }

  function hide() {
    holdBusy(false);
    $('screen-nappy').hidden = true;
    $('screen-nappy').removeAttribute('data-ready');
  }

  function save() {
    if (saving || !validate()) return;
    var t = R.parseDateTime($('np-when').value);
    var types = chosen();
    var now = Date.now();
    saving = true;
    $('np-save').disabled = true;
    store.deviceId().then(function (deviceId) {
      var recs = types.map(function (type) {
        return R.makeRecord({ id: crypto.randomUUID(), type: type, babyId: BABY.id(), t: t, now: now, deviceId: deviceId });
      });
      // A nappy on another day is not in the Today list, so the message says where it went.
      var w = R.dayWindow(now), elsewhere = t < w.from || t >= w.to;
      var label = R.nappyLabel({ wee: types.indexOf('pee') > -1, poo: types.indexOf('poop') > -1 });
      return ctx.commitEdit(label + ' saved' + (elsewhere ? ' for ' + R.dateLabel(t) + ', ' + R.formatClock(t) : ''), recs);
    }).then(function () { saving = false; holdBusy(false); }, function (err) {
      saving = false;
      console.error('[baby-log] add nappy', err);
      ctx.toast('Not saved. Please try again.');
      validate();
    });
  }

  function init(context) {
    ctx = context;
    $('np-pee').addEventListener('click', function () { toggle('np-pee'); });
    $('np-poop').addEventListener('click', function () { toggle('np-poop'); });
    $('np-when').addEventListener('input', validate);
    $('np-when').addEventListener('change', validate);
    $('np-when').addEventListener('click', function (e) {
      if (typeof e.currentTarget.showPicker === 'function') { try { e.currentTarget.showPicker(); } catch (err) { /* already open or not allowed */ } }
    });
    $('np-save').addEventListener('click', save);
  }

  root.BABYLOG_NAPPY_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
