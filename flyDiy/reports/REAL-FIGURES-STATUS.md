# REAL-FIGURES status - claude/ready/ls4-arch-1 (22 Nov)

Content head: a8cbe6b81 (this file is the commit on top). Base: origin/claude/perf-codex 4421e5416 + origin/claude/ready/one-cessna-4 c4b9d76fe + origin/claude/ready/pc6-liveries-3 ce1476ef3 (plane_lists: their union), then claude/ready/ls4-3 (the LS4 release on master L40H). No built files.

## The rows the user could not find
- **LS4-alike**: list:97, reproduction, D-4LS4, builds/candidates/ls4_2026-11.json, alike ls4 (91 is now ONE-CESSNA's test copy). Candidates index row. real_refs PLANES.ls4.listRow 97.
- **Archaeopteryx-alike**: list:85 moved from next to reproduction, HB-WXA, builds/archaeopteryx_2026-11-10.json, alike archaeopteryx (the user 15 Nov: under Reproductions, battery first). PLANES.archaeo.listRow 85; GATE PLANELISTS' table / ALIKES / PENDING follow.
- list:87 (builds/ls4_2026-11-13.json, the LS4 WIP prototype) was the same aeroplane as the LS4-alike: now a deleted test-copy row, file gone (one plane, one file).
- No thumbs added: AIRCRAFT-LOOKS renders the Archaeopteryx (and checks the LS4's) after the rows land.

## Gates on this tree
- PLANELISTS PASS · REALREFS PASS · REALBAND PASS (written here) · GLIDE PASS (x4) · STOL PASS (captured here) · SKIS PASS (its absent-set pointed at the test copies ONE-CESSNA moved - it was red on the base - and blessed here)
- CANDIDATES FAIL, not this branch: buggy_2026-11.json, roadster_2026-11.json (CAR) and jodel_geo.json sit in builds/candidates/ unindexed - the same on origin/master and on all three bases.
- TOW FAIL, not this branch: CIRCUIT archaeopteryx (released at 88 m, capsized) and ALTIPORT (lands 55 m past the strip). Both rows are red on L40G too (archaeopteryx released at 18 m there). Owner TOW-LAUNCH. TOW takes 38 min here, over run_gates' 30-min spawn cap.
- JOINPARITY 4 FAIL: Cub and Super Petrel pass after the page re-capture (STRADDLE-FIX's meant mass move). Jodel node != page (the known master red), metal Cessna node != page and its engine-x row (both still red right after a fresh capture, so not stale fixtures; not run on the base), and the raw-loader census (the known master red).
