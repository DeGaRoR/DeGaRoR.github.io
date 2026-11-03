# RETRACT-1 - status (2026-11-03)

What was run, on this 4-core cloud box, at the RETRACT-1 commits (branch claude/retract-study = claude/affectionate-edison-fx8582):

- **GATE RETRACT** (`tools/_retract_check.js`, core): PASS. Every section: spec, bill, squat switch, the expert's
  circuit, drag, the gear-up landing, power and emergency, the forgetful person, the horn.
- **Fixed builds unchanged:** `fixed_identity.js` (here) flies the Cub, the Jodel, the metal Cessna and the PA-18 on
  floats. Each runs 150 s with the expert, the club pilot and the student, on master e6bcfb36's core and on this
  branch's. Every position, ctl and phase hash is the SAME (12 of 12):
```
cub/expert DOWNWIND 746132b95342
cub/club DOWNWIND 41711e5e71bc
cub/student DOWNWIND b09a838b6970
jodel/expert DOWNWIND cf14c82d88e4
jodel/club DOWNWIND 588ee8aa2979
jodel/student DOWNWIND 66ede7c1d4ac
metal/expert BASE febaf979af3f
metal/club BASE a9d18256fcde
metal/student DOWNWIND 42fb8f09ac85
floats/expert STOPPED acdf76cf93b1
floats/club STOPPED 67f5e12c7aa3
floats/student STOPPED 8edce1408883
```
- **Gates run green:** INPUT, AUDIO, DEFAULT, HONEST, UISMOKE, JOIN, SPECFIX, STARTER, PARTS, DESIGN, PILOTS, GEAR.
- **Red here, and red the same on a clean master e6bcfb36 worktree** (not this chantier's):
  - JOINPARITY: 8 FAIL. The page capture predates the tank-fit masses.
  - TECH: 1 FAIL, [pitch:seaplane] (A0's L30c note: "master standing").
  - CLIP: 4 new rows, the nav aerial in the fin on stock+ifr.
- **NOT run:** the whole core battery and the full tier (ARCHETYPES, PILOTMATRIX, SEAPLANE, HOTHIGH). On this box the
  core alone was still on its first two gates after 20 minutes, and was stopped. The delivery verdict
  (`run_gates.js --all`) is A0's to run on the box.
- **Pictures:** `ttail_gear{1,0.5,0}_{front,side,q}.png`, the T-tail tourer drawn by `tools/quickshot.js --gear`
  (no game, no browser).
