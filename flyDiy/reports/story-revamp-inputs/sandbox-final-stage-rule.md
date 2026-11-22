---
name: sandbox-final-stage-rule
description: USER 17 Nov - sandbox scenery = every project at its final (built) stage; the editor edits that final state; story stages are derived by REMOVAL (deterministic)
metadata:
  node_type: memory
  type: project
  originSessionId: e1616bf3-0974-47f2-8f24-c7f55120444f
  modified: 2026-11-16T23:11:43.031Z
---

USER 17 Nov ~01:10: for evolving scenery, the SANDBOX default is everything constructed (all projects/tracks at their final stage), and that final state is what the user edits (F9 / scenery editor). A story stage is reconstructed by removing what isn't built yet (or a declared earlier variant) - never authored as a separate earlier scene - so the world stays fully deterministic. "Should we put that rule in before we start getting confused on what is what?" -> yes.

**Why:** the user hand-edits the scenery; one source of truth (the final state) keeps edits and stages from drifting apart.

**How to apply:** any scenery/project/stage work (Game's stages, SKYLINE-RESORT's project stages, the derelict hangar phases, home improvement, lumber camp) is checked against it: stages = final minus removals. Game asked (17 Nov) to write the design note + HANDOVER + a gate row (sandbox = final everywhere; each stage = final minus its removals). Related: [[world-editor-gets-every-setting]], [[sandbox-start-chooser-2026-11-13]].
