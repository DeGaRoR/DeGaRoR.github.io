# WING-FILLET STUDY — the wing-root fillet (9 Nov 2026, WING-FILLET, cloud)

The user, 9 Nov, through A0: *"In the spirit of what we did for the engine pylon, fitting an aerodynamic surface to
existing meshes, I'd like to have a body-wing blend piece generator. It's very clear on the DC-3 ... I believe it should
be an option, and I envision it as being a separate 3D mesh. But maybe it should really be a centre part of the wing? Or
maybe the whole centre section of the wing would be replaced by it? I think it's mostly targeting low-wing aircraft, but
not limited to it. Fast little planes also have this; it's particularly visible at the back of the wing, where there is
an extension towards the body. Ensure you understand the issue well first, then recommend the best topology, also
allowing for clean and believable crashes ... parasol wing? should probably reject; should blend the fuselage-wing on
biplanes probably. Always as an option: things stay as-is without the option."*

The reference photos (on A0's machine): a DC-3 with its big fillet circled (from ahead of the leading edge to well
behind the trailing edge, deepest under and behind the wing); a Sling-type and a Tecnam Sierra-type low-wing two-seater
with the trailing-edge fillet running the root aft along the fuselage side.

**What this pass delivers** (code on `claude/wing-fillet`, details in §6):
- `6 · wings > wing-root fillet`: none (default) / trailing-edge blend / full fillet (Kármán), size, aft extension;
- a separate mesh in the wing layer, fitted to the drawn skins by the engine pylon's method;
- off = every build bit-identical;
- GATE WINGFILLET.

Sources: each claim carries its source. Several primary sources (NTRS, airminded.net, kitplanes.com) could not be
opened from this cloud session (its network policy); where a claim rests on a search-result summary of a page I could not
open, it is marked *(summary)*. Engineering statements with no source are marked *(eng.)*: they are the reasoning, to be
read as such.

---

## 1. What a wing-root fillet does

**Interference drag.** Where two bodies meet, the drag of the pair is more than the sum of their drags apart: the
difference is *interference* (or *juncture*) drag. NASA CR-3811 (Kubendran, McMahon & Hubbartt, 1984) defines it so, and
puts its main contributor at the junction in the vortex formed by boundary-layer separation and roll-up
([NTRS 19840021784](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19840021784.pdf) *(summary)*). Hoerner's
*Fluid-Dynamic Drag*, ch. 8, collects the wing-body junction data; the student review "Wing fillets" (TU Košice) points
there and adds that sharp angles between body and wing separate early, so wider junction angles drag less
([wingfillets.pdf](https://peter.gasparovic.website.tuke.sk/students/wingfillets.pdf) *(summary)*). This sim already
carries Hoerner's number: `GEN_DRAG.junct` (60_gen_spec.js): 0.006 m² per wing root, **×1.5 for a low wing without a
fillet**, ×0.7 for a strutted high wing (62_gen_aero.js).

**Two flows at the root** *(eng., consistent with CR-3811 and the Cambridge papers below)*:
- **At the leading edge** the body's boundary layer meets the wing's stagnation pressure, separates and rolls up into a
  *horseshoe vortex* that wraps the root and trails along both sides of it. A small fillet at the leading edge weakens
  it.
- **Toward the trailing edge** two boundary layers (the wing's upper surface and the body's side) thicken in one corner
  against the wing's adverse pressure gradient. The corner separates first, earliest when the corner is ACUTE: a low wing
  under a round fuselage (the upper corner), a high wing on one (the lower corner). This is the separation that shook the
  tails of the early low-wing monoplanes, and it is why a fillet's radius grows toward the trailing edge.

**The low wing's problem, measured.** NACA Report 482 (White & Hood, 1934) tested a low-wing monoplane in the full-scale
tunnel for "detrimental interference at the intersection of the wing and fuselage": tail buffeting, flow surveys at the
root, and the devices that cure it, a wing-fuselage fillet among them
([NTRS 19930091556](https://ntrs.nasa.gov/api/citations/19930091556/downloads/19930091556.pdf) *(summary)*). Barnaby
Wainfan's *Wind Tunnel* column: with the junction and its fairing properly designed, a low wing's interference drag is
no higher than a high wing's ([Kitplanes, "Interference Drag Adds Up"](https://www.kitplanes.com/wind-tunnel-173/)
*(summary)*).

**History: the Kármán fillet.**
- In 1931 a GALCIT wind-tunnel model of the Northrop Alpha shook violently. The sharp wing-body corner separated the
  flow and threw a wake of eddies onto the tail. Von Kármán's assistants Klein and Clark Millikan worked on it
  ([Groh, "Dimensional Analysis ... Wind Tunnel Testing"](https://rgroh.com/aeroengblog/wind-tunnel-testing/)).
- Klein showed by wake surveys that a fillet whose radius *expands greatly* (toward the trailing edge) cures it; such
  fillets "are still called karmans" ([Annual Review of Fluid Mechanics, 1979](https://www.annualreviews.org/doi/pdf/10.1146/annurev.fl.11.010179.000245)
  *(summary)*).
- The "optimum fillet" was developed in the GALCIT 10 ft tunnel in May 1931 and flight-tested in June 1931. It was used
  on the second Northrop Beta and on the Gammas ([airminded.net, Northrop Alpha wind-tunnel research](http://www.airminded.net/alpha/alphawt.html)
  *(summary)*).
- The French are said to have named it "un kármán" after a conference talk (Groh, above; one source only, not
  confirmed).
- The same work carried on to the Douglas DC-1/DC-2/DC-3, whose model was tunnel-tested at GALCIT. Its big root fillet
  is the user's first photo *(the DC-1 GALCIT testing is well documented in the histories, but no page that says so was
  opened in this session)*.

**P-38: the cure, again, in the field.** The P-38's tail buffet was traced to the flow at the wing-nacelle/pod junction.
Lockheed's fix was wing-root fillets on the leading edge where the wing met the pilot's pod. Kits were sent to the
squadrons for the P-38E and earlier, and later production had them from the factory. The buffeting went; the
compressibility dive did not ([Plane & Pilot, "Why Were P-38s Falling From the Sky?"](https://planeandpilotmag.com/why-were-p-38s-falling-from-the-sky/);
[Smithsonian NASM, P-38J](https://www.si.edu/object/nasm_A19600295000) *(summary)*;
[Air Corps Library, tail buffeting P-38/F-4/F-5/322](https://aircorpslibrary.com/tail-buffeting-for-p-38-f-4-f-5-and-p-322-series/)).

**Spitfire.** Its large curved wing-root fairing (the walkway fairing) had to be hand-rolled on a panel press when the
first Spitfires were built ([Aeroscale forum](https://archive.aeroscale.net/forums/132245-page=213.htm) *(summary,
forum)*). Nothing on its aerodynamic design was found in this session.

**How much it buys, honestly.** Modern junction studies are less enthusiastic:
- A fillet designed for cruise incidence lowers the junction's peak turbulence and weakens the horseshoe vortex. But it
  "remains unclear whether the total drag associated with the junction flow can be reduced significantly"
  ([Aeronautical Journal, strake-like junction fillet](https://www.cambridge.org/core/journals/aeronautical-journal/article/abs/on-the-effect-of-a-strakelike-junction-fillet-on-the-lift-and-drag-of-a-wing/FFDFBE8C7EDB10338D57FC3FD68FB040)
  *(summary)*).
- A Virginia Tech wing/body junction with a 1.5 in fillet measured nearly the same drag as without it
  ([VTechWorks](https://vtechworks.lib.vt.edu/items/1883beb4-ddfb-4411-a80e-6f35cfb14852/full) *(summary)*).
- Builders report both ways: an RV builder lost speed after fitting a glass root fairing and went back to the stock part
  ([VAF forum](https://vansairforce.net/threads/wing-root-fairing.1191) *(summary, forum)*).

The big wins (1930s low wings, the P-38) were against **separation and buffet at an acute corner**, not against a clean
junction's friction.

## 2. Their shapes

- **The radius law along the chord** (Kármán / Klein, §1): small at the leading edge, growing to its largest at the
  trailing edge, where the adverse pressure gradient is.
- **The trailing-edge extension.** The fillet does not stop at the trailing edge. It runs on along the body side and
  closes onto it in a tapering planform: the DC-3's long aft fillet, and the Sling's and Tecnam's "extension toward the
  body" the user saw.
- **The leading-edge part** is small: a short rounded fairing that carries the root's leading edge onto the body (the
  DC-3's). Small fast two-seaters often have none; their fillet starts around mid-chord *(eng., from the user's
  photos)*.
- **Upper vs lower.**
  - A low wing's big fillet is on TOP, the acute corner.
  - The lower corner under a belly that curves in is obtuse and needs little or nothing.
  - A high wing on a round body is the mirror image (the corner under the wing).
  - A mid wing on a round body has two square corners, both filleted.
  - *(eng.: the geometry of a circle cut by a plane; the drag argument is §1's "acute corners separate".)*

## 3. How they are built and attached

- **A separate fairing is the rule in light aircraft.** It is secondary structure, screwed to the fuselage side and to
  the wing's upper skin, often with a rubber or felt seal at the edges:
  - an alloy fairing on the RVs; a fibreglass root fillet means more holes, including in the fuselage side above the
    wing ([VAF forum](https://vansairforce.net/threads/wing-root-fairing.1191) *(summary)*);
  - a fibreglass fairing sculpted over the wing root and the gear junction on a Sling 4 build log
    ([Sling search summary](https://www.slingpilots.com/forum/viewtopic.php?p=348) *(summary)*);
  - the AA-1 Yankee's wing-root fairing ([Wikipedia, Aircraft fairing](https://cavac.at/cavacopedia/Aircraft%20fairing)
    *(summary)*).
- **It comes off for inspection.** On the DC-3 the "shroud" between wing and fuselage is removed for inspection
  ([SimViation forum](https://forums.simviation.com/phpBB3/viewtopic.php?p=877991) *(summary, forum)*). On a Taylorcraft
  the root fairings come off to inspect the wing fittings ([Taylorcraft forum](https://vb.taylorcraft.org/forum/taylorcraft/everyday-taylorcraft-discussion/11218-wing-to-fuselage-gap-strips/page2)
  *(summary)*).
- **Integral fillets exist in moulded composite shells** (the fillet laid up with the fuselage or the wing skin) and as
  pressed skin panels on the Spitfire (§1). A *wing-centre-section skin* fillet is the exception, not the rule
  *(eng.)*.
- **Patent:** US 2,927,749, "Airfoil wing root fillet", for reducing interference drag along the root
  ([Google Patents](https://patents.google.com/patent/US2927749A/en)).

## 4. In a crash

A fairing is thin secondary structure, fastened by screws to two different primary structures: the wing and the
fuselage. When the wing moves against the body, the fasteners on one side or the other let go and the fairing tears,
bends and stays partly on each side *(eng.)*. Records of fairings failing, though none of them a wing torn off:
- KLM 777, Osaka, 2017: a ~4 kg wing-root fairing panel came off on climb-out; the bracket holding it had fractured
  ([AeroInside](https://www.aeroinside.com/10283/klm-b772-at-osaka-on-sep-23rd-2017-dropped-panel-on-climb-out)).
- Eclipse EA500: a wing-to-body fairing separated in flight, cause the fastener design
  ([AIN, final report](https://www.ainonline.com/aviation-news/business-aviation/2009-06-05/final-report-eclipse-lost-fairing-flight)).
- In an NTSB Cessna report the upper half of the left inboard wing fairing was found bent upward and aft *(summary of
  a search result; the report was not opened)*.

So: **the piece belongs to both sides, follows the root's members, and tears along the parting.** It never flies away
whole as a rigid debris body, and it never floats.

---

## 5. The topology: recommended — a separate mesh, fitted, in the wing layer

The three candidates, weighed against the user's four tests:

| | **separate fairing mesh** (chosen) | wing centre section replaced | fuselage patch (the sheet) |
|---|---|---|---|
| **look** (smooth, no seams, no z-fight) | tangent sheets whose feet sink into both skins at a small angle: a crease, never coplanar faces (measured, §7) | could be seamless with the wing, but the wing skin runs THROUGH the body (`_cage_wing.js`: the centre section is one loft bay between the roots, nothing clips it); the seam just moves to the body | seamless with the body; the wing seam stays |
| **robustness** across the garage | one rule for every body (the airframe contract `cageAirframe.surf`: round, box, hull) and every wing (rays on the DRAWN skin + flaps: taper, sweep, dihedral, crank, elliptic, cut centres) | every wing option (8 centre kinds, wells, flaps at the root, booms, the second plane's) touched | every body option (knife cuts, windows, doors, hulls) touched; a second plane twice |
| **the trailing extension** | yes: it is a fairing, it closes on the body | no: past the trailing edge there is no wing to extend | yes, but only on the body side |
| **off = identical** | trivially: nothing runs | needs the new centre to equal the old exactly | needs the patch to vanish exactly |
| **crashes** | the wreck classes it COVER and binds it to the frame members nearest each place: it parts along the root and tears (§7) | the centre is the wing's: it would go whole with the wing, never with the body | goes with the body |
| **cost** | 1 mesh in the existing wing-skin bucket (the Jodel's snapshot: the fillet's range in bucket `c8b95a2`, the wing's own) - **0 extra draws**; 1.1-3.6 k triangles a build | none extra, but every build's wing re-lofted | the body's subdivision grows |

**Recommendation: the separate mesh** (the user's own first instinct). It is also what real light aircraft have (§3),
and it is the only topology that gives the trailing extension and stays bit-identical when off.

**The method is the pylon's, turned on its side** (HULL-B16/B38, `_cage_eng.js pylonHug`, the house rule for fitting a
surface to existing meshes):
- In the pylon, a prism (the blade) flares onto what it stands on in quarter circles, each row reading the surface under
  its OWN position by a ray, with the ends sunk into what they meet.
- Here the prism is the wing root and the flare is cut in the CROSS PLANE at each chord station.
- *The body's section*: the airframe contract every fitting stands on (`GEAR_GEN.cageAirframe`, the drawn skin by rays
  from its axis, a 96 × 72 table).
- *The wing's two lines*: vertical rays through an indexed soup of the drawn skin AND the flaps and ailerons at rest
  (`wfCaster`; a flap that starts at the root is part of the root).
- *The corner*: where the body's section crosses the wing's line.
- *Each sheet*: upper and lower, a cubic from a foot on the body (the first section point standing h off the wing) to a
  foot on the wing (w outboard of the body's side), tangent to both, and sunk into both. There is no "PROPER-COWLS"
  document in the repo; the nearest written rule is REF_MATCH §4's "fitting a cowl (the user's rule)", and this follows
  its spirit: fit to the drawn surfaces, measure, gate the fit.

**The configurations:**

| wing | what is fitted | why |
|---|---|---|
| **low** (the main target) | the upper sheet with the Kármán law; the lower only where its corner is not obtuse (> 125°: skipped) | §1, §2 |
| **mid / shoulder** | both sheets, both with the Kármán law (a shoulder wing is the mid band nudged up: whichever corner is acute takes it) | two square corners on a round body |
| **high** | the trailing-edge blend under the root only (from 35 % chord), a short extension (0.14 chord), no upper sheet | the user's "probably only the trailing-edge blend" |
| **biplane** | each plane by its band: the lower plane blended to the fuselage, a parasol upper refused | the user's "should blend the fuselage-wing on biplanes" |
| **parasol** | **refused, said on the row**: "not fitted: a parasol has no wing-body contact (nothing to blend)" | no contact |
| **no contact** (a wing hung under the keel by hand) | refused with the gap measured: "its root does not meet the body (the wing stands 3-23 cm clear of it along the root)" | the Spitfire WIP card (§7) |

## 6. What was built (claude/wing-fillet)

**The rows** (`_cage_wing.js`, the group `wing-root fillet` under `6 · wings`, the `wings` part's rows in
`_cage_parts.js`):

| row | values | default |
|---|---|---|
| `wgFillet` | 0 none · 1 trailing-edge blend · 2 full fillet (Kármán) | **0** |
| `wgFilletK` | size, × the style's radius law, 0.4-2.0 | 1 |
| `wgFilletAft` | the extension aft of the trailing edge, root chords, 0-0.8, 0 = the style's own (0.26 / 0.32; 0.14 high) | 0 |

- All three are in `CAGE_DEFAULT_ABSENT`: absent from `spec.cage` at their defaults, so no saved build gains a key.
- The note on `wgFillet` says what was fitted and what was refused, and why.

**The radius laws**, in root chords against s (0 at the leading edge, 1 at the trailing edge):

| | big (the acute side) | small | ahead of the LE | aft extension |
|---|---|---|---|---|
| trailing-edge blend | 0.11 · smoothstep(0.25, 1, s) | 0.03 · smoothstep(0.55, 1, s) | none | 0.26 |
| full (Kármán) | 0.03 + 0.10 · s^1.6 | 0.015 + 0.035 · s^1.6 | 0.05 | 0.32 |

- The extension shrinks self-similarly, (1 − u)^1.6 both ways, and closes tangent onto the body.
- The fairing ahead meets in a ROUND nose; the extension meets on a sharp edge.

**Robustness features**, each from a measured failure on a test plane:
- **The feet stand off the body's SIDE, not the raw corner.** On the Jodel the belly rises over the wing aft and the
  corner slid 0.41 → 0.22 m inboard in three stations, which drew a horn. The body foot is now the first section point
  h off the wing, and the side point the outermost section point between the corner and the foot.
- **The ends are anchored at the corner's angle**, so the extension follows the body as it rises or narrows. Anchored
  at the side point, the Jodel's extension climbed the side to the waist.
- **The feet sink** (body 6 mm + 8 % of the radius, wing 3 mm + 5 %), so the sheet crosses each skin at a small angle. A
  tangent foot ran within a millimetre of the skin for centimetres and the depth buffer interleaved them.
- **A closed body everywhere.** Past the chord the two sheets meet on one edge, a missing sheet there is a flat plate
  from the body's side, and a run that stops is closed by an end fan: no hole to see into.
- **A run of fewer than 4 stations is dropped** (a corner flickering about the obtuse bound); the ends exist only next
  to a chord station that has a sheet.
- **The lower sheet's wing foot stays inboard of a root flap**, because a flap goes down through it. The upper sheet may
  rest on the flap's top at rest: the flap moves away from it.

**Material.** The wing skin's livery section (`wingSkin`, `wingSkin2` on the second plane) on the triplanar map: the
root cap plate's material, so it joins the wing's bucket.

**Physics: none** (§8). Mass: none. The flown spec is untouched; `wgFillet` is a drawing row.

## 7. The tests (pictures in `reports/evidence/WING-FILLET/`: `<plane>_<style>_<view>.png`, style 0 = off, q from above, qb from below)

The test set is GATE WINGFILLET's: Jodel (low, boxy), DC-3 (low, round, `tools/fixtures/dc3_2026-10.json`), RV (low
archetype), motorglider (mid, round), Cub (high), Tiger Moth (biplane), Pietenpol (parasol), Spitfire WIP (low, its
wing hung under the keel). Measured with each style:

| build | fitted | triangles (style 1 / 2) | note |
|---|---|---|---|
| Jodel | yes | 1600 / 2760 | the belly rises over the wing aft: the extension closes onto the belly |
| DC-3 | yes | 1640 / 2440 | the big fillet climbs the round fuselage, deepest aft: the user's photo |
| RV | yes | 1600 / 3200 | style 1 is the Sling/Tecnam trailing-edge extension |
| motorglider | yes, both sheets | 2320 / 3600 | mid wing |
| Cub | lower sheet aft only | 1080 | high wing |
| Tiger Moth | lower plane only | 1360 / 2200 | upper refused: parasol |
| Pietenpol | refused | 0 | "a parasol has no wing-body contact" |
| Spitfire WIP | refused | 0 | "its root does not meet the body (the wing stands 3-23 cm clear of it along the root)" |

The Spitfire WIP's refusal is a finding for REF_MATCH: the card's wing hangs 3 cm (mid-chord) to 23 cm (leading edge)
under the keel, so its root needs the card's wing height, or a belly fairing, before a fillet can blend it. That is a
garage gap (REF_MATCH §7), not this tool's.

GATE WINGFILLET's crash row, on the Jodel's flown snapshot with the full fillet:
- the fillet is one static range of the wing layer, in the wing's own bucket;
- every place is classed COVER (`skin_break.inhClass`) and bound by `bindInherit`;
- **654 places go with the fuselage's members, 466 with the wing's, 188 even**: it parts along the root.

## 8. Physics — the question for the user

**Would an interference-drag credit be honest later? Yes, a small one, on low wings only.**
- The sim already charges Hoerner's junction: 0.006 m² per wing root, × 1.5 for a low wing without a fillet.
- A full fillet on a low wing would take the 1.5 back to 1.0: −0.006 m² CdA for the aeroplane (two roots × 0.006 ×
  0.5).
- On a light two-seater of ~0.5-0.6 m² CdA that is about 1 % of the drag, a few tenths of a percent of top speed.
- A trailing-edge blend could take it to ~1.25.
- No credit for mid, high or biplane roots: Hoerner's penalty is the low wing's, and the modern data (§1) says a clean
  junction gains little.
- A fillet's mass (an alloy or glass fairing, 2-6 kg a pair *(eng.)*) would come with it.

**Default: no physics in this pass** (graphics and crash only, as the brief asked); the credit and the mass are a
one-line change in `62_gen_aero.js` and the mass ledger, offered as their own small chantier with a PHYSICS_V bump.

## 9. Questions for the user (each with the default this pass ships)

1. **The interference-drag credit** (§8): later, low wings only, −0.006 m² for the full fillet? *Default: no physics now.*
2. **Mass**: should the fillet weigh something (2-6 kg a pair) when the credit comes? *Default: no, not before the credit.*
3. **Paint**: the fillet wears the wing's livery section. Should it wear the fuselage's (on many real aircraft the
   fairing is painted with the body), or have its own row? *Default: the wing's.*
4. **The high wing**: the trailing-edge blend under the root only (the Cub's picture). Keep it, or refuse high wings
   too? *Default: keep.*
5. **The Spitfire WIP**: the card's wing hangs under the keel, so the fillet refuses it. Lift the card's wing (a REF_MATCH
   job), or build a belly fairing (a new tool)? *Default: neither in this pass; logged as a garage gap.*
6. **A seam bead** (the pylon's rubber joint) along the fillet's edges? Real fillets show a line of screws or a seal.
   *Default: none (the crease is the edge).*

## 10. Left open

- A belly fairing (a wing under a body that does not touch it): a different piece, not this one.
- The flown snapshot's first-in-process quirk: the first `snapshotOf` a node process takes draws the wing's buckets
  differently from every later one (the Jodel: wing ranges 11448/... then 13680/6060/...). Measured on master's code with
  the fillet off. GATE WINGFILLET takes a warm-up snapshot; DMGWALL/DMGLOOK owners may want to know.
- The cubic's handles are a circle's (0.39 of the feet's chord); an acute corner's true fillet would sit deeper.
  Tunable after the user's look.
