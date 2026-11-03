# The EDO section and plan, measured off the user's plan (2026-11-03)

**The source.** The user sent a giant-scale (1/4 or 1/5) model plan of EDO floats for a J-3 / PA-11-class Cub (the
title block reads "GIANT SCALE 1/4 SCALE OR 1/5 SCALE"). It is the kind of plan traced from factory drawings; its own
source is not stated on the sheet. It holds:
- the top view of a float;
- the side view (drawn tilted);
- about a dozen formers (cross-sections), bow to stern.

The copy is 1024 x 532 px, so a former is 70-100 px tall. Every number below carries roughly ±2 px of reading.

`edo_section_measured.png` shows one former (F2) beside the model's section with the measured points over it.

## How it was read

- **Sections.** Each former was cropped and thresholded. In every pixel row, the outer edge was taken from the
  centreline to the outermost dark pixel; the left half was used, because the right half is crossed by other lines.
- **Normalisation.** The centreline is the former's own dashed vertical. The keel is the lowest point and the crown the
  highest. The chine is the widest row.
- **Top view.** The plan view's top edge was read against its centreline, from 0 at the bow to 1 at the stern.

## The section (formers F2, mid-forebody, and a forward former)

| | F2 | forward former |
|---|---|---|
| height / beam | 0.80 | 0.74 |
| chine height / total height | 0.30 | 0.33 |
| deadrise, keel to chine | ~26 deg (slightly convex) | ~26 deg |

Above the chine, the half-width as a fraction of the chine half-beam, against the height above the chine as a
fraction of the topside:

| s (height above chine) | F2 | forward | quarter ellipse, sqrt(1 - s^2) |
|---|---|---|---|
| 0.15 | 0.93 | — | 0.99 |
| 0.35 | 0.95 | — | 0.94 |
| 0.38 | — | 0.89 | 0.93 |
| 0.48 | 0.90 | — | 0.88 |
| 0.58 | — | 0.80 | 0.81 |
| 0.61 | 0.80 | — | 0.79 |
| 0.67 | 0.76 | — | 0.74 |
| 0.74 | 0.68 | — | 0.67 |
| 0.78 | — | 0.62 | 0.63 |
| 0.80 | 0.59 | — | 0.60 |
| 0.87 | 0.54 | — | 0.49 |
| 0.91 | — | 0.38 | 0.41 |
| 0.93 | 0.39 | — | 0.37 |

**The law: the whole topside is one quarter ellipse,** from the chine (where the float is widest) to the crown. It
matches within ~0.03 of the beam everywhere but the noisiest rows. There is no flat deck and no shoulder; the sides
lean in from the chine all the way up. The previous build (`crownK` 0.16 over a flared side, eyeballed) put a vertical
wall almost to the top with a shallow cap on it, which is the "a tad flat on top" the user saw.

## The plan (top view)

- **Length / beam:** 6.7.
- **Full beam** held from ~0.29 to ~0.53 of the length; the step is near 0.55.
- **Bow:** blunt. The beam is still 0.55 at 3 % of the length, then the nose rounds. A fullness exponent of ~4-5 fits
  it (the family's `planK` 4 and the fit land there).
- **Afterbody:** closes almost linearly from the step to a wide stern, 0.70 of the beam. A Wipline holds its beam to
  the aft spreader bar, then closes as the square to 0.50.

## The side view

The side view is drawn tilted, at a resolution that does not resolve a degree. It shows:
- the big blunt round nose (the bumper's seat);
- a top line that rolls down into it;
- a step near 0.55 L.

These are qualitative only. The keel's afterbody rise stays the Wipline family's (5.9 deg + the step), and is not
claimed from this plan.

## What the hull now does

**The section.**
- `32_hydro.js`: `crownK` 0.97 means the dome starts at most 3 % of the topside over the chine. The dome's height is
  the step section's, so the topside runs as one curve across the step.
- The hull-width row is the chine beam (`chineHalfStep`).
- The physics and the drawing share the same six facets a side, so the drawn hull is the physics hull to 0.1 %.

**The catalogue rows.**
- L is sourced where it is (1320, 2000, Model 78); elsewhere it is the 2000's scaled by the cube root of the buoyancy.
- B = L / 6.7 (the Model 78 keeps its own sourced 1.73 m).
- The fineness is pinned at 25 deg of deadrise and H solved for the model number's buoyancy. H lands at 0.80 of the
  beam on every row, the top of the plan's measured band. The shape and the model numbers agree with each other.

**The afterbody.** `EDO_AFT` gives held 0, linear closure, stern 0.70.
