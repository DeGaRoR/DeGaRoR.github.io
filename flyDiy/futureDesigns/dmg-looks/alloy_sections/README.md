# DMG-LOOKS: alloy sections (the metal Cessna's formers and stringers), prototype, 27 Oct 2026

The ask (the user via A0, 27 Oct): the metal Cessna's formers and stringers torn as alloy sections, with bare alloy
and then grey primer at the tear. **Prototype only**, until DEFORM pushes the reworked pool. This is node work: no
`src/` change, and DEFORM's `dmg_members.js` is read and called but never edited.

## Files

| File | What it does |
|---|---|
| `alloy_sec_census.js` → `alloy_sec_census.json` | What the formers and stringers are as drawn, which physics members they lie on, and what the crashes break. |
| `alloy_sec_proto.js` → `alloy_sec_proto.txt`, `alloy_sec_proto.png` | The crossings, the virtual members, DEFORM's pool fed with them, the counts and the picture. |

Run both from the repo's `flyDiy`. Run the prototype against a checkout at DEFORM's base (master d7e181f4e):
`node futureDesigns/dmg-looks/alloy_sections/alloy_sec_proto.js --root <that checkout's flyDiy>`. The pool is read
from `origin/claude/dmg-looks` by `git show`, or from `--pool <file>`.

## What the census found: one slot per member does not fit here

- **Not tubes.** The formers and stringers are the cage's `aluminium` bucket, with role `struct`. They are bound as
  **covering** (place by place; `R.mem` is empty), not as tube units. So DEFORM's `measure()` never sees them.
- **Not on the members.** They are not drawn on the physics members:
  - the metal Cessna's frame rings stand every ~0.97 m (stations 0, 0.95, 1.85, 2.82, 3.80, 4.77 and 5.75 m);
  - the drawn formers stand at 0, 0.5, 1.0, 2.6, 3.4, 4.2 and 5.0 m;
  - only 5 of the 109 fuselage `alloy` members have a drawn section along them.
- **Wrong material key.** The members are `mat: 'alloy'`, which `MAT` does not list, so `plan()` gives them no slot.
- **So a drawn former tears where the covering parts**, wherever that falls along it.

## The design: one slot per tear crossing, fed to DEFORM's pool unchanged

1. **Find the crossings.** After a crash flown through the real binding (`_dmg_wall_study.js` `prepare` plus the `inh`
   scheme's loop), the `aluminium` record's dead triangles (removed or torn) are clustered in 3D (linked within 3 cm).
   - Each cluster's local axis comes from a PCA of its own drawn piece.
   - Its two live edges are the live places just past it along that axis.
2. **Cut the section at each end.** All live `aluminium` triangles are cut by the plane across the axis, 2 cm into
   the live former.
   - It takes all of them because a former is several unwelded strips: two flange boxes at ±7 mm and web sheets at
     ±3 mm, bay by bay.
   - An edge counts only if it runs along the axis, so a stringer crossing the former doesn't count.
   - The cut's convex hull is reduced to ≤ 8 corners (least area first). A flanged web's 4 mm recesses go; its depth
     and flange width stay.
   - Medians measured: formers **35 × 16 mm**, stringers **41 × 27 mm**.
3. **Make it a virtual member.**
   - Its two ends are the hulls' centres.
   - Each end is a virtual node riding as the place it sits on. This is skin_break `onNodes`' blend: Σ w·live + q·(x − Σ w·rest), using that place's kept weights.
   - Its beam is `{ a, b, mat: 'aluTube' }`. That gives DEFORM's alloy look as it stands (MAT 2: bare alloy, then the
     grey primer band, `LOOK_TINT`), **so `dmg_members.js` needs no change**.
   - Its slot is `MODE.torn` at tb 0.5, so `pose()` draws it cracked while the two sides are within the rest length,
     and as two stubs, each on its own side, once they part.
4. **No hide is needed.** The covering's tear already took the former's own triangles at the gap. The stubs fill it
   from 2 cm inside each live edge.

| Crash (`_dmg_wall_study` cases) | Broken | Crossings | Slots (of 128) | Cracked / parted | Triangles | Event (whole crash at once) | Virtual nodes per frame |
|---|---|---|---|---|---|---|---|
| 30 m/s trunk, centreline | 56 | 47 (39 formers, 8 stringers) | 39 | 6 / 33 | 16 224 | 81 ms | 78 nodes, 1.2 ms |
| 30 m/s trunk, 2.5 m out | 22 | 21 (formers) | 16 | 4 / 12 | 6 656 | 61 ms | 32 nodes, 0.35 ms |
| 12 m/s nose-over | 1 | 0 | 0 | | 0 | | |

Crossings whose cut finds no outline (fewer than 3 corners: 8 and 5 above) get no slot; their gap stays as today.

`alloy_sec_proto.png`:

- **Top left:** a punched former torn across. Today (the page's per-face normals) against the stubs (carried normals) on the former with its creased normals.
- **Top right:** a stringer, the same.
- **Bottom:** the slot alone. First parted with `pose()`'s own normals (rounded all round), then with the carried normals: unposed, cracked, parted.

The paint is a stand-in colour, chosen so the bands read.

## Smooth normals (the user, 27 Oct: "no flat shading on any deformed or damaged part - it looks bad and looks like a bench")

The ruling: smooth normals on the deformed geometry, per ring and vertex, carried from the part's own smooth normals,
with hard edges only at a real crease or a tear. Three findings and what the prototype does about each:

1. **The formers are flat on the page today, even intact.** The flown snapshot gives the `aluminium` bucket per-face
   normals: on the metal Cessna, all 33,166 coincident pairs of places carry different normals. The generator's quads
   share no vertex.
   - The glazing, by contrast, is smooth: windshield 303 / 303 pairs share their normals.
   - **The part's own smooth normals** are therefore made here the standard way (`creased()`). Places are welded at
     rest. Each corner takes the area-weighted sum of the welded faces within 60° of its own face. A box's 90° corner
     stays a real crease; everything else is smoothed.
   - **Proposed for whoever owns the join's snapshot (A0):** bake the same creased normals into the `aluminium` bucket
     once, at the snapshot. The picture's top-right panels draw the former that way.
2. **DEFORM's pool derives a vertex's normal from its corner's direction** (`pose()`: normalize(N cn + B cs)). That is
   smooth all round and carries nothing of the part, so a box section shades as a rounded bar (picture, bottom left).
   - **What the prototype carries instead:** each ring entry's normal from the part's creased normals at the cut.
   - A hull corner whose cut normals fall in two families 60° apart (a real crease) is entered twice, at one place, once
     per face. The stub keeps that edge hard along its length; everything else is shared and smooth.
   - Metal Cessna, centreline crash: 110 crease corners over 39 sections; no corner without a carried normal.
   - Ring to ring, 3 cm or more off the torn lip, the largest turn of a vertex normal is 0.0°: the stubs are straight
     legs.
   - `poseN()` mirrors this without editing `dmg_members.js`. It recovers `pose()`'s ring frame (N, B) from two corners'
     normals, which are exactly N cn + B cs, and puts the carried normal through it. The place is `pose()`'s.
   - **Proposed `dmg_members.js` change, for DEFORM's review:** per-corner normals in the slot, texels 12-15 holding
     8 × (nx, ny), so `TX` goes 12 → 16. `pose()` and `LOOK_GLSL` would use them when present, and the corner direction
     otherwise. Creased entries are doubled, so a box takes 8 entries, which fits `AROUND` 8.
3. **The node pictures were flat because the raster shaded per face.** `../raster3d.js` now interpolates vertex
   normals per pixel when a triangle carries them (`t.n`).

## Hooks for the branch off DEFORM's commit (any `dmg_members.js` change goes through DEFORM's review)

- **`dmg_members.js`:** none needed for the slots themselves (virtual beams carry `mat: 'aluTube'`). The ruling of 27 Oct
  needs the carried normals above, texels 12-15 (DEFORM's review).
  - Two things DEFORM may prefer instead:
    - `MAT.alloySec`, with its own band widths. Today the bands are DEFORM's: `RIM` 0.3·r, so bare ≈ 5 mm and primer to ≈ 16 mm for these sections, close to the stretch's 0-3 / 3-12 mm.
    - A 12-corner `AROUND` for the I-webs.
  - `plan()` is not used. The slots are made by the new module and handed to `assign()` with the extended topology.
- **A new pure module, `src/viewer/dmg_alloy_sec.js`:** `crossings(rec, ...)` at an event, `virtualise()` into an extended `T` / `rest` / `M` / slots, and `liveOf()` each posed frame.
- **`app.js`:**
  - an `aluminium` pool from `DMG_MEMBERS.make(THREE, <the bucket's material>)`, parked with the others;
  - at an event, `assign(pools, {slots}, M', T', rest')`;
  - each posed frame, `frame(pools, live', Q', O)` with the virtual nodes appended.
- **`skin_break.js`:** none.

## Limits, said plainly

- **Event cost.** 60-81 ms, measured for the whole crash at once with string-keyed grids on a loaded machine. The page
  would run it per event over the new dead triangles only. That is **not measured**.
- **Cracked versus parted.** Read at the end of the run, not frame by frame.
- **Ride.** A stub rides one place's weights: its side's riding, not the former's own bending between the edge and
  the tear.
- **Picture.** It is node rasterised, not the page. There are no in-game stills of this.
