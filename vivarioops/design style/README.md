# Handoff: Vivarium global UI styling + creature render direction

Target codebase: `vivarioops` 0.7.1 (`trunk/`, `ui/`, `render/`, `worlds/`).
Design source: `Vivarium Style Proposal.dc.html` (in this bundle, `reference/`).

---

## Overview

Two artifacts, deliberately separate:

1. **A chrome system** — a fixed, authored dark UI for the phone-first shell: surfaces,
   signal colours, a two-face type system, geometry and motion. Lands as tokens.
2. **A creature presentation contract** — rules that constrain *generated* appearance
   without authoring any instance of it: a per-world colour ramp the hue gene indexes,
   procedurally generated material maps, a three-layer body, and bioluminescence as a
   rare inheritable trait.

Nothing here touches L1/L2/L3, the genome schema, or any gate. The whole proposal is
presentation, which is why it can land while B3/B4 are unsigned.

## About the design files

The files in `reference/` are **design references created in HTML** — a prototype
showing intended look and behaviour, not production code to copy. `Vivarium Style
Proposal.dc.html` is a live three.js sandbox used to argue the render direction;
it is not structured like the target codebase and should not be ported.

The files in `implementation/` are different: they are **written against the real
`vivarioops` APIs** (`BodyPlan` from `morphogenesis()`, `genome.material`,
`token()` reads, N16 rules) and are intended as drop-in starting points for
`render/creature.js`, `trunk/ui/tokens.css` and `worlds/*`. Treat them as a first
implementation to review and adapt, not as sacred text.

## Fidelity

**High-fidelity for chrome** — exact colours, type sizes, weights, radii, spacing and
motion values are given below and are final unless you disagree with them.

**Directional for creatures** — the *rules* are final (ramp indexing, layer stack,
luminosity threshold, per-segment emissive). The specific material coefficients
(transmission 0.14, sheen 0.35, iridescence gain 0.8, etc.) are tuned by eye in a
sandbox at 3–6 bodies and must be re-tuned against the real renderer and the real
frame budget. See **Fallback ladder**.

---

## Screens / views

Only the **Tank** was designed in full. Trials / World / Atlas inherit the same
tokens and the same rules; they were not laid out.

### Tank (phone, portrait)

**Purpose.** Watch six creatures under physics, select two, breed them. The wait is
the spectacle, so the water is the screen and the chrome gets out of the way.

**Layout** — full-bleed water, no panels. Single column, `position: relative` root:

| Element | Placement | Notes |
|---|---|---|
| Water | fills the viewport | radial gradient, `--c-water-*` |
| Top scrim | `top: 0`, height 96px | `linear-gradient(--c-bg, transparent)`; exists only so telemetry stays readable over moving water |
| Top readouts | `top: 16px; left: 16px; right: 16px` | flex, `justify-content: space-between`, `align-items: baseline` |
| Bottom scrim | `bottom: 0`, height 214px | `linear-gradient(transparent, --c-bg 58%)` |
| Control cluster | `bottom: 112px`, centred | pill, 1px border, `--c-surface` at 72% alpha |
| Primary action | `bottom: 112px` block below cluster, full width minus 16px gutters | min-height 50px |
| Tab bar | `bottom: 0`, height 56px | 4-up grid, no top border (the scrim separates it) |

Layout rule: **sibling groups use flex/grid + `gap`**, never margins or source
whitespace — the control cluster, the readout columns and the tab bar are all
`display: grid` / `flex` with explicit `gap`.

**Components.**

*Top-left readout* — generation and world.
- `Generation 4` — `--f-ui`, 15px, weight 500, `--c-text`
- `The Soup · 21 bodies` — `--f-ui`, 11px, weight 400, `--c-text-dim`;
  **the numeral `21` is `--f-mono`** while the surrounding words are not.

*Top-right readout* — selection and stranger.
- `2 of 6 selected` — 12px, weight 500, `--c-select`; numerals mono.
- `Slot 3 unrelated` — 11px, weight 400, `--c-stranger`; numeral mono.

*Creature label* (per creature, follows the body) — speed in m/s.
- `--f-mono`, 10px. `--c-text-dim` normally; `--c-select` when selected;
  `--c-stranger` for the unrelated slot.

*Selection ring* — circle around a selected creature.
- 1.5px `--c-select`, plus `box-shadow: 0 0 18px` accent at 28% alpha.
- The stranger's ring is 1px `--c-stranger` at 45% opacity — present but quieter,
  because it is a *fact about provenance*, not a selection.

*Control cluster* — Pause / speed / Undo.
- Container: pill, `border-radius: 999px`, 1px `--c-line`, background `--c-surface`
  at 72% alpha, 1px padding, `display: flex; gap: 1px`.
- Buttons: min-height 40px, horizontal padding 18px (16px for the speed chip),
  transparent background; label `--f-ui` 13px.
- Active speed chip: background `--c-surface-2`, `border-radius: 999px`,
  label `--f-mono` 12px (`1×` is a *measured* value).
- Disabled (Undo with empty stack): label colour `#4d5f70` — no other change.

*Primary action* — Breed.
- Full width, min-height 50px, `border-radius: 999px`.
- Border 1px `--c-select`; background `--c-select` at 14% alpha; label
  `--c-select-bright` (#7ee6db), `--f-ui` 15px weight 500.
- Copy is always **labelled with its object**: `Breed 2 selected`, never `Breed`.
- Disabled state (fewer than 2 selected): border and label `--c-text-dim`,
  background transparent.

*Tab bar* — Tank / Trials / World / Atlas.
- Height 56px, 4-column grid, centred text, `--f-ui` 12px.
- Active `--c-select`; inactive `#5a6d7e`. No icons, no indicator bar.

**Copy rules.** Sentence case everywhere. All-caps is reserved for the mono
telemetry strip. Never abbreviate a label to save space — cut the label.

---

## Interactions & behaviour

- **Tap a creature** → toggles selection. Ring and label recolour to `--c-select`.
  Max 2; tapping a third replaces the oldest selection.
- **Breed** → enabled only at exactly 2 selected; advances the generation ledger.
- **Undo** → one step, disabled when the stack is empty.
- **Speed chip** → cycles 1× / 2× / 4×; the label is the current speed, mono.
- **Transitions** — chrome only: 180ms `cubic-bezier(.2,.7,.3,1)` on colour,
  border-colour and opacity. **Never animate layout or the water.**
- **Nothing in the tank animates on a timer except the simulation.** No pulsing
  affordances, no attention-seeking chrome.
- Responsive: phone-first single column. The scrims scale with viewport height;
  the water always bleeds to all four edges.

## State

| State | Type | Drives |
|---|---|---|
| `generation` | int | top-left readout |
| `selected` | creature id[] (max 2) | rings, labels, Breed enable/label |
| `strangerSlot` | int \| null | which body wears `--c-stranger` |
| `speed` | 1 \| 2 \| 4 | speed chip label, sim rate |
| `paused` | bool | Pause/Resume label |
| `undoDepth` | int | Undo enable |

No new persisted state. Generation is already state; it stops being a status string
and becomes a ledger readout.

---

## Design tokens

Drop-in file: **`implementation/tokens.additions.css`**. Values summarised:

**Surface** — dark only, no light theme.
`--c-bg #04070a` · `--c-surface #0b1117` · `--c-surface-2 #16222d` ·
`--c-line #16222d` · water = `radial-gradient(115% 70% at 50% -10%, #0f2130, #04070a 68%)`

**Signal** — three roles, no overlap.
`--c-select #4fd1c5` (selection, primary action, active tab) ·
`--c-stranger #dd9f56` (**the unrelated slot and nothing else, ever**) ·
`--c-text #dbe6f0` / `--c-text-dim #7189a0`

**Type** — two faces, one rule: **mono means measured.**
- `--t-title` 15px / 500 · `--t-label` 12px / 400 · `--t-value` 11px mono ·
  `--t-micro` 10px mono (telemetry strip, letter-spacing .07em)
- Numerals stay mono *inside* sans sentences. Labels never take mono.
- The prototype uses IBM Plex Sans/Mono. The **rule matters more than the family** —
  if you would rather not ship a webfont, keep `system-ui` + `ui-monospace` and the
  system still works. Do not mix: pick one and set `--f-ui` / `--f-mono` once.
- `--f-name: Spectral, Georgia, serif`, italic — **reserved for derived binomials.**
  Ships as a token but is unused until naming ships, so naming looks earned the day
  it appears. (Open question below.)

**Geometry** — `--tapsize 44px` (primary 48–50px) · `--r-pill 999px` ·
`--r-card 8px` · `--gutter 16px` · `--gap 8–11px` · scrims 96px top / 214px bottom

**Motion** — `--ease-chrome 180ms cubic-bezier(.2,.7,.3,1)`

**Creature ramp** — a *separate namespace*: `--pal-w1-0 … --pal-w1-5`.
Chrome never draws from the ramp; creatures never draw from chrome. W1 "cold water":
`#2b3a4a #3f6b6b #7fa89b #d9cfbc #b5764a #6b5878` — index 3 is the near-white bone
stop, 4 and 5 (rust, plum) are the rare stops, so a warm creature is an event.

---

## Creature presentation contract

Drop-in file: **`implementation/creature.js`** (replaces `render/creature.js`).

**1 · Colour — the ramp contract.**
The hue gene indexes the world's six-stop ramp instead of walking the HSL wheel.
Six creatures then share a family and two worlds never look alike, while the gene
keeps its full range. `hueVariance` spreads across *adjacent* stops only, so a
recursive chain reads as one animal. `valueShift` owns lightness; `patternContrast`
owns saturation inside a bounded band — nothing generated can reach full chroma.

**2 · Generated maps.** Each creature builds its own colour, roughness and bump map
at birth on a 160×80 canvas from genes that already exist: `patternScale` (band
frequency), `stripeAnisotropy` (rings ↔ longitudinal stripes, continuously),
`patternContrast` (edge hardness). No texture files, nothing to ship.

**3 · Three layers, outside in.**
- **Membrane** — transmissive shell at ×1.13 radius, `ior 1.36`. Reads as wet.
- **Flesh** — the generated maps, sheen from the ramp's mid stop, `iridescence`
  thin-film. The only patterned layer. Low transmission (0.14) so the organ shows.
- **Organ** — opaque elongated ellipsoid per body. Gives the shell something to
  reveal, and carries the glow when luminous.

A transmissive shell over an occluded or unlit interior reads as plastic, not tissue.
If you drop the organ, drop the membrane too.

**4 · Light.** No `flatShading` (it reads as furniture — the thing 10 §A10 avoids).
Key + hemi + a back rim light **taken from the ramp**, never a chrome literal — a
hard-coded accent paints out-of-ramp light onto a warm-silt animal.

**5 · Luminosity is a trait, not a mode.**
- Trigger: `material.iridescence > 0.82` → about 1 in 6 creatures glows.
- Inheritable: one existing scalar under the existing jitter operator, so a luminous
  parent usually yields luminous children and occasionally loses it.
- Colour: the creature's own ramp stop, **with the bone stop excluded** — otherwise a
  luminous draw that lands on index 3 is white by construction.
- Phase-locked: brightness follows each segment's oscillator, so the glow is a readout
  of the gait. A travelling light is a wave; six lights blinking together is a twitch.
  This makes `phaseLag` visible and "undulates vs twitches" answerable at a glance.
- **Not a capability.** Presentation only — nothing in L2/L3 reads it.

Two implementation traps, both hit during design:
- **Clone the material per body** on luminous creatures. One shared instance means the
  last body's phase wins and the whole animal pulses in unison.
- **Keep a real emissive floor** (~0.3). With 3–4 bodies at ~0.95 rad lag there are
  instants when every one sits in the wave's negative half and the body goes dark.

---

## Fallback ladder, in drop order

Measured before promised. Drop in this order under frame pressure:

1. **membrane layer** — flesh alone still reads
2. **generated maps** — degrade to flat ramp colour
3. **halo sprites** — emissive alone carries the gait
4. **motes, rim light**

`buildCreature(plan, genome, { detail })` takes `'full' | 'flesh' | 'flat'` for
rungs 0–2. Wire the ladder to whatever the dev panel already uses for quality.

---

## Change map

| File | Change |
|---|---|
| `trunk/ui/tokens.css` | append `implementation/tokens.additions.css`. Existing `--c-*` names are kept; new roles are additive. |
| `ui/base.css` | full-bleed tank; top/bottom scrims replace panels. |
| `ui/widgets.js` | pill control cluster + primary action; labels to sentence case, objects in button copy. |
| `ui/screens/tank.js` | generation + selection readouts become an overlay, not a bar; call `updateCreatureGlow()` per frame with controller phase. |
| `worlds/w1_slice.js` | add `palette: 'w1'` (the ramp itself lives in tokens.css, per N16). |
| `render/creature.js` | replace with `implementation/creature.js`. |
| `engine/l1/genome.js` | **unchanged** — no new fields; the appearance genes already exist. |

## Files in this bundle

```
design_handoff_vivarium_style/
├─ README.md                        this document
├─ implementation/
│  ├─ tokens.additions.css          drop-in token additions (N16-compatible)
│  └─ creature.js                   drop-in replacement for render/creature.js
└─ reference/
   └─ Vivarium Style Proposal.dc.html   the live design prototype (reference only)
```

The prototype opens in a browser. Turn 2 is the chrome pick, turn 3 the procedural
creature work, turn 4 the spec; turn 1 holds the alternatives that were rejected and
why, which is useful if you want to argue with a decision.

## Open questions — need a human call

1. **Does a tank of six hold frame with membranes on?** That measurement sets ladder
   rung 1. Until it is taken, ship with `detail: 'flesh'` if in doubt.
2. **Does Spectral enter now** as a reserved token, or wait until naming ships?
   Shipping the token early costs nothing; shipping the *webfont* early costs a
   request for a face nothing uses yet.
3. **Font family** — adopt IBM Plex, or keep `system-ui` + `ui-monospace` and take
   only the mono-means-measured rule?
4. The `--c-fail` / `--c-pass` / `--c-warn` tokens already in `tokens.css` are not
   used by any screen designed here. `--c-warn` and `--c-stranger` are the same
   value; keep them separate names so the stranger can diverge, as `--c-select`
   already does from `--c-accent`.
