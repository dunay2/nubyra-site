# Avatar, coverage and atomic shirt replacement

Base: 67ccc94a5cd2aeb8bfcdb56eaf8596c2c9241de5. User request 2026-10-16.

Scope: natural hair/face, lower arms, no incidental skin through shorts, no shirtless or jumping rest-pattern frame on changes. **Do not remove or tune shirt folds.**

## Implementation

- A continuous, bounded 0–25° arm pose applies to the existing body in both viewer and Worker. Default 0 preserves comparisons; the UI enables a more relaxed pose. Chest and hip sections stay unchanged. This is geometric posing, not a clinical/anatomical rig.
- Hair has a higher irregular hairline, side-swept overlapping locks and a ponytail. Eyes/irises, eyebrows and lips conform to the original facial surface. Both are render-only children; neither modifies the GLB, body measurements or collider.
- Shorts retain the pelvis topology and loose legs, with outward allowance, a lower crotch seam and medial-pelvis coverage projected on the actual body. The minimum length now follows the crotch landmark: a fixed 25 cm length could cut the pelvis open on taller avatars. No body masking, skin recoloring or depth tricks.
- Keep the previous body AND garment until the Worker replacement has settled. Stage maps and positions, validate, precompile, then publish in one JS task. Discard stale revisions. Error keeps the old outfit. Preparing a paused replacement is allowed offscreen; motion remains paused afterward.
- Shirt rest pattern, cloth material coefficients and surface-normal reconciler remain byte-identical, guarded by `fold-preservation.json`. Changing the arm pose may naturally change contact/drape. No smoothing or artificial removal of folds is introduced.

## Validation

Node: reversible pose, unchanged torso sections, face/BVH invariance/disposal, 12 coverage/length combinations, jersey-length independence and fold preservation. Existing regression tests retained; normal-reconciler wiring assertion updated to the staged helper.

Browser: actual WebGL views, 0/20/25° poses, per-RAF garment continuity, rapid successive choices, error retention, updates while paused, four views and 390/320px mobile. Evidence under `artifacts/avatar-polish`.

Review required before moving the Lab alias. No commercial-site deployment or branch merge. Visual references and textile dynamics remain prototypes, not validated anthropometry or manufacturing patterns.
