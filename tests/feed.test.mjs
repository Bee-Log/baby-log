// Features 006 and 007: the breast timer, the bottle amount, "Fed at", and the feed rows on Today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-feed-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['nav.js', 'records.js', 'feed.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_FEED: F, BABYLOG_RECORDS: R, BABYLOG_NAV: nav } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const MIN = 60000, SEC = 1000;
const T0 = new Date(2026, 9, 3, 14, 0).getTime(); // 2:00 pm, 3 Oct 2026, local time

// ---- Breast timer ----
test('timer: nothing runs until a side is tapped', () => {
  assert.equal(F.runningSide(null), null);
  assert.deepEqual(plain(F.totals(null, T0)), { Left: 0, Right: 0, total: 0 });
  assert.equal(F.breastFields(null, T0), null, 'nothing to save');
});

test('timer: tap starts a side, tap again pauses it, tap again resumes', () => {
  let s = F.tap(null, 'Left', T0);
  assert.equal(F.runningSide(s), 'Left');
  assert.equal(s.startedAt, T0);
  s = F.tap(s, 'Left', T0 + 5 * MIN);               // pause
  assert.equal(F.runningSide(s), null);
  assert.equal(F.totals(s, T0 + 60 * MIN).Left, 5 * MIN, 'a paused side stops counting');
  s = F.tap(s, 'Left', T0 + 10 * MIN);              // resume
  assert.equal(F.runningSide(s), 'Left');
  assert.equal(s.startedAt, T0, 'the feed started at the first tap');
  assert.equal(F.totals(s, T0 + 13 * MIN).Left, 8 * MIN, '5 min + 3 min, the pause is not counted');
});

test('timer: tapping the other side switches', () => {
  let s = F.tap(null, 'Left', T0);
  s = F.tap(s, 'Right', T0 + 7 * MIN);
  assert.equal(F.runningSide(s), 'Right');
  const t = F.totals(s, T0 + 10 * MIN);
  assert.deepEqual([t.Left, t.Right, t.total], [7 * MIN, 3 * MIN, 10 * MIN]);
  assert.equal(s.segments.filter((x) => x.to == null).length, 1, 'only one side runs at a time');
});

test('timer: the time comes from timestamps, so it is right after the app was closed', () => {
  const s = JSON.parse(JSON.stringify(F.tap(null, 'Right', T0))); // saved to storage and read back
  assert.equal(F.totals(s, T0 + 95 * MIN).Right, 95 * MIN);
  assert.equal(F.formatTimer(95 * MIN), '1:35:00');
});

test('timer: a clock that goes backwards never gives negative time', () => {
  const s = F.tap(F.tap(null, 'Left', T0), 'Left', T0 - 5 * MIN);
  assert.equal(F.totals(s, T0).Left, 0);
  assert.equal(F.totals(F.tap(null, 'Left', T0), T0 - MIN).Left, 0);
});

test('timer: tapping an unknown side is refused', () => {
  assert.throws(() => F.tap(null, 'Middle', T0), /Unknown side/);
});

test('timer formatting', () => {
  assert.equal(F.formatTimer(0), '00:00');
  assert.equal(F.formatTimer(8 * MIN + 32 * SEC), '08:32');
  assert.equal(F.formatTimer(59 * MIN + 59 * SEC + 999), '59:59');
  assert.equal(F.formatTimer(-5), '00:00');
});

test('saved breast feed: side and minutes follow the sides that were timed', () => {
  const left = F.stop(F.tap(null, 'Left', T0), T0 + 14 * MIN);
  assert.deepEqual(plain(F.breastFields(left, T0 + 99 * MIN)), { t: T0, d: { kind: 'Breast', side: 'Left', min: 14 } }, 'stop closes the running side');

  const right = F.stop(F.tap(null, 'Right', T0), T0 + 9 * MIN + 40 * SEC);
  assert.deepEqual(plain(F.breastFields(right, T0)).d, { kind: 'Breast', side: 'Right', min: 10 }, 'rounded to the nearest minute');

  const both = F.stop(F.tap(F.tap(null, 'Left', T0), 'Right', T0 + 8 * MIN), T0 + 20 * MIN);
  assert.deepEqual(plain(F.breastFields(both, T0)).d, { kind: 'Breast', side: 'Both', min: 20 });

  const instant = F.stop(F.tap(null, 'Right', T0), T0);
  assert.deepEqual(plain(F.breastFields(instant, T0)).d, { kind: 'Breast', side: 'Right', min: 0 }, 'a started side is not lost');
});

test('saving a running timer counts it up to the moment of saving', () => {
  const s = F.tap(null, 'Left', T0);
  assert.equal(F.breastFields(F.stop(s, T0 + 6 * MIN), T0 + 6 * MIN).d.min, 6);
  assert.equal(F.stop(null, T0), null);
});

// ---- Bottle ----
test('bottle amount stays between 0 and 240 ml', () => {
  assert.equal(F.clampMl(90), 90);
  assert.equal(F.clampMl(-30), 0);
  assert.equal(F.clampMl(500), 240);
  assert.equal(F.clampMl('120'), 120, 'typed text');
  assert.equal(F.clampMl(94.6), 95);
  for (const bad of ['', 'abc', NaN, undefined]) assert.equal(F.clampMl(bad), bad === '' ? 0 : null, String(bad));
});

test('dragging the bottle gives amounts in 10 ml steps; the ends are 0 and 240', () => {
  assert.equal(F.mlOfY(F.yOfMl(0)), 0);
  assert.equal(F.mlOfY(F.yOfMl(240)), 240);
  for (let ml = 0; ml <= 240; ml += 10) assert.equal(F.mlOfY(F.yOfMl(ml)), ml, `${ml} ml`);
  assert.equal(F.mlOfY(-50), 240, 'above the bottle');
  assert.equal(F.mlOfY(900), 0, 'below the bottle');
  assert.equal(F.mlOfY(F.yOfMl(95)) % 10, 0);
});

test('"Expressed" is stored as Breast milk (signoff 007)', () => {
  assert.deepEqual([...F.MILK], ['Formula', 'Breast milk']);
});

test('"Fed at": today when it is not ahead of now, otherwise last night', () => {
  const at = (h, m, day = 3) => new Date(2026, 9, day, h, m).getTime();
  assert.equal(F.timeOnOrBefore(at(14, 0), '13:30'), at(13, 30));
  assert.equal(F.timeOnOrBefore(at(14, 0), '14:00'), at(14, 0));
  assert.equal(F.timeOnOrBefore(at(14, 3), '14:05'), at(14, 5), 'the picker may be up to 5 minutes ahead');
  assert.equal(F.timeOnOrBefore(at(0, 10), '23:50'), at(23, 50, 2), 'just after midnight, 23:50 was yesterday');
  assert.equal(F.timeOnOrBefore(at(9, 0), '15:00'), at(15, 0, 2), 'later than now means yesterday');
  for (const bad of ['', '25:00', '12:60', 'noon', null, undefined]) assert.equal(F.timeOnOrBefore(at(9, 0), bad), null, String(bad));
});

test('the time field starts at the current time, rounded down to 5 minutes', () => {
  assert.equal(F.inputTime(new Date(2026, 9, 3, 7, 4).getTime()), '07:00');
  assert.equal(F.inputTime(new Date(2026, 9, 3, 23, 59).getTime()), '23:55');
});

// ---- Today list ----
const rec = (id, type, t, d = {}, extra = {}) => ({ id, type, t, d, ...extra });
test('feed labels', () => {
  assert.equal(R.feedLabel(rec('a', 'feed', 1, { kind: 'Breast', side: 'Left', min: 14 })), 'Left 14 min');
  assert.equal(R.feedLabel(rec('a', 'feed', 1, { kind: 'Breast', side: 'Both', min: 22 })), 'Both 22 min');
  assert.equal(R.feedLabel(rec('a', 'feed', 1, { kind: 'Bottle', milk: 'Formula', ml: 90 })), 'Bottle 90 ml');
  assert.equal(R.feedLabel(rec('a', 'feed', 1, { kind: 'Bottle' })), 'Bottle', 'old or partial data does not break the list');
  assert.equal(R.feedLabel(rec('a', 'feed', 1, { kind: 'Breast' })), 'Breast');
  assert.equal(R.feedLabel({ id: 'a', type: 'feed', t: 1 }), 'Breast');
});

test('Today list: feeds and nappies together, newest first; removed entries are left out', () => {
  const rows = plain(R.timelineRows([
    rec('f1', 'feed', T0, { kind: 'Breast', side: 'Left', min: 14 }),
    rec('p1', 'pee', T0 + 20 * MIN),
    rec('f2', 'feed', T0 + 60 * MIN, { kind: 'Bottle', ml: 90 }),
    rec('f3', 'feed', T0 + 90 * MIN, { kind: 'Bottle', ml: 60 }, { deleted: true }),
    rec('s1', 'sleep', T0 + 100 * MIN)
  ]));
  assert.deepEqual(rows.map((r) => [r.kind, r.label]), [['feed', 'Bottle 90 ml'], ['nappy', 'Wee'], ['feed', 'Left 14 min']]);
});

test('last feed of each kind', () => {
  const records = [
    rec('a', 'feed', T0, { kind: 'Bottle', ml: 60 }),
    rec('b', 'feed', T0 + 5 * MIN, { kind: 'Bottle', ml: 90 }),
    rec('c', 'feed', T0 + 9 * MIN, { kind: 'Bottle', ml: 120 }, { deleted: true }),
    rec('d', 'feed', T0 + 2 * MIN, { kind: 'Breast', side: 'Right', min: 8 })
  ];
  assert.equal(R.lastFeed(records, 'Bottle').id, 'b', 'a removed feed is ignored');
  assert.equal(R.lastFeed(records, 'Breast').id, 'd');
  assert.equal(R.lastFeed([], 'Bottle'), null);
});

test('#feed opens the Feed screen; tabs and anything else do not', () => {
  assert.equal(nav.screenFromHash('#feed'), 'feed');
  assert.equal(nav.screenFromHash('#/FEED'), 'feed');
  for (const h of ['#today', '#growth', '', '#feeds', undefined]) assert.equal(nav.screenFromHash(h), null, String(h));
  assert.equal(nav.tabFromHash('#feed'), 'today', 'the tab bar falls back to Today');
});
