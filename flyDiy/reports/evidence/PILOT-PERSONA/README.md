# PILOT-PERSONA (G2085-G2089) - evidence

Every file here and the command that made it. The core is the branch's (`node tools/build.js` first).

| file | what | command |
|---|---|---|
| `table.txt` / `table.md` | THE TABLE: the user's four validated aeroplanes (Cub, Jodel, C172 - `builds/*_2026-09-20_corrected.json`; the C172 on Wipline 2350 floats - `tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json`, off the SEA lane) x the five people, calm, the four people other than the expert each on four seeds (1935 = the game's, 1, 2, 3): take-off (run, lift-off speed, lift-offs, rotation rate, peak attitude), the circuit's cross-track rms and worst overshoot, the final's slope and speed rms, the touchdown (sink, V/Vs, past the aim, bounces), the go-arounds, control reversals / min (GATE PILOTACT's counter: the worst phase group, and the final's aileron / rudder), the outcome; `X` = a FINDING (not completed / diverted, sink > 2.5 m/s, > 2 go-arounds), `~` = out of the person's own band | `node tools/pilot_persona.js --seeds 1935,1,2,3 --csv DIR --out results.json --md table.md` (68 flights, 2487 s on 4 jobs) |
| `summary.txt` | the same, one row per (aeroplane, person): min-max over the seeds, the bounces and go-arounds summed | node, off results.json (HANDOVER G2085 carries it) |
| `results.json` | every flight's pilot_trace summary (the JSON the table reads) | as above |
| `traces/<build>_<person>.csv.gz` | the 10 Hz trace of each (aeroplane, person) on the game's seed (1935): t, phase, agl, aglT, V, vs, pitch, bank, e, xt, s, thr, de, dr, flap, ... (pilot_trace's columns) | as above (`--csv`) |
| `first_sweep_bare_delay.json` | THE BEFORE: the first sweep on PILOT-ONE's hooks as they landed (the bare delay line, the 0.3 s unfiltered hand) - the Jodel club / student REJECTED every take-off (a ground loop: the heading +-25 deg at 0.15 s), the C172 student gave up at the clock, the club's ailerons cycled at 90 / min, the ham-fist's hand read 400+ reversals / min. (Its float row is the corrected C172 with floats for wheels - a build that cannot leave the water, every person's and the expert's rejected: the wrong float build, replaced by the Wipline.) | `node tools/pilot_persona.js` on 4116f38c's core |
| `ui/` | the UI stills (SwiftShader) and `ui_notes.txt` (what each picker read, the player document before / after, the pilot flying) | `node tools/persona_shot.js --out=reports/evidence/PILOT-PERSONA/ui --nogl` |

THE EXPERIMENTS behind the human model (scratch, the numbers in HANDOVER G2085 and 43_pilot.js's comments):
- the gain scan (the Cub club's downwind elevator at a 0.25 s delay): gain 0.5 -> 59 reversals / min, 0.4 -> 8, 0.3 / 0.2 -> 3;
- the ground: 0.15 s whole ground-looped the Jodel; 0.15 s eased swung the Cub's roll-out 37-62 deg; 0.10 s whole: 2.5 / 0.9 deg;
- the flare, four variants over the students' three seeds (Cub / Jodel / C172): eased - the water landings 2.99 / 3.42; whole at
  the full delay - the students 2.5-4.4 m/s, the C172 ham-fist's pitch -5 -> +9 -> -8 deg in the flare; a faster held part -
  the Jodel 2.85-4.98; half the delay eased - the Jodel 2.60-2.74; THE WHEELS' DELAY WHOLE (kept) - every wheeled person
  0.43-1.99 m/s on every seed.
