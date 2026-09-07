# CANARDS, DELTAS, AND THE SURFACE MODEL WE ALREADY HAVE TWICE

Study, 2026-09-07, on the user's ask: *"I'm thinking of canards and therefore
the ability to have a massive rear wing, and delta wings... tell me what would
be the cost of these new configurations and especially whether we are not
reinventing something."* Nothing landed. Companion to
`TAIL-ARCHETYPES-2026-09-07.md`, written the same day.

## 0. THE ANSWER TO "ARE WE REINVENTING SOMETHING" — YES, AND IT ALREADY HAPPENED

Not in the canard. **In the surface model.** The project has TWO independent
generators for "a flying surface", with nothing shared between them:

| | the WING | the FIN / STAB |
|---|---|---|
| where | `_cage_wing.js` → `63_gen_wing.js` | `_fin_gen.js` → `_cage_fin/_cage_stab` |
| planform | THREE STATIONS: root, crank, tip — each a chord and an x-offset | a 24-POINT CONTROL CAGE from a Blender sketch, Catmull-Clark subdivided |
| numbers | 8 (`wgSpan`, `wgChord`, `wgChordTip`, `wgTipX`, `wgCrankAt/Chord/X`, `wgDihedralOut`) | 46 across the two surfaces |
| vocabulary | span, root chord, tip chord, crank, tip aft | tip corner y, u row, shoulder z, top pair bulge |
| control chord | `controls.aileron.chord`, `.flap.chord` — spec fractions | **none — the hinge is a fiche constant** |

And the wing has ALREADY been through the reform the tail study is proposing:
`_cage_wing.js:64` — *"G140: wgSweep is RETIRED — the planform is three
stations now (root, crank, tip)"*, and `_cage_design.js:60` — *"the planform
TILES retired; the fractions live on in the archetypes' over.cage"*. The wing
went from a shape-word slider to explicit stations plus archetype patches.
**The tail never got that pass.** That is the whole of the reinvention, and it
predates the canard question entirely.

**RULING OWED (e), and it is cheap to take now while the tail work is
unstarted:** do not unify the two generators — that is a large arc with no
player-visible payoff — but **name the tail's macro tier in the wing's
vocabulary**: chord, tip chord, span/height, taper, sweep. Then a later
unification is a rename, not a rewrite. Naming the tail macros `finTipY`-ish
things instead is how the split gets cemented for good.

## 1. A MEASURED DISAGREEMENT, FOUND ON THE WAY

The spec already carries control-surface chords —
`60_gen_spec.js:1986`: `elevator: { chord: 0.40 }`, `rudder: { chord: 0.42 }`,
clamped to `[0.20, 0.55]` / `[0.20, 0.60]`. The CAGE has no hinge parameter at
all (`zH1`/`zH2` are fiche constants; see the tail study §2).

So they disagree. Measured by building the fin headless and reading the drawn
hinge against the drawn chord:

```
JODEL fiche (FIN_PARAMS):  root chord 1.781   rudder 0.358  =  20.1 %
CUB reference (FIN_CUB):   root chord 2.177   rudder 0.754  =  34.6 %
                           the spec flies 42 % for both
```

**The drawn rudder is half the flown rudder on the fiche.** One fact, two
parameter homes, nothing keeping them one — no `pair` declaration in
`_cage_design.js`, no join measurement of the hinge. This is not a canard
problem; it is live today, and it upgrades the tail study's item T3 from "a
nice macro" to **a WYSIWYG defect** (RULING 3: a slider must either move a
number or be honest set dressing — here a number moves with no slider at all).

## 2. CANARD — THE PHYSICS IS ALREADY GENERIC

This is the good news, and it is bigger than expected. **There is no
tail-volume coefficient anywhere in the solver.** Absent tree-wide:
`tailVol`, `neutralPoint`, `cmAlpha`, `Cma`, `aeroCentre`.

- Strip forces are applied **at real node positions** through attach weights
  (`30_solver.js:688`), so the pitching moment is emergent geometry.
- Static margin is **measured**, not derived — `64_gen_build.js:394` is a
  finite difference on a wind-tunnel probe (`npShift = -dM/dL`). A stable
  canard reports a correct positive SM with no code change.
- The vortex kernel is Biot–Savart on actual node coordinates, so a forward
  surface correctly sees **upwash** for free.
- `genTrim` (`64_gen_build.js:157`) is a secant on measured `pitchUp` — it
  converges regardless of sign.
- `genPlant` computes a **signed** arm from the CG (`62_gen_aero.js:750`), so
  it already reports `lh < 0` and `Mde < 0` correctly for a foreplane.

## 3. …AND THEN THREE SILENT FAILURES, WHICH IS THE REAL COST

A canard would not fail loudly. It would fail **plausibly**, in three places
that all rescue a nonsense value instead of raising a row:

1. **The surface is invisible to physics.** `_cage_join.js:696`:
   ```js
   if (v.z <= zAft) fn(v);        // zAft = zCabA - 0.8
   ```
   A surface drawn forward of that plane contributes **zero vertices** to the
   tail measurement. No error, no ERRS row — it simply does not exist to the
   flown aeroplane.

2. **A negative arm becomes a positive one.** `60_gen_spec.js:3311`:
   ```js
   const lh = Math.max(1.0, t.hX - xAC), lv = Math.max(1.0, t.vX - xAC);
   ```
   A foreplane at `hX < xAC` is sized as if it sat 1 m *behind* the wing.
   `tailArm` is itself *defined* as aft (`:3289`,
   `xAC + GEN_RULES.tailArmC * w.chord`, `tailArmC: 2.60`).

3. **The pitch loop becomes positive feedback.** `62_gen_aero.js:773`:
   ```js
   const kp = w * w * I / Math.max(1e-9, C);
   ```
   `genPlant` correctly hands over `Mde < 0`; this clamp throws the sign away,
   the gains explode, get bounded by `r(pitchP, 0.3, 3)`, and the AP flies an
   inverted plant with positive gains. `wPitch` (`62_gen_aero.js:430`)
   collapses to ~0, pinning `A.slew`, `A.pitchCmdSlew` and `A.vsI` to floors.

All three are the failure the project already has a rule against —
SHARED-TREE §4: *"A classifier keyed on a coordinate (`x <= 0.01` for 'the
single wheel') is a bug waiting for a row; key on identity."* `v.z <= zAft` is
that classifier, and the two clamps are its cousins. **Whatever else is
decided, these three should each say something instead of rescuing** — that
is worth doing on its own merits, canard or no canard.

Beyond the silences, the genuine physics work is small and localised:
- `30_solver.js:631` — `(1 - P_.downwash) * al` is applied to every `stab`
  unconditionally (`downwash: 0.40`, `62_gen_aero.js:928`). A foreplane must
  not be downwashed.
- `30_solver.js:631` — `- P_.elevTau * ctl.de` **is the one true sign
  inversion**: `+de = nose up` only holds behind the CG. Everything downstream
  is built on it, including the AP's literal deflections (`40_autopilot.js:429`
  taxi `de = 0.30`, `:905` derotate `0.15`, `:929` shutdown `0.35`) and the
  asymmetric clamp `[-0.30, +0.35]`.
- `30_solver.js:157` — the induction pair list is **one-directional**: wing →
  stab, never stab → wing. For a canard that deletes the defining interference
  term. The kernel is already general; it is one extra loop.
- `genTrim`'s clamp `[-0.25, +0.15]` is asymmetric toward nose-down stab
  incidence. A canard wants positive incidence and would hit the stop.

## 4. DELTA — THE GEOMETRY IS THREE SLIDER RANGES; THE CONTROLS DO NOT EXIST

**The planform is not the problem.** `63_gen_wing.js` takes explicit stations
(`60_gen_spec.js:1765`: `explicit = w.tipX != null || w.crankX != null || …`),
and the SPEC accepts any value — only the cage sliders cap it:

| slider | range today | a 10 m delta wants |
|---|---|---|
| `wgChord` root | 1.15 – 2.10 m | ~5 m |
| `wgChordTip` | 0.55 – 2.10 m | ~0.2 m or a point |
| `wgTipX` tip aft | −1.5 – 2.5 m | ~8 m |

So the delta planform is **a range question, not an architecture question** —
and `xAC` is an area-weighted quarter-chord over the planform strips
(`60_gen_spec.js:3185`), which already handles a low-AR swept planform
correctly. The tip families (`wgTip`) may not have a sensible option for a
cropped delta; that is one row.

**The controls are the problem. Elevons do not exist and cannot be
expressed.** `30_solver.js:621`:
```js
if (st.kind === 'wing') {
  al += P_.ailTau * ctl.da * st.side * st.ail;
  if (FP && st.flap && ctl.flap > 0) { … }
}
```
There is **no `ctl.de` path into a wing strip**, and the strips pushed at
`62_gen_aero.js:161` carry `ail`/`flap` and no elevator fraction. `genPlant`
accumulates `arm`/`ShC`/`ShD` for `stab`/`vtail` only, so a tailless aeroplane
has `Mde = 0` and no pitch authority at all. And `Vh` sizing
(`60_gen_spec.js:3311`) divides into a clamped `lh` with no horizontal tail to
size — silent failure #2 again, from the other direction.

Tree-wide, case-insensitive: `elevon` **0 hits**, `foreplane` **0 hits**,
`tailless` **0 hits**. `canard` — 2 hits, both paint-scheme prose in
`aeroskin.js`. `delta` — all `deltaTime`, plus two prose asides in HANDOVER
about *engine mounting* on delta wings, not aerodynamics. **There is no
backlog entry and no blocked ticket for any of this.**

## 5. COST, HONESTLY

| | size | what it actually is |
|---|---|---|
| **make the three silences speak** | **S** | 3 ERRS rows / an honest reason instead of a rescue clamp. Worth doing alone. |
| **canard** | **M–L** | a `kind: 'canard'` on the strip so `elevTau`'s sign and the downwash exemption key on IDENTITY not position; an arm law that admits a negative; `genGains` handling `Mde < 0`; the reverse induction pair; new frame nodes + a cage layer forward of `zAft`; the AP's literal deflections routed through a sign. |
| **massive rear wing (tandem)** | **M** | mostly the canard's work seen from the other end — it is a canard whose front surface is the small one. Nothing extra in the solver. |
| **delta / elevons** | **L** | all of the above, PLUS a new control path (elevator mixing on wing strips), `genPlant` accumulating pitch authority from wing strips, a `Vh` law that tolerates no horizontal tail, and three widened ranges. |

## 6. RECOMMENDATION

**Do not open this now.** The user's own worry is the right one — *"I keep
extending the functionality and I also need to test that it works well."* The
tail study is a SIMPLIFICATION chantier (46 sliders → 2 archetypes + 12
macros); this is an EXPANSION arc. Running them together means the tail's
reparameterisation gets designed around configurations that do not exist yet,
and neither lands.

The order that costs least:

1. **The tail's three tiers** (T1–T3 in the tail study), with the macro tier
   named in the WING'S vocabulary — ruling (e). This is the hedge that makes
   everything below cheaper, and it costs nothing extra today.
2. **The hinge**, which the tail study already needs for the rudder-chord
   macro, and which §1 above shows is a live WYSIWYG defect. It also puts
   `controls.rudder.chord` and `controls.elevator.chord` under a `pair`
   declaration for the first time.
3. **Make the three silences speak** (§3). Small, independent of everything,
   and it converts "the canard flies wrong" into "the canard says why".
4. **Then** open the canard as its own arc, with a design conversation. It is
   an L, and the audit says the expensive half — moments, NP, static margin,
   trim, the vortex kernel — is already generic and needs nothing. That is a
   much better position to start from than it looked.
5. Delta/elevons after the canard, because it needs everything the canard
   needs plus a control path.

**Where this belongs in the plan:** ROADMAP Phase 2 (THE CATALOGUE, BREADTH)
or Phase 6 (CONFIGURATIONS) — it is the same kind of item as the T-tail and
V-tail archetypes that already live there. Steps 2 and 3 above are Phase 1
friction items and standing debt respectively.

## NOTE (2026-09-07)
Out of scope for `TAIL-CHANTIER-2-2026-09-07.md`; its §7 lists the three
rescue clamps of §3 for the debt register so they are not lost.

## 7. RULINGS OWED

- **(e)** Tail macros named in the wing's vocabulary (chord / tip chord /
  taper / sweep / span), so the two surface models can converge later without
  a rewrite. Recommended: yes, and it is free.
- **(f)** Do the three rescue clamps become ERRS rows now, or with the
  canard? Recommended: now — they are wrong today, not only under a canard.
- **(g)** Is the tandem "massive rear wing" a canard variant (one surface
  model, two size ratios) or its own configuration? Recommended: a variant —
  the solver cannot tell them apart and should not learn to.

## ERRATA (2026-09-08 — `TAIL-CHANTIER-2-2026-09-07.md` IMPLEMENTATION NOTES is the record)

- §0's vocabulary ruling (e) — "similar vocabulary for all the control
  surfaces" — landed at P3 (G217): `finHeight / finChord / finChordTip /
  finSweep / finHinge` and `stSpan / stChord / stChordTip / stSweep /
  stHinge`, the wing's words.
- §1's measured hinge disagreement is PAID at P1 (G215): the control chords
  are the cut's area fraction and the surfaces hinge on the layer's
  DECLARED line (the horn-balance pivot and the double-pitched vertices
  were the two defects underneath).
- §3's three rescue clamps, the unconditional `stab` downwash and the
  one-directional induction pairs are REGISTERED (DEBT-REGISTER §7, TAIL
  CHANTIER 2's leftovers), not taken — as §7's rulings (f)/(g) left them.
  The canard itself stays out of scope, as this study said.
