---
name: workbench-page-rig
description: Take pictures of the running game or run anything in a real browser page (world stills, flight stills, before/after pictures, page checks, GPU timing) with flyDiy/tools/page_rig.js - use instead of writing a Chrome/CDP/puppeteer/screenshot script. Also for cloud sessions needing a page still (soft_still.js).
---

# Page runs and world pictures

Use `flyDiy/tools/page_rig.js`. Do not write a new rig. The procedure, with every trap, is `flyDiy/tools/RIG-PROCEDURE.md`.

## Before
1. Ask A0 for a GPU slot, even for a 1-minute probe. An empty `boxlock.sh show` is NOT permission.
2. `node --check` your script, and check your views file and its paths, before you take the lock.
3. Nothing else runs beside the page: no gate battery, no second page.

## The run
- **CLI**: `node flyDiy/tools/page_rig.js --views views.json --out <dir>`. A view gives an eye `near: [dx, dy, dz]` relative to the aircraft, an `agl`, or `place` to move the aircraft to a far subject first.
- **Module**: `const R = await require('./page_rig').start({ ... })`, then `R.fly()`, `R.place(x, z, agl)`, `R.eye(x, y, z, yaw, pitch)`, `R.grab()` (a PNG read with readPixels after FLYDIY_AA.render), `R.why()`, `R.close()`.
- **Careers**: `q: 'mode=career'`. "No tutorial" = the FLYDIY_CAREER_SKIP init script. The welcome menu never shows on a rig.
- **What it does for you**: takes and drops the lock, checks the GPU is real (never SwiftShader), wipes flydiy.* storage, waits for BOOT gone, checks flying on all five conditions, and has a hard cap.

## On a miss
It prints WHY: BOOT state, body classes, holds, visibility, rAF by callback, renderer frames/s, AA.render calls/s and page errors. Two misses: stop, drop the slot and report the WHY. Never retry blind.

## Cloud sessions
There's no GPU. `node flyDiy/tools/soft_still.js --out x.jpg` gives a SwiftShader still. Node checks are the real test.

## Results
- Pictures for the user go to `D:/Dev/flydiy-notes/evidence/<topic>-<date>/`, with a README (base sha, what ran beside).
- Compose them like a real picture.
- Never put the user's own photos in git.

## Traps (add yours)
- The in-app browser pane draws nothing while it's hidden.
- `Page.captureScreenshot` shows a see-through canvas (the page background only). Never use it for the world.
- A free eye far from the aircraft gives flat sky, because terrain streams around the aircraft.
- HOLD/HOLDING text is not flying.
- If you seeded a design before the load, try without the seed before blaming the game.
- `FLIGHT_PROBE.craft()` is a Group at (0, 0, 0), so an eye "near the craft" taken from it looks at the world origin. Plane-relative eyes go on the sim's CG: use `R.eyeNear(dx, dy, dz, yaw, pitch)` or a `near` view, which read `sim().cgPos()` just before the view.
- `camGet().target` can be stale after `fly()` or `place()`, so it is only a cross-check. Before a plane-relative grab, the rig projects the CG through the game's camera. If the aircraft is not in the frame, that is a MISS, and two misses stop the run.
- To start lined up at the runway instead of on the stand, use `R.skipToLineUp()` or the CLI's `--skip` (the game's own `#bSkip`).
- A copy of page_rig.js outside the repo still finds `_serve.js`: it is resolved from the repo served (`repo` option).
