// Checks that both builds are installable, work offline, and keep TEST apart from LIVE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'baby-log-'));
const out = {
  test: build({ env: 'test', out: join(tmp, 'test'), version: 't1' }),
  live: build({ env: 'live', out: join(tmp, 'live'), version: 't1' })
};
const read = (env, f) => readFileSync(join(out[env], f), 'utf8');

for (const env of ['test', 'live']) {
  test(`${env}: manifest is installable`, () => {
    const m = JSON.parse(read(env, 'manifest.webmanifest'));
    for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) assert.ok(m[k], `missing ${k}`);
    assert.equal(m.display, 'standalone');
    const sizes = m.icons.map((i) => i.sizes);
    assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
    for (const i of m.icons) assert.ok(existsSync(join(out[env], i.src)), `icon missing: ${i.src}`);
  });

  test(`${env}: every offline file exists`, () => {
    const sw = read(env, 'sw.js');
    const list = sw.match(/var SHELL = \[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
    assert.ok(list.includes('offline.html'));
    for (const f of list) if (f !== './') assert.ok(existsSync(join(out[env], f)), `not built: ${f}`);
  });
}

test('only the test build shows the TEST label and uses test- storage', () => {
  assert.match(read('test', 'manifest.webmanifest'), /Baby Log TEST/);
  assert.doesNotMatch(read('live', 'manifest.webmanifest'), /TEST/);
  assert.match(read('test', 'config.js'), /var env = 'test'/);
  assert.match(read('live', 'config.js'), /var env = 'live'/);
  assert.match(read('test', 'index.html'), /id="test-banner"/);
});

test('no secrets in src/', () => {
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  for (const f of walk(new URL('../src', import.meta.url).pathname)) {
    if (f.endsWith('.png') || f.endsWith('.woff2')) continue;
    assert.doesNotMatch(readFileSync(f, 'utf8'), /client_secret|GOCSPX-|AIza[0-9A-Za-z_-]{20}/, f);
  }
});

// A new version must never mix with the previous one (seen on TEST after feature 001):
// install skips the HTTP cache, update checks skip it too, and pages come from the cache, like their scripts.
test('updates never mix an old and a new version', () => {
  const sw = read('test', 'sw.js');
  assert.match(sw, /new Request\(url, \{ cache: 'reload' \}\)/, 'install must bypass the HTTP cache');
  assert.match(sw, /req\.mode === 'navigate'[\s\S]*?fromCache\(req/, 'pages must come from this version\'s cache');
  assert.doesNotMatch(sw, /caches\.match\(/, 'look only in this version\'s cache');
  const app = read('test', 'app.js');
  assert.match(app, /updateViaCache: 'none'/);
  assert.match(app, /controllerchange[\s\S]*?location\.reload\(\)/);
});
