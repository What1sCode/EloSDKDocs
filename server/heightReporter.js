// Zendesk's resize() only accepts a literal pixel height — no "fill
// available space" mode (confirmed against Zendesk's own community
// reports: 100%/100vh on either side of that call are silently ignored).
// So the wrapping iframe.html (zaf-app/assets/iframe.html) can't just ask
// for "enough room" once; every page this app serves — the server-rendered
// landing/search pages and every static javadoc page — has to keep telling
// its parent frame its own real height so that call stays accurate as
// content changes (a new search result set, a different SDK's doc tree).
//
// Cross-origin (this app is on Railway, the Zendesk-hosted wrapper is on
// Zendesk's own CDN) rules out the wrapper reading our height directly —
// hence postMessage instead of DOM access.
const HEIGHT_REPORTER_SCRIPT = `<script>
(function () {
  if (window.top === window.self) return;
  var lastSent = -1;
  function report() {
    var h = Math.ceil(Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    ));
    if (Math.abs(h - lastSent) < 4) return;
    lastSent = h;
    window.parent.postMessage({ source: 'elo-sdk-docs', height: h }, '*');
  }
  window.addEventListener('load', report);
  window.addEventListener('resize', report);
  if (window.ResizeObserver) {
    new ResizeObserver(report).observe(document.documentElement);
  } else {
    setInterval(report, 500);
  }
  report();
})();
</script>`;

module.exports = { HEIGHT_REPORTER_SCRIPT };
