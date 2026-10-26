# DMG-LOOKS stretch: the alloy slot (crimps and the rivet-line tear) and the P2 rim overlay (option B), 26 Oct 2026

For the **Deform Coordinator**, whose session implements (a)-(d) on `claude/dmg-looks` Tuesday night. This is a
cloud session, node only, on `claude/dmg-looks-study`.

**The file boundary.** `claude/dmg-looks` did not exist on the remote when this was written (checked 26 Oct). So
this work touches nothing outside `futureDesigns/dmg-looks/`, apart from an append to HANDOVER:

- no `src/` file, no tool, and not the study doc;
- the only edit to an existing file is `tear_proto.js` (mine): its `main()` is guarded and it exports its functions,
  and its output is unchanged.

Everything below is a prototype plus measured triangle counts. Where it names a `src/` function, that is where
Deform would wire it.

## 1. The alloy slot: crimps, then a kink; the tear through the rivet line

`alloy_proto.js` writes `alloy_slot.png` and `alloy_slot.txt`.

The pool slot for a metal Cessna frame member uses **the cage's own section**: `tools/_cage_gen.js metalAngle` draws
two prisms (a riveted leg against the skin and an outstanding leg, each w wide and T = 5 mm thick), so a slot meets
its joints without a seam. Every vertex pose and every fragment depends only on the vertex's canonical coordinates,
the slot's state and the two live nodes, so the JS is the vertex and fragment shader.

**Crimps** (local buckling, then progressive folding):

- **Fold size.** A thin-walled section crushed end-on folds in lobes, one after another, each about 2H long, with
  H ≈ (b²t)^(1/3). Here b is the leg width and t the *real* sheet thickness. That is the superfolding element's
  half-length (Wierzbicki & Abramowicz, J. Appl. Mech. 50 (1983) 727), but the form is as recalled: its constant ~1
  was **not verified**, so it is a dial, `H_K`.
- **Length a fold eats.** About 0.73 × 2H (the effective crushing distance, also as recalled; dial `EFF`).
- **Numbers.** For w = 30 mm and t = 1.2 mm: **H = 10.3 mm, and a fold eats 15 mm**. The solver's lost chord δ
  chooses the number of folds, `n = ceil(δ / 15 mm)`, at most 3. Past 3 folds (45 mm) the member also kinks at the
  zone, with the steel slot's hinge: two sides that keep their length, the hinge on the open side of the angle.
- **Shape.** The lobes alternate out and in, and each grows to ~H as its fold closes. The flange edges move most (an
  inextensional mode: displacement grows with distance from the heel) and the heel bulges a little.
- **Rings.** H/2 apart in the zone (at least 4 per fold), 3 on each side outside it.

**The tear through the rivet line:**

- **The crack's path.** A riveted flange broken in tension fails through its **net section**, the section through a
  rivet hole. The crack **links up** hole to hole along the row before leaving it, as in the NASA lap-joint tests
  (study §2.1): from the free edge into hole k, along the rivet line to hole k+1 (70 % of slots, seeded), then on to
  the heel. The outstanding leg shears off on a slant (35°, seeded side).
- **Holes and rivets.** Holes on the crack are **elongated ×1.9** (bearing), and those within two pitches ×1.25.
  The rivets stay with the piece still riveted to the skin; the other piece shows empty, ovalised holes.
- **Edges and colours.** Lips curl within 5 mm of the crack. Bare alloy shows at the crack and round the torn holes,
  **grey primer** elsewhere (the user's ruling). The shell's inside seen through the crack is drawn as the fracture
  face.
- **Two passes.** The vertex shader collapses what lies past the crack's coarse bound. The **fragment pass cuts the
  exact zig-zag and the holes**. That is allowed in the pool's own program; the aeroplane's one program may not
  discard (early-z). Rows 4-5 of the sheet show the vertex pass alone (a staircase, no holes) against vertex plus
  fragment.

| Slot state | Triangles (as drawn) |
|---|---|
| crushed 12 mm, 1 fold | 312 |
| crushed 42 mm, 3 folds | 504 |
| crushed 75 mm, 3 folds + a kink | 504 |
| torn, two pieces | 768 |

The study's §10.6 estimate was 414 buckled and 828 torn; these replace it.

**Fragment cost (torn slots only).** The crack `cut(u)` is three branches plus one 3-octave noise. Precomputed per
slot at the event as a 64-sample 1D row, it is one fetch. The hole test covers only holes within 2.2 pitches of the
crack, about 5 tests.

**Per-slot state for the shader** (event-time, CPU):

- the two node indices, L0, w, the section's `up`;
- `kt1` (crimps) or `tb` (tear), and the seed;
- the tear's hole k, the link-up flag, the slant sign, and the parting offset only in the prototype.

That is a few dozen floats a slot, as in §10.3.

## 2. The P2 rim overlay, option B

`rim_overlay_proto.js` writes `rim_overlay.png` and `rim_overlay.txt`; `rim_census.js` writes `rim_census.txt`.

**What it draws.** The skin keeps its program and draws as today, including P1b's torn shape. The overlay is a second
draw over it with three things of its own:

- **its own index**: the rim triangles only, those with a place within 3 cm of the torn edge;
- **its own per-place `aRim`**: P1b's edge distance;
- **a small program made at roll-out** (`ground_scar.js`'s rule).

It draws with polygon offset and alpha, and its fragment shader turns e + noise into the finish's bands:

- 2024 skin: bare alloy 0-3 mm, **grey primer** 3-12 mm, chipped paint to 3 cm;
- fabric: frayed thread and the undoped band;
- composite: pale fibre and a delamination line;
- ply: raw wood.

Where no band applies it writes nothing. An overlay can colour but never remove: the shape stays P1b's.

**On the test panel** (1.2 × 0.8 m, 3.5 cm triangles), rim triangles are 7-11 % of the live skin: 126-209 per metre
of tear, both edges counted.

**On the real thing.** `rim_census.js` builds the flown snapshot headless and rides it with skin_break as GATE DMGWALL
does (`tools/_dmg_wall_study.js` prepare / run, the inherited binding), one build per process. Then it counts the
rim, here 2 rings round every removed or torn triangle.

| Build | Crash | Broken | Rim triangles | Rim places | Snapshot groups with a rim (≈ drawers) | Index | Rim pass (naive, the whole crash at once) |
|---|---|---|---|---|---|---|---|
| Cub | 30 m/s trunk, centreline | 50 | 7 947 | 6 358 | 17 / 41 | 93 kB | 42 ms |
| Cub | trunk, 2.5 m out | 13 | 5 854 | 4 372 | 16 / 41 | 69 kB | 30 ms |
| Cub | 12 m/s nose-over | 7 | 2 075 | 1 579 | 9 / 41 | 24 kB | 19 ms |
| Jodel | trunk, centreline | 55 | 6 703 | 5 101 | 16 / 43 | 79 kB | 44 ms |
| Jodel | trunk, 2.5 m out | 17 | 2 597 | 1 931 | 5 / 43 | 30 kB | 17 ms |
| Jodel | nose-over | 1 | 479 | 338 | 1 / 43 | 6 kB | 7 ms |
| metal Cessna | trunk, centreline | 56 | 7 292 | 6 142 | 23 / 47 | 85 kB | 76 ms |
| metal Cessna | trunk, 2.5 m out | 22 | 8 117 | 6 498 | 21 / 47 | 95 kB | 51 ms |
| metal Cessna | nose-over | 1 | 0 | 0 | 0 / 47 | 0 | 3 ms |

(This rig's crashes are DMGWALL's 5 s cases, so their broken counts differ from the treecrash census in §10.1.)

**What the numbers say:**

- **Size.** At most ~8 k rim triangles and ~6.5 k rim places per crash. The index stays under 100 kB.
- **Where the rim lands.** Much of it is on the frames (`struct`), liners and pads. Restricting the overlay to the
  covering and the sheet would cut it by roughly half. Frames are better served by the member pool's own rim.
- **The rim pass.** Run naively over the whole crash at once it takes 7-76 ms. Done incrementally at each event (only
  the new dead triangles' neighbourhood, adjacency built at binding) it fits the 8 ms event budget.
- **The draw count is the catch.** The rim falls in up to **23 snapshot groups**, roughly the page's drawers (39 on
  the Cub, G3022). So **an overlay per drawer would cost up to ~23 draws.**

**How to keep it at one draw** (recommended: **B3**):

| Variant | Draws | Per frame | At the event | Note |
|---|---|---|---|---|
| B1: a parked overlay mesh per drawer, each on its drawer's ridden buffer (`GLBufferAttribute`) | 1-23 | 0 CPU | an index upload per drawer touched | the simplest; misses the target in a big crash |
| B2: `RIDE_VS` writes each ridden position twice, into its drawer's buffer and into one shared overlay buffer | 1 | 0 CPU; double transform-feedback writes on every riding vertex | index remapped into the shared buffer | `aRim` would need a buffer the length of the whole riding range (~2 MB on the Cub), made at the first break: **a new GL object in the crash** |
| **B3: the overlay rides itself.** Its own small vertex list (a copy of each rim place: `aPl`, `aN0`, `aRim`) goes through the **same `RIDE_VS` program** in one extra transform-feedback draw, which writes the overlay's own position and normal buffers. Then one overlay draw. | **1** | 0 CPU; one transform-feedback draw over ~6.5 k vertices | `bufferSubData` of the new rim places and the index into **buffers sized at roll-out** (16 k vertices / 16 k triangles: ~0.5 MB, parked) | no change to `RIDE_VS`'s source; no GL object at the crash; past the cap, the oldest rim goes first |

**The overlay's cost, B3:**

| Item | At rest | At a crash |
|---|---|---|
| draws | 0 (hidden) | +1, plus 1 transform-feedback draw |
| program links | 0 (linked at roll-out) | 0 |
| triangles | 0 | ≤ 8 k (≤ 16 k cap) |
| CPU per frame | 0 | 0 |
| event CPU | — | the incremental rim pass, plus two `bufferSubData` calls |

## 3. Files (all new unless marked; all node only)

| File | What it does | Output |
|---|---|---|
| `alloy_proto.js` | the alloy slot: crimps sized from H, a kink past 3 folds; the rivet-line tear with the vertex and fragment passes | `alloy_slot.png`, `alloy_slot.txt` |
| `rim_overlay_proto.js` | option B's look: base / overlay alone / both, for four finishes | `rim_overlay.png`, `rim_overlay.txt` |
| `rim_census.js` | the overlay's real size: rim triangles, places and groups, on the headless snapshot ridden by skin_break (one build per process) | `rim_census.txt` |
| `raster3d.js` (changed) | now takes a per-fragment pass (interpolated attributes, discard) | — |
| `tear_proto.js` (changed) | `main()` guarded; exports `grid`, `event`, `PROFILES` | output unchanged |

**For Deform's wiring** (not done here): the alloy slot lives in the pool (`dmg_members.js`, study §10.7). The rim
overlay (B3) touches `skin_gpu.js` (one more transform-feedback draw through `RIDE_VS`, with its own input), the rim
pass in `skin_break.js event()`, and a parked overlay mesh plus material (a new file beside `ground_scar.js`).
