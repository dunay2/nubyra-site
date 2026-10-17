# Outfit proposal, photo preview and regional hair

Base: ff9248ea79a6e764e1947cb7e4d0ced03ce9771e. Publication is limited to the Fit Lab alias; no merge or commercial site changes.

Selecting a player requests both garments, rather than retaining a manually chosen short that prevents the new body from being presented. Desired length, pose and volume controls are retained. A manual garment edit remains possible after selecting the player.

The existing chest/hip evaluation selects the base and lateral position. Desired length selects an explicitly identified fixed rest cut (48/56/64/72/80/84 cm), with a distinct simulation key. The closest proposal is still returned when strict ease rules fail, with failed zones explicitly reported. An actually impossible contour is not labelled compatible or silently enlarged. All proposed dimensions are engineering hypotheses, not approved manufacturing patterns.

Shorts retain their fixed nominal waist/hip and lengths 34/42/50 cm. Explicit rise alternatives 35.5/37.5 cm accompany the existing 33.5 cm for the two longer cuts. These are authored once at build time, with unchanged X/Z vertices, hip/waist planes and total length. Selection of a different rise is visible and exported. No avatar shape is changed and no clearance cap is increased. The tied waist and bounded visual surface contact remain uncalibrated approximations, not a deformable textile simulation.

Hover or keyboard focus previews the large image only. No measurement dispatch, selected-profile change, worker revision or fitting computation occurs. Leaving/Escape restores the selected photo; clicking applies measurements and proposes garments. Info buttons still consult ranges without changes. Stale image decodes are discarded.

The redundant original/scale tabs and second WebGL viewer are removed. Original image assets are preserved on disk but no longer appear in the panel. The chosen photograph is independently contained without cropping head or feet, not shown as a measured photographic height comparison.

Hair 3.0 gathers regional forehead, temple and nape paths at an occipital anchor sampled from the real scalp. A compact tie and descending curved tail replace the rigid rear spike. It remains a stylized procedural asset. Body and collider buffers and the cloth material are unchanged.

Validation includes fixed-geometry unit invariants, eight real preset-body presentations, measured visible length changes, read-only hover/focus, mobile containment and head views. Artifacts must be reviewed before publication. Legacy assertions for the removed tabs and former selection-preserves-manual behavior are replaced by tests of the new explicit requirements.
