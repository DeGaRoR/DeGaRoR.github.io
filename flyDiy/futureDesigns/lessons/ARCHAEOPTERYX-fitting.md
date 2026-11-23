# Lessons learnt fitting planes: the Archaeopteryx and the LS4 (the Archaeopteryx session, 10-15 Nov 2026)

Two fits from drawings, no 3D model: the **Archaeopteryx** (the maker's 2005 three-view, 800 x 565 px, then a weight
path from 169 to 80 kg) and the **LS4** (the factory sheet 1U-87 at 1:25, a small 0-4 m three-view, the type data).
Branch `claude/archaeopteryx-sailplane-study-q8tzz2`. The study notes: `futureDesigns/archaeopteryx/STUDY.md` and
`WEIGHT_STUDY.md`; `tools/REF_MATCH.md` section 12 (the Archaeopteryx's blueprint route); the LS4 prototype's rows,
birth script and overlay in `tools/ref_match/refs/ls4/`.

## 1. The workflow, as it finally worked

1. **The data first, with sources.** Span, area, chords, length, height, empty mass AND what it includes, MTOW, the
   glide figures. Write them down before touching a row (STUDY.md section 2 is the model).
2. **The scale off the drawing's own dimension labels, on both axes.** The span label for x, a chord or the length
   label for y (several labels each, compared). Then find the nose tip and the tail tip **by the dark pixels in the
   centre column**, not by eye: dimension lines sit right next to them.
3. **The starting card by architecture, not by look.** Pick the card whose structure is right (the Archaeopteryx's
   cabin from the Chinook's, the LS4 from the motorglider plus the cage page's `sailplane` preset), then the type's
   global numbers in metres (span, chords, length).
4. **The attitude before the shape.** The side view stands at its ground attitude (the LS4's 6.5 deg nose up, rotated
   about the main wheel's contact); the front view of a factory sheet is drawn level (the flight datum). Project each
   view at its own attitude. Move the boom and the tail with global rows, never by drooping one to fit.
5. **Fit in this order, overlaying after each step:** nose anchor (re-anchor the overlay on the nose tip), the cabin
   side, the boom and the tail cone, the wing (planform, then station), the fin and the stab (preset, then macro rows,
   then the corner rows), then the gear.
6. **Then the hidden parts and the look:** controls inside (`hgHorn 0`, piano hinges `hgFamily 2`), the seat and
   pilot, the canopy, the tip skids. Render 3/4 views and a headless dump of the tail and the cockpit.
7. **Then the weights and the flight**, against the sourced numbers (`real_check`, `GATE REALBAND`), and only then the
   gates.

## 2. Where I struggled, and why

| stone | what went wrong | cause |
|---|---|---|
| **the reprojection** | the LS4's plan was read with a 13 % fore-aft stretch (15.4 against 17.65 mm/px); the user saw "the body too long, the cabin too wide, the wing too far aft" | I took a dimension line for the nose (row 783, the real tip 766) and another for the tail (342, the rudder's tip 377), then concluded the scan was non-square. Measuring a chord and the stab's 500 mm label would have shown the square scale at once |
| **reinventing the projection** | I wrote a scratch overlay script for the LS4 instead of `blueprint.py` (the Archaeopteryx's) or the drafting table | not checking what the tree already had; the scale bug above lived in my own code |
| **the plan view's orientation** | the LS4's leading and trailing edges swapped in my reading, one wrong iteration | the sheet is nose DOWN: the straight line was the LE; on the Archaeopteryx's sheet the straight one is the TE |
| **"the fin does not match on the front view"** | a 0.4 m mismatch that was not a fin problem | the front view drawn level, ours at the ground attitude: the tail drops ~0.5 m against the wingtips |
| **the boom** | the first boom drooped to match one view | fitting a view instead of the attitude: the user's rule, "get the shape through the global attitude, the boom's back end goes up" |
| **the fin and the stab** | a curved LE; the stab floating 1.2 cm over the fin; the stab shrunk and moved aft later | the card's `finTipZ` corner made the bulge; `stY` is an offset FROM the fin tip; the straight-fin preset (`finArchWrites`) also writes the STAB's corners (`ST2FIN`); the stab's span scales with the cabin width (`halfW`); the stab rides the fin tip (`zSeat`), so moving the fin tip moves the stab |
| **forgetting sliders** | a sel tile (`finArch`) silently overwrote the fin rows I had set | `designBake` applies the sel tiles after `over.cage`: set `_sel: { finArch: null }` |
| **units** | a 0.58 m main wheel on the LS4 (it should be 0.31) | the gear rows are METRES (`dim: 'm'`), the body rows cage units x `planeScale`; I passed a cage value |
| **the weight (Archaeopteryx)** | the lightest build the rows gave was 141 kg against ~72 | not a fitting error: the garage had no light-construction rows. The fix was a weight path, L1-L10: the D-tube wing, the soft shell, the hub, the ultralight monowheel, the pack case, the instrument pod... (`WEIGHT_STUDY.md`) |
| **the weight (LS4)** | 135 kg against 238 | the reference was right (empty, no pilot); our structure is sized for one pilot and no water (~215 kg design gross) at a light aeroplane's load factor; the LS4 is built for 472-525 kg with water at +5.3 g. Checked, named, not "fixed" by ballast |
| **the glide** | L/D 13.6 (Archaeopteryx, real 28) and 28 (LS4, real 40) | the body drag build-up (~3x a sailplane pod's CdA), the stab brace wires carried from the Cub-style tail onto a T-tail; waiting for the drag study |
| **testing too early** | gate runs broken by my own edits (STALE CORE), a red pushed (DESIGN's taper note) | rebuilding while gates ran; not running the gates that read a changed envelope |

## 3. What fixed it

- **The scale:** labels on both axes, ends found by dark pixels in the centre column; the LS4's plan at 17.65 / 17.45
  mm/px (`tools/ref_match/refs/ls4/overlay_ls4.py`, nose row 766, rudder tip 377). Commit `36163b6cd`.
- **The attitude:** `PITCH=6.5` about the main wheel's contact for the side view; the front view level.
- **The fin:** the straight corners plus the shoulder that makes the LE one line (`finShoulderZ` 0.15 with `finTipZ`
  0.25), the dorsal tried both ways (`finDorsal`; the LS4 has none: a root fillet `finFillet` 0.04 instead).
- **The T:** `stMount 2` (on the fin tip), `stY -0.06` (the halves close on the fin's sides), `stZ`, `stSpan`,
  `stChord` re-set after any `halfW` change.
- **Controls hidden:** `hgHorn 0`, `hgFamily 2`. **The clear canopy:** `canClear 1` (new row, a look only, `8fcb942db`).
- **The wing:** the double taper (`wgChordTip`, `wgCrankAt`, `wgCrankChord`); a slender wing's taper floor 0.35
  (`GEN_WING_ENVELOPE.slender`, `genTaperLo`, `2b3267ee7`).
- **The sailplane parts:** engineless (`engOn 0` -> `engines[0].none`, GATE ENGINELESS, `e9aaf6fcb`); the ultralight
  monowheel retracting (`460a44a0f`).
- **The views:** the garage camera is az 0 behind, pi in front, pi/2 the left side; `dump_build.js` + a per-layer
  tail and gear view in the scratchpad was the fastest close-up.

## 4. What a new session must know on minute one

1. **Use the drafting table** (`tools/DRAFTING_TABLE.md`, `tools/drafting/`) or `blueprint.py`. Do not write your own
   overlay.
2. **Measure the scale from labels on BOTH axes, and the ends from the pixels**, before any fitting. Assume nothing
   about a scan being square or not: measure.
3. **Know the sheet's orientation** (nose up or down) and **each view's attitude** (ground or level).
4. **Start from the card with the right architecture** and the cage page's presets (`sailplane`, ...).
5. **Rows in metres vs cage units:** gear rows are metres; body and fin rows are cage units x `planeScale`.
6. **Sel tiles override `over.cage`** (`finArch`, `intCons`): null them in `_sel` when you set the rows yourself.
7. **The tail is coupled:** the fin's corners, the stab's seat on the fin tip, the stab's span through `halfW`.
8. **Check what an "empty mass" includes** before chasing it, and what the structure is sized for (the design gross).
9. **Never edit or rebuild while gates run**; run the gates that read what you changed (an envelope change: WINGROWS,
   DESIGN), and the fleet hash for "no card moved".
10. **Fly it as the game does:** born through the join (`LB.gameSpecFull`), not `designBake` alone. A hanging nacelle
    has no mast without the join.

## 5. Missing tooling

- **A scale and ends finder** in the drafting table: read the dimension labels, return mm/px per axis and the nose and
  tail rows, with a warning when the axes disagree.
- **A view's attitude** as a field of the reference block (ground pitch about the main wheel, or level).
- **An orientation flag** per view (nose up or down) printed on every overlay.
- **A tail-coupling report:** after any row change, print the stab's span, chord and seat against their targets.
- **A camera that can look from below** in the garage (the elevation is clamped at the horizon), and a reliable pan to
  a part (the `pan` argument did not frame the tail or the cockpit).
- **A glider's tools:** a minimum-sink row in `real_check`; airbrakes (the flaps stand in); water ballast in the
  design gross; a sailplane load factor; the drag of a laminar glass pod; a cantilever T stab without wires.
- **The Archaeopteryx's own:** it rests on its wingtip skid and does not take off on its own power in `real_check`
  (thrust 300 N, "not accelerating"): a wings-level hold for a monowheel's ground roll.
