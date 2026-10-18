# Face release: appearance, loading and verifiable publication

Baseline: `a9efd99ccf8155e5ec2f03b62c1fca021f3533aa`, the actual public Lab before this cut. No main/commercial-site merge.

## Changes

- Locate the source mesh's visible eyelid rims, rather than use rays hitting the recessed eye socket. Ocular displacement is limited to 0.91 mm, not the 18–20 mm offsets found in unshipped local experiments.
- Brown irises, fitted eyelid margins, tapered eyebrow hairs, softer lip closure. Geometry is render-only, transforms with the existing head, and does not change the fitting body's measured contours or collision buffers.
- Batch facial geometry into two material groups; no draw call per eyebrow hair.
- Load body, bootstrap and fixed-pattern payloads concurrently. Create fixed-short render templates lazily; reuse selected templates and preserve authored positions/indices and nominal dimensions.
- Remove unused viewer imports, write-only physics state, and per-frame Array.from allocations used only for finite checks.
- Reuse the exact BVH nearest-point traversal for the moving short surface. Position versions invalidate memoized geometry/hits after refit. No contact decimation, material adjustment or solver-step reduction.
- Remove the legacy silhouette stencil. It could hide foreground shorts behind a background shirt, exposing skin even though physical shorts existed. Both garments now use ordinary depth testing with no auxiliary render pass.
- Embed a source-commit and face-version label in the built Lab footer. A local build is not a deployment; confirm the public release JSON after assigning the test alias.

## Quality gates

`fit-lab-face-quality.test.mjs` checks eye positions relative to measured rims, including an upper bound that rejects floating eyes. Existing body/pattern immutability tests remain unchanged. `fit-lab-release-performance.test.mjs` checks lazy allocation, reuse, disposal, exact moving-mesh queries and zero masking passes. The old test asserting that a stencil must exist is replaced with a depth-buffer contract; geometry thresholds are not weakened.

The workflow captures source commit, actual WebGL head views, actual full-Lab closeups, four profile changes, hover without fitting, camera-only changes, clothed-frame samples, desktop/mobile layouts and JavaScript errors. Loading is sampled in three fresh browser contexts for the original and updated build on the same runner. These are controlled local-HTTP Chromium/SwiftShader measurements, not user-network guarantees.

## Limits

This remains a stylized procedural avatar. The generated aspirational portrait is not a reconstructed 3D head and is not represented as an exact achieved match. No facial attractiveness scoring, identity inference, or alteration of garment/body measurements. Material and anatomical fitting still require validation against physical patterns; this cut does not certify industrial sizing. Hair from the verified baseline is retained, not rolled back to the obsolete source archives.
