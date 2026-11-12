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

## Step 2 (12 Nov): the code, the twist check
The user ruled all six defaults. Code: origin/claude/aero-body-1 (5cce2de4). COWL-BILL rides it (A0).
  built/load.js <k> <file>     the build through the NEW load door (the join writes fuselage.aeroBody) -> built/spec_<k>.json (not committed)
  built/measure2.js <k>        before = master's core (built/flight_core_master.js: git show origin/master:flyDiy/tools/flight_core.js),
                               after = the branch's -> built/m_<k>.json (plaque, empty, CG, SM, Cn_beta, substeps, design rows,
                               the cowl's kilos)
  built/cmp.js <k>             the branch's core without the record against master's: the def, to the bit (true on twin, chinook, cub)
  twist.js <k> [F]             THE ROD IN TWIST (the user: "anticipate issue with rigidity and ability to withstand twist with a
                               more accurate model"): GATE FLEX's tail-arm rig (test_flex.js statTail: pinned per substep), +-F at
                               the stab tips; the lattice on the cone (today), moved onto the drawn tube, and that with the tube
                               element off -> twist_<k>.json (the last ring's twist, the post's, the stab's roll, the worst member,
                               substeps). Findings on plan.html: the tube element carries all of the twist (off: 42-45 deg, 200
                               substeps); the nodes on the tube are safe with it (+4-16 % roll, +6-20 % substeps) except the v8
                               pusher, whose core box runs 0.5 m past its drawn pod (a pinch, 4.2 % strain); the tube's torque limit
                               was its material's - a d/t 75-95 tube buckles at ~half (now capped: Timoshenko & Gere, 0.3 E t/r)
