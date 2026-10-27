# KICKOFF: hand a 3D model to a new cloud session

The message to paste into a NEW cloud session on `DeGaRoR/DeGaRoR.github.io`, with the reference model attached
(upload the .glb with the message). Fill in the `<...>`; delete the lines that do not apply.

The tool is not a separate package: its scripts birth the card through this repo's own headless garage, so the new
session works in a checkout of the branch that carries it (`claude/new-shapes-1`, or `master` once that train has
landed: check that `flyDiy/tools/ref_match/match.sh` exists).

---

```
Build an archetype card for the <TYPE, e.g. "Piper J-3 Cub"> matched to the attached reference model
(<file>.glb, <source and licence, e.g. "Sketchfab 'J3 Cub' by <author>, CC-BY-4.0">).

Work on branch <your branch>, starting from claude/new-shapes-1 (or master if it already has
flyDiy/tools/ref_match/match.sh). Read CLAUDE.md, then flyDiy/tools/REF_MATCH.md in full before touching anything:
it is the procedure, and flyDiy/tools/ref_match/ is the tool. Follow it exactly:

1. Set up the reference (REF_MATCH.md section 1): copy the GLB to flyDiy/tools/ref_match/refs/<key>.glb, list and
   view its nodes (glb_tris.py --list, glb_views.py), write refs/<key>.json from refs/camel.json, assign the roles,
   and check them with refmatch.py --roles. Scale by the published span and anchor the length (and height) on
   published figures, cited in the config's "sources": SOURCES PREVAIL OVER THE MODEL. Get the datum right first
   (the firewall, or "datum": "prop" checked on two markers); a wrong datum ruins everything after it.
   Published figures for this type: span <m>, length <m>, height <m>, chord <m>, track <m> (or find 2-3 sources).
2. Start the card from the nearest existing ARCHETYPES entry in flyDiy/tools/_cage_design.js (<nearest card, e.g.
   "cub">), as a new key <key>, kind 'recreation'. Pick the fuselage type carefully and say why.
   If the type's engine is not in the catalogue, add it the way the Clerget 9B and the Merlin 66 were added
   (registry, drive, tech, the join map, the engine bench preset, _eng_check, GEN_ENG_CG).
3. Run the loop: flyDiy/tools/ref_match/match.sh <key> (about 15 s; overlays in /tmp/rm_<key>_*.png). Match in the
   order of section 3: step 1 (side proportions: openings, nose, body lengths, deck and keel, wings), step 2 (plan),
   step 3 (cowl per section 4, gear, tail with fit_tail.js, tips with fit_tips.py). Finish each step before the
   next; use the fitters only on the rows of the step in hand.
4. Every change is a garage row on the card. If the shape needs a control the garage lacks, STOP and tell me: it is
   added to REF_MATCH.md section 7 as a gap, then built as a row, then used.
5. Send me the side / top / front overlays after each step, and wait for my remarks before the next step.
6. At the end: a livery (spec.paint, finish.decals, finish.sections, meta.reg), the build file via
   flyDiy/tools/newshapes_build.js, the gates (_design_check, _join_check, _eng_check, _engid_check, test_skinmat,
   _livery_check, _cowl_check, and _arch_check (it is long: run it in the background)), bench pictures
   (flyDiy/tools/bench_shot.js, ~7 min each), and a new log section in REF_MATCH.md with what this aeroplane taught.
   Commit and push to your branch; no PR unless I ask.
```

---

What to expect: the Camel took a day of rounds with the user; the Stearman and the Tiger Moth went faster on the
written procedure. A type far from every existing card (the Spitfire, REF_MATCH.md section 10) starts too far back:
say so early, and list the gaps before fitting.
