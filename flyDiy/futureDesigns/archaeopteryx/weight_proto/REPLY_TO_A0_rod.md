# ARCHAEOPTERYX: the light rod - the study session's reply to A0 (12 Nov), for AERO-BODY's rod row

## (a) Agreed: the section is enough. WEIGHT_STUDY §3.4's "foot-launch rod + build weight" is dropped

The study session's prototype was already section-only: no build weight, the wall ×0.4 on EI, GJ and the tube cut. It is
not on the branch. It is kept as a reference: `weight_proto/rodlight_prototype.patch`.

**Why the section works for the rod but not for the wing:**
- The rod's bending failure is the solver's tube cut, `Mu = fu·sh·EI/(E·r)` (30_solver.js ~1096). That is pure
  physics: the certificate stamps lattice beams, never the cut. So a thin rod parts at its root on a heavier plane,
  with no hidden number.
- The wing is different: the certificate re-stamps every wing member and fitting to the aeroplane's own limit loads.
  The light wing held 6 g on the C172 until it was given a build weight.

**Where the section alone is NOT enough:**
1. **Mass through the gauge.**
   - Today the rod's mass is the fuselage lattice aft of boxRear, billed at lin × gauge × aftG.
   - The gauge grows with the aeroplane's weight, so a "thin" rod would get heavier on a heavier plane.
   - The π·d·t·ρ billing fixes this. Keep the rod bays out of the gauge.
2. **The rod's lattice members are still certified.**
   - They are stamped at 1.5 × the aeroplane's own F_l.
   - The cut governs bending first, so bending is fine. Watch torsion at the root fitting, which the certificate does
     size.
3. **Substep stability.** Seen on the wing, not yet on the rod:
   - the light wing's springs at kScale 0.45 diverged on the Caravan (1.6 t) once its struts let go;
   - the wing is now floored at 0.7 × the aeroplane's kScale (`kFloorK`);
   - the rod is a projected cluster, so its omega should not shorten the step. Still, test the softest legal rod on the
     heaviest rod card for a clean break rather than a divergence.

## (b) For the rod row

**The Archaeopteryx wants carbon.** Its drawn rod is d = 0.202 m (r 0.101; rodD 0.27 cage × 0.745). Carbon: E 135 GPa,
ρ 1550. Under the bending cap 0.3·E·t/r:

| wall | σ (bending cap) | Mu | mass |
|---|---|---|---|
| 0.5 mm | ≈ 200 MPa | ≈ 3.2 kN·m | 0.49 kg/m |
| **0.8 mm (recommended)** | ≈ 321 MPa | ≈ 8.2 kN·m | 0.79 kg/m, ~3 kg for the rod |
| 1.2 mm (today's rule) | | ≈ 18.5 kN·m | 1.18 kg/m |

Why 0.8 mm: the stab-through-the-rod bench never cracked the rod at 0.48 mm (about 9 kN·m on the tensile limit); the
stab's attachment went first, at 7.5 g. So the demand at 3.8 g is under about 4.6 kN·m, and 0.5 mm with buckling
may sit too close.

**The test, both ends: measured, with a caveat.**
- The only tail bench (makeLoadTest, surface 'stab') pins every node that is not the stab, so the rod carries nothing.
- A rig option, `cfg.throughBoom`, pins only the nodes forward of fuse.boxRear + 0.05 (65_gen_loadtest begin()), so
  the stab's load goes through the rod. It is on claude/archaeopteryx-sailplane-study-q8tzz2.
- Destroy ramp; the first break is at the rod's root cut ("fus/root-bend"):

| card | standard 4130 1.2 mm, r 0.045 | wall × 0.4 |
|---|---|---|
| ul1 (348 kg) | 4.65 g | 1.64 g |
| pusherPod (669 kg) | **2.33 g** | 0.71 g |
| Archaeopteryx (235 kg, carbon, r 0.101) | no rod crack | no rod crack |

On the Archaeopteryx the stab's attachment goes first, at ~7.5 g, either way.

**CAVEAT: the bench is too harsh for the rod.**
- It loads the stab at the WING's loading (share = S_stab / S_wing × W per g). That is far harsher than a real tail
  limit load: even today's standard rod on the pusher pod cracks at 2.33 g.
- So "the twin floatplane holds, the light rod on a heavy plane fails" needs a realistic tail limit load (FAR
  23-style balancing + manoeuvring) or a reference factor. Otherwise the standard rods fail the "must hold" end.
- The twin floatplane (floatplane card, W0 508, the same 4130 rod) was not measured. Expect it near the pusher pod's.
