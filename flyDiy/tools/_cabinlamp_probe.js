// _cabinlamp_probe.js (CABIN-CRAFT, 2026-11-02) - A FUNCTION BODY, not a module: tools/_load_build.js runs it in the
// page context after the load chain's last build (FLYDIY_JOIN_PROBE=<this file>). It reports WHERE EVERY CABIN LAMP
// SITS AND ON WHAT: the flood and the passenger lamps the light layer placed (window.CAGE_LIGHT.sites), each with its
// rung (roof / bulkhead / shoulder / ...), the materials of the cage faces its flange touches (within 25 mm of the
// fitting's back), whether any of those is glass, whether glass stands over it (any glass face straight up the
// lamp's own axis reversed, within 0.35 m) and whether glass is within reach of its rim (a glass vertex within the
// lamp's radius + 4 cm). Read by GATE CABINLAMP (tools/_cabinlamp_check.js).
const L = window.CAGE_LIGHT, UI = window.CAGE_UI, G2 = window.CAGE2;
if (!L || !L.sites) return { err: 'no light layer' };
const M = UI && UI.MS;
if (!M || !M.V || !M.F) return { err: 'no cage mesh' };
const k = (G2 ? G2.CAGE_UNIT : 1) * ((UI.P && UI.P.planeScale) || 1);
const GLASS = G2 && G2.CAGE_GLASS_MATS ? G2.CAGE_GLASS_MATS
  : new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'drawnPane', 'skyWindows']);
const V = M.V.map(p => [p[0] * k, p[1] * k, p[2] * k]);
// point-to-triangle distance (Ericson's closest point), fans for polygons
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function closest(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
// Moller-Trumbore, the ray's distance or null
function rayTri(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), pv = cross(d, e2), det = dot(e1, pv);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, tv = sub(o, a), u = dot(tv, pv) * inv;
  if (u < 0 || u > 1) return null;
  const qv = cross(tv, e1), v = dot(d, qv) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, qv) * inv;
  return t > 1e-4 ? t : null;
}
function survey(site, kind) {
  const p = site.p, ax = site.ax || [0, -1, 0];
  const w = (L.LIGHTS && L.LIGHTS[kind] && L.LIGHTS[kind].w) || 0.06;
  // the fitting's back (its flange): 0.62 r behind the face, along -ax
  const back = [p[0] - ax[0] * 0.62 * w / 2, p[1] - ax[1] * 0.62 * w / 2, p[2] - ax[2] * 0.62 * w / 2];
  const touch = {}, up = [-ax[0], -ax[1], -ax[2]];
  let dMin = 1e9, mMin = null, over = null, near = null;
  const reach = w / 2 + 0.04;
  for (const f of M.F) {
    if (f.v.length < 3) continue;
    for (let i = 1; i + 1 < f.v.length; i++) {
      const a = V[f.v[0]], b = V[f.v[i]], c = V[f.v[i + 1]];
      const q = closest(back, a, b, c), d = Math.hypot(q[0] - back[0], q[1] - back[1], q[2] - back[2]);
      if (d < 0.025) touch[f.m] = Math.min(touch[f.m] == null ? 1e9 : touch[f.m], +d.toFixed(4));
      // LINER-BACK (10 Nov): a lined skin and its lining are one surface (the lining is the skin's back face, flagged
      // back, on copies of the same vertices), so the flange is as near to both; the lamp sits on the lining, the
      // inside face - a tie goes to the back face (else a metal cabin's roof lamp read 'aluminium', the twin2 red)
      if (d < dMin - 1e-5 || (f.back && d < dMin + 1e-5)) { dMin = Math.min(d, dMin); mMin = f.m; }
      if (!GLASS.has(f.m)) continue;
      const t = rayTri(p, up, a, b, c);
      if (t != null && t < 0.35 && (!over || t < over.t)) over = { t: +t.toFixed(3), m: f.m };
    }
    if (GLASS.has(f.m)) for (const vi of f.v) {
      const q = V[vi], d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      if (d < reach && (!near || d < near.d)) near = { d: +d.toFixed(3), m: f.m };
    }
  }
  const mats = Object.keys(touch);
  return { rung: site.rung || null, p: p.map(v => +v.toFixed(3)), ax: ax.map(v => +v.toFixed(3)),
           on: mMin, onD: +dMin.toFixed(4), touch: mats, glassTouch: mats.filter(m => GLASS.has(m)),
           over: over ? over.m : null, overT: over ? over.t : null, glassOver: !!over,
           near: near ? near.m : null, nearD: near ? near.d : null, glassNear: !!near };
}
const S = L.sites, out = { canopy: UI.P ? +UI.P.canopy || 0 : 0, skylight: UI.P ? +UI.P.skylight || 0 : 0,
                           bubbleTop: UI.P ? +UI.P.bubble || 0 : 0, lamps: [] };
if (S.flood) out.lamps.push(Object.assign({ kind: 'flood' }, survey(S.flood, 'flood')));
for (const s of (S.pax || [])) out.lamps.push(Object.assign({ kind: 'pax' }, survey(s, 'pax')));
const glass = {};
for (const f of M.F) if (GLASS.has(f.m)) glass[f.m] = (glass[f.m] || 0) + 1;
out.glassFaces = glass;
return out;
