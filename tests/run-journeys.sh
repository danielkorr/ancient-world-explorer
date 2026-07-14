#!/usr/bin/env bash
# Deterministic VIA journey runner. Serves the site, drives the ?qa=1 fixture
# through the gstack `browse` binary (Playwright), and asserts the in-page
# verdict from tests/journey.eval.js at desktop AND mobile viewports.
# Exit 0 = all passed, 1 = a check failed (CI-friendly).
#
#   bash tests/run-journeys.sh
#   BROWSE=/path/to/browse PORT=8064 bash tests/run-journeys.sh
#
# All browse commands run in THIS one shell so the daemon persists across them
# (it does not survive separate process spawns).
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-8064}"
URL="http://127.0.0.1:${PORT}/?qa=1&guest=1"

# Locate the browse binary (Windows: browse.exe).
B="${BROWSE:-}"
if [ -z "$B" ]; then
  for c in \
    "$HOME/.claude/skills/gstack/browse/dist/browse.exe" \
    "$HOME/.claude/skills/gstack/browse/dist/browse" \
    ".claude/skills/gstack/browse/dist/browse.exe" \
    ".claude/skills/gstack/browse/dist/browse"; do
    [ -x "$c" ] && { B="$c"; break; }
  done
fi
[ -x "$B" ] || { echo "FATAL: browse binary not found (set BROWSE=...)"; exit 2; }

# Threaded static server (python's default SimpleHTTPServer resets on big files).
python -c "from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler; ThreadingHTTPServer(('127.0.0.1',${PORT}), SimpleHTTPRequestHandler).serve_forever()" >/dev/null 2>&1 &
SRV=$!
cleanup() { kill "$SRV" 2>/dev/null; "$B" stop >/dev/null 2>&1; }
trap cleanup EXIT
sleep 1

# Navigate + wait for window.VIA.ready. A cold daemon (or a fresh viewport) can
# no-op its first page, so retry the whole goto until the app reports ready.
# Navigate to a URL and wait for window.VIA.ready (retrying a cold daemon).
nav_ready() {
  local label="$1" url="${2:-$URL}" ready=0 attempt i
  for attempt in 1 2 3 4; do
    "$B" goto "$url" >/dev/null 2>&1
    "$B" wait --load >/dev/null 2>&1
    for i in $(seq 1 25); do
      [ "$("$B" js "(window.VIA&&window.VIA.ready)?'1':'0'" 2>/dev/null)" = "1" ] && { ready=1; break; }
      sleep 0.3
    done
    [ "$ready" = "1" ] && return 0
    echo "  (${label}: attempt $attempt not ready, re-navigating)"
  done
  return 1
}

# Assert an eval file's {failed,fails} JSON verdict.
assert_verdict() {
  local verdict="$1" label="$2"
  echo "$label verdict: $verdict"
  node -e '
    let v; try { v = JSON.parse(process.argv[1]); } catch { console.error("could not parse verdict ("+process.argv[2]+")"); process.exit(2); }
    if (v.failed === 0) { console.log(process.argv[2] + ": PASSED"); process.exit(0); }
    console.error(process.argv[2] + " FAILED: " + v.fails.join(", ")); process.exit(1);
  ' "$verdict" "$label" || exit $?
}

# Run the main journey at the current viewport (default Roman-lock URL).
run_pass() {
  local label="$1"
  nav_ready "$label" || { echo "FAIL: app never reported ready ($label)"; exit 1; }
  assert_verdict "$("$B" eval tests/journey.eval.js 2>&1 | tail -1)" "$label"
}

# Run mode-split.eval.js against a specific lock state.
run_lock() {
  local label="$1" url="$2"
  nav_ready "$label" "$url" || { echo "FAIL: app never reported ready ($label)"; exit 1; }
  assert_verdict "$("$B" eval tests/mode-split.eval.js 2>&1 | tail -1)" "$label"
}

"$B" viewport 1280x900 >/dev/null 2>&1   # desktop (warms the daemon too)
run_pass "desktop"

"$B" viewport 375x812 >/dev/null 2>&1    # production mobile breakpoint
run_pass "mobile"

# Mode split (Phase 1) + guided journey (Phase 2). ?lock= overrides the inline
# per-page lock, so all three states drive off the one local index.html. Mobile
# viewport, since the journey is a mobile-first affordance.
run_lock "lock=roman"     "http://127.0.0.1:${PORT}/?qa=1&guest=1&lock=roman"
run_lock "lock=alexander" "http://127.0.0.1:${PORT}/?qa=1&guest=1&lock=alexander"
run_lock "lock=none"      "http://127.0.0.1:${PORT}/?qa=1&guest=1&lock=none"

echo "ALL VIEWPORTS GREEN"
