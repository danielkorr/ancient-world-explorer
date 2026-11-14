# IMPLEMENTATION TASK FOR OPENAI CODEX — Ancient World Explorer

You are working **inside the existing AWE repository opened in PyCharm**. Read `README.md` and `REQUIREMENTS.md` in this handoff folder first. This handoff captures approved product decisions from a ChatGPT conversation; it does **not** assert the repository already has any specific architecture or files.

**Goal:** Implement a minimal, well-tested Heckenmünster pilot connecting Pleiades 109034 to ARGO archaeological reconstruction media, and revise Photo Quest to send contributors **directly to Pleiades** instead of asking AWE to handle scholarly image submissions. Prepare a scalable ARGO regional inventory design without blindly importing all sites.

**Required URLs:**
- Pleiades: https://pleiades.stoa.org/places/109034
- ARGO site directory: https://ar-route.de/service/Eifel/099_VUL_Heckenm%C3%BCnster_Quellheiligtum/
- ARGO regional root: https://ar-route.de/service/
- Primary contributor CTA: https://pleiades.stoa.org/participate
- Optional photo collection: https://www.flickr.com/groups/pleiades-places/pool/

**Nonnegotiable UX/authority rules:**
- AWE is a facilitator, **not an intermediary or gatekeeper** of Pleiades scholarly review.
- Contributors submit to Pleiades/Flickr directly. Do not build AWE-side upload, approval, authentication, or automatic forwarding for this flow.
- Pleiades Participate is the **primary** contribution destination, Flickr collection is secondary.
- Flickr `pleiades:depicts=<place_id>` tags can aid discovery but are **not certification**. Never infer archaeological verification from a machine tag, group acceptance, or mere link submission.
- Label archaeological reconstructions as interpretations, not photographs of historical fact.
- Preserve existing functionality and data.

**Work sequence:**
1. Inspect repository structure and current Research Lab/Photo Quest/site-media architecture; identify files and tests affected. Run baseline tests/build if feasible. Report findings and a minimal implementation plan.
2. Implement the Heckenmünster pilot in the existing structure. Use the provided ARGO source and exact reconstruction image only after verifying asset URL, attribution, and CC BY 4.0 coverage. Record Pleiades identifier, distinct springs, provenance, license details, and source links.
3. Add or reuse accessible Ancient / Modern comparison at the site level. If UI patterns already exist, reuse them.
4. Update Photo Quest CTAs to Pleiades Participate (primary) and Flickr group (secondary); show copyable machine tag only when a verified Pleiades ID exists. Eliminate AWE scholarly-image-review implications for this pathway.
5. Add a small ARGO regional inventory/manifest schema or documented adapter aligned to existing architecture; provide a sample record for Heckenmünster, with review statuses and deduplication rules. Avoid bulk importing, automatic publication or new dependencies unless needed.
6. Write/update tests: destination URLs, semantics and status labels, Pleiades tag formatting, no fabricated IDs, attribution, responsive/accessibility behavior where testable, and regressions.
7. Run tests/lint/build; show changed files, result summary, limitations, links/rights still requiring human verification, and recommended next steps. Do not deploy without explicit permission.

**Working conventions:** Favor smallest coherent changes, source-backed metadata, idempotent processes, predictable fallbacks, and exact URLs. Do not invent fetched asset filenames or Pleiades place matches. If no network access, implement source references/manifest as `pending_verification` rather than asserting successful downloads. Ask before destructive or production-impacting actions, otherwise proceed with local changes.
