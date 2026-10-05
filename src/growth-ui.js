// The Growth tab (#growth) and the measurement form (#measure, and #edit/<id> for a saved one), feature 010.
// The rules and the WHO numbers are in growth.js and who-data.js. This file draws, listens, and saves.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var G = root.BABYLOG_GROWTH;
  var Pr = root.BABYLOG_PROFILE;
  var store = root.BABYLOG_STORE;
  var BABY = root.BABYLOG_BABY;
  var NS = 'http://www.w3.org/2000/svg';
  // The chart area inside the 326 x 196 drawing, as in the design: x from 12 to 279, y from 170 (low) to 10 (high).
  var PLOT = { left: 12, right: 279, bottom: 170, top: 10 };
  var LIMITS = { weight: [0.3, 40], length: [25, 130] };    // kg and cm a measurement can have

  var ctx = null;
  var chart = 'weight';
  var records = [], profile = null;
  var editing = null;            // the saved measurement being edited, or null for a new one
  var open = false, saving = false, armTimer = null;

  function $(id) { return document.getElementById(id); }

  // ---- The Growth tab ----
  function show() {
    BABY.records().then(function (all) {
      records = all;
      profile = Pr.details(Pr.current(all, BABY.id()));
      render();
    }).catch(function (err) {
      console.error('[baby-log] growth', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function render() {
    var words = profile.sex === 'boy' ? 'boys' : 'girls';
    $('gr-sex').textContent = words;
    ['weight', 'length'].forEach(function (c) {
      var card = G.card(records, c, profile);
      $('gr-' + c).textContent = card.value;
      $('gr-' + c + '-change').textContent = card.change;
      $('gr-' + c + '-pct').textContent = card.label;
      $('gr-' + c + '-pct').hidden = !card.label;
    });
    $('gr-chart-title').textContent = chart === 'weight' ? 'Weight' : 'Length';
    $('gr-chart-sub').textContent = 'vs WHO ' + words + ' standard';
    $('gr-show-weight').setAttribute('aria-pressed', chart === 'weight' ? 'true' : 'false');
    $('gr-show-length').setAttribute('aria-pressed', chart === 'length' ? 'true' : 'false');
    $('gr-baby-name').textContent = Pr.displayName(profile.nickname);
    drawChart();
    renderHistory();
  }

  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function drawChart() {
    var svg = $('gr-chart');
    svg.textContent = '';
    if (!profile.dateOfBirth) return;
    var data = G.chartData(records, chart, profile, Date.now());
    var x = function (day) { return (PLOT.left + (day - data.x.from) / (data.x.to - data.x.from) * (PLOT.right - PLOT.left)).toFixed(1); };
    var y = function (v) { return (PLOT.bottom - (v - data.y.from) / (data.y.to - data.y.from) * (PLOT.bottom - PLOT.top)).toFixed(1); };
    var pts = function (line) { return line.map(function (p) { return x(p.day) + ',' + y(p.value); }); };
    var band = function (lo, hi) { return pts(data.lines[lo]).concat(pts(data.lines[hi]).reverse()).join(' '); };
    svg.appendChild(el('polygon', { points: band('p3', 'p97'), fill: '#EEF3EF' }));
    svg.appendChild(el('polygon', { points: band('p15', 'p85'), fill: '#D9E8DF' }));
    svg.appendChild(el('polyline', { points: pts(data.lines.p50).join(' '), fill: 'none', stroke: '#6F8F7E', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }));
    svg.appendChild(el('line', { x1: PLOT.left, y1: PLOT.bottom + 2, x2: PLOT.right, y2: PLOT.bottom + 2, stroke: '#E4DED5', 'stroke-width': 1 }));
    svg.appendChild(el('text', { x: 12, y: 12, 'font-size': 11, fill: '#5B6168' }, chart === 'weight' ? 'kg' : 'cm'));
    [['p97', '97th'], ['p85', '85th'], ['p50', '50th'], ['p15', '15th'], ['p3', '3rd']].forEach(function (l) {
      var end = data.lines[l[0]][data.lines[l[0]].length - 1];
      svg.appendChild(el('text', { x: 286, y: (+y(end.value) + 4).toFixed(1), 'font-size': 11, fill: l[0] === 'p50' ? '#3C4248' : '#5B6168', 'font-weight': l[0] === 'p50' ? 700 : 400 }, l[1]));
    });
    data.x.ticks.forEach(function (t, i) {
      svg.appendChild(el('text', { x: x(t.day), y: 190, 'font-size': 12, fill: '#5B6168', 'text-anchor': i === 0 ? 'start' : i === data.x.ticks.length - 1 ? 'end' : 'middle' }, t.label));
    });
    if (data.points.length) {
      svg.appendChild(el('polyline', { points: pts(data.points).join(' '), fill: 'none', stroke: '#2E7A57', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      data.points.forEach(function (p, i) {
        var last = i === data.points.length - 1;
        svg.appendChild(el('circle', { cx: x(p.day), cy: y(p.value), r: last ? 6 : 5, fill: last ? '#2E7A57' : '#FFFFFF', stroke: '#2E7A57', 'stroke-width': 2.5 }));
      });
    }
    var card = G.card(records, chart, profile);
    svg.setAttribute('aria-label', (chart === 'weight' ? 'Weight' : 'Length') + ' compared with WHO ' + (profile.sex === 'boy' ? 'boys' : 'girls') + ' percentiles.' +
      (data.points.length ? ' Now ' + card.value + (card.label ? ', ' + card.label : '') + '.' : ' No measurement yet.'));
  }

  function renderHistory() {
    var list = $('gr-history'), now = Date.now();
    var rows = G.history(records);
    list.textContent = '';
    rows.forEach(function (r) {
      var d = r.d || {};
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'gr-row';
      a.href = '#edit/' + encodeURIComponent(r.id);
      var born = profile.dateOfBirth && G.ageDays(profile.dateOfBirth, r.t) === 0;
      [G.shortDate(r.t, now) + (born ? ' · birth' : ''),
        typeof d.weight === 'number' ? G.formatWeight(d.weight) : '—',
        typeof d.height === 'number' ? G.formatLength(d.height) : '—'].forEach(function (text, i) {
        var span = document.createElement('span');
        span.textContent = text;
        if (i === 1) span.className = 'gr-row-weight';
        a.appendChild(span);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    $('gr-empty').hidden = rows.length > 0;
  }

  // ---- The measurement form ----
  function holdBusy(on) {
    if (on === open) return;
    open = on;
    ctx.setBusy(on);
  }

  // showForm(): a new measurement for today. showForm({ editId }): the same form with a saved measurement.
  function showForm(opts) {
    var editId = opts && opts.editId;
    var screen = $('screen-measure');
    screen.hidden = false;
    screen.removeAttribute('data-ready');
    $('ms-save').disabled = true;
    disarm();
    Promise.all([BABY.records(), editId ? store.getRecord(editId) : null]).then(function (r) {
      if (screen.hidden) return;
      var saved = r[1];
      if (editId && (!saved || saved.deleted || saved.type !== 'growth')) {
        ctx.toast('That entry is not there any more.');
        location.hash = '#growth';
        return;
      }
      editing = saved;
      profile = Pr.details(Pr.current(r[0], BABY.id()));
      var d = (editing && editing.d) || {};
      $('h-measure').textContent = editing ? 'Edit measurement' : 'Add measurement';
      $('ms-save').textContent = editing ? 'Save changes' : 'Save measurement';
      $('ms-delete').hidden = !editing;
      $('ms-date').value = G.dateText(editing ? editing.t : Date.now());
      $('ms-date').max = G.dateText(Date.now());
      if (profile.dateOfBirth) $('ms-date').min = profile.dateOfBirth;
      $('ms-weight').value = typeof d.weight === 'number' ? (d.weight / 1000).toFixed(2) : '';
      $('ms-length').value = typeof d.height === 'number' ? String(d.height) : '';
      holdBusy(true);
      $('ms-save').disabled = false;
      screen.setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] measurement open', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function hide() {
    disarm();
    holdBusy(false);
    editing = null;
    $('screen-measure').hidden = true;
    $('screen-measure').removeAttribute('data-ready');
  }

  // A number typed in a field, or null when the field is empty. NaN when it is not a number or out of range.
  function readNumber(id, limits) {
    var text = $(id).value.trim();
    if (text === '') return null;
    var n = Number(text.replace(',', '.'));
    return isFinite(n) && n >= limits[0] && n <= limits[1] ? n : NaN;
  }

  function save() {
    if (saving) return;
    var now = Date.now();
    var kg = readNumber('ms-weight', LIMITS.weight), cm = readNumber('ms-length', LIMITS.length);
    var date = $('ms-date').value;
    if (kg !== kg) { ctx.toast('Please check the weight (in kg, for example 4.20).'); return; }
    if (cm !== cm) { ctx.toast('Please check the length (in cm, for example 54).'); return; }
    if (kg == null && cm == null) { ctx.toast('Please enter a weight or a length.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { ctx.toast('Please check the date.'); return; }
    if (date > G.dateText(now)) { ctx.toast('That date has not happened yet.'); return; }
    if (profile.dateOfBirth && date < profile.dateOfBirth) { ctx.toast('That date is before the baby was born.'); return; }
    // Today: the time now. Another day: midday, so the date stays the same in any time zone change of a few hours.
    var p = date.split('-');
    var t = date === G.dateText(now) ? now : new Date(+p[0], +p[1] - 1, +p[2], 12).getTime();
    var fields = {};
    if (kg != null) fields.weight = Math.round(kg * 1000);
    if (cm != null) fields.height = Math.round(cm * 10) / 10;
    saving = true;
    store.deviceId().then(function (deviceId) {
      if (!editing) return store.put(R.makeRecord({ id: crypto.randomUUID(), type: 'growth', babyId: BABY.id(), t: t, now: now, deviceId: deviceId, d: fields }));
      var d = R.withFields(editing.d, fields);
      if (kg == null) delete d.weight;               // a value cleared in the form is removed
      if (cm == null) delete d.height;
      var next = R.revise(editing, { t: G.dateText(editing.t) === date ? editing.t : t, d: d }, now, deviceId);
      return R.sameContent(next, editing) ? null : store.put(next);
    }).then(function () {
      saving = false;
      ctx.toast(editing ? 'Changes saved' : 'Measurement saved');
      holdBusy(false);
      location.hash = '#growth';
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] measurement save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function remove() {
    if (saving || !editing) return;
    saving = true;
    store.deviceId().then(function (deviceId) {
      return store.put(R.tombstone(editing, Date.now(), deviceId));
    }).then(function () {
      saving = false;
      ctx.toast('Deleted');
      holdBusy(false);
      location.hash = '#growth';
    }).catch(function (err) {
      saving = false;
      console.error('[baby-log] measurement delete', err);
      ctx.toast('Not deleted. Please try again.');
    });
  }

  // Delete asks for a second tap, because there is no Undo.
  function disarm() {
    clearTimeout(armTimer);
    $('ms-delete').classList.remove('armed');
    $('ms-delete').textContent = 'Delete this entry';
  }
  function tapDelete() {
    var button = $('ms-delete');
    if (button.classList.contains('armed')) { disarm(); remove(); return; }
    button.classList.add('armed');
    button.textContent = 'Tap again to delete';
    armTimer = setTimeout(disarm, 4000);
  }

  function init(context) {
    ctx = context;
    $('gr-show-weight').addEventListener('click', function () { chart = 'weight'; render(); });
    $('gr-show-length').addEventListener('click', function () { chart = 'length'; render(); });
    $('ms-save').addEventListener('click', save);
    $('ms-delete').addEventListener('click', tapDelete);
    $('ms-date').addEventListener('click', function (e) {
      if (typeof e.currentTarget.showPicker === 'function') { try { e.currentTarget.showPicker(); } catch (err) { /* already open or not allowed */ } }
    });
  }

  root.BABYLOG_GROWTH_UI = { init: init, show: show, showForm: showForm, hide: hide };
})(typeof self !== 'undefined' ? self : this);
