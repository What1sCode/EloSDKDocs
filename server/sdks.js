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
    name: 'EloView Home SDK',
    devZoneLabel: 'Device Level SDKs for all EloView enabled devices',
    description: 'EloView Home SDK 6.25.520 — integrate an Android app with EloView (jar + javadoc for the jar\'s APIs).'
  },
  'eloviewhomesdk-legacy': {
    name: 'EloView Home SDK 5.33.70 (Legacy)',
    devZoneLabel: 'Device Level SDKs for all EloView enabled devices',
    description: 'EloView Home SDK 5.33.70 — superseded by 6.25.520 (package root renamed homesdk → sdk); kept for techs supporting devices still on the older SDK.'
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
  // Named "Eloview Device Level SDK" in Elo's own download, but the jar
  // only exposes a single utility class (EloSecureUtil) — not peripheral/
  // device APIs. Naming is now authoritative; the content being this thin
  // is still worth confirming with Elo before leaning on it for support.
  'eloviewsdk': {
    name: 'EloView Device Level SDK',
    devZoneLabel: null,
    note: 'Elo ships this under the name "Eloview Device Level SDK", but it contains only one utility class (EloSecureUtil) — confirm with Elo whether this is the complete/current API before relying on it for support.',
    description: 'EloView Device Level SDK — a single security-utility class (EloSecureUtil).'
  },
  // New drop, no confirmed match on Elo's Dev Zone SDK tab — package is
  // com.elotouch.elopay.library(.usb/.wifi/.version), distinct from the
  // com.elo.device package used by EloPayPoint Android SDK above.
  'elo-peripheral-sdk': {
    name: 'Elo Peripheral SDK (EloPay)',
    devZoneLabel: null,
    note: 'No confirmed Dev Zone category — built for the 7100p peripheral (EloPeripheralSDK 7.000.006.0072+7100p). Distinct package (com.elotouch.elopay.library) from EloPayPoint Android SDK\'s com.elo.device; confirm with Elo if these should be presented as one family.',
    description: 'Elo Peripheral SDK for the 7100p peripheral — USB/WiFi peripheral control and versioning APIs (com.elotouch.elopay.library).'
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
