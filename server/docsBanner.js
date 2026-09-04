const path = require('path');

// Safely import height reporter or fallback
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
      })();
    </script>
  `;
}

const BODY_OPEN_RE = /<body([^>]*)>/i;

const RESPONSIVE_SIDEBAR_CSS = `
<style>
  /* Base typography & sidebar sizing */
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    font-size: 13px !important;
    line-height: 1.45 !important;
    padding-top: 52px !important; /* clearance for sticky banner */
    margin: 0 !important;
    background-color: #ffffff !important;
    color: #2f3941 !important;
  }

  /* Target Element Highlighting Animation */
  :target, .elo-highlight-target {
    background-color: #fff3cd !important;
    border-left: 4px solid #1f73b7 !important;
    padding-left: 6px !important;
    transition: background-color 2s ease-out;
    animation: eloHighlightPulse 3s ease-out;
  }

  @keyframes eloHighlightPulse {
    0% { background-color: #ffe082; transform: scale(1.01); }
    50% { background-color: #fff9c4; }
    100% { background-color: #fff3cd; transform: scale(1); }
  }

  /* Wrap long method signatures & pre tags */
  pre, code {
    white-space: pre-wrap !important;
    word-break: break-word !important;
    font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace !important;
    font-size: 12px !important;
    background: #f8f9f9 !important;
    border: 1px solid #d8dcde !important;
    border-radius: 4px !important;
  }
  pre {
    padding: 8px 10px !important;
    position: relative;
  }

  /* Responsive table adjustments */
  table.memberSummary, table.overviewSummary, table.typeSummary {
    width: 100% !important;
    display: block !important;
    overflow-x: auto !important;
    border-collapse: collapse !important;
    margin: 10px 0 !important;
  }
  th, td {
    padding: 6px 8px !important;
    font-size: 12px !important;
  }

  /* Sticky Top Navigation Banner */
  .elo-docs-sticky-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 44px;
    background: #1f73b7;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    z-index: 999999;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .elo-docs-banner-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .elo-docs-banner-link {
    color: #ffffff;
    text-decoration: none;
    font-weight: 600;
    font-size: 12px;
    background: rgba(255,255,255,0.2);
    padding: 4px 8px;
    border-radius: 4px;
  }
  .elo-docs-banner-link:hover {
    background: rgba(255,255,255,0.35);
  }
  .elo-docs-banner-search {
    display: flex;
    align-items: center;
  }
  .elo-docs-banner-input {
    padding: 4px 8px;
    font-size: 11px;
    border-radius: 3px;
    border: none;
    width: 120px;
    outline: none;
  }

  /* Insert Snippet Button */
  .elo-insert-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    background: #ffffff;
    border: 1px solid #cfd7df;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: #2f3941;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .elo-insert-btn:hover {
    background: #e9ebed;
    color: #1f73b7;
  }
</style>
`;

const INTERACTIVE_SCRIPT = `
<script>
  (function() {
    // Sanitize frame targets
    document.querySelectorAll('a[target="_top"], a[target="_parent"]').forEach(function(link) {
      link.setAttribute('target', '_self');
    });

    // Add Insert/Copy buttons to all code blocks
    document.querySelectorAll('pre').forEach(function(pre) {
      if (pre.closest('.elo-docs-sticky-banner')) return;
      var btn = document.createElement('button');
      btn.className = 'elo-insert-btn';
      btn.textContent = '📋 Insert to Ticket';
      btn.type = 'button';
      btn.title = 'Insert this snippet directly into the active ticket comment';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var code = pre.innerText.replace('📋 Insert to Ticket', '').trim();
        window.parent.postMessage({
          source: 'elo-sdk-docs',
          action: 'insert_ticket',
          text: code
        }, '*');
        btn.textContent = '✅ Inserted!';
        setTimeout(function() { btn.textContent = '📋 Insert to Ticket'; }, 2000);
      });
      pre.appendChild(btn);
    });

    // Auto-scroll and highlight target anchor element with banner clearance
    function highlightCurrentHash() {
      if (!window.location.hash) return;
      var targetId = window.location.hash.substring(1);
      var targetEl = document.getElementById(targetId) || document.querySelector('a[name="' + targetId + '"]');
      
      if (targetEl) {
        // If it's an anchor tag, target its parent block/row
        var parentBlock = targetEl.closest('tr, li, div.block, dl') || targetEl;
        parentBlock.classList.add('elo-highlight-target');
        
        // Smooth scroll with 60px clearance for sticky banner
        var rect = parentBlock.getBoundingClientRect();
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        window.scrollTo({
          top: rect.top + scrollTop - 60,
          behavior: 'smooth'
        });
      }
    }

    window.addEventListener('load', highlightCurrentHash);
    window.addEventListener('hashchange', highlightCurrentHash);
  })();
</script>
`;

function isNavFramePane(relPath) {
  if (!relPath) return false;
  const basename = path.basename(relPath).toLowerCase();
  return (
    basename.endsWith('-frame.html') ||
    basename === 'allclasses-frame.html' ||
    basename === 'allclasses-noframe.html' ||
    basename === 'overview-frame.html' ||
    basename === 'package-frame.html' ||
    basename === 'package-list.html' ||
    basename === 'packages.html'
  );
}

function stripAllTargetAttributes(html) {
  if (typeof html !== 'string') return html;
  return html.replace(/\btarget\s*=\s*["']?(_top|_parent|classFrame)["']?/gi, 'target="_self"');
}

function buildBanner(sdkName) {
  return `
    <div class="elo-docs-sticky-banner">
      <div class="elo-docs-banner-left">
        <a href="/" class="elo-docs-banner-link">🏠 Home</a>
        <span style="font-size: 11px; opacity: 0.9;">${sdkName || 'SDK Docs'}</span>
      </div>
      <form class="elo-docs-banner-search" action="/search" method="get">
        <input type="search" name="q" class="elo-docs-banner-input" placeholder="Quick search..." />
      </form>
    </div>
  `;
}

function injectBodyBanner(html, sdk) {
  if (typeof html !== 'string') return html;
  const sdkName = typeof sdk === 'object' && sdk !== null ? (sdk.name || sdk.slug || '') : (sdk || '');
  if (!BODY_OPEN_RE.test(html)) return html;

  return html.replace(BODY_OPEN_RE, (match, attrs) => {
    return `<body${attrs}>${RESPONSIVE_SIDEBAR_CSS}${buildBanner(sdkName)}${HEIGHT_REPORTER_SCRIPT}${INTERACTIVE_SCRIPT}`;
  });
}

module.exports = {
  isNavFramePane,
  stripAllTargetAttributes,
  injectBodyBanner
};
