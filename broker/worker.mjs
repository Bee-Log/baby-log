// Baby Log sign-in relay (ADR-002), a small Cloudflare Worker.
// It holds Google's client secret, which a web page cannot keep. It does two jobs and nothing else:
//   POST /exchange  swaps a one-time Google sign-in code for tokens (a refresh token and a one-hour access token)
//   POST /refresh   swaps a refresh token for a new one-hour access token
// It stores nothing: no database, no key-value store, and it logs nothing it receives. It never sees an entry:
// the phone talks to Google Drive by itself, with the access token.
// The client secret is a Worker secret (GOOGLE_CLIENT_SECRET). It is never in this repository.
// Settings (broker/wrangler.toml): GOOGLE_CLIENT_ID, ALLOWED_ORIGINS, REDIRECT_URIS (all comma-separated lists).

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_BODY = 4096;      // bytes: a code or a token is far smaller
const MAX_FIELD = 2048;

const list = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
const field = (v) => (typeof v === 'string' && v.length > 0 && v.length <= MAX_FIELD ? v : null);

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'Origin'
  };
}

// origin: the allowed web address to answer, or null (no cross-site access is given)
function reply(status, body, origin) {
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Origin' };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch (err) {
    return null;
  }
}

async function askGoogle(params, doFetch) {
  try {
    const res = await doFetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, json: json && typeof json === 'object' ? json : {} };
  } catch (err) {
    return { network: true };
  }
}

// Passes on only what the phone needs. Google's own error name is passed on so a problem can be understood.
function answer(result, secret, origin, keepRefresh) {
  if (result.network) return reply(502, { error: 'upstream_unreachable' }, origin);
  const j = result.json;
  if (!result.ok || typeof j.access_token !== 'string') {
    const error = typeof j.error === 'string' && /^[a-z_]{1,64}$/.test(j.error) ? j.error : 'token_error';
    let description = typeof j.error_description === 'string' ? j.error_description.slice(0, 200) : '';
    if (description.includes(secret)) description = '';
    const body = description ? { error, error_description: description } : { error };
    return reply(error === 'invalid_client' || error === 'unauthorized_client' ? 500 : 400, body, origin);
  }
  const out = { access_token: j.access_token, expires_in: Number(j.expires_in) || 3600, scope: typeof j.scope === 'string' ? j.scope : '' };
  if (keepRefresh && typeof j.refresh_token === 'string') out.refresh_token = j.refresh_token;
  return reply(200, out, origin);
}

export async function handle(request, env, doFetch) {
  const url = new URL(request.url);
  const origins = list(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('origin');
  const allowed = !!origin && origins.includes(origin);

  // A page for a person to check that the relay is up and set up. It shows no secret.
  if (request.method === 'GET' && url.pathname === '/') {
    return reply(200, {
      name: 'baby-log-relay', ok: true, secretSet: !!env.GOOGLE_CLIENT_SECRET, clientId: env.GOOGLE_CLIENT_ID || null,
      allowedOrigins: origins, redirectUris: list(env.REDIRECT_URIS)
    }, null);
  }
  if (request.method === 'OPTIONS') {
    return allowed ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : reply(403, { error: 'origin_not_allowed' }, null);
  }
  const route = request.method === 'POST' ? url.pathname : '';
  if (route !== '/exchange' && route !== '/refresh') return reply(404, { error: 'not_found' }, null);
  if (!allowed) return reply(403, { error: 'origin_not_allowed' }, null);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return reply(500, { error: 'not_configured' }, origin);

  const body = await readJson(request);
  if (!body) return reply(400, { error: 'bad_request' }, origin);
  const base = { client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET };

  if (route === '/exchange') {
    const code = field(body.code), redirectUri = field(body.redirect_uri);
    // Only the app's own addresses are accepted, so the relay cannot be used for another page.
    if (!code || !redirectUri || !list(env.REDIRECT_URIS).includes(redirectUri)) return reply(400, { error: 'bad_request' }, origin);
    const params = { ...base, grant_type: 'authorization_code', code, redirect_uri: redirectUri };
    if (body.code_verifier !== undefined) {
      if (!field(body.code_verifier)) return reply(400, { error: 'bad_request' }, origin);
      params.code_verifier = body.code_verifier;
    }
    return answer(await askGoogle(params, doFetch), env.GOOGLE_CLIENT_SECRET, origin, true);
  }

  const refreshToken = field(body.refresh_token);
  if (!refreshToken) return reply(400, { error: 'bad_request' }, origin);
  return answer(await askGoogle({ ...base, grant_type: 'refresh_token', refresh_token: refreshToken }, doFetch), env.GOOGLE_CLIENT_SECRET, origin, false);
}

export default {
  fetch(request, env) { return handle(request, env, (...args) => globalThis.fetch(...args)); }
};
