# External review — verification & triage (build e44)

Companion to `EXTERNAL_REVIEW_e44.md`. Every concrete claim was checked against
the source. Verdicts: **CONFIRMED** (reproduced in code), **CONFIRMED w/ nuance**
(true, but severity or framing needs adjustment), **DESIGN CALL** (factually
correct, but "defect vs intent" is the owner's decision), **OPINION** (sound but
a judgement, not a bug). Line numbers are build e44.

## Headline: the reviewer is accurate.
Of the concrete, checkable claims, **all checked out in code**. This is a
high-quality review — not a generic AI pass. A few items need severity nuance
(below), but nothing was a false alarm on the facts.

## Progress log
- **QC environment**: the harness (`tools/`) expects a two-folder layout
  (`pwa/` source + generated `engine.js` sibling). This repo keeps the game at
  the `battlebotsPWA/` root. Runs from an **isolated scratch root** (junction
  `pwa/` → source + a real copy of `tools/`) so `extract.js` generates its Node
  engine into scratch, never onto the source. Baseline: **670 pass / 1 fail**.
- **Baseline's 1 failure is pre-existing & benign**: three orphan icon files
  (`assets/icon-180.png`, `assets/icon-192.webp`, `assets/icon-512.webp`) sit
  loose in `assets/` but aren't in the SW precache (real icons live in
  `assets/icons/`). Unrelated to the review — cleanup candidate.
- **Correction to my own earlier claim**: I briefly reported an unguarded
  `module.exports` "browser bug" in engine.js. That was **wrong** — it was an
  artifact of a bad self-junction that made `extract.js` write onto the source.
  The committed engine.js is pristine (0 exports, ends at `// ENGINE-END`).
- **P0-1 — FIXED & verified.** Guard at `engine.js:1033`
  (`batteryMax>0 ? clamp(...) : 0`, mirroring `:575`). Homologation now rejects a
  worn-out core: `functionalCheck` tests injected `build.eff` (`app.js:~1904`),
  `eff` injected at the engage gate + ligue CT (`app.js:~2457,~2773`), new i18n
  `ct_worn` (FR+EN). Node repro flips NaN→finite; gate unchanged at 670/1.
- **P1-b — FIXED.** `bracket.init(seed, size)` now data-driven: rivals=size−1,
  rounds=log2(size), power-of-two validated; `roundName` derived from entrants;
  engage passes `tr.size`; bracket-view columns = rounds+1. `cupS`/`ouvS2` run a
  true 8-tree (Quarts→Demi→Finale). Gate 670/1.
- **P1-c — FIXED.** Exhibition (`curMode==="exhib"`, incl. calibration) pays no
  per-bout bolts (`earned=0`) and no longer increments `S.beaten` — only the
  qualifier progresses. Farming loop closed. Gate 670/1.
- **P1-d — FIXED.** `makeSeg` no longer mutates the pilot on render; new
  `effectivePilot(bot)` maps software-locked controls to `PILOT_DEF` (real
  default, not `OPTS[key][0]`), consumed at combat build. Stored pilot untouched.
- **UI/i18n batch — FIXED.** Removed `user-scalable=no`; `<html lang>` tracks the
  language at boot + on toggle; `invEmpty` deduped (kept active msg — semantic
  split of the two distinct messages left as a follow-up); save-version label now
  derived from `SAVE_V` (`"v5 · instances"`), no longer stale.

- **P0-2 + P1-a — FIXED & proven.** Bots carry a stable `botId` (minted in
  defaultState/runtime pushes, backfilled in `bootSanitize`). `snapshotBuild`
  freezes `botId` + the **real** validated layout (`layoutOfBot`, not
  `autoArrange`). `startMatch` resolves the **engaged** bot by id
  (`combatBot`), and a single `match.player` envelope drives eff, pilot,
  renderer layout, and visuals — nothing in the match loop reads `S.activeBot`,
  `getLayout()`, or `S.customize` anymore (incl. the per-frame enemy
  `autoArrange`, now cached). `applyMatchDamage` writes to the engaged bot.
  jsdom probe: engaged B1, active switched to B2 → damage resolves to **B1**
  (`FIX_OK:true`). Gate 670/1. *Known minor edge:* pilot lock-tier still reads
  the active bot's software; harmless unless active is switched mid-locked-cup.

- **P0-3 — FIXED (per owner: real migration).** `migrate()` replaces the
  reject-foreign-schema policy: chain v4→v5→v6, non-destructive. v4→v5 moves the
  global `S.settings` pilot onto each bot; v5→v6 formalises `botId`. Raw state is
  backed up (`roboclash_s4_bak_vN`) before transforming; unknown/future versions
  → explicit `SAVE_RESET_NOTICE` toast, never a silent wipe. `SAVE_V=6`; version
  label + QC fixture (`SAVE_V_FIXTURE`) + README invariant + the four stale
  "no-migration" comments all updated. jsdom probe: a v4 save (bolts 777, global
  pilot) loads with bolts preserved, pilot migrated, backup written, no errors.
  Gate 670/1 (+ SW `CACHE` bumped v80→v81 per release rules).

- **Architecture (Option 1+2) — DONE.** *Phase A (decoupling, in `app.js`):*
  `saveState` no longer swallows errors (logs + one-time toast, returns status);
  career name rendered via `textContent` not `innerHTML` (self-XSS closed);
  `partFx`'s false "always accurate" comment corrected (catalog hints, not
  `PHYS`). *Phase B (extraction, no bundler):* `geometry.js` (358 lines,
  footprint/layout) and `render.js` (872 lines, registries/composite/colliders/
  CG/editor-draw/primitives) split out as ordered classic scripts loading
  `data→engine→geometry→render→app`. `app.js` 4123 → **2911 lines (−29%)**.
  Gate green after each step (670/1); `qc_ui.js` S17 check updated to span the
  split files; `CACHE`→v84. Note: this is navigability, not decoupling — globals
  stay shared (inherent to no-bundler); Phase A handled the real coupling smells.
  A botched interactive paste emptied `app.js` mid-B2; restored from backup and
  re-run via the tool (single command string) — no loss.

- **Partial items — now CLOSED.** (1) *Finite-state invariant test*: added
  `safe("invariants d'état fini (anti-NaN)")` to `tools/qc_engine.js` — steps the
  battery/motor/grip-at-zero cases 120 ticks each, asserts finite pos/vel/angle/
  battery/hp/throttle. Proven a real guard: reverting the engine `frac` guard
  makes it fail at `[batterie morte @tick1]`; restored → green (moteur 142→143).
  (2) *`invEmpty` semantic split*: restored the shop message as `invShop` for the
  add-part picker (it sits beside a "go to shop" button), kept `invEmpty`
  ("everything fitted") for the inventory strip. FR/EN parity holds.

- **Owner-reported bug — FIXED: used-bot ("occasion") thumbnail drew components
  but NO chassis hull.** *Two distinct issues (I initially misdiagnosed — the fit
  work below was real but was NOT why the hull was missing; the owner caught it):*
  - **Actual chassis-render cause:** the thumbnail built the preview with
    `color: o.color || null`, and `drawChassisBoard` (render.js) only draws the
    hull SPRITE when a color is truthy (`if(color && chassisSpriteReady)`).
    Components have vector fallbacks so they drew; the hull didn't. Garage bots
    always carry `customize.color`, and the *bought* bot gets `#d98a45` from
    `bareBot` — which is why buying showed the hull but the preview didn't. Fix:
    preview with the factory colour it will have when bought
    (`o.color || DEFAULT_CHASSIS_COLOR`). Confirmed visually against the REAL
    thumbnail canvas — hull now renders.
    - **Why it looked unfixed at first (SW cache):** the source fix was correct,
      but the PWA service worker (cache-first) kept serving a stale `app.js`
      (cached at CACHE v84, before the colour edit), so the browser never ran the
      fix. Bumped `CACHE`→v85 (ships it to clients) and cleared the SW to verify.
      Lesson: browser checks of edits made after the last CACHE bump can be masked
      by the SW; the QC gate isn't (it runs from source, no SW).
  - **Related correctness fix (bought-bot validity):** `refreshUsedBot` also
    picked parts ignoring chassis class, so an S hull got M parts → `__nofit`
    (the *bought* bot would have been un-layoutable). Fixed: gamme-based selection
    (never top gamme — list-position was stale since micro ids are appended last),
    `repairFit` micro substitution, and a guaranteed base-kit fallback re-checked
    on a FRESH build. Verified across all 23 buyable chassis × 12 selections (0
    non-fitting). QC: stale "jamais le top-tier" check → gamme-based, plus a new
    "l'offre RENTRE sur sa coque" guard. Gate green (interface 229).

## P0 — release-blocking

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| P0-1 | Worn-to-zero battery → `0/0` → NaN spreads to pos/vel | **CONFIRMED** | `engine.js:1033` `const frac = bot.battery / bot.batteryMax;` with `batteryMax:st.energy` (`:437`) able to be 0. The *guarded* form already exists at `:575` (`bot.batteryMax ? … : 0`) — the drain path just wasn't given the same guard. One-line fix + inspection reject. |
| P0-2 | Locked competition fights one bot, wears/damages another | **CONFIRMED** | Build geometry DOES come from the lock (`:3163-3170`, S20 fix). But wear reads the **active** bot: `playerBuild.eff = buildEff(AB())` (`:3179`), and damage writes the active bot: `applyMatchDamage` → `const bot = AB()` (`:2133`). Lock has no botId / instance UIDs. Exploit is real. Reviewer's mechanism description is exact. |
| P0-3 | `SAVE_V` bumped with no migration; other schemas discarded | **CONFIRMED w/ nuance** | `SAVE_V=5` (`:38`); `validState` rejects `st.v!==SAVE_V` (`:89`); mismatch → fresh state (`:193`). BUT this is a **deliberate, documented** pre-release choice (`:36-37`, `:211-213`) that directly contradicts the README invariant "jamais de bosse de SAVE_V sans migration". So it's a real doc/code contradiction, not an accident. Severity "saves silently disappear / user trust" is overstated for a single-player pre-release with no shipped users — but silent discard is bad hygiene. Cheap correct win: show an explicit "save reset" notice instead of silently starting over. Decide: update the invariant, or write v4→v5. |

## P1 — significant

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| P1-a | Snapshot freezes `autoArrange`, not the player's real layout | **CONFIRMED** | `snapshotBuild` (`:2434`): `layout:autoArrange(b)` — manual placement discarded. Violates the project's own "placement travels with the bot" invariant. |
| P1-b | 8-entry cups actually run as 16 | **CONFIRMED** | `cupS`/`ouvS2` declare `size:8` (data.js `:455,:505`); `bracket.init(seed)` ignores size, hardcodes 15 rivals + `rounds:4` (`:2528-2533`); label shows "arbre "+(tr.size||16) → "arbre 8" (`:2560`). UI lies about the tree. |
| P1-c | Calibration/free-fight pay & progress despite "no reward" | **CONFIRMED** | Generic per-bout bolts credited for EVERY match at `:3732`, before the mode branch (`:3741`). `purseMult:0` only zeroes the completion prize (`:3764,:3786`), not per-bout. Free-fight win does `S.beaten++` in the qual/exhib else-branch (`:3801`). Farming loophole is real. |
| P1-d | `makeSeg()` mutates pilot on render | **CONFIRMED** | `:447` `if (PILOT()[key] !== ENGINE.OPTS[key][0]) PILOT()[key] = ENGINE.OPTS[key][0];`. Author already flags it as a trap (`:292-295`). Rendering mutates persisted gameplay state. |
| P1-e | Orbit target computed then always overwritten | **CONFIRMED (by project's own logbook)** | README "DETTE connue (S27)" documents it: overwritten 5820/5820. Not re-derived here; taking the project at its word. |

## Physics

| Claim | Verdict | Evidence |
|---|---|---|
| Contact push force is non-conservative | **CONFIRMED (fact) / DESIGN CALL (defect?)** | `:1157-1160` adds `f` to `foe.vel` only; no equal-and-opposite on the pusher. Contrast the collision *impulse* at `:1123-1124`, which IS conservative (both bots updated). So momentum is created on the shove path. Factually a non-conservative force. Whether that's a bug or intentional "shove" game-feel is a design decision — but it does undermine mass-ratio reasoning and tuning. |
| No angular impulse from collisions; deepest-pair not manifold; no load transfer; ballast `cogFactor` multiplicity in headless | **PLAUSIBLE, not all re-verified** | Modeling-depth observations, mostly non-urgent. The ballast/headless divergence is worth a targeted check because it can make the QC bench disagree with the browser. |

## UI / i18n (all CONFIRMED, low-effort)

- `<html lang="fr">` never updated on language switch — index.html `:2`; lang toggle (`:4031`) sets `LANG`/`S.lang` but not `documentElement.lang`. **CONFIRMED.**
- `user-scalable=no` disables zoom — index.html `:5`. **CONFIRMED** (accessibility).
- `invEmpty` declared twice in *each* language object — data.js `:56` and `:147` each contain it 2× (verified by count). First value is dead. **CONFIRMED** (I suspected the reviewer was wrong here; checked; they're right).
- Non-semantic `div` controls, missing focus/aria, hard-coded French labels — **CONFIRMED** by inspection (e.g. lang opts are `div.rc-seg__opt`, `:204-205`).

## Architecture (OPINION — sound, but judgement calls / large effort)

- `app.js` god-module, presentation-does-mutation, multiple sources of truth, silent `saveState` catch, career-name `innerHTML` injection, dual CSS systems, fragile SW release. All fair diagnoses. The proposed 12-file split is a big undertaking; a lighter consolidation (extract persistence + a single `hydrateBotForMatch` + a match envelope) captures most of the safety benefit for far less risk. Owner's call on scope.

## Where I'd push back / add nuance
1. **P0-3 severity.** Real contradiction, but not "release-blocking" for a pre-release single-player build with no shipped saves. Reframe as: pick a policy and make the README and code agree; add a visible reset notice.
2. **Non-conservative push** is correctly identified but is a *design* decision, not an unambiguous bug — needs a measured call at the simulator, like the project handles its other physics choices.
3. Everything else: the reviewer earns trust. Fix the cheap CONFIRMED items first.

## Suggested order (cheap→structural)
1. P0-1 battery guard + inspection reject (tiny, pure engine, testable).
2. P1-b bracket size data-driven (contained, data + one format fn).
3. P1-c reward/progression policy (move per-bout payout inside the mode branch; gate `S.beaten`).
4. P1-d remove mutation from `makeSeg` (read-through fallback, don't write PILOT()).
5. UI/i18n batch: `documentElement.lang`, remove `user-scalable=no`, dedupe `invEmpty`.
6. P0-2 match envelope: give bots a stable id, bind wear+damage to the engaged bot.
7. P1-a snapshot the real validated layout.
8. P0-3 save policy decision + visible reset.
9. Orbit + non-conservative push: fix behind a flag, re-run the bench.
10. Architecture consolidation (scoped).
