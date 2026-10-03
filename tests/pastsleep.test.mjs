// Feature 004: the rules behind the "Add a past sleep" clock ring (src/pastsleep.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-past-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['records.js', 'pastsleep.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const P = sandbox.self.BABYLOG_PASTSLEEP;
const plain = (v) => JSON.parse(JSON.stringify(v));

// Test helpers. fromInput: "14:30" as minutes of the sleep day (before 6 am counts as the end of that day).
// dt: a value as a date-and-time field gives it ("2026-10-03T14:30").
const fromInput = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m < 360 ? h * 60 + m + 1440 : h * 60 + m; };
const dt = (hhmm, day = 3, month = 10) => `2026-${month}-${String(day).padStart(2, '0')}T${hhmm}`;

const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime(); // local time, Sat 3 Oct 2026
const sep = (h, m = 0) => new Date(2026, 8, 28, h, m).getTime(); // Mon 28 Sep 2026
const env = (now, sleeps = []) => ({ now, sleeps });
const draftAt = (state, h, m, len) => ({ ...state, draft: { start: fromInput(`${h}:${m}`), end: fromInput(`${h}:${m}`) + len } });
const clockOf = (state) => [P.formatClock(state.draft.start), P.formatClock(state.draft.end)];
const dayOf = (ts) => new Date(ts).getDate();

// ---- Starting point ----
test('a new draft is the 30 minutes that ended now (rounded down to 5), in the part that holds it', () => {
  const e = env(at(14, 33));
  const s = P.init(e);
  assert.deepEqual(plain(s.parts), [1], 'the afternoon');
  assert.deepEqual(clockOf(s), ['2:00 pm', '2:30 pm']);
  const t = P.draftTimes(s);
  assert.deepEqual([t.t, t.end], [at(14, 0), at(14, 30)]);
  assert.equal(P.problem(s, e), null);
});

test('a new draft just after 6 am spans the night into the morning, on the right days', () => {
  const e = env(at(6, 10));
  const s = P.init(e);
  assert.deepEqual(plain(s.parts), [3, 0], '12a-6a and 6a-12p are neighbours');
  assert.deepEqual(clockOf(s), ['5:40 am', '6:10 am']);
  const t = P.draftTimes(s);
  assert.deepEqual([t.t, t.end], [at(5, 40), at(6, 10)], 'both on 3 Oct');
});

test('a new draft just after midnight spans the evening of the day before into this morning', () => {
  const e = env(at(0, 10));
  const s = P.init(e);
  assert.deepEqual(plain(s.parts), [2, 3]);
  const t = P.draftTimes(s);
  assert.deepEqual([t.t, t.end], [at(23, 40, 2), at(0, 10, 3)], '2 Oct 11:40 pm to 3 Oct 12:10 am');
});

// ---- Which day a part means ----
test('each part means its latest occurrence that has started: at 8 am, the evening is yesterday', () => {
  const e = env(at(8, 0));
  let s = P.init(e);
  assert.deepEqual(plain(s.parts), [0], 'the morning, today');
  assert.equal(dayOf(P.draftTimes(s).t), 3);
  s = P.togglePart(s, e, 2);                                   // 6p-12a
  assert.deepEqual(plain(s.parts), [2]);
  let t = P.draftTimes(s);
  assert.deepEqual([dayOf(t.t), new Date(t.t).getHours()], [2, 18], 'yesterday at 6 pm');
  assert.ok(t.end <= e.now, 'and it is in the past');
  s = P.togglePart(s, e, 3);                                   // add 12a-6a: this morning
  assert.deepEqual(plain(s.parts), [2, 3]);
  t = P.draftTimes(s);
  assert.equal(dayOf(t.t), 2);
  s = P.setEnd(s, e, 'end', fromInput('02:00'));
  assert.equal(dayOf(P.draftTimes(s).end), 3, 'after midnight is today');
});

test('the base day is fixed when the parts are chosen, so numbers do not jump while the screen is open', () => {
  const s = P.init(env(at(5, 58)));
  const later = env(at(6, 30));                                // time passes; the morning part has now started
  assert.deepEqual(plain(P.setLength(s, later, 45).base), plain(s.base));
});

// ---- Parts ----
test('parts: tap a neighbour to add it, a picked part to drop it, anything else to start again', () => {
  const e = env(at(14, 33));
  const parts = (s) => plain(s.parts);
  let s = { ...P.init(e), parts: [1] };
  assert.deepEqual(parts(P.togglePart(s, e, 2)), [1, 2]);
  assert.deepEqual(parts(P.togglePart(s, e, 0)), [0, 1]);
  assert.deepEqual(parts(P.togglePart(s, e, 1)), [1], 'the only picked part stays');
  assert.deepEqual(parts(P.togglePart(s, e, 3)), [3], 'not a neighbour: just that part');
  s = P.togglePart(s, e, 2);
  assert.deepEqual(parts(P.togglePart(s, e, 1)), [2]);
  assert.deepEqual(parts(P.togglePart(s, e, 2)), [1]);
  assert.deepEqual(parts(P.togglePart({ ...s, parts: [3] }, e, 0)), [3, 0], 'after midnight and the morning are neighbours');
  assert.deepEqual(parts(P.togglePart({ ...s, parts: [0] }, e, 3)), [3, 0]);
});

test('switching part keeps the time of day when it fits, otherwise the nearest place inside the new range', () => {
  const e = env(at(14, 33));
  let s = P.togglePart({ ...P.init(e), parts: [1] }, e, 2);    // 12p-12a
  s = P.setTyped(s, e, 'from', dt('19:00'));                        // a start after the end: an hour from the start
  assert.deepEqual(clockOf(s), ['7:00 pm', '8:00 pm']);
  s = P.setTyped(s, e, 'to', dt('19:30'));
  assert.deepEqual(clockOf(s), ['7:00 pm', '7:30 pm']);
  const dropped = P.togglePart(s, e, 1);                        // drop the afternoon: 6p-12a
  assert.deepEqual(clockOf(dropped), ['7:00 pm', '7:30 pm'], 'same time of day');
  const moved = P.togglePart(s, e, 0);                          // not a neighbour of 6p-12a (it would need 1): picks only the morning
  assert.deepEqual(plain(moved.parts), [0]);
  assert.ok(moved.draft.start >= 360 && moved.draft.end <= 720, 'inside the morning');
});

// ---- Length ----
test('duration: + adds and is remembered, minus takes off the remembered step, reset gives 30 minutes', () => {
  const e = env(at(14, 33));
  let s = P.init(e);
  s = P.addStep(s, e, 10);
  assert.equal(s.draft.end - s.draft.start, 40);
  assert.equal(s.step, 10);
  s = P.subtractStep(s, e);
  assert.equal(s.draft.end - s.draft.start, 30, 'minus took off the 10');
  s = P.addStep(s, e, 60);
  assert.equal(s.draft.end - s.draft.start, 90);
  s = P.subtractStep(s, e);
  assert.equal(s.draft.end - s.draft.start, 30, 'now minus is 1h');
  assert.equal(P.resetLength(P.addStep(s, e, 20), e).draft.end - s.draft.start, 30);
});

test('duration limits: at least 5 minutes, at most 12 hours, and past 6 hours the next part joins', () => {
  const e = env(at(14, 33));
  let s = P.init(e);
  assert.equal(P.setLength(s, e, 0).draft.end - P.setLength(s, e, 0).draft.start, 5);
  s = P.setLength(s, e, 400);
  assert.deepEqual(plain(s.parts), [1, 2], 'over 6 hours: the afternoon and the night');
  assert.equal(s.draft.end - s.draft.start, 400);
  s = P.setLength(s, e, 9999);
  assert.equal(s.draft.end - s.draft.start, 720, 'at most 12 hours');
  assert.deepEqual(plain(P.setLength({ ...P.init(env(at(3, 0))), parts: [3] }, env(at(3, 0)), 400).parts), [3, 0]);
});

// ---- Moving the ends ----
test('moving an end snaps to 5 minutes, to the edge of a logged sleep within 10 minutes, and cannot stretch past 12 hours', () => {
  const logged = [{ t: at(13, 0), end: at(14, 0) }];
  const e = env(at(16, 0), logged);
  const s = P.init({ ...e, now: at(15, 0) });
  const base = { ...s, parts: [1], base: P.baseFor(e.now, 720), draft: { start: fromInput('15:00'), end: fromInput('15:30') } };
  assert.equal(P.formatClock(P.setEnd(base, e, 'start', fromInput('14:07')).draft.start), '2:00 pm', 'snaps to the end of the logged sleep');
  assert.equal(P.formatClock(P.setEnd(base, e, 'start', fromInput('14:41')).draft.start), '2:40 pm', 'rounded to 5 minutes, far from any edge');
  const early = { ...base, draft: { start: fromInput('11:00'), end: fromInput('11:30') } };
  assert.equal(P.formatClock(P.setEnd(early, e, 'end', fromInput('12:56')).draft.end), '1:00 pm', 'snaps to the start of the logged sleep');
  assert.equal(P.setEnd(base, e, 'end', 0).draft.end, base.draft.start + 5, 'the end cannot go before the start');
  assert.equal(P.setEnd(base, e, 'start', 9999).draft.start, base.draft.end - 5, 'the start cannot pass the end');
  const late = env(at(23, 59), logged);
  const lateBase = { ...base, base: P.baseFor(late.now, 720) };
  assert.equal(P.setEnd(lateBase, late, 'end', 99999).draft.end, 1440, 'the end stops after two parts (here at midnight)');
  assert.deepEqual(plain(P.setEnd(lateBase, late, 'end', 99999).parts), [1, 2]);
});

test('moving the whole sleep keeps its length', () => {
  const e = env(at(17, 0));
  const s = { ...P.init(e), parts: [1], base: P.baseFor(e.now, 720), draft: { start: fromInput('15:00'), end: fromInput('15:45') } };
  const moved = P.moveTo(s, e, fromInput('16:20'));
  assert.deepEqual(clockOf(moved), ['4:20 pm', '5:05 pm']);
  assert.deepEqual(plain(moved.parts), [1]);
});

test('a sleep can be dragged across the 6-hour borders: the parts follow it', () => {
  const e = env(at(23, 0));
  const s = { ...P.init(e), parts: [1], base: P.baseFor(e.now, 720), draft: { start: fromInput('13:00'), end: fromInput('13:45') } };
  const noon = P.moveTo(s, e, fromInput('11:50'));
  assert.deepEqual(clockOf(noon), ['11:50 am', '12:35 pm']);
  assert.deepEqual(plain(noon.parts), [0, 1], 'across 12');
  const evening = P.moveTo(s, e, fromInput('17:45'));
  assert.deepEqual(clockOf(evening), ['5:45 pm', '6:30 pm']);
  assert.deepEqual(plain(evening.parts), [1, 2], 'across 6 pm');
  const back = P.moveTo(evening, e, fromInput('14:00'));
  assert.deepEqual(plain(back.parts), [1], 'back inside one part');
  const t = P.draftTimes(evening);
  assert.deepEqual([t.t, t.end], [at(17, 45), at(18, 30)], 'real times are right');
});

test('dragging before 6 am or past midnight keeps the real day', () => {
  const e = env(at(14, 0));
  const morning = { ...P.init(e), parts: [0], base: P.baseFor(e.now, 360), draft: { start: fromInput('06:30'), end: fromInput('07:15') } };
  const before = P.moveTo(morning, e, 330); // 5:30 am of the same day (fromInput would mean the next morning)
  assert.deepEqual(clockOf(before), ['5:30 am', '6:15 am']);
  assert.deepEqual(plain(before.parts), [3, 0]);
  const t = P.draftTimes(before);
  assert.deepEqual([t.t, t.end], [at(5, 30), at(6, 15)], 'still 3 Oct');
  const night = { ...P.init(e), parts: [2], base: P.baseFor(e.now, 1080), draft: { start: fromInput('22:00'), end: fromInput('22:45') } };
  const over = P.moveTo(night, e, fromInput('23:50'));
  assert.deepEqual(plain(over.parts), [2, 3], 'across midnight');
  const t2 = P.draftTimes(over);
  assert.deepEqual([t2.t, t2.end], [at(23, 50, 2), at(0, 35, 3)], 'night of 2 Oct into 3 Oct');
});

test('an end can be dragged across a border too, but a sleep stops at two parts', () => {
  const e = env(at(23, 0));
  const s = { ...P.init(e), parts: [1], base: P.baseFor(e.now, 720), draft: { start: fromInput('17:30'), end: fromInput('17:45') } };
  const longer = P.setEnd(s, e, 'end', fromInput('18:30'));
  assert.deepEqual(clockOf(longer), ['5:30 pm', '6:30 pm']);
  assert.deepEqual(plain(longer.parts), [1, 2]);
  const shorter = P.setEnd(longer, e, 'end', fromInput('17:50'));
  assert.deepEqual(plain(shorter.parts), [1]);
  const earlier = P.setEnd(s, e, 'start', fromInput('11:00'));
  assert.deepEqual(plain(earlier.parts), [0, 1], 'the start crossed 12');
  assert.equal(earlier.draft.end - earlier.draft.start, 405);
  assert.equal(P.setEnd(longer, e, 'start', fromInput('11:00')).draft.start, 720, 'three parts are too many: it stops at 12');
  const wide = P.setEnd(s, e, 'start', 300); // 5:00 am would touch three parts
  assert.equal(wide.draft.start, 360, 'it stops at 6 am, two parts back');
});

// ---- Typed times ----
test('typed times: parts follow, and a sleep over 6 am is allowed', () => {
  const e = env(at(14, 33));
  let s = P.init(e);
  s = P.setTyped(s, e, 'from', dt('04:00'));
  s = P.setTyped(s, e, 'to', dt('07:00'));
  assert.deepEqual(plain(s.parts), [3, 0]);
  assert.deepEqual(clockOf(s), ['4:00 am', '7:00 am']);
  assert.equal(s.draft.end - s.draft.start, 180);
  assert.equal(P.toInputValue(s.base, s.draft.start), '2026-10-03T04:00');
  const t = P.draftTimes(s);
  assert.ok(t.end - t.t === 180 * 60000);
  assert.equal(P.setTyped(s, e, 'from', ''), s, 'an empty field changes nothing');
  assert.equal(P.setTyped(s, e, 'to', 'abc'), s);
});

test('typed times: dates are explicit; a backwards or over-12-hour sleep becomes 1 hour from the time just typed', () => {
  const e = env(at(14, 33));
  const s = P.init(e);
  const a = P.setTyped(P.setTyped(s, e, 'from', dt('22:00', 2)), e, 'to', dt('02:00', 3));
  assert.equal(a.draft.end - a.draft.start, 240, '10 pm yesterday to 2 am today');
  const backwards = P.setTyped(P.setTyped(s, e, 'from', dt('09:00')), e, 'to', dt('08:00'));
  assert.equal(backwards.draft.end - backwards.draft.start, 60);
  const tooLong = P.setTyped(P.setTyped(s, e, 'from', dt('09:00', 2)), e, 'to', dt('08:00', 3));      // 23 hours
  assert.equal(tooLong.draft.end - tooLong.draft.start, 60);
});

test('a sleep from an older day can be typed in, and it is saved on that day', () => {
  const e = env(at(14, 33));
  let s = P.setTyped(P.init(e), e, 'from', dt('18:50', 28, '09'));
  s = P.setTyped(s, e, 'to', dt('20:20', 28, '09'));
  assert.equal(s.draft.end - s.draft.start, 90);
  assert.deepEqual(clockOf(s), ['6:50 pm', '8:20 pm']);
  const t = P.draftTimes(s);
  assert.deepEqual([t.t, t.end], [sep(18, 50), sep(20, 20)]);
  assert.equal(P.problem(s, e), null);
  assert.equal(P.toInputValue(s.base, s.draft.start), '2026-09-28T18:50', 'the field shows the typed date');
});

// ---- Dragging stays in the last 24 hours ----
test('dragging cannot go earlier than 24 hours ago or later than now', () => {
  const e = env(at(14, 33));                                  // now 2:33 pm; 24 hours ago is 2:35 pm yesterday
  const s = P.init(e);                                         // 2:00 pm to 2:30 pm today
  const back = P.moveTo(s, e, s.draft.start - 3 * 1440);      // try three days back
  const t = P.draftTimes(back);
  assert.equal(t.t, at(14, 35, 2), 'stops 24 hours ago');
  assert.equal(t.end - t.t, 30 * 60000, 'and keeps its length');
  const forward = P.moveTo(s, e, s.draft.start + 600);
  assert.equal(P.draftTimes(forward).end, at(14, 35), 'stops at now (5 minutes of slack, like the time fields)');
  const longEnd = P.setEnd(s, e, 'end', s.draft.end + 600);
  assert.equal(P.draftTimes(longEnd).end, at(14, 35));
  const longStart = P.setEnd(s, e, 'start', s.draft.start - 3 * 1440);
  assert.equal(P.draftTimes(longStart).t >= at(14, 35, 2) - 12 * 60 * 60000, true, 'the start cannot reach back more than 12 hours either');
});

test('a sleep typed from an older day is not pulled in when it is nudged', () => {
  const e = env(at(14, 33));
  const old = P.setTyped(P.setTyped(P.init(e), e, 'from', dt('18:50', 28, '09')), e, 'to', dt('20:20', 28, '09'));
  const nudged = P.setEnd(old, e, 'end', old.draft.end - 10);
  assert.equal(P.draftTimes(nudged).end, sep(20, 10));
  assert.equal(P.draftTimes(nudged).t, sep(18, 50));
});

test('day names: Today, Yesterday or the date', () => {
  const R = sandbox.self.BABYLOG_RECORDS;
  const now = at(8, 0);
  assert.equal(R.dayName(at(1, 0), now), 'Today');
  assert.equal(R.dayName(at(23, 59, 2), now), 'Yesterday');
  assert.equal(R.dayName(sep(12, 0), now), 'Mon 28 Sep');
  assert.equal(R.dateLabel(at(12, 0, 1)), 'Thu 1 Oct');
});

test('each part of the day says which day it is, at any time of day', () => {
  const at8am = at(8, 0), at8pm = at(20, 0);
  assert.deepEqual([0, 1, 2, 3].map((k) => P.partDay(at8am, k)), ['Today', 'Yesterday', 'Yesterday', 'Today'], 'in the morning, the evening is yesterday');
  assert.deepEqual([0, 1, 2, 3].map((k) => P.partDay(at8pm, k)), ['Today', 'Today', 'Today', 'Today']);
});

// ---- Problems ----
test('overlap: shared time is a problem, touching edges are not, and a running sleep counts until now', () => {
  const e = env(at(14, 33), [{ t: at(13, 0), end: at(14, 0) }]);
  const s = P.init(e);                                                    // 2:00 pm - 2:30 pm
  assert.equal(P.problem(s, e), null, 'starts exactly where the logged sleep ends');
  assert.equal(P.problem(P.setTyped(s, e, 'from', dt('13:30')), e), 'overlap');
  const running = env(at(14, 33), [{ t: at(14, 10), end: null }]);
  assert.equal(P.problem(P.init(running), running), 'overlap', 'a sleep that is still running ends now');
  const removedOnly = env(at(14, 33), []);
  assert.equal(P.problem(P.init(removedOnly), removedOnly), null);
});

test('future: a sleep cannot end more than 5 minutes after now', () => {
  const e = env(at(14, 33));
  const s = P.init(e);
  const ends = (hhmm) => P.problem(P.setTyped(P.setTyped(s, e, 'from', dt('14:00')), e, 'to', dt(hhmm)), e);
  assert.equal(ends('14:35'), null);
  assert.equal(ends('14:38'), null, 'up to 5 minutes ahead');
  assert.equal(ends('14:40'), 'future');
  assert.equal(ends('16:00'), 'future');
  assert.equal(P.isFuture(s, e), false);
});

// ---- After adding ----
test('after adding, the same length is offered in the next free space that is not in the future', () => {
  const e = env(at(14, 33));
  const s = P.init(e);                                                    // 2:00 - 2:30
  const t = P.draftTimes(s);
  const next = P.afterAdd(s, e);
  assert.equal(next.note, 'added');
  assert.deepEqual(clockOf(next), ['1:30 pm', '2:00 pm'], 'the 30 minutes before the one just added');
  const e2 = { now: e.now, sleeps: [{ t: t.t, end: t.end }] };
  assert.equal(P.problem(next, e2), null, 'and it does not overlap the new sleep');
});

test('after adding, if nothing fits the draft stays where it was', () => {
  const e = env(at(6, 40), [{ t: at(6, 0), end: at(6, 20) }]);
  const s = { ...P.init(e), parts: [0], base: P.baseFor(e.now, 360), draft: { start: fromInput('06:20'), end: fromInput('06:40') } };
  const next = P.afterAdd(s, e);
  assert.deepEqual(plain(next.draft), plain(s.draft));
});

// ---- Touch ----
const onRing = (state, minute, dist = P.RING_R) => {
  const a = P.angleOf(minute), pt = P.pointAt(a, dist);
  return { dist, x: pt.x, y: pt.y, minutes: minute };
};
test('touch: the middle of the arc moves the whole sleep; near an end moves that end; empty ring places the sleep', () => {
  const e = env(at(17, 0));
  const s = { ...P.init(e), parts: [1], base: P.baseFor(e.now, 720), draft: { start: fromInput('14:00'), end: fromInput('14:30') } };
  assert.equal(P.grab(s, e, onRing(s, fromInput('14:15'))).what, 'move', 'middle of the arc');
  assert.equal(P.grab(s, e, onRing(s, fromInput('14:29'))).what, 'end', 'right on the end');
  assert.equal(P.grab(s, e, onRing(s, fromInput('14:01'))).what, 'start');
  assert.equal(P.grab(s, e, onRing(s, fromInput('14:33'))).what, 'end', 'just off the end of the arc');
  assert.equal(P.grab(s, e, onRing(s, fromInput('14:15'), 50)).what, null, 'the inner face does nothing');
  assert.equal(P.grab(s, e, onRing(s, fromInput('14:15'), 300)).what, null, 'far outside does nothing');
  assert.equal(P.grab(s, e, onRing(s, fromInput('14:50'), P.RING_R + 30)).what, 'end', 'outside the band: the nearest end');
  const placed = P.grab(s, e, onRing(s, fromInput('16:00')));
  assert.equal(placed.what, 'move', 'tap on empty ring');
  assert.deepEqual(clockOf(placed.state), ['3:45 pm', '4:15 pm'], 'the sleep is centred where you tapped');
});

test('dragging: an end moves; the whole sleep moves by where it was grabbed', () => {
  const e = env(at(17, 0));
  const s = { ...P.init(e), parts: [1], base: P.baseFor(e.now, 720), draft: { start: fromInput('14:00'), end: fromInput('14:30') } };
  assert.equal(P.formatClock(P.drag(s, e, 'end', 0, fromInput('15:10')).draft.end), '3:10 pm');
  assert.equal(P.formatClock(P.drag(s, e, 'start', 0, fromInput('13:20')).draft.start), '1:20 pm');
  const g = P.grab(s, e, onRing(s, fromInput('14:20')));                 // grabbed 20 minutes after the start
  assert.equal(g.grabOffset, 20);
  assert.deepEqual(clockOf(P.drag(g.state, e, 'move', g.grabOffset, fromInput('15:20'))), ['3:00 pm', '3:30 pm']);
});

// ---- Numbers and drawing ----
test('minutes and real times match, also around a daylight-saving change', () => {
  for (const when of [at(14, 33), new Date(2026, 3, 5, 8, 15).getTime(), new Date(2026, 9, 4, 8, 15).getTime(), new Date(2026, 2, 29, 8, 15).getTime()]) {
    const e = env(when);
    const s = P.init(e);
    const t = P.draftTimes(s);
    assert.equal(P.toMinute(s.base, t.t), s.draft.start, new Date(when).toString());
    assert.equal(P.toMinute(s.base, t.end), s.draft.end);
    assert.ok(t.end <= when + 5 * 60000, 'the starting draft is never in the future');
    assert.equal(t.end - t.t, 30 * 60000);
  }
});

test('labels', () => {
  assert.equal(P.formatClock(870), '2:30 pm');
  assert.equal(P.formatClock(1440), '12:00 am');
  assert.equal(P.formatClock(1800 + 5), '6:05 am');
  assert.equal(P.formatLength(90), '1h 30m');
  assert.equal(P.formatLength(45), '45m');
});

test('drawing: arcs and wedges are paths, and a zero-length arc is empty', () => {
  assert.match(P.arcPath(840, 870, P.RING_R), /^M[\d. ]+A118 118 0 0 1 [\d. ]+$/);
  assert.equal(P.arcPath(840, 840, P.RING_R), '');
  assert.match(P.arcPath(720, 1440, P.RING_R), /A118 118 0 1 1/, 'a full circle still draws');
  assert.match(P.wedgePath(360, 100), /^M150 150 L[\d. ]+ A100 100 0 0 1 [\d. ]+ Z$/);
  assert.deepEqual(plain(P.pointAt(0, 100)), { x: 150, y: 50 }, '12 o\'clock is straight up');
  assert.deepEqual(plain(P.pointAt(90, 100)), { x: 250, y: 150 });
  assert.equal(P.angleOf(720), 0);
  assert.equal(P.angleOf(900), 90);
});

test('a typed time never makes a sleep longer than 12 hours', () => {
  const e = env(at(22, 5));
  const s = P.init(e);                         // 9:35 pm to 10:05 pm
  const early = P.setTyped(s, e, 'from', dt('08:15'));
  assert.equal(early.draft.end - early.draft.start, 60, 'over 12 hours: it becomes 1 hour from the typed start');
  assert.equal(P.toInputValue(early.base, early.draft.start), '2026-10-03T08:15');
  const late = P.setTyped(s, e, 'to', dt('23:55'));
  assert.ok(late.draft.end - late.draft.start <= 720);
});
