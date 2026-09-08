const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

const {
  ZENDESK_SUBDOMAIN,
  ZENDESK_OAUTH_CLIENT_ID,
  ZENDESK_OAUTH_CLIENT_SECRET,
  ZENDESK_REDIRECT_URI,
  SESSION_SIGNING_SECRET
} = process.env;

const SESSION_COOKIE = 'docs_session';
const STATE_COOKIE = 'oauth_state';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
// Classic Zendesk OAuth scope for the core Support API (which /api/v2/users/me.json
// belongs to). The newer per-resource scopes (e.g. "users:read") apply to Zendesk's
// separate AI Agents platform, not this endpoint.
const OAUTH_SCOPE = 'read';

function authIsConfigured() {
  return Boolean(
    ZENDESK_SUBDOMAIN &&
      ZENDESK_OAUTH_CLIENT_ID &&
      ZENDESK_OAUTH_CLIENT_SECRET &&
      ZENDESK_REDIRECT_URI &&
      SESSION_SIGNING_SECRET
  );
}

function zendeskBaseUrl() {
  return `https://${ZENDESK_SUBDOMAIN}.zendesk.com`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function signInPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sign in — Elo SDK Docs</title>
<style>
  html, body { margin: 0; height: 100%; display: flex; align-items: center; justify-content: center; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .box { text-align: center; padding: 24px; }
  button { background: #1f73b7; color: #ffffff; border: 0; border-radius: 4px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
  button:hover { background: #175d92; }
  p { color: #68737d; font-size: 12px; }
</style>
</head>
<body>
  <div class="box">
    <p id="prompt">Sign in with your Zendesk account to view Elo SDK docs.</p>
    <button id="signin">Sign in with Zendesk</button>
  </div>
  <script>
    document.getElementById('signin').addEventListener('click', function () {
      var popup = window.open('/auth/start', 'eloSdkDocsAuth', 'width=520,height=680');
      document.getElementById('prompt').textContent = 'Waiting for sign-in to complete...';

      // Poll our own session state rather than watching the popup window
      // directly. Zendesk's login pages set Cross-Origin-Opener-Policy,
      // which severs window.opener the moment the popup navigates there —
      // so popup.closed can't be trusted to fire once that happens, even
      // though the popup itself closes fine and sign-in succeeds.
      var pollTimer = setInterval(function () {
        fetch('/auth/status', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.authenticated) {
              clearInterval(pollTimer);
              window.location.reload();
            }
          })
          .catch(function () {});
      }, 1500);

      // Stop polling eventually if something went wrong and the popup was
      // abandoned, so we're not polling forever in a forgotten tab.
      setTimeout(function () { clearInterval(pollTimer); }, 5 * 60 * 1000);
    });
  </script>
</body>
</html>`;
}

function callbackPage(message, isError) {
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: ${isError ? '#c0392b' : '#2f3941'};">
  <p>${escapeHtml(message)}</p>
  ${isError ? '<p>You can close this window and try again.</p>' : '<script>window.close();</script>'}
</body>
</html>`;
}

const router = express.Router();

router.get('/start', (req, res) => {
  if (!authIsConfigured()) {
    return res.status(500).send('OAuth is not configured on this server.');
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000
  });

  const authorizeUrl = new URL(`${zendeskBaseUrl()}/oauth/authorizations/new`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', ZENDESK_OAUTH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', ZENDESK_REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', OAUTH_SCOPE);
  authorizeUrl.searchParams.set('state', state);

  res.redirect(authorizeUrl.toString());
});

router.get('/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.status(400).send(callbackPage(`Sign-in failed: ${errorDescription || error}`, true));
  }

  const expectedState = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);
  if (!state || !expectedState || state !== expectedState) {
    return res.status(400).send(callbackPage('Sign-in failed: invalid or expired attempt. Please try again.', true));
  }
  if (!code) {
    return res.status(400).send(callbackPage('Sign-in failed: missing authorization code.', true));
  }

  try {
    const tokenRes = await fetch(`${zendeskBaseUrl()}/oauth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: ZENDESK_OAUTH_CLIENT_ID,
        client_secret: ZENDESK_OAUTH_CLIENT_SECRET,
        redirect_uri: ZENDESK_REDIRECT_URI,
        scope: OAUTH_SCOPE
      })
    });

    if (!tokenRes.ok) {
      console.error('[auth] Zendesk token exchange failed:', tokenRes.status, await tokenRes.text());
      return res.status(502).send(callbackPage('Sign-in failed: could not complete authorization with Zendesk.', true));
    }

    const { access_token: accessToken } = await tokenRes.json();

    const meRes = await fetch(`${zendeskBaseUrl()}/api/v2/users/me.json`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!meRes.ok) {
      console.error('[auth] Zendesk /users/me lookup failed:', meRes.status);
      return res.status(502).send(callbackPage('Sign-in failed: could not verify your Zendesk identity.', true));
    }

    const { user } = await meRes.json();

    const sessionToken = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      SESSION_SIGNING_SECRET,
      { expiresIn: SESSION_TTL_SECONDS }
    );

    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: true,
      // Must be None (not the default Lax/Strict): this cookie has to ride along
      // when the docs origin is loaded inside Zendesk's nested sidebar iframe,
      // which is a cross-site context from the cookie's point of view.
      sameSite: 'none',
      maxAge: SESSION_TTL_SECONDS * 1000
    });

    res.type('html').send(callbackPage(`Signed in as ${user.name} — you can close this window.`, false));
  } catch (err) {
    console.error('[auth] Callback error:', err);
    res.status(500).send(callbackPage('Sign-in failed: unexpected error.', true));
  }
});

function verifySession(req) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SIGNING_SECRET);
  } catch (e) {
    return null;
  }
}

// Same-origin polling target for the sign-in page. Deliberately not behind
// requireSession — this route's whole job is to answer "am I authenticated
// yet?" without depending on any window/popup relationship, since Zendesk's
// own login pages set Cross-Origin-Opener-Policy, which severs the
// opener link the moment the popup navigates there. That makes
// `popup.closed` polling from the opener unreliable even though the popup
// itself closes and the sign-in succeeds. Polling our own cookie state
// instead sidesteps that entirely.
router.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ authenticated: Boolean(verifySession(req)) });
});

function requireSession(req, res, next) {
  if (!authIsConfigured()) {
    // Fail closed rather than silently serving docs unauthenticated if env vars
    // are missing/misconfigured.
    return res.status(500).send('This server is not configured for authentication.');
  }

  const session = verifySession(req);
  if (session) {
    req.zendeskUser = session;
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  res.status(401).type('html').send(signInPage());
}

module.exports = { router, requireSession, authIsConfigured };
