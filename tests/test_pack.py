import json, os, re, sys, hashlib
from playwright.sync_api import sync_playwright
import sys; sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
res=[]; T='/tmp/packtest'; os.makedirs(T,exist_ok=True)
def check(n,ok,info=''): res.append((n,bool(ok))); print('PASS' if ok else 'FAIL',n,info)
def create(page,name='A'):
    page.fill('#f-name',name); page.fill('#f-dob','1990-01-01'); page.fill('#f-height','170'); page.fill('#f-weight','70'); page.click('#save-profile')
def tab(page,t): goto(page,t)
def myfoods(page): tab(page,'myfoods')
def newfood(page,name,kcal=400,p=10,c=60,f=12,katori=None):
    myfoods(page); page.click('#myfood-new'); page.fill('#c-name',name); page.fill('#c-kcal',str(kcal)); page.fill('#c-p',str(p)); page.fill('#c-c',str(c)); page.fill('#c-f',str(f))
    if katori: page.fill('#c-u-katori',str(katori))
    page.click('#c-save')
def export_pack(page,path,name=None):
    myfoods(page)
    if name is not None: page.fill('#pack-name',name)
    with page.expect_download() as dl: page.click('#export-pack')
    d=dl.value; d.save_as(path); return d.suggested_filename
def import_pack(page,path):
    page.set_input_files('#pack-file',path); page.wait_for_selector('#pack-summary,#pack-error'); 
    return page.inner_text('#pack-summary') if page.locator('#pack-summary').count() else page.inner_text('#pack-error')
def search(page,q):
    tab(page,'add'); page.fill('#q',q); return [x.split('\n')[0]+' | '+' '.join(x.split('\n')[1:]) for x in page.locator('button.result').all_inner_texts()]
def log(page,q,n=0):
    tab(page,'add'); page.fill('#q',q); page.locator('button.result').nth(n).click(); page.click('#save-entry')
def snap(page): return hashlib.md5(json.dumps(page.evaluate("Object.fromEntries(Object.keys(localStorage).filter(k=>k.includes(':p:')).sort().map(k=>[k,localStorage.getItem(k)]))"),sort_keys=True).encode()).hexdigest()
def sharedraw(page): return page.evaluate("localStorage.getItem('dt:v1:sharedfoods')||''")
def shared(page): return page.evaluate("JSON.parse(localStorage.getItem('dt:v1:sharedfoods')||'{}')")
def sf(i,name,kcal=100,upd=1000,**kw):
    d={'id':i,'name':name,'per100':{'kcal':kcal,'p':5,'c':10,'f':2,'fib':1},'units':{},'source':'custom','updatedAt':upd}; d.update(kw); return d
def pack(foods,name='Team Pack',rev=3,**kw):
    d={'type':'dt-foodpack','format':1,'packName':name,'revision':rev,'exportedAt':'2026-11-01T10:00:00Z','foods':foods,'credits':[]}; d.update(kw); return d
def wjson(name,obj): p=f'{T}/{name}'; open(p,'w').write(obj if isinstance(obj,str) else json.dumps(obj)); return p
with sync_playwright() as pw:
    b=pw.chromium.launch(); errs=[]; reqs=[]
    def dev(name='A'):
        c=b.new_context(viewport={'width':390,'height':844},accept_downloads=True); p=c.new_page()
        p.on('pageerror',lambda e: errs.append(str(e))); p.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        p.on('request',lambda r: reqs.append(r.url) if not r.url.startswith(('file:','data:','blob:')+LOCALP) else None)
        p.goto(URL); create(p,name); return c,p
    cA,A=dev('Alice'); cB,B=dev('Bob')
    # ---- create + export
    newfood(A,'Bhel Mix',400,10,60,12,katori=50); newfood(A,'Zed Chips',500,6,50,30)
    check('custom foods saved in shared store', {v['name'] for v in shared(A).values()}=={'Bhel Mix','Zed Chips'})
    check('My foods lists them', 'Bhel Mix' in A.inner_text('#myfoods-list') and 'Zed Chips' in A.inner_text('#myfoods-list'))
    check('plain update sentence shown', 'ask them to Export food pack and send you the file' in A.inner_text('#view'))
    fn=export_pack(A,f'{T}/v1.json','Alice Foods'); pk=json.load(open(f'{T}/v1.json'))
    check('pack format fields', pk['type']=='dt-foodpack' and pk['format']==1 and pk['packName']=='Alice Foods' and pk['revision']==1 and pk['exportedAt'] and len(pk['foods'])==2 and pk['credits']==[], {k:pk[k] for k in pk if k!='foods'})
    check('filename diet-foods-<name>-<date>.json', re.match(r'diet-foods-alice-foods-\d{4}-\d\d-\d\d\.json$',fn), fn)
    export_pack(A,f'{T}/v1b.json'); check('revision increments each export', json.load(open(f'{T}/v1b.json'))['revision']==2)
    # ---- Bob imports (two-device); profile/log untouched
    log(B,'idli'); before=snap(B)
    myfoods(B); sm=import_pack(B,f'{T}/v1.json')
    check('summary +2 new', sm.endswith('+2 new, 0 updated, 0 removed, 0 skipped (older)'), sm)
    check('import never touches profiles or log', snap(B)==before)
    r=search(B,'bhel'); check('imported food searchable offline, tagged Shared pack, ranked first', r and r[0].startswith('Bhel Mix') and 'Shared pack' in r[0], r)
    myfoods(B); check('last import line', 'Food list from Alice Foods v1' in B.inner_text('#last-pack'), B.inner_text('#last-pack'))
    goto(B,'add'); B.fill('#q','bhel'); B.locator('button.result').first.click()
    check('imported units become chips', any('katori (50 g)' in x for x in B.locator('[aria-label=Unit] .chip').all_inner_texts()))
    B.click('#save-entry'); bh_kcal=B.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes(':entries:')&&!k.includes('backup')))).find(e=>e.foodName==='Bhel Mix').per100.kcal")
    # ---- newer wins / older skipped
    myfoods(A); A.click('button[aria-label="Edit Bhel Mix"]'); A.fill('#c-kcal','450'); A.click('#c-save')
    export_pack(A,f'{T}/v3.json'); myfoods(B); sm=import_pack(B,f'{T}/v3.json')
    check('newer updatedAt wins (+0 new, 1 updated)', '+0 new, 1 updated, 0 removed, 1 skipped (older)' in sm, sm)
    check('Bob sees 450 kcal', any('450' in x for x in search(B,'bhel')))
    myfoods(B); sm=import_pack(B,f'{T}/v1.json'); check('older pack skipped, nothing downgraded', '+0 new, 0 updated, 0 removed, 2 skipped (older)' in sm and any('450' in x for x in search(B,'bhel')), sm)
    check('old log entry keeps its nutrition snapshot', B.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes(':entries:')&&!k.includes('backup')))).find(e=>e.foodName==='Bhel Mix').per100.kcal")==bh_kcal==400)
    # ---- tombstone delete
    myfoods(A); A.click('button[aria-label="Delete Zed Chips"]'); check('delete is a tombstone', shared(A)[[k for k,v in shared(A).items() if v['name']=='Zed Chips'][0]].get('deleted') is True)
    export_pack(A,f'{T}/v4.json'); check('pack carries tombstone', any(f.get('deleted') for f in json.load(open(f'{T}/v4.json'))['foods']))
    myfoods(B); sm=import_pack(B,f'{T}/v4.json'); check('tombstone removes food on other device', '1 removed' in sm and not any('Zed Chips' in x for x in search(B,'zed')), sm)
    # ---- override of a built-in
    log(A,'banana',0); goto(A,'today'); k0=int(A.inner_text('#t-kcal'))
    myfoods(A); A.fill('#mf-search','banana'); A.click('button[aria-label^="Edit this food: Banana, ripe"]'); A.fill('#c-kcal','200'); A.click('#c-save')
    r=search(A,'banana'); check('override wins and hides original', sum(bool(re.match(r'Banana, ripe (My food|Shared pack|IFCT) \|',x)) for x in r)==1 and '200 kcal' in [x for x in r if re.match(r'Banana, ripe (My food|Shared pack|IFCT) \|',x)][0] and 'My food' in [x for x in r if re.match(r'Banana, ripe (My food|Shared pack|IFCT) \|',x)][0], r[:4])
    tab(A,'today'); check('past entry unchanged by override', int(A.inner_text('#t-kcal'))==k0)
    export_pack(A,f'{T}/v5.json'); ov=[f for f in json.load(open(f'{T}/v5.json'))['foods'] if f.get('overrides')]
    check('override record fields', ov and ov[0]['id']==ov[0]['overrides'] and ov[0]['source']=='override', ov)
    myfoods(B); import_pack(B,f'{T}/v5.json'); r=search(B,'banana'); check('override travels to second device', any('200 kcal' in x and 'Shared pack' in x for x in r) and sum(bool(re.match(r'Banana, ripe (My food|Shared pack|IFCT) \|',x)) for x in r)==1, r[:3])
    myfoods(A); A.click('button[aria-label^="Restore original of Banana"]'); r=search(A,'banana'); check('restore original brings built-in back', any(re.match(r'Banana, ripe (My food|Shared pack|IFCT) \|',x) and '200 kcal' not in x for x in r), r[:3])
    export_pack(A,f'{T}/v6.json'); myfoods(B); sm=import_pack(B,f'{T}/v6.json'); check('restore tombstone propagates', not any('200 kcal' in x for x in search(B,'banana')), sm)
    # ---- edit this food from Add form (built-in)
    tab(B,'add'); B.fill('#q','apple'); B.locator('button.result').first.click(); B.click('#edit-food'); check('Edit this food opens form', B.locator('#c-name').input_value().startswith('Apple'))
    B.fill('#c-kcal','77'); B.click('#c-save'); check('returns to Add form with updated food', B.locator('#save-entry').count()==1 and '77 kcal' in B.inner_text('#view'), B.inner_text('#view')[:80])
    # ---- bad files
    myfoods(B)
    cases=[('notjson.json','{nope',"not a valid food pack"),('wrongtype.json',{'type':'x','foods':[]},'not a Diet Tracker food pack'),
           ('fmt2.json',pack([],format=2),'newer version'),('nofoods.json',pack([]) | {'foods':'x'},'no foods'),
           ('big5001.json',pack([sf('c_%d'%i,'F%d'%i) for i in range(5001)]),'too many foods'),
           ('profile.json',{'app':'diet-tracker','schema':1,'profiles':[]},'not a Diet Tracker food pack')]
    for fn_,obj,msg in cases:
        out=import_pack(B,wjson(fn_,obj)); check(f'bad file -> friendly error: {fn_}', msg in out, out)
    open(f'{T}/huge.json','w').write(json.dumps(pack([])|{'pad':'x'*(2*1024*1024+10)}))
    B.set_input_files('#pack-file',f'{T}/huge.json'); B.wait_for_selector('#pack-error'); check('oversize file (>2 MB) rejected', 'too big' in B.inner_text('#pack-error'))
    n5000=wjson('ok5000.json',pack([sf('c_k%d'%i,'K%d'%i) for i in range(5000)],name='Big',rev=9)); out=import_pack(B,n5000); check('exactly 5000 foods accepted', '+5000 new' in out, out)
    # ---- sanitising
    EV=[sf('c_x1','<img src=x onerror=window.__p=1>'),sf('c_long','L'*200),sf('c_bad1','Too many kcal',kcal=5000),sf('c_bad2','',kcal=10),
        sf('bad id!','Bad id'),sf('c_u','Odd units',units={'katori':99999,'ok':50,'Bad Key':3,'tsp':'x'}),sf('c_neg','Negative',per100={'kcal':5,'p':-1,'c':1,'f':1,'fib':0}),{'id':'c_nm','per100':{'kcal':1}},'str',None,
        sf('c_src','Weird source',source='hack'),sf('c_ov','Fake override',overrides='nonexistent_builtin',source='override')]
    out=import_pack(B,wjson('evil.json',pack(EV,name='Evil')))
    s=shared(B)
    check('invalid foods skipped and counted', 'invalid skipped' in out and not any(k in s for k in ('c_bad1','c_bad2','bad id!','c_neg','c_nm')), out)
    check('name trimmed to 80 chars', len(s['c_long']['name'])==80)
    check('unit weights sanitised', s['c_u']['units']=={'ok':50}, s['c_u']['units'])
    check('unknown source -> pack, fake override dropped', s['c_src']['source']=='pack' and s['c_ov']['source']=='pack' and 'overrides' not in s['c_ov'])
    myfoods(B); B.fill('#mf-search','zzz'); lst=B.inner_text('#myfoods-list')
    check('XSS pack name renders as text', B.locator('#myfoods-list img').count()==0 and B.evaluate('window.__p')==None and '<img src=x' in lst)
    check('last import shows Evil pack', 'Evil' in B.inner_text('#last-pack'))
    # ---- wipe + round trip on same device
    myfoods(A); export_pack(A,f'{T}/rt.json'); before_foods=sorted(v['name'] for v in shared(A).values() if not v.get('deleted'))
    A.evaluate('localStorage.clear()'); A.reload(); create(A,'Alice2'); myfoods(A); out=import_pack(A,f'{T}/rt.json')
    check('export -> wipe -> import round trip', sorted(v['name'] for v in shared(A).values() if not v.get('deleted'))==before_foods, out)
    r=search(A,'bhel'); check('round-tripped food searchable offline', r and r[0].startswith('Bhel Mix') and '450' in r[0], r)
    # ---- equal timestamp = skipped; legacy per-profile custom foods migrate; backup untouched
    myfoods(A); sm=import_pack(A,f'{T}/rt.json'); check('same pack twice: nothing new, all skipped', '+0 new, 0 updated, 0 removed' in sm and 'skipped (older)' in sm, sm)
    A.evaluate("""()=>{const m=JSON.parse(localStorage.getItem('dt:v1:meta'));const k='dt:v1:p:'+m.activeProfileId+':foods';localStorage.setItem(k,JSON.stringify([{id:'c_legacy1',name:'Legacy Laddoo',per100:{kcal:430,p:6,c:55,f:20,fib:2},units:[{label:'piece (30 g)',grams:30}],updatedAt:5}]))}""")
    A.reload(); r=search(A,'laddoo')
    check('legacy per-profile custom food appears in search as My food', r and 'My food' in r[0], r)
    check('legacy food copied to shared list, old key kept', 'c_legacy1' in shared(A) and A.evaluate("Object.keys(localStorage).some(k=>k.endsWith(':foods'))") and shared(A)['c_legacy1']['units'].get('piece')==30)
    # ---- profile export/import still works with custom foods and slots
    tab(A,'backup')
    with A.expect_download() as dl: A.click('#export-one')
    dl.value.save_as(f'{T}/prof.json'); pj=json.load(open(f'{T}/prof.json')); check('profile export unchanged format', pj['app']=='diet-tracker' and pj['profiles'][0]['profile']['slots'])
    A.evaluate('localStorage.clear()'); A.reload(); A.set_input_files('#restore #import-file',f'{T}/prof.json'); A.click('#import-apply'); A.wait_for_selector('h1')
    A.click('#menu-btn'); check('profile import still works (menu enabled)', A.locator('#drawer [data-view=today]').is_enabled()); A.keyboard.press('Escape')
    # ---- round 5: backups carry the shared food list; prototype-ish ids ----
    cC,C=dev('Cara')
    goto(C,'add'); C.click('#custom-food-btn'); C.fill('#c-name','Cara Cake'); C.fill('#c-kcal','350'); C.fill('#c-p','5'); C.fill('#c-c','50'); C.fill('#c-f','14'); C.fill('#c-u-piece','60'); C.click('#c-save'); C.click('#save-entry')
    newfood(C,'Unlogged Laddu',420,6,60,18)
    myfoods(C); C.click('button[aria-label="Delete Unlogged Laddu"]')
    goto(C,'backup')
    with C.expect_download() as dl: C.click('#export-all')
    dl.value.save_as(f'{T}/full.json'); fj=json.load(open(f'{T}/full.json'))
    check('full backup carries shared foods incl. tombstones', len(fj.get('sharedFoods',[]))==2 and any(f.get('deleted') for f in fj['sharedFoods']) and any(f['name']=='Cara Cake' for f in fj['sharedFoods']), fj.get('sharedFoods'))
    with C.expect_download() as dl2: C.click('#export-one')
    dl2.value.save_as(f'{T}/me.json'); check('Export only me also carries the food list', any(f['name']=='Cara Cake' for f in json.load(open(f'{T}/me.json')).get('sharedFoods',[])))
    C.evaluate('localStorage.clear()'); C.reload()
    C.set_input_files('#restore #import-file',f'{T}/full.json'); C.click('#import-apply'); C.wait_for_selector('#t-kcal',state='attached')
    r=search(C,'cara cake'); check('restore on Welcome screen brings the custom food back and search finds it', r and r[0].startswith('Cara Cake') and 'My food' in r[0], r)
    check('tombstone restored too (deleted food stays deleted)', not any('Laddu' in x for x in search(C,'laddu')))
    tab(C,'today'); check('restored entry shows on Today', 'Cara Cake' in C.inner_text('#view'))
    # same-device merge: newer wins / older skipped for backup shared foods
    goto(C,'backup'); C.set_input_files('#backup #import-file',f'{T}/full.json'); C.click('#import-apply'); C.wait_for_selector('#import-summary')
    check('re-importing the same backup: foods skipped as not newer', 'skipped (older)' in C.inner_text('#import-summary') and '+0 new' in C.inner_text('#import-summary'), C.inner_text('#import-summary'))
    fj2=json.load(open(f'{T}/full.json')); 
    for f in fj2['sharedFoods']:
        if f['name']=='Cara Cake': f['per100']['kcal']=999-500; f['updatedAt']+=5000
    json.dump(fj2,open(f'{T}/full_newer.json','w')); C.set_input_files('#backup #import-file',f'{T}/full_newer.json'); C.click('#import-apply'); C.wait_for_selector('#import-summary')
    check('newer food in backup wins on merge', any('499 kcal' in x for x in search(C,'cara cake')), search(C,'cara cake'))
    fj3=json.load(open(f'{T}/full.json'))
    for f in fj3['sharedFoods']:
        if f['name']=='Cara Cake': f['per100']['kcal']=100; f['updatedAt']=1
    json.dump(fj3,open(f'{T}/full_older.json','w')); goto(C,'backup'); C.set_input_files('#backup #import-file',f'{T}/full_older.json'); C.click('#import-apply'); C.wait_for_selector('#import-summary')
    check('older food in backup does not downgrade', any('499 kcal' in x for x in search(C,'cara cake')))
    # old backup without sharedFoods still restores
    old=json.load(open(f'{T}/full.json')); old.pop('sharedFoods'); old.pop('lastPackImport',None); json.dump(old,open(f'{T}/old_backup.json','w'))
    C.evaluate('localStorage.clear()'); C.reload(); C.set_input_files('#restore #import-file',f'{T}/old_backup.json'); C.click('#import-apply'); C.wait_for_selector('#t-kcal',state='attached')
    C.click('#menu-btn'); check('old backup without shared foods restores', C.locator('#drawer [data-view=today]').is_enabled() and 'Cara Cake' in C.inner_text('#view')); C.keyboard.press('Escape')
    # lastPackImport travels in backup
    cD,D=dev('Dan'); myfoods(D); import_pack(D,f'{T}/v1.json'); goto(D,'backup')
    with D.expect_download() as dl3: D.click('#export-all')
    dl3.value.save_as(f'{T}/dan.json'); D.evaluate('localStorage.clear()'); D.reload(); D.set_input_files('#restore #import-file',f'{T}/dan.json'); D.click('#import-apply'); D.wait_for_selector('#t-kcal',state='attached')
    myfoods(D); check('last pack import info restored from backup', 'Alice Foods' in D.inner_text('#last-pack'), D.inner_text('#last-pack'))
    # prototype-ish ids
    cE,E=dev('Eve'); NAMES=['constructor','hasOwnProperty','__proto__','toString','valueOf','__defineGetter__']
    pk2=pack([sf(n,'Proto '+n.strip('_'),kcal=111+i) for i,n in enumerate(NAMES)],name='Protos',rev=4); wjson('proto.json',pk2)
    myfoods(E); out=import_pack(E,f'{T}/proto.json')
    check('prototype-like ids import as new', '+6 new' in out and 'invalid' not in out, out)
    raw=sharedraw(E); check('all six stored as own keys (incl. __proto__)', all(('"%s":{'%n) in raw for n in NAMES), raw[:80])
    check('searchable', all(search(E,'proto '+n.strip('_'))[0].startswith('Proto '+n.strip('_')) for n in NAMES))
    myfoods(E); out2=import_pack(E,f'{T}/proto.json'); check('re-import: same ids treated as skipped-older, not corrupted', '+0 new' in out2 and '6 skipped (older)' in out2, out2)
    pk3=pack([sf(n,'Proto2 '+n.strip('_'),kcal=222,upd=2000) for n in NAMES],name='Protos',rev=5); wjson('proto2.json',pk3); myfoods(E); out3=import_pack(E,f'{T}/proto2.json')
    check('newer edits of prototype-like ids update normally', '6 updated' in out3 and '"name":"Proto2 proto"' in sharedraw(E), out3)
    export_pack(E,f'{T}/protoexp.json'); ex=json.load(open(f'{T}/protoexp.json')); check('export includes prototype-like ids', {f['id'] for f in ex['foods']}>=set(NAMES), [f['id'] for f in ex['foods']])
    E.evaluate('localStorage.clear()'); E.reload(); create(E,'Eve2'); myfoods(E); out4=import_pack(E,f'{T}/protoexp.json'); check('round trip of prototype-like ids', '+6 new' in out4, out4)
    # tombstone for prototype-like id
    pk4=pack([dict(sf('constructor','Proto constructor',upd=9000),deleted=True)],name='Protos',rev=6); wjson('proto3.json',pk4); myfoods(E); out5=import_pack(E,f'{T}/proto3.json')
    check('tombstone for id "constructor" removes it', '1 removed' in out5 and not any('Proto constructor' in x for x in search(E,'proto constructor')), out5)
    check('no console errors', not errs, errs[:3]); check('no network requests', not reqs, reqs)
    b.close()
print('FAILED',[n for n,o in res if not o])
