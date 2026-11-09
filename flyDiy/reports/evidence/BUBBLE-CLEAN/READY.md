# BUBBLE-CLEAN READY (CABIN-CRAFT, 8 Nov 2026, for train L35c)

Branch claude/ready/bubble-clean, on master 1bcd01d3e (L35a). Code 7f5df53f1 (`tools/_knife_gen.js` only), then its built commit, then this note and HANDOVER.

The user 8 Nov, via A0, on the L35a side view: "in your side view there are some little squares on their side at the bottom of the windows... make sure that the geometry is as clean as it can."

## What was wrong

Two things made the blister lumpy:
- **The base was the faceted skin.** Each ring stood on the pane pieces (the skin's flat facets) and lifted along normals blended linearly across the sill's crease, so the lift came out in lumps.
- **The rings had different counts** (the rim's points, then about half of them), so the stitch between rings made irregular slivers. In flat shading these were the tilted squares along the window's foot.

## The fix (`knifeCut`, the blister block)

- **One smooth surface under the window:** a quadratic height over the tangent plane, least squares over the pane's skin points plus the skin sampled inside the outline. An oval's rim is itself a conic, so the rim alone leaves the quadratic free to bulge; KNIFE caught 9 cm over a 5 cm row before the inside samples went in. The rings stand on this surface and lift along its own normal.
- **The rim keeps the loop's exact points**, so it stays watertight with the skin and the bead. How far the rim sits off the smooth surface fades out inward (cos^2).
- **One spoke per rim point:** every ring is sampled at the rim's own fractions, so the dome is quads from ring to ring, with no slivers.
- The field coordinates (A) still come from the skin, as before.

## Cost

| | before (L35a) | now |
|---|---|---|
| twin 4b blister tris per window | 306 | 770 |
| twin 4b pane tris, both sides | 612 | 1540 (+1308 over the flat pane) |
| Cessna 172 | +712 | +2268 |
| Cub | +428 | +1356 |

Still one section and no new draw or program.

## Heights (KNIFE's measure: highest pane point over the loop's mean plane, row 0.05 m)

| shape | skin's own curve | blister |
|---|---|---|
| rounded | 0.021 | 0.068 |
| oval | 0.015 | 0.063 |
| triangle | 0.017 | 0.066 |

Each blister is the row plus the skin's own curve. The twin's probe is back to 0.0585, its value at L35a.

## Builds without the row stay identical

`tools/newshapes_identity.js` on archives of 1bcd01d3e and HEAD: **all 6 lines identical** (cub, jodel, metal, floats, twinFloats, rufus: spec, def, draw, mass, ledger, sheet, design, procure, fly20). Only the blister block changed.

## Gates (node, `run_gates.js --no-build --jobs 2`)

```
DEFAULT PASS  EDBUGS PASS  KNIFE PASS  QUADWIN PASS  JOIN PASS  SAVE PASS  PARTS PASS  DESIGN PASS
SKINMAT FAIL  "a click on a surface in the FINISH view does not land on its own section's row"   (master 1bcd01d3e has it)
CLIP    FAIL  "stock+ifr: navAerial/centre ... 9.2 mm INTO edFinSkin"                           (master 1bcd01d3e has it)
KNIFE   ok  BUBBLE rounded / oval / triangle watertight, 0.068 / 0.063 / 0.066 m at row 0.05, a row at 0 is the flat window
```
DMGGLASS (headless Chromium) not run: A0 asked for node only.

## Pictures

`D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-08/bubble-windows/`:
- twin4b_side_bubble_before_after.png: the user's view, before and after;
- twin4b_front_bubble_before_after.png: the dome's outline from the front is unchanged.

Both are node quickshot (flat shading, which shows every facet). Not looked at on the graphics card or in the game.
