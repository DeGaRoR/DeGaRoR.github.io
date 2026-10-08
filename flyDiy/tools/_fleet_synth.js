// _fleet_synth.js - A SYNTHETIC FLEET STORE for the node gates (G2225, FLEET-STAND). The node page has no GPU to bake
// with (the recording GL reads back no pixels) and no IndexedDB, so a gate that wants the fleet DRAWN hands parked.js
// this store: get(key) answers the slot's bake made on demand - a box soup as all three rungs (each ONE mesh on ONE
// atlas, as a real bake's are), deterministic atlases, packed in the cook's own container under the slot's REAL
// signature (fleetSig of its spec as the page reads it) - so fleetLoad decodes it and the prop stands, the fleet ladder
// and the count apply, and every per-frame count (draws, GL calls, uniforms, programs, frustum tests) is a real prop's;
// only its triangles are the box's. Used by FRAMECOST_FLEET=1 and INSTANT --fleet.
'use strict';
function box(x0, y0, z0, x1, y1, z1, n) {
  const pos = [], nrm = [], idx = [];
  const face = (o, u, v, N) => {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = (a, b) => [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b];
      const a = p(i / n, j / n), b = p((i + 1) / n, j / n), c = p((i + 1) / n, (j + 1) / n), d = p(i / n, (j + 1) / n);
      for (const q of [a, b, c, a, c, d]) { idx.push(pos.length / 3); pos.push(...q); nrm.push(...N); }
    }
  };
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  face([x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1]); face([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], [0, 0, -1]);
  face([x1, y0, z1], [0, 0, -dz], [0, dy, 0], [1, 0, 0]); face([x0, y0, z0], [0, 0, dz], [0, dy, 0], [-1, 0, 0]);
  face([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], [0, 1, 0]); face([x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0]);
  return { pos, nrm, idx };
}
// the bake's data in realm R's typed arrays (the page's own, so its decoder's instanceof checks hold)
function synthBake(R, seed) {
  const g = box(-3, 0, -0.5, 3, 1.4, 0.5, 2), S = 16, n = S * S;
  let q = seed >>> 0; const rnd = () => (q = (q * 1103515245 + 12345) >>> 0) >>> 24;
  const T = () => { const t = new R.Uint8Array(n * 4); for (let i = 0; i < n; i++) { t[i * 4] = rnd(); t[i * 4 + 1] = rnd(); t[i * 4 + 2] = rnd(); t[i * 4 + 3] = 255; } return t; };
  const nv = g.pos.length / 3, nrm = new R.Int8Array(nv * 3), uv = new R.Float32Array(nv * 2);
  for (let i = 0; i < nv * 3; i++) nrm[i] = Math.round(g.nrm[i] * 127);
  for (let i = 0; i < nv; i++) { uv[i * 2] = (i % 13) / 13; uv[i * 2 + 1] = (i % 7) / 7; }
  const L = () => ({ pos: new R.Float32Array(g.pos), nrm: new R.Int8Array(nrm), uv: new R.Float32Array(uv), idx: new R.Uint32Array(g.idx) });
  return { S, tex: [T(), T(), T()], cc: true, ccR: 0.2, ms: 1, stats: { charts: 1 }, L: [L(), L(), L()] };
}
// the store: { get, put, gets, made } - PW the page's window
function fleetStore(PW) {
  const m = new Map(), st = { gets: 0, made: 0 };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  st.get = key => {
    st.gets++;
    if (m.has(key)) return PW.Promise.resolve(m.get(key));
    const K = PW.PARKED, spec = K.specOf(key);
    if (!spec) return PW.Promise.resolve(null);
    const G = PW.GARAGE_SPEC, sig = K.fleetSig(spec, G && G.slotImages ? G.slotImages(key.slice(5)) : null);
    const u8 = K.cookEncode({ key, sig, build: 'synth', stance: { pitch: 0, lift: 0 }, hitbox: null, tris: 0, data: synthBake(PW, hash(key)) });
    const v = { sig, n: u8.length, bytes: u8, when: 0 };
    m.set(key, v); st.made++;
    return PW.Promise.resolve(v);
  };
  st.put = (k, v) => { m.set(k, v); return PW.Promise.resolve(); };
  return st;
}
module.exports = { box, synthBake, fleetStore };
