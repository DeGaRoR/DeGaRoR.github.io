// studio.js - THE BLACK STUDIO (G3726, PHONE-GARAGE; the user, 25 Oct 2026: "no garage at all, just dark studio as we
// had said ... Everything feels laggy as it is, including dragging the controls, scrolling through them, or rotating the
// plane, so I think we should just sacrifice the garage altogether" - the M2 ruling of MOBILE-GARAGE, 4 Oct: "the
// aeroplane in a pool of light on black, key / fill / rim without shadow maps, a procedural studio PMREM, nothing else").
//
// window.STUDIO.build(THREE, renderer, scene, y) dresses `scene` (app.js's hangarScene, the room the shed would have
// stood in) and returns { group, setY(y), dispose() }:
//   - THE BLACK: scene.background a near-black of the garage's own warm ink (the --ed-board family), no fog;
//   - THE LIGHT: three DirectionalLights, no shadow maps - a warm key high at the front left, a cool fill low at the
//     right, a rim from behind - and a faint hemisphere so a face turned from all three is dark, not void;
//   - THE POOL: one transparent quad on the floor, a radial fall-off drawn once into a 128 px canvas - the ground the
//     aeroplane stands on, without a floor to light;
//   - THE REFLECTIONS: one PMREM of a tiny scene (a dark dome and three soft boxes where the lights are), baked once at
//     build - the metals catch the boxes as a studio's would. Nothing is rendered again after the build.
// The shed is never built where the studio stands (app.js getHangar asks PROFILE room 'studio'): no room, no moods, no
// shadow cache, no glass pass, no mobile kit - the frame is the aeroplane's own draws.
var STUDIO = (function () {
  'use strict';
  const BG = 0x0d0c0b, EXPOSURE = 1.0;
  function poolTexture(THREE) {
    const D = typeof document !== 'undefined' ? document : null;
    if (!D || !D.createElement || !THREE.CanvasTexture) return null;
    const c = D.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext && c.getContext('2d');
    if (!g) return null;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(232,222,206,0.30)');
    r.addColorStop(0.45, 'rgba(200,190,176,0.14)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // the reflections: a dark dome, three soft boxes, one PMREM (null when the renderer cannot)
  function bakeEnv(THREE, renderer) {
    if (!THREE.PMREMGenerator || !renderer || !renderer.setRenderTarget) return null;
    const es = new THREE.Scene(), geos = [], mats = [];
    const mk = (geo, color, side) => { const m = new THREE.MeshBasicMaterial({ color, side: side || THREE.FrontSide }); geos.push(geo); mats.push(m); return new THREE.Mesh(geo, m); };
    es.add(mk(new THREE.SphereGeometry(20, 16, 8), 0x14120f, THREE.BackSide));
    const box = (w, h, x, y, z, k) => { const b = mk(new THREE.PlaneGeometry(w, h), new THREE.Color(k, k, k), THREE.DoubleSide); b.position.set(x, y, z); b.lookAt(0, 0, 0); es.add(b); };
    box(8, 5, -8, 10, 7, 3.2);    // the key's soft box
    box(6, 3, 10, 3, 6, 1.1);     // the fill's
    box(10, 2, 3, 6, -12, 2.0);   // the rim's strip
    let rt = null;
    try { const pm = new THREE.PMREMGenerator(renderer); rt = pm.fromScene(es, 0.04); pm.dispose(); }
    catch (e) { if (typeof console !== 'undefined') console.warn('studio: no reflections -', e && e.message); }
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    return rt;
  }
  function build(THREE, renderer, scene, y) {
    // the gates' stub THREE has none of these: no studio, quietly (as genHangarSupported keeps the shed unbuilt)
    if (!THREE || !THREE.Group || !THREE.DirectionalLight || !THREE.HemisphereLight || !THREE.Color || !THREE.Mesh || !THREE.PlaneGeometry) return null;
    const group = new THREE.Group(); group.name = 'studio';
    const key = new THREE.DirectionalLight(0xfff1de, 2.8); key.position.set(-5, 8, 4);
    const fill = new THREE.DirectionalLight(0xdbe4f0, 0.8); fill.position.set(6, 2.5, 4.5);
    const rim = new THREE.DirectionalLight(0xffffff, 1.7); rim.position.set(2, 5, -7);
    for (const L of [key, fill, rim]) { L.castShadow = false; L.name = 'studio:' + (L === key ? 'key' : L === fill ? 'fill' : 'rim'); group.add(L); group.add(L.target); }
    const hemi = new THREE.HemisphereLight(0x48433c, 0x0c0b0a, 0.5); hemi.name = 'studio:hemi'; group.add(hemi);
    const tex = poolTexture(THREE);
    const poolMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: tex, transparent: true, depthWrite: false });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.002; pool.name = 'studio:pool'; pool.renderOrder = -1;
    const floor = new THREE.Group(); floor.add(pool); floor.position.y = y || 0; group.add(floor);
    scene.add(group);
    const was = { bg: scene.background, fog: scene.fog, env: scene.environment };
    scene.background = new THREE.Color(BG);
    scene.fog = null;
    const rt = bakeEnv(THREE, renderer);
    if (rt) scene.environment = rt.texture;
    return {
      group, EXPOSURE,
      setY(v) { floor.position.y = v || 0; },
      dispose() {
        scene.remove(group);
        pool.geometry.dispose(); poolMat.dispose(); if (tex) tex.dispose();
        if (rt) { if (scene.environment === rt.texture) scene.environment = was.env || null; rt.dispose(); }
        scene.background = was.bg || null; scene.fog = was.fog || null;
      },
    };
  }
  return { build, BG, EXPOSURE };
})();
if (typeof window !== 'undefined') window.STUDIO = STUDIO;
