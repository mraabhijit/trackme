# Changelog

All notable changes to TrackMe (the app folder is still called `journable/`). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). From now on every change ends with an entry here.

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
