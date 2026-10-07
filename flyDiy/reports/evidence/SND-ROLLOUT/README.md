# SND-ROLLOUT: the roll-out shot, heard (G1715-G1717)

The user, 2026-10-05: "There's an animation of the plane starting and rolling out of the hangar. This one needs sound too, using the
same methods as the real aircraft would." The shot now STARTS its engines the way the aeroplane starts in flight. It drives the
solver's own fields, so the engine and propeller voices hear a real start. Then the check runs at idle, and the roll has a little
throttle to break away.

## The offline renders (this folder)

`node tools/audio/rollout_render.js` plays the shot in node: the real `rollanim.js` on the real solver and the user's builds, in
the club shed, with the garage's own framing (the app's front shot), at 60 Hz through the host's hook. It feeds each frame's
fields to the real engine and prop worklets, block by block, as `src_engine.js` and `src_prop.js` schedule them. The space is
heard from the shot's own camera with `space.js`'s shot-pose laws: the directivity off the nose, the distance, the pan, and the
club shed's generated IR on the wet send. That send follows the engines out of the door.

**One listening gain, +18 dB, on all four files.** As the page mixes them, the shot's engines at 14 m peak at about -25 to
-28 dBFS (before the master and the volume). The same gain on every file keeps their levels relative to each other.

**Left out offline** (the page applies them): the doppler (at most 1.5 % at the roll's pace), the 30-50 ms travel time, the
ambience, the music, and the airframe voice. There is no tyre sound on the shed's floor in the game either: the airframe voice
reads the solver's V, which is 0 in a kinematic roll.

| file | the build | start | check | roll | total |
|---|---|---|---|---|---|
| `cub_rollout.ogg` / `.png` | the user's Cub (A-65, direct drive) | 2.90 s | 3.30 s | 5.59 s | **11.79 s** |
| `jodel_rollout.ogg` / `.png` | the Jodel D112 (A-65) | 2.90 s | 3.30 s | 5.43 s | **11.63 s** |
| `cessna_rollout.ogg` / `.png` | the Cessna 172 (flat four 5.9 L) | 2.90 s | 3.30 s | 5.71 s | **11.91 s** |
| `twin582_rollout.ogg` / `.png` | the twin-582 (two Rotax 582) | 5.40 s | 3.30 s | 5.59 s | **14.29 s** |

`summary.json` holds each file's marks: the key, each engine's crank and catch, the check, the roll, the throttle, back at
idle, the engines past the door, and the end.

## What to listen for (seconds into each file)

1. **0 - 0.6 s: silence.** The master and the key go on at 0.22 s. Nothing turns yet. That's the "brief silence".
2. **0.6 - 2.1 s: the starter.** A low geared growl, and under it the cranking engine's compressions chuffing down the pipe,
   uneven as the crank labours through each one. It cranks for the solver's own 1.5 s. The crank speeds are the voice's own:
   the Cub and the Jodel 266 rpm, the Cessna 229 rpm (the bigger engine turns slower), the Rotax 290 rpm.
3. **2.1 s: the catch.** The first firings bark over the cranking. There's a flare to about 1.4 x idle about 0.75 s later
   (the Cub 904 rpm, the Cessna 962, the Rotax 2552 engine rpm), then it settles to a cold, slightly rough idle (Cub 644, Cessna 686, Rotax 1820 engine
   rpm).
   - **The twin:** engine 0 catches at 2.1 s. Engine 1's starter turns at 3.1 s, while engine 0 already idles, and it catches
     at 4.6 s. You should hear two separate starts, one after the other, never together.
4. **The check** (Cub 2.9 - 6.2 s; twin 5.4 - 8.7 s): idle and steady. The surfaces move with no sound of their own.
5. **The roll** (Cub from 6.2 s; twin from 8.7 s): the throttle comes in (0.14) and the rpm rises a few hundred (Cub 644 to
   992, Cessna 686 to 1056, the Rotax 1820 to 2803 engine rpm) a third of a second before the aeroplane moves. It holds while the aeroplane gathers way, then comes
   back to idle as it rolls (Cub: idle again at 10.5 s).
6. **Through the door** (Cub about 11 s): the shed's reverb thins as the engines pass the door plane. The wet send falls to
   30 % of itself, and the sound gets drier and more distant.
7. **The end:** the engine still idles. In the game the stand takes over here with its engine running at the same idle. There
   is no dip and no second catch.

**Red flags:** a click or a pop at the catch; the starter whining (it should growl); the twin's two starts overlapping; the
rpm rising after the aeroplane already moves; anything at the cut.

## On the real page (the box)

    node tools/_serve.js 8450 ..                      (from flyDiy/, in another terminal)
    node tools/perf/rollout_sound_evidence.js         [--builds cub,jodel,cessna,twin582] [--solo] [--after 4000] [--swgl]

The script boots `dev.html`, puts each build in the shed (`GARAGE_SPEC.apply`) and unlocks the sound with a real click. It taps
the page's own mix (`AUDIO.bus('master')` into a MediaRecorder) and presses "Roll out" with a real click. It records the sync
screen, the shot, the cut, and 4 s of the stand. Output goes to `page/<build>_page.webm` (and `.ogg`), plus
`page/<build>_page.json`, the shot's fields every frame as the page had them:
- the phase, `sim.eng` key, crank and running, `sim.out.rpm` and `rpmEng`, `ctl.thr`, and `shotPose`;
- what the voices read (`AUDIO.params`: rpmEng, running, crank, thr).

`--solo` plays the shot alone in the shed (`FLYDIY_ROLLANIM`). There the engine must wind down at the end with no catch and no
starter left, because every field is put back.

With headphones, check:
- the same sequence as above, through the real shed (the room's own IR, the door);
- **at the cut:** the idle carries on into the stand, with no gap and no second start;
- **a click during the start** (the skip): you land on the stand with the engine running. If the skip came mid-crank, you hear
  one catch, never two;
- **`?audio=0`:** the shot looks the same (the prop turns at the same rate: it reads the voice's numbers from
  `engine_config.js`, which is in the bundle either way).
