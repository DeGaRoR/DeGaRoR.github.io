# DERELICT-HANGAR — the works hangar as the derelict Annette Island WWII hangar (design note, 9 Nov 2026)

The user (9 Nov): "in the story at some point you can buy that one, that allows you to construct bigger planes, and it's
not just buying it, it's actually restoring it, from the state of the actual Metlakatla or Annette Island World War II
hangar, which is currently derelict ... the new derelict hangar should fit the dimensions of the large one that we
have, and look somehow a bit like the real one ... Professional level of modelling quality."

Generator: `tools/_derelict_gen.js` (`window.DERELICT_GEN`, the HANGAR_GEN interface: DEF / ROWS / PRESETS / build /
applyFinish / makeFinish / BAGS / CATALOGUE). Bench: `tools/_derelict.html`. Stills: `tools/derelict_shot.js`.
Gate: `tools/_derelict_check.js` (GATE DERELICT).

## 1. The envelope: the works hangar's, exactly

`tools/_hangar_gen.js` 'works hangar': HW 20, HD 20 (40 x 40 m), EAVE 9.5, ridge EAVE + 2.6 = 12.1 (7.4 degree
pitch), slab at floorY 0.25, the door end +z (the house frame). The derelict stands on that slab and inside that
envelope: the same outer walls, the same eave and ridge lines, the same door head (DOOR_H = 6.4). The restored stage IS
`HANGAR_GEN.build(works hangar)`, so the story's last step swaps to today's asset with nothing to reconcile at the
footprint, the plot (HOME.2, pose (-116.63, 729.2), hdg -0.8552) or the fleet's tie-down pack.

## 2. The structure (WWII steel hangar practice, scaled into 40 x 40)

- **Main frames**: 9 frames at 5 m (8 bays; the works room has 11 at 4 m, but 5-6 m is the period's spacing).
  Each is a steel column (built-up I, 0.36 x 0.30) on a concrete pier, and a pitched Pratt truss: the top chord
  under the roof line, the bottom chord level at 8.5 m, so the truss is 0.75 m deep at the knee and 3.3 m at the
  ridge (span/12, the period's depth); 16 panels of 2.45 m, verticals at the panel points, the diagonals in tension
  toward the middle, knee braces from the column into the bottom chord. Chords are double angles back to back with a
  gusset gap; gusset plates at every panel point.
- **Secondary steel**: 14 channel purlins a slope at about 1.55 m (cut per bay so one can be missing or sag), sag
  rods at mid-bay, X-rod bracing in the roof plane in the two end bays and the middle one, longitudinal bottom-chord
  ties, eave struts, wall girts.
- **The galleries** (the real hangar's two-storey lean-tos): 5.5 m deep down both flanks, inside the envelope.
  Columns on the frame lines, a concrete floor at 4.0 m, a concrete roof at 8.0 m (under the trusses' bottom chord).
  Their outer walls (the flanks) and the walls facing the bay are steel-framed multi-pane window walls
  (7 x 5 panes a bay a storey), most glass gone; the right-hand inner wall at ground level is white-painted sheet
  with X-rod bracing (photo 1).
- **The front**: a doorless 29 m x 6.4 m span. Over it the door header: a 2.2 m deep Pratt girder, clad outside in
  pale corrugated sheet up to the roof line (3.8 m at the ends, 5.7 m in the middle). Either side, the corner towers:
  the galleries' front ends, in pale concrete, 0.3 m proud of the gable, with a door and window grids. The door's top
  track and the floor rail stay; the leaves are gone.
- **The back**: a 16 m opening (the doors gone), wind posts and girts, the cladding mostly stripped: daylight and
  trees through it (photo 1's far end).
- **The roof**: the cladding mostly gone; dark sheets left along the eaves, sagging, a few strays and milky roof
  lights on the purlins, two or three hanging into the void.

Where the proportions had to give (the real hangar is bigger and flatter):
- The span: the real clear span is far wider than 29 m and the building lower and longer; here the envelope is a 40 m
  square at 12.1 m, so the front reads taller and squarer. The header keeps its depth in metres (2.2 m girder, a
  3.8-5.7 m clad band), so it reads as deep as the photo's.
- The galleries are 5.5 m, not the real lean-tos' depth, and they sit inside the main roof rather than as lower
  lean-to roofs outside it, because the works envelope has its eave at the outer wall. The towers are 0.3 m proud
  of the gable so they still read as separate masses.
- The door: 29 m between the towers in the derelict, 35 m in the restored works (its formula, 2HW - 5): the
  restoration cuts the tower fronts back to the works' door pockets. (Question 2.)

## 3. The stages (`P.stage`, the story steps through them)

| stage | name | what it is |
|---|---|---|
| 0 | derelict | the photos: roof skeleton open to the sky, sheets missing / bent / hanging, glass mostly gone, rubble, graffiti, weeds, puddles |
| 1 | made safe | hanging and loose sheets down, rubble in two heaps, glass shards out, weeds cut inside, failed members replaced in grey primer, a barrier line and DANGER boards at the front; still open to the sky (still wet) |
| 2 | roofed | a new galvanised roof with roof lights and gutters; the walls still stripped and the ground-floor windows boarded; the slab dries |
| 3 | restored | `HANGAR_GEN.build('works hangar')` - today's works, clad, doors on |

`P.decay` (0..1, default 0.8) sets how far gone stage 0 is; `P.wet` (0..1) the puddles after rain (none once roofed).
Every random choice is seeded and stage-stable: a sheet that survives in stage 1 is the same sheet that hung there in
stage 0.

## 4. Cost (the budget, against today's works shell)

Today's works shell, measured: `HANGAR_GEN.build` restated (node) **3,878 tris lod 0, 612 lod 1/2, 7 bags**; baked from
hangar.js's exterior in the browser (the bench's stage 3, what the world draws) **3,776 tris in 19 draws**.

The derelict, measured (GATE DERELICT, the apron off as in game; a draw = a non-empty bag, plus its shadow draw):

| lod | distance | stage 0 | stage 1 | stage 2 | budget (gated) | what drops |
|---|---|---|---|---|---|---|
| 0 | < 200 m | 87.3 k tris, 13 draws | 80.3 k, 15 | 76.7 k, 15 | <= 95 k, <= 16 | - |
| 1 | 200-600 m | 10.7 k, 9 | 10.8 k, 10 | 9.5 k, 10 | <= 12 k, <= 10 | corrugation (flat sheets), gussets, verticals, rods, windows, shards, weeds, stains, decals, barriers; grey primer folds into the steel |
| 2 | 600-1500 m | 3.4 k, 5 | 3.4 k, 5 | 3.8 k, 6 | <= 4.5 k, <= 6 | everything but the massing, the cladding (a column of sheets one quad), the chords, the columns and every other purlin; the slab folds into the concrete, the white sheet into the pale |

So up close the derelict is ~23x the works shell's triangles (an open steel skeleton IS triangles: 40 k of the 87 k are
the frames, purlins, girts and window sashes) in FEWER draws (13 against 19); past 200 m it is ~3x, past 600 m ~1x.
On the bench (SwiftShader, 1600 x 900, shadows, the mirror pass) a frame of the whole plot is 224-368 draw calls; the
derelict's own share is its 13-15 bags x 2. The AO bake is 0.2-0.6 s a build (once, at the build).

The bags, one material each: steel (red-oxide primer, rusting), steelNew (grey primer, stage 1+), sheetPale (the
header band and walls), sheetDark (the eave sheets), sheetWhite (the painted inner wall), sheetNew (stage 2 roof),
concFloor (slab, gallery floors, rubble, apron), concWall (towers, stem, piers), glass (milky panes and shards),
water (puddles), decal (graffiti, litter, signs: one canvas atlas, alpha-cut), stain (rust streaks, water marks,
cracks, joints, the wet margin: the same atlas, blended), weed (grass, fireweed, alder, dry grass: one atlas,
alpha-cut cards), plastic (the orange barriers), ply (stage 2 boards), aoskirt. A stage uses 11-13 of them.

The trusses: one interior truss is built once and stamped onto every sound frame (`Bag.append`); damaged frames are
built on their own. The prototype and its transforms are published (`stats.instances.truss`) for a GPU
InstancedMesh, but merged in a bag the whole steel frame is already ONE draw, so instancing buys memory, not draws.

## 5. Questions (each with its default)

1. **Galleries in the restored works.** The works room (hangar.js, layout 'works') has no galleries, so stage 3 takes
   them down. Default: they go at stage 3 (the works stays today's asset); keeping them as the works' offices is a
   hangar.js chantier for later.
2. **The door.** The derelict's opening is 29 m between the towers; the works' door is 35 m. Default: the restoration
   widens it (the tower fronts become the door pockets at stage 3).
3. **Stage count.** Default: the four named stages above. A continuous 0..1 restoration dial is possible but the story
   steps are what the Game coordinator asked for.
4. **The wet floor.** Default: puddles everywhere the slab is low after rain (`wet` 0.65); in game a planar
   reflection is NOT drawn (the puddles reflect the sky's environment map); the bench's stills draw a true mirror of
   the frame in the puddles (one extra pass, the eye inside only). Alternative: the mirror pass in game when the eye is
   inside the hangar (about +40 % of the hangar's draw cost while inside).
5. **Graffiti.** Default: abstract tags and scrawls drawn procedurally (no words, nothing that reads as a real crew's
   tag), at the foot of the white wall, the tower fronts and a pier or two.
6. **The apron.** Default: the premises' pavement draws the apron in game (`apron` 0); the build's own cracked apron
   with weeds in its joints is on for the bench and the stills.
