"""Manual eval (not a test suite): runs REAL WebLLM in headless Chromium against the served site and prints what the AI path gives for each text.
Usage: .venv/bin/python tests/eval_real_model.py [cases.json] [profile_dir]   (site served at http://localhost:8792/; model weights are cached in profile_dir)
WebGPU here is SwiftShader (software, no shader-f16 -> the q4f32 model), so it is slow; a real GPU needs a Vulkan driver."""
import sys, json, time, re
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import goto
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8792/index.html'
cases = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/home/arch/projects/trackme/docs/real_cases.json'))
prof = sys.argv[2] if len(sys.argv) > 2 else '/tmp/claude-1000/-home-arch-projects-trackme/46f407c9-d405-4053-9938-ae0702e6983c/scratchpad/eval-profile'
def log(*a): print(time.strftime('%H:%M:%S'), *a, flush=True)
with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(prof, headless=True, viewport={'width': 412, 'height': 915},
        args=['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    ctx.add_init_script('window.__llmTimeoutMs=1500000')  # software GPU is far slower than a phone: never time out
    p = ctx.pages[0] if ctx.pages else ctx.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append(str(e))); p.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
    p.goto(BASE)
    if p.locator('#f-name').count():
        p.fill('#f-name', 'Eval'); p.fill('#f-dob', '1990-01-01'); p.fill('#f-height', '170'); p.fill('#f-weight', '70'); p.click('#save-profile'); p.wait_for_selector('#qbar')
    gpu = p.evaluate("""async()=>{const a=await navigator.gpu.requestAdapter();return a?{arch:a.info&&a.info.architecture,f16:a.features.has('shader-f16'),maxBuf:a.limits.maxBufferSize,maxStor:a.limits.maxStorageBufferBindingSize}:null}""")
    log('GPU', gpu)
    goto(p, 'ai'); p.wait_for_selector('#ai-card-0'); log('model card:', p.get_attribute('#ai-card-0', 'data-model'), '| button:', p.inner_text('#ai-dl-0'))
    t0 = time.time()
    def ev(js, d=''):
        try: return p.evaluate(js)
        except Exception: return d
    if (ev("document.querySelector('#ai-dl-0')&&document.querySelector('#ai-dl-0').textContent") or '').strip() != 'Loaded':
        p.click('#ai-dl-0'); last = ''
        while time.time() - t0 < 2400:
            txt = (ev("(document.querySelector('#ai-card-0')||{}).innerText||''") or '').replace('\n', ' | ')[:150]
            if txt != last: log('AI card:', txt); last = txt
            chip = ev("(document.querySelector('#ai-chip')||{}).textContent||''")
            if 'AI ready' in chip or (ev("(document.querySelector('#ai-dl-0')||{}).textContent||''") or '').strip() == 'Loaded': break
            if 'could not' in txt.lower() or 'not enough' in txt.lower(): break
            p.wait_for_timeout(3000)
    log('load phase took %.0f s; chip: %s' % (time.time() - t0, ev("(document.querySelector('#ai-chip')||{}).textContent||'?'")))
    goto(p, 'today'); p.wait_for_selector('#qbar')
    for t in cases:
        t1 = time.time(); p.fill('#ql', t); p.click('#ql-send'); p.wait_for_selector('#pv-sheet')
        while time.time() - t1 < 900:  # plain polling: Playwright's string waits are blocked by the app's CSP
            ai = ev("(document.querySelector('#pv-ai')||{}).innerText||''")
            if re.search(r'Read with on-device AI|could not|Using the built-in|read \d+ of', ai) : break
            p.wait_for_timeout(1500)
        p.wait_for_timeout(800)
        rows = p.eval_on_selector_all('#pv-rows .pv-row', 'e=>e.map(x=>x.innerText.replace(/\\n/g," | "))')
        log('=== %.0f s | %r' % (time.time() - t1, t.replace('\n', ' / ')[:90])); log('   AI status:', (ai or '(none)').replace('\n', ' ')[:220])
        for r in rows: log('   ', r[:170])
        p.click('#pv-cancel'); p.wait_for_timeout(400)
    goto(p, 'ai'); p.wait_for_timeout(400)
    if p.locator('#ai-last').count(): log('LAST AI PROBLEM:', p.inner_text('#ai-last')[:600])
    log('page errors:', errs[:5]); ctx.close()
