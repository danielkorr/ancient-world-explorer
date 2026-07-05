# VIA — Data Regeneration Playbook

VIA has **no app build step**, but its `js/*` data layers are generated from
external scholarly gazetteers by scripts in `scripts/`. This is the single source
of truth for **what those scripts are, what they emit, how they depend on each
other, and how to run them.**

Everything downloads to `.cache/` (gitignored). Only the generated `js/*` files are
committed. All sources are slow-moving academic datasets, so regeneration is an
**occasional** chore, not part of normal development.

> **Ergonomic front door:** run `/regen-data` in Claude Code — it reads this file
> and executes the rebuild you ask for (one layer, the site pipeline, or all) in
> the correct order. The npm scripts below are the same thing from a plain shell.

---

## The 7 regeneration tasks (+1 experimental)

| # | Output (committed) | Script | npm | Source | Runtime? |
|---|---|---|---|---|---|
| 1 | `js/pleiades-photos.json` | `detect-pleiades-photos.mjs` | `regen:photos` | Pleiades JSON refs → Wikidata P18 | build input only |
| 2 | `js/sites-vici.js` | `build-elevation-worklist.mjs --emit-sites` | `regen:vici-sites` | vici.org SQL dump | ✅ cold start |
| 3 | `js/sites-pleiades.js` + `js/sites-coverage.js` | `build-sites.mjs` | `regen:sites` | Pleiades CSV dump | ✅ (coverage lazy) |
| 4 | `js/vici-links.js` | `build-vici-links.mjs` | `regen:vici-links` | cached Pleiades JSON refs | ✅ cold start |
| 5 | `js/sites-linked-data.js` | `build-linked-data.mjs` | `regen:linked-data` | pleiades.datasets sidebar | ✅ cold start |
| 6 | `js/orbis-days.js` + `js/orbis-graph.js` | `build-orbis.mjs` | `regen:orbis` | ORBIS network (gorbit mirror) | ✅ (graph lazy) |
| 7 | `js/roads-itinere.js` + `js/roads-itinere-pleiades.js` | `build-roads.mjs` | `regen:roads` | Itiner-e live export | ✅ (pp lazy) |
| 8 | `js/coverage-photos.json` | `build-coverage-photos.mjs` | `regen:coverage-photos` | Wikidata P1584→P18 (bulk) | ✅ (coverage lazy) |
| — | `js/sites-enrichment.json` | `build-enrichment.mjs` | — | Pleiades + Wikidata + Commons | ⚠️ **NOT wired** (spike) |

`#8 build-enrichment.mjs` is an experimental v2 spike; its output is **not loaded by
the app**. Leave it alone unless you're reviving that work.

---

## Dependency graph

```
detect-pleiades-photos (1) ──┐  (also fills .cache/pleiades-json/, used by 4)
                             ├──► build-sites (3)  [reads pleiades-photos.json to tag photo quests]
build-elevation-worklist (2)─┘   emits sites-vici.js  [also EXTENDS pleiades-photos.json]

build-vici-links (4)             [reads .cache/pleiades-json/ populated by 1]

build-linked-data (5)            [reads data.js + sites-pleiades.js (3) + sites-vici.js (2)]  ◄── must run LAST

build-orbis (6)                  independent
build-roads (7)                  independent

build-coverage-photos (8)        [reads js/sites-coverage.js, emitted by 3 — run 8 after 3]
```

Three hard ordering rules:
1. **`build-linked-data` runs last** in the site pipeline — it scrapes foreground
   Pleiades ids out of `data.js`, `sites-pleiades.js`, and `sites-vici.js`, so those
   must already be current.
2. **`detect-pleiades-photos` before `build-sites`** if you want fresh photo-quest
   signal (otherwise the cached JSON wins, which is usually fine).
3. **`build-coverage-photos` after `build-sites`** — it reads the freshly generated
   `sites-coverage.js` for the Pleiades ids to look up; a stale coverage file just
   means the photo lookup is built against last run's site list.

`build-orbis` and `build-roads` touch none of the above — run them anytime.

---

## Recipes

```bash
# One layer at a time (most common — you almost never rebuild everything):
npm run regen:roads          # Itiner-e roads changed / you want the latest export
npm run regen:orbis          # refresh travel-time-to-Rome
npm run regen:sites          # re-pull the Pleiades site catalogue

# The whole site/gazetteer pipeline, in dependency order:
npm run regen:sites-all      # photos → vici-sites → sites → vici-links → linked-data

# Literally everything (sites pipeline + orbis + roads):
npm run regen:all
```

### Refreshing the upstream download (`--refresh`)

Each script caches its big download in `.cache/` and **reuses it** on re-run. To pull
a fresh copy from the source, append `--refresh` to the underlying script (not the npm
alias). Examples:

```bash
node scripts/build-roads.mjs --refresh          # re-download the ~37 MB Itiner-e export
node scripts/build-sites.mjs --refresh          # re-download the Pleiades CSV dump
node scripts/build-orbis.mjs --refresh          # re-download the gorbit CSVs
                                                # (emits BOTH orbis-days.js [Rome-rooted,
                                                #  cold start] and orbis-graph.js [full
                                                #  graph, lazy — client-side journey routing])
node scripts/detect-pleiades-photos.mjs --refresh
```

### Smoke tests

Most scripts take a cap flag so you can validate a change without the full run:

```bash
node scripts/build-roads.mjs --max=500          # 500 segments
node scripts/build-sites.mjs                     # MAX_SITES=<n> env var caps foreground
node scripts/detect-pleiades-photos.mjs --sample 10
node scripts/build-linked-data.mjs --sample 8
```

---

## After you regenerate

1. **Cache-bust `index.html`.** Any changed `js/*` file is served with a `?v=N`
   token; mobile Safari caches sub-resources hard. Bump the token on every changed
   asset (and `app.js` drives the `BUILD` constant that the lazy files inherit). See
   the cache-bust rule in `CLAUDE.md`.
2. **Sanity-check the diff.** These files are large; skim the git diff and the
   script's console summary (segment/site/link counts) for anything wild.
3. **Commit, then confirm it landed** (`git log --oneline -1`). Don't push unless
   asked — pushing `main` ships to GitHub Pages.

---

## Source & license quick reference

| Layer | Source | License |
|---|---|---|
| Roads | [Itiner-e](https://itiner-e.org) live export | **CC BY 4.0** |
| Sites / coverage | [Pleiades](https://pleiades.stoa.org) CSV dump | CC BY (Pleiades) |
| Photo signal | Wikidata **P18** | CC0 (data) |
| Coverage-tier photos | Wikidata **P1584→P18** + Wikimedia Commons | per-image (Commons license/credit stored per entry) |
| vici sites / links | [vici.org](https://vici.org) dump | **CC BY-SA 3.0** images / CC0 metadata |
| Linked-data sidebar | `pleiades.datasets` (ISAW) | per-source |
| ORBIS days | [ORBIS](https://orbis.stanford.edu) via gorbit mirror | per ORBIS |

**Coverage-tier photos are a "looks related" signal, not a scholarly one** — unlike
`detect-pleiades-photos` (which feeds the quest system and needs to be right),
`build-coverage-photos` only needs the photo to be plausibly of the right place; a
light Wikidata P31 blacklist (rivers, seas, ethnic groups, provinces, etc.) is the
only filter. Don't repurpose its output for anything that needs precision.

Attribution obligations (CC BY / CC BY-SA) are honored at runtime via the map
`attributionControl`. Don't drop them. vici photos are **ShareAlike** — reference
links are fine, but never fold a vici image into VIA's own record without keeping the
CC BY-SA 3.0 credit (see `CLAUDE.md`).
