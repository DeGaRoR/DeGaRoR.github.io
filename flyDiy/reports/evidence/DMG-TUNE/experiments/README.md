# The experiments on the way (knobs since removed or fixed; every run: damage ON, the certificate, the Cessnas on JOIN-PARITY's spec)

The card is GATE DMGCERT's test to destruction (BROKE AT; the band 5.70-5.99 g + 2.5 % for the rig's ramp lag = at most 6.14 g).

| step | what | the card (Cub / Jodel / metal / floats / twin) | what it did to the crashes | kept? |
|---|---|---|---|---|
| base | kappa 0.1 everywhere, any member takes its group | 6.01 / 6.10 / 6.06 / 6.10 / 6.01 (D2a's, node raw) | the 2.5 m wing strike 44-153 broken, engines off on 4 builds; the nose-over 35-97 | - |
| A | the release rule: a kink never, half the strength severed | 6.06 / 6.135 / 6.02 / 6.08 / 6.03 | nose-over Cub 50 -> 24, Jodel 97 -> 3; engines still off in the wing strike (each mount member at 5 kN severed in turn) | yes (at a third, below) |
| kappa_member 0.3 / 0.5 / 1 (every non-seam member) | `kappa_member_joint.txt` | Jodel 6.12 / 6.23 / 6.31, metal 6.15 | nose-overs 13; but the card leaves its band and the metal wing's set past the limit goes | no |
| kappa_joint 0.2 / 0.3 (every seam) | same file | Jodel: no group in the run; Cub and twin 9.07 / 9.04 at 0.3 | D2a's own finding again: the wing's joints leave the certificate | no |
| **the floor by ROLE: the wing (members, joints, glue lines) 0.1, the rest `body`** 0.3 / 0.5 / 1 | `floor_body.txt` | **unchanged at every value: 6.06 / 6.135 / 6.02 / 6.08 / 6.03** | at 0.5: nose-over 3-7 (gear and nose only), wing strike Cub 33, Jodel 99, metal 27, floats 10, twin 74, no engine off on the land builds; the floats' dig-in 16 -> 2 | **yes, 0.5** |
| the wing's internal seams (glue lines) at 0.3 / 0.5 | `floor_wing_seams.txt` | Jodel 11.3 / 13.8 g | the Jodel's card IS its inboard glue lines | no |
| a glue line built like its most loaded sibling (x 1 / 0.8 / 0.6 / 0.5 / 0.4), with and without the root rib | (terminal) | Jodel 6.16-6.25, 8.4 without the root rib | Jodel wing strike 51-106 (chaotic) | no |
| **the release at a third** of the strength (0.25 / 0.34 / 0.5) | (terminal) | **Jodel 6.05 / 6.06 / 6.14**, the rest 6.01-6.08 | the crashes alike at all three | **yes, 1/3** |
