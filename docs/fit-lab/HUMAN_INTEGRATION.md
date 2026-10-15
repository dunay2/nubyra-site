# Full human base — controlled integration

## DoR
User approved the reviewed full MakeHuman/MPFB adult female surface, not another procedural torso tweak. Production baseline: `4ca8d9b`. Preserve catalogue, personalization, commit-on-release and the common metric unit.

## Scope
The default Lab now loads a single 13,380-vertex / 26,756-triangle connected body, with head, arms, hands, pelvis, legs and feet. `?body=synthetic` preserves the earlier benchmark while it is retired. It is explicitly an adult synthetic reference, not an individual reconstruction, youth pattern or measurement inferred from the supplied photo.

The geometric source is rebuilt from the reviewed MPFB recipe at pinned upstream commit `3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf`, with SHA-256 checks on every downloaded OBJ/target. Generated positions and indices match the approved GLB byte-for-byte (geometry SHA-256 `8368dbced682f9564dfdde46656566d903a8f26045154febd4fa1d99dad6e4e0`). Normals are recalculated on the same surface. Upstream assets license: CC0-1.0.

## Measures, contact and scope limits
Chest and hip are measured along explicit closed torso sections of the mesh (arm loops excluded). Smooth regional scale fields preserve the imported anatomy, with metric iterations matching the requested perimeter. The three volume controls now produce modest shape redistribution, not unconstrained inflation. This is a geometric adaptation, not anthropometric inference or a native MPFB statistical fit.

Visible body and collider use the same deformed positions and indexed triangles. `three-mesh-bvh@0.9.1` accelerates nearest-surface queries; no old radial torso is hidden behind the new body. The jersey retains its catalogue rest pattern, area-based mass, gravity, friction and no fixed pins. Human contact uses a 1/240 s / 4-iteration demo preset and a 4.23 mm numerical contact allowance. Reverse body-vertex/cloth-face constraints catch anatomical detail that falls between cloth vertex/centroid samples. Neither continuous collision nor cloth self-collision is claimed.

Shorts are clipped from the actual human pelvis topology with a looser lower leg profile; they remain a static design reference, not textile simulation. The optional bust guide is visual only. The adult body must not be treated as an infant/juvenile pattern by reducing its height.

## Performance
All BVH construction and XPBD stepping run in a dedicated module Web Worker. Render/UI remain on the main thread. Input is committed on release/Enter/blur; changing a value invalidates older worker revisions. Rendering uses existing buffers; textures/colors and camera never rebuild the body. Worker work stops after its settling window and is paused during editing, explicit pause, hidden tab and context loss. The settle window is not a guarantee of physical convergence: residual motion/contact errors are retained in diagnostics. No claim of faster numerical convergence.

## Acceptance evidence
DoD requires: geometric fingerprint and one closed connected component; chest/hip/height within 0.01 cm in selected tests; same-buffer BVH; no fixed support; cloth falls without collider; measured vertex/centroid penetration below 1 mm in the reference case; real frontal/lateral/three-quarter/back browser renders; personalization, commit controls, motion/pause, responsive and worker heartbeat checks. Numerical tests do not certify anatomical quality. Public release must only follow inspected browser evidence.

## References
- https://github.com/makehumancommunity/mpfb2/tree/3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf
- https://github.com/makehumancommunity/mpfb2/blob/3af0cd5a2ffba072e93a34e5f6f494fdc4813ddf/LICENSE.ASSETS.md
- https://github.com/gkjohnson/three-mesh-bvh/tree/v0.9.1
- https://threejs.org/docs/#examples/en/loaders/GLTFLoader
