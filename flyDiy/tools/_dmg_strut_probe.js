#!/usr/bin/env node
// DMG-WALL (the staircase lift struts, 2026-10-07 17:57 box stills: the Cub's struts straight intact, stair-stepped after
// the page nose-over's axle break): THE DRAWN STRUTS' BINDING, measured on the page itself in node (tools/_page_node.js,
// dev.html?simw=1&damage=1, the user's Cub, the census's nose-over: 12 m/s on the ground into a 35 cm stump). For every
// strut record (model.strutRigs) and every other record holding tube places:
//   - its places' dominant node pairs (the member each place rides) - one strut riding several members is the suspect;
//   - the inherited binding's tube stats (pieces bound whole / loose place by place / knuckles);
//   - the KINK: the places' worst offset off the strut's straight line (the rest's principal axis), live minus rest.
// Run: node tools/_dmg_strut_probe.js [--secs 6] [--out <json>] [--case noseover|trunk-0]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const CASES = { noseover: { D: 12, agl: 0, V: 12, off: 0, top: 0.35, r: 0.25 }, 'trunk-0': { D: 40, agl: 4, V: 30, off: 0, top: 10, r: 0.3 } };

function probe(W) {
  const FP = W.FLIGHT_PROBE, m = FP.model(), K = m && m.brk, def = FP.def ? FP.def() : null;
  const tag = i => (def && def.nodes && def.nodes[i] && def.nodes[i].tag) || String(i);
  if (!K || !K.inhL) return { none: true };
  const struts = new Set((m.strutRigs || []).map(r => r.brkR).filter(Boolean));
  const out = { inhSt: K.inhSt ? Object.assign({}, K.inhSt) : null, recs: [] };
  for (const E of K.inhL) {
    const R = E.R; let nTube = 0; for (let v = 0; v < R.nv; v++) if (E.cv[v] === 1) nTube++;
    if (!nTube) continue;
    const isStrut = struts.has(R), Kk = R.K, rp = R.rep, B = R.baseD, Wp = R.w;
    // the places (tube class), each one's dominant pair of nodes by weight
    const pl = []; for (let v = 0; v < R.nv; v++) if (E.cv[v] === 1 && (!rp || rp[v] === v)) pl.push(v);
    const pairs = new Map();
    for (const v of pl) { const o = v * Kk, W2 = R.w2 || R.ww, ws = [];
      for (let k = 0; k < Kk; k++) if (W2[o + k] > 0) ws.push([R.wi[o + k], W2[o + k]]);
      ws.sort((a, b) => b[1] - a[1]); const key = ws.slice(0, 2).map(x => tag(x[0])).sort().join('~'); pairs.set(key, (pairs.get(key) || 0) + 1); }
    // the kink: the rest's principal axis through the places' centroid; each place's offset off that line, rest and live
    let kink = null;
    if (B && Wp && pl.length > 3) {
      const cen = (A) => { let x = 0, y = 0, z = 0; for (const v of pl) { x += A[v*3]; y += A[v*3+1]; z += A[v*3+2]; } return [x / pl.length, y / pl.length, z / pl.length]; };
      const axis = (A, c) => { let best = null, bd = -1; for (const a of pl) for (const b of [pl[0], pl[pl.length - 1]]) { const d = Math.hypot(A[a*3] - A[b*3], A[a*3+1] - A[b*3+1], A[a*3+2] - A[b*3+2]); if (d > bd) { bd = d; best = [a, b]; } }
        const [a, b] = best, u = [A[b*3] - A[a*3], A[b*3+1] - A[a*3+1], A[b*3+2] - A[a*3+2]], l = Math.hypot(u[0], u[1], u[2]) || 1; return { u: u.map(x => x / l), len: bd }; };
      const offs = (A) => { const c = cen(A), ax = axis(A, c), r = []; for (const v of pl) { const d = [A[v*3] - c[0], A[v*3+1] - c[1], A[v*3+2] - c[2]], t = d[0]*ax.u[0] + d[1]*ax.u[1] + d[2]*ax.u[2];
        r.push(Math.hypot(d[0] - t * ax.u[0], d[1] - t * ax.u[1], d[2] - t * ax.u[2])); } return { r, len: ax.len }; };
      const o0 = offs(B), o1 = offs(Wp); let worst = 0; for (let j = 0; j < pl.length; j++) worst = Math.max(worst, o1.r[j] - o0.r[j]);
      kink = { len: +o0.len.toFixed(2), restMax: +Math.max(...o0.r).toFixed(3), liveMax: +Math.max(...o1.r).toFixed(3), worstGrow: +worst.toFixed(3) };
    }
    out.recs.push({ name: E.name || '', strut: isStrut, places: pl.length, tubeV: nTube, members: [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), nMembers: pairs.size, kink });
  }
  // THE NORMALS (the user, 17:57 still: 'the cowl is also grey, that looks like the inside of the cowl'): every live
  // triangle of a record with drawn normals, its face normal against its vertices' normals - at rest (baseD / nB, the
  // rest frame) and drawn (the geometry's position / normal, its local frame); a triangle whose sign turned is drawn lit
  // from behind. By layer (the snapshot's layer ranges; '-' none)
  { const lay = new Map(); for (const r of (m.data && m.data.layers) || []) { let L = lay.get(r[1]); if (!L) lay.set(r[1], L = []); L.push(r); }
    const NR = {};
    for (const E of K.inhL) { const R = E.R, geo = R.geo, Pa = geo && geo.attributes.position && geo.attributes.position.array, Na = R.nAttr ? R.nAttr.array : (geo && geo.attributes.normal && geo.attributes.normal.array);
      if (!Pa || !Na || !R.baseD || !R.nB) continue;
      const rg = lay.get(E.name) || [], ix = R.idx0 || R.idx, Bd = R.baseD, NB = R.nB;
      const lyr = v => { for (const r of rg) if (v >= r[2] && v < r[3]) return r[0]; return '-'; };
      const fs = (A, Nn, a, b, c) => { const ux = A[b*3] - A[a*3], uy = A[b*3+1] - A[a*3+1], uz = A[b*3+2] - A[a*3+2], wx = A[c*3] - A[a*3], wy = A[c*3+1] - A[a*3+1], wz = A[c*3+2] - A[a*3+2];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz); if (!(l > 1e-12)) return 0;
        const sx = Nn[a*3] + Nn[b*3] + Nn[c*3], sy = Nn[a*3+1] + Nn[b*3+1] + Nn[c*3+1], sz = Nn[a*3+2] + Nn[b*3+2] + Nn[c*3+2], sl = Math.hypot(sx, sy, sz); if (!(sl > 1e-9)) return 0;
        return (nx * sx + ny * sy + nz * sz) / (l * sl); };
      for (let t = 0; t < R.nt; t++) { if (R.dead && R.dead[t]) continue;
        const a = ix[t*3], b = ix[t*3+1], c = ix[t*3+2]; if (a === b || b === c || a === c) continue;
        const L = (E.name ? E.name.slice(0, 14) + ':' : '') + lyr(a), d0 = fs(Bd, NB, a, b, c), d1 = fs(Pa, Na, a, b, c);
        const o = NR[L] || (NR[L] = { tris: 0, flips: 0, skew: 0, restBack: 0 }); o.tris++;
        if (d0 < -0.3) o.restBack++;
        if (Math.abs(d0) > 0.3 && Math.abs(d1) > 0.3 && Math.sign(d0) !== Math.sign(d1)) o.flips++;
        if (Math.abs(d0) > 0.3 && Math.abs(d1) <= 0.3) o.skew++; } }
    out.normals = Object.fromEntries(Object.entries(NR).filter(([, o]) => o.flips || o.skew || /cowl/.test(Object.keys(NR).find(k => NR[k] === o) || '')).sort((x, y) => (y[1].flips + y[1].skew) - (x[1].flips + x[1].skew)).slice(0, 30)); }
  out.recs.sort((a, b) => (b.strut - a.strut) || ((b.kink ? b.kink.worstGrow : 0) - (a.kink ? a.kink.worstGrow : 0)));
  const S = W.FLYDIY_DMG_STATE ? W.FLYDIY_DMG_STATE() : null;
  out.broken = S && S.br ? S.br.map(bi => { const b = K.T.beams[bi]; return b ? tag(b.a) + '-' + tag(b.b) : bi; }) : null;
  return out;
}

(async () => {
  const { openPage } = require('./_page_node.js');
  const C = CASES[opt('case', 'noseover')], SECS = +opt('secs', 6);
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, 'builds/cub_2026-09-20_corrected.json'), 'utf8') };
  const P = await openPage({ quiet: true, storage, query: 'simw=1&damage=1', workers: /sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  const tripN = () => (W.FLYDIY_TRIPS || []).length;
  const tripDone = (kind, n0) => { const T = W.FLYDIY_TRIPS || []; const t = T[T.length - 1]; return T.length > n0 && !!(t && t.kind === kind && t.done && W.BOOT.state === 'gone'); };
  const SW = () => W.FLYDIY_SIMW || null, live = () => { const s = SW() && SW().state(); return !!(s && s.phase === 'live' && s.flight && s.flight.live); };
  { const n0 = tripN(); W.document.getElementById('bGo').click(); await P.until(() => tripDone('rollout', n0), 900000);
    const RD = W.FLIGHT_PROBE.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
    for (let i = 0; i < 600 && !live(); i++) await P.frames(1); }
  const FP = W.FLIGHT_PROBE; W.FLYDIY_SKINBREAK = true; W.FLYDIY_SKINGPU = false; FP.setManual(true);
  const sim = FP.sim(), world = FP.world(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
  const c = sim.cgPos(), g = world.terrainH(c[0], c[2]); let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
  let placed = false; FP.place({ at: [c[0], g + (C.agl || 0) + (c[1] - yMin) + 0.05, c[2]], zeroV: true, dv: [C.V * fx, 0, C.V * fz] }).then(() => { placed = true; });
  await P.until(() => placed, 60000);
  const c2 = sim.cgPos(), tx = c2[0] + fx * C.D - fz * C.off, tz = c2[2] + fz * C.D + fx * C.off, gt = world.terrainH(tx, tz);
  world.treeHits.set('fill:strutprobe', [tx, tz, gt, C.r, gt + C.top]); sim.ctl.thr = 0;
  const tA = sim.t, snaps = [];
  for (let f = 0; f < SECS * 60 + 900 && sim.t - tA < SECS; f++) { await P.frames(1);
    if (f % 30 === 29) { const pr = probe(W); if (!pr.none) snaps.push({ t: +(sim.t - tA).toFixed(2), worst: pr.recs.filter(r => r.strut).map(r => r.kink && r.kink.worstGrow) }); } }
  const res = { case: opt('case', 'noseover'), end: probe(W), snaps, errors: P.errors.slice(0, 10) };
  console.log('broken ' + (res.end.broken ? res.end.broken.length + ': ' + res.end.broken.join(', ') : 'n/a'));
  console.log('inhSt ' + JSON.stringify(res.end.inhSt));
  for (const r of (res.end.recs || []).slice(0, 14)) console.log((r.strut ? 'STRUT ' : 'tube  ') + JSON.stringify(r));
  console.log('strut kinks over time ' + JSON.stringify(snaps));
  console.log('normals (live tris whose drawn normal turned against their face, by record:layer) ' + JSON.stringify(res.end.normals || null));
  if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify(res, null, 1));
  P.close(); process.exit(0);
})().catch(e => { console.error('STRUT PROBE: ' + (e && e.stack || e)); process.exit(2); });
