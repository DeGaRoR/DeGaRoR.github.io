// ============================================================
// CONTACT SHADOW (A6-GROUND G1002, the Jolene playtest: "the planes feel floaty when taxiing ... someone asked
// whether the plane was taking off while it was taxiing"). The eye reads a wheel as ON the ground when the ground
// darkens where the tyre meets it - the occlusion a sun shadow map cannot draw (its texel is a hand's width, and
// its bias leaves a sliver of light under a tyre that A6-SHADOW is closing from its side). This is that
// darkening, and only that: a small soft blob straight under each tyre, on the ground the wheel stands on, its
// strength falling with the tyre's height over that ground and gone by `reach`; and one very soft, larger blob
// under the fuselage while it is near the ground (gone by `bodyReach`).
//
// G2055 (WHEEL-AO, the user 6 Oct: "a small contact shadow below each wheel ... an ellipse with blurred contours
// ... add to the existing shadow, and be slightly more dark ... removed as soon as the plane is off the ground
// (with a slight fade out effect). Faking contact AO."). G1002's blob was never seen live (SHADOW-EYES' A/B:
// "contact shadow off did nothing"). Each tyre now prints TWO ellipses in its one quad:
//   THE CORE   the tyre's footprint: as long as its contact patch (2 sqrt(2 R d), d the tyre's deflection - a
//              static share of R plus whatever the solver presses the node into the ground; it shrinks to nothing
//              as the tyre unloads), as wide as the tyre; near-black (S.core), gone in the first S.coreReach of lift.
//   THE HALO   the ambient occlusion round it: past the tyre (and a spat) by S.haloLen / S.haloWid radii, a
//              gaussian-like falloff, S.halo at its middle; it SPREADS (S.spread) and fades as the tyre rises and
//              is gone at S.reach.
// The two compose as occlusions do, 1 - (1 - core)(1 - halo), and the quad is black under normal blending: the
// ground beneath is MULTIPLIED by (1 - alpha) - the sun's shadow included, so where both lie it is darker.
//
// ONE DRAW PER SCENE: an InstancedMesh of a unit quad, one instance per blob, a per-instance vec4 (aS: halo, core,
// the core's radii in the quad), no depth write, drawn after the pavement (renderOrder 4; the pavement is 1.99-3)
// and pulled S.pull toward the eye along its own ray in the vertex shader (the screen place unchanged), so a drawn
// ground a few cm over terrainH cannot bury it and nothing z-fights. The quad lies on the ground's plane (the normal
// from the ground's own differences) and runs with the wheel's rolling direction. The same material (one program)
// serves the world and the shed (app.js makes both meshes at load: the world's and the garage's compile link it).
// The data is the physics' own: the wheel node, its drawn radius and the ground - terrainH in the world, the shed's
// floor in the garage. No shadow-map work.
//
//   CONTACT_SHADOW.make(THREE)                     -> the mesh (the caller adds it to its scene)
//   CONTACT_SHADOW.update(THREE, mesh, blobs)      blobs: [{ kind, x, z, gy, n: [nx, ny, nz], ax: [x, z], len, wid, a, core?, cu?, cv? }]
//   CONTACT_SHADOW.blobsFor(sim, def, world, o)    the blobs of one aeroplane (the wheels + the body), or []
//                                                  o: { axis: [x, z], tyreW: { node: width m } }
//   CONTACT_SHADOW.blobsAt(wheels, ground, o)      the same off a list: wheels [{ x, y, z, R, W?, ax? }] (the hub),
//                                                  ground { h(x, z), n?(x, z) } (the shed's floor, the roll-out shot)
//   CONTACT_SHADOW.wheelBlob(w, h, x, z, gy, n, ax)  one tyre's blob (h its bottom over the ground), or null past reach
//   CONTACT_SHADOW.keelBlob(k, h, gy, n)           a float's keel flat on the shed's floor, or null past reach
//   CONTACT_SHADOW.S                               the dials
// Loads in node (module.exports) for GATE CONTACT.
// ============================================================
(function () {
  // len / wid: the halo past the tyre in tyre radii; d0: the static deflection as a share of R (the drawn tyre is the
  // loaded one, G661: the node sits at the rim, so the solver's deflection past it is what this adds); wR: the tyre's
  // width over its radius where the drawn tyre was not measured
  const S = { on: true, a: 1.0, core: 0.90, halo: 0.80, reach: 0.4, coreReach: 0.08, spread: 0.6,
              haloLen: 1.35, haloWid: 0.85, coreWid: 0.95, corePad: 0.10, d0: 0.06, wR: 0.7, minWid: 0.05,
              lift: 0.004, pull: 0.03,
              body: 0.24, bodyReach: 3.0, bodyLen: 1.5, bodyWid: 1.25 };
  const MAX = 8;
  const VS = [
    'attribute vec4 aS;',
    'varying vec2 vUv;',
    'varying vec4 vS;',
    '#include <common>',
    '#include <logdepthbuf_pars_vertex>',
    'void main() {',
    '  vUv = uv; vS = aS;',
    '  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);',
    // toward the eye along its own ray: the same pixel, a depth S.pull nearer (no z-fight, no burying)
    '  float dE = length(mvPosition.xyz);',
    '  mvPosition.xyz *= max(0.0, 1.0 - ' + S.pull.toFixed(3) + ' / max(dE, 0.001));',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <logdepthbuf_vertex>',
    '}'].join('\n');
  const FS = [
    'varying vec2 vUv;',
    'varying vec4 vS;',
    '#include <common>',
    '#include <logdepthbuf_pars_fragment>',
    'void main() {',
    '  #include <logdepthbuf_fragment>',
    '  vec2 q = vUv * 2.0 - 1.0;',
    // the halo: gaussian-like, closed to 0 at the quad's rim
    '  float dh = length(q);',
    '  float fh = exp(-3.2 * dh * dh) * (1.0 - smoothstep(0.7, 1.0, dh));',
    // the core: the footprint's ellipse inside the quad, a short soft edge
    '  float dc = length(q / max(vS.zw, vec2(0.02)));',
    '  float fc = 1.0 - smoothstep(0.55, 1.0, dc);',
    '  float a = 1.0 - (1.0 - vS.x * fh) * (1.0 - vS.y * fc);',
    '  gl_FragColor = vec4(0.0, 0.0, 0.0, a);',
    '}'].join('\n');

  function make(THREE) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);                                 // lies in x-z, faces +y
    const A = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    if (A.setUsage && THREE.DynamicDrawUsage) A.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aS', A);
    const m = (typeof MATLIB !== 'undefined' ? MATLIB : require('./matlib.js')).make(THREE, 'shader', { vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      fog: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(g, m, MAX);
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.renderOrder = 4; mesh.name = 'contact:blobs'; mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    mesh.userData.aS = A;
    return mesh;
  }

  // the instances, written in place: position on the ground (+ lift along its normal), x along the axis (len),
  // z across it (wid), y the normal
  const M16 = new Float32Array(16);
  function update(THREE, mesh, blobs) {
    if (!mesh) return;
    const A = mesh.userData.aS, n = Math.min(MAX, blobs ? blobs.length : 0);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const b = blobs[i];
      if (!(b.a > 0.002) && !((b.core || 0) > 0.002)) continue;
      const nx = b.n[0], ny = b.n[1], nz = b.n[2];
      // the axis on the ground's plane: ax - (ax.n) n, then across = fwd x n
      // G2055: THE BASIS MUST BE RIGHT-HANDED (x fwd, y the normal, z = x cross y). G1002 wrote across = n x fwd: a
      // mirrored instance, its quad facing DOWN and culled as a back face - which is why no blob was ever seen live
      let fx = b.ax[0], fy = 0, fz = b.ax[1];
      const dn = fx * nx + fz * nz; fx -= dn * nx; fy -= dn * ny; fz -= dn * nz;
      const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      const rx = fy * nz - fz * ny, ry = fz * nx - fx * nz, rz = fx * ny - fy * nx;
      const L = b.len, W = b.wid;
      M16[0] = fx * L; M16[1] = fy * L; M16[2] = fz * L; M16[3] = 0;
      M16[4] = nx; M16[5] = ny; M16[6] = nz; M16[7] = 0;
      M16[8] = rx * W; M16[9] = ry * W; M16[10] = rz * W; M16[11] = 0;
      M16[12] = b.x + nx * S.lift; M16[13] = b.gy + ny * S.lift; M16[14] = b.z + nz * S.lift; M16[15] = 1;
      mesh.instanceMatrix.array.set(M16, k * 16);
      const a = Math.min(1, b.a);
      A.array[k * 4] = a; A.array[k * 4 + 1] = Math.min(1, b.core || 0);
      A.array[k * 4 + 2] = b.cu || 0; A.array[k * 4 + 3] = b.cv || 0;
      k++;
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    A.needsUpdate = true;
    mesh.visible = k > 0;
  }

  // the ground's normal at (x, z) off terrainH's own differences (+-0.4 m)
  function normalAt(H, x, z) {
    const e = 0.4, gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e);
    const l = Math.hypot(gx, 1, gz);
    return [-gx / l, 1 / l, -gz / l];
  }
  const UP = [0, 1, 0];
  const sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const fall = (h, reach) => { const t = Math.max(0, Math.min(1, h / reach)); return (1 - t) * (1 - t); };

  // ONE TYRE. w: { R, W? } (radius and width, m); h: the tyre's bottom over the ground (negative: pressed in);
  // (x, z, gy, n, ax) where it prints. The footprint is the deflected tyre's chord: d = R d0 - h (the static
  // deflection plus the solver's), length 2 sqrt(2 R d); it closes as the tyre unloads (h -> R d0) and the core
  // fades over coreReach; the halo spreads by `spread` and fades over `reach`.
  function wheelBlob(w, h, x, z, gy, n, ax) {
    if (!(h < S.reach)) return null;
    const R = Math.max(0.03, w.R || 0.1), hw = 0.5 * Math.max(S.minWid, w.W > 0 ? w.W : S.wR * R);
    const d = Math.max(0, Math.min(0.5 * R, S.d0 * R - h));
    const lp = Math.sqrt(2 * R * d);                          // the footprint's half length
    const t = Math.max(0, h) / S.reach, grow = 1 + S.spread * t;
    const L = (lp + S.haloLen * R) * grow, Wd = (hw + S.haloWid * R) * grow;   // the halo's half extents
    const cl = lp + S.corePad * R, cw = hw * S.coreWid;
    const core = S.core * (1 - sstep(0, S.coreReach, h)) * Math.min(1, d / (S.d0 * R * 0.5 + 1e-6));
    const a = S.a * S.halo * (1 - sstep(0, S.reach, h));
    if (!(a > 0.002) && !(core > 0.002)) return null;
    return { kind: 'wheel', x, z, gy, n, ax, len: 2 * L, wid: 2 * Wd, a, core: S.a * core, cu: Math.min(1, cl / L), cv: Math.min(1, cw / Wd), h };
  }

  // A FLOAT'S KEEL ON A HARD FLOOR (the shed: a seaplane stands level on its keels, the flat from its end to the step
  // the lowest line - _cage_float.js). k: { x, z, ax: [x, z], L: the flat's length, W: the keel's width, B: the beam },
  // h its height over the floor. The core is the flat's strip, the halo reaches past it by a share of the beam.
  function keelBlob(k, h, gy, n) {
    if (!(h < S.reach)) return null;
    // the halo past the hull's chines (0.8 beam a side): from the floor of a shed the hull hides everything under its own beam
    const L = (0.5 * k.L + 0.5 * k.B), Wd = (0.5 * k.W + 0.8 * k.B);
    const core = S.core * (1 - sstep(0, S.coreReach, h)), a = S.a * S.halo * (1 - sstep(0, S.reach, h));
    if (!(a > 0.002) && !(core > 0.002)) return null;
    return { kind: 'keel', x: k.x, z: k.z, gy, n: n || UP, ax: k.ax, len: 2 * L, wid: 2 * Wd, a, core: S.a * core,
             cu: Math.min(1, (0.5 * k.L + 0.04 * k.B) / L), cv: Math.min(1, (0.5 * k.W + 0.06 * k.B) / Wd), h };
  }

  // A LIST OF TYRES over a ground: wheels [{ x, y, z, R, W?, ax? }] (the hub), ground { h(x, z), n?(x, z) },
  // o.axis the aeroplane's rolling direction [x, z] (a wheel's own ax wins). The body's blob under the wheels' mean.
  function blobsAt(wheels, ground, o) {
    const out = [];
    if (!S.on || !wheels || !wheels.length || !ground || !ground.h) return out;
    let ax = (o && o.axis) || [1, 0];
    const axl = Math.hypot(ax[0], ax[1]) || 1; const axN = [ax[0] / axl, ax[1] / axl];
    let sx = 0, sz = 0, sh = 0, cnt = 0; const xs = [];
    for (const w of wheels) {
      const gy = ground.h(w.x, w.z);
      if (!Number.isFinite(gy)) continue;
      const h = w.y - w.R - gy;
      sx += w.x; sz += w.z; sh += Math.max(0, h); cnt++; xs.push([w.x, w.z]);
      const b = wheelBlob(w, h, w.x, w.z, gy, ground.n ? ground.n(w.x, w.z) : UP, w.ax || axN);
      if (b) out.push(b);
    }
    if (cnt >= 2 && S.body > 0) {
      const cx = sx / cnt, cz = sz / cnt, hm = sh / cnt;
      let wb = 0, tr = 0;                                   // the wheelbase along the axis, the track across it
      for (const q of xs) for (const q2 of xs) {
        const dx = q2[0] - q[0], dz = q2[1] - q[1];
        wb = Math.max(wb, Math.abs(dx * axN[0] + dz * axN[1])); tr = Math.max(tr, Math.abs(-dx * axN[1] + dz * axN[0]));
      }
      const a = S.body * fall(hm, S.bodyReach);
      if (a > 0 && wb > 0.3) out.push({ kind: 'body', x: cx, z: cz, gy: ground.h(cx, cz), n: ground.n ? ground.n(cx, cz) : UP, ax: axN, len: S.bodyLen * wb, wid: S.bodyWid * Math.max(tr, 0.8), a, core: 0, cu: 0, cv: 0 });
    }
    return out;
  }

  // THE BLOBS OF ONE AEROPLANE IN THE WORLD. The wheels: refs.mains and refs.tw, each at its node, its tyre's bottom
  // the node less its drawn radius, on terrainH; on floats (sim.hydro) or over drawn water there is no wheel on the
  // ground to darken.
  const _wh = [];
  function blobsFor(sim, def, world, o) {
    if (!S.on || !sim || !def || !world || !world.terrainH || sim.hydro) return [];
    const H = world.terrainH, p = sim.p, R = def.refs || {}, tW = (o && o.tyreW) || null;
    const ids = (R.mains || []).concat(R.tw != null && R.tw >= 0 ? [R.tw] : []);
    if (!ids.length) return [];
    _wh.length = 0;
    for (const i of ids) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      if (world.waterH) { const wy = world.waterH(x, z); if (Number.isFinite(wy) && wy > H(x, z)) continue; }
      _wh.push({ x, y, z, R: def.nodes[i].r || 0.1, W: tW && tW[i] > 0 ? tW[i] : 0 });
    }
    return blobsAt(_wh, { h: H, n: (x, z) => normalAt(H, x, z) }, o);
  }

  const api = { S, MAX, make, update, blobsFor, blobsAt, wheelBlob, keelBlob, normalAt, VS, FS };
  if (typeof window !== 'undefined') window.CONTACT_SHADOW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
