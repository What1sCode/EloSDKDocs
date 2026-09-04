const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const MiniSearch = require('minisearch');
const { listSdks, DOCS_ROOT } = require('./sdks');

function createSearchIndex() {
  const documents = [];
  let docCounter = 0;
  const sdks = typeof listSdks === 'function' ? listSdks() : [];

  // Helper to extract a clean text preview snippet from HTML content
  function createSnippet(htmlContent) {
    if (!htmlContent) return '';
    const text = htmlContent
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<p[^>]*>/gi, ' ')
      .replace(/<li[^>]*>/gi, ' ')
      .replace(/<\/p>|<\/li>|<\/div>|<\/tr>|<\/th>|<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, '') // Strip all remaining tags
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')      // Collapse whitespace
      .trim();

    return text.length > 250 ? text.substring(0, 250) + '...' : text;
  }

  sdks.forEach(sdk => {
    const sdkPath = sdk.path || path.join(DOCS_ROOT, sdk.slug);
    if (!fs.existsSync(sdkPath)) return;

    function walkDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          const relPath = path.relative(sdkPath, fullPath).replace(/\\/g, '/');
          const fileUrl = `/docs/${sdk.slug}/${relPath}`;

          try {
            const html = fs.readFileSync(fullPath, 'utf-8');
            const $ = cheerio.load(html);

            // 1. Index Page Title & Overview Snippet
            const pageTitle = $('title').text().replace(/^(Overview|Index|Class)\s*-\s*/i, '').trim();
            const pageDescription = createSnippet($('body').html());

            documents.push({
              id: `doc_${++docCounter}`,
              name: pageTitle || entry.name,
              kind: 'Page',
              description: pageDescription,
              sdk: sdk.slug,
              sdkName: sdk.name,
              url: fileUrl
            });

            // 2. Index Methods, Fields, and Constants
            $('table.memberSummary tr, table.overviewSummary tr, table.typeSummary tr').each((idx, el) => {
              const row = $(el);
              const rowId = row.attr('id') || row.find('a[name]').attr('name') || row.find('span[id]').attr('id');
              const nameCell = row.find('th.col-first, td.col-first, .memberNameLink, td:first-child');
              const descCell = row.find('td.col-last, .col-last, td:last-child');

              const name = nameCell.text().replace(/\s+/g, ' ').trim();
              const description = createSnippet(descCell.html());

              if (name && name.length > 1 && !name.toLowerCase().includes('modifier and type')) {
                const targetUrl = rowId ? `${fileUrl}#${rowId}` : fileUrl;

                documents.push({
                  id: `doc_${++docCounter}`,
                  name: name,
                  kind: 'Method/Field',
                  description: description,
                  sdk: sdk.slug,
                  sdkName: sdk.name,
                  url: targetUrl
                });
              }
            });
          } catch (e) {
            console.warn(`[searchIndex] Warning reading ${fullPath}:`, e.message);
          }
        }
      }
    }

    walkDir(sdkPath);
  });

  console.log(`[searchIndex] Successfully indexed ${documents.length} unique items across ${sdks.length} SDK(s).`);

  const miniSearch = new MiniSearch({
    fields: ['name', 'description', 'sdkName'],
    storeFields: ['name', 'kind', 'description', 'sdk', 'sdkName', 'url'],
    searchOptions: {
      boost: { name: 2 },
      fuzzy: 0.2
    }
  });

  miniSearch.addAll(documents);

  return {
    documentCount: documents.length,
    search: (query, options = {}) => {
      if (!query || !query.trim()) return [];
      const results = miniSearch.search(query, {
        filter: options.sdk ? (doc) => doc.sdk === options.sdk : undefined
      });
      return results.slice(0, 50);
    }
  };
}

module.exports = { createSearchIndex };
