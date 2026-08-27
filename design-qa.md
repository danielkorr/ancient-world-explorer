# VIA Welcome Redesign — Design QA

**Comparison target**

- Source visual truth: `.scratch/design-qa/welcome-redesign-target.png`
- Browser-rendered implementation: `.scratch/design-qa/welcome-desktop-final.png`
- Full-view comparison: `.scratch/design-qa/welcome-comparison-final.png`
- Focused modal comparison: `.scratch/design-qa/welcome-focused-comparison-final.png`
- Mobile implementation: `.scratch/design-qa/welcome-mobile-final.png`
- Quest explainer state: `.scratch/design-qa/quest-mobile-open.png`
- Roman map chrome: `.scratch/design-qa/roman-map-desktop-final.png`
- Desktop viewport: 1487 × 1058 CSS px; source and implementation are both 1487 × 1058 px at 1× density, so no density normalization was needed.
- Mobile viewport: 390 × 844 CSS px; implementation is 390 × 844 px at 1× density.
- State: signed out, first visit, Roman route, Ancient basemap, shared welcome open.

**Findings**

- No actionable P0, P1, or P2 findings remain.
- [P3] Decorative density is intentionally lighter than the selected concept.
  Location: `#welcome-card`, especially the How VIA Works column and the two experience panels.
  Evidence: the source includes a Roman crest, Alexander sunburst, and three decorative explanatory icons; the implementation preserves the same hierarchy, copy intent, warm palette, and generated photographic backgrounds without those extra ornaments.
  Impact: the implementation feels slightly less ceremonial, but it is also less visually busy and better matches the user's request for warmth and detail without overwhelm.
  Fix: optional only—add separately generated or licensed decorative assets if a more ceremonial treatment is wanted later.

**Required fidelity surfaces**

- Fonts and typography: Cinzel remains the display face and the existing sans-serif body stack remains the reading face. Heading hierarchy, uppercase overlines, letter spacing, line height, and mobile wrapping are clear. The Roman and Alexander titles retain distinct but balanced weight.
- Spacing and layout rhythm: the desktop 34/66 split, two equal destination rows, border rhythm, card radii, and CTA placement match the source structure. Mobile changes to a deliberate heading → Roman → Alexander → How VIA Works → optional Quests reading order with no horizontal overflow.
- Colors and visual tokens: warm bronze, dark umber, parchment text, and the restrained Alexander burgundy are consistent with the selected direction. Contrast remains strong against the image overlays.
- Image quality and asset fidelity: `assets/welcome-roman.jpg` and `assets/welcome-alexander.jpg` are purpose-generated raster assets, correctly cropped and darkened for overlaid text. No placeholder boxes, emoji imagery, handcrafted SVGs, or CSS-drawn illustrations were substituted.
- Copy and content: both primary choices use the approved short explanations. How VIA Works is present on the first landing surface. Quests are explicitly optional and moved into a separate explainer.

**Full-view comparison evidence**

The side-by-side desktop comparison shows the same first-run composition: high-contrast VIA chrome, a warm map backdrop, a left explanatory column, and two equally prominent destination panels. The production implementation is slightly quieter but preserves the intended hierarchy and relative proportions.

**Focused-region comparison evidence**

The focused modal comparison confirms readable title scale, balanced column widths, clear Roman/Alexander separation, consistent CTA emphasis, and equivalent explanatory content. The remaining decorative-asset difference is classified as P3 because it does not alter hierarchy, comprehension, or task completion.

**Comparison history**

1. Initial desktop comparison: no P0/P1/P2 layout, typography, color, imagery, or copy issues found.
2. Initial mobile capture found a P2 polish issue: the browser's bright native scrollbar cut through the warm dark surface and competed with the destination panels.
3. Fix: added thin bronze scrollbar styling to `#welcome-card` and `#welcome-quest-card`, then bumped the stylesheet cache token.
4. Post-fix evidence: `.scratch/design-qa/welcome-mobile-final.png` shows the scrollbar integrated into the bronze palette while keeping scroll affordance visible.

**Primary interactions tested**

- Quest link opens the separate explainer.
- Back to Welcome returns to the shared landing page.
- Explore the Roman World closes the welcome and remains on `/`.
- VIA brand reopens the welcome.
- Trace Alexander's Campaign navigates to `/alexander-the-great-campaigns/`.
- Roman World / Alexander's Empire navigation exposes the sibling experience and the correct active state.
- Ancient / Modern controls remain present beneath the new experience tabs.
- Desktop map chrome retains the centered search control and sign-in affordance while the larger VIA identity and two experience tabs remain legible over the map.

**Console check**

- Browser console checked after desktop and mobile renders.
- One 401 resource warning appeared during the local session; it was not accompanied by a failed welcome interaction, broken asset, or visible UI error. No new JavaScript exceptions were observed.

**Implementation Checklist**

- [x] Shared first-run landing surface on both sibling pages.
- [x] Roman and Alexander choices presented together and prominently.
- [x] How VIA Works included on the first surface.
- [x] Optional Quest explainer separated from the primary path.
- [x] Larger, higher-contrast VIA identity.
- [x] Roman World / Alexander's Empire controls above Ancient / Modern.
- [x] Desktop and mobile browser QA completed.
- [x] Cache tokens bumped and generated sibling page rebuilt.

**Follow-up Polish**

- Optionally add restrained, real decorative crest/icon assets if a later pass should lean closer to the concept's ceremonial detail.

final result: passed
