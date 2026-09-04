const { HEIGHT_REPORTER_SCRIPT } = require('./heightReporter');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title, content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #2f3941;
      background: #ffffff;
    }
    header {
      margin-bottom: 12px;
      border-bottom: 1px solid #e9ebed;
      padding-bottom: 10px;
    }
    h1 {
      font-size: 16px;
      margin: 0 0 4px 0;
      color: #1f73b7;
    }
    .stats {
      font-size: 11px;
      color: #68737d;
      margin: 0;
    }
    .search-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .search-input-wrap {
      display: flex;
      gap: 6px;
    }
    input[type="search"] {
      flex: 1;
      padding: 8px 10px;
      font-size: 13px;
      border: 1px solid #d8dcde;
      border-radius: 4px;
      outline: none;
    }
    input[type="search"]:focus {
      border-color: #1f73b7;
      box-shadow: 0 0 0 2px rgba(31,115,183,0.2);
    }
    select {
      padding: 6px 8px;
      font-size: 12px;
      border: 1px solid #d8dcde;
      border-radius: 4px;
      background: #fff;
    }
    .btn-search {
      padding: 8px 12px;
      background: #1f73b7;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .card {
      border: 1px solid #e9ebed;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      background: #fafafa;
      transition: border-color 0.15s ease;
    }
    .card:hover {
      border-color: #1f73b7;
      background: #fff;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }
    .card-title {
      font-weight: 600;
      font-size: 13px;
      color: #1f73b7;
      text-decoration: none;
    }
    .card-title:hover {
      text-decoration: underline;
    }
    .card-sdk {
      font-size: 10px;
      font-weight: 600;
      background: #e9ebed;
      color: #49545c;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .card-desc {
      font-size: 12px;
      color: #49545c;
      margin: 4px 0 6px 0;
      line-height: 1.35;
    }
    .card-actions {
      display: flex;
      gap: 6px;
    }
    .btn-action {
      background: #ffffff;
      border: 1px solid #d8dcde;
      border-radius: 3px;
      padding: 3px 8px;
      font-size: 11px;
      color: #2f3941;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-action:hover {
      background: #f8f9f9;
      border-color: #1f73b7;
      color: #1f73b7;
    }
    .no-results-card {
      padding: 24px 12px;
      text-align: center;
      background: #f8f9f9;
      border-radius: 6px;
      border: 1px dashed #d8dcde;
      color: #68737d;
    }
  </style>
</head>
<body>
  ${content}
  ${HEIGHT_REPORTER_SCRIPT}
  <script>
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-insert-link')) {
        e.preventDefault();
        var linkText = e.target.getAttribute('data-link');
        window.parent.postMessage({
          source: 'elo-sdk-docs',
          action: 'insert_ticket',
          text: linkText
        }, '*');
        e.target.textContent = '✅ Inserted';
        setTimeout(function() { e.target.textContent = '🔗 Insert Link'; }, 2000);
      }
    });
  </script>
</body>
</html>`;
}

function renderLanding(sdks, docCount, suggestedQuery) {
  const content = `
    <header>
      <h1>Elo SDK Docs</h1>
      <p class="stats">${sdks.length} SDKs &middot; ${docCount} searchable items</p>
    </header>
    <main>
      <form class="search-box" action="/search" method="get">
        <div class="search-input-wrap">
          <input type="search" name="q" placeholder="Search classes, methods, peripherals..." value="${escapeHtml(suggestedQuery || '')}" autofocus />
          <button type="submit" class="btn-search">Search</button>
        </div>
        <select name="sdk">
          <option value="">All SDKs</option>
          ${sdks.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
        </select>
      </form>
      ${suggestedQuery ? `<div style="font-size: 11px; color: #1f73b7; margin-bottom: 8px;">💡 Suggested from Ticket: "<strong>${escapeHtml(suggestedQuery)}</strong>"</div>` : ''}
    </main>
  `;
  return layout('Elo SDK Docs', content);
}

function renderResults(query, sdkFilter, results, sdks) {
  let resultsHtml = '';
  if (results.length === 0) {
    resultsHtml = `
      <div class="no-results-card">
        <div style="font-size: 24px; margin-bottom: 6px;">🔍</div>
        <h3 style="margin: 0 0 4px 0; font-size: 14px; color: #2f3941;">No matches for "${escapeHtml(query)}"</h3>
        <p style="font-size: 12px; margin: 0 0 10px 0;">Try a broader keyword or switch the SDK filter.</p>
        <a href="/" style="font-size: 12px; color: #1f73b7;">Clear search</a>
      </div>
    `;
  } else {
    resultsHtml = results.map(item => `
      <div class="card">
        <div class="card-header">
          <a class="card-title" href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>
          <span class="card-sdk">${escapeHtml(item.sdk)}</span>
        </div>
        <div class="card-desc">${escapeHtml(item.description || item.kind || 'Documentation entry')}</div>
        <div class="card-actions">
          <a class="btn-action" href="${escapeHtml(item.url)}">View Docs &rarr;</a>
          <button type="button" class="btn-action btn-insert-link" data-link="[Elo SDK - ${escapeHtml(item.name)}](${escapeHtml(item.fullUrl || item.url)})">🔗 Insert Link</button>
        </div>
      </div>
    `).join('');
  }

  const content = `
    <header>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1>Search Results</h1>
        <a href="/" style="font-size: 12px; color: #1f73b7; text-decoration: none;">&larr; Back</a>
      </div>
    </header>
    <main>
      <form class="search-box" action="/search" method="get">
        <div class="search-input-wrap">
          <input type="search" name="q" value="${escapeHtml(query)}" required />
          <button type="submit" class="btn-search">Search</button>
        </div>
        <select name="sdk">
          <option value="">All SDKs</option>
          ${sdks.map(s => `<option value="${escapeHtml(s)}" ${s === sdkFilter ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      </form>
      <div style="font-size: 11px; color: #68737d; margin-bottom: 8px;">Found ${results.length} results for "<strong>${escapeHtml(query)}</strong>"</div>
      ${resultsHtml}
    </main>
  `;
  return layout(`Search: ${query}`, content);
}

module.exports = { renderLanding, renderResults };
