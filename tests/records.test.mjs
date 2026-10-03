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
  const r = R.makeRecord({ id: 'a1', type: 'pee', t: at(9), now: at(9), deviceId: 'phone-1' });
  assert.deepEqual(plain(r), { id: 'a1', type: 'pee', t: at(9), end: null, d: {}, note: '', by: '', deviceId: 'phone-1', updatedAt: at(9) });
  assert.ok(!('deleted' in r), 'live records have no deleted field');
});

test('bad records are refused', () => {
  const ok = { id: 'a', type: 'poop', t: 1, now: 1, deviceId: 'p' };
  assert.throws(() => R.makeRecord({ ...ok, type: 'nappy' }), /Unknown record type/);
  assert.throws(() => R.makeRecord({ ...ok, id: '' }), /id/);
  assert.throws(() => R.makeRecord({ ...ok, deviceId: undefined }), /deviceId/);
  assert.throws(() => R.makeRecord({ ...ok, t: NaN }), /ms/);
});

test('undo makes a tombstone; updatedAt always moves forward', () => {
  const r = R.makeRecord({ id: 'a', type: 'pee', t: at(9), now: at(9), deviceId: 'p' });
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
