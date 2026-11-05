import json
from playwright.sync_api import sync_playwright
import sys; sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
res=[]
def check(n,ok,info=''): res.append((n,bool(ok))); print('PASS' if ok else 'FAIL',n,info)
def create(page,name='A'):
    page.fill('#f-name',name); page.fill('#f-dob','1990-01-01'); page.fill('#f-height','170'); page.fill('#f-weight','70'); page.click('#save-profile')
def add(page,q,qty=1):
    goto(page,'add'); page.fill('#q',q); page.locator('button.result').first.click(); page.click('#save-entry')
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True); page=ctx.new_page()
    page.goto(URL); create(page,'Asha'); add(page,'roti'); add(page,'dal')
    goto(page,'backup')
    with page.expect_download() as dl: page.click('#export-one')
    dl.value.save_as('/tmp/h-export.json')
    check('export only me default is primary', 'primary' in page.get_attribute('#export-one','class') and len(json.load(open('/tmp/h-export.json'))['profiles'])==1)
    check('backup & restore is one tap from the menu and its card comes first', page.locator('#view > section').first.get_attribute('id')=='backup')
    # welcome restore
    page.evaluate('localStorage.clear()'); page.reload()
    page.set_input_files('#restore #import-file','/tmp/h-export.json'); page.click('#import-apply')
    page.wait_for_selector('#t-kcal',state='attached')
    check('restore from welcome lands on Today', page.locator('h1').first.inner_text()=='Today')
    check('no leftover profile', page.evaluate("Object.keys(localStorage).filter(k=>k.endsWith(':profile')).length")==1)
    check('restored kcal > 0', int(page.inner_text('#t-kcal'))>0, page.inner_text('#t-kcal'))
    # corrupt shard protected
    k=page.evaluate("Object.keys(localStorage).find(k=>k.includes(':entries:'))")
    page.evaluate("k=>localStorage.setItem(k,'{broken')",k); page.reload()
    goto(page,'history')
    ck=page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('dt:v1:corrupt:'))")
    check('corrupt shard backed up', len(ck)==1 and page.evaluate("k=>localStorage.getItem(k)",ck[0])=='{broken', ck)
    add(page,'banana')
    check('backup survives later write', page.evaluate("k=>localStorage.getItem(k)",ck[0])=='{broken')
    check('new entry saved', page.evaluate("k=>JSON.parse(localStorage.getItem(k)).length",k)==1)
    # partially bad shard keeps backup
    page.evaluate("k=>{const a=JSON.parse(localStorage.getItem(k));a.push({id:'zz'});localStorage.setItem(k,JSON.stringify(a))}",k); page.reload(); goto(page,'history')
    check('partial damage backed up', page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('dt:v1:corrupt:')).length")==2)
    # damaged meta -> rebuilt
    page.evaluate("localStorage.setItem('dt:v1:meta','{{{')"); page.reload()
    check('people rebuilt from profile records', page.locator('h1').first.inner_text()=='Today')
    ctx.close()
    ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True); p2=ctx.new_page()
    p2.goto(URL); create(p2,'Z')
    p2.add_init_script("Date.prototype.toLocaleDateString=function(){throw new Error('boom')}")
    p2.reload()
    check('crash card shown', p2.locator('#crash').count()==1 and 'Something went wrong' in p2.inner_text('#crash'))
    with p2.expect_download() as d2: p2.click('#export-raw')
    raw=json.load(open(d2.value.path())); check('raw export has keys', any(k.endswith(':profile') for k in raw['keys']))
    check('menu still usable after crash', p2.locator('#drawer [data-view=weight]').count()==1)
    ctx.close()
    # storage blocked shows notice sentence
    ctx=b.new_context(); p3=ctx.new_page(); p3.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('x')}})"); p3.goto(URL)
    check('blocked: notice text shown', 'not inside WhatsApp or Gmail' in p3.inner_text('#banners'))
    b.close()
print('FAILED',[n for n,o in res if not o])
