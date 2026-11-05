# THE SUPER PETREL LS: study and recreation plan (2026-11-05, branch claude/hull-types)

The user's call (5 Nov): "the super petrel is really a tub and a boom. It's bi-plane, with the engine support doubling as
wing support. We may fake it here with a pylon mounted engine and a biplan, that we make fit, even though the structural
connection wing-engine is not there. It should be a pod and rod design, and the hull should be recreated correctly, as it
has a particular, detailed shape. Study this plane well, we'll need to recreate it, and it needs a new hull ... do the
landing train too. Let's give some love to this one, and let's focus solely on it for now."

## 1. The aeroplane (sources: the user's four images; the web where it was reachable)

Numbers (Wikipedia via search summaries, sale listings; the LS, not the longer-hulled XP):

| | Super Petrel LS |
|---|---|
| length | 6.25 m (one registry entry: 6.6 m) |
| span (upper) | 8.90 m (one entry: 8.3 m) |
| height | 2.2 to 2.33 m |
| wing area (both planes) | 15.0 m2, NACA 2412 |
| empty / max take-off | 320 kg / 600 kg |
| engine | Rotax 912 iS, about 100 hp, PUSHER (914 UL turbo variant, 115 hp) |
| fuel | 90 L |
| stall / climb / ceiling | 37 kt / 1000 to 1400 ft/min / 12 to 14 000 ft |
| gear | tricycle, RETRACTABLE (an amphibian) |
| construction | carbon / epoxy foam monocoque hull, Kevlar-reinforced; wings composite and fabric |
| lineage | the Tisserand Hydroplum (Brazil: Scoda Aeronautica, later EDRA) |

Read off the images (the user's four: on the water, the side drawing, a 3D model in wireframe, from below; and the three-view):

- **THE HULL, a tub.** Short and wide, carrying the cockpit and nothing aft of the step but its own taper:
  - **Bow**: a long raked forefoot, the keel rising in one curve from the step to a sharp stem at deck height (a speedboat's bow), well flared.
  - **Strakes**: hard chines with spray strakes along the sides. The drawing shows two lines below the stripe, bow to step; from below the bottom is longitudinally stepped.
  - **Step**: a single transverse step under the lower wing.
  - **Afterbody and boom**: the afterbody is short. Its deck and keel close in and rise into a SLENDER BOOM, a tapered tube climbing to the tail. Pod and rod.
- **COCKPIT**: two side by side, low in the tub, a two-piece canopy (windscreen and a rear hood); the deck rises to it from the bow.
- **THE TOWER**: behind the cockpit a tall faired tower stands on the deck. It carries the engine at the upper wing's centre and doubles as the upper wing's support (cabane). The engine is a PUSHER: its nacelle bulges at the tower top under the upper wing, the propeller turns just aft of the upper wing's trailing edge, over the boom.
- **WINGS, a staggered sesquiplane**:
  - **Upper**: straight, rectangular, 8.9 m, on the tower; the tips turned down (drooped).
  - **Lower**: shorter, rooted on the hull's side at about the gunwale stripe, with dihedral; slightly more incidence than the upper; turned-down tips; the main wheels retract into its roots.
  - **Struts**: one N / V interplane strut pair a side, at about 0.6 of the lower semispan.
- **WATER STABILITY**: two small STEPPED FLOATS hung under the LOWER wing, under the interplane struts (the wing's sponsons; early aircraft had strut tip floats).
- **TAIL**: a tall swept fin on the boom's end, the tailplane LOW on it (about a third of the fin's height, cruciform), a big rudder.
- **GEAR**: the mains fold up into the lower wing's roots / the hull's side (visible in their wells from below); the nose wheel retracts into the bow under the forefoot.

## 2. What the garage has, and what it does not

| feature | the garage today | gap |
|---|---|---|
| pod and rod, buoyant afterbody | hull + rod + taper: the lofted buoyant pod and its cone (HULL-B23/B27) | the Petrel's tub proportions; the boom is a TAPERED tube rising (the rod is constant) |
| the bow | the cage nose rings with the hull's V (noseLen) | **the raked forefoot** (the keel rising in one curve to a sharp stem at deck height) |
| strakes / stepped bottom | none drawn (32_hydro's float family has spray rails) | **hull strakes** (spray rails along the bottom, drawn; and the "batman" fluted bottom later, the Canadair's) |
| cockpit and canopy | the cage's canopy modes (bubble, open) | sizing to two abreast in a tub |
| the tower | the over-the-wing pylon on the roof behind the cabin (engPylonAt 1), blended fairing (engPylonFair 3) | its proportions (a tower, the nacelle bulging at its top); the upper wing on it (the parasol's cabane stands in) |
| the planes | the biplane tile (a parasol over a low or mid second plane), each plane its own rows | the second plane short, with dihedral, rooted on the hull's side |
| the floats under the LOWER wing | strut tip floats hang under plane 0 only | **floats on the second plane** (hullTipPlane) |
| retractable tricycle | claude/retract-study (RETRACT-1 / GR, the Catalina's hull study included): merged into this branch | **wheels on a HULL** (an amphibian: gear.type 'hull' + a retracting tricycle) |
| tail | the rod's fin and stab; stab height rows | the low (cruciform) stab on the rod |

## 3. The plan (one at a time, each flown and rendered against the images)

1. Merge claude/retract-study (done in this session: 19 hunks, the tailwheel work of master and the gear's both kept).
2. THE AIRFRAME AT ITS SIZE: a recreation card (`superPetrel`): the pod and rod hull at 6.25 m, two abreast, the
   sesquiplane (8.9 m upper, the lower shorter with dihedral), the tower pylon pusher (912 iS), the tail; flown on the
   water (hull_matrix) and rendered against the side drawing.
3. THE HULL: the raked forefoot bow and the strakes, as rows of the hull (drawn = flown: the table reads the bow).
4. THE LOWER WING'S FLOATS: tip floats on the second plane.
5. THE GEAR: the retracting tricycle on a hull (an amphibian), the mains into the lower wing's roots, the nose into the bow.
6. Love: the tower's shape, the canopy, the livery (the red and blue sweep).
