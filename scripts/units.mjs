// v1.1.4 migration (docs/PLAN_UNITS.md): per-unit nutrition (kcal_1 .. per 1 g, or per 1 ml for liquids), household_sizes,
// portions/measures with kind volume|piece|weight (a volume row's grams come from foods.density at build time).
// Usage: node --no-warnings scripts/units.mjs      Re-runnable (idempotent): Part A runs once, B and C every time.
// Pipeline order that is always safe: seed_portions -> data_v113 -> units -> import_cooked -> db_check -> build.
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DB = join(ROOT, 'data/trackme.db');
if (!existsSync(join(ROOT, 'data/trackme.pre-units.db'))) copyFileSync(DB, join(ROOT, 'data/trackme.pre-units.db')); // only copy of the data: back up before the first write
const db = new DatabaseSync(DB);
db.exec('PRAGMA foreign_keys = OFF');
const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
const LIQUIDS = ['d_cow_milk_whole', 'd_buffalo_milk_whole', 'd_cow_milk_toned_3_fat', 'd_cow_milk_double_toned_1_5_fat', 'd_chai_milk_tea_with_1_tsp_sugar',
  'd_tea_black_no_milk_no_sugar', 'd_coffee_black_no_sugar', 'd_chaas_buttermilk_spiced', 'd_lassi_sweet', 'i_coconut_water', 'i_sugarcane_juice'];
// user-defined sizes (decision of 2026-11-05: medium katori stays 150 ml, cup 150 ml, glass 250 ml)
const SIZES = [['tsp', 'tsp', 5, 'level teaspoon'], ['tbsp', 'tbsp', 15, 'level tablespoon'], ['cup', 'cup', 150, 'one cup of tea or any food; user definition 150 ml'],
  ['katori_s', 'small katori', 100, 'small katori 100 ml (home bowls vary)'], ['katori', 'katori', 150, 'medium katori 150 ml (the app default since v1.0)'],
  ['katori_l', 'large katori', 200, 'large katori 200 ml'], ['bowl', 'bowl', 275, 'bowl 275 ml (250 to 300)'], ['glass', 'glass', 250, 'glass 250 ml']];
const report = [];
const round1 = (x) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);

db.exec('BEGIN IMMEDIATE');
try {
  // ---------- Part A: foods per 1 base unit ----------
  if (!cols('foods').includes('kcal_1')) {
    db.exec(`CREATE TABLE foods_new (
      id TEXT PRIMARY KEY, ord INTEGER NOT NULL, name TEXT NOT NULL, grp TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('ifct','dish','fat','cooked')),
      base_unit TEXT NOT NULL DEFAULT 'g' CHECK (base_unit IN ('g','ml')),
      kcal_1 REAL NOT NULL, protein_1 REAL NOT NULL, carbs_1 REAL NOT NULL, fat_1 REAL NOT NULL, fibre_1 REAL NOT NULL,
      density REAL CHECK (density IS NULL OR (density > 0.05 AND density <= 1.5)),
      density_src TEXT CHECK (density_src IS NULL OR density_src IN ('sourced','derived','class','estimate')),
      estimate INTEGER NOT NULL CHECK (estimate IN (0,1)), origin TEXT NOT NULL, basis TEXT NOT NULL,
      popular INTEGER NOT NULL DEFAULT 0, superseded INTEGER NOT NULL DEFAULT 0,
      CHECK (base_unit = 'g' OR density IS NOT NULL), CHECK ((density IS NULL) = (density_src IS NULL))
    )`);
    const old = db.prepare('SELECT * FROM foods ORDER BY ord').all();
    const ins = db.prepare('INSERT INTO foods_new VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const glass = db.prepare("SELECT grams FROM measures WHERE food_id=? AND label LIKE '1 glass%' UNION ALL SELECT grams FROM portions WHERE food_id=? AND label LIKE '1 glass%'");
    for (const f of old) {
      const liq = LIQUIDS.includes(f.id);
      let d = null;
      if (liq) { const g = glass.get(f.id, f.id); d = g ? g.grams / 250 : 1; if (!g) d = 1; }
      const v = (x) => (liq ? (x / 100) * d : x / 100);
      const row = [f.id, f.ord, f.name, f.grp, f.source, liq ? 'ml' : 'g', v(f.kcal), v(f.protein), v(f.carbs), v(f.fat), v(f.fibre), liq ? d : null, liq ? 'derived' : null,
        f.estimate, f.origin, liq ? f.basis + ' Stored per 1 ml (density ' + d + ' g/ml, derived from the glass/cup weight).' : f.basis, f.popular, f.superseded];
      ins.run(...row);
      // self-check: the build's round trip must give back the old per-100 g value exactly
      f.liq = liq; f.d = d;
      for (const [c, x] of [['kcal', row[6]], ['protein', row[7]], ['carbs', row[8]], ['fat', row[9]], ['fibre', row[10]]]) {
        const back = Number(((x * 100) / (liq ? d : 1)).toPrecision(12));
        if (back !== f[c]) throw new Error(`round trip ${f.id} ${c}: ${back} != ${f[c]}`);
      }
    }
    db.exec('DROP TABLE foods; ALTER TABLE foods_new RENAME TO foods');
    report.push(`Part A: ${old.length} foods converted to per-1 storage, ${LIQUIDS.length} liquids per ml`);
  }
  // ---------- Part B: household sizes ----------
  db.exec('CREATE TABLE IF NOT EXISTS household_sizes (key TEXT PRIMARY KEY, word TEXT NOT NULL, ml REAL NOT NULL CHECK (ml > 0), note TEXT NOT NULL)');
  const sz = db.prepare('INSERT OR REPLACE INTO household_sizes VALUES (?,?,?,?)');
  for (const s of SIZES) sz.run(...s);

  // ---------- Part C: portions and measures into one shape (kind weight | piece | volume) ----------
  db.exec('DROP VIEW IF EXISTS food_pieces'); // the view points at the tables rebuilt below
  const SHAPE = `(food_id TEXT NOT NULL REFERENCES foods(id), ord INTEGER NOT NULL, label TEXT NOT NULL, qual TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL CHECK (kind IN ('weight','piece','volume')), grams REAL, size TEXT REFERENCES household_sizes(key), ml REAL,
    source TEXT NOT NULL SRC, note TEXT NOT NULL, PRIMARY KEY (food_id, ord),
    CHECK ((kind IN ('weight','piece') AND grams > 0 AND size IS NULL AND ml IS NULL) OR (kind = 'volume' AND grams IS NULL AND ((size IS NOT NULL) <> (ml IS NOT NULL)))))`;
  const sizeMl = Object.fromEntries(SIZES.map((x) => [x[0], x[2]]));
  const foods = new Map(db.prepare('SELECT id, density, density_src FROM foods').all().map((f) => [f.id, { ...f }]));
  const tabs = {};
  for (const t of ['measures', 'portions']) {
    const isNew = cols(t).includes('kind');
    tabs[t] = db.prepare(`SELECT * FROM ${t} ORDER BY food_id, ord`).all().map((r) => ({ t, ...r, legacy: isNew ? r.kind !== 'volume' : true,
      note: r.note || (r.source === 'group-default' ? 'Group default portion (one katori of chopped raw produce). Estimate.' : 'Household measure of the dish table. Estimate.'),
      qual: r.qual || '', kind: isNew ? r.kind : null, grams: isNew ? r.grams : r.grams }));
  }
  // classify a legacy/weight row by its label (same rule as app.js unitKind)
  const RE = /^1 (katori|cup|glass|cutting glass|tbsp|tsp)( raw| cooked)? ?(?:\((~?)([\d.]+) (g|ml)(?:, ([^)]*))?\))?$/;
  const clsRow = (r) => {
    const m = RE.exec(r.label);
    if (!m) { r.cls = /plate|slice|serving|handful|bowl|crumbled|grated/.test(r.label) ? 'weight' : 'piece'; return; }
    const [, w, extra = '', , n, unit, qual = ''] = m;
    if ((w === 'tbsp' || w === 'tsp') && extra) { r.cls = 'weight'; return; }
    r.cls = 'volume'; r.word = w; r.extra = extra; r.vqual = qual; r.src2 = r.source;
    if (w === 'katori') { r.ml0 = 150; r.pri = r.source === 'group-default' ? 5 : 0; r.size = 'katori'; }
    else if (w === 'cup') { r.ml0 = unit === 'ml' ? Number(n) : null; r.pri = unit === 'ml' ? 1 : 9; r.size = 'cup'; }
    else if (w === 'glass') { r.ml0 = Number(n); r.pri = 1; if (r.ml0 === 250) r.size = 'glass'; else r.ownMl = r.ml0; }
    else if (w === 'cutting glass') { r.ml0 = Number(n); r.pri = 1; r.ownMl = r.ml0; }
    else { r.ml0 = w === 'tbsp' ? 15 : 5; r.pri = w === 'tbsp' ? 3 : 4; r.size = w; }
  };
  const all = [...tabs.measures, ...tabs.portions];
  for (const r of all) if (r.legacy) clsRow(r);
  // densities, only where the food has none yet (from the legacy grams of its own rows)
  const best = new Map();
  for (const r of all) if (r.legacy && r.cls === 'volume' && r.pri < 9) { const b = best.get(r.food_id); if (!b || r.pri < b.pri) best.set(r.food_id, r); }
  const setD = db.prepare('UPDATE foods SET density = ?, density_src = ? WHERE id = ?');
  for (const [id, r] of best) { const f = foods.get(id); if (f.density == null) { f.density = r.grams / r.ml0; f.density_src = r.pri === 5 ? 'class' : 'derived'; setD.run(f.density, f.density_src, id); } }
  const log = [];
  for (const r of all) {
    if (!r.legacy) continue;
    const f = foods.get(r.food_id);
    if (r.cls === 'volume') {
      const dRow = r.ml0 ? r.grams / r.ml0 : null;
      const conflict = f.density != null && dRow != null && Math.abs(dRow / f.density - 1) > 0.05;
      if (f.density == null) { r.cls = 'weight'; log.push(`NO DENSITY ${r.food_id} ${r.label}: kept as weight`); }
      else if (conflict && (r.pri >= 3)) { r.cls = 'weight'; log.push(`CONFLICT ${r.food_id} "${r.label}" ${r.grams} g implies ${dRow.toFixed(3)} g/ml vs ${f.density.toFixed(3)}: kept as weight row`); }
    }
    if (r.cls === 'volume') {
      const ml = r.ownMl ?? sizeMl[r.size];
      const g = round1(ml * f.density);
      r.newG = g;
      if (Math.abs(g - r.grams) > 0.05 && Math.abs(g - r.grams) <= 0.05 * r.grams) { r.cls = 'weight'; r.kind = 'weight'; log.push(`KEPT ${r.food_id} "${r.label}": old ${r.grams} g stays (new size x density would be ${g} g, within 5%)`); continue; }
      if (Math.abs(g - r.grams) > 0.05) log.push(`CHANGED ${r.food_id} "${r.label}${r.extra && !r.label.includes(r.extra) ? r.extra : ''}": ${r.grams} g -> ${g} g (${ml} ml x ${f.density.toFixed(3)} ${f.density_src})`);
      r.label = `1 ${r.word}${r.extra}`; r.qual = r.vqual; r.kind = 'volume';
    } else { r.kind = r.cls; }
  }
  for (const [t, rows] of Object.entries(tabs)) {
    db.exec(`DROP TABLE IF EXISTS ${t}_new`);
    db.exec(`CREATE TABLE ${t}_new ${SHAPE.replace('SRC', t === 'portions' ? "CHECK (source IN ('estimate','ifct','user-report','usda'))" : '')}`);
    const ins = db.prepare(`INSERT INTO ${t}_new (food_id, ord, label, qual, kind, grams, size, ml, source, note) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for (const r of rows) {
      if (r.kind === 'volume' && r.legacy) ins.run(r.food_id, r.ord, r.label, r.qual, 'volume', null, r.ownMl ? null : r.size, r.ownMl ?? null, r.source, r.note);
      else ins.run(r.food_id, r.ord, r.label, r.qual, r.kind, r.kind === 'volume' ? null : r.grams, r.kind === 'volume' ? r.size : null, r.kind === 'volume' ? r.ml : null, r.source, r.note);
    }
    db.exec(`DROP TABLE ${t}; ALTER TABLE ${t}_new RENAME TO ${t}`);
  }
  const noD = db.prepare("SELECT DISTINCT food_id FROM (SELECT food_id FROM measures WHERE kind='volume' UNION SELECT food_id FROM portions WHERE kind='volume') WHERE food_id NOT IN (SELECT id FROM foods WHERE density IS NOT NULL)").all();
  if (noD.length) throw new Error('volume rows without density: ' + noD.map((x) => x.food_id));
  report.push(`Part C: ${all.length} rows (${all.filter((r) => r.kind === 'volume').length} volume, ${all.filter((r) => r.kind === 'piece').length} piece, ${all.filter((r) => r.kind === 'weight').length} weight)`, ...log);
  // per-piece macros come from the per-gram values, so they cannot drift from the piece weight (Q10: a view, not typed columns)
  db.exec(`DROP VIEW IF EXISTS food_pieces; CREATE VIEW food_pieces AS
    SELECT f.id, p.label, p.grams AS piece_g, f.kcal_1*p.grams AS kcal_pc, f.protein_1*p.grams AS protein_pc, f.carbs_1*p.grams AS carbs_pc,
           f.fat_1*p.grams AS fat_pc, f.fibre_1*p.grams AS fibre_pc FROM foods f JOIN portions p ON p.food_id = f.id WHERE p.kind = 'piece' AND f.base_unit = 'g'
    UNION ALL
    SELECT f.id, p.label, p.grams, f.kcal_1*p.grams, f.protein_1*p.grams, f.carbs_1*p.grams, f.fat_1*p.grams, f.fibre_1*p.grams
      FROM foods f JOIN measures p ON p.food_id = f.id WHERE p.kind = 'piece' AND f.base_unit = 'g'`);
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); console.error('FAILED, rolled back:', e.message); process.exit(1); }
console.log(report.join('\n') || 'nothing to do');
db.exec('VACUUM');
db.close();
