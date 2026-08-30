// GATE BAY — the lamp bay's interior cage is a solid, and the lamp fits in it.
//
// G98, and the whole of it came out of the user looking at the screen. They
// drew the cage themselves — "Mine is a quad, and 2 plane following the
// leading edge profile, and done, no need for fancy" — then reported the two
// defects that followed: "there are overlapping faces on the interior sides",
// "we still have the moire ... try moving the interior face outwards by a few
// mm", and "your lamp sticks out a tad. Have this not happen by default".
//
// Three assertions, one per defect, and none of them counts triangles:
//
//   OVERLAP  no two coplanar triangles cover the same area. A correct
//            triangulation of a flat polygon covers it exactly once.
//   INSET    every rib stands clear of the cut's own end plane. This is the
//            one that cured the moire: a rib flush with the cut is coplanar
//            with the wing covering that carries on past it, and no depth
//            buffer can choose between two surfaces in the same plane.
//   FIT      every vertex of the reflector is inside the aerofoil — built,
//            not estimated, and tested against the section itself.
//
// THE FUNCTIONS UNDER TEST ARE THE ONES THAT SHIP. `bayCage` and `section` are
// lifted out of the wing layer and `lampFit`, `skin`, `revolveInto` and `PROF`
// out of the light layer — the G48 rule: a gate that re-implements the thing
// it checks, checks nothing.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const SRC = path.join(__dirname, '_cage_wing.js');
const results = [];
const ok = (m, c) => results.push({ m, c: !!c });

// ---- lift bayCage out of the layer -----------------------------------------
const src = fs.readFileSync(SRC, 'utf8');
const at = src.indexOf('function bayCage(geo) {');
ok('bayCage is present in ' + path.basename(SRC), at >= 0);
let bayCage = null;
if (at >= 0) {
  let d = 0, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { end = k + 1; break; } }
  }
  const body = src.slice(at, end);
  // the only THREE it touches: BufferGeometry / BufferAttribute
  const THREE = {
    BufferGeometry: class {
      constructor() { this.attributes = {}; this.index = null; }
      setAttribute(n, a) { this.attributes[n] = a; }
      setIndex(a) { this.index = { array: a, count: a.length }; }
      computeVertexNormals() {}
    },
    BufferAttribute: class {
      constructor(a, s) { this.array = a; this.itemSize = s;
                          this.count = a.length / s; }
    },
  };
  const ctx = vm.createContext({ THREE, Math, Set, Map, Array, Float32Array,
                                 Int32Array, Infinity, console });
  bayCage = vm.runInContext('(' + body + ')', ctx);
}
ok('bayCage lifted and callable', typeof bayCage === 'function');

// ---- a D-nose band, the shape the bay actually is --------------------------
// stations across the span, a NACA-ish section at each, and only the faces
// forward of the front spar — which is exactly what pickParts hands over.
function band(nSta, nHoop, taper, dihedral) {
  const P = [], tri = [], grid = [];
  const yt = t => 0.10 * (1.4845 * Math.sqrt(t) - 0.63 * t - 1.758 * t * t +
                          1.4215 * t * t * t - 0.5075 * t * t * t * t);
  for (let s = 0; s < nSta; s++) {
    const x = 0.6 + s * (0.7 / (nSta - 1));
    const c = 1.5 * (1 - taper * s / (nSta - 1));
    const row = [];
    // upper surface aft -> LE, then lower LE -> aft: one open profile.
    // THE CHORD FRACTION RUNS 0 TO 0.13, not 0 to 1: the bay is the D-nose in
    // front of the front spar, so the section GROWS from nothing at the
    // leading edge to its thickest at the aft cut. Feeding the thickness law
    // a fraction of 1 puts a whole aerofoil inside the cut — thinnest where
    // the bay is deepest — and a lamp fitted to that has the geometry exactly
    // backwards.
    for (let h = 0; h < nHoop; h++) {
      const u = h / (nHoop - 1);                        // 0 = aft upper
      const t = (u <= 0.5 ? (1 - u * 2) : (u - 0.5) * 2) * 0.13;
      const sgn = u <= 0.5 ? 1 : -1;
      row.push(P.push([x, 0.67 + (dihedral || 0) * (x - 0.6) +
                          sgn * yt(t + 1e-6) * c,
                       2.17 - t * c]) - 1);
    }
    grid.push(row);
  }
  for (let s = 0; s + 1 < nSta; s++) for (let h = 0; h + 1 < nHoop; h++) {
    const a = grid[s][h], b = grid[s][h + 1],
          c = grid[s + 1][h + 1], d = grid[s + 1][h];
    tri.push(a, b, c, a, c, d);
  }
  const pos = new Float32Array(P.length * 3);
  P.forEach((q, i) => { pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1];
                        pos[i * 3 + 2] = q[2]; });
  return {
    getAttribute: n => n === 'position' ? {
      count: P.length, getX: i => pos[i * 3], getY: i => pos[i * 3 + 1],
      getZ: i => pos[i * 3 + 2] } : null,
    getIndex: () => ({ count: tri.length, getX: i => tri[i] }),
  };
}

// ---- coplanar area overlap -------------------------------------------------
const clip = (sub, cl) => {
  let out = sub;
  for (let i = 0; i < cl.length; i++) {
    const A = cl[i], B = cl[(i + 1) % cl.length], inp = out; out = [];
    const side = p => (B[0] - A[0]) * (p[1] - A[1]) -
                      (B[1] - A[1]) * (p[0] - A[0]);
    for (let j = 0; j < inp.length; j++) {
      const P = inp[j], Q = inp[(j + 1) % inp.length];
      const sp = side(P), sq = side(Q);
      if (sp >= 0) out.push(P);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
    }
    if (!out.length) return [];
  }
  return out;
};
const shoe = P => { let a = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1]; }
  return a; };
const area2 = P => Math.abs(shoe(P)) / 2;
const ccw = P => shoe(P) < 0 ? P.slice().reverse() : P;

function inspect(G) {
  const p = G.attributes.position.array, ix = G.index.array;
  const T = [];
  let degen = 0;
  for (let t = 0; t + 2 < ix.length; t += 3) {
    const g = i => [p[ix[i] * 3], p[ix[i] * 3 + 1], p[ix[i] * 3 + 2]];
    const A = g(t), B = g(t + 1), C = g(t + 2);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
             u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) { degen++; continue; }
    n = n.map(x => x / l);
    T.push({ P: [A, B, C], n, d: n[0] * A[0] + n[1] * A[1] + n[2] * A[2] });
  }
  let overlaps = 0, worst = 0;
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j];
    if (Math.abs(a.n[0] * b.n[0] + a.n[1] * b.n[1] + a.n[2] * b.n[2]) < 0.995)
      continue;
    let far = 0;
    for (const q of b.P)
      far = Math.max(far,
        Math.abs(a.n[0] * q[0] + a.n[1] * q[1] + a.n[2] * q[2] - a.d));
    if (far > 0.0015) continue;               // parallel but not the same plane
    const ax = Math.abs(a.n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = [a.n[1] * ax[2] - a.n[2] * ax[1], a.n[2] * ax[0] - a.n[0] * ax[2],
              a.n[0] * ax[1] - a.n[1] * ax[0]];
    const el = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map(x => x / el);
    const e2 = [a.n[1] * e1[2] - a.n[2] * e1[1], a.n[2] * e1[0] - a.n[0] * e1[2],
                a.n[0] * e1[1] - a.n[1] * e1[0]];
    const pr = q => [q[0] * e1[0] + q[1] * e1[1] + q[2] * e1[2],
                     q[0] * e2[0] + q[1] * e2[1] + q[2] * e2[2]];
    const A2 = ccw(a.P.map(pr)), B2 = ccw(b.P.map(pr));
    const it = clip(A2, B2);
    if (!it.length) continue;
    const ov = area2(it), mn = Math.min(area2(A2), area2(B2));
    if (ov > mn * 0.05) { overlaps++; worst = Math.max(worst, ov / mn); }
  }
  return { tris: T.length, degen, overlaps, worst };
}

// ---- the rib inset ---------------------------------------------------------
// THE DEFECT THE USER ACTUALLY SAW, twice: "overlapping faces on the interior
// sides", then "we still have the moire ... try moving the interior face
// outwards by a few mm". A rib fills the cut's end plane and the wing covering
// that carries on past the cut has faces in THAT SAME PLANE — two coplanar
// surfaces from two different meshes, which no depth buffer can resolve. It
// cannot be found by looking at the cage alone, so it is asserted here as a
// distance: every rib triangle must stand clear of the cut's own end planes.
function ribInset(G, x0, x1) {
  const p = G.attributes.position.array, ix = G.index.array;
  let worst = Infinity, ribs = 0;
  for (let t = 0; t + 2 < ix.length; t += 3) {
    const g = i => [p[ix[i] * 3], p[ix[i] * 3 + 1], p[ix[i] * 3 + 2]];
    const A = g(t), B = g(t + 1), C = g(t + 2);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
               u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9 || Math.abs(n[0] / l) < 0.9) continue;   // not a rib
    ribs++;
    for (const q of [A, B, C])
      worst = Math.min(worst, Math.abs(q[0] - x0), Math.abs(q[0] - x1));
  }
  return { ribs, inset: isFinite(worst) ? worst : 0 };
}

// ---- the cases -------------------------------------------------------------
const CASES = [
  { n: 'square band, 4 stations', s: 4, h: 15, tp: 0 },
  { n: 'tapered band, 6 stations', s: 6, h: 21, tp: 0.35 },
  { n: 'coarse band, 3 stations', s: 3, h: 9, tp: 0.15 },
  // THE REAL ONE: a bay is a single loft cell, and the wing has dihedral
  { n: 'one cell with dihedral', s: 2, h: 12, tp: 0.05, dh: 0.052 },
];
if (bayCage) for (const c of CASES) {
  const G = bayCage(band(c.s, c.h, c.tp, c.dh));
  if (!G) { ok(c.n + ': a cage was built', false); continue; }
  const r = inspect(G);
  ok(c.n + ': a cage was built (' + r.tris + ' tris)', r.tris > 4);
  ok(c.n + ': no degenerate triangles (' + r.degen + ')', r.degen === 0);
  // THE ASSERTION. Anything above zero is the stipple the user reported.
  ok(c.n + ': no coplanar triangle overlaps (' + r.overlaps +
     (r.overlaps ? ', worst covers ' + r.worst.toFixed(2) + ' of the smaller'
                 : '') + ')', r.overlaps === 0);
  // and it must actually CLOSE the hole: an aft wall across every station
  // plus a filled rib at each end
  ok(c.n + ': the aft wall spans every station and both ribs are filled',
     r.tris >= (c.s - 1) * 2 + (c.h - 4) * 2);
  const q = boxOf(band(c.s, c.h, c.tp, c.dh));
  const ri = ribInset(G, q.min[0], q.max[0]);
  ok(c.n + ': both ribs are present (' + ri.ribs + ' triangles)', ri.ribs >= 4);
  ok(c.n + ': the ribs stand clear of the cut plane (' +
     (ri.inset * 1000).toFixed(1) + ' mm)', ri.inset >= 0.002);
}

// ---- THE LAMP FITS INSIDE THE SECTION -------------------------------------
// The second half of the user's report — "your lamp sticks out a tad. Have
// this not happen by default" — and the one that took three wrong answers to
// get right. Each wrong answer sized the lamp correctly for a shape the wing
// does not have: the bay's BOUNDING BOX (thickest at the aft cut, and centred
// on the box rather than on the section), the section at MID-SPAN (a bay is
// one loft cell — two stations and no middle), and the INTERSECTION of the two
// stations (dihedral puts them 38 mm apart, so their overlap is a section
// neither end has).
//
// Nothing here re-derives the fit. `section` is lifted from the wing layer,
// `lampFit` / `skin` / `revolveInto` / `PROF` from the light layer, the
// reflector is actually built, and every vertex of it is tested against the
// aerofoil.
const lift = (file, names) => {
  const t = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const ctx = vm.createContext({ Math, Set, Map, Array, Float32Array,
                                 Infinity, console, window: {} });
  // A STATEMENT SCANNER, not a brace matcher. `cross` is an arrow that
  // returns an array literal and never opens a brace at all, so scanning for
  // the first `{` after it swallows the next function whole.
  const stmt = at => {
    let d = 0;
    for (let k = at; k < t.length; k++) {
      const c = t[k];
      if (c === '{' || c === '(' || c === '[') d++;
      else if (c === '}' || c === ')' || c === ']') {
        d--;
        if (d === 0 && c === '}' && /\n/.test(t.slice(k + 1, k + 3))) return k + 1;
      } else if (c === ';' && d === 0) return k + 1;
      else if (c === '/' && t[k + 1] === '/') k = t.indexOf('\n', k);
    }
    return -1;
  };
  for (const n of names) {
    const re = new RegExp('^[ \\t]*(?:function\\s+' + n + '\\s*\\(|const\\s+' +
                          n + '\\s*=)', 'm');
    const m = re.exec(t);
    if (!m) return null;
    const end = stmt(m.index);
    if (end < 0) return null;
    const src2 = t.slice(m.index, end);
    vm.runInContext(/^\s*function/.test(src2) ? src2 : src2 + ';', ctx);
    // a `const` declared in a vm script lives in the script's lexical scope
    // and never becomes a property of the context — so publish it, or the
    // gate reads `undefined` off a symbol that is perfectly well defined
    vm.runInContext('globalThis.' + n + ' = ' + n + ';', ctx);
  }
  // PROF is a plain table; take it whole, so the profile and the two constants
  // the fit divides by can never drift apart
  const pAt = t.indexOf('const PROF = {');
  if (pAt >= 0) {
    let d = 0, end = -1;
    for (let k = t.indexOf('{', pAt); k < t.length; k++) {
      if (t[k] === '{') d++;
      else if (t[k] === '}') { d--; if (!d) { end = k + 1; break; } }
    }
    vm.runInContext(t.slice(pAt, end) + ';', ctx);
    vm.runInContext('globalThis.PROF = PROF;', ctx);
    vm.runInContext('PROF.cupRim = Math.max.apply(null, PROF.cup.map(' +
                    'function (q) { return q[0]; }));' +
                    'PROF.cupBack = -Math.min.apply(null, PROF.cup.map(' +
                    'function (q) { return q[1]; }));', ctx);
  }
  return ctx;
};
function boxOf(geo) {
  const src = geo.getAttribute('position');
  const q = { min: [Infinity, Infinity, Infinity],
              max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < src.count; i++) {
    const v = [src.getX(i), src.getY(i), src.getZ(i)];
    for (let k = 0; k < 3; k++) {
      if (v[k] < q.min[k]) q.min[k] = v[k];
      if (v[k] > q.max[k]) q.max[k] = v[k];
    }
  }
  return q;
}
const cupVerts = (ctx, p, ax, r) => {
  const V = [];
  ctx.revolveInto({ v: (x, y, z) => { V.push([x, y, z]); return V.length - 1; },
                    quad: () => {}, tri: () => {} },
                  p, ax, ctx.PROF.cup, 18, r);
  return V;
};
const through = (ctx, pf, V) => {
  let worst = -Infinity;
  for (const v of V) {
    const sk = ctx.skin(pf, v[0], v[2]);
    if (sk) worst = Math.max(worst, sk.d - v[1], v[1] - sk.u);
  }
  return worst;
};

const wctx = lift('_cage_wing.js', ['section']);
const lctx = lift('_cage_light.js', ['CLR', 'on', 'skin', 'lampFit',
                                     'nrm', 'cross', 'revolveInto']);
ok('section lifted from the wing layer', !!(wctx && wctx.section));
ok('lampFit lifted from the light layer', !!(lctx && lctx.lampFit));
if (wctx && wctx.section && lctx && lctx.lampFit) {
  const FITS = [
    { n: 'one cell, dihedral 3 deg', s: 2, h: 12, tp: 0.05, dh: 0.052, sb: 0.06 },
    { n: 'one cell, flat', s: 2, h: 12, tp: 0, dh: 0, sb: 0.06 },
    { n: 'one cell, strong taper', s: 2, h: 14, tp: 0.40, dh: 0.09, sb: 0.06 },
    { n: 'deep setback', s: 2, h: 12, tp: 0.05, dh: 0.052, sb: 0.14 },
    { n: 'shallow setback', s: 2, h: 12, tp: 0.05, dh: 0.052, sb: 0.03 },
    { n: 'wide bay, 4 cells', s: 5, h: 16, tp: 0.20, dh: 0.052, sb: 0.06 },
  ];
  for (const f of FITS) {
    const geo = band(f.s, f.h, f.tp, f.dh);
    const pf = wctx.section(geo);
    if (!pf) { ok(f.n + ': the bay reports a section', false); continue; }
    ok(f.n + ': the bay reports a section (' + pf.length + ' stations)',
       pf.length >= 2);
    const q = boxOf(geo);
    const site = lctx.lampFit(q, pf, f.sb);
    ok(f.n + ': a lamp was fitted (r = ' + (site.r * 1000).toFixed(1) + ' mm)',
       !!site && site.r > 0.005);
    const worst = through(lctx, pf, cupVerts(lctx, site.p, site.ax, site.r));
    // THE ASSERTION: not one vertex of the reflector is outside the skin.
    ok(f.n + ': the reflector is inside the aerofoil (worst ' +
       (worst * 1000).toFixed(1) + ' mm, negative is clear)', worst < 0);
    ok(f.n + ': and it stops short of the aft wall',
       site.p[2] - site.r * lctx.PROF.cupBack > q.min[2]);
  }
}

// ---- --selftest: each defect, rebuilt, must FAIL its own assertion ---------
// A test whose failure looks like its pass is not a test.
if (process.argv.includes('--selftest') && bayCage) {
  // 1. THE FLUSH RIB — the moire the user reported twice. Take the cage that
  // ships and push its ribs back into the cut plane; the inset check must
  // catch it. (The rib's triangulation is NOT what caused the stipple, so a
  // selftest that rebuilt the old angle-fan would prove nothing: on the
  // measured station that fan is a valid triangulation. It was always the
  // coplanarity.)
  const c0 = { s: 2, h: 12, tp: 0.05, dh: 0.052 };
  const G0 = bayCage(band(c0.s, c0.h, c0.tp, c0.dh));
  const q0 = boxOf(band(c0.s, c0.h, c0.tp, c0.dh));
  const flat = { attributes: { position: { array: G0.attributes.position.array.slice() } },
                 index: { array: G0.index.array } };
  const arr = flat.attributes.position.array;
  const mid = (q0.min[0] + q0.max[0]) / 2;
  for (let i = 0; i < arr.length; i += 3)
    arr[i] = arr[i] < mid ? q0.min[0] : q0.max[0];
  const fi = ribInset(flat, q0.min[0], q0.max[0]);
  ok('SELFTEST: a rib flush with the cut plane is caught (' +
     (fi.inset * 1000).toFixed(1) + ' mm)', !(fi.inset >= 0.002));

  // and the box-sized lamp — the first wrong answer — must fail the fit test
  if (wctx && wctx.section && lctx && lctx.lampFit) {
    const geo = band(2, 12, 0.05, 0.052), pf = wctx.section(geo);
    const q = boxOf(geo);
    const bad = [(q.min[0] + q.max[0]) / 2, (q.min[1] + q.max[1]) / 2,
                 q.max[2] - Math.max(0.05, 0.06 * 1.35)];
    const badR = ((q.max[1] - q.min[1]) / 2 - 0.008) / lctx.PROF.cupRim;
    const w2 = through(lctx, pf, cupVerts(lctx, bad, [0, -0.10, 1], badR));
    ok('SELFTEST: the box-sized lamp is caught (' + (w2 * 1000).toFixed(1) +
       ' mm through the skin)', w2 > 0);
  }
}

// ---- verdict ---------------------------------------------------------------
console.log('=== BAY ===');
let fail = 0;
for (const r of results) {
  console.log('  ' + (r.c ? 'ok  ' : 'FAIL') + '  ' + r.m);
  if (!r.c) fail++;
}
console.log('GATE BAY: ' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
