// Screenshots of every screen, for the design update pack (docs/ux/). Made-up sample data only.
//
//   NODE_PATH=/opt/node-tools/node_modules node scripts/ux-screenshots.mjs <output folder>
//
// It builds src/ (TEST flavour), opens it in Chromium at phone size with a fixed clock (Sat 3 Oct 2026, 5:17 pm),
// and uses a fake Google for the sync screens, so no real account is needed.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { startSite, phone, install, seed, seedAsIs, fakeGoogle, TEST_BABY } from '../tests/browser/helpers.mjs';
import { createFakeDrive } from '../tests/fake-drive.mjs';
const { chromium } = createRequire(import.meta.url)('playwright'); // honours NODE_PATH, like the browser tests
const OUT = process.argv[2];
if (!OUT) { console.error('Usage: node scripts/ux-screenshots.mjs <output folder>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const { origin, close } = await startSite({ 'test-v1': 'test', 'live-v1': 'live' });
const browser = await chromium.launch();
const NOW = new Date(2026, 9, 3, 17, 17);
const at = (h, m = 0, day = 3) => new Date(2026, 9, day, h, m).getTime();
const r = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'sample', updatedAt: t, ...extra });
const DATA = [                                                // for the test baby "Bean" (install() adds her)
  r('f1', 'feed', at(15, 2), { d: { kind: 'Breast', side: 'Both', min: 20, leftMin: 8, rightMin: 12 } }),
  r('f2', 'feed', at(11, 50), { d: { kind: 'Bottle', milk: 'Formula', ml: 90 } }),
  r('f3', 'feed', at(8, 10), { d: { kind: 'Breast', side: 'Left', min: 14, leftMin: 14, rightMin: 0 } }),
  r('n1', 'pee', at(14, 40)), r('n2', 'poop', at(14, 41)), r('n3', 'pee', at(10, 30)),
  r('s1', 'sleep', at(12, 0), { end: at(13, 40), d: { source: 'manual' } }),
  r('s2', 'sleep', at(9, 0), { end: at(9, 50), d: { source: 'live' } }),
  r('s3', 'sleep', at(23, 0, 2), { end: at(2, 10, 3), d: { source: 'manual' } }),
  ...[1, 2].map((d) => [8, 11, 14, 17, 20].slice(0, 3 + d).map((h, i) => r(`y${d}${i}`, 'feed', at(h, 0, 3 - d), { d: { kind: 'Breast', side: 'Left', min: 10 } }))).flat()
];
const TIMER_KEY = 'breastTimer:' + TEST_BABY;

// `baby: false` is a new phone without a baby. `raw` entries are stored as given (for example from before feature 014).
async function newPhone({ width = 390, sync = false, data = DATA, baby = true, raw = [] } = {}) {
  const p = await phone(browser);
  await p.page.setViewportSize({ width, height: 844 });
  await p.context.clock.setFixedTime(NOW);
  if (sync) await fakeGoogle(p, createFakeDrive());
  await install(p.page, origin + '/baby-log/test/', { baby });
  for (const rec of data) await seed(p.page, rec);
  for (const rec of raw) await seedAsIs(p.page, rec);
  await p.page.reload();
  await p.page.waitForSelector('#today-list .row, #today-empty:not([hidden]), #screen-babies[data-ready]');
  await p.page.addStyleTag({ content: '*{caret-color:transparent !important}' });
  return p;
}
const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
const pause = async (page) => { await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await page.waitForTimeout(350); };

// Today
let p = await newPhone();
await shot(p.page, '01-today');
// Feed: breast timer running on Right
await p.page.evaluate((key) => new Promise((res) => { const q = indexedDB.open('test-baby-log'); q.onsuccess = () => { const tx = q.result.transaction('meta', 'readwrite'); const now = Date.now(), m = 60000;
  tx.objectStore('meta').put({ startedAt: now - 11 * m, segments: [{ side: 'Left', from: now - 11 * m, to: now - 4 * m }, { side: 'Right', from: now - 4 * m, to: null }] }, key); tx.oncomplete = () => { q.result.close(); res(); }; }; }), TIMER_KEY);
await p.page.click('a.quick-btn.feed'); await p.page.waitForSelector('#screen-feed[data-ready]'); await pause(p.page);
await shot(p.page, '02-feed-breast-timer', { fullPage: true });
await p.page.evaluate((key) => new Promise((res) => { const q = indexedDB.open('test-baby-log'); q.onsuccess = () => { const tx = q.result.transaction('meta', 'readwrite'); tx.objectStore('meta').delete(key); tx.oncomplete = () => { q.result.close(); res(); }; }; }), TIMER_KEY);
await p.page.goto(origin + '/baby-log/test/#today'); await p.page.waitForSelector('#today-list .row');
await p.page.click('a.quick-btn.feed'); await p.page.waitForSelector('#screen-feed[data-ready]');
await p.page.click('#mode-breast'); await p.page.click('#breast-manual'); await p.page.fill('#left-min', '8'); await p.page.fill('#right-min', '6'); await p.page.dispatchEvent('#right-min', 'change'); await pause(p.page);
await shot(p.page, '03-feed-breast-manual', { fullPage: true });
await p.page.click('#breast-manual'); await p.page.click('#mode-bottle'); await pause(p.page);
await shot(p.page, '04-feed-bottle', { fullPage: true });
// Edit a feed (breast, per side) and a nappy
await p.page.goto(origin + '/baby-log/test/#edit/f1'); await p.page.waitForSelector('#screen-feed[data-ready]'); await pause(p.page);
await shot(p.page, '05-edit-feed-breast', { fullPage: true });
await p.page.click('#feed-delete'); await pause(p.page);
await shot(p.page, '06-edit-feed-delete-armed', { fullPage: true });
await p.page.goto(origin + '/baby-log/test/#edit/n1+n2'); await p.page.waitForSelector('#screen-edit[data-ready]'); await pause(p.page);
await shot(p.page, '07-edit-nappy', { fullPage: true });
// Sleep page
await p.page.goto(origin + '/baby-log/test/#sleep'); await p.page.waitForSelector('#screen-sleep[data-ready]'); await pause(p.page);
await shot(p.page, '08-sleep-page', { fullPage: true });
await p.page.addStyleTag({ content: '.test-banner{position:static !important}' });
await p.page.fill('#ps-from', '2026-10-03T12:30'); await p.page.fill('#ps-to', '2026-10-03T14:00'); await pause(p.page);
await p.page.locator('#ps-card').screenshot({ path: `${OUT}/09-sleep-add-overlap.png` });
await p.page.click('.ps-part[data-part="2"]'); await p.page.fill('#ps-from', '2026-10-02T19:30'); await p.page.fill('#ps-to', '2026-10-02T21:15'); await pause(p.page);
await p.page.locator('#ps-card').screenshot({ path: `${OUT}/10-sleep-add-last-evening.png` });
// Edit sleep
await p.page.goto(origin + '/baby-log/test/#edit/s1'); await p.page.waitForSelector('#screen-sleep-edit[data-ready]'); await pause(p.page);
await shot(p.page, '11-edit-sleep');
await p.page.click('#se-delete'); await pause(p.page);
await shot(p.page, '12-edit-sleep-delete-armed');
// Summary, profile, growth
await p.page.goto(origin + '/baby-log/test/#summary'); await p.page.waitForTimeout(600);
await shot(p.page, '13-summary');
await p.page.goto(origin + '/baby-log/test/#profile'); await p.page.waitForSelector('#screen-profile[data-ready]'); await pause(p.page);
await shot(p.page, '14-profile', { fullPage: true });
await p.page.goto(origin + '/baby-log/test/#growth'); await pause(p.page);
await shot(p.page, '15-growth-not-built-yet');
await p.context.close();

// Today while asleep (a sleep is running)
p = await newPhone({ data: [...DATA, r('run', 'sleep', at(16, 50), { d: { source: 'live' } })] });
await shot(p.page, '16-today-asleep');
await p.context.close();

// Sync and data: before and after signing in (a fake Google, no real account)
p = await newPhone({ sync: true });
await p.page.click('#sync-link'); await pause(p.page);
await shot(p.page, '17-sync-sign-in', { fullPage: true });
await p.page.click('#sy-signin'); await p.page.waitForFunction(() => document.getElementById('sy-state').textContent === 'Synced'); await pause(p.page);
await shot(p.page, '18-sync-synced', { fullPage: true });
await p.page.goto(origin + '/baby-log/test/#today'); await p.page.waitForSelector('#today-list .row'); await p.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await pause(p.page);
await shot(p.page, '19-today-footer-sync-status');
await p.context.close();

// A narrow phone (320 px): the Sleep page and Today
p = await newPhone({ width: 320 });
await shot(p.page, '20-today-320px');
await p.page.goto(origin + '/baby-log/test/#sleep'); await p.page.waitForSelector('#screen-sleep[data-ready]'); await pause(p.page);
await shot(p.page, '21-sleep-page-320px', { fullPage: true });
await p.context.close();

// Babies (feature 014): switching between two babies, a new phone, and a phone with entries from before 014
const pip = { v: 2, id: 'baby-pip', type: 'profile', babyId: 'baby-pip', t: at(9), end: null, note: '', by: '', deviceId: 'sample', updatedAt: at(9),
  d: { nickname: 'Pip', dateOfBirth: '2026-09-12', sex: 'boy', photo: '' } };
p = await newPhone({ raw: [pip] });
await p.page.click('#baby-head'); await p.page.waitForSelector('#screen-babies[data-ready]'); await pause(p.page);
await shot(p.page, '22-babies-switch');
await p.context.close();
p = await newPhone({ baby: false, sync: true, data: [] }); await pause(p.page);
await shot(p.page, '23-welcome-new-phone');
await p.page.click('#bb-add'); await p.page.waitForSelector('#screen-profile[data-ready]'); await pause(p.page);
await shot(p.page, '24-add-a-baby', { fullPage: true });
await p.context.close();
p = await newPhone({ baby: false, data: [], raw: DATA.slice(0, 6) }); await pause(p.page);
await shot(p.page, '25-welcome-entries-from-before');
await p.context.close();

await browser.close(); await close();
console.log('done');
