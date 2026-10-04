// Feature 003 in a real browser: Start sleep / Wake up on Today and on the Sleep page, and the logged sleeps.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, open, seed, readRecords } from './helpers.mjs';

let origin, site, browser, close;
before(async () => ({ origin, site, browser, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' })));
after(() => close?.());

const url = () => `${origin}/baby-log/test/`;
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime(); // 3 Oct 2026, local time
const sleepRec = (id, t, end, extra = {}) => ({ id, type: 'sleep', t, end, d: { source: 'live' }, note: '', by: '', deviceId: 'other-phone', updatedAt: end ?? t, ...extra });
const card = async (page, prefix) => ({
  asleep: await page.locator(`#${prefix}-card`).evaluate((e) => e.classList.contains('asleep')),
  sub: await page.textContent(`#${prefix}-sub`),
  big: await page.textContent(`#${prefix}-big`),
  button: (await page.textContent(`#${prefix}-btn`)).trim(),
  pressed: await page.getAttribute(`#${prefix}-btn`, 'aria-pressed')
});
const sleeps = async (page) => (await readRecords(page)).filter((r) => r.type === 'sleep');
const sleepPage = async (page) => { await page.click('a.sleep-main'); await page.waitForSelector('#screen-sleep[data-ready]'); };

test('Today starts with no sleep logged; Start sleep makes the card dark and keeps the sleep when the app is closed', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  assert.deepEqual(await card(page, 'tc'), { asleep: false, sub: 'Sleep', big: 'Not logged yet', button: 'Start sleep', pressed: 'false' });

  await page.click('#tc-btn');
  await page.waitForFunction(() => document.getElementById('tc-btn').getAttribute('aria-pressed') === 'true');
  const c = await card(page, 'tc');
  assert.equal(c.asleep, true, 'the card turns dark while the baby sleeps');
  assert.equal(c.sub, 'Asleep since');
  assert.match(c.big, /^\d{1,2}:\d{2} [ap]m$/);
  assert.equal(c.button, 'Wake up');
  const [r] = await sleeps(page);
  assert.equal(r.end, null, 'a sleep that is still running has no end');
  assert.deepEqual(r.d, { source: 'live' });
  assert.ok(Math.abs(r.t - Date.now()) < 60000);

  await open(page, url()); // close and reopen the app
  await page.reload();
  await page.waitForSelector('#tc-card.asleep');
  assert.equal((await card(page, 'tc')).button, 'Wake up', 'still asleep after the app was closed');
  assert.equal((await sleeps(page)).length, 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the card opens the Sleep page; the running time counts; Wake up ends the sleep and logs it', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('#tc-btn');
  await page.waitForSelector('#tc-card.asleep');
  await sleepPage(page);
  assert.equal(await page.isVisible('.tabbar'), false, 'a full screen');
  assert.equal(await page.textContent('#h-sleep'), 'Sleep');
  const asleep = await card(page, 'pc');
  assert.equal(asleep.asleep, true);
  assert.match(asleep.sub, /^Fell asleep at \d{1,2}:\d{2} [ap]m$/);
  assert.equal(await page.isVisible('#sleep-empty'), true, 'nothing is logged until the baby wakes');
  await page.waitForTimeout(2300);
  assert.match(await page.textContent('#pc-big'), /^Asleep 00:00:0[2-4]$/, 'the time counts up');

  await page.click('#pc-btn');                              // Wake up
  await page.waitForFunction(() => document.getElementById('pc-btn').getAttribute('aria-pressed') === 'false');
  const awake = await card(page, 'pc');
  assert.equal(awake.asleep, false);
  assert.match(awake.sub, /^Woke up at \d{1,2}:\d{2} [ap]m$/);
  assert.match(awake.big, /^Awake 0m$/);
  assert.equal(awake.button, 'Start sleep');
  const [r] = await sleeps(page);
  assert.ok(r.end >= r.t + 2000, 'the same record now has its end time');
  assert.ok(r.updatedAt > r.t);
  assert.equal(await page.locator('#sleep-list .row').count(), 1, 'it is in the Logged sleeps list');
  assert.match(await page.locator('#sleep-list .row').first().textContent(), /\d{1,2}:\d{2} [ap]m – \d{1,2}:\d{2} [ap]m0m/);

  await page.click('#screen-sleep a[aria-label="Back"]');
  await page.waitForSelector('.tabbar', { state: 'visible' });
  const today = await card(page, 'tc');
  assert.equal(today.asleep, false);
  assert.equal(today.sub, 'Awake since');
  assert.equal((await sleeps(page)).length, 1, 'one sleep, started and ended');
  assert.deepEqual(errors, []);
  await context.close();
});

test('logged sleeps: newest first with their length; "Awake ..." counts from the last wake-up', async () => {
  const { context, page, errors } = await phone(browser);
  await context.clock.setFixedTime(new Date(2026, 9, 3, 17, 17));
  await install(page, url());
  await seed(page, sleepRec('a', at(9, 0), at(10, 30)));
  await seed(page, sleepRec('b', at(12, 0), at(13, 40)));
  await seed(page, sleepRec('old', at(23, 50, 2), at(2, 10)));       // began before today (6 am to 6 am)
  await seed(page, sleepRec('removed', at(15), at(16), { deleted: true }));
  await page.reload();
  await page.waitForSelector('#tc-card');
  assert.deepEqual(await card(page, 'tc'), { asleep: false, sub: 'Awake since', big: '1:40 pm', button: 'Start sleep', pressed: 'false' });

  await sleepPage(page);
  assert.deepEqual(await card(page, 'pc'), { asleep: false, sub: 'Woke up at 1:40 pm', big: 'Awake 3h 37m', button: 'Start sleep', pressed: 'false' });
  const rows = await page.$$eval('#sleep-list .row .sleep-row', (els) => els.map((e) => [...e.children].slice(1).map((c) => c.textContent)));
  assert.deepEqual(rows, [
    ['12:00 pm – 1:40 pm', '1h 40m'],
    ['9:00 am – 10:30 am', '1h 30m'],
    ['Fri 2 Oct, 11:50 pm – 2:10 am', '2h 20m']
  ]);
  assert.equal(await page.isVisible('#sleep-empty'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('Start sleep and Wake up work offline', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await context.setOffline(true);
  await open(page, `${url()}#sleep`);
  await page.waitForSelector('#screen-sleep[data-ready]');
  await page.click('#pc-btn');
  await page.waitForSelector('#pc-card.asleep');
  await page.click('#pc-btn');
  await page.waitForFunction(() => !document.getElementById('pc-card').classList.contains('asleep'));
  assert.equal((await sleeps(page))[0].end !== null, true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('TEST sleeps never reach LIVE storage', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('#tc-btn');
  await page.waitForSelector('#tc-card.asleep');
  await install(page, `${origin}/baby-log/`);
  assert.equal((await card(page, 'tc')).asleep, false, 'LIVE knows nothing about the TEST sleep');
  assert.deepEqual((await readRecords(page, 'baby-log')).filter((r) => r.type === 'sleep'), []);
  assert.equal((await readRecords(page, 'test-baby-log')).filter((r) => r.type === 'sleep').length, 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the sleep card fits on a narrow phone, asleep or awake', async () => {
  for (const width of [320, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 700 } });
    const page = await context.newPage();
    await install(page, url());
    await seed(page, sleepRec('a', Date.now() - 4 * 3600e3, Date.now() - 3 * 3600e3));
    await page.reload();
    await page.waitForSelector('#tc-card');
    const fits = (prefix) => page.evaluate((p) => {
      const c = document.getElementById(p + '-card').getBoundingClientRect(), b = document.getElementById(p + '-btn').getBoundingClientRect();
      const t = document.getElementById(p + '-big'); const tt = t.getBoundingClientRect();
      return { button: b.right <= c.right && b.left >= c.left, text: t.scrollWidth <= Math.ceil(tt.width) + 1 && tt.right <= b.left + 1 };
    }, prefix);
    assert.deepEqual(await fits('tc'), { button: true, text: true }, `${width}px: awake, Today`);
    await page.click('#tc-btn');
    await page.waitForSelector('#tc-card.asleep');
    assert.deepEqual(await fits('tc'), { button: true, text: true }, `${width}px: asleep, Today`);
    await sleepPage(page);
    assert.deepEqual(await fits('pc'), { button: true, text: true }, `${width}px: asleep, Sleep page`);
    await context.close();
  }
});
