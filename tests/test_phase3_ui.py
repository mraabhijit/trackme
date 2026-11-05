"""Phase 3 'first' items: Edit as text (food and exercise entries) and typical meal times for past dates. file:// only."""
import sys
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright

res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)
IDLI = 'Idli (steamed, rice + urad dal 3:1)'
def entries(p):
    return p.evaluate("()=>{let o=[];Object.keys(localStorage).filter(k=>/:entries:\\d{4}-\\d\\d$/.test(k)).forEach(k=>o=o.concat(JSON.parse(localStorage[k])));return o}")
def entry_row(p, name):
    return p.locator('li.entry', has=p.locator('b', has_text=re.compile('^' + name)))

with sync_playwright() as pw:
    b = pw.chromium.launch()
    errs = []
    p = new_page(b, errs=errs); make_profile(p, 'Edit', 2000, kg=70); TODAY = today_of(p)
    check('version string is 1.1.4', p.evaluate("()=>Journable.version") == '1.1.4')
    quick(p, '2 roti and 1 katori dal for lunch at 1:15 pm')
    before = {e['foodName'][:4]: e for e in entries(p)}
    entry_row(p, 'Roti').first.locator('.menu-btn').click(); p.click('#em-edit'); p.wait_for_selector('#edit-text')
    check('Edit as text box is on the Edit entry screen, prefilled like "2 roti"', p.input_value('#edit-text') == '2 roti', p.input_value('#edit-text'))
    check('Use this is disabled until the text changes', p.is_disabled('#et-apply'))
    p.fill('#edit-text', '3 idli')
    check('live: shows the resolved food, amount and kcal', p.inner_text('#et-food') == IDLI and '3' in p.inner_text('#et-live') and p.inner_text('#et-kcal') == '%d kcal' % round(kcal_of(IDLI, 120)) , p.inner_text('#et-live'))
    p.fill('#edit-text', '2 roti and 1 katori dal')
    check('live: more than one food uses the first and says how many were ignored', 'Roti' in p.inner_text('#et-food') and 'Only the first food is used (1 more ignored)' in p.inner_text('#et-live'), p.inner_text('#et-live'))
    p.fill('#edit-text', 'zxqvb')
    check('live: no food found message and Use this disabled', 'No food found' in p.inner_text('#et-live') and p.is_disabled('#et-apply'))
    p.fill('#edit-text', 'walked 30 min')
    check('live: exercise words give a pointer, not a food', 'looks like exercise' in p.inner_text('#et-live') and p.is_disabled('#et-apply'))
    p.fill('#edit-text', '3 idli'); p.click('#et-apply')
    check('Use this fills the form: food, qty 3, kcal live', IDLI in p.inner_text('#view') and p.input_value('#qty') == '3' and p.inner_text('#pv-kcal') == '%d kcal' % round(kcal_of(IDLI, 120)), p.inner_text('#pv-kcal'))
    check('date, time and meal fields are untouched by the text', p.input_value('#adate') == TODAY and p.locator('#aslot [data-slot=s_lunch][aria-pressed=true]').count() == 1)
    p.click('#save-entry'); p.wait_for_selector('#qbar')
    after = {e['foodName'][:4]: e for e in entries(p)}
    old = before['Roti']; new = [e for e in entries(p) if e['id'] == old['id']][0]
    check('saved: the same entry id now holds the new food, amount and unit', new['foodName'] == IDLI and new['qty'] == 3 and new['grams'] == 120 and new['unit'] == 'piece', new)
    check('saved: date, time and slot kept; createdAt kept', new['date'] == old['date'] and new['time'] == old['time'] == '13:15' and new['slot'] == old['slot'] and new['createdAt'] == old['createdAt'])
    check('saved: nutrition snapshot is the idli food-list values', abs(new['per100']['kcal'] - UNITS[IDLI]['per_100g']['kcal']) < 0.01)
    check('saved: other entries unchanged (dal still there, 2 entries)', len(entries(p)) == 2 and any(e['foodName'].startswith('Dal') for e in entries(p)))
    # quantity only, same food: text is "1 katori dal" -> 2 katori dal
    entry_row(p, 'Dal').first.locator('.menu-btn').click(); p.click('#em-edit'); p.wait_for_selector('#edit-text')
    check('prefill for a katori food: "1 katori dal"', p.input_value('#edit-text') == '1 katori dal', p.input_value('#edit-text'))
    p.fill('#edit-text', 'dal 2 katori')
    check('"dal 2 katori" reads as 2 katori', '2' in p.inner_text('#et-live') and 'katori' in p.inner_text('#et-live'), p.inner_text('#et-live'))
    p.click('#et-apply'); p.click('#save-entry'); p.wait_for_selector('#qbar')
    d2 = [e for e in entries(p) if e['foodName'].startswith('Dal')][0]
    check('saved: 2 katori dal = 300 g', d2['qty'] == 2 and d2['grams'] == 300 and d2['unit'] == 'katori', d2)

    # hand-adjusted calories: kept only if the user confirms the change
    entry_row(p, 'Dal').first.locator('.menu-btn').click(); p.click('#em-adjust'); p.wait_for_selector('#adj-kcal')
    p.fill('#adj-kcal', '123'); p.click('#adj-save'); p.wait_for_selector('#adj-kcal', state='detached')
    check('precondition: the entry has adjusted calories', [e for e in entries(p) if e['foodName'].startswith('Dal')][0].get('adj', {}).get('kcal') == 123)
    entry_row(p, 'Dal').first.locator('.menu-btn').click(); p.click('#em-edit'); p.wait_for_selector('#edit-text')
    p.fill('#edit-text', 'dal 1 katori')
    check('live: tells the user hand-adjusted calories would be reset', 'hand-adjusted calories will be reset' in p.inner_text('#et-live'))
    p.click('#et-apply'); p.click('#save-entry')
    check('saving a changed amount asks first (adjusted calories are not dropped silently)', p.locator('#adj-warn').count() == 1 and p.locator('#qbar').is_hidden())
    check('...and nothing was saved yet', [e for e in entries(p) if e['foodName'].startswith('Dal')][0].get('adj', {}).get('kcal') == 123 and [e for e in entries(p) if e['foodName'].startswith('Dal')][0]['qty'] == 2)
    p.click('#save-entry'); p.wait_for_selector('#qbar')
    d3 = [e for e in entries(p) if e['foodName'].startswith('Dal')][0]
    check('after confirming: new amount saved and the adjustment is cleared', d3['qty'] == 1 and 'adj' not in d3, d3)
    # unchanged text keeps adj
    entry_row(p, 'Dal').first.locator('.menu-btn').click(); p.click('#em-adjust'); p.wait_for_selector('#adj-kcal'); p.fill('#adj-kcal', '99'); p.click('#adj-save'); p.wait_for_selector('#adj-kcal', state='detached')
    entry_row(p, 'Dal').first.locator('.menu-btn').click(); p.click('#em-edit'); p.wait_for_selector('#edit-text'); p.click('#save-entry'); p.wait_for_selector('#qbar')
    check('saving with the text untouched keeps the adjustment', [e for e in entries(p) if e['foodName'].startswith('Dal')][0].get('adj', {}).get('kcal') == 99)
    goto(p, 'add'); p.wait_for_selector('#q')
    check('the Add food screen has no Edit as text box', p.locator('#edit-text').count() == 0)

    # exercise entries
    goto(p, 'today'); quick(p, 'brisk walk 45 min')
    p.locator('li.ex-row .menu-btn').click(); p.click('#ex-edit'); p.wait_for_selector('#exe-text')
    check('exercise Edit as text is prefilled like "45 min brisk walking"', p.input_value('#exe-text') == '45 min brisk walking', p.input_value('#exe-text'))
    p.fill('#exe-text', '1 hour jog')
    check('exercise: "1 hour jog" selects Jogging and 60 minutes with live kcal (7 MET x 70 kg x 1 h = 490)', p.input_value('#exe-act') == 'jog' and p.input_value('#exe-min') == '60' and '490' in p.inner_text('#exe-info') and 'Jogging' in p.inner_text('#exe-text-live'), (p.input_value('#exe-act'), p.inner_text('#exe-info')))
    p.fill('#exe-text', 'asdf qwer')
    check('exercise: unknown words say so and change nothing', 'No exercise found' in p.inner_text('#exe-text-live') and p.input_value('#exe-act') == 'jog')
    p.fill('#exe-text', 'badminton')
    check('exercise: no duration reads as 30 minutes assumed', p.input_value('#exe-min') == '30' and '30 min assumed' in p.inner_text('#exe-text-live'), p.inner_text('#exe-text-live'))
    p.fill('#exe-text', '45 min brisk walk'); p.click('#exe-save'); p.wait_for_selector('#ex-edit-sheet', state='detached')
    check('exercise saved with the typed words: Brisk walking 45 min = 4.3 x 70 x 0.75 = 226', p.inner_text('#ex-burned').strip() == 'Burned 226' and 'Brisk walking' in p.inner_text('li.ex-row'), p.inner_text('#ex-card'))
    check('no page errors (edit as text)', not errs, errs)
    p.context.close()

    # ============ typical times on past dates (preview sheet) ============
    errs = []
    p = new_page(b, errs=errs); make_profile(p, 'Time', 2000); TODAY = today_of(p)
    def chip(): return p.inner_text('#pv-time-chip').strip()
    for words, want in (('dinner yesterday 2 roti', 'Time: 8:00 PM'), ('breakfast yesterday 2 idli', 'Time: 8:00 AM'), ('lunch yesterday 2 roti', 'Time: 1:00 PM'),
                        ('snack yesterday 1 banana', 'Time: 5:00 PM'), ('late night snack yesterday 1 banana', 'Time: 11:00 PM'), ('kal raat 2 roti', 'Time: 8:00 PM'),
                        ('dinner yesterday 2 roti at 9pm', 'Time: 9:00 PM'), ('yesterday 2 roti', 'Time: 12:00 PM')):
        p.fill('#ql', words); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
        check('past date preview "%s" -> %s' % (words, want), chip() == want, chip())
        p.click('#pv-cancel')
    p.fill('#ql', 'dinner yesterday 2 roti'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.click('#pv-save'); p.wait_for_selector('#pv-sheet', state='detached')
    check('saved with the typical dinner time 20:00 on yesterday', [e for e in entries(p)][0]['time'] == '20:00' and entries(p)[0]['date'] == addd(TODAY, -1) and entries(p)[0]['slotName'] == 'Dinner', entries(p)[0])
    # today keeps now (saving moved the view to yesterday, so go back to today first)
    p.click('#week-strip [data-date="' + TODAY + '"]')
    now = p.evaluate("()=>{const d=new Date();return d.getHours()*60+d.getMinutes()}")
    p.fill('#ql', 'lunch 2 roti'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    m = re.match(r'Time: (\d+):(\d\d) (AM|PM)', chip()); mm = (int(m.group(1)) % 12 + (12 if m.group(3) == 'PM' else 0)) * 60 + int(m.group(2))
    check('today with a meal word and no time keeps the current time', abs(mm - now) <= 2, (chip(), now))
    # changing the date chip to the past with a meal word switches to the typical time, back to today returns to now
    p.click('#pv-date-chip'); p.fill('#pv-date', addd(TODAY, -2)); p.dispatch_event('#pv-date', 'change')
    check('moving the preview to a past date uses the typical lunch time (1:00 PM) because the words named lunch', chip() == 'Time: 1:00 PM', chip())
    p.fill('#pv-date', TODAY); p.dispatch_event('#pv-date', 'change')
    m = re.match(r'Time: (\d+):(\d\d) (AM|PM)', chip()); mm = (int(m.group(1)) % 12 + (12 if m.group(3) == 'PM' else 0)) * 60 + int(m.group(2))
    check('moving back to today returns to the current time', abs(mm - now) <= 2, chip())
    p.click('#pv-cancel')
    # no meal word -> pick a meal in the sheet on a past date
    p.fill('#ql', 'yesterday 2 roti'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    p.click('#pv-meal-chip'); p.click('#pv-sheet [data-slot=s_dinner]')
    check('picking Dinner for a past day (untouched time) sets 8:00 PM', chip() == 'Time: 8:00 PM', chip())
    p.click('#pv-cancel')
    # an explicit time is never replaced by choosing a meal
    p.fill('#ql', 'yesterday 2 roti at 6:30 pm'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
    p.click('#pv-meal-chip'); p.click('#pv-sheet [data-slot=s_lunch]')
    check('an explicit time (6:30 PM) is not changed by choosing a meal', chip() == 'Time: 6:30 PM', chip())
    p.click('#pv-cancel')
    check('no page errors (typical times)', not errs, errs)
    p.context.close()

    # ============ drawer order ============
    p = new_page(b); make_profile(p, 'Dr', 2000)
    p.click('#menu-btn'); p.wait_for_timeout(400)
    items = p.eval_on_selector_all('#drawer [data-view]', 'e=>e.map(x=>x.getAttribute("data-view"))')
    check('drawer: person switcher, then Backup & restore first, then the rest', items[0] == 'backup' and items[1] == 'today' and 'ai' in items and 'phone' in items, items)
    first_after_people = p.evaluate("()=>{const d=document.querySelector('#drawer');const kids=[...d.children].map(c=>c.className||c.tagName);return kids}")
    check('drawer structure: brand, people, then the nav list', first_after_people[:3] == ['drawer-brand', 'drawer-people', 'plain nav-list'], first_after_people)
    p.click('#drawer [data-view=ai]'); p.wait_for_selector('#ai-card-0')
    check('On-device AI opens from the drawer', 'On-device AI' in p.inner_text('#title'))
    p.click('#menu-btn'); p.wait_for_timeout(300); p.click('#drawer [data-view=phone]'); p.wait_for_selector('#phone-list')
    check('Check my phone opens from the drawer', 'Check my phone' in p.inner_text('#title'))
    p.context.close()
    b.close()
print('FAILED', res)
sys.exit(1 if res else 0)
