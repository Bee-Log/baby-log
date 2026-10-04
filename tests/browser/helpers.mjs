// Shared pieces for the browser tests: a local server laid out like the GitHub Pages site
// (LIVE at /baby-log/, TEST at /baby-log/test/, max-age=600 like Pages), and helpers that
// open the app like a person would.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFile } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { build } from '../../scripts/build.mjs';

const require = createRequire(import.meta.url); // honours NODE_PATH, for a shared Playwright install
const { chromium } = require('playwright');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };

// versions: { name: 'test' | 'live' }. Returns { origin, site, browser, close }.
// Set site.test / site.live to a version name to "publish" it.
export async function startSite(versions) {
  const tmp = mkdtempSync(join(tmpdir(), 'baby-log-browser-'));
  const builds = {};
  for (const [name, env] of Object.entries(versions)) builds[name] = build({ env, out: join(tmp, name), version: name });
  const names = Object.keys(versions);
  const site = { live: names.find((n) => versions[n] === 'live'), test: names.find((n) => versions[n] === 'test') };
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith('/baby-log/')) { res.writeHead(404); res.end(); return; }
    path = path.slice('/baby-log/'.length);
    let dir = builds[site.live];
    if (path.startsWith('test/')) { dir = builds[site.test]; path = path.slice('test/'.length); }
    if (path === '' || path.endsWith('/')) path += 'index.html';
    readFile(join(dir, path), (err, body) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
      res.end(body);
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    site,
    browser,
    close: async () => { await browser.close(); server.close(); }
  };
}

export async function phone(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { context, page, errors };
}

export function assertConsistent(s, label) {
  assert.equal(s.scriptVersion, s.pageVersion, `${label}: page ${s.pageVersion} runs scripts ${s.scriptVersion}`);
}

// The page's own version (from index.html) and the scripts' version (from config.js) must always match.
export function read(page) {
  return page.evaluate(() => ({
    pageVersion: document.querySelector('meta[name=app-version]').content,
    scriptVersion: self.BABYLOG_CONFIG && self.BABYLOG_CONFIG.version,
    tab: document.querySelector('.tabbar a[aria-current=page]')?.dataset.tab,
    heading: [...document.querySelectorAll('.view')].find((v) => !v.hidden)?.querySelector('h1').textContent,
    testBanner: !document.getElementById('test-banner').hidden
  }));
}

// The app may reload itself once when a new version takes over. Sample until two reads agree,
// checking every sample, so a mixed version is caught even if it only shows for a moment.
export async function state(page, { until = () => true, timeoutMs = 10000 } = {}) {
  const end = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < end) {
    await page.waitForTimeout(250);
    let s;
    try { await page.waitForLoadState('load'); s = await read(page); } catch { last = null; continue; } // page was reloading
    assertConsistent(s, 'while loading');
    if (last && JSON.stringify(s) === JSON.stringify(last) && until(s)) return s;
    last = s;
  }
  throw new Error(`page did not settle${last ? ': ' + JSON.stringify(last) : ''}`);
}

// Open a page like a person would. A self-reload can cancel this navigation; that is fine.
export async function open(page, url, opts) {
  await page.goto(url).catch((e) => { if (!/ERR_ABORTED|frame was detached/.test(e.message)) throw e; });
  return state(page, opts);
}

// The made-up baby every test phone starts with (feature 014: nothing can be logged without a baby).
export const TEST_BABY = 'baby-bean';
export const testBabyProfile = () => ({
  v: 2, id: TEST_BABY, type: 'profile', babyId: TEST_BABY, t: new Date(2026, 8, 12).getTime(), end: null,
  d: { nickname: 'Bean', dateOfBirth: '2026-09-12', sex: 'girl', photo: '' }, note: '', by: '', deviceId: 'seed', updatedAt: 1
});
const dbNameOf = (url) => (url.includes('/baby-log/test/') ? 'test-baby-log' : 'baby-log');

// Open the app, let the service worker take over, and (unless `baby: false`) add the test baby and choose it.
export async function install(page, url, { baby = true } = {}) {
  await open(page, url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (baby) {
    await seedAsIs(page, testBabyProfile(), dbNameOf(url));
    await setMeta(page, 'currentBaby', TEST_BABY, dbNameOf(url));
  }
  return open(page, url); // now controlled by the service worker
}

export async function tapTab(page, tab) {
  await page.click(`.tabbar a[data-tab=${tab}]`);
  return state(page);
}

export function todayRows(page) {
  return page.$$eval('#today-list .row', (rows) => rows.map((r) => r.querySelector('.row-what').textContent.trim()));
}

// Put an entry of the test baby straight into this build's storage, for tests that need old or special entries.
export function seed(page, record, dbName = 'test-baby-log') {
  return seedAsIs(page, { v: 2, babyId: TEST_BABY, ...record }, dbName);
}

// Put an entry into storage exactly as given (for example one from before feature 014, without v and babyId).
export function seedAsIs(page, record, dbName = 'test-baby-log') {
  return page.evaluate(({ record, dbName }) => new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('records', 'readwrite');
      tx.objectStore('records').put(record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }), { record, dbName });
}

export function setMeta(page, key, value, dbName = 'test-baby-log') {
  return page.evaluate(({ key, value, dbName }) => new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }), { key, value, dbName });
}

export function readRecords(page, dbName = 'test-baby-log') {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('records').objectStore('records').getAll();
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  }), dbName);
}

// ---- A fake Google for the sync tests (no real Google account is used) ----
// Google's sign-in script, as a stub. Every call is one opening of Google's window on a real phone: it is counted
// in window.__googleWindows, so the tests can check that the app never opens it by itself.
const GOOGLE_STUB = `window.__googleWindows = 0;
window.google = { accounts: { oauth2: { initTokenClient(cfg) { return { requestAccessToken(opts) {
  window.__googleWindows++;
  setTimeout(() => cfg.callback({ access_token: window.__stubToken || 'good-token', expires_in: 3600 }), 5);
} }; } } } };`;

// Point a phone (from phone()) at `fake` (tests/fake-drive.mjs) before the app opens. Its Drive calls are kept in p.googleCalls.
// `configured: false` leaves the placeholder client ID in place (sync off). `driveSilent`: Google never answers.
export async function fakeGoogle(p, fake, { configured = true, driveSilent = false } = {}) {
  // The build holds the real client ID. Tests use a made-up one (so no real Google sign-in is tried), or the placeholder (sync off).
  await p.context.addInitScript((clientId) => {
    let cfg;
    Object.defineProperty(window, 'BABYLOG_CONFIG', { configurable: true, get: () => cfg, set: (v) => { cfg = { ...v, googleClientId: clientId }; } });
  }, configured ? 'test-client.apps.googleusercontent.com' : 'PLACEHOLDER');
  p.googleCalls = [];
  await p.context.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ contentType: 'text/javascript', body: GOOGLE_STUB }));
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
}
