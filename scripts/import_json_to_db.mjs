// One-off, kept for provenance: fills data/trackme.db from the v1.1.1 JSON files (data/*.json) and the
// lists that used to be hard-coded in scripts/build.py. Usage: node scripts/import_json_to_db.mjs [jsonDir] [out.db]
// The JSON files were deleted once the db was verified identical (the build output matched the Python build byte for byte); data/ was never in git, so this script can no longer be re-run. Kept for provenance.
// Portions are NOT imported here (see scripts/seed_portions.mjs).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = resolve(process.argv[2] || join(ROOT, 'data'));
const out = resolve(process.argv[3] || join(ROOT, 'data/trackme.db'));
const load = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

const ifct = load('ifct_foods.json'), dishes = load('household_units.json'), fats = load('fats_oils.json');
const hing = load('aliases_hinglish.json'), met = load('met.json');

// ---- lists formerly hard-coded in build.py ----
const SUPERSEDED = new Set(['ghee', 'vegetable cooking oil (groundnut, sunflower, etc.)']); // dish rows replaced by fats_oils
const SUPERSEDED_IFCT = new Set(['Milk, whole, Cow', 'Milk, whole, Buffalo']);               // replaced by cooked/derived dishes
const ALIASES = [
  ['roti', 'chapati chapatti chappati chapathi phulka fulka'], ['tea', 'green lemon iced'],
  ['veg', 'vegetable'], ['buffalo', 'bhains bhaisa'],
  ['chai', 'masala adrak ginger elaichi cardamom'], ['rice', 'chawal bhat'],
  ['dal', 'daal dhal lentil'], ['khichdi', 'khichri'], ['curd', 'yogurt yoghurt'],
  ['milk', 'doodh dudh'], ['paneer', 'cottage cheese'], ['aloo', 'potato batata'],
  ['egg', 'anda'], ['ghee', 'clarified butter desi'], ['oil', 'tel'],
  ['mustard', 'sarson'], ['vanaspati', 'dalda margarine'],
  ['butter', 'makhan'], ['chole', 'chana masala chickpea'], ['rajma', 'kidney beans'],
  ['chai', 'tea'], ['poha', 'pohe aval flattened'], ['upma', 'rava sooji'],
  ['dosa', 'dosai'], ['sugar', 'cheeni shakkar'], ['jaggery', 'gur gud'],
  ['almonds', 'badam'], ['banana', 'kela'], ['apple', 'seb'], ['onion', 'pyaz'],
  ['tomato', 'tamatar'], ['biryani', 'biriyani'], ['bhindi', 'okra ladyfinger'],
  ['gobi', 'gobhi phoolgobi'], ['chilla', 'cheela'], ['thepla', 'methi paratha'],
  ['oats', 'porridge oatmeal'], ['bread', 'toast'], ['biscuit', 'cookie'],
  ['chaas', 'buttermilk chhach'], ['lassi', 'dahi drink'], ['coffee', 'kaapi'],
  ['namkeen', 'bhujia mixture'], ['pav', 'bun'], ['pulao', 'pilaf pulav'],
  ['bhatura', 'bhature bhatoora'], ['raita', 'dahi'], ['bhurji', 'scrambled'], ['makhani', 'dal makhani'],
];
const NAME_ALIASES = [['toor', 'toor arhar tur'], ['moong', 'moong mung green gram'], ['urad', 'urad black gram'], ['toned', 'toned']];
const POPULAR = new Set([
  'chicken biryani', 'sambar', 'paratha (plain, with oil)', 'samosa (fried, potato filling)', 'rajma (kidney bean curry)', 'chole (chickpea curry)', 'khichdi (moong dal + rice, cooked)',
  'plain rice, cooked (white)', 'roti / phulka (whole wheat, no ghee)', 'dal tadka (with ghee/oil)',
  'egg, boiled (whole)', 'cow milk, toned (3% fat)', 'cow milk, whole', 'banana, ripe', 'apple',
  'chai (milk tea with 1 tsp sugar)', 'curd / dahi (whole milk)', 'ghee', 'cooking oil (refined / sunflower / groundnut / soybean)',
  'butter (salted)', 'paneer (fresh cottage cheese)', 'idli (steamed, rice + urad dal 3:1)', 'dal (toor), cooked, light tadka',
  'mixed vegetable sabzi (dry, 1 tsp oil)', 'plain dosa (rice + urad batter)', 'poha (flattened rice, cooked, with 1 tsp oil)',
]);
const VEG_KATORI = [['1 katori (100 g, chopped)', 100]];
const RAW_UNITS = { 'Fruits': VEG_KATORI, 'Other Vegetables': VEG_KATORI, 'Roots and Tubers': VEG_KATORI,
  'Green Leafy Vegetables': [['1 katori (50 g, chopped)', 50]], 'Mushrooms': VEG_KATORI };
// per-piece weights that used to live in app.js (COUNTG): [name regex source, noun, grams]
const COUNT_UNITS = [['cashew', 'cashew', 1.5], ['^figs?\\b', 'fig', 25.5], ['^dates?\\b', 'date', 7], ['walnut', 'walnut', 4], ['pistachio', 'pistachio', 0.7], ['raisin', 'raisin', 0.5]];

rmSync(out, { force: true });
const db = new DatabaseSync(out);
db.exec(`
PRAGMA journal_mode = DELETE;
CREATE TABLE foods (
  id TEXT PRIMARY KEY, ord INTEGER NOT NULL, name TEXT NOT NULL, grp TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ifct','dish','fat')),
  kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL, fibre REAL NOT NULL,  -- per 100 g
  estimate INTEGER NOT NULL CHECK (estimate IN (0,1)), origin TEXT NOT NULL, basis TEXT NOT NULL,
  popular INTEGER NOT NULL DEFAULT 0, superseded INTEGER NOT NULL DEFAULT 0   -- superseded rows are kept for provenance, not built
);
CREATE TABLE measures (  -- household units that came with the food table
  food_id TEXT NOT NULL REFERENCES foods(id), ord INTEGER NOT NULL, label TEXT NOT NULL, grams REAL NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY (food_id, ord)
);
CREATE TABLE portions (  -- typical quantities (D): everything here is merged into the app's unit picker
  food_id TEXT NOT NULL REFERENCES foods(id), ord INTEGER NOT NULL, label TEXT NOT NULL, grams REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('estimate','ifct','user-report')), note TEXT NOT NULL,
  PRIMARY KEY (food_id, ord)
);
CREATE TABLE aliases (  -- kind: dish = whole word in the dish name, name = substring of the lowercase name, raw = word in a raw IFCT name
  kind TEXT NOT NULL CHECK (kind IN ('dish','name','raw')), ord INTEGER NOT NULL, word TEXT NOT NULL, extra TEXT NOT NULL,
  src TEXT NOT NULL, PRIMARY KEY (kind, ord)
);
CREATE TABLE met_activities (ord INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, label TEXT NOT NULL, met REAL NOT NULL, kmh INTEGER, kw TEXT NOT NULL); -- kw: JSON array
CREATE TABLE met_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- JSON values: note, brisk, stepM, defaultMinutes
CREATE TABLE count_units (  -- weight of ONE piece (cashew, fig ...); inlined into app.js
  ord INTEGER PRIMARY KEY, pattern TEXT NOT NULL, noun TEXT NOT NULL, grams REAL NOT NULL
);
`);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
const seen = new Set();
function uid(prefix, name) {
  const base = prefix + slug(name);
  let k = base, n = 2;
  while (seen.has(k)) k = `${base}_${n++}`;
  seen.add(k); return k;
}
const insFood = db.prepare('INSERT INTO foods VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const insMeas = db.prepare('INSERT INTO measures VALUES (?,?,?,?,?)');
let ord = 0;
function addDish(d, source, superseded) {
  const n = d.per_100g;
  const id = superseded ? 'x_' + slug(d.name) : uid('d_', d.name);
  insFood.run(id, ord++, d.name, d.category, source, n.kcal, n.protein, n.carbs, n.fat, n.fibre,
    d.source === 'estimate' ? 1 : 0, d.source, d.basis, POPULAR.has(d.name.toLowerCase()) ? 1 : 0, superseded ? 1 : 0);
  d.measures.forEach((m, i) => insMeas.run(id, i, m.label, m.grams, 'household'));
}
// order matters (ids and search order): dishes, fats, raw IFCT
for (const d of dishes.filter((d) => !SUPERSEDED.has(d.name.toLowerCase()))) addDish(d, 'dish', false);
for (const d of fats) addDish(d, 'fat', false);
for (const d of dishes.filter((d) => SUPERSEDED.has(d.name.toLowerCase()))) addDish(d, 'dish', true);
for (const x of ifct) {
  const sup = SUPERSEDED_IFCT.has(x.name);
  const id = sup ? 'x_' + slug(x.name) : uid('i_', x.name);
  insFood.run(id, ord++, x.name, x.group, 'ifct', x.kcal, x.protein, x.carbs, x.fat, x.fibre, 0, 'IFCT',
    'IFCT 2017 (NIN Hyderabad), per 100 g edible portion, as in the extract.', 0, sup ? 1 : 0);
  (RAW_UNITS[x.group] || []).forEach((m, i) => insMeas.run(id, i, m[0], m[1], 'group-default'));
}

const insAl = db.prepare('INSERT INTO aliases VALUES (?,?,?,?,?)');
ALIASES.forEach(([w, e], i) => insAl.run('dish', i, w, e, 'builtin'));
hing.dishes.forEach(([w, e], i) => insAl.run('dish', ALIASES.length + i, w, e, 'hinglish'));
NAME_ALIASES.forEach(([w, e], i) => insAl.run('name', i, w, e, 'builtin'));
hing.raw.forEach(([w, e], i) => insAl.run('raw', i, w, e, 'hinglish'));

const insMet = db.prepare('INSERT INTO met_activities VALUES (?,?,?,?,?,?)');
met.activities.forEach((a, i) => insMet.run(i, a.key, a.label, a.met, a.kmh ?? null, JSON.stringify(a.kw)));
const insMM = db.prepare('INSERT INTO met_meta VALUES (?,?)');
for (const k of ['note', 'brisk', 'stepM', 'defaultMinutes']) insMM.run(k, JSON.stringify(met[k]));
if (Object.keys(met).length !== 5) throw new Error('met.json has an unexpected key');

const insCU = db.prepare('INSERT INTO count_units VALUES (?,?,?,?)');
COUNT_UNITS.forEach(([p, n, g], i) => insCU.run(i, p, n, g));

for (const t of ['foods', 'measures', 'aliases', 'met_activities', 'count_units'])
  console.log(t, db.prepare(`SELECT count(*) c FROM ${t}`).get().c);
db.close();
