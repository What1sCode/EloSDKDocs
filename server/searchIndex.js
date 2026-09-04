const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const MiniSearch = require('minisearch');
const { listSdks, DOCS_ROOT } = require('./sdks');

// Domain synonyms mapping developer intent to SDK terminology
const SYNONYMS = {
  nfc: ['rfid', 'contactless', 'card', 'mifare', 'smartcard', 'reader'],
  rfid: ['nfc', 'contactless', 'cardreader', 'badge', 'reader'],
  led: ['light', 'rgb', 'color', 'lightbar', 'status', 'illumination', 'indicator', 'ledcolor'],
  light: ['led', 'rgb', 'color', 'lightbar', 'indicator', 'status'],
  color: ['rgb', 'led', 'light', 'hex'],
  scanner: ['barcode', 'bcr', 'symbology', 'camera', 'scan', 'decode', 'aimer', 'illumination'],
  barcode: ['scanner', 'bcr', 'symbology', 'scan', 'decode'],
  reboot: ['power', 'restart', 'shutdown', 'powerstate', 'boot', 'reset'],
  power: ['reboot', 'restart', 'shutdown', 'sleep', 'wake'],
  drawer: ['cashdrawer', 'cash', 'money', 'kickout', 'paypoint', 'till', 'open'],
  printer: ['receipt', 'thermal', 'posprinter', 'escpos', 'paper', 'cutter', 'print'],
  kiosk: ['lockdown', 'navigation', 'statusbar', 'kioskmode', 'systemui', 'home', 'pinning'],
  navigation: ['kiosk', 'statusbar', 'systemui', 'navbar', 'backbutton'],
  eloview: ['enterprise', 'cloud', 'provision', 'devicecontrol', 'setting', 'app']
};

function createSearchIndex() {
  const documents = [];
  let docCounter = 0;
  const sdks = typeof listSdks === 'function' ? listSdks() : [];

  function cleanText(html) {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<p[^>]*>/gi, ' ')
      .replace(/<li[^>]*>/gi, ' ')
      .replace(/<\/p>|<\/li>|<\/div>|<\/tr>|<\/th>|<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Tokenizer splitting camelCase, snake_case, and standard punctuation
  function customTokenizer(text) {
    if (!text) return [];
    const splitText = text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/[_\-\.\/\\#\(\),:;]/g, ' ');
    return MiniSearch.getDefault('tokenize')(splitText);
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

            // 1. Extract Class & Package Hierarchy
            const rawTitle = $('title').text().replace(/^(Overview|Index|Class)\s*-\s*/i, '').trim();
            const className = $('h2.title, .header .title').first().text().replace(/^Class\s+/i, '').trim() || rawTitle || entry.name;
            const packageName = $('.header .subTitle, .sub-title').first().text().trim();
            const classOverview = cleanText($('.description .block, .class-description').first().html());
            const fullBodyText = cleanText($('body').html());

            // Index Class / Page Level Document
            documents.push({
              id: `doc_${++docCounter}`,
              name: className,
              simpleName: className,
              className: className,
              packageName: packageName,
              kind: 'Class',
              signature: packageName ? `${packageName}.${className}` : className,
              description: classOverview.substring(0, 300) || fullBodyText.substring(0, 300),
              fullText: `${className} ${packageName} ${classOverview} ${sdk.name}`,
              sdk: sdk.slug,
              sdkName: sdk.name,
              url: fileUrl
            });

            // 2. Deep Index Method & Field Detail Sections
            const processedAnchors = new Set();

            // Match Javadoc detail blocks (<section class="detail"> or <ul class="blockList">)
            $('section.detail, .blockList .blockList .blockList, table.memberSummary tr, table.overviewSummary tr').each((_, el) => {
              const elem = $(el);
              const anchor = elem.find('a[name]').attr('name') || elem.attr('id') || elem.find('span[id]').attr('id');
              const heading = elem.find('h3, h4, th.col-first, td.col-first, .memberNameLink').first().text().trim();
              const signature = elem.find('pre, .memberSignature').first().text().trim() || heading;
              const descHtml = elem.find('.block, td.col-last, .col-last').first().html();
              const memberDesc = cleanText(descHtml);
              const paramText = cleanText(elem.find('dl').text());

              const cleanName = heading.replace(/\s+/g, ' ').replace(/\(.*\)/, '()').trim();

              if (cleanName && cleanName.length > 1 && !cleanName.toLowerCase().includes('modifier and type')) {
                const uniqueKey = `${className}.${cleanName}`;
                if (!processedAnchors.has(uniqueKey)) {
                  processedAnchors.add(uniqueKey);

                  const isConstant = signature.includes('static final') || cleanName === cleanName.toUpperCase();
                  const targetUrl = anchor ? `${fileUrl}#${anchor}` : fileUrl;

                  documents.push({
                    id: `doc_${++docCounter}`,
                    name: `${className}.${cleanName}`,
                    simpleName: cleanName,
                    className: className,
                    packageName: packageName,
                    kind: isConstant ? 'Constant' : 'Method',
                    signature: signature || `${cleanName}()`,
                    description: memberDesc ? memberDesc.substring(0, 300) : (classOverview.substring(0, 200) || 'Documentation symbol.'),
                    fullText: `${cleanName} ${className} ${packageName} ${signature} ${memberDesc} ${paramText} ${sdk.name}`,
                    sdk: sdk.slug,
                    sdkName: sdk.name,
                    url: targetUrl
                  });
                }
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

  console.log(`[searchIndex] Deep index built: ${documents.length} symbols across ${sdks.length} SDK(s).`);

  const miniSearch = new MiniSearch({
    fields: ['name', 'simpleName', 'className', 'signature', 'description', 'fullText', 'sdkName'],
    storeFields: ['name', 'className', 'kind', 'signature', 'description', 'sdk', 'sdkName', 'url'],
    tokenize: customTokenizer,
    searchOptions: {
      boost: {
        simpleName: 6,
        name: 5,
        className: 4,
        signature: 3,
        description: 1.5,
        fullText: 1
      },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'OR'
    }
  });

  miniSearch.addAll(documents);

  return {
    documentCount: documents.length,
    search: (query, options = {}) => {
      if (!query || !query.trim()) return [];

      const rawTerms = query.toLowerCase().trim().split(/\s+/);
      const searchTerms = new Set(rawTerms);

      // Expand query with domain synonyms
      rawTerms.forEach(term => {
        if (SYNONYMS[term]) {
          SYNONYMS[term].forEach(syn => searchTerms.add(syn));
        }
      });

      const expandedQuery = Array.from(searchTerms).join(' ');

      const results = miniSearch.search(expandedQuery, {
        filter: options.sdk ? (doc) => doc.sdk === options.sdk : undefined
      });

      return results.slice(0, 50);
    }
  };
}

module.exports = { createSearchIndex };
