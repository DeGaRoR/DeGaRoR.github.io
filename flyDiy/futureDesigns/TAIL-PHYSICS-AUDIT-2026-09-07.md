# THE TAIL, AUDITED — how much of the drawn empennage actually flies

Audit, 2026-09-07, on the user's ask: *"I spent a few sessions ensuring the
physical model is properly fitted to the 3D visual model... but we haven't
been through that for the tail. And frankly the tail is pretty bad right now,
because this is one vertex which represents one per stabilizer and one for the
fin. And you've always assured me that it was all right."*

**The reassurance was wrong.** Every claim below is measured, headless, on this
tree. Nothing landed; this is the verdict and the ranked defect list.

## 0. THE VERDICT IN ONE LINE

**The drawn tail's area reaches the flown model nowhere.** `tail.Sh` and
`tail.Sv` — the only two tail numbers the solver integrates — are computed
from the tail-volume rule against the WING and are blind to the empennage the
builder drew. Measured, by resolving the spec at three drawn sizes:

```
                        drawn box          FLOWN Sh        drawn box     FLOWN Sv
default        hSpan 2.704 hChord 0.731  1.976 m2  ->  1.975970 |  0.866  ->  0.866117
drawn 2x       hSpan 4.500 hChord 1.462  6.577 m2  ->  1.975970 |  2.971  ->  0.866117
drawn HALF     hSpan 1.500 hChord 0.400  0.600 m2  ->  1.975970 |  0.257  ->  0.866117

           an 11x range of drawn area  ->  the flown area is BIT-IDENTICAL
```

And it is worse than a missing coupling, because the ASPECT RATIO is measured
while the area is ruled (`62_gen_aero.js:818`, `hAR = hSpan² / Sh`):

```
   default   hAR  3.70    vAR 1.90
   2x        hAR 10.25    vAR 5.59
   half      hAR  1.14    vAR 0.47
```

So drawing a bigger tailplane makes the flown surface **more slender at
exactly the same area** — it raises the lift-curve slope of a surface whose
size never changed. Drawing a smaller one makes it stubbier at the same area.
The drawing moves the wrong number, in a physically incoherent direction.
A coupling that is absent is honest; this one is misleading.

**And the code says it does the right thing.** `_cage_join.js:993`:
> *"Areas follow span × chord — the flown tail volume becomes the BUILT tail's,
> and the shakedown posts the stability that results."*

`M.Sh` and `M.Sv` do not exist anywhere in `_cage_join.js`. The comment
describes the twin-boom and V-tail paths, written the same week, and
generalises them to the conventional tail — which never got the line. That
stale comment is very probably the source of the reassurance.

## 1. THE THREE DEFECTS, RANKED

### D1 — THE AREA IS NEVER MEASURED (severity: highest, cost: low)

`60_gen_spec.js:3311`:
```js
put(t, 'Sh', GEN_RULES.Vh * S.geom.Sw * cBar / lh, 'tail.Sh');
put(t, 'Sv', GEN_RULES.Vv * S.geom.Sw * (S.geom.span || w.span) / lv, 'tail.Sv');
```
`put` only writes when the field is null, so a measured value would stick and
the rule would stand down — which is exactly how `hSpan`, `hChord`, `hX`,
`vHeight`, `vChord`, `vX` and `stabH` already work. **The mechanism is built.
The join simply never writes the two area fields.**

The proof that this is an oversight and not a policy: both special cases
already do it right, and both are gated.
- twin boom, `60_gen_spec.js:3309`: `t.Sv = 2 * t.vHeight * t.vChord`
  (gate `_join_check.js:453`)
- V-tail, `:3356-3367`: `Svt = bVt·cVt`, then `Sh = Svt·cos²Γ`,
  `Sv = Svt·sin²Γ` (gate `_join_check.js:489`)

The conventional tail — the default, the Cub, the aeroplane actually flown —
gets neither.

`Sh`/`Sv` also set the tail's covering MASS (`61_gen_frame.js:1080, 1090`,
`cover(1.9 * t.Sh, …)`), so a drawn-huge tail is also weightless.

**Caveat on the fix: the join measures a BOUNDING BOX, not an area.**
`_cage_join.js:662-712` (`tailSurfBounds`) accumulates min/max only; there is
no polygon area anywhere in `_fin_gen.js`, `_cage_fin.js`, `_cage_stab.js` or
`_cage_join.js`. A rounded Cub fin fills perhaps 0.65-0.75 of its box, so
wiring `Sh = hSpan × hChord` straight through would overstate a round tail by
30-50 %. **The fix is to sum the drawn outline's true area**, exactly as the
wing already does (`60_gen_spec.js:3228-3252` integrates the planform
panel-by-panel and debits the tip bow's quarter-ellipse). Anything less
replaces a blind number with a wrong one.

### D2 — THE STRUCTURE IS THREE NODES, AND IT DOES NOT SCALE (severity: high, cost: medium)

The user's description is literally true. `61_gen_frame.js:1071`:
```js
[HTL, HTR] = NM(t.hX, stabY, 0.5 * t.hSpan, 'HT');
```
Two nodes for the whole stabiliser, **each at the TIP**, not at a panel
centroid. `:1087`, one node for the fin. Measured tallies on the stock build
(55 nodes / 216 beams total):

| | fuselage | wing | **tail** |
|---|---|---|---|
| nodes | 30 | 16 | **3** |
| structural beams | 133 | 68 | **11** |
| spanwise stations per side | 7 rings | 4 | **1** |
| scales with size? | yes (`tailBays` 3-6) | yes (12 → 44) | **NO — fixed** |
| bending DOF | yes | yes | **none** |
| aeroelastic incidence feedback | n/a | **yes** | **none** |
| in the load test | no | yes | **no** |

Measured across the parameter space: span 6.5 m or 18 m, `Sh` 1.98 m² or
20 m² — **the tail is 3 nodes and 13 beams in every case.** The wing goes
12 → 44 over the same sweep.

Four consequences, each measured:

- **`HTL` and `HTR` are not connected.** There is no spar across the
  centreline; the two halves meet only through the fuselage.
- **60.9 % of the stabiliser's aerodynamic load is applied to the FUSELAGE
  tailpost**, not to the stabiliser (`62_gen_aero.js:223`, weights
  `[[H,.50],[TPB,.30],[TPT,.20]]` and `[[H,.25],[TPB,.45],[TPT,.30]]`).
  The fin is 40/60. The weights fake a spanwise load centroid because there
  is no node at one.
- **50 % of the stab's skin mass and 75 % of the fin's** are booked to
  fuselage nodes (`61_gen_frame.js:1080, 1090` — `cover()` splits evenly
  across the listed ids regardless of where the area is). Tail inertia about
  the CG is understated.
- **The tail's incidence is welded to the body axes.** `30_solver.js:570`
  sets the stab's chord and normal from `xAft`/`yUp`, built from fuselage
  reference nodes — while the wing at `:560` builds its own from the
  *deformed* spar positions. The wing has aeroelastic incidence feedback;
  the tail cannot have any, because there is nothing to deform.
- **The tail is absent from the load test.** `65_gen_loadtest.js:88` stations
  only `WF`/`WR`.

Measured stiffness (1000 N point load, fuselage/engine/gear pinned): stab tip
81.2 mm / 12.3 kN/m, fin tip 94.9 mm / 10.5 kN/m, wing tip 31.5 mm /
31.7 kN/m. The tail node is *softer* than a wing tip 3.7× further outboard —
but that softness is a rigid half-panel bobbing on four stretching tubes, and
per the point above it feeds back into nothing.

### D3 — THE CONTROL SURFACES ARE DEFAULTS, AND THEY DISAGREE WITH THE DRAWING (severity: medium, cost: low)

`controls.elevator.chord = 0.40` and `controls.rudder.chord = 0.42`
(`60_gen_spec.js:1986`) are GEN_DEFAULT literals. **The join writes no tail
controls at all** — `_cage_join.js:137-197` is wing-only — even though the
drawn stab and fin carry a real hinge cut (`P.stCut`, `P.finCut`).

Measured by building the fin headless and reading the drawn hinge against the
drawn chord:
```
JODEL fiche:  root chord 1.781   rudder 0.358  =  20.1 %
CUB reference: root chord 2.177  rudder 0.754  =  34.6 %
                              the spec flies 42 % for both
```
The drawn rudder is half the flown rudder on the fiche. See
`TAIL-ARCHETYPES-2026-09-07.md` §2 — this is the same finding from the
editor's side, and the hinge is a fiche constant there (`zH1`/`zH2`), so
there is no slider to disagree with. Also absent: any `tail.incidence`, any
tail airfoil (`genTailPolar` hardcodes `t = 0.09` symmetric), and
`tail.hTaper` / `tail.tip` / `tail.dorsal.*` are declared, clamped, and read
by nothing.

### D4 — ON A ROD BOOM, NOTHING ABOUT THE TAIL IS MEASURED (added 2026-09-07, severity: high, cost: low)

`_cage_join.js:998`: `if (fwOk && zPost != null && ...)` gates the whole
tail block, and `:805` `zPost = zOf2('tailPost'); // a ROD boom has no tail
rings`. On a rod boom — the user's own ultralight, the GATE TAKEOFF and GATE
PILOT fixture — not even the span is measured; all eight rows are the rule.
A coordinate classifier where an identity test (the fin/stab layer exists)
belongs. `TAIL-CHANTIER-2` P1 takes it with A1.

**Retracted (2026-09-07):** a claim made in conversation that the dorsal-
inflated `vChord` (bounding box, clamped to 1.80) moves the FIN node's
station. On a joined build the join pins the apex to the drawn top vertex
and writes `vSweep = 0` (`_cage_join.js:1046-1054`); the inflated chord
reaches only the fin strip's `chord`, unused by the solver for a fin, and
the twin-boom apex (`61_gen_frame.js:1064`). A wrong readout, not a live
conventional-tail defect.

## 2. THE BOOM — RELATED, BUT A SEPARATE DEFECT, AND IT IS NOT FIXED

The user: *"the tailwheel would twist the whole thing and have the stabilizers
touch the ground."* His instinct that it is connected is right about the
mechanism, wrong about the location: **what he is watching is the boom's
torsion, with a rigid stab riding it** — D2 guarantees the stab contributes no
compliance of its own, so all the motion is the boom's.

The state of that, from the record:

- **G199.5 measured it and did not fix it.** The rod boom flies a lattice
  ~12× softer in torsion than the 113 mm tube it draws. The compensator was
  built, swept, and **landed OFF**: `60_gen_spec.js:1432`, `rodBoomK: 1`, an
  identity multiply. The handover's own heading (`:33248`): *"THE ROD-BOOM
  SWITCH LANDED OFF, WITH ITS TRADE WRITTEN NEXT TO IT."*
- **The measured trade is why.** `rodBoomK` 1 → 3.09° stab roll / 11.2 m
  cross-track; 3 → 1.49° / 12.5 m; 8 → the integrator blows up. GATE TAKEOFF
  bounds the wander at 12 m, so stiffening the boom fails the gate — **because
  the autopilot's tailwheel steering was tuned against the soft boom.** That
  is the actual blocker, and it is a retune, not a physics problem.
- **The gate freezes today's number.** `_takeoff_check.js:135` asserts
  `maxStabRoll < 3.5°` against a measured 3.1, and says so at `:81`: *"The
  bound below is a regression guard on today's number, not a target."* It
  fires on ONE fixture, during the TAXI phase only, in 5 of 7 cases.
- **The real fix is named and unrecorded.** `HANDOVER.md:33108`, owed since
  G199.3: *"Either a rod keeps the default section by rule, or the frame grows
  a `tube` member class whose k carries a round tube's torsion — a design
  decision for the user, not a fix."* That sentence exists in HANDOVER and
  **nowhere else**: not in `DEBT-REGISTER-2026-09-01.md` (which predates the
  whole G199 arc), not in ROADMAP, in no gate.
- **Even turned on it is a fudge.** `60_gen_spec.js:1430` says it: at
  `rodBoomK 4` you get 1.29° against the tube's analytic 0.2° — still ~6×
  soft — by scaling a truss's axial springs, not by modelling GJ. There is no
  EA/EI/GJ anywhere in the solver; every `k` is a hand-fitted constant
  (`60_gen_spec.js:107`), and the file is honest that they are the Cub's
  numbers, not the material's.

## 3. WHAT IS ACTUALLY GOOD — so the verdict is not read wider than it is

The core is sound, and it is worth being precise about that:

- **The solver is configuration-agnostic and geometric.** Strip forces apply
  at real node positions; the pitching moment is emergent. There is no
  tail-volume coefficient in the PHYSICS (`tailVol`, `neutralPoint`, `cmAlpha`
  are absent tree-wide). Static margin is a MEASURED finite difference on a
  wind-tunnel probe (`64_gen_build.js:394`). The vortex kernel is Biot-Savart
  on actual coordinates.
- **The wing is properly done, and is the standard the tail should meet:**
  true outline area integrated panel-by-panel with the tip bow debited, strips
  at real spanwise stations with `chordAt(zc)`, nodes scaling 12 → 44, real
  aeroelastic incidence feedback, and it is the one structure the load test
  covers.
- **The join is honest where it measures.** The tail's stations and extents —
  `hSpan`, `hChord`, `hX`, `vHeight`, `vChord`, `vX`, `stabH` — ARE measured
  off the drawn mesh and DO reach the spec, with `_join_check.js:177, 286`
  pinning the round trip. The half that exists works.

**So the answer to "how good is our physics model" is: good where it has been
measured, and the tail is the largest limb that never was.** The wing pass a
few days ago is the template; the tail is the same job, not a harder one.

## 4. WHAT IT WOULD TAKE

| | size | what it is |
|---|---|---|
| **A1 — measure the tail's true outline area** and write `Sh`/`Sv` from it | **S–M** | a polygon-area sum over the drawn fin/stab outline (the primitive does not exist yet — the join has only bounding boxes), two `M.Sh`/`M.Sv` writes, `put` stands down on its own. Plus the gate: `_join_check.js` grows a drawn-vs-flown area row, the way the twin-boom and V paths already have one. **Delete the stale comment at `_cage_join.js:993` in the same edit.** |
| **A2 — measure the drawn hinge** into `controls.elevator.chord` / `rudder.chord`, with a `pair` declaration | **S** | needs the hinge to be a spec field first — which `TAIL-ARCHETYPES` T3 is already building for the macro tier. Do them together. |
| **A3 — discretise the tail** | **M–L** | stations along the stab and up the fin, scaling with span/height as the wing's `panels` does; a real spar between `HTL` and `HTR`; strips at true stations with local chord; the load applied to the surface instead of 60 % to the tailpost; `cover()` billing skin mass where the area is; the tail added to `65_gen_loadtest.js`. This is the one that makes tail flex mean anything. |
| **A4 — the tube member class** | **M** | the named fix for the boom, owed since G199.3. Independent of A1-A3. |
| **A5 — retune the AP's tailwheel steering** off the soft boom | **M** | the actual blocker on `rodBoomK`. Until this is done, stiffening the boom fails GATE TAKEOFF's 12 m bound. |

**Suggested order: A1, then A2 with the hinge, then A4+A5 as one boom
chantier, then A3.** A1 is the biggest fidelity gain per hour in the whole
list and is nearly self-contained. A3 is the largest and should not be opened
until A1 has shown what the areas do to the flown aeroplane — the shakedown
numbers will move, and it is better to see that against a coarse structure
than to change both at once.

## 5. HOW THIS REORDERS THE SLIDER WORK

`TAIL-ARCHETYPES-2026-09-07.md` proposed T1 (expert-flag the 46 rows) → T2
(two archetypes) → T3 (macros + hinge). That order still holds and **nothing
in this audit contradicts it** — but the weighting changes:

- **T1 and T2 are unaffected.** They are pure UI and pure starter values; they
  move no physics and can proceed regardless.
- **T3's hinge is now the highest-value single item across BOTH documents.**
  It is simultaneously the macro tier's rudder-chord control (editor side) and
  A2's measured control chord (physics side). One field, two defects closed.
- **A1 should go BEFORE T3**, because the macro tier will give the builder a
  chord slider and a height slider, and those must move the flown aeroplane
  or they are the G206.3 complaint again — a slider that visibly changes
  nothing. Wiring the area first means the macros land on a tail that
  responds.

Revised order across both studies: **T1 → A1 → T2 → (T3 + A2) → (A4 + A5) →
A3.**

## 6. RULINGS OWED

- **(h)** Area from the drawn OUTLINE (polygon sum) or from the bounding box?
  Recommended: the outline. The box overstates a round tail by 30-50 % and the
  wing already sets the precedent of debiting the tip shape.
- **(i)** Does A3 scale the tail's stations off a `panels`-style spec field
  (the wing's idiom) or off the drawn mesh directly?
- **(j)** The boom: `tube` member class, or "a rod keeps the default section
  by rule and the join says so"? Owed to the user since G199.3, still open.
  Whichever is chosen, it belongs in the debt register — it is currently
  recorded in one HANDOVER paragraph and nowhere else.
- **(k)** Is the AP retune (A5) in scope as part of the boom chantier, or its
  own? It is the thing actually blocking `rodBoomK`.

## ERRATA (2026-09-08 — `TAIL-CHANTIER-2-2026-09-07.md` IMPLEMENTATION NOTES is the record)

- D1 (the area never measured) and D4 (the rod boom measures nothing) are
  PAID at P1 (G215): the join reads the layers' `measure` by identity and
  writes Sh gross / Sv dorsal-free / mean chords / the control chords.
- D2 (three nodes, the tail absent from the load test) is PAID at P4
  (G218): two-spar prism trusses on their own nodes, the tail class, the
  strips on the bays off the deformed spars, the rig loads the stab and
  the fin. The stab is wire-braced to the fin post — the audit's "60 % of
  the load on the post pair" is now the root bay's own share plus the
  wires' — and the stab-tip / fin-tip stiffnesses in §1 are superseded by
  GATE LOAD's numbers (stab 2.8 % of semispan at limit, fin 32 % of its
  height on its side on the tube aeroplane).
- D3 (the control chords are defaults) is PAID at P1: the cut's area
  fraction; the "rudder 20.1 % / 34.6 %" figures were the two reference
  OBJs' — on the archetypes every card drew one tail (rudder 24.2 %,
  elevator 39.3 %) until the macro tier (P3, G217) and the seed (P5).
- §2 THE BOOM: the `tube` class named here is a new ELEMENT TYPE (no
  rotational DOF in the solver) — registered as such in the debt register;
  P6 computes `rodBoomK` from the tube's GJ over the lattice's.
- §4's order (A4+A5 before A3) was not followed: the chantier put the boom
  last (P6) because its blocker is an AP retune, not tail geometry.
- The fin-node-station claim retracted in §1 stands retracted; the
  twin-boom apex reads `0.30·vChord` on the MEAN chord now (P1).
