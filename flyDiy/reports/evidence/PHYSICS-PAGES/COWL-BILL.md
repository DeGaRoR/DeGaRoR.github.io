# COWL-BILL: a cowl billed on planes the editor draws without one (PHYSICS-PAGES, 12 Nov; the user spotted it on the Ruckus)

The editor's cowl switch is `cage.cowlOn`. Two of the three readers honour it; the mass bill does not:

| reader | rule | honours cowlOn 0? |
|---|---|---|
| drag, cooling (62_gen_aero.js:659) | `S.cage.cowlOn != null ? !!+S.cage.cowlOn : cw.on !== false` | yes |
| access table (60_gen_spec.js:1461) | `P.cowlOn == null ? 1 : +P.cowlOn` | yes |
| outfit MASS (61_gen_frame.js, the cowl block of sec('outfit')) | `S.cowl && S.cowl.halfW > 0 && S.cowl.on !== false` | NO: the join never writes `cowl.on`, and resolveSpec sizes `cowl.halfW` from the nose |

16 cards have `cage.cowlOn: 0` and `cowl.on` undefined, so each is billed a cowl it does not wear
(builds/ and tools/fixtures/): birdman, build_v7_twin, build_v8_pusher, ruckus (all three cards), stearman_2026-10,
chinook_2026-09-21 (+ _corrected), rufus_2026-10-18_certified (+ repro fixtures), build_v10_birdman.

Measured with parts.outfitKg (claude/physics-pages 7a4c871c: a record of the outfit's items, masses unchanged):

| plane | cowl billed | note |
|---|---|---|
| Ruckus std (ruckus_std_2026-11-09) | 5.07 kg | REAL-FIGURES' empty verdict is already outside (155.5 vs 115) |
| Rufus (certified) | 3.98 kg | official |
| Chinook (corrected) | 2.82 kg | official |
| Stearman candidate | 7.81 kg | a bare radial |

Half the cowl rides ring 0, half the engine pair (nose engines), so the CG moves a little too.

Suggested fix (not made here: physics, and it changes certified masses): the outfit's cowl test takes the drag's rule,
`const cowlOn = S.cage && S.cage.cowlOn != null ? !!+S.cage.cowlOn : S.cowl.on !== false`. The exhaust stays billed
(an uncowled engine still has its stacks).
