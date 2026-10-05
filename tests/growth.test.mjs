// Feature 010: growth against the WHO Child Growth Standards (src/growth.js, src/who-data.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-growth-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['who-data.js', 'growth.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_GROWTH: G, BABYLOG_WHO_DATA: WHO } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const DOB = '2026-09-12';
const day = (d, h = 10) => new Date(2026, 8, 12 + d, h).getTime();      // local time, d days after birth
const girl = { nickname: 'Bean', dateOfBirth: DOB, sex: 'girl', photo: '' };
const m = (id, d, weight, height, extra = {}) => ({ id, type: 'growth', t: day(d), end: null, d: { weight, height }, note: '', by: '', deviceId: 'p', updatedAt: day(d), ...extra });

test('the WHO data: birth to 2 years, weight and length, girls and boys, one row per day', () => {
  assert.equal(WHO.firstDay, 0);
  assert.equal(WHO.lastDay, 730);
  for (const chart of ['weight', 'length']) for (const sex of ['girl', 'boy']) {
    assert.equal(WHO[chart][sex].M.length, 731, `${chart} ${sex}`);
    assert.equal(WHO[chart][sex].S.length, 731, `${chart} ${sex}`);
  }
});

test('the WHO numbers for girls at birth, as in WHO\'s expanded tables', () => {
  const p = G.lms('weight', 'girl', 0);
  assert.deepEqual(plain(p), { L: 0.3809, M: 3.2322, S: 0.14171 });
  // WHO percentile table, day 0: P3 2.44, P50 3.232, P97 4.166; z-score table: SD2 4.23, SD3neg 2.033.
  assert.equal(G.valueAt(p, G.LINES.p3).toFixed(2), '2.44');
  assert.equal(G.valueAt(p, 0).toFixed(3), '3.232');
  assert.equal(G.valueAt(p, G.LINES.p97).toFixed(3), '4.166');
  assert.equal(G.valueAt(p, 2).toFixed(2), '4.23');
  assert.equal(G.valueAt(p, -3).toFixed(3), '2.033');
  assert.ok(Math.abs(G.zScore(p, G.valueAt(p, 1.3)) - 1.3) < 1e-9, 'zScore undoes valueAt');
  assert.equal(G.lms('weight', 'girl', 731), null, 'after 2 years there is no length table here');
  assert.equal(G.lms('weight', 'girl', -1), null);
});

// The design prototype (artifacts/Growth.dc.html) has the WHO weekly table, weeks 0 to 3: P3, P15, P25, P50, P75, P85, P97.
const PROTOTYPE = {
  girl: {
    weight: [[2.4, 2.8, 2.9, 3.2, 3.6, 3.7, 4.2], [2.5, 2.9, 3.0, 3.3, 3.7, 3.9, 4.4], [2.7, 3.1, 3.2, 3.6, 3.9, 4.1, 4.6], [2.9, 3.3, 3.5, 3.8, 4.2, 4.4, 5.0]],
    length: [[45.6, 47.2, 47.9, 49.1, 50.4, 51.1, 52.7], [46.8, 48.4, 49.1, 50.3, 51.6, 52.3, 53.9], [47.9, 49.5, 50.2, 51.5, 52.8, 53.5, 55.1], [48.8, 50.5, 51.2, 52.5, 53.8, 54.5, 56.1]]
  },
  boy: {
    weight: [[2.5, 2.9, 3.0, 3.3, 3.7, 3.9, 4.3], [2.6, 3.0, 3.2, 3.5, 3.8, 4.0, 4.5], [2.8, 3.2, 3.4, 3.8, 4.1, 4.3, 4.9], [3.1, 3.5, 3.7, 4.1, 4.5, 4.7, 5.2]],
    length: [[46.3, 47.9, 48.6, 49.9, 51.2, 51.8, 53.4], [47.5, 49.1, 49.8, 51.1, 52.4, 53.1, 54.7], [48.8, 50.4, 51.1, 52.3, 53.6, 54.3, 55.9], [49.8, 51.4, 52.1, 53.4, 54.7, 55.4, 57.0]]
  }
};
const Z = [-1.880794, -1.036433, -0.67449, 0, 0.67449, 1.036433, 1.880794];

test('all 112 numbers in the design prototype match the WHO data (rounded to 1 decimal)', () => {
  let n = 0;
  for (const [sex, charts] of Object.entries(PROTOTYPE)) for (const [chart, weeks] of Object.entries(charts)) {
    weeks.forEach((row, week) => row.forEach((want, i) => {
      assert.equal(+G.valueAt(G.lms(chart, sex, 7 * week), Z[i]).toFixed(1), want, `${sex} ${chart} week ${week} column ${i}`);
      n++;
    }));
  }
  assert.equal(n, 112);
});

test('percentiles and their labels', () => {
  assert.equal(G.percentile(0).toFixed(3), '50.000');
  assert.equal(G.percentile(G.LINES.p97).toFixed(2), '97.00');
  assert.equal(G.percentile(G.LINES.p15).toFixed(2), '15.00');
  assert.equal(G.percentileLabel(77.9), 'About 80th percentile');
  assert.equal(G.percentileLabel(3.4), 'About 5th percentile');
  assert.equal(G.percentileLabel(2.9), 'Below 3rd percentile');
  assert.equal(G.percentileLabel(97.1), 'Above 97th percentile');
});

test('age is counted in calendar days from the date of birth', () => {
  assert.equal(G.ageDays(DOB, day(0, 23)), 0);
  assert.equal(G.ageDays(DOB, day(1, 0)), 1);
  assert.equal(G.ageDays(DOB, day(21)), 21);
});

test('the cards: the newest value, the change since the measurement before, and the percentile', () => {
  const records = [m('a', 0, 3400, 50), m('b', 14, 3950, 52.5), m('c', 21, 4200, 54), m('gone', 20, 9000, 70, { deleted: true })];
  assert.deepEqual(plain(G.card(records, 'weight', girl)), { value: '4.20 kg', change: '+250 g in 7 days', label: 'About 75th percentile' });
  assert.deepEqual(plain(G.card(records, 'length', girl)), { value: '54 cm', change: '+1.5 cm in 7 days', label: 'About 80th percentile' });
  assert.deepEqual(plain(G.card([], 'weight', girl)), { value: '—', change: 'Not measured yet', label: '' });
  assert.equal(G.card([m('a', 3, 3300, undefined)], 'weight', girl).change, 'First measurement');
  assert.equal(G.card([m('a', 3, 3300, undefined)], 'length', girl).value, '—', 'a weight alone has no length');
  assert.equal(G.card([m('a', 2, 3300), m('b', 3, 3250)], 'weight', girl).change, '-50 g in 1 day');
});

test('history: live measurements, newest first', () => {
  const records = [m('a', 0, 3400, 50), m('c', 21, 4200, 54), m('x', 7, 1, 1, { deleted: true }), { id: 'f', type: 'feed', t: day(5) }];
  assert.deepEqual(plain(G.history(records).map((r) => r.id)), ['c', 'a']);
});

test('the x axis: weeks up to 13 weeks, then months; at least 4 weeks, at most 2 years', () => {
  assert.deepEqual(plain(G.axis(3).ticks.map((t) => t.label)), ['Birth', 'Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']);
  assert.deepEqual(plain(G.axis(40).ticks.map((t) => t.label)), ['Birth', 'Wk 2', 'Wk 4', 'Wk 6']);
  assert.deepEqual(plain(G.axis(200).ticks.map((t) => t.label)), ['Birth', '2 mo', '4 mo', '6 mo', '8 mo']);
  const two = G.axis(2000);
  assert.equal(two.to, 730);
  assert.equal(two.ticks[two.ticks.length - 1].label, '24 mo');
});

test('chart data: the WHO lines from birth, the baby\'s points by age, and room for both', () => {
  const records = [m('a', 0, 3400, 50), m('c', 21, 4200, 54), m('before', -2, 3000, 48)];
  const c = G.chartData(records, 'weight', girl, day(21));
  assert.equal(c.x.to, 28);
  assert.deepEqual(plain(c.points.map((p) => [p.day, p.value])), [[0, 3.4], [21, 4.2]], 'a date before birth is left out');
  assert.equal(c.lines.p50[0].day, 0);
  assert.equal(c.lines.p50[c.lines.p50.length - 1].day, 28);
  assert.equal(c.lines.p50[0].value.toFixed(3), '3.232');
  assert.ok(c.y.from < c.lines.p3[0].value && c.y.to > c.lines.p97[c.lines.p97.length - 1].value);
});
