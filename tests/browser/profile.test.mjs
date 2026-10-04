// Feature 002 in a real browser: the baby profile screen and the header on Today (with feature 014: a baby is added first).
// The clock is fixed at 3 Oct 2026, so the age text is the same on any day.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, readRecords } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' })));
after(() => close?.());

const url = () => `${origin}/baby-log/test/`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());

async function start(opts) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(new Date(2026, 9, 3, 14, 0));
  await install(p.page, url(), opts);
  return p;
}
// A new phone has no baby: it opens on the welcome screen, and "Add a baby" opens an empty profile.
async function addBabyScreen(page) {
  await page.waitForSelector('#screen-babies[data-ready]');
  await page.click('#bb-add');
  await page.waitForSelector('#screen-profile[data-ready]');
}
const profiles = async (page) => (await readRecords(page)).filter((r) => r.type === 'profile');

test('a new phone opens on the welcome screen; Add a baby opens the profile; Save needs all three fields', async () => {
  const { context, page, errors } = await start({ baby: false });
  await page.waitForSelector('#screen-babies[data-ready]');
  assert.equal(await page.evaluate(() => location.hash), '#babies');
  assert.equal(await text(page, '#bb-intro'), 'Welcome. Add your baby to start.');
  assert.equal(await page.isVisible('#bb-back'), false, 'there is nowhere to go back to without a baby');
  await addBabyScreen(page);
  assert.equal(await text(page, '#h-profile'), 'Add a baby');
  assert.equal(await page.isDisabled('#pf-save'), true);
  await page.fill('#pf-nickname', 'Bean');
  assert.equal(await text(page, '#pf-name'), 'Bean', 'the name updates as you type');
  assert.equal(await page.isDisabled('#pf-save'), true, 'still needs a date of birth and a gender');
  await page.fill('#pf-dob', '2026-09-12');
  assert.equal(await text(page, '#pf-age'), '3 weeks old');
  assert.equal(await page.isDisabled('#pf-save'), true);
  await page.click('#pf-girl');
  assert.equal(await page.getAttribute('#pf-girl', 'aria-pressed'), 'true');
  assert.equal(await page.isDisabled('#pf-save'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('saving the first baby: one profile with a new id, shown on Today, kept after a reload; it can be changed later', async () => {
  const { context, page, errors } = await start({ baby: false });
  await addBabyScreen(page);
  await page.fill('#pf-nickname', 'Bean');
  await page.fill('#pf-dob', '2026-09-12');
  await page.click('#pf-boy');
  await page.setInputFiles('#pf-file', { name: 'baby.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => !document.getElementById('pf-img').hidden);
  assert.equal(await page.isVisible('#pf-empty'), false, 'the photo replaces "Add a photo"');
  await page.click('#pf-save');
  await page.waitForFunction(() => location.hash === '#today' && document.getElementById('bh-name').textContent === 'Bean');
  assert.equal(await text(page, '#bh-sub'), 'Sat 3 Oct · 3 weeks old');
  assert.equal(await page.isVisible('#bh-photo img'), true);

  const [rec] = await profiles(page);
  assert.equal((await profiles(page)).length, 1);
  assert.match(rec.id, /^[0-9a-f-]{36}$/, 'a new baby gets a random id');
  assert.equal(rec.babyId, rec.id, 'a profile belongs to its own baby');
  assert.equal(rec.v, 2);
  assert.equal(rec.d.nickname, 'Bean');
  assert.equal(rec.d.dateOfBirth, '2026-09-12');
  assert.equal(rec.d.sex, 'boy');
  assert.match(rec.d.photo, /^data:image\/jpeg;base64,/);
  assert.ok(rec.d.photo.length < 60000, 'the photo is small');

  await page.reload();
  await page.waitForFunction(() => document.getElementById('bh-name').textContent === 'Bean');
  await page.click('#baby-head');
  await page.waitForSelector('#screen-babies[data-ready]');
  await page.click('.bb-edit');
  await page.waitForSelector('#screen-profile[data-ready]');
  assert.equal(await text(page, '#h-profile'), 'Baby profile');
  assert.equal(await page.inputValue('#pf-nickname'), 'Bean');
  assert.equal(await page.inputValue('#pf-dob'), '2026-09-12');
  assert.equal(await page.getAttribute('#pf-boy', 'aria-pressed'), 'true');
  await page.fill('#pf-nickname', 'Beanie');
  await page.click('#pf-save');
  await page.waitForFunction(() => location.hash === '#today' && document.getElementById('bh-name').textContent === 'Beanie');
  const after = await profiles(page);
  assert.equal(after.length, 1, 'still one profile');
  assert.equal(after[0].id, rec.id);
  assert.ok(after[0].updatedAt > rec.updatedAt, 'the change moved updatedAt forward');
  assert.equal(after[0].d.sex, 'boy', 'other fields stay');
  assert.deepEqual(errors, []);
  await context.close();
});

test('leaving the profile with the back button saves nothing', async () => {
  const { context, page, errors } = await start({ baby: false });
  await addBabyScreen(page);
  await page.fill('#pf-nickname', 'Bean');
  await page.click('#screen-profile a[aria-label="Back"]');
  await page.waitForSelector('#screen-babies[data-ready]');
  assert.equal(await page.evaluate(() => location.hash), '#babies');
  assert.equal((await profiles(page)).length, 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the profile screen and the Today header fit narrow phones', async () => {
  const { context, page, errors } = await start();
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Today at ${width}px`);
  }
  await page.click('#baby-head');
  await page.waitForSelector('#screen-babies[data-ready]');
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Babies at ${width}px`);
  }
  await page.click('.bb-edit');
  await page.waitForSelector('#screen-profile[data-ready]');
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Profile at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});
