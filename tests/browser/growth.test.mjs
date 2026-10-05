// Feature 010 in a real browser: the Growth tab and the measurement form. The clock is fixed at 3 Oct 2026, noon,
// so the test baby "Bean" (a girl born 12 Sep 2026) is 21 days old. All values are made up.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, seedAsIs, readRecords, testBabyProfile, TEST_BABY } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test' })));
after(() => close?.());

const url = () => `${origin}/baby-log/test/`;
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());
const measurements = async (page) => (await readRecords(page)).filter((r) => r.type === 'growth');
const historyRows = (page) => page.$$eval('#gr-history .gr-row', (rows) => rows.map((r) => [...r.children].map((c) => c.textContent)));

async function start() {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(new Date(2026, 9, 3, 12, 0));
  await install(p.page, url());
  await p.page.click('.tabbar a[data-tab=growth]');
  await p.page.waitForSelector('#view-growth:not([hidden])');
  return p;
}
async function addMeasurement(page, { date, kg, cm }) {
  await page.click('.gr-add');
  await page.waitForSelector('#screen-measure[data-ready]');
  if (date) await page.fill('#ms-date', date);
  if (kg != null) await page.fill('#ms-weight', String(kg));
  if (cm != null) await page.fill('#ms-length', String(cm));
  await page.click('#ms-save');
}
const saved = (page, message) => page.waitForFunction((m) => location.hash === '#growth' && document.getElementById('toast-text').textContent === m
  && document.querySelectorAll('#gr-history .gr-row').length > 0, message);

test('Growth starts empty; Add saves a weight and a length; the cards, chart and history show it', async () => {
  const { context, page, errors } = await start();
  assert.equal(await text(page, '#gr-sex'), 'girls', 'the WHO standard comes from the baby profile');
  assert.equal(await text(page, '#gr-weight'), '—');
  assert.equal(await page.isVisible('#gr-empty'), true);
  assert.equal(await page.$$eval('#gr-chart polygon', (p) => p.length), 2, 'the WHO bands show even before a measurement');

  await page.click('.gr-add');
  await page.waitForSelector('#screen-measure[data-ready]');
  assert.equal(await text(page, '#h-measure'), 'Add measurement');
  assert.equal(await page.inputValue('#ms-date'), '2026-10-03', 'today');
  assert.equal(await page.isVisible('#ms-delete'), false);
  await page.fill('#ms-weight', '4.2');
  await page.fill('#ms-length', '54');
  await page.click('#ms-save');
  await saved(page, 'Measurement saved');

  assert.equal(await text(page, '#gr-weight'), '4.20 kg');
  assert.equal(await text(page, '#gr-length'), '54 cm');
  assert.equal(await text(page, '#gr-weight-change'), 'First measurement');
  assert.equal(await text(page, '#gr-weight-pct'), 'About 75th percentile');
  assert.equal(await text(page, '#gr-length-pct'), 'About 80th percentile');
  assert.deepEqual(await historyRows(page), [['3 Oct', '4.20 kg', '54 cm']]);
  assert.equal(await page.$$eval('#gr-chart circle', (c) => c.length), 1);
  assert.match(await page.getAttribute('#gr-chart', 'aria-label'), /Now 4\.20 kg, About 75th percentile\./);

  const [r] = await measurements(page);
  assert.deepEqual(r.d, { weight: 4200, height: 54 });
  assert.equal(r.babyId, TEST_BABY);
  assert.equal(r.v, 2);

  await page.click('#gr-show-length');
  assert.equal(await text(page, '#gr-chart-title'), 'Length');
  assert.match(await page.getAttribute('#gr-chart', 'aria-label'), /^Length compared with WHO girls percentiles\. Now 54 cm/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an older measurement, then an edit and a delete from the history', async () => {
  const { context, page, errors } = await start();
  await addMeasurement(page, { date: '2026-09-12', kg: 3.4, cm: 50 });
  await saved(page, 'Measurement saved');
  await addMeasurement(page, { date: '2026-09-26', kg: 3.95 });
  await page.waitForFunction(() => document.querySelectorAll('#gr-history .gr-row').length === 2);
  assert.deepEqual(await historyRows(page), [['26 Sep', '3.95 kg', '—'], ['12 Sep · birth', '3.40 kg', '50 cm']]);
  assert.equal(await text(page, '#gr-weight-change'), '+550 g in 14 days');
  assert.equal(await text(page, '#gr-length'), '50 cm', 'the newest length');

  await page.click('#gr-history .gr-row >> nth=0');
  await page.waitForSelector('#screen-measure[data-ready]');
  assert.equal(await text(page, '#h-measure'), 'Edit measurement');
  assert.equal(await page.inputValue('#ms-weight'), '3.95');
  assert.equal(await page.inputValue('#ms-length'), '');
  await page.fill('#ms-length', '52.5');
  await page.click('#ms-save');
  await saved(page, 'Changes saved');
  assert.deepEqual((await historyRows(page))[0], ['26 Sep', '3.95 kg', '52.5 cm']);
  assert.equal((await measurements(page)).length, 2, 'edited in place, not copied');

  await page.click('#gr-history .gr-row >> nth=0');
  await page.waitForSelector('#screen-measure[data-ready]');
  await page.click('#ms-delete');
  assert.equal(await text(page, '#ms-delete'), 'Tap again to delete');
  await page.click('#ms-delete');
  await page.waitForFunction(() => location.hash === '#growth' && document.querySelectorAll('#gr-history .gr-row').length === 1);
  assert.equal((await measurements(page)).filter((r) => r.deleted).length, 1, 'a tombstone, so sync carries the delete');
  assert.deepEqual(errors, []);
  await context.close();
});

test('wrong values are not saved, and the message says why', async () => {
  const { context, page, errors } = await start();
  const tryValues = async (values, message) => {
    await page.fill('#ms-date', values.date || '2026-10-03');
    await page.fill('#ms-weight', values.kg || '');
    await page.fill('#ms-length', values.cm || '');
    await page.click('#ms-save');
    await page.waitForFunction((m) => document.getElementById('toast-text').textContent === m, message);
  };
  await page.click('.gr-add');
  await page.waitForSelector('#screen-measure[data-ready]');
  await tryValues({}, 'Please enter a weight or a length.');
  await tryValues({ kg: '420' }, 'Please check the weight (in kg, for example 4.20).');
  await tryValues({ cm: '5' }, 'Please check the length (in cm, for example 54).');
  await tryValues({ kg: '3.2', date: '2026-09-01' }, 'That date is before the baby was born.');
  await tryValues({ kg: '3.2', date: '2026-10-09' }, 'That date has not happened yet.');
  assert.equal(await page.evaluate(() => location.hash), '#measure');
  assert.deepEqual(await measurements(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a boy uses the WHO boys standard', async () => {
  const { context, page, errors } = await start();
  const boy = testBabyProfile();
  await seedAsIs(page, { ...boy, d: { ...boy.d, sex: 'boy' }, updatedAt: 2 });
  await page.reload();                                   // the app reads the profile again
  await page.waitForFunction(() => document.getElementById('gr-sex').textContent === 'boys');
  assert.equal(await text(page, '#gr-chart-sub'), 'vs WHO boys standard');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the Growth tab and the form fit a narrow phone', async () => {
  const { context, page, errors } = await start();
  await addMeasurement(page, { kg: 4.2, cm: 54 });
  await saved(page, 'Measurement saved');
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 740 });
    assert.ok(await fits(), `Growth at ${width}px`);
  }
  await page.click('.gr-add');
  await page.waitForSelector('#screen-measure[data-ready]');
  assert.ok(await fits(), 'the form at 360px');
  assert.deepEqual(errors, []);
  await context.close();
});
