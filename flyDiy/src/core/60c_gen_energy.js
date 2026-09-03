// ===========================================================================
// GEN ENERGY (G97-G101) — WHERE THE ENERGY LIVES, AND HOW MUCH ROOM IT HAS.
// ===========================================================================
// `spec.fuel` has been `{ litres, tank }` over three bare names since the
// garage arc: no volume, no geometry, no station. The mass is billed once as
// `S.fuelL * 0.72` onto two nodes and never moves again, and 61_gen_frame's own
// comment admits it — "burn is not modelled, so this is the FULL-tanks case".
// Electric is worse: 00_registry excludes the battery from every motor row on
// purpose ("it is the fuel tank's analog, priced and weighed by the energy
// module"), so an EMRAX undercuts a Rotax because its energy is free.
//
// This file is that module. G97 lays the GEOMETRY it stands on: how much room
// there actually is, which is the question nothing in this project could
// answer.
//
// ---------------------------------------------------------------------------
// TWO INTERIORS, TWO MECHANISMS, AND THEY ARE NOT THE SAME KIND OF THING.
//
// THE FUSELAGE is a closed tube around a centreline, so its interior is a
// swept section of the real mesh: `tools/_bay_site.js` sweeps the `lv` rail
// from keel to roof through `fieldHits` and takes the wall off along the edge
// normals. Mesh-derived, because the cage's shape is the player's and there is
// no formula for it.
//
// THE WING IS NOT A TUBE. `_fit_site.js` already says so of its own machinery
// ("faceOut is meaningless at x=3.7"), and the wing mesh is browser-only, so a
// gate could never measure it headlessly. But it does not need to: a wing's
// interior IS a formula. The structural bay is bounded by the two spars, whose
// chord fractions are declared in GEN_RULES and load-bearing already — the
// skin is lofted on them (`kOf = (xc - sparF)/(sparR - sparF)`) — and by the
// aerofoil, which for a 4-digit NACA is closed form. So the wing tank is
// computed, exactly, from numbers the spec already carries.
//
// That split is the honest one. Running a wing bay through the fuselage's
// section sweep would pass loudly and mean nothing.

// ---------------------------------------------------------------------------
// NACA 4-DIGIT HALF-THICKNESS, the standard polynomial. `xc` is the chord
// fraction, the return is a fraction of chord ABOVE the camber line.
//
// The 0.1015 tail coefficient is the OPEN-TRAILING-EDGE form. The closed form
// uses 0.1036, and the difference is under a tenth of a per cent of the bay
// area — but the open one is what the aerofoil tables are quoted from, and
// 63_gen_wing lofts an open trailing edge, so this agrees with the wing that
// is actually built rather than with a tidier number.
function genNacaT(naca, xc) {
  const t = ((naca | 0) % 100) / 100;      // last two digits: thickness ratio
  const x = xc < 0 ? 0 : xc > 1 ? 1 : xc;
  return 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x
                  + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
}

// The area between two chord fractions, as a fraction of chord SQUARED.
// Simpson over the pair of surfaces; camber cancels, because a 4-digit camber
// line displaces both surfaces equally and the enclosed area does not care.
// n is even so Simpson is exact for the cubic part and near-exact for the sqrt.
function genAerofoilArea(naca, cLo, cHi, n) {
  const N = Math.max(4, (n || 40) & ~1);
  const lo = Math.max(0, Math.min(cLo, cHi)), hi = Math.min(1, Math.max(cLo, cHi));
  if (!(hi > lo)) return 0;
  const h = (hi - lo) / N;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const w = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2);
    s += w * 2 * genNacaT(naca, lo + h * i);      // x2: upper AND lower
  }
  return s * h / 3;
}

// ---------------------------------------------------------------------------
// THE WING BAY. Volume between the spars, over a span fraction, both wings.
//
// TAPER IS WHY THIS IS AN INTEGRAL AND NOT A MULTIPLICATION. Area goes as
// chord SQUARED, so a tapered panel's bay volume is nothing like its mean
// chord times its length — a 0.5-taper wing's outer half holds barely a third
// of what a rectangular one would. Getting that wrong would make outboard
// tanks far too generous, which is exactly the placement a player reaches for
// when the CG is too far aft.
//
// `wall` is the structural skin depth in METRES, taken off all round. It does
// NOT scale with the aeroplane: 3 mm of ply is 3 mm on any wing, the same rule
// the crew layer states and the same one GATE ENERGY caught being broken in
// the fuselage sweep.
//
// Returns LITRES for the pair. `fill` is the usable fraction of the geometric
// bay — ribs, spar webs, the bladder's own folds and the fact that a tank is
// not the whole bay. 0.72 is the wet-wing figure the light-aircraft literature
// supports; a bladder cell is lower and its catalogue row says so.
function genWingBay(wing, opt) {
  const o = opt || {};
  const naca = wing.naca || 2412;
  const cLo = o.cLo === undefined ? GEN_RULES.sparFront : o.cLo;
  const cHi = o.cHi === undefined ? GEN_RULES.sparRear : o.cHi;
  const fLo = Math.max(0, o.spanLo === undefined ? 0.12 : o.spanLo);
  const fHi = Math.min(1, o.spanHi === undefined ? 0.55 : o.spanHi);
  const wall = o.wall === undefined ? 0.003 : o.wall;
  const fill = o.fill === undefined ? 0.72 : o.fill;
  if (!(fHi > fLo)) return 0;

  const semi = (wing.span || 0) / 2;
  const root = wing.chord || 0;
  const taper = wing.taper === undefined ? 1 : wing.taper;
  const kArea = genAerofoilArea(naca, cLo, cHi);
  if (!(semi > 0) || !(root > 0) || !(kArea > 0)) return 0;

  // chord at span fraction f, and the bay's own perimeter shrunk by the wall.
  // The wall is removed as a fraction of the local section rather than by
  // offsetting the aerofoil: at 3 mm on a 1.6 m chord that is a 1.5% effect,
  // and offsetting a NACA section properly is a curve-offset problem this does
  // not need. The approximation is documented rather than hidden, and it errs
  // SMALL (it removes a band all round a shape that is thinner than its
  // bounding box), which is the safe direction for a tank.
  const N = 40;
  let v = 0;
  for (let i = 0; i < N; i++) {
    const f0 = fLo + (fHi - fLo) * (i / N);
    const f1 = fLo + (fHi - fLo) * ((i + 1) / N);
    const a = f => {
      const c = root * (1 + (taper - 1) * f);
      const th = genNacaT(naca, 0.30) * 2 * c;           // bay depth, near max
      const w = (cHi - cLo) * c;
      const gross = kArea * c * c;
      if (th <= 2 * wall || w <= 2 * wall) return 0;
      return gross * (1 - 2 * wall / th) * (1 - 2 * wall / w);
    };
    const A0 = a(f0), A1 = a(f1);
    // the conical rule again: a tapered bay is similar sections at different
    // scales, which is what this rule is exact for
    v += (f1 - f0) * semi * (A0 + A1 + Math.sqrt(A0 * A1)) / 3;
  }
  return v * 2 * 1000 * fill;      // both wings, m^3 -> litres, usable
}

// ---------------------------------------------------------------------------
// THE BAYS. Where a vessel is allowed to live.
//
// A BAY IS NOT A STATION, IT IS A REGION, and it is declared in the coordinate
// the airframe already speaks: `sL` metres aft of the firewall for the body
// (0 at the windscreen base, positive aft, which is the datum G49 settled and
// GEN_ACCESS already places against), span fraction for the wing.
//
// `on` picks the mechanism: 'body' bays are measured off the cage mesh by
// `_bay_site.js`, 'wing' bays are computed by `genWingBay`. Nothing else is a
// bay — a vessel hung in the breeze is not a design, it is a mistake, and the
// fittings arc's rule applies here too: no bay, no tank.

// ===========================================================================
// G98 — THE VESSEL CATALOGUE. Tanks and packs as things you BUY.
// ===========================================================================
// G97 gave the aeroplane bays and measured what will fit in them. This is what
// goes IN: a declared catalogue of what holds the energy, what the energy is,
// and what both of them weigh. Placement is G99's; this file only says what
// exists and what it costs you in kilos and credits.
//
// THE HOLE THIS CLOSES, and it is a real one. Until now a tank weighed
// NOTHING: `sec('fuel')` billed `S.fuelL * 0.72` of contents onto two nodes
// and that was the whole model — no vessel, no shell, no fittings. And the
// registry excludes the battery from every electric row ON PURPOSE, saying so
// in its own comment ("it is the fuel tank's analog, priced and weighed by the
// energy module"), which means an EMRAX has been undercutting a Rotax because
// its energy is free. Both of those end here.
//
// THE CONTRAST THE ARC EXISTS FOR, in the user's words: "Fuel then moves the
// CG as it burns down... A battery's mass does not change at all." So the two
// are modelled as the same shape of thing with one difference that matters —
// fuel is PAYLOAD that drains, a pack is EMPTY WEIGHT that does not.

// ---------------------------------------------------------------------------
// WHAT BURNS. Density is what the ledger weighs; the energy is what the range
// will be computed from when the burn model lands.
// ---------------------------------------------------------------------------
const GEN_FUELS = {
  avgas100LL: { name: '100LL avgas', kgL: 0.72,  MJkg: 43.5, price: 2.40,
                // the ledger's own long-standing 0.72, now declared rather
                // than written into the mass line
                note: 'the certified default; leaded' },
  mogas:      { name: 'Mogas (95)',  kgL: 0.745, MJkg: 43.4, price: 1.60,
                note: 'cheaper and denser; a Rotax or a VW runs on it' },
};

// ---------------------------------------------------------------------------
// WHAT STORES CHARGE. `WhKg` and `WhL` are CELL figures; `packK` is what
// survives to pack level once the case, the busbars, the BMS and the cooling
// are in — 0.65-0.75 is the real range and it is why a 250 Wh/kg cell makes a
// 170 Wh/kg aeroplane.
// ---------------------------------------------------------------------------
const GEN_CELLS = {
  lifepo4: { name: 'LiFePO4',      WhKg: 115, WhL: 230, packK: 0.75,
             price: 320, cycles: 3000,
             note: 'heavy, cheap, and it does not burn' },
  nmc:     { name: 'NMC pouch',    WhKg: 210, WhL: 460, packK: 0.70,
             price: 480, cycles: 1200,
             note: 'the volume default' },
  nca:     { name: 'NCA cylindrical', WhKg: 250, WhL: 550, packK: 0.68,
             price: 700, cycles: 800,
             note: 'the lightest, the dearest, the shortest-lived' },
};

// ---------------------------------------------------------------------------
// WHAT HOLDS IT. A vessel is a SHELL, so its mass goes with its SURFACE and
// not with its volume: double the litres and you get 1.59x the skin, which is
// why one big tank beats two small ones and why the catalogue is worth having.
//
//   surface = shapeK * V^(2/3)     V in m3, shapeK 6 for a cube
//   mass    = surface * kgM2 + fixed
//
// `shapeK` is above 6 for anything that is not a cube: a wing tank is a flat
// slab and a bladder follows a bay, so both have more skin per litre than a
// cube does. `fixed` is the filler, the drain, the sender and the fittings,
// which do not care how big the tank is.
//
// ANCHORED, not invented: a 45 L welded aluminium light-aircraft tank is
// about 5 kg. 0.045 m3 gives V^(2/3) = 0.127, times shapeK 6.6 is 0.84 m2,
// times 3.4 kg/m2 (1.2 mm 5052 with its seams) is 2.9 kg, plus 2.2 kg of
// fittings = 5.1. The bladder row is a Cub's rubberised cell; the moulded row
// is rotomoulded polyethylene, cheap and thick; `wet` is no vessel at all --
// the structure itself is sealed, which is how a metal wing carries fuel and
// why it is the lightest and the dearest to build.
// ---------------------------------------------------------------------------
const GEN_VESSELS = {
  alu:     { name: 'Welded aluminium', holds: 'fuel',
             shapeK: 6.6, kgM2: 3.4, fixed: 2.2, price: 14, priceFixed: 180 },
  bladder: { name: 'Rubber bladder',   holds: 'fuel',
             shapeK: 7.4, kgM2: 1.9, fixed: 1.6, price: 26, priceFixed: 240 },
  moulded: { name: 'Moulded plastic',  holds: 'fuel',
             shapeK: 6.8, kgM2: 2.6, fixed: 1.8, price: 8,  priceFixed: 90 },
  wet:     { name: 'Wet wing (sealed structure)', holds: 'fuel',
             // no shell at all: the sealant and the ribs' extra work only
             shapeK: 6.6, kgM2: 0.55, fixed: 1.2, price: 30, priceFixed: 420 },
  packCase:{ name: 'Pack case',        holds: 'battery',
             shapeK: 6.2, kgM2: 4.1, fixed: 3.0, price: 40, priceFixed: 300 },
};

// The volume a vessel needs, and what it and its contents weigh. ONE function,
// so the editor's readout, the ledger and the gate cannot disagree.
//   kind      'fuel' | 'battery'
//   capacity  litres of fuel, or kWh of pack energy
// Returns litres of INSTALLED VOLUME (what has to fit in a bay), the vessel's
// own mass, the contents' mass, and what the pair costs.
function genVesselResolve(kind, capacity, vesselKey, mediumKey) {
  const battery = kind === 'battery';
  const V = Math.max(0, capacity || 0);
  const ves = GEN_VESSELS[vesselKey] ||
              (battery ? GEN_VESSELS.packCase : GEN_VESSELS.alu);
  let litres, contents, mediumPrice;
  if (battery) {
    const cell = GEN_CELLS[mediumKey] || GEN_CELLS.lifepo4;
    const packWhKg = cell.WhKg * cell.packK;
    const packWhL  = cell.WhL  * cell.packK;
    contents = V * 1000 / Math.max(1, packWhKg);      // kWh -> kg of cells
    litres   = V * 1000 / Math.max(1, packWhL);       // kWh -> litres of cells
    mediumPrice = V * cell.price;
  } else {
    const fuel = GEN_FUELS[mediumKey] || GEN_FUELS.avgas100LL;
    litres   = V;
    contents = V * fuel.kgL;
    mediumPrice = V * fuel.price;
  }
  const m3 = litres / 1000;
  const surface = ves.shapeK * Math.pow(Math.max(1e-9, m3), 2 / 3);
  const vesselKg = m3 > 1e-9 ? surface * ves.kgM2 + ves.fixed : 0;
  return {
    kind, capacity: V, vessel: ves, litres, battery,
    // the space it actually occupies: cells and case, or fuel and ullage
    installedL: litres * (battery ? 1.18 : 1.06),
    vesselKg, contentsKg: contents, surface,
    // WHAT DRAINS AND WHAT DOES NOT, decided HERE and nowhere else (G99).
    // These two lived on genEnergyResolve, one level up, and the ledger reads
    // vessels one at a time — so it got `undefined` for both and billed NaN
    // onto the firewall ring. The split is a property of the vessel, so it
    // belongs to the vessel: fuel is payload and it leaves, a pack's cells are
    // empty weight and they stay.
    payloadKg: battery ? 0 : contents,
    emptyKg: vesselKg + (battery ? contents : 0),
    price: Math.round(m3 > 1e-9
      ? ves.priceFixed + litres * ves.price + mediumPrice : 0),
  };
}

// THE SPEC'S ENERGY, RESOLVED. One reader for the ledger, the shakedown, the
// editor and the gate, so the four cannot disagree about what the aeroplane
// is carrying. Nulls are DERIVED, the same contract the rest of the spec
// keeps: no vessel named means the obvious one for the kind.
function genEnergyResolve(S) {
  const E = (S && S.energy) || {};
  const battery = E.kind === 'battery';
  const vesselKey = E.vessel || (battery ? 'packCase' : 'alu');
  const capacity = battery ? (E.kWh || 0)
                           : ((S.fuel && S.fuel.litres) || 0);
  const medium = battery ? (E.cell || 'lifepo4') : (E.fuel || 'avgas100LL');
  const r = genVesselResolve(battery ? 'battery' : 'fuel',
                             capacity, vesselKey, medium);
  r.medium = medium;
  r.vesselKey = vesselKey;
  r.battery = battery;
  // payloadKg / emptyKg come from genVesselResolve, which is the one place
  // that split is decided
  return r;
}

// ===========================================================================
// G99 — WHERE A VESSEL CAN GO, AND WHETHER IT FITS.
// ===========================================================================
// THE RANGES ARE DERIVED NOW, and G97 asked for exactly this when it wrote
// them: "the sL ranges I wrote are reasoned from the firewall datum, not
// measured. G99 will either confirm them or move them, and the fit tests are
// what will say which." They did not survive contact.
//
// MEASURED ON THE STOCK BUILD: the firewall is x = 0, the cabin runs
// 0.62..1.40 and the tailpost is at 4.94. The declared nose bay was
// -0.95..-0.05 — entirely FORWARD of the firewall, which is where the engine
// is, not the tank — and the cabin bay was 0.05..1.30, half a metre ahead of
// the cabin it is named for. Only `aftCabin` was nearly right.
//
// A LITERAL RANGE CANNOT BE RIGHT FOR TWO AEROPLANES, which is the real
// lesson: `noseGap` and `cab.len` are sliders, so the cabin moves and the bay
// has to move with it. Each bay now carries a RULE over the resolved spec and
// returns metres aft of the firewall, the same datum the surface field and the
// access fittings already use. `lv` is the vertical band as a fraction of the
// section, 0 at the keel and 1 at the crown.
const GEN_BAYS = {
  nose: {
    name: 'Nose bay', on: 'body',
    serves: 'behind the firewall, ahead of the panel',
    // the Cub's twelve gallons, and the Velis Electro's forward pack. It is
    // the only bay ABOVE the carburettor on most layouts, which is what makes
    // gravity feed possible at all.
    feed: 'gravity',
    lv: [0.25, 1],
    // UNDER THE COWL DECK, FORWARD OF THE WINDSCREEN BASE (G99 UI). This ran
    // [0, noseGap] — from the windscreen base AFT to the cabin pillar — which
    // on the built Cub is the pilot's knees and head: measured, a tank
    // settled there sat through the crew at 2030 points. The user's rule for
    // where a tank goes: "collated to the firewall, on the engine side". The
    // engine side of the windscreen base is the cowl deck, and the field has
    // sections all through it (measured: from the firewall at -0.65 m the
    // bay is ~1.0 m wide and 0.85 m deep with the deck top at +0.1) — which
    // is exactly where a J-3 keeps its twelve gallons. The bay is that deck
    // and it ENDS AT THE WINDSCREEN BASE: measured on the built Cub the
    // panel and the pilot's knees sit right there, so "ahead of the panel"
    // is x = 0 and not a depth past it. The region aft, around the pilot, is
    // not a tank place and so is no bay: the two places the rule names are
    // this one and the cabin-side bays' aft bulkheads.
    // `cowlDeck` is the join's measurement of the deck; 0.10 m of it is the
    // firewall's own structure and the engine-mount face.
    range: S => [-Math.max(0.3, (S.fuse.cowlDeck || 0.6)) + 0.10, 0.0],
  },
  cabin: {
    name: 'Cabin', on: 'body',
    serves: 'around the occupants — the motorglider case',
    // FREE WITHIN THE BAY on purpose: this is the one the user named, where
    // "you would put them really wherever they fit". The clearance test
    // against the crew does the work a fixed station cannot.
    free: true, feed: 'pumped',
    lv: [0, 1],
    range: S => [S.cab.noseGap, S.cab.noseGap + S.cab.len],
  },
  underFloor: {
    name: 'Under the floor', on: 'body',
    serves: 'below the floorboards, between the spar carry-throughs',
    // a structural floor pack, the Alice layout. Low and near the CG: the best
    // place to put mass and the worst to get fuel out of by gravity.
    feed: 'pumped',
    lv: [0, 0.30],
    range: S => [S.cab.noseGap, S.cab.noseGap + S.cab.len],
  },
  aftCabin: {
    name: 'Behind the cabin', on: 'body',
    serves: 'aft of the rear bulkhead',
    // the Velis Electro's aft pack. Bracketing the CG with two packs is
    // deliberate on the real aeroplane and should be discoverable here.
    feed: 'pumped',
    lv: [0, 1],
    // stops well short of the tailpost: the boom is too slender to hold
    // anything and mass that far aft is a balance problem, not a bay.
    range: S => [S.cab.noseGap + S.cab.len + S.fuse.cargoLen,
                 Math.max(S.cab.noseGap + S.cab.len + S.fuse.cargoLen + 0.3,
                          0.55 * S.fuse.tailArm)],
  },
  wingRoot: {
    name: 'Wing root', on: 'wing',
    serves: 'the inboard spar bay',
    span: [0.12, 0.55], feed: 'pumped',
  },
  wingPanel: {
    name: 'Outboard panel', on: 'wing',
    serves: 'the outboard spar bay — relieves the spar, slows the roll',
    span: [0.55, 0.88], feed: 'pumped',
  },
};

// THE BAYS OF THIS AEROPLANE, measured. Body bays get their station range from
// the rule above and their VOLUME from the fuselage's own station table — the
// sections are swept as ellipses inscribed in (halfW, yt-yb), inset by a wall,
// and integrated between the bay's limits. That is the same shape of answer
// `_bay_site.js` gets off the real mesh and deliberately a cruder one: core
// has no mesh, and a bay's capacity has to be knowable without the editor
// open. The editor's own fit test is the finer instrument and overrules this
// one where they disagree.
const GEN_BAY_WALL = 0.035;              // metres of structure and trim, per side
function genBayResolve(S, key, ST) {
  const B = GEN_BAYS[key];
  if (!B) return null;
  if (B.on === 'wing') {
    const litres = genWingBay(S.wing, { spanLo: B.span[0], spanHi: B.span[1] });
    return { key, name: B.name, on: 'wing', feed: B.feed, free: !!B.free,
             span: B.span.slice(), litres,
             // where its mass acts: the mid-span of the bay, both sides
             zFrac: 0.5 * (B.span[0] + B.span[1]) };
  }
  const [x0, x1] = B.range(S);
  // THE SECTIONS COME FROM WHOEVER HAS THEM. The body's shape is 60b's loft
  // and the frame is what samples it, so core does not rebuild that here — it
  // is handed the station table it already exists in (`def.parts.ST`, or the
  // spec's own measured `fuse.profile` when a build carries one). Rebuilding
  // the loft to ask it a question is how two shapes for one body start.
  const rows = [];
  const L = S.fuse.tailArm;
  if (ST && ST.length && ST[0].x != null) {
    for (const r of ST) rows.push({ x: r.x, w: r.w, yb: r.yb, yt: r.yt });
  } else if (S.fuse.profile && S.fuse.profile.length) {
    for (const r of S.fuse.profile)
      rows.push({ x: r.t * L, w: r.w, yb: r.yb, yt: r.yt });
  }
  let litres = 0;
  if (rows.length > 1) {
    const at = x => {
      if (x <= rows[0].x) return rows[0];
      if (x >= rows[rows.length - 1].x) return rows[rows.length - 1];
      for (let i = 0; i < rows.length - 1; i++) {
        const a = rows[i], b = rows[i + 1];
        if (x >= a.x && x <= b.x) {
          const t = (x - a.x) / Math.max(1e-9, b.x - a.x);
          return { x, w: a.w + (b.w - a.w) * t,
                   yb: a.yb + (b.yb - a.yb) * t,
                   yt: a.yt + (b.yt - a.yt) * t };
        }
      }
      return rows[rows.length - 1];
    };
    const N = 24, lv = B.lv || [0, 1];
    for (let i = 0; i < N; i++) {
      const xa = x0 + (x1 - x0) * (i + 0.5) / N;
      const r = at(xa);
      const a = Math.max(0, r.w - GEN_BAY_WALL);
      const b = Math.max(0, 0.5 * (r.yt - r.yb) - GEN_BAY_WALL);
      // the ellipse's area, times the vertical band this bay occupies
      litres += Math.PI * a * b * (lv[1] - lv[0]) * ((x1 - x0) / N) * 1000;
    }
  }
  return { key, name: B.name, on: 'body', feed: B.feed, free: !!B.free,
           x0, x1, lv: (B.lv || [0, 1]).slice(), litres,
           // where its mass acts by default: the middle of the bay
           xMid: 0.5 * (x0 + x1) };
}
function genBayList(S, ST) {
  const out = [];
  for (const k in GEN_BAYS) out.push(genBayResolve(S, k, ST));
  return out;
}

