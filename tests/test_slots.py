import json, datetime, sys
sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
import json, datetime
from playwright.sync_api import sync_playwright
import sys; sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
res=[]
today=datetime.date.today(); yday=(today-datetime.timedelta(days=1)).isoformat()
def check(n,ok,info=''): res.append((n,bool(ok))); print('PASS' if ok else 'FAIL',n,info)
def create(page,name='A'):
    page.fill('#f-name',name); page.fill('#f-dob','1990-01-01'); page.fill('#f-height','170'); page.fill('#f-weight','70'); page.click('#save-profile')
td=today.isoformat()
def tab(page,t): goto(page,t)
def log(page,q,slot=None,time=None,date=None):
    tab(page,'add'); page.fill('#q',q); page.locator('button.result').first.click()
    if slot: page.click(f'#aslot .chip:text-is("{slot}")')
    if time: set_time(page,time)
    if date: page.fill('#adate',date)
    page.click('#save-entry')
def pressed(page): return page.locator('#aslot .chip[aria-pressed=true]').inner_text()
def cards(page): return page.evaluate("[...document.querySelectorAll('section.slot')].map(s=>[s.getAttribute('aria-label'),[...s.querySelectorAll('.entry')].map(e=>e.querySelector('b').textContent+'@'+e.getAttribute('data-time'))])")
def store(page): return page.evaluate("Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))")
def prof(page):
    s=store(page); k=[k for k in s if k.endswith(':profile')][0]; return json.loads(s[k])
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True); page=ctx.new_page()
    errs=[]; reqs=[]
    page.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); page.on('pageerror',lambda e: errs.append(str(e)))
    page.on('request',lambda r: reqs.append(r.url) if not r.url.startswith(('file:','data:','blob:')+LOCALP) else None)
    page.goto(URL); create(page,'Asha')
    goto(page,'add'); chips=page.locator('#add-meals .chip').all_inner_texts(); goto(page,'today')
    check('default slots appear as Add-to chips on the Add food screen', chips==['Add to '+n for n in ['Breakfast','Mid-morning snack','Lunch','Evening snack','Dinner','Late-night snack']], chips)
    tab(page,'add')
    page.fill('#q','roti'); page.locator('button.result').first.click()
    check('first slot preselected', page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Breakfast')
    # custom slot in add form
    page.click('#new-slot-chip'); check('new slot input maxlength 30', page.get_attribute('#new-slot-name','maxlength')=='30')
    page.fill('#new-slot-name','   '); page.click('#new-slot-add'); check('empty name rejected', 'name' in page.inner_text('#aslot').lower())
    page.fill('#new-slot-name','lunch'); page.click('#new-slot-add'); check('duplicate (case-insens) rejected', 'already' in page.inner_text('#aslot'))
    page.fill('#new-slot-name','Pre-workout'); page.click('#new-slot-add')
    check('custom slot selected', page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Pre-workout')
    check('save button names slot', page.inner_text('#save-entry')=='Add to Pre-workout')
    set_time(page,'06:15'); page.click('#save-entry')
    check('custom slot card on Today', ('Pre-workout',['Roti / phulka (whole wheat, no ghee)@06:15']) in [tuple(c) for c in cards(page)], cards(page))
    # preselect after last logged slot (Pre-workout is 7th/last -> stays last)
    tab(page,'add'); page.fill('#q','dal'); page.locator('button.result').first.click()
    check('preselect after last logged (last stays)', page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Pre-workout')
    page.click('text=Cancel')
    # two entries same slot different times sorted
    log(page,'banana','Evening snack','18:30'); log(page,'apple','Evening snack','17:00')
    ev=[c for c in cards(page) if c[0]=='Evening snack'][0][1]
    check('same slot entries sorted by time', [x.split('@')[1] for x in ev]==['17:00','18:30'], ev)
    order=[c[0] for c in cards(page)]
    check('slot cards follow slot order', order.index('Evening snack')<order.index('Pre-workout'), order)
    tab(page,'add'); page.fill('#q','tea'); page.locator('button.result').first.click()
    check('default = slot of most recently added entry (Evening snack)', page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Evening snack')
    page.click('text=Cancel')
    # quick edit time
    quick_edit(page,'section.slot[aria-label="Evening snack"] li.entry','05:45')
    page.wait_for_timeout(100)
    page.reload()
    allt=[x.split('@')[1] for c in cards(page) for x in c[1]]
    check('quick-edit time persists after reload', '05:45' in allt, allt)
    # snapshot integrity: tamper stored per100 then change slot/time via Edit
    k=page.evaluate("Object.keys(localStorage).find(k=>k.includes(':entries:'))")
    page.evaluate("k=>{const a=JSON.parse(localStorage.getItem(k));a.forEach(e=>{if(e.foodName==='Apple')e.per100.kcal=999});localStorage.setItem(k,JSON.stringify(a))}",k)
    page.reload()
    edit_entry(page,'Apple'); page.click('#aslot .chip:text-is("Dinner")'); set_time(page,'20:10'); page.click('#save-entry')
    e=page.evaluate("k=>JSON.parse(localStorage.getItem(k)).find(e=>e.foodName==='Apple')",k)
    check('edit moves slot+time, snapshot intact', e['time']=='20:10' and e['slotName']=='Dinner' and e['per100']['kcal']==999 and e['slot']=='s_dinner', e)
    check('moved entry shown under Dinner', any(c[0]=='Dinner' for c in cards(page)))
    # rename slot
    tab(page,'settings'); inp=page.locator('#slots .slotrow input').nth(6); inp.fill('Gym snack'); inp.blur()
    tab(page,'today'); names=[c[0] for c in cards(page)]
    check('rename updates display', 'Gym snack' in names and 'Pre-workout' not in names, names)
    tab(page,'settings'); page.fill('#slot-new-name','gym SNACK'); page.click('#slot-add'); check('profile: duplicate rejected', 'already' in page.inner_text('#slots'))
    # reorder: move Gym snack up
    page.click('button[aria-label="Move Gym snack up"]')
    check('reorder up', prof(page)['slots'][5]['name']=='Gym snack' and prof(page)['slots'][6]['name']=='Late-night snack', [s['name'] for s in prof(page)['slots']])
    # delete slot keeps entries
    page.click('button[aria-label="Delete Gym snack"]'); check('delete needs confirm', page.locator('text=Delete "Gym snack"?').count()==1)
    page.click('button:text-is("Keep it")'); check('keep it keeps slot', 'Gym snack' in [s['name'] for s in prof(page)['slots']])
    page.click('button[aria-label="Delete Gym snack"]'); page.click('#slots button:has-text("Delete Gym snack")')
    check('slot removed from profile', 'Gym snack' not in [s['name'] for s in prof(page)['slots']])
    tab(page,'today'); cs=cards(page); names=[c[0] for c in cs]
    check('entries of deleted slot shown under snapshot name after live slots', names[-1]=='Gym snack' and cs[-1][1][0].startswith('Roti'), names)
    check('no entry lost', sum(len(c[1]) for c in cs)==3, cs)
    # edit an orphan entry keeps its (removed) slot
    edit_entry(page,'Roti'); check('orphan slot chip shown', 'Gym snack (removed)' in page.inner_text('#aslot')); page.click('text=Cancel')
    # copy day to today keeps slot
    log(page,'banana','Lunch','13:05',yday)
    tab(page,'history'); page.locator('section:has-text("(today)")').count()
    page.locator('.card',has=page.locator('h3:not(:has-text("today"))')).first.locator('button:text-is("Copy to today")').click()
    tab(page,'today'); cs=cards(page); check('copy day keeps slot and time', any(c[0]=='Lunch' and any(x.endswith('@13:05') for x in c[1]) for c in cs), cs)
    # week chart + other tabs
    check('Today has no 7-day chart any more (v1.1)', page.locator('svg.chart').count()==0)
    tab(page,'weight'); tab(page,'history')
    # 360 layout
    page.set_viewport_size({'width':360,'height':740})
    for t in ('today','add','history','weight','goals','settings','backup'):
        tab(page,t); check(f'360 no h-scroll {t}', page.evaluate('document.documentElement.scrollWidth')<=360, page.evaluate('document.documentElement.scrollWidth'))
    tab(page,'settings'); small=page.evaluate("""()=>[...document.querySelectorAll('#slots button,#slots input,.chip,#empty-slots button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<43.5||r.width<43.5)}).map(e=>e.outerHTML.slice(0,60))""")
    check('slot controls >=44px', not small, small)
    tab(page,'today'); small=page.evaluate("""()=>[...document.querySelectorAll('.chip,.entry button,.entry .tp-ap')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<43.5||r.width<43.5)}).map(e=>e.outerHTML.slice(0,60))""")
    check('Today chips/time/buttons >=44px', not small, small)
    tab(page,'add'); page.fill('#q','apple'); page.locator('button.result').first.click()
    bb=page.locator('#save-entry').bounding_box(); check('add button visible 360x740 with 7 chips', bb['y']+bb['height']<=740, bb)
    check('360 no h-scroll add form', page.evaluate('document.documentElement.scrollWidth')<=360)
    page.set_viewport_size({'width':390,'height':844})
    # ---- migration: old localStorage state ----
    ctx.close(); ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True); page=ctx.new_page()
    page.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); page.on('pageerror',lambda e: errs.append(str(e)))
    page.goto(URL)
    td=today.isoformat(); ym=td[:7]
    def ent(i,slot,time,name): return {"id":"e%d"%i,"date":td,"time":time,"slot":slot,"foodId":"d_x","foodName":name,"qty":1,"unit":"g","unitLabel":"g","unitG":1,"grams":100,"per100":{"kcal":100,"p":1,"c":1,"f":1,"fib":0},"updatedAt":1}
    old_ents=[ent(1,'breakfast','08:00','OldBreakfast'),ent(2,'snacks','17:30','OldSnack'),ent(3,'other','22:00','OldOther'),ent(4,'dinner','20:00','OldDinner'),ent(5,'lunch','13:00','OldLunch')]
    oldprof={"id":"p_old","name":"Oldie","sex":"m","dob":"1990-01-01","heightCm":170,"startKg":70,"activity":1.55,"goal":"lose","rateKgWk":0.5,"proteinGPerKg":1.6,"fatPct":25,"override":{},"createdAt":1,"updatedAt":1}
    page.evaluate("""([ym,prof,ents])=>{localStorage.clear();localStorage.setItem('dt:v1:meta',JSON.stringify({schema:1,activeProfileId:'p_old',profileIds:['p_old'],lastExport:null}));
      localStorage.setItem('dt:v1:p:p_old:profile',JSON.stringify(prof));localStorage.setItem('dt:v1:p:p_old:entries:'+ym,JSON.stringify(ents))}""",[ym,oldprof,old_ents])
    page.reload()
    cs=cards(page); names=[c[0] for c in cs]
    check('migrated: old slots display under default names', names==['Breakfast','Lunch','Evening snack','Dinner','Other'], names)
    s=store(page); bk=[k for k in s if k.startswith('dt:v1:backup:slots:p:p_old:entries:')]
    check('old shard backed up before rewrite', len(bk)==1 and 'OldSnack' in s[bk[0]] and '"slot":"snacks"' in s[bk[0]].replace(' ',''), bk)
    sh=json.loads(s['dt:v1:p:p_old:entries:'+ym]); check('shard rewritten with slot ids', {e['slot'] for e in sh}=={'s_breakfast','s_lunch','s_evening','s_dinner','s_other'} and all(e['slotName'] for e in sh))
    pr=json.loads(s['dt:v1:p:p_old:profile']); check('profile got defaults + Other', [x['name'] for x in pr['slots']]==['Breakfast','Mid-morning snack','Lunch','Evening snack','Dinner','Late-night snack','Other'], pr.get('slots'))
    check('profile record backed up', any(k.startswith('dt:v1:backup:profile:p_old:') for k in s))
    # profile without slots and no 'other' entries -> no Other slot
    page.evaluate("""([ym,prof])=>{localStorage.clear();localStorage.setItem('dt:v1:meta',JSON.stringify({schema:1,activeProfileId:'p_old',profileIds:['p_old'],lastExport:null}));localStorage.setItem('dt:v1:p:p_old:profile',JSON.stringify(prof))}""",[ym,oldprof])
    page.reload(); pr=prof(page); check('profile without slots migrates to defaults only', [x['name'] for x in pr['slots']]==['Breakfast','Mid-morning snack','Lunch','Evening snack','Dinner','Late-night snack'])
    # preselect = slot after the last logged slot
    log(page,'roti','Lunch','13:00'); tab(page,'add'); page.fill('#q','dal'); page.locator('button.result').first.click()
    check('default = slot of last added entry (Lunch), not next slot', page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Lunch'); page.click('text=Cancel')
    quick_edit(page,'section.slot[aria-label="Lunch"] li.entry','07:07'); page.wait_for_timeout(100)
    check('quick edit shows toast and saved', '7:07 AM' in page.inner_text('#toasts') and '07:07' in [x.split('@')[1] for c in cards(page) for x in c[1]])
    # old-format export import via welcome restore
    old_export={"app":"diet-tracker","schema":1,"exportedAt":"2026-01-01T00:00:00Z","profiles":[{"profile":oldprof,"entries":{ym:old_ents},"weights":[],"foods":[]}]}
    json.dump(old_export,open('/tmp/old_export.json','w'))
    page.evaluate('localStorage.clear()'); page.reload()
    page.set_input_files('#restore #import-file','/tmp/old_export.json'); page.click('#import-apply'); page.wait_for_selector('#cal-card')
    cs=cards(page); names=[c[0] for c in cs]
    check('old export imports and migrates', names==['Breakfast','Lunch','Evening snack','Dinner','Other'], names)
    check('old export snacks -> Evening snack time kept', ('Evening snack',['OldSnack@17:30']) in [tuple(c) for c in cs])
    # new export carries slots
    tab(page,'backup')
    with page.expect_download() as dl: page.click('#export-one')
    dl.value.save_as('/tmp/new_export.json'); ex=json.load(open('/tmp/new_export.json'))
    check('new export carries slots', len(ex['profiles'][0]['profile']['slots'])==7 and all('slotName' in e for m in ex['profiles'][0]['entries'].values() for e in m))
    # round trip custom slots through merge
    page.evaluate('localStorage.clear()'); page.reload(); page.set_input_files('#restore #import-file','/tmp/new_export.json'); page.click('#import-apply'); page.wait_for_selector('section.slot')
    check('new export round-trips', [c[0] for c in cards(page)]==['Breakfast','Lunch','Evening snack','Dinner','Other'])
    # ---- review round 3 ----
    ctx.close(); ctx=b.new_context(viewport={'width':360,'height':740}); page=ctx.new_page()
    page.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); page.on('pageerror',lambda e: errs.append(str(e)))
    page.goto(URL); create(page,'Kb'); log(page,'idli','Breakfast','08:00')
    # (3) default slot = slot of most recently ADDED entry today
    tab(page,'add'); page.fill('#q','dal'); page.locator('button.result').first.click(); check('default after Breakfast only', pressed(page) if False else page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Breakfast'); page.click('text=Cancel')
    log(page,'roti','Dinner','20:00'); log(page,'banana','Breakfast','07:00')
    tab(page,'add'); page.fill('#q','dal'); page.locator('button.result').first.click()
    check('default = slot of last added entry (Breakfast, not next slot)', page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Breakfast'); page.click('text=Cancel')
    log(page,'apple','Dinner','21:00'); tab(page,'add'); page.fill('#q','dal'); page.locator('button.result').first.click()
    check('default follows most recent add (Dinner)', page.locator('#aslot .chip[aria-pressed=true]').inner_text()=='Dinner'); page.click('text=Cancel')
    # (5)(6) rename updates entry snapshot; re-adding a removed slot name reuses its id
    tab(page,'add'); page.fill('#q','tea'); page.locator('button.result').first.click(); page.click('#new-slot-chip'); page.fill('#new-slot-name','Gym'); page.click('#new-slot-add'); page.click('#save-entry')
    gid=[s['id'] for s in prof(page)['slots'] if s['name']=='Gym'][0]
    tab(page,'settings'); inp=page.locator('#slots .slotrow input').nth(6); inp.fill('Gym snack'); inp.press('Enter')
    check('rename shows Saved confirmation', 'Saved' in page.inner_text('#slot-status'), page.inner_text('#slot-status'))
    check('rename updates slotName on existing entries', [e['slotName'] for e in page.evaluate("Object.keys(localStorage).filter(k=>k.includes(':entries:')&&!k.includes('backup')).flatMap(k=>JSON.parse(localStorage.getItem(k)))") if e['slot']==gid]==['Gym snack'])
    wv=page.evaluate("(()=>{const i=document.querySelectorAll('#slots .slotrow input')[6];return [i.scrollWidth,i.clientWidth]})()")
    check('slot rename box not clipped at 360', wv[0]<=wv[1], wv)
    page.click('button[aria-label="Delete Gym snack"]'); page.click('#slots button:has-text("Delete Gym snack")')
    tab(page,'today'); check('removed slot group uses renamed snapshot', 'Gym snack' in [c[0] for c in cards(page)], [c[0] for c in cards(page)])
    tab(page,'settings'); page.fill('#slot-new-name','GYM SNACK'); page.click('#slot-add')
    check('re-adding removed slot name reuses id', [s['id'] for s in prof(page)['slots'] if s['name']=='GYM SNACK']==[gid], prof(page)['slots'][-1])
    tab(page,'today'); gc=[c for c in cards(page) if c[0]=='GYM SNACK']; check('no duplicate card: entry under reused slot', len(gc)==1 and len(gc[0][1])==1 and [c[0] for c in cards(page)].count('Gym snack')==0, cards(page))
    # (4) 30 slot cap in Profile and Add form
    tab(page,'settings')
    for i in range(len(prof(page)['slots']),30): page.fill('#slot-new-name','Slot %d'%i); page.click('#slot-add')
    check('30 slots reached', len(prof(page)['slots'])==30, len(prof(page)['slots']))
    page.fill('#slot-new-name','One too many'); page.click('#slot-add')
    check('31st blocked in Profile with message', len(prof(page)['slots'])==30 and 'up to 30' in page.inner_text('#slots'))
    tab(page,'add'); page.fill('#q','dal'); page.locator('button.result').first.click(); page.click('#new-slot-chip'); page.fill('#new-slot-name','One too many'); page.click('#new-slot-add')
    check('31st blocked in Add form with message', len(prof(page)['slots'])==30 and 'up to 30' in page.inner_text('#aslot'))
    page.click('text=Cancel')
    # load keeps >30 slots (merge can exceed 30): inject 45 slots, nothing dropped
    page.evaluate("""()=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));const k='dt:v1:p:'+m.activeProfileId+':profile';const p=JSON.parse(localStorage.getItem(k));p.slots=Array.from({length:45},(_,i)=>({id:'s_x'+i,name:'S'+i}));localStorage.setItem(k,JSON.stringify(p))}""")
    page.reload(); goto(page,'add'); check('load keeps 45 slots', len(prof(page)['slots'])==45 and page.locator('#add-meals .chip').count()==45, len(prof(page)['slots'])); goto(page,'today')
    # (7) edit screen: clearing time shows message
    page.evaluate("localStorage.clear()"); page.reload(); create(page,'T7'); log(page,'idli','Breakfast','08:00')
    edit_entry(page,'Idli'); page.fill('#atime-h',''); page.fill('#atime-m','')
    page.click('#save-entry'); check('edit: cleared time blocks save with message', page.locator('#save-entry').count()==1 and 'valid time' in page.inner_text('.sticky-actions') and 'Enter hour' in page.inner_text('#atime-err'))
    set_time(page,'09:05'); page.click('#save-entry'); check('edit: time saved after picking', cards(page)[0][1][0].endswith('@09:05'))
    # (8) merge does not resurrect deleted Other; case-insensitive slot mapping
    tab(page,'backup'); pr=prof(page)
    ent=lambda i,slot,name='': {"id":"m%d"%i,"date":td,"time":"10:00","slot":slot,"slotName":name,"foodId":"d_x","foodName":"Imp%d"%i,"qty":1,"unit":"g","unitLabel":"g","unitG":1,"grams":100,"per100":{"kcal":100,"p":1,"c":1,"f":1,"fib":0},"updatedAt":5}
    p2=dict(pr); p2['updatedAt']=1; p2['slots']=pr['slots']+[{"id":"s_other","name":"Other"}]
    json.dump({"app":"diet-tracker","schema":1,"profiles":[{"profile":p2,"entries":{td[:7]:[ent(1,'S_LUNCH','LUNCH'),ent(2,'zzz','breakfast')]},"weights":[],"foods":[]}]},open('/tmp/merge_case.json','w'))
    page.set_input_files('#backup #import-file','/tmp/merge_case.json'); page.click('#import-apply'); page.wait_for_selector('#import-summary')
    names=[s['name'] for s in prof(page)['slots']]
    check('merge does not resurrect unreferenced Other', 'Other' not in names, names)
    tab(page,'today'); cs={c[0]:c[1] for c in cards(page)}
    check('merge maps S_LUNCH/ "breakfast" case-insensitively onto existing slots', any(x.startswith('Imp1') for x in cs.get('Lunch',[])) and any(x.startswith('Imp2') for x in cs.get('Breakfast',[])), list(cs))
    check('no console errors (round 3)', not errs, errs[:3]); check('no network requests (round 3)', not reqs, reqs)
    check('no console errors', not errs, errs[:3]); check('no network requests', not reqs, reqs)
    b.close()
print('FAILED',[n for n,o in res if not o])
