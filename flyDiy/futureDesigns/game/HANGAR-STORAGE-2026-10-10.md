# HANGAR-STORAGE — where your aeroplanes are kept, and flying any of them from where it stands
### (2026-10-10, the GAME COORDINATOR; from the user's answers of 10 Oct, relayed by A0)

The user, on the fleet shown as parked props (FLEET-PROPS B): *"we need to do a little better"*. The flip goes ahead as
the DRAWING layer; on top of it comes a STORAGE the player acts on:

- a **storage UI** (the game's, maybe the sandbox's too) with design slots **INSIDE** (the hangar's storage: the garage
  building, not its editing floor), **OUTSIDE** (the apron) and **LONG-TERM** (not shown);
- planes move between them by **drag and drop**;
- **any shown plane starts from where it is**; an inside plane may simply start on the runway (no animation yet);
- stored planes are **clickable in the world**: click → a confirmation → roll out and fly;
- a long-term plane must first be **loaded** somewhere (the garage's floor, an inside slot, or the apron).

And on the main hangar (WORKS-COZY): the user isn't sure what the hearth adds. **Keep today's hangar for now**, move to
the hearth later. The long-term direction is an **enormous hangar that can't be used yet** (a derelict mesh, later) and
a **smaller one in good shape** beside it; the career starts in the small one; restoring the old one later unlocks larger
designs (a rung of the MACHINE-SHOP ladder, §R.4). Not built now, but **designed so it isn't redone**: slot counts belong
to the building, and a building is a career unlock.

## 1. What exists (built on, not replaced)

- **The place of an aeroplane** (70_player / 71_player_bases, PREM-S2): `fleet[slot].where = { kind: 'in' | 'out' | 'away',
  hangar?, aero }`; "bring it home" is free.
- **The drawn fleet** (FLEET-PROPS A/B, parked.js): prop copies baked on save, stood on each aerodrome's cooked fleet spots
  (outside rows), the drawn set capped at 6 (4 on light presets); FLYDIY_FLEET on in train 43.
- **The garage's residents** (WORKS-COZY G2315): airframes standing inside the garage beside the stand, L2 props (~free:
  +1 draw, +25 k tris each), `GARAGE_ENV.residentSwap` = "Work on <name>" (a swap costs what a slot load costs).
- **The side hangars and plots** (PREM-S3): sheds the player holds at plots, each with its shell.

## 2. The model

**A building has slots.** Every hangar the player holds (the main one, a side hangar, later the restored one) carries
`slots: { inside: N, outside: M }`, taken from its SHELL by default (data, not code):

| shell | inside (beside the floor) | outside (its apron) | note |
|---|---|---|---|
| club (today's main hangar) | 2 | the aerodrome's fleet spots, up to 6 | the career starts here |
| works / hearth (later) | 4 | as above | the move to hearth, later |
| field (the small shed) | 0 | 2 | remote sites |
| *old hangar, derelict* | 0 until restored | — | a future building; restoring it = a MACHINE-SHOP rung: larger designs + ~8 inside |

**An aeroplane is in exactly one place:** `where = { kind: 'floor' | 'inside' | 'outside' | 'long' | 'away', hangar, aero, slot }`.
- `floor`: on the garage's stand (the one being edited); `inside` / `outside`: shown, numbered slots of a building;
  `long`: kept, not shown, unlimited; `away`: stopped at another field after a flight (today's 'out' at a strange field).
- The migration (one PLAYER_V step): today's `in` → `inside` of that hangar while slots remain, the rest `long`; `out`
  at a held hangar → `outside`; the rest unchanged. Nothing is lost; the save round-trips.

**Moves** (pure core, one function): floor ⇄ inside ⇄ outside ⇄ long within one base, free and instant (sandbox and
career); a full target refuses with the reason. Long → shown needs a free slot. Between bases: a flight (or "bring it
home", unchanged).

## 3. The UI (the garage's look: --ed-* tokens and controls, Plex Sans upright)

- **STORAGE** in the garage: three columns, INSIDE n/N, OUTSIDE m/M, LONG-TERM; a card per plane (its name, its baked
  thumbnail when there is one, gear, seats); **drag and drop** between columns (and onto the floor = "Work on").
  Phone: tap a card, then tap a column.
- **Fly from where it is**: each shown card has **Fly**. Inside → the aeroplane starts **lined up on the base's runway**
  (the active one by the wind; no tow animation yet). Outside → it starts at its apron spot (today's stand logic).
  The floor → today's roll-out. Long-term: no Fly (load it first).
- **In the world**: the drawn residents and apron props are **clickable** (a raycast on the fleet group, the drawn set
  only) → a small confirmation in the garage's look ("Fly F-RCUB from the apron?") → the roll-out from that slot.
  The no-centre-card rule after a crash does not apply here (no crash), but the box stays small and at the edge.

## 4. Cost and performance

- The drawn cap stays (≤ 6 outside, 4 on light presets; inside residents at L2). Long-term costs nothing drawn.
- A move redraws only the props that changed; no bake on a move (the bake already happened on save).
- Strict gates: no garage parameter-change regression; the click raycast only on the fleet group, only on a click.

## 5. Sessions (after the user's OK on this study)

| | G | where | what | gates |
|---|---|---|---|---|
| HANGAR-STORAGE-1 | G2690-G2699 | CLOUD | the model (slots per building from the shell, `where` kinds, moves, PLAYER_V migration), the STORAGE UI (drag and drop, phone taps), Fly from inside (runway) / outside (apron) / floor | a new GATE STORAGE, PARKED, SAVE, UISMOKE, UISMOKE-PHONE, DESTTO (a start from each kind), PLAYER |
| HANGAR-STORAGE-2 | G2700-G2704 | LOCAL-GPU | the in-world click (raycast on the fleet group) → confirmation → roll-out; the drawn props follow moves; the perf proof (strict per-frame, garage parameter change unchanged) + stills (loaded page + 2 s) | the strict gate, FRAMECOST_FLEET, INSTANT --fleet |
| (later) BUILDINGS | — | — | the derelict big hangar + the small good one, restoring as a MACHINE-SHOP rung | — |

## 6. Questions for the user (defaults in bold)

1. The sandbox gets the storage too? **Yes, free** (the same UI; the career adds nothing but its buildings' slot counts).
2. Moving between inside / outside / long-term costs? **Free and instant** in both modes.
3. An inside plane's start: **lined up on the active runway** (by the wind), or at the hangar door?
4. Today's club main hangar: **2 inside slots** (the residents beside the stand) — more would crowd the floor.
