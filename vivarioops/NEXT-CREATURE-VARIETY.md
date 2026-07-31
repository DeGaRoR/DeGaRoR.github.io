# Brief for the next session — creature variety

Player report: *"creatures do not feel random, they seem like they come from
about a dozen specific seeds."* Investigated in session 10, not fixed. This is
the whole starting position so the next session does not have to re-derive it.

## Do this first, before changing anything

Clear `vivarium:seed` from browser storage and reload the tank.

- **New creatures appear** → the cause is **D** below. It is a persistence
  problem, not a diversity problem, and the fix is the Atlas write path.
- **They still look like siblings** → the cause is **B** and/or **C**.

Five minutes, and it splits the problem in half. Everything below is downstream
of that answer.

## Measured facts

**A. The genome factory is not the bottleneck.** `tools/_diversity.mjs`, 400
random genomes: **400 distinct topologies, 0 rejected.** Node counts 2–5,
connection counts 1–7, both well spread. The draw is fully diverse and nothing
about it needs fixing.

**B. 77% of creatures have 2–4 bodies.**

    bodies   2:90  3:135  4:83  5:45  6:11  7:9  8:8  9:5  10:2  11:4  12:1  13:1  22:2  23:2  24:2

A two- or three-body creature has very few visually distinct arrangements, so
most of the population reads as the same handful of blobs however different the
genomes are. `SLICE_LIMITS.maxRecursion: 2` is the direct cause and **it IS in
the path here** — `factory.js` and `mutate.js` both read it. (Note the asymmetry
with session 10 §58: `maxRecursion` is *not* in the path for hand-written
genomes, which is why raising it does nothing for `worlds/seeds.js`.)

Cheapest experiment: raise `maxRecursion` to 3 or 4, regenerate, and look. A
prior session measured that longer chains swim *worse* and recommended leaving it
alone — but that measurement was taken through the relay, when every body plan
scored identically, and should be repeated.

**C. They all move the same, which may be what "not random" actually means.**
Through the shipped PD the entire authored library — a designed π/2 undulator, a
zero-lag control, a finned swimmer, and a deliberately broken staircase — scores
efficiency **0.006 to 0.035**, a range narrower than measurement noise. Bodies
differ; behaviour does not. Through the solver motor the same library spans
**0.015 to 0.935**. If the complaint is really "they all thrash the same way",
the fix is defaulting the solver motor, not touching morphology at all.

**D. The tank never changes between sessions.** `vivarium:seed` is minted once by
`freshVivariumSeed()` and persisted; `ui/screens/tank.js:583` regenerates the
entire population from it on every load via `seedPopulation`, and breeding
results are **never stored** — grepping the tree for `KEY.` outside `store.js`
returns nothing. So a player sees the same six creatures every time they open the
app, plus whatever they breed within a session. That is literally about a dozen
specific seeds, and it matches the report almost word for word.

## What is already in place to build on

- `tools/_diversity.mjs` — distinct topologies, body-count distribution,
  clamp-by-clamp. Pure morphogenesis, runs in seconds, no physics.
- `tools/_atlas.mjs` + `worlds/seeds.js` — six authored creatures, all validating
  and round-tripping, with orthographic projections. A visual baseline for what
  "different-looking" means.
- `trunk/store.js` — full envelope, migration registry, quota handling,
  `KEY.specimen`. Built, gated, never called.
- `contracts/species.js` now carries `turnRate3d` and `steeringAuthority`, so
  "agility" is a measurable axis of variety, not just a look.

## Suggested order

1. The storage test above.
2. If D: the Atlas write path. `store.set(KEY.specimen(hash), envelope(...))` on
   selection, `store.list('specimen:')` into the grid. One afternoon.
3. If C: default the solver motor. Largest piece, and every measured number in
   the project depends on it anyway.
4. If B: raise `maxRecursion`, re-measure locomotion across body plans **through
   the solver motor**, and decide with numbers rather than with the pre-relay
   measurement.
5. Only then consider widening the material/colour genes, which nobody has
   measured at all.
