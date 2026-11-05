/* TrackMe service worker: app-shell cache only.
   - cache name is trackme-shell-v<hash> (older installs used journable-shell-v<hash>), the hash is injected by scripts/build.py from the shell files
   - same-origin GET requests only; anything cross-origin (Hugging Face, Open Food Facts, ...) is never touched
   - only caches whose names start with "trackme-shell-" or the old "journable-shell-" are ever deleted
   - the optional AI library (vendor/web-llm/web-llm.js) lives in its OWN cache, journable-lib (name kept so a downloaded AI library is not orphaned), which is never versioned or deleted by an update,
     so on-device AI keeps working offline after an update (it and pdf.js are refreshed on install when the app update brings new lib files, see refreshLib)
   - a new version waits until the page asks it to take over (message {type:'SKIP_WAITING'}) so the user taps "Update ready" */
var VERSION = 'afb0284d69';
var CACHE = 'trackme-shell-v' + VERSION;
var SHELL = ['./index.html', './app.js', './app.css', './manifest.webmanifest', './icons/icon.svg', './icons/192.png', './icons/512.png', './llm-worker.js', './probe-worker.js', './early.js', './report.js'];
var LIB = 'journable-lib';
var LIBRX = /\/vendor\/(web-llm\/web-llm\.js|pdfjs\/pdf(\.worker)?\.min\.mjs)$/;          /* big, cached the first time it is used */
var LAZY = LIBRX;
var SKIP = /\/vendor\/web-llm\/libs\//;              /* model libraries are cached by WebLLM itself */

/* The cached copies in journable-lib (web-llm.js, pdf.js and its worker) carry a version marker (hash of the vendored files, injected by scripts/build.py).
   On install, if the marker differs (or is missing: older installs), every lib file that is cached is fetched again; the copies are replaced only if ALL downloads worked,
   so pdf.min.mjs and its worker never come from different versions. Nothing is deleted, and model weights / model libraries (cached by WebLLM) are never touched. Failures are ignored (the old copy keeps working). */
var LIBVER = '708f38231a33';
var MARK = './__lib-version';
function refreshLib() {
  return caches.has(LIB).then(function (has) {
    if (!has) return;
    return caches.open(LIB).then(function (c) {
      return c.match(MARK).then(function (m) { return m ? m.text() : ''; }).then(function (v) {
        if (v === LIBVER) return;
        return c.keys().then(function (keys) {
          var rs = keys.filter(function (r) { return LIBRX.test(new URL(r.url).pathname); });
          return Promise.all(rs.map(function (r) { return fetch(new Request(r.url, { cache: 'reload' })).then(function (x) { if (!x || !x.ok || x.type !== 'basic') throw new Error('refresh'); return x; }); })).then(function (res) {
            return Promise.all(res.map(function (x, i) { return c.put(rs[i], x); })).then(function () { return c.put(MARK, new Response(LIBVER)); });
          });
        });
      });
    });
  }).catch(function () {});
}
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(refreshLib));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return (k.indexOf('journable-shell-') === 0 || k.indexOf('trackme-shell-') === 0) && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: VERSION });
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          /* never intercept cross-origin */
  if (SKIP.test(url.pathname)) return;
  if (req.headers.has('range')) return;
  if (LIBRX.test(url.pathname)) {
    e.respondWith(caches.open(LIB).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) { if (res && res.ok && res.type === 'basic') { cache.put(req, res.clone()); cache.match(MARK).then(function (m) { if (!m) cache.put(MARK, new Response(LIBVER)); }); } return res; });
      });
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function (cache) {
    var key = req.mode === 'navigate' ? './index.html' : req;
    return cache.match(key, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic' && req.mode === 'navigate') { cache.put('./index.html', res.clone()); }
        return res;
      });
    });
  }));
});
