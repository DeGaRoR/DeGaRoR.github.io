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

### Its control run (the user, 4 Nov: "that screenshots shows that the hinges did not like that")

The elevator's horn stands under its boom, beside the panel's root. The cable's exit was searched from 0.35 m ahead of
the horn (a chord × 2, the conventional tail's rule): every run forward along the boom crossed the panel's root, and the
first clear exit was up to **1.14 m** up the boom (the twin busher on floats; 0.45 / 0.52 m on the twin-boom and
push-pull fixtures), the cable lying along the boom's side to a boss at mid-length. On the inverted V the link now leaves
the boom right over the horn, as in the Shadow's booms: **0.09 - 0.14 m** on all three (GATE TAILWHEEL H, which fails
on the old code). `busher_invertedV_cable_before.png` / `_after.png` (`builds/busher_invertedV.json`: the fixture with
the Empennage tile's write).

## The V from the booms, all four ways (G3801)

The user, 4 Nov: *"can we also have inverted T-tail, but on the outside? And for the upward T-Tail, can we also have an
option where they face towards each other, inwards. So we have all possible options, with little wheels if the V is
downward?"* Each boom carries one canted panel (`tail.ivDir`, the stab layer's row *V from the booms · way*, four
Empennage tiles on twin booms):

| way | the tile | tail contacts | sized by |
|---|---|---|---|
| down & in (the Shadow's, G3800) | Inverted V | a wheel at each tip | the gap between the tips |
| down & out | Inverted V, outward | a wheel at each tip, outboard of the booms | its reach outboard (`ivReach`, default boom half-track − 0.15 m) |
| up & in (an A) | V, inward (an A) | a tailwheel under each boom | the gap between the tips |
| up & out (canted twin fins) | V, outward | a tailwheel under each boom | its reach outboard |

**The mixing.** On down & in and up & out the panel's upper face leans inboard, as on a normal V; on down & out and up & in
it leans outboard, so the rudder's half of the mix is reversed there (the elevator's never is). The aero strips take
both from the panel's geometry, and the drawn ruddervators' sense comes from each hinge axis's own lean. Measured at
cruise (GATE TAILWHEEL F and I, 35°): dYaw/dr +10 765 / +11 112 / +10 448 / +10 390, dPitch/de +14 093 / +14 178 /
+13 740 / +13 752 (the conventional twin +5 508 / +11 460), the rudder's pitch under 4 % of the elevator's. Every way's
drawn trailing edges swing to port on a nose-left pedal (GATE TAILWHEEL H, three fixtures × four ways).

**On the ground** (the drawn twin-boom fixture as a taildragger, 35°; GATE TAILWHEEL I): each stands on its two tail
contacts (down & out 0.3°, up 4.6° tail-down), turns 180° on the brake (5.8 / 12.6 / 6.3 s; the A is the slow one,
within 0.33 spans - not investigated further), and flies HOME's circuit and lands: touchdown 1.66 / 2.31 / 1.91 m/s,
the roll-out inside 4°, all STOPPED (down & out lifts off at 36 s against the upward ways' 15: it sits almost level on
its tip wheels, 0.3°, and rotates late).

Pictures: `twin_invertedV_in_*`, `twin_invertedV_out_*`, `twin_V_in_*`, `twin_V_out_*` (`builds/` the same names).

## The pusher with the A (G3801, the user 4 Nov: "check the pusher with the A")

Through the new-plane chooser's own path (`tools/_newplane_lib.js` judge: the bake, the drawing layers, the join, the
stance fit): an LSA, twin booms, a flat engine pushing, a low tapered wing, a taildragger - in every tail.

| tail | the disc clear of the tail | panels in the disc's shadow | three-point deck | lift-off (the chooser's hop) | Vv / Vh |
|---|---|---|---|---|---|
| conventional | 1.95 m | 30 % | 6.4° | 54.5 s | 0.115 / 0.686 |
| the A (up & in) | **3.73 m** | 48 % | 6.2° | 40.5 s | 0.031 / 0.489 |
| up & out | 3.61 m | 0 | 6.3° | 42.3 s | 0.031 / 0.489 |
| inverted V (down & in) | 3.47 m | 0 | 9.9° | 21.9 s | 0.031 / 0.489 |
| down & out | 3.23 m | 0 | 10.2° | 21.1 s | 0.031 / 0.489 (roll.clb warns: panels down and out act as anhedral) |

The A is clear of the disc by a wide margin - the tail is 4 m aft of the pusher - and about half of its panel area sits
in the disc's shadow (in the slipstream). Flown round HOME's circuit by the game's own host and pilot
(`tools/tw_probe.js --build builds/pusher_A_chooser.json`): lift-off at 59 s, touchdown 2.23 m/s, the roll-out inside
3°, STOPPED; the inverted V: lift-off 27 s, touchdown 1.52 m/s.

What the check found and fixed:
- **The design check read a V from the booms' fin volume 2-2.7× short** (the A's Vv 0.011, a fail): its vertical arm
  was the join's fin station (none here; 1.5-2.1 m against the panels' 4.05). The V's fin is its panels: `lv = lh`
  (60_gen_spec). A readout - the flown model is unchanged (the signs probe to the digit).
- **A downward V on the chooser's taildragger sat 1° nose-down and never left the ground** (it ran off the strip on its
  wheels): the tips hang the V's drop below the booms and no tail leg reaches them. The chooser's stance fit now
  stands it at 10° with the mains (s1Drop; +0.3 m 2.7°, +0.6 m 6.4°, +0.9 m 9.9°, measured) - long main legs, visible in
  `pusher_invertedV_chooser_views.png`. A cant toward 20° or a wider gap would raise the tips instead; the fit does not
  trade the tail's volumes for it.
- The stance fit also grows a boom V's chord when the drawn V falls short of Vv 0.024 / Vh 0.36 (not needed on these).

Not counted, the chooser's own standing fails: every pusher here reads "prop: through the wing (15 of 288 points)", and
the twin booms' three-point deck sits at 6.2-6.4° under the 7° floor with the conventional tail as with the upward Vs.
GATE TAILWHEEL J holds the A and the inverted V to this. Pictures: `pusher_A_chooser_*`, `pusher_invertedV_chooser_*`.

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
| `twin_invertedV_*` | the inverted V on twin booms (30°, the tips 0.6 m apart), a castor wheel under each tip (re-shot after the control-run fix) |
| `busher_invertedV_cable_*` | the inverted V's elevator cable before (a metre along the boom) and after (out of the boom over the horn) |
| `twin_invertedV_in_*`, `twin_invertedV_out_*`, `twin_V_in_*`, `twin_V_out_*` | the V from the booms in its four ways (G3801), 35° |
| `pusher_A_chooser_*`, `pusher_invertedV_chooser_*` | the chooser's twin-boom pusher with the A and with the inverted V (its long mains) |
| `traces/pivot_*.png` (`.svg`, `.json`) | the 180° pivot on the inside brake, the CG's path from above, coloured by the tail contact's state: steerable (Cub), lockable unlocked (DC-3), fixed and skid (Tiger Moth-alike) |

`for_config-matrix.patch`, `for_new-plane.patch`: the edits for the two branches not yet on master (see the HANDOVER).
