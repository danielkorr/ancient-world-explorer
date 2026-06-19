# AGENTS.md — context for Codex / outside-voice reviewers

**Read `./CLAUDE.md` first.** It is the full project guide (architecture, data model,
the social/auth layer, and the build scripts). This file is just the short list of
landmines you most need before reviewing or suggesting changes.

VIA — Ancient World Explorer: a static, single-page Leaflet map overlaying the Roman
world on a modern basemap (~95 ancient sites, Roman roads, quests for missing
scholarly documentation). Supabase backs auth + check-ins.

## Landmines (do not relearn these the hard way)

- **ES256 auth wedge.** This Supabase project uses ES256 asymmetric signing keys, which
  hang essentially every `supabase.auth.*` method in supabase-js 2.49.4 (they call
  `getUser()` internally, which never returns). The code works around it by decoding
  JWTs by hand from `localStorage` and using ONLY `.from()` PostgREST queries (those
  authenticate fine via the Authorization header). See `js/auth.js`. Never suggest
  `sb.auth.getSession()`, `setSession()`, `signOut()`, etc. — they are poisoned here.
  Note: `sb.storage.*` is a *third* subsystem; whether it is wedge-safe is unverified —
  flag any plan that assumes it is without proof.

- **No build, no package manager, no tests.** Plain HTML/CSS/JS with Leaflet from a CDN.
  Don't propose webpack/vite/jest/a framework. "Run the tests" doesn't exist; QA is
  manual (`/browse` + dogfooding). Deploy = push to `main` (GitHub Pages).

- **Auto-generated files — never hand-edit.** `js/roads-itinere.js`,
  `js/sites-pleiades.js`, `js/orbis-days.js`, `js/pleiades-photos.json`. They are
  rebuilt by scripts in `scripts/`. Edits belong in the generators, not the output.

- **Cache busting.** Local assets carry a `?v=N` token in `index.html` (currently v10).
  Bump it on EVERY css/js change or mobile Safari serves stale code. `?v=` on the page
  URL alone does NOT work — each sub-resource reference must be bumped.

- **Content model.** Curated sites + roads live in `js/data.js`; it derives the global
  `SITES`. `TYPE` / `QUEST` config objects in `js/app.js` must stay in sync with the
  type/quest strings used in `data.js`. Quest tier data reality: photo≈279, location≈10,
  text=0, documented≈184 — don't assume all tiers are populated.

## Active work

In-progress spec: `docs/v1-spec-photo-quest.md` (the v1 Photo-Quest contribution loop:
new `contributions` table, two storage buckets, Edge Function move-on-approve, EXIF
strip, first-to-document credit, affiliate links). Roadmap + deferred items: `TODOS.md`.

## Rethinking the Core Layers of Project - 6-14-2026 - from a Codex Chat Session 

**Bottom Line**
The project plan currently treats ORBIS as the road-network backbone ([Project_Phases_Plan.md](<C:/Users/danie/OneDrive/Documents/Claude/Projects/Ancient World Exploration/Project_Phases_Plan.md:17>)). That should change.

**Use Itiner-e as the underlying Roman road layer.** Use ORBIS as a secondary travel-time and transport-cost model, not as the road geometry.

Itiner-e was formally published on November 6, 2025, and is substantially better suited to VIA:

- 299,171 km of roads across the Roman Empire
- 14,769 topologically connected road segments
- Main and secondary roads
- Realistic, terrain-following line geometry
- Segment-level citations and bibliography
- Certainty classification
- Construction and abandonment fields where known
- Road names and ancient-itinerary membership where known
- Average slope and segment length
- Pleiades-place associations
- GeoJSON, GeoPackage, Shapefile and nightly NDJSON exports
- CC BY 4.0 licensing
- Persistent URI for each live segment

**Important limitation:** only 2.737% of the mapped road length is classified as spatially certain. About 89.818% is conjectured and 7.445% hypothetical. That uncertainty is not a defect to hide. It should become a primary VIA feature.

**Ranking The Ten Sources**

| Rank | Source | Best role in VIA | Road-foundation value |
|---|---|---|---|
| 1 | **Itiner-e** | Authoritative road geometry, topology, evidence and uncertainty | **10/10** |
| 2 | **Pleiades** | Canonical identity layer for places, stations, forts, ports and bridges | 3/10 geometry; 10/10 identity |
| 3 | **ORBIS** | Travel time, cost, season and transport-mode modeling | 4/10 geometry; 9/10 modeling |
| 4 | **Vici.org** | Roadside remains, bridges, milestones, forts, photographs and public observations | 6/10 enrichment |
| 5 | **Open Context** | Excavation records, archaeological media and detailed field evidence | 6/10 enrichment |
| 6 | **OmnesViae** | Tabula Peutingeriana and Antonine Itinerary routes and recorded distances | 5/10 historical validation |
| 7 | **AWMC/Barrington data** | Scholarly overview, historical basemap and comparison layer | 5/10 |
| 8 | **DARMC/Mapping Past Societies** | Legacy empire-wide road comparison and validation | 4/10 |
| 9 | **Pelagios** | Linked-data conventions, annotations and interoperability | 1/10 geometry; 8/10 integration |
| 10 | **Google Ancient Places** | Text-to-place linking ideas and legacy alignments | 1/10 |

DARE is useful as another visual and place-data cross-check, but it does not displace Itiner-e as the production road source.

**Why ORBIS Should Not Be The Base**

ORBIS models movement between approximately 751 important nodes. It is excellent for questions such as:

- How long did Rome-to-Antioch travel take?
- Was sea or road travel cheaper?
- How did season affect a journey?
- Which route minimized cost rather than time?

It was not created to show a traveler the likely physical course of a road across an individual hillside, field or modern town.

The prototype currently contains manually simplified lines such as “Eastern Road” and “North African Road” ([data.js](<C:/Users/danie/OneDrive/Documents/Claude/Projects/Ancient World Exploration/ancient-world-explorer/js/data.js:362>)). These are suitable for a concept demonstration only.

**Recommended Layer Architecture**

1. **Historical geometry:** Itiner-e live data, with a pinned Zenodo release for reproducibility.
2. **Place identifiers:** Pleiades URI as the canonical place key.
3. **Road evidence:** Itiner-e citations, certainty, milestones and ancient itineraries.
4. **Ancient routing:** Build a routable graph from Itiner-e; incorporate ORBIS speeds, costs and seasonal assumptions.
5. **Archaeological detail:** Vici and Open Context records attached to nearby road segments.
6. **Present-day alignment:** OpenStreetMap roads, tracks and public-access paths spatially matched against Itiner-e.
7. **Modern imagery:** Satellite, Street View and user-contributed photographs.
8. **Presentation:** Vector tiles generated from your own PostGIS database rather than depending on the Itiner-e map application at runtime.

Do not treat an Itiner-e line as a present-day walking or driving route. A separate derived field should classify every segment:

- Survives as modern road
- Survives as path or track
- Visible archaeological remains
- Approximate alignment only
- Buried or destroyed
- Inaccessible/private
- Unverified in the field

**Most Valuable Product Opportunity**

Itiner-e’s uncertainty model maps almost perfectly onto VIA’s quest concept:

- **Certain:** visit and document surviving fabric.
- **Conjectured:** photograph terrain and possible alignments.
- **Hypothetical:** research and field-verification quest.
- **Missing chronology:** milestone or inscription research.
- **Weakly covered region:** coordinated documentation expedition.

That is considerably stronger than quests derived only from missing Pleiades photographs.

**Recommendation**

Adopt this core formula:

> **Itiner-e geometry + Pleiades identities + ORBIS travel modeling + Vici/Open Context evidence + modern OSM alignment**

That combination gives VIA scholarly road detail, routability, traceable uncertainty, archaeological context and present-day traveler utility. No single dataset provides all five.

### Sources

- [Itiner-e documentation](https://itiner-e.org/documentation)
- [Itiner-e downloads and licensing](https://itiner-e.org/about)
- [2025 Scientific Data publication](https://doi.org/10.1038/s41597-025-06140-z)
- [Static Itiner-e dataset on Zenodo](https://doi.org/10.5281/zenodo.17122148)
- [Pleiades downloads](https://pleiades.stoa.org/downloads)
- [Vici open-data terms](https://vici.org/about-vici.php)
- [OmnesViae data description](https://omnesviae.org/nobis)
- [Open Context APIs](https://opencontext.org/about/services)
- [Pelagios Network](https://pelagios.org/)
