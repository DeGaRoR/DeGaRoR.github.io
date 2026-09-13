# THE VILLAGE, THE MINE, THE TRAM AND THE PARK — PROCEDURES FOR THE NEXT SESSION (2026-09-14)

The user, closing the village-tram chantier: "Are you sure all procedures are clear and can be
picked up with rigor by other sessions?" This document is the answer: one page per procedure,
each with the files, the contract, the gate that holds it, the bench that shows it, and the
traps met on the way. It is written for a session that has never seen this code. Where a
statement is a judgement rather than a fact it says so.

The work lives on branch `village-tram` (worktree `D:/Dev/wt-village`, rebased on master
3403a2f8 = G359). Its HANDOVER entries: G348, G350, G351, G352 (provisional numbers, all
"(village-tram branch)"). Nothing of it is on master until the landing below is done.

---------------------------------------------------------------------------------------------

## 1. THE MAP OF THE CODE

| file | owns | gate |
| --- | --- | --- |
| `tools/_house_gen.js` | every wooden building: `build(P, lod, F)`, the presets, `buildComposite` (many houses as one), `buildMill`, `millPlan`, `lampAt`, the finishes; `HOUSE_GEN.CATALOGUE` | HOUSE |
| `tools/_tram_gen.js` | the two tram stations as house composites: `buildStation` (top, `P.station === 1`) and `buildBase` (base, `2`), reached through `HOUSE_GEN.build` when `P.station` is set | HOUSE 38, 39 |
| `src/viewer/cabin.js` | the cabin prop dressed: `plan` (pure), `build(THREE, opts)`, the carriage split, the bevel, `HANG / PIVOT / ROPE_UP` | CABIN |
| `src/viewer/tram_run.js` | the motion: `ropeCurve`, `pose`, `dockT`, `make` (the jig-back clock) — pure math + `apply` | VILLAGE 18 |
| `tools/_village_gen.js` | the terrain (`makeTerrain`, `withHill`, `withShelf`), the road and the spur, the plots, the site (`THEMES`, `placeSite`), the line (`tramLine`), the park (`placePark`), the trees, the yard | VILLAGE |
| `tools/_totem_gen.js` | the totem park plan (`totemPlan`, `totemPlot`, `totemBuild`); the totem session's, with a CATALOGUE block appended | TOTEM |
| `tools/_village.html`, `tools/_house.html` | the benches; `window.benchView`, `window.tramAt`, `window.lastVil` are the screenshot rig's handles | — |
| `tools/_village_check.js`, `_house_check.js`, `_cabin_check.js` | the gates, run by `node tools/run_gates.js --only=HOUSE,VILLAGE,CABIN` | — |

The rule that runs through all of it: a generator PUBLISHES numbers in `stats` (hooks, slots,
levels, footprints) and a consumer reads them; nothing is guessed twice. When two pieces must
agree (the rope over a dock, the pad under the mill, the lawn under the park) ONE function
gives both their numbers (`millPlan`, `totemPlot`, the station's `hangH + ropeUp / cos L`).

---------------------------------------------------------------------------------------------

## 2. THE FRAMES (get these wrong and everything is a metre off)

- **A house** (and every composite built from houses): the datum at the origin on its floor, +z the
  FRONT (the road side), x along its length L, y up. `P.ground(lx, lz)` is the terrain in this frame
  relative to the datum; `P.floorY` the floor over the datum.
- **The shed roof family** (`roofFam 1`) is HIGH AT THE FRONT (+z). A shed that must be high at its
  back is a house turned by `yaw: Math.PI` — the mill's main block and lean do this, so their
  "front" (door, `nFront`) faces the back. Read the mill's part list with that in mind.
- **The mill** (`buildMill`): +z DOWN the hill toward the road; the receiving house at `z = recvZ`
  (the road), the top house `topDist` above it (negative z). `millPlan(P)` is the whole plan as
  numbers.
- **A station**: the top station's +z is the VALLEY (the ropes leave forward and down); the base
  station's +z is the MOUNTAIN (its open end; the ropes leave forward and up). In the village
  the base stands with `yaw = pi` in the shore road's frame and the top with `yaw = 0`, so the
  two face opposite ways — which is why the line is paired by SIDE (section 5).
- **The cabin** (`cabin.js`): the floor origin at (0, 0, 0), length along z, the carriage's PIVOT at
  `[0, 7.05, 0.07]` (the pin through the hanger's head), the rope's contact line `ROPE_UP = 0.365`
  OVER the pivot square to the rail. The cabin hangs plumb; only the `carriage` Group pitches.
- **The park** (`totemPlot`): the lawn's centre is the origin, +z toward the road (the open front
  of the half circle), the clan-house slot behind the apex; a plot hands it its frame.
- **A village record** (`makeVillage`): world metres, y up, `T.h(x, z)` the terrain; the road's
  frame `road.at(t)` gives `{ p, tg, n }` with `n` the WATER-side normal, so "inland" is `-n`. A site
  house record: `{ P, x, z, y, yaw, toWorld(lx, lz), ground(lx, lz), built }`; the world of a
  house-frame point p is `[toWorld(p.x, p.z)[0], p.y + h.y, toWorld(p.x, p.z)[1]]` (tramLine's `toW`).

---------------------------------------------------------------------------------------------

## 3. THE MILL (G350)

**Contract.** `millPlan(P)` returns the plan: `R` (the road), `zTF` (the lean's front),
`mainZF/mainZB`, `crZF/crZB` (the crusher floor), the pad `zPB..zPF` and its `zLevel` (15 % in
from the front), `x0/x1`, `termZ` (the ore tramway's terminal), `footZ`, `marginF/marginB`. The
mill flattens NOTHING itself in the village: `makeVillage` cuts the SHOULDER into the terrain with
`withShelf(T, c, yaw, rect, level, marginF, marginB)` from the same plan BEFORE `placeSite`, and
the mill's `g` sees a flat pad. On the house bench (no terrain) the mill blends its own slope the
same way.

**Structure** (all in `buildMill`, each a house part with `winKeep`): main (3 storeys, shed high at
the back), upper (gable across, on the main's back, floor a hand under the main's roof), lean (shed
across the front), wing (gable end into the main's side), annex (shed, far side), stair tower,
crusher (bare frame behind), bay boxes and chute heads on brackets (`hang`), portals astride the
stations' ridges, two stations (`A` transfer, `B` sorting) on the slope, the receiving house at the
road, the power house and stacks. The conveyors go head -> portal; `storeyFor` picks each head's
storey and the stations slide (`settle`) until every run falls between 2 and `maxDeg` degrees.
The ore tramway is a ropeway (`rope: 1` in `stats.mill.conveyors`).

**Published**: `stats.mill = { level, plateau, top {main, upper, lean, wing, annex, stair,
crusher}, stations, vols (each with yTop(x, z) and a roof kind), hung, portals, conveyors,
bottom, power, terminal, lamps, maxDeg }`.

**Gate**: HOUSE 37 (the fusion, the flat pad, no roof draining into a wall, no pane into a volume,
no two houses of one plan, the conveyors' bands, the reach); VILLAGE 15 (on the real hill: the pad
flat under the main's corners, the stations above their ground, the mill climbs 20 m+, the pad is
a cut, the conveyors in band).

**To change the mill**: change `millPlan` first; everything reads it. A new volume is a `vol(...)`
with an honest `yTop` and a roof kind, a `house(...)` part with `keepFor`, and a line in the gate's
fusion checks.

**Traps**: the mountain ramp is a smoothstep — gentle at the foot, ~30 degrees mid-slope; a level
chosen deep into the pad makes a 16 m fill bank and a 34-degree first run (that is why `zLevel` is
15 % in). `rise` is a name the base station already uses (`riser` in the dock). The house bench's
ground is flat beyond its patch, so the stations look afloat there; the village is the truth.

---------------------------------------------------------------------------------------------

## 4. THE STATIONS AND THE CABIN (G342-G347, G351)

**The rope over a dock** is the one number both sides must agree on. A station computes it as
`yD = floorY(+dockH at the base) - 0.2 + hangH + ropeUp / cos(lineDeg)` and publishes
`stats.station.ropeAtDock`; `hooks.dock.p` is the cabin's floor origin in the dock and `hooks.dock.dx`
the two lines' offset. The dock's CENTRE is where a cabin's PIVOT stands, whichever way the cabin
faces (its origin is then a hand along the slot). `hangH` (7.05) and `ropeUp` (0.365) are dials
that must equal `CABIN.PIVOT[1]` and `CABIN.ROPE_UP`; GATE CABIN holds `HANG = PIVOT.y + ROPE_UP`
and HOUSE 38/39 hold the station formula. Change the cabin's bake and you change three numbers
in two files; the gates will tell you which you forgot.

**The line's angle** `lineDeg` is not a station's to choose: `VILLAGE_GEN.tramLine(vil, buildFn)`
builds both stations, reads their track hooks in the world, sets `lineDeg` on both and builds
again (three passes). Each station solves its own geometry from `lineDeg` (the top's arch centre
and foot, the base's barn eave and tower).

**Hooks** (`stats.station.hooks`): `track[i] {p, dir}` (i = 0 the sx -1 side, 1 the +1 side),
`haul[2i], haul[2i+1]` (that line's top and bottom strands), `anchor[i]`, `dock`. `wheels[i]`
`{c, r, axis}`. On HOUSE_GEN.CATALOGUE the same appear as `hooksOf(built)` named
`track0.. haul0.. anchor0.. dock`.

**The cabin** (`cabin.js`): `prepare(parts)` (cached per bake) splits the carriage from the hanger
by reading every welded component against the author's 19.85-degree rail line
(`splitCarriage`), lays the carriage level about the pivot (`levelCarriage`), turns every
component right side out and chamfers it (`bevelSmooth`: closed components by signed volume,
open ones by a centroid vote, plates by the author's normals; 2 cm two-segment strips on convex
edges over 40 degrees, none under 5 mm). `build` returns a Group with `userData.carriage` (a
Group at the pivot; set `rotation.x`), `userData.pivot`, `userData.ropeUp`, `userData.hang`.

**Gate**: CABIN (the split, the level carriage, the hanger below the pivot, the strips, the
normals, the liveries), HOUSE 38 (top) and 39 (base: the barn, the ropes clear of roof and lintel,
the tower and guides outside the cabins' path, the concrete dock's slots a hand clear and tight,
three flights, rails).

**Traps**: the pivot is UNDER the rope (the wheels ride on top of it) — a sign slip there is a
0.8 m error at every dock. A cabin facing down the line reads the tangent backwards (pitch
modulo pi). The carriage was baked 20 degrees off with its normals flipped WITH its winding, so
the author's normals cannot orient it — the volume can. The base's tension sheaves are 1.2 m
(`wheelR` in its preset) because 1.8 m ones hit the floor once the rope came down to the cabin's
real hang.

---------------------------------------------------------------------------------------------

## 5. THE LINE IN THE VILLAGE AND THE MOTION (G348, G351)

**`vil.tram`** = `{ angle, ropes[6], docks[2], slots, base, top, pair }`. Ropes are tagged
`{ kind: 'track'|'haul', line: 0|1, a, b }` (a at the base, b at the top). The lines are PAIRED
BY SIDE: a base hook's mate is the top hook on the same side of the base-to-top axis (`pair[i]`);
paired by index the two track ropes crossed mid-span (G348's bug, found by the motion gate).
`slots.base[i]` / `slots.top[i]` are where a cabin's floor origin stands docked on line i, at
either station. `docks[0]` is the base's on line 0, `docks[1]` the top's on line 1 — the pair at
rest.

**`TRAM_RUN`** (`src/viewer/tram_run.js`): `ropeCurve(a, b, k, t0, t1)` — the chord with a
parabolic sag of `k` times the span hung between the docks only (the saddle-to-dock metres stay
on the chord: a cabin sits where the station built its dock); `pose(rope, t, yaw, cab)` — contact
on the rope, pivot `ropeUp` under it along the rope's normal, the cabin plumb with a fixed yaw,
the carriage pitched to the tangent; `dockT` — the parameter where the pivot is over a dock's
centre; `make(tram, cabs, {v, accel, dwell, sag})` — the jig-back: `setS(s)`, `tick(dt)`,
`poses()`, `attach(objs)`, `apply()`. To move the tram anywhere: draw `ropes` through
`ropeCurve` with the line's `t0/t1` (from `run.lines[i].rope`), stand two `CABIN.build` groups,
`run.attach(objs)`, tick from your clock. The game owes exactly that, driven by the world clock.

**Gate**: VILLAGE 17 (the line: angles, six tagged ropes, no rope crosses the axis, the two lines a
cabin apart, terrain clearance — 6 m for track, 3 m for haul), VILLAGE 18 (the motion at five s:
contact on the rope, plumb, at the slope, apart, opposite senses, clear of the mountain mid-run,
pivots on the dock centres within 2 cm at both ends, the clock makes the run and turns round).

**The bench** (`_village.html`): "tram runs" ticks from `requestAnimationFrame`; `window.tramAt(s)`
sets the pair and draws (uncheck the box first for a still). NOTE: rAF DOES run in the Browser
pane here (older notes say it is dead there — that was a different page).

---------------------------------------------------------------------------------------------

## 6. THE TOTEM PARK (G352)

**Contract**: `placePark(T, V, road, rnd, site)` in `_village_gen.js` picks a spot off the shore
road (`parkT` of its length, or the first of a few candidates clear of the mine's strip, the tram's
corridor and the spur's junction; the one climbing `parkRise` if the tile allows, else the one
climbing most), walks inland until the hill is `parkRise` over the road, writes a PLOT of the
sower's shape (`{ id, side, s0, s1, poly, depth, n, front, tg, w }`) facing the road, calls the totem
session's `TOTEM_GEN.totemPlot(plot, T, { seed, house: true })`, flattens the terrain to the lawn's
level over the patch (`withShelf`, margins 7 front and sides, 9 behind), calls `totemPlot` again on
the flat terrain, lays a footpath from the road's verge to the frontage's middle, a rail fence on
the four edges with a gate where the path comes in, and stands a `log cabin` (house generator) in
the plan's clan-house slot. Returns `{ T (flattened), park }`; `makeVillage` uses the flattened T
for everything after, and `vil.park = park`. The plots keep off the path's strip (`makePlots`), the
trees keep off the lawn and the path (`planTrees`).

**`vil.park`** = `{ t, d, rise, plot, poly, level, plan (totemPlot's world plan), path {pts, width},
fences[4], house (a site-house record, gen 'house'), centre, yaw }`.

**The bench**: `TOTEM_GEN.totemBuild(THREE, vil.park.plan, { ghost: false })` for poles and
boulders (the lawn is the terrain), the cabin through `placeBuilt` like a site house, the fence
through `VG.buildFence` in `placeFences`, the path painted in the wear canvas. The bench loads
`src/totems/totems_poles.js` after `props.js` and `tools/_totem_gen.js` after `_tram_gen.js`.

**Gate**: VILLAGE 19 (six poles at the level, the lawn flat over the footprint, 4 m+ up and 40 m+
in, on the tile, no plot overlap, the path from the verge to the frontage over dry ground, four
fence runs and one gate where the path arrives, no tree on the lawn or the path, the cabin built
and in its slot, clear of the mine and the tram).

---------------------------------------------------------------------------------------------

## 7. THE PREMISES CATALOGUE (G352, for the world editor session)

Per PREMISES-CONTRACT-2026-09-13 section 2, `HOUSE_GEN.CATALOGUE` now carries one entry per
preset (`house/<preset>`): the plain houses from their own L x w; `house/kennecott mill` (kind
`complex`, `ground.need 'flatten'` with `ground.shelf(P)` giving the pad rect, `zLevel` and the two
margins from `millPlan` — the world cuts it with `VILLAGE_GEN.withShelf`; `hooks` a `roadThrough`
at `z = recvZ`; `hooksOf` the conveyors); `house/tram top station` and `house/tram base station`
(kind `complex`, `hooksOf(built)` the cable hooks named `track0..`, `haul0..`, `anchor0..`, `dock`,
`link.cable = 'VILLAGE_GEN.tramLine'`). `TOTEM_GEN.CATALOGUE` carries `totem/park` (kind `park`,
frame `park`, `stand 'totemPlot'`, `ground.need 'flatten'` at the median, `hooks` the path and the
house slot, the lod sheet 0/20/120/1500). `TRAM_GEN.CATALOGUE` is an empty array on purpose (the
stations are house presets). `PREMISES_GEN.collect(window)` returns 39 entries with no issue
(`scratch dbg357.js` was the check; GATE PREMISES rule 3 holds only that collect answers).

The site pattern the editor can copy: `THEMES.kennecott` (`spur`, `foot`, `items` in the spur's
frame, `yard`, `tram { t, back, topZ }`) and `placeSite` — a site is items in a road's frame plus
the shelf cut before placement plus the line solved after.

---------------------------------------------------------------------------------------------

## 8. THE SCREENSHOT RIG (how every picture in this chantier was taken)

1. Serve the worktree: `node flyDiy/tools/_serve.js 8392 D:/Dev/wt-village` (the launch config
   `flydiy-village-safe`); the sink `scratch/sink.js` on 8412 writes POSTed data URLs into
   `flyDiy/screenshots/lods/`.
2. In the pane, the benches' `let`s are NOT globals — use the hooks: house bench
   `window.benchView({ centre, yaw, pitch, dist, reset })` in the MODEL's frame (the root is turned
   by the sky's azimuth; the hook accounts for it); village bench the same in the WORLD's frame,
   plus `window.lastVil` and `window.tramAt(s)`.
3. Pick the preset through `#presetSel` + a `change` event; dials through their row's
   `input[type=range]` + `input` and `change` events (find the row by its label text).
4. `canvas.toDataURL` right after `benchView` (it draws synchronously); POST to the sink.
5. The village is in the mountain's shadow under the afternoon sky from most angles; the house
   bench's `#sunAz` slider turns the model under the sun (0 lights the base barn's open end).

---------------------------------------------------------------------------------------------

## 9. LANDING THE BRANCH ON MASTER (not yet done; the user decides when)

The branch is a clean sequence of three commits on top of master. The shared working tree
(`D:\Dev\DeGaRoR.github.io`) has other sessions' uncommitted edits in files this branch does NOT
touch (verify with `git status` there before landing). The recipe:

1. In the worktree: `git rebase master` once more (master moves; HANDOVER conflicts every time
   because every entry is appended at the end — `scratch/resolve_handover.py` keeps both sides,
   HEAD's first, then `git rebase --continue`). Re-prove from a clean worktree:
   `git worktree add --detach /tmp/wtN HEAD && cd /tmp/wtN && node flyDiy/tools/run_gates.js
   --only=CABIN,HOUSE,VILLAGE,MEDIA,TOTEM,PREMISES`.
2. Number the entries: replace "(village-tram branch, provisional number)" in the three HANDOVER
   headings with the next free G numbers (`git show master:flyDiy/HANDOVER.md | grep "^## G"`), and
   the same numbers in the commit messages if you amend; or keep the provisional wording and add
   one line at the top of each saying which G it landed as — the user has accepted both.
3. Fast-forward master: from the main repo, `git update-ref refs/heads/master <branch tip>` is
   only safe if master == the branch's base (`git merge-base --is-ancestor master village-tram`).
   Then bring the shared WORKING TREE up to date for the files the branch changed, WITHOUT
   `git checkout` (other sessions' uncommitted work lives there): for each file in
   `git diff --name-only <base> village-tram`, if the shared copy equals the base version
   (`git diff --quiet <base> -- <file>` in the main repo) copy the branch's version over it; if it
   differs, merge by hand (3-way: base, theirs, ours). HANDOVER.md always differs — merge it.
4. `git status` in the shared tree must then show none of the branch's files as modified. Run the
   gates there too. Tell the other running sessions (send_message) that master moved.

---------------------------------------------------------------------------------------------

## 10. WHAT IS OWED (honest list)

- The tram in the GAME: `tram_run.js` driven by the world clock, the ropes and cabins stood from
  `vil.tram` in `render_world` — nothing of the village is in `index.html` yet (the premises
  editor is the road to that).
- Wheels spinning and the haul strands moving (cosmetic, `wheels[i].axis`).
- The park's clan house is a `log cabin` preset with L/w clipped to the slot; a proper clan house
  (a long house with a carved front) is a preset to write.
- The mill's conveyors are lattices; a belt, rollers and a drive would be the next detail.
- The house bench cannot show the slope under the stations (a flat ground patch); a terrain
  option there would make the mill reviewable without the village.
- `derelict` is gone from the mill's dials; the loose boards at the lean's foot are the only
  derelict touch left.
