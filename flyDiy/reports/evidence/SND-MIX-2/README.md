# SND-MIX-2 — the airframe's own voices measured; the metal squeal named and tamed; the engine to 200 % (G1725-G1729)

The user, 2026-10-13, after SND-MIX (G1720-G1724, train 38): *"engine sound remains too faint compared to the rest (music
or other plane sounds, or ambient sounds). Even when at max... Your engine is quieter than a metal squeal, very abnormal."*

## How it was measured

`node tools/audio/mix_render.js --study=<tag>`: SND-MIX's offline renderer (the page's own worklets, space, beds, emitters,
radio, audio.js's own MIX and settings, then the limiter's law), extended (G1725) with the states SND-MIX never measured,
and with the airframe model's EVENTS now reaching the voice (SND-MIX drained them unheard):

- **taxiBrake**: taxi lever (~1500 rpm), 3 m/s on paved, brakes full. **pivot**: the same at 1 m/s, the rudder swinging.
- **touchdown**: idle, 1.2 Vs, 2 m/s sink, mains on paved at 3.5 s (the tail 0.6 s later): the touchdown, chirp, thump, then
  the rollout held at that speed (pessimistic: the real rollout slows).
- **turbulence**: cruise with nz 1 ± 0.6 g and the controls working (drives the creak).
- **stall**: 1.05 Vs. Neither the Jodel nor the Cub HAS a warning (wood / tube-and-fabric: `stallKind` none), so the reed
  is FORCED to measure the layer the Cessna-class builds carry.
- **flaps**: 1.3 Vs, the flaps run 0 → 0.5 over 2 s: the lever (both builds are manual); the electric motor FORCED (same reason).
- **grass**, **gravel**: 8 m/s, nz bumps; gravel with its recording (`gnd.gravel`, the only ground key that resolves).
- plus SND-MIX's idle / taxi / climb / cruise. Both views (cockpit closed, chase), the Jodel and the user's Cub.

Every airframe layer SOLOED (the others' levels zeroed, the events filtered): wind, ground, rattle, brake, creak, stall,
flap motor; touchdown, chirp, thump, lever. Per layer: integrated LUFS, short-term max (3 s), momentary max (0.4 s), sample
peak (`study_before.json` / `study_after.json`, `rows[].layers`). The engine's reference: the engine + prop's short-term
(3 s) median in the same state. The limiter's GR max and the master's peak per state; the engine slider at 200 % in every
state (`engineTop`).

## The metal squeal, named

Three synthesised voices of the airframe worklet (no recording backs any of them: `gnd.brake`, `gnd.squeal`, `gnd.thump`,
`stall.*`, `mech.flap` resolve to nothing in sfx_catalogue.json), all on the airframe bus at MIX +4 dB:

1. **THE BRAKE SQUEAL** (`T.brk`) - the prime one. A **pure 1250 Hz tone** (+ its 2nd harmonic), held for as long as the
   brakes are on while rolling under 9 m/s on paved: **3.9 LU under the engine in chase, 5.0-6.6 in the cockpit**, while
   taxiing on the brakes (a keyboard player taxis on the brakes all the time). A sustained tone at 1.25 kHz is far more
   salient than its LUFS says: by ear it was the loudest thing on the airfield.
2. **THE TOUCHDOWN CHIRP** (VK_CHIRP 2300 → 1500 Hz) - **+12 to +18 LU** (momentary) over the idling engine; the touchdown
   thud +10 / +17.5, and the rollout's ground roar **+14 / +17 LU in the cockpit** (the structure-borne rumble at 1.4).
3. **THE STALL REED** on the builds that have one: **+13 / +15 LU** over the engine at approach power; the flap motor +7 / +8.

The creak (520 / 1350 Hz resonators + 3.2 kHz ticks) was NOT it: 25-29 LU under in turbulence, 20-24 on grass.

## Before → after (everything against the engine + prop's 3 s loudness; full rows in `table.md`)

| state (Jodel; the Cub alike) | e+p LUFS | loudest texture | loudest transient | music | ambience | GR |
|---|---|---|---|---|---|---|
| cockpit taxi on the brakes | -26.9 | brake -6.6 → **-15.8** (friction, not a tone) | - | - | -42 | 0 |
| chase taxi on the brakes | -23.9 | brake -3.9 → **-13.1** | - | - | -23 | 0 |
| cockpit touchdown, idle | -38.8 | ground +17.0 → **-4.2** | chirp +18.2 → touchdown **+2.2** | - | -30 | 0 |
| chase touchdown, idle | -35.3 | ground +0.7 → **-9.2** | chirp +14.2 → touchdown **-2.2** | - | -12 | 0 |
| cockpit cruise (radio on) | -20.7 | wind -11.8 → **-16.5** | - | -6.1 → **-10.1** | gated | 0 |
| chase idle | -38.6 | - | - | - | -8.5 → **-8.8** | 0 |
| cockpit grass 8 m/s | -26.8 | ground -6.1 → **-21.3** | thump -6.2 → **-11.6** | - | -42 | 0 |
| cockpit stall (reed forced) | -30.9 | stall +14.9 → **-2.7** (an alarm, kept just under) | - | - | gated | 0 |
| cockpit flaps (motor forced) | -30.5 | motor +8.4 → **-11.1** | lever -4.9 → **-8.9** | - | gated | 0 |

The limiter: GR 0 dB in every state, before and after; the loudest peak at 100 % -6.8 → -8.6 dBFS; at the engine's 200 %
**-4.3 dBFS** (the Cub's cruise chase), GR still 0.

## The targets (the Coordinator's), after

- Engine + prop the loudest continuous source by ≥ 8 LU (cockpit) / ≥ 6 (chase): **met in every state but one** - the
  cockpit at the instant of an idle touchdown rollout held at 1.2 Vs (ground -4.2 / -5.4, wind -8.8 / -12). The engine is
  at IDLE there (-38.8 LUFS, 18 dB under its cruise): meeting 8 LU would make the ground inaudible at taxi. Named for the
  Coordinator: the engine voice's idle-to-cruise range in the cockpit (21.5 dB; a real light aeroplane ~12-15 dB) is
  SND-ENGINE's law, not touched here. (The stall reed, -2.7 / -4.4, is an alarm, forced on builds that have none.)
- No airframe texture within 6 LU of the engine: met but for that same rollout (ground -4.2 Jodel, -5.4 Cub).
- Transients ≤ ~+3 LU over the engine at that moment: **met** (the touchdown at idle +2.2, the chirp now -7.7).
- Music ≥ 10 LU under in the cockpit in flight: **met** (-10.1 Jodel, -11.8 Cub; -12.8 in chase). Ambience and emitters
  ≥ 15 under in flight: **met** (climb / cruise: -31.8 or under the gate).
- The garage and the loading screens: untouched (every change is in the airframe's voices, which do not sound in the shed,
  and in the out-of-the-shed trims; the engine's 200 % stops at 100 % in the shed - GATE AUDIO MIX).

## What changed

| where | what | before | after |
|---|---|---|---|
| airframe_worklet.js, the brakes | the layer's sound | a held 1250 Hz tone at 0.05 | a FRICTION band (noise, 750 Hz, Q 1.4) at 0.2, breathing with the wheel; the tone a 0.006 trace that comes and goes |
| airframe_worklet.js, the chirp | amplitude; the tone in it | k(0.06 + 0.14 s); sine 0.8, Q 2 | k(0.01 + 0.025 s); sine 0.15, Q 1.1 (a scrub, not a whistle) |
| airframe_worklet.js, the touchdown | thud amp / its cabin share; the crack | k(0.08 + 0.35 s) / 1.1; k(0.05 + 0.15 s) | k(0.035 + 0.15 s) / 0.45; k(0.02 + 0.06 s) |
| airframe_worklet.js, the thump | its cabin share | 1.2 | 0.8 |
| airframe_worklet.js, the ground | the structure-borne rumble; the tread hum | 1.4; 2.5 | 0.2; 1.2 |
| airframe_worklet.js, the rattle | the cabin share | 0.6 | 0.3 |
| airframe_worklet.js, the stall | the reed / the buzzer | 0.12 / 0.07 | 0.025 / 0.015 |
| airframe_worklet.js, the flap motor | inside / outside | 0.05 / 0.012 | 0.008 / 0.004 |
| airframe_model.js | the ground past 12 m/s; the closed cabin's wind | grows as vr^1.1 to 2.5x; 0.1 | holds (gndHi 0); 0.09 |
| audio.js MIX | airframe; music | +4; -6 | **0; -10** |
| audio.js SETTINGS 'engine' | the top | 100 % | **200 %** (+6 dB); the shed holds it at 100 % |

**"EVEN AT MAX" - the slider's headroom, not a higher base.** The engine slider now goes to 200 % (+6 dB) out of the shed
(the rails and the boombox panel). Why not raise the base: the measured fault was RELATIVE - synthesised airframe voices
beating the engine - and it is fixed at its source; the engine's absolute level is the player's taste, and the limiter has
the room (the loudest state at 200 % peaks at -4.3 dBFS with no gain reduction). A higher base would have spent that
headroom for every player and moved the measured SND-MIX balance (the wind, the radio) with it.

## Files

- `study_before.json`, `study_after.json` (+ `.txt`, the per-state lines): every row, every layer, the engine at 200 %
- `table.md`: the compact before → after table, every build x state x view (`node tools/audio/mix_render.js --table2`)
- `jodel_cockpit_taxibrake_{before,after}.ogg`, `jodel_cockpit_cruise_{before,after}.ogg`,
  `jodel_chase_touchdown_{before,after}.ogg`: the master after the limiter, 8 s, at the page's level

## What to listen for

- **cockpit taxi on the brakes**: BEFORE, a steady whistle at 1.25 kHz rides over the engine's 1500 rpm for the whole 8 s -
  the "metal squeal". AFTER, the engine's lumpy taxi rpm leads; under it a soft grinding hiss from the brakes, with now
  and then a faint squeak that comes and goes.
- **chase touchdown**: BEFORE, a sharp tyre whistle and a slam well over the idling engine, then a roaring rollout. AFTER,
  a short scrub and a muted thud at about the engine's level, the rollout a rumble under the idle.
- **cockpit cruise**: the radio a little further under the engine (-10 LU, was -6), the wind's hiss a softer second.

The box script for the page (`tools/perf/mix_meter.js`, SND-MIX) reads the buses, not the layers; the soloed-layer numbers
are the offline renderer's.
