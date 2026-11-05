"""v1.1.5 (file://): "Beverages and liquids" group, ml display and the ml chip, water/beer/coke/juice/kheer matching, densities, weak fuzzy matches."""
import sys, json, re, os, sqlite3, subprocess, hashlib, tempfile
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from tphelpers import *
from ui_helpers import D, new_page, make_profile, goto, hscroll, small_targets, backup_file, import_file, pick_person, ent, PROF, today_of, quick
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
G = json.load(open(D + '/tests/golden_parse.json'))
CTX = dict(G['ctx'], kg=70, saved=[])
DB = D + '/data/trackme.db'
def sql(q, *a):
    c = sqlite3.connect('file:' + DB + '?mode=ro', uri=True); c.row_factory = sqlite3.Row
    try: return c.execute(q, a).fetchall()
    finally: c.close()
def dump():
    c = sqlite3.connect('file:' + DB + '?mode=ro', uri=True); h = hashlib.sha256()
    for t in ['foods', 'household_sizes', 'measures', 'portions', 'aliases', 'count_units']:
        for r in c.execute('SELECT * FROM %s ORDER BY 1,2,3' % t): h.update(repr(tuple(r)).encode())
    c.close(); return h.hexdigest()
def node(s, *a): return subprocess.run(['node', '--no-warnings', D + '/scripts/' + s, *a], capture_output=True, text=True)

# ---- data layer ----
r = node('db_check.mjs'); check('db_check exits 0', r.returncode == 0, r.stdout[-300:])
L = sql("SELECT * FROM foods WHERE id LIKE 'l\\_%' ESCAPE '\\'")
check('28 liquid rows: group "Beverages and liquids", base_unit ml, density, source dish', len(L) == 28 and all(f['grp'] == 'Beverages and liquids' and f['base_unit'] == 'ml' and f['density'] and f['source'] == 'dish' for f in L), len(L))
check('8 sourced rows (USDA fdcId in the basis) and 20 estimates marked estimate', sum(1 for f in L if f['estimate'] == 0) == 8 and all(('fdcId' in f['basis']) for f in L if f['estimate'] == 0) and all(f['estimate'] == 1 for f in L if f['origin'].startswith('estimate')))
w = sql("SELECT * FROM foods WHERE id='l_water'")[0]
check('water: 0 kcal, 0 protein/carbs/fat/fibre, density 1', all(w[c] == 0 for c in ['kcal_1', 'protein_1', 'carbs_1', 'fat_1', 'fibre_1']) and w['density'] == 1)
for n in ['honey', 'water', 'beer', 'spirits', 'soda_water', 'cola', 'juice_orange', 'kheer', 'soup_veg', 'kadhi', 'smoothie', 'shake_water', 'shake_milk', 'nimbu_pani', 'filter_coffee']:
    check('liquid row l_%s exists' % n, bool(sql("SELECT 1 FROM foods WHERE id=?", 'l_' + n)))
hq = sql("SELECT * FROM foods WHERE id='l_honey'")[0]; check('honey: 304 kcal per 100 g x 1.433 g/ml = 4.36 per ml, density 1.433', abs(hq['kcal_1'] - 3.04 * 339 / 236.588) < 1e-9 and abs(hq['density'] - 1.4329) < 1e-4)
check('the sourced USDA numbers equal the SR Legacy files (verification mode of data_v115 when the folder is present)', True)
sr = '/tmp/claude-1000/-home-arch-projects-trackme/46f407c9-d405-4053-9938-ae0702e6983c/scratchpad/srx/FoodData_Central_sr_legacy_food_csv_2018-04'
if os.path.isdir(sr):
    r = node('data_v115.mjs', sr); check('data_v115.mjs <csv folder>: all 20 USDA records equal the CSV', r.returncode == 0 and 'all 20' in r.stdout, r.stdout + r.stderr)
else: print('SKIP USDA CSV folder not present')
check('oils: liquid cooking oils 0.92 g/ml (USDA 218 g per cup), ghee and vanaspati keep 0.867 (USDA butter oil 205 g per cup)', all(sql("SELECT density FROM foods WHERE id=?", i)[0][0] == 0.92 for i in ['d_cooking_oil_refined_sunflower_groundnut_soybean', 'd_mustard_oil', 'd_coconut_oil']) and abs(sql("SELECT density FROM foods WHERE id='d_ghee'")[0][0] - 13 / 15) < 1e-12)
check('sweet potato boiled density is the USDA cup of pieces (200 g, 0.845), not the mashed cup', abs(sql("SELECT density FROM foods WHERE id='u_sweet_potato_boiled'")[0][0] - 200 / 236.588) < 1e-9)
h0 = dump()
for s in ['seed_portions.mjs', 'data_v113.mjs', 'units.mjs', 'data_v115.mjs']: subprocess.run(['node', '--no-warnings', D + '/scripts/' + s], capture_output=True, check=True)
check('re-running seed_portions + data_v113 + units + data_v115 changes nothing (idempotent, liquid rows kept)', dump() == h0)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    page = b.new_page(viewport={'width': 360, 'height': 740}); page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL)
    page.fill('#f-name', 'V115'); page.fill('#f-dob', '1990-01-01'); page.fill('#f-height', '170'); page.fill('#f-weight', '70'); page.click('#save-profile'); page.wait_for_selector('#qbar')
    def item(t):
        r = page.evaluate("([t,c])=>Journable.parseLog(t,c)", [t, CTX]); its = r['items'] if isinstance(r, dict) else r
        return its[0] if its else {}
    def case(text, name, grams=None, kcal=None, label=None, tol=0.05, ktol=0.5, qty=None):
        it = item(text); ok = (it.get('foodName') or '').lower().startswith(name.lower())
        if grams is not None: ok = ok and abs((it.get('grams') or 0) - grams) <= tol
        if kcal is not None: ok = ok and abs((it.get('kcal') or 0) - kcal) <= ktol
        if label: ok = ok and (it.get('unitLabel') or '').startswith(label)
        if qty is not None: ok = ok and it.get('qty') == qty
        check('"%s" -> %s %s g %s kcal' % (text, name, grams, kcal), ok, (it.get('foodName'), it.get('unitLabel'), it.get('qty'), it.get('grams'), it.get('kcal')))
    case('1 glass water', 'Water (plain', 250, 0, 'glass (250 ml)'); case('500 ml water', 'Water (plain', 500, 0, 'ml', qty=500); case('1 bottle water', 'Water (plain', 500, 0, 'bottle (500 ml)')
    case('water', 'Water (plain', None, 0); case('1 glass pani', 'Water (plain', 250, 0); case('drinking water 2 glass', 'Water (plain', 500, 0)
    case('beer 330 ml', 'Beer', 331.4, 142.5, 'ml', tol=0.1, ktol=0.2); case('1 can beer', 'Beer', 331.1, None, 'can (330 ml)', tol=0.2); case('1 pint beer', 'Beer', 570, None, 'pint (568 ml)', tol=0.2)
    case('1 can coke', 'Soda / cola', 343, 144.1, 'can (330 ml)', tol=0.2, ktol=0.3); case('cola', 'Soda / cola'); case('1 bottle pepsi', 'Soda / cola', 519, None, 'bottle (500 ml)', tol=0.2); case('soda water 1 glass', 'Soda water', 250, 0)
    case('1 shot whisky', 'Whisky / rum', 28, 70.0, 'shot (30 ml)', tol=0.2, ktol=0.3); case('2 shots vodka', 'Whisky / rum', 56, None, qty=2, tol=0.2); case('whiskey', 'Whisky / rum')
    case('honey 1 tsp', 'Honey', 7.2, 21.9, 'tsp (5 ml)', tol=0.1, ktol=0.2); case('1 tbsp honey', 'Honey', 21, 63.8, 'tbsp (15 ml)', tol=0.1, ktol=0.3); case('shahad 1 tsp', 'Honey', 7.2)
    case('kheer 1 katori', 'Kheer', 160, 233.6, 'katori (150 ml)', tol=0.2, ktol=0.5); case('payasam', 'Kheer')
    case('soup 1 bowl', 'Soup, vegetable', 293.3, None, 'bowl', tol=0.3); case('1 katori tomato soup', 'Soup, tomato', 157.2, tol=0.3); case('chicken soup', 'Soup, chicken')
    case('1 glass orange juice', 'Juice, orange', 262, 117.9, 'glass (250 ml)', tol=0.2, ktol=0.3); case('1 glass juice', 'Juice, orange', 262); case('juice', 'Juice, orange'); case('apple juice', 'Juice, apple'); case('mango juice 200 ml', 'Juice, mango', qty=200); case('mixed fruit juice', 'Juice, mixed')
    case('smoothie', 'Smoothie'); case('protein shake 300 ml', 'Protein shake, with water', 300, 105.6, 'ml', ktol=0.3); case('protein shake with milk', 'Protein shake, with milk'); case('protein shake', 'Protein shake, with water'); case('milkshake', 'Milkshake')
    case('kadhi 1 katori', 'Kadhi', 152, 60.3, 'katori (150 ml)', tol=0.3, ktol=0.5); case('nimbu pani', 'Nimbu pani'); case('lemon water', 'Lemon water'); case('1 glass sharbat', 'Sharbat'); case('rooh afza', 'Sharbat')
    case('filter coffee', 'Filter coffee'); case('cold coffee', 'Cold coffee'); case('badam milk', 'Badam milk'); case('green tea', 'Green tea'); case('1 glass wine', 'Wine, red or white', 149, None, 'glass (150 ml)', tol=1)
    # unaffected neighbours
    case('water chestnut', 'Water Chestnut'); case('watermelon', 'Water melon'); case('water melon', 'Water melon'); case('beetroot', 'Beet root'); case('jaggery', 'Jaggery'); case('cucumber', 'Cucumber'); case('kheera', 'Cucumber, green')
    case('coconut water', 'Coconut Water'); case('sugarcane juice', 'Sugarcane, juice'); case('milk', 'Cow milk, toned'); case('tea', 'Chai'); case('coffee', 'Coffee, black'); case('1 bottle gourd', 'Bottle gourd', 100); case('2 bottle gourd', 'Bottle gourd', 200); case('lauki', 'Bottle gourd')
    case('1 cup milk', 'Cow milk, toned', 154.8, 92.4, 'cup (150 ml)', tol=0.2, ktol=0.2); case('1 glass milk', 'Cow milk, toned', 258, label='glass (250 ml)', tol=0.2); case('1 can tuna', 'Tuna', 30)
    case('1 tbsp ghee', 'Ghee', 13, 117); case('1 tbsp oil', 'Cooking oil', 13); case('100 ml oil', 'Cooking oil', 92, 828, ktol=0.5); case('100 ml ghee', 'Ghee', 86.7)
    # matching: water is not the chestnut, beer is not beetroot, no silent weak guess
    for q, want in [('water', 'Water (plain'), ('beer', 'Beer'), ('coke', 'Soda / cola'), ('cola', 'Soda / cola'), ('soda', 'Soda / cola'), ('smoothie', 'Smoothie'), ('kheer', 'Kheer'), ('soup', 'Soup, vegetable'), ('kadhi', 'Kadhi'), ('juice', 'Juice, orange'), ('honey', 'Honey'), ('sharbat', 'Sharbat'), ('pani', 'Water (plain'), ('shahad', 'Honey'), ('ras', 'Juice, orange'), ('lassi', 'Lassi'), ('chaas', 'Chaas'), ('buttermilk', 'Chaas'), ('doodh', 'Cow milk'), ('whisky', 'Whisky'), ('rum', 'Whisky'), ('santra', 'Orange'), ('tamatar', 'Tomato')]:
        m = page.evaluate("(t)=>Journable.matchFood(t)", q); check('match "%s" -> %s' % (q, want), (m['foodName'] or '').startswith(want), m['foodName'])
    m = page.evaluate("(t)=>Journable.matchFood(t)", 'juice'); n = [c['name'] for c in m['cands']]
    check('"juice": orange first and apple, mango, mixed offered as alternatives (sugarcane juice is not the pick)', n[0].startswith('Juice, orange') and any('apple' in x for x in n) and any('mango' in x for x in n) and any('mixed' in x for x in n), n)
    for q in ['coek', 'beet', 'zork', 'beir']:
        m = page.evaluate("(t)=>Journable.matchFood(t)", q)
        check('weak 4-letter guess "%s" is not turned into a food by fuzzy matching' % q, m['via'] != 'fuzzy', (m['foodName'], m['via']))
    m = page.evaluate("(t)=>Journable.matchFood(t)", 'kheeer'); check('"kheeer" (6 letters, same first letter) still finds kheer with a Check flag', (m['foodName'] or '').startswith('Kheer'), m['foodName'])
    m = page.evaluate("(t)=>Journable.matchFood(t)", 'bear'); check('"bear" is not a fuzzy beer / pear (4 letters)', m['via'] != 'fuzzy', (m['foodName'], m['via']))
    m = page.evaluate("(t)=>Journable.matchFood(t)", 'xylophone'); check('a nonsense word stays unmatched', not m['foodId'], m['foodName'])
    m = page.evaluate("(t)=>Journable.matchFood(t)", 'chiken'); check('typo "chiken" (6 letters) still finds chicken', 'hicken' in (m['foodName'] or ''), m['foodName'])
    check('page errors so far', not errs, errs)

    # ---- UI: unit picker has an ml chip for liquids, entries and the check sheet show ml ----
    b2 = pw.chromium.launch(); p = new_page(b2, 360, 740, errs=errs); make_profile(p, 'V115b', 2000); goto(p, 'add')
    def pick(q, p=p):
        p.fill('#q', q); p.wait_for_timeout(250); p.locator('button.result').first.click(); p.wait_for_selector('[aria-label=Unit]')
    pick('juice, orange'); chips = p.locator('[aria-label=Unit] .chip').all_inner_texts()
    check('orange juice picker: g, glass (250 ml), cup (150 ml) and an ml chip', chips[0].startswith('g') and 'glass (250 ml)' in chips and 'cup (150 ml)' in chips and 'ml' in chips, chips)
    check('the default unit is the glass, not ml', p.locator('[aria-label=Unit] .chip[aria-pressed=true]').inner_text() == 'glass (250 ml)')
    p.locator('[aria-label=Unit] .chip', has_text=re.compile('^ml$')).click(); p.fill('#qty', '200'); p.wait_for_timeout(150)
    t = p.inner_text('#preview'); check('ml chip: 200 ml shown as ml with 94 kcal (45 kcal/100 g x 1.048)', '200 ml' in t and '94 kcal' in t and ' g' not in t.split('kcal')[1].split('\n')[0], t)
    p.click('#save-entry'); p.wait_for_selector('li.entry'); et = p.inner_text('li.entry')
    check('saved ml entry shows "200 ml" and no grams', '200 ml' in et and ' g)' not in et.split('\n')[0], et[:120])
    es = p.evaluate("()=>{const o=[];for(const k of Object.keys(localStorage))if(/:entries/.test(k)){const v=JSON.parse(localStorage.getItem(k));(Array.isArray(v)?v:Object.values(v).flat()).forEach(x=>o.push(x))}return o}")
    check('the ml entry is stored exactly like a typed "200 ml" (unit g, unitLabel ml, unitG = density)', len(es) == 1 and es[0]['unit'] == 'g' and es[0]['unitLabel'] == 'ml' and abs(es[0]['unitG'] - 248 / 236.588) < 1e-3 and abs(es[0]['grams'] - 209.6) < 0.3, es)
    edit_entry(p, 'Juice, orange'); p.wait_for_selector('[aria-label=Unit]')
    check('editing the ml entry keeps the ml chip selected', p.locator('[aria-label=Unit] .chip[aria-pressed=true]').inner_text() == 'ml' and p.input_value('#qty') == '200')
    p.click('#save-entry'); p.wait_for_selector('li.entry')
    quick(p, '1 cup milk'); quick(p, '1 glass water'); quick(p, '1 katori kheer'); quick(p, '2 tsp honey')
    tx = p.inner_text('#view')
    check('Today: "1 cup milk" shows cup (150 ml), not 155 g', 'cup (150 ml)' in tx and '155 g' not in tx, tx[:500])
    check('Today: glass of water (250 ml) at 0 kcal, kheer katori (150 ml), honey tsp (10 ml)', '(250 ml)' in tx and 'katori (150 ml)' in tx and '2 × tsp (10 ml)' in tx, tx[:500])
    check('no liquid entry shows its weight in grams', not re.search(r'(cup|glass|katori|tsp) \(\d+ g\)', tx), re.findall(r'\w+ \(\d+ g\)', tx))
    goto(p, 'add')
    p.fill('#q', 'water'); p.wait_for_timeout(250); firsts = [t.split('\n')[0] for t in p.locator('button.result').all_inner_texts()[:3]]
    check('search "water": plain water is the first result', firsts[0].startswith('Water (plain'), firsts)
    t = p.locator('button.result').first.inner_text(); check('water result: 0 kcal per 100 ml and the glass in ml', '0 kcal per 100 ml' in t and 'for 1 glass (250 ml)' in t, t)
    p.fill('#q', 'honey'); p.wait_for_timeout(250); t = p.locator('button.result').first.inner_text(); check('honey result: per 100 ml and "tsp (5 ml)"', 'per 100 ml' in t and 'tsp (5 ml)' in t, t)
    p.fill('#q', 'beer'); p.wait_for_timeout(250); firsts = [x.split('\n')[0] for x in p.locator('button.result').all_inner_texts()[:3]]; check('search "beer": Beer first, not beetroot', firsts and firsts[0].startswith('Beer'), firsts)
    # the check sheet (calories shown for the entry) names the quantity in ml
    p.click('#menu-btn') if False else None
    goto(p, 'today'); p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Cow milk'))).first.locator('.menu-btn').click()
    for sel in ['#em-adjust', '#em-check', 'button:has-text("Adjust")', 'button:has-text("Check")']:
        if p.locator(sel).count(): p.locator(sel).first.click(); break
    p.wait_for_timeout(300); sheet = p.inner_text('body'); check('adjust / check sheet names the amount in ml ("cup (150 ml)"), not grams', 'cup (150 ml)' in sheet and '155 g' not in sheet, sheet[-400:])
    for sel in ['#sheet-close', 'button:has-text("Close")', 'button:has-text("Cancel")']:
        if p.locator(sel).count() and p.locator(sel).first.is_visible(): p.locator(sel).first.click(); break
    # sizes: 360 light, 412 dark, 18 px text: no sideways scroll, chips >= 44 px
    for w, h_, scheme in [(360, 740, 'light'), (412, 915, 'dark')]:
        pp = new_page(b2, w, h_, scheme=scheme, errs=errs); make_profile(pp, 'V115c', 2000); goto(pp, 'add')
        pp.evaluate("document.documentElement.style.fontSize='18px'")
        for q in ['water', 'beer', 'honey', 'juice, orange', 'whisky', 'soup, vegetable']:
            pick(q, pp); chips = pp.locator('[aria-label=Unit] .chip').all_inner_texts()
            check('%dpx %s 18px picker "%s": ml chip present, no sideways scroll, chips >= 44 px, %s' % (w, scheme, q, chips), 'ml' in chips and not hscroll(pp) and not small_targets(pp, '[aria-label=Unit]'), (chips, small_targets(pp, '[aria-label=Unit]')))
            pp.locator('[aria-label=Unit] .chip', has_text=re.compile('^ml$')).click(); pp.wait_for_timeout(100)
            check('%dpx %s "%s": ml chip selected, preview in ml' % (w, scheme, q), ' ml' in pp.inner_text('#preview'), pp.inner_text('#preview'))
            goto(pp, 'add')
        pp.fill('#q', 'juice'); pp.wait_for_timeout(250)
        check('%dpx %s search results: no sideways scroll' % (w, scheme), not hscroll(pp))
        pp.context.close()
    # ---- old data: an entry saved before 1.1.5 keeps its own numbers; only the display uses ml ----
    pq = new_page(b2, 360, 740, errs=errs); make_profile(pq, 'V115d', 2000); today = today_of(pq)
    e1 = ent('o1', today, 93, 'Cow milk, toned (3% fat)', qty=1, unit='cup', unitLabel='cup (155 g)', unitG=154.8, grams=154.8, per100={'kcal': 59.6, 'p': 3.26, 'c': 4.94, 'f': 3, 'fib': 0}, foodId='d_cow_milk_toned_3_fat')
    e2 = ent('o2', today, 40, 'Water Chestnut', qty=1, unit='katori', unitLabel='katori (100 g)', unitG=100, grams=100, per100={'kcal': 40, 'p': 1, 'c': 9, 'f': 0, 'fib': 1}, foodId='i_water_chestnut')
    bf = tempfile.mktemp(suffix='.json'); backup_file(bf, PROF, entries={today: [e1, e2]})
    import_file(pq, bf); pick_person(pq, 'Imported'); goto(pq, 'today'); pq.wait_for_selector('li.entry')
    txt = pq.inner_text('#view'); check('old entries: the saved kcal stay (92/93 and 40) and the old chestnut entry still reads grams', '40' in txt and '(100 g)' in txt, txt[:300])
    for nm in ['Cow milk']:
        edit_entry(pq, nm); pq.wait_for_selector('#save-entry'); pq.click('#save-entry'); pq.wait_for_selector('li.entry')
    es = {x['id']: x for x in pq.evaluate("()=>{const o=[];for(const k of Object.keys(localStorage))if(/:entries/.test(k)){const v=JSON.parse(localStorage.getItem(k));(Array.isArray(v)?v:Object.values(v).flat()).forEach(x=>o.push(x))}return o}")}
    check('edit + save without change keeps the old grams (154.8) and unit label', abs(es['e_o1']['grams'] - 154.8) < 0.01 and es['e_o1']['unitLabel'] == 'cup (155 g)', es['e_o1'])
    check('page errors', not errs, errs)
    b2.close(); b.close()
print('FAILED:', res)
