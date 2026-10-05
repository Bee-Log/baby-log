// Feature 014 in a real browser: more than one baby. Nothing is logged without a baby, each baby shows only its own
// entries, entries from before 014 still show, unreadable entries are kept but hidden, and a new phone can load its
// baby by signing in (with a FAKE Google, see helpers.mjs). All names and entries are made up.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, open, seed, seedAsIs, readRecords, todayRows, fakeGoogle, TEST_BABY } from './helpers.mjs';
import { createFakeDrive } from '../fake-drive.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test' })));
after(() => close?.());

const url = () => `${origin}/baby-log/test/`;
const NOW = new Date(2026, 9, 3, 14, 0).getTime();
const at = (h, m = 0) => new Date(2026, 9, 3, h, m).getTime();
const text = (page, sel) => page.textContent(sel).then((s) => s.trim());
const hash = (page) => page.evaluate(() => location.hash);
const profile = (id, nickname, extra = {}) => ({
  v: 2, id, type: 'profile', babyId: id, t: at(1), end: null, d: { nickname, dateOfBirth: '2026-09-12', sex: 'boy', photo: '' },
  note: '', by: '', deviceId: 'seed', updatedAt: 1, ...extra
});
const entry = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'seed', updatedAt: t, ...extra });

async function start({ baby = true, fake = null } = {}) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(NOW);
  if (fake) await fakeGoogle(p, fake);
  await install(p.page, url(), { baby });
  return p;
}
const babiesReady = (page) => page.waitForSelector('#screen-babies[data-ready]');
const rowNames = (page) => page.$$eval('#bb-list .bb-pick strong', (els) => els.map((e) => e.textContent.trim()));
const nameOnToday = (page, name) => page.waitForFunction((n) => !document.getElementById('view-today').hidden && document.getElementById('bh-name').textContent === n, name);

// Add a baby through the screens, as a parent would.
async function addBaby(page, name) {
  if (await hash(page) !== '#babies') { await page.click('#baby-head'); }
  await babiesReady(page);
  await page.click('#bb-add');
  await page.waitForSelector('#screen-profile[data-ready]');
  await page.fill('#pf-nickname', name);
  await page.fill('#pf-dob', '2026-09-12');
  await page.click('#pf-girl');
  await page.click('#pf-save');
  await nameOnToday(page, name);
}

test('nothing can be logged before a baby is added: every screen leads to the welcome screen', async () => {
  const { context, page, errors } = await start({ baby: false });
  for (const to of ['#today', '#feed', '#sleep', '#summary', '#edit/x']) {
    await open(page, url() + to);
    await babiesReady(page);
    assert.equal(await hash(page), '#babies', `${to} goes to the welcome screen`);
  }
  assert.equal(await page.isVisible('.tabbar'), false, 'no tabs without a baby');
  assert.deepEqual(await readRecords(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test('two babies: the header switches between them; each shows only its own entries; new entries go to the baby on screen', async () => {
  const { context, page, errors } = await start();
  await seedAsIs(page, profile('baby-pip', 'Pip'));
  await seed(page, entry('w1', 'pee', at(9)));                                  // Bean's
  await seed(page, entry('f1', 'feed', at(10), { babyId: 'baby-pip', d: { kind: 'Bottle', ml: 90 } }));
  await open(page, url());
  await nameOnToday(page, 'Bean');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee']);

  await page.click('#baby-head');
  await babiesReady(page);
  assert.equal(await page.isVisible('#bb-back'), true);
  assert.deepEqual(await rowNames(page), ['Bean', 'Pip']);
  assert.equal(await page.getAttribute('.bb-pick[data-id="baby-bean"]', 'aria-current'), 'true', 'the baby on screen is marked');
  await page.click('.bb-pick[data-id="baby-pip"]');
  await nameOnToday(page, 'Pip');
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 90 ml']);
  assert.equal(await text(page, '#lf-detail'), '10:00 am · Bottle 90 ml');

  await page.click('[data-log="poop"]');
  await page.waitForFunction(() => document.querySelectorAll('#today-list .row').length === 2);
  const poo = (await readRecords(page)).find((r) => r.type === 'poop');
  assert.equal(poo.babyId, 'baby-pip', 'logged for the baby on screen');

  // Each baby sleeps on its own: Pip asleep does not make Bean asleep.
  await page.click('#tc-btn');
  await page.waitForSelector('#tc-card.asleep');
  await open(page, url());
  await nameOnToday(page, 'Pip');                                             // the choice is kept
  assert.equal(await page.isVisible('#tc-card.asleep'), true);
  await page.click('#baby-head');
  await babiesReady(page);
  await page.click('.bb-pick[data-id="baby-bean"]');
  await nameOnToday(page, 'Bean');
  assert.equal(await page.isVisible('#tc-card.asleep'), false, 'Bean is awake');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an entry of another baby does not open from an old link', async () => {
  const { context, page, errors } = await start();
  await seedAsIs(page, profile('baby-pip', 'Pip'));
  await seed(page, entry('f1', 'feed', at(10), { babyId: 'baby-pip', d: { kind: 'Bottle', ml: 90 } }));
  await open(page, url() + '#edit/f1');
  await page.waitForFunction(() => location.hash === '#today' && document.getElementById('toast-text').textContent === 'That entry is not there any more.');
  assert.deepEqual(errors, []);
  await context.close();
});

test('adding a second baby from the Babies screen opens it; the first one is still there', async () => {
  const { context, page, errors } = await start();
  await nameOnToday(page, 'Bean');
  await addBaby(page, 'Pip');
  const pip = (await readRecords(page)).find((r) => r.type === 'profile' && r.d.nickname === 'Pip');
  assert.match(pip.id, /^[0-9a-f-]{36}$/);
  await page.click('#baby-head');
  await babiesReady(page);
  assert.deepEqual(await rowNames(page), ['Bean', 'Pip']);
  assert.equal(await page.getAttribute(`.bb-pick[data-id="${pip.id}"]`, 'aria-current'), 'true');
  assert.deepEqual(errors, []);
  await context.close();
});

test('entries without a baby (from before feature 014) are never shown under a baby by guessing; a parent adds them on purpose', async () => {
  const { context, page, errors } = await start({ baby: false });
  // The first profile (feature 002) and two entries without a baby, for example test entries left from before.
  await seedAsIs(page, entry('profile', 'profile', at(1), { d: { nickname: 'Bean', dateOfBirth: '2026-09-12', sex: 'girl', photo: '' } }));
  await seedAsIs(page, entry('w1', 'pee', at(9)));
  await seedAsIs(page, entry('f1', 'feed', at(10), { d: { kind: 'Bottle', ml: 60 } }));
  await open(page, url());
  await nameOnToday(page, 'Bean');
  assert.deepEqual(await todayRows(page), [], 'not shown: they do not name Bean');
  assert.equal(await text(page, '#lf-big'), 'No feed yet');
  assert.equal(await text(page, '#today-unlinked-text'), '2 older entries have no baby.');

  await page.click('#today-unlinked');
  await babiesReady(page);
  assert.match(await text(page, '#bb-unlinked-text'), /^2 entries were logged before each entry had its baby\. They are not shown under any baby\./);
  assert.equal(await text(page, '#bb-link'), 'Add them to Bean');
  await page.click('#bb-link');
  await page.waitForFunction(() => document.getElementById('toast-text').textContent === '2 entries added.');
  await page.waitForSelector('#bb-unlinked', { state: 'hidden' });
  const records = await readRecords(page);
  assert.deepEqual(records.filter((r) => r.type !== 'profile').map((r) => [r.id, r.babyId, r.v]).sort(), [['f1', 'profile', 2], ['w1', 'profile', 2]]);
  await page.click('.bb-pick[data-id="profile"]');
  await nameOnToday(page, 'Bean');
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 60 ml', 'Nappy · Wee']);
  assert.equal(await page.isVisible('#today-unlinked'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a new baby starts empty even when old entries without a baby are on the phone; they can be deleted', async () => {
  const { context, page, errors } = await start({ baby: false });
  await seedAsIs(page, entry('w1', 'pee', at(9)));
  await seedAsIs(page, entry('f1', 'feed', at(10), { d: { kind: 'Breast', side: 'Both', min: 10, leftMin: 5, rightMin: 5 } }));
  await open(page, url());
  await babiesReady(page);
  assert.equal(await text(page, '#bb-intro'), 'Welcome. Add your baby to start.');
  assert.deepEqual(await rowNames(page), [], 'old entries make no baby');
  assert.match(await text(page, '#bb-unlinked-text'), /Add a baby first to keep them, or delete them\.$/);
  assert.equal(await page.isVisible('#bb-link'), false, 'there is no baby to add them to yet');

  await page.click('#bb-add');
  await page.waitForSelector('#screen-profile[data-ready]');
  await page.fill('#pf-nickname', 'Test');
  await page.fill('#pf-dob', '2026-10-01');
  await page.click('#pf-girl');
  await page.click('#pf-save');
  await nameOnToday(page, 'Test');
  assert.equal(await text(page, '#lf-big'), 'No feed yet', 'the new baby has no entries');
  assert.deepEqual(await todayRows(page), []);

  await page.click('#today-unlinked');
  await babiesReady(page);
  await page.click('#bb-unlinked-delete');
  assert.equal(await text(page, '#bb-unlinked-delete'), 'Tap again to delete');
  await page.click('#bb-unlinked-delete');
  await page.waitForFunction(() => document.getElementById('toast-text').textContent === '2 entries deleted.');
  const old = (await readRecords(page)).filter((r) => r.id === 'w1' || r.id === 'f1');
  assert.deepEqual(old.map((r) => r.deleted), [true, true], 'tombstones, so sync carries the delete');
  await page.click('#bb-back');
  await nameOnToday(page, 'Test');
  assert.equal(await page.isVisible('#today-unlinked'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an entry from a newer app version, or a broken one, is kept but not shown; the Sync screen says so', async () => {
  const { context, page, errors } = await start();
  await seedAsIs(page, entry('n1', 'pee', at(9), { v: 3, babyId: TEST_BABY, mood: 'calm' }));
  await seedAsIs(page, entry('b1', 'pee', 'nine', { v: 2, babyId: TEST_BABY }));
  await seed(page, entry('w1', 'pee', at(11)));
  await open(page, url());
  await nameOnToday(page, 'Bean');
  assert.deepEqual(await todayRows(page), ['Nappy · Wee'], 'only the readable entry shows');
  await page.click('#sync-link');
  await page.waitForFunction(() => !document.getElementById('sy-unreadable').hidden);
  assert.equal(await text(page, '#sy-unreadable'),
    '1 entry comes from a newer version of the app. Close the app and open it again to update. 1 entry could not be read. They are kept safe and are not shown.');
  assert.equal((await readRecords(page)).length, 4, 'nothing was removed');
  assert.deepEqual(errors, []);
  await context.close();
});

test('a new phone: signing in on the welcome screen loads the only baby and opens it', async () => {
  const fake = createFakeDrive();
  const a = await start({ baby: false, fake });
  await addBaby(a.page, 'Bean');
  await a.page.click('[data-log="pee"]');
  await a.page.waitForFunction(() => document.querySelectorAll('#today-list .row').length === 1);
  await a.page.click('#sync-link');
  await a.page.click('#sy-signin');
  await a.page.waitForFunction(() => document.getElementById('sync-link').textContent.startsWith('Synced'));

  const b = await start({ baby: false, fake });
  await babiesReady(b.page);
  assert.equal(await b.page.isVisible('#bb-signin'), true, 'the welcome screen offers to sign in');
  await b.page.click('#bb-signin');
  await nameOnToday(b.page, 'Bean');
  assert.deepEqual(await todayRows(b.page), ['Nappy · Wee']);
  assert.deepEqual(a.errors, []);
  assert.deepEqual(b.errors, []);
  await a.context.close(); await b.context.close();
});

test('a new phone: two babies in Google means a choice; none means a clear message', async () => {
  const fake = createFakeDrive();
  const empty = await start({ baby: false, fake });
  await babiesReady(empty.page);
  await empty.page.click('#bb-signin');
  await empty.page.waitForFunction(() => /^No baby was found/.test(document.getElementById('bb-intro').textContent));
  assert.equal(await empty.page.isVisible('#bb-signin-card'), false);
  await empty.context.close();

  const a = await start({ baby: false, fake });
  await addBaby(a.page, 'Bean');
  await addBaby(a.page, 'Pip');
  await a.page.click('#sync-link');
  await a.page.click('#sy-signin');
  await a.page.waitForFunction(() => document.getElementById('sync-link').textContent.startsWith('Synced'));

  const b = await start({ baby: false, fake });
  await babiesReady(b.page);
  await b.page.click('#bb-signin');
  await b.page.waitForFunction(() => document.getElementById('bb-intro').textContent === 'Which baby?');
  assert.deepEqual(await rowNames(b.page), ['Bean', 'Pip']);
  assert.equal(await hash(b.page), '#babies', 'it waits for the parent to choose');
  await b.page.click('.bb-pick >> text=Pip');
  await nameOnToday(b.page, 'Pip');
  assert.deepEqual(a.errors, []);
  assert.deepEqual(b.errors, []);
  await a.context.close(); await b.context.close();
});
