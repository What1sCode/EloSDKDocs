const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { DOCS_ROOT, listSdks, MISSING_FROM_DEV_ZONE } = require('./sdks');
const { createSearchIndex } = require('./searchIndex');
const { landingPage, searchPage } = require('./views');
const { isNavFramePane, findFramesetContentTarget, injectBodyBanner, stripAllTargetAttributes } = require('./docsBanner');
const { router: authRouter, requireSession, authIsConfigured } = require('./auth');

const PORT = process.env.PORT || 3000;

// Which parent origins are allowed to iframe this app. 
// Using '*' ensures sandboxed iframes in Zendesk Agent Workspace 
// (which have an opaque/null origin) are allowed to embed the application.
const FRAME_ANCESTORS = '*';

const app = express();
app.disable('x-powered-by');

// Health check runs before auth so Railway's healthcheck doesn't need creds.
app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.use(
  helmet({
    // Disabling X-Frame-Options to allow framing in Zendesk
    frameguard: false,
    // Cross-Origin-Resource-Policy set to cross-origin to permit iframe loading
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'frame-ancestors': FRAME_ANCESTORS.split(' '),
        // Inline scripts are required for legacy Javadoc frame navigation
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"]
      }
    }
  })
);

app.use(cookieParser());

// Auth routes must stay reachable while unauthenticated — they're how a
// session gets established in the first place.
app.use('/auth', authRouter);

if (!authIsConfigured()) {
  console.warn(
    '[elo-sdk-docs] Zendesk OAuth is not fully configured (missing one or more of ' +
      'ZENDESK_SUBDOMAIN, ZENDESK_OAUTH_CLIENT_ID, ZENDESK_OAUTH_CLIENT_SECRET, ' +
      'ZENDESK_REDIRECT_URI, SESSION_SIGNING_SECRET) — every request past /healthz and ' +
      '/auth will fail closed until these are set.'
  );
}

// Prevent stale cached versions across deployments
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Everything below this line requires a valid Zendesk-verified session.
app.use(requireSession);

const sdks = listSdks();
const index = createSearchIndex();
console.log(`[elo-sdk-docs] indexed ${index.documentCount} entries (pages + methods/fields) across ${sdks.length} SDK(s).`);

// --- Root / Landing Page (Fixed to handle ?suggest= and query parameters safely) ---
app.get('/', (req, res) => {
  try {
    const suggest = (req.query.suggest || req.query.q || '').toString();
    res.send(
      landingPage({
        sdks,
        documentCount: index.documentCount,
        missingFromDevZone: MISSING_FROM_DEV_ZONE,
        suggest
      })
    );
  } catch (err) {
    console.error('[elo-sdk-docs] Error rendering landing page:', err);
    res.status(500).send('Internal Server Error while rendering landing page: ' + err.message);
  }
});

// --- Search Page ---
app.get('/search', (req, res) => {
  try {
    res.send(searchPage());
  } catch (err) {
    console.error('[elo-sdk-docs] Error rendering search page:', err);
    res.status(500).send('Internal Server Error while rendering search page: ' + err.message);
  }
});

// --- API Endpoints ---
app.get('/api/sdks', (req, res) => {
  res.json(sdks.map(({ slug, name, description }) => ({ slug, name, description })));
});

app.get('/api/search', (req, res) => {
  try {
    const q = (req.query.q || '').toString();
    const sdk = (req.query.sdk || '').toString() || undefined;
    res.json(index.search(q, { sdk }));
  } catch (err) {
    console.error('[elo-sdk-docs] Search API error:', err);
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

const sdksBySlug = new Map(sdks.map((sdk) => [sdk.slug, sdk]));

// Serve javadoc/help HTML pages with the navigation banner injected
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

    // Classic frameset shells (index.html on old-style javadoc) have no
    // <body> to inject a banner into and would otherwise render as native
    // split frames. Redirect straight to the frameset's own content pane
    // instead, matching the single-pane experience every other SDK has.
    const frameTarget = findFramesetContentTarget(html);
    if (frameTarget) {
      const relDir = path.posix.dirname(relPath.replace(/\\/g, '/'));
      const resolved = relDir === '.' ? frameTarget : `${relDir}/${frameTarget}`;
      return res.redirect(302, `/docs/${sdk.slug}/${resolved}`);
    }

    const safeHtml = stripAllTargetAttributes(html);
    res.type('html').send(isNavFramePane(relPath) ? safeHtml : injectBodyBanner(safeHtml, sdk));
  });
});

// Static assets (CSS, images, JS, unhandled docs)
app.use('/docs', express.static(DOCS_ROOT, { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`[elo-sdk-docs] listening on :${PORT}`);
});
