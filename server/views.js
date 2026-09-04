// Safely import heightReporter if present, otherwise provide fallback
let HEIGHT_REPORTER_SCRIPT = '';
try {
  const hr = require('./heightReporter');
  HEIGHT_REPORTER_SCRIPT = hr.HEIGHT_REPORTER_SCRIPT || '';
} catch (e) {
  HEIGHT_REPORTER_SCRIPT = `
    <script>
      (function() {
        function sendHeight() {
          var h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
          window.parent.postMessage({ source: 'elo-sdk-docs', height: h }, '*');
        }
        window.addEventListener('load', sendHeight);
        window.addEventListener('resize', sendHeight);
        if (window.ResizeObserver) {
          new ResizeObserver(sendHeight).observe(document.body);
        }
      })();
    </script>
  `;
}

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
      line-height: 1.4;
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
      font-weight: 600;
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
      margin-bottom: 14px;
    }
    .search-input-wrap {
      display: flex;
      gap: 6px;
    }
    input[type="search"] {
      flex: 1;
      padding: 7px 10px;
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
      color: #2f3941;
    }
    .btn-search {
      padding: 7px 14px;
      background: #1f73b7;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-search:hover {
      background: #144a75;
    }

    /* Section Headings */
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #68737d;
      margin: 16px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* SDK Explorer Cards (Home Page) */
    .sdk-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sdk-card {
      border: 1px solid #d8dcde;
      border-radius: 6px;
      padding: 10px;
      background: #ffffff;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.15s ease-in-out;
    }
    .sdk-card:hover {
      border-color: #1f73b7;
      box-shadow: 0 2px 6px rgba(31,115,183,0.12);
      background: #f8fbfe;
    }
    .sdk-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sdk-card-title {
      font-weight: 600;
      font-size: 13px;
      color: #1f73b7;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sdk-card-arrow {
      color: #1f73b7;
      font-weight: 600;
      font-size: 12px;
    }
    .sdk-card-desc {
      font-size: 11px;
      color: #49545c;
      line-height: 1.35;
    }
    .sdk-card-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }
    .sdk-badge {
      font-size: 10px;
      font-weight: 600;
      background: #e9ebed;
      color: #49545c;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }

    /* Search Result Cards */
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
      gap: 6px;
    }
    .card-title {
      font-weight: 600;
      font-size: 13px;
      color: #1f73b7;
      text-decoration: none;
      word-break: break-word;
    }
    .card-title:hover {
      text-decoration: underline;
    }
    .card-badges {
      display: flex;
      gap: 4px;
    }
    .card-sdk, .card-kind {
      font-size: 10px;
      font-weight: 600;
      background: #e9ebed;
      color: #49545c;
      padding: 2px 6px;
      border-radius: 3px;
      white-space: nowrap;
      text-transform: uppercase;
    }
    .card-kind {
      background: #e3f2fd;
      color: #1565c0;
    }
    .card-sig {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 11px;
      background: #f1f3f5;
      padding: 4px 6px;
      border-radius: 3px;
      margin: 4px 0 6px 0;
      word-break: break-all;
      color: #24292e;
    }
    .card-desc {
      font-size: 12px;
      color: #49545c;
      margin: 4px 0 8px 0;
      line-height: 1.35;
      word-break: break-word;
    }
    .card-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .btn-action {
      background: #ffffff;
      border: 1px solid #d8dcde;
      border-radius: 3px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 500;
      color: #2f3941;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
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
    .loading-spinner {
      padding: 20px;
      text-align: center;
      color: #68737d;
      font-size: 12px;
    }
  </style>
</head>
<body>
  ${content}
  ${HEIGHT_REPORTER_SCRIPT}
</body>
</html>`;
}

// Map SDK slugs to descriptive helper metadata and icons
function getSdkMeta(slug, name) {
  const s = (slug || '').toLowerCase();
  if (s.includes('eloview') || s.includes('home')) {
    return {
      icon: '☁️',
      desc: 'Kiosk lockdown, enterprise settings, provisioning, and device control.'
    };
  }
  if (s.includes('peripheral') || s.includes('device')) {
    return {
      icon: '🔍',
      desc: 'Barcode scanners, NFC / RFID readers, MSR, and status light bars.'
    };
  }
  if (s.includes('paypoint') || s.includes('pos')) {
    return {
      icon: '💳',
      desc: 'Integrated cash drawers, receipt printers, customer displays, and payment.'
    };
  }
  return {
    icon: '📦',
    desc: 'Core classes, interfaces, and API documentation.'
  };
}

// Landing Page (Home View with SDK Explorer Cards)
function landingPage(options = {}) {
  const sdks = options.sdks || [];
  const count = typeof options.documentCount === 'number' ? options.documentCount : sdks.length;
  const suggestedQuery = (options.suggest || '').trim();

  const sdkSelectOptions = sdks.map(s => {
    const slug = typeof s === 'object' && s !== null ? (s.slug || s.name || '') : s;
    const name = typeof s === 'object' && s !== null ? (s.name || s.slug || '') : s;
    return `<option value="${escapeHtml(slug)}">${escapeHtml(name)}</option>`;
  }).join('');

  const sdkCardsHtml = sdks.map(s => {
    const slug = typeof s === 'object' && s !== null ? (s.slug || s.name || '') : s;
    const name = typeof s === 'object' && s !== null ? (s.name || s.slug || '') : s;
    const meta = getSdkMeta(slug, name);
    const docUrl = `/docs/${slug}/index.html`;

    return `
      <a href="${escapeHtml(docUrl)}" class="sdk-card">
        <div class="sdk-card-header">
          <span class="sdk-card-title">${meta.icon} ${escapeHtml(name)}</span>
          <span class="sdk-card-arrow">Browse &rarr;</span>
        </div>
        <div class="sdk-card-desc">${escapeHtml(meta.desc)}</div>
        <div class="sdk-card-footer">
          <span class="sdk-badge">${escapeHtml(slug)}</span>
        </div>
      </a>
    `;
  }).join('');

  const content = `
    <header>
      <h1>Elo SDK Docs</h1>
      <p class="stats">${sdks.length} SDKs &middot; ${count} searchable items</p>
    </header>
    <main>
      <form class="search-box" action="/search" method="get">
        <div class="search-input-wrap">
          <input type="search" name="q" placeholder="e.g., 'NFC LED', 'reboot', 'scanner'..." value="${escapeHtml(suggestedQuery)}" required />
          <button type="submit" class="btn-search">Search</button>
        </div>
        <select name="sdk">
          <option value="">All SDKs</option>
          ${sdkSelectOptions}
        </select>
      </form>
      ${suggestedQuery ? `<div style="font-size: 11px; color: #1f73b7; margin-bottom: 8px;">💡 Suggested from Ticket: "<strong>${escapeHtml(suggestedQuery)}</strong>"</div>` : ''}

      <div class="section-title">Explore Documentation Trees</div>
      <div class="sdk-grid">
        ${sdkCardsHtml || '<p style="color:#68737d; font-size:12px;">No SDKs indexed.</p>'}
      </div>
    </main>
  `;
  return layout('Elo SDK Docs', content);
}

// Search Results Page (Dynamic Client-Side View)
function searchPage() {
  const content = `
    <header>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1>Search Results</h1>
        <a href="/" style="font-size: 12px; color: #1f73b7; text-decoration: none; font-weight: 500;">&larr; Back to Home</a>
      </div>
    </header>
    <main>
      <form class="search-box" action="/search" method="get" id="search-form">
        <div class="search-input-wrap">
          <input type="search" name="q" id="query-input" placeholder="Search classes, methods..." required />
          <button type="submit" class="btn-search">Search</button>
        </div>
        <select name="sdk" id="sdk-select">
          <option value="">All SDKs</option>
        </select>
      </form>
      <div id="results-count" style="font-size: 11px; color: #68737d; margin-bottom: 8px;"></div>
      <div id="results-container">
        <div class="loading-spinner">Searching...</div>
      </div>
    </main>

    <script>
      (function() {
        function escapeHtml(str) {
          return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        var params = new URLSearchParams(window.location.search);
        var q = params.get('q') || '';
        var sdk = params.get('sdk') || '';

        var queryInput = document.getElementById('query-input');
        var sdkSelect = document.getElementById('sdk-select');
        var resultsContainer = document.getElementById('results-container');
        var resultsCount = document.getElementById('results-count');

        queryInput.value = q;

        fetch('/api/sdks')
          .then(function(r) { return r.json(); })
          .then(function(sdks) {
            sdks.forEach(function(item) {
              var opt = document.createElement('option');
              opt.value = item.slug;
              opt.textContent = item.name;
              if (item.slug === sdk) opt.selected = true;
              sdkSelect.appendChild(opt);
            });
          })
          .catch(function() {});

        if (!q.trim()) {
          resultsContainer.innerHTML = '<div class="no-results-card"><p>Please enter a search term to begin.</p></div>';
          return;
        }

        var searchUrl = '/api/search?q=' + encodeURIComponent(q);
        if (sdk) searchUrl += '&sdk=' + encodeURIComponent(sdk);

        fetch(searchUrl)
          .then(function(res) {
            if (!res.ok) throw new Error('Search request failed: ' + res.status);
            return res.json();
          })
          .then(function(results) {
            if (!results || results.length === 0) {
              resultsCount.textContent = '';
              resultsContainer.innerHTML = [
                '<div class="no-results-card">',
                '  <div style="font-size: 24px; margin-bottom: 6px;">🔍</div>',
                '  <h3 style="margin: 0 0 4px 0; font-size: 14px; color: #2f3941;">No matches for "' + escapeHtml(q) + '"</h3>',
                '  <p style="font-size: 12px; margin: 0 0 10px 0;">Try a broader keyword or switch SDKs.</p>',
                '  <a href="/" style="font-size: 12px; color: #1f73b7;">Clear search</a>',
                '</div>'
              ].join('');
              return;
            }

            resultsCount.innerHTML = 'Found ' + results.length + ' result' + (results.length === 1 ? '' : 's') + ' for "<strong>' + escapeHtml(q) + '</strong>":';

            var html = results.map(function(item) {
              var docUrl = item.url;
              var fullLinkText = '[' + (item.sdkName || item.sdk) + ': ' + item.name + '](' + window.location.origin + docUrl + ')';
              var descriptionText = item.description || 'No detailed description available.';

              return [
                '<div class="card">',
                '  <div class="card-header">',
                '    <a class="card-title" href="' + escapeHtml(docUrl) + '">' + escapeHtml(item.name) + '</a>',
                '    <div class="card-badges">',
                '      <span class="card-sdk">' + escapeHtml(item.sdk) + '</span>',
                       (item.kind ? '<span class="card-kind">' + escapeHtml(item.kind) + '</span>' : ''),
                '    </div>',
                '  </div>',
                (item.signature ? '<div class="card-sig">' + escapeHtml(item.signature) + '</div>' : ''),
                '  <div class="card-desc">' + escapeHtml(descriptionText) + '</div>',
                '  <div class="card-actions">',
                '    <a class="btn-action" href="' + escapeHtml(docUrl) + '">View Docs &rarr;</a>',
                '    <button type="button" class="btn-action btn-insert-link" data-link="' + escapeHtml(fullLinkText) + '">🔗 Insert Link</button>',
                '  </div>',
                '</div>'
              ].join('');
            }).join('');

            resultsContainer.innerHTML = html;
          })
          .catch(function(err) {
            resultsContainer.innerHTML = '<div class="no-results-card"><p style="color: #c72a1c;">Error: ' + escapeHtml(err.message) + '</p></div>';
          });

        document.addEventListener('click', function(e) {
          if (e.target && e.target.classList.contains('btn-insert-link')) {
            e.preventDefault();
            var linkText = e.target.getAttribute('data-link');
            window.parent.postMessage({
              source: 'elo-sdk-docs',
              action: 'insert_ticket',
              text: linkText
            }, '*');
            e.target.textContent = '✅ Inserted!';
            setTimeout(function() {
              e.target.textContent = '🔗 Insert Link';
            }, 2000);
          }
        });
      })();
    </script>
  `;
  return layout('Search Results - Elo SDK Docs', content);
}

module.exports = {
  landingPage,
  searchPage
};
