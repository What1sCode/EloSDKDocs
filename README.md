# Elo SDK Docs

Unified, searchable hosting for Elo SDK documentation (javadoc/help exports),
deployable to Railway and embeddable inside Zendesk.

## What this is

Elo's SDKs ship their docs as javadoc/help zips in wildly inconsistent
formats — some newer ones (EloView Home SDK) have a real client-side search
box, most (EloView SDK, EloPayPoint Android SDK, SLK Kit) are classic
frame-based javadoc from ~2015-2019 with no search at all, just an
alphabetical index page.

Rather than host each one's own (inconsistent, sometimes-nonexistent)
search, this app:

1. Serves every SDK's doc tree as static files under `/docs/<slug>/...`
   (so each SDK's own navigation/frames/links still work normally).
2. Builds one unified full-text search index across **all** SDKs at startup
   (`server/searchIndex.js`, using [MiniSearch](https://github.com/lucaong/minisearch)),
   exposed at `/api/search?q=...` and a search UI at `/search`.
3. Gates the whole thing behind HTTP Basic Auth, since this is internal
   support material, not public docs.
4. Ships a Zendesk app (`zaf-app/`) that iframes the search UI into the
   ticket sidebar / top bar so agents can search without leaving a ticket.

## Currently indexed SDKs

Names/badges on the landing page are matched to Elo's **Dev Zone → SDK**
tab labels (`server/sdks.js`'s `KNOWN` map) so techs can map a class back to
the download they know it by:

| Slug | Dev Zone label | Source | Notes |
|---|---|---|---|
| `eloviewhomesdk` | "Device Level SDKs for all EloView enabled devices" | `EloViewHomeSDK_6.25.520.zip` → `DOC/EloViewHomeSdk_Help.zip` | Modern javadoc, has its own `search.js` too |
| `elopaypoint-android-sdk` | "Peripherals SDKs for PayPoint devices" | `EloPayPoint_Android_SDK_3.2.zip` → `DOC/doc.zip` | Classic frame-based javadoc, no built-in search |
| `slk-kit` | "SDK for Status Light Kit (SLK)" | `slk-kit.zip` → `SLK_KIT/javadoc_en.zip` | Classic frame-based javadoc, no built-in search |
| `eloviewsdk` | **none** — flagged on the landing page | `eloview-sdk.zip` → `eloview-sdk/EloViewSDK_Help.zip` | Doesn't match any current Dev Zone entry: contains a single utility class (`EloSecureUtil`), not peripheral/device APIs. Likely legacy/internal — confirm with Elo before pointing techs here. |

**Gap:** Dev Zone's "Peripherals SDKs for I-Series devices" has no entry
here — `eloview-iseries-sdk.zip` ships as Android sample-app source only,
with no generated javadoc/help archive to serve. Also shown as a flagged
gap on the landing page rather than silently omitted.

**Not included:** `eloview-iseries-sdk.zip` has no doc/help archive at all —
it's a bare Android sample-app source tree (`src/`, `res/`, `libs/`, no
`DOC/` folder). If a docs archive for it turns up later, drop it into
`docs/eloview-iseries-sdk/` and it'll be picked up automatically (see below).

## Adding a new SDK's docs

1. Extract the SDK's doc/help zip (they're often zips-inside-zips —
   `DOC/<name>_Help.zip` or `DOC/doc.zip`) until you get a folder full of
   `.html` files with an `index.html` at its root.
2. Copy that folder to `docs/<a-url-safe-slug>/` in this repo.
3. Optionally add a friendly name/description in `server/sdks.js`'s `KNOWN`
   map — otherwise it falls back to a titleized version of the slug.
4. Commit, push, redeploy. The server rebuilds the search index from
   whatever's in `docs/` at startup — no other code changes needed.

## Local development

```bash
npm install
DOCS_USER=agent DOCS_PASS=devpass npm start
# -> http://localhost:3000  (Basic Auth: agent / devpass)
```

Without `DOCS_USER`/`DOCS_PASS` set, the server logs a warning and serves
without auth — fine for local dev, never do this in production.

## Deploying to Railway

This repo includes `railway.json` (Nixpacks build, `npm start`, healthcheck
at `/healthz`). From this directory, with the Railway CLI installed and
logged in (`railway login`):

```bash
railway init          # creates a new Railway project
railway up            # deploys this directory
railway domain        # generates a public *.up.railway.app URL
```

Then set the required environment variables (Railway dashboard or CLI):

```bash
railway variables --set "DOCS_USER=agent" --set "DOCS_PASS=<a strong password>"
railway variables --set "ZENDESK_SUBDOMAIN=<your-zendesk-subdomain>"
```

- `DOCS_USER` / `DOCS_PASS` — required to gate access. Share these
  credentials with agents (or point them at a password manager entry)
  rather than making the site public.
- `ZENDESK_SUBDOMAIN` — locks the `frame-ancestors` CSP directive to your
  exact Zendesk account (`https://<subdomain>.zendesk.com`) instead of the
  `https://*.zendesk.com` wildcard fallback. Recommended once you know it.

Railway auto-assigns `PORT`; the app reads it via `process.env.PORT`.

### A note on Basic Auth inside an iframe

Zendesk will embed this site in an iframe (see below), and the browser's
native Basic Auth prompt does work inside iframes — but it's a one-time
native browser dialog per browser session/origin, not a styled login page,
so the first time an agent opens the sidebar app they'll get an OS-level
credential prompt. If that proves too rough on the support team, the
straightforward upgrade path is swapping `express-basic-auth` for a small
cookie-session login page — flagging it now so it's not a surprise; happy
to build that next if Basic Auth turns out to be annoying in practice.

## Zendesk app (`zaf-app/`)

A private Zendesk app that iframes `/search` from the deployed Railway URL
into the ticket sidebar and the top bar. `translations/en.json` is required
by Zendesk's upload validation (matches `defaultLocale: "en"` in
`manifest.json`) — if you add another locale to the manifest, add a matching
`translations/<locale>.json` too, or the upload rejects with "Missing
translation file for locale '<locale>'".

### Package and upload

Requires [Zendesk Apps Tools (ZAT)](https://developer.zendesk.com/documentation/apps/app-developer-guide/apps_tools/):

```bash
npm install -g @zendesk/zcli   # or the legacy `zat` gem, either works
cd zaf-app
zcli apps:validate .
zcli apps:create .             # first upload
# or, for updates to an already-created app:
zcli apps:update .
```

Alternatively, zip the `zaf-app/` folder's contents (not the folder itself)
and upload via **Admin Center → Apps and integrations → Zendesk Support apps
→ Upload private app**.

### Configure after install

In Admin Center, open the app's settings and set:

- **docsUrl** — the Railway public URL, e.g. `https://elo-sdk-docs.up.railway.app`
  (no trailing slash).

Since the docs site is Basic Auth-gated, the first agent to open the app in
a given browser will see the native credential prompt described above.

## Security notes

- `helmet` is configured with `frameguard: false` and a CSP `frame-ancestors`
  directive instead, since Zendesk needs to iframe this app — the default
  `X-Frame-Options: SAMEORIGIN` would otherwise block that entirely. Set
  `ZENDESK_SUBDOMAIN` in production so framing is scoped to your exact
  Zendesk account rather than any `*.zendesk.com`.
- `script-src`/`style-src` allow `'unsafe-inline'` because the javadoc output
  itself ships inline `<script>`/`<style>` blocks (frame navigation, the
  built-in search bootstrap on the newer SDK). That's our own static,
  vetted content, not user input, so this isn't an XSS exposure — just
  loosening CSP enough for the vendored docs to keep working as shipped.
