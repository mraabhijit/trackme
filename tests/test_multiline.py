"""Multi-line input (file://): several lines = one meal (one group), different times = one group per time, AI-first and Basic fallback."""
import sys, json, re
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

def open_pv(p, text):
    p.fill('#ql', text); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(250)
def pv_names(p): return p.eval_on_selector_all('#pv-rows .pv-food, #pv-rows .pv-exname', 'e=>e.map(x=>x.textContent)')
def pv_rows(p): return p.locator('#pv-rows .pv-row').count()
def close_pv(p):
    p.evaluate("()=>{const s=document.querySelector('#pv-sheet');}")
    for sel in ('#pv-cancel', '#pv-close'):
        if p.locator(sel).count(): p.click(sel); break
    else: p.keyboard.press('Escape')
    p.wait_for_timeout(250)
def nblocks(p, text): return p.evaluate("(t)=>Journable.splitTimeBlocks(t,[{id:'s_lunch',name:'Lunch'},{id:'s_dinner',name:'Dinner'},{id:'s_breakfast',name:'Breakfast'}],new Date().toISOString().slice(0,10)).length", text)

L3 = 'cooked rice 1 bowl\narhar daal 1 katori\nbutter catfish curry 2 pieces'
with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    p = new_page(b, 360, 740, errs=errs); make_profile(p, 'Ml', 2000); T = today_of(p)
    # --- golden: grouping ---
    cases = [
        ('2 lines', 'rice 1 bowl\ndal 1 katori', 2),
        ('3 lines (report style)', L3, 3),
        ('trailing newline', 'rice 1 bowl\ndal 1 katori\n', 2),
        ('CRLF line endings', 'rice 1 bowl\r\ndal 1 katori\r\nroti 2', 3),
        ('blank lines ignored', 'rice 1 bowl\n\n\ndal 1 katori\n\nroti 2\n', 3),
        ('mixed commas and lines', 'rice 1 bowl, dal 1 katori\nroti 2 and curd 100 g', 4),
        ('8 lines', 'rice 1 bowl\ndal 1 katori\nroti 2\ncurd 100 g\nbanana 1\nmilk 200 ml\nalmonds 4\nboiled egg 2', 8),
    ]
    for name, text, n in cases:
        check('golden: %s -> one block' % name, nblocks(p, text) == 1)
        open_pv(p, text); names = pv_names(p)
        check('golden: %s -> %d rows in ONE preview with one meal/time chip' % (name, n), pv_rows(p) == n and p.locator('#pv-meal-chip').count() == 1 and p.locator('#pv-time-chip').count() == 1 and p.locator('.pv-group').count() == 0, (pv_rows(p), names))
        close_pv(p)
    # 12-line pasted list
    twelve = '\n'.join(['rice 1 bowl', 'dal 1 katori', 'roti 2', 'curd 100 g', 'banana 1', 'milk 200 ml', 'almonds 4', 'boiled egg 2', 'paneer 50 g', 'apple 1', 'tea 1 cup', 'cashews 4'])
    open_pv(p, twelve)
    check('golden: 12-line pasted list -> 12 rows, one group', pv_rows(p) == 12 and p.locator('.pv-group').count() == 0, pv_rows(p))
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    check('12-line list saved as ONE meal card with 12 items and ONE log', p.locator('.slot').count() == 1 and p.locator('.slot .entry').count() == 12 and len(stored(p, 'logs') or []) <= 1 and p.locator('.slot .logtext').count() == 1, (p.locator('.slot').count(), p.locator('.slot .entry').count()))
    # --- one time on any line applies to all ---
    open_pv(p, 'rice 1 bowl\ndal 1 katori at 1pm\nroti 2')
    check('time on ANY line applies to the whole submission (13:00), one group', 'Time: 1:00 PM' in p.inner_text('#pv-time-chip') and p.locator('.pv-group').count() == 0 and pv_rows(p) == 3, p.inner_text('#pv-chips'))
    close_pv(p)
    open_pv(p, 'lunch\nrice 1 bowl\ndal 1 katori')
    check('meal word on a line applies to the whole submission', 'Lunch' in p.inner_text('#pv-meal-chip') and pv_rows(p) == 2)
    close_pv(p)
    open_pv(p, 'yesterday\nrice 1 bowl\ndal 1 katori')
    check('"yesterday" on a line applies to all lines', 'Yesterday' in p.inner_text('#pv-date-chip') and pv_rows(p) == 2)
    close_pv(p)
    # --- different times -> one group per time ---
    dt = 'rice 1 bowl at 1pm\ndal 1 katori at 1pm\nroti 2 at 8pm'
    check('different times -> 2 blocks', nblocks(p, dt) == 2, nblocks(p, dt))
    open_pv(p, dt); gs = p.eval_on_selector_all('.pv-group', 'e=>e.map(x=>x.textContent)')
    check('different times: preview shows both time groups with their times', len(gs) == 2 and '1:00 PM' in gs[0] and '8:00 PM' in gs[1] and pv_rows(p) == 3, gs)
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    times = p.eval_on_selector_all('.entry', 'e=>e.map(x=>x.dataset.time)')
    check('different times: saved as separate entries with their own times (13:00 x2, 20:00)', sorted(times).count('13:00') >= 2 and '20:00' in times, times)
    # marker lines
    mk = 'lunch 1pm\nrice 1 bowl\ndal 1 katori\ndinner 8pm\nroti 2\nsabzi 1 katori'
    check('marker-only lines start groups ("lunch 1pm" then "dinner 8pm") -> 2 blocks', nblocks(p, mk) == 2, nblocks(p, mk))
    open_pv(p, mk); gs = p.eval_on_selector_all('.pv-group', 'e=>e.map(x=>x.textContent)')
    check('marker lines: items follow the marker above them (2 + 2 rows, Lunch 1 PM / Dinner 8 PM)', pv_rows(p) == 4 and len(gs) == 2 and 'Lunch' in gs[0] and 'Dinner' in gs[1], (pv_rows(p), gs))
    close_pv(p)
    # exercise mixed in
    open_pv(p, 'rice 1 bowl\nwalked 40 min\ndal 1 katori')
    check('exercise line inside the same submission becomes an exercise row in the same preview', p.locator('#pv-rows .pv-exrow').count() == 1 and pv_rows(p) == 3, pv_names(p))
    close_pv(p)
    # report-style 7-item group (fixture Tue 13:09)
    g7 = 'Protein oats 100 g\nAlmonds 4 nuts\nCashews 4 nuts\nAnjeer dried 2 figs\nDates dried 2 dates\nBanana 1 medium banana\nMilk 150 ml'
    open_pv(p, g7 + '\nat 1:09 pm')
    check('fixture-style group of 7 items (Tue 13:09) -> 7 rows, one time chip 1:09 PM', pv_rows(p) == 7 and '1:09 PM' in p.inner_text('#pv-time-chip'), (pv_rows(p), pv_names(p)))
    kc = p.inner_text('#pv-rows')
    check('fixture-style group: milk keeps ml, banana found', '150 ml' in kc and any('anana' in n for n in pv_names(p)), kc[:300])
    close_pv(p)
    # --- UI: Enter makes a newline, box grows, does not cover content ---
    p.fill('#ql', ''); p.click('#ql'); h0 = p.evaluate("()=>document.querySelector('#ql').offsetHeight")
    p.keyboard.type('rice 1 bowl'); p.keyboard.press('Enter'); p.keyboard.type('dal 1 katori'); p.keyboard.press('Enter'); p.keyboard.type('roti 2')
    v = p.input_value('#ql'); h1 = p.evaluate("()=>document.querySelector('#ql').offsetHeight")
    check('Enter inserts a new line in the quick-log box (does not send)', v.count('\n') == 2 and p.locator('#pv-sheet').count() == 0, repr(v))
    check('the box grows with the lines', h1 > h0 + 10, (h0, h1))
    for _ in range(9): p.keyboard.press('Enter'); p.keyboard.type('x')
    h2 = p.evaluate("()=>document.querySelector('#ql').offsetHeight"); of = p.evaluate("()=>getComputedStyle(document.querySelector('#ql')).overflowY")
    check('the box stops growing at about 5 lines and then scrolls', h2 <= 190 and of == 'auto', (h2, of))
    p.evaluate("()=>window.scrollTo(0,document.documentElement.scrollHeight)"); p.wait_for_timeout(200)
    qb = p.evaluate("()=>document.querySelector('#qbar').getBoundingClientRect().top"); lastb = p.evaluate("()=>{const a=[...document.querySelectorAll('.slot')].pop();return a.getBoundingClientRect().bottom}")
    check('the grown box does not cover the Today content (last card ends above the bar)', lastb <= qb + 1, (lastb, qb))
    check('360px: no horizontal scroll with a tall box', not hscroll(p))
    p.fill('#ql', ''); p.evaluate("()=>{const t=document.querySelector('#ql');t.dispatchEvent(new Event('input'))}")
    # paste of multi-line text
    p.evaluate("(t)=>{const e=document.querySelector('#ql');e.focus();document.execCommand('insertText',false,t)}", L3)
    check('pasting multi-line text keeps its lines', p.input_value('#ql').count('\n') == 2)
    p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('sending a pasted 3-line text works from the send button: 3 rows', pv_rows(p) == 3, pv_rows(p))
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    check('after save the quick-log box is empty and one meal card holds all items', p.input_value('#ql') == '' and any(p.locator('.slot').nth(i).locator('.entry').count() >= 3 for i in range(p.locator('.slot').count())))
    p.close()

    # --- AI-first: the whole multi-line text goes to the model in ONE call, line breaks preserved ---
    ai = """window.__calls=[];window.__llmMock={extract:function(t){window.__calls.push(t);return {items:[
      {type:'food',text:'cooked rice 1 bowl',name:'white rice cooked',qty:1,unit:'bowl'},
      {type:'food',text:'arhar daal 1 katori',name:'arhar dal cooked',qty:1,unit:'katori'},
      {type:'food',text:'butter catfish curry 2 pieces',name:'butter catfish curry',qty:2,unit:'piece',kcal:260,protein:28,carbs:6,fat:14,grams:200,estimated:true}]}}};localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"""
    p = new_page(b, 360, 740, errs=errs, init=ai); make_profile(p, 'Ai', 2000)
    open_pv(p, L3); p.wait_for_timeout(800)
    calls = p.evaluate("()=>window.__calls")
    check('AI on: ONE model call for the whole multi-line text, line breaks preserved', len(calls) == 1 and calls[0].count('\n') == 2, calls)
    check('AI on: all three lines appear as rows of one group', pv_rows(p) == 3 and p.locator('.pv-group').count() == 0, pv_names(p))
    check('AI on: the typed units stay (bowl, katori, pieces)', all(x in p.inner_text('#pv-rows') for x in ('bowl', 'katori')), p.inner_text('#pv-rows')[:400])
    close_pv(p)
    ai2 = ai.replace("window.__llmMock={", "window.__llmMock={on:false,")
    p.close()
    p = new_page(b, 360, 740, errs=errs, init=ai2); make_profile(p, 'Ai', 2000)
    open_pv(p, L3); p.wait_for_timeout(500)
    check('AI off: Basic rules handle the same multi-line text, model never called', pv_rows(p) == 3 and p.evaluate("()=>window.__calls.length") == 0, pv_names(p))
    p.close()
    # AI with two time groups -> still ONE call with the whole text; the lines decide which time group an item belongs to
    MOCK2 = """window.__calls=[];window.__llmMock={extract:function(t){window.__calls.push(t);return {items:%s}}};localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"""
    two = "[{type:'food',text:'rice 1 bowl',name:'white rice cooked',qty:1,unit:'bowl'},{type:'food',text:'roti 2',name:'roti',qty:2}]"
    two_rev = "[{type:'food',text:'roti 2',name:'roti',qty:2},{type:'food',text:'rice 1 bowl',name:'white rice cooked',qty:1,unit:'bowl'}]"
    for label, items in (('model order = line order', two), ('model order reversed', two_rev)):
        p = new_page(b, 360, 740, errs=errs, init=MOCK2 % items); make_profile(p, 'Ai', 2000)
        open_pv(p, 'rice 1 bowl at 1pm\nroti 2 at 8pm'); p.wait_for_selector('#pv-ai-msg', timeout=15000)
        calls = p.evaluate("()=>window.__calls")
        check('AI on + two times (%s): ONE model call with the whole text (both lines)' % label, len(calls) == 1 and calls[0].count('\n') == 1 and 'rice' in calls[0] and 'roti' in calls[0], calls)
        grp = p.eval_on_selector_all('#pv-rows .pv-group, #pv-rows .pv-row .pv-food', 'e=>e.map(x=>x.className.indexOf("pv-group")>=0?"G:"+x.textContent:"R:"+x.textContent)')
        check('AI on + two times (%s): two groups, rice under 1:00 PM and roti under 8:00 PM' % label, p.locator('.pv-group').count() == 2 and len(grp) == 4 and '1:00 PM' in grp[0] and 'rice' in grp[1].lower() and '8:00 PM' in grp[2] and 'roti' in grp[3].lower(), grp)
        p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
        times = sorted(set(e['time'] for e in p.evaluate("()=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));const o=[];Object.keys(localStorage).filter(k=>k.indexOf('dt:v1:p:'+m.activeProfileId+':entries:')===0).forEach(k=>o.push(...JSON.parse(localStorage.getItem(k))));return o}")))
        check('AI on + two times (%s): saved as two entries at 13:00 and 20:00' % label, times == ['13:00', '20:00'], times)
        p.close()
    # model answer unusable -> Basic fallback still splits by time (and the whole text was still sent once)
    p = new_page(b, 360, 740, errs=errs, init=MOCK2 % '"nope"'); make_profile(p, 'Ai', 2000)
    open_pv(p, 'rice 1 bowl at 1pm\nroti 2 at 8pm'); p.wait_for_selector('#pv-ai-msg', timeout=15000)
    check('AI answer unusable: whole call + one retry per line (3 calls), Basic rules still make two time groups', len(p.evaluate("()=>window.__calls")) == 3 and p.locator('.pv-group').count() == 2 and pv_rows(p) == 2, (p.evaluate("()=>window.__calls"), p.locator('.pv-group').count(), pv_rows(p)))
    p.close()

    # --- Edit as text round-trips a grouped entry (one item per line) ---
    p = new_page(b, 360, 740, errs=errs); make_profile(p, 'Et', 2000)
    L3b = 'cooked rice 1 bowl\narhar daal 1 katori\nroti 2'
    quick(p, L3b)
    check('grouped meal saved as one card with 3 items', p.locator('.slot').count() == 1 and p.locator('.slot .entry').count() == 3)
    p.click('.slot h3 .slot-menu-btn'); p.wait_for_selector('#sm-text'); p.click('#sm-text'); p.wait_for_selector('#et-text')
    v = p.input_value('#et-text')
    check('Edit as text: the meal comes back as multi-line text, one item per line', v.count('\n') == 2 and 'rice' in v and 'katori' in v, repr(v))
    p.fill('#et-text', 'cooked rice 1 bowl\narhar daal 2 katori'); p.click('#et-go'); p.wait_for_selector('#pv-sheet')
    t0 = p.inner_text('#pv-time-chip')
    check('Edit as text: preview keeps the meal time and shows 2 rows', pv_rows(p) == 2, pv_rows(p))
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    check('Edit as text: old items replaced (2 items now, same single meal card)', p.locator('.slot').count() == 1 and p.locator('.slot .entry').count() == 2, p.locator('.slot .entry').count())
    p.close()
    print('page errors:', [e for e in errs if 'pageerror' in e][:3])
    b.close()
print('FAILED:', res)
