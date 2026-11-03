# CONFIG-MATRIX — READY (for the design train L30b)

Branch `claude/ready/config-matrix`: steps 2-3 (the switch fixes, the dorsal on rod hosts, the rod clear of the rear
disc) and step 4 (the greyed tiles), rebased on `origin/master` with PHONE-1b, unbuilt (the train builds).
The user's calls (A0, 3 Nov 08:40): C1 steps 2-3 yes, C2 the step-4 greys accepted.

## The grey rules (for NEW-PLANE's chooser)

`CAGE_DESIGN.CM_OFF` (tools/_cage_design.js, exported): each rule is `P => reason | null`, hung on the tiles as
`opt.off`. The ids are stable; docs/CONFIG-MATRIX.md section 11 is the table.

| id | tiles it greys | greyed when |
|---|---|---|
| `loftSingle` | Fuselage style · Lofted skin | a pusher or push-pull (engMount 1 / 4) on a single boom |
| `single` | Booms · Single | a pusher or push-pull on a LOFTED body (boomStyle 0) |
| `twinT` | Empennage · T-tail; Stab sits · On the fin tip | twin booms |
| `twinV` | Empennage · V-tail | twin booms |
| `wingTop` | Wing position · Mid, Low | the over-the-wing engine (engMount 2) |

Changes since the first cut (2 Nov, 7173bd9a7): `single` no longer greys a push-pull on a ROD (the user: "very
possible, with Rod on top or below the engine and prop") - the rod fit moves the rod clear of the disc instead. No
other rule changed; no id renamed.

## The rear-engine fit (A0's step 3) and the firewall rule

A0 asked for the push-pull's rear unit to be raised alone through `engBlockY`. On master (CABIN-CRAFT-2, landed with
FINISH-4) the firewall rule makes a COWLED pusher - and a push-pull's rear, which is cowled whenever the nose is
(`cowlOn` is one row) - stand on the pod's face and IGNORE the block; the cowl does not read `engY` either. So:

- an uncowled push-pull: the fit raises the rear unit alone (`engBlockY`): the push-pull fixture on a single rod,
  rod at its limit −0.9 + the rear block up 365 mm → clear (it was 284 mm of blade through the rod);
- a lone uncowled pusher: `engY` as before (the stock + Pusher tile: rod −0.34 → −0.72, clear);
- a COWLED rear (every push-pull card as born): nothing moves; the stat line says "N mm of blade still reach it: a
  cowled rear engine stands on the pod's face (the firewall rule) - shorten the prop, or take the cowl off and raise
  the block", and the prop check files it as a `prop:` error row.

**Question for the user / A0:** raising a cowled rear engine means moving its cowl with it - a per-unit rear height
the cowl layer (CABIN-CRAFT's) would have to read. Not done here.

## Saved builds

Bit-identical: no repo build, archetype card or 4b candidate sits in a changed cell; every saved single-rod pusher
passes the new prop-vs-rod check. Gate results: STATUS.md.
