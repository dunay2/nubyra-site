# Physical support, not suspended cloth — NUBYRA Fit Lab

2026-10-14. Base: `bc74a9098bae1306afe0afef1fb0ff53aea89c84`. Target: existing Fit Lab only.

## Reproductions and causal finding

U1 is the submitted 79/88 cm body, shape 4/4/10, manual N1-1 and desired length 55 cm. U2 is the submitted 113/130 cm body, shape 3/5/5, automatic N2-3 and desired length 64 cm. Desired length is a preference, not a claim that the selected fixed garment has that length.

The previous radial remapping sent every upper-panel vertex onto a torso-sized ellipse. In N1-2 this enlarged the neckline boundary to 86.67 cm, approximately the synthetic shoulder section circumference. Eight fixed particles prevented a garment with that geometry from slipping off. Removing the pins without correcting the pattern caused it to fall down the torso. Replacing the pins or reducing collision clearance could not correct this cause.

## Changes and two passes

1. **Pattern and physical support.** The lower/chest circumference mapping is retained. Above y=0.50 the original authored neckline and shoulder shape is restored with a smooth graded transition. The same rest pattern is used regardless of the body. All eight kinematic supports are removed; every garment particle is dynamic. The initial pose is placed above the shoulder collision surface once, then gravity and unilateral contact determine support. Contact friction is bounded by normal correction (Coulomb-style positional approximation); no attraction to the body is added.
2. **Mass and numerical convergence.** Each triangle contributes density × area / 3 to its incident vertices. A demo surface density of 0.18 kg/m² yields about 105–149 g for these meshes. These are assumed material values, not measurements of a purchased textile. Inverse masses and spring compliances are scaled by the same reference mass, preserving the XPBD equation. A 1/480 s substep and six iterations reduce local overstretch compared with the previous uniform-mass, 1/240 s, three-iteration solver. An arbitrary velocity clamp is removed. Settling is specified in elapsed simulation seconds, not an assumed number of substeps.

The material is explicitly a **distance-spring network**. Its bending is still opposite-vertex distance constraints, not a calibrated anisotropic continuum shell. It does not claim industrial garment accuracy. Full cloth self-collision and continuous collision detection are not implemented.

## Mechanics tests added

- Exact discrete free fall against 9.81 m/s², with air drag disabled and no velocity cap.
- Total area-derived mass unchanged under triangle subdivision.
- A plane supports gravity; friction dissipates tangential motion and cannot attract separated cloth.
- U1 and U2 remain supported with zero pins and positive inverse mass at every particle.
- Removing the body removes the support: the settled garment must actually fall.
- Body changes reset the dressing pose without changing the rest pattern or mass.

Old tests requiring exactly eight pins were replaced with the stronger opposite contract: **zero pins and dynamic particles**. The former illustrative wind test prescribed a minimum hem displacement of 1.5 cm; the new free-contact model produces 1.489 cm in that case. No wind gain was tuned to make the number pass. The assertion now checks nonzero force response and motion of the free hem relative to the supported straps, plus recovery and penetration limits. The old amplitude is not a physical law. Its original positional/contact thresholds remain unchanged.

## Measured values (90 reference frames = 1.5 seconds simulated)

| Case | Fixed supports | Shoulder area within 1 cm | Upper-edge kink | Edge strain P95 | Max edge strain | Sampled penetration |
|---|---:|---:|---:|---:|---:|---:|
| U1 79/88 N1-1 | 0 | 100% | 2.84 mm | 2.46% | 21.63% | 0 mm |
| U2 113/130 N2-3 | 0 | 100% | 2.87 mm | 2.91% | 15.24% | 0 mm |
| Reference 88/96 N1-2 | 0 | 100% | 2.63 mm | 2.48% | 17.04% | 0 mm |
| Oversize 72/74 N2-3 | 0 | 99.33% | 4.24 mm | 3.41% | 18.73% | 0 mm |

Area proximity means sampled triangle-centroid distances weighted by rest area, not certified full-surface contact. Max strain still matters: these results do not certify material suitability. The new pattern is versioned; it is not silently passed off as the old industrial pattern.

## DoR

- [x] Current live commit and both screenshot configurations recorded.
- [x] Prior support mode, rest-neckline size and pin-free failure reproduced.
- [x] Hypotheses tested: friction alone, additional iterations, smaller steps, upper-pattern correction, area-derived masses.
- [x] No recommendation/size/color/body-measure code is replaced.

## DoD / release gates

- [x] Physical support contract demonstrated on U1/U2 and baseline: no fixed particles.
- [x] Free-fall, mass and plane-friction tests pass.
- [x] Rest pattern independent of body, no attraction or post-solver cosmetic smoothing.
- [ ] Full Node suite and browser regression pass on committed source.
- [ ] Front, side, back and 3/4 inspected for both submitted cases; captures archived.
- [ ] Actual source commit deployed and verified in Vercel; repeat browser checks on the public URL.
- [ ] Industrial validation, real fabric parameter calibration, self-collision and full CCD (not claimed by this release).

## Cost and caveats

More solver work is required: 1.5 s simulated settling took approximately 3.9–4.7 s CPU in the single-vCPU test environment. Browser behavior must be checked before publishing; on-demand rendering and existing disposal remain. The law-based change must not be sold as a performance improvement. Surface density, friction and elastic parameters need fabric measurements before fit predictions can be treated as commercial evidence.

## Primary references

- Macklin et al., XPBD: https://matthias-research.github.io/pages/publications/XPBD.pdf
- Position-Based Dynamics overview: https://interactivecomputergraphics.github.io/physics-simulation/examples/pbd.html
- Blender cloth contact and friction: https://docs.blender.org/manual/en/latest/physics/cloth/settings/collisions.html

No external engine or third-party cloth source was copied. No new runtime package dependency.
