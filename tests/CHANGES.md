# Changes to the old test scripts (re-pointed at journable/dist/index.html)

Every old assertion keeps its intent. All scripts import `tphelpers.py` (URL = journable/dist/index.html) and use
`goto(page, view)` (menu button + drawer item) instead of the old bottom-nav clicks, `add_person`, `switch_person`,
`edit_entry` / `delete_entry` / `entry_menu` (row options sheet instead of inline Edit/Delete buttons).
Those navigation-only edits are not listed one by one. The 18 assertions below changed in their selector, bound or wording.

## test_app.py (5)
1. "tabs disabled before profile" -> "menu items disabled before profile": there is no tab bar; the drawer items are disabled until a profile exists.
2. "Left to eat today label" -> "Remaining label in the calories card": the label is now "Remaining" in `#cal-card` (`#totals` still exists for target/burn/deficit).
3. "save button visible without scrolling at 360x740": bound `740-56` -> `740` (no bottom nav bar any more).
4. "footer credit visible" -> "credit visible on About": the IFCT credit moved from the page footer to the About screen (`#credit`).
5. "midnight rollover": reads `#date-long` (new date line) instead of `#view p.muted`.

## test_hardening.py (2)
6. "backup card above form" -> "backup & restore is one tap from the menu and its card comes first": backup lives on its own screen, whose first card is `#backup`.
7. "tabs still usable after crash" -> "menu still usable after crash": drawer item instead of tab button.

## test_slots.py (1)
8. "add button visible 360x740 with 7 chips": bound `740-56` -> `740` (no bottom nav bar).

## test_time.py (5)
9. "inline editor opens with Done/Cancel" -> "time sheet opens with Save/Cancel": Today's time editor is now the Change date & time sheet (ids `#q-done`, `#q-cancel` kept).
10. "focus returns to Edit time button after save" -> "...to the row options button": the row now has one options button (`.menu-btn`).
11. "only one Today time editor open at a time" -> "only one time sheet open at a time (the sheet is modal)".
12. "third open also leaves exactly one": reopen after Escape because the sheet is modal.
13. Tap-target check: selector `.tpbox button,.tpbox input,.time-edit-btn` -> `#datetime-sheet button,#datetime-sheet input` (same 43.5 px rule).

## test_online.py (2)
14. "footer credits Open Food Facts, ODbL" -> "About credits Open Food Facts, ODbL": credit moved to About (`#off-credit`).
15. "no innerHTML in page source": now scans dist/index.html + dist/app.js (the app is split into files).

## test_pack.py (2)
16. "profile import still works": checks the drawer's Today item is enabled instead of the tab.
17. "old backup without shared foods restores": same selector change.

## test_activity.py (1)
18. "notice text and numbers": the notice now says "choose Very active in Daily goals." (the old "Profile" screen is called Daily goals).

Total phase 1 changed assertions: 18 (of 7 old suites).

# Phase 2 changes (activity model 3 is the new default, exercise/saved/water/mic now exist)

## test_app.py (2)
19. Asha's activity 1.4 -> 1.45 (model 3 has no 1.4): expected TDEE 2492 -> 2581, target 1942 -> 2031, deficit recomputed from 2581.
20. Profile "Z": 1.55 -> 1.6 (model 3 level), expected numbers recomputed.

## test_activity.py (about 8)
21. Option list is now 1.2 / 1.3 / 1.45 / 1.6 with the everyday labels and the note "Do not count workouts here ...".
22. Default for a new profile is 1.3 (was 1.55 / 1.4).
23. Golden TDEE cases use model-3 levels.
24. Asha 1.45: TDEE 2581, target 2031 (was 2492 / 1942); chart label "Target 2031".
25. A new profile is stored as activityModel 3 with exerciseAdds true (was 2).
26. "model 3 newer than this app" cases renamed to model 4 (model 3 is now known); factor above range clamps for model 4.
27. Added: model-3 factors snap to the 1.2/1.3/1.45/1.6 table (1.9 -> 1.6, 1.45 kept).

## test_parse.py (1)
28. "chole bhature stays one half-known food" replaced by "paneer tikka": chole bhature is now a matched pair (chole + bhatura), per the phase-1 fix (b).

## test_journable_ui.py (about 8)
29. Mic: visible exactly when a speech API exists (was: always hidden).
30. "exercise words only" now makes an exercise row with a kcal box and an enabled Save (was: a notice and disabled Save).
31. "Add to saved entries" in the entry menu is enabled (was a disabled placeholder).
32. Drawer probes for weekly/water/saved look for the real screens (#wk-title, #water-card, #saved-empty) instead of "coming soon" text.
33. "chole bhature" replaced by "paneer tikka" in two half-known-food checks.


# Phase 3 changes

## test_parse.py (1)
34. "explicit meal + yesterday: slot Lunch, date 2026-11-03, time 12:00" -> "... typical lunch time 13:00": on a PAST date a named meal now defaults to its typical time (breakfast 8:00, lunch 13:00, snack 17:00, dinner 20:00, late-night 23:00) instead of 12:00 (coordinator request, phase 3 item 2). New assertions added next to it for every meal, an explicit time winning, renamed/custom slots, and today keeping "now".

## test_journable_ui.py (1)
35. "drawer has Today and the ten menu items in order" -> "drawer lists Backup & restore first, then Today and the other menu items in order": Backup & restore is now the first item after the people switcher, and On-device AI and Check my phone were added.

## test_app / activity / pack / time / slots / journable_ui (6 request filters, no assertion text changed)
36. The 'no network requests' filters now also ignore requests to our own test server (http://localhost:8765/) when a suite is run over http with tests/run_http.py. On file:// the filters behave exactly as before.

## Not changed
All other assertions in the old suites pass unchanged, on file:// and also on http://localhost:8765 (tests/run_http.py).
New suites: test_phase3_ui.py (Edit as text, past-day times, drawer), test_pwa.py (service worker, offline, update flow, manifest/icons/CSP), test_llm.py (simulated model: adapter, validation, timeout/cancel, model manager, Check my phone).

# Phase 3.1 (Opus review fixes)

## test_llm.py (assertions changed, all inside the new phase-3 suite)
37. Chip with a model present but not loaded: "AI ready" -> "AI ready (loads on first use)" (the model is now loaded lazily on first use and let go after 5 idle minutes; "AI ready" is shown only while it is loaded).
38. "toggle on again loads the cached model" / "after a reload it loads again by itself" -> "does NOT load (lazy)", "first low-confidence parse loads it", "idle unload", "cancel / failure during the lazy load".
39. Quantity clamp tests: the model's qty/unit no longer overrides a typed amount ("2 roti" stays 2 whatever the model says); clamps are now tested on input without a typed amount ("zorblat roti"). New: duplicates, fragments, partial words, injected text, Check flags.
40. Model cards: "Recommended, fastest" -> a separate "Recommended" badge on exactly one card + "Fastest"; "Needs about N of free memory" -> "Download: about X. GPU memory while it runs: about Y".
41. "no adapter: could not start the GPU" -> "no usable WebGPU adapter" wording; f16 error now has its own text.
42. Check my phone: the maxBufferSize threshold is now WebLLM's 256 MB (was 1 GB) and a storage-buffers row was added; a GPU without shader-f16 is INFO (compatible q4f32 model is offered), not FAIL.
43. "nutrition never from the model" now saves and asserts the stored kcal equals the food-list value (no "or" escape); "Run test sentence" asserts the exact mocked outcome (3 items, tokens, prefill/decode tokens/s).

## test_pwa.py (1)
44. The update-flow test now creates 3 journal entries first and asserts they survive; new checks that web-llm.js stays in the unversioned journable-lib cache and still works offline after an update.

## New suite
test_phase31_ui.py: About credits always visible, weekly "no entries", import button, chip layout at 360/412.

## Old suites
test_app, hardening, slots, time, online, pack, activity, parse, journable_ui, phase2_ui, phase3_ui: no assertion changed in this round.


# v1.1 (TrackMe) - changed old assertions and why

Test helpers: `tphelpers.tn(page, selector)` reads one of the "today so far" numbers (target, burn, deficit, fibre), which now live on Daily goals instead of Today, then returns to Today.

## Moved numbers (Today -> Daily goals)
- test_app, test_activity, test_phase2_ui, test_slots, test_journable_ui, test_phase31_ui, test_phase3_ui: every read of `#t-target`, `#t-tdee`, `#t-deficit`, `#t-fibre` and the deficit explanation now goes through `tn()` / Daily goals. Reason: requirement 3 (minimal Today). The values asserted are unchanged.
- Checks on `#t-remaining`, `#t-kcal`, `#t-c` ... after scrolling use `text_content` (the big card is hidden while the compact bar is shown, and `inner_text` of a hidden element is empty). test_phase2_ui "Adjust: Burned 300 ..." is one of them. Reason: sticky collapsing summary (E).

## Removed blocks
- test_slots / test_journable_ui: assertions about the "Log a meal / Other meals" card, "Day total", the "Last 7 days" chart and empty-slot rows removed or turned into "is absent" checks (new in test_v11_ui). Reason: requirement 3.
- test_phase2_ui / test_phase31_ui: weekly-summary assertions (Consistency stats, Share, old table layout) replaced by assertions for the new tabs, tables and hand-computed numbers. Reason: requirement 4.
- test_phase2_ui: weight assertions use the new add sheet (`#wt-add`, `#w-kg`, `#w-save`). Reason: requirement 5.

## Chip, rename, version
- test_pwa, test_llm, test_journable_ui, test_phase31_ui, test_phase3_ui: chip texts are now exactly "AI ready" / "Basic" (was hidden, "AI off", "AI loading N%", "AI ready (loads on first use)"); aria-labels updated; the chip is visible and fits at 360 / 412 px. Reason: D.
- test_pwa: manifest name/short_name TrackMe; cache names are `trackme-shell-v<hash>`; the worker's cleanup checks both prefixes; new check that an old `journable-shell-*` cache is deleted on update while a foreign cache and `journable-lib` are kept. Reason: rename.
- test_llm: the Check-my-phone report starts with "TrackMe check". Reason: rename.
- test_phase31_ui: About says "Version 1.1". Reason: requirement 6.

## test_llm (AI-first, units, estimates)
- The old "rule parser first, AI only when a row is below 0.8 confidence" tests were replaced by AI-first tests: with a mock model every sentence goes through `extract`; with AI off the rules run; DB hit uses DB numbers; DB miss uses the mock estimate with the AI tag; "200 ml milk", "1 glass milk", "2 bowl dal" keep their typed units. Reason: A, B, C.
- Model-manager chip expectations changed to "AI ready" / "Basic" (see above).
- Golden harness: for `via=='split'` items the golden phrase is used (two split items of one segment were collapsed by the old key). 174 checks now.

## New suites
- `test_v11_ui.py` (text size at every screen, chip, Today removals, Daily goals numbers, sticky summary, swipe, meal detail, weight tracker, old backups, export carries new fields, new export imports into the old page, rename).
- `test_multiline.py` (golden multi-line cases, grouping, different times, marker lines, exercise lines, 12-line paste, textarea behaviour, AI-first one call per submission, Edit as text).
- `test_report.py` (PDF export, round trip, fixture import: 17 entries, day totals 2564 / 2525 / 2565 and macros, weight, water, "import new only" twice, undo, corrupt and non-report PDFs, unreadable rows).

## Old suites with no assertion changed beyond the above
hardening, online, pack, parse, time.

# v1.1 review fixes
- No existing assertion changed. New suite `test_review_v11.py` (gram amounts "(100 g)", enterkeyhint, AI weak-match vs estimate, AI name fallback/Check, unit-weight and kcal caps).

# v1.1 final fix round (after the independent review)
- test_multiline: the old "AI with two time groups -> one call per group" assertion (2 calls) is replaced by "ONE call with the whole text, two groups, items sit under the time of their own line (model order = line order and reversed), saved at 13:00 and 20:00" plus "unusable model answer -> one call, Basic rules still make two groups". Reason: fix 4 (the whole text goes to the model in one call).
- No other existing assertion changed. New suite `test_fixes11.py` (localhost:8765): full Monday-Sunday PDF tables (reference fixture period, two-week period, 92 days / repeated header rows), Consistency Stats = entries (17 for the fixture; own data with exercise), same-time entries stay separate, fractions as glyphs, round trip export -> import in a fresh profile (entry count, item count, per-day totals, fractions, same-time pair, second generation), XL undo toast at 360x740 (short and very long name, geometry vs quick-log bar and pinned summary, Large 412x915), "200 ml" on the edit screen, pdf.js / web-llm cache refresh on an app update (new lib version refreshed, same version not refetched, pre-fix install without marker refreshed, webllm/* caches untouched).
- Basic parser: "rice ½ bowl", "banana ¾" now parse (normText keeps the space before a lone fraction); covered by test_fixes11.
- scripts/build.py cap raised to 450 KB (html+js+css 401.6 KB).


# v1.1.1 (real-phone fixes)
- test_app: "banana defaults to household unit" now looks for 100 (g) instead of 120. Reason: calibration to the user's report, 1 medium banana = 105 kcal, so the household weight is 100 g (was 120 g).
- golden_parse.json: the 7 expectations `Banana, ripe` 120 g are now 100 g (g04, g42, g70, g89, g90, g97, g99). Reason: same calibration.
- test_phase3_ui: `Journable.version` is '1.1.1' (was '1.1'). Reason: version bump.
- test_journable_ui: the check name "Not this? lists up to three alternatives" is now "Change item lists ..." (the assertion itself is unchanged). Reason: button renamed to "Change item".
- test_online: (a) primary URL / fallback assertions are unchanged, but the search now has a THIRD server (in.openfoodfacts.org), so "503 on both" became "503 on all three" (3 requests, message "busy or down ... HTTP 503", was "Could not reach"); "abort/CORS" expects 3 requests and "did not get through"; "malformed JSON everywhere" expects "could not read"; the fake-clock timeout test now runs three 12 s timeouts (3 requests, "did not answer in 12 seconds"). Reason: requirement 6, specific failure reasons and a working third server (world.* cgi answers 503, search.* sends no CORS header).
- test_multiline: "AI answer unusable: one call ..." now expects 3 calls (the whole text, then one retry per line, two lines), still two time groups from the rules. Reason: requirement 1, per-line retry. "mixed commas and lines" is unchanged and still passes: in multi-line input a line is split at commas only when every fragment carries its own amount ("rice 1 bowl, dal 1 katori").
- New suite `test_v111.py`: the exact six-line input in Basic and with the AI mock (one group, six rows as typed, kcal ranges, 8:00 AM, Breakfast, no Not found, saved as one meal, counts shown as typed on Today); tolerant validation (sloppy mock answer); whole-text failure -> per-line retry (1 + 6 calls) and partial failure (5 of 6 lines); failure reason + Retry + Last AI problem (copy) + timeout + unreadable answer; comma rule; modifier words; count units and calibration (banana 105, milk 150 ml 86-95, almonds 26-30); online search with mocks (third server, 503 everywhere with Retry, blocked, bad JSON, 429, only the name is sent); service worker and CSP checks.

## v1.1.1 independent review (fixes)
- test_v111: "multi-line: a comma does not split a line ("Rice, dal 2 katori" is one line)" -> "multi-line: a comma list still splits ("Rice, dal 2 katori" + roti = 3 items)". Reason: the one-line-one-item rule lost foods ("rice, dal" -> dal only; "Lunch: rice, dal, roti 2" -> one Not found row), a regression against 1.1.0; descriptor-only fragments ("soaked (2 figs)") still join the item before them.
- test_v111 new checks: multi-line "rice, dal" keeps both; meal lines with comma lists; the AI answering with names only and unit "g" for the six lines still gives the typed amounts; `<think>` + fences + trailing commas in the JSON; no per-line retry above 8 lines.


# v1.1.2 (build/data layout, quantity basis, portions)
- All suites now load the site from the repo ROOT (`index.html`, `sw.js`, `app.js`, `manifest.webmanifest`) instead of `dist/` (tphelpers URL, serve_dist.DIST, test_online, test_v111, test_v11_ui, test_journable_ui, test_pwa label). Reason: there is no `dist/` any more. Assertions unchanged. `serve_dist.copy_site()` copies only the site files (the root also holds src/, tests/, .git ...); test_pwa, test_fixes11, shots3 use it.
- test_app, test_journable_ui, ui_helpers: the food reference data comes from `data/trackme.db` through `tests/dbdata.py` (same values) instead of `data/household_units.json` / `ifct_foods.json`, which were deleted after the database was verified.
- test_app: "raw rice: grams chip only" -> "raw rice: grams chip first, then the estimated katori / cup portions" (chips == ['g (grams)', 'katori raw (~125 g)', 'cup raw (~200 g)']). Reason: raw rice now has portions (requirement D). The next check "rice raw 100 g ~356" now first taps the grams chip, because the default unit is the first portion (katori); its intent (100 g = ~356 kcal) is unchanged.
- No other assertion changed; golden_parse.json unchanged (an early plate portion for poha/upma/khichdi that contradicted the golden "poha 1 plate = 250 g" was removed rather than the golden changed).
- New suite `test_v112.py`: db_check passes; search results state "per 100 g; ... for 1 medium banana (100 g)"; no sideways scroll and 44 px rows at 360 px; raw rice katori portion; cashew picker chip gives 6 g / 35 kcal for 4; typed "4 cashews" unchanged; Nutrition facts basis line. `scripts/db_check.mjs` (48 asserts) checks row counts against the old JSON files (524 IFCT, 74 dishes, 6 fats, 51 + 34 aliases, 13 MET), no null per-100 g values, portion sanity and that count_units agree with the picker portions.

## v1.1.2 independent review (fixes)
- No existing assertion changed. test_v112 gains six checks: typed "10 strawberries" (120 g), "10 grapes" (50 g), "1 dried apricot" (8 g), "1 guava" (1 medium guava), "1 katori guava" (katori 100 g), "2 figs" (51 g). Reason: the build now puts a raw food's own portion before the group-default katori (typed counts were 10 katori = 1 kg), and the red seeded / black oval grapes got the "10 grapes" portion.

# v1.1.3 (review items: mango, plain counts, counts above 20, aliases, basis line)
- No existing assertion changed unless listed in the final run notes below. New suite `test_v113.py` (parseLog seams + search result basis lines). `scripts/db_check.mjs`: "34 hinglish raw aliases" now counts only src='hinglish' (v1.1.3 adds raw aliases with src 'v1.1.3'); the check itself is unchanged.
- test_v112: "search result states the basis ..." regex `for 1 medium banana \(100 g\)` -> `for 1 medium banana \(~100 g\)`. Reason: item 5, an estimated portion keeps its "~" in the basis line. Intent unchanged.
- Final counts (v1.1.3 build): app 80, hardening 14, slots 70, time 63, online 60, pack 67, activity 70, parse 76, journable_ui 159, phase2_ui 211, phase3_ui 48, phase31_ui 21, v11_ui 129, multiline 50, review_v11 10, v111 57, v112 16, v113 51, pwa 62, llm 174, report 43, fixes11 70, db_check 48.


# v1.1.4 (per-unit data, household sizes, cooked vegetables)
Sizes as decided: katori stays 150 ml, bowl 275, cup 150, glass 250. Only assertions whose numbers follow from the new sizes were changed; every one is listed.
- `tests/dbdata.py`: per-100 g values and unit labels/grams are rebuilt from the new columns (kcal_1 x 100 / density, size x density) with the same rules as scripts/build.mjs; the values the tests see are the same.
- `golden_parse.json` g02 and g28 ("1 cup rice"): rice 160 g -> 130 g. Reason: cup = 150 ml x 0.867 g/ml. g14 "1 bowl curd", g23 "upma 1 bowl", g31 "curd rice 1 bowl": 150 g -> 275 g. Reason: bowl = 275 ml (user definition), density 1.0.
- test_app L84: chips `['g (grams)', 'katori raw (~125 g)', 'cup raw (~200 g)']` -> `cup raw (~125 g)`. Reason: cup 150 ml x 0.833 g/ml.
- test_v113: `katori \(150 g\)` -> `katori \(~150 g\)` (dal toor basis line). Reason: derived volume weights carry the estimate mark. Intent unchanged (katori stays grams, not ml).
- test_llm L132-137: 200 ml toned milk is 206.4 g and `MK` = kcal for 206.4 g (123 kcal, was 119); stored grams 206.4. Reason: ml uses the food's density (1.032).
- New `test_v114.py`: db_check, household sizes, per-100 g equality with the pre-migration database, idempotent re-run of seed/v113/units, parse cases for sizes/ml/cups/spoons/pieces/cooked rows, basis lines, USDA oracle rows, derived rows are estimates, ranking of palak/bhindi/spinach/okra/brinjal unchanged, About credit, picker at 360x740 light and 412x915 dark with 18 px text, old entries (katori (150 ml), cup cooked 160 g, ml 200 g) keep their numbers and survive edit+save, export with unitG 1.032 imports into the old diet-tracker.html.
- test_phase3_ui L21: `Journable.version == '1.1.1'` -> `'1.1.4'` (check renamed 'version string is 1.1.4'). Reason: release bump; the check's intent (the API reports the current version) is unchanged.

# v1.1.4 independent review (Opus, 2026-11-05)
No existing assertion changed. Added to `test_v114.py`: counts of cooked vegetables use the USDA piece ("1 boiled potato" 136 g, "2 boiled potatoes" 272 g, "3 boiled bhindi" 31.8 g, "1 boiled sweet potato" 151 g; "1 katori boiled potato" stays the katori, 99 g); plain names find the raw item first ("cabbage", "mushroom", "sweet potato", "tinda", "palak"); "boiled potato" is the potato, not sweet potato; no towelgourd row and turai is a derived estimate; the derived gourd factor is within 0.9-1.1 of raw; import_cooked with an empty folder exits 1 and leaves the DB untouched; the old diet-tracker.html really holds the imported 206.4 g ml entry (the earlier check only looked for a crash). Also: "1 small katori rice" / "large katori dal" / "chhoti katori dal" are one "small katori" / "large katori" (qty 1, 86.7 / 200 / 100 g), not "0.67 x katori".

# v1.1.5 (beverages and liquids, ml display, matching)
Every changed assertion is listed. New suite `test_v115.py`.
- `golden_parse.json` g70 ("gym 1 hour, protein shake 300ml, banana") and g86 ("protein shake 300ml"): the shake was an expected unmatched row (known gap); it is now `Protein shake, with water` 300 g and `unmatched` 0 (g70 keeps Banana 100 g). Reason: the food exists now (requirement 1).
- test_parse L149: the "(c) unmatched phrase stays a row with no food and no guess" example phrase `protein shake 300ml` -> `zorbaflux 300ml`. Reason: the old phrase now matches. Intent unchanged.
- `matcher_set.json` "green tea": expected `Tea, black` -> `Green tea`. Reason: a Green tea row exists.
- test_llm, test_fixes11, test_phase2_ui: the sample "not in the table" ml food `protein shake` (phrases 'protein shake 300ml', 'protein shake 200 ml', name 'protein shake', 'Zork Protein Shake', 'My protein shake') -> `kombucha`. Reason: protein shake is now in the table; every assertion (Not found row, AI estimate in ml, online result, custom food) is otherwise unchanged.
- test_v114: 'the 11 liquids are per ml, nothing else' now excludes the `l_` group (v1.1.5 adds 28 more), and the pre-migration comparison skips `l_` rows. Reason: new rows have no pre-migration value.
- `scripts/db_check.mjs`: 74 dish rows / 600 + cooked built foods / unique ids / the ml list exclude or add the 28 `l_` rows; the per-ml macro range is 0..1.5 (honey carbs 1.18 g per ml); the 4-decimal round trip skips `l_` rows (recipe values). 8 new checks.
- No other assertion changed.


- test_v111 (v1.1.7): the mock errors 'device lost' / 'worker died: GPU device lost' became 'generation failed' / 'worker died: out of tokens'. Reason: a device-lost error is now classified as a recoverable GPU error (reload once and ask again), which added one retry call; these two checks are about a generic failure with no reload. Intent and expected numbers unchanged (7 calls, 1 call).
- test_v111 (v1.1.7): the two checks that looked for the text 'GPU device lost' in the failure reason / Last AI problem now look for 'out of tokens' (same mock rename as above).
