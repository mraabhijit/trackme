import json, sys, datetime, re
from playwright.sync_api import sync_playwright
import sys; sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
res=[]
def check(name, ok, info=''):
    res.append((name, bool(ok))); print(('PASS' if ok else 'FAIL'), name, info)
today=datetime.date.today()
dob=today.replace(year=today.year-30)-datetime.timedelta(days=30)  # age 30
import dbdata; ifct=dbdata.ifct(); hh=dbdata.dishes()
roti=[d for d in hh if d['name'].startswith('Roti')][0]; dal=[d for d in hh if d['name'].startswith('Dal (toor')][0]
exp_kcal = roti['per_100g']['kcal']*0.70 + dal['per_100g']['kcal']*1.5

def create(page,name,sex,kg,cm,act,dobs):
    page.fill('#f-name',name); page.select_option('#f-sex',sex); page.fill('#f-dob',dobs)
    page.fill('#f-height',str(cm)); page.fill('#f-weight',str(kg)); page.select_option('#f-activity',str(act))

def add_food(page,query,qty,pick=None):
    goto(page,'add'); page.fill('#q',query)
    page.locator('button.result').first.click()
    page.fill('#qty',str(qty)); page.dispatch_event('#qty','input'); page.click('#save-entry')

with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True)
    page=ctx.new_page(); errors=[]; reqs=[]
    page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: reqs.append(r.url) if not r.url.startswith(('file://',)+LOCALP) and not r.url.startswith('data:') and not r.url.startswith('blob:') else None)
    page.goto(URL)
    check('first run shows profile form', page.locator('#f-name').count()==1)
    check('save-file notice shown', 'not inside WhatsApp or Gmail' in page.inner_text('#save-notice'))
    check('restore on welcome', page.locator('#restore #import-file').count()==1)
    page.click('#menu-btn'); check('menu items disabled before profile', page.locator('#drawer [data-view=today]').is_disabled()); page.keyboard.press('Escape')
    check('advanced collapsed', not page.locator('#advanced').evaluate('e=>e.open'))
    page.click('#save-notice button'); check('notice dismissible', page.locator('#save-notice').count()==0)
    page.reload(); check('notice stays dismissed', page.locator('#save-notice').count()==0)
    create(page,'Asha','m',80,180,1.45,dob.isoformat())
    bmr=page.inner_text('#pv-bmr'); check('BMR 1780', bmr.strip()=='1780 kcal', bmr)
    check('TDEE 2581 (On your feet most of the day 1.45)', page.inner_text('#pv-tdee').strip()=='2581 kcal', page.inner_text('#pv-tdee'))
    page.click('#save-profile')
    check('lands on Today', page.locator('h1').first.inner_text()=='Today')
    # F golden
    # add food
    add_food(page,'roti',2)
    add_food(page,'dal toor',1)
    page.wait_for_selector('#t-remaining')
    kc=int(page.inner_text('#t-kcal')); check('eaten kcal matches', abs(kc-round(exp_kcal))<=1, f'{kc} vs {exp_kcal:.1f}')
    tgt=int(tn(page,'#t-target').split()[0]); check('target 2031', tgt==2031, tgt)
    rem=int(page.inner_text('#t-remaining').split()[0]); check('remaining', rem==tgt-kc, f'{rem}')
    check('deficit label', 'under' in tn(page,'#t-deficit') and 'shrinks as you eat' in tn(page,'#deficit-help'))
    check('Remaining label in the calories card', 'Remaining' in page.inner_text('#cal-card'))
    check('date strip buttons >=44', page.evaluate("[...document.querySelectorAll('.strip button')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44})"))
    dfc=int(tn(page,'#t-deficit').split()[0]); check('deficit = TDEE - eaten', dfc==2581-kc, f'{dfc}')
    txt=page.inner_text('#view'); check('entry list shows roti 70 g', '70 g' in txt and 'Roti' in txt)
    check('estimate tag in add search', True)
    # ghee/oil/butter search
    goto(page,'add')
    for q in ('ghee','oil','butter'):
        page.fill('#q',q); first=page.locator('button.result').first.inner_text()
        check(f'search {q}', q in first.lower(), first.split('\n')[0])
    page.fill('#q','roti'); check('estimate tag visible', page.locator('.result .tag', has_text='estimate').count()>0)
    # ghee log: tsp chips
    page.fill('#q','ghee'); page.locator('button.result').first.click()
    chips=page.locator('[aria-label=Unit] .chip').all_inner_texts(); check('ghee chips tsp/tbsp', any('tsp' in c for c in chips) and any('tbsp' in c for c in chips), chips)
    page.click('text=Cancel')
    # raw rice
    goto(page,'add')
    for q,want in (('rice','Plain rice, cooked'),('milk','milk'),('egg','Egg, boiled'),('doodh','milk'),('dal','Dal'),('banana','Banana'),('ghee','Ghee'),('oil','oil'),('butter','Butter'),('chana masala','Chole'),('bread','Bread')):
        page.fill('#q',q); first=page.locator('button.result').first.inner_text().split('\n')[0]
        check(f'rank {q} -> {want}', want.lower() in first.lower(), first)
    page.fill('#q','milk'); r=[x.split('\n')[0] for x in page.locator('button.result').all_inner_texts()]
    check('milk: no Milk fish first', not r[0].startswith('Milk fish'), r[:4])
    page.fill('#q','doodh'); r=[x.split('\n')[0] for x in page.locator('button.result').all_inner_texts()]
    check('doodh finds milk, not curd', r and all('milk' in x.lower() for x in r), r)
    page.fill('#q','dal'); r=[x.split('\n')[0] for x in page.locator('button.result').all_inner_texts()]
    check('dal does not match vanaspati', not any('Vanaspati' in x for x in r), r[:6])
    page.fill('#q','banana'); page.locator('button.result').first.click()
    check('banana defaults to household unit', '100' in page.inner_text('#pv-kcal')+page.inner_text('#preview'), page.inner_text('#preview'))
    page.click('text=Cancel'); goto(page,'add')
    page.fill('#q','rice, raw, milled'); page.locator('button.result').first.click()
    page.locator('[aria-label=Unit] .chip').first.click()   # raw rice now also offers katori / cup portions: pick grams explicitly
    page.fill('#qty','100'); page.dispatch_event('#qty','input')
    pv=page.inner_text('#pv-kcal'); check('rice raw 100 g ~356', abs(int(pv.split()[0])-356)<=2, pv)
    chips=page.locator('[aria-label=Unit] .chip').all_inner_texts(); check('raw rice: grams chip first, then the estimated katori / cup portions', chips==['g (grams)', 'katori raw (~125 g)', 'cup raw (~125 g)'], chips)
    check('raw labelled', 'raw ingredient' in page.inner_text('#view'))
    page.click('text=Cancel')
    # weight
    goto(page,'weight')
    page.click('#wt-add'); page.fill('#w-kg','79.5'); page.click('#w-save'); check('weight chart present', page.locator('svg.wtchart').count()==1)
    # history
    goto(page,'history'); check('history has today', 'kcal' in page.inner_text('#view'))
    # edit/delete
    goto(page,'today')
    delete_entry(page,'Roti / phulka (whole wheat, no ghee)')
    check('delete + undo toast', page.locator('.toast').count()==1)
    page.click('.toast button'); check('undo restores', 'Roti' in page.inner_text('#view'))
    edit_entry(page,'Roti'); page.fill('#qty','3'); page.dispatch_event('#qty','input'); page.click('#save-entry')
    check('edit saved (3 x 35 = 105 g)', '105 g' in page.inner_text('#view'))
    edit_entry(page,'Roti'); page.fill('#qty','2'); page.dispatch_event('#qty','input'); page.click('#save-entry')
    kc_before=int(page.inner_text('#t-kcal'))
    # second profile
    add_person(page)
    create(page,'Ravi','f',60,165,1.3,(today.replace(year=today.year-25)-datetime.timedelta(days=10)).isoformat())
    check('F golden BMR 1345.25', page.inner_text('#pv-bmr').strip()=='1345.25 kcal', page.inner_text('#pv-bmr'))
    page.select_option('#f-activity','1.2')
    # override
    page.click('#advanced summary'); page.fill('#f-ovkcal','1800'); check('override reflected in preview', page.inner_text('#pv-target').startswith('1800'))
    page.fill('#f-ovkcal',''); check('override cleared', not page.inner_text('#pv-target').startswith('1800'))
    page.click('#save-profile')
    check('second profile empty', page.inner_text('#t-kcal')=='0')
    switch_person(page,'Asha')
    check('first profile intact', int(page.inner_text('#t-kcal'))==kc_before)
    # export
    goto(page,'backup')
    with page.expect_download() as dl: page.click('#export-all')
    path='/tmp/dt-export.json'; dl.value.save_as(path)
    data=json.load(open(path)); check('export has 2 profiles', len(data['profiles'])==2)
    # clear and reload
    page.evaluate('localStorage.clear()'); page.reload()
    check('after clear shows welcome', page.locator('#f-name').count()==1)
    # bad json
    open('/tmp/bad.json','w').write('{nope'); 
    # need a profile to see import card -> import goes through a created profile; create temp
    create(page,'Tmp','m',70,170,1.2,'1990-01-01'); page.click('#save-profile')
    goto(page,'backup')
    page.set_input_files('#import-file','/tmp/bad.json'); page.wait_for_selector('#import-error')
    check('bad JSON friendly error', 'not a valid backup' in page.inner_text('#import-error'), page.inner_text('#import-error'))
    open('/tmp/other.json','w').write('{"hello":1}')
    page.set_input_files('#import-file','/tmp/other.json'); page.wait_for_selector('#import-error')
    check('wrong file friendly error', 'does not look like' in page.inner_text('#import-error'))
    page.set_input_files('#import-file',path); page.wait_for_selector('#import-apply'); page.click('#import-apply')
    page.wait_for_selector('#import-summary'); print(page.inner_text('#import-summary'))
    page.click('#menu-btn'); opts=page.locator('#p-switch option').all_inner_texts(); check('imported profiles present', 'Asha' in opts and 'Ravi' in opts, opts)
    page.select_option('#p-switch', label='Asha')
    check('round trip totals', int(page.inner_text('#t-kcal'))==kc_before, page.inner_text('#t-kcal'))
    # merge again: newer wins / no dups
    goto(page,'backup'); page.set_input_files('#import-file',path); page.click('#import-apply'); page.wait_for_selector('#import-summary')
    switch_person(page,'Asha')
    check('re-merge no duplicates', int(page.inner_text('#t-kcal'))==kc_before)
    # delete profile removes only own keys
    switch_person(page,'Ravi'); goto(page,'settings')
    keys_before=page.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("dt:v1:p:")).length')
    page.click('summary:has-text("Delete this person")')
    check('delete disabled before export', page.locator('#del-go').is_disabled())
    page.fill('#del-name','Ravi'); 
    with page.expect_download(): page.click('#del-export')
    page.fill('#del-name','Ravi'); check('delete enabled after export+name', not page.locator('#del-go').is_disabled())
    page.click('#del-go')
    names=page.evaluate('Object.keys(localStorage).filter(k=>k.includes(":profile")).length')
    asha_keys=page.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("dt:v1:p:")).length')
    check('delete leaves others', names==2 and asha_keys<keys_before, f'{names} {asha_keys}<{keys_before}')
    # weight chart point counts
    page.evaluate("""()=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));const pid=m.activeProfileId;const w=[];const d0=new Date();for(let i=0;i<200;i++){const d=new Date(d0);d.setDate(d.getDate()-i);w.push({date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),kg:80-i*0.02,updatedAt:1})}localStorage.setItem('dt:v1:p:'+pid+':weights',JSON.stringify(w))}""")
    page.reload(); goto(page,'weight'); page.click('button:has-text("All")')
    check('weight chart 200 pts', page.locator('svg.wtchart circle').count()==200)
    page.evaluate("""()=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));localStorage.setItem('dt:v1:p:'+m.activeProfileId+':weights','[]')}""")
    page.reload(); goto(page,'weight'); check('weight 0 pts message', 'No weights logged' in page.inner_text('#view'))
    page.evaluate("""()=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));localStorage.setItem('dt:v1:p:'+m.activeProfileId+':weights',JSON.stringify([{date:'%s',kg:75,updatedAt:1}]))}"""%today.isoformat())
    page.reload(); goto(page,'weight'); check('weight 1 pt', page.locator('svg.wtchart circle').count()==1)
    # reload to restore data for screenshots: re-import
    goto(page,'backup'); page.set_input_files('#import-file',path); page.click('#import-apply'); page.wait_for_selector('#import-summary')
    switch_person(page,'Asha')
    page.wait_for_timeout(200)
    page.screenshot(path='/tmp/today-390x844.png')
    # 360 layout on each tab
    page.set_viewport_size({'width':360,'height':740})
    for t in ('today','add','history','weight','goals','settings','backup'):
        goto(page,t)
        sw=page.evaluate('document.documentElement.scrollWidth'); check(f'360px no h-scroll on {t}', sw<=360, sw)
    goto(page,'add'); page.fill('#q','roti'); page.locator('button.result').first.click()
    bb=page.locator('#save-entry').bounding_box(); check('save button visible without scrolling at 360x740', bb and bb['y']+bb['height']<=740, bb)
    check('360px no h-scroll add form', page.evaluate('document.documentElement.scrollWidth')<=360)
    # tap targets
    small=page.evaluate("""()=>[...document.querySelectorAll('button,select,input:not([type=radio])')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<43.5||r.width<43.5)}).map(e=>e.outerHTML.slice(0,80))""")
    check('add form tap targets >=44', not small, small[:3])
    # footer
    goto(page,'about'); check('credit visible on About', page.locator('#credit').is_visible() and 'IFCT 2017, ICMR-National Institute of Nutrition (via npm ifct2017-compositions)' in page.inner_text('#credit'))
    check('no console errors', not errors, errors)
    check('no network requests', not reqs, reqs)
    b.close()
    # storage blocked
    b=pw.chromium.launch(); c2=b.new_context(); p2=c2.new_page(); p2.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
    p2.goto(URL); check('storage blocked banner', 'blocking storage' in p2.inner_text('#banners')); b.close()
    # midnight rollover via fake clock
    b=pw.chromium.launch(); c3=b.new_context(viewport={'width':390,'height':844}); p3=c3.new_page()
    p3.clock.install(time=datetime.datetime(2026,11,2,23,59,0)); p3.goto(URL)
    create(p3,'Z','m',80,180,1.6,'1996-01-01'); p3.click('#save-profile')
    d1=p3.inner_text('#date-long'); p3.clock.run_for(120000); p3.wait_for_timeout(100)
    d2=p3.inner_text('#date-long'); check('midnight rollover', d1!=d2 and 'November 3' in d2, (d1,d2)); b.close()
print('FAILED:', [n for n,o in res if not o])
