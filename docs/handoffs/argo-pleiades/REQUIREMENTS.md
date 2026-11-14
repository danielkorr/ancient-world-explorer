# AWE feature requirements: ARGO reconstructions + Pleiades Photo Quest

## Approved product decisions

1. **ARGO–Heckenmünster pilot**: Connect the archaeologically informed 3D reconstruction(s), explanatory text, and existing photos for the Gallo-Roman spring sanctuary to Pleiades place **109034**. Show an Ancient / Modern comparison; distinguish reconstruction, excavation evidence, and contemporary photographs.
2. **Expand ARGO regional source discovery**: Support an inventory of ARGO regional site materials; record source URLs, assets, provenance, licensing, matched authority IDs, and verification status. Pilot first; avoid mass ingest without reviewing the source and rights.
3. **Photo Quest direct-to-scholar workflow**: AWE identifies gaps and provides context, but **does not collect, approve, certify, or forward contributor photos**. The **primary contribution URL** is https://pleiades.stoa.org/participate . A secondary optional discovery/photo-specific link is https://www.flickr.com/groups/pleiades-places/pool/ .
4. **External evidence isn't certification**: Machine tags, Flickr group pool inclusion, and appearance on a Pleiades page are distinct, externally observable states. None should be mislabeled as archaeological authentication.
5. **No regression**: Preserve current AWE Research Lab source-review decisions, data, authority records, route views, site pages, and Photo Quest UI behavior; integrate rather than replace.

## Source links / records

| Resource | Canonical URL / meaning |
| --- | --- |
| Pleiades Heckenmünster | https://pleiades.stoa.org/places/109034 |
| ARGO site page | https://ar-route.de/index.html?name=quellheiligtum-heckenmuenster |
| ARGO site directory | https://ar-route.de/service/Eifel/099_VUL_Heckenm%C3%BCnster_Quellheiligtum/ |
| ARGO regional directory | https://ar-route.de/service/ |
| ARGO site interpretive PDF | https://ar-route.de/service/Eifel/099_VUL_Heckenm%C3%BCnster_Quellheiligtum/Texte/Heckenm%C3%BCnster%2C%20R%C3%B6m.%20Quellheiligtum.pdf |
| User-identified reconstruction (Eifel photo) | https://www.eifel.info/images/THv9gRjtRcM/rs:fit:1920:1080/cb:/g:ce/aHR0cHM6Ly9yZXNjLmRlc2tsaW5lLm5ldC9pbWFnZXMvUlBULzEvMDg5NGFjNWQtN2MzMi00Njg4LThlMzAtMTMzMjFmOWNjYTE4Lzk5L2ltYWdlLmpwZw |
| Eifel image 1 (site board) | https://www.eifel.info/images/zKIyLgYz0OA/rs:fit:1920:1080/cb:/g:ce/aHR0cHM6Ly9yZXNjLmRlc2tsaW5lLm5ldC9pbWFnZXMvUlBULzEvYmExZjU2NjQtZWExYi00NzQ0LWE1ZWItNGJjMDhmMDY2OGIxLzk5L2ltYWdlLmpwZw |
| Eifel image 2 (spring) | https://www.eifel.info/images/p3dtwMDdZTA/rs:fit:1920:1080/cb:/g:ce/aHR0cHM6Ly9yZXNjLmRlc2tsaW5lLm5ldC9pbWFnZXMvUlBULzEvYWI5MGM0NDgtODVlZi00MzI5LTliOGMtN2EwODA5ZjllZGQ0Lzk5L2ltYWdlLmpwZw |
| Primary contribution action | https://pleiades.stoa.org/participate |
| Flickr group collection | https://www.flickr.com/groups/pleiades-places/pool/ |
| License | https://creativecommons.org/licenses/by/4.0/ |

## ARGO Heckenmünster content model

- Parent site: Roman Spring Sanctuary, Heckenmünster (Pleiades 109034).
- Child features: Viktoriaquelle and Schwefelquelle/Wallenborn as **distinct natural springs**; precinct/temples/bath structures as archaeological features only where sourced.
- Media classes: archaeological reconstruction; contemporary site photo; site information board; excavation/ground plan (only if verified); interpretation text.
- Reconstruction caption: explicitly **interpretive**, not a literal photo or proven exact appearance.
- Track: title; creator/credit; canonical source URL; asset URL; source institution; date accessed; license ID and URL; local modification note; content category; Pleiades ID; external authority match status; evidence/citation; review status.
- ARGO states images and text downloadable under CC BY 4.0. **Verify individual asset coverage and notices before republishing**; do not assume the underlying 3D model/software is licensed for redistribution. Honor attribution, link to license, and changes notice.
- Preferred attribution, when supported by the asset record: **ARGO – Augmented Archaeology (University of Trier), CC BY 4.0**; source link, license link, modification note.

## ARGO regional discovery adapter

- Treat external directory layout as **untrusted and variable**. Do not assume server directory listing or assets are available at runtime. Avoid scraping that violates published rules or loads pages aggressively.
- Make discovery/import **manual-reviewed and idempotent** initially; consider cached manifests rather than dynamic browser-time requests.
- Fields: ARGO site ID, region, display name, source path, linked Pleiades IDs with match confidence/evidence, assets, languages, license, ingestion status, review notes, checked timestamp.
- Distinguish `candidate`, `matched`, `reviewed`, `published`, and `excluded` states. Never claim a place match solely because names are similar.
- Maintain origin links and file-level attribution. Deduplicate by stable source URL and optionally checksum.

## Photo Quest: revised flow

1. Existing AWE rules identify an image gap and show Photo Quest open.
2. Display site name, Pleiades ID (if authoritative match confirmed), photographic guidance, and a prominent **“Contribute via Pleiades”** link to `https://pleiades.stoa.org/participate`.
3. Optional **“View Pleiades Places Photos”** link to `https://www.flickr.com/groups/pleiades-places/pool/`.
4. For applicable images, make suggested Flickr machine tag copyable: `pleiades:depicts=109034` for this site. Label it a suggested *depicts* relationship, not proof of location or verification. Generalize IDs per site without inventing them.
5. Contributor handles their own account, external submission, and licensing choice. AWE never uploads photos on their behalf.
6. Where external data access is permitted/reliable, **observe** externally published URLs/statuses; otherwise show a neutral link without claiming external acceptance. Do not make successful contribution dependent on live external API availability.

Suggested independent external states (use only when verifiable): `external_link_available`, `flickr_machine_tag_observed`, `flickr_group_pool_observed`, `pleiades_page_image_observed`. No `authenticated_by_pleiades` inference.

**Open-quest closure rule:** Do not close a quest merely because a user visited the participation page or tagged a photograph. Close only under an explicit, documented image-coverage rule, e.g. authoritative photo available and license suitable for AWE display, or a staff-controlled editorial coverage decision where already part of AWE. Keep scholarly certification entirely external.

## Phase plan

### Phase 0 — Inspect repository and establish baseline
- Identify stack, routing, site models, photo-quest logic, media handling, source-review, existing tests, build/deploy scripts.
- Record relevant files before coding; run tests/build; propose minimal architecture consistent with project.

### Phase 1 — Heckenmünster demonstrator
- Add record/linkage for Pleiades 109034 if not already present.
- Attach verified ARGO reconstruction asset(s) with metadata and attribution.
- Implement or reuse Ancient / Modern media switch with accessible responsive controls.
- Surface source evidence and explicit reconstruction designation.

### Phase 2 — Photo Quest direct contribution
- Update CTA destination to Pleiades Participate; Flickr as secondary link.
- No upload/approval/review proxy added.
- Suggested machine tag field where Pleiades ID known; copy action if supported.
- Distinguish external observation from certification.

### Phase 3 — ARGO regional source inventory
- Define manifest/adapter, idempotent import or admin-reviewed discovery.
- Provide reporting for unmatched source entries, unknown rights, duplicates, and publish readiness.
- Do not bulk-publish new site entries until data quality is validated.

## Acceptance tests

- Heckenmünster correctly linked to Pleiades **109034**; springs not merged.
- Reconstruction correctly labeled and credited; CC BY terms visible if applicable; links open correctly.
- Modern photos clearly distinguished from reconstruction images.
- Photo Quest primary CTA opens `https://pleiades.stoa.org/participate`; Flickr group is optional secondary.
- No AWE photo submission/approval gate introduced; no claims that Flickr tags or moderation equal archaeological authentication.
- Unknown Pleiades IDs do not yield fabricated machine tags; no fake status claims.
- If external sources fail, site remains functional and shows meaningful fallback/source links.
- Existing site routes, Research Lab reviews, data, and Photo Quest features unaffected.
- Mobile, keyboard navigation, alt text, external-link security, test suite, and deployment build checked.

## Explicit non-goals
- No new app/framework or database migration until justified by existing architecture.
- No direct posting to Flickr or Pleiades; no impersonation of Pleiades moderation.
- No bulk copying of uncertain-license media; no redistribution of ARGO interactive 3D models without separate rights confirmation.
- No production deployment without reviewing the changes and deployment configuration.
