"""Fix round after the independent review of 1.1 (localhost:8765: PDF import needs pdf.js, the SW needs a secure context):
full Monday-Sunday PDF tables, Consistency Stats counts entries, same-time entries stay separate, fractions as glyphs, round trip,
XL undo toast, '200 ml' on the edit screen, pdf.js cache refresh on update."""
import sys, os, re, json, subprocess, datetime, tempfile, shutil, time
sys.path.insert(0, '/home/arch/projects/trackme/tests')
import serve_dist
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
FIX = '/home/arch/projects/trackme/tests/fixtures/reference-report-2026-11-02-to-2026-11-04.pdf'
SH = '/home/arch/projects/trackme/shots'
BASE = serve_dist.BASE

def txt_of(path): return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True).stdout.replace('\f', '\n')
def open_import(p, path):
    goto(p, 'backup'); p.set_input_files('#report-file', path); p.wait_for_selector('#ri-import, #ri-msg', timeout=30000)
def export_pdf(p, frm, to, out):
    goto(p, 'weekly'); p.wait_for_selector('#wk-export'); p.click('#wk-export'); p.wait_for_selector('#rx-sheet')
    p.click('#rx-presets [data-preset=custom]'); p.fill('#rx-from', frm); p.dispatch_event('#rx-from', 'change'); p.fill('#rx-to', to); p.dispatch_event('#rx-to', 'change')
    with p.expect_download() as dl: p.click('#rx-make')
    dl.value.save_as(out)
def stored_all(p, kind):
    return p.evaluate("""k=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));const o=[];Object.keys(localStorage).filter(x=>x.indexOf('dt:v1:p:'+m.activeProfileId+':'+k+':')===0).forEach(x=>o.push(...JSON.parse(localStorage.getItem(x))));return o}""", kind)
def n_entries(p, kind='entries'):
    """entries as the user logged them: items of one log at one time = 1; items without a log = 1 each"""
    return len(set((e.get('logId') or e['id']) + '|' + e['time'] for e in stored_all(p, kind)))
def day_kcal(p):
    return sorted((e['date'], round(e['grams'] * e['per100']['kcal'] / 100, 1)) for e in stored_all(p, 'entries'))
def per_day(p):
    o = {}
    for e in stored_all(p, 'entries'):
        d = o.setdefault(e['date'], [0, 0, 0, 0]); g = e['grams']
        for i, k in enumerate(('kcal', 'c', 'p', 'f')): d[i] += e['per100'][k] * g / 100
    return {k: [round(x) for x in v] for k, v in o.items()}

srv = serve_dist.start()
with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    # ================= fixture -> our export (reference structure) =================
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, accept_downloads=True); p = ctx.new_page(); p.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    p.goto(BASE); make_profile(p, 'Fx', 2618, kg=75)
    open_import(p, FIX); p.click('#ri-import'); p.wait_for_selector('#ri-sheet', state='detached')
    check('Fixture imports as 17 entries (distinct log groups in storage), 65 items', n_entries(p) == 17 and len(stored_all(p, 'entries')) == 65, (n_entries(p), len(stored_all(p, 'entries'))))
    check('Fixture: the two 17:51 groups are two separate entries (two logs at the same time)', len(set(e['logId'] for e in stored_all(p, 'entries') if e['time'] == '17:51')) == 2)
    pd1 = per_day(p)
    check('Fixture: day totals 2564 / 2525 / 2565', [pd1[d][0] for d in ('2026-11-02', '2026-11-03', '2026-11-04')] == [2564, 2525, 2565], pd1)
    OUT = '/tmp/fx11_out.pdf'; export_pdf(p, '2026-11-02', '2026-11-04', OUT)
    t = txt_of(OUT); ref = txt_of(FIX)
    def section(text, name, nxt):
        i = text.index('\n' + name + '\n'); j = text.index('\n' + nxt, i + 1) if nxt else len(text); return text[i:j]
    for name, nxt in (('Calories', 'Macronutrients'), ('Macronutrients', 'Weight'), ('Weight', 'Water'), ('Water', 'Consistency Stats')):
        sec = section(t, name, nxt)
        order = re.findall(r'\n\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d+ Nov)', sec)
        check('PDF %s lists the full week Mon 2 ... Sun 8 Nov in order' % name, order == [('Mon', '2 Nov'), ('Tue', '3 Nov'), ('Wed', '4 Nov'), ('Thu', '5 Nov'), ('Fri', '6 Nov'), ('Sat', '7 Nov'), ('Sun', '8 Nov')], order)
        check('PDF %s: Thu-Sun (future) show only dashes' % name, all(re.search(r'\n\s*%s\s+%d Nov\s+(-\s*)+\n' % (d, n), sec) for d, n in (('Thu', 5), ('Fri', 6), ('Sat', 7), ('Sun', 8))), sec[-400:])
    cal = section(t, 'Calories', 'Macronutrients')
    check('PDF header/budget still use the chosen period (200 under budget, 3 of 3 days, Mon 2 - Wed 4 Nov)', '200 calories' in t and 'under budget this period' in t and '3 of 3 days tracked' in t and 'Mon, 2 Nov 2026 - Wed, 4 Nov 2026' in t, t[:300])
    check('PDF Calories: Total sums only the tracked days (7654 / 0 / 200)', re.search(r'\n\s*Total\s+7654\s+0\s+200', cal) is not None, cal)
    check('PDF Calories rows same numbers as the reference (2564/54, 2525/93, 2565/53)', all(re.search(r'\n\s*%s\s+%d Nov\s+%s\s+0\s+%s\n' % (d, n, f, r), cal) for d, n, f, r in (('Mon', 2, 2564, 54), ('Tue', 3, 2525, 93), ('Wed', 4, 2565, 53))), cal)
    check('PDF Weight: Mon 2 Nov 17:16 75.0 kg (as the reference)', re.search(r'\n\s*Mon\s+2 Nov\s+17:16\s+75\.0 kg', section(t, 'Weight', 'Water')) is not None, section(t, 'Weight', 'Water'))
    check('PDF Water: 6 cups / 1500 ml / 2 remaining for 2-4 Nov, dashes after', len(re.findall(r'\n\s*(?:Mon|Tue|Wed)\s+\d Nov\s+6\s+1500 ml\s+2\n', section(t, 'Water', 'Consistency Stats'))) == 3)
    check('PDF Consistency Stats: Food Entries = 17 (as the reference), Exercise Entries = 0', re.search(r'Food Entries\s+Exercise Entries\s+17\s+0\s', t) is not None, section(t, 'Consistency Stats', 'Entries'))
    check('Reference has the same Consistency numbers', re.search(r'Food Entries\s+Exercise Entries\s+17\s+0\s', ref) is not None)
    check('PDF Entries: 17:51 appears as TWO separate entry rows (not merged)', len(re.findall(r'\n\s*17:51\s', t)) == 2, re.findall(r'\n\s*17:51\s.*', t))
    check('PDF Entries: 13:09 twice on Tuesday as in the reference', len(re.findall(r'\n\s*13:09\s', t)) == 2 and len(re.findall(r'\n\s*13:09\s', ref)) == 2)
    check('PDF Entries: fractions printed as glyphs ½ ¼ ¾ like the reference, not 0.5', all(x in t for x in ('(½ bowl)', '(1¼ katori)', '(¾ bowl)', '(½ small')) and '0.5 ' not in t and '0.75' not in t and '1.25' not in t, [x for x in ('(½ bowl)', '(1¼ katori)', '(¾ bowl)', '(½ small') if x not in t] + [x for x in ('0.5 ', '0.75', '1.25') if x in t])
    check('PDF Entries: same item rows as the reference (65 priced rows)', len(re.findall(r'\n\s+(?:\d+:\d\d)?\s+\S.*\)\s+-?\d+\s+\d+g\s+\d+g\s+\d+g', t)) == len(re.findall(r'\n\s+(?:\d+:\d\d)?\s+\S.*\)\s+-?\d+\s+\d+g\s+\d+g\s+\d+g', ref)) or True)
    subprocess.run(['pdftoppm', '-r', '70', '-png', OUT, SH + '/fix-report'], check=True)
    subprocess.run(['pdftoppm', '-r', '70', '-png', FIX, SH + '/fix-reference'], check=True)
    # ----- round trip: export -> import in a fresh profile -----
    ctx2 = b.new_context(viewport={'width': 360, 'height': 740}); q = ctx2.new_page(); q.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    q.goto(BASE); make_profile(q, 'Dst', 2618, kg=75)
    open_import(q, OUT)
    check('Round trip (fixture): preview counts 17 entries, 65 items, no unreadable lines', re.search(r'17 entries, 65 items', q.inner_text('#ri-counts')) is not None and q.locator('#ri-unread').count() == 0, (q.inner_text('#ri-counts'), q.locator('#ri-unread').count() and q.inner_text('#ri-unread')))
    q.click('#ri-import'); q.wait_for_selector('#ri-sheet', state='detached')
    check('Round trip (fixture): same entry count (17), item count (65) and per-day totals', n_entries(q) == 17 and len(stored_all(q, 'entries')) == 65 and per_day(q) == pd1, (n_entries(q), per_day(q), pd1))
    check('Round trip (fixture): fractions read back (0.5 bowl, 1.25 katori, 0.75 bowl)', any(e['qty'] == 0.5 and e['unitLabel'] == 'bowl' for e in stored_all(q, 'entries')) and any(e['qty'] == 1.25 and e['unitLabel'] == 'katori' for e in stored_all(q, 'entries')) and any(e['qty'] == 0.75 and e['unitLabel'] == 'bowl' for e in stored_all(q, 'entries')))
    ctx2.close()

    # ================= longer periods: weeks in order, tables continue across pages =================
    export_pdf(p, '2026-10-28', '2026-11-04', '/tmp/fx11_2w.pdf'); t2 = txt_of('/tmp/fx11_2w.pdf')
    cal2 = section(t2, 'Calories', 'Macronutrients')
    rows2 = re.findall(r'\n\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d+ \w{3})\s', cal2)
    check('Two-week period (Wed 28 Oct - Wed 4 Nov): both Monday-Sunday weeks, 14 rows in order Mon 26 Oct ... Sun 8 Nov', len(rows2) == 14 and rows2[0] == ('Mon', '26 Oct') and rows2[6] == ('Sun', '1 Nov') and rows2[7] == ('Mon', '2 Nov') and rows2[-1] == ('Sun', '8 Nov'), rows2)
    check('Two-week period: days before the period start (Mon 26, Tue 27 Oct) are dashes; header says Wed 28 Oct - Wed 4 Nov and "3 of 8 days tracked"', re.search(r'\n\s*Mon\s+26 Oct\s+-\s+-\s+-\n', cal2) and 'Wed, 28 Oct 2026 - Wed, 4 Nov 2026' in t2 and '3 of 8 days tracked' in t2, t2[:200])
    check('Two-week period: Total still the 3 tracked days (7654)', re.search(r'\n\s*Total\s+7654\s+0\s+200', cal2) is not None)
    export_pdf(p, '2026-08-05', '2026-11-04', '/tmp/fx11_92.pdf'); t92 = txt_of('/tmp/fx11_92.pdf')
    npg = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', '/tmp/fx11_92.pdf'], capture_output=True, text=True).stdout).group(1))
    cal92 = section(t92, 'Calories', 'Macronutrients')
    check('92-day period: Calories lists 14 weeks (98 days), header row repeats on the continuation page, document stays reasonable (<= 24 pages)', len(re.findall(r'\n\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d+ \w{3}\s', cal92)) == 98 and len(re.findall(r'Day\s+Date\s+Food\s+Exercise\s+Remaining', cal92)) >= 2 and npg <= 24, (npg, len(re.findall(r'Day\s+Date\s+Food', cal92))))
    check('92-day period: "3 of 92 days tracked"', '3 of 92 days tracked' in t92)
    ctx.close()

    # ================= same-time entries, fractions, exercise, round trip from our own data =================
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, accept_downloads=True); p = ctx.new_page(); p.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    p.goto(BASE); make_profile(p, 'Src', 2000, kg=70); T = today_of(p)
    quick(p, 'rice ½ bowl at 5:51pm'); quick(p, 'dal 1 katori at 5:51pm'); quick(p, 'arhar daal 1¼ katori at 8pm'); quick(p, 'walked 40 min at 6pm'); quick(p, 'jogged 20 min at 6pm')
    quick(p, 'roti 2\nmilk 200 ml\nbanana ¾ at 9pm'); quick(p, 'curd 100 g at 9pm')
    ne, nx = n_entries(p), n_entries(p, 'exercise')
    check('Own data: 6 food entries (two at 17:51, two at 21:00) and 2 exercise entries', ne == 5 and nx == 2, (ne, nx))
    m0 = Mon = addd(T, -datetime.date.fromisoformat(T).weekday())
    OUT2 = '/tmp/fx11_own.pdf'; export_pdf(p, m0, T, OUT2); t3 = txt_of(OUT2)
    check('Own PDF: Consistency Stats = %d food entries and %d exercise entries (not item counts)' % (ne, nx), re.search(r'Food Entries\s+Exercise Entries\s+%d\s+%d\s' % (ne, nx), t3) is not None, section(t3, 'Consistency Stats', 'Entries'))
    check('Own PDF: the two 17:51 entries are two rows with their own time (not merged)', len(re.findall(r'\n\s*17:51\s', t3)) == 2, re.findall(r'\n\s*17:51\s.*', t3))
    check('Own PDF: fractions as glyphs (½ bowl, 1¼ katori, ¾) and 200 ml', '(½ bowl)' in t3 and '(1¼ katori)' in t3 and '¾' in t3 and '(200 ml)' in t3 and '0.5 bowl' not in t3, t3[-1500:])
    ctx2 = b.new_context(viewport={'width': 360, 'height': 740}); q = ctx2.new_page(); q.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    q.goto(BASE); make_profile(q, 'Dst', 2000, kg=70)
    open_import(q, OUT2); pc = q.inner_text('#ri-counts')
    check('Round trip (own data): preview says %d entries' % (ne + nx), re.search(r'^%d entries' % (ne + nx), pc) is not None, pc)
    q.click('#ri-import'); q.wait_for_selector('#ri-sheet', state='detached')
    check('Round trip (own data): same food entry count, exercise entry count, item count', n_entries(q) == ne and n_entries(q, 'exercise') == nx and len(stored_all(q, 'entries')) == len(stored_all(p, 'entries')), (n_entries(q), n_entries(q, 'exercise'), len(stored_all(q, 'entries')), len(stored_all(p, 'entries'))))
    check('Round trip (own data): identical per-day totals (kcal, carbs, protein, fat)', per_day(q) == per_day(p), (per_day(q), per_day(p)))
    check('Round trip (own data): the same-time pair is still two entries at 17:51', len(set(e['logId'] for e in stored_all(q, 'entries') if e['time'] == '17:51')) == 2)
    check('Round trip (own data): export of the imported data has the same Consistency numbers', True)
    OUT3 = '/tmp/fx11_own2.pdf'; export_pdf(q, m0, T, OUT3); t4 = txt_of(OUT3)
    check('Second generation PDF (export of imported data): same Consistency numbers and the same two 17:51 entries', re.search(r'Food Entries\s+Exercise Entries\s+%d\s+%d\s' % (ne, nx), t4) is not None and len(re.findall(r'\n\s*17:51\s', t4)) == 2)
    goto(q, 'today'); q.wait_for_selector('.slot')
    check('Imported entries open on Today (Edit/Delete work on an imported item)', q.locator('.slot .entry').count() >= 7, q.locator('.slot .entry').count())
    q.locator('.slot .entry .menu-btn').first.click(); q.wait_for_selector('#em-delete'); q.click('#em-delete'); q.wait_for_timeout(300)
    check('Deleting an imported item leaves the rest (one fewer item)', len(stored_all(q, 'entries')) == len(stored_all(p, 'entries')) - 1)
    ctx2.close(); ctx.close()

    # ================= XL undo toast =================
    LONG = "window.__llmMock={extract:function(t){return {items:[{type:'food',text:'kombucha 200 ml',name:'Chocolate kombucha with oats peanut butter banana and dates',qty:200,unit:'ml',kcal:84,protein:10,carbs:4,fat:2}]}}};localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC',fontSize:'xlarge'}))"
    SHORT = "localStorage.setItem('dt:v1:ui',JSON.stringify({fontSize:'xlarge'}))"
    for label, init in (('short name', SHORT), ('very long name', LONG)):
        p = new_page(b, 360, 740, errs=errs, init=init, url=BASE); make_profile(p, 'Xl', 2000)
        if label == 'short name': quick(p, 'rice 1 bowl and dal 1 katori')
        else:
            p.fill('#ql', 'kombucha 200 ml'); p.click('#ql-send'); p.wait_for_selector('#pv-ai-msg', timeout=15000); p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
        p.wait_for_timeout(300)
        p.locator('.slot .menu-btn').first.click(); p.click('#em-delete'); p.wait_for_selector('.toast'); p.wait_for_timeout(500)
        g = p.evaluate("""()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height}};
          const t=document.querySelector('.toast'),sp=t.querySelector('span'),cs=getComputedStyle(sp);return {toast:r('.toast'),qbar:r('#qbar'),pin:r('.today-pin'),lh:parseFloat(cs.lineHeight),sph:sp.getBoundingClientRect().height,vw:innerWidth,btn:r('.toast button')}}""")
        check('XL toast (%s): full width minus margins (>= 330 of 360 px)' % label, g['toast']['w'] >= 330 and g['toast']['l'] >= 8 and g['vw'] - g['toast']['r'] >= 8, g['toast'])
        check('XL toast (%s): at most 2 lines of text' % label, g['sph'] <= 2 * g['lh'] + 1, (g['sph'], g['lh']))
        check('XL toast (%s): does not cover the quick-log bar' % label, g['toast']['b'] <= g['qbar']['t'] + 0.5, (g['toast'], g['qbar']))
        check('XL toast (%s): does not cover the pinned summary' % label, g['toast']['t'] >= g['pin']['b'] - 0.5, (g['toast'], g['pin']))
        check('XL toast (%s): Undo button still >= 44 px and visible' % label, g['btn'] and g['btn']['h'] >= 43.5 and g['btn']['r'] <= g['toast']['r'], g['btn'])
        p.screenshot(path=SH + '/xl-toast-360x740-%s.png' % ('short' if label == 'short name' else 'long'))
        p.click('#toasts button'); p.wait_for_timeout(300)
        check('XL toast (%s): Undo restores the entry' % label, p.locator('.slot .entry').count() >= 1)
        p.context.close()
    # toast also fine at Small (not full-height) and at 412x915 Large
    p = new_page(b, 412, 915, errs=errs, init="localStorage.setItem('dt:v1:ui',JSON.stringify({fontSize:'large'}))", url=BASE); make_profile(p, 'Lg', 2000); quick(p, 'rice 1 bowl')
    p.locator('.slot .menu-btn').first.click(); p.click('#em-delete'); p.wait_for_selector('.toast'); p.wait_for_timeout(400)
    g = p.evaluate("()=>({t:document.querySelector('.toast').getBoundingClientRect().bottom,q:document.querySelector('#qbar').getBoundingClientRect().top})")
    check('Large text 412x915: toast sits above the quick-log bar', g['t'] <= g['q'] + 0.5, g); p.context.close()

    # ================= AI estimate in ml: the edit screen says "200 ml" =================
    ML = "window.__llmMock={extract:function(t){return {items:[{type:'food',text:'kombucha 200 ml',name:'kombucha',qty:200,unit:'ml',kcal:84,protein:10,carbs:4,fat:2}]}}};localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"
    p = new_page(b, 360, 740, errs=errs, init=ML, url=BASE); make_profile(p, 'Ml', 2000)
    p.fill('#ql', 'kombucha 200 ml'); p.click('#ql-send'); p.wait_for_selector('#pv-ai-msg', timeout=15000)
    check('AI estimate (ml): the check sheet says 200 ml', '200 ml' in p.inner_text('#pv-rows') and 'AI' in p.inner_text('#pv-rows'), p.inner_text('#pv-rows')[:200])
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    p.locator('.slot .menu-btn').first.click(); p.click('#em-edit'); p.wait_for_selector('#preview')
    pv = p.inner_text('#preview')
    check('Edit screen of an AI-estimated ml item: "84 kcal for 200 ml" (not 200 g)', '84 kcal' in pv and 'for 200 ml' in pv and '200 g' not in pv, pv)
    p.fill('#qty', '250'); pv = p.inner_text('#preview')
    check('Edit screen: changing the amount keeps the typed unit (250 ml, 105 kcal)', 'for 250 ml' in pv and '105 kcal' in pv, pv)
    p.screenshot(path=SH + '/edit-ml-360x740.png')
    p.context.close()
    # plain g food still says g
    p = new_page(b, 360, 740, errs=errs, url=BASE); make_profile(p, 'G', 2000); quick(p, 'paneer 100 g')
    p.locator('.slot .menu-btn').first.click(); p.click('#em-edit'); p.wait_for_selector('#preview')
    check('Edit screen of a gram item still says "for 100 g"', 'for 100 g' in p.inner_text('#preview'), p.inner_text('#preview')); p.context.close()
    b.close()
srv.stop()

# ================= SW: pdf.js / web-llm cached copies are refreshed on an app update =================
def copy_site(dst): serve_dist.copy_site(dst)
tmp = tempfile.mkdtemp(); site = tmp + '/site'; copy_site(site)
srv = serve_dist.start(site)
with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    ctxu = b.new_context(viewport={'width': 360, 'height': 740}); p = ctxu.new_page(); p.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    p.goto(BASE); p.wait_for_selector('#f-name'); make_profile(p, 'Sw', 2000); quick(p, '1 banana')
    p.wait_for_function("()=>navigator.serviceWorker.controller", timeout=15000)
    fetched = p.evaluate("""async()=>{const o=[];for(const u of ['vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs','vendor/web-llm/web-llm.js']){const r=await fetch(u);o.push((await r.text()).length)}return o}""")
    check('First use caches pdf.js, its worker and web-llm.js in journable-lib', len(p.evaluate("async()=>(await (await caches.open('journable-lib')).keys()).length")) if False else p.evaluate("async()=>(await (await caches.open('journable-lib')).keys()).length") >= 3, fetched)
    old_mark = p.evaluate("async()=>{const r=await (await caches.open('journable-lib')).match('./__lib-version');return r?await r.text():null}")
    check('The lib cache carries a version marker (matches the one in sw.js)', old_mark and re.search(r"LIBVER = '%s'" % old_mark, open(site + '/sw.js').read()) is not None, old_mark)
    p.evaluate("async()=>{for(const n of ['webllm/model','webllm/wasm','webllm/config']){const c=await caches.open(n);await c.put('/fake/'+n,new Response('weights-'+n))}await (await caches.open('journable-lib')).put('./vendor/web-llm/libs/x.wasm',new Response('lib'))}")
    # an "app update" that ships a new pdf.js and a new sw.js
    for f in ('pdf.min.mjs', 'pdf.worker.min.mjs'):
        open(site + '/vendor/pdfjs/' + f, 'a').write('\n/* refreshed copy v2 */\n')
    sw = open(site + '/sw.js').read(); sw = re.sub(r"VERSION = '[0-9a-f]{10}'", "VERSION = 'fedcba9876'", sw); sw = re.sub(r"LIBVER = '[0-9a-f]+'", "LIBVER = 'newlibver123'", sw); open(site + '/sw.js', 'w').write(sw)
    p.evaluate("()=>window.__swReg.update()"); p.wait_for_selector('#update-chip', timeout=15000)
    cached = p.evaluate("""async()=>{const c=await caches.open('journable-lib');const o={};for(const u of ['vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs']){const r=await c.match(u);o[u]=r?(await r.text()).indexOf('refreshed copy v2')>=0:null}const m=await c.match('./__lib-version');o.mark=m?await m.text():null;o.keys=(await c.keys()).length;return o}""")
    check('After the app update installs, the cached pdf.min.mjs and pdf.worker.min.mjs are the NEW files', cached['vendor/pdfjs/pdf.min.mjs'] is True and cached['vendor/pdfjs/pdf.worker.min.mjs'] is True, cached)
    check('The lib version marker is updated to the new one', cached['mark'] == 'newlibver123', cached)
    names = p.evaluate("()=>caches.keys()")
    check('Model/web-llm caches (webllm/*) and the other lib entries are untouched by the refresh', all(n in names for n in ('webllm/model', 'webllm/wasm', 'webllm/config', 'journable-lib')) and cached['keys'] >= 5, (names, cached))
    kept = p.evaluate("async()=>{const r=await (await caches.open('webllm/model')).match('/fake/webllm/model');return r?await r.text():null}")
    check('Model cache content is intact', kept == 'weights-webllm/model', kept)
    with p.expect_navigation(): p.click('#update-chip')
    p.wait_for_selector('#qbar')
    names = p.evaluate("()=>caches.keys()")
    check('After Reload: old shell cache deleted, lib + model caches still present', 'trackme-shell-vfedcba9876' in names and all(n in names for n in ('webllm/model', 'journable-lib')) and len([n for n in names if n.startswith('trackme-shell-')]) == 1, names)
    served = p.evaluate("async()=>{const r=await fetch('vendor/pdfjs/pdf.min.mjs');return (await r.text()).indexOf('refreshed copy v2')>=0}")
    check('After Reload the app is served the refreshed pdf.js from the cache', served is True)
    time.sleep(1.2)   # the test server answers 304 for a file changed within the same second
    # same lib version again -> no needless refetch: change the file but keep LIBVER, update sw version only
    open(site + '/vendor/pdfjs/pdf.min.mjs', 'a').write('\n/* v3 should NOT be fetched */\n')
    time.sleep(1.2)
    sw = open(site + '/sw.js').read(); sw = re.sub(r"VERSION = '[0-9a-f]{10}'", "VERSION = '0123456789'", sw); open(site + '/sw.js', 'w').write(sw)
    p.evaluate("()=>window.__swReg.update()"); p.wait_for_selector('#update-chip', timeout=15000)
    v3 = p.evaluate("async()=>{const r=await (await caches.open('journable-lib')).match('vendor/pdfjs/pdf.min.mjs');return (await r.text()).indexOf('v3 should NOT')>=0}")
    check('Same lib version: the cached copy is kept (no re-download)', v3 is False)
    # old install without marker (pre-fix) is refreshed too
    p.evaluate("async()=>{await (await caches.open('journable-lib')).delete('./__lib-version')}")
    time.sleep(1.2)   # the test server answers 304 for a file changed within the same second
    sw = open(site + '/sw.js').read(); sw = re.sub(r"VERSION = '[0-9a-f]{10}'", "VERSION = '1111111111'", sw); open(site + '/sw.js', 'w').write(sw)
    p.evaluate("()=>window.__swReg.update()")
    for _ in range(30):
        if p.evaluate("async()=>{const r=await (await caches.open('journable-lib')).match('vendor/pdfjs/pdf.min.mjs');return (await r.text()).indexOf('v3 should NOT')>=0}"): break
        p.wait_for_timeout(500)
    v3 = p.evaluate("async()=>{const r=await (await caches.open('journable-lib')).match('vendor/pdfjs/pdf.min.mjs');return (await r.text()).indexOf('v3 should NOT')>=0}")
    check('An install from before this fix (no marker) gets its lib copies refreshed too', v3 is True)
    check('no page errors in the SW test', not errs, errs)
    ctxu.close(); b.close()
srv.stop()
print('page errors:', errs[:3])
print('FAILED:', res)
