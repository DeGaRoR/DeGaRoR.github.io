# MORE CONFIGURATIONS — the tube, the delta, the canard, and the glazed band

2026-09-27, from the user's design session: deltas (Dyke JD-2, Verhees), Rutan
layouts and "the very easy back wings", a bare tubular WWI fuselage, and the
Aeroprakt windshield — *"a fuselage which is more or less like a cylinder, but
then you square out the corners, and then you want a SECTION of that becoming
the glazing section. That is not possible today because I have to say it's a
bubble, and then the bubble will be a full bubble."*

Measured on build `a8b34f0df53d` unless marked INFERRED. Nothing landed.
Supersedes `CANARD-DELTA-2026-09-07.md` where they disagree; §7 lists what in
that study is now out of date.

---

## 0. THE PATTERN — almost everything asked for already exists, in the wrong place

This is the finding that organises the whole study. Five of the six asks are
not missing capabilities. They are **existing primitives wired to one caller.**

| the ask | the primitive that already exists | where it is wired today |
|---|---|---|
| a circular tube fuselage | **`rodRing`** — a regular 14-gon, measured **0.2 % out-of-round** (`_cage_gen.js:399`) | the rod BOOM only. The fuselage path is 6.4 % at best |
| holes cut for crew | **`knifeCut`** — any convex outline, anywhere on the shell, watertight, with a reveal (`_knife_gen.js`) | windows only; **it always inserts a pane** |
| a continuous-shell cut-in windshield | **`noseMode: 'aero'`** — *"the full rings continue through the screen zone… the windshield is a MATERIAL ZONE on the upper bands — a transparent region of one continuous surface"* (`_cage_gen.js:611-621`) | shelved as an experiment at G12.2b; **its UI was pulled, the code kept** |
| squared-off corners | a **superellipse** ring generator, twice: `_boom_gen.js:143-153` (*"exponent 2 at square 0, 10 at 1"*), `_cage_cowl.js:523` | the boom and the cowl. Never the fuselage |
| per-station section control | the **`fr*` frame table** — 7 frames × 9 rows, height/width/fore-aft × top/waist/bottom (`_cage_gen.js:6923`, `cageFrameTable:7180`) | already built, T2.1 |
| a tandem second lifting surface | **bidirectional cross-plane induction**, always applied (`30_solver.js:608-616`) | landed; `clampSpec` is the only thing insisting the second plane is a biplane's |
| winglet rudders | **blended winglet geometry** (G468) + a **per-fin strip list** `T.fins` (G268) | the winglet is *"Display only"*; `T.fins` was built for twin booms |

The one genuine exception is the **blended wing-body** (§8). Everything else is
a connection, a clamp, or a flag.

---

## 1. THE TUBE FUSELAGE — `rodRing` is the answer, and it is 18 lines away

### 1.1 Why the current path cannot be circular

`fullRing` (`_cage_gen.js:268`) places six levels by **HEIGHT** — `roofY`,
`ceilY`, `bandY`, `waistY`, `floorY`, `keelY` — then `roundTop` (`:231`) blends
the upper ones onto an elliptical arc. Measured out-of-round on the limit
surface, all creases off, every section set to the same round dims:

```
template arc angles (angCeil 52, angRoof 76)            13.4 %
even angles (45 / 67.5), floorY and bandH on the circle   9.1 %
even angles + topComp 1.0                                 6.4 %   <- best found
```

The angular profile at best case shows exactly where it fails — a flat at the
floor/waist (−26°, r 0.454) against a crown at r 0.517. **The levels are placed
by height, so their angular spacing is uneven; the lower half carries two
levels against the upper half's three; and `band` misses the `comp` inflation
(`:256`, "band: x only").**

### 1.2 The file already contains the right builder

`rodRing`, `_cage_gen.js:395-412`, verbatim:

> *"rod rings are regular 14-gons on the rod circle (6 levels + the two centre
> columns): even spacing = the CC limit is a circle. Control radius compensates
> the n-gon shrink so the DISPLAYED tube hits rod.r: limit radius of a regular
> n-gon under CC = r*(2+cos(2pi/n))/3."*

Measured at G26 (`HANDOVER.md:9174`): diameter 0.1403 against `rodD` 0.14 —
**0.2 % out-of-round.** Same fourteen vertices, placed by angle instead of by
name.

**So a "tube section" is `rodRing` given a length, with the ordinary bay and
material machinery running on it.** Not new geometry — a second ring KIND in
the resolver's table, beside `full` and `nose`.

### 1.3 The slimness limit is a slider, not the generator

**MEASURED: there is no generator clamp on `halfW`.** `grep -n "halfW" … | grep
-iE "max|min|clamp"` returns nothing; `cageSpec:7652` is a bare assignment. The
cage is closed-quad manifold (Euler 2, 164 V / 162 F) all the way down:

```
halfW 0.50 … 0.30 … 0.20 … 0.12 … 0.06 … 0.03    Euler 2 at every step
```

The 0.20 floor is **`_cage_page5.js:191` and `_cage_ui.js:86` — UI range
attributes, nothing more.** (And note the inconsistency to exploit: the FRAME
rows already go to zero — `frCabTopW 0.00 … 1.20`, `_cage_page5.js:231`.)

**The real blocker at tight sections is `bandH`, an ABSOLUTE parameter that does
not scale.** `bandY = waistY + bandH` (`:527`), default 0.0625. At `halfW 0.50`
the waistband is 12.5 % of the half-width; at `halfW 0.06` it is **104 %**, and
`yB = Math.min(Math.max(bY0, yW + eps), d.ceilY - eps)` (`:287`) clamps it while
`band`/`ceil`/`floor` collapse together. `eps` itself is relative to ring height
and is innocent.

**Fix: `bandH` as a fraction of section height (or a second fractional row), and
lower the slider floors.** Neither touches geometry.

### 1.4 `mirror` — the user's read is correct on every mechanism

`mirror` is a **turtledeck** reflection, not a tube mechanism
(`_cage_gen.js:6890`: *"the aft body = the front half [cabin|slope|cowl|nose]
REFLECTED about the cabin-pillar mid-plane"*), and `_cage_design.js:872` labels
it *Body & deck → Cabin / Turtledeck*.

Why it counts as two sections: `cageBodyZones:3258` files the reflected half as
`aftCabin` + `aftDeck`, and its faces carry the FRONT's materials by
construction — including `windshield` on the reflected A-pillar band, which is
exactly why glazing has to be deleted by hand. And `cageSpec:7874-7893` forces,
on `mirror 1`: **`pax.count = 0`, no taper, no rod, no doors, cowl nose only.**
The header says the rest: *"The mirror is INITIAL GEOMETRY only (per-half
controls are a later chantier)"*, and the per-half path re-emits the whole front
block through `buildCage2` a second time.

**So: stop using `mirror` for tubes. It is the wrong tool and it always was.**

### 1.5 "The iron nose experiment" — not found under that name

Searched HANDOVER (61 749 lines), ROADMAP, docs/, futureDesigns/ for `iron
nose`, `tubular`, `simple tube`, `cylinder.*cage`, `bare tube`, `glorified
cylinder` — **absent**. What the user almost certainly remembers is
**G12.2b**, `noseMode: 'aero'` (`HANDOVER.md:5051`):

> *"USER RULING, now implemented: the goal is the BASE geometry — the existing
> cowl/deck/nose-ring assembly must itself go round; the aero-nose
> continuous-rings path stays only as an EXPERIMENT under its slider."*

Its UI was later pulled (`HANDOVER.md:5749`) and the code paths kept
(`_cage_gen.js:614-651`, an early `return` replacing the whole nose block).
**It is the nearest existing thing to both the tube ask AND the Aeroprakt ask,
and it is sitting shelved.** See §3.3.

Related precedents worth knowing: **G26** (pod and rod — the tube that
shipped), **G178/G181** (the aero aft — *"reuse the topology of the back of the
fuselage rather than reinventing"*), **G12.1** (the user's own original *"could
we get a proper canopy by relaxing or deleting some rings?"*, answered with arcs
and no topology change).

---

## 2. TWO COCKPITS — one flag away

### 2.1 What blocks a Tiger Moth today, measured, in three places

1. **The canopy cut keys on one MATERIAL NAME.** `_cage_gen.js:1321`:
   `const cnPilot = CNY && !isPillarMat(mat) && mat.glass === 'pilotWindow';`
   Pax bays carry `glass: 'pasengerWindow'` (`:144`), so **no `canopy` mode can
   ever open a pax bay.** There is exactly one `pilotWindow` region.
2. **The tandem LAYOUT was retired** at G180 — `cageFromSpec:7459`: *"the
   TANDEM layout is retired: every bay seats the cockpit's row now, so a tandem
   IS one abreast with a bay, and `seatLayout 2` reads as 0."*
3. **`mirror` forces `paxCount = 0`**, so the one shape that gives a proud
   cockpit cannot have a bay behind it.

**But the INTERIOR already models a rear station**: `_cage_crew.js:3047` fills
the cockpit's second seat and the bays' occupants, `paxAbreast 1` gives *"a
single seat (tandem passengers behind a side-by-side cockpit)"*, and `:1277`
*"tandem cockpit gets the THROTTLE QUADRANT ALONE, on its own pedestal."* Only
the **shell opening** is missing.

### 2.2 The highest-leverage single change in this document

`knifeCut` (`_knife_gen.js`) already cuts an arbitrary convex outline anywhere
on the shell — *"the taper and the boom included"* — watertight at L2/L3, in
40–130 ms, with a real reveal wall and a bead. Three independent rows, any
station, any height, per-corner radii.

**It always emits a pane** (`_knife_gen.js:667-676`, `paneRep` → `paneId`).
**There is no "hole, no pane" option. Absent.**

> **Add one flag to `knifeCut`: no pane.** Skip the pane emission, keep the
> reveal wall (wound to face out instead of in). That is a small change inside
> one function, and it delivers: WWI crew holes, two tandem cockpits, an open
> hatch, a cargo door aperture, a cooling inlet — all of them, immediately.

The one restriction to respect: **overlapping windows are refused** by design
(`WINDOW-KNIFE-2026-09-11.md:66`, enforced by the separating-axis test at
`cageSpec:7560`). Two tandem holes are fine — they do not overlap. A hole
overlapping a door is not.

**INFERRED, the cheapest Tiger Moth:** two no-pane knife holes on a
`topRound 1` / `botRound 1` shell, with `crestH` + `crestLoops` shaping the
turtledeck between them. **One new capability, no cage rework.**

---

## 3. THE GLAZED BAND — the user's exact ask, and the exact reason it fails

### 3.1 Glazing is quantised to the level lattice

The single decision function, `_cage_gen.js:1303-1311`:

```js
  const bandMat = (mat, hi, lo) =>
      hi === 'roof' ? (lo === 'ceil' ? mat.ceilB : mat.glass)
    : hi === 'ceil' ? mat.glass
    : hi === 'bandG' ? mat.bandG
    : hi === 'band' ? mat.band
    : ...
```

It takes **only the level pair**. There are six fixed levels (+2 subdivision
guards) and no way to add one — the materials pass, the zone marks, the
`aStruct` surface field, the interior pass and the crease families all key on
those six names. **A fraction of a ring cannot be spelled.**

The only continuous mechanism is `cageGlassSill` (`:2754`) — `winSillPilot` /
`winSillPax`, in metres, stepped through whole subdivided rows — and it grows
**DOWNWARD ONLY** from existing glass. There is no upward equivalent.

### 3.2 The canopy has FOUR modes, and bubble is confirmed all-or-nothing

`_cage_gen.js:7634`: `['closed', 'conv', 'open', 'bubble'][Math.round(P.canopy)]`
— note `conv` (the open pilot-bay top with the windshield kept), which the
conversation omitted. And bubble:

> *"In bubble mode wsAft is NOT EMITTED: no pair, no crease, no double points
> on the seam — the cutout rim becomes one continuous, evenly spaced loop for
> the canopy to interpolate."* (`:700-706`)

It substitutes `cageCanopy` (`:8003`), a separate post-subdivision component
whose faces are **one material, all glass** (`:8300`: `m: 'windshield'`).
**The complaint is exactly right, and it is structural.**

### 3.3 The shortcut nobody has taken: `noseMode: 'aero'` already does it

`_cage_gen.js:611-621` — the windshield as a material zone on a continuous
surface, rings running through to a nose cone:

```js
  const wsZone = { roof: TOP.bubble ? 'skyWindows' : 'body',
    ceilB: 'windshield', glass: 'windshield', bandG: 'windshield',
    band: 'waistband', waistG: 'body', door: 'body',
    floorB: 'floorLoop', belly: 'body' };
```

**That IS the Aeroprakt A-22 / C172 / bizjet front.** It is shelved behind an
early `return` (`:647-650`) that bypasses the cowl nose entirely, so it cannot
coexist with a cowl — and its vertical extent is the fixed band triple.

**If the immediate need is Aeroprakt-style front glazing rather than general
partial-ring glazing, generalising `wsZone`'s extent and lifting that early
return is a much smaller change than the primitive in §3.4.** Recommended as
the first move.

### 3.4 The general primitive — and two thirds of it is already built

**The aperture+pane primitive exists TWICE:**
- `cutZone` (`:3017`): *"duplicate the part's vertices (the skin keeps the
  hole), offset along the part's mean outward normal"*, plus G206.2's
  `paneEdge` extrusion (`:3122`).
- `knifeCut`: a true hole, a reveal wall, a recessed `drawnPane`.

**What is missing is only a way to DEFINE the zone as a fraction of a ring.**
And the data for it is already on every vertex — `aStruct = [sL, sC, st, lv]`
(`:167-190`), where `sC` is **metres around the section from the waist rail**
and `lv` a fractional level coordinate.

> A glazed band is literally a box in `(st, lv)` or `(sL, sC)`. Expressed that
> way it is a fraction OR metres, and **it wraps a squared-off corner for free,
> because `sC` follows the ring's own polyline.**

The shape of the work, INFERRED, in the file's own idioms: a new
`cageGlazeZone` beside `cageGlassSill` (`:2754`), post-subdivision, reassigning
material and `win`-marking any face whose field coordinate falls in the zone,
snapped to whole face rows as the sill does. Then everything downstream is
free — `cageGlassSill`'s own comment says so: *"rows of skin faces under the
glass are REASSIGNED to the glass material and win-marked, so zones, seals,
cuts, door ownership and the wood door's glass exclusion all follow
automatically."*

**One ordering trap, flagged:** `cageRefitArc` (`:8579`) must run BEFORE the
zone test, or `sC` is the control-polygon arc rather than the re-measured
smooth-skin arc and a percentage lands in the wrong place around the crown —
the exact error G476 fixed.

### 3.5 Why `knifeCut` alone cannot do the glazed band

Three measured reasons, and they are the reason §3.4 exists:
1. **Convexity is load-bearing** — *"a convex clip is an intersection of
   half-planes, which is what makes the per-face cut exact"*. A band wrapping
   a corner is not convex. (A long low letterbox IS.)
2. **One projection normal per window.** The outline is laid in the tangent
   plane of the single face the ray finds. The file records the failure:
   *"a window that landed on the aft deck's shoulder: 'strange shape there' —
   a side-view outline projected along x smears over a surface that has turned
   towards the roof."*
3. It cuts **both flanks mirrored**, so nothing can cross the centreline — a
   spine-spanning windshield is not one knife window.

---

## 4. CORNER ROUNDING — global today, and the superellipse is already written

`topRound` / `botRound` are **whole-aeroplane scalars** (`:7528`), applied by
`roundTop` from exactly two call sites (`:299`, `:690`), both reading `TOP` from
closure. **There is no per-station roundness**, and the `fr*` table carries
dimensions only — never a shape exponent.

What IS expressible today: `topRound ≈ 0.5`, `botRound ≈ 0.5` with `crSill` and
`crKeel` > 0 — an oval tube with two crisp longitudinal chines. What is not:
four independent corner radii, a superellipse exponent, or per-station
squareness.

**And the superellipse generator exists twice already** — `_boom_gen.js:143`
(*"exponent 2 at square 0 (an ellipse), 10 at 1"*) and `_cage_cowl.js:523`
(`sqExp`, with a bisection inverse). Porting one into `roundTop` as the arc
source, and adding the row to `CAGE_FRAME_KEYS` so it rides per frame like
`topW` does, is the whole change.

**Hard constraint:** GATE CAGEFIT holds the generator bit-identical to the
Blender template at `round 0`. Any new path must be inert at its defaults,
exactly as `topRound` is.

---

## 5. DELTA — four numbers, plus a control system that does not exist

### 5.1 The planform is four clamps

`clampWing`, `60_gen_spec.js:3696-3735`, against a 10 m delta (Dyke ≈ AR 2.6):

| wanted | clamp | factor |
|---|---|---|
| root chord 4–5 m | `w.chord = genClamp(w.chord, 0.80, 2.10)` | 2.0–2.4× |
| tip offset ~8 m | `reach = tan30° × (semi − 0.3)` = 2.714 m; slider 2.5 | ~3× |
| tip chord ~0.2 m | `w.taper = genClamp(w.taper, 0.45, 1.0)` | ~4× |
| AR ≈ 2.6 | `w.span ≥ 4.0 * w.chord` — **an AR floor written as a span floor** | ~2× |

**The three-station planform law needs NOTHING.** It composes arbitrary
trapezoid chains and computes area-weighted MAC, `xAC` and per-panel LE sweep
(`:4552-4569`). A delta is a highly tapered, highly swept single panel.
**Range limits, not architecture.**

Two caveats: the span floor is an aspect-ratio rule in disguise, and relaxing
it puts a 4 m chord through a mass model that bills a rib every 0.4 m and a
two-spar box at 0.15/0.65 c — which has never seen one. And `GEN_TIPS` has no
cropped-delta option (`:2180`: square / clipped / rounded / elliptic / hoerner
/ winglet).

### 5.2 The control system is the real blocker, and it is worse than the earlier study said

- **No `ctl.de` into a wing strip** (`30_solver.js:1163-1169`) — wing strips
  take `ail` and `flap` only, and carry no elevator fraction.
- **`genPlant` accumulates pitch authority from `stab`/`vtail` only**
  (`62_gen_aero.js:1126-1137`) — a wing strip contributes `Lp` and `Lda` and
  nothing to `arm`/`ShC`/`ShD`, so **`Mde` and `Mq` are 0 for a tailless
  build**.
- **NEW FINDING, and it is the sharp one: a tailplane is UNCONDITIONAL.**
  `62_gen_aero.js:298-303` always pushes two `stab` strips a side plus a `fin`,
  and the drawn tail has a floor — `GEN_TAIL_ENVELOPE.hSpan [1.50, 4.50]`,
  `hChord [0.40, 1.60]` (`:3779`), i.e. **a minimum 0.60 m² tailplane**.
  **So a delta cannot even be flown tail-off as a first step — it would fly
  with a synthesised tailplane it does not have.**

---

## 6. CANARD AND TANDEM — two clamps and one hardwired zero

**Max two wings**, hard-capped (`60_gen_spec.js:4134`: *"G185: at most TWO
planes (a triplane is a follow-on)"*). And the second is a **biplane's plane
specifically**, by four mechanisms:

1. `genPlanePair` (`:3670`) forces the two into **different vertical bands** —
   *"a biplane's two planes stand in DIFFERENT BANDS of the fuselage"*. Two
   surfaces at the same height, fore and aft, cannot be spelled.
2. Fore/aft travel is `stagger`, clamped **±1.0 m** (`:3687`). A VariEze wants
   ~2.5–3 m; a Quickie ~3 m.
3. A sesquiplane floor couples their spans (`:4155`).
4. **The cage hardwires the second plane's `place.dx` to 0** —
   `_cage_join.js:169`, and `_cage_wing.js:219` drops `wgDx` from the second
   plane's rows entirely.

**But `planes` / `st.plane` are fully general and count-agnostic**
(`:3583`, `61_gen_frame.js:1166`: a loop over `k` with no 2-plane assumption).
The cap and the coercion are in `clampSpec` ALONE.

> **The user's "Rutan seems to use the wings interchangeably" is, in this
> codebase's terms, exactly right and exactly the blocker:** the solver already
> treats a second plane as a general lifting surface with real mutual
> interference. `genPlanePair`, `stagger`'s ±1.0, and one hardwired zero are
> what stand between a biplane and a tandem.

**A canard's MAIN wing aft is already reachable** — `xLE` 3.00 + `dx` 1.8 ≈
4.8 m. The static margin comes out negative and the plaque says so; nothing
breaks. It is the FOREPLANE that cannot be placed.

---

## 7. WHAT IN `CANARD-DELTA-2026-09-07.md` IS NOW OUT OF DATE

**Six of its seven core claims stand verbatim** (line numbers moved; code did
not): no tail-volume coefficient; SM by finite difference; `lh = Math.max(1.0,
t.hX - xAC)` (now `:4655`); `Math.max(1e-9, C)` in `genGains` (now
`62_gen_aero.js:1157`); `tailSurfBounds`' `v.z <= zAft` (now
`_cage_join.js:959`); no elevon path; `elevTau` assuming aft.

Two secondary claims have moved, and **one is very good news:**

- **Cross-plane induction is now BIDIRECTIONAL and always applied.**
  `30_solver.js:608-616` — a wing strip takes sources from the wing strips of
  every OTHER plane, gated on nothing (`1`, not `DWM === 'vortex'`). **That is
  the interference term a canard or tandem wing is defined by, and the study
  counted it as missing.** Still absent: `stab → wing`, and fin sidewash.
- The blanket `(1 - downwash)` on every `stab` is now conditional on the def's
  `downwashModel` — but it defaults to `'const'`, so the defect survives in
  substance. The fix shape changed, not the fix.

And **winglets landed at G468** — a real blended winglet, lofted, lit,
selectable (`60_gen_spec.js:2185`). But *"Display only: the planform (chordAt)
ends at the tip, so no strip lifts and no rib weighs where the winglet
stands"* (`63_gen_wing.js:945`). Its only aerodynamic effect is Oswald `e 1.07`.

**For winglet rudders the cheapest honest route is `kind: 'fin'`, not
`vtail`.** `vtail` is a ruddervator — it mixes `de` and `dr` on one panel and
projects through `cosV` twice. But `fin` strips take their own polar and their
own rudder sign, **and are already pushed from a LIST** —
`62_gen_aero.js:285`: `for (const fn of (T.fins || [T])) {`, added at G268 for
the twin boom. **A pair of winglet rudders is structurally the twin-boom fin
case with the fins at the wing tips.** The earlier study could not say this;
`T.fins` post-dates it.

---

## 8. THE BLENDED WING-BODY — the one real architecture limit

A Dyke JD-2 or a Verhees Delta has the fuselage **inside** the wing: the root
chord runs most of the body length and the two are one shape.

**MEASURED: wing and fuselage are strictly separate lofts joined at a root rib.
There is no fairing, no fillet and no boolean anywhere in the airframe code.**
`grep -n "wing" src/core/60b_gen_loft.js` returns **nothing** — the fuselage
loft does not know the wing exists. A tree-wide search for
`wingFillet|rootFairing|fillet` finds only taxiway fillets and the tail-boom
cone. **The two skins simply interpenetrate at the root.**

The nearest hook is `wings[].centre` — `63_gen_wing.js:1092`: *"'topFuselage'
lofts the lower alone (the upper is the fuselage's own — a wing through the
belly or the cabin)"* — but that is a skin-**authorship** switch over the cabin
half-width, not a fairing, and it produces no new geometry.

Three things would have to be **built**, not widened:
1. A root chord that runs the body length (against a 2.10 m clamp and a body
   several metres long — the shapes cannot be made coincident).
2. A **fairing/blend generator**, for the mesh AND the structure (six beams
   from a root rib to fuselage rings today).
3. **Body lift.** `Sw` comes from the planform law alone (`:4586`) and
   `genFusCdA` treats the body as pure wetted drag.

**Everything else in this study is sliders and flags. This is the new arc.**
And it should be judged on its own: it buys two aeroplanes.

---

## 9. LIVE DEFECTS FOUND ON THE WAY — true today, independent of any of this

Three sliders that do not reach what they say. All the same class as TAIL
CHANTIER 2's hinge finding, and all violations of RULING 3.

1. **`wgChordTip` is silently overridden.** `_cage_join.js:158` writes
   `taper: Math.max(0.2, ...)`, but `clampWing` floors `taper` at **0.45**, and
   tip chord is DERIVED from taper (`tipC = w.chord * w.taper`). So
   `wgChordTip 0.55` against `wgChord 2.10` (taper 0.262) is raised to 0.45 —
   **an effective tip chord of 0.945 m, not 0.55.**
2. **`wgDx`** row reaches −1.5 m; `place.dx` clamps at −1.2.
3. **`wgSpan`** row stops at 14 m; `clampWing` allows 18 and
   `_cage_design.js:625` seeds a sail archetype at 15.0.

---

## 10. SEQUENCING — cheapest first, and the order is not the order asked

| | size | what | unlocks |
|---|---|---|---|
| **C0 — the three slider defects (§9)** | **S** | honest ranges, or ERRS rows | nothing; they are wrong today |
| **C1 — the no-pane knife flag (§2.2)** | **S** | one boolean in `knifeCut` | WWI crew holes, **two tandem cockpits**, hatches, cargo apertures, inlets |
| **C2 — `bandH` fractional + lower the slider floors (§1.3)** | **S** | tight sections | slim tubes, booms, small aeroplanes |
| **C3 — a `tube` ring kind from `rodRing` (§1.2)** | **M** | a second ring KIND in the resolver | **the WWI fuselage, properly** — and it retires the `mirror` hack |
| **C4 — generalise `noseMode: 'aero'` (§3.3)** | **M** | lift the early return, parameterise `wsZone`'s extent | **the Aeroprakt windshield** |
| **C5 — the delta's four clamps (§5.1)** | **S** | numbers, plus one tip family | the delta PLANFORM (not yet flyable) |
| **C6 — elevons + an optional tail (§5.2)** | **L** | `de` into wing strips, `genPlant` reading them, a tail that can be absent | **a delta that flies** |
| **C7 — tandem: `genPlanePair`, `stagger`, the join's zero (§6)** | **M** | two clamps and one hardwired value | **canard and tandem POSITION** — the physics is already there |
| **C8 — superellipse, per-frame (§4)** | **M** | port `_boom_gen.js`'s ring into `roundTop`, add the frame row | squared-off corners, per station |
| **C9 — the glazed-zone primitive (§3.4)** | **M–L** | `cageGlazeZone` on the surface field | **glazing as a fraction of a ring, wrapping corners** |
| **C10 — winglet rudders via `T.fins` (§7)** | **M** | tip fins as `kind: 'fin'` strips | Long-EZ |
| **C11 — the blended wing-body (§8)** | **L, its own arc** | a fairing generator + body lift | Dyke, Verhees |

**C1 is the single best hour in this document.** C0–C3 together are a weekend
and deliver the tubular fuselage and the Tiger Moth. C6 is the gate on every
delta. C11 should be decided on its own merits, later.

---

## 11. RULINGS

- **(bi) `mirror` is not the tube mechanism; a `tube` ring kind from `rodRing`
  is (§1).** Recommended.
- **(bj) Add a no-pane flag to `knifeCut` (§2.2).** Recommended — highest
  leverage in the study.
- **(bk) `bandH` becomes fractional; the `halfW` slider floor drops (§1.3).**
  Recommended; there is no generator clamp to fight.
- **(bl) Generalise `noseMode: 'aero'` before building the glazed-zone
  primitive (§3.3).** Recommended — it is most of the Aeroprakt ask for a
  fraction of the cost.
- **(bm) The glazed zone is defined in the SURFACE FIELD, not the level
  lattice (§3.4)** — and `cageRefitArc` runs first. Recommended.
- **(bn) A delta needs the tail to be OPTIONAL, not merely small (§5.2).**
  Recommended — this is the real gate, not the planform.
- **(bo) Winglet rudders are `kind: 'fin'` via `T.fins`, never `vtail` (§7).**
  Recommended.
- **(bp) The blended wing-body is its own arc and is not bundled with the delta
  planform (§8).** Recommended.
- **(bq)** Does the second plane become a general lifting surface (tandem,
  canard) or stay a biplane's? The physics is already general; only `clampSpec`
  insists. **Owed** — it is the one decision that changes the aeroplane's
  identity rather than its numbers.
- **(br)** Is `seatLayout 2` (tandem) revived as a layout, or does a tandem
  stay "one abreast with a bay" as G180 ruled, with the two openings coming
  from the knife? **Owed.**
