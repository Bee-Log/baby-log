// Feature 003: log sleep live. The sleep logic, the numbers shown, and the #sleep route.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-sleep-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['nav.js', 'records.js', 'sleep.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_SLEEP: S, BABYLOG_RECORDS: R, BABYLOG_NAV: nav } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const MIN = 60000, HOUR = 60 * MIN;
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime(); // local time, 3 Oct 2026
const sleep = (id, t, end, extra = {}) => ({ id, type: 'sleep', t, end, d: { source: 'live' }, note: '', by: '', deviceId: 'p', updatedAt: end ?? t, ...extra });

test('starting a sleep makes a record that is still running', () => {
  const r = S.startSleep({ id: 's1', now: at(14, 15), deviceId: 'phone-A' });
  assert.deepEqual(plain(r), { id: 's1', type: 'sleep', t: at(14, 15), end: null, d: { source: 'live' }, note: '', by: '', deviceId: 'phone-A', updatedAt: at(14, 15) });
  assert.equal(S.currentSleep([r]).id, 's1');
});

test('waking up sets the end time in the same record, with a newer updatedAt', () => {
  const r = S.startSleep({ id: 's1', now: at(14, 15), deviceId: 'phone-A' });
  const w = S.wake(r, at(16, 0), 'phone-B');
  assert.equal(w.id, 's1');
  assert.equal(w.t, at(14, 15), 'the start does not change');
  assert.equal(w.end, at(16, 0));
  assert.equal(w.updatedAt, at(16, 0));
  assert.equal(w.deviceId, 'phone-B');
  assert.equal(r.end, null, 'the original is not touched');
  assert.equal(S.currentSleep([w]), null, 'no sleep is running now');
});

test('a clock that went backwards never gives a sleep that ends before it began', () => {
  const r = S.startSleep({ id: 's1', now: at(14, 15), deviceId: 'p' });
  const w = S.wake(r, at(13, 0), 'p');
  assert.equal(w.end, w.t);
  assert.ok(w.updatedAt > r.updatedAt, 'still newer, so it wins the merge');
});

test('the current sleep: the newest running one; finished and removed sleeps do not count', () => {
  const records = [
    sleep('done', at(9), at(10)),
    sleep('gone', at(11), null, { deleted: true }),
    sleep('old-open', at(12), null),
    sleep('new-open', at(13), null),
    { id: 'f', type: 'feed', t: at(13, 30), end: null }
  ];
  assert.equal(S.currentSleep(records).id, 'new-open');
  assert.equal(S.currentSleep(records.slice(0, 2)), null);
  assert.equal(S.currentSleep([]), null);
});

test('last wake: the latest end time', () => {
  assert.equal(S.lastWake([sleep('a', at(9), at(10)), sleep('b', at(12), at(13, 40)), sleep('c', at(14), null)]), at(13, 40));
  assert.equal(S.lastWake([sleep('x', at(9), at(10), { deleted: true })]), null, 'a removed sleep does not count');
  assert.equal(S.lastWake([sleep('c', at(14), null)]), null);
  assert.equal(S.lastWake([]), null);
});

test('lengths: hours and minutes, rounded down', () => {
  assert.equal(S.formatLength(0), '0m');
  assert.equal(S.formatLength(59 * 1000), '0m');
  assert.equal(S.formatLength(45 * MIN), '45m');
  assert.equal(S.formatLength(HOUR), '1h 00m');
  assert.equal(S.formatLength(HOUR + 5 * MIN), '1h 05m');
  assert.equal(S.formatLength(3 * HOUR + 37 * MIN + 59 * 1000), '3h 37m');
  assert.equal(S.formatLength(-5000), '0m');
  assert.equal(S.formatElapsed(12 * MIN + 5000), '00:12:05');
  assert.equal(S.formatElapsed(0), '00:00:00');
  assert.equal(S.formatElapsed(26 * HOUR + 3 * MIN + 9000), '26:03:09');
});

test('logged sleeps: finished ones, newest first, with their length', () => {
  const rows = plain(S.sleepRows([
    sleep('a', at(9), at(10, 30)),
    sleep('b', at(13, 40), at(15)),
    sleep('c', at(16), null),
    sleep('d', at(11), at(11, 20), { deleted: true })
  ]));
  assert.deepEqual(rows.map((r) => [r.id, r.ms]), [['b', 80 * MIN], ['a', 90 * MIN]]);
});

test('the time range, with the date for a sleep that began before today (6 am to 6 am)', () => {
  const now = at(15);                                           // Sat 3 Oct, 3 pm: today began at 6 am
  assert.equal(S.rangeLabel({ t: at(13, 40), end: at(15, 30) }, now), '1:40 pm – 3:30 pm');
  assert.equal(S.rangeLabel({ t: at(2, 10), end: at(3, 5) }, now), 'Sat 3 Oct, 2:10 am – 3:05 am', 'after midnight but before 6 am is the day before, so it shows the date');
  assert.equal(S.rangeLabel({ t: at(23, 50, 2), end: at(2, 10) }, now), 'Fri 2 Oct, 11:50 pm – 2:10 am');
  assert.equal(S.rangeLabel({ t: at(23, 50, 3), end: at(3, 30, 4) }, at(23, 55)), '11:50 pm – 3:30 am', 'across midnight, still today (3:30, because 2:10 am on 4 Oct does not exist in Melbourne: the clocks go forward)');
});

test('#sleep opens the Sleep screen', () => {
  assert.equal(nav.screenFromHash('#sleep'), 'sleep');
  assert.equal(nav.screenFromHash('#/SLEEP'), 'sleep');
  assert.equal(nav.screenFromHash('#feed'), 'feed');
  assert.equal(nav.tabFromHash('#sleep'), 'today');
});
