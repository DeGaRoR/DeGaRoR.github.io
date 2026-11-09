#!/usr/bin/env node
// GATE WINGFILLET - THE WING-ROOT FILLET (WING-FILLET, 9 Nov 2026; futureDesigns/WING-FILLET-STUDY-2026-11.md).
//
//   node tools/_wingfillet_check.js [--only jodel,dc3] [--nocrash]   -> "GATE WINGFILLET: PASS|FAIL"
//
// The user: "a body-wing blend piece generator ... Always as an option: things stay as-is without the option". The fillet
// is _cage_wing.js wfDraw (rows wgFillet / wgFilletK / wgFilletAft), a separate mesh of the wing layer. Rows:
//   1 OFF       the rows absent (every saved build) and the rows written at their off values draw the SAME scene, vertex
//               for vertex (every mesh's positions hashed), and nothing named edWingFillet exists; a size or an extension
//               row with the fillet off draws nothing either; cageToSpec writes none of the three at their defaults
//               (CAGE_DEFAULT_ABSENT) and writes and loads them back exact when set
//   2 FIT       on every test build that has a wing-body contact, each style: a mesh (both sides), and on every chord
//               station of every sheet the feet land on the DRAWN skins at the depth they were sunk (the body foot against
//               the cage sheet's skin faces, the wing foot against the wing's skin and flaps at rest) within FIT_TOL; the
//               sheet's middle stands OUTSIDE the body and outside the wing (never inside what it fairs); left = mirror
//   3 REFUSE    a parasol is refused with its reason and nothing drawn (the Pietenpol); a biplane blends its lower plane and
//               refuses its parasol upper (the Tiger Moth); a wing that does not meet its body is refused with the gap
//               measured, nothing drawn (the Spitfire WIP card: its wing hangs under the keel)
//   4 CRASH     the flown snapshot (tools/_dmg_wall_lib.js, the join headless) with the fillet on: its vertices are the
//               static wing layer's, classed COVER by skin_break.js's own rule (inhClass) and bound by its own
//               bindInherit - every place bound (weights sum 1), only to frame members within ROOT_R of the wing root (it
//               follows the root members, never a far one), and the fillet shared between the fuselage's members and the
//               wing's (each side's share of places at least SPLIT_MIN): when the wing parts from the body the fillet parts
//               along the same line and tears, never floats or goes whole with one side
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ONLY = opt('only', null), NOCRASH = argv.includes('--nocrash');
const FIT_TOL = 0.012, OUT_TOL = 0.006, ANCHOR_K = 0.25, SPLIT_MIN = 0.10;
require('./_core_fresh.js').assertFresh(path.join(T, 'flight_core.js'));
const SH = require(path.join(T, '_scene_headless.js'));
let fails = 0;
const check = (ok, label, detail) => { console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? '  -  ' + detail : '')); if (!ok) fails++; };

// the builds: [key, source, the fillet expected (true), or the refusal's word]
const BUILDS = [
  ['jodel', 'builds/jodel_2026-09-20_corrected.json', true],
  ['dc3', 'tools/fixtures/dc3_2026-10.json', true],
  ['rv', 'arch:rv', true],
  ['motorglider', 'arch:motorglider', true],
  ['cub', 'builds/cub_2026-09-20_corrected.json', true],
  ['tigermoth', 'tools/fixtures/tigermoth_2026-10.json', 'biplane'],
  ['pietenpol', 'arch:pietenpol', 'parasol'],
  ['spitfire', 'tools/fixtures/spitfire_wip_2026-10.json', 'meet'],
].filter(b => !ONLY || ONLY.split(',').includes(b[0]));
let PANEL = null;
function specOf(src) {
  if (src.startsWith('arch:')) {
    const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
    if (!PANEL) PANEL = BJ.loadPanel().D;
    const a = PANEL.ARCHETYPES.find(x => x.key === src.slice(5));
    const s0 = PANEL.designBake(a.sel, a.over);
    return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
  }
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, src), 'utf8'));
  return raw.spec || raw;
}
// every mesh's positions (world), hashed in traversal order: the scene's drawing, vertex for vertex
function sceneHash(scene) {
  const crypto = require('crypto'), h = crypto.createHash('sha1');
  let n = 0, fil = 0;
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    // (the beacon's rotor turns with the clock: two builds of one aeroplane differ there and nowhere else)
    for (let a = o; a; a = a.parent) if (/^liRotor/.test(a.name || '')) return;
    if (/^edWingFillet/.test(o.name || '')) fil++;
    const a = o.geometry.attributes.position, e = o.matrixWorld.elements;
    h.update(String(o.name || '') + ':' + a.count + ':' + e.map(v => v.toFixed(6)).join(','));
    h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength));
    n++;
  });
  return { hash: h.digest('hex').slice(0, 16), meshes: n, fillets: fil };
}
// the closest distance from p to a triangle soup (cells of 0.1 m over x, z)
function soup() {
  const T3 = [], cell = new Map(), C = 0.1;
  const add = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-10) return;   // (a degenerate triangle)
    const id = T3.length; T3.push([a, b, c]);
    const i0 = Math.floor(Math.min(a[0], b[0], c[0]) / C), i1 = Math.floor(Math.max(a[0], b[0], c[0]) / C);
    const j0 = Math.floor(Math.min(a[2], b[2], c[2]) / C), j1 = Math.floor(Math.max(a[2], b[2], c[2]) / C);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 2500) return;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i + ',' + j; let L = cell.get(k); if (!L) cell.set(k, L = []); L.push(id); }
  };
  const near = p => {
    let best = Infinity;
    const i = Math.floor(p[0] / C), j = Math.floor(p[2] / C);
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) {
      const L = cell.get((i + di) + ',' + (j + dj)); if (!L) continue;
      for (const id of L) best = Math.min(best, triDist(p, T3[id]));
    }
    return best;
  };
  return { add, near, n: () => T3.length };
}
function triDist(p, [a, b, c]) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q;
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
      else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; }
          }
        }
      }
    }
  }
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
// the drawn skins a plane's fillet stands on: the body's (the cage sheet's skin faces, metres, cut parts undone - the
// pylon caster's own set) and the plane's (its skin geometries and its flaps and ailerons at rest)
const GLASS = new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'drawnPane', 'skyWindows']);
function skinsOf(r, k) {
  const W = r.W, GG = W.GEAR_GEN, M = r.built.sheet, FS = r.FS, body = soup(), wing = soup();
  for (const f of M.F) {
    // (the skin faces and the glazing: a foot may lie on a window, as on the Cub's rear pane)
    if (!f || !f.v || f.v.length < 3 || !(GG.CAGE_MATS.has(f.m) || GLASS.has(f.m))) continue;
    const co = f.cutOff || [0, 0, 0];
    const q = f.v.map(i => [(M.V[i][0] - co[0]) * FS, (M.V[i][1] - co[1]) * FS, (M.V[i][2] - co[2]) * FS]);
    for (let t = 1; t + 1 < q.length; t++) body.add(q[0], q[t], q[t + 1]);
  }
  const PL = W.CAGE_WING.planes[k], sfx = k ? '2' : '';
  const geos = PL.skinGeos.map(g => [g, [0, 0, 0]]);
  for (const o of PL.group.children) if (o.isMesh && new RegExp('^edSurf_(flap|ail)[RL]' + sfx + '$').test(o.name || '')) geos.push([o.geometry, [o.position.x, o.position.y, o.position.z]]);
  for (const [g, off] of geos) {
    const pa = g.attributes.position, ix = g.index, n = ix ? ix.count : pa.count;
    const P3 = i => [pa.getX(i) + off[0], pa.getY(i) + off[1], pa.getZ(i) + off[2]];
    for (let t = 0; t + 2 < n; t += 3) wing.add(P3(ix ? ix.getX(t) : t), P3(ix ? ix.getX(t + 1) : t + 1), P3(ix ? ix.getX(t + 2) : t + 2));
  }
  return { body, wing };
}

const t0 = Date.now();
console.log('GATE WINGFILLET - the wing-root fillet (_cage_wing.js wfDraw)');
const CRASH = [];
for (const [key, src, expect] of BUILDS) {
  console.log(key + ' (' + src + ')');
  const spec = specOf(src);
  // 1 OFF (the first build of an aeroplane writes its held rows back - _cage_wing.js writeRow - and the second draws them:
  // every build compared here is a second one)
  SH.sceneBuild(spec, { garage: spec });
  const a = SH.sceneBuild(spec, { garage: spec });
  const hA = sceneHash(a.scene);
  const b = SH.sceneBuild(spec, { garage: spec, over: { wgFillet: 0, wgFilletK: 1, wgFilletAft: 0 } });
  const hB = sceneHash(b.scene);
  const c = SH.sceneBuild(spec, { garage: spec, over: { wgFillet: 0, wgFilletK: 1.6, wgFilletAft: 0.4 } });
  const hC = sceneHash(c.scene);
  check(hA.hash === hB.hash && hA.hash === hC.hash && !hA.fillets && !hC.fillets,
        'OFF: absent rows = rows at off = size/extension with the fillet off', hA.meshes + ' meshes, ' + hA.hash + ' / ' + hB.hash + ' / ' + hC.hash);
  const CG2 = a.W.CAGE2, saved = CG2.cageToSpec(a.P);
  check(!('wgFillet' in saved) && !('wgFilletK' in saved) && !('wgFilletAft' in saved), 'OFF: no fillet row written at its default (cageToSpec)');
  const P2 = Object.assign({}, a.P, { wgFillet: 2, wgFilletK: 1.25, wgFilletAft: 0.4 }), s2 = CG2.cageToSpec(P2), back = CG2.cageFromSpec({ cage: s2 });
  check(s2.wgFillet === 2 && s2.wgFilletK === 1.25 && s2.wgFilletAft === 0.4 && back.wgFillet === 2 && back.wgFilletK === 1.25 && back.wgFilletAft === 0.4,
        'SAVE: the rows set are written and load back exact');
  // 2 FIT / 3 REFUSE
  for (const style of [1, 2]) {
    const r = SH.sceneBuild(spec, { garage: spec, over: { wgFillet: style } });
    const F = r.W.CAGE_WING && r.W.CAGE_WING.fillet;
    if (!F) { check(false, 'style ' + style + ': a fillet record', r.errors.slice(0, 1).join('')); continue; }
    const fitted = F.planes.filter(p => p.mesh), refused = F.planes.filter(p => !p.mesh);
    const words = refused.map(p => 'plane ' + p.k + ' ' + p.pos + ': ' + p.why).join('; ');
    if (expect === 'parasol') { check(!fitted.length && refused.length === 1 && /parasol/.test(refused[0].why) && !sceneHash(r.scene).fillets, 'REFUSE style ' + style + ': the parasol, nothing drawn', words); continue; }
    if (expect === 'meet') { check(!fitted.length && refused.length === 1 && /does not meet the body.*cm clear/.test(refused[0].why) && !sceneHash(r.scene).fillets, 'REFUSE style ' + style + ': no wing-body contact, the gap said, nothing drawn', words); continue; }
    if (expect === 'biplane') check(fitted.length === 1 && refused.length === 1 && /parasol/.test(refused[0].why) && fitted[0].pos !== 'parasol', 'REFUSE style ' + style + ': the lower plane blended, the parasol upper refused', words);
    else check(fitted.length === F.planes.length, 'style ' + style + ': fitted to every plane', words || fitted.map(p => p.pos).join(','));
    for (const p of fitted) {
      const S = skinsOf(r, p.k), fit = p.fit;
      let nB = 0, nW = 0, nMid = 0, worstB = 0, worstW = 0, worstMid = 0, badB = 0, badW = 0, badMid = 0;
      const AF = r.W.CAGE_WING.AF, NJ = fit.sheets[0].rows.find(Boolean).length - 1;
      for (const sh of fit.sheets) sh.rows.forEach((row, i) => {
        const f = sh.feet[i];
        if (!row || !f || f.plate) return;
        // the body foot: at its sink below the drawn body skin
        const dB = Math.abs(S.body.near(row[0]) - f.sinkB); nB++; worstB = Math.max(worstB, dB); if (dB > FIT_TOL) badB++;
        if (!f.virt) { const dW = Math.abs(S.wing.near(row[NJ]) - f.sinkW); nW++; worstW = Math.max(worstW, dW); if (dW > FIT_TOL) badW++; }
        // the middle: outside the body (its radius at its own angle against the airframe's) and clear of the wing
        if (!f.virt) {
          const m = row[NJ >> 1], z = m[2], cy = AF.surf(Math.max(AF.z0 + 1e-3, Math.min(AF.z1 - 1e-3, z)), Math.PI / 2)[1];
          const ang = Math.atan2(m[0], cy - m[1]), q = AF.surf(Math.max(AF.z0 + 1e-3, Math.min(AF.z1 - 1e-3, z)), ang);
          const rIn = Math.hypot(q[0], q[1] - cy) - Math.hypot(m[0], m[1] - cy);
          nMid++; worstMid = Math.max(worstMid, rIn); if (rIn > OUT_TOL) badMid++;
        }
      });
      // (a station in 25 may miss by more: a faceted body's door frame, a flap's cove - the rest must sit)
      check(nB > 0 && badB <= Math.max(1, 0.04 * nB) && badW <= Math.max(1, 0.04 * nW) && badMid === 0,
            `FIT style ${style} plane ${p.k} (${p.pos}): feet on the drawn skins, middle outside the body`,
            `body feet ${nB - badB}/${nB} within ${FIT_TOL * 1000} mm (worst ${(worstB * 1000).toFixed(1)}), wing feet ${nW - badW}/${nW} (worst ${(worstW * 1000).toFixed(1)}), middles ${nMid - badMid}/${nMid} outside (deepest ${(worstMid * 1000).toFixed(1)} mm in)`);
      // the mirror: both sides, one count
      const pa = p.mesh.geometry.attributes.position;
      let L = 0, Rr = 0; for (let v = 0; v < pa.count; v++) { if (pa.getX(v) > 1e-6) Rr++; else if (pa.getX(v) < -1e-6) L++; }
      check(L === Rr && L > 0, `FIT style ${style} plane ${p.k}: both sides drawn, mirrored`, L + ' / ' + Rr + ' vertices, ' + p.mesh.geometry.index.count / 3 + ' triangles');
    }
    if (style === 2 && expect === true && ['jodel', 'dc3'].includes(key)) CRASH.push([key, src, fitted.map(p => p.mesh.geometry.index.count)]);
  }
}
// 4 CRASH
if (!NOCRASH && CRASH.length) {
  const WL = require(path.join(T, '_dmg_wall_lib.js')), SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
  for (const [key, src, counts] of CRASH) {
    console.log(key + ' crash binding (the flown snapshot, the fillet on)');
    const patch = j => { const s = j.spec || j; s.cage = Object.assign({}, s.cage, { wgFillet: 2 }); return j; };
    // (the FIRST snapshot of an aeroplane draws its wing's buckets otherwise than every later one - its held rows written
    // back, as in row 1; measured on master's join with no fillet: the Jodel's wing ranges 11448/... then 13680/6060/...;
    // a warm-up is taken and dropped)
    WL.snapshotOf(src);
    const S0 = WL.snapshotOf(src), S1 = WL.snapshotOf(src, { patch });
    // the fillet's range: a static range of the wing layer as long as its mesh's triangles (the join unrolls them); the
    // snapshot without the fillet has the same wing ranges, less that one (counted by length: a new bucket renumbers keys)
    const lens = S => (S.snap.layers || []).filter(l => l[0] === 'wing' || l[0] === 'wing2').map(l => l[3] - l[2]).sort((a, b) => a - b);
    const extra = (S1.snap.layers || []).filter(l => (l[0] === 'wing' || l[0] === 'wing2') && counts.includes(l[3] - l[2]));
    const l1 = lens(S1), l0 = lens(S0);
    for (const l of extra) { const i = l1.indexOf(l[3] - l[2]); if (i >= 0) l1.splice(i, 1); }
    if (JSON.stringify(l1) !== JSON.stringify(l0)) console.log('    wing ranges with: ' + l1.join(',') + '\n    without: ' + l0.join(','));
    check(extra.length === counts.length && JSON.stringify(l1) === JSON.stringify(l0),
          'CRASH: the fillet is a static range of the wing layer (no part); every other wing range as without it', extra.map(l => l[0] + ' ' + (l[3] - l[2]) + ' v').join(', '));
    if (!extra.length) continue;
    const def = S1.def, n = def.nodes.length, Tt = SB.topo(def.beams, n), rest = new Float64Array(n * 3);
    def.nodes.forEach((d, i) => { rest[i * 3] = d.p[0]; rest[i * 3 + 1] = d.p[1]; rest[i * 3 + 2] = d.p[2]; });
    // the snapshot's visual frame -> the design frame (the DMGWALL study's own transform)
    const X = S1.X, Y = S1.Y, Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
    const og = S1.org, o = S1.o;
    const wingNode = new Uint8Array(n), fusNode = new Uint8Array(n);
    for (const bm of def.beams) { if (bm.sec === 'wings') { wingNode[bm.a] = 1; wingNode[bm.b] = 1; } if (bm.sec === 'fuselage') { fusNode[bm.a] = 1; fusNode[bm.b] = 1; } }
    for (const l of extra) {
      const g = S1.groups.find(gg => gg.key === l[1]);
      const role = g.sec ? (WL.AS.AERO_ROLE[g.sec] || '') : '', cls = SB.inhClass(g.sec, role, l[0]);
      check(cls === SB.INH.cover, 'CRASH: classed COVER by skin_break.inhClass (it tears with the frame, never goes whole)', 'class ' + Object.keys(SB.INH).find(k => SB.INH[k] === cls));
      const nv = g.nv, bD = new Float64Array(nv * 3);
      for (let v = 0; v < nv; v++) { const a = g.pos[v * 3] + o[0], b = g.pos[v * 3 + 1] + o[1], c2 = g.pos[v * 3 + 2] + o[2];
        bD[v * 3] = og[0] + X[0] * a + Y[0] * b + Z[0] * c2; bD[v * 3 + 1] = og[1] + X[1] * a + Y[1] * b + Z[1] * c2; bD[v * 3 + 2] = og[2] + X[2] * a + Y[2] * b + Z[2] * c2; }
      const cv = new Uint8Array(nv).fill(SB.INH.keep); for (let v = l[2]; v < l[3]; v++) cv[v] = cls;
      const R = SB.make({ nv, idx: g.idx.slice() }, SB.INH_K, { cage: true, pos: bD, rest, weld: true, rideAll: true });
      SB.bindInherit([{ R, cv, obj: new Int32Array(nv).fill(-1) }], Tt, rest);
      // (each place's ANCHOR - its bound nodes' weighted centroid - against the place itself: a covering place blends the
      // members passing it, so its anchor stands near it; ANCHOR_K root chords at most)
      const chord = def.spec && def.spec.wings && def.spec.wings[0] ? def.spec.wings[0].chord : 1.5, RR = ANCHOR_K * chord + 0.25;
      let places = 0, unbound = 0, far = 0, toWing = 0, toFus = 0, worstD = 0;
      for (let v = l[2]; v < l[3]; v++) {
        const u = R.rep ? R.rep[v] : v; if (u !== v) continue;
        places++;
        let sw = 0, wW = 0, wF = 0; const an = [0, 0, 0];
        for (let k = 0; k < SB.INH_K; k++) { const w = R.ww[v * SB.INH_K + k], i = R.wi[v * SB.INH_K + k]; if (!(w > 0)) continue; sw += w;
          if (wingNode[i] && !fusNode[i]) wW += w; else if (fusNode[i] && !wingNode[i]) wF += w;
          const p = def.nodes[i].p; an[0] += w * p[0]; an[1] += w * p[1]; an[2] += w * p[2]; }
        const d = Math.hypot(an[0] / (sw || 1) - bD[v * 3], an[1] / (sw || 1) - bD[v * 3 + 1], an[2] / (sw || 1) - bD[v * 3 + 2]);
        worstD = Math.max(worstD, d); if (d > RR) far++;
        if (Math.abs(sw - 1) > 1e-3) unbound++;
        if (wW > wF) toWing++; else if (wF > wW) toFus++;
      }
      check(places > 0 && unbound === 0, 'CRASH: every place bound (weights sum 1)', places + ' places, ' + unbound + ' not');
      check(far === 0, `CRASH: every place bound to the members beside it (its anchor within ${RR.toFixed(2)} m)`, 'farthest anchor ' + worstD.toFixed(2) + ' m');
      check(toWing >= SPLIT_MIN * places && toFus >= SPLIT_MIN * places, 'CRASH: shared between the fuselage\'s members and the wing\'s (it parts along the root)',
            `${toFus} places go with the fuselage, ${toWing} with the wing, ${places - toFus - toWing} even (of ${places})`);
    }
  }
}
console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
console.log('GATE WINGFILLET: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
