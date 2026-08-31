// ===========================================================================
// THE FIT-OUT — what a hangar IS, what is IN it, and what you can DO there.
// ===========================================================================
// HANGARS.md's rule in one line: a hangar is three separable things — a SHELL,
// a FIT-OUT and a set of CAPABILITIES — and the whole design is in refusing to
// collapse them into one "level". This file is all three declarations plus the
// placement engine, and it is a CORE file on purpose: nothing in placement
// needs THREE. Prop footprints come from PROP_REG (51_prop_codec.js), the
// aeroplane's box is measured by the CALLER (app.js already did for the mobile
// kit), and positions are arithmetic on HW/HD/EAVE — so GATE HANGAR proves
// "every kit places into every shell, or reports" in plain node, and hangar.js
// is left with the one job only it can do: standing meshes at the answers.
//
// THE CONVERSION IS AN IDENTITY, NOT A REDESIGN. hangar.js's layout was
// composed against the authored shed — HD 13, HW 18 — and scaled through
// FX = v*HD/13, FZ = v*HW/18. A site row here says the same thing as a
// fraction: x = -HD + along*2HD with along = (a+13)/26 IS FX(a), at every
// dims, forever. The HF_A()/HF_B()/HF_PF() helpers below keep the authored coordinate
// visible in the table so the two forms can be compared by eye. The one
// deliberate change: the back-wall run was authored UNSCALED (raw z for
// HW 18), which at today's default HW 15 put the welding cart AT the wall
// (z = 15.0) and a drum OUTSIDE it (z = -15.4). Converting by the AUTHORED
// width moves that run to its authored intent — inside the room.
// ===========================================================================

// ---- THE SHELLS -----------------------------------------------------------
// What the building IS: a structure family plus dimension DEFAULTS. Not a
// score, and not a limit — the size sliders keep working and simply start
// from the class (same ruling as the aeroplane's: derivation is the
// engineer's handbook, never a guardrail). `lims` is the envelope the sliders
// offer PER SHELL, because a timber field shed's 3.6 m eave is below the
// steel shed's old floor of 4.2. Dims are HALF width / HALF depth, like
// hangar.js's own (a 30 x 25 m club shed is HW 15, HD 12.5).
//
// `price` is credits, declared so the record has its shape — nothing charges
// it yet (the ledger records, it does not gate; joining the wallet is P5).
// `skin` is a DEFAULT dress per PART into hangar.js's LIB, applied before the
// player's own overrides so their choices always win.
// `sky` is the HDRI FAMILY this shed's moods are graded from — the user's
// association point (2026-08-31: "associate a shed with an hdri, but for
// now, we use alps for all sheds"). Today every mood row in HANGAR_SKIES is
// a grading of the one alps panorama, so 'alps' everywhere IS the current
// truth; keying the mood set off this field is the later chantier.
const SHELLS = {
  club: {
    name: 'Club hangar', frame: 'portal', doors: 'sixLeaf',
    dims: { HW: 15, HD: 12.5, EAVE: 7.0 },
    lims: { HW: [7, 24], HD: [6, 20], EAVE: [4.2, 11] },
    skin: null, sky: 'alps', price: 0, status: 'live',
  },
  works: {
    name: 'Works', frame: 'portal', doors: 'sixLeaf',
    dims: { HW: 20, HD: 20, EAVE: 9.5 },
    lims: { HW: [10, 24], HD: [10, 26], EAVE: [6.0, 12] },
    skin: {
      wallSides: { set: 'rustysheet', tile: 2 },
      wallBack:  { set: 'rustysheet', tile: 2 },
      roof:      { set: 'factory', tile: 2 },
      stem:      { set: 'concrete008', tile: 2 },
    },
    sky: 'alps', price: 15000, status: 'live',
  },
  field: {
    // Half-dims like every other row (club's row IS today's shed verbatim,
    // and one column cannot switch units per row): a 14 x 18 m timber shed
    // at a 3.6 m eave. CONFIRMED by the user 2026-08-31 ("yes half-dims
    // is right") — the spec's "7 x 9" prose read as full metres, but a
    // genuinely 7 m wide shed passes no wing this generator builds.
    name: 'Field shed', frame: 'timber', doors: 'slidingLeaf',
    dims: { HW: 7, HD: 9, EAVE: 3.6 },
    lims: { HW: [4, 10], HD: [5, 12], EAVE: [3.0, 4.8] },
    skin: {
      wallSides: { set: 'rawplank', tile: 2 },
      wallBack:  { set: 'rawplank', tile: 2 },
      roof:      { set: 'rustysheet', tile: 2 },
    },
    sky: 'alps', price: 6000, status: 'live',
  },
};
function shellLims(key) {
  return (SHELLS[key] || SHELLS.club).lims;
}

// ---- THE CAPABILITIES -----------------------------------------------------
// A capability is a VERB, derived from the fit-out — you can weld because
// there is a welding kit, not because the hangar says level 3. Declared and
// ADVISORY ONLY: gating what a player may build on where they are standing is
// a P5 decision with the economy beside it.
const HANGAR_CAPS = ['park', 'handwork', 'wood', 'tube', 'metal', 'composite',
                     'engine', 'avionics', 'paperwork', 'store', 'handling',
                     'warm', 'heavy'];

// ---- THE KITS -------------------------------------------------------------
// The kit is the record (HANGARS.md §4.1): a workbench belongs to the bench
// kit, so "what does the wood kit contain" is answered by reading ONE row,
// not by scanning 44. props_table.py's `group` is untouched — that is the
// EDITOR's display axis and it is doing that job correctly; kits are a
// second, orthogonal axis.
//
// Each kit:
//   props    the CLAIM list. Every key in props_table.py is claimed by
//            exactly one kit (GATE HANGAR rule 4) — plus `wip` claiming the
//            two baked Jodel airframes from jodel_prep.py's table.
//   sites    where the kit stands its props. A site may REFERENCE another
//            kit's prop (the cosy corner borrows a stool; a crate rides a
//            storage cart) — rule 3 checks references, rule 4 counts claims.
//   recipes  drawn compounds (hangar.js's DRAW map): a loaded rack, a tyre
//            stack, the stove corner. Declared here with explicit metre
//            footprints so the gate can pack them and see their props.
//   ring     rows for the aircraft clearance ring (the old mobile kit).
//   grants   the verbs this kit earns.
//
// SITE ROW: { prop|recipe, at, along|fx/fz, out, dry, y?, on?, light?, n? }
//   at     'shop' (z=+HW wall), 'build' (z=-HW wall), 'back' (x=+HD wall),
//          'floor' (fractional), 'ring' is its own list.
//   along  0..1 fraction along the wall (door corner -> back corner for the
//          side walls, port corner -> starboard corner for the back wall).
//   out    REAL metres off the wall plane — clearances never scale: the
//          bench stands a metre off the wall in any shed (hangar.js's own
//          rule, kept).
//   fx/fz  floor position as fractions of HD/HW.
//   dry    absolute heading, exactly as authored.
//   y      rest height for things standing on other things — measured off
//          decoded geometry (hangar.js's TOP table), inlined per site.
//   on     the prop key this one stands on; unplaced with a reason when the
//          carrier did not place. Sites with y/on skip the wall packing —
//          they occupy someone else's footprint by design.
//   light  a lamp switch key: hangar.js claim()s the placed prop into that
//          switch (the desk lamp's emitter must stay switchable).
//
// HF_A() and HF_B() turn an AUTHORED coordinate into its fraction — HF_A for
// the side walls (authored HD 13 frame), HF_B for the back wall (authored
// HW 18 frame). Namespaced: these ride the page's shared global scope.
const HF_A = v => (v + 13) / 26;          // side walls: authored x -> along
const HF_B = v => (v + 18) / 36;          // back wall:  authored z -> along
const HF_PF = (v, s) => v / s;            // floor: authored coord -> fraction

const HANGAR_KITS = {
  park: {
    name: 'Bare shed', grants: ['park'],
    props: [], sites: [], recipes: [], ring: [],
  },

  bench: {
    name: 'Workbench', grants: ['handwork'],
    props: ['workbench_wood', 'vice_bench', 'stool_wood', 'toolrack_wall',
            'toolbox_open', 'toolchest_metal'],
    sites: [
      { prop: 'workbench_wood', at: 'shop', along: HF_A(-5.0), out: 1.00, dry: Math.PI },
      { prop: 'vice_bench', at: 'shop', along: HF_A(-5.95), out: 1.10,
        dry: Math.PI * 0.5, y: 0.96, on: 'workbench_wood' },
      { prop: 'toolbox_open', at: 'shop', along: HF_A(-4.25), out: 1.00,
        dry: Math.PI - 0.35, y: 0.96, on: 'workbench_wood' },
      { prop: 'toolrack_wall', at: 'shop', along: HF_A(-5.0), out: 0.12,
        dry: Math.PI, y: 1.62 },
      { prop: 'toolrack_wall', at: 'build', along: HF_A(2.6), out: 0.12,
        dry: 0, y: 1.62 },
      { prop: 'stool_wood', at: 'shop', along: HF_A(-3.2), out: 2.10, dry: 0.6 },
      { prop: 'stool_wood', at: 'build', along: HF_A(2.4), out: 1.95, dry: -0.4 },
      { prop: 'toolchest_metal', at: 'shop', along: HF_A(7.3), out: 0.95,
        dry: Math.PI + 0.12 },
      { prop: 'toolchest_metal', at: 'build', along: HF_A(0.5), out: 0.85, dry: 0.15 },
    ],
    recipes: [],
    ring: [
      { prop: 'toolbox_open', station: 'abeamS', dx: -0.9, dz: 0.06,
        dry: 0.5, y: 0.90 },
      { prop: 'toolchest_metal', station: 'abeamS', dx: 0.8, dz: 0.15,
        dry: Math.PI / 2 + 0.22 },
    ],
  },

  wood: {
    name: 'Woodshop', grants: ['wood'],
    props: ['bandsaw', 'panelsaw', 'thicknesser', 'jointer',
            'crate_wood_a', 'crate_wood_b', 'crate_wood_c'],
    sites: [
      // the machine run, in the order the timber goes through them (G66):
      // spaced by measurement against the authored wall, and the spacing
      // survives as fractions of it
      { prop: 'bandsaw', at: 'build', along: HF_A(-6.19), out: 1.16, dry: 0 },
      { prop: 'jointer', at: 'build', along: HF_A(-3.53), out: 1.38, dry: 0 },
      { prop: 'thicknesser', at: 'build', along: HF_A(-1.00), out: 0.93, dry: 0 },
      // the panel saw stands OFF the wall — the one machine you cannot use
      // against one; its `out` IS the sheet clearance plus the walkway
      { prop: 'panelsaw', at: 'build', along: HF_A(-4.30), out: 5.20, dry: 0 },
      // the timber stock: crate stacks at the door end of the build wall
      { prop: 'crate_wood_c', at: 'build', along: HF_A(-11.6), out: 3.6, dry: 0.15 },
      { prop: 'crate_wood_a', at: 'build', along: HF_A(-11.6), out: 3.6,
        dry: -0.20, y: 0.41, on: 'crate_wood_c' },
      { prop: 'crate_wood_b', at: 'build', along: HF_A(-11.8), out: 4.7, dry: 0.35 },
      { prop: 'crate_wood_a', at: 'build', along: HF_A(-10.8), out: 6.6, dry: -0.3 },
      { prop: 'crate_wood_c', at: 'build', along: HF_A(-11.5), out: 7.6, dry: 0.5 },
      // ...and the pair against the back wall
      { prop: 'crate_wood_c', at: 'back', along: HF_B(-10.6), out: 1.10,
        dry: Math.PI / 2 + 0.1 },
      { prop: 'crate_wood_b', at: 'back', along: HF_B(-11.7), out: 1.05,
        dry: Math.PI / 2 - 0.2 },
    ],
    recipes: [],
    ring: [],
  },

  metal: {
    name: 'Metalshop', grants: ['metal', 'tube'],
    props: ['weldingcart', 'compressor', 'drillpress', 'rack_steel',
            'drum_steel'],
    sites: [
      { prop: 'weldingcart', at: 'back', along: HF_B(15.0), out: 1.15,
        dry: -Math.PI / 2 - 0.20 },
      { prop: 'compressor', at: 'back', along: HF_B(6.2), out: 1.25,
        dry: -Math.PI / 2 },
      { prop: 'drillpress', at: 'build', along: HF_A(7.4), out: 0.95, dry: 0.10 },
      { prop: 'drum_steel', at: 'back', along: HF_B(-14.6), out: 0.95, dry: 0.5 },
      { prop: 'drum_steel', at: 'back', along: HF_B(-15.4), out: 0.95, dry: -0.3 },
    ],
    recipes: [
      // the loaded racks: rack_steel plus a seeded scatter of shelf stock —
      // drawn in hangar.js, declared here so the gate sees every prop a
      // shelf can carry and every footprint a wall must fit
      { recipe: 'loadedRack', at: 'shop', along: HF_A(1.5), out: 0.55,
        dry: Math.PI, foot: [0.5, 0.33],
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'shop', along: HF_A(2.6), out: 0.55,
        dry: Math.PI, foot: [0.5, 0.33],
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'shop', along: HF_A(3.7), out: 0.55,
        dry: Math.PI, foot: [0.5, 0.33],
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'build', along: HF_A(-1.2), out: 0.55,
        dry: 0, foot: [0.5, 0.33], loose: true,
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
      { recipe: 'loadedRack', at: 'build', along: HF_A(-2.3), out: 0.55,
        dry: 0, foot: [0.5, 0.33], loose: true,
        props: ['rack_steel', 'box_cardboard', 'crate_wood_a', 'jerrycan',
                'instrument_panel'] },
    ],
    ring: [],
  },

  store: {
    name: 'Stores', grants: ['store'],
    props: ['box_cardboard', 'barrel_plastic', 'bin_metal', 'bin_metal_rust',
            'jerrycan', 'bottle_lpg', 'bottle_propane'],
    sites: [
      { prop: 'box_cardboard', at: 'shop', along: HF_A(-2.1), out: 1.00,
        dry: 0.4, y: 0.68, on: 'table_wood' },
      { prop: 'jerrycan', at: 'shop', along: HF_A(-0.9), out: 1.85, dry: 0.8 },
      { prop: 'box_cardboard', at: 'shop', along: HF_A(5.4), out: 1.10,
        dry: 0.3, y: 1.28, on: 'cart_storage' },
      { prop: 'bottle_lpg', at: 'shop', along: HF_A(9.9), out: 0.85, dry: 0.5 },
      { prop: 'barrel_plastic', at: 'build', along: HF_A(9.0), out: 0.85, dry: 0 },
      { prop: 'bin_metal', at: 'build', along: HF_A(10.2), out: 0.90, dry: 0.3 },
      // the door-end cardboard, stacked (a box on a box is a `y` + `on`)
      { prop: 'box_cardboard', at: 'build', along: HF_A(-10.7), out: 3.9, dry: 0.8 },
      { prop: 'box_cardboard', at: 'build', along: HF_A(-10.8), out: 3.95,
        dry: -0.4, y: 0.34, on: 'box_cardboard' },
      { prop: 'box_cardboard', at: 'build', along: HF_A(-11.4), out: 6.0, dry: 0.1 },
      { prop: 'box_cardboard', at: 'build', along: HF_A(-11.5), out: 6.05,
        dry: 1.2, y: 0.34, on: 'box_cardboard' },
      // gas and fuel on the back wall
      { prop: 'bottle_propane', at: 'back', along: HF_B(13.9), out: 0.85, dry: 0.4 },
      { prop: 'bottle_propane', at: 'back', along: HF_B(13.2), out: 0.90, dry: -0.9 },
      { prop: 'bottle_lpg', at: 'back', along: HF_B(13.6), out: 1.65, dry: 0.2 },
      { prop: 'barrel_plastic', at: 'back', along: HF_B(-15.0), out: 1.75, dry: 0 },
      { prop: 'jerrycan', at: 'back', along: HF_B(-13.9), out: 1.9, dry: 0.9 },
      { prop: 'jerrycan', at: 'back', along: HF_B(-14.2), out: 2.3, dry: -0.4 },
      { prop: 'bin_metal', at: 'back', along: HF_B(-3.2), out: 1.05, dry: 0.3 },
      { prop: 'bin_metal_rust', at: 'back', along: HF_B(-4.2), out: 1.05, dry: -0.5 },
    ],
    recipes: [
      // ry = PI, not -PI/2: the long stock lies along local z (the authored
      // lesson, kept with the row). And HF_B(-10.2), not HF_B(-8.5): the /36
      // conversion walks the whole back run inboard, and the rack's ten
      // metres of tube and spruce is the one thing on it that must not walk
      // into the aircraft bay — at the club's own width this lands it at
      // z = -8.5, byte-identical to the authored room.
      { recipe: 'stockRack', at: 'back', along: HF_B(-10.2), out: 1.6,
        dry: Math.PI, foot: [0.46, 5.3], loose: true, props: [] },
    ],
    ring: [
      { prop: 'jerrycan', station: 'nose', dx: 0.5, dz: 0.7, dry: 0.8 },
    ],
  },

  handling: {
    name: 'Handling', grants: ['handling'],
    props: ['handtruck', 'stepladder', 'work_trestle', 'cart_tool',
            'cart_tool_cab', 'cart_storage'],
    sites: [
      { prop: 'cart_storage', at: 'shop', along: HF_A(5.7), out: 1.10,
        dry: Math.PI + 0.08 },
      { prop: 'cart_tool_cab', at: 'shop', along: HF_A(8.7), out: 0.95,
        dry: Math.PI - 0.08 },
      { prop: 'handtruck', at: 'shop', along: HF_A(10.8), out: 0.55,
        dry: Math.PI + 0.15 },
      { prop: 'cart_tool', at: 'build', along: HF_A(-8.2), out: 1.40, dry: -0.30 },
      { prop: 'stepladder', at: 'build', along: HF_A(-8.6), out: 3.9, dry: 0.5 },
      { prop: 'stepladder', at: 'floor', fx: HF_PF(-11.9, 13),
        fz: HF_PF(11.6, 18) - 1, dry: 1.4 },
    ],
    recipes: [
      { recipe: 'workPlatform', at: 'shop', along: HF_A(6.6), out: 3.1,
        dry: 0.10, foot: [0.5, 1.05], props: [] },
      { recipe: 'workPlatform', at: 'build', along: HF_A(-6.6), out: 3.2,
        dry: -0.10, foot: [0.5, 1.05], loose: true, props: [] },
    ],
    ring: [
      { prop: 'cart_tool', station: 'abeamS', dx: -0.9, dz: 0,
        dry: Math.PI / 2 - 0.18 },
      { prop: 'stepladder', station: 'abeamP', dx: 0.4, dz: 0,
        dry: -Math.PI / 2 + 0.3 },
      { prop: 'handtruck', station: 'nose', dx: 0, dz: 0, dry: 1.9 },
    ],
  },

  office: {
    name: 'Office corner', grants: ['avionics', 'paperwork'],
    props: ['desk_metal', 'radio_bench', 'instrument_panel', 'lamp_desk'],
    sites: [
      { prop: 'desk_metal', at: 'build', along: HF_A(2.6), out: 0.90, dry: 0 },
      { prop: 'lamp_desk', at: 'build', along: HF_A(3.35), out: 1.15,
        dry: -0.55, y: 0.78, on: 'desk_metal', light: 'desk' },
      { prop: 'instrument_panel', at: 'build', along: HF_A(1.95), out: 1.05,
        dry: 0.35, y: 0.78, on: 'desk_metal' },
      // the radio lives on the WORKBENCH, which is the bench kit's — an
      // office without a bench keeps its radio boxed
      { prop: 'radio_bench', at: 'shop', along: HF_A(-3.95), out: 1.05,
        dry: Math.PI + 0.25, y: 0.96, on: 'workbench_wood' },
    ],
    recipes: [
      { recipe: 'planTable', at: 'floor', fx: HF_PF(-9.2, 13), fz: HF_PF(8.4, 18),
        dry: 0.4, foot: [0.8, 0.55], props: [] },
    ],
    ring: [],
  },

  comfort: {
    name: 'Comfort', grants: ['warm'],
    props: ['stove_masonry', 'stove_barrel', 'chair_lounge', 'rug_persian',
            'lamp_pendant', 'hosereel_wall'],
    // lamp_pendant is CLAIMED here and placed by the SHELL: the pendants are
    // the room's light rig, and a room with no light is not a fit-out choice
    // yet — gating the lamps on a kit is P5 content. stove_barrel is claimed
    // and unplaced (it never stood in this room; a site is a later choice).
    sites: [
      { prop: 'rug_persian', at: 'floor', fx: HF_PF(8.6, 13), fz: HF_PF(13.8, 18),
        dry: 0.30, y: 0.004 },
      { prop: 'chair_lounge', at: 'floor', fx: HF_PF(8.9, 13), fz: HF_PF(13.6, 18),
        dry: 2.35 },
      // the corner borrows a stool, a drum and a barrel from the kits that
      // own them — a tableau, not a claim
      { prop: 'stool_wood', at: 'floor', fx: HF_PF(7.6, 13), fz: HF_PF(12.5, 18),
        dry: 1.1 },
      { prop: 'drum_steel', at: 'floor', fx: HF_PF(9.6, 13), fz: HF_PF(15.9, 18),
        dry: 0 },
      { prop: 'barrel_plastic', at: 'floor', fx: HF_PF(10.6, 13), fz: HF_PF(16.2, 18),
        dry: 0.4 },
      // moved clear of the back doors once already (G66): a wall-mounted
      // prop must never hang on a leaf, and the engine now enforces what
      // that lesson taught by hand
      { prop: 'hosereel_wall', at: 'back', along: HF_B(7.6), out: 0.14,
        dry: -Math.PI / 2, y: 2.20 },
    ],
    recipes: [
      { recipe: 'stoveCorner', at: 'floor', fx: HF_PF(11.1, 13), fz: HF_PF(12.4, 18),
        dry: -0.5, foot: [0.85, 0.85], props: ['stove_masonry'] },
    ],
    ring: [],
  },

  curio: {
    name: 'Curios', grants: [],
    props: ['car_covered', 'tyre', 'table_wood'],
    sites: [
      { prop: 'table_wood', at: 'shop', along: HF_A(-1.7), out: 1.05,
        dry: Math.PI },
      { prop: 'crate_wood_a', at: 'shop', along: HF_A(-1.2), out: 1.05,
        dry: -0.25, y: 0.68, on: 'table_wood' },
      { prop: 'car_covered', at: 'floor', fx: HF_PF(-9.9, 13),
        fz: 1 - HF_PF(5.6, 18), dry: Math.PI / 2 + 0.05 },
    ],
    recipes: [
      { recipe: 'tyreStack', at: 'shop', along: HF_A(-11.3), out: 1.7,
        dry: 0, foot: [0.4, 0.4], n: 4, props: ['tyre'] },
      { recipe: 'tyreStack', at: 'shop', along: HF_A(-12.0), out: 2.6,
        dry: 0, foot: [0.4, 0.4], n: 3, props: ['tyre'] },
      { recipe: 'tyreStack', at: 'shop', along: HF_A(-11.6), out: 3.4,
        dry: 0, foot: [0.4, 0.4], n: 2, props: ['tyre'] },
      { recipe: 'tyreStack', at: 'floor', fx: HF_PF(-11.4, 13),
        fz: HF_PF(8.4, 18) - 1, dry: 0, foot: [0.4, 0.4], n: 3, props: ['tyre'] },
    ],
    ring: [],
  },

  // THE WORK IN PROGRESS, as a kit. HANGARS.md kept the two airframes outside
  // the kit system "because they are not baked props" — which has been stale
  // since G62.10: they ARE baked (tools/jodel_prep.py), placed by the same
  // prop() as the furniture. A display kit fixes what the carve-out broke:
  // rule 4 has no exception list, and a bare park-only shed shows no Jodel.
  // The REAL work-in-progress mechanism — your wing on your trestles — stays
  // a separate chantier (it wants the fleet container first); when it lands
  // it replaces this kit's content, not the kit system.
  wip: {
    name: 'Work in progress', grants: [],
    props: ['airframe_jodel_body', 'airframe_jodel_wing'],
    sites: [],
    recipes: [
      { recipe: 'wipBody', at: 'floor', fx: HF_PF(3.6, 13), fz: HF_PF(-12.2, 18),
        dry: Math.PI + 0.21, foot: [3.1, 0.8],
        props: ['airframe_jodel_body', 'work_trestle'] },
      // hung chord-up on the back doors, deliberately IN the doorway — it is
      // the one thing in the room allowed there (G64: its shadow lands on
      // one flat leaf plane), so it is flagged free of the keepouts
      { recipe: 'wipWingHang', at: 'back', along: HF_B(0), out: 1.7,
        dry: 0, foot: [0.2, 4.6], free: true,
        props: ['airframe_jodel_wing'] },
      { recipe: 'wsWing', at: 'floor', fx: HF_PF(-2.4, 13), fz: HF_PF(12.4, 18),
        dry: 0.05, foot: [4.75, 1.0], props: ['work_trestle'] },
      { recipe: 'wsEngine', at: 'floor', fx: HF_PF(9.2, 13), fz: HF_PF(-6.4, 18),
        dry: -Math.PI / 2 + 0.2, foot: [0.65, 0.65], props: [] },
    ],
    ring: [],
  },
};

// the default fit-out IS today's room: every kit on
const HANGAR_KITS_DEFAULT = ['park', 'bench', 'wood', 'metal', 'store',
                             'handling', 'office', 'comfort', 'curio', 'wip'];

// ---- THE ENGINE -----------------------------------------------------------
// hangarFit(dims, kitKeys) -> { placed, recipes, unplaced } with the one
// invariant this whole mechanism exists for:
//
//     placed.length + recipes.length + unplaced.length
//         === every site row the chosen kits declared.
//
// A kit that does not fit its shell places what it can and REPORTS the rest —
// never silently. A field shed cannot take the full woodshop, and being told
// so is the mechanism working.
//
// v1 fit rules, simplest honest set:
//   1. bounds     the footprint stays inside the walls;
//   2. doorway    a wall-MOUNTED prop (y >= 1) never hangs on a door leaf —
//                 floor props may stand against a closed door, the room
//                 always did that (the bins lean on the back doors today);
//   3. the bay    nothing static intrudes on the aeroplane's slot: the
//                 centre strip |z| <= 2.2 between the door and the back
//                 clearance — that is what strips a panel saw from a shed
//                 too narrow to hold it AND an aeroplane;
//   4. packing    floor-standing wall sites pack per wall in declaration
//                 order — an interval ALONG the wall and a band OUT from it,
//                 because the jerrycan legitimately stands in front of the
//                 table (same wall coordinate, different depth); an overlap
//                 in both is reported, not shuffled.
// Sites with `y`/`on` skip packing (they ride someone else's footprint), and
// `on` itself is checked in a SECOND pass over everything else — nothing
// stands on a prop that did not place, wherever in kit order the carrier
// was declared (the stores' box rides the handling kit's cart).
function hangarFootprint(key, reg) {
  const R = reg || (typeof PROP_REG !== 'undefined' ? PROP_REG : null);
  const p = R && R.props && R.props[key];
  // half-extents; an unknown key gets a modest default so the report stays
  // about the missing prop, not a crash
  return p ? [p.dim[0] / 2, p.dim[2] / 2] : [0.4, 0.4];
}

function hangarFit(dims, kitKeys, opts) {
  const HW = (dims && dims.HW) || 15, HD = (dims && dims.HD) || 12.5;
  const EAVE = (dims && dims.EAVE) || 7.0;
  const BD_W = Math.min(11.0, 2 * HW - 8);        // hangar.js's own derivation
  const reg = opts && opts.reg;
  // whether this shell HAS back-door leaves to keep wall-mounts off: the
  // timber field shed's back wall is boards, and a hose reel may bolt to a
  // board wall — the keepout is about door LEAVES, not about walls
  const shellRec = SHELLS[(opts && opts.shell) || 'club'] || SHELLS.club;
  const hasBackDoors = shellRec.doors === 'sixLeaf';
  const keys = (kitKeys && kitKeys.length ? kitKeys : HANGAR_KITS_DEFAULT)
    .filter(k => HANGAR_KITS[k]);

  const placed = [], recipes = [], unplaced = [];
  const placedKeys = new Set();
  const lanes = { shop: [], build: [], back: [] };  // packed intervals per wall

  const resolve = s => {
    if (s.at === 'shop') return { x: -HD + s.along * 2 * HD, z: HW - s.out };
    if (s.at === 'build') return { x: -HD + s.along * 2 * HD, z: -HW + s.out };
    if (s.at === 'back') return { x: HD - s.out, z: -HW + s.along * 2 * HW };
    return { x: s.fx * HD, z: s.fz * HW };          // floor
  };
  // oriented half-extents: a quarter turn swaps them; anything between is
  // taken at the nearer quarter, which over-covers slightly and that is the
  // right direction for a clearance test
  const orient = (foot, dry) => {
    const q = Math.round((dry || 0) / (Math.PI / 2)) & 1;
    return q ? [foot[1], foot[0]] : [foot[0], foot[1]];
  };

  const fit = (row, kit, isRecipe) => {
    const foot = orient(isRecipe ? row.foot : hangarFootprint(row.prop, reg),
                        row.dry);
    const p = resolve(row);
    const out = { kit, at: row.at, x: p.x, z: p.z, ry: row.dry || 0,
                  y: row.y || 0 };
    if (isRecipe) { out.recipe = row.recipe; out.n = row.n; out.free = !!row.free; }
    else out.prop = row.prop;
    const label = isRecipe ? row.recipe : row.prop;

    // 1. bounds — even a `free` row: free waives the keepouts and the
    // packing (the hung wing is ALLOWED across the doorway), never the
    // walls. A nine-metre wing does not hang on an eight-metre wall.
    if (Math.abs(p.x) + foot[0] > HD || Math.abs(p.z) + foot[1] > HW) {
      unplaced.push({ kit, key: label, at: row.at,
                      reason: 'outside the shell' });
      return;
    }
    if (!row.free) {
      // 2. a wall-mounted prop on the back wall must clear the door leaves
      // (when the shell HAS them — a board wall takes a bolt anywhere)
      if (hasBackDoors && row.at === 'back' && (row.y || 0) >= 1.0 &&
          Math.abs(p.z) - foot[1] < BD_W / 2 + 0.4) {
        unplaced.push({ kit, key: label, at: row.at,
                        reason: 'on the door leaf' });
        return;
      }
      // 3. the aeroplane's slot
      if (Math.abs(p.z) - foot[1] < 2.2 &&
          p.x - foot[0] < HD - 2.0 && p.x + foot[0] > -HD + 2.0) {
        unplaced.push({ kit, key: label, at: row.at,
                        reason: 'blocks the aircraft bay' });
        return;
      }
      // 4. wall packing, floor-standing wall sites only: along x depth.
      // `loose` rows are composed TUCKS — a rack nested behind a
      // thicknesser's outfeed, a platform under a panel saw's outrigger —
      // where the bounding boxes interpenetrate but the author's eye already
      // resolved the geometry. They are declared, not guessed, and they keep
      // every other rule (bounds, doorway, the bay).
      if (lanes[row.at] && !(row.y > 0) && !row.on && !row.loose) {
        const back = row.at === 'back';
        const u = back ? p.z : p.x;
        const iv = [u - foot[back ? 1 : 0], u + foot[back ? 1 : 0]];
        const ov = [row.out - foot[back ? 0 : 1], row.out + foot[back ? 0 : 1]];
        const hit = lanes[row.at].find(o =>
          iv[0] < o.iv[1] && iv[1] > o.iv[0] &&
          ov[0] < o.ov[1] && ov[1] > o.ov[0]);
        if (hit) {
          unplaced.push({ kit, key: label, at: row.at,
                          reason: 'overlaps ' + hit.key });
          return;
        }
        lanes[row.at].push({ iv, ov, key: label });
      }
    }
    if (row.on && !placedKeys.has(row.on)) {
      unplaced.push({ kit, key: label, at: row.at,
                      reason: 'needs ' + row.on });
      return;
    }
    if (row.light) out.light = row.light;
    if (isRecipe) { recipes.push(out); (row.props || []).forEach(k => placedKeys.add(k)); }
    else { placed.push(out); placedKeys.add(row.prop); }
  };

  // two passes: everything standing on the floor or a wall first, then the
  // riders — so a box can ride a cart whichever kit declared the cart
  for (const pass of [0, 1])
    for (const k of keys) {
      for (const s of HANGAR_KITS[k].sites)
        if ((s.on ? 1 : 0) === pass) fit(s, k, false);
      for (const r of HANGAR_KITS[k].recipes)
        if ((r.on ? 1 : 0) === pass) fit(r, k, true);
    }
  return { placed, recipes, unplaced, dims: { HW, HD, EAVE } };
}

// ---- THE RING -------------------------------------------------------------
// placeMobile's arithmetic, verbatim (hangar.js G65): the caller measures the
// aeroplane's footprint in the room's own frame, and the chosen kits' ring
// rows are placed on a clearance ring outside it. lim takes a MAGNITUDE — the
// port side passes HW - 2.2, not its negative: handing it -(HW - 2.2) once
// put the ladder, the sack truck and the jerrycan against the far wall on the
// wrong side, and that lesson keeps its shape here.
function hangarFitRing(dims, kitKeys, bb) {
  if (!bb || !isFinite(bb.x0)) return [];
  const HW = (dims && dims.HW) || 15, HD = (dims && dims.HD) || 12.5;
  const CLR = 1.15;
  const lim = (v, m) => Math.max(-m, Math.min(m, v));
  const zR = lim(Math.max(bb.z1, 0.6) + CLR, HW - 2.2);
  const zL = lim(Math.min(bb.z0, -0.6) - CLR, HW - 2.2);
  const xN = lim(bb.x0 - CLR * 0.7, HD - 2.0);
  const xM = lim((bb.x0 + bb.x1) / 2, HD - 2.0);
  const AT = { abeamS: [xM, zR], abeamP: [xM, zL], nose: [xN, zL * 0.45] };
  const keys = (kitKeys && kitKeys.length ? kitKeys : HANGAR_KITS_DEFAULT)
    .filter(k => HANGAR_KITS[k]);
  const out = [];
  for (const k of keys)
    for (const r of HANGAR_KITS[k].ring) {
      const a = AT[r.station];
      if (!a) continue;
      out.push({ kit: k, prop: r.prop, x: a[0] + r.dx, z: a[1] + r.dz,
                 ry: r.dry, y: r.y || 0 });
    }
  return out;
}

// ---- THE VERBS ------------------------------------------------------------
// Derived, never set. `heavy` comes from the SHELL — the door is the
// generator's own wing clamp seen from outside: max(6, 2HW - 5) >= 14 m of
// opening takes any wing this game can build. Everything else comes from the
// fit-out, which is the split doing its job: a big empty shed lets you park a
// big aeroplane and build nothing.
function hangarCaps(shed) {
  const s = shed || {};
  const shell = SHELLS[s.shell] || SHELLS.club;
  const dims = Object.assign({}, shell.dims, s.dims || {});
  const keys = (s.kits && s.kits.length ? s.kits : []).filter(k => HANGAR_KITS[k]);
  const got = new Set(['park']);
  for (const k of keys) for (const g of HANGAR_KITS[k].grants) got.add(g);
  if (Math.max(6, 2 * dims.HW - 5) >= 14) got.add('heavy');
  // layup wants a warm, clean, enclosed bay — and not a draughty field shed
  if (got.has('warm') && got.has('handwork') &&
      (s.shell || 'club') !== 'field') got.add('composite');
  if (got.has('metal') && got.has('handling')) got.add('engine');
  return HANGAR_CAPS.filter(v => got.has(v));
}

// What an aeroplane WANTS of a hangar, read off its resolved spec's declared
// constructions. Advisory only, forever the engineer's handbook: the editor
// may show the line, nothing may enforce it (P5 owns that ruling).
function hangarWants(S) {
  const want = new Set();
  const add = m => {
    if (m === 'wood') want.add('wood');
    else if (m === 'tubeFabric') want.add('tube');
    else if (m === 'alloy') want.add('metal');
    else if (m === 'carbon') want.add('composite');
  };
  if (S && S.fuselage) add(S.fuselage.material);
  if (S && S.wings) for (const w of [].concat(S.wings)) add(w && w.material);
  if (S && S.tail) { add(S.tail.finMaterial); add(S.tail.stabMaterial); }
  return HANGAR_CAPS.filter(v => want.has(v));
}
