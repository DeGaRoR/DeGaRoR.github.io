# ASSETS-GREEN READY (CABIN-CRAFT, 8 Nov 2026, for train L35c/L35d)

Branch claude/ready/assets-green, on master 1bcd01d3e (L35a). Code de8e69361 + 5b3efcf89, built 7acd63878, then this note and HANDOVER.

MASTER-GREEN (the user 8 Nov: "Have master clean"), via A0: GATE ASSETS was red on master. Fourteen `new THREE.*Material` sites were over their files' allowance; materials are to be made in src/viewer/matlib.js.

## What changed

Each extra site is now `MATLIB.make(THREE, shape, params)`. `make` is `new THREE[cls](Object.assign({}, base, params))`, and the shapes used (std, basic, shader) have an empty base, so it is the same constructor with the same params. One line changed per site.

| file | sites / allowed | moved | shape |
|---|---|---|---|
| render_premises.js | 24/23 | 446 ground | std |
| app.js | 16/12 | 2138, 3543, 7049, 13167 | basic, basic, std, basic |
| clouds.js | 8/7 | 425 sky | shader |
| hangar_view.js | 3/0 | 60, 122, 128 | shader |
| cockpit.js | 2/1 | 155 gauge pads | basic |
| studio.js | 2/0 | 51 env, 86 pool | basic |
| dmg_members.js | 1/0 | 419 fallback | std |
| tools/_seat_gen.js | 1/0 | 158 the flat view's seat | std |

- Files that had no MATLIB use take the guard viewer code already uses: `(typeof MATLIB !== 'undefined' ? MATLIB : require('./matlib.js'))`.
- `tools/_scene_headless.js` runs matlib.js in node's headless editor context, as the page has it before the editor. GATE SEATS puts it in scope the same way. No editor file other than `_seat_gen.js` mentions MATLIB, so nothing else in the headless chain changes.
- No allowance was raised. ASSETS stays exact at 172/172 (no "can tighten").

## Nothing looks different

- **plane_shot hero (SwiftShader, the phone studio: studio.js builds the env the metals reflect)**, master against HEAD: pixel-identical except one region round the red dummy's arm. Master against master differs in exactly that region (the pose moves between runs).
- **Node quickshot of the twin (side and 3/4)**, master against HEAD: pixel-identical. (In node the seats take AEROSKIN's path, so this proves the editor draws the same, not that a moved material is drawn.)
- **`tools/newshapes_identity.js`** on archives of 1bcd01d3e and HEAD: all 6 lines identical (cub, jodel, metal, floats, twinFloats, rufus: spec, def, draw, mass, ledger, sheet, design, procure, fly20).

Pictures: `D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-08/assets-green/` (twin4b_hero_master_vs_assets.png, the two diff masks, gates.log).

## Gates (node, `run_gates.js --no-build --jobs 2`, A0's CPU slot for the stills)

```
ASSETS PASS (MATS 172 sites in 34 files, allowed 172 in 34)
SEATS PASS (after 5b3efcf89; red before it: "sling L0 builds [require is not defined]")
MATLIB PASS  LIGHT PASS  HANGARVIEW PASS  PANEL PASS  GPSFACE PASS  FLOWNBAKE PASS
DEFAULT PASS  EDBUGS PASS  JOIN PASS  SAVE PASS  DESIGN PASS
SHADOWSKY FAIL  "4 clouds: a stale depth nearer than the first deck is sky ..."  (master 1bcd01d3e has it, same line)
```

Not run: CLOUD and PROGRAMS (they start Chrome), DMGLOOK (it spawns a child process).
