// Feed logic (features 006 and 007). No browser APIs here, so tests can load this file directly.
(function (root) {
  // ---- Breast timer ----
  // The timer is a list of segments, { side, from, to }, with `to` null while that side is running.
  // Totals come from the timestamps, not from a ticking counter, so the timer keeps the right time
  // when the app is closed, the phone sleeps, or the page reloads.
  // state: null (nothing started) or { startedAt, segments }.

  function runningSide(state) {
    if (!state) return null;
    var last = state.segments[state.segments.length - 1];
    return last && last.to == null ? last.side : null;
  }

  function closeRunning(segments, now) {
    return segments.map(function (s) {
      return s.to == null ? { side: s.side, from: s.from, to: Math.max(now, s.from) } : s;
    });
  }

  // Tap Left or Right: pause the side that is running, switch from the other side, or start.
  function tap(state, side, now) {
    if (side !== 'Left' && side !== 'Right') throw new Error('Unknown side: ' + side);
    var segments = state ? state.segments : [];
    var running = runningSide(state);
    var closed = closeRunning(segments, now);
    if (running === side) return { startedAt: state.startedAt, segments: closed };
    return {
      startedAt: state ? state.startedAt : now,
      segments: closed.concat([{ side: side, from: now, to: null }])
    };
  }

  function stop(state, now) {
    return state ? { startedAt: state.startedAt, segments: closeRunning(state.segments, now) } : null;
  }

  function totals(state, now) {
    var out = { Left: 0, Right: 0, total: 0 };
    if (!state) return out;
    state.segments.forEach(function (s) {
      out[s.side] += Math.max(0, (s.to == null ? now : s.to) - s.from);
    });
    out.total = out.Left + out.Right;
    return out;
  }

  // The fields a saved breast feed needs (app-rules.md: d.kind, d.side, d.min).
  function breastFields(state, now) {
    if (!state || !state.segments.length) return null;
    var t = totals(state, now);
    var side = t.Left > 0 && t.Right > 0 ? 'Both' : t.Right > 0 ? 'Right' : t.Left > 0 ? 'Left' : state.segments[0].side;
    return { t: state.startedAt, d: { kind: 'Breast', side: side, min: Math.round(t.total / 60000) } };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // 08:32, or 1:05:09 from one hour on.
  function formatTimer(ms) {
    var secs = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, s = secs % 60;
    return h ? h + ':' + pad2(m) + ':' + pad2(s) : pad2(m) + ':' + pad2(s);
  }

  // ---- Bottle ----
  var MAX_ML = 240, ML_STEP = 10, DEFAULT_ML = 90;
  var ML_ZERO_Y = 267, ML_FULL_Y = 79; // bottle drawing, in svg units (see the Feed design)
  var MILK = ['Formula', 'Breast milk']; // the "Expressed" button stores 'Breast milk' (signoff 007)

  function clampMl(v) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return null;
    return Math.max(0, Math.min(MAX_ML, n));
  }
  function yOfMl(ml) { return ML_ZERO_Y - ml / MAX_ML * (ML_ZERO_Y - ML_FULL_Y); }
  // A drag position on the bottle drawing, snapped to ML_STEP.
  function mlOfY(y) {
    return clampMl(Math.round((ML_ZERO_Y - y) / (ML_ZERO_Y - ML_FULL_Y) * MAX_ML / ML_STEP) * ML_STEP);
  }

  // "Fed at": the latest moment on or before `now` that shows hh:mm on the clock.
  // At 00:10, "23:50" means last night, not 23 hours from now. Up to 5 minutes ahead is allowed,
  // because the time picker works in 5-minute steps and starts at the current time.
  function timeOnOrBefore(now, hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    var d = new Date(now);
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +m[1], +m[2]).getTime();
    if (t > now + 5 * 60000) t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, +m[1], +m[2]).getTime();
    return t;
  }

  // hh:mm for the time field, rounded down to 5 minutes.
  function inputTime(now) {
    var d = new Date(now);
    return pad2(d.getHours()) + ':' + pad2(Math.floor(d.getMinutes() / 5) * 5);
  }

  root.BABYLOG_FEED = {
    MAX_ML: MAX_ML, ML_STEP: ML_STEP, DEFAULT_ML: DEFAULT_ML, MILK: MILK,
    runningSide: runningSide, tap: tap, stop: stop, totals: totals, breastFields: breastFields, formatTimer: formatTimer,
    clampMl: clampMl, yOfMl: yOfMl, mlOfY: mlOfY, timeOnOrBefore: timeOnOrBefore, inputTime: inputTime
  };
})(typeof self !== 'undefined' ? self : this);
