---
name: workbench-gates
description: Run and read flyDiy's test gates (tools/run_gates.js) - use before claiming a change works, before pushing a claude/ready/* ref, when a gate is red, or when asked which tests cover a file. Covers tiers, --only=, jobs, reading reds by check name against master, and re-pins.
---

# Running the gates (flyDiy / Wingsmith)

The runner is `node flyDiy/tools/run_gates.js`. Its registry is the `GATES` array inside that file (id, file, tier core|full, wall); there is no separate list. The whole toolset is in `flyDiy/tools/workbench/WORKBENCH.md`.

## Procedure
1. **Build first** if you touched `flyDiy/src/`: `node flyDiy/tools/build.js`. Many gates read `tools/flight_core.js`, not src. A stale build once made a revert look inert for 4 runs.
2. **Pick the gates that read your files**: `git grep -l <your file's basename> flyDiy/tools/`, then match those files to GATES rows. Run only those:
   `node flyDiy/tools/run_gates.js --only=ID1,ID2 --jobs=3 --no-build` (the `=` after `--only` is required).
3. **Read the verdicts by CHECK NAME, not by count.** A gate passes only if it prints exactly `GATE <ID>: PASS` on its own line. Anything else is a FAIL, even with exit 0.
4. **Is a red yours?** Run the same gate on plain `origin/master` from a `git archive` copy in your scratchpad, and diff the FAIL lines. Never `git checkout` in a tree where a run is going. If master gives the same text, the red is master's; name it as such.
5. **Never weaken a gate to pass.** A re-pin (a new expected value) is its own commit, with the reason in the message and in your ready note.
6. **A new gate** prints its counts on their own line and the verdict bare. Register `{ id, file, tier: 'core', wall }` in GATES, run it once through `run_gates.js --only=<ID>` and read the summary row.

## The box
- Gate batteries are CPU work. On the shared box keep to the lanes A0 gives you (`--jobs=3`).
- Never run a battery beside a GPU page run: boots go from 140 s to 270-360 s and pictures time out.
- A FULL battery (~330 jobs) takes 10-11 h, and only A0's trains run one.
- `run_gates` killed by a timeout loses ALL verdicts. Give it the time, or run fewer gates.

## Traps (add yours)
- Some gates start Chrome (CLOUD, CARDS...). They need a slot on the box like any page run.
- Wall-clock rows (RETRACT, SCENERYED 20b) go red under load. Re-run them alone before calling them red.
- The ready note lists the base sha, the gates run, each red by check name ("master's" or "mine"), and every re-pin with its reason.
