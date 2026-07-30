# VIVARIUM — 21 · User Interface

| | |
|---|---|
| **Status** | Normative |
| **Supersedes** | `VIVARIUM_UI_FUNCTIONAL_SPEC.md` — retained on disk, no longer authoritative |
| **Changes** | Extended to all three layers · rescoped to the vertical slice · tank layout decided · Atlas restructured as the species registry · compile and world screens added |
| **Reads** | 00 Vision R2 · 03 Contracts · 20 Trunk · 30 Plan |
| **Revision R3** | Conditions screen removed from the slice · Atlas UI removed from the slice · slice column in §3 corrected. 30 Implementation Plan is authoritative on slice scope where the two differ. |

Functional only. Screens, controls, states, gestures. No colours, no type, no spacing —
those are the B5 art pass.

---

## 1. Phone-first constraints

1. **Thumb zone.** Primary actions live in the bottom 40%. The top bar carries context and navigation only, never a repeated action.
2. **Tap targets ≥ 44 pt** — including creatures; see §4.3.
3. **No hover.** Anything that would be a tooltip is either always visible or in a detail sheet.
4. **Chrome is expensive.** Simulation views are full-bleed; chrome floats over them translucently.
5. **Safe areas** honoured at the bottom; the view renders behind.
6. **One-thumb core loop.** Watch → select → breed must complete without moving the hand.

---

## 2. Navigation

Four tabs, each an independent stack (20 §4). Back pops the active stack; popping a tab's
root returns to Tank. Sheets are stack entries.

```
TANK      → Tank                       root
             ├─ Specimen sheet         modal
             └─ Compile                destination  ── the trial
                  └─ Duel replay       destination
ATLAS     → Species registry           root
             └─ Species page           destination
WORLD     → World                      root
             ├─ Conditions             destination
             └─ Run                    destination
                  └─ Verdict           destination
SETTINGS  → Cog menu                   root  (20 §9)
```

**Modal vs destination:** a modal is acted on and dismissed back to where you were; a
destination is somewhere you go. Modals never navigate onward.

---

## 3. Screen inventory

| # | Screen | Tab | Slice | Session |
|---|---|---|---|---|
| 1 | Tank | 1 | ✅ | B2 → B4 |
| 2 | Specimen sheet | 1 | ✅ | B4 |
| 3 | Compile | 1 | ✅ | C1/C2 |
| 4 | Duel replay | 1 | ✅ | C2 |
| 5 | Species registry | 2 | ❌ step F | — |
| 6 | Species page | 2 | ❌ step F | — |
| 7 | World | 3 | ✅ | D2 |
| 8 | Conditions | 3 | ❌ step F | — |
| 9 | Run | 3 | ✅ | D2 |
| 10 | Verdict | 3 | ✅ | D2/E1 |
| 11 | Cog menu | 4 | ✅ | A1 |
| 12 | Developer | 4 | ✅ | A1 |

Twelve screens; **seven in the slice.**

**Removed from the slice at R3.** *Conditions* — the slice runs one fixed world; live
edits invalidate compiled records, alter probe outcomes, and create world variants with
no `worldHash`. Fertility contrast has no meaning in L1, which has no substrate.
*Atlas* — specimens and records are stored correctly from B1 and derived naming is
written at B4, but the tab shows "not yet available" until step F. §7 below describes the
step-F design.

---

## 4. Tank

### 4.1 Layout

| Band | Content | Interactive |
|---|---|---|
| Top bar | world name · `Gen 34` · selection `2/6` · cog | cog only |
| Tank view, full-bleed | 6 creatures, live | ✅ |
| Control row, floating | Pause · Speed · Undo · Conditions | ✅ |
| Primary | **Breed** | ✅ |
| Tab bar | Tank · Atlas · World · Settings | ✅ |

### 4.2 Layout decision — **one shared tank, resolved**

The three candidates were a shared tank, six pods, or a grid of viewports. **Shared tank.**

Pause dissolves the objection that made it fiddly: the difficulty was tapping a moving
target, and freezing the simulation removes it entirely. Pods and viewports both trade
away the aquarium — which is the thing the game is selling — to solve a problem a button
already solves.

**Pause is therefore a mechanic, not a convenience.** It should be prominent and it should
be the first thing a confused player finds.

### 4.3 Controls

| Control | Type | Behaviour | Disabled |
|---|---|---|---|
| Creature | tap | toggle select; persistent ring | — |
| Creature | long-press 400 ms | Specimen sheet | — |
| **Breed** | primary | per 10 §17.3 + N17 + N18 | 0 selected |
| Pause / Play | toggle | freeze physics; camera stays live | — |
| Speed | cycle 1×/2×/4× | — | paused |
| Undo | appears after a breed | restore previous generation's genomes, re-instantiate from t=0 | no breed yet |
| Background | drag / pinch / double-tap | orbit / zoom / reset | — |

**Hit testing** ray-casts an invisible sphere sized to `max(boundingRadius, 44 pt at
current zoom)`. Nearest-to-camera wins. A small creature must never be harder to select
than a large one.

**Tap vs drag:** pointer-down moving < 8 px and released < 250 ms is a tap. Implemented
once in the 3D view component, never per screen.

### 4.4 States

```
LOADING · EMPTY · SIMULATING · PAUSED · BREEDING(600 ms) · SHEET_OPEN
```

The `BREEDING` beat is not decoration — without a visible transition the player cannot
tell whether anything happened.

**During BREEDING, mark each offspring with its parent's screen position.** This converts
"the screen refreshed" into "these came from that one", and it is the cheapest possible
fix for the review's point that nothing tells the player what changed.

**The stranger slot is visually marked** — different ring, small tag. The player must
understand where it came from or it reads as a bug.

### 4.5 Persistent per-creature label

One number, always visible: **speed**. Not a score, not fitness — a measurement. Without
it, a player selecting on looks alone in a game about locomotion is missing half the
subject.

### 4.6 First run

Auto-create a lineage. Three-step coach: *tap one you like → tap Breed → repeat.*
Dismissible, replayable from the cog. No tutorial beyond this — if the loop needs
explaining, the loop is wrong.

---

## 5. Specimen sheet

Half-height, draggable to full.

**Content.** Isolated 3D view, slowly rotating, own lighting — not a crop of the tank ·
derived binomial, italic until described · morphology stats · measured stats if compiled,
otherwise a Compile affordance.

**Controls.** Compile (primary, if not yet compiled) · Select/Deselect · Breed only from
this · Lock morphology · Describe (once compiled) · Close.

`Lock morphology` restricts mutation to the controller. "Keep this shape, try different
swimmers" is an intuitive wish and it costs one flag.

---

## 6. Compile — the trial

### 6.1 The screen is a grid, not a progress bar

Residents down one axis; the five reduced values across. Cells populate as workers
report. Progress is expressed in **duels completed**, never a percentage.

The player should be able to read *"I am losing badly to the ram"* before the compile
finishes.

### 6.2 Escalation — the review's warning, accepted

*"The wait is the spectacle" is an ambition, not a safe assumption.* The fiftieth compile
will not be compelling on novelty. So:

- **Run the most informative duels first** — unseen opponents before rematches.
- **Auto-play one duel live** while the rest run headless. One fight watched beats five summarised.
- **Flag surprises**: any result that inverts the expectation from mass and speed alone gets marked and is offered for replay first.
- **Skip is always available** and never penalised. Results still arrive.
- **Accelerate solved encounters** — once three repeats agree, stop running that pair.

### 6.3 Controls

| Control | Behaviour |
|---|---|
| Cell | tap → Duel replay at normal speed from its seed |
| Watch live | toggle the auto-played duel |
| Skip | finish headless, go straight to results |
| Capability card | the compiled record, readable |

### 6.4 Duel replay

Full-screen, deterministic from seed, free to replay. Controls: play/pause, scrub, 0.5×,
close. A one-line outcome caption: *captured in 4.2 s* · *stalemate* · *captured by
opponent*.

---

## 7. Atlas — the species registry *(step F; data model live from B1)*

**Restructured (00 R2 §6).** The Atlas is not a trophy cabinet. It is the registry of all
known species — shipped and player-bred alike — and it is how fauna is authored.

### 7.1 Registry

Two-column card grid. Each card: thumbnail · binomial · common name · habitat badge ·
**provenance** (`shipped` / `bred by you`) · `active fauna` marker if currently inhabiting.

Filters: habitat (world) · provenance · active only. Sort: recent · name.

### 7.2 Species page

Large isolated view · binomial, common name, note · morphology and measured record ·
world it was compiled in · matchup row against that world's fauna · lineage marker.

**Controls.** Start lineage from this · Export · Edit common name and note · Delete ·
**Add to / remove from fauna** *(step F, not in the slice)*.

*Start lineage from this* is what keeps the Atlas inside the loop rather than being a
graveyard.

### 7.3 Describe

Reached from the specimen sheet after compiling. Binomial is **read-only** — it is a fact
about the structure, not a label; if it were editable the derivation would be
decoration. Common name and note are the release valve.

Commit writes specimen + genome + record + world snapshot (a **value copy**, never a
reference) + 512 px thumbnail. Toast with Undo.

### 7.4 Slice scope

Minimal: a flat list, a species page, describe. No filters, no sort, no search, no share
card, no fauna editing.

---

## 8. World

### 8.1 World (screen 7)

Current world, its fauna as a strip of species cards, and a **Introduce** action.
Introduction: pick a compiled species, see the biomass budget convert to a population
count, confirm.

### 8.2 Conditions (screen 8) — **step F, not in the slice**

Sliders — medium density · drag scale · fertility contrast · tank bounds. Gravity is
displayed as a constant and is **not** a control (02 §1a).

**Changes apply live to the running lineage.** A creature evolved for dense water
flailing when the medium thins is one of the best things this app produces. An inline
note states that the lineage adapted to different conditions — information, never a
modal.

### 8.3 Run (screen 9)

Full-bleed 2D ecosystem view. Agents as points or simple shapes, coloured by species.
Population graph overlaid, one line per species, scrolling.

Controls: speed 1× / 10× / 100× (rendering skipped at 100×) · pause · **Skip to end** ·
tap an agent to see its species.

Time is shown in simulated units and as a fraction of `runDuration`.

### 8.4 Verdict (screen 10)

The screen the whole slice exists for.

**Sequence matters.** Show the outcome and the population graph, then a prompt:
*what do you think happened?* — with the causal readout behind one tap.

Per 00 R2 §11: if the readout is the only source of understanding, the UI is
manufacturing comprehension rather than reporting it. The prompt is how that gets tested,
and it is cheap enough to keep permanently.

**Content.** Verdict classification · population graph with the decisive moment marked ·
one generated sentence tying the outcome to a *measured* capability — *"your species
established, then collapsed: at 0.31 m/s it could not reach the fertile patches before
its energy reserve ran out"* · which lineage and generation produced it.

**Controls.** Reveal explanation · **Back to this lineage** (primary) · Run again with
same seed · Describe this species.

*Back to this lineage* returns to the Tank with that lineage loaded and ready to breed.
**This single button is what closes the loop** and is the deliverable of session E1.

---

## 9. Global gestures

| Gesture | Meaning |
|---|---|
| Tap | select / activate |
| Long-press 400 ms | detail for the pressed object |
| Drag > 8 px | orbit camera (3D views) |
| Pinch | zoom |
| Double-tap | reset camera |
| Swipe down from sheet top | dismiss |
| Swipe horizontal | *reserved* — specimen paging, later |
| System back | pop stack |

---

## 10. Deliberately excluded

- **No evolution-algorithm controls.** No mutation-rate slider, no population size. The player tunes the world and their own taste. Exposing the algorithm turns a game into a tool — which is the thing there are already too many of.
- **No numeric fitness.** There is no fitness function; inventing a score to display would misrepresent the system.
- **No confirmation dialogs.** Destructive actions execute and offer undo (N14).
- **No onboarding beyond three lines.**
- **No account, no login, no network.**
