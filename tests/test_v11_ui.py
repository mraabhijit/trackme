"""v1.1 (file://): text size, chip, minimal Today, Daily goals numbers, sticky summary, swipe, meal detail, weight tracker, rename, multi-line."""
import sys, json, re, datetime
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
MOCK_ON = "window.__llmMock={extract:function(t){return {items:[]}},analyse:function(p){return 'This meal has a decent mix of protein and fibre. Fat is moderate.'}};localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"
def fs(p): return p.evaluate("()=>parseFloat(getComputedStyle(document.documentElement).fontSize)")

def seed_day(p, n=4):
    for t in ['2 roti, dal and 200 ml milk', 'rice and rajma 1 bowl', 'banana, 4 almonds', 'paneer 100 g and 2 roti'][:n]: quick(p, t)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    # ---------- text size ----------
    p = new_page(b, errs=errs); make_profile(p, 'Sz', 2000)
    check('Text size: default is Medium = 14px', fs(p) == 14 and p.evaluate("()=>JSON.parse(localStorage.getItem('dt:v1:ui')||'{}').fontSize||'medium'") == 'medium')
    goto(p, 'settings')
    labels = p.eval_on_selector_all('#fontsize-seg button', 'e=>e.map(x=>x.textContent)')
    check('Text size: selector offers Small, Medium, Large, Extra large', labels == ['Small', 'Medium', 'Large', 'Extra large'], labels)
    px = {}
    for key, want in (('small', 13), ('medium', 14), ('large', 16), ('xlarge', 18)):
        p.click('#fontsize-seg [data-size-opt=%s]' % key); px[key] = fs(p)
        check('Text size %s -> root %dpx, applied live and saved' % (key, want), px[key] == want and p.evaluate("()=>JSON.parse(localStorage.getItem('dt:v1:ui')).fontSize") == key, px)
    # applied before first paint: with app.js blocked, early.js alone has set the size
    p.route('**/app.js', lambda r: r.abort()); p.reload(); p.wait_for_timeout(300)
    check('Text size: applied by early.js before the app runs (app.js blocked)', fs(p) == 18, fs(p))
    p.unroute('**/app.js')
    # every screen fits at 360 for Small and Extra large, targets >= 44
    for key in ('small', 'xlarge'):
        p.goto(URL); p.wait_for_selector('#qbar'); goto(p, 'settings'); p.click('#fontsize-seg [data-size-opt=%s]' % key)
        goto(p, 'today'); seed_day(p, 2) if key == 'small' else None
        for v in ('today', 'add', 'weekly', 'weight', 'settings', 'goals', 'backup', 'about', 'water', 'saved', 'history', 'myfoods'):
            goto(p, v); p.wait_for_timeout(120)
            check('360px %s: %s no horizontal scroll and targets >= 44' % (key, v), not hscroll(p) and not small_targets(p, '#view'), (hscroll(p), small_targets(p, '#view')))
        goto(p, 'today'); p.click('.slot-title-btn'); p.wait_for_selector('#meal-card')
        check('360px %s: meal detail fits, targets >= 44' % key, not hscroll(p) and not small_targets(p, '#view'), (hscroll(p), small_targets(p, '#view')))
        p.click('#meal-back'); p.wait_for_selector('#today-pin')
        p.fill('#ql', 'a very long line of food words to wrap the preview sheet 2 roti and dal and rice'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
        check('360px %s: preview sheet fits' % key, not hscroll(p) and not p.evaluate("()=>{const s=document.querySelector('#pv-sheet');return s.scrollWidth>s.clientWidth+1}"))
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        if p.locator('#pv-sheet').count(): p.click('#pv-cancel') if p.locator('#pv-cancel').count() else None
        p.click('#menu-btn'); p.wait_for_timeout(350)
        check('360px %s: drawer fits' % key, not hscroll(p) and p.evaluate("()=>{const d=document.querySelector('#drawer');return d.scrollWidth<=d.clientWidth+1}"))
        p.keyboard.press('Escape'); p.wait_for_timeout(250)
    p.close()

    # ---------- chip states ----------
    p = new_page(b); check('Chip: no model -> exactly "Basic"', p.inner_text('#ai-chip').strip() == 'Basic')
    make_profile(p, 'Chp', 2000); p.close()
    p = new_page(b, init=MOCK_ON); make_profile(p, 'Chp', 2000)
    check('Chip: model downloaded and on -> "AI ready"', p.inner_text('#ai-chip').strip() == 'AI ready' and 'AI ready' in p.get_attribute('#ai-chip', 'aria-label'))
    p.close()
    p = new_page(b, init=MOCK_ON.replace("window.__llmMock={", "window.__llmMock={on:false,")); make_profile(p, 'Chp', 2000)
    t = p.inner_text('#ai-chip').strip()
    check('Chip: toggle off -> "Basic", never "AI off"/loading texts', t == 'Basic' and not re.search(r'AI off|loading|first use|%', p.inner_text('header, #hdr') ), t)
    p.close()

    # ---------- Today: removed blocks, kept blocks ----------
    p = new_page(b); make_profile(p, 'Tdy', 2000); seed_day(p, 2)
    t = p.text_content('#view')
    gone = ['Log a meal', 'Other meals', 'Your numbers', 'Last 7 days', 'Day total']
    check('Today: removed cards are gone (%s)' % ', '.join(gone), not any(g in t for g in gone), [g for g in gone if g in t])
    check('Today: Calories, Macros, Water and meal cards remain', all(x in t for x in ('Calories', 'Macros', 'Water')) and p.locator('.slot').count() >= 1)
    check('Today: per-meal subtotal kept', re.search(r'\d+ kcal', p.inner_text('.slot h3')) is not None)
    # Daily goals shows the moved numbers
    goto(p, 'goals'); g = p.inner_text('#view')
    check('Daily goals: target, burn, deficit and fibre are shown', all(p.locator(s).count() for s in ('#t-target', '#t-tdee', '#t-deficit', '#t-fibre')) and 'Fibre' in g)
    check('Daily goals: the deficit explanation is there', p.locator('#deficit-help').count() == 1)
    p.close()

    # ---------- sticky collapsing summary ----------
    for (w, h_, scheme, size) in ((360, 740, 'light', 'small'), (360, 740, 'dark', 'xlarge'), (412, 915, 'light', 'medium')):
        p = new_page(b, w, h_, scheme, errs=errs, init="localStorage.setItem('dt:v1:ui',JSON.stringify({fontSize:'%s'}))" % size)
        make_profile(p, 'Pin', 2000); seed_day(p, 4); tag = '%dx%d %s %s: ' % (w, h_, scheme, size)
        p.evaluate("()=>window.scrollTo(0,0)"); p.wait_for_timeout(500)
        check(tag + 'at the top the big Calories + Macros card is expanded, compact bar hidden', 'collapsed' not in p.get_attribute('#today-pin', 'class') and not p.is_visible('#sum-compact'))
        remaining = p.text_content('#t-remaining').strip()
        carbs = p.text_content('#t-c').strip()
        p.evaluate("()=>window.scrollTo(0,160)"); p.wait_for_timeout(700)
        check(tag + 'scrolled past ~60px the summary collapses to one compact bar', 'collapsed' in p.get_attribute('#today-pin', 'class') and p.is_visible('#sum-compact') and not p.is_visible('#t-bar'))
        ct = p.inner_text('#sum-compact')
        check(tag + 'compact bar shows Remaining (same number) and carbs / protein / fat as consumed / goal', remaining in p.inner_text('#c-remaining') and 'kcal' in p.inner_text('#c-remaining') and all(re.search(r'\d+ / \d+', p.inner_text(i)) for i in ('#c-carbs', '#c-protein', '#c-fat')) and p.inner_text('#c-carbs').strip() == carbs, (remaining, carbs, ct))
        check(tag + 'compact bar: no horizontal scroll, 4 columns fit', not hscroll(p) and p.evaluate("()=>{const c=document.querySelector('#sum-compact');return c.scrollWidth<=c.clientWidth+1}"))
        # nothing hidden behind the pinned area: each meal card can be scrolled to below the pin
        bad = p.evaluate("""()=>{const pin=document.querySelector('#today-pin').getBoundingClientRect(),out=[];document.querySelectorAll('.slot, #water-card').forEach(c=>{c.scrollIntoView();});
          const last=[...document.querySelectorAll('.slot')].pop();last.scrollIntoView();return last.getBoundingClientRect().top>=pin.bottom-2}""")
        p.wait_for_timeout(500)
        check(tag + 'scrolling a meal card into view leaves it below the pinned bar (scroll padding)', bad)
        qb = p.evaluate("()=>document.querySelector('#qbar').getBoundingClientRect().top")
        last_b = p.evaluate("()=>{const a=[...document.querySelectorAll('.slot')].pop();window.scrollTo(0,document.documentElement.scrollHeight);return a.getBoundingClientRect().bottom}")
        check(tag + 'at the page end the last card is above the quick-log bar', last_b <= qb + 1, (last_b, qb))
        # stability: wait and confirm no oscillation
        states = []
        for _ in range(6): p.wait_for_timeout(150); states.append('collapsed' in p.get_attribute('#today-pin', 'class'))
        check(tag + 'no flicker: state stays collapsed while scrolled', all(states), states)
        p.evaluate("()=>window.scrollTo(0,0)"); p.wait_for_timeout(700)
        check(tag + 'back at the top the big card returns', 'collapsed' not in p.get_attribute('#today-pin', 'class') and p.is_visible('#t-bar'))
        if scheme == 'light' and size == 'small':
            p.screenshot(path='/home/arch/projects/trackme/shots/today-expanded-%dx%d-%s-%s.png' % (w, h_, scheme, size))
            p.evaluate("()=>window.scrollTo(0,200)"); p.wait_for_timeout(700)
            p.screenshot(path='/home/arch/projects/trackme/shots/today-scrolled-%dx%d-%s-%s.png' % (w, h_, scheme, size))
        p.close()
    # short page: never collapses; over budget compact bar
    p = new_page(b, 360, 740); make_profile(p, 'Sh', 2000); quick(p, '1 roti')
    p.evaluate("()=>window.scrollTo(0,500)"); p.wait_for_timeout(600)
    check('Short page (cannot scroll) never collapses', 'collapsed' not in p.get_attribute('#today-pin', 'class'))
    p.close()
    p = new_page(b, 360, 740, 'dark'); make_profile(p, 'Ov', 1000)
    for t in ['4 roti and dal', 'rice and rajma 2 bowl', 'paneer 200 g and 4 roti', 'banana, 4 almonds']: quick(p, t)
    p.evaluate("()=>window.scrollTo(0,200)"); p.wait_for_timeout(700)
    rl = p.inner_text('#c-remaining'); lab = p.inner_text('#c-remaining-label')
    check('Over budget: compact bar shows a negative value with the word "over", in the warning colour', rl.strip().startswith('-') and 'over' in lab.lower() and p.evaluate("()=>{const e=document.querySelector('#c-remaining');return getComputedStyle(e).color!==getComputedStyle(document.querySelector('#c-protein')).color}"), (rl, lab))
    p.screenshot(path='/home/arch/projects/trackme/shots/today-scrolled-over-360x740-dark.png'); p.close()

    # ---------- swipe between dates ----------
    p = new_page(b, 360, 740, errs=errs); make_profile(p, 'Sw', 2000); seed_day(p, 4); T = today_of(p)
    def swipe(dx, dy=0, x0=180, y0=520):
        p.mouse.move(x0, y0); p.mouse.down(); p.mouse.move(x0 + dx / 2, y0 + dy / 2); p.mouse.move(x0 + dx, y0 + dy); p.mouse.up(); p.wait_for_timeout(350)
    def sel(): return p.get_attribute('#week-strip [aria-pressed=true]', 'data-date')
    p.evaluate("()=>window.scrollTo(0,0)"); p.wait_for_timeout(300)
    check('Swipe: starts on today', sel() == T)
    swipe(130); check('Swipe right = previous day, header date label updates', sel() == addd(T, -1) and p.inner_text('#date-btn').strip() != 'Today', (sel(), p.inner_text('#date-btn')))
    swipe(130); check('Swipe right again = one more day back', sel() == addd(T, -2))
    swipe(-130); swipe(-130); check('Swipe left twice returns to today (label "Today")', sel() == T and p.inner_text('#date-btn').strip() == 'Today')
    swipe(-130); check('Swipe toward the future at today is a no-op', sel() == T)
    check('Future days in the week strip are disabled', p.evaluate("()=>[...document.querySelectorAll('#week-strip button')].filter(b=>b.dataset.date>'%s').every(b=>b.disabled)" % T))
    p.click('#date-btn'); p.wait_for_selector('[role=dialog], #cal-sheet, .sheet'); 
    mx = p.evaluate("()=>[...document.querySelectorAll('input[type=date]')].map(i=>i.max)")
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    swipe(30, 120); check('Vertical-ish drag does not change the date', sel() == T)
    swipe(50); check('Short horizontal drag (< 60px) does not change the date', sel() == T)
    swipe(100, 80); check('Diagonal drag (|dx| < 1.5|dy|) does not change the date', sel() == T)
    # ignored zones
    p.mouse.move(120, 700); p.mouse.down(); p.mouse.move(250, 700); p.mouse.up(); p.wait_for_timeout(300)
    check('Swipe starting in the quick-log bar does nothing', sel() == T)
    p.fill('#ql', 'x'); p.mouse.move(100, 700); p.mouse.down(); p.mouse.move(260, 700); p.mouse.up(); p.wait_for_timeout(300); p.fill('#ql', '')
    check('Swipe in the quick-log input does nothing', sel() == T)
    p.fill('#ql', 'roti'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    p.mouse.move(100, 500); p.mouse.down(); p.mouse.move(260, 500); p.mouse.up(); p.wait_for_timeout(300)
    check('Swipe inside an open sheet does nothing', sel() == T and p.locator('#pv-sheet').count() == 1, sel())
    p.keyboard.press('Escape'); p.wait_for_timeout(300)
    if p.locator('#pv-sheet').count(): p.evaluate("()=>document.querySelector('#pv-sheet').remove()")
    p.close()

    # ---------- meal detail ----------
    p = new_page(b, 360, 740, errs=errs, init=MOCK_ON); make_profile(p, 'Mdl', 2000)
    quick(p, '2 roti, dal and 200 ml milk'); quick(p, 'banana', True)
    n_slots = p.locator('.slot').count()
    p.click('.slot >> nth=0 >> .slot-title-btn'); p.wait_for_selector('#meal-card')
    check('Meal detail: opens from the card title, with back arrow, items, totals, time', p.locator('#meal-back').count() == 1 and p.locator('#meal-card .entry').count() >= 3 and p.locator('#meal-totals').count() == 1 and p.locator('#meal-time').count() == 1)
    names = p.eval_on_selector_all('#meal-card .entry b', 'e=>e.map(x=>x.textContent)')
    check('Meal detail: each item shows name, quantity as typed (200 ml) and kcal/carbs/protein/fat chips', any('milk' in n.lower() for n in names) and '200 ml' in p.inner_text('#meal-card') and all(k in p.inner_text('#meal-card .entry') for k in ('Calories', 'Carbs', 'Protein', 'Fat')))
    check('Meal detail: totals row has % of the daily goal and bars', len(re.findall(r'\d+%', p.inner_text('#meal-totals'))) == 4 and p.locator('#meal-totals .pbar').count() == 4)
    kc = sum(int(x) for x in re.findall(r'Calories: (\d+)', p.inner_text('#meal-card')))
    mt = int(p.inner_text('#mt-kcal'))
    check('Meal detail: total calories = sum of item calories (+-2 rounding)', abs(kc - mt) <= 2, (kc, mt))
    nf = p.inner_text('#nf-card')
    check('Nutrition facts: only nutrients the table has (carbs, fibre, protein, fat); no invented sodium/iron/vitamins rows', all(x in nf for x in ('Total carbohydrates', 'Dietary fibre', 'Protein', 'Total fat')) and not re.search(r'Sodium|Iron|Vitamin|Calcium|Potassium|Cholesterol', nf.split('Only the nutrients')[0]), nf)
    check('Nutrition facts: carbs sum matches the totals row', abs(float(p.inner_text('#nf-carbs').split()[-2]) - float(p.inner_text('#mt-c').replace('g', ''))) <= 1.0)
    check('Meal detail: 360px no horizontal scroll, targets >= 44', not hscroll(p) and not small_targets(p, '#view'), small_targets(p, '#view'))
    check('Health analysis: button enabled when AI is ready, labelled AI-written text appears on demand (mock)', p.is_enabled('#an-btn') and p.inner_text('#an-text').strip() == '')
    p.click('#an-btn'); p.wait_for_selector('#an-text:not(:empty)')
    check('Health analysis: result shown as text with "AI-written, not medical advice"', 'decent mix' in p.inner_text('#an-text') and 'AI-written, not medical advice' in p.inner_text('#an-note'))
    p.click('#meal-back'); p.click('.slot >> nth=0 >> .slot-title-btn'); p.wait_for_selector('#meal-card')
    check('Health analysis: cached in memory per meal state (shown again without a new call)', 'decent mix' in p.inner_text('#an-text'))
    check('Meal detail: nothing stored for the analysis', 'decent mix' not in p.evaluate("()=>Object.values(localStorage).join('|')"))
    p.screenshot(path='/home/arch/projects/trackme/shots/meal-detail-360x740-light.png', full_page=True)
    p.close()
    # analysis disabled without AI, cancel path, timeout
    p = new_page(b, 360, 740); make_profile(p, 'Mdl', 2000); quick(p, '2 roti and dal')
    p.click('.slot-title-btn'); p.wait_for_selector('#meal-card')
    check('Health analysis: disabled with a hint when AI is not ready', p.is_disabled('#an-btn') and 'Turn on the on-device AI' in p.inner_text('#an-note'))
    p.click('#meal-back'); p.click('.slot', position={'x': 3, 'y': 3}); p.wait_for_timeout(300)
    check('Meal detail: tapping the card body (not a button) opens it', p.locator('#meal-card').count() == 1)
    p.click('#meal-back'); p.click('.slot h3 .slot-menu-btn'); p.wait_for_selector('#slot-menu'); check('Slot menu button opens the menu, not the detail', p.locator('#meal-card').count() == 0); p.keyboard.press('Escape'); p.wait_for_timeout(250)
    p.click('.slot .entry .top .grow'); p.wait_for_timeout(300)
    check('Tapping an item row on the card opens the detail', p.locator('#meal-card').count() == 1)
    p.close()
    slow = "window.__llmMock={extract:function(t){return {items:[]}},analyse:function(p){return new Promise(function(){})},cancel:function(){}};window.__llmTimeoutMs=1500;localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"
    p = new_page(b, 360, 740, init=slow); make_profile(p, 'Mdl', 2000); quick(p, '2 roti')
    p.click('.slot-title-btn'); p.wait_for_selector('#meal-card'); p.click('#an-btn'); p.wait_for_selector('#an-cancel')
    check('Health analysis: shows Cancel while running', p.locator('#an-cancel').count() == 1)
    p.click('#an-cancel'); p.wait_for_timeout(300)
    check('Health analysis: cancel returns to the button with a note', p.is_enabled('#an-btn') and 'Cancelled' in p.inner_text('#an-note'))
    p.click('#an-btn'); p.wait_for_timeout(2200)
    check('Health analysis: times out cleanly', p.is_enabled('#an-btn') and 'too long' in p.inner_text('#an-note'), p.inner_text('#health-card'))
    p.close()
    # AI-estimated rows: tag in the meal detail, only macros in facts
    est = "window.__llmMock={extract:function(t){return {items:[{type:'food',text:'zorbaflux 1 bowl',name:'zorbaflux',qty:1,unit:'bowl',kcal:200,protein:10,carbs:20,fat:8,grams:150,estimated:true}]}}};localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"
    p = new_page(b, 360, 740, init=est); make_profile(p, 'Est', 2000)
    p.fill('#ql', 'zorbaflux 1 bowl'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet .pv-row'); p.wait_for_timeout(500)
    if p.locator('#pv-save:not([disabled])').count():
        p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
        p.click('.slot-title-btn'); p.wait_for_selector('#meal-card')
        check('Meal detail: AI-estimated row carries the AI tag; fibre row omitted (no data)', p.locator('#meal-card .tag.ai').count() == 1 and p.locator('#nf-fibre').count() == 0 and 'AI-estimated' in p.inner_text('#nf-note'), p.inner_text('#nf-card'))
    else:
        check('Meal detail AI-estimated row', False, 'could not save estimate row')
    p.close()

    # ---------- weight tracker ----------
    p = new_page(b, 360, 740, errs=errs); TODAY = today_of(p); make_profile(p, 'Wt', 2000, kg=80)
    goto(p, 'weight'); p.wait_for_selector('#wt-chart')
    check('Weight 0 points: empty note, chart still draws, no horizontal scroll', 'No weights logged yet' in p.inner_text('#wt-empty') and p.locator('#wt-chart').count() == 1 and not hscroll(p))
    check('Weight cards show Current (start weight) and Target "-"', '80' in p.inner_text('#wt-current') and p.inner_text('#wt-target').strip() == '-')
    p.click('#wt-add'); p.wait_for_selector('#wt-sheet')
    check('Add weight sheet has kg, date and our time control', all(p.locator(s).count() for s in ('#w-kg', '#w-date', '#wt-h', '#wt-m')))
    p.fill('#w-kg', '79.4'); set_time(p, '07:45', 'wt'); p.click('#w-save'); p.wait_for_selector('#wt-sheet', state='detached')
    check('Weight 1 point: listed with date and time, chart has a point', p.locator('#wt-list .wt-item').count() == 1 and '7:45 AM' in p.inner_text('#wt-list') and p.locator('#wt-chart circle.pt').count() == 1 and '79.4' in p.inner_text('#wt-current'))
    check('Weight 1 point: no line is drawn for a single point', p.locator('#wt-line').count() == 0)
    # target weight via Daily goals
    goto(p, 'goals'); p.fill('#f-target', '72.5'); p.click('#save-profile'); p.wait_for_timeout(300)
    goto(p, 'weight'); p.wait_for_selector('#wt-chart')
    check('Target weight: card shows it and the dashed target line is drawn', '72.5' in p.inner_text('#wt-target') and p.locator('#wt-target-line').count() == 1)
    check('Target stored additively on the profile (targetWeightKg)', stored(p, 'profile').get('targetWeightKg') == 72.5)
    goto(p, 'goals'); p.fill('#f-target', ''); p.click('#save-profile'); p.wait_for_timeout(300); goto(p, 'weight')
    check('Target weight cleared -> no target line', p.locator('#wt-target-line').count() == 0 and p.inner_text('#wt-target').strip() == '-')
    # edit, delete, undo
    p.click('#wt-list .wt-item'); p.wait_for_selector('#wt-sheet'); p.fill('#w-kg', '79.0'); p.click('#w-save'); p.wait_for_selector('#wt-sheet', state='detached')
    check('Weight edit: value updated in list', '79 kg' in p.inner_text('#wt-list') or '79.0' in p.inner_text('#wt-list'))
    p.click('#wt-list .wt-item'); p.wait_for_selector('#w-delete'); p.click('#w-delete'); p.wait_for_selector('#wt-sheet', state='detached')
    check('Weight delete: removed, empty note back', p.locator('#wt-list .wt-item').count() == 0)
    p.click('#toasts button'); p.wait_for_timeout(300)
    check('Weight delete: Undo restores the weigh-in', p.locator('#wt-list .wt-item').count() == 1)
    # ranges with many points
    p.close()
    prof = dict(PROF); prof['targetWeightKg'] = 70.0
    T0 = TODAY; ws = [{'date': addd(T0, -i), 'kg': round(80 - i * 0.04, 1), 'time': '07:%02d' % (i % 60)} for i in range(0, 200)]
    backup_file('/tmp/v11_w200.json', prof, {}, weights=ws)
    p = new_page(b, 360, 740, errs=errs); make_profile(p, 'Tmp', 2000); import_file(p, '/tmp/v11_w200.json'); pick_person(p, 'Imported')
    goto(p, 'weight'); p.wait_for_selector('#wt-chart')
    counts = {}
    for r in ('week', 'month', 'year', 'all'):
        p.click('#wt-range [data-range=%s]' % r); p.wait_for_timeout(150)
        counts[r] = (p.locator('#wt-list .wt-item').count(), p.locator('#wt-chart circle.pt').count())
    check('Weight ranges filter points: Week 7, Month 30, Year/All 200', counts['week'] == (7, 7) and counts['month'] == (30, 30) and counts['year'] == (200, 200) and counts['all'] == (200, 200), counts)
    check('Weight 200 points: line + dashed target line, no horizontal scroll, ticks present', p.locator('#wt-line').count() == 1 and p.locator('#wt-target-line').count() == 1 and p.locator('#wt-chart .xtick').count() >= 4 and p.locator('#wt-chart .ytick').count() >= 3 and not hscroll(p))
    check('Weight list shows the stored time', re.search(r'\d{1,2}:\d{2} (AM|PM)', p.inner_text('#wt-list')) is not None)
    p.screenshot(path='/home/arch/projects/trackme/shots/weight-360x740-light.png', full_page=True)
    p.close()

    # ---------- old backups (no time / no target) and export carries the new fields ----------
    prof = dict(OLDPROF); ws = [{'date': addd(TODAY, -3), 'kg': 70.5}]
    backup_file('/tmp/v11_old.json', prof, {}, weights=ws)
    p = new_page(b, errs=errs); make_profile(p, 'Tmp', 2000); import_file(p, '/tmp/v11_old.json'); pick_person(p, 'OldTimer')
    goto(p, 'weight'); p.wait_for_selector('#wt-chart')
    check('Old backup (no weight time, no target) imports and shows in Weight tracker', '70.5' in p.inner_text('#wt-current') and p.inner_text('#wt-target').strip() == '-')
    p.close()
    prof = dict(PROF); prof['targetWeightKg'] = 68.0
    ent_ai = ent(1, TODAY, 100, name='AI food', est='ai'); 
    backup_file('/tmp/v11_new.json', prof, {TODAY[:7]: [ent_ai]}, weights=[{'date': TODAY, 'kg': 71.2, 'time': '06:30'}])
    p = new_page(b, errs=errs); make_profile(p, 'Tmp', 2000); import_file(p, '/tmp/v11_new.json'); pick_person(p, 'Imported')
    with p.expect_download() as dl: p.click('#export-one') if (goto(p, 'backup') or True) else None
    path = '/tmp/v11_export.json'; dl.value.save_as(path); fn = dl.value.suggested_filename; ex = json.load(open(path))
    pr = ex['profiles'][0]
    check('Export carries weight time, targetWeightKg and est:ai; format marker unchanged (diet-tracker, schema 1)', ex['app'] == 'diet-tracker' and ex['schema'] == 1 and pr['weights'][0].get('time') == '06:30' and pr['profile'].get('targetWeightKg') == 68.0 and any(e.get('est') == 'ai' for v in pr['entries'].values() for e in v), (ex['app'], pr['weights']))
    check('Export file name is trackme-backup-<date>.json', re.match(r'^trackme-backup-\d{4}-\d{2}-\d{2}\.json$', fn) is not None, fn)
    p.close()
    # new export (with weight time, target, est:ai) imports into the OLD app without crashing
    ctx = b.new_context(viewport={'width': 390, 'height': 844}); po = ctx.new_page(); oerrs = []
    po.on('pageerror', lambda e: oerrs.append(str(e)))
    po.goto(OLD); po.set_input_files('#import-file', path); po.wait_for_selector('#import-apply'); po.click('#import-apply'); po.wait_for_selector('#import-summary, nav.tabs'); po.wait_for_timeout(200)
    po.click('nav.tabs button[data-tab=today]'); txt = po.inner_text('#view')
    check('A new TrackMe export imports into the old diet-tracker.html without crashing and shows the AI food', 'Something went wrong' not in txt and po.locator('#crash').count() == 0 and 'AI food' in txt and not oerrs, (txt[:200], oerrs))
    po.click('nav.tabs button[data-tab=profile]') if po.locator('nav.tabs button[data-tab=profile]').count() else None
    check('Old app still opens other tabs after that import', po.locator('#crash').count() == 0)
    ctx.close()

    # ---------- no user-visible "Journable" anywhere ----------
    p = new_page(b, errs=errs); html = p.content()
    check('Rename: <title> is TrackMe', p.title() == 'TrackMe', p.title())
    make_profile(p, 'Rn', 2000); quick(p, '2 roti and dal'); texts = {}
    for v in ('today', 'goals', 'weekly', 'weight', 'water', 'saved', 'myfoods', 'history', 'backup', 'settings', 'about', 'ai', 'phone'):
        try:
            if v in ('ai', 'phone'):
                goto(p, 'settings'); p.evaluate("(v)=>{const b=document.querySelector('[data-view=%s]');}" % v)
                p.click('#menu-btn'); p.click('#drawer [data-view=%s]' % v) if p.locator('#drawer [data-view=%s]' % v).count() else p.keyboard.press('Escape')
            else: goto(p, v)
        except Exception: pass
        p.wait_for_timeout(100); texts[v] = p.text_content('body') + ' ' + (p.get_attribute('#drawer', 'innerHTML') or '')
    bad = [v for v, t in texts.items() if re.search('journable', t, re.I)]
    check('Rename: no "Journable" in the text of any screen or the drawer', not bad, bad)
    check('Rename: drawer brand says TrackMe', 'TrackMe' in p.text_content('#drawer'))
    goto(p, 'about'); check('About: names TrackMe, Version 1.1 and has a "What\'s new in 1.1" list of 3 to 6 bullets', 'TrackMe' in p.inner_text('#view') and 'Version 1.1' in p.inner_text('#view') and 3 <= p.locator('#whatsnew li').count() <= 6, p.locator('#whatsnew li').count())
    check('About: Install help mentions that an installed home-screen app keeps its old name/icon until reinstalled', re.search(r'reinstall', p.inner_text('#view'), re.I) is not None)
    man = json.load(open('/home/arch/projects/trackme/manifest.webmanifest'))
    check('Manifest: name and short_name TrackMe', man['name'] == 'TrackMe' and man['short_name'] == 'TrackMe')
    idx = open('/home/arch/projects/trackme/index.html').read()
    check('index.html: no "Journable" text (title, meta)', not re.search('journable', idx, re.I))
    p.close()

    print('console/page errors:', [e for e in errs if 'favicon' not in e][:5])
    check('no page errors in this suite', not [e for e in errs if e.startswith('pageerror')], errs[:3])
    b.close()
print('FAILED:', res)
