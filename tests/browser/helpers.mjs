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

export async function install(page, url) {
  await open(page, url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  return open(page, url); // now controlled by the service worker
}

export async function tapTab(page, tab) {
  await page.click(`.tabbar a[data-tab=${tab}]`);
  return state(page);
}

export function todayRows(page) {
  return page.$$eval('#today-list .row', (rows) => rows.map((r) => r.querySelector('.row-what').textContent.trim()));
}
