# The carried cowl (2026-10-08): a debris part's removed triangles written into the cage snapshot

**The report** (DMG-WALL's 07:00 replay, dmg_wreck_stills.js): trunk-2.5 knocked both cowl panels off. After the card's
Fly again, the nose-over case's INTACT aeroplane had no cowl, the engine bare.

**Probe 1** (07:15-07:17, A0's window, cpu D4B; node page, claude/dmg-t41-final 870e1d39, the hard Cub crash ->
#bGo Fly again -> 90 frames). `probe1_damage_off_raw.json`: **damage OFF clean**. The hidden / collapsed census
equals the fresh aeroplane's (80 = 80) and the wreck layer is idle.

**Probe 2** (08:13-08:16, Deform's block; the same path plus crash -> the shed -> roll-out; the code as it was,
`FLYDIY_WRECK_NODETACH`, against the fix). An index census of zeroed triangles per drawn mesh and in the cage
snapshot's own index arrays:

| run | after the crash | after Fly again | after the roll-out |
|---|---|---|---|
| as it was (`probe2_*_was`) | the model 50152 / folds 20548 + 19740; **the SNAPSHOT: alclad 5914, c452700 7210, steel tube 946, rubber 136, a part's ply 780** | the model healed; **the snapshot keeps 4 holes** | **the rolled-out model built with the holes** |
| fixed (`probe2_*_fix`) | the model only | **0** | **0** |

**The cause**: the wreck (app.js wreckCollapse) zeroes a debris part's triangles in the bucket index, which is still the
cage snapshot's own array. The first skin record detaches it (DMG-WALL G1858.2), but the copy is `a.slice()` of the
CURRENT index, holes included. Fly again heals the flown model, never the snapshot.

**The fix**: wreckCollapse detaches the index before its first write (`brkDetach(null, g, null, ['idx'])`: G1858.2's
own rule, the index alone). `FLYDIY_WRECK_NODETACH = true` restores the old behaviour.

**Not supported by the census**: a fight over `visible` between wreckHide and the hybrid's live/bake switch. No member
disagreed with its fold in either run. That change was reverted; its census stays a gate row. One mesh hidden on the
fresh aeroplane is drawn after Fly again in both runs; the gate names it and reports it, but does not fail on it.
