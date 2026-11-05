"""Phase 3 screenshots into journable/shots/ (360x740 and 412x915, light and dark): model manager, Check my phone, update banner, AI preview strip."""
import sys, re, shutil, tempfile
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
import serve_dist
from playwright.sync_api import sync_playwright
OUT = '/home/arch/projects/trackme/shots/'
MANAGED = """
window.__mm = {cached: JSON.parse(localStorage.getItem('mm_cached') || '{}'), loads: [], removes: [], cancels: 0};
window.__llmAnswers = {};
window.__llmMock = { extract: function (t) { var a = window.__llmAnswers[t]; return a === 'hang' ? new Promise(function () {}) : (a || '{"items":[]}'); },
  has: function (id) { return !!window.__mm.cached[id]; }, remove: function (id) { window.__mm.cached[id] = false; localStorage.setItem('mm_cached', JSON.stringify(window.__mm.cached)); }, cancelLoad: function () {},
  load: function (id, prog) { return new Promise(function (res, rej) { window.__mm.prog = prog; window.__mm.ok = function () { window.__mm.cached[id] = true; localStorage.setItem('mm_cached', JSON.stringify(window.__mm.cached)); res(); }; window.__mm.fail = function (m) { rej(new Error(m)); }; }); } };"""
GPU = "Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:()=>Promise.resolve({features:new Set(['shader-f16']),limits:{maxBufferSize:2147483648},info:{vendor:'qualcomm',architecture:'adreno-740',device:'',description:''}})}});Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});"
NOF16 = "Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:()=>Promise.resolve({features:new Set(),limits:{maxBufferSize:2147483648,maxStorageBuffersPerShaderStage:10},info:{vendor:'qualcomm',architecture:'adreno-610'}})}});"
srv = serve_dist.start(port=8766)
BASE = 'http://localhost:8766/'
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h) in ((360, 740), (412, 915)):
        for scheme in ('light', 'dark'):
            tag = '%dx%d-%s' % (w, h, scheme)
            p = new_page(b, w, h, scheme, url=BASE, init=MANAGED + GPU); make_profile(p, 'Asha', 2000)
            goto(p, 'ai'); p.wait_for_selector('#ai-card-0'); p.wait_for_timeout(400)
            p.screenshot(path=OUT + 'p3-ai-idle-' + tag + '.png', full_page=True)
            p.click('#ai-dl-0'); p.wait_for_selector('#ai-cancel'); p.evaluate("()=>window.__mm.prog(0.43,'x')"); p.wait_for_timeout(200)
            p.screenshot(path=OUT + 'p3-ai-downloading-' + tag + '.png', full_page=True)
            p.evaluate("()=>window.__mm.fail('Out of memory')"); p.wait_for_selector('#ai-err'); p.click('#ai-dl-1'); p.wait_for_selector('#ai-cancel'); p.evaluate("()=>window.__mm.fail('Out of memory')"); p.wait_for_timeout(200)
            p.screenshot(path=OUT + 'p3-ai-error-' + tag + '.png', full_page=True)
            p.click('#ai-dl-0'); p.wait_for_selector('#ai-cancel'); p.evaluate("()=>window.__mm.ok()"); p.wait_for_selector('#ai-del-0'); p.wait_for_timeout(300)
            p.screenshot(path=OUT + 'p3-ai-ready-' + tag + '.png', full_page=True)
            goto(p, 'phone'); p.wait_for_timeout(1500)
            p.screenshot(path=OUT + 'p3-phone-' + tag + '.png', full_page=True)
            goto(p, 'today')
            T = 'protein shake 300ml, 2 roti'
            p.evaluate("([t,a])=>{window.__llmAnswers[t]=a}", [T, 'hang'])
            p.fill('#ql', T); p.click('#ql-send'); p.wait_for_selector('#pv-ai-busy'); p.wait_for_timeout(300)
            p.screenshot(path=OUT + 'p3-preview-ai-busy-' + tag + '.png')
            p.click('#pv-ai-cancel'); p.wait_for_timeout(300)
            p.screenshot(path=OUT + 'p3-preview-ai-cancelled-' + tag + '.png')
            p.click('#pv-cancel')
            p.context.close()
            p = new_page(b, w, h, scheme, url=BASE, init=MANAGED + NOF16); make_profile(p, 'Asha', 2000)
            goto(p, 'ai'); p.wait_for_selector('#ai-card-0'); p.wait_for_timeout(500)
            p.screenshot(path=OUT + 'p3-ai-nof16-' + tag + '.png', full_page=True)
            p.click('#ai-dl-0'); p.wait_for_selector('#ai-cancel'); p.evaluate("()=>window.__mm.ok()"); p.wait_for_selector('#ai-del-0'); goto(p, 'today'); p.wait_for_timeout(300)
            p.screenshot(path=OUT + 'p3-chip-ready-' + tag + '.png')
            p.fill('#ql', 'qqqq zzzz'); p.click('#ql-send'); p.wait_for_selector('#pv-sheet'); p.wait_for_timeout(500)
            p.screenshot(path=OUT + 'p3-zero-rows-' + tag + '.png')
            p.context.close()
    # update banner
    tmp = tempfile.mkdtemp(); site = tmp + '/site'; serve_dist.copy_site(site)
    srv.stop(); srv = serve_dist.start(site, port=8766)
    for (w, h) in ((360, 740), (412, 915)):
        for scheme in ('light', 'dark'):
            tag = '%dx%d-%s' % (w, h, scheme)
            p = new_page(b, w, h, scheme, url=BASE); make_profile(p, 'Asha', 2000); quick(p, '2 roti and dal for lunch')
            p.wait_for_function("()=>navigator.serviceWorker.controller", timeout=15000)
            t = open(site + '/sw.js').read(); open(site + '/sw.js', 'w').write(re.sub(r"VERSION = '[0-9a-f]{10}'", "VERSION = '%010x'" % (abs(hash(tag)) % 16**10), t))
            p.evaluate("()=>window.__swReg.update()"); p.wait_for_selector('#update-chip', timeout=15000); p.wait_for_timeout(400)
            p.screenshot(path=OUT + 'p3-update-' + tag + '.png')
            p.context.close()
    # backup screen with the storage protection line
    p = new_page(b, 360, 740, 'light', url=BASE); make_profile(p, 'Asha', 2000); quick(p, '1 banana'); p.wait_for_timeout(300); goto(p, 'backup'); p.wait_for_timeout(300)
    p.screenshot(path=OUT + 'p3-backup-360x740-light.png', full_page=True)
    b.close()
srv.stop()
print('ok')
