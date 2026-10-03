// Add a past sleep (feature 004): the rules behind the clock ring. No browser APIs here, so tests can load this file.
//
// Time is counted in minutes from midnight of a "base day". Inside the ring, 6:00 am of the base day is minute 360,
// noon is 720, 6 pm is 1080, midnight is 1440, and so on (6 am the next day is 1800).
// The day is split into four 6-hour parts: 0 morning (6a-12p), 1 afternoon (12p-6p), 2 night (6p-12a), 3 after midnight (12a-6a).
// The ring shows 12 hours, so one part, or two neighbouring parts, are active at a time.
//
// Which day is the base day? Each part means its latest occurrence that has already started. At 8 am,
// "6p-12a" is yesterday evening and "12a-6a" is this morning, so last night's sleep can be added in the morning.
// The base day is fixed when the parts are chosen, so the numbers do not jump if the screen stays open.
//
// A state is { parts: [..], draft: { start, end }, step, base: { y, m, d }, note }.
// The env is { sleeps: [{ t, end }], now } with real timestamps. A sleep still running counts as ending now.
// Every function returns a new state and never changes the one it was given.
(function (root) {
  var DAY_START = 360, DAY = 1440, PART = 360, HALF_DAY = 720;
  var STEP_MIN = 5;               // everything snaps to 5 minutes
  var SNAP_MIN = 10;              // a sleep snaps to the edge of a logged sleep within this
  var MIN_LEN = 5, MAX_LEN = 720, RESET_LEN = 30;
  var FUTURE_SLACK = 5;           // up to 5 minutes ahead is allowed, like the time pickers elsewhere
  var ADD_STEPS = [{ minutes: 5, label: '5m' }, { minutes: 10, label: '10m' }, { minutes: 20, label: '20m' }, { minutes: 60, label: '1h' }];

  // Ring geometry, in the 300 x 300 drawing.
  var CX = 150, CY = 150, RING_R = 118;
  var END_DOT_R = RING_R + 24;    // where the end dots sit

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function snap(m) { return Math.round(m / STEP_MIN) * STEP_MIN; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function nextPart(i) { return (i + 1) % 4; }
  function partOf(m) { return Math.floor(mod(m - DAY_START, DAY) / PART); }
  function rangeOfParts(parts) { var from = DAY_START + parts[0] * PART; return { from: from, to: from + parts.length * PART }; }

  // ---- Minutes <-> real time, using the clock on the wall (so a daylight-saving day still lines up) ----
  function baseFor(now, fromMinute) {
    var d = new Date(now);
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, d.getHours() * 60 + d.getMinutes() - fromMinute);
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }
  function toTime(base, m) { return new Date(base.y, base.m, base.d, 0, m).getTime(); }
  function toMinute(base, ts) {
    var d = new Date(ts);
    var days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(base.y, base.m, base.d)) / 86400000);
    return days * DAY + d.getHours() * 60 + d.getMinutes();
  }
  // The value for a date-and-time field: "2026-10-03T18:50".
  function toInputValue(base, m) {
    var d = new Date(toTime(base, m));
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  // The day the latest occurrence of a part of the day started on: "Today", "Yesterday", "Mon 28 Sep".
  function partDay(now, part) {
    var from = DAY_START + part * PART;
    return root.BABYLOG_RECORDS.dayName(toTime(baseFor(now, from), from), now);
  }
  function formatClock(m) {
    var t = mod(m, DAY), h = Math.floor(t / 60);
    return (h % 12 === 0 ? 12 : h % 12) + ':' + pad2(t % 60) + (h < 12 ? ' am' : ' pm');
  }
  function formatLength(m) { var h = Math.floor(m / 60); return h === 0 ? m % 60 + 'm' : h + 'h ' + pad2(m % 60) + 'm'; }

  // ---- Logged sleeps, in the minutes of the state's base day ----
  function loggedOf(state, env) {
    return env.sleeps.map(function (s) {
      return { start: toMinute(state.base, s.t), end: toMinute(state.base, s.end == null ? env.now : Math.max(s.end, s.t)) };
    }).filter(function (b) { return b.end > b.start; });
  }
  function overlapsAny(sleep, logged) {
    return logged.some(function (b) { return sleep.start < b.end && sleep.end > b.start; });
  }
  function nowMinute(state, env) { return toMinute(state.base, env.now); }
  function isFuture(state, env) { return state.draft.end > nowMinute(state, env) + FUTURE_SLACK; }
  function isOverlapping(state, env) { return overlapsAny(state.draft, loggedOf(state, env)); }
  // Why the sleep cannot be added right now: 'future', 'overlap' or null.
  function problem(state, env) { return isFuture(state, env) ? 'future' : isOverlapping(state, env) ? 'overlap' : null; }

  // Nearest start to `start` where a sleep of `len` fits in the range without overlapping.
  function nearestFreeStart(start, len, logged, range, latestEnd) {
    var fits = function (x) {
      return x >= range.from && x + len <= range.to && x + len <= latestEnd && !overlapsAny({ start: x, end: x + len }, logged);
    };
    for (var k = 0; k <= (range.to - range.from) / STEP_MIN; k++) {
      if (fits(start - k * STEP_MIN)) return start - k * STEP_MIN;
      if (fits(start + k * STEP_MIN)) return start + k * STEP_MIN;
    }
    return null;
  }
  function snapToEdge(value, edge, logged) {
    for (var i = 0; i < logged.length; i++) {
      var target = edge === 'end' ? logged[i].end : logged[i].start;
      if (Math.abs(value - target) <= SNAP_MIN) return target;
    }
    return value;
  }

  // ---- State ----
  function copy(state, changes) {
    var out = { parts: state.parts, draft: state.draft, step: state.step, base: state.base, note: state.note };
    for (var k in changes) out[k] = changes[k];
    return out;
  }

  // A new draft: the 30 minutes that ended now (rounded down to 5 minutes), in the parts that hold it.
  function init(env) {
    var d = new Date(env.now);
    var endTod = snap(Math.floor((d.getHours() * 60 + d.getMinutes()) / STEP_MIN) * STEP_MIN);
    var startTod = endTod - RESET_LEN;
    var first = partOf(startTod < 0 ? startTod + DAY : startTod), last = partOf(endTod === 0 ? DAY - 1 : endTod - 1);
    var parts = first === last ? [first] : [first, last];
    var range = rangeOfParts(parts);
    var base = baseFor(env.now, range.from);
    var start = mod(startTod, DAY);
    while (start < range.from) start += DAY;
    while (start >= range.to) start -= DAY;
    start = clamp(start, range.from, range.to - RESET_LEN);
    return { parts: parts, draft: { start: start, end: start + RESET_LEN }, step: 5, base: base, note: null };
  }

  function setLength(state, env, len) {
    len = clamp(len, MIN_LEN, MAX_LEN);
    var parts = state.parts, base = state.base;
    if (len > PART && parts.length === 1) parts = [parts[0], nextPart(parts[0])];
    var range = rangeOfParts(parts);
    len = Math.min(len, range.to - range.from);
    var start = clamp(state.draft.start, range.from, range.to - len);
    return copy(state, { parts: parts, base: base, draft: { start: start, end: start + len }, note: null });
  }

  // Parts: tap a picked part to drop it (if two); tap a neighbour to add; else pick only that.
  function togglePart(state, env, i) {
    var p = state.parts, next;
    if (p.indexOf(i) >= 0) next = p.length === 2 ? p.filter(function (x) { return x !== i; }) : p;
    else if (p.length === 1 && nextPart(p[0]) === i) next = [p[0], i];
    else if (p.length === 1 && nextPart(i) === p[0]) next = [i, p[0]];
    else next = [i];
    return moveToParts(state, env, next);
  }

  // Change the parts: a new base day (the latest occurrence), and the draft keeps its time of day, inside the new range.
  function moveToParts(state, env, parts) {
    var range = rangeOfParts(parts);
    var d = state.draft;
    var len = Math.min(d.end - d.start, range.to - range.from);
    var start = d.start;
    while (start < range.from) start += DAY;
    while (start >= range.to) start -= DAY;
    start = clamp(start, range.from, range.to - len);
    return copy(state, { parts: parts, base: baseFor(env.now, range.from), draft: { start: start, end: start + len }, note: null });
  }

  function rangeOf(state) { return rangeOfParts(state.parts); }

  // ---- Crossing the 6-hour borders ----
  // A sleep may sit across a border (12 or 6). The parts then follow the draft: the parts it touches, at most two.
  // Minutes here can run outside the base day (before 6 am, or after the next 6 am), so the base day moves with them.
  function absPart(m) { return Math.floor((m - DAY_START) / PART); }
  function shiftBase(b, days) { var t = new Date(b.y, b.m, b.d + days); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; }

  // Keeps a draft inside two neighbouring parts. A sleep over 6 hours can touch three; then it is pulled in.
  function fitDraft(draft, which) {
    var pa = absPart(draft.start), pb = absPart(draft.end - 1);
    if (pb - pa <= 1) return draft;
    var len = draft.end - draft.start;
    if (which === 'start') return { start: DAY_START + (pb - 1) * PART, end: draft.end };
    if (which === 'end') return { start: draft.start, end: DAY_START + (pa + 2) * PART };
    var early = DAY_START + pa * PART + 2 * PART - len, late = DAY_START + (pa + 1) * PART;       // the two windows that can hold it
    var start = Math.abs(draft.start - early) <= Math.abs(late - draft.start) ? early : late;
    return { start: start, end: start + len };
  }

  // The state for a draft in the base day's minutes: its parts, and a base day that keeps those parts inside one day.
  function settle(state, draft) {
    var pa = absPart(draft.start), pb = absPart(draft.end - 1);
    var days = Math.floor(pa / 4), parts = [];
    for (var i = pa; i <= Math.min(pb, pa + 1); i++) parts.push(mod(i, 4));      // the ring shows 12 hours: two parts at most
    return copy(state, {
      parts: parts, base: days ? shiftBase(state.base, days) : state.base,
      draft: { start: draft.start - days * DAY, end: draft.end - days * DAY }, note: null
    });
  }

  // Dragging stays inside the last 24 hours: nothing earlier than 24 hours ago, nothing later than now.
  // A sleep typed in from an older date is not pulled back: it can be nudged, but not moved further out.
  function bound(state, env, draft, which) {
    var now = nowMinute(state, env), cur = state.draft;
    var earliest = Math.min(Math.ceil((now - DAY) / STEP_MIN) * STEP_MIN, cur.start);
    var latest = Math.max(Math.floor((now + FUTURE_SLACK) / STEP_MIN) * STEP_MIN, cur.end);
    if (which === 'start') return { start: Math.max(draft.start, earliest), end: draft.end };
    if (which === 'end') return { start: draft.start, end: Math.min(draft.end, latest) };
    var len = draft.end - draft.start, start = Math.min(Math.max(draft.start, earliest), latest - len);
    return { start: start, end: start + len };
  }

  function setEnd(state, env, which, minutes) {
    var d = state.draft, logged = loggedOf(state, env);
    var v = snap(minutes), draft;
    if (which === 'start') draft = { start: clamp(snapToEdge(v, 'end', logged), d.end - MAX_LEN, d.end - STEP_MIN), end: d.end };
    else draft = { start: d.start, end: clamp(snapToEdge(v, 'start', logged), d.start + STEP_MIN, d.start + MAX_LEN) };
    return settle(state, fitDraft(bound(state, env, draft, which), which));
  }

  // Where the whole sleep would sit if its start were here (keeps its length, snaps to logged edges).
  function placeAt(state, env, start) {
    var d = state.draft, logged = loggedOf(state, env);
    var len = d.end - d.start;
    var s = snap(start);
    var after = snapToEdge(s, 'end', logged);
    s = after !== s ? after : snapToEdge(s + len, 'start', logged) - len;
    return fitDraft(bound(state, env, { start: s, end: s + len }, 'move'), 'move');
  }
  function moveTo(state, env, start) { return settle(state, placeAt(state, env, start)); }

  // Duration buttons. A + button adds its amount and becomes the selected step; the minus button takes off the selected step.
  function addStep(state, env, minutes) {
    var s = setLength(state, env, state.draft.end - state.draft.start + minutes);
    return copy(s, { step: minutes });
  }
  function subtractStep(state, env) { return setLength(state, env, state.draft.end - state.draft.start - state.step); }
  function resetLength(state, env) { return setLength(state, env, RESET_LEN); }

  // Typed date and time ("2026-10-03T18:50", what a date-and-time field gives). Any day is allowed,
  // so a sleep older than 24 hours is added this way. The ring follows. If the sleep would end up
  // backwards or over 12 hours, the other end is set to 1 hour from the typed one.
  function setTyped(state, env, which, value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value));
    if (!m) return state;
    var minute = toMinute(state.base, new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime());
    var d = state.draft;
    var nd = which === 'from' ? { start: minute, end: d.end } : { start: d.start, end: minute };
    var len = nd.end - nd.start;
    if (len <= 0 || len > MAX_LEN) {
      if (which === 'from') nd.end = nd.start + 60;
      else nd.start = nd.end - 60;
    }
    return settle(state, nd);
  }

  // The real times of the draft, ready to save.
  function draftTimes(state) { return { t: toTime(state.base, state.draft.start), end: toTime(state.base, state.draft.end) }; }

  // After adding: offer the same length in the next free space (the list of sleeps now includes the new one).
  function afterAdd(state, env) {
    var d = state.draft, len = d.end - d.start, range = rangeOf(state);
    var times = draftTimes(state);
    var logged = loggedOf(state, { sleeps: env.sleeps.concat([{ t: times.t, end: times.end }]), now: env.now });
    var next = nearestFreeStart(d.end, len, logged, range, nowMinute(state, env) + FUTURE_SLACK);
    return copy(state, { note: 'added', draft: next === null ? state.draft : { start: next, end: next + len } });
  }

  // ---- Clock geometry ----
  function angleOf(m) { return mod(m, HALF_DAY) / HALF_DAY * 360; }                // degrees from 12, clockwise
  function pointAt(deg, r) {
    var a = deg * Math.PI / 180;
    return { x: +(CX + Math.sin(a) * r).toFixed(1), y: +(CY - Math.cos(a) * r).toFixed(1) };
  }
  // SVG arc on the ring from minute `from` to minute `to` (clockwise). Empty when the length is 0.
  function arcPath(from, to, r) {
    var len = to - from;
    if (len <= 0) return '';
    if (len >= HALF_DAY) len = HALF_DAY - 0.5;                                      // full circle
    var a0 = angleOf(from), a1 = a0 + len / HALF_DAY * 360;
    var p0 = pointAt(a0, r), p1 = pointAt(a1, r);
    return 'M' + p0.x + ' ' + p0.y + ' A' + r + ' ' + r + ' 0 ' + (len > HALF_DAY / 2 ? 1 : 0) + ' 1 ' + p1.x + ' ' + p1.y;
  }
  // Pie wedge on the face for one 6-hour part (from minute `from`, 360 minutes long).
  function wedgePath(from, r) {
    var a0 = angleOf(from), p0 = pointAt(a0, r), p1 = pointAt(a0 + 180, r);
    return 'M' + CX + ' ' + CY + ' L' + p0.x + ' ' + p0.y + ' A' + r + ' ' + r + ' 0 0 1 ' + p1.x + ' ' + p1.y + ' Z';
  }

  // Dragging. `what` is the handle that was touched: 'start' or 'end' (the dots), or 'move' (the arc).
  // `minutes` is where the finger is now. For 'move', `grabOffset` is how far after the start of the sleep it was grabbed.
  function drag(state, env, what, grabOffset, minutes) {
    return what === 'move' ? moveTo(state, env, minutes - grabOffset) : setEnd(state, env, what, minutes);
  }

  root.BABYLOG_PASTSLEEP = {
    ADD_STEPS: ADD_STEPS, RING_R: RING_R, END_DOT_R: END_DOT_R, CX: CX, CY: CY, HALF_DAY: HALF_DAY, DAY: DAY, DAY_START: DAY_START, PART: PART,
    STEP_MIN: STEP_MIN, MIN_LEN: MIN_LEN, MAX_LEN: MAX_LEN, RESET_LEN: RESET_LEN,
    init: init, setLength: setLength, togglePart: togglePart, setEnd: setEnd, placeAt: placeAt, moveTo: moveTo, addStep: addStep,
    subtractStep: subtractStep, resetLength: resetLength, setTyped: setTyped, draftTimes: draftTimes, afterAdd: afterAdd,
    drag: drag, problem: problem, isFuture: isFuture, isOverlapping: isOverlapping, loggedOf: loggedOf, nowMinute: nowMinute,
    rangeOf: rangeOf, rangeOfParts: rangeOfParts, partOf: partOf, nextPart: nextPart,
    baseFor: baseFor, toTime: toTime, toInputValue: toInputValue, partDay: partDay, toMinute: toMinute, formatClock: formatClock, formatLength: formatLength,
    angleOf: angleOf, pointAt: pointAt, arcPath: arcPath, wedgePath: wedgePath
  };
})(typeof self !== 'undefined' ? self : this);
