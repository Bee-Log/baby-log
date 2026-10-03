// The Edit screen (feature 011): fix or delete a nappy or feed after it was saved.
// Opened with #edit/<ids> (a row on Today; ids are joined with +, because "Wee + Poo" is two entries).
// An edit changes the entry in place: same id, new values, newer updatedAt (records.js: revise / restore).
(function (root) {
  var F = root.BABYLOG_FEED;
  var R = root.BABYLOG_RECORDS;
  var store = root.BABYLOG_STORE;

  var ctx = null;                 // { toast, renderToday, setBusy } from app.js
  var recs = [];                  // the entries being edited, oldest first
  var kind = null;                // 'breast' | 'bottle' | 'nappy'
  var form = { side: 'Left', min: 0, ml: 0, milk: 'Formula' };
  var holding = false;
  var saving = false;
  var MAX_MIN = 300;

  function $(id) { return document.getElementById(id); }

  // The form is not saved anywhere until "Save changes", so an app update waits (app.js reloads the page).
  function holdBusy(on) {
    if (on === holding) return;
    holding = on;
    ctx.setBusy(on);
  }

  function kindOf(rec) {
    if (rec.type === 'feed') return (rec.d || {}).kind === 'Bottle' ? 'bottle' : 'breast';
    return rec.type === 'pee' || rec.type === 'poop' ? 'nappy' : null;
  }

  function render() {
    $('edit-breast').hidden = kind !== 'breast';
    $('edit-bottle').hidden = kind !== 'bottle';
    $('edit-nappy').hidden = kind !== 'nappy';
    ['Left', 'Right', 'Both'].forEach(function (side) {
      $('edit-side-' + side).setAttribute('aria-pressed', form.side === side ? 'true' : 'false');
    });
    if (document.activeElement !== $('edit-min')) $('edit-min').value = form.min;
    if (document.activeElement !== $('edit-ml')) $('edit-ml').value = form.ml;
    var expressed = form.milk === 'Breast milk';
    $('edit-milk-formula').setAttribute('aria-pressed', expressed ? 'false' : 'true');
    $('edit-milk-expressed').setAttribute('aria-pressed', expressed ? 'true' : 'false');
  }

  function clampInt(v, max) {
    var n = Math.round(Number(v));
    return isFinite(n) ? Math.max(0, Math.min(max, n)) : null;
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
      var live = found.filter(function (r) { return r && !r.deleted && kindOf(r); });
      var kinds = live.map(kindOf).filter(function (k, i, all) { return all.indexOf(k) === i; });
      if (!ids.length || live.length !== ids.length || kinds.length !== 1) {
        ctx.toast('That entry is not there any more.');
        location.hash = '#today';
        return;
      }
      recs = live.sort(function (a, b) { return a.t - b.t; });
      kind = kinds[0];
      var first = recs[0], d = first.d || {};
      $('edit-time').value = R.hhmm(first.t);
      $('edit-note').value = first.note || '';
      form.side = ['Left', 'Right', 'Both'].indexOf(d.side) > -1 ? d.side : 'Left';
      form.min = d.min != null && clampInt(d.min, MAX_MIN) != null ? clampInt(d.min, MAX_MIN) : 0;
      form.ml = d.ml != null && clampInt(d.ml, F.MAX_ML) != null ? clampInt(d.ml, F.MAX_ML) : 0;
      form.milk = F.MILK.indexOf(d.milk) > -1 ? d.milk : 'Formula';
      $('h-edit').textContent = kind === 'nappy' ? 'Edit nappy' : 'Edit feed';
      $('edit-time-label').textContent = kind === 'breast' ? 'Started at' : kind === 'bottle' ? 'Fed at' : 'Time';
      $('edit-note-row').hidden = kind !== 'breast';
      $('edit-nappy').textContent = kind === 'nappy' ? R.nappyLabel({ wee: recs.some(function (r) { return r.type === 'pee'; }), poo: recs.some(function (r) { return r.type === 'poop'; }) }) : '';
      holdBusy(true);
      render();
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

  // What the form would change each entry to. Returns null (and tells the parent) if the time is not usable.
  function newVersions(now, deviceId) {
    var t = R.timeInDay(recs[0].t, $('edit-time').value);
    if (t == null) { ctx.toast('Please check the time.'); return null; }
    if (t > now + 5 * 60000) { ctx.toast('That time has not happened yet.'); return null; }
    var delta = t - recs[0].t;           // a Wee + Poo pair moves together, so their order stays
    // Read what is typed right now, so a tap on Save straight after typing cannot miss it.
    if (kind === 'breast') form.min = clampInt($('edit-min').value, MAX_MIN) == null ? form.min : clampInt($('edit-min').value, MAX_MIN);
    if (kind === 'bottle') form.ml = clampInt($('edit-ml').value, F.MAX_ML) == null ? form.ml : clampInt($('edit-ml').value, F.MAX_ML);
    var note = $('edit-note').value.trim();
    return recs.map(function (r) {
      var c = { t: r.t + delta };
      if (kind === 'breast') { c.d = withFields(r.d, { kind: 'Breast', side: form.side, min: form.min }); c.note = note; }
      if (kind === 'bottle') c.d = withFields(r.d, { kind: 'Bottle', milk: form.milk, ml: form.ml });
      return R.revise(r, c, now, deviceId);
    });
  }

  // The entry's details with the edited fields replaced. Fields this screen does not know are kept.
  function withFields(d, fields) {
    var out = {};
    for (var k in (d || {})) out[k] = d[k];
    for (var f in fields) out[f] = fields[f];
    return out;
  }

  function same(a, b) { return JSON.stringify([a.t, a.d, a.note]) === JSON.stringify([b.t, b.d, b.note]); }

  function finish(message, originals, saved) {
    var deviceIdFor = saved[0].deviceId;
    ctx.toast(message, function () {
      var back = originals.map(function (o, i) { return R.restore(o, saved[i], Date.now(), deviceIdFor); });
      return store.putMany(back).then(ctx.renderToday).then(function () { return message === 'Deleted' ? 'Restored' : 'Change undone'; });
    });
    holdBusy(false);
    location.hash = '#today';
  }

  function save() {
    if (saving) return;
    saving = true;
    var now = Date.now();
    store.deviceId().then(function (deviceId) {
      var next = newVersions(now, deviceId);
      if (!next) { saving = false; return; }
      if (next.every(function (n, i) { return same(n, recs[i]); })) { // nothing changed: leave the entry alone
        saving = false; holdBusy(false); location.hash = '#today'; return;
      }
      return store.putMany(next).then(function () {
        saving = false;
        finish('Changes saved', recs, next);
      });
    }).catch(function (err) {
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
      var gone = recs.map(function (r) { return R.tombstone(r, now, deviceId); });
      return store.putMany(gone).then(function () {
        saving = false;
        finish('Deleted', recs, gone);
      });
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] edit delete', err);
      ctx.toast('Not deleted. Please try again.');
    });
  }

  function init(context) {
    ctx = context;
    ['Left', 'Right', 'Both'].forEach(function (side) {
      $('edit-side-' + side).addEventListener('click', function () { form.side = side; render(); });
    });
    var setMin = function (v) { var n = clampInt(v, MAX_MIN); if (n != null) { form.min = n; render(); } };
    var setMl = function (v) { var n = clampInt(v, F.MAX_ML); if (n != null) { form.ml = n; render(); } };
    $('edit-min').addEventListener('change', function (e) { setMin(e.target.value); });
    $('edit-min-minus').addEventListener('click', function () { setMin(form.min - 1); });
    $('edit-min-plus').addEventListener('click', function () { setMin(form.min + 1); });
    $('edit-ml').addEventListener('change', function (e) { setMl(e.target.value); });
    $('edit-ml-minus').addEventListener('click', function () { setMl(form.ml - F.ML_STEP); });
    $('edit-ml-plus').addEventListener('click', function () { setMl(form.ml + F.ML_STEP); });
    $('edit-milk-formula').addEventListener('click', function () { form.milk = 'Formula'; render(); });
    $('edit-milk-expressed').addEventListener('click', function () { form.milk = 'Breast milk'; render(); });
    $('edit-time').addEventListener('click', function (e) {
      if (typeof e.currentTarget.showPicker === 'function') { try { e.currentTarget.showPicker(); } catch (err) { /* already open or not allowed */ } }
    });
    $('edit-save').addEventListener('click', save);
    $('edit-delete').addEventListener('click', remove);
  }

  root.BABYLOG_EDIT_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
