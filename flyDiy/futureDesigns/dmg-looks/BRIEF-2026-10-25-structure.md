# DMG-LOOKS brief 2 (25 Oct 2026, from the DEFORM COORDINATOR, on the user's reply to the study)

The user, through A0, after reading DMG-LOOKS-STUDY-2026-10.md:

- "We can proceed on the damage look, but beware of performance impact."
- New requirement: "a solution for the structural elements that should bend: the tubular cage, the wooden pillars, the
  metal frames. The metal should bend, wood should break like wood. We need to add that to the prototype, and then we can
  proceed with a first test of inclusion in the game and some before/after."

So, before any in-game code, **extend the prototype (node only, `futureDesigns/dmg-looks/`, no src/ change) to cover
STRUCTURE by material**, and report in your HANDOVER entry as before.

## 1. What to add

Use the validated aircraft only: the Cub `builds/cub_2026-09-20_corrected.json`, the Jodel
`builds/jodel_2026-09-20_corrected.json`, the metal Cessna `bugReports/cessnaMetal (1).json`.

1. **Steel tube cage (the Cub, 4130).** It bends at a plastic hinge and keeps its length.
   - Extend `bend_proto.js` from one longeron to a cage bay: longerons, uprights and diagonals. Bend the members that the
     solver yields.
   - Draw the hinge as a short rounded crease with the tube slightly ovalised there, not a sharp V.
   - A steel member the solver BROKE: its two stubs keep the bend they had (study §4 "Broken tubes"). Draw each end as a
     torn, necked, bent stub, never a clean flat cut. Show the solver's break as a tear after a large bend.
2. **Metal frames (the Cessna: alloy formers, stringers, longerons).**
   - Thin alloy sections buckle into a short wave of 2-3 crimps (local buckling), not one kink.
   - A broken frame tears jagged at its rivet line, like P1b's sheet: never a clean cut.
3. **Wooden members (the Jodel: spruce spars, longerons, the pillars; ply webs).**
   - Wood does NOT bend plastically: it stays straight, elastic, until it breaks.
   - A broken wood member: a jagged break along the grain.
     - Long slivers on both ends, 3-6 x the section depth, of uneven lengths.
     - A lengthwise split running back from the break.
     - Raw-wood colour at the fracture (P2's substrate: raw wood).
   - A partial break (greenstick): one side split, the member hanging bent at the crack. Say when the solver's state
     calls for one or the other.
   - Teeth of 2+ triangles, as your ply comb taught.
4. **For each of 1-3, name exactly what the page needs from the solver, per member, at an event only.**
   - Hinge station(s), angle and axis; break station and grain axis; the material class.
   - Where it is already in `30_solver.js` (dk / kt1 / dN / thf, beamBreak), and what is missing.
   - If some members break today where real ones would fold, list them as a CALIBRATION item for Deform. Say which builds
     and members; no physics change in the prototype.
5. **The cost, up front (the user's "beware of performance").** Per technique:
   - the vertices / triangles per bent or broken member;
   - the CPU ms at the event (10 broken + 30 bent members);
   - any per-frame cost after the event;
   - draws (target: 0 new draws, 0 program links at a crash, 0 per-frame CPU after the event).
   - Flag anything that cannot meet that.
6. **Pictures:** before / after for each structure, at rest and bent / broken, in the same style as `bend_members.svg`
   and `tear_panels.png`.

## 2. What comes after (Deform, local; not yours)

A first in-game inclusion behind a switch, OFF by default. It covers P1a (member bend) plus 1-3 above, plus
before/after stills on the Cub, the Jodel and the metal Cessna, plus the cost against master (draws / tris / ms). The user
then decides whether the switch goes ON. P2 option A vs B is still A0's ruling.

## 3. Report

Add to your HANDOVER entry (G3620-G3629 block): the numbers, the pictures' paths, the solver data list, the calibration
list and the cost table. Target: by Tue 27 Oct evening. Deform starts the in-game test after DMG-FALL (T-P1 Tue 27, 20:00).
