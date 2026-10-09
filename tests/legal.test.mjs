// The public pages in legal/ (about, privacy, terms) are shown on Google's sign-in consent screen.
// They must exist, link to each other, say what the app really does, and be published by the deploy workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const PAGES = ['index.html', 'privacy.html', 'terms.html'];

test('the three pages exist, have a title, and link to one another', () => {
  for (const name of PAGES) {
    assert.ok(existsSync(join(ROOT, 'legal', name)), `legal/${name} exists`);
    const html = read(`legal/${name}`);
    assert.match(html, /<title>Baby Log: [^<]+<\/title>/, `${name} has a title`);
    assert.match(html, /<html lang="en-AU">/);
    assert.match(html, /name="viewport"/, `${name} works on a phone`);
    for (const target of ['privacy.html', 'terms.html']) assert.ok(html.includes(`href="${target}"`), `${name} links to ${target}`);
  }
  assert.ok(read('legal/index.html').includes('href="privacy.html"'), 'the home page links to the privacy policy (Google asks for this)');
});

test('the pages hold no script, no outside files, no email address, no secret and no build token', () => {
  for (const name of PAGES) {
    const html = read(`legal/${name}`);
    assert.doesNotMatch(html, /<script|<link |<img |<iframe/i, `${name} loads nothing`);
    assert.doesNotMatch(html, /[\w.+-]+@[\w-]+\.[\w.]+/, `${name} has no email address`);
    assert.doesNotMatch(html, /GOCSPX-|client_secret|__[A-Z_]+__/, `${name} has no secret or token`);
  }
});

test('the privacy policy says what the app does: the same Google permission, no server, and how to delete', () => {
  const html = read('legal/privacy.html');
  const scope = /auth\/([a-z.]+)'/.exec(read('src/google-auth.js'))[1];
  assert.ok(html.includes(`<strong>${scope}</strong>`), `the policy names the permission the app asks for (${scope})`);
  assert.match(html, /no server and no database/);
  assert.match(html, /Google API Services User Data Policy<\/a>, including the Limited Use requirements/);
  assert.match(html, /Sign out on this phone/);
  assert.match(html, /myaccount\.google\.com\/permissions/);
  assert.match(html, /Last updated \d{1,2} [A-Z][a-z]+ 20\d\d/);
});

test('the deploy workflow publishes the folder from main, so the addresses work without a LIVE release', () => {
  const yml = read('.github/workflows/deploy.yml');
  assert.match(yml, /mkdir -p _site\/legal/);
  assert.match(yml, /cp main-src\/legal\/\*\.html _site\/legal\//);
});
