# STRUT-OPTIONS — READY (2026-11-10, branch `claude/strut-options`)

The user, 10 Nov (on the Ruckus and the Cub): *"we have by default these profile struts. I would like an option so
that these are simply tubes. And then ... from the middle of the truss, you got another half one going back towards
the cabin ... and it's the case on the cub as well. So I would like that we model this little one as well. And maybe
all of these could be options of the struts."*

## What changed

Two new rows in the wing's **struts & fixation** group (`tools/_cage_wing.js`), shown when the wing is strut-braced:

| row | stops | spec field | absent / 0 means |
|---|---|---|---|
| `wgStrutSec` strut section | profiled · round tube | `bracing.section: 'tube'` | the streamline strut every build had |
| `wgJury` jury strut | none · up to the wing · back to the cabin | `bracing.jury: 'wing' \| 'cabin'` | no jury strut |

- **Round tube** (`section 'tube'`): drawn as a round tube of `GEN_STRUT_OPT.tubeD` (44.5 mm), squeezed into the same
  blade at both ends so the clevis fittings are unchanged — in the garage (`_strut_gen.js strutBuild`, the path the
  game draws with too) and in the fallback beam mesh (`63_gen_wing genBeamInto`). Its drag replaces the streamline
  bill (below). Mass unchanged (see sources).
- **Jury strut** (`jury`): a member of the truss (`61_gen_frame.js`, the strut fan). A clamp node (`'JS'`) on each lift
  strut at `juryAt` = 0.5 of its length; the strut becomes two halves at **2 k each** (the solver's member force is
  `k dL`, so the pair in series is the strut's own axial spring) whose masses sum to the strut's. From the clamp:
  - `'wing'` — the J-3 / PA-18 arrangement: up to the wing's spar at the station nearest the clamp, inboard of the
    lift strut's own (front clamp to front spar, rear to rear);
  - `'cabin'` — the Ruckus's as the user describes it: aft and in to the fuselage's wing-side longeron one ring behind
    the strut's foot.
  A clamp on a straight strut with one brace is a hinge, so the pair's clamps are joined by a **hidden, massless tie
  and diagonal** (the jury fitting's own stiffness). GATE STRUTOPT's rank test found the mechanism without the
  diagonal (rank 3n-8) and holds 3n-6 with it. On a single strut the rear member is still in the truss (hidden), as
  are its halves, its jury (massless) and the ties. The jury is drawn (a light tube or streamline of `juryT` = 25 mm,
  a clamp collar on the strut, an end collar), weighed (`juryMassK` x the wing class's per metre) and billed its drag.
- **Buckling**: unchanged. 30_solver's G1812 deliberately does not Euler-buckle the wing class (the drawn lift struts
  work in compression at positive g in this lattice and a thin tube of their A would kink at 2.7 g in flight); no
  sourced reason to change that here, so the jury members are not buckled either. The jury does halve the strut's
  free column: when the certificate (DMG-D2) comes to buckle lift struts, a jury build's column is the half (`'half'`
  members), i.e. 4x the Euler load — the members are tagged for it (`bm.strut`).
- **Save / load**: `wgStrutSec` / `wgJury` are in `CAGE_DEFAULT_ABSENT` (`_cage_gen.js`: a save writes them only when
  set) and in `GEN_CAGE_ROW_NEUTRAL` (`60_gen_spec.js`: every key the game hashes a build by drops them at 0). The join
  (`_cage_join.js`) STATES both fields (null when back at 0, so the garage's merge takes them off) and the normaliser
  deletes anything but `'tube'` / `'wing'` / `'cabin'`. `LB.loadBuild` (the page's own chain) carries them through —
  measured: the variant re-joins with exactly 4 leaves different (the two cage rows, the two bracing fields).
  Archetype cards (`_cage_design.js designBake`) take the rows too. The parts map (`_cage_parts.js`) lists them under
  the struts part's `options`. New core names exported for node (`90_node_exports.js`): `GEN_STRUT_OPT`,
  `genStrutOpts`, `genStrutOptCdA`.
- **No card changed** (Cub, Cessna, Jodel untouched); `builds/rufus_2026-10-18_certified.json` untouched.

## Drag and mass — the figures and their sources (`GEN_STRUT_OPT`, `60_gen_spec.js`)

| figure | value | source / reasoning |
|---|---|---|
| `cdStream` | 0.10 on thickness | the model's existing streamline-strut figure (62_gen_aero genGearCdA, G185 truss), kept. Hoerner, *Fluid-Dynamic Drag* (1965) ch. 6: streamline strut sections at t/c 0.25-0.33 are ~0.06-0.10 on frontal |
| `cdRound` | 1.1 on diameter | Hoerner ch. 3: circular cylinder across the flow below the drag crisis, 1.17 two-dimensional, ~1.0 at finite L/D 20-40; Re = V D / nu ~ 3e4-1e5 for a 25-50 mm tube at 15-35 m/s is well subcritical. The strut lies in the plane normal to the flow, so no sweep relief |
| `tubeD` | 0.0445 m (1.75 in) | ultralight round lift struts are 1.5-2 in 6061 tube (Ruckus / Solo 103 class, Kolb, Quicksilver) |
| `juryT` | 0.025 m (1 in) | a jury strut's frontal, round or streamline (the J-3's are small streamline tubes) |
| `juryAt` | 0.5 | "from the middle of the truss" (the user); J-3 / PA-18 jury clamps sit near mid-strut |
| `juryMassK` | 1 | MEASURED: the wing class bills 0.50 kg/m on the Ruckus's lift strut (0.72 on the Cub's steel); a 1 in x .035 4130 jury tube is 0.53 kg/m, a 25 x 1.2 mm 6061 one 0.24 kg/m — the class's per metre sits in that band |
| section mass | unchanged | a streamline strut is a round tube formed to shape on a die at constant perimeter (Univair / Wicks streamline tubing; the Cessna 172's 3.5 in round tube formed to a streamline, `_strut_gen.js` STRUT_FIT notes): same metal per metre |

**The bill** (`62_gen_aero genStrutOptCdA`, `params.drag.strutOpt` for the ledger): a round strut takes back
genGearCdA's streamline bill (2 x 0.10 x 0.06 x 0.55 semispan x 1.12) and pays every DRAWN lift-strut member
`cdRound x tubeD x L`; a jury pays its drawn length `x juryT x` its section's Cd. Hidden members pay nothing. No row,
no key, no term.

**Where it acts** (REAL-FIGURES' finding, 10 Nov): the first cut added it to the body's axial row (`fusCdA[0]`), which
the solver applies at the cabin ring's blob. It now acts **on the struts**: one 4-node blob a side on the strut's foot
and its wing end(s) (`61_gen_frame refs.strutDrag`, `params.strutCdA` = each side's axial CdA, `30_solver` blob), so
each side reads its own air. Both keys exist only on a strut-option build. The streamline bill it takes back stays
on the body row (0.03 m² on the Ruckus), as before.

**The design check's stability rows, measured** (`genDesignCheck`, the Ruckus std through the load door,
`reports/evidence/STRUT-OPTIONS/design_check_ruckus.txt`). REAL-FIGURES saw SM 7.6 -> 17.1 % and the spiral turn to
a fail with round tubes. The cause is **not where the drag sits**: the design check evaluates at the build's own
autopilot cruise speed (`params.ap.VCruise`), and the round tubes' drag lowers it from 26.3 to 19.6 m/s (V pair).
At equal speed the numbers barely move:

| Ruckus, V pair, round tube + cabin jury | SM | spiral (s) | dutch damping |
|---|---|---|---|
| profiled, no jury, at its own 26.3 m/s | 0.150 | warn 10.5 | 0.260 |
| at 26.3 m/s, drag on the struts (this fix) | 0.157 | warn 10.2 | 0.282 |
| at 26.3 m/s, drag on the body row (the first cut) | 0.157 | warn 9.5 | 0.265 |
| at 26.3 m/s, no strut drag at all | 0.157 | warn 9.5 | 0.265 |
| at its own cruise, ~19.6 m/s (drag on the struts) | 0.258 | **fail 3.7** | 0.368 |
| *profiled, no jury, flown at 19.6 m/s* | *0.248* | ***fail 3.8*** | *0.342* |

The body-row placement and no strut drag read the same: the check's derivatives do not see the axial row's position.
The drag on the struts adds a little yaw damping (dutch 0.265 -> 0.282, spiral 9.5 -> 10.2 s). The profiled Ruckus
fails the spiral the same way at 19.6 m/s. So the fail belongs to this airframe at a slow cruise, whatever the
struts; it is not a strut-drag bug. Whether the check should judge the spiral at the autopilot's cruise speed is a
design-check question, outside this chantier.

## Measurements — the Ruckus (standard) and its variants

`builds/candidates/ruckus_std_2026-11-09.json` → `builds/candidates/ruckus_struts_2026-11-10.json` (recipe
`builds/edits/ruckus_struts_2026-11-10.edits.json`: `wgStrutSec 1, wgJury 2`, re-joined with `tools/_rejoin_build.js`;
in the candidate pool as **Ruckus (round struts, jury)**). `node tools/real_check.js ... --quick` (the analytic band,
no pilot), MTOW 249 kg; logs in `reports/evidence/STRUT-OPTIONS/real_check_quick_*.txt`.

| Ruckus | empty kg | CdS m² | Vmax km/h | V75 | L/D | ROC m/s (Vy) | TO grass m | SM % |
|---|---|---|---|---|---|---|---|---|
| standard (profiled, no jury) | 158 | 0.91 | 118 | 103 | 7.0 | 3.29 (77) | 52 | 14 |
| round tubes only | 158 | 1.19 | 106 | 90 | 6.2 | 2.74 (70) | 55 | 18 |
| jury to the cabin only | 160 | 0.92 | 118 | 102 | 7.0 | 3.27 (77) | 52 | 14 |
| **round tubes + jury to the cabin** (the candidate) | **160** | **1.28** | **102** | **87** | **6.0** | **2.58 (68)** | **56** | **20** |
| V pair + round tubes + jury | 162 | 1.68 | 90 | 75 | 5.2 | 2.05 (61) | 60 | 24 |
| *reference (B&B airframe sheet)* | *115* | | *87 (83-91)* | *80* | *4.6* | *3.30* | *107* | |

Frame (GATE STRUTOPT): round tubes add **+0.273 m²** drag area (single strut a side, 2 x 3.08 m) and nothing else;
the cabin jury +1.66 kg (3.35 m drawn) and +0.008 m² profiled / +0.092 m² round; the wing jury +0.64 kg (1.28 m).
The V pair is shown for comparison only — the user described one strut and a "half one", so the candidate keeps the
Ruckus's single strut. The round tubes move Vmax and L/D toward the brochure (the Ruckus is a draggy open frame)
and the climb away from it (its gap was already power-side); the SM rise is the axial body drag's moment, read, not
tuned. These are the user's to judge — the physics only moves behind the new rows.

Renders (`tools/quickshot.js`, `reports/evidence/STRUT-OPTIONS/`): `ruckus_before_{side,q,persp}.png`,
`ruckus_after_{side,q,persp}.png` (round tubes + cabin jury), `ruckus_jurywing_persp.png` (the J-3 style: profiled V
pair with juries up to the spars).

## Bit-identity of the shipped builds

`tools/_strut_opt_digest.js` (certificate key + sha1 of nodes, beams, params) over all 36 builds in `builds/` and
`builds/candidates/`, **through the game's load door** (`_load_build.js`) and raw: before (base `9cf60dd2`) and after
are **identical** for every build (`reports/evidence/STRUT-OPTIONS/digest_{before,after}.txt`; the only new line is
the new candidate).

## Gates

GATE STRUTOPT (new, core, ~15 s through the load door): **PASS**.

The full core battery (`run_gates.js`, 321 jobs) could not finish on this cloud box: the container was restarted
twice under it (at 4 jobs, then at 2). So the gates this change can reach were run by name (`--only`), and every red one
was run again on the base commit `9cf60dd2` (a worktree) to compare:

| gate | this branch | base `9cf60dd2` |
|---|---|---|
| STRUTOPT (new) | PASS | — |
| STRUT, PILLAR, PARTS, CANDIDATES, GENPAIRS, CLIP, STRESS, HONEST, SKIN, UISMOKE | PASS | — |
| GEN (4 shards) | FAIL: 76/77, *cruise is quiet in wind* only | known red on master (brief) |
| JOINPARITY | 5 FAIL (Cub / Jodel node = page masses, the Cub nose tank, the metal Cessna fixture, the raw-readers list) | the same 5 |
| LOAD | FAIL: *every airframe survived the ultimate load* | the same |
| DESIGN | FAIL: propPitch / brakesT tiles with no drawable icon | the same 13 lines |
| DMGCERT | FAIL (the ultimate-load bench breaks: 5 lines) | the same 5 |

JOINPARITY's raw-readers list does not include `_strutopt_check.js`: it read builds raw at first, then was moved to
the load door. The new tiles in DESIGN draw: the gate's findings are the base's lines exactly. Not run: the full-tier
sweeps (ARCHETYPES, PILOTMATRIX, SEAPLANE, HOTHIGH) and the rest of core (ENGCONFIG pins, a known red, among them).
None of them can see a build without the new rows any differently, because the 36 shipped frames are identical through
the load door. A jury or tube build is held by STRUTOPT, not by any of them.
