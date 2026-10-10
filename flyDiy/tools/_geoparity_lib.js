// _geoparity_lib.js — WHAT FLIES IS WHAT IS DRAWN (G2640 DESIGN-TRUST).
//
// The user, 10 Oct, on their 'mosquito': "The fin model looks really far from
// the mesh ... There seem to be at least 10 cm difference between the phy
// model of wing height, and the mesh." Their standing rule (8 Oct): WYSIWYG
// always — the aeroplane that flies must be the one that is drawn.
//
// This measures it, surface by surface, headless: the build goes through the
// page's own chain (tools/_bake_joined.js: the drawing layers in the headless
// scene, the join's measure(), the garage's merge), the joined spec through
// buildGen, and then every AERO STRIP the solver flies is set against the
// drawn sheet at the same station:
//
//   flown   the strip's force point (its spar nodes weighted as the solver
//           weights them, 30_solver's `w`), its height and its chord
//   drawn   the layer's own faces cut by a plane at that station, in the
//           frame's coordinates (the join's datum: x = zFw - z, y = y - yD):
//           the leading and trailing edge, the quarter chord, the height of
//           the chord line
//
// and the row is the difference: dx (station of the quarter chord against the
// force point), dy (height), dc (chord). The wing and the stab slice across
// the span (|z|), the fin up its height (y, above the boom).
//
//   const GP = require('./_geoparity_lib.js');
//   const r = GP.measure(spec);   // { rows: [...], worst: {wing, stab, fin}, notes, errors }
//
// Nothing here is physics; it reads the two halves and compares.
'use strict';
const path = require('path');
const T = __dirname;

let BJ = null;
function load() {
  if (!BJ) { BJ = require(path.join(T, '_bake_joined.js')); BJ.loadPanel(); }
  return BJ;
}

// a layer's TRIANGLES in the frame (x aft of the firewall, y over the keel
// datum, z the cage's x), hardware left out (hinges, fittings: G307's rule).
// Triangles, not vertices: a lofted sheet has vertices only at its ribs, so a
// station between two ribs is found by cutting the faces (sectionAt below).
function layerTris(W, name) {
  const THREE = W.THREE;
  let mnt = W.CAGE_WING && W.CAGE_WING.group;
  while (mnt && mnt.parent && !mnt.parent.isScene && mnt.parent.parent && !mnt.parent.parent.isScene) mnt = mnt.parent;
  if (!mnt) return [];
  mnt.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(mnt.matrixWorld).invert();
  const tmp = new THREE.Matrix4(), v = new THREE.Vector3();
  const D = W.CAGE_DATUM || { zFw: 0, yD: 0 };
  let grp = null;
  mnt.traverse(o => { if (!grp && o.name === name) grp = o; });
  const out = [];
  if (!grp) return out;
  grp.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (o.userData && (o.userData.edHi || o.userData.edHw)) return;
    if (/^ed(Hinge|Fit)/.test(o.name || '')) return;
    const g = o.geometry, p = g.attributes.position;
    if (!p) return;
    tmp.multiplyMatrices(inv, o.matrixWorld);
    const V = [];
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(tmp);
      V.push([D.zFw - v.z, v.y - D.yD, v.x]);
    }
    const ix = g.index ? g.index.array : null;
    const nT = ix ? ix.length / 3 : p.count / 3;
    for (let t = 0; t < nT; t++) {
      const a = ix ? ix[3 * t] : 3 * t, b = ix ? ix[3 * t + 1] : 3 * t + 1, c = ix ? ix[3 * t + 2] : 3 * t + 2;
      out.push([V[a], V[b], V[c]]);
    }
  });
  return out;
}

// the points where a plane spanOf(p) = s0 cuts the triangles
function cutPoints(tris, spanOf, s0, side) {
  const out = [];
  for (const T3 of tris) {
    for (let e = 0; e < 3; e++) {
      const A = T3[e], B = T3[(e + 1) % 3];
      if (side && (Math.sign(A[2]) === -side && Math.abs(A[2]) > 0.02)) continue;
      const da = spanOf(A) - s0, db = spanOf(B) - s0;
      if ((da > 0) === (db > 0) || da === db) continue;
      const u = da / (da - db);
      out.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u]);
    }
  }
  return out;
}

// the flown strip: force point, the chord line's two spar points, the span coordinate
function stripGeo(def, s) {
  const P = i => def.nodes[i].p;
  const lerp = (a, b, t) => [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t);
  const a = [0, 0, 0];
  for (const [i, w] of s.w) for (let k = 0; k < 3; k++) a[k] += w * P(i)[k];
  const f = lerp(P(s.fIn), P(s.fOut), s.t), r = lerp(P(s.rIn), P(s.rOut), s.t);
  return { a, f, r };
}

// the drawn section at a station: the faces cut at the span coordinate, kept to the cluster around the flown chord (a strut or a
// fairing in the same slice is not the surface), LE / TE / quarter chord /
// the chord line's height at the quarter chord
function drawnSection(tris, spanOf, s0, side, guess) {
  const sl = cutPoints(tris, spanOf, s0, side);
  if (sl.length < 6) return null;
  // keep the surface: within 0.35 m (or 25 % of the chord) of the flown
  // chord line's height for the wing and stab, of its lateral for the fin
  const near = sl.filter(p => Math.abs(guess.cross(p) - guess.c0) < guess.tol);
  if (near.length < 6) return null;
  let le = near[0], te = near[0];
  for (const p of near) { if (p[0] < le[0]) le = p; if (p[0] > te[0]) te = p; }
  const chord = te[0] - le[0];
  const xq = le[0] + 0.25 * chord;
  // the CHORD LINE's height at the quarter chord: the straight line from the
  // leading to the trailing edge (the flown strip's spar nodes lie on the
  // chord line; the middle of the thickness is the camber line, 4 cm above it
  // on a 1.6 m NACA 3412 — not an offset)
  const hq = guess.cross(le) + 0.25 * (guess.cross(te) - guess.cross(le));
  return { le: le[0], te: te[0], chord, xq, hq, n: near.length };
}

function measure(spec0, opts) {
  opts = opts || {};
  const B = load();
  const C = require(path.join(T, 'flight_core.js'));
  const r = B.bakeJoined(JSON.parse(JSON.stringify(spec0)));
  const W = r.W;
  const def = C.buildGen(r.spec);
  const L = { wing: layerTris(W, 'cageLayer:wing'), stab: layerTris(W, 'cageLayer:stab'),
              fin: layerTris(W, 'cageLayer:fin') };
  const rows = [];
  // the boom's top under the fin: the fin is the centreline sheet ABOVE it
  // (the ventral under the boom is fin area too, but its own row is not flown
  // as a strip — the join adds its area to Sv)
  const finFloor = def.nodes.find(n => n.tag === 'TPT');
  for (const s of def.strips) {
    const kind = s.kind;
    if (!L[kind] || !L[kind].length) continue;
    const g = stripGeo(def, s);
    let spanOf, side, guess, s0;
    if (kind === 'fin') {
      // the fin's span coordinate is its height; its "height" across the
      // chord is the lateral (it should sit on the centreline, or on its
      // boom on a twin)
      s0 = g.a[1];
      spanOf = p => p[1];
      side = 0;
      const c0 = g.a[2];
      guess = { cross: p => p[2], c0, tol: 0.25 };
      if (finFloor && s0 < finFloor.p[1] + 0.05) continue;
    } else {
      s0 = Math.abs(g.a[2]);
      spanOf = p => Math.abs(p[2]);
      side = Math.sign(g.a[2]) || 1;
      guess = { cross: p => p[1], c0: g.a[1], tol: Math.max(0.35, 0.25 * s.chord) };
    }
    const d = drawnSection(L[kind], spanOf, s0, side, guess);
    if (!d) { rows.push({ kind, side: s.side, plane: s.plane || 0, span: s0, flown: g.a, missing: true }); continue; }
    // the flown quarter chord: the force point itself (the solver's lift acts
    // there); the flown height across the chord, the force point's
    const flownH = kind === 'fin' ? g.a[2] : g.a[1];
    rows.push({ kind, side: s.side, plane: s.plane || 0, span: s0,
                flown: { x: g.a[0], h: flownH, chord: s.chord },
                drawn: { x: d.xq, h: d.hq, chord: d.chord, le: d.le, te: d.te },
                dx: g.a[0] - d.xq, dh: flownH - d.hq, dc: s.chord - d.chord });
  }
  const worst = {};
  for (const w of rows) {
    if (w.missing) continue;
    const k = w.kind;
    const e = worst[k] || (worst[k] = { dx: 0, dh: 0, dc: 0, n: 0, sx: 0, sh: 0 });
    if (Math.abs(w.dx) > Math.abs(e.dx)) e.dx = w.dx;
    if (Math.abs(w.dh) > Math.abs(e.dh)) e.dh = w.dh;
    if (Math.abs(w.dc) > Math.abs(e.dc)) e.dc = w.dc;
    e.n++; e.sx += w.dx; e.sh += w.dh;
  }
  for (const k in worst) { worst[k].mx = worst[k].sx / worst[k].n; worst[k].mh = worst[k].sh / worst[k].n; }
  return { rows, worst, notes: r.notes, errors: r.errors, spec: r.spec, def, W };
}

module.exports = { measure, layerTris, cutPoints, stripGeo };
