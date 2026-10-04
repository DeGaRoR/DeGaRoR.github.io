# SND-PROP — evidence (G1620–G1629, 2026-10-04)

The propeller voice, with the turbine and electric voices (SOUND-2026-10-04 §3.2–§3.4), rendered offline in node
from the **same files the browser loads** (`src/viewer/audio/prop_worklet.js` + SND-ENGINE's
`engine_worklet.js`, under the shim in `tools/audio/render.js`). Each engine is rendered as a **chain**, wired the
way `src_prop.js` wires it in the page: the driver voice (piston, turbine or electric), its control output
(engine rpm, prop rpm) fed **sample by sample** into the prop as its input, and the prop. So the prop turns with
the crank, the catch surge and the run-down the engine voice makes. The scenes give what the solver would
publish: prop rpm through its own law (`genShaftRpm` → `genEngineRpm`, V-dependent; constant-speed on the PT6),
thrust through its own law (thr × max(0, Tstatic − kV2·V²), sea level), V, alpha, sideslip.

**A/B in the game:** `?audio=0` turns all sound off (CORE). There is no prop-only switch.

Regenerate: `node tools/audio/render_prop.js` (all), `--only=cub,pt6`, `--wav`, `--bench`, `--calibrate`.
Opus 48 kb/s mono, 48 kHz render. Each file is **engine + prop mixed** (exterior, mono: directivity and the
cabin are SND-SPACE's, wave 3).

**The spectrograms** are log-frequency, 20 Hz (bottom) to 8 kHz (top), octave ticks on the left edge
(31, 62, 125, 250, 500 Hz, 1, 2, 4, 8 kHz), 80 dB of range. **White dots: the blade-passage frequency (BPF)
the prop should have** at its live rpm (prop rpm / 60 × blades). On the 582, **cyan dots: the engine's firing
frequency**, which the gearbox puts 2.62× above the BPF. On the direct-drive flat-fours with two blades (the
Cub, the Jodel, both Cessnas' prop row) **the two are the same number**: the firing line and the BPF line are
one line (SND-CORE's tuning note).

## The props (`propSoundConfig`, `src/viewer/audio/prop_config.js`)

| build | driver | blades | D (m) | gear | gear teeth | rated prop rpm | BPF rated (Hz) | static Mh (full) |
|---|---|---|---|---|---|---|---|---|
| cub | A-65 (piston) | 2 | 1.91 | 1 | — | 2300 | 76.7 | 0.62 |
| jodel | A-65 (piston) | 2 | 1.83 | 1 | — | 2300 | 76.7 | 0.60 |
| cessna | custom flat-4 5.9 L | 2 | 1.905 | 1 | — | 2450 | 81.7 | 0.66 |
| cessnaMetal | O-540 | 2 | 2.06 | 1 | — | 2575 | 85.8 | 0.75 |
| cessnaFloats | O-540 | 2 | 2.06 | 1 | — | 2575 | 85.8 | 0.75 |
| twin582 (×2) | Rotax 582, C-box | 2 | 1.91 | 2.62 | 21 / 55 | 2481 | 82.7 | 0.67 |
| pt6 (archetype) | PT6A-114A (turbine) | 3 | 2.69 | 1 | — (the PT6's planetary box: not modelled) | 1900 | 95.0 | 0.79 |
| electric (archetype) | Pipistrel E-811 | 2 | 1.91 | 1 | — | 2500 | 83.3 | 0.68 |

D is the solver's prop record (`def.params.prop`); blades the build's prop layer — the same numbers
`audio_params` puts in the block (the gate holds them equal). The PT6 archetype is the metal Cessna's airframe
on the Caravan's PT6A-114A and its three-blade 2.69 m Hartzell; the electric archetype is the twin-boom fixture
(`build_v8_twin-boom_2026-09-11.json`) on an E-811.

## What is in the prop voice

- **Tonal** — harmonics m = 1..8 at m·B·Ω. Each level is Gutin's: (steady loading + a thickness share) ×
  helical tip Mach × m × J_mB(m·B·0.8·Mh·sin 75°), the Bessel factor computed exactly per block. Loading is
  0.6 × thrust / static thrust + 0.4 × the lever (torque). Plus an **unsteady floor** (m^−1.3) that grows with
  incidence. The roll-off flattens as tip Mach rises: physics, not a table.
- **Snarl** — above helical tip Mach ≈ 0.82–0.85 the transonic tip's thickness pulse steepens toward a shock.
  Its spectrum is flat, so every m ≥ 2 rises toward the fundamental, with a mild saturation on top.
- **Broadband** — four span sections (r/R 0.45, 0.65, 0.80, 0.95). Each is a band-pass noise at St·U/t
  (St 0.2, U = hypot(Ω·r, V), t the section's nominal thickness), amplitude ∝ U³, scaled by the loading.
- **Chop** — the broadband (and 30 % of the tonal) amplitude-modulated at BPF. Depth 0.15 + 1.4 × incidence
  (|sin α| + 0.8 |sin β|, once there is airflow) + more in the cockpit. A 1P wobble (each blade loading and
  unloading once a revolution at incidence) adds sidebands around each tone.
- **Gear whine** — on geared engines, at engine rpm / 60 × pinion teeth (the 582's C-box: 21 → 2 093 Hz at
  5 980 rpm), with the torque. Quiet.
- **Beta buzz** — high tip speed with almost no thrust and the lever back (the PT6 at taxi: the governor holds
  Np, the blades flat). Upper harmonics up, blade-to-blade irregularity up: buzzy.
- **Blade irregularity** — each blade passage gets its own ±3 % gain (no real prop has twin blades).

## The files — what to listen for

| file | scene | listen for |
|---|---|---|
| `cub_runup` | static run-up: throttle 0 → 1 → 0 (solver's law at V = 0; full static is 2 116 rpm) | the prop **swelling over the engine** as the throttle opens: the 70 Hz drone (firing and BPF are the same note on this direct-drive two-blade), the **whoosh** (broadband) rising with tip speed; at idle the prop almost disappears under the putt-putt |
| `cub_takeoff` | full power, 0 → 22 m/s, rotation (alpha 0.02 → 0.14), initial climb | the rpm **creeping up** as the prop unloads with speed (genShaftRpm), the note brightening; at rotation a **slight chop** appears |
| `cub_climb` | full power at Vy, alpha 0.06 → 0.2, a sideslip coming and going (7–14 s) | the **"whop-whop"** at BPF in the climb, deepening with the sideslip: the climbing-turn sound |
| `cub_start` | key: crank, catch, cold idle, a burst, key off, run-down | the prop **turning with the cranking** (slow whooshes under the starter), the surge, then the prop **winding down with the engine** after the key off (not at once) |
| `cub_tipsweep` | a clipped long prop (2.3 m) on the A-65 pushed 1 800 → 3 150 rpm static: helical tip Mach 0.64 → 1.11 | **the snarl**: from about Mh 0.85 the tone turns rasping and harsh, upper harmonics climbing toward the fundamental — the "clipped-prop Cub" sound. (The rpm is forced past what the A-65 can do; the point is the tip Mach.) |
| `jodel_*` | as the Cub | the Jodel's **cruise-pitch 1.83 m** prop: a slightly lower tip Mach (0.60 static), so a little softer and less whoosh than the Cub, same engine |
| `cessna_*` | custom flat-4 5.9 L, alu 1.905 m | a bigger engine under a similar prop: a fuller mix |
| `cessnaMetal_*` / `cessnaFloats_*` | O-540, 2.06 m | **tip Mach 0.75 static, 0.81 climbing**: the prop dominates (the O-540's known ~10 dB dip above ~2 200 rpm, SND-ENGINE's list, lets the prop through even more); the prop's note sits **under** the six's 129 Hz firing |
| `twin582_runup` / `_takeoff` / `_climb` | one Rotax 582 + C-box 2.62 | **the gearbox's split**: a high, buzzy 199 Hz two-stroke over a low 76 Hz prop drone (cyan above white on the spectrogram), plus a faint **gear whine** near 2.1 kHz |
| `twin582_runup_twin` | both 582s + both props | two of everything at the same rpm (the solver gives both the same), each with its own seed |
| `pt6_start` | starter (Ng → 17 %), light-off, spool to idle (52 %), a burst, shutdown | the **compressor whine rising** with the spool (several tones, 8 kHz and up at idle, mostly above the plot), the combustion roar appearing at light-off, the prop **spooling slowly** to its governed 1 900 rpm, then the long **whine down** after shutdown (the prop windmilling down over ~15 s) |
| `pt6_taxi` | lever at 6 %, walking pace: Np governed at 1 900, thrust near zero | **the beta buzz**: the PT6's low, grainy, buzzing prop at taxi (tip Mach 0.79, no thrust), over the whine |
| `pt6_runup` / `_takeoff` / `_climb` | the PT6 on the power | the prop **loading up** at constant rpm (the whoosh and the tones rise with thrust and torque, the pitch does not move: constant-speed), the roar with the fuel flow |
| `electric_start` | the controller armed, the motor spinning up, a burst, off | **almost silence**: the motor's faint whine (torque ripple at 6 × 10 pole pairs × rpm, 2 kHz at 2 000 rpm), a whisper of PWM at 12 kHz, and the prop's own sound dominating once it turns; off, the prop **freewheels down** |
| `electric_taxi` | 6 % power, walking pace | the quietest file here: the case where the ambience will be heard over the aeroplane (§3.4) |
| `electric_runup` / `_takeoff` / `_climb` | full power | a **pure prop sound** (no firing pulses), the motor whine just audible under it |

## Measured (GATE AUDIOENG's prop sections, `node tools/audio/_prop_check.js`, ~40 s with the sabotages)

- **BPF** within ±0.01 % at four rpm across each build's range, on all eight builds (prominence ≥ 49 dB), the
  prop **driven by its engine voice's control output**.
- **The 582**: firing 199.3 Hz (+55 dB) and BPF 76.1 Hz (+54 dB) both in the mix, ×2.62 apart; the gear mesh
  2 093 Hz (+75 dB) in the tonal part. **The Cub**: firing = BPF = 70.5 Hz, nothing at the would-be mesh.
- **Snarl**: the upper-harmonic share (≥ 3.5 × BPF over the fundamental) rises from −12 dB at Mh 0.7 to +8 dB
  at Mh 1.0; the snarl itself adds 0.0 dB below Mh 0.8 and +3.6–4.0 dB at Mh 0.95–1.0, measured against the
  same voice with the snarl off.
- **Hygiene**: 23 engine+prop renders, peak ≤ 0.64 (bound 0.9), DC ≤ 4e-4, no NaN, no subnormal in the outputs
  or the voices' states; asleep 30 s after a shutdown with every state zero; hostile parameters
  (NaN / ±Infinity) and a NaN planted in a filter recover.
- **Allocation**: 0 GCs over 20 000 blocks of the prop (driven and fallback), the turbine and the electric
  voice; `AUDIO.update` with the engine and prop sources: 0 GCs over 10 000 frames, 7 µs a frame.
- **CPU per voice** (node 22, this container, 128-frame block, real time 2.67 ms): prop 0.008–0.016 ms
  (≤ 0.6 %), turbine 0.006 ms, electric 0.007 ms. The piston voice beside it: 0.03–0.06 ms.
- **Life**: the prop turns with the Cub's crank (BPF 8.8 Hz while the solver says 0 rpm); 0.4 s after the key
  off the prop is still at 65 % of idle, stopped by 5.5 s. PT6: Ng 52.0 % idle / 101.0 % full, 69 % 2 s
  after shutdown; first compressor stage exact (8 450 Hz at idle). Beta buzz 1.0 at taxi, 0 in the climb.
  E-811: torque ripple exact (2 000 Hz at 2 000 rpm), ×4 louder at full current. Chop: the broadband's
  envelope at BPF +32 dB climbing, 8.5 dB deeper than in level flight.
- **Negative controls**: 22 sabotages (blades, gear teeth, gear ratio, no whine, snarl off, NaN, clip, DC, no
  sleep, allocation, unwired prop, Ng idle, pole pairs, no chop, CPU, and in the sources: no wire, scheduling
  every frame, no rebuild, no hook in src_engine, an allocating update). Each turns its section red.

## For SND-TUNE (wave 4): the starting points the ear must set

- **The prop / engine balance** (`render_prop.js --calibrate`, full static RMS): the prop sits ~1 dB under the
  engine on the A-65s (0.083 vs 0.095), ~3 dB under on the custom flat-4, and dominates the O-540s (+10 dB), the
  PT6 and the electric. `propSoundGain` and the engine's `engineSoundGain` are both
  laws, not measurements.
- **The broadband**: share (0.5), the sections' thickness, the Strouhal number 0.2, Q 1.1. The whoosh may be too
  hissy on the big props.
- **The snarl's onset** (0.82–1.0) and lift (0.7 × the fundamental, flat); the saturation drive (1 + 1.2 × snarl).
- **The chop depth law** (0.15 + 1.4 × incidence), and how much of it reaches the tonal (30 %).
- **The thickness share** (0.25) and the unsteady floor (0.06): the upper harmonics at low tip Mach.
- **The gear whine level** (0.03) and the nominal teeth.
- **The PT6**: the nominal stage blade counts (26, 39, 44 + 30 impeller vanes); the whine's level (Ng²); the
  roar; the spool constants (1.5 s up, 6 s down + friction). The PT6's reduction gearbox (planetary, ~15:1) is
  not modelled.
- **The electric**: pole pairs (10 aircraft / 7 RC), PWM 12 / 16 kHz, the motor gain (0.012: deliberately faint).
- **Directivity, the cabin, doppler**: none here (SND-SPACE). The prop's output 1 keeps the tonal and broadband
  parts apart so SPACE can pan and filter them differently.
