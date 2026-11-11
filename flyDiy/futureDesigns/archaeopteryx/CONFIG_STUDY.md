# THE HUB AND THE HANGING NACELLE - a configuration study, revision 2 (2026-11-11; the user's decisions in section 10)

Revision 1 (same file, in git: 0af737863) proposed a new frame built from the wing down, a beam and a pylon as new
geometry, a crew anchored on the beam, and a one-surface blended centre section. The user's answer turned it round:

> "Let's be reasonable and reuse as much as we can. The one-surface blended centre section is not a priority ... the twin
> booms already fit that way ... start with the simplest connection that exists ... keep the cage subdivided and
> everything, but with its own materials and able to collapse ... it is really a tent ... the V struts ... include them
> already in the cage ... the naked version can be what you get with no skin ... everything is attached to the centre
> section ... the heart of this plane ... sockets for everything ... would this design allow trikes ... a hanging
> nacelle ... the aft bulkhead becomes the aft part of the pillar where we put pusher engines ... the true single-wheel
> gear type, we will reuse it on other gliders ... a skid with a fairing in front ... not a completely different
> generator, a natural extension with a preserved mental model."

This revision is the design that answers that. **Study only, no code.** Every hook was opened at the line cited
(the three surveys behind revision 1, re-checked).

## 1. The mental model: two words

**THE HUB.**
- The wing's centre section, the heart of the aircraft. The wings bolt to it (the Archaeopteryx's outer panels come
  off), and so does everything else.
- It has sockets:
  - **sides:** the wing roots;
  - **back:** the tail boom;
  - **bottom:** the pylon;
  - **front underside:** the V struts' heads;
  - **top:** an over-the-wing engine.
- It is the existing centre section and its carry-through, not new geometry. Its sockets are the carry-through's
  nodes plus drawn fittings.

**THE HANGING NACELLE.**
- A body family, like the hull is. The cage's cabin, unchanged in shape, hangs under the hub on a pylon, instead of the
  wing sitting on a structural cabin.
- It sits on the same tile as "Cabin" (the body that carries). It is not a new generator: the same cage, the same
  rings, the same skin.
- What changes is **which members carry and what they are made of**: a few hard members, the rest a tent.

**The tent collapses; it does not tear.**
- The nacelle's skin and most of its cage are a tent: ripstop over thin poles. Without the beam it folds.
- It deforms and folds before it rips: the poles buckle, and the cloth stretches.
- **No skin** (the Covering tile's "Open frame") gives the naked Standard version: the hard members only.

## 2. The parts, each on something that exists

| part | what it is | built on (existing) | what is new |
|---|---|---|---|
| **hub** | the centre section + carry-through | `wgCentre` constructions (60_gen_spec.js:3637; 63_gen_wing.js:1266-1350); carry-through nodes WF/WR/WB/FB/RB (61_gen_frame.js:1285, 1537, 1573-1584) | the sockets named (node sets) and drawn (fittings) |
| **tail boom** | a single boom off the hub's back | the TWIN BOOM: roots tied to the spar nodes and box caps, the root bay clustered rigid (61_gen_frame.js:2059-2087); drawn by the wing layer off the TE (_cage_wing.js:2557-2700) | one boom at x = 0 (today `boomX` min 0.6, _cage_page5.js:1160) |
| **rear socket** | the boom's fitting on the hub | the pod-and-rod's BOLTED SOCKET: plate, sleeve, bolts, already tagged `fit` (_cage_gen.js q4, :6833-6880) | drawn on the hub's rear spar instead of the bulkhead |
| **pylon** | a single straight wing-section mast on the centreline from the hub's bottom socket to the nacelle | the over-the-wing engine pylon's drawing: `engPylonForm` 'single blade', `engPylonFair` 'wing-section fairing' (_cage_eng.js:666-668); physics as a `'cabane'` tube (Euler buckling already covers `cabane`, 30_solver.js:767) | turned downward; its length free (the wing can stand above the cabin, as the parasol's `cabaneH` does) |
| **pusher on the pylon** | the old aft bulkhead's job, on the pylon's aft face | `engMount` pusher on `engineFaces` (_cage_cowl.js:596-628); the shaft (`cw_noseOff`) | the face read off the pylon's aft edge |
| **keel beam** | the nacelle's keel rail, made structural; a visible faired beam on the naked version | the cage's keel level and the frame's bottom longerons (61_gen_frame.js:778-797); the pylon's wing-section drawing | a member material by ROLE (§3); its fairing drawn when there is no skin |
| **V struts** | from the nose up to the hub's front fittings: rigid tubes | the cage's A-pillars (`apilW`, `apilPerp`, `cabPillarW`, _cage_page5.js:1283-1286); tube members | the A-pillars carried on up to the hub; a windscreen-V row usable on any cabin (the Cub's centre strut) |
| **seat, pedals, controls** | in the nacelle | the crew as today (`anchors()`, _cage_crew.js:2450-2530): the nacelle keeps its rings and floor | nothing |
| **the tent** | skin and light cage | the cage's sheet; a material row like glass's (G2047); the cloth cover's tear law (`GEN_COVER.fabric`, 60_gen_spec.js:481); tube buckling | one material row: thin poles, ripstop, collapses |
| **main wheel** | ONE wheel under the pylon's foot | the main gear unit (`s1`), legs rooted on any node (`B()`); the lever leg (61_gen_frame.js:2678) | **the single-wheel gear type** (§4) |
| **nose skid** | a sprung skid under a fairing | the third unit's "Skid" (`s2Steer 4`, _cage_design.js:2187); spats and trousers (`thirdFairT`) | the skid's fairing tears and collapses with the nacelle |
| **firewall / datum** | the nacelle's nose and aft face | the join's firewall datum (_cage_join.js:1350) | nothing: the nacelle has a nose |

Revision 1's crew re-anchoring and new datum are gone. **The nacelle is a cage, so the crew, the floor and the join's
datum work as they do.**

## 3. Materials by role: the one real idea

Today one field, `fus.material`, sets the whole body's members, cover, stiffness and price (_cage_join.js:683). The cage
already keeps a per-bay construction map (`S.interior.consMap`, _cage_gen.js:9759-9768), holding the same value
everywhere today. The frame bills each member's mass and stiffness from `MM`, its section's material
(61_gen_frame.js:405-455).

**In the hanging nacelle each member takes its material from its ROLE:**

| role | the cage's member | material |
|---|---|---|
| keel | the keel rail (bottom longerons) | the airframe's hard row (carbon) |
| V struts | the A-pillars, carried up to the hub | carbon tube |
| pylon | the mast (and the aft pillar line under it) | carbon, wing-section |
| everything else | rings, rails, pillars, the sheet | **tent** |

**The tent row** (one new `GEN_MATERIALS` row and its `GEN_CRASH` row, the way glass came in):
- thin poles: a small `lin`, a low `k`, tube buckling on;
- the cover a ripstop at ~0.15 kg/m²;
- a cloth tear law with high elongation, so it folds first.

**The collapse is the solver's own.** The tent's poles buckle under any real load (Euler, already there for tube
members), so a nacelle without its keel folds under its own weight and the pilot's.

Covered: the tent's skin over the cage. Open frame: the hard members alone, the naked Standard.

## 4. The single-wheel gear type (reused on every glider after)

- A fourth layout on the Gear tile: **Monowheel**.
  - The main wheel on the centreline, under the pylon's foot.
  - The nose unit: a wheel or the faired skid.
  - A tail skid (the tailwheel's skid).
  - The wing that goes down at rest lands on its **tip**, and that tip is a wingtip type (below), not part of the gear.
- **The physics:**
  - `refs.mains` holds two nodes today, and the solver and the cert assume it at four sites (30_solver.js:949, 1578,
    3941, 4283; frame :3815).
  - The single wheel is one axle node. Those four sites learn "one or two".
- Ground handling on one wheel and a tip is new behaviour.

**The skid tip: a new wingtip type.**
- The tips are a list of kinds (`GEN_TIPS`, 60_gen_spec.js:2731). New kinds are APPENDED, never inserted, because the
  cage saves a tip as an index. `endplate`, `drooped` and `upturned` came in that way.
- `skid`: a tip with a skid shoe under its end, a row with `skid: [height, length]` in tip chords, drawn by the wing
  layer and priced as drag the way the endplate's plate is (62_gen_aero).
- Its physics: the shoe's node is a ground contact with a sliding law. The model is the tail contact (`refs.tw`, and
  the twin boom's second one `TW2`, 30_solver.js:2602, 3429), which sizes its law off its static load.
- So any glider gets it by picking the tip, monowheel or not.

## 5. Swappable hung modules: trikes and more

The hub's bottom socket is an **interface**: the pylon's foot is one node, and whatever hangs from it brings its own
gear. With that:

- **The Archaeopteryx:** a tent nacelle, a monowheel, a nose skid.
- **A fixed-wing trike:** an open-frame carriage (Covering "Open frame") on a tricycle. The pylon is the trike's mast,
  the keel its keel. (The weight-shift wing that pivots on the mast is not modelled: the wing stays fixed.)
- **A boat:** a hull nacelle hung under the hub, a flying-boat cousin.
- **Swapping the carriage:** keep the hub, the wing, the boom and the tail; change the module and its gear. That is the
  user's "swap the whole wheel assembly".

## 6. Engines

- **Pusher on the pylon's aft face:** what the aft bulkhead did, the Archaeopteryx's. Today's pusher face plus the shaft.
- **Over the wing on the hub's top socket:** the existing `wingTop` mount already hangs on the four root spar nodes
  (61_gen_frame.js:1747-1797).
- **Tractor on the nacelle's nose:** the nose mount as today, for a light motor.
- **The battery on the keel beside the pilot.** This puts the CG under the wing, and with it closes the card's open
  -10 % static margin.

## 7. Connections: the simplest first

- **Physics:** direct ties. The boom on the hub's spar nodes, as the twin boom; the pylon and the struts' heads on the
  carry-through's nodes.
- **Drawing:** the bolted socket we already draw (plate, sleeve, bolts) at the hub's back and bottom.
- **Later:** the slot-in fitting from the real-figures branch (the floating aft section that holds the rod) as
  inspiration, and the blended centre section. Neither is needed to fly.

## 8. What changes, file by file (the smallest set)

**Core:**
- `60_gen_spec.js`: the body mode (`fuse.hang` or a nacelle value on the body), the pylon block (station on the hub,
  length), the `tent` and `crash.tent` rows, the `mono` gear type.
- `61_gen_frame.js`:
  - the hub's ties: the boom by the twin-boom recipe at x = 0, the pylon, the struts' heads;
  - member materials by role (§3);
  - the monowheel axle; the skid tip's contact node.
- `30_solver.js`, `66_gen_cert.js`: one or two mains.
- `65_gen_loadtest.js`:
  - the trestle pins the body today ("every non-wing node", :21);
  - for a hung nacelle the hub is the trestle and the nacelle hangs free, which is the sandbag test the user wants
    (remove the keel, the tent folds).

**Cage:**
- `_cage_gen.js`: the nacelle's roof no longer carries the wing; the wing's anchor reads the hub's height
  (pylon length) instead of the deck (63_gen_wing.js:1100-1116 has the parasol precedent).
- `_cage_wing.js`: the single boom off the hub (the twin-boom loft at x = 0); the hub's fittings.
- `_cage_eng.js`: the pylon drawing reused downward; the pusher's face on the pylon.
- `_cage_gear.js`: the monowheel; the faired skid.
- `_cage_page5.js`: the A-pillars on to the hub; the windscreen-V row.
- `_cage_join.js`: the pylon and the hub (station, length), the boom from the hub (the twin boom's measure, :1840).
- `_cage_design.js`: the body tile ("Cabin" / "Hanging nacelle"), the Monowheel tile, the card.

**Gates:**
- the mode **bit-identical when off** (as `hullOn`);
- GATE NACELLE: the hub and the wing carry everything; without the keel the tent folds; without a strut the nose
  folds; the monowheel stands on a tip.
- GATE ARCHETYPES flies the card.

**The size:** about one hull chantier (the hull: one mode key, ~10 rows, 11 files, a frame branch and a gate). Revision
1's estimate was two to three: the crew, the datum and the blended surface are no longer in it.

## 9. Staging

1. **The monowheel** (alone, useful at once to every glider): the gear type, the faired nose skid, the one-or-two
   mains in the solver and the cert; and the **skid wingtip** type.
   **DONE 11 Nov** (HANDOVER "MONOWHEEL", GATE MONOWHEEL): `gear.mono`, the skid under any tip (a wing setting, as the
   user chose), the nose skid (the leaf spring at the nose, faired with the wheel's spat). The tearing fairing waits for
   the tent material (stage 3).
2. **The hub's boom:** the single boom off the hub. This retires the rod-on-a-bulkhead for this card.
   **DONE 11 Nov, as the rod re-rooted** (HANDOVER "HUB", GATE HUB): not the twin boom at x = 0 but the rod itself, its
   root ring tied into the root bay and the bay in the rod's rigid cluster; a bolted collar at the trailing edge. Also in
   stage 1's train: the faired skid as a protrusion of the body, the bicycle wheel, the sunk wheel (a square cut).
3. **The hanging nacelle:**
   - the pylon (drawing reused, physics as cabane);
   - the role materials;
   - the tent row;
   - the A-pillars on to the hub;
   - the load rig hanging the nacelle;
   - GATE NACELLE.
4. **The card:** the Archaeopteryx re-built on it, its masses against the 54 kg, the battery beside the pilot, flown.
5. **Later:** the trike carriage as a second module; the slot-in fittings; the blended centre section.

## 10. Decisions (the user, 11 Nov) and what is left

1. **The pylon: a single centreline mast**, as in the photos, the nacelle's aft face behind it.
2. **The keel: a visible faired beam on the naked version.** With skin it sits inside the tent. Without skin it is a
   beam you can see under the seat (the pylon's wing-section drawing, laid flat). Its own drawing row on the nacelle.
3. **The wingtip skids: a new wingtip type** (section 4), not a gear row.
4. **The trike module: later** (stage 5). The plane comes first.

Left open:
- **Winglet and skid together.** A wing has ONE tip kind, and the three-view's Archaeopteryx has winglets. Either a
  second appended type, "winglet + skid" (the skid shoe under the winglet's root), or the skid drawn under any tip
  through a tip-shape number. The study proposes the first: two rows, no new mechanism.
