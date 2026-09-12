// _boom_gen.js — THE TWIN BOOM'S OWN TUBE (G267, the user: "their end toward
// the wing should be profiled, customizable like the nose cone (from ogival
// to conical). Their other end should offer the same thing. We should be
// able to control their profile (square, round), their vertical and
// horizontal thickness at fore and aft ends, and the type of cap").
//
// A boom is a LOFT along one axis: a straight body whose section goes from
// (wF x hF) at the wing end to (wA x hA) at the tail end, a FAIRING at each
// end that shrinks that section over its own length — cone to ogive — and a
// CAP that closes it: to a point, flat, or round. The section is a
// superellipse, round at `square` 0 and near-square at 1 (exponent 2 -> 10).
//
// Pure geometry, no THREE: `boomMesh` returns positions, indices and uvs the
// wing layer wraps in a BufferGeometry, and `boomSection` is the same loft
// read as numbers (half-width and half-height at a station) for the fin, the
// stab, the join and the pins. Loads in node (require) and in the browser
// (window.BOOM_GEN); GATE JOIN holds the mesh closed and the loft honest.
//
//   boomMesh(o)     o = { len, wF, hF, wA, hA, square,
//                         nose: { len, k, cap }, tail: { len, k, cap },
//                         seg }
//                   -> { pos: Float32Array (x, y, u), idx: Uint32Array,
//                        uv: Float32Array, u0, u1 }
//                   u runs along the boom: 0 at the tail end of the body,
//                   `len` at the wing end; the tail fairing is u < 0, the
//                   wing fairing u > len. x is lateral, y up, about the axis.
//   boomSection(o, u) -> { a: half-width, b: half-height } (0 past the caps)
//   BOOM_CAPS       the cap names, in row order: point, flat, round
'use strict';
(() => {
const BOOM_CAPS = ['point', 'flat', 'round'];

// the fairing's scale at t (0 at the body, 1 at its far end): a cone is a
// straight line, an ogive a quarter-ellipse (tangent at the body, vertical
// at the tip); k blends them. The cap says where the line stops and how the
// end is closed:
//   point  runs to scale 0 — a sharp tip (cone or ogive)
//   flat   stops at 0.40 of the section and a disc closes it (truncated)
//   round  stops at 0.55 and a quarter-dome of that size closes it
const capOf = c => (typeof c === 'string' ? c : BOOM_CAPS[Math.round(+c || 0)]) || 'point';
const fairScale = (t, k) => {
  const tt = Math.max(0, Math.min(1, t));
  const cone = 1 - tt, ogive = Math.sqrt(Math.max(0, 1 - tt * tt));
  return (1 - k) * cone + k * ogive;
};
// the stations of one fairing, from the body outward: [{d, s}] with d the
// distance from the body end (>= 0) and s the section scale; the last
// station is the closing one (s 0 = an apex, s > 0 = a disc)
function fairStations(f, ref) {
  const L = Math.max(0, +f.len || 0), k = Math.max(0, Math.min(1, +f.k || 0));
  const cap = capOf(f.cap);
  const out = [];
  if (L <= 1e-4) { out.push({ d: 0, s: 1, close: true }); return out; }
  const N = 8;
  const sEnd = cap === 'point' ? 0 : cap === 'flat' ? 0.40 : 0.55;
  // the taper runs until the scale reaches sEnd (a point runs the whole way)
  let tEnd = 1;
  if (sEnd > 0) {
    // bisect the scale function for the t at which it reaches sEnd
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = 0.5 * (lo + hi); if (fairScale(m, k) > sEnd) lo = m; else hi = m; }
    tEnd = hi;
  }
  for (let i = 0; i <= N; i++) {
    const t = tEnd * i / N;
    out.push({ d: L * t, s: Math.max(0, fairScale(t, k)) });
  }
  if (cap === 'point') { out[out.length - 1].s = 0; out[out.length - 1].close = true; }
  else if (cap === 'flat') out[out.length - 1].close = true;
  else {
    // a quarter-dome over the remaining size: its length is the end's own
    // half-size (reference `ref`, the section's mean half-extent) times sEnd
    const dome = Math.max(0.01, ref * sEnd);
    const d0 = out[out.length - 1].d, s0 = out[out.length - 1].s;
    const M = 5;
    for (let j = 1; j <= M; j++) {
      const q = j / M;
      out.push({ d: d0 + dome * Math.sin(0.5 * Math.PI * q), s: s0 * Math.cos(0.5 * Math.PI * q) });
    }
    out[out.length - 1].s = 0; out[out.length - 1].close = true;
  }
  return out;
}

// the whole loft as stations along u: [{u, a, b, close}] tail end first
function boomStations(o) {
  const len = Math.max(0.05, +o.len || 1);
  const wF = Math.max(0.01, +o.wF || 0.16), hF = Math.max(0.01, +o.hF || wF);
  const wA = Math.max(0.01, +o.wA || wF), hA = Math.max(0.01, +o.hA || wA);
  const nose = o.nose || {}, tail = o.tail || {};
  const st = [];
  const aT = fairStations(tail, 0.25 * (wA + hA));
  for (let i = aT.length - 1; i >= 0; i--)
    st.push({ u: -aT[i].d, a: 0.5 * wA * aT[i].s, b: 0.5 * hA * aT[i].s, close: !!aT[i].close && i === aT.length - 1 });
  // the body: stations at a pitch that keeps the loft smooth. THE COLLAR
  // (G267.1): the section swells by `collar` over the last 0.35 m before
  // the wing end — the fairing a boom wears where it meets the wing skin
  const NB = Math.max(2, Math.round(len / 0.25));
  const col = Math.max(0, Math.min(1, +o.collar || 0));
  const swell = u => {
    if (!(col > 0)) return 1;
    const d = len - u;                        // metres short of the wing end
    if (d < 0 || d > 0.35) return 1;
    const q = 1 - d / 0.35;                   // 0 at the collar's start, 1 at the wing
    return 1 + 0.35 * col * q * q * (3 - 2 * q);
  };
  const bodyU = [];
  for (let i = 1; i < NB; i++) bodyU.push(len * i / NB);
  if (col > 0) for (const d of [0.35, 0.25, 0.15, 0.07]) bodyU.push(len - d);
  bodyU.sort((p, q) => p - q);
  for (const u of bodyU) {
    if (u <= 0 || u >= len) continue;
    const t = u / len, s = swell(u);
    st.push({ u, a: 0.5 * (wA + (wF - wA) * t) * s, b: 0.5 * (hA + (hF - hA) * t) * s });
  }
  const sW = swell(len);
  const aN = fairStations(nose, 0.25 * (wF + hF) * sW);
  for (let i = 0; i < aN.length; i++)
    st.push({ u: len + aN[i].d, a: 0.5 * wF * sW * aN[i].s, b: 0.5 * hF * sW * aN[i].s, close: !!aN[i].close && i === aN.length - 1 });
  // the first body station (u 0) is the tail fairing's d 0, the last (u len)
  // the nose fairing's — both already in the list
  return st;
}

function boomSection(o, u) {
  const st = boomStations(o);
  if (u <= st[0].u || u >= st[st.length - 1].u) return { a: 0, b: 0 };
  for (let i = 0; i < st.length - 1; i++) {
    const p = st[i], q = st[i + 1];
    if (u >= p.u && u <= q.u) {
      const t = q.u > p.u ? (u - p.u) / (q.u - p.u) : 0;
      return { a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t };
    }
  }
  return { a: 0, b: 0 };
}

// the superellipse ring: exponent 2 at square 0 (an ellipse), 10 at 1
function ring(a, b, square, seg, out) {
  const n = 2 + 8 * Math.max(0, Math.min(1, +square || 0));
  const e = 2 / n;
  for (let j = 0; j < seg; j++) {
    const th = 2 * Math.PI * j / seg;
    const c = Math.cos(th), s = Math.sin(th);
    out.push(a * Math.sign(c) * Math.pow(Math.abs(c), e),
             b * Math.sign(s) * Math.pow(Math.abs(s), e));
  }
}

function boomMesh(o) {
  const seg = Math.max(8, Math.round(+o.seg || 28));
  const st = boomStations(o);
  const pos = [], uv = [], idx = [];
  const rows = [];                       // vertex index of each ring's first vertex, or the apex
  const uSpan = st[st.length - 1].u - st[0].u || 1;
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    const isApex = s.close && s.a < 1e-4 && s.b < 1e-4;
    if (isApex) {
      rows.push({ apex: pos.length / 3 });
      pos.push(0, 0, s.u); uv.push(0.5, (s.u - st[0].u) / uSpan);
      continue;
    }
    const r = [];
    ring(s.a, s.b, o.square, seg, r);
    const base = pos.length / 3;
    for (let j = 0; j < seg; j++) { pos.push(r[2 * j], r[2 * j + 1], s.u); uv.push(j / seg, (s.u - st[0].u) / uSpan); }
    rows.push({ base });
    // a FLAT close: a disc fanned from a centre vertex on the ring's plane
    if (s.close) {
      const c = pos.length / 3;
      pos.push(0, 0, s.u); uv.push(0.5, (s.u - st[0].u) / uSpan);
      rows[rows.length - 1].disc = c;
    }
  }
  // the walls between rings; an apex fans to its neighbour ring
  for (let i = 0; i < rows.length - 1; i++) {
    const A = rows[i], B = rows[i + 1];
    if (A.apex != null && B.base != null) {
      for (let j = 0; j < seg; j++) idx.push(A.apex, B.base + j, B.base + (j + 1) % seg);
    } else if (B.apex != null && A.base != null) {
      for (let j = 0; j < seg; j++) idx.push(B.apex, A.base + (j + 1) % seg, A.base + j);
    } else if (A.base != null && B.base != null) {
      for (let j = 0; j < seg; j++) {
        const a0 = A.base + j, a1 = A.base + (j + 1) % seg, b0 = B.base + j, b1 = B.base + (j + 1) % seg;
        idx.push(a0, b0, b1, a0, b1, a1);
      }
    }
  }
  // the discs: the first row faces -u, the last +u
  const first = rows[0], last = rows[rows.length - 1];
  if (first.disc != null) for (let j = 0; j < seg; j++) idx.push(first.disc, first.base + j, first.base + (j + 1) % seg);
  if (last.disc != null) for (let j = 0; j < seg; j++) idx.push(last.disc, last.base + (j + 1) % seg, last.base + j);
  // OUTWARD (G268.1): the walls were wound with their normals pointing INTO the
  // tube — consistent (closed) and inside out. The editor's silhouette rim
  // grows a shell along the normals, so it grew inward and no outline ever
  // showed on a boom; the paint was lit on the wrong side of every face, so
  // the booms never matched the fuselage's colour; DoubleSide hid it. Every
  // triangle turned over here, once, and the check below holds the sign.
  for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx), uv: Float32Array.from(uv),
           u0: st[0].u, u1: st[st.length - 1].u, stations: st };
}

// every edge on exactly two triangles, with opposite winding: the closure a
// gate can hold (the same test the window knife is held to)
function boomClosed(m) {
  const seen = new Map();
  const n = m.idx.length / 3;
  for (let t = 0; t < n; t++) {
    const a = m.idx[3 * t], b = m.idx[3 * t + 1], c = m.idx[3 * t + 2];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? p + ':' + q : q + ':' + p;
      const e = seen.get(k) || { fwd: 0, rev: 0 };
      if (p < q) e.fwd++; else e.rev++;
      seen.set(k, e);
    }
  }
  for (const e of seen.values()) if (e.fwd !== 1 || e.rev !== 1) return false;
  return true;
}

// every wall face's normal points away from the axis (a gate can hold the sign)
function boomOutward(m) {
  let bad = 0;
  for (let t = 0; t + 2 < m.idx.length; t += 3) {
    const P = i => [m.pos[3 * i], m.pos[3 * i + 1], m.pos[3 * i + 2]];
    const A = P(m.idx[t]), B2 = P(m.idx[t + 1]), C2 = P(m.idx[t + 2]);
    const u = [B2[0] - A[0], B2[1] - A[1], B2[2] - A[2]], v = [C2[0] - A[0], C2[1] - A[1], C2[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const cx = (A[0] + B2[0] + C2[0]) / 3, cy = (A[1] + B2[1] + C2[1]) / 3;
    const d = n[0] * cx + n[1] * cy;
    if (Math.abs(d) > 1e-9 && d < 0) bad++;
  }
  return bad === 0;
}
const API = { boomMesh, boomSection, boomStations, boomClosed, boomOutward, BOOM_CAPS, fairScale };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.BOOM_GEN = API;
})();
