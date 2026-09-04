function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BASE_STYLE = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #666;
    --border: #e2e2e2;
    --accent: #0b5fff;
    --card-bg: #f7f8fa;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161a;
      --fg: #eaeaea;
      --muted: #9aa0a6;
      --border: #2a2d33;
      --accent: #6ea8fe;
      --card-bg: #1c1f24;
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  header.app-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  header.app-header h1 {
    margin: 0 0 4px;
    font-size: 18px;
  }
  header.app-header p {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  main { flex: 1; width: 100%; padding: 16px 20px 40px; max-width: 900px; margin: 0 auto; }
  main.landing { display: flex; flex-direction: column; justify-content: center; }
  .search-box {
    display: flex;
    gap: 8px;
    margin: 12px 0 20px;
  }
  .search-box input[type="search"] {
    flex: 1;
    padding: 10px 12px;
    font-size: 15px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
  }
  .search-box select {
    padding: 10px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
  }
  .sdk-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  .sdk-card {
    display: block;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    text-decoration: none;
    color: var(--fg);
  }
  .sdk-card:hover { border-color: var(--accent); }
  .sdk-card h2 { margin: 0 0 4px; font-size: 15px; }
  .sdk-card p { margin: 0; color: var(--muted); font-size: 13px; }
  .devzone-tag {
    display: inline-block;
    margin: 2px 0 6px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(11, 95, 255, 0.12);
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
  }
  .note {
    margin: 6px 0 0;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(230, 160, 0, 0.12);
    color: #b8860b;
    font-size: 12px;
  }
  @media (prefers-color-scheme: dark) {
    .note { color: #e6c34d; }
  }
  .gap-list { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 8px; }
  .gap-list li {
    padding: 10px 12px;
    border: 1px dashed var(--border);
    border-radius: 8px;
    font-size: 13px;
  }
  .gap-list .devzone-tag { margin-bottom: 4px; }
  section.gaps { margin-top: 28px; }
  section.gaps h2 { font-size: 14px; margin: 0 0 4px; }
  section.gaps > p { margin: 0; color: var(--muted); font-size: 12px; }
  .result {
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .kind-badge {
    display: inline-block;
    margin-right: 8px;
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    vertical-align: middle;
  }
  .kind-Method { background: rgba(11, 95, 255, 0.15); color: var(--accent); }
  .kind-Field { background: rgba(0, 170, 120, 0.15); color: #00966b; }
  .kind-Page { background: rgba(120, 120, 120, 0.15); color: var(--muted); }
  .kind-Deprecated { background: rgba(220, 60, 60, 0.15); color: #d33; }
  .result a { color: var(--accent); text-decoration: none; font-size: 15px; font-weight: 600; }
  .result a:hover { text-decoration: underline; }
  .result .meta { color: var(--muted); font-size: 12px; margin: 2px 0 6px; }
  .result .snippet { font-size: 13px; color: var(--fg); opacity: 0.85; }
  .empty, .hint { color: var(--muted); font-size: 13px; }
  mark { background: rgba(255, 220, 0, 0.5); color: inherit; border-radius: 2px; }
`;

function layout({ title, body, extraHead = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${BASE_STYLE}</style>
${extraHead}
</head>
<body>
${body}
</body>
</html>`;
}

function landingPage({ sdks, documentCount, missingFromDevZone = [] }) {
  const cards = sdks
    .map(
      (sdk) => `
      <li>
        <a class="sdk-card" href="/docs/${sdk.slug}/index.html">
          ${sdk.devZoneLabel ? `<span class="devzone-tag">Dev Zone: ${escapeHtml(sdk.devZoneLabel)}</span><br>` : ''}
          <h2>${escapeHtml(sdk.name)}</h2>
          <p>${escapeHtml(sdk.description)}</p>
          ${sdk.note ? `<p class="note">${escapeHtml(sdk.note)}</p>` : ''}
        </a>
      </li>`
    )
    .join('\n');

  const sdkOptions = sdks
    .map((sdk) => `<option value="${escapeHtml(sdk.slug)}">${escapeHtml(sdk.name)}</option>`)
    .join('\n');

  const gaps = missingFromDevZone
    .map(
      (gap) => `
      <li>
        <span class="devzone-tag">Dev Zone: ${escapeHtml(gap.devZoneLabel)}</span>
        <p class="note" style="margin-top:4px;">${escapeHtml(gap.note)}</p>
      </li>`
    )
    .join('\n');

  const body = `
    <header class="app-header">
      <h1>Elo SDK Docs</h1>
      <p>${sdks.length} SDK${sdks.length === 1 ? '' : 's'} indexed &middot; ${documentCount} classes/methods/fields searchable</p>
    </header>
    <main class="landing">
      <form class="search-box" action="/search" method="get">
        <input type="search" name="q" placeholder="Search all SDK docs (class, method, keyword)…" autofocus />
        <select name="sdk">
          <option value="">All SDKs</option>
          ${sdkOptions}
        </select>
        <button type="submit">Search</button>
      </form>
      <ul class="sdk-list">
        ${cards}
      </ul>
      ${
        gaps
          ? `<section class="gaps">
        <h2>Listed on Dev Zone, not hosted here yet</h2>
        <p>Not silently dropped — flagged so techs know to look elsewhere for now.</p>
        <ul class="gap-list">${gaps}</ul>
      </section>`
          : ''
      }
    </main>
  `;

  return layout({ title: 'Elo SDK Docs', body });
}

function searchPage() {
  const body = `
    <header class="app-header">
      <h1>Elo SDK Docs</h1>
      <p><a href="/" style="color:inherit;">&larr; All SDKs</a></p>
    </header>
    <main>
      <form class="search-box" id="search-form">
        <input type="search" id="q" name="q" placeholder="Search all SDK docs (class, method, keyword)…" autofocus />
        <select id="sdk" name="sdk">
          <option value="">All SDKs</option>
        </select>
        <button type="submit">Search</button>
      </form>
      <div id="results"><p class="hint">Type at least 2 characters to search.</p></div>
    </main>
    <script>
    (function () {
      const form = document.getElementById('search-form');
      const input = document.getElementById('q');
      const sdkSelect = document.getElementById('sdk');
      const results = document.getElementById('results');

      const params = new URLSearchParams(window.location.search);
      if (params.get('q')) input.value = params.get('q');
      if (params.get('sdk')) sdkSelect.value = params.get('sdk');

      fetch('/api/sdks').then(r => r.json()).then(sdks => {
        for (const sdk of sdks) {
          const opt = document.createElement('option');
          opt.value = sdk.slug;
          opt.textContent = sdk.name;
          if (sdk.slug === sdkSelect.value) opt.selected = true;
          sdkSelect.appendChild(opt);
        }
      });

      function escapeHtml(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      let debounceTimer;
      function runSearch() {
        const q = input.value.trim();
        const sdk = sdkSelect.value;
        const url = new URL(window.location.href);
        url.searchParams.set('q', q);
        if (sdk) url.searchParams.set('sdk', sdk); else url.searchParams.delete('sdk');
        window.history.replaceState({}, '', url);

        if (q.length < 2) {
          results.innerHTML = '<p class="hint">Type at least 2 characters to search.</p>';
          return;
        }
        const apiUrl = '/api/search?q=' + encodeURIComponent(q) + (sdk ? '&sdk=' + encodeURIComponent(sdk) : '');
        fetch(apiUrl).then(r => r.json()).then(items => {
          if (!items.length) {
            results.innerHTML = '<p class="empty">No results.</p>';
            return;
          }
          results.innerHTML = items.map(item => (
            '<div class="result">' +
              '<span class="kind-badge kind-' + escapeHtml(item.kind) + '">' + escapeHtml(item.kind) + '</span>' +
              '<a href="' + encodeURI(item.url) + '">' + escapeHtml(item.title) + '</a>' +
              '<div class="meta">' + escapeHtml(item.sdkName) + '</div>' +
              '<div class="snippet">' + item.snippetHtml + '</div>' +
            '</div>'
          )).join('');
        }).catch(() => {
          results.innerHTML = '<p class="empty">Search failed. Try again.</p>';
        });
      }

      form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });
      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runSearch, 200);
      });
      sdkSelect.addEventListener('change', runSearch);

      if (input.value.trim().length >= 2) runSearch();
    })();
    </script>
  `;

  return layout({ title: 'Search — Elo SDK Docs', body });
}

module.exports = { landingPage, searchPage, escapeHtml };
