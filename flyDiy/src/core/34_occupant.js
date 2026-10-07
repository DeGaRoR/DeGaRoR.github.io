// ============================================================
// THE OCCUPANTS IN A CRASH (G2373-G2377, DMG-OCCUPANT; the DEFORM COORDINATOR's DMG block). The user, 7 Oct: "let's
// stay vague ... let's not get into the detail, it's sad and frightening." Per occupied seat the game says ONE of five
// words - GEN_OCC.bands - and nothing more; the criteria behind it stay here, in the gates and in HANDOVER.
//
// What is recorded, behind the damage layer only (30_solver: DMG_ON; off, nothing here exists - not one buffer, not one op):
//   THE SEAT: each filled seat's station (cabin.seatsX, metres aft of the firewall, the join's measurement; else the
//     ring its row bills onto, 61_gen_frame's SEAT_ROWS rule) between two cabin pillars (the S<i> rings); its velocity
//     is the occupant's load path - the four floor nodes the frame bills the 80 kg onto (61_gen_frame billAt), by the
//     same lever-arm split, a side seat leaning 3:1 to its own wall - and its frame the bay's own (forward: ring i+1 to
//     ring i, up: the floor to the roof, lateral: their cross).
//   THE PULSE: the seat's velocity, averaged over each solver substep of a ~1 ms bin (a box-car before the difference),
//     in a BOUNDED ring buffer (GEN_OCC.len s at most). It records only on an ARMED frame (30_solver armFrame: a trunk or
//     an obstacle in reach, a scrape, a member past half its yield - never on an intact aeroplane flying clear) and is
//     KEPT when an event fires: a member breaks, the contact g passes GEN_OCC.trigG, or the solver calls a crash; it
//     closes at the crash's end (DMG.over), when the buffer is full, or - an event that is no crash - after
//     GEN_OCC.quiet s of nothing. Its pre-trigger history is the last GEN_OCC.pre s of armed frames.
//   THE SPACE: the occupant's point (the chest: a seat's station, a quarter of the width from its wall, GEN_OCC.chest of
//     the bay's height) rides its bay's eight corners trilinearly; once a frame while the event runs its clearance to
//     the bay's walls (the floor, the roof, the two sides, the ring ahead - the panel or the firewall) over the same
//     clearance as built, and the nearest node of any OTHER structure now inside the bay (an engine, a ring ahead, a
//     wing root: outside it as built) over the smallest of those clearances. The worst held over GEN_OCC.hold frames.
//     The bay's corners on two pieces at the end (the cabin parted at the seat) is its own row.
//   THE RESTRAINT: spec.cabin.restraint ('harness' | 'lap') when the build says; no build carries it (the cage's belt
//     option is drawn-only and was removed 2026-09-20), so the validated builds default to a lap belt + shoulder harness
//     (`restraintDefault: true` on the result). The seat's type (spec.outfit.seats, GEN_SEATS) says whether it was
//     dynamically tested ('energy': FAR 23.562) or only statically (23.561).
//
// THE CRITERIA (sources AS RECALLED - none opened in this session; GAME where no source fits, said so):
//   DRI   the Dynamic Response Index, spinal (+z): the seat's spinal acceleration (the accelerometer's specific force,
//         1 g at rest) through a single-degree spring-mass, wn 52.9 rad/s, zeta 0.224 (Stech & Payne 1969, AMRL-TR-66-157;
//         MIL-S-9479; the AGARD-CP-472 Brinkley model's z axis); DRI = wn^2 dmax / g. Brinkley's limits (AGARD 1990):
//         15.2 low risk (~0.5 % spinal injury), 18.0 moderate (~5 %), 22.8 high (~50 %).
//   EIBAND the tolerance to a uniform pulse vs its duration (Eiband 1959, NASA Memo 5-19-59E), longitudinal (the
//         eyeballs-out curve, the lower, used both ways) and lateral, restrained occupant: the voluntary (uninjured)
//         limit and the moderate-injury limit (above it the severe-injury region); the plateau of a duration w = the
//         highest level held for w (the max over t of the min over [t, t+w]) of the CFC 60 signal (SAE J211's
//         channel class, the Butterworth forwards and backwards). The curves' points: GEN_OCC.eiband (approximate).
//   FAR 23.562 the emergency-landing dynamic seat tests: longitudinal 26 g (first row) / 21 g (other rows) at 42 ft/s,
//         combined vertical 19 / 15 g at 31 ft/s - what a certified seat is shown to make survivable. A pulse past
//         BOTH its peak and its velocity change is beyond that reference.
//   SPACE no intrusion into the occupant's space (the survivable-volume rule: NTSB / the crash survival design guide,
//         USAAVSCOM TR 89-D-22, "survivable" = tolerable loads AND the occupiable volume kept).
//   RESTRAINT the longitudinal load held 20 ms against the restraint's strength: FAR 23.561's 9 g forward ultimate x
//         23.625's 1.33 fitting factor x a GAME margin of 1.5 for a statically certified seat (18 g); a dynamically
//         tested one 26 g x 1.5 (39 g, GAME). A lap belt alone (no shoulder harness) lowers the longitudinal Eiband
//         curves x 0.6 (GAME: the jack-knife's head strike).
// THE BANDS (the worst criterion wins; HANDOVER G2373-G2377 has the table): GEN_OCC.band.
// ============================================================
const GEN_OCC = {
  on: true,            // the A/B (a gate's): false and the solver makes no record at all
  bands: ['Unharmed', 'Light injuries', 'Heavy injuries', 'Life threatening', 'Fatal injuries'],
  dt: 0.001,           // the record's bin and the criteria's grid (s)
  len: 4.5,            // the buffer (s): the pre-trigger history + the event (the solver's 'over' is <= 4 s after a crash)
  pre: 0.5,            // the pre-trigger history kept (s)
  trigG: 4,            // GAME: the contact g (30_solver gF, filtered 50 ms) that keeps a record - over a firm landing's 2-3 g
  quiet: 1.0,          // s with nothing (no break, the contact under quietG) closes an event that is no crash
  quietG: 2,           // ...'nothing': the contact g under this (an aeroplane at rest on its wheels reads 1)
  post: 0.5,           // a crash closes once over and this quiet (s)...
  crashMax: 3.0,       // ...or this long after its trigger (s): the card waits WATCH_HOLD s after 'over' (app.js G1868)
  chest: 0.45,         // the occupant's point: this share of the bay's height over its floor (GAME)
  side: 0.25,          // ...and a side seat's centre this share of the width from its wall (a centred seat 0.5)
  intrude: 0.05,       // a node of other structure counts inside the bay past this (m; DMG-D1b's probe margin)
  hold: 3,             // the space's worst is held this many frames (an elastic flicker of one frame is not a crush)
  cfc: 60,             // SAE J211 channel class of the criteria's signal
  dri: { wn: 52.9, zeta: 0.224 },
  // Eiband (as recalled; approximate): duration (s) -> g, the voluntary (uninjured) and the moderate-injury limits
  eiband: {
    w: [0.01, 0.02, 0.04, 0.1, 0.2, 0.4, 1.0],
    x: { vol: [40, 35, 32, 25, 22, 18, 15], mod: [60, 55, 50, 45, 40, 32, 25] },
    y: { vol: [20, 18, 15, 11, 10, 9, 8], mod: [32, 29, 25, 20, 18, 15, 12] },
  },
  // FAR 23.562 (as recalled): [first row, other rows] peak g and the velocity change (m/s: 42 and 31 ft/s)
  far562: { x: { g: [26, 21], dv: 12.8 }, z: { g: [19, 15], dv: 9.45 } },
  dvWin: 0.3,          // s: a pulse's velocity change is read within this (the 23.562 pulses last ~0.1-0.2 s)
  restraint: { stat: 9 * 1.33 * 1.5, dyn: 26 * 1.5, w: 0.02, lapK: 0.6 },
  // THE BAND TABLE: each criterion's value -> 0..4 (the worst wins). GAME where the source has no fifth level.
  band: {
    dri: [15.2, 18.0, 22.8, 30],          // < 15.2 Unharmed ... >= 30 Fatal (30: GAME)
    eibMod: [0.8, 1.0, 1.5],              // past the voluntary curve: mod ratio <= 0.8 Light, <= 1 Heavy, <= 1.5 LT, else Fatal (GAME splits)
    space: [0.85, 0.70, 0.50, 0.30],      // clearance kept >= 0.85 Unharmed, >= 0.70 Light, >= 0.50 Heavy, >= 0.30 LT, else Fatal (GAME)
    cell: [1.10, 1.20, 1.35, 1.60],       // the cell's worst edge (x or / its length as built): < 1.10 Unharmed ... >= 1.60 Fatal (GAME)
    far562: 2, restraint: 2, parted: 4,   // floors: past the certified seat's pulse, a restraint failed -> Heavy; the cabin parted at the seat -> Fatal (GAME)
  },
};

// ---- THE SEATS (once, at makeSim with the layer on): null when the frame has no cabin rings or no one aboard ----
function genOccSpec(def) {
  const T = {};
  def.nodes.forEach((nd, i) => { const m = /^S(\d+)([BT])([LR])$/.exec(nd.tag || ''); if (m) T[nd.tag] = i; });
  const rings = []; for (let i = 0; T['S' + i + 'BL'] != null && T['S' + i + 'BR'] != null && T['S' + i + 'TL'] != null && T['S' + i + 'TR'] != null; i++)
    rings.push({ BL: T['S' + i + 'BL'], BR: T['S' + i + 'BR'], TR: T['S' + i + 'TR'], TL: T['S' + i + 'TL'], x: def.nodes[T['S' + i + 'BL']].p[0] });
  if (rings.length < 2) return null;
  const spec = def.spec || {}, cab = spec.cabin || {};
  const seatsX = Array.isArray(cab.seatsX) ? cab.seatsX : null, occ = Array.isArray(cab.occupied) ? cab.occupied : null;
  const aboard = Math.max(1, (cab.pilots | 0) + (cab.pax | 0) || 1);
  const ROWS = { single: [1], tandem2: [1, 2], side2: [1, 1], side4: [1, 1, 2, 2], tandem4: [1, 1, 2, 2], drone: [] };
  const rowsOf = ROWS[cab.seating] || [1, 1], abreast = /^side|^tandem4/.test(cab.seating || '') ? 2 : 1;
  const nS = occ ? occ.length : aboard;
  const xOf = i => {
    if (seatsX && typeof seatsX[i] === 'number' && Number.isFinite(seatsX[i])) return seatsX[i];
    const ri = rowsOf[i] != null ? rowsOf[i] : 1 + Math.floor(i / abreast);
    return rings[Math.min(ri, rings.length - 1)].x;
  };
  const sideOf = i => {
    if (seatsX) { const x = xOf(i);
      if (i % 2 === 1 && Math.abs(xOf(i - 1) - x) < 1e-6) return 1;
      if (i % 2 === 0 && i + 1 < Math.max(nS, seatsX.length) && typeof seatsX[i + 1] === 'number' && Math.abs(seatsX[i + 1] - x) < 1e-6) return -1;
      return 0; }
    return abreast === 2 ? (i % 2 ? 1 : -1) : 0;
  };
  const out = [];
  for (let i = 0; i < nS; i++) {
    if (!(i === 0 || (occ ? occ[i] : i < aboard))) continue;
    const x = xOf(i), side = sideOf(i);
    let b = 0; while (b < rings.length - 2 && x >= rings[b + 1].x) b++;
    const R0 = rings[b], R1 = rings[b + 1];
    const u = Math.max(0, Math.min(1, (x - R0.x) / Math.max(1e-6, R1.x - R0.x)));
    const s = side < 0 ? GEN_OCC.side : side > 0 ? 1 - GEN_OCC.side : 0.5, h = GEN_OCC.chest;
    const wl = side < 0 ? 0.75 : side > 0 ? 0.25 : 0.5;
    // the bay's corners: [BL_i, BR_i, TR_i, TL_i, BL_a, BR_a, TR_a, TL_a] (30_solver's / DMG-D1b's order)
    const n8 = [R0.BL, R0.BR, R0.TR, R0.TL, R1.BL, R1.BR, R1.TR, R1.TL];
    const w8 = new Float64Array(8);   // the chest's trilinear weights
    for (let c = 0; c < 8; c++) w8[c] = (c < 4 ? 1 - u : u) * ((c & 3) === 0 || (c & 3) === 3 ? 1 - s : s) * ((c & 3) >= 2 ? h : 1 - h);
    // the load path: the floor nodes by the frame's own lever-arm split
    const fl = [R0.BL, R0.BR, R1.BL, R1.BR], fw = [(1 - u) * wl, (1 - u) * (1 - wl), u * wl, u * (1 - wl)];
    out.push({ i, x, side, bay: b, n8, w8, fl, fw: Float64Array.from(fw), row: (rowsOf[i] != null ? rowsOf[i] : 1 + Math.floor(i / abreast)) <= 1 ? 0 : 1, name: null });
  }
  if (!out.length) return null;
  // the names, as the game says them (the crew page's 'pilot' / 'co-pilot', the passenger bays)
  const pilot = out.find(o => o.i === 0);
  let nPax = 0; for (const o of out) if (o.i !== 0 && !(pilot && o.side > 0 && Math.abs(o.x - pilot.x) < 1e-6)) nPax++;
  let k = 0;
  for (const o of out) {
    if (o.i === 0) o.name = 'Pilot';
    else if (pilot && o.side > 0 && Math.abs(o.x - pilot.x) < 1e-6) o.name = 'Co-pilot';
    else o.name = nPax > 1 ? 'Passenger ' + (++k) : 'Passenger';
  }
  // the space as built: each seat's chest point, its five walls' clearances, the nodes outside its bay
  const P = def.nodes.length, rest = new Float64Array(P * 3);
  def.nodes.forEach((nd, i) => { rest[i * 3] = nd.p[0]; rest[i * 3 + 1] = nd.p[1]; rest[i * 3 + 2] = nd.p[2]; });
  const pl = new Float64Array(36), pt = [0, 0, 0];
  for (const o of out) {
    genOccPlanes(rest, o.n8, pl);
    { let x = 0, y = 0, z = 0; for (let c = 0; c < 8; c++) { const i = o.n8[c] * 3, w = o.w8[c]; x += w * rest[i]; y += w * rest[i + 1]; z += w * rest[i + 2]; }
      o.hc = Math.max(0.05, genOccDist(pl, 2, x, y, z)); }   // the chest's height over the floor as built (GEN_OCC.chest of the bay's)
    genOccChest(rest, o, pt, pl);
    o.d0 = new Float64Array(6); for (let f = 0; f < 6; f++) o.d0[f] = genOccFace(rest, o.n8, pl, f, pt[0], pt[1], pt[2]);
    o.dMin0 = Math.min(o.d0[0], o.d0[2], o.d0[3], o.d0[4], o.d0[5]);
    o.e0 = Float64Array.from(GEN_OCC_EDGES.map(([a, b]) => Math.hypot(rest[o.n8[a] * 3] - rest[o.n8[b] * 3], rest[o.n8[a] * 3 + 1] - rest[o.n8[b] * 3 + 1], rest[o.n8[a] * 3 + 2] - rest[o.n8[b] * 3 + 2])));
    const inB = new Set(o.n8), foreign = [];
    for (let j = 0; j < P; j++) if (!inB.has(j) && genOccDepth(pl, rest[j * 3], rest[j * 3 + 1], rest[j * 3 + 2]) < -GEN_OCC.intrude) foreign.push(j);
    o.foreign = Int32Array.from(foreign);
  }
  const seatType = (spec.outfit && spec.outfit.seats) || 'sling';
  const restraint = cab.restraint === 'lap' || cab.restraint === 'harness' ? cab.restraint : 'harness';
  return { seats: out, n: P, seatType, dynamic: seatType === 'energy', restraint, restraintDefault: !(cab.restraint === 'lap' || cab.restraint === 'harness') };
}
// a bay's six face planes [c(3), n_in(3)] x 6 (the order: ring i, ring i+1, floor, right, roof, left)
const GEN_OCC_FACES = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
// ...and its twelve edges (the two rings' four, the four longerons)
const GEN_OCC_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
function genOccPlanes(p, B, pl) {
  let cx = 0, cy = 0, cz = 0; for (const i of B) { cx += p[i * 3]; cy += p[i * 3 + 1]; cz += p[i * 3 + 2]; } cx /= 8; cy /= 8; cz /= 8;
  for (let fi = 0; fi < 6; fi++) {
    const F = GEN_OCC_FACES[fi], a = B[F[0]] * 3, b = B[F[1]] * 3, c = B[F[2]] * 3, e = B[F[3]] * 3;
    const fx = (p[a] + p[b] + p[c] + p[e]) / 4, fy = (p[a + 1] + p[b + 1] + p[c + 1] + p[e + 1]) / 4, fz = (p[a + 2] + p[b + 2] + p[c + 2] + p[e + 2]) / 4;
    const d1x = p[c] - p[a], d1y = p[c + 1] - p[a + 1], d1z = p[c + 2] - p[a + 2], d2x = p[e] - p[b], d2y = p[e + 1] - p[b + 1], d2z = p[e + 2] - p[b + 2];
    let nx = d1y * d2z - d1z * d2y, ny = d1z * d2x - d1x * d2z, nz = d1x * d2y - d1y * d2x; const ln = Math.hypot(nx, ny, nz) || 1e-9; nx /= ln; ny /= ln; nz /= ln;
    if ((cx - fx) * nx + (cy - fy) * ny + (cz - fz) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const o = fi * 6; pl[o] = fx; pl[o + 1] = fy; pl[o + 2] = fz; pl[o + 3] = nx; pl[o + 4] = ny; pl[o + 5] = nz;
  }
}
const genOccDist = (pl, f, x, y, z) => { const o = f * 6; return (x - pl[o]) * pl[o + 3] + (y - pl[o + 1]) * pl[o + 4] + (z - pl[o + 2]) * pl[o + 5]; };
function genOccDepth(pl, x, y, z) { let d = Infinity; for (let f = 0; f < 6; f++) { const q = genOccDist(pl, f, x, y, z); if (q < d) d = q; } return d; }
// the chest's clearance to a bay's face AS A QUAD (its two triangles), not its plane: a firewall swung aside by a nose
// torn off has a plane through the cabin and no structure there. 0 once the chest is on the face's outer side
const _occQ = [0, 0, 0];
function genOccTri(px, py, pz, p, a, b, c, q) {
  // Ericson's closest point on a triangle
  const ax = p[a], ay = p[a + 1], az = p[a + 2], abx = p[b] - ax, aby = p[b + 1] - ay, abz = p[b + 2] - az, acx = p[c] - ax, acy = p[c + 1] - ay, acz = p[c + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  const set = (u, v) => { q[0] = ax + u * abx + v * acx; q[1] = ay + u * aby + v * acy; q[2] = az + u * abz + v * acz; };
  if (d1 <= 0 && d2 <= 0) return set(0, 0);
  const bpx = px - p[b], bpy = py - p[b + 1], bpz = pz - p[b + 2], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return set(1, 0);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return set(d1 / (d1 - d3), 0);
  const cpx = px - p[c], cpy = py - p[c + 1], cpz = pz - p[c + 2], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return set(0, 1);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return set(0, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q[0] = p[b] + w * (p[c] - p[b]); q[1] = p[b + 1] + w * (p[c + 1] - p[b + 1]); q[2] = p[b + 2] + w * (p[c + 2] - p[b + 2]); return; }
  const dn = 1 / (va + vb + vc); set(vb * dn, vc * dn);
}
function genOccFace(p, B, pl, f, x, y, z) {
  const F = GEN_OCC_FACES[f], a = B[F[0]] * 3, b = B[F[1]] * 3, c = B[F[2]] * 3, e = B[F[3]] * 3;
  let best = Infinity, bx = 0, by = 0, bz = 0;
  for (const [u, v, w] of [[a, b, c], [a, c, e]]) { genOccTri(x, y, z, p, u, v, w, _occQ); const d = Math.hypot(x - _occQ[0], y - _occQ[1], z - _occQ[2]); if (d < best) { best = d; bx = _occQ[0]; by = _occQ[1]; bz = _occQ[2]; } }
  const o = f * 6;
  return (x - bx) * pl[o + 3] + (y - by) * pl[o + 4] + (z - bz) * pl[o + 5] < -1e-9 ? 0 : best;
}
// the chest: the seat on the floor (the floor nodes by the load path's own weights) and the chest's height as built
// along the floor's normal - the occupant sits on the seat, so a cabin sheared into a parallelogram moves its walls and
// roof round the occupant, not the occupant with the roof. pl: the bay's planes this frame (face 2 the floor, inward up)
function genOccChest(p, o, out, pl) {
  let x = 0, y = 0, z = 0;
  for (let q = 0; q < 4; q++) { const i = o.fl[q] * 3, w = o.fw[q]; x += w * p[i]; y += w * p[i + 1]; z += w * p[i + 2]; }
  const hc = o.hc || 0;
  out[0] = x + hc * pl[15]; out[1] = y + hc * pl[16]; out[2] = z + hc * pl[17]; return out;
}

// ---- THE RECORDER'S STATE (allocated on the first armed frame: an aeroplane that never meets anything holds none) ----
function genOccState() { return { buf: null, tS: null, cap: 0, head: 0, count: 0, st: 0, rec: false, binT: 0, binN: 0, acc: null, t: 0,
  trigT: 0, actT: 0, brk: 0, sp: null, spH: null, spAt: null, res: null, ver: 0, events: 0 }; }
function genOccReset(S) { S.head = 0; S.count = 0; S.st = 0; S.rec = false; S.binT = 0; S.binN = 0; S.t = 0; S.brk = 0; S.res = null; S.ver = 0; S.events = 0; if (S.acc) S.acc.fill(0); }
function genOccAlloc(O, S) {
  const nS = O.seats.length;
  S.cap = Math.ceil(GEN_OCC.len / GEN_OCC.dt) + 8;
  S.buf = new Float32Array(S.cap * nS * 9); S.tS = new Float64Array(S.cap); S.acc = new Float64Array(nS * 3);
  S.sp = new Float64Array(nS); S.spH = new Float64Array(nS * GEN_OCC.hold); S.spAt = new Array(nS);
  S.ce = new Float64Array(nS); S.ceH = new Float64Array(nS * GEN_OCC.hold); S.ceAt = new Array(nS);
}
// the frame's start (after 30_solver armFrame): record this frame's substeps? An armed frame or a kept event; a gap in
// the armed run drops the pre-trigger history (it would join two moments that are not one)
function genOccArm(O, S, armed) {
  const rec = (armed && S.st !== 3) || S.st === 2;   // (3: a crash closed - its result stands until the reset)
  if (rec && !S.buf) genOccAlloc(O, S);
  if (!rec && S.st === 1) { S.st = 0; S.count = 0; S.binT = 0; S.binN = 0; S.acc.fill(0); }
  if (rec && S.st === 0) S.st = 1;
  S.rec = rec;
  return rec;
}
// one substep's velocities into the bin; a full bin (>= dt) is a sample: the bin's mean velocity, the bay's axes
function genOccSub(O, S, p, v, dt, simT) {
  const SE = O.seats, nS = SE.length, A = S.acc;
  for (let k = 0; k < nS; k++) { const o = SE[k]; let x = 0, y = 0, z = 0;
    for (let q = 0; q < 4; q++) { const i = o.fl[q] * 3, w = o.fw[q]; x += w * v[i]; y += w * v[i + 1]; z += w * v[i + 2]; }
    A[k * 3] += x; A[k * 3 + 1] += y; A[k * 3 + 2] += z; }
  S.binT += dt; S.binN++;
  if (S.binT < GEN_OCC.dt - 1e-9) return;
  const h = S.head, B = S.buf, inv = 1 / S.binN;
  S.tS[h] = simT - 0.5 * S.binT;
  for (let k = 0; k < nS; k++) {
    const o = SE[k], N = o.n8, b = (h * nS + k) * 9;
    B[b] = A[k * 3] * inv; B[b + 1] = A[k * 3 + 1] * inv; B[b + 2] = A[k * 3 + 2] * inv;
    // forward (ring i+1 -> ring i: toward the nose), up (floor -> roof)
    let fx = 0, fy = 0, fz = 0, ux = 0, uy = 0, uz = 0;
    for (let c = 0; c < 4; c++) { const i0 = N[c] * 3, i1 = N[c + 4] * 3; fx += p[i0] - p[i1]; fy += p[i0 + 1] - p[i1 + 1]; fz += p[i0 + 2] - p[i1 + 2]; }
    for (let c = 0; c < 8; c++) { const i = N[c] * 3, sg = (c & 3) >= 2 ? 1 : -1; ux += sg * p[i]; uy += sg * p[i + 1]; uz += sg * p[i + 2]; }
    B[b + 3] = fx; B[b + 4] = fy; B[b + 5] = fz; B[b + 6] = ux; B[b + 7] = uy; B[b + 8] = uz;
  }
  A.fill(0); S.binT = 0; S.binN = 0;
  S.head = (h + 1) % S.cap;
  if (S.count < S.cap) S.count++;
}
// the frame's end (after 30_solver dmgFrame): the trigger, the space, the close. D the damage record, gF the contact g,
// fd() the solver's pieces (asked only at a close). Returns true when a result was (re)made
function genOccFrame(O, S, D, gF, simT, p, fd) {
  if (!S.rec) return false;
  const nS = O.seats.length, newBrk = D.breaks > S.brk; S.brk = D.breaks;
  const hot = newBrk || gF > GEN_OCC.trigG;
  if (S.st === 1 && (hot || D.crashed)) {
    S.st = 2; S.trigT = simT; S.actT = simT; S.events++;
    // the pre-trigger history: the last GEN_OCC.pre s of the armed run
    S.count = Math.min(S.count, Math.ceil(GEN_OCC.pre / GEN_OCC.dt));
    S.sp.fill(Infinity); S.spH.fill(Infinity); S.ce.fill(0); S.ceH.fill(0); for (let k = 0; k < nS; k++) { S.spAt[k] = null; S.ceAt[k] = null; }
  }
  if (S.st !== 2) return false;
  if (newBrk || gF > GEN_OCC.quietG) S.actT = simT;
  genOccSpace(O, S, p, simT);
  const full = S.count >= S.cap - 2;
  // the close: a crash once its wreck is over AND quiet (a break-up is 'over' at its first parting - the pulse runs on),
  // or GEN_OCC.crashMax s after the trigger; an event that is no crash after GEN_OCC.quiet s of nothing; a full buffer
  const crashEnd = D.crashed && D.over && (simT - S.actT > GEN_OCC.post || simT - S.trigT > GEN_OCC.crashMax);
  if (!(crashEnd || full || (!D.crashed && simT - S.actT > GEN_OCC.quiet))) return false;
  // the close: the criteria on the record, the cabin parted at a seat, the bands; merged with an earlier event's (the worst)
  const R = genOccClose(O, S, fd);
  S.res = S.res ? genOccMerge(S.res, R) : R; S.ver++;
  S.st = D.crashed ? 3 : 0; S.count = 0; S.binT = 0; S.binN = 0; S.acc.fill(0); S.rec = false;
  return true;
}
// the space this frame: each seat's chest riding its bay, its clearance to the walls and to an intruding node, over its
// clearance as built (the worst wall); held GEN_OCC.hold frames (the frame's worst must last that long to count)
const _occPl = new Float64Array(36), _occPt = [0, 0, 0];
// one seat's space now: the worst ratio, and what set it (a face 0 ahead / 2 floor / 3 right / 4 roof / 5 left, or -1 - the
// intruding node); `all` (a gate's reader) gets every face's ratio and the nearest intruder's
function genOccSpaceOf(o, p, all) {
  genOccPlanes(p, o.n8, _occPl); genOccChest(p, o, _occPt, _occPl);
  const x = _occPt[0], y = _occPt[1], z = _occPt[2];
  let r = Infinity, why = null;
  for (const f of [0, 2, 3, 4, 5]) { const q = genOccFace(p, o.n8, _occPl, f, x, y, z) / o.d0[f]; if (all) all['f' + f] = q; if (q < r) { r = q; why = f; } }
  for (let j = 0; j < o.foreign.length; j++) {
    const i = o.foreign[j], px = p[i * 3], py = p[i * 3 + 1], pz = p[i * 3 + 2];
    if (genOccDepth(_occPl, px, py, pz) <= GEN_OCC.intrude) continue;
    const q = Math.hypot(px - x, py - y, pz - z) / o.dMin0; if (all && !(all.intr <= q)) { all.intr = q; all.node = i; } if (q < r) { r = q; why = -1 - i; }
  }
  // THE CELL: its worst edge against its length as built (|ln L/L0|: crushed or torn open alike) - a cabin torn apart round
  // the seat keeps no space, whatever the clearance reads
  let e = 0, eW = -1;
  for (let q = 0; q < 12; q++) { const [a, b] = GEN_OCC_EDGES[q], A = o.n8[a] * 3, B = o.n8[b] * 3;
    const L = Math.hypot(p[A] - p[B], p[A + 1] - p[B + 1], p[A + 2] - p[B + 2]), d = Math.abs(Math.log(Math.max(1e-6, L) / o.e0[q])); if (d > e) { e = d; eW = q; } }
  if (all) { all.cell = Math.exp(e); all.edge = eW; }
  return { r, why, e, eW };
}
function genOccSpace(O, S, p, simT) {
  const SE = O.seats, H = GEN_OCC.hold;
  for (let k = 0; k < SE.length; k++) {
    const { r, why, e, eW } = genOccSpaceOf(SE[k], p, null);
    // the hold: this frame's ratio into the last H; the space counts the best of those H (a lasting loss); the cell's
    // distortion the least of its last H
    const hb = k * H; for (let q = H - 1; q > 0; q--) { S.spH[hb + q] = S.spH[hb + q - 1]; S.ceH[hb + q] = S.ceH[hb + q - 1]; } S.spH[hb] = r; S.ceH[hb] = e;
    let held = -Infinity, heldE = Infinity; for (let q = 0; q < H; q++) { if (S.spH[hb + q] > held) held = S.spH[hb + q]; if (S.ceH[hb + q] < heldE) heldE = S.ceH[hb + q]; }
    if (held < S.sp[k]) { S.sp[k] = held; S.spAt[k] = { t: simT, by: why }; }
    if (heldE > S.ce[k]) { S.ce[k] = heldE; S.ceAt[k] = { t: simT, edge: eW }; }
  }
}
// the record unrolled onto a uniform grid (GEN_OCC.dt): per seat the specific force (g) in its frame - x forward, y
// lateral, z up (spinal) - and the velocity change along x and z (m/s, the kinematic part)
function genOccSeries(O, S, k) {
  const nS = O.seats.length, n = S.count, cap = S.cap, i0 = (S.head - n + cap) % cap;
  if (n < 4) return null;
  const T0 = S.tS[i0], T1 = S.tS[(S.head - 1 + cap) % cap], dt = GEN_OCC.dt, N = Math.max(4, Math.floor((T1 - T0) / dt) + 1);
  const at = j => (i0 + j) % cap;
  // velocities and axes resampled (linear in time; the axes from the nearer sample)
  const V = new Float64Array(N * 3), FW = new Float64Array(N * 3), UP = new Float64Array(N * 3);
  let j = 0;
  for (let g = 0; g < N; g++) {
    const t = T0 + g * dt;
    while (j < n - 2 && S.tS[at(j + 1)] < t) j++;
    const ta = S.tS[at(j)], tb = S.tS[at(j + 1)], a = Math.max(0, Math.min(1, (t - ta) / Math.max(1e-9, tb - ta)));
    const ba = (at(j) * nS + k) * 9, bb = (at(j + 1) * nS + k) * 9, bn = a < 0.5 ? ba : bb, B = S.buf;
    for (let c = 0; c < 3; c++) { V[g * 3 + c] = B[ba + c] + a * (B[bb + c] - B[ba + c]); FW[g * 3 + c] = B[bn + 3 + c]; UP[g * 3 + c] = B[bn + 6 + c]; }
  }
  const ax = new Float64Array(N), ay = new Float64Array(N), az = new Float64Array(N), kx = new Float64Array(N), kz = new Float64Array(N);
  for (let g = 0; g < N; g++) {
    const gm = Math.max(0, g - 1), gp = Math.min(N - 1, g + 1), h = (gp - gm) * dt;
    const a0 = (V[gp * 3] - V[gm * 3]) / h, a1 = (V[gp * 3 + 1] - V[gm * 3 + 1]) / h, a2 = (V[gp * 3 + 2] - V[gm * 3 + 2]) / h;
    // the frame: forward f, up u orthogonalised to it, lateral l = f x u
    let fx = FW[g * 3], fy = FW[g * 3 + 1], fz = FW[g * 3 + 2]; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let ux = UP[g * 3], uy = UP[g * 3 + 1], uz = UP[g * 3 + 2]; const fu = ux * fx + uy * fy + uz * fz; ux -= fu * fx; uy -= fu * fy; uz -= fu * fz;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const lx = fy * uz - fz * uy, ly = fz * ux - fx * uz, lz = fx * uy - fy * ux;
    const s0 = a0, s1 = a1 + 9.81, s2 = a2;   // the specific force (the accelerometer's: gravity's reaction included)
    ax[g] = (s0 * fx + s1 * fy + s2 * fz) / 9.81; ay[g] = (s0 * lx + s1 * ly + s2 * lz) / 9.81; az[g] = (s0 * ux + s1 * uy + s2 * uz) / 9.81;
    kx[g] = a0 * fx + a1 * fy + a2 * fz; kz[g] = a0 * ux + a1 * uy + a2 * uz;   // the kinematic part (m/s^2)
  }
  return { N, dt, ax, ay, az, kx, kz, t0: T0 };
}
// SAE J211 CFC filter (a 2-pole Butterworth run forwards then backwards), in place
function genOccCFC(x, dt, cfc) {
  const wd = 2 * Math.PI * cfc * 2.0775, wa = Math.sin(wd * dt / 2) / Math.cos(wd * dt / 2), r2 = Math.SQRT2, den = 1 + r2 * wa + wa * wa;
  const a0 = wa * wa / den, a1 = 2 * a0, a2 = a0, b1 = -2 * (wa * wa - 1) / den, b2 = (-1 + r2 * wa - wa * wa) / den;
  const run = (fwd) => {
    const N = x.length; let x1 = x[fwd ? 0 : N - 1], x2 = x1, y1 = x1, y2 = x1;
    for (let q = 0; q < N; q++) { const i = fwd ? q : N - 1 - q, x0 = x[i], y0 = a0 * x0 + a1 * x1 + a2 * x2 + b1 * y1 + b2 * y2; x2 = x1; x1 = x0; y2 = y1; y1 = y0; x[i] = y0; }
  };
  run(true); run(false); return x;
}
// the DRI: the spinal signal (g) through the spring-mass; its largest compression x wn^2 / g (RK4 on the grid)
function genOccDRI(az, dt) {
  const wn = GEN_OCC.dri.wn, ze = GEN_OCC.dri.zeta, g = 9.81, N = az.length;
  let d = 0, dv = 0, dMax = 0, tMax = 0;
  const acc = (A, x, xv) => A - 2 * ze * wn * xv - wn * wn * x;
  for (let i = 0; i < N - 1; i++) {
    const A0 = az[i] * g, A1 = az[i + 1] * g, Am = 0.5 * (A0 + A1);
    const k1x = dv, k1v = acc(A0, d, dv);
    const k2x = dv + 0.5 * dt * k1v, k2v = acc(Am, d + 0.5 * dt * k1x, k2x);
    const k3x = dv + 0.5 * dt * k2v, k3v = acc(Am, d + 0.5 * dt * k2x, k3x);
    const k4x = dv + dt * k3v, k4v = acc(A1, d + dt * k3x, k4x);
    d += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x); dv += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
    if (d > dMax) { dMax = d; tMax = (i + 1) * dt; }
  }
  return { dri: wn * wn * dMax / g, t: tMax };
}
// the plateau held for each Eiband duration (both signs), over the curves: the ratios to the voluntary and the
// moderate-injury limits, their worst duration
function genOccEiband(a, dt, curve, k) {
  const W = GEN_OCC.eiband.w, N = a.length, kk = k || 1;
  let vol = 0, mod = 0, wV = null, wM = null, pl = [];
  const q = new Int32Array(N);
  for (let wi = 0; wi < W.length; wi++) {
    const n = Math.max(1, Math.round(W[wi] / dt));
    let best = 0;
    if (n <= N) for (const sg of [1, -1]) {
      // the sliding window's minimum of sg * a (a monotone deque), its largest value over the record
      let h = 0, tl = 0;
      for (let i = 0; i < N; i++) {
        const v = sg * a[i];
        while (tl > h && sg * a[q[tl - 1]] >= v) tl--;
        q[tl++] = i;
        if (q[h] <= i - n) h++;
        if (i >= n - 1) { const m = sg * a[q[h]]; if (m > best) best = m; }
      }
    }
    pl.push(best);
    const rV = best / (kk * curve.vol[wi]), rM = best / (kk * curve.mod[wi]);
    if (rV > vol) { vol = rV; wV = W[wi]; } if (rM > mod) { mod = rM; wM = W[wi]; }
  }
  return { vol, mod, wV, wM, plateau: pl };
}
const genOccBandOf = (v, th) => { let b = 0; while (b < th.length && v >= th[b]) b++; return b; };
// THE CRITERIA AND THE BAND of one seat's series (pure: GATE DMGOCCUPANT's selftest feeds it synthetic pulses).
// sr = genOccSeries(...) shape; o = { row (0 the first row), dynamic, restraint, space, parted }
function genOccJudge(sr, o) {
  const B = GEN_OCC.band, dt = sr.dt, C = GEN_OCC.cfc;
  const ax = genOccCFC(Float64Array.from(sr.ax), dt, C), ay = genOccCFC(Float64Array.from(sr.ay), dt, C), az = genOccCFC(Float64Array.from(sr.az), dt, C);
  const pk = a => { let m = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i]) > m) m = Math.abs(a[i]); return m; };
  // the velocity change of a pulse: the largest change of the axis' running integral within GEN_OCC.dvWin s (a seat axis
  // turning for seconds - a floatplane pitching over - would add up a velocity no pulse carried)
  const dvOf = kin => { const N = kin.length, W = Math.max(1, Math.round(GEN_OCC.dvWin / dt)), S = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) S[i + 1] = S[i] + kin[i] * dt;
    // (the window's least and largest integral by two monotone deques: O(N))
    const qa = new Int32Array(N + 1), qb = new Int32Array(N + 1); let ha = 0, ta = 0, hb = 0, tb = 0, best = 0;
    for (let j = 1; j <= N; j++) {
      const i = j - 1;
      while (ta > ha && S[qa[ta - 1]] >= S[i]) ta--; qa[ta++] = i;
      while (tb > hb && S[qb[tb - 1]] <= S[i]) tb--; qb[tb++] = i;
      while (qa[ha] < j - W) ha++; while (qb[hb] < j - W) hb++;
      const d = Math.max(S[j] - S[qa[ha]], S[qb[hb]] - S[j]); if (d > best) best = d;
    }
    return best; };
  const dri = genOccDRI(az, dt);
  const lap = o.restraint === 'lap';
  const eibX = genOccEiband(ax, dt, GEN_OCC.eiband.x, lap ? GEN_OCC.restraint.lapK : 1), eibY = genOccEiband(ay, dt, GEN_OCC.eiband.y, 1);
  const xPk = pk(ax), yPk = pk(ay), zPk = pk(az), dvX = dvOf(sr.kx), dvZ = dvOf(sr.kz);
  const F = GEN_OCC.far562, row = o.row ? 1 : 0;
  const far562 = (xPk > F.x.g[row] && dvX > F.x.dv) || (zPk > F.z.g[row] && dvZ > F.z.dv);
  // the restraint: the longitudinal load held 20 ms (either way: a harness and its anchorage)
  const wi = GEN_OCC.eiband.w.indexOf(GEN_OCC.restraint.w), rLoad = wi >= 0 ? eibX.plateau[wi] : 0;
  const rStr = o.dynamic ? GEN_OCC.restraint.dyn : GEN_OCC.restraint.stat, rFail = rLoad > rStr;
  const eibBand = e => e.vol <= 1 ? 0 : 1 + genOccBandOf(e.mod, B.eibMod);
  const rows = {
    dri: genOccBandOf(dri.dri, B.dri),
    eibandX: eibBand(eibX), eibandY: eibBand(eibY),
    far562: far562 ? B.far562 : 0,
    restraint: rFail ? B.restraint : 0,
    space: o.space == null ? 0 : genOccBandOf(-o.space, B.space.map(x => -x)),
    cell: o.cell == null ? 0 : genOccBandOf(o.cell, B.cell),
    parted: o.parted ? B.parted : 0,
  };
  let band = 0, by = null; for (const k of Object.keys(rows)) if (rows[k] > band) { band = rows[k]; by = k; }
  return { band, by, rows, dri: dri.dri, xPk, yPk, zPk, dvX, dvZ, eibX: { vol: eibX.vol, mod: eibX.mod, wV: eibX.wV, wM: eibX.wM },
    eibY: { vol: eibY.vol, mod: eibY.mod, wV: eibY.wV, wM: eibY.wM }, far562, restraint: { load: rLoad, strength: rStr, failed: rFail }, space: o.space, cell: o.cell, parted: !!o.parted };
}
// a record too short to judge (an event closed at once): a still second, so the space rows still speak
const genOccQuiet = () => { const N = 16, z = new Float64Array(N), one = new Float64Array(N).fill(1); return { N, dt: GEN_OCC.dt, ax: z, ay: z, az: one, kx: z, kz: z, t0: 0 }; };
// the close: every seat judged; the result the hop sends is { name, band } per seat - the criteria stay in `crit`
function genOccClose(O, S, fd) {
  const find = fd ? fd() : null;   // (the solver's pieces(): the union-find over the live members and clusters, its find)
  const seats = O.seats.map((o, k) => {
    let parted = false;
    if (find) { const r0 = find(o.n8[0]); for (let c = 1; c < 8; c++) if (find(o.n8[c]) !== r0) { parted = true; break; } }
    const sr = genOccSeries(O, S, k), sp = Number.isFinite(S.sp[k]) ? S.sp[k] : null, ce = Math.exp(S.ce[k]);
    const J = genOccJudge(sr || genOccQuiet(), { row: o.row, dynamic: O.dynamic, restraint: O.restraint, space: sp, cell: ce, parted });
    J.spaceAt = S.spAt[k]; J.cellAt = S.ceAt[k]; J.samples = sr ? sr.N : 0;
    return { name: o.name, seat: o.i, band: J.band, crit: J };
  });
  return { seats, restraint: O.restraint, restraintDefault: O.restraintDefault, seatType: O.seatType, events: S.events };
}
function genOccMerge(A, B) {
  return Object.assign({}, B, { events: B.events, seats: B.seats.map((s, k) => (A.seats[k] && A.seats[k].band > s.band ? A.seats[k] : s)) });
}
// what crosses to the page (sim_host meta.occ, once a close): the seat's name and its band's index - nothing else
const genOccWire = R => (R ? R.seats.map(s => ({ name: s.name, band: s.band })) : null);
