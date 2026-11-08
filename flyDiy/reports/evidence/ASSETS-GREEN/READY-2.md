# ASSETS-GREEN-2 READY (CABIN-CRAFT, 8 Nov 2026, fix-forward for train L35d)

Branch claude/ready/assets-green-2, on master b25872b51 (L35c, which carries assets-green 5f060f371). One code commit, tools only: no built file changes.

## What lands

- **GATE UISMOKE runs the material library ahead of app.js** (`tools/test_ui_smoke.js`), as the page loads it (build.js's scripts: `matlib.js` right after `assets.js`, long before `app.js`). Since de8e69361 app.js's material sites ask `MATLIB.make`; the smoke sandbox had no MATLIB, and the site's node fallback `require('./matlib.js')` has no `require` there either, so UISMOKE and UISMOKE-PHONE died at app.js:2138 (the shadow catcher's material, the first site the boot reaches) in L35c. The page itself always had MATLIB (A0 pushed L35c on that).
- `_scene_headless.js` and `_seats_check.js` already run matlib.js the same way (assets-green's own commits); no other gate evaluates app.js whole (`filename: 'app.js'` only in test_ui_smoke.js).

## Gates (node, one process at a time, on L35a + assets-green + this fix)

- UISMOKE PASS and UISMOKE-PHONE PASS on L35a 1bcd01d3e + assets-green 5f060f371 + this fix (22:14-22:20).
- UISMOKE PASS (4 min 26 s) and UISMOKE-PHONE PASS (25 s) on master L35c b25872b51 + this fix, a byte copy of the train (build 295a6c515006), 22:21-22:26.
- In L35c without the fix both died at app.js:2138 (S1/land_L35c_gates.log lines 435-468).

## Not this ref

- DMGMEMBERS (red in L35c, 101/103) is not assets-green's: the gate runs the physics core alone (`tools/flight_core.js`), which never holds `dmg_members.js` (a viewer file). L35c brought a sixth build, the Super Petrel (the seaplanes ready's `_load_build.js` VALIDATED `petrel`); the five older builds pass, the Petrel fails the two rules written before any carbon build (Euler caps tubes only: its carbon fus/wing/tail are capped at ~0.90; fittings exactly 1.15: 0.57-1.15). A0 routed it to SEAPLANES and Deform.
