"""v1.1.3 (file://): plain counts of countable nouns, mango/alias fixes, counts above 20 stay pieces, estimate marker and ml in the basis line."""
import sys, json, re
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from tphelpers import *
from ui_helpers import D, new_page, make_profile, goto
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
G = json.load(open(D + '/tests/golden_parse.json'))
CTX = dict(G['ctx'], kg=70, saved=[])

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    page = b.new_page(viewport={'width': 360, 'height': 740}); page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL)
    page.fill('#f-name', 'V113'); page.fill('#f-dob', '1990-01-01'); page.fill('#f-height', '170'); page.fill('#f-weight', '70'); page.click('#save-profile'); page.wait_for_selector('#qbar')
    def item(t):
        r = page.evaluate("([t,c])=>Journable.parseLog(t,c)", [t, CTX])
        its = r['items'] if isinstance(r, dict) else r
        return its[0] if its else {}
    def case(text, name, grams=None, label=None, tol=0.5):
        it = item(text); ok = name.lower() in (it.get('foodName') or '').lower()
        if grams is not None: ok = ok and abs((it.get('grams') or 0) - grams) <= tol
        if label: ok = ok and label in (it.get('unitLabel') or '')
        check('"%s" -> %s%s' % (text, name, '' if grams is None else ' %s g' % grams), ok, (it.get('foodName'), it.get('unitLabel'), it.get('grams')))
    # 1 mango
    case('1 mango', 'Mango, ripe', 180, 'medium mango'); case('mango', 'Mango, ripe'); case('aam', 'Mango, ripe')
    case('mangosteen', 'Mangosteen'); case('1 mango ginger', 'Mango ginger')
    # 2 plain counts of countable nouns
    case('5 bhindi', 'Ladies finger', 50); case('bhindi sabzi 1 katori', 'Bhindi sabzi', 100, 'katori'); case('bhindi sabzi 2', 'Bhindi sabzi', 200)
    case('3 tomatoes', 'Tomato', 360); case('2 onions', 'Onion', 220); case('4 green chillies', 'Chillies, green', 20); case('2 green chillies', 'Chillies, green', 10)
    case('2 country eggs', 'Egg, country hen, whole', 90); case('country egg omelette', 'omelette'); case('egg 2', 'Egg, boiled', 100); case('omelette 1', 'Egg omelette', 100)
    case('2 roti', 'Roti', 70); case('dal 1 katori', 'Dal (toor)', 150); case('rice 100', 'Plain rice', 100); case('egg curry 2', 'Egg curry', 300)
    # 3 counts stay pieces up to 200 for small countable pieces, grams for the rest
    case('25 grapes', 'Grapes', 125); case('30 raisins', 'Raisins', 15); case('20 almonds', 'Almonds', 24); case('25 cashews', 'Cashew', 37.5)
    case('rice 25', 'Plain rice', 25); case('banana 100', 'Banana', 100); case('100 g grapes', 'Grapes', 100)
    # 4 aliases
    case('jeera', 'Cumin seeds'); case('1 tsp jeera', 'Cumin seeds', 2); case('chikoo', 'Sapota', 80); case('1 chikoo', 'Sapota', 80); case('amla', 'Goosberry', 20)
    case('mosambi', 'Lime, sweet, pulp', 120); case('sesame', 'Gingelly seeds, white'); case('til', 'Gingelly seeds, white'); case('1 tsp sesame', 'Gingelly', 4)
    case('peanuts', 'Ground nut'); case('10 peanuts', 'Ground nut', 8); case('moongphali', 'Ground nut'); case('groundnut', 'Ground nut'); case('1 handful peanuts', 'Ground nut', 30)
    case('watermelon', 'Water melon'); case('1 slice watermelon', 'Water melon', 200); case('tilapia', 'Tilapia')
    # 5 basis line
    goto_ok = True
    page.evaluate("1")
    b2 = pw.chromium.launch(); p = new_page(b2, 360, 740, errs=errs); make_profile(p, 'V113b', 2000); goto(p, 'add')
    def basis(q):
        p.fill('#q', q); p.wait_for_timeout(250); return p.locator('button.result').first.inner_text()
    t = basis('rice, raw, milled'); check('estimated portion keeps ~ in the basis', re.search(r'for 1 katori raw \(~125 g\)', t) is not None, t)
    t = basis('milk, cow, whole'); check('glass of milk shows ml in the basis', re.search(r'for 1 glass \(250 ml\)', t) is not None and '258 g' not in t, t)
    t = basis('coconut water'); check('coconut water glass in ml', 'glass (250 ml)' in t, t)
    t = basis('cumin'); check('tsp of jeera: estimated ~2 g', 'for 1 tsp (~2 g)' in t, t)
    t = basis('cashew'); check('exact count weight has no ~ (rounded)', 'for 1 cashew (2 g)' in t and '~' not in t.split(';')[1], t)
    t = basis('dal toor'); check('katori in ml stays in grams (weight is not ml)', re.search(r'katori \(~150 g\)', t) is not None, t)
    check('page errors', not errs, errs)
    b2.close(); b.close()
print('FAILED:', res)
