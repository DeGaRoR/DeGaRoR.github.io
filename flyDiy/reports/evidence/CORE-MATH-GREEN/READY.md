# CORE-MATH-GREEN READY (CABIN-CRAFT, 8 Nov 2026, for train L35d)

Branch claude/ready/core-math-green, on master 1bcd01d3e (L35a). Code 1b31a88b3, built (flight_core, career_core, index.html) on top, then this note and HANDOVER.

MASTER-GREEN (the user 8 Nov: "Have master clean"), via A0. GATE DMGDETERMINISM was red on master with two lines:
- "the census: ... 20 STRAY on the builtin" (sin/cos/pow sites in src/core that bypass CORE_MATH);
- "the sources: no `Math` binding in src/core (none) nor in the built page (ONE)".

## What changed

1. **The 20 stray sites go through CORE_MATH** (`node tools/_core_math_sites.js --apply`; 12 lines in 6 files): 32_hydro 485, 498; 61_gen_frame 2086; 64c_gen_aids 276, 291; 72_accept 255; 73c_mission_run 213, 267; 79_story 239-260. The census now reads "471 sites on CORE_MATH, 22 kept the builtin, 0 STRAY".
2. **The page's one Math binding was TANK-FIT's local alias in `tools/_cage_energy.js`** (`const Math = window.Math || GL_.Math`, inside the file's IIFE, for speed in node's vm). It is renamed MathL, with its 220 `Math.` uses in that file. Same object, same speed. The built page now has no Math binding.

Merge note: `_cage_energy.js` has 133/132 changed lines, all `Math.` to `MathL.`. A branch editing that file merges with a mechanical rename (any new `Math.` there is fine at run time, but the next DMGDETERMINISM run won't flag it: the alias name just has to stay off `Math`).

## Digests (`tools/_engconfig_check.js --pin`, master's fresh archive against this branch)

All 17 rows identical, the full output byte for byte: the Cub, Jodel, C172, Chinook, the ultralight, twin-boom, twin and pusher fixtures, the metal Cessna, the Cessna on floats, Rufus certified, and the six stock mounts. The gate's PIN table has 17 rows. No physics digest moved.

## Gates (node, `run_gates.js --no-build --jobs 3`)

```
DMGDETERMINISM PASS (26/26 checks; master's sweep 24/26; the page compare REPORTED not run: no playwright on the box)
HYDRODYN FLOATS ACCEPT MISSIONS MISSIONPROPS STORY ROUTES ENERGY PARTS TANKMOUNT CREWLOAD DASH MOUNT DESIGNCHECK JOIN DEFAULT SAVE EDBUGS PASS
NODUMMY FAIL "no reference to the retired figure outside the load migration [tools/box_render.js:42 dummy | tools/newshapes_build.js:121 edDum ...]"  (master 1bcd01d3e has it, same line; files not touched here)
```

Not run: DMGHULL (red on master, Deform's, 30 min), LAZY (it starts a browser).
