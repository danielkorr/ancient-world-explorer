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

## Pilot

The verification pilot is limited to six Alexander records that exercise different
research problems:

1. Aegae
2. Granicus River
3. Issus
4. Gaza
5. Gaugamela
6. Persian Gate

The pilot fingerprints `js/alexander.js`, creates a read-only snapshot, gathers evidence
through source connectors, runs specialist research agents, and writes an immutable run
record plus a materialized `latest.json` report under `.state/`.

## Commands

From the repository root:

```bash
npm run research:snapshot
npm run research:pilot
npm run research:test
npm run research:serve
```

The Observatory binds to `127.0.0.1` by default and is intended only for local review.
Review decisions are appended to `research-lab/.state/reviews.jsonl`; they do not change
VIA data.

## Source connectors

The first-pass connector allowlist is intentionally narrow:

- Pleiades place JSON
- Wikidata entity data
- Wikimedia Commons image metadata
- Scaife/Perseus CTS passages when an explicit CTS URN is known

Classical citations without a resolvable machine identifier remain visibly
`unresolved`; the system does not invent a CTS mapping.
