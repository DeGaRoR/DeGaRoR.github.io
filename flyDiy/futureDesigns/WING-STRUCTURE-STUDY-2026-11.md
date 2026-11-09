# WING-STRUCTURE STUDY (9 Nov 2026, WING-STRUCTURE for the user via A0)

The user, on the aircraft fiche: *"the fiche is beautiful"* — and the cutaway takes the wings off, so the fiche's cutaway
has a missing wing. **Replace it with the wing's proper internal structure.** The reference for the look is the user's own
Jodel wing in construction, hanging in the shed (`assets/jodel_structure/speedJojo_structureAileFull_optimized.obj`, baked
to `airframe_jodel_wing` by `tools/jodel_prep.py`, placed by `src/viewer/hangar.js` `wipWingHang`).

Rules from the brief: real research first; LIGHT; the spars match the spars the wing's normal texture prints; derived
from the rows, nothing per plane; shown on the fiche's cutaway, the garage's cutaway / see-inside, and a wreck whose
covering has opened; **graphics only** — no physics, no behaviour change.

Part 1 is the research, with a source beside every number (the list is at the end; **ESTIMATE** marks what no source
gave). Part 2 maps it onto the game's rows. Part 3 is what was built and what it costs.

---

## Part 1 — what real wings are made of

### 1.0 The user's own wing, measured (the reference model)

Measured off the OBJ (Blender, metres, 8.867 m span, 1.68 m chord):

| Item | Measured | Notes |
|---|---|---|
| Main spar | one deep **box spar**, its faces at x = 0.18-0.39 m behind the leading edge (inner panel), 0.23-0.34 m outboard: **13-19 % chord**, depth the section's at that station | the box reads as one plank-faced beam |
| Rib pitch | **0.38 m** on the outer panels (0.37-0.42), **0.19 m** in the centre section | the game's rule is one rib every 0.40 m |
| Ribs | spruce **capstrips + Warren diagonals**, small **oval ply gussets** at the joints; **nose ribs** forward of the spar | |
| Rear members | a triple strip at 65-83 % chord: the false spar and the aileron's own spar | game: rear spar 65 %, hinge per control |
| Root | three solid, tapering **ply root ribs** in the centre section | |

### 1.1 Jodel D11 / D112 / DR1050 (cantilever, wood, fabric)

| Item | Value | Source |
|---|---|---|
| Main spar | **single box spar**, alone carries bending and torsion; reinforced at the dihedral break, the gear and the fuselage attach | [S1] |
| Spar build | four spruce/pine flanges joined by plywood webs | [S2] |
| Spar size | ~22 cm deep, full 8.72 m span, no secondary spar (one builder's description; its "30 cm wide" likely includes the nose box) | [S3] |
| Spar position | **ESTIMATE ~25-30 %** from the aerofoil (NACA 23013.5 [S4], max thickness near 30 %); **13-19 %** measured on the user's model (1.0) | ESTIMATE / model |
| Planform | rectangular centre section, two trapezoidal outer panels with dihedral | [S1] |
| Ribs | light **truss ribs of spruce strips with ply gussets**, slid over the spar | [S1] [S2] [S5] |
| Rib pitch | ESTIMATE 250-300 mm (no source); **0.38 m** measured on the model | ESTIMATE / model |
| Leading edge | **ply D-box from the LE back to the spar**, fabric aft of it | [S1] [S6] [S3] |
| Rear member | small rear false spar at the trailing edge carrying the aileron hinges | [S1] |
| Aileron | truss ribs with ply gussets | [S7] |
| Struts | none (cantilever) | [S4] |

### 1.2 Piper J-3 Cub / PA-18 Super Cub (strut-braced, two spars, fabric)

| Item | Value | Source |
|---|---|---|
| Chord | 63 in (USA 35B) | [S8] |
| Spar spacing | ~31 in between spar centres (29.5 in inside the bracket holes, one PA-18) | [S9] [S10] |
| Spar positions | ESTIMATE front ~16-18 %, rear ~65-67 % (textbook range front 15-30 %, rear 65-75 %) | ESTIMATE / [S11] |
| J-3 spars | **solid spruce planks**: front 13/16 x 5-5/8 in, rear 7/8 x 4 in | [S12] [S13] |
| PA-18 spars | **extruded aluminium**, front ~5-11/16 in deep, rear 4 in; wing ~7 in thick at the front spar | [S10] [S14] |
| Ribs | **riveted (stamped) aluminium ribs**; nose ribs between the main ribs ahead of the front spar | [S15] [S16] |
| Rib count | 13 a wing (early PA-18), 16 on the 150 hp; pitch ESTIMATE ~16 in (400 mm) | [S10] / ESTIMATE |
| Drag bracing | **tubular drag/compression struts and stainless drag wires**; struts #1-#5, wires for 4 bays, crossings alternating | [S15] [S17] [S18] |
| Comparable | Aeronca 7A: 8 drag wires + 4 compression struts (4130 tube) between spruce spars | [S19] |
| Leading edge | **aluminium sheet 0.016-0.020 in**, screwed to the spar cap and rib caps | [S20] [S21] [S22] |
| Strut fittings | **a separate fitting on each spar**, spruce filler blocks inside the spar; two struts a side; jury-strut fittings | [S24] [S25] [S17] |
| Trailing edge, aileron/flap spars | ESTIMATE: an alloy channel spar at the hinge, formed ribs, a TE strip | ESTIMATE |

### 1.3 Cessna 172 (all-metal, strut-braced, semi-monocoque)

| Item | Value | Source |
|---|---|---|
| Type | semicantilever, semimonocoque: **built-up front spar**, formed fuel spar, rear spar | [S26] |
| Spars | the front spar carries the fuselage and strut fittings; the rear spar is partial span | [S27] |
| Spar positions | ESTIMATE front ~25 %, rear ~60-70 % (a student model: 25 / 58 %) | [S28] / ESTIMATE |
| Strut | **one lift strut a wing**, centred near WS 100 on the front spar | [S30] [S31] |
| Ribs | **formed sheet ribs whose flanged edges are the capstrips**; separate nose ribs | [S27] [S32] |
| Rib pitch | ~18 in from 1956-62 catalog stations (poor OCR); ESTIMATE 16-20 in | [S33] |
| Stringers | alclad stringers riveted to the skin; ESTIMATE 3-5 a surface between the spars | [S32] [S34] [S35] |
| Skin | 0.020 in outboard of the strut, 0.025 in inboard (a 1957 172) | [S36] |
| Ailerons, flaps | front spar with balance weights, formed ribs, V-corrugated skin; corrugated flap skins on many years | [S27] [S37] [S38] |
| Lightening holes | **flanged lightening holes** in the ribs | [S39] |

### 1.4 Composite — and a correction to the brief

**The Super Pétrel LS wing is not a carbon spar-cap wing**: tubular aluminium-alloy spars, PVC-foam ribs, a glass leading
edge and tips, fabric elsewhere; the carbon is in the hull and the tail boom [S40]. The game builds its wing from the
**carbon** row (`builds/candidates/superpetrel_V4_1.json`): the structure follows the row (Part 2's rule), so the Petrel
shows a moulded wing. If the user wants the real one, the right fix is the Petrel's wing row (an aluminium tube wing
under cloth: `aluFabric`), which is a physics change and not this chantier's — an open question below.

Generic moulded wing:

| Item | Value | Source |
|---|---|---|
| Main spar | **I-beam: unidirectional carbon caps + a woven shear web** | [S41] [S42] |
| Spar position | ESTIMATE 25-35 % | ESTIMATE / [S11] |
| Rear web | a rear spar/web carries the hinges | [S42] |
| Skins | glass-foam-glass (or carbon) **sandwich** in female moulds | [S43] [S44] |
| Web | GFRP-foam sandwich | [S45] |
| Ribs | **few**: root, attach, hinge ends, tip (ESTIMATE); foam-sandwich where they exist | [S46] |
| Moldless (Rutan) | foam core, glass web, UD caps, no ribs | [S48] |

### 1.5 General facts

1. **Lightening holes** are cut in ribs and frames to save weight, usually **flanged** [S39].
2. **Ribs** give the camber and carry the skin's loads to the spars; **stringers** are light members for shape and skin
   attachment [S39].
3. **Drag / anti-drag wires** criss-cross between the spars as a chordwise truss; **compression struts** take what the
   wires' tension puts between the spars [S39].
4. **Spar depth ≈ the aerofoil's thickness at the spar** less the skin and capstrips (the Cub's front spar 5-11/16 in where
   the wing is ~7 in) [S10] [S11].
5. A closed cell's torsional stiffness goes as its enclosed area squared: the D-box or the two-spar skin box is what makes
   a wing stiff in twist [S49].
6. **Rib pitch of a fabric wing** ~250-400 mm with nose ribs halving it at the LE (Flybaby 15 in, Acroduster 10.5 in,
   a homebuilt 240 mm) [S50] [S51] [S52]; rib-stitch spacing 2-3 in in the propwash [S50].

---

## Part 2 — the game's rows, and where each member stands

Everything the structure draws is read off a row the build already has; nothing is typed per aeroplane.

| Member | Row it stands on | Where the texture prints it |
|---|---|---|
| front / rear spar | `parts.planes[k].sparFront / sparRear` (GEN_RULES 0.15 / 0.65), on the spar NODES' line (61_gen_frame `WF/WR`), the same frame `63_gen_wing.js frameAt` lofts the covering on | the surface field's integer rails (`_cage_wing.js wingField` .w = 0 at the front spar, 1 at the rear; `aeroskin.js` "THE REAL MEMBERS", `dLv`) |
| ribs | the root + `parts.planes[k].ribZ` — 61_gen_frame's "one rib every 0.4 m" stations, the ones the mass model bills | the field's integer stations (.z; `dSt`) |
| compression struts, drag / anti-drag wires | the spar stations `[zRoot, ...zs]`: each plan bay's two diagonals and the station's spar-to-spar member (61_gen_frame "rule 4") — the very members `30_solver` breaks in a crash | — |
| stringers (stressed skin) | `GEN_BUILD_GRAMMAR[row].stringerPitch`, metres from the LE | the grammar's metric stringers (`aeroskin.js` `uG0.y`, `ds`) |
| the leading-edge cover | the D-box to the spar (wood), the alloy sheet ahead of it (PA-18) | the LE band (`uG4.z`, 0.12 m) |
| aileron / flap spars, false spar | `controls.aileron.span/chord`, `controls.flap.type/span/chord` — `genWingInto`'s bands and hinge fractions | the cut |
| strut fittings | `wf.R/L.strutF / strutR` (the lift strut's own station) | the brace layer's fittings |
| the section | the NACA digits (`genAfEval`), the chord law (`chordAt`), the elliptic walk (`ell`, `xFat/xRat`) | the covering itself |

**The kind** is the wing's construction row (`genSurfKey(spec, 'wing', k)`):

| Row | Kind drawn | Real reference |
|---|---|---|
| `fabric`, cantilever | **dbox**: spruce box spar with ply faces, spruce truss ribs with ply gussets, nose ribs, ply D-box over the nose, rear plank spar | Jodel (1.0, 1.1) |
| `fabric`, strut-braced | **cub**: two spruce plank spars, stamped alloy ribs, nose ribs, alloy LE sheet, tube compression struts, crossed drag wires | J-3 (1.2) |
| `steel` | 4130 tube spars, tube truss ribs, wires | the tail rows' tube wing |
| `aluFabric` | 6061 tube spars, formed outline ribs, drag cables | ultralight |
| `fabricAlu` (REAL-FIGURES-3, not on master) | extruded I spars, stamped ribs, alloy LE sheet, wires — ready, used the day the row lands | PA-18 (1.2) |
| `alloy` | channel spars (caps + web), plate ribs with flanged lightening holes, Z stringers at the grammar's pitch | 172 (1.3) |
| `carbon`, `glass` | caps on a foam-cored web, a rear web, few ribs (root, crank, strut, control ends, tip) | 1.4 |

Why the `fabric` row splits on the bracing and needs no new row: a cantilever wooden wing has to carry its torsion in a
closed box (fact 5: the Jodel's D-box), a strut-braced one carries it in the strut pair and its drag truss (the Cub's
wires). The bracing is a row the build already has (`parts.planes[k].useStrut`), and the physics row (wood + fabric) is
the same for both.

**The DMG member model** (`30_solver` members, `tools/_dmg_*`, GEN_CRASH): the wing's members are the spar caps between
stations, the station members (the ribs the mass model bills at the station, the compression struts) and the plan
diagonals. The drawn structure stands on the same stations, so in a wreck the drawn spar breaks where the solver's spar
member broke (part 3.3).

---

## Part 3 — what was built

See HANDOVER "WING-STRUCTURE". `src/viewer/wing_struct.js` (pure plan + make; `window.WING_STRUCT`), GATE WINGSTRUCT
(`tools/_wingstruct_check.js`), the cloud rig `tools/wing_struct_shot.js`.

---

## Sources

- S1 https://www.lavionnaire.fr/JodelAiles.php "Structure de l'aile du Jodel 112"
- S2 http://richard.ferriere.free.fr/D112/D112.htm "Le Jodel D 11 dans tous ses états"
- S3 https://essentialpilot.co.za/2017/10/15/jodel-d11/ "Jodel D11"
- S4 https://en.wikipedia.org/wiki/Jodel_D.11
- S5 https://jivaro-models.org/jodel_d112/page_jodel.html "Jodel D-112"
- S6 http://aeroconsult.free.fr/d20tp.html "D20"
- S7 https://www.avionsjodel.com/wp-content/uploads/2023/05/Descriptif-D112.pdf "Descriptif D112"
- S8 https://supercub.org/forum/archive/index.php/t-39855.html "US35b Full size print out"
- S9 https://www.supercub.org/forum/threads/j-3-strutsn.56089/ "J-3 struts"
- S10 https://www.supercub.org/forum/threads/pa-18-dimension-question.49701/ ; https://www.supercub.org/forum/threads/wing-differences-early-vs-later.20326/
- S11 https://ocw.uc3m.es/pluginfile.php/3411/mod_page/content/18/structural_component_aircrafts.pdf "Structural components of aircraft"
- S12 https://www.j3-cub.com/threads/wood-spar-dimensions.30635/
- S13 https://www.j3-cub.com/threads/spar-comparisons.30877/
- S14 https://www.aircraftspruce.ca/catalog/appages/piperwingspars_05-00875.php
- S15 https://alaskafloatratings.com/wp-content/uploads/2021/12/Piper-Super-Cub-PA-18-owners-manual.pdf
- S16 https://www.supercub.org/forum/threads/light-wing-build.39269/ ; https://www.supercub.org/forum/threads/nose-ribs-or-not.50798/
- S17 https://www.univair.com/content/partcatalog/18PM-flipbook/files/basic-html/page24.html (PA-18 parts catalog p.24)
- S18 https://www.shortwingpipers.org/forum/goto/post?id=59772 "Trammeling the wing"
- S19 https://www.univair.com/content/partcatalog/7ASM-flipbook/files/basic-html/page8.html (Aeronca 7A service manual p.8)
- S20 https://univair.com/piper/piper-blank-skins/csi-1016-piper-pa-12-leading-edge-blank-63-7-8-inch
- S21 https://www.supercub.org/forum/threads/18leading-edges.28405/
- S22 https://cdn.shopify.com/s/files/1/0651/4891/1838/files/Wing-pdf-install_-_leading_edge.pdf
- S23 https://www.univair.com/content/partcatalog/J3PM-flipbook/files/basic-html/page5.html
- S24 https://www.univair.com/content/partcatalog/11PM-flipbook/files/basic-html/page9.html ; https://www.univair.com/content/partcatalog/J3PM-flipbook/files/basic-html/page9.html
- S25 https://www.faasafety.gov/files/notices/2020/Dec/SB_0910A.pdf (Piper SB 0910A)
- S26 https://www.manualslib.com/manual/2601894/Cessna-172.html?page=16
- S27 Cessna 172N POH Section 7 (N734BW copy): https://static1.squarespace.com/static/5f342abff36a4047f6c8b53a/t/60d5eedc01cb417973f16332/1624633054654/N734BW_POH_Website-107-143%5B1%5D.pdf
- S28 https://rodrigodiaz.dev/projects/aircraft-wing.html
- S29 https://cessna172r.blogspot.com/2018/02/cessna-172r-structure.html
- S30 https://www.wingxstol.com/contenue/pdf/Install_Guide_172.pdf
- S31 https://cessna172r.blogspot.com/2018/03/wings-and-wing-struts.html
- S32 http://www.aeroelectric.com/Reference_Docs/Cessna/cessna-maintenance-manuals/CessnaSingle_1996on_structural_repair_MM_SESR04.pdf
- S33 http://www.aeroelectric.com/Reference_Docs/Cessna/cessna-maintenance-manuals/Cessna%20172%20&%20175%20Parts%20Catalog%20(1956-1962).pdf
- S34 https://lorentxo-bordagaray.odoo.com/wing-optimization
- S35 https://forum.cessna170.org/forums/viewtopic.php?p=47442
- S36 https://www.forum.cessna170.org/forums/viewtopic.php?t=2444
- S37 https://www.manualslib.com/manual/1384562/Cessna-172r.html?page=221
- S38 https://www.mcfarlaneaviation.com/articles/control-surface-skins-landing/
- S39 FAA-H-8083-31 Aviation Maintenance Technician Handbook - Airframe, ch.1
- S40 https://en.wikipedia.org/wiki/EDRA_Aeronautica_Super_P%C3%A9trel ; https://www.aircraftpilots.com/aircraft/recreational-3-axis/edra-aeronautica-super-p%C3%A9trel-r586
- S41 https://en.wikipedia.org/wiki/Alisport_Silent_2
- S42 https://www.researchgate.net/publication/395791192_Aerodynamic_Design_and_Performance_Analysis_of_a_Morphing_Wing_Racing_Sailplane
- S43 http://www.airbum.com/pireps/PirepGlasairIII.html
- S44 https://en.wikipedia.org/wiki/Rolladen-Schneider_LS6
- S45 https://pmc.ncbi.nlm.nih.gov/articles/PMC7287895/
- S46 https://en.wikipedia.org/wiki/VFW-Fokker_FK-3
- S48 https://www.homebuiltairplanes.com/forums/threads/wing-basic-structural-concept.3750/
- S49 https://es.slideshare.net/scemd3/lec5torsion-of-thin-walled-beams
- S50 https://www.kitplanes.com/build-your-skills-fabric-6/ ; https://www.aircraftspruce.ca/catalog/kitspages/perspectivesOct2014.php
- S51 https://groups.google.com/g/rec.aviation.homebuilt/c/QKfoeKRLhX0
- S52 https://kristijanaero.github.io/composite_wing/structure.html

Research note: the session's fetcher could not reach the hosts (DNS), so the numbers above were taken from the search
engine's summaries of the named pages, not the full documents; the FAA handbook and AC 43.13-1B were matched through
quoted copies. Every number a source did not give is marked ESTIMATE.
