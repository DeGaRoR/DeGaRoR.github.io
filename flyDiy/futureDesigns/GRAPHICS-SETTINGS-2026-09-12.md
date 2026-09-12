# GRAPHICS SETTINGS — the menu a PC game has (spec, 2026-09-12)

STATUS: IMPLEMENTED as G286 (2026-09-12): `src/viewer/gfx_settings.js`, hosted by
both rails, `flydiy.gfx`, GATE GFX. Written at the close of the tree chantier
(W0c, HANDOVER W0c), from the user's brief: "macro controls, exposed
from a new global settings menu (in the editor and in flight), where the
graphics options can be set up, with the macro controls, but also a few
options for setting it up yourself — not as complex as the F8 menu, a typical
graphics settings from a PC game."

## 1. What it is, and what it is not

One panel, reachable from the shed's rail and from the flight rail, holding a
**preset** and, under it, the **handful of options** a player expects. It is
not the F8 developer panel (`src/viewer/dev_panel.js`), which lists every dial
the world publishes and owns nothing; this menu owns a *saved choice* and
applies it at boot, before the first plant, so a machine that cannot afford
the forest never draws it dense.

Everything it drives already exists as a live handle. The chantier is UI,
persistence and the preset table — not rendering.

## 2. The options, and the handle behind each

| option | values | handle | note |
|---|---|---|---|
| anti-aliasing | Off (4× MSAA) · Smooth (8×) · Smoothest (8× + 1.25×) | `FLYDIY_AA.setTier` | the frame's multiplier: 25 / 39 / 48 ms in the densest stand |
| forest density | Sparse 96 · Normal 112 · Dense 128 · Very dense 160 | `TREE_FILL.set(ng)` | grid points per km; 10.7 / 9.1 / 8 / 6.4 m |
| forest detail distance | Near 60/132/270 m · Far 150/300/450 m | `TREE_LOD.set([l0,l1,near])` | where geometry hands over to impostors |
| shadows | Off · Near (1024) · Full (2048 + far cascade) · Ultra (4096 + far cascade) | `WORLD_RIG.set({shadowMap, farShadow})` + `renderer.shadowMap.enabled` | the near map follows the aircraft; the far cascade is the impostor stand's |
| canopy shading | Off · On | `WORLD_RIG.set({floor})` (1.0 = off, 0.30 = on) | the floor under the crowns |
| lighting | Sunset · Afternoon | `WORLD_RIG.row('sunset' \| 'alps')` | until the day/night cycle, the two rows the trees were judged in |

## 3. The presets

Filled from `node tools/tree_perf.js` on the reference machine (RTX 3080,
1080p) with the headroom rule from WORLD-V2 §11 — the box is high-end, so a
preset is a proxy for a tier of machines, not a target for this one.

| preset | AA | density | detail distance | shadows | canopy | intended for |
|---|---|---|---|---|---|---|
| Low | Off | Sparse 96 | Near | Near 1024 | Off | integrated / old GPUs |
| Medium | Smooth | Normal 112 | Near | Full 2048 | On | mid-range |
| High | Smooth | Dense 128 | Far | Full 2048 | On | this machine at ~30 fps in the worst stand |
| Ultra | Smoothest | Very dense 160 | Far | Ultra 4096 | On | when the card allows |

Changing one option under a preset flips the preset label to "Custom"; picking
a preset rewrites every option. The W0c.26 matrix in TREE-IMPORT.md §8 is the
measured basis for the Medium / High rows.

## 4. Persistence and boot order — and what needs a restart

**Nothing.** Every option takes effect live. Three cost a moment: the AA tier
reallocates the frame's target (one frame), a new density re-streams the forest
around the aircraft (~10 s of chunks arriving), shadows off/on recompiles the lit
materials (a short hitch — it is `sun.castShadow`, because `shadowMap.enabled`
alone leaves the materials sampling a stale map). The note under the menu says
so; `GFX.restart()` states it per option.


- One pref key, `flydiy.gfx`, JSON `{ preset, aa, density, bands, shadows,
  canopy, lighting }`, through app.js's `prefGet/prefSet` like the camera
  prefs (`flydiy.flCam`).
- Applied in `app.js` after `buildWorldScene` returns and BEFORE the first
  `treeSettle().then(plant)` — the fill's `NG` and the bands must be set
  before the streamer generates its first chunk, or the first plant is redone.
- The AA tier is applied at renderer construction (the pass allocates its
  target from it).
- A machine we do not know boots on **Medium**; the first time the menu is
  opened it shows the measured frame time of the last minute beside the
  preset, which is the only honest "auto" this game can offer.

## 5. The panel

- Shed: a `GRAPHICS` entry in the left rail beside `CONTROLS`; flight: the
  same entry in the flight rail. One DOM panel, built lazily like
  `input_panel.js`, hosted by both rails.
- A preset row of four pills; below it the six options as selects; a
  one-line readout "last minute: 31 ms median · 44 ms p90" from a rolling
  frame timer the panel owns while open.
- No sliders: every option is a named step, because a step can be measured
  and named in this document; a slider cannot.

## 6. Gates

- GATE GFX (new, `tools/_gfx_check.js`, tier core): the pref round-trips;
  every preset resolves to a value of every option; applying a preset then
  reading the handles back returns the preset's values; `Custom` is set on
  any single change; boot with no pref = Medium.
- GATE WORLDRENDER: a boot with `flydiy.gfx` = Low plants NG 96 before the
  first chunk.

## 7. Out of scope

Resolution scale, VSync, FOV (the camera flyout has it), the F8 dials.
