# Design — VIA (Ancient World Explorer)

## 1. Vision
Make the ancient world legible and explorable on the modern map — so a curious traveler
or armchair historian can see the Roman road beneath the modern highway, find the ruin
near where they're standing, and turn a visit into a small act of discovery. The app is
**mission-first** (heritage + education), and sustains itself with light, tasteful
commercial revenue rather than being an ad product wearing a toga.

The product's defensible value is **not** the code (it's a static front end; the code is
public the moment it deploys). It is: curated and cross-linked site data, quest content,
the community and its photo submissions, accumulated user travel records, and brand.

## 2. Audience
- Heritage / history travelers and classics enthusiasts.
- Educators and students (a natural NGO/institutional bridge).
- Secondary: cultural-tourism operators and destination marketers (sponsor side).

## 3. Core experiences
- **Explore:** ancient overlay on a modern Leaflet map; filter by Roman roads, sites &
  cities, quests.
- **Quests:** Photo Quest, Location Quest, Text Quest. Completion drives the
  "sites visited" progression and feeds the contribution loop.
- **Travel records:** local-first, synced on sign-in (see ARCHITECTURE → local↔remote merge).
- **Context panel (per site):** rich, license-clean detail pulled from the ingested data —
  summary, imagery, linked ancient texts, "what's nearby." This panel is also the natural
  home for contextual affiliate placements.

## 4. Monetization (visibility-based — no paywall, no protected backend)

Three streams, two visual treatments:

| Stream | Who pays | Mechanism | Slot treatment |
|---|---|---|---|
| Affiliate | travel/booking/activity platforms | tracked links (e.g. tours near a site) | **Commercial** slot, labeled |
| Corporate sponsorship | travel/hospitality brands, tourism boards | co-branded regions/quests | **Commercial** slot, labeled |
| NGO / partner | heritage & education orgs, grants | credits, co-branding, in-kind (data, tiles, reach) | **Partner/credit** slot, non-commercial |

Principles:
- The **map is the monetization edge**: travel affiliate revenue is contextual, and we
  have geo context for every site ("stay/tour near this ruin" at the high-intent moment).
- **Keep partner and commercial slots visually separate** (config field `kind`/`commercial`
  in the placements model). A preservation NGO should never render beside a hard-sell CTA.
- **Disclosure is mandatory**: affiliate links and sponsored content must be clearly
  labeled (FTC + platform rules). Cheap to do right, embarrassing to get wrong.
- Both sponsorship streams are **downstream of audience** — no brand or board sponsors a
  low-traffic app. Early build energy → reach, shareability, SEO, and the experience.
  Affiliate is the immediate on-ramp (sign up, drop in contextual links); sponsorship and
  NGO partnerships follow once there are numbers + a media kit.

### Identity fork to resolve (affects partnerships, licensing, tone)
Is VIA **(a)** a mission-driven heritage/education tool that takes some commercial revenue,
or **(b)** a commercial travel product with a heritage skin? Current lean: **(a)** — it fits
the maintainer's stated motivation and sits comfortably with the open-data ecosystem the
app is built on. Decision pending; record it in DECISIONS.md when settled.

## 5. Contribution loop (the "giving back" goal)
The app already relays confirmed photo submissions toward Pleiades' scholarly record.
Treat this as a **first-class, but vetted** feature:

- **Consuming** scholarly data is easy. **Contributing** to it is higher-friction —
  records carry provenance and editorial review you cannot bypass with raw user uploads.
- Realistic model: structured, attributed annotations via the Pelagios / Recogito
  tooling and the Linked Places conventions, **or** feed a curating partner who vets
  submissions. This is exactly where an academic/NGO partner earns their place.
- Implication: photo submissions go to a `submissions` queue (status: pending → vetted →
  relayed), never directly into an external record. Always attach attribution + license.

## 6. UX guardrails
- **Mobile parity is non-negotiable** (it was the originating bug — the dead-tap issue is
  now **fixed** via iOS `touchend` delegation in `app.js`). Every control reachable on
  desktop must stay reachable and tappable (≥44px) on a phone. Gate releases on the
  mobile-crawler report once `tools/mobile-crawler.mjs` exists (proposed, not yet built).
- Graceful degradation is good (the sepia-map fallback) — keep that pattern, but fix the
  root tile reliability.
- Don't let monetization erode trust: sparse, contextual, clearly-labeled placements only.

## 7. Non-goals (for now)
- User payments / subscriptions / premium paywalls (would force real server-side
  entitlement logic — out of scope under the current revenue model).
- A native mobile app (the responsive web app is the surface).
- Becoming a scholarly database of record (we *link to* and *feed* those, not replace them).
