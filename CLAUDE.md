# TrackMe: project rules for Claude Code

Personal, self-use diet-journal PWA (static site, localStorage, optional on-device LLM). Read `HANDOFF.md` first every session; rewrite it after each major step and at about 75 / 90 / 95 % of the session limits (summary, checkpoint, next steps). Every user-visible change gets a `CHANGELOG.md` entry; every changed old test assertion is logged in `tests/CHANGES.md`. Ask me short questions only for decisions that are mine; otherwise decide, say so, and carry on. Never commit or push without showing me the diff first. Say plainly what you could not verify (real phone, real WebGPU model, other apps' PDFs).

## Model routing: stages and workers
Work in stages. Each stage runs as its own subagent on the model shown, and hands over a short written result (files changed, test counts, open questions).

| Stage | Model | Does |
|---|---|---|
| 1. Research / lookups | **Haiku** | web searches (API docs, endpoints, food data), reading docs, grep-style fact finding, trivial edits (renames, copy changes), collecting file lists. Returns facts with source URLs, no opinions. |
| 2. Plan | **Opus** | splits the task into steps, finds risks and edge cases, writes the spec and the test plan before any code. Skip only for one-line fixes. |
| 3. Build | **Sonnet** | writes code and tests from the spec, runs the build and test suites, fixes failures, updates CHANGELOG / CHANGES / HANDOFF. |
| 4. Critical review | **Opus** (a fresh agent that did not write the code) | reads the diff, reruns every suite itself, takes screenshots and looks at them, tries to break it (bad AI output, odd input, old backups, 360 px, XL text), reports bugs by severity. Fixes go back to stage 3. |
| 5. Verify and hand over | you (main session) | re-run the key suites, look at the screenshots, confirm the claims, then show me the diff, the test counts and the honest gaps. |

Rules: no stage grades its own work; run independent workers in parallel (several Haiku lookups at once); do not start another worker for a task that is still running; keep briefs self-contained (a worker does not see this chat).

## Non-negotiables
- Storage namespace `dt:v1:*` stays; schema changes are additive only; old backups (also "Journable"-labelled) import; new exports still import into the old `diet-tracker.html` without crashing.
- User and model text is rendered with `textContent` only. No CDN, no analytics, no accounts; only the model download and the optional Open Food Facts search leave the device.
- Nutrition: food table first; if not found, AI estimate shown with an "AI" tag, never auto-saved. Units stay as the user typed them. All text goes to the AI when a model is on; the rule parser ("Basic") is only the fallback. Header chip: "AI ready" or "Basic".
- Mobile first: 360x740 and 412x915, light and dark, text sizes 13 / 14 (default) / 16 / 18 px, no horizontal scroll, tap targets at least 44 px.
- Keep html+js+css under the cap in `scripts/build.mjs` (450 KB); lazy-load rare code.

## Commands
- Once: `bash scripts/relocate_paths.sh`; `pip install playwright && playwright install chromium`; `poppler-utils` for the PDF tests.
- Build: `node scripts/build.mjs` (Node 22.13+: `node:sqlite` without a flag and its `readOnly` option; no npm packages; reads `src/` and `data/trackme.db`, writes the site into the repo ROOT: index.html, app.js, app.css, sw.js, manifest, workers, icons/, .nojekyll, and `trackme-site.zip`). README.md, CHANGELOG.md and vendor/ at the root are hand-kept sources the build never touches. There is no `dist/`.
- Data: `data/trackme.db` (SQLite; tables foods, household_sizes, measures, portions, aliases, met_activities, met_meta, count_units; view food_pieces) is the only food data. Nutrition is stored PER 1 g (liquids: per 1 ml, `base_unit='ml'` + `density`) in `kcal_1 .. fibre_1`; the build turns it back into per-100 g for the app. A katori/cup/glass/tsp/tbsp portion is a `kind='volume'` row (size key from `household_sizes`, or own `ml`) whose grams are `ml x foods.density` at build time. Edit with SQL or the scripts. Pipeline (re-runnable): `node scripts/seed_portions.mjs`, `scripts/data_v113.mjs`, `scripts/units.mjs` (the v1.1.4 migration; backs up to `data/trackme.pre-units.db`), `scripts/import_cooked.mjs <USDA SR Legacy CSV folder>` (cooked vegetables; list in `scripts/cooked_list.mjs`), then `node scripts/db_check.mjs` and the build. `scripts/import_json_to_db.mjs` is the one-off that created the first DB (kept for provenance). Licence/method notes: `docs/UNITS_SOURCES.md`.
- Icons: `scripts/make_icons.py` (Playwright) renders `src/icons/*.png`; run it only when the SVGs change.
- Tests (`.venv/bin/python tests/test_<name>.py`, run from anywhere; suites that need a server start their own on :8765): plain Python scripts in `tests/` that print PASS lines and `FAILED: []`; `test_pwa`, `test_llm`, `test_report`, `test_fixes11`, `test_review_v11` need the local server (`tests/run_http.py` shows how). Record real PASS counts.
