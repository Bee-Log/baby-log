// Feature 009: the numbers for the daily summary (src/summary.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-summary-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['records.js', 'summary.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_SUMMARY: S, BABYLOG_RECORDS: R } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const MIN = 60000;
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime();   // Sat 3 Oct 2026
const rec = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'p', updatedAt: t, ...extra });
const NOW = at(17, 17);
const today = () => S.dayWindow(NOW, 0);

test('days run from 6 am to 6 am, and go back whole days', () => {
  assert.deepEqual(plain(today()), { from: at(6), to: at(6, 0, 4) });
  assert.deepEqual(plain(S.dayWindow(NOW, 1)), { from: at(6, 0, 2), to: at(6) });
  assert.deepEqual(plain(S.dayWindow(at(3, 0), 0)), { from: at(6, 0, 2), to: at(6) }, 'at 3 am it is still yesterday\'s day');
});

test('feeds: the count, breast and bottle, and the ml of the bottles', () => {
  const d = plain(S.day([
    rec('a', 'feed', at(7), { d: { kind: 'Breast', side: 'Left', min: 14 } }),
    rec('b', 'feed', at(9), { d: { kind: 'Bottle', ml: 90 } }),
    rec('c', 'feed', at(12), { d: { kind: 'Breast', side: 'Right', min: 8 } }),
    rec('d', 'feed', at(15), { d: { kind: 'Bottle', ml: 60 } }),
    rec('e', 'feed', at(16), { d: { kind: 'Bottle', ml: 120 }, deleted: true }),
    rec('f', 'feed', at(5, 0)),                                           // before 6 am: yesterday
    rec('g', 'feed', at(6, 0, 4))                                         // the next day
  ], today(), NOW));
  assert.deepEqual(d.feeds, { count: 4, breast: 2, bottle: 2, ml: 150 });
});

test('a feed saved without details counts as breast and adds no ml', () => {
  const d = plain(S.day([rec('a', 'feed', at(8)), rec('b', 'feed', at(9), { d: { kind: 'Bottle' } })], today(), NOW));
  assert.deepEqual(d.feeds, { count: 2, breast: 1, bottle: 1, ml: 0 });
});

test('nappies: a wee and a poo close together are one nappy', () => {
  const d = plain(S.day([
    rec('1', 'pee', at(8)), rec('2', 'poop', at(8, 1)),                  // one nappy: wee + poo
    rec('3', 'pee', at(10)),
    rec('4', 'poop', at(12)),
    rec('5', 'pee', at(14), { deleted: true })
  ], today(), NOW));
  assert.deepEqual(d.nappies, { count: 3, wee: 2, poo: 2 });
});

test('sleep: the minutes inside the day and the longest stretch; a running sleep counts until now', () => {
  const d = plain(S.day([
    rec('a', 'sleep', at(8), { end: at(9, 30) }),                          // 90
    rec('b', 'sleep', at(12), { end: at(14, 10) }),                        // 130
    rec('c', 'sleep', at(17), { end: null }),                              // 17 minutes until now
    rec('d', 'sleep', at(10), { end: at(11), deleted: true })
  ], today(), NOW));
  assert.equal(d.sleep.ms, (90 + 130 + 17) * MIN);
  assert.equal(d.sleep.longestMs, 130 * MIN);
});

test('sleep over the 6 am line is split between the two days, so the days add up', () => {
  const night = rec('n', 'sleep', at(22, 0, 2), { end: at(8, 0) });         // 10 pm to 8 am: 8 hours before 6 am, 2 after
  const yesterday = S.day([night], S.dayWindow(NOW, 1), NOW).sleep;
  const todays = S.day([night], today(), NOW).sleep;
  assert.equal(yesterday.ms, 8 * 60 * MIN);
  assert.equal(todays.ms, 2 * 60 * MIN);
  assert.equal(yesterday.ms + todays.ms, 10 * 60 * MIN);
});

test('average gap: from the start of one feed to the next; it needs two feeds', () => {
  const feeds = (...hours) => hours.map((h, i) => rec('f' + i, 'feed', at(h)));
  assert.equal(S.day(feeds(8, 10, 14), today(), NOW).averageGapMs, 3 * 60 * MIN, '(14 - 8) / 2 gaps');
  assert.equal(S.day(feeds(8, 11), today(), NOW).averageGapMs, 3 * 60 * MIN);
  assert.equal(S.day(feeds(8), today(), NOW).averageGapMs, null);
  assert.equal(S.day([], today(), NOW).averageGapMs, null);
});

test('an empty day is all zeros', () => {
  assert.deepEqual(plain(S.day([], today(), NOW)), {
    feeds: { count: 0, breast: 0, bottle: 0, ml: 0 }, nappies: { count: 0, wee: 0, poo: 0 }, sleep: { ms: 0, longestMs: 0 }, averageGapMs: null
  });
});

test('feeds per day: seven days, oldest first, ending at the chosen day', () => {
  const records = [rec('a', 'feed', at(8)), rec('b', 'feed', at(9)), rec('c', 'feed', at(8, 0, 2)), rec('d', 'feed', at(8, 0, 1)), rec('x', 'pee', at(8))];
  const week = plain(S.feedsPerDay(records, NOW, 0, 7));
  assert.equal(week.length, 7);
  assert.deepEqual(week.map((d) => d.offset), [6, 5, 4, 3, 2, 1, 0]);
  assert.equal(week[6].count, 2, 'today');
  assert.equal(week[5].count, 1, 'yesterday');
  assert.equal(week[4].count, 1, '1 Oct');
  assert.equal(week[3].count, 0, '30 Sep');
  const earlier = plain(S.feedsPerDay(records, NOW, 1, 7));
  assert.deepEqual(earlier.map((d) => d.offset), [7, 6, 5, 4, 3, 2, 1]);
  assert.equal(earlier[6].count, 1);
});

test('how far back the arrow can go follows the oldest entry', () => {
  assert.equal(S.daysBack([], NOW), 0);
  assert.equal(S.daysBack([rec('a', 'feed', at(8))], NOW), 0);
  assert.equal(S.daysBack([rec('a', 'feed', at(8, 0, 1))], NOW), 2, 'an entry from 1 Oct: two days back');
  assert.equal(S.daysBack([{ ...rec('p', 'profile', at(1, 0, 1)) }], NOW), 0, 'the profile does not count');
});

test('day titles', () => {
  assert.equal(S.title(S.dayWindow(NOW, 0), NOW), 'Today');
  assert.equal(S.title(S.dayWindow(NOW, 1), NOW), 'Yesterday');
  assert.equal(S.title(S.dayWindow(NOW, 3), NOW), 'Wed 30 Sep');
});
