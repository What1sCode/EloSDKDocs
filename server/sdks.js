const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.join(__dirname, '..', 'docs');

// Friendly display names / descriptions for known SDK slugs, named to match
// the categories on Elo's Dev Zone "SDK" tab exactly, so techs can map a
// class straight back to the download/product they know it by. Any folder
// dropped into docs/ that isn't listed here still gets served and indexed —
// it just falls back to a titleized version of its folder name.
const KNOWN = {
  'eloviewhomesdk': {
    name: 'EloView Device Level SDK',
    devZoneLabel: 'Device Level SDKs for all EloView enabled devices',
    description: 'EloView Home SDK 6.25.520 — integrate an Android app with EloView (jar + javadoc for the jar\'s APIs).'
  },
  'elopaypoint-android-sdk': {
    name: 'EloView PayPoint Peripherals SDK',
    devZoneLabel: 'Peripherals SDKs for PayPoint devices',
    description: 'EloPayPoint Android SDK 3.2 — integrate an Android app with EloView PayPoint peripherals (cash drawer, printer, barcode scanner, MSR, customer display).'
  },
  'slk-kit': {
    name: 'SLK (Status Light Kit) SDK',
    devZoneLabel: 'SDK for Status Light Kit (SLK)',
    description: 'SLK Kit — integrate an Android app with an SLK device on i-Series 2.0.'
  },
  // Doesn't correspond to anything on the current Dev Zone SDK list — it's
  // a single utility class (EloSecureUtil), not a peripherals/device SDK.
  // Flagged rather than force-mapped to a Dev Zone category it doesn't
  // match; likely a legacy/internal artifact worth confirming with Elo.
  'eloviewsdk': {
    name: 'EloView SDK (legacy/unlisted)',
    devZoneLabel: null,
    note: "Doesn't match any current Dev Zone SDK entry — contains only one utility class (EloSecureUtil), not peripheral/device APIs. Confirm with Elo before pointing techs here.",
    description: 'EloView SDK — a single security-utility class (EloSecureUtil). Not one of the four SDKs currently listed on Elo\'s Dev Zone.'
  }
};

// Elo Dev Zone > SDK lists a "Peripherals SDKs for I-Series devices" entry
// with no counterpart hosted here: eloview-iseries-sdk.zip ships as
// Android sample-app source only, with no generated javadoc/help archive
// to serve. Surfaced on the landing page as a known gap, not silently
// dropped.
const MISSING_FROM_DEV_ZONE = [
  {
    devZoneLabel: 'Peripherals SDKs for I-Series devices',
    note: 'No hosted docs yet — the source zip (eloview-iseries-sdk.zip) has no generated javadoc/help archive, only Android sample-app source.'
  }
];

function titleize(slug) {
  return slug
    .split(/[-_]/g)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Discover every SDK by scanning docs/*, so new SDK doc drops (unzip a new
// folder into docs/<slug>/) show up automatically without code changes.
function listSdks() {
  if (!fs.existsSync(DOCS_ROOT)) return [];
  return fs
    .readdirSync(DOCS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name;
      const meta = KNOWN[slug] || {};
      return {
        slug,
        name: meta.name || titleize(slug),
        description: meta.description || `${titleize(slug)} — API reference documentation.`,
        devZoneLabel: meta.devZoneLabel,
        note: meta.note,
        path: path.join(DOCS_ROOT, slug)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { DOCS_ROOT, listSdks, titleize, MISSING_FROM_DEV_ZONE };
