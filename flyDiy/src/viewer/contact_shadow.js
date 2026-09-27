// ============================================================
// CONTACT SHADOW (A6-GROUND G1002, the Jolene playtest: "the planes feel floaty when taxiing ... someone asked
// whether the plane was taking off while it was taxiing"). The eye reads a wheel as ON the ground when the ground
// darkens where the tyre meets it - the occlusion a sun shadow map cannot draw (its texel is a hand's width, and
// its bias leaves a sliver of light under a tyre that A6-SHADOW is closing from its side). This is that
// darkening, and only that: a small soft blob straight under each tyre, on the ground the wheel stands on, its
// strength falling with the tyre's height over that ground and gone by `reach` (0.5 m); and one very soft,
// larger blob under the fuselage while it is near the ground (gone by `bodyReach`).
//
// ONE DRAW: an InstancedMesh of a unit quad, one instance per blob, a per-instance strength (aA), a radial
// falloff in the fragment shader, black under normal alpha blending, no depth write, drawn after the pavement
// (renderOrder 4; the pavement is 1.99-3). The quad lies on the ground's plane (the normal from terrainH's own
// differences) and runs with the aeroplane's axis. The data is the physics' own: the wheel node, its drawn
// radius (tools/ground_gap.js: the drawn tyre is on its node within 5 mm) and terrainH - the surface the wheel
// stands on, which is the drawn pavement's since G1001 (tools/ground_surface.js). No shadow-map work.
//
//   CONTACT_SHADOW.make(THREE)                     -> the mesh (the caller adds it to the world's scene)
//   CONTACT_SHADOW.update(THREE, mesh, blobs)      blobs: [{ x, z, gy, n: [nx, ny, nz], ax: [x, z], len, wid, a }]
//   CONTACT_SHADOW.blobsFor(sim, def, world, o)    the blobs of one aeroplane (the wheels + the body), or []
//   CONTACT_SHADOW.S                               the dials: on, a, reach, len, wid, lift, body, bodyReach
// Loads in node (module.exports) for GATE CONTACT.
// ============================================================
(function () {
  const S = { on: true, a: 0.6, reach: 0.5, len: 2.1, wid: 1.4, minWid: 0.14, lift: 0.006, body: 0.24, bodyReach: 3.0, bodyLen: 1.5, bodyWid: 1.25 };
  const MAX = 8;
  const VS = [
    'attribute float aA;',
    'varying vec2 vUv;',
    'varying float vA;',
    '#include <common>',
    '#include <logdepthbuf_pars_vertex>',
    'void main() {',
    '  vUv = uv; vA = aA;',
    '  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <logdepthbuf_vertex>',
    '}'].join('\n');
  const FS = [
    'varying vec2 vUv;',
    'varying float vA;',
    '#include <common>',
    '#include <logdepthbuf_pars_fragment>',
    'void main() {',
    '  #include <logdepthbuf_fragment>',
    '  float d = length(vUv * 2.0 - 1.0);',
    '  float f = 1.0 - smoothstep(0.0, 1.0, d);',
    '  gl_FragColor = vec4(0.0, 0.0, 0.0, vA * f * f);',   // a soft core, no rim
    '}'].join('\n');

  function make(THREE) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);                                 // lies in x-z, faces +y
    const A = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    if (A.setUsage && THREE.DynamicDrawUsage) A.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aA', A);
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(g, m, MAX);
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.renderOrder = 4; mesh.name = 'contact:blobs'; mesh.matrixAutoUpdate = false;
    mesh.userData.aA = A;
    return mesh;
  }

  // the instances, written in place: position on the ground (+ lift along its normal), x along the axis (len),
  // z across it (wid), y the normal
  const M16 = new Float32Array(16);
  function update(THREE, mesh, blobs) {
    if (!mesh) return;
    const A = mesh.userData.aA, n = Math.min(MAX, blobs ? blobs.length : 0);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const b = blobs[i];
      if (!(b.a > 0.002)) continue;
      const nx = b.n[0], ny = b.n[1], nz = b.n[2];
      // the axis on the ground's plane: ax - (ax.n) n, then across = n x fwd
      let fx = b.ax[0], fy = 0, fz = b.ax[1];
      const dn = fx * nx + fz * nz; fx -= dn * nx; fy -= dn * ny; fz -= dn * nz;
      const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      const rx = ny * fz - nz * fy, ry = nz * fx - nx * fz, rz = nx * fy - ny * fx;
      const L = b.len, W = b.wid;
      M16[0] = fx * L; M16[1] = fy * L; M16[2] = fz * L; M16[3] = 0;
      M16[4] = nx; M16[5] = ny; M16[6] = nz; M16[7] = 0;
      M16[8] = rx * W; M16[9] = ry * W; M16[10] = rz * W; M16[11] = 0;
      M16[12] = b.x + nx * S.lift; M16[13] = b.gy + ny * S.lift; M16[14] = b.z + nz * S.lift; M16[15] = 1;
      mesh.instanceMatrix.array.set(M16, k * 16);
      A.array[k] = Math.min(1, b.a);
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
  const fall = (h, reach) => { const t = Math.max(0, Math.min(1, h / reach)); return (1 - t) * (1 - t); };

  // THE BLOBS OF ONE AEROPLANE. The wheels: refs.mains and refs.tw, each at its node, its tyre's bottom the node
  // less its drawn radius; on floats (sim.hydro) or over drawn water there is no wheel on the ground to darken.
  // The body: under the mean of the wheels, as long as the wheelbase, as wide as the track, by the mean height.
  function blobsFor(sim, def, world, o) {
    const out = [];
    if (!S.on || !sim || !def || !world || !world.terrainH || sim.hydro) return out;
    const H = world.terrainH, p = sim.p, R = def.refs || {};
    const ids = (R.mains || []).concat(R.tw != null && R.tw >= 0 ? [R.tw] : []);
    if (!ids.length) return out;
    let ax = (o && o.axis) || null;
    if (!ax) { ax = [1, 0]; }
    let axl = Math.hypot(ax[0], ax[1]) || 1; const axN = [ax[0] / axl, ax[1] / axl];
    let sx = 0, sz = 0, sh = 0, cnt = 0, xs = [];
    for (const i of ids) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], r = def.nodes[i].r || 0.1;
      const gy = H(x, z);
      if (world.waterH) { const wy = world.waterH(x, z); if (Number.isFinite(wy) && wy > gy) continue; }
      const h = y - r - gy;
      sx += x; sz += z; sh += Math.max(0, h); cnt++; xs.push([x, z]);
      const a = S.a * fall(h, S.reach);
      if (a <= 0) continue;
      out.push({ x, z, gy, n: normalAt(H, x, z), ax: axN, len: S.len * r, wid: Math.max(S.minWid, S.wid * r), a });
    }
    if (cnt >= 2 && S.body > 0) {
      const cx = sx / cnt, cz = sz / cnt, hm = sh / cnt;
      let wb = 0, tr = 0;                                   // the wheelbase along the axis, the track across it
      for (const q of xs) for (const q2 of xs) {
        const dx = q2[0] - q[0], dz = q2[1] - q[1];
        wb = Math.max(wb, Math.abs(dx * axN[0] + dz * axN[1])); tr = Math.max(tr, Math.abs(-dx * axN[1] + dz * axN[0]));
      }
      const a = S.body * fall(hm, S.bodyReach);
      if (a > 0 && wb > 0.3) out.push({ x: cx, z: cz, gy: H(cx, cz), n: normalAt(H, cx, cz), ax: axN, len: S.bodyLen * wb, wid: S.bodyWid * Math.max(tr, 0.8), a });
    }
    return out;
  }

  const api = { S, MAX, make, update, blobsFor, normalAt, VS, FS };
  if (typeof window !== 'undefined') window.CONTACT_SHADOW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
