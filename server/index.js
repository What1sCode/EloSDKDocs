const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const basicAuth = require('express-basic-auth');

const { DOCS_ROOT, listSdks, MISSING_FROM_DEV_ZONE } = require('./sdks');
const { createSearchIndex } = require('./searchIndex');
const { landingPage, searchPage } = require('./views');
const { isNavFramePane, injectBodyBanner, stripAllTargetAttributes } = require('./docsBanner');

const PORT = process.env.PORT || 3000;

// Which parent origins are allowed to iframe this app. https://*.zendesk.com
// still didn't work ("refused to connect" persisted) because Zendesk's
// Agent Workspace loads private apps in a sandboxed iframe *without*
// allow-same-origin — that gives the app frame an opaque/null origin, and
// per the CSP spec, ordinary source expressions (scheme+host, even with a
// wildcard host) never match an opaque origin. Only the literal '*' token
// does. There's no longer a Basic Auth layer to lean on either (removed —
// access is via Zendesk SSO reaching the embed in the first place), so
// this is effectively "anyone with the link," same posture as the docs
// site itself now.
const FRAME_ANCESTORS = '*';

const app = express();

app.disable('x-powered-by');

// Health check runs before auth so Railway's healthcheck doesn't need creds.
app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.use(
  helmet({
    // Disabling the classic X-Frame-Options header (defaults to
    // SAMEORIGIN) is required so Zendesk can iframe this app; CSP
    // frame-ancestors below is the modern replacement and is scoped
    // to Zendesk + self only.
    frameguard: false,
    // Helmet's default Cross-Origin-Resource-Policy: same-origin also
    // blocks cross-origin iframe embedding, independently of CSP
    // frame-ancestors and X-Frame-Options — this was the actual cause of
    // Zendesk's "refused to connect" even after frame-ancestors was
    // widened. 'cross-origin' hands embedding control entirely to CSP
    // frame-ancestors, which is what should be gating it.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'frame-ancestors': FRAME_ANCESTORS.split(' '),
        // The javadoc/help pages themselves ship inline <script> blocks
        // (frame navigation, the built-in search.js bootstrap on the
        // newer SDK docs). They're our own vetted, static content — not
        // user input — so 'unsafe-inline' here is a reasonable tradeoff
        // to keep that tooling working rather than a real XSS exposure.
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"]
      }
    }
  })
);

const DOCS_USER = process.env.DOCS_USER;
const DOCS_PASS = process.env.DOCS_PASS;

if (DOCS_USER && DOCS_PASS) {
  app.use(
    basicAuth({
      users: { [DOCS_USER]: DOCS_PASS },
      challenge: true,
      realm: 'Elo SDK Docs'
    })
  );
} else {
  console.warn(
    '[elo-sdk-docs] DOCS_USER / DOCS_PASS not set — serving without basic auth. Set both env vars to enable access control.'
  );
}

// This app has been iterated on quickly (frame-embedding/CSP behavior
// changed across several deploys), and a stale cached copy of a page is
// indistinguishable from an actual regression when debugging "it behaves
// differently on another machine." No-store everywhere removes that
// variable entirely — low cost for a low-traffic internal tool.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const sdks = listSdks();
const index = createSearchIndex();
console.log(`[elo-sdk-docs] indexed ${index.documentCount} entries (pages + methods/fields) across ${sdks.length} SDK(s).`);

app.get('/', (req, res) => {
  res.send(landingPage({ sdks, documentCount: index.documentCount, missingFromDevZone: MISSING_FROM_DEV_ZONE }));
});

app.get('/search', (req, res) => {
  res.send(searchPage());
});

app.get('/api/sdks', (req, res) => {
  res.json(sdks.map(({ slug, name, description }) => ({ slug, name, description })));
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toString();
  const sdk = (req.query.sdk || '').toString() || undefined;
  res.json(index.search(q, { sdk }));
});

const sdksBySlug = new Map(sdks.map((sdk) => [sdk.slug, sdk]));

// Serve javadoc/help HTML pages with a "back to home/search" banner, since
// the vendored docs have no idea this app wraps them. Every other static
// asset (css/js/images) is served as-is below.
//
// Old-style javadoc's nav panes (*-frame.html — "All Packages"/"All
// Classes" in the left column) are skipped: they're meant to stay as
// plain package/class lists, and a banner crammed into that narrow column
// would just get duplicated on every pane. Everything else — the main
// content frame's pages (however many clicks deep) and the modern
// non-framed SDK docs — gets the banner. See docsBanner.js for why a
// filename check beats trying to detect frame context per-request.
app.get(/^\/docs\/([^/]+)\/(.+\.html?)$/i, (req, res, next) => {
  const sdk = sdksBySlug.get(req.params[0]);
  if (!sdk) return next();

  const relPath = req.params[1];
  const filePath = path.join(sdk.path, relPath);
  if (!filePath.startsWith(sdk.path + path.sep)) {
    return res.status(400).send('Bad path');
  }

  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return next();
    const safeHtml = stripAllTargetAttributes(html);
    res.type('html').send(isNavFramePane(relPath) ? safeHtml : injectBodyBanner(safeHtml, sdk));
  });
});

// Static javadoc/help trees for each SDK, e.g. /docs/eloviewhomesdk/index.html
app.use('/docs', express.static(DOCS_ROOT, { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`[elo-sdk-docs] listening on :${PORT}`);
});
