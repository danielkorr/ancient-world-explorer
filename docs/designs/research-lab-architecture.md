# Research Lab Architecture

Status: accepted direction, ready for phased implementation

## Product decision

The Research Lab is the connective tissue of Ancient World Explorer.

It is not a third map layer and it is not a detached companion project. VIA is one
ecosystem with three distinct rooms:

- **Roman World**: explore Roman places, roads, and journeys.
- **Alexander's Empire**: follow a campaign through time and geography.
- **Research Lab**: follow the sources, disagreements, and open questions behind the map.

The map is the starting point. The Lab is the evidence journey.

The same place may belong to more than one story. Alexandria can be a city in
Alexander's campaign, a major Roman city, and a research question about how those
historical layers relate. VIA should let the visitor move between those narratives
without losing the place.

## Core idea: the many historical lives of a place

Every site, city, road, battlefield, and region should be treated as a living
historical record. "Living" does not imply uninterrupted continuity or a single
unchanging identity. It means that a place gathers layers of human activity, memory,
interpretation, and evidence across time.

The visitor's anchor is always **this place**. Adventures are different historical
lenses on it, and the Research Lab is the evidence layer that helps those lenses meet:

```text
Place -> historical lens -> evidence -> another historical lens
```

This is deliberately place-centered rather than adventure-centered. Alexandria can
have a life in the age of Alexander, another under the Ptolemies, and another as a
Roman metropolis. Carthage can connect Phoenician, Punic, and Roman layers. Cannae
can connect Hannibal's campaign, Roman memory, and modern archaeological debate.

The phrase **many historical lives** echoes the human-centered tradition of Plutarch's
*Lives* while giving VIA a distinctive place-centered voice. It is suitable for curious
visitors, but also accurately signals the scholarly reality that places have layered
chronologies, changing identities, competing sources, and inherited memory.

The guiding product sentence is:

> Every journey begins with a place. The Research Lab reveals everything that place
> has carried through history.

The corresponding experience model is:

> **The map shows where. The adventures show when and why. The Research Lab shows how
> we know.**

This principle should guide future narratives, including Hannibal and the Punic Wars,
Caesar's campaigns, and later historical layers. Users should feel that they are
following one place through time, not being bounced between separate applications.

## Why this exists

VIA currently has strong experiences for seeing historical places and following
campaigns, but the evidence behind those experiences is mostly implicit. A visitor can
see a marker or read a panel without understanding why that place is represented, what
kind of source supports it, or where the record remains uncertain.

The Lab makes that missing layer visible. It gives curious visitors a way to move from
"this is interesting" to "how do we know?" without requiring specialist knowledge.

## Experience model

The Lab should be a separate surface with a shared identity:

```text
                       VIA / Ancient World Explorer
                                  |
          +-----------------------+-----------------------+
          |                       |                       |
     Roman World           Alexander's Empire        Research Lab
       explore                   follow              understand
          |                       |                       |
          +----------- contextual evidence links --------+
```

The Lab gets its own editorial landing page and dossier layout. The main map keeps its
map-first focus. Shared branding, return links, and deep links make the three rooms feel
like one product.

## Entry points

### Splash page

The first-visit welcome presents three choices:

1. Explore the Roman World
2. Trace Alexander's Campaign
3. Go Behind the Map

The Research Lab invitation is visually secondary to the two adventures, but should be
distinctive enough to attract a curious visitor:

> Curious how the story is assembled? Follow the evidence behind the map.

### Global navigation

The VIA brand or secondary navigation should always provide a path to the Lab after the
welcome modal has been dismissed. Visitors should not have to clear local storage or
return to the home route to find it again.

### Contextual links from adventures

The strongest links should appear when a visitor is already curious about a specific
place or claim:

- Roman site panel: **Research behind this place**
- Alexander stop panel: **Follow the evidence**
- Road or disputed location panel: **Why this location is uncertain**
- Quest panel: **See the documentation gap**

These links should open a specific dossier or question, not only the Lab homepage.

## Narrative bridges

Narrative bridges are first-class navigation inside descriptive panels. They are not
generic "related content" links and they should never imply that two records are the
same merely because they share a name or are geographically close.

### Place panels

When a reliable identity join exists, a site or campaign stop should expose the other
historical view directly:

- Alexander stop: **See Alexandria in the Roman World**
- Roman site: **Alexander was here**
- Either view: **Follow the evidence behind this place**

The preferred join is a shared Pleiades identifier. A proximity match is acceptable only
where the existing data model already treats the match as a meaningful twin, and the
label should describe the relationship rather than claim identity.

The current application already has bidirectional Roman/Alexander panel links for the
overlapping place set. The next step is to make the pattern visually and verbally
consistent, then add the Research Lab action beside those existing world-to-world links.

### Road panels

Roads do not automatically have an Alexander twin. A road panel should therefore bridge
through meaningful places and regions, not fabricate a shared entity:

- **Places along this road** can open a Roman site panel.
- A nearby Alexander stop can be labeled **Nearby in Alexander's campaign**, only when
  the relationship is useful and geographically defensible.
- A matching Research Lab dossier can be labeled **Why this place or route matters**.

The road panel should not say that Alexander traveled a Roman road unless a curated
source explicitly supports that claim. This distinction protects the connective tissue
from becoming a false-continuity machine.

### Bridge behavior

Every bridge should preserve orientation:

- move to the destination narrative at the same place
- keep the visitor's ability to return with one obvious action
- retain the relevant year, mode, or question in the destination context
- avoid opening a new browser tab for internal VIA movement

On mobile, this should be a prominent panel action, not a tiny inline link. On desktop,
it can be a quiet action group with the Research Lab link visually distinct as the deeper
contextual step.

## Reverse links

Every public dossier should offer a route back to the map:

- **Locate this place on the map**
- **Open this stop in Alexander's campaign**
- **Return to the Roman road**

The visitor should be able to move repeatedly through this loop:

```text
map marker -> evidence question -> dossier -> locate on map -> another question
```

For a place represented in multiple narratives, the complete loop becomes:

```text
Alexander place -> Roman place -> Research dossier -> Alexander place
```

This is the core connective-tissue behavior. The visitor is not switching between
unrelated pages. They are rotating the same historical place to see another layer.

## URL contract

The public landing page is:

```text
/research-lab/
```

Contextual entry should support stable query-based deep links in the first phase:

```text
/research-lab/?place=granicus
/research-lab/?place=gaugamela
/research-lab/?question=battlefield-location
```

If the public dossier collection grows, these can become static paths without changing
the visitor-facing concepts:

```text
/research-lab/dossiers/granicus/
/research-lab/dossiers/gaugamela/
```

The Lab should preserve a return target when entered from a map panel, while still
working as a direct link from search, sharing, or a future article.

## Public Lab versus working Observatory

These are related but different products.

### Public Research Lab

- Visitor-facing
- Narrative and editorial
- Read-only
- Uses plain language
- Starts with a question or place
- Shows synthesis, evidence roles, uncertainty, and open questions

### Research Observatory

- Reviewer-facing
- Dense and analytical
- Supports source relevance, archaeology review, claims, and append-only judgments
- Currently runs through the local Research Lab server
- Writes only to research-lab state, never to VIA core data

The public page must not imply that the Observatory is already a hosted public review
service. The first public version should show the research method and selected dossiers.
The Observatory can become public later, behind authentication and a deliberate hosting
decision.

## Phased implementation

### Phase 1: public front door

Current scope:

- `/research-lab/` landing page
- splash-page invitation
- five-step research process
- one sample dossier
- explicit honesty and boundary language
- clear note that the working Observatory is currently local-only

### Phase 2: Alexander deep links

Use Alexander first because the Lab already has a 38-stop research run.

- Add a Research Lab link to Alexander stop panels.
- Start with Granicus, Gaugamela, Issus, and Persian Gate.
- Add reverse links from each dossier to the campaign map.
- Keep the link language question-led, not technical.

### Phase 2b: narrative bridge pass

Make the existing Roman/Alexander cross-mode links feel like one system rather than an
isolated feature.

- Audit every current place twin and its label.
- Add the Research Lab action where a dossier or research question exists.
- Add explicit return behavior for map-to-Lab-to-map movement.
- Add road-panel bridges through nearby places and research questions, with conservative
  language and no unsupported historical continuity.

### Phase 3: public read-only dossiers

Publish selected dossiers as visitor-friendly static content. Each dossier should show:

- the question
- a short synthesis
- what ancient sources say
- what modern scholarship proposes
- archaeological leads, clearly labeled as leads
- competing interpretations
- unresolved questions
- provenance and source links
- a map return action

### Phase 4: Roman evidence layer

Extend the same pattern to Roman sites, roads, and documentation quests once the
Alexander flow proves the model.

- Roman site dossiers
- disputed road dossiers
- missing photo and location documentation gaps
- links from quest panels into the relevant evidence trail

### Phase 5: public Observatory, only if earned

Consider exposing reviewer workflows only after the public dossier model is useful and
the hosting, authentication, moderation, and state-retention model are settled.

## Product rules

1. The Lab is an invitation to investigate, not a claim that VIA has solved the question.
2. A research lead is never presented as established evidence.
3. Machine confidence is never presented as historical truth.
4. Disagreement is part of the visitor experience, not an error state to hide.
5. Every dossier can return the visitor to a place on the map.
6. The public experience stays readable even when the underlying research data is dense.
7. The Lab can expand from Alexander to Rome without becoming a generic research portal.

## First success signal

The first version succeeds if a visitor who came to explore a map marker leaves with a
better question than they arrived with, and can move naturally between the place and the
evidence behind it.
