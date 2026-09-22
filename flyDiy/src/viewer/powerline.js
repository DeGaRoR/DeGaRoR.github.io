// ============================================================
// POWERLINE — THE POLES AND THE CABLE ALONG A ROAD (2026-09-22).
//
// The user, with a photograph of a road on Revillagigedo: "do we have the
// electric poles?" We had the POLES — three Poly Haven presets baked into the
// yard pack at G285, and a village-bench rule that stood them every 32-40 m on
// the inland verge (tools/_village_gen.js planPoles, G285/G370) — but nothing
// in the shipped renderer ever stood one, and there has never been a CABLE.
// A line of poles without wire is a row of sticks: the catenary is the thing
// the eye reads, which is why the theme doc has carried "the CABLE between
// utility poles" as owed since 2026-09-14.
//
// This module is the rule and the wire. It does NOT know about props, the
// house kit or the lamp: the renderer hands it `place(q)` (stand a pole here)
// and `lamp(q)` (hang a street lamp on this one), and gets back a group with
// the poles in it and the cable strung between them.
//
// WHERE THEY GO:
//   - one SIDE of the road, the whole way: whichever side takes more poles
//     once the caller's `keep` has spoken (it rejects a plot, a junction, a
//     strip, and the side a guardrail already stands on — a rail and a pole
//     line on the same verge is the one thing the photograph never shows);
//     a tie goes to -n, the inland side, which is the village's own rule.
//   - every `pitch` metres with a little jitter, never inside a plot (a pole
//     stands on the verge in front of a frontage, not in the garden), and
//     every second one carries the street lamp that already exists.
//
// THE CABLE: three conductors on the crossarm (which runs ACROSS the road, so
// they spread along the road's normal) and one service cable lower down, each
// span a parabola through TRAM_RUN.ropeCurve — the codebase's one sag, written
// for the tram's haul rope. Sag is a fraction of the span, so a long crossing
// hangs deeper on its own. The wires of a run are merged into ONE geometry per
// `chunk` spans (about 350 m): a single mesh for an eleven-kilometre road
// would carry an island-wide bounding sphere and be drawn from everywhere, and
// one mesh per span would be a draw call every thirty metres.
//
// A four-sided tube at 35 mm, smooth-shaded: about 90 triangles a wire a span,
// 350 for the four of them — a hundred spans of line is 35 k triangles in
// three or four meshes.
// ============================================================
const POWERLINE = (() => {
  'use strict';

  const DEF = {
    // the rule
    pitch: 34,          // metres between poles
    jitter: 8,          // +- of it
    offset: 0.55,       // past the pavement's edge to the pole
    minLen: 70,         // a road shorter than this carries no line
    minW: 3.2,          // nor one narrower than this (a track, a footpath)
    maxPoles: 140,      // the budget a road may raise (140 x 34 m = 4.7 km)
    maxSpan: 110,       // a gap wider than this breaks the cable (the run stopped, it did not stride)
    lampEvery: 2,       // every second pole carries the street lamp
    // the pole (the yard kit's presets: 6.13 m tall, the crossarm 1.2 m across). The kit's is a
    // SMALL rural pole; a distribution pole is 9-11 m and its lowest conductor is over 6 m, so the
    // prop is stood at `poleScale` - the proportions are the kit's, the height is the real one.
    H: 6.13, poleScale: 1.35,
    keys: ['pole_b', 'pole_b', 'pole_a', 'pole_c'],   // mostly plain, a transformer here and there
    // the cable
    cond: 3,            // conductors on the crossarm
    condDrop: 0.55,     // below the pole's top
    condSpread: 0.42,   // between conductors, along the crossarm
    service: 1,         // the lower service / telephone cable
    servDrop: 1.62, servOff: -0.16,
    sag: 0.018, sagService: 0.034,     // x the span
    wireR: 0.035, wireSides: 4, wireStep: 3, chunk: 10,
  };
  let D = Object.assign({}, DEF);

  const hash1 = n => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h >>> 8) / 16777216; };
  const rndOf = seed => { let s = (seed | 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  // THE SAG is the tram's (src/viewer/tram_run.js ropeCurve): the one parabola in the codebase.
  // Resolved on FIRST USE, never at load: this file may be evaluated before tram_run.js has been
  // fetched (the bundles' order is the build's, not this module's business).
  let RC = null;
  function rope() {
    if (RC) return RC;
    if (typeof window !== 'undefined' && window.TRAM_RUN && window.TRAM_RUN.ropeCurve) RC = window.TRAM_RUN.ropeCurve;
    else if (typeof TRAM_RUN !== 'undefined' && TRAM_RUN && TRAM_RUN.ropeCurve) RC = TRAM_RUN.ropeCurve;
    else if (typeof require !== 'undefined') { try { RC = require('./tram_run.js').ropeCurve; } catch (e) {} }
    return RC;
  }

  // ---- the rule: where the poles stand -------------------------------------
  // o: { path (polyRoad), w, keep(lx, lz) -> false to forbid, side (-1 | 1, forced), seed, D }
  // -> { side, poles: [{ t, x, z, ry, n (toward the road), key, lamp }] } in the PATH's coordinates
  function plan(o) {
    const P = o.path, d = Object.assign({}, D, o.D || {});
    if (!P) return { side: 0, poles: [] };
    const L = P.length, w = o.w || 5;
    if (L < d.minLen || w < d.minW) return { side: 0, poles: [] };
    const keep = o.keep || null, off = w / 2 + d.offset;
    const at = (A, s) => [A.p[0] + A.n[0] * off * s, A.p[1] + A.n[1] * off * s];
    // the side: whichever takes more poles; a tie goes inland (-n), the village's own convention
    const score = s => { let n = 0; for (let t = 10; t < L - 8; t += d.pitch) { const q = at(P.at(t), s); if (!keep || keep(q[0], q[1]) !== false) n++; } return n; };
    const side = o.side || (score(-1) >= score(1) ? -1 : 1);
    const rnd = rndOf((o.seed | 0) * 7919 + 13);
    const poles = [];
    let t = 10 + rnd() * 10, i = 0;
    while (t < L - 8 && poles.length < d.maxPoles) {
      const A = P.at(t), q = at(A, side);
      if (!keep || keep(q[0], q[1]) !== false) {
        poles.push({ t, x: q[0], z: q[1],
          tg: [A.tg[0], A.tg[1]], lean: (rnd() - 0.5) * 0.18,  // the pole's own turn off the road's line
          n: [-A.n[0] * side, -A.n[1] * side],                 // toward the road: the lamp's arm and the crossarm's reach
          key: d.keys[Math.floor(hash1(Math.round(t) + (o.seed | 0) * 131) * d.keys.length) % d.keys.length],
          lamp: (i % d.lampEvery) === 0 });
        i++;
      }
      t += d.pitch + (rnd() - 0.5) * d.jitter;
    }
    return { side, poles };
  }

  // ---- the material: one for every cable in the world ----------------------
  let MAT = null;
  function material(THREE) {
    if (MAT) return MAT;
    // the tram rope's tone (render_premises' ropeMat): weathered dark metal, a little shine left
    MAT = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.62, metalness: 0.65 });
    MAT.name = 'powerline';
    return MAT;
  }

  // ---- the cable: a parabola between two points, as a tube -----------------
  // appends into pos/nor/idx; a four-sided section, smooth normals (a 35 mm wire)
  function tube(pos, nor, idx, a, b, sag, d) {
    const RCf = rope();
    if (!RCf) return 0;
    const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (!(span > 0.2)) return 0;
    const curve = RCf(a, b, sag);
    const n = Math.max(4, Math.min(48, Math.ceil(span / d.wireStep)));
    const S = Math.max(3, d.wireSides | 0), base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.at(t), tg = curve.tangent(t);
      // a frame about the tangent: the world up crossed into it
      let ux = -tg[2], uy = 0, uz = tg[0];                     // up x tangent
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uz /= ul;
      const vx = uy * tg[2] - uz * tg[1], vy = uz * tg[0] - ux * tg[2], vz = ux * tg[1] - uy * tg[0];
      for (let s = 0; s < S; s++) {
        const a2 = s / S * Math.PI * 2, ca = Math.cos(a2), sa = Math.sin(a2);
        const nx = ux * ca + vx * sa, ny = uy * ca + vy * sa, nz = uz * ca + vz * sa;
        pos.push(p[0] + nx * d.wireR, p[1] + ny * d.wireR, p[2] + nz * d.wireR);
        nor.push(nx, ny, nz);
      }
    }
    for (let i = 0; i < n; i++) for (let s = 0; s < S; s++) {
      const a0 = base + i * S + s, a1 = base + i * S + (s + 1) % S;
      const b0 = a0 + S, b1 = a1 + S;
      idx.push(a0, b0, b1, a0, b1, a1);
    }
    return n * S * 2;
  }

  // the attachment points of one pole, in world: the conductors on the crossarm (which runs across
  // the road, so they spread along `n`), the service cable lower and a little toward the road
  function hooks(q, d) {
    const out = [], top = q.y + (q.H || d.H);
    for (let k = 0; k < d.cond; k++) {
      const u = (k - (d.cond - 1) / 2) * d.condSpread;
      out.push({ p: [q.x + q.n[0] * u, top - d.condDrop, q.z + q.n[1] * u], sag: d.sag });
    }
    if (d.service) out.push({ p: [q.x + q.n[0] * d.servOff, top - d.servDrop, q.z + q.n[1] * d.servOff], sag: d.sagService });
    return out;
  }

  // ---- the build -----------------------------------------------------------
  // o: plan's, plus { toWorld(lx, lz) -> [x, z], heightAt(x, z), place(q) -> Object3D | null,
  //     lamp(q), name, mode: 'auto' | 'off', poles (to skip the plan) }
  // The poles come back in WORLD coordinates on q (x, y, z, ry, n) so `place` and `lamp` can use
  // them as they stand; `ry` has the frame's own turn folded in.
  function build(THREE, o) {
    const mode = o.mode || 'auto';
    if (mode === 'off') return null;
    const d = Object.assign({}, D, o.D || {});
    const pl = o.poles ? { side: o.side || -1, poles: o.poles } : plan(o);
    if (!pl.poles.length) return null;
    const toWorld = o.toWorld || ((x, z) => [x, z]), hW = o.heightAt || (() => 0);
    // to world: the point, the ground under it, and the frame's turn measured off the map itself
    const W = [];
    const dir = (q, v) => { const e = 0.5, p0 = toWorld(q.x, q.z), p1 = toWorld(q.x + v[0] * e, q.z + v[1] * e);
      let dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    for (const q of pl.poles) {
      const p = toWorld(q.x, q.z);
      const n = dir(q, q.n), tg = dir(q, q.tg || [q.n[1], -q.n[0]]);
      W.push(Object.assign({}, q, { x: p[0], z: p[1], y: hW(p[0], p[1]), n, tg,
        scale: d.poleScale, H: d.H * d.poleScale,
        ry: Math.atan2(tg[0], tg[1]) + (q.lean || 0) }));      // the prop's own axis is the road's (the village's convention)
    }
    const grp = new THREE.Group();
    grp.name = o.name || 'powerline';
    let stood = 0;
    for (const q of W) {
      const g = o.place ? o.place(q) : null;
      if (g) { grp.add(g); stood++; }
      // the lamp's arm is the bench's, measured off the KIT's own top (5.9 of 6.13): a stood-taller
      // pole carries it that much higher, so the head still sits just under the cap
      if (q.lamp && o.lamp) o.lamp(Object.assign({}, q, { y: q.y + (q.H - d.H) }));
    }
    // the cable, chunked so the frustum can throw a line away a few hundred metres at a time
    let pos = [], nor = [], idx = [], tris = 0, spans = 0, made = 0;
    const flush = () => {
      if (!idx.length) { pos = []; nor = []; idx = []; return; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      geo.userData.pwn = 1;                              // MINE to free (a pole's mesh is a shared prop's)
      const m = new THREE.Mesh(geo, material(THREE));
      m.name = grp.name + ':cable' + (made++);
      m.castShadow = false; m.receiveShadow = false;     // a 35 mm wire's shadow is under a pixel at any honest range
      grp.add(m);
      tris += idx.length / 3;
      pos = []; nor = []; idx = [];
    };
    for (let i = 0; i + 1 < W.length; i++) {
      const A = W[i], B = W[i + 1];
      if (Math.hypot(B.x - A.x, B.z - A.z) > d.maxSpan) { flush(); continue; }   // the run was interrupted: the line breaks
      const ha = hooks(A, d), hb = hooks(B, d);
      for (let k = 0; k < Math.min(ha.length, hb.length); k++) tube(pos, nor, idx, ha[k].p, hb[k].p, ha[k].sag, d);
      if (++spans % d.chunk === 0) flush();
    }
    flush();
    if (!grp.children.length) return null;
    grp.userData.powerline = { poles: stood, spans, tris, side: pl.side,
      at: W.length ? [Math.round(W[0].x), Math.round(W[0].y), Math.round(W[0].z)] : null };
    attach(grp);
    return grp;
  }

  // ---- the switch (GRAPHICS > power lines) ---------------------------------
  const GROUPS = new Set();
  let ON = true;
  function attach(m) { GROUPS.add(m); m.visible = ON; }
  function forget(m) { GROUPS.delete(m); }
  // free a built line: only the geometry this module (or its caller) MARKED as its own - the cable
  // and the lamp bags. A pole is a prop: its geometry is shared with every other pole in the world.
  function dispose(m) {
    forget(m);
    m.traverse(c => { if (c.geometry && c.geometry.userData && c.geometry.userData.pwn) c.geometry.dispose(); });
    if (m.parent) m.parent.remove(m);
  }
  const own = o => { if (o && o.geometry) o.geometry.userData.pwn = 1; return o; };
  function setOn(v) { ON = !!v; for (const m of GROUPS) m.visible = ON; return ON; }
  const isOn = () => ON;
  function stats() { let poles = 0, spans = 0, tris = 0; for (const m of GROUPS) { const u = m.userData.powerline; if (u) { poles += u.poles; spans += u.spans; tris += u.tris; } } return { lines: GROUPS.size, poles, spans, tris }; }
  function list() { const out = []; for (const m of GROUPS) out.push(Object.assign({ name: m.name }, m.userData.powerline || {})); return out; }

  function set(o) { for (const k in o) if (k in D) D[k] = o[k]; }
  function reset() { D = Object.assign({}, DEF); }

  const api = { DEF, get D() { return D; }, plan, hooks, build, material, attach, forget, dispose, own, setOn, isOn, stats, list, set, reset };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = POWERLINE;
if (typeof window !== 'undefined') window.POWERLINE = POWERLINE;
