# CLAUDE.md

## flyDiy: the session ritual

Read `flyDiy/HANDOVER.md` first (its SESSION RITUAL, FILES and GATES sections). Built files (`index.html`, `dev.html`,
`sw.js`, `version.json`, `tools/flight_core.js`) come from `node flyDiy/tools/build.js` and are committed in their own
"(built)" commits.

## Building an aeroplane card to a 3D reference model (a reusable tool)

When a user gives a reference model (a GLB) of a real aeroplane and asks for a card that matches it, use the
fit-to-reference tool, not hand guessing:

- the how-to: `flyDiy/tools/REF_MATCH.md` (setup of the reference, the loop, the order of steps, the cowl, units and
  frames, pitfalls, garage gaps, and the logs of the Camel, Stearman, Tiger Moth and the Spitfire WIP);
- the tools: `flyDiy/tools/ref_match/` (`match.sh <key>` is the one-command loop; the fitters `fit_body.py`,
  `fit_cowl.py`, `fit_tips.py`, `fit_tail.js`; the readers `refmatch.py`, `cowl_sections.py`, `leg_line.py`,
  `cowl_clip.js`, `rings.js`, `dump_build.js`); each prints its usage at the top of its file;
- the reference configs and models: `flyDiy/tools/ref_match/refs/`.

Keep it a tool: every fitted value lands on a garage row in the card (`flyDiy/tools/_cage_design.js` ARCHETYPES), a
missing control is flagged as a garage gap (REF_MATCH.md section 7) and then built as a row, and the how-to is updated
with whatever the next aeroplane teaches.
