const express = require('express');
const { chromium } = require('playwright');

const ELO_BASE_URL = 'https://rma.elotouch.com';

// Static in the real page's markup (not part of the region/country AJAX).
const REGIONS = [
  { value: 'usacan', label: 'North America' },
  { value: 'latam', label: 'Mexico/Latin America' },
  { value: 'emea', label: 'Europe/Africa/Middle East' },
  { value: 'apac', label: 'Asia/Pacific' }
];

// Real headless-browser lookups are heavy (memory + several seconds each).
// Cap how many run at once rather than letting concurrent reps pile up
// browser instances and exhaust the container.
const MAX_CONCURRENT_LOOKUPS = 2;
let activeLookups = 0;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Elo Warranty Lookup</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #2f3941; }
  .step { margin-bottom: 18px; }
  .step-label { font-weight: 600; margin-bottom: 6px; }
  select, input[type=text] { width: 100%; padding: 6px 8px; font-size: 13px; border: 1px solid #d8dcde; border-radius: 4px; margin-bottom: 8px; }
  button { background: #1f73b7; color: #fff; border: 0; border-radius: 4px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  button:hover:not(:disabled) { background: #175d92; }
  button:disabled { background: #a9b4bd; cursor: not-allowed; }
  #resultsPane { margin-top: 16px; }
  #resultsPane table { width: 100%; border-collapse: collapse; font-size: 12px; }
  #resultsPane td, #resultsPane th { padding: 6px 8px; border: 1px solid #d8dcde; }
  .status-msg { color: #68737d; font-size: 12px; }
  .error-msg { color: #c0392b; font-size: 12px; }
</style>
</head>
<body>
  <div class="step">
    <div class="step-label">1. Select Region and Country</div>
    <select id="region">
      <option value="">-- Choose Region --</option>
      ${REGIONS.map((r) => `<option value="${r.value}">${escapeHtml(r.label)}</option>`).join('\n      ')}
    </select>
    <select id="country" disabled>
      <option value="">-- Choose Country --</option>
    </select>
  </div>

  <div class="step">
    <div class="step-label">2. Enter Serial Number</div>
    <input type="text" id="serial" placeholder="e.g. K122223333" disabled>
    <button id="lookupBtn" disabled>Lookup</button>
  </div>

  <div id="resultsPane"></div>

  <script>
    var regionSelect = document.getElementById('region');
    var countrySelect = document.getElementById('country');
    var serialInput = document.getElementById('serial');
    var lookupBtn = document.getElementById('lookupBtn');
    var resultsPane = document.getElementById('resultsPane');

    function updateLookupEnabled() {
      lookupBtn.disabled = !(regionSelect.value && countrySelect.value && serialInput.value.trim());
    }

    regionSelect.addEventListener('change', function () {
      countrySelect.innerHTML = '<option value="">-- Choose Country --</option>';
      countrySelect.disabled = true;
      serialInput.disabled = true;
      updateLookupEnabled();
      if (!regionSelect.value) return;

      fetch('/api/warranty/countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: regionSelect.value })
      })
        .then(function (r) { return r.json(); })
        .then(function (countries) {
          countries.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.value;
            opt.textContent = c.label;
            countrySelect.appendChild(opt);
          });
          countrySelect.disabled = false;
        })
        .catch(function () {
          resultsPane.innerHTML = '<p class="error-msg">Could not load country list. Try again.</p>';
        });
    });

    countrySelect.addEventListener('change', function () {
      serialInput.disabled = !countrySelect.value;
      updateLookupEnabled();
    });
    serialInput.addEventListener('input', updateLookupEnabled);

    lookupBtn.addEventListener('click', function () {
      lookupBtn.disabled = true;
      resultsPane.innerHTML = '<p class="status-msg">Looking up warranty status… this can take up to 15 seconds.</p>';

      fetch('/api/warranty/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: regionSelect.value,
          country: countrySelect.value,
          serial: serialInput.value.trim()
        })
      })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Lookup failed'); });
          return r.json();
        })
        .then(function (data) {
          resultsPane.innerHTML = data.html;
        })
        .catch(function (err) {
          resultsPane.innerHTML = '<p class="error-msg">' + (err.message || 'Lookup failed. Try again.') + '</p>';
        })
        .finally(function () {
          updateLookupEnabled();
        });
    });
  </script>
</body>
</html>`;
}

async function fetchCountries(region) {
  const res = await fetch(`${ELO_BASE_URL}/Services/GetCountries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `region=${encodeURIComponent(region)}`
  });
  if (!res.ok) throw new Error(`GetCountries failed: ${res.status}`);
  const countries = await res.json();
  return countries.map((c) => ({ value: c.Value, label: c.Text }));
}

async function lookupWarranty({ region, country, serial }) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${ELO_BASE_URL}/Services`, { waitUntil: 'domcontentloaded' });

    await page.selectOption('#region', region);
    // Their own JS repopulates #country via a real AJAX call on region change.
    await page.waitForFunction(
      () => document.querySelectorAll('#country option').length > 1,
      { timeout: 10000 }
    );
    await page.selectOption('#country', country);
    // The Lookup button is only re-enabled by a keydown handler bound to
    // this field (counts lines typed). fill() sets the value directly and
    // only fires input/change, so it never re-enables the button -- type
    // it as real keystrokes instead.
    await page.locator('#serialNumbers').pressSequentially(serial, { delay: 20 });

    await page.waitForSelector('#warrantySubmit:not(:disabled)', { timeout: 5000 });
    await page.click('#warrantySubmit');

    // Real reCAPTCHA v3 execution + the real POST round-trip happens here.
    await page.waitForFunction(
      () => {
        const pane = document.getElementById('resultsPane');
        return pane && pane.innerHTML.trim().length > 0;
      },
      { timeout: 25000 }
    );

    return await page.$eval('#resultsPane', (el) => el.innerHTML);
  } finally {
    await browser.close();
  }
}

const router = express.Router();

router.get('/warranty', (req, res) => {
  res.type('html').send(page());
});

router.post('/api/warranty/countries', express.json(), async (req, res) => {
  try {
    const region = (req.body.region || '').toString();
    if (!region) return res.status(400).json({ error: 'Missing region' });
    res.json(await fetchCountries(region));
  } catch (err) {
    console.error('[warranty] countries proxy error:', err);
    res.status(502).json({ error: 'Could not reach Elo’s country list.' });
  }
});

router.post('/api/warranty/lookup', express.json(), async (req, res) => {
  const { region, country, serial } = req.body || {};
  if (!region || !country || !serial) {
    return res.status(400).json({ error: 'Missing region, country, or serial number.' });
  }

  if (activeLookups >= MAX_CONCURRENT_LOOKUPS) {
    return res.status(503).json({ error: 'Too many lookups in progress. Try again in a moment.' });
  }

  activeLookups += 1;
  try {
    const html = await lookupWarranty({ region, country, serial });
    res.json({ html });
  } catch (err) {
    console.error('[warranty] lookup automation error:', err);
    res.status(502).json({ error: 'Warranty lookup is currently unavailable. Elo’s page may have changed.' });
  } finally {
    activeLookups -= 1;
  }
});

module.exports = { router };
