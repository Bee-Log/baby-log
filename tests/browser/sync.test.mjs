// ADR-001 in a real browser: sync between two phones over a FAKE Google (no real Google account is used).
// Google's sign-in script is replaced by a small stub, and the Drive calls are answered by tests/fake-drive.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, seed, readRecords } from './helpers.mjs';
import { createFakeDrive } from '../fake-drive.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' })));
after(() => close?.());

const url = () => `${origin}/baby-log/test/`;
const NOW = new Date(2026, 9, 3, 17, 17).getTime();
const at = (h, m = 0) => new Date(2026, 9, 3, h, m).getTime();
const rec = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'seed', updatedAt: t, ...extra });
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());

// Google's sign-in script, as a stub. It remembers a sign-in in localStorage (Google would remember it in its own cookies).
const GOOGLE_STUB = `window.google = { accounts: { oauth2: { initTokenClient(cfg) { return { requestAccessToken(opts) {
  setTimeout(() => {
    if (opts.prompt === '' ) localStorage.setItem('stub-google', '1');
    if (localStorage.getItem('stub-google')) cfg.callback({ access_token: window.__stubToken || 'good-token', expires_in: 3600 });
    else cfg.error_callback({ type: 'popup_closed' });
  }, 5);
} }; } } } };`;

// A stub that never answers a quiet renewal (this is what a blocked sign-in window looks like to the app).
const GOOGLE_STUB_NEVER_ANSWERS = `window.google = { accounts: { oauth2: { initTokenClient(cfg) { return { requestAccessToken(opts) {
  if (opts.prompt === '') setTimeout(() => cfg.callback({ access_token: 'good-token', expires_in: 3600 }), 5);
} }; } } } };`;

// A phone that talks to the fake Drive. `configured: false` leaves the placeholder client ID in place.
async function startPhone(fake, { configured = true, running = false, silent = null, driveSilent = false } = {}) {
  const p = await phone(browser);
  if (running) await p.context.clock.install({ time: NOW });     // a clock that can be moved forward
  else await p.context.clock.setFixedTime(NOW);
  // The build holds the real client ID. Tests use a made-up one (so no real Google sign-in is tried), or the placeholder (sync off).
  await p.context.addInitScript((clientId) => {
    let cfg;
    Object.defineProperty(window, 'BABYLOG_CONFIG', { configurable: true, get: () => cfg, set: (v) => { cfg = { ...v, googleClientId: clientId }; } });
  }, configured ? 'test-client.apps.googleusercontent.com' : 'PLACEHOLDER');
  p.googleCalls = [];
  await p.context.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: silent === 'never' ? GOOGLE_STUB_NEVER_ANSWERS : GOOGLE_STUB }));
  await p.context.route('https://www.googleapis.com/**', async (route) => {
    const req = route.request();
    p.googleCalls.push(req.method());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (fake.offline) return route.abort('failed');
    if (driveSilent) return;                                    // Google never answers
    const r = fake.handle(req.method(), req.url(), req.headers(), req.postData() || '');
    return route.fulfill({ status: r.status, contentType: r.contentType, body: r.body, headers: cors });
  });
  await install(p.page, url());
  return p;
}
// An entry written by THIS phone (sync only sends a phone's own entries).
async function ownEntry(page, id, type, t, extra = {}) {
  const deviceId = await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('test-baby-log');
    req.onsuccess = () => { const get = req.result.transaction('meta').objectStore('meta').get('deviceId'); get.onsuccess = () => { req.result.close(); resolve(get.result); }; };
  }));
  await seed(page, rec(id, type, t, { deviceId, ...extra }));
}
const statusLink = (page) => text(page, '#sync-link');
const waitStatus = (page, wanted) => page.waitForFunction((w) => document.getElementById('sync-link').textContent.startsWith(w), wanted, { timeout: 15000 });
async function signInAndSync(page) {
  await page.click('#sync-link');
  await page.click('#sy-signin');
  await waitStatus(page, 'Synced');
}
const feeds = async (page) => (await readRecords(page)).filter((r) => r.type === 'feed');

test('with the placeholder client ID, sync is off, nothing is sent to Google, and the data is still safe', async () => {
  const fake = createFakeDrive();
  const { context, page, googleCalls, errors } = await startPhone(fake, { configured: false });
  assert.equal(await statusLink(page), 'Sync is not set up yet');
  await seed(page, rec('f1', 'feed', at(15), { d: { kind: 'Bottle', ml: 90 } }));
  await page.click('#sync-link');
  assert.equal(await text(page, '#sy-state'), 'Sync is not set up yet');
  assert.equal(await page.isVisible('#sy-signin'), false);
  assert.equal(await page.isVisible('#sy-now'), false);
  assert.equal(googleCalls.length, 0, 'no calls to Google');
  assert.deepEqual(errors, []);
  await context.close();
});

test('two phones: sign in, send, and see each other\'s entries', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake), b = await startPhone(fake);
  assert.equal(await statusLink(a.page), 'Sign in to sync');

  await ownEntry(a.page, 'f1', 'feed', at(15, 2), { d: { kind: 'Breast', side: 'Left', min: 14 } });
  await a.page.reload();
  await signInAndSync(a.page);
  assert.equal(fake.files.size, 1, 'a file for phone A');
  assert.ok([...fake.files.values()].every((f) => /^baby-log-test\/devices\/.+\.jsonl$/.test(f.name)), 'only the TEST folder is used');

  await signInAndSync(b.page);
  await b.page.click('a[aria-label="Back"]:visible');
  await b.page.waitForFunction(() => document.querySelectorAll('#today-list .row').length === 1);
  assert.equal(await text(b.page, '#lf-detail'), '3:02 pm · Left 14 min', 'B shows A\'s feed');
  assert.equal((await feeds(b.page)).length, 1);

  // B logs a nappy; A gets it on its next sync.
  await b.page.click('[data-log="pee"]');
  await b.page.waitForFunction(() => document.querySelectorAll('#today-list .row').length === 2);
  await b.page.click('#sync-link');
  await b.page.click('#sy-now');
  await waitStatus(b.page, 'Synced');
  await a.page.click('#sy-now');
  await waitStatus(a.page, 'Synced');
  await a.page.click('#screen-sync a[aria-label="Back"]');
  await a.page.waitForFunction(() => document.querySelectorAll('#today-list .row').length === 2);
  assert.deepEqual(a.errors, []);
  assert.deepEqual(b.errors, []);
  await a.context.close(); await b.context.close();
});

test('a new entry is sent by itself a few seconds after it is saved', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake);
  await signInAndSync(a.page);
  await a.page.click('#screen-sync a[aria-label="Back"]');
  await a.page.click('[data-log="poop"]');
  await a.page.waitForFunction(() => document.querySelectorAll('#today-list .row').length === 1);
  await a.page.waitForTimeout(5000);
  const file = [...fake.files.values()][0];
  assert.match(file.text, /"type":"poop"/, 'the nappy was sent without pressing anything');
  assert.deepEqual(a.errors, []);
  await a.context.close();
});

test('with no network, entries are kept and the status says so; sync catches up when the network is back', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake);
  await signInAndSync(a.page);
  fake.offline = true;
  await ownEntry(a.page, 'f1', 'feed', at(15), { d: { kind: 'Bottle', ml: 60 } });
  await a.page.click('#sy-now');
  await waitStatus(a.page, 'Waiting for network');
  assert.equal((await feeds(a.page)).length, 1, 'the entry is safe on the phone');
  fake.offline = false;
  await a.page.click('#sy-now');
  await waitStatus(a.page, 'Synced');
  assert.match([...fake.files.values()][0].text, /"id":"f1"/);
  assert.deepEqual(a.errors, []);
  await a.context.close();
});

test('when Google refuses the sign-in, the status asks to sign in again, and nothing is lost', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake);
  await signInAndSync(a.page);
  fake.token = 'a-different-token';               // the old token is no longer good
  await a.page.click('#sy-now');
  await waitStatus(a.page, 'Sign in to sync');
  assert.equal(await a.page.isVisible('#sy-signin'), true);
  await a.page.evaluate(() => { window.__stubToken = 'a-different-token'; });
  await a.page.click('#sy-signin');
  await waitStatus(a.page, 'Synced');
  assert.deepEqual(a.errors, []);
  await a.context.close();
});

test('after a restart the phone signs in quietly if it signed in before; the token is not stored', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake);
  await signInAndSync(a.page);
  await a.page.reload();
  await waitStatus(a.page, 'Synced');
  const stored = await a.page.evaluate(async () => {
    const keys = Object.keys(localStorage).concat(Object.keys(sessionStorage));
    const meta = await new Promise((resolve) => {
      const req = indexedDB.open('test-baby-log');
      req.onsuccess = () => { const all = req.result.transaction('meta').objectStore('meta').getAll(); all.onsuccess = () => { req.result.close(); resolve(JSON.stringify(all.result)); }; };
    });
    return { keys, meta };
  });
  assert.doesNotMatch(stored.meta + stored.keys.join(), /good-token/, 'the sign-in token is only in memory');
  assert.deepEqual(a.errors, []);
  await a.context.close();
});

test('the CSV and JSONL downloads hold the entries', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake, { configured: false });
  await seed(a.page, rec('f1', 'feed', at(15, 2), { d: { kind: 'Breast', side: 'Left', min: 14 }, note: 'calm' }));
  await seed(a.page, rec('x', 'pee', at(10), { deleted: true }));
  await a.page.click('#sync-link');
  const [csv] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#sy-csv')]);
  assert.match(csv.suggestedFilename(), /^baby-log-\d{4}-\d{2}-\d{2}\.csv$/);
  const csvText = await (await import('node:fs/promises')).readFile(await csv.path(), 'utf8');
  assert.match(csvText, /^date,time,start_iso,type,/);
  assert.match(csvText, /2026-10-03,15:02,.*,feed,14,.*Breast,Left/);
  assert.doesNotMatch(csvText, /,pee,/, 'a removed entry is not in the CSV');
  const [jsonl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#sy-jsonl')]);
  const lines = (await (await import('node:fs/promises')).readFile(await jsonl.path(), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.id).sort(), ['f1', 'x'], 'JSONL has every entry, removed ones too');
  assert.deepEqual(a.errors, []);
  await a.context.close();
});

// This phone signed in before: the app will try a quiet renewal as soon as it opens.
async function markSignedInBefore(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('test-baby-log');
    req.onsuccess = () => { const tx = req.result.transaction('meta', 'readwrite'); tx.objectStore('meta').put(true, 'syncSignedIn'); tx.oncomplete = () => { req.result.close(); resolve(); }; };
  }));
}

test('if Google never answers the quiet renewal, the app does not stay on "Syncing…": it asks to sign in, with the reason', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake, { running: true, silent: 'never' });
  await markSignedInBefore(a.page);
  await a.page.reload();
  await a.page.waitForFunction(() => document.getElementById('sync-link').textContent === 'Syncing…');
  await a.page.clock.fastForward(20000);
  await waitStatus(a.page, 'Sign in to sync');
  await a.page.click('#sync-link');
  await a.page.waitForSelector('#sy-signin', { state: 'visible', timeout: 5000 });     // the sign-in button is back
  assert.match(await text(a.page, '#sy-error'), /^Details: auth: Google did not answer/);
  await a.page.click('#sy-signin');                                   // the sign-in window works this time
  await a.page.clock.fastForward(100);
  await waitStatus(a.page, 'Synced');
  assert.deepEqual(a.errors, []);
  await a.context.close();
});

test('if Drive never answers, a sync gives up after a minute and can be tried again', async () => {
  const fake = createFakeDrive();
  const a = await startPhone(fake, { running: true, driveSilent: true });
  await a.page.click('#sync-link');
  await a.page.click('#sy-signin');
  await a.page.clock.fastForward(100);
  await a.page.waitForFunction(() => document.getElementById('sync-link').textContent === 'Syncing…');
  await a.page.clock.fastForward(61000);
  await waitStatus(a.page, 'Could not sync');
  assert.match(await text(a.page, '#sy-error'), /timeout: Sync took longer than a minute/);
  assert.equal(await a.page.isDisabled('#sy-now'), false, 'Sync now works again');
  assert.deepEqual(a.errors, []);
  await a.context.close();
});
