# Verification and promotion gates

The Research Lab is an experiment, not a production subsystem. Passing its tests means
the lab is internally consistent; it does **not** mean its historical conclusions have
been approved for VIA.

## Automated gates

- [x] Core source is consumed read-only and fingerprinted.
- [x] Research writes are constrained to `research-lab/.state/`.
- [x] Protected core files are pinned to SHA-256 hashes from baseline commit
  `c9ed0586c26cd70b0925a60a6b5829d74d6a7aa3`.
- [x] Unsupported source claims remain `unresolved`.
- [x] Full-scope snapshot and offline research run cover all 38 Alexander stops.
- [x] Every full-scope subject receives exactly one dossier with validated provenance IDs.
- [x] Every current Alexander ancient-source citation maps to a known work/edition target;
  only a successful CTS passage fetch upgrades it to `verified`.
- [x] Missing place identities may produce Wikidata candidates, but candidates never
  become proposed or accepted Pleiades IDs automatically.
- [x] Archaeological discovery results are typed as candidates/leads and cannot become
  `established_evidence` without verified supporting evidence and confidence >= 80.
- [x] Archaeological discovery is limited to public Open Context data under a FAIR/CARE
  sensitivity policy.
- [x] Explicit uncertainty produces visible conflicts/dispute state.
- [x] Prompt-like instructions in retrieved material are quarantined as untrusted data.
- [x] External-agent payloads are disabled by default and, when explicitly enabled, can
  write only quarantined research state.
- [x] The Observatory records claim and archaeology review decisions as append-only
  research state and has no production mutation endpoint.
- [x] Archaeology review decisions use a separate vocabulary and cannot rewrite discovery
  classification or promote a lead into established evidence.

## Human scholarly gates

These remain intentionally incomplete until Dano examines the expanded output:

- [ ] Review all 38 Alexander records in the Observatory; keep the six-stop pilot as a
  regression subset.
- [ ] Validate the resolved ancient-source passages against the cited primary texts,
  including passage granularity and edition choice.
- [ ] Review authority candidates for the eight stops currently lacking a Pleiades ID:
  Aegae, Granicus, Issus, Gaugamela, Persian Gate, Sogdian Rock, Gedrosian Route, and Opis.
- [ ] Review every archaeological candidate for actual chronological, contextual, and
  interpretive relevance in the Archaeology Review queue; a name/proximity match alone is
  insufficient.
- [ ] Resolve coordinate disputes using published archaeological/historical scholarship.
- [ ] Confirm every proposed image's relevance as well as its license.
- [ ] Perform an independent factual audit of any proposed correction.

## Live connector spot-check — 2026-08-08

The automated suite remains network-independent, but representative live checks were
also run against each new/critical path. Pleiades returned Gaza (687902); Wikidata
returned unresolved Gaugamela authority candidates without auto-accepting one; Open
Context returned public records for a Pella discovery query; and Scaife CTS returned
passages for representative Arrian, Plutarch, Diodorus, and Curtius citations. A live
one-stop Pella integration run passed the verification agent while retaining its Open
Context results as archaeological candidates rather than established evidence.

This is a connector/integration spot-check, not a scholarly approval of the 38-stop
corpus. The human gates above remain required.

## Promotion rule

There is deliberately no `promote`, `apply`, `merge`, or production-write command in the
Research Lab. A future promotion must be a separate, explicit decision after human review.
If approved, changes should be prepared as a reviewable core-data diff; the research run,
claim IDs, evidence IDs, conflicts, and reviewer decisions should accompany that diff.
