# AFT PODS: the sim's body behind a pod is not the drawn one (PHYSICS-PAGES, 11 Nov 2026)

Found by the user on the PHYSICS-PAGES prototypes (the Twin busher's truss overlay ran on past its pod). Measured in node,
each build through the game's load door (tools/_load_build.js), the core unchanged except for one what-if hook (core_ta.js).

## 1. Twin booms: the tail-arm floor invents a tail cone (60_gen_spec.js:6359)

    S.fuse.tailArm = Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord);

A rule for a tail on the fuselage. On a twin-boom build the join writes the pod's end as the tail arm (the editor ends the
pod at its aft bulkhead, _cage_gen.js "the pod ends at the bulkhead"; the taper, taperLen, adds to it), the floor lifts it to
0.9 wing chords past the box, and the measured pod profile (fuselage.profile, t over boxRear..tailArm) is STRETCHED over it.

Twin busher floats 4b (official): box rear 1.85 m, drawn pod end 2.40 m (box + taperLen 0.55; the fiche side picture is
opaque to 2.3-2.4 m, nothing behind), the sim's body to 3.47 m: a 1.07 m cone that is not there, 0.82 m deep at x 2.66.
The pusher's 1.91 m disc (engine at x 2.37, hub y 0.99) turns inside that cone.

| what (Twin 4b)                    | as resolved | body cut at the drawn end (2.40 m) |
|-----------------------------------|-------------|------------------------------------|
| body length (ST) / fineness / FF  | 3.47 m / 3.15 / 2.93 | 2.40 m / 2.32 / 5.83      |
| wetted area                       | 12.2 m2     | 9.7 m2                             |
| body CdA (genFusCdA)              | 0.189 m2    | 0.299 m2                           |
| aft cross-flow side CdA, its place| 1.08 m2 at x 3.06 | 0.83 m2 at x 2.26            |
| cruise (the core's 65 % rule)     | 171 km/h    | 162 km/h                           |
| static margin (genAidBalance)     | 0.277       | 0.287                              |
| Cn_beta at cruise (probe)         | -0.115      | -0.109                             |
| mass                              | 819.9 kg    | 812.7 kg (7 kg of phantom cone)    |

Note the drag goes UP when the body is cut where it is drawn: Raymer's FF (1 + 60/f^3 + f/400) on a 2.3 fineness pod gives
5.8, and a pusher pod's blunt end in front of its propeller is not what that formula describes. So the invented cone is
today what keeps the Twin's drag plausible; the right number for a short pusher pod needs a ruling (base drag with the
prop's suction, or an FF floor for a pod ending at a pusher disc), not just removing the floor.

All four twin-boom designs trip the floor (pods2.js):

| build | box / drawn end / sim end | body CdA as resolved -> cut | cruise |
|---|---|---|---|
| Twin busher floats 4b (official) | 1.85 / 2.40 / 3.47 | 0.189 -> 0.299 | 171 -> 162 |
| flydiy-build (4) (twinBoomFail)  | 1.55 / 2.15 / 2.81 | 0.309 -> 0.394 | 136 -> 129 |
| fixture build_v8_twin-boom       | 1.55 / 2.15 / 2.81 | 0.395 -> 0.527 | 137 -> 126 |
| fixture engcfg_pushpull (Skymaster) | 1.90 / 2.45 / 3.34 | 0.327 -> 0.437 | 223 -> 213 |

## 2. Rod booms: no measured boom profile, so the aft body is the family cone

The rod-boom builds (boomStyle 1, a 12-24 cm tube to the tail) carry no fuselage.profile (only the Super Petrel's join
measured one), so ST from the box rear to the tail is the generic full-section taper: 0.6-0.7 m deep at mid-boom where
the drawing has the rod. With the drawn shape given as the profile (the taper over taperLen, then the rod's boomHf/Wf to
boomHa/Wa; rods.js - an approximation from the cage's own fields):

| build | depth at mid-boom | wetted | body CdA | aft side CdA | cruise | Cn_beta | SM |
|---|---|---|---|---|---|---|---|
| Chinook (official, stock) | 0.63 -> 0.21 | 10.3 -> 8.1 | 0.185 -> 0.146 | 0.53 -> 0.27 | 130 -> 133 | -0.092 -> -0.088 | 0.073 -> 0.076 |
| Rufus (official)          | 0.71 -> 0.23 | 11.7 -> 9.8 | 0.211 -> 0.176 | 0.66 -> 0.43 | 121 -> 123 | -0.118 -> -0.113 | 0.176 -> 0.166 |
| Birdman                   | 0.63 -> 0.21 | 10.4 -> 8.3 | 0.187 -> 0.148 | 0.53 -> 0.28 | 117 -> 120 | -0.069 -> -0.066 | -0.178 -> -0.185 |
| v8 pusher                 | 0.68 -> 0.21 | 11.8 -> 9.1 | 0.212 -> 0.164 | 0.65 -> 0.32 | 128 -> 132 | -0.112 -> -0.105 | -0.055 -> -0.066 |
| v7 twin                   | 0.70 -> 0.21 | 11.4 -> 8.6 | 0.210 -> 0.159 | 0.67 -> 0.33 | 145 -> 148 | -0.120 -> -0.112 | 0.328 -> 0.316 |

Here the phantom body costs drag (2-4 km/h) and doubles the aft side area; the yaw stiffness moves ~5 %. (Birdman and the
v8 pusher read a NEGATIVE static margin either way - a separate matter, noted.)

## 3. Not changed, for a core owner
- the floor at 60_gen_spec.js:6359 should not apply when the tail is on booms (S.fuselage.boom twin / rod), and
- a rod build's aft body should be the rod (the join could measure the rod profile as it does the Petrel's), and
- the pod's drag needs its own rule once its real length is used (section 1's FF jump).
Each moves the certified numbers of official planes (Twin 4b, Chinook, Rufus): a physics chantier with re-certification.
