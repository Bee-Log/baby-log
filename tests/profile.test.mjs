// Feature 002: the baby profile record, its rules, and the age text (src/profile.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-profile-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['records.js', 'schema.js', 'profile.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_PROFILE: Pr, BABYLOG_RECORDS: R } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const fields = { nickname: '  Bean ', dateOfBirth: '2026-09-12', sex: 'girl', photo: '' };
const NOW = new Date(2026, 9, 3, 14, 0).getTime();

test('a new profile is one record of type profile; its id is the baby id', () => {
  const rec = Pr.toRecord(null, fields, NOW, 'phone-a', 'baby-1');
  assert.equal(rec.id, 'baby-1');
  assert.equal(rec.babyId, 'baby-1');
  assert.equal(rec.v, 2);
  assert.equal(rec.type, 'profile');
  assert.deepEqual(plain(rec.d), { nickname: 'Bean', dateOfBirth: '2026-09-12', sex: 'girl', photo: '' });
  assert.equal(rec.updatedAt, NOW);
  assert.equal(rec.deviceId, 'phone-a');
});

test('saving again keeps the id and moves updatedAt forward, and keeps unknown fields', () => {
  const made = Pr.toRecord(null, fields, NOW, 'phone-a', 'baby-1');
  const first = { ...made, d: { ...made.d, extra: 1 } };
  const next = Pr.toRecord(first, { ...fields, nickname: 'Beanie' }, NOW - 5000, 'phone-b', 'other');   // even if the clock went back
  assert.equal(next.id, 'baby-1');
  assert.equal(next.babyId, 'baby-1');
  assert.equal(next.d.nickname, 'Beanie');
  assert.equal(next.d.extra, 1);
  assert.ok(next.updatedAt > first.updatedAt, 'the merge rule (newest updatedAt wins) carries the change');
  assert.equal(next.deviceId, 'phone-b');
});

test('the nickname is cut to 20 characters', () => {
  const rec = Pr.toRecord(null, { ...fields, nickname: 'x'.repeat(40) }, NOW, 'p', 'b');
  assert.equal(rec.d.nickname.length, 20);
});

test('finding a baby\'s profile among other entries; removed ones are ignored', () => {
  const profile = Pr.toRecord(null, fields, NOW, 'p', 'baby-1');
  const other = Pr.toRecord(null, { ...fields, nickname: 'Pip' }, NOW, 'p', 'baby-2');
  const feed = { id: 'f', type: 'feed', t: 1, end: null, d: {}, note: '', by: '', deviceId: 'p', updatedAt: 1 };
  assert.equal(Pr.current([feed, profile, other], 'baby-1').d.nickname, 'Bean');
  assert.equal(Pr.current([feed, profile, other], 'baby-2').d.nickname, 'Pip');
  assert.equal(Pr.current([feed], 'baby-1'), null);
  assert.equal(Pr.current([{ ...profile, deleted: true }], 'baby-1'), null);
});

// Feature 014: more than one baby.
const entry = (id, type, extra = {}) => ({ v: 2, id, type, babyId: 'baby-1', t: NOW, end: null, d: {}, note: '', by: '', deviceId: 'p', updatedAt: NOW, ...extra });
const legacy = (id, type, extra = {}) => ({ id, type, t: NOW, end: null, d: {}, note: '', by: '', deviceId: 'p', updatedAt: NOW, ...extra });

test('the babies: one per profile, oldest first, with how many entries each has', () => {
  const bean = Pr.toRecord(null, fields, NOW, 'p', 'baby-1');
  const pip = Pr.toRecord(null, { ...fields, nickname: 'Pip' }, NOW - 1000, 'p', 'baby-2');
  const list = Pr.babies([bean, pip, entry('f1', 'feed'), entry('f2', 'feed', { deleted: true }), entry('n1', 'pee', { babyId: 'baby-2' })]);
  assert.deepEqual(plain(list.map((b) => [b.id, b.profile.d.nickname, b.entries])), [['baby-2', 'Pip', 1], ['baby-1', 'Bean', 1]]);
});

test('entries from before feature 014 belong to the first profile (id "profile"), or show as a baby without details', () => {
  const old = legacy('f1', 'feed');
  const first = legacy('profile', 'profile', { d: { nickname: 'Bean' } });   // a profile saved before 014: no v, no babyId
  assert.deepEqual(plain(Pr.babies([old, first]).map((b) => [b.id, !!b.profile, b.entries])), [['profile', true, 1]]);
  assert.deepEqual(plain(Pr.babies([old, legacy('n1', 'pee')]).map((b) => [b.id, b.profile, b.entries])), [['profile', null, 2]]);
});

test('entries that cannot be read do not make a baby', () => {
  assert.deepEqual(plain(Pr.babies([entry('x', 'feed', { v: 3, babyId: 'future' }), entry('y', 'feed', { t: 'soon' })])), []);
});

test('pick: the baby chosen last time, else the only baby; otherwise ask (null)', () => {
  const named = (id) => ({ id, profile: { id }, entries: 0 });
  const unnamed = (id) => ({ id, profile: null, entries: 3 });
  assert.equal(Pr.pick([named('a'), named('b')], 'b'), 'b');
  assert.equal(Pr.pick([named('a')], null), 'a', 'one baby opens by itself');
  assert.equal(Pr.pick([named('a'), named('b')], null), null, 'two babies: ask');
  assert.equal(Pr.pick([named('a'), named('b')], 'gone'), null, 'the saved baby is not here: ask');
  assert.equal(Pr.pick([], null), null, 'no baby: ask');
  assert.equal(Pr.pick([unnamed('profile')], null), null, 'a baby without details is never opened by itself');
  assert.equal(Pr.pick([named('a'), unnamed('profile')], null), null, 'entries without details are shown before going on');
  assert.equal(Pr.pick([named('a'), unnamed('profile')], 'a'), 'a');
});

test('details are safe when a record from another phone lacks fields', () => {
  assert.deepEqual(plain(Pr.details(null)), { nickname: '', dateOfBirth: '', sex: '', photo: '' });
  assert.deepEqual(plain(Pr.details({ d: { nickname: 5, dateOfBirth: 'soon', sex: 'x', photo: null } })), { nickname: '', dateOfBirth: '', sex: '', photo: '' });
});

test('the profile is complete only with a nickname, a date of birth and a sex', () => {
  assert.equal(Pr.isComplete(fields), true);
  assert.equal(Pr.isComplete({ ...fields, nickname: '   ' }), false);
  assert.equal(Pr.isComplete({ ...fields, dateOfBirth: '' }), false);
  assert.equal(Pr.isComplete({ ...fields, sex: '' }), false);
  assert.equal(Pr.isComplete({ ...fields, photo: '' }), true, 'the photo is optional');
});

test('age text counts calendar days, then weeks, then months', () => {
  const age = (dob) => Pr.ageText(dob, NOW);
  assert.equal(age('2026-10-03'), 'Born today');
  assert.equal(age('2026-10-02'), '1 day old');
  assert.equal(age('2026-09-25'), '8 days old');
  assert.equal(age('2026-09-19'), '2 weeks old');
  assert.equal(age('2026-09-12'), '3 weeks old');
  assert.equal(age('2026-08-10'), '7 weeks old');
  assert.equal(age('2026-08-08'), '1 month old');
  assert.equal(age('2026-08-03'), '2 months old');
  assert.equal(age('2025-12-04'), '9 months old');
  assert.equal(age('2025-10-03'), '12 months old');
  assert.equal(age('2025-09-03'), '13 months old');
  assert.equal(age('2024-10-03'), '2 years old');
  assert.equal(age('2026-10-10'), 'Not born yet');
  assert.equal(age(''), '');
});

test('the name falls back to a placeholder', () => {
  assert.equal(Pr.displayName(''), '[Nickname]');
  assert.equal(Pr.displayName('  Bean'), 'Bean');
});

test('a profile record passes through the usual record checks', () => {
  assert.ok(R.TYPES.includes('profile'));
});
