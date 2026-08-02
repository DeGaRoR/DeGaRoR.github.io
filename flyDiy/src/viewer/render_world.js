// ================= world rendering (shared generator) =================
// Builds every static scene element from the shared `world` object.
// Returns an object of handles for anything the render loop must animate
// (empty today; the graphic-redesign port adds clouds/shadow-frustum here).
function buildWorldScene(scene, world) {
  scene.fog = new THREE.Fog(0x0d1b2e, 400, 2900);
  scene.add(new THREE.HemisphereLight(0xaec6e8, 0x0a1626, 0.85));
  const sun = new THREE.DirectionalLight(0xffe3b8, 0.75);
  sun.position.set(-0.45, 0.8, -0.35);
  scene.add(sun);

  { // terrain mesh from world.terrainH, lit, height-banded colors
    const SEG = 200, SIZE = 9000;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const posA = geo.attributes.position, colA = [];
    const bands = [[0, 0x14304e], [40, 0x1c3c5e], [130, 0x274c72],
                   [260, 0x3c618a], [430, 0x6d8fb4]];
    const cA = new THREE.Color(), cB = new THREE.Color();
    for (let i = 0; i < posA.count; i++) {
      const x = posA.getX(i), z = posA.getZ(i);
      const h = world.terrainH(x, z);
      posA.setY(i, h);
      let k = 0;
      while (k < bands.length - 1 && h > bands[k + 1][0]) k++;
      cA.setHex(bands[k][1]);
      if (k < bands.length - 1) {
        cB.setHex(bands[k + 1][1]);
        cA.lerp(cB, Math.min(1, Math.max(0, (h - bands[k][0]) / (bands[k + 1][0] - bands[k][0]))));
      }
      colA.push(cA.r, cA.g, cA.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE),
      new THREE.MeshBasicMaterial({ color: 0x0a2036 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.4;
    scene.add(water);
  }

  { // trees from the shared world list (these are the ones you can hit)
    const geo = new THREE.ConeGeometry(1.7, 4.6, 6);
    geo.translate(0, 2.3, 0);
    const inst = new THREE.InstancedMesh(geo,
      new THREE.MeshLambertMaterial({ color: 0xffffff }), world.trees.length);
    const m4 = new THREE.Matrix4(), c3 = new THREE.Color();
    world.trees.forEach((T, i) => {
      m4.makeScale(T.s, T.s, T.s); m4.setPosition(T.x, T.h, T.z);
      inst.setMatrixAt(i, m4);
      c3.setHex(i % 2 ? 0x1e4066 : 0x275077);
      inst.setColorAt(i, c3);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }

  { // runway (polygon-offset decals: no z-fighting at distance), pylons, hangar, windsock
    const mkDecal = (w, h, color, units) => new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, polygonOffset: true,
        polygonOffsetFactor: units, polygonOffsetUnits: units }));
    const runway = mkDecal(1100, 12, 0x1a3050, -2);
    runway.rotation.x = -Math.PI / 2; runway.position.set(-520, 0.02, 0);
    scene.add(runway);
    for (let i = 0; i < 38; i++) {
      const d = mkDecal(12, 0.5, 0x3d608c, -4);
      d.rotation.x = -Math.PI / 2; d.position.set(10 - i * 28, 0.03, 0);
      scene.add(d);
    }
    const pylonGeo = new THREE.ConeGeometry(0.5, 1.6, 5);
    const pylonMat = new THREE.MeshLambertMaterial({ color: 0x557ba3 });
    for (let x = 0; x >= -1060; x -= 100) for (const zz of [7.5, -7.5]) {
      const p = new THREE.Mesh(pylonGeo, pylonMat);
      p.position.set(x, 0.8, zz); scene.add(p);
    }
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 10),
      new THREE.MeshLambertMaterial({ color: 0x1d3d61 }));
    hangar.position.set(25, 2.5, 26); scene.add(hangar);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5),
      new THREE.MeshBasicMaterial({ color: 0x5a7291 }));
    pole.position.set(-1040, 2.5, 12); scene.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 6),
      new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
    sock.rotation.z = Math.PI / 2; sock.position.set(-1038.5, 4.6, 12); scene.add(sock);
  }

  { // landing meadows: pylon ring + amber beacon at terrain height
    const beaconGeo = new THREE.ConeGeometry(1.2, 6, 6);
    const ringGeo = new THREE.ConeGeometry(0.6, 2.0, 5);
    for (const m of world.meadows) {
      const b = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
      b.position.set(m.x, m.h + 3, m.z); scene.add(b);
      for (let a = 0; a < 8; a++) {
        const px = m.x + Math.cos(a / 8 * 6.283) * m.r * 0.55;
        const pz = m.z + Math.sin(a / 8 * 6.283) * m.r * 0.55;
        const p = new THREE.Mesh(ringGeo, new THREE.MeshLambertMaterial({ color: 0x557ba3 }));
        p.position.set(px, world.terrainH(px, pz) + 1, pz); scene.add(p);
      }
    }
  }

  return {};
}
