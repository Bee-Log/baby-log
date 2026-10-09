// The sign-in relay (broker/worker.mjs, ADR-002) against a fake Google. No real Google account or Cloudflare account is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle } from '../broker/worker.mjs';

const ORIGIN = 'https://bee-log.github.io';
const APP = 'https://bee-log.github.io/baby-log/';
const SECRET = 'GOCSPX-this-is-a-fake-secret-for-tests';
const env = {
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: SECRET,
  ALLOWED_ORIGINS: ORIGIN,
  REDIRECT_URIS: `${APP},${APP}test/`
};

// A fake Google token endpoint. `answer` is { status, json } or an Error to throw. Every request is kept in `calls`.
function fakeGoogle(answer) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, params: Object.fromEntries(new URLSearchParams(init.body)), headers: init.headers });
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.json), { status: answer.status || 200 });
  };
  fn.calls = calls;
  return fn;
}
const post = (path, body, origin = ORIGIN, extra = {}) => new Request('https://relay.example' + path, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body), ...extra
});
const json = async (res) => JSON.parse(await res.text());

test('the check page shows the relay is up and whether the secret is set, never the secret itself', async () => {
  const res = await handle(new Request('https://relay.example/'), env, fakeGoogle({}));
  assert.equal(res.status, 200);
  const text = await res.text();
  const body = JSON.parse(text);
  assert.deepEqual([body.ok, body.secretSet, body.clientId, body.allowedOrigins], [true, true, env.GOOGLE_CLIENT_ID, [ORIGIN]]);
  assert.ok(!text.includes(SECRET), 'the secret is not shown');
  const bare = await json(await handle(new Request('https://relay.example/'), { ...env, GOOGLE_CLIENT_SECRET: undefined }, fakeGoogle({})));
  assert.equal(bare.secretSet, false, 'it says when the secret is missing');
});

test('exchange: the one-time code goes to Google with the secret, and only what the phone needs comes back', async () => {
  const google = fakeGoogle({ json: { access_token: 'at-1', expires_in: 3599, refresh_token: 'rt-1', scope: 'https://www.googleapis.com/auth/drive.appdata', token_type: 'Bearer', id_token: 'should-not-be-passed-on' } });
  const res = await handle(post('/exchange', { code: 'code-1', redirect_uri: APP }), env, google);
  assert.equal(res.status, 200);
  assert.deepEqual(await json(res), { access_token: 'at-1', expires_in: 3599, scope: 'https://www.googleapis.com/auth/drive.appdata', refresh_token: 'rt-1' });
  assert.equal(google.calls.length, 1);
  assert.equal(google.calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.deepEqual(google.calls[0].params, { grant_type: 'authorization_code', code: 'code-1', redirect_uri: APP, client_id: env.GOOGLE_CLIENT_ID, client_secret: SECRET });
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('exchange can pass on a PKCE code verifier; a broken one is refused', async () => {
  const google = fakeGoogle({ json: { access_token: 'a', expires_in: 3600 } });
  await handle(post('/exchange', { code: 'c', redirect_uri: APP, code_verifier: 'v'.repeat(50) }), env, google);
  assert.equal(google.calls[0].params.code_verifier, 'v'.repeat(50));
  const bad = await handle(post('/exchange', { code: 'c', redirect_uri: APP, code_verifier: 42 }), env, google);
  assert.equal(bad.status, 400);
  assert.equal(google.calls.length, 1, 'Google was not asked');
});

test('exchange: only the app\'s own return addresses are accepted', async () => {
  const google = fakeGoogle({ json: { access_token: 'a' } });
  for (const redirect_uri of ['https://evil.example/', APP + 'x', 'postmessage', '', undefined, 7]) {
    const res = await handle(post('/exchange', { code: 'c', redirect_uri }), env, google);
    assert.equal(res.status, 400, String(redirect_uri));
  }
  assert.equal((await handle(post('/exchange', { code: 'c', redirect_uri: APP + 'test/' }), env, google)).status, 200, 'the test address is allowed');
  assert.equal(google.calls.length, 1);
});

test('refresh: a refresh token buys a new one-hour token, and no new refresh token is passed on', async () => {
  const google = fakeGoogle({ json: { access_token: 'at-2', expires_in: 3599, scope: 's', refresh_token: 'rt-new' } });
  const res = await handle(post('/refresh', { refresh_token: 'rt-1' }), env, google);
  assert.deepEqual(await json(res), { access_token: 'at-2', expires_in: 3599, scope: 's' });
  assert.deepEqual(google.calls[0].params, { grant_type: 'refresh_token', refresh_token: 'rt-1', client_id: env.GOOGLE_CLIENT_ID, client_secret: SECRET });
});

test('a refresh token that Google no longer accepts is reported as invalid_grant, so the phone can ask for a new sign-in', async () => {
  const google = fakeGoogle({ status: 400, json: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } });
  const res = await handle(post('/refresh', { refresh_token: 'old' }), env, google);
  assert.equal(res.status, 400);
  assert.deepEqual(await json(res), { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
});

test('when Google cannot be reached, the answer is 502, so the phone keeps its refresh token and tries again later', async () => {
  const res = await handle(post('/refresh', { refresh_token: 'rt' }), env, fakeGoogle(new Error('network down')));
  assert.equal(res.status, 502);
  assert.deepEqual(await json(res), { error: 'upstream_unreachable' });
});

test('a wrong client secret at Google is a setup problem (500), and the secret is never sent back', async () => {
  const google = fakeGoogle({ status: 401, json: { error: 'invalid_client', error_description: `The OAuth client was not found. ${SECRET}` } });
  const res = await handle(post('/exchange', { code: 'c', redirect_uri: APP }), env, google);
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.ok(!text.includes(SECRET));
  assert.equal(JSON.parse(text).error, 'invalid_client');
  for (const odd of [{ status: 500, json: { error: '<script>' } }, { status: 200, json: { no_token: true } }]) {
    const r = await handle(post('/exchange', { code: 'c', redirect_uri: APP }), env, fakeGoogle(odd));
    assert.equal(r.status, 400);
    assert.deepEqual(await json(r), { error: 'token_error' }, 'only a plain error name is passed on');
  }
});

test('other web addresses get nothing: no Google call, no access headers', async () => {
  const google = fakeGoogle({ json: { access_token: 'a' } });
  for (const origin of ['https://evil.example', 'http://bee-log.github.io', null]) {
    const res = await handle(post('/refresh', { refresh_token: 'rt' }, origin), env, google);
    assert.equal(res.status, 403, String(origin));
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(google.calls.length, 0);
  const pre = await handle(new Request('https://relay.example/refresh', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } }), env, google);
  assert.equal(pre.status, 403);
});

test('the browser\'s check before a request (CORS preflight) is answered for the app\'s address only', async () => {
  const res = await handle(new Request('https://relay.example/refresh', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } }), env, fakeGoogle({}));
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.match(res.headers.get('access-control-allow-methods'), /POST/);
  assert.match(res.headers.get('access-control-allow-headers'), /content-type/);
});

test('bad requests are refused before Google is asked', async () => {
  const google = fakeGoogle({ json: { access_token: 'a' } });
  const cases = [
    post('/refresh', 'not json'), post('/refresh', '[]'), post('/refresh', {}), post('/refresh', { refresh_token: '' }),
    post('/refresh', { refresh_token: 'x'.repeat(5000) }), post('/exchange', { code: 'c' }), post('/exchange', { redirect_uri: APP })
  ];
  for (const request of cases) assert.equal((await handle(request, env, google)).status, 400);
  assert.equal(google.calls.length, 0);
  assert.equal((await handle(post('/nope', {}), env, google)).status, 404);
  assert.equal((await handle(new Request('https://relay.example/refresh'), env, google)).status, 404, 'GET on a work address');
});

test('without the secret the relay says it is not set up, and asks Google nothing', async () => {
  const google = fakeGoogle({ json: { access_token: 'a' } });
  const res = await handle(post('/refresh', { refresh_token: 'rt' }), { ...env, GOOGLE_CLIENT_SECRET: undefined }, google);
  assert.equal(res.status, 500);
  assert.deepEqual(await json(res), { error: 'not_configured' });
  assert.equal(google.calls.length, 0);
});

test('the relay\'s files hold no secret, store nothing, and log nothing', () => {
  const files = ['broker/worker.mjs', 'broker/wrangler.toml'].map((f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
  for (const text of files) assert.doesNotMatch(text, /GOCSPX-/, 'a client secret must never be in the repository');
  const code = files[0].replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /console\.|\.put\(|KV|caches\.|D1|Durable/, 'no logging and no storage');
  const toml = files[1];
  assert.match(toml, /\[observability\]\s*enabled = false/);
  assert.doesNotMatch(toml, /GOOGLE_CLIENT_SECRET\s*=/, 'the secret is set with wrangler secret put, not in this file');
  const id = /GOOGLE_CLIENT_ID = "([^"]+)"/.exec(toml)[1];
  assert.match(readFileSync(new URL('../src/config.js', import.meta.url), 'utf8'), new RegExp(id.replace(/\./g, '\\.')), 'the same public client ID as the app');
});
