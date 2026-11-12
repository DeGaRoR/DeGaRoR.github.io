# MOSQUITO-COWL READY (CABIN-CRAFT, 11 Nov 2026)

Branch claude/ready/mosquito-cowl, on master L38a 603da882f. One data change: `builds/candidates/mosquito.json`'s cowl rows.

The user, 10 Nov (via A0), asked to "find the Mosquito with the cowl well fitted from the cowl sessions", for Wednesday's 15:00 plane-picture bake. The method behind it (PROPER-COWLS round 7) has been on master since L36d: `tools/cowl_study/straight.js`, the 0.92 radial drum and the streamlined helmets. The candidate still drew its own saved rows, because saved draws never move (the user's Q1, 9 Nov). This writes the method's rows (`straight.js`, opt `waist`) into the Mosquito candidate ONLY. The Mosquito is an unvalidated candidate, so Q1's protection of the validated planes' saved draws is not breached (A0, 10 Nov). The candidate's name and every non-cowl key stay its own; the tool refuses if any non-cage spec key moves.

## The fit

straight.js reads the Mosquito as a **radial, 9 cylinders**, single row (helmets: 9 heads at a 40 deg pitch from az 9.9 deg, streamlined, nose 0.802, the bare poke 1.5 cm). **36 cage rows** change, all cowl rows plus one engine row:

- the barrel: straight (taper 1/1), aft 0.4445 x 0.4445 m, length 0.401 m, the level split (cw_partLevel 1), the face ring (cw_faceRing 1);
- the helmets: cw_lobeN 0 -> 9, streamlined (cw_lobeStream 1), amp 2.75 cm;
- the face: a shaped lid (cw_lidMode 1), a bigger front opening (0.22 -> 0.33 m), a shorter lip and duct, no oil door (cw_oilOn 0, a detail the builder adds);
- **engY -0.015 -> 0**: the method centres the engine on the thrust line. It is the one row outside the cowl and moves the engine 1.5 cm up; the Mosquito is a candidate, so it is named here, not gated as a validated change.

Every row: `engY` -0.015 -> 0, `cw_cowlLen` 0.387 -> 0.401, `cw_aftW` 0.445 -> 0.4445, `cw_aftH` 0.355 -> 0.4445, `cw_taperW` 0.87 -> 1, `cw_taperH` 1.03 -> 1, `cw_lidRise` 0.014 -> 0, `cw_lidLen` 0.116 -> 0.111, `cw_lidShoulder` 0.3 -> 0.88, `cw_lidRound` 0.85 -> 0.94, `cw_faceRise` 0 -> -0.001, `cw_lidMode` 0 -> 1, `cw_lidGap` 0.014 -> 0.008, `cw_deckH` 1 -> 0.9978, `cw_keelH` 1 -> 1.0022, `cw_lobeN` 0 -> 9, `cw_lobeAmp` 0.022 -> 0.0275, `cw_lobeT` 0.45 -> 0.636, `cw_lobeAz` 0 -> 9.87, `cw_lobeSig` 53 -> 11.2, `cw_lobeTSig` 0.3 -> 0.066, `cw_apW` 0.22 -> 0.3289, `cw_apH` 0.22 -> 0.3289, `cw_lipThick` 0.03 -> 0.0222, `cw_lipDepth` 0.17 -> 0.1111, `cw_lipProtrude` 0.7 -> 0.6, `cw_lipInset` 0.06 -> 0.0356, `cw_ductLen` 0.26 -> 0.1778, `cw_oilOn` 1 -> 0, `cw_faceRing` undefined -> 1, `cw_waistF` undefined -> 0, `cw_partLevel` undefined -> 1, `cw_lobeCount` undefined -> 0, `cw_lobeStream` undefined -> 1, `cw_lobeNose` undefined -> 0.802, `cw_lobeTail` undefined -> 0.04.

## Gates

One process, `run_gates --only=<ID> --jobs=1 --no-build`, Wed 11 Nov 11:3x:

**PASS (4):** CANDIDATES, PLANELISTS, AIDS, PRICE. These are the gates that read builds/candidates; no validated plane is touched, so the validated-plane gates do not move.

## Named

- The candidate's thumbnail (`cand:mosquito.json`) shows the old cowl until the next picture bake redraws it.
- No built file changes (data only); no validated plane's draw, spec or certificate moves.
- The cowl READY 2 (births set cw_partLevel/partArc/podFit to 1) is parked for after the landing week (A0, 10 Nov).
