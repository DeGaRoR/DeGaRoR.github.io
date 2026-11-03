# TAILWHEELS (G3800) — the evidence

The brief (A0, 3 Nov 2026, for the user): three real tailwheel steering options, the tail skid, a tailwheel per boom on
twin booms, and the inverted V on twin booms with wheels at its tips. Everything below was measured with
`tools/tw_probe.js` (a flat field, the hand on the sim's own controls; the circuit flown by the game's own host and pilot
from Jolene HOME's line-up) and gated by GATE TAILWHEEL (`tools/_tailwheel_check.js`). The "master" column is the same
probe on a clean origin/master worktree (adb2d2a9).

## The four tail contacts (`gear.twMode`, the gear page's "tail contact" row `s2Steer`)

| `s2Steer` | kind | how it flies (30_solver `twLine`) | sources |
|---|---|---|---|
| 1 (default; an old save's 0 too) | **steerable**, the Cub's (Scott 3200 class) | the rudder drives the arm through the steering springs (±28.6° at full pedal; their give, `TW_SCOTT.defl`, is the drawn fork's angle - the link flies rigid); **breaks out** when the tail is dragged along a track past the pawl's 35° arc (the contact sliding > 0.15 m/s, held 0.25 s); a free castor with the kingpin's friction; **re-locks** within 0.12 rad of the arm | FAA-H-8083-3 ch.14 ("beyond that limit the tailwheel breaks free and becomes full swiveling"); Univair's Scott 3200 sheet ("positive steering control far beyond rudder travel, and release easily and automatically to full swivel when aircraft is turned around"); the kingpin friction "5 to 6 pounds (approximately 23 to 28 pound inches of torque)" at the 3.5 in arm (owners quoting Scott's instructions, cessna170.org). The arc, the trail (0.35 r) and the springs' give are **derived**, not published numbers (see `00_registry.js` TW_SCOTT) |
| 2 (an old save's 2, G3575's "full swivel") | **lockable**, the DC-3's | `ctl.twLock` 1: pinned straight, rigid; 0: a free castor (steered by the brakes and power); the pin drops back in when the castoring fork passes within 0.12 rad of centre. The autopilot locks it for the runway and the air and unlocks it to taxi; the hand has `/` | the DC-3's and the warbirds' own procedure (unlocked to taxi, locked for take-off and landing) |
| 3 | **fixed** | straight, rigid, always | — |
| 4 | **tail skid** | a steel shoe sliding, Coulomb in every direction at `TW_SKID_MU` of its surface: grass 0.36, paved 0.45 … — its drag is the tail's only brake; steered by the rudder in the wash alone | a flat steel skid on a dry lakebed averages 0.36 (NASA TM, Sefie 1979, after Dreher & Batterson TN D-999); steel on concrete 0.45 (casex's aircraft-materials table) |

**Why the breakout is the arc, not the side force.** The brief asked for "the side force at the tailwheel over its
holding force". Measured with the breakout off, the held side force over the tyre's static grip reads **1.05–1.30 at the
autopilot's own full-power start** (the tail creeping, the tyre on its at-rest Coulomb law) and **1.18–1.52 in a braked
pivot** (Cub, Jodel, Rufus): no holding force separates them — the G3575 finding again (a breakout on the side-force
share castored the DC-3 into a weave). What differs is the tail **sliding** past the arc. With the arc trigger, the
held track over the arc reads at most **0.63 on the autopilot's take-off rolls and 0.17 on its roll-outs**, ≥ 1 in every
pivot. **The springs' give is drawn, not flown.** A give the size of the arc (0.35 rad, the first cut, when the give was the
breakout's path) cut a lightly loaded tail's cornering stiffness 5× and the inverted V's tip wheels ground-looped on the
roll-out (132°); even 0.06 rad tightened the Jodel's taxi turn at 0.2 of rudder from 31.8 to 25.1 m (GATE DMGTYRE: 0.62 of
the old law, its band 0.80-1.10). With the arc as the breakout the link flies rigid, as the linked wheel always did.

## The rows (master → this branch)

| | master | TAILWHEELS |
|---|---|---|
| Cub: 180° pivot on the inside brake, full rudder, 0.5 power | 7.5 s (the linked wheel scrubbed round) | **4.7 s**, broken out at 1.2 s, CG within 0.19 spans; released: re-locked at 2.0 s, 1.3° off straight |
| Jodel, same | 9.7 s | 4.6 s (out at 1.2 s), re-locked 4.7 s, 6.5° |
| Rufus, same | 4.2 s | 3.6 s (out at 1.1 s), re-locked 2.5 s, 4.0° |
| brake-free 180°, full rudder + 0.6 power: Cub / Jodel / Rufus | 5.6 / 6.9 / 3.6 s | **4.2 / 4.0 / 3.4 s** (broken out at ~1.1 s each) |
| HOME circuit, Cub: roll / heading / roll-out / touchdown | 113.41 m / 3.01° / 11.23° / 1.30 m/s | **the same to the digit**, no breakout |
| HOME circuit, Jodel | 194.1 m / 1.61° / 3.70° / 1.01 m/s | **the same**, no breakout |
| HOME circuit, Rufus | 71.51 m / 2.49° / 5.94° / 0.50 m/s | **the same**, no breakout |
| DC-3 locked: full-power roll | (the swivel steered) 0.1° | **0.4°, 0.7 m**, never castoring |
| DC-3 unlocked: 180° pivot | 12.0 s (G3575's swivel) | 12.1 s; the lock back in 2.1 s after |
| Tiger Moth-alike from 12 m/s, idle, no brake, grass | its wheel: 124.8 m / 21.4 s | **the skid: 65.3 m / 13.9 s** |
| the same on pavement | its wheel: 233.2 m / 43.3 s | **the skid: 67.4 m / 13.8 s** (the mains roll further there, the shoe drags harder) |
| Tiger Moth-alike, fixed wheel | — | refuses the braked pivot (31°), turns 180° on rudder + power in 7.4 s, the take-off roll 7.2° |
| twin booms, a tailwheel a boom (the drawn twin, the Undercarriage tile) | one wheel under the pod | stands on both (4.6° tail-down), rolls straight (0.04°), pivots in 4.4 s within 0.25 spans, HOME circuit and landing (1.34 m/s, roll-out 4.2°) |
| the inverted V on twin booms (the drawn twin, 30°, tips 0.6 m apart) | — | stands on its two tip wheels (1.3° tail-down), pivots in 5.6 s within 0.24 spans, HOME circuit: roll 1.0°, touchdown 1.96 m/s, roll-out 1.6°, STOPPED |

## The inverted V (the layout followed: the AAI RQ-7 Shadow)

The Shadow's tail: twin booms, a panel down and inboard from each boom, the two meeting under the centreline. Here the
two tips keep a gap (`tail.ivGap`, default 0.30 m) so each can carry its own wheel — the user's "wheels on the fin tips".
Seen from behind each panel is a normal V's panel moved down, so the ruddervators mix as a V's; the strips take their
normals from the panel's own nodes. Measured at cruise on the generator's twin (`tools/_tailwheel_check.js` F):

| V angle | dYaw/dr | dPitch/de | rudder → pitch |
|---|---|---|---|
| conventional twin | +5 508 | +11 460 | 0.8 % |
| 25° | +8 189 | +16 220 | 1.0 % |
| 35° | +10 765 | +14 093 | 0.5 % |
| 45° | +17 152 | +15 661 | 0.3 % |
| 55° | +27 767 | +17 649 | 0.1 % |

The rudder's roll is still a V's (−3 146 per unit dr at 35°, the fuselage V's −3 062): the panels' antisymmetric lift at
±0.68 m outweighs their side force below the CG. The sizing is the V's (S = max(Sh / cos²G, Sv / sin²G)) on the span the
booms give; the design check's volumes read its projections.

## The pusher on twin-boom tailwheels

The new-plane chooser's "[VAL] a pusher on a tailwheel" grey (claude/ready/new-plane, not on master): measured on the
generator's twin-boom pusher on its boom wheels, it sits 12.7° tail-down and the disc's lowest point clears the ground by
**0.232 m** (the gear page's tailwheel prop-clearance requirement is 0.229 m; the single-rod pusher 0.240 m). The tailwheel
stops the rotation there, so the disc does not strike tail-down: the grey can go on twin booms, the gear page's own
prop-clearance check judging each build.

## The DC-3's HOME trip

Red on a clean origin/master as well (measured this session, `tools/dc3_break.js --cases home --lim phys --log`, the works
stand at (42, 32.5)): master's DC-3 rolls off the taxi route into the water north of the stand and stops at (13.5, 50.6),
96 s in, both engines drowned, 2.5 m off the line - it never reaches the hold. On this branch the unlocked DC-3 (its
castoring wheel steered on the toe brakes) reaches the same pond the same way (15.3, 50.2), 82 s in. From the other stand
the tool can place it at (-113, 672), master's DC-3 swings 53 m off the line by 120 s. The trip owes a look at the island's
taxiway beside that water - not this branch's. The DC-3's own rows are GATE TAILWHEEL B (locked: a straight full-power
roll; unlocked: the pivot) and its circuit from the line-up (`--cases circuit`: lift-off at 21 s, the circuit, a 2.2 m/s
touchdown and a go-around, as G3576 records for master).

## The pictures — the simplified renderer

`tools/quick_view.js` (G3578, the user's "super simple renderer for real quick visualization"), driven by a small script:
per build the four views at once (`*_views.png`) and close-ups on the tail contact (`*_tail_34front`, `*_tail_34rear`,
`*_tail_side`, and `*_tail_rear` where there are two), aimed at the lowest drawn points of the aft 30 % of the aeroplane.
The builds are in `builds/` (the validated Cub in each tail-contact kind, the Tiger Moth-alike on its skid, the twin-boom
fixture as a taildragger and with the inverted V, all through the game's own load door).

| file | what |
|---|---|
| `cub_steerable_*` | the Scott-type wheel: the leaf spring, the steering springs and chains to the rudder horn, the fork |
| `cub_lockable_*` | the lockable wheel: no steering arm or springs; the lock pin's housing on the swivel and its cable forward |
| `cub_fixed_*` | the fixed wheel: no steering arm or springs; the clamp collar and its bolt |
| `cub_skid_*`, `tiger_skid_*` | the tail skid: the blade carried down from the leaf spring to a bolted steel shoe on the wheel's contact line |
| `twin_taildragger_*` | twin booms, a tailwheel under each boom's end |
| `twin_invertedV_*` | the inverted V on twin booms (30°, the tips 0.6 m apart), a castor wheel under each tip |
| `traces/pivot_*.png` (`.svg`, `.json`) | the 180° pivot on the inside brake, the CG's path from above, coloured by the tail contact's state: steerable (Cub), lockable unlocked (DC-3), fixed and skid (Tiger Moth-alike) |

`for_config-matrix.patch`, `for_new-plane.patch`: the edits for the two branches not yet on master (see the HANDOVER).
