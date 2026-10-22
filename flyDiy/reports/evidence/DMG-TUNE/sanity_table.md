# DMG-TUNE - the sanity table (G1897)

Each validated aeroplane in the standard crashes, damage ON with the certificate stamped: members broken by ledger section, plastic work, what came off - BEFORE (the base, claude/dmg-integration 4300dc5) and AFTER (this branch), with D1a's physics limits (no certificate) as a third column, against a plausible reference written in words. **Every source is as recalled - nothing was opened in this session; A0 opens them before a number becomes a gate.** The Cessnas fly JOIN-PARITY's page-loaded spec (READY on claude/join-parity-g1985: the engine 65 cm forward of node's file); the others the file as written. "plausible" is the rule written beside each reference (tools/dmg_tune_plots.js REF), checked mechanically - it is a floor, not a proof.

## 3 m/s taxi, trunk

**Reference:** A taxiing aeroplane meeting a tree or a post at walking-to-jogging pace: the propeller strikes (a prop strike: engine teardown per Lycoming SB 533 / Continental SB96-11), the spinner and the cowl dent, a leading edge dents if a wing meets it. No primary structure breaks; the engine stays on its mount.

*Sources (as recalled):* NTSB taxi-collision briefs (CA-class reports: "the propeller struck a pole/tree while taxiing", substantial damage to the propeller) - as recalled; DEFORM §7.1 #1

| build | before: broken (by section) / kJ / off | after: broken (by section) / kJ / off | physics only | plausible before -> after |
|---|---|---|---|---|
| the user's Cub | **0** (-) / 0.7 kJ / off: - | **0** (-) / 0.7 kJ / off: - | 0 (-) | yes -> yes |
| Jodel | **0** (-) / 0.8 kJ / off: - | **0** (-) / 0.7 kJ / off: - | 0 (-) | yes -> yes |
| metal Cessna | **1** (engines 1) / 2.7 kJ / off: - | **1** (engines 1) / 2.7 kJ / off: -; CRASHED (the airframe crushed (1.7 kJ of plastic work)) | 1 (engines 1) | yes -> yes |

## nose-over, 35 cm stump

**Reference:** The wheels stopped by a stump or soft ground at 8-12 m/s: the aeroplane pitches over onto its nose or its back. The propeller strikes and bends, the cowl and nose are crushed, the gear may be torn from the stump, the fin and rudder are crushed if it goes over; a wing tip or a strut may crease. The wings stay on and are not shredded; the engine stays on its (perhaps bent) mount.

*Sources (as recalled):* de Voogt & Louteiro 2024 (134 NTSB nose-overs, CC BY) and NTSB J-3 / PA-18 nose-over briefs ("damage to the propeller, rudder and vertical stabilizer"), AAIB G-BBPS (inverted) - as recalled, via DEFORM §7.1 #13 / §7.4

| build | before: broken (by section) / kJ / off | after: broken (by section) / kJ / off | physics only | plausible before -> after |
|---|---|---|---|---|
| the user's Cub | **50** (tail 40, gear 1, fuselage 7, vessel 2) / 3.9 kJ / off: - | **7** (tail 2, gear 1, fuselage 4) / 4.2 kJ / off: -; CRASHED (a gear member broke) | 7 (tail 2, gear 1, fuselage 4) | yes -> yes |
| Jodel | **97** (engines 10, bracing 10, tail 50, gear 15, fuselage 10, vessel 2) / 2.7 kJ / off: eng 111 kg; stab 13 kg; gearL 7 kg; gearR 7 kg; fin 5 kg; tw 4 kg | **3** (gear 3) / 1.6 kJ / off: -; CRASHED (a gear member broke) | 1 (gear 1) | NO -> yes |
| metal Cessna | **35** (engines 10, tail 16, gear 7, vessel 2) / 4.0 kJ / off: eng 239 kg; tw 8 kg; fin 8 kg | **7** (gear 7) / 4.0 kJ / off: tw 8 kg; CRASHED (a gear member broke) | 1 (gear 1) | NO -> yes |

## 30 m/s trunk, centreline

**Reference:** Into a tree on the centreline at 58 kt: the trunk stops the nose - the engine is driven back or torn from its mount, the firewall and cabin crush, the wings may tear off at their roots by their own inertia, the tail may separate. A non-survivable-class impact: a great deal breaks. The point here is only that it CRASHES and comes apart at its joints.

*Sources (as recalled):* NTSB tree-collision reports ("both wings separated, the engine displaced aft") - as recalled; NASA Langley GA crash tests (TP-1042, TP-1477, TP-1699: high-wing singles at ~25-27 m/s into soil, the engine bay and firewall crushed; NASA 20160006503 for the 172) - as recalled via DEFORM §7.1

| build | before: broken (by section) / kJ / off | after: broken (by section) / kJ / off | physics only | plausible before -> after |
|---|---|---|---|---|
| the user's Cub | **177** (engines 13, bracing 12, wings 24, tail 57, gear 15, fuselage 47, vessel 9) / 23.7 kJ / off: body 180 kg; eng 112 kg; body+fin 45 kg; wing0R 43 kg; wing0L 43 kg; stab 12 kg; +3 pieces | **125** (engines 13, bracing 12, wings 23, tail 29, gear 10, fuselage 29, vessel 9) / 27.4 kJ / off: body+stab+tw 140 kg; eng 112 kg; body 88 kg; wing0R 43 kg; wing0L 43 kg; gearL 8 kg; +2 pieces; CRASHED (broke up: the fuselage parted (TPB off the core)) | 50 (engines 13, wings 6, tail 5, fuselage 19, vessel 7) | yes -> yes |
| Jodel | **197** (engines 13, bracing 7, wings 26, tail 88, gear 15, fuselage 39, vessel 9) / 29.0 kJ / off: body 187 kg; eng 111 kg; wing0R 47 kg; wing0L 47 kg; stab 13 kg; gearL 7 kg; +3 pieces | **154** (engines 13, bracing 39, wings 31, tail 31, gear 15, fuselage 16, vessel 9) / 32.2 kJ / off: eng 111 kg; wing0R 47 kg; wing0L 47 kg; body 37 kg; gearL 7 kg; gearR 7 kg; +2 pieces; CRASHED (a fus member broke) | 52 (engines 13, bracing 4, wings 4, tail 22, fuselage 4, vessel 5) | yes -> yes |
| metal Cessna | **213** (engines 13, bracing 12, wings 24, tail 87, gear 15, fuselage 53, vessel 9) / 47.7 kJ / off: body 387 kg; eng 239 kg; wing0R 82 kg; wing0L 82 kg; stab 15 kg; gearL 9 kg; +3 pieces | **154** (engines 13, bracing 12, wings 24, tail 35, gear 15, fuselage 48, vessel 7) / 59.3 kJ / off: eng 239 kg; body 212 kg; body+stab 163 kg; wing0R 82 kg; wing0L 82 kg; gearL 9 kg; +3 pieces; CRASHED (broke up: the fuselage parted (TPB off the core)) | 83 (engines 13, bracing 2, wings 7, tail 53, fuselage 3, vessel 5) | yes -> yes |
| Cessna floats | **189** (engines 13, bracing 12, wings 23, tail 78, gear 20, fuselage 36, vessel 7) / 40.4 kJ / off: body 377 kg; eng 238 kg; wing0R 79 kg; wing0L 79 kg; floatL 40 kg; floatR 40 kg; +2 pieces | **167** (engines 13, bracing 14, wings 24, tail 55, gear 20, fuselage 34, vessel 7) / 51.8 kJ / off: eng 238 kg; wing0R 79 kg; wing0L 79 kg; floatL 40 kg; floatR 40 kg; stab 16 kg; +1 pieces; CRASHED (the airframe crushed (2.4 kJ of plastic work)) | 49 (engines 13, bracing 2, wings 2, tail 24, gear 1, fuselage 2, vessel 5) | yes -> yes |
| twin floatplane | **208** (engines 24, bracing 12, wings 23, tail 79, gear 20, fuselage 43, vessel 7) / 37.6 kJ / off: body 99 kg; engL 61 kg; engR 61 kg; wing0R 47 kg; wing0L 47 kg; floatL 28 kg; +3 pieces | **89** (engines 4, bracing 2, wings 27, gear 11, fuselage 40, vessel 5) / 49.6 kJ / off: body+fin+stab 29 kg; CRASHED (broke up: the fuselage parted (TPB off the core)) | 55 (wings 6, gear 4, fuselage 40, vessel 5) | yes -> yes |

## 30 m/s trunk, 2.5 m out

**Reference:** A wing meets a tree 2.5 m out at 58 kt: that wing is cut or torn - at the trunk, or at its strut / root fitting - and the aeroplane slews round the tree and meets the ground. That wing and the strut or bracing near it break; the gear, a wing tip, the propeller may take the ground. The engine stays on, the tail stays on, the far wing is not shredded.

*Sources (as recalled):* NTSB wing-strike reports ("the left wing struck a tree and separated outboard of the lift strut attach") - as recalled; DEFORM §7.4 "tree at speed" row

| build | before: broken (by section) / kJ / off | after: broken (by section) / kJ / off | physics only | plausible before -> after |
|---|---|---|---|---|
| the user's Cub | **118** (engines 11, bracing 12, wings 20, tail 44, gear 5, fuselage 18, vessel 8) / 13.5 kJ / off: eng 112 kg; wing0L 43 kg; body 19 kg; gearR 8 kg | **49** (engines 3, bracing 6, wings 27, fuselage 8, vessel 5) / 14.6 kJ / off: wing0L 43 kg; CRASHED (a wing member broke) | 17 (bracing 6, wings 4, fuselage 6, vessel 1) | NO -> yes |
| Jodel | **153** (engines 10, bracing 38, wings 28, tail 53, gear 15, fuselage 3, vessel 6) / 4.2 kJ / off: eng 111 kg; wing0L 47 kg; body 19 kg; stab 13 kg; gearL 7 kg; gearR 7 kg; +2 pieces | **96** (bracing 50, wings 21, tail 16, gear 9) / 5.1 kJ / off: wing0L 21 kg; gearL 7 kg; gearR 7 kg; fin 5 kg; CRASHED (a wing member broke) | 16 (tail 16) | NO -> **NO** |
| metal Cessna | **44** (engines 10, bracing 6, wings 6, gear 15, fuselage 6, vessel 1) / 18.6 kJ / off: eng 239 kg; wing0L 47 kg; gearL 9 kg; gearR 9 kg; tw 8 kg | **28** (bracing 6, wings 7, gear 15) / 16.9 kJ / off: wing0L 47 kg; gearL 9 kg; gearR 9 kg; tw 8 kg; CRASHED (a wing member broke) | 11 (bracing 6, wings 5) | NO -> yes |
| Cessna floats | **10** (bracing 6, wings 4) / 10.9 kJ / off: wing0L 48 kg | **10** (bracing 6, wings 4) / 10.9 kJ / off: wing0L 48 kg; CRASHED (an impact of 9 g) | 10 (bracing 6, wings 4) | yes -> yes |
| twin floatplane | **136** (engines 25, bracing 12, wings 14, tail 35, gear 20, fuselage 22, vessel 8) / 11.1 kJ / off: engL 61 kg; engR 61 kg; floatL 28 kg; floatR 28 kg; wing0L 24 kg; body+fin 18 kg; +3 pieces | **78** (engines 15, bracing 8, wings 17, gear 20, fuselage 17, vessel 1) / 18.3 kJ / off: engL 61 kg; body+fin+stab 29 kg; floatL 28 kg; floatR 28 kg; wing0L 24 kg; CRASHED (broke up: the fuselage parted (TPB off the core)) | 22 (engines 2, bracing 6, wings 4, fuselage 10) | NO -> **NO** |

## hard landing 1.5 x limit sink

**Reference:** A touchdown at 1.5 x the gear's limit sink (FAR 23.473's V, as recalled), no lift: past FAR 23.727's reserve (1.2 V, no failure). The gear may yield (a spread spring-steel leg, a bottomed oleo, a stretched bungee) or break at a lug; the airframe takes no set; a tricycle may strike its propeller.

*Sources (as recalled):* FAR 23.473 / 23.725 / 23.727 (as recalled); NASA 172 Test 1 breaks the gear at ~7 m/s (DEFORM §7.3)

| build | before: broken (by section) / kJ / off | after: broken (by section) / kJ / off | physics only | plausible before -> after |
|---|---|---|---|---|
| the user's Cub | **0** (-) / 0.0 kJ / off: - | **0** (-) / 0.0 kJ / off: - | 0 (-) | yes -> yes |
| Jodel | **0** (-) / 0.0 kJ / off: - | **0** (-) / 0.0 kJ / off: - | 0 (-) | yes -> yes |
| metal Cessna | **0** (-) / 0.0 kJ / off: - | **0** (-) / 0.0 kJ / off: - | 0 (-) | yes -> yes |
| Cessna floats | **0** (-) / 0.2 kJ / off: - | **0** (-) / 0.2 kJ / off: - | 0 (-) | yes -> yes |
| twin floatplane | **0** (-) / 0.0 kJ / off: - | **0** (-) / 0.0 kJ / off: - | 0 (-) | yes -> yes |

## float dig-in

**Reference:** A float bow digs in on landing: a water loop or cartwheel, a wing into the water, the float struts' fittings fail in overload, it capsizes. The engine stays on its mount.

*Sources (as recalled):* NTSB ANC19FA035, TSB A18A0053 (as recalled, via DEFORM §7.4)

| build | before: broken (by section) / kJ / off | after: broken (by section) / kJ / off | physics only | plausible before -> after |
|---|---|---|---|---|
| Cessna floats | **11** (engines 11) / 3.7 kJ / off: eng 238 kg | **2** (gear 2) / 0.1 kJ / off: -; CRASHED (a gear member broke) | 0 (-) | NO -> yes |
| twin floatplane | **179** (engines 26, bracing 12, wings 26, tail 52, gear 20, fuselage 35, vessel 8) / 7.3 kJ / off: body 141 kg; engL 61 kg; engR 61 kg; wing0L 47 kg; wing0R 47 kg; floatL 28 kg; +3 pieces | **80** (engines 5, bracing 8, wings 24, gear 20, fuselage 20, vessel 3) / 9.0 kJ / off: body+fin+stab 29 kg; floatL 28 kg; floatR 28 kg; CRASHED (broke up: the fuselage parted (TPB off the core)) | 12 (engines 2, fuselage 10) | NO -> yes |

