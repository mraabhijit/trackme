import json, datetime, sys
from playwright.sync_api import sync_playwright
import sys; sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
res=[]
def check(n,ok,info=''): res.append((n,bool(ok))); print('PASS' if ok else 'FAIL',n,info)
today=datetime.date.today()
def dob_for(age): return (today.replace(day=1,year=today.year-age)-datetime.timedelta(days=5)).isoformat()
def age_of(dob):
    y,m,d=map(int,dob.split('-')); return today.year-y-((today.month,today.day)<(m,d))
def bmr(sex,kg,cm,age): return 10*kg+6.25*cm-5*age+(5 if sex=='m' else -161)
def create(page,name,sex,kg,cm,act,dob,goal=None):
    page.fill('#f-name',name); page.select_option('#f-sex',sex); page.fill('#f-dob',dob); page.fill('#f-height',str(cm)); page.fill('#f-weight',str(kg)); page.select_option('#f-activity',str(act))
    if goal: page.select_option('#f-goal',goal)
def tab(page,t): goto(page,t)
def num(s): return float(s.split()[0].replace(',',''))
def inject(page,profiles,entries=None):
    page.evaluate("""([ps])=>{localStorage.clear();localStorage.setItem('dt:v1:meta',JSON.stringify({schema:1,activeProfileId:ps[0].id,profileIds:ps.map(p=>p.id),lastExport:null}));ps.forEach(p=>localStorage.setItem('dt:v1:p:'+p.id+':profile',JSON.stringify(p)))}""",[profiles])
def stored_prof(page,pid): return page.evaluate("id=>JSON.parse(localStorage.getItem('dt:v1:p:'+id+':profile'))",pid)
def backups(page,pid): return page.evaluate("id=>Object.keys(localStorage).filter(k=>k.startsWith('dt:v1:backup:profile:'+id+':'))",pid)
def oldp(i,act,**kw):
    d={"id":i,"name":"Old"+i,"sex":"m","dob":"1990-01-01","heightCm":170,"startKg":70,"activity":act,"goal":"lose","rateKgWk":0.5,"proteinGPerKg":1.6,"fatPct":25,"override":{},"createdAt":1,"updatedAt":10}; d.update(kw); return d
with sync_playwright() as pw:
    b=pw.chromium.launch(); errs=[]; reqs=[]
    def mk(w=390):
        c=b.new_context(viewport={'width':w,'height':844},accept_downloads=True); p=c.new_page()
        p.on('pageerror',lambda e: errs.append(str(e))); p.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
        p.on('request',lambda r: reqs.append(r.url) if not r.url.startswith(('file:','data:','blob:')+LOCALP) else None)
        return c,p
    # ---- 1 options, labels, helper note
    c,p=mk(); p.goto(URL)
    opts=p.evaluate("[...document.querySelectorAll('#f-activity option')].map(o=>[o.value,o.textContent])")
    check('four everyday options with model-3 multipliers', [o[0] for o in opts]==['1.2','1.3','1.45','1.6'], opts)
    check('labels: level name plus plain description (model 3)', opts[0][1]=='Mostly sitting (desk job, little walking)' and opts[1][1]=='Some moving (housework, errands, on your feet part of the day)' and opts[2][1]=='On your feet most of the day (shop, teaching, nursing)' and opts[3][1]=='Heavy physical work (construction, farm, loading)', opts)
    check("note: workouts are counted separately", "Do not count workouts here. Workouts you log are added to your day separately." in p.inner_text('#activity-note-help'))
    check('heavy-work hint under the select', 'Doing heavy physical work? If the number still looks low, set your own calories under Advanced.' in p.inner_text('#activity-heavy-help'))
    check('default selection is Some moving (1.3)', p.input_value('#f-activity')=='1.3')
    txt=p.inner_text('body'); check('no old labels/values anywhere on Welcome', all(x not in txt for x in ('Extra active','exercise 3-5','1.375','1.725','1.9 ')))
    # ---- 2 golden numbers for 3 (+ extremes) profiles
    cases=[('m',80,180,30,1.45),('f',60,165,25,1.3),('m',70,170,40,1.6),('f',55,160,35,1.2),('m',90,185,28,1.6)]
    for sex,kg,cm,age,act in cases:
        dob=dob_for(age); create(p,'G','%s'%sex,kg,cm,act,dob); B=bmr(sex,kg,cm,age); T=B*act
        check(f'golden {sex} {kg}kg {cm}cm {age}y x{act}: BMR {B:g}, TDEE {T:.1f}', abs(num(p.inner_text('#pv-bmr'))-B)<0.01 and abs(num(p.inner_text('#pv-tdee'))-T)<0.01, (p.inner_text('#pv-bmr'),p.inner_text('#pv-tdee')))
    # saved profile: Today shows rounded TDEE, deficit and target
    create(p,'Asha','m',80,180,1.45,dob_for(30)); p.click('#save-profile'); p.wait_for_selector('#qbar')
    check('Today: Calories you burn per day = 2581 for the golden profile (1780 x 1.45)', tn(p,'#t-tdee').strip()=='2581 kcal' and 'Calories you burn per day' in tn(p,'#totals'), tn(p,'#t-tdee'))
    check('Today: target 2031 and deficit 2581 with nothing eaten', tn(p,'#t-target').strip()=='2031 kcal' and tn(p,'#t-deficit').startswith('2581'), (tn(p,'#t-target'),tn(p,'#t-deficit')))
    check('new profile stored as activityModel 3 with workouts counted, no notice', stored_prof(p,p.evaluate("JSON.parse(localStorage.getItem('dt:v1:meta')).activeProfileId"))['activityModel']==3 and stored_prof(p,p.evaluate("JSON.parse(localStorage.getItem('dt:v1:meta')).activeProfileId"))['exerciseAdds']==True and p.locator('#activity-notice').count()==0)
    # 7-day view uses the same figure
    goto(p,'weekly'); check('weekly summary goal note uses the new TDEE-based target (2031)', 'daily goal of 2031 calories' in p.inner_text('#wk-goal-note'), p.inner_text('#wk-goal-note')); goto(p,'today')
    # clamp unchanged
    add_person(p); create(p,'Low','f',50,150,1.2,dob_for(60),'lose'); check('clamp: target held at floor 1200 and explained', p.inner_text('#pv-target').startswith('1200') and 'safe minimum' in p.inner_text('#pv'), p.inner_text('#pv-target'))
    c.close()
    # ---- 3 old localStorage profile migrates once
    c,p=mk(); p.goto(URL); op=oldp('p_old1',1.55); inject(p,[op]); p.reload()
    pr=stored_prof(p,'p_old1'); age=age_of('1990-01-01'); B=bmr('m',70,170,age)
    check('old 1.55 profile migrated to 1.4 and stamped', pr['activity']==1.4 and pr['activityModel']==2, pr)
    check('Today uses 1.4 (TDEE = BMR x 1.4)', abs(num(tn(p,'#t-tdee'))-round(B*1.4))<=1, tn(p,'#t-tdee'))
    bk=backups(p,'p_old1'); check('old record backed up before rewrite', len(bk)==1 and json.loads(p.evaluate("k=>localStorage.getItem(k)",bk[0]))['activity']==1.55, bk)
    p.reload(); p.reload(); pr2=stored_prof(p,'p_old1'); check('not mapped again on reload (still 1.4, no new backup)', pr2['activity']==1.4 and len(backups(p,'p_old1'))==1, (pr2['activity'],backups(p,'p_old1')))
    # ---- 6 notice: once, plain language, numbers, dismiss
    rnd=lambda x:int(x+0.5)
    X=B*1.55; Y=B*1.4; A=X-550; Bt=Y-550
    nt=p.inner_text('#activity-notice')
    check('notice text and numbers (no raw multipliers)', 'We made the daily burn estimate more realistic.' in nt and f'Your daily burn changed from {rnd(X)} to {rnd(Y)} kcal and your target from {rnd(A)} to {rnd(Bt)} kcal.' in nt and 'If you work out 5+ times a week, choose Very active in Daily goals.' in nt and 'now uses' not in nt and 'was 1.55' not in nt and '1.4' not in nt, nt)
    p.click('#activity-notice-ok'); check('notice dismissed', p.locator('#activity-notice').count()==0)
    check('dismissed flag stored on the profile', stored_prof(p,'p_old1')['activityNote']['dismissed'] is True)
    p.reload(); check('notice does not come back after reload', p.locator('#activity-notice').count()==0)
    tab(p,'history'); tab(p,'today'); check('...nor when switching tabs', p.locator('#activity-notice').count()==0)
    c.close()
    # profile whose level does not change: no notice
    c,p=mk(); p.goto(URL); inject(p,[oldp('p_s',1.2)]); p.reload(); check('1.2 -> 1.2: migrated silently, no notice', stored_prof(p,'p_s')['activity']==1.2 and stored_prof(p,'p_s')['activityModel']==2 and p.locator('#activity-notice').count()==0); c.close()
    # ---- 5 overrides untouched
    c,p=mk(); p.goto(URL); ov={"kcal":1800,"p":100,"c":200,"f":60}; inject(p,[oldp('p_ov',1.725,override=ov)]); p.reload()
    pr=stored_prof(p,'p_ov'); check('overrides untouched by migration (1.725 -> 1.55)', pr['override']==ov and pr['activity']==1.55, pr)
    check('override target still used on Today', tn(p,'#t-target').strip()=='1800 kcal')
    nt=p.inner_text('#activity-notice'); check('notice says target stays when you set your own', 'and your target stays at 1800 kcal' in nt and 'now uses' not in nt, nt); c.close()
    # ---- 4 old export import, all five old values + odd value
    vals=[1.2,1.375,1.55,1.725,1.9]; exp={1.2:1.2,1.375:1.3,1.55:1.4,1.725:1.55,1.9:1.7}
    profs=[oldp('p_v%d'%i,v,name='V%s'%v) if False else dict(oldp('p_v%d'%i,v),name='V%s'%v) for i,v in enumerate(vals)]+[dict(oldp('p_odd',1.4),name='Odd')]
    ex={"app":"diet-tracker","schema":1,"exportedAt":"2026-01-01T00:00:00Z","profiles":[{"profile":q,"entries":{},"weights":[],"foods":[]} for q in profs]}
    json.dump(ex,open('/tmp/old_act.json','w'))
    c,p=mk(); p.goto(URL); p.set_input_files('#restore #import-file','/tmp/old_act.json'); p.click('#import-apply'); p.wait_for_selector('#qbar')
    got={i:stored_prof(p,'p_v%d'%i) for i in range(5)}
    check('old export: every old value mapped (1.2,1.375,1.55,1.725,1.9 -> 1.2,1.3,1.4,1.55,1.7)', all(got[i]['activity']==exp[v] and got[i]['activityModel']==2 for i,v in enumerate(vals)), {v:got[i]['activity'] for i,v in enumerate(vals)})
    check('odd old value 1.4 maps via nearest old (1.375 -> 1.3)', stored_prof(p,'p_odd')['activity']==1.3)
    tab(p,'backup')
    with p.expect_download() as dl: p.click('#export-all')
    dl.value.save_as('/tmp/new_act.json'); ne=json.load(open('/tmp/new_act.json'))
    check('new exports carry activityModel 2', all(x['profile']['activityModel']==2 for x in ne['profiles']) and len(ne['profiles'])==6)
    # re-import the NEW export into a fresh device: values are trusted, not mapped again
    c2,p2=mk(); p2.goto(URL); p2.set_input_files('#restore #import-file','/tmp/new_act.json'); p2.click('#import-apply'); p2.wait_for_selector('#qbar')
    check('stamped export re-imported: no double mapping', all(stored_prof(p2,'p_v%d'%i)['activity']==exp[v] for i,v in enumerate(vals)))
    c2.close()
    # ---- merge: old backup over a stamped profile never flips its factor
    c3,p3=mk(); p3.goto(URL); inject(p3,[dict(oldp('p_m',1.55,activityModel=2,updatedAt=5,slots=[{'id':'s_breakfast','name':'Breakfast'},{'id':'s_lunch','name':'Lunch'}]),name='Local')]); p3.reload()
    check('setup: stamped local profile at 1.55 (Very active) is trusted as is', stored_prof(p3,'p_m')['activity']==1.55 and not backups(p3,'p_m') and p3.locator('#activity-notice').count()==0)
    old_newer=dict(oldp('p_m',1.55),name='FromOldBackup',updatedAt=10000000000000)
    json.dump({"app":"diet-tracker","schema":1,"profiles":[{"profile":old_newer,"entries":{},"weights":[],"foods":[]}]},open('/tmp/old_merge.json','w'))
    tab(p3,'backup'); p3.set_input_files('#backup #import-file','/tmp/old_merge.json'); p3.click('#import-apply'); p3.wait_for_selector('#import-summary')
    pm=stored_prof(p3,'p_m'); check('merge: old (unstamped) newer backup does not change stamped factor', pm['activity']==1.55 and pm['activityModel']==2, pm)
    check('merge: other newer fields from the backup still apply', pm['name']=='FromOldBackup')
    new_newer=dict(oldp('p_m',1.7,activityModel=2),name='FromNew',updatedAt=20000000000000)
    json.dump({"app":"diet-tracker","schema":1,"profiles":[{"profile":new_newer,"entries":{},"weights":[],"foods":[]}]},open('/tmp/new_merge.json','w'))
    tab(p3,'backup'); p3.set_input_files('#backup #import-file','/tmp/new_merge.json'); p3.click('#import-apply'); p3.wait_for_selector('#import-summary')
    check('merge: a newer STAMPED file does change the factor (1.7)', stored_prof(p3,'p_m')['activity']==1.7)
    # replace with old file maps it (fresh meaning)
    tab(p3,'backup'); p3.set_input_files('#backup #import-file','/tmp/old_merge.json'); p3.check('input[value=replace]'); p3.click('#import-apply'); p3.wait_for_selector('#import-summary')
    check('replace with old file maps once (1.55 -> 1.4)', stored_prof(p3,'p_m')['activity']==1.4)
    c3.close()
    # profile edit: changing level clears the notice; save keeps stamp
    c,p=mk(); p.goto(URL); inject(p,[oldp('p_e',1.55)]); p.reload(); tab(p,'goals'); p.select_option('#f-activity','1.55'); p.click('#save-profile'); tab(p,'today')
    check('changing the level clears the old notice', p.locator('#activity-notice').count()==0 and stored_prof(p,'p_e')['activity']==1.55 and stored_prof(p,'p_e')['activityModel']==2); c.close()
    # ---- round 5 additions ----
    # (1) pace shown when the target is held at the safe floor
    c,p=mk(); p.goto(URL)
    age=50; B=bmr('m',60,160,age); T=B*1.2; pace=(T-1500)*7/7700; want="At this target you'd lose about %s kg a week."%(round(pace*100)/100)
    create(p,'Floor','m',60,160,1.2,dob_for(age),'lose'); pv=p.inner_text('#pv')
    check('floor: preview keeps "raised to a safe minimum" and adds the pace', 'raised to a safe minimum of 1500 kcal' in pv and want in pv, pv[-260:])
    p.click('#save-profile'); p.wait_for_selector('#qbar'); nt=tn(p,'#target-note')
    check('floor: same note on Today', 'raised to a safe minimum' in nt and want in nt, nt)
    tab(p,'goals'); p.select_option('#f-goal','maintain'); check('maintain: no floor note and no pace', 'At this target' not in p.inner_text('#pv') and p.locator('#pv #target-note').count()==0)
    p.select_option('#f-goal','gain'); check('gain: no pace', 'At this target' not in p.inner_text('#pv'))
    p.select_option('#f-goal','lose'); check('lose again: pace back', want in p.inner_text('#pv'))
    p.evaluate("document.querySelector('#advanced').open=true"); p.fill('#f-ovkcal','1800'); check('own kcal override: pace hidden', 'At this target' not in p.inner_text('#pv') and 'raised to a safe minimum' not in p.inner_text('#pv'))
    p.fill('#f-ovkcal','')
    # target held at floor but above TDEE (cannot lose)
    p.fill('#f-height','150'); p.fill('#f-weight','55'); p.fill('#f-dob',dob_for(70)); p.select_option('#f-sex','m'); check('floor above burn: plain "would not lose weight" wording', 'At this target you would not lose weight.' in p.inner_text('#pv'), p.inner_text('#pv')[-200:])
    c.close()
    # (3) dismissal propagates on merge (either side dismissed -> stays dismissed) and bumps updatedAt
    c,p=mk(); p.goto(URL); inject(p,[oldp('p_d',1.55)]); p.reload(); u0=stored_prof(p,'p_d')['updatedAt']; p.click('#activity-notice-ok'); u1=stored_prof(p,'p_d')['updatedAt']
    check('dismiss bumps updatedAt', u1>u0 and stored_prof(p,'p_d')['activityNote']['dismissed'] is True, (u0,u1))
    fresh=dict(oldp('p_d',1.4,activityModel=2,updatedAt=u1+10**9),activityNote={'from':1.55,'to':1.4,'dismissed':False})
    json.dump({"app":"diet-tracker","schema":1,"profiles":[{"profile":fresh,"entries":{},"weights":[],"foods":[]}]},open('/tmp/n_undismissed.json','w'))
    tab(p,'backup'); p.set_input_files('#backup #import-file','/tmp/n_undismissed.json'); p.click('#import-apply'); p.wait_for_selector('#import-summary'); tab(p,'today')
    check('local dismissed + newer undismissed backup: stays dismissed', stored_prof(p,'p_d')['activityNote']['dismissed'] is True and p.locator('#activity-notice').count()==0, stored_prof(p,'p_d')['activityNote'])
    c.close()
    c,p=mk(); p.goto(URL); inject(p,[oldp('p_d',1.55)]); p.reload(); check('setup: local notice not dismissed', p.locator('#activity-notice').count()==1)
    dism=dict(oldp('p_d',1.4,activityModel=2,updatedAt=1,slots=[{'id':'s_breakfast','name':'Breakfast'}]),activityNote={'from':1.55,'to':1.4,'dismissed':True})
    json.dump({"app":"diet-tracker","schema":1,"profiles":[{"profile":dism,"entries":{},"weights":[],"foods":[]}]},open('/tmp/n_dismissed.json','w'))
    tab(p,'backup'); p.set_input_files('#backup #import-file','/tmp/n_dismissed.json'); p.click('#import-apply'); p.wait_for_selector('#import-summary'); tab(p,'today')
    check('local not dismissed + older dismissed backup: becomes dismissed', stored_prof(p,'p_d')['activityNote']['dismissed'] is True and p.locator('#activity-notice').count()==0, stored_prof(p,'p_d')['activityNote'])
    c.close()
    # (4) activityModel handling
    c,p=mk(); p.goto(URL)
    def load(pid,act,model,**kw):
        d=oldp(pid,act,**kw)
        if model is not None: d['activityModel']=model
        d['slots']=[{'id':'s_breakfast','name':'Breakfast'}]; inject(p,[d]); p.reload(); return stored_prof(p,pid) if p.evaluate("!!localStorage.getItem('dt:v1:p:%s:profile')"%pid) else None
    B70=bmr('m',70,170,age_of('1990-01-01'))
    def fac(): return num(tn(p,'#t-tdee'))/B70
    r=load('p_m3',1.45,4); check('model 4 (newer than this app): factor kept, not remapped, no rewrite', r['activity']==1.45 and r['activityModel']==4 and not backups(p,'p_m3') and abs(fac()-1.45)<0.002, r)
    check('model 4: Today uses 1.45', abs(num(tn(p,'#t-tdee'))-round(bmr('m',70,170,age_of('1990-01-01'))*1.45))<=1)
    r=load('p_m3b',2.5,4); check('model 4 factor above range clamped to 1.7 (as used)', abs(fac()-1.7)<0.002, fac())
    r=load('p_m3c',1.9,3); check('model 3: factor snapped to the nearest everyday level (1.9 -> 1.6)', abs(fac()-1.6)<0.002, fac())
    r=load('p_m3d',1.45,3); check('model 3: valid everyday level kept (1.45)', abs(fac()-1.45)<0.002, fac())
    r=load('p_m3c',1.0,4); check('model 4 factor below range clamped to 1.2 (as used)', abs(fac()-1.2)<0.002, fac())
    r=load('p_garb',1.55,'abc'); check('garbage activityModel treated as old (1.55 -> 1.4)', r['activity']==1.4 and r['activityModel']==2, r)
    r=load('p_null',1.55,None); check('missing activityModel treated as old', r['activity']==1.4)
    r=load('p_str',1.55,'2'); check('activityModel "2" (string) counts as new scale (1.55 kept, not remapped)', abs(fac()-1.55)<0.002 and not backups(p,'p_str'), fac())
    r=load('p_obj',1.55,{'x':1}); check('object activityModel treated as old', r['activity']==1.4)
    r=load('p_odd2',1.375,2); check('model 2 with off-scale factor snaps to nearest new level (1.375 -> 1.4)', abs(fac()-1.4)<0.002, fac())
    # import of model > 2: not remapped
    ex={"app":"diet-tracker","schema":1,"profiles":[{"profile":dict(oldp('p_im3',1.45,activityModel=3),name='M3'),"entries":{},"weights":[],"foods":[]}]}; json.dump(ex,open('/tmp/m3.json','w'))
    c.close(); c,p=mk(); p.goto(URL); p.set_input_files('#restore #import-file','/tmp/m3.json'); p.click('#import-apply'); p.wait_for_selector('#qbar')
    check('import: model 3 profile keeps factor 1.45', stored_prof(p,'p_im3')['activity']==1.45 and stored_prof(p,'p_im3')['activityModel']==3)
    c.close()
    # (5) numeric text activity values are parsed
    c,p=mk(); p.goto(URL)
    def load2(pid,act,model):
        d=oldp(pid,act); d['slots']=[{'id':'s_breakfast','name':'Breakfast'}]
        if model is not None: d['activityModel']=model
        inject(p,[d]); p.reload(); return stored_prof(p,pid) if p.evaluate("!!localStorage.getItem('dt:v1:p:%s:profile')"%pid) else None
    r=load2('p_t1','1.55',None); check('load: text "1.55" without model parsed as old and mapped (-> 1.4)', r and r['activity']==1.4 and isinstance(r['activity'],float) or (r and r['activity']==1.4), r)
    check('profile with text activity is visible (not dropped)', bool(tn(p,'#t-tdee')) and abs(num(tn(p,'#t-tdee'))-round(bmr('m',70,170,age_of('1990-01-01'))*1.4))<=1)
    r=load2('p_t2','1.55',2); check('load: text "1.55" with model 2 parsed (stays 1.55)', bool(tn(p,'#t-tdee')) and abs(num(tn(p,'#t-tdee'))/B70-1.55)<0.002, tn(p,'#t-tdee'))
    r=load2('p_t3','1,4',2); check('text with comma decimal parsed', bool(tn(p,'#t-tdee')) and abs(num(tn(p,'#t-tdee'))/B70-1.4)<0.002, tn(p,'#t-tdee'))
    load2('p_bad','banana',2); check('garbage text activity: profile not loaded, Welcome shown', p.locator('#f-name').count()==1)
    ex={"app":"diet-tracker","schema":1,"profiles":[{"profile":dict(oldp('p_it','1.725'),name='TextOld'),"entries":{},"weights":[],"foods":[]},{"profile":dict(oldp('p_it2','1.7',activityModel=2),name='TextNew'),"entries":{},"weights":[],"foods":[]}]}; json.dump(ex,open('/tmp/txt.json','w'))
    c.close(); c,p=mk(); p.goto(URL); p.set_input_files('#restore #import-file','/tmp/txt.json'); p.click('#import-apply'); p.wait_for_selector('#qbar')
    check('import: text "1.725" (old) -> 1.55, text "1.7" (model 2) -> 1.7', stored_prof(p,'p_it')['activity']==1.55 and stored_prof(p,'p_it2')['activity']==1.7, (stored_prof(p,'p_it')['activity'],stored_prof(p,'p_it2')['activity']))
    c.close()
    check('no console errors', not errs, errs[:3]); check('no network requests', not reqs, reqs)
    b.close()
print('FAILED',[n for n,o in res if not o])
