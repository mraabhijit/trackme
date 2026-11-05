// Fills the `portions` table of data/trackme.db (typical household quantities, v1.1.2). Re-runnable: it replaces all portion rows.
// Usage: node scripts/seed_portions.mjs
// IFCT gives values per 100 g only. Every weight below is an ESTIMATE (rounded, "~" in the label): common household / market
// averages, not measured values and not from IFCT. Weights already used by the app (cashew 1.5 g, fig 25.5 g, date 7 g,
// walnut 4 g, pistachio 0.7 g, raisin 0.5 g, medium banana 100 g, 10 almonds 12 g) are repeated unchanged.
// v1.1.4: the weight of a katori / cup / glass / spoon portion is no longer a free number: scripts/units.mjs turns those rows into volume rows
// (size in ml x foods.density). Run `node scripts/units.mjs` after this script. Piece weights below stay estimates.
// Labels follow the picker's rules: katori / glass / tbsp / tsp / cup / plate in the label set the unit kind, anything else is a piece.
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PC = 'Typical piece weight (household average, varies with size). Estimate, not an IFCT value.';
const KT = 'Estimated weight of one standard katori (~150 ml) of this food as stored; packs differently by grain size. Estimate.';
const SP = 'Estimated weight of a level spoon (tbsp 15 ml, tsp 5 ml). Estimate.';
const SL = 'Estimated weight of a typical serving slice. Estimate.';
const GL = 'Estimated weight of one glass (250 ml). Estimate; 1 ml taken as 1 g.';
const CT = 'Same per-piece weight the app already used for typed counts ("4 cashews"); calibrated to the v1.1.1 phone report. Estimate.';
const PL = 'Estimated weight of a plate serving. Estimate.';

// [food id, label, grams, note]
const P = [
  // nuts, seeds, dry fruit (the six count-unit foods repeat their v1.1.1 per-piece weight)
  ['i_almond', '10 almonds (~12 g)', 12, 'Same as the dish row "Almonds" (10 almonds ~12 g). Estimate.'],
  ['i_cashew_nut', '1 cashew (1.5 g)', 1.5, CT],
  ['i_walnut', '1 walnut (4 g)', 4, CT],
  ['i_pistachio_nuts', '1 pistachio (0.7 g)', 0.7, CT],
  ['i_raisins_dried_black', '1 raisin (0.5 g)', 0.5, CT],
  ['i_raisins_dried_golden', '1 raisin (0.5 g)', 0.5, CT],
  ['i_dates_dry_pale_brown', '1 date (7 g)', 7, CT],
  ['i_dates_dry_dark_brown', '1 date (7 g)', 7, CT],
  ['i_dates_processed', '1 date (7 g)', 7, CT],
  ['i_fig', '1 fig (25.5 g)', 25.5, CT],
  ['i_ground_nut', '1 peanut (~0.8 g)', 0.8, 'Shelled peanut kernel, about 0.8 g (10 peanuts ~8 g). Estimate.'],
  ['i_ground_nut', '1 handful (~30 g)', 30, 'Same handful weight the app uses for namkeen. Estimate.'],
  ['i_ground_nut', '1 tbsp (~12 g)', 12, SP],
  ['i_sunflower_seeds', '1 tbsp (~9 g)', 9, SP],
  ['i_gingelly_seeds_white', '1 tsp (~4 g)', 4, SP],
  ['i_gingelly_seeds_black', '1 tsp (~4 g)', 4, SP],
  ['i_gingelly_seeds_brown', '1 tsp (~4 g)', 4, SP],
  ['i_linseeds', '1 tbsp (~10 g)', 10, SP],
  ['i_coconut_kernel_fresh', '1 piece (~30 g)', 30, 'A small piece of fresh coconut. Estimate.'],
  ['i_apricot_dried', '1 dried apricot (~8 g)', 8, PC],
  // fruit, per piece
  ['i_banana_ripe_montham', '1 medium banana (~100 g)', 100, 'Same as the dish row "Banana, ripe" (medium banana ~100 g, edible part). Estimate.'],
  ['i_banana_ripe_poovam', '1 medium banana (~100 g)', 100, 'Same as the dish row "Banana, ripe". Estimate.'],
  ['i_banana_ripe_red', '1 medium banana (~100 g)', 100, 'Same as the dish row "Banana, ripe". Estimate.'],
  ['i_banana_ripe_robusta', '1 medium banana (~100 g)', 100, 'Same as the dish row "Banana, ripe". Estimate.'],
  ['i_apple_big', '1 medium apple (~170 g)', 170, 'Same as the dish row "Apple". Estimate.'],
  ['i_apple_green', '1 medium apple (~170 g)', 170, 'Same as the dish row "Apple". Estimate.'],
  ['i_apple_small', '1 small apple (~110 g)', 110, PC],
  ['i_apple_small_kashmir', '1 small apple (~110 g)', 110, PC],
  ['i_orange_pulp', '1 medium orange (~130 g)', 130, 'Same as the dish row "Orange". Estimate.'],
  ['i_lime_sweet_pulp', '1 mosambi (~120 g pulp)', 120, PC],
  ['i_guava_white_flesh', '1 medium guava (~100 g)', 100, PC],
  ['i_guava_pink_flesh', '1 medium guava (~100 g)', 100, PC],
  ['i_mango_ripe_banganapalli', '1 medium mango (~180 g pulp)', 180, 'Edible pulp of a medium mango (about 60 % of ~300 g). Estimate.'],
  ['i_mango_ripe_gulabkhas', '1 medium mango (~180 g pulp)', 180, 'Edible pulp of a medium mango. Estimate.'],
  ['i_mango_ripe_himsagar', '1 medium mango (~180 g pulp)', 180, 'Edible pulp of a medium mango. Estimate.'],
  ['i_mango_ripe_kesar', '1 medium mango (~180 g pulp)', 180, 'Edible pulp of a medium mango. Estimate.'],
  ['i_mango_ripe_paheri', '1 medium mango (~180 g pulp)', 180, 'Edible pulp of a medium mango. Estimate.'],
  ['i_mango_ripe_neelam', '1 medium mango (~180 g pulp)', 180, 'Edible pulp of a medium mango. Estimate.'],
  ['i_mango_ripe_totapari', '1 medium mango (~180 g pulp)', 180, 'Edible pulp of a medium mango. Estimate.'],
  ['i_pear', '1 medium pear (~150 g)', 150, PC],
  ['i_peach', '1 medium peach (~120 g)', 120, PC],
  ['i_plum', '1 plum (~60 g)', 60, PC],
  ['i_litchi', '1 litchi (~10 g)', 10, 'Edible flesh of one litchi. Estimate.'],
  ['i_sapota', '1 medium chikoo (~80 g)', 80, PC],
  ['i_goosberry', '1 amla (~20 g)', 20, PC],
  ['i_avocado_fruit', '1 medium avocado (~150 g pulp)', 150, PC],
  ['i_strawberry', '5 strawberries (~60 g)', 60, PC],
  ['i_cherries_red', '10 cherries (~80 g)', 80, PC],
  ['i_pomegranate_maroon_seeds', '1 medium pomegranate (~150 g seeds)', 150, 'Edible seeds of a medium pomegranate. Estimate.'],
  ['i_grapes_seeded_round_black', '10 grapes (~50 g)', 50, PC],
  ['i_grapes_seeded_round_green', '10 grapes (~50 g)', 50, PC],
  ['i_grapes_seedless_round_green', '10 grapes (~50 g)', 50, PC],
  ['i_grapes_seedless_round_black', '10 grapes (~50 g)', 50, PC],
  ['i_grapes_seeded_round_red', '10 grapes (~50 g)', 50, PC],
  ['i_grapes_seedless_oval_black', '10 grapes (~50 g)', 50, PC],
  ['i_papaya_ripe', '1 slice (~100 g)', 100, SL],
  ['i_water_melon_dark_green_sugar_baby', '1 slice (~200 g)', 200, SL],
  ['i_water_melon_pale_green', '1 slice (~200 g)', 200, SL],
  ['i_musk_melon_orange_flesh', '1 slice (~150 g)', 150, SL],
  ['i_musk_melon_yellow_flesh', '1 slice (~150 g)', 150, SL],
  ['i_pineapple', '1 slice (~80 g)', 80, SL],
  ['i_coconut_water', '1 glass (250 ml)', 250, GL],
  ['i_sugarcane_juice', '1 glass (250 ml)', 250, GL],
  // eggs
  ['i_egg_poultry_whole_raw', '1 egg (~50 g)', 50, 'Edible weight of one hen egg. Estimate.'],
  ['i_egg_poultry_whole_boiled', '1 egg (~50 g)', 50, 'Same as the dish row "Egg, boiled". Estimate.'],
  ['i_egg_poultry_white_raw', '1 egg white (~30 g)', 30, PC],
  ['i_egg_poultry_white_boiled', '1 egg white (~30 g)', 30, PC],
  ['i_egg_poultry_yolk_raw', '1 egg yolk (~17 g)', 17, PC],
  ['i_egg_poultry_yolk_boiled', '1 egg yolk (~17 g)', 17, PC],
  ['i_egg_country_hen_whole_raw', '1 egg (~45 g)', 45, PC],
  ['i_egg_country_hen_whole_boiled', '1 egg (~45 g)', 45, PC],
  ['i_egg_duck_whole_boiled', '1 duck egg (~70 g)', 70, PC],
  ['i_egg_duck_whole_raw', '1 duck egg (~70 g)', 70, PC],
  ['i_egg_quial_whole_raw', '1 quail egg (~10 g)', 10, PC],
  ['i_egg_quial_whole_boiled', '1 quail egg (~10 g)', 10, PC],
  // raw staples (grain, flour, dal): katori / cup / spoon
  ['i_rice_raw_milled', '1 katori raw (~125 g)', 125, KT],
  ['i_rice_raw_milled', '1 cup raw (~200 g)', 200, 'Estimated weight of one 240 ml cup of raw rice. Estimate.'],
  ['i_rice_parboiled_milled', '1 katori raw (~125 g)', 125, KT],
  ['i_rice_parboiled_milled', '1 cup raw (~200 g)', 200, 'Estimated weight of one 240 ml cup of raw rice. Estimate.'],
  ['i_rice_raw_brown', '1 katori raw (~125 g)', 125, KT],
  ['i_rice_raw_brown', '1 cup raw (~200 g)', 200, 'Estimated weight of one 240 ml cup of raw rice. Estimate.'],
  ['i_rice_flakes', '1 katori (~40 g)', 40, KT],
  ['i_rice_puffed', '1 katori (~10 g)', 10, KT],
  ['i_wheat_flour_atta', '1 katori (~80 g)', 80, KT],
  ['i_wheat_flour_atta', '1 tbsp (~8 g)', 8, SP],
  ['i_wheat_flour_refined', '1 katori (~80 g)', 80, KT],
  ['i_wheat_flour_refined', '1 tbsp (~8 g)', 8, SP],
  ['i_wheat_semolina', '1 katori (~100 g)', 100, KT],
  ['i_wheat_semolina', '1 tbsp (~12 g)', 12, SP],
  ['i_wheat_vermicelli', '1 katori (~60 g)', 60, KT],
  ['i_jowar', '1 katori (~110 g)', 110, KT],
  ['i_bajra', '1 katori (~110 g)', 110, KT],
  ['i_ragi', '1 katori (~100 g)', 100, KT],
  ['i_bengal_gram_dal', '1 katori raw (~120 g)', 120, KT],
  ['i_black_gram_dal', '1 katori raw (~120 g)', 120, KT],
  ['i_green_gram_dal', '1 katori raw (~120 g)', 120, KT],
  ['i_lentil_dal', '1 katori raw (~120 g)', 120, KT],
  ['i_red_gram_dal', '1 katori raw (~120 g)', 120, KT],
  ['i_bengal_gram_whole', '1 katori raw (~120 g)', 120, KT],
  ['i_green_gram_whole', '1 katori raw (~120 g)', 120, KT],
  ['i_black_gram_whole', '1 katori raw (~120 g)', 120, KT],
  ['i_lentil_whole_brown', '1 katori raw (~120 g)', 120, KT],
  ['i_rajmah_red', '1 katori raw (~110 g)', 110, KT],
  ['i_rajmah_brown', '1 katori raw (~110 g)', 110, KT],
  ['i_peas_dry', '1 katori raw (~120 g)', 120, KT],
  ['i_soya_bean_brown', '1 katori raw (~110 g)', 110, KT],
  // spices and seasoning
  ['i_cumin_seeds', '1 tsp (~2 g)', 2, SP],
  ['i_mustard_seeds', '1 tsp (~4 g)', 4, SP],
  ['i_coriander_seeds', '1 tsp (~2 g)', 2, SP],
  ['i_fenugreek_seeds', '1 tsp (~4 g)', 4, SP],
  ['i_turmeric_powder', '1 tsp (~3 g)', 3, SP],
  ['i_chillies_red', '1 tsp (~2 g)', 2, SP],
  ['i_pepper_black', '1 tsp (~2 g)', 2, SP],
  ['i_garlic_big_clove', '1 clove (~4 g)', 4, PC],
  ['i_garlic_small_clove', '1 clove (~2 g)', 2, PC],
  ['i_ginger_fresh', '1 inch piece (~10 g)', 10, PC],
  ['i_chillies_green_all_varieties', '1 green chilli (~5 g)', 5, PC],
  ['i_onion_big', '1 medium onion (~110 g)', 110, 'Same as the dish row "Onion". Estimate.'],
  ['i_onion_small', '1 small onion (~50 g)', 50, PC],
  // vegetables, per piece
  ['i_tomato_ripe_hybrid', '1 medium tomato (~120 g)', 120, 'Same as the dish row "Tomato, ripe". Estimate.'],
  ['i_tomato_ripe_local', '1 medium tomato (~120 g)', 120, 'Same as the dish row "Tomato, ripe". Estimate.'],
  ['i_potato_brown_skin_big', '1 medium potato (~150 g)', 150, 'Same as the dish row "Potato, raw". Estimate.'],
  ['i_potato_red_skin', '1 medium potato (~150 g)', 150, 'Same as the dish row "Potato, raw". Estimate.'],
  ['i_potato_brown_skin_small', '1 small potato (~75 g)', 75, PC],
  ['i_sweet_potato_brown_skin', '1 medium sweet potato (~130 g)', 130, PC],
  ['i_sweet_potato_pink_skin', '1 medium sweet potato (~130 g)', 130, PC],
  ['i_carrot_orange', '1 medium carrot (~70 g)', 70, PC],
  ['i_carrot_red', '1 medium carrot (~70 g)', 70, PC],
  ['i_beet_root', '1 medium beetroot (~100 g)', 100, PC],
  ['i_cucumber_green_elongate', '1 medium cucumber (~200 g)', 200, PC],
  ['i_cucumber_green_short', '1 small cucumber (~120 g)', 120, PC],
  ['i_capsicum_green', '1 medium capsicum (~100 g)', 100, PC],
  ['i_brinjal_all_varieties', '1 medium brinjal (~100 g)', 100, PC],
  ['i_ladies_finger', '1 bhindi (~10 g)', 10, 'Typical raw okra pod, 10 to 12 g (varies with size). Estimate, not an IFCT value.'],
  ['i_drumstick', '1 drumstick (~40 g)', 40, PC],
  ['i_button_mushroom_fresh', '1 mushroom (~15 g)', 15, PC],
  ['i_chicken_poultry_breast_skinless', '1 breast piece (~150 g)', 150, PC],
  ['i_chicken_poultry_thigh_skinless', '1 thigh (~100 g)', 100, PC],
  ['i_jaggery_cane', '1 tsp (~5 g)', 5, 'Same as the dish row "Jaggery". Estimate.'],
  ['i_jaggery_cane', '1 tbsp (~15 g)', 15, SP],
  ['i_khoa', '1 tbsp (~15 g)', 15, SP],
  // dishes that lack a unit people commonly use
  ['d_plain_rice_cooked_white', '1 plate (~250 g)', 250, PL],
  ['d_brown_rice_cooked', '1 plate (~250 g)', 250, PL],
  ['d_curd_rice', '1 plate (~250 g)', 250, PL],
  ['d_chicken_biryani', '1 katori (~150 g)', 150, 'Same katori weight as "Veg biryani". Estimate.'],
  ['d_oats_cooked_with_toned_milk', '1 katori (~150 g)', 150, KT],
  ['d_curd_dahi_whole_milk', '1 tbsp (~15 g)', 15, SP],
  ['d_chai_milk_tea_with_1_tsp_sugar', '1 cutting glass (~100 ml)', 100, 'A small tea-stall "cutting" glass, about 100 ml. Estimate.'],
  ['d_jaggery_cane', '1 tbsp (~15 g)', 15, SP],
  // v1.1.4: countable raw vegetables that had no piece row (weights are household averages, estimates, to be confirmed by the user)
  ...Array.from({ length: 21 }, (_, i) => ['i_brinjal_' + (i + 1), '1 medium brinjal (~100 g)', 100, PC]),
  ['i_capsicum_red', '1 medium capsicum (~100 g)', 100, PC],
  ['i_capsicum_yellow', '1 medium capsicum (~100 g)', 100, PC],
  ['i_radish_round_red_skin', '1 radish (~25 g)', 25, PC],
  ['i_radish_round_white_skin', '1 radish (~25 g)', 25, PC],
  ['i_radish_elongate_red_skin', '1 mooli (~150 g)', 150, PC],
  ['i_radish_elongate_white_skin', '1 mooli (~150 g)', 150, PC],
  ['i_corn_baby', '1 baby corn (~15 g)', 15, PC],
  ['i_tomato_green', '1 medium tomato (~100 g)', 100, PC],
  ['i_kovai_big', '1 kovai (~20 g)', 20, PC],
  ['i_kovai_small', '1 kovai (~10 g)', 10, PC],
  ['i_parwar', '1 parwar (~30 g)', 30, PC],
  ['i_tinda_tender', '1 tinda (~50 g)', 50, PC],
  ['i_zucchini_green', '1 medium zucchini (~200 g)', 200, PC],
  ['i_zucchini_yellow', '1 medium zucchini (~200 g)', 200, PC],
  ['i_plantain_green', '1 raw plantain (~200 g)', 200, PC],
  ['i_mango_green_raw', '1 raw mango (~200 g)', 200, PC],
  ['i_cucumber_orange_round', '1 medium cucumber (~200 g)', 200, PC],
];

const db = new DatabaseSync(join(ROOT, 'data/trackme.db'));
const ids = new Set(db.prepare('SELECT id FROM foods WHERE superseded = 0').all().map((r) => r.id));
db.exec("DELETE FROM portions WHERE food_id NOT IN (SELECT id FROM foods WHERE source = 'cooked') AND food_id NOT LIKE 'l\\_%' ESCAPE '\\'"); // cooked rows are written by import_cooked.mjs, liquid rows (l_*) by data_v115.mjs
// kind 'weight' is a placeholder: scripts/units.mjs classifies every row (volume | piece | weight) afterwards and sets the density
const newShape = db.prepare('PRAGMA table_info(portions)').all().some((c) => c.name === 'kind'); // before units.mjs ran the table still has the v1.1.3 shape
const ins = db.prepare(newShape ? "INSERT INTO portions (food_id, ord, label, kind, grams, source, note) VALUES (?,?,?,'weight',?,'estimate',?)" : "INSERT INTO portions VALUES (?,?,?,?,'estimate',?)");
const ord = new Map(); let n = 0;
for (const [id, label, grams, note] of P) {
  if (!ids.has(id)) throw new Error('unknown food id ' + id);
  const o = ord.get(id) ?? 0; ord.set(id, o + 1);
  ins.run(id, o, label, grams, note); n++;
}
console.log(n + ' portion rows for ' + ord.size + ' foods');
db.close();
