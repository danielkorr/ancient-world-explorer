---
name: webkit-touch
description: Run VIA's touch-path regression test on the real WebKit engine with an iPhone touchscreen — the iOS-Safari tap behavior the gstack `browse` (Chromium, no touch) binary structurally cannot reproduce. Use when changing marker/road/coverage tap handling, the COARSE_POINTER branch, or anything touch-related, and when you want headless coverage of the load-bearing mobile bug class before a real-device pass.
---

# webkit-touch — iOS-Safari-shaped touch testing for VIA

## When to use this

Reach for this whenever a change touches the **touch interaction layer**:

- the `COARSE_POINTER` branch in `js/app.js`
- the delegated `touchend` handlers on the marker pane / overlay pane (marker taps,
  curated-road taps, Itiner-e segment taps, coverage-dot taps)
- single-tap vs double-tap discrimination (`MARKER_DBLTAP_MS`, `ROAD_DBLTAP_MS`)
- anything where "works on desktop, dead on iPhone" is a plausible failure

## Why `browse` is not enough (the gap this fills)

The gstack `browse` binary is Playwright **Chromium only** and exposes **no touch
emulation**. Concretely:

- It cannot set `hasTouch`, so in VIA `COARSE_POINTER` evaluates **false** and the
  `touchend` delegation never attaches — `browse` always drives the desktop mouse
  path. `browse viewport 375x812` only resizes; it does not make the page "a touch
  device."
- It cannot run the **WebKit** engine, so iOS Safari's tap-synthesis quirks (the
  documented "iOS doesn't synthesize a `click` from a tap on a divIcon / SVG path"
  problem) are invisible to it.
- It does have a *headed* mode (`browse connect` / `browse handoff`), but still
  Chromium, still no touch.

This script uses Playwright's `webkit` browser + the `iPhone 13` device descriptor:
real Safari/WebKit engine, `hasTouch`, `isMobile`, mobile viewport + UA, and a real
`page.touchscreen.tap()`. It is the closest headless approximation of on-device iOS
Safari. It is **not** a replacement for a real device — final mobile sign-off still
needs a phone — but it catches the touch regressions Chromium cannot.

## One-time setup

This repo has no `package.json` (the other tests reuse the browse binary's bundled
Chromium). WebKit needs Playwright's own browser binary, so install once:

```bash
npm i -D playwright            # or: npm i -g playwright
npx playwright install webkit  # downloads the WebKit browser (~100 MB, one time)
```

`node_modules/` is not gitignored here yet — if you install locally, add it to
`.gitignore` or use the global install (`-g`).

## Run

```bash
node tests/webkit-touch/test.mjs
```

Options (env vars):

- `PORT=8099` — static-server port (default 8099).
- `QA=0` — load the **heavy** map (no `?qa=1` fixture) so the Itiner-e road canvas
  is present. Default (`QA=1`) skips that canvas for headless stability and covers
  the marker + curated-road + coverage touch paths. Use `QA=0` only to exercise the
  **Itiner-e segment** touch path, and expect more flakiness.
- `SITE=cumae` — which site marker to tap (must be one that declusters at zoom 14).

Exit `0` = all checks green, `1` = a check failed, `2` = setup/boot problem
(WebKit not installed, server never came up).

## What it checks

1. **Touch emulation is real** — `ontouchstart`, `navigator.maxTouchPoints`, and
   `matchMedia('(pointer: coarse)')` all confirm the `COARSE_POINTER` branch is live.
2. **Marker tap opens the panel** — a real `touchscreen.tap()` on a site marker
   triggers the `touchend` delegation and opens `#info-panel`. This is the exact
   path that reads as broken on iOS when it regresses.
3. **Empty-map tap closes the panel** — confirms the map's tap-to-dismiss still fires.
4. **No uncaught page errors** during the run.

## How it works (so you can extend it)

- Spawns the same **threaded** python static server the other tests use (the single-
  threaded default resets on the 2.7 MB roads file).
- Drives by intent through globals already on the page: `window.VIA` (the QA
  drive/assert API), plus `map`, `SITES`, and `allMarkers` via `page.evaluate`.
- To tap a marker reliably it first `map.setView(...)`s onto the site at zoom 14 so
  the marker cluster declusters into an individual `.leaflet-marker-icon`, reads that
  icon's screen rect, then taps its center.

### Adding a case

Add another `ok('name', condition)` block. For a new touch target, compute its
screen point in a `page.evaluate` (via `map.latLngToContainerPoint` + the container
rect, or an element's `getBoundingClientRect`), then `page.touchscreen.tap(x, y)`,
wait past the relevant double-tap window, and assert on `window.VIA.getState()` or a
`data-testid`. Mirror the conventions in `tests/README.md`.

## Relationship to the other test scripts

- `tests/run-journeys.sh` — deterministic **desktop** behavior assertions (browse/Chromium).
- `tests/mobile-shots.sh` — mobile-width **screenshots** for layout eyeballing (browse/Chromium, mouse path, no touch).
- `tests/webkit-touch/test.mjs` — **touch behavior** on the WebKit engine (this skill). The only one that exercises `COARSE_POINTER` + `touchend`.

To make this invocable as a project slash-command, copy or symlink this directory
into `.claude/skills/webkit-touch/` (note `.claude/` is gitignored, so the canonical
copy lives here in `tests/`).
