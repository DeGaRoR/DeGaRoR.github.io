# PROPER-COWLS: lessons learnt on fitting a cowl and the nose section

Written 15 Nov 2026 for A0 by the cloud session that built the cowl method (branch `claude/pensive-wozniak-ib8yjq`;
`claude/ready/proper-cowls` sits at the same tip, `1cb6c803`). A0 integrated rounds 1-9 on master as `21633574`
("PROPER-COWLS READY 1", L36a), with `39b631b1` holding `reports/evidence/PROPER-COWLS/READY.md`. That integration keeps
saved builds' split lines as they were drawn (`partLevel` absent = the old draw) and adds the rows `partArc` and `podFit`.
Rounds 10-13 are NOT on master yet:
- `601be971`: ogival cheeks;
- `b03bbca4`: the DC-3's radial cowl;
- `29c2df8d`: the nacelle firewall (already used by WING-STRUCTURE `c1628a80`);
- `0eb7fbda`: nothing sticking out of an electric's nacelle.

The method lives in `flyDiy/tools/cowl_study/straight.js` (the rule: `measure`, `rowsFor`, `finish`) and
`flyDiy/tools/cowl_study/clear.js` (the clearance probe). The generator is `flyDiy/tools/_cowl_gen.js`, its rows are in
`_cowl_rows.js`, and the cage layer is `_cage_cowl.js`. The engine drawing is `_eng_mesh.js`, `_eng_gen.js` and
`_cage_eng.js`.

---

## 1. The rules integrated (rule / control or key / file)

### The body cowl: nose, and a pusher's aft face

1. **The cowl's aft edge is the firewall.** It is sealed to the fuselage's section there, in size and shape. Control:
   `fitNose` 2. Files: `_cage_cowl.js` (FIREWALL RULE), `straight.js aftSection`. The user: "I think the back cowl should
   be constrained to stick to the firewall".
2. **The widest line is the plane's waistline.** The firewall section's waist is the cage's `waistY`. It is fitted only
   on a round-topped cabin (`topRound >= 0.5`) or a pusher's aft face. The roundness above and below the waist is always
   fitted. Keys: `cw_waist`, `cw_sqAftTop`, `cw_sqAftBot`. File: `straight.js aftSection`. The user (8 Nov): "matching
   the height of the waistline ... allows the cowl to enlarge where it should".
3. **The waistline runs straight to the front.** `cw_waistF` is the widest line's height at the barrel's end. It runs in
   a straight line from the firewall's waist to the front's. Without it the waist is held at one fraction of a shrinking
   height and climbs or falls. Files: `_cowl_gen.js prepareLid`, `straight.js` (`out.cw_waistF`).
4. **The front is centred on the propeller, and the thrust line never moves.** The ring is lifted on its own: `cw_faceRise`
   with `cw_faceRing` 1 lifts the ring only, with `lidRise` 0. `engY` is folded into the cowl's axis (`engY` 0,
   `faceRise` = the prop's offset). File: `_cowl_gen.js spineY`, `axisXY`. The user: "aim for center the face of the cowl
   on the prop/engine ... That should be a rule".
5. **The front is shrunk to the engine and narrowed.** The front half-height is the engine's box. The front half-width
   is `FRONT_W x aW`, or for an in-line, two-stroke or pusher, `max(1.06 x the drawn engine half-width + 2 cm, 0.45 x aW)`.
   Keys: `cw_taperW`, `cw_taperH`. File: `straight.js rowsFor`. The user ruled on 9 Nov that a pusher's 0.68 stays
   ("068 was fine, it was a mistake").
6. **The bottom sits lower than the firewall's: vertically, and held.** The amount is 0.24 x the half-height at 70 hp,
   down to 0.04 at 160 hp and up. Keys: `cw_exitGap`, `cw_exitHold` 1. Files: `_cowl_gen.js exitAt`, `straight.js`. The
   user: "the bottom part of the cowl sits lower than the bottom part of the firewall"; "hold is better than fade"; "the
   cub is about 10 centimeters".
7. **The bottom rounds into the face (round B), and the top descends a little.** Keel: `keelSweep` .95, `keelShoulder`
   .45, `keelRound` .9. Deck: `deckSweep` .95, `deckShoulder` .6, `deckRound` .7. File: `_cowl_gen.js prepareLid
   half(...)`. The user: "round B better"; "a little taper ... so that you come and kiss better the top of the prop".
8. **The exhaust ramp and a riding chin scoop.** A shallow channel where the drawn exhaust leaves (`cw_exCut` 2,
   `exRampH`, `exCutAz`). The scoop sits a third of its height inside the skin all along (`cw_scoopFollow` 1).
9. **The split line is level, with a fixed width.** Keys: `cw_partLevel` 1 (the method's default) and `cw_partW` in
   metres. The groove was ±`partW` of the section's parameter, which opened to centimetres on a boxy section (the "black
   wedge"). The user: "this line easily gets bent, while in reality it would be cut horizontally ... at a fixed width";
   "make sure that you apply the fix everywhere". On master, saved builds keep their old line (A0's Q1).
10. **Cheeks are OGIVES read off the drawn heads, never a Gaussian "mole".**
    - The heads are found from every drawn vertex through the bare cowl (`clear.js`, all round, exhaust aside), folded to
      one side for two mirrored cheeks.
    - Each cheek is full height only over the front heads, rises long from the firewall, has a short front, and narrows
      as it fades.
    - Its spread and the start of the full part are fitted for the least cheek standing 12 mm over every point, then the
      cowl is rebuilt and probed to 0 mm.
    - Keys: `cw_lobeStream` 1, `lobeNose`, `lobeTail`, `lobeT`, `lobeTSig`, `lobeSig`, `lobeAmp`.
    - Files: `straight.js fitCheeksStream`, `_cowl_gen.js lobeAt`. Commit `601be971`, not on master.
    - The user: "big bulging, sort of the same as you've done with the radial cowl, ogival and where it matters ... we
      mostly get a bump that looks like a mole".
11. **When the block reaches the prop flange and hangs below the shaft (an inverted in-line): a FLAT FACE.**
    - The nose ring takes the block's own outline (`cw_lidRW`, `lidRTop`, `lidRBot`).
    - The edge is short and blunt: `lidLen` ≤ 4.5 cm, `lidShoulder` .5, `lidRound` .92.
    - The prop sits 3 cm ahead of the flange so the face fits in (`cw_noseOff` +0.03).
    - The panel joint sits 6 cm behind the face (`cw_seamPos`), so the side door runs the whole engine.
    - With a shaped ring, the deck, keel and waist lines aim at the ring's real height (`fr` = `faceRise`), or the bottom
      grows a "beard".
    - The user: "you put the prop straight on the engine block ... flatten the face"; "offset slightly the nose cone ...
      so that the cowl can slot in"; "get this vertical part further forward ... a door that opens"; "like a little
      beard. It needs to be ... smooth".
12. **When the block stands above or beside the shaft (a geared V): a TAPERED NOSE, if the bay has room.** The prop keeps
    its station. The block moves aft by the taper's length (`eng_mountGap`, which is flown: CG). The bowl runs that length
    to a spinner in proportion (0.7 x the block's half-width). File: `straight.js rowsFor`.

### Radial engines

13. **A radial's cowl is a round, oversized, straight drum: 0.92 x 1.06 x the engine radius, or the nose's size if that
    is bigger.** The user: "prefer an oversized, straight cap rather than one getting larger at the fore end"; "we could
    also make the nose a little bigger". File: `straight.js` (`RADIAL_R`).
14. **The helmets are read off the DRAWN heads, not the engine table.**
    - The mesh draws `radialRows` 2 unless the preset says otherwise.
    - Places come from clusters, or from the mesh's own layout rule where the clusters merge (a two-row 14).
    - Keys: `lobeN` (places), `lobeAz`, `lobeT`, `lobeT2` (the rear row), `lobeCount` (bare places), and streamlined
      (`lobeStream`).
    - File: `straight.js fitHelmets`.
    - Every radial preset except the R-1830 now says `radialRows: 1` (`_eng_page.js`).
    - The user: "you fail to place them where the cylinder heads are ... You should read the actual engine geometry";
      "they are elongated in the longitudinal direction ... they should stop at the end of the cowl".

### Off the body: nacelles, over the wing

15. **A pod is straight, sized to the drawn engine, with the engine's own section.** A boxer's is wide and low, an
    in-line's tall and boxy, a V's an oval, a radial's round with helmets, a motor's round and tight, a turboprop's round
    with a chin. It is centred on its block: `engBlockY` carries the prop's offset and `cw_faceRise` is 0. The user: "2
    cases; cowl blending with the fuselage ... and the ones not really blending (pylon, wing mounted, etc.)".
16. **No plate sticks out of a pod. A pod that houses its engine ends at the NACELLE'S FIREWALL.** That is the pod's own
    section, 6 mm inside its skin. The face is marked `podSized` (`_cage_cowl.js podPlate`); `_cage_eng.js podOutline`
    computes the outline and `_eng_mesh.js fwPlateAt` draws it as `fwShape`. Commit `29c2df8d`. The user: "a flat plate
    between the cowl and the nacelle, it should not be there, at all"; "cut this plate exactly at the shape of the nacelle
    behind".
17. **Nothing sticks out.** An electric's inverter goes behind the nacelle firewall, and coolant hoses stay inside its
    outline. Commit `0eb7fbda`. The user: "no sticking stuff".

### Everywhere

18. **The exhaust may leave the cowl.** The engine mesh publishes its groups' names (`userData.matNames`), and the probes
    skip `emExhaust` (`clear.js keptVerts`).
19. **New generator rows are ABSENT from saved builds and draw bit-identical** (`_cage_cowl.js ABSENT_AT`). Every row is
    claimed in `_cage_parts.js` (GATE PARTS). The flight core reads only `cw_material`, `cw_wAftTop` and `cw_wAftBot`;
    every other `cw_` row is display. Flown rows are `eng_mountGap`, `engY` and `engBlockZ`/`engBlockY`, plus the
    engine's own resolve (`_eng_gen.js`). Don't move them without A0.
20. **Draw the engine right before you fit a cowl to it.** The inverted four-stroke in-line had its sump, carb and airbox
    ON TOP (`_eng_mesh.js sideInd`; G164's assumption, false for a Gipsy Major). That alone made the Tiger Moth's
    "gum". The user: "There's nothing on top of that engine".

## 2. The workflow as it finally worked

1. **Measure** the build: `straight.js measure`. It gives the face (`CAGE_COWL_NOSE_FACE`), the drawn engine's vertices
   in its unit's frame (spinner and blades aside, and now the exhaust aside), the envelope, the prop's axis and `zFw`.
   Print the front of the drawn engine (within 3/6/10 cm of the flange: top, bottom, half-width) and the face's
   half-sizes. That says at once whether a cowl CAN fit.
2. **Rule:** `node tools/cowl_study/straight.js in.json out.json [--lower=m] [--radialR=k] [--cheeksOnly]`.
   `rowsFor` picks the body or pod mode from the mount, then `finish` runs `fitBends`, `placeScoop`, and
   `fitCheeks`/`fitHelmets`.
3. **Probe:** `clear.js clearance(S, THREE, {all:true})` checks every engine vertex against the cowl skin on the same
   ray. The target is 0 mm. Bin the pokes by azimuth and station to see WHAT pokes. A small script
   (`pokewhere.js`-style) does this, and naming the part via `matNames` settles it.
4. **Quick renders first:** `node tools/quickshot.js <build> <prefix> --views side,q,front [--crop z0,z1,y0,y1]
   [--over '{...}'] [--w px]`. The user's instruction: "use a quick view or quick shot there for the renders". Make
   before/after montages, crop the nose, and show `cowlOn:0` for the engine alone. Send small pictures at every step:
   "keep publishing these little pictures as you do now, and check every change as you do it".
5. **Physics identity:** `bakeJoined`, then `buildGen`, then `genShakedown` (empty mass, Vs, climb) before and after.
   Anything that moves must be named to the user, and to A0 if it's code.
6. **Gates** on the files touched: `node tools/run_gates.js --only=COWL,PARTS,SAVE,STARTER,ENGINE,ENGID,ENGMESH,NACLAG,
   DESIGN,NEWPLANE,CANDIDATES`. Add a fixture to `_eng_mesh_check.js` for any new engine path; the nacelle-firewall
   electric is one. If a full-battery gate fails, run it on the branch base in a `git worktree` before blaming the change.
7. **Commit:** the HANDOVER append keeps the CR count, then a code commit, then `node tools/build.js`, then the "(built)"
   commit. Push the branch and the ready branch.

## 3. Where it struggled, and why

- **The waistline (round 2).** I sized the cowl by fractions of the firewall and missed the user's rule: the aft waist
  on the plane's waistline, the front centred on the prop, shrunk and lifted, bulges last. The cause was fitting
  numbers instead of reading the plane's own lines. The user: "you need to understand really how it works".
- **The thrust line moved** when the cowl's axis moved (`lidRise`, `apOffY`). The engine is placed at
  `face.yc + axisXY + engY`, so the cowl's axis IS the flown thrust line. The fix was the ring-only lift (`faceRing`)
  with `engY` folded in.
- **The Tiger Moth "gum" and the bent split line.** The engine was drawn wrong (rule 20), and the groove was a width in
  the section's parameter (rule 9). The cowl was never the problem. The user: "the real nose cannot fit the engine as
  drawn".
- **The beard.** The shaped ring's depth was measured from the prop axis, but the lines are drawn about the local spine,
  which climbs inside the bowl (rule 11).
- **The radial helmets.** The table's angles weren't what the mesh drew: the M-14P was drawn 5 + 4 at 36°. The R-1830's
  14 heads make one unbroken ring of poke points, so clustering found 3 heads.
- **The DC-3.** `clear.js` measured both nacelles' engines against one cowl copy (a 5 m "poke"). A pod's drum sat 16 cm
  under its engine: the body cowls' `faceRise` override also ran on pods.
- **The mole cheeks.** A Gaussian along the cowl was sized by trial at the worst point. It covers a head, not an engine.
- **The Spitfire, NOT solved.** The nose section is too short in height: the Merlin's banks stand 18 cm over the body's
  top. The generator draws no reduction gear on a V (the prop shaft sits on the crank). The user: "Its nose section is
  much too short in height I think, so no cowl will fit". No cowl rule fixes a wrong nose section or a wrong engine
  drawing.
- **Gates that weren't mine:** ENGCONFIG's 28 Oct pins, TECH (pitch:seaplane), ARCHETYPES (the Chinook-alike card's
  rejected take-off) and ROLLANIM (64.1 B/frame under load). All four were the same on the branch base.
- **Lit renders.** `plane_shot.js` draws from the BUILT `index.html`, so rebuild first or it shows stale code. It is slow:
  use quickshot for every check and lit stills only at the end.

## 4. What a new session must know on minute one

1. **Fit the nose SECTION before the cowl.** Between the windshield and the firewall the fuselage must hold the drawn
   engine. Compare the drawn engine's front reach (top, bottom, half-width from the prop axis) with the firewall face's
   half-sizes about the same axis. If the engine stands out of the body there, no cowl will look right. Fix the body
   rows (the cage's `noseLen`, `noseW`, `roofY`/`keelY`, `waistY`, the section rows) or ask about the engine's height.
   The firewall section's crease study is `tools/cowl_study/crease_study.js`. Sill-creased boxes (`crSill` ≥ 2) need the
   width-at-top/bottom rows `wAftTop`/`wAftBot`, which are flown, so they need A0.
2. **Read the engine as DRAWN.** Use the `cageLayer:eng` mesh: the first unit, without the spinner, blades and exhaust.
   The engine table (`place.ang`, the envelope) is not the drawing. Look at the engine with the cowl off before
   anything else.
3. **The cowl's axis is the thrust line.** Never move `lidRise`, `faceRise` or `apOffY` without folding the difference
   into `engY` or `engBlockY`. Check the physics identity.
4. **The body cowl's order:** aft edge = firewall (sealed), waist = waistline, front centred on the prop and shrunk to
   the engine, bottom lowered and rounded (round B), top descending a little, split line level, bulges LAST and ogival.
5. **0 mm through the skin, measured.** Use `clear.js` all round; the exhaust is the only thing allowed out.
6. **New rows are absent in saved builds.** Saved draws must not move unless the user says so. A0 enforces this on
   master: "Saved draws never move".
7. **Show small quick renders after every change**, side + three-quarter + head-on, before and after.

## 5. Missing tooling

- **The rule is not run at births.** `straight.js` is headless (each `measure` is a scene build, and `finish` rebuilds
  and probes several times). READY 2 ("the one cowl rule") needs it as a page-side pass after the birth's first build,
  writing its rows into the born spec.
- **The face's aperture cutter ignores the cheeks** (`_cowl_gen.js sectF`: "lobes ignored"). A cheek reaching into the
  nose bowl smears a pair of inlets into black arcs. Either stop cheeks at the bowl or teach the cutter about them.
- **No nose-section checker.** A tool should say, before any cowl work, "the drawn engine stands N cm out of the body's
  firewall section here". The Spitfire would have been caught in one line.
- **The engine generator:** no reduction-gear nose or shaft offset on a geared V (the Merlin); the Gipsy's accessory case
  is long (the user is happy with the Tiger as it is).
- **No gate covers `straight.js` / `clear.js`.** A small fixture set should run the rule and require 0 mm: Cub, C172,
  Tiger, Mosquito, DC-3, Carbon Cub SS, a pod of each engine type.
- **Lit renders are slow and use the built file.** A cheaper lit preview would help the visual checks.

---

## 6. Addendum (15 Nov, for A0): extreme, near-spherical head bulges with a face opening (the Carbon Cub CC340)

**Branch note first.** I had already pushed `claude/proper-cowls-2` at `7c420d5d` before A0's message: rounds 10-13 on
master L40c (`58c68134`), as source `60d63b94` plus (built) `7c420d5d`. A0's local job can overwrite it or reuse it. If
reused, it already has these master adaptations:
- the rule writes `cw_podFit` 1 on pods and `cw_partArc` 1 on every cowl;
- master flies `engY`, so the rule keeps it and holds the cowl's axis on the prop with `cw_apOffY = -engY` (drawn only);
- the DC-3 overlay re-made on master: the bake there measures the drawn cowl, so climb 8.183 -> 8.136 m/s and Vs
  30.716 -> 30.718, empty mass identical.

On that branch's gates: JOINPARITY (the Jodel's node mass), ENGINE, PARTS (`canClear`) and CANDIDATES (`pc6_drafting`)
fail identically on master `58c68134` alone. The other ten pass. I will not rebase it again.

### What the CC340 case taught (`601be971`, `reports/evidence/PROPER-COWLS/carbon_cub_ss_cheeks.json`)

- **The numbers, on the Carbon Cub SS's own cowl** (claude/real-figures-3 `builds/candidates/carbon_cub_ss.json`):
  - The heads stood 17.4 cm through the bare cowl, over t 0.32-0.96 of its length, at 10.7 deg off the flank.
  - Cheeks fitted: `lobeN` 2, `lobeAmp` 0.214 m, `lobeSig` 51 deg, full over t 0.58-0.97 (`lobeT` 0.773, `lobeTSig`
    0.192), `lobeNose` 0.995, `lobeTail` 0.04, `lobeStream` 1. Nothing pokes (0 mm).
  - With the rule's own cowl the same heads needed 14 cm at 58 deg. Most of the 21 cm comes from that cowl's own front
    taper (`taperW` .93, `taperH` .77): a nose that narrows forward over a front-heavy engine.
- **Widen the barrel before you bulge it.** A real Carbon Cub cowl is wide at the front: its cheeks ARE the front
  corners. For a near-spherical bulge, first take `taperW`/`taperH` to ≥ 1 (or let the front width follow the drawn
  heads), then fit the cheeks on what still pokes. The cheeks then stay a fairing, not a dome.
- **The ogive's shape rules.** Full height only where the deepest points are (the front heads). The rise from the
  firewall may carry the rear heads on its way up, which avoids the pinch at the firewall. The front ramp is short. The
  spread narrows as it fades (sig x (0.55 + 0.45 w)). Fit the start of the full part AND the spread together, for the
  least cheek over every point plus 12 mm. Fitting at the worst point alone gives the "mole".
- **The displacement is radial from the section's centre** (`_cowl_gen.js surfPoint`: `x += x/L*d`). At 20 cm on a
  boxy flank it tilts the cheek's top and bottom outward, not along the skin's normal. For near-spherical bulges, move
  along `cowlNormalAt` instead, or the dome leans.
- **Mesh density:** the skin gets extra azimuth samples only for `lobeN` ≥ 3 (radial helmets). Two big cheeks at
  51 deg draw as faceted bands in quickshot. Extend the rule to any `lobeAmp` > ~5 cm: three samples across the spread.
- **THE FACE OPENING is the hard part.** The face's aperture cutter does not see the cheeks: `sectF` says "lobes
  ignored". When a cheek reaches into the nose bowl (`lobeNose` near 1), a pair of inlets (`apMode` 2: `pairX`, `pairY`,
  `pairW`, `pairH`) is cut on the un-bulged section and smears into black arcs. Seen on the rule's own CC340 cowl. Two
  ways out:
  1. **Make the cutter lobe-aware:** `sectF` and the rim solver evaluate the section plus `lobeAt`. Then the Carbon
     Cub's real layout follows: one round inlet in the FRONT of each cheek, centred on the cheek's azimuth
     (`pairX`/`pairY` from `lobeAz` at the face). The cooling air enters straight in front of the cylinders, as on the
     real CC340 cowl.
  2. **Or stop the cheek at the bowl** (`lobeNose` ≤ `cowlLen` / `zEnd`) and keep the inlets on the plain bowl. That
     is simpler, but it loses the cheek-front inlets that make it read as a Carbon Cub.
- **Probe to 0 mm, all round, the exhaust aside** (`clear.js`). Then look at the face head-on: on a near-spherical
  cheek, the face's outline must follow the cheek, or the bowl shows a step.
