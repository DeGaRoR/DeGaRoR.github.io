// ============================================================
// GARAGE 1/5 — the SPEC. Source of truth for a generated airframe.
//
// Everything downstream (structure, aero, skin) is a pure function of a
// resolved spec, so the spec is the single root: there is no second place
// where a number about this aeroplane lives.
//
// PROCEDURAL BY DEFAULT: any field may be `null`, which means "derive it".
// resolveSpec() fills every null from the fields before it and records which
// ones it touched in `.auto`, so the editor can show auto-vs-manual and a
// player who changes nothing still gets a coherent aeroplane.
//
// Frame is the sim's: x AFT (nose at -x), y up, z lateral, datum x=0 at the
// firewall. Units SI throughout.
// ============================================================

// Build materials. `lin` = kg per metre of member, `cover` = kg/m^2 of covered
// surface (fabric + dope + stringers, or ply + finish). k/c are the beam
// spring/damping constants by member class — the tubeFabric row IS the Cub's
// (2.0e5/60 chassis, 5.0e5/450 wing, 2.8e4/900 gear), which is the only row
// this chantier validates. cd0 is the wing profile-drag finish penalty.
const GEN_MATERIALS = {
  tubeFabric: {
    name: '4130 tube + fabric',
    lin:   { fus: 0.58, wing: 0.62, gear: 1.05 },
    cover: 0.42,
    k:     { fus: 2.0e5, wing: 5.0e5, gear: 2.8e4 },
    c:     { fus: 60,    wing: 450,   gear: 900 },
    cd0: 0.0022, clmaxK: 1.00, cost: 1.0,
  },
  wood: {
    name: 'spruce + ply',
    lin:   { fus: 0.50, wing: 0.58, gear: 1.20 },
    cover: 0.62,
    k:     { fus: 4.0e5, wing: 2.5e6, gear: 1.3e5 },
    c:     { fus: 300,   wing: 950,   gear: 2400 },
    cd0: 0.0009, clmaxK: 1.02, cost: 0.8,
  },
};

// Cabin box per seating layout: half-width, height above the lower longeron,
// fore-aft length, and the crew mass it carries.
const GEN_SEATING = {
  single:  { halfW: 0.32, h: 0.92, len: 0.62, crew: 1 },
  tandem2: { halfW: 0.36, h: 1.00, len: 0.78, crew: 2 },
  side2:   { halfW: 0.53, h: 1.05, len: 0.90, crew: 2 },
};

// Design constants that are rules rather than choices. Each one reproduces a
// measured value on the Cub (noted), which is why they are constants and not
// parameters — see the derivations in resolveSpec.
const GEN_RULES = {
  tailArmC:    2.60,   // wing c/4 -> stab c/4, in root chords (Cub 4.14/1.6)
  hAR:         3.70,   // stab aspect ratio
  vAR:         1.90,   // fin aspect ratio
  Vh:          0.370,  // horizontal tail volume (Cub effective strip areas)
  Vv:          0.0267, // vertical tail volume
  sparFront:   0.15,   // front spar, fraction of chord
  sparRearMax: 0.72,
  propClear:   0.40,   // m, prop tip to ground in the LEVEL attitude (Cub 0.42)
  // Tailwheel leg length below the tailpost foot. The three-point deck angle
  // is DERIVED from this, not the other way round: a real tailwheel spring has
  // a length, and the attitude is what falls out of it. (Fixing the deck angle
  // instead pushes the tailwheel up into the tailpost as the tail arm grows,
  // and the tailpost then drags — measured, parked clearance halved.)
  twLeg:       0.23,   // m (Cub: TPB 0.25, TW axle 0.02)
  deckMin:     8.0, deckMax: 15.0,   // deg, reported and gated
  gearRake:    16.0,   // deg, CG to main axle from vertical (nose-over guard)
  trackRatio:  1.23,   // main track / CG height above ground
  washSpread:  1.12,   // propwash effective radius / prop radius (Cub-fitted)
  stabWash:    0.60,   // fraction of propwash seen by the stab / fin
  finWash:     1.00,
};

// The one preset this chantier ships: a strut-braced high-wing taildragger in
// the Cub envelope. Nulls are the derived fields — that is most of the
// aeroplane, which is the point.
const GEN_DEFAULT = {
  name: 'Garage Special',
  reg: 'F-PGAR',
  material: 'tubeFabric',
  engine: 'a65_sensenich74',
  seating: 'tandem2',
  // LOADING, not capacity: `seating` sizes the cabin, `pilots` says how many
  // seats are filled for the flight the shakedown and the gates measure. A
  // J-3-class aeroplane is flown solo; loading both seats is a different
  // aeroplane and should read as one.
  pilots: 1,
  fuelL: 50,                 // usable litres (avgas 0.72 kg/l)
  baggage: 10,               // kg

  cab:  { halfW: null, h: null, len: null, noseGap: 0.62 },
  fuse: { tailArm: null, postGap: 0.67, tailBays: 4,
          tailW: 0.10, tailBot: 0.20, tailTop: 0.38,
          crownTop: 0.60, crownSide: 0.18 },   // skin-only: former bulge, 0 = bare truss
  wing: { span: 10.0, chord: 1.60, taper: 1.0, dihedral: 3.0,
          incidence: 1.5, washout: 1.5, naca: 2412, panels: 3,
          strut: true, xLE: null },
  tail: { hSpan: null, hChord: null, hX: null,
          vHeight: null, vChord: null, vX: null },
  gear: { track: null, x: null, y: null, wheelR: 0.20,
          twX: null, twY: null, twR: 0.10 },
  paint: { base: 0xf2c437, trim: 0x1b3a5c, sweep: 0.55, gloss: 0.42 },
};

const GEN_PRESETS = { garage: GEN_DEFAULT };

// ---- helpers ------------------------------------------------------------
function genClone(o) {
  if (Array.isArray(o)) return o.map(genClone);
  if (o && typeof o === 'object') {
    const r = {};
    for (const k in o) r[k] = genClone(o[k]);
    return r;
  }
  return o;
}
const genClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// NACA 4-digit digits -> {m, p, t} as fractions of chord.
function nacaParts(code) {
  const d = String(code | 0).padStart(4, '0');
  return { m: +d[0] / 100, p: Math.max(0.05, +d[1] / 10), t: +d.slice(2) / 100 };
}

// Keep the parameter space inside an envelope this chantier has flown. The
// editor calls this on every change, so a slider can never build something the
// structure rules were not written for.
function clampSpec(spec) {
  const S = genClone(spec);
  if (!GEN_MATERIALS[S.material]) S.material = 'tubeFabric';
  if (!GEN_SEATING[S.seating]) S.seating = 'tandem2';
  if (typeof POWERPLANTS !== 'undefined' && !POWERPLANTS[S.engine])
    S.engine = 'a65_sensenich74';
  S.fuelL = genClamp(S.fuelL, 0, 140);
  S.baggage = genClamp(S.baggage, 0, 60);
  const w = S.wing;
  w.chord = genClamp(w.chord, 1.15, 2.10);
  w.span = genClamp(w.span, Math.max(6.5, 4.0 * w.chord),
                            Math.min(14.0, 10.0 * w.chord));
  w.taper = genClamp(w.taper, 0.45, 1.0);
  w.dihedral = genClamp(w.dihedral, 0, 6);
  w.incidence = genClamp(w.incidence, -1, 4);
  w.washout = genClamp(w.washout, 0, 4);
  w.panels = genClamp(w.panels | 0, 2, 5);
  const n = nacaParts(w.naca);
  w.naca = (genClamp(Math.round(n.m * 100), 0, 6) * 1000)
         + (genClamp(Math.round(n.p * 10), 2, 6) * 100)
         + genClamp(Math.round(n.t * 100), 9, 18);
  S.fuse.tailBays = genClamp(S.fuse.tailBays | 0, 3, 6);
  S.fuse.postGap = genClamp(S.fuse.postGap, 0.35, 1.10);
  S.fuse.crownTop = genClamp(S.fuse.crownTop, 0, 1);
  S.fuse.crownSide = genClamp(S.fuse.crownSide, 0, 0.6);
  S.cab.noseGap = genClamp(S.cab.noseGap, 0.40, 1.10);
  return S;
}

// Fill every null from the fields before it. `auto` records what was derived
// so the editor can mark a field "auto" and show the proposal it overrode.
// Order matters: this IS the design flow (cabin -> fuselage -> engine ->
// wing -> tail -> gear), each step reading only what precedes it.
function resolveSpec(spec) {
  const S = clampSpec(spec);
  const auto = {};
  const put = (o, k, v, path) => { if (o[k] === null || o[k] === undefined) { o[k] = v; auto[path] = true; } };

  // 1. cabin — the payload box everything else is built around
  const seat = GEN_SEATING[S.seating];
  put(S.cab, 'halfW', seat.halfW, 'cab.halfW');
  put(S.cab, 'h', seat.h, 'cab.h');
  put(S.cab, 'len', seat.len, 'cab.len');
  S.seats = seat.crew;
  S.crew = genClamp(S.pilots | 0, 1, seat.crew);

  // 2. wing longitudinal placement — the front spar lands on the cabin-front
  //    frame, which is what puts a high-wing carry-through over the cabin
  const w = S.wing;
  put(w, 'xLE', S.cab.noseGap - GEN_RULES.sparFront * w.chord, 'wing.xLE');
  const xAC = w.xLE + 0.25 * w.chord;                 // wing quarter chord
  const cBar = w.chord * (2 / 3) * (1 + w.taper + w.taper * w.taper) / (1 + w.taper);
  const semi = 0.5 * w.span;
  const Sw = w.span * w.chord * 0.5 * (1 + w.taper);
  S.geom = { xAC, cBar, semi, Sw, AR: w.span * w.span / Sw };

  // 3. fuselage length from the tail arm rule
  put(S.fuse, 'tailArm', xAC + GEN_RULES.tailArmC * w.chord, 'fuse.tailArm');
  const post = S.fuse.tailArm + S.fuse.postGap;
  S.fuse.postX = post;

  // 4. empennage from tail volume coefficients against the wing just sized
  const t = S.tail;
  put(t, 'hX', S.fuse.tailArm + 0.70 * S.fuse.postGap, 'tail.hX');
  put(t, 'vX', S.fuse.tailArm + 0.90 * S.fuse.postGap, 'tail.vX');
  const lh = Math.max(1.0, t.hX - xAC), lv = Math.max(1.0, t.vX - xAC);
  const Sh = GEN_RULES.Vh * S.geom.Sw * cBar / lh;
  const Sv = GEN_RULES.Vv * S.geom.Sw * w.span / lv;
  put(t, 'hSpan', Math.sqrt(Sh * GEN_RULES.hAR), 'tail.hSpan');
  put(t, 'hChord', Sh / t.hSpan, 'tail.hChord');
  put(t, 'vHeight', Math.sqrt(Sv * GEN_RULES.vAR), 'tail.vHeight');
  put(t, 'vChord', Sv / t.vHeight, 'tail.vChord');
  S.tail.Sh = Sh; S.tail.Sv = Sv; S.tail.lh = lh; S.tail.lv = lv;

  // 5. gear — the two hard geometric constraints of a taildragger.
  //    y: the prop must clear the ground in the LEVEL attitude (this is the
  //    binding case; three-point has the nose up and is generous).
  //    twY: set so the three-point deck angle is the design value.
  //    x and track need the CG, so genFrame() places them on a second pass.
  const PP = (typeof POWERPLANTS !== 'undefined' && POWERPLANTS[S.engine]) || null;
  const propR = PP ? PP.prop.D / 2 : 0.9;
  S.propR = propR;
  S.engY = 0.36 * S.cab.h;                      // thrustline, above the lower longeron
  S.engX = -(0.18 + 0.32 * propR);              // firewall forward: cowl + prop
  put(S.gear, 'y', S.engY - propR + S.gear.wheelR - GEN_RULES.propClear, 'gear.y');
  return { spec: S, auto };
}

if (typeof module !== 'undefined' && typeof exports !== 'undefined') { /* concat build: no-op */ }
