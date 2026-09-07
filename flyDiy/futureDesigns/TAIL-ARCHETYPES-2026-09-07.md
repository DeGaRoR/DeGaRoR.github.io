# THE TAIL, IN THREE TIERS — archetype, macro, points

Study, 2026-09-07, on the user's ask: *"that's a lot of complexity for ending
up with two archetypes, which is more or less straight or curved... first
archetype, then macro controls to size them, move them, maybe add the dorsal
fin, and then only have to edit it manually point by point, because it's a bit
of a nightmare."* Nothing landed; this is the argument and the open rulings.
The cowl is NOT in scope (the user: keep it in mind, don't look at it) — one
note at the end.

## 1. THE COMPLAINT, COUNTED

The tail's shape is **46 sliders**, and not one of them is a word a builder
uses:

| group | fin | stab |
|---|---|---|
| corners (tip / top-aft / base, 2 axes each) | 6 | 6 |
| rows & points (mid, u, root-fwd, LE root, shoulder, top bulge) | 8 | 8 |
| trailing edge (root / u / mid bulge) | 3 | 3 |
| corner sharpness | 5 | 5 |
| dorsal creases | 2 | — |
| **shape total** | **24** | **22** |

Placement and construction sit on top of that (`stMount`, `stX/Y/Z`, `stCant`,
`finCons`, the cut, the thickness, `tailRimN`). The complaint is exact: the
substrate is a **control cage**, and the panel shows the cage. There is no
level at which the thing is a fin.

Two other things are true and worth saying before the proposal, because they
decide how expensive this is:

- **The cage is not waste.** It is the reason a Cub tail and a 172 tail come
  off one topology, and `FIN_CUB` — a dict of exactly these deltas, solved
  from `_fin_cub_ref.obj` and asserted by GATE FIN — is *already an
  archetype*. The fix is not to delete the cage. It is to stop opening on it.
- **The join measures the DRAWN MESH, not the parameters.** `layerBounds`
  reads `cageLayer:fin` / `cageLayer:stab` for `vHeight`, `stabH`, the apex
  and Sv. So any reparameterisation is invisible to physics as long as the
  mesh is right (SHARED-TREE §4's rule is satisfied by construction here, and
  that is unusual — it is what makes this cheap).

## 2. THE ONE REAL GAP: THE HINGE LINE IS A CONSTANT

`zH1 = -4.153548` and `zH2 = -4.177224` are FICHE CONSTANTS in
`_fin_gen.js`. Nothing in the spec moves them: grep `S.` over that file
yields 30 fields and the hinge is not among them. The consequences:

- **Rudder chord and elevator chord are not controllable.** They change only
  as a side effect of pushing the trailing edge aft (`finTERoot/U/Mid`),
  which also changes the fixed surface's shape. The builder cannot ask for
  "a bigger rudder on the same fin".
- The user's macro list names *"the chord of the control surfaces, the chord
  of the fixed parts"* — those two are **the same number twice**, split at
  the hinge, and today only their sum exists.
- This is physics-bearing (control authority), so it fails RULING 3's own
  test in ROADMAP § THE RULINGS: it is a quantity the builder can see on the
  aeroplane and cannot set.

**AND THE SPEC ALREADY CARRIES THE NUMBER THE CAGE DOES NOT.**
`60_gen_spec.js:1986` declares `elevator: { chord: 0.40 }` and
`rudder: { chord: 0.42 }` (clamped `[0.20, 0.55]` / `[0.20, 0.60]`), and the
solver flies them. Measured by building the fin headless and reading the drawn
hinge against the drawn chord:

```
JODEL fiche (FIN_PARAMS):  root chord 1.781   rudder 0.358  =  20.1 %
CUB reference (FIN_CUB):   root chord 2.177   rudder 0.754  =  34.6 %
                           the spec flies 42 % for both
```

**The drawn rudder is half the flown rudder on the fiche.** One fact, two
parameter homes, no `pair` declaration, no join measurement keeping them one.
So the hinge is not merely a missing control — it is a **live WYSIWYG defect**
(RULING 3: a slider must move a number or be honest set dressing; here a
physics-bearing number moves with no slider at all). See
`CANARD-DELTA-2026-09-07.md` §1.

**So the macro tier is not purely a repackaging.** Eleven of the twelve macro
numbers below are arithmetic over sliders that exist. The hinge is new
geometry, and it is the one most worth building.

## 3. THE PROPOSAL — THREE TIERS

### Tier 1 — ARCHETYPE (a `starter` row, applies once)
A `finArch` row in `_cage_design.js`, `kind: 'starter'`, `group: 'tail'`,
`when: P => +P.finOn`. Its options write a coherent dict of the 24 fin deltas
— i.e. the same shape as `FIN_CUB` — and the stab's 22 through `ST2FIN`.
The "applies once" warn/undo contract and the `once: true` honesty field are
already built and already used by `engPreset`, `seatType`, `section`,
`gearLayout`. Nothing new is invented at this tier.

**RULED (a), the user, 2026-09-07: TWO archetypes, and only two.** *"We need
straight and rounded, and that's about it."* The swept third is dropped — a
rake is what the `finSweep` macro is for, not a separate starting shape.

1. **rounded** — the Cub. `FIN_CUB` verbatim; already checked against a
   reference OBJ, so it costs nothing and cannot drift.
2. **straight** — the 172: tapered, straight LE, corners crisp
   (`finSharp*` up, `finTopY`/`finTE*` bulges at zero). `_cage_stab.js`'s
   own header already says this is where the corner sliders with the bulges
   at zero land, so the shape is known to be reachable. **This one has no
   reference OBJ** — unlike `rounded` it must be solved and then frozen as a
   checked dict, or it will drift. See §7.

The **dorsal is NOT an archetype** — it composes with all three (`finDorsal`
already exists as a discriminator and is already clamped off in rod mode).
It belongs in tier 2. **RULED (c), the user, 2026-09-07: the dorsal is a
macro.**

### Tier 2 — MACRO (twelve numbers, and they are words)

| fin | stab | what it is |
|---|---|---|
| `finHeight` | `stSpan` | the surface's extent off its root |
| `finChord` | `stChord` | fore-aft size, about the hinge |
| `finSweep` | `stSweep` | LE rake — a shear, tip aft with height |
| `finTaper` | `stTaper` | tip chord / root chord |
| `finHinge` | `stHinge` | **NEW** — control-surface chord fraction |
| `finDorsal` | — | promoted from the raw rows |

**RULED (d), the user, 2026-09-07: `finRootFwd` is PROMOTED**, not absorbed —
*"fin root forward also is promoted, I agree. It's important."* It stays its
own macro row (the root's forward station is what sets the dorsal's reach and
the fin's own root length, which `finChord` — anchored on the hinge — does not
express). So thirteen macro numbers, not twelve.

The rest of placement is already macro-shaped and already exists: `stX/stY/stZ`,
`stCant`, `stMount`. Those rows move up a tier as they are.

### Tier 3 — THE POINTS (`level: 'expert'`)
The existing 46 rows, unchanged, behind the **expert-rows switch that already
exists** (`_cage_ui.js` GROUPMETA `level: 'expert'`, `src/viewer/editor.js`
line 613). One flag per group. This is the cheapest part of the whole study.

Plus the user's last ask — *"when we are getting into the advanced edition
then probably we want to have the seams that we edit available"*. The
pre-subdivision outline is `window.CAGE_FIN.cage` (`m0`), and the bench
already draws it (`finWire(m0, 0x7fe0a8)` behind the `cage` checkbox); the
in-game editor has no equivalent. **Draw it when the tail's expert rows are
on.** That is a display of state that already exists — no picking, no gizmo.
Draggable handles are a separate arc (editor.js has raycast-to-part from
G79, but no handle system) and should NOT be bundled: showing the seams is
what answers "which slider is which point", and it answers it this session.

## 4. THE LAYERING DECISION, AND IT IS THE WHOLE DESIGN

Two ways to build tier 2, and they are not close:

**(A) Macro BAKES into the deltas.** Dragging `finHeight` rewrites `finTipY`,
`finAftY`, `finMidY`… Rejected. It is lossy (the row could never read back —
it would need `once: true`, which the DESIGN-TAB audit invented as a
confession, not a design), it DRIFTS on repeated drags, and it silently
clobbers hand-tuned expert work, which is the exact thing tier 3 exists to
protect.

**(B) Macro is a spec-time transform, above the deltas, below the mesh.**
`finSpec(P)` composes:

```
  base   = FIN_ARCH[P.finArch]        // a dict of the same delta fields
  macro  = finMacro(base, P)          // pure arithmetic, same field names
  S      = macro + P.finTipZ …        // the expert deltas, on top
```

**`buildFin2` does not change** — it receives the same 30-field spec it
receives today. The whole macro tier is arithmetic inside one pure function.
That property is worth more than it looks:

- GATE FIN's identity test (`buildFin2(finSpec(FIN_PARAMS))` reproduces
  `_fin_ref.obj` vertex-for-vertex) is **untouched**, and becomes the proof
  that the refactor moved nothing.
- The cut, the thickening, `finToStab`, the deck projection, the join's
  measurement, `AEROSKIN`'s field — all downstream of `buildFin2`, all
  unchanged, all measuring the composed shape for free.
- The risk is confined to one function with no side effects, which is
  testable headless.

Take (B).

**The arithmetic is not a similarity transform**, and that is the trap. The
deltas sit on top of the fiche's absolutes, so a height scale `s` is
`newTipY = (D.yTip - root)·(s-1) + base.tipY·s`, derived per field against
the fiche's own datums (root = `lo.H`, hinge = `zH1` for chord, `yMid`/`yU`
for the rows). Every field needs its datum written down once and checked.

**And the clamps will bite.** `buildFin2` clamps `tipZ` to `[zH1+0.12,
leCz-0.05]`, `taZ`/`baZ` to `[zTE-0.5, zH2-0.03]`, the TE rows to
`zH2-0.05`. A macro slider driven past a clamp moves nothing and says
nothing — **which is G206.3 rebuilt at the tail** ("I can't see a single
thing moving from any slider"). So: **RULING OWED (b)** — a macro row that
is clamped must SAY so, and the ranges must be cut so the honest middle of
each slider is inside the envelope. Measure the envelope before choosing the
ranges; do not guess them.

## 5. ON MERGING WITH THE TAIL CONFIGURATION — NO

The user asked whether to group this with the tail-configuration archetype.
The `empennage` row already exists (`conv` / `t` / `cruci` / `v` / `twin`
blocked) and answers a different question: **where the tailplane sits**. Fin
outline answers **what shape the surface is**. They are orthogonal — a T-tail
can wear a round fin or a straight one — so merging them multiplies 4 seats ×
3 outlines into 12 tiles to express two independent facts.

The project's own test settles it (`_cage_design.js` header): a
**discriminator** decides which parts exist, a **starter** writes a coherent
set of values. `empennage` moves seats and switches the fin off for a V — it
is mostly the first. Outline is purely the second. Different kinds, two rows,
adjacent in the same `tail` group.

One real coupling, handled by machinery that exists: the V-tail writes
`finOn: 0`, so the outline row carries `when: P => +P.finOn` and simply
disappears — as `finDorsal` already does under `boomStyle`.

## 6. THE STAB IS THE SAME CODE OR IT WILL DRIFT

`ST2FIN` maps 23 stab keys onto fin keys precisely so the two cannot
disagree, and `tailRimN` is deliberately ONE row for both surfaces. The macro
transform must be written once and applied through that same mapping, with
only the LABELS differing (span/chord/elevator, not height/chord/rudder). A
second implementation for the stab is how `tailRimN`'s rule gets broken.

## 7. THE PROOF

The refactor is safe exactly when GATE FIN stays green, because the gate
already owns both anchors:

1. `finArch: 'jodel'` + identity macro + zero deltas → `_fin_ref.obj`,
   vertex-for-vertex, in file order. (The existing test, unchanged.)
2. `finArch: 'round'` + identity macro + zero deltas → `_fin_cub_ref.obj`,
   through the same solved values the check already asserts.
3. NEW: every archetype × macro at both range ends × both deck modes builds
   finite, planar, deterministic, with exact quad counts through two
   subdivisions — the health sweep the check already runs, widened.
4. NEW: no macro row is clamped inside its own declared range (ruling b).
5. `_join_check.js` pins the measured tail fields end to end as always; the
   hinge move is a new measured field and needs its pin (SHARED-TREE §4).

## 8. STAGING — three chantiers, in this order
*(The user, 2026-09-07: "the staging is up to you." This is the call.)*

- **T1 (S).** Tier 3 only: `level: 'expert'` on the fin's and stab's shape
  groups, and draw `CAGE_FIN.cage` in the editor when they are on. Nothing
  else moves; the panel gets quiet the same day. No new geometry, no gate at
  risk.
- **T2 (M).** `FIN_ARCH` + the `finArch` starter row + GATE DESIGN's claim,
  with `round` = `FIN_CUB` verbatim. Proof 1 and 2 above.
- **T3 (L).** `finMacro` + the twelve rows, and the hinge as new geometry in
  `_fin_gen.js` (the guard columns, `cutZ`, `finCutMesh` and the crease prep
  all key off `zH1/zH2` — that is the arc's real content, not the sliders).

## 9. RULINGS

- **(a) RULED 2026-09-07 — TWO archetypes: rounded and straight.** No third.
- **(b) OWED.** Clamped macro rows must say so, and the ranges are measured
  before they are chosen — not guessed. (G206.3's lesson, one week old.)
- **(c) RULED 2026-09-07 — the dorsal is a macro**, not an archetype.
- **(d) RULED 2026-09-07 — `finRootFwd` is promoted** to its own macro row.
- **(e) OWED** (raised in `CANARD-DELTA-2026-09-07.md` §0): name the macro
  tier in the WING'S vocabulary — chord, tip chord, taper, sweep, span — so
  the project's two surface models can converge later without a rewrite. The
  wing went through this exact reform at G140 and the tail never did.
  Recommended: yes, and it costs nothing today.

## ERRATA (2026-09-07, the sanity check — `TAIL-CHANTIER-2-2026-09-07.md` §2.5 is the corrected design)

- §4's formula `base = FIN_ARCH[P.finArch]` is WITHDRAWN: that is a live key
  read on every build — a discriminator and a second home. Tier 1 is a
  `starter` that writes the delta keys once; the macro transform composes
  over `fiche ⊕ P.deltas`. No `FIN_ARCH` table at build time.
- §3 Tier 3 "one flag per group": in the GAME expert-ness comes from the
  PART TABLE (`_cage_parts.js` group triple `EXPERT`; `editor.js:760-764`),
  not the layer's group opts — those work on the bench only.
- §3 Tier 3 "the in-game editor has no equivalent" of the cage drawing is
  wrong: `_cage_fin.js:553` draws it in-game behind `#cage` (`body.html:330`,
  the display flyout's 'control cage'). What is missing is only the coupling
  to the expert switch.
- §5 "`when: P => +P.finOn`" on the design row: design rows have NO `when`
  (measured: absent in `_cage_design.js` / `design_flow.js`). The fin column
  drops with the part; the row needs a `DESIGN_PART` entry.
- §3 `FIN_CUB` is 20 keys, not 24: it carries `finDorsal: 0` / `finKeel: 1`
  (must NOT be written by the starter — the dorsal is a macro) and lacks
  `finRootFwd` and the five `finSharp*`.
- §6: every `st*` macro must be added to `ST2FIN`; the stab reads only
  through that map.
- §9 (a) settled: two archetypes.

## 10. THE COWL, NOTED AND NOT TOUCHED

The user: *"keep that in mind for the cowl, but do not look at it right
now."* The same three tiers apply to `_cowl_gen.js` / `_cowl_rows.js`, and
if §4's ruling holds here — the macro tier as a pure spec-time transform
composing archetype + macro + expert deltas, with the generator unchanged —
then it is a PATTERN, not a fin fix, and the cowl inherits it. Do not
generalise it until the fin has flown it once.
