// mud_roll.js — A MUD RUN IN NODE (GROUND-FX, 15 Nov 2026): the build's drawn aeroplane voxelised (ground_deposit.js), set
// on soft mud at its ground attitude, rolled along a taxi and a take-off run while dust.js's own sources throw the mud
// (the tread release, the bow wave, the touchdown, the prop's wash), each clod and drop marched against the airframe. What
// lands is the deposit the game draws. No browser, no GPU: GATE MUDDEPOSIT and the pictures (quickshot --mud) read it.
//
//   node tools/mud_roll.js <build.json> [--h 0.08] [--t 20] [--vmax 22] [--seed 7]     prints the cover by part
//   require('./mud_roll').run(spec, opts) -> { G, tris, part, label, norm, stats, S }
//     opts: h (cell m), T (s), vTaxi, vMax (m/s), seed, tier, S (a sceneBuild already made), log
//
// THE POSE: the contacts are the tyres' lowest points (the edWheel* groups); the ground line through the mains and the third
// wheel gives the attitude at rest (a tail-dragger sits nose-up); a tail-dragger's tail comes up between 8 and 16 m/s (the
// take-off's tail-up), a tricycle stays as it sits. THE FRAMES: craft = aeroweather's (x lateral, y aft, z up); the sim's
// world = the editor's (x lateral, y up, z forward), the aeroplane running toward +z on a flat ground at y = 0.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GD = require(path.join(ROOT, 'src', 'viewer', 'ground_deposit.js'));
const DUST = require(path.join(ROOT, 'src', 'viewer', 'dust.js'));

const SKIP_SHEET = new Set(['tube', 'cloth', 'dash', 'dashFace', 'bulkhead', 'fireProof', 'firewall', 'fireSeal',
  'shoulder', 'toele', 'plywood', 'floorBoard', 'seat', 'bulkTrim', 'baggage', 'headliner', 'cabWall']);

// ---- the drawn aeroplane's triangles in craft space, with a part (1 airframe, 2 tyre) and a label ---------------------
function gather(S, THREE) {
  const T = [], part = [], label = [], norm = [];
  const push = (a, b, c, p, lab) => {
    // editor (x, y up, z fwd) -> craft (x, y aft, z up)
    const A = [a[0], -a[2], a[1]], B = [b[0], -b[2], b[1]], C = [c[0], -c[2], c[1]];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
    if (!(l > 1e-12)) return;
    T.push(...A, ...B, ...C); part.push(p); label.push(lab); norm.push(nx / l, ny / l, nz / l);
  };
  const sheet = S.built && S.built.sheet, FS = S.FS || 1;
  if (sheet) for (const f of sheet.F) {
    if (SKIP_SHEET.has(f.m) || f.v.length < 3) continue;
    for (let t = 1; t + 1 < f.v.length; t++) {
      const a = sheet.V[f.v[0]], b = sheet.V[f.v[t]], c = sheet.V[f.v[t + 1]];
      push([a[0] * FS, a[1] * FS, a[2] * FS], [b[0] * FS, b[1] * FS, b[2] * FS], [c[0] * FS, c[1] * FS, c[2] * FS], 1, 'sheet:' + f.m);
    }
  }
  S.scene.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  S.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    if (/^edVessel_|^edFuel_|^edCrew|^edWellGhost/.test(o.name || '')) return;
    let hid = false, tyre = false, lay = '?', grp = '';
    for (let q = o; q; q = q.parent) { if (q.visible === false) hid = true; if (/^edWheel/.test(q.name || '')) { tyre = true; } if (/^cageLayer:/.test(q.name || '')) lay = q.name.slice(10); if (!grp && /^ed/.test(q.name || '')) grp = q.name; }
    if (hid) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.transparent && m.opacity < 0.3) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
    const W = i => { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); return [v.x, v.y, v.z]; };
    const lab = lay + ':' + (grp || o.name || '');
    for (let i = 0; i + 2 < n; i += 3) push(W(i), W(i + 1), W(i + 2), tyre ? 2 : 1, lab);
  });
  return { tris: Float32Array.from(T), part: Uint8Array.from(part), label, norm: Float32Array.from(norm) };
}

// the tyres' contacts (craft): each edWheel* group's lowest point, its radius and width
function contacts(S, THREE) {
  const out = [], v = new THREE.Vector3();
  S.scene.traverse(o => {
    if (!/^edWheel[A-Za-z0-9]*$/.test(o.name || '')) return;
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], any = false;
    o.traverse(q => { if (!q.isMesh) return; const p = q.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(q.matrixWorld);
      const c = [v.x, -v.z, v.y]; for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; } any = true; } });
    if (any) out.push({ name: o.name, x: (mn[0] + mx[0]) / 2, y: (mn[1] + mx[1]) / 2, z: mn[2], R: (mx[2] - mn[2]) / 2, W: mx[0] - mn[0] });
  });
  return out;
}

// 4x4 column-major helpers
const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const app = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const inv = m => {   // a rigid motion's inverse: R^T, -R^T t
  const o = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]); o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]); o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
  return o;
};
// craft -> the sim's world at pitch a (nose up +) and position (0, ty, s): world = T Rx(a) M, M: craft (x, y aft, z up) -> (x, z, -y)
const M_CW = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
function pose(a, ty, s) {
  const c = Math.cos(a), sn = Math.sin(a);
  const R = [1, 0, 0, 0, 0, c, -sn, 0, 0, sn, c, 0, 0, 0, 0, 1];   // (column-major: +z forward tips to +y when a > 0)
  const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, ty, s, 1];
  return mul(T, mul(R, M_CW));
}

function seeded(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function run(spec, opts) {
  // the scenarios (the user, 15 Nov: "a heavy-mud case and a dry-dust case"): mud = soft mud, 4 cm sinkage; heavy = deep soft
  // mud (8 cm), a harder run; dust = a dry dirt strip (no sinkage, no water: the clouds and their film)
  const SCEN = { mud: { cls: 'mud', sink: 0.04, wet: 1, vMax: 22, thrust: 1200 }, heavy: { cls: 'mud', sink: 0.08, wet: 1, vMax: 24, thrust: 1500 },
                 dust: { cls: 'dirt', sink: 0, wet: 0, vMax: 22, thrust: 1200 } };
  const sc = SCEN[(opts && opts.scen) || 'mud'] || SCEN.mud;
  const o = Object.assign({ h: 0.08, T: 20, vTaxi: 4, tTaxi: 6, seed: 7, tier: 'gamer', dt: 1 / 60 }, sc, opts || {});
  const SH = require(path.join(ROOT, 'tools', '_scene_headless.js'));
  const S = o.S || SH.sceneBuild(spec, { garage: spec });
  const THREE = SH.context().THREE;
  const t0 = Date.now();
  const gat = gather(S, THREE), CT = contacts(S, THREE);
  if (!CT.length) throw new Error('mud_roll: no edWheel* groups (floats, skis?)');
  const zLow = Math.min(...CT.map(c => c.z));
  const G = GD.make(gat.tris, gat.part, { h: o.h, zLow });
  const tGrid = Date.now() - t0;
  // the attitude at rest: the line through the mains (the lowest pair) and the third contact
  const byZ = CT.slice().sort((a, b) => a.z - b.z), mains = CT.filter(c => c.z < zLow + 0.05), third = CT.find(c => mains.indexOf(c) < 0);
  const ym = mains.reduce((s, c) => s + c.y, 0) / mains.length, zm = zLow;
  const tail = third && third.y > ym;                          // a tail-dragger (the third aft of the mains)
  const a0 = third ? Math.atan2(third.z - zm, third.y - ym) * (tail ? 1 : -1) : 0;   // (nose up +: a tail sitting high in the level drawing)
  // the prop's disc: the engine layer's foremost point
  let prop = null;
  { let yMin = 1e9, px = 0, pz = 0, n = 0; for (let t = 0; t < gat.label.length; t++) if (/^eng:|^cowl:/.test(gat.label[t])) for (let k = 0; k < 3; k++) { const y = gat.tris[t * 9 + k * 3 + 1]; if (y < yMin) yMin = y; }
    for (let t = 0; t < gat.label.length; t++) if (/^cowl:/.test(gat.label[t])) { px += gat.tris[t * 9]; pz += gat.tris[t * 9 + 2]; n++; }
    if (yMin < 1e8) prop = [n ? px / n : 0, yMin - 0.05, n ? pz / n : 0]; }
  // the sim
  const mR = Math.random, rng = seeded(o.seed); Math.random = rng; if (DUST.random) DUST.random(rng);
  try {
    const sys = DUST.makeSystem(o.tier), ci = DUST.CLASSES.indexOf(o.cls);
    const env = { groundH: () => 0, cls: () => ci, wet: () => o.wet, puddle: () => 0, wind: null, k: 1 };
    const air = (x, y, z) => (DUST.slipAt(sys.props, x, y, z) ? DUST.SL : null);
    const st = { wheels: [], props: [], wing: { span: 10, W: 5000, V: 0, rho: 1.225, tips: [[0, 0, 0], [0, 0, 0]] } };
    let s = 0, hits = 0, emitted = 0, vPrev = 0;
    const N = Math.round(o.T / o.dt);
    for (let f = 0; f < N; f++) {
      const t = f * o.dt;
      const V = t < o.tTaxi ? o.vTaxi * Math.min(1, t / 1.5) : o.vTaxi + (o.vMax - o.vTaxi) * Math.min(1, (t - o.tTaxi) / (o.T - o.tTaxi));
      s += V * o.dt;
      const a = tail ? a0 * (1 - smooth(8, 16, V)) : a0;
      // the mains on the ground: lift so the lowest main contact is at y = 0
      let m = pose(a, 0, s); const ty = -Math.min(...mains.map(c => app(m, [c.x, c.y, c.z])[1]));
      m = pose(a, ty, s);
      const toCraft = inv(m);
      st.wheels.length = 0;
      CT.forEach((c, k) => {
        const p = app(m, [c.x, c.y, c.z]), on = p[1] < 0.03;
        st.wheels.push({ key: k, x: p[0], y: 0, z: p[2], vx: 0, vy: f === 0 ? 0 : 0, vz: V, on, R: c.R || 0.2, brake: 0, sink: on ? o.sink : 0, ski: null });
      });
      st.props.length = 0;
      if (prop) { const p = app(m, prop), ax = app(m, [prop[0], prop[1] - 1, prop[2]]); const A = 2.84, wash = Math.sqrt(V * V + 2 * o.thrust / (1.225 * A)) - V;
        st.props.push({ x: p[0], y: p[1], z: p[2], ax: ax[0] - p[0], ay: ax[1] - p[1], az: ax[2] - p[2], R: 0.95, wash }); }
      const g0 = sys.G.next;
      DUST.sources(sys, st, env, o.dt);
      emitted += (sys.G.next - g0 + sys.G.n) % sys.G.n;
      DUST.step(sys, o.dt, env);
      hits += GD.collide(G, sys.G, toCraft, [0, 0, V], o.dt, o.wet, 1);
      GD.dustRays(G, sys.P, toCraft, [0, 0, V], air, o.dt, 1, rng);
      vPrev = V;
    }
    GD.smooth(G);   // (the texture's cover: what the page uploads and the pictures draw)
    const stats = { cells: G.N, dims: [G.nx, G.ny, G.nz], occupied: G.occupied, tris: gat.label.length, contacts: CT, a0: a0 * 180 / Math.PI, tail, emitted, hits, mass: G.mass, rayHits: G.rayHits, dustMass: G.dustMass, scen: (opts && opts.scen) || 'mud', msGrid: tGrid, msAll: Date.now() - t0, coat: GD.total(G) };
    if (o.log) o.log(stats);
    return { G, tris: gat.tris, part: gat.part, label: gat.label, norm: gat.norm, stats, S };
  } finally { Math.random = mR; if (DUST.random) DUST.random(null); }
}
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// the cover at each triangle's centroid (the shader's arithmetic), averaged by label groups: { group: { n, mean, max, area } }
function coverBy(R, groupOf) {
  const out = {};
  for (let t = 0; t < R.label.length; t++) {
    if (R.part[t] !== 1) continue;
    const g = groupOf(R.label[t], R.norm[t * 3], R.norm[t * 3 + 1], R.norm[t * 3 + 2], t, R);
    if (!g) continue;
    const b = t * 9, cx = (R.tris[b] + R.tris[b + 3] + R.tris[b + 6]) / 3, cy = (R.tris[b + 1] + R.tris[b + 4] + R.tris[b + 7]) / 3, cz = (R.tris[b + 2] + R.tris[b + 5] + R.tris[b + 8]) / 3;
    const ux = R.tris[b + 3] - R.tris[b], uy = R.tris[b + 4] - R.tris[b + 1], uz = R.tris[b + 5] - R.tris[b + 2], vx = R.tris[b + 6] - R.tris[b], vy = R.tris[b + 7] - R.tris[b + 1], vz = R.tris[b + 8] - R.tris[b + 2];
    const A = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    const c = GD.sample(R.G, cx, cy, cz, R.norm[t * 3], R.norm[t * 3 + 1], R.norm[t * 3 + 2]);
    const e = out[g] || (out[g] = { n: 0, area: 0, sum: 0, max: 0 });
    e.n++; e.area += A; e.sum += c * A; if (c > e.max) e.max = c;
  }
  for (const g in out) out[g].mean = out[g].area > 0 ? out[g].sum / out[g].area : 0;
  return out;
}

module.exports = { run, gather, contacts, coverBy, pose, inv, app };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? +argv[i + 1] : d; };
  const F = argv.find(a => !a.startsWith('--') && !/^[0-9.]+$/.test(a));
  if (!F) { console.error('usage: node tools/mud_roll.js <build.json> [--h 0.08] [--t 20] [--vmax 22] [--seed 7]'); process.exit(2); }
  const raw = JSON.parse(fs.readFileSync(F, 'utf8'));
  const R = run(raw.spec || raw, { h: opt('h', 0.08), T: opt('t', 20), vMax: opt('vmax', 22), seed: opt('seed', 7) });
  const st = R.stats;
  console.log('grid ' + st.dims.join('x') + ' (' + st.cells + ' cells, ' + st.occupied + ' airframe) in ' + st.msGrid + ' ms; run ' + st.msAll + ' ms; attitude ' + st.a0.toFixed(1) + ' deg' + (st.tail ? ' (tail-dragger)' : ''));
  console.log('contacts ' + st.contacts.map(c => c.name + ' [' + [c.x, c.y, c.z].map(v => v.toFixed(2)) + '] R ' + c.R.toFixed(2)).join('; '));
  console.log('thrown ' + st.emitted + ', hits ' + st.hits + ', mass ' + st.mass.toFixed(1) + ', coat ' + st.coat.toFixed(3));
  const grp = (lab, nx, ny, nz) => lab.replace(/:.*?(edLeg|edSurf_flap|edHinge_flap|edSurf_ail|edWheel)/, ':$1').split(/[LRT_]?$/)[0] + (nz > 0.5 ? ' (top)' : nz < -0.5 ? ' (under)' : ny < -0.5 ? ' (front)' : ny > 0.5 ? ' (back)' : ' (side)');
  const C = coverBy(R, grp);
  Object.keys(C).sort((a, b) => C[b].mean - C[a].mean).slice(0, 40).forEach(k => console.log('  ' + k.padEnd(44) + ' mean ' + C[k].mean.toFixed(3) + '  max ' + C[k].max.toFixed(2) + '  area ' + C[k].area.toFixed(2) + ' m2'));
}
