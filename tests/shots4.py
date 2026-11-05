"""v1.1 screenshots into journable/shots/ (360x740 and 412x915, light and dark; Small and Extra large text)."""
import sys, datetime
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
SH = '/home/arch/projects/trackme/shots/'
MOCK = "window.__llmMock={extract:function(t){return {items:[]}},analyse:function(p){return 'This meal has a decent mix of protein and fibre, with moderate fat. The carbohydrates are mostly from rice and roti.'}};"
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h) in ((360, 740), (412, 915)):
        for scheme in ('light', 'dark'):
            for size in ('small', 'xlarge'):
                tag = '%dx%d-%s-%s' % (w, h, scheme, size)
                init = MOCK + "localStorage.setItem('dt:v1:ui',JSON.stringify({fontSize:'%s',llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}))" % size
                p = new_page(b, w, h, scheme, init=init); T = today_of(p)
                make_profile(p, 'Asha', 2000, kg=70)
                for t in ['2 roti, dal and 200 ml milk', 'rice 1 bowl\narhar daal 1 katori\nroti 2', 'banana, 4 almonds', 'paneer 100 g and 2 roti']: quick(p, t)
                goto(p, 'weight'); p.click('#wt-add'); p.wait_for_selector('#wt-sheet'); p.fill('#w-kg', '71.2'); p.click('#w-save'); p.wait_for_selector('#wt-sheet', state='detached')
                goto(p, 'today'); p.evaluate("()=>window.scrollTo(0,0)"); p.wait_for_timeout(600)
                p.screenshot(path=SH + 'v11-today-expanded-' + tag + '.png')
                p.evaluate("()=>window.scrollTo(0,220)"); p.wait_for_timeout(800)
                p.screenshot(path=SH + 'v11-today-scrolled-' + tag + '.png')
                p.evaluate("()=>window.scrollTo(0,0)"); p.wait_for_timeout(500)
                p.fill('#ql', 'rice 1 bowl\ndal 1 katori\ncurd 100 g\nbanana 1'); p.wait_for_timeout(200)
                p.screenshot(path=SH + 'v11-multiline-' + tag + '.png'); p.fill('#ql', '')
                p.click('.slot-title-btn >> nth=0'); p.wait_for_selector('#meal-card')
                p.click('#an-btn'); p.wait_for_selector('#an-text:not(:empty)'); p.wait_for_timeout(300)
                p.screenshot(path=SH + 'v11-meal-detail-' + tag + '.png', full_page=True)
                if size in ('small', 'xlarge'):
                    goto(p, 'weekly'); p.wait_for_selector('#wk-cal'); p.wait_for_timeout(300)
                    p.screenshot(path=SH + 'v11-weekly-' + tag + '.png', full_page=True)
                    goto(p, 'weight'); p.wait_for_selector('#wt-chart'); p.wait_for_timeout(300)
                    p.screenshot(path=SH + 'v11-weight-' + tag + '.png', full_page=True)
                    goto(p, 'settings'); p.wait_for_timeout(300)
                    p.screenshot(path=SH + 'v11-settings-' + tag + '.png', full_page=True)
                p.close()
    b.close()
print('done')
