# FUSELAGE DRAG — a study: does the model see a body's shape? (22 Nov 2026)

The user, 22 Nov: *"we still have something not that great with qualifying very aerodynamic bodies ... How do we account
for a squarish form, or a very profiled aerodynamic shape? I'm wondering if we don't have a gap in there ... You can
have something like the LS4, and it's gonna get the same fuselage drag. Then you have a big thing there, the PC6 ... I
think we should actually try to build the law out of a few parameters of the fuselage, and we have them ... the
roundness bottom, roundness top ... the angle of the windscreen ... abrupt tapers ... a generic law that is anchored in
real physics ... And on the skin, that should really follow the construction material."*

- Branch `claude/physics-audit` (PHYSICS_V 10). **A study: nothing in the core is changed.**
- `node tools/physics_audit_body.js --audit=<physics_audit --json>` is the prototype (node-side). Its table:
  `reports/evidence/FUSELAGE-DRAG-STUDY-2026-11-22/body_law.md`.
- Units m². "Real" is the drag area the parent's book figures imply (PHYSICS-AUDIT section 4).

## 1. The answer

**Yes, the gap is there, exactly where you put it.** Today's fuselage row is

`wetted area x a coefficient per material x a fineness factor x a box factor`

and three of those four do not see the shape:

| what the law reads | what it does on the roster |
|---|---|
| the box factor (1 + 0.1 x (1 - crown)) | **1.058 on every card**: the PC-6, the DC-3, the Velis's pod, the Cub. Its two inputs are fixed constants on every cage build |
| the card's roundness rows (`topRound`, `botRound`), its shoulders (`roofHalfW / halfW`), nose and tail rows | **never read by the physics.** The join hands the core a width and a height per station. PC-6: 0.02 / 0.00. DC-3: 1 / 1. Same drag law |
| the windscreen | a fixed 0.02-0.03 m² whatever its size: the same on the DC-3's 1.0 m² of screen and on a 0.24 m² one |
| the coefficient per material | not a skin figure: a turbulent plate at these sizes is 0.0025. Alloy 0.005 and glass 0.0045 are twice that, fabric 0.0125 is **five times** it. Each carries "a typical aeroplane of that material". Fabric carries the Cub's whole calibration |
| laminar flow | does not exist, on the body or on a wing section (`0.0055 + 0.018 t` is a turbulent section) |
| the wing junctions | a fixed 0.017-0.033 m² on every aeroplane: a tenth of a percent of a DC-3, **a quarter of a sailplane** |

So the body's drag on its own frontal area comes out almost the same for everything metal or composite:
DC-3 0.12, 172 0.12, PC-6 0.14, Velis 0.11. A real round airliner body is about 0.08, a box about 0.2, a sailplane pod 0.04.

## 2. A law from the shape the card already carries (prototype)

Every term is a known piece of handbook physics. The constants are first values; only the windscreen's was set, so that
the Cessna 172 stays where it is.

| term | from | first value |
|---|---|---|
| friction | wetted area x the turbulent plate at the body's own length and speed | Cf 0.0021 (DC-3) to 0.0029 (Cub) |
| laminar share | a moulded skin, no propeller on the nose, a round section: the wetted share ahead of the largest section | friction x (1 - share x 0.85) |
| skin | what the construction leaves on the surface | moulded 1.08, wood 1.20, riveted alloy 1.30, fabric on tube 1.40, tent cloth 1.60 |
| form | fineness, as today | 1 + 60 / f³ + f / 400 |
| corners | `topRound`, `botRound`, shoulders | x (1 + 0.6 x (1 - roundness)²): a sharp box +60 %, a round body 0 |
| windscreen | its own frontal step (width x height over the cowl deck), by style | 0.12 a wrap-round screen, 0.05 a blown canopy; a rounded body halves it |

### What it bills (body + windscreen), and where the whole aeroplane lands

| plane | roundness | today | the law | change | whole aeroplane today → law | real |
|---|---|---|---|---|---|---|
| Cessna 172 (anchor) | 0.17 | 0.179 | 0.191 | +0.013 | 0.505 → 0.517 | 0.54 |
| Douglas DC-3 (gear down) | 1.00 | 0.686 | 0.475 | -0.211 | 2.83 → 2.62 (wheels up 2.33 → 2.12) | 2.20 wheels up |
| Stearman | 0.50 | 0.385 | 0.192 | -0.192 | 1.355 → **1.163** | 1.12 |
| Tiger Moth | 0.50 | 0.177 | 0.143 | -0.034 | 0.922 → **0.888** | 0.88 |
| Sopwith Camel | 0.50 | 0.160 | 0.128 | -0.032 | 0.909 → 0.878 | 0.82 |
| Archaeopteryx | 0.40 | 0.179 | 0.094 | -0.085 | 0.347 → 0.262 (glide 16.7 → 19.2) | 0.16 (28) |
| LS4 (by hand, its branch) | 1.00, laminar share 0.35 | 0.063 | 0.025 | -0.038 | 0.218 → 0.180 (glide 25 → 28) | 0.09 (40.5) |
| Velis, as its card says | 0.14 | 0.114 | 0.111 | -0.003 | 0.383 → 0.379 | 0.28 |
| Velis, its pod drawn round (0.8) | 0.80 | 0.114 | about 0.075 | -0.04 | → 0.34 | 0.28 |
| Pilatus PC-6 | 0.01 | 0.255 | 0.287 | **+0.031** | 0.981 → 1.012 | 1.7-2.0 |
| Piper Cub | 0.09 | 0.300 | 0.163 | **-0.136** | 0.820 → 0.684 | 0.85 |
| Carbon Cub, PA-18 floats | 0.09 | 0.300 | 0.16 | -0.14 | | |
| Chinook, Ruckus | 0.75, 0.05 | 0.155, 0.179 | 0.068, 0.104 | -0.09, -0.08 | | |
| Jodel, Petrel | 0.20 | 0.166, 0.174 | 0.153, 0.156 | -0.01, -0.02 | | |

## 3. What the prototype says

1. **It works where the shape is the story.** The three biplanes and the DC-3 land on their real figures without one
   of them being touched by hand. The Stearman's -11 % on top speed was never its radial: it was the fabric coefficient.
2. **It is the first half of the clean end, not all of it.** A sailplane's gap, taken apart (the LS4, 0.244 → 0.09):

   | item | m² | status |
   |---|---|---|
   | span efficiency (not drag area) | glide 19.5 → 24 | done, step 1 |
   | tail brace wires it does not carry | -0.026 | done, step 2 |
   | **fuselage: laminar pod, real friction** | **-0.038** | this study |
   | **wing and tail sections: laminar, not turbulent** (0.0110 on the wing area against about 0.006) | **-0.045** | not built: the larger half |
   | junctions and canopy sized to the aeroplane, a faired junction | -0.025 | not built |
   | a retracted or faired monowheel | -0.012 | card and gear row |
   | **what is left** | **0.10, glide about 37** | against 0.09 and 40.5 |

   So the glide of the slim planes needs three things together: this body law, a **laminar section** for a moulded
   wing, and the small fixed rows made to scale. No one of them delivers it.
3. **It does not find the PC-6.** A brick with a faired nose and a tapered tail, flying straight, is not three times a
   round body: the law gives +0.03, and with the hardest defensible figures (corners +100 %, an upright flat screen at
   0.3) about +0.15. Sharp corners cost where the flow has to turn: at the windscreen, at the tail's closure, and in
   climb, where the body sits at an angle (about 0.01 m² more for the box than for a tube at 6 degrees). The PC-6's missing
   0.7 m² is not its section.
4. **It un-hides the Cub.** The fabric coefficient was the Cub's calibration, so a physical fabric skin makes every
   Cub-like card 0.14 m² too clean (the Cub 0.82 → 0.68 against a real 0.85). That drag is real and has to be found as
   what it is: on a J-3, the cylinders standing out of the cowl (its `heads` row reads 0 today), the bungee gear's
   truss, the open cabin. **The Cub and the PC-6 then ask the same question: what sticks out.**

## 4. Proposed

| # | what | where | cost |
|---|---|---|---|
| A | The body law of section 2, reading `topRound`, `botRound`, the shoulders, the screen's own size and style | `62_gen_aero genFusCdA`; the join passes the three rows (they exist) | build time only: one number per build, nothing per frame |
| B | **Breaks in the outline**, found from the stations: a jump in the slope between two rings (a step), and a closure steeper than about 12 degrees (the flow leaves; the area behind it is billed as a base). This is what makes an abrupt taper or a slab-ended pod cost, and what rewards a player for fairing it | the same function, on the rings the frame already has | build time |
| C | **Skin by construction**, apart from shape: the five figures above, then a finish row where a card warrants it (flush or round rivets; fabric on stringers or on bare tube) | materials table | a table |
| D | **A laminar section** for a moulded wing or tail: profile drag by the section's family and the skin, lost behind a propeller | `genPolar` | a table |
| E | Junctions and the canopy **sized to the aeroplane** (the root chord, the screen's own area), with a faired / bare choice | `genFusCdA` | none |
| F | **What sticks out**, itemised: cylinders outside the cowl, exhaust stubs by their own size, an exposed gear truss, external hinges. Each a row with drawn geometry behind it | the cards and their rows | per card |

**Order and the band rule.** A, C, D and E move the clean end and the biplanes toward their figures and leave the 172.
A and C move the Cub family **away** until F is done on them, so A + C + F(the Cub's cylinders) must land together, on
one PHYSICS_V bump, with the Cub as the gate: 0.82-0.85 m², 140 km/h. The PC-6 is F's test case and stays red until F.

**The incentive it gives a builder** (the same 172-sized body): square it off fully +12 % body drag; round it fully
-33 %; a blown canopy instead of a wrap-round screen -0.03 m²; a moulded pod with the engine behind it a further -25 %.
Today each of those is worth nothing.

## 5. The slider review (the user, 22 Nov: "have a review of the existing sliders ... parameters that would allow you for a better estimation that we wouldn't have thought of")

All 1,579 editor rows were listed with their groups, labels and choices (the panel loaded in node, as GATE PARTS does)
and their values read on eight cards. What follows is every row that could feed a drag term. **"Read today" is whether
the physics reads it for drag.**

| drag term | rows the cards already carry | read today | what it would give |
|---|---|---|---|
| **The section's corners** | `topRound`, `botRound` (0-1); **the crease rows `crSill`, `crKeel`, `crCeil` (0-3: soft to sharp)**; the top's two angles `topAngCeil`, `topAngRoof`; `noseKeelSq` | no | The user's distinction exactly: a square with soft corners (creases 0) against a square with sharp ones (creases 3). The Velis has creases 0 / 0 / 0 on a low roundness; the PC-6 a keel crease of 3; the Archaeopteryx 3 / 3 / 3 |
| **The section along the body** | seven frames (nose, windscreen, door post, cabin, passenger, boom, tail), each with top / waist / bottom heights, three half-widths and three fore-aft offsets: 60 rows | only a width and a height per station | The true area and perimeter along the body: the wetted area, the fineness, **every step between two frames, and the closure angle**. "Lack of discontinuity" is measurable |
| **The pod and its pinch** | `boomMidOn` (pod ring), `boomMidPinch`, `boomMidPinchW`, `boomRound`, `boomRoundAt`, `boomSquare`, `boomStyle` (lofted skin, rod), `boomNoseK` and `boomTailK` (cone to ogive), `boomNoseCap` / `boomTailCap` (point, flat, round), `boomCollar` | no | The teardrop: a pod that pinches smoothly into a boom (the Velis: pod ring on, pinch 0.38, round boom) against a body cut off at a bulkhead with a tube stuck in it. A flat cap is a base |
| **The tail's closure** | `taperOn`, `taperLen`, `tailDrawn`, `aeroAftOn`, `aeroAftLen`, `aeroAftTip` (dome to teardrop), `aeroAftShape` (cone, blade, flat, fin), `aeroAftEdge` (the base's edge), `tailLen` | no | Whether the body closes to a point, to a blade, or ends flat, and how fast |
| **The nose** | `noseFinish` (firewall, aerodynamic), `aeroNose` (windscreen fold, full rings), `aeroLen`, `aeroTipW`, `aeroTipH`, `aeroRound`, `noseDome` (cone to dome), `noseTip`, `crNoseCap` (tip sharpness), `noseDroop` | no | Cowl against aero nose: a firewall-and-cowl front, or a faired front with no engine face |
| **The cowl's face** | `cowlOn`; inlets `cw_apMode` with their sizes; `cw_lipMode` (plain cut, rolled lip); the chin scoop (on, size, rake, mouth); side gills; `cw_aftMode` (blend into the fuselage, nacelle tail cone); the spinner (`cw_spinR`, `cw_spinLen`, `cw_spinRound`) | the inlets and outlets, for the cooling flow only | A spinner that fills the cowl's face fairs the nose; a scoop and gills are bodies standing in the stream; a cut lip against a rolled one |
| **The canopy** | `canopy` (closed, convertible, open, **bubble**), `bubble` (glass ceiling), `bubH`, `bubAt`, `bubW`, the canopy loops; **`wsRun` and `wsTopOff` (the drawn rake)**, `wsBaseBow`, `wsCeilBow` (its curvature), the shoulder rows; `rimW`, `rimRise` (how proud the frame stands), `winDepth` (window recess) | only "bubble or not", and a cowl-deck height | The screen's true frontal step, its rake and its curvature; whether the glass is the body's own contour (no step at all) |
| **An open cockpit** | `cpOpen`, `openCut`, `openFore`, `openAft`, `openRim` (coaming), `openScreen`, `openScreenH`, `openScreenRake` | a fixed figure per seat | The hole's own size, with or without a screen ahead of it |
| **Skin and finish** | `intCons` (composite, steel tube, plywood, aluminium, aluminium tube, glassfibre, soft shell); **`wgCons` per wing** (carbon, fabric on wood, aluminium, glassfibre, fabric on aluminium spar, D-tube ...); `memFast`, `memDia`, **`memRise` (how far the screw heads stand)**; `accDetail` (fastener density); `rimRivet`; the cowl's camlocs and its panel joint (`cw_seamType`: groove, or a step standing proud) | the material, as one coefficient | Skin split from shape. Flush against proud fasteners is already a slider |
| **Where laminar flow ends** | everything above, and: a propeller on the nose or not (the engine's mount), the first panel joint or step, the wing's construction, the hinge line | no | A light laminar model needs only a transition point per body and per surface: the first of a propeller's wash, a step, a joint, or the section's own limit |
| **The wing section** | `wgThick`, `wgCamber`, `wgCons`, `wgTip` (nine tips), `wgCentre`; flaps `wgFlapType` (plain, **slotted**, Fowler, split, STOL), `wgFlapSpan`, `wgDroop`; `wgSlat`; `stThick`, `finThick` and their **trailing-edge thickness** | thickness, camber, material, tip, the slat | A slotted flap's open slot, a blunt trailing edge, the construction's limit on laminar flow |
| **What sticks out of the wing and tail** | **`hgFamily` (as built, strap, piano, bracket), `hgCount`, `hgSize`, `hgFair` (hinge fairings), `hgHorn`, `hgHornLen`, `hgLink` (pushrods and cables outside)** | no | External hinge brackets and horns, counted and sized as drawn: the PC-6's question, as rows that exist |
| **The undercarriage** | the leg `s1Leg` (beam, link, oleo, tailwheel, trailing link); a beam's blade width and thickness; `s1_linkVee`, `s1_linkX` (crossed struts), `s1_linkAxle` (cross axle), `s1_linkAxleX` (cross wires); the shock (`s1_shockKind`: coil, bungee, rubber, oleo; `s1_oleoDia`, `s1_oleoBrace`); `s1Fair` (none, spat, trousers), `s1LegFair`; the tyre (`whProfile`: tundra, slim, bicycle; `whWide`); the brake; `gearDoors` (open well, one, two), `gearLegDoor`; skis | the wheel's radius, the fairing, the leg's drop as one 50 mm tube, a trailing link's strut | Today a spring-steel blade (the 172), a bungee truss of six tubes and an axle (the Cub) and a long-stroke oleo tripod (the PC-6) are all "one 50 mm cylinder as long as the leg's drop". The drawn members can be billed one by one |
| **The exhaust** | `eng_exStyle` (off, stacks, collector, expansion, ejector stubs on the side), `eng_exDrop` (how far the stacks hang), `eng_exPair`, `eng_exOut`, the outlet's position | a fixed 0.003 m² a stack, two or four an engine | The stubs by their own number, length and direction |
| **The engine in the wind** | the cylinder rows and `cowlOn` with its covers | only when the cowl's sides are off | The J-3's cylinders standing out of its cowl (its `heads` row is 0 today) |
| **Fittings** | `accAerials`, `accHandling` (steps and handles), `accInstr` (the pitot), `accBeacon`, `accFluids`; landing and taxi lamps with `li_podLen`, `li_podGirth`; `towHook`; `wgTipSkid`; the floats' spreader bars, cross wires and ladder | no | Small, but they are a clean aeroplane's whole excrescence bill, and each is a switch |

### What the review changes in the plan

1. **Corner sharpness is its own input, apart from roundness.** The crease rows say how sharp each longeron's edge is.
   The law's corner term becomes `(1 - roundness) x sharpness`, so a soft-cornered square costs little and a
   sharp-edged one costs the full figure.
2. **The body is read from its frames, not from two roundness numbers.** The area and perimeter curve along the body
   gives the fineness, the steps and the closure in one pass; the pod's pinch, the tail's cap and the nose's kind are
   then read where they act. This is what makes the Velis a teardrop and the PC-6 a box with a step at its screen.
3. **The canopy is read as drawn**: its kind, its rake (`wsRun`), its curvature and its frame's proudness. A bubble that
   continues the body's line bills no step.
4. **Two "what sticks out" families already exist as rows**: the control hinges and horns, and the undercarriage's
   members. They can be billed from the drawing with no new slider. The exhaust and the fittings likewise.
5. **Nothing new has to be asked of the player** for any of the five models. Every input is a row that is already
   drawn; today the drag reads about a dozen of them.

## 6. After the review: the body read AS DRAWN, and a light laminar section (prototypes, version 2)

The user, 22 Nov: *"the Velis ... has almost no steps, almost no vertical surfaces ... a profiled pod with a taper
section and a pinched boom, so it really looks like a teardrop. Is there a way we manage to get that? ... the more the
thing is really sharp angles, the more it should impact ... something squared but with rounded corners could be okay
... base yourself on real physics ... a whole laminar turbulent model, which is not too heavy."*

### 6.1 The outline reader (`tools/body_shape.js`)

It slices the body the editor draws (the cage, subdivided, with its creases: what the page shows) at 60 stations and
measures each section. No slider is interpreted: whatever the rows do to the shape is in the mesh.

| plane | sharp corners (share of the outline's turning in sharp edges) | fullness (rectangle 1, ellipse 0.79) | screen: steepest rise | closure | largest break | front face / largest section |
|---|---|---|---|---|---|---|
| Pilatus PC-6 | **0.61** | 0.98 | 61 deg | 8 deg | 17 deg | 0.60 (a cowl ahead) |
| Piper Cub | 0.34 | 0.92 | 35 deg | 9 deg | 7 deg | 0.44 |
| Super Petrel (a hull's chines) | 0.45 | 0.76 | 26 deg | 41 deg | 41 deg | 0.07 |
| Chinook (a pod cut off) | 0.34 | 0.70 | 41 deg | 58 deg | 59 deg | 0.03 |
| Cessna 172 | 0.17 | 0.89 | 44 deg | 13 deg | 9 deg | 0.54 |
| Stearman, Tiger Moth | 0.15 | 0.87 | open cockpits | 10-16 deg | 9-15 deg | 0.6-0.8 (an engine's face) |
| **Velis Electro** | **0.12** | 0.90 | 40 deg | 15 deg | 14 deg | 0.44 |
| Douglas DC-3 | 0.04 | 0.73 | 35 deg | 10 deg | 10 deg | 0.05 (an aero nose) |

The Velis reads as it looks: soft corners and one continuous taper, though its two roundness sliders are low. The PC-6
reads as a sharp rectangle from end to end with the steepest screen of the roster.

### 6.2 The body law on the measured outline

`friction x form x (1 + 0.9 x sharp)  +  0.7 x the stepped area  +  0.18 x the base area`

- **stepped area**: forward-facing area met *on a body* (not its own nose) at more than 25 degrees: a wall square to
  the flow counts whole, a 45 degree screen 0.39, a 30 degree one 0.09.
- **base area**: area closed behind the largest section faster than the flow follows (13 degrees), and an end left open.
- **laminar share**: to the first step, on a moulded skin with soft corners and no propeller ahead.
- **None of the three constants was fitted.** The Cessna 172 lands on its present figure by itself.

| plane | today | friction x form | corners | steps | base | the law | whole aeroplane today → law | real |
|---|---|---|---|---|---|---|---|---|
| Cessna 172 | 0.179 | 0.103 | 0.016 | 0.056 | 0 | **0.176** | 0.505 → 0.501 | 0.54 |
| Douglas DC-3 | 0.686 | 0.414 | 0.015 | 0.166 | 0 | 0.596 | wheels up 2.33 → 2.24 | 2.20 |
| **Pilatus PC-6** | 0.255 | 0.154 | 0.084 | 0.173 | 0.030 | **0.441** | 0.981 → **1.166** | 1.7-2.0 |
| Stearman | 0.385 | 0.106 | 0.014 | 0.070 | 0 | 0.191 | 1.355 → 1.161 | 1.12 |
| Tiger Moth | 0.177 | 0.064 | 0.008 | 0.070 | 0 | 0.142 | 0.922 → 0.886 | 0.88 |
| Sopwith Camel | 0.160 | 0.068 | 0.011 | 0.050 | 0 | 0.130 | 0.909 → 0.879 | 0.82 |
| Archaeopteryx | 0.179 | 0.053 | 0.019 | 0.016 | 0.013 | 0.100 | 0.347 → 0.269 (glide 16.7 → 18.9) | 0.16 |
| Velis Electro | 0.114 | 0.059 | 0.006 | 0.039 | 0.002 | 0.105 | 0.383 → 0.374 | 0.28 |
| Chinook | 0.155 | 0.042 | 0.013 | 0.085 | 0.065 | 0.205 | 0.655 → 0.706 | |
| Super Petrel | 0.174 | 0.108 | 0.044 | 0.008 | 0.018 | 0.178 | 0.527 → 0.531 | 0.59 |
| Jodel | 0.166 | 0.087 | 0.012 | 0.031 | 0.001 | 0.130 | 0.540 → 0.505 | |
| Piper Cub | 0.300 | 0.087 | 0.027 | 0.036 | 0 | 0.149 | 0.820 → **0.670** | 0.85 |

**What changed from version 1.** Read from its real outline, the PC-6's body nearly doubles (+0.19 m²): its sharp
corners (+0.08) and above all its upright screen on a box (0.17). The user's reading of that fuselage was right; the
roundness sliders alone hid it. It is still a third of the PC-6's gap, not all of it. The Velis's body is 0.105, its
screen 0.04 of that: its remaining excess is its three bare wheels (0.15 m²) and its wing.

### 6.3 A light laminar / turbulent section (`tools/physics_audit_section.js`)

`cd0 = 2 x Cf(Reynolds of the chord, xtr) x (1 + 2 t + 60 t⁴)`, the plate mixed at ONE transition point per surface.
`xtr` by construction (first values): a moulded shell 0.55, plywood or a D-tube 0.25, riveted alloy 0.10, fabric on
ribs 0.05; none in a nose propeller's wash or behind a slat. One number per surface, at build time.

| plane | wing skin | Reynolds, million | laminar to | section today | the model | whole aeroplane |
|---|---|---|---|---|---|---|
| Cessna 172 | alloy | 4.3 | 0.08 | 0.0092 | 0.0094 | 0.505 → 0.508 |
| Pilatus PC-6 | alloy | 5.0 | 0.08 | 0.0092 | 0.0092 | unchanged |
| Douglas DC-3 | alloy | 12.3 | 0.10 | 0.0087 | 0.0080 | -0.08 |
| Velis Electro | glass | 2.5 | 0.47 (some span in the wash) | 0.0081 | **0.0061** | 0.383 → 0.359 |
| Super Petrel | carbon | 1.9 | 0.55 | 0.0081 | 0.0058 | 0.527 → 0.487 |
| LS4 (by hand) | glass | 1.6 | 0.55 | 0.0088 | 0.0064 | -0.03 |
| Archaeopteryx | D-tube | 1.2 | 0.25 | 0.0081 | 0.0091 | +0.016 |
| Piper Cub | fabric | 2.9 | 0.04 | 0.0099 | 0.0110 | +0.026 |
| Tiger Moth, Stearman | fabric | 2.7-3.4 | 0.04 | 0.0099 | 0.011 | +0.035 to +0.04 |

The alloy wings land on today's figure without fitting, so the formula is the present one made to see the skin and the
Reynolds number. A small chord pays more than today (the Archaeopteryx, the fabric wings): that is real, and it means
the D-tube's laminar share (0.25 here) is the figure to source before it lands; the Archaeopteryx's 28:1 needs about 0.4.

### 6.4 The Cub's ledger (the gate for landing the body law)

| | m² | |
|---|---|---|
| the Cub today | 0.820 | real 0.85 |
| the body law | -0.150 | measured, 6.2 |
| its fabric wing at its own Reynolds number | +0.026 | measured, 6.3 |
| four cylinders standing out of the cowl | about +0.07 | the core's own `heads` rule, were the card's cowl sides open (estimate) |
| the gear's truss billed by its members (the cross struts, the shock struts) | about +0.04 | estimate; today one 50 mm tube a side |
| **the Cub then** | **about 0.81** | inside its gate |

## 7. Limits

- The constants are handbook orders of magnitude from memory (Hoerner's fuselage and windscreen chapters, the usual
  form-factor fits); none was re-read this session. Only the windscreen's figure was fitted, on the 172.
- The LS4 row is by hand from its evidence file (its card is on its own branch); the "Velis drawn round" row is an
  estimate. Everything else is the prototype's own run.
- Roundness is read from two rows and one ratio; the page's real loft would give the section's true perimeter and area.
- The prototype moves only the body and screen rows. Wing sections, junctions, gear and "what sticks out" are estimates
  in the tables, not prototypes.
- The windscreen's rake is on the card (the editor's `wsRun`) but the resolved spec's `wsAngle` is not the drawn one:
  the law here uses the style only. Wiring the drawn rake is part of A.
