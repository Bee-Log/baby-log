// Feature 009 in a real browser: the Summary tab. The clock is fixed at 5:17 pm on Sat 3 Oct 2026.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, seed, tapTab } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' })));
after(() => close?.());

const NOW = new Date(2026, 9, 3, 17, 17).getTime();
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime();
const url = () => `${origin}/baby-log/test/`;
const rec = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'x', updatedAt: t, ...extra });
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());

const TODAY = [
  rec('f1', 'feed', at(7), { d: { kind: 'Breast', side: 'Left', min: 10 } }),
  rec('f2', 'feed', at(9), { d: { kind: 'Bottle', ml: 90 } }),
  rec('f3', 'feed', at(12), { d: { kind: 'Breast', side: 'Right', min: 8 } }),
  rec('f4', 'feed', at(15), { d: { kind: 'Bottle', ml: 60 } }),
  rec('n1', 'pee', at(8)), rec('n2', 'poop', at(8, 1)), rec('n3', 'pee', at(10)), rec('n4', 'poop', at(12)),
  rec('s1', 'sleep', at(8), { end: at(9, 30), d: { source: 'live' } }),
  rec('s2', 'sleep', at(12), { end: at(14, 10), d: { source: 'live' } })
];
const YESTERDAY = [rec('y1', 'feed', at(8, 0, 2), { d: { kind: 'Breast', side: 'Left', min: 5 } }), rec('y2', 'feed', at(11, 0, 2), { d: { kind: 'Breast', side: 'Left', min: 5 } })];

async function start(records) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(NOW);
  await install(p.page, url());
  for (const r of records) await seed(p.page, r);
  await p.page.reload();
  await tapTab(p.page, 'summary');
  await p.page.waitForFunction(() => document.getElementById('sum-feeds').textContent !== '0' || document.getElementById('sum-feeds-sub').textContent !== '');
  return p;
}

test('the totals for today', async () => {
  const { context, page, errors } = await start([...TODAY, ...YESTERDAY]);
  assert.equal(await text(page, '#h-summary'), 'Today');
  assert.equal(await text(page, '#sum-date'), 'Sat 3 Oct · so far');
  assert.equal(await text(page, '#sum-feeds'), '4');
  assert.equal(await text(page, '#sum-feeds-sub'), 'Breast 2 · Bottle 2 (150 ml)');
  assert.equal(await text(page, '#sum-nappies'), '3');
  assert.equal(await text(page, '#sum-nappies-sub'), 'Wee 2 · Poo 2');
  assert.equal(await text(page, '#sum-sleep'), '3h 40m');
  assert.equal(await text(page, '#sum-sleep-sub'), 'Longest stretch 2h 10m');
  assert.equal(await text(page, '#sum-gap'), '2h 40m');
  assert.equal(await page.isDisabled('#sum-next'), true, 'there is no tomorrow');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the seven bars: counts per day, today highlighted, oldest first', async () => {
  const { context, page, errors } = await start([...TODAY, ...YESTERDAY]);
  const counts = await page.$$eval('#sum-bars .sum-bar span', (els) => els.map((e) => e.textContent));
  assert.deepEqual(counts, ['0', '0', '0', '0', '0', '2', '4']);
  assert.equal(await page.$$eval('#sum-bars .sum-bar.selected', (els) => els.length), 1);
  const letters = await page.$$eval('#sum-days div', (els) => els.map((e) => e.textContent));
  assert.deepEqual(letters, ['S', 'M', 'T', 'W', 'T', 'F', 'S'], 'Sun 27 Sep to Sat 3 Oct');
  const heights = await page.$$eval('#sum-bars .sum-bar i', (els) => els.map((e) => parseInt(e.style.height, 10)));
  assert.ok(heights[6] > heights[5] && heights[5] > heights[0], 'taller for more feeds');
  assert.equal(heights[6], 90, 'the busiest day fills the chart');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the arrows move between days; the last day with entries is the limit', async () => {
  const { context, page, errors } = await start([...TODAY, ...YESTERDAY]);
  await page.click('#sum-prev');
  assert.equal(await text(page, '#h-summary'), 'Yesterday');
  assert.equal(await text(page, '#sum-date'), 'Fri 2 Oct');
  assert.equal(await text(page, '#sum-feeds'), '2');
  assert.equal(await text(page, '#sum-gap'), '3h 00m');
  assert.equal(await text(page, '#sum-sleep-sub'), 'No sleep logged');
  assert.equal(await page.isDisabled('#sum-prev'), true, 'nothing older than yesterday');
  assert.equal(await page.isDisabled('#sum-next'), false);
  await page.click('#sum-next');
  assert.equal(await text(page, '#h-summary'), 'Today');
  assert.deepEqual(errors, []);
  await context.close();
});

test('with no entries every total is zero and nothing breaks', async () => {
  const { context, page, errors } = await start([]);
  assert.equal(await text(page, '#sum-feeds'), '0');
  assert.equal(await text(page, '#sum-gap'), '—');
  assert.equal(await text(page, '#sum-gap-sub'), 'Needs 2 feeds');
  assert.equal(await page.isDisabled('#sum-prev'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the summary fits narrow phones', async () => {
  const { context, page, errors } = await start([...TODAY, ...YESTERDAY]);
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `no sideways scrolling at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});
