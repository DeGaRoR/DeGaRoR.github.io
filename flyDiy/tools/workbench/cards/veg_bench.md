# veg_bench.js - the vegetation of an island area, in node

**Job**: see where the game plants trees on a piece of the island, which rule refuses them where it doesn't, and what a
rule change would plant, without a browser or a GPU. Pictures of the summits, before/after of a biome edit, counts for a
cost estimate. (MOUNTAIN-VEG, 15 Nov 2026; A0's yes for the row the same day.)

```
node flyDiy/tools/veg_bench.js --out <dir> [--areas skyline,ardent,cabin,north] [--w 760] [--eyes 2] [--subalpine 0]
```

- ~35 s for the four areas (the world composes in ~3 s, a 6 km window walks in ~6 s).
- Reads the SHIPPED island (`island_node.js`), the premises fixture, `src/core/trees_pack.json` biomes and `28c_biomes.js`.
- Walks the tree fill's own lattice (render_world.js `walkRows`: 6.4 m, the same hashes, jitter and order of tests) and
  names the refusing rule per point: strip clearance, water, bare class, editor exclude, no mix, clump gap, canopy map,
  thinned.
- Writes per area `<area>_map.png` (relief | terrain code | trees/ha | refusing rule | ground cover), `<area>_eye<k>.png`
  (relief | code | the planted trees), `<area>.json` (by 50 m band: trees/ha, on ridges, codes, reasons) and `index.html`.
- `--subalpine 0` plants the game without 19 SUBALPINE (the before; files get `_off`). The rule itself is the game's
  (`BIOMES.subCode` / `subKeep`, the baked `subalpine` mix); the two hooks are copied from render_world.js.

## Traps
- It copies the fill's rule by hand. If `walkRows`, `forestHere`, `openHere`, `codeAt` or `FILL` change, change
  `plantAt` in the bench too, and prove it again against the game (page_rig + `TREE_FILL` probe in a GPU slot).
- Not modelled: the puddle skip, the town's own trees, the species' per-subject patches, the far stand cards, the grass
  field's tuft shapes (it shows the mix's tuft density).
- The eyes are a z-buffered heightfield at 12 m; trees are strokes sized by the fill's size rule. Judge placement and
  density with it, never the look.
