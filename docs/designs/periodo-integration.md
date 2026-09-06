# PeriodO Integration Plan

Status: approved direction, implementation in progress on `experiment/ai-research-system`

## Decision

PeriodO is VIA's temporal authority and period-reconciliation layer. It belongs inside
the Research Lab and Observatory first, not as a live dependency of the public map.

PeriodO records how a particular authority defines a period. It does not prove that an
event happened, establish that a place belonged to a period, or provide a universal
master chronology.

## Fit with VIA

VIA already has a useful division of labor:

```text
Pleiades   -> place identity
Itiner-e   -> Roman road geometry and segment evidence
ORBIS      -> travel-time and transport model
PeriodO    -> source-specific period definitions
Research Lab -> claims, comparison, uncertainty, and synthesis
Public VIA -> readable, qualified historical interpretation
```

The place remains the visitor's anchor. PeriodO gives the Research Lab a way to explain
the temporal lives of that place without flattening terms such as "Hellenistic" or
"Roman" into one uncontested range.

## Eight-step delivery sequence

1. Preserve this architecture and its safeguards in the project design documents.
2. Replace one-off Alexandria navigation mappings with a data-driven historical-place
   bridge registry keyed by Pleiades and explicit narrative IDs.
3. Add temporal assertions that preserve original wording, authority, scope, dates,
   interpretation, alternatives, and review status.
4. Add a read-only, build-time PeriodO connector and local cache; never fetch PeriodO
   from the public visitor path.
5. Run the Pella/Aegae pilot in the isolated Observatory and review candidate mappings.
6. Add public chronology disclosure only after the pilot proves the terminology is
   understandable and the assignment is reviewed.
7. Add Trismegistos and WHG as separate, review-gated connectors, with documentary
   evidence and reconciliation candidates kept distinct from established claims.
8. Add an export adapter for open place-data interchange, tracking current Pelagios
   direction without replacing VIA's internal model.

## Data contract

Every temporal assertion carries:

- `source_temporal_expression`, the exact wording found in the source
- `periodo_definition_uri`, when a source-specific definition is selected
- `periodo_label`, the human-readable PeriodO label
- `authority`, the defining publication or dataset
- `spatial_scope`, the scope recorded by the authority
- `normalized_date_range`, an approximate queryable range
- `researcher_interpretation`, why the definition applies
- `alternative_definition_uris`, when competing definitions matter
- `assignment_confidence` and `review_status`

The original wording is never replaced by the normalized range.

## Public-product guardrails

- No public link to an empty or unreviewed dossier.
- No automatic assignment of a PeriodO definition from a label alone.
- No silent conversion of vague language into false precision.
- No claim promotion from a PeriodO match.
- No requirement for curious visitors to understand PeriodO identifiers.
- The public chronology view shows the human label first and the authority trail on
  demand.

## Current implementation boundary

The bridge registry, temporal primitives, allowlisted connector, cached importer, and
Pella/Aegae pilot materialization are now implemented. The Observatory exposes the
pilot as a dedicated **Temporal Authority** review queue. Review decisions are
append-only records in Research Lab state, and selecting a definition is limited to
the ranked candidates produced by the cached pilot artifact.

The full pilot remains outside the public static app until every assignment is resolved.
An explicit partial-promotion path now permits a reviewed place to appear in a small
public temporal pilot, while unresolved places remain marked as under research. The
partial artifact does not change a map panel, chronology label, or VIA core data. A full
pilot chronology still requires the strict all-assignments gate.
