# BUBBLE-WINDOWS READY (CABIN-CRAFT, 8 Nov 2026, for train L35a)

Branch claude/ready/bubble-windows, on master e0457618d (L33a). Code 9bfd48edd, built 77aa530df (build f214d2841a84). On top: this note and HANDOVER.

The user 7 Nov, via A0: "bubble windows would be cool, maybe we slot it in if this is a quick job". A0: waist blisters only; domes wait until the user has seen these.

## What lands

- **Three rows, `paxWinBulge`, `win2Bulge`, `win3Bulge`** (page 5, under each row's reveal depth; "bubble", 0 to 0.2 m, 5 mm steps; shown when the row has windows; absent at 0). In the drawnWin part group.
- **The blister** (`_knife_gen.js` knifeCut): the window's loop becomes the dome's rim. The reveal wall drops to 0, so the pane starts at the skin and the bead covers the seam. Six rings and an apex, a quarter-sine profile, standing on the skin's own curve. The height is capped at half the window's smaller side. The panes keep the drawnPane material: no new section, draw or program.
- **Unset row = the window as it was** (`_cage_gen.js` sets `w.bulge` only when the row is > 0).
- **Gate KNIFE section 6, BUBBLE**: rounded, oval and triangle windows at 0.05 m. Each must be watertight with no reveal wall, the dome's height over the loop between 0.8x and 1.6x the row, and a row at 0 must give the flat sheet's hash.

## Limits

- A pane that crosses a door edge or a cut part keeps its flat pane (the dome needs one closed loop on one part).
- No overhead domes (A0: after the user sees these).
- No look in the game or on the graphics card: the stills are SwiftShader (plane_shot's studio light, not daylight) and node quickshot.
- Side effect: on the twin the aft door handle sits about 5 cm lower with the blister, because fittings keep clear of the pane. It shows in the stills.

## Cost (the numbers A0 asked for)

Drawn-pane triangles, both sides, sheet level 2 (the count does not depend on the height):

| build | flat | blister | added |
|---|---|---|---|
| twin 4b | 232 | 612 | +380 (level 3: 584 -> 800, +216) |
| Cessna 172 | | | +712 |
| Cub | | | +428 |

Twin 4b at 0.09 m (node identity): mass 819.911 -> 820.224 kg (+0.313 kg of glass; glass is billed by its area). Same 409 meshes; the sheet, ledger, design, procure and fly20 hashes move with the glass.

## Builds without the row stay identical

`tools/newshapes_identity.js` on archives of e0457618d and HEAD: **all 6 lines identical** (cub, jodel, metal, floats, twinFloats, rufus: spec, def, draw, mass, ledger, sheet, design, procure, fly20). The draw probe does not walk the cage skin; the sheet hash covers it.

## Gates (A0's CPU slot, Sun 8 Nov 00:50, `run_gates.js --no-build --jobs 2`)

```
DEFAULT PASS  DMGGLASS PASS  EDBUGS PASS  KNIFE PASS  QUADWIN PASS  JOIN PASS  SAVE PASS  PARTS PASS  DESIGN PASS
SKINMAT FAIL  "a click on a surface in the FINISH view does not land on its own section's row"
CLIP    FAIL  "stock+ifr/rest: navAerial/centre ... 9.2 mm INTO edFinSkin (allow 5.5 mm)" (x4 poses)
KNIFE   ok  BUBBLE triangle stands 0.066 m out of its loop (row 0.05, the skin's own curve on top)
KNIFE   ok  BUBBLE triangle a row at 0 is the flat window
```

Both reds are on master already, word for word: SKINMAT's finish click since 5 Nov (WRAP-UP-2026-11-04 line 185), CLIP's navAerial since L29g (FINISH-4's standing list). Neither touches windows.

## Pictures

`D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-08/bubble-windows/`:
- twin4b_waist_flat_vs_bubble.png: the flat pane's broad glare against the blister's point highlight;
- twin4b_front_flat_vs_bubble_quickshot.png: the domes stand out on both flanks;
- twin4b_side_flat_vs_bubble_quickshot.png;
- twin4b_bubble_hero.png and twin4b_bubble_cabin34.png;
- plus the gate log, the identity diff and the cost lines.

The wing's light differs between the two plane_shot runs (bubble first, flat second) in every pair, far from the window. The cause is not known.
