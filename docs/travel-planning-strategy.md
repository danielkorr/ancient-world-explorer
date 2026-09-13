# Ancient World Explorer: Travel-Planning Strategy

Status: strategy exploration; no product-code changes are included.

## Executive recommendation

Build an endorsed traveler layer around VIA, beginning with curated historical trips and useful outbound planning links. Keep the scholarly map, provenance, quests, and contribution loop as the trust and differentiation layer. Do not begin by trying to become a general-purpose booking or itinerary platform.

Use the first 90 days to validate traveler intent in one coherent region. If users repeatedly create routes, save/share trips, and click practical travel partners, then build owned itinerary features. Treat a partner widget/API as a second distribution channel after the owned experience and data contracts are proven.

## Product models

| Model | Customer promise | Upside | Main downside | Recommended role |
|---|---|---|---|---|
| Traveler layer in VIA | Find meaningful ancient places and turn them into a real trip | Fastest validation; reuses map, sites, roads, ORBIS, and trust | Commercial needs can crowd the scholarly mission | Start here |
| Separate endorsed consumer brand | Plan distinctive history-focused trips with VIA-backed research | Clearer consumer funnel and commercial freedom | New brand, acquisition, support, and content burden | Consider after validation |
| Widget/API for itinerary platforms | Add historically intelligent places and routes to an existing trip planner | Partner supplies audience and booking infrastructure | Integration, sales cycle, dependency, and lower customer ownership | Pilot later |
| Curated destination products | Follow a researched route through a specific region | Concrete, shareable, monetizable travel intent | Editorial upkeep and regional logistics | Best initial wedge |
| Contribution-led travel | Visit, document, and improve the historical record | Strong differentiation, engagement, and scholarly moat | Moderation, privacy, quality control, and low initial volume | Optional differentiator |

## Target users

### The historically curious traveler

Wants more than a famous landmark but does not have time to research obscure sites. Needs confidence that a place is worth visiting, a practical way to combine stops, and a simple handoff to maps, tickets, lodging, or tours.

### The specialist traveler

Already plans archaeology, Roman, or classical trips. Values source provenance, ancient/modern name mapping, road context, uncertainty labels, and unusual destinations. Will tolerate more detail and may contribute photos or location evidence.

### The trip curator or partner

Creates tours, educational itineraries, museum programs, or destination campaigns. Needs embeddable maps, stable identifiers, curated stops, attribution, and measurable referrals—not just an attractive map.

## Traveler experience to validate

1. Discover a region or theme, such as the Bay of Naples, Via Appia, Roman Britain, or frontier forts.
2. Browse a curated set of stops with ancient and modern names, historical context, evidence/uncertainty, photographs, and practical location information.
3. Select stops and view a modern travel itinerary. ORBIS remains clearly labeled as a historical model, not modern navigation.
4. Save or share the itinerary and hand off each leg to modern maps, lodging, tours, tickets, or local guides.
5. Optionally accept a quest: photograph a missing site, verify a location, or add a scholarly observation.

The key product test is whether the historical layer improves a real trip decision. Map exploration alone is not sufficient evidence of travel demand.

## Revenue opportunities

### Near-term outbound revenue

- Accommodation affiliate links near selected sites or destinations.
- Tours, tickets, guides, and experiences searched by destination or coordinates.
- Rail, car rental, ferry, or transfer referrals where geographically relevant.
- Direct links to museums, parks, archaeological sites, and official ticketing pages.

These are the lowest-effort opportunities, but revenue depends on qualified intent, partner coverage, attribution windows, disclosure, and link maintenance. Links should appear in a practical planning context, never as scholarly endorsements.

### Sponsored and direct partnerships

- Sponsored regional guides from tourism boards or heritage networks.
- Paid placement for clearly labeled local experiences.
- Co-produced itineraries with museums, tour operators, universities, or archaeological parks.
- Campaign landing pages for destinations seeking specialist visitors.

These can produce larger contracts than affiliate links but introduce sales, negotiation, reporting, renewal, editorial conflict, and sponsor-review work.

### B2B distribution

- Licensed map/widget for specialist tour operators and educational travel programs.
- API access to places, themes, route geometry, provenance, and uncertainty metadata.
- Custom research-backed itinerary experiences.

Avoid pricing the API before the data contract, usage patterns, uptime expectations, attribution rules, and support scope are understood.

### Deferred possibilities

Subscriptions, paid trip packs, premium offline guides, and transaction fees may become viable, but they require a repeat-use habit and more customer-support responsibility than outbound referrals.

## Costs and operating burdens

### Implementation

The existing product already supplies a strong foundation: searchable ancient/modern places, ancient and modern map modes, curated and generated roads, ORBIS point-to-point routing, themed sibling experiences, deep links to modern maps, accounts, check-ins, and the planned photo-contribution workflow.

The minimum traveler layer still needs:

- Curated regions/themes and editorial stop ordering.
- A trip state model: selected stops, order, notes, and shareable identifier.
- Modern travel context kept separate from historical ORBIS estimates.
- Practical outbound-link configuration and disclosure.
- Event analytics for discovery, route creation, saves, shares, and outbound conversion.
- Content QA for modern names, access notes, closures, permissions, and safety language.

### Execution and monitoring

- Broken or redirected affiliate links.
- Partner inventory and geographic coverage.
- Click-to-book conversion and payout reconciliation.
- Seasonal changes, closures, access restrictions, and inaccurate modern information.
- Sponsor conflicts with scholarly neutrality.
- Photo moderation, attribution, privacy, and fraud once contributions open.
- Page performance and mobile usability, especially for map-heavy experiences.

### Strategic risks

- Becoming a generic travel affiliate site with little defensibility.
- Undermining trust by mixing commercial ranking with scholarly importance.
- Overpromising modern routing using a historical model.
- Building itinerary infrastructure before proving users want to plan trips here.
- Creating a support and revenue-operations burden larger than the revenue.
- Letting sponsors determine which places receive editorial attention.

## 90-day validation program

Run a deliberately narrow pilot around one region with enough sites, roads, practical travel inventory, and a coherent story. Candidate regions include the Bay of Naples or Via Appia.

Validate three experiences:

1. A themed landing page that moves users from inspiration to a short list of stops.
2. A multi-stop route/share flow using existing site and route primitives.
3. Practical outbound actions: modern maps, official tickets, lodging, tours, and one contribution CTA.

Track:

- Landing-page-to-site-panel open rate.
- Site-panel-to-route-start rate.
- Route completion rate.
- Saved/shared itinerary rate.
- Outbound click-through by partner category.
- Repeat visits within 30 days.
- Quest or contribution starts from traveler sessions.
- Revenue per qualified outbound click when partner reporting is available.

Use qualitative interviews or short intercept prompts to learn whether users are planning a real trip, merely browsing history, or unable to act because practical information is missing.

Do not scale based on page views alone. A successful pilot should show repeated evidence of trip intent and at least one monetizable action without reducing trust or scholarly engagement.

## 12–24 month sequence

### Months 0–3: prove intent

One region, a few curated journeys, clear commercial labeling, outbound links, and event measurement. No general booking engine, broad affiliate catalog, or API commitment.

### Months 3–9: own the planning relationship

If validation succeeds, add saved multi-stop trips, shareable itinerary URLs, lightweight notes, region pages, better modern travel context, and a small number of reliable partner categories. Keep the historical/scientific and modern/practical layers visibly distinct.

### Months 9–18: deepen differentiation

Expand the best-performing regions, add seasonal/editorial refresh workflows, improve contribution and first-documenter features, and package repeatable themed journeys for education and specialist travel.

### Months 12–24: test distribution

Offer a controlled widget or partner pilot to one aligned organization. Define licensing, attribution, analytics, support, data freshness, and content-responsibility terms before expanding.

## Guardrails

- Preserve AWS/VIA as the scholarly source of truth and endorsed trust layer.
- Label affiliate, sponsored, and direct-commercial links plainly.
- Never rank sites by commercial payout while presenting the ranking as historical importance.
- Separate historical ORBIS travel estimates from modern routing and availability.
- Prefer official destination/ticket links when affiliate coverage is weak.
- Keep partner additions configurable and removable without changing core content.
- Seed and moderate contribution features before promoting them as a major traveler promise.
- Do not modify the core application until the pilot scope and success thresholds are approved.

## Decision gates

Proceed to owned itinerary features only if the pilot demonstrates real trip-planning behavior, repeat use, and credible outbound intent. Proceed to a separate consumer brand only if the traveler audience, positioning, and acquisition economics are meaningfully different from the scholarly AWS audience. Proceed to an API/widget only after a partner supplies a concrete use case and accepts the operational and attribution requirements.
