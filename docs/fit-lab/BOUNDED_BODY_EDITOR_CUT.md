# Experimental bounded body editing and free camera

Base: e23efbc6d580ee085aa7b87f40a00fe63f0d72bd. Keep the preceding outfit proposal, fixed patterns, independent length cuts, portrait hover and updated hair. Lab only; no automatic merge or commercial site deployment.

## Implemented scope
- Orbit, vertical tilt, right-button screen pan, zoom .35–5, zoom to cursor, double-click focus, pelvis focus, full-screen and recoverable fit. Camera interactions do not change clothing or Worker revision. Keyboard events are scoped to the focused canvas.
- Six screen-projected handles: existing height and five new regional shape parameters. Finite smooth symmetric influence zones for pelvis width, posterior projection, abdomen, thigh width and chest projection. Numerical inputs and drag use the same hard limits. Every deformation starts from the original mesh, never from the previous deformed vertices.
- Draft is a wire cage over the previous clothed state. No physical reinitialisation on pointer move. Pointer release commits one update; Escape cancels. Up to 20 regional undo states.
- Regional edits do not renormalise perimeter. Measured chest/hip are returned to the main fields and sizing, with explicit neutral perimeter anchors retained in the state. Profile selection or direct edits of principal circumferences start a new neutral regional base. This prevents pulling the rear inward and growing the belly silently.
- All region and neutral-anchor fields are part of the solver/cache key. The renderer and Worker evaluate the same function. Patterns retain their identity in manual mode.

## Technical limits (not anatomical limits)
Hip width -12..12%; posterior pelvis -3..3 cm; abdomen -2.5..3 cm; thigh width -12..15%; chest projection -2..2.5 cm. They describe deformation controls, not measured changes of an entire perimeter. Height keeps the existing base range 125..210 cm.

There is a local guard for nonfinite coordinates, triangle orientation, area and edge ratios. Invalid drafts retain the preceding accepted draft. These local checks and endpoint tests DO NOT constitute exhaustive self-intersection certification. The model is still a transformed adult MPFB base, not validated pediatric anthropometry. This cut does not implement an industrial morph-target library, new anatomical bases, elasticity calibration or physical shorts simulation. Existing shorts over-volume is not cured by claiming its shape is anatomy.

## References
Three.js OrbitControls: https://threejs.org/docs/pages/OrbitControls.html
Three.js BufferGeometry: https://threejs.org/docs/pages/BufferGeometry.html

The new point gestures are not directly connected to arbitrary vertex scale tools; they edit the bounded parameter registry.
