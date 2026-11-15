# REAL-FIGURES: lessons on fitting a plane to drawings (the Super Petrel LS, the Ruckus)

Written 15 Nov 2026 by the REAL-FIGURES session for the one fitting skill the user asked for. The source is the Super
Petrel V4.2 fit of 10 Nov: about 20 overlay rounds against the maker's three LS drawings, which the user called "the
most complex shape matched the most accurately". The Ruckus photo fit of 9 and 10 Nov is the second source.

Everything named here is on branch `claude/practical-cerf-7fjpwp`:
- the tools: `flyDiy/tools/photo_match/ovls_threeview.py` (7de5ef33b) and `overlay.py`; quickshot's `--deck`, `persp`
  and `cam` (9cf60dd24);
- the rounds: 7de5ef33b, then 8c9a93827 to 999135825;
- the evidence: `flyDiy/reports/evidence/PETREL-LS-2026-11-10/` (the drawings `ref_ls_3/4/5.png`, one overlay per
  round, `petrel_v41_on_LS.png` to `petrel_v42w_on_LS.png`).

`tools/FIT_AND_VALIDATE.md` (on master) has the method from references to report. `tools/REF_MATCH.md` covers the GLB
route and the Archaeopteryx's `blueprint.py`. This file does not repeat them. It holds what the Petrel taught about the
geometry phase.

## 1. The projection tool

### What it does

`ovls_threeview.py` lays our quickshot renders (side, top, front) over the maker's three drawings. Each pair gets its
own scale and anchor. Ours is a red veil with a hard red edge. The drawing stays black on white.

### Inputs

- **Three reference drawings,** one view per file, transparent background. The user cut them from the maker's sheet.
  The ink is any pixel with alpha > 40.
- **Our three renders:**
  `node tools/quickshot.js <build> <prefix> --views side,top,front --noedges`.
  Our silhouette is every pixel that differs from the render's background colour, read at pixel (2, 2).
- **Our frame extents.** quickshot prints `frame <view>: [u0,u1,w0,w1]`. The width u1 − u0 is the metres along the
  render's x, and it goes on the command line.
- **The published dimension for each view, along x:** the side view's length (6.35 m), and the span for the top and
  the front (8.90 m).

### Scaling

- The drawing's scale (pixels per metre) is its own ink extent along x divided by the published dimension. There is
  no ruler on the sheet, and no shared scale between the views.
- Our scale is our silhouette's extent along x divided by the frame width.
- Our render is resized by the ratio of the two. The drawing is first upsampled ×3 (LANCZOS) so thin lines survive.

### Transforms and anchors

All anchors are anatomy, not fitted points:

| view | our render | anchor |
|---|---|---|
| side | flipped (the drawing's bow is on the right) | the bow (the extreme x) and the wheels' bottom (the lowest y) |
| top | turned 90° clockwise (nose up) | the nose (the top y) and the centreline (the x mid-extent) |
| front | as rendered | the centreline and the wheels' bottom |

### Outputs

- One PNG with the three panels stacked: `<out>/petrel_<tag>_on_LS.png`.
- A printed report per view: the drawing's width × height in metres, and ours.

Reading the report's other axis is the free cross-check. The top view's length came out at 6.39 m against the
maker's 6.35 m, so the views agree with each other.

### Why it worked

1. **Each view is scaled by its own published dimension.** A three-view sheet is rarely drawn at one exact scale per
   view, and a composite clips. My first attempt used one composite sheet. It clipped the nose ("You have clipped the
   nose of the reference, and nothing lines up then") and it was the XP's sheet, not the LS's (span 9.04 m, not
   8.90 m).
2. **The anchors are extremes that both pictures surely have:** the bow, the wheels, the nose and the centreline.
   With these, a mismatch shows where the shape is wrong, not where the anchor is.
3. **It is a picture, not a score.** The user read the overlay faster and better than any number, and wrote the next
   batch from it. Their read and mine were cross-checked in a table ("your point / my overlay / verdict") before
   changing anything. Their read had items mine missed (the nose tip, the canopy's flat top). Mine had items theirs
   missed (the lower wing 0.4 m short, the interplane struts).
4. **It reads our drawn geometry.** The render comes from the editor's own layers headless, so what the user sees in
   the garage is what is projected.
5. **It is fast:** quickshot in seconds and the overlay in about a second. A round was the batch's edits, three
   renders and one overlay.

### Its limits, as written

- The dimensions are positional, the output name starts with `petrel_`, and the anchor rules are fixed per view.
- The bubble canopy's footprint was a separate scratch step (`petrel_v42jb_on_LS.png`). For the top view it needs a
  render with the wings and engine off, because the top wing hides the bubble.
- There is no number per part. The differences ("the fin's trailing edge is 0.34 m forward") were read by eye off
  the picture, at the drawing's ~2 px line thickness.

### The photo variant (`overlay.py`, the Ruckus)

- **The fit:** a similarity (scale, rotation, shift) on two anatomical points. These were the prop hub and the
  tailwheel, clicked on the photo and on our render.
- **The camera:** a photo needs our camera placed where the photographer stood. quickshot's `persp` view is a
  pinhole camera (`--eye x,h,z`, `--look`). The Solo 103 photo was taken 7 m out, 1.85 m up, 2 m ahead of the middle.
- **The attitude:** `--deck DEG` stands a taildragger on its gear.
- **My mistake:** I guessed the camera. The user corrected it ("the camera right below the wingtip ... 2 meters
  away, zoomed in"). Ask where the photo was taken from before fitting a camera to it.

## 2. The workflow over the rounds

1. **Before the overlay:**
   - The maker's figures for the exact variant (LS: 6.35 × 8.90 m, 386 kg empty).
   - Doubt the length probe first. The user said a fitted plane "can't miss 60 cm". The probe was counting 91
     construction vertices that nothing draws.
2. **Round 0: the unchanged card on the drawings** (V4.1). A table of what matches and what doesn't, per part, with
   the view that shows it and the distance in metres. The user read the same overlay independently, and the two
   reads were merged.
3. **Rounds 1–2: proportions** in one batch:
   - the top wing 0.30 m forward, with the engine;
   - the rod +15 cm;
   - the stabiliser rectangular;
   - the lower wing aft and higher.
4. **Rounds 3–4: the tail only** ("let's only work on the tail ... get the shape fully correct before we get into the
   detail"):
   - first the shape: the rudder's trailing edge vertical at rest, the hinge raked 6°, the horn at 89 % of the height;
   - then the sizes: the rudder's chord ×0.6, the foot 5 cm aft, the fin 10 cm taller.
5. **Rounds 5–6: the consequential moves:**
   - the cabin's back 20 cm aft, with only the cabin moving;
   - the boom 5° steeper.

   I traced the bubble's footprint into every later overlay. A "tab" turned out to be the tip floats' tail.
6. **Rounds 7–12: the engine group.** The pylon, the nacelle, the cowl's top line, the nose cone and the intake.
7. **Rounds 13–16: wings and details.**
   - The lower wing to its drawn span (+19 cm a tip, measured on two views) and dihedral (2.2°).
   - Then the intake lip, the clips, the rod's socket, the float's transom, and the fin's leading edge made straight.
8. **Then geometry was frozen,** and only after that the internals, the balance, the flights and the water run. These
   are FIT_AND_VALIDATE phases C to E.

Every round:
- edits in the recipe (`builds/edits/superpetrel_V4_2.edits.json` + `_rejoin_build.js` → the candidate);
- one overlay;
- a short note of what moved, what didn't and why;
- a commit (the "(built)" commit only when the code changed).

No flight checks during geometry rounds. The user: "you just do the modification, you show me the outline, then we
move to the next ... you don't check the plane in between". They also asked: "publish the next one when your overlay
is final".

## 3. Where I struggled, and the cause

| struggle | cause | what fixed it |
|---|---|---|
| The drawings the user pasted could not be projected | Images pasted inline are not saved as files. A session sees them but cannot read their pixels. | Ask for attachments (or commit them) on minute one. |
| The first overlay clipped the nose; span 9.04 m | A composite sheet, and of the XP, not the LS | One view per file, the exact variant |
| "The length can't miss 60 cm" | The probe counted construction vertices nothing draws | Measure drawn faces only (REAL-FIGURES e5270a9ca) |
| A row did nothing | `finLEZ` is inert on a fin with a dorsal. `finBaseZ` alone shears the fin. | Move the fin's corners. Test every row on the build before trusting it. |
| The cowl's taper rows did nothing | The cowl was in "fit to the engine" mode, which rewrites length, size and taper on every build | Switch to a free cowl at the fitted size (REF_MATCH pitfall 6, met again) |
| Measured ≠ flown | Silent clamps: the fin taper's floor 0.35 (and the 75/25 chord ratio read 0.53 for a drawn 0.23), the post gap's floor 0.35, the tip floats' 60 kg sizing floor | Look for a `genClamp` first. Fix the clamp as a rule (ce7c6b0f9, 05434f79c). |
| "5 cm down and 5°" lifted the tail 20–25 cm | The rod tilts about its root, not its middle | Think in the pivot the row uses. Lower the root by what keeps the tail on the drawing. |
| One move dragged others | The hull step is measured from the cabin's back. Tip floats sit at a fraction of the lower wing's span. | After a move, re-check what is measured from it. Hold the absolute positions. |
| The outline hid the real error | The cabin was 20 cm short, seen only from the antenna and the bubble's end | Trace the canopy's footprint. Render with the wings off for the top view. |
| A grey "tab" over the afterbody | The tip floats' tail seen side-on, once the hull was lowered | Find the mesh before deleting anything |
| The pylon's flare twisted and the shading went strange | The flare squeezed between the nacelle's flat belly and its sides | A straight joint where the pylon meets a nacelle |
| The cowl swallowed the nose cone | The cone hangs off the prop flange, not the cowl. The cowl's rear cap grew over it. | The cone never moves with the cowl; shorten the cowl |
| Lowering the engine put the prop through the deck | The prop check runs on the build | Read the build's own check after any engine move |
| Sliders the user could not find | The boom frame's rows were hidden whenever there was a rod and a taper (a rule older than the hull's float section). The taper slider stopped at 1.6 (the Petrel's is 2.06). | Show hidden but active rows; widen ranges (e9c8d23dc) |
| The user commenting on half-finished rounds | I published intermediate overlays | Do the whole batch, then publish one overlay |

## 4. What a new session must know on minute one

1. **Get the references as files:**
   - one view per file, on a transparent background;
   - the exact variant and engine;
   - the maker's dimensions.

   Ask for attachments if the images arrive inline only.
2. **Use the tool that exists. Do not write a new projection.**
   - For drawings: `ovls_threeview.py`, or `blueprint.py` for line drawings with dimension lines.
   - For a photo: `overlay.py` with quickshot's `persp` camera, after asking where the photo was taken from.
   - For a GLB: REF_MATCH.
3. **Start from the right architecture, not from zero.** Pick the card whose structure is right: hull or pod, the
   boom type (rod or taper), the gear, the canopy. Archaeopteryx: "take the cabin from a card whose ARCHITECTURE is
   right". The user: "a good starting point really makes the difference". The Petrel's V4.1 was a good start, and
   most rounds were proportions, not invention.
4. **Know the choices before shaping:**
   - **The canopy** (`canopy`): closed, convertible, open or bubble. Then `bubH` and `bubAt` for a bubble.
     "Glass ceiling" (the `bubble` row) is a different thing.
   - **The boom:** a rod (`rodD`, the root, the socket), a taper section (a hull's aft float when "boat hull" is on),
     or both.
   - **The cowl:** fitted to the engine or free.
   - **The fins:** with or without a dorsal (it changes which rows act).
5. **The order is fixed:**
   1. proportions in the side view;
   2. the plan;
   3. the front;
   4. the parts;
   5. the details.

   For fins and stabilisers, go preset → macro → micro: the shape first (a vertical trailing edge, the hinge's rake,
   the horn's height), then the sizes, then the lines (a straight leading edge).
6. **Anchors on anatomy, differences at named parts.** Name the place: "the fin's trailing edge 0.34 m forward", "the
   boom's underside 8 cm low at the tail post". Never random sample points.
7. **No tests while the geometry is wrong.** Batch the edits, one overlay per batch. Freeze the geometry, then run
   the balance and the flights.
8. **The nose between the windshield and the firewall,** the Ruckus rows:
   - the windscreen: run `wsRun`, base bow `wsBaseBow`, base lift `wsBaseLift`;
   - the nose: crown `noseCrown`, deck skin `noseDeck`, the nose frame's bottom and top `frNoseBotY` / `frNoseTopY`;
   - the window pillar's foot: `frWinBotY`;
   - the firewall's top.

   The rule: keep the nose's bottom on the cabin keel's line, then shape the top line.
9. **The cowl,** the Petrel rows: the top line's height at the firewall `cw_deckH`, at the barrel's end `cw_taperH`,
   and the axis drop and recovery `cw_lidRise` / `cw_faceRise`, which keep the bottom level and the ring on the
   spinner. The rest is REF_MATCH section 4. Keep the waistline (the cowl's and the body's) continuous through the
   firewall before anything else.
10. **When a row does nothing,** it is held (a fit mode), clamped (`genClamp`), inert for this configuration, or
    hidden. Dump the born spec and read it back.
11. **Every fitted value lands on a garage row.** A missing control is a gap, built as a general rule with
    `absent: 0`, so every other build is unchanged. The Petrel added `hullTipLen`, `hullTailCut`, the rod's socket
    rule, the inlet band and the pylon rules this way.

## 5. Missing tooling

1. **One projection tool, not three.**
   - `ovls_threeview.py` (scale by published dimension, anatomical anchors, a picture for the user);
   - `blueprint.py` (traced silhouettes, IoU and station tables, fitters);
   - `overlay.py` (photos).

   Merge them: `blueprint.py`'s numbers with `ovls_threeview.py`'s own-extent scaling and anchors, one config per
   plane (`refs/<plane>/`) instead of positional arguments, and the photo mode as a fourth view type.
2. **Named differences, printed.** Per part: the fin's trailing edge, the wing's LE / TE at the root and tip, the
   boom's underside at the tail post, the nose tip, the wheels. Each as Δ metres, so the session's read and the
   user's can be compared line by line.
3. **The canopy's footprint and hidden parts as standard layers:** a wings-off top view and the bubble traced, every
   time.
4. **A row census for a build:** for each visible row, does it act here? Flag held, clamped, inert and hidden rows
   before the first round. That is most of section 3.
5. **The camera from the photo:** a solve for eye position and focal length from 4–6 anatomical points, instead of my
   guess.
6. **The round as one command:** `fit <plane> <tag>` = rejoin the recipe → three renders → overlay → the
   differences table → the evidence file named by round.

## 6. Landing `photo_match/` on master

It is only on `claude/practical-cerf-7fjpwp`. What it takes:

1. **quickshot first.** Master's `tools/quickshot.js` has none of `--deck`, `persp` or `cam` (9cf60dd24), and has
   moved since (58 / 60 lines differ). Port the three blocks onto master's file; all three are opt-in, so the default
   views draw the same bits. Then the photo overlay works. There is no quickshot gate; a one-line smoke run of `persp`
   and `--deck` belongs in the ready note.
2. **The two scripts:**
   - `ovls_threeview.py` → `tools/photo_match/`, with the hard-coded `petrel_` prefix and the dead `V` dims removed;
   - `overlay.py`'s default photo path removed (it points at the Ruckus evidence).

   Both are pure PIL + numpy and read only their arguments, so they gate nothing.
3. **The Petrel's drawings and the overlay evidence** are already committed on the branch
   (`reports/evidence/PETREL-LS-2026-11-10/`). Bring the three `ref_ls_*.png` as the worked example (`refs/super_petrel/`
   in ref_match has only an eyeballed target).
4. **A section in `REF_MATCH.md` or the new skill:** this file's sections 1 and 4. Then point FIT_AND_VALIDATE's
   section 11.2 ("the three-view drawing overlay ... still a scratch script") at it.
5. **Better: land it already merged with `blueprint.py`** (section 5.1), so master gets one tool. That is the
   FIT-PROCEDURE / Drafting Table session's ground; I can do the port of items 1–2 as a small ready if A0 wants it
   separately.

The Petrel V4.2 card itself rides the REAL-CANON line (`builds/candidates/superpetrel_V4_2.json`, `real_refs`
petrel42). No physics change is needed to land the tools.
