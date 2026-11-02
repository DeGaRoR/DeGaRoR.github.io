# REF_MATCH — building an aeroplane card to a reference 3D model

The method the Sopwith Camel card was built with on 27 Oct 2026, then run again on the Stearman and the Tiger Moth
and corrected by the user at every step. It is written so the next starter aeroplane (an archetype card) can be
matched to a reference the same way, faster, and through the garage only.

**It is a procedure and a tool.** The procedure is this page: what to match, in which order, with which rows. The tool
is `tools/ref_match/`: one command births a card and prints every number below against the reference
(`match.sh`), and fitters search the rows of one step at a time (tail outlines, wing tips, the cowl). The fast
picture is `tools/quickshot.js` (`tools/QUICKSHOT.md`). The tools measure; the order and the judgement are the
procedure's: a fitter is only ever run on the rows of the step in hand.

**Handing a model to a new session:** `tools/ref_match/KICKOFF.md` is the message to paste with the GLB.

**The rule above all: every change is a garage row.** A card is a list of the rows a builder could set by hand. If a
shape needs something no row offers, stop and flag it (section 7): the garage gets the control, then the card uses it.

**Sources prevail over the model.** A Sketchfab model is someone's drawing. Its scale and its proportions come from
published figures (museum and type data, cited in the reference config), never from the model alone (section 1).

## 0. What you need

- A reference GLB (Sketchfab exports work; check the licence in the file's `asset.extras` and credit it in the
  reference config).
- Published dimensions of the type: span (each plane), length, height, chord, track. Two or three sources each.
- The card to match, in `tools/_cage_design.js` `ARCHETYPES` (start from the nearest existing card).
- node + python3 with numpy and PIL (both present in the cloud box). No browser.

## 1. Set up the reference (once per aeroplane)

```
cp <model>.glb tools/ref_match/refs/<key>.glb
python3 -I tools/ref_match/glb_tris.py tools/ref_match/refs/<key>.glb /tmp/x.npz --list
python3 -I tools/ref_match/glb_views.py tools/ref_match/refs/<key>.glb /tmp/v      # every node its own colour
```

The listing gives every mesh node's box; the views number them. Pick the nodes for each role and write
`tools/ref_match/refs/<key>.json` (copy `refs/camel.json`):

| role | what it must be | used for |
|---|---|---|
| `cowl` | the cowl / bonnet shell only | the FIREWALL = its back face (all stations are "aft of the firewall") |
| `hub` | the prop hub or shaft | the THRUST LINE = its axis (all heights are "above the thrust line") |
| `fuselage` | the body skin | the profile, station by station |
| `upper`, `lower` | the planes (a monoplane: `upper` only) | stations, heights, dihedral (sliced) |
| `fin`, `stab` | fin + rudder, tailplane + elevators | fit_tail.js |
| `tyre`, `legs` | a main tyre, the main legs | wheel centre / track, the legs' roots and line |

**Scale and anchors (sources prevail).** `scale` sets the whole model by one published dimension, the span:
`{ "by": "span", "part": "upper", "metres": 8.53 }`. `anchors` then sets each other axis by its own published
figure, so a model drawn too long or too tall is corrected per axis:
`"anchors": { "length": { "metres": 7.54, "source": "24 ft 9 in: American Heritage Museum, GlobalAir" } }`
(`length` = fore/aft extent, `height` = vertical extent; only an attitude-free figure: a three-point height is not a
flying-attitude height). `sources` lists every figure used and where it came from. refmatch.py prints each anchor's
factor: a factor far from 1 means the model is out of proportion, and the source wins.

Check the roles with `refmatch.py ... --roles /tmp/roles` (each role its own colour). When a model is not a clean
set of one-part nodes:

| config key | for | example |
|---|---|---|
| `"axes": "x=z,y=y,z=-x"` | a model laid out another way (x must be span, y up, z the nose) | the PT-17 |
| `"align": "wing"` | a model yawed in its file and sitting on three points: span along the upper plane, fore along its chord | the DH.82 |
| `"align": "pca"` | a model yawed in its file in flying attitude: fore along the fuselage's long axis | |
| a part `{ "node": ..., "box": {"x"/"y"/"z"/"absx": [lo, hi]} }` | one piece of a node merged by material (the file's units, after axes / align) | the PT-17's planes share one node |
| a part `{ "node": ..., "fbox": {"aft"/"up"/"absx": [lo, hi]} }` | the same, in the match's own metres | |
| no `cowl` role | an exposed engine: the firewall is the fuselage's front face | the PT-17 |
| `"firewall": "cowl-bottom"` | a bonnet whose top panel runs back over the tank: the firewall is the cowl's lower back edge | the DH.82 |
| `"datum": "prop"` | every station aft of the PROPELLER'S PLANE instead of the firewall, both sides: when the firewall is ambiguous | the DH.82 |
| `"profile": ["fuselage", "cowl"]` | the outer skin is more than the fuselage role | the DH.82 |
| `"markers": { "front windscreen": "<node>", ... }` | nodes whose fore/aft extent is printed beside the openings (screens, coaming pads, the deck's start): step 1's landmarks | the DH.82 |
| `"exhaust": "port"` | an exhaust pipe down one side: the cowl tables read the starboard half | the DH.82 |

**The datum matters more than anything else.** Every station is measured from it; a wrong one shifts or compresses
the whole body. The DH.82's first pass took the bonnet's back as the firewall, read a body 0.8 m short, and was
rebuilt wrong from the start (the user: "you failed at the first step"). When the cowl's back edge is not a clean
plane, use `"datum": "prop"` and check it against two markers (the windscreens).

## 2. The loop

```
tools/ref_match/match.sh <key>                         # the card as the shed births it, everything measured
tools/ref_match/match.sh <key> '{"row": value}'        # a row tried without editing the card
```

`match.sh` births the card (`dump_build.js`, the shed's own path), runs `refmatch.py` and `cowl_sections.py` and
writes `/tmp/rm_<key>_{side,top,front}.png` (ours grey/red, the reference green, aligned on the datum and the thrust
line) and the born spec `/tmp/rm_<key>_born.json` for the fitters. Change rows in the card
(`tools/_cage_design.js`), run again; ~15 s a loop. refmatch.py prints:
- the headline: cowl, body, tail post, wings, gear, fin, stab, ours / ref / difference;
- the fuselage profile at 16 stations (top, bottom, half-width);
- STEP 1: the cockpit openings (holes in the top skin, fore and aft edges) beside the markers, and the nose, fine;
- STEP 2: each plane's planform, 1 - IoU from above;
- the wings sliced across the span (chord-line height, LE, TE), the dihedral;
- the main gear: the wheel's centre, track and radius, the legs' roots.

The tools (each prints its own usage at the top of the file):

| tool | does | step |
|---|---|---|
| `cowl_sections.py <ref.json> <prefix> [a0 a1 step] [--starboard]` | the cowl fitting table: waist, top, bottom, half-width, roundness top and bottom, station by station; flags an INVERTED CONE | 3, section 4 |
| `fit_cowl.py <ref.json> --key K <prefix> '{"row":[lo,hi,step]}' --over '{...}'` | searches the rows of ONE cowl step (coordinate search) against that table and the body aft (which pins the thrust line) | 3, section 4 |
| `fit_tips.py <ref.json> <born.json> <prefix> [upper\|lower\|both]` | builds every tip type the garage offers and scores each against the reference's outer 35 % planform: the tip is chosen by measurement | 2 |
| `fit_tail.js <born.json> <tail.json> fin\|stab <out.json>` | fits the fin / stab outline rows (1 - IoU at 1 cm), the control surface held at 18-62 % of the area | 3 |
| `leg_line.py <ref.json> <prefix>` | the main legs seen from the front: root, foot and angle from vertical, for each | 3 |
| `cowl_clip.js <born.json> [over]` | the engine against its cowl: `0` vertices outside = fits | 3 |
| `rings.js <born.json> [over]` | the cage's control rings nose to tail: which ring a frame row moved | 1 |
| `fit_body.py <ref.json> --key K <prefix> '{"row":[lo,hi,step]}' [--range a0,a1] [--skipbot b0,b1] [--cut y] [--w top,bot,hw,post]` | searches ONE body step's rows against the reference's centreline top / bottom, half-width above `cut` and the tail post, station by station; the glazing markers join the top line (the hood); `skipbot` leaves out a low wing's centre section that IS the belly | 1 |
| `dump_build.js <build\|--key K> <prefix> [--over] [--save born.json]` | the birth and the triangle dump everything above reads | all |

**Round each fitted value to its row's step** before the card takes it (0.005 the corner rows, 0.01 macro, 0.5 deg
sweep, 0.05 sharpness, 0.05 `wgDx`, 0.02 `w2Stagger`), then measure again from the card.

## 3. The order (the user's): proportions, then the plan, then the details

Each step is finished before the next one starts; a later step never moves an earlier step's rows without
re-measuring it.

**Step 1 - the side view's proportions.** The sections' lengths and the big lines, before any part:
- the cockpit openings (fore and aft edges) against the markers;
- the nose: where the body's front is, and its section ring by ring (the fuselage nose, NOT the cowl);
- the body sections' lengths: nose, cabin, passenger bay, boom; the tail post;
- the deck line and the keel line, straight where the type's are straight;
- the wings' stations and heights (each plane's LE, TE, chord line), their sweep.

| what | done when | the rows |
|---|---|---|
| scale, datum | span and anchors match the sources; the datum checked on two markers | ref config |
| openings | each cockpit's fore and aft edge within ~3 cm | `aeroWsLen pilotLen paxLen` |
| tail post | within 1 cm | `boomLen` |
| deck and keel | profile top and bottom within ~2 cm, station by station | the reference section (`roofY keelY waistY floorY`), frames (`frCab* frPax* aftRoofY aftKeelY tail*`), `boomMidPinch` |
| fuselage nose | the body's front sections within ~2 cm | `aeroTipW aeroTipH aeroDroop aeroRound`, `aeroLen` |
| wings | each LE / TE within ~2 cm, chord line within ~3 cm | `wgDx wgParaH wgTipX`, `w2Stagger w2Dy w2TipX`, dihedral |

**Step 2 - the same, seen from above.** Plan widths of the body station by station; the planforms (1 - IoU); the tips
(`fit_tips.py`, `wgTip` / `w2Tip`: the user, "pick closest" when no type matches exactly); the tailplane's span.
Rows: the frames' half-widths (`halfW roofHalfW frCab*W frPax*W frBoom*W tailHalfW`), `boomMidPinchW` (the plan's own
pinch), the planform rows.

**Step 3 - only then the parts.** The cowl (section 4), the gear (the wheel exact first: `s1X s1AxZ s1Drop s1R`;
then the legs' roots, separately: `s1Root s1Z s1_linkSpread s1_linkAng`; the legs' angle from the front by the
anchors, not by eye: `leg_line.py`), the tailwheel's station, the keel extension under the tail (`finKeel`), the
tail outlines (`fit_tail.js`, the card states `finHeight` / `stSpan`), `stY`, the engine against the cowl
(`cowl_clip.js`).

**Then the user's eye.** quickshot `q`, `side`, `front`; each remark is answered in the step that owns the row.
**Then the garage-only audit**: every changed key is a panel row; every gap flagged (section 7).

**Continuity** (the user: "keep the continuous line front to back", "as little exceptions as possible"): prefer the
reference section and the frames to carry the shape; avoid a frame deviation that only one ring takes. A cockpit
with no passenger bay: its rear ring takes BOTH the cabin's and the passenger frame's deviations (by design), so set
`taperOn: 0` and let the boom frame carry the taper, or the boom's front pinches.

## 4. Fitting a cowl (the user's rule)

A cowl is fitted to the fuselage's nose, so **the fuselage's nose is right first** (step 1): a cowl fitted to a
wrong nose is wrong twice. Then, in this order, each step measured with `cowl_sections.py` (and searched, when it
helps, with `fit_cowl.py` on that step's rows only):

1. **The waist line first.** The cowl's widest line meets the body's widest line at the firewall.
   `cw_waist` (`fitNose 1` fits it to the body's front ring; a free cowl, `fitNose 0`, sets it).
2. **The top and bottom global sizes** against the fuselage's nose: matched, or different on purpose. A cowl usually
   matches the body on top and on the sides and is bigger at the bottom (the exhaust goes there), so its bottom hangs
   lower than the body's. `cw_aftW cw_aftH cw_deckH cw_keelH` (`fitNose 1` = the body's own; `fitNose 0` to let the
   cowl be bigger than the nose: the Camel's, "in reality, they don't fit in size").
3. **The roundness of everything**: the section at the firewall, at the barrel end, at the nose ring, top and bottom
   apart. `cw_sqAftTop cw_sqAftBot cw_sqFrontTop cw_sqFrontBot cw_lidSqTop cw_lidSqBot` (0 diamond, 0.5 round, 1
   square); the table's `rT` / `rB` (a box reads 1.00, an ellipse 0.62).
4. **The front faces and the slope**: how the cowl narrows to its face, and whether it goes up or down to the prop.
   `cw_taperW cw_taperH` (the barrel end's size), `cw_lidLen cw_lidRound cw_lidShoulder cw_lidMode cw_lidR` (the nose
   bowl and ring), and THE DROOP: `cw_lidRise` (the axis, firewall to barrel end) and `cw_faceRise` (barrel end to
   nose ring); `cw_deckSweep cw_keelSweep cw_waistSweep` (where the lines bend). A nose that falls to the prop (the
   DH.82's, the inverted engine) takes a lot of droop.
5. **Never the inverted cone.** A cowl is never wider or taller at its front than at its back: that means the nose
   section is the wrong size, or the cowl is bigger than the body where it should not be. `cowl_sections.py` flags
   it. (The Stearman's first cowl was one: the user's red flag.)
6. **Then the apertures**, matched to the reference's face: `cw_apMode cw_apW cw_apH cw_apSq cw_apOffX cw_apOffY`
   (and the pair, the scoop).
7. **Then, slightly, the engine or the cowl alone**: `engY` moves the engine (the thrust line) and not the cowl;
   `eng_mountGap` its stand-off (in the engine's preset: a birth re-applies it). The droop moves both.

**The coupling to know.** The engine sits on the cowl's nose axis, plus `engY`. Every row that moves the nose ring
(the droop, `aeroDroop`, `roofY` through the body's front) moves the thrust line with it, and since every height is
measured from the thrust line the whole aeroplane then reads as moved. So the body aft of the cockpits is the check
of every cowl step: if it moved, put the thrust line back with `engY`, not with the body's rows. `fit_cowl.py` scores
the body aft for exactly this reason.

**No cowl** (an exposed engine, the PT-17's radial): `cowlOn 0`, the proper option; never a cowl shrunk to nothing.

## 5. Units and frames

- Cage rows are CAGE UNITS: metres = value x `planeScale` (the class sets it: 0.745 for these three). Lengths
  (`pilotLen`, `boomLen`), the frames, `s1Z`, `s1_linkSpread` are cage units. Rows with `dim: 'm'` in their page
  definition (`w2Stagger`, `w2Dy`, `engY`, `s1AxZ`, `wgTipX`, ...) are metres; `aeroWsLen` reads as metres too.
- Signs: `wgDx` + = the wings FORE (0.05 a step); `s1AxZ` + = the axle fore; `s1Z` + = the legs' station fore.
- The physics FIREWALL datum (where the flown engine and the wing's `xLE` are measured from) is NOT the cowl's back
  face on a round body: it is the forward section's first ring.
- The flown envelope (`GEN_WING_ENVELOPE`, `src/core/60_gen_spec.js`) clamps what the join flies and writes clamped
  values back into the rows ("held at"). Opened on 27 Oct (the user: "we should freely set both wings sizes"): the LE
  up to 3.0 m ahead of the datum, stagger +-2.5 m, the second plane from 2 m span / 0.40 m chord. Still read a row
  back after a birth.
- `roofY` (the reference section) scales the rings fore and aft and moves the nose ring, so it moves the thrust line
  too (section 4): after it, re-check the bottom line aft and correct with `engY` if the whole body moved.

## 6. Pitfalls met (each cost an iteration)

1. Vertex-binned profiles miss long faces: slice triangles (refmatch.py does).
2. Mean vertex height of a wing is biased by the aerofoil: slice at stations.
3. Align overlays on the datum, not the cowl front: cowls differ in length.
4. A wrong datum compresses or stretches the whole body (the DH.82's first pass): `"datum": "prop"` + markers.
5. A birth's engine preset overwrites the engine rows a card sets: put the engine's own geometry in its preset.
   A NEW ENGINE PRESET goes at the END of PRESETS (tools/_eng_page.js) and into PRESETS_AFTER_CUSTOM: `engPreset` is a
   saved index, and the Clerget / Merlin inserted mid-list gave nine saved builds another engine (A0, T-P1). Add its
   row to the sound table (src/viewer/audio/engine_config.js) and GEN_ENG_CG too (GATES AUDIOENG, ENGID).
6. A birth's cowl fit (radial style) overwrites the cowl section: a free cowl (`fitNose 0`) keeps its size and
   vertical section rows.
7. The birth's tail seed writes `finHeight = finChord` (one number): a card stating `finHeight` / `stSpan` keeps
   its own.
8. Low-wing rule: a gear leg roots on any wing under the body within 0.6 m of its station. A biplane's V on the
   fuselage needs `s1Root: 1`.
9. A row change that "does nothing" is usually held or overwritten: dump the born spec (`--save`) and read it.
10. A tail outline fit can win its IoU by shrinking the control surface to a sliver (the PT-17's elevator, 4 %):
    `fit_tail.js` holds the control fraction at 18-62 %.
11. A model with no deck skin over the cockpits (the DH.82's) reads its top as the floor there: read the deck either
    side of the openings.
12. An exhaust pipe down one side reads as the cowl's width: `"exhaust": "port"`.
13. A row's effect elsewhere (section 4's coupling): after any front row, check the body aft.

## 7. Garage gaps found (flag them; the garage gets the control)

| gap | status |
|---|---|
| the round body's front had no bottom roundness of its own | added: `aeroRound` ("front roundness (bottom)") |
| a gear leg could not root on the fuselage under a low plane | added: `s1Root` / `s2Root` ("legs root on") |
| the cross axle had no bracing | added: `s1_linkAxleX` ("cross-bracing wires (X)") |
| the boom's pinch could not differ in plan and in side view | added: `boomMidPinchW` ("pod pinch (plan)") |
| the wing envelope: the upper LE held 0.20 m ahead of the datum, the second plane's size and placement bound | opened (the user, 27 Oct) |
| selecting each wing on its own in the garage (the user, 27 Oct) | OPEN: a garage UI task |
| no tip rounded on its trailing corner only (the DH.82's, the PT-17's): the tip types round the leading corner or both | OPEN: the closest taken by measurement |
| a leg cannot root ahead of the body's face (the DH.82's front legs on the engine bearers) | OPEN |
| the DH.82's split axle hinges on a bracket under the belly centreline: ours is the split axle with its shock strut, or one straight bar | OPEN: the closest taken |
| an inverted in-line's induction is drawn on top of the crankcase only (the DH.82's bonnet has no room for it) | OPEN: an induction-side row on the engine page |
| the cowl's front section has no waist of its own (the DH.82's tombstone face, widest at the thrust line) | OPEN: a nose-ring waist row |
| the prop check's body test samples past the body's end ("through the body" on a deep bonnet) | OPEN: a check fix |
| a truly elliptic planform (the Spitfire's): the tip types only rounded the last metre | added: `wgPlan` / `w2Plan` ("planform": elliptic) and `wgPlanAxis` (the straight chord line, 0.10-0.50 of the chord) - the chord c0 sqrt(1 - (z/s)^2), area, MAC and xAC integrated |
| cooling radiators under the wing (the Spitfire's coolant and oil radiators) | added: the `radiators` part (`radMode` none / one / a pair, `radX` `radAt` `radLen` `radW` `radH` `radFlap` `radOilK`; section `radSkin`) |
| the propeller held on the engine's face: no shaft extension (a long nose, an extension shaft) | added: `cw_noseOff` ("shaft length (prop off the engine)", 0-1.5 m) |
| side ejector exhausts (the Merlin's) | added: exhaust style 4 "ejector stubs" (`eng_exStyle 4`, `eng_exPair` in pairs) |
| the split flap on the design tile | added |
| a liquid-cooled V-12's long stand-off from the firewall | `eng_mountGap` opened to 8 case radii |
| retractable gear (the Spitfire's outward-retracting legs) | OPEN |
| a wing-root fillet (the low wing's fairing into the body) | OPEN |
| a sliding hood on rails (a canopy that slides aft) | OPEN: the cabin's skylight + bubble glass is the closest |
| the supercharger casing and the long intake under the nose | OPEN |
| a waist row along the body (the line where a fighter's sides turn under) | OPEN |
| the induction's side (as for the DH.82, above) | OPEN |

## 8. The Camel log (27 Oct 2026)

Reference: `refs/camel.glb`, Sketchfab "Sopwith" by stealth86, CC-BY-4.0, scaled to the 8.53 m span (x 0.01325).
Final numbers: `match.sh camel`. Every key below is in the card.

**Before the model (the user's photographs, sketches and blueprints).**
- `aeroNose` round body (OPEN_TANDEM), one open cockpit (`paxCount 0`, `pilotRear 0`), `wgCentre 0` (the user: not
  cut).
- The Clerget 9B engine added to the catalogue (registry, drive, tech, join, the engine bench's preset).
- `finDorsal 0`; old wheels: `s1R 0.35 whProfile 2 whBulge 0.85 whRim 0 whCap 2`; the cross axle `s1_linkAxle 1`.

**Step 1.**
- Cockpit opening 0.72-1.24 aft, exact. `pilotLen 1.15 paxLen 0.54 taperOn 0`; tail post 4.50 (ref 4.50).
- Reference section `halfW 0.67 roofHalfW 0.55 roofY 0.945 keelY -0.425 waistY 0.22 floorY -0.25`; boom
  `aftRoofY 0.88 aftKeelY -0.37 frBoom* boomMidPinch 1.25 boomLen 3.87`; tail `tailRoofY 0.405 tailKeelY -0.05
  tailHalfW 0.06`. Profile within 3 cm at every station.
- Front: `aeroWsLen 0.50 aeroLen 0.24 aeroTipW 1.04 aeroTipH 0.92 aeroDroop 0.065 aeroRound 0.5`. An earlier
  `aeroTipW 1.20` plus windscreen-frame widening read as a trumpet; the user: "a little ugly ... as little
  exceptions as possible". Removed.
- Wings: `wgDx 0.42 wgParaH 0.58 w2Stagger 0.48 w2Dy 0.15 w2Dihedral 3`: both planes within 3 cm. The two planes'
  planform rows identical (the user: "both wings should perfectly match").

**Step 2.** Tips by `fit_tips.py`: elliptic (`wgTip 3 w2Tip 3`) - the user: "choose other wingtip types".

**Step 3.**
- Cowl: 1.06 m across, 0.38 m long, round about the thrust line, lapping the nose's top and sides and hanging below
  its bottom. `fitNose 0`, `cw_aftW/aftH 0.555`, `cw_deckH 0.90 cw_keelH 1.10 cw_waist -0.10`, `cw_taperW/H 1.0`
  (the user: "the cowl does not extend in diameter fore"), `cw_cowlLen 0.34`; `engY -0.06`, the Clerget preset
  `mountGap 0.40` (the engine was ahead of the cowl: the user caught it); `cowl_clip` 0 outside.
- Gear: the wheel first, `s1X 0.525 s1AxZ -0.12 s1Drop 0.70`; then the roots, `s1Root 1 s1Z 2.01 s1_linkSpread
  0.81`; the legs' angle from the front set by the anchor (the user: "get the angle by tuning the anchors"):
  `s1_linkAng 43` - 17.8 deg against the reference's 18.7, the root 0.312 out (0.311). `s1_linkAxleX 1`: the X of
  bracing wires.
- Tail: fin 1 - IoU 0.070, stab 0.063; `stY 0.535`.

**Livery.** The B6313-style yellow / dark-grey bands the user chose: see the card's `finish` (when done).

## 9. The Stearman and the Tiger Moth (27 Oct 2026)

The same procedure on the Stearman and Tiger Moth cards with the user's PT-17 and DH.82 models. Both cards had been
drawn from photographs and type data, not measured, and the method found what that left behind: both bodies much too
long, the planes far aft.

**Stearman** (`refs/stearman.json`; Sketchfab "Boeing Stearman PT.17" by helijah, CC-BY-4.0; merged by material,
axes remapped). Re-anchored on the sources (the user: "I don't trust the model more than that, so sources
prevail"): span 9.80 / 9.50, chord 1.524, length 7.54, height 2.79, tread 1.937 (American Heritage Museum,
GlobalAir, Planes of Fame, Pima, the National Stearman Fly-In, Dave's Warbirds, skytamer).
- The cowl removed (`cowlOn 0`, "there's a proper option for that"): the PT-17's radial is exposed. Its first cowl
  was an INVERTED CONE (the user's red flag, section 4).
- Step 1: openings 1.46-2.08 (exact) and 2.42-3.06 (ref 2.38-3.02); `aeroWsLen 1.18 pilotLen 1.19 paxLen 1.23
  boomLen 3.50`; `wgDx 0.55 wgParaH 0.44 w2Span 9.50`; the nose ring `aeroTipW 0.78 aeroTipH 0.72`.
- Step 2: tip `wgTip 4` (hoerner, the closest; the user: "easy on the stearman tip ... pick closest").
- Step 3: the wheel exact (`s1X 0.87 s1AxZ 0.23`); the tailwheel at 6.334 aft (`s2Z 0.50 s2Drop 0.16`); the keel
  extension under the tail (`finKeel 1`, "the game can model that"); the fin refitted (1 - IoU 0.147) and the stab
  with the control-fraction hold; `stY 0.54`.
- Open: no published fuselage width; the model's 1.1 m is kept and flagged.

**Tiger Moth** (`refs/moth.json`; Sketchfab "Dh82" by manilov.ap, CC-BY-4.0; yawed and on three points, aligned on
the upper wing; bonnet in panels; `"datum": "prop"`, length anchored at 7.29 m, the screens and coaming pads as
markers, the exhaust to port).
- Step 1, first: the datum. The bonnet-back firewall had compressed the body by 0.8 m. On the propeller's plane:
  openings 1.80-2.30 and 2.64-3.16 against the markers' 1.80-2.30 and 2.60-3.08; tail post 6.456 (6.415).
  `aeroWsLen 0.59 pilotLen 1.04 paxLen 1.06 boomLen 3.36`.
- Step 1, the wings: 0.44 m aft (`wgDx 0.35`), both swept as measured (`wgTipX 0.37 w2TipX 0.415`, `w2Stagger
  0.56`): LE within 1 cm, plan 1 - IoU 0.10 / 0.22 from 0.53 / 0.70.
- Step 1, the deck and keel lines straight to the post (`frCabBotY -0.60 frPaxBotY -0.52 aftKeelY -0.42 tailKeelY
  0.03`, `aftRoofY 0.63 tailRoofY 0.38 frCabTopY 0.64 frPaxTopY 0.66 roofY 0.68`, `boomMidPinch 1.0`): within ~1 cm
  aft of the cockpits.
- Step 1, the fuselage nose (before the cowl, the user: "don't touch the cowl before you get the nose of the fuselage
  right"): the round front narrowed to the type's tapering nose and lowered, `halfW 0.54 aeroTipW 0.91 aeroTipH 0.95
  aeroDroop 0.025`: within ~2 cm from 1.0 to 1.6 m.
- Step 2: the boom full in plan and closing late (`frBoom*W`, `boomMidPinchW 1.55`): within 1 cm. Tips clipped
  (`wgTip 1 w2Tip 1`, `fit_tips` 0.093 / 0.108; the type rounds its trailing corner, which no tip type does).
- Step 3, the gear: the V from the lower longeron at 1.02 (the type's front strut) to its rear leg, the wheel exact
  (1 mm / 4 mm): `s1Root 1 s1Z 2.08 s1_linkSpread 1.0 s1AxZ -0.29 s1Drop 0.60`; the split axle.
- Step 3, the cowl, in the user's order (the user: "you need to use the droop parameter of the cowl, a lot"):
  - 1-2, waist and sizes: `fitNose 1` (the bonnet meets the body's nose ring on top, sides and bottom).
  - 3, roundness: `fit_cowl.py` took the top squarer and the bottom to a diamond; the head-on picture overruled the
    bottom (the type's face is a tombstone: round on top, straight sides, flat bottom): `cw_sqFrontTop 0.62
    cw_lidSqTop 0.62 cw_sqFrontBot 0.8 cw_lidSqBot 0.8`.
  - 4, faces and slope: the barrel narrowed to the type's tapering nose (`cw_taperW 0.45 cw_taperH 0.84`, a free
    nose ring `cw_lidMode 0`) and DROOPED to it (`cw_lidRise -0.056 cw_faceRise 0.006 cw_keelSweep 0.04`): the face
    centred 0.21 under the thrust line, the inverted Gipsy's. Before it, the axis ROSE 8.5 cm to the prop.
  - 5: no inverted cone.
  - 6, apertures: none (`cw_apMode 0`): the type's nose cap is closed.
  - 7, the engine: `engY 0.21` puts the thrust line back where the reference has it (the droop carries it down).
  - Result, from the face to the cockpit: top within 2 cm, bottom within 4 cm, half-width within 2 cm.
- OPEN for the user, the engine against the bonnet (`cowl_clip`: up to 0.11 m outside, on top). Our inverted
  Gipsy carries its carburettor and airbox ON TOP of the crankcase (the engine generator's rule for an inverted
  in-line, G164) and its crankcase is a box flat-topped 0.20 m over the crank from its very front; the type's bonnet
  top runs 0.13 over the thrust line at the face to 0.27 at the firewall. Lowering the engine clears it only at
  ~0.11 m of thrust line (every 0.03 of `engY` slides the whole aeroplane 3 cm against it); raising the bonnet's top
  departs from the type. Wanted: the induction placeable (side / rear) in the engine page, then `cowl_clip` 0.
- OPEN: the front's widest line. The type's face is widest at the thrust line (the tombstone's spring line); ours
  0.3 m lower: the firewall's `cw_waist` is refitted to the body by `fitNose`, and `cw_waistSweep` only bends it
  8 cm before the bottom pinches. Wanted: the nose ring's own waist row.

## 10. The Spitfire (27 Oct 2026): WORK IN PROGRESS, stopped

The user's reference: a detailed Spitfire Mk IX (`refs/spitfire.json`, `refs/spitfire.glb`, the 'hood glass' marker).
The user stopped the match ("we're starting from too far"): the card `spitfire` is in `_cage_design.js` as
**Spitfire-alike (WIP)**, `blocked` (the chooser shows it greyed with its reason, the gates skip it), and was never flown.

What it has: the elliptic planform (11.23 m span, 2.55 m root chord: Sw 22.49 m2 against the published 22.48, AR 5.61),
the Merlin 66 on a 4-blade Rotol (a registry row: 744 kg, 1283 kW, two-stage blower), side ejector stubs in pairs,
the coolant and oil radiators under the wings, the split flap, the faired V cowl (`cowlPreset` "Faired V (Spitfire)").

The body type (the user: "be careful what kind of fuselage type you select"): the CABIN body with no mirror, its
skylight and bubble glass for the hood - the turtle-deck pod was drawn too and loses the spine aft of the hood.

Where it stopped: step 1 (the lengths) half-done - `fit_body.py` from 0.173 to 0.164 on the nose and openings; the body
sections, the plan, the tail and the gear not started. To resume: `match.sh spitfire` (unblock the card in a scratch
copy), then the order of section 3; the gaps it met are section 7's last six rows.

