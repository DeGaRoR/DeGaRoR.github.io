# CITY PACK FORMAT: CITY-B's copy (the runtime's reading of v1, 20 Oct 2026)

CITY-A owns the format: `futureDesigns/CITY-PACK-FORMAT.md` (v1) on `claude/city-a` (5eaf83ad, 15a8332f). This file is
CITY-B's copy. It records:
- what the runtime host reads from v1 (`src/viewer/townkit.js` `TOWNKIT.decodeCityCell` / `cityOf` / `town`, and
  `src/viewer/render_premises.js` `CITY`);
- where the host departs from the letter of the spec, and why;
- section 3: the proposals for CITY-A's section 13.

A0 merges section 3 into CITY-A's file. CITY-B never edits CITY-A's files.

GATE CITYHOST runs the host:
- on `tools/_cityhost_fixture.js` always. That is a small v1 pack, the same layout, cooked from the committed town kit;
- on the real pack whenever `src/core/city_packs.json` is in the tree (it is, once A0 lands CITY-A).

Against CITY-A's pack (13 cells, 435 kit rows, 3 695 props) the host is green on every check (census, visits, allocation,
switch).

## 1. What the host reads (v1, as written)

| item | what the host does |
| --- | --- |
| the manifest `src/core/city_packs.json` | The entry `towns[]` with `island` = `ISLAND_BOOT.id` and `variant` = `'town'`. **Refused** unless `v === 1`, `frame === 'world'` and `inputs.kitPack` = `townkit_pack.json`'s `pack.sha256` (spec §10). A refused or missing pack leaves the town on the kit, as before. |
| the cells | All of them are fetched at load (13 files, 473 KB gz), gunzipped, decoded once (`decodeCityCell`) and joined (`cityOf`): the kit rows and the props are concatenated in manifest cell order, and each cell holds a range of each. |
| the far mesh (§5) | Positions to f32 in the cell's frame (from `box`'s low corner; the mesh stands at the corner), the octahedral normals to i8 x 4, the sRGB colours to linear f32 (a LUT). |
| the kit (§7) | The `kit` section through `TOWNKIT.decodeInstances`, unchanged (world frame, the host adds nothing). Flag 8 is honoured: a row without it casts no shadow (its kit data's 4th float = 0.25; the depth pass drops it). |
| the props (§8) | 20 B rows. The u16 key indexes `propKeys`; flag 2 casts. |
| `plots` | `[id, seed, house row, out row, flags]`. A plot is drawn by the pack when flag 1 is set **and** the composition sows it with that seed. |
| `uniques`, `objects` | Read as below. |

## 2. What the host does with it

- **The cell switch (§6):**
  - NEAR when the eye's horizontal distance to the cell's box rectangle is below `lod.nearIn`, FAR above `lod.nearOut`;
  - the props: a second switch per cell, in at `lod.propFar`, out at x 1.1;
  - the test runs over the cell ring only (`src/viewer/town_ring.js`). From 4 km and more it visits no cell.
- **A far cell:**
  - draws its mesh's `shell` (walls and roofs) and its `lots` bucket: 2 draws, no shadow;
  - the shell uses the far town's own plain vertex-colour material (`lodMat('hard')`, G559) at `lod.farGain`; the ground uses
    the same material with a polygon offset (-1, -1);
  - its kit rows are on no rung, its props absent.
- **A near cell:**
  - keeps the `lots` bucket alone, as the flat stand-in under the lots (spec §5: "the host may also draw this bucket near"),
    because a kit plot builds nothing;
  - its kit rows go on the kit host's rungs (`kitE0` / `kitE1`, the dithered band);
  - its rows' obstacles are rasterised at 1.5 ms per frame (`hitMesh(h, 1)`) and dropped when the cell goes far.
  - The switch is a swap of the cell geometry's group list, so a cell stays ONE Object3D.
- **The props** of the props-near cells go into one InstancedMesh per key part, with cast and flat meshes apart. They are
  written when that set changes, never per frame. A key whose asset has not landed is drawn when it lands (`propsAgain`).
- **The landmarks (`uniques`), a unique plot (flag 2), and a plot whose seed is not the pack's (an edit)** keep the unique
  path, the procedural one.
  - The stream builds them from 400 m before their cell comes near, and they draw only while it is near; the far cell's
    shell holds their box.
  - They are never baked into the far town (`hlodScan`).
  - An edited plot's kit rows are hidden near.
- **The record's objects (`objects`)** are the pack's props, so their own build is skipped.
- **Per frame:**
  - an idle far town is a subtraction and two comparisons: 0 cells, 0 rows and 0 props visited, 0 bytes allocated;
  - an idle near town allocates 0 bytes per tick too (GATE CITYHOST E, on both packs).
- **The census on CITY-A's pack:** 116 Object3Ds for the whole town. That is 13 cells + the kit's 3 batches + the town and
  kit groups + about 98 prop meshes, none of them visible far. Nothing per plot.

## 3. CITY-B's proposals for CITY-A's section 13

1. **The roads bucket: drop it from the far mesh, or let the host hide the town's own roads far.** The town's roads already
   draw at every distance through render_premises' road batches and the pavement. A far ribbon on top would draw them twice
   (the far draw shell + ground spans roads + lots). The host therefore draws `shell` + the `lots` bucket only, as 2 groups,
   and leaves the roads bucket in the file unused.
   - If the user wants the coarse far roads (G3214's ribbon look, OK'd but no measured gain), the host needs the town's own
     road batches in buckets of their own (G3214's `mergePavSteps` rule) so it can hide them past `nearOut`. That is a later
     step.
2. **A near lots section: the cooked lot dressing per cell.** In city mode a kit plot builds nothing, so near it lacks what
   KIT_LOT built today: the fence, the lot patch, the pier's piles and the jetty. The props table brings the cars, boats,
   people, lamps and pier modules. Proposal: a `near` section per cell, with merged meshes per lot material (the fence finish,
   the patch), in the cell's frame, with the channels `pos`, `nrm`, `uv` and a material name (`lotMat(name)` on the host).
   Until then the `lots` bucket's flat ground stands in, and the fences are missing near (a look for the user).
3. **Per-plot index ranges in the far mesh** (`far.plots: [[plot index, first, count], ...]` per bucket, in the bucket order
   §5 already fixes). With them the host can leave an edited plot out of its far cell's draw (WYSIWYG between an edit and the
   re-cook). Today an edited plot builds unique near (its kit row hidden), and far its old shell box shows until the re-cook.
4. **One bundle per town** (optional): the 13 cell files are 13 fetches at load. A `town.bin` holding every cell's raw bytes
   would be one, and the per-cell files can stay for a lazy far-cell fetch later. Not needed for the first landing.
5. **`lod.nearIn` (950) below `kitE1` (1 200) is fine.** A near cell's farther rows take the box rung of the kit until the
   cell goes far.
6. **The shadow flag and the props' cast flag are honoured as written.** No change asked.
7. **Keep `v` strict.** The host refuses any `v` but 1, any frame but `'world'` and any other kit pack. Bump `v` on any layout
   change.
