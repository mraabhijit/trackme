"""Phase 1 parser tests: golden cases (parseLog) and the matcher set (matchFood). No network, file:// only."""
import sys, json, os
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from tphelpers import *
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
G = json.load(open(os.path.join(HERE, 'golden_parse.json')))
M = json.load(open(os.path.join(HERE, 'matcher_set.json')))
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    page = b.new_page(viewport={'width': 360, 'height': 740})
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL)
    page.fill('#f-name', 'Asha'); page.fill('#f-dob', '1990-01-01'); page.fill('#f-height', '170'); page.fill('#f-weight', '70')
    page.click('#save-profile')
    page.wait_for_selector('#qbar')
    ctx = G['ctx']

    # ---- golden cases ----
    cases = G['cases']
    check('golden set has >= 80 cases', len(cases) >= 80, len(cases))
    check('golden set has >= 30 English and >= 15 Hinglish', sum(c['lang'] == 'en' for c in cases) >= 30 and sum(c['lang'] == 'hi' for c in cases) >= 15)
    check('golden set has >= 25 core cases', sum(1 for c in cases if c['core']) >= 25)
    check('golden set has >= 15 exercise cases', sum(1 for c in cases if c.get('ex')) >= 15)
    check('golden set has >= 10 mixed food+exercise cases', sum(1 for c in cases if c.get('ex') and c['items']) >= 10)
    check('golden set has >= 5 saved-name cases', sum(1 for c in cases if c.get('saved')) >= 5)
    check('golden set has the 3 phase-1 fixes and weekday cases', all(any(c['text'] == t for c in cases) for t in ('egg omelette 2 eggs', 'half plate rajma chawal', 'protein shake 300ml', 'monday 2 roti')))
    tot = got = 0; core_tot = core_got = 0; fails = []
    CTX = dict(G['ctx'], kg=70)
    def saved_snapshots(defs):
        out = []
        for d in defs:
            r = page.evaluate("([t,c])=>Journable.parseLog(t,c)", [d['text'], dict(CTX, saved=[])])
            its = []
            for i in r['items']:
                if i['type'] == 'food' and i.get('foodId'):
                    its.append({'type': 'food', 'foodId': i['foodId'], 'foodName': i['foodName'], 'qty': i['qty'], 'unit': i['unit'], 'unitLabel': i['unitLabel'], 'unitG': i['unitG'], 'grams': i['grams'], 'per100': i['per100']})
                elif i['type'] == 'exercise':
                    its.append({'type': 'exercise', 'actKey': i['actKey'], 'label': i['label'], 'minutes': i['minutes'], 'met': i['met']})
            out.append({'id': 'sv_' + d['name'].replace(' ', '_'), 'name': d['name'], 'items': its})
        return out
    for c in cases:
        ctx = dict(CTX)
        if c.get('saved'): ctx['saved'] = saved_snapshots(c['saved'])
        r = page.evaluate("([t,c])=>Journable.parseLog(t,c)", [c['text'], ctx])
        foods = [i for i in r['items'] if i.get('foodId')]
        exs = [i for i in r['items'] if i['type'] == 'exercise']
        unm = [i for i in r['items'] if i['type'] not in ('exercise',) and not i.get('foodId')]
        for k, exp in enumerate(c['items']):
            it = foods[k] if k < len(foods) else None
            good = bool(it) and it['foodName'] == exp['food'] and abs(it['grams'] - exp['g']) <= max(0.1 * exp['g'], 0.6)
            tot += 1; got += good
            if c['core']: core_tot += 1; core_got += good
            if not good: fails.append((c['id'], c['text'], exp, it and (it['foodName'], it['grams'])))
        for k, exp in enumerate(c.get('ex', [])):
            it = exs[k] if k < len(exs) else None
            good = bool(it) and it['actKey'] == exp['key'] and abs(it['minutes'] - exp['min']) <= max(0.1 * exp['min'], 0.6)
            if good:
                met = {'walk': 3.5, 'brisk_walk': 4.3, 'run': 8.0, 'jog': 7.0, 'gym': 5.0, 'yoga': 2.5, 'cycling': 6.8, 'swim': 6.0, 'badminton': 5.5, 'dance': 5.0}[exp['key']]
                good = abs(it['kcal'] - met * 70 * it['minutes'] / 60) < 0.01 and it['kg'] == 70
            if c.get('assumed_ex'): good = good and it['assumed'] is True and it['flag'] == 'check'
            tot += 1; got += good
            if c['core']: core_tot += 1; core_got += good
            if not good: fails.append((c['id'], c['text'], exp, it and (it['actKey'], it['minutes'])))
        nexp = len(c['items']) + len(c.get('ex', [])) + c.get('unmatched', 0)
        if len(r['items']) != nexp or len(unm) != c.get('unmatched', 0):
            fails.append((c['id'], c['text'], 'item count', len(r['items']), nexp))
        for key, have in (('date', r['date']), ('time', r['time']), ('slot', r['slotName'])):
            if key in c and have != c[key]:
                fails.append((c['id'], c['text'], key, have, c[key]))
    for f in fails: print('   MISS', f)
    pct = 100.0 * got / tot
    check('rule path gets >= 90%% of items right (%d/%d = %.1f%%)' % (got, tot, pct), pct >= 90.0)
    check('core cases: 100%% of items right (%d/%d)' % (core_got, core_tot), core_got == core_tot)
    check('no golden case has an item-count, date, time or slot miss', not [f for f in fails if f[2] in ('item count', 'date', 'time', 'slot')], [f for f in fails if f[2] in ('item count', 'date', 'time', 'slot')])

    # ---- parseLog behaviours ----
    P = lambda t, cx=None: page.evaluate("([t,c])=>Journable.parseLog(t,c)", [t, dict(ctx, **(cx or {}))])
    r = P('2 roti and dal')
    check('slot is chosen by nextSlotId logic, not by the clock (nothing logged: first slot)', r['slotName'] == 'Breakfast' and not r['slotExplicit'])
    check('time defaults to now on today', r['time'] == '09:15' and r['date'] == '2026-11-04')
    r = P('lunch yesterday 2 roti')
    check('explicit meal + yesterday: slot Lunch, date 2026-11-03, typical lunch time 13:00', r['slotName'] == 'Lunch' and r['date'] == '2026-11-03' and r['time'] == '13:00' and r['slotExplicit'])
    # typical times for a PAST day when a meal word is present; an explicit time always wins; no meal word keeps 12:00
    for words, slot_name, tm in (('breakfast yesterday 2 idli', 'Breakfast', '08:00'), ('yesterday snack 1 banana', 'Evening snack', '17:00'), ('dinner yesterday 2 roti', 'Dinner', '20:00'),
                                 ('late night snack yesterday 1 banana', 'Late-night snack', '23:00'), ('kal raat 2 roti', 'Dinner', '20:00'), ('mid-morning snack yesterday 1 apple', 'Mid-morning snack', '10:30')):
        r = P(words)
        check('past day typical time: "%s" -> %s %s' % (words, slot_name, tm), r['slotName'] == slot_name and r['time'] == tm and not r['timeExplicit'], (r['slotName'], r['time']))
    r = P('lunch yesterday 2 roti at 2:30pm'); check('past day: an explicit time wins over the typical lunch time', r['time'] == '14:30' and r['timeExplicit'])
    r = P('yesterday 2 roti'); check('past day without a meal word: 12:00', r['time'] == '12:00' and not r['slotExplicit'])
    r = P('lunch 2 roti'); check('today with a meal word and no time keeps the current time', r['time'] == '09:15')
    SL = [{'id': 's_a', 'name': 'Pre-workout'}, {'id': 's_breakfast', 'name': 'Morning meal'}, {'id': 's_mine', 'name': 'Tiffin'}, {'id': 's_lunch', 'name': 'Midday'}, {'id': 's_zzz', 'name': 'Zzz'}]
    r = P('tiffin yesterday 2 roti', {'slots': SL}); check('past day, user slot between breakfast and lunch: midpoint 10:30', r['slotId'] == 's_mine' and r['time'] == '10:30', (r['slotId'], r['time']))
    r = P('pre-workout yesterday 1 banana', {'slots': SL}); check('past day, user slot before breakfast: one hour earlier (07:00)', r['slotId'] == 's_a' and r['time'] == '07:00', (r['slotId'], r['time']))
    r = P('zzz yesterday 1 banana', {'slots': SL}); check('past day, user slot after lunch: one hour later (14:00)', r['slotId'] == 's_zzz' and r['time'] == '14:00', (r['slotId'], r['time']))
    r = P('morning meal yesterday 2 idli', {'slots': SL}); check('past day, renamed default slot keeps its typical time (breakfast 08:00)', r['slotId'] == 's_breakfast' and r['time'] == '08:00', (r['slotId'], r['time']))
    r = P('tiffin yesterday 2 roti', {'slots': [{'id': 's_x', 'name': 'Tiffin'}, {'id': 's_y', 'name': 'Other'}]}); check('past day, no slot with a typical time at all: 12:00', r['time'] == '12:00', r['time'])
    r = P('2 roti on 3 nov')
    check('"3 nov" is read as a date', r['date'] == '2026-11-03')
    r = P('1 apple at 4 pm')
    check('"at 4 pm" sets time 16:00', r['time'] == '16:00' and r['timeExplicit'])
    r = P('1 apple at 4:30')
    check('bare "4:30" is read as afternoon', r['time'] == '16:30')
    r = P('2 roti tonight')
    check('"tonight" is dinner time of today', r['date'] == '2026-11-04')
    r = P('')
    check('empty text gives no items', r['items'] == [])
    r = P('xqzv blorp')
    check('gibberish stays unmatched (no food chosen)', len(r['items']) == 1 and not r['items'][0].get('foodId') and r['items'][0]['flag'] in ('none',))
    r = P('45 min walking')
    check('exercise words become an exercise row, not food', len(r['items']) == 1 and r['items'][0]['type'] == 'exercise' and r['items'][0]['minutes'] == 45)
    r = P('brisk walk 45 min', {'kg': 80})
    check('exercise kcal = MET x kg x hours: 80 kg, 45 min brisk walk (MET 4.3) = 258 kcal', r['items'][0]['met'] == 4.3 and abs(r['items'][0]['kcal'] - 258) < 0.001, r['items'][0]['kcal'])
    r = P('walk')
    check('no duration: 30 min assumed and flagged Check', r['items'][0]['minutes'] == 30 and r['items'][0]['assumed'] and r['items'][0]['flag'] == 'check')
    r = P('ran 5 km')
    check('distance only: running at 9 km/h -> 33.3 min', abs(r['items'][0]['minutes'] - 33.3) < 0.05 and r['items'][0]['distanceKm'] == 5)
    r = P('8,000 steps')
    check('steps: thousands comma, 0.75 m/step at 5 km/h = 72 min', abs(r['items'][0]['minutes'] - 72) < 0.05 and r['items'][0]['steps'] == 8000)
    r = P('walked 400 min')
    check('minutes are clamped to 600', P('walked 9000 min')['items'][0]['minutes'] == 600)
    r = P('gym 2 hours')
    check('hours are converted to minutes', r['items'][0]['minutes'] == 120)
    r = P('walked 40 min then had chai and 2 biscuits')
    check('mixed sentence: 1 exercise row then 2 food rows', [i['type'] for i in r['items']] == ['exercise', 'food', 'food'], [i['type'] for i in r['items']])
    r = P('egg omelette 2 eggs')
    it = r['items'][0]
    check('(a) "egg omelette 2 eggs" is ONE 2-egg omelette (100 g), not 2 omelettes', it['foodName'].startswith('Egg omelette') and it['qty'] == 1 and it['grams'] == 100, (it['qty'], it['grams']))
    r = P('3 egg omelette')
    check('(a) "3 egg omelette" is 1.5 two-egg omelettes', r['items'][0]['qty'] == 1.5 and r['items'][0]['grams'] == 150)
    r = P('2 omelette')
    check('(a) "2 omelette" still means 2 omelettes', r['items'][0]['qty'] == 2 and r['items'][0]['grams'] == 200)
    r = P('paneer sandwich 2 slices')
    it = r['items'][0]
    check('(a) "paneer sandwich 2 slices": count of slices does not multiply a guessed food; flagged Check', it['flag'] == 'check' and it['qty'] == 1, (it['flag'], it['qty'], it['grams']))
    r = P('half plate rajma chawal')
    check('(b) a quantity before a pair applies to both parts (0.5 plate each)', len(r['items']) == 2 and all(i['qty'] == 0.5 and i['unit'] == 'plate' for i in r['items']), [(i['foodName'], i['qty']) for i in r['items']])
    check('(b) each row text keeps the quantity so editing it keeps the amount', r['items'][0]['text'] == 'half plate rajma' and r['items'][1]['text'] == 'half plate chawal', [i['text'] for i in r['items']])
    r = P('2 chole bhature')
    check('(b) "2 chole bhature" = 2 of each', len(r['items']) == 2 and all(i['qty'] == 2 for i in r['items']), [(i['foodName'], i['qty']) for i in r['items']])
    r = P('zorbaflux 300ml')
    check('(c) unmatched phrase stays a row with no food and no guess', len(r['items']) == 1 and not r['items'][0].get('foodId') and r['items'][0]['text'] == 'zorbaflux 300 ml', r['items'])
    r = P('wednesday 2 roti')
    check('(d) a weekday that is today resolves to a week ago (strictly past)', r['date'] == '2026-10-28', r['date'])
    r = P('thursday 2 roti')
    check('(d) a later weekday resolves to the most recent past one (Thursday 29 Oct)', r['date'] == '2026-10-29', r['date'])
    r = P('on sat 1 apple')
    check('(d) three-letter weekday after "on" works (Saturday 31 Oct)', r['date'] == '2026-10-31', r['date'])
    r = P('2 roti, 1 cup dal; 1 banana + 1 glass milk')
    check('hard separators split into four items', len([i for i in r['items'] if i.get('foodId')]) == 4)
    r = P('<img src=x onerror=alert(1)> 2 roti')
    check('markup in text does not crash and is kept as plain text', r['text'].startswith('<img'))
    r = P('1 chai ' * 100)
    check('very long text is capped (<= 500 chars, <= 40 items)', len(r['text']) <= 500 and len(r['items']) <= 40)
    r = P('2 large banana')
    b1 = next(i for i in r['items'] if i.get('foodId'))
    r2 = P('2 small banana'); b2 = next(i for i in r2['items'] if i.get('foodId'))
    check('size words scale the amount (large > small)', b1['grams'] > b2['grams'] * 1.4, (b1['grams'], b2['grams']))
    r = P('half katori dal')
    it = r['items'][0]
    check('"half katori dal" is 0.5 katori = 75 g', it['qty'] == 0.5 and it['grams'] == 75, (it['qty'], it['grams']))
    r = P('1/2 katori dal')
    check('"1/2 katori dal" is 75 g', r['items'][0]['grams'] == 75)
    r = P('1½ katori dal')
    check('unicode fraction "1½" is 1.5', r['items'][0]['qty'] == 1.5)
    r = P('paneer tikka')
    it = r['items'][0]
    check('half-known food (paneer tikka) gets a Check flag, not a silent guess', it['flag'] == 'check', it['flag'])
    r = P('banana')
    it = r['items'][0]
    check('no quantity: one default unit, marked assumed', it['assumed'] is True and it['qty'] == 1)
    r = P('500 g chicken breast')
    check('grams before the food work', r['items'][0]['grams'] == 500)
    r = P('2 roti')
    check('every parsed item carries top alternatives (cands)', len(r['items'][0]['cands']) >= 1)
    check('parseLog result is marked as the rule path', r['rule'] is True)
    check('Journable.parseLog is the single entry point (function)', page.evaluate("typeof Journable.parseLog==='function'&&typeof Journable.matchFood==='function'"))

    # ---- matcher set ----
    check('matcher set has >= 100 phrases', len(M) >= 100, len(M))
    t1 = t3 = 0; bad = []
    for m in M:
        r = page.evaluate("t=>Journable.matchFood(t)", m['phrase'])
        c = r['cands']
        if r['foodName'] and r['foodName'].startswith(m['expect']): t1 += 1
        else: bad.append((m['phrase'], m['expect'], r['foodName']))
        if any(x['name'].startswith(m['expect']) for x in c[:3]): t3 += 1
    for x in bad: print('   TOP1 MISS', x)
    n = len(M)
    check('matcher top-1 >= 90%% (%d/%d = %.1f%%)' % (t1, n, 100.0 * t1 / n), t1 / n >= 0.90)
    check('matcher top-3 >= 97%% (%d/%d = %.1f%%)' % (t3, n, 100.0 * t3 / n), t3 / n >= 0.97)
    must = ['rice', 'milk', 'egg', 'doodh', 'ghee', 'banana']
    for w in must:
        r = page.evaluate("t=>Journable.matchFood(t)", w)
        exp = next(x['expect'] for x in M if x['phrase'] == w)
        check('"%s" matches %s on top' % (w, exp), (r['foodName'] or '').startswith(exp), r['foodName'])
    r = page.evaluate("t=>Journable.matchFood(t)", 'rice')
    check('"rice" is not Poha/Curd rice/raw rice', r['foodName'].startswith('Plain rice'))
    check('no page errors while parsing', not errs, errs)
    b.close()

print('FAILED', res)
sys.exit(1 if res else 0)
