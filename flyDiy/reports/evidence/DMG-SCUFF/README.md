# DMG-SCUFF (G2000-G2009) — the damage drawn where the physics put it

What is here, and how to read it. Three sources, in the order of how much they prove:

1. **GATE DMGSCUFF** (`gate_dmgscuff.txt`, node): the records the game draws, made from real crashes of the
   validated builds through skin_break's own binding. This is where "the physics put it there" is held as a number.
2. **The bench** (`scuffbench/`, headless SwiftShader): the shader block on the whole aeroplane (the editor's chain,
   the user's Cub and the metal Cessna). Its patterns are TEST PATTERNS, labelled as such. The editor's meshes carry no
   solver binding, so the bench paints each layer where a crash would put it, to judge the LOOK, MEASURE each layer
   (pixels changed) and estimate the COST. A picture, never a frame time.
3. **The box** (`box/`, the coordinator runs `tools/dmg_scuff_evidence.js`): the real page, the user's Cub crashed
   (a 30 m/s trunk on the centreline, a 3 m/s taxi into a trunk, a nose-over), before / after at fixed cameras, the
   close-ups (a scrape, a crease, a torn edge, a cracked windscreen), the program links in the crash window and the
   block's GPU time. NOT TAKEN HERE (a cloud session has no GPU); the command is in the script's header.

## The bench stills (`scuffbench/`)

Each view twice: `*_before.jpg` (the build as the editor draws it, no wrapper) and `*_after.jpg` (every AEROSKIN and
glass material on its wrapped copy, the test patterns written into the record attributes, the branch open).

| file | what to look at |
|---|---|
| `cub_overview_*` | the whole Cub from ahead and above: the crushed left cowl cheek, the cracked windscreen, the torn band across the left wing |
| `cub_nose_*` | the CRUSH on metal (the cowl): the paint crazed into a network, whole cells flaked off along it - zinc-chromate primer at a flake's edge, bare alloy in it - the sheet dented (the relief). The prop (wood) takes a few splinters |
| `cub_belly_*`, `cub_under_*` | the SCRAPE on the fuselage's fabric belly, along the aeroplane: its left half on grass (the soil and the grass stain in the streaks), its right half on hard ground (the dope ground through to its silver coat, the raw weave in a streak's core) |
| `cub_wing_*` | the TORN band on fabric: the dope's crack network back from the edge, the pale raw weave in threads at it. (The bench has no hole there - in the game the band starts at the tear's own edge.) |
| `cub_pane_*` | the windscreen CRACKED: an acrylic crack - long radial cracks from the impact point, forking past mid-run, crazing round the point, the lines stress-whitened. Not tempered glass's cubes |
| `metal_*` | the same on the metal Cessna (alclad: the scrape grinds to bare alloy - metallic, brighter than the paint round it) |

`bench.json`: per build, the shader-source census with and without the module, the links at arming and in the
crash window, the layers measured, the cost.

## What the numbers say

(filled from `bench.json` and `gate_dmgscuff.txt`; see the HANDOVER entry G2000-G2009)
