# Fitting lessons from the Cessna 172 refit (FLAGSHIP, 15-16 Nov)

## The order that worked (fit a body in this order)
1. **The thrust line first, and pin it.** Measure the hub on the level-2 build with the cowl ON and keep it fixed (HUBY in the scratch dt_node). Every other fit is in that frame. A cowl fit that moves the axis (cw_lidRise) silently moves the propeller and everything placed after it. We lost a whole window pass to a 4.8 cm hub drop.
2. **The frames (side profile):** firewall, A post, cabin, roof, taper bottom line. The roof is also the wing's seat: lowering the cabin top lowers the wing, so compensate with wgDy in the same step.
3. **The wing:** station, thickness and incidence against the side view. Then check the roof against the wing's underside (no clip) and the screen top against the leading edge (no poke).
4. **The windscreen:** side outline first, then plan shape (a real screen is often a U from above: shoulder columns, not a fatter centre bow). Keep the base corner on the deck.
5. **The cowl:** length and width, then the firewall section in free mode, then the bottom line, then the face. Fit it with a coordinate-descent fitter that starts FROM the plane's values (not 0) and carries a penalty on the hub.
6. **The gear:** leg stations and track from the drawing's dimensions, then the fairings.
7. **The windows, last:** they ride the frame. Re-place them after any frame or axis change.
8. **The strut and fittings:** anchor on the frame's real posts (the pillar record), not on a free station.
9. **The livery, after the shape is final.**

## What worked
- One scratch override file per trial (vNN.json) on top of the plane file. Diff two trials to see exactly what a step changed. This is how "what did the engine fix change on the cowl" was answered in one command.
- Level-2 overlays for every fit and every measure (the user's rule). Level-0 numbers lie about rounded corners.
- Reading the drawing's own dimensions (e.g. "7 ft track", "11'-4" stab span") and converting with the sheet's k (px per m).
- Quick A/B renders in the part-colour view at a tight `--around` point. Four variants in one grid name the guilty row in one round (the windscreen lip: wsShoulder off vs X vs Top vs ToWaist).
- `--door` on every check render: the game's load door, so the join's fields (strutFoot, the bracing) are drawn as flown.
- Writing the final file with tools/_rejoin_build.js (the page's join), then rendering that file and checking the picture is byte-identical (image md5) to the last trial.

## What wasted time
- Fitting before pinning the thrust line (above).
- A fitter that initialised rows at 0 instead of the plane's values, and a REF table keyed by strings ("1.0") looked up by numbers.
- A sub-part corrupting a fit: the chin scoop dragged the bottom-line fit. Fit with the sub-part off, then put it back.
- New rows that did nothing because the module's P only carries keys in its defaults table (keelLevel), or because the engine's latent table was not given the key (eng_cylK). Add the default first.
- A join-written field set from the wing layer's own frame (a different cabin): the drawn strut foot and the flown one disagreed. Put the field where the join measures it (the pillar record).
- Decal "Fit" is EDITOR-ONLY: headless renders ignore it, so place L/C/W/H by hand in the craft frame (x lateral, y aft, z up).

## Traps to put in the skill
- The headless join drops rows it does not know (the crew layer's pilotWho / copWho / dum*). Carry them over by hand after a rejoin.
- A window drawn on a door is a knife pane, not band glass; the door's inner panel covered it from inside (fixed: _shoulder_gen panelBuild).
- A side-box livery stripe paints through to the cabin's inner lining (it shows through the windows). Still open.
- Slider ranges are not generator ranges: wsCeilBow 0.88 is outside its 0.00-0.60 slider. Widen the row when you land a value outside it.

## Two lessons from the last day (16 Nov)
- **A squareness row at 0 is not round.** The cowl's opening squareness (cw_apSq, through sqExp) runs 0 = diamond, 0.5 = circle, 1 = square. The user saw a diamond round the spinner; the row was 0 because "0 = plain" was assumed. Read the row's law before you set it, and make the opening equal on both axes (cw_apW = cw_apH) so the gap round the spinner is even.
- **A falling top line needs a convex control polygon.** The "dip to the propeller" (deckFall) made the cowl's top line fall toward the nose, but the Bezier's rounding control still aimed at the firewall's height: the line sagged, then climbed back - a hump near the nose. The generator now draws the falling line as one curve in the seen frame (_cowl_gen.js, DECK-FALL AS ONE CONVEX LINE). Check any cowl change with `cowl_fit.js line`: 0 mm worst dip = one monotonous line.

## The tools (tools/drafting/cowl_fit.js)
- `node tools/drafting/cowl_fit.js line <doc.json> [--over '<json>'] [--every 5]` - the cowl's top line at level 2, nose to firewall, every 5 mm, and the worst dip going aft (the hump detector).
- `node tools/drafting/cowl_fit.js fit <doc.json> --ref <ref.json> --keys 'row,lo,hi;...' [--hub <m>] [--weights '{"1.31":30}'] [--level-belly] [--out over.json]` - coordinate descent of garage rows against the drawing's cowl stations ({ "<station m>": [top, bottom, half-width] }, null = unread), the thrust line held (penalty on the hub), started from the plane's own values. A station past the cowl's end is named, not scored. A name that is not a cage row is refused.
- The overlays: `table.js check <doc> --over '<json>' --level 2 --sheet <three-view.png> --png <prefix>` with `HUBY=<the level-2 hub, cowl on>` in the environment. Renders: `tools/quickshot.js <build> <prefix> --views q,qr,side,front,top --w 2400 [--door]`.
- The figures before landing: `node tools/real_check.js --build=<file> --ref=<row> --quick` on the new file and on master's (same verdicts = same fit range), then REAL-FIGURES' full run. `--build` paths are joined to flyDiy/: copy a scratch file into builds/ for the run and remove it.
- The fiche: `node tools/fiche_physics_bake.js --only list:<n>` (node), `node tools/fiche_bake.js --gpu --only list:<n>` (a GPU slot), `node tools/fiche_reference_bake.js` after REAL-FIGURES' report. `thumb_bake.js --only design` rewrites the thumbs index with what it baked: bake, keep the plane's files, restore the rest from git.
