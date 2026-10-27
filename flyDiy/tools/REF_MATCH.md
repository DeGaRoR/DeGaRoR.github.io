# REF_MATCH — building an aeroplane card to a reference 3D model

The method the Sopwith Camel card was built with on 27 Oct 2026, written so a new starter aeroplane (an archetype
card) can be matched to a reference the same way, faster, and through the garage only. The tools are in
`tools/ref_match/`; the fast picture is `tools/quickshot.js` (`tools/QUICKSHOT.md`).

**The rule above all: every change is a garage row.** A card is a list of the rows a builder could set by hand. If a
shape needs something no row offers, stop and flag it (section 6): the garage gets the control, then the card uses it.

## 0. What you need

- A reference GLB (Sketchfab exports work; check the licence in the file's `asset.extras` and credit it in the
  reference config). It is rarely to scale: one known dimension scales it (the span is the safest).
- The card to match, in `tools/_cage_design.js` `ARCHETYPES` (start from the nearest existing card).
- node + python3 with numpy and PIL (both present in the cloud box). No browser.

## 1. Set up the reference (once per aeroplane)

```
cp <model>.glb tools/ref_match/refs/<key>.glb
python3 -I tools/ref_match/glb_tris.py tools/ref_match/refs/<key>.glb /tmp/x.npz --list
```

The listing gives every mesh node's box. Pick the nodes for each role and write `tools/ref_match/refs/<key>.json`
(copy `refs/camel.json`):

| role | what it must be | used for |
|---|---|---|
| `cowl` | the cowl / bonnet shell only | the FIREWALL = its back face (all stations are "aft of the firewall") |
| `hub` | the prop hub or shaft | the THRUST LINE = its axis (all heights are "above the thrust line") |
| `fuselage` | the body skin | the profile, station by station |
| `upper`, `lower` | the planes (a monoplane: `upper` only) | stations, heights, dihedral (sliced) |
| `fin`, `stab` | fin + rudder, tailplane + elevators | fit_tail.js |
| `tyre`, `legs` | a main tyre, the main legs | wheel centre / track, the legs' roots |

`scale`: `{ "by": "span", "part": "upper", "metres": 8.53 }`. Sanity-check with the listing: x = span, y = up,
z = nose (+). A model in another orientation needs its axes swapped in `glb_tris.py` first.

## 2. The loop

```
node tools/ref_match/dump_build.js --key <key> /tmp/o --save /tmp/born.json   # birth the card as the shed does
python3 -I tools/ref_match/refmatch.py tools/ref_match/refs/<key>.json /tmp/o --png /tmp/cmp --tail /tmp/tail.json
```

`refmatch.py` prints the headline table (ours / ref / difference), the fuselage profile at 16 stations, the wings
sliced across the span and the gear, and writes `/tmp/cmp_{side,top,front}.png` (ours grey/red, the reference green,
aligned on the firewall and the thrust line). Change rows in the card, run again. A row can be tried without editing
the card: `dump_build.js /tmp/born.json /tmp/o --over '{"row": value}'` (and the same `--over` on quickshot.js for a
shaded picture). Each loop is ~10 s.

Helpers:
- `node tools/ref_match/rings.js /tmp/born.json [over]`: the cage's control rings, nose to tail, which ring a frame
  row moved (cage units).
- `node tools/ref_match/cowl_clip.js /tmp/born.json [over]`: the engine against the cowl; `0` vertices outside = fits.
- `node tools/ref_match/fit_tail.js /tmp/born.json /tmp/tail.json fin|stab /tmp/fit.json [startJSON]`: fits the
  fin / stab outline rows to the reference (1 - IoU, ~7 s) and writes `/tmp/fit.png`. **Round each value to its row's
  step** before the card takes it (0.005 for the corner rows, 0.01 macro, 0.5 deg sweep, 0.05 sharpness), then re-run
  the fit from the card to confirm.

## 3. The checkpoints, in order (each one before the next)

Work front to back. A later checkpoint never moves an earlier one's rows without re-checking it.

| # | checkpoint | done when | the rows |
|---|---|---|---|
| C0 | scale and frames | the span matches; the cowl back and hub found | ref config |
| C1 | cowl and engine | cowl diameter / length / hang within ~5 cm; `cowl_clip` 0 outside | `fitNose` (0 free when the cowl is bigger than the nose), `cw_aftW/H`, `cw_deckH/keelH/waist` (hang it), `cw_taperW/H` 1 (one diameter), `cw_cowlLen`; the engine's `eng_mountGap` **in the engine preset** (a birth re-applies the preset), `engY` |
| C2 | body sections | profile table within ~3 cm, top, bottom and half-width | reference section (`roofY keelY halfW roofHalfW waistY floorY`), the front (`aeroWsLen aeroLen aeroTipW aeroTipH aeroDroop aeroRound`), the frames (`frCab*`, `frPax*`, `aftRoofY aftKeelY frBoom*`, `tail*`), `boomMidPinch`, `taperOn` |
| C3 | length | tail post within 1 cm | `pilotLen paxLen boomLen` |
| C4 | wings | each plane's LE / TE / chord line within ~2 cm, dihedral to the row's step | `wgDx wgParaH`, `w2Stagger w2Dy`, `wgDihedral w2Dihedral`; the two planes' planform rows identical unless the type differs |
| C5 | gear | the wheel's centre exact, then the legs' roots | the wheel: `s1X s1AxZ s1Drop s1R`; the roots: `s1Root s1Z s1_linkSpread s1_linkAng` (the anchor and the wheel are separate) |
| C6 | tail | fin and stab 1 - IoU < 0.08 each; stab height | fit_tail rows; the card states `finHeight` / `stSpan`, so the birth's area seed keeps them; `stY` |
| C7 | look | the user's eye on quickshot `q`, `side`, `front` | whatever the picture says; then back to the checkpoint that owns the row |
| C8 | garage-only audit | every changed key is a panel row; every gap flagged | section 6 |

**Continuity** (the user, 27 Oct: "keep the continuous line front to back", "as little exceptions as possible"):
prefer the reference section and the frames to carry the shape; avoid a frame deviation that only one ring takes.
A cockpit with no passenger bay: its rear ring takes BOTH the cabin's and the passenger frame's deviations (by
design), so set `taperOn: 0` and let the boom frame carry the taper, or the boom's front pinches.

## 4. Units and frames

- Cage rows are CAGE UNITS: metres = value x `planeScale` (the class sets it; the Camel's 0.745). Lengths
  (`pilotLen`, `boomLen`, `aeroWsLen`) are cage units too. Rows with `dim: 'm'` in their page definition
  (`w2Stagger`, `w2Dy`, `engY`, `s1AxZ`, ...) are metres.
- The physics FIREWALL datum (where the flown engine and the wing's `xLE` are measured from) is NOT the cowl's back
  face on a round body: it is the forward section's first ring (0.18 m aft of the face on the Camel).
- The flown envelope clamps the upper wing's LE to 0.20 m ahead of that datum (`GEN_WING_ENVELOPE.xLE`): the wing
  layer writes the clamped value back into `wgDx` ("held at"). Read the row back after a birth.

## 5. Pitfalls met (each cost an iteration)

1. Vertex-binned profiles miss long faces: slice triangles (refmatch.py does).
2. Mean vertex height of a wing is biased by the aerofoil: slice at stations.
3. Align overlays on the FIREWALL, not the cowl front: cowls differ in length.
4. A birth's engine preset overwrites the engine rows a card sets: put the engine's own geometry in its preset.
5. A birth's cowl fit (radial style) overwrites the cowl section: a free cowl (`fitNose 0`) keeps its size and
   vertical section rows (since 27 Oct).
6. The birth's tail seed writes `finHeight = finChord` (one number): a card stating `finHeight` / `stSpan` keeps
   its own (since 27 Oct).
7. Low-wing rule: a gear leg roots on any wing under the body within 0.6 m of its station. A biplane's V on the
   fuselage needs `s1Root: 1` (since 27 Oct).
8. A row change that "does nothing" is usually held or overwritten: dump the born spec (`--save`) and read it.

## 6. Garage gaps found (flag them; the garage gets the control)

| gap | status |
|---|---|
| the round body's front had no bottom roundness of its own | added: `aeroRound` ("front roundness (bottom)") |
| a gear leg could not root on the fuselage under a low plane | added: `s1Root` / `s2Root` ("legs root on") |
| the cross axle had no bracing | added: `s1_linkAxleX` ("cross-bracing wires (X)") |
| the upper wing's LE cannot go more than 0.20 m ahead of the physics firewall | OPEN: the Camel's is 6 cm further fore; an envelope or datum change for the user |
| the second wing's placement freedom, and selecting each wing on its own in the garage (the user, 27 Oct) | OPEN: a garage UI task |

## 7. The Camel log (27 Oct 2026), checkpoint by checkpoint

Reference: `refs/camel.glb`, Sketchfab "Sopwith" by stealth86, CC-BY-4.0, scaled to the 8.53 m span (x 0.01325).
Final numbers: `refmatch.py` on `--key camel` (section 2). Every key below is in the card.

**Before the model (the user's photographs, sketches and blueprints).**
- `aeroNose` round body (OPEN_TANDEM), one open cockpit (`paxCount 0`, `pilotRear 0`), `wgCentre 0` (the user: not
  cut).
- The Clerget 9B engine added to the catalogue (registry, drive, tech, join, the engine bench's preset).
- `finDorsal 0`, the tail areas from the F.1's data, later replaced by the outline fit (C6).
- Old wheels: `s1R 0.35 whProfile 2 whBulge 0.85 whRim 0 whCap 2`; the cross axle `s1_linkAxle 1`, bungee.

**C1 cowl and engine.** The reference cowl is 1.06 m across and 0.38 m long, round about the thrust line; it laps the
nose's top and sides and hangs below its bottom.
- `fitNose 0` (free: bigger than the nose, the user: "in reality, they don't fit in size").
- `cw_aftW/aftH 0.555` (1.11 m: the Clerget's heads need 1.06 + clearance).
- `cw_deckH 0.90 cw_keelH 1.10 cw_waist -0.10` (round about the thrust line, 6 cm under the face's centre).
- `cw_taperW/H 1.0` (the user: "the cowl does not extend in diameter fore"), `cw_cowlLen 0.34`.
- `engY -0.06`; the Clerget preset `mountGap 0.40` (the engine was ahead of the cowl: the user caught it).
- `cowl_clip`: 0 vertices outside.

**C2 body.** Reference: 1.02 m deep and 0.68 m wide at the cockpit, 1.05 m wide at the cowl, the top 0.61 over the
thrust line, the bottom flat 0.41 under it to the cockpit, then one straight taper to the tail post.
- Reference section: `halfW 0.67 roofHalfW 0.55 roofY 0.945 keelY -0.425 waistY 0.22 floorY -0.25`.
- Front: `aeroWsLen 0.50 aeroLen 0.24 aeroTipW 1.04 aeroTipH 0.92 aeroDroop 0.065 aeroRound 0.5`. The deck rises
  behind the cowl into the hump; the front rounds off. An earlier `aeroTipW 1.20` plus windscreen-frame widening read
  as a trumpet; the user: "a little ugly ... as little exceptions as possible". Removed.
- Cockpit: `pilotLen 0.94 frCabTopY 0.945 frCabBotY -0.425 frCabWaistW 0.45 frCabTopW 0.37 frCabBotW 0.45`.
- `paxLen 0.54 taperOn 0` (the pinch behind the cockpit, section 3).
- Boom: `aftRoofY 0.88 aftKeelY -0.37 frBoomWaistW 0.42 frBoomTopW 0.34 frBoomBotW 0.42 boomMidPinch 1.25`.
- Tail: `tailRoofY 0.405 tailKeelY -0.05 tailHalfW 0.06`.
- Profile: within 3 cm at every station.

**C3 length.** `boomLen 4.08`: tail post 4.50 aft (ref 4.50).

**C4 wings.** Reference: upper LE 0.08 ahead of the firewall at 1.18 over the thrust line; lower LE 0.41 aft at
-0.27; dihedral 0 / 2.8 deg.
- `wgParaH 0.58` (upper chord line +0.003).
- `wgDx 0.37`: held by the envelope (section 4); the upper LE sits 6 cm aft of the reference (flagged).
- `w2Stagger 0.42`: the lower plane on its own station (-0.009). `w2Dy 0.15` (+0.006).
- `w2Dihedral 3` (the reference's 2.8; the row steps 0.5). The two planes' planform rows identical (the user: "both
  wings should perfectly match").

**C5 gear.** Reference: the wheel's centre 0.348 aft, 1.107 under the thrust line, track 2 x 0.61; the V's feet on
the lower longerons 0.07 and 0.87 aft.
- Wheel: `s1X 0.525 s1AxZ -0.12 s1Drop 0.70` (within 2 cm; the height exact).
- Roots: `s1Root 1 s1Z 2.01 s1_linkSpread 0.81 s1_linkAng 40` (0.07 / 0.88 aft).
- `s1_linkAxleX 1`: the reference's X of bracing wires between the V's.

**C6 tail.** `fit_tail.js`, rounded to the steps:
- fin 1 - IoU 0.070, stab 0.063.
- Drawn areas: fin + rudder 0.70 m2 (the F.1's 0.74), tailplane + elevators 2.22 m2 (2.28).
- `stY 0.535`: the stab 0.236 over the thrust line (ref 0.236).
- The rows: the card's `fin*` and `st*` blocks.

**C7 the user's eye.** Rounds of review on quickshot pictures, each answered in the checkpoint that owns the row: the
hump, the cowl that does not flare, the engine inside the cowl, the continuous line front to back, the nose without
exceptions, the X bracing.

**Livery.** The B6313-style yellow / dark-grey bands the user chose: see the card's `finish` (when done).
