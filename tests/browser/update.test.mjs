// Browser checks for the offline app: install, tabs, offline, and above all updates.
// A fresh install hid a real bug (an update mixed old scripts into a new page), so these tests
// publish one version, then a newer one, the way GitHub Pages does (max-age=600), and open the app again.
//
// Run: npm run test:browser   (needs Playwright with Chromium; CI installs both)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, state, open, install, tapTab, assertConsistent } from './helpers.mjs';

let origin, site, browser, close;
before(async () => ({ origin, site, browser, close } = await startSite({ 'test-v1': 'test', 'test-v2': 'test', 'test-v3': 'test', 'live-v1': 'live' })));
after(() => close?.());

test('fresh install: tabs work and the app opens offline', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  const url = `${origin}/baby-log/test/`;
  const s = await install(page, url);
  assertConsistent(s, 'installed');
  assert.equal(s.tab, 'today');
  assert.equal((await tapTab(page, 'growth')).heading, 'Growth');
  assert.equal((await tapTab(page, 'summary')).tab, 'summary');
  await context.setOffline(true);
  const off = await open(page, url + '#growth');
  assertConsistent(off, 'offline');
  assert.equal(off.heading, 'Growth');
  assert.deepEqual(errors, []);
  await context.close();
});

test('update: a new version never mixes with the old one, and is there on the next open', async () => {
  site.test = 'test-v2';
  const { context, page, errors } = await phone(browser);
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
  assert.equal((await tapTab(page, 'summary')).tab, 'summary', 'tabs work on open 2');

  await context.setOffline(true);
  const off = await open(page, url + '#summary');
  assertConsistent(off, 'offline after update');
  assert.equal(off.pageVersion, 'test-v3');
  assert.equal(off.tab, 'summary');
  assert.deepEqual(errors, []);
  await context.close();
});

test('live and test on one site keep separate offline copies', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
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
