**Pusher taper verdict (A0, 9 Nov):** a fresh Busher-style pusher gets taperW **0.679** from today's rule, not 0.62. The rule adds 6% clearance plus 2 cm to the 916's drawn half-width (0.299 m). The proposed pusher rule "half-width + 1 cm" gives 0.624. Nothing is changed and every saved pusher keeps its cw_taperW.

# PROPER-COWLS - evidence

## The pusher's front width (A0's question, 9 Nov; the user's ruling "0,62 is good")

The straight rule (`tools/cowl_study/straight.js`, waist mode) narrows a pusher's barrel toward the engine. The front half-width is
`a1 = min(aW, max(1.06 x the drawn engine half-width + 0.02, 0.45 x the firewall half-width aW))`, and `taperW = a1 / aW`.
Each pusher archetype was born fresh by the chooser's own path (`NP.fromArchetype` -> `_newplane_lib.joinedOf`). The Busher
was taken from its saved file. Probe: `node tools/cowl_study/pusher_taper.js pusher_taper.json`.

| pusher | engine | firewall half-width | engine half-width | engine term | 0.45 floor | rule taperW | saved taperW |
|---|---|---|---|---|---|---|---|
| Twin busher floats 4b (saved) | Rotax 916 iS | 0.495 | 0.299 | 0.337 | 0.223 | **0.679** | 0.62 |
| Pod-and-boom pusher | Rotax 582 | 0.633 | 0.105 | 0.132 | 0.285 | 0.45 | 0.47 |
| Chinook-alike (authored) | Rotax 582 | 0.633 | 0.105 | 0.132 | 0.285 | 0.45 | 0.47 |
| Archaeopteryx-alike | Pipistrel E-811 | 0.349 | 0.150 | 0.179 | 0.157 | 0.513 | 0.44 |

**Why 0.68 and not 0.62.** The user's 0.62 on the Busher is the 916's drawn half-width plus 1 cm (0.307 / 0.495): the cowl
hugs the cylinder heads. The rule's 1.06 x clearance plus 2 cm is the nose cowl's margin. The front of a nose cowl closes
on the spinner ahead of the engine. A pusher's narrow end is the engine itself, and the user tapers it down to the heads.

**Proposed rule (not applied):** for a pusher, `a1 = max(engine half-width + 0.01, 0.45 x aW)`. This gives Busher 0.624,
582 pushers 0.45 (saved 0.47), and E-811 0.459 (saved 0.44). If a head still stands out, `fitCheeks` adds a cheek, as it
does on noses.

**Saved builds:** the rule is only a study tool and births do not run it yet, so no saved pusher's `cw_taperW` changes. On
this branch the saved builds' ENGCONFIG digests are identical to the branch base's (e0457618d).
The visible changes the user approved are: (1) every split line is level, display only (`partLevel` absent = 1); (2) the
Tiger Moth candidate's new cowl and stand-off (0.85 -> 0.4).

## Also in this round

- **No mount plate inside a pod** (the user: "a flat plate between the cowl and the nacelle, it should not be there"): a
  pod that houses its engine draws no plate. Display only.
- **The Spitfire** is left as it is (the user: "its nose section is much too short in height, so no cowl will fit"). The
  drawn Merlin's banks stand 0.59 m above the firewall's centre, and the body's top is only 0.41 m above it. The generator
  also draws no reduction gear on a V, so the prop shaft sits on the crank.
- **Not yet:** the rule running automatically at every birth. Births still take the per-type presets.

## Other files here

- `index.html` + `img/`: the report page, V5 quick renders.
- `crease_study.json` / `.txt`: which of the plane's rows make a nose boxy (15 builds).
