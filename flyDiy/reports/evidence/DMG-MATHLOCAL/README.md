# DMG-MATHLOCAL (G2370-G2372) - the evidence

- `census.txt` / `census.json` - tools/_core_math_sites.js on this branch: every Math.sin / Math.cos / Math.pow in src/core, its file,
  line, enclosing function, whether it is on CORE_MATH or kept the builtin (and why). 350 on CORE_MATH, 19 kept, 0 stray.
- `gates/DMGDETERMINISM.txt`, `determinism.json` - GATE DMGDETERMINISM (default + --selftest): node's 18 hashes and 3 certificates =
  9fca23c6's; Chromium 141's 18 = node's; THE PAGE'S Math UNTOUCHED row and its two red selftests (G2355's `const Math`, a
  `Math.pow` patch); the sources row; the census row. `gates/DMGDETERMINISM_run1_scan_read_a_comment.txt` / `determinism_run1.json`:
  the first run, red on the sources row only (its scan read a comment - fixed, G2371).
- `gates/*.txt` - the targeted battery's logs (each ends `exit=<code> wall_s=<s>`).
- `perf/ns_per_call.txt` - `scripts/ns_per_call.js <9fca23c6 core> <this core>`: ns a call, node (the builtin, 9fca23c6's top-level
  fsin / fcos / fpow, CORE_MATH) and a page (a viewer script's Math after 9fca23c6's core / after this core; CORE_MATH).
- `perf/step_ab_vs_9fca23c6.*`, `perf/step_ab_vs_integration.*` (dmg-integration f7b5afb4), `perf/step_aa_noise.*` (this core vs a copy
  of itself) - tools/dmg_drive_perf.js --rounds=8 --builds=cub,jodel,metal, FLYDIY_CERT_DIR = the three certificates.
- `gates/base_9fca23c6/DMGCERTCOST.txt` - the base 9fca23c6 built in a worktree on this machine, GATE DMGCERTCOST alone: red on the
  same node-time ceilings. `gates/DMGCERTCOST_alternating.txt` - this branch and the base alternated twice: red every run, the same spread.
