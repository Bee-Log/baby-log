// The "Add a past sleep" card on the Sleep page (feature 004): draws the clock ring and saves the sleep.
// The rules live in pastsleep.js. This file only draws, listens, and saves.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var P = root.BABYLOG_PASTSLEEP;
  var store = root.BABYLOG_STORE;
  var NS = 'http://www.w3.org/2000/svg';

  var FACE_R = 100, ICON_R = 56;
  var LOOK = [
    { fill: '#ffebd6', ink: '#c0651b', icon: 'M3 19h18M7 19a5 5 0 0 1 10 0M12 7v3M5.5 11.5l1.5 1.5M18.5 11.5L17 13' },
    { fill: '#fff5cc', ink: '#a87f00', icon: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' },
    { fill: '#e4e0f6', ink: '#4a3f86', icon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
    { fill: '#dce7f6', ink: '#2f5da8', icon: 'M10 4l1.6 3.4 3.7.5-2.7 2.6.7 3.7L10 12.4l-3.3 1.8.7-3.7-2.7-2.6 3.7-.5zM18 14l.8 1.7 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z' }
  ];
  var PURPLE = '#5a4b9c', ORANGE = '#b5561a';

  var ctx = null;            // { toast, setBusy }
  var onAdded = null;        // called with all entries after a sleep is saved
  var records = [];
  var state = null;
  var drag = null;           // { what, grabOffset } while a finger is down
  var open = false;
  var saving = false;

  function $(id) { return document.getElementById(id); }

  // The finished sleeps and the running one, as the rules want them.
  function env() {
    var sleeps = records.filter(function (r) { return !r.deleted && r.type === 'sleep'; })
      .map(function (r) { return { t: r.t, end: r.end }; });
    return { sleeps: sleeps, now: Date.now() };
  }

  function buildStatic() {
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var o = P.pointAt(i * 30, 100), n = P.pointAt(i * 30, 94);
      ticks += 'M' + o.x + ' ' + o.y + 'L' + n.x + ' ' + n.y;
    }
    $('ps-ticks').setAttribute('d', ticks);
    var g = $('ps-numbers');
    for (var h = 1; h <= 12; h++) {
      var p = P.pointAt(h * 30, 84);
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', p.x);
      t.setAttribute('y', (p.y + 5).toFixed(1));
      t.setAttribute('data-hour', h);
      t.textContent = h;
      g.appendChild(t);
    }
  }

  function setLine(el, p1, p2) {
    el.setAttribute('x1', p1.x); el.setAttribute('y1', p1.y); el.setAttribute('x2', p2.x); el.setAttribute('y2', p2.y);
  }
  function setDot(el, p) { el.setAttribute('cx', p.x); el.setAttribute('cy', p.y); }

  function render() {
    if (!state) return;
    var e = env(), d = state.draft, range = P.rangeOf(state);
    var problem = P.problem(state, e);
    var colour = problem ? ORANGE : PURPLE;
    var len = d.end - d.start;

    $('ps-window').setAttribute('d', P.arcPath(range.from, range.to, P.RING_R));
    [0, 1].forEach(function (k) {
      var part = state.parts[k], face = $('ps-face' + k), icon = $('ps-icon' + k);
      if (part === undefined) { face.setAttribute('d', ''); icon.setAttribute('opacity', '0'); return; }
      var from = P.DAY_START + part * P.PART, look = LOOK[part];
      var ip = P.pointAt(P.angleOf(from) + 90, ICON_R);
      face.setAttribute('d', P.wedgePath(from, FACE_R));
      face.setAttribute('fill', look.fill);
      icon.setAttribute('transform', 'translate(' + (ip.x - 9.6).toFixed(1) + ' ' + (ip.y - 9.6).toFixed(1) + ')');
      icon.setAttribute('stroke', look.ink);
      icon.setAttribute('opacity', '1');
      icon.firstChild.setAttribute('d', look.icon);
    });
    Array.prototype.forEach.call($('ps-numbers').children, function (t) {
      var m = range.from + (((+t.getAttribute('data-hour') * 60 - range.from) % P.HALF_DAY) + P.HALF_DAY) % P.HALF_DAY;
      t.setAttribute('opacity', m <= range.to ? '1' : '0.3');
    });
    $('ps-logged').setAttribute('d', P.loggedOf(state, e).filter(function (b) { return b.end > range.from && b.start < range.to; })
      .map(function (b) { return P.arcPath(Math.max(b.start, range.from), Math.min(b.end, range.to), P.RING_R); }).join(' '));
    $('ps-draft').setAttribute('d', P.arcPath(d.start, d.end, P.RING_R));
    $('ps-draft').setAttribute('stroke', colour);
    var tick = function (m) { var a = P.angleOf(m); return [P.pointAt(a, P.RING_R + 18), P.pointAt(a, P.RING_R - 18)]; };
    var ts = tick(d.start), te = tick(d.end);
    setLine($('ps-tick-start'), ts[0], ts[1]);
    setLine($('ps-tick-end'), te[0], te[1]);
    setDot($('ps-dot-start'), P.pointAt(P.angleOf(d.start), P.END_DOT_R));
    setDot($('ps-dot-end'), P.pointAt(P.angleOf(d.end), P.END_DOT_R));
    var mid = P.angleOf(d.start) + len / P.HALF_DAY * 180, gp = P.pointAt(mid, P.RING_R);
    var grip = $('ps-grip');
    grip.setAttribute('transform', 'translate(' + gp.x + ' ' + gp.y + ') rotate(' + (mid + 90).toFixed(1) + ')');
    Array.prototype.forEach.call(grip.querySelectorAll('circle'), function (c) { c.setAttribute('fill', colour); });
    $('ps-len').textContent = P.formatLength(len);
    $('ps-range').textContent = P.formatClock(d.start) + ' – ' + P.formatClock(d.end);
    $('ps-clock').setAttribute('aria-label', 'Sleep from ' + P.formatClock(d.start) + ' to ' + P.formatClock(d.end) + ', ' + P.formatLength(len));
    $('ps-clock').style.cursor = drag ? 'grabbing' : 'pointer';

    Array.prototype.forEach.call(document.querySelectorAll('.ps-part'), function (b) {
      b.setAttribute('aria-pressed', state.parts.indexOf(+b.getAttribute('data-part')) >= 0 ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.ps-step'), function (b) {
      b.setAttribute('aria-pressed', +b.getAttribute('data-add') === state.step ? 'true' : 'false');
    });
    var label = state.step >= 60 ? state.step / 60 + 'h' : state.step + 'm';
    $('ps-minus').textContent = '−' + label;
    $('ps-minus').setAttribute('aria-label', 'Take off ' + label);

    var from = $('ps-from'), to = $('ps-to');
    if (from.value !== P.formatInput(d.start)) from.value = P.formatInput(d.start);
    if (to.value !== P.formatInput(d.end)) to.value = P.formatInput(d.end);

    var hint = $('ps-hint');
    var text = problem === 'overlap' ? 'Overlaps a sleep already logged.'
      : problem === 'future' ? 'That time has not happened yet.'
      : state.note === 'added' ? 'Added.' : '';
    hint.hidden = text === '';
    hint.textContent = text;
    hint.classList.toggle('bad', !!problem);
    var add = $('ps-add');
    add.disabled = !!problem || saving;
    add.textContent = 'Add sleep · ' + P.formatLength(len);
  }

  function update(next) { state = next; render(); }

  function pointer(ev) {
    var r = $('ps-clock').getBoundingClientRect();
    var k = 300 / r.width;
    var x = (ev.clientX - r.left) * k - P.CX, y = (ev.clientY - r.top) * k - P.CY;
    var deg = ((Math.atan2(x, -y) * 180 / Math.PI) % 360 + 360) % 360;
    var m12 = deg / 360 * P.HALF_DAY, range = P.rangeOf(state);
    return { dist: Math.sqrt(x * x + y * y), x: x + P.CX, y: y + P.CY, minutes: range.from + (((m12 - range.from) % P.HALF_DAY) + P.HALF_DAY) % P.HALF_DAY };
  }

  function onDown(ev) {
    if (!state) return;
    var hit = P.grab(state, env(), pointer(ev));
    if (!hit.what) return;
    ev.preventDefault();
    if (ev.currentTarget.setPointerCapture) { try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) { /* not a real pointer */ } }
    drag = { what: hit.what, grabOffset: hit.grabOffset };
    update(hit.state);
  }
  function onMove(ev) {
    if (!drag || !state) return;
    update(P.drag(state, env(), drag.what, drag.grabOffset, pointer(ev).minutes));
  }
  function onUp() { if (drag) { drag = null; render(); } }

  function add() {
    if (saving || !state) return;
    saving = true;
    render();
    var times = P.draftTimes(state);
    Promise.all([store.all(), store.deviceId()]).then(function (r) {
      records = r[0];
      var e = env();
      if (P.problem(state, e)) { saving = false; render(); return null; }   // something changed while the screen was open
      var rec = R.makeRecord({ id: crypto.randomUUID(), type: 'sleep', t: times.t, end: times.end, now: Date.now(), deviceId: r[1], d: { source: 'manual' } });
      return store.put(rec).then(function () { return store.all(); }).then(function (all) {
        records = all;
        saving = false;
        update(P.afterAdd(state, env()));
        if (onAdded) onAdded(all);
      });
    }).catch(function (err) {
      saving = false;
      render();
      console.error('[baby-log] add past sleep', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function init(context, callback) {
    ctx = context;
    onAdded = callback;
    buildStatic();
    var svg = $('ps-clock');
    svg.style.touchAction = 'none';
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    Array.prototype.forEach.call(document.querySelectorAll('.ps-part'), function (b) {
      b.addEventListener('click', function () { update(P.togglePart(state, env(), +b.getAttribute('data-part'))); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.ps-step'), function (b) {
      b.addEventListener('click', function () { update(P.addStep(state, env(), +b.getAttribute('data-add'))); });
    });
    $('ps-minus').addEventListener('click', function () { update(P.subtractStep(state, env())); });
    $('ps-reset').addEventListener('click', function () { update(P.resetLength(state, env())); });
    $('ps-from').addEventListener('change', function (ev) { update(P.setTyped(state, env(), 'from', ev.target.value)); });
    $('ps-to').addEventListener('change', function (ev) { update(P.setTyped(state, env(), 'to', ev.target.value)); });
    [$('ps-from'), $('ps-to')].forEach(function (input) {
      input.addEventListener('click', function () { if (input.showPicker) { try { input.showPicker(); } catch (e) { /* picker already open */ } } });
    });
    $('ps-add').addEventListener('click', add);
  }

  // The Sleep page opened: start a fresh draft (the 30 minutes that ended now). An update waits while the card is open.
  function show(all) {
    records = all;
    if (!open) { open = true; ctx.setBusy(true); }
    state = P.init(env());
    drag = null;
    render();
  }
  // The stored entries changed (a wake-up, or a sleep added): keep the draft, redraw the logged arcs.
  function refresh(all) { records = all; render(); }
  function hide() {
    if (open) { open = false; ctx.setBusy(false); }
    drag = null;
  }

  root.BABYLOG_PASTSLEEP_UI = { init: init, show: show, refresh: refresh, hide: hide };
})(typeof self !== 'undefined' ? self : this);
