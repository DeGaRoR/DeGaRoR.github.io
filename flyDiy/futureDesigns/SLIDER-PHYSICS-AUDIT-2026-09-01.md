# SLIDER ↔ PHYSICS AUDIT (2026-09-01)

Every editor row and design tile, cross-referenced against what the flight
model actually reads. Purpose: mark the cosmetic rows (asterisk), and decide
which of them should stop being cosmetic. Authority for the mechanism is the
G45 declared table (HANDOVER) as amended through G54, G115, G116, G121 and
G131; this document is the row-level census against the code as of today.

NOTE: G131 (spec.prop.D/blades/material from the drawn blade, and
spec.gear.suspension from the mains' shock row) landed in _cage_join.js
TODAY by a concurrent session — this audit reads the tree, not the last
commit.

## THE MECHANISM (how a row reaches the air, or doesn't)

A row is physics-bearing through exactly one of two doors in
tools/_cage_join.js, or it is cosmetic:

- **JOINED** — the panel param is written into a spec field the generator
  chain (clampSpec → resolveSpec → genFrame → genStrips → genParams) reads.
  The solver itself reads only the generated def (params/nodes/beams/strips)
  — never the spec — so "physics reads it" always means "61/62 read it while
  building the def".
- **MEASURED** — the row shapes the built cage, and the join measures the
  cage through a contract (sections, contacts, named rings, placed tail
  layers) into a spec field. So a shape row is physics-bearing iff it moves
  a measured quantity.
- **COSMETIC** — the row changes only what you see. The shape still rides in
  spec.cage (the save keeps it), but NOTHING in src/core reads spec.cage;
  same for spec.finish and the paint/decal/wear surface.

Mass is entirely spec-derived (beam linear densities, cover areas on the
lattice, point masses: wheels/occupants/fuel/systems/engine+prop). No mesh
volume anywhere becomes a kilogram — so a dress row can never smuggle mass.

## MEASUREMENT DATUM WORTH KNOWING

The join's x-datum is the FIREWALL = the windscreen-base ring (wsFront).
So `wsRun` (windscreen run) MOVES THE DATUM and with it tailArm, noseGap,
cab.len, gear stations, wing xLE — a "window" row that is genuinely
physics-bearing. The inverse surprise: the NOSE group (noseLen, noseW,
noseH, droop, crown) sits forward of the datum and is measured by nothing —
the drawn nose is pure set dressing; frontal drag prices cowlDeck + cabin
section instead.

---

## THE CENSUS, GROUP BY GROUP

Legend: **PHY-J** joined · **PHY-M** measured · **COS** cosmetic ·
**ADV** advisory/bench-verdict only (not flown) · **VIEW** viewer state
(G106: guarded OUT of the snapshot; not part of the aeroplane at all).

### 6 · wings (_cage_wing.js) — 27 rows, 23 physics
| rows | class |
|---|---|
| wingOn, wgPos, wgSpan, wgChord, wgChordTip, wgTip, wgCrankAt, wgDihedralOut, wgSweep, wgDihedral, wgIncidence, wgWashout, wgCamber, wgThick, wgPanels, wgCons, wgBrace, wgFlapType, wgFlapSpan, wgFlapChord, wgAilSpan, wgAilChord | PHY-J |
| wgDx (→ measured wings[0].xLE) | PHY-M |
| wgCentre (solid/glass/open — read only by the skin) | COS |
| wgDy (height trim; place.dy is never written — position high/mid/low owns the flown height) | COS ⚠ looks physical |
| wgStrutZ, wgStrutX (strut FOOT placement; bracing.type is what flies) | COS |

### 8 · fin + 8b · stab (_cage_fin.js / _cage_stab.js) — ~75 rows, ~45 physics
| rows | class |
|---|---|
| outline corners (finTipZ/Y, finAftZ/Y, finBaseZ/Y and st* equivalents), rows & points (all 8 + 8), TE rows (root notch + bulges), stX/stY/stZ position, finOn/stOn, finProject | PHY-M — the join measures span/chord/station/apex off the placed layers' actual vertices (G54.3) |
| finCons, stCons | PHY-J (tail.finMaterial/.stabMaterial → mass, stiffness, Cd0) |
| finDorsal, finKeel, root guards, finCut/finCutGap, stCut/stCutGap, solid/thickness rows (finSolid/finThick/finThickTE, st*), tailRimN, all sharpness rows, dorsal creases | COS |

⚠ finCut/stCut (rudder/elevator hinge + horn) are COS while the flown
elevator/rudder authority comes from spec-default control chords
(genTauAt) that NO editor row writes — the cut rows are the natural
future author of controls.elevator/rudder chord.

### 9 · undercarriage (_cage_gear.js) — ~70 rows, ~14 physics
| rows | class |
|---|---|
| gearOn, s1On/s2On, s1Z/s2Z (stations → gear.x/twX), s1X (track), s1R/s2R (→ wheelR/twR → the solver's contact radius), s1Drop (stance → measured gear.y) | PHY-M |
| s1Fair, s2Fair (drag price), s1_shockKind (→ gear.suspension since G131) | PHY-J |
| s1Leg/s2Leg (leg kind: shapes contacts → weak PHY-M; the ARCHETYPE k/c now follows the shock row, not the leg row) | mixed |
| all leg dress rows (~40: beam blade, link tubes/V/X, oleo scissor, tailwheel spring/horn...), wheel dress (~9: carcass, tread, bulge, ribs, rim, bolts, cap, valve, whBrake) | COS |
| s1Brake/s2Brake (fitted switch — solver brakes off surface μ regardless), s1Steer/s2Steer (twSteer sign derives from gear.type, not this select) | COS ⚠ look physical |
| cgZ, cgY, propR, propZ (balance + prop) | ADV — they steer the bench's CG-angle/nose-load/clearance verdicts, not the flown plane; file's own note says cgZ/cgY should become derived |

⚠ tundra balloon carcass changes the LOOK only; the radius row is what
prices contact height. Rolling drag (CRR) is the surface's, never the tyre's.

### 2 · engine (_cage_eng.js) — ~70 rows, 4 physics
| rows | class |
|---|---|
| engPreset | PHY-J — THE engine row: the registry key carries mass, power, aspiration, price |
| cw_propD, cw_bladeN, cw_material | PHY-J since G131 — the drawn blade flies (D → Tstatic + propwash radius; blades → thrust fm + mass; material → blade mass) |
| engPower, eng_arch, eng_cyl, eng_bore, eng_stroke, eng_rpm, eng_volts, eng_twoStroke, eng_liquid, eng_geared, eng_injected, radiator rows, bay rows, dress rows (~50 total) | COS ⚠ the bench readout's mass/power follow these dials, but the FLOWN engine is the preset's registry row verbatim — the single largest looks-physical-isn't surface |
| engY (engine up/down — the join hard-codes place {dx:0, dy:0}; the flown thrustline is 0.36·cab.h) | COS ⚠ looks physical |
| nose cone rows (5), blade shape rows (chords, sweep, thickness, camber, cuff, shank, tip rounding), cw_rpm/cw_tas/cw_power/cw_slip (the blade's design point — labels, not the flight model's numbers), mount/firewall rows | COS |
| engDetail, eng_screws | VIEW (LOD) |

### 2b · cowl (_cage_cowl.js) — ~80 rows, 0 physics
Everything COS, declared since G45 (body, section, seam, apertures, lip,
scoop, bulges, fasteners, oil door, fitNose, cowlGap). Largest all-cosmetic
group in the editor. The flown frontal area prices fuselage stations +
cowlDeck, which are measured off the CAGE, not the cowl tool.

### 9 · fittings (_cage_access.js) — ~45 rows, 0 physics
accOn, five family switches, accDetail, 38 expert placement rows — all COS.
The fittings ride the save (layer params in spec.cage) but price nothing.

### 2e · lights (_cage_light.js) — ~20 rows, 0 physics
All COS (declared: no mass, no electrical load). li_beaconRpm is a real
rotation rate but of a visual.

### page5 fuselage groups (groupsOverride) — ~120 rows, ~45 physics
| rows | class |
|---|---|
| cabin dimensions (halfW, roofHalfW, roofY, keelY, pilotLen), ring extent rows (ringCabW, ringWinW, ringScrW, cowl widths, tops/bottoms), longeron extents (waistY... weakly), boom group (boomStyle, boomLen, tailLen, aftRoofY, aftKeelY, tailHalfW, tailRoofY, tailKeelY, taperOn/Len/W, rodY, rodD*), aft deck/aft cabin shape rows (via the measured boom profile), mirror | PHY-M — they move cabin.halfW/h/len, the nine-row boom profile, tailW/Bot/Top, tailArm |
| wsRun | PHY-M ⚠ — moves the firewall DATUM (see above) |
| paxCount, paxLen, seatLayout, dum2On | PHY-M — seating table, cabin length, occupants at 80 kg each (the second-dummy checkbox is an 80 kg switch) |
| intCons | **COS TODAY — THE AUDIT'S HEADLINE, see FINDINGS 1** |
| planeScale | PHY-M — scales every measurement; lives in "don't touch" (expert) |
| nose group (noseLen, noseW, noseH, droop, crown, tip rows) | COS ⚠ look physical — forward of the datum, measured by nothing |
| floorY, ceilInset, windows/canopy/bubble/skylight, doors, dash, cockpit, creases, rims, window frames, interior switches (intOn, intPillars, intFire, intBulk, bulkZ, skinOn, shellT, skinT), pillar widths + expert creases, topComp | COS |
| polycount rows (rimSides, rimArc, cw_detail) | VIEW (LOD) |
| crew & controls: seat pose, stick/throttle/pedal pose, console, dummy pose, dumSize (stature — the mass is 80 kg at every percentile), belts, markers | COS |

### design tiles (_cage_design.js) — 29 tiles, ~15 physics
PHY: seatLayout, paxCount, wgPos, wgBrace, planform, wgTip, wgFlapType,
engFamily, engModel, prop (sole author of prop.pitch), empennage
(tail.type), gearLayout, suspension, s1Fair, boomStyle, section (ring keys
→ measured).
COS: role, class, reg, canopy, seatType, scheme/base/trim, mirror (weak
PHY-M via the deck shape).
⚠ engCount: engines.length is clamped to 1 in clampSpec "until mounts are
real" — a declared tile whose extra engines don't fly.
⚠ intCons tile: writes the cage param only (FINDINGS 1).
retract: status 'declared', honest.

### decals / materials / view / hangar panels — ~90 rows, 0 physics
Decals (registration + two image channels), per-section finish/tint/tile/
rough/normal/wear dials, glazing dials, WEAR.amount, — all COS by design
(spec.finish; paint.job is priced in money, zero mass/drag). The `view`
group and `hangar` group are VIEW — not properties of the aeroplane;
G106's VIEW_STATE table exists precisely to keep them out of the snapshot.

---

## TOTALS

~550 rows on the whole editor surface (the editor's own comment says 537
for the root selection, before the design tiles).

- physics-bearing (joined + measured): **~165**
- advisory/bench-verdict: ~5
- view/LOD: ~10
- **cosmetic: ~370 (roughly 2 of every 3 rows)**

BUT the cosmetic mass is concentrated: cowl (~80), engine dress (~55),
gear dress (~50), fittings (~45), decals/materials (~50), windows/interior/
crew pose (~70), lights (~20). The groups a player thinks of as DESIGN —
wing, tail geometry, gear stations, fuselage dimensions, boom, engine
preset, prop disc — are overwhelmingly physics-bearing. The set dressing is
honest per G45's ruling; the problem is the ~15 rows that LOOK like
engineering and aren't.

## FINDINGS — rows that look physical but are not (the dishonesty list)

1. **intCons (construction) — the headline.** spec.fuselage.material is the
   single biggest physics row in the model: beam linear densities, cover
   mass, stiffness k/c (and via refMass the whole kScale), price, AND
   polarWing/polarTail/polarFin Cd0 + ClMax factor. The join never writes
   it. Worse: wgCons/finCons/stCons say "0 = as the aeroplane", and that
   resolves against the SPEC's default material — not against what the
   construction select shows. An aluminium-select aeroplane flies the
   loaded design's material. The fix is one join line (intCons's display
   order already maps to CONS4: carbon/tubeFabric/wood/alloy — the same map
   G116 used), but per the house rule it is an EDIT TO THE G45 TABLE first.
2. **The engine architecture surface (~50 rows).** Bore, stroke, rpm,
   cylinders, layout, two-stroke, liquid, geared, volts... engResolve's
   bench readout follows them; the flown engine is the preset registry row.
   Either these earn a declared "custom engine" join increment someday, or
   they are the most important rows to mark.
3. **engY (engine up/down)** — drawn thrustline moves, flown thrustline
   stays 0.36·cab.h (the join zeroes place.dx/dy).
4. **s1Steer/s2Steer** — the castor/linked/fixed select; the solver's
   twSteer derives sign and gain from gear.type alone.
5. **s1Brake/s2Brake, whBrake** — braking is the surface table's μ; no
   per-wheel brake model.
6. **The nose group** — forward of the firewall datum, priced by nothing.
7. **cgZ/cgY/propR/propZ** (gear bench "balance + prop") — advisory
   verdict inputs; the flown CG is computed, the flown prop is cw_propD.
8. **finCut/stCut hinges + horns** — cuts draw; control chords fly from
   spec defaults no row writes.
9. **wgDy, wgStrutZ/X, wgCentre** — wing trim/strut-foot/centre-section.
10. **dumSize** — 5th..95th percentile stature, 80 kg regardless.
11. **engCount tile** — clamped to 1 until mounts are real (declared).
12. **cw_rpm/cw_tas/cw_power/cw_slip** — the blade's stated design point;
    the thrust model derives its own operating numbers from the registry
    power + D.

## INVERSE FINDINGS — physics fields with NO editor author

Useful for "which sliders are MISSING" rather than "which lie":
fuel.litres + fuel.tank (nose/wing/panel — mass AND roll inertia; G45's
declared gap, still open — no row anywhere in the game UI), systems.fit,
cargo.kg/len, baggage, controls.elevator/rudder chords, prop.pitch (design
tile only, no editor row), gear.stiffness (spec knob, no row),
engines[].place/mount, tail.type outside the birth flow.

## USER RULING (2026-09-01) + THE "MAKE IT COUNT" PROGRAMME

The user's ruling on the audit: don't over-invest in marking (group-level
asterisks on the wholly-cosmetic groups are enough, done opportunistically);
the real work is wiring the things that SHOULD count. Named worries: canopy
shape, cowl shape (aero + cooling supply), the engine editor's dials
(simple-laws model to physics, + thermal cooling duty for later ventilation
sizing), stiffness-follows-material (verified: per-part works, the base
intCons wire is the broken link), body lift, whether cross-sections are
priced, fittings as small perturbations, consumption, and the dims box no
longer covering the full aeroplane.

### The verified state of the aero model (2026-09-01)

- Fuselage = three fixed-coefficient drag blobs (0.75·frontal, 0.57·fwd
  side, 0.31·aft side) positioned to weathervane, priced off the MEASURED
  sections (cabin + nine-station boom profile + tail section). SIZE counts;
  SHAPE does not (no fineness/form factor, no body lift).
- The canopy/windscreen glass IS in CAGE_MATS, so it is part of the
  measured skin: a taller bubble raises cab.h → frontal area → drag. Size
  only, again.
- The COWL layer is invisible to the measurement (cowlDeck is measured off
  the CAGE deck) — a drawn cowl of any size is aerodynamically free.
- Ground effect: modelled (wing strips only, tail excluded — declared).
  Propwash over wing/tail: modelled (washAt, stabWash/finWash). Torque
  reaction / P-factor / slipstream swirl: none.
- Fittings (all 19 GEN_ACCESS rows): zero drag, zero mass.
- Fuel burn: NOT modelled ("full-tanks case" declared twice in core); the
  G121 door (setNodeMass + mFuel) was built for it. Cruise speed/throttle
  ARE tunnel-derived from measured drag vs thrust — so consumption will
  inherit the aerodynamics the day burn lands.
- Mass is spec-side only. No mass: cowl, fittings, lights, interior dress,
  seats/dash (systems.fit is the abstraction), decals. Wheels are FLAT
  point masses (3.5 kg mains / 2-3 kg third) regardless of tundra size;
  glazing is massed as generic skin covering.
- Dims box: measureBox (_cage_ui.js:803) iterates the CAGE mesh only —
  wing/tail/gear/prop/cowl never set a dimension. Not spec-sheet numbers.

### Programme, in priority order (each = G45 table edit FIRST, then code)

1. **Wire the base material** — intCons → spec.fuselage.material (display
   order already maps to CONS4). Bugfix-grade; makes the whole per-part
   material system's "as the aeroplane" honest.
2. **The engine speaks for itself** (user's two steps). Step 1: the bench's
   engResolve already computes mass/power/torque from the dials — carry
   that dict into the spec as a custom powerplant row (the preset becomes
   the starter it always claimed to be). Converts ~50 cosmetic rows.
   Step 2: from the same simple laws, SFC and a COOLING DUTY (kW to
   reject as f(power, efficiency, air/liquid)) — published on the plaque,
   consumed later by the cowl arc.
3. **Burn + consumption** — SFC × delivered power through the G121 door;
   L/h, endurance, range at the tunnel-derived cruise point on the plaque.
   This is where aero starts paying in gameplay (small engines, range).
4. **Fuselage aero honesty** — (a) form factor from fineness ratio (the
   measured profile already carries length/width/height — the shape data
   exists, unpriced); (b) body lift strips (deep-alpha STOL behaviour);
   (c) the cowl joins the measurement (its max section rides into the
   drag build as a delta, the gear-drag pattern); (d) cooling drag from
   cowl apertures ↔ the cooling duty of arc 2 — the ventilation-sizing
   game: too little aperture overheats, too much costs cruise.
5. **Fittings CdA** — one column in GEN_ACCESS's declared table; every
   aerial/venturi/step/handle a small CdA. Cheap, makes the switches count.
6. **Spec-sheet dims** — measureBox unions every exterior layer (wing,
   tail, gear, prop, cowl); length/span/height as a type-certificate
   sheet would quote them. Display-honesty, not physics.
7. Opportunistic mass honesty — wheel mass from radius/carcass, glazing
   vs skin covering. Low priority.

### Rough edge CLOSED (2026-09-01): G132's suspension wire read s1_shockKind
### (default bungee) on every leg kind, so an oleo LEG flew bungee suspension.
### G133 took the precedence into _cage_join.js (s1Leg 0 -> spring, 2 -> oleo,
### link legs -> the shock row) with rows in _join_check. Nothing owed here.

## RECOMMENDATION FOR THE MARKING (step 2, not yet done)

- Drive the mark from ONE declared set, not per-file edits: the row grammar
  already funnels every row through mkRow (_cage_ui.js:1163, ROWMETA), so a
  single PHYS/COS table — the G45 table as code, next to the join —
  can suffix the label (the user's asterisk) at render time. _parts_check
  can then gate: every row is in the table, no row is in both halves —
  the same "honest against the real row list" trick the parts tree uses.
- Mark at the GROUP level where a whole group is cosmetic (one mark on
  "2b · cowl" covers 80 rows; same for fittings, lights, decals,
  materials) and row-level only inside mixed groups (wing: 4 rows; gear:
  the dress; page5: windows/interior/nose).
- The dishonesty list above should NOT simply get asterisks — each is
  either (a) wired (intCons is a one-liner + table edit; engY is
  place.dy = P.engY), (b) declared with its asterisk, or (c) removed.
  That's a user ruling per row, per the G45 house rule.
