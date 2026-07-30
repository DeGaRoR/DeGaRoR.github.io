# Vivarioops — handoff

Working title as of 0.8.0. Only user-visible strings carry it; module paths, the
`viv/` directory and the ten spec documents still say Vivarium.

Written at the end of the C2 sitting. **A fresh session needs: this file, the
ten spec documents, and the zip.** The container filesystem does not persist, so
the zip is the codebase.

## State

| Session | Status | Gate |
|---|---|---|
| A0 Contracts | done | green |
| A1 Skeleton | done, device checkpoint unverified | green |
| B1 Genome | done | green |
| B2 Morphogenesis | done, visual checkpoint unverified | green |
| B3 Motion | code-complete — CHECKPOINT ANSWERABLE, UNSIGNED | green |
| B4a Breeding · engine | done, mutation-tested | green |
| B4b Breeding · tank UI | built — CHECKPOINT UNSIGNED | green |
| B5 First light | not started | — |
| C1 Sensors + probes | done, mutation-tested | green, 1 pending |
| **C2 Duels** | **engine done · UI deferred · CHECKPOINT NOT ANSWERABLE** | **green, mutation test INCOMPLETE** |
| D1 Ecology core | blocked — see below | — |

Run `npm install && npm run gate`. 75 assertions, 71 pass, 0 fail, 4 pending
(K3 now live; R5 → browser, L2-5 monotonicity, L2-18 C2 checkpoint), 2019 checks.

## Read this first: C2 is blocked, and the blocker is buoyancy

**The duel harness is correct, deterministic and symmetric. It measures nothing.**

0 captures over 9 resident duels. Median closing distance **0.00 m** over a 15 s
duel against a start separation of several metres. The matchup matrix is all
zeros, so `Species.vs` currently adds nothing over a scalar and D1 would inherit
a fauna that cannot interact.

The cause is measured, not suspected:

- **Capture is reachable.** `tools/c2sweep.js`: 6/45 captures when the pair
  starts at half the reach sum. The root-contact rule works.
- **The creatures are not swimming.** In the duel tank, **6 of 10 creatures reach
  the floor and 2 reach or pass through the surface within 15 s**. They spend the
  fight pinned against a boundary. Horizontal travel over 13 s: median 0.4 m.
- **This is the standing B3/B5 obligation coming due.** 02 §7's density range
  0.15–1.8 against `mediumDensity` 1.0. Solo probes sidestep it by measuring at
  gravity zero (C1's amendment); a duel cannot, because the tank is where the
  contact happens.

**Decide the density/buoyancy question before anything else.** It now blocks C2's
checkpoint, D1's ecology, and B5's art pass, and three sessions have deferred it.

## What to do first in the next session

1. **Finish `node tools/_mut_c2.mjs`.** 26 seeded defects; **14 caught, 0
   escapes** before the session ended. C2's green is NOT accepted until it
   completes — that is the project's own standing rule and it has caught six
   real gate bugs. The 12 unrun mutants are the setup-variation, sensing,
   resident and fauna-loader groups at the end of the list.

   **THE RUNNER IS NOT CRASH-SAFE, and it cost time here.** It writes a mutant,
   runs the gate, then restores. Killed in between, it leaves the mutant in the
   tree — twice in this session, and the second one masqueraded as a real L2-15
   failure for two gate runs. Before running it again, wrap the mutate/restore in
   a `try/finally` and add a `SIGTERM`/`SIGINT` handler that restores. **After any
   interrupted run, re-run the gate before trusting the tree**; a red gate
   straight after a kill is a left-over mutant until proven otherwise.
2. **Then the buoyancy decision.** Candidates, cheapest first: narrow the density
   range toward neutral; raise `mediumDensity`; add a depth-holding term. Each is
   a `w1_slice.js` change, so measure with `tools/c2sweep.js` and
   `tools/c2diag.js` rather than by eye.
3. **Only then** the capability card UI, which was deliberately not built.

## Still owed: two human checkpoints (B3, B4)

Nothing here is blocked. What is missing is a person looking at a screen.

**Open the app and watch the tank.** Two checkpoints have been waiting on this
and neither can be answered by a gate:

- **B3** — "creatures move, and at least some undulate rather than twitch. This
  is the moment the generator concept is validated or not" (30 §4). It was
  signed off as code-complete against a screen that did not exist: `tank.js` was
  still the B2 screen, imported no physics, and **no part of this application
  had ever stepped a simulation**. Everything known about how these creatures
  move still comes from `gate/motion.js`.
- **B4** — "six creatures, select, breed, repeat, and it holds attention for
  twenty minutes. Offspring visibly resemble parents."

Both are now answerable. 30 §4's stop conditions are worth rereading before you
look, so the judgement is made against them rather than against hope: *stop if
motion is uniformly spastic after tuning `phaseLag` ranges* — the fallback is
velocity motors, reachable behind `DRIVE`, before concluding the approach is
wrong.

Three things to expect, all measured rather than feared:

1. **Creatures will rise or sink.** Buoyant drift exceeds locomotion by about
   40x (B3). They swim, but they swim while surfacing. That is 02 §7's density
   range against `mediumDensity` 1.0 and it is a B5 question.
2. **They are small** — mean 3.95 bodies, so a median of three joints. Whether
   that is "sparse but clean" or "too sparse to be interesting" is open decision
   3 and this is the first chance to judge it.
3. **Locomotion is slow.** Median travel is about 0.2 m in 15 s at gravity zero,
   and body plan barely affects it. If it looks like wiggling in place, that is
   the honest state of the physics, not a rendering problem.

## B4b — what was built

`ui/screens/tank.js` (replaces the B2 screen outright) and `ui/tank/sim.js`.

**Tiled tanks — a deviation in mechanism, not in appearance.** 21 §4.2 resolves
the layout as one shared tank and rejects pods and viewports. But
`createSimulation` builds its own `RAPIER.World` per call, so six creatures in
one physics world would mean reworking it — under a green B3 gate, with every
B4a viability threshold measured against W1's tank as it stands. So each
creature gets its **own unmodified W1 tank** and the six are tiled, cell centres
one full tank apart. **The box drawn on screen is exactly the union of the six
real tanks** — L1-32 asserts both the non-overlap and the union. The cost is
that creatures cannot touch each other; nothing in the slice needs them to.

**The tank's arithmetic is in `ui/tank/sim.js`, not in the screen**, because a
screen is the one thing a gate cannot look at. Cell layout, the fixed-timestep
accumulator and its clamp, the hit-test radius and tap-vs-drag all live there
and are asserted by L1-32 and L1-33.

**Measured: six simulations cost 0.281 ms per step, all six together** — 21
bodies, 29.7x realtime. At 60 fps and two steps per frame that is 3.4% of the
frame budget at 1x, 14% at 4x. This is the typical corpus rather than 10
§A17.4's 144-body worst case, and a desktop container rather than a phone.
**The fallback ladder is unexercised** — if it stutters on a real device, the
order is 1/60 with 2 substeps, then cap bodies at 16, then population 4, then
simplify post.

**Fixed at 0.7.1**, all three named at delivery: pinch-zoom (multi-touch was
unhandled, so zoom was unreachable on a phone and a pinch spun the camera);
a portrait grid (a constant 3x2 cropped two creatures, and the camera framed
against the vertical fov only, which is what crops in portrait); and the speed
label, which measured the fastest BODY rather than the creature and so rewarded
thrashing — now horizontal centre-of-mass speed, smoothed, with the vertical
component dropped because it is buoyancy rather than thrust.

What is deliberately absent: the derived binomial is not shown on the specimen
sheet (10 §8 keeps naming to "function only, no UI"; it is one line when that
changes), and the tank does not survive a reload (not in 30 §4 B4; E1 owns the
loop).

## B4a — what was built, and four things measured rather than assumed

`mutate.js` · `viability.js` · `breed.js` · `naming.js` · `gate/breed.js`
(L1-23..L1-31) · `tools/_mut_b4.mjs`.

**1. A quantisation defect older than B4.** `q()` rounds to the nearest micron,
so quantising a value clamped to a range bound can put it outside that bound:
`q(-PI)` is `-3.141593`, 3.5e-7 below `RANGE.phaseLag`'s own minimum, and
`validateGenome` rejects it. Every `phaseLag` jitter that saturated produced an
invalid genome. `qClamp()` now sits beside `q()` in `genome.js`. **`factory.js`
has had the same defect since B1** and has never fired it — it needs a uniform
draw within 5e-7 of a bound, roughly one in ten million. Both use `qClamp` now.
Worth remembering as a class: clamp-then-quantise is wrong wherever
quantisation exists.

**2. A mutation that changed nothing.** `recursiveLimit` steps ±1 and the slice
range is `[1, 2]`, so a freely chosen direction clamped back to its own value
half the time at either end — 2 in 400. That is A9's named failure mode
verbatim: "simple creatures appear to produce identical children".

**3. Three of A9's viability rules do not do what they say**, measured over 200
genomes. All three are amended in `viability.js` with the measurement inline:

| A9 rule | Measured |
|---|---|
| inert below 0.05 m in 2 s | at gravity zero rejects **46%** — A9 itself calls >40% broken. Set to 0.01 m (corpus p10 is 0.013), rejects 9% |
| radius > 4x tank | 64 m in W1, **fires on nothing**. The real rule — fitting in the tank at all — is unstated and fires on **10%** |
| discard persistent interpenetration | a single end-of-settle pose rejects **20%**; sampled three times, **10%**. A9's word is *persistent* |

**4. The epithet table was worthless as first written.** An argmax over raw
normalised traits is won unconditionally by any trait that saturates at 1.0, so
**150 of 300 creatures were named `apodus`** — most have no mirrored limbs, so
`1 - limbs` is exactly 1. "The single most extreme normalised trait" means
extreme *relative to a population*. Twelve axes now carry a measured median and
p10–p90 spread and the sign of the deviation picks the pole, which is precisely
A17.5's 24 epithets. 45 → 69 distinct binomials over 300; mode 50% → 11%.

**The references in `naming.js` are constants of the CURRENT generator.** Step F
loosens the factory and they will drift. The gate prints the name distribution
every run so the drift is visible rather than silent.

## B4a — the standing diagnostic

```
MUTATION VIABILITY RATE: 80% over 60 mutants   (30 §4 target >= 60%)
  rejected: inert 5, bodies 2, mass 2, interpenetration 2, oversizeTank 1
fallback to unmutated parent: 0/12 births
operator mix over 300: broadly even across all eleven operators
naming: 69 distinct binomials over 300
```

## Open decisions

1. **RESOLVED at B4: `maxReflectionAxes` stays 1, and the question moves to
   B5.** B3 measured every locomotion figure getting worse at 2 and 3. It is a
   question about how creatures *look*, not how they move, and B5 is where looks
   are judged. Still pinned in two places so a change stays deliberate.
2. **RESOLVED at B4: N17 beats N18 when all six are selected.** They are jointly
   unsatisfiable in six slots. The stranger is allocated first and the LAST
   creature selected is dropped, so the outcome follows from the player's own
   last action. Neither 10 §A17.3 nor 21 §4.3 states this; `breed()` returns
   `droppedElite` so the UI can say so.
3. Mean 3.95 bodies per creature, unchanged. "Sparse but clean" versus "too
   sparse to be interesting" is still a judgement, and B4b is the first chance
   to make it with the creatures moving.
4. Whether the tank shows the derived binomial. 10 §8 says naming is "function
   only, no UI" in the slice and 21 §4.5 says the persistent label is speed. The
   function exists and the specimen sheet is the obvious home; using it is a
   step-F decision, left undone deliberately.
5. **NEW — whether creatures should share one physics world.** The tiling above
   is invisible to the player but it does mean six creatures can never interact.
   If the tank ever wants that, `createSimulation` needs to take an existing
   world rather than building one.

## Carried obligations (the gate prints these every run)

- B3 — the checkpoint is human and unsigned. **The screen now exists; go and
  look.**
- B3 — the peak-speed tail (about one creature in eleven, p95 220 m/s), and
  `MOTOR_SCALE` 1.0 is tuned rather than derived. Bound the tail before C1 reads
  work or displacement as a capability. **Partially bounded for BRED creatures
  only**: `viability.js` rejects anything exceeding one wall thickness per step
  (60 m/s — derived, not tuned), so the tank should not show one. The gate corpus
  is unfiltered and B3's numbers stand.
- B3 — buoyancy dominates locomotion by ~40x; 02 §7's density range against
  `mediumDensity` 1.0. Worth deciding at B5.
- B4 — the checkpoint is human: six creatures, twenty minutes, offspring that
  visibly resemble parents. **The screen now exists; go and look.**
- C2 — replace `W1_SLICE.residents` placeholders with real genome hashes; bump
  `faunaVersion`.
- C2 — K3 and the record-level half of K4 activate when `duel.js` lands.
- F — `pursuitGain` / `evasionGain` are unmeasured fixture defaults.
- Tier 1 — N15 has no check; `t()` is in use but the DOM scan needs dictionaries.
- Tier 3 — `index.html` `meta[name=theme-color]` holds the only hex outside tokens.

**Mutation escape from B3, still recorded and not repaired.** Reverting the
motor damping to axis-only no longer diverges at the stress scale, so L1-22 does
not catch it. The property that defect violates is "the motor does not do net
work on DOF it cannot observe", and asserting it directly — comparing
accumulated `work` against the change in kinetic energy over a run — is the
right repair.

## Standing lessons, worth carrying

**Mutation-test every gate before accepting green.** Four gate bugs in this
project were the same defect — an assertion deriving its own bound from the code
under test — and every one passed until mutation-tested. B4 added two more of
its own kind, both caught by the harness and both worth naming:

- **Count leaves, not elements.** The B4 diff counted changed *elements*, so an
  operator writing both `amplitude` and `bias` to one oscillator still showed as
  one change and escaped. "Exactly one mutation" is a statement about scalars.
- **An assertion whose corpus cannot violate it asserts nothing.** The node cap
  was respected but never *pressed*: a factory genome holds 2–5 nodes and three
  mutations can add at most three, so the corpus never reached 8 and deleting
  the cap check entirely escaped. Assertions need a corpus that reaches the
  boundary, not one that merely stays inside it.

**A wasm panic names the place that noticed, not the place that broke** (B3).
`tools/b3diag.js` probes for a non-finite state *before* each step instead of
stepping into it. Reach for that shape first next time a Rapier call dies.

**Read the screen, not the module.** B3 was declared code-complete against a
checkpoint that required a screen nobody had checked existed, and it stayed that
way for a whole session. A deliverable that ends in a human judgement is not
complete until the thing being judged can be looked at. When a checkpoint names
a screen, open the screen before writing the status line.

**Extract what the gate can reach.** The tank's four load-bearing decisions —
cell layout, the accumulator clamp, the hit radius, tap-vs-drag — are all pure
arithmetic that would otherwise have been checkable only by a person staring at
a tank, and all five seeded defects against them were caught. Whatever can be
moved out of a screen should be.

## Body count — why creatures are small, measured (unchanged from B3)

Nothing caps a creature at four parts. The genome cap is 24 bodies and creatures
do reach it. What keeps the average at about four is three throttles in
`SLICE_LIMITS`, all deliberate for the slice: the random factory makes small
graphs, `maxRecursion: 2`, and overlap rejection which discards a limb along
with its entire subtree.

**The obvious move — more segments should undulate better — was tested and is
false.** More parts and longer chains swim *less*, and the instability tail grows
sharply with joint count. `maxReflectionAxes` is the actual driver of body count,
but it multiplies limbs *sideways* — mirrored copies that beat symmetrically and
cancel — so the result is a starfish, not an eel. **Leave the segment settings
alone.** The full measurement tables are in the 0.5.0 changelog entry.

**The real finding is that body plan barely matters to locomotion at all.**
Median travel sits near 0.2 m in 15 s across every configuration tested. The
candidates for what limits thrust are the controller giving mirrored limbs
mirrored phase so their thrust cancels, a pure quadratic drag model with no lift
or added-mass term, and `MOTOR_SCALE`. That is a tuning problem of its own and
should be taken up separately.

## Spec defects found so far — the spec set should be amended

New at B4 in bold.

| Doc | Defect |
|---|---|
| 03 §1 | `worldHash` omits `dragCoefficient`, a physical parameter K5 requires |
| 03 §3 | six `Species` fields marked "from genome" had no genes; added at B1 |
| 03 §3 | derivation constants 0.5 / 2.0 / 8 / 0.02 were literals; 30 D1 forbids that |
| 03 §4 | certain-capture guard is a deadline, not a per-tick probability of 1 |
| 03 §5 | `pursuitGain` / `evasionGain` required by 30 §5 C1 but absent |
| 03 §6 | pinned versions superseded — see `contracts/PROVENANCE.md` |
| 03 §7 | K1's producer set omits `id`, `name`, `provenance`, hashes and `vs` |
| 01 §3 | module map has neither `/contracts/` nor the right spelling of `/worlds/` |
| 01 §7 | **the drag law is stated as a force with no integration scheme.** Written explicitly it is unstable at the timestep 01 §7 also fixes; the two clauses are jointly unsatisfiable |
| 02 §2 | `surface.height` vs 03's `surface.y`; ~12 fixture keys absent |
| 10 §A5 | node `colorGenes` is literally `{...}`; defined at B1 |
| 10 §A6 | **no dimension bounds and no overlap rule** — both load-bearing, both in the reference |
| 10 §A6 | step 4's `halfExtent` is scalar; must be the component-wise parent half-extent |
| 10 §A6 | pseudocode is depth-first; the reference is breadth-first, which truncates better |
| 10 §A6 | "stop" at the body cap; the reference skips the connection and continues |
| 10 §A6 | **the parent exemption from overlap rejection has no matching contact rule** |
| 10 §A7 | `jointGenes` written as a positional array, which §A5 correction 5 forbids |
| 10 §A8 | **the drag law has no projected-area rule.** With a constant `A` undulation produces no thrust and nothing can swim |
| **10 §A9** | **`addOscillator` / `removeOscillator` are unrepresentable.** §A7 binds exactly one oscillator per node and the validator enforces it both ways, so adding one IS `addNode` |
| **10 §A9** | **no branch for material or social genes**, but §A10 requires MaterialGenes to mutate and L3 selects on the six social genes. A fourth branch was added |
| **10 §A9** | **the inertness threshold rejects 46% of the corpus**, against A9's own >40% warning. Written for a different motor scale |
| **10 §A9** | **the size rule (4x the tank) fires on nothing**; the rule physics needs — fitting in the tank at all — is unstated and fires on 10% |
| **10 §A9** | the collision-clipping trick for connected parts is moot: B3 disables contacts between jointed bodies outright |
| **10 §A10** | "the single most extreme normalised trait" is unusable as a raw argmax — a saturating trait wins unconditionally and names half the corpus. Extremity must be relative to a population |
| **10 §A17.3** | **still specifies the 40/30/30 asexual/crossover/graft mix** that 30 R3 removed from the slice. Amend, or step F will read it as implemented |
| **10 §A17.3 / 21 §4.3** | **N17 and N18 are jointly unsatisfiable when all six are selected.** Neither document says which wins |
| 10 §A14 | says "seven assertions", lists eight |
| 10 §A17.1 | stale: density 0.6–1.4, recursion 1–6, all 7 joint types, "< 4 connections" |
| 10 §A17.1 | `terminalOnly` at 50% on spanning edges yields jointless single-body creatures |
| 10 §A17.2 | one axis serves as both bodies' local frame, so the mapping is only correct if bodies are spawned world-aligned and limb orientation is carried on the collider |
| 10 §A17.2 | "each free angular DOF gets one oscillator" is not reconcilable with A7's `jointGenes`, which carries one amplitude/bias/freqMult per joint |
| 20 §5 | `record:<genomeHash>:<worldId>` predates `WorldKey` |
| 30 §2 | ledger gate counts disagree with the per-session numbers — **B4 predicted 36 against an actual 55**. The ledger has been behind since A1 |

## Units — documented, not a defect

Density is relative to water = 1.0 and mass = density × volume, so a 1 m³ body at
density 1.0 masses 1 kg. That is 1000× lighter than real water. It is internally
consistent and deliberate: it is what makes 03 §5's `totalMass` 6000 kg and
`biomassBudget` 300 kg give a sensible population against a median creature mass
of ~4.8 kg. Rapier's collider density takes the gene value directly. Only
`MOTOR_SCALE` has to be tuned to this choice, because torque follows area (N19)
and does not rescale with mass.
