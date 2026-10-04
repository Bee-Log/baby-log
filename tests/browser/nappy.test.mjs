// Feature 005: log a wee or a poo with one tap, fix a wrong tap from the list, and keep TEST data apart from LIVE.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, state, open, install, todayRows, TEST_BABY } from './helpers.mjs';

let origin, site, browser, close;
before(async () => ({ origin, site, browser, close } = await startSite({ 'test-v1': 'test', 'test-v2': 'test', 'live-v1': 'live' })));
after(() => close?.());

// Every entry in this build's own database, read the way the app stores them (without the test baby's profile).
function storedRecords(page, dbName) {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('records')) { db.close(); resolve([]); return; }
      const get = db.transaction('records').objectStore('records').getAll();
      get.onsuccess = () => { db.close(); resolve(get.result.filter((r) => r.type !== 'profile')); };
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
    assert.deepEqual(Object.keys(r).sort(), ['babyId', 'by', 'd', 'deviceId', 'end', 'id', 'note', 't', 'type', 'updatedAt', 'v']);
    assert.equal(r.deviceId, recs[0].deviceId, 'one device id per phone');
    assert.equal(r.babyId, TEST_BABY, 'it belongs to the baby on screen');
    assert.equal(r.v, 2);
  }

  await open(page, url);
  assert.deepEqual(await todayRows(page), ['Nappy · Wee + Poo'], 'still there after a reload');
  assert.equal(await page.isVisible('#today-empty'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a wrong tap is removed from the list: open the row, tap Delete twice', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, `${origin}/baby-log/test/`);
  await tap(page, 'Poo');
  assert.deepEqual(await todayRows(page), ['Nappy · Poo']);
  assert.equal(await page.isVisible('#toast-undo'), false, 'there is no Undo button');
  await page.locator('#today-list .row-link').first().click();
  await page.waitForSelector('#screen-edit[data-ready]');
  await page.click('#edit-delete');
  assert.equal(await page.textContent('#edit-delete'), 'Tap again to delete', 'the first tap only asks');
  assert.deepEqual((await storedRecords(page, 'test-baby-log')).map((r) => r.deleted), [undefined], 'nothing is deleted yet');
  await page.click('#edit-delete');
  await page.waitForFunction(() => location.hash === '#today');
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
