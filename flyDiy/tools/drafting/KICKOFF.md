# KICKOFF: hand a plane's blueprints to a new cloud session (the drafting table)

The message to paste into a NEW cloud session on `DeGaRoR/DeGaRoR.github.io`, with the blueprint attached (a three-view
image: upload it with the message). Fill in the `<...>`; delete the lines that do not apply.

The tool lives in this repo: `flyDiy/tools/drafting/` (the headless table), `flyDiy/drafting.html` (the light,
phone-first page, also reached from the game's welcome menu: "New reference plane"), the how-to and the full log of the
first plane in `flyDiy/tools/DRAFTING_TABLE.md`. Check that `flyDiy/tools/drafting/table.js` exists on `master`; until
the train that carries it has landed, start from `claude/fit-procedure-fixes`.

---

```
Match a garage card to the attached blueprint of the <TYPE, exact variant, e.g. "Pilatus PC-6/B2-H4">
(<file>, <source and licence>; a private reference: never commit or ship the image).

Work on branch claude/<your-branch>, starting from master (or claude/fit-procedure-fixes if master has no
flyDiy/tools/drafting/table.js). Read CLAUDE.md, then flyDiy/HANDOVER.md's SESSION RITUAL / FILES / GATES, then
flyDiy/tools/DRAFTING_TABLE.md in full: its rounds 1-15 are the PC-6 done with this tool, mistakes included.

1. THE REFERENCE FIRST, and it is the only truth: write flyDiy/tools/drafting/refs/<key>.json from refs/pc6.json -
   identity (the exact variant and engine), figures (each with its source: the type certificate data sheet first,
   then the maker's factsheet, then an authority's report; a figure no source states stays empty, never guessed),
   the sheet's views (cut, scale, datum), and the marks read off the sheet. Lock it with me before any fitting.
   Published sources for this type: <TCDS / factsheet links, or "find them">.
2. Birth the card: node tools/drafting/table.js new <plane.json> --key <nearest card> --ref refs/<key>.json
   (compare the candidates first: table.js compare refs/<key>.json --keys <a>,<b>).
3. The loop: table.js check <plane.json> --sheet <img> --png <prefix> (the key-measurements table, folds, the inside
   never showing, and the side / top / front overlays), table.js set <plane.json> '<rows>' --why "...", table.js fit
   for a scoped search of one step's rows. Order: the base geometry, the cabin and windows, the nose and cowl, the
   wing and struts, the tail, the gear, the engine. Send me the overlays (a published page, pictures in it, I am often
   on the phone) after each step and wait for my eye: where the drawing and my eye differ, my eye wins.
4. Every change is a garage row. A shape the garage cannot make: STOP, tell me, add it to REF_MATCH.md section 7,
   build the row on its own garage branch (claude/<branch>-garage) for A0, ABSENT at its default (no saved build,
   preset or join may gain a key: GATE STOL and PROCURE catch it), with its gate run, then use it.
5. Does it fly: bake the joined spec (tools/_bake_joined.js) and run tools/perf_study.js --build=<joined> --vs=<key>
   --fly (add a REAL row that READS refs/<key>.json, as pc6 does) - and --field=short for a STOL type's sheet.
   Compare only against the reference; take-off and landing within +-10 % are a match.
6. The plane file goes in flyDiy/builds/candidates/; GATE DRAFTING (tools/drafting/dt_check.js) keeps the table
   honest. Questions to me in plain text, each with "Default: ...".
```
