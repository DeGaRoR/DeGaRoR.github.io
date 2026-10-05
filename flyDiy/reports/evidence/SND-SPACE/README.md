# SND-SPACE — evidence (G1640–G1646, 2026-10-04)

The space around flyDiy's sound (SOUND-2026-10-04 §4 / §5, rulings s5 and s7), rendered offline in node by
`tools/audio/space_render.js`. It uses **the files the page loads**: the engine and prop worklets (render.js's shim,
wired as render_prop.js's chains, with the engine's control output feeding the prop) and `space_config.js`'s numbers
(the cabin transfer, the headset, the directivity, the air absorption, the retarded geometry and its doppler, the
shed's IR). The Web Audio nodes `space.js` asks the browser for are reimplemented to the spec's formulas: the
BiquadFilterNode coefficients come from `space_config.biquadCoefs` (the spec's RBJ cookbook), the PannerNode uses its
equal-power law and inverse distance, and the ConvolverNode is an FFT convolution. Nothing here is a mock of the page.
It is the same arithmetic, written out of time.

Regenerate: `node tools/audio/space_render.js` (all, ~11 s), `--only=cub_flyby,cessna_runup` (scene prefixes; it
rewrites summary.json with those scenes only), `--wav` (keeps WAVs beside the Opus files).
Stereo Opus 64 kb/s, 48 kHz render. The spectrograms are log-frequency, 20 Hz at the bottom to 8 kHz at the top, with
octave ticks on the left edge and 80 dB of range, each normalised to its own loudest bin, so compare shapes rather
than absolute levels (summary.json has the levels). `summary.json` holds every number quoted below.

**A/B in the game:** `?audio=0` turns all sound off. The perspective switches with the camera: the cockpit view is
inside, every other view outside. The cross-fade is now 150 ms at equal power. The headset is in the sound menu.

## What to listen for

### 1. The same run-up, inside and outside: the build's insulation (ruling s5)

`cub_runup_outside` / `cub_runup_inside`, `cessna_runup_outside` / `cessna_runup_inside` (+ `cessna_runup_inside_headset`).
A static run-up, 10 s: idle, then full throttle 4–8 s, then idle again. *Outside* is heard 15 m off the nose at 45°
(the exterior chain: exhaust / tonal / broadband directivity 0.62 / 0.27 / 0.75 at that angle, inverse distance with
the reference at the aeroplane's view distance (unity at 15 m), the air's low-pass at 10.5 kHz, equal-power pan to the
right). *Inside* is the same voice through the **cabin transfer computed from the build**:

| build | fuselage | cabin class | insulation (mean of the 250 / 500 / 1k / 2k octaves) | 4 kHz vs 500 Hz | boom | inside − dry, full power: overall / 63–250 Hz / 2–8 kHz |
|---|---|---|---|---|---|---|
| the user's Cub | tubeFabric | fabric | **8 dB** | −4.4 dB (weak) | — | **−8.2 / −8.1 / −15.2 dB** |
| the Cessna 172 | alloy | metal | **20 dB** | −17.0 dB (strong) | 150 Hz +6 dB | **−12.4 / −12.3 / −36.3 dB** |

The Cub should stay **loud and bright** inside: the whole spectrum comes down by about 8 dB and the top is barely
dulled. The Cessna should sound **muffled and boomy**: the engine's top end is gone (−36 dB above 2 kHz), while its low
firing harmonics come through with only ~12 dB of loss because the cabin's transverse mode (150 Hz) lifts them.
Overall that is −12 dB, against an insulation of 20 dB in the speech band: an engine's energy sits under 250 Hz,
where a metal cabin insulates least. That boomy-low, dull-high balance is the C172 cabin's character, and the rows
in the table come out of the spec, not a slider. `cessna_runup_inside_headset` adds the passive headset (−13 dB low,
about −23 dB high, a mean of ~15 dB): another ~13 dB of loss, darker still.

The other builds by the same rule (GATE AUDIO SP_CABIN): the Jodel is **wood** (11 dB, a light 150 Hz boom), both
Cessnas on the O-540 are metal (20 dB), and the twin-582 ultralight is **open** (cabin.glazing 'none': 2 dB, the
engine almost exterior). A door or window opened in flight (`AUDIO.space.setExits(1)`) moves any of them to the open
cockpit (MSFS's exits open / closed). Nothing in the game writes that state yet.

### 2. The fly-by: doppler, delay, absorption, directivity

`cub_flyby`, `cessna_flyby`: a pass at **60 m/s**, 40 m off a fixed listener, cruise power, from 1200 m before the
closest point to 1200 m after it (40 s). The aeroplane is placed **where it was** (the retarded solve over its ring of
past positions), its doppler (c − v_l·n) / (c − v_s·n) drives the worklets' `pitch` (smoothed, τ 40 ms, as in the
page), and the air's low-pass follows the distance.

- **The doppler drop**: the firing (= the 2-blade BPF on these flat-fours, the white dots) comes in **×1.212** and
  leaves **×0.851**. Measured off the render: the Cub **103.80 Hz in, 72.92 Hz out** against 103.80 / 72.92 predicted;
  the Cessna 98.02 / 68.85 against 98.02 / 68.85. The drop is fast near the pass, not a slide.
- **The delay**: at the start the sound you hear left the aeroplane **4.24 s** earlier (1.45 km away). At the closest
  point the delay is 0.117 s. The loudest moment comes after the aeroplane's true closest approach, as it does
  outdoors.
- **The absorption**: far away the air's corner is ~1.07 kHz, a dull drone. At the pass it is ~6.4 kHz, and the blade
  slap and broadband open up (the bright plume at the centre of the spectrogram). Level: −68 dB far, −40 dB closest
  (Cub).
- **The directivity**: the prop's tonal part is nil on the nose axis and peaks 14° behind the disc plane. Inbound
  (seen from ahead) the tones are thin. They swell through the pass and stay strong just after it, while the
  exhaust's aft-biased lobe carries the outbound drone.

### 3. The shed's room: an IR generated from its dimensions

`cub_hangar_club`, `cub_hangar_field`: the same run-up 8 m in front of the eye inside the shed (the room mode: in the
garage, no space and no doppler). It is heard dry plus the shed's IR at a send of 0.25 (modest: the room sits under
the sound). The IR comes from the shed's own HW / HD / EAVE and shell: Sabine per octave with the air's 4mV and the
open front door (α 1), then octave bands of noise decaying at each band's RT60, independent noises left and right
(decorrelated), unit energy, a pre-delay of the nearest surface's path.

| shed | inside (m) | volume | RT60 125 / 250 / 500 / 1k / 2k / 4k Hz (Sabine) | 1 kHz measured off the IR |
|---|---|---|---|---|
| club (steel portal) | 30 × 25 × 7 (+2.6 ridge) | 6225 m³ | 2.44 / 2.90 / 3.13 / 3.22 / 3.09 / 2.32 s | 3.12 s |
| field (timber) | 14 × 18 × 3.6 | 1235 m³ | 1.70 / 2.04 / 2.15 / 2.31 / 2.29 / 1.79 s | 2.28 s |

Listen for the **tail after the throttle comes back** (8–10 s): the club rings for about 3 s and the field shed for
about 2. The big steel shed is a long, metallic room, the small timber one closer and warmer. These numbers are a
first guess for SND-TUNE. A hangar with the door shut rings longer (the door is the room's biggest absorber), and
`hangarAcoustics(dims, shell, { doorOpen })` takes it.

## The gate (GATE AUDIO, SND-SPACE section)

SP_CABIN, SP_DOPPLER, SP_ABSORB, SP_XFADE, SP_IR, SP_GRAPH, SP_BUDGET, SP_CRAFT. Each check is described at the head
of its block in `tools/audio/_audio_check.js`, and 42 source mutations each turn their check red. Highlights:

- cabinTransfer orders open < fabric < metal, in insulation and in high-frequency loss; the realised filter chain's
  octave mean equals −insulation to 0.1 dB.
- The doppler matches c/(c − v_r) to 1e-9 (pure). A 60 m/s pass solved through the ring lands within **0.001 %** of the
  closed-form retarded geometry, with the delay within 0.07 ms. **Rendered**, the engine and prop worklets at pitch
  1.212 / 0.85 move their peaks ×1.2120 / ×0.8500.
- The absorption falls monotonically with distance (page and pure).
- The perspective cross-fade lasts 150 ms with ext² + int² = 1 at every point; a reversal mid-fade starts from where
  the fade stood.
- The IR's RT60 is within 20 % of Sabine for the two sheds (measured 0.3–4 %).
- update() with the three sources + space.js, the aeroplane passing at 60 m/s: **0.59 B a frame (noise), 0 GC,
  ~23 µs a frame** in node (in a fresh process), and a steady frame schedules nothing.

## Known limits (for SND-TUNE / the coordinator)

- The airframe's exterior wind is "the wind the camera hears": a chase camera moving with the aeroplane should hear
  it, but a tower or a fixed observer should not. It rides the airframe group, so a fly-by watched from the tower
  carries it; the fly-by renders above leave the airframe out. Fixing it means gating `windL` by camera mode in
  airframe_model.js or src_airframe.js (out of this brief).
- The recorded one-shots and loops (samples.js) are spatialised but get **no doppler and no lag** (their
  `playbackRate` and start time are not driven).
- The in-cabin levels are relative to the chase view (the exterior chain sits at unity at the view distance). The
  absolute balance between inside and outside is SND-TUNE's ear.
