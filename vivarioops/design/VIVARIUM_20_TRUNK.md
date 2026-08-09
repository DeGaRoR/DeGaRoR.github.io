# VIVARIUM — 20 · Common Trunk

The layer that gets rebuilt from scratch in every project (PTIS, RECYCLE, ROBOCLASH,
Gronosaures, Écurie) and should stop being rebuilt.

| | |
|---|---|
| **Status** | Normative |
| **Supersedes** | `SHELL_SPEC.md` — retained on disk, no longer authoritative |
| **Changes from SHELL_SPEC** | Tiers renumbered to match the vertical slice (S/1/2/3, was 1/2/3) · §3 Non-negotiables added and made executable · §7 bench harness added · §8 changelog and version uniqueness specified · §9 PWA cog menu specified |
| **Reads** | 00 Vision R2 · 01 Architecture |

---

## 1. Method

The trunk is **not built standalone.** It is built inside this game, in its own
directory, under one hard rule: nothing in `/trunk/` may import from game code.

The review's warning is accepted: *"reusable later" is a common source of cathedral
architecture.* So the trunk is built in tiers pinned to the vertical slice, and
extraction is not attempted until a second project needs it.

**Rule: nothing above Tier S is built until slice step E — the return to breeding — works
end to end.**

---

## 2. Tiers

| Tier | Contents | When |
|---|---|---|
| **S** | seeded RNG · screen stack · storage adapter · genome serialisation · developer panel · gate harness skeleton | slice step A |
| **1** | i18n · UI chrome (top bar, ribbon, sheet, toast) · save migration · design tokens | after E |
| **2** | profiles · export/import · share card · sync interface (no-op) | after F begins |
| **3** | PWA manifest · service worker · full QC completion pass · changelog UI | last, before first deployment |

Tier S is deliberately thin. It contains only what the loop cannot run without.

**i18n is in Tier 1, not S.** This is a change from SHELL_SPEC, which put it on day one.
The reasoning still holds — `t()` touches every file — but the slice has perhaps thirty
strings, and mechanically wrapping them at step E is an hour. Deferring it keeps step A
genuinely minimal. The `t()` call is still used from the first string written; only the
dictionaries and the language switch are deferred.

---

## 3. Non-negotiables — enforced, not documented

These are the rules that fail silently and late. Each has an executable check in the gate
(§6). A rule without a check is a suggestion, and suggestions decay.

### Engine purity

| # | Rule | Check |
|---|---|---|
| N1 | No `Math.random()` anywhere in `/engine/` | grep → 0 matches |
| N2 | No `Date`, `performance.now()`, `window`, `document` in `/engine/` | grep → 0 matches |
| N3 | `/engine/` imports nothing from `/render/`, `/ui/`, `/trunk/` | import graph scan |
| N4 | No allocation inside any tick or step loop | manual review + heap-growth assertion over 10⁵ ticks |

### Determinism

| # | Rule | Check |
|---|---|---|
| N5 | All randomness derives from `seed(...parts)`; no nested shared PRNG state | grep for PRNG construction outside `rng.js` |
| N6 | Morphogenesis is deterministic: same genome + seed → identical body plan | assertion |
| N7 | L3 is deterministic: same seed + species table → identical state hash at tick 10⁵ | assertion |

### Data integrity

| # | Rule | Check |
|---|---|---|
| N8 | No `localStorage` / `sessionStorage` anywhere | grep → 0 matches |
| N9 | Every stored record carries `{ schemaVersion, profileId, updatedAt }` | write-path assertion |
| N10 | A genome whose version exceeds the build is **rejected with a message**, never partially parsed | assertion |
| N11 | Specimens are stored as genome + seed + worldId. Never baked geometry. | write-path assertion |
| N12 | L3 total mass drift = 0 over 10⁵ ticks | assertion |
| N13 | A capability record is rejected if `worldId` or `bridgeVersion` mismatches | assertion |

### Interaction

| # | Rule | Check |
|---|---|---|
| N14 | No `confirm()`, `alert()`, `prompt()`. Destructive actions execute and offer undo. | grep → 0 matches |
| N15 | Every user-visible string passes through `t()` | heuristic DOM scan for untranslated literals |
| N16 | No hex colours or raw pixel values in components; tokens only | grep components for `#[0-9a-f]{3,6}` |

### Game-rule invariants

These are not infrastructure. They are design decisions with a history of being
quietly lost, so they are pinned here where the gate can see them.

| # | Rule | Rationale | Check |
|---|---|---|---|
| N17 | **One tank slot is always an unrelated random genome.** | Breeding by taste over six individuals converges to a single animal within ~5 generations. Certain, not probable. | assertion on generation composition |
| N18 | Selected creatures survive unchanged as elites. | Without it, a creature you liked can vanish in one tap and the loop is punishing. | assertion |
| N19 | The motor torque **budget** scales with **cross-sectional area**, not mass. | Mass goes with volume, strength with area. Getting this wrong makes all creatures move alike regardless of size. | assertion on two scaled genomes (L1-18, on the budget) |

> **N19 amendment — C1.1 (B3).** N19 governs the torque **budget** (the peak
> torque a joint is allowed: `MUSCLE_STRESS · A^1.5 · momentArm`, geometric, never
> mass), and NOT the **response shape** — the `(ωₙ, ζ)` that decide how the joint
> tracks its target inside that budget. The reference actuator derives that
> response from the limb's inertia (`SpringFrequency 10 Hz`, `DampingRatio 0.9`
> against `MaxImpulse = 2·MinCrossSectionalArea`), and doing so does not violate
> N19: a heavier limb accelerates less under the same torque, but the peak torque
> it is allowed is unchanged. L1-18 therefore asserts N19 on the budget and
> permits the gain to be inertia-shaped. Original wording ("motor strength scales
> with cross-sectional area") predates the reference parametrisation and read the
> gain and the budget as one quantity, which they no longer are.
| N20 | Joint parity: an odd number of mirrorings flips orientation sign. | Mirrored limbs bend the wrong way; very hard to trace. | assertion |
| N21 | L3 steering is clamped by measured `turnCapability`. | This single clamp carries most of the creature's physical identity into the ecosystem. | assertion |

> **N21 AMENDED 2026-08-08, `BRIDGE_V` 6 → 7: the clamp moves from `turnRate` to
> `turnCapability = turnRate3d × steeringAuthority`.**
>
> `turnRate` is the YAW component. A chain bends about its limbs' local X and turns
> in **pitch**, where a compass bearing is identically zero, so the original field
> "reads near-zero for exactly the bodies that turn best" (`SESSION-10.md:601`).
> Measured: `eel-fast` reads yaw 0.00 in both bias directions while turning in 3-D
> at 1.09 °/s with full authority — N21 would have granted it nothing. And `eel`
> reads the same yaw 22.50 °/s as `eel-unison` while being unable to steer at all
> (45 °/s with +bias, 0 with −bias, always the same axis) — N21 would have granted
> those two the same budget.
>
> `SESSION-10` §152 registered `turnRate3d` and `steeringAuthority` but deliberately
> left N21 on yaw, "because changing what N21 clamps by is a separate decision with
> its own consequences". It is now forced: `tools/_zlight.mjs` measures taxis
> correlating with `turnRate3d` at **r = 0.91** and with the sensor gain at **0.07**,
> so turn capability is the quantity the ecosystem will select on. A clamp on the
> wrong axis would cap the wrong animals.
>
> `turnRate` is **kept** as a diagnostic and is still recorded. It is no longer what
> N21 reads.
| N22 | Ground and wall contacts never damage; only creature–creature contacts do. | Otherwise everything dies on landing. | assertion |

---

## 4. Screen stack and back button

Screens are pushed onto an explicit **stack**, never swapped by a `currentScreen`
variable.

- Each push calls `history.pushState({ depth })`; a `popstate` listener pops.
- Android hardware back, browser back, and sheet dismissal all then work with no special cases.
- Modals and bottom sheets are stack entries.
- Tabs are stack roots; each tab preserves its own stack.
- Popping the last entry of a tab returns to the primary tab, never a blank app.
- Deep links reconstruct the stack rather than jumping to a leaf with empty history.

---

## 5. Storage

IndexedDB via a single async adapter: `get / set / delete / list`. Keys:
`profile:<id>` · `vivarium:<id>` · `lineage:<id>` · `specimen:<id>` ·
`record:<genomeHash>:<worldId>` · `world:<id>` · `run:<id>`.

Quota-exceeded is a handled error with a user-facing message.

**Migration:** a registry keyed by `GENOME_V`, run forward on load. Write the `1 → 2`
no-op immediately so the mechanism is exercised before it is needed.

---

## 6. Gate harness

One runner, invoked from the developer screen and from the build script. Reports
pass/fail per assertion with the failing value.

```
gate/
  trunk.js      N1–N16
  l1.js         morphogenesis, mutation viability rate, parity, naming purity
  l2.js         determinism, cache soundness, monotonicity, symmetry, proxy fidelity
  l3.js         mass conservation, determinism, Lotka–Volterra lag, trophic pyramid
  app.js        icons present, i18n key parity, screens reachable, version consistency
```

**The gate is green before a zip is produced.** No exceptions. This is the PTIS/ROBOCLASH
methodology and it is the reason those projects stayed tractable.

Two diagnostics that are not pass/fail but must be reported every run, because in a
generative system a bug and a boring result look identical:

- **mutation viability rate** — below 60% means the operators need retuning, not the game
- **L2 proxy fidelity** — observed capture rate in 100 full-physics duels versus recorded `pCapture`

---

## 7. Bench harness

Separate from the gate. Measures rather than asserts.

```
bench/
  l1.js    physics step time vs body count; frame time at 6 creatures
  l2.js    wall time per probe, per duel, per full compile
  l3.js    tick time vs agent count (100 … 8000); allocation growth
```

**Hydration-aware.** The lesson from ROBOCLASH's `tools/bench.js` is written into this
spec: *measurements taken on an unhydrated or headless-but-differently-configured system
are meaningless.* Each bench must run against the same construction path the real app
uses — same world, same genome hydration, same worker setup — or it must declare itself
synthetic in its output.

Results append to `bench/history.jsonl` with `APP_V` and device string, so regressions
are visible across builds rather than felt.

---

## 8. Versioning and changelog

### Four version numbers

Per 01 Architecture §8: `GENOME_V` · `BRIDGE_V` · `ECOLOGY_V` · `APP_V`.

### APP_V uniqueness — one source, machine-generated

The failure mode being prevented: a manifest, a service worker, and a settings screen
disagreeing about what build is running, so a bug report cannot be located.

```
version.json          ← the ONLY source of truth. Written by the build script.
{ "app": "0.4.12", "build": "2026-07-29T22:14:03Z", "commit": "a3f19c2",
  "genome": 3, "bridge": 2, "ecology": 1 }
```

- Generated by `tools/build.js`. **Never hand-edited.** A hand edit is a gate failure.
- `app` is `major.minor.patch`; patch auto-increments per build.
- Injected at build time into the manifest, the service worker cache name, and `trunk/version.js`.
- Gate assertion: all three report the same string, and the string is not already present in `CHANGELOG.md` unless the commit matches.

### Changelog methodology

`CHANGELOG.md`, newest first, one entry per build that ships.

```
## 0.4.12 — 2026-07-29
### Added
- L2 duel replay from matchup grid
### Changed
- Node density range widened to 0.15–1.8 (worlds R2)
### Fixed
- Joint parity on doubly-mirrored connections
### Gate
- 71 assertions, 0 failures
```

Rules: an entry exists for every version that leaves the machine · the `Gate` line is
pasted from the harness output, not typed · a version number is never reused, including
after a failed build · the settings screen renders this file directly, so it is written
for a reader rather than for a repository.

---

## 9. PWA maintenance and the cog menu

Deferred to Tier 3. **The service worker is not enabled until the game works** —
cache invalidation during active development is the misery that produced SW v55–v62 on
ROBOCLASH.

When it goes in:

- Precache everything; the app is small and offline-complete is the point.
- Cache name derives from `version.json`; a new build is a new cache.
- Explicit update flow: detect a waiting worker → toast → reload on tap. **Never a silent swap.**
- Icons generated from one source image by script, never hand-exported.

### The cog menu

A single settings affordance, consistent across projects, reachable from the top bar on
every screen. Contents, in order:

1. Language
2. Profile name
3. Storage used · Clear data
4. Export / Import
5. Replay intro
6. **Version** — `app` string, build timestamp, commit; tap to open the changelog
7. **Update** — check for new version, shown only when a worker is waiting
8. **Developer** — hidden until seven taps on the version row

Developer screen: run gate (pass/fail list) · run bench · FPS and step times · seed
override · generate N random genomes and report viability rate · dump current genome ·
force SW update · clear caches.

---

## 10. Directory contract

```
/trunk/
  rng.js         seeded PRNG; the only place a PRNG is constructed
  nav.js         screen stack, popstate, tab roots
  store.js       IndexedDB adapter + migration registry
  version.js     generated; do not edit
  i18n.js        t(), dictionaries              (Tier 1)
  ui/            topbar · ribbon · sheet · toast · tokens.css   (Tier 1)
  profiles.js    (Tier 2)
  transfer.js    export/import                  (Tier 2)
  sync.js        interface + no-op impl         (Tier 2)
  share.js       card renderer                  (Tier 2)
  pwa.js         SW registration, update flow   (Tier 3)
  qc.js          app-level completion checks    (Tier 3)
/locales/  en.json  fr.json
/gate/     trunk.js l1.js l2.js l3.js app.js
/bench/    l1.js l2.js l3.js history.jsonl
/tools/    build.js  icons.js
```

**Hard rule:** `/trunk/` imports nothing from outside `/trunk/`. If it needs game
knowledge it takes it as a parameter. Violating this once makes extraction pointless.
