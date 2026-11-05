"""Serve a directory (default: the repo root, which is the deployed site) on http://localhost:8765 (a secure context) for the PWA/LLM tests."""
import http.server, socketserver, threading, os, functools, mimetypes
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('application/wasm', '.wasm')
DIST = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # repo root = the built site (name kept for the tests)
SITE_ITEMS = {'index.html', 'app.js', 'app.css', 'sw.js', 'manifest.webmanifest', 'llm-worker.js', 'probe-worker.js', 'early.js', 'report.js',
              'icons', 'vendor', 'README.md', 'CHANGELOG.md', '.nojekyll'}

def copy_site(dst, skip_libs=True):
    """copy only the site files (what trackme-site.zip holds), by default without the big model libs"""
    import shutil
    def ign(d, names):
        out = [n for n in names if d == DIST and n not in SITE_ITEMS]
        return out + [n for n in names if skip_libs and n == 'libs']
    shutil.copytree(DIST, dst, ignore=ign)
PORT = 8765
BASE = 'http://localhost:%d/' % PORT

class _H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

class Server:
    def __init__(self, directory=DIST, port=PORT):
        socketserver.ThreadingTCPServer.allow_reuse_address = True
        self.httpd = socketserver.ThreadingTCPServer(('127.0.0.1', port), functools.partial(_H, directory=directory))
        self.httpd.daemon_threads = True
        self.t = threading.Thread(target=self.httpd.serve_forever, daemon=True); self.t.start()
    def stop(self):
        self.httpd.shutdown(); self.httpd.server_close()

def start(directory=DIST, port=PORT): return Server(directory, port)
