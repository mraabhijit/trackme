"""v1.1.4 (file://): per-unit storage, household sizes, densities, pieces, cooked vegetables (USDA + derived), old entries untouched."""
import sys, json, re, os, sqlite3, subprocess, hashlib, tempfile
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from tphelpers import *
from ui_helpers import D, OLD, new_page, make_profile, goto, hscroll, small_targets, backup_file, import_file, pick_person, ent, PROF, today_of
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
G = json.load(open(D + '/tests/golden_parse.json'))
CTX = dict(G['ctx'], kg=70, saved=[])
DB = D + '/data/trackme.db'
def sql(q, *a, db=DB):
    c = sqlite3.connect('file:' + db + '?mode=ro', uri=True); c.row_factory = sqlite3.Row
    try: return c.execute(q, a).fetchall()
    finally: c.close()
def dump():
    c = sqlite3.connect('file:' + DB + '?mode=ro', uri=True); h = hashlib.sha256()
    for t in ['foods', 'household_sizes', 'measures', 'portions', 'aliases', 'count_units']:
        for r in c.execute('SELECT * FROM %s ORDER BY 1,2,3' % t): h.update(repr(tuple(r)).encode())
    c.close(); return h.hexdigest()

# ---- data layer ----
r = subprocess.run(['node', '--no-warnings', D + '/scripts/db_check.mjs'], capture_output=True, text=True)
check('db_check exits 0', r.returncode == 0, r.stdout[-300:])
check('household_sizes: tsp 5, tbsp 15, cup 150, small katori 100, katori 150, large katori 200, bowl 275, glass 250', {x['key']: x['ml'] for x in sql('SELECT * FROM household_sizes')} == {'tsp': 5, 'tbsp': 15, 'cup': 150, 'katori_s': 100, 'katori': 150, 'katori_l': 200, 'bowl': 275, 'glass': 250})
bj = sql("SELECT kcal_1 FROM foods WHERE id='i_bajra'")[0][0]; check('Bajra kcal_1 x 100 = 348', abs(bj * 100 - 348) < 1e-9, bj)
tm = sql("SELECT kcal_1, density FROM foods WHERE id='d_cow_milk_toned_3_fat'")[0]; check('toned milk: 59.6 kcal per 100 g from the per-ml value', abs(tm[0] * 100 / tm[1] - 59.6) < 1e-9)
check('the 11 liquids are per ml, nothing else (v1.1.5: besides the l_ group)', len(sql("SELECT id FROM foods WHERE base_unit='ml' AND id NOT LIKE 'l\\_%' ESCAPE '\\'")) == 11)
check('volume rows store no grams (computed from size x density)', not sql("SELECT 1 FROM portions WHERE kind='volume' AND grams IS NOT NULL UNION SELECT 1 FROM measures WHERE kind='volume' AND grams IS NOT NULL"))
pre = D + '/data/trackme.pre-units.db'
if os.path.exists(pre):
    old = {r['id']: r for r in sql('SELECT * FROM foods', db=pre)}
    ok = True; bad = None
    for r in sql("SELECT * FROM foods WHERE source!='cooked' AND id NOT LIKE 'l\\_%' ESCAPE '\\'"):
        o = old[r['id']]
        for c, cc in zip(['kcal', 'protein', 'carbs', 'fat', 'fibre'], ['kcal_1', 'protein_1', 'carbs_1', 'fat_1', 'fibre_1']):
            v = float('%.12g' % (r[cc] * 100 / (r['density'] if r['base_unit'] == 'ml' else 1)))
            if v != o[c]: ok = False; bad = (r['id'], c, v, o[c])
    check('all 604 per-100 g values equal the pre-migration values exactly', ok, bad)
else: print('SKIP pre-units backup not present')
h0 = dump0 = dump()
for s in ['seed_portions.mjs', 'data_v113.mjs', 'units.mjs']: subprocess.run(['node', '--no-warnings', D + '/scripts/' + s], capture_output=True, check=True)
check('re-running seed_portions + data_v113 + units changes nothing (idempotent)', dump() == h0)
check('no towelgourd row (USDA boiled record is not the raw material: 56 vs 20 kcal); turai is a derived estimate', not sql("SELECT 1 FROM foods WHERE basis LIKE '%fdcId 168415%'") and sql("SELECT estimate FROM foods WHERE id='u_ridge_gourd_boiled_est'")[0][0] == 1)
for est, raw in [('u_tinda_boiled_est', 'i_tinda_tender'), ('u_parwar_boiled_est', 'i_parwar'), ('u_ridge_gourd_boiled_est', 'i_ridge_gourd')]:
    k = sql("SELECT kcal_1 FROM foods WHERE id=?", est)[0][0] / sql("SELECT kcal_1 FROM foods WHERE id=?", raw)[0][0]
    check('derived gourd %s: boiling factor within 0.9-1.1 of raw (got %.3f)' % (est, k), 0.9 <= k <= 1.1)
r = subprocess.run(['node', '--no-warnings', D + '/scripts/import_cooked.mjs', tempfile.mkdtemp()], capture_output=True, text=True)
check('import_cooked with an empty folder exits 1, names the missing files, DB untouched', r.returncode == 1 and 'food_nutrient.csv' in r.stderr and dump() == dump0, r.stderr[-200:])
check('pieces: food_pieces view gives per-piece macros for brinjal/tinda/parwar', len(sql("SELECT 1 FROM food_pieces WHERE id IN ('i_brinjal_5','i_tinda_tender','i_parwar') AND kcal_pc>0")) == 3)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    page = b.new_page(viewport={'width': 360, 'height': 740}); page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL)
    page.fill('#f-name', 'V114'); page.fill('#f-dob', '1990-01-01'); page.fill('#f-height', '170'); page.fill('#f-weight', '70'); page.click('#save-profile'); page.wait_for_selector('#qbar')
    def item(t):
        r = page.evaluate("([t,c])=>Journable.parseLog(t,c)", [t, CTX]); its = r['items'] if isinstance(r, dict) else r
        return its[0] if its else {}
    def case(text, name, grams=None, label=None, tol=0.05, unit=None, qty=None):
        it = item(text); ok = name.lower() in (it.get('foodName') or '').lower()
        if grams is not None: ok = ok and abs((it.get('grams') or 0) - grams) <= tol
        if label: ok = ok and (it.get('unitLabel') or '').startswith(label)
        if unit: ok = ok and it.get('unitLabel') == unit
        if qty is not None: ok = ok and it.get('qty') == qty
        check('"%s" -> %s %s g' % (text, name, grams), ok, (it.get('foodName'), it.get('unitLabel'), it.get('qty'), it.get('grams')))
    # sizes (medium katori stays 150 ml: user decision)
    case('1 katori dal', 'Dal (toor)', 150, '1 katori' if False else 'katori'); case('small katori dal', 'Dal (toor)', 100); case('large katori dal', 'Dal (toor)', 200)
    case('half katori dal', 'Dal (toor)', 75); case('1 bowl dal', 'Dal (toor)', 275, 'bowl'); case('oats 1 bowl', 'Oats', 250)
    case('1 bowl rice', 'Plain rice', 238.3, 'bowl', tol=0.1); case('1 bowl curd', 'Curd / dahi', 275, 'bowl')
    case('200 ml milk', 'Cow milk, toned', 206.4, unit='ml', qty=200); case('1 l milk', 'Cow milk, toned', 1032); case('1 glass milk', 'Cow milk, toned', 258)
    case('200 ml chicken', 'Chicken', 200); case('1 katori chicken', 'Chicken', 150)
    case('1 cup tea', 'Tea', 150); case('1 cup chai', 'Chai', 150); case('1 cup milk', 'Cow milk, toned', 154.8, tol=0.5); case('1 cup rice', 'Plain rice', 130)
    case('1 tbsp ghee', 'Ghee', 13); case('2 tbsp ghee', 'Ghee', 26); case('1 tsp ghee', 'Ghee', 4.5)
    case('4 cashews', 'Cashew', 6); case('5 bhindi', 'Ladies finger', 50); case('10 grapes', 'Grapes', 50)
    # pieces (S4)
    case('2 tinda', 'Tinda', 100); case('3 parwar', 'Parwar', 90); case('1 brinjal', 'Brinjal', 100); case('2 capsicum red', 'Capsicum, red', 200)
    # cooked vegetables
    case('boiled spinach', 'Spinach, boiled (palak)'); case('1 katori boiled spinach', 'Spinach, boiled (palak)', 114, 'katori')
    case('100 g boiled spinach', 'Spinach, boiled (palak)', 100)
    # review fixes: counts of cooked vegetables use the USDA piece; "boiled potato" is the potato; plain names stay raw
    case('1 boiled potato', 'Potato, boiled (aloo', 136, 'medium potato'); case('2 boiled potatoes', 'Potato, boiled (aloo', 272); case('1 katori boiled potato', 'Potato, boiled (aloo', 99, 'katori')
    case('1 small katori rice', 'Plain rice', 86.7, unit='small katori', qty=1); case('large katori dal', 'Dal (toor)', 200, unit='large katori', qty=1); case('chhoti katori dal', 'Dal (toor)', 100, unit='small katori')
    case('3 boiled bhindi', 'Okra, boiled', 31.8, tol=0.05); case('1 boiled sweet potato', 'Sweet potato, boiled', 151)
    for q, want in [('cabbage', 'Cabbage, green'), ('mushroom', 'Button mushroom'), ('sweet potato', 'Sweet potato, pink skin'), ('tinda', 'Tinda, tender'), ('palak', 'Spinach'), ('boiled potato', 'Potato, boiled (aloo'), ('lauki', 'Bottle gourd, boiled')]:
        m = page.evaluate("(t)=>Journable.matchFood(t).foodName", q); check('match "%s" -> %s' % (q, want), (m or '').startswith(want), m)
    check('page errors so far', not errs, errs)
    b2 = pw.chromium.launch(); p = new_page(b2, 360, 740, errs=errs); make_profile(p, 'V114b', 2000); goto(p, 'add')
    def basis(q):
        p.fill('#q', q); p.wait_for_timeout(250); return p.locator('button.result').first.inner_text()
    def firsts(q, n=4):
        p.fill('#q', q); p.wait_for_timeout(250); return [t.split('\n')[0] for t in p.locator('button.result').all_inner_texts()[:n]]
    t = basis('milk, cow, whole'); check('milk shows "per 100 ml" and the glass in ml', 'per 100 ml' in t and 'for 1 glass (250 ml)' in t, t)
    t = basis('dal toor'); check('dal: "for 1 katori (~150 g)"', 'for 1 katori (~150 g)' in t, t)
    t = basis('boiled spinach'); check('cooked spinach: tag USDA, 23 kcal per 100 g, katori ~114 g', 'USDA' in t and '23 kcal per 100 g' in t and '(~114 g' in t, t)
    t = basis('tinda boiled'); check('derived cooked row: tag estimate, katori shows ~', 'estimate' in t.lower() and 'katori (~' in t, t)
    for q, banned in [('palak', 'boiled'), ('bhindi', 'boiled'), ('spinach', 'boiled'), ('okra', 'boiled'), ('brinjal', 'boiled'), ('cauliflower', 'boiled'), ('baingan', 'boiled')]:
        f = firsts(q, 1); check('search "%s": the first result is not a cooked row' % q, f and banned not in f[0].lower(), f)
    f = firsts('boiled spinach', 3); check('search "boiled spinach" finds the cooked row among the first 3', any('Spinach, boiled (palak)' in x for x in f), f)
    f = firsts('lauki boiled', 3); check('search "lauki boiled" finds the cooked row', any('Bottle gourd, boiled (lauki, dudhi)' in x for x in f), f)
    # the oracle rows, from the page's own food list
    oracle = {'Spinach, boiled (palak)': (23, 2.97, 3.75, .26, 2.4), 'Cauliflower, boiled (gobi)': (23, 1.84, 4.11, .45, 2.3), 'Okra, boiled (bhindi)': (22, 1.87, 4.51, .21, 2.5), 'Eggplant, boiled (brinjal, baingan)': (35, .83, 8.73, .23, 2.5)}
    for n, o in oracle.items():
        r = sql("SELECT * FROM foods WHERE name=?", n)[0]
        v = [r[c] * 100 for c in ['kcal_1', 'protein_1', 'carbs_1', 'fat_1', 'fibre_1']]
        check('USDA oracle %s: kcal/protein/fat/fibre as published, carbs = by difference minus fibre' % n, abs(v[0] - o[0]) < 1e-6 and abs(v[1] - o[1]) < 1e-6 and abs(v[2] - (o[2] - o[4])) < 1e-6 and abs(v[3] - o[3]) < 1e-6 and abs(v[4] - o[4]) < 1e-6, v)
    check('derived rows: estimate=1 and the basis says ESTIMATE and names the method', all(r['estimate'] == 1 and 'ESTIMATE' in r['basis'] and 'ratio' in r['basis'] for r in sql("SELECT * FROM foods WHERE id LIKE 'u\\_%\\_est' ESCAPE '\\'")) and len(sql("SELECT 1 FROM foods WHERE id LIKE 'u\\_%\\_est' ESCAPE '\\'")) >= 5)
    check('sourced cooked rows: estimate=0 and name the fdcId', all(r['estimate'] == 0 and 'fdcId' in r['basis'] for r in sql("SELECT * FROM foods WHERE source='cooked' AND origin LIKE 'USDA%'")))
    goto(p, 'about'); check('About: USDA FoodData Central credit', 'USDA FoodData Central' in p.inner_text('#fdc-credit') and 'Version 1.1.4' in p.inner_text('#view'))
    check('About: What\'s new has 3 to 6 bullets', 3 <= p.locator('#whatsnew li').count() <= 6)
    # picker at both phone sizes, light and dark, XL text: no sideways scroll, 44 px chips
    for w, h_, scheme in [(360, 740, 'light'), (412, 915, 'dark')]:
        pp = new_page(b2, w, h_, scheme=scheme, errs=errs); make_profile(pp, 'V114c', 2000); goto(pp, 'add')
        pp.evaluate("document.documentElement.style.fontSize='18px'")
        for q in ['rice, raw, milled', 'dal toor', 'milk, cow, whole', 'boiled spinach']:
            pp.fill('#q', q); pp.wait_for_timeout(250); pp.locator('button.result').first.click(); pp.wait_for_selector('[aria-label=Unit]')
            chips = pp.locator('[aria-label=Unit] .chip').all_inner_texts()
            check('%dpx %s picker "%s": no sideways scroll, chips >= 44 px, labels %s' % (w, scheme, q, chips), not hscroll(pp) and not small_targets(pp, '[aria-label=Unit]'), small_targets(pp, '[aria-label=Unit]'))
            pp.click('#menu-btn') if False else None
            goto(pp, 'add')
        pp.context.close()
    # ---- saved entries are untouched: an OLD backup (katori = 150 ml label, 1 cup cooked 160 g) ----
    pq = new_page(b2, 360, 740, errs=errs); make_profile(pq, 'V114d', 2000); today = today_of(pq)
    e1 = ent('o1', today, 165, 'Dal (toor), cooked, light tadka', qty=1, unit='katori', unitLabel='katori (150 ml)', unitG=150, grams=150, per100={'kcal': 110, 'p': 6.2, 'c': 15, 'f': 3, 'fib': 2}, foodId='d_dal_toor_cooked_light_tadka')
    e2 = ent('o2', today, 256, 'Plain rice, cooked (white)', qty=1, unit='cup', unitLabel='cup cooked', unitG=160, grams=160, per100={'kcal': 132, 'p': 2.94, 'c': 28.98, 'f': 0.19, 'fib': 1.04}, foodId='d_plain_rice_cooked_white')
    e3 = ent('o3', today, 119, 'Cow milk, toned (3% fat)', qty=200, unit='g', unitLabel='ml', unitG=1, grams=200, per100={'kcal': 59.6, 'p': 3.26, 'c': 4.94, 'f': 3, 'fib': 0}, foodId='d_cow_milk_toned_3_fat')
    bf = tempfile.mktemp(suffix='.json'); backup_file(bf, PROF, entries={today: [e1, e2, e3]})
    import_file(pq, bf); pick_person(pq, 'Imported'); goto(pq, 'today'); pq.wait_for_selector('li.entry')
    txt = pq.inner_text('#view'); check('old entries keep their numbers on Today (165, 211 and 119 kcal)', '165' in txt and '211' in txt and '119' in txt, txt[:400])
    def entries():
        return pq.evaluate("()=>{const out=[];for(const k of Object.keys(localStorage))if(/:entries/.test(k)){const v=JSON.parse(localStorage.getItem(k));(Array.isArray(v)?v:Object.values(v).flat()).forEach(x=>out.push(x))}return out}")
    for nm in ['Dal (toor)', 'Plain rice', 'Cow milk']:
        edit_entry(pq, nm); pq.wait_for_selector('#save-entry'); pq.click('#save-entry'); pq.wait_for_selector('li.entry')
    es = {x['id']: x for x in entries()}
    check('edit + save without change keeps grams (150, 160, 200) and unit labels', es['e_o1']['grams'] == 150 and es['e_o2']['grams'] == 160 and es['e_o3']['grams'] == 200 and es['e_o2']['unitLabel'] == 'cup cooked' and es['e_o1']['unitLabel'] == 'katori (150 ml)', {k: (v['grams'], v['unitLabel']) for k, v in es.items()})
    # export from the new build, import into the OLD app with a ml entry carrying unitG 1.032
    e4 = ent('o4', today, 123, 'Cow milk, toned (3% fat)', qty=200, unit='g', unitLabel='ml', unitG=1.032, grams=206.4, per100={'kcal': 59.6, 'p': 3.26, 'c': 4.94, 'f': 3, 'fib': 0}, foodId='d_cow_milk_toned_3_fat')
    bf2 = tempfile.mktemp(suffix='.json'); backup_file(bf2, PROF, entries={today: [e4]})
    import_file(pq, bf2); goto(pq, 'backup')
    with pq.expect_download() as dl: pq.click('#export-all')
    dl.value.save_as('/tmp/v114_export.json'); data = json.load(open('/tmp/v114_export.json'))
    allent = [x for pr in data['profiles'] for v in pr['entries'].values() for x in v]
    check('export holds the ml entry with unitG 1.032', any(x['unitG'] == 1.032 for x in allent))
    ctx = b2.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True); po = ctx.new_page(); oe = []
    po.on('pageerror', lambda e: oe.append(str(e)))
    po.goto(OLD)
    po.wait_for_selector('#import-file, input[type=file]', state='attached')
    po.set_input_files('input[type=file]', '/tmp/v114_export.json'); po.wait_for_timeout(500)
    for sel in ['#import-apply', 'button:has-text("Import")']:
        if po.locator(sel).count(): po.locator(sel).first.click(); break
    po.wait_for_timeout(800)
    check('cross-version: the OLD diet-tracker.html imports the new export without a crash', 'Something went wrong' not in po.inner_text('body') and not oe, (oe, po.inner_text('body')[:200]))
    og = po.evaluate("()=>{const out=[];for(const k of Object.keys(localStorage))if(/:entries/.test(k)){const v=JSON.parse(localStorage.getItem(k));(Array.isArray(v)?v:Object.values(v).flat()).forEach(x=>out.push(x))}return out}")
    check('cross-version: the OLD page really holds the imported ml entry (206.4 g)', any(abs((x.get('grams') or 0) - 206.4) < 1e-9 for x in og), len(og))
    ctx.close()
    check('page errors', not errs, errs)
    b2.close(); b.close()
print('FAILED:', res)
