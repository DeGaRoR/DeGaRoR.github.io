# Testing procedure: page and GPU runs (A0, 15 Nov 2026)

The user, 15 Nov: "they all reinvent their harness, and most fail and need several tries; wasting time".
Read this before you write or arm any rig. It collects every trap that cost a slot this month.

## 0. Do you need the GPU at all?
- First choice: the node gates (`node tools/run_gates.js --only=NAME1,NAME2`; the "=" is required). Node flies the same solver as the game.
- Page / GPU only for: pictures, GPU timing, or a page-only check. Cloud sessions cannot render: node only.
- After editing src/: `node tools/build.js` BEFORE judging any gate. Many gates read tools/flight_core.js, not src.

## 1. The slot
- Every box run needs a slot from A0, even a 1-minute probe. An empty `boxlock.sh show` is not permission.
- Take: `bash flyDiy/tools/perf/boxlock.sh take gpu <WHO> "<what>"`. Drop it in an EXIT trap.
- Give the script a hard cap that ends it before your slot does, so it ends itself on time.
- Kill only your own PID tree (`taskkill /PID <pid> /T /F`), never a pattern kill. TaskStop leaves the script running. After a kill, run `boxlock.sh show` and drop anything still under your name.
- No riders: no node gate batteries beside a page run. Boots go from ~140 s to 270-360 s, and pictures time out.
- `node --check` the rig and preflight its files BEFORE taking the lock.

## 2. Boot the game the way a player does
- Serve with `node flyDiy/tools/_serve.js <port> <repo> --fallback D:/Dev/DeGaRoR.github.io` and open `flyDiy/index.html` or `dev.html`, the load door. Never load raw build files.
- Chrome: `--headless=new --remote-debugging-port=<p> --window-size=1600,900 --user-data-dir=<fresh tmp> --disable-gpu-sandbox --disable-frame-rate-limit --disable-gpu-vsync --no-first-run --hide-scrollbars`. Check the renderer: the GPU must be NVIDIA/AMD/Intel, never SwiftShader.
- Wipe `flydiy.*` localStorage once, before the first load (Page.addScriptToEvaluateOnNewDocument with a sessionStorage guard).
- The in-app browser pane draws NOTHING while it is hidden; use it only when it is on screen.
- Wait for `BOOT.whenReady()`, then for `BOOT.state === 'gone'` (allow 420 s). The boot cover stays up until every program links, and a click under it never reaches a flight.
- Then click `#bGo` until flying. "Flying" means ALL of these: BOOT gone; body has `mode-fly`; not `mode-ws`; no `body.rollShot`; sim t rising. The text HOLD/HOLDING is NOT flying.
- Careers: the welcome menu never shows on a rig, even with ?welcome=1. Use `?mode=career` to boot a career directly. For "New career, no tutorial", set `FLYDIY_CAREER_SKIP` from an init script (Game, 15 Nov).
- If you seed a design (flydiy.wip etc.), do it before the load and say so in the log. A seeded run that fails must be re-tried WITHOUT the seed before blaming the game.

## 3. Grab frames the one way that works
- NEVER `Page.captureScreenshot` for the world. Headless shows the canvas see-through: you get the page background (#cfe0ec).
- Wrap `FLYDIY_AA.render`, call the original, then `gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(...)` right after it, alpha forced opaque, and encode the PNG/JPEG yourself. Row order: page_rig.js flips GL's bottom-up rows, and its frames are upright on this box (ANGLE D3D11, headless; LOOK-1's stills 13-15 Nov; `.info.topMean`/`botMean` are there to check). Game got upright frames with no flip on its own read path (15 Nov). If you read pixels any other way, check ONE frame before flipping.
- Wait frames with requestAnimationFrame (`FRAMES(30)`), never with sleep alone.
- Camera: `FLIGHT_PROBE.devFree(x, y, z, yaw, pitch)` (the free eye), near the aircraft. Terrain and the cover ring stream around the AIRCRAFT, so a free eye far away shows flat sky. If the subject is far from the spawn, first move the aircraft there with `FLIGHT_PROBE.place`, then put the eye near it with devFree (DIRT-STRIP, 15 Nov).
- Pause with the game's own `#bPause`, as a player would. If no frame arrives in 5 s, check renderer.info.render.frame over 1 s; if it doesn't move, the loop is not drawing.
- TRAP (16 Nov): `FLIGHT_PROBE.craft()` is the drawn Group, and its position is (0, 0, 0); the meshes move inside it. An eye "near the craft" taken from it looks at the world origin. Anchor a plane-relative eye on the sim's CG, `FLIGHT_PROBE.sim().cgPos()`. An aim within 5 m of the origin is a miss, never an eye.
- TRAP (16 Nov): `FLIGHT_PROBE.camGet().target` can be stale after `fly()` or a `place()`. Use it only as a cross-check of the CG, never as the anchor. Before each grab of a plane-relative view, project the CG through the game's camera (`FLIGHT_PROBE.camera()`) and check that it is inside the frame. Two misses stop the run (section 4). page_rig.js does all of this: `rig.eyeNear`, a `near` view, `rig.grab`.
- TRAP (16 Nov, DIRT-STRIP): the FIRST grab after a long jump (a `place` km away, a far eye) can come back BLANK while the new place streams in: the loop runs, AA renders, no page errors, but rAF is at 9-10/s. The second grab at the same place is fine. Wait for the frame rate to come back, not a fixed sleep: page_rig.js does it (`rig.settleLoad()`: at least 20 frames a second, 2 s in a row, at most 90 s), after every `place()`, before every CLI view, and once more before it re-grabs a BLANK frame. A blank that one settle doesn't fix is a real miss.
- To start at the runway instead of the stand, use the game's own Skip (`#bSkip`, which lines up at the hold with the engine running): `rig.skipToLineUp()`, or `--skip` on the CLI. It is hidden when the start has no taxi (water, a classic pilot, the shed).

## 4. On the first miss: diagnose, don't retry
- Log WHY once: `BOOT.state`, body classes, `FLYDIY_HOLDS()`, `document.visibilityState`, rAF count in 1 s, the rAF callbacks by name over 1 s (it separates "the loop is not scheduled" from "the loop exits early"), renderer.info frame delta in 1 s, the render / AA.render call counts in 1 s, page exceptions and console errors (Runtime.exceptionThrown).
- Two misses = stop, drop the lock, report the WHY. Do not burn the slot on blind retries.
- Before you call it the game's bug: does the same rig work on the previous master? Does a known-good rig (section 5) work on yours?

## 5. The reference rig
- `flyDiy/tools/page_rig.js` (LOOK-1, 15 Nov) is the shared harness. It does sections 2-4: the server, Chrome on a free debugging port with its own profile, the real-GPU check (before the boot is spent), the flydiy.* wipe and an optional logged seed, the boot wait, Go until flying, `#bPause`, devFree, the AA.render grab, WHY on a miss, the hard cap, and its own Chrome killed by PID tree. Use it and add only your views:
  - Stills: `node tools/page_rig.js --views views.json --out <dir> [--q ...] [--cap 600]`. A view is `{ name, yaw, pitch, x y z | near: [dx, dy, dz] | agl, place: [x, z, agl], settle, wait, eval }`; `near` is relative to the aircraft's CG, read just before the view, and the grab first checks that the aircraft is in the frame (`craft: false` turns that off for a view that should not show it). `--skip` starts lined up. It writes `<name>.png` plus `page_rig.json` (base sha, GPU, every eye and the blank test). Exit 1 means a view was blank or failed; its WHY is in the JSON.
  - Your own measurements: `const rig = await require('./page_rig.js').start({ cap, q, seed, init })`, then `rig.fly()`, `rig.pause()`, `rig.place(x, z, agl)` (the aircraft to a far subject first), `rig.skipToLineUp()`, `rig.eyeNear(dx, dy, dz, yaw, pitch)` (relative to the CG; the next grab checks that the aircraft is in the frame), `rig.anchor()` / `rig.inFrame([x, y, z])`, `rig.eye(...)`, `rig.grab()` (PNG Buffer, `.info` has mean/sd/blank/eye), `rig.why()`, `rig.ev()` / `rig.J()` / `rig.frames(n)`, and `rig.close()`. The full usage is at the top of the file.
  - Self-test: GATE PAGERIG (node, in the battery). The page half is `node tools/_pagerig_check.js --gpu --out <dir>`, by hand in a GPU slot.
- The rig it came from: LOOK-1's `rig_wabk.js` (13 Nov), in that session's scratchpad. Use it only for its measurements (flicker, clips), never as a template.

## 6. Results
- Pictures for the user go to the flydiy-notes evidence folder, never only to Temp. Sent inline.
- Put the eye/where in your JSON, and check it before comparing before/after.
- Name what you measured, the base sha, and what ran beside you.
