"""'gram' inside a food name (Bengal gram, green gram) is not the unit grams: '1 katori' stays a katori."""
import sys, json
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from tphelpers import *
from ui_helpers import D
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
G = json.load(open(D + '/tests/golden_parse.json')); CTX = dict(G['ctx'], kg=70, saved=[])
with sync_playwright() as pw:
    b = pw.chromium.launch(); page = b.new_page(); page.goto(URL)
    page.fill('#f-name', 'G'); page.fill('#f-dob', '1990-01-01'); page.fill('#f-height', '170'); page.fill('#f-weight', '70'); page.click('#save-profile'); page.wait_for_selector('#qbar')
    def item(t):
        r = page.evaluate("([t,c])=>Journable.parseLog(t,c)", [t, CTX]); return (r['items'] if isinstance(r, dict) else r)[0]
    for t, g in (('Bengal gram 1 katori', 120), ('green gram dal 1 katori', 120), ('horse gram 50 g', 50), ('100 gram rice', 100), ('rice 100 grams', 100), ('rice 100g', 100)):
        x = item(t); check('"%s" -> %s g' % (t, g), abs((x.get('grams') or 0) - g) < 0.5, (x.get('foodName'), x.get('unitLabel'), x.get('grams')))
    check('"Bengal gram 1 katori" keeps the katori unit', 'katori' in (item('Bengal gram 1 katori').get('unitLabel') or ''))
    b.close()
print('FAILED:', res)
