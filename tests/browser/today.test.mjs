// Feature 008 in a real browser: the "Last feed" card and the Today list with feeds, nappies and sleeps.
// The clock is fixed at 5:17 pm on 3 Oct 2026, so the tests behave the same at any time of day.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, seed, todayRows } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' })));
after(() => close?.());

const NOW = new Date(2026, 9, 3, 17, 17).getTime();
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime();
const url = () => `${origin}/baby-log/test/`;
const rec = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'other-phone', updatedAt: t, ...extra });

async function start(records = [], { running = false } = {}) {
  const p = await phone(browser);
  if (running) await p.context.clock.install({ time: NOW });   // a clock that can be moved forward
  else await p.context.clock.setFixedTime(NOW);
  await install(p.page, url());
  for (const r of records) await seed(p.page, r);
  await p.page.reload();
  await p.page.waitForSelector('#today-list .row, #today-empty:not([hidden])');
  return p;
}
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());

test('with nothing logged, the Last feed card and the list say so', async () => {
  const { context, page, errors } = await start();
  assert.equal(await text(page, '#lf-big'), 'No feed yet');
  assert.equal(await page.isVisible('#today-empty'), true);
  assert.equal(await text(page, '#today-empty'), 'Nothing logged yet today.');
  assert.deepEqual(errors, []);
  await context.close();
});

test('Last feed shows how long ago, with its time and details; deleted feeds are ignored', async () => {
  const { context, page, errors } = await start([
    rec('f1', 'feed', at(15, 2), { d: { kind: 'Breast', side: 'Left', min: 14, leftMin: 14, rightMin: 0 } }),
    rec('f2', 'feed', at(14, 0), { d: { kind: 'Bottle', ml: 90 } }),
    rec('f3', 'feed', at(16, 30), { d: { kind: 'Bottle', ml: 60 }, deleted: true })
  ]);
  assert.equal(await text(page, '#lf-big'), '2h 15m ago');
  assert.equal(await text(page, '#lf-detail'), '3:02 pm · Left 14 min');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the Last feed time counts on while the app stays open', async () => {
  const { context, page, errors } = await start([rec('f1', 'feed', at(15, 2), { d: { kind: 'Bottle', ml: 90 } })], { running: true });
  assert.equal(await text(page, '#lf-big'), '2h 15m ago');
  await page.clock.fastForward(5 * 60000);
  await page.waitForFunction(() => document.getElementById('lf-big').textContent === '2h 20m ago');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the Today list mixes feeds, nappies and sleeps, newest first; a sleep opens its edit page', async () => {
  const sleep = (id, t, end) => rec(id, 'sleep', t, { end, d: { source: 'live' } });
  const { context, page, errors } = await start([
    rec('f1', 'feed', at(15, 2), { d: { kind: 'Breast', side: 'Left', min: 14 } }),
    rec('n1', 'pee', at(14, 40)),
    sleep('s1', at(11, 50), at(13, 40)),
    sleep('s2', at(17, 0), null),
    sleep('old', at(20, 0, 2), at(5, 50, 3))   // woke before 6 am: belongs to yesterday
  ]);
  assert.deepEqual(await todayRows(page), ['Fell asleep · asleep now', 'Feed · Left 14 min', 'Nappy · Wee', 'Woke up · slept 1h 50m']);
  await page.locator('#today-list .row-link').nth(3).click();
  await page.waitForSelector('#screen-sleep-edit[data-ready]');
  assert.equal(await page.evaluate(() => location.hash.startsWith('#edit/')), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the Last feed card fits narrow phones', async () => {
  const { context, page, errors } = await start([rec('f1', 'feed', at(9, 0), { d: { kind: 'Breast', side: 'Both', min: 20, leftMin: 8, rightMin: 12 } })]);
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `no sideways scrolling at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});
