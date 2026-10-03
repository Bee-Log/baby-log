// Browser checks for the offline app: install, tabs, offline, and above all updates.
// A fresh install hid a real bug (an update mixed old scripts into a new page), so these tests
// publish one version, then a newer one, the way GitHub Pages does (max-age=600), and open the app again.
//
// Run: npm run test:browser   (needs Playwright with Chromium; CI installs both)
import { test, before, after } from 'node:test';
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
const tmp = mkdtempSync(join(tmpdir(), 'baby-log-browser-'));
const builds = {};
for (const [name, env] of [['test-v1', 'test'], ['test-v2', 'test'], ['test-v3', 'test'], ['live-v1', 'live']]) {
  builds[name] = build({ env, out: join(tmp, name), version: name });
}

// What the server publishes, like the Pages site: LIVE at /baby-log/, TEST at /baby-log/test/.
const site = { live: 'live-v1', test: 'test-v1' };
let server, origin, browser;

before(async () => {
  server = createServer((req, res) => {
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
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => { await browser?.close(); server?.close(); });

async function phone() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return { context, page, errors };
}

// The page's own version (from index.html) and the scripts' version (from config.js) must always match.
function read(page) {
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
async function state(page, { until = () => true, timeoutMs = 10000 } = {}) {
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
async function open(page, url, opts) {
  await page.goto(url).catch((e) => { if (!/ERR_ABORTED|frame was detached/.test(e.message)) throw e; });
  return state(page, opts);
}

async function install(page, url) {
  await open(page, url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  return open(page, url); // now controlled by the service worker
}

async function tapTab(page, tab) {
  await page.click(`.tabbar a[data-tab=${tab}]`);
  return state(page);
}

function assertConsistent(s, label) {
  assert.equal(s.scriptVersion, s.pageVersion, `${label}: page ${s.pageVersion} runs scripts ${s.scriptVersion}`);
}

test('fresh install: tabs work and the app opens offline', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone();
  const url = `${origin}/baby-log/test/`;
  const s = await install(page, url);
  assertConsistent(s, 'installed');
  assert.equal(s.tab, 'today');
  assert.equal((await tapTab(page, 'growth')).heading, 'Growth');
  assert.equal((await tapTab(page, 'summary')).heading, 'Summary');
  await context.setOffline(true);
  const off = await open(page, url + '#growth');
  assertConsistent(off, 'offline');
  assert.equal(off.heading, 'Growth');
  assert.deepEqual(errors, []);
  await context.close();
});

test('update: a new version never mixes with the old one, and is there on the next open', async () => {
  site.test = 'test-v2';
  const { context, page, errors } = await phone();
  const url = `${origin}/baby-log/test/`;
  assertConsistent(await install(page, url), 'v2 installed');

  site.test = 'test-v3'; // publish an update
  // Open 1: still the old version or already the new one, never a mix. The new version
  // downloads in the background and takes over (the page reloads itself once).
  const first = await open(page, url);
  assert.equal((await tapTab(page, 'growth')).heading, 'Growth', 'tabs work on open 1');
  if (first.pageVersion !== 'test-v3') await state(page, { until: (s) => s.pageVersion === 'test-v3' });
  // Open 2: the new version.
  const second = await open(page, url);
  assert.equal(second.pageVersion, 'test-v3', 'update not picked up');
  assert.equal((await tapTab(page, 'summary')).heading, 'Summary', 'tabs work on open 2');

  await context.setOffline(true);
  const off = await open(page, url + '#summary');
  assertConsistent(off, 'offline after update');
  assert.equal(off.pageVersion, 'test-v3');
  assert.equal(off.heading, 'Summary');
  assert.deepEqual(errors, []);
  await context.close();
});

test('live and test on one site keep separate offline copies', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone();
  const live = await install(page, `${origin}/baby-log/`);
  assertConsistent(live, 'live');
  assert.equal(live.testBanner, false);
  const tst = await install(page, `${origin}/baby-log/test/`);
  assertConsistent(tst, 'test');
  assert.equal(tst.testBanner, true);

  const caches = await page.evaluate(() => caches.keys());
  assert.ok(caches.some((k) => k.startsWith('test-')), 'test cache uses the test- prefix');
  assert.ok(caches.some((k) => !k.startsWith('test-')), 'live has its own cache');

  await context.setOffline(true);
  const offLive = await open(page, `${origin}/baby-log/#growth`);
  assert.equal(offLive.pageVersion, 'live-v1');
  assert.equal(offLive.heading, 'Growth');
  const offTest = await open(page, `${origin}/baby-log/test/#summary`);
  assert.equal(offTest.pageVersion, 'test-v1');
  assert.equal(offTest.testBanner, true);
  assert.deepEqual(errors, []);
  await context.close();
});
