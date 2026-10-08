# WATER-DAMP (G2105-G2109) - the evidence

- `ditch_heave.svg` (and `.png`, its headless-Chromium render) - tools/ditch_osc_plot.js: the user's Cub, the Jodel and the metal Cessna ditched (0.3 m over the SEA
  lane, 22 m/s, sinking 1 m/s, throttle closed), master (train 37b's core) against G2105. Left: the heave 0-30 s. Right:
  from 8 s, in cm - master's limit cycle (the Cub 2.5 cm at 0.6 s, the Jodel ~5 cm at ~0.75 s, never decaying) against
  G2105's flat line. Hover a column for the numbers.
- `runs/before_<build>.txt|json`, `runs/after_<build>.txt|json` - tools/ditch_osc.js's tables, 60 s, 5 s windows (raw p-p
  and the oscillation alone: the window's straight line out) and the settle times (1 s windows).
- `runs/before/*.csv`, `runs/after/*.csv` - every frame: t, heave (m), pitch, roll (deg), thrust (N), rpm.
- The floatplanes (cfloats, twin): before and after byte-identical (`cmp`).

Regenerate: `node tools/ditch_osc.js --builds cub,jodel,metal,cfloats,twin --secs 60 --csv runs/after` (and `--core <master's
tools/flight_core.js> --csv runs/before`), then `node tools/ditch_osc_plot.js runs/before runs/after ditch_heave.svg`.
