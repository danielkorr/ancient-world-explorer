#!/usr/bin/env node
// VIA — WebKit + touch emulation test (the path the gstack `browse` binary can't reach).
//
// WHY THIS EXISTS
// `browse` is Playwright *Chromium* only, with no touch emulation: it can't set
// `hasTouch`, so VIA's `COARSE_POINTER` branch never engages and the delegated
// `touchend` handlers (markers, roads, coverage dots) are never exercised. iOS
// Safari is also a different *engine* (WebKit) whose tap-synthesis quirks are
// exactly where VIA's load-bearing mobile bugs live ("iOS doesn't synthesize a
// click from a tap on a divIcon / SVG path"). This script closes both gaps:
// real WebKit engine + a real touchscreen, driven by Playwright's `webkit` +
// an iPhone device descriptor. It's the closest thing to on-device iOS Safari
// you can run headless. It is NOT a substitute for a real device, but it catches
// the regressions that Chromium structurally cannot.
//
// WHAT IT ASSERTS
//   1. Touch emulation actually engaged (ontouchstart / maxTouchPoints / pointer:coarse).
//   2. A real screen TAP on a site marker opens its panel — i.e. the COARSE_POINTER
//      `touchend` delegation works (the bug class browse can't see).
//   3. A real tap on empty map closes the open panel.
//
// USAGE
//   One-time setup (Playwright + the WebKit browser binary):
//     npm i -D playwright          # or:  npm i -g playwright
//     npx playwright install webkit
//   Run:
//     node tests/webkit-touch/test.mjs
//     PORT=8099 QA=0 node tests/webkit-touch/test.mjs   # QA=0 loads the heavy map (no ?qa fixture)
//
// Exit 0 = all checks passed, 1 = a check failed, 2 = setup/boot problem.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT     = process.env.PORT || '8099';
const USE_QA   = process.env.QA !== '0';                 // default: light ?qa=1 fixture for stability
const SITE_ID  = process.env.SITE || 'cumae';            // an isolated-at-zoom site to tap
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL      = `http://127.0.0.1:${PORT}/?${USE_QA ? 'qa=1&' : ''}guest=1`;

// ── tiny assert harness ──────────────────────────────────
const fails = [];
const ok = (name, cond) => { console.log(`  ${cond ? '✓' : '✗'} ${name}`); if (!cond) fails.push(name); };

// ── load Playwright (clear message if the dev only has the CLI, not the module) ──
let webkit, devices;
try {
  ({ webkit, devices } = await import('playwright'));
} catch {
  console.error('FATAL: the `playwright` module is not installed.\n' +
    '  npm i -D playwright   (then)   npx playwright install webkit');
  process.exit(2);
}

// ── threaded static server (python default resets on the big roads file) ──
const srv = spawn('python', ['-c',
  `from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler;` +
  `ThreadingHTTPServer(('127.0.0.1',${PORT}), SimpleHTTPRequestHandler).serve_forever()`],
  { cwd: repoRoot, stdio: 'ignore' });

let browser;
const cleanup = () => { try { browser && browser.close(); } catch {} try { srv.kill(); } catch {} };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// wait for the server to answer
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch {}
  await sleep(250);
}

try {
  // WebKit + an iPhone descriptor: real Safari engine, hasTouch, isMobile, mobile UA/viewport.
  try {
    browser = await webkit.launch();
  } catch (e) {
    console.error('FATAL: could not launch WebKit. Install it once with:\n' +
      '  npx playwright install webkit\n' + String(e.message || e));
    process.exit(2);
  }
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.VIA && window.VIA.ready, null, { timeout: 20000 })
    .catch(() => {});

  console.log(`WebKit + touch — ${URL}`);

  // 1) touch emulation engaged → COARSE_POINTER branch is live
  const touch = await page.evaluate(() => ({
    onTouchStart: 'ontouchstart' in window,
    maxTouch: navigator.maxTouchPoints,
    coarse: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
    ready: !!(window.VIA && window.VIA.ready),
  }));
  ok('window.VIA.ready', touch.ready);
  ok('touch emulation: ontouchstart', touch.onTouchStart);
  ok('touch emulation: maxTouchPoints > 0', touch.maxTouch > 0);
  ok('touch emulation: pointer:coarse', touch.coarse);

  // 2) real TAP on a site marker opens its panel (the COARSE_POINTER touchend path)
  // Zoom onto the site first so its marker declusters into an individual icon.
  const ll = await page.evaluate((id) => {
    const list = (typeof SITES !== 'undefined') ? SITES : [];
    const s = list.find(x => x.id === id);
    if (!s) return null;
    map.setView([s.lat, s.lng], 14, { animate: false });
    return { lat: s.lat, lng: s.lng };
  }, SITE_ID).catch(() => null);
  ok(`found site "${SITE_ID}"`, !!ll);

  await sleep(900); // let the cluster group decluster + render the individual marker

  const xy = await page.evaluate((id) => {
    const list = (typeof allMarkers !== 'undefined') ? allMarkers : [];
    const m = list.find(mk => mk._site && mk._site.id === id);
    if (!m || !m._icon) return null;
    const r = m._icon.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, SITE_ID).catch(() => null);
  ok(`marker "${SITE_ID}" rendered (individual, not clustered)`, !!xy);

  if (xy) {
    await page.touchscreen.tap(xy.x, xy.y);     // a REAL touch, not a synthesized click
    await sleep(450);                            // > MARKER_DBLTAP_MS (single-tap open delay)
    const opened = await page.evaluate(() =>
      document.getElementById('info-panel').classList.contains('open') &&
      (window.VIA.getState ? window.VIA.getState().panelName : ''));
    ok('tap on marker opened the panel (touchend delegation)', !!opened);
  }

  // 3) real tap on empty map closes the panel
  await page.touchscreen.tap(8, Math.round((await page.viewportSize()).height / 2));
  await sleep(400);
  const closed = await page.evaluate(() =>
    !document.getElementById('info-panel').classList.contains('open'));
  ok('tap on empty map closed the panel', closed);

  ok('no uncaught page errors', errors.length === 0);
  if (errors.length) errors.forEach(e => console.log('    page error:', e));

} finally {
  cleanup();
}

if (fails.length) { console.error(`\nFAIL — ${fails.length} check(s): ${fails.join(', ')}`); process.exit(1); }
console.log('\nPASS — WebKit + touch checks green'); process.exit(0);
