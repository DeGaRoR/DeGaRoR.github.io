# LIVERY-5 evidence (4 Nov 2026)

Renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, headless Chromium,
dev.html's garage at `?profile=phone&gfx=laptop` (atlas 2048 px, so a page is 512 px: the potato / phone page). The user's
Cub (builds/cub_2026-09-20_corrected.json) came in through the fleet's Import. Every layer went on through the editor's own
finish door. Rig: `node flyDiy/tools/livery5_shot.js --out <dir> [--light --size 640x400]`. JPG q85. No frame times.

- `cub_registration_no_outline.jpg`: F-BCUB in the trim colour (the ink following it), no keyline.
- `cub_registration_red_ink.jpg` (light run): after the panel's own 'ink' well was set to #c81e1e (its value plus an
  input event, as a player does). Export `regCol` = 0xc81e1e. Atlas page 0's opaque pixels: top colour #141414 (67 %)
  before, #c81e1e (64 %) after. **The ink works.**
- `stars_hexagonal_body.jpg`: `pattern`, star, hexagonal, size 0.07 of the depth, spacing 2.3, fitted to the fuselage (side box).
- `dots_shifted_rows_wing.jpg`: `pattern`, dot, shifted rows, size 0.05, fitted to the wings in plan. Soft because the
  dots are near the 8 px floor on a 512 px page spread over the span.
- `flag_fin_rectangle.jpg`: USA, rectangle, layer 4 (atlas page 1, the old body-image page), fitted to the fin. Canton toward the nose.
- `flag_fin_rectangle_far_flank.jpg` (light run): the same flag from the other side. Nose to the left, canton upper-left:
  the hoist is toward the nose on both flanks (reversed on that side, the way a flag is worn on an aeroplane).
- `flag_fin_disc_alaska.jpg`: Alaska, disc, layer 5 (atlas page 2). The disc is round in metres. It crops the flag's
  centre, so Polaris (far right on the flag) falls outside.
- `five_layers_three_quarter.jpg`: all five layers at once (stars, dots, tartan on the stabiliser, USA on the fin,
  a rounded France on the fuselage by hand); the block held n = 6 (5 + the registration). Only the stars, the dots and
  the flag are visible from this eye. The tartan (stabiliser) and the hand-placed France are not seen in any still, so
  the tartan is proven only by the node gates (its draw, its page, its save).

What SwiftShader cannot show: no frame time or compile cost, and no GPU anisotropy or mip behaviour at a real phone's
resolution. The first run's far-flank still was a copy of the near one (a camera move alone does not re-render the
garage), so it was retaken in the light run after a rebuild.

Caveat: these stills were taken before the `bodyLock` fix (see HANDOVER LIVERY-5). While that bug stood, the decal panel's
last lines and the materials panel threw and logged it. The layers went on through finishFromSpec + build, which do not
pass through that code, so the pictures stand. The rig now fails on such a console error.
