// Feature 004 in a real browser: the "Add a past sleep" card on the Sleep page.
// The clock is fixed at 2:00 pm on 3 Oct 2026, so the tests behave the same at any time of day.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, seed, readRecords } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' })));
after(() => close?.());

const NOW = new Date(2026, 9, 3, 14, 0).getTime();
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime();
const url = () => `${origin}/baby-log/test/`;
const sleepRec = (id, t, end) => ({ id, type: 'sleep', t, end, d: { source: 'live' }, note: '', by: '', deviceId: 'other-phone', updatedAt: end ?? t });

async function start(seedRecords = []) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(NOW);
  await install(p.page, url());
  for (const r of seedRecords) await seed(p.page, r);
  await p.page.reload();
  await p.page.waitForSelector('#today-list .row, #today-empty:not([hidden])');
  await p.page.click('a.sleep-main');
  await p.page.waitForSelector('#screen-sleep[data-ready]');
  return p;
}
const sleeps = async (page) => (await readRecords(page)).filter((r) => r.type === 'sleep');
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());
const hint = (page) => page.isVisible('#ps-hint').then((v) => (v ? text(page, '#ps-hint') : ''));

// The middle of the clock ring on screen, and the point at `deg` degrees from 12 o'clock on a circle of radius `r` (drawing units).
async function ringPoint(page, deg, r) {
  const box = await page.locator('#ps-clock').boundingBox();
  const k = box.width / 300, a = (deg * Math.PI) / 180;
  return { x: box.x + (150 + Math.sin(a) * r) * k, y: box.y + (150 - Math.cos(a) * r) * k };
}

test('opens on the 30 minutes that ended now; the step buttons change the length; Add saves a manual sleep', async () => {
  const { context, page, errors } = await start();
  assert.equal(await text(page, '#ps-len'), '30m');
  assert.equal(await text(page, '#ps-range'), '1:30 pm – 2:00 pm');
  assert.equal(await page.inputValue('#ps-from'), '13:30');
  assert.equal(await page.inputValue('#ps-to'), '14:00');
  assert.equal(await page.isDisabled('#ps-add'), false);
  assert.equal(await text(page, '#ps-add'), 'Add sleep · 30m');
  assert.equal(await page.getAttribute('.ps-part[data-part="1"]', 'aria-pressed'), 'true', 'the afternoon is picked');

  await page.click('.ps-step[data-add="60"]');
  assert.equal(await text(page, '#ps-len'), '1h 30m');
  assert.equal(await text(page, '#ps-minus'), '−1h');
  await page.click('#ps-minus');
  assert.equal(await text(page, '#ps-len'), '30m');
  await page.click('.ps-step[data-add="20"]');
  await page.click('#ps-reset');
  assert.equal(await text(page, '#ps-len'), '30m', 'the arrow goes back to 30 minutes');

  await page.click('#ps-add');
  await page.waitForFunction(() => document.querySelectorAll('#sleep-list .row').length === 1);
  const [r] = await sleeps(page);
  assert.equal(r.t, at(13, 30));
  assert.equal(r.end, at(14, 0));
  assert.deepEqual(r.d, { source: 'manual' });
  assert.equal(r.type, 'sleep');
  assert.equal(await hint(page), 'Added.');
  assert.deepEqual(errors, []);
  await context.close();
});

test('typed times move the ring; a sleep before the logged one cannot overlap it', async () => {
  const { context, page, errors } = await start([sleepRec('s1', at(13, 0), at(13, 40))]);
  assert.equal(await hint(page), 'Overlaps a sleep already logged.', 'the first draft (1:30 to 2:00) overlaps');
  assert.equal(await page.isDisabled('#ps-add'), true);
  assert.equal(await page.getAttribute('#ps-draft', 'stroke'), '#b5561a', 'the arc turns orange');

  await page.fill('#ps-from', '13:40');
  assert.equal(await hint(page), '', 'starting where the other sleep ended is fine');
  assert.equal(await page.isDisabled('#ps-add'), false);
  assert.equal(await text(page, '#ps-len'), '20m');
  await page.fill('#ps-from', '11:00');
  await page.fill('#ps-to', '12:15');
  assert.equal(await text(page, '#ps-range'), '11:00 am – 12:15 pm');
  assert.equal(await page.getAttribute('.ps-part[data-part="0"]', 'aria-pressed'), 'true', 'the parts follow the times');
  assert.equal(await page.getAttribute('.ps-part[data-part="1"]', 'aria-pressed'), 'true');
  await page.click('#ps-add');
  await page.waitForFunction(() => document.querySelectorAll('#sleep-list .row').length === 2);
  const added = (await sleeps(page)).find((r) => r.id !== 's1');
  assert.equal(added.t, at(11, 0));
  assert.equal(added.end, at(12, 15));
  assert.deepEqual(errors, []);
  await context.close();
});

test('a sleep that has not happened yet cannot be added', async () => {
  const { context, page, errors } = await start();
  await page.fill('#ps-to', '17:00');
  assert.equal(await hint(page), 'That time has not happened yet.');
  assert.equal(await page.isDisabled('#ps-add'), true);
  await page.fill('#ps-to', '14:00');
  assert.equal(await page.isDisabled('#ps-add'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('last night and after midnight land on the right day', async () => {
  const { context, page, errors } = await start();
  await page.click('.ps-part[data-part="2"]'); // 6 pm to 12 am: this afternoon it means last evening
  await page.fill('#ps-from', '21:00');
  await page.fill('#ps-to', '22:30');
  await page.click('#ps-add');
  await page.waitForFunction(() => document.querySelectorAll('#sleep-list .row').length === 1);
  await page.click('.ps-part[data-part="3"]'); // 12 am to 6 am: the one that began today
  await page.fill('#ps-from', '01:00');
  await page.fill('#ps-to', '02:00');
  await page.click('#ps-add');
  await page.waitForFunction(() => document.querySelectorAll('#sleep-list .row').length === 2);
  const all = (await sleeps(page)).sort((a, b) => a.t - b.t);
  assert.deepEqual(all.map((r) => [r.t, r.end]), [[at(21, 0, 2), at(22, 30, 2)], [at(1, 0, 3), at(2, 0, 3)]]);
  assert.deepEqual(errors, []);
  await context.close();
});

test('dragging the start dot changes the start; dragging the arc moves the whole sleep', async () => {
  const { context, page, errors } = await start();
  // 1:30 pm is 45 degrees on a 12 hour clock (1:30 is 90 minutes after 12). Take the start dot out to 30 degrees (1:00 pm).
  const from = await ringPoint(page, 45, 142);
  const to = await ringPoint(page, 30, 142);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  assert.equal(await page.inputValue('#ps-from'), '13:00');
  assert.equal(await page.inputValue('#ps-to'), '14:00', 'the end stays');
  assert.equal(await text(page, '#ps-len'), '1h 00m');

  // The middle of the arc is at 1:30 pm (45 degrees); move it back by 30 minutes.
  const mid = await ringPoint(page, 45, 118);
  const back = await ringPoint(page, 30, 118);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(back.x, back.y, { steps: 6 });
  await page.mouse.up();
  assert.equal(await page.inputValue('#ps-from'), '12:30');
  assert.equal(await page.inputValue('#ps-to'), '13:30');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the card fits narrow phones (no sideways scrolling)', async () => {
  const { context, page, errors } = await start();
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, `no sideways scrolling at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});
