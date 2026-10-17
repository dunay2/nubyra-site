# Eight right-side references — release acceptance

The central renderer is the existing interactive WebGL body and live garment, not a generated screenshot. On desktop the measurement editor is left, the actual model is central, the image is right. The original supplied photograph remains the initial reference and is preserved byte-for-byte in assets/reference-user.webp. It has not been extended.

## Eight profiles

The eight full-figure illustrations are extracted (cropping only, no body warping) from the synthetic eight-profile board approved in the conversation. Source provenance and SHA-256 are stored in assets/reference-profiles.json. They are **low-resolution preview illustrations**, not eight measured photographs. No age, weight, diagnosis or other characteristic is inferred from an image. Height, mass and circumferences in reference-profiles.mjs are scenario targets and are marked as such in the UI and export. The existing original photograph and local upload are available independently.

Automatic selection computes a deterministic normalised distance using height, chest and hip only. Weight is metadata, not a fit variable. The nearest example outside coverage is explicitly flagged. Manual reference selection never changes the body, clothing catalog, configuration or worker revision. One asset request (~15KB) loads the whole set; no additional WebGL contexts or solvers are created for eight types.

Uniform image scaling uses the defined profile height and cropped head/foot landmarks. This is an illustrative comparison; it does not validate the image as an anthropometric reference. The separate 170cm 3D comparator remains available for a controlled metric comparison.

## Acceptance

- Original photo retained on right; actual interactive model remains central.
- Eight distinct selectable images; manual and automatic modes; latest decode wins.
- Height and both circumferences affect proximity; different target masses are shown but never drive sizing.
- Switching references does not restart the physics worker or change either rest pattern.
- 320/390/850px layouts retain all controls without horizontal overflow.
- Existing live settling, hair 2.1, fixed shirt/short patterns and per-zone recommendation preserved.
- Legacy shorts browser test explicitly distinguishes a body-adaptive legacy short from the new fixed-length catalogue. Its invariant is adapted to the product, not removed.

## Remaining visual work

Replacing preview thumbnails with higher-resolution, consistently framed individual images remains necessary for a polished photographic finish. Earlier generated outputs were whole interface mockups and are not passed off as new photographs. The right-side images do not prove textile fit. Elastic waistband physics and complete inter-garment cloth collision remain outside this cut.
