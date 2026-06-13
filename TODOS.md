# VIA — TODOS & Roadmap

Tracked work from the 2026-06-13 office-hours + CEO review. Full strategic plan:
`~/.gstack/projects/danielkorr-ancient-world-explorer/danie-main-design-20260613-003042.md`

## Now — v1 scope (the contribution loop)

The bet: VIA's read-only map has no reason to bring anyone back twice. v1 builds the
first retention loop — contribute → see it confirmed → get permanent credit — and tests
two demand signals at once (do travelers contribute? do they click to book?).

- [ ] **Photo-Quest upload loop.** In-app photo upload (Photo Quest sites) to a private
  Supabase Storage bucket, tied to a check-in. Explicit CC-BY consent + "my own work"
  attestation recorded on the row. Status `pending`; nothing public until approved.
  Moderate via Supabase dashboard for v1. Approved photo becomes the site panel hero and
  counts as a confirmed contribution in the progress meter.
- [ ] **E2 — "First to document" permanent credit.** The first approved contributor's
  name stays on the site panel forever. Scarcity that can never be re-earned; the core
  psychological pull.
- [ ] **E6 — Affiliate links on the site panel.** "Stay near here / find a tour"
  (Booking.com, Viator, GetYourGuide). Near-zero build. Doubles as a commercial-intent
  test — do travelers click to book?
- [ ] **Trust & safety (must be in v1, not bolted on later):** RLS so public reads only
  `status='approved'` and only an admin role flips status; private Storage bucket + signed
  URLs; strip EXIF GPS before public display.

Design principle for the upload flow (the generational melding, see memory): the SAME
action must serve both audiences — a fun, shareable "I was here / I'm first" moment for
Gen X/Y/Z, AND a "this contributes to the scholarly record" framing for the detail-
oriented older audience. Build both into the one flow.

## Now — infra

- [ ] **Migrate hosting GitHub Pages → Render Static Site**, then make the repo private.
  Sequence: create Render static site (publish dir = repo root, no build command) → add
  the Render origin (+ any custom domain) to Supabase → Auth → Redirect URLs → test
  magic-link sign-in on Render → flip GitHub repo to private → retire Pages deploy.
  Reason: going private protects git history/strategy and treats VIA as an asset; Pages
  free tier needs public, Render static sites support private repos and are always-on.

## Cold-start (pre-launch, non-code)

- [ ] **Seed one wedge region to ~80% documented before any launch.** Bay of Naples
  (tourist-dense, photogenic, quest-rich). Never launch an empty game — nobody wants to
  be first into an empty room. You + a few friends contribute the first ~50.

## Deferred expansions (v1.5 / v2 — from the CEO review)

- [ ] **E1 — Widen "quest" → "contribution"** (corrections, condition reports, better
  photos, access info). Turns the finite "fill 289 blanks" into an infinite living-layer
  game. Biggest strategic lever; a v2 data-model decision.
- [ ] **E3 — Shareable contribution card.** Auto-generate a beautiful "I documented X for
  humanity's record" image after approval, pre-made for Instagram. The growth engine.
- [ ] **E5 — Auto-complete via Commons re-detection.** Re-run `detect-pleiades-photos.mjs`
  so a site that gains a Wikimedia Commons photo auto-completes its quest. Closes the loop
  and feeds the scholarly pipeline VIA already reads from.
- [ ] **E4 — Explorer profile / public passport.** A Strava-style public page of someone's
  contributions. Identity → retention.
- [ ] **E7 — Leaderboard / rarity badges.** "Legendary: documented a site untouched in
  1,800 years." The game layer.
- [ ] **API + MCP server.** Expose quest/site data so itinerary apps and AI travel agents
  can query "ancient sites + quests near this trip." Platform play — build AFTER there's
  audience + data worth integrating, not before.

## Revenue sequence (by build cost)

1. Affiliate links (v1, near-zero build, intent test) →
2. Sponsored quests/regions (after audience) →
3. API/MCP platform + itinerary tie-ins (after data + audience) →
4. B2B licensing to tourism boards / heritage sites / museums.

Exit thesis: acquirers (Booking Holdings, Expedia, Tripadvisor, GetYourGuide, large
agencies) buy audience + engagement + proprietary data. The exit is the *result* of the
contribution loop's data network effect, not a strategy executed directly.
