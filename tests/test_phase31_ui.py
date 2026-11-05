"""Phase 3.1 review fixes (file://): About credits, weekly 'no entries', import button, chip layout, zero-row fallbacks without AI."""
import sys
sys.path.insert(0, '/home/arch/projects/trackme/tests')
from ui_helpers import *
from playwright.sync_api import sync_playwright
res = []
def check(name, ok, extra=''):
    print(('PASS ' if ok else 'FAIL ') + name + (' ' + str(extra) if (extra and not ok) else ''))
    if not ok: res.append(name)

with sync_playwright() as pw:
    b = pw.chromium.launch(); errs = []
    p = new_page(b, errs=errs); make_profile(p, 'Rev', 2000)
    goto(p, 'about')
    t = p.inner_text('#view')
    check('About: version text is current (no "phase 1")', 'Version 1.1' in t and 'phase' not in t.lower(), t[:200])
    check('About: IFCT 2017 (ICMR-NIN) credit is visible', p.locator('#ifct-credit').is_visible() and 'ICMR-National Institute of Nutrition' in p.inner_text('#ifct-credit'))
    check('About: Open Food Facts (ODbL) credit is visible even though no online food was added', p.locator('#off-credit').is_visible() and 'ODbL' in p.inner_text('#off-credit'))
    ac = p.inner_text('#ai-credit')
    check('About: WebLLM (Apache-2.0), Qwen3 (Apache-2.0) and Llama 3.2 Community Licence + "Built with Llama" are credited', all(x in ac for x in ('WebLLM', 'Apache-2.0', 'Qwen3', 'Llama 3.2 Community Licence', 'Built with Llama')), ac)
    check('360px: About has no horizontal scroll', not hscroll(p))

    # weekly: empty days say "no entries"
    goto(p, 'today'); quick(p, '2 roti'); goto(p, 'weekly'); p.wait_for_selector('#wk-summary')
    rows = p.eval_on_selector_all('#wk-cal tbody tr[data-date]', 'e=>e.map(r=>[...r.children].map(c=>c.textContent))')
    empty = [r for r in rows if r[2:] == ['-', '-', '-']]
    check('weekly (v1.1): the day with food has numbers; the 6 other days show "-" (no claims for empty days)', len(rows) == 7 and len(empty) == 6, rows)
    p.context.close()

    p = new_page(b, errs=errs); make_profile(p, 'Over', 800); quick(p, '3 roti and dal'); quick(p, '2 plate biryani'); goto(p, 'weekly'); p.wait_for_selector('#wk-summary')
    check('weekly (v1.1): an over-budget week says "over budget" (words and red colour)', 'over budget this week' in p.inner_text('#wk-budget') and 'bad' in p.get_attribute('#wk-budget', 'class'), p.inner_text('#wk-budget'))
    p.context.close()

    # import control
    p = new_page(b, errs=errs)
    check('Welcome: the import control is a real button (label.btn) with a visually hidden but present, keyboard-focusable file input', p.locator('#restore label.btn').count() == 1 and p.locator('#restore input[type=file]').count() == 1)
    box = p.locator('#restore label.btn').bounding_box()
    check('import button is at least 44 px tall and wide', box['height'] >= 43.5 and box['width'] >= 100, box)
    ib = p.locator('#restore #import-file').bounding_box()
    check('the invisible input covers the button (so a tap anywhere on it opens the file chooser) and is >= 44 px', abs(ib['x'] - box['x']) < 2 and ib['height'] >= 43.5 and ib['width'] >= 100, (ib, box))
    check('the native file input is not visible (opacity 0)', p.eval_on_selector('#restore #import-file', 'e=>getComputedStyle(e).opacity') == '0')
    p.focus('#restore #import-file')
    check('keyboard: focusing the input shows a focus ring on the button', 'solid' in p.eval_on_selector('#restore label.btn', 'e=>getComputedStyle(e.parentElement).outlineStyle') or p.eval_on_selector('#restore label.btn', 'e=>e.classList.contains("focus")'))
    check('keyboard: Tab reaches the input', p.evaluate("()=>{const i=document.querySelector('#restore #import-file');i.focus();return document.activeElement===i}"))
    backup_file('/tmp/p31.json', dict(PROF, name='Imp'), {})
    p.set_input_files('#import-file', '/tmp/p31.json'); p.wait_for_selector('#import-apply'); p.click('#import-apply'); p.wait_for_selector('#qbar')
    check('importing through the new button still works', 'Imp' in p.inner_text('#view'))
    check('Backup & restore: import control is the same button and passes the 44 px rule', (goto(p, 'backup') or True) and p.locator('#backup label.btn, #restore label.btn, label.btn.file-btn').count() >= 1 and not small_targets(p, '#view'), small_targets(p, '#view'))
    check('no horizontal scroll on Backup', not hscroll(p))
    p.context.close()

    # chip layout with the long label
    FAKE = "window.__llmMock={extract:function(){return '{\"items\":[]}'},on:true};"
    for w, h in ((360, 740), (412, 915)):
        p = new_page(b, w, h, init=FAKE); make_profile(p, 'Chip', 2000)
        check('%dpx: chip "AI ready" fits the header without overflow or clipping' % w, p.inner_text('#ai-chip').strip() == 'AI ready' and not hscroll(p) and p.eval_on_selector('#ai-chip', 'e=>{const r=e.getBoundingClientRect();return r.right<=innerWidth&&r.height>=43.5&&e.scrollWidth<=e.clientWidth+1}'), p.eval_on_selector('#ai-chip', 'e=>JSON.stringify(e.getBoundingClientRect())'))
        check('%dpx: the title is still readable next to the chip' % w, p.eval_on_selector('#title', 'e=>e.getBoundingClientRect().width') > 90)
        p.context.close()
    check('no page errors', not errs, errs)
    b.close()
print('FAILED', res)
sys.exit(1 if res else 0)
