/* Runs before first paint: applies the saved text size and theme so the page never flashes at the wrong size. */
(function () {
  try {
    var o = JSON.parse(localStorage.getItem('dt:v1:ui') || '{}') || {}, r = document.documentElement;
    var sizes = { small: 13, medium: 14, large: 16, xlarge: 18 };
    r.style.fontSize = (sizes[o.fontSize] || 14) + 'px';
    if (o.theme === 'light' || o.theme === 'dark') { r.setAttribute('data-theme', o.theme); r.style.colorScheme = o.theme; }
  } catch (e) {}
})();
