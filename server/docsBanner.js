const { HEIGHT_REPORTER_SCRIPT } = require('./heightReporter');

const BODY_OPEN_RE = /<body([^>]*)>/i;

// Classic javadoc's nav panes (packageListFrame / packageFrame — "All
// Packages" and "All Classes" in the left column) are always served from a
// file ending in "-frame.html" (overview-frame.html, allclasses-frame.html,
// or a per-package .../package-frame.html) — that's true no matter how deep
// the user clicks around inside them. Nothing else uses that naming
// pattern, and nothing in that pattern is ever shown as main/right-frame
// content, so it's a reliable, request-independent way to tell "this is a
// tiny nav pane" from "this is the main content the user is reading" —
// unlike browser signals such as Sec-Fetch-Dest, which stops helping after
// the first click within a frame.
const NAV_FRAME_FILE_RE = /-frame\.html$/i;

function isNavFramePane(relPath) {
  return NAV_FRAME_FILE_RE.test(relPath);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The vendored javadoc pages have zero awareness of this app — clicking a
// class/method link just navigates the browser straight to another static
// page, with no link back to our landing page or search. This bar restores
// that: home, unified search, and this SDK's own doc root.
//
// Deliberately no target attribute: this whole site is typically loaded
// inside Zendesk's embedded app iframe, and a plain link navigates
// whichever frame it's currently sitting in (the embed's own iframe, or a
// nested classFrame within an old-style frameset) — never breaking out to
// the top-level Zendesk tab or forcing a new browser tab, which is what an
// explicit target="_top"/"_blank" would do.
function buildBanner(sdk) {
  return `<div style="box-sizing:border-box;width:100%;height:32px;margin:0;position:sticky;top:0;z-index:2147483647;display:flex;align-items:center;gap:14px;padding:0 12px;background:#1a1a1a;color:#eee;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border-bottom:2px solid #0b5fff;overflow:hidden;white-space:nowrap;">
  <a href="/" style="color:#fff;text-decoration:none;font-weight:600;">🏠 Elo SDK Docs</a>
  <a href="/search" style="color:#9cc3ff;text-decoration:none;">🔍 Search</a>
  <a href="/docs/${escapeHtml(sdk.slug)}/index.html" style="color:#9cc3ff;text-decoration:none;">${escapeHtml(sdk.name)} home</a>
</div>`;
}

// Search results deep-link straight to a method's own anchor
// (#setNfcLedMode(...)) — without this, the browser's fragment-scroll
// would land the heading right under the sticky 32px banner, hiding it.
// scroll-padding-top applies to whichever element is the scrolling box
// (the root <html> for a normal page), which is why it's a global <style>
// rather than a style on the banner div itself.
const SCROLL_OFFSET_STYLE = '<style>html{scroll-padding-top:40px;}</style>';

// Injects the banner at the top of <body>. No-ops on pages without a
// <body> tag — that includes old-style javadoc's frameset index.html,
// which has no body of its own to inject into (its two child panes get
// handled individually as their own requests).
function injectBodyBanner(html, sdk) {
  if (!BODY_OPEN_RE.test(html)) return html;
  return html.replace(BODY_OPEN_RE, (match, attrs) => `<body${attrs}>${SCROLL_OFFSET_STYLE}${buildBanner(sdk)}${HEIGHT_REPORTER_SCRIPT}`);
}

// Classic javadoc leans on named-frame targeting throughout: target=
// "_top" on nearly every page's "Frames"/"No Frames" toggle (~400
// occurrences), one external target="_blank", and target="classFrame"/
// "packageFrame" for the nav pane to update its sibling content pane.
// _top/_blank try to escape the frame outright and got stripped first —
// but classFrame/packageFrame turned out to be just as unreliable once
// nested three iframes deep (Zendesk → the ZAF app → our doc frame →
// javadoc's own frameset): the browser's named-browsing-context lookup
// failed to find "classFrame" from within that stack, and per the HTML
// spec, a target name that resolves to nothing falls back to opening a
// *brand new top-level browsing context* — a fresh window running our
// ZAF app from scratch, landing on its default page rather than
// resuming the click. That's the actual mechanism behind "clicking a
// class opened a new window showing the home page," not a one-off bug.
//
// Rather than chase each named target as it fails in some new way,
// every target attribute is stripped, full stop. A target-less link
// always navigates whichever frame it's currently rendered in — no
// named-context lookup, so no possibility of the "nothing found, open a
// new window" fallback ever triggering again. The tradeoff: clicking a
// class in an old-style SDK's nav pane now replaces that pane's own
// content with the class page, instead of updating a sibling pane while
// the nav stays visible. Given the ticket sidebar is only ~300px wide
// to begin with, that's arguably the better layout anyway, not just the
// safe one.
const TARGET_ATTR_RE = /\s+target=["'][^"']*["']/gi;

function stripAllTargetAttributes(html) {
  return html.replace(TARGET_ATTR_RE, '');
}

module.exports = { isNavFramePane, injectBodyBanner, stripAllTargetAttributes };
