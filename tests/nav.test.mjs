// Feature 001: three tabs (Today, Summary, Growth) that work offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const out = build({ env: 'test', out: join(mkdtempSync(join(tmpdir(), 'baby-log-nav-')), 'test'), version: 't1' });
const read = (f) => readFileSync(join(out, f), 'utf8');

const sandbox = { self: {} };
vm.runInNewContext(read('nav.js'), sandbox);
const nav = sandbox.self.BABYLOG_NAV;

test('tabs are Today, Summary and Growth, in that order', () => {
  assert.deepEqual([...nav.TABS], ['today', 'summary', 'growth']);
});

test('the hash picks the tab; anything else opens Today', () => {
  assert.equal(nav.tabFromHash('#summary'), 'summary');
  assert.equal(nav.tabFromHash('#/growth'), 'growth');
  assert.equal(nav.tabFromHash('#GROWTH'), 'growth');
  assert.equal(nav.tabFromHash('#today'), 'today');
  for (const h of ['', '#', '#nope', undefined, null]) assert.equal(nav.tabFromHash(h), 'today');
});

test('index.html has one link and one view per tab', () => {
  const html = read('index.html');
  const links = [...html.matchAll(/<a href="#(\w+)" data-tab="(\w+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, [...nav.TABS].map((t) => [t, t]));
  for (const t of nav.TABS) assert.match(html, new RegExp(`class="view" id="view-${t}" data-tab="${t}"`));
});

test('every local file the page loads is cached for offline use', () => {
  const shell = read('sw.js').match(/var SHELL = \[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  const html = read('index.html');
  const css = read('styles.css');
  const used = [
    ...[...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]),
    ...[...css.matchAll(/url\(([^)'"]+)\)/g)].map((m) => m[1])
  ];
  assert.ok(used.length > 5);
  for (const f of used) assert.ok(shell.includes(f), `not cached for offline: ${f}`);
});
