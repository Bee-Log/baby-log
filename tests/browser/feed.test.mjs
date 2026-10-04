// Features 006 and 007 in a real browser: the Feed screen, the breast timer, the bottle, and what gets saved.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, open, install, todayRows, state } from './helpers.mjs';

let origin, site, browser, close;
before(async () => ({ origin, site, browser, close } = await startSite({ 'test-v1': 'test', 'test-v2': 'test', 'live-v1': 'live' })));
after(() => close?.());

function storedRecords(page, dbName = 'test-baby-log') {
  return page.evaluate((name) => new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => {
      const db = req.result;
      const get = db.transaction('records').objectStore('records').getAll();
      get.onsuccess = () => { db.close(); resolve(get.result); };
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  }), dbName);
}

const url = () => `${origin}/baby-log/test/`;
async function afterSave(page) {
  await page.waitForFunction(() => location.hash === '#today' && document.getElementById('toast-text').textContent === 'Feed saved');
}
// Wait until the Feed screen has loaded its saved data (it marks itself ready last).
const ready = (page) => page.waitForSelector('#screen-feed[data-ready]');

test('the Feed button opens the Feed screen without the tab bar; the close button returns', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  assert.equal(await page.evaluate(() => location.hash), '#feed');
  assert.equal(await page.isVisible('.tabbar'), false, 'no tab bar on a full screen');
  assert.equal(await page.isVisible('#view-today'), false);
  assert.equal(await page.textContent('#breast-started'), 'Not started yet');
  assert.equal(await page.isDisabled('#feed-save'), true, 'nothing to save before the timer starts');
  await page.click('a[aria-label="Close"]');
  await page.waitForFunction(() => location.hash === '#today');
  await page.waitForSelector('.tabbar', { state: 'visible' });
  assert.deepEqual(await storedRecords(page), [], 'closing saves nothing');
  assert.deepEqual(errors, []);
  await context.close();
});

test('breast feed: two compact rows; start, switch sides, pause, add a note, save; it shows on Today', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  assert.equal(await page.isVisible('#row-left'), true);
  assert.equal(await page.textContent('#btn-left'), 'Start');
  assert.equal(await page.textContent('#btn-right'), 'Start');
  const rowHeight = (await page.locator('#row-left').boundingBox()).height;
  assert.ok(rowHeight <= 80, `a side row is compact (${rowHeight}px)`);

  await page.click('#btn-left');
  assert.equal(await page.getAttribute('#btn-left', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('#btn-left'), 'Pause');
  assert.equal(await page.textContent('#btn-right'), 'Switch');
  assert.equal(await page.locator('#row-left').evaluate((e) => e.classList.contains('active')), true, 'the running row is highlighted');
  assert.equal(await page.isDisabled('#feed-save'), false);
  await page.waitForTimeout(2200);
  assert.match(await page.textContent('#breast-timer'), /^00:0[2-4]$/, 'the total counts');
  assert.match(await page.textContent('#left-time'), /^00:0[2-4]$/, 'and so does the side');
  assert.equal(await page.textContent('#right-time'), '00:00');

  await page.click('#btn-right');                       // switch
  assert.equal(await page.getAttribute('#btn-right', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('#btn-left', 'aria-pressed'), 'false');
  assert.equal(await page.textContent('#btn-left'), 'Switch');
  await page.click('#btn-right');                       // pause
  assert.equal(await page.textContent('#btn-right'), 'Start');
  assert.equal(await page.locator('#row-right').evaluate((e) => e.classList.contains('active')), false);
  const frozen = await page.textContent('#breast-timer');
  await page.waitForTimeout(1500);
  assert.equal(await page.textContent('#breast-timer'), frozen, 'a paused timer stands still');

  await page.fill('#breast-note', 'Sleepy, fed well');
  await page.click('#feed-save');
  await afterSave(page);
  assert.deepEqual(await todayRows(page), ['Feed · Both 0 min']);
  const [r] = await storedRecords(page);
  assert.equal(r.type, 'feed');
  assert.deepEqual(r.d, { kind: 'Breast', side: 'Both', min: 0, leftMin: 0, rightMin: 0 });
  assert.equal(r.note, 'Sleepy, fed well');
  assert.equal(r.end, null);
  assert.ok(Math.abs(r.t - Date.now()) < 60000);
  assert.deepEqual(errors, []);
  await context.close();
});

test('both sides timed: the minutes of each side are saved, and the total is their sum', async () => {
  const { context, page, errors } = await phone(browser);
  // A fixed clock at noon: with the real clock, a feed that began 20 minutes before a time just after 6 am
  // belongs to yesterday's 6 am to 6 am day, and is not on Today.
  await context.clock.setFixedTime(new Date(2026, 9, 3, 12, 0));
  await install(page, url());
  // A timer that started 20 minutes ago: Left for 8 minutes, then Right for the last 12 (still running).
  await page.evaluate(() => new Promise((resolve, reject) => {
    const now = Date.now(), min = 60000;
    const req = indexedDB.open('test-baby-log');
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ startedAt: now - 20 * min, segments: [
        { side: 'Left', from: now - 20 * min, to: now - 12 * min },
        { side: 'Right', from: now - 12 * min, to: null }] }, 'breastTimer');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.waitForFunction(() => /^20:0\d$/.test(document.getElementById('breast-timer').textContent));
  assert.equal(await page.textContent('#left-time'), '08:00');
  assert.match(await page.textContent('#right-time'), /^12:0\d$/);
  assert.equal(await page.textContent('#btn-right'), 'Pause');
  await page.click('#feed-save');
  await afterSave(page);
  const [r] = await storedRecords(page);
  assert.deepEqual(r.d, { kind: 'Breast', side: 'Both', min: 20, leftMin: 8, rightMin: 12 });
  assert.deepEqual(await todayRows(page), ['Feed · Left 8 · Right 12 min']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a running timer survives closing the app, and keeps the right time', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.click('#btn-left');
  // Pretend the phone was away for 14 minutes: move the saved start back, as if the timer began then.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('test-baby-log');
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('meta', 'readwrite'), s = tx.objectStore('meta');
      const get = s.get('breastTimer');
      get.onsuccess = () => {
        const t = get.result, shift = 14 * 60000;
        t.startedAt -= shift; t.segments.forEach((x) => { x.from -= shift; });
        s.put(t, 'breastTimer');
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload(); // a full reload on #feed, like reopening the app
  await ready(page);
  await page.waitForFunction(() => /^14:0\d$/.test(document.getElementById('breast-timer').textContent));
  assert.equal(await page.getAttribute('#btn-left', 'aria-pressed'), 'true', 'still running on the same side');
  await page.click('#feed-save');
  await afterSave(page);
  const [r] = await storedRecords(page);
  assert.deepEqual(r.d, { kind: 'Breast', side: 'Left', min: 14, leftMin: 14, rightMin: 0 });
  // The draft timer is gone: a new Feed screen starts fresh.
  await page.click('a.quick-btn.feed');
  await ready(page);
  assert.equal(await page.textContent('#breast-started'), 'Not started yet');
  assert.equal(await page.textContent('#last-line'), `Last breast feed: Left · ${await page.evaluate((t) => { const d = new Date(t), h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); }, r.t)}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('bottle: type, step, drag, choose milk and time, save', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.click('#mode-bottle');
  assert.equal(await page.inputValue('#bottle-ml'), '90', 'starts at 90 ml');
  assert.equal(await page.textContent('#feed-save'), 'Save · 90 ml');

  await page.click('#bottle-plus');
  await page.click('#bottle-plus');
  assert.equal(await page.inputValue('#bottle-ml'), '110');
  await page.click('#bottle-minus');
  assert.equal(await page.inputValue('#bottle-ml'), '100');
  await page.fill('#bottle-ml', '135');
  await page.press('#bottle-ml', 'Tab');
  assert.equal(await page.textContent('#feed-save'), 'Save · 135 ml');
  await page.fill('#bottle-ml', '900');
  await page.press('#bottle-ml', 'Tab');
  assert.equal(await page.inputValue('#bottle-ml'), '240', 'the most is 240 ml');

  // Drag to the middle of the scale: about 120 ml.
  const box = await page.locator('#bt-svg').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * (173 / 300));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * (173 / 300) + 1);
  await page.mouse.up();
  const dragged = Number(await page.inputValue('#bottle-ml'));
  assert.ok(dragged >= 110 && dragged <= 130 && dragged % 10 === 0, `dragged to ${dragged} ml`);
  const milkY = Number(await page.getAttribute('#bt-milk', 'y'));
  assert.ok(milkY > 150 && milkY < 190, 'the milk level follows');

  await page.fill('#bottle-ml', '120');
  await page.press('#bottle-ml', 'Tab');
  await page.click('#milk-expressed');
  assert.equal(await page.getAttribute('#milk-expressed', 'aria-pressed'), 'true');
  await page.fill('#bottle-time', '04:05');
  await page.click('#feed-save');
  await afterSave(page);

  const [r] = await storedRecords(page);
  assert.deepEqual(r.d, { kind: 'Bottle', milk: 'Breast milk', ml: 120 }, 'Expressed is stored as Breast milk');
  const when = new Date(r.t);
  assert.deepEqual([when.getHours(), when.getMinutes()], [4, 5], 'Fed at is the time chosen');
  assert.ok(r.t <= Date.now() + 5 * 60000, 'never in the future');
  assert.deepEqual(errors, []);
  await context.close();
});

test('bottle: the next feed starts from the last amount and milk; Last bottle is shown', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  assert.equal(await page.textContent('#last-line'), 'No breast feed yet');
  await page.click('#mode-bottle');
  assert.equal(await page.textContent('#last-line'), 'No bottle yet');
  await page.fill('#bottle-ml', '70');
  await page.press('#bottle-ml', 'Tab');
  await page.click('#milk-expressed');
  await page.fill('#bottle-time', '00:00');
  await page.click('#feed-save');
  await afterSave(page);

  await page.click('a.quick-btn.feed');
  await ready(page);
  assert.equal(await page.getAttribute('#mode-bottle', 'aria-pressed'), 'true', 'repeats the kind of the last feed');
  assert.equal(await page.inputValue('#bottle-ml'), '70');
  assert.equal(await page.getAttribute('#milk-expressed', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#last-line'), /^Last bottle: 70 ml · \d{1,2}:\d{2} [ap]m$/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('after saving there is a message and no Undo button; the feed is on the list', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.click('#mode-bottle');
  await page.click('#feed-save');
  await afterSave(page);
  assert.deepEqual(await todayRows(page), ['Feed · Bottle 90 ml'], 'the new feed is on the list');
  assert.equal(await page.isVisible('#toast-undo'), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('bottle and breast both have a Note; it is kept when switching kind and saved with the feed', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.click('#mode-bottle');
  await page.fill('#bottle-note', 'Spat up a little');
  await page.click('#mode-breast');
  assert.equal(await page.inputValue('#breast-note'), 'Spat up a little', 'the same note in both forms');
  await page.click('#mode-bottle');
  await page.click('#feed-save');
  await afterSave(page);
  const [r] = await storedRecords(page);
  assert.equal(r.note, 'Spat up a little');
  assert.deepEqual(r.d.kind, 'Bottle');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the card under the form has Fed at and Note, with a line between them and no stray line', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.click('#mode-bottle');
  const lines = () => page.$$eval('#panel-bottle .card-row', (rows) => rows.filter((r) => !r.hidden).map((r) => [
    r.querySelector('label').textContent, getComputedStyle(r).borderTopWidth, getComputedStyle(r).borderBottomWidth]));
  assert.deepEqual(await lines(), [['Fed at', '0px', '0px'], ['Note', '1px', '0px']]);
  assert.equal(await page.textContent('#last-line'), 'No bottle yet', 'the last-bottle info is a small line under the switch');
  await page.click('#screen-feed a[aria-label="Close"]');
  assert.deepEqual(errors, []);
  await context.close();
});

test('the feed controls fit on a narrow phone: Left / Right rows and Expressed do not overflow', async () => {
  for (const width of [320, 360, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 740 } });
    const page = await context.newPage();
    await install(page, url());
    await page.click('a.quick-btn.feed');
    await ready(page);
    const rowsFit = () => page.$$eval('#panel-breast .side-row', (rows) => rows.filter((r) => r.scrollWidth > r.clientWidth).map((r) => r.id));
    assert.deepEqual(await rowsFit(), [], `${width}px wide: a Left / Right row overflows while logging`);
    await page.click('#screen-feed a[aria-label="Close"]');
    await page.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open('test-baby-log');
      req.onsuccess = () => { const db = req.result, tx = db.transaction('records', 'readwrite');
        tx.objectStore('records').put({ id: 'w', type: 'feed', t: Date.now() - 60000, end: null, d: { kind: 'Breast', side: 'Both', min: 133, leftMin: 66, rightMin: 67 }, note: '', by: '', deviceId: 'x', updatedAt: 1 });
        tx.oncomplete = () => { db.close(); resolve(); }; };
    }));
    await page.reload();
    await page.waitForSelector('#today-list .row-link');
    await page.locator('#today-list .row-link').first().click();
    await ready(page);
    assert.deepEqual(await rowsFit(), [], `${width}px wide: a Left / Right row overflows while editing (two-digit minutes)`);
    const editFit = await page.$$eval('#panel-breast .side-edit', (els) => els.map((e) => { const r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(); return r.right <= p.right + 0.5 && r.left >= p.left; }));
    assert.deepEqual(editFit, [true, true], `${width}px wide: the minutes controls run outside their row`);
    await page.click('#mode-bottle');
    const overflowing = await page.$$eval('#panel-bottle .chip, #panel-bottle .step-btn', (els) =>
      els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent));
    assert.deepEqual(overflowing, [], `${width}px wide: these overflow`);
    const bottle = await page.locator('#bt-svg').boundingBox();
    const side = await page.locator('.bottle-side').boundingBox();
    assert.ok(bottle.x + bottle.width <= side.x, `${width}px wide: the bottle and the controls overlap`);
    assert.ok(side.x + side.width <= width, `${width}px wide: the controls run off the screen`);
    await context.close();
  }
});

test('feeds work offline, and TEST feeds never reach LIVE', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await context.setOffline(true);
  await open(page, `${url()}#feed`);
  await ready(page);
  await page.click('#mode-bottle');
  await page.click('#feed-save');
  await afterSave(page);
  assert.equal((await storedRecords(page)).length, 1);
  await context.setOffline(false);
  await install(page, `${origin}/baby-log/`);
  assert.equal((await storedRecords(page, 'test-baby-log')).length, 1, 'the TEST feed is still in TEST storage');
  assert.deepEqual(await storedRecords(page, 'baby-log'), [], 'LIVE storage has no TEST feeds');
  assert.deepEqual(errors, []);
  await context.close();
});

test('an update waits while the bottle form is open, then arrives when the parent leaves', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.click('#mode-bottle');
  await page.fill('#bottle-ml', '150');
  await page.press('#bottle-ml', 'Tab');
  await page.evaluate(() => { window.__sameLoad = true; });

  site.test = 'test-v2'; // publish an update while the form is open
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await page.waitForFunction(() => caches.keys().then((k) => k.includes('test-baby-log-shell-test-v2')));
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__sameLoad === true), true, 'the page was not reloaded');
  assert.equal(await page.inputValue('#bottle-ml'), '150', 'the amount is still there');

  await page.click('a[aria-label="Close"]'); // leaving the screen lets the update in
  const s = await state(page, { until: (x) => x.pageVersion === 'test-v2', timeoutMs: 12000 });
  assert.equal(s.pageVersion, 'test-v2');
  assert.deepEqual(errors, []);
  await context.close();
});

test('a feed without details (for example from another phone) does not break the screen or the list', async () => {
  site.test = 'test-v1';
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('test-baby-log');
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('records', 'readwrite');
      tx.objectStore('records').put({ id: 'bare-1', type: 'feed', t: Date.now() - 60000, end: null, note: '', by: '', deviceId: 'other-phone', updatedAt: 1 });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await page.waitForSelector('#today-list .row');
  assert.deepEqual(await todayRows(page), ['Feed · Breast']);
  await page.click('a.quick-btn.feed');
  await ready(page);
  assert.equal(await page.isDisabled('#feed-save'), true);
  await page.click('#mode-bottle');
  assert.equal(await page.inputValue('#bottle-ml'), '90');
  assert.deepEqual(errors, []);
  await context.close();
});

test('breast time can be entered by hand: minutes per side and the start time, no timer', async () => {
  const { context, page, errors } = await phone(browser);
  await context.clock.setFixedTime(new Date(2026, 9, 3, 14, 0));
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  assert.equal(await page.isVisible('#breast-timer'), true);
  assert.equal(await page.isVisible('#row-started'), false);

  await page.click('#breast-manual');
  assert.equal(await page.textContent('#breast-manual'), 'Use the timer instead');
  assert.equal(await page.isVisible('#breast-timer'), false, 'the timer is hidden');
  assert.equal(await page.isVisible('#left-min'), true, 'typed minutes are shown');
  assert.equal(await page.isVisible('#row-started'), true);
  assert.equal(await page.textContent('#feed-save'), 'Save');
  assert.equal(await page.inputValue('#breast-time'), '13:50', 'starts 10 minutes ago, like the default minutes');

  await page.fill('#left-min', '8');
  await page.fill('#right-min', '12');
  await page.fill('#breast-time', '13:30');
  await page.fill('#breast-note', 'Sleepy');
  await page.click('#feed-save');
  await afterSave(page);
  const [r] = (await storedRecords(page)).filter((x) => x.type === 'feed');
  assert.equal(r.t, new Date(2026, 9, 3, 13, 30).getTime());
  assert.deepEqual(r.d, { kind: 'Breast', side: 'Both', min: 20, leftMin: 8, rightMin: 12 });
  assert.equal(r.note, 'Sleepy');
  assert.equal((await todayRows(page)).length, 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('manual breast entry cannot save 0 minutes, and is not offered while a timer runs', async () => {
  const { context, page, errors } = await phone(browser);
  await install(page, url());
  await page.click('a.quick-btn.feed');
  await ready(page);
  await page.click('#breast-manual');
  await page.fill('#left-min', '0');
  await page.dispatchEvent('#left-min', 'change');
  assert.equal(await page.isDisabled('#feed-save'), true);
  await page.click('#breast-manual'); // back to the timer
  assert.equal(await page.isVisible('#breast-timer'), true);
  await page.click('#btn-left');
  assert.equal(await page.isVisible('#breast-manual'), false, 'hidden while the timer runs');
  assert.deepEqual(errors, []);
  await context.close();
});
