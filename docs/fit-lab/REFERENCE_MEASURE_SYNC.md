# Reference photos and measurement synchronization

Base: 98a005b. Scope: profile selection and accessible range help only.

A card click emits one reference-profile event. The controller copies height, chest and hip from the registered scenario; manual garment, desired length, posture, volume controls and shorts choice remain unchanged. Auto garment mode continues to use its existing sizing rules.

Automatic reference following reads committed requested measures, not stale visible-body measures. It never writes body state or snaps values. Candidates inside all three ranges take precedence, then normalized distance and stable ID. If none covers the requested measures, the nearest illustration is labelled outside coverage. Switching reference auto off keeps the picture fixed and marks manually edited measures as partial. Explicit card selection applies measures in either mode and preserves that auto preference.

The versioned selection policy is height ±10 cm and chest/hip ±12 cm, endpoints included. The tooltip shows base, range, current values and the axes outside coverage. These are provisional scenario intervals, not garment sizes or a guarantee of fit. Weight is not used for matching or sizing, and dimensions are not inferred from portraits.

Range consultation is read-only: thumbnail/main-photo hover, keyboard focus and independent info buttons. The tooltip is hoverable and remains until dismissed/left; Escape does not move focus. Touch info toggles without selecting. It is bounded by the visual viewport and contains no focusable controls. Photo changes are cached (at most eight), revision-protected, and failed decode retains the prior image.

The controller is the only state writer. Explicit callbacks connect gallery/viewer/app; the gallery does not import body or garment physics. Tests check one worker revision for a valid explicit selection, unchanged manual pattern specifications, overlaps/endpoints/outside coverage, no-snap following, rapid clicks, keyboard and touch.

Reference: https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html

This cut does not change shorts geometry, hair, the original photo or textile simulation. Requested measures may differ from visible measures while a fit is preparing or rejected. This distinction remains in the existing scene labels.
