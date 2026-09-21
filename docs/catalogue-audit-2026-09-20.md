# VIA catalogue audit, 2026-09-20

## Scope

This audit covers the records rendered in the Roman foreground map and the
hand-curated Alexander campaign layer. The lazy Pleiades coverage layer is
tracked separately because it contains a much larger, thin-record catalogue
and is not merged into the foreground site list.

## Findings

The integrity audit currently sees 969 runtime Roman foreground records,
including 474 documented, 493 photo-quest, and 2 location-quest records. It
sees 38 Alexander stops, 30 with Pleiades ids, and 37 Alexander photo entries.

### 1. Identity and quest semantics

- Roman records are assembled from hand-curated records in `js/data.js`, the
  generated Pleiades foreground in `js/sites-pleiades.js`, and the vici overlay.
- A Photo Quest is currently derived from the absence of a Wikidata `P18` image
  on the Wikidata item cross-referenced by the Pleiades record. It does not mean
  that no photograph exists anywhere on the web.
- Thistleton is a confirmed example. Pleiades 79712 points to Wikidata
  `Q103197761`, while the Wikipedia article for the modern village is a broader
  page. The quest label was technically based on the scholarly-record gap, but
  the old panel copy was too easy to read as “no photos exist.”

### 2. Photo provenance

- Roman hero images are generated into `js/site-photos.js` from Pleiades to
  Wikidata `P18` to Wikimedia Commons, with a small curated override list in
  `scripts/build-site-photos.mjs`.
- Alexander hero images are generated separately into
  `js/alexander-photos.js` by `scripts/build-alexander-photos.mjs`.
- Both panel types write to the same `#panel-hero`. The load callback in
  `setHeroPhoto()` had no stale-request guard. A late Alexander image could
  overwrite a later Roman site fallback. This is the confirmed cause of the
  Sughd image appearing on Thistleton.

### 3. Alexander source coverage

- The current `js/alexander.js` contains 38 hand-authored stop objects, not the
  32 stated in the older handoff note.
- Stops carry Pleiades ids where an ancient-place join is available, plus
  ancient-source tags and source notes. The older review document saying that
  all source links were absent is stale relative to current `main`; the source
  arrays now appear in the stop data.
- Aegae, the Gedrosian Route, and Opis were missing clickable source links.
  They now link to Livius pages covering the place/event.
- Non-secure stops have explicit source notes in the current data. These still
  need a record-by-record scholarly review because a source link existing is not
  proof that the marker or caption is correct.

### 4. Regeneration integrity

The repeatable audit in `scripts/audit-catalogue.mjs` initially found seven
orphaned Roman photo entries. They were stale output from an older foreground
site set, not live site records. Re-running the generator reconciled the current
foreground list and produced 198 valid Roman photo entries with zero orphaned
keys. The audit now reports zero integrity failures.

## Changes made

- Reworded Photo Quest copy to distinguish “no image linked to the scholarly
  record” from “no photograph exists.”
- Added hero-image generation guards in `js/app.js` for Alexander, Roman, and
  road-panel transitions.
- Bumped the `app.js` cache token in `index.html`.
- Added missing Alexander source links and regenerated the Roman photo map.
- Added `scripts/audit-catalogue.mjs` and corrected the journey assertion to the
  three user-facing quest categories.

## Remaining review queue

1. Verify every Roman foreground record's Pleiades identity, coordinate, period,
   type, and quest assignment against its source record.
2. Review every generated Roman and Alexander image for subject relevance,
   generic landscape use, disputed-site captions, license, and attribution.
3. Review every Alexander stop's event summary, coordinate certainty, source
   link, ancient-source tag, and caption.
4. Refresh this report with a per-record disposition: `pass`, `correct`, or
   `needs human decision`.

The current data model can support that review, but it does not yet preserve a
human-reviewed verdict per record. That should be added before making broad
automatic corrections, otherwise a regeneration can reintroduce the same class
of error.
