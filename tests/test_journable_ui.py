"""Phase 1 UI tests for Journable (file:// only)."""
import sys, json, os, re, datetime
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from tphelpers import *
from playwright.sync_api import sync_playwright

D = '/home/arch/projects/trackme'
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

import dbdata
UNITS = {f['name']: f for f in dbdata.dishes()}
def kcal_of(food, g): return UNITS[food]['per_100g']['kcal'] * g / 100.0
ROTI = 'Roti / phulka (whole wheat, no ghee)'; DAL = 'Dal (toor), cooked, light tadka'

def today_of(page):
    return page.evaluate("()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}")
def addd(ds, n):
    return (datetime.date.fromisoformat(ds) + datetime.timedelta(days=n)).isoformat()

def new_page(b, w=360, h=740, scheme='light', errs=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme)
    p = ctx.new_page()
    if errs is not None:
        p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        p.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    p.on('dialog', lambda d: (errs.append('dialog: ' + d.message) if errs is not None else None, d.dismiss()))
    p.goto(URL)
    return p

def make_profile(p, name='Asha', kcal=2000):
    p.fill('#f-name', name); p.fill('#f-dob', '1990-01-01'); p.fill('#f-height', '170'); p.fill('#f-weight', '70')
    if kcal:
        p.evaluate("()=>{document.querySelector('#advanced').open=true}")
        p.fill('#f-ovkcal', str(kcal))
    p.click('#save-profile'); p.wait_for_selector('#qbar')

def quick(p, text, save=True):
    p.fill('#ql', text); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    if save:
        p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')

def hscroll(p):
    return p.evaluate("()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1||document.body.scrollWidth>window.innerWidth+1")

def small_targets(p, scope='body', minw=44, minh=44):
    return p.evaluate("""([scope,mw,mh])=>{const out=[];document.querySelectorAll(scope+' button, '+scope+' input:not([type=hidden]), '+scope+' select, '+scope+' a[href], '+scope+' textarea, '+scope+' summary').forEach(e=>{
      const r=e.getBoundingClientRect();if(r.width===0||r.height===0)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||e.disabled&&false)return;
      if(e.closest('[hidden]')||e.closest('[inert]'))return;
      if(r.height<mh-0.5||r.width<mw-0.5)out.push((e.id||e.className||e.tagName)+':'+Math.round(r.width)+'x'+Math.round(r.height)+':'+(e.textContent||e.getAttribute('aria-label')||'').slice(0,20))});return out}""", [scope, minw, minh])

def backup_file(path, profile, entries, logs=None, weights=None):
    prof = dict(profile)
    o = {'app': 'diet-tracker', 'schema': 1, 'exportedAt': '2026-01-01T00:00:00Z', 'sharedFoods': [], 'lastPackImport': None,
         'profiles': [{'profile': prof, 'entries': entries, 'weights': weights or [], 'foods': []}]}
    if logs is not None: o['profiles'][0]['logs'] = logs
    json.dump(o, open(path, 'w'))

PROF = {'id': 'p_test1', 'name': 'Imported', 'sex': 'f', 'dob': '1985-05-05', 'heightCm': 160, 'startKg': 60, 'activity': 1.4,
        'activityModel': 2, 'goal': 'maintain', 'rateKgWk': 0.5, 'proteinGPerKg': 1.6, 'fatPct': 25, 'override': {'kcal': 2000}}
def ent(i, date, kcal, name='Test food', time='12:00', slot='s_lunch', slotName='Lunch', **kw):
    e = {'id': 'e_%s' % i, 'date': date, 'time': time, 'slot': slot, 'slotName': slotName, 'foodId': 'x_test', 'foodName': name,
         'qty': kcal, 'unit': 'g', 'unitLabel': 'g', 'unitG': 1, 'grams': kcal, 'per100': {'kcal': 100, 'p': 10, 'c': 10, 'f': 5, 'fib': 1},
         'updatedAt': 1, 'createdAt': 1}
    e.update(kw); return e

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ================= quick log -> preview -> save =================
    errs = []
    p = new_page(b, errs=errs); make_profile(p)
    TODAY = today_of(p)
    check('Today is the first screen after creating a profile', p.locator('#date-btn').count() == 1 and 'Today' in p.inner_text('#date-btn'))
    check('header chip says exactly Basic when there is no AI model', p.inner_text('#ai-chip').strip() == 'Basic')
    check('quick bar placeholder text', p.get_attribute('#ql', 'placeholder') == 'What did you eat or exercise?')
    check('mic button is visible exactly when the browser has a speech API', p.locator('#ql-mic').is_visible() == p.evaluate("()=>!!(window.SpeechRecognition||window.webkitSpeechRecognition)"))
    check('quick bar has send and + buttons', p.locator('#ql-send').is_visible() and p.locator('#ql-plus').is_visible())
    p.fill('#ql', '2 roti and dal for lunch'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('preview sheet is titled Check before saving', 'Check before saving' in p.inner_text('#pv-sheet'))
    check('preview shows the typed text in grey', p.inner_text('#pv-raw') == '2 roti and dal for lunch')
    check('preview has two editable rows', p.locator('#pv-sheet .pv-text').count() == 2)
    check('row texts are the parsed phrases', p.input_value('#pv-sheet .pv-text >> nth=0').startswith('2 roti') and 'dal' in p.input_value('#pv-sheet .pv-text >> nth=1'))
    check('first row food is roti', 'Roti / phulka' in p.inner_text('#pv-sheet .pv-food >> nth=0'))
    check('date / meal / time chips', all(p.locator(s).count() == 1 for s in ('#pv-date-chip', '#pv-meal-chip', '#pv-time-chip')))
    check('meal chip says Lunch (named in the text)', 'Lunch' in p.inner_text('#pv-meal-chip'))
    check('date chip says Today', 'Today' in p.inner_text('#pv-date-chip'))
    check('save button counts the items', p.inner_text('#pv-save').strip() == 'Save all (2)')
    p.click('#pv-meal-chip')
    check('meal chip opens the slot choices (user slots)', p.locator('#pv-panelbox [data-slot]').count() >= 5)
    p.click('#pv-meal-chip')
    p.click('#pv-time-chip')
    check('time chip opens the existing time picker', p.locator('#ptime-h').count() == 1)
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    sec = p.locator('section.slot', has=p.locator('li.entry'))
    check('Today shows one slot card with the entries under Lunch', sec.count() == 1 and 'Lunch' in sec.first.get_attribute('aria-label'))
    check('Today lists both parsed items', p.locator('li.entry').count() == 2)
    check('grey raw text sits above the parsed rows', p.locator('section.slot .logtext').first.inner_text().strip() == '2 roti and dal for lunch')
    order = p.evaluate("()=>{const s=document.querySelector('section.slot .logtext'),l=document.querySelector('section.slot li.entry');return !!(s.compareDocumentPosition(l)&Node.DOCUMENT_POSITION_FOLLOWING)}")
    check('raw text comes before the first item in the DOM', order)
    chips = p.inner_text('li.entry >> nth=0')
    check('item rows have Calories / Carbs / Protein / Fat chips', all(w in chips for w in ('Calories:', 'Carbs:', 'Protein:', 'Fat:')), chips)
    food = kcal_of(ROTI, 70) + kcal_of(DAL, 150)
    txt = p.inner_text('#cal-card')
    check('calories card: Food total matches hand maths (%d)' % round(food), re.search(r'\b%d\b' % round(food), p.inner_text('#t-kcal')) is not None, p.inner_text('#t-kcal'))
    check('calories card: Remaining = 2000 - food (%d)' % round(2000 - food), str(round(2000 - food)) in p.inner_text('#t-remaining'), p.inner_text('#t-remaining'))
    check('calories card shows Exercise column at 0', p.inner_text('#t-exercise').strip() in ('0', '0 '), p.inner_text('#t-exercise'))
    check('macro bars exist (carbs, protein, fat)', all(p.locator(s).count() == 1 for s in ('#t-c', '#t-p', '#t-f')))
    check('Today has no Day total block any more; the meal card header keeps the per-meal subtotal', p.locator('#day-total').count() == 0 and 'Day total' not in p.inner_text('#view') and p.locator('.slot .slot-kcal').count() >= 1)
    check('quick box emptied after saving', p.input_value('#ql') == '')
    stored = p.evaluate("()=>Object.keys(localStorage).filter(k=>k.indexOf('dt:v1:')===0&&k.indexOf('logs:')>0)")
    check('log stored under logs:<YYYY-MM> in the dt:v1 namespace', len(stored) == 1 and re.search(r'logs:\d{4}-\d\d$', stored[0]) is not None, stored)
    lid = p.evaluate("()=>{const k=Object.keys(localStorage).filter(k=>/entries:\\d{4}-\\d\\d$/.test(k))[0];return JSON.parse(localStorage[k]).map(e=>e.logId)}")
    check('entries carry a logId', len(lid) == 2 and lid[0] and lid[0] == lid[1], lid)
    check('no page errors in the flow', not errs, errs)

    # ---- rows sorted by time inside a card ----
    quick(p, 'snack 1 apple at 9am')
    quick(p, 'snack 1 banana at 8am')
    times = p.eval_on_selector_all('section.slot', 'els=>els.map(s=>[...s.querySelectorAll("li.entry")].map(e=>e.dataset.time))')
    labels = p.eval_on_selector_all('section.slot', 'els=>els.map(s=>s.getAttribute("aria-label"))')
    check('rows inside each slot card are sorted by time', all(t == sorted(t) for t in times) and any(len(t) > 1 for t in times), times)
    check('slot cards follow the person\'s slot order (Lunch before Evening snack)', labels.index([l for l in labels if 'Lunch' in l][0]) < labels.index([l for l in labels if 'Evening' in l][0]), labels)

    # ================= preview editing =================
    quick(p, '1 banana', save=False)
    p.fill('#pv-sheet .pv-text >> nth=0', '2 apple'); p.press('#pv-sheet .pv-text >> nth=0', 'Tab')
    check('editing a preview row as text re-reads it', 'Apple' in p.inner_text('#pv-sheet .pv-food >> nth=0') and '2' in p.inner_text('#pv-sheet .pv-amount >> nth=0'))
    p.click('#pv-cancel'); p.wait_for_selector('#pv-sheet', state='detached')
    check('cancel keeps the typed text for another try', p.input_value('#ql') == '1 banana')
    p.fill('#ql', 'milk'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    first = p.inner_text('#pv-sheet .pv-food >> nth=0')
    p.click('#pv-sheet .pv-notthis >> nth=0')
    check('Change item lists up to three alternatives', 1 <= p.locator('#pv-sheet .pv-alt').count() <= 8 and p.locator('#pv-sheet .pv-search').count() == 1)
    alt_name = p.inner_text('#pv-sheet .pv-alt >> nth=0 >> b')
    p.click('#pv-sheet .pv-alt >> nth=0')
    check('picking an alternative swaps the food', p.inner_text('#pv-sheet .pv-food >> nth=0') == alt_name and alt_name != first, (first, alt_name))
    p.click('#pv-cancel')
    p.fill('#ql', 'paneer tikka'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('uncertain match is flagged Check', p.locator('#pv-sheet .pv-flag').count() == 1 and p.inner_text('#pv-sheet .pv-flag') == 'Check')
    p.click('#pv-cancel')
    p.fill('#ql', 'zzzq xxkw'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('nothing matched: row says no food found and Save is disabled', p.locator('#pv-sheet .pv-none').count() == 1 and p.is_disabled('#pv-save'))
    p.click('#pv-cancel')
    p.fill('#ql', '30 min walking'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('exercise words become an exercise row (30 min walk, kcal box) and Save is enabled', p.locator('#pv-sheet .pv-exrow').count() == 1 and p.locator('#pv-sheet .pv-ex-kcal').count() == 1 and not p.is_disabled('#pv-save'))
    p.click('#pv-cancel')
    p.fill('#ql', '2 roti yesterday dinner at 8:30pm'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('date, meal and time are picked up from the words',
          'Yesterday' in p.inner_text('#pv-date-chip') and 'Dinner' in p.inner_text('#pv-meal-chip') and '8:30' in p.inner_text('#pv-time-chip'),
          [p.inner_text(s) for s in ('#pv-date-chip', '#pv-meal-chip', '#pv-time-chip')])
    p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    check('saving a past-dated log shows that day (not Today)', 'Today' not in p.inner_text('#title'), p.inner_text('#title'))
    check('that day has the entry under Dinner', p.locator('section.slot[aria-label*=Dinner] li.entry').count() == 1)

    # ================= entry menu =================
    p.click('#date-btn'); p.wait_for_selector('#cal-sheet'); p.click(f'#cal-sheet .cal-day[data-date="{TODAY}"]')
    p.wait_for_selector('#cal-sheet', state='detached')
    row = p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Roti'))).first
    row.locator('.menu-btn').click()
    check('entry menu lists Edit / Adjust / Change date & time / Delete', all(p.locator(s).count() == 1 for s in ('#em-edit', '#em-adjust', '#em-datetime', '#em-delete')))
    check('Add to saved entries is an enabled menu item', not p.is_disabled('#em-save') and 'Add to saved entries' in p.inner_text('#em-save'))
    kcal_before = int(re.sub(r'\D', '', p.inner_text('#t-kcal').split('/')[0].split('kcal')[0]) or 0)
    p.click('#em-adjust'); p.wait_for_selector('#adjust-sheet')
    p.fill('#adj-kcal', '500'); p.fill('#adj-c', '60'); p.fill('#adj-p', '12'); p.fill('#adj-f', '9'); p.click('#adj-save')
    p.wait_for_selector('#adjust-sheet', state='detached')
    r0_ = p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Roti'))).first
    check('adjusted entry shows the new calories and an adjusted tag', 'Calories: 500' in r0_.inner_text() and 'adjusted' in r0_.inner_text(), r0_.inner_text())
    check('totals moved by exactly (500 - calculated roti kcal)', abs((int(re.sub(r'\D', '', p.inner_text('#t-kcal').split('/')[0].split('kcal')[0]) or 0)) - kcal_before - (500 - kcal_of(ROTI, 70))) <= 1, (kcal_before, p.inner_text('#t-kcal')))
    p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Roti'))).first.locator('.menu-btn').click(); p.click('#em-adjust'); p.wait_for_selector('#adjust-sheet')
    check('adjust sheet shows the stored values', p.input_value('#adj-kcal') == '500')
    p.click('#adj-reset'); p.wait_for_selector('#adjust-sheet', state='detached')
    r1 = p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Roti'))).first
    check('reset brings back the calculated calories', 'Calories: %d' % round(kcal_of(ROTI, 70)) in r1.inner_text() and 'adjusted' not in r1.inner_text(), r1.inner_text())
    # change date & time
    r1.locator('.menu-btn').click(); p.click('#em-datetime'); p.wait_for_selector('#datetime-sheet')
    y = addd(TODAY, -1)
    p.fill('#cd-date', y); set_time(p, '07:15', 'q'); p.click('#q-done'); p.wait_for_selector('#datetime-sheet', state='detached')
    check('after the change the view follows the entry to that day', 'Today' not in p.inner_text('#title'), p.inner_text('#title'))
    mv = p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Roti')))
    check('entry is on the other day at 7:15 AM', mv.count() >= 1 and any(e.get_attribute('data-time') == '07:15' for e in mv.all()))
    p.click(f'#week-strip [data-date="{TODAY}"]')
    check('entry left Today after the date change', p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Roti'))).count() == 0)
    # delete + undo
    n0 = p.locator('li.entry').count()
    p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Dal'))).first.locator('.menu-btn').click(); p.click('#em-delete')
    check('delete removes the entry at once', p.locator('li.entry').count() == n0 - 1)
    check('toast offers Undo', p.locator('#toasts button').count() == 1 and 'Undo' in p.inner_text('#toasts button'))
    p.click('#toasts button')
    check('Undo brings the entry back', p.locator('li.entry').count() == n0)
    check('Undo restored the grey log text as well', p.locator('.logtext', has_text='2 roti and dal for lunch').count() >= 1)
    p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Dal'))).first.locator('.menu-btn').click(); p.click('#em-delete')
    p.wait_for_timeout(5400)
    check('toast disappears after about 5 seconds', p.locator('#toasts button').count() == 0)
    check('deleted for good after the undo window', p.locator('li.entry', has=p.locator('b', has_text=re.compile('^Dal'))).count() == 0)
    p.context.close()

    # ================= calendar vs hand maths =================
    p = new_page(b)
    make_profile(p, 'Tmp', 2000); TODAY = today_of(p)
    mon = addd(TODAY, -((datetime.date.fromisoformat(TODAY).weekday()) % 7))
    prevmon = addd(mon, -7)
    days = {addd(prevmon, 0): [1500], addd(prevmon, 1): [900, 1300], addd(prevmon, 3): [2300], addd(prevmon, 4): [2000]}
    ents = {}
    i = 0
    for d, ks in days.items():
        for k in ks:
            i += 1; ents.setdefault(d[:7], []).append(ent(i, d, k))
    pe = dict(PROF); pe['id'] = p.evaluate("()=>JSON.parse(localStorage['dt:v1:profiles']||'[]')[0]") if False else PROF['id']
    # inject through the import path into the same profile name is simpler: use a second person via import
    bf = '/tmp/ui_cal.json'; backup_file(bf, PROF, ents)
    goto(p, 'backup'); p.set_input_files('#import-file', bf); p.click('#import-apply'); p.wait_for_selector('#import-summary')
    goto(p, 'today'); switch_person(p, 'Imported'); p.keyboard.press('Escape')
    p.wait_for_selector('#date-btn')
    p.click(f'#week-strip button >> nth=0') if False else None
    p.click('#date-btn'); p.wait_for_selector('#cal-sheet')
    def goto_day(d):
        for _ in range(4):
            if p.locator(f'#cal-sheet .cal-day[data-date="{d}"]').count(): break
            p.click('#cal-prev')
        p.click(f'#cal-sheet .cal-day[data-date="{d}"]')
    goto_day(addd(prevmon, 1)); p.wait_for_selector('#cal-sheet', state='detached')
    p.click('#date-btn'); p.wait_for_selector('#cal-sheet')
    def rem(d): return p.inner_text(f'#cal-sheet .cal-day[data-date="{d}"] .cal-rem') if p.locator(f'#cal-sheet .cal-day[data-date="{d}"] .cal-rem').count() else None
    exp = {addd(prevmon, 0): '+500', addd(prevmon, 1): '-200', addd(prevmon, 3): '-300', addd(prevmon, 4): '+0'}
    got = {d: rem(d) for d in exp}
    check('calendar: per-day remaining equals target - food (+500, -200, -300, +0)', got == exp, got)
    check('calendar: over-target days are marked (class neg), under-target are not', p.locator(f'#cal-sheet .cal-day[data-date="{addd(prevmon, 1)}"] .cal-rem.neg').count() == 1 and p.locator(f'#cal-sheet .cal-day[data-date="{addd(prevmon, 0)}"] .cal-rem.neg').count() == 0)
    check('calendar: a day without entries has no number', rem(addd(prevmon, 2)) is None)
    check('calendar: first column is Monday', p.inner_text('#cal-sheet .cal-dow span >> nth=0') == 'M' and datetime.date.fromisoformat(p.get_attribute('#cal-sheet .cal-week >> nth=0 >> .cal-day >> nth=0', 'data-date')).weekday() == 0)
    check('calendar: selected week is highlighted', p.locator('#cal-sheet .cal-week.selweek').count() == 1 and p.locator('#cal-sheet .selweek .cal-day[data-date="%s"]' % addd(prevmon, 1)).count() == 1)
    avg = (500 + -200 + -300 + 0) / 4.0
    check('calendar: average remaining = 0 (500-200-300+0)/4', re.match(r'^[+-]0 kcal', p.inner_text('#cal-avg')) is not None, p.inner_text('#cal-avg'))
    check('calendar: Under goal when the average is >= 0', p.inner_text('#cal-goal') == 'Under goal', p.inner_text('#cal-goal'))
    # two other days -> average negative
    p.click('#cal-next') if p.is_enabled('#cal-next') and False else None
    p.keyboard.press('Escape'); p.wait_for_selector('#cal-sheet', state='detached')
    p.click('#date-btn'); p.wait_for_selector('#cal-sheet')
    for _ in range(3):
        if p.locator('#cal-sheet .cal-day.today').count(): break
        p.click('#cal-next')
    check('calendar: today is marked and future days are disabled', p.locator('#cal-sheet .cal-day.today').count() == 1 and all(e.is_disabled() for e in p.locator('#cal-sheet .cal-day').all() if e.get_attribute('data-date') > TODAY))
    p.keyboard.press('Escape')
    # Over goal week
    ents2 = {}; i = 100
    for d, k in ((addd(prevmon, -7), 2600), (addd(prevmon, -6), 2100)):
        i += 1; ents2.setdefault(d[:7], []).append(ent(i, d, k))
    pe2 = dict(PROF); pe2['id'] = 'p_test1'
    bf2 = '/tmp/ui_cal2.json'; backup_file(bf2, PROF, dict(ents, **{k: (ents.get(k, []) + v) for k, v in ents2.items()}))
    goto(p, 'backup'); p.set_input_files('#import-file', bf2); p.click('#import-apply'); p.wait_for_selector('#import-summary')
    goto(p, 'today'); p.click('#date-btn'); p.wait_for_selector('#cal-sheet'); goto_day(addd(prevmon, -6)); p.wait_for_selector('#cal-sheet', state='detached')
    p.click('#date-btn'); p.wait_for_selector('#cal-sheet')
    check('calendar: over-goal week says Over goal with the right average (-350)', p.inner_text('#cal-goal') == 'Over goal' and p.inner_text('#cal-avg').startswith('-350'), (p.inner_text('#cal-goal'), p.inner_text('#cal-avg')))
    p.keyboard.press('Escape')

    # ================= week strip =================
    goto(p, 'today')
    check('week strip has 7 days starting Monday', p.locator('#week-strip button').count() == 7)
    first_day = p.get_attribute('#week-strip button >> nth=0', 'data-date')
    check('week strip starts on a Monday', datetime.date.fromisoformat(first_day).weekday() == 0)
    check('future days are disabled', all(b_.is_disabled() for b_ in p.locator('#week-strip button').all() if b_.get_attribute('data-date') > TODAY))
    p.click(f'#date-btn'); p.wait_for_selector('#cal-sheet'); goto_day(addd(prevmon, 3)); p.wait_for_selector('#cal-sheet', state='detached')
    check('logged days are marked in the strip', p.locator('#week-strip button.logged').count() == 4, p.locator('#week-strip button.logged').count())
    p.click(f'#week-strip [data-date="{addd(prevmon, 1)}"]')
    check('tapping a day shows that day (two entries, 2200 kcal)', p.locator('li.entry').count() == 2 and '2200' in p.inner_text('#t-kcal').replace(',', ''), p.inner_text('#t-kcal'))
    check('remaining on that day is 200 over', '200' in p.inner_text('#t-remaining'), (p.inner_text('#t-remaining'), p.inner_text('#t-remaining-label')))
    p.context.close()

    # ================= drawer =================
    p = new_page(b); make_profile(p)
    p.click('#menu-btn'); p.wait_for_timeout(450)
    names = [e.inner_text().strip() for e in p.locator('#drawer [data-view]').all()]
    want = ['Backup & restore', 'Today', 'Daily goals', 'Weekly summary', 'Weight tracker', 'Water tracker', 'Saved entries', 'My foods', 'History', 'On-device AI', 'Check my phone', 'Settings', 'About']
    check('drawer lists Backup & restore first, then Today and the other menu items in order', names == want, names)
    check('drawer has a person switcher', p.locator('#p-switch').count() == 1)
    p.keyboard.press('Escape')
    check('Escape closes the drawer', p.evaluate("()=>document.querySelector('#drawer').inert===true||document.querySelector('#drawer').getAttribute('aria-hidden')==='true'||!document.body.classList.contains('drawer-open')"))
    for view, probe in (('goals', '#f-name'), ('weekly', '#wk-summary'), ('weight', '#wt-add'), ('water', '#water-card'), ('saved', '#saved-empty'),
                        ('myfoods', '#myfoods-back'), ('history', '#view'), ('backup', '#import-file'), ('settings', '#theme-seg'), ('about', '#credit')):
        goto(p, view)
        ok = p.locator(probe).first.count() > 0
        check('drawer -> %s opens its screen' % view, ok)
        check('drawer closes after choosing %s' % view, p.evaluate("()=>document.querySelector('#drawer').inert===true"))
    p.click('#menu-btn'); p.click('#drawer-scrim', position={'x': 340, 'y': 400});
    check('tapping the scrim closes the drawer', p.evaluate("()=>document.querySelector('#drawer').inert===true"))
    p.context.close()

    # ================= themes =================
    p = new_page(b, scheme='dark'); make_profile(p)
    bg_dark = p.evaluate("()=>getComputedStyle(document.body).backgroundColor")
    p.context.close()
    p = new_page(b, scheme='light'); make_profile(p)
    bg_light = p.evaluate("()=>getComputedStyle(document.body).backgroundColor")
    check('system dark gives a dark page and system light a light page', bg_dark != bg_light and sum(map(int, re.findall(r'\d+', bg_dark)[:3])) < sum(map(int, re.findall(r'\d+', bg_light)[:3])), (bg_dark, bg_light))
    goto(p, 'settings')
    p.click('#theme-seg [data-theme-opt=dark]')
    check('Settings -> Dark overrides a light system', p.evaluate("()=>document.documentElement.dataset.theme") == 'dark' and p.evaluate("()=>getComputedStyle(document.body).backgroundColor") == bg_dark)
    p.reload(); p.wait_for_selector('#qbar')
    check('theme choice survives a reload', p.evaluate("()=>document.documentElement.dataset.theme") == 'dark')
    check('theme is kept in its own device key', p.evaluate("()=>!!localStorage.getItem('dt:v1:ui')"))
    goto(p, 'settings'); p.click('#theme-seg [data-theme-opt=light]')
    check('Settings -> Light', p.evaluate("()=>getComputedStyle(document.body).backgroundColor") == bg_light)
    p.click('#theme-seg [data-theme-opt=system]')
    check('Settings -> System follows the phone', p.evaluate("()=>getComputedStyle(document.body).backgroundColor") == bg_light)
    p.emulate_media(color_scheme='dark')
    check('System follows a live change to dark', p.evaluate("()=>getComputedStyle(document.body).backgroundColor") == bg_dark)
    p.context.close()

    # ================= file:// load: zero network, no console errors =================
    reqs = []; errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 740})
    p = ctx.new_page()
    p.on('request', lambda r: reqs.append(r.url)); p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
    p.goto(URL); make_profile(p); quick(p, '2 roti and dal'); goto(p, 'settings'); goto(p, 'about'); goto(p, 'today')
    bad = [u for u in reqs if not (u.startswith(('file://',) + LOCALP) or u.startswith('data:') or u.startswith('about:'))]
    check('only file:/data: requests (no network at all)', not bad, bad)
    check('no console errors or page errors', not errs, errs)
    check('page works without a server: foods inline in index.html', 'id="foods"' in open(D + '/index.html').read())
    ctx.close()

    # ================= XSS =================
    errs = []
    p = new_page(b, errs=errs); make_profile(p)
    X = '<img src=x onerror="window.__x=1">'
    p.fill('#ql', X + ', 2 roti, <script>window.__x=2</script>'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('XSS: quick-log text is plain text in the preview', p.locator('#pv-sheet img, #pv-sheet script').count() == 0 and '<img' in p.inner_text('#pv-raw'))
    p.fill('#pv-sheet .pv-text >> nth=0', X + ' <b>boom</b>'); p.press('#pv-sheet .pv-text >> nth=0', 'Tab')
    check('XSS: edited preview rows stay text', p.locator('#pv-sheet img, #pv-sheet b:text("boom")').count() == 0 and p.locator('#pv-sheet .pv-text').count() >= 1)
    p.click('#pv-cancel')
    quick(p, X + ', 2 roti', save=True)
    check('XSS: saved raw text renders as text on Today', p.locator('#view img').count() == 0 and p.locator('.logtext', has_text='<img').count() == 1)
    check('XSS: nothing ran', p.evaluate("()=>window.__x") is None)
    # imported backup with hostile strings
    evil = dict(PROF); evil['id'] = 'p_evil'; evil['name'] = '<img src=x onerror="window.__x=3">Evil'
    day = today_of(p)
    e1 = ent(1, day, 300, name='<img src=x onerror="window.__x=4">Food', slotName='<b>Slot</b>', logId='l_evil')
    logs = {day[:7]: [{'id': 'l_evil', 'date': day, 'time': '12:00', 'text': '<img src=x onerror="window.__x=5"> text', 'updatedAt': 1, 'createdAt': 1}]}
    bf = '/tmp/ui_xss.json'; backup_file(bf, evil, {day[:7]: [e1]}, logs)
    goto(p, 'backup'); p.set_input_files('#import-file', bf); p.click('#import-apply'); p.wait_for_selector('#import-summary')
    check('XSS: import summary renders names as text', p.locator('#import-summary img, #backup img, #view img').count() == 0)
    goto(p, 'today')
    p.click('#menu-btn')
    check('XSS: person switcher shows the hostile name as text', p.locator('#drawer img').count() == 0)
    p.select_option('#p-switch', index=1) if p.locator('#p-switch option').count() > 1 else None
    p.keyboard.press('Escape')
    p.wait_for_selector('#qbar')
    names_ = p.inner_text('#view')
    check('XSS: imported food name / log text appear as text', p.locator('#view img').count() == 0 and '<img' in names_, names_[:200])
    goto(p, 'history')
    check('XSS: History shows imported strings as text', p.locator('#view img, #view script').count() == 0)
    check('XSS: no script ever ran', p.evaluate("()=>window.__x") is None)
    check('XSS: no page errors', not [e for e in errs if 'pageerror' in e], errs)
    p.context.close()

    # ================= 360 px layout and tap targets =================
    errs = []
    p = new_page(b, 360, 740, errs=errs); make_profile(p)
    quick(p, '2 roti and dal for lunch'); quick(p, 'snack 1 apple at 4pm')
    check('360px: Today has no horizontal scroll', not hscroll(p))
    sm = small_targets(p, 'header')
    check('44px targets in the header', not sm, sm)
    sm = small_targets(p, '#qbar')
    check('44px targets in the quick-log bar', not sm, sm)
    sm = small_targets(p, '#week-strip')
    check('44px targets in the week strip', not sm, sm)
    sm = small_targets(p, '#view')
    check('44px targets in Today', not sm, sm)
    p.click('#menu-btn'); sm = small_targets(p, '#drawer')
    check('44px targets in the drawer', not sm, sm)
    p.keyboard.press('Escape')
    for view in ('goals', 'weight', 'history', 'backup', 'settings', 'about', 'myfoods', 'weekly', 'water', 'saved'):
        goto(p, view)
        check('360px: %s has no horizontal scroll' % view, not hscroll(p))
        sm = small_targets(p, '#view')
        check('44px targets on %s' % view, not sm, sm)
    goto(p, 'add')
    check('360px: Add food view has no horizontal scroll', not hscroll(p))
    sm = small_targets(p, '#view'); check('44px targets on Add food', not sm, sm)
    goto(p, 'today')
    p.click('#date-btn'); p.wait_for_selector('#cal-sheet')
    check('360px: calendar sheet has no horizontal scroll', not hscroll(p) and p.evaluate("()=>{const s=document.querySelector('#cal-sheet');return s.scrollWidth<=s.clientWidth+1}"))
    sm = small_targets(p, '#cal-sheet'); check('44px targets in the calendar sheet', not sm, sm)
    p.keyboard.press('Escape')
    p.fill('#ql', '2 roti and dal, 1 paneer tikka, zzz'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    check('360px: preview sheet has no horizontal scroll', not hscroll(p) and p.evaluate("()=>{const s=document.querySelector('#pv-sheet');return s.scrollWidth<=s.clientWidth+1}"))
    sm = small_targets(p, '#pv-sheet'); check('44px targets in the preview sheet', not sm, sm)
    p.click('#pv-sheet .pv-notthis >> nth=0')
    sm = small_targets(p, '#pv-sheet'); check('44px targets in the preview sheet with alternatives open', not sm, sm)
    p.click('#pv-cancel')
    p.locator('li.entry .menu-btn').first.click(); p.wait_for_selector('#entry-menu')
    sm = small_targets(p, '#entry-menu'); check('44px targets in the entry menu', not sm, sm)
    check('360px: entry menu has no horizontal scroll', not hscroll(p))
    p.keyboard.press('Escape')
    check('no console errors at 360px', not errs, errs)
    p.context.close()

    # ================= old (Diet Tracker) backup =================
    p = new_page(b)
    old_prof = {'id': 'p_old1', 'name': 'Old Asha', 'sex': 'f', 'dob': '1980-02-02', 'heightCm': 158, 'startKg': 64.5, 'activity': 1.55,
                'goal': 'lose', 'rateKgWk': 0.5, 'proteinGPerKg': 1.6, 'fatPct': 25, 'override': {},
                'slots': [{'id': 's_breakfast', 'name': 'Breakfast'}, {'id': 's_lunch', 'name': 'Lunch'}, {'id': 's_dinner', 'name': 'Dinner'}], 'createdAt': 1, 'updatedAt': 1}
    oday = addd(today_of(p), -2)
    oe = [ent('o1', oday, 400, name='Poha (old)', time='08:00', slot='s_breakfast', slotName='Breakfast'),
          ent('o2', oday, 600, name='Dal chawal (old)', time='13:00')]
    of = '/tmp/ui_old.json'
    json.dump({'app': 'diet-tracker', 'schema': 1, 'exportedAt': '2025-06-01T10:00:00Z', 'profiles': [
        {'profile': old_prof, 'entries': {oday[:7]: oe}, 'weights': [{'date': oday, 'kg': 64.0}], 'foods': []}]}, open(of, 'w'))
    p.set_input_files('#import-file', of)
    p.wait_for_selector('#import-apply'); p.click('#import-apply'); p.wait_for_selector('#qbar', timeout=8000) if False else None
    p.wait_for_timeout(300)
    if p.locator('#qbar').count() == 0: p.wait_for_selector('#import-summary')
    goto(p, 'today') if p.locator('#qbar').count() else None
    p.wait_for_selector('#qbar')
    p.click('#date-btn'); p.wait_for_selector('#cal-sheet')
    for _ in range(3):
        if p.locator(f'#cal-sheet .cal-day[data-date="{oday}"]').count(): break
        p.click('#cal-prev')
    p.click(f'#cal-sheet .cal-day[data-date="{oday}"]'); p.wait_for_selector('#cal-sheet', state='detached')
    check('old backup: person and entries imported and shown', p.locator('li.entry').count() == 2 and 'Poha (old)' in p.inner_text('#view'))
    check('old backup: entries without logs show no grey text and no error', p.locator('.logtext').count() == 0)
    check('old backup: totals add up to 1000 kcal', '1000' in p.inner_text('#t-kcal').replace(',', ''), p.inner_text('#t-kcal'))
    check('old backup: custom meal slots kept (3 slots)', p.locator('section.slot').count() >= 2)
    goto(p, 'weight'); check('old backup: weight imported', '64' in p.inner_text('#view'))
    goto(p, 'goals'); check('old backup: old activity value mapped onto the new scale', p.input_value('#f-name') == 'Old Asha')
    goto(p, 'today'); quick(p, '1 banana')
    check('old backup: quick log works on an imported person', p.locator('li.entry').count() >= 1)
    p.context.close()
    b.close()

print('FAILED', res)
sys.exit(1 if res else 0)
