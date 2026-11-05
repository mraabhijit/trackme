// Imports cooked-vegetable rows into data/trackme.db (v1.1.4). Offline and re-runnable: it deletes all source='cooked' rows first.
// Usage: node --no-warnings scripts/import_cooked.mjs <folder with the USDA SR Legacy CSV files> [--source=usda-sr]
//   Folder = the unzipped FoodData_Central_sr_legacy_food_csv_2018-04.zip (https://fdc.nal.usda.gov/download-datasets); needs food.csv,
//   food_nutrient.csv, food_portion.csv. The files are read as data only (nothing from that folder is executed).
// Licence: USDA FoodData Central data are public domain, CC0 1.0 Universal (https://fdc.nal.usda.gov/, "Licensing"); we credit FoodData Central anyway.
// Carbohydrate: USDA nutrient 1005 is "by difference" and INCLUDES fibre; this app's IFCT carbs exclude fibre (92 IFCT rows have carbs < fibre),
// so carbs_1 = (1005 - 1079) / 100 (never below 0). Everything else is stored as published.
import { DatabaseSync } from 'node:sqlite';
import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USDA, DERIVED, CLASSES } from './cooked_list.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = process.argv[2];
const source = (process.argv.find((a) => a.startsWith('--source=')) || '--source=usda-sr').slice(9);
const FILES = ['food.csv', 'food_nutrient.csv', 'food_portion.csv'];
if (!dir || FILES.some((f) => !existsSync(join(dir, f)))) { console.error(`usage: import_cooked.mjs <USDA SR Legacy CSV folder>; the folder must hold ${FILES.join(', ')} (missing: ${dir ? FILES.filter((f) => !existsSync(join(dir, f))).join(', ') : 'folder'}). The database was not touched.`); process.exit(1); }
if (source !== 'usda-sr') { console.error('only --source=usda-sr is implemented (CoFID could be added with its own column map)'); process.exit(1); }

function csvLine(l) { // quoted fields, "" inside quotes
  const out = []; let i = 0;
  while (i <= l.length) {
    if (l[i] === '"') { let v = ''; i++; for (; i < l.length; i++) { if (l[i] === '"') { if (l[i + 1] === '"') { v += '"'; i++; } else { i++; break; } } else v += l[i]; } out.push(v); i++; }
    else { const j = l.indexOf(',', i); const e = j < 0 ? l.length : j; out.push(l.slice(i, e)); i = e + 1; }
  }
  return out;
}
async function rows(file, keep) { // streams a CSV, returns objects for the rows keep(obj) accepts
  const rl = createInterface({ input: createReadStream(join(dir, file)), crlfDelay: Infinity }); let head = null; const out = [];
  for await (const l of rl) { if (!l) continue; const f = csvLine(l); if (!head) { head = f; continue; } const o = {}; head.forEach((h, k) => { o[h] = f[k]; }); if (keep(o)) out.push(o); }
  return out;
}
const need = new Set([...USDA.map((x) => x[0]), ...Object.values(CLASSES).flatMap((c) => c.pairs.flat())].map(String));
const foods = new Map((await rows('food.csv', (o) => need.has(o.fdc_id))).map((o) => [o.fdc_id, o.description]));
const NUT = { 1008: 'kcal', 1003: 'protein', 1004: 'fat', 1005: 'carbsDiff', 1079: 'fibre' };
const nut = new Map();
for (const o of await rows('food_nutrient.csv', (o) => need.has(o.fdc_id) && NUT[o.nutrient_id])) { if (!nut.has(o.fdc_id)) nut.set(o.fdc_id, {}); nut.get(o.fdc_id)[NUT[o.nutrient_id]] = Number(o.amount); }
const pieces = new Map(); // fdcId|modifier -> grams of ONE piece (USDA food_portion; "8 pods" = 85 g gives 10.6 g)
for (const o of await rows('food_portion.csv', (o) => need.has(o.fdc_id) && Number(o.amount) > 0 && Number(o.gram_weight) > 0)) pieces.set(o.fdc_id + '|' + o.modifier, Math.round((Number(o.gram_weight) / Number(o.amount)) * 10) / 10);
const cups = new Map(); // per food the best cup portion: SR Legacy writes the unit into "modifier" ("cup", "cup slices", "cup, mashed"); a plain "cup" wins
const cupRank = (o) => (o.modifier === 'cup' ? 0 : /mashed|pureed/.test(o.modifier) ? 2000 : 1000) + Number(o.seq_num);
for (const o of await rows('food_portion.csv', (o) => need.has(o.fdc_id) && (o.measure_unit_id === '1000' || /^cup\b/.test(o.modifier)) && Number(o.amount) > 0 && Number(o.gram_weight) > 0)) {
  if (!cups.has(o.fdc_id) || cupRank(o) < cupRank(cups.get(o.fdc_id))) cups.set(o.fdc_id, o);
}

const db = new DatabaseSync(join(ROOT, 'data/trackme.db'));
db.exec('PRAGMA foreign_keys = OFF');
const US_CUP_ML = 236.588;
const skipped = [], added = [];
db.exec('BEGIN IMMEDIATE');
try {
  const ids = db.prepare("SELECT id FROM foods WHERE source='cooked'").all().map((r) => r.id);
  for (const id of ids) { db.prepare('DELETE FROM portions WHERE food_id=?').run(id); db.prepare('DELETE FROM measures WHERE food_id=?').run(id); }
  db.prepare("DELETE FROM foods WHERE source='cooked'").run();
  db.prepare("DELETE FROM aliases WHERE src='v1.1.4-cooked'").run();
  let ord = db.prepare('SELECT max(ord) m FROM foods').get().m + 1, aord = db.prepare("SELECT coalesce(max(ord),0) m FROM aliases WHERE kind='name'").get().m + 1;
  const insF = db.prepare("INSERT INTO foods (id, ord, name, grp, source, base_unit, kcal_1, protein_1, carbs_1, fat_1, fibre_1, density, density_src, estimate, origin, basis, popular, superseded) VALUES (?,?,?,'Cooked vegetables','cooked','g',?,?,?,?,?,?,?,?,?,?,0,0)");
  const insP = db.prepare("INSERT INTO portions (food_id, ord, label, qual, kind, grams, size, ml, source, note) VALUES (?,1,'1 katori','cooked','volume',NULL,'katori',NULL,?,?)");
  const insPc = db.prepare("INSERT INTO portions (food_id, ord, label, qual, kind, grams, size, ml, source, note) VALUES (?,0,?,'','piece',?,NULL,NULL,'usda',?)");
  const insA = db.prepare("INSERT INTO aliases (kind, ord, word, extra, src) VALUES ('name',?,?,?,'v1.1.4-cooked')");
  const ref = {}; // class reference density, filled from the sourced rows
  const addAlias = (name, words) => { if (words) insA.run(aord++, name.toLowerCase(), words); };
  for (const [fdc, slug, name, alias, want, piece] of USDA) {
    const k = String(fdc), id = 'u_' + slug + '_boiled', d = foods.get(k), n = nut.get(k);
    if (d !== want) { skipped.push(`${id}: fdcId ${fdc} description is "${d}", expected "${want}"`); continue; }
    if (!n || ['kcal', 'protein', 'fat', 'carbsDiff', 'fibre'].some((c) => !(n[c] >= 0))) { skipped.push(`${id}: a nutrient is missing ${JSON.stringify(n)}`); continue; }
    const carbs = Math.max(0, Math.round((n.carbsDiff - n.fibre) * 100) / 100);
    const cup = cups.get(k), gw = cup ? Number(cup.gram_weight) / Number(cup.amount) : 0;
    let dens = gw / US_CUP_ML, src = 'sourced', psrc = 'usda', note = cup ? `USDA FDC portion "${cup.amount} ${cup.modifier || 'cup'}" = ${cup.gram_weight} g, i.e. ${+gw.toFixed(1)} g per cup, / ${US_CUP_ML} ml (US cup) = ${dens.toFixed(3)} g/ml; 1 katori = 150 ml of it.` : '';
    if (!(dens > 0.05 && dens <= 1.5)) { dens = 0.667; src = 'estimate'; psrc = 'estimate'; note = 'No usable USDA cup weight: 0.667 g/ml (default for chopped vegetables) is an estimate.'; }
    const basis = `USDA FoodData Central SR Legacy fdcId ${fdc}, ${d}; per 100 g; carbs = carbohydrate by difference minus fibre (IFCT carbs exclude fibre).`;
    insF.run(id, ord++, name, n.kcal / 100, n.protein / 100, carbs / 100, n.fat / 100, n.fibre / 100, dens, src, 0, 'USDA FDC SR Legacy', basis);
    insP.run(id, psrc, note); addAlias(name, alias); added.push(id);
    if (piece) { // a typed count ("2 boiled potatoes") needs a piece, not a katori
      const pg = pieces.get(k + '|' + piece[1]);
      if (!(pg > 0)) throw new Error(`${id}: USDA portion "${piece[1]}" not found`);
      insPc.run(id, `1 ${piece[0]} (${pg} g)`, pg, `USDA FDC portion "${piece[1]}" of fdcId ${fdc}, per piece.`);
    }
    ref[id] = { n, dens };
  }
  // derived estimates
  const ratio = {};
  for (const [cls, c] of Object.entries(CLASSES)) {
    const rs = c.pairs.map(([r, k]) => nut.get(String(k))?.kcal / nut.get(String(r))?.kcal).filter((x) => x > 0);
    if (!rs.length) throw new Error('no pairs for class ' + cls);
    ratio[cls] = { k: rs.reduce((a, b) => a + b, 0) / rs.length, n: rs.length };
  }
  for (const [slug, name, rawId, cls, alias] of DERIVED) {
    const raw = db.prepare('SELECT * FROM foods WHERE id=?').get(rawId);
    if (!raw) { skipped.push(`u_${slug}_boiled_est: raw food ${rawId} not found`); continue; }
    const like = ref[CLASSES[cls].like];
    if (!like) { skipped.push(`u_${slug}: class reference ${CLASSES[cls].like} missing`); continue; }
    const { k, n } = ratio[cls], id = 'u_' + slug + '_boiled_est';
    const basis = `ESTIMATE, not a measured or sourced value: IFCT raw value of "${raw.name}" (${rawId}) x ${k.toFixed(3)}, the mean cooked/raw energy ratio of ${n} USDA SR Legacy boiled-vs-raw pairs of the "${CLASSES[cls].label}" class (water gained or lost in boiling). Per 100 g.`;
    const r2 = (x) => Math.round(x * k * 100 * 10) / 10 / 100; // per 100 g with 1 decimal (kcal) or 2 decimals like IFCT; per 1 g
    const r3 = (x) => Math.round(x * k * 100 * 100) / 100 / 100;
    insF.run(id, ord++, name, r2(raw.kcal_1), r3(raw.protein_1), r3(raw.carbs_1), r3(raw.fat_1), r3(raw.fibre_1), like.dens, 'estimate', 1, 'Derived estimate from IFCT raw', basis);
    insP.run(id, 'estimate', `Density of the class reference (${CLASSES[cls].like}) used as an estimate; 1 katori = 150 ml of it.`); addAlias(name, alias); added.push(id);
  }
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); console.error('FAILED, rolled back:', e.message); process.exit(1); }
console.log(`${added.length} cooked rows (${added.filter((i) => !i.endsWith('_est')).length} USDA sourced, ${added.filter((i) => i.endsWith('_est')).length} derived estimates); skipped ${skipped.length}`);
for (const s of skipped) console.log('  SKIPPED', s);
db.close();
