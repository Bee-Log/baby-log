// The design language (docs/ux/design-language.md) in a real browser. On every page:
// - the blocks are 16 px apart (the buttons at the bottom of a full screen may sit lower),
// - a heading sits 8 px above its content (a .group),
// - every card has the same corners.
// So spacing cannot drift again one screen at a time.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSite, phone, install, seed } from './helpers.mjs';

let origin, browser, close;
before(async () => ({ origin, browser, close } = await startSite({ 'test-v1': 'test' })));
after(() => close?.());

const url = () => `${origin}/baby-log/test/`;
const PAGES = ['#today', '#summary', '#growth', '#feed', '#sleep', '#profile', '#sync', '#babies', '#measure'];
const CARDS = '.card, .last-feed, .sleep-card, .sync-card, .sum-tile, .sum-chart, .gr-card, .gr-chart-card, .gr-standard, .ps-card, .bb-row';
const at = (h, m = 0) => new Date(2026, 9, 3, h, m).getTime();
const entry = (id, type, t, extra = {}) => ({ id, type, t, end: null, d: {}, note: '', by: '', deviceId: 'seed', updatedAt: t, ...extra });

// The gaps between the visible children of an element, top to bottom: [{ gap, name }].
function gapsIn(page, selector) {
  return page.$$eval(selector, (parents) => parents.filter((p) => p.offsetParent !== null).map((parent) => {
    const kids = [...parent.children].filter((k) => k.offsetParent !== null && k.getBoundingClientRect().height > 0);
    return kids.slice(1).map((k, i) => ({
      gap: Math.round(k.getBoundingClientRect().top - kids[i].getBoundingClientRect().bottom),
      name: (parent.id || parent.className) + ' > ' + (k.id || k.className || k.tagName)
    }));
  }).flat());
}

test('every page: blocks 16 px apart, headings 8 px above their content, one card shape', async () => {
  const { context, page, errors } = await phone(browser);
  await context.clock.setFixedTime(new Date(2026, 9, 3, 17, 0));
  await install(page, url());
  await seed(page, entry('f1', 'feed', at(15), { d: { kind: 'Bottle', ml: 90 } }));
  await seed(page, entry('s1', 'sleep', at(12), { end: at(13), d: { source: 'manual' } }));
  await seed(page, entry('g1', 'growth', at(10), { d: { weight: 4200, height: 54 } }));
  for (const hash of PAGES) {
    await page.goto(url() + hash);
    await page.reload();
    await page.waitForTimeout(600);
    const blocks = await gapsIn(page, '.view, .screen');
    assert.ok(blocks.length > 0, `${hash}: has blocks`);
    for (const b of blocks) {
      if (/actions/.test(b.name)) assert.ok(b.gap >= 16, `${hash}: ${b.name} is ${b.gap} px below the block above`);
      else assert.equal(b.gap, 16, `${hash}: ${b.name}`);
    }
    for (const g of await gapsIn(page, '.group')) assert.equal(g.gap, 8, `${hash}: ${g.name}`);
    const radii = await page.$$eval(CARDS, (cards) => [...new Set(cards.filter((c) => c.offsetParent !== null).map((c) => getComputedStyle(c).borderRadius))]);
    assert.ok(radii.every((r) => r === '20px'), `${hash}: card corners ${radii}`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});
