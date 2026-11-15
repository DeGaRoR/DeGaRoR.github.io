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
- Wrap `FLYDIY_AA.render`, call the original, then `gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(...)` right after it, alpha forced opaque, and encode the PNG/JPEG yourself. Row order: check ONE frame before flipping. On this box (ANGLE D3D11, headless) Game got upright frames with no flip (15 Nov); LOOK-1's rig flips.
- Wait frames with requestAnimationFrame (`FRAMES(30)`), never with sleep alone.
- Camera: `FLIGHT_PROBE.devFree(x, y, z, yaw, pitch)` (the free eye), near the aircraft. Terrain and the cover ring stream around the AIRCRAFT, so a free eye far away shows flat sky. If the subject is far from the spawn, first move the aircraft there with `FLIGHT_PROBE.place`, then put the eye near it with devFree (DIRT-STRIP, 15 Nov).
- Pause with the game's own `#bPause`, as a player would. If no frame arrives in 5 s, check renderer.info.render.frame over 1 s; if it doesn't move, the loop is not drawing.

## 4. On the first miss: diagnose, don't retry
- Log WHY once: `BOOT.state`, body classes, `FLYDIY_HOLDS()`, `document.visibilityState`, rAF count in 1 s, the rAF callbacks by name over 1 s (it separates "the loop is not scheduled" from "the loop exits early"), renderer.info frame delta in 1 s, the render / AA.render call counts in 1 s, page exceptions and console errors (Runtime.exceptionThrown).
- Two misses = stop, drop the lock, report the WHY. Do not burn the slot on blind retries.
- Before you call it the game's bug: does the same rig work on the previous master? Does a known-good rig (section 5) work on yours?

## 5. The reference rig
- LOOK-1's rig drew real frames on 13 Nov: `C:/Users/denis/AppData/Local/Temp/claude/dbc9121edd5fa991/66476fa0-7270-4212-adb4-12046e55605a/scratchpad/rig_wabk.js`. Copy it, don't edit it in place. It does sections 2-3 exactly: launch, CDP, boot wait, Go, pause, the AA.render wrap with readPixels, devFree, a hard cap, and its own Chrome killed by PID tree.
- Coming: `flyDiy/tools/page_rig.js`, the shared harness built from it (boot, fly, grab, WHY). When it lands, use it and add only your views.

## 6. Results
- Pictures for the user go to the flydiy-notes evidence folder, never only to Temp. Sent inline.
- Put the eye/where in your JSON, and check it before comparing before/after.
- Name what you measured, the base sha, and what ran beside you.
