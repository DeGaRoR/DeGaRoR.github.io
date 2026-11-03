# The EDO float measured off the user's plan (round 3, 2026-11-03)

**The source.** The user sent a giant-scale (1/4 or 1/5) model plan of EDO floats for a J-3 / PA-11-class Cub (the
title block reads "GIANT SCALE 1/4 SCALE OR 1/5 SCALE"). It is the kind of plan traced from factory drawings; its own
source is not stated. It holds:
- a top view and a side view of a float;
- about a dozen formers (cross-sections).

The copy is 1024 x 532 px, so a former is 70-100 px tall. Every number below carries ±2 px of reading.

**The figure.** `edo_measured_vs_model.png` puts the model (blue) over the measured points (red and green), with the
Wipline 2100 (orange) for comparison.

**How it was read.** Each view was cropped, enlarged x4-x5 with an original-pixel grid drawn on it, and read by eye at
the outline. An automatic column scan could not tell the outline from the stringer lines and the neighbouring
drawings.

**Round 2 was wrong.** It read only two of the smaller formers, and one of those (F2) was cut off at the crop's edge.
From them it concluded that the topside is one ellipse from the chine. It also left the belly, the profile and the
bow as the Wipline's. The user caught both.

## The section: six formers

| former | height / beam | chine / height | deadrise | side lean | shoulder: z / half-beam | shoulder: up the topside | bottom |
|---|---|---|---|---|---|---|---|
| A (front spreader station) | 0.81 | 0.22 | 19° | 19.5° | 0.66 | 0.75 | convex: ~8° at the keel, ~31° at the chine |
| B (aft spreader station) | 0.83 | 0.26 | 23° | 21° | 0.63 | 0.77 | convex: ~14° / ~31° |
| C | 0.75 | 0.31 | 25° | 30° | 0.67 | 0.53 | straight |
| D | 0.81 | 0.23 | 21° | 23° | 0.69 | 0.59 | convex (wavy) |
| E | 0.74 | 0.35 | 28° | 21° | 0.74 | 0.70 | straight |
| F | 0.67 | 0.30 | 22° | 26° | 0.73 | 0.60 | straight |

**The law.**
- **Widest at the chine.** From there the side LEANS IN about 23 deg, straight, up to a shoulder at about 0.69 of the
  half-beam and about two-thirds of the topside's height. The stringer's notch sits there.
- **Above the shoulder, a round top to the crown.** The plan shows a slight knuckle at the stringer. The model makes
  the arc tangent to a 23 deg lean, which leaves about 10 deg at the shoulder.
- **No chine lip, no spray strap, no external keelsons.** The formers notch their stringers inside.
- **The bottom is CONVEX on the big mid-body formers** (A, B, D). It runs nearly flat out from the keel, then rises
  steeply to the chine; its mid point (half the half-beam out) sits at about half the straight V's height. At the
  bow's and stern's formers it is a straight V.

## The top view

- **Length / beam:** 6.65.
- **Full beam** from about 0.29 to 0.53 of the length.
- **Bow:** blunt (0.55 of the beam at 3 % of the length).
- **Afterbody:** closes almost linearly to a 0.70 stern.

## The side view

The side view is drawn tilted 4.6 deg; it was read against its own deck line.

- **The deck:** straight and level. It is parallel to the flat keel ahead of the step: no sheer.
- **The forebody keel:** flat over the aft ~0.40 of the forebody. Ahead of that, a convex rocker sweeps up into a
  raked bow under a round nose; the nose's front sits at 0.85 of the depth.
- **The keel's rise** (fraction of the depth) against t (fraction of the forebody ahead of the step):
  - t 0.42: 0.01
  - t 0.53: 0.05
  - t 0.64: 0.10
  - t 0.68: 0.12
  - t 0.72: 0.15
  - t 0.75: 0.19
  - t 0.83: 0.28
  - t 0.95: 0.58
- **The step:** at 0.573 of the length, about 0.12 of the depth deep. A Wipline's is ~0.17.
- **The afterbody keel:** rises to a stern 0.385 of the depth deep.
- **Scale caveat.** The side view's depth reads ~13 % taller than the formers at the same beam. Only its dimensionless
  ratios are used, never its raw angles.

## What the model does with it (`32_hydro.js`, `EDO_STYLE` / `EDO_HULL` / `edoPresetParams`)

- **The section law.**
  - `shoulderZ` 0.69, `crownK` 0.34 (the arc's share of the topside), `tumble` 23.
  - `belly` 0.5: the mid point's drop. It is full over the middle and fades to a straight V by 0.8 of the forebody and
    0.9 of the afterbody.
  - The physics section and the drawing are the same polygon: two bottom facets a side, the leaning side, six arc
    facets.
- **The side is one skin through the step.** The forebody's chine is a little wider at the step (2-3 cm a side on the
  2000), fading back to the plan's beam by 0.3 of the forebody.
- **The profile.** The keel flat 0.34 of the forebody, a 45 deg rake (at the fit's xs/H), stem 0.40, nose round 0.15.
  These were fitted to the eight keel points within 0.01 of the depth.
  - The rake is rescaled to each hull's own proportions.
  - The step is 0.12 deep at 0.573 L.
  - The afterbody angle is solved for a stern 0.385 deep: 7.9 deg on the small rows, 6.3 on the Model 78.
- **Planform.** `planK` 5.5; the stern 0.70; the deck level (`sheerK` 0).
- **Sizes.** The plan's proportions are fixed (L/B 6.65, H/B 0.80) and the whole hull is scaled to the model number's
  buoyancy. The EDO 2000 comes out 4.67 m (15.3 ft) against the owners' "16 ft bumper to transom" (4.88 m, bumper
  included). The Model 78 keeps its sourced 42 ft x 5 ft 8 in, and its height is solved: 0.70 of its beam.

## Not modelled, and why

- **Sections that vary between bow and stern** beyond the convexity fade. C, E and F lean a little more and sit a
  little lower than A and B. One law, the mean, is used.
- **The plan's slight shoulder knuckle** is smoothed to ~10 deg.
- **The keelson and stringer layout** is inside the skin and not drawn.
