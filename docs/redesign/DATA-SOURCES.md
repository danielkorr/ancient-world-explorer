# Data Sources — VIA (Ancient World Explorer)

How VIA connects to the classical / historical data ecosystem, and the licensing rules
that govern using each source in a **monetized** product.

## The model (why this is cheap)
The ancient-world data world is a **graph joined by shared place identifiers**. The
Pelagios convention: reference every place by a gazetteer URI (Pleiades), and otherwise-
isolated datasets implicitly connect through it. So:

> **Key every site on its Pleiades ID. Resolve everything else via Wikidata, which already
> cross-references the major ancient-world gazetteers.**

One Wikidata item for an ancient place typically carries IDs for Pleiades, the Digital
Atlas of the Roman Empire (DARE), ToposText, Trismegistos, Vici.org and more — plus a
Wikipedia article, Wikimedia Commons images, coordinates, and heritage status. That makes
Wikidata a single integration that fans out to many.

**Already ingested** (via `scripts/*.mjs` → cached `js/*.js`): **Pleiades** (sites),
**Itiner-e** (roads), **ORBIS** (travel times), and a shallow **Wikidata** P18 photo
fan-out. The priorities below mark what to *deepen* next, not a from-scratch list.

## Integration priority
1. **Pleiades** — identity + canonical place data (the spine). ✅ ingested.
2. **Wikidata** — the multiplier: cross-ref IDs, coords, summaries, Commons images.
   ⚠ today only P18 portrait photos resolve; deepen to full `xref{}`/`media[]`/`texts[]`.
3. **Vici.org** — visitable archaeological sites; most user-facing-useful layer. Not yet wired.
4. **Map tiles** — a reliable period basemap (fixes the failing "ancient tiles" layer).
5. Everything else, as context: ToposText, DARE detail, iDAI/Arachne, Nomisma, Perseus,
   Trismegistos, Papyri.info, ARIADNE / Open Context.

## Licensing matrix
**Rule: nothing CC-BY-NC (or unknown-license) enters the monetized build.** Confirm each
source's *current* terms before ingesting — licenses change and many are per-item.

| Source | Provides | Access | License | Commercial OK? |
|---|---|---|---|---|
| **Pleiades** | place identity, coords, names | dumps / JSON / API | **CC-BY** (confirmed) | ✅ with attribution |
| **Wikidata** | cross-ref IDs, coords, summaries | SPARQL / REST | **CC0** (confirmed) | ✅ |
| **Wikimedia Commons** | site imagery | API | per-file (often CC-BY/CC-BY-SA/PD) | ⚠️ per-file — check each |
| **Vici.org** | visitable sites, descriptions | API / data | verify (believed CC-BY-SA) | ⚠️ verify |
| **DARE** (Digital Atlas of the Roman Empire) | place detail, possibly tiles | data / tiles | verify | ⚠️ verify |
| **AWMC** (Ancient World Mapping Center) | period map tiles/basemaps | tiles | verify (often CC-BY) | ⚠️ verify |
| **Pelagios / Peripleo** | federation, period map tiles, search | tiles / tools | verify per resource | ⚠️ verify (some assets CC-BY-NC) |
| **ToposText** | places ↔ ancient texts | data | verify | ⚠️ verify |
| **Trismegistos** | people/places/texts (papyri, epigraphy) | API/data | restrictive on bulk — verify | ⚠️ verify carefully |
| **iDAI / Arachne** (DAI) | objects, site imagery | API | verify per item | ⚠️ verify |
| **Nomisma.org** | numismatics (coins), linked data | RDF/API | verify (often CC0/open) | ⚠️ verify |
| **Perseus** | Greek/Latin texts | API/data | verify (often CC-BY-SA) | ⚠️ verify |
| **ORBIS** (Stanford) | Roman travel/transport model | data | academic — verify commercial terms | ⚠️ verify |
| **ARIADNE / Open Context** | archaeological datasets | API | per-dataset (Open Context often CC-BY/CC0) | ⚠️ verify per dataset |
| **UNESCO World Heritage** | heritage status/list | data | verify | ⚠️ verify |

✅ = confirmed usable commercially with attribution. ⚠️ = must verify current terms first.
(Only Pleiades CC-BY and Wikidata CC0 are asserted here from a checked source; treat the
rest as "audit before use.")

## Standards worth adopting
- **Pleiades URIs** as place identifiers (non-negotiable spine).
- **Linked Places format** — the modern interchange format for gazetteer data (successor
  to Pelagios's original interconnection format). Use it if/when emitting data others consume.
- **PeriodO** identifiers for periods, if period precision becomes important.
- **W3C Web Annotation** model for any annotations contributed back via Recogito/Pelagios.

## Contribution back (see DESIGN.md → Contribution loop)
Outbound contributions to scholarly records must be **structured, attributed, and vetted**
— via Recogito / Linked Places, or through a curating academic/NGO partner. User photos go
to a moderation queue first; never relayed raw.

## Operational etiquette (these are volunteer/grant-funded services)
- Pull at **build time / on a schedule**, never live per user request.
- Cache raw responses; re-normalize from cache.
- Rate-limit, set an identifying User-Agent with a contact, respect each site's terms.
- 
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

