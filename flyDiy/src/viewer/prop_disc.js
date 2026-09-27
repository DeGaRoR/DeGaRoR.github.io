// ============================================================================
// prop_disc.js — THE PROPELLER AS A DISC (G672, A2-FADES of the 2026-09-26 Jolene playtest)
//
// The user: "the spinning prop contributes to the feeling of lag - replace with a textured disc,
// slightly animated, MSFS style". The blades were turned by spinRate x frameDt (app.js), which at
// 2 400 rpm and 30 fps is ~480 degrees a frame: a strobe that reads as a stutter. A camera does not
// see a blade at that speed either; it sees the disc the blades sweep.
//
// THE DISC IS MEASURED OFF THE BLADES, never drawn by hand: the blade meshes of the spinning part are
// rasterised down the shaft into a polar grid, so the radius, the root, the plane the disc lies in,
// the number of blades, the chord at every station and the colour at every station (a painted tip is
// a ring of its colour) are the build's own. The texture (angle x radius) carries
//   rgb   the blades' colour at that radius
//   a     the SWEPT coverage at that radius (the fraction of the circle the blades fill: a
//         two-blade tip is a faint ring, a wide root a dense one), times (1 - ghost), plus the
//         silhouette itself blurred round the circle, times ghost - the "ghost" blades MSFS shows,
//         which drift slowly (`drift`) instead of strobing. The mean over the circle is the
//         coverage either way, so the ghost never brightens or darkens the disc.
// The mesh is a child of the spinning part, so it rides the engine node, the conjugation (G357) and
// the pose exactly as the blades do; it counter-rotates its texture by the part's own angle.
//
// THE CROSSOVER is by rpm: under rpmLo the blades alone (a turning-over, a slow windmill: nothing
// strobes), over rpmHi the disc alone (the blades hidden), between them the disc's opacity grows
// with the blades still drawn, and the blades go when it is whole. A start passes through it in
// under a second.
//
//   PROP_DISC.analyse(blades, axis, opt) -> { R, r0, h, NT, NR, cov, rgba, n }     (pure: node-testable)
//     blades: [{ pos: Float32Array (xyz in the spinning frame), idx: index array | null, col: [r,g,b] 0..1 }]
//   PROP_DISC.make(THREE, part, bladeMeshes, axis, opt) -> ctl | null
//     ctl.update(rpm, spinAng, sense, dt) -> the disc's weight 0..1; ctl.mesh; ctl.dispose()
//   PROP_DISC.S   the dials (live: PROP_DISC.S.rpmLo = 100 moves the next frame)
// ============================================================================
const PROP_DISC = (() => {
  'use strict';
  const S = { on: true, rpmLo: 150, rpmHi: 420, ghost: 0.35, blurDeg: 22, gain: 2.2, maxA: 0.82, drift: 0.11, streak: 0.14 };

  // an orthonormal pair (u, v) with u x v = axis, so a turn of +a about the axis takes angle t to t + a
  function basis(ax) {
    const a = norm(ax), t = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = norm(cross(t, a)), v = cross(a, u);
    return { a, u, v };
  }
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const norm = p => { const l = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / l, p[1] / l, p[2] / l]; };
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  function analyse(blades, axis, opt) {
    const o = Object.assign({ NT: 256, NR: 64, NX: 256 }, opt || {});
    const { a, u, v } = basis(axis || [1, 0, 0]);
    // pass 1: the reach, the root and the plane (the blades' mean station along the shaft)
    let R = 0, r0 = Infinity, hs = 0, hn = 0;
    for (const b of blades) {
      const P = b.pos;
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2];
        const h = x * a[0] + y * a[1] + z * a[2], px = x * u[0] + y * u[1] + z * u[2], py = x * v[0] + y * v[1] + z * v[2];
        const r = Math.hypot(px, py);
        if (r > R) R = r; if (r < r0) r0 = r; hs += h; hn++;
      }
    }
    if (!(R > 0.05) || !hn) return null;
    r0 = Math.max(0.02, Math.min(r0, R * 0.5));
    const h = hs / hn;
    // pass 2: every triangle, projected down the shaft, into an NX^2 grid over [-R, R]^2 (the colour of the last
    // mesh to cover a cell wins: a painted tip drawn over its blade)
    const NX = o.NX, cell = new Int16Array(NX * NX).fill(-1), k = NX / (2 * R);
    const cols = blades.map(b => b.col || [0.2, 0.2, 0.2]);
    blades.forEach((b, bi) => {
      const P = b.pos, n = P.length / 3, X = new Float32Array(n), Y = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        X[i] = (x * u[0] + y * u[1] + z * u[2] + R) * k; Y[i] = (x * v[0] + y * v[1] + z * v[2] + R) * k;
      }
      const I = b.idx, nt = I ? I.length / 3 : n / 3;
      for (let t = 0; t < nt; t++) {
        const i0 = I ? I[t * 3] : t * 3, i1 = I ? I[t * 3 + 1] : t * 3 + 1, i2 = I ? I[t * 3 + 2] : t * 3 + 2;
        const x0 = X[i0], y0 = Y[i0], x1 = X[i1], y1 = Y[i1], x2 = X[i2], y2 = Y[i2];
        const d = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        if (Math.abs(d) < 1e-9) continue;
        const gx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), gx1 = Math.min(NX - 1, Math.ceil(Math.max(x0, x1, x2)));
        const gy0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), gy1 = Math.min(NX - 1, Math.ceil(Math.max(y0, y1, y2)));
        for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
          const px = gx + 0.5, py = gy + 0.5;
          const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / d;
          const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / d;
          if (w0 < -1e-6 || w1 < -1e-6 || w0 + w1 > 1 + 1e-6) continue;
          cell[gy * NX + gx] = bi;
        }
      }
    });
    // pass 3: the polar grid, 2 x 2 samples a texel
    const NT = o.NT, NR = o.NR, sil = new Float32Array(NT * NR), rc = new Float32Array(NR * 3), rn = new Float32Array(NR);
    for (let ir = 0; ir < NR; ir++) for (let it = 0; it < NT; it++) {
      let c = 0;
      for (let s = 0; s < 4; s++) {
        const r = r0 + (ir + 0.25 + 0.5 * (s & 1)) / NR * (R - r0), th = (it + 0.25 + 0.5 * (s >> 1)) / NT * 2 * Math.PI;
        const gx = Math.floor(r * Math.cos(th) * k + NX / 2), gy = Math.floor(r * Math.sin(th) * k + NX / 2);
        const bi = gx >= 0 && gy >= 0 && gx < NX && gy < NX ? cell[gy * NX + gx] : -1;
        if (bi >= 0) { c++; const q = cols[bi]; rc[ir * 3] += q[0]; rc[ir * 3 + 1] += q[1]; rc[ir * 3 + 2] += q[2]; rn[ir]++; }
      }
      sil[ir * NT + it] = c / 4;
    }
    // the blade count: runs of cover round the circle at 70 % of the reach
    let n = 0; { const ir = Math.min(NR - 1, Math.round(((0.7 * R - r0) / (R - r0)) * NR));
      for (let it = 0; it < NT; it++) if (sil[ir * NT + it] >= 0.5 && sil[ir * NT + (it + NT - 1) % NT] < 0.5) n++; }
    // the swept coverage and the colour, per radius (an empty row borrows its neighbour's colour)
    const cov = new Float32Array(NR);
    for (let ir = 0; ir < NR; ir++) { let s = 0; for (let it = 0; it < NT; it++) s += sil[ir * NT + it]; cov[ir] = s / NT; }
    const col = new Float32Array(NR * 3);
    for (let ir = 0; ir < NR; ir++) {
      let j = ir; for (let d = 0; d < NR && !rn[j]; d++) { j = ir + (d % 2 ? -1 : 1) * Math.ceil(d / 2); if (j < 0 || j >= NR) j = ir; }
      const m = rn[j] || 1;
      for (let c = 0; c < 3; c++) col[ir * 3 + c] = rn[j] ? rc[j * 3 + c] / m : 0.2;
    }
    // the ghost: the silhouette blurred round the circle (two box passes, a triangle of +-blurDeg)
    const hw = Math.max(1, Math.round(S.blurDeg / 360 * NT / 2)), tmp = new Float32Array(NT), gh = new Float32Array(NT * NR);
    for (let ir = 0; ir < NR; ir++) {
      const row = sil.subarray(ir * NT, ir * NT + NT), out = gh.subarray(ir * NT, ir * NT + NT);
      for (let pass = 0; pass < 2; pass++) {
        const src = pass ? tmp : row, dst = pass ? out : tmp;
        let s = 0; for (let d = -hw; d <= hw; d++) s += src[(d + NT) % NT];
        for (let it = 0; it < NT; it++) { dst[it] = s / (2 * hw + 1); s += src[(it + hw + 1) % NT] - src[(it - hw + NT) % NT]; }
      }
    }
    // the texel: rgb the station's colour (sRGB bytes), a = gain x (swept x (1 - ghost) + ghost x blurred), with a
    // faint concentric streak (the rings a real disc shows) and the last 4 % of the reach feathered
    const rgba = new Uint8Array(NT * NR * 4), toS = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    for (let ir = 0; ir < NR; ir++) {
      const f = (ir + 0.5) / NR, streak = 1 + S.streak * (2 * hash(ir) - 1), edge = Math.min(1, (1 - f) / 0.04);
      const cr = Math.round(255 * toS(col[ir * 3])), cg = Math.round(255 * toS(col[ir * 3 + 1])), cb = Math.round(255 * toS(col[ir * 3 + 2]));
      for (let it = 0; it < NT; it++) {
        const A = S.gain * ((1 - S.ghost) * cov[ir] + S.ghost * gh[ir * NT + it]) * streak * edge;
        const q = (ir * NT + it) * 4;
        rgba[q] = cr; rgba[q + 1] = cg; rgba[q + 2] = cb; rgba[q + 3] = Math.round(255 * Math.max(0, Math.min(S.maxA, A)));
      }
    }
    return { R, r0, h, NT, NR, cov, rgba, n, basis: { a, u, v } };
  }

  // the blade meshes' positions in the spinning part's frame: a child's own matrix applied (the cage's
  // blade meshes stand at identity); a SIBLING (the payload's proptip, positioned at the hub like the
  // part itself and turned by the same angle) is taken as already in it
  function bladeData(THREE, part, meshes) {
    const out = [], lin = new THREE.Color();
    for (const m of meshes) {
      const g = m.geometry, pa = g && g.attributes && g.attributes.position;
      if (!pa) continue;
      let pos = pa.array;
      if (m.parent === part) { m.updateMatrix(); if (!isIdentity(m.matrix)) { pos = Float32Array.from(pos); const e = m.matrix.elements;
        for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2];
          pos[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; } } }
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (mat && mat.color) lin.copy(mat.color); else lin.setRGB(0.2, 0.2, 0.2);
      out.push({ pos, idx: g.index ? g.index.array : null, col: [lin.r, lin.g, lin.b] });
    }
    return out;
  }
  const isIdentity = M => { const e = M.elements; for (let i = 0; i < 16; i++) if (Math.abs(e[i] - (i % 5 === 0 ? 1 : 0)) > 1e-9) return false; return true; };
  // the blades of a spinning part: its meshes that reach past half the part's own reach (the spinner and a hub
  // stay near the shaft; a blade runs out to the tip)
  function bladesOf(part, axis) {
    const { a } = basis(axis || [1, 0, 0]), list = [];
    part.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) {
      const P = o.geometry.attributes.position.array; let r = 0;
      for (let i = 0; i < P.length; i += 3) { const d = P[i] * a[0] + P[i + 1] * a[1] + P[i + 2] * a[2];
        const r2 = P[i] * P[i] + P[i + 1] * P[i + 1] + P[i + 2] * P[i + 2] - d * d; if (r2 > r) r = r2; }
      list.push({ o, r: Math.sqrt(r) }); } });
    const R = list.reduce((m, q) => Math.max(m, q.r), 0);
    return list.filter(q => q.r > 0.5 * R).map(q => q.o);
  }

  function make(THREE, part, bladeMeshes, axis, opt) {
    if (!S.on || !THREE.DataTexture) return null;
    const blades = bladeMeshes && bladeMeshes.length ? bladeMeshes : bladesOf(part, axis);
    if (!blades.length) return null;
    const data = bladeData(THREE, part, blades), D = analyse(data, axis, opt);
    if (!D) return null;
    const tex = new THREE.DataTexture(D.rgba, D.NT, D.NR, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    // the annulus: 96 segments round, 6 rings out, uv = (angle / 2 pi, radius from the root to the reach)
    const NA = 96, NRg = 6, pos = [], uv = [], nrm = [], idx = [], { a, u, v } = D.basis;
    for (let j = 0; j <= NRg; j++) {
      const r = D.r0 + (D.R - D.r0) * j / NRg;
      for (let i = 0; i <= NA; i++) {
        const th = i / NA * 2 * Math.PI, c = Math.cos(th) * r, s = Math.sin(th) * r;
        pos.push(a[0] * D.h + u[0] * c + v[0] * s, a[1] * D.h + u[1] * c + v[1] * s, a[2] * D.h + u[2] * c + v[2] * s);
        uv.push(i / NA, j / NRg); nrm.push(a[0], a[1], a[2]);
      }
    }
    for (let j = 0; j < NRg; j++) for (let i = 0; i < NA; i++) {
      const p0 = j * (NA + 1) + i, p1 = p0 + 1, p2 = p0 + NA + 1, p3 = p2 + 1;
      idx.push(p0, p1, p3, p0, p3, p2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
                                                 roughness: 0.75, metalness: 0, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'propDisc'; mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
    mesh.visible = false; mesh.userData.propDisc = true;
    part.add(mesh);
    let phase = 0, w = -1;
    const ctl = {
      mesh, blades, D,
      // rpm: the shaft's (the prop's spinRate in rpm); spinAng: the part's own angle about `axis`; sense: +1 / -1
      update(rpm, spinAng, sense, dt) {
        const r = Math.abs(rpm || 0), lo = S.rpmLo, hi = Math.max(lo + 1, S.rpmHi);
        const t = Math.max(0, Math.min(1, (r - lo) / (hi - lo))), k = S.on ? t * t * (3 - 2 * t) : 0;
        // the ghosts turn slowly with the engine's hand, faster as it winds up (never the true rate: that is the strobe)
        phase += (sense || 1) * S.drift * 2 * Math.PI * Math.min(1, r / 2000) * (dt || 0);
        if (phase > 1e4 || phase < -1e4) phase %= 2 * Math.PI;
        const off = ((spinAng || 0) - phase) / (2 * Math.PI);
        tex.offset.x = off - Math.floor(off);
        if (k !== w) {
          w = k; mat.opacity = k; mesh.visible = k > 0.002;
          const show = k < 0.999; for (const b of blades) if (b.visible !== show) b.visible = show;
        }
        return k;
      },
      // the texture again from the same blades, under the dials as they are now (PROP_DISC.rebake())
      rebake() { const D2 = analyse(data, axis, opt); if (D2) { tex.image.data.set(D2.rgba); tex.needsUpdate = true; } },
      dispose() { if (mesh.parent) mesh.parent.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); for (const b of blades) b.visible = true; const i = LIVE.indexOf(ctl); if (i >= 0) LIVE.splice(i, 1); },
    };
    LIVE.push(ctl); if (LIVE.length > 16) LIVE.shift();   // the dials' reach: the discs made last (an aeroplane has one to four)
    return ctl;
  }
  const LIVE = [];
  const rebake = () => { for (const c of LIVE) c.rebake(); return LIVE.length; };
  return { S, analyse, make, bladesOf, basis, rebake };
})();
if (typeof window !== 'undefined') window.PROP_DISC = PROP_DISC;
if (typeof module !== 'undefined') module.exports = PROP_DISC;
