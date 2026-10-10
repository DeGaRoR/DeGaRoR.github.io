// FREIGHT SITE (G2340, FREIGHT-MODEL) — THE HOLD AND THE DOORS, MEASURED OFF THE AIRFRAME'S OWN MESH.
//
// The fuel path already measures the inside of an aeroplane: `_bay_site.js` sweeps the field's lv rail through
// the real sheet and takes the 35 mm wall (GEN_BAY_WALL) off along the edge normals; `_cage_gen.js
// cageDoorEdges` reads each cabin door's outline off the same sheet (the hinge and the handle layers hang on it).
// Freight needs both and nothing new: the HOLD is the bay machinery swept from the front row's seat pan aft to
// where GEN_BAYS.aftCabin stops ("mass that far aft is a balance problem, not a bay"), and the DOORS are
// cageDoorEdges' outlines. This file only turns those two readings into a FREIGHT CARD — plain numbers the pure
// core (src/core/76_freight.js) packs against. Nothing is re-derived: the coordinates are the join's own
// (x = metres aft of the windscreen-base ring = the field's sL x FS; a cage z maps to x = zFw - z x FS with zFw
// the join's `wsFront` ring, _cage_join.js G49), the seats are the join's measured stations (cabin.seatsX), the
// mass and the CG range are genShakedown's (the plaque: designGross, the four corners).
//
//   freightMeasure(spec, opts)  -> card            (spec: a saved build's spec; opts.patch 'floats' as
//                                                    CONTRACT_DESIGNS' twin; opts.id / label)
//   freightMeasureFile(file, D) -> card            (D: a CONTRACT_DESIGNS row)
//
// THE CARD (metres; the hold's profile in centimetres, integers, so it is small and byte-stable):
//   { v, id, label,
//     hold:  { x0, dx, n, y0, dy, ny, floor: [cm per station], half: [[cm per y-cell] per station] }
//            n+1 stations x0 + i dx; half[i][j] = the clear half-width at y0 + j dy (0 = closed or below the floor)
//     cabinX1                                     the cabin's aft ring (the box rear: where the baggage bay begins)
//     seats: [ { i, x, back, row, z, w } ]        x = the occupant's CG station (seatsX), back = the seat back
//     doors: [ { id, side, x0, x1, y0, y1, rects: [[w, h]], st } ]   the clear rectangles (Pareto), and the hold's
//                                                 station at the door (the room a long item swings into)
//     mass:  { mtow, base: { kg, x }, cg: [fwd x, aft x], mac: [xLE, c], bagKg, seats } }
// `cg` is the plaque's four corners, each with and without its baggage allowance (measureMass).
// `base` is the solo pilot at full fuel with NO baggage: the plaque's corner re-fed with cabin.baggage = 0 (the
// baggage allowance IS the freight once items are loaded, so it is not counted twice).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');
const BS = require('./_bay_site.js');
const FSI = require('./_fit_site.js');
const SH = require('./_scene_headless.js');

const FREIGHT_SITE_V = 1;
const DX = 0.10, DY = 0.05;            // the hold's station pitch and its y-cell (m)
const MIN_OPEN = 0.30;                 // a station narrower or lower than this ends the hold (m)
const PAN = 0.50;                      // the seat pan's depth ahead of the back (m)
const CLEAR = 0.02;                    // the handling clearance taken off a door's opening, each side (m)
const r3 = v => Math.round(v * 1000) / 1000;
const cm = v => Math.max(0, Math.round(v * 100));

// the spec a design flies (CONTRACT_DESIGNS' twin is a patched file: its floats)
function specOf(j, patch) {
  const s = JSON.parse(JSON.stringify(j.spec || j));
  if (patch === 'floats') { s.gear.type = 'floats'; s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); }
  return s;
}

// ---- THE PLAQUE: MTOW, the certified CG range, the base loading --------------------------------------------
function measureMass(def) {
  const sh = CORE.genShakedown(def);
  const S = def.spec, E = sh.envelope;
  const cs = E.corners;
  // % MAC is linear in x: two corners give the datum and the chord (the plaque's own pct())
  let xLE = null, c = null;
  for (let i = 1; i < cs.length && c == null; i++)
    if (Math.abs(cs[i].cgPct - cs[0].cgPct) > 1e-6) {
      c = (cs[i].cgX - cs[0].cgX) / (cs[i].cgPct - cs[0].cgPct);
      xLE = cs[0].cgX - cs[0].cgPct * c;
    }
  // the solo full-fuel corner, re-fed exactly as the plaque's corners are (genSpecAtFuel + the cabin), minus
  // the baggage allowance
  const corner = (occupants, litres, bag) => {
    const b = CORE.genSpecAtFuel(S, litres);
    b.cabin.pilots = 1; b.cabin.pax = Math.max(0, occupants - 1); b.cabin.occupied = null; b.cabin.baggage = bag;
    return CORE.genShakedown(CORE.buildGen(b), { slim: true });
  };
  const full = (S.fuel && S.fuel.litres) || 0;
  const bsh = corner(1, full, 0);
  // THE CERTIFIED CG RANGE: the plaque's four corners (solo / full cabin x full fuel / reserves), each with its
  // baggage allowance as the plaque loads it AND without it - the allowance is what the freight replaces, so a
  // flight with nothing in the back is inside the range it was certified over
  let fwd = E.fwd.cgX, aft = E.aft.cgX;
  for (const c of cs) {
    const x = corner(c.occupants, c.litres, 0).cgX;
    if (x < fwd) fwd = x;
    if (x > aft) aft = x;
  }
  return {
    mtow: r3(def.parts.designGross),
    base: { kg: r3(bsh.mass), x: r3(bsh.cgX) },
    cg: [r3(fwd), r3(aft)],
    mac: [r3(xLE), r3(c)],
    bagKg: (S.cabin && S.cabin.baggage) || 0,
    seats: Math.max(1, S.seats | 0),
  };
}

// ---- THE SEATS: the join's measured stations, grouped into rows ------------------------------------------
function measureSeats(S, halfAt) {
  const n = Math.max(1, S.seats | 0);
  const xs = (Array.isArray(S.cab && S.cab.seatsX) ? S.cab.seatsX : []).slice(0, n);
  const out = [];
  let row = -1, lastX = -1e9, inRow = [];
  const rows = [];
  xs.forEach((x, i) => {
    if (Math.abs(x - lastX) > 0.05) { row++; rows.push([]); lastX = x; }
    rows[row].push(i);
  });
  for (const r of rows) {
    for (let k = 0; k < r.length; k++) {
      const i = r[k], x = xs[i], back = x + 0.20;              // _cage_join.js SEAT_CG_FWD
      const hw = halfAt(back - PAN * 0.5);
      // abreast seats split the width (the pilot on -z, the join's port), a single seat takes the middle
      const abreast = r.length;
      const w = Math.min(0.50, 2 * hw / abreast);
      const z = abreast === 1 ? 0 : -hw + (2 * hw / abreast) * (k + 0.5);
      out.push({ i, x: r3(x), back: r3(back), row: rows.indexOf(r), z: r3(z), w: r3(w) });
    }
  }
  return out;
}

// ---- THE HOLD: the inset sections, station by station ------------------------------------------------------
// one station -> { floor (y), cells: [{ y, half }] } from the sheet, in metres (game frame, cage y)
function stationAt(mesh, FS, x) {
  const sL = x / FS;
  const sec = BS.baySection(mesh, sL);
  if (!sec) return null;
  const inner = BS.bayInset(sec.poly, CORE.GEN_BAY_WALL / FS);
  if (!inner || inner.length < 3) return null;
  const P = inner.map(p => [p[0] * FS, p[1] * FS]);
  // the floor: the field's lv 1 rail (the floorboards), never below the inset section
  let floor = -Infinity;
  for (const h of FSI.fieldHits(mesh, FSI.AX_RAIL, sL, 1)) if (h.p[1] * FS > floor) floor = h.p[1] * FS;
  const yMin = Math.min(...P.map(p => p[1])), yMax = Math.max(...P.map(p => p[1]));
  if (!isFinite(floor) || floor < yMin) floor = yMin;
  // the clear half-width at y: the horizontal chord through the polygon, the interval holding the centreline
  const halfAt = y => {
    if (y < floor - 1e-9 || y > yMax) return 0;
    let lo = -Infinity, hi = Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
      const t = (y - a[1]) / (b[1] - a[1]), xz = a[0] + (b[0] - a[0]) * t;
      if (xz <= 0 && xz > lo) lo = xz;
      if (xz >= 0 && xz < hi) hi = xz;
    }
    return (isFinite(lo) && isFinite(hi)) ? Math.max(0, Math.min(-lo, hi)) : 0;
  };
  return { x, floor, yMax, halfAt };
}

function measureHold(mesh, FS, S, def, seats) {
  // fore: the front row's seat pan; aft: GEN_BAYS.aftCabin's own end (reused, not re-ruled), or where the
  // section stops being a hold (narrower or lower than MIN_OPEN)
  const front = seats.length ? Math.min(...seats.map(s => s.back)) - PAN : def.parts.ST[1].x;
  const aft = CORE.genBayResolve(S, 'aftCabin', def.parts.ST);
  const xEnd = aft ? aft.x1 : def.parts.cabRear;
  const x0 = Math.round(front / DX) * DX;
  const st = [];
  for (let x = x0; x <= xEnd + 1e-9; x += DX) {
    const s = stationAt(mesh, FS, x);
    if (!s) break;
    // usable: the widest clear chord and the height over the floor that holds MIN_OPEN wide
    let open = 0;
    for (let y = s.floor; y <= s.yMax; y += 0.01) if (2 * s.halfAt(y) >= MIN_OPEN) open += 0.01;
    if (open < MIN_OPEN) break;
    st.push(s);
  }
  if (st.length < 2) return null;
  const y0 = Math.floor(Math.min(...st.map(s => s.floor)) / DY) * DY;
  const yTop = Math.max(...st.map(s => s.yMax));
  const ny = Math.ceil((yTop - y0) / DY) + 1;
  const half = st.map(s => {
    const row = [];
    for (let j = 0; j < ny; j++) {
      // a cell is the min over its band (its two edges, the floor clipping the lower): the conservative side;
      // a cell wholly below the floor is closed (0) - the box test also holds a box on the floor
      const ya = y0 + j * DY, yb = ya + DY;
      row.push(cm(Math.min(s.halfAt(Math.max(ya, s.floor)), s.halfAt(Math.min(yb, s.yMax)))));
    }
    return row;
  });
  return { x0: r3(x0), dx: DX, n: st.length - 1, y0: r3(y0), dy: DY, ny, floor: st.map(s => cm(s.floor - y0)), half,
           _st: st };
}

// ---- THE DOORS: cageDoorEdges' outlines -> clear rectangles --------------------------------------------------
// the door's OUTLINE in (x, y), game metres: the four runs in order round the door - the sill fore to aft, the
// aft edge up, the header aft to fore, the forward edge down - joined by straight lines where the runs stop (the
// windshield slant between the forward run's top and the header is such a join on the 172)
function doorOutline(d, toX, FS) {
  const P = run => run.pts.map(p => [toX(p[2]), p[1] * FS]);
  return [].concat(P(d.bot).sort((a, b) => a[0] - b[0]), P(d.aft).sort((a, b) => a[1] - b[1]),
                   P(d.top).sort((a, b) => b[0] - a[0]), P(d.fwd).sort((a, b) => b[1] - a[1]));
}
// the outline's clear width at y: the inner span between the crossings fore and aft of the door's middle
function chordAt(poly, y, xm) {
  let lo = -Infinity, hi = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
    const x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    if (x <= xm && x > lo) lo = x;
    if (x >= xm && x < hi) hi = x;
  }
  return isFinite(lo) && isFinite(hi) ? hi - lo : 0;
}
function measureDoors(edges, FS, zFw, hold) {
  const toX = z => zFw - z * FS;
  const out = [];
  for (const d of edges) {
    const poly = doorOutline(d, toX, FS);
    const xm = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const yBot = Math.max(...d.bot.pts.map(p => p[1] * FS)), yTop = Math.min(...d.top.pts.map(p => p[1] * FS));
    if (!(yTop > yBot)) continue;
    const ys = [];
    for (let y = yBot; y <= yTop + 1e-9; y += 0.02) ys.push(Math.min(y, yTop));
    const wAt = ys.map(y => chordAt(poly, y, xm));
    // every (bottom, top) pair: the narrowest width between them -> the Pareto set of clear rectangles
    const cand = [];
    for (let a = 0; a < ys.length; a++) {
      let w = Infinity;
      for (let b = a; b < ys.length; b++) {
        w = Math.min(w, wAt[b]);
        cand.push([w - 2 * CLEAR, ys[b] - ys[a] - 2 * CLEAR]);
      }
    }
    const pareto = cand.filter(c => c[0] >= 0.10 && c[1] >= 0.10 && !cand.some(o => o !== c && o[0] >= c[0] && o[1] >= c[1] && (o[0] > c[0] || o[1] > c[1])));
    pareto.sort((p, q) => q[0] - p[0] || q[1] - p[1]);
    // thinned to at most 8, evenly through the front, always keeping both ends
    const keep = [];
    const K = Math.min(8, pareto.length);
    for (let k = 0; k < K; k++) keep.push(pareto[Math.round(k * (pareto.length - 1) / Math.max(1, K - 1))]);
    const rects = keep.filter((r, i, a) => a.findIndex(q => q[0] === r[0] && q[1] === r[1]) === i).map(r => [r3(r[0]), r3(r[1])]);
    const xs = d.fwd.pts.concat(d.aft.pts).map(p => toX(p[2]));
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    // the hold's station at the door (its middle, clipped into the hold): the room a long item swings into
    const st = hold ? Math.max(0, Math.min(hold.n, Math.round((0.5 * (x0 + x1) - hold.x0) / hold.dx))) : null;
    out.push({ id: d.key, side: d.key.endsWith(':P') ? 1 : -1, x0: r3(x0), x1: r3(x1), y0: r3(yBot), y1: r3(yTop),
               rects, st });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---- THE CARD -----------------------------------------------------------------------------------------------
function freightMeasure(specIn, opts) {
  opts = opts || {};
  const spec = specOf({ spec: specIn }, opts.patch);
  const def = CORE.buildGen(CORE.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  const S = def.spec;
  const r = SH.sceneBuild(spec, { layers: new Set() });
  const M = r.built.sheet, FS = r.FS, C2 = r.W.CAGE2;
  // the join's firewall ring (G49): the x datum every station of the game spec is measured from
  const R = C2.cageResolve(C2.cageSpec(Object.assign({}, r.P)));
  const zOf = n => { const q = R.rings.find(x => x.name === n); const l = q && q.lv && (q.lv.waist || q.lv.keel); return l && isFinite(l.z) ? l.z * FS : null; };
  const zFw = ['wsFront', 'wsAft', 'aeroWsA', 'ring'].map(zOf).find(z => z != null);
  const st0 = x => { const s = stationAt(M, FS, x); return s ? Math.max(0.15, s.halfAt(s.floor + 0.30)) : 0.30; };
  const seats = measureSeats(S, st0);
  const hold = measureHold(M, FS, S, def, seats);
  const doors = measureDoors(C2.cageDoorEdges(M), FS, zFw, hold);
  // GEN_ACCESS's baggage door, when the aeroplane carries one (a bay longer than 0.25 m): its declared size
  const acc = CORE.genAccessList(CORE.genAccessNeeds(S)).find(a => a.key === 'baggageDoor');
  if (acc && hold) {
    const x = acc.at.sL, w = acc.size.w, h = acc.size.h;
    doors.push({ id: 'baggage', side: -1, x0: r3(x - w / 2), x1: r3(x + w / 2), y0: null, y1: null,
                 rects: [[r3(w - 2 * CLEAR), r3(h - 2 * CLEAR)]],
                 st: Math.max(0, Math.min(hold.n, Math.round((x - hold.x0) / hold.dx))) });
  }
  const card = {
    v: FREIGHT_SITE_V, id: opts.id || null, label: opts.label || null,
    hold: hold ? (({ _st, ...h }) => h)(hold) : null,
    cabinX1: r3(def.parts.cabRear),
    seats, doors, mass: measureMass(def),
  };
  return card;
}
function freightMeasureFile(file, D) {
  const j = JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(ROOT, file), 'utf8'));
  return freightMeasure(j.spec || j, { patch: D && D.patch, id: D && D.id, label: D && D.label });
}

// THE TABLE'S TEXT: the cards as src/core/76_freight.js holds them between its BEGIN / END marks (one card a line)
const CARDS_FILE = path.join(ROOT, 'src', 'core', '76_freight.js');
function cardsBlock(cards) {
  return 'const FREIGHT_CARDS = {\n' + Object.keys(cards).map(k => '  ' + k + ': ' + JSON.stringify(cards[k]) + ',').join('\n') + '\n};';
}
function measureAll(DS) {
  const out = {};
  for (const k of Object.keys(DS)) out[k] = freightMeasureFile(DS[k].build, DS[k]);
  return out;
}
function writeCards(cards) {
  const src = fs.readFileSync(CARDS_FILE, 'utf8');
  const a = src.indexOf('// FREIGHT_CARDS-BEGIN'), b = src.indexOf('// FREIGHT_CARDS-END');
  const head = src.slice(0, src.indexOf('\n', a) + 1);
  fs.writeFileSync(CARDS_FILE, head + cardsBlock(cards) + '\n' + src.slice(b));
}

module.exports = { freightMeasure, freightMeasureFile, measureAll, cardsBlock, writeCards, CARDS_FILE, FREIGHT_SITE_V, DX, DY };

if (require.main === module && process.argv.includes('--write')) {
  const cards = measureAll(CORE.CONTRACT_DESIGNS);
  writeCards(cards);
  console.log('FREIGHT_CARDS written: ' + Object.keys(cards).join(', '));
} else if (require.main === module) {
  const ids = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const DS = CORE.CONTRACT_DESIGNS;
  for (const k of (ids.length ? ids : Object.keys(DS))) {
    const t0 = Date.now();
    const c = freightMeasureFile(DS[k].build, DS[k]);
    const H = c.hold;
    console.log(k, (Date.now() - t0) + ' ms', 'hold', H ? H.x0 + '..' + r3(H.x0 + H.n * H.dx) + ' (' + (H.n + 1) + ' st, ' + H.ny + ' cells)' : 'none',
      'cabinX1', c.cabinX1, 'mass', JSON.stringify(c.mass));
    for (const s of c.seats) console.log('   seat', JSON.stringify(s));
    for (const d of c.doors) console.log('   door', JSON.stringify(d));
    if (process.argv.includes('--profile') && H)
      H.half.forEach((row, i) => console.log('   x', r3(H.x0 + i * H.dx), 'floor', H.floor[i], row.join(' ')));
  }
}
