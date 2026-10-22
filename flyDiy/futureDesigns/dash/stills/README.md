# Dash redesign: before / after stills (G3340-G3341, 18 Oct 2026)

Each JPG is one strip:
- **BEFORE:** the box, which every saved build keeps.
- **AFTER:** the arch, which is the default for new builds.
- **OVERLAY:** the after render with the old dash outlined in magenta and the new one in cyan.

The builds:
- `cub_*`: `builds/cub_2026-09-20_corrected.json`
- `jodel_*`: `builds/jodel_2026-09-20_corrected.json`
- `cessna172_*`: `builds/cessna172_2026-09-20_corrected.json`
- `rufus_*`: `builds/rufus_2026-10-18_certified.json`, read from `claude/ready/rufus-cert`. It is not on master yet and is not committed here.

The views:
- `side`: from the left, with the near half of the skin cut away.
- `front`: from the seat, looking forward.
- `q34`: from aft, left and above.

Tank colours: **green** means the energy layer's fit finds the tank clear of the dash; **red** means it finds it through the dash. A tank's other verdicts (the crew, the skin) are not this change's, and they did not move.

## How the stills were made
The bench's own WebGL pane draws only the sky under the cloud's SwiftShader (G1320). So these are a software raster (`tools/dash_stills.js`) of the bench's headless scene: `tools/_scene_headless.js` with the crew, panel and energy layers, as GATE TANKMOUNT builds it.
- The geometry is the real thing. The shading is flat Lambert, with no textures.
- "Before" is the base branch's tools/, saved build as-is. "After" is this branch with `dashStyle: 1` set on the same build.
- Both use one framing. `tools/dash_stills_compose.py` makes the strips.

To redo them:

    node tools/dash_stills.js --tools <base tree>/flyDiy/tools --build <build> --out r/<name>_before
    node tools/dash_stills.js --build <build> --out r/<name>_after --over '{"dashStyle":1}' --roi r/<name>_before.json
    python3 tools/dash_stills_compose.py r futureDesigns/dash/stills <name> ...

## What changed
**The top and the face are unchanged:**
- the glareshield, sealed on the windscreen base line;
- the roll;
- the lip;
- the flat instrument plate.

**The sides and the bottom are rebuilt as one arch:**
- **Sides:** two cheeks with a straight, vertical forward edge. The edge stands just past the cabin's front post, so no gap shows beside it. On the Cub it is 4.8 cm ahead of the windscreen corner, covering the tube. Where no post is found, the edge sits at the windscreen corner.
- **Bottom:** gone. There is no slanted floor reaching 0.15 forward of the pillar, and the volume under and behind the plate is open.
- **Plate:** runs down to the box's old bottom line. Without the black border under it, the panel never has less room than it had on the box.
- **Legs:** they go down a side rail, or to the floor (the `arch legs` row), following the wall where the section turns in. They stop short of a doorway. On the Cub, Jodel and Cessna the door opening runs ahead of the panel face, so their legs end at the plate. The doorless Rufus gets legs down to its floor rail.

**Dials (item 12):**
- When the standard layout leaves a dial off, the panel tries one row of dials from the pilot's centre out, with nothing reserved under them. The switch row then takes the lowest clear run: under the dials where there is room, beside them where there is not.
- This applies to arch builds only.

## Numbers (the energy layer's fit, the builds' real tanks; points = dash sample points inside the tank's solid)

| build | tank | box | arch | dials on the plate, box → arch |
|---|---|---|---|---|
| Cub | nose 26 L | 46 pts through the dash | 0 | 11 → 12 (+ volts) |
| Jodel | nose 45 L | 194 pts | 0 | 9 → 12 (+ VSI, oil T, volts) |
| Cessna 172 | wing roots 212 L | 0 | 0 | 16 → 16 |
| Rufus | nose 16 L | 95 pts | 0 | 8 → 8 |

- **Through the skin (vertices >1 mm outside the outer skin):** the Jodel's box 58 at 25.7 mm, its arch 0. The Cub, Jodel and Cessna arches all read 0. Rufus reads 3 at 4.3 mm either way, at the glareshield, which is unchanged.
- **Mass and CG:** identical either way. The dash is not in the physics, and GATE DASH flies the joined Cub and C172 cards both ways.
- **Other tank verdicts:** the Cub's and Jodel's nose tanks still fail the fit for the crew and the skin. That was so before this change too; the tank ranges and stations are EDITOR-UX-A's.
