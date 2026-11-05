"""Take the phase 1 screenshots into journable/shots/ (360x740 and 412x915, light and dark)."""
import sys, json, datetime
sys.path.insert(0, '/home/arch/projects/trackme/tests')
src = open('/home/arch/projects/trackme/tests/test_journable_ui.py').read().split("with sync_playwright() as pw:")[0]
exec(src)
OUT = '/home/arch/projects/trackme/shots/'
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h) in ((360, 740), (412, 915)):
        for scheme in ('light', 'dark'):
            tag = '%dx%d-%s' % (w, h, scheme)
            p = new_page(b, w, h, scheme); make_profile(p, 'Asha', 1800); T = today_of(p)
            # earlier days through an import so the calendar has numbers
            ents = {}; i = 0
            for k, kc in ((1, 1700), (2, 2100), (3, 1500), (4, 1850), (5, 1200)):
                d = addd(T, -k); i += 1; ents.setdefault(d[:7], []).append(ent(i, d, kc, name='Dal chawal, sabzi'))
            pr = dict(PROF); pr['name'] = 'Asha'; pr['id'] = 'p_shots'
            backup_file('/tmp/shots.json', pr, ents)
            goto(p, 'backup'); p.set_input_files('#import-file', '/tmp/shots.json'); p.click('#import-apply'); p.wait_for_selector('#import-summary')
            switch_person(p, 'Asha') if False else None
            p.keyboard.press('Escape')
            goto(p, 'today')
            # which person is active? use the imported one (has the numbers), then log today
            p.click('#menu-btn'); p.wait_for_timeout(350)
            opts = p.locator('#p-switch option').all_text_contents()
            p.select_option('#p-switch', index=len(opts) - 1); p.wait_for_timeout(300)
            if p.evaluate("()=>document.querySelector('#drawer').inert===false"): p.keyboard.press('Escape')
            p.wait_for_selector('#qbar')
            quick(p, 'breakfast 2 idli with sambar at 8:15am')
            quick(p, '2 roti and dal for lunch at 1pm')
            quick(p, 'snack handful almonds and a cup of chai at 5pm')
            p.wait_for_timeout(3800)
            p.evaluate("()=>window.scrollTo(0,0)")
            p.screenshot(path=OUT + 'today-' + tag + '.png')
            p.evaluate("()=>window.scrollTo(0,document.body.scrollHeight)"); p.wait_for_timeout(200)
            p.screenshot(path=OUT + 'today-bottom-' + tag + '.png'); p.evaluate("()=>window.scrollTo(0,0)")
            p.click('#date-btn'); p.wait_for_selector('#cal-sheet'); p.wait_for_timeout(400)
            p.screenshot(path=OUT + 'calendar-' + tag + '.png'); p.keyboard.press('Escape'); p.wait_for_timeout(300)
            p.fill('#ql', '2 roti and dal for lunch, 1 chole bhature, 10 almonds, masala dosa yesterday'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(400)
            p.screenshot(path=OUT + 'preview-' + tag + '.png')
            p.click('#pv-sheet .pv-notthis >> nth=1'); p.wait_for_timeout(250)
            p.screenshot(path=OUT + 'preview-alts-' + tag + '.png')
            p.click('#pv-cancel'); p.wait_for_selector('#pv-sheet', state='detached'); p.fill('#ql', ''); p.wait_for_timeout(250)
            p.locator('li.entry .menu-btn').first.click(); p.wait_for_selector('#entry-menu'); p.wait_for_timeout(350)
            p.screenshot(path=OUT + 'entry-menu-' + tag + '.png'); p.keyboard.press('Escape'); p.wait_for_timeout(300)
            p.click('#menu-btn'); p.wait_for_timeout(450)
            p.screenshot(path=OUT + 'drawer-' + tag + '.png'); p.keyboard.press('Escape')
            p.context.close()
    b.close()
print('ok')
