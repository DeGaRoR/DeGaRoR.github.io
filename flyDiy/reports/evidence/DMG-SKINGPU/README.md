# DMG-SKINGPU (G1818-G1819) - the wreck's skin ridden on the GPU

All runs use the user's Cub (builds/cub_2026-09-20_corrected.json) on the gamer box with `?damage=1`, at noon on the game
clock, under the GPU lock. **CPU** is the CPU riding (D4b's G1869 cuts plus this branch's event cuts). **GPU** is the
transform-feedback riding (G1818). The same page and build are used for both, with `window.FLYDIY_SKINGPU` flipped between
runs. The rig is `tools/dmg_skingpu_box.js` and the plots come from `tools/dmg_skingpu_plot.js`. The HANDOVER entry
"G1818-G1819 DMG-SKINGPU" has the full story.

## What counts
- **Void, removed:** every GPU timing before 2026-10-06 06:00. `renderer.resetState()` reset reversed-Z, so those GPU
  frames drew less than they should.
- **Valid timings, void stills:** the 2026-10-06 20:45 slot (`box4_*.json`). It ran before 1158a838 fixed the weightless
  wall places.
- **The reference:** the 2026-10-07 02:55 TIMED slot on the fixed code bf95a63e (`box6_*.json`, every `.jpg` without a
  `weightless_` prefix, `crash_frames_1158a838_*.svg`).

## Correctness on the fixed code
- **Readback** compares the GPU's drawn buffers with the CPU's exact riding of the same frame, for every riding vertex,
  measured in the world.
  - Inline (`box6_inline.json`, every 15th frame of four crashes): worst 0.045 mm, 0 vertices past 0.1 mm out of 57.9M
    vertex-poses, normals within 0.00012 deg.
  - Under the physics worker (`box6_worker.json`, the held wreck): worst 0.039 / 0.045 mm, 0 vertices past 0.1 mm,
    normals within 0.00005 deg.
- **Still pairs:** `<case>_<cam>_gpu.jpg` / `_cpu.jpg` are inline (`?simw=0`); `<case>_<cam>_worker_gpu.jpg` / `_cpu.jpg`
  are under the physics worker (`?simw=1`, the game's default).
  - Each pair shows one wreck at rest drawn two ways. **gpu** is the GPU riding with the rig rows' skip. **cpu** is the
    base's way: the rig rows posed, then the CPU riding.
  - `*_diff.jpg` marks in red every pixel whose colour moved by more than 40.
  - **The aeroplane is pixel-identical in every pair.** Camera 2 differs by 0-8 pixels. Camera 1 differs by 0.2-2.9 %,
    and all of those pixels are in the swaying trees behind it.
- `weightless_*.jpg` is **bug evidence only** (20:45, before 1158a838). Wall places went weightless: on the CPU they were
  drawn ~500 m off, as slivers across the runway; on the GPU they were drawn unrotated about the CG (the nose-in's giant
  dark sheet).
- `box_lose.json` / `box4_lose.json`: the WebGL context was lost on purpose 20 frames into the 2.5 m trunk crash. The GPU
  riding ended, the CPU riding carried every frame, and no exception was thrown.

## Timings
- `crash_frames_1158a838_inline.svg`: each crash frame by frame from its first break, on the fixed code, GPU run first.
  Grey bars are record creation; light bars are break events.
  - The trunk-centre GPU run was the session's first crash, straight after the boot. Its calm frames were 35.6 ms, against
    17.9 ms in the CPU run, so it is not comparable.
  - For that case, use `box4_inline_ab.json` / `box4_inline_ba.json` (both orders, valid timings).
- `crash_frames_1158a838_worker.svg`: the two flown crashes under the worker, CPU then GPU. The impact second there is
  bound by the skin break's own CPU work (~600 ms of the second in both modes): the break events arrive nearly every frame.
- `crash_frames_fixed_pass_*.svg`, `box3_*.json`: 2026-10-06 06:00. Valid timings from before the WALL merge.
