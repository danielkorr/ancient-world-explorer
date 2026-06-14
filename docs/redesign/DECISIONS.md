# Decision Log — VIA (Ancient World Explorer)

Lightweight ADRs. Each records *why*, so the reasoning survives the move to Claude Code and
nobody re-litigates a settled call (or, when reopening one, does so with the context).

Status key: ✅ decided · 🔄 open / pending input · ⛔ rejected

---

## D-01 ✅ Keep the static front end; do not re-architect for "code privacy"
**Context.** Mobile bugs + a wish to take the repo private prompted thoughts of moving to a
server-rendered/backend setup.
**Decision.** Stay static SPA + BaaS. Move logic server-side **only** for things that
genuinely require it (see D-04).
**Why.** A static front end ships all its code and data to the browser; there is no code or
logic secrecy regardless of where it's hosted or whether the repo is private. The product's
value is data/content/community/brand, not the source. Re-architecting for secrecy buys
nothing and adds cost.

## D-02 🔄 Hosting & repo visibility
**Context.** Prior plan: migrate to Render to take the GitHub repo private.
**Findings.**
- Private repo ≠ private app (static code is public once deployed).
- GitHub Pages serves **private** repos only on a **paid** plan (Pro+, ~\$4/mo).
- Cloudflare Pages / Netlify / Vercel deploy from private repos on **free** tiers and suit
  static SPAs better than Render.
- Render is justified only as **consolidation** (maintainer already hosts `sagehens` there),
  not for privacy.
**Decision.** Pending. Options ranked for *this* app: (1) stay on Pages, go private via Pro;
(2) Cloudflare Pages from a private repo (free); (3) Render only if consolidating tooling.
**Migration note.** Whatever the target: re-check base URLs, CORS origins, and magic-link
redirect allowlists.

## D-03 ✅ Pleiades place IDs are the universal join key
**Decision.** Every site record is keyed on its Pleiades ID; third-party IDs stored as
cross-references.
**Why.** The ancient-world data ecosystem is a graph joined by shared place URIs (the
Pelagios convention). Keying on Pleiades makes VIA a node in that graph and makes every
other source plug in without bespoke per-source integration. A private ID scheme would
forfeit all of that.

## D-04 ✅ Aggregate external data at build time; cache locally
**Decision.** A scheduled/build-time ingestion pipeline pulls external sources, normalizes
on Pleiades IDs, applies a license filter, and emits cached JSON the static app reads. The
runtime app never calls scholarly APIs directly.
**Why.** Live calls to volunteer/grant-funded services are slow, fragile, and discourteous;
caching keeps the front end fast and static while still "leveraging everything." This is the
*only* place a small backend/pipeline is warranted here — for caching, not secrecy.

## D-05 ✅ Revenue = NGO + corporate sponsorship + travel affiliate (visibility-based)
**Decision.** Monetize via sponsorships (NGO + travel/hospitality) and travel affiliate
links. No user payments, paywalls, or premium gating for now.
**Why.** All three are visibility-based — nothing to hide, nothing to gate — so they need no
protected backend and don't disturb the static architecture. Affiliate IDs are public by
design; sponsor/partner content is meant to be seen.
**Implications.** Build a config-driven **placements layer**; keep **partner/NGO** slots
visually separate from **commercial** slots; **disclose** affiliate/sponsored content
(FTC/labeling). Both sponsorship streams are downstream of audience → prioritize reach.

## D-06 ✅ License discipline for a monetized product
**Decision.** No **CC-BY-NC** or unknown-license data enters any monetized build. Each
source audited before ingestion; every media/text asset tagged with `license` +
`commercial_ok`; the build drops non-commercial assets from monetized output.
**Why.** The app commercializes on top of openly-licensed scholarly data. Pleiades is CC-BY
(commercial OK with attribution), but parts of the surrounding ecosystem are CC-BY-NC
(commercial **not** OK). Mixing them into revenue features is a real legal hazard.
**Note.** Not legal advice — confirm terms per source; consider a fiscal-sponsor/nonprofit
structure if NGO grants get serious.

## D-07 ✅ Contributions back to scholarship are vetted, not raw
**Decision.** User photo/data submissions enter a moderation queue
(pending → vetted → relayed) and reach scholarly records only as structured, attributed
annotations (Recogito / Linked Places) or via a curating partner.
**Why.** Scholarly records have provenance/editorial requirements; a raw user firehose would
be rejected and would damage credibility with exactly the partners we want.

## D-08 ✅ Product identity: mission-first
**Context.** NGO/heritage funding and aggressive affiliate monetization pull in different
directions (tone, partnerships, licensing).
**Decision** (2026-06-13). **Mission-first** heritage/education tool that sustains via light,
tasteful commercial revenue — never an ad product wearing a toga.
**Why.** Fits the maintainer's stated motivation (gamified citizen-contribution to the
scholarly record) and sits honestly with the open-data ecosystem VIA is built on. Sets the
guardrail that keeps affiliate revenue contextual and sparse rather than dominant.
**Implications.** Commercial slots stay sparse, contextual, clearly labeled, and visually
separate from partner/NGO slots (D-05). License discipline (D-06) is honored as a matter of
principle, not just legal minimum. When affiliate and mission conflict, mission wins.

---

## D-09 ✅ Site schema v2 is additive, not a rename
**Context.** Early ARCHITECTURE drafts sketched a v2 site record that renamed runtime fields
(`lat/lng→coordinates`, `desc→summary`, `modern→modern_location`) and dropped `type`.
**Decision** (2026-06-13). v2 = **v1 core (field names frozen) + optional enrichment**. See
`SITE-SCHEMA.md` (authoritative). Records key on the slug `id`; `pleiades` is the external
join key and is *not* assumed unique on curated data.
**Why.** The renames force an `app.js` rewrite for zero user benefit and would break a
working runtime. Additive enrichment lets the scholarly/license data land incrementally
while the app keeps running. Every `media`/`texts` asset carries `license` + `commercial_ok`
from ingestion — the no-regrets core of D-06.

---

## Answered from the codebase (were open when these docs were drafted)
- **BaaS for auth/sync:** **Supabase** (confirmed). Carries the ES256-key wedge that hangs
  every `sb.auth.*` call — code hand-decodes JWTs and uses only `.from()`. See root
  `/CLAUDE.md` → "ES256 auth wedge". This is a hard constraint on any auth/sync change.
- **Current data store for sites/quests:** **static JS**, build-time generated. Curated
  content hand-written in `js/data.js`; `js/sites-pleiades.js` / `roads-itinere.js` /
  `orbis-days.js` emitted by `scripts/*.mjs`. Ingestion output target = these `js/*.js` files.
- **Front-end:** **vanilla JS, no build/framework/tests.** Three runtime files
  (`data.js`, `app.js`, `auth.js`).

## Open questions still feeding future decisions
- **Front-end evolution:** stay vanilla, or refactor the view/state layer to `UI = f(state)`?
  The multi-modal state in `app.js` (era × layers × filters × panel) is a likely bug source
  as features grow. Not urgent — revisit when it bites. (D-08 and D-02 above are the other two.)
