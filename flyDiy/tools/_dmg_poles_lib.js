// G2388-G2390 (DMG-POLES): TWO POLES, A GAP NARROWER THAN THE SPAN. The user (2026-10-07): "what happens when a plane
// tries to fly through 2 poles and quite does not fit? Do the wings break cleanly?"
//
// THE STAGING (G2388) - _treecrash_lib's atTrunk on its flat world (300 m, calm air), its one test trunk replaced by two
// vertical poles (the same 'fill:test' set, `poles`), D m ahead of the aeroplane's CG across its track, each standing at
// a chosen FRACTION of the semispan from the centreline (the gap between their faces 2 (f s - r), narrower than the
// span), the asymmetric variant with the aeroplane `off` m to the right of the gap's centre (its right wing meets its
// pole further in, its left further out - both at the same moment: the poles stand abreast). Two poles:
//   wood   r 0.13 m, 9 m: a wooden distribution pole. ANSI O5.1 (recalled, not opened): a class 4-5, 35-40 ft pole
//          measures ~21-23 in round at the top and ~31-37 in at 6 ft from the butt, i.e. 17-30 cm across; 26 cm is its
//          middle. 9 m above the ground is the 35-40 ft pole less its 1.6-1.8 m setting depth (10 % + 2 ft, the same
//          standard's rule, recalled).
//   steel  r 0.06 m, 9 m: a steel lighting / sign pole of 4-4.5 in pipe (ASME B36.10 4 in NPS: 114.3 mm OD, recalled);
//          12 cm across. Its 9 m is the wooden pole's (GAME: a street light stands 6-10 m).
// The poles are the solver's trunks (TREE_HITS): rigid, unbreakable, their contact the trunk law (30_solver.js tkHit /
// trunkPass). A real wooden pole may snap under a heavy aeroplane; under a 450-900 kg light aeroplane's wing it stands
// (the accident record, below), so rigid is the right end of it.
//
// THE MATRIX (G2389) - the validated aeroplanes only (the user's Cub, the Jodel, the metal Cessna), the certificate
// stamped (damage on, as the game runs it), the throttle shut at the start (the pilot's reflex; a taxi rolls on):
//   the poles at 85 / 65 / 45 % of the semispan; 8 m/s taxiing (on its wheels), the lift-off speed (the aeroplane's own
//   ap.VRot, on its wheels), 35 m/s level 2 m up (the wheels 2 m over the ground, the fuselage datum levelled: the
//   wing, not the gear, meets the poles; a sim spawned in its ground attitude at 35 m/s balloons at 3-5 g before it
//   gets there).
//
// WHAT "CLEANLY" IS (G2390) - analyse(): per wing, the members broken (when, class, station, how), the station it
// parted at against the pole's, the pieces it became, any failure inboard of the cut and its load path, the root's load
// and the yaw / roll over time. See _dmg_poles_check.js for the bands.
'use strict';
const path = require('path');
const L = require('./_treecrash_lib.js');

const POLES = {
  wood: { r: 0.13, h: 9, label: 'wooden utility pole, 26 cm' },
  steel: { r: 0.06, h: 9, label: 'steel pole, 12 cm' },
};
const KEYS = ['cub', 'jodel', 'metal'];
const FRACS = [0.85, 0.65, 0.45];
const D_AHEAD = 10;              // the poles' line, m ahead of the CG (GAME: 0.3-1.2 s of run before the contact)
const AGL_AIR = 2;               // the 35 m/s pass: the wheels this high (GAME)
const TAIL = 0.25;              // the pole phase: from the first contact to the last new one + TAIL s (GAME: a member's break
                                // wave crosses the wing in milliseconds; a quarter second is the pole's, not the ground's)
const SECS = 6;                  // what is flown (s): the contact and what the aeroplane does after (GAME)

// the wing's nodes (the lattice's spar nodes: front WF, rear WR, a box's lower WB) and the semispan (the outermost one)
function wingOf(def) {
  const isW = new Uint8Array(def.nodes.length);
  let semi = 0;
  def.nodes.forEach((n, i) => { if (/^W[FRB]$/.test(n.tag)) { isW[i] = 1; semi = Math.max(semi, Math.abs(n.p[2])); } });
  return { isW, semi };
}
const speedOf = (key, sp) => sp === 'taxi' ? 8 : sp === 'lof' ? L.defOf(key, { cert: false }).params.ap.VRot : sp === 'air' ? 35 : +sp;

// a case: { key, pole: 'wood' | 'steel', frac, speed: 'taxi' | 'lof' | 'air', off (m, the aeroplane right of the gap's
// centre) } -> the atTrunk options
function staging(c) {
  const def = L.defOf(c.key, { cert: false }), { semi } = wingOf(def), P = POLES[c.pole], s = c.frac * semi, off = c.off || 0;
  const V = speedOf(c.key, c.speed), air = c.speed === 'air';
  return { V, semi, sR: s - off, sL: -(s + off),
    o: { D: D_AHEAD, V, thr: 0, secs: c.secs || SECS, agl: air ? AGL_AIR : 0, level: air,
      poles: [{ s: s - off, r: P.r, h: P.h }, { s: -(s + off), r: P.r, h: P.h }] } };
}

// the members by what they are in the lattice (61_gen_frame.js): both ends wing nodes - a SPAR (the same chord line,
// two stations: front, rear, a box's lower cap), a RIB (one station) or a DIAGONAL (the drag / shear bracing across a
// bay); one end on the fuselage - a ROOT fitting (sec 'wings'), a STRUT (sec 'bracing', the drawn lift strut to its
// station) or the FAN (sec 'bracing', the hidden stand-in for the planar wing's box: the strut's root to the root and
// tip stations)
// (a bracing member to the root station - a cantilever box's lower root fitting - is a ROOT fitting)
function memberClass(def, b, isW, strutZ) {
  const A = def.nodes[b.a], B = def.nodes[b.b], wa = isW[b.a], wb = isW[b.b];
  if (wa && wb) {
    if (Math.abs(Math.abs(A.p[2]) - Math.abs(B.p[2])) < 1e-6) return 'rib';
    return A.tag === B.tag ? 'spar' : 'diag';
  }
  if (b.sec === 'bracing') { const z = Math.abs((wa ? A : B).p[2]); return z <= rootStation(def, isW) + 1e-6 ? 'root' : Math.abs(z - strutZ) < 1e-6 ? 'strut' : 'fan'; }
  return 'root';
}
const rootStation = (def, isW) => { let z = Infinity; def.nodes.forEach((n, i) => { if (isW[i]) z = Math.min(z, Math.abs(n.p[2])); }); return z; };
// the drawn lift strut's station: a drawn (vis) bracing member from the fuselage to a wing node OUTBOARD of the root
// station (-1: a cantilever wing)
function strutStation(def, isW) {
  const z0 = rootStation(def, isW);
  for (const b of def.beams) if (b.sec === 'bracing' && b.vis !== false && (isW[b.a] ^ isW[b.b]) && b.cls === 'wing') {
    const z = Math.abs(def.nodes[isW[b.a] ? b.a : b.b].p[2]); if (z > z0 + 1e-6) return z; }
  return -1;
}

// FLY one case, recording every frame: the new breaks (t, beam), the trunk contacts, the wings' root loads (the vector
// sum of the forces the wing's members put on the fuselage's nodes, N), the yaw and roll (deg), the CG's height and speed
function run(c, extra) {
  const S = staging(c), def0 = L.defOf(c.key, { cert: false }), W = wingOf(def0);
  const log = { breaks: [], hist: [] };
  let seen = 0, side = null, roots = null, fwd0 = null, rt0 = null, rSgn = 1, hits0 = 0, tFirst = null, tLast = null;
  const o = Object.assign({}, S.o, extra || {});
  o.onStart = (sim, def) => {
    side = def.nodes.map(n => Math.sign(n.p[2]));
    roots = { R: [], L: [] };
    def.beams.forEach((b, bi) => { if (b.cls !== 'wing' || !(W.isW[b.a] ^ W.isW[b.b])) return;
      const wn = W.isW[b.a] ? b.a : b.b, fn = wn === b.a ? b.b : b.a; roots[side[wn] > 0 ? 'R' : 'L'].push([bi, fn, wn]); });
    const ax = sim.axes(); fwd0 = [-ax[0][0], -ax[0][2]]; const l = Math.hypot(fwd0[0], fwd0[1]); fwd0 = [fwd0[0] / l, fwd0[1] / l]; rt0 = [-fwd0[1], fwd0[0]];
    // (+ yaw: the nose toward the right wing - the def's +z, the side its ...R nodes stand on; + roll: the right wing down)
    const c0 = sim.cgPos(); let zx = 0, zz = 0; for (let i = 0; i < sim.n; i++) { const w = def.nodes[i].p[2]; zx += w * (sim.p[i*3] - c0[0]); zz += w * (sim.p[i*3+2] - c0[2]); }
    if (zx * rt0[0] + zz * rt0[1] < 0) rt0 = [-rt0[0], -rt0[1]];
    rSgn = Math.sign(ax[2][0] * rt0[0] + ax[2][2] * rt0[1]) || 1;
    hits0 = sim.trunkHits();
    if (extra && extra.onStart0) extra.onStart0(sim, def);
  };
  const rootLoad = (sim, list) => { let fx = 0, fy = 0, fz = 0;
    for (const [bi, fn, wn] of list) { const b = sim.beams[bi]; if (b.broken) continue;
      const dx = sim.p[wn*3] - sim.p[fn*3], dy = sim.p[wn*3+1] - sim.p[fn*3+1], dz = sim.p[wn*3+2] - sim.p[fn*3+2], Lb = Math.hypot(dx, dy, dz) || 1e-9;
      const F = b.k * (Lb - b.L0); fx += F * dx / Lb; fy += F * dy / Lb; fz += F * dz / Lb; }
    return [fx, fy, fz]; };
  o.onFrame = (sim, f) => {
    const D = sim.damage();
    for (; seen < D.broken.length; seen++) log.breaks.push({ t: sim.t, bi: D.broken[seen] });
    const h = sim.trunkHits();
    if (h > hits0) { if (tFirst === null) tFirst = sim.t; tLast = sim.t; hits0 = h; }
    // the pieces as the pole phase ends (the last new contact + TAIL): what the poles did, before the wreck lands
    if (tFirst !== null && sim.t <= tLast + TAIL + 1e-9) log.snap = { t: sim.t, pcs: piecesOf(sim, W.isW) };
    const ax = sim.axes(), nx = -ax[0][0], nz = -ax[0][2], nl = Math.hypot(nx, nz) || 1;
    const yaw = Math.atan2((nx * rt0[0] + nz * rt0[1]) / nl, (nx * fwd0[0] + nz * fwd0[1]) / nl) * 180 / Math.PI;
    const roll = -Math.asin(Math.max(-1, Math.min(1, rSgn * ax[2][1]))) * 180 / Math.PI;
    const pitch = Math.asin(Math.max(-1, Math.min(1, -ax[0][1]))) * 180 / Math.PI;
    const R = rootLoad(sim, roots.R), Lf = rootLoad(sim, roots.L), cg = sim.cgPos(), v = sim.cgVel();
    // the root's load: its magnitude and its share along the flight path (+ aft: the pole's drag on the wing)
    const along = F => -(F[0] * fwd0[0] + F[2] * fwd0[1]);
    log.hist.push({ t: sim.t, yaw, roll, pitch, h: cg[1], V: Math.hypot(v[0], v[1], v[2]),
      rootR: Math.hypot(R[0], R[1], R[2]), rootL: Math.hypot(Lf[0], Lf[1], Lf[2]), dragR: along(R), dragL: along(Lf), hits: h });
    if (extra && extra.onFrame0) extra.onFrame0(sim, f);
  };
  const r = L.atTrunk(c.key, o);
  log.tFirst = tFirst; log.tLast = tLast;
  return { c, S, r, log, W, def: r.def };
}

// the pieces: the live members' and the whole clusters' union-find (crashStats' own), each piece's mass, its nodes and
// which wing (if any) it is wholly part of
function piecesOf(sim, isW) {
  const n = sim.n, P = new Int32Array(n); for (let i = 0; i < n; i++) P[i] = i;
  const f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; };
  for (const b of sim.beams) if (!b.broken) { const x = f(b.a), y = f(b.b); if (x !== y) P[x] = y; }
  const cc = sim.clusterCuts ? sim.clusterCuts().clusters : [];
  for (const C of cc) if (!C.off && C.nodes && C.nodes.length) for (const i of C.nodes) { const x = f(i), y = f(C.nodes[0]); if (x !== y) P[x] = y; }
  const m = new Map();
  for (let i = 0; i < n; i++) { const r = f(i); if (!m.has(r)) m.set(r, { mass: 0, nodes: [] }); const q = m.get(r); q.mass += sim.m[i]; q.nodes.push(i); }
  const list = Array.from(m.values()).sort((a, b) => b.mass - a.mass);
  return list;
}

// G2390: WHAT THE WING DID, per side. `win`: the pole phase (from the first contact to the last new one + `tail` s);
// a break after it is the ground's (the wreck's own landing), reported apart
function analyse(R, opt) {
  opt = opt || {};
  const { r, log, W, def, S } = R, sim = r.sim, D = sim.damage(), tail = opt.tail == null ? TAIL : opt.tail;
  const strutZ = strutStation(def, W.isW);
  const tEnd = log.tLast === null ? -1 : log.tLast + tail;
  const grpKey = g => (def.parts && def.parts.dmg && def.parts.dmg.groups[g] ? def.parts.dmg.groups[g].key : null);
  const groupsGone = new Set((D.groups || []).map(g => g.grp));
  const stations = Array.from(new Set(def.nodes.filter((n, i) => W.isW[i]).map(n => +Math.abs(n.p[2]).toFixed(6)))).sort((a, b) => a - b);
  const out = { key: R.c.key, case: R.c, V: S.V, semi: W.semi, strutZ, stations, tFirst: log.tFirst, tLast: log.tLast,
    finite: r.finite, fault: sim.fault ? sim.fault() : null, vNodeMax: r.vNodeMax, ke0: r.ke0, keMax: r.keMax, hits: r.hits, wings: {} };
  const pcs = log.snap ? log.snap.pcs : piecesOf(sim, W.isW);
  out.tSnap = log.snap ? log.snap.t : null;
  for (const sd of ['R', 'L']) {
    const sC = Math.abs(sd === 'R' ? S.sR : S.sL), sg = sd === 'R' ? 1 : -1;
    // the bay the pole stands in: the stations either side of its contact station (its axis)
    let zi = 0, zo = W.semi; for (const z of stations) { if (z <= sC) zi = z; if (z >= sC) { zo = z; break; } }
    const mem = [];
    for (const e of log.breaks) {
      const b = sim.beams[e.bi];
      if (b.cls !== 'wing') continue;
      const A = def.nodes[b.a], B = def.nodes[b.b];
      const wn = W.isW[b.a] ? A : W.isW[b.b] ? B : null; if (!wn || Math.sign(wn.p[2]) !== sg) continue;
      const za = W.isW[b.a] ? Math.abs(A.p[2]) : 0, zb = W.isW[b.b] ? Math.abs(B.p[2]) : 0;
      const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
      const cls = memberClass(def, b, W.isW, strutZ);
      // how: its joint's group let go (a fitting: the part came off there), bent round the pole (the trunk's bend, torn
      // through at its fold angle), kinked (crushed in compression), or pulled apart mid-member (tension)
      const how = b.grp >= 0 && groupsGone.has(b.grp) ? 'joint:' + (grpKey(b.grp) || b.grp) : b.dOn ? 'bent:pole' : b.kink ? 'kinked' : 'pulled';
      const phase = e.t <= tEnd ? 'pole' : 'after';
      // inboard of the cut: its outboard end at or inside the bay's inner station (it does not reach the cut bay)
      const inboard = z1 <= zi + 1e-6;
      mem.push({ t: e.t, bi: e.bi, cls, z0, z1, how, phase, inboard, seam: b.seam || null });
    }
    const poleM = mem.filter(x => x.phase === 'pole');
    // WHERE IT PARTED: the bays whose spars broke in the pole phase (a spar spans one bay)
    const cutBays = Array.from(new Set(poleM.filter(x => x.cls === 'spar').map(x => x.z0.toFixed(3) + '-' + x.z1.toFixed(3))));
    const sparsIn = poleM.filter(x => x.cls === 'spar');
    const parted = sparsIn.length ? { z0: Math.min(...sparsIn.map(x => x.z0)), z1: Math.max(...sparsIn.map(x => x.z1)) } : null;
    // the pieces wholly of this wing's nodes, the main airframe aside: off (>= 0.5 kg) and crumbs
    const own = pcs.slice(1).filter(p => p.nodes.every(i => W.isW[i] && Math.sign(def.nodes[i].p[2]) === sg));
    const off = own.filter(p => p.mass >= 0.5), crumbs = own.length - off.length;
    const offOut = off.map(p => ({ mass: p.mass, n: p.nodes.length, zMin: Math.min(...p.nodes.map(i => Math.abs(def.nodes[i].p[2]))), zMax: Math.max(...p.nodes.map(i => Math.abs(def.nodes[i].p[2]))) }));
    // the wing still on the airframe: its outermost node in the main piece
    const mainNodes = new Set(pcs[0].nodes);
    let zKept = 0; def.nodes.forEach((n, i) => { if (W.isW[i] && Math.sign(n.p[2]) === sg && mainNodes.has(i)) zKept = Math.max(zKept, Math.abs(n.p[2])); });
    // inboard failures in the pole phase, each with its load path: the strut (the outer panel's lift and the pole's
    // drag reach the fuselage through it), the fan (the hidden box stand-in: it reaches the cut bay's tip station)
    // Each is EXPLAINED by its load path or not:
    //   strut  - a member of the strut's root group (the strut, its fan) that let go as a joint while the strut's
    //            station stands outboard of the cut's inner rib: the strut goes with the panel it holds
    //   drag   - a drag brace (a diagonal or a rib) pulled or crushed at its certified cap by the pole's drag: the drag
    //            shear runs undiminished from the pole to the root through every bay inboard of it - at most ONE per bay
    //            (or rib station): a second member of a bay gone is the bay parting, unexplained
    //   anything else (a spar, a root fitting, a second brace in a bay) is unexplained: the wing parting where the pole
    //   is not
    const inb = poleM.filter(x => x.inboard), perBay = {};
    for (const x of inb) {
      if ((x.cls === 'strut' || x.cls === 'fan') && /^joint:.*:strut$/.test(x.how) && strutZ > zi + 1e-6) x.path = 'strut';
      else if ((x.cls === 'diag' || x.cls === 'rib') && !/^joint/.test(x.how)) { const k = x.cls + x.z0.toFixed(3) + '-' + x.z1.toFixed(3);
        perBay[k] = (perBay[k] || 0) + 1; x.path = perBay[k] <= 1 ? 'drag' : null; }
      else x.path = null;
    }
    const sparsOut = sparsIn.filter(x => x.z0 < zi - 1e-6 || x.z1 > zo + 1e-6).length;
    const byCls = {}; for (const x of poleM) byCls[x.cls] = (byCls[x.cls] || 0) + 1;
    const byHow = {}; for (const x of poleM) { const k = x.how.split(':')[0]; byHow[k] = (byHow[k] || 0) + 1; }
    const H = log.hist, rk = sd === 'R' ? 'rootR' : 'rootL', dk = sd === 'R' ? 'dragR' : 'dragL';
    let rootPk = 0, rootPkT = null, dragPk = 0; for (const h of H) { if (h[rk] > rootPk) { rootPk = h[rk]; rootPkT = h.t; } if (h[dk] > dragPk) dragPk = h[dk]; }
    out.wings[sd] = { sC, bay: [zi, zo], parted, cutBays, members: mem, pole: poleM.length, after: mem.length - poleM.length, byCls, byHow,
      inboard: inb.map(x => ({ cls: x.cls, z0: x.z0, z1: x.z1, how: x.how, t: x.t, path: x.path })), unexplained: inb.filter(x => !x.path).length, sparsOut, pieces: off.length, crumbs, piecesOff: offOut, zKept,
      rootPk, rootPkT, dragPk, root0: H.length ? H[0][rk] : 0 };
  }
  // what the aeroplane did after: the yaw and roll at their largest and at the end, where it stopped, its height
  const H = log.hist;
  let yawMax = 0, rollMax = 0, pitchMin = 0; for (const h of H) { if (Math.abs(h.yaw) > Math.abs(yawMax)) yawMax = h.yaw; if (Math.abs(h.roll) > Math.abs(rollMax)) rollMax = h.roll; pitchMin = Math.min(pitchMin, h.pitch); }
  const e = H[H.length - 1] || {};
  out.after = { yawMax, rollMax, yawEnd: e.yaw, rollEnd: e.roll, pitchEnd: e.pitch, Vend: e.V, end: r.end, reach: r.reach, crashed: D.crashed, reason: D.reason,
    flipped: Math.abs(e.roll || 0) > 90 || Math.abs(e.pitch || 0) > 60, broken: D.broken.length, gear: D.broken.filter(i => sim.beams[i].cls === 'gear').length };
  out.hist = H.filter((h, i) => i % 3 === 0);
  return out;
}

// a case flown and judged in this process, the result compact (each member [t, cls, z0, z1, how, phase, inboard, path])
function caseResult(c) {
  const R = run(c, c.dmg === 'off' ? { elastic: true, cert: false } : null), A = analyse(R);
  for (const sd of ['R', 'L']) A.wings[sd].members = A.wings[sd].members.map(m => [m.t, m.cls, m.z0, m.z1, m.how, m.phase, m.inboard ? 1 : 0]);
  A.hash = L.stateHash(R.r.sim);
  return A;
}
// THE MATRIX: every case in a child process (`jobs` at once; o.core flies another core - FLYDIY_CORE), the certificate
// computed once per build in its own child as the game's bench thread hands it over (FLYDIY_CERT_DIR)
async function matrix(cases, o) {
  o = o || {};
  const { spawn } = require('child_process'), fs = require('fs'), os = require('os');
  const env = Object.assign({}, process.env, { FLYDIY_CERT: '1' }, o.core ? { FLYDIY_CORE: o.core } : {});
  const child = (args, e) => new Promise(res => {
    const ch = spawn(process.execPath, [__filename].concat(args), { stdio: ['ignore', 'pipe', 'pipe'], env: e || env });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', code => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { err: (se || so).slice(-1200), code }); });
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poles-cert-'));
  try {
    const e2 = Object.assign({}, env); delete e2.FLYDIY_CERT_DIR;
    for (const k of Array.from(new Set(cases.filter(c => c.dmg !== 'off').map(c => c.key)))) {
      const r = await child(['--poles-cert', k, dir], e2); if (r.err) throw new Error('the certificate of ' + k + ': ' + r.err);
    }
    env.FLYDIY_CERT_DIR = dir;
    const out = new Array(cases.length); let q = 0;
    await Promise.all(Array.from({ length: Math.min(o.jobs || 3, cases.length) }, async () => { while (q < cases.length) { const i = q++;
      out[i] = await child(['--poles-case', JSON.stringify(cases[i])]); if (o.tick) o.tick(i); } }));
    return out;
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* stays */ } }
}
// the cases by name: key/pole/speed/frac[/off][/off-damage]
const caseOf = s => { const [key, pole, speed, frac, off, dmg] = s.split('/'); return { key, pole, speed, frac: +frac, off: +(off || 0), dmg: dmg || 'on' }; };
const caseName = c => [c.key, c.pole, c.speed, c.frac].concat(c.off ? [c.off] : []).join('/') + (c.dmg === 'off' ? (c.off ? '' : '/0') + '/off' : '');

if (require.main === module && process.argv[2] === '--poles-cert') {
  const c = L.certOf(process.argv[3]);
  require('fs').writeFileSync(path.join(process.argv[4], process.argv[3] + '.json'), JSON.stringify({ nb: c.nb, Ft: Array.from(c.Ft), Fc: Array.from(c.Fc) }));
  process.stdout.write('RESULT {"ok":1}\n', () => process.exit(0));
} else if (require.main === module && process.argv[2] === '--poles-case') {
  const r = caseResult(JSON.parse(process.argv[3]));
  process.stdout.write('RESULT ' + JSON.stringify(r) + '\n', () => process.exit(0));
}

module.exports = { POLES, KEYS, FRACS, D_AHEAD, AGL_AIR, SECS, wingOf, speedOf, staging, run, analyse, piecesOf, memberClass, strutStation, caseResult, matrix, caseOf, caseName, L };
