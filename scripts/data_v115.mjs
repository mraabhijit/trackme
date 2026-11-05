// v1.1.5 data on data/trackme.db (idempotent): group "Beverages and liquids" (base_unit ml), oil density, sweet potato density, water/liquid aliases.
// Usage: node --no-warnings scripts/data_v115.mjs [USDA SR Legacy CSV folder, optional: only checks the numbers below against the files]
// Pipeline: seed_portions -> data_v113 -> units -> import_cooked <csv dir> -> data_v115 -> db_check -> build. Run it AFTER units and import_cooked.
// Sourced = USDA FoodData Central SR Legacy (public domain, CC0), per 100 g as published; carbs = by difference minus fibre (IFCT carbs exclude fibre).
// Density = published gram weight of a fl oz / cup / litre / tbsp divided by its volume (US cup 236.588 ml, fl oz 29.5735 ml). Stored per 1 ml = per 100 g / 100 x density.
// Estimates: packaged products (cola, juices, soups) use the USDA record as the basis; home drinks and dishes are recipes built from rows of this table (shown in the basis).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GRP = 'Beverages and liquids';
// fdcId: [per 100 g: kcal, protein, carbs-by-difference, fat, fibre, density g/ml, density basis]
const U = {
  173647: [0, 0, 0, 0, 0, 1, '1000 g per litre', 'Beverages, water, tap, drinking'],
  169640: [304, 0.3, 82.4, 0, 0.2, 339 / 236.588, 'cup 339 g', 'Honey'],
  169098: [45, 0.7, 10.4, 0.2, 0.2, 248 / 236.588, 'cup 248 g', 'Orange juice, raw'],
  173933: [46, 0.1, 11.3, 0.13, 0.2, 248 / 236.588, 'cup 248 g', 'Apple juice, canned or bottled, unsweetened, without added ascorbic acid'],
  167785: [51, 0.11, 13.12, 0.06, 0.3, 251 / 236.588, 'cup 251 g', 'Mango nectar, canned'],
  173042: [60, 0.37, 14.77, 0.13, 0.2, 253 / 236.588, 'cup 253 g', 'Grape juice, canned or bottled, unsweetened, without added ascorbic acid'],
  169947: [53, 0.36, 12.87, 0.12, 0.2, 250 / 236.588, 'cup 250 g', 'Pineapple juice, canned or bottled, unsweetened, without added ascorbic acid'],
  168746: [43, 0.46, 3.55, 0, 0, 29.7 / 29.5735, 'fl oz 29.7 g', 'Alcoholic beverage, beer, regular, all'],
  174819: [250, 0, 0.1, 0, 0, 27.8 / 29.5735, 'fl oz 27.8 g', 'Alcoholic beverage, distilled, whiskey, 86 proof'],
  173190: [85, 0.07, 2.61, 0, 0, 29.4 / 29.5735, 'fl oz 29.4 g', 'Alcoholic beverage, wine, table, red'],
  171917: [1, 0.22, 0, 0, 0, 29.6 / 29.5735, 'fl oz 29.6 g', 'Beverages, tea, green, brewed, regular'],
  174842: [0, 0, 0, 0, 0, 29.6 / 29.5735, 'fl oz 29.6 g', 'Beverages, carbonated, club soda'],
  174852: [42, 0, 10.36, 0.25, 0, 30.7 / 29.5735, 'fl oz 30.7 g', 'Beverages, carbonated, cola, regular'],
  168063: [146, 3.2, 24.92, 3.69, 0.5, 253 / 236.588, 'cup 253 g', 'Restaurant, Latino, arroz con leche (rice pudding)'],
  171176: [32, 0.71, 7.45, 0.21, 0.5, 248 / 236.588, 'cup 248 g', 'Soup, tomato, canned, prepared with equal volume water, commercial'],
  171594: [33, 1.1, 6.06, 0.45, 1.1, 253 / 236.588, 'cup 253 g', 'Soup, vegetable soup, condensed, low sodium, prepared with equal volume water'],
  171546: [33, 1.97, 4.68, 0.73, 0.9, 255 / 236.588, 'cup 255 g', 'Soup, chicken and vegetable, canned, ready-to-serve'],
  170884: [112, 3.86, 17.75, 3.03, 0, 28.4 / 29.5735, 'fl oz 28.4 g', 'Milk shakes, thick vanilla'],
  173180: [352, 78.13, 6.25, 1.56, 3.1, 1, '(powder, not a liquid)', 'Beverages, Protein powder whey based'],
  168156: [25, 0.42, 8.42, 0.07, 0.4, 242 / 236.588, 'cup 242 g', 'Lime juice, raw'],
};
const dir = process.argv[2];
if (dir) { // check the numbers above against the CSV files (read as data only)
  const rd = (f) => readFileSync(join(dir, f), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.replace(/"/g, '').split(','));
  const nut = new Map(); for (const r of rd('food_nutrient.csv')) { if (U[r[1]]) { if (!nut.has(r[1])) nut.set(r[1], {}); nut.get(r[1])[r[2]] = +r[3]; } }
  let bad = 0;
  for (const [id, u] of Object.entries(U)) { const n = nut.get(id) || {}; const w = [n[1008] ?? 0, n[1003] ?? 0, n[1005] ?? 0, n[1004] ?? 0, n[1079] ?? 0]; if (w.some((x, i) => Math.abs(x - u[i]) > 1e-9)) { bad++; console.log('MISMATCH', id, w, u.slice(0, 5)); } }
  console.log(bad ? `${bad} mismatches` : `all ${Object.keys(U).length} USDA records equal the CSV`); process.exit(bad ? 1 : 0);
}

const db = new DatabaseSync(join(ROOT, 'data', 'trackme.db'));
if (!db.prepare("SELECT 1 FROM pragma_table_info('foods') WHERE name='kcal_1'").get()) { console.error('run units.mjs first'); process.exit(1); }
const FDC = 'USDA FoodData Central SR Legacy, public domain (CC0)';
const per = (id, ml) => { const u = U[id]; return { k: u[0] / 100, p: u[1] / 100, c: Math.max(0, u[2] - u[4]) / 100, f: u[3] / 100, fib: u[4] / 100 }; };   // per 1 g
const perMl = (id) => { const g = per(id), d = U[id][5]; return { k: g.k * d, p: g.p * d, c: g.c * d, f: g.f * d, fib: g.fib * d }; };
const row = (id) => { const f = db.prepare('SELECT * FROM foods WHERE id=?').get(id); if (!f) throw new Error('missing ' + id); return { k: f.kcal_1, p: f.protein_1, c: f.carbs_1, f: f.fat_1, fib: f.fibre_1 }; };
// a recipe: parts are [per-1 vector, amount in that vector's unit], summed for 100 ml of product
const mix = (parts) => parts.reduce((a, [v, n]) => ({ k: a.k + v.k * n / 100, p: a.p + v.p * n / 100, c: a.c + v.c * n / 100, f: a.f + v.f * n / 100, fib: a.fib + v.fib * n / 100 }), { k: 0, p: 0, c: 0, f: 0, fib: 0 });
const ZERO = { k: 0, p: 0, c: 0, f: 0, fib: 0 };
const avg = (ids) => { const m = ids.map(perMl); const s = (c) => m.reduce((a, x) => a + x[c], 0) / m.length; return { k: s('k'), p: s('p'), c: s('c'), f: s('f'), fib: s('fib') }; };
const usda = (n, d) => `${FDC}, fdcId ${n}, ${U[n][7]}; per 100 g, density ${d.toFixed(3)} g/ml (${U[n][6]}); carbs = by difference minus fibre.`;

// portion rows: [label, 'size key' | ml, note]; size keys come from household_sizes
const G = ['1 glass', 'glass', 'Standard glass, 250 ml (household_sizes).'];
const CUP = ['1 cup', 'cup', 'Cup, 150 ml (household_sizes).'];
const KAT = ['1 katori', 'katori', 'Medium katori, 150 ml (household_sizes).'];
const BOT = (ml, why) => ['1 bottle', ml, `Bottle of ${ml} ml: ${why}. Estimate.`];
const CAN = ['1 can', 330, 'Can of 330 ml (common Indian can size). Estimate.'];
const SP = [['1 tsp', 'tsp', 'Level teaspoon, 5 ml (household_sizes).'], ['1 tbsp', 'tbsp', 'Level tablespoon, 15 ml (household_sizes).']];
// [id, name, source-vector, density, density_src, estimate, origin, basis, popular, portions, aliases(substring of the lowercase name -> extra words)]
const L = [];
const add = (id, name, v, dens, dsrc, est, origin, basis, pop, portions, alias) => L.push({ id: 'l_' + id, name, v, dens, dsrc, est, origin, basis, pop, portions, alias });
const SPEC = 'Estimate: recipe built from rows of this table per 100 ml of the drink (assumption stated). Density is an estimate.';
add('water', 'Water (plain, drinking)', perMl(173647), 1, 'sourced', 0, FDC, usda(173647, 1) + ' Tap and bottled drinking water: 0 kcal.', 1, [G, CUP, BOT(500, 'standard packaged bottle (half litre)')], ['water (plain, drinking)', 'pani paani jal drinking mineral packaged bottled']);
add('soda_water', 'Soda water (plain, club soda)', perMl(174842), 1, 'sourced', 0, FDC, usda(174842, U[174842][5]), 0, [G, BOT(500, 'standard bottle'), CAN], ['soda water (plain', 'club']);
add('honey', 'Honey', perMl(169640), U[169640][5], 'sourced', 0, FDC, usda(169640, U[169640][5]) + ' Stored per ml (1 tsp = 5 ml = 7 g, 1 tbsp = 15 ml = 21 g, as USDA gives 21 g per tbsp).', 1, SP, ['honey', 'shahad madhu']);
add('juice_orange', 'Juice, orange (fresh)', perMl(169098), U[169098][5], 'sourced', 0, FDC, usda(169098, U[169098][5]) + ' The plain word "juice" finds this row first.', 1, [G, CUP], ['juice, orange', 'ras']);
const dA = U[173933][5], dMg = U[167785][5];
add('juice_apple', 'Juice, apple (packaged)', perMl(173933), dA, 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate for packaged juice: ' + usda(173933, dA), 0, [G, CUP], ['juice, apple', 'seb']);
add('juice_mango', 'Juice, mango (packaged nectar)', perMl(167785), dMg, 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate for packaged mango drink: ' + usda(167785, dMg), 0, [G, CUP], ['juice, mango', 'ras frooti maaza']);
const mixIds = [169098, 173933, 173042, 169947], mixD = mixIds.reduce((a, i) => a + U[i][5], 0) / mixIds.length;
add('juice_mixed', 'Juice, mixed fruit (packaged)', avg(mixIds), mixD, 'estimate', 1, 'estimate (USDA SR Legacy basis)', `Estimate for packaged mixed-fruit juice: mean of the USDA records ${mixIds.join(', ')} (orange, apple, grape and pineapple juice), per ml; density the mean of their published weights. Brands differ, check the pack.`, 0, [G, CUP], ['juice, mixed', 'tropicana']);
const dCola = U[174852][5];
add('cola', 'Soda / cola / soft drink (regular)', perMl(174852), dCola, 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate for a regular sugar-sweetened cola or lemon-lime soft drink (coke, pepsi, sprite, fanta, limca, thums up): ' + usda(174852, dCola) + ' Diet drinks are about 0 kcal.', 1, [G, BOT(500, 'standard soft-drink bottle'), CAN], ['soda / cola', 'coke pepsi sprite fanta limca thums 7up thumsup']);
add('beer', 'Beer (regular)', perMl(168746), U[168746][5], 'sourced', 0, FDC, usda(168746, U[168746][5]) + ' Typical 4.5-5% alcohol; strong beer has more.', 1, [G, CAN, BOT(650, 'large Indian beer bottle (650 ml); a small bottle is 330 ml, type ml for it'), ['1 pint', 568, 'Imperial pint, 568 ml. Estimate.']], ['beer (regular)', 'beers lager kingfisher']);
add('spirits', 'Whisky / rum / vodka / gin (spirits)', perMl(174819), U[174819][5], 'sourced', 0, FDC, usda(174819, U[174819][5]) + ' About 43% alcohol; neat, without soda, mixer or ice.', 1, [['1 shot', 30, 'Shot of 30 ml. Estimate; an Indian "small peg" is 30 ml, a "large peg" 60 ml (type 2 shots).'], ['1 peg', 60, 'Large peg of 60 ml (Indian bars). Estimate.']], ['whisky / rum', 'whiskey scotch brandy tequila spirits']);
add('wine', 'Wine, red or white (table wine)', perMl(173190), U[173190][5], 'sourced', 0, FDC, usda(173190, U[173190][5]) + ' White table wine (fdcId 174837) is 82 kcal per 100 g, so within 4%.', 0, [['1 glass', 150, 'Wine glass of 150 ml. Estimate.'], BOT(750, 'standard wine bottle')], ['wine, red', 'vino']);
add('green_tea', 'Green tea (brewed, no sugar)', perMl(171917), U[171917][5], 'sourced', 0, FDC, usda(171917, U[171917][5]), 0, [CUP, G], ['green tea (brewed', 'greentea']);
// lime water and sharbat: recipes from this table
const lime = perMl(168156), sugar = row('d_sugar_white'), milkW = row('d_cow_milk_whole'), milkT = row('d_cow_milk_toned_3_fat'), banana = row('d_banana_ripe'), coffee = row('d_coffee_black_no_sugar'), curd = row('d_curd_dahi_whole_milk'),
  dal = row('i_bengal_gram_dal'), oil = row('d_cooking_oil_refined_sunflower_groundnut_soybean'), almond = row('i_almond'), whey = per(173180), toor = row('d_dal_toor_cooked_light_tadka');
add('nimbu_pani', 'Nimbu pani (lemon water, sweetened)', mix([[lime, 10], [sugar, 4]]), 1.02, 'estimate', 1, 'estimate (recipe)', SPEC + ` Per 100 ml: 10 ml lime juice (USDA fdcId 168156) + 4 g sugar (2 tsp per 250 ml glass) + water. Salt ignored.`, 1, [G, CUP], ['nimbu pani (lemon', 'nimbu nimbupani shikanji lemonade limbu']);
add('lemon_water', 'Lemon water (unsweetened)', mix([[lime, 10]]), 1, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 10 ml lime juice (USDA fdcId 168156) + water, no sugar.', 0, [G, CUP], ['lemon water (unsweetened', 'nimbu']);
add('sharbat', 'Sharbat (syrup drink, rooh afza type)', mix([[sugar, 13]]), 1.05, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml of the drink: 13 g sugar (a syrup of about 65% sugar diluted 1 part to 4 of water); flavour ingredients ignored. Check the bottle.', 0, [G, CUP], ['sharbat (syrup', 'rooh afza roohafza squash cordial']);
add('filter_coffee', 'Filter coffee (with milk and sugar)', mix([[milkW, 55], [coffee, 45], [sugar, 4]]), 1.02, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 55 ml whole milk + 45 ml black decoction + 4 g sugar.', 0, [CUP, G], ['filter coffee', 'kaapi kapi']);
add('cold_coffee', 'Cold coffee (with milk and sugar)', mix([[milkT, 85], [coffee, 10], [sugar, 5]]), 1.03, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 85 ml toned milk + 10 ml coffee + 5 g sugar, no ice cream.', 0, [G, CUP], ['cold coffee', 'iced frappe']);
add('badam_milk', 'Badam milk (almond milk, sweetened)', mix([[milkT, 90], [sugar, 4], [almond, 4]]), 1.03, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 90 ml toned milk + 4 g sugar + 4 g ground almonds.', 0, [G, CUP], ['badam milk', 'badaam']);
add('milkshake', 'Milkshake (thick, with ice cream)', perMl(170884), U[170884][5], 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate for a thick vanilla shake: ' + usda(170884, U[170884][5]) + ' A fruit or chocolate shake differs.', 0, [G], ['milkshake', 'shake']);
add('shake_water', 'Protein shake, with water', mix([[whey, 10]]), 1, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 10 g whey protein powder (USDA fdcId 173180) + water, i.e. one 30 g scoop in 300 ml. Check your tub label.', 1, [G, ['1 shaker', 300, 'Shaker of 300 ml (one scoop). Estimate.']], ['protein shake, with water', 'whey scoop shaker']);
add('shake_milk', 'Protein shake, with milk', mix([[whey, 10], [milkT, 90]]), 1.03, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 10 g whey protein powder (USDA fdcId 173180) + 90 ml toned milk, i.e. one 30 g scoop in 300 ml milk. Check your tub label.', 0, [G, ['1 shaker', 300, 'Shaker of 300 ml (one scoop in milk). Estimate.']], ['protein shake, with milk', 'whey scoop shaker']);
add('smoothie', 'Smoothie (fruit with milk, home style)', mix([[milkT, 60], [banana, 40]]), 1.03, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 60 ml toned milk + 40 g ripe banana, nothing added. A yoghurt or mixed-fruit smoothie is close; sweetened or packaged ones are higher.', 1, [G], ['smoothie', 'smoothies']);
add('kheer', 'Kheer / payasam / rice pudding', perMl(168063), U[168063][5], 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate: ' + usda(168063, U[168063][5]) + ' Chosen because a home recipe (1 l whole milk, 50 g rice, 100 g sugar, reduced to 900 g) gives about 147 kcal per 100 g from this table, within 1%. Rich or dry-fruit kheer is higher.', 1, [KAT, CUP], ['kheer / payasam', 'phirni sewai seviyan']);
add('kadhi', 'Kadhi (yoghurt and besan curry)', mix([[curd, 22], [dal, 4], [oil, 1.5]]), 1.01, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 22 g curd + 4 g gram flour (Bengal gram dal row used for besan) + 1.5 g oil for the tempering + water; thin home style. Pakoda kadhi is higher.', 1, [KAT], ['kadhi (yoghurt', 'karhi kadi']);
add('soup_veg', 'Soup, vegetable', perMl(171594), U[171594][5], 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate: ' + usda(171594, U[171594][5]) + ' Restaurant or home soups vary a lot (cream, butter, cornflour). The plain word "soup" finds this row.', 1, [KAT, CUP], ['soup, vegetable', 'sup']);
add('soup_tomato', 'Soup, tomato', perMl(171176), U[171176][5], 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate: ' + usda(171176, U[171176][5]) + ' Cream or butter in a restaurant bowl adds more.', 0, [KAT, CUP], ['soup, tomato', 'sup']);
add('soup_chicken', 'Soup, chicken (with vegetables)', perMl(171546), U[171546][5], 'sourced', 1, 'estimate (USDA SR Legacy basis)', 'Estimate: ' + usda(171546, U[171546][5]) + ' Clear chicken broth is lower, hot-and-sour or cream of chicken higher.', 0, [KAT, CUP], ['soup, chicken', 'sup']);
add('soup_dal', 'Soup, dal (thin lentil soup)', mix([[toor, 50]]), 1, 'estimate', 1, 'estimate (recipe)', SPEC + ' Per 100 ml: 50 g of the "Dal toor, cooked (light tadka)" row + 50 ml water, i.e. dal thinned 1:1.', 0, [KAT, CUP], ['soup, dal', 'shorba']);

const N = ['kcal', 'protein', 'carbs', 'fat', 'fibre'];
db.exec('PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE');
try {
  // 1. liquids: remove the rows of an earlier run, then insert
  const old = db.prepare("SELECT id FROM foods WHERE id LIKE 'l\\_%' ESCAPE '\\'").all().map((r) => r.id);
  for (const id of old) { db.prepare('DELETE FROM portions WHERE food_id=?').run(id); db.prepare('DELETE FROM measures WHERE food_id=?').run(id); }
  db.prepare("DELETE FROM foods WHERE id LIKE 'l\\_%' ESCAPE '\\'").run();
  db.prepare("DELETE FROM aliases WHERE src='v1.1.5'").run();
  let ord = db.prepare('SELECT max(ord) m FROM foods').get().m + 1, aord = db.prepare("SELECT max(ord) m FROM aliases WHERE kind='name'").get().m + 1;
  const iF = db.prepare("INSERT INTO foods (id, ord, name, grp, source, base_unit, kcal_1, protein_1, carbs_1, fat_1, fibre_1, density, density_src, estimate, origin, basis, popular, superseded) VALUES (?,?,?,?, 'dish','ml',?,?,?,?,?,?,?,?,?,?,?,0)");
  const iP = db.prepare("INSERT INTO portions (food_id, ord, label, qual, kind, grams, size, ml, source, note) VALUES (?,?,?,'','volume',NULL,?,?,'estimate',?)");
  const iA = db.prepare("INSERT INTO aliases (kind, ord, word, extra, src) VALUES ('name', ?, ?, ?, 'v1.1.5')");
  for (const l of L) {
    iF.run(l.id, ord++, l.name, GRP, l.v.k, l.v.p, l.v.c, l.v.f, l.v.fib, +l.dens.toFixed(4), l.dsrc, l.est, l.origin, l.basis, l.pop);
    l.portions.forEach(([label, sz, note], i) => iP.run(l.id, i, label, typeof sz === 'string' ? sz : null, typeof sz === 'number' ? sz : null, note));
    iA.run(aord++, l.alias[0], l.alias[1]);
  }
  // 2. liquid cooking oils: USDA gives 218 g per cup (0.92 g/ml) for sunflower / soybean / coconut / mustard oil; a tbsp stays the 13 g label weight
  for (const id of ['d_cooking_oil_refined_sunflower_groundnut_soybean', 'd_mustard_oil', 'd_coconut_oil']) {
    db.prepare("UPDATE foods SET density=0.92, density_src='sourced', basis=basis || ' Density 0.92 g/ml: USDA SR Legacy 218 g per cup of liquid oil (v1.1.5; was 0.867 from the 13 g tbsp label, which is kept as the tbsp weight).' WHERE id=? AND density<>0.92").run(id);
    for (const t of ['measures', 'portions']) db.prepare(`UPDATE ${t} SET label='1 tbsp (13 g)', qual='', kind='weight', grams=13, size=NULL, ml=NULL WHERE food_id=? AND kind='volume' AND size='tbsp'`).run(id);
  }
  // 3. sweet potato (boiled): the 328 g mashed cup gave 1.386 g/ml; a cup of pieces is 200 g in USDA (fdcId 168485 cup pieces, 168483 baked cup)
  db.prepare("UPDATE foods SET density=200/236.588, basis=basis || ' Density 0.845 g/ml from the USDA cup of pieces (200 g, fdcId 168485 and 168483), v1.1.5; was 1.386 from the mashed cup (328 g, fdcId 168484).' WHERE id='u_sweet_potato_boiled' AND density>1").run();
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); console.error('FAILED, rolled back:', e.message); process.exit(1); }
console.log(`${L.length} liquid rows (${L.filter((l) => !l.est).length} sourced, ${L.filter((l) => l.est).length} estimate), oils 0.92 g/ml, sweet potato 0.845 g/ml`);
db.exec('VACUUM'); db.close();
