// Adding a nappy for a date and time that a parent chooses (#nappy). The one-tap Wee and Poo buttons still log "now"
// (tests/browser/nappy.test.mjs). This screen is the optional way to pick the date and time.
// The clock is fixed at 2:00 pm on 3 Oct 2026, so the tests behave the same at any time of day.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, todayRows, seed, readRecords, TEST_BABY } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test' })));
after(() => close?.());

const NOW = new Date(2026, 9, 3, 14, 0).getTime();
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime();
const url = () => `${origin}/baby-log/test/`;
const nappies = async (page) => (await readRecords(page)).filter((r) => r.type === 'pee' || r.type === 'poop');
const waitToast = (page, text) => page.waitForFunction((t) => document.getElementById('toast-text').textContent === t, text);

async function start({ offline = false } = {}) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(NOW);
  await install(p.page, url());
  await p.page.reload();
  await p.page.waitForSelector('#today-list .row, #today-empty:not([hidden])');
  if (offline) await p.context.setOffline(true);
  return p;
}
const openAdd = async (page) => { await page.click('a.quick-more'); await page.waitForSelector('#screen-nappy[data-ready]'); };

test('Today keeps one tap for Wee and Poo, and offers the date and time as a second, optional way', async () => {
  const { context, page, errors } = await start();
  assert.equal((await page.textContent('a.quick-more')).trim(), 'Wee or Poo at another time');
  const box = await page.locator('a.quick-more').boundingBox();
  assert.ok(box.height >= 44, `a finger can tap it (${box.height} px tall)`);
  await page.click('[data-log="pee"]');                    // still one tap, no screen
  await waitToast(page, 'Wee saved');
  assert.equal(await page.evaluate(() => location.hash), '', 'it stays on Today');
  assert.equal((await nappies(page)).length, 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the screen starts at now, and Save waits until Wee, Poo or both is chosen', async () => {
  const { context, page, errors } = await start();
  await openAdd(page);
  assert.equal(await page.textContent('#h-nappy'), 'Add a nappy');
  assert.equal(await page.inputValue('#np-when'), '2026-10-03T14:00', 'the date and time start at now');
  assert.equal(await page.isDisabled('#np-save'), true);
  assert.equal(await page.isVisible('.tabbar'), false);
  await page.click('#np-poop');
  assert.equal(await page.getAttribute('#np-poop', 'aria-pressed'), 'true');
  assert.equal(await page.isDisabled('#np-save'), false);
  await page.click('#np-poop');                            // choose again to take it back
  assert.equal(await page.isDisabled('#np-save'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a nappy for another day is saved with that date, for this baby, and the message says where it went', async () => {
  const { context, page, errors } = await start();
  await openAdd(page);
  await page.click('#np-poop');
  await page.fill('#np-when', '2026-10-02T22:15');         // last night
  await page.click('#np-save');
  await waitToast(page, 'Poo saved for Fri 2 Oct, 10:15 pm');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await todayRows(page), [], 'it is not part of today');
  const saved = await nappies(page);
  assert.equal(saved.length, 1);
  assert.deepEqual([saved[0].type, saved[0].t, saved[0].babyId, saved[0].v, saved[0].end], ['poop', at(22, 15, 2), TEST_BABY, 2, null]);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Wee and Poo together are two entries with the same time, shown as one row; saving with the start time works', async () => {
  const { context, page, errors } = await start();
  await openAdd(page);
  await page.click('#np-pee');
  await page.click('#np-poop');
  await page.fill('#np-when', '2026-10-03T09:30');         // earlier today
  await page.click('#np-save');
  await waitToast(page, 'Wee + Poo saved');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee + Poo']);
  const saved = await nappies(page);
  assert.deepEqual(saved.map((r) => r.type).sort(), ['pee', 'poop']);
  assert.deepEqual(saved.map((r) => r.t), [at(9, 30), at(9, 30)]);
  assert.notEqual(saved[0].id, saved[1].id);

  await openAdd(page);                                     // Save with no date change: logs now
  await page.click('#np-pee');
  await page.click('#np-save');
  await waitToast(page, 'Wee saved');
  assert.ok((await nappies(page)).some((r) => r.type === 'pee' && r.t === NOW));
  assert.deepEqual(errors, []);
  await context.close();
});

test('a time that has not happened yet, or no date at all, cannot be saved; 5 minutes ahead is fine', async () => {
  const { context, page, errors } = await start();
  await openAdd(page);
  await page.click('#np-pee');
  await page.fill('#np-when', '2026-10-04T08:00');         // tomorrow
  assert.equal(await page.isDisabled('#np-save'), true);
  assert.equal((await page.textContent('#np-hint')).trim(), 'That time has not happened yet.');
  await page.fill('#np-when', '');
  assert.equal(await page.isDisabled('#np-save'), true);
  assert.equal((await page.textContent('#np-hint')).trim(), 'Please check the date and time.');
  await page.fill('#np-when', '2026-10-03T14:05');
  assert.equal(await page.isDisabled('#np-save'), false);
  assert.equal(await page.isHidden('#np-hint'), true);
  await page.click('#np-save');
  await waitToast(page, 'Wee saved');
  assert.equal((await nappies(page))[0].t, at(14, 5));
  assert.deepEqual(errors, []);
  await context.close();
});

test('Close saves nothing, a new visit starts clean, and it all works with no network', async () => {
  const { context, page, errors } = await start({ offline: true });
  await openAdd(page);
  await page.click('#np-pee');
  await page.fill('#np-when', '2026-10-01T07:00');
  await page.click('#screen-nappy a[aria-label="Close"]');
  await page.waitForFunction(() => location.hash === '#today');
  assert.equal((await nappies(page)).length, 0, 'nothing was saved');
  await openAdd(page);
  assert.equal(await page.inputValue('#np-when'), '2026-10-03T14:00', 'the old choice is gone');
  assert.equal(await page.getAttribute('#np-pee', 'aria-pressed'), 'false');
  await page.click('#np-poop');
  await page.click('#np-save');
  await waitToast(page, 'Poo saved');
  assert.equal((await nappies(page)).length, 1, 'saved with no network');
  assert.deepEqual(errors, []);
  await context.close();
});
