# ROOF-LIGHTS + FLOWER-CLUMPS READY (CABIN-CRAFT, 8 Nov 2026, for train L35d)

Branch claude/ready/roof-lights, on master 1bcd01d3e (L35a). Code 9fbbccaa8 + 69e439d9b + 57e630fcb, built be9402288 (build c4db25b9f157). On top: this note and HANDOVER.

The user 8 Nov, via A0: "the roof windows in the hangars are really just plain cuts and they look bad, on both club and works ... maybe these wavy transparent plastic with some weathering?" and "the flowers look a little wrong too. I think they lack variation, in size, in value, in spread, in the way they clump."

## What lands

- **The roof lights are a weathered corrugated GRP sheet** (`hangar.js`). One procedural 256 x 256 sheet (`skyAlb`): milky warm base, 58 ribs, yellowing toward the sill, streaks down the fall line, grime at the lower edge, the upper lap, blotches. The ribs' normal map is the roof's own corrugation (`corrNrm`, cloned at the panel's rib count). Inside (`M.skyPanel`): the sheet as map and emissive map, opacity 0.6. Outside (`M.skyPanelExt`): the same sheet, rough, nearly opaque. The timber shed still has none.
- **The exterior pane faces up** (57e630fcb). It was wound to face down into the shed, like the room's pane, but `M.skyPanelExt` is single-sided where `M.skyPanel` is DoubleSide. From outside only its back face existed, and it was culled, so **every world hangar showed its roof lights as holes onto the dark inside, on master too** (the blue glass of before was never seen). HANGAR_GEN's polished shell bakes this exterior, so the bake carries the fix. Node probe: master exterior panes face down (club 8, works 12); branch up 8/0 and 12/0; the room panes face down on both.
- **The flower beds clump** (`cover_ring.js`, the fireweed / foam / bunchberry patch rows only). Each bed keeps a value-noise clump mask, so it breaks into clumps with gaps. Strays land near the beds (3.5 % of the near rim). Size varies per plant (x0.72-1.17 by the local density, then a log-normal +-22 %), and so does colour value (+-18 %, with a few paler and darker plants). Draws taken off the beds' own hash, so every other species keeps its draw stream.
- **The GATE HANGAR stub has no `clone`**: guarded (69e439d9b).

## Stills (lane 1, 19:10-19:27 and 19:33-19:39; evidence-2026-10-18/2026-11-08/roof-lights)

- `before/` = master 1bcd01d3e, `after/` = 4251606cb (inside and flowers), `after2/` = be9402288 (works, with the exterior fix).
- Inside, works and club (U): the clear cut-outs onto blue sky are now milky panels with ribs, streaks and grime.
- Outside, works (O, G, C, `after2/HOME.2`): the holes are gone; the panels read as pale ribbed sheets in the green roof. **At grazing (G) the ribs hold** as fine stripes, with a little moire; the panels read as a lighter band.
- The club's outside still runs at 22:50 (lane 2) as confirmation. Its fix is the same code (the probe covers it).
- Flowers (club O, background): the even pink block is now clumps of different sizes and tones, with gaps and strays.

## Cost

- Draws: unchanged by construction (the roof panes existed, only culled; the beds keep their batches).
- Triangles: roof unchanged; the beds have fewer plants. The node census (stub cover ring, master vs branch): every non-flower species identical; the weed patch 128,534 -> 97,267 (-24 %).
- Textures: +2 (the sheet, ~0.35 MB with mips; the normal map's clone, 512 x 64, ~0.17 MB): **~0.52 MB**.
- Programs: at most +2 variants (the two roof materials now have maps). The page counts read +11/+12 programs and +7 textures. That diff is muddied: the rebuilt after tree has a stale parked cook, so its parked planes load live. Trains re-cook.
- Whole-frame counts, branch, works (after2): U 392 draws / 0.75 M tris; O 579 / 21.7 M; G 578 / 22.6 M; B1_side 1583 / 29.5 M. The first pass's 1 call / 2 tris read only the last composite pass; the rig now counts whole frames. There is no master run with the fixed counter yet.

## Gates (node)

HANGAR PASS, STAND PASS, HANGARVIEW PASS, FADES PASS, COVER PASS; node --check OK. The earlier battery: ASSETS fails only on master's 14 sites (hangar.js adds none). HOUSEWORKER red is the stale parked cook of any local rebuild (A0: not a red). SKINMAT, CLIP, SHADOWSKY, ROOMMERGE and ROUNDTRIP are red on master itself.

## Open

- A real corrugated profile for the roof deck (the ribs are a normal map) is the follow-up.
- Ground cover grows on the world sheds' floors (A0 saw it in B1_side). It is on master too, and it is next on my list.
