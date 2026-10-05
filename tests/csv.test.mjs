// The CSV export (src/csv.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-csv-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['records.js', 'schema.js', 'csv.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_CSV: Csv } = sandbox.self;

const at = (h, m = 0) => new Date(2026, 9, 3, h, m).getTime();
const rec = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'p', updatedAt: t, ...extra });
const lines = (records) => Csv.toCsv(records).trim().split('\n');

test('the first 22 columns are the prototype\'s, in order, and new ones come after', () => {
  const header = lines([])[0].split(',');
  assert.equal(header.slice(0, 22).join(','), 'date,time,start_iso,type,duration_min,pee_amount,poop_colour,poop_texture,poop_size,feed_kind,feed_side,feed_milk,feed_ml,feed_minutes,sleep_place,cry_level,cry_helped,weight_g,height_cm,head_cm,note,logged_by');
  assert.equal(header.slice(22).join(','), 'feed_left_min,feed_right_min,sleep_source,baby_id,baby');
});

test('one row per entry, oldest first; removed entries and the profile are left out', () => {
  const rows = lines([
    rec('b', 'pee', at(14, 40)),
    rec('a', 'poop', at(9, 5), { note: 'first' }),
    rec('c', 'feed', at(12), { deleted: true }),
    rec('p', 'profile', at(1), { d: { nickname: 'Bean' } })
  ]);
  assert.equal(rows.length, 3, 'a header and two rows');
  assert.match(rows[1], /^2026-10-03,09:05,.*,poop,/);
  assert.match(rows[2], /^2026-10-03,14:40,.*,pee,/);
});

test('feed, sleep: the fields land in the right columns', () => {
  const header = lines([])[0].split(',');
  const col = (row, name) => row.split(',')[header.indexOf(name)];
  const feed = lines([rec('f', 'feed', at(15, 2), { d: { kind: 'Breast', side: 'Both', min: 20, leftMin: 8, rightMin: 12 } })])[1];
  assert.equal(col(feed, 'feed_kind'), 'Breast');
  assert.equal(col(feed, 'feed_side'), 'Both');
  assert.equal(col(feed, 'feed_minutes'), '20');
  assert.equal(col(feed, 'duration_min'), '20');
  assert.equal(col(feed, 'feed_left_min'), '8');
  assert.equal(col(feed, 'feed_right_min'), '12');
  const bottle = lines([rec('b', 'feed', at(11, 50), { d: { kind: 'Bottle', milk: 'Formula', ml: 90 } })])[1];
  assert.equal(col(bottle, 'feed_ml'), '90');
  assert.equal(col(bottle, 'feed_milk'), 'Formula');
  const sleep = lines([rec('s', 'sleep', at(12), { end: at(13, 40), d: { source: 'manual' } })])[1];
  assert.equal(col(sleep, 'duration_min'), '100');
  assert.equal(col(sleep, 'sleep_source'), 'manual');
  const running = lines([rec('r', 'sleep', at(12), { d: { source: 'live' } })])[1];
  assert.equal(col(running, 'duration_min'), '', 'a sleep still running has no length yet');
});

test('notes with commas, quotes and line breaks are quoted', () => {
  const row = Csv.toCsv([rec('a', 'pee', at(10), { note: 'wet, "a lot"\nnext line', by: 'Mum' })]);
  assert.match(row, /"wet, ""a lot""\nnext line",Mum/);
});

test('every row names its baby; an entry from before feature 014 has none; unreadable entries are left out', () => {
  const header = lines([])[0].split(',');
  const col = (row, name) => row.split(',')[header.indexOf(name)];
  const rows = lines([
    rec('baby-2', 'profile', at(1), { v: 2, babyId: 'baby-2', d: { nickname: 'Pip' } }),
    rec('profile', 'profile', at(1), { d: { nickname: 'Bean' } }),
    rec('a', 'pee', at(9)),
    rec('b', 'poop', at(10), { v: 2, babyId: 'baby-2' }),
    rec('c', 'feed', at(11), { v: 3, babyId: 'baby-3' }),          // from a newer version of the app
    rec('d', 'feed', 'noon')                                        // broken
  ]);
  assert.equal(rows.length, 3, 'a header and two rows');
  assert.deepEqual([col(rows[1], 'baby_id'), col(rows[1], 'baby')], ['', ''], 'no baby is guessed');
  assert.deepEqual([col(rows[2], 'baby_id'), col(rows[2], 'baby')], ['baby-2', 'Pip']);
});
