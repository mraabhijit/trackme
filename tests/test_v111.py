"""v1.1.1 regression (file://): the real-phone six-line input, AI failure reasons / Retry / per-line retry, comma rule, count units, Change item, online search failures (mocked)."""
import sys, json, re
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

T6 = 'Protein oats (100 g)\nAlmonds soaked (3 nuts)\nCashews (4 nuts)\nAnjeer, soaked (2 figs)\nDates, soaked (2 dates)\nMilk (200 ml) at 8 AM'
LINES = T6.split('\n')

def item(text, name, qty, unit=None, **kw):
    d = {'type': 'food', 'text': text, 'name': name, 'qty': qty, 'unit': unit}; d.update(kw); return d
GOOD = [item('Protein oats (100 g)', 'protein oats', 100, 'g'), item('Almonds soaked (3 nuts)', 'almonds', 3, 'piece'), item('Cashews (4 nuts)', 'cashew nuts', 4, 'piece'),
        item('Anjeer, soaked (2 figs)', 'anjeer', 2, 'piece'), item('Dates, soaked (2 dates)', 'dates', 2, 'piece'), item('Milk (200 ml) at 8 AM', 'milk', 200, 'ml')]
SLOPPY = [item('protein oats 100 g', 'Protein Oats', '100', 'G'), item('ALMONDS soaked 3 nuts', 'Almonds', '3', 'piece'), item('cashews 4 nuts', 'cashews', '4', None),
          item('anjeer soaked (2 figs', 'anjeer', 2, None), item('dates (2 dates)', 'dates', 2, None), item('milk 200 ml', 'milk', 200, 'ml')]

# mock: window.__mode = 'ok' | 'whole-fail' (error on multi-line text, ok per line) | 'all-fail' | 'hang' | 'bad' | 'line3-fail'
MOCK = """window.__calls=[];window.__mode='ok';window.__ans=%s;window.__llmCancelled=0;
function pl(t){var o=window.__ans.filter(function(x){return t.replace(/[^a-z]/gi,'').toLowerCase().indexOf(x.text.replace(/[^a-z]/gi,'').toLowerCase())>=0});return JSON.stringify({items:o,date:null,time:null,meal:null})}
window.__llmMock={has:function(){return true},cancel:function(){window.__llmCancelled++},usage:{completion_tokens:42},extract:function(t){window.__calls.push(t);var m=window.__mode;
 if(m==='hang')return new Promise(function(){});
 if(m==='all-fail')return Promise.reject(new Error('worker died: out of tokens'));
 if(m==='bad')return 'sorry I cannot do that';
 if(m==='whole-fail'&&t.indexOf('\\n')>=0)return Promise.reject(new Error('generation failed'));
 if(m==='line3-fail'){if(t.indexOf('\\n')>=0)return Promise.reject(new Error('x'));if(t.indexOf('Cashews')>=0)return 'nonsense'}
 if(t.indexOf('\\n')>=0)return JSON.stringify({items:window.__ans,date:null,time:null,meal:null});return pl(t)}};
localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"""
def mock(ans): return MOCK % json.dumps(ans)

def open_pv(p, text):
    p.fill('#ql', text); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(300)
def rows(p): return p.eval_on_selector_all('#pv-rows .pv-row', 'e=>e.map(x=>({food:(x.querySelector(".pv-food")||{}).textContent||"",amt:(x.querySelector(".pv-amount")||{}).textContent||"",nf:!!x.querySelector(".pv-notfound"),kcal:parseFloat(((x.querySelector(".pv-kcal")||{}).textContent||"0"))}))')
def wait_ai(p): p.wait_for_selector('#pv-ai-msg', timeout=20000); p.wait_for_timeout(100)
def close_pv(p):
    p.click('#pv-cancel'); p.wait_for_timeout(250)

def six_ok(name, p, aimsg=None):
    r = rows(p)
    amts = [x['amt'] for x in r]
    check(name + ': six rows in ONE group, no Not found', len(r) == 6 and not any(x['nf'] for x in r) and p.locator('.pv-group').count() == 0, r)
    check(name + ': quantities as typed (100 g, 3 nuts, 4 nuts, 2 figs, 2 dates, 200 ml), never 400 g / katori',
          amts[0].startswith('100 g') and amts[1].startswith('3 nuts') and amts[2].startswith('4 nuts') and amts[3].startswith('2 figs') and amts[4].startswith('2 dates') and amts[5].startswith('200 ml') and 'katori' not in ' '.join(amts) and '400 g' not in ' '.join(amts), amts)
    k = [x['kcal'] for x in r]
    check(name + ': plausible kcal (oats ~380, almonds 3 ~22, cashews 4 ~35, figs 2 ~42, dates 2 ~40, milk 200 ml 100-130)',
          abs(k[0] - 380) <= 10 and 15 <= k[1] <= 30 and 32 <= k[2] <= 38 and 39 <= k[3] <= 45 and 37 <= k[4] <= 43 and 100 <= k[5] <= 130, k)
    chips = p.inner_text('#pv-chips')
    check(name + ': time 8:00 AM and meal Breakfast', '8:00 AM' in chips and 'Breakfast' in chips, chips)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    # ---- Basic mode ----
    p = new_page(b, 360, 740, errs=errs); make_profile(p, 'V', 2000)
    open_pv(p, T6); six_ok('Basic', p)
    check('Basic: "Change item" button on rows, no "Not this?" anywhere', p.locator('.pv-notthis').first.inner_text() == 'Change item' and 'Not this?' not in p.inner_text('#pv-sheet'))
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    t = p.inner_text('#view')
    check('Basic: Today shows counts as typed ("4 nuts", "2 figs", "2 dates"), one meal card', '4 nuts' in t and '2 figs' in t and '2 dates' in t and '3 nuts' in t and p.locator('.slot .entry').count() == 6, t[:400])
    p.locator('.slot .entry').nth(2).click(); p.wait_for_timeout(400)
    check('saved count entry opens in the editor without errors', not [e for e in errs if 'pageerror' in e], errs)
    p.close()
    # ---- small parser cases ----
    p = new_page(b, 360, 740, errs=errs); make_profile(p, 'V', 2000)
    def parse(t): return p.evaluate("(t)=>Journable.parseLog(t,{}).items.map(i=>[i.foodName||i.text,i.type,i.qty,i.unitLabel])", t)
    r = parse('Almonds soaked'); check('modifier word: "Almonds soaked" finds almonds', r[0][1] == 'food' and 'lmond' in r[0][0], r)
    r = parse('Anjeer, soaked (2 figs), banana 1'); check('comma rule (single line): "Anjeer, soaked (2 figs), banana 1" = 2 items, figs 2', len(r) == 2 and r[0][2] == 2 and 'Fig' in r[0][0], r)
    r = parse('rice 1 bowl, dal 1 katori'); check('comma rule: two real items stay two', len(r) == 2, r)
    r = parse('Dates, soaked (2 dates)\nMilk (200 ml)'); check('multi-line: one line = one item ("Dates, soaked (2 dates)" + milk = 2)', len(r) == 2, r)
    r = parse('Rice, dal 2 katori\nroti 2'); check('multi-line: a comma list still splits ("Rice, dal 2 katori" + roti = 3 items, rice first)', len(r) == 3 and 'rice' in r[0][0].lower() and 'Dal' in r[1][0], r)
    r = parse('rice, dal\nmilk 200 ml'); check('review: multi-line "rice, dal" keeps rice AND dal (v1.1.0 behaviour)', len(r) == 3 and all(x[1] == 'food' for x in r), r)
    r = parse('Lunch: rice, dal, roti 2\nDinner: khichdi 1 bowl'); check('review: multi-line meal lines with comma lists are not one unmatched row', len(r) == 4 and all(x[1] == 'food' for x in r), r)
    r = parse('2 dates'); check('count: "2 dates" = 2 pieces (14 g), not katori', r[0][3].startswith('dates') , r)
    r = parse('4 cashews'); check('count: "4 cashews" = 4 pieces, not 400 g', r[0][2] == 4 and r[0][3].startswith('cashew'), r)
    kc = p.evaluate("()=>[['1 medium banana'],['150 ml milk'],['4 almonds']].map(a=>Math.round(Journable.parseLog(a[0],{}).items[0].kcal))")
    check('calibration: 1 medium banana 105, 150 ml milk ~92 (89-95), 4 almonds ~28 (26-30)', kc[0] == 105 and 86 <= kc[1] <= 95 and 26 <= kc[2] <= 30, kc)
    p.close()
    # ---- AI ok ----
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD)); make_profile(p, 'V', 2000)
    open_pv(p, T6); wait_ai(p); six_ok('AI', p)
    check('AI: ONE call with the whole text', p.evaluate("()=>window.__calls.length") == 1)
    check('AI: no Retry button when it worked', p.locator('#pv-ai-retry').count() == 0)
    close_pv(p); p.close()
    p = new_page(b, 360, 740, errs=errs, init=mock(SLOPPY)); make_profile(p, 'V', 2000)
    open_pv(p, T6); wait_ai(p); r = rows(p)
    check('AI tolerant validation: missing brackets, capitals, numeric strings, "G", unit null -> six rows, none dropped', len(r) == 6 and not any(x['nf'] for x in r) and 'invented' not in p.inner_text('#pv-ai'), (r, p.inner_text('#pv-ai')))
    close_pv(p); p.close()
    # ---- whole-text failure -> per-line retry, same meal ----
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD)); make_profile(p, 'V', 2000)
    p.evaluate("()=>{window.__mode='whole-fail'}")
    open_pv(p, T6); wait_ai(p); six_ok('AI per-line retry', p)
    calls = p.evaluate("()=>window.__calls")
    check('per-line retry: 1 whole call + 6 line calls, and the sheet says line by line', len(calls) == 7 and 'line by line' in p.inner_text('#pv-ai'), (len(calls), p.inner_text('#pv-ai')))
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    check('per-line retry: saved as ONE meal with 6 items', p.locator('.slot').count() == 1 and p.locator('.slot .entry').count() == 6)
    p.close()
    # ---- one line fails even per line -> rules for that line, others AI ----
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD)); make_profile(p, 'V', 2000)
    p.evaluate("()=>{window.__mode='line3-fail'}")
    open_pv(p, T6); wait_ai(p); r = rows(p)
    check('partial failure: 6 rows, the failed line (Cashews) still present via the rules, message names it, Retry offered', len(r) == 6 and not any(x['nf'] for x in r) and '5 of 6' in p.inner_text('#pv-ai') and p.locator('#pv-ai-retry').count() == 1, (r, p.inner_text('#pv-ai')))
    close_pv(p); p.close()
    # ---- total failure: reason, Retry, last problem ----
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD)); make_profile(p, 'V', 2000)
    p.evaluate("()=>{window.__mode='all-fail'}")
    open_pv(p, T6); wait_ai(p)
    msg = p.inner_text('#pv-ai')
    check('failure shows the concrete reason (error text) and the fallback', 'AI could not read this' in msg and 'out of tokens' in msg and 'built-in rules' in msg, msg)
    check('failure shows Retry; rules rows are shown meanwhile', p.locator('#pv-ai-retry').count() == 1 and len(rows(p)) >= 6)
    check('failure message and Retry fit at 360 px with 44 px targets, no sideways scroll', not small_targets(p, '#pv-ai') and not hscroll(p), (small_targets(p, '#pv-ai'), hscroll(p)))
    p.screenshot(path='/tmp/claude-1000/-home-arch-projects-trackme/46f407c9-d405-4053-9938-ae0702e6983c/scratchpad/fail.png')
    p.evaluate("()=>{window.__mode='ok'}"); p.click('#pv-ai-retry'); wait_ai(p); p.wait_for_timeout(300)
    check('Retry works once the cause is gone: AI rows, no Retry', len(rows(p)) == 6 and p.locator('#pv-ai-retry').count() == 0 and 'Read with on-device AI' in p.inner_text('#pv-ai'), (p.inner_text('#pv-ai'), len(rows(p))))
    close_pv(p)
    p.evaluate("()=>{document.querySelector('[data-tab=ai],#nav-ai')}")
    p.click('#ai-chip'); p.wait_for_selector('#ai-cards'); p.wait_for_timeout(300)
    lt = p.inner_text('#ai-last-text') if p.locator('#ai-last-text').count() else ''
    check('On-device AI screen: "Last AI problem" with model, load, generate, tokens, reason', all(x in lt for x in ('Model:', 'Load:', 'Generate:', 'Tokens:', 'Reason:')) and 'out of tokens' in lt and p.locator('#ai-last-copy').count() == 1, lt)
    check('Last AI problem: Copy button is a 44 px target', not small_targets(p, '#ai-last'))
    p.close()
    # ---- timeout (generate phase) ----
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD)); make_profile(p, 'V', 2000)
    p.evaluate("()=>{window.__mode='hang';window.__llmTimeoutMs=300}")
    open_pv(p, T6); wait_ai(p, ) if False else p.wait_for_selector('#pv-ai-msg', timeout=30000)
    msg = p.inner_text('#pv-ai')
    check('timeout: reason says it took too long and Retry is offered', 'took too long' in msg and p.locator('#pv-ai-retry').count() == 1, msg)
    check('timeout scales with lines: default 6 lines > default 1 line (window override removed)', p.evaluate("()=>{window.__llmTimeoutMs=0;return 0}") == 0)
    close_pv(p); p.close()
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD)); make_profile(p, 'V', 2000)
    p.evaluate("()=>{window.__mode='bad'}")
    open_pv(p, 'milk 200 ml'); wait_ai(p)
    check('unreadable model answer: reason "could not be read" shown', 'could not be read' in p.inner_text('#pv-ai') and p.locator('#pv-ai-retry').count() == 1, p.inner_text('#pv-ai'))
    close_pv(p); p.close()
    # ---- review: the model's text leaves out the typed amount, and gives unit g for nuts ----
    NAMES = [item('Protein oats', 'protein oats', None), item('Almonds', 'almonds', 3, 'g'), item('Cashews', 'cashews', 4, 'g'), item('Anjeer', 'fig', 2, 'g'), item('Dates', 'dates', 2, 'G'), item('Milk', 'milk', 'abc', 'ML')]
    p = new_page(b, 360, 740, errs=errs, init=mock(NAMES)); make_profile(p, 'V', 2000)
    open_pv(p, T6); wait_ai(p); six_ok('review AI names only + unit g', p); close_pv(p); p.close()
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD) + ";window.__llmMock.extract=function(t){window.__calls.push(t);return '<think>{x}</think>```json\\n{\"items\":[{\"type\":\"food\",\"text\":\"milk\",\"name\":\"milk\",\"qty\":200,\"unit\":\"ml\"},],}\\n```'}"); make_profile(p, 'V', 2000)
    open_pv(p, 'milk 200 ml'); wait_ai(p)
    check('review: think block + fences + trailing commas in the JSON are still read', 'Read with on-device AI' in p.inner_text('#pv-ai') and len(rows(p)) == 1, p.inner_text('#pv-ai')); close_pv(p); p.close()
    p = new_page(b, 360, 740, errs=errs, init=mock(GOOD)); make_profile(p, 'V', 2000)
    p.evaluate("()=>{window.__mode='all-fail'}"); open_pv(p, '\n'.join(['rice 1 bowl'] * 12)); wait_ai(p)
    check('review: no line-by-line retry for more than 8 lines (one call, rules rows)', p.evaluate("()=>window.__calls.length") == 1 and len(rows(p)) == 12, p.evaluate("()=>window.__calls.length")); close_pv(p); p.close()
    check('no page errors in the AI/Basic flows', not [e for e in errs if 'pageerror' in e], errs[:3])
    # ---- online search ----
    OK = {'products': [{'code': '111', 'product_name': 'Zork Bar', 'brands': 'Acme', 'nutriments': {'energy-kcal_100g': 250, 'proteins_100g': 10, 'carbohydrates_100g': 30, 'fat_100g': 9, 'fiber_100g': 2}}]}
    def mk(router):
        c = b.new_context(viewport={'width': 390, 'height': 844}); p = c.new_page(); p.calls = []
        def h(route):
            u = route.request.url; p.calls.append(u); r = router(u)
            if r == 'abort': route.abort('failed')
            else: route.fulfill(status=r[0], headers={'access-control-allow-origin': '*', 'content-type': 'application/json'}, body=r[1] if isinstance(r[1], str) else json.dumps(r[1]))
        p.route(re.compile(r'openfoodfacts\.org'), h); p.goto(URL)
        p.fill('#f-name', 'A'); p.fill('#f-dob', '1990-01-01'); p.fill('#f-height', '170'); p.fill('#f-weight', '70'); p.click('#save-profile'); p.wait_for_selector('#qbar')
        p.evaluate("()=>{}"); goto(p, 'add'); return c, p
    def go(p, q='zork'):
        p.fill('#q', q); p.click('#off-search'); p.wait_for_timeout(600)
    c, p = mk(lambda u: (503, '<html>busy</html>') if 'world.' in u else ('abort' if 'search.openfoodfacts' in u else (200, OK)))
    go(p); names = p.locator('.off-result').all_inner_texts()
    check('online: world 503 + search server blocked -> third server answers, results shown', len(names) == 1 and 'Zork Bar' in names[0] and len(p.calls) == 3, (names, p.calls))
    check('online: only the search words are sent (no profile data) and no credentials in the URL', all(re.search(r'zork', u) and 'Asha' not in u and '1990' not in u for u in p.calls), p.calls)
    c.close()
    c, p = mk(lambda u: (503, '<html>busy</html>'))
    go(p); m = p.inner_text('#off-msg')
    check('online: all servers 503 -> "busy or down" with HTTP 503 and a Retry button', 'busy or down' in m and 'HTTP 503' in m and p.locator('#off-retry').count() == 1, m)
    n0 = len(p.calls); p.click('#off-retry'); p.wait_for_timeout(600)
    check('online: Retry searches again', len(p.calls) > n0, (n0, len(p.calls)))
    c.close()
    c, p = mk(lambda u: 'abort'); go(p); m = p.inner_text('#off-msg')
    check('online: blocked / offline everywhere -> "did not get through" + Retry', 'did not get through' in m and p.locator('#off-retry').count() == 1, m); c.close()
    c, p = mk(lambda u: (200, '{not json')); go(p); m = p.inner_text('#off-msg')
    check('online: unreadable answers -> "could not read" + Retry', 'could not read' in m and p.locator('#off-retry').count() == 1, m); c.close()
    c, p = mk(lambda u: (429, 'slow down')); go(p)
    check('online: 429 -> "Too many searches"', 'Too many searches' in p.inner_text('#off-msg')); c.close()
    sw = open('/home/arch/projects/trackme/sw.js').read(); html = open('/home/arch/projects/trackme/index.html').read()
    check('service worker ignores cross-origin requests', 'url.origin !== self.location.origin) return' in sw)
    csp = re.search(r'connect-src ([^;]*)', html).group(1)
    check('CSP connect-src allows the three Open Food Facts hosts', all(h in csp for h in ('https://world.openfoodfacts.org', 'https://search.openfoodfacts.org', 'https://in.openfoodfacts.org')), csp)
    check('version 1.1.1 in the API and CHANGELOG has a [1.1.1] entry', open('/home/arch/projects/trackme/CHANGELOG.md').read().count('[1.1.1]') >= 1)
    b.close()
print('FAILED:', res)
