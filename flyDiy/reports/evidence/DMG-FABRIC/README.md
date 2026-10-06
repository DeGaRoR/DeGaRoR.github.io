# DMG-FABRIC (G2040-G2043) - the evidence

The covering as a tension-only membrane: a cover tie per pair of frame nodes a covered panel spans once the frame
under it has parted (30_solver.js tieEvent / tiePass, 60_gen_spec.js GEN_COVER, 61_gen_frame.js parts.dmg.cover).
Damage ON with the certificate stamped, the validated aeroplanes in DMG-TUNE's standard crashes. BEFORE = the ties
disabled (`GEN_COVER.on = false`: the base claude/dmg-tune 849058d8's physics to the bit - GATE DMGFABRIC section 5);
AFTER = this branch. The Cessnas fly JOIN-PARITY's page-loaded spec (DMG-TUNE's `specs/`), the others the file as written.
Regenerate:

```
node tools/dmg_tune_evidence.js --certs <dir>     # the envelopes once (FLYDIY_SPEC_DIR=reports/evidence/DMG-TUNE/specs)
FLYDIY_SPEC_DIR=reports/evidence/DMG-TUNE/specs FLYDIY_CERT_DIR=<dir> node tools/dmg_fabric_evidence.js --sweep sweep.json
#  the sensitivity rows: DMG_FABRIC_SET=tuN=9806.6 (56 lb/in) / tuN=18914 (108 lb/in) ... --modes on --builds cub,jodel,twinFloats --crashes trunk0,trunk25
node tools/dmg_fabric_plots.js --sweep sweep.json --out reports/evidence/DMG-FABRIC --sens56 sweep_56lb.json --sens108 sweep_108lb.json
node tools/dmg_fabric_perf.js --ties              # the pass's cost a tie a substep (FLYDIY_CERT_DIR as above)
node tools/dmg_fabric_perf.js --pairs <the base's tools/flight_core.js>   # an intact aeroplane, alternating processes
```

| file | what it shows |
|---|---|
| `pieces.svg` | **The pieces after first contact, before (dashed blue: the ties off) and after (orange: the HELD pieces - the live members, the clusters and the live cover ties), one panel per build and 30 m/s trunk.** A piece is 1 kg or more; hover the dots for 0.5 / 1 / 2 / 4 s. The covering holds the Cub's struck outer wing (2 -> 1 for 1.3 s, 3 -> 2 after), the twin's (2 -> 1 at 0.5 s, 6 -> 4 at the end), 3 of the Cub's 15 centreline pieces; the rest of the partings are joints no one covering spans (wing roots, struts, the engine mount, the gear, the stab). |
| `share.svg` | **The largest piece's share of the aeroplane's mass, before and after.** The Cub's wing strike holds 100 % until the ground slam at 1.3 s takes the engine mount too (a divergence of the run, not the ties: below and HANDOVER G2042). |
| `tears.svg` | **Each crash's ties: the tears (dots, seconds after first contact) and the covering still holding to the run's end (the bar, the live count at its right).** Fabric holds every tie it makes on the Cub's and the twin's wing strikes and the Jodel's centreline; the Cub's cabin on the centreline tears within 0.1 s (the trunk goes through it at 30 m/s); the metal Cessna's sheet tears in 0.05-0.4 s, 13 of 30 still holding. |
| `table.md` | **The brief's measures** for every build and standard crash: members broken, pieces at 0.5 / 1 / 2 / 4 s, the largest share, the ties made / torn and when, the furthest piece at rest, the energy the covering took; and the fabric strength's sensitivity (56 / 80 / 108 lb/in). |
| `sweep.json`, `sweep_56lb.json`, `sweep_108lb.json` | every run's numbers (the series every 3rd frame). |
| `perf_ties.txt`, `perf_pairs.txt` | the cost: the solver's own tiePass on real wrecks (ns a tie a substep), and an intact aeroplane's step against the base's core. |
| `gate_dmgfabric.txt`, `gate_dmgfabric_selftest.txt`, `gates.txt` | GATE DMGFABRIC (and its selftest: red with the ties disabled), and the targeted battery (every DMG* gate, TREECRASH, TREEHIT). |
