# TAIL CHANTIER 2 — the plan

2026-09-07. The user: *"I think we have enough for specifying our next major
tail chantier... I'd love NOT to have to reopen that chantier again, so let's
be accurate on the physics, and leave no stones unturned."*

This is the plan. It consolidates and SUPERSEDES the three studies of the same
day where they disagree — `TAIL-ARCHETYPES-2026-09-07.md` (the editor),
`CANARD-DELTA-2026-09-07.md` (the configurations, out of scope here),
`TAIL-PHYSICS-AUDIT-2026-09-07.md` (the physics) — each of which carries an
ERRATA pointer back here. Every number below is measured on this tree unless
marked INFERRED. No G number is claimed here: G213 was already taken in the tree by
another session, and the number is taken when a phase lands (SHARED-TREE §3).

---

## 0. WHAT "NEVER REOPEN" MEANS — the acceptance criteria

The chantier is DONE when all of the following hold, each as a gate row, not
a sentence:

1. **The drawn tail is the flown tail.** `tail.Sh`, `tail.Sv`, `hChord`,
   `vChord`, `controls.elevator.chord`, `controls.rudder.chord` are MEASURED
   off the drawn mesh on every build that draws a tail — including a rod
   boom, which today measures nothing (§2.1) — and GATE JOIN pins each one
   drawn → export → resolved → frame, with the drawn-vs-flown AREA row that
   the twin-boom and V-tail paths already have (`_join_check.js:453, 489`).
2. **Every slider the builder sees moves the flown aeroplane or says it is
   set dressing.** No macro row is silently clamped (G206.3's lesson): a
   clamp is an ERRS row.
3. **The tail structure scales with the tail**, in the wing's idiom, is in
   the load test, carries its own load and its own mass, and its incidence is
   read off its own deformed nodes (as the wing's is).
4. **One re-baseline, not two.** The G197 vortex-downwash flip for
   monoplanes (`downwashModel 'vortex'`, still awaiting the user's ruling)
   is taken or refused INSIDE this chantier's consolidation phase, because
   both it and the measured area move every monoplane's static margin, and
   re-anchoring the fleet twice is how a chantier gets reopened.
5. **Old builds load honestly.** A GEN_SPEC_V bump with its migrator, a
   frozen v8 fixture, and certificates that know which physics they were
   measured under.
6. **The rod boom's taxi twist is closed or ruled**, with the ruling written
   in the debt register — not in one HANDOVER paragraph (§5).
7. **GATE ARCHETYPES flies the drawn tail**, or the record states plainly
   that it flies the rule tail and why. Today it flies pre-join (§4.4).

---

## 1. THE FINDINGS, CONSOLIDATED (the four defects + the sweep)

From the audit, unchanged: **D1** the area is never measured; **D2** three
nodes, fixed, 60 % of the stab load and 50–75 % of its skin mass booked to
the fuselage, incidence welded to the body axes, absent from the load test;
**D3** control chords are defaults (0.40 / 0.42) that disagree with the
drawing (measured: rudder 20.1 % on the jodel fiche, 34.6 % on the Cub).

Added today, measured:

**D4 — on a rod boom the tail is not measured at all.** `_cage_join.js:998`:
```js
if (fwOk && zPost != null && typeof M.tailTop === 'number' ...) {
```
and `:805` `zPost = zOf2('tailPost'); // a ROD boom has no tail rings`. The
whole tail block — all eight rows, span included — is skipped. The user's own
ultralight (rod, the GATE TAKEOFF and GATE PILOT fixture) flies a tail the
rule invented from its wing, whatever was drawn. This is SHARED-TREE §4's
"classifier keyed on a coordinate" — the gate must be *the fin/stab layer
exists*, not *the fuselage has a post*.

**Retracted:** the fin-node-station claim made in conversation (that the
dorsal-inflated `vChord` moves the FIN node 0.34 m). On a joined build the
join pins the apex to the drawn top vertex and writes `vSweep = 0`
(`_cage_join.js:1046-1054`), so `vChord` no longer places the node. The
inflated, clamped `vChord` (3.0 m → 1.80, `60_gen_spec.js:3084`) reaches only
the fin strip's `chord`, which the solver does not use for a fin. It remains
a wrong readout and a wrong twin-boom apex (`61_gen_frame.js:1064` uses
`0.30·vChord` there), not a live conventional-tail defect.

**The sweep** (every archetype, headless, `genShakedown` slim; the drawn tail
built from each card's own cage params, the ruled tail from `designBake`):

```
key            | drawnSh ruledSh ratio | drawnSv ruledSv ratio | SM base  SM drawn  dSM
cub            |  2.36    1.87   1.26  |  1.32    0.83   1.59  |  18.2     20.7    +2.5
pietenpol      |  2.36    1.64   1.44  |  1.32    0.66   1.98  |  27.5     31.9    +4.4
tigermoth      |  2.36    2.98   0.79  |  1.32    1.36   0.97  |  20.0     18.3    -1.7
stearman       |  2.36    3.66   0.64  |  1.32    1.65   0.80  |  12.5      9.8    -2.7
pittsAlike     |  2.36    1.80   1.31  |  1.32    0.71   1.86  |  10.4     12.1    +1.7
sesqui         |  2.36    2.50   0.95  |  1.32    1.30   1.02  |  14.4     14.0    -0.4
jodel          |  2.36    1.29   1.83  |  1.32    0.69   1.90  |  12.6     21.3    +8.8
c172           |  2.36    1.69   1.40  |  1.32    0.94   1.41  |  26.9     31.6    +4.6
caravan        |  2.36    2.78   0.85  |  1.32    1.60   0.82  |  43.4     41.9    -1.5
rv             |  2.36    1.31   1.81  |  1.32    0.70   1.88  |  25.3     34.7    +9.4
savannah       |  2.36    1.69   1.40  |  1.32    0.75   1.76  |  15.0     18.9    +3.9
ul1 (rod)      |  2.36    1.73   1.37  |  1.12    0.78   1.43  |  11.0     14.6    +3.6
pusherPod (rod)|  2.36    1.63   1.45  |  1.12    0.72   1.54  |  11.1     16.0    +4.9
motorglider    |  2.36    1.16   2.03  |  1.32    1.14   1.16  |  11.3     20.8    +9.5
radial         |  2.36    1.50   1.58  |  1.32    0.88   1.50  |  13.1     19.4    +6.2
etrainer       |  2.36    1.05   2.25  |  1.32    0.57   2.31  |  10.5     23.1   +12.5
ttail          |  2.36    1.52   1.56  |  1.32    0.89   1.48  |  20.1     26.7    +6.6
vtail*         |  2.31    1.66   1.39  |  1.32    0.92   1.43  |  19.3     23.6    +4.3
mw5 (rod)      |  2.36    1.73   1.37  |  1.12    0.78   1.43  |  13.1     16.9    +3.8
archaeopteryx  |  2.36    1.74   1.36  |  1.12    1.03   1.09  |   9.4     13.0    +3.6
da62           |  2.36    1.85   1.28  |  1.32    1.42   0.93  |  14.1     17.9    +3.8
twinBush       |  2.36    4.06   0.58  |  1.32    2.35   0.56  |  18.4     14.4    -4.0
skymaster      |  2.31    1.52   1.52  |  1.32    0.89   1.48  |  25.1     30.8    +5.7
p38            |  2.31    1.44   1.61  |  1.12    0.87   1.28  |  12.5     18.9    +6.3
beaver         |  2.36    3.71   0.64  |  1.32    1.96   0.67  |  29.7     26.3    -3.4
  * the V-tail bakes conventional in node (G209's own trap); its row is indicative only
```

Three facts fall out of it:

- **The drawn tail is ONE tail.** 2.36 m² of stab and 1.32 m² of fin on all
  25 cards, from a single-seat ultralight to a Beaver-alike, because no
  archetype writes a tail SHAPE key (grep: only `stY/stMount/stCant/stX/stZ/
  finOn`) and `planeScale` is 0.745 on every card. The ruled tail varies
  1.05–4.06 m². **Ratio 0.58–2.25.**
- **Measuring the tail breaks no archetype's stability today.** Static
  margins move −4.0 … +12.5 % MAC; only the Caravan-alike leaves the
  [5, 35] % window and it is outside already (43 %). The blast on the
  ARCHETYPES gate is therefore nil — but see §4.4: that gate flies pre-join
  and would not see the change anyway.
- **With the G197 flip on top** (a few % MAC upward on every monoplane), the
  RV-alike (34.7 %), Pietenpol (31.9 %) and C172 (31.6 %) sit against the
  35 % ceiling. That is the concrete reason acceptance criterion 4 exists.

---

## 2. THE PHYSICS — specified

### 2.1 A1: the area, and where it is measured

**Where.** The LAYERS measure, the join reads. `_cage_fin.js` and
`_cage_stab.js` already hold the exact 2D sheet the surface is (the
subdivided, pre-thickening mesh `s`, published today as `CAGE_FIN.mesh`).
Each layer publishes on its window object:
```
CAGE_FIN.measure  = { area, areaRudder, areaDorsal, areaKeel, span, chordMean,
                      hinge: { frac, zModel }, cut: 0|1|2, FS }
CAGE_STAB.measure = { areaPanel, areaElev, spanPanel, chordMean, chordRoot,
                      rootX (= stX), hinge: {...}, cut, cant, FS }
```
computed as a polygon-area sum (Newell) over the sheet's faces, by material
and by `part`, in model units (× FS²). Pure mesh arithmetic — no THREE, no
DOM — which is what lets §4.4 run it headless.

The join takes them **by identity**: `if (window.CAGE_FIN && CAGE_FIN.measure)`
and the stab likewise. Not `zPost`. The bounding-box path (`tailSurfBounds`)
stays for what it is good at — `hSpan` tip-to-tip, `vX`/`hX` stations,
`stabH`, the apex — and loses the two chord rows.

**What.** Conventions, each a RULING (§6) with a recommendation:

| field | definition | why |
|---|---|---|
| `tail.Sh` | GROSS: `2·areaPanel + 2·stX·chordRoot` | `Vh` is a gross-area coefficient; the wing's `Sw` is gross; the fuselage carries lift across the root |
| `tail.Sv` | fin proper + rudder + keel extension; **dorsal EXCLUDED** | textbook `Sv` excludes the dorsal (it is a high-sideslip, stall-delay device); the dorsal goes to `tail.dorsal.area`, measured, for a future term |
| `tail.hChord`, `vChord` | MEAN chord = area / span | matches the rule's own definition (`60_gen_spec.js:3402, 3404`); the bounding box swallows the dorsal and the elevator notch |
| `tail.hSpan` | tip-to-tip, as today | already measured, already gated |
| `tail.vHeight` | as today (top vertex − tailTop, ÷0.82) | already measured; the lattice's own inverse |
| `controls.rudder.chord` | `areaRudder / (areaRudder + areaFin)` | see 2.2 |
| `controls.elevator.chord` | `areaElev / areaPanel` | see 2.2 |

**Write path.** `M.Sh`, `M.Sv`, `M.hChord`, `M.vChord`, `M.rudderChord`,
`M.elevChord` → `cageJoinSpec` writes them (assignment, as the eight rows
are written today, `:385-394`) → `put` stands down on its own. The rule
(`:3396-3404`) stays as the FALLBACK for a build with no drawn tail — and the
join says so with an ERRS row when a tail layer is on but unmeasurable.

**The clamps must speak.** `hChord ≤ 1.60`, `vChord ≤ 1.80`, `elevator.chord
≤ 0.55`, `rudder.chord ≤ 0.60` (`60_gen_spec.js:2648-2649, 3082, 3084`). A
measured value outside its clamp is an ERRS row naming the clamp, never a
silent cut. The clamps themselves are re-cut to what a drawn tail can be
(the Cub reference reads 34.6 % rudder; a drawn rudder can honestly reach
50 %).

**The rule becomes the SEED.** At birth (`designBake`) and on the
`empennage` starter, the macro tier (2.5) is SOLVED so that the drawn area
equals the `Vh`/`Vv` rule's — once. After that the drawing is the truth.
This closes the loop with no circularity (`once`/`seed` is exactly the
honesty field `_cage_design.js` already has for this), and it is what turns
"one tail on 25 cards" into a tail sized to each card's own wing.

**Delete the stale comment** at `_cage_join.js:996-998` in the same edit.
(It dates from G54.3; G115's "areas resolve FIRST" undid it in silence.)

### 2.2 A2: the control chords

`elevTau = genTauAt(c, 0.40, 0.50)`, `rudTau = genTauAt(c, 0.42, 0.55)` —
thin-airfoil flap effectiveness in the chord FRACTION `c`
(`60_gen_spec.js:2474-2486`, `62_gen_aero.js:884-886`), applied as one alpha
increment to every tail strip (`30_solver.js:631, 647`). The generator's
hinge is a constant-z line, full span (`zH1/zH2`), so **the area ratio IS
the mean chord fraction** for these surfaces; where the TE bulges (the Cub's
D-rudder) it is the area-weighted mean, which is the honest input to a
single-τ model. τ is concave in c — the approximation understates a strongly
tapered rudder by a few percent; that is inside the model's own 0.70 Oswald
guess and is noted, not fixed.

**Uncut surfaces.** `finCut` defaults to 0 (`_cage_fin.js:33`) — the default
fin has NO rudder while the spec flies 0.42. Ruling (§6): the flown aeroplane
requires the cut; the archetype seed sets `finCut 1`; an uncut fin on a build
that flies is an ERRS row and flies the default, said aloud.

**`cageSurfHinge` (G209)** already receives the rudder-only vertex set
(`_cage_join.js:589`, `:1653-1661`) and returns `{ pivot, axis, drive, sgn }`.
The area fraction is one more field on the same measure; the hinge LINE the
editor needs for 2.5 is the same `zModel`. One primitive, two consumers.

### 2.3 A3: the structure, in the wing's idiom

Today (`61_gen_frame.js:1073-1093`): `[HTL, HTR] = NM(t.hX, stabY,
0.5·t.hSpan, 'HT')` — two tip nodes, four `'fus'` members each to the post and
the last ring, no spar between them; `FIN = N(...)`, three members. Strips
`[[H,.50],[TPB,.30],[TPT,.20]]` / `[[H,.25],[TPB,.45],[TPT,.30]]`.

**Stab.** Stations `zs` from the root (`stX`) to the tip, `nH = clamp(round(
semiH / 0.55), 2, 4)` panels — the wing's `panels` rule at the tail's own
pitch (`TAIL_RIB` is 0.26 m, `_cage_fin.js`; two ribs a bay). Two spars,
front at 0.25 c and rear at the HINGE (2.2 gives it): nodes `HF{i}`/`HR{i}`
per station per side. Members: spars, rib, two diagonals per bay (the wing's
"rule 4"), the ROOT pair tied to `TPB`/`TPT` and the last ring's four, and a
**carry-through** `HF0L–HF0R`, `HR0L–HR0R` (today `HTL–HTR` are not
connected). `cover(1.9 · bayArea, [the bay's four])` per bay — skin mass
where the skin is. The TIP nodes keep the tags `HTL`/`HTR` and are created
FIRST: `app.js:968`, `_base_app.js:40`, `_takeoff_check.js:83` and the
tailwheel wires (`:1241`) all key on the first node so tagged.

**Fin.** Stations up the post, `nV = clamp(round(vHeight / 0.55), 2, 3)`,
front/rear spar nodes `VF{i}`/`VR{i}`, the apex keeps the tag `FIN` and is
created first (`refs.fin`). Root pair to `TPT` and the last ring; the keel
extension's row to `TPB`.

**Strips** in the wing's own shape (`62_gen_aero.js:158-172`): per half-bay,
`area = 0.5·(zo − zi)·chordAt(zc)` from the DRAWN planform (the layer
publishes `chordAt` — the sheet's own chord at a station — beside the area),
`w` on the bay's four nodes with the wing's `cf`/`cr` split, `fIn/fOut/rIn/
rOut` so the strip's chord and normal come from the DEFORMED nodes
(`30_solver.js:560-569`), not `xAft/yUp` (`:570-596`). `kind` stays `'stab'`
/ `'fin'` — the alpha law, the elevator/rudder increments and the induction
pairs key on it — but the frame branch reads the nodes when they exist. Post
share of the load goes from 60 % to whatever the root bay's `w` says.

**Member class.** Today the tail's members are `'fus'` under `sec('tail')`,
so `k = MM.k.fus × KS` with `MB` the stab's surface material (457 kN/m on the
fixture vs the boom's 881). A3 gives the tail its own class `'tail'` in
`GEN_MATERIALS.k/c/lin` (tuned as `wing` was, `wingK`-style, against GATE
FLEX's `phys` comparison — which the tail joins). RULING (§6): class or reuse.

**Load test.** `65_gen_loadtest.js:87-101` stations only `WF/WR`. Add
`GEN_LOAD_TAILTAGS = ['HF','HR','VF','VR']` and a tail case: the stab at the
limit down-load (`n = −1.5` at `VD`, the certification case that sizes a
tailplane) and the fin at the rudder-kick side load.

**Substeps.** `genSubsteps` (`62_gen_aero.js:672-688`) takes the stiffest
beam over the lightest node (floor 0.5 kg). Light tail nodes on stiff spars
raise the count; measure it on the stock build before and after and put the
number in the handover.

### 2.4 The aero constants the tail flies on

- **Tail polar** (`genTailPolar`, `62_gen_aero.js:73-81`): `a3d` from
  `hAR = hSpan²/Sh`, `vAR = vHeight²/Sv`. With A1 both are measured and
  consistent — today's "measured span² over ruled area" incoherence ends.
- **Fin end-plate.** `vAR` is the exposed fin's own aspect ratio with no
  end-plate factor (measured: absent). A conventional tail's stab at the fin
  root raises the fin's effective AR by ~1.55 (Raymer); a T-tail more; a V
  none. RULING (§6): add `GEN_RULES.finEndPlate` `{ conv: 1.55, cruci: 1.4,
  t: 1.7, v: 1.0 }` on `vAR`. It moves `cnBeta`/weathervane on every build —
  same re-baseline, no second one.
- **Downwash** (`30_solver.js:631`): monoplanes fly the 0.40 constant;
  G197 measured the stock at 0.318 with the elliptic kernel and left the
  flip to the user. Take or refuse it in phase 5 (criterion 4).
- **Propwash** (`wash: tailWash·R.stabWash` 0.60 / `finWash` 1.00): unchanged
  here. A1 gives the fin a measured height above the thrust line for the
  first time, which is what PROP-EFFECTS §"swirl on the fin" needs — a
  follow-on, recorded in the debt register (§5), not taken.
- **`Vh`/`Vv`** stay in `GEN_RULES` as the seed and the fallback; `hAR
  3.70`/`vAR 1.90` likewise.

### 2.5 The editor — the three tiers, sanity-checked

The design in `TAIL-ARCHETYPES` §3-4, corrected against the code:

**Tier 1 — `finArch`, a `starter`, `once: true`.** Two options, rounded /
straight, each writing the FULL delta set explicitly — 24 fin keys AND the 22
stab keys (`designApply` does not route through `ST2FIN`; the starter names
`st*` itself). `rounded` = `FIN_CUB` **minus `finDorsal`/`finKeel`** (the
dorsal is a macro — ruling (c); `FIN_CUB` carries `finDorsal: 0`) **plus**
`finRootFwd: 0` and the five `finSharp*: 0` it lacks. `straight` = a solved
dict, FROZEN as a checked constant in `_fin_gen.js` beside `FIN_CUB` with its
own GATE FIN row (it has no reference OBJ; unfrozen it drifts — the G19
sailplane lesson). Registration: `DESIGN_PART.finArch = ['tail','fin','stab']`
(`design_flow.js:82-104`); `iconFin(kind)` beside `iconFlap` (~10 lines;
`iconSide` draws a fixed trapezoid). Design rows have **no `when`**
(measured: absent) — the fin column disappears with the part when `finOn`
is 0; on the tail/design columns the row stays. Acceptable, said here.
`GATE DESIGN`: every written key is in `PAGE_BASE` (the layers' defaults are
loaded there — legal), `once` skips fidelity, icon path `d.length > 3`.

**Tier 2 — the macros, inside `finSpec`.** NOT `base = FIN_ARCH[P.finArch]`
(the archetypes doc's §4 formula — withdrawn: that is a live key, a
discriminator, a second home). The composition is
```
S = macro( fiche ⊕ P.deltas , P.macros )
```
— the fiche plus whatever deltas P holds (a starter wrote them, or the
builder did), then the macro transform, arithmetic on the same 30 fields
`buildFin2` reads today. Identity macros ⇒ bit-identical to today ⇒ GATE
FIN's `_fin_ref.obj` / `_fin_cub_ref.obj` identities are the proof. Macro
keys get identity defaults in `FIN_PARAMS` (so `finSpec({})` stays the
identity, `_fin_check.js:767`), and every `st*` macro is added to `ST2FIN`
(`_cage_stab.js:31-46`) — the stab reads ONLY through that map (`:166-168`).
Names in the WING'S vocabulary (ruling (e), the user: "we should use similar
vocabulary for all the control surfaces"):

| fin | stab | transform |
|---|---|---|
| `finHeight` | `stSpan` | scale of every `y − root` about the root line |
| `finChord` | `stChord` | scale of every `z − zH1` about the hinge |
| `finChordTip` | `stChordTip` | the tip station's chord as a fraction of the root's (the wing's `wgChordTip`) |
| `finSweep` | `stSweep` | shear: `z += tan(sweep)·(y − root)` |
| `finHinge` | `stHinge` | **new geometry**: the hinge line's chord fraction; `zH1/zH2` derived from it, `cutZ` and the crease prep follow |
| `finDorsal` | — | promoted (exists) |
| `finRootFwd` | `stRootFwd` | promoted (exists; ruling (d)) |

Thirteen numbers. **Clamps speak**: `buildFin2`'s clamps (`tipZ`, `taZ`,
`baZ`, the TE rows) are reported on the stat line and as an ERRS row on the
panel; ranges are measured against the envelope before they are cut.

**Tier 3 — expert.** In the GAME, expert-ness comes from the PART TABLE, not
the layer's group opts (measured: `editor.js:760-764` reads `g[2] === EXPERT`;
`adopt()` inherits only `when`). So: `_cage_parts.js:582-591, 607-616` — the
fin's and stab's shape groups (`tip`, `top-aft corner`, `base corner`,
`leading edge`, `rows`, `trailing edge`, `corner sharpness`) get the `EXPERT`
triple, precedent `:217 ['creases', [...], EXPERT]`. The layer opts get
`level: 'expert'` too for the bench. **The control cage is already drawn
in-game** (`_cage_fin.js:553`, `body.html:330 #cage`, `'control cage'` in the
display flyout) — T1 couples it to the expert switch for the tail parts, no
new drawing.

---

## 3. THE SEQUENCE

Phases, each a chantier or a half; the battery green at the end of each;
the order is the one that makes the next phase cheaper.

| phase | size | content | proof |
|---|---|---|---|
| **P0 — instruments** | S | the layers publish `measure` (2.1); a headless bench `tools/tail_sweep.js` (the sweep above, kept) that builds every card's drawn tail and reports drawn vs ruled | the sweep reproduces §1's table |
| **P1 — A1 + D4** | M | join reads by identity; `Sh/Sv/hChord/vChord` measured; clamps speak; stale comment gone; rule = fallback with an ERRS row; the seed at birth | GATE JOIN: area rows on the conventional path; `_join_check` synthetic `M` gains the new keys; GATE GEN's `_auto['tail.hSpan']` row reversed for a drawn tail |
| **P2 — T1 + T3** | S | part table EXPERT on the 46 rows; cage coupled to the switch | GATE PARTS; UISMOKE |
| **P3 — T2 + A2 + the hinge** | L | `finArch` starter; the 13 macros; `finHinge` as geometry; measured control chords; end-plate factor; `straight` frozen and gated | GATE FIN identities untouched + a `straight` row; GATE DESIGN; GATE JOIN hinge → `controls.*.chord` → `elevTau`; `test_gen.js:1059-1060` tau anchors re-read |
| **P4 — A3** | L | the tail frame, strips, load test, member class | FLEX (tail joins), LOAD (tail case), STRESS, the substep count in the handover |
| **P5 — consolidation** | M | §4 in full: the vortex flip ruled, one fleet re-baseline, `_energy_base --bless`, GATE GEN anchors re-read, ARCHETYPES re-flown (post-join if §4.4 lands), GEN_SPEC_V 9 + migrator + v8 fixture, certificates versioned, debt register + ROADMAP + the three studies' errata | the whole battery, `--all` |
| **P6 — the boom** | M | §5: the computed compensator, the steering retune, the gate row re-based from "today's number" to a target | TAKEOFF, JOIN's rod rows, the stab-roll row against a target |

P1 before P3 on purpose: the macro tier hands the builder a chord slider and
a height slider, and if the area is not yet wired those move nothing on the
flown aeroplane — the G206.3 complaint again. P4 after P3 because the hinge
places the rear spar. P6 last because it is a different physical thing and
its blocker is an AP retune, not tail geometry; it is IN the chantier because
the taxi twist is the symptom the user feels and the gate row that guards it
freezes today's bad number.

---

## 4. BLAST RADIUS — every reader, every anchor, and what to do with each

### 4.1 Readers of the changed fields (all measured)

| consumer | reads | effect | action |
|---|---|---|---|
| strips `62_gen_aero.js:192, 224-230` | `Sh, Sv, hChord, vChord` | area → q; chord → `Gam`/Cm bookkeeping only for tail strips | none beyond P4's rewrite |
| polars `:821, 829` | `hSpan²/Sh`, `vHeight²/Sv` | `a3d` both surfaces | consistent after P1; end-plate in P3 |
| `elevTau/rudTau` `:884-886` | control chords | pitch/yaw authority | measured in P3 |
| `genPlant/genGains` `:748-797` | strip areas, `HT` arm, `elevTau` | `Mde, Mq` → `pitchP/D`, `wPitch` → `A.slew`, `pitchCmdSlew`, `vsI` | derived — follows; re-read the GEN "fleet band" `test_gen.js:1361-1386` |
| `genTrim` `64_gen_build.js:104-166` | the probe | `stabTrim`, `deAppr`, `apprTrimFail` | derived; ARCHETYPES re-fly |
| shakedown `:394-400, 511-515` | the probe | `staticMargin, npX, dEpsDa, cnBeta` | the sweep says −4 … +12.5 % MAC |
| frame `61_gen_frame.js:1074-1093` | `hSpan, hX, vX, vHeight, vSweep, Sh, Sv` | node places, `cover()` mass and price, paint mass (`:1479`) | P4 rewrites the block |
| plaque/W&B `app.js:3703-3721, balance.js, plaque.js:237` | shakedown | display; `PLAQUE_BOUNDS` SM lo 0.05 | none; bounds stand |
| `tail.lh/lv`, `apprTrimFail`, `landsFlapless` | — | **no reader anywhere** | free |

### 4.2 Gates with anchored numbers (all measured; the action per row)

| gate | anchor | moves? | action |
|---|---|---|---|
| GEN `test_gen.js:133` | SM 5–35 % on the stock | stock draws no cage → rule → no | none |
| GEN `:414` | `_auto['tail.hSpan']` true | no (stock is undrawn) | add the inverse row on a drawn build |
| GEN `:1059-1060` | `elevTau − 0.50 < 1e-12`, `rudTau − 0.55 < 1e-12` | **yes in P3** if the stock chords change | re-anchor from the defaults, which stay 0.40/0.42 for an undrawn tail |
| GEN `:1361-1386` | AP gain fleet band | possibly | re-read |
| ARCHETYPES `_arch_check.js:113-138` | `flyableCircuit`, completion < 420 s | flies PRE-JOIN → **no** | §4.4 |
| BIPLANE `test_biplane.js:302` | `uniformAnchor 0.223 ± 0.03` | **yes in P4** (tail strip positions move) and with the flip | re-anchor once, P5 |
| BIPLANE `:294, 307` | `epsWindow 0.15–0.55`, margin 5–35 % | with the flip | P5 |
| HONEST `test_honest.js:270-271` | writes `tail.vHeight` / `tail.Sv` directly | must stay accepted | keep `Sv` a legal input (it is — assignment) |
| ENERGYBASE `_energy_base.json` | bit-frozen ledger incl. `stock tail [10.691 kg, 449 cr]` | **yes in P4** (cover on new nodes) — and in P1 only if the rule path moves (it does not) | `--bless`, diff in the handover |
| BUILD `test_build.js:531-544` | swept fixture mass within 1.5 % of 501.23 kg | P4 | re-read |
| BUILD `:282` | partial file keeps `elevator.chord 0.42` | P3 semantics | the migrator decides (4.3) |
| JOIN `_join_check.js:69-70, 177, 286` | synthetic `M` and the resolved equalities | P1 | extend: `Sh, Sv, hChord, vChord, rudderChord, elevChord` |
| JOIN `:453, 489-493` | twin-boom `Sv`, V `Svt` | no | the model rows for the conventional path |
| TAKEOFF, PILOT, MOUNT, SITE | the v7 FIXTURES (raw spec, tail rows null, `elevator.chord 0.4` explicit) | node never runs the join → **no** | see 4.4 — the fixture flies the rule tail while the game flies the drawn one |
| `_cage_page5.js:840-846` | the Piper Cub stock's frozen bounding-box `hChord 1.2756 / vChord 1.4608` | P1 semantics | re-measure as mean chords |
| BENCH `_bench_check.js` | fingerprint refs | no | 4.3's version fold adds a row |

### 4.3 Save compatibility and certificates

- `GEN_SPEC_V = 8`; migrators earn an entry when a field changes **units,
  sign or home** (`60_gen_spec.js:1677-1680`). `hChord/vChord` bounding-box →
  mean chord, and `elevator.chord 0.40` default → measured fraction, are
  exactly that on fields saved files DO carry (joined saves carry `hChord`;
  every fixture carries `0.4/0.42` explicitly). **v9 + `GEN_MIGRATORS[8]`**:
  null the join-written `tail.hChord/vChord` so they re-measure; treat a
  stored `0.40/0.42` as "default" → null. Freeze a v8 fixture case in
  `test_build.js:508-522` as every vintage is.
- Cage keys: saves are deviations-only (`cageToSpec`, `_cage_gen.js:6681`);
  13 macro keys with identity defaults read as identity in every old save.
  **No cage migrator.**
- **The join re-runs on load** (`garage.js:859-882` → `BUILD_SYNC`), so every
  old save with a drawn tail changes flight numbers on load after P1. That is
  the honest outcome and the ruling of RULING 4 ("save compatibility is
  forever" means it LOADS, not that it flies the same); it is stated in the
  handover and the migrator's own note.
- **Certificates** (`bench.js:281-298, 385-437`): the fingerprint is FNV over
  the join's export minus paint/finish/meta, with **no physics version**, and
  `BENCH_RESTORE` never compares a stored fp to the live one. After this
  chantier an old certificate loads VALID over a plaque that now disagrees
  with it. RULING (§6): fold `GEN_SPEC_V` and a new `PHYSICS_V` (bumped by
  hand when the solver's answers move — this chantier bumps it) into the
  fingerprint, and have `BENCH_RESTORE` withdraw on mismatch with the
  existing "dirty" language. G208's own note (`HANDOVER.md:33871`) already
  describes the pre-fp case the same way.

### 4.4 GATE ARCHETYPES flies the rule tail — the coverage gap

`_arch_check.js:30-36`: *"THE SPEC FLOWN IS PRE-JOIN, deliberately."* The
join needs the built THREE meshes (`layerBounds`), which node cannot make.
So the fleet gate certifies a tail the player never flies, and after P1 the
gap between the two GROWS (§1's ratios). Two ways to close it, one
recommended:

- **(a) recommended:** with the layers publishing `measure` as pure mesh
  arithmetic (2.1), and the stab already building on a FLAT deck (pure), the
  tail can be built headless by `designBake` itself — `_fin_gen.js`,
  `_cage_stab.js`'s spec composition and `finToStab` need no THREE. The fin's
  deck needs the cage's centreline (`finCentreline(mesh)`) — **VERIFIED
  2026-09-07:** `finCentreline` walks `mesh.F`/`mesh.V` (`_fin_gen.js:852-
  863`), and the mesh the layers receive is `sFix`, the pure `{V, F}` object
  the page hands to `PAGE.post` (`_cage_ui.js:1374`); `_fin_check.js` already
  requires `_cage_gen.js` headless for the subdivision. Every INPUT is pure.
  The one P0 item left is the ENTRY POINT: a `CAGE2`-level function that
  builds `sFix` from `P` outside the page (the UI's build at `_cage_ui.js`
  owns it today). With that, `designBake` grows a `tail` measure and GATE
  ARCHETYPES flies the drawn tail with no browser.
- **(b) fallback:** a headless-Chrome fleet bench (G209's scratchpad
  instrument, kept in `tools/` this time) run as a bench, not a gate — there
  is no Chrome on the device VM, so it is a bench on the user's Windows side.

Whichever lands, the record states which tail ARCHETYPES flies.

### 4.5 Other sessions

Six sessions write this tree. Today alone G207–G213 landed on top of the
morning's read, including G209 which touched `_cage_join.js` (the hinge) and
`30_solver.js` (the V-tail normal). P1's join edits and P3's `cageSurfHinge`
reuse sit on G209's ground: **re-read `_cage_join.js:589-630` and
`:1640-1670` right before editing them**, and the `_cage_join.js`
`ls --time-style=full-iso` check before every edit (SHARED-TREE §1).

---

## 5. THE BOOM — P6, specified

State (measured, `TAIL-PHYSICS-AUDIT` §2): `rodBoomK: 1` (off); the lattice
flies the lofted default section `0.10 × 0.20/0.38` because the honest 113 mm
tube collapses the truss (80° of twist, G199.3); 3.09° stab roll on the taxi
frozen by `_takeoff_check.js:135` as a regression guard; the blocker on
turning the switch is `GATE TAKEOFF`'s 12 m cross-track bound, tuned on the
soft boom; the named fix (a `tube` member class) is in one HANDOVER paragraph
and nowhere else.

**The solver has no rotational DOF** — `k` is an axial spring per member
(`30_solver.js:797`), torsion is emergent from the lattice's geometry. A
`tube` member class with a GJ of its own is therefore not one class but a new
element type. **Not this chantier** — recorded in the debt register (§7) as
the long-term answer.

**What P6 does instead, and it is principled, not a sweep:**

1. **The compensator is COMPUTED, not swept.** The lattice's torsional
   stiffness is analytic for a pin-jointed bay: face shear `n·k·(s/d)²` at
   lever `r`, `K_bay = Σ_faces`, `GJ_eq = K_bay·L` (the audit's recipe, ~10
   kN·m² a bay on the fixture vs the tube's ~29). `rodBoomK :=
   GJ_tube(D, wall, G) / GJ_lattice(bay)` from the rod's own `rodD` and a
   declared wall — a rule with a derivation beside it, applied exactly where
   `bK` is applied today (`61_gen_frame.js:158-165`). The join SAYS the rod
   keeps the default section by rule (an info row), which is G199.3's first
   option made honest.
2. **Trace first on the steering.** "Why does a stiffer boom wander MORE
   through the roll" is unanswered — the gains are hard constants
   (`40_autopilot.js:385-406`, `kP 3.2`, `kD 1.2`, Stanley cross-track at
   `:545-563`), nothing reads boom stiffness or a yaw plant. Measure the
   wander's mechanism at `rodBoomK` 1 / 3 / computed before touching a gain
   (the tailwheel sway feeding the heading error is the first hypothesis;
   G199.5 killed two others the same way).
3. **Retune** the ground-steering constants against the computed boom, or
   derive them from a yaw plant if the measurement says the constants cannot
   be made to hold both booms. The 12 m bound and the stab-roll row are then
   re-based from "today's number" to a TARGET (`< 1.0°`), on the fixture and
   on one more rod build (the guard fires on one fixture, taxi phase only).

---

## 6. RULINGS NEEDED BEFORE P1 STARTS

Carried: **(b)** clamps speak — taken as a design rule, no ruling needed;
**(e)** wing vocabulary — the user agreed ("similar vocabulary for all the
control surfaces"); **(j)** the boom — §5 recommends the computed
compensator now and the tube class deferred to the register; **(k)** the
steering retune is in scope as P6.

New:

- **(l) Area convention:** `Sh` GROSS (panels + carry-through), `Sv` = fin
  proper + rudder + keel, dorsal excluded and measured separately.
  Recommended as written.
- **(m) Uncut fin policy:** the flown aeroplane requires the cut; uncut =
  ERRS + default. Recommended.
- **(n) Fin end-plate factor** `{ conv 1.55, cruci 1.4, t 1.7, v 1.0 }` on
  `vAR`. Recommended — it is the one textbook term the fin is missing, and
  it rides the same re-baseline.
- **(o) The G197 flip** to `downwashModel 'vortex'` for every build, in P5.
  Recommended YES: the number is honest at each aeroplane's own tail
  position; three cards sit near the 35 % ceiling and will need their seed
  tail shrunk, which the seed (2.1) now can.
- **(p) Certificates carry a physics version** and restore withdraws on
  mismatch. Recommended.
- **(q) Tail member class** `'tail'` in `GEN_MATERIALS` vs reusing `'fus'`.
  Recommended: its own class, tuned as the wing's was.
- **(r) Station rule** for A3: `round(semi / 0.55)` clamped 2..4 (stab), 2..3
  (fin). Recommended; the number is the wing's idiom at tail pitch.
- **(s) GATE ARCHETYPES post-join** via the headless tail (4.4 a) — VERIFY at
  P0, then rule.

---

## 7. CONSOLIDATION — the P5 checklist, so nothing is left in a paragraph

- [ ] `DEBT-REGISTER-2026-09-01.md` gains: the `tube` element type (owed
      since G199.3); the AP yaw plant (`genPlant` has none, `Izz` absent);
      propwash swirl on the fin (PROP-EFFECTS, now measurable); the canard's
      three rescue clamps (`CANARD-DELTA` §3) as standing debt; `tail.hTaper`,
      `tail.tip`, `tail.dorsal.*` declared-and-dead fields (delete or read).
- [ ] `ROADMAP.md`: a dated blockquote under Phase 1 — the tail is measured,
      the fleet re-baselined, which archetypes' seed tails moved.
- [ ] The three studies get an ERRATA block pointing here (done today for the
      contradictions already known — §2.5).
- [ ] `HANDOVER.md`: one `## G<n>` per landed phase, the sweep table before
      and after, the substep count, the `--bless` diff, the flip's SM deltas.
- [ ] `_cage_join.js:996-998` stale comment deleted (P1).
- [ ] `tools/tail_sweep.js` kept as a bench with a header.
- [ ] `PHYSICS_V` declared, with the rule for bumping it.

---

## 8. OUT OF SCOPE, SAID

Canards, deltas, elevons (`CANARD-DELTA-2026-09-07.md`); the `tube` element
type; the lifting-line-proper arc (G197's own "remaining deficit"); propwash
swirl on the fin; draggable handles on the seams; the cowl (the user: keep
the three-tier pattern in mind, do not touch it).

---

## IMPLEMENTATION NOTES (2026-09-07/08, the corrected plan is the session's plan file; the phases landed as G214-G219 and P6 as G233; three headings collided in the same hours and the session that landed the join audit renumbered ITS entries to G220-G221 for this arc, saying so in commit 5ec9b6f — its source comments still read G216/G217, which is that session's own note, not this one's)

Verified line by line against the tree before P0 (three read-only sweeps,
~160 claims). Corrections that CHANGE the work, so nobody re-derives them:

- **No drawn-vs-flown AREA row exists on any join path** (§0.1, §4.2 JOIN
  `:453, 489`): the twin-boom and V branches write span/chord only. P1 writes
  the first area rows.
- **The solver reads deformed nodes only for `kind === 'wing'`**
  (`30_solver.js:559`), not "when `fIn/fOut/rIn/rOut` exist" (§2.3). P4
  edits the branch condition as well as the strips.
- **A V-tail's `Sh/Sv` are overwritten by ASSIGNMENT after the rule**
  (`60_gen_spec.js:3455-3461`). The V path takes a measured `Svt` through
  `put`; a join-written `Sh/Sv` does not survive there.
- **`CAGE_FIN.mesh` carries no `part` tags** (set by `finCutMesh`); the
  measure is taken on the cut, UNTHICKENED sheet, which the layers now keep.
  The face tags are `leadingA/leadingB` (dorsal) and `optionalKeelExtension`
  (keel), not `dorsal`/`keel`; the keel tab is filed with the RUDDER by the
  cutter, so it counts in the control area and in Sv (ruling (l)).
- **Mirrored pods fail the same gate as rod booms** (`_cage_gen.js:411`,
  `!MIR && !ROD`) — D4 covers both.
- **`empennage` is not a `once: true` starter** (live `read`, no `seed`); the
  precedents are `section` and `engModel`.
- **G213 (`GEN_SURF_MATERIALS`) already gives the tail its own material row**
  for `cd0`/`k`/`c`/`lin`; ruling (q) is re-asked as "class `'tail'` = the
  surface material's wing row + a `tailK` gain".
- **The migrator of §4.3 contradicts GATE BUILD `:282`** ("a partial file
  keeps the 0.42 it carried"). RULED (user, 2026-09-07): no GEN_SPEC_V bump,
  no value-sniffing migrator; compatibility = the join re-runs on load; a
  frozen v8 fixture WITH a drawn tail gates the load path; `PHYSICS_V` lands
  for the certificates.
- **RULED (user, 2026-09-07): the seed lands WITH the G197 flip in P5** —
  one fleet move; P1 measures only (the sweep: every card stays inside the
  5–35 % window flying today's one drawn tail).
- **`bench.js:429-431` STAMPS the live fingerprint onto an unstamped
  certificate on restore** — ruling (p) deletes the stamp, not only adds the
  version.
- **Horn balance: the pivot is wrong** (user, 2026-09-07). `cageSurfHinge`
  infers the hinge from the surface's forward-most 18 % of vertices; with
  `finCut 2`/`stCut 2` those are the HORN. P1 gives the join the layer's
  DECLARED hinge plane (`measure.hinge`) and keeps the heuristic as the
  fallback for surfaces that declare none.
- **`tail_sweep.js`'s first cut added `stX` (cage units) to metres** and kept
  a bbox chord; §1's table is re-read below with the units right.
- Line anchors: every `60_gen_spec.js` number in this file is 9–10 low
  (G213's +106 lines); `finCut` default is `:32`; the stab shape groups are
  `:608-615`; the stab-roll guard is `< 3.5` at `_takeoff_check.js:135`.

**P0 landed (G214):** `finMeasure` + `ST2FIN` in `_fin_gen.js` (one home);
`CAGE_FIN.measure` / `CAGE_STAB.measure` published by the layers off the cut,
unthickened sheet; `CAGE2.cageSheet` (the page's whole build sequence, the
page calls it); `tools/_tail_headless.js` (the layers' build with no page);
`designFull` beside `designBake`; `tail_sweep.js` on top of them; GATE FIN
§8: the measure's arithmetic, its units, its cuts, and TWO page fixtures
(`tools/fixtures/tail_measure_2026-09-07_{boot,horn}.json`, the page's P
and the layers' measures) reproduced headless to the BIT (worst deviation
0.0) — ruling (s) is licensed: a node gate can fly the drawn tail.

§1's table, re-measured (`stX` in metres, Sv = proper + keel, dorsal out):

```
key            | drawnSh ruledSh ratio | drawnSv ruledSv ratio | elev%  rud%  | SM base SM drawn  dSM
cub            |   2.29   1.87   1.23 |   1.25   0.83   1.51 |   39.3  24.2 |   18.7    21.4    2.6
jodel          |   2.29   1.29   1.78 |   1.25   0.69   1.80 |   39.3  24.2 |   12.9    21.9    9.1
rv             |   2.29   1.31   1.75 |   1.27   0.70   1.80 |   39.3  23.6 |   25.6    35.2    9.6
etrainer       |   2.29   1.05   2.19 |   1.25   0.57   2.19 |   39.3  24.2 |   10.8    24.1   13.3
twinBush       |   2.29   4.06   0.56 |   1.25   2.35   0.53 |   39.3  24.2 |   19.4    14.8   -4.6
  (the full 25-row table: node tools/tail_sweep.js)
```
The drawn elevator is 39.3 % and the drawn rudder 24.2 % of their surfaces
on every card (one tail on 25 cards, D3's "fiche" numbers were the two
reference OBJs); the rod cards carry no keel (25.5 %).

**P1 landed (G215):** the join reads `CAGE_FIN.measure` / `CAGE_STAB.measure`
by identity (rod booms and pods measure), writes `Sh` gross / `Sv`
dorsal-free / `Svt` / `dorsal.area` / mean chords / the control chords (the
cut's area fraction) by assignment; `GEN_DEFAULT.tail` declares the areas;
`GEN_TAIL_ENVELOPE` is the one home of the clamps and the join says when a
drawn value is cut (ERRS); `CAGE_JOIN.notes()` carries measurement limits
(uncut surface, a rod's fin height); the surfaces hinge on the layer's
DECLARED plane (the horn-balance pivot) and the snapshot no longer pitches
the vertices twice (every pivot was β × arm off, the rudder axis leaned 2β).
GATE JOIN +11 rows. The stock's hChord went 1.28 → 0.75 m (mean), Sh 2.29,
Sv 1.25, elevator 39 %, rudder 28 %.

**P2 landed (G216):** the 14 fin/stab shape groups carry `EXPERT`; the
layers' sub-groups `level: 'expert'`; the fin's control cage draws when the
expert switch is on (editor.js `setExpert` rebuilds).

**P3 landed (G217):** `finHeight / finChord / finChordTip / finSweep /
finHinge` (`stSpan / stChord / stChordTip / stSweep / stHinge` through
`ST2FIN`) as transforms of the emitted sheet, bit-exact at identity; the
hinge moves the fiche's column pair; `hingeLine` published, the join maps
the LINE (a swept post rakes); `buildFin2.clamped` → a join NOTE;
`GEN_TAIL_ENVELOPE` controls 0.15–0.65; the `finArch` starter (rounded =
FIN_CUB, straight = the frozen `FIN_STRAIGHT`, 24 + 22 keys, `once`);
`_fin_gen.js` ahead of `_cage_design.js` in the MANIFEST. Not taken from
§2.5: `finDorsal`/`finRootFwd` "promoted" — they already exist as rows and
the starter leaves them to the builder; the V-tail probe is G209's own JOIN
rows. §2.2's note that τ understates a strongly tapered rudder stands.

**P4 landed (G218):** the stab and fin are two-spar PRISM trusses (a third
chord under the stab, a pair either side of the fin — a plane lattice has
no out-of-plane stiffness, the wing's box depth 0.13 of chord), stations at
the wing's pitch on the trapezoid the join measures (`hTaper`/`vTaper` come
alive), the hinge the rear spar, tips first under their tags and WIRE-
braced to the fin post (the Cub's), the carry-through tied; class `'tail'`
= the surface material's wing row at `GEN_RULES.tailSection` 0.35 and
`tailK` 4.0; strips per bay on the deformed spars (`30_solver.js:559` keys
on `fIn`); `GEN_LOAD_SURFACES` (stab inverted at the wing's loading, fin on
its side at half). Not as §2.3 wrote it: the stations rule is `round(semi/
0.55)` clamped 2..4 / 2..3 as ruling (r), but the load test needed a
surface table and a load axis, not a tag list; `GEN_LOAD_TAILTAGS` alone
touches nothing. Substeps 92 → 67 on the stock (the tips carry mass);
the tail ledger 10.7 → 20.6 kg and the fixture re-frozen. Owed to P5: the
tail's own `tailK` against GATE FLEX's beam (the fin reads 47 % of its
height at ultimate on a tube aeroplane).

**P5 landed (G219):** the seed in `designBake` (`designTailSeed`: rule
areas over drawn areas → `finHeight/finChord`, `stSpan/stChord`, the cuts
on); `downwashModel: 'vortex'` on every build; `GEN_RULES.finEndPlate` on
the fin polar; `GEN_RULES.Vh/Vv` 0.370/0.0267 → 0.45/0.033 and
`tailSection` 0.35 → 0.25 (the one fleet re-baseline — four cards were
under 5 %, one is out now and was before); GATE ARCHETYPES flies the
DRAWN tail (`tailApply` off `_tail_headless.js tailRows`); `PHYSICS_V` +
the versioned fingerprint + the restore that withdraws instead of stamping;
the v8 drawn-tail fixture; the registers, ROADMAP and the errata. Against
§0's criterion 4 the fleet moved once; against criterion 5 NO GEN_SPEC_V
bump (ruled). Owed: the `empennage` starter's re-seed on a later pick;
`tailK` against GATE FLEX's beam; P6.

**RULING OWED after P5 (2026-09-08):** the flip's consequence on final —
the stock's flapped approach reads −0.276 rad of elevator under the vortex
kernel (+0.035 under the constant) and the trim solver lands it flapless.
§2.4's "take or refuse it in phase 5" was taken as ruled; its size on a
flapped approach was not foreseen here or in G197. The three answers are in
DEBT-REGISTER §1 and HANDOVER G219; GATE FLAPS holds flaps by fiat for its
servo row meanwhile, GATE GE's window is re-read to 25 % (the tail lifting
in ground effect is the same kernel, and real).

**P6 landed (G233, 2026-09-08) — and the chantier is closed.** The trace §5
asked for found that the wander was never the boom's: GATE TAKEOFF's own
ultralight fixture resolved to `fuse.boom null` (its cage says rod, its spec
never got the row — `GEN_MIGRATORS[7]` carries it now), and the 12 m bound
that blocked G199.5 belonged to a PILOT that flew a crosswind take-off with
its wings level. With into-wind aileron (`43_pilot.js groundSteer`) the roll
holds 2.6 m where it held 18.0, and the compensator can be turned on:
`GEN_RULES.rodBoomK: 'computed'` = GJ_tube / GJ_lattice on the mid-boom bay
(1.56 on the fixture), stab roll 3.82° → 1.84° — half of the 3.09° the user
complained about. §5's second half is also paid: the AP steering did not
need a retune, it needed the other half of crosswind technique. Separately,
`airLateral`'s course trim was gated on there BEING a wind, so in calm air a
propwash-swirl crab could never be trimmed out (the V-tail card sat 17 m off
the centreline and gave up); ungated, it lands clean.

**The acceptance criteria (§0), answered.** 1 the drawn tail is the flown
tail, measured on every build that draws one, rod booms and pods included,
pinned drawn → export → resolved → frame in GATE JOIN. 2 no macro row is
silently clamped: the clamps speak in the join's ERRS and the layer's own
`clamped` list. 3 the tail scales, is in the load test, carries its own load
and mass, and reads its incidence off its own deformed nodes. 4 ONE
re-baseline: the seed, the flip, the end-plate, the volumes and the tail's
section all moved together in P5. 5 old builds load honestly — no version
bump (ruled), the join re-measures on load, and a v8 drawn-tail fixture
gates the path. 6 the boom is closed, not ruled away. 7 GATE ARCHETYPES
flies the drawn tail and says so per card. What is NOT closed and is written
down instead: the flapped approach under the vortex kernel (a ruling, DEBT
§1), the `tube` element type, the AP yaw plant, `tailK` against a beam, the
V-tail truss, and the fin's side-bending model (GATE LOAD reports it).

**The truss's own bill, settled (G235, 2026-09-08).** The chantier's last red
was not in the tail's aerodynamics or its rigging but in what P4's prism did
to the integrator. `genSubsteps` floors a node's dry mass at 0.5 kg — written
in G121 for a node that is mostly fuel, applied to every node — and the fin
apex it now had to size (0.263 kg, on a 0.13 m box chord at 578 kN/m) is the
stiffest beam in the aeroplane. The rule sized the step for a tail twice its
weight, so the material row, which computes omega*dt from the TRUE masses,
read 0.522 on tubeFabric and 0.565 on wood against its 0.50 bound. The floor
now guards only a node carrying fuel, AND the tail's tips and the fin's apex
are billed the tip bow the wing has had since G140 and the tail never had
(0.30 kg/m over an arc 1.15 chords long: 0.278 kg a stab tip, the apex 0.263
-> 0.579). Both together, because the floor alone lands GATE MOUNT's wing
pair and twin on 82 substeps against the 80 its cost row allows. Fleet after:
tubeFabric 71, wood 79, alloy 109, carbon 156, every omega*dt 0.448-0.449;
the stock 462.181 -> 463.069 kg with its CG 8.8 mm aft; `_energy_base` and
`_wing_split` re-blessed (no node changed place — the whole wing-split move
is the rest frame's CG origin, checked node by node).
