import json, re, sys, time
from playwright.sync_api import sync_playwright
import sys; sys.path.insert(0,'/home/arch/projects/trackme/tests')
from tphelpers import *
res=[]
def check(n,ok,info=''): res.append((n,bool(ok))); print('PASS' if ok else 'FAIL',n,info)
def create(page,name='A'):
    page.fill('#f-name',name); page.fill('#f-dob','1990-01-01'); page.fill('#f-height','170'); page.fill('#f-weight','70'); page.click('#save-profile')
def tab(page,t): goto(page,t)
def P(code,name,brand='Acme',kcal=250,p=10,c=30,f=9,fib=2,**kw):
    n={'energy-kcal_100g':kcal,'proteins_100g':p,'carbohydrates_100g':c,'fat_100g':f,'fiber_100g':fib}
    n.update(kw.pop('nutr',{}))
    d={'code':code,'product_name':name,'brands':brand,'nutriments':n}; d.update(kw); return d
GOOD={'products':[P('111','Zork Bar',serving_quantity=40,serving_size='40 g'),P('222','Zork Crunch',brand='Beta',kcal=400,p=8,c=60,f=14)]}
def mk(b,router=None,offline=False):
    c=b.new_context(viewport={'width':390,'height':844}); p=c.new_page(); p.calls=[]; p.errs=[]; p.pageerrs=[]
    p.on('pageerror',lambda e: p.pageerrs.append(str(e))); p.on('console',lambda m: p.errs.append(m.text) if m.type=='error' else None)
    def h(route):
        url=route.request.url; p.calls.append(url); r=router(url) if router else 'abort'
        if r=='abort': route.abort('failed')
        elif r=='hang': return
        else:
            st,body=r; route.fulfill(status=st,headers={'access-control-allow-origin':'*','content-type':'application/json'},body=body if isinstance(body,str) else json.dumps(body))
    p.route(re.compile(r'openfoodfacts\.org'),h)
    p.goto(URL); create(p); tab(p,'add'); return c,p
def q(p,text): p.fill('#q',text)
def online(p,text='zork'):
    q(p,text); p.click('#off-search'); p.wait_for_timeout(300)
def prim(u): return 'world.openfoodfacts.org' in u
def fb(u): return 'search.openfoodfacts.org' in u
with sync_playwright() as pw:
    b=pw.chromium.launch()
    # 1 no request before tap
    c,p=mk(b,lambda u:(200,GOOD)); q(p,'zork'); p.wait_for_timeout(300)
    check('no OFF request before the button is tapped', not p.calls, p.calls)
    check('notice shown before first search', 'Your search words are sent to openfoodfacts.org.' in p.inner_text('#off-notice'))
    check('visible online button', p.locator('#off-search').is_visible())
    p.click('#off-search'); p.wait_for_timeout(300)
    check('request made only after tap (primary URL shape)', len(p.calls)==1 and prim(p.calls[0]) and 'search_terms=zork' in p.calls[0] and 'json=1' in p.calls[0] and 'page_size=20' in p.calls[0] and 'fields=' in p.calls[0], p.calls)
    # 2 success
    items=p.locator('.off-result').all_inner_texts()
    check('results list name + brand + values', len(items)==2 and 'Zork Bar' in items[0] and 'Acme' in items[0] and '250 kcal' in items[0] and 'Open Food Facts' in items[0], items)
    check('rate limit: button disabled right after search', p.locator('#off-search').is_disabled())
    t0=time.time()
    while p.locator('#off-search').is_disabled() and time.time()-t0<10: p.wait_for_timeout(200)
    el=time.time()-t0; check('button re-enabled after ~6 s', not p.locator('#off-search').is_disabled() and 4.0<=el+0.5<=8, el)
    p.locator('.off-result').first.click()
    chips=p.locator('[aria-label=Unit] .chip').all_inner_texts(); check('serving chip from serving_quantity', any('serving (40 g)' in x for x in chips), chips)
    p.click('#save-entry'); sf=p.evaluate("JSON.parse(localStorage.getItem('dt:v1:sharedfoods'))")
    check('saved to shared list as off_<code> with source', 'off_111' in sf and sf['off_111']['source']=='openfoodfacts' and sf['off_111']['units'].get('serving')==40, list(sf))
    tab(p,'about'); check('About credits Open Food Facts, ODbL', p.locator('#off-credit').is_visible() and 'Open Food Facts, ODbL' in p.inner_text('#off-credit'))
    n=len(p.calls); tab(p,'add'); q(p,'zork bar'); p.wait_for_timeout(200)
    first=p.locator('button.result').first.inner_text()
    check('saved OFF food is searchable offline, tagged, no new request', 'Zork Bar' in first and 'Open Food Facts' in first and len(p.calls)==n, first)
    check('no innerHTML in page source', '.innerHTML' not in open('/home/arch/projects/trackme/index.html').read()+open('/home/arch/projects/trackme/app.js').read())
    c.close()
    # 3 fallback paths
    FB={'hits':[P('333','Hit One')]}
    for name,fn in (('primary 500',lambda u:(500,'err') if prim(u) else (200,FB)),
                    ('primary malformed JSON',lambda u:(200,'{not json') if prim(u) else (200,FB)),
                    ('primary unknown shape',lambda u:(200,{'foo':1}) if prim(u) else (200,FB)),
                    ('primary empty products',lambda u:(200,{'products':[]}) if prim(u) else (200,FB)),
                    ('primary aborted',lambda u:'abort' if prim(u) else (200,FB))):
        c,p=mk(b,fn); online(p,'hit'); check(f'fallback used: {name}', len(p.calls)==2 and fb(p.calls[1]) and 'Hit One' in p.inner_text('#off-out') and 'q=hit' in p.calls[1], p.calls); c.close()
    c,p=mk(b,lambda u:(200,GOOD) if prim(u) else (500,'x')); online(p); check('primary ok -> fallback not called', len(p.calls)==1); c.close()
    # 4 empty
    c,p=mk(b,lambda u:(200,{'products':[],'hits':[]})); online(p,'nothingtofind')
    check('empty results message + custom fallback visible', 'No usable matches' in p.inner_text('#off-out') and p.locator('#custom-food-btn').is_visible(), p.inner_text('#off-out')); c.close()
    # 5 429/503
    c,p=mk(b,lambda u:(429,'slow down')); online(p); check('HTTP 429 -> wait a minute message, no fallback hammering', 'Too many searches' in p.inner_text('#off-out') and len(p.calls)==1, p.calls); c.close()
    for st in (500,502,503,504):
        c,p=mk(b,lambda u,st=st:(st,'down') if prim(u) else (200,GOOD)); online(p)
        check(f'HTTP {st} on primary is a failure -> fallback used and results shown', len(p.calls)==2 and fb(p.calls[1]) and 'Zork Bar' in p.inner_text('#off-out') and 'Too many' not in p.inner_text('#off-out'), p.calls); c.close()
    c,p=mk(b,lambda u:(503,'down')); online(p); check('503 on all three -> plain failure with the HTTP code (not "too many searches")', 'busy or down' in p.inner_text('#off-out') and 'HTTP 503' in p.inner_text('#off-out') and 'Too many' not in p.inner_text('#off-out') and len(p.calls)==3); c.close()
    c,p=mk(b,lambda u:(500,'x') if prim(u) else (429,'x')); online(p); check('fallback 429 -> wait message', 'Too many searches' in p.inner_text('#off-out')); c.close()
    # 6 offline / abort / CORS-ish failure
    c,p=mk(b,lambda u:'abort'); online(p); check('abort/CORS failure message + custom fallback', 'did not get through' in p.inner_text('#off-out') and p.locator('#custom-food-btn').is_visible() and len(p.calls)==3, p.calls); c.close()
    c,p=mk(b,lambda u:(200,GOOD)); c.set_offline(True); q(p,'zork'); p.click('#off-search'); p.wait_for_timeout(300)
    check('offline: plain message and no request', 'offline' in p.inner_text('#off-out').lower() and not p.calls, (p.inner_text('#off-out'),p.calls)); c.close()
    # 7 malformed everywhere
    c,p=mk(b,lambda u:(200,'<html>nope')); online(p); check('malformed JSON everywhere -> friendly failure', 'could not read' in p.inner_text('#off-out')); check('no page errors on malformed JSON', not p.pageerrs, p.pageerrs); c.close()
    # 8 odd values
    ODD={'products':[
        P('401','Missing energy',nutr={'energy-kcal_100g':None}),
        P('402','Too many kcal',kcal=1200,p=1,c=1,f=1),
        P('403','Macros over 100',kcal=500,p=60,c=60,f=30),
        P('404','KJ only',nutr={'energy-kcal_100g':None,'energy_100g':1000},p=5,c=50,f=3),
        P('405','Atwater mismatch',kcal=500,p=1,c=1,f=1),
        P('406','String numbers',nutr={'energy-kcal_100g':'120','proteins_100g':'4,5','carbohydrates_100g':'20','fat_100g':'1.5','fiber_100g':''}),
        {'product_name':'No code','nutriments':{'energy-kcal_100g':100,'proteins_100g':1,'carbohydrates_100g':1,'fat_100g':1}},
        P('408','',kcal=100),
        P('409','Negative',kcal=100,p=-5,c=10,f=1),
        'garbage',None,P('411','No macros',nutr={'proteins_100g':None})]}
    c,p=mk(b,lambda u:(200,ODD)); online(p,'odd'); txt=p.locator('.off-result').all_inner_texts(); names=[x.split('\n')[0] for x in txt]
    check('odd rows dropped, usable rows kept', [x for x in names if 'KJ only' in x]!=[] and [x for x in names if 'String' in x]!=[] and not any(k in ' '.join(names) for k in ('Missing energy','Too many kcal','Macros over','No code','Negative','No macros')), names)
    kj=[x for x in txt if 'KJ only' in x][0]; check('kJ converted to kcal (1000 kJ = 239 kcal)', '239 kcal' in kj, kj)
    check('Atwater mismatch flagged "check values"', 'check values' in [x for x in txt if 'Atwater' in x][0] and 'check values' not in kj, txt)
    check('string numbers with comma parsed', '120 kcal' in [x for x in txt if 'String' in x][0] and 'P 4.5' in [x for x in txt if 'String' in x][0])
    c.close()
    # 10 XSS in product strings
    X={'products':[P('501','<img src=x onerror=window.__xss=1>',brand='<script>window.__xss=2</script>'),P('502','Plain "quoted" & <b>bold</b>')]}
    c,p=mk(b,lambda u:(200,X)); online(p,'xss'); body=p.inner_text('#off-out')
    check('XSS strings shown as literal text', '<img src=x onerror=window.__xss=1>' in body and p.locator('#off-out img').count()==0 and p.locator('#off-out script').count()==0 and p.evaluate('window.__xss')==None, body[:120])
    p.locator('.off-result').first.click(); p.click('#save-entry')
    tab(p,'myfoods'); lst=p.inner_text('#myfoods-list')
    check('XSS stays text in My foods and Today', '<img src=x' in lst and p.locator('#myfoods-list img').count()==0 and p.evaluate('window.__xss')==None)
    tab(p,'today'); check('XSS stays text on Today', p.locator('#view img').count()==0 and p.evaluate('window.__xss')==None)
    c.close()
    # 11 timeout (fake clock): both endpoints hang
    c=b.new_context(viewport={'width':390,'height':844}); p=c.new_page(); p.calls=[]
    p.route(re.compile(r'openfoodfacts\.org'),lambda r:(p.calls.append(r.request.url)))
    p.clock.install(); p.goto(URL); create(p); tab(p,'add'); q(p,'slowpoke'); p.click('#off-search'); p.wait_for_timeout(200)
    p.clock.run_for(5100); p.wait_for_timeout(200); hint=p.inner_text('#off-out'); hasc=p.locator('#off-cancel').count()==1
    p.clock.run_for(7000); p.wait_for_timeout(300); mid=len(p.calls); p.clock.run_for(12100); p.wait_for_timeout(300); p.clock.run_for(12100); p.wait_for_timeout(300)
    check('after 5 s: Still searching hint + Cancel button', 'Still searching' in hint and hasc, hint)
    check('12 s per-request timeout aborts hanging request then tries the next two servers, then fails plainly', mid==2 and len(p.calls)==3 and 'did not answer in 12 seconds' in p.inner_text('#off-out'), (mid,p.calls,p.inner_text('#off-out')))
    c.close()
    # ---- round 5: discoverability, cancel, brand once, no save until entry saved ----
    c=b.new_context(viewport={'width':360,'height':740}); p=c.new_page(); p.calls=[]
    p.route(re.compile(r'openfoodfacts\.org'),lambda r:(p.calls.append(r.request.url),r.fulfill(status=200,headers={'access-control-allow-origin':'*','content-type':'application/json'},body=json.dumps(GOOD))))
    p.goto(URL); create(p); tab(p,'add')
    check('top online button hidden for empty/1-char query', not p.locator('#off-search-top').is_visible())
    q(p,'z'); check('still hidden at 1 char', not p.locator('#off-search-top').is_visible())
    q(p,'zork'); bb=p.locator('#off-search-top').bounding_box()
    check('top online button visible without scrolling at 360x740 (query 2+ chars)', p.locator('#off-search-top').is_visible() and bb['y']+bb['height']<740-56, bb)
    check('privacy notice next to top button', 'sent to openfoodfacts.org' in p.inner_text('#off-top') and 'sent to openfoodfacts.org' in p.inner_text('#off-notice'))
    check('top button >=44px tall', bb['height']>=44, bb)
    check('no request yet', not p.calls); p.click('#off-search-top'); p.wait_for_timeout(300)
    check('top button triggers search; results appear right under the box', len(p.calls)==1 and p.locator('#off-out .off-result').count()==2)
    check('both buttons disabled during cooldown', p.locator('#off-search-top').is_disabled() and p.locator('#off-search').is_disabled())
    check('360 no horizontal scroll', p.evaluate('document.documentElement.scrollWidth')<=360)
    # tapping a result does not save until the entry is saved
    p.locator('.off-result').first.click()
    check('tap result: nothing saved to My foods yet', p.evaluate("localStorage.getItem('dt:v1:sharedfoods')")in(None,'{}') and p.locator('#pending-box').is_visible(), p.evaluate("localStorage.getItem('dt:v1:sharedfoods')"))
    p.click('text=Cancel'); check('cancelling the add leaves nothing saved', p.evaluate("localStorage.getItem('dt:v1:sharedfoods')")in(None,'{}'))
    tab(p,'add'); q(p,'zork'); p.click('#off-search-top'); p.wait_for_timeout(300); p.locator('.off-result').first.click(); p.click('#save-to-myfoods')
    check('explicit Save to my foods stores it', 'off_111' in json.loads(p.evaluate("localStorage.getItem('dt:v1:sharedfoods')")) and p.locator('#save-to-myfoods').count()==0)
    p.click('text=Cancel'); tab(p,'add'); q(p,'zork crunch'); p.click('#off-search-top'); p.wait_for_timeout(300); p.locator('.off-result').nth(1).click(); p.click('#save-entry')
    check('saving the log entry stores the food', 'off_222' in json.loads(p.evaluate("localStorage.getItem('dt:v1:sharedfoods')")))
    c.close()
    # brand shown once
    BR={'products':[P('601','Parle-G Biscuit',brand='Parle'),P('602','Glucose Biscuit',brand='Parle'),P('603','Maggi Noodles',brand='Nestle, Maggi')]}
    c,p=mk(b,lambda u:(200,BR)); online(p,'biscuit'); tx=p.locator('.off-result').all_inner_texts()
    check('brand not repeated in result rows', all(x.split('\n')[0].count('Parle')<=1 for x in tx) and 'Parle-G Biscuit - Parle' not in ' '.join(tx), tx)
    check('brand added in brackets only when missing from name', any(x.startswith('Glucose Biscuit (Parle)') for x in tx) and any(x.startswith('Parle-G Biscuit ') and '(Parle)' not in x.split('\n')[0] for x in tx), tx)
    c.close()
    # odd value -> check values warning on add form and stored flag
    CK={'products':[P('701','Odd Energy',kcal=500,p=1,c=1,f=1)]}
    c,p=mk(b,lambda u:(200,CK)); online(p,'odd'); p.locator('.off-result').first.click()
    check('check values warning visible on add form', p.locator('#check-warning').is_visible() and 'check values' in p.inner_text('#view').lower())
    p.click('#save-entry'); sf=json.loads(p.evaluate("localStorage.getItem('dt:v1:sharedfoods')"))
    check('check flag stored on saved food', sf['off_701'].get('check') is True, sf)
    tab(p,'add'); q(p,'odd energy'); check('saved flagged food shows check values tag offline', 'check values' in p.locator('button.result').first.inner_text()); c.close()
    # cancel hanging search
    c=b.new_context(viewport={'width':390,'height':844}); p=c.new_page(); p.calls=[]
    p.route(re.compile(r'openfoodfacts\.org'),lambda r:(p.calls.append(r.request.url)))
    p.clock.install(); p.goto(URL); create(p); tab(p,'add'); q(p,'slow'); p.click('#off-search-top'); p.wait_for_timeout(200)
    p.clock.run_for(5100); p.wait_for_timeout(200); p.click('#off-cancel'); p.wait_for_timeout(300)
    check('Cancel stops the search, no fallback request, plain message', 'cancelled' in p.inner_text('#off-out').lower() and len(p.calls)==1, p.calls)
    c.close()
    # 12 stale/no leakage: no OFF request in a normal session and no errors other than network ones
    c,p=mk(b,lambda u:(200,GOOD)); q(p,'roti'); tab(p,'today'); check('normal use makes no OFF requests', not p.calls); check('no page errors', not p.pageerrs); c.close()
    b.close()
print('FAILED',[n for n,o in res if not o])
