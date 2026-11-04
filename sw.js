/* Journable service worker: app-shell cache only.
   - cache name is journable-shell-v<hash>, the hash is injected by scripts/build.py from the shell files
   - same-origin GET requests only; anything cross-origin (Hugging Face, Open Food Facts, ...) is never touched
   - only caches whose names start with "journable-shell-" are ever deleted
   - the optional AI library (vendor/web-llm/web-llm.js) lives in its OWN cache, journable-lib, which is never versioned or deleted by an update,
     so on-device AI keeps working offline after an update (it is refreshed on install when the user has used AI)
   - a new version waits until the page asks it to take over (message {type:'SKIP_WAITING'}) so the user taps "Update ready" */
var VERSION = '00baf07f55';
var CACHE = 'journable-shell-v' + VERSION;
var SHELL = ['./index.html', './app.js', './app.css', './manifest.webmanifest', './icons/icon.svg', './icons/192.png', './icons/512.png', './llm-worker.js', './probe-worker.js'];
var LIB = 'journable-lib';
var LIBRX = /\/vendor\/web-llm\/web-llm\.js$/;          /* big, cached the first time it is used */
var LAZY = LIBRX;
var SKIP = /\/vendor\/web-llm\/libs\//;              /* model libraries are cached by WebLLM itself */

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () {
    /* refresh the AI library only if the user already has it cached; failures are ignored (the old copy keeps working) */
    return caches.has(LIB).then(function (has) {
      if (!has) return;
      return caches.open(LIB).then(function (c) { return fetch('./vendor/web-llm/web-llm.js', { cache: 'reload' }).then(function (r) { if (r && r.ok) return c.put('./vendor/web-llm/web-llm.js', r); }); });
    }).catch(function () {});
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('journable-shell-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
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
        return fetch(req).then(function (res) { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; });
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
