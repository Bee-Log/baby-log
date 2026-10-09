// Records (feature 005 and the data rules in app-rules.md) and the storage safeguards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'baby-log-rec-'));
const out = { test: build({ env: 'test', out: join(tmp, 'test'), version: 't1' }), live: build({ env: 'live', out: join(tmp, 'live'), version: 't1' }) };

function load(env, files) {
  const sandbox = { self: {} };
  for (const f of files) vm.runInNewContext(readFileSync(join(out[env], f), 'utf8'), sandbox);
  return sandbox.self;
}
const R = load('test', ['records.js']).BABYLOG_RECORDS;
const plain = (v) => JSON.parse(JSON.stringify(v)); // objects from the sandbox, compared as data

const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime(); // local time, 3 Oct 2026

test('a new record has exactly the fields in app-rules.md', () => {
  const r = R.makeRecord({ id: 'a1', type: 'pee', babyId: 'baby-1', t: at(9), now: at(9), deviceId: 'phone-1' });
  assert.deepEqual(plain(r), { v: 2, id: 'a1', type: 'pee', babyId: 'baby-1', t: at(9), end: null, d: {}, note: '', by: '', deviceId: 'phone-1', updatedAt: at(9) });
  assert.ok(!('deleted' in r), 'live records have no deleted field');
});

test('bad records are refused', () => {
  const ok = { id: 'a', type: 'poop', babyId: 'b', t: 1, now: 1, deviceId: 'p' };
  assert.throws(() => R.makeRecord({ ...ok, type: 'nappy' }), /Unknown record type/);
  assert.throws(() => R.makeRecord({ ...ok, id: '' }), /id/);
  assert.throws(() => R.makeRecord({ ...ok, deviceId: undefined }), /deviceId/);
  assert.throws(() => R.makeRecord({ ...ok, babyId: '' }), /babyId/, 'every entry belongs to a baby (feature 014)');
  assert.throws(() => R.makeRecord({ ...ok, t: NaN }), /ms/);
});

test('delete makes a tombstone; updatedAt always moves forward', () => {
  const r = R.makeRecord({ id: 'a', type: 'pee', babyId: 'b', t: at(9), now: at(9), deviceId: 'p' });
  const gone = R.tombstone(r, at(9, 1));
  assert.equal(gone.deleted, true);
  assert.equal(gone.updatedAt, at(9, 1));
  assert.equal(gone.t, r.t);
  assert.ok(!('deleted' in r), 'the original is not changed');
  // A phone clock that went backwards must still produce a newer record, or sync would keep the live one.
  assert.equal(R.tombstone(r, at(8)).updatedAt, r.updatedAt + 1);
});

test('"today" runs from 6 am to 6 am', () => {
  assert.deepEqual(plain(R.dayWindow(at(9))), { from: at(6), to: at(6, 0, 4) });
  assert.deepEqual(plain(R.dayWindow(at(6))), { from: at(6), to: at(6, 0, 4) });
  assert.deepEqual(plain(R.dayWindow(at(5, 59))), { from: at(6, 0, 2), to: at(6) }, 'before 6 am belongs to the day before');
  assert.deepEqual(plain(R.dayWindow(at(23, 59))), { from: at(6), to: at(6, 0, 4) });
});

test('nappy rows: a wee and a poo close together are one row; records stay separate', () => {
  const rec = (id, type, t, extra = {}) => ({ id, type, t, ...extra });
  const rows = plain(R.nappyRows([
    rec('1', 'pee', at(7)),
    rec('2', 'poop', at(7, 1)),            // within 2 minutes of the wee -> same nappy
    rec('3', 'pee', at(9)),
    rec('4', 'pee', at(9, 1)),             // two wees are never merged
    rec('5', 'poop', at(11)),
    rec('6', 'pee', at(11, 5)),            // more than 2 minutes -> separate
    rec('7', 'poop', at(12), { deleted: true }),
    rec('8', 'feed', at(12, 30))
  ]));
  assert.deepEqual(rows.map((r) => [R.formatClock(r.t), R.nappyLabel(r), r.ids.join('+')]), [
    ['11:05 am', 'Wee', '6'],
    ['11:00 am', 'Poo', '5'],
    ['9:01 am', 'Wee', '4'],
    ['9:00 am', 'Wee', '3'],
    ['7:00 am', 'Wee + Poo', '1+2']
  ]);
  assert.deepEqual(plain(R.nappyRows([])), []);
});

test('clock times read like the design', () => {
  assert.equal(R.formatClock(at(0, 5)), '12:05 am');
  assert.equal(R.formatClock(at(12)), '12:00 pm');
  assert.equal(R.formatClock(at(15, 2)), '3:02 pm');
});

test('storage names are fixed per build, and anything else is refused', () => {
  const name = (env) => load(env, ['config.js', 'store.js']).BABYLOG_STORE.dbNameFor(load(env, ['config.js']).BABYLOG_CONFIG);
  assert.equal(name('test'), 'test-baby-log');
  assert.equal(name('live'), 'baby-log');
  const store = load('live', ['config.js', 'store.js']).BABYLOG_STORE;
  assert.throws(() => store.dbNameFor({ env: 'test', storagePrefix: '' }), /Refusing/, 'a test build may never use the live name');
  assert.throws(() => store.dbNameFor({ env: 'live', storagePrefix: 'test-' }), /Refusing/);
});

test('no code lists or deletes databases (shared origin safeguard)', () => {
  const src = new URL('../src/', import.meta.url).pathname;
  for (const f of readdirSync(src).filter((n) => n.endsWith('.js'))) {
    const code = readFileSync(join(src, f), 'utf8');
    assert.doesNotMatch(code, /deleteDatabase|indexedDB\.databases|\.clear\(\)/, f);
    if (f !== 'store.js') assert.doesNotMatch(code, /indexedDB/, `${f}: only store.js may touch storage`);
  }
});

test('dateTimeValue and parseDateTime turn a moment into a datetime-local value and back, in local time', () => {
  assert.equal(R.dateTimeValue(at(14, 5)), '2026-10-03T14:05');
  assert.equal(R.dateTimeValue(at(0, 7, 9)), '2026-10-09T00:07');
  assert.equal(R.parseDateTime('2026-10-03T14:05'), at(14, 5));
  assert.equal(R.parseDateTime('2026-10-03T14:05:30'), at(14, 5), 'seconds are ignored');
  for (const t of [at(1, 30), at(23, 59, 31), new Date(2026, 0, 1, 0, 0).getTime()]) assert.equal(R.parseDateTime(R.dateTimeValue(t)), t);
});

test('parseDateTime refuses text that is not a real date and time', () => {
  for (const bad of ['', null, undefined, 'x', '2026-10-03', '14:05', '2026-02-31T10:00', '2026-13-01T10:00', '2026-10-03T24:00', '2026-10-03T10:60']) {
    assert.equal(R.parseDateTime(bad), null, String(bad));
  }
});

test('isFuture allows 5 minutes ahead and no more', () => {
  const now = at(14);
  assert.equal(R.isFuture(now + 5 * 60000, now), false);
  assert.equal(R.isFuture(now + 5 * 60000 + 1, now), true);
  assert.equal(R.isFuture(now - 3 * 86400000, now), false, 'any day in the past is fine');
});
