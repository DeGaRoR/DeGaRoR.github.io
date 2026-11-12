# REAL-PERENNIAL — what landing it takes (12 Nov 2026, REAL-FIGURES)

Not a ready branch: this is what one needs, for A0 to schedule. The work is on claude/practical-cerf-7fjpwp:
54c63605e (stamps), 0b4e7a5d2 (the gates, the how-to, the tools), 6e358d5e7 (built: the page only, from the DESIGN icons
of 39831863c), and this note. The how-to is tools/FIT_AND_VALIDATE.md, sections 12 and 13. HANDOVER entry: REAL-FIGURES
PERENNIAL.

## What it is

No core change, tools only.

| file | what |
|---|---|
| tools/_real_stamp.js | every real_check result stamped with what it was flown on; the report's freshness block |
| tools/_realband_check.js, tools/realband_baseline.json | GATE REALBAND (core, weight 2, ~2-4 min): the live set's quick band against a baseline |
| tools/_realrefs_lint.js | GATE REALREFS (core, 0.1 s): reference rows state their conditions; new references carry their trail |
| tools/lattice_overlay.js + .py | the flown lattice over quickshot's pictures (needs python3 + Pillow) |
| tools/fleet_scan.js | every build's mass / margin per tree, and the diff of two trees |
| tools/real_check.js, real_report.js, real_refs.js, run_gates.js | the stamp written / read, `--all` = the live set, the two gate rows, the rows' missing flaps |

## Landing it on master without the rest of practical-cerf

It can land alone. On origin/master 79724e428, all 21 PLANES rows of master's real_refs.js name files that exist.
- **real_refs.js:** keep master's. Bring over only the condition fixes REALREFS asks for:
  - flaps stated on the 8 distance rows, as in 0b4e7a5d2;
  - the Carbon Cub's V75 range in order.

  Then run `node tools/_realrefs_lint.js`. LEGACY lists the reference keys made before 12 Nov: add any master key it
  does not hold.
- **realband_baseline.json:** do NOT carry this branch's. Write it on the landing tree, after its core is built:
  `node tools/_realband_check.js --write`. The baseline is the core's numbers.
- **Evidence stamps:** results without a stamp read "unstamped" in the report, which is honest.
  `node tools/_real_stamp.js --backfill=<dir> --at=<commit>` stamps a folder whose README names the commit it was flown
  on.

## Landing it with the canon (the practical-cerf files)

The live set here names files that are only on this branch, or on claude/ready/ruckus:
- `jodel_geo`;
- `superpetrel_V4_2`;
- `ruckus_std_2026-11-09`;
- the four adopted cards' content.

They land with REAL-FIGURES-CANON.md's list. The baseline is then re-written on that tree, as above.

## The Drafting Table (claude/fit-procedure-drafting-table)

It is complementary: it covers phases A-C on a light page and leaves the flights to REAL-FIGURES. The interface is the
plane file's `ref` block. `real_check --ref` reading that block is the one piece the Drafting Table asks of
REAL-FIGURES; it is not built. The mapping and its gaps are in FIT_AND_VALIDATE.md section 13:
- sources as strings, with no date read or quality;
- `perf.Vs0` not yet an indicator;
- `perf.cruise` is not V75 unless the source states the power.
