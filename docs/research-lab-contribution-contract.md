# Research Lab contribution contract

Status: design baseline for contributor submissions

This contract defines what a contributor may submit to the Research Lab and how
that submission is preserved before review. It is deliberately separate from the
public VIA narrative and from the core historical dataset.

## Purpose

The Research Lab accepts useful, reviewable contributions from scholars,
researchers, archaeologists, field workers, local experts, and motivated visitors.
A submission is a proposal for investigation, not an authoritative correction.

The public experience remains ungated. A visitor may read a dossier without
creating an account, while a contributor opts into a more demanding evidence and
review workflow.

## Submission types

Every submission has exactly one primary type:

- `claim-correction` — a proposed change to a name, date, location, attribution,
  description, or historical interpretation.
- `new-evidence` — a source, archaeological record, inscription, image, map,
  field observation, or other item relevant to an existing dossier.
- `field-observation` — an observation made at or near the place, including when,
  where, and under what conditions it was recorded.
- `interpretation` — an argued explanation that connects evidence to a historical
  conclusion without presenting the conclusion as settled fact.
- `objection` — a reason to challenge an existing claim, source match, identity
  join, temporal assignment, or interpretation.
- `research-lead` — a useful direction for further investigation that is not yet
  evidence or a verified finding.

## Required fields

Each submission must include:

| Field | Requirement |
|---|---|
| `subject` | The VIA place, route, stop, or Research Lab dossier concerned. |
| `submission_type` | One of the six types above. |
| `title` | A short, factual description of the contribution. |
| `proposal` | What the contributor believes should be considered. |
| `rationale` | Why the proposal matters and what uncertainty remains. |
| `provenance` | How the contributor knows this: source, observation, archive, or method. |
| `submitted_at` | Timestamp recorded by the system. |
| `contributor_id` | Stable identity reference; never a free-text name only. |
| `status` | Initially `proposed`. |

The system must reject an empty rationale or provenance field. A contributor may
explicitly say that the evidence is incomplete; uncertainty is valid content, not
a submission failure.

## Evidence and provenance

Evidence should be attached as structured items whenever possible:

- source title, author, edition, passage, DOI, URI, or archive identifier;
- archaeological authority or catalogue identifier;
- photograph metadata, creator, license, capture date, and approximate location;
- field observation date, observer, method, and coordinate precision;
- a statement of whether the item is firsthand, quoted, derivative, or inferred.

External material is treated as untrusted input. Links and text are preserved for
review but do not execute instructions, alter records, or establish authority by
themselves.

## Qualification context

Qualification is contextual metadata, not an automatic approval. A contributor may
provide:

- areas of expertise;
- academic, museum, archaeological, or local affiliations;
- field experience and geographic familiarity;
- relevant publications, projects, or portfolios;
- languages, methods, or source traditions they can assess;
- prior accepted, disputed, or withdrawn contributions.

The system must distinguish `self-reported`, `verified`, and `unknown`. Review
authority is earned through transparent review history and appropriate peer
validation, not merely by selecting an impressive title.

## Lifecycle

Submissions use an append-only lifecycle:

```text
proposed
  → triaged
  → under-review
  → accepted | disputed | needs-more-research | withdrawn
  → archived
```

`accepted` means eligible for peer-validation consideration; it does not directly
change public chronology. `archived` preserves the final disposition and the full
decision trail, including superseded interpretations.

## Non-negotiable boundaries

- No submission directly edits VIA core data or public chronology.
- No single contributor can promote their own proposal.
- Original wording, evidence, uncertainty, and alternatives remain visible to
  reviewers.
- A disputed submission remains discoverable in the research record.
- Public pages expose only a readable synthesis unless a visitor chooses to inspect
  the research trail.
- Private contact details, precise sensitive locations, and unpublished field data
  require explicit handling rules before submission storage is implemented.

## Initial UI language

The contributor invitation should say:

> Have evidence, a field observation, or a correction to propose? Add it to the
> Research Lab. Your submission will be preserved as a proposal and reviewed before
> it can influence the public record.

The submit action should be labelled **Propose an addition or correction**, not
**Edit history** or **Fix the record**.

## Implementation consequence

The next implementation phase should model this contract in the isolated staging
environment and Research Lab state layer first. Public chronology remains unchanged
until review and promotion rules are separately implemented and tested.
