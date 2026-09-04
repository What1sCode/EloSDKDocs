const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const MiniSearch = require('minisearch');
const { listSdks } = require('./sdks');

// Javadoc emits a bunch of pure-navigation / boilerplate pages (frame
// framesets, alphabetical indexes, deprecated/constant/serialized-form
// dumps). They add noise without adding anything a support agent would
// actually search for, so we skip them by filename...
const SKIP_FILENAMES = new Set([
  'overview-frame.html',
  'allclasses-frame.html',
  'allclasses-noframe.html',
  'allpackages-index.html',
  'package-frame.html',
  'index-all.html',
  'deprecated-list.html',
  'constant-values.html',
  'serialized-form.html',
  'help-doc.html',
  'overview-tree.html'
]);

function shouldSkip(filePath, $) {
  const base = path.basename(filePath);
  if (SKIP_FILENAMES.has(base)) return true;
  if (base.endsWith('-frame.html')) return true;
  if (filePath.includes(`${path.sep}index-files${path.sep}`)) return true;
  // ...and anything that's actually a <frameset> page (old-style javadoc
  // index.html), which has no browsable content of its own.
  if ($('frameset').length > 0) return true;
  return false;
}

// Repeated nav/chrome markup that's identical (or near-identical) on every
// javadoc page. Left in, it does two kinds of damage: it pads out every
// page's indexed text with the same boilerplate words (diluting relevance
// scoring, since "Overview Package Class Tree Deprecated Index Help" then
// "matches" nearly any query a little), and — worse — <script> tags full of
// inline JSON (the per-page method/tab filter data) show up verbatim as
// visible "text" once cheerio flattens the DOM, which is what was polluting
// result snippets with junk like `var methods = {"i0":10,...}`.
const CHROME_SELECTORS = [
  'script',
  'style',
  'noscript',
  '.topNav',
  '.bottomNav',
  '.subNav',
  'header[role="banner"]',
  'nav[role="navigation"]'
].join(',');

function stripChrome($) {
  $(CHROME_SELECTORS).remove();
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.html?$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Pulls one search document per method/field/constructor out of a class
// page's Summary tables, each deep-linked to its own anchor. This is the
// part that actually answers "which method does X" — a whole-page match on
// a 2,000-word class page (like System.html, ~80 methods) tells a tech
// nothing about *where*; a member-level match takes them straight to
// setNfcLedMode's own entry instead of the top of the page.
//
// Two javadoc doclet generations, two markup shapes, both handled:
//  - Modern (Java 9+, e.g. eloviewhomesdk): flat sibling <div class="col-*">
//    rows; name is an <a class="member-name-link" href="#fragment">.
//  - Classic (pre-Java 9, everything else here): <td class="colLast"> holds
//    the name link plus a sibling <div class="block"> description.
// Both summary tables link with an href that's *already* the right anchor
// fragment for that member's own Detail section on the same page — we just
// read it off rather than trying to reconstruct javadoc's anchor naming.
function extractMembers($, sdk, pageUrl, pageTitle) {
  const members = [];
  const seen = new Set();

  function addMember(name, fragment, description, hasParens) {
    if (!name || !fragment || seen.has(fragment)) return;
    seen.add(fragment);
    // Method/constructor summary rows always show a "(params)" signature
    // after the name; field rows never do — a reliable, convention-
    // independent way to tell them apart (Java naming style, e.g.
    // SCREAMING_SNAKE_CASE constants vs lowerCamelCase methods, isn't).
    const kind = description.includes('Deprecated.') ? 'Deprecated' : hasParens ? 'Method' : 'Field';
    members.push({
      sdk: sdk.slug,
      sdkName: sdk.name,
      kind,
      name,
      pageTitle,
      title: `${pageTitle}.${name}`,
      text: `${name} ${description}`,
      description,
      // Fragment characters like ( ) , . are all valid unescaped in a URL
      // fragment per the URL spec, and match javadoc's element ids
      // byte-for-byte once the browser resolves this href.
      url: `${pageUrl}#${fragment}`
    });
  }

  $('.member-name-link').each((_, el) => {
    const $link = $(el);
    const name = $link.text().trim();
    const href = $link.attr('href') || '';
    const fragment = href.includes('#') ? href.slice(href.indexOf('#') + 1) : null;
    if (!fragment) return;
    const $col2 = $link.closest('.col-second');
    const description = ($col2.length ? $col2.next('.col-last').find('.block').first() : $()).text().trim();
    const hasParens = ($col2.length ? $col2 : $link.parent()).text().includes('(');
    addMember(name, fragment, description, hasParens);
  });

  $('td.colLast').each((_, el) => {
    const $cell = $(el);
    const $link = $cell.find('a').first();
    const name = $link.text().trim();
    const href = $link.attr('href') || '';
    const fragment = href.includes('#') ? href.slice(href.indexOf('#') + 1) : null;
    if (!fragment) return;
    const description = $cell.find('.block').first().text().trim();
    const hasParens = $cell.clone().find('.block').remove().end().text().includes('(');
    addMember(name, fragment, description, hasParens);
  });

  return members;
}

function buildDocuments() {
  const documents = [];
  let id = 0;

  for (const sdk of listSdks()) {
    const files = walk(sdk.path);
    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8');
      const $ = cheerio.load(raw);

      if (shouldSkip(file, $)) continue;

      const title = ($('title').first().text() || '').trim();
      const heading = ($('h1, h2').first().text() || '').trim();

      const relPath = path.relative(sdk.path, file).split(path.sep).join('/');
      const url = `/docs/${sdk.slug}/${relPath}`;
      const pageTitle = heading || title || relPath;

      // Member-level entries first, using the untouched DOM (structure
      // matters for extraction); chrome only needs stripping for the
      // page-level full-text entry below.
      for (const member of extractMembers($, sdk, url, pageTitle)) {
        documents.push({ id: id++, kind: member.kind, sdk: member.sdk, sdkName: member.sdkName, title: member.title, name: member.name, pageTitle: member.pageTitle, text: member.text, description: member.description, url: member.url });
      }

      stripChrome($);
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      if (!bodyText) continue;

      documents.push({
        id: id++,
        kind: 'Page',
        sdk: sdk.slug,
        sdkName: sdk.name,
        title: pageTitle,
        pageTitle,
        url,
        text: bodyText
      });
    }
  }

  return documents;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds an already-HTML-safe snippet with matched query terms wrapped in
// <mark>, so a tech scanning a results list can tell *why* something
// matched without opening it. Escaping happens before highlighting so a
// query containing HTML-special characters can't inject markup.
function highlight(text, terms) {
  const escaped = escapeHtml(text);
  if (!terms.length) return escaped;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig');
  return escaped.replace(pattern, '<mark>$1</mark>');
}

function buildSnippet(text, terms, length = 180) {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    idx = lower.indexOf(term);
    if (idx !== -1) break;
  }
  if (idx === -1) idx = 0;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, start + length);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end).trim() + suffix;
}

function createSearchIndex() {
  const documents = buildDocuments();

  const miniSearch = new MiniSearch({
    fields: ['title', 'name', 'text'],
    storeFields: ['kind', 'sdk', 'sdkName', 'title', 'pageTitle', 'url'],
    searchOptions: {
      // A hit on the member/class identifier itself (name/title) is a much
      // stronger signal than the same words appearing somewhere in a
      // page's prose — someone typing "setNfcLedMode" or "NfcLed" wants
      // that exact member, not just any page that happens to mention it.
      boost: { name: 5, title: 3 },
      prefix: true,
      fuzzy: 0.2
    }
  });

  miniSearch.addAll(documents);

  const byId = new Map(documents.map((d) => [d.id, d]));

  return {
    documentCount: documents.length,
    search(query, { sdk, limit = 25 } = {}) {
      if (!query || !query.trim()) return [];
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const filter = sdk ? (result) => result.sdk === sdk : undefined;

      // Multi-word technical queries ("nfc led", "set color") almost
      // always mean "give me the thing matching all of these words", not
      // "anything matching any of them" — MiniSearch's OR default let a
      // strong single-term hit (e.g. a field literally named
      // EXT_LED_COLOR_RED, boosted via the name field) outrank a weaker
      // match on *both* query words, which is backwards for this. AND
      // first; fall back to OR only if that finds nothing, so an
      // under-specified query still returns something.
      let results = miniSearch.search(query, { filter, combineWith: 'AND' });
      if (!results.length) {
        results = miniSearch.search(query, { filter, combineWith: 'OR' });
      }

      return results.slice(0, limit).map((r) => {
        const doc = byId.get(r.id);
        const rawSnippet =
          doc.kind === 'Page' ? buildSnippet(doc.text || '', terms) : doc.description || `(no description in the source javadoc)`;
        return {
          kind: r.kind,
          sdk: r.sdk,
          sdkName: r.sdkName,
          title: r.title,
          pageTitle: r.pageTitle,
          url: r.url,
          score: r.score,
          snippetHtml: highlight(rawSnippet, terms)
        };
      });
    }
  };
}

module.exports = { createSearchIndex };
