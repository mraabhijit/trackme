import sys, datetime, json
sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
from playwright.sync_api import sync_playwright
import sys; sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
res=[]
def check(n,ok,info=''): res.append((n,bool(ok))); print('PASS' if ok else 'FAIL',n,info)
def create(page,name='A'):
    page.fill('#f-name',name); page.fill('#f-dob','1990-01-01'); page.fill('#f-height','170'); page.fill('#f-weight','70'); page.click('#save-profile')
def tab(page,t): goto(page,t)
def open_dt(page,n=0):
    page.locator('li.entry .menu-btn').nth(n).click(); page.click('#em-datetime')
def start_add(page,q='idli'):
    tab(page,'add'); page.fill('#q',q); page.locator('button.result').first.click()
def stored(page): return sorted(e['time'] for e in page.evaluate("Object.keys(localStorage).filter(k=>k.includes(':entries:')&&!k.includes('backup')).flatMap(k=>JSON.parse(localStorage.getItem(k)))"))
def vals(page,pre='atime'): return (page.input_value(f'#{pre}-h'),page.input_value(f'#{pre}-m'),page.get_attribute(f'#{pre}-am','aria-pressed'),page.get_attribute(f'#{pre}-pm','aria-pressed'))
with sync_playwright() as pw:
    b=pw.chromium.launch(); errs=[]; reqs=[]
    def mk(loc='en-US',w=360,h=740):
        c=b.new_context(viewport={'width':w,'height':h},locale=loc); p=c.new_page()
        p.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); p.on('pageerror',lambda e: errs.append(str(e)))
        p.on('request',lambda r: reqs.append(r.url) if not r.url.startswith(('file:','data:','blob:')+LOCALP) else None)
        p.goto(URL); create(p); return c,p
    c,page=mk()
    # 12 AM / 12 PM mapping and 24h conversion
    for hhmm,h12,mm,ap in (('00:15','12','15','am'),('12:15','12','15','pm'),('13:05','1','05','pm'),('23:59','11','59','pm'),('01:00','1','00','am')):
        start_add(page); set_time(page,hhmm); page.click('#save-entry')
    check('12 AM=00:xx, 12 PM=12:xx, 1 PM=13:xx, 11:59 PM=23:59', stored(page)==['00:15','01:00','12:15','13:05','23:59'], stored(page))
    # typing 0945 style (keyboard) then PM
    start_add(page); page.click('#atime-h'); page.keyboard.type('0945')
    check('typing 0945 fills hour 09 and minute 45 (auto-advance)', vals(page)[:2]==('09','45'), vals(page))
    page.click('#atime-pm'); page.click('#save-entry'); check('0945 + PM saved as 21:45', '21:45' in stored(page), stored(page))
    # single digit >=2 auto-advances
    start_add(page); page.click('#atime-h'); page.keyboard.type('730'); check('single digit hour 7 auto-advances to minutes', vals(page)[:2]==('7','30'), vals(page))
    # minute zero-pad on blur
    page.fill('#atime-m','5'); page.press('#atime-m','Tab'); check('minute 5 padded to 05 on blur', page.input_value('#atime-m')=='05')
    # clamping / invalid never saves
    n0=len(stored(page))
    page.fill('#atime-h','13'); check('hour 13 shows message', 'hour 1-12' in page.inner_text('#atime-err').lower(), page.inner_text('#atime-err'))
    page.click('#save-entry'); check('invalid hour: nothing saved, message shown', len(stored(page))==n0 and 'valid time' in page.inner_text('.sticky-actions'))
    page.fill('#atime-h','7'); page.fill('#atime-m','75'); check('minute 75 shows message', 'minute 0-59' in page.inner_text('#atime-err').lower())
    page.click('#save-entry'); check('invalid minute: nothing saved', len(stored(page))==n0)
    page.fill('#atime-h','0'); page.press('#atime-h','Tab'); check('hour 0 shows message', 'hour 1-12' in page.inner_text('#atime-err').lower(), page.inner_text('#atime-err'))
    page.fill('#atime-h','abc'); check('non-digits stripped', page.input_value('#atime-h')=='')
    page.fill('#atime-h',''); page.fill('#atime-m',''); page.click('#save-entry'); check('empty time not saved', len(stored(page))==n0)
    # Now
    page.click('#atime-now'); now=datetime.datetime.now(); h24=int(page.input_value('#atime-h'))%12+(12 if page.get_attribute('#atime-pm','aria-pressed')=='true' else 0); mm=int(page.input_value('#atime-m'))
    check('Now sets current time', abs((h24*60+mm)-(now.hour*60+now.minute))<=2 or abs((h24*60+mm)-(now.hour*60+now.minute))>=1438, (h24,mm,now))
    # steppers
    set_time(page,'08:58'); page.click('#atime-mup'); check('minute + from 8:58 AM -> 9:00 AM', vals(page)==('9','00','true','false'), vals(page))
    set_time(page,'11:58'); page.click('#atime-mup'); check('minute + 11:58 AM -> 12:00 PM', vals(page)==('12','00','false','true'), vals(page))
    set_time(page,'00:00'); page.click('#atime-mdown'); check('minute - at 12:00 AM stops (no wrap to 11:55 PM)', vals(page)==('12','00','true','false'), vals(page))
    set_time(page,'23:55'); page.click('#atime-mup'); check('minute + at 11:55 PM stops at 11:59 PM', vals(page)==('11','59','false','true'), vals(page))
    page.click('#atime-mup'); check('minute + at 11:59 PM stays', vals(page)==('11','59','false','true'), vals(page))
    set_time(page,'00:03'); page.click('#atime-mdown'); check('minute - from 12:03 AM -> 12:00 AM', vals(page)==('12','00','true','false'), vals(page))
    # paste handling (synthetic paste events carrying clipboard text)
    def paste(sel,txt): page.evaluate("([s,t])=>{const dt=new DataTransfer();dt.setData('text',t);const e=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});document.querySelector(s).dispatchEvent(e);return e.defaultPrevented}",[sel,txt])
    for txt,exp in (('9:45 pm',('9','45','false','true')),('09:45PM',('9','45','false','true')),('21:45',('9','45','false','true')),('945pm',('9','45','false','true')),
                    ('12:05 am',('12','05','true','false')),('0:30',('12','30','true','false')),('12:30',('12','30','false','true')),('7.15 a.m.',('7','15','true','false'))):
        set_time(page,'03:03'); paste('#atime-h',txt); check(f'paste into hour box: {txt!r}', vals(page)==exp, vals(page))
    set_time(page,'03:03'); paste('#atime-m','10:20 pm'); check('paste into minute box works too', vals(page)==('10','20','false','true'), vals(page))
    set_time(page,'03:03'); paste('#atime-h','25:99'); check('invalid paste ignored (time unchanged)', vals(page)==('3','03','true','false'), vals(page))
    set_time(page,'03:03'); paste('#atime-h','13:00 pm'); check('13 with pm ignored', vals(page)==('3','03','true','false'), vals(page))
    set_time(page,'08:03'); page.click('#atime-mup'); check('minute + rounds to next 5', page.input_value('#atime-m')=='05')
    # layout / tap targets at 360
    small=page.evaluate("""()=>[...document.querySelectorAll('.tp button,.tp input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<43.5||r.width<43.5)}).map(e=>(e.id||e.className)+' '+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height))""")
    check('time control tap targets >=44px at 360', not small, small)
    check('no horizontal scroll (add form, 360)', page.evaluate('document.documentElement.scrollWidth')<=360)
    bb=page.locator('#atime-pm').bounding_box(); check('AM/PM buttons >=44 tall', bb['height']>=44, bb)
    page.click('text=Cancel')
    # Today row display + quick edit
    tab(page,'today'); texts=page.locator('.time-text').all_inner_texts()
    check('rows show 12-hour text', '12:15 AM' in texts and '12:15 PM' in texts and '1:05 PM' in texts and '9:45 PM' in texts, texts)
    check('no native time inputs anywhere', page.evaluate("document.querySelectorAll('input[type=time]').length")==0)
    open_dt(page,0)
    check('time sheet opens with Save/Cancel', page.locator('#q-done').is_visible() and page.locator('#q-cancel').is_visible())
    page.fill('#q-h','8'); page.fill('#q-m','15'); page.click('#q-pm'); page.click('#q-am')
    page.click('#q-cancel'); check('Cancel keeps old time', '8:15 AM' not in page.locator('.time-text').all_inner_texts())
    open_dt(page,0); page.fill('#q-h','8'); page.fill('#q-m','15'); page.click('#q-am'); page.press('#q-m','Enter')
    check('Enter saves and shows 8:15 AM', '8:15 AM' in page.locator('.time-text').all_inner_texts() and '08:15' in stored(page), stored(page))
    check('focus returns to the row options button after save', 'menu-btn' in page.evaluate("document.activeElement.className"))
    check('rows re-sorted in place after time change', [x.get_attribute('data-time') for x in page.locator('li.entry').all()]==['01:00','08:15','12:15','13:05','21:45'] or [x.get_attribute('data-time') for x in page.locator('li.entry').all()]==sorted(stored(page)), [x.get_attribute('data-time') for x in page.locator('li.entry').all()])
    page.reload(); check('quick edit persists after reload', '8:15 AM' in page.locator('.time-text').all_inner_texts() and '08:15' in stored(page))
    # invalid in quick edit never saves; editor stays open
    open_dt(page,0); page.fill('#q-h','14'); page.click('#q-done')
    check('quick edit invalid: stays open with message, nothing saved', page.locator('#q-done').is_visible() and 'hour 1-12' in page.inner_text('#q-err').lower() and stored(page).count('08:15')==1)
    page.keyboard.press('Escape') if False else page.click('#q-cancel')
    # no re-render while focused: type into minute and check focus persists, no toast steals
    open_dt(page,0); page.click('#q-m'); page.keyboard.type('45')
    check('typing in quick editor keeps focus (no re-render)', page.evaluate("document.activeElement.id")=='q-m', page.evaluate("document.activeElement.id"))
    page.click('#q-cancel')
    check('quick editor 360: no horizontal scroll and targets >=44', page.evaluate('document.documentElement.scrollWidth')<=360)
    open_dt(page,0)
    small=page.evaluate("""()=>[...document.querySelectorAll('#datetime-sheet button,#datetime-sheet input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<43.5||r.width<43.5)}).map(e=>(e.id||e.className))""")
    check('quick editor tap targets >=44', not small, small); check('quick editor fits 360', page.evaluate('document.documentElement.scrollWidth')<=360)
    # typing replaces the prefilled value (tap then type 0730 -> 07:30, not '80'/'73')
    page.click('#q-cancel'); open_dt(page,0); page.click('#q-h'); page.keyboard.type('0730')
    check('typing into a prefilled quick editor replaces the old digits', (page.input_value('#q-h'),page.input_value('#q-m'))==('07','30'), (page.input_value('#q-h'),page.input_value('#q-m')))
    page.click('#q-h'); page.keyboard.type('11'); page.keyboard.type('05'); check('typing again after a full time starts afresh', (page.input_value('#q-h'),page.input_value('#q-m'))==('11','05'), (page.input_value('#q-h'),page.input_value('#q-m')))
    # only one quick editor at a time, no duplicate ids
    page.click('#q-cancel')
    open_dt(page,0); page.keyboard.press('Escape'); open_dt(page,1)
    check('only one time sheet open at a time (the sheet is modal)', page.locator('#datetime-sheet').count()==1 and page.locator('#q-h').count()==1, page.locator('#datetime-sheet').count())
    dup=page.evaluate("(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((x,i)=>ids.indexOf(x)!==i)})()")
    check('no duplicate element ids while editors were opened', not dup, dup)
    page.keyboard.press('Escape'); open_dt(page,2); check('third open also leaves exactly one', page.locator('#q-h').count()==1)
    page.click('#q-cancel')
    c.close()
    # stale untouched time refreshes to now on Save; touched/edited/past-date never change
    import datetime as dt
    def clock_ctx():
        c2=b.new_context(viewport={'width':390,'height':844}); p2=c2.new_page(); p2.on('pageerror',lambda e: errs.append(str(e)))
        base=dt.datetime.now().replace(hour=10,minute=0,second=0,microsecond=0); p2.clock.install(time=base); p2.goto(URL); create(p2); return c2,p2
    def hhmm_to_min(x): return int(x[:2])*60+int(x[3:])
    c2,p2=clock_ctx(); start_add(p2); p2.clock.run_for(20*60*1000); p2.click('#save-entry'); st=stored(p2)[0]
    check('untouched stale time (20 min old) refreshed to now at Save', abs(hhmm_to_min(st)-(10*60+20))<=2, st); c2.close()
    c2,p2=clock_ctx(); start_add(p2); p2.clock.run_for(8*60*1000); p2.click('#save-entry'); st=stored(p2)[0]
    check('time less than 10 minutes old is kept', abs(hhmm_to_min(st)-(10*60))<=2, st); c2.close()
    c2,p2=clock_ctx(); start_add(p2); set_time(p2,'09:00'); p2.clock.run_for(40*60*1000); p2.click('#save-entry'); st=stored(p2)[0]
    check('explicitly edited time is never changed', st=='09:00', st); c2.close()
    c2,p2=clock_ctx(); start_add(p2); p2.click('#atime-now'); p2.clock.run_for(40*60*1000); p2.click('#save-entry'); st=stored(p2)[0]
    check('time set with Now button counts as touched', abs(hhmm_to_min(st)-(10*60))<=2, st); c2.close()
    c2,p2=clock_ctx(); start_add(p2); p2.fill('#adate',(dt.date.today()-dt.timedelta(days=1)).isoformat()); p2.dispatch_event('#adate','change'); p2.clock.run_for(40*60*1000); p2.click('#save-entry'); st=stored(p2)[0]
    check('past date: time not refreshed', abs(hhmm_to_min(st)-(10*60))<=2, st); c2.close()
    c2,p2=clock_ctx(); start_add(p2); p2.click('#save-entry'); first=stored(p2)[0]; p2.clock.run_for(40*60*1000); edit_entry(p2,'Idli'); p2.click('#save-entry')
    check('editing an entry never refreshes its time', stored(p2)[0]==first, (first,stored(p2))); c2.close()
    # locale independence
    outs={}
    for loc in ('en-US','en-IN','en-GB','de-DE'):
        c,p=mk(loc); start_add(p); set_time(p,'20:30'); p.click('#save-entry')
        outs[loc]=(p.locator('.time-text').all_inner_texts(), p.locator('#view input[type=time]').count()); c.close()
    check('same 12-hour display in en-US, en-IN, en-GB, de-DE', all(v==(['8:30 PM'],0) for v in outs.values()), outs)
    # edit entry screen uses the component and keeps the time
    c,p=mk('en-IN'); start_add(p); set_time(p,'18:20'); p.click('#save-entry'); edit_entry(p,'Idli')
    check('Edit screen preloads 6:20 PM', vals(p)==('6','20','false','true'), vals(p)); set_time(p,'07:05'); p.click('#save-entry')
    check('Edit screen saves new time', stored(p)==['07:05']); c.close()
    check('no console errors', not errs, errs[:3]); check('no network requests', not reqs, reqs)
    b.close()
print('FAILED',[n for n,o in res if not o])
