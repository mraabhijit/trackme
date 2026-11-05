"""Render src/icon.svg and src/icon-maskable.svg to PNGs in src/icons/ with Playwright (run once; PNGs are committed)."""
import os
from playwright.sync_api import sync_playwright
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(R + '/src/icons', exist_ok=True)
JOBS = [('icon.svg', 192, 'icon-192.png'), ('icon.svg', 512, 'icon-512.png'), ('icon-maskable.svg', 512, 'icon-maskable-512.png')]
with sync_playwright() as pw:
    b = pw.chromium.launch(); 
    for svg, size, out in JOBS:
        p = b.new_page(viewport={'width': size, 'height': size})
        data = open(R + '/src/' + svg, encoding='utf-8').read()
        p.set_content('<html><body style="margin:0;background:transparent">' + data.replace('<svg ', '<svg width="%d" height="%d" ' % (size, size), 1) + '</body></html>')
        p.screenshot(path=R + '/src/icons/' + out, omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
        p.close()
    b.close()
print('icons ok')
