# DRAG-SCALE and MASS-SCALE (2026-11-09, claude/practical-cerf-7fjpwp: an experiment branch, not for merge)

The user (9 Nov): "go ahead with 1 and 2, then the mass model ... the chinook should have aluminum tubing ... Ensure the
cub, cessna and Jodel remain unaffected."

## Shipped builds: unchanged

`digests_before.txt` (the merge ddc2ed028) and `digests_after.txt` (the gear ceiling in) are identical: the cert key and
the sha of nodes, beams and params for all 18 shipped builds (`digests.js`, scratch).

## 1. Drag (dac78a178)

- **A radial's NACA cowl.** Cooling 0.0009 (Townend ring) to 0.0005 (NACA cowl with baffles) by the cowl's chord over
  the engine's diameter.
- **Reynolds above the calibrated sizes.** Body over 8 m, chord over 2 m: Schlichting's Cf ratio.
- **The DC-3:**
  - cooling 0.362 → 0.201 m², body 0.747 → 0.658;
  - fixed pitch: Vmax 309 → 318 km/h;
  - on its constant-speed propellers (dc3_propcs): Vmax 336, V75 303–308, both inside.

## 2. The Cub climb anchor

The +36 % is the reference's unstated weight. At gross the Cub is +6 %. Nothing changed.

## 3. Mass

### The gear's own gauge ceiling (GEN_GAUGE.hiBy.gear 8)

The DC-3's gear was capped at 3x a light gear at 10x the gross. Gear 272 → 423 kg. No build under 4.3x its row's
refGross moves.

### Candidates (edits on top of the cards, no shipped file touched)

| candidate | change | empty (kg) | reference (kg) | notes |
|---|---|---|---|---|
| dc3_mass | airliner seats, trim "lined and quiet" (on dc3_propcs) | 6663 → 7089 | 7650–8300 | overall 70.6 → 73.1 |
| chinook_minimal | no battery, generator or starter | 235 → 215 | 172–209 | |
| camel_minimal | the same | 579 → 565 | 421 | |
| tigermoth_minimal | the same | 570 → 535 | 506 | overall 81.2 → 83.8 |
| stearman_minimal | the same | 902 → 852 | 876–878 | overall 86.1 → 84.2: worse, see below |

### Findings (not changed: each a physics decision)

- **DC-3: retraction.**
  - RETRACT-1 retracts a tricycle only (60_gen_spec clampSpec, _cage_join, GEAR_RETRACTABLE).
  - A taildragger DC-3 keeps its gear out: about 0.35 m² of drag in cruise.
  - It also lacks the retraction system's mass (GEN_RULES.retractKg, 3.5 % of gross, about 400 kg).
  - With both: about 7490 kg (−2 %) and a further ~4 % on Vmax.
- **DC-3: systems.** The electrics, panel and radios are the light-aircraft catalogue (30 kg). There are no rows for
  hydraulics, de-icing or a transport's electrics.
- **DC-3: climb at gross 7.7 m/s against 5.6–5.7.** The DC-3's climb is not a mass question: it is measured at gross.
  The likely cause is the engine at take-off rating (1200 hp) against the book's METO 1050. The REF-DATA session
  (claude/ref-data-dc3-tigermoth) is fetching the conditions.
- **Biplanes: the wing's box on a truss plane** (bracing_members.txt):
  - A wire-braced biplane wing is planar: two spars, with drag wires between them.
  - The frame builds it a full cantilever box (lower caps, webs, plan diagonals) and bills it at full class density.
    On a cloth wing, `boxWebK` is not applied.
  - Bracing: Stearman 208 kg (its wings are on the steel row), Tiger Moth 78, Camel 69. Against these, the Cub's
    strut fan is 27 kg.
  - The spars' linear density is a class constant, so two short wire-braced wings pay twice a monoplane's spar run.
  - The three biplanes do not calibrate to one factor. The Stearman's surplus box hides light items elsewhere: a
    fuselage of 60 kg on a 7 m welded trainer.
  - A biplane sizing pass (spar by bending between bracing points, the box at the drag bracing's weight) is the real
    fix. None of the Cub, Cessna or Jodel is a biplane.
- **The Camel's remaining surplus.** It is airframe, not engine: wings 133, bracing 67, gear 50 (a V-strut gear of
  about 20 kg).
