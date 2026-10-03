// A small fake of the Google Drive REST API, for tests: only the app-data folder calls that src/drive.js makes.
// handle() takes a request and returns { status, contentType, body }. fetchFor() wraps it as a fetch function (unit tests).
// The browser tests call handle() from Playwright's page.route.
export function createFakeDrive({ token = 'good-token' } = {}) {
  const files = new Map();     // id -> { id, name, text, version }
  let counter = 0;
  const state = { requests: [], files, token, failWith: null };

  const json = (obj, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(obj) });
  const forVersion = (f) => ({ id: f.id, version: f.version });

  function handle(method, rawUrl, headers = {}, body = '') {
    const url = new URL(rawUrl);
    state.requests.push(`${method} ${url.pathname}${url.search}`);
    if (state.failWith) return { status: state.failWith, contentType: 'text/plain', body: 'failed' };
    const auth = headers.authorization || headers.Authorization || '';
    if (auth !== `Bearer ${state.token}`) return json({ error: 'unauthorised' }, 401);

    if (method === 'GET' && url.pathname === '/drive/v3/files') {
      if (url.searchParams.get('spaces') !== 'appDataFolder') return json({ error: 'wrong space' }, 400);
      return json({ files: [...files.values()].map((f) => ({ id: f.id, name: f.name, version: f.version })) });
    }
    const one = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (method === 'GET' && one) {
      const f = files.get(one[1]);
      if (!f) return json({ error: 'not found' }, 404);
      return { status: 200, contentType: 'text/plain', body: f.text };
    }
    if (method === 'POST' && url.pathname === '/upload/drive/v3/files') {
      const boundary = /boundary=(.+)$/.exec(headers['content-type'] || headers['Content-Type'] || '')[1];
      const parts = body.split('--' + boundary).filter((p) => p.trim() && p.trim() !== '--');
      const section = (p) => p.slice(p.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '');
      const meta = JSON.parse(section(parts[0]));
      if (!meta.parents || meta.parents[0] !== 'appDataFolder') return json({ error: 'must be created in appDataFolder' }, 400);
      const f = { id: `id${++counter}`, name: meta.name, text: section(parts[1]), version: String(++counter) };
      files.set(f.id, f);
      return json(forVersion(f));
    }
    const upload = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (method === 'PATCH' && upload) {
      const f = files.get(upload[1]);
      if (!f) return json({ error: 'not found' }, 404);
      f.text = body;
      f.version = String(++counter);
      return json(forVersion(f));
    }
    return json({ error: `unexpected ${method} ${url.pathname}` }, 400);
  }

  function fetchFor() {
    return async (url, init = {}) => {
      if (state.offline) throw new TypeError('Failed to fetch');
      const r = handle(init.method || 'GET', url, init.headers || {}, init.body || '');
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => JSON.parse(r.body), text: async () => r.body };
    };
  }

  return Object.assign(state, { handle, fetchFor, file: (name) => [...files.values()].find((f) => f.name === name) });
}
