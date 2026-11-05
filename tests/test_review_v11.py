"""Regression checks for the v1.1 review fixes (file://, mocked AI)."""
import sys, json
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
UI = "localStorage.setItem('dt:v1:ui',JSON.stringify({llmOn:true,modelId:'Qwen3-0.6B-q4f16_1-MLC'}));"
def it(text, name, qty=None, unit=None, **k):
    d = {'type': 'food', 'text': text, 'name': name, 'qty': qty, 'unit': unit, 'size': None, 'kcal': None, 'protein': None, 'carbs': None, 'fat': None, 'grams': None, 'estimated': False, 'activity': None, 'minutes': None, 'distance_km': None}; d.update(k); return d
def ai_rows(b, text, items):
    p = new_page(b, init="window.__llmMock={extract:function(){return %s}};" % json.dumps({'items': items, 'date': None, 'time': None, 'meal': None}) + UI)
    make_profile(p, 'R', 2000); p.fill('#ql', text); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(300)
    t = p.inner_text('#pv-rows'); p.context.close(); return t
with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    p = new_page(b, errs=errs); make_profile(p, 'Q', 2000)
    check('Quick-log Enter key is labelled as a new line (enterkeyhint=enter), since Enter inserts a line break', p.get_attribute('#ql', 'enterkeyhint') == 'enter')
    quick(p, 'paneer 100 g')
    t = p.inner_text('#view')
    check('Gram entries read "(100 g)", not "(100 × g)"', '(100 g)' in t and '× g)' not in t, [x for x in t.split('\n') if 'Paneer' in x])
    p.click('.slot-title-btn'); p.wait_for_selector('#meal-card')
    check('Meal detail rows also read "(100 g)"', '(100 g)' in p.inner_text('#meal-card'))
    p.context.close()
    t = ai_rows(b, '2 roti', [it('2 roti', 'zzunknown', -5, 'piece', kcal=-100)])
    check('AI name not in the food table and no usable estimate: the item\'s own words find the food', 'Roti' in t and 'Not found' not in t, t[:200])
    t = ai_rows(b, '2 roti', [it('2 roti', 'chicken biryani', 2, 'plate')])
    check('AI name pointing to a different food than the typed words is flagged Check', 'Chicken biryani' in t and 'Check' in t, t[:200])
    t = ai_rows(b, '2 roti', [it('2 roti', 'roti', 2, 'piece')])
    check('Matching AI name and words: no Check flag', 'Roti' in t and 'Check' not in t, t[:200])
    t = ai_rows(b, '1 glass zzcola', [it('1 glass zzcola', 'zz cola', 1, 'glass', kcal=5000, protein=0, carbs=0, fat=0, grams=5000)])
    check('AI estimate: 1 glass is at most 3x a usual glass (750 g) and, with no macros, at most 4 kcal/g', '750 g' in t and '3000 kcal' in t, t[:200])
    t = ai_rows(b, '200 ml zzcola', [it('200 ml zzcola', 'zz cola', 200, 'ml', kcal=84, carbs=21, grams=200)])
    check('AI estimate with macros keeps its numbers and the ml unit', '200 ml' in t and '84 kcal' in t, t[:200])
    t = ai_rows(b, '1 plate pad thai', [it('1 plate pad thai', 'pad thai', 1, 'plate', kcal=600, protein=20, carbs=80, fat=20, grams=300)])
    check('A weak table match ("pad thai" ~ an unrelated food, score < 0.8) loses to the AI estimate, tagged AI', 'Pad thai' in t and 'AI' in t and '600 kcal' in t, t[:200])
    check('no page errors', not errs, errs)
    b.close()
print('FAILED:', res)
