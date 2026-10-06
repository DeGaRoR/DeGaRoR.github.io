# DMG-SKINGPU (G1818-G1819) - the wreck's skin ridden on the GPU

The user's Cub (builds/cub_2026-09-20_corrected.json), the gamer box, `dev.html?damage=1&simw=0` (the solver stepped in the
page), the game clock set to noon, under the GPU lock, 2026-10-06 06:00-06:07. "CPU" = the CPU riding (D4b's G1869 cuts and
this branch's event cuts); "GPU" = the transform-feedback riding (G1818). Same page, same build; the switch
`window.FLYDIY_SKINGPU` flipped between runs. Rig: `tools/dmg_skingpu_box.js`; plots: `tools/dmg_skingpu_plot.js`.

**Correction (06:00):** every GPU run before this one drew a broken frame - `renderer.resetState()` after the riding pass
reset three's reversed-Z flag, so the pavement and the aeroplane failed the depth test after the first GPU-ridden frame.
Their GPU frame times were too low, and they were removed from this folder. Fixed: the pass now saves and restores the GL
bindings it touches. Everything below was measured after the fix.

- `crash_frames_fixed_pass_a_cpu_first.svg`: each crash frame by frame from its first break, CPU riding first, then GPU.
  Grey bars are the one-off record creation; light bars are the break events.
- `crash_frames_fixed_pass_b_gpu_first.svg`: the same four crashes in the reverse order.
- `box3_inline_ab.json`, `box3_inline_ba.json`: every frame of both passes plus the summaries and the readback check.
- `<case>_<cam>_gpu.jpg` / `_cpu.jpg`: one frozen wreck at rest drawn by the GPU riding, then by the CPU riding (pass A).
  - Camera 2 is identical in every case (0-12 pixels differ).
  - Camera 1 differs by 0.3-2.8 % of the pixels. On the taxi it is the moving clouds.
  - **On the 2.5 m trunk, the main fuselage piece is drawn differently** (`trunk-2.5_1_*.jpg`). Under investigation: the
    readback says the buffers the GPU writes match the CPU riding within 0.5 mm, so a mesh drawing those vertices outside
    the swapped geometries is suspected (likely the near "live view" band at close range).
- `box_lose.json`: the WebGL context lost on purpose 20 frames into the 2.5 m trunk crash. The GPU riding ended, the CPU
  riding carried every frame, and no exception was thrown.
