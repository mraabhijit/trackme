"""v1.1.2 (file://): quantity basis is visible, portions reach the unit picker, db_check passes, built site matches the db."""
import sys, re, subprocess
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

r = subprocess.run(['node', '--no-warnings', D + '/scripts/db_check.mjs'], capture_output=True, text=True)
check('db_check.mjs passes', r.returncode == 0, r.stdout + r.stderr)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    p = new_page(b, 360, 740, errs=errs); make_profile(p, 'V112', 2000)
    goto(p, 'add')
    p.fill('#q', 'banana'); p.wait_for_timeout(200)
    txt = p.inner_text('#results')
    check('search result states the basis: per 100 g and for the typical portion', re.search(r'\d+ kcal per 100 g; \d+ kcal for 1 medium banana \(~100 g\)', txt) is not None, txt[:300])
    check('no horizontal scroll at 360 px with the longer line', p.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    h = p.eval_on_selector_all('#results button.result', 'e=>e.map(x=>x.getBoundingClientRect().height)')
    check('result rows keep a 44 px tap target', h and min(h) >= 44, h[:3])
    p.fill('#q', 'rice, raw, milled'); p.locator('button.result').first.click()
    check('raw rice offers the estimated katori portion with its weight', 'katori raw (~125 g)' in p.inner_text('[aria-label=Unit]'), p.inner_text('[aria-label=Unit]'))
    p.click('text=Cancel'); goto(p, 'add')
    p.fill('#q', 'cashew'); p.locator('button.result').first.click()
    chips = p.locator('[aria-label=Unit] .chip').all_inner_texts()
    check('cashew offers 1 cashew (1.5 g), the same weight typed counts use', 'cashew (1.5 g)' in chips, chips)
    p.locator('[aria-label=Unit] .chip', has_text='cashew (1.5 g)').click(); p.fill('#qty', '4'); p.dispatch_event('#qty', 'input')
    kc = int(p.inner_text('#pv-kcal').split()[0])
    check('4 cashews from the picker = 6 g, about 35 kcal, preview says "for 6 g"', abs(kc - 35) <= 1 and 'for 6 g' in p.inner_text('#preview'), p.inner_text('#preview'))
    p.click('text=Cancel'); goto(p, 'add')
    # typed counts keep their v1.1.1 behaviour although cashew now has a piece portion
    goto(p, 'today'); p.fill('#ql', '4 cashews'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    t = p.inner_text('#pv-rows')
    check('typed "4 cashews" still shows 4 cashews (6 g), not a picker portion label', re.search(r'4 cashews?', t) is not None and '35' in t, t[:200])
    p.click('#pv-cancel'); p.wait_for_timeout(300)
    # review fix: a raw fruit's own piece portion comes before the group default katori, so typed counts use it
    for text, want in [('10 strawberries', '(120 g)'), ('10 grapes', '(50 g)'), ('1 dried apricot', '(8 g)'), ('1 guava', 'medium guava (100 g)'), ('1 katori guava', 'katori (100 g)'), ('2 figs', '2 figs (51 g)')]:
        quick(p, text, save=False); t = p.inner_text('#pv-rows')
        check('typed "%s" -> %s' % (text, want), want in t and '1000 g' not in t, t[:160])
        p.click('#pv-cancel'); p.wait_for_timeout(250)
    quick(p, '2 roti and a banana')
    p.click('.slot >> nth=0 >> .slot-title-btn'); p.wait_for_selector('#meal-card')
    nb = p.inner_text('#nf-basis')
    check('meal detail says what Nutrition facts are for', re.search(r'For the whole meal: 2 items, about \d+ g eaten', nb) is not None, nb)
    check('page errors', not errs, errs)
    b.close()
print('FAILED:', res)
