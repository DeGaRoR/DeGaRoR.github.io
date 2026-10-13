# DMG-TUNE (G1893-G1897) - the evidence

Damage ON with the certificate stamped, the validated aeroplanes in the standard crashes. BEFORE = the base
(claude/dmg-integration 4300dc5); AFTER = this branch. The Cessnas fly JOIN-PARITY's page-loaded spec
(claude/join-parity-g1985, READY: the engine 65 cm forward of node's file), dumped as `specs/`; the Cub, the Jodel
and the twin the file as written. Regenerate:

```
node tools/dmg_tune_evidence.js --certs <dir>                  # the envelopes once (FLYDIY_SPEC_DIR=specs for the Cessnas)
FLYDIY_SPEC_DIR=reports/evidence/DMG-TUNE/specs FLYDIY_CERT_DIR=<dir> node tools/dmg_tune_evidence.js --sweep after.json --card
node tools/dmg_tune_evidence.js --ratios ratios_after.json     # every member's stamp over its physics
# sweep_before.json: the same --sweep, run before this branch touched the solver (= the base 4300dc58's core); ratios_before: DMG_TUNE_SET=body=0.1 (the base's stamp)
node tools/dmg_tune_plots.js --before sweep_before.json --after sweep_after.json --ratios-before ratios_before.json --ratios-after ratios_after.json --out reports/evidence/DMG-TUNE
```

| file | what it shows |
|---|---|
| `broken_by_part.svg` | **Members broken per ledger section (engines, bracing, wings, tail, gear, fuselage, tanks), every validated build in every standard crash, before and after.** One bar per run, stacked by section; hover a segment for its count; an "x" after the total marks a run that fails its plausible reference. The 2.5 m wing strike went from 10-153 members (an engine off on four builds) to 10-96 (every engine on but the twin's pod beside the trunk); the nose-over from 35-97 to 3-7 (the gear and the nose, nothing else). Still not plausible: the Jodel's wood wings in the wing strike and the twin's wing strike (HANDOVER). |
| `stamp_ratio.svg` | **Q1: the stamped break force over the member's own material x section (1.0 = its physics), per build and member class.** Before, the median member of nearly every class sat at 0.10 - the floor kappa: the certificate made 40-77 % of the airframe a tenth of its material. After: the wing (its members, joints and glue lines: the card's load path) unchanged; the fuselage, the engine mount, the tail and the tanks at least 0.5. |
| `sanity_table.md` / `.json` | **Q3: the sanity table.** Per crash: the reference in words (sources as recalled), then per build before / after / physics-only - members broken by section, plastic work, what came off - and whether it meets the reference's rule. |
| `groups.md` / `.json` | **Q2: the break-group census.** Every group that let go in the standard crashes, the member and the way that released it, and the largest load of the group's other members just before. Before: most releases were ONE member of many (a mount tube kinking, one stab fitting of 32). After: one member never releases a group of several; a third of its strength broken (severed, or kinked - the kink floor pushes only) does. |
| `card.txt` | GATE DMGCERT's test to destruction on the five builds after the change (BROKE AT, the first group, the first member). |
| `gates/` | the targeted battery's output (this branch and the base), `battery_vs_base.txt`. |
| `perf/` | the step's cost, nothing touching, damage ON and OFF, alternating processes (perf_runs.txt; pinned pairs pairs_*.txt, including the base's core against a copy of itself - the noise floor). |
| `sweep_before.txt` / `sweep_after.txt` | every run's one-line summary (and the cards). |
| `experiments/` | the knobs tried on the way, with the card each gave (README.md there). |
| `specs/` | JOIN-PARITY's page-loaded specs of the two Cessnas (data; dumped from its branch with its tools/_load_build.js). |
