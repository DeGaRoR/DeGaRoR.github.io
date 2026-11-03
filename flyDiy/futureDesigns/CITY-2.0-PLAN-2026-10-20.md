# CITY 2.0: towns built the new way (A0, 20 Oct 2026)

The user, 20 Oct: "I'm still very frustrated over Metlakatla, so I think we need to start constructing this in a better
way, as planned. I'd like that we already launch cloud sessions ... that would code the new way of doing cities, and
that we try asap. Once we have that, I'll start considering that the sim is good."

Read first: `flyDiy/futureDesigns/METLA-2.0-HANDOVER.md` (in this branch). It holds the measurements, the levers already
on master, and the traps.

## The requirement (measured, not assumed)
- **An idle far town costs ~0 ms of CPU per frame and allocates nothing per frame.**
- **No per-house Object3D far away.** Today Metlakatla ON carries 279 house objects against 42 OFF, every one culled, and
  their matrix and cull work is paid every frame.
- **Per-frame town JS is O(near ring), never O(town):** detail, HLOD, traffic and life ticks, lotsNear, the shadow
  re-tags.
- **Built at cook time, not at boot:** far cells are static merged meshes from the cook.
- **The acceptance test** (A0 runs it on the box, with the HANDOVER section 5 rig):
  - ON adds at most 3 ms of loop at 4 km;
  - frames over 34 ms stay within ~1 point of OFF;
  - the close visit within 1.5 km of mk_sea has p99 ≤ ~50 ms;
  - no >100 ms frame is caused by the town.

## Standing constraints (the user)
- **Keep the procedural path.** Procedural unique houses, procedural waterfronts and the editor's piers with boats stay
  for the village and for every editor-drawn premises (user, 29 Sep). The cooked kit is for sown towns such as
  Metlakatla and for far towns. Never retire the procedural path.
- **The 30 kit archetypes stay**, including the 3 harbour ones (TOWNKIT-2026-09-27, user-approved). So do the kit streets'
  look (approved 30 Sep).
- **WYSIWYG:** the town looks the same in the editor and in flight. There is one build path.
- **No page-size (gz KB) work.** Function and performance only.

## Sessions (cloud first; the box only for measurement)

| session | where | G-block | owns | delivers |
| --- | --- | --- | --- | --- |
| CITY-A COOK | CLOUD | G3400-G3414 | the town pack format, the cook (`tools/premises_cook.js`, the townkit cook, `src/core/premises_packs.json` / `townkit_pack.json` writers) | the format spec first (`futureDesigns/CITY-PACK-FORMAT.md`, the first commit); then per-cell far merged meshes plus near instance tables for every house, outbuilding and prop of a sown town; GATE CITYCOOK |
| CITY-B RUNTIME | CLOUD | G3415-G3429 | the town host at runtime (`src/viewer/premises_host.js`, `townkit.js`, the town parts of `render_premises.js`, `scenery_life.js` ticks) | the "town ms" meter; the near-ring tick list; the host drawing a sown town only from the pack (far cells, then a near instanced kit); zero allocation per frame; GATE CITYHOST |
| measurement | A0, on the box | - | - | the section 5 A/B (metla_ab3) at each milestone; the stills for the user |

**Order inside CITY-B:**
1. The meter, and the near-ring tick list on today's town. These need no pack and give measurable gains on their own.
2. The host, against CITY-A's format spec. Read it from `origin/claude/city-a` (fetch it); until it exists, write against
   the spec's draft and keep to its names.

**The shared contract.** CITY-A owns `futureDesigns/CITY-PACK-FORMAT.md`. CITY-B proposes changes as a section at its end
on its own branch, and A0 merges them. Neither session edits the other's files.

## Rules for both sessions
- **Branches.** Push `claude/city-a` or `claude/city-b`, NEVER `claude/ready/*`. A0 lands them after the user's look.
  Report through a HANDOVER entry (asks for the user, numbers, what A0 must run on the box).
- **Rendering.** Cloud cannot render the game. Deliver code, node gates, counts, and an evidence SCRIPT
  (`tools/evidence/CITY-*.js`, or exact `tools/rollout_perf.js` command lines) that A0 runs on the box.
- **Gates.**
  - Run `node tools/run_gates.js --only=<IDs> --no-build`, never the whole battery.
  - The verdict line is exactly `^GATE ID: PASS$`.
  - Never `node -e require(gate)`. Use `node --check` for syntax.
  - The gates that read this code: PREMISES, PREMCOOK, TARR, KITHOST, TOWNKIT, METKIT, HOUSEWORKER, PAVEMENT, BUILD, plus
    your own new gate.
- **Traps** (from the HANDOVER section 6 and earlier):
  - GATE PREMCOOK needs the LIFTS regions of `render_premises.js` byte-identical.
  - GATE TARR lifts `render_premises` text from HLOD to texMean.
  - `premises_cook` lifts from HLOD to LOD_U: put new make()-level code outside those spans.
  - `matlib.js` is inlined. Touching it moves FLYDIY_BUILD, the parked cook goes stale, and FRAMECOST goes red. Avoid it.
  - Never bump the premises fixture `rev` (it wipes the user's WIP).
  - `premises_packs.json` 'default' is cooked from the record *as the page drops it* (`TOWN_OFF`). Re-cook the touched
    cells only.
  - A whole-build town (spawned within the 7 km geo reach) has no town part, so a hook on the part never runs.
  - The pavement merge joins parts whose boxes touch, so the town's roads need their own buckets.
- **The town flag.** Metlakatla stays behind it (default OFF; `?town=1` or the GRAPHICS 'towns' row) until A0's A/B passes.
  The `mk_sea` seaplane base stays standalone with the town OFF.
- **G-numbers.** Take them from your block. A0 renumbers at landing if needed.
