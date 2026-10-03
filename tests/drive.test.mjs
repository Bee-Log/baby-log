// The Google Drive backend (src/drive.js) and the sign-in rules (src/google-auth.js), against a fake of the Drive REST API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';
import { createFakeDrive } from './fake-drive.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-drive-')), 'test'), version: 't1' });
const sandbox = { self: {} };
for (const f of ['records.js', 'sync.js', 'drive.js', 'google-auth.js']) vm.runInNewContext(readFileSync(join(out, f), 'utf8'), sandbox);
const { BABYLOG_DRIVE: Drive, BABYLOG_SYNC: Sync, BABYLOG_RECORDS: R, BABYLOG_GOOGLE_AUTH: Auth } = sandbox.self;
const plain = (v) => JSON.parse(JSON.stringify(v));

const rec = (id, deviceId, updatedAt) => ({ id, type: 'feed', t: 1000, end: null, d: {}, note: '', by: '', deviceId, updatedAt });
const backendFor = (fake, getToken = async () => fake.token) => Drive.create({ getToken, fetch: fake.fetchFor() });

test('write creates a file in the app-data folder, then updates the same file', async () => {
  const fake = createFakeDrive();
  const drive = backendFor(fake);
  const v1 = await drive.write('baby-log/devices/a.jsonl', 'one\n');
  assert.equal(fake.files.size, 1);
  assert.equal(fake.file('baby-log/devices/a.jsonl').text, 'one\n');
  const v2 = await drive.write('baby-log/devices/a.jsonl', 'one\ntwo\n');
  assert.equal(fake.files.size, 1, 'the same file, not a second one');
  assert.notEqual(v1, v2, 'a new version');
  assert.equal(await drive.read('baby-log/devices/a.jsonl'), 'one\ntwo\n');
});

test('read gives null when there is no such file; list gives names and versions', async () => {
  const fake = createFakeDrive();
  const drive = backendFor(fake);
  assert.equal(await drive.read('baby-log/devices/none.jsonl'), null);
  await drive.write('baby-log/devices/a.jsonl', 'x');
  await drive.write('baby-log/devices/b.jsonl', 'y');
  const names = plain(await drive.list()).map((f) => f.name).sort();
  assert.deepEqual(names, ['baby-log/devices/a.jsonl', 'baby-log/devices/b.jsonl']);
});

test('text with line breaks, quotes and non-English characters survives', async () => {
  const fake = createFakeDrive();
  const drive = backendFor(fake);
  const text = '{"note":"ក្មេង \\"quoted\\" \\n line"}\n{"note":"emoji 🍼"}\n';
  await drive.write('baby-log/devices/a.jsonl', text);
  assert.equal(await drive.read('baby-log/devices/a.jsonl'), text);
});

test('a refused token means sign-in is needed; a lost network means offline; other answers are errors', async () => {
  const fake = createFakeDrive();
  const stale = backendFor(fake, async () => 'old-token');
  await assert.rejects(stale.list(), (err) => err.code === 'auth');
  fake.offline = true;
  await assert.rejects(backendFor(fake).list(), (err) => err.code === 'offline');
  fake.offline = false;
  fake.failWith = 500;
  await assert.rejects(backendFor(fake).list(), (err) => err.code === 'drive');
});

test('the whole sync engine works over the Drive backend', async () => {
  const fake = createFakeDrive();
  const mkPhone = (deviceId) => {
    const records = new Map(), meta = new Map();
    const store = {
      all: async () => [...records.values()],
      mergeIn: async (incoming) => { let n = 0; for (const r of incoming) { const have = records.get(r.id); if (!have || R.isNewer(r, have)) { records.set(r.id, r); n++; } } return n; },
      getMeta: async (k) => (meta.has(k) ? meta.get(k) : null), setMeta: async (k, v) => { meta.set(k, v); }
    };
    return { records, sync: Sync.create({ backend: backendFor(fake), store, root: 'baby-log', deviceId }) };
  };
  const a = mkPhone('phone-a'), b = mkPhone('phone-b');
  a.records.set('1', rec('1', 'phone-a', 10));
  b.records.set('2', rec('2', 'phone-b', 11));
  await a.sync.sync(); await b.sync.sync(); await a.sync.sync();
  assert.deepEqual([...a.records.keys()].sort(), ['1', '2']);
  assert.deepEqual([...b.records.keys()].sort(), ['1', '2']);
  assert.deepEqual([...fake.files.values()].map((f) => f.name).sort(), ['baby-log/devices/phone-a.jsonl', 'baby-log/devices/phone-b.jsonl']);
});

test('sync stays off with a placeholder client ID, and on with a real-looking one', () => {
  assert.equal(Auth.isConfigured('PLACEHOLDER'), false);
  assert.equal(Auth.isConfigured('PLACEHOLDER_CLIENT_ID'), false);
  assert.equal(Auth.isConfigured(''), false);
  assert.equal(Auth.isConfigured(undefined), false);
  assert.equal(Auth.isConfigured('1234-abc.apps.googleusercontent.com'), true);
  assert.equal(Auth.SCOPE, 'https://www.googleapis.com/auth/drive.appdata', 'only the hidden app-data folder');
});

test('the committed config keeps sync off until a real client ID is put in', () => {
  const cfg = readFileSync(join(out, 'config.js'), 'utf8');
  assert.match(cfg, /googleClientId: 'PLACEHOLDER'/);
});

test('the sign-in token is never written to storage', () => {
  const src = readFileSync(join(out, 'google-auth.js'), 'utf8');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /localStorage|sessionStorage|indexedDB|setMeta|document\.cookie/, 'the token lives in memory only');
});
