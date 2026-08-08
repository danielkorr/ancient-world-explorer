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
- [x] Explicit uncertainty produces visible conflicts/dispute state.
- [x] Prompt-like instructions in retrieved material are quarantined as untrusted data.
- [x] External-agent payloads are disabled by default and, when explicitly enabled, can
  write only quarantined research state.
- [x] The Observatory can record claim-level review decisions but has no production
  mutation endpoint.

## Human scholarly gates

These remain intentionally incomplete until Dano examines the pilot output:

- [ ] Review all six Alexander pilot records in the Observatory.
- [ ] Validate ancient-source citations against primary text editions/passages.
- [ ] Investigate missing Pleiades identities for Aegae, Granicus, Issus, Gaugamela,
  and Persian Gate instead of guessing mappings.
- [ ] Resolve coordinate disputes using published archaeological/historical scholarship.
- [ ] Confirm every proposed image's relevance as well as its license.
- [ ] Perform an independent factual audit of any proposed correction.

## Promotion rule

There is deliberately no `promote`, `apply`, `merge`, or production-write command in the
Research Lab. A future promotion must be a separate, explicit decision after human review.
If approved, changes should be prepared as a reviewable core-data diff; the research run,
claim IDs, evidence IDs, conflicts, and reviewer decisions should accompany that diff.
