## Mobile UI Notes - 2026-06-18

Short implementation note for the top-of-map controls, mobile behavior, and
testability work.

### Search

- The app now has a top search box for existing VIA sites and locations.
- Search matches against:
  - ancient site name
  - modern location name
  - type
  - period text
  - id / Pleiades id
- Search results are grouped into `Sites`, `Locations`, and `Context`.
- Result selection must go through the existing site-panel flow, not a separate panel path.

### Search + Clusters

- A search-selected site may be hidden inside a marker cluster.
- The fix is to reveal the actual marker before opening the panel, so the user can visually confirm the target on the map.
- In live behavior, the reveal path uses cluster expansion; in `?qa=1` mode it stays synchronous so deterministic browser tests remain stable.

### Search Visibility Cue

- Desktop: search-selected markers get a short one-shot pulse immediately after reveal.
- Mobile: the useful cue is after the user closes the site panel, not during panel open.
- The selected marker now pulses after `closePanel()` on mobile so the user can see where the site actually sits on the map.
- The pulse is intentionally one-shot, not continuous, because the map is visually busy and persistent animation adds noise.

### Era Toggle

- `ANCIENT / MODERN` was moved out of the crowded top bar into its own floating control.
- Reason: after search selection and map pan, the top bar had too much competition between:
  - search box
  - era toggle
  - profile pill
- Mobile priority is:
  - search box
  - floating era toggle below search
  - profile pill separate at top-right

### Mobile Spacing / Safe Area

- Mobile top controls now use safe-area-aware spacing.
- Search results open as a fixed sheet below the floating era toggle rather than directly under the input.
- This reduces overlap and keeps the era toggle reachable during mobile search interactions.

### Build / Version Stamp

- The Leaflet bottom-right attribution/build stamp was getting covered by bottom graphics/controls on mobile.
- Mobile now uses a dedicated `#build-badge` near the upper-right instead.
- Desktop still relies on the normal Leaflet attribution area.

### Mobile Testing Workflow

- Do not rely on GitHub Pages as the primary mobile QA loop. Mobile browser caching there was too stale to support iteration.
- Preferred real-phone workflow is local LAN preview from the current repo:
  - run `.\tests\start-mobile-preview.ps1`
  - open the printed `http://<LAN-IP>:8000/` URL on the phone
- This avoids deploy delay, CDN/browser cache confusion, and uncertainty about whether the phone is seeing the current build.

### Testing

- Deterministic browser journeys cover both desktop and mobile viewport modes.
- Tests assert:
  - stable search selectors
  - search result opening / selection
  - search preview state
  - selected-site panel selectors
  - desktop/mobile core control availability
