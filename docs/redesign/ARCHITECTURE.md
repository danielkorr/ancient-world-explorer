# Architecture — VIA (Ancient World Explorer)

Status: working draft, reconciled against the repo (2026-06). The original "(assumed)"
markers have been resolved from the actual codebase and are noted inline where confirmed.

---

## 1. Current state

```
┌─────────────────────────────────────────────┐
│  Browser (single-page app)                    │
│  - Leaflet map: ancient overlay on modern map │
│  - Quests, "sites visited", ORBIS travel      │
│  - Local-first state (guest mode on-device)   │
└───────────────┬───────────────────────────────┘
                │  magic-link auth + sync (Supabase, confirmed)
                ▼
┌─────────────────────────────────────────────┐
│  Auth/Sync backend  (Supabase — confirmed)    │
│  - passwordless email sign-in (magic link)    │
│  - per-user check-ins / journeys (RLS on)     │
│  - ⚠ ES256 signing keys wedge sb.auth.* —     │
│    code hand-decodes JWTs, uses only .from()  │
└─────────────────────────────────────────────┘

Hosting: GitHub Pages (static).  Map tiles: custom "ancient" layer + modern fallback.
```

Key properties:
- **Static front end.** All client code is delivered to the browser; there is no code or
  logic secrecy, and there cannot be without moving logic server-side. This is fine — the
  value is in data, content, community, and brand, not the code.
- **Local-first / offline-tolerant.** Guests accumulate data on-device; on sign-in the app
  offers to import it into the synced account. The local↔remote **merge rule is the
  subtle part** — define what wins when the same site is marked visited in both places.
- **Viewport locked** (`user-scalable=no`), so any control that overflows off-screen on
  mobile is genuinely unreachable (no pinch-zoom escape). Mobile layout correctness matters.

## 2. Target state (incremental, not a rewrite)

Keep static front end + BaaS. Add two things:

1. A **build-time data layer** that aggregates external classical databases into our own
   cached store (so the app never depends on live scholarly APIs).
2. A **placements layer** (config-driven sponsor/affiliate/partner content).

```
        BUILD TIME                          RUN TIME (static)
┌──────────────────────────┐      ┌──────────────────────────────┐
│ Ingestion pipeline        │      │ Browser SPA                   │
│  Pleiades → Wikidata →     │ ───▶ │  reads cached sites.json +    │
│  DARE/Vici/ToposText/…     │ emit │  placements.json              │
│  normalize on Pleiades ID  │ JSON │  + per-user data from BaaS    │
│  + license filter          │      └──────────────────────────────┘
└──────────────────────────┘
```

## 3. Data model

### 3.1 Site (the core record) — keyed on Pleiades ID

```jsonc
{
  "pleiades_id": "423025",                 // PRIMARY KEY. Source of truth for identity.
  "name": "Pompeii",
  "name_ancient": "Pompeii",
  "coordinates": [40.7497, 14.4869],       // [lat, lng]
  "period": ["roman"],                     // controlled vocab; align to PeriodO later
  "modern_location": "Campania, Italy",
  "summary": "…",                          // short, license-clean blurb
  "xref": {                                 // cross-reference IDs (the fan-out keys)
    "wikidata": "Q43332",
    "dare": "…",
    "vici": "…",
    "topostext": "…",
    "trismegistos": "…"
  },
  "media": [                                // each item carries its own license
    { "url": "…", "credit": "…", "license": "CC-BY", "commercial_ok": true }
  ],
  "texts": [ { "ref": "…", "source": "topostext", "license": "…" } ],
  "quests": ["q_pompeii_photo"],            // ids into quest config
  "heritage": { "unesco": true },
  "provenance": { "ingested_from": ["pleiades","wikidata"], "ingested_at": "…" }
}
```

Rules:
- `pleiades_id` is identity. If a site has no Pleiades match, flag it (`unmatched`) rather
  than minting a private ID.
- Every `media`/`texts` entry **must** carry `license` + `commercial_ok`. The build drops
  non-commercial assets from any monetized output.

### 3.2 Placements (sponsor / affiliate / partner) — swappable config

```jsonc
{
  "id": "plc_visit_lazio",
  "kind": "sponsor",                 // "affiliate" | "sponsor" | "partner"
  "commercial": true,                // partner/NGO credits → false
  "scope": "region:lazio",           // "global" | "region:<x>" | "site:<pleiades_id>"
  "content": { "label": "…", "url": "…", "image": "…" },
  "disclosure": "Sponsored",         // required for affiliate/sponsor; FTC/labeling
  "active": { "from": "2026-01-01", "to": "2026-12-31" }
}
```

The UI renders `partner` placements (NGO/credits) in a visually distinct, non-commercial
slot from `affiliate`/`sponsor` placements, so heritage partners never sit beside a hard
"BOOK NOW" CTA. See DESIGN.md → Monetization.

### 3.3 Per-user data (in Supabase, not in git)
**Live today** (`supabase/migrations/0001_init.sql`, RLS on): `profiles`, `checkins`,
`journeys`. **Proposed extension** for the contribution loop: `submissions` (photos
pending vetting → see `docs/v1-spec-photo-quest.md`), `quest_progress`. Keep this schema
clean and **exportable** — it's the user-facing asset and the thing billing/entitlements
would later attach to. Note the ES256 wedge: writes go through `.from()` PostgREST, never
`sb.auth.*`.

## 4. Ingestion pipeline

A standalone script (build-time or scheduled), **not** part of the runtime app.

**This already exists** — it is not a greenfield build. `scripts/build-sites.mjs`,
`build-roads.mjs`, `build-orbis.mjs`, and `detect-pleiades-photos.mjs` already pull
Pleiades + ORBIS + Itiner-e + Wikidata P18 and emit cached `js/*.js`. The work below is
to *enrich* stage 2–4 (full xref/media/texts fan-out + license tagging), not to start over.

Stages:
1. **Seed** from Pleiades (the site list + canonical place data). License: CC-BY → OK with attribution.
2. **Fan out via Wikidata**: for each Pleiades ID, resolve the Wikidata item to collect
   cross-ref IDs (DARE, Vici, ToposText, Trismegistos), coordinates, Wikipedia summary,
   Commons images, heritage status. Wikidata is CC0.
3. **Enrich** selectively from specific sources (e.g., Vici for visitable-site detail).
4. **License filter**: tag every asset; drop/flag CC-BY-NC and unknown-license items for
   the monetized build.
5. **Emit** `sites.json` (+ split by region if large) to the static app's data dir.

Design constraints:
- Cache aggressively; re-run on a schedule, not on user requests.
- Be a polite client (rate-limit, identify a contact UA, respect robots/terms).
- Keep raw pulls in a `cache/` dir so re-normalization doesn't re-hit sources.

## 5. Hosting & repo visibility (see DECISIONS.md → D-02)

- Making the repo private does **not** make the deployed app private (static = public code).
- GitHub Pages serves private repos only on a **paid** plan (Pro+).
- Alternatives that deploy from private repos on free tiers: **Cloudflare Pages**,
  Netlify, Vercel — better-suited to static SPAs than Render.
- **Render** is reasonable only as a *consolidation* choice (the maintainer already runs
  another app, `sagehens`, there), not for privacy.
- On any host migration: re-check hardcoded base URLs, CORS origins, and magic-link
  redirect allowlists — the usual day-one breakage.

## 6. Tooling
- `tools/mobile-crawler.mjs` — **proposed, not yet built** (`tools/` dir does not exist).
  Playwright script that diffs desktop vs. iPhone interactable controls and reports
  hidden/off-screen/covered/too-small ones, plus console/network errors. Run:
  `npx playwright install chromium && node tools/mobile-crawler.mjs <url>`. Intended as a
  release gate so the (now-fixed) mobile tap breakage can't regress. Note: headless Chromium
  can't reproduce iOS Safari's touch quirks — the original bug needed on-device testing.
