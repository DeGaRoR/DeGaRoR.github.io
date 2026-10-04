# SND-ENGINE-2 — the engine voice after the user's review (G1615–G1619, 2026-10-04)

The fixes for the user's Engine Lab review (`../SND-ENGINE/REVIEW-2026-10-04.md`, 18 verdicts). **The running
voice is untouched**: every sweep and run-up was accepted (7/7), so the pipes, the firing, the load law and the
running jitter are as they were. Only the scenes the review flagged are re-rendered here, same scene, same seed,
same 48 kHz Opus 48 kb/s and spectrogram as `../SND-ENGINE/` (20 Hz–8 kHz log, octave ticks on the left, white dots
on the firing frequency). Each **AFTER** below sits next to its **BEFORE** in `../SND-ENGINE/` under the same file
name.

Regenerate: `node tools/audio/render.js --out=reports/evidence/SND-ENGINE-2 --names=cub_start,jodel_start,cessna_start,cessnaFloats_start,twin582_start,cessna_hot,cub_starve,twin582_runup,twin582_runup_twin,twin582_sweep`

The numbers are from GATE AUDIOENG §9 (`node tools/audio/_engine_check.js --only=9`). "Before" is that same
section run on the G1613 worklet and config, where every row is red.

## What changed

1. **THE STARTER** ("R2D2", "too high pitch and synthetic", "too present"). The DC motor's commutator whine (a
   tone at ~1 kHz with two harmonics) is gone, not just quieter. In its place is a geared starter's **growl**: noise
   through a band-pass centred at 330 Hz on the A-65 (264 Hz on the Cessna's 5.9 L, 233 Hz on the O-540, 420 Hz on
   the 582's small starter). The centre follows the crank speed. Two low-passes follow the band-pass, the sound gets
   rougher once per motor revolution (the Bendix's gear mesh, with fresh grit each turn), and it gets heavier as the
   crank slows into each compression. It sits **25 dB lower** (RMS) and about **31 dB(A) lower** than the whine did.
   **The cranking engine now carries the sound**: each compression sends a breath of air down the exhaust pipe (a
   chuff that rings the pipes, at the compression rate, ~9 Hz on the A-65). The cranking is ~6 dB(A) quieter than
   the catch, and **the catch barks**: the first firings are louder (a rich, cold charge), then settle into idle
   over ~1.8 s.
2. **THE COOLING TICKS** ("far too synthetic, does feel like bells"). The three ringing modes are gone. Each tick
   is now a **dry click**: a noise burst, high- and low-passed at random corners (each tick gets its own tilt, mostly
   2–8 kHz), dying in 0.4–1.5 ms. They are **21 dB quieter** than before relative to the idle, spaced irregularly
   and thinning over minutes as before. **A recorded tick can replace them**: `port.postMessage({type: 'tick',
   synth: 0, post: true})` mutes the synthetic tick and sends `{type: 'tick', amp, frame}` at each one, so the main
   thread can fire a sample. No CC0 tick sample is wired yet: the SND-AIRFRAME branch with `samples.js` / `mech.tick`
   does not exist yet, so only the hook is in place.
3. **THE CLICKS** ("clicks too loud vs the engine", "could be better blended"). The misfire's cough was a burst of
   white noise with an instant attack. It is now **low-passed noise (900 Hz, two poles) under an envelope that rises
   over 4 ms**. It still goes into the straight pipe, so the muffler and the outlet colour it like the engine's own
   pulses. Its loudest 5 ms are **8–12 dB lower** relative to the running voice. The starvation's drama is kept: the
   coughs, the sag and the windmill are all still there, just inside the engine.
4. **THE TWIN'S LEVEL** ("a tad annoying, too loud"). There were three causes, and all three are fixed:
   - the two voices were **phase-locked**: both cranks started at angle 0 at the same rpm, so they summed coherently
     (+6 dB). Each voice now takes its starting crank angle from its seed.
   - each engine is now at −10·log10(N) dB (`engineSoundCountGain`, applied in `src_engine.js` per aeroplane).
   - the two-stroke sits 3 dB lower in `engineSoundGain`.

   The twin now sums to **−1.0 dB re one 582** (it was +6.0 dB). One 582 alone is 3 dB quieter than before.
5. **THE O-540's START** ("the base growl maybe a little down pitch; the base high pitch sound too synthetic"). The
   synthetic high layer was the whine (fixed in 1). The growl is lower: the flat-six now cranks at **173 rpm** (it
   was 194). The crank law takes off 2.5·(L − 6)² rpm above 6 L, so nothing at or under 6 L moves. Its starter growl
   is centred at 233 Hz.

## The files — before / after, what to listen for

| AFTER (here) | BEFORE | changed | listen for |
|---|---|---|---|
| `cub_start` | `../SND-ENGINE/cub_start` | 1 | at 0.6–2.1 s, no whine: a low gritty growl **under** the engine's rur-rur-rur compressions (each one a chuff in the pipe). The catch at 2.1 s is clearly the loudest moment, then it settles to the cold idle. Starter 347 Hz centroid (was 1 076), −61.8 dB (was −36.4); cranking −59.4 dB(A), catch −53.4 |
| `jodel_start` | `../SND-ENGINE/jodel_start` | 1 | the same A-65 ("engine sound too weak when starting", "starter too present"): the engine now dominates the crank and the catch stands out |
| `cessna_start` | `../SND-ENGINE/cessna_start` | 1 | the "R2D2" start: gone. A 264 Hz growl, the bigger flat-four's slower chuffs (229 rpm), catch +7.5 dB(A) over the crank |
| `cessnaFloats_start` | `../SND-ENGINE/cessnaFloats_start` | 1, 5 | the O-540: slower cranking (173 rpm, was 194), a lower growl (233 Hz), no high synthetic layer; catch +14.5 dB(A) over the crank |
| `twin582_start` | `../SND-ENGINE/twin582_start` | 1, 4 | (was Right) the same start with the new starter: its growl is the highest of the five (420 Hz, a small starter) but toneless; one 582 at the new two-stroke level (−3 dB) |
| `cessna_hot` | `../SND-ENGINE/cessna_hot` | 2 | after the run-down: faint, dry, irregular clicks with **no pitch and no ring** (median 2.25 ms to −20 dB, was 36 ms; spectral flatness 0.98, was 0.25; loudest −10.8 dB re the idle's RMS, was +10.1) |
| `cub_starve` | `../SND-ENGINE/cub_starve` | 3 | the same story (misfires thickening, the sag, dry at 20 s, the windmill) with the pops as **thumps inside the exhaust** rather than cracks on top; loudest cough −5.9 dB re the running RMS (was +2.3) |
| `twin582_runup` | `../SND-ENGINE/twin582_runup` | 3, 4 | the ring-ding idle's misses as soft puffs, not clicks (loudest cough −4.9 dB re running, was +4.2); 3 dB quieter overall (the two-stroke's level) |
| `twin582_sweep` | `../SND-ENGINE/twin582_sweep` | 3, 4 | the same: blended misses (−9.8 dB re running, was +2.4) |
| `twin582_runup_twin` | `../SND-ENGINE/twin582_runup_twin` | 4 | both 582s: **no louder than one** (−1.0 dB re one, was +6.0). The two engines are no longer phase-locked, so the pair sounds like two engines rather than one doubled |

## Not changed (accepted 7/7)

`*_sweep` and `*_runup` of the four-strokes: the pipes, firing order, load law, cycle-to-cycle jitter, idle
roughness, run-down and blower have the same equations and numbers as before. A re-render of those scenes would
still differ in two places: the crank's starting angle (a random phase at the first sample) and the rare idle
misfire's cough (now the softer one from item 3). The firing-frequency gate (§2) still reads within ±0.02 %.
