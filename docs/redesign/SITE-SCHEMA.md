# Site Schema v2 — VIA (Ancient World Explorer)

**Status:** authoritative contract (2026-06-13). This is the single source of truth for the
shape of a site record. The ingestion pipeline (`scripts/*.mjs`) writes to it; the runtime
(`app.js`) reads from it. `ARCHITECTURE.md` §3.1 defers to this file.

## Design principle: additive, not a rename

v2 is **v1 plus enrichment**. Every field the runtime reads today keeps its exact name and
type. The new scholarly/license fields are layered on top and populated by the build
pipeline. This means:

- **The runtime keeps working unchanged** while enrichment lands incrementally.
- A site is valid with *only* the v1 core fields. Enrichment fields are all optional.
- No `app.js` rewrite is forced. (The outside-view sketch in early ARCHITECTURE drafts
  renamed `lat/lng→coordinates`, `desc→summary`, `modern→modern_location` and dropped
  `type`. We rejected that — see D-09.)

## Identity: two keys, on purpose

| Key | Role | Unique? |
|---|---|---|
| `id` (slug, e.g. `"pompeii"`) | **Primary stable handle.** URLs, internal refs, the thing that never changes. | Yes (enforced by us). |
| `pleiades` (e.g. `"433032"`) | **External join key** into the ancient-world data graph (Wikidata → DARE/Vici/ToposText/…). | Should be, but **not guaranteed on curated data.** |

> Reality check: `neapolis` and `cumae` currently both carry pleiades `432740` (a data
> error to fix, but proof the join key can collide on hand-curated rows). Therefore: **key
> records on `id`; use `pleiades` to *resolve* enrichment, and flag duplicates rather than
> assuming uniqueness.** A site with no real Pleiades match gets `pleiades: null` and a
> `provenance.unmatched: true` flag, never a minted fake ID.

## The record

```jsonc
{
  // ─── v1 CORE (required, runtime-critical, names frozen) ───────────────
  "id":        "pompeii",                 // PRIMARY KEY (slug). Stable forever.
  "name":      "Pompeii",                 // display name
  "modern":    "Pompeii, Italy",          // modern location label
  "type":      "city",                    // TYPE config key in app.js (capital|port|city|…)
  "lat":       40.7506,                   // runtime reads lat/lng directly — do NOT nest
  "lng":       14.4868,
  "period":    "7th c. BC – AD 79",       // rich human display string (keep the good prose)
  "pleiades":  "433032",                  // external join key (nullable; see Identity)
  "rome_days": 4,                         // ORBIS travel days from Rome (0 hides ORBIS card)
  "desc":      "Frozen the instant…",     // long-form panel copy

  // ─── v1 OPTIONAL (runtime reads if present) ───────────────────────────
  "rome_mode": "road",                    // "road" | "sea" | "mixed"
  "quest":     "photo",                   // "photo" | "location" | "text"; absent = documented

  // ─── v2 ENRICHMENT (all optional; build-populated; runtime-degradable) ─
  "name_ancient": "Pompeii",              // attested ancient name if it differs from `name`
  "period_tags":  ["roman"],              // controlled vocab for FILTERING (align to PeriodO later)
                                          //   — separate from `period`, which is for DISPLAY

  "xref": {                               // cross-reference IDs (the fan-out keys)
    "wikidata":     "Q43332",
    "dare":         null,
    "vici":         null,
    "topostext":    null,
    "trismegistos": null
  },

  "media": [                              // EACH item carries its own license. No exceptions.
    {
      "url":          "https://…",
      "thumb":        "https://…",        // optional smaller variant
      "credit":       "Photographer / institution",
      "source":       "wikimedia_commons", // provenance of the asset
      "license":      "CC-BY-4.0",         // SPDX-ish id; "PD" / "CC0" / "unknown" allowed
      "commercial_ok": true               // ← the load-bearing flag (see License discipline)
    }
  ],

  "texts": [                              // linked ancient texts; same per-item license rule
    {
      "ref":          "Pliny, Letters 6.16",
      "source":       "topostext",
      "url":          "https://…",
      "license":      "CC-BY-SA-4.0",
      "commercial_ok": true
    }
  ],

  "heritage": {                           // status flags, all optional
    "unesco": true,
    "unesco_ref": "829"
  },

  "provenance": {                         // how this record was assembled (audit trail)
    "ingested_from": ["curated", "wikidata"],
    "ingested_at":   "2026-06-13T00:00:00Z",
    "unmatched":     false                // true if no real Pleiades match exists
  }
}
```

## License discipline (D-06 — the no-regrets core)

This is the reason the schema exists now rather than later.

- **Every `media[]` and `texts[]` entry MUST carry `license` + `commercial_ok`.** A record
  with un-tagged assets is invalid. The build should refuse to emit it (or quarantine it).
- `commercial_ok` is the gate. The monetized build drops or hides every asset where
  `commercial_ok !== true`. Unknown license → `commercial_ok: false`, treat as non-commercial.
- License is tagged **at ingestion, on the first asset**, never retrofitted. Retrofitting
  license provenance across an accumulated media pile is the exact debt we are refusing to take on.
- `license` values: prefer SPDX-style ids (`CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`, `PD`).
  `unknown` is a valid value and forces `commercial_ok: false`.

## Runtime degradation rules

The UI must render a v1-core-only record with no enrichment, and degrade gracefully:

- No `media[]` → existing portrait/quest-photo behavior; no gallery.
- No `xref{}` → no "linked databases" affordance.
- No `texts[]` → hide the ancient-texts section.
- No `heritage{}` → no UNESCO badge.
- A site panel never errors on a missing enrichment field. Absence = hide the section.

## Migration path (v1 rows → v2)

1. **No mass edit of `data.js`.** v1 curated rows are already valid v2 records (core only).
2. The pipeline *enriches* in place: for each row with a non-null `pleiades`, resolve
   Wikidata → fill `xref`, `media`, `texts`, `heritage`, stamp `provenance`. Tag licenses.
3. Output target unchanged: the generated `js/sites-pleiades.js` (and curated rows in
   `data.js` get an optional enrichment sidecar — TBD in the spike, kept out of the
   hand-edited file so the generator never clobbers prose).
4. Fix the `pleiades` duplicate collisions flagged during ingestion.

## Open items for the enrichment spike (next step)

- Where enrichment for **curated** sites lives so the generator never overwrites the
  hand-written `desc`/`period` prose (sidecar JSON keyed by `id`, merged at load).
- `license` normalization table (Commons raw license strings → SPDX ids → `commercial_ok`).
- Whether to run the spike on the ~95 curated sites first (recommended) before all 473.
