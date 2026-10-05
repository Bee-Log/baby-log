// Makes src/who-data.js: the WHO Child Growth Standards (L, M and S for each day of age) that feature 010 needs.
//
//   node scripts/make-who-data.mjs                  download the files from WHO's GitHub repository (pinned below)
//   node scripts/make-who-data.mjs <folder>         or read weianthro.txt and lenanthro.txt from a folder
//
// Source: WHO's own R package "anthro" (github.com/WorldHealthOrganization/anthro), data-raw/growthstandards.
// These are the same numbers as WHO's "expanded tables" (by day). See docs/research/who-growth-standards.md.
// Only weight-for-age and length-for-age are kept, for days 0 to 730 (birth to 2 years; length is measured lying down).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = 'b776d8a12b1c97369c748b561159fd2ec4f4db58';
const BASE = `https://raw.githubusercontent.com/WorldHealthOrganization/anthro/${COMMIT}/data-raw/growthstandards/`;
const FILES = { weight: 'weianthro.txt', length: 'lenanthro.txt' };
const LAST_DAY = 730;
const OUT = join(fileURLToPath(new URL('..', import.meta.url)), 'src', 'who-data.js');

async function readSource(name, folder) {
  if (folder) return readFileSync(join(folder, name), 'utf8');
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.text();
}

// Tab-separated, with a header: sex (1 boy, 2 girl), age (days), l, m, s (the length file adds loh).
function parse(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split('\t');
  const at = (name) => cols.indexOf(name);
  const out = { girl: { L: [], M: [], S: [] }, boy: { L: [], M: [], S: [] } };
  for (const line of lines) {
    const c = line.split('\t');
    const day = Number(c[at('age')]);
    if (day > LAST_DAY) continue;
    const t = out[c[at('sex')] === '2' ? 'girl' : 'boy'];
    if (t.M.length !== day) throw new Error(`day ${day} is out of order`);
    t.L.push(Number(c[at('l')])); t.M.push(Number(c[at('m')])); t.S.push(Number(c[at('s')]));
  }
  for (const t of Object.values(out)) {
    if (t.M.length !== LAST_DAY + 1) throw new Error(`expected ${LAST_DAY + 1} days, got ${t.M.length}`);
    if (t.L.every((v) => v === t.L[0])) t.L = t.L[0];      // the same L every day: keep one number
  }
  return out;
}

const folder = process.argv[2];
const data = { firstDay: 0, lastDay: LAST_DAY };
for (const [measure, name] of Object.entries(FILES)) data[measure] = parse(await readSource(name, folder));

const text = `// WHO Child Growth Standards: L, M and S for each day of age, from birth (day 0) to day ${LAST_DAY} (2 years).
// weight: weight-for-age, kg. length: length-for-age, cm, measured lying down. Index = age in days.
// Source: WHO Child Growth Standards, © World Health Organization. Copied from WHO's "anthro" package,
// ${BASE}
// Made by scripts/make-who-data.mjs. Do not edit by hand. See docs/research/who-growth-standards.md.
(function (root) {
  root.BABYLOG_WHO_DATA = ${JSON.stringify(data)};
})(typeof self !== 'undefined' ? self : this);
`;
writeFileSync(OUT, text);
console.log(`wrote ${OUT} (${Math.round(text.length / 1024)} KB)`);
