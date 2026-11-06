# Changelog

All notable changes to TrackMe (the app folder is still called `journable/`). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). From now on every change ends with an entry here.

## [Unreleased] (1.1.4)

### Fixed (real-phone report 2026-11-05)
- **"ModelNotLoadedError" after the AI model loaded.** WebLLM's `reload()` swallows an abort and returns with no model inside, so an engine marked ready could fail its first request in a few ms. The app now reloads the model once and asks again; if it fails a second time the usual reason and Retry are shown. Cause of the abort on the phone not proven. Test: `tests/test_v116.py`.

- **More reliable on-device AI (real-phone errors "mapAsync ... unmapped", "Instance reference no longer exists", "already been disposed", ModelNotLoaded).** Any such GPU error now reloads the model once (fresh engine, waited for) and asks again; a second failure shows the reason and Retry. AI jobs run one at a time; a timed-out or cancelled generation is interrupted and must have stopped before the next one or a reload starts; an older run (Retry, new text, Cancel) can no longer put its rows into the sheet; repeated identical items from the line-by-line retry are merged. After a long time in the background (20 s or more) the AI engine is let go quietly and reloaded on the next use. "Last AI problem" now also shows the error class, the number of automatic reloads, whether the page was hidden during the run and the GPU (shader-f16, buffer limit). The exact cause on the phone is not proven; the duplicate rows were not reproduced with the mock. Test: `tests/test_v117.py`.

### Added
- **Fixed household sizes.** small katori 100 ml, katori 150 ml (unchanged), large katori 200 ml, bowl 275 ml, cup 150 ml, glass 250 ml, tbsp 15 ml, tsp 5 ml. "small katori dal" is 100 g, "large katori dal" 200 g, "1 bowl rice" 238 g (the food's own bowl portion still wins: "oats 1 bowl" 250 g). A cup is 150 ml for every food (a cup of cooked rice 130 g instead of 160 g, a cup of milk 155 g instead of 248 g, a raw rice cup 125 g instead of 200 g). Level-teaspoon weights that were within 5% of the new value keep their old grams (4.5 g ghee/oil tsp).
- **Per-unit data.** The food database now stores nutrition per 1 g (liquids per 1 ml) and a density for foods with a volume portion; a katori/cup/glass/spoon weight is "size x density" and cannot disagree with its label. Liquids typed in ml use their density: "200 ml milk" is 206.4 g, 123 kcal (was 200 g, 119 kcal). The app, saved entries, packs and backups still use per-100 g numbers, so nothing stored changes.
- **Cooked vegetables.** 31 boiled vegetables from USDA FoodData Central SR Legacy (spinach, cauliflower, okra, brinjal, carrot, pumpkin, peas, cabbage, onion, French beans, broccoli, karela, drumstick pods and leaves, lauki, ash gourd, mushroom, capsicum, mustard greens, beet greens, mooli, knol khol, lotus root, zucchini, chow chow, potato, sweet potato, beetroot, arvi, suran, raw banana) tagged "USDA", found by "boiled spinach" or "palak boiled"; raw names rank as before ("cabbage", "mushroom", "sweet potato", "tinda" still find the raw item first; review fix). Carbohydrate is by difference minus fibre, to match the IFCT numbers (IFCT carbs exclude fibre). 8 more (tinda, parwal, kundru, ridge gourd / turai, snake gourd, cluster beans, methi, bathua) are estimates derived from the IFCT raw value by a boiling factor from USDA pairs, named "- estimate", tagged "estimate" and explained in their basis text.
- **More piece sizes.** "1 brinjal", capsicum red/yellow, radish, mooli, baby corn, green tomato, kundru, parwal, tinda, zucchini, raw plantain, raw mango, round cucumber. Weights are household averages (estimates, marked ~). A per-piece nutrition view `food_pieces` is in the database.
- **Counts of boiled vegetables are pieces.** "1 boiled potato" is one medium potato (136 g), "2 boiled carrots", "1 boiled onion", "1 boiled sweet potato", "3 boiled bhindi", "2 boiled mushrooms", "1 boiled beetroot" use the piece weight from the USDA file instead of a katori.
- About: credit line for USDA FoodData Central; README Credits and Household sizes sections; version 1.1.4.

### Changed
- Weights of dish and raw-food katori portions are unchanged, but their labels now carry the estimate mark: "1 katori (~150 g)". Searching "milk" shows "kcal per 100 ml".
- Editing a saved entry whose unit label matches a portion with a different weight keeps the entry's own weight.
- "1 small katori rice" is shown as "1 x small katori (87 g)" (and "large katori" likewise), not "0.67 x katori".
- "boiled potato" finds the boiled potato (it found the boiled sweet potato); the import script stops with a clear message, before touching the database, when a USDA CSV file is missing.
- Data scripts: `scripts/units.mjs` (migration, re-runnable, backup `data/trackme.pre-units.db`), `scripts/import_cooked.mjs` + `scripts/cooked_list.mjs`; `seed_portions.mjs` works on both table shapes; `db_check.mjs` now has 74 checks.

### Drinks and liquids (added to 1.1.4, unreleased)
- **New group "Beverages and liquids"** (28 rows, stored per 1 ml with a density): plain water (0 kcal; also pani, paani, jal), soda water, honey (tsp 5 ml, tbsp 15 ml), juices (orange fresh, apple, mango, mixed fruit; "juice" alone gives orange with the others as alternatives), soda / cola / soft drink (coke, pepsi, sprite ...), beer, whisky / rum / vodka / gin, wine, green tea, nimbu pani and lemon water, sharbat (rooh afza type), filter and cold coffee, badam milk, milkshake, protein shake with water and with milk, smoothie, kheer / payasam / rice pudding, kadhi, soups (vegetable, tomato, chicken, dal). Sourced rows (water, honey, orange juice, beer, spirits, wine, green tea, soda water) are USDA FoodData Central SR Legacy records with the fdcId in the row note; every other row is tagged estimate and says how it was built. Script: `scripts/data_v115.mjs` (idempotent, runs after units and import_cooked; `node scripts/data_v115.mjs <USDA csv folder>` only verifies the numbers).
- **Liquids show ml, not grams.** "1 cup milk (150 ml)", "1 glass water (250 ml)", "1 x can (330 ml)" in the preview, Today, the check sheet and the food list; the saved grams are unchanged (ml = grams / density at display time). The unit picker has an explicit **ml** choice for every liquid; the entry is stored exactly like a typed "200 ml".
- New unit words: bottle (500 ml), can (330 ml), shot (30 ml), pint (568 ml); a food's own row wins (beer bottle 650 ml, wine glass 150 ml, wine bottle 750 ml). "bottle gourd" is still a vegetable.

### Changed (v1.1.5 data)
- "water" is plain water, no longer the water chestnut (and "beer" is no longer beetroot, "coke" no longer jaggery, "kheer" no longer cucumber).
- A guess for a misspelt word now needs 5 or more letters and the same first letter; otherwise the row stays "Not found" with Search all foods / Search online / Make custom food.
- Liquid cooking oils (sunflower/groundnut/soybean, mustard, coconut) use 0.92 g/ml (USDA 218 g per cup) instead of 0.867: "100 ml oil" is now 92 g (828 kcal, was 87 g / 780 kcal). The tbsp stays the 13 g label weight and the tsp 4.5 g. Ghee and vanaspati keep 0.867 (USDA butter oil 205 g per cup, shortening 205 g).
- Boiled sweet potato density 1.386 -> 0.845 g/ml (USDA cup of pieces 200 g instead of the 328 g mashed cup): "1 katori boiled sweet potato" is 127 g (was 208 g); "1 boiled sweet potato" is still the 151 g piece. Drumstick leaves (boiled) stay 0.178 g/ml: it is the USDA measured cup of chopped cooked leaves (42 g).
- The words "bottle", "can", "shot" and "pint" are units only after a number.
- `db_check.mjs` now has 82 checks; `seed_portions.mjs` keeps the liquid rows' portions.

### Earlier in this release (1.1.2 / 1.1.3)

### Changed
- **Quantity basis is spelled out.** Food search results, the alternatives in the check sheet and "Search all foods" now say what the numbers are for, for example "105 kcal per 100 g; 105 kcal for 1 medium banana (100 g)". Meal detail > Nutrition facts says "For the whole meal: N items, about X g eaten."
- **Portions.** About 136 foods that only had per-100 g values now offer typical household quantities in the unit picker (nuts and dry fruit per piece, fruit per piece or slice, eggs, raw rice / flour / dal per katori or cup, spoons of spices, common vegetables per piece, plates of rice, a cutting-chai glass ...). All of them are estimates (rounded, marked "~", sources and reasons in the database), not IFCT values. Per-piece weights used for typed counts ("4 cashews") are unchanged.
- Food data now lives in one SQLite file, `data/trackme.db`, and the site is built by `node scripts/build.mjs` into the top folder of the repository (there is no `dist/` any more). The app itself and its stored data are unchanged.
- The `trackme-site.zip` holds the same site files as before.

### Fixed
- **Typed counts of raw fruit and vegetables use the piece, not a katori.** "10 strawberries" was 10 katori (1 kg, 246 kcal), "10 cherries" 1 kg, "1 dried apricot" 100 g, "1 guava" a katori. A raw food's own portion ("1 medium guava", "10 grapes") now comes before the generic "1 katori (chopped)", so these read 120 g, 80 g, 8 g and 1 medium guava; "1 katori guava" still gives the katori. Red seeded and black oval grapes gain the "10 grapes (~50 g)" portion the other grapes have ("10 grapes" matched the red ones and was 1 kg).

### Fixed (v1.1.3 review items)
- **"1 mango" is a ripe mango** (about 180 g pulp, estimate), not Mangosteen; "mango" and "aam" rank a ripe mango first, "mangosteen" still finds mangosteen. Mango, ripe, paheri gets the same piece portion as the other mango rows.
- **A plain count means the raw item.** "5 bhindi" is 5 okra pods (~10 g each, estimate), not 5 katori of Bhindi sabzi; "2 country eggs" is 2 eggs (90 g), not 200 g of omelette; "2 green chillies" is 10 g, not 200 g. Dishes still win when you type a dish word ("bhindi sabzi", "omelette", "egg curry") or a unit ("1 katori").
- **Counts of small pieces stay pieces up to 200.** "25 grapes" is 25 grapes (125 g), not 25 g; same for almonds, raisins, cashews, peanuts, chillies. Plain numbers for other foods ("rice 100") are still grams.
- **More names found:** jeera (cumin seeds), chikoo (sapota), amla (gooseberry), mosambi (Lime, sweet, pulp), sesame / til (white gingelly seeds; "til" no longer finds Tilapia), peanuts / groundnut / moongphali (Ground nut), watermelon / tarbooz, bhindi / okra (Ladies finger). New estimated portions: 1 peanut (~0.8 g), 1 bhindi (~10 g), 1 tsp brown sesame.
- **The basis line keeps the estimate mark and the unit:** "for 1 katori raw (~125 g)", "for 1 glass (250 ml)".

## [1.1.1] - 2026-11-05

Fixes from a real-phone report (six lines: "Protein oats (100 g)", "Almonds soaked (3 nuts)", "Cashews (4 nuts)", "Anjeer, soaked (2 figs)", "Dates, soaked (2 dates)", "Milk (200 ml) at 8 AM"; the chip said AI ready, the sheet said the AI could not read it, and the rules made bad rows).

### Fixed
- **AI failures are explained.** The check sheet says why ("AI could not read this: the AI took too long / stopped with an error (...) / gave an answer that could not be read / named no food in your text") with a **Retry** button. On-device AI keeps a copyable **Last AI problem** (model, load ms, generate ms, tokens, reason, the text; kept in memory only).
- **Loading and reading are separate.** Loading the model shows progress and Cancel and has no timeout; the reading timeout grows with the number of lines (15 s + 9 s per line, +20 s for the very first call).
- **Line-by-line retry.** If the whole-text call fails (and the text has 2 to 8 lines), each line is asked once and the answers are merged into the same meal; a line the AI still cannot read keeps the built-in rules' row (marked Check) and the sheet says "read 5 of 6 lines".
- **Tolerant validation of the AI answer.** Brackets, capitals, punctuation and modifier words no longer make a valid item "invented"; numbers may be strings; unit and type are case-insensitive. When the AI names only the food ("Cashews") and leaves out the amount, the amount you typed next to it ("(4 nuts)", "200 ml") is used, so the AI's own unit (for example "g" for nuts) never replaces yours. A `<think>` block and trailing commas in the AI's JSON are tolerated.
- **Commas inside names.** A comma fragment that is only a descriptor (soaked, dried, raw, cooked ...) belongs to the item before it on the same line, so "Anjeer, soaked (2 figs)" is one item. Other commas still split items, also in multi-line text ("rice, dal" on one of several lines is rice and dal; an earlier 1.1.1 build kept the line whole and lost the rice).
- **Count units.** "(4 nuts)", "(2 figs)", "(2 dates)", "4 cashews" are pieces with per-piece weights (cashew 1.5 g, fig 25.5 g, date 7 g, walnut 4 g, pistachio 0.7 g, raisin 0.5 g) and are shown as typed ("4 nuts"), never "400 g" or "2 x katori (200 g)". Calibrated to the report: 4 cashews 35 kcal, 2 figs 42, 2 dates 40, 4 almonds 29.
- **Modifier words** (soaked, dried, raw, peeled, chopped, toasted, ...) no longer cause "Not found" ("Almonds soaked" finds almonds).
- **Online search.** `world.openfoodfacts.org/cgi/search.pl` currently answers 503 ("temporarily unavailable"), and `search.openfoodfacts.org` sends no CORS header to browsers, so on a phone both failed. Search now tries world, then search, then `in.openfoodfacts.org/cgi/search.pl` (CORS open, answers), says what went wrong (server busy with the HTTP code, no answer in 12 s, request blocked or offline, unreadable answer) and offers **Retry**. CSP `connect-src` gains `in.openfoodfacts.org`. Only the food name is sent; the service worker still ignores cross-origin requests.
- Food data: "Protein oats (dry, packaged)" (380 kcal per 100 g, as in the report) is found for "protein oats"; "1 medium banana" is 100 g (105 kcal), was 120 g.

### Changed
- The button **"Not this?" is now "Change item"** (check sheet, tests, docs).
- Version 1.1.1 (About, "What's new in 1.1.1", `Journable.version`).
- Tests: see `tests/CHANGES.md`. New suite `tests/test_v111.py`.

## [1.1.0] - 2026-11-04

### Added
- **Text size** setting (Settings): Small 13 / Medium 14 (default) / Large 16 / Extra large 18 px. Saved on the device (`dt:v1:ui.fontSize`), applied before the first paint (`early.js`), live preview. Tap targets stay at least 44 px and nothing scrolls sideways at 360 px at any size.
- **Sticky, collapsing summary on Today**: header, week strip and the Calories + Macros card stay pinned. After scrolling about 60 px the big card shrinks to one compact bar (Remaining kcal, and carbs / protein / fat as consumed / goal with thin bars). Over budget shows a negative value in the warning colour with the word "Over by". Hysteresis and a short lock stop flicker; short pages never collapse; reduced-motion is respected; content scrolls under the bar with matching scroll padding.
- **Swipe between days** on Today (Pointer Events): right = previous day, left = next day, never into the future (a small bounce at today). Ignored in the quick-log bar, inputs, open sheets and the drawer. A mouse drag is not treated as a tap.
- **Weekly summary** rewritten as tabs (This week ... 12 weeks ago) with a summary card and tables: Calories (Total, Versus last week, daily goal note), Macronutrients ("Ng under/over", split note), Weight (Day, Date, Time, Weight), Water (Cups, Volume, Remaining cups).
- **Weight tracker**: add sheet (kg, date, time), Current / Target weight cards, Week / Month / Year / All time chart (grid, date and kg ticks, line, dashed target line; works with 0, 1 or 200 points), Weight entries list with edit, delete and Undo. Optional `targetWeightKg` on the profile (Daily goals). Weights gain an optional `time`.
- **Meal detail** screen: tap a meal card (title or body) to see its items (quantity as typed, kcal / carbs / protein / fat chips, AI tag), meal totals with each one's % of the daily goal, time, per-item and meal menus, **Nutrition facts** (only nutrients the food table really has: carbohydrates, fibre, protein, fat; fibre shows "partial" when some items have no fibre data; AI estimates add only macros; nothing invented) and an on-demand **Health analysis** (button only when the on-device AI is ready; 2-3 plain sentences from the meal's numbers, temperature 0, timeout and Cancel, labelled "AI-written, not medical advice", kept in memory only).
- **AI-first reading**: with a model downloaded and on, all typed or spoken text goes to the AI (foods, amounts, units, time, meal, exercise); the built-in rules are only the fallback (no model, switched off, load error, timeout, cancel). Foods are looked up in the table by the name the AI extracted.
- **AI estimates**: a food not in the table gets calories / protein / carbs / fat estimated by the AI (validated and clamped), tagged **AI** in the check sheet, on Today and in the edit screen; additive `est:'ai'` field carried by export, import and merge. Never saved automatically; Basic mode has no estimates.
- **Units as typed**: ml, glass, bowl, cup, tbsp, piece, g are kept as you typed them (ml / l are real units, density 1), never relabelled to grams.
- **Multi-line input**: several lines in the quick-log box are one meal (one time, slot, check sheet, save). Lines are split by the usual separators as well; blank lines, CRLF and a trailing newline are fine. A time or meal word on any line applies to all; lines with different times become separate entries shown as groups; a line that is only "lunch 1pm" applies to the lines after it; exercise lines join the same sheet. With AI on the whole text goes to the model in one call. The box grows to about 5 lines, then scrolls, and never covers Today's content. **Edit as text** on a meal (meal menu) brings it back as one item per line.
- **Export report (PDF)** from the Weekly summary: presets This week / Last week / Last 30 days / Custom (max 92 days), file `trackme-report-<from>-to-<to>.pdf`, A4, grey header rows and bordered tables: period page, Calories, Macronutrients, Weight, Water, Consistency Stats and Entries with one table per day (time, item and quantity as typed, AI mark, exercise rows, Total and Remaining). Made on the phone by a small writer in `report.js` (no library); Weekly numbers and PDF tables come from the same data.
- **Import a report (PDF)** in Backup & restore: reads text positions with pdf.js (vendored, lazy, Apache-2.0), also fractions, wrapped names and rows broken across pages, and TrackMe's own PDFs. "Check before saving" preview per day with computed vs report totals, counts, "Couldn't read" list, Import new only (default) / Import all, entries tagged imported (`imp:'pdf'`), undo toast. Goals in a report are not imported. Cap 15 MB, 60 s timeout, plain messages for other or damaged PDFs.
- "What's new in 1.1" list and Install help in About; pdf.js credit.
- `CHANGELOG.md` (this file) is in the zip.

### Changed
- **Renamed from "Journable" to "TrackMe"**: title, header, drawer, About, README, manifest (`name`, `short_name`), export file names (`trackme-backup-<date>.json`, `trackme-raw-<date>.json`), zip name (`trackme-site.zip`), service-worker cache `trackme-shell-v<hash>` (the worker deletes both old `journable-shell-*` and new `trackme-shell-*` caches, and nothing else). Hits of "journable" kept on purpose: the AI/PDF library cache `journable-lib` and the `dt:v1:*` storage keys (renaming would orphan downloaded models and data); the backup marker `app:'diet-tracker'` and `schema:1` (old backups import, new exports still import into the old page); `window.Journable` is now an alias of `window.TrackMe` (tests use it); the env var `JOURNABLE_URL` and the folder name `journable/` (build and test paths); the README sentence explaining the rename. An app already installed on a home screen keeps its old name and icon until it is reinstalled (README and About).
- **Today is minimal**: removed the "Log a meal / Other meals" card, "Your numbers", "Last 7 days" and "Day total". Target, burn, deficit explanation, floor / pace notes and fibre moved to Daily goals ("Today so far"). Add-to-meal buttons stay on each meal card.
- Header chip is now exactly **AI ready** (model downloaded and on) or **Basic**.
- Default text is smaller (14 px root). Quick-log box text uses the same scale.
- Quick-log box: Enter inserts a new line (send with the button or Ctrl+Enter); `maxlength` and the parser keep line breaks (they used to be flattened into one line).
- Version is 1.1 everywhere; the service-worker cache name follows a hash of the shell files (now including `report.js`).
- Tests: see `tests/CHANGES.md` (every changed old assertion with its reason). New suites: `test_v11_ui.py`, `test_multiline.py`, `test_report.py`.

- **Build size cap** for html + js + css raised from 400 KB to 450 KB in `scripts/build.py` (1.1 is now about 402 KB; the PDF writer and reader stay in the lazy `report.js` and `vendor/pdfjs`).

### Removed
- "Consistency stats" and "Share" from the Weekly summary screen (the PDF has a Consistency Stats page).
- The old 7-day chart and Day total block on Today; the chip texts "AI off", "AI loading N%" and "loads on first use".

### Fixed (independent review of 1.1)
- Gram amounts on Today, Meal detail and in the AI meal prompt read "(100 g)" again instead of "(100 × g)" (`qtyText`).
- Meal detail no longer claims "Dietary fibre 0 g" for items imported from a PDF report (they carry no fibre data); fibre is left out or marked partial instead.
- AI reading: a weak food-table match (score below 0.8, e.g. "pad thai" -> an unrelated dish, "protein bar" -> sambar) no longer beats the AI's own estimate; the estimate is used (tagged AI) and the weak match stays under "Not this?".
- AI reading: when the model names a food that is not in the table and gives no usable estimate, the item's own typed words are looked up (e.g. "2 roti" is no longer "Not found"); when the model's food differs from a confident match of the typed words, the row is marked Check.
- AI estimates: the weight of one household unit is capped at 3x its usual weight (a glass at 750 g, a bowl at 450 g ...), and an estimate with no macros is capped at 4 kcal per gram.
- Quick-log box: the phone keyboard's Enter key is labelled as a new line (`enterkeyhint="enter"`), matching what Enter does; send with the send button.
- PDF import toast says "1 weight", not "1 weights".
- **PDF export lists whole weeks**: Calories, Macronutrients, Weight and Water now list the full Monday-Sunday week(s) that contain the period, as the reference report does (period 2-4 Nov lists Mon 2 ... Sun 8 Nov). Days outside the period and days in the future show "-"; longer periods list each week's days in order and the tables continue across pages with the header row repeated. The header, the budget line, "N of Y days tracked" and the Total row still use the chosen period (Total sums tracked days only). "vs Last Week" compares up to a week with the same days one week earlier. Weights print with one decimal ("75.0 kg").
- **Consistency Stats** count entries as the reference does (Food Entries = logged entries / time groups, 17 for the reference; Exercise Entries = exercise entries), not item counts.
- **Entries keep their identity**: two separate entries at the same time (the reference has 17:51 twice) stay two groups in the PDF and after import (each imported group gets its own log id; the import preview no longer merges same-time groups), so export -> import in a fresh profile gives the same entry count, item count and per-day totals. Fractions print as the reference does (`½`, `¼`, `¾`, `1¼`, glyphs in the PDF's built-in font, no new font needed) and are read back exactly.
- **Typing a lone fraction** such as "rice ½ bowl" or "banana ¾" works in Basic mode (the space before the fraction was swallowed, so the food name was not found).
- **AI + multi-line**: with the AI on, the WHOLE multi-line text goes to the model in ONE call (it used to be one call per time group). The rules only decide which line belongs to which time group (the model's items are matched back to their line), so lines with different times still become separate entries; the typed qty/unit still wins and a text with one time is still one meal. The rule-based split is used on its own only as the Basic fallback.
- **Undo toast at Large and Extra large text** is full width (minus 12 px margins), clamped to 2 lines, sits just above the quick-log bar and no longer covers the pinned summary or the bar (tested at 360 x 740 XL and 412 x 915 Large). At Small and Medium the toast is unchanged.
- **Edit screen of an item typed in ml** (for example an AI-estimated "200 ml" shake) says "84 kcal for 200 ml", not "for 200 g" (l and kg likewise).
- **pdf.js cache refresh**: the cached pdf.js, its worker and web-llm.js (cache `journable-lib`) carry a version marker (hash of the vendored files, injected by `scripts/build.py`). When an app update installs and the marker differs (or is missing, as on installs from before this fix), the cached lib files are downloaded again and replaced together only if all downloads succeed. Nothing is deleted: the web-llm / model caches are never touched, and an update that does not change the libraries downloads nothing.
- Tests: new `tests/test_review_v11.py` and `tests/test_fixes11.py`; `test_multiline.py` asserts one model call for the whole text.

## [1.0.0] - 2026-11 (summary)
- Installable offline PWA (manifest, icons, service worker with a versioned shell cache), own storage namespace `dt:v1:*`, backups that also import into and from the older Diet Tracker page.
- Optional on-device AI (WebLLM, Qwen3 / Llama 3.2, model programs vendored; weights downloaded once from huggingface.co) with Check my phone, model manager and lazy load; results always confirmed in a "Check before saving" sheet.
- Online food search (Open Food Facts) and My foods, saved entries, water tracker, exercise with MET values, meal slots, History, Weekly summary (first version).

## Earlier phases (0.x)
- 0.1 Phase 1: single-page diet tracker with IFCT 2017 foods, quick-log box and rule-based parser (English / Hinglish), profile and daily goals.
- 0.2 Phase 2: calorie model with activity levels and workouts counted separately, exercise logging, water, saved entries, Today screen.
- 0.3 Phase 3 / 3.1: PWA, on-device AI adapter, review fixes.
