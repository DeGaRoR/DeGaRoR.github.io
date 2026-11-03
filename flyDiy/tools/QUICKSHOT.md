# QUICKSHOT — a picture of any build in seconds, no browser

The cage 8 bench in a headless browser takes minutes per picture in a cloud box (software WebGL). `tools/quickshot.js`
builds the same aeroplane with the editor's own layers in node (`_scene_headless.js`, the bench's PAGE.post chain)
and rasterises it itself: about 3 s a picture, no GPU, no browser, nothing to install beyond node.

```
node tools/quickshot.js builds/cub_2026-09-20_corrected.json /tmp/cub --views side,top,front,q
node tools/quickshot.js --key camel /tmp/camel --views q                 # an archetype card, born as the shed births it
node tools/quickshot.js my_build.json /tmp/try --over '{"halfW": 0.6}'    # try a slider without saving
node tools/quickshot.js my_build.json /tmp/nose --views side --crop 1.5,3.5,-1,1 --w 1400   # a close-up
```

Writes `<out-prefix>_<view>.png`. Views:
- `side`: from starboard, the nose to the left.
- `top`: from above.
- `front`: head on.
- `q`: three-quarter from ahead, starboard and above.

Options:

| option | what it does |
|---|---|
| `--over JSON` | panel rows laid over the build before it is drawn |
| `--crop z0,z1,y0,y1` | the side view's window, metres |
| `--w px` | picture width |
| `--marks fittings` | rings on the placed fittings |
| `--marks corners` | rings on quad window corners |
| `--marks reg` | paints the registration's footprint white |

What it is and is not:
- Shapes, layers and fittings are exact: the same meshes the bench draws.
- Colours are the meshes' own material colours, flat shaded. There are no textures (decals, liveries painted as
  textures), no glass refraction, and no subdivision beyond the bench's default level.
- Use it to see shapes and positions while you work; use the bench for the final look.

Matching a build to a reference model is a separate guide: `tools/REF_MATCH.md`.
