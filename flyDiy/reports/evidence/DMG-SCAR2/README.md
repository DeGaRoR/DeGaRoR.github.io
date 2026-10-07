# DMG-SCAR2 (G2378-G2382) - the evidence

The ground's scar after a crash, second pass after the coordinator's box stills of 7 Oct (the Jodel's wing strike drawn
as a trail of identical round craters; the wreck still standing in tall grass; the runway's nose-over with no scuff).
The record (src/core/34_scar.js), the decal (src/viewer/ground_scar.js); the cull is DMG-SCAR's (cover_ring.js `scar`),
fed the new footprint. Node only; the coordinator shoots the box stills.

| file | what |
|---|---|
| `<build>_fly25.svg`, `<build>_stump.svg` | THE SIX CASES OF THE STILLS, from above, BEFORE (DMG-SCAR, 4575e99f's core and decal) and AFTER (this branch), at one scale per case: the ground (turf / the runway's concrete), the CULL AREA (pale), the DECAL as laid (its own triangles: the soil map's mean x each triangle's vertex colours at their alpha), the craters (dashed), the gouges' paths, the scar's hulls (red), the WRECK AS IT LIES at the run's end (blue dashed: the gate's own reader), the ground contacts the gate saw (grey dots). Made by `node tools/dmg_scar2_evidence.js --before <base flyDiy>`. |
| `cases.json` | The six cases' primitives, before and after; the join's counters (the last seal); the wreck's pieces. |
| `gate_dmgscar.txt` / `.json` | GATE DMGSCAR's whole output (`node tools/_dmg_scar_check.js`) and its per-build results. |
| `selftest.txt` | `node tools/_dmg_scar_check.js --selftest`: red with the record disabled, and red on the join's checks (2J) with the join disabled (`SCAR.join = false`). |
| `program_census.txt` | `tools/program_census.js --linkless` on the page (node's static server), damage on and off, the base (4575e99f) and this branch: the programs a boot and a roll-out link. |
| `battery.txt` | The targeted gates, one process and one log per gate. |
| `off_bytes.txt` | Gates with damage off (the default): this branch's stdout against the base's. |

## The numbers (sources AS RECALLED - A0 to open; GAME = no source, the game's own)

| constant | value | source |
|---|---|---|
| `joinT` - a slide that touches down again within this is the same furrow | 0.5 s | **GAME** (a bounce's time in the air at a rebound of up to 2.5 m/s: 2 vy / g) |
| `joinD`, `joinK` - where a hop lands round where its own speed carried it | 1.0 m + 0.3 x the hop | **GAME** |
| `vHand` - a contact slower than this hands its furrow to no other node | 1.0 m/s | **GAME** |
| `sod` - the turf's root zone | 0.07 m | AS RECALLED (turf root zone 5-10 cm) |
| `eBlow` - the least blow that leaves a crater: a bowl (d = r_b / 3) deeper than the sod | 970 J = pi qB (3 sod)^3 / 6 | derived from `sod` and DMG-SCAR's `qB` (200 kPa, AS RECALLED) |
| `stopK` - a blow STOPPED when its contact went on less than this x its bowl's radius | 2 | **GAME** |
| `throw` - a crater's spoil thrown down-range, x its radius | 0.3 | **GAME** |
| `mRest` - the margin round a resting piece's hull | 0.75 m | **GAME** |
| `maxHulls`, `hullPts` | 24 pieces, 16 points | **GAME** (caps; a dropped point widens the margin) |
| `vRest`, `restDt`, `restMax` - the wreck at rest (the hulls sealed again where it lies) | 0.5 m/s, read every 0.5 s, at most 10 s | **GAME** |
| `wScuff` - a scuff on hard ground at least this wide | 0.4 m | **GAME** |
| decal: `seg` 28, `rag` 0.25, `acrossHard` 12, `scuffA` 0.85, `SCUFF` 0.18 / 0.18 / 0.19, the wobble's 3-5-9 lobes and 1.9 / 1.1 / 0.75 m | - | **GAME** |
| the gate's readability: a scuff darkens the runway's albedo by 30 % or more, alpha-weighted, and is 10 px or more wide from the chase camera | 30 %, 10 px | **GAME** (the albedos are ground_tex.js's measured means; the lens 46 deg and viewDist are the game's) |
