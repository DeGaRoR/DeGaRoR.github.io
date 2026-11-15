---
name: workbench-box
description: Use the shared flyDiy test box (the RTX 3080 machine) safely - GPU/CPU slots with boxlock.sh, asking A0 for a window, killing only your own processes, load-time and frame-cost measurements. Use before ANY GPU run, Chrome page, perf measurement, or long CPU battery on the box.
---

# The box

1. **Every GPU run needs a slot from A0**, given in a message, even for a 1-minute probe. An empty lock is not permission. Box slots exist only for the user's asks.
2. **Take and drop the lock.**
   - Take: `bash flyDiy/tools/perf/boxlock.sh take gpu <WHO> "<what>"`.
   - Drop, in an EXIT trap: `bash flyDiy/tools/perf/boxlock.sh drop gpu <WHO>`.
   - `show` lists the holders. There is no `status`.
3. **Give your script a hard cap** that ends it before your slot does. Wait for a TIMED release, even for a build or a push.
4. **Kill only your own PID tree**: `taskkill /PID <pid> /T /F`.
   - Never a pattern kill: one stopped A0 on 11 Nov.
   - TaskStop leaves the script running.
   - After a kill, run `boxlock.sh show` and drop anything left under your name. An orphan waiter can take the lock later.
5. **No riders**: no node batteries beside a page run, and no browser run beside a battery.
6. **Load time**: A0 measures it before and after every train with `boot_perf.js --cold`, in D:/Dev/flydiy-notes/COLD-LOAD-LEDGER.md.
7. **Frame cost**: `rollout_perf.js` via `perf/train_gate.js`. Report the median, p99 and freezes, never the mean.
8. **Disk**: no new worktrees. One worktree per session.
