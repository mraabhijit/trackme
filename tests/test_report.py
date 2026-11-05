"""PDF report export and import (localhost:8765: pdf.js is an ES module, so this runs from the test server, not file://)."""
import sys, os, re, json, subprocess, datetime
sys.path.insert(0, '/home/arch/projects/trackme/tests')
import serve_dist
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
FIX = '/home/arch/projects/trackme/tests/fixtures/reference-report-2026-11-02-to-2026-11-04.pdf'
srv = serve_dist.start(); BASE = serve_dist.BASE
SH = '/home/arch/projects/trackme/shots'

def weekly_rows(p, tbl):
    return p.eval_on_selector_all('#%s tbody tr' % tbl, 'e=>e.map(r=>[...r.children].map(c=>c.textContent.trim()))')
def open_import(p, path):
    goto(p, 'backup'); p.set_input_files('#report-file', path); p.wait_for_selector('#ri-import, #ri-msg', timeout=30000)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    # ---------- import the real-world fixture ----------
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, accept_downloads=True); p = ctx.new_page()
    p.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    p.goto(BASE); make_profile(p, 'Fx', 2618, kg=75)
    open_import(p, FIX)
    t = p.inner_text('#ri-sheet')
    check('Import preview: counts 17 entries and the right number of items, 1 weight, 3 water days', re.search(r'17 entries, 65 items, 1 weight, 3 water days', p.inner_text('#ri-counts')) is not None, p.inner_text('#ri-counts'))
    days = p.eval_on_selector_all('#ri-days .ri-day', 'e=>e.map(x=>[x.dataset.date,x.querySelector(".ri-total").dataset.ok,x.querySelector(".ri-total").textContent])')
    check('Import preview: 3 days, each computed total matches the report total', len(days) == 3 and all(d[1] == '1' for d in days), days)
    check('Import preview: shows "Check before saving" style info, goal info only, nothing unreadable', 'daily goal of 2618' in p.inner_text('#ri-period') and p.locator('#ri-unread').count() == 0, p.locator('#ri-unread').count() and p.inner_text('#ri-unread'))
    check('Import preview: quantities kept as typed (200 ml, 1/2 bowl, 1 1/4 katori, small katori)', all(x in t for x in ('Milk (200 ml)', '(½ bowl)', '(1¼ katori)', '(½ small katori)', 'Water with bcaa (500 ml)')), [x for x in ('Milk (200 ml)', '(½ bowl)', '(1¼ katori)', '(½ small katori)') if x not in t])
    check('Import preview: wrapped names joined ("Palak vegetable sabji (100 g)")', 'Palak vegetable sabji (100 g)' in t and 'Fish head curry with bottle gourd' in t)
    check('Import preview: default is "Import new only"', p.is_checked('#ri-mode-new'))
    check('360px: preview sheet has no horizontal scroll, targets >= 44', not hscroll(p) and not small_targets(p, '#ri-sheet'), small_targets(p, '#ri-sheet'))
    p.screenshot(path=SH + '/import-preview-360x740-light.png')
    p.click('#ri-import'); p.wait_for_selector('#ri-sheet', state='detached'); p.wait_for_timeout(300)
    goto(p, 'weekly'); p.wait_for_selector('#wk-cal')
    cal = {r[1]: r for r in weekly_rows(p, 'wk-cal') if len(r) >= 5 and re.match(r'^\d+ Nov', r[1])}
    check('Imported day totals 2564 / 2525 / 2565 kcal (Weekly summary)', [cal['2 Nov'][2], cal['3 Nov'][2], cal['4 Nov'][2]] == ['2564', '2525', '2565'], cal)
    mac = {r[1]: r for r in weekly_rows(p, 'wk-mac') if len(r) >= 5 and re.match(r'^\d+ Nov', r[1])}
    nums = lambda c: [int(re.match(r'(\d+)g', mac[d][c]).group(1)) for d in ('2 Nov', '3 Nov', '4 Nov')]
    check('Imported carbs 307/296/306, protein 153/187/198, fat 89/73/65', nums(2) == [307, 296, 306] and nums(3) == [153, 187, 198] and nums(4) == [89, 73, 65], (nums(2), nums(3), nums(4)))
    wr = weekly_rows(p, 'wk-weight'); wmap = {r[1]: r for r in wr if len(r) >= 3}
    check('Imported weight 75.0 kg on Mon 2 Nov 17:16 (5:16 PM)', '75' in ' '.join(wmap['2 Nov']) and '5:16 PM' in ' '.join(wmap['2 Nov']), wmap['2 Nov'])
    wa = {r[1]: r for r in weekly_rows(p, 'wk-water') if len(r) >= 4}
    check('Imported water 1500 ml (6 cups) on each of the 3 days', all('6' in wa[d][2] and ('1.5' in wa[d][3] or '1500' in wa[d][3]) for d in ('2 Nov', '3 Nov', '4 Nov')), wa)
    ents = p.evaluate("()=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));const k='dt:v1:p:'+m.activeProfileId+':entries:2026-11';return JSON.parse(localStorage.getItem(k)||'[]')}")
    check('Stored as additive entries tagged imported, exact numbers, typed units (ml) kept', len(ents) > 50 and all(e.get('imp') == 'pdf' for e in ents) and any(e['unitLabel'] == 'ml' and e['qty'] == 200 for e in ents) and any(e['qty'] == 0.5 and e['unitLabel'] == 'bowl' for e in ents) and any(e['qty'] == 1.25 and e['unitLabel'] == 'katori' for e in ents), len(ents))
    slots = sorted(set(e['slotName'] for e in ents))
    check('Meal slot chosen from the time of day (e.g. 7:22 -> Breakfast, 13:09 -> Lunch)', any(e['time'] == '07:22' and e['slotName'] == 'Breakfast' for e in ents) and any(e['time'] == '13:09' and e['slotName'] == 'Lunch' for e in ents), slots)
    goto(p, 'today'); p.click('#week-strip [data-date="2026-11-03"]'); p.wait_for_timeout(300)
    check('Imported entries show on Today and can be opened (meal detail) and edited/deleted', p.locator('.slot .entry').count() >= 10)
    p.click('.slot .entry .menu-btn >> nth=0'); p.wait_for_selector('#em-edit')
    check('Imported entry menu offers Edit and Delete', p.locator('#em-edit').count() == 1)
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    # second import: new only adds nothing
    open_import(p, FIX)
    check('Import new only twice: second time says nothing new and the button is disabled', p.is_disabled('#ri-import') and 'Nothing new' in p.inner_text('#ri-import'), p.inner_text('#ri-import'))
    check('Second preview: "Will add 0 food items, 0 weights, 0 water days"', 'Will add 0 food items, 0 weights, 0 water days' in p.inner_text('#ri-sum'), p.inner_text('#ri-sum'))
    p.click('#ri-cancel'); p.wait_for_timeout(300)
    goto(p, 'weekly'); p.wait_for_selector('#wk-cal')
    cal2 = {r[1]: r for r in weekly_rows(p, 'wk-cal') if len(r) >= 5 and re.match(r'^\d+ Nov', r[1])}
    check('After the second (empty) import the totals are unchanged', [cal2[d][2] for d in ('2 Nov', '3 Nov', '4 Nov')] == ['2564', '2525', '2565'])
    # import all duplicates, then undo
    open_import(p, FIX); p.check('#ri-mode-all'); check('Import all: counts everything again', 'Will add' in p.inner_text('#ri-sum') and not p.is_disabled('#ri-import'))
    p.click('#ri-import'); p.wait_for_selector('#ri-sheet', state='detached'); goto(p, 'weekly'); p.wait_for_selector('#wk-cal')
    cal3 = {r[1]: r for r in weekly_rows(p, 'wk-cal') if len(r) >= 5 and re.match(r'^\d+ Nov', r[1])}
    check('Import all doubles the day totals (5128)', cal3['2 Nov'][2] == '5128', cal3['2 Nov'])
    goto(p, 'backup'); goto(p, 'weekly')
    # undo path: do an import-all again and press Undo in the toast
    open_import(p, FIX); p.check('#ri-mode-all'); p.click('#ri-import'); p.wait_for_selector('#ri-sheet', state='detached')
    p.click('#toasts button'); p.wait_for_timeout(400); goto(p, 'weekly'); p.wait_for_selector('#wk-cal')
    cal4 = {r[1]: r for r in weekly_rows(p, 'wk-cal') if len(r) >= 5 and re.match(r'^\d+ Nov', r[1])}
    check('Undo toast removes exactly what that import added (back to 5128)', cal4['2 Nov'][2] == '5128', cal4['2 Nov'])
    ctx.close()

    # ---------- bad files ----------
    ctx = b.new_context(viewport={'width': 360, 'height': 740}); p = ctx.new_page(); p.goto(BASE); make_profile(p, 'Bad', 2000)
    open('/tmp/rp_corrupt.pdf', 'wb').write(b'%PDF-1.4\nthis is not really a pdf \x00\x01\x02')
    open_import(p, '/tmp/rp_corrupt.pdf'); m = p.inner_text('#ri-msg')
    check('Corrupt PDF: a plain message, nothing changed', 'could not be read' in m or 'damaged' in m, m)
    p.click('#ri-close'); p.wait_for_timeout(200)
    open('/tmp/rp_text.pdf', 'wb').write(b'hello world')
    open_import(p, '/tmp/rp_text.pdf'); check('Not a PDF at all: "not a PDF"', 'not a PDF' in p.inner_text('#ri-msg'), p.inner_text('#ri-msg'))
    p.click('#ri-close'); p.wait_for_timeout(200)
    from reportlab.pdfgen import canvas
    c = canvas.Canvas('/tmp/rp_other.pdf'); c.setFont('Helvetica', 12); c.drawString(72, 700, 'Invoice 123 - total 40 EUR'); c.save()
    open_import(p, '/tmp/rp_other.pdf'); check('Another kind of PDF: "does not look like a food report"', 'does not look like' in p.inner_text('#ri-msg'), p.inner_text('#ri-msg'))
    p.click('#ri-close'); p.wait_for_timeout(200)
    # unreadable rows are listed, not dropped
    c = canvas.Canvas('/tmp/rp_unread.pdf'); c.setFont('Helvetica', 14); c.drawString(50, 800, 'Entries'); c.setFont('Helvetica', 10)
    c.drawString(50, 770, 'Monday, 2 November 2026')
    for x, t in ((200, 'Calories'), (260, 'Carbs'), (320, 'Protein'), (380, 'Fat')): c.drawString(x, 745, t)
    c.drawString(50, 720, '12:30'); c.drawString(90, 720, 'Rice (100 g)'); c.drawString(200, 720, '130'); c.drawString(260, 720, '28g'); c.drawString(320, 720, '3g'); c.drawString(380, 720, '0g')
    c.drawString(90, 690, 'Mystery line with no numbers'); c.drawString(55, 660, 'Total'); c.drawString(200, 660, '130'); c.drawString(260, 660, '28g'); c.drawString(320, 660, '3g'); c.drawString(380, 660, '0g')
    c.save()
    open_import(p, '/tmp/rp_unread.pdf')
    check('Unparseable lines are listed under "Couldn\'t read", not silently dropped', p.locator('#ri-unread').count() == 1 and 'Mystery' in p.inner_text('#ri-unread') or 'Mystery' in p.inner_text('#ri-days'), p.inner_text('#ri-sheet')[:300])
    p.click('#ri-cancel'); ctx.close()

    # ---------- export, round trip, equality with the Weekly summary ----------
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, accept_downloads=True); p = ctx.new_page(); p.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    p.goto(BASE); make_profile(p, 'Src', 2000, kg=70); T = today_of(p)
    quick(p, '2 roti, dal and 200 ml milk'); quick(p, 'rice 1 bowl\narhar daal 1 katori\nbutter catfish curry 2 pieces'); quick(p, 'walked 40 min')
    goto(p, 'weight'); p.click('#wt-add'); p.wait_for_selector('#wt-sheet'); p.fill('#w-kg', '71.5'); set_time(p, '07:30', 'wt'); p.click('#w-save'); p.wait_for_selector('#wt-sheet', state='detached')
    goto(p, 'today')
    for _ in range(3): p.click('#w-plus')
    goto(p, 'weekly'); p.wait_for_selector('#wk-export')
    p.click('#wk-export'); p.wait_for_selector('#rx-sheet')
    check('Export sheet: presets This week / Last week / Last 30 days / Custom, default = this week up to today', [b_.strip() for b_ in p.eval_on_selector_all('#rx-presets button', 'e=>e.map(x=>x.textContent)')] == ['This week', 'Last week', 'Last 30 days', 'Custom'] and p.get_attribute('#rx-presets [aria-pressed=true]', 'data-preset') == 'this' and p.input_value('#rx-to') == T)
    check('Export sheet fits 360px, targets >= 44', not hscroll(p) and not small_targets(p, '#rx-sheet'), small_targets(p, '#rx-sheet'))
    p.click('#rx-presets [data-preset=custom]'); p.fill('#rx-from', addd(T, -100)); p.dispatch_event('#rx-from', 'change')
    check('Export: custom range over 92 days is refused', 'at most 92' in p.inner_text('#rx-err') and p.is_disabled('#rx-make'), p.inner_text('#rx-err'))
    p.click('#rx-presets [data-preset=this]')
    with p.expect_download() as dl: p.click('#rx-make')
    fn = dl.value.suggested_filename; dl.value.save_as('/tmp/rp_out.pdf')
    mon = addd(T, -datetime.date.fromisoformat(T).weekday())
    check('Export file name trackme-report-<from>-to-<to>.pdf', fn == 'trackme-report-%s-to-%s.pdf' % (mon, T), fn)
    txt = subprocess.run(['pdftotext', '-layout', '/tmp/rp_out.pdf', '-'], capture_output=True, text=True).stdout
    pages = subprocess.run(['pdfinfo', '/tmp/rp_out.pdf'], capture_output=True, text=True).stdout
    check('PDF is valid (pdfinfo), A4, footer says TrackMe and Page x of y, no other brand', 'Pages:' in pages and '595.28 x 841.89' in pages and 'TrackMe' in txt and re.search(r'Page 1 of \d+', txt) and 'journable' not in txt.lower(), pages)
    check('PDF has the sections Calories, Macronutrients, Weight, Water, Consistency Stats, Entries', all(s in txt for s in ('Calories', 'Macronutrients', 'Weight', 'Water', 'Consistency Stats', 'Entries')))
    check('PDF: "under/over budget this period" and "N of M days tracked"', re.search(r'\d+ calories\s+(under|over) budget this period', txt) and re.search(r'\d of \d+ days tracked', txt))
    goto(p, 'weekly'); p.wait_for_selector('#wk-cal')
    wk = {r[1]: r for r in weekly_rows(p, 'wk-cal') if len(r) >= 5 and re.match(r'^\d+ \w+', r[1])}
    m_ = re.search(r'\n\s*\w{3}\s+(\d+ \w{3})\s+(\d+)\s+(\d+)\s+(-?\d+)\s*\n', txt)
    dnow = (datetime.date.fromisoformat(T)); lab = '%d %s' % (dnow.day, dnow.strftime('%b'))
    row = re.search(r'\n\s*\w{3}\s+%s\s+(\d+)\s+(\d+)\s+(-?\d+)' % lab, txt)
    check('PDF Calories table equals the Weekly summary for today (food, exercise, remaining)', row and [row.group(1), row.group(2), row.group(3)] == [wk[lab][2], wk[lab][3], wk[lab][4]], (row and row.groups(), wk.get(lab)))
    tot = re.search(r'\n\s*Total\s+(\d+)\s+(\d+)\s+(-?\d+)', txt); wtot = [r for r in weekly_rows(p, 'wk-cal') if r and r[0] == 'Total'][0]
    check('PDF Total row equals the Weekly summary Total row', tot and [tot.group(1), tot.group(2), tot.group(3)] == [wtot[1], wtot[2], wtot[3]], (tot and tot.groups(), wtot))
    check('PDF Entries: exercise row with minutes, items keep typed units (200 ml), Total and Remaining rows', '(40 min)' in txt and 'milk' in txt and '200 ml' in txt and re.search(r'\n\s*Total\s+\d+', txt) and 'Remaining' in txt, txt[-900:])
    check('PDF Weight and Water tables carry today\'s weight (71.5 kg) and 3 cups (750 ml)', '71.5 kg' in txt and '750 ml' in txt)
    png = subprocess.run(['pdftoppm', '-r', '60', '-png', '/tmp/rp_out.pdf', SH + '/report-export'], capture_output=True)
    # round trip into a fresh profile in a new browser context
    ctx2 = b.new_context(viewport={'width': 360, 'height': 740}); q = ctx2.new_page(); q.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    q.goto(BASE); make_profile(q, 'Dst', 2000, kg=70)
    open_import(q, '/tmp/rp_out.pdf')
    pc = q.inner_text('#ri-counts')
    check('Round trip: preview reads our own PDF (entries, items, exercise, weight, water)', re.search(r'\d+ entries, \d+ items, 1 exercise, 1 weight, 1 water day', pc) is not None, pc)
    check('Round trip: every day total matches, nothing unreadable', all(x == '1' for x in q.eval_on_selector_all('#ri-days .ri-total', 'e=>e.map(x=>x.dataset.ok)')) and q.locator('#ri-unread').count() == 0, q.locator('#ri-unread').count() and q.inner_text('#ri-unread'))
    q.click('#ri-import'); q.wait_for_selector('#ri-sheet', state='detached'); goto(q, 'weekly'); q.wait_for_selector('#wk-cal')
    wk2 = {r[1]: r for r in weekly_rows(q, 'wk-cal') if len(r) >= 5 and re.match(r'^\d+ \w+', r[1])}
    check('Round trip: same food, exercise and remaining for the day in the fresh profile', wk2[lab][2:5] == wk[lab][2:5], (wk2[lab], wk[lab]))
    mc1 = {r[1]: r for r in weekly_rows(p, 'wk-mac') if len(r) >= 5}; mc2 = {r[1]: r for r in weekly_rows(q, 'wk-mac') if len(r) >= 5}
    check('Round trip: same macros for the day', mc1[lab][2:5] == mc2[lab][2:5], (mc1[lab], mc2[lab]))
    w1 = {r[1]: r for r in weekly_rows(p, 'wk-weight') if len(r) >= 3}; w2 = {r[1]: r for r in weekly_rows(q, 'wk-weight') if len(r) >= 3}
    check('Round trip: weight and time carried', w1[lab] == w2[lab] and '71.5' in ' '.join(w2[lab]), (w1[lab], w2[lab]))
    goto(q, 'today'); n1 = p.evaluate("()=>1")
    p.click('#menu-btn'); p.click('#drawer [data-view=today]'); p.wait_for_selector('.slot')
    e1 = p.eval_on_selector_all('.slot .entry', 'e=>e.map(x=>x.querySelector("b").textContent+"|"+x.querySelector(".qty-text").textContent)')
    e2 = q.eval_on_selector_all('.slot .entry', 'e=>e.map(x=>x.querySelector("b").textContent+"|"+x.querySelector(".qty-text").textContent)')
    check('Round trip: same entries and quantities as typed (names, ml/katori/bowl)', len(e1) == len(e2) and sorted(x.split('|')[0] for x in e1) == sorted(x.split('|')[0] for x in e2), (e1, e2))
    check('Round trip: exercise row came back', q.locator('#ex-card').count() == 1 or q.locator('.ex-row').count() == 1)
    ctx2.close(); ctx.close()
    print('page errors:', errs[:3])
    b.close()
srv.stop()
print('FAILED:', res)
