// PATTERN VIS (G193) — the declared ground pattern and the two approaches,
// drawn in the flight world so the player can SEE what the pilot is steering
// to (the user: "enable visibility of the patterns through options in
// flight ... a glide slope, a touchdown target (there should be 2, for both
// directions), and a taxi pattern").
//
// A pure builder: `buildPatternVis(THREE, pattern, groundY, core)` returns a
// group and three switches; app.js owns the instance, hangs it in the world
// scene when a route is applied, and flips the layers from the rail's
// `patterns` flyout. It draws with what render_world.js already uses
// (BufferGeometry, MeshBasicMaterial, LineSegments) so the WORLDRENDER stub
// carries it, and it reads the pattern's own routes through the SAME sampler
// the pilots follow (39_ground_path.js patternPath) — the ribbon on the
// ground is the line the aeroplane is steering to, not a drawing of one.
//
//   graph    the taxi graph: a ribbon along every route (shared arcs drawn
//            once), a disc at every node, an amber STOP bar and arrow at each
//            hold
//   slope    the two glide slopes as dashed lines climbing from each aim
//            point at the slope flown (the active one bright), plus a faint
//            chevron of the direction
//   targets  the two touchdown targets: a ring and a chevron at each, and a
//            small dot on the painted aiming point so the two datums read as
//            the different things they are
'use strict';
(() => {

function buildPatternVis(THREE, pattern, groundY, core) {
  const group = new THREE.Group();
  group.name = 'patternVis';
  const gy = (typeof groundY === 'function') ? groundY : (() => (groundY || 0));
  const LIFT = 0.06;                          // above the strip's paint
  // G449: THE OVERLAYS ARE NOT LIGHTS. An unlit material is multiplied by the exposure like
  // everything else, and the night's schedule opens 15 stops: the pilot's planned legs (a line
  // in the sky) and the slope's ribbons blew to white bars on the horizon after dusk. These are
  // instruments drawn on the picture, so they keep their own colour: toneMapped off.
  const mkMat = (col, op) => new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const lineMat = (col, op) => new THREE.LineBasicMaterial({
    color: col, transparent: true, opacity: op, depthWrite: false, toneMapped: false });
  const layers = { graph: new THREE.Group(), slope: new THREE.Group(), targets: new THREE.Group(),
                   // G202: the PAPI (an airfield fixture, on unless switched off) and the
                   // pilot's planned legs in the air (its circuit, drawn as it plans it)
                   papi: new THREE.Group(), legs: new THREE.Group() };
  for (const k in layers) { layers[k].name = 'pattern:' + k; layers[k].renderOrder = 8; group.add(layers[k]); }

  // ---- the graph -----------------------------------------------------------
  const sampler = core && core.patternPath;
  if (pattern && sampler) {
    const seen = new Set();
    const ribbon = [];                          // positions, two verts per sample
    const idx = [];
    const addRoute = ids => {
      if (!ids) return;
      const key = ids.join('>');
      if (seen.has(key)) return;
      seen.add(key);
      let P;
      try { P = sampler(pattern, ids, 1.0); } catch (e) { return; }
      const base = ribbon.length / 3;
      const W = 0.30;
      for (let i = 0; i < P.pts.length; i++) {
        const q = P.pts[i];
        const nx = -Math.sin(q.hdg) * W, nz = Math.cos(q.hdg) * W;
        const y = gy(q.x, q.z) + LIFT;
        ribbon.push(q.x + nx, y, q.z + nz, q.x - nx, y, q.z - nz);
        if (i) {
          const a = base + (i - 1) * 2, b = a + 1, c = base + i * 2, d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
    };
    for (const T of [0, 1]) { addRoute(pattern.routes.out[T]); addRoute(pattern.routes.back[T]); }
    if (ribbon.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ribbon), 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, mkMat(0xffb257, 0.55));
      m.renderOrder = 8; m.frustumCulled = false;
      layers.graph.add(m);
    }
    // the dots: a flat disc per node, the holds amber and larger
    const disc = (x, z, r, col, op) => {
      const N = 18, pos = [], id = [];
      const y = gy(x, z) + LIFT + 0.01;
      pos.push(x, y, z);
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2;
        pos.push(x + r * Math.cos(a), y, z + r * Math.sin(a));
        id.push(0, 1 + i, 1 + (i + 1) % N);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setIndex(id);
      const m = new THREE.Mesh(g, mkMat(col, op));
      m.renderOrder = 9; m.frustumCulled = false;
      return m;
    };
    for (const nd of pattern.nodes) {
      const hold = nd.kind === 'hold';
      layers.graph.add(disc(nd.x, nd.z, hold ? 1.6 : 1.0,
        hold ? 0xffd35a : nd.kind === 'stand' ? 0xfbf4ea : 0xffb257, hold ? 0.9 : 0.7));
      if (hold && nd.hdg != null) {
        // the STOP bar across the centreline, and an arrow the way the run goes
        const ux = Math.cos(nd.hdg), uz = Math.sin(nd.hdg), nx = -uz, nz = ux;
        const y = gy(nd.x, nd.z) + LIFT + 0.02;
        const bar = new THREE.BufferGeometry();
        const hw = 6, hd = 0.45;
        bar.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          nd.x + nx * hw - ux * hd, y, nd.z + nz * hw - uz * hd,
          nd.x - nx * hw - ux * hd, y, nd.z - nz * hw - uz * hd,
          nd.x - nx * hw + ux * hd, y, nd.z - nz * hw + uz * hd,
          nd.x + nx * hw + ux * hd, y, nd.z + nz * hw + uz * hd]), 3));
        bar.setIndex([0, 1, 2, 0, 2, 3]);
        const bm = new THREE.Mesh(bar, mkMat(0xffd35a, 0.9));
        bm.renderOrder = 9; bm.frustumCulled = false;
        layers.graph.add(bm);
        const arr = new THREE.BufferGeometry();
        arr.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          nd.x + ux * 2, y, nd.z + uz * 2,
          nd.x + ux * 8, y, nd.z + uz * 8,
          nd.x + ux * 6 + nx * 1.5, y, nd.z + uz * 6 + nz * 1.5,
          nd.x + ux * 8, y, nd.z + uz * 8,
          nd.x + ux * 6 - nx * 1.5, y, nd.z + uz * 6 - nz * 1.5,
          nd.x + ux * 8, y, nd.z + uz * 8]), 3));
        const al = new THREE.LineSegments(arr, lineMat(0xffd35a, 0.9));
        al.renderOrder = 9; al.frustumCulled = false;
        layers.graph.add(al);
      }
    }
  }

  // ---- the slopes and the targets --------------------------------------------
  const slopeObjs = [];
  if (pattern && pattern.approaches) {
    for (const ap of pattern.approaches) {
      const u = ap.u, aim = ap.aimAP, td = ap.td;
      // the dashed slope: 40 m dashes every 80 m out to 2.5 km, climbing at gs
      const mkSlope = gs => {
        const pos = [];
        for (let dd = 0; dd < 2500; dd += 80) {
          const x0 = aim[0] - u[0] * dd, z0 = aim[1] - u[1] * dd;
          const x1 = aim[0] - u[0] * (dd + 40), z1 = aim[1] - u[1] * (dd + 40);
          pos.push(x0, gy(aim[0], aim[1]) + dd * gs + LIFT, z0,
                   x1, gy(aim[0], aim[1]) + (dd + 40) * gs + LIFT, z1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
        const l = new THREE.LineSegments(g, lineMat(0x8fd7ff, 0.35));
        l.renderOrder = 8; l.frustumCulled = false;
        return l;
      };
      const so = { k: ap.k, obj: mkSlope(ap.gs || 0.07), gs: ap.gs || 0.07, mk: mkSlope };
      layers.slope.add(so.obj);
      slopeObjs.push(so);
      // the target: a ring and a chevron pointing the way the landing runs
      const ring = (x, z, r0, r1, col, op) => {
        const N = 28, pos = [], id = [];
        const y = gy(x, z) + LIFT + 0.02;
        for (let i = 0; i < N; i++) {
          const a = i / N * Math.PI * 2;
          pos.push(x + r0 * Math.cos(a), y, z + r0 * Math.sin(a),
                   x + r1 * Math.cos(a), y, z + r1 * Math.sin(a));
          const j = (i + 1) % N;
          id.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
        g.setIndex(id);
        const m = new THREE.Mesh(g, mkMat(col, op));
        m.renderOrder = 9; m.frustumCulled = false;
        return m;
      };
      layers.targets.add(ring(td[0], td[1], 3.6, 5.0, 0x8fd7ff, 0.85));
      const y = gy(td[0], td[1]) + LIFT + 0.02;
      const nx = -u[1], nz = u[0];
      const chev = new THREE.BufferGeometry();
      chev.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        td[0] - u[0] * 4 - nx * 3, y, td[1] - u[1] * 4 - nz * 3,
        td[0] + u[0] * 2, y, td[1] + u[1] * 2,
        td[0] + u[0] * 2, y, td[1] + u[1] * 2,
        td[0] - u[0] * 4 + nx * 3, y, td[1] - u[1] * 4 + nz * 3]), 3));
      const cl = new THREE.LineSegments(chev, lineMat(0x8fd7ff, 0.9));
      cl.renderOrder = 9; cl.frustumCulled = false;
      layers.targets.add(cl);
    }
  }
  // the painted aiming points, faint, so the two datums are visibly two
  if (pattern && pattern.runway && core && core.siteRunway) {
    // (drawn by app.js from the runway record; here only the pattern's own)
  }

  // ---- THE PAPI (G202, the user: "a glideslope following thing, with the
  // lights (VASI?) if it helps"). Four lights abeam the slope's ground
  // intercept, on the LEFT of each landing direction, 22 m off the
  // centreline. Unit i shows WHITE when the aeroplane is above its own
  // angle and RED below it; the four angles straddle the slope flown
  // (gs -0.5, -0.17, +0.17, +0.5 deg), so two white and two red is ON the
  // slope, the way a real PAPI reads. `papiUpdate(x, y, z)` recolours them
  // from the aeroplane's position every frame; `setActive(k, gs)` re-aims
  // the boxes when the slope flown changes. Dark from behind.
  // ...AND THE VASI (G434, the user: "setup of the VASI systems (automatic glideslope)"). The
  // record says which system stands at each end (`aero.papi[end]`: true a PAPI, 'vasi' a two-bar
  // VASI, false none - the approach that lands over end k reads papi[k]; k = 0 lands over thr1).
  // A VASI is TWO BARS of two lights, both on the left: the downwind bar where the PAPI stands,
  // the upwind bar 210 m further along the landing direction; each bar reads its own angle to the
  // aeroplane, the downwind bar set a quarter degree under the slope and the upwind bar a quarter
  // over - on the slope the near bar is white and the far one red (red over white, "you're all
  // right"), both white high, both red low. AUTOMATIC: the slope both systems are set to is the
  // approach's own (ap.gs, re-aimed by setActive when the pilot's planned slope changes), never a
  // number of their own - the lights show the glideslope the pilot flies.
  const papis = [];
  const kindAt = k => { const A = core && core.aero; if (!A || !Array.isArray(A.papi)) return 'papi'; const v = A.papi[k === 0 ? 1 : 0]; return v === 'vasi' ? 'vasi' : v ? 'papi' : 'none'; };
  if (pattern && pattern.approaches) {
    const white = 0xfff4d6, red = 0xff3a2a, dark = 0x2a2622;
    for (const ap of pattern.approaches) {
      const kind = kindAt(ap.k);
      if (kind === 'none') continue;
      const u = ap.u, aim = ap.aimAP;
      const lx = u[1], lz = -u[0];                     // left of the landing direction
      const bx = aim[0] + lx * 22, bz = aim[1] + lz * 22;
      const units = [];
      // G449: A PAPI UNIT IS A LIGHT, not an unlit box. The old MeshBasicMaterial ignored the day:
      // its "dark" housing (0x2a2622) went through the night's exposure to four white blocks off
      // every threshold (the emitter nobody claimed, seen in every night frame of G443). Now a
      // lit Standard housing, dark, whose EMISSIVE is the reading - white above the unit's angle,
      // red below, nothing from behind - at the level papiUpdate is handed (app.js: the runway
      // lenses' law, 1.2 x (0.92 / exposure)^0.9; a PAPI is lit by day too).
      const unit = (x, z, bar, off) => {
        const g = new THREE.BoxGeometry(kind === 'vasi' ? 1.6 : 1.2, 0.9, 1.2);
        const m = new THREE.MeshStandardMaterial({ color: dark, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.6, metalness: 0.1 });
        const box = new THREE.Mesh(g, m);
        box.position.set(x, gy(x, z) + 0.6, z);
        box.rotation.y = Math.atan2(-u[1], u[0]);
        box.frustumCulled = false;
        layers.papi.add(box);
        units.push({ box, m, x, z, y: gy(x, z) + 0.6, bar, off });
      };
      if (kind === 'vasi') {
        // the downwind bar (2 units) at the aim, the upwind bar 210 m on; `off` is each bar's setting about the slope
        for (let i = 0; i < 2; i++) unit(bx + lx * (i * 4.0), bz + lz * (i * 4.0), 0, -0.0044);
        for (let i = 0; i < 2; i++) unit(bx + u[0] * 210 + lx * (i * 4.0), bz + u[1] * 210 + lz * (i * 4.0), 1, +0.0044);
      } else {
        for (let i = 0; i < 4; i++) unit(bx + lx * (i * 3.2), bz + lz * (i * 3.2), 0, (i - 1.5) * 0.0058);   // -0.5 .. +0.5 deg about the slope
      }
      papis.push({ k: ap.k, u, units, gs: ap.gs || 0.07, white, red, dark, kind });
    }
  }
  const papiUpdate = (x, y, z, level) => {
    const lv = level == null ? 1.2 : level;
    for (const P of papis) {
      for (const U of P.units) {
        // each unit reads its own distance along the landing direction (a VASI's bars stand 210 m apart)
        const dist = (U.x - x) * P.u[0] + (U.z - z) * P.u[1];
        let col = 0;
        if (dist > 40) {
          const ang = Math.atan2(y - U.y, dist);
          col = ang > P.gs + U.off ? P.white : P.red;
        }
        if (U.m.emissive.getHex() !== col) U.m.emissive.setHex(col);
        U.m.emissiveIntensity = col ? lv : 0;
      }
    }
  };
  // ---- THE PILOT'S LEGS (G202): the circuit as planned, a line in the air
  let legsObj = null;
  const setLegs = (legs, altRef) => {
    if (legsObj) { layers.legs.remove(legsObj); if (legsObj.geometry) legsObj.geometry.dispose(); legsObj = null; }
    if (!legs || !legs.length) return;
    const pos = [];
    for (const L of legs) {
      if (!L.A || !L.B) continue;
      const hA = altRef + (L.h != null ? L.h : 0), hB = L.name === 'FINAL' ? gy(L.B[0], L.B[1]) + 2 : hA;
      pos.push(L.A[0], hA, L.A[1], L.B[0], hB, L.B[1]);
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    legsObj = new THREE.LineSegments(g, lineMat(0xffb257, 0.55));
    legsObj.renderOrder = 8; legsObj.frustumCulled = false;
    layers.legs.add(legsObj);
  };

  let activeK = -1;
  const api = {
    papiUpdate, setLegs,
    group, layers,
    // the direction the pilot is landing (frame.k) brightens that slope and
    // redraws it at the slope actually flown
    setActive(k, gsActive) {
      for (const so of slopeObjs) {
        const on = so.k === k;
        if (on && gsActive && Math.abs(gsActive - so.gs) > 1e-4) {
          layers.slope.remove(so.obj);
          if (so.obj.geometry) so.obj.geometry.dispose();
          so.obj = so.mk(gsActive); so.gs = gsActive;
          layers.slope.add(so.obj);
        }
        so.obj.material.opacity = on ? 0.9 : 0.3;
      }
      for (const P of papis) if (P.k === k && gsActive) P.gs = gsActive;
      activeK = k;
    },
    // the PAPI and the legs are ON unless the flyout says otherwise; the
    // three G193 overlays stay off until asked
    setLayers(on) {
      for (const k in layers)
        layers[k].visible = (k === 'papi' || k === 'legs') ? !(on && on[k] === false) : !!(on && on[k]);
    },
    dispose() {
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      if (group.parent) group.parent.remove(group);
    },
  };
  api.setLayers({ graph: false, slope: false, targets: false });
  return api;
}

if (typeof window !== 'undefined') window.PATTERN_VIS = { buildPatternVis };
if (typeof module !== 'undefined') module.exports = { buildPatternVis };

})();
