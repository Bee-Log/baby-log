// Feature 002 in a real browser: the baby profile screen and the header on Today.
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

async function start() {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(new Date(2026, 9, 3, 14, 0));
  await install(p.page, url());
  return p;
}
async function openProfile(page) {
  await page.click('#baby-head');
  await page.waitForSelector('#screen-profile[data-ready]');
}
const profiles = async (page) => (await readRecords(page)).filter((r) => r.type === 'profile');

test('before a profile exists, Today shows the date and a placeholder name; Save needs all three fields', async () => {
  const { context, page, errors } = await start();
  assert.equal(await text(page, '#bh-name'), '[Nickname]');
  assert.equal(await text(page, '#bh-sub'), 'Sat 3 Oct');
  await openProfile(page);
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

test('saving the profile: one record, shown on Today, kept after a reload; it can be changed later', async () => {
  const { context, page, errors } = await start();
  await openProfile(page);
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
  assert.equal(rec.id, 'profile');
  assert.equal(rec.d.nickname, 'Bean');
  assert.equal(rec.d.dateOfBirth, '2026-09-12');
  assert.equal(rec.d.sex, 'boy');
  assert.match(rec.d.photo, /^data:image\/jpeg;base64,/);
  assert.ok(rec.d.photo.length < 60000, 'the photo is small');

  await page.reload();
  await page.waitForFunction(() => document.getElementById('bh-name').textContent === 'Bean');
  await openProfile(page);
  assert.equal(await page.inputValue('#pf-nickname'), 'Bean');
  assert.equal(await page.inputValue('#pf-dob'), '2026-09-12');
  assert.equal(await page.getAttribute('#pf-boy', 'aria-pressed'), 'true');
  await page.fill('#pf-nickname', 'Beanie');
  await page.click('#pf-save');
  await page.waitForFunction(() => document.getElementById('bh-name').textContent === 'Beanie');
  const after = await profiles(page);
  assert.equal(after.length, 1, 'still one profile');
  assert.ok(after[0].updatedAt > rec.updatedAt, 'the change moved updatedAt forward');
  assert.equal(after[0].d.sex, 'boy', 'other fields stay');
  assert.deepEqual(errors, []);
  await context.close();
});

test('leaving the profile with the back button saves nothing', async () => {
  const { context, page, errors } = await start();
  await openProfile(page);
  await page.fill('#pf-nickname', 'Bean');
  await page.click('#screen-profile a[aria-label="Back"]');
  await page.waitForFunction(() => location.hash === '#today');
  assert.equal(await text(page, '#bh-name'), '[Nickname]');
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
  await openProfile(page);
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Profile at ${width}px`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});
