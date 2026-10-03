// ADR-001: the merge rule, the JSONL files, and the push / pull engine (src/sync.js), with a fake in-memory Drive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-sync-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['records.js', 'sync.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_SYNC: Sync, BABYLOG_RECORDS: R } = sandbox.self;

const plain = (v) => JSON.parse(JSON.stringify(v));    // values made inside the sandbox have their own Array type
const rec = (id, deviceId, updatedAt, extra = {}) => ({ id, type: 'feed', t: 1000, end: null, d: { kind: 'Bottle', ml: 60 }, note: '', by: '', deviceId, updatedAt, ...extra });

// A fake Drive: files by name, a version that goes up on every write. `down` makes every call fail like a lost network.
function fakeDrive() {
  const files = new Map();
  let counter = 0;
  const drive = {
    down: false, writes: 0,
    list: async () => { if (drive.down) throw Object.assign(new Error('offline'), { code: 'offline' }); return [...files].map(([name, f]) => ({ name, version: f.version })); },
    read: async (name) => { if (drive.down) throw Object.assign(new Error('offline'), { code: 'offline' }); return files.has(name) ? files.get(name).text : null; },
    write: async (name, text) => { if (drive.down) throw Object.assign(new Error('offline'), { code: 'offline' }); drive.writes++; const version = String(++counter); files.set(name, { text, version }); return version; },
    files
  };
  return drive;
}

// A fake phone store with the same functions the engine uses.
function fakeStore() {
  const records = new Map(), meta = new Map();
  return {
    records,
    all: async () => [...records.values()],
    put: (r) => records.set(r.id, r),
    mergeIn: async (incoming) => { let n = 0; for (const r of incoming) { const have = records.get(r.id); if (!have || R.isNewer(r, have)) { records.set(r.id, r); n++; } } return n; },
    getMeta: async (k) => (meta.has(k) ? JSON.parse(JSON.stringify(meta.get(k))) : null),
    setMeta: async (k, v) => { meta.set(k, JSON.parse(JSON.stringify(v))); }
  };
}
const phone = (drive, deviceId, root = 'baby-log') => {
  const store = fakeStore();
  return { store, sync: Sync.create({ backend: drive, store, root, deviceId }), deviceId };
};

// ---- The merge rule ----
test('merge rule: the larger updatedAt wins; on a tie the higher deviceId wins', () => {
  assert.equal(R.isNewer(rec('a', 'x', 10), rec('a', 'x', 9)), true);
  assert.equal(R.isNewer(rec('a', 'x', 9), rec('a', 'x', 10)), false);
  assert.equal(R.isNewer(rec('a', 'b-phone', 10), rec('a', 'a-phone', 10)), true);
  assert.equal(R.isNewer(rec('a', 'a-phone', 10), rec('a', 'b-phone', 10)), false);
});

test('a tombstone with a newer updatedAt wins over a live entry, and an older one loses', () => {
  const live = rec('a', 'x', 10), gone = rec('a', 'y', 20, { deleted: true });
  assert.equal(R.isNewer(gone, live), true);
  assert.equal(R.isNewer({ ...gone, updatedAt: 5 }, live), false);
});

// ---- Files ----
test('file names follow the ADR layout, and TEST and LIVE roots never match each other', () => {
  assert.equal(Sync.ownFileName('baby-log', 'abc'), 'baby-log/devices/abc.jsonl');
  assert.equal(Sync.isDeviceFile('baby-log', 'baby-log/devices/abc.jsonl'), true);
  assert.equal(Sync.isDeviceFile('baby-log', 'baby-log-test/devices/abc.jsonl'), false);
  assert.equal(Sync.isDeviceFile('baby-log-test', 'baby-log/devices/abc.jsonl'), false);
  assert.equal(Sync.isDeviceFile('baby-log', 'baby-log/devices/abc.txt'), false);
  assert.equal(Sync.isDeviceFile('baby-log', 'baby-log/other.jsonl'), false);
});

test('JSONL: one record per line, round trip, and bad lines are skipped', () => {
  const records = [rec('a', 'x', 1), rec('b', 'x', 2, { deleted: true })];
  const text = Sync.toJsonl(records);
  assert.equal(text.trim().split('\n').length, 2);
  assert.deepEqual(plain(Sync.parseJsonl(text)), records);
  assert.deepEqual(plain(Sync.parseJsonl(text + '\nnot json\n{"no":"id"}\n\n   \n{"id":"c","updatedAt":"late"}\n').map((r) => r.id)), ['a', 'b']);
  assert.equal(Sync.toJsonl([]), '');
  assert.deepEqual(plain(Sync.parseJsonl(null)), []);
});

test('compaction keeps the newest line per id', () => {
  const lines = Sync.newestById([rec('a', 'x', 1), rec('b', 'x', 1), rec('a', 'x', 3, { note: 'new' }), rec('a', 'x', 2)]);
  assert.deepEqual(plain(lines.map((r) => [r.id, r.updatedAt])), [['a', 3], ['b', 1]]);
});

// ---- Push ----
test('push writes our own entries to our own file, and only ours', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a');
  a.store.put(rec('1', 'phone-a', 10));
  a.store.put(rec('2', 'phone-b', 10));                    // came from another phone: not ours to write
  assert.deepEqual(plain(await a.sync.push()), { pushed: 1 });
  assert.deepEqual([...drive.files.keys()], ['baby-log/devices/phone-a.jsonl']);
  assert.deepEqual(plain(Sync.parseJsonl(drive.files.get('baby-log/devices/phone-a.jsonl').text).map((r) => r.id)), ['1']);
});

test('push sends only what changed, and does nothing when nothing changed', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a');
  a.store.put(rec('1', 'phone-a', 10));
  await a.sync.push();
  const writes = drive.writes;
  assert.deepEqual(plain(await a.sync.push()), { pushed: 0 });
  assert.equal(drive.writes, writes, 'no new write');
  a.store.put(rec('1', 'phone-a', 20, { note: 'edited' }));   // an edit: same id, newer updatedAt
  a.store.put(rec('2', 'phone-a', 21));
  assert.deepEqual(plain(await a.sync.push()), { pushed: 2 });
  const lines = Sync.parseJsonl(drive.files.get('baby-log/devices/phone-a.jsonl').text);
  assert.deepEqual(plain(lines.map((r) => [r.id, r.updatedAt])), [['1', 20], ['2', 21]], 'one line per entry: the file is compacted');
});

test('a phone whose clock went back still sends a new entry (push compares with the file, not with a time)', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a');
  a.store.put(rec('1', 'phone-a', 5000));
  await a.sync.push();
  a.store.put(rec('2', 'phone-a', 100));                       // the clock moved back
  assert.deepEqual(plain(await a.sync.push()), { pushed: 1 });
  assert.equal(Sync.parseJsonl(drive.files.get('baby-log/devices/phone-a.jsonl').text).length, 2);
});

// ---- Pull ----
test('two phones see each other\'s entries', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a'), b = phone(drive, 'phone-b');
  a.store.put(rec('1', 'phone-a', 10));
  b.store.put(rec('2', 'phone-b', 11));
  await a.sync.sync();
  await b.sync.sync();
  await a.sync.sync();
  assert.deepEqual([...a.store.records.keys()].sort(), ['1', '2']);
  assert.deepEqual([...b.store.records.keys()].sort(), ['1', '2']);
});

test('pull reads only the files that changed', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a'), b = phone(drive, 'phone-b');
  b.store.put(rec('2', 'phone-b', 11));
  await b.sync.push();
  assert.deepEqual(plain(await a.sync.pull()), { files: 1, merged: 1 });
  assert.deepEqual(plain(await a.sync.pull()), { files: 0, merged: 0 }, 'nothing new, nothing read');
  b.store.put(rec('3', 'phone-b', 12));
  await b.sync.push();
  assert.deepEqual(plain(await a.sync.pull()), { files: 1, merged: 1 }, 'the file changed so it is read again; only the new entry counts');
});

test('an edit and a delete on one phone reach the other; the newest change wins', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a'), b = phone(drive, 'phone-b');
  a.store.put(rec('1', 'phone-a', 10));
  await a.sync.sync(); await b.sync.sync();
  b.store.put(rec('1', 'phone-b', 20, { note: 'fixed by b' }));          // b edits a's entry
  await b.sync.sync(); await a.sync.sync();
  assert.equal(a.store.records.get('1').note, 'fixed by b');
  a.store.put(rec('1', 'phone-a', 30, { deleted: true }));               // then a deletes it
  await a.sync.sync(); await b.sync.sync();
  assert.equal(b.store.records.get('1').deleted, true);
});

test('both phones edit the same entry: they end up the same, whoever syncs first', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a'), b = phone(drive, 'phone-b');
  a.store.put(rec('1', 'phone-a', 10));
  await a.sync.sync(); await b.sync.sync();
  a.store.put(rec('1', 'phone-a', 50, { note: 'a' }));
  b.store.put(rec('1', 'phone-b', 50, { note: 'b' }));                   // the same updatedAt: the higher deviceId wins
  await a.sync.sync(); await b.sync.sync(); await a.sync.sync(); await b.sync.sync();
  assert.equal(a.store.records.get('1').note, 'b');
  assert.equal(b.store.records.get('1').note, 'b');
});

test('a new or reset phone restores everything, its own entries too', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a'), b = phone(drive, 'phone-b');
  a.store.put(rec('1', 'phone-a', 10));
  b.store.put(rec('2', 'phone-b', 11));
  await a.sync.sync(); await b.sync.sync();
  const fresh = phone(drive, 'phone-a');                                  // phone a lost its data but kept its id (signed in again)
  assert.deepEqual(plain(await fresh.sync.sync()), { pushed: 0, files: 2, merged: 2 });
  assert.deepEqual([...fresh.store.records.keys()].sort(), ['1', '2']);
});

test('TEST and LIVE roots do not see each other\'s files', async () => {
  const drive = fakeDrive();
  const live = phone(drive, 'phone-a', 'baby-log'), test = phone(drive, 'phone-b', 'baby-log-test');
  live.store.put(rec('1', 'phone-a', 10));
  test.store.put(rec('2', 'phone-b', 11));
  await live.sync.sync(); await test.sync.sync();
  assert.deepEqual([...live.store.records.keys()], ['1']);
  assert.deepEqual([...test.store.records.keys()], ['2']);
});

test('a lost network leaves the data alone and the next sync catches up', async () => {
  const drive = fakeDrive();
  const a = phone(drive, 'phone-a'), b = phone(drive, 'phone-b');
  a.store.put(rec('1', 'phone-a', 10));
  drive.down = true;
  await assert.rejects(a.sync.sync(), (err) => err.code === 'offline');
  assert.equal(a.store.records.size, 1, 'nothing lost');
  drive.down = false;
  await a.sync.sync(); await b.sync.sync();
  assert.deepEqual([...b.store.records.keys()], ['1']);
});

test('a broken file does not stop the good lines or the other files', async () => {
  const drive = fakeDrive();
  drive.files.set('baby-log/devices/phone-x.jsonl', { version: '1', text: 'garbage\n' + JSON.stringify(rec('9', 'phone-x', 5)) + '\n{oops' });
  drive.files.set('baby-log/devices/phone-y.jsonl', { version: '1', text: JSON.stringify(rec('8', 'phone-y', 5)) + '\n' });
  const a = phone(drive, 'phone-a');
  await a.sync.pull();
  assert.deepEqual([...a.store.records.keys()].sort(), ['8', '9']);
});
