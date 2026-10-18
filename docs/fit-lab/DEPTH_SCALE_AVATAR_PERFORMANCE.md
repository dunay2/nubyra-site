# Depth coverage, metric comparison, softer eyes and performance

Base: a9efd99ccf8155e5ec2f03b62c1fca021f3533aa (live Lab read before changes).

## Coverage root cause and correction
The old layer drew the full two-sided shirt silhouette to stencil with depth testing disabled, then discarded matching short pixels. A back shirt panel could therefore erase a front short surface, even where the body was between them. This cut removes that pass and uses the actual depth of both already-simulated cloth surfaces. No body mask, repainting, hidden enlargement or nominal length changes. The waist constraint and physical shirt-to-short contact are retained.

## Comparable scale
The reference uses its declared profile height and authored head/feet image landmarks at the same projected pixels per cm and ground line as the avatar. Explicit player selection restores a usable full-body camera framing. Free pan/orbit/zoom remain, and camera gestures alone never simulate cloth. The synthetic photograph is illustrative, not a calibrated photograph or an anatomical measurement. Ground alignment is the defined projected origin, not a promise that perspective/pose is identical.

## Eyes and hair
Eye colour, iris size, upper-lid shading and corneal clearcoat are refined without changing the head's collider. Hair follows the existing head with a shared continuous envelope, softer edge, thinner curved ponytail and separated tapered tips. Hair remains procedural and stylized. It is not photorealistic or physically simulated.

## Faster exact-state loading
- Parallel GLB/bootstrap/fixed-short downloads.
- All fixed templates validated, but their render geometries/normals/bounds are materialized lazily.
- Exact optimized nearest-point queries on dynamic shorts, invalidated on every geometry update/refit.
- Eight exact-state results computed at build time with the same 360-step solvers, default profile controls, default 64 cm desired shirt and 42 cm shorts. Files fetched only for exact keys and checked for SHA-256. Live first-frame settling starts immediately; a valid exact result can finish the pending computation. Offline, missing, changed-length, changed-shape and stale-revision cases continue live; no nearest-profile approximation is restored into another body.
- Ordinary repeat states still use the bounded eight-entry session cache.

No new physical calibration, global self-collision or continuous collision detection is claimed. Test results and side-by-side screenshots are saved as CI artifacts. Publication is restricted to the Lab alias; branches remain unmerged.
