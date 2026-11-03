# FLOATS-CLASSIC — the EDO-style rounded-deck float (2026-11-03)

## Round 2: the section measured, weight and price (supersedes the round-1 shape and numbers below)

The user, on round 1: "a tad flat on top ... Did you find blueprints or accurate measurements? If not, we'll need
these not to eyeball it ... It needs to come with weight and price."

- **Round 1's top was eyeballed.** A web search found no EDO offsets online. The leads are NACA WR L-722, EDO drawing
  14390 and the 1997 Model Aviation pattern, none of them reachable from here.
- **The user's giant-scale EDO plan is the measurement.** See `edo_plan_sections.md` and `edo_section_measured.png`.
  Every former's topside is one quarter ellipse from the chine (the widest point) up to the crown. The height is
  0.74-0.80 of the beam, the deadrise about 25 deg, the length 6.7 beams, and the stern 0.70 of the beam.
- **The hull follows it.** The physics and the drawing share one section, matching to 0.09 %. Every Wipline hull is
  still master's to the bit.

**Weight and price** (the pair, rigged and installed, in credits at parity with 2025-26 dollars). The ledger now bills
the floats instead of the wheels a float build doesn't have:

| row | pair system | hull each | price | basis |
|---|---|---|---|---|
| EDO 1320 | 75 kg | 30 kg | 12,000 | 165 lb installed; ~7,000 used + install (sourced) |
| EDO 2000 | 119 kg | 48 kg | 15,000 | 263 lb installed; ~10,000 a good used set + install (sourced) |
| EDO 2870 | 185 kg | 74 kg | 14,500 | 8,700 used with rigging + install (sourced) |
| EDO 1650 / 2440 / 4580 / 7170 | 75 / 150 / 290 / 460 kg | — | 11,400 / 17,800 / 29,700 / 44,100 | est.: 5,000 + 85 / kg |
| EDO 78-28000 | 2,300 kg | 1,036 kg (2,284 lb, sourced) | 200,500 | est. (no market) |
| Wipline 2100 | 125 kg | 50 kg | 55,000 | est.: an older 36,300 + 5,300 installed quote, brought to today |
| other Wipline rows | the catalogue's | 0.40 of it | 440 / kg | est. |

**On the water** (GATE FLOATSCLASSIC-WATER, `floatsclassic_water2.txt`):

| build | mass | reserve | lift-off |
|---|---|---|---|
| DC-3 on EDO 78-28000 | 11,115 kg | 2.37 | 53.4 s, 1,006 m |
| PA-18 on its own rows, EDO classic | 754 kg | 2.58 | 23.5 s, 245 m |

The PA-18 on Wipline lifts off at 22.7 s after 236 m. Its EDO hull holds 973 kg a float to the deck, against the
Wipline's 1,171.

**Pictures, round 2.** From `node tools/quickshot.js`, the node rasteriser (the user: "use the simple rendering tool
for screenshots, not the game"):

- `front_pa18_wipline_vs_edo.png`, `front_c172_wipline_vs_edo.png`: the floats head on, brightened. The EDO is a bell
  on a V; the Wipline is a flat deck on flared sides.
- `pa18_*_q.png` / `_side.png`, `c172_*`: 3/4 and side views, Wipline vs EDO classic.
- `dc3_edo28000_q.png`, `_side.png`, `_front.png`: the DC-3 on EDO 78-28000s.
- `edo_section_measured.png`: the plan's former F2 beside the model's section, with the measured points over it.
- `round1/`: the round-1 stills from the game's renderer, with the old, flatter top. The water stills are there too;
  quickshot draws no water.

---

## Round 1

The user (via A0, 3 Nov 2026): "another model of floats. A rougher one, with rounded top, feels more home made ... We
have the Wipline line, this one could be called something else, but use the same controls? ... Or maybe have 3? But
let's not make it a headache." A0, the same evening: the references are EDO floats; "there is a DC3 on EDO 28000
floats, that's a cool target".

Branch `claude/floats-classic` off master adb2d2a9 (train L30b). A cloud session: node and SwiftShader, no GPU. No
frame time was read off SwiftShader. The pictures below are stills for the eye, not measurements.

## The reference family, confirmed (sources; facts in my own words, no images copied)

The user's photos (a PA-18 over a fjord and a PA-28 Cherokee on grass) show the classic EDO aluminium float.

- **PA-18S on EDO 2000s.** The PA-18 type certificate data sheet (FAA TCDS 1A2) lists "Edo 89-2000 floats" with an EDO
  water rudder. Fitting them adds 179 lb, and the early variant's maximum is 1,760 lb.
  - https://dyzz9obi78pm5.cloudfront.net/app/image/id/615b7002e63f1db3487b2534/n/1a2.pdf
  - Wipaire's 2,000 lb gross increase for the PA-18 is approved on EDO 2000s: https://www.wipaire.com/tag/piper-cub/
- **PA-28 Cherokee on EDO 2000s.** The PA-28S-180 was approved on 10 May 1963 on Edo 89-2000 floats. Piper drawing
  62008 converts the PA-28-160/180 to a seaplane under TCDS 2A13. Only about six were built.
  - https://www.skytamer.com/Piper_PA-28-160.html
  - https://www.touringmachine.com/Cherokee/PDFs/Cherokee%20Type%20Certificate%20Data%20Sheet%202A13.pdf
- **The maker.** EDO Aircraft Corporation, College Point, New York, founded in 1925. It floated aeroplanes "from Piper
  Cubs to Douglas C-47s". Kenmore Air now holds EDO float parts and data.
  - https://en.wikipedia.org/wiki/Edo_Aircraft_Corporation
  - https://aopa.org/news-and-media/all-news/2021/october/12/seaplane-pioneer-mourned
  - https://kenmoreairharbor.com/edo-floats.html
- **Sizes.**
  - The 89-2000 is about 16 ft from bumper to transom ("per the EDO book"). A pair weighs 263 lb with rudders, struts
    and wires.
  - The 89A-2000 is an 88-1650 with a plug added ahead of the step.
  - The 1320 is about 15 ft.
  - These come from owners' forums: https://www.supercub.org/forum/threads/edo-2000-float-dimensions.48792/ and
    https://www.supercub.org/forum/threads/pa-18-on-edo-2000.24501/
- **The model number** is the float's buoyancy in pounds, fully submerged in fresh water:
  https://backcountrypilot.org/forum/what-is-the-optimum-size-for-aircraft-floats-22302
- **The fittings.** The bow bumper is bolted through the bow bulkhead with one nut. The pump-out cups sit at the
  bulkheads on the deck.
  - https://www.supercub.org/forum/archive/index.php/t-37583.html
  - https://backcountrypilot.org/forum/edo-float-repair-techniques-13987
- **The DC-3's floats: the EDO Model 78 (C-47C / XC-47C, 1943).**
  - Each float was 42 ft long and 5 ft 8 in wide, displaced 29,000 lb, and carried a 325 US gal tank. Retractable
    wheels sat in the floats. The water rudders were linked to the air rudder.
    - https://www.secretprojects.co.uk/threads/douglas-edo-xc-47c-a-gooney-bird-on-floats.17407/
    - https://www.strijdbewijs.nl/birds/dc3/dakota2.htm
  - Sources disagree on the designation (78-28000 / 29000 / 29400) and give about a ton a float:
    https://digitaleditions.walsworth.com/article/Briefs/4910554/838053/article.html
  - N130Q, a DC-3 on the last surviving EDO Model 78s, flew again at Greenville, Maine on 5 Sep 2025:
    - https://vintageaviationnews.com/vintage-aviation/worlds-only-dc-3-on-floats-takes-to-the-skies.html
    - https://www.aopa.org/news-and-media/all-news/2025/september/11/just-really-really-fun
- **Deadrise.** NACA TN-716 (1939) tested V-bottom floats at 20, 25 and 30 deg of deadrise:
  https://ntrs.nasa.gov/citations/19930081485
- **The flat-deck PK** (the user's second reference, the Super Legend):
  - PK hulls are a deep V with straight sides and a flat top. PK chose flat skins because compound curves are hard to
    repair in the field.
  - The PK 2050A is the Super Legend's amphibious float:
    https://generalaviationnews.com/2022/01/05/pk-floats-introduced-for-super-legend-cubs
- **Not found.** No source gave the dome's height, a deadrise figure for an EDO, or a full dimension table. Every EDO
  row's height is fitted (`est`, see the catalogue).

## Names proposed (the user picks)

The style row reads **"EDO classic (round top)"** for now. The proposals:

1. **EDO classic**
2. **Bush float**
3. **Round-top**

## A third family?

No third deck style. A PK float is a flat deck on a flat-skinned deep V, and the Wipline style already is one. What
makes a PK a PK is the amphibian: retractable wheels in the hull and a nose wheel in each bow. G451 left that owed.
When the amphibian is built, the PK rows (PK 2050A for the Super Legend) become presets on the Wipline style. That keeps
two styles and no headache.

## What changed in the physics

The style is three numbers on the float record. They are absent on every Wipline, so a Wipline hull is master's, to the
bit (the gate pins it).

- `crownK` 0.16 is the dome. The centreline stays at the deck line and the edge sits 0.16 H below it, joined by a
  quarter ellipse.
- `bowDrop` 0.12 rolls the deck down over the forebody's front half to a lower nose.
- `noseMul` 1.8 enlarges the nose round.

The physics section is the same family, so it carries the dome. The drawn hull is the physics loft's within 0.10 % of
volume, so buoyancy, the reserve (`floatAdvice`) and `levelVolume` read the drawn hull. The bottom (deadrises, keel
flat, step, afterbody) is the rows'.

Measured in node, with the hydroplane run's own loop:

| build | style | volume a float to the deck | reserve | rest trim | least deck-edge freeboard | lift-off |
|---|---|---|---|---|---|---|
| PA-18 floats (builds/pa18_floats_2026-10-23.json) | Wipline 2100 | 1171 kg | 3.12 (the advisor: oversized, > 3) | -0.9 deg | 12 cm | 22.7 s, 236 m |
| same rows | EDO classic | 1115 kg | 2.96 | -0.6 deg | 3 cm | 22.6 s, 235 m |
| Cessna floats (bugReports/cessnaFloatsWOrks.json) | Wipline (custom) | 1012 kg | 2.13 | 1.1 deg | 0 cm | 23.7 s, 350 m |
| same rows | EDO classic | 955 kg | 2.01 | 1.2 deg | -4 cm (stern edge awash) | 23.5 s, 348 m |
| DC-3 candidate on EDO 78-28000 | EDO classic | 13,154 kg | 2.47 (10,702 kg) | 2.1 deg | 0.6 cm (stern edge) | 43.3 s, 37 m/s, 804 m |

The dome takes the deck's corner off: about 5 % of the volume, and a lower deck edge. The crown still stands crownK H
over that edge. The hump and the lift-off are unchanged within 1 %.

## The DC-3 on EDO 78-28000s

The candidate is builds/candidates/dc3_2026-10.json, with its old float record cleared.

- **The floats.** The catalogue's row: 12.80 x 1.73 m, H 1.15 m at the step. The fit puts 23.8 deg of deadrise at the
  step and the pair holds 26,449 kg to the deck.
- **The rigging.** Half track 2.6 m, under the nacelles. The keel sits 2.9 m under the belly, which leaves the 3.4 m
  props 0.55 m over the decks.
- **Floats at gross, reserve 2.47.** The pair holds 2.47 times the 10,702 kg all-up mass (1.8 needed).
- **Stands afloat** at 2.1 deg nose up with 0.72 m of keel draft. The props are dry.
- **Taxies** 127 m in 30 s at a quarter throttle.
- **Lifts off** in the hydroplane run at 43.3 s, 37 m/s, after 804 m. The hump is R/W 0.13 at 16.5 m/s.

The normaliser widens its bounds only for a record that says `style: 'edo'`:

- L 12 to 16 m
- B 1.6 to 2.2 m
- H 1.5 to 2.0 m
- mFloat 600 to 2000 kg
- wrArea 0.6 to 1.2
- wrDepth 0.8 to 1.4
- scale 3 to 4
- xAft 2 to 3
- track 2 to 4
- y -2.5 to -4.5
- x 6 to 12

The editor's sliders are wider for every style; a slider's range never changes a saved value:

- fltL 14
- fltB 1.9
- fltH 1.5
- fltMass 1200
- fltTrack 3.5
- fltDrop 3.0
- fltStrutR 0.09
- fltSpreadAft 2.4

## Cost

- **Draw count.** The float layer of the PA-18 build, headless (tools/_scene_headless.js):
  - Wipline: 19 meshes, 11 materials.
  - EDO classic: 17 meshes, 9 materials. The two non-skid decks are gone.
  - EDO with the board: 18 meshes, 10 materials.
- **Shaders.** No new shader program. The aeroskin hook's source is the program key, and no GLSL changed. The rivets
  and seams are the existing structure grammar at an EDO's bulkhead pitch: a seam every 0.6 m along, a row every 0.3 m
  round, times the square root of the scale on the big floats. A first cut at 0.45 x 0.17 m read as reptile scales.
- **The new finish.** The mismatched skins and the wear are a new finish row, `agedAlu`, with one new sheet bake,
  'panels': two skins a 2.4 m tile, each its own shade eased in as colour (not relief), a faint lap seam and a few
  scuffs. That is one texture.
- **Phone.** The lite tier drops the rivets and the field, as it does on every skin. The sheet stays: the skin fetched it
  anyway.
- **Frame time.** No frame was timed: this is SwiftShader, and parked_cook was not needed for a frame measure that was
  never made.

## Pictures

All from `node tools/plane_shot.js` (the phone profile's studio, SwiftShader, `&idle=0`; the 3/4 and side views cropped
to the aeroplane's box the rig reports), except the water stills. The q / s / bow views are orbit:-143/14/17, orbit:-90/3/14 and
bow:-145/12/3 (the DC-3 at 42 / 46 / 3 m).

| file | what |
|---|---|
| `pa18_wipline_q.png` / `pa18_edo_q.png` | the PA-18 floats build, 3/4 front: Wipline 2100 vs the same rows in EDO classic |
| `pa18_wipline_s.png` / `pa18_edo_s.png` | the same, side |
| `pa18_wipline_bow.png` / `pa18_edo_bow.png` | the bow close-up: the flat deck and its non-skid against the dome, the fat black bumper, the bare aged skins and their seams; the board across the spreaders |
| `c172_wipline_q.png` / `c172_edo_q.png`, `_s`, `_bow` | the user's Cessna floats build, the same three views |
| `dc3_edo28000_q.png`, `_s`, `_bow.png` | the DC-3 candidate on EDO 78-28000s |
| `water_pa18_edo_abeam.png`, `_bow`, `_quarter` | ON THE WATER: the PA-18 floats build in EDO classic, rolled out onto the SEA lane through the game's own door (the build as the work in progress, the roll-out), paused where it sits, three free-camera eyes; `node tools/float_water_shot.js` (headless SwiftShader, the full game world - its boot took ~20 min here; the photo panel cropped off the left) |
| `contact_*.png` | the pairs side by side |

## Gates

The gates run on this branch:

- **New:** FLOATSCLASSIC (core, 17 checks) and FLOATSCLASSIC-WATER (full, 9 checks). Both PASS.
- **PASS:** FLOATKIT, FLOATS, SEAPLANE, HYDRODYN, HYDRO, WIPLINE, JOIN, SAVE, PARTS, DESIGN, CAGEFIT, SKINMAT,
  UISMOKE, UISMOKE-PHONE, STARTER, LIVERYREACH, SURF, BUILD.
  - SKINMAT passes because `agedAlu` joined the bare-metal list.
  - PARTS passes because the new rows and sections are claimed by the Floats part.
- **Red on this branch and on a clean origin/master, the same lines on both** (gates_master.txt):
  - CLIP: navAerial into edFinSkin by 9.2 mm on stock+ifr.
  - JOINPARITY: 3 rows (the twin floatplane's float station, the metal Cessna fixture, raw-flying tools).
  - LIVERY: `garageFloodArm is not defined` in the gate's own harness.

Logs:

- `gates_final.txt`: the last battery on this tree (22 gates, jobs 2): 20 PASS, with LIVERY and CLIP the master
  standing reds.
- `gates_branch.txt` / `gates_branch2.txt`: the first runs. Two notes:
  - FLOATSCLASSIC reads FAIL in branch2's summary over a PASS line, because its verdict line carried a count suffix the
    runner does not accept. That was fixed in 6ebee62c.
  - SKINMAT and PARTS were fixed after branch1.
- `gates_master.txt`: CLIP, JOINPARITY and LIVERY on a clean origin/master adb2d2a9.
- `floatsclassic_water.txt`, `water_runs_node.txt`: the water runs.
