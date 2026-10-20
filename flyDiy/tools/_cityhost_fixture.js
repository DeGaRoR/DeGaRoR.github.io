// _cityhost_fixture.js - A SMALL CITY PACK FOR GATE CITYHOST (G3421, CITY-B). NOT the cook: CITY-A owns the format
// (futureDesigns/CITY-PACK-FORMAT.md v1) and its cook (tools/city_cook.js, on claude/city-a). GATE CITYHOST runs the town host
// on the real pack whenever src/core/city_packs.json is in the tree; this file is what lets the gate stand on a branch without
// it: the same v1 layout (512 m cells, the 12 B far vertex quantized in the cell's box, the TKIN kit section in the world
// frame, 20 B props; v2 G3405: the shells alone with their owners' ranges, the 32 B lot rows, the town's lot kit), written from
// what IS committed - the town kit's pack and Jolene's instance table (media/townkit/).
//
//   cookCity({ KIT, pack, inst, cell }) -> { town (a manifest entry), raws: [Buffer a cell], lotKit (Buffer), P, I }
//     KIT   src/viewer/townkit.js      pack / inst   the kit pack and the instance file, gunzipped (Uint8Array)
//     the far shell of a row: its archetype's box rung (lod 2) at its record's transform, the walls bucket, its owner's range;
//     two props a row (the fixture's keys 'fx_box' / 'fx_car', the car flagged to cast); THE LOTS: a fence round each row's
//     footprint + 6 m - posts every bay, rail bays (one side on a 0.4 m rise: the shear), a gate on the front, an old-fence
//     stretch on every fifth plot - and two worn ground pieces (a path, a pad); every fourth plot is a UNIQUE plot (flag 2:
//     its lot rows and props are the unique path's, never the pack's)
'use strict';
const zlib = require('zlib');

const MAGIC = 0x59544943, V = 2, VSTRIDE = 12, PSTRIDE = 20, LSTRIDE = 32, LKMAGIC = 0x544b544c;
const LOD = { far: 1000, nearIn: 950, nearOut: 1050, kitE0: 150, kitE1: 1200, propFar: 600, lotFar: 400, castFar: 600, farGain: 0.2 };
// THE FIXTURE'S LOT KIT: a post, a rail bay, a gate leaf (meshes: boxes, role 0 post / 1 deck), an old-fence stretch (the prop
// fx_box), two worn grounds
const box = (x0, y0, z0, x1, y1, z1, role) => { const P = [], N = [], U = [], R = [], I = [];
  const f = (o, a, b, n) => { const s = P.length / 3; for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(o[0] + a[0] * u + b[0] * v, o[1] + a[1] * u + b[1] * v, o[2] + a[2] * u + b[2] * v); N.push(...n); U.push(u, v); R.push(role); } I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  f([x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1]); f([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], [0, 0, -1]);
  f([x1, y0, z1], [0, 0, -dz], [0, dy, 0], [1, 0, 0]); f([x0, y0, z0], [0, 0, dz], [0, dy, 0], [-1, 0, 0]);
  f([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], [0, 1, 0]); f([x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0]);
  return { P, N, U, R, I }; };
const join = (...bs) => { const o = { P: [], N: [], U: [], R: [], I: [] }; for (const b of bs) { const s = o.P.length / 3; o.P.push(...b.P); o.N.push(...b.N); o.U.push(...b.U); o.R.push(...b.R); o.I.push(...b.I.map(i => i + s)); } return o; };
const LK_PIECES = [
  { name: 'post:rail:0', kind: 'post', style: 'rail', variant: 0, len: 1, mesh: box(-0.05, 0, -0.05, 0.05, 1.15, 0.05, 0) },
  { name: 'bay:rail:0', kind: 'bay', style: 'rail', variant: 0, len: 2.4, mesh: join(box(0, 0.38, -0.03, 2.4, 0.46, 0.03, 1), box(0, 0.86, -0.03, 2.4, 0.94, 0.03, 1)) },
  { name: 'gate:rail:0', kind: 'gate', style: 'rail', variant: 0, len: 1, mesh: join(box(0, 0.1, -0.02, 1, 0.2, 0.02, 1), box(0, 0.9, -0.02, 1, 1.0, 0.02, 1), box(0, 0.1, -0.02, 0.08, 1.0, 0.02, 0)) },
  { name: 'old:0', kind: 'old', style: 'old', variant: 0, len: 3, prop: 0 },
  { name: 'ground:dirt', kind: 'ground', style: 'path', variant: 0, len: 1, tex: 'dirt', fade: 0.6 },
  { name: 'ground:dry', kind: 'ground', style: 'pad', variant: 0, len: 1, tex: 'dry', fade: 0.9 },
];
function octEnc2(x, y, z) { return octEnc(x, y, z); }
function lotKit() {
  const blobs = []; let off = 0;
  const put = b => { const pad = (4 - (b.length & 3)) & 3, at = off; blobs.push(b); if (pad) blobs.push(Buffer.alloc(pad)); off += b.length + pad; return [at, b.length]; };
  const pieces = LK_PIECES.map((P, id) => {
    const out = { id, name: P.name, kind: P.kind, style: P.style, variant: P.variant, len: P.len };
    if (P.prop !== undefined) out.prop = P.prop; if (P.tex) { out.tex = P.tex; out.fade = P.fade; }
    if (!P.mesh) { out.tris = 0; out.verts = 0; return out; }
    const M = P.mesh, n = M.P.length / 3, bx = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) { bx[a] = Math.min(bx[a], M.P[v * 3 + a]); bx[3 + a] = Math.max(bx[3 + a], M.P[v * 3 + a]); }
    const uv = [0, 0, 1, 1], vb = Buffer.alloc(n * 16);
    for (let v = 0; v < n; v++) { const o = v * 16;
      for (let a = 0; a < 3; a++) vb.writeUInt16LE(Math.round((M.P[v * 3 + a] - bx[a]) / Math.max(1e-9, bx[3 + a] - bx[a]) * 65535), o + a * 2);
      const e = octEnc2(M.N[v * 3], M.N[v * 3 + 1], M.N[v * 3 + 2]); vb.writeInt8(e[0], o + 6); vb.writeInt8(e[1], o + 7);
      vb.writeUInt16LE(Math.round(M.U[v * 2] * 65535), o + 8); vb.writeUInt16LE(Math.round(M.U[v * 2 + 1] * 65535), o + 10); vb[o + 12] = 230; vb[o + 13] = M.R[v]; }
    const ib = Buffer.alloc(M.I.length * 2); M.I.forEach((x, k) => ib.writeUInt16LE(x, k * 2));
    return Object.assign(out, { tris: M.I.length / 3, verts: n, box: bx, uv, vb: put(vb), ib: put(ib) });
  });
  const head = Buffer.from(JSON.stringify({ magic: 'LTKT', v: 1, roles: ['post', 'deck'], vstride: 16, pieces }));
  const pre = Buffer.alloc(12); pre.writeUInt32LE(LKMAGIC, 0); pre.writeUInt32LE(1, 4); pre.writeUInt32LE(head.length, 8);
  return { raw: Buffer.concat([pre, head, Buffer.alloc((4 - ((12 + head.length) & 3)) & 3)].concat(blobs)), pieces };
}

function octEnc(x, y, z) {
  const l = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1; let u = x / l, v = z / l;
  if (y / l < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
  return [Math.round(u * 127), Math.round(v * 127)];
}
function cookCity(o) {
  const KIT = o.KIT, S = o.cell || 512;
  const P = KIT.decodePack(o.pack), I = KIT.decodeInstances(o.inst), H0 = P.header;
  const ib = Buffer.from(o.inst.buffer, o.inst.byteOffset, o.inst.byteLength);
  const hl = ib.readUInt32LE(0), stride = ib.readUInt32LE(4), at0 = 8 + hl + ((4 - ((8 + hl) & 3)) & 3);
  const kindAll = H0.bags.map(() => 'plain');
  const LODS = new Map();
  const lodOf = r => { const k = r.arch * 2 + (r.mirror ? 1 : 0); let T = LODS.get(k); if (!T) { const A = H0.archetypes[r.arch];
    T = KIT.decodeLod(P, A.lods[A.lods.length - 1], 2, kindAll).plain; if (r.mirror) T = KIT.mirrorOf(T); LODS.set(k, T); } return T; };
  // the rows by cell (a row's own point), in table order within a cell
  const byCell = new Map();
  I.rows.forEach((r, i) => { const k = Math.floor(r.x / S) + ',' + Math.floor(r.z / S); if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(i); });
  const keys = [...byCell.keys()].sort((a, b) => { const [ai, aj] = a.split(',').map(Number), [bi, bj] = b.split(',').map(Number); return ai - bi || aj - bj; });
  const raws = [], entries = [];
  for (const key of keys) {
    const list = byCell.get(key), [ci, cj] = key.split(',').map(Number);
    // the far mesh in world metres: the walls bucket (each row's box rung), the lots bucket (a yard quad a row)
    const V3 = [], N3 = [], C3 = [], Bk = [], walls = [], owners = [];
    const put = (x, y, z, nx, ny, nz, c, b) => { V3.push(x, y, z); N3.push(nx, ny, nz); C3.push(c[0], c[1], c[2]); Bk.push(b); return V3.length / 3 - 1; };
    for (const i of list) {
      const r = I.rows[i], A = H0.archetypes[r.arch], g = r.ground, T = lodOf(r);
      const [c0, c1, c2, c3] = r.mirror ? [g[1], g[0], g[3], g[2]] : g, Lf = A.foot.L, Wf = A.foot.w;
      const fa = (c0 + c1 + c2 + c3) / 4, fb = ((c1 + c2) - (c0 + c3)) / (2 * Lf), fc = ((c2 + c3) - (c0 + c1)) / (2 * Wf), fd = (c0 - c1 + c2 - c3) / (Lf * Wf);
      const cy = Math.cos(r.yaw), sy = Math.sin(r.yaw), sx = r.scale || 1, base = V3.length / 3;
      for (let v = 0; v < T.n; v++) {
        const lx = T.pos[v * 3], lz = T.pos[v * 3 + 2], ly = T.pos[v * 3 + 1] + T.kit[v * 4 + 2] / 255 * (fa + fb * lx + fc * lz + fd * lx * lz), x = lx * sx;
        const nx = T.nrm[v * 4] / 127, ny = T.nrm[v * 4 + 1] / 127, nz = T.nrm[v * 4 + 2] / 127;
        put(r.x + cy * x + sy * lz, r.y + ly, r.z - sy * x + cy * lz, cy * nx + sy * nz, ny, -sy * nx + cy * nz, [176, 160, 140], 0);
      }
      owners.push([0, list.indexOf(i), 0, walls.length, T.idx.length]);
      for (let t = 0; t < T.idx.length; t++) walls.push(base + T.idx[t]);
    }
    const n = V3.length / 3, box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) { box[a] = Math.min(box[a], V3[v * 3 + a]); box[3 + a] = Math.max(box[3 + a], V3[v * 3 + a]); }
    const vb = Buffer.alloc(n * VSTRIDE), q = (x, a) => Math.max(0, Math.min(65535, Math.round((x - box[a]) / Math.max(1e-9, box[3 + a] - box[a]) * 65535)));
    for (let v = 0; v < n; v++) { const o2 = v * VSTRIDE; for (let a = 0; a < 3; a++) vb.writeUInt16LE(q(V3[v * 3 + a], a), o2 + a * 2);
      const e = octEnc(N3[v * 3], N3[v * 3 + 1], N3[v * 3 + 2]); vb.writeInt8(e[0], o2 + 6); vb.writeInt8(e[1], o2 + 7);
      vb[o2 + 8] = C3[v * 3]; vb[o2 + 9] = C3[v * 3 + 1]; vb[o2 + 10] = C3[v * 3 + 2]; vb[o2 + 11] = Bk[v]; }
    const all = walls, wide = n > 65535, ibuf = Buffer.alloc(all.length * (wide ? 4 : 2));
    all.forEach((x, k) => (wide ? ibuf.writeUInt32LE(x, k * 4) : ibuf.writeUInt16LE(x, k * 2)));
    // the kit: a complete TKIN instance file (the rows as the table has them - Jolene's frame is the world's - flag 8 on a house)
    const recs = Buffer.alloc(list.length * stride), plotsK = [];
    list.forEach((i, k) => { ib.copy(recs, k * stride, at0 + i * stride, at0 + (i + 1) * stride); const r = I.rows[i]; if (!r.out) recs[k * stride + 23] |= 8;
      plotsK.push((I.head.plots && I.head.plots[i]) || [null, 0, null]); });
    const kh = Buffer.from(JSON.stringify({ magic: 'TKIN', v: 1, stride, pack: I.head.pack || null, frame: 'world', count: list.length, plots: plotsK }));
    const kpre = Buffer.alloc(8); kpre.writeUInt32LE(kh.length, 0); kpre.writeUInt32LE(stride, 4);
    const kit = Buffer.concat([kpre, kh, Buffer.alloc((4 - ((8 + kh.length) & 3)) & 3), recs]);
    // the props: two a row
    const props = Buffer.alloc(list.length * 2 * PSTRIDE);
    list.forEach((i, k) => { const r = I.rows[i], A = H0.archetypes[r.arch], cy = Math.cos(r.yaw), sy = Math.sin(r.yaw);
      for (let m = 0; m < 2; m++) { const o2 = (k * 2 + m) * PSTRIDE, dz = (m ? -1 : 1) * (A.foot.w / 2 + 3), yaw = ((r.yaw + m) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        props.writeFloatLE(r.x + sy * dz, o2); props.writeFloatLE(r.y, o2 + 4); props.writeFloatLE(r.z + cy * dz, o2 + 8);
        props.writeUInt16LE(Math.round(yaw / (2 * Math.PI) * 65536) & 65535, o2 + 12); props.writeUInt16LE(m, o2 + 14); props.writeUInt16LE(k, o2 + 16);
        props[o2 + 18] = 1 | (m ? 2 : 0); props[o2 + 19] = m ? 1 : 0; } });
    // THE LOTS: a fence round the footprint + 6 m (posts, bays - the +z side on a 0.4 m rise -, a gate in the front bay), an old
    // stretch on every fifth plot, a path and a pad
    const L = [];
    const lrow = (x, y, z, yaw, len, wid, piece, flags, owner, seed, g) => L.push([x, y, z, yaw, len, wid, piece, flags, owner, seed, g]);
    list.forEach((i, k) => { const r = I.rows[i]; if (r.out) return;
      const A = H0.archetypes[r.arch], hx = A.foot.L / 2 + 6, hz = A.foot.w / 2 + 6, cy = Math.cos(r.yaw), sy = Math.sin(r.yaw);
      const W = (ax, az) => [r.x + cy * ax + sy * az, r.z - sy * ax + cy * az];
      const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
      for (let e = 0; e < 4; e++) {
        const a = corners[e], b = corners[(e + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nb = Math.max(1, Math.floor(len / 2.4));
        const wa = W(a[0], a[1]), wb = W(b[0], b[1]), yaw = Math.atan2(-(wb[1] - wa[1]), wb[0] - wa[0]);   // (rotY(yaw) sends +x along the edge)
        const rise = e === 2 ? 0.4 : 0;
        for (let q = 0; q < nb; q++) {
          const t0 = q / nb, px = wa[0] + (wb[0] - wa[0]) * t0, pz = wa[1] + (wb[1] - wa[1]) * t0, bl = len / nb;
          lrow(px, r.y, pz, yaw, 1, 0, 0, 1, k, q, [0, 0, 0, 0]);   // the post
          if (e === 0 && q === 0) lrow(px, r.y, pz, yaw + 0.6, 1, 0, 2, 1, k, q, [0, 0, 0, 0]);   // the gate, swung in
          else if (k % 5 === 0 && e === 1 && q === 0) lrow(px, r.y, pz, yaw, bl, 0, 3, 5, k, q, [0, 0, 0, 0]);   // an old stretch (a prop)
          else lrow(px, r.y, pz, yaw, bl, 0, 1, 1, k, q, [0, rise / nb, rise / nb, 0]);   // the bay
        }
      }
      const f = W(-hx, 0); lrow(f[0], r.y, f[1], r.yaw, 6, 1.2, 4, 2, k, 11, [0, 0.05, 0.05, 0]);
      const g = W(hx * 0.4, -hz * 0.5); lrow(g[0], r.y, g[1], r.yaw, 4, 3, 5, 2, k, 12, [0, -0.03, 0.02, 0.01]);
    });
    const lots = Buffer.alloc(L.length * LSTRIDE);
    L.forEach((q, k) => { const o = k * LSTRIDE, yaw = ((q[3] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      lots.writeFloatLE(q[0], o); lots.writeFloatLE(q[1], o + 4); lots.writeFloatLE(q[2], o + 8); lots.writeUInt16LE(Math.round(yaw / (2 * Math.PI) * 65536) & 65535, o + 12);
      lots.writeUInt16LE(Math.round(q[4] * 100), o + 14); lots.writeUInt16LE(Math.round(q[5] * 100), o + 16); lots[o + 18] = q[6]; lots[o + 19] = q[7];
      lots.writeUInt16LE(q[8], o + 20); lots.writeUInt16LE(q[9], o + 22); for (let c = 0; c < 4; c++) lots.writeInt16LE(Math.round(q[10][c] * 100), o + 24 + c * 2); });
    // the cell file
    const blobs = []; let off = 0; const sec = {};
    for (const [k, b] of [['vb', vb], ['ib', ibuf], ['kit', kit], ['props', props], ['lots', lots]]) { sec[k] = [off, b.length]; const pad = (4 - (b.length & 3)) & 3; blobs.push(b); if (pad) blobs.push(Buffer.alloc(pad)); off += b.length + pad; }
    const head = Buffer.from(JSON.stringify({ magic: 'CITY', v: V, town: 'fixture', cell: [ci, cj], size: S, box,
      far: { verts: n, tris: all.length / 3, stride: VSTRIDE, index: wide ? 32 : 16,
             buckets: [{ name: 'walls', id: 0, first: 0, count: walls.length }, { name: 'roofs', id: 1, first: walls.length, count: 0 }],
             draws: [{ mat: 'shell', first: 0, count: walls.length }], owners },
      // (every fourth plot a UNIQUE plot: flag 2)
      plots: list.map((i, k) => [String(plotsK[k][0]), plotsK[k][2], k, -1, k % 4 === 3 ? 2 : 1]), uniques: [], objects: [],
      kit: { rows: list.length, stride }, props: { rows: list.length * 2, stride: PSTRIDE }, lots: { rows: L.length, stride: LSTRIDE }, sec }));
    const pre = Buffer.alloc(12); pre.writeUInt32LE(MAGIC, 0); pre.writeUInt32LE(V, 4); pre.writeUInt32LE(head.length, 8);
    raws.push(Buffer.concat([pre, head, Buffer.alloc((4 - ((12 + head.length) & 3)) & 3)].concat(blobs)));
    entries.push({ c: [ci, cj], box, plots: list.length, kitRows: list.length, lots: L.length });
  }
  const LKT = lotKit();
  const town = { id: 'fixture', island: 'jolene', prefix: 'mk_', variant: 'town', cell: S, frame: 'world', lod: Object.assign({}, LOD), propKeys: ['fx_box', 'fx_car'], archetypes: H0.archetypes.length,
                 lotKit: { pieces: LKT.pieces }, cells: entries };
  return { town, raws, lotKit: LKT.raw, P, I };
}
const gunzip = b => (b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b);
module.exports = { cookCity, gunzip, LOD };
