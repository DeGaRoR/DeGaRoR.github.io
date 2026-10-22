# DMG-COMPOSITE - the crash table (G2049)

DMG-TUNE's standard crashes (tools/_dmg_tune_lib.js), damage ON with the certificate stamped (genCertify, GEN_CERT_V unchanged), node only. The composite build is builds/composite_jodel_2026-10-07.json (the validated Jodel's geometry in E-glass); the carbon variant is the same file on the composite tile (reported, not gated). **Every source is as recalled - nothing was opened in this session.** "member work" is the members' plastic and crack work (30_solver.js dmgW); "energy taken" the mechanical energy (kinetic + the weight's potential) taken out of the aeroplane between the run's first frame and its end (the trunk's and the ground's contact damping, friction and the members' work); "back" how far the CG came back off its furthest point (the rebound). "laminate set" counts laminate members yielded and still whole (a brittle laminate has none).

| build | mass kg | CG % MAC | V_S m/s | members (by material) | laminate seams |
|---|---|---|---|---|---|
| Jodel in glass | 513.4 | 29.3 | 19.42 | {"glass":466,"tubeFabric":26} | {"bond":189,"opening":10,"fitting":78} |
| Jodel in carbon | 458.8 | 24.7 | 18.36 | {"carbon":466,"tubeFabric":26} | {"bond":189,"opening":10,"fitting":78} |
| Jodel (wood) | 463 | 26.6 | 18.9 | {"wood":466,"tubeFabric":26} | {} |
| metal Cessna | 883.4 | 28.7 | 22.4 | {"alloy":416,"tubeFabric":26} | {} |

## 3 m/s taxi

**Reference:** A taxi into a post or a tree at walking pace: the propeller strikes, the spinner and a glass-fibre cowling crack, a wing's leading edge may crack locally. No primary structure breaks; no bond line lets go.

*Sources (as recalled):* NTSB taxi-collision briefs (CA class), as for DMG-TUNE; composite cowlings "cracked" in the same briefs - as recalled

| build | broken (by section) | laminate broken by how | laminate set | member work kJ | energy taken kJ | back m | off | plausible |
|---|---|---|---|---|---|---|---|---|
| Jodel in glass | **1** (engines 1) | {} | 0 | 1.1 | 2.3 | 0.18 | - | yes |
| Jodel in carbon | **0** (-) | {} | 0 | 0.9 | 2.1 | 0.09 | - | yes |
| Jodel (wood) | **0** (-) | {} | 0 | 0.7 | 2.1 | 0.25 | - | (reference build) |
| metal Cessna | **1** (engines 1) | {} | 0 | 1.0 | 3.9 | 0.35 | - | (reference build) |

## nose-over

**Reference:** Wheels stopped at 12 m/s: over onto the nose. On a composite aeroplane the cowling and the nose shell shatter (glass-fibre "cracked and delaminated"), the propeller breaks, the gear may tear out of its box; the wings stay on and are not shredded.

*Sources (as recalled):* NTSB Glasair / Lancair / Long-EZ nose-gear and nose-over briefs ("the composite nose section was fractured", "the main gear leg separated from the fuselage") - as recalled

| build | broken (by section) | laminate broken by how | laminate set | member work kJ | energy taken kJ | back m | off | plausible |
|---|---|---|---|---|---|---|---|---|
| Jodel in glass | **36** (gear 7, tail 26, wings 2, fuselage 1) | {"tension":1,"tension/fitting":13,"group/fitting":20,"root-member/fitting":1,"tension/bond":1} | 0 | 0.1 | 30.5 | 0.00 | fin 5.2 kg; tw 3.8 kg; CRASHED (a gear member broke) | NO |
| Jodel in carbon | **3** (gear 3) | {"tension":1,"tension/fitting":2} | 0 | 0.2 | 19.7 | 0.00 | -; CRASHED (a gear member broke) | yes |
| Jodel (wood) | **3** (gear 3) | {} | 0 | 1.6 | 20.8 | 0.00 | -; CRASHED (a gear member broke) | (reference build) |
| metal Cessna | **7** (gear 7) | {} | 0 | 3.6 | 65.2 | 0.29 | tw 7.7 kg; CRASHED (a gear member broke) | (reference build) |

## 30 m/s centreline

**Reference:** A tree on the centreline at 58 kt: a composite airframe comes apart BRITTLE - the shell splits along its bonds and fractures in large pieces with sharp edges, the wings separate at the root / spar carry-through, the tail boom breaks aft of the wing (the glider's classic failure); little plastic deformation, more of the energy into fracture and rebound than a metal airframe's crumpling.

*Sources (as recalled):* BFU / AAIB glider field-landing and tree reports ("the fuselage broke behind the wing", "the GRP shell fractured"), NTSB high-energy Cirrus / Lancair reports ("the airplane was fragmented"), NASA Langley's composite GA crash tests (Jackson / Fasanella, AGATE, early 2000s: the floor and the shell delaminating) - as recalled

| build | broken (by section) | laminate broken by how | laminate set | member work kJ | energy taken kJ | back m | off | plausible |
|---|---|---|---|---|---|---|---|---|
| Jodel in glass | **238** (engines 13, wings 26, fuselage 50, gear 15, vessel 9, bracing 4, tail 121) | {"tension/fitting":15,"kink/fitting":10,"tension/bond":51,"group/fitting":50,"group":11,"kink":8,"tension/opening":10,"tension":52,"fold/fitting":2,"kink/bond":2,"root-member/fitting":1} | 0 | 10.4 | 256.2 | 0.00 | eng 90.4 kg; wing0R 61.8 kg; wing0L 61.8 kg; body 37.2 kg; body 31.5 kg; body 31.5 kg; +21 pieces; CRASHED (broke up: the fuselage parted (TPB off the core)) | yes |
| Jodel in carbon | **174** (engines 13, wings 27, gear 15, bracing 4, vessel 9, fuselage 27, tail 79) | {"tension/fitting":12,"kink/fitting":10,"group/fitting":55,"group":11,"kink":8,"tension/bond":16,"tension":26,"tension/opening":8,"kink/bond":1,"root-member/fitting":1} | 0 | 9.3 | 228.9 | 0.00 | body 115 kg; eng 90.4 kg; wing0R 47.8 kg; wing0L 47.8 kg; body 34.8 kg; body 18.7 kg; +11 pieces; CRASHED (broke up: the fuselage parted (S0BR off the core)) | yes |
| Jodel (wood) | **154** (engines 13, wings 31, vessel 9, gear 15, fuselage 16, bracing 39, tail 31) | {} | 0 | 32.2 | 230.7 | 0.00 | eng 90.4 kg; wing0R 46.7 kg; wing0L 46.7 kg; body 18.7 kg; body 18.7 kg; eng 10.5 kg; +5 pieces; CRASHED (a fus member broke) | (reference build) |
| metal Cessna | **178** (engines 13, gear 15, vessel 8, fuselage 52, wings 22, bracing 12, tail 56) | {} | 0 | 65.8 | 441.4 | 0.00 | eng 198.9 kg; wing0R 81.7 kg; wing0L 81.7 kg; body 68.5 kg; body 68.5 kg; eng 19.5 kg; +7 pieces; CRASHED (the airframe crushed (3.3 kJ of plastic work)) | (reference build) |

## 30 m/s, 2.5 m out

**Reference:** A tree 2.5 m out on the wing at 58 kt: the struck wing is cut or torn off at its spar; the composite skin cracks and peels from the core around the strike; the engine stays on; the cabin shell holds.

*Sources (as recalled):* NTSB / BFU wing-strike reports on composite singles and gliders ("the left wing separated outboard of the root", "the wing skin delaminated") - as recalled

| build | broken (by section) | laminate broken by how | laminate set | member work kJ | energy taken kJ | back m | off | plausible |
|---|---|---|---|---|---|---|---|---|
| Jodel in glass | **139** (wings 37, bracing 33, gear 15, fuselage 1, tail 53) | {"kink":8,"kink/bond":13,"tension/bond":17,"tension/fitting":26,"tension":8,"kink/fitting":4,"group/fitting":47,"group":11,"root-member/fitting":1} | 0 | 1.0 | 250.3 | 0.00 | wing0R 61.8 kg; wing0L 37.5 kg; wing0L 19.3 kg; stab 13.3 kg; gearL 7.2 kg; gearR 7.2 kg; +4 pieces; CRASHED (a wing member broke) | yes |
| Jodel in carbon | **66** (wings 19, bracing 38, gear 9) | {"kink":8,"kink/bond":18,"tension/bond":20,"tension":7,"tension/fitting":4,"group/fitting":5,"group":1,"kink/fitting":3} | 0 | 0.6 | 227.3 | 0.00 | wing0L 19.5 kg; gearL 6.2 kg; gearR 6.2 kg; wing0L 5 kg; wing0L 3.3 kg; CRASHED (a wing member broke) | yes |
| Jodel (wood) | **96** (bracing 50, wings 21, gear 9, tail 16) | {} | 0 | 5.1 | 229.3 | 0.00 | wing0L 20.8 kg; gearL 7.1 kg; gearR 7.1 kg; fin 5.3 kg; CRASHED (a wing member broke) | (reference build) |
| metal Cessna | **26** (wings 5, bracing 6, gear 15) | {} | 0 | 9.1 | 436.8 | 0.00 | wing0L 46.5 kg; gearL 9.1 kg; gearR 9.1 kg; tw 7.7 kg; CRASHED (a wing member broke) | (reference build) |

## drop 1.5 x 23.473

**Reference:** A drop at 1.5 x the FAR 23.473 limit sink, V_S0 forward, no lift: the gear takes it (or a leg breaks); the composite airframe does not crack (FAR 23.727: no failure at 1.2 x the limit drop energy).

*Sources (as recalled):* FAR 23.473 / 23.727, as DMG-TUNE - as recalled

| build | broken (by section) | laminate broken by how | laminate set | member work kJ | energy taken kJ | back m | off | plausible |
|---|---|---|---|---|---|---|---|---|
| Jodel in glass | **0** (-) | {} | 0 | 0.0 | 29.9 | - | - | yes |
| Jodel in carbon | **0** (-) | {} | 0 | 0.0 | 24.4 | - | - | yes |
| Jodel (wood) | **0** (-) | {} | 0 | 0.0 | 26.6 | - | - | (reference build) |
| metal Cessna | **0** (-) | {} | 0 | 0.0 | 42.2 | - | - | (reference build) |

