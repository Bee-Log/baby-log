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
const sandbox = { self: {}, setTimeout, clearTimeout };   // the sign-in request has a time limit
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

test('the committed config has a public client ID (never a secret), so sync is on', () => {
  const cfg = readFileSync(join(out, 'config.js'), 'utf8');
  const id = /googleClientId: '([^']*)'/.exec(cfg)[1];
  assert.match(id, /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  assert.equal(Auth.isConfigured(id), true);
  assert.doesNotMatch(cfg, /GOCSPX-|client_secret/i, 'a client secret must never be in the code');
});

test('google-auth.js does not touch storage itself: the app passes the store that keeps the sign-in', () => {
  const src = readFileSync(join(out, 'google-auth.js'), 'utf8');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /localStorage|sessionStorage|indexedDB|setMeta|document\.cookie/);
});

// A "keep" store like the one sync-ui.js passes (it uses localStorage there).
function memoryKeep(initial = null) {
  const k = { value: initial, load: () => k.value, save: (v) => { k.value = v; }, remove: () => { k.value = null; } };
  return k;
}
const readyGoogle = (token) => ({ accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: () => cfg.callback({ access_token: token, expires_in: 3600 }) }) } } });

test('the sign-in is kept until it expires: a reopened app is still signed in, without opening Google\'s window', async () => {
  const keep = memoryKeep();
  sandbox.self.google = readyGoogle('token-1');
  try {
    const first = Auth.create({ clientId: 'test.apps.googleusercontent.com', keep });
    await first.signIn();
    assert.equal(keep.value.token, 'token-1');
    assert.ok(keep.value.expiresAt > Date.now() + 3500 * 1000);
    const reopened = Auth.create({ clientId: 'test.apps.googleusercontent.com', keep });   // a reload
    assert.equal(reopened.isSignedIn(), true);
    assert.equal(await reopened.getToken(), 'token-1');
  } finally {
    delete sandbox.self.google;
  }
});

test('an expired sign-in is not used and is removed; a refused one is removed too', async () => {
  const expired = memoryKeep({ token: 'old', expiresAt: Date.now() + 30000 });   // inside the last minute counts as expired
  const auth = Auth.create({ clientId: 'test.apps.googleusercontent.com', keep: expired });
  assert.equal(auth.isSignedIn(), false);
  assert.equal(expired.value, null, 'removed');
  await assert.rejects(auth.getToken(), (e) => e.code === 'auth');

  const good = memoryKeep({ token: 'kept', expiresAt: Date.now() + 1800 * 1000 });
  const again = Auth.create({ clientId: 'test.apps.googleusercontent.com', keep: good });
  assert.equal(again.isSignedIn(), true);
  again.forget();                                     // Google refused it
  assert.equal(good.value, null);
  assert.equal(again.isSignedIn(), false);

  const broken = memoryKeep({ token: 7, expiresAt: 'soon' });
  assert.equal(Auth.create({ clientId: 'test.apps.googleusercontent.com', keep: broken }).isSignedIn(), false, 'a damaged value is ignored');
});

test('sign out drops the token on this phone; the next sign-in shows the account list, then goes back to normal', async () => {
  const keep = memoryKeep();
  const prompts = [];
  sandbox.self.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: (o) => { prompts.push(o.prompt); cfg.callback({ access_token: 'token-' + prompts.length, expires_in: 3600 }); } }) } } };
  try {
    const auth = Auth.create({ clientId: 'test.apps.googleusercontent.com', keep });
    await auth.signIn();
    assert.ok(auth.expiry() > Date.now() + 3500 * 1000, 'the end of the sign-in is known');
    auth.signOut();
    assert.equal(auth.isSignedIn(), false);
    assert.equal(auth.expiry(), 0);
    assert.deepEqual(plain(keep.value), { signedOut: true }, 'the token is not kept');
    await assert.rejects(auth.getToken(), (e) => e.code === 'auth');
    auth.forget();                                                       // a late "refused" answer must not undo the sign-out
    assert.deepEqual(plain(keep.value), { signedOut: true });

    const reopened = Auth.create({ clientId: 'test.apps.googleusercontent.com', keep });   // the app is closed and opened again
    assert.equal(reopened.isSignedIn(), false);
    assert.deepEqual(plain(keep.value), { signedOut: true }, 'still remembered');
    await reopened.signIn();
    assert.equal(reopened.isSignedIn(), true);
    assert.equal(keep.value.token, 'token-2');
    reopened.signOut(); await reopened.signIn(); await reopened.signIn();
    assert.deepEqual(prompts, ['', 'select_account', 'select_account', ''], 'the account list is shown once after each sign-out');
  } finally {
    delete sandbox.self.google;
  }
});

test('Google sign-in: the script loads when the app opens, so one tap opens Google\'s window at once', async () => {
  let opened = 0, answer = null;
  const added = [];
  const fakeGoogle = { accounts: { oauth2: { initTokenClient: (cfg) => { answer = cfg.callback; return { requestAccessToken: () => { opened++; } }; } } } };
  const doc = {
    createElement: () => ({ remove() {} }),
    head: { appendChild: (tag) => { added.push(tag); setTimeout(() => { sandbox.self.google = fakeGoogle; tag.onload(); }, 5); } }
  };
  try {
    const auth = Auth.create({ clientId: 'test.apps.googleusercontent.com', document: doc });
    const [first, second] = await Promise.all([auth.prepare(), auth.prepare()]);
    assert.deepEqual([first, second], [true, true]);
    assert.equal(added.length, 1, 'the script is downloaded once');
    assert.equal(opened, 0, 'getting ready opens no window');
    const signedIn = auth.signIn();
    assert.equal(opened, 1, 'the window opens inside the tap, not after a download (a phone may block a late window)');
    answer({ access_token: 'token-1', expires_in: 3600 });
    assert.equal(await signedIn, 'token-1');
    assert.equal(auth.isSignedIn(), true);
  } finally {
    delete sandbox.self.google;
  }
});

test('Google sign-in: without network when the app opens, the tap loads the script and tries again', async () => {
  let fail = true, opened = 0;
  const doc = {
    createElement: () => ({ remove() {} }),
    head: { appendChild: (tag) => setTimeout(() => {
      if (fail) { tag.onerror(); return; }
      sandbox.self.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: () => { opened++; cfg.callback({ access_token: 't', expires_in: 3600 }); } }) } } };
      tag.onload();
    }, 5) }
  };
  try {
    const auth = Auth.create({ clientId: 'test.apps.googleusercontent.com', document: doc });
    assert.equal(await auth.prepare(), false, 'offline: not ready, and no error');
    fail = false;
    assert.equal(await auth.signIn(), 't');
    assert.equal(opened, 1);
  } finally {
    delete sandbox.self.google;
  }
});
