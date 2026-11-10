# TAIL-RETRACT — READY (claude/ready/tail-retract, onto claude/ready/phys-scale)

The user (9 Nov): "lift the restriction on tail draggers". A taildragger can now retract its **mains** (the DC-3 into its
nacelles, the Spitfire, the Bf 109). Its tailwheel stays down and fixed. **Merge order: real-figures-3b, phys-scale, then
this.** It is branched from the finished phys-scale.

## Where it comes from

Taken by hunk from `claude/practical-cerf-7fjpwp`, never as a whole commit:

| source | taken |
|---|---|
| 2d7dc1fef (its TAIL-RETRACT half) | **60_gen_spec clampSpec** keeps `spec.gear.retract` on a taildragger. **tools/_cage_join.js**: the join writes it for a taildragger. **tools/_cage_gear.js**: `GEAR_TAIL` (s2Leg 3); `GEAR_RETRACTABLE` and `RETRACT_CAN` without the s2Leg 3 check; the swing (`PAGE.post`) skips unit T on a taildragger. **62_gen_aero** `genGearCdAMains`: the mains' wheels and legs are the drag that comes up, not the tailwheel or the lift struts; `params.retract.tail`. **30_solver**: `def.refs.tw` is left out of the lift when `RET.tail`. **61_gen_frame**: the retraction kit (`GEN_RULES.retractKg`, `GEN_PRICES.retract`) is billed on the mains' axles. |
| fd437e8ab (fix A, SEAPLANES' review) | The row reads "retraction" on every build. A taildragger's note reads "a taildragger: the mains only, the tailwheel stays down". |
| 24f7ce231 (tools/_retract_check.js only) | GATE RETRACT: "a taildragger keeps it (its mains; the tailwheel stays down)", where it used to say "drops it". |

Not taken:
- real_check.js (a retracting build's gear-up sweeps) and real_refs.js (REF-DATA): measurement code, not physics;
- the dc3_retract candidates (Pilot's / REAL-FIGURES' cards).

## Note B: a saved taildragger that holds gearRetract 1 now wakes

Until now, clampSpec dropped `gear.retract` on any type but a tricycle, and the join only wrote it for a tricycle. So a
taildragger saved with the switch on (`cage.gearRetract` 1, possible on master: RETRACT_CAN let a build saved on a
tailwheel keep the row "while it is on") flew fixed. On this branch the same file loads **retractable**:
- its mains swing;
- it carries the kit's mass and price;
- its gear-down drag comes off as the gear comes up;
- its certificate key moves.

Checked: no shipped or candidate file is in that state. Every builds/*.json, builds/candidates/*.json and
tools/fixtures/*.json was read. The only `gearRetract: 1` is `builds/candidates/superpetrel_V4_1.json`, a tricycle. No
archetype card writes it on a taildragger: the Skymaster's `labCage` is a tricycle's. A player's own save in that state
would wake.

PHYSICS_V: no bump of its own. A build without a taildragger retract is byte-identical to phys-scale (STOL section 1:
the 32 cards and six builds = phys-scale's baseline). It rides phys-scale's 9 in the same train. If it is ever merged
without phys-scale, it needs its own bump (8 is taken twice: ELEC-SYSTEMS, PROP-CLASSES).

## Smoke

The Spitfire-alike card with `gear.retract {time 6, hydraulic}`:
- clampSpec keeps it on the taildragger;
- `params.retract` is `{tail: true, cdA 0.133 m2 (the mains only), frac 1, emerg freefall}`;
- the sim builds;
- the mass is 1907.1 -> 1975.8 kg (the kit, GEN_RULES.retractKg by the design gross).

## Gates (this branch vs plain real-figures-3b; the reds' own comparison is in PHYS-SCALE-READY.md)

`run_gates.js --no-build --jobs=1 --only=RETRACT,DESIGN,CARDS,SPECFIX,JOINPARITY,CGBAND,DESIGNCHECK` on bae42d36's
source with phys-scale d13b248e under it. Then STOL and RETRACT again on the final tree.

| gate | this branch | plain real-figures-3b |
|---|---|---|
| RETRACT | PASS (twice) | PASS |
| DESIGN, CARDS, SPECFIX, CGBAND | PASS | PASS |
| STOL (--selftest) | PASS | PASS |
| JOINPARITY | 1 FAIL, the Jodel line (471.789 / 467.989 kg) | the same |
| DESIGNCHECK | FAIL 31/32, the carbon boom's 200 N post (4.2 vs 1.8 mm) | the same |

phys-scale's own reds and the reasons for them (BENCH: the Rufus re-stamp the PHYSICS_V bump asks for; ENGCONFIG, GEN,
ARCHETYPES the base's) carry over unchanged.

## For the user / later

The retract row and the design tile still sit behind RETRACT-LAB (the developer's toggle, `?retract=lab`), as on master.
