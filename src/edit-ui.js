// The Edit screen for a nappy (feature 011): change the time, or delete it.
// Opened with #edit/<ids> (ids joined with +, because "Wee + Poo" is two entries).
// Feeds are edited on the Feed screen itself (feed-ui.js), so logging and editing a feed look alike.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var store = root.BABYLOG_STORE;

  var ctx = null;                 // { toast, renderToday, setBusy, commitEdit } from app.js
  var recs = [];                  // the entries being edited, oldest first
  var holding = false;
  var saving = false;

  function $(id) { return document.getElementById(id); }

  // The form is not saved anywhere until "Save changes", so an app update waits (app.js reloads the page).
  function holdBusy(on) {
    if (on === holding) return;
    holding = on;
    ctx.setBusy(on);
  }

  function show(arg) {
    var screen = $('screen-edit');
    screen.hidden = false;
    screen.removeAttribute('data-ready');
    $('edit-save').disabled = true;
    $('edit-delete').disabled = true;
    var ids = String(arg).split('+').filter(Boolean).map(function (id) {
      try { return decodeURIComponent(id); } catch (err) { return id; } // a broken link just finds nothing
    });
    Promise.all(ids.map(function (id) { return store.getRecord(id); })).then(function (found) {
      if (screen.hidden) return; // the parent already left this screen
      var live = found.filter(function (r) { return r && !r.deleted && (r.type === 'pee' || r.type === 'poop'); });
      if (!ids.length || live.length !== ids.length) {
        ctx.toast('That entry is not there any more.');
        location.hash = '#today';
        return;
      }
      recs = live.sort(function (a, b) { return a.t - b.t; });
      $('edit-time').value = R.hhmm(recs[0].t);
      $('edit-nappy').textContent = R.nappyLabel({
        wee: recs.some(function (r) { return r.type === 'pee'; }),
        poo: recs.some(function (r) { return r.type === 'poop'; })
      });
      holdBusy(true);
      $('edit-save').disabled = false;
      $('edit-delete').disabled = false;
      screen.setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] edit open', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function hide() {
    holdBusy(false);
    $('screen-edit').hidden = true;
    $('screen-edit').removeAttribute('data-ready');
  }

  function save() {
    if (saving) return;
    var now = Date.now();
    var t = R.timeInDay(recs[0].t, $('edit-time').value);
    if (t == null) { ctx.toast('Please check the time.'); return; }
    if (t > now + 5 * 60000) { ctx.toast('That time has not happened yet.'); return; }
    var delta = t - recs[0].t;           // a Wee + Poo pair moves together, so their order stays
    if (delta === 0) { holdBusy(false); location.hash = '#today'; return; } // nothing changed
    saving = true;
    store.deviceId().then(function (deviceId) {
      var next = recs.map(function (r) { return R.revise(r, { t: r.t + delta }, now, deviceId); });
      return ctx.commitEdit('Changes saved', recs, next);
    }).then(function () { saving = false; holdBusy(false); }, function (err) {
      saving = false;
      console.error('[baby-log] edit save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function remove() {
    if (saving) return;
    saving = true;
    var now = Date.now();
    store.deviceId().then(function (deviceId) {
      return ctx.commitEdit('Deleted', recs, recs.map(function (r) { return R.tombstone(r, now, deviceId); }));
    }).then(function () { saving = false; holdBusy(false); }, function (err) {
      saving = false;
      console.error('[baby-log] edit delete', err);
      ctx.toast('Not deleted. Please try again.');
    });
  }

  function init(context) {
    ctx = context;
    $('edit-time').addEventListener('click', function (e) {
      if (typeof e.currentTarget.showPicker === 'function') { try { e.currentTarget.showPicker(); } catch (err) { /* already open or not allowed */ } }
    });
    $('edit-save').addEventListener('click', save);
    $('edit-delete').addEventListener('click', remove);
  }

  root.BABYLOG_EDIT_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
