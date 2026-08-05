# HANDOVER — the Atlas / Evolution update

> **For a fresh session.** Copy this to `vivarioops/HANDOVER-ATLAS-EVOLUTION.md` — it
> follows the convention of `HANDOVER-FORAGE.md`, `HANDOVER-B2.md` et al. and is the file
> the next session should read first.
>
> **Status: ALL FOUR PHASES IMPLEMENTED.** Gate green — **112 assertions, 104 passed, 0
> failed, 8 pending** (was 96/92/0/4). Verified in the browser at `localhost:8092`. The
> plan below is kept as written; §10 at the end records what actually landed, every
> deviation, and the four things the design got wrong about this codebase.

---

## 0. Where the repo is

Phase A (locomotion integrity) is complete and committed. `npm run gate` is **GREEN — 96
assertions, 92 passed, 0 failed, 4 pending**. Run it before touching anything; if it is not
green on a clean tree, stop and find out why before starting.

The five things Phase A changed that you will trip over:

| | what | why it matters here |
|---|---|---|
| **A1** | `engine/l1/physics.js` never called Rapier's `resetForces`/`resetTorques`, so the fluid force applied at step *n* was the **sum of every force since spawn** | every trajectory number older than this commit is invalid. Do not trust figures quoted in older handovers |
| **A2** | `SLICE_LIMITS.maxRecursion` 2 → 6 plus a spine sub-grammar in `factory.js` | the draw now produces segmented bodies (run ≥ 4: 0% → 14.3%). Portraits clip on exactly these |
| **A3** | `GENOME_V` 2 → 3, positional phase gradient | |
| **A5** | `GENOME_V` 3 → 4, proprioception (shipped inert, `proprioGain: 0`) | |
| **exit** | `FOOD_ENERGY` 4.2e4 → 2.7e3; `faunaVersion` 6 → 7 | median creature now breaks even; half the corpus fails to pay its way, which is the selection gradient B1 needs |

**Two traps that already bit once. Do not re-open them.**

1. **`SCHEMA_OF` maps `genome`, `specimen` *and* `lineage` to `GENOME_V`, but migrations
   used to be registered only for `genome:1`.** Bumping `GENOME_V` made `store.get` throw on
   every previously-saved specimen and `loadAtlas` silently skips on throw — a player's whole
   Atlas went invisible. Fixed in `trunk/store.js` by registering migrations **in a loop over
   `1 … GENOME_V`** for all three kinds. If you bump `GENOME_V` again it is already covered;
   do not replace that loop with a hand-written list.
2. **`worlds/seeds.js` stamped `version: GENOME_V` on a literal whose controller block was
   structurally v2.** The genome claimed to be current, migration declined to touch it,
   `validateGenome` would have rejected it, and its hash differed from the same animal loaded
   from a store — so `seedAtlas` planted a *second* Eel, Darter, Drifter, Flapper and
   Paddletail. Fixed by giving the literals the genes they claim. **A gene added to the
   schema is added to `worlds/seeds.js` in the same edit.**

Atlas records are keyed `specimen:<genomeHash>`; every record in the live store was re-keyed
to its own hash, so `seedAtlas` is now idempotent (plants 0). Keep it that way.

---

## 1. Context — why this update

Phase A made the creatures swim and turn. That exposed a UI problem: **Tank and Forage are
two screens doing half a job each.** Tank breeds but its creatures live in six private
wrapped arenas and never eat; Forage has the real shared ocean, trails, a ledger and good
selection but cannot breed. Judging a lineage means switching tabs and losing what you were
looking at.

Merging them makes two other things obvious, and both are in scope:

- **Names eat the screen.** `Scleromacrosomatus longiventissimus` is unusable as a creature
  label. `design/14-VERNACULAR.md` (new, authoritative) specifies the fix, and it reads
  *different axes* than the binomial — colour, pattern and gait rather than topology. "the
  banded whipfoot" is three words and tells you what to look for.
- **The portraits look like 1990s screenshots** — badly framed, clipped, low effective
  resolution, and the sea backdrop competes with the animal.

The two screens already share more than they differ (`render/tank.js`, `ui/tank/sim.js`, the
whole `.tank-*` and `.spec-picker-*` CSS). `mk()` and `chip()` are duplicated verbatim. **The
merge is mostly deletion.**

### Decisions already taken (do not re-litigate)

| | decision |
|---|---|
| Tab name | **Vivarium** — the project's own word (`vivariumSeed`, `store.KEY.vivarium`). Tabs become Vivarium / Atlas / World / Settings |
| Portrait backdrop | **Neutral studio + vignette**, not water |
| Vernacular | **EN now; FR branch points built but no pool**, so `fr` falls back to the binomial |
| Breeding view | **Free-swimming, spawned on a ring.** No grid, no compare mode |

---

## 2. The merged screen

**Built from `forage.js`, absorbing `tank.js`.** Forage owns the harder half — a real shared
arena, the food field, trails, the ledger, an idle-throttled loop. Tank's breeding is
bookkeeping plus buttons on top of that.

New `ui/screens/vivarium.js`; `tank.js` and `forage.js` retire once it is green.
`trunk/nav.js:17` → `TABS = ['vivarium','atlas','world','settings']`; `app.js:15-22`
registers the one screen.

### Carried from Forage unchanged
Shared unbounded arena, `makeChunkedFood` + `ensureAround`, trails, food point cloud,
per-creature ledger rows, stats sheet, speed ladder, `IDLE_FPS` throttling, and the
**size-invariant** selection rings (`selectRadius`, `forage.js:874-877` — its rationale beats
the tank's size-proportional ring and wins).

**Aquarium is disabled, not deleted.** `HABITATS` (`forage.js:115-118`) keeps both entries;
ocean is forced and the segmented control is not rendered. `spawn()` keeps its `bounded:true`
branch so re-enabling is a UI change.

### Ported from Tank

| what | from | note |
|---|---|---|
| Breed, Undo | `tank.js:994-1035`, `843-853` | grouped with Burst as one primary cluster |
| Burst | `891-935`, `1080-1221` | kept, grouped with Breed |
| Stranger | `938-992` | **subtle mark, not the persisting halo** |
| Generation + provenance | `renderStatus()` `1223-1286` | keep `mixEl`'s "4 children of it" / "2 children each mixing two of them" verbatim — computed from `strangerCount(POPULATION)`, not hardcoded |
| Scale indicator | `updateScale()` `479-492`, `niceLen()` `474-478`, `.tank-scale*` `base.css:200-217` | ports as-is; world units are cm |
| Lineage persistence | `lineageRecord()` `1294-1324` | Forage persists nothing today |
| **ACES tone mapping + fog** | `tank.js:177-180`, `205` | **Forage is missing both.** `render/creature.js` materials are authored against ACES, so Forage has been rendering every creature under the wrong tone curve. Fix this early — it changes how everything looks |

**Seek is dropped** (`tank.js:865-870`, `applySeek` `391-397`). New generations spawn
free-swimming on the existing `spawnRing` (`forage.js:340-344`); `layoutGrid` and the whole
slot/grid apparatus goes.

### The stranger mark
Today a permanent ring at `s.radius * 1.4`, same geometry as the selection ring, tinted and
half-opacity (`tank.js:520-529`) — it reads as a competing selection. Replace with a small
fixed-size glyph billboarded above the creature, reusing the label sprite machinery
(`makeLabel`/`drawLabel`, `tank.js:72-95`). Selection owns rings; provenance owns glyphs.

### Interaction — long-press restored
Delete the three-state click cycle (`forage.js:723-728`: tap select → tap details → tap
release). Replace with the tank's contract, which the shared classifier already supports
(`ui/tank/sim.js:138-145`, `TAP.longPressMs = 400`):

- **tap** — toggle selection
- **long-press** — open the specimen sheet
- **tap empty water** — clear selection

Both canvas (`forage.js:916`) and DOM rows (`forage.js:740`) already arm a long-press timer.
This deletes machinery, it does not add it.

### Chrome
- **Primary cluster**: Breed · Burst · Undo
- **Transport**: Play/Pause · Speed · Reset
- **Import from Atlas**: its own button, promoted out of the chip row
- **Overflow menu**: Food and Trails visibility move into a small burger at the top.
  **There is no popover/menu primitive in the project** — the only modal is the bottom sheet
  `.tank-sheet` (`base.css:235-242`). Build one small `ui/menu.js` anchored popover, used here
  only.

### Names on screen
Rows and labels show the **vernacular**, not the binomial. This is the actual fix for the
real-estate complaint: two or three short words instead of a 34-character Latin compound. The
binomial moves to the stats sheet, where there is room.

### Atlas import shows cards
`atlas.js`'s `card()` is a closure inside `mount()` (`atlas.js:61-118`). Extract to
`ui/cards.js`, use for both the Atlas grid and the import sheet. Selected-state vocabulary
already exists — `.spec-picker-item[data-on="yes"]` (`base.css:379`) and `.forage-tick`
(`380-381`) — and transfers to `.spec-card`.

---

## 3. Portraits

`render/thumbnail.js` has two real defects and one presentation defect.

**1. It aims at the wrong point.** The comment at `thumbnail.js:65-67` claims `buildCreature`
centres the group on the centre of mass. **It does not** — `place()` writes raw
`plan.bodies[i].position` and morphogenesis puts the *root body* at the origin
(`morphogen.js:74`), children growing outward. But `boundingRadius(plan)` is measured about
the **centre of mass** (`morphogen.js:394-401`). For any elongated animal — every spine A2
now draws — the far end sits outside the framed sphere. That is the clipping.

**2. The fit over-frames anyway.** `radius / sin(halfFov) * 1.35` fits a sphere against the
vertical FOV, then adds another 35% margin.

**The fix already exists and is unused.** `fitOrbit(camera, groups, o)` (`render/tank.js:361`)
projects real mesh vertices over sampled yaws and solves for a target NDC — and
**`FIT.portrait = { target: 0.97, eyeHalfY: 0.1 }` (`render/tank.js:412`) was written for
exactly this and is referenced nowhere.** Replace the camera block with it.

**3. Presentation.** Render at 1024. Stop cropping — `.spec-card-thumb` and
`.spec-picker-thumb` use `object-fit: cover` (`base.css:283, 263`), which crops an already
loose fit; use `contain` on a dark card.

**Backdrop → neutral studio.** Drop `createWater` from the thumbnail path: graded dark
backdrop, three-light studio rig, soft ground shadow, vignette, so the creature's own ramp is
the only hue in frame. Keep ACES and `--tank-exposure` so colour matches the live screen.

**Re-render path — do not skip this.** `RENDER_TAG` is written onto every specimen
(`thumbnail.js:27`) and **nothing ever compares it** except `seedAtlas`, for authored records
only. Bump it to `studio-1` and add a lazy re-render: any specimen with a stale `render` tag
gets a new portrait on next Atlas load. Without it every existing creature keeps its old
photo.

---

## 4. Vernacular

New `engine/l1/vernacular.js`, pure over `(plan, genome, ctx, lang)`, mirroring `naming.js`'s
shape. New gate suite `vernacular` registered in `gate/manifest.js:16-25`.

**The head noun is free.** `FAMILIES` (`naming.js:231-255`) already contains exactly the 24
families `14-VERNACULAR.md §3.1` keys against, in the same order. The head noun is a lookup on
the same `symmetry|segmentBucket|mirrored` key the binomial already computes.

| slot | source | pool |
|---|---|---|
| head | family (`FAMILIES` key) | 24 |
| colour | `material.hue`; `hueVariance` → `pale`/`dusky` prefix | 12 |
| pattern | `material.patternScale/patternContrast/stripeAnisotropy` | 8 |
| gait | `controller.omega`, `freqMult`, `amplitude`, and now `phaseBase` | 10 |
| rank | epithet extremity, lineage-relative | 6 |
| `true` | tautonym — detectable as `genus.toLowerCase() === epithet` | — |

**Two slots cannot be built yet. Say so; do not fake them.** `naming.js:214-220` records that
author citations (§8) and recombination scars (§10) are deliberately absent — they need a
`GENOME_V` bump and a migration. So **`false` (§3.5) is not emitted** (VN-9 deferred) and
**the possessive (§3.6) is not emitted** (VN-11 deferred). Both are additive later; neither
blocks the layer.

**Slot scoring is the part that matters** (§4): each slot scored by lineage-local
unusualness, two highest emitted, fixed order `RANK > PATTERN > COLOUR > GAIT`. Reuse
`naming.js`'s z-score-against-`AXES` approach (`naming.js:373-380`) rather than inventing a
second normalisation. **VN-15 is the assertion that tests whether §4 works at all** — a
lineage with fixed hue must emit colour in under 5% of names. If slot scoring is wrong the
layer still produces grammatical names; nothing else in the suite would catch it.

**Language.** EN pools authored now. FR branch points exist (post-position, gender agreement)
but ship no pool, so `lang: 'fr'` falls back to the binomial per §6 — never a half-translated
name (VN-14). `trunk/i18n.js` is a passthrough stub with `setDictionary`, which is where FR
hooks in later.

**Gate:** VN-1..VN-8, VN-14, VN-15, VN-16 in scope. VN-9, VN-11, VN-12, VN-13 deferred with
the reason recorded in the suite. `gate/manifest.js` fails on missing *or extra* assertion
IDs, so register exactly what you implement.

---

## 5. Sequencing

1. **Vernacular** — pure, testable, no UI dependency, and step 4 wants it for labels.
2. **Portraits** — self-contained: `render/thumbnail.js`, two CSS rules, the re-render path.
3. **Extract shared UI** — `ui/cards.js` (from `atlas.js:61-118`), `ui/menu.js` (new), hoist
   the duplicated `mk()`/`chip()` out of both screens.
4. **The merged screen** — build `vivarium.js` from `forage.js`, port the tank features,
   switch `nav.js`/`app.js`, retire `tank.js` and `forage.js`.

## 6. Critical files

- `ui/screens/vivarium.js` (new, from `forage.js`) · `ui/screens/tank.js`, `forage.js` (retire)
- `trunk/nav.js:17`, `app.js:15-22` — tab list
- `render/thumbnail.js` — `fitOrbit`/`FIT.portrait`, studio backdrop, size 1024, `RENDER_TAG`
- `engine/l1/vernacular.js` (new) · `gate/vernacular.js` (new) · `gate/manifest.js`
- `ui/cards.js`, `ui/menu.js` (new) · `ui/base.css` — `object-fit`, menu, stranger glyph

**Reuse rather than rebuild:** `fitOrbit`/`FIT` (`render/tank.js:361,410`), `createWater`
(`render/tank.js:73`), `ui/tank/sim.js` gestures and budgets, `FAMILIES` (`naming.js:231`),
`ledger` (`engine/l2/forage.js:477`), `lineageRecord` (`tank.js:1294`).

## 7. Verification

```bash
cd D:/Dev/DeGaRoR.github.io/vivarioops && npm run gate
```

- **Gate green**, including the new `vernacular` suite.
- **Vernacular by eye**: print name + binomial for the ~37 stored specimens. The test is
  whether the names are memorable and none is twee — M5 (no diminutives) and M8 (field-guide
  plausibility) are taste rules a gate cannot check.
- **Portraits**: re-render the Atlas and compare before/after on the worst cases — the
  17-body `Schizortharthrus denticaudissimus` and the 4-body `Oligosphalmatops
  longipedissimis`, which currently clip.
- **The screen**, at `localhost:8092`: breed a generation and confirm the provenance line,
  the stranger glyph, the scale bar, long-press → sheet, the burger menu, Atlas import
  showing cards, and that the six spawn free-swimming and start eating. Screenshot it.

**Browser note:** dev servers are capped at 5 per folder and other chats hold them. If
`preview_start` fails, ask the user to free one. IndexedDB is **per-origin** — the user's real
Atlas lives on `http://localhost:8092`; a different port is a different, empty store. Do not
conclude data is lost without checking the port.

## 8. Out of scope

Aquarium habitat (disabled, kept) · Seek · FR pools · author citations and recombination
scars (need `GENOME_V` 5) · trimming and freezing the Atlas — the user is doing that himself.

## 9. Open, for the user

`design/14-VERNACULAR.md §11` leaves four decisions open. Only one bites during
implementation: **whether `dwarf`/`giant` read absolute or lineage-relative size.** §11.3
recommends lineage-relative for consistency with 13 §9; absolute is defensible for these two
words since a player compares across the whole Atlas. Take lineage-relative unless told
otherwise, and note it in the suite.

---

# 10. WHAT LANDED

Everything in §1–§7 above is implemented. Gate green: **112 assertions, 104 passed, 0
failed, 8 pending**, and the screen was driven in the browser — breed, undo, the burger
menu, long-press to the sheet, the Atlas grid, and six creatures spawning free-swimming
and eating.

## 10.1 New and retired files

| | |
|---|---|
| new | `engine/l1/vernacular.js` · `gate/vernacular.js` · `ui/screens/vivarium.js` · `ui/cards.js` · `ui/menu.js` · `ui/vernacular.js` · `tools/_vnprior.mjs` · `tools/_vnlook.mjs` |
| retired | `ui/screens/tank.js` · `ui/screens/forage.js` |
| moved | `mk()` / `chip()` → `ui/widgets.js` · `card()` → `ui/cards.js` |
| tabs | `TABS = ['vivarium','atlas','world','settings']`, `PRIMARY = 'vivarium'`; R4 asserts it |

## 10.2 FOUR PLACES THE DESIGN WAS WRONG ABOUT THIS CODEBASE

Each is recorded as a carried obligation in `gate/vernacular.js` and printed by the gate.

1. **`material.hue` IS NOT A HUE — 14 §3.2 is unimplementable as written.**
   `render/creature.js:84` reads it as a **position along the world's six-stop palette
   ramp**. w1's ramp is deep blue → cyan → mint → bone → coral → magenta: it contains no
   ochre, amber, olive or jade *at all*. A flat twelve-way split of the hue circle would
   have named creatures for colours the world cannot render — the worst possible outcome
   for a layer whose entire job is recognition. **The colour word is derived from the ramp
   colour the animal actually wears**: `ctx.palette` in, sRGB→linear lerp (what THREE
   does), back to sRGB, HSL, sector. A warm world reaches the warm words by itself.
   The ramp is *passed in*, never imported — a hex literal in `/engine/` would be the
   token duplication N16 exists to stop, and N3 forbids the import outright. **Without
   `ctx.palette` there is no colour slot at all.** `render/creature.js` gained
   `paletteFor(worldId)`; `gate/vernacular.js` parses `tokens.css` so the suite asserts
   against the ramp that ships.
   *Consequence:* `pale`/`dusky` now read **measured saturation**, which is what §3.2 asks
   for, rather than `hueVariance` (the accent offset, which never had anything to do with
   saturation).

2. **M3 contradicts §2's own examples.** M3 caps a name at five syllables;
   "Gauder's greater rowing whipfoot" is six. The budget shipped is **six** — the smallest
   value consistent with the document's own output — and it *binds*: it is what stops
   `dusky indigo hundredfoot`, and when two modifiers do not fit the layer emits one.
   **14 should say one or the other.**

3. **M5 bans `-y` and §3.3 ships `glossy`.** M5 is a rule about *derivation*, not letters:
   a literal suffix match rejects five of 14's own words (`whirling`, `tumbling`,
   `sculling` are present participles — §3.4 authors the whole gait pool that way — and
   `dusky`/`glossy` are adjectival). Held as `BANNED_SUFFIXES` plus `M5_EXCEPTIONS`, each
   entry carrying its reason. VN-6 fails on an *unlisted* word, which is what would catch
   `duckling` or `spotty` arriving later.

4. **§11.3 decided: `dwarf`/`giant` are LINEAGE-RELATIVE**, per §11.3's own
   recommendation. The reference is a **quantile pair**, not naming.js's
   median-and-spread, and not `signature.traits.size`: that trait is `clamp01((r-0.5)/8)`
   and **saturates for 24% of the corpus**, so no z-threshold on it can separate large
   from enormous. Measured, `dwarf` was *unreachable* in 4000 draws and 24% came out
   `giant`. Measured on `bodyRadius` instead; `tools/_vnprior.mjs` re-measures.

## 10.3 Vernacular — how it works

`vernacular(plan, genome, ctx, lang)`, pure. Head from family (24, VN-3 asserts it over
10k). §4's slot scoring is **surprisal**: `-log2 p(word)`, lineage counts smoothed toward
a **measured** prior (`tools/_vnprior.mjs`, n=4000 — the same discipline as naming.js's
AXES). A word every creature in the lineage already wears scores ~0 and stops being
mentioned; the layer self-tunes with no rule saying so. Verified live: breeding a
*sculling stubfoot* produced four children named on **colour and pattern** — `teal
sculling`, `striped sculling`, `dwarf teal`, `dwarf striped` — because "sculling" had
stopped discriminating.

**One demotion, found by reading output, not by a test.** `plain` is the rarest pattern
word, so surprisal scored it *high* — and §3.3 says it should usually lose the draw,
because a name should not spend a modifier saying nothing. `DEMOTE = { plain: 0.35 }`.

**Names are minted ONCE and stored** (`spec.vernacular`), exactly as the binomial is.
Scoring is lineage-relative by design, so recomputing on render would rename a creature as
its neighbours changed. `ui/vernacular.js` owns the wiring; `ui/screens/atlas.js` backfills
`vernacular` onto pre-14 records on the same pass that re-renders stale portraits.

**Gate:** VN-1..VN-8, VN-10, VN-14, VN-15, VN-16 implemented; VN-9, VN-11, VN-12, VN-13
pending with the reason on the assertion. Two notes worth keeping:

- **VN-15 has a control arm.** Without it the assertion would also pass for a layer that
  never emits colour at all. The lineage is pinned to a hue whose word is *globally rare*
  on the w1 ramp, so a prior-only scorer would emit it in nearly every name.
- **VN-16's first harness was wrong and the wrongness was invisible.** `lockMorphology`
  restricts mutation to the controller branch (`mutate.js:659`), so material genes never
  move and colour and pattern *could not* vary. The second was wrong too: one genome
  advanced by one mutation per generation gave 54 distinct names — and the cause was not
  the assembler, the 100 specimens held only **15 distinct slot-word tuples** between
  them. A lineage is a **population**: `POPULATION` offspring at
  `MUTATIONS_PER_OFFSPRING` mutations each, family-changing offspring rejected. 96/100
  distinct over 40 tuples. The suite now asserts the tuple count separately, so a
  regression says immediately whether the *naming* or the *corpus* ran dry.

## 10.4 Portraits

`fitOrbit` + `FIT.portrait` replaced the bounding-sphere block. **`fitOrbit` was already
in the tree and referenced nowhere.** 1024 px, `RENDER_TAG = 'studio-2'`, lazy re-render
on a stale tag in `ui/screens/atlas.js` (the missing half — *nothing* compared that tag
except `seedAtlas`, and only for authored records). `object-fit: cover` → `contain`.

New `createStudio` / `placeStudioGround` / `renderVignette` / `disposeStudio` in
`render/tank.js` (it owns "everything a creature is seen through or against"), with a
`--studio-*` token block. ACES and `--tank-exposure` stay shared with the tank on purpose.

**`studio-1` → `studio-2`, and this one only showed up on screen.** `FIT.portrait`'s
`eyeHalfY: 0.1` scales the camera elevation off the subject's **height**, and half this
Atlas is eels — 20:1 rods with almost no Y extent. The camera landed *level with the
ground shadow*, which rendered as a hard horizon line across the plate. `fitOrbit`'s own
doc-comment warns about exactly this. Fixed with `eyeRatio: 0.30` (a fraction of *depth*),
so every specimen gets the same three-quarter elevation whatever its proportions.

## 10.5 The merged screen

Built from `forage.js` absorbing `tank.js`, and it is mostly deletion. Everything §2 asks
for is in. Worth flagging:

- **Forage was rendering under the wrong tone curve.** `tank.js:180` sets ACES; `forage.js`
  set neither ACES nor fog, and `render/creature.js`'s materials are authored against ACES
  and compensate for its knee. Fixed, and it changes how everything looks.
- **One population, not a cast and a population.** `genomes` is the lineage (bred, undone,
  persisted); the swimming cast is built from it. Forage's `Cast` picker became **Import**,
  which writes into `genomes` and marks each `{ kind: STRANGER, imported: true }`.
  Importing does **not** reset `generation` — that counter means "breeds", and dropping
  creatures in is not a breed.
- **The rng stream label stays `'tank'`.** Renaming it would re-roll every existing
  lineage: same seed, same selections, different offspring. A cosmetic rename is not worth
  breaking a player's replay.
- **In-scene sprites keep showing SPEED, not the name.** 21 §4.5 is explicit that one
  number is always visible and that it is speed; three words over each of six creatures in
  a shared ocean is clutter. §2's "labels show the vernacular" is honoured on the **rows**
  and the **sheet heading** — which is where the real-estate complaint actually was.
- **rAF does not fire on a hidden page**, so the Atlas re-render loop uses the
  rAF-or-`setTimeout` race `runBurst` already used. A bare `await rAF` wedged it the moment
  the browser tab lost focus. (Found because the Browser pane was not compositing.)

## 10.6 Still open

- **VN-9 / VN-11** — `false` and the possessive need `GENOME_V` 5 (scars, authors), the
  same blocker `naming.js:214` already records. Both are additive: one word in `RANK_EN`
  and one branch in `rankWord()`.
- **VN-12 / VN-13** — FR is 44 modifier words. The branch points ship (`GRAMMAR.fr`:
  post-position, the six pre-nominal rank words, gender on all 24 heads). §11.1's note that
  the FR head table wants a native ear still stands.
- **The M5/M8 taste calls are yours.** `tools/_vnlook.mjs` prints name + binomial for a
  corpus; that is the only test for "memorable, and none is twee".
