# MASS-BUDGET-CUB-JODEL: REAL-FIGURES' answer to CABIN-CRAFT (LINER-BACK) and ELEC-SYSTEMS (9 Nov 2026)

The question: which of the Cub's (and the Jodel's) bill lines are heavier than the real type, with a source, so that the
liner and the wiring land with the Cub at or under its present +2.8 %. The user's rule is "closer or equally good from the
reference".

The references are in `tools/real_refs.js`, with a 3 % tolerance:
- **Cub (J-3C-65):** 345 kg empty (765 lb, J-3C-65 sheet).
- **Jodel D112:** 320 kg.

Measured on today's official builds (load door + buildGen, `ledger2.js`). Empty kg, by ledger section:

| | engines | wings | fuselage | outfit | bracing | gear | elec | tail | furnish | paint | vessel | panel | avionics | **empty** | vs ref |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cub | 99.4 | 72.2 | 40.8 | 31.0 | 27.1 | 27.1 | **17.0** | 16.1 | 7.4 | 6.1 | 5.0 | 4.5 | 1.0 | **354.7** | +2.8 % |
| Jodel | 99.2 | 69.3 | 43.2 | 24.9 | 26.1 | 28.1 | **17.0** | 17.9 | 4.4 | 5.4 | 5.4 | 4.5 | 1.0 | **346.4** | +8.3 % |

## The lines heavier than the real type

**1. The electrics.** Both builds bill the 'basic' tier's set: a 7 kg lead battery, a 4 kg generator, a 4 kg starter and
the harness, 17.0 kg in all, plus a 1 kg COM in avionics.
- A J-3C-65 as certificated has no electrical system. It is hand-propped on magnetos; no battery, generator or starter
  is in its basic equipment (TCDS A-691, the J-3 series).
- A D112 on its C90 is normally hand-propped too; electrics were an owner's option.
- ELEC-SYSTEMS measured the Cub with them off: **empty 354.8 → 333.5 kg** (−21.3 kg: elec, COM, the refused fuel gauge
  and voltmeter, and the structure re-sized for the lighter gross). That is −3.3 %, past the band the other way.
- The Jodel with the same treatment: ≈ 325 kg, **+1.6 %** (from +8.3 %).

**2. The cabin lining.** Neither build chooses a trim, so both bill the 'basic' tier's half of Raymer's GA furnishing law:
0.5 × (0.0582 W0 − 29.5) = **1.44 kg** (Cub) and **1.39 kg** (Jodel).
- A J-3's cabin is bare tube and fabric, with no headliner and no side panels. GEN_TRIM's own 'bare' row names it:
  "paint on the tubes and a rubber floor mat: a J-3".
- So the Cub's lining should bill 0: `outfit.trim: 'bare'`. A new drawn liner on the Cub (LINER-BACK's +0.95 kg) is
  lining the real aeroplane does not have.
- The Jodel's ply cabin is light-trimmed: GEN_TRIM 'light' (0.25) names "a Champ or a Jodel", 0.7 kg.

**Sourced lining weights:** I have none beyond Raymer's furnishing law (Aircraft Design 15.3, GA: 0.0582 W0 − 29.5 kg for
the full fit) and the GEN_TRIM fractions. No J-3 / PA-11 or Jodel lining figure is in my references.

## What this does to the Cub, honestly

| Cub | empty | vs 345 |
|---|---|---|
| today | 354.7 | +2.8 % |
| + liner (+0.95) + wiring by cable runs (+1.45) | 357.1 | +3.5 % (worse) |
| electrics off (ELEC-SYSTEMS' measurement) | 333.5 | −3.3 % |
| electrics off, trim bare, no liner | ≈ 332 | −3.8 % |

**The finding:** the Cub's calibration absorbed about 17–19 kg of electrics and lining a J-3 never had. With them honestly
removed, about 11–13 kg is missing somewhere else in the J-3's bill.

I cannot name that line from a source today. No J-3 group weight statement (wing panels, struts, fuselage frame, engine
installation) is in my references. A weighing report or the Piper parts-weight list would settle it.

## Recommendation (for the user's ruling; defaults in bold)

- **Jodel: take the electrics off** (hand-propped D112), **set trim 'light'**, take the liner's −1.90 kg.
  - About +1.0 %, from +8.3 %. Closer, and both the electrics and the lining are sourced.
  - The wiring: none (no bus).
- **Cub: no change to its total until a J-3 group weight statement is found.**
  - The liner and the wiring land on the Cub only as a zero-sum split: the liner's +0.95 kg and the cable runs' +1.45 kg
    taken out of the lining line (trim 'bare': −1.44 kg) and nothing else. That leaves +0.96 kg, Cub +3.1 %, slightly
    worse than today.
  - Or the user rules the electrics off and accepts −3.3 % (honest, slightly out) while the missing line is looked for.
- **Wiring as a fraction of empty mass:** fine on builds that have a bus. On the Cub and the Jodel, the electrics should
  go first (the J-3 has no bus to wire).

Answered from claude/real-figures-3; the measurements are on claude/practical-cerf-7fjpwp
(`reports/evidence/MASS-SCALE-2026-11-09`) and on ELEC-SYSTEMS' branch
(`reports/evidence/ELEC-SYSTEMS/cub_noelec_2026-11-09.json`).

## RULED (the user, 9 Nov late: "go with your best judgment", so the defaults above stand)

**Jodel D112: electrics off, trim 'light', the liner taken.**
- Hand-propped C90: `systems.elec` battery / alternator / starter = none, fit stays as it is.
- `outfit.trim: 'light'` (GEN_TRIM 0.25, "a Champ or a Jodel").
- LINER-BACK's −1.90 kg.
- No wiring: no bus.
- Expected ≈ 322 kg against 320 (+1 %, from +8 %).
- Who does what: ELEC-SYSTEMS the electrics, LINER-BACK the trim and the liner, on the official
  `builds/jodel_2026-09-20_corrected.json`. Each reports empty mass, CG % MAC and genCertKey before/after in its READY note.
- The refused electrical items (the 12 V fuel gauge, the voltmeter, the COM) leave with the battery, as ELEC-SYSTEMS
  measured on the Cub. If the Jodel's panel loses its fuel gauge, add `fuelSight` (the D112's tank sight, 0.05 kg).

**Cub (J-3C-65): its total stays where it is (354.7 kg, +2.8 %) until a J-3 group weight statement is found.**
- The liner and the wiring land on the Cub only as a zero-sum split:
  - `outfit.trim: 'bare'` (−1.44 kg: the J-3 has no lining) pays for the liner's +0.95;
  - no wiring change (the J-3 has no bus to wire: the harness proposal does not apply to it).
- Net −0.49 kg: 354.2 kg, +2.7 %, equal or closer.
- The Cub keeps its electrics for now. Their removal (honest: −3.3 %) waits for the missing ~11–13 kg to be found in the
  J-3's other lines. It is an open item for REAL-FIGURES.
