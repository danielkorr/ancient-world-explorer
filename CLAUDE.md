# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VIA — Ancient World Explorer. A static, single-page Leaflet map that overlays the Roman world on a modern basemap, surfaces ~95 ancient sites, 14 Roman roads, and flags "quests" (sites missing photos or verified coordinates in the Pleiades scholarly gazetteer).

## Running / Developing

No build, no package manager, no tests. It's plain HTML/CSS/JS with Leaflet loaded from a CDN.

- Open `index.html` directly works for read-only map browsing, but auth + Supabase need a real origin. Serve with `python -m http.server 8000` and load `http://localhost:8000`. The Supabase redirect-URL allowlist must include whatever origin you use.
- Deploy target is GitHub Pages — pushing to `main` ships the site.
- **Cache-bust on every css/js change.** Local assets carry a `?v=N` token in `index.html` (currently `v10`). Bump it on *every* css/js edit or mobile Safari serves stale code — it caches sub-resources hard. A `?v=` on the page URL alone does not work (the HTML refreshes but the cached sub-resources don't). When a deployed mobile site shows old behavior after a fix, suspect a stale URL/HTML cache *before* the code: confirm the canonical Pages URL (nothing after the base path), force a fresh HTML fetch with a throwaway `?fresh=1`, and verify the served asset `?v=` matches HEAD.

## Architecture

Three files do everything; understanding how they interact matters more than any individual file:

- **`js/data.js`** — Holds `SITES_CURATED` (the rich hand-written sites) and `ROADS` (the 14 hand-curated named roads — Via Appia, Via Egnatia, etc., with rich `name`/`desc`/`built` tooltip copy). At the bottom it derives the global `SITES` by concatenating `SITES_CURATED` with any non-duplicate entries from `SITES_PLEIADES` (deduped by `pleiades` id). This is the entire content model for curated content. Site fields used by the UI: `id, name, modern, type, lat, lng, period, pleiades, rome_days, rome_mode, desc, quest`. Quest tier is set per-site via the optional `quest: "photo" | "location" | "text"` field — absence means "documented." `rome_days: 0` hides the ORBIS card.
- **`js/roads-itinere.js`** — Auto-generated, do not hand-edit. Defines `ROADS_ITINERE` (~14,800 segments, ~80,000 vertices after simplification) from the Itiner-e v1.3 scholarly atlas (De Soto et al. 2025, https://doi.org/10.5281/zenodo.17122148, **CC BY 4.0**). Rendered as a subtle amber baseline beneath the hand-curated 14 from `ROADS`. Regenerate with `node scripts/build-roads.mjs`. Flags: `--refresh` to re-download the 78 MB GeoJSON, `--tol=<deg>` to tune Douglas-Peucker simplification (default 0.005° ≈ 500 m), `--max=<n>` for smoke tests. Build script reprojects from EPSG:3857 → WGS84 inline (the source dataset ships in Web Mercator metres, not standard GeoJSON lng/lat). Attribution is added at runtime via `map.attributionControl.addAttribution` — required by CC BY 4.0.
- **`js/sites-pleiades.js`** — Auto-generated, do not hand-edit. Defines `SITES_PLEIADES` from the Pleiades CSV dump. Regenerate with `node scripts/build-sites.mjs` (uses `.cache/` for the downloaded dump; pass `--refresh` to re-fetch, `MAX_SITES=<n>` env var to change the cap).
- **`js/pleiades-photos.json`** — Output of `node scripts/detect-pleiades-photos.mjs`. Maps Pleiades id → `{has_photo, wikidata, image, reason}` by triangulating Wikidata P18 across each site's references. Consumed by `build-sites.mjs` to promote sites with no portrait photo to `quest: "photo"` (location quests always win — a missing GPS is a stronger signal than a missing image). Regenerate before `build-sites.mjs` if you want fresh photo signal; otherwise the cached JSON wins. Flags: `--sample N` for a smoke test, `--refresh` to bust the per-site Pleiades JSON cache in `.cache/pleiades-json/`.
- **`js/orbis-days.js`** — Auto-generated, do not hand-edit. Holds `ORBIS_BY_PLEIADES` (pleiades id → days/mode, from running Dijkstra over the ORBIS network from Rome) and `ORBIS_NODES` (the full reachable node table used for runtime nearest-node fallback when a site has no direct Pleiades match). Regenerate with `node scripts/build-orbis.mjs`. The runtime resolver lives in `app.js` (`orbisLookup`) and prefers direct match → nearest within 75km → the legacy hardcoded `rome_days` on curated sites.
- **`js/app.js`** — Runs top-to-bottom on load (no DOMContentLoaded guard; scripts are at end of `<body>`). Reads `SITES`/`ROADS`/`ROADS_ITINERE` as globals, builds the Leaflet map, three tile layers (`ancientLayer` = DARE tiles on top, `ancientFallbackLayer` = sepia-tinted CARTO under DARE in ancient mode, `modernLayer` = CARTO Voyager for modern mode), and three `LayerGroup`s (`itinereRoadsGroup`, `roadsGroup`, `sitesGroup`). The Itiner-e baseline renders on a shared `L.canvas()` for performance (14k segments would melt SVG). The `TYPE` and `QUEST` config objects at the top of `app.js` map type/quest strings to colors and icons — they must stay in sync with the values used in `data.js`. The "Roads" toggle covers both road groups together (users think of "roads" as one concept).
- **`index.html`** — Static DOM scaffold for the topbar, bottom controls, quest legend, and info panel. `app.js` populates these by `getElementById`; the panel uses fixed element IDs (`hero-icon`, `panel-name`, `orbis-card`, `panel-actions`, etc.) — changing IDs in HTML requires matching changes in `app.js`.

Interaction model:
- Era toggle (`setEra`) swaps `ancientLayer`/`modernLayer` and re-brings roads + sites to front. Site coordinates do not change.
- Layer toggle (`toggleLayer`) adds/removes the group from the map; state lives in the `layerState` object.
- Marker click → `showPanel(site)` which rewrites the right-hand info panel and pans the map (right-offset on desktop, up-offset on mobile, breakpoint `<=640px`). On the *first* open it snapshots the pre-pan view into `panelReturnView`; `closePanel` flies back to it so dismissing the panel returns you whence you came instead of leaving you on the offset pan.
- **Do not "simplify" mobile taps back to `marker.on('click')`.** iOS Safari does not reliably synthesize a click from a tap on Leaflet divIcon markers or SVG path layers, so `.on('click')` never fires on-device (markers were 0/10, roads ~1/10) — hit-target size and panel CSS are red herrings. Taps are handled directly via a touch-only (COARSE_POINTER) delegated `touchend` on the marker/overlay pane that matches `e.target.closest` to the layer and calls the action itself (with `preventDefault` to suppress any late click, 12px drag threshold so pans don't count). `?debug=1` shows an on-screen event-log overlay for diagnosing this on a real phone.
- **Never `map.removeLayer`/`addLayer` a `LayerGroup` to toggle it on mobile.** Removing then re-adding a group and mutating its contents in the same tap handler does not repaint on mobile Safari (markers stay invisible until the next map move); desktop Chromium repaints synchronously and hides the bug. Keep groups permanently on the map and only change their contents (`clearLayers` + `addLayer`).
- Info panel CSS class `.open` controls visibility; mobile vs desktop layout is pure CSS in `css/style.css`.
- **Welcome modal** (`#welcome-modal`): the cold-start intro — explains what VIA is and the contribute-to-the-record pitch. `maybeShowWelcome()` (bottom of `app.js`) auto-opens it on the first visit, gated on `localStorage['via.welcomed']` (set by `closeWelcome`); skipped when `?signin=1` is present so it doesn't stack on the auto-opening sign-in modal. Reopen anytime via `openWelcome()` — wired to the `#app-brand` (the "VIA" title) click + keyboard. Styled with the shared `.auth-*` modal classes.
- **External action buttons** (Google Maps / Satellite / Pleiades, built in `showPanel`): navigate in the **same tab** (not `target=_blank`) so the browser Back gesture — the one universal "go back" on every device — returns to VIA. `onclick="saveReturnState()"` stashes the open site id + home view to `sessionStorage['via.return']`; `restoreReturnState()` (bottom of `app.js`) reads it on the Back-reload and reopens that site's panel at the same view, then self-clears. The ↗ glyph (`.p-btn-ext`) signals the button leaves VIA.

## Notes for editing

- Adding a site = append to `SITES` in `data.js`. No registration step.
- Adding a road = append to `ROADS`; coords are `[lng, lat]` pairs (note the order — flipped when fed to Leaflet at `app.js:46`).
- Adding a new `type` or `quest` value requires adding a matching entry to the `TYPE` / `QUEST` config objects in `app.js`.

## Social layer (auth + check-ins)

`js/auth.js` exposes a provider-agnostic API at `window.VIA.auth` — `currentUser`, `signIn(name)`, `signOut`, `checkIn(site)`, `removeCheckIn(site)`, `getCheckin(site)`, `getUserCheckins`, `getSiteVisitCount(site)`, `onChange(fn)`. Today it's backed by `LocalBackend` (localStorage); the file's data-model header doubles as the **Supabase schema spec** for when we provision the cloud backend.

**Backend selection (live, dual-mode)**: `auth.js` ships both `LocalBackend` and `SupabaseBackend` behind the same `VIA.auth.*` interface. The active backend is chosen at boot by `pickBackend()`: **SupabaseBackend by default** whenever the Supabase JS client is available; LocalBackend ("guest mode") if `localStorage['via.guest'] === '1'` OR the URL has `?guest=1`. UI code is backend-agnostic. The sign-in modal has five states driven by `data-state`: `signed-out` (email + magic link) → `link-sent` → `signed-in` (cloud) or `guest` (local) or `import` (first cloud sign-in with local check-ins to merge). Guest↔cloud transitions reload the page; the `?signin=1` query param is the breadcrumb that auto-opens the modal post-reload. `lat/lng` on check-ins captures the user's actual GPS at visit time (foundation for the future "near me" stage).

**Schema:** the canonical schema lives in `supabase/migrations/0001_init.sql`; `supabase/README.md` documents the setup + phased migration plan. RLS is ON for all three tables (`profiles`, `checkins`, `journeys`). Profiles + checkins are publicly readable for social proof on the map; only the owner can write their own rows. `checkins` is added to the `supabase_realtime` publication for the future live "X just checked in" pulse.

**Security invariant — admin authority never lives on a user-writable row.** Do not add an `is_admin`/role flag to `profiles` (or any table with an owner-update RLS policy using `auth.uid() = id`): it is self-escalatable — any user can `update profiles set is_admin = true`. Keep admin authority in a separate table with *no* write policy (RLS denies all API writes; grant only via the service role / SQL editor), gated by a `SECURITY DEFINER is_admin()` helper.

**ES256 auth wedge (load-bearing — the whole `sb.auth.*` API is poisoned):** Supabase projects with ES256 asymmetric signing keys (the new default for projects created in 2025+) wedge essentially every `supabase.auth.*` method in supabase-js 2.49.4 because they internally call `getUser()`, which hangs forever on ES256 tokens. The mobile path sometimes lucks past it via timing; desktop reliably dies. Four mitigations stack in `auth.js` — removing any one re-breaks sign-in:

1. **Client construction** (`auth.js:39-46`): `autoRefreshToken: false`, `detectSessionInUrl: false`, `lock: (n,t,fn) => fn()` (disable Web Locks). Without these, boot itself hangs.
2. **Magic-link landing** (`auth.js:56-86`): never call `setSession()`. Decode the `#access_token=...` JWT payload by hand, write the full session shape (`{access_token, refresh_token, expires_in, expires_at, token_type, user}`) to `localStorage['sb-<projectRef>-auth-token']`, `history.replaceState` to strip the hash, then `location.reload()`.
3. **Boot hydration** (`auth.js` `SupabaseBackend.init`): never call `sb.auth.getSession()` — also hangs. Read the same `localStorage` key, decode the JWT payload, check `payload.exp` against `Date.now()/1000`, set `_user` optimistically from `{sub, email, user_metadata.name}` and `emit()` immediately so the pill paints on the first frame. Enhance from the `profiles` row in the background (`.from()` queries authenticate fine — only `sb.auth.*` is poisoned).
4. **`onAuthStateChange`**: keep registered for `SIGNED_OUT` and cross-tab events, but do **not** rely on `INITIAL_SESSION` firing — it doesn't fire reliably on cold boot with an ES256 token.

`.from(...)` PostgREST queries work because supabase-js reads the Authorization header straight from the same storage key. Refresh on demand later when 401s appear. The supabase-js version is pinned in `index.html`; do not bump blindly — later patches may or may not fix this.

UI bindings live at the bottom of `app.js`:
- `refreshProfilePill` — topbar pill state (signed-in vs anonymous)
- `refreshCheckinRow` — info panel check-in button + visit-count line
- `refreshAllMarkers` — re-renders all site icons so the visited green badge appears/disappears live when check-ins change
- All three subscribe to `VIA.auth.onChange` so any backend write fans out to the UI without manual plumbing.

## gstack

This environment has the [gstack](https://github.com/garrytan/gstack) skill suite installed.

- Use the `/browse` skill for all web browsing, screenshots, and live-site testing.
- Never use the `mcp__claude-in-chrome__*` tools; `/browse` replaces them.

Available gstack skills:

`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.
