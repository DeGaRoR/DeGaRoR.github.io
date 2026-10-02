# The performance release — closing report (2026-09-26 → 2026-10-02)

**From the first cold Jolene playtest to a stable game on Pages.** Six days and 22 merge trains, the last two shipped to Pages:
train 21, "the release" (`15d18675`), and train 22 (`f4c249d0`).

No new test was run for this report: every number below was captured during the release. Each table names its source.

---

## 1. In one paragraph

On 2026-09-26 the game taxied at **8.6–15 fps** on the reference PC. It froze for **17 seconds** at a time, the roll-out screen
lasted **52–78 s**, and Chrome raised "page unresponsive". On 2026-10-02 the same PC taxis at an **even 30 fps** (the cap,
**4 %** uneven) and **56 fps** from the cockpit. The worst frame while taxiing is **50 ms**, no main-thread task lasts a second,
the roll-out takes **9 s**, the return to the garage **0.2 s**, and both validated floatplanes run at **59 fps** on the water. The
target was redefined on the way (2026-10-02): a **stable 30** is the goal and 60 a bonus.

---

## 2. Conditions

| | |
|---|---|
| Reference PC ("gamer" preset) | i7-13700KF, 64 GB, RTX 3080, Chrome, 2216 × 1023 |
| Builds measured | Stock Cub (`default`), the user's aluminium Cessna (`bugReports/cessnaMetal (1).json`); Jodel, Cessna floats and the twin on floats where noted |
| Baseline | master `3da1c82a`, 2026-09-26 (`PLAYTEST-2026-09-26.md` §0.2, now in `reports/`). Metlakatla was **on** by default then |
| Final | master `15d18675` (master benchmark), `f4c249d0` (train-22 ratchet). Metlakatla is **off** by default (`?town=1`) |
| Tools | `tools/rollout_perf.js` (timed roll-out + taxi), `tools/rollout_ratchet.js` (the per-train ratchet), `tools/master_bench.js` (122 scenes), `tools/perf/locswitch_probe.js` |

Because Metlakatla's default changed, every headline row below is given twice where the data allows: **as the player lived it**
(the defaults of the day), and **like for like** (Metlakatla off at both ends, or on at both ends).

---

## 3. Headline — the taxi at home

| Metric | 26 Sep, as lived (town on) | 26 Sep, town off (w4/w5) | **2 Oct** (town off, default) | 2 Oct, town on (stress) |
|---|---|---|---|---|
| Taxi fps, Cub | 12–15 | 30 | **32** (bench) · 31.15 (ratchet) | 33.8 |
| Taxi fps, aluminium Cessna | **8.6** | 30 | **32.7** (bench) · 31.0 (ratchet) | — |
| Frame time p90 / worst, Cub | 167–183 / 634–2718 ms | 33 / 133 ms | **33.5 / 50 ms** | 33.5 / 33.5 ms |
| Frame time p90 / worst, aluminium Cessna | 217 / 384 ms | 100 / 150 ms | **33.5 / 50 ms** | — |
| Unevenness (ratchet), Cub / Cessna | — | — | **4 % / 4 %** (train 22) | 17 % (bench) |
| Worst main-thread task | **~17 000 ms** | 2 300 ms | **837 ms** Cub · **470 ms** Cessna | — |
| Physics (solver) per frame, Cessna | 64 ms (p90 78) | 20 ms (p90 72) | **0.1 ms** on the page (the physics worker) | — |
| Render CPU per frame | 35–42 ms | 12 ms | **9.45 / 9.65 ms** | — |

**Multipliers** (as the master benchmark prints them against the baseline): taxi fps **×2.37** (Cub) and **×3.8** (Cessna);
worst taxi frame **×12.7 / ×7.7** better; worst main-thread task **×20 / ×36** better.

---

## 4. Loading

| Step | 26 Sep | **2 Oct** |
|---|---|---|
| First flight, cold profile, Cub | 90 s | **81.4 s** (bench, `15d18675`) |
| First flight, warm, Cub / Cessna | 64 / 65 s | **51.9 / 58.6 s** (bench) · **44.0 / 43.3 s** (ratchet, train 22) |
| Roll-out screen (garage → world), warm | 52 s (town on) · 51 s (town off) | **9.0–9.1 s** |
| World → garage | (a full reload) | **0.2–0.3 s** |
| Second round trip, garage → world | — | **8.6–9.0 s** |
| Garage, warm navigation | — | 40.7 s (ratchet) · 42.7 s (bench) |
| Settings change (shadows toggle) | 3–3.5 s freeze | 0.2–0.5 s |

The two rigs differ on first flight (ratchet 44 s, bench 52–59 s). The bench runs each build on its own page after a
garage warm-up and also counts the profile's first visits. Compare like with like: a ratchet row to a ratchet row, a bench row to a bench row.

**Cold-cache loading is still the slowest experience:** 72 s to the garage on a fresh profile, mostly first-time shader
links (one of 46 s). The next release's welcome test is meant to make that wait visible and useful.

---

## 5. Every location (master benchmark, then the LOC-SWITCH fix)

### 5.1 Switching to a location (garage → world, warm)

| Place | Before LOC-SWITCH (`15d18675`) | **After** (train 22, `f4c249d0`) |
|---|---|---|
| HOME | 9.1 s, worst frame 284 ms | **9.1 s**, 283 ms (unchanged) |
| w3 | 31.0 s, of which **22.3 s** a stuck loading screen | **15.1 s** |
| mn_strip | 24.1 s | **23.2 s** (real work in small steps: town 3.6 + settle 9.7; no task over 0.2 s) |
| SEA lane, Cessna floats | **57.2 s**, back 20.1 s | **0.0 s**, back **0.3 s** |
| SEA lane, twin floats | **48.4 s**, back 20.1 s | **0.0 s**, back **0.2 s** |
| w2 / nv_strip / tw_ski | 12.3 / 14.3 / 19.5 s | not re-measured (backlog) |

The "freeze" was a **hang**, not slow work: the loader waited for a house-worker answer that never came, until a 20–30 s watchdog
lifted the screen. On the sea, the same hang meant the page never drew a frame. G1180–G1182 fixed it.

### 5.2 Flying there (fps delivered · unevenness), Cub

| Place | Taxi, chase | Taxi, cockpit | Low pass |
|---|---|---|---|
| HOME | 32 · 9 % | 30 · 0 % | 31 · 9 % |
| w2 | 59.4 · 2 % | 59.6 · 1 % | 55 · 17 % |
| w3 | 33.4 · 12 % | 31 · 1 % | 30 · 0 % |
| mn_strip | 55.1 · 16 % | 59.9 · 0 % | 48.5 · 15 % |
| nv_strip | 39.6 · 5 % | 59.7 · 1 % | 59.5 · 2 % |
| tw_ski | 47.8 · 17 % | 55.8 · 14 % | 35.6 · 11 % |

No scene had a frame over 100 ms. The Jodel and the aluminium Cessna follow the same pattern; the full table is
`tools/perf/master_bench_15d18675.txt`. The Cessna's weakest scene was w2 in the cockpit (43.4 fps, 33 % uneven).

### 5.3 On the water (after LOC-SWITCH; nothing was measurable before it)

| Build | Water taxi | Low pass |
|---|---|---|
| Cessna on floats | **59.6 fps · 1 %** | 59.4 · 1 % |
| Twin on floats | **59.4 fps · 2 %** | 59.8 · 1 % |

---

## 6. The cockpit

| | Train 21 (first baseline) | **Train 22** |
|---|---|---|
| Cub, from the seat | 55.95 fps · 2 % | **56.1 fps · 1 %** |
| Aluminium Cessna, from the seat | 55.85 fps · 2 % | **56.1 fps · 1 %** |

The cockpit shows the **live exterior**: detailed textures at the seat, the bake beyond, at ~+0.6 ms of render. G1160b's
thresholds held the stand at 59.5 fps and 1 % unevenness (it was 57–58 fps, 3–4 %) in a 4-run A/B. G1166b cut the sideways jump
on a late frame from **75–114 mm to 7–8 mm**, which was the "shaking".

---

## 7. Stress settings (Cub, HOME, master benchmark)

| Setting | Taxi chase | Low pass |
|---|---|---|
| ultra | 31.4 fps · 23 % | 27.3 · 27 % (3 frames > 100 ms) |
| ultra shadows | 33.2 · 13 % | 31.3 · 3 % |
| town on (Metlakatla) | 33.8 · 17 % | 30.4 · 11 % (one 200 ms frame) |

Ultra is for screenshots and cards above a 3080; its low pass is the weakest scene measured.

---

## 8. Against the release's own targets

| Target (PLAYTEST-2026-09-26, "Gates") | 26 Sep | 2 Oct |
|---|---|---|
| No frame over 100 ms after the reveal | ✗ (to 2.7 s) | ✓ (worst 50 ms at home; 66 ms anywhere) |
| Never more than 3 s in a row below 30 fps | ✗ | ✓ |
| Stand and taxi median ≥ 50 fps | ✗ | ✗ at home in chase view (an even 30, by design); ✓ in the cockpit (56) and at most strips |
| No main-thread task over 1 s, loads and settings included | ✗ (17 s) | ✓ (worst 837 ms) |
| Unevenness ≤ 15 %, p99 ≤ 2 × the cap | — | ✓ (4 %, p99 33.5 ms) |

**Target change, 2026-10-02 (the user):** "stable 30 will actually do". The ≥ 50 fps target is retired in favour of evenness at the
preset's cap. On that measure the release meets its goals on the reference PC.

---

## 9. What landed (merge trains)

| Train | Date | Highlights |
|---|---|---|
| ≤ 10 | 26–27 Sep | Batch A: Metlakatla off + proximity stream, stand draw cuts, physics softened box, recorder + FPS HUD, autopilot fixes, loading copy, shadows / runways / fades fixes, the world built in slices, the raster cooked, approach laws |
| 11 | 28 Sep | **Batch A on Pages**: water check, the 30/60 cap latch, no task > 1 s, the aircraft on the ground, its shadow cascade, **the perf ratchet + boxlock** |
| 12 | 28 Sep | **GATE FRAMECOST** (per-frame work gate), ground artefacts, the rails regrouped |
| 13 | 28 Sep | Taxi hitch, the flown bake, the shadows toggle 3 s → 0.64 s, boot and memory trims, roll-out animation, runway flicker |
| 14–16 | 29–30 Sep | The aircraft 261 → 90 draws, material diet, one loading with instant round trips, exact wing hitbox, house LOD 1, parked aircraft cooked, the settings freeze 1.5 → 0.2 s |
| 17 | 30 Sep | **The physics worker on by default**, KTX2 textures, worker-built houses, smooth drawn pose, shadow fixes. First flight 61.6 → 44.5 s |
| 18–20 | 1 Oct | Cub cockpit fixes, runways as data, the town kit, full trees further out + tree collisions ('mid' on gamer), the phantom 45 L tank |
| **21** | 2 Oct | **THE RELEASE, on Pages**: the new roll-out, the live cockpit exterior, the 2 m sea, the cloud-rim flicker fix, the prop disc and the pavement lines, the deck tanks, the master benchmark |
| **22** | 2 Oct | **On Pages**: the location-change hang (LOC-SWITCH), late-frame extrapolation (G1166b), cockpit thresholds (G1160b) |

The full trail is in `HANDOVER.md` ("TRAIN nn LANDED" entries) and on the strip board.

---

## 10. What the release leaves behind

- **`tools/rollout_perf.js`**: the timed roll-out as the player lives it (cold / warm, any build, `--cam cockpit`).
- **The ratchet** (`tools/rollout_ratchet.js`, `tools/perf/ratchet_baseline.json`): every train is timed and may not go back.
  It now has a cockpit group.
- **GATE FRAMECOST**: per-frame GPU work counted on a virtual clock (draws, uploads, uniforms), with justified ALLOW rows.
- **`tools/master_bench.js`**: 122 scenes over every location, the water, the loads and stress settings, compared with this
  baseline.
- **The flight recorder**: always on, with "save log" in the DEV rail and `tools/analyze_log.js` to read it. It is the tool for
  testers' machines.
- **`tools/perf/boxlock.sh`**: one timed GPU run at a time on the box (GPU locks only).

---

## 11. Open at close (carried to the backlog or the next release)

- **G1119.1**: roll-out gate bookkeeping (a cloud session is running).
- **METLA-RETURN**: Metlakatla judged on its own cost (running), plus the town-on loading-order bug (LAZY-GEN).
- **Loading**: mn_strip's 23 s of real work; w2 / nv_strip / tw_ski to re-measure; cold-cache shader links (72 s to the garage
  on a fresh profile).
- **Looks backlog**: cockpit optimization, a good-looking foam band, the garage camera, a gentle hand-over to the live game,
  the Cub deck tank, the Jodel taper, the cloud specks.
- **Next release, "Friendly Welcome"**: the welcome test (auto preset with a visible verdict), the world-build memory diet (the
  phone test, 2026-10-02: the load's JS heap reaches **~2 GB**, and Android killed Chrome), the device gate, and the hardware
  ladder trials.
- **Later, "Game Premises"**: hangar management, unique hangars blending in and out.

---

*Sources: `reports/PLAYTEST-2026-09-26.md` §0.2 · `tools/perf/master_bench_15d18675.txt/.json` · the train 21 / 22 ratchet runs
(`HANDOVER.md` "TRAIN 21 LANDED", "TRAIN 22 LANDED") · LOC-SWITCH G1180–G1182 · A5-CAP G1160b A/B · the phone recorder log (2026-10-02).*
