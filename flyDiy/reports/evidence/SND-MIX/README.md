# SND-MIX — the page's mix, measured; the engine leads; an engine slider; music in flight at once (G1720-G1724)

The user's laptop test on train 36 (GTX 1660 Ti, 3-4 fps, the Jodel): *"the engine sound is much too faint compared to all
other noises"*, *"we need a slider for the engine noise separately from the rest of the airplane"*, *"turning the music on in
game did not work"*.

## How it was measured

`node tools/audio/mix_render.js` renders the page's WHOLE mix offline in node from the files the page loads (the engine
and prop worklets chained as the page chains them, the airframe worklet's three outputs, space.js's graph written out with
space_config.js's laws - directivity, absorption, the PannerNode's distance and pan from where app.js stands the chase
camera, the build's cabin transfer inside -, ambience.js + emitters.js on JOLENE in a vm under a recording context with the
shipped MP3s, a Radio Jolene track at its catalogue trim, a Norman take at music.js clipK) at audio.js's OWN settings and
gains (audio.js loaded in a vm), then the soft limiter's law. Per bus: integrated loudness (ITU-R BS.1770-4, K-weighted,
gated) and sample peak, at the master's volume; the master after the limiter, its gain reduction.

- Builds: the Jodel D112 and the user's Cub (both Continental A-65, direct drive, 2 blades).
- States: **idle** on the stand (lever 0); **taxi** at ~1500 rpm, 5 m/s; **climb** full power at Vy (machine sheet: Jodel
  26.1 m/s, Cub 22.5); **cruise** lever 0.75 at Vc (35.3 / 31.4 m/s). Cockpit = interior, canopy closed, headset off; chase =
  0.62 x viewDist behind, 0.15 rad up.
- Ambience: Jolene at 16:00 (the game's day) - the stand at Jolene AFB (idle, taxi), over the forest at 120 m (climb), over
  the harbour's open water at 300 m (cruise). Emitters measured over 40 s (their gated loudness is the calls' level when
  they sound): calls in range on the stand (4 a 40 s), none at 120 m over the forest or 300 m over the sea (`-`).
- Radio: cruise only, 'music in flight' on, the start station (Radio Jolene); voice = one Norman take on the same bus.
- BEFORE: the same renderer run on the train-36 tree (+ snd-rollout), `mix_before.json`; AFTER: this branch, `mix_after.json`.
- Seeds: the page's (engine seed 1). See THE PHASE LOTTERY for why that matters.

## Before → after (LUFS at the master's volume; `-` = under the -70 LUFS gate / nothing in range)

| state | engine+prop | engine | prop | airframe | ambience | emitters | music | voice | master | peak | GR max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jodel idle cockpit | -56.1 → **-42.2** | -56.2 → **-42.2** | - → **-** | - → **-** | -53.5 → **-69.1** | -69.4 → **-** | - → **-** | - → **-** | -51.1 → **-41.6** | -37.3 → -29 | 0 → 0 |
| jodel idle chase | -46.6 → **-38.6** | -46.6 → **-38.6** | - → **-** | - → **-** | -31.9 → **-47.9** | -45.0 → **-61.8** | - → **-** | - → **-** | -31.2 → **-37.5** | -18.1 → -23.3 | 0 → 0 |
| jodel taxi cockpit | -39.8 → **-26.8** | -41.3 → **-27.3** | -53.1 → **-49.0** | -52.4 → **-42.4** | -53.5 → **-69.1** | -69.4 → **-** | - → **-** | - → **-** | -38.9 → **-26.2** | -29.5 → -17.7 | 0 → 0 |
| jodel taxi chase | -31.9 → **-23.9** | -31.9 → **-23.9** | -65.9 → **-57.9** | -59.4 → **-55.4** | -31.9 → **-47.9** | -45.0 → **-61.8** | - → **-** | - → **-** | -28.2 → **-23.3** | -16.4 → -16.9 | 0 → 0 |
| jodel climb cockpit | -30.5 → **-18.9** | -33.7 → **-19.7** | -35.0 → **-31.0** | -49.7 → **-39.7** | -57.0 → **-** | - → **-** | - → **-** | - → **-** | -29.8 → **-18.3** | -25.3 → -12.8 | 0 → 0 |
| jodel climb chase | -24.4 → **-16.4** | -24.5 → **-16.5** | -49.7 → **-41.7** | -52.4 → **-48.4** | -36.6 → **-52.9** | - → **-** | - → **-** | - → **-** | -23.7 → **-15.9** | -15.8 → -10.7 | 0 → 0 |
| jodel cruise cockpit | -33.2 → **-20.7** | -35.0 → **-21.0** | -38.7 → **-34.7** | -43.1 → **-33.1** | -56.6 → **-** | - → **-** | -21.9 → **-27.9** | -18.7 → **-24.7** | -21.0 → **-19.2** | -3.6 → -8.6 | 0 → 0 |
| jodel cruise chase | -26.0 → **-18.0** | -26.0 → **-18.0** | -53.3 → **-45.3** | -44.6 → **-40.6** | -34.4 → **-50.7** | - → **-** | -21.9 → **-27.9** | -18.7 → **-24.7** | -19.8 → **-17.0** | -3.7 → -7.9 | 0 → 0 |
| cub idle cockpit | -54.0 → **-40.1** | -54.1 → **-40.1** | - → **-** | - → **-** | -50.5 → **-66.4** | -67.5 → **-** | - → **-** | - → **-** | -48.4 → **-39.5** | -34.5 → -26.5 | 0 → 0 |
| cub idle chase | -46.6 → **-38.6** | -46.6 → **-38.6** | - → **-** | - → **-** | -31.9 → **-47.9** | -45.0 → **-61.8** | - → **-** | - → **-** | -31.2 → **-37.5** | -18.1 → -23.3 | 0 → 0 |
| cub taxi cockpit | -37.6 → **-24.9** | -39.5 → **-25.5** | -49.5 → **-45.4** | -52.1 → **-42.1** | -50.5 → **-66.4** | -67.5 → **-** | - → **-** | - → **-** | -36.7 → **-24.3** | -27.7 → -15.9 | 0 → 0 |
| cub taxi chase | -31.9 → **-23.9** | -32.0 → **-24.0** | -64.6 → **-56.6** | -59.4 → **-55.4** | -31.9 → **-47.9** | -45.0 → **-61.8** | - → **-** | - → **-** | -28.2 → **-23.3** | -16.4 → -16.9 | 0 → 0 |
| cub climb cockpit | -27.9 → **-16.9** | -32.1 → **-18.1** | -32.2 → **-28.1** | -52.7 → **-42.7** | -54.0 → **-69.3** | - → **-** | - → **-** | - → **-** | -27.3 → **-16.4** | -24 → -11.6 | 0 → 0 |
| cub climb chase | -24.4 → **-16.4** | -24.6 → **-16.6** | -48.5 → **-40.5** | -57.1 → **-53.1** | -36.6 → **-52.9** | - → **-** | - → **-** | - → **-** | -23.6 → **-15.9** | -16.1 → -10.7 | 0 → 0 |
| cub cruise cockpit | -30.7 → **-19.0** | -33.6 → **-19.6** | -35.5 → **-31.4** | -45.1 → **-35.1** | -53.6 → **-69.3** | - → **-** | -21.9 → **-27.9** | -18.7 → **-24.7** | -20.8 → **-17.8** | -3.9 → -7.6 | 0 → 0 |
| cub cruise chase | -26.0 → **-18.0** | -26.1 → **-18.1** | -52.0 → **-44.0** | -47.4 → **-43.4** | -34.4 → **-50.7** | - → **-** | -21.9 → **-27.9** | -18.7 → **-24.7** | -19.8 → **-17.0** | -3.9 → -6.9 | 0 → 0 |


Reading it: BEFORE, outside at idle the airfield's bed was **15 dB over the idling engine** (-31.9 vs -46.6); in cruise the
radio was 4-11 dB **over** the engine. AFTER, in every state and both views the engine (+ prop) is the loudest thing; in the
cockpit the wind is a clear second (12 dB under at cruise in the Jodel, 16 in the Cub; more in the climb at Vy), the ambience and the animals are gone
under it (-66 to -69 LUFS, or under the gate); outside at idle the engine leads the airfield by 9 dB and the emitters by
23 dB; the radio sits 7 dB under the engine in the cockpit and 10 dB under in chase, Norman 4 / 7 dB under. The limiter
never reduces (GR 0 dB in all 16 states; the loudest peak -6.9 dBFS).

## The knobs (dB) and why

| knob | where | before | after | why |
|---|---|---|---|---|
| MIX.engine | audio.js, the engine groups' inputs (space.js applyLevels), out of the shed | 0 | **+8** | the engine voice was 15-25 dB under the shipped beds and music, mastered at -16 LUFS |
| MIX.interior | audio.js `intTrim` after the viewpoint fader's interior side, out of the shed | 0 | **+6** | the cabin's insulation stays the build's (ruling s5); this is the cockpit's listening level, so the cockpit is not 9-12 dB under chase at the same throttle |
| MIX.airframe | audio.js, the airframe group + its interior-only node | 0 | **+4** | keeps the wind a clear second (10-12 dB under at cruise) once the engine rose |
| MIX.ambience | audio.js, the ambience bus out of the shed | 0 | **-6** | flavour from the ground |
| MIX.ambienceRun | audio.js, the ambience bus while an engine runs (ramped ~3 s) | 0 | **-10** | under a running engine the world is flavour; a parked aeroplane with its engine off hears its world at -6 only |
| MIX.music | audio.js, the music bus in flight | 0 | **-6** | the music sits under the engine; the shed's and the loading screens' level unchanged |
| CABIN_TONAL_DB | space_config.js, the prop's TONAL into the cabin | 0 | **-10** | the phase lottery below |

The garage is untouched: every trim is out of the shed only (the shed stays faint, as ruled; the roll-out shot is in the
shed, GATE ROLLSND unchanged).

## THE PHASE LOTTERY (G1721) - one cause of "much too faint"

In a direct drive the 2-blade prop's blade-passage tone IS the flat four's firing frequency (70.5 Hz at 2116 rpm), and the
two voices are phase-locked by construction at an angle each session draws by chance (the crank's seeded start, the prop
node starting a block or more apart). Summed in the cabin at like levels they cancel at bad angles. Over 12 starting angles,
through the build's cabin (mix_after.json / mix_before.json `lottery`):

| | before: e+p vs the power sum | spread of e+p over 12 angles | after (tonal -10 dB in the cabin) | spread |
|---|---|---|---|---|
| Jodel climb | -11.6 .. +1.6 dB | 13.2 dB | -2.9 .. +0.9 dB | 3.8 dB |
| Jodel cruise | -9.3 .. +1.6 dB | 11.0 dB | -2.2 .. +0.8 dB | 3.0 dB |
| Cub climb | -11.7 .. +1.5 dB | 13.1 dB | -3.4 .. +0.9 dB | 4.4 dB |
| Cub cruise | -12.1 .. +1.7 dB | 13.8 dB | -2.8 .. +1.0 dB | 3.7 dB |

Two angles in twelve lost 10-13 dB of the power plant in the cockpit: a session's draw could be the laptop's faint engine.

## Low frame rate (G1724)

At 3-4 fps the sources' parameters arrive every ~0.3 s; with the old 30 ms setTargetAtTime each frame was a 30 ms step - a
staircase on every throttle move. audio.js now publishes `tauS` (0.6 x the smoothed dt, 30-250 ms): the engine, the prop,
the airframe, the space's gains / panners / doppler and the emitters' panners use it. A throttle ramp idle -> full -> idle
with the parameters at 3 fps (`lowfps.json`, the lever's peak slope over the commanded ramp's): 60 fps 1.26x; 3 fps with
30 ms **10.55x** (a jump each frame); 3 fps with the frame tau **2.04x** (a glide). The engine's own rpm already glides (the
voice's inertia, 0.3-0.45 s).

## Files

- `mix_before.json`, `mix_after.json` - every row (buses, limiter, settings, trims, the cabin, rpm, V) + the lottery
- `jodel_{cockpit,chase}_{idle,climb,cruise}_{before,after}.ogg` - the master after the limiter, 8 s each, at the page's
  level (no listening gain: the before/after difference is the point). Cruise with the radio on.
- `jodel_ramp_{60fps,3fps_tau30ms,3fps_frametau}.ogg` - the throttle ramp, engine + prop, at the voice's level
- `lowfps.json`
- The box script: `tools/perf/mix_meter.js` (below)

## What to listen for

- **cockpit cruise, before vs after**: before, the radio is the loudest thing and the engine a hum behind it; after, the
  engine's drone and its firing pulse lead, the wind's hiss is a clear second, the radio sits under both (still clear).
- **chase idle, before vs after**: before, the airfield's bed (birds, distant wind) is over the idling engine; after, the
  engine's slow lumpy idle leads, the airfield is a faint bed behind it.
- **cockpit climb**: the full-power roar with the prop's broadband; no hollowness (the tonal no longer fights the exhaust).
- **the ramp, 3 fps 30 ms vs frame tau**: the 30 ms one climbs in audible steps three times a second; the frame tau glides
  like the 60 fps one (slightly behind it: the price of 3 fps).

## The box script (the Coordinator's: cloud sessions cannot render the game)

`tools/perf/mix_meter.js`: open the page, click once, paste the file into the DevTools console, then fly the Jodel and, at
each state held steady, `SNDMIX.split('jodel cruise cockpit')` (6 s of every bus, then the engine alone and the airframe
alone, 4 s each - the volumes put back) or `SNDMIX.mark(label)`; `SNDMIX.table()` prints / copies the markdown table,
`SNDMIX.stop()` removes the taps. It taps AUDIO.bus('aircraft' | 'ambience' | 'music' | 'ui' | 'master') read-only (a
K-weighting pair of biquads per bus -> one analyser a channel), BS.1770 gating, and the limiter's own `reduction`. Smoke-
tested here in headless Chromium on the real dev.html (a 1 kHz tone into ui read -26.1 LUFS, as computed); the game itself
does not get past its loading screen under SwiftShader here. Expect the page's rows within ~1-2 dB of the offline table
(the offline one leaves out the doppler, the lag and the shed's room; the meter's K-weighting is the biquad approximation).
The bus 'master' is read before the fade and the limiter (the GR column is the limiter's).
