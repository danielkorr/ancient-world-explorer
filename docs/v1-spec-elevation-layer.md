# VIA Phase 1 Spec — The vici.org Elevation Layer

Status: DRAFT for build. Follows the 2026-06-14 vici investigation + elevation
worklist (`docs/vici-elevation-worklist.{json,md}`, commit `547c3f6`).

## The one-sentence goal

Turn the static elevation worklist into a **living layer on the map**: surface the
Pleiades places that vici.org already has a photo of but the scholarly record
(Wikidata P18) does not — as actionable photo-quests that say "a photo of this
exists in the wild; help get it into humanity's authoritative atlas."

## Why this is the right Phase 1

It's where the scholar payoff is *concentrated* (every one is a sourced elevation
candidate), it operationalizes the whole vici thread, and at this size it needs
**almost no new architecture** — VIA already has zoom-staged disclosure and
tier-filtering (`siteVisibleAtZoom` / `refreshVisibleMarkers` / `activeTiers` in
`app.js`). We widen the catalogue and plug into machinery that already exists.

## Scale (grounded in the dump, not guessed)

- vici has a photo for **~526 distinct Pleiades places** (not 35K — that figure was
  vici points carrying *any* Pleiades id; vici uses `0` for "no link").
- VIA's current 473-site catalogue already overlaps **34** of them (31 already have
  P18, 3 are candidates). So Phase 1 adds up to **~492 net-new** Pleiades places,
  total catalogue **~1,000 sites**.
- Of the ~526, the count lacking P18 (the true elevation candidates) is unknown
  until we run P18 detection across the new ids — likely a few hundred.

---

## DECISION: defer canvas to Phase 2 (recommendation)

The ask included "switch the site layer to canvas." My recommendation is **don't,
not in Phase 1** — here's the honest trade:

- **Not needed at this size.** ~1,000 total divIcons, gated by the existing
  zoom-staged reveal (z≤5 curated only, z6 +quests, z≥7 full set), renders fine.
  The disclosure already exists precisely to avoid "473 dots of orange measles."
- **Canvas would regress the design.** The rich quest markers — shape coding
  (circle/diamond/triangle), the pulsing `quest-ring` motion cue, the visited
  gold-✓ badge — are load-bearing for the colorblind + dual-audience bet
  (`makeIcon` in `app.js`). Canvas circle markers can't carry them at full
  fidelity.
- **Canvas would break the touch model.** The iOS tap handling delegates a
  `touchend` on `markerPane` matched to `.leaflet-marker-icon` DOM nodes
  (`app.js` COARSE_POINTER block). Canvas points have no per-marker DOM, so that
  whole path would need rebuilding — a known-fragile area on this codebase.

**Canvas is a Phase 2 concern** — the jump to the ~5K vici-linked or ~40K full
Pleiades long tail, where it's genuinely required. The right Phase 2 shape is a
**hybrid**: keep rich divIcons for the actionable layer (curated + quests +
elevation), render the quiet *documented* long tail as canvas dots (the pattern
already used for the 80K Itiner-e road vertices on a shared `L.canvas()`). Phase 1
should not pay the canvas cost for a count divIcons handle.

If you'd rather eat the canvas migration now to avoid doing it twice, that's a
legitimate call — but it's a separate, larger piece of work than the catalogue
widening, and it trades away the quest-marker richness today.

---

## 1. Data pipeline

A new auto-generated `js/sites-vici.js` defining `SITES_VICI`, merged into the
global `SITES` the same way `SITES_PLEIADES` is (concat + dedupe by `pleiades` in
`data.js`).

Source of each field:
- **Photo link + elevation evidence** → the vici dump (already parsed by
  `build-elevation-worklist.mjs`): `pnt_id` (vici id), best image (`img_path` →
  `images.vici.org/<transform>/<path>`), creator, license, vici coords/name.
- **Authoritative name / type / period / description** → Pleiades JSON (reuse the
  `.cache/pleiades-json/` cache + `build-sites.mjs` mapping logic). Pleiades
  "Thysdrus" beats vici "Thisdro Col." for the scholar audience. Fall back to vici
  name only if Pleiades has none.
- **Quest tier** → run `detect-pleiades-photos.mjs` across the new ids to extend
  `js/pleiades-photos.json` with P18 status:
  - no P18 → `quest: "photo"` + `elevation: true` (the actionable candidate)
  - has P18 → documented (no quest) — adds coverage, recedes at low zoom

New/changed scripts:
- **`scripts/build-elevation-worklist.mjs`** (extend): add a `--emit-sites` flag
  that also writes `js/sites-vici.js` from the ~526 vici-photo places, deduped
  against existing VIA `pleiades` ids, pulling names/desc from the Pleiades cache.
- **`scripts/detect-pleiades-photos.mjs`** (reuse as-is): run once over the new id
  set so P18 status exists for tier assignment. Order: photos → build-vici-links
  → elevation/sites.

### `SITES_VICI` record shape (matches the existing site schema + 2 fields)

```js
{
  id: "vici-2190", name: "Thysdrus", modern: "El Djem, Tunisia",
  lat: 35.296, lng: 10.707, type: "city", period: "Roman",
  pleiades: "324835", desc: "…(from Pleiades)…",
  quest: "photo",          // omitted when the site already has P18
  elevation: true,         // NEW: this photo-quest has a vici photo to elevate
  vici: { url: "https://vici.org/vici/2190/",
          image: "https://images.vici.org/cover/w1600xh1600/…",
          creator: "Jona Lendering", license: "CC BY 4.0" }
}
```

`rome_days` is omitted → ORBIS resolves live via `orbisLookup` (direct Pleiades
match → nearest node), so the ORBIS card still works for the new sites for free.

---

## 2. Map integration (extends existing machinery)

- **Tiers:** an elevation site is *already* a photo-quest (no scholarly photo), so
  it folds into the existing `photo` tier — no new legend row, no new color, no
  new `QUEST` entry. `tierCounts.photo` simply grows. `siteVisibleAtZoom` reveals
  it at z6 with the other quests; `refreshVisibleMarkers` and the tier filter need
  zero changes.
- **Marker:** reuse the photo-quest divIcon (orange circle + pulsing ring). To
  distinguish "elevate an existing photo" from "no photo anywhere" without relying
  on color, add a small glyph badge on `elevation` markers (e.g. a tiny ⤴ on the
  dot) — colorblind-safe, optional polish, can ship after.
- **Panel (`showPanel`):** when `site.elevation`, the quest banner copy changes
  from "no portrait photo exists" to the elevation pitch — "vici.org already has a
  photo of this; help get it into the scholarly record" — and renders the vici
  image as the hero + a credit/license line. The existing conditional "Vici.org
  Atlas" button (from `VICI_LINKS`) already deep-links the page; here we also show
  the actual image inline.
- **No `map.removeLayer/addLayer`** of groups (the documented mobile-repaint trap)
  — `refreshVisibleMarkers` already does the safe `clearLayers` + `addLayer`.

---

## 3. Files touched

- `scripts/build-elevation-worklist.mjs` — `--emit-sites` → `js/sites-vici.js`.
- `js/sites-vici.js` — NEW generated (`SITES_VICI`).
- `js/pleiades-photos.json` — extended with P18 status for the new ids.
- `js/data.js` — concat + dedupe `SITES_VICI` into `SITES` (mirror the
  `SITES_PLEIADES` merge).
- `js/app.js` — `showPanel` elevation banner + inline vici hero/credit; optional
  `elevation` marker badge in `makeIcon`.
- `index.html` — `<script src="js/sites-vici.js?v=N">` + bump every `?v=` token.
- `css/style.css` — elevation banner / hero-credit styling (+ optional badge).

## 4. Build order

1. Extend `build-elevation-worklist.mjs` with `--emit-sites`; confirm it pulls
   Pleiades names from cache and dedupes against current VIA ids.
2. Run `detect-pleiades-photos.mjs` over the new id set → P18 status.
3. Generate `js/sites-vici.js`; wire into `data.js` + `index.html` (cache-bust).
4. `showPanel` elevation banner + inline vici hero/credit (CSS).
5. Verify perf + disclosure at ~1,000 sites on desktop AND mobile (the
   clearLayers repaint path); confirm tier filter counts update.
6. Optional: `elevation` marker badge.
7. Deploy, dogfood: at z6 the new photo-quests appear; tapping one shows the vici
   photo + "help elevate this" pitch + the live Pleiades/vici links.

## 5. Decisions (resolved 2026-06-14)

1. **Include all ~526** — candidates as photo-quests (`elevation:true`), the rest
   as documented coverage (recede at low zoom). ACCEPTED.
2. **Pleiades-first names**, vici fallback. ACCEPTED. Implemented for free: the
   per-id Pleiades JSON fetched for P18 detection also yields title / placeTypes /
   reprPoint / description, so no separate CSV pass is needed.
3. **Defer the elevation marker badge** — panel copy + inline vici hero carry the
   distinction; badge is later polish. ACCEPTED.
4. **Defer canvas to Phase 2.** ACCEPTED (see the canvas section above).

Implementation note: enrichment is one rate-limited pass of Pleiades JSON over the
net-new ids (cached in `.cache/pleiades-json/`), then a Wikidata P18 batch — both
reuse the `detect-pleiades-photos.mjs` logic. `pleiades-photos.json` is extended
with the new ids' P18 status as a side effect (keeps the worklist consistent).
