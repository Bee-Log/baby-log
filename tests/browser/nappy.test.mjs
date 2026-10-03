// Feature 005: log a wee or a poo with one tap, undo it, and keep TEST data apart from LIVE.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, state, open, install, todayRows } from './helpers.mjs';

let origin, site, browser, close;
before(async () => ({ origin, site, browser, close } = await startSite({ 'test-v1': 'test', 'test-v2': 'test', 'live-v1': 'live' })));
after(() => close?.());

// Every record in this build's own database, read the way the app stores them.
function storedRecords(page, dbName) {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) { db.close(); resolve([]); return; }
      const get = db.transaction('records').objectStore('records').getAll();
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  }), dbName);
}

// Tap a log button and wait for its own confirmation (an earlier message may still be showing).
async function tap(page, label) {
  await page.evaluate(() => { document.getElementById('toast-text').textContent = ''; });
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForFunction((l) => document.getElementById('toast-text').textContent === l + ' saved', label);
}

test('one tap logs a wee or a poo; both together show as one nappy; it survives a reload', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  const url = `${origin}/baby-log/test/`;
  await install(page, url);
  assert.equal(await page.isVisible('#today-empty'), true, 'empty day says so');

  await tap(page, 'Wee');
  assert.equal(await page.textContent('#toast-text'), 'Wee saved');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee']);
  await tap(page, 'Poo');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee + Poo']);

  const recs = await storedRecords(page, 'test-baby-log');
  assert.deepEqual(recs.map((r) => r.type).sort(), ['pee', 'poop'], 'two records, one per tap');
  for (const r of recs) {
    assert.deepEqual(Object.keys(r).sort(), ['by', 'd', 'deviceId', 'end', 'id', 'note', 't', 'type', 'updatedAt']);
    assert.equal(r.deviceId, recs[0].deviceId, 'one device id per phone');
  }

  await open(page, url);
  assert.deepEqual(await todayRows(page), ['Nappy · Wee + Poo'], 'still there after a reload');
  assert.equal(await page.isVisible('#today-empty'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Undo removes the entry from the list but keeps a tombstone for sync', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  await install(page, `${origin}/baby-log/test/`);
  await tap(page, 'Poo');
  assert.deepEqual(await todayRows(page), ['Nappy · Poo']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForFunction(() => document.getElementById('toast-text').textContent === 'Removed');
  assert.deepEqual(await todayRows(page), []);
  const [rec] = await storedRecords(page, 'test-baby-log');
  assert.equal(rec.deleted, true, 'removed entries are tombstones, not deleted');
  assert.ok(rec.updatedAt > rec.t);
  assert.deepEqual(errors, []);
  await context.close();
});

test('logging works offline', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  const url = `${origin}/baby-log/test/`;
  await install(page, url);
  await context.setOffline(true);
  await open(page, url);
  await tap(page, 'Wee');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('TEST entries never reach LIVE storage', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  await install(page, `${origin}/baby-log/test/`);
  await tap(page, 'Wee');
  await install(page, `${origin}/baby-log/`);
  assert.deepEqual(await todayRows(page), [], 'LIVE shows nothing logged in TEST');
  await tap(page, 'Poo');
  assert.deepEqual((await storedRecords(page, 'baby-log')).map((r) => r.type), ['poop']);
  assert.deepEqual((await storedRecords(page, 'test-baby-log')).map((r) => r.type), ['pee']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an update does not reload the page while Undo is still possible', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  const url = `${origin}/baby-log/test/`;
  await install(page, url);
  await tap(page, 'Wee');
  await page.evaluate(() => { window.__sameLoad = true; });

  site.test = 'test-v2'; // publish an update while the Undo message is showing
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await page.waitForFunction(() => navigator.serviceWorker.controller.scriptURL && caches.keys().then((k) => k.includes('test-baby-log-shell-test-v2')));
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => window.__sameLoad === true && !document.getElementById('toast').hidden), true,
    'no reload while Undo is showing');

  // When the message is gone, the page moves to the new version by itself.
  const s = await state(page, { until: (x) => x.pageVersion === 'test-v2', timeoutMs: 12000 });
  assert.equal(s.pageVersion, 'test-v2');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee'], 'the entry is still there after the update');
  assert.deepEqual(errors, []);
  await context.close();
});
