"""Run an existing suite against http://localhost:8765 (secure context, service worker active) instead of file://.
Usage: python3 tests/run_http.py test_app"""
import sys, os, runpy
sys.path.insert(0, '/home/arch/projects/trackme/tests')
import serve_dist
os.environ['JOURNABLE_URL'] = serve_dist.BASE
srv = serve_dist.start()
try:
    runpy.run_path('/home/arch/projects/trackme/tests/%s.py' % sys.argv[1], run_name='__main__')
except SystemExit as e:
    srv.stop(); raise
srv.stop()
