## L40h (A0, Wed 18 Nov 2026, 14:00 train, pushed ~17:00)
TAKEN (6): rock-study f67f07629 (rockExpoAt / rockGreenAt), world-rail-veg 23c10ee40 (no trees on stone, bushes in the rock's greenery), perf-bench f35df6861 (Pilot's 21 scenarios + perf_trace + PERF-TRACE-FORMAT.md), bench-button 03286b9fa (Game's in-game Benchmark: cold/warm loads with phases, sliders, menus), electric-trainer-2 5cf093fc8 (row 61 F-WETR, official; e811_velis = the installed 53 kg motor), scuff-wing a8dbd4afe (the scuff redesign, the user: as is).
DROPPED -> L40i 20:00: ls4-2, pc6-liveries, one-cessna-2 (real conflicts with electric-trainer-2 in plane_lists.json / candidates index.json / _gear_gen.js / realband_baseline; owners rebase on this master). rain-2 not ready.
BATTERY: 301 PASS / 61 FAIL. FIXED vs L40g: COMMITHYGIENE.
NEW REDS (named):
- GFX: "no device test outside welcome.js": src/viewer/perf_bench.js reads the device (its job: the benchmark's machine row) - Game to add it to the allowed list with the reason.
- MONOWHEEL: E, parked on the wheel + nose skid + one wingtip skid - FLAGSHIP (the E811 change / electric trainer) to check.
- TAILWHEEL: I, down & out lands HOME at 22.57 m/s, roll-out 0 deg - Pilot / FLAGSHIP to check against the E811 change.
NAMED for list:50 (rides L40i): DMGCERT BROKE UP with no BROKE AT (18 wing members kink at 7.4 g, nothing detaches).
