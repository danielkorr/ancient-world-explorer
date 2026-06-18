#!/usr/bin/env bash
# Deterministic VIA journey runner. Serves the site, drives the ?qa=1 fixture
# through the gstack `browse` binary (Playwright), and asserts the in-page
# verdict from tests/journey.eval.js. Exit 0 = all passed, 1 = failure.
#
#   bash tests/run-journeys.sh
#   BROWSE=/path/to/browse PORT=8064 bash tests/run-journeys.sh
#
# All browse commands run in THIS one shell so the daemon persists across them
# (it does not survive separate process spawns — see tests notes).
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

"$B" viewport 1280x900 >/dev/null 2>&1   # warm the daemon

# Navigate + wait for window.VIA.ready. A cold daemon can no-op its first page,
# so retry the whole goto until the app reports ready.
ready=0
for attempt in 1 2 3 4; do
  "$B" goto "$URL" >/dev/null 2>&1
  "$B" wait --load >/dev/null 2>&1
  for i in $(seq 1 25); do
    [ "$("$B" js "(window.VIA&&window.VIA.ready)?'1':'0'" 2>/dev/null)" = "1" ] && { ready=1; break; }
    sleep 0.3
  done
  [ "$ready" = "1" ] && break
  echo "  (attempt $attempt: app not ready, re-navigating)"
done
[ "$ready" = "1" ] || { echo "FAIL: app never reported ready at $URL"; exit 1; }

VERDICT="$("$B" eval tests/journey.eval.js 2>&1 | tail -1)"
echo "verdict: $VERDICT"

# Parse the JSON verdict and set the exit code.
node -e '
  let v; try { v = JSON.parse(process.argv[1]); } catch { console.error("could not parse verdict"); process.exit(2); }
  if (v.failed === 0) { console.log("ALL JOURNEYS PASSED"); process.exit(0); }
  console.error("FAILED checks: " + v.fails.join(", ")); process.exit(1);
' "$VERDICT"
