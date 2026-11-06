"""v1.1.7 regression (file://): AI engine stability. Duplicate rows, GPU-lifecycle errors recovered by one reload, serialized runs, stale results dropped, visibility, diagnostics."""
import sys, json
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

T5 = 'Cooked white rice (0.75 bowl)\nDaal (1 katori)\nPalak mixed vegetable curry (1 katori)\nSoya chunks and pointed gourd curry (1 katori)\nMethi Roti 2'
def item(text, name, qty, unit=None): return {'type': 'food', 'text': text, 'name': name, 'qty': qty, 'unit': unit}
ANS5 = [item('Cooked white rice (0.75 bowl)', 'cooked white rice', 0.75, 'bowl'), item('Daal (1 katori)', 'daal', 1, 'katori'),
        item('Palak mixed vegetable curry (1 katori)', 'palak curry', 1, 'katori'), item('Soya chunks and pointed gourd curry (1 katori)', 'soya curry', 1, 'katori'),
        item('Methi', 'methi', 2, 'piece'), item('Roti 2', 'roti', 2, 'piece')]
def js(o): return json.dumps(o)
# window.__ex(t,n) decides each call; __log records ordered events (call/done/cancel/load)
MOCK = """window.__log=[];window.__n=0;window.__loads=0;window.__beh=function(t,n){return null};
window.__llmMock={has:function(){return true},load:function(){window.__loads++;window.__log.push('load')},cancel:function(){window.__log.push('cancel')},usage:{completion_tokens:9},
 extract:function(t){var n=++window.__n;window.__log.push('call'+n);var b=window.__beh(t,n);
  if(b&&b.err){var e=new Error(b.err);if(b.name)e.name=b.name;return Promise.reject(e)}
  if(b&&b.hang)return new Promise(function(r){window.__rel=function(){window.__log.push('settled'+n);r('{}')}});
  if(b&&b.slow)return new Promise(function(r){setTimeout(function(){window.__log.push('done'+n);r(b.slow)},b.ms||600)});
  return b&&b.ans!=null?b.ans:'{}'}};
localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"""
def full(items): return json.dumps({'items': items, 'date': None, 'time': None, 'meal': None})
def rows(p): return p.eval_on_selector_all('#pv-rows .pv-row', 'e=>e.map(x=>((x.querySelector(".pv-food")||{}).textContent||"")+"|"+((x.querySelector(".pv-amount")||{}).textContent||""))')
def open_pv(p, text, wait=1500):
    p.fill('#ql', text); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(wait)
def beh(p, body): p.evaluate('()=>{window.__beh=' + body + '}')

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    def pg(timeout=None):
        init = MOCK + (';window.__llmTimeoutMs=%d' % timeout if timeout else '')
        p = new_page(b, 360, 740, errs=errs, init=init); make_profile(p, 'V', 2000); return p

    # (a) duplicate rows: whole text fails -> per line; the model answers line 5 with both items, and a second whole-text style answer must not add twice
    p = pg()
    beh(p, """function(t,n){if(t.indexOf('\\n')>=0)return {err:'device lost'};
      var m=%s.filter(function(x){return t.replace(/[^a-z]/gi,'').toLowerCase().indexOf(x.text.replace(/[^a-z]/gi,'').toLowerCase())>=0||(x.name==='methi'&&/methi/i.test(t))||(x.name==='roti'&&/roti/i.test(t))});
      return {ans:JSON.stringify({items:m,date:null,time:null,meal:null})}}""" % js(ANS5))
    open_pv(p, T5, 2500); r = rows(p)
    check('(a) per-line: 5 lines give exactly one row per food (no duplicates)', len(r) == len(set(r)) and len(r) in (5, 6), r)
    p.close()
    p = pg()
    beh(p, "function(t,n){return {ans:%s}}" % js(full(ANS5 + [ANS5[4], ANS5[5]])))
    open_pv(p, T5, 1500); r = rows(p)
    check('(a2) model repeats items: no duplicate rows', len(r) == len(set(r)), r)
    p.close()

    # (b) each GPU error string recovers with one reload and the AI rows are used
    for msg, nm in (("Failed to execute 'mapAsync' on 'GPUBuffer': Buffer was unmapped before mapping was resolved.", 'AbortError'),
                    ("Failed to execute 'mapAsync' on 'GPUBuffer': A valid external Instance reference no longer exists.", 'AbortError'),
                    ('The current Object has already been disposed', 'Error'),
                    ('Model not loaded before trying to complete ChatCompletionRequest.', 'ModelNotLoadedError'),
                    ('GPUDevice was lost: device lost', 'Error')):
        p = pg()
        beh(p, "function(t,n){if(n===1)return {err:%s,name:%s};return {ans:%s}}" % (js(msg), js(nm), js(full([item('milk 200 ml', 'milk', 200, 'ml')]))))
        open_pv(p, 'milk 200 ml', 1500)
        txt = p.inner_text('#pv-sheet'); ln = p.evaluate('()=>window.__log.join(",")')
        check('(b) %s: one reload, AI rows used' % msg[:40], 'Read with on-device AI' in txt and ln.count('load') >= 1 and ln.count('call') == 2, (ln, txt[:150]))
        p.close()

    # (c) two failures in a row: stop with a reason, no loop
    p = pg()
    beh(p, "function(t,n){return {err:'The current Object has already been disposed'}}")
    open_pv(p, 'milk 200 ml', 1500); txt = p.inner_text('#pv-sheet'); n = p.evaluate('()=>window.__n')
    check('(c) two GPU failures: falls back with a reason, no loop', 'AI could not read' in txt and n == 2 and p.locator('#pv-ai-retry').count() == 1, (n, txt[:200]))
    p.close()

    # (d) Retry clicked twice quickly: one result set, one run at a time
    p = pg()
    beh(p, "function(t,n){return {err:'x broke'}}")
    open_pv(p, 'milk 200 ml', 800)
    beh(p, "function(t,n){return {slow:%s,ms:500}}" % js(full([item('milk 200 ml', 'milk', 200, 'ml')])))
    p.evaluate("()=>{window.__log.length=0;var b=document.querySelector('#pv-ai-retry');b.click();var r=document.querySelector('#pv-reread');if(r)r.click()}")
    p.wait_for_timeout(300); p.evaluate("()=>{var b=document.querySelector('#pv-ai-retry')||document.querySelector('#pv-reread');if(b)b.click()}")
    p.wait_for_timeout(2500); r = rows(p); ln = p.evaluate('()=>window.__log.join(",")')
    check('(d) double Retry / Re-read: one set of rows', len(r) == 1, r)
    check('(d) double Retry: runs never overlap (every call finishes before the next starts)', ln.replace('call', 'c') in ('c3,done3', 'c3,done3,c4,done4') or all(ln.split(',')[i].startswith('call') == (i % 2 == 0) for i in range(len(ln.split(',')))), ln)
    p.close()

    # (e) cancel during a run, then a new submit works and no stale rows appear
    p = pg()
    beh(p, "function(t,n){return {slow:%s,ms:1500}}" % js(full([item('milk 200 ml', 'milk', 200, 'ml')])))
    p.fill('#ql', 'milk 200 ml'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_selector('#pv-ai-cancel'); p.click('#pv-ai-cancel'); p.wait_for_timeout(200)
    beh(p, "function(t,n){return {ans:%s}}" % js(full([item('2 roti', 'roti', 2, 'piece')])))
    p.click('#pv-cancel'); p.wait_for_timeout(200)
    p.fill('#ql', '2 roti'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(2500)
    r = rows(p)
    check('(e) cancel then new submit: only the new rows, no stale milk row', len(r) == 1 and 'milk' not in r[0].lower(), r)
    p.close()

    # (f) hung generation: timeout -> interrupt -> retry starts only after it settled
    p = pg(timeout=700)
    beh(p, "function(t,n){if(n===1)return {hang:1};return {ans:%s}}" % js(full([item('milk 200 ml', 'milk', 200, 'ml')])))
    p.evaluate("()=>{window.__llmMock.cancel=function(){window.__log.push('cancel');setTimeout(function(){window.__rel&&window.__rel()},150)}}")
    open_pv(p, 'milk 200 ml', 1500); p.click('#pv-ai-retry'); p.wait_for_timeout(2500); ln = p.evaluate('()=>window.__log.join(",")')
    check('(f) hung call: timed out, interrupted, and the Retry call starts only after it settled', 'call2' in ln and ln.find('cancel') < ln.find('settled1') < ln.find('call2') and 'Read with on-device AI' in p.inner_text('#pv-sheet'), ln)
    p.close()

    # (g) hidden -> visible does not break the next run
    p = pg()
    p.evaluate("()=>{window.__llmHideMs=0}")
    beh(p, "function(t,n){return {ans:%s}}" % js(full([item('milk 200 ml', 'milk', 200, 'ml')])))
    open_pv(p, 'milk 200 ml', 1200); l0 = p.evaluate('()=>window.__loads'); p.click('#pv-cancel'); p.wait_for_timeout(200)
    p.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:function(){return true}});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,get:function(){return false}});document.dispatchEvent(new Event('visibilitychange'))}")
    p.wait_for_timeout(300); open_pv(p, 'milk 200 ml', 1500)
    check('(g) hidden then visible: engine dropped quietly, next run reloads and reads with AI', 'Read with on-device AI' in p.inner_text('#pv-sheet') and p.evaluate('()=>window.__loads') == l0 + 1, (l0, p.evaluate('()=>window.__loads')))
    p.close()

    # (h) Last AI problem has the new fields
    p = pg()
    beh(p, "function(t,n){return {err:'The current Object has already been disposed',name:'Error'}}")
    open_pv(p, 'milk 200 ml', 1500); p.click('#pv-cancel'); p.wait_for_timeout(200)
    p.click('#ai-chip'); p.wait_for_selector('#ai-last-text'); t = p.inner_text('#ai-last-text')
    check('(h) Last AI problem: error class, reloads, hidden, GPU', 'Error class: Error' in t and 'Auto-reloads for this input: 1' in t and 'Page hidden during the run: no' in t and 'GPU: ' in t, t)
    p.close()
    check('no page errors', not [e for e in errs if 'pageerror' in e], errs[:3])
    b.close()
print('FAILED:', res)
