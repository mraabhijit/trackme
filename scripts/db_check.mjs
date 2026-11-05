// Asserts data/trackme.db still holds what the v1.1.1 JSON files held, and that the data is sane. Usage: node scripts/db_check.mjs
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const db = new DatabaseSync(join(dirname(dirname(fileURLToPath(import.meta.url))), 'data/trackme.db'), { readOnly: true });
const one = (sql) => Object.values(db.prepare(sql).get())[0];
let fails = 0, passes = 0;
const check = (name, ok, extra = '') => { if (ok) passes++; else { fails++; console.log('FAIL', name, extra); } };
// counts of the old JSON files (ifct_foods 524, household_units 74, fats_oils 6, aliases_hinglish 51 + 34, met 13)
check('524 IFCT rows', one("SELECT count(*) FROM foods WHERE source='ifct'") === 524);
check('74 dish rows (72 built + 2 superseded)', one("SELECT count(*) FROM foods WHERE source='dish' AND id NOT LIKE 'l\\_%' ESCAPE '\\'") === 74 && one("SELECT count(*) FROM foods WHERE source='dish' AND superseded=1") === 2);
check('6 fat rows', one("SELECT count(*) FROM foods WHERE source='fat'") === 6);
check('2 superseded IFCT milk rows', one("SELECT count(*) FROM foods WHERE source='ifct' AND superseded=1") === 2);
const nLiq = one("SELECT count(*) FROM foods WHERE id LIKE 'l\\_%' ESCAPE '\\'"); // v1.1.5 group "Beverages and liquids"
check('600 + cooked + liquid foods are built', one('SELECT count(*) FROM foods WHERE superseded=0') === 600 + one("SELECT count(*) FROM foods WHERE source='cooked'") + nLiq);
check('51 hinglish dish aliases', one("SELECT count(*) FROM aliases WHERE kind='dish' AND src='hinglish'") === 51);
check('34 hinglish raw aliases', one("SELECT count(*) FROM aliases WHERE kind='raw' AND src='hinglish'") === 34);
check('13 MET activities, 4 meta keys', one('SELECT count(*) FROM met_activities') === 13 && one('SELECT count(*) FROM met_meta') === 4);
check('6 count units', one('SELECT count(*) FROM count_units') === 6);
check('102 household measures of dishes and fats + 5 groups of raw defaults', one("SELECT count(*) FROM measures WHERE source='household'") === 102);
// data quality: nutrition is stored per 1 g (liquids: per 1 ml) in kcal_1 .. fibre_1
const N = ['kcal_1', 'protein_1', 'carbs_1', 'fat_1', 'fibre_1'];
for (const c of N) check(`no null ${c}`, one(`SELECT count(*) FROM foods WHERE ${c} IS NULL OR typeof(${c}) NOT IN ('real','integer')`) === 0);
check('range per g: kcal_1 0..9, macros 0..1', one("SELECT count(*) FROM foods WHERE base_unit='g' AND (kcal_1<0 OR kcal_1>9 OR protein_1<0 OR protein_1>1 OR carbs_1<0 OR carbs_1>1 OR fat_1<0 OR fat_1>1 OR fibre_1<0 OR fibre_1>1)") === 0);
check('range per ml: kcal_1 0..9.5, macros 0..1.5 (honey: 1.17 g carbs per ml)', one("SELECT count(*) FROM foods WHERE base_unit='ml' AND (kcal_1<0 OR kcal_1>9.5 OR protein_1<0 OR protein_1>1.5 OR carbs_1<0 OR carbs_1>1.5 OR fat_1<0 OR fat_1>1.5 OR fibre_1<0 OR fibre_1>1.5)") === 0);
const LIQ = ['d_cow_milk_whole', 'd_buffalo_milk_whole', 'd_cow_milk_toned_3_fat', 'd_cow_milk_double_toned_1_5_fat', 'd_chai_milk_tea_with_1_tsp_sugar', 'd_tea_black_no_milk_no_sugar', 'd_coffee_black_no_sugar', 'd_chaas_buttermilk_spiced', 'd_lassi_sweet', 'i_coconut_water', 'i_sugarcane_juice'];
check('the ml list is the 11 liquids + the l_ group, and each has a density in (0.05, 1.5]', JSON.stringify(db.prepare("SELECT id FROM foods WHERE base_unit='ml' ORDER BY id").all().map((r) => r.id)) === JSON.stringify([...LIQ, ...db.prepare("SELECT id FROM foods WHERE id LIKE 'l\\_%' ESCAPE '\\'").all().map((r) => r.id)].sort()) && one("SELECT count(*) FROM foods WHERE base_unit='ml' AND (density IS NULL OR density<=0.05 OR density>1.5)") === 0);
const F = (id) => db.prepare('SELECT * FROM foods WHERE id=?').get(id);
check('spot: Bajra kcal_1 = 3.48', Math.abs(F('i_bajra').kcal_1 - 3.48) < 1e-12, F('i_bajra')?.kcal_1);
check('spot: toned milk kcal_1*100/density = 59.6', Math.abs((F('d_cow_milk_toned_3_fat').kcal_1 * 100) / F('d_cow_milk_toned_3_fat').density - 59.6) < 1e-9);
check('spot: plain rice cooked density = 130/150', Math.abs(F('d_plain_rice_cooked_white').density - 130 / 150) < 1e-12);
check('spot: dal toor density = 1', Math.abs(F('d_dal_toor_cooked_light_tadka').density - 1) < 1e-12);
check('every food has a basis note', one("SELECT count(*) FROM foods WHERE basis IS NULL OR basis=''") === 0);
check('ids are unique and ord is unique', one('SELECT count(DISTINCT id) FROM foods') === 604 + one("SELECT count(*) FROM foods WHERE source='cooked'") + nLiq && one('SELECT count(DISTINCT ord) FROM foods') === one('SELECT count(*) FROM foods'));
check('per-100 round trip has at most 4 decimals', db.prepare("SELECT * FROM foods WHERE id NOT LIKE 'l\\_%' ESCAPE '\\'").all().every((f) => N.every((c) => { const v = Number(((f[c] * 100) / (f.base_unit === 'ml' ? f.density : 1)).toPrecision(12)); return Math.abs(v - Number(v.toFixed(4))) < 1e-12; })));
// v1.1.5 liquids ("Beverages and liquids", ids l_*): per 1 ml, with density, one default unit, sourced rows name the USDA fdcId, estimates say so
const lq = db.prepare("SELECT * FROM foods WHERE id LIKE 'l\\_%' ESCAPE '\\'").all();
check('liquids: at least 25 rows, group "Beverages and liquids", base_unit ml, density in (0.5, 1.5], no NULLs', lq.length >= 25 && lq.every((f) => f.grp === 'Beverages and liquids' && f.base_unit === 'ml' && f.density > 0.5 && f.density <= 1.5 && N.every((c) => typeof f[c] === 'number')));
check('liquids: water is exactly 0 kcal / 0 everything per ml', ['l_water', 'l_soda_water'].every((id) => N.every((c) => F(id)[c] === 0)));
check('liquids: sourced rows (estimate=0) name a USDA fdcId; estimate rows say estimate', lq.every((f) => f.estimate === 0 ? /fdcId \d+/.test(f.basis) && f.origin.startsWith('USDA') : /[Ee]stimate/.test(f.basis) && /^estimate/.test(f.origin)));
check('liquids: every row has a portion in ml terms (size or own ml) and no weight rows', lq.every((f) => db.prepare("SELECT count(*) c, sum(kind='volume') v FROM portions WHERE food_id=?").get(f.id).c > 0 && db.prepare("SELECT count(*) c FROM portions WHERE food_id=? AND kind<>'volume'").get(f.id).c === 0));
check('liquids: honey has a tsp and a tbsp, water has a glass, a cup and a 500 ml bottle', ['tsp', 'tbsp'].every((z) => one(`SELECT count(*) FROM portions WHERE food_id='l_honey' AND size='${z}'`) === 1) && one("SELECT count(*) FROM portions WHERE food_id='l_water' AND ((size='glass') OR (size='cup') OR (ml=500))") === 3);
check('liquids: spot per 100 ml: orange juice 45 kcal x 1.048 (USDA 169098), beer 43 x 1.004, honey 304 x 1.433', Math.abs(F('l_juice_orange').kcal_1 * 100 - 45 * 248 / 236.588) < 1e-9 && Math.abs(F('l_beer').kcal_1 * 100 - 43 * 29.7 / 29.5735) < 1e-9 && Math.abs(F('l_honey').kcal_1 * 100 - 304 * 339 / 236.588) < 1e-9);
check('liquid cooking oils: density 0.92, tbsp kept as the 13 g weight', ['d_cooking_oil_refined_sunflower_groundnut_soybean', 'd_mustard_oil', 'd_coconut_oil'].every((id) => F(id).density === 0.92 && one(`SELECT count(*) FROM measures WHERE food_id='${id}' AND label='1 tbsp (13 g)' AND kind='weight' AND grams=13`) === 1));
check('sweet potato boiled density = 200/236.588 (USDA cup of pieces)', Math.abs(F('u_sweet_potato_boiled').density - 200 / 236.588) < 1e-9);
// household sizes
const HS = { tsp: 5, tbsp: 15, cup: 150, katori_s: 100, katori: 150, katori_l: 200, bowl: 275, glass: 250 };
check('household_sizes: exactly the 8 keys and values', JSON.stringify(Object.fromEntries(db.prepare('SELECT key, ml FROM household_sizes ORDER BY key').all().map((r) => [r.key, r.ml]))) === JSON.stringify(Object.fromEntries(Object.entries(HS).sort())));
// measures and portions: kind matches the columns, grams are computed from size x density
for (const [t, cap] of [['measures', 5000], ['portions', 1000]]) {
  check(`${t}: known food`, one(`SELECT count(*) FROM ${t} WHERE food_id NOT IN (SELECT id FROM foods)`) === 0);
  check(`${t}: kind matches the columns`, one(`SELECT count(*) FROM ${t} WHERE NOT ((kind IN ('weight','piece') AND grams>0 AND size IS NULL AND ml IS NULL) OR (kind='volume' AND grams IS NULL AND ((size IS NOT NULL) <> (ml IS NOT NULL))))`) === 0);
  check(`${t}: size exists in household_sizes`, one(`SELECT count(*) FROM ${t} WHERE size IS NOT NULL AND size NOT IN (SELECT key FROM household_sizes)`) === 0);
  check(`${t}: every food with a volume row has a density`, one(`SELECT count(*) FROM ${t} WHERE kind='volume' AND food_id IN (SELECT id FROM foods WHERE density IS NULL)`) === 0);
  const g = db.prepare(`SELECT m.kind, m.grams, m.size, m.ml, f.density, (SELECT ml FROM household_sizes WHERE key=m.size) sml FROM ${t} m JOIN foods f ON f.id=m.food_id`).all().map((r) => r.kind === 'volume' ? (r.sml ?? r.ml) * r.density : r.grams);
  check(`${t}: computed grams in (0, ${cap}]`, g.every((x) => x > 0 && x <= cap));
  check(`${t}: weight and piece labels start with a number and carry their weight; volume labels have no amount`, db.prepare(`SELECT label, kind FROM ${t}`).all().every((r) => r.kind === 'volume' ? !/\(\s*~?\d|\d\s?(g|ml)\b/.test(r.label) : /^\d/.test(r.label) && (/\d\s?(g|ml)\b/.test(r.label) || r.kind === 'piece')));
}
check('measures: 102 household + 202 group-default rows', one("SELECT count(*) FROM measures WHERE source='household'") === 102 && one("SELECT count(*) FROM measures WHERE source='group-default'") === 202);
check('portions: >=140 rows', one('SELECT count(*) FROM portions') >= 140, one('SELECT count(*) FROM portions'));
check('portions: known built food', one('SELECT count(*) FROM portions WHERE food_id NOT IN (SELECT id FROM foods WHERE superseded=0)') === 0);
check('portions: every row is marked estimate/ifct/user-report/usda and has a note', one("SELECT count(*) FROM portions WHERE source NOT IN ('estimate','ifct','user-report','usda') OR note=''") === 0);
check('portions: no duplicate label per food', one('SELECT count(*) FROM (SELECT food_id, lower(label) l FROM portions GROUP BY 1,2 HAVING count(*)>1)') === 0);
// per-piece view: macros follow the per-gram values
check('food_pieces: one row per piece row, kcal_pc = kcal_1 x piece_g', (() => { const v = db.prepare('SELECT v.*, f.kcal_1 FROM food_pieces v JOIN foods f ON f.id=v.id').all(); return v.length >= one("SELECT count(*) FROM portions WHERE kind='piece'") && v.every((r) => Math.abs(r.kcal_pc - r.kcal_1 * r.piece_g) < 1e-9); })());
// cooked vegetables (USDA FoodData Central SR Legacy rows are sourced; derived rows are estimates)
const ck = db.prepare("SELECT * FROM foods WHERE source='cooked'").all();
check('cooked rows: USDA ones are estimate=0 and name the fdcId; derived ones are estimate=1 and say "estimate"', ck.every((f) => (f.origin.startsWith('USDA') ? f.estimate === 0 && /fdcId \d+/.test(f.basis) && /without salt|boiled/.test(f.basis) : f.estimate === 1 && /estimate/i.test(f.basis))));
check('cooked rows: each has a katori volume row and a density', ck.every((f) => f.density > 0 && one(`SELECT count(*) FROM portions WHERE food_id='${f.id}' AND kind='volume' AND size='katori'`) === 1));
if (ck.length) { // oracle: per 100 g from the USDA SR Legacy files, carbs = by difference minus fibre (IFCT carbs excludes fibre)
  const O = { u_spinach_boiled: [23, 2.97, 3.75, 0.26, 2.4], u_cauliflower_boiled: [23, 1.84, 4.11, 0.45, 2.3], u_okra_boiled: [22, 1.87, 4.51, 0.21, 2.5], u_eggplant_boiled: [35, 0.83, 8.73, 0.23, 2.5] };
  for (const [id, o] of Object.entries(O)) { const f = F(id); const p = N.map((c) => f[c] * 100); check(`cooked oracle ${id}`, f && Math.abs(p[0] - o[0]) < 1e-6 && Math.abs(p[1] - o[1]) < 1e-6 && Math.abs(p[2] - (o[2] - o[4])) < 1e-6 && Math.abs(p[3] - o[3]) < 1e-6 && Math.abs(p[4] - o[4]) < 1e-6, JSON.stringify(p)); }
}
// the per-piece weights the app uses for typed counts must agree with the picker portions
for (const c of db.prepare('SELECT * FROM count_units ORDER BY ord').all()) {
  const re = new RegExp(c.pattern);
  const foods = db.prepare("SELECT id, lower(name) n FROM foods WHERE superseded=0").all().filter((f) => re.test(f.n));
  check(`count unit ${c.noun}: matches foods`, foods.length > 0);
  for (const f of foods) {
    const p = db.prepare("SELECT label, grams FROM portions WHERE food_id=? AND kind='piece' AND label LIKE '1 ' || ? || ' (%'").get(f.id, c.noun);
    check(`count unit ${c.noun}: ${f.id} has a matching 1-piece portion`, p && p.grams === c.grams, JSON.stringify(p));
    check(`count unit ${c.noun}: ${f.id} has no other piece-like portion`, db.prepare('SELECT label FROM portions WHERE food_id=?').all(f.id).every((r) => r.label === p?.label || /tbsp|tsp|katori|glass|cup|plate|handful/.test(r.label)));
  }
}
console.log(`db_check: ${passes} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
