# SND-ENGINE — evidence (G1610–G1619, 2026-10-04)

The procedural piston engine (SOUND-2026-10-04 §3.1), rendered offline in node from the **same file the
browser will load** (`src/viewer/audio/engine_worklet.js`, under the shim in `tools/audio/render.js`), for
the five validated builds. Nothing here is wired into the game yet: SND-CORE's bus connects the worklet
(see the HANDOVER entry for what the coordinator wires). There is no in-game A/B switch until then; the
switch will be CORE's `?audio=0`.

Regenerate: `node tools/audio/render.js` (all), `--only=cub`, `--wav` (keep WAV ≤ 1 MB instead of Opus),
`--bench` (ms per block), `--calibrate` (full-power level). Opus 48 kb/s mono, 48 kHz render.

**The spectrograms** are log-frequency, 20 Hz (bottom) to 8 kHz (top), octave ticks on the left edge
(31, 62, 125, 250, 500 Hz, 1, 2, 4, 8 kHz), 80 dB of range. **The white dots trace the firing frequency the
engine should have** at the voice's own rpm (rpm/60 × cyl/2, × cyl on a two-stroke): the bright bottom line
should sit on them, and the gate proves it does within ±3 % (measured: ±0.01 %).

## The engines (`engineSoundConfig`, `src/viewer/audio/engine_config.js`)

| build | engine | cylinders from | layout | displ. | firing order | rated / idle rpm | gear | firing Hz rated / idle | headers + collector (m) | muffler | crank rpm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cub | Continental A-65 | table | flat-4, 4-stroke | 2.8 L | 1-3-2-4 | 2300 / 644 | 1 | 76.7 / 21.5 | 0.51/0.59/0.59/0.51 + 0.30 | 0.12 | 266 |
| jodel | Continental A-65 | table | flat-4, 4-stroke | 2.8 L | 1-3-2-4 | 2300 / 644 | 1 | 76.7 / 21.5 | same | 0.12 | 266 |
| cessna | custom flat-4 5.9 L | the custom row's name | flat-4, 4-stroke | 5.9 L | 1-3-2-4 | 2450 / 686 | 1 | 81.7 / 22.9 | 0.66/0.75/0.75/0.66 + 0.38 | 0.12 | 229 |
| cessnaFloats | Lycoming O-540 | table | flat-6, 4-stroke | 8.87 L | 1-4-5-2-3-6 | 2575 / 721 | 1 | 128.8 / 36.1 | 0.66/0.76/0.71/0.71/0.76/0.66 + 0.44 | 0.12 | 194 |
| twin582 (×2) | Rotax 582 + 2.62 | table | inline twin, 2-stroke | 0.58 L | 1-2 (360°/2) | 6500 / 1820 | 2.62 | 216.7 / 60.7 | 0.21/0.21 + 0.63 (tuned pipe) | 0.35 | 290 |

"table" = the declared fallback keyed by the POWERPLANTS row (these saves predate the join's sound row; a
re-save through the editor writes `spec.engines[i].sound` and the source becomes "spec.sound" with the same
numbers — GATE AUDIOENG §1 proves the join's row equals the table on all 27 catalogue piston presets).

## The files — what to listen for

| file | scene | listen for |
|---|---|---|
| `cub_sweep` | idle → rated → idle over 13 s, load following | the firing note rising from a 22 Hz putt-putt to a 77 Hz drone and back; idle **rough and uneven** (cycle-to-cycle jitter, the odd soft cycle), smoothing out above ~1 800 rpm; louder with load (~10 dB idle → full) |
| `cub_runup` | static run-up on the ground: throttle 0 → 1 → 0 through the **solver's own rpm law** (genShaftRpm at V = 0) | static max is 0.92 × rated (2 116 rpm): the prop holds the engine below redline on the ground |
| `cub_start` | key: 1.5 s crank (setEngine's), catch, cold idle, run-up, idle, key off | the starter's **whine** with the engine labouring through each compression (rur-rur-rur at ~266 rpm), two or three **coughs** as it catches, the **surge** to ~900 rpm and settle to idle, the **run-down** (~2 s, slowing then stopping, a stray last firing) |
| `cub_starve` | cruise, the last 20 s of fuel, dry at t = 20 s, windmilling at 45 m/s | misfires thickening into **coughs and pops in the exhaust**, the rpm **sagging** as it starves, then the combustion gone and the engine turned by the prop (windmill: hollow pumping, ~1 340 rpm) |
| `jodel_*` | the same three scenes | the same A-65 (its own random seed): the Jodel differs from the Cub by its prop, which is SND-PROP's voice |
| `cessna_sweep / runup / start` | as above | a bigger flat-4: lower crank (229 rpm), deeper pipes, more level |
| `cessna_hot` | a hot engine at idle, key off, 23 s after | the run-down, then the **exhaust ticking** as it cools: irregular metallic ticks, a few a second at first, thinning out (they continue for minutes, decaying with τ ≈ 150 s) |
| `cessnaFloats_*` | O-540 flat-six | six firings per two revolutions: a smoother, higher note (129 Hz at rated) |
| `twin582_*` | one Rotax 582 | the two-stroke: **every revolution fires** (217 Hz at 6 500 rpm), a ring-ding idle with more misses, brighter intake roar |
| `twin582_runup_twin` | both 582s summed (seeds 1 and 7920) | two voices at the same rpm (the solver gives both the same), decorrelated combustion jitter |

## Measured (GATE AUDIOENG, `node tools/audio/_engine_check.js`, ~3 min)

- **Firing frequency**: within ±0.01 % at six rpm idle → rated on all five engines (48 kHz), and on the Cub
  and the 582 at 44.1 kHz too (sample-rate independent); peak prominence ≥ 36 dB.
- **Hygiene**: 26 renders, peak ≤ 0.61 (bound 0.9), DC mean ≤ 9e-5, no NaN, no subnormal in the output or in
  1 762 pipe cells — including a 20 s free ring-down with the sleep off (54 731 subnormals without the bias:
  the negative control).
- **Allocation**: 0 GCs over 20 000 blocks through run / crank / run-down / ticks (heap +19.8 kB =
  the probe's own; the sabotaged voice: +6 MB).
- **CPU per voice** (node 22, this container): A-65 0.075 ms, O-540 0.111 ms, 582 0.051 ms per 128-frame
  block — 2–4 % of real time at 48 kHz.
- **Life, driven by the solver** (makeSim, the Cub, key off → start → idle → run-up → key off): crank
  195–266 rpm while the solver reads ≤ 6 (the settling aeroplane's windmill — it never turns a cranking engine;
  the voice does); catch surge to 904 over the solver's 644 idle, settled within 5 % by 4 s; run-down 30 % of
  idle after 1.00 s, stopped at 1.98 s (the solver: at once); ticks hot vs cold > 300 dB apart (cold: digital
  silence, the voice asleep); 86 % misfires starving vs 0 % in cruise; jitter sd 0.34 at idle vs 0.05 in cruise; prop = engine / 2.62
  on the control output; the M-14P's supercharger whistles, the O-540 does not.
- **Physics-inert**: resolveSpec + buildGen + 4 s of the solver bit-identical with and without the sound
  row, all five builds; the row survives the resolve.

## Known, for SND-TUNE (the user's ear decides; none of this is measured against a recording yet)

1. **The O-540 dips ~10 dB above ~2 200 rpm**: a pipe anti-resonance of the default lengths (the waveguide
   network is physically informed — it has real resonances). Tune `exhaustLen` / `extractorLen` for the
   flat-six, or soften `exhaustClosedRefl`.
2. **Cranking is louder than idle** (−28 vs −34 dBFS RMS on the Cub): the starter whine level
   (`starter.level` 0.02) is a guess.
3. **The levels are a law, not a fit** (`engineSoundGain`: 0.25 × (displ/2.8)^0.15 / √(cyl/4)); the five sit
   within ~6 dB of each other at full power.
4. Every pipe length, the muffler action and the jitter amounts are **starting points** derived from
   displacement and family; the firing frequency is the only thing held exactly.
