#!/usr/bin/env bash
# Mobile-width visual QA pass for VIA. Serves the site, drives the ?qa=1 fixture
# through window.VIA.* at the 375x812 production mobile breakpoint, and captures a
# viewport screenshot of each key flow into tests/screenshots/mobile/.
#
# Companion to run-journeys.sh: that one ASSERTS behavior (pass/fail); this one
# CAPTURES layout so you (or Codex) can eyeball the mobile chrome + panels for
# regressions. Runs on ?qa=1 for headless stability — the heavy Itiner-e road
# canvas is skipped in that mode (see app.js `const QA`), so these shots are for
# CHROME + PANEL LAYOUT, not map imagery or the secondary-road network. Imagery and
# real iOS-Safari touch behavior still need a real device (by design).
#
#   bash tests/mobile-shots.sh
#   BROWSE=/path/to/browse PORT=8065 bash tests/mobile-shots.sh
#
# Exit 0 if every shot was captured; non-zero if the app never booted.
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-8065}"
URL="http://127.0.0.1:${PORT}/?qa=1&guest=1"
OUT="tests/screenshots/mobile"
mkdir -p "$OUT"

# Locate the browse binary (Windows: browse.exe). Same search order as run-journeys.sh.
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

# Threaded static server (python's default SimpleHTTPServer resets on the big roads file).
python -c "from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler; ThreadingHTTPServer(('127.0.0.1',${PORT}), SimpleHTTPRequestHandler).serve_forever()" >/dev/null 2>&1 &
SRV=$!
cleanup() { kill "$SRV" 2>/dev/null; "$B" stop >/dev/null 2>&1; }
trap cleanup EXIT
sleep 1

# Navigate + wait for window.VIA.ready, retrying a cold daemon's first no-op page.
nav_ready() {
  local ready=0 attempt i
  for attempt in 1 2 3 4; do
    "$B" goto "$URL" >/dev/null 2>&1
    "$B" wait --load >/dev/null 2>&1
    for i in $(seq 1 25); do
      [ "$("$B" js "(window.VIA&&window.VIA.ready)?'1':'0'" 2>/dev/null)" = "1" ] && { ready=1; break; }
      sleep 0.3
    done
    [ "$ready" = "1" ] && return 0
    echo "  (attempt $attempt not ready, re-navigating)"
  done
  return 1
}

# Drive the page (optional js expression) then capture the 375x812 viewport.
shot() {
  local name="$1" driver="${2:-}"
  if [ -n "$driver" ]; then "$B" js "$driver" >/dev/null 2>&1; fi
  sleep 0.5   # let panel slide / era swap / render settle
  "$B" screenshot --viewport "$OUT/${name}.png" >/dev/null 2>&1 \
    && echo "  ✓ ${name}.png" \
    || echo "  ✗ ${name}.png (capture failed)"
}

"$B" viewport 375x812 >/dev/null 2>&1   # production mobile breakpoint
nav_ready || { echo "FAIL: app never reported ready"; exit 1; }
echo "Capturing mobile (375x812) flows -> $OUT/"

# 00 — cold boot: map + topbar + shrunk era toggle + dock, no panel.
shot 00-boot

# 01 — search dropdown (open the mobile dock search, then a query that hits a road + sites).
shot 01-search "(function(){ if(typeof openDockPanel==='function') openDockPanel('search'); var h=window.VIA.searchSites('appia'); return 'hits:'+(h?h.length:0); })()"

# 02 — curated site panel (rich: hero, details, related links, check-in row).
shot 02-site-panel "(function(){ if(typeof closeSearchResults==='function') closeSearchResults(); window.VIA.openSite('cumae'); return window.VIA.getState().panelName; })()"

# 03 — road panel (curated road tap → the segment panel layout + nearby sites).
shot 03-road-panel "(function(){ window.VIA.closePanel(); window.VIA.tapRoad('Via Appia'); return 'road'; })()"

# 04 — photo-quest panel (quest banner + share/email affordances).
shot 04-quest-panel "(function(){ window.VIA.closePanel(); var q=window.VIA.firstQuestSite('photo'); if(q&&q.id) window.VIA.openSite(q.id); return q?q.id:'none'; })()"

# 05 — full catalogue density (detail slider → all sites, clustered, at mobile width).
shot 05-detail-all "(function(){ window.VIA.closePanel(); window.VIA.setDetail(2); return window.VIA.getState().visibleSiteCount; })()"

# 06 — modern era chrome (basemap swap; verify the toggle's active state + layout).
shot 06-era-modern "(function(){ window.VIA.setDetail(0); window.VIA.setEra('modern'); return window.VIA.getState().era; })()"

# 07 — quest legend / key (the on-mobile legend popover).
shot 07-legend "(function(){ window.VIA.setEra('ancient'); window.VIA.openLegend(); return 'legend'; })()"

echo "DONE — $(ls -1 "$OUT"/*.png 2>/dev/null | wc -l | tr -d ' ') shots in $OUT/"
