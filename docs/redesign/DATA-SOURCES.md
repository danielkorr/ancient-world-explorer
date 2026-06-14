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
