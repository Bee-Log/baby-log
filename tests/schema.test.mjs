// Feature 014: the record format version, which baby an entry belongs to, and which entries can be shown (src/schema.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-schema-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['records.js', 'schema.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_SCHEMA: Sc, BABYLOG_RECORDS: R } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const T = new Date(2026, 9, 3, 9, 0).getTime();
const v2 = (extra = {}) => ({ v: 2, id: 'a', type: 'feed', babyId: 'baby-1', t: T, end: null, d: { kind: 'Bottle', ml: 90 }, note: '', by: '', deviceId: 'p', updatedAt: T, ...extra });
const v1 = (extra = {}) => ({ id: 'a', type: 'feed', t: T, end: null, d: {}, note: '', by: '', deviceId: 'p', updatedAt: T, ...extra });

test('a new entry is version 2 and passes the check', () => {
  const rec = R.makeRecord({ id: 'a', type: 'pee', babyId: 'baby-1', t: T, now: T, deviceId: 'p' });
  assert.equal(rec.v, Sc.VERSION);
  assert.equal(Sc.problem(rec), null);
  assert.equal(Sc.problem(v2()), null);
});

test('entries from before feature 014 (no v, no babyId) are readable but belong to no baby; a profile is its own baby', () => {
  assert.equal(Sc.problem(v1()), null);
  assert.equal(Sc.babyOf(v1()), null, 'no babyId, no baby: it is never shown under a baby by guessing');
  assert.equal(Sc.problem(v1({ id: 'profile', type: 'profile' })), null, 'the first profile');
  assert.equal(Sc.babyOf(v1({ id: 'profile', type: 'profile' })), 'profile');
  assert.equal(Sc.babyOf(v2()), 'baby-1');
});

test('an entry from a newer version of the app is kept aside as "newer", whatever it holds', () => {
  assert.equal(Sc.problem(v2({ v: 3 })), 'newer');
  assert.equal(Sc.problem(v2({ v: 3, type: 'pump', t: 'later' })), 'newer');
});

test('entries with missing or wrong fields are "invalid"', () => {
  const bad = {
    'no id': v2({ id: '' }),
    'unknown type': v2({ type: 'nappy' }),
    't is not a number': v2({ t: '09:00' }),
    'no updatedAt': v2({ updatedAt: undefined }),
    'no deviceId': v2({ deviceId: '' }),
    'end is text': v2({ end: 'later' }),
    'details are a list': v2({ d: [] }),
    'note is a number': v2({ note: 5 }),
    'deleted is text': v2({ deleted: 'yes' }),
    'version 2 without a baby': v2({ babyId: undefined }),
    'babyId is a number': v2({ babyId: 7 }),
    'a profile of another baby': v2({ id: 'baby-2', type: 'profile', babyId: 'baby-1' }),
    'version is text': v2({ v: '2' }),
    'not an object': null
  };
  for (const [why, rec] of Object.entries(bad)) assert.equal(Sc.problem(rec), 'invalid', why);
});

test('fields this version does not know are allowed, so a later version can add some', () => {
  assert.equal(Sc.problem(v2({ mood: 'happy', d: { kind: 'Bottle', ml: 90, warm: true } })), null);
});

test('forBaby gives only the readable entries of one baby; unreadable gives the counts', () => {
  const records = [
    v2({ id: 'a' }), v2({ id: 'b', babyId: 'baby-2' }), v1({ id: 'c' }),
    v2({ id: 'd', deleted: true }), v2({ id: 'e', v: 3 }), v2({ id: 'f', t: NaN })
  ];
  assert.deepEqual(plain(Sc.forBaby(records, 'baby-1').map((r) => r.id)), ['a', 'd']);
  assert.deepEqual(plain(Sc.forBaby(records, 'profile').map((r) => r.id)), [], 'an entry without a babyId belongs to no baby');
  assert.deepEqual(plain(Sc.unreadable(records)), { newer: 1, invalid: 1 });
});

test('unlinked: the live, readable entries without a baby, oldest first', () => {
  const records = [v1({ id: 'late', t: T + 1000 }), v1({ id: 'early' }), v1({ id: 'gone', deleted: true }), v1({ id: 'profile', type: 'profile' }),
    v2({ id: 'mine' }), v1({ id: 'broken', t: 'x' })];
  assert.deepEqual(plain(Sc.unlinked(records).map((r) => r.id)), ['early', 'late']);
});

test('linking an entry to a baby: same id, version 2, the baby, this phone, a newer updatedAt', () => {
  const old = v1({ id: 'w1', type: 'pee' });
  const linked = R.linkToBaby(old, 'baby-1', T - 5000, 'phone-b');
  assert.deepEqual(plain(linked), { ...old, v: 2, babyId: 'baby-1', deviceId: 'phone-b', updatedAt: T + 1 });
  assert.equal(Sc.problem(linked), null);
  assert.equal(Sc.babyOf(linked), 'baby-1');
  assert.ok(R.isNewer(linked, old), 'the merge rule carries it to the other phone');
});
