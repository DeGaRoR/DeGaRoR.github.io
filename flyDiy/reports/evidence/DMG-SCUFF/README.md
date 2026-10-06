# DMG-SCUFF (G2000-G2009) — the damage drawn where the physics put it

What is here, and how to read it. Four sources, in the order of how much they prove:

1. **GATE DMGSCUFF** (`gate_dmgscuff.txt`, node, 96/96): the records the game draws, made from real crashes of the
   validated builds (the user's Cub, the Jodel, the metal Cessna) through skin_break's own binding. This is where
   "the physics put it there" is held as numbers: zero intact and after a reset, the slide on its sliding side only,
   the crush on the yielded members, the panes cracked only where their nodes / frame took a hit, deterministic, the
   block asleep until the first damage, the pass the same bytes however the frame's time cuts it.
2. **The real page on SwiftShader** (`soft/`, `tools/dmg_scuff_evidence.js --soft`): dev.html, the user's Cub, damage
   on, the wind off, DMG-WALL's staging. The game's own drawing chain (ATMO, the hybrid bake, skin_break), crashed:
   **the program links in the crash window, the programs failed, the scuff's own costs**. SwiftShader is the CPU: its
   frame and GPU times are a ratio at best, never a frame time.
3. **The bench** (`scuffbench/`, headless SwiftShader): the shader block on the editor's whole aeroplane, the TEST
   PATTERNS written where a crash would put each layer, to judge the LOOK, MEASURE each layer (pixels changed) and
   compare the COST (plain / asleep / awake intact / awake full).
4. **The box** (`box/`, NOT TAKEN HERE - a cloud session has no GPU): the coordinator runs
   `tools/dmg_scuff_evidence.js` against tools/live_driver.js; the commands are in the script's header and the
   HANDOVER entry. Same stills, real GPU time, real frame times.

## The rules, and the numbers that hold them

| rule | where | result |
|---|---|---|
| Damage OFF = not one bit, shaders included | bench `sameAsNoscuff` (every shader source hashed with skin_scuff.js present / removed); GATE 9 (static) | same hash, both builds; no wrapper, attribute or solver array with damage off |
| No program link at the crash | `soft/run.log` `links` / `programsAdded` in each crash window; bench `crashLinks` | **0 / 0** in the taxi, the nose-over and the 30 m/s trunk; bench 0 |
| Intact, damage ON: one uniform branch at most | bench v4 `armedAsleep` vs `plain` | the block SLEEPS until the first damage (the plain programs): Cub +0.2 %, metal Cessna +1.4 % (SwiftShader noise). Awake and intact it would cost +8 % / +11 % - why it sleeps |
| Event cost budgeted, no frame over budget | GATE cost line; `soft/run.log` scuff `tickMs` / `frameMs` | node: ~0.2 us a place, a 2000-place tick <= 1.9 ms, the torn band <= 1.1 ms. The real page on SwiftShader ran ~1.4 us a place (an 8000-place tick 10.9 ms) - so the pass now also stops at 4 ms a frame (SC.frameMs); `soft/taxi_v2/` is the run after that change |
| Records zero intact / after a reset; scrape on the sliding side; crush on the yielded members; panes only when hit; deterministic | GATE DMGSCUFF | PASS on the Cub, the Jodel, the metal Cessna |

## `soft/` - the real page (the user's Cub)

Per case: `<case>_<cam>_intact.jpg` (staged, before the crash), `_after.jpg` (the wreck, the damage drawn),
`_noscuff.jpg` (the same frame with the branch closed - FLYDIY_SCUFF_SHOW(false), no program change: the A/B);
`<case>_close_<layer>.jpg` the camera 1.3 m off the most damaged vertex of that layer (+ `_noscuff`). `evidence.json`
every number; `run.log` the run.

| case | what happened (solver) | what to look at |
|---|---|---|
| `taxi_*` (3 m/s into a trunk, throttle shut) | 0 broken, 1456 yields, 782 J plastic, 830 J slid; 16.7 k crushed / 11.3 k scraped vertices | the cowl CRUSHED where the engine mount yielded (the whole cowl is bound to those nodes) - `taxi_close_crease`. **In this run the cowl's crack network drew as contour STRIPES** (the warp folded the domain): fixed after it (G2003, the warp's slope under the cells' frequency), reshot in `taxi_v2/` |
| `noseover_*` (12 m/s into a 35 cm stump) | 63 broken, 4986 yields, 5.5 kJ plastic, 22 kJ slid | the TORN edges on the broken skin (`noseover_close_torn`: the dope's crack network and the pale weave at the edges of the skin pieces), the scrape where it slid, the wings intact |
| `trunk-0_*` (30 m/s, the centreline) | 179 broken, the fuselage parted; 7 panes at severity 1 | the aeroplane breaks up (this base's skin break: the pieces scatter) - the close-up aim reads positions that go stale after a break-up, so `trunk-0_close_*` frame the trunk and the scattered pieces rather than the vertex. The box run decides whether the aim needs the drawn position |

`soft/taxi_v2/` - the taxi again, after the crack-network fix and the time-capped pass (see its `run.log`).

## `scuffbench/` - the bench (the editor's chain; TEST PATTERNS)

Each view twice: `*_before.jpg` (the build as the editor draws it, no wrapper) and `*_after.jpg` (every AEROSKIN and
glass material on its wrapped copy, the test patterns in the record attributes, the block awake and the branch open).
The editor's meshes carry no solver binding; the patterns are painted where a crash would put each layer.
**`v4/` is the current one** (the retuned crush, the sleeping block); the top level is v1 (the first look: the crush
there is the old, too-strong craquelure), `v2/` the nose and pane views of the next iteration, `v3/` the metal
Cessna's windscreen found.

| file | what to look at |
|---|---|
| `*_overview_*` | the whole aeroplane from ahead and above: the crushed cowl, the cracked windscreen, the torn band across the left wing |
| `*_nose_*` | the CRUSH on metal (the cowl): the paint crazed into a craquelure (lower contrast, fading where a cell is under ~4 pixels), a few cells flaked off where it is worst - zinc-chromate primer at a flake's edge, bare alloy in it - the sheet dented (the relief). The prop (wood) takes a few splinters |
| `*_belly_*`, `*_under_*` | the SCRAPE along the aeroplane: its left half on grass (the soil and the grass stain in the streaks), its right half on hard ground (doped fabric ground to its silver coat, the raw weave in a streak's core; alclad to bright bare alloy) |
| `*_wing_*` | the TORN band: the dope's crack network back from the edge, the pale raw weave in threads at it (the bench has no hole there - in the game the band starts at the tear's own edge) |
| `*_pane_*` | the windscreen CRACKED: an acrylic crack - long radial cracks from the impact point, forking past mid-run, crazing round the point, the lines stress-whitened. Not tempered glass's cubes |

`bench.json` (per version): per build, the shader-source census with and without the module, the links at arming
(v4: both the asleep and the awake programs, as the game's roll-out) and in the crash window, the layers measured,
the cost: `plain`, `armedAsleep` (the game's intact aeroplane), `armedOff` / `armedIntact` (awake, the branch closed /
open on zero records), `armedFull` (every vertex fully damaged: the fragment-cost estimate, +59 % Cub / +84 % metal on
SwiftShader - the box's GPU timer says what it is on a GPU).

## Other files

- `gate_dmgscuff.txt` - GATE DMGSCUFF's full output (96/96).
- `gates_run1.txt`, `gates_run2.txt`, `gates_run3.txt` - the targeted gate set (UISMOKE, DMGSKIN, DMGSCUFF, BUILD,
  WEATHER, JOIN; DMGINST in run 1). Run 1 had DMGSKIN red on a static check (scuffFrame's call moved out of brkCage's
  opening) and DMGSCUFF's verdict line misread; run 2 after the fixes; run 3 on the sleeping block: all PASS. DMGWRECK
  is not on this base (it rides the unmerged D4b branch).

Everything here is procedural (no texture, no asset): no licence to credit.
