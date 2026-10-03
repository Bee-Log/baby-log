// Editing and deleting a sleep in a real browser: the Edit sleep screen, with Delete at the top.
// The clock is fixed at 5:17 pm on Sat 3 Oct 2026.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, seed, readRecords, todayRows } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' })));
after(() => close?.());

const NOW = new Date(2026, 9, 3, 17, 17).getTime();
const at = (h, m = 0) => new Date(2026, 9, 3, h, m).getTime();
const url = () => `${origin}/baby-log/test/`;
const sleepRec = (id, t, end) => ({ id, type: 'sleep', t, end, d: { source: 'manual' }, note: '', by: '', deviceId: 'x', updatedAt: t });
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());
const sleeps = async (page) => (await readRecords(page)).filter((r) => r.type === 'sleep');

async function start(records) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(NOW);
  await install(p.page, url());
  for (const r of records) await seed(p.page, r);
  await p.page.reload();
  await p.page.waitForSelector('#today-list .row');
  return p;
}
const openFirstRow = async (page) => { await page.locator('#today-list .row-link').first().click(); await page.waitForSelector('#screen-sleep-edit[data-ready]'); };

test('tapping a sleep on Today opens its edit page, with Delete at the top', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(12, 0), at(13, 40))]);
  await openFirstRow(page);
  assert.equal(await text(page, '#h-sleep-edit'), 'Edit sleep');
  assert.equal(await page.inputValue('#se-from'), '2026-10-03T12:00');
  assert.equal(await page.inputValue('#se-to'), '2026-10-03T13:40');
  const box = await page.locator('#se-delete').boundingBox();
  assert.ok(box.y < 120, 'Delete is in the top bar');
  assert.ok(box.width >= 44 && box.height >= 44, 'big enough to tap');
  assert.deepEqual(errors, []);
  await context.close();
});

test('Delete asks first: one tap arms it, a second tap deletes, and the sleep leaves the list', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(12, 0), at(13, 40))]);
  await openFirstRow(page);
  await page.click('#se-delete');
  assert.equal(await page.locator('#se-delete').evaluate((e) => e.classList.contains('armed')), true);
  assert.equal(await page.isVisible('#se-delete .head-delete-text'), true, 'it says "Tap again to delete"');
  assert.equal((await sleeps(page))[0].deleted, undefined, 'nothing is deleted by the first tap');
  await page.click('#se-delete');
  await page.waitForFunction(() => location.hash === '#today' && document.getElementById('toast-text').textContent === 'Deleted');
  const [r] = await sleeps(page);
  assert.equal(r.deleted, true, 'a tombstone, so sync can carry the delete');
  assert.ok(r.updatedAt > at(12, 0));
  assert.deepEqual(await todayRows(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the Delete arming wears off, so a later single tap does not delete', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(12, 0), at(13, 40))]);
  await openFirstRow(page);
  await page.click('#se-delete');
  await page.waitForFunction(() => !document.getElementById('se-delete').classList.contains('armed'), null, { timeout: 8000 });
  await page.click('#se-delete');
  assert.equal(await page.evaluate(() => location.hash.startsWith('#edit/')), true, 'still on the edit page');
  assert.equal((await sleeps(page))[0].deleted, undefined);
  assert.deepEqual(errors, []);
  await context.close();
});

test('change when the sleep began and ended; the same entry is updated', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(12, 0), at(13, 40))]);
  await openFirstRow(page);
  await page.fill('#se-from', '2026-10-03T11:30');
  await page.fill('#se-to', '2026-10-03T13:00');
  await page.click('#se-save');
  await page.waitForFunction(() => location.hash === '#today' && document.getElementById('toast-text').textContent === 'Changes saved');
  const all = await sleeps(page);
  assert.equal(all.length, 1, 'still one sleep');
  assert.equal(all[0].id, 's1');
  assert.deepEqual([all[0].t, all[0].end], [at(11, 30), at(13, 0)]);
  assert.ok(all[0].updatedAt > at(12, 0), 'updatedAt moved forward');
  assert.deepEqual(await todayRows(page), ['Woke up · slept 1h 30m']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a sleep that cannot be saved says why, and Save stays off', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(12, 0), at(13, 0)), sleepRec('s2', at(14, 0), at(15, 0))]);
  await page.locator('#today-list .row-link').nth(1).click();          // the older one (12:00 to 1:00 pm)
  await page.waitForSelector('#screen-sleep-edit[data-ready]');
  const hint = async () => (await page.isVisible('#se-hint')) ? text(page, '#se-hint') : '';
  await page.fill('#se-to', '2026-10-03T11:00');
  assert.equal(await hint(), 'Woke up must be after fell asleep.');
  assert.equal(await page.isDisabled('#se-save'), true);
  await page.fill('#se-to', '2026-10-03T14:30');
  assert.equal(await hint(), 'Overlaps a sleep already logged.');
  await page.fill('#se-to', '2026-10-03T18:30');
  assert.equal(await hint(), 'That time has not happened yet.');
  await page.fill('#se-from', '2026-10-02T23:00');
  await page.fill('#se-to', '2026-10-03T13:00');
  assert.equal(await hint(), 'A sleep can be 12 hours at most.');
  await page.fill('#se-from', '2026-10-03T12:30');
  assert.equal(await hint(), '');
  assert.equal(await page.isDisabled('#se-save'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a sleep that is still running: only the start time, and it can be deleted', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(17, 0), null)]);
  await openFirstRow(page);
  assert.equal(await page.isVisible('#se-to'), false);
  assert.equal(await page.isVisible('#se-running'), true);
  await page.fill('#se-from', '2026-10-03T16:50');
  await page.click('#se-save');
  await page.waitForFunction(() => location.hash === '#today');
  const [r] = await sleeps(page);
  assert.equal(r.t, at(16, 50));
  assert.equal(r.end, null, 'still running');
  await openFirstRow(page);
  await page.click('#se-delete'); await page.click('#se-delete');
  await page.waitForFunction(() => location.hash === '#today');
  assert.equal((await sleeps(page))[0].deleted, true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the Sleep page list also opens the edit page; Save with no change leaves the entry alone', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(12, 0), at(13, 0))]);
  await page.click('a.sleep-main');
  await page.waitForSelector('#screen-sleep[data-ready]');
  await page.click('#sleep-list .sleep-row');
  await page.waitForSelector('#screen-sleep-edit[data-ready]');
  const before = (await sleeps(page))[0];
  await page.click('#se-save');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual((await sleeps(page))[0], before, 'nothing changed');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the edit page fits narrow phones', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(12, 0), at(13, 40))]);
  await openFirstRow(page);
  await page.click('#se-delete');                                       // the armed (wider) button too
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `no sideways scrolling at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});
