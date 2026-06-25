# VIA tests — deterministic browser journeys

Headless browser testing here is **not** open-ended visual exploration (that kept
crashing on the heavy map). It is deterministic: drive the app by intent against a
fixed, light fixture state, then assert on a flat state snapshot + stable selectors.

## Run

PowerShell (Windows):

```powershell
.\tests\run-journeys.ps1
# .\tests\run-journeys.ps1 -Browse C:\path\to\browse.exe -Port 8064
```

POSIX shell:

```bash
bash tests/run-journeys.sh
# BROWSE=/path/to/browse PORT=8064 bash tests/run-journeys.sh
```

Exit `0` = all journeys passed, `1` = a check failed (CI-friendly).

### Mobile visual pass (screenshots, not assertions)

```bash
bash tests/mobile-shots.sh
# BROWSE=/path/to/browse PORT=8065 bash tests/mobile-shots.sh
```

Drives the same `?qa=1` fixture at the 375×812 mobile breakpoint and captures a
viewport screenshot of each key flow (boot, search, site panel, road panel, quest
panel, full-density, modern era, legend) into `tests/screenshots/mobile/`
(gitignored). It **asserts nothing** — it's the first net for eyeballing mobile
chrome + panel layout regressions (you or a paired agent like Codex review the
images). Because `?qa=1` skips the Itiner-e road canvas, these shots cover chrome +
panel *layout*, not map imagery or the secondary-road network — and they are **not**
a substitute for real iOS-Safari touch testing on a device (Chromium doesn't
reproduce iOS tap-synthesis behavior, which is where VIA's load-bearing mobile bugs
live).

## How it works

- **Fixture route `?qa=1`** (see the QA block in `js/app.js`): skips the ~14,800-segment
  Itiner-e road canvas — the layer whose 2.7 MB parse + render intermittently crashes
  headless Chromium — and suppresses the welcome modal + mobile guide. `index.html`
  doesn't even *load* `roads-itinere.js` under `?qa=1`. Result: a light, stable boot.
- **Explicit debug state**: `window.VIA` exposes a drive + assert API —
  `ready`, `qa`, `openSite(id)`, `firstQuestSite(tier)`, `setEra(e)`, `closePanel()`,
  `getState()`. Journeys drive by intent and read `getState()` instead of hunting
  canvas pixels or synthesising marker taps.
- **Stable selectors**: static UI keeps its `#id`s; dynamically-built controls carry
  `data-testid` (e.g. `data-testid="panel-email"`).
- **Machinery**: the gstack `browse` binary (Playwright). All commands run in one shell
  so the browse daemon persists; the runner waits on `window.VIA.ready` (polling, not
  fixed sleeps) and re-navigates once if a cold daemon no-ops its first page.

## Files

- `run-journeys.sh` — serves the site, navigates to `?qa=1`, runs the journey, asserts.
- `journey.eval.js` — the in-page journey + assertions; returns a JSON verdict
  `{failed, fails:[…]}`. Add new checks here.

## Adding a journey

Add `ok('name', condition)` lines to `journey.eval.js`. Prefer driving through
`window.VIA.*` and asserting on `getState()` / a `data-testid`. If you need new state,
extend `getState()` in `js/app.js`; if you need a new selector, add a `data-testid`.
