# Replacement decision: a complete human base

Date: 2026-10-15. Research only; the public Fit Lab has NOT been replaced by this commit.

## Why the current approach is rejected
The procedural torso and separately generated limbs may preserve input perimeters while remaining unsuitable as a credible human mannequin. Passing collision, topology and UI tests is not evidence of anthropometric validity. Further isolated changes to breast height, neck length and hip rings are not the selected approach.

## Candidates actually inspected
1. Previous `adult-female-reference-cc0.glb`: upper body only. Reject as a full-body replacement.
2. Innerscene complete 53-bone rig: complete, but the inspected neutral/masculine reference is not the selected female base. 70,985 vertices and 107,024 triangles; no morph targets in this GLB.
3. Innerscene Riley clothed model: the underlying body mesh is cropped under clothing. Reject as a complete mannequin.
4. **Selected for engineering review: the official MakeHuman/MPFB hm08 base with adult female morph data.** This has a connected head, neck, torso, pelvis, arms, hands, legs and feet. No manually invented bust or pelvis geometry was added.

## Reproducible data source
Repository: https://github.com/makehumancommunity/mpfb2
Pinned commit: `3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf`.
Base: `src/mpfb/data/3dobjs/base.obj`, retaining only faces in group `body`.
Morph recipe: equal weights (1/3) for the three official `*-female-young.target.gz` shape families in `macrodetails`. The universal female-young average-muscle/average-weight target is empty. These are synthetic preset choices, not demographic inferences about the user or a photograph.
Transform: translate soles to y=0 and uniformly scale the complete body to 1.70 m for review. This scale is NOT a fit to the photo's labelled measurements. Source quads are triangulated for glTF.

## Prepared mesh and inspection
- 13,380 vertices; 26,756 triangles.
- One connected component; watertight in the triangulated topology check.
- Zero boundary edges and zero edges with more than two incident faces.
- Finite coordinates and positive triangle areas.
- GLB: 698,436 bytes; SHA-256 `0b3666ee3f05a8d51c0fafc15c464799da305eefc3a60fa97e1bcd499983c758`.
- Frontal, lateral and three-quarter orthographic renders made directly from the prepared geometry, with preserved image aspect ratio. These are not generated look-alike images and not screenshots of a deployed Lab.

Source retrieval/verification: https://github.com/dunay2/nubyra-site/actions/runs/38751200400
Earlier candidate inspection: https://github.com/dunay2/nubyra-site/actions/runs/38750027936
The prepared GLB, renders, source manifest and reproducible preparation script were delivered as conversation artifacts. No binary replacement has yet been committed or deployed.

## License
Official core mesh and target data are CC0. MPFB application code is GPL, a separate license; this preparation uses data, not copied application logic.
https://static.makehumancommunity.org/about/license.html
https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html
https://static.makehumancommunity.org/mpfb/docs/assets/concept_targets.html

## Next integration acceptance criteria
- Import this complete base as an explicitly adult reference, preserving the current Lab independently until verified.
- Define measurement landmarks/planes before adapting chest, hip and height; do not silently infer an individual anatomy from two perimeters.
- Visual mesh and collider must describe the SAME body. Do not place this model over the old radial collider and claim its garment contact is correct.
- Evaluate a simplified collider derived from the same base, with measured deviation and exact cloth-contact tests.
- Keep reusable geometry and controlled morph targets; no reconstruction on every slider input, no inference of body measurements from the photo.
- This is neither a scan, an anthropometrically validated mannequin, a juvenile fit pattern nor a garment simulation. Do not extrapolate this adult preset to the infantil pilot.

The existing photo/performance branch is separate unfinished work and must not be overwritten by this research branch.
