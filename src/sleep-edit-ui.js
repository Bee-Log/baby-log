// The Edit screen for a sleep (#edit/<id>): change when it began and ended, or delete it.
// Delete is at the top of the screen, and asks for a second tap, because there is no Undo.
// A sleep that is still running has only a start time here (it ends with "Wake up").
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var S = root.BABYLOG_SLEEP;
  var store = root.BABYLOG_STORE;
  var BABY = root.BABYLOG_BABY;
  var ARM_MS = 4000;

  var ctx = null;                 // { toast, setBusy, commitEdit } from app.js
  var rec = null;                 // the sleep being edited
  var records = [];
  var holding = false;
  var saving = false;
  var armTimer = null;

  var MESSAGE = {
    order: 'Woke up must be after fell asleep.',
    long: 'A sleep can be 12 hours at most.',
    future: 'That time has not happened yet.',
    overlap: 'Overlaps a sleep already logged.'
  };

  function $(id) { return document.getElementById(id); }

  // The form is not saved anywhere until "Save changes", so an app update waits (app.js reloads the page).
  function holdBusy(on) {
    if (on === holding) return;
    holding = on;
    ctx.setBusy(on);
  }

  // "2026-10-03T18:50" <-> milliseconds, in local time
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toValue(t) {
    var d = new Date(t);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fromValue(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : null;
  }

  function times() {
    var start = fromValue($('se-from').value);
    var end = rec.end == null ? null : fromValue($('se-to').value);
    return { start: start, end: end };
  }

  // Shows why the sleep cannot be saved, and turns Save off.
  function validate() {
    var t = times(), problem = null;
    if (t.start == null || (rec.end != null && t.end == null)) problem = 'order';
    else if (t.end != null) problem = S.check(records, rec.id, t.start, t.end, Date.now());
    else if (t.start > Date.now() + 5 * 60000) problem = 'future';
    $('se-hint').hidden = !problem;
    $('se-hint').textContent = problem ? MESSAGE[problem] : '';
    $('se-save').disabled = saving || !!problem;
    return !problem;
  }

  function disarm() {
    clearTimeout(armTimer);
    var button = $('se-delete');
    button.classList.remove('armed');
    button.setAttribute('aria-label', 'Delete this sleep');
  }

  function show(id) {
    var screen = $('screen-sleep-edit');
    screen.hidden = false;
    screen.removeAttribute('data-ready');
    $('se-save').disabled = true;
    disarm();
    Promise.all([store.getRecord(id), BABY.records()]).then(function (r) {
      if (screen.hidden) return; // the parent already left this screen
      if (!r[0] || r[0].deleted || r[0].type !== 'sleep') {
        ctx.toast('That entry is not there any more.');
        location.hash = '#today';
        return;
      }
      rec = r[0];
      records = r[1];
      $('se-from').value = toValue(rec.t);
      $('se-to').value = rec.end == null ? '' : toValue(rec.end);
      $('se-to-field').hidden = rec.end == null;
      $('se-running').hidden = rec.end != null;
      holdBusy(true);
      validate();
      screen.setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] sleep edit open', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function hide() {
    disarm();
    holdBusy(false);
    $('screen-sleep-edit').hidden = true;
    $('screen-sleep-edit').removeAttribute('data-ready');
  }

  function save() {
    if (saving || !validate()) return;
    var t = times();
    if (t.start === rec.t && (rec.end == null || t.end === rec.end)) { holdBusy(false); location.hash = '#today'; return; }   // nothing changed
    saving = true;
    var now = Date.now();
    store.deviceId().then(function (deviceId) {
      var changes = { t: t.start };
      if (rec.end != null) changes.end = t.end;
      return ctx.commitEdit('Changes saved', [R.revise(rec, changes, now, deviceId)]);
    }).then(function () { saving = false; holdBusy(false); }, function (err) {
      saving = false;
      validate();
      console.error('[baby-log] sleep edit save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function remove() {
    if (saving) return;
    saving = true;
    var now = Date.now();
    store.deviceId().then(function (deviceId) {
      return ctx.commitEdit('Deleted', [R.tombstone(rec, now, deviceId)]);
    }).then(function () { saving = false; holdBusy(false); }, function (err) {
      saving = false;
      console.error('[baby-log] sleep delete', err);
      ctx.toast('Not deleted. Please try again.');
    });
  }

  function init(context) {
    ctx = context;
    $('se-from').addEventListener('input', validate);
    $('se-to').addEventListener('input', validate);
    $('se-save').addEventListener('click', save);
    $('se-delete').addEventListener('click', function (e) {
      var button = e.currentTarget;
      if (!button.classList.contains('armed')) {
        button.classList.add('armed');
        button.setAttribute('aria-label', 'Tap again to delete this sleep');
        armTimer = setTimeout(disarm, ARM_MS);
        return;
      }
      disarm();
      remove();
    });
  }

  root.BABYLOG_SLEEP_EDIT_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
