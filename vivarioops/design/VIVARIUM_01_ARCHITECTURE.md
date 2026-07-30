# VIVARIUM — 01 · Architecture & Contracts

**The spine.** Defines the boundaries between components, the data that crosses them, and
the rules that keep them separable. Where a component's internals are specified
elsewhere, this document points rather than repeats.

| | |
|---|---|
| **Status** | Normative |
| **Reads** | 00 Vision · 02 Worlds |
| **Governs** | 10 L1 · 11 L2 · 12 L3 · 20 Trunk · 21 UI |

---

## 1. System shape

```
                    ┌──────────────────────────────┐
                    │   TRUNK  (doc 20)            │
                    │   i18n · nav · store · QC    │
                    │   versioning · PWA · bench   │
                    └──────────────┬───────────────┘
                                   │ services
   ┌───────────────────────────────┼───────────────────────────────┐
   │                               │                               │
┌──▼──────────┐   BodyPlan   ┌─────▼────────┐  Species   ┌─────────▼────┐
│  L1 TANK    │─────────────▶│  L2 BRIDGE   │───────────▶│  L3 WORLD    │
│  doc 10     │              │  doc 11      │            │  doc 12      │
│             │◀─────────────│              │            │              │
│  physics    │   Genome     │  probes      │            │  particles   │
│  genome     │              │  duels       │            │  ecology     │
│  breeding   │              │  measurement │            │  verdict     │
└─────────────┘              └──────────────┘            └──────────────┘
       ▲                            ▲                            ▲
       └────────────────────────────┴────────────────────────────┘
                          World (doc 02) — read by all three
```

**Dependency direction is strictly downstream.** L1 knows nothing of L2. L2 knows nothing
of L3. Nothing in a layer imports upward. The only shared upstream object is `World`,
which is inert data.

---

## 2. The four contracts

Everything crossing a boundary is one of these. If a component needs something not in a
contract, the contract changes — deliberately, with a version bump — rather than a
back-channel appearing.

### C1 · Genome → BodyPlan *(inside L1)*

```
morphogenesis(genome) → BodyPlan          // pure, deterministic
```
`BodyPlan` = bodies, joints, attachment frames, cross-sectional areas, mirror provenance.
Specified in 10 §6.

### C2 · L1 → L2 · the compile input

```
{ genome, bodyPlan, world, residents[] }
```
L2 re-runs morphogenesis itself rather than trusting a passed body plan, so the compile
is reproducible from the genome alone. The body plan is passed only as a cache.

### C3 · L2 → L3 · the species record — **the critical interface**

This is the one that matters. It is the *entire* knowledge L3 has of any creature.

```js
Species = {
  id, name, genomeHash, worldId, bridgeVersion,

  // measured — 11 §7
  massBase, massMin, massReproduce,
  cruiseSpeed, burstSpeed, burstRatio, maxChaseSpeed,
  turnRate, turnRadius, turnSpeedRatio,
  cotC0, cotC1, basalRate,
  reach, surfaceArea, frontalArea, torsoExposure,
  pursuitGain, evasionGain,

  // from genome, not measured
  trophic, perceptionRadius, boldness,
  cohesion, separation, alignment, separationRadius,

  // measured pairwise — 11 §6
  vs: Float32Array   // 5 × speciesCount: pCapture, pCaptured, pStalemate, timeToCapture, energyCost
}
```

**Invariants:**
- `vs` is indexed by species id and must be dense — every pair present, including self (self entries are zero).
- A record is valid only for the `worldId` it was compiled in. L3 must reject mismatches rather than proceed.
- `bridgeVersion` mismatch invalidates the record. There is no partial migration; recompile.

**Why this is the critical interface:** it is where the creature's physical identity is
compressed. Every design argument about "do we lose the specificity" reduces to whether
this struct is rich enough. It is the thing to review first when the game feels wrong.

### C4 · Persistence

```
Specimen = { genome, seed, worldId, describedAt?, name?, commonName?, note?, thumb? }
Record   = CapabilityRecord            keyed by (genomeHash, worldId, bridgeVersion)
WorldDef = World                       authored + residentMatrix
Lineage  = { vivariumId, generation, genomes[], selection[], prevGeneration? }
RunResult= { worldId, speciesId, verdict, series[], seed }
```

A specimen is **always** stored as genome + seed + world reference, never as baked
geometry. This is what makes saves tiny, sharing free, and re-rendering at any quality
possible.

---

## 3. Module map

```
/trunk/          doc 20 — no game logic, extractable
/world/          doc 02 — World definitions, pure data + loader
/engine/
  /l1/           genome · morphogen · controller · physics · mutate · viability · naming
  /l2/           probe · probes/* · duel · reduce · compile · cache
  /l3/           agents · spatialhash · steering · metabolism · lifecycle · substrate · verdict
/render/         scene · creature · material · post · atlasCard
/ui/             doc 21 — tank · compile · atlas · world · settings
/workers/        physics.worker · ecology.worker
/tests/          gate.js — trunk + per-layer assertions
```

---

## 4. Purity rules

**`/engine/**` is pure.** No DOM, no `window`, no `performance.now()`, no `Date`, no
`Math.random()`, no `async`, no imports from `/render/`, `/ui/`, `/trunk/`.

Every engine function is a function of its arguments plus an injected seeded RNG.

This is not stylistic. It is what makes worker parallelism possible in L2, makes
determinism testable, and makes headless benchmarking meaningful. It fails silently and
late if not enforced, so:

**QC assertion:** grep `/engine/` for `Math.random|Date\.|performance\.|window\.|document\.`
→ must return zero. Part of the standard gate (doc 20).

---

## 5. Determinism

| Scope | Promise |
|---|---|
| Morphogenesis | Deterministic everywhere, all devices |
| Naming | Deterministic everywhere — pure function of topology |
| L1 physics | Same device, same build |
| L2 records | Same device, same build |
| L3 ecology | **Deterministic everywhere** — no floating-point physics solver involved |
| Cross-device physics | **Not promised.** See below. |

L3 is fully portable because it contains no physics solver: fixed dt, seeded PRNG, and
arithmetic simple enough to be reproducible. L1 and L2 depend on Rapier's solver, which
is only conditionally deterministic across platforms.

**Consequence for sharing:** a shared specimen carries its genome *and* its compiled
record. The receiver replays L3 identically; if they recompile locally they may get
marginally different numbers. That is acceptable and should be surfaced as "recompiled
locally" rather than hidden.

`enhanced-determinism` in Rapier is flagged for investigation and may lift this. Do not
architect assuming it will.

### Seed derivation

One function, used everywhere:

```js
seed(...parts) = fnv1a(parts.join('|'))
```
Never `Math.random()`, never nested RNG state shared across components. Each probe, each
duel repeat, each lineage, each ecology run derives its own seed from stable strings.

---

## 6. Concurrency

| Work | Where | Why |
|---|---|---|
| L1 tank simulation | main thread | 6 creatures, rendered live |
| L2 probes and duels | `physics.worker` × N | embarrassingly parallel, purity guarantees safety |
| L3 ecology | `ecology.worker` × 1 | single long-running sim; main thread renders from a snapshot buffer |
| Rendering | main thread | |

Workers receive `{ genome, world, seed, probeId }` and return measurements. **No shared
mutable state**; transfer by structured clone. `N = min(navigator.hardwareConcurrency − 1, 4)`.

L3 posts a compact snapshot (positions, species, mass) at render rate while continuing to
tick ahead; the UI never blocks on the simulation.

---

## 7. Units and conventions

Fixed once. Every layer obeys. Most of the expensive bugs in a system like this are unit
mismatches at a boundary.

| Quantity | Unit | Note |
|---|---|---|
| Length | metres | body dims 0.2–2.0 m |
| Mass | kilograms | derived: density × volume |
| Density | **relative to water** | water 1.0, air 0.0012, bodies 0.15–1.8 |
| Time | seconds | |
| Physics step | 1/120 s | fixed, substepped |
| L3 tick | 0.1 s | fixed |
| Angle | radians | |
| Energy / work | joules | `Σ|τ·ω|·dt` |
| Power | watts | |
| **L3 mass ≡ energy** | kilograms | one quantity; see 12 §3 |

**Coordinate convention:** Y is up, right-handed. Gravity is `(0, −9.81, 0)`. A creature's
forward axis is +Z of its root body. L3 is 2D and uses the XZ plane, so "up" is dropped
rather than remapped.

**Cross-layer conversion:** none. L2 measures in SI and L3 consumes SI. There is
deliberately no scaling factor anywhere, because a scaling factor is a place for an error
to hide.

---

## 8. Versioning

Four independent version numbers, each with a distinct invalidation consequence:

| Version | Bumps when | Invalidates |
|---|---|---|
| `GENOME_V` | genome schema changes | requires migration; old genomes must load |
| `BRIDGE_V` | any probe, reduction, or duel rule changes | all cached records — recompile |
| `ECOLOGY_V` | L3 rules change | stored run results (kept, marked stale) |
| `APP_V` | any build | nothing; display only |

`APP_V` is the single build identifier and must be unique per build — generated by the
build script, never edited by hand, and identical in the manifest, the service worker,
and the settings screen. Doc 20 owns the mechanism.

**Migration:** a registry keyed by `GENOME_V`, run forward on load. Write the `1 → 2`
no-op migration immediately so the mechanism is exercised before it is needed. A genome
with a version above the current build is **rejected with a clear message**, never
partially parsed — genomes will arrive from the future via shared files.

---

## 9. Error philosophy

**Engine code does not throw for domain outcomes.** A creature that cannot move, cannot
win a duel, or dies immediately is not an error — it is an answer. These produce valid
records with honest numbers.

Exceptions are reserved for contract violations: world mismatch, version mismatch,
malformed genome, `vs` matrix not dense.

**Every failure is legible.** Any invalid record carries `invalidReason`. Any rejected
run states which invariant failed. Silent degradation is the enemy, because in a
generative system a bug and a boring result look identical.

---

## 10. Performance budgets

| Layer | Target | Fallback ladder |
|---|---|---|
| L1 tank | 6 creatures × ≤24 bodies, 60 fps | 1/60 with 2 substeps → cap 16 bodies → 4 creatures → reduce post |
| L2 compile | ≤ 3 s wall across 4 workers | fewer repeats → fewer residents → coarser sampling |
| L3 | 2 000 agents @ 60 fps; 8 000 headless @ ≥10× | reduce agents → raise tick dt → render every Nth tick |
| Cold start | < 2 s to interactive | defer Rapier wasm until the tank is entered |

Instrument from the first build. All three budgets are surfaced on the developer screen.

---

## 11. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Physics | Rapier (WASM), pinned exactly | joints with motors, fixed step, determinism flag |
| 3D | three.js | |
| L3 render | 2D canvas or instanced points | thousands of agents, one draw call |
| Storage | IndexedDB via trunk adapter | localStorage quota is too small |
| Build | single-file-per-module ES modules, no framework | matches existing project practice |
| i18n | trunk `t()`, FR + EN | |

**No UI framework.** The UI is small, the navigation model is an explicit stack (doc 20),
and a framework would add build complexity for no benefit at this size.

---

## 12. Explicitly not in the architecture

No server, no accounts, no auth, no analytics, no network calls at runtime, no
cross-device sync, no cloud, no ads, no telemetry. Sharing is files.

The trunk defines a sync *interface* with a no-op implementation so that a future
addition does not require touching callers. It is not implemented.
