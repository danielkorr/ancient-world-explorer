# Ancient World Explorer Research Lab

This directory is an intentionally isolated research environment for evaluating an
AI-assisted scholarly workflow before any part of it is considered for VIA's core
application.

## Safety contract

- The lab may **read** VIA source data, but it has no code path that writes to `js/`,
  `css/`, `index.html`, Supabase, or the production site.
- All writable paths are constrained to `research-lab/.state/`.
- Agent output is a `proposal`, never an authoritative VIA fact.
- Every proposal must carry claim-level provenance and an audit trail.
- External content is untrusted data. Prompt-like instructions found in retrieved
  material are flagged and never executed.
- The external-agent/Moltbook gateway is disabled by default and only accepts data into
  quarantine when explicitly enabled. It can never write to VIA.
- Promotion into the core application is deliberately not implemented here.

## Scope

The research system now has two scopes:

- **All 38 Alexander stops** for the actual research run.
- The original **six-stop pilot** (Aegae, Granicus River, Issus, Gaza, Gaugamela,
  Persian Gate) retained as a fast regression set.

Both paths fingerprint `js/alexander.js`, create a read-only snapshot, gather evidence
through source connectors, run specialist research agents, and write an immutable run
record plus a materialized `latest.json` report under `.state/`. The full run discovers
Wikidata identity candidates for stops that lack Pleiades IDs, but never auto-accepts a
candidate.

## Research dossiers

Every researched stop now produces one Research Dossier. The dossier is a synthesis view
over the run's existing claims, evidence, conflicts, archaeology leads, and confidence
scores; it does not invent a separate layer of facts. Each dossier includes an executive
synthesis, what-we-know summary, primary sources, archaeological and geographic evidence,
modern scholarship links, competing interpretations, unresolved questions, research
priorities, confidence assessment, and the IDs of every record used as provenance.

Interpretive labels such as `contested`, `qualified`, and `source-supported` summarize
the state of the research record. They are not declarations that a historical claim is
true.

## Archaeological discovery

The Archaeological Discovery Agent searches public Open Context archaeology records by
place name and ranks returned records for review using transparent lexical and geospatial
signals. A search match is never treated as proof of an association with Alexander.

The report schema keeps four interpretations separate:

- `established_evidence` — reserved for evidence that passes a higher verification gate;
  raw discovery cannot create it.
- `candidate_evidence` — a public record whose name/location makes it worth scholarly review.
- `disputed_interpretation` — a contested archaeological interpretation.
- `research_lead` — a weak or incomplete discovery lead.

Every archaeology lead records its public source, location when published by the source,
publication date when available, relevance rationale, confidence score, source evidence,
and sensitivity policy. The confidence number is a **discovery triage score**, not a
probability that Alexander was present there.

The Observatory adds a dedicated Archaeology Review queue. A reviewer can record a lead
as `relevant`, `not-relevant`, or `more-research` and add a note. These judgments are
append-only entries in the research review log. They never rewrite the lead's discovery
classification and cannot promote it to `established_evidence`.

Open Context's own FAIR/CARE guidance is part of the lab policy: discovery is restricted
to public open data, and the lab does not infer, enrich, or republish non-public sensitive
archaeological coordinates. See <https://opencontext.org/about/fair-care>.

## Primary-source resolution

All ancient citations currently attached to the 38 Alexander stops are parsed into
canonical passage targets for Arrian, Plutarch's *Alexander*, Diodorus, and Curtius.
Edition/work URNs are pinned only where they were identified through Scaife/Perseus.
The CTS passage still has to fetch successfully before evidence can become `verified`;
service failure or incompatible passage granularity remains visibly `unresolved`.

## Commands

From the repository root:

```bash
npm run research:snapshot
npm run research:snapshot:all
npm run research:pilot
npm run research:alexander
npm run research:test
npm run research:serve
```

The Observatory binds to `127.0.0.1` by default and is intended only for local review.
Review decisions are appended to `research-lab/.state/reviews.jsonl`; they do not change
VIA data. Its three review views are **Research Dossiers**, **Archaeology Review**, and
**Claims & Evidence**.

## Source connectors

The first-pass connector allowlist is intentionally narrow:

- Pleiades place JSON
- Wikidata entity data
- Wikimedia Commons image metadata
- Scaife/Perseus CTS passages when an explicit CTS URN is known
- Open Context public archaeology search results

Classical citations without a resolvable machine identifier remain visibly `unresolved`;
the system does not invent a CTS mapping. Open Context's API documentation describes its
individual-record and search APIs as JSON-LD services: <https://opencontext.org/about/services>.
