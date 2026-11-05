// Build the TrackMe site into the repo ROOT (GitHub Pages serves it) from src/ + data/trackme.db. No npm dependencies.
// Usage: node scripts/build.mjs
// Writes ONLY its own files: index.html app.js app.css sw.js manifest.webmanifest llm-worker.js probe-worker.js early.js
// report.js icons/* .nojekyll, and trackme-site.zip. README.md, CHANGELOG.md and vendor/ are hand-kept and only read (zipped).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateRawSync, crc32 } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CAP = 450 * 1024;
const rd = (p) => readFileSync(join(ROOT, p));
const db = new DatabaseSync(join(ROOT, 'data/trackme.db'), { readOnly: true });
const all = (sql) => db.prepare(sql).all();

// JSON like the old Python build wrote it: a float with no fraction keeps ".0" (132.0), so output stays byte-identical
class PF { constructor(v) { this.v = v; } }
const pf = (v) => new PF(v);
function ser(v) {
  if (v instanceof PF) return Number.isInteger(v.v) ? v.v.toFixed(1) : String(v.v);
  if (Array.isArray(v)) return '[' + v.map(ser).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ':' + ser(x)).join(',') + '}';
  return JSON.stringify(v);
}
const inline = (v) => ser(v).replaceAll('</', '<\\/');

// ---- aliases ----
const A = { dish: [], name: [], raw: [] };
for (const a of all('SELECT kind, word, extra FROM aliases ORDER BY kind, ord')) A[a.kind].push([a.word, a.extra]);
const RAW_ALIASES = new Map(A.raw); // a later row for the same word wins
function aliasFor(name, own) { // own = a v1.1.5 liquid: only its own name aliases (a dish word like orange / tomato must not hand it santra / tamatar)
  const low = name.toLowerCase();
  const base = new Set(low.split('(')[0].split(/[^a-z0-9]+/));
  const words = [...A.dish.filter(([k]) => !own && base.has(k)).map((x) => x[1]), ...A.name.filter(([k]) => low.includes(k)).map((x) => x[1])].join(' ').split(/\s+/).filter(Boolean);
  return [...new Set(words)].join(' ');
}
function rawAliasFor(name) {
  const words = name.toLowerCase().split('(')[0].split(/[^a-z0-9]+/).filter(Boolean), base = new Set(words), phrase = ' ' + words.join(' ') + ' ';
  // a key with a space is a phrase ("water melon"), matched as whole words anywhere in the name
  return [...RAW_ALIASES.keys()].sort().filter((k) => (k.includes(' ') ? phrase.includes(' ' + k + ' ') : base.has(k))).map((k) => RAW_ALIASES.get(k)).join(' ');
}

// ---- foods: units = household measures (minus "2 idli" style multiples) then portions ----
const group = (rows) => { const m = new Map(); for (const r of rows) { if (!m.has(r.food_id)) m.set(r.food_id, []); m.get(r.food_id).push(r); } return m; };
const measures = group(all('SELECT * FROM measures ORDER BY food_id, ord'));
const portions = group(all('SELECT * FROM portions ORDER BY food_id, ord'));
const SIZES = Object.fromEntries(all('SELECT key, ml FROM household_sizes').map((x) => [x.key, x.ml]));
// a volume row has no grams of its own: ml (standard size or own vessel) x the food's density. That rounded number is BOTH the label's and the arithmetic's.
const round1 = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
const unitOf = (p, f) => {
  if (p.kind !== 'volume') return [p.label, p.grams];
  const ml = p.size ? SIZES[p.size] : p.ml, g = round1(ml * f.density);
  const amt = f.base_unit === 'ml' || /glass/.test(p.label) ? ml + ' ml' : (f.density_src === 'sourced' && p.size !== 'katori' && p.size !== 'bowl' ? '' : '~') + g + ' g';
  return [p.label + ' (' + amt + (p.qual ? ', ' + p.qual : '') + ')', g];
};
const rows = [];
// the DB stores nutrition per 1 g (liquids: per 1 ml); the app keeps per-100 g inside. toPrecision(12) undoes the /100 drift exactly.
const per100 = (f, c) => Number(((f[c + '_1'] * 100) / (f.base_unit === 'ml' ? f.density : 1)).toPrecision(12));
for (const f of all('SELECT * FROM foods WHERE superseded = 0 ORDER BY ord')) {
  const isDish = f.source !== 'ifct';
  const ms = (measures.get(f.id) || []).map((m) => unitOf(m, f));
  const units = [];
  for (const [lab, g] of ms) {
    const mm = /^([2-9])\s/.exec(lab);
    if (isDish && mm && ms.some(([, g2]) => g2 !== g && Math.abs(g2 * Number(mm[1]) - g) < 1e-6)) continue;
    units.push([lab, g]);
  }
  const extra = (portions.get(f.id) || []).map((p) => unitOf(p, f)).filter(([l]) => !units.some(([l2]) => l2.toLowerCase() === l.toLowerCase()));
  // raw IFCT foods: the food's own portion ("1 medium guava") goes before the group default ("1 katori, chopped"), so a typed count ("10 strawberries") uses it
  if (isDish) units.push(...extra); else units.unshift(...extra);
  rows.push([f.id, f.name, pf(per100(f, 'kcal')), pf(per100(f, 'protein')), pf(per100(f, 'carbs')), pf(per100(f, 'fat')), pf(per100(f, 'fibre')), f.estimate, f.grp,
    isDish ? aliasFor(f.name, f.grp === 'Beverages and liquids') : rawAliasFor(f.name), units, f.popular, isDish ? 1 : 0, +(f.density || 0).toFixed(4), f.base_unit === 'ml' ? 1 : 0, f.source === 'cooked' ? (f.origin.startsWith('USDA') ? 'USDA' : 'EST') : '']);
  while (!rows[rows.length - 1][rows[rows.length - 1].length - 1] && rows[rows.length - 1].length > 13) rows[rows.length - 1].pop(); // trailing defaults left out
}
const meta = Object.fromEntries(all('SELECT key, value FROM met_meta').map((r) => [r.key, JSON.parse(r.value)]));
const met = { note: meta.note, activities: all('SELECT key, label, met, kmh, kw FROM met_activities ORDER BY ord').map((a) => {
  const o = { key: a.key, label: a.label, met: pf(a.met) }; if (a.kmh !== null) o.kmh = a.kmh; o.kw = JSON.parse(a.kw); return o; }),
  brisk: meta.brisk, stepM: meta.stepM, defaultMinutes: meta.defaultMinutes };
const countG = '[' + all('SELECT pattern, noun, grams FROM count_units ORDER BY ord').map((c) => `[/${c.pattern}/,'${c.noun}',${c.grams}]`).join(',') + ']';
const HSIZE = SIZES;
db.close();

const swap = (s, marker, val) => { if (!s.includes(marker)) throw new Error('missing ' + marker); return s.split(marker).join(val); };
let html = rd('src/index.src.html').toString('utf8');
html = swap(html, '/*__FOODS__*/', inline(rows));
html = swap(html, '/*__MET__*/', inline(met));
const appJs = Buffer.from(swap(swap(rd('src/app.js').toString('utf8'), '/*__COUNTG__*/null', countG), '/*__HSIZE__*/null', inline(HSIZE)), 'utf8');
const htmlB = Buffer.from(html, 'utf8');

// ---- shell cache version (hash over the shell files in this order) ----
const parts = [['index.html', htmlB], ['app.js', appJs], ['app.css', rd('src/app.css')], ['manifest.webmanifest', rd('src/manifest.webmanifest')],
  ['llm-worker.js', rd('src/llm-worker.js')], ['probe-worker.js', rd('src/probe-worker.js')], ['early.js', rd('src/early.js')], ['report.js', rd('src/report.js')],
  ['icons/icon.svg', rd('src/icon.svg')], ['icons/192.png', rd('src/icons/icon-192.png')], ['icons/512.png', rd('src/icons/icon-512.png')],
  ['icons/maskable-512.png', rd('src/icons/icon-maskable-512.png')], ['sw.src.js', rd('src/sw.src.js')]];
const hh = createHash('sha256');
for (const [n, d] of parts) { hh.update(n); hh.update(Buffer.from([0])); hh.update(d); }
const VERSION = hh.digest('hex').slice(0, 10);
const lh = createHash('sha256');
for (const lib of ['vendor/web-llm/web-llm.js', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs']) { lh.update(lib); lh.update(Buffer.from([0])); lh.update(rd(lib)); }
const LIBVER = lh.digest('hex').slice(0, 12);
const sw = swap(swap(rd('src/sw.src.js').toString('utf8'), '__SHELL_VERSION__', VERSION), '__LIB_VERSION__', LIBVER);

// ---- write (own files only) ----
const OUT = [['index.html', htmlB], ['app.js', appJs], ['app.css', rd('src/app.css')], ['sw.js', sw], ['manifest.webmanifest', rd('src/manifest.webmanifest')],
  ['llm-worker.js', rd('src/llm-worker.js')], ['probe-worker.js', rd('src/probe-worker.js')], ['early.js', rd('src/early.js')], ['report.js', rd('src/report.js')],
  ['icons/icon.svg', rd('src/icon.svg')], ['icons/192.png', rd('src/icons/icon-192.png')], ['icons/512.png', rd('src/icons/icon-512.png')],
  ['icons/maskable-512.png', rd('src/icons/icon-maskable-512.png')], ['.nojekyll', '']];
mkdirSync(join(ROOT, 'icons'), { recursive: true });
for (const [n, d] of OUT) writeFileSync(join(ROOT, n), d);

let total = 0;
for (const n of ['index.html', 'app.js', 'app.css']) { const s = statSync(join(ROOT, n)).size; total += s; console.log(`  ${n}: ${(s / 1024).toFixed(1)} KB`); }
console.log(`${rows.length} foods; app shell (html+js+css) ${(total / 1024).toFixed(1)} KB; shell cache trackme-shell-v${VERSION}`);
if (total > CAP) { console.log('ERROR: html+js+css is over 450 KB'); process.exit(1); }

// ---- zip: exactly the site files (index.html at the zip root) ----
function walk(rel) { // sorted, files only
  return readdirSync(join(ROOT, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((e) => (e.isDirectory() ? walk(rel + '/' + e.name) : [rel + '/' + e.name]));
}
const siteFiles = [...OUT.map(([n]) => n), 'README.md', 'CHANGELOG.md', ...(existsSync(join(ROOT, 'vendor')) ? walk('vendor') : [])];
const zipParts = [], central = []; let off = 0;
for (const name of siteFiles) {
  const data = rd(name), comp = deflateRawSync(data, { level: 9 }), nm = Buffer.from(name), crc = crc32(data);
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
  zipParts.push(h, nm, comp); central.push(c, nm); off += 30 + nm.length + comp.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(siteFiles.length, 8); end.writeUInt16LE(siteFiles.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
const zip = Buffer.concat([...zipParts, cd, end]);
writeFileSync(join(ROOT, 'trackme-site.zip'), zip);
console.log(`${siteFiles.length} files in trackme-site.zip (${(zip.length / 1048576).toFixed(1)} MB)`);
