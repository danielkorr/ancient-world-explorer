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
