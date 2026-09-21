/* Non-blocking CSS loader for the critical landing shell.
   Vite emits CSS as preload links with data-defer-css (see scripts/defer-css.mjs).
   This tiny external script is CSP-safe (script-src 'self') and avoids inline
   onload handlers, then upgrades the links to real stylesheets after parsing. */
(function () {
  function load() {
    var links = document.querySelectorAll('link[data-defer-css]');
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      if (l.rel !== 'stylesheet') {
        l.rel = 'stylesheet';
        l.removeAttribute('as');
        l.removeAttribute('data-defer-css');
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();
