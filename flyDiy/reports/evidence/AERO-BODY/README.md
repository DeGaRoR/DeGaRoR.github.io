# AERO-BODY, step 1: the drawn body against the flown one, and the model that replaces it (11 Nov 2026)

The plan page (published for the user): plan.html here, https://claude.ai/artifact/JpRU2nPkPWCheZNb2YeEQo
No game code changed. Everything runs in node on the built core (tools/flight_core.js at 0c90344f).

Run order (from this directory; paths to the repo are absolute to /workspace/DeGaRoR.github.io):
  cat planes.txt | xargs -P 3 -L 1 node specs.js           each build through the load door (tools/_load_build.js) -> spec_<k>.json
  PROBE=probe_af.js    OUTP=probe_ node probe_run.js <k> <file>   the drawn skin: the gear layer's own sampler (CAGE_GEAR.AF) in the
                                                            headless editor, 81 stations nose -> tail, the firewall / keel datums
  PROBE=probe_cowl.js  OUTP=cowl_  node probe_run.js <k> <file>   the cowl layer: which face (nose / aft), its vertex slices
  PROBE=probe_cowl2.js OUTP=cowl2_ node probe_run.js <k> <file>   the cowl layer's triangles cut column by column (top, bottom,
                                                            half width): the drawn cowl's silhouette, PROPER-COWLS' own mesh
  AB_MODEL=A|B [AB_CDB=hoerner] [AB_RODCD=1.2] [AB_THETA=20] node measure.js <k>   before (the core as built) -> after (the
                                                            drawn aero body) -> ab_<model>[_variant]_<k>.json
  node struct.js chinook rufus birdman v8pusher v7twin      the rod's structure: the lattice as built against the lattice on
                                                            the drawn rod (mass, aft nodes, Izz, CG, bay faces)
  node gen_page.js                                          plan.html from plan_tpl.html and the json

core_ab.js is the prototype: the built core with five hooks (the tail-arm floor off on boom layouts; genFusCdA on the
measured table: forebody + base, the rod; the side areas and the aft side-force point at the drawn aft area's centroid;
the twin booms' own side-force point, a third blob in the solver) and recOf(), what the join would export as
fuselage.aeroBody. Model B: separation where -d(r_eq)/dx > tan 20 deg; forebody cdWet x Swet x (1 + 1.5/f^1.5) x boxK
(Hoerner, Fluid-Dynamic Drag ch. 6); base 0.14 x A (Raymer, Aircraft Design 12.37); rod 0.004 x pi d L. Closed bodies
(the tail on the body) keep Raymer's 1 + 60/f^3 + f/400 and today's side-force point.
