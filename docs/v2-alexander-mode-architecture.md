# v2 — Alexander as a Mode: Architecture & UX Scoping

> **Status:** DESIGN SCOPING (no code). Branch `alexander-module`, kept on its own.
> **Decision locked:** Alexander becomes a top-level **experience selected by a tab**, built
> as a **mode over one shared engine** — not a map layer, not a separate app.
> **Supersedes** the layer-toggle framing in `docs/v2-spec-alexander-layer.md` and reframes
> the review in `docs/alexander-review-fable5.md` (see §9).
> Grounded in two code inventories (chrome + JS state surfaces) taken 2026-07-06.

---

## 1. Context — why this, why now

VIA today overlays Alexander as a *layer toggle* on the Roman map. The Fable 5 review
surfaced that this framing is the root of the layer's worst problem: **17 of 32 campaign
stops sit under interactive Roman site markers that steal their taps** (finding F2), and
it flattens a temporal narrative ("Pella → Babylon, 356–323 BC") into "another overlay on
an already-dense map."

Making Alexander its own **mode** — chosen from a top tab, e.g. *"Roman Sites & Roads"*
vs *"Alexander — Follow His Campaign"* — fixes this structurally: with only one dataset
live at a time there are no shared pixels to fight over, and each experience gets its own
framing, chrome, and pacing. It is also the honest form of the spec's v0.4 dream
(`CAMPAIGN_LAYERS`: Hannibal, Caesar, Cleopatra…): VIA becomes *a platform of narrative
journeys over a shared ancient-world substrate*, which is exactly what the quest/check-in
north star was always building toward.

**The discipline that makes it work:** "separate experience" must mean *swap the content
and chrome*, never *fork the app*. One `index.html`, one Leaflet map instance, one auth
session, one set of data services. The tab changes what you see and how it's framed; the
substrate underneath is single and shared.

---

## 2. The mode model

Introduce one module-global and one control.

```js
let appMode = 'roman';   // 'roman' | 'alexander'  — the single source of truth
```

A **tab bar** in the top chrome switches it, mirroring the existing `setEra` precedent
(`app.js:2708`): guard if unchanged → set global → toggle `.active` on tab buttons →
swap what the mode owns → re-raise overlays. `setEra`/`raiseOverlays` is the exact
"switch the whole view" pattern to copy.

`setMode(mode)` does, in order:
1. Guard `if (mode === appMode) return;` set `appMode`, toggle tab `.active`.
2. `closePanel()` — always start a mode with a clean panel (avoids cross-kind class bleed).
3. Drive `layerState`: **roman** → `{roads:true, sites:true, alexander:false}`;
   **alexander** → `{roads:false, sites:false, alexander:true}`.
4. Apply the layer changes through the **existing** paths — `refreshVisibleMarkers()`
   (sites, contents-mutation, mobile-safe), `refreshAlexanderLayer()` (campaign), and the
   roads add/remove branch. Coverage dots off in Alexander mode.
5. Swap **chrome** (§4): show/hide the Roman-only controls and the campaign framing.
6. `raiseOverlays()` + one-time `fitAlexanderBoundsOnce()` when entering Alexander.

Because `layerState` is the lever almost everything already keys on, driving it from
`setMode` inherits most of the gating for free (see §5 for the gaps that don't).

---

## 3. The shared-substrate contract (never swapped)

These are single-instance and mode-agnostic — a mode switch must **not** touch them:

- **Map instance** (`window.VIA.map`), tile layers, and the **ANCIENT/MODERN era toggle**
  (`setEra`) — era is orthogonal to mode (see §7 open Q).
- **Auth + check-ins** — `window.VIA.auth`, `refreshProfilePill`, `refreshCheckinRow`,
  `refreshAllMarkers`, the `onChange` fan-out. Confirmed fully mode-agnostic; **one
  identity spans both modes with zero change**.
- **Topbar shell** — brand (`#app-brand`), the floating center **search** box, the
  profile pill. (Search *scope* is mode-aware — §5.2 — but the box is shared.)
- **The info-panel scaffold** — one `#info-panel` DOM with fixed child IDs, reframed by
  body class (`.alexander-panel` already exists), never rebuilt.

---

## 4. Per-mode chrome swap

From the chrome inventory. **Generic (stays both modes):** topbar/brand/search/profile,
era toggle, the info-panel scaffold, the mobile dock shell.

| Chrome element | Roman | Alexander |
|---|---|---|
| Layer chips `#btn-roads` / `#btn-sites` (`#bottom-controls`) | shown | **hidden** (mode owns layer state) |
| `#btn-alexander` chip | hidden | **hidden** (redundant with the tab) |
| **Detail slider** `#detail-control` (site-density curation) | shown | **hidden** (Roman-only concept) |
| **Site-tier legend** block (Documented/Photo/Location/Text) | shown | **hidden** |
| **Roads-certainty legend** (Certain/Conjectured/Hypothetical) | shown | **replaced** → campaign legend |
| Campaign legend (6 phases + route certainty) | hidden | **shown** |
| Panel framing | site badge, ORBIS card, check-in row, quest banner | `alexander-panel` class: year/phase/certainty, sources, cross-link chip |

The Roman-specific controls to hide are exactly three bounded blocks (Detail slider,
tier legend, certainty legend); everything else is generic or already class-swapped.

**New: a campaign legend/phase key** replaces the certainty rows in Alexander mode — six
phase rows (Macedon → Return/Death) plus the route-certainty dash key. This is also where
the colorblind fix lands: phase rows carry a **text label + numeric index (1–6)**, so
phase never depends on hue (review F5). Reuse the `#quest-legend` container and its
mobile bottom-sheet behavior; swap its row contents by mode.

---

## 5. Gaps a router must close (the actual work)

Driving `layerState` covers most gating. These four surfaces do **not** key on it and
must be made mode-aware:

**5.1 Tap/hover resolution has no mode gate.**
- `map.on('click')` (`app.js:2638`): Alexander self-gates (`findNearestAlexanderStop`
  checks `layerState.alexander`); coverage self-gates. But in Alexander mode, steps for
  Itiner-e roads must be suppressed. Add an `appMode` short-circuit at the top.
- **Overlay-pane `touchend`** (`app.js:1076-1160`) — the mobile road/coverage tap path —
  has *no* Alexander awareness and no mode gate. Must early-return in Alexander mode.
- **Desktop hover readout** (`app.js:2657-2704`, `findNearestItinere`) — Roman-only;
  gate off in Alexander mode.
- The **marker-pane `touchend`** (site taps, `app.js:1015-1068`) needs no change — with
  `layerState.sites=false`, `refreshVisibleMarkers` empties the clusters, so there are no
  site icons to match.

**5.2 Search is Roman-only; `searchAlexander` is confirmed dead code.**
`searchAll` (`app.js:1916`), `renderSearchResults` (`2143`), `selectSearchResult` (`2191`)
have no `alexander` branch, and `searchAlexander` (`1674`) is never called. In the mode
model, search should be **mode-scoped**: Roman mode searches sites/roads/coverage;
Alexander mode searches campaign stops (and, via cross-links, can still *offer* the Roman
twin — §6). Wire `searchAlexander` into the dispatcher gated on `appMode`, add the
`alexander` bucket label + name/meta branch, and a `selectSearchResult` branch →
`showAlexanderPanel`. (This is review F1, now scoped by mode rather than merged into one
result list.)

**5.3 Panel-class hygiene when hopping kinds.** `.segment-panel`/`.alexander-panel` are
only cleared in `closePanel` (`app.js:1406-1408`); `showPanel` re-shows sections inline
but does not drop `alexander-panel` (review F4). `setMode` calling `closePanel` first
(§2 step 2) neutralizes this at mode boundaries; still add the one-line
`panel.classList.remove('alexander-panel')` to `showPanel` for the cross-mode-link case.

**5.4 No hash/param router exists.** Grep confirms no `location.hash` routing anywhere.
For a shareable mode, **mirror the `?signin=1` idiom** (`app.js:3020-3029`): read
`?mode=alexander` once at boot with `url.searchParams.get('mode')`, apply via `setMode`,
optionally `history.replaceState` to normalize. Reuse `saveReturnState`/`restoreReturnState`
(`sessionStorage['via.return']`) so the Back-from-external-link restore also carries mode.

---

## 6. Cross-mode links (preserve the magic)

Full separation would sever the fact that **Babylon is both a Roman-era site and
Alexander's death-place** (17 stops overlap catalogued VIA sites — verified). Keep a
**bidirectional cross-link chip** in the panel:
- Alexander panel for a stop with a VIA twin → "See in Roman Sites" → `setMode('roman')`
  + `showPanel(twin)`.
- Roman site panel with an Alexander twin → "Alexander was here · 331 BC" →
  `setMode('alexander')` + `showAlexanderPanel(stop)`.

Join by `pleiades` id where the stop has one (inherit from the overlapping site), else by
proximity. This is the dual-audience win — traveler gets "he was here," scholar gets the
Pleiades identity join — and it's the review's F2/Q3 resolution reborn as a *cross-mode*
link instead of a same-map disambiguation.

---

## 7. UX decisions — LOCKED (Dano, 2026-07-06)

1. **Era toggle stays live in both modes.** ✅ Alexander-on-today's-map is the "follow his
   route" hook; the DARE floor is fine as ancient texture. No mode-forcing of era.
2. **Switching modes moves the map** only on entering Alexander: fly once to the campaign
   extent (`fitAlexanderBoundsOnce`); returning to Roman preserves position.
3. **Cold-start mode = `roman`** (unchanged first impression); `?mode=alexander` opens the
   campaign for sharing.
4. **Alexander stops are NOT check-in-able in this scaffold.** ✅ **Read-only narrative.**
   The quest/check-in north star ("You've reached 4 of 14 stops") is deferred: the mode
   architecture is built so a per-journey quest layer can be added later, but v1 ships as
   a read-only campaign. `showAlexanderPanel` keeps the check-in row hidden. Out of the
   build sequence (§10) by design.
5. **Tab placement (desktop):** the free band where `#era-toggle-wrap` sits, era toggle
   demoted beneath/beside it. **Mobile:** slim mode strip under the topbar (§8 option A,
   locked). **Naming** (e.g. "Roman Sites & Roads" / "Alexander's Campaign") is wordsmithing,
   deferred — gates nothing.

---

## 8. Mobile (the hard part, 375px)

The top band already carries brand (left) + era pill (center) + profile icon (right); the
bottom is fully owned by the 3-pill dock (`#dock-search`/`#dock-curation`/`#dock-key`).
A tab bar has nowhere free at 375px. **Locked: option A.**

- **A (LOCKED): a slim full-width mode strip directly under the topbar** — two segments,
  luminance-active (colorblind-safe), pushing the map down ~34px. Era toggle moves to a
  smaller inline position. It's the one horizontal band nothing else claims.
- ~~B: fold mode into the dock~~ — rejected (denser, more surprising).
- ~~C: mode in a menu only~~ — rejected (lowest discoverability for a top-level switch).

Whatever we pick must be verified on the **WebKit + touch harness** (`tests/webkit-touch/`)
— the mode tab is a tap target and the F2-adjacent tap paths change.

---

## 9. How this reframes the Fable 5 review

- **F2 (17 stops occluded) — DISSOLVED.** No shared pixels in mode separation. The
  cross-link chip (§6) remains, now as connective tissue, not a bug fix.
- **F1 (dead search) — STILL NEEDED**, but scoped by mode (§5.2), not merged into one list.
- **F4 (panel-class leak) — SUBSUMED** by panel-class hygiene (§5.3).
- **F5 (color-only phases) — RESOLVED** by the phase legend's numeric index (§4).
- **F3 (no source links) — UNCHANGED**: still a data-curation pass on `js/alexander.js`
  (inherit Pleiades ids from the overlapping sites; Livius for battles). Approval-gated.
- **F6/F7 (schema drift, phase filter) — UNCHANGED**; the phase filter naturally becomes
  the campaign legend rows (§4).

## 10. Proposed build sequence (when we move to code)

1. Merge `main` into the branch (chosen: merge, not rebase — no force-push of shared
   history). Resolve the `?v=` token conflict and re-verify the `toggleLayer` `else if`.
2. `appMode` + `setMode` + the tab bar (desktop first), driving `layerState`. No new
   rendering — reuse `refreshVisibleMarkers`/`refreshAlexanderLayer`.
3. Chrome swap (§4) incl. the campaign/phase legend with numeric indices.
4. Close the four gaps (§5): tap/hover mode-gates, mode-scoped search, panel hygiene,
   `?mode=` boot param.
5. Cross-mode link chips (§6).
6. Mobile mode strip (§8) + WebKit-touch verification.
7. Source-curation pass on the data (review F3), separate commit, human approval.
8. Harnesses (`run-journeys` + `webkit-touch`), cache-bust `?v=`, then the merge-to-main
   decision (yours).

*Check-in/quest-for-Alexander (open Q #4) is deliberately out of this sequence unless you
elevate it now.*
