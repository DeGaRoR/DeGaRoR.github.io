# DMG-SKINGPU (G1818-G1819) - the wreck's skin ridden on the GPU

The user's Cub (builds/cub_2026-09-20_corrected.json), the gamer box, `dev.html?damage=1&simw=0` (the solver stepped in the
page), under the GPU lock, 2026-10-06 00:12-00:31. "CPU" = the riding as on fc834041 (D4b's G1869 cuts on) with this
branch's event / binding cuts; "GPU" = the transform-feedback riding (G1818). Same page, same build, the switch
`window.FLYDIY_SKINGPU` flipped between runs. Rig: `tools/dmg_skingpu_box.js`; plots: `tools/dmg_skingpu_plot.js`.

- `crash_frames_pass1_cpu_first.svg` - each crash frame by frame from its first break, CPU riding then GPU riding (pass 1: the
  first case after the boot, trunk centre CPU, also paid the one-off record creation).
- `crash_frames_pass2_gpu_first.svg` - the same four crashes in the reverse order (GPU first: trunk centre GPU paid it here).
- `box_inline.json`, `box_inline_ba.json` - every frame of both passes (ms, physics, scene, skin break split, GPU ms) and the
  summaries; pass 2's readback is the valid one (pass 1's check compared the wreck at rest against nodes moved since the
  last pose - fixed: the check now uses the nodes the GPU drew).
- `box_lose.json` - the WebGL context lost on purpose 20 frames into the 2.5 m trunk crash (WEBGL_lose_context): the GPU
  riding ended (ok false, drawers 0), the CPU riding carried all 28 frames until the restore, no exception.

Still pairs (GPU vs CPU on one frozen frame): not yet - the first ones read the WebGL canvas back black (no preserved
drawing buffer); the rig now shoots with the driver's CDP screenshot, to be taken in the next GPU slot.
