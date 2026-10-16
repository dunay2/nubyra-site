# Reproduction: pending controls, reference alignment and outer shirt

Base: 19531ca91f9455fc7ab2ac716377846c5c2cebe7. Lab only; no commercial site or automatic merge.

## Changes

- The first outfit is the exact 360-step result produced at build time with the existing fixed pattern, solver and material. The worker hydrates those positions, and later edits keep the last complete outfit visible. Updates are coalesced; the last requested revision wins.
- Computation yields between bounded batches (at most eight fixed substeps or 12 ms per batch). Progress messages do not resend/diagnose the entire geometry. Eight settled results are retained in an LRU cache for repeated choices. Neither the timestep nor the settling step count is reduced.
- Scene captions describe the displayed state, not an input which is still pending. The requested selection remains in the editor. A bounded wait produces a retry notice without removing the previous outfit.
- A full-body view has uniform x/y metric scale and an upright camera. Its frame includes a 220 cm vertical span or expands uniformly when required to fit the width. It does not scale body buffers or stretch images. A 170 cm reference bar uses the same pixels-per-centimetre ratio and ground line.
- The supplied reference is cropped at the thighs and has no feet. Its original 300:332 aspect ratio is retained, its bottom is placed at the comparison ground line, and the crop is explicitly labelled. The height bar, not that image crop, is the metric reference. Actual feet-to-feet photographic comparison requires a full-body source.
- Only the known red annotation is repaired locally in the displayed reference bitmap. Image dimensions and all pixels outside the repair mask are unchanged. No anatomy is invented.
- The unsimulated short is rendered below the real moving shirt silhouette using a stencil pass. Openings and the lower hem follow actual shirt triangles. This is an explicit visual layering rule, **not** garment-to-garment physical collision validation. It is disabled when the shirt is hidden or transparent. No shirt, short or body vertices are changed by this compositing pass.

## Verification

`tests/fit-lab-responsive.test.mjs` checks uniform projection, cache keys/bounds and stencil ownership without geometry mutation. `scripts/fit-lab-responsive-review.mjs` reproduces the reported 141/75/79 and 153/82/86 cases, 0/25 degree arms, larger heights, rapid variant changes, wind, pause, initial visibility, photo aspect ratio and ground alignment, and mobile widths. It emits timings and real WebGL captures.

The existing fold-preservation hashes remain unchanged. Stencil behaviour follows the Three.js Material and WebGLRenderer contracts:
- https://threejs.org/docs/pages/Material.html
- https://threejs.org/docs/pages/WebGLRenderer
