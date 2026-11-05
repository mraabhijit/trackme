"""Phase 2 screenshots into journable/shots/ (360x740 and 412x915, light and dark)."""
import sys
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
OUT = '/home/arch/projects/trackme/shots/'
FAKE = "class F{start(){}stop(){}};window.webkitSpeechRecognition=F;"
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h) in ((360, 740), (412, 915)):
        for scheme in ('light', 'dark'):
            tag = '%dx%d-%s' % (w, h, scheme)
            # model-2 profile to show the model-3 card
            p = new_page(b, w, h, scheme, init=FAKE); inject_profiles(p, [OLDPROF]); p.reload(); p.wait_for_selector('#m3-card'); p.wait_for_timeout(300)
            p.screenshot(path=OUT + 'p2-m3card-' + tag + '.png'); p.context.close()
            p = new_page(b, w, h, scheme, init=FAKE); T = today_of(p)
            ents = {}; exs = {}; i = 0; wts = []
            pm = addd(T, -(datetime.date.fromisoformat(T).weekday()) - 7)
            for k, kc in ((0, 1500), (1, 2200), (3, 2300), (4, 2000), (5, 1700)):
                i += 1; d = addd(pm, k); ents.setdefault(d[:7], []).append(ent(i, d, kc, name='Dal chawal, sabzi'))
            for k, kc in ((0, 300), (1, 200), (4, 100), (5, 250)):
                i += 1; d = addd(pm, k); exs.setdefault(d[:7], []).append(exe(i, d, kc))
            pr = dict(PROF, name='Asha', id='p_shots'); backup_file('/tmp/shots2.json', pr, ents, weights=[{'date': addd(pm, -2), 'kg': 80.0}, {'date': addd(pm, 5), 'kg': 79.2}], exercise=exs,
                 saved=[{'id': 's1', 'name': 'Office lunch', 'items': [{'type': 'food', 'foodName': 'Roti / phulka (whole wheat, no ghee)', 'grams': 70, 'qty': 2, 'unitLabel': 'roti', 'unitG': 35, 'foodId': 'x', 'per100': {'kcal': 297, 'p': 9, 'c': 55, 'f': 4, 'fib': 8}}], 'updatedAt': 1}])
            p.set_input_files('#import-file', '/tmp/shots2.json'); p.wait_for_selector('#import-apply'); p.click('#import-apply'); p.wait_for_selector('#qbar')
            quick(p, '2 roti and dal for lunch, brisk walk 45 min, 30 min yoga')
            for _ in range(5): p.click('#w-plus')
            p.wait_for_timeout(3800); p.evaluate("()=>window.scrollTo(0,0)"); p.screenshot(path=OUT + 'p2-today-' + tag + '.png')
            p.evaluate("()=>window.scrollTo(0,document.body.scrollHeight)"); p.wait_for_timeout(200); p.screenshot(path=OUT + 'p2-today-bottom-' + tag + '.png'); p.evaluate("()=>window.scrollTo(0,0)")
            p.fill('#ql', 'gym 1 hour, protein shake 300ml, 2 roti, 1 banana'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(400)
            p.screenshot(path=OUT + 'p2-preview-' + tag + '.png'); p.click('#pv-cancel'); p.wait_for_timeout(250)
            p.locator('li.ex-row .menu-btn').first.click(); p.wait_for_selector('#ex-menu'); p.wait_for_timeout(350); p.screenshot(path=OUT + 'p2-exmenu-' + tag + '.png'); p.keyboard.press('Escape'); p.wait_for_timeout(300)
            p.click('#ql-mic'); p.wait_for_selector('#voice-sheet'); p.wait_for_timeout(350); p.screenshot(path=OUT + 'p2-voice-' + tag + '.png'); p.click('#voice-kbd'); p.wait_for_timeout(300)
            for view in ('weekly', 'water', 'saved', 'settings'):
                goto(p, view); p.wait_for_timeout(300)
                if view == 'weekly': p.click('#wk-prev'); p.wait_for_timeout(300)
                p.screenshot(path=OUT + 'p2-%s-%s.png' % (view, tag), full_page=True)
            goto(p, 'saved'); p.keyboard.press('Escape')
            p.context.close()
    b.close()
print('ok')
