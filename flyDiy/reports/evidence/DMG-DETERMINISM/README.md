# DMG-DETERMINISM (G2353-G2356) - the evidence

- `stale_core/` - THE FINDING. `seq_*.txt`: the 30 m/s centreline (secs 5, DMG-COMPOSITE's hash.js scenario) and the nose-over flown in
  one process, damage off then on, the three land builds - on DMG-TUNE's core (`tune`, 849058d8 rebuilt), with G2048's untaken branch
  (`tune_br`), on DMG-COMPOSITE's tip (`comp`, ebb045b4 rebuilt) and with the branch (`comp_br`): 154 / 125 / 178 every time.
  `committed_core_t5.txt`: the same scenario on `git show 849058d8:flyDiy/tools/flight_core.js` (the COMMITTED generated core, blob
  b5004b69, the same on every DMG branch): 204 a474fbbd6ba2b8fe / 169 8873243509ec2bb5 / 208 44b1e9ea5f39a293 - DMG-COMPOSITE's
  "base" rows to the bit. Scripts: `scripts/seq.js` (FD=<a tree's flyDiy>, `node -r scripts/coreswap.js` with FDCORE=<a core file>).
- `tiers_full.json` - GATE DMGDETERMINISM --full --branch --selftest: every tier set on every case, the branch, the page, the selftest.
- `pow_trace/` - node 22's v8::base::ieee754::pow under gdb (scripts/gdbtrace.py), one argument where fdlibm's e_pow and node's differ:
  the instruction trace with xmm0-15; the divide at +2515 takes (t1 - 2) - (w + z w) as its divisor.
- `scripts/gen2pi.js` - 2/pi's 66 x 24 bits (fdlibm's two_over_pi) and n pi/2's high words from BigInt Machin.
- `amp_sweep.json / .svg` - the Jodel / Cub / metal Cessna centreline, 16 members nudged 1e-9 m, 1e-6 m, 1 mm.
- `tune_vs_base.json / .svg` - DMG-TUNE (849058d8) against its base (4300dc58), the Jodel's centreline, 32 members at 1e-9 m and 1 mm.
- `treecrash_ensemble.svg` - TREECRASH's reference ensembles (tools/fixtures/treecrash_ensemble_ref.json).
- `perf/` - the step A/B (tools/dmg_drive_perf.js, alternating child processes, the base = dmg-integration's core): `step_ab.txt` the
  final; `step_aa_noise.txt` the base against itself (the noise floor); `step_ab_dictionary_math_fixed_abs_not_yet.txt` a cut on the way.
- `gates/` - the targeted battery's logs.
