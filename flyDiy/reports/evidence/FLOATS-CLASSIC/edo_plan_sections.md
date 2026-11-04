# The EDO float measured off the user's plan (rounds 3 and 4, 2026-11-03)

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
| A (front spreader station) | 0.81 | 0.22 | 19° | 19.5° | 0.66 | 0.75 | fluted (round 4; read as convex in round 3) |
| B (aft spreader station) | 0.83 | 0.26 | 23° | 21° | 0.63 | 0.77 | fluted |
| C | 0.75 | 0.31 | 25° | 30° | 0.67 | 0.53 | straight |
| D | 0.81 | 0.23 | 21° | 23° | 0.69 | 0.59 | fluted |
| E | 0.74 | 0.35 | 28° | 21° | 0.74 | 0.70 | straight |
| F | 0.67 | 0.30 | 22° | 26° | 0.73 | 0.60 | straight |

**The law.**
- **Widest at the chine.** From there the side LEANS IN about 23 deg, straight, up to a shoulder at about 0.69 of the
  half-beam and about two-thirds of the topside's height. The stringer's notch sits there.
- **Above the shoulder, a round top to the crown.** The plan shows a slight knuckle at the stringer. The model makes
  the arc tangent to a 23 deg lean, which leaves about 10 deg at the shoulder.
- **No chine lip, no spray strap, no external keelsons.** The formers notch their stringers inside.
- **The bottom is FLUTED on the big formers ahead of the step** (A, B, D; round 4, the user's reading: "a Batman
  figure"). Each half of the V is two shallow CONCAVE arcs of about the same radius, keel to a ridge and ridge to the
  chine, barely meeting. Round 3 read the ridge's cusp as a convex belly; that was wrong.
  - The ridge sits at 0.55 of the half-beam out, 7.4-9 % of the half-beam below the straight V.
  - Each arc is cut ~6 % of its chord into the hull.
  - The smaller formers (C, E, F: toward the bow and aft of the step) are a straight V.

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
  - `flute` 0.08: the ridge's drop over the half-beam, at 0.55 of it. Each arc's depth is 0.75 of that over its chord
    (0.06). Full from the step to half the forebody, gone by 0.85 of it; none aft of the step.
  - The drawing carries the flutes as six points a side: two on the keel's arc, the ridge, three on the chine's. The
    EDO's keel and chine are sharp, so the Wipline's keel and chine rounds' slots carry them.
  - The physics' bottom is two facets a side (keel, ridge, chine), its ridge raised by exactly the area the flutes cut
    in: the same section area, a third of the panels. Drawn and physics volumes agree to 0.09 %.
- **The side is one skin through the step.** The forebody's chine is a little wider at the step (2-3 cm a side on the
  2000), fading back to the plan's beam by 0.3 of the forebody.
- **The profile.** The keel flat 0.34 of the forebody, a 45 deg rake (at the fit's xs/H), stem 0.40, nose round 0.15.
  These were fitted to the eight keel points within 0.01 of the depth.
  - The rake is rescaled to each hull's own proportions.
  - The step is 0.12 deep at 0.573 L.
  - The afterbody angle is solved for a stern 0.385 deep: 7.9 deg on the small rows, 6.3 on the Model 78.
- **Planform.** `planK` 5.5; the stern 0.70; the deck level (`sheerK` 0).
- **Sizes.** The plan's proportions are fixed (L/B 6.65, H/B 0.80) and the whole hull is scaled to the model number's
  buoyancy. The EDO 2000 comes out 4.72 m (15.5 ft; the flutes cost volume) against the owners' "16 ft bumper to transom" (4.88 m, bumper
  included). The Model 78 keeps its sourced 42 ft x 5 ft 8 in, and its height is solved: 0.70 of its beam.

## The ventral fin (round 4)

The plan draws a ventral under the tail cone that the user called "a tic-tac shape on one side, and then it just goes
further toward the fore side". Read off the plan, in fractions of its chord (about 3.0 times its depth at the aft end):

- **The forward point** leaves the belly and sweeps down to the bottom over the first 0.36-0.39. It is a PARABOLA:
  about 50 deg to the belly at the tip (40, 29, 17 deg below level at a quarter, half and three quarters of the way),
  meeting the bottom tangent. Round 4's first try was a quarter ellipse, which starts vertical: wrong.
- **The bottom** is straight and level from 0.36 to 0.82.
- **The aft end** is ROUND, a half-ellipse as deep as the fin, from 0.82 to 1.0 (the plan's 0.86).
- **Its area** is 0.841 x chord x depth (the plate's is 0.5 (1 + tip) x chord x depth). The join flies that area.

It is the `ventral shape` row (`finVentralShape` 1, "vintage lobe") on any card. The EDO presets set it, with the chord
at depth / 0.33.

## The water rudder (round 4)

The plan's blade is a "river stone": a rounded pebble hung off the post by two arms, about 1.15 times as wide as tall.
The model's is a superellipse, squarer above (n 3) and rounder below (n 2.2). Its foot is the physics' `wrDepth` under
the stern keel and its area is `wrArea`, so the water still reads what is drawn.

## Not modelled, and why

- **Sections that vary between bow and stern** beyond the convexity fade. C, E and F lean a little more and sit a
  little lower than A and B. One law, the mean, is used.
- **The plan's slight shoulder knuckle** is smoothed to ~10 deg.
- **The keelson and stringer layout** is inside the skin and not drawn.
