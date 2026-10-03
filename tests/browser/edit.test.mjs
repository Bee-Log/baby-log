// Feature 011 in a real browser: tap a row on Today, fix or delete the entry, and undo.
// The clock is fixed at 2:00 pm on 3 Oct 2026, so the tests behave the same at any time of day.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, open, state, todayRows, seed, readRecords } from './helpers.mjs';

let origin, site, browser, close;
before(async () => ({ origin, site, browser, close } = await startSite({ 'test-v1': 'test', 'test-v2': 'test' })));
after(() => close?.());

const NOW = new Date(2026, 9, 3, 14, 0).getTime();
const at = (h, m = 0) => new Date(2026, 9, 3, h, m).getTime();
const url = () => `${origin}/baby-log/test/`;
const rec = (id, type, t, d = {}, extra = {}) => ({ id, type, t, end: null, d, note: '', by: '', deviceId: 'other-phone', updatedAt: t, ...extra });

async function start(seedRecords = []) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(NOW);
  await install(p.page, url());
  for (const r of seedRecords) await seed(p.page, r);
  await p.page.reload();
  await p.page.waitForSelector('#today-list .row, #today-empty:not([hidden])');
  return p;
}
const ready = (page) => page.waitForSelector('#screen-edit[data-ready]');
const openRow = async (page, n = 0) => { await page.locator('#today-list .row-link').nth(n).click(); await ready(page); };
const byId = async (page, id) => (await readRecords(page)).find((r) => r.id === id);
const toast = (page) => page.textContent('#toast-text');
const waitToast = (page, text) => page.waitForFunction((t) => document.getElementById('toast-text').textContent === t, text);

test('bottle: change the amount, milk and time; Undo puts it back; it works offline', async () => {
  const original = rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 90, extra: 'kept' });
  const { context, page, errors } = await start([original]);
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 90 ml']);
  await context.setOffline(true);

  await openRow(page);
  assert.equal(await page.textContent('#h-edit'), 'Edit feed');
  assert.equal(await page.textContent('#edit-time-label'), 'Fed at');
  assert.equal(await page.inputValue('#edit-time'), '13:00');
  assert.equal(await page.inputValue('#edit-ml'), '90');
  assert.equal(await page.getAttribute('#edit-milk-formula', 'aria-pressed'), 'true');
  assert.equal(await page.isVisible('#edit-breast'), false);
  assert.equal(await page.isVisible('.tabbar'), false);

  await page.fill('#edit-ml', '120');           // typed, then Save straight away
  await page.click('#edit-milk-expressed');
  await page.fill('#edit-time', '12:40');
  await page.click('#edit-save');
  await waitToast(page, 'Changes saved');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 120 ml']);

  const saved = await byId(page, 'b1');
  assert.equal(saved.t, at(12, 40));
  assert.deepEqual(saved.d, { kind: 'Bottle', milk: 'Breast milk', ml: 120, extra: 'kept' }, 'unknown details are kept');
  assert.ok(saved.updatedAt > original.updatedAt, 'newer, so it wins the merge');
  assert.notEqual(saved.deviceId, 'other-phone', 'now this phone');
  assert.equal((await readRecords(page)).length, 1, 'edited in place, not copied');

  await page.getByRole('button', { name: 'Undo' }).click();
  await waitToast(page, 'Change undone');
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 90 ml']);
  const back = await byId(page, 'b1');
  assert.equal(back.t, at(13));
  assert.deepEqual(back.d, original.d);
  assert.ok(back.updatedAt > saved.updatedAt, 'the undo is newer than the edit');
  assert.deepEqual(errors, []);
  await context.close();
});

test('breast: change the side, minutes, note and time', async () => {
  const { context, page, errors } = await start([rec('s1', 'feed', at(11), { kind: 'Breast', side: 'Left', min: 14 }, { note: 'a' })]);
  assert.deepEqual(await todayRows(page), ['Feed · Left 14 min']);
  await openRow(page);
  assert.equal(await page.textContent('#edit-time-label'), 'Started at');
  assert.equal(await page.isVisible('#edit-bottle'), false);
  assert.equal(await page.getAttribute('#edit-side-Left', 'aria-pressed'), 'true');
  assert.equal(await page.inputValue('#edit-min'), '14');
  assert.equal(await page.inputValue('#edit-note'), 'a');

  await page.click('#edit-side-Both');
  await page.click('#edit-min-plus');
  await page.click('#edit-min-plus');
  await page.click('#edit-min-minus');
  assert.equal(await page.inputValue('#edit-min'), '15');
  await page.fill('#edit-note', '  fed well  ');
  await page.fill('#edit-time', '10:50');
  await page.click('#edit-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual(await todayRows(page), ['Feed · Both 15 min']);
  const saved = await byId(page, 's1');
  assert.deepEqual([saved.t, saved.d, saved.note], [at(10, 50), { kind: 'Breast', side: 'Both', min: 15 }, 'fed well']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a Wee + Poo row is two entries: a time change moves both, Delete removes both, Undo brings both back', async () => {
  const { context, page, errors } = await start([rec('w1', 'pee', at(13, 0)), rec('p1', 'poop', at(13, 1))]);
  assert.deepEqual(await todayRows(page), ['Nappy · Wee + Poo']);
  await openRow(page);
  assert.equal(await page.textContent('#h-edit'), 'Edit nappy');
  assert.equal(await page.textContent('#edit-nappy'), 'Wee + Poo');
  assert.equal(await page.isVisible('#edit-breast'), false);
  assert.equal(await page.isVisible('#edit-bottle'), false);

  await page.fill('#edit-time', '12:30');
  await page.click('#edit-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual([(await byId(page, 'w1')).t, (await byId(page, 'p1')).t], [at(12, 30), at(12, 31)], 'moved together, order kept');

  await openRow(page);
  await page.click('#edit-delete');
  await waitToast(page, 'Deleted');
  assert.deepEqual(await todayRows(page), []);
  assert.deepEqual([(await byId(page, 'w1')).deleted, (await byId(page, 'p1')).deleted], [true, true], 'tombstones, not removed');

  await page.getByRole('button', { name: 'Undo' }).click();
  await waitToast(page, 'Restored');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee + Poo']);
  const [w, p] = [await byId(page, 'w1'), await byId(page, 'p1')];
  assert.ok(!('deleted' in w) && !('deleted' in p));
  assert.equal(w.t, at(12, 30));
  assert.deepEqual(errors, []);
  await context.close();
});

test('delete a feed, then Undo', async () => {
  const { context, page, errors } = await start([rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 60 })]);
  await openRow(page);
  await page.click('#edit-delete');
  await waitToast(page, 'Deleted');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await todayRows(page), []);
  assert.equal(await page.isVisible('#today-empty'), true);
  assert.equal((await byId(page, 'b1')).deleted, true);
  await page.getByRole('button', { name: 'Undo' }).click();
  await waitToast(page, 'Restored');
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 60 ml']);
  assert.ok(!('deleted' in (await byId(page, 'b1'))));
  assert.deepEqual(errors, []);
  await context.close();
});

test('a time that has not happened yet is refused, and nothing changes', async () => {
  const { context, page, errors } = await start([rec('b1', 'feed', at(13, 59), { kind: 'Bottle', milk: 'Formula', ml: 90 })]);
  const before = await byId(page, 'b1');
  await openRow(page);
  await page.fill('#edit-time', '16:00');
  await page.click('#edit-save');
  await waitToast(page, 'That time has not happened yet.');
  assert.match(await page.evaluate(() => location.hash), /^#edit\//, 'stays on the Edit screen');
  assert.deepEqual(await byId(page, 'b1'), before);
  await page.fill('#edit-time', '14:03'); // up to 5 minutes ahead is allowed
  await page.click('#edit-save');
  await waitToast(page, 'Changes saved');
  assert.equal((await byId(page, 'b1')).t, at(14, 3));
  assert.deepEqual(errors, []);
  await context.close();
});

test('Save with no change leaves the entry alone; Close saves nothing', async () => {
  const { context, page, errors } = await start([rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 90 })]);
  const before = await byId(page, 'b1');
  await openRow(page);
  await page.click('#edit-save');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await byId(page, 'b1'), before, 'not even updatedAt moved');
  await openRow(page);
  await page.fill('#edit-ml', '200');
  await page.click('#screen-edit a[aria-label="Close"]');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await byId(page, 'b1'), before);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an entry that is gone is explained, not a blank screen', async () => {
  const { context, page, errors } = await start([]);
  await open(page, `${url()}#edit/does-not-exist`);
  await waitToast(page, 'That entry is not there any more.');
  await page.waitForFunction(() => location.hash === '#today');
  assert.equal(await page.isVisible('#screen-edit'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an update waits while the Edit screen is open', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await start([rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 90 })]);
  await openRow(page);
  await page.fill('#edit-ml', '110');
  await page.evaluate(() => { window.__sameLoad = true; });
  site.test = 'test-v2';
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await page.waitForFunction(() => caches.keys().then((k) => k.includes('test-baby-log-shell-test-v2')));
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__sameLoad === true), true, 'not reloaded');
  assert.equal(await page.inputValue('#edit-ml'), '110');
  await page.click('#screen-edit a[aria-label="Close"]');
  const s = await state(page, { until: (x) => x.pageVersion === 'test-v2', timeoutMs: 12000 });
  assert.equal(s.pageVersion, 'test-v2');
  assert.deepEqual(errors, []);
  await context.close();
});
