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
for (const f of ['records.js', 'profile.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_PROFILE: Pr, BABYLOG_RECORDS: R } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const fields = { nickname: '  Bean ', dateOfBirth: '2026-09-12', sex: 'girl', photo: '' };
const NOW = new Date(2026, 9, 3, 14, 0).getTime();

test('a new profile is one record of type profile with a fixed id', () => {
  const rec = Pr.toRecord(null, fields, NOW, 'phone-a');
  assert.equal(rec.id, 'profile');
  assert.equal(rec.type, 'profile');
  assert.deepEqual(plain(rec.d), { nickname: 'Bean', dateOfBirth: '2026-09-12', sex: 'girl', photo: '' });
  assert.equal(rec.updatedAt, NOW);
  assert.equal(rec.deviceId, 'phone-a');
});

test('saving again keeps the id and moves updatedAt forward, and keeps unknown fields', () => {
  const first = { ...Pr.toRecord(null, fields, NOW, 'phone-a'), d: { ...Pr.toRecord(null, fields, NOW, 'phone-a').d, extra: 1 } };
  const next = Pr.toRecord(first, { ...fields, nickname: 'Beanie' }, NOW - 5000, 'phone-b');   // even if the clock went back
  assert.equal(next.id, 'profile');
  assert.equal(next.d.nickname, 'Beanie');
  assert.equal(next.d.extra, 1);
  assert.ok(next.updatedAt > first.updatedAt, 'the merge rule (newest updatedAt wins) carries the change');
  assert.equal(next.deviceId, 'phone-b');
});

test('the nickname is cut to 20 characters', () => {
  const rec = Pr.toRecord(null, { ...fields, nickname: 'x'.repeat(40) }, NOW, 'p');
  assert.equal(rec.d.nickname.length, 20);
});

test('finding the profile among other entries; removed ones are ignored', () => {
  const profile = Pr.toRecord(null, fields, NOW, 'p');
  const feed = { id: 'f', type: 'feed', t: 1, end: null, d: {}, note: '', by: '', deviceId: 'p', updatedAt: 1 };
  assert.equal(Pr.current([feed, profile]).id, 'profile');
  assert.equal(Pr.current([feed]), null);
  assert.equal(Pr.current([{ ...profile, deleted: true }]), null);
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
