# G2470 JODEL-PITCH - the evidence

Mode: cloud, node only (no GPU, no browser flight; the PNGs are the SVGs rendered by headless Chromium).
Trees: **before** = `origin/claude/pilot-integration` **9546d2e** (train 40 + ENGINE-TORQUE G2080 + ROUTE-DRAW G2120), built
(`node tools/build.js`) in a scratch worktree; **after** = this branch's code tree **dbb3856** (30_solver's arm along the body,
GATE HEADING, the water's lead law), built. Every flight is the real sim and THE PILOT; the damage model ON where the gate has it.

| file | what |
|---|---|
| `jodel_descent.png` / `.svg` | the Jodel on GATE ROUTE's flight, t 360-480 s (WP3 -> WP4, 300 -> 220 m), ENGINE-TORQUE on: pitch + TECS's demand, elevator, vertical speed + asked, the Munk couple as applied - before red, after blue |
| `jodel_descent_noTQ.png` / `.svg` | the same with `PAR.propFx` all 0 (no propeller effects) |
| `route_{base,fix}_{jodel,jodel_noTQ,cub,metal}.json` | `tools/jodel_pitch_probe.js` summaries: GATE ROUTE's vertical-speed check (steps outside, worst), the pitch rate's peak and seconds over 5 deg/s, elevator reversals / min, vs-error rms, the elevator's range, the WP captures |
| `route_{base,fix}_jodel*.csv` | the 0.1 s traces the sheets are drawn from (`tools/jodel_pitch_plot.js`) |
| `circuit_{base,fix}_{cub,jodel,metal}.json`, `circuits_summary.txt` | `tools/pilot_trace.js <build> --quiet` HOME circuits of the user's Cub, the Jodel, the metal Cessna |
| `moment_budget.txt`, `moment_budget_patch.js` | the pitching-moment budget that found it (before tree): the aero pass sums to ~0 while the stab's moment grows - the Munk pair grows with it |
| `takeoff_water.txt` | the floats on the SEA lane: why they moved, the Wipline's fix, the twin (named) |
| `gates.txt` | every gate run, both batteries, and the base's own verdicts on the reds |

Re-run: `node tools/jodel_pitch_probe.js jodel [--propfx off] --csv out.csv` (copy it into a worktree of 9546d2e for the "before");
`node tools/jodel_pitch_plot.js before.csv after.csv out.svg`; `node tools/_heading_check.js [--show|--selftest]`.
