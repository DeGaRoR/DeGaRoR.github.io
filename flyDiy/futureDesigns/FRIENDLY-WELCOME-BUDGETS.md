# Friendly Welcome — device budgets (2026-10-02)

The contract for every Friendly Welcome session: which devices we support, what each may spend, how the game picks a
budget, and how a player changes it in game. Board: "Friendly Welcome" artifact. Context:
`reports/PERFORMANCE-RELEASE-2026-10-02.md`.

**The objective, in order:**
1. Load on every supported device, even at terrible fps.
2. Then a stable 30 on each device's preset.
3. 60 is a bonus where the frame is light.

---

## 1. Why: what we measured

| Measurement (2026-10-02) | Result |
|---|---|
| Desktop load (RTX 3080, gamer) | JS heap peak ~2.2 GB. V8 objects are only ~220 MB; the rest is ArrayBuffer backing stores (texture mips, house geometry, merged props, far terrain, the house atlas) |
| Galaxy S20 FE, **gamer** | heap ~2.0 GB, renderer 2.8 GB, Android killed Chrome at "building the field 57/137" |
| Galaxy S20 FE, **potato** | heap ~1.9 GB, renderer 2.9 GB, killed at "building the field 66/137": **the same curve** |
| GTX 660 2 GB desktop (loaded on gamer) | 130 s load, boot watchdog, **0 frames drawn** (likely a lost context; now logged) |
| MEM-DIET (copy trimming) | −261 MB retained after load (−12 %); the peak is unchanged, because geometry only uploads at first light |

**Conclusion.** Today a preset changes what is *drawn*, never what is *built and held*, so no preset fits a phone or a
2 GB card. The fix is a **memory budget per preset**, plus **geometry uploaded as each step finishes**.

---

## 2. The categories and their budgets

The budget numbers are engineering targets anchored on the measurements above. They are to be tuned by the LADDER trials
on real machines.

| Category | Typical hardware | Peak JS heap | GPU memory | Main draws / triangles | Screen scale | fps goal | Preset |
|---|---|---|---|---|---|---|---|
| Medium smartphone | 4–6 GB RAM, Adreno 6xx / Mali-G5x | ≤ 400 MB | ≤ 300 MB | ≤ 150 / 0.3 M | 0.5 | stable 30 (24 acceptable) | **pocket** (new) |
| Good smartphone | Galaxy S20 FE: 6–8 GB, Adreno 650 | ≤ 700 MB | ≤ 500 MB | ≤ 300 / 0.6 M | 0.6 | stable 30 | potato |
| Work / student laptop | i5 U-series, Intel UHD 620, 8–16 GB | ≤ 1 GB | ≤ 700 MB (shared) | ≤ 400 / 1 M | 0.67 | stable 30 | potato + auto scale |
| Average desktop | GTX 1060 … RTX 3060, 16 GB | ≤ 1.5 GB | ≤ 2 GB | ≤ 1000 / 3 M | 0.85–1 | stable 30, 60 when light | retro / current |
| Gamer | RTX 3080 class | ≤ 2 GB (today 2.2) | ≤ 6 GB | today's (~900 / 3 M) | 1 | stable 30, 60 when light | gamer |

The user's machines: the reference box (i7-13700KF, RTX 3080) = gamer. The "potato" desktop (i7-8700, 32 GB, GTX 660 2 GB)
sits between the laptop and the average desktop. Its CPU and RAM are fine and its card is the limit, so it gets potato.
With the GTX 1060 3 GB swapped back in, it is the retro rung. The HP EliteBook 840 G5 (i5 7th gen U, HD 620) is the
laptop row. The Galaxy S20 FE 5G is the good-smartphone row.

**Each preset declares its budget** (a table beside `PRESETS` in `src/viewer/gfx_settings.js`). A gate measures each preset
against it under `?gfx=<preset>` with `tools/perf/heap_steps.js` (MEM-DIET's recorder), and the phone recorder confirms on the
S20 FE. What a lighter preset BUILDS less of (MEM-BUDGET's levers):
- texture mips: skip the top level (4× less per texture);
- forest instances: sparse;
- houses beyond the near ring: not built at all, not just hidden;
- far terrain and ring resolution: coarser;
- parked-aeroplane bakes, the water mirror and grass: not built.

**For every preset:** upload each build step's geometry as it finishes, then free the CPU copy (not at first light).

---

## 3. Choosing the budget: two axes, detected

Memory and graphics power are independent. A good phone has a decent GPU and little memory per tab; a work laptop has
memory and a weak GPU. So a device gets two classes:

- **Memory class:** the browser's mobile flag (`navigator.userAgentData.mobile`, a coarse pointer and a small screen) and
  `navigator.deviceMemory` (browsers cap it at 8).
- **GPU class:** the graphics card's name (WEBGL_debug_renderer_info), later also a short timed test.

**The preset is the lower of the two.** Detection runs in three layers:

1. **Before loading (WELCOME-TEST):** the two classes give a suggested preset on one screen: "Your computer: … →
   potato", with Play or "choose another". It runs once per graphics card, with a "re-check my computer" row in the graphics
   menu. `?gfx=<preset>` skips it, and the player's choice always wins. The rigs and gates never see it.
2. **During loading (the memory guard):** if the heap nears the preset's budget, the remaining steps build at the next rung
   down (no far houses, sparser forest) instead of being killed.
3. **In flight:** automatic screen scaling to hold 30, then the "your frame is struggling, switch to a lighter preset?"
   banner (STRUGGLE-WATCH). The game never downgrades silently.

Phones stay behind DEVICE-GATE's polite page ("try anyway (experimental)") until the pocket and potato budgets hold.

---

## 4. Changing settings in game: the rule

| Kind of setting | Examples | In game |
|---|---|---|
| **What is drawn** | shadows, screen scale, AA, bloom, mist, clouds, ground cover shown or hidden | Live, as today, in under a second |
| **What is built, going down** (lighter) | sparser forest, no far houses, smaller terrain ring | Live: data is thrown away, which is quick, and memory drops at once |
| **What is built, going up** (richer) | denser forest, far houses, finer terrain, full-resolution textures | Rebuilt in the background while flying ("updating the world…"), or applied at the next roll-out, the player's choice. **Never a full reload** |
| Texture resolution | the top mip level | A few seconds of background re-fetch or re-decode, no reload |

**The rule: lowering is always instant; raising never blocks.** In the menu, the "built" options carry a small tag such as "rebuilds
in the background". A weak machine starts on its lighter preset, and stepping up from there is always safe. There is
precedent: switching to potato already rebuilds the far terrain and the forest in place.

---

## 5. Sessions bound by this note

| Session | Its part |
|---|---|
| MEM-DIET (G1200–) | the trims (−261 MB) and `tools/perf/heap_steps.js` |
| MEM-BUDGET | §2: per-preset budgets, the build levers, progressive upload, the budget gate. First targets: potato ≤ 700 MB (the S20 FE loads), then pocket ≤ 400 MB |
| DEVICE-GATE | the mobile / no-WebGL2 page, `?gfx=` (landed in train 23), the lost-context message |
| WELCOME-TEST (slim) | §3 layer 1: the GPU-name table (GPU class) plus the memory class, the lower of the two |
| Memory guard | §3 layer 2, after MEM-BUDGET |
| STRUGGLE-WATCH, LADDER-TUNE | §3 layer 3; the budgets retuned from the logs of the user's machines |
| Settings | §4: every "built" option follows the lower-instant / raise-in-background rule |
