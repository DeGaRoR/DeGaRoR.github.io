// _cityhost_fixture.js - A SMALL CITY PACK FOR GATE CITYHOST (G3421, CITY-B). NOT the cook: CITY-A owns the format
// (futureDesigns/CITY-PACK-FORMAT.md v1) and its cook (tools/city_cook.js, on claude/city-a). GATE CITYHOST runs the town host
// on the real pack whenever src/core/city_packs.json is in the tree; this file is what lets the gate stand on a branch without
// it: the same v1 layout (512 m cells, the 12 B far vertex quantized in the cell's box, the TKIN kit section in the world
// frame, 20 B props), written from what IS committed - the town kit's pack and Jolene's instance table (media/townkit/).
//
//   cookCity({ KIT, pack, inst, cell, props, lots }) -> { town (a manifest entry), raws: [Buffer a cell], P, I }
//     KIT   src/viewer/townkit.js      pack / inst   the kit pack and the instance file, gunzipped (Uint8Array)
//     the far shell of a row: its archetype's box rung (lod 2) at its record's transform, the walls bucket; a yard quad a row
//     in the lots bucket; no roads; two props a row (the fixture's keys 'fx_box' / 'fx_car', the car flagged to cast)
'use strict';
const zlib = require('zlib');

const MAGIC = 0x59544943, V = 1, VSTRIDE = 12, PSTRIDE = 20;
const LOD = { nearIn: 950, nearOut: 1050, kitE0: 150, kitE1: 1200, propFar: 600, castFar: 600, farGain: 0.2 };

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
    const V3 = [], N3 = [], C3 = [], Bk = [], walls = [], lots = [];
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
      for (let t = 0; t < T.idx.length; t++) walls.push(base + T.idx[t]);
    }
    for (const i of list) {
      const r = I.rows[i], A = H0.archetypes[r.arch], hx = A.foot.L / 2 + 6, hz = A.foot.w / 2 + 6, cy = Math.cos(r.yaw), sy = Math.sin(r.yaw), b = V3.length / 3;
      for (const [ax, az] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) put(r.x + cy * ax + sy * az, r.y + 0.08, r.z - sy * ax + cy * az, 0, 1, 0, [120, 128, 92], 3);
      lots.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const n = V3.length / 3, box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let v = 0; v < n; v++) for (let a = 0; a < 3; a++) { box[a] = Math.min(box[a], V3[v * 3 + a]); box[3 + a] = Math.max(box[3 + a], V3[v * 3 + a]); }
    const vb = Buffer.alloc(n * VSTRIDE), q = (x, a) => Math.max(0, Math.min(65535, Math.round((x - box[a]) / Math.max(1e-9, box[3 + a] - box[a]) * 65535)));
    for (let v = 0; v < n; v++) { const o2 = v * VSTRIDE; for (let a = 0; a < 3; a++) vb.writeUInt16LE(q(V3[v * 3 + a], a), o2 + a * 2);
      const e = octEnc(N3[v * 3], N3[v * 3 + 1], N3[v * 3 + 2]); vb.writeInt8(e[0], o2 + 6); vb.writeInt8(e[1], o2 + 7);
      vb[o2 + 8] = C3[v * 3]; vb[o2 + 9] = C3[v * 3 + 1]; vb[o2 + 10] = C3[v * 3 + 2]; vb[o2 + 11] = Bk[v]; }
    const all = walls.concat(lots), wide = n > 65535, ibuf = Buffer.alloc(all.length * (wide ? 4 : 2));
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
    // the cell file
    const blobs = []; let off = 0; const sec = {};
    for (const [k, b] of [['vb', vb], ['ib', ibuf], ['kit', kit], ['props', props]]) { sec[k] = [off, b.length]; const pad = (4 - (b.length & 3)) & 3; blobs.push(b); if (pad) blobs.push(Buffer.alloc(pad)); off += b.length + pad; }
    const head = Buffer.from(JSON.stringify({ magic: 'CITY', v: V, town: 'fixture', cell: [ci, cj], size: S, box,
      far: { verts: n, tris: all.length / 3, stride: VSTRIDE, index: wide ? 32 : 16,
             buckets: [{ name: 'walls', id: 0, first: 0, count: walls.length }, { name: 'roofs', id: 1, first: walls.length, count: 0 }, { name: 'roads', id: 2, first: walls.length, count: 0 }, { name: 'lots', id: 3, first: walls.length, count: lots.length }],
             draws: [{ mat: 'shell', first: 0, count: walls.length }, { mat: 'ground', first: walls.length, count: lots.length }] },
      plots: list.map((i, k) => [String(plotsK[k][0]), plotsK[k][2], I.rows[i].out ? -1 : k, -1, 1]), uniques: [], objects: [],
      kit: { rows: list.length, stride }, props: { rows: list.length * 2, stride: PSTRIDE }, sec }));
    const pre = Buffer.alloc(12); pre.writeUInt32LE(MAGIC, 0); pre.writeUInt32LE(V, 4); pre.writeUInt32LE(head.length, 8);
    raws.push(Buffer.concat([pre, head, Buffer.alloc((4 - ((12 + head.length) & 3)) & 3)].concat(blobs)));
    entries.push({ c: [ci, cj], box, plots: list.length, kitRows: list.length });
  }
  const town = { id: 'fixture', island: 'jolene', prefix: 'mk_', variant: 'town', cell: S, frame: 'world', lod: Object.assign({}, LOD), propKeys: ['fx_box', 'fx_car'], archetypes: H0.archetypes.length, cells: entries };
  return { town, raws, P, I };
}
const gunzip = b => (b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b);
module.exports = { cookCity, gunzip, LOD };
