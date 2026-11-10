# QUICKSHOT — a picture of any build in seconds, no browser

The cage 8 bench in a headless browser takes minutes per picture in a cloud box (software WebGL). `tools/quickshot.js`
builds the same aeroplane with the editor's own layers in node (`_scene_headless.js`, the bench's PAGE.post chain)
and rasterises it itself: about 3 s a picture, no GPU, no browser, nothing to install beyond node.

```
node tools/quickshot.js builds/cub_2026-09-20_corrected.json /tmp/cub --views side,top,front,q
node tools/quickshot.js --key camel /tmp/camel --views q                 # an archetype card, born as the shed births it
node tools/quickshot.js my_build.json /tmp/try --over '{"halfW": 0.6}'    # try a slider without saving
node tools/quickshot.js my_build.json /tmp/nose --views side --crop 1.5,3.5,-1,1 --w 1400   # a close-up
node tools/quickshot.js --key ttail /tmp/tt --views front,side --over '{"gearRetract":1}' --gear 0.5   # the gear half up
node tools/quickshot.js --key ttail /tmp/tt --views bottom,qb --over '{"gearRetract":1}' --gear 0 --noedges   # the wells, stowed
```

Writes `<out-prefix>_<view>.png`. Views:
- `side`: from starboard, the nose to the left.
- `top`: from above.
- `front`: head on.
- `q`: three-quarter from ahead, starboard and above.
- `bottom`: from below, the nose to the left (RETRACT G4: the wells).
- `qb`: three-quarter from ahead, starboard and below.
- `qr`: three-quarter from behind, starboard and above.

Options:

| option | what it does |
|---|---|
| `--over JSON` | panel rows laid over the build before it is drawn |
| `--crop z0,z1,y0,y1` | the side view's window, metres |
| `--w px` | picture width |
| `--marks fittings` | rings on the placed fittings |
| `--marks corners` | rings on quad window corners |
| `--marks reg` | paints the registration's footprint white |
| `--gear 0..1` | a retractable gear's position (1 down, 0 up): the units swung by the gear layer's own rule, as in flight (RETRACT-1; the build must retract: `--over '{"gearRetract":1}'` on a low-wing tricycle) |
| `--nowells` | a retractable gear's wells are not cut: the sheet drawn whole (RETRACT G4; by default they are cut as the editor cuts them, `_knife_gen.js` knifeWells, and their section `wheelWell` drawn grey) |
| `--noedges` | the reserved wells' boxes (RETRACT G3) are not drawn over the picture |

What it is and is not:
- Shapes, layers and fittings are exact: the same meshes the bench draws.
- The interior sections (liners, frames, the dash, the floor) are not drawn, so a well shows what is in it, not the
  cabin's lining above it (the editor carves those out of the well anyway).
- Colours are the meshes' own material colours, flat shaded. There are no textures (decals, liveries painted as
  textures), no glass refraction, and no subdivision beyond the bench's default level.
- Use it to see shapes and positions while you work; use the bench for the final look.

Matching a build to a reference model is a separate guide: `tools/REF_MATCH.md`.
