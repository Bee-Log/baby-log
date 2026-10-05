// Feature 011 in a real browser: tap a row on Today, fix or delete the entry.
// A feed is edited on the Feed screen itself (same Breast / Bottle switch, same controls); a nappy has a small Edit screen.
// The clock is fixed at 2:00 pm on 3 Oct 2026, so the tests behave the same at any time of day.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, open, state, todayRows, seed, readRecords } from './helpers.mjs';

let origin, site, browser, close;
before(async () => ({ origin, site, browser, close } = await startSite({ 'test-v1': 'test', 'test-v2': 'test' })));
after(() => close?.());

const NOW = new Date(2026, 9, 3, 14, 0).getTime();
const at = (h, m = 0) => new Date(2026, 9, 3, h, m).getTime();
const url = () => `${origin}/baby-log/test/`;
const rec = (id, type, t, d = {}, extra = {}) => ({ id, type, t, end: null, d, note: '', by: '', deviceId: 'other-phone', updatedAt: t, ...extra });

async function start(seedRecords = []) {
  const p = await phone(browser);
  await p.context.clock.setFixedTime(NOW);
  await install(p.page, url());
  for (const r of seedRecords) await seed(p.page, r);
  await p.page.reload();
  await p.page.waitForSelector('#today-list .row, #today-empty:not([hidden])');
  return p;
}
const openFeed = async (page, n = 0) => { await page.locator('#today-list .row-link').nth(n).click(); await page.waitForSelector('#screen-feed[data-ready]'); };
const openNappy = async (page, n = 0) => { await page.locator('#today-list .row-link').nth(n).click(); await page.waitForSelector('#screen-edit[data-ready]'); };
const byId = async (page, id) => (await readRecords(page)).find((r) => r.id === id);
const waitToast = (page, text) => page.waitForFunction((t) => document.getElementById('toast-text').textContent === t, text);
const pressed = (page, id) => page.getAttribute(id, 'aria-pressed');

test('editing a feed opens the Feed screen itself: same switch, same controls', async () => {
  const { context, page, errors } = await start([rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 90 })]);
  await openFeed(page);
  assert.equal(await page.textContent('#h-feed'), 'Edit feed');
  assert.equal(await page.isVisible('#screen-feed .seg'), true, 'the Breast / Bottle switch is there');
  assert.equal(await pressed(page, '#mode-bottle'), 'true', 'opens on the kind it was saved as');
  assert.equal(await page.isVisible('#bt-svg'), true, 'the same bottle');
  assert.equal(await page.textContent('#feed-save'), 'Save changes');
  assert.equal(await page.isVisible('#feed-delete'), true);
  assert.equal(await page.isVisible('#row-last-bottle'), false, 'the "last bottle" row is for logging only');
  assert.equal(await page.isVisible('.tabbar'), false);
  // Logging a new feed looks the same, without Delete.
  await page.click('#screen-feed a[aria-label="Close"]');
  await page.waitForSelector('.tabbar', { state: 'visible' });
  await page.click('a.quick-btn.feed');
  await page.waitForSelector('#screen-feed[data-ready]');
  assert.equal(await page.textContent('#h-feed'), 'Feed');
  assert.equal(await page.isVisible('#feed-delete'), false);
  assert.equal(await page.isVisible('#screen-feed .seg'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('bottle: change the amount, milk, time and note; it works offline', async () => {
  const original = rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 90, extra: 'kept' });
  const { context, page, errors } = await start([original]);
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 90 ml']);
  await context.setOffline(true);

  await openFeed(page);
  assert.equal(await page.inputValue('#bottle-ml'), '90');
  assert.equal(await pressed(page, '#milk-formula'), 'true');
  assert.equal(await page.inputValue('#bottle-time'), '13:00');

  await page.fill('#bottle-ml', '120');           // typed, then Save straight away
  await page.click('#milk-expressed');
  await page.fill('#bottle-time', '12:40');
  await page.fill('#bottle-note', 'half asleep');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 120 ml']);

  const saved = await byId(page, 'b1');
  assert.equal(saved.t, at(12, 40));
  assert.deepEqual(saved.d, { kind: 'Bottle', milk: 'Breast milk', ml: 120, extra: 'kept' }, 'unknown details are kept');
  assert.ok(saved.updatedAt > original.updatedAt, 'newer, so it wins the merge');
  assert.notEqual(saved.deviceId, 'other-phone', 'now this phone');
  assert.equal(saved.note, 'half asleep');
  assert.equal((await readRecords(page)).filter((r) => r.type === 'feed').length, 1, 'edited in place, not copied');

  assert.deepEqual(errors, []);
  await context.close();
});

test('breast: Left and Right minutes are edited separately; the total is their sum', async () => {
  const { context, page, errors } = await start([rec('s1', 'feed', at(11), { kind: 'Breast', side: 'Both', min: 20, leftMin: 8, rightMin: 12 }, { note: 'a' })]);
  assert.deepEqual(await todayRows(page), ['Feed · Left 8 · Right 12 min']);
  await openFeed(page);
  assert.equal(await pressed(page, '#mode-breast'), 'true');
  assert.equal(await page.isVisible('#breast-timer-block'), false, 'no timer for a saved feed');
  assert.equal(await page.isVisible('#btn-left'), false, 'no Start / Pause buttons either');
  assert.equal(await page.inputValue('#left-min'), '8');
  assert.equal(await page.inputValue('#right-min'), '12');
  assert.equal(await page.textContent('#breast-total'), '20 min');
  assert.equal(await page.isVisible('#split-hint'), false, 'nothing is guessed: both minutes were saved');
  assert.equal(await page.inputValue('#breast-time'), '11:00');
  assert.equal(await page.inputValue('#breast-note'), 'a');

  await page.click('#left-plus');
  await page.click('#left-plus');
  await page.click('#left-minus');
  assert.equal(await page.inputValue('#left-min'), '9');
  await page.fill('#right-min', '15');                 // typed, then Save straight away
  await page.fill('#breast-note', '  fed well  ');
  await page.fill('#breast-time', '10:50');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual(await todayRows(page), ['Feed · Left 9 · Right 15 min']);
  const saved = await byId(page, 's1');
  assert.deepEqual([saved.t, saved.d, saved.note], [at(10, 50), { kind: 'Breast', side: 'Both', min: 24, leftMin: 9, rightMin: 15 }, 'fed well']);

  await openFeed(page);                                // Right to 0: the side follows the minutes
  await page.fill('#right-min', '0');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual((await byId(page, 's1')).d, { kind: 'Breast', side: 'Left', min: 9, leftMin: 9, rightMin: 0 });
  assert.deepEqual(await todayRows(page), ['Feed · Left 9 min']);

  await openFeed(page);                                // both 0: the earlier side stays
  await page.fill('#left-min', '0');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual((await byId(page, 's1')).d, { kind: 'Breast', side: 'Left', min: 0, leftMin: 0, rightMin: 0 });

  await openFeed(page);                                // minutes stay in range
  await page.fill('#left-min', '300000');
  await page.fill('#right-min', '-4');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual((await byId(page, 's1')).d, { kind: 'Breast', side: 'Left', min: 300, leftMin: 300, rightMin: 0 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('an old breast feed (only a total): the split is a guess, and nothing is added unless the minutes change', async () => {
  const old = { kind: 'Breast', side: 'Both', min: 15 };
  const { context, page, errors } = await start([rec('o1', 'feed', at(11), old), rec('o2', 'feed', at(12), { kind: 'Breast', side: 'Right', min: 9 })]);
  assert.deepEqual(await todayRows(page), ['Feed · Right 9 min', 'Feed · Both 15 min'], 'old entries look as before');

  await openFeed(page, 1);                             // the Both 15 feed
  assert.equal(await page.inputValue('#left-min'), '8');
  assert.equal(await page.inputValue('#right-min'), '7');
  assert.equal(await page.isVisible('#split-hint'), true, 'it says the split is a guess');
  const before = await byId(page, 'o1');
  await page.click('#feed-save');                      // nothing changed
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await byId(page, 'o1'), before, 'the guess is not written');

  await openFeed(page, 1);                             // change only the note
  await page.fill('#breast-note', 'ok');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  const noted = await byId(page, 'o1');
  assert.deepEqual(noted.d, old, 'still an old-format entry: no guessed minutes were added');
  assert.equal(noted.note, 'ok');

  await openFeed(page, 1);                             // change a side: the split becomes real
  await page.click('#left-plus');
  assert.equal(await page.isVisible('#split-hint'), false, 'the hint goes once the parent chooses');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual((await byId(page, 'o1')).d, { kind: 'Breast', side: 'Both', min: 16, leftMin: 9, rightMin: 7 });

  await openFeed(page, 0);                             // an old Right-only feed is not a guess
  assert.deepEqual([await page.inputValue('#left-min'), await page.inputValue('#right-min')], ['0', '9']);
  assert.equal(await page.isVisible('#split-hint'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('switch Breast <-> Bottle while editing: the entry becomes the other kind', async () => {
  const { context, page, errors } = await start([
    rec('s1', 'feed', at(11), { kind: 'Breast', side: 'Left', min: 14, leftMin: 14, rightMin: 0 }, { note: 'keep me' }),
    rec('b1', 'feed', at(12), { kind: 'Bottle', milk: 'Breast milk', ml: 70 })
  ]);
  // Newest first: b1 (12:00) then s1 (11:00).
  await openFeed(page, 1);                             // the breast feed
  await page.click('#mode-bottle');
  assert.equal(await page.isVisible('#panel-bottle'), true);
  assert.equal(await page.inputValue('#bottle-time'), '11:00', 'the time carries over');
  assert.equal(await page.inputValue('#bottle-ml'), '70', 'starts from the last bottle');
  await page.fill('#bottle-ml', '100');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 70 ml', 'Feed · Bottle 100 ml']);
  const nowBottle = await byId(page, 's1');
  assert.deepEqual(nowBottle.d, { kind: 'Bottle', milk: 'Breast milk', ml: 100 }, 'no side or minutes left over');
  assert.equal(nowBottle.note, 'keep me', 'the note is not lost');
  assert.equal(nowBottle.id, 's1', 'same entry');

  await openFeed(page, 0);                             // the 12:00 bottle becomes a breast feed
  await page.click('#mode-breast');
  assert.equal(await page.isVisible('#left-min'), true);
  assert.equal(await page.inputValue('#breast-time'), '12:00');
  assert.deepEqual([await page.inputValue('#left-min'), await page.inputValue('#right-min')], ['10', '0'], 'starts from 10 minutes on the left');
  await page.fill('#left-min', '0');
  await page.fill('#right-min', '12');
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual((await byId(page, 'b1')).d, { kind: 'Breast', side: 'Right', min: 12, leftMin: 0, rightMin: 12 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('a Wee + Poo row is two entries: a time change moves both, and Delete removes both', async () => {
  const { context, page, errors } = await start([rec('w1', 'pee', at(13, 0)), rec('p1', 'poop', at(13, 1))]);
  assert.deepEqual(await todayRows(page), ['Nappy · Wee + Poo']);
  await openNappy(page);
  assert.equal(await page.textContent('#h-edit'), 'Edit nappy');
  assert.equal(await page.textContent('#edit-nappy'), 'Wee + Poo');

  await page.fill('#edit-time', '12:30');
  await page.click('#edit-save');
  await waitToast(page, 'Changes saved');
  assert.deepEqual([(await byId(page, 'w1')).t, (await byId(page, 'p1')).t], [at(12, 30), at(12, 31)], 'moved together, order kept');

  await openNappy(page);
  await page.click('#edit-delete');                      // the first tap only asks
  assert.equal(await page.textContent('#edit-delete'), 'Tap again to delete');
  assert.deepEqual([(await byId(page, 'w1')).deleted, (await byId(page, 'p1')).deleted], [undefined, undefined]);
  await page.click('#edit-delete');
  await waitToast(page, 'Deleted');
  assert.deepEqual(await todayRows(page), []);
  assert.deepEqual([(await byId(page, 'w1')).deleted, (await byId(page, 'p1')).deleted], [true, true], 'tombstones, not removed');
  assert.deepEqual(errors, []);
  await context.close();
});

test('delete a feed: the first tap asks, the second deletes', async () => {
  const { context, page, errors } = await start([rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 60 })]);
  await openFeed(page);
  await page.click('#feed-delete');
  assert.equal(await page.textContent('#feed-delete'), 'Tap again to delete');
  assert.ok(!(await byId(page, 'b1')).deleted, 'one tap deletes nothing');
  await page.waitForTimeout(4300);                       // it relaxes if the second tap does not come
  assert.equal(await page.textContent('#feed-delete'), 'Delete this entry');
  await page.click('#feed-delete');
  await page.click('#feed-delete');
  await waitToast(page, 'Deleted');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await todayRows(page), []);
  assert.equal(await page.isVisible('#today-empty'), true);
  assert.equal((await byId(page, 'b1')).deleted, true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a time that has not happened yet is refused, and nothing changes', async () => {
  const { context, page, errors } = await start([rec('b1', 'feed', at(13, 59), { kind: 'Bottle', milk: 'Formula', ml: 90 })]);
  const before = await byId(page, 'b1');
  await openFeed(page);
  await page.fill('#bottle-time', '16:00');
  await page.click('#feed-save');
  await waitToast(page, 'That time has not happened yet.');
  // The message is on top of everything, including the orange TEST banner, so it can be read.
  const onTop = await page.evaluate(() => {
    const el = document.getElementById('toast');
    el.style.pointerEvents = 'auto'; // the message ignores taps on purpose, and elementFromPoint skips such elements
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).closest('#toast') !== null;
    el.style.pointerEvents = '';
    return top;
  });
  assert.equal(onTop, true, 'something covers the message');
  const toastBox = await page.locator('#toast').boundingBox();
  for (const id of ['#feed-save', '#feed-delete', '#bottle-ml', '#bottle-time']) {
    const b = await page.locator(id).boundingBox();
    assert.ok(toastBox.y + toastBox.height <= b.y || b.y + b.height <= toastBox.y, `the message covers ${id}`);
  }
  assert.match(await page.evaluate(() => location.hash), /^#edit\//, 'stays on the Edit screen');
  assert.deepEqual(await byId(page, 'b1'), before);
  await page.fill('#bottle-time', '14:03'); // up to 5 minutes ahead is allowed
  await page.click('#feed-save');
  await waitToast(page, 'Changes saved');
  assert.equal((await byId(page, 'b1')).t, at(14, 3));
  assert.deepEqual(errors, []);
  await context.close();
});

test('Save with no change leaves the entry alone; Close saves nothing', async () => {
  const { context, page, errors } = await start([rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 90 })]);
  const before = await byId(page, 'b1');
  await openFeed(page);
  await page.click('#feed-save');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await byId(page, 'b1'), before, 'not even updatedAt moved');
  await openFeed(page);
  await page.fill('#bottle-ml', '200');
  await page.click('#screen-feed a[aria-label="Close"]');
  await page.waitForFunction(() => location.hash === '#today');
  assert.deepEqual(await byId(page, 'b1'), before);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an entry that is gone is explained, not a blank screen', async () => {
  const { context, page, errors } = await start([]);
  await open(page, `${url()}#edit/does-not-exist`);
  await waitToast(page, 'That entry is not there any more.');
  await page.waitForFunction(() => location.hash === '#today');
  assert.equal(await page.isVisible('#screen-edit'), false);
  assert.equal(await page.isVisible('#screen-feed'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an update waits while a feed is being edited', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await start([rec('b1', 'feed', at(13), { kind: 'Bottle', milk: 'Formula', ml: 90 })]);
  await openFeed(page);
  await page.fill('#bottle-ml', '110');
  await page.evaluate(() => { window.__sameLoad = true; });
  site.test = 'test-v2';
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await page.waitForFunction(() => caches.keys().then((k) => k.includes('test-baby-log-shell-test-v2')));
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__sameLoad === true), true, 'not reloaded');
  assert.equal(await page.inputValue('#bottle-ml'), '110');
  await page.click('#screen-feed a[aria-label="Close"]');
  const s = await state(page, { until: (x) => x.pageVersion === 'test-v2', timeoutMs: 12000 });
  assert.equal(s.pageVersion, 'test-v2');
  assert.deepEqual(errors, []);
  await context.close();
});
