// ============================================================
// GUARDRAIL — THE W-BEAM BESIDE A ROAD (the pavement chantier, 2026-09-22).
//
// The user, after the pavement landed: "could add metal guardrails on the
// large road sections with nothing but forest, in the bends. Or where you see
// fit? Something like the attached picture. Procedural of course, maybe with
// an option to turn them on and off."
//
// The picture is the real thing: a galvanised W-beam (two of them, stacked, on
// the cliff side of a coast road), bolted to posts every four metres, the
// panels lapped and each panel a slightly different tone, the whole line
// following the bend's curve and the ground's grade rather than the ground
// itself.
//
// WHERE A RAIL GOES is not a decoration but a RULE, and it is the same rule a
// highway engineer follows: a rail stands where LEAVING THE ROAD WOULD COST
// MORE THAN HITTING THE RAIL. So this module measures, per two metres of road
// and per side:
//   - the DROP: how far the ground falls away within 3 / 7 / 14 m past the
//     shoulder (and, when the ground out there is below the water, the fall to
//     the water - the picture's sea cliff);
//   - the CURVATURE: the turn of the tangent over +-8 m, and which side is the
//     OUTSIDE of that turn (a car leaves a bend on the outside);
//   - whatever the caller wants kept clear (`keep`): a junction, a plot's
//     frontage, a village street - the user's "nothing but forest".
// A station rails when the drop alone is serious (>= kDrop), or when a bend
// that tight has any drop at all on its outside. Then the stations are joined
// into RUNS with hysteresis - gaps under `gap` closed, runs under `minRun`
// dropped, every run extended by `lead` and its ends ramped into the ground as
// a buried terminal - because a rail of six metres in the middle of nowhere is
// the thing that reads as procedural.
//
// WHAT IS DRAWN: one merged BufferGeometry per road (posts and beams both),
// ONE MeshStandardMaterial for every rail in the world (galvanised steel:
// metalness 0.62, roughness 0.42), the panel-to-panel tone and the grime at
// the post feet carried by VERTEX COLOUR - no texture, no shader hook, so the
// rail costs one draw call a road, casts and takes shadow, and rides the
// atmosphere through three's prototype hook like every other material.
//
// THE SWITCH: GRAPHICS > guardrails (gfx_settings.js). Every group a renderer
// builds is registered here and the switch flips `visible` - nothing is rebuilt.
//
// The numbers are the AASHTO W-beam's: 312 mm tall, 83 mm deep, its belly
// bolted to the post at mid-height, the top of the beam 760 mm over the road.
// ============================================================
const GUARDRAIL = (() => {
  'use strict';

  // ---- the numbers ---------------------------------------------------------
  const DEF = {
    // the rule
    // THE WARRANT: how far the ground must fall at each probe distance past the rail line before a
    // rail is earned - a 1:3 batter (the slope a car rolls rather than rides down) and never under a
    // metre. A flat table (the first cut's "1.6 m within 14 m") rails every road cut into a 12 %
    // hillside, which is most of an island: two thirds of the analytic world's roads wore one.
    // Recalibrated 2026-09-22 on the REAL Jolene (the island's own DEM, measured in the game, not a
    // fixture over the analytic terrain): her roads fall 0.4 / 1.6 / 2.5 m at the airport, 0.7 / 1.6 /
    // 2.9 on the shore, 1.2 / 3.3 / 6.1 on the one road with a bank. A 1:3 table (1.0 / 2.2 / 4.0)
    // rails 60 m of the whole island - nothing the eye ever meets; a 1:4 one rails 221 m, which is
    // where it stood when the user judged it, and 6.2 km of the analytic world's mountain roads.
    dropAt: [[3, 0.8], [7, 1.7], [14, 3.0]],
    kDrop: 1,          // x the table: under 1 rails more
    kCurve: 0.011,     // 1/m: the curvature a bend must reach to rail its outside (r ~ 90 m)
    twoAt: 8,          // a fall over this gets the picture's SECOND beam (a cliff, a bridge - not every bank)
    minRun: 18,        // a run shorter than this is not worth a rail
    gap: 10,           // two runs closer than this are one run
    lead: 5,           // metres added at each end of a run (and ramped into the ground)
    step: 2,           // the measuring and drawing interval along the road
    cap: 4000,         // metres of rail one build may raise (the budget; the steepest runs first)
    minW: 3.2,         // a road narrower than this carries no rail (a track, a footpath)
    // the beam
    offset: 0.55,      // from the pavement's edge outward to the post line
    railTop: 0.76,     // the top of the lower beam over the road surface
    rail2: 0.44,       // the second beam over the first
    railH: 0.312, railD: 0.083, railT: 0.013,
    postGap: 4.0, postW: 0.12, postD: 0.15, postBury: 0.25,
    panel: 4.0,        // the splice period: one tone a panel
    grade: 6,          // metres either side the ground is averaged over (the rail's own grade)
  };
  let D = Object.assign({}, DEF);

  // THE W: the beam's section, from the bottom lip up, as (height, depth toward the road).
  // Bottom lip, the lower crest, the bolted belly at mid-height, the upper crest, the top lip.
  const W_BEAM = [
    [0.000, 0.022], [0.020, 0.076], [0.042, 0.083], [0.074, 0.083], [0.096, 0.076], [0.126, 0.052],
    [0.156, 0.024],
    [0.186, 0.052], [0.216, 0.076], [0.238, 0.083], [0.270, 0.083], [0.292, 0.076], [0.312, 0.022],
  ];

  const hash1 = n => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h >>> 8) / 16777216; };

  // ---- the rule: where a rail stands --------------------------------------
  // o: { path (polyRoad: length, at(t) -> {p, tg, n}), w, hAt(lx, lz) -> the ground's height at a
  //     point in the PATH's own coordinates, keep(lx, lz) -> false to forbid a rail, waterY, seed }
  // -> [{ side: -1 | 1, t0, t1, rails: 1 | 2, drop }]  (side multiplies the path's n)
  function plan(o) {
    const P = o.path, L = P.length, d = Object.assign({}, D, o.D || {});
    const w = o.w || 5;
    if (!P || L < d.minRun || w < d.minW) return [];
    const hAt = o.hAt, keep = o.keep || null;
    // THE WATER IS A FIELD, NOT A LEVEL (2026-09-22): world.waterH(x, z) is the surface AT THAT
    // POINT and -Infinity where there is none, so a lake's 137 m and the sea's 0 are both in it.
    // Handing this a single number sampled at the world's origin is how the first cut lost every
    // rail on Jolene: one lake under the origin clamped every probe on the island above its bank.
    const wRaw = o.waterY, wAt = typeof wRaw === 'function' ? wRaw : () => ((wRaw === undefined || wRaw === null) ? -Infinity : wRaw);
    const n = Math.max(2, Math.ceil(L / d.step)), off = w / 2 + d.offset;
    const hit = [[], []], dropAt = [[], []];
    for (let i = 0; i <= n; i++) {
      const t = L * i / n, A = P.at(t);
      // the turn of the tangent over +-8 m: its sign says which side is the outside
      const a0 = P.at(Math.max(0, t - 8)).tg, a1 = P.at(Math.min(L, t + 8)).tg;
      const cross = a0[0] * a1[1] - a0[1] * a1[0], dot = a0[0] * a1[0] + a0[1] * a1[1];
      const ang = Math.atan2(cross, dot), arc = Math.min(L, t + 8) - Math.max(0, t - 8);
      const kap = Math.abs(ang) / Math.max(1e-3, arc);
      const outside = cross >= 0 ? 1 : -1;               // the bend curves toward -cross * n
      for (let si = 0; si < 2; si++) {
        const s = si ? 1 : -1;
        const bx = A.p[0] + A.n[0] * off * s, bz = A.p[1] + A.n[1] * off * s;
        const h0 = hAt(bx, bz);
        let drop = 0, warrant = 0;
        for (const q of d.dropAt) {
          const r = q[0], need = q[1] * d.kDrop;
          const px = A.p[0] + A.n[0] * (off + r) * s, pz = A.p[1] + A.n[1] * (off + r) * s;
          const wy = wAt(px, pz);                          // over water the fall is to the water
          const h = Math.max(hAt(px, pz), Number.isFinite(wy) ? wy : -Infinity);
          const fall = h0 - h;
          drop = Math.max(drop, fall); warrant = Math.max(warrant, fall / need);
        }
        // the fall earns it outright, or a tight bend earns it on its OUTSIDE with half the fall
        const ok = warrant >= 1 || (kap >= d.kCurve && s === outside && warrant >= 0.45);
        hit[si].push(!!ok && (!keep || keep(bx, bz) !== false));
        dropAt[si].push(drop);
      }
    }
    // the runs: close the gaps, drop the short ones, extend by the lead
    const out = [];
    for (let si = 0; si < 2; si++) {
      const H = hit[si], gapN = Math.round(d.gap / (L / n));
      for (let i = 0; i <= n; i++) if (!H[i]) {           // a hole shorter than the gap is filled
        let j = i; while (j <= n && !H[j]) j++;
        if (i > 0 && j <= n && j - i <= gapN) for (let k = i; k < j; k++) H[k] = true;
        i = j;
      }
      let i = 0;
      while (i <= n) {
        if (!H[i]) { i++; continue; }
        let j = i; while (j <= n && H[j]) j++;
        const t0 = L * i / n, t1 = L * (j - 1) / n;
        if (t1 - t0 >= d.minRun) {
          let drop = 0; for (let k = i; k < j; k++) drop = Math.max(drop, dropAt[si][k]);
          out.push({ side: si ? 1 : -1, t0: Math.max(0, t0 - d.lead), t1: Math.min(L, t1 + d.lead), drop, rails: drop >= d.twoAt ? 2 : 1 });
        }
        i = j;
      }
    }
    return out;
  }

  // ---- the material: one for every rail in the world -----------------------
  let MAT = null;
  function material(THREE) {
    if (MAT) return MAT;
    MAT = new THREE.MeshStandardMaterial({ color: 0xb6babd, vertexColors: true, metalness: 0.58, roughness: 0.48 });
    MAT.name = 'guardrail';
    return MAT;
  }

  // ---- the geometry --------------------------------------------------------
  // o: { path, w, runs, toWorld(lx, lz) -> [x, z] (default identity), heightAt(x, z) -> the WORLD
  //     height, seed, D }  -> { geo, metres, tris } | null
  function geometry(THREE, o) {
    const P = o.path, d = Object.assign({}, D, o.D || {}), w = o.w || 5;
    const runs = o.runs || [], toWorld = o.toWorld || ((x, z) => [x, z]), hW = o.heightAt;
    const seed = (o.seed || 0) | 0;
    const pos = [], nor = [], col = [];
    let metres = 0;
    // the galvanised tone: light, a touch blue, each PANEL its own; the grime climbs from the foot
    // and one panel in seven has taken a rust stain
    const tone = (t, y01, post) => {
      const p = hash1(Math.floor(t / d.panel) * 7 + seed * 131 + (post ? 9973 : 0));
      const g = 0.74 + 0.28 * p;
      const grime = post ? 0.55 + 0.45 * Math.min(1, y01 * 2.2) : 0.70 + 0.30 * Math.min(1, 0.25 + y01);
      const rust = p > 0.86 ? 0.16 : 0;
      const k = g * grime;
      return [k * (1 + rust * 0.7), k * (1 - rust * 0.15), k * (1 - rust * 0.55)];
    };
    // NON-INDEXED, one normal a facet: a W-beam's crests are what make it read as stamped steel,
    // and an averaged normal rounds them into a pipe
    const quad = (a, b, c, e, ca, cb, cc, ce) => {
      let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const V = [a, b, c, a, c, e], C = [ca, cb, cc, ca, cc, ce];
      for (let i = 0; i < 6; i++) { pos.push(V[i][0], V[i][1], V[i][2]); nor.push(nx, ny, nz); col.push(C[i][0], C[i][1], C[i][2]); }
    };

    // the budget: the STEEPEST runs first, so a road past the cap keeps the rails that matter
    for (const run of runs.slice().sort((a, b) => (b.drop || 0) - (a.drop || 0))) {
      const len = run.t1 - run.t0; if (len < 1) continue;
      if (metres + len > d.cap) continue;
      metres += len;
      const N = Math.max(2, Math.ceil(len / d.step)), s = run.side;
      // the stations: the post line's ground, the world tangent and the outward normal
      const st = [];
      for (let i = 0; i <= N; i++) {
        const t = run.t0 + len * i / N, A = P.at(t);
        const lx = A.p[0] + A.n[0] * (w / 2 + d.offset) * s, lz = A.p[1] + A.n[1] * (w / 2 + d.offset) * s;
        const W0 = toWorld(lx, lz);
        const e = 0.5, Wa = toWorld(A.p[0] + A.tg[0] * e, A.p[1] + A.tg[1] * e), Wb = toWorld(A.p[0] - A.tg[0] * e, A.p[1] - A.tg[1] * e);
        let tx = Wa[0] - Wb[0], tz = Wa[1] - Wb[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        // polyRoad's n in world (n = [tg.z, -tg.x]), times the side: AWAY from the road
        const nx = tz * s, nz = -tx * s;
        st.push({ t, x: W0[0], z: W0[1], g: hW(W0[0], W0[1]), tx, tz, nx, nz });
      }
      // the rail's own GRADE: the ground averaged over +-`grade` metres (a rail is straight where
      // the ground is lumpy - it is a beam, not a drape)
      const gk = Math.max(1, Math.round(d.grade / (len / N)));
      const grade = st.map((p, i) => {
        let h = 0, ws = 0;
        for (let k = -gk; k <= gk; k++) { const j = Math.min(N, Math.max(0, i + k)), ww = 1 - Math.abs(k) / (gk + 1); h += st[j].g * ww; ws += ww; }
        return h / ws;
      });
      // the terminal: 1 at the very ends of the run, 0 once `lead` metres in
      const term = i => { const t = st[i].t, a = Math.min(t - run.t0, run.t1 - t); return a >= d.lead ? 0 : 1 - a / d.lead; };
      // ---- the beams (one, or the picture's two over a serious drop)
      const nRail = run.rails || 1;
      for (let r = 0; r < nRail; r++) {
        const lift = r ? d.rail2 : 0;
        let prev = null, prevC = null;
        for (let i = 0; i <= N; i++) {
          const p = st[i], k = term(i);
          if (r && k > 0.02) { prev = null; continue; }        // the second beam stops before the terminal
          const base = grade[i] + (d.railTop - d.railH) + lift - k * (d.railTop - d.railH - 0.08);
          const flare = k * 0.45;                               // and flares away from the road
          const ox = p.x + p.nx * flare, oz = p.z + p.nz * flare;
          const c = tone(p.t, (base - grade[i]) / Math.max(0.2, d.railTop), false);
          // the section: the W toward the road (-n), then the plate's back, railT behind it
          const ring = [];
          for (let pass = 0; pass < 2; pass++) for (let q = 0; q < W_BEAM.length; q++) {
            const S2 = W_BEAM[pass ? W_BEAM.length - 1 - q : q], dep = pass ? S2[1] - d.railT : S2[1];
            ring.push([ox - p.nx * dep, base + S2[0], oz - p.nz * dep]);
          }
          if (prev) for (let q = 0; q < ring.length; q++) {
            const q2 = (q + 1) % ring.length;
            quad(prev[q], prev[q2], ring[q2], ring[q], prevC, prevC, c, c);
          }
          prev = ring; prevC = c;
        }
      }
      // ---- the posts, every postGap
      const top0 = d.railTop + (nRail > 1 ? d.rail2 : 0) - 0.04;
      for (let t = run.t0 + d.lead * 0.5; t <= run.t1 - d.lead * 0.4; t += d.postGap) {
        const i = Math.min(N, Math.max(0, Math.round((t - run.t0) / len * N))), p = st[i], k = term(i);
        const y1 = grade[i] + top0 - k * (d.railTop - 0.2), y0 = Math.min(p.g, grade[i]) - d.postBury;
        if (y1 - y0 < 0.3) continue;
        const cx = p.x + p.nx * (d.postD * 0.5), cz = p.z + p.nz * (d.postD * 0.5);
        const ax = p.tx * d.postW * 0.5, az = p.tz * d.postW * 0.5, bx = p.nx * d.postD * 0.5, bz = p.nz * d.postD * 0.5;
        const corner = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        const cL = tone(t, 0, true), cH = tone(t, 1, true);
        const low = corner.map(([ca, cb]) => [cx + ax * ca + bx * cb, y0, cz + az * ca + bz * cb]);
        const high = corner.map(([ca, cb]) => [cx + ax * ca + bx * cb, y1, cz + az * ca + bz * cb]);
        for (let q = 0; q < 4; q++) { const q2 = (q + 1) % 4; quad(low[q], low[q2], high[q2], high[q], cL, cL, cH, cH); }
        quad(high[0], high[1], high[2], high[3], cH, cH, cH, cH);   // the cap: a post seen from the air is not a hole
      }
    }
    if (!pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return { geo, metres, tris: pos.length / 9 };
  }

  // build(THREE, o): plan + geometry + the group, registered with the switch. o as plan's and
  // geometry's, plus { name, runs (to skip the plan), mode: 'auto' | 'on' | 'off' }.
  // ONE MESH A RUN, not one a road: an 11 km mountain road's rails are 34 runs over 11 km, and a
  // single mesh's bounding sphere covers the island - it would be drawn from everywhere. A run is
  // a hundred metres, so the frustum throws away all but the one or two you are over.
  function build(THREE, o) {
    const mode = o.mode || 'auto';
    if (mode === 'off') return null;
    const runs = o.runs || (mode === 'on' ? always(o) : plan(o));
    if (!runs.length) return null;
    const d = Object.assign({}, D, o.D || {});
    const grp = new THREE.Group();
    grp.name = o.name || 'guardrail';
    let metres = 0, tris = 0, at = null, longest = 0;
    // the budget: the STEEPEST runs first, so a road past the cap keeps the rails that matter
    for (const run of runs.slice().sort((a, b) => (b.drop || 0) - (a.drop || 0))) {
      if (metres + (run.t1 - run.t0) > d.cap) continue;
      const G = geometry(THREE, Object.assign({}, o, { runs: [run] }));
      if (!G) continue;
      const m = new THREE.Mesh(G.geo, material(THREE));
      m.castShadow = true; m.receiveShadow = true;
      m.name = grp.name + ':' + grp.children.length;
      grp.add(m);
      metres += G.metres; tris += G.tris;
      // `at` is the LONGEST run's centre - a place a camera can be pointed at, not the average of
      // thirty runs strung over eleven kilometres (which is the middle of nowhere)
      if (G.metres > longest) { longest = G.metres; const c = G.geo.boundingSphere.center; at = [Math.round(c.x), Math.round(c.y), Math.round(c.z)]; }
    }
    if (!grp.children.length) return null;
    // `sides` so what stands beside the same road next (the pole line) can take the other verge
    grp.userData.guardrail = { metres, tris, runs: grp.children.length, at, sides: Array.from(new Set(runs.map(r => r.side))) };
    attach(grp);
    return grp;
  }
  // 'on': the whole road, both sides, one beam - the bench's judgement mode
  function always(o) {
    const L = o.path.length, d = Object.assign({}, D, o.D || {});
    if (L < 4) return [];
    return [-1, 1].map(side => ({ side, t0: 0, t1: L, drop: 0, rails: o.rails || 1 }));
  }

  // ---- the switch (GRAPHICS > guardrails) ---------------------------------
  const GROUPS = new Set();
  let ON = true;
  function attach(m) { GROUPS.add(m); m.visible = ON; }
  function forget(m) { GROUPS.delete(m); }
  function setOn(v) { ON = !!v; for (const m of GROUPS) m.visible = ON; return ON; }
  const isOn = () => ON;
  // every rail raised, with where it is: the rig aims a camera by this (and the F8 panel could)
  function list() {
    const out = [];
    for (const m of GROUPS) { const u = m.userData.guardrail || {};
      out.push({ name: m.name, metres: +(u.metres || 0).toFixed(0), tris: u.tris || 0, runs: u.runs || 0, at: u.at || null }); }
    return out;
  }
  function stats() { let metres = 0, tris = 0; for (const m of GROUPS) { const u = m.userData.guardrail; if (u) { metres += u.metres; tris += u.tris; } } return { rails: GROUPS.size, metres, tris }; }

  // free a built rail: its own geometries (the material is shared and stays)
  function dispose(m) {
    forget(m);
    m.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    if (m.parent) m.parent.remove(m);
  }
  function set(o) { for (const k in o) if (k in D) D[k] = o[k]; }
  function reset() { D = Object.assign({}, DEF); }

  const api = { DEF, W_BEAM, get D() { return D; }, plan, always, geometry, build, material, attach, forget, dispose, setOn, isOn, stats, list, set, reset };
  return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GUARDRAIL;
if (typeof window !== 'undefined') window.GUARDRAIL = GUARDRAIL;
