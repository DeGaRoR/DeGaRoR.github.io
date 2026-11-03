// PILLAR SITE (PILLAR-ANCHORS, 2026-11-02) — THE PILLARS ARE ANCHOR SITES, THE DOORS ARE KEEP-OUTS.
//
// The user, 2 Nov: "being able to snap the strut into the cabin pillar, and also to constrain the handles to go
// there ... Floats struts should also preferably go onto these pillars, and not try to go on the door areas, when
// possible. Pillars should really be the target for all fixation devices and anchors. We know perfectly where they
// are."
//
// WHAT WAS THERE. The pillars were cage ROWS (pillarW, cabPillarW, paxPillarW) and ring bands (pilCabA/B, pilPaxA/B,
// pilPaxM<i>) and nothing else: no layer could ask "where is the post between the doors". The doors were a zone of
// faces with their four edge runs (CAGE2.cageDoorEdges, G310) and nothing opened. So every anchor was placed blind to
// both: the wing strut's foot an offset from the frame's strut node, the float struts' roots at the float's own deck
// stations, the handle at the door's aft edge by arc length.
//
// WHAT THIS FILE IS: ONE SOURCE, read by every layer (the wing's strut feet, the float truss, the fittings' handle,
// the door-swing check in the join). Pure: the built sheet, the resolved cage (its rings) and the plane scale in,
// plain arrays out, metres in the cage frame (+x port, +y up, +z forward) - the frame every drawing layer draws in.
//
//   pillarsOf(mesh, R, FS)  -> { pillars, doors, zFw }   (memoised on the mesh; zFw the firewall's station, the join's)
//     pillars[]  { key 'A' | 'B' | 'C' | 'M<i>', label, z0, z1, zc (metres), rings [aft, fwd], frame ('B' | 'C' |
//                'F' (the A post when the firewall's ring stands on it) | null: the PHYSICS ring this pillar carries,
//                see THE FRAME below), zNode (that ring's station), yLo, yHi } - one record for both flanks
//     doors[]    { key 'pilot:P', doorKey, sgn (+1 port), z0, z1, yLo, yHi, fwd, aft, top, bot (metre runs), n,
//                  tris (the door's own skin, metres) }
//   onPillar(PS, z, opt)   -> the pillar a station is on (or the nearest within `reach`), or null
//   inDoor(PS, p, pad)     -> the door whose PANEL or 0-90 deg SWING holds point p (pad metres), or null
//   swingSweep(door, axis, obstacles, opt) -> { minMM, deg, who } the door turned 0..90 deg about its hinge
//
// THE FRAME (why B and C are the honest anchors). 61_gen_frame's fuselage rings are the firewall (0), the cabin
// front (1), the cabin rear (2 + nCabSub) and the tail stations; the join measures the cabin's x-extent OFF THE
// PILLARS: noseGap = firewall -> pilCabB, cabin.len = pilCabB -> pilPaxA (_cage_join.js G52). So ring 1's four
// corner nodes stand exactly on the B-pillar's forward ring and the cabin's rear ring on the C-pillar's aft ring:
// the lift strut's root (F[1] on every cabin the frame clamps to the box), the float truss's forward and aft fittings
// (F[iFwd], F[iAft]) are ALREADY pillar nodes in the physics. What was off was the DRAWING (measured on _4b: the wing
// strut's foot 0.15 m ahead of its node, on the pilot door's bottom; the float strut roots 0.4 m and 0.2 m from theirs,
// one of them on the pilot door's skin). A foot drawn on the pillar rides the node it loads (app.js nearNode): WYSIWYG.
// A mid pillar (M<i>) and the windscreen post (A) have no frame ring: they are sites for hardware (a handle's latch,
// a step, a strap), not for a primary load, and `frame` says so.
'use strict';
(function () {

const MEMO = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
let CG2_NODE = null;
const CG2 = () => (typeof window !== 'undefined' && window.CAGE2) || (typeof CAGE2 !== 'undefined' ? CAGE2 : null) ||
  CG2_NODE || (typeof require === 'function' ? (CG2_NODE = require('./_cage_gen.js')) : null);

// ---- vectors ------------------------------------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- the pillars, off the resolved rings ------------------------------------------------------------------------
// A pillar is a band between two rings that the cage draws in a pillar material (CAGE_PILLAR: pillarPassenger,
// pillarCabin), or the windscreen post ahead of the forward-most door. The ring a band STARTS on (its aft ring) and
// the one it ends on are kept, so a caller can name the frame ring the band carries.
function ringZ(rg) {
  if (!rg) return null;
  if (typeof rg.z === 'number' && isFinite(rg.z)) return rg.z;
  const l = rg.lv && (rg.lv.waist || rg.lv.keel || rg.lv.floor);
  return l && isFinite(l.z) ? l.z : null;
}
function ringYs(rg) {
  let lo = Infinity, hi = -Infinity;
  for (const k in (rg && rg.lv) || {}) { const l = rg.lv[k]; if (l && isFinite(l.y)) { lo = Math.min(lo, l.y); hi = Math.max(hi, l.y); } }
  return isFinite(lo) ? [lo, hi] : null;
}
function bandsOf(R) {
  const by = {};
  for (const rg of (R && R.rings) || []) by[rg.name] = rg;
  const out = [];
  const band = (key, label, a, b, frame) => {
    const za = ringZ(by[a]), zb = ringZ(by[b]);
    if (za == null || zb == null || !(Math.abs(zb - za) > 1e-4)) return;
    const ya = ringYs(by[a]) || [0, 0], yb = ringYs(by[b]) || ya;
    out.push({ key, label, z0: Math.min(za, zb), z1: Math.max(za, zb), rings: [a, b], frame,
               yLo: Math.min(ya[0], yb[0]), yHi: Math.max(ya[1], yb[1]) });
  };
  // the C pillar: the aft post of the aftmost passenger door (pilPaxA, the cabin's rear frame, -> pilPaxB)
  band('C', 'aft (C) pillar', 'pilPaxA', 'pilPaxB', 'C');
  // the mid pillars between passenger bays (pilPaxM<i> -> pilPaxB<i+1>)
  for (let i = 0; i < 8; i++) if (by['pilPaxM' + i]) band('M' + i, 'mid pillar ' + (i + 1), 'pilPaxM' + i, 'pilPaxB' + (i + 1), null);
  // the B pillar: between the pilot's door and the first passenger door (pilCabA -> pilCabB, the cabin's front frame)
  band('B', 'centre (B) pillar', 'pilCabA', 'pilCabB', 'B');
  // a canopy-less aero nose draws its own windscreen post as a pillar band (aeroWsA -> aeroWsB)
  band('W', 'windscreen pillar', 'aeroWsA', 'aeroWsB', null);
  return { out, by };
}

// ---- the doors, off the sheet ------------------------------------------------------------------------------------
const DOOR_SKIP = new Set(['joint', 'doorSeal', 'paneEdge']);
function doorsOf(mesh, FS) {
  const C2 = CG2();
  const recs = (C2 && C2.cageDoorEdges) ? C2.cageDoorEdges(mesh) : [];
  const V = mesh.V, out = [];
  const m3 = p => [p[0] * FS, p[1] * FS, p[2] * FS];
  const run = r => r ? { A: m3(r.A), B: m3(r.B), pts: (r.pts || [r.A, r.B]).map(m3) } : null;
  for (const rec of recs) {
    const sgn = rec.sgn;
    // THE DOOR'S OWN SKIN: every face of the door zone on this flank, glass and recess included (what swings), the
    // shoulder's trim and the inner panel left out (inside the cabin, they swing into nothing a layer draws)
    const tris = [];
    let z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const f of mesh.F) {
      if (f.doorKey !== rec.doorKey || DOOR_SKIP.has(f.m) || f.shoulder || f.doorPanel || !f.v || f.v.length < 3) continue;
      if ((V[f.v[0]][0] >= 0 ? 1 : -1) !== sgn) continue;
      const P = f.v.map(i => m3(V[i]));
      for (const p of P) { z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (let t = 1; t + 1 < P.length; t++) tris.push([P[0], P[t], P[t + 1]]);
    }
    if (!tris.length) continue;
    out.push({ key: rec.key, doorKey: rec.doorKey, sgn, n: rec.n.slice(), z0, z1, yLo: y0, yHi: y1,
               fwd: run(rec.fwd), aft: run(rec.aft), top: run(rec.top), bot: run(rec.bot),
               winLo: rec.winLo != null ? rec.winLo * FS : null, w: rec.w * FS, h: rec.h * FS, tris });
  }
  return out;
}

// ---- the record --------------------------------------------------------------------------------------------------
function pillarsOf(mesh, R, FS) {
  FS = FS || 1;
  if (MEMO && mesh && MEMO.has(mesh)) { const m = MEMO.get(mesh); if (m.FS === FS && m.R === R) return m.v; }
  const { out: bands } = bandsOf(R);
  const doors = mesh ? doorsOf(mesh, FS) : [];
  const pillars = [];
  for (const b of bands) {
    // a band a door spans is not a pillar (an open bay, a door over two bays): the skin there swings
    const z0 = b.z0 * FS, z1 = b.z1 * FS, zc = 0.5 * (z0 + z1);
    if (doors.some(d => zc > d.z0 + 0.01 && zc < d.z1 - 0.01)) continue;
    // zNode: the station of the frame ring the band carries - B's forward ring (pilCabB: noseGap's end), C's aft
    // ring (pilPaxA: the cabin's rear frame)
    const zNode = b.frame === 'B' ? Math.max(z0, z1) : b.frame === 'C' ? Math.min(z0, z1) : null;
    pillars.push({ key: b.key, label: b.label, z0, z1, zc, zNode, rings: b.rings, frame: b.frame,
                   yLo: b.yLo * FS, yHi: b.yHi * FS });
  }
  // THE FIREWALL'S STATION, by the join's own rule (CAGE2.cageFirewallZ over cageNamedZ: G3050's one home) - the
  // frame's ring 0, and the line no anchor moves forward of
  let zFw = null;
  const C2 = CG2();
  try { if (C2 && C2.cageFirewallZ && C2.cageNamedZ) zFw = C2.cageFirewallZ(C2.cageNamedZ(R, FS)); } catch (e) { zFw = null; }
  // THE WINDSCREEN POST (A): ahead of the forward-most door, to the firewall's station when it stands within 0.15 m
  // (then the post CARRIES the frame's ring 0: the firewall's bottom corner is the post's foot - where a frame whose
  // wing sits near the firewall roots its lift strut, the C172-alike's), else to the next ring forward (<= 0.12 m)
  {
    const fwdDoor = doors.slice().sort((a, b) => b.z1 - a.z1)[0];
    if (fwdDoor && !pillars.some(p => p.key === 'W')) {
      let zA1, frame = null;
      if (zFw != null && zFw > fwdDoor.z1 + 0.01 && zFw < fwdDoor.z1 + 0.15) { zA1 = zFw; frame = 'F'; }
      else {
        const zs = ((R && R.rings) || []).map(ringZ).filter(z => z != null).map(z => z * FS)
          .filter(z => z > fwdDoor.z1 + 0.005).sort((a, b) => a - b);
        zA1 = Math.min(zs.length ? zs[0] : fwdDoor.z1 + 0.08, fwdDoor.z1 + 0.12);
      }
      if (zA1 > fwdDoor.z1 + 0.01)
        pillars.push({ key: 'A', label: 'windscreen (A) post', z0: fwdDoor.z1, z1: zA1, zc: 0.5 * (fwdDoor.z1 + zA1),
                       zNode: frame ? zA1 : null, rings: [null, null], frame, yLo: fwdDoor.yLo, yHi: fwdDoor.yHi });
    }
  }
  pillars.sort((a, b) => a.zc - b.zc);
  const v = { pillars, doors, FS, zFw };
  if (MEMO && mesh) MEMO.set(mesh, { FS, R, v });
  return v;
}

// the pillar a station stands on, or the nearest one within `reach` (metres); `frame` true: only a pillar with a
// physics ring (a primary load's)
function onPillar(PS, z, opt) {
  opt = opt || {};
  let best = null, bd = Infinity;
  for (const p of (PS && PS.pillars) || []) {
    if (opt.frame && !p.frame) continue;
    if (opt.key && p.key !== opt.key) continue;
    const d = z < p.z0 ? p.z0 - z : z > p.z1 ? z - p.z1 : 0;
    if (d < bd) { bd = d; best = p; }
  }
  const reach = opt.reach != null ? opt.reach : Infinity;
  return best && bd <= reach ? Object.assign({ d: bd }, best) : null;
}
// the pillar whose frame ring is `frame` ('B' / 'C')
const pillarOfFrame = (PS, frame) => ((PS && PS.pillars) || []).find(p => p.frame === frame) || null;

// THE FRAME'S CABIN RINGS AS CAGE STATIONS (metres, z forward), forward to aft: the firewall (zFw, the join's datum,
// when known), the B pillar's ring, a long cabin's evenly spaced sub-frames (61_gen_frame G3504: GEN_RULES.cabBayMax),
// the C pillar's ring, and - `cargoLen` metres aft of the C ring, when the build has a cargo bay - the box's end. Each { z, pillar (the record, or null for a ring no pillar stands on), tag }. The frame picks its anchors off
// exactly these rings (the strut root's nearestRing, the float truss's iFwd / iAft), so a caller that applies the
// frame's own rule to this list lands on the very ring the physics loads.
function frameStations(PS, o) {
  o = o || {};
  const B = pillarOfFrame(PS, 'B'), C = pillarOfFrame(PS, 'C');
  const out = [];
  if (o.zFw != null && isFinite(o.zFw)) out.push({ z: o.zFw, pillar: pillarOfFrame(PS, 'F'), tag: 'firewall' });
  if (B) out.push({ z: B.zNode, pillar: B, tag: 'B' });
  if (B && C) {
    const L = B.zNode - C.zNode;
    const RU = (typeof GEN_RULES !== 'undefined' && GEN_RULES) || (typeof window !== 'undefined' && window.GEN_RULES) || {};
    const bay = RU.cabBayMax;
    if (bay > 0 && L > bay + 1e-6) {
      const n = Math.ceil(L / bay - 1e-9) - 1;
      for (let k = 1; k <= n; k++) out.push({ z: B.zNode - L * k / (n + 1), pillar: null, tag: 'sub' + k });
    }
  }
  if (C) out.push({ z: C.zNode, pillar: C, tag: 'C' });
  if (C && o.cargoLen > 0.01) out.push({ z: C.zNode - o.cargoLen, pillar: null, tag: 'box' });   // boxRear = cabin + cargo bay
  return out.sort((a, b) => b.z - a.z);
}
// THE LIFT STRUT'S ROOT RING (61_gen_frame G59.2): the ring nearest the front spar's root station, clamped to the
// last FULL-section ring strictly ahead of the box's end - a station list as frameStations gives it, the front spar
// root's cage z. -> the station record, or null
function strutRootStation(st, zSpar) {
  if (!st || !st.length || zSpar == null) return null;
  const box = st.find(s => s.tag === 'box') || st.find(s => s.tag === 'C');
  const ok = st.filter(s => s.tag !== 'box' && (!box || s.z > box.z + 0.01));
  if (!ok.length) return null;
  let best = ok[0];
  for (const s of st) if (Math.abs(s.z - zSpar) < Math.abs(best.z - zSpar)) best = s;
  // clamped to the box: a nearest ring at or aft of the box's end falls to the last one ahead of it
  if (!ok.includes(best)) best = ok[ok.length - 1];
  return best;
}
// THE FLOAT TRUSS'S TWO FUSELAGE RINGS (61_gen_frame: iFwd = the last ring more than 0.10 m ahead of the step, iAft
// the first more than 0.10 m aft of it), off the same station list and the step's cage z. -> { fwd, aft } (either
// null when the step stands past the stations this list knows: the firewall's mount, a tail ring)
function floatRootStations(st, zStep) {
  if (!st || !st.length || zStep == null) return { fwd: null, aft: null };
  const ahead = st.filter(s => s.z > zStep + 0.10), behind = st.filter(s => s.z < zStep - 0.10);
  return { fwd: ahead.length ? ahead[ahead.length - 1] : null, aft: behind.length ? behind[0] : null };
}

// ---- the hinge line and the keep-out ------------------------------------------------------------------------------
// THE AXIS a door turns about: the hinge layer's own fitted line when it published one (CAGE_HINGE.doors, the line
// its barrels sit on - one source), else the door's forward run below the window (the default, edge 0), fitted as
// the chord of its run. `edge` (the hinge layer's row, hgDoorEdge): 0 forward, 1 top, 2 aft, 3 bottom, 4 top +
// bottom (the Cub's clamshell: the upper half on the top line, the lower on the bottom one).
function axesOf(door, edge, hingeLines) {
  const mine = (hingeLines || []).filter(h => h.door === door.key);
  if (mine.length) return mine.map(h => ({ A: h.A, B: h.B, part: h.part || 'all' }));
  const chord = r => r ? { A: r.A, B: r.B } : null;
  const e = Math.round(edge || 0);
  if (e === 4) return [Object.assign({ part: 'up' }, chord(door.top)), Object.assign({ part: 'lo' }, chord(door.bot))].filter(a => a.A);
  const r = e === 1 ? door.top : e === 2 ? door.aft : e === 3 ? door.bot : door.fwd;
  return r ? [Object.assign({ part: 'all' }, chord(r))] : [];
}
// the door's turn: the unit axis, the sign that swings it OUTWARD (its centroid's arm turns toward the door's normal)
function turnOf(door, ax, tris) {
  const u = nrm(sub(ax.B, ax.A));
  let c = [0, 0, 0], n = 0;
  for (const t of tris) for (const p of t) { c = add(c, p); n++; }
  c = mul(c, 1 / Math.max(1, n));
  let v = sub(c, ax.A); v = sub(v, mul(u, dot(v, u)));
  const s = dot(crs(u, nrm(v)), door.n) >= 0 ? 1 : -1;
  return { u, s, o: ax.A };
}
// p turned by (cos c, sin s) about the line (o, u), into `out` (the sweep's hot loop: no allocation)
function rotCS(p, o, u, c, s, out) {
  const vx = p[0] - o[0], vy = p[1] - o[1], vz = p[2] - o[2];
  const k = (u[0] * vx + u[1] * vy + u[2] * vz) * (1 - c);
  const xx = u[1] * vz - u[2] * vy, xy = u[2] * vx - u[0] * vz, xz = u[0] * vy - u[1] * vx;
  out[0] = o[0] + vx * c + xx * s + u[0] * k; out[1] = o[1] + vy * c + xy * s + u[1] * k; out[2] = o[2] + vz * c + xz * s + u[2] * k;
  return out;
}
// p turned by `th` (radians) about the line (o, u)
function rot(p, o, u, th) {
  const v = sub(p, o), c = Math.cos(th), s = Math.sin(th);
  const k = dot(u, v), x = crs(u, v);
  return [o[0] + v[0] * c + x[0] * s + u[0] * k * (1 - c),
          o[1] + v[1] * c + x[1] * s + u[1] * k * (1 - c),
          o[2] + v[2] * c + x[2] * s + u[2] * k * (1 - c)];
}
function partTris(door, part, ax) {
  if (part === 'all') return door.tris;
  const ym = 0.5 * (door.yLo + door.yHi);
  return door.tris.filter(t => ((t[0][1] + t[1][1] + t[2][1]) / 3 >= ym) === (part === 'up'));
}
// IS A POINT IN A DOOR'S WAY: on its panel (within `pad` of the closed skin, inside its outline) or anywhere its 0-90
// deg swing passes (`opt.panelOnly`: the closed panel alone). Returns { door, why: 'panel' | 'swing', mm } or null.
function inDoor(PS, p, pad, opt) {
  pad = pad == null ? 0.03 : pad;
  opt = opt || {};
  for (const d of (PS && PS.doors) || []) {
    if ((p[0] >= 0 ? 1 : -1) !== d.sgn) continue;
    if (p[2] < d.z0 - pad - d.w || p[2] > d.z1 + pad || p[1] < d.yLo - pad - d.h || p[1] > d.yHi + pad + d.h) continue;
    for (const ax of axesOf(d, opt.edge, opt.hinges)) {
      const tris = partTris(d, ax.part, ax);
      const T = turnOf(d, ax, tris);
      // turn the POINT back through the swing and ask the closed panel: the door's skin at every angle is the closed
      // skin turned, so "p within pad of the door at angle th" == "p turned by -th within pad of the closed door"
      let best = Infinity;
      for (let deg = 0; deg <= (opt.panelOnly ? 0 : 90); deg += 3) {
        const q = rot(p, T.o, T.u, -T.s * deg * Math.PI / 180);
        for (const t of tris) { const dd = ptTri(q, t[0], t[1], t[2]); if (dd < best) best = dd; }
        if (best <= pad) return { door: d.key, why: deg === 0 ? 'panel' : 'swing', mm: Math.round(best * 1000), deg };
      }
    }
  }
  return null;
}

// IS (z, y) INSIDE A DOOR'S OUTLINE on flank `sgn`, seen from the side (metres; `pad` grows it): the door's own
// triangles projected on the flank. A relocated fitting tests its footprint with this - a spot of skin inside a
// door's outline that is not a door face (a reveal, a waistband) is still in the door's way
function inDoorZY(PS, sgn, z, y, pad) {
  pad = pad || 0;
  for (const d of (PS && PS.doors) || []) {
    if (d.sgn !== sgn || z < d.z0 - pad || z > d.z1 + pad || y < d.yLo - pad || y > d.yHi + pad) continue;
    for (const t of d.tris) {
      const [a, b, c] = t;
      const den = (b[1] - c[1]) * (a[2] - c[2]) + (c[2] - b[2]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-12) continue;
      const l1 = ((b[1] - c[1]) * (z - c[2]) + (c[2] - b[2]) * (y - c[1])) / den;
      const l2 = ((c[1] - a[1]) * (z - c[2]) + (a[2] - c[2]) * (y - c[1])) / den;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) return d;
    }
    if (pad > 0) {
      // within `pad` of the outline: the nearest door vertex, a cheap stand-in for the edge distance
      for (const t of d.tris) for (const q of t) if (Math.hypot(q[2] - z, q[1] - y) < pad) return d;
    }
  }
  return null;
}

// ---- distances ---------------------------------------------------------------------------------------------------
// point - triangle (Ericson, Real-Time Collision Detection 5.1.5), scalars only: the sweep calls it millions of times
function ptTri(p, a, b, c) {
  const px = p[0], py = p[1], pz = p[2], ax = a[0], ay = a[1], az = a[2];
  const abx = b[0] - ax, aby = b[1] - ay, abz = b[2] - az, acx = c[0] - ax, acy = c[1] - ay, acz = c[2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return Math.sqrt(apx * apx + apy * apy + apz * apz);
  const bpx = px - b[0], bpy = py - b[1], bpz = pz - b[2];
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return Math.sqrt(bpx * bpx + bpy * bpy + bpz * bpz);
  const vc = d1 * d4 - d3 * d2;
  let qx, qy, qz;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3); qx = ax + abx * v; qy = ay + aby * v; qz = az + abz * v;
  } else {
    const cpx = px - c[0], cpy = py - c[1], cpz = pz - c[2];
    const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) return Math.sqrt(cpx * cpx + cpy * cpy + cpz * cpz);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6); qx = ax + acx * w; qy = ay + acy * w; qz = az + acz * w;
    } else {
      const va = d3 * d6 - d5 * d4;
      if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
        const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        qx = b[0] + (c[0] - b[0]) * w; qy = b[1] + (c[1] - b[1]) * w; qz = b[2] + (c[2] - b[2]) * w;
      } else {
        const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
        qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
      }
    }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// a uniform grid of triangles (their bounding boxes), for "every triangle within r of p". Numeric cell keys and a
// stamp array instead of a Set per query (the sweep asks a few hundred thousand times a door)
function triGrid(tris, cell) {
  const G = new Map(), f = x => Math.floor(x / cell);
  const K = (i, j, l) => ((i + 1024) * 2048 + (j + 1024)) * 2048 + (l + 1024);
  tris.forEach((t, ti) => {
    const lo = [0, 1, 2].map(a => f(Math.min(t[0][a], t[1][a], t[2][a])));
    const hi = [0, 1, 2].map(a => f(Math.max(t[0][a], t[1][a], t[2][a])));
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let l = lo[2]; l <= hi[2]; l++) {
      const kk = K(i, j, l); let b = G.get(kk); if (!b) G.set(kk, b = []); b.push(ti);
    }
  });
  const stamp = new Uint32Array(tris.length); let q = 0;
  return { near(p, r, fn) {
    q++;
    const i0 = f(p[0] - r), i1 = f(p[0] + r), j0 = f(p[1] - r), j1 = f(p[1] + r), l0 = f(p[2] - r), l1 = f(p[2] + r);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let l = l0; l <= l1; l++) {
      const b = G.get(K(i, j, l)); if (!b) continue;
      for (let n = 0; n < b.length; n++) { const ti = b[n]; if (stamp[ti] !== q) { stamp[ti] = q; fn(ti); } }
    }
  } };
}
// the sample points of a set of triangles: every corner once, every edge every `step` once, every centroid
function samplesOf(tris, step) {
  const seen = new Set(), out = [], key = p => Math.round(p[0] * 2000) + ',' + Math.round(p[1] * 2000) + ',' + Math.round(p[2] * 2000);
  const put = (p, tag) => { const k = key(p); if (!seen.has(k)) { seen.add(k); out.push([p, tag]); } };
  tris.forEach((t, ti) => {
    for (let e = 0; e < 3; e++) {
      const a = t[e], b = t[(e + 1) % 3], L = len(sub(b, a)), n = Math.floor(L / step);
      put(a, ti);
      for (let i = 1; i <= n; i++) put(add(a, mul(sub(b, a), i / (n + 1))), ti);
    }
    if (len(sub(t[1], t[0])) > step || len(sub(t[2], t[0])) > step) put(mul(add(add(t[0], t[1]), t[2]), 1 / 3), ti);
  });
  return out;
}

// ---- THE SWEEP ---------------------------------------------------------------------------------------------------
// The door turned from 0 to `max` deg (90) about each of its axes; at every angle the clearance is the least
// distance between the door's skin and the obstacles' triangles, measured BOTH ways (the door's sample points to the
// obstacles' triangles at the turned angle, the obstacles' sample points turned BACK to the closed door's
// triangles - the same distance, without re-gridding the door each angle). `obstacles` [{ label, tris }] in metres,
// the cage frame. The first `from` degrees are not judged: the door's own gap and whatever stands flush on the flank
// beside its edge read a few millimetres there and the door moves AWAY from them (a door that cannot start to open
// is one an obstacle stands ON: those read 0 at `from` too). Distances past `reach` are not resolved (reported as
// `reach`). -> { minMM, deg, who, axes: n, perDeg: [[deg, mm]] }
function swingSweep(door, axes, obstacles, opt) {
  opt = opt || {};
  const from = opt.from != null ? opt.from : 3, max = opt.max != null ? opt.max : 90, stepD = opt.step || 5;
  const reach = opt.reach || 0.06, sstep = opt.sample || 0.03;
  let best = { mm: Math.round(reach * 1000), deg: null, who: null };
  const perDeg = [];
  // THE DOOR'S OWN FITTINGS RIDE IT: a fittings-layer triangle lying on the closed door (every corner within
  // `ride` of its skin) is the handle, the latch, a placard - it swings with the door, it is not in its way. Any
  // OTHER layer's triangle on the door is the finding (a strut's foot bolted to a door's skin reads 0)
  const ride = opt.ride != null ? opt.ride : 0.06, RIDES = opt.rides || new Set(['access']);
  const gClosed = triGrid(door.tris, 0.08);
  const onDoor = t => t.every(p => { let m = Infinity; gClosed.near(p, ride, ti => { const q = door.tris[ti]; m = Math.min(m, ptTri(p, q[0], q[1], q[2])); }); return m <= ride; });
  let nObs = 0;
  // the least clearance to each KIND of obstacle over the whole swing (mm, and the angle it is reached at)
  const byCat = {}, onClosed = {};
  // per kind: the least clearance over the swing, and the least at the FIRST angle swept (`from`) - a door blocked
  // by something is one that MOVES TOWARD it (its clearance falls as the door opens) or is touching it shut; what
  // stands beside the door's edge or its hinge, the door moving away, is near and not in the way
  const first = {};
  const note = (c, d, deg, who) => { const mm = Math.round(d * 1000); const b = byCat[c]; if (!b || mm < b.mm) byCat[c] = { mm, deg, who };
    if (deg === from) { const f = first[c]; if (f == null || mm < f) first[c] = mm; } };
  const axs = axes && axes.length ? axes : axesOf(door, 0, null);
  for (const ax of axs) {
    const tris = partTris(door, ax.part, ax);
    if (!tris.length) continue;
    const T = turnOf(door, ax, tris);
    // THE SWEPT SECTOR: in the hinge's own cylinder (a along the axis, r out from it, phi round it from the closed
    // door) the door fills a < [a0, a1], r < rMax, phi 0..max; an obstacle triangle is kept when its bounding ball
    // meets that sector grown by `reach` - the cabin behind the door, the wing above it and the nose are not asked
    const e0 = (() => { let c = [0, 0, 0], n = 0; for (const t of tris) for (const q of t) { c = add(c, q); n++; }
      let v = sub(mul(c, 1 / n), T.o); v = sub(v, mul(T.u, dot(v, T.u))); return nrm(v); })();
    const e1 = mul(crs(T.u, e0), T.s);
    let a0 = Infinity, a1 = -Infinity, rMax = 0;
    for (const t of tris) for (const q of t) { const v = sub(q, T.o), a = dot(v, T.u); a0 = Math.min(a0, a); a1 = Math.max(a1, a);
      rMax = Math.max(rMax, len(sub(v, mul(T.u, a)))); }
    const phiLo = -0.35, phiHi = max * Math.PI / 180 + 0.35;
    const inSector = (c, rad) => {
      const v = sub(c, T.o), a = dot(v, T.u);
      if (a < a0 - reach - rad || a > a1 + reach + rad) return false;
      const w = sub(v, mul(T.u, a)), r = len(w);
      if (r > rMax + reach + rad) return false;
      if (r < reach + rad) return true;
      const phi = Math.atan2(dot(w, e1), dot(w, e0)), slack = Math.asin(Math.min(1, (reach + rad) / r));
      return phi >= phiLo - slack && phi <= phiHi + slack;
    };
    const oT = [], oW = [], oC = [];
    for (const ob of obstacles) for (const t of ob.tris) {
      if ((t[0][0] + t[1][0] + t[2][0]) * door.sgn < 0) continue;           // the other flank
      const c = mul(add(add(t[0], t[1]), t[2]), 1 / 3);
      const rad = Math.max(len(sub(t[0], c)), len(sub(t[1], c)), len(sub(t[2], c)));
      if (!inSector(c, rad)) continue;
      if (RIDES.has(ob.layer) && onDoor(t)) continue;
      oT.push(t); oW.push(ob.label); oC.push(ob.cat || ob.layer || '?');
    }
    nObs += oT.length;
    if (opt.debug) console.log('oT', oT.length, 'door tris', tris.length);
    if (!oT.length) continue;
    const gO = triGrid(oT, reach);
    const oS = samplesOf(oT, sstep);
    const gD = triGrid(tris, reach);
    const dS = samplesOf(tris, sstep).map(x => x[0]);
    const at = deg => {
      const th = T.s * deg * Math.PI / 180, cth = Math.cos(th), sth = Math.sin(th);
      let m = reach, who = null;
      const p = [0, 0, 0], q = [0, 0, 0];
      // the door's samples, turned, to the obstacles
      for (const p0 of dS) {
        rotCS(p0, T.o, T.u, cth, sth, p);
        gO.near(p, reach, ti => { const d = ptTri(p, oT[ti][0], oT[ti][1], oT[ti][2]); note(oC[ti], d, deg, oW[ti]);
          if (d < m) { m = d; who = oW[ti]; } });
      }
      // the obstacles' samples, turned back, to the closed door
      for (const [q0, ti0] of oS) {
        rotCS(q0, T.o, T.u, cth, -sth, q);
        gD.near(q, reach, ti => { const t = tris[ti]; const d = ptTri(q, t[0], t[1], t[2]); note(oC[ti0], d, deg, oW[ti0]);
          if (d < m) { m = d; who = oW[ti0]; } });
      }
      return { mm: Math.round(m * 1000), who };
    };
    // WHAT TOUCHES THE CLOSED DOOR (0 deg, within 5 mm, by kind): a strut root or a step bolted on the door's skin,
    // a wing root fillet laid over its sill - the finding behind a red that starts at the first degree. Measured
    // apart from the swing (whose minimum starts at `from`)
    {
      const seen = {};
      for (const [q0, ti0] of oS) {
        gD.near(q0, 0.005, ti => { const t = tris[ti]; const d = ptTri(q0, t[0], t[1], t[2]); if (d <= 0.005) seen[oC[ti0]] = oW[ti0]; });
      }
      // ...and it is IN THE DOOR'S WAY from the first degree: the door turning out runs through it between two
      // samples (a 24 mm post on the panel is passed clean through by the 3 deg sample - GATE PILLAR's ruler)
      for (const k in seen) {
        onClosed[k] = seen[k];
        note(k, 0, 0, seen[k]);
        if (best.mm > 0) best = { mm: 0, deg: 0, who: seen[k] };
      }
    }
    // COARSE, THEN FINE: every `step` degrees, then every degree either side of the coarse minimum
    let cBest = null;
    for (let deg = from; deg <= max + 1e-9; deg += stepD) {
      const a = at(deg);
      perDeg.push([deg, a.mm, a.who]);
      if (!cBest || a.mm < cBest.mm) cBest = Object.assign({ deg }, a);
    }
    if (cBest && cBest.mm < Math.round(reach * 1000))
      for (let deg = Math.max(from, cBest.deg - stepD + 1); deg <= Math.min(max, cBest.deg + stepD - 1); deg++) {
        if (deg === cBest.deg) continue;
        const a = at(deg);
        if (a.mm < cBest.mm) cBest = Object.assign({ deg }, a);
      }
    if (cBest && cBest.mm < best.mm) best = { mm: cBest.mm, deg: cBest.deg, who: cBest.who };
  }
  // THE BLOCK: per kind, touching the shut door, or closing in while it opens (2 mm below its first-angle reading)
  let block = { mm: Math.round(reach * 1000), deg: null, who: null };
  for (const c in byCat) {
    const b = byCat[c], f = first[c];
    b.closing = f == null || b.mm < f - 2 || b.mm <= 2;            // touching is in the way, whichever way it goes
    const blocking = (c in onClosed) || b.closing;
    if (blocking && b.mm < block.mm) block = { mm: b.mm, deg: b.deg, who: b.who };
  }
  return { minMM: block.mm, deg: block.deg, who: block.who, nearMM: best.mm, nearDeg: best.deg, nearWho: best.who,
           axes: axs.length, obs: nObs, byCat, onClosed, perDeg };
}

// WHAT AN OBSTACLE IS, for the table (the brief's columns: the wing, its struts, the float struts, the booms, any
// anchor - and whatever else a layer drew there)
function catOf(layer, nm) {
  if (/liftstrut|edFit_cabane|edFit_interplane|edFit_wire/.test(nm) || layer === 'brace') return 'wing strut';
  if (/edFloatStruts/.test(nm)) return 'float strut';
  if (layer === 'float') return 'float';
  if (layer === 'wing') return 'wing';
  if (layer === 'boom') return 'boom';
  if (layer === 'access' || layer === 'light') return 'anchor';
  if (layer === 'gear') return 'gear';
  if (layer === 'eng' || layer === 'cowl') return 'engine';
  if (layer === 'fin' || layer === 'stab') return 'tail';
  return layer;
}
const SWING_CATS = ['wing', 'wing strut', 'float strut', 'boom', 'anchor'];

// ---- the obstacles, off a scene ---------------------------------------------------------------------------------
// Every drawn layer's triangles in the cage frame (each mesh's world matrix, taken back through the layer root's
// parent: the editor stands the cage on its gear, the join's headless mount is two identity groups), labelled by
// the nearest named object. The door's OWN hardware is not an obstacle: the hinge layer's door barrels and the
// fittings layer's handle ride the door. `skip(name)` drops more.
function sceneObstacles(THREE, scene, opt) {
  opt = opt || {};
  const out = new Map();
  const v = new THREE.Vector3(), M = new THREE.Matrix4(), inv = new THREE.Matrix4();
  scene.updateMatrixWorld(true);
  const vis = o => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
  scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position || !vis(o)) return;
    let root = null;
    const chain = [];
    for (let q = o; q; q = q.parent) {
      if (/^cageLayer:/.test(q.name || '')) { root = q; break; }
      if (q.name) chain.push(q.name);
    }
    if (!root) return;
    const layer = root.name.slice(10);
    if (opt.layers && !opt.layers.has(layer)) return;
    const nm = chain.join('/');
    if (layer === 'hinge' && /edHinge_[^/]*door/.test(nm)) return;          // the door's own barrels (both leaves)
    if (opt.skip && opt.skip(nm, layer)) return;
    const label = layer + (chain.length ? ' ' + chain[chain.length - 1] : '');
    inv.copy(root.parent ? root.parent.matrixWorld : new THREE.Matrix4()).invert();
    M.multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : p.count;
    const key = layer + ':' + nm;
    let rec = out.get(key);
    if (!rec) out.set(key, rec = { label, layer, cat: catOf(layer, nm), tris: [] });
    // only what lies inside `opt.box` (the doors' reach): the sweep never looks further, and a whole aeroplane's
    // triangles as nested arrays are hundreds of megabytes (GATE PARKED's page in node ran out of heap)
    const B = opt.box;
    const inB = (x, y, z) => !B || (x >= B[0] && x <= B[3] && y >= B[1] && y <= B[4] && z >= B[2] && z <= B[5]);
    const q = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i + 2 < n; i += 3) {
      let any = false;
      for (let e = 0; e < 3; e++) {
        v.fromBufferAttribute(p, idx ? idx.getX(i + e) : i + e).applyMatrix4(M);
        q[3 * e] = v.x; q[3 * e + 1] = v.y; q[3 * e + 2] = v.z;
        if (inB(v.x, v.y, v.z)) any = true;
      }
      if (any) rec.tris.push([[q[0], q[1], q[2]], [q[3], q[4], q[5]], [q[6], q[7], q[8]]]);
    }
  });
  return [...out.values()].filter(r => r.tris.length);
}

// ---- THE DOOR-SWING CHECK -------------------------------------------------------------------------------------
// Every door of the build turned 0 -> 90 deg about its hinge (the hinge layer's own line when it published one,
// the row's edge otherwise) against every drawn layer: the least clearance per door and per kind of obstacle, and
// RED under SWING_RED_MM. `hinges` CAGE_HINGE.doors; `edge` the hinge row. ~1 s a door: the editor runs it when the
// hand stops (the hinge layer schedules it), the gates and the survey call it, the join only READS the last answer.
const SWING_RED_MM = 20, SWING_STOP = 75;
function doorSwingReport(THREE, scene, mesh, R, FS, o) {
  o = o || {};
  const PS = pillarsOf(mesh, R, FS);
  if (!PS.doors.length) return { doors: [], worst: null, red: false, redMM: SWING_RED_MM };
  // the box every door's swing can reach: its own box grown by its width / height and the sweep's reach
  const bx = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const d of PS.doors) {
    const g = Math.max(d.w, d.h) + 0.15;
    for (const t of d.tris) for (const p of t) for (let a = 0; a < 3; a++) { bx[a] = Math.min(bx[a], p[a] - g); bx[a + 3] = Math.max(bx[a + 3], p[a] + g); }
  }
  const obs = sceneObstacles(THREE, scene, Object.assign({ box: bx }, o));
  const doors = [];
  // THE STOP (the build's doorStop row, 75 deg by default - the user's call, 3 Nov): the doors open that far and no
  // further, so that is how far they are swept
  const stop = o.stop > 0 ? +o.stop : SWING_STOP;
  for (const d of PS.doors) {
    const sw = swingSweep(d, axesOf(d, o.edge, o.hinges), obs, Object.assign({}, o, { max: stop }));
    doors.push({ key: d.key, minMM: sw.minMM, deg: sw.deg, who: sw.who, nearMM: sw.nearMM, byCat: sw.byCat, onClosed: sw.onClosed, stop,
                 red: sw.minMM < SWING_RED_MM });
  }
  const worst = doors.reduce((a, d) => (!a || d.minMM < a.minMM ? d : a), null);
  return { doors, worst, red: doors.some(d => d.red), redMM: SWING_RED_MM, stopDeg: stop };
}
// one line for a door's answer ('pilot:P 0 mm at 3 deg (float strut), on the closed door: float strut')
function swingLine(d) {
  const cat = d.who ? catOf(d.who.split(' ')[0], d.who) : '';
  const on = Object.keys(d.onClosed || {});
  return d.key + ' ' + d.minMM + ' mm' + (d.deg != null ? ' at ' + d.deg + ' deg' : '') + (cat ? ' (' + cat + ')' : '') +
         (on.length ? ', on the closed door: ' + on.join(', ') : '');
}

const API = { SWING_CATS, SWING_RED_MM, SWING_STOP, inDoorZY, doorSwingReport, swingLine, catOf, pillarsOf, onPillar, pillarOfFrame, frameStations, strutRootStation, floatRootStations, inDoor, swingSweep, sceneObstacles, axesOf, ptTri, rot, bandsOf };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.PILLAR_SITE = API;
})();
