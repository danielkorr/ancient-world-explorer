# v2 Spec - Alexander Campaign Layer

> Status: **DRAFT for scaffold.** This is the first non-Roman expansion plan for VIA.
> It keeps the existing Roman roads/sites/quests intact and adds Alexander as a
> separate chronological campaign layer rather than folding him into the Roman site
> model.
>
> One-line: make Alexander the Great's lifetime conquests explorable as a dated,
> tappable route across the existing ancient-world map: stops, route segments,
> phases, and honest uncertainty.

## Product goal

VIA currently answers: "What did the Roman world look like on today's map, and where
are the open scholarly quests?"

The Alexander layer should answer a different but complementary question:

> "How did one lifetime move across the ancient world, and what happened at each
> turning point?"

This is not a second Roman road network and not a generic "Greek sites" layer. It is
a narrative campaign spine: Macedon to Asia Minor to Egypt to Persia to Central Asia
and India, then the return and death at Babylon.

## Why this belongs as an add-on

Alexander is a strong first expansion because:

- The geography overlaps the Roman map but predates the empire, making the app feel
  like a broader ancient-world explorer without discarding VIA's Roman foundation.
- The story is naturally spatial: crossings, sieges, battles, foundations, capitals,
  marches, and disputed routes.
- The data can start small and useful: roughly 25 to 35 high-signal stops are enough
  to show the whole arc.
- It tests a reusable future pattern for other narrative layers: Hannibal, Caesar,
  Herodotus, the Persian Royal Road, Silk Roads, Paul, or the Diadochi.

## Non-goals for the first scaffold

Do not build these in the first pass:

- Full Alexander encyclopedia.
- Every city named Alexandria.
- Diadochi successor-state layers.
- Animated marching timeline.
- Backend, auth, check-ins, uploads, moderation, or Supabase changes.
- A new quest/contribution workflow.
- A global rebrand away from the Roman product.
- Generator scripts before the hand-curated schema proves itself.

The first scaffold succeeds if a user can turn on "Alexander," see the whole route,
tap major stops, understand the chronology, and see where the route/location is
uncertain.

## Core model

Keep Alexander data separate from the existing `SITES` and `ROADS` globals.

New static file:

```html
<script src="js/alexander.js?v=N"></script>
```

New globals:

```js
const ALEXANDER_PHASES = {};
const ALEXANDER_STOPS = [];
const ALEXANDER_ROUTES = [];
```

Do not merge `ALEXANDER_STOPS` into `SITES` in v0.1. Existing site logic carries
Roman-specific assumptions: ORBIS to Rome, check-ins, quest progress, Pleiades
photo quests, type palettes, and foreground/detail rules. Alexander stops are event
records first and place records second.

## Data schema

### `ALEXANDER_PHASES`

```js
const ALEXANDER_PHASES = {
  macedon: {
    label: 'Macedon',
    years: '356-334 BC',
    color: '#8f6f3f',
    summary: 'Origins, succession, and preparation for the Asian campaign.',
  },
  anatolia: {
    label: 'Asia Minor',
    years: '334-333 BC',
    color: '#8f7cc3',
    summary: 'Crossing into Asia and breaking Persian control in western Anatolia.',
  },
};
```

Use color as reinforcement only. Phase distinction should also appear in text labels
and marker treatment so it remains legible for colorblind users.

### `ALEXANDER_STOPS`

```js
{
  id: 'gaugamela',
  name: 'Gaugamela',
  modern: 'near Mosul, Iraq',
  lat: 36.36,
  lng: 43.25,
  year: -331,
  year_label: '331 BC',
  phase: 'persian-core',
  type: 'battle',
  certainty: 'approximate',
  desc: 'Alexander defeats Darius III in the decisive battle for the Persian Empire.',
  significance: 'The victory opens Babylon, Susa, and Persepolis and effectively ends Achaemenid imperial control.',
  source_note: 'The battlefield location is approximate and debated.',
  pleiades: null,
  links: [
    { label: 'Pleiades', url: 'https://pleiades.stoa.org/places/...' },
    { label: 'Livius', url: 'https://www.livius.org/...' }
  ]
}
```

Required fields for v0.1:

| Field | Purpose |
|---|---|
| `id` | Stable internal key, lowercase hyphen-case. |
| `name` | Display title. |
| `modern` | Modern location cue, honest if approximate. |
| `lat`, `lng` | Map coordinate. |
| `year` | Numeric year for ordering; BC years are negative. |
| `year_label` | Human-readable label. |
| `phase` | Key into `ALEXANDER_PHASES`. |
| `type` | `origin`, `crossing`, `battle`, `siege`, `foundation`, `capital`, `march`, `death`, etc. |
| `certainty` | `secure`, `approximate`, or `disputed`. |
| `desc` | One or two sentence event narrative. |
| `significance` | Why this stop matters in the campaign. |
| `source_note` | Required when certainty is not `secure`. |

Optional fields:

| Field | Purpose |
|---|---|
| `pleiades` | Ancient place id when the stop maps cleanly to a Pleiades place. |
| `links` | Source links for panel actions. |
| `ancient_sources` | Short source tags such as `Arrian 2.12`. |
| `alt_names` | Search aliases. |

### `ALEXANDER_ROUTES`

```js
{
  id: 'issus-to-tyre',
  from: 'issus',
  to: 'tyre',
  phase: 'levant-egypt',
  certainty: 'reconstructed',
  label: 'South through Phoenicia',
  coords: [
    [36.17, 36.20],
    [35.90, 35.50],
    [35.20, 33.27],
  ],
  source_note: 'Generalized route for narrative continuity, not a surveyed itinerary.'
}
```

Coordinates stay `[lng, lat]`, matching `ROADS` and generated road files. Convert to
Leaflet `[lat, lng]` only at render time.

Route certainty:

| Value | Meaning | Style |
|---|---|---|
| `attested` | Direction and endpoint sequence are well supported. | solid |
| `reconstructed` | Plausible generalized route between known stops. | dashed |
| `uncertain` | Route is debated or only loosely known. | dotted |

This mirrors the Itiner-e certainty language so VIA keeps one visual grammar for
historical uncertainty.

## Initial stop list

Start small. The first layer should show the full arc without trying to be complete.

### Phase 1 - Macedon and succession

| Stop | Type | Year | Notes |
|---|---|---:|---|
| Pella | origin | 356 BC | Birthplace and Macedonian royal context. |
| Aegae | capital | 336 BC | Assassination of Philip II and Alexander's accession. |
| Amphipolis | muster | 334 BC | Major Macedonian base before crossing to Asia. |

### Phase 2 - Asia Minor

| Stop | Type | Year | Notes |
|---|---|---:|---|
| Hellespont crossing | crossing | 334 BC | Symbolic and strategic entry into Asia. |
| Ilion / Troy | ritual | 334 BC | Homeric framing of the campaign. |
| Granicus | battle | 334 BC | First major victory over Persian satrapal forces. |
| Sardis | capital | 334 BC | Key western Anatolian surrender. |
| Miletus | siege | 334 BC | Naval-strategic decision point. |
| Halicarnassus | siege | 334 BC | Major resistance under Memnon's network. |
| Gordium | symbol | 333 BC | Gordian knot episode and inland consolidation. |
| Tarsus | city | 333 BC | Cilician transition before Issus. |

### Phase 3 - Levant and Egypt

| Stop | Type | Year | Notes |
|---|---|---:|---|
| Issus | battle | 333 BC | Darius III defeated; royal family captured. |
| Tyre | siege | 332 BC | Island siege and eastern Mediterranean control. |
| Gaza | siege | 332 BC | Last major obstacle before Egypt. |
| Memphis | capital | 332 BC | Egyptian submission and coronation context. |
| Alexandria | foundation | 331 BC | Foundation of the most famous Alexander city. |
| Siwa Oasis | oracle | 331 BC | Divine-sonship tradition and desert route. |

### Phase 4 - Persian core

| Stop | Type | Year | Notes |
|---|---|---:|---|
| Gaugamela | battle | 331 BC | Decisive defeat of Darius III. |
| Babylon | capital | 331 BC | Peaceful entry into imperial capital. |
| Susa | capital | 331 BC | Treasury and imperial administration. |
| Persian Gate | battle | 330 BC | Mountain resistance before Persepolis. |
| Persepolis | capital | 330 BC | Burning of the palace complex. |
| Ecbatana | capital | 330 BC | Final pursuit phase after Darius. |

### Phase 5 - East and India

| Stop | Type | Year | Notes |
|---|---|---:|---|
| Bactra | capital | 329 BC | Base for Central Asian campaigns. |
| Sogdian Rock | siege | 327 BC | Eastern resistance and Roxane episode. |
| Taxila | city | 326 BC | Alliance and entry into the Indus world. |
| Hydaspes | battle | 326 BC | Battle with Porus. |
| Hyphasis | turning-point | 326 BC | Army refuses to continue east. |

### Phase 6 - Return and death

| Stop | Type | Year | Notes |
|---|---|---:|---|
| Gedrosian route | march | 325 BC | Catastrophic return route, very generalized. |
| Pasargadae | royal-site | 324 BC | Restoration/visit to Cyrus' tomb tradition. |
| Opis | mutiny | 324 BC | Army crisis and reconciliation. |
| Babylon death | death | 323 BC | Death and endpoint of the lifetime narrative. |

## Source policy

Use sources in this order:

1. **Pleiades** for ancient place identity and coordinates when a stop maps cleanly
   to a place record.
2. **Readable secondary scaffolds** for event summaries and source orientation:
   Livius, Encyclopaedia Iranica, World History Encyclopedia, Britannica, museum
   or university resources. Prefer pages with named authors, citations, and stable
   URLs.
3. **Ancient-source tags** for high-profile events: Arrian, Plutarch, Diodorus,
   Curtius, Justin. These can be short metadata tags in v0.1, not full citations.
4. **Modern scholarship notes** for disputed battlefields/routes: Issus/Pinarus,
   Gaugamela, Persian Gate, Hydaspes, Gedrosia.

Do not present generalized route polylines as surveyed roads. If a route is just a
visual narrative connector, say so in `source_note`.

## Rendering plan

Add two new groups:

```js
const alexanderRouteGroup = L.layerGroup().addTo(map);
const alexanderStopsGroup = L.layerGroup().addTo(map);
```

Add one new layer state:

```js
const layerState = { roads: true, sites: true, alexander: false };
```

Alexander should default **off** in v0.1. The Roman experience stays unchanged on
cold start.

### Route styling

- Draw routes beneath Alexander stop markers but above the basemap.
- Use a distinct but restrained campaign color. Avoid quest-orange/red so it does
  not compete with VIA's contribution signals.
- Use dash pattern as the certainty channel:
  - solid: `attested`
  - dashed: `reconstructed`
  - dotted: `uncertain`
- Route lines should be visually subordinate to selected/highlighted routes and
  Roman curated roads when both layers are on.

### Stop marker styling

Use a dedicated Alexander marker treatment, not the existing Roman site dot. A good
first scaffold:

- small circular medal/pin marker
- campaign bronze/purple fill
- white or dark outline for map contrast
- type glyph only if it remains legible at mobile marker size
- selected marker gets a larger outline, not a color-only change

Possible type glyphs:

| Type | Glyph idea |
|---|---|
| battle | crossed-swords |
| siege | tower/wall |
| foundation | column/star |
| capital | crown/palace |
| crossing | bridge/waves |
| death | simple dot/ring, avoid melodrama |

If glyphs clutter on mobile, defer them and encode type only in the panel.

## Interaction model

### Layer toggle

Add a third master toggle in both desktop controls and mobile Key panel:

- Roman Roads
- Sites & Cities
- Alexander

Toggling Alexander should only show/hide Alexander groups. It must not mutate site
tiers, road certainty filters, or quest progress.

### Phase filter

Do not build a full timeline scrubber in the first implementation. Instead:

- v0.1: optional phase rows in the Key panel, visible only when Alexander is on.
- v0.2: compact timeline/phase scrubber after the route and panels feel right.

Reason: the current mobile UI is already dense. A full time control is product-risky
until the basic campaign layer proves useful.

### Panel

Add a new panel renderer:

```js
function showAlexanderPanel(stop) {}
```

Reuse the existing `#info-panel` shell, but treat this as `currentPanelKind =
'alexander'`.

Show:

- name
- year label
- phase
- event type
- modern location
- narrative description
- significance
- certainty label
- source note, if approximate/disputed
- source buttons
- Pleiades button, if available

Hide:

- ORBIS card
- check-in row
- quest progress
- site photo quest banner
- Roman road certainty banner
- affiliate/contribution CTAs unless deliberately added later

### Search

Add Alexander stops to search results after existing sites and before/after roads
depending on local fit. Label clearly:

```text
Gaugamela
Alexander - Battle - 331 BC
```

Selecting a result should turn on the Alexander layer if it is off, open the panel,
highlight the stop, and pan/zoom to it.

## Implementation plan

### Step 1 - Spec and data skeleton

Files:

- `docs/v2-spec-alexander-layer.md`
- `js/alexander.js`
- `index.html` script include with `?v=N`

Deliverable:

- `ALEXANDER_PHASES`, `ALEXANDER_STOPS`, and `ALEXANDER_ROUTES` exist.
- No visual change yet unless the layer code is also added in the same branch.

### Step 2 - Render layer toggle

Files:

- `index.html`
- `js/app.js`
- `css/style.css`

Deliverable:

- Add `Alexander` layer button.
- Render route polylines and stop markers.
- Toggle on/off without disturbing roads/sites.
- Bump asset versions for changed JS/CSS.

### Step 3 - Panel and search

Files:

- `js/app.js`
- `css/style.css`

Deliverable:

- Tapping an Alexander stop opens an Alexander-specific panel.
- Search finds Alexander stops.
- Selecting search result enables layer and opens the stop.

### Step 4 - Phase filter

Files:

- `index.html`
- `js/app.js`
- `css/style.css`

Deliverable:

- Key panel exposes phase filters only when Alexander is active.
- Filtering mutates Alexander group contents, not group membership.
- Mobile interaction is verified on a real phone or `/browse` mobile viewport.

### Step 5 - Source pass

Files:

- `js/alexander.js`
- possibly `docs/alexander-sources.md` only if source notes become too long

Deliverable:

- Every stop has at least one source link or source tag.
- Every approximate/disputed coordinate has a `source_note`.
- Route segments are not over-claimed.

## Acceptance criteria for v0.1

- Cold start Roman app is visually unchanged with Alexander off.
- User can turn on Alexander from desktop controls and mobile Key panel.
- Campaign route appears from Macedon through Egypt, Persia, Central Asia/India,
  and back to Babylon.
- Stops are tappable on desktop and mobile.
- Panel opens for every Alexander stop and hides Roman-only UI blocks.
- Route uncertainty is visible by dash pattern.
- Search can find at least major stops: Pella, Granicus, Issus, Tyre, Alexandria,
  Siwa, Gaugamela, Babylon, Persepolis, Bactra, Taxila, Hydaspes.
- CSS/JS asset `?v=` tokens are bumped if implementation changes assets.
- No Supabase auth methods are introduced.
- No generated files are hand-edited.

## Open questions

1. Should Alexander default off always, or should a URL parameter like
   `?layer=alexander` open it for sharing?
2. Should the first share URL support `?alexander=gaugamela` the same way existing
   Pleiades/site restoration works?
3. Should overlapping Roman sites and Alexander stops cross-link in the panel?
   Example: Babylon as Roman/ancient site plus Alexander event endpoint.
4. Should battlefields with disputed locations show a visible "approximate" badge on
   the marker, or only in the panel?
5. Should phase filtering live in the existing Key panel or a dedicated campaign
   strip once Alexander is on?

## Later phases

### v0.2 - Timeline

Add a compact phase/timeline control:

- all phases
- Macedon
- Asia Minor
- Levant/Egypt
- Persian core
- East/India
- Return/death

Possibly animate the route only after manual timeline filtering proves useful.

### v0.3 - Deep source mode

Add source-rich event panels:

- ancient source tags
- "why this location is disputed"
- alternate proposed locations
- bibliography links

### v0.4 - Other campaign layers

Generalize the Alexander code into a campaign-layer model only after Alexander ships:

```js
CAMPAIGN_LAYERS = {
  alexander: { phases, stops, routes },
  hannibal: { phases, stops, routes },
}
```

Do not abstract early. Prove one campaign first.
