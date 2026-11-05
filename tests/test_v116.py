"""v1.1.5 regression (file://): a "ready" engine that answers ModelNotLoadedError (real phone, 2026-11-05) is reloaded once and asked again."""
import sys, json
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
ANS = json.dumps({'items': [{'type': 'food', 'text': 'milk 200 ml', 'name': 'milk', 'qty': 200, 'unit': 'ml'}], 'date': None, 'time': None, 'meal': None})
MOCK = """window.__calls=0;window.__loads=0;window.__fail=%d;window.__llmMock={has:function(){return true},load:function(){window.__loads++},usage:{completion_tokens:7},
 extract:function(t){window.__calls++;if(window.__calls<=window.__fail){var e=new Error('Model not loaded before trying to complete ChatCompletionRequest.');e.name='ModelNotLoadedError';return Promise.reject(e)}return %s}};
localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))"""
with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    for fails, name in ((1, 'one ModelNotLoadedError'), (2, 'two in a row')):
        p = new_page(b, 360, 740, errs=errs, init=MOCK % (fails, json.dumps(ANS))); make_profile(p, 'V', 2000)
        p.fill('#ql', 'milk 200 ml'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(1500)
        txt = p.inner_text('#pv-sheet'); calls = p.evaluate('()=>window.__calls'); loads = p.evaluate('()=>window.__loads')
        if fails == 1:
            check('%s: reloaded once and read with the AI' % name, 'Read with on-device AI' in txt and calls == 2 and loads >= 1, (calls, loads, txt[:200]))
        else:
            check('%s: no endless loop (at most one reload), falls back with a reason' % name, calls == 2 and 'AI could not read' in txt, (calls, txt[:200]))
        p.close()
    check('no page errors', not [e for e in errs if 'pageerror' in e], errs[:3])
    b.close()
print('FAILED:', res)
