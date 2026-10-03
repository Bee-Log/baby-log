#!/usr/bin/env node
// Build the static app from src/ into an output folder.
//
//   node scripts/build.mjs                         -> dist/test and dist/live
//   node scripts/build.mjs --env test --out _site/test --version abc123
//
// The build copies src/ and fills in double-underscore tokens in text files. No dependencies.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const TEXT = new Set(['.html', '.js', '.css', '.json', '.webmanifest']);

const FLAVOURS = {
  live: { APP_NAME: 'Baby Log', APP_SHORT_NAME: 'Baby Log', THEME_COLOR: '#2e5e8c', ICON_PREFIX: '' },
  test: { APP_NAME: 'Baby Log TEST', APP_SHORT_NAME: 'Baby TEST', THEME_COLOR: '#c75c28', ICON_PREFIX: 'test-' }
};

export function build({ env, out, version }) {
  const flavour = FLAVOURS[env];
  if (!flavour) throw new Error(`Unknown env "${env}". Use "test" or "live".`);
  const tokens = { ...flavour, APP_ENV: env, APP_VERSION: version };

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(SRC, out, { recursive: true });

  for (const file of walk(out)) {
    if (!TEXT.has(extname(file))) continue;
    const before = readFileSync(file, 'utf8');
    const after = before.replace(/__([A-Z_]+)__/g, (m, key) => (key in tokens ? tokens[key] : m));
    const left = after.match(/__[A-Z_]+__/);
    if (left) throw new Error(`Unreplaced token ${left[0]} in ${file}`);
    if (after !== before) writeFileSync(file, after);
  }
  return out;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const version = arg('version', process.env.APP_VERSION || 'dev');
  const env = arg('env');
  const targets = env ? [{ env, out: arg('out', join(ROOT, 'dist', env)) }]
                      : [{ env: 'test', out: join(ROOT, 'dist', 'test') }, { env: 'live', out: join(ROOT, 'dist', 'live') }];
  for (const t of targets) {
    build({ ...t, version });
    console.log(`built ${t.env} (${version}) -> ${t.out}`);
  }
}
