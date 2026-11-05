"""PWA tests: service worker, offline, update flow, manifest/icons, CSP, no outside requests. Served from http://localhost:8765 (secure context)."""
import sys, os, re, json, shutil, struct, tempfile, urllib.request
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
import serve_dist
from playwright.sync_api import sync_playwright

res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

DIST = serve_dist.DIST
BASE = serve_dist.BASE
def get(path, base=BASE):
    return urllib.request.urlopen(base + path).read()
def png_size(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    return struct.unpack('>II', data[16:24])

def copy_site(dst):
    """copy dist without the big model libraries (they are not needed for shell tests)"""
    serve_dist.copy_site(dst)

# ---------- static checks on the built files ----------
srv = serve_dist.start()
mf = json.loads(get('manifest.webmanifest'))
check('manifest parses; name, short_name, display, start_url and scope', mf['name'] == 'TrackMe' and mf['short_name'] == 'TrackMe' and mf['display'] == 'standalone' and mf['start_url'] == './' and mf['scope'] == './')
check('manifest colours come from the app tokens (#1c7352 / #f4f6f3)', mf['theme_color'] == '#1c7352' and mf['background_color'] == '#f4f6f3')
sizes = {}
for ic in mf['icons']:
    data = get(ic['src'])
    if ic['type'] == 'image/png':
        w, h = png_size(data); sizes[ic['src']] = (w, h)
        check('icon %s is really %s' % (ic['src'], ic['sizes']), '%dx%d' % (w, h) == ic['sizes'], (w, h))
    else:
        check('icon %s is an SVG' % ic['src'], b'<svg' in data)
check('icons: 192, 512 and a maskable 512 exist', set(sizes) == {'icons/192.png', 'icons/512.png', 'icons/maskable-512.png'} and any(i['purpose'] == 'maskable' for i in mf['icons']))
check('manifest paths are relative', all(not i['src'].startswith('/') for i in mf['icons']))
idx = get('index.html').decode()
check('index.html has no absolute-path src/href (works under /repo/)', not re.search(r'(?:src|href)="/(?!/)', idx), re.findall(r'(?:src|href)="/[^"]*', idx))
check('index.html links the manifest and an apple-touch-icon', 'rel="manifest" href="manifest.webmanifest"' in idx and 'apple-touch-icon' in idx)
m = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', idx)
csp = m.group(1) if m else ''
check("CSP meta: script-src 'self' 'wasm-unsafe-eval', worker-src 'self' (no blob:)", "script-src 'self' 'wasm-unsafe-eval'" in csp and "worker-src 'self'" in csp and 'blob:' not in csp, csp)
check('CSP meta: connect-src has Hugging Face and Open Food Facts hosts only (no wildcard *)', all(x in csp for x in ('https://huggingface.co', 'https://*.huggingface.co', 'https://*.hf.co', 'https://world.openfoodfacts.org', 'https://search.openfoodfacts.org')) and ' * ' not in csp and 'raw.githubusercontent.com' not in csp, csp)
sw = get('sw.js').decode()
check('sw.js: versioned cache name trackme-shell-v<hash>, hash injected', re.search(r"VERSION = '[0-9a-f]{10}'", sw) and '__SHELL_VERSION__' not in sw and "'trackme-shell-v'" in sw)
check('sw.js: ignores cross-origin and deletes only trackme-shell-* and old journable-shell-* caches', 'url.origin !== self.location.origin' in sw and "k.indexOf('journable-shell-') === 0 || k.indexOf('trackme-shell-') === 0" in sw)
check('site has .nojekyll, README.md, vendor VERSION.txt, llm-worker.js', all(os.path.exists(DIST + '/' + f) for f in ('.nojekyll', 'README.md', 'vendor/web-llm/VERSION.txt', 'llm-worker.js', 'vendor/web-llm/web-llm.js')))
check('vendor libs for the three models are vendored', all(os.path.exists(DIST + '/vendor/web-llm/libs/' + f) for f in ('Qwen3-0.6B-q4f16_1_cs1k-webgpu.wasm', 'Qwen3-1.7B-q4f16_1_cs1k-webgpu.wasm', 'Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm')))
vt = open(DIST + '/vendor/web-llm/VERSION.txt').read()
import hashlib
check('VERSION.txt records the version and the real sha256 of web-llm.js', '0.2.87' in vt and hashlib.sha256(open(DIST + '/vendor/web-llm/web-llm.js', 'rb').read()).hexdigest() in vt)
check('no innerHTML / eval / document.write in app.js', not re.search(r'innerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(', open(DIST + '/app.js').read()))
srv.stop()

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---------- first load on localhost ----------
    srv = serve_dist.start()
    errs = []; reqs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, accept_downloads=True); p = ctx.new_page()
    p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    p.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    p.on('request', lambda r: reqs.append(r.url))
    p.goto(BASE); p.wait_for_selector('#f-name')
    p.wait_for_function("()=>navigator.serviceWorker&&navigator.serviceWorker.controller", timeout=15000)
    check('service worker registers and controls the page after load', p.evaluate("()=>!!navigator.serviceWorker.controller") is True)
    check('zero requests outside localhost on load', not [u for u in reqs if not u.startswith('http://localhost:8765/')], [u for u in reqs if not u.startswith('http://localhost:8765/')])
    names = p.evaluate("()=>caches.keys()")
    check('cache names are only trackme-shell-v*', names and all(re.match(r'^trackme-shell-v[0-9a-f]{10}$', n) for n in names), names)
    keys = p.evaluate("async()=>{const c=await caches.open((await caches.keys())[0]);return (await c.keys()).map(r=>r.url)}")
    check('shell cache holds the app files and nothing but same-origin URLs', all(u.startswith('http://localhost:8765/') for u in keys) and any(u.endswith('/app.js') for u in keys) and any(u.endswith('/index.html') for u in keys) and any(u.endswith('/manifest.webmanifest') for u in keys), keys)
    check('shell cache does not include the big vendor files before AI is used', not any('vendor/' in u for u in keys), keys)
    check('chip says Basic on a fresh install', p.inner_text('#ai-chip').strip() == 'Basic')
    check('no console errors or warnings on first load', not errs, errs)
    check('CSP blocks inline scripts (injected script did not run)', p.evaluate("()=>{const s=document.createElement('script');s.textContent='window.__csp_ran=1';document.body.appendChild(s);return window.__csp_ran===undefined}"))

    # profile + first save, storage persistence request
    make_profile(p, 'Pwa', 2000)
    quick(p, '2 roti and dal for lunch')
    p.wait_for_timeout(300)
    goto(p, 'backup')
    check('Backup & restore shows the storage protection result after the first save', 'Storage protection:' in p.inner_text('#persist-line') and 'not requested yet' not in p.inner_text('#persist-line'), p.inner_text('#persist-line'))

    # fake Hugging Face request: never in the shell cache, never intercepted
    hf = []
    p.route(re.compile(r'https://huggingface\.co/.*'), lambda r: (hf.append(r.request.url), r.fulfill(status=200, headers={'access-control-allow-origin': '*', 'content-type': 'application/octet-stream'}, body=b'weights')))
    out = p.evaluate("async()=>{const r=await fetch('https://huggingface.co/mlc-ai/fake/resolve/main/params.bin');return (await r.text())}")
    keys2 = p.evaluate("async()=>{let o=[];for(const n of await caches.keys()){const c=await caches.open(n);o=o.concat((await c.keys()).map(r=>r.url))}return o}")
    check('a fake huggingface.co fetch goes to the network (route saw it) and returns', hf == ['https://huggingface.co/mlc-ai/fake/resolve/main/params.bin'] and out == 'weights', (hf, out))
    check('the fake huggingface.co response is never in any cache', not [u for u in keys2 if 'huggingface' in u], keys2)

    # offline reload
    ctx.set_offline(True)
    p.reload(); p.wait_for_selector('#qbar', timeout=15000)
    check('offline reload renders the app and the journal', p.locator('li.entry').count() == 2 and 'Today' in p.inner_text('#title'))
    check('offline: no console errors from the reload', not [e for e in errs if 'Failed to load resource' in e and 'huggingface' not in e], errs[-3:])
    ctx.set_offline(False)
    p.reload(); p.wait_for_selector('#qbar')
    check('back online it still renders', p.locator('li.entry').count() == 2)
    goto(p, 'phone'); p.wait_for_timeout(600)
    check('Check my phone: offline support row passes while the SW controls the page', p.get_attribute('#phone-list [data-id=sw]', 'data-status') == 'pass')
    ctx.close(); srv.stop()

    # ---------- persist() results ----------
    for grant in (True, False):
        srv = serve_dist.start()
        init = "(()=>{const s=navigator.storage;const orig=s.persisted.bind(s);Object.defineProperty(s,'persist',{value:()=>Promise.resolve(%s)});Object.defineProperty(s,'persisted',{value:()=>Promise.resolve(false)});})()" % ('true' if grant else 'false')
        p = new_page(b, url=BASE, init=init); make_profile(p, 'P', 2000); quick(p, '1 banana'); p.wait_for_timeout(300)
        goto(p, 'backup'); line = p.inner_text('#persist-line')
        check('persist() %s: Backup & restore says so' % ('granted' if grant else 'refused'), ('on. The browser has promised' in line) if grant else ('not granted' in line), line)
        goto(p, 'phone'); p.wait_for_timeout(500)
        row = p.locator('#phone-list [data-id=persist]')
        check('persist() %s: Check my phone row reads persisted()=false, so FAIL "not promised"' % ('granted' if grant else 'refused'), row.get_attribute('data-status') == 'fail' and 'Not promised' in row.inner_text())
        p.context.close(); srv.stop()

    # ---------- update flow: bump the version on a copy ----------
    GPU = "Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:()=>Promise.resolve({features:new Set(['shader-f16']),limits:{maxBufferSize:2147483648,maxStorageBuffersPerShaderStage:10},info:{vendor:'t'}})}});"
    tmp = tempfile.mkdtemp(); site = tmp + '/site'; copy_site(site)
    srv = serve_dist.start(site)
    errs = []
    ctxu = b.new_context(viewport={'width': 360, 'height': 740}, accept_downloads=True); ctxu.add_init_script(GPU)
    p = ctxu.new_page()
    p.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    p.goto(BASE); p.wait_for_selector('#f-name'); make_profile(p, 'Upd', 2000)
    quick(p, '2 roti and dal for lunch'); quick(p, '1 banana')
    n_entries = p.locator('li.entry').count()
    check('precondition for the update test: 3 entries are in the journal', n_entries == 3, n_entries)
    p.wait_for_function("()=>navigator.serviceWorker.controller", timeout=15000)
    p.evaluate("async()=>{await caches.open('some-other-app-cache');await caches.open('journable-shell-v0123456789')}")
    # use the AI screen so web-llm.js is fetched (and cached in journable-lib); the real engine then fails politely (no GPU / no Hugging Face)
    p.route(re.compile(r'https://(.*\.)?huggingface\.co/.*'), lambda r: r.abort())
    goto(p, 'ai'); p.wait_for_selector('#ai-card-0'); p.wait_for_timeout(300); p.click('#ai-dl-0'); p.wait_for_selector('#ai-err', timeout=90000)
    lib_keys = p.evaluate("async()=>{const c=await caches.open('journable-lib');return (await c.keys()).map(r=>r.url)}")
    check('web-llm.js is kept in its own cache journable-lib (not in a versioned shell cache)', any(u.endswith('/vendor/web-llm/web-llm.js') for u in lib_keys), lib_keys)
    shell_keys = p.evaluate("async()=>{let o=[];for(const n of await caches.keys()){if(n.startsWith('trackme-shell-')){const c=await caches.open(n);o=o.concat((await c.keys()).map(r=>r.url))}}return o}")
    check('the shell cache does not hold the AI library', not any('vendor/' in u for u in shell_keys), shell_keys)
    check('no Update ready banner before anything changes', p.locator('#update-chip').count() == 0)
    swtxt = open(site + '/sw.js').read(); newv = 'abcdef0123'
    open(site + '/sw.js', 'w').write(re.sub(r"VERSION = '[0-9a-f]{10}'", "VERSION = '%s'" % newv, swtxt))
    p.evaluate("()=>window.__swReg.update()")
    p.wait_for_selector('#update-chip', timeout=15000)
    check('bumping the version shows "Update ready" with a Reload button', 'Update ready' in p.inner_text('#update-banner') and p.inner_text('#update-chip').strip() == 'Reload to update')
    check('the old version keeps running until the user taps (both shell caches exist)', len([n for n in p.evaluate("()=>caches.keys()") if n.startswith('trackme-shell-')]) == 2)
    check('a toast also says Update ready', 'Update ready' in p.inner_text('#toasts'))
    with p.expect_navigation():
        p.click('#update-chip')
    p.wait_for_selector('#qbar')
    names = p.evaluate("()=>caches.keys()")
    check('after Reload: the new cache is trackme-shell-v%s and the old shell cache is deleted' % newv, ('trackme-shell-v' + newv) in names and len([n for n in names if n.startswith('trackme-shell-')]) == 1, names)
    check('after Reload: an OLD journable-shell-* cache from a pre-rename install is deleted', not any(n.startswith('journable-shell-') for n in names), names)
    check('after Reload: a foreign cache is NOT deleted (only trackme-shell-* / journable-shell-* are)', 'some-other-app-cache' in names, names)
    check('after Reload: the AI library cache journable-lib is still there with web-llm.js', 'journable-lib' in names and p.evaluate("async()=>{const c=await caches.open('journable-lib');return (await c.keys()).length}") >= 1, names)
    check('after Reload: the journal is untouched (same 3 entries, same person) and no banner remains', p.locator('li.entry').count() == n_entries and p.locator('#update-chip').count() == 0 and 'Upd' in p.inner_text('#view'), p.locator('li.entry').count())
    ctxu.set_offline(True)
    ok = p.evaluate("async()=>{try{const r=await fetch('vendor/web-llm/web-llm.js');const t=await r.text();return r.ok&&t.length>1000000}catch(e){return String(e)}}")
    check('offline after the update: web-llm.js is still served (from journable-lib)', ok is True, ok)
    imp = p.evaluate("async()=>{try{const m=await import('./vendor/web-llm/web-llm.js');return typeof m.CreateWebWorkerMLCEngine}catch(e){return String(e)}}")
    check('offline after the update: the AI library still imports', imp == 'function', imp)
    p.reload(); p.wait_for_selector('#qbar', timeout=15000)
    check('offline after the update: the app and its journal open', p.locator('li.entry').count() == n_entries)
    ctxu.set_offline(False)
    check('no errors during the update flow', not errs, errs)
    ctxu.close(); srv.stop()

    # ---------- served from a sub-folder (GitHub Pages project address) ----------
    tmp2 = tempfile.mkdtemp(); copy_site(tmp2 + '/repo')
    srv = serve_dist.start(tmp2)
    errs = []
    p = new_page(b, url=BASE + 'repo/', errs=errs); p.wait_for_selector('#f-name')
    p.wait_for_function("()=>navigator.serviceWorker.controller", timeout=15000)
    scope = p.evaluate("async()=>(await navigator.serviceWorker.getRegistration()).scope")
    check('works under /repo/: SW scope is the sub-folder', scope == BASE + 'repo/', scope)
    check('works under /repo/: shell cached and manifest reachable', p.evaluate("async()=>{const k=await caches.keys();const r=await fetch('manifest.webmanifest');return k.length===1&&r.ok}"))
    p.context.set_offline(True); p.reload(); p.wait_for_selector('#f-name', timeout=15000)
    check('works under /repo/: offline reload renders the welcome screen', p.locator('#f-name').count() == 1)
    check('works under /repo/: no console errors', not errs, errs)
    p.context.close(); srv.stop()

    # ---------- file:// ----------
    errs = []
    p = new_page(b, errs=errs); p.wait_for_selector('#f-name'); p.wait_for_timeout(500)
    check('file:// load: no service worker registered or controlling', p.evaluate("async()=>{if(!navigator.serviceWorker)return true;try{const r=await navigator.serviceWorker.getRegistrations();return r.length===0&&!navigator.serviceWorker.controller}catch(e){return !navigator.serviceWorker.controller}}") is True and p.evaluate("()=>window.__swReg") is None)
    check('file:// load: chip says Basic', p.inner_text('#ai-chip').strip() == 'Basic')
    check('file:// load: no console errors', not errs, errs)
    make_profile(p, 'F', 2000); quick(p, '2 roti')
    check('file:// load: logging works as before', p.locator('li.entry').count() == 1)
    goto(p, 'phone'); p.wait_for_timeout(500)
    check('file:// Check my phone: service worker row fails with the file explanation', p.get_attribute('#phone-list [data-id=sw]', 'data-status') == 'fail' and 'file' in p.inner_text('#phone-list [data-id=sw]'))
    p.context.close()
    b.close()

print('FAILED', res)
sys.exit(1 if res else 0)
