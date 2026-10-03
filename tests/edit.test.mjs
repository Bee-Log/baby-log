// Feature 011: editing helpers (revise, restore, time inside a day) and the #edit route.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-edit-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['nav.js', 'records.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_RECORDS: R, BABYLOG_NAV: nav } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime(); // local time, 3 Oct 2026
const feed = { id: 'f1', type: 'feed', t: at(9), end: null, d: { kind: 'Bottle', milk: 'Formula', ml: 90, extra: 'kept' }, note: '', by: '', deviceId: 'phone-A', updatedAt: at(9) };

test('revise: same id, new values, newer updatedAt, this phone', () => {
  const r = R.revise(feed, { t: at(8, 45), d: { kind: 'Bottle', milk: 'Breast milk', ml: 120 } }, at(10), 'phone-B');
  assert.equal(r.id, 'f1');
  assert.equal(r.type, 'feed');
  assert.equal(r.t, at(8, 45));
  assert.deepEqual(plain(r.d), { kind: 'Bottle', milk: 'Breast milk', ml: 120 });
  assert.equal(r.updatedAt, at(10));
  assert.equal(r.deviceId, 'phone-B');
  assert.equal(r.note, '', 'a field that is not changed stays');
  assert.equal(feed.d.ml, 90, 'the original is not touched');
  assert.ok(!('deleted' in r));
});

test('revise: updatedAt moves forward even if this phone clock is behind', () => {
  assert.equal(R.revise(feed, { note: 'x' }, at(7), 'phone-B').updatedAt, feed.updatedAt + 1);
});

test('hh:mm for the time field', () => {
  assert.equal(R.hhmm(at(9, 5)), '09:05');
  assert.equal(R.hhmm(at(0, 0)), '00:00');
  assert.equal(R.hhmm(at(23, 59)), '23:59');
});

test('timeInDay: stays inside the 6 am to 6 am day of the entry', () => {
  const evening = at(21, 0);                       // the day that began 6 am on 3 Oct
  assert.equal(R.timeInDay(evening, '19:30'), at(19, 30));
  assert.equal(R.timeInDay(evening, '06:00'), at(6, 0));
  assert.equal(R.timeInDay(evening, '23:59'), at(23, 59));
  assert.equal(R.timeInDay(evening, '00:30'), at(0, 30, 4), 'after midnight is the next calendar day');
  assert.equal(R.timeInDay(evening, '05:59'), at(5, 59, 4));
  const night = at(1, 15, 4);                      // still the day that began 6 am on 3 Oct
  assert.equal(R.timeInDay(night, '23:00'), at(23, 0, 3), 'an entry after midnight can move to before midnight');
  assert.equal(R.timeInDay(night, '02:00'), at(2, 0, 4));
  for (const bad of ['', '24:00', '12:60', 'noon', null, undefined]) assert.equal(R.timeInDay(evening, bad), null, String(bad));
});

test('#edit/<ids> opens the Edit screen; #edit alone does not', () => {
  assert.equal(nav.screenFromHash('#edit/abc'), 'edit');
  assert.equal(nav.argFromHash('#edit/abc+def'), 'abc+def');
  assert.equal(nav.screenFromHash('#edit'), null);
  assert.equal(nav.screenFromHash('#edit/'), null);
  assert.equal(nav.argFromHash('#today'), '');
  assert.equal(nav.screenFromHash('#feed'), 'feed');
  assert.equal(nav.tabFromHash('#edit/abc'), 'today');
});
