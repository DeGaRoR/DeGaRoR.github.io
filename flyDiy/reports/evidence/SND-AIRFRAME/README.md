# SND-AIRFRAME — evidence (G1630–G1635, 2026-10-04)

Offline renders of the airframe voice (`src/viewer/audio/airframe_worklet.js`, the same file the browser
loads), **driven by the real solver**: each scene flies a validated build with `makeSim` on a stub world (flat
ground of one `GROUND_SURF` row, or a lake). Every 16 ms frame goes the way it does on the page:
`audio_params.js` fills the block from the sim, `airframe_model.js` turns it into layer targets and events,
the targets reach the worklet's params as `setTargetAtTime(τ 30 ms)` would, and the events arrive as port
messages. Made by `node tools/audio/airframe_render.js` (`--only=<scene>`, `--wav`, `--bench`).

**Everything is synthesis.** No recorded sample exists yet (the slots in `samples.js` are declared and empty),
so this is what the game sounds like today without any grains.

Each scene has three files:

| file | what |
|---|---|
| `<scene>_ext.ogg` / `.png` | the airframe alone, **exterior** output (what the camera hears outside) |
| `<scene>_int.ogg` / `.png` | the airframe alone, **interior** output (the cabin's mix, with a placeholder cabin low-pass; the stall warning, creaks and flap motor exist only here) |
| `<scene>_mix_ext.ogg` or `_mix_int.ogg` | the same perspective as the scene's camera, **with SND-ENGINE's voice** (rpm and load off the same block; the interior gets `src_engine`'s 1.4 kHz placeholder cabin) — this is how the balance between the layers sounds |

Opus 40 kbit/s mono, 48 kHz. The spectrograms are log-frequency (20 Hz – 8 kHz, ticks at the octaves from
31.25 Hz), 80 dB of range, time left → right. `summary.json` has every event (time, type, severity, wheel,
surface row, the sink and the ground speed at that moment), the contact changes and the peak and RMS levels.

## The scenes — what to listen for

### `cub_taxi_grass` — the user's Cub, 22 s, cockpit
A brisk taxi on **grass** (0 → 10 m/s), onto a **gravel** stretch at 9.8 s (5.9 m/s), braked from 10 m/s to a
stop at 17–19 s. **Listen for:** the grass's soft brush and low bump-rumble growing with speed; the change to
gravel's **crunch** (dense, bright grains); the tailwheel rattle under it; the brakes at the end (on gravel the
squeal is weak, 35 %, by design — it is a paved sound). The Cub is tube-and-fabric: no stall warning, no flap
motor.

### `cub_takeoff` — the user's Cub, 20 s, exterior
Full throttle on grass, the tail comes up (two light tail taps at 9.4 / 9.9 s as it bounces up), lift-off at
~11.3 s, climbing. **Listen for:** the ground roll rising with speed, then **cutting out** at lift-off, leaving
the wind rising with airspeed. In the mix: the engine dominates, the roll sits ~10 dB under it.

### `cub_firm_landing` — the user's Cub, 12 s, exterior
Arriving at 1.15 Vs with a **1.8 m/s** sink on both mains (severity 0.63), a small bounce (airborne 1.10–1.20 s:
no second touchdown — it is shorter than the debounce), the tail down at 6.0 s (a soft tap, 0.09), braked
roll-out. **Listen for:** the double hit of the touchdown (the tyre thump + the scuff), the suspension's
**thump** (the strut, mostly inside), a rolling load spike's thump at 0.8 s.

### `cessna_paved_landing` — the Cessna 172, 18 s, cockpit
Mains first on **paved** at 27 m/s with a 2.3 m/s sink, the nose wheel 50 ms later, a bounce, the roll-out,
**brakes** from 4 s down to a stop. **Listen for:** the **tyre chirp** at 0.50 s (the wheel spinning up: only
on paved, only after >= 1 s in the air above 12 m/s); the tread **hum** (a narrow band at ground speed / 3 cm,
falling with the speed: the descending line in the spectrogram); the **brake squeal** below 9 m/s (1.25 kHz
and its harmonic, wandering).

### `cessna_stall` — the Cessna 172, 24 s, cockpit
At 600 m: flaps to 30 % (**the electric flap motor**, 1–3 s: the Cessna is metal with an electric system),
power off, a slow pull. The **reed horn** comes on at **9.34 s** at alpha 0.230 rad — exactly the bottom of its
band (the build's stall alpha 0.305 at this flap, minus 0.075) — and rises in level and pitch as the margin
closes (it moans in), then holds through the stall and the nose drop. **Listen for:** the moan's onset, the
wind's buffet as alpha passes 75 % of the stall. The horn is in `_int` and absent from `_ext` (interior only).

### `floats_step_taxi` — the Cessna on Wipline floats, 26 s, exterior
Afloat, idle taxi, full power at 4 s, the hump, **on the step** at 7.4 s (the afterbodies dry), power back at
18 s, off the step at 23.9 s. **Listen for:** the slow heavy slaps in displacement, then the change to the
**step**: a fast light chatter and a steady spray hiss rising with speed; the slaps return as it comes off.

### `floats_water_landing` — the Cessna on floats, 16 s, exterior
Touching the lake at 25 m/s with a 2.8 m/s sink: a **splash** (severity 1.0) at 0.59 s, a skip, a second
splash at 1.50 s, the run-off on the step, off the step at ~9 s, settling. **Listen for:** the splashes, no
tyre sound at all (the water has its own), the spray fading with speed.

## Levels (summary.json)

| scene | ext peak / RMS | int peak / RMS | events |
|---|---|---|---|
| cub_taxi_grass | 0.288 / −38.7 dB | 0.222 / −39.1 dB | — |
| cub_takeoff | 0.176 / −40.4 dB | 0.145 / −39.0 dB | 2 tail taps |
| cub_firm_landing | 0.444 / −36.2 dB | 0.228 / −35.2 dB | 2 touchdowns 0.63, 2 thumps, the tail 0.09 |
| cessna_paved_landing | 0.560 / −33.0 dB | 0.376 / −33.2 dB | touchdowns 0.82 / 0.82 / nose 0.76, chirp 0.85, bounce |
| cessna_stall | 0.044 / −45.3 dB | 0.144 / −25.5 dB | (the reed is a layer, not an event) |
| floats_step_taxi | 0.283 / −33.6 dB | 0.215 / −39.3 dB | — |
| floats_water_landing | 0.502 / −28.6 dB | 0.275 / −34.9 dB | splashes 1.00, 0.75 |

No sample reached the output guard (±0.98) and no NaN reset happened in any scene. For scale: SND-ENGINE's
voices at full power peak at 0.19 (the Cub) and 0.34 (the Cessna), 0.10–0.18 RMS.

## CPU (`--bench`, node, per 128-frame block at 48 kHz)

| state | ms / block | % of real time |
|---|---|---|
| idle (the shed, parked) | 0.0013 | 0.05 % |
| cruise wind | 0.0037 | 0.14 % |
| take-off roll (wind + grass + rattle) | 0.0084 | 0.31 % |
| floats on the step | 0.0066 | 0.25 % |
| every layer at once + voices | 0.071 | 2.7 % |

A layer whose level is 0 at both ends of a block is not computed, so the voice costs what is actually heard.

## Not here / for SND-TUNE

Every level, band and rate is a first guess against the engine's level, not a match to a recording. The list
is in the HANDOVER entry (G1635).
