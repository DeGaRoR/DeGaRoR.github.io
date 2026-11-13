#!/usr/bin/env node
// CONVOY SHOT (CAR-3, 13 Nov; the user: "do a little render of the van pulling the tow's trailer, adapted for cars
// (with a foldable ramp), with the roadster on the trailer please"): a portrait of THREE vehicles in the real page,
// headless Chromium (SwiftShader) - a tow car, the launch trailer in its car-deck dress (src/vehicle/trailer_model.js,
// fit.kind 'car') and a car on its deck.
//   1. the CARGO build comes in through the fleet's Import (#gFile), and its drawn meshes are SNAPSHOT (geometry copied,
//      the materials shared) into its gear layer's frame (the layers' metres: the contacts' and the ball's) - its crew left out (skinned: a copy would stand in the bind pose);
//   2. the TOW build comes in the same way and stays live on the stand;
//   3. the trailer is built to the cargo (its axles, track, tyre, length) and coupled to the tow's drawn ball
//      (window.CAGE_GEAR_HITCH), straight behind; the cargo stands on the deck, its axles either side of the tandem;
//   4. plane_shot.js's own PORTRAIT routine (its dark studio, its key and rim, the 2x supersample) frames the lot.
// Serve the REPO ROOT first:  python3 -m http.server 8765 --bind 127.0.0.1
//   node tools/convoy_shot.js <tow.json> <cargo.json> <out.png> [yaw/el/fov ...] [--ramp down]
// Writes <out>.png per view (<out>_<yaw>.png when several).
'use strict';
const fs = require('fs'), path = require('path');
const pw = require('playwright');
const args = process.argv.slice(2);
const rI = args.indexOf('--ramp'), RAMP = rI >= 0 ? args.splice(rI, 2)[1] : 'up';
const [TOW, CARGO, OUT, ...VIEWS] = args;
if (!TOW || !CARGO || !OUT) { console.error('usage: node tools/convoy_shot.js <tow.json> <cargo.json> <out.png> [yaw/el/fov ...] [--ramp down]'); process.exit(2); }
const views = (VIEWS.length ? VIEWS : ['145/8/28']).map(v => v.split('/').map(Number));
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tools', 'plane_shot.js'), 'utf8');
const m = src.match(/const PORTRAIT_BODY = `([\s\S]*?)`;\n/);
if (!m) { console.error('no PORTRAIT_BODY in plane_shot.js'); process.exit(1); }
const PORTRAIT_BODY = m[1];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw.chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const logs = []; page.on('pageerror', e => logs.push('PAGEERROR ' + e.message.slice(0, 300)));
  const t0 = Date.now(), el = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  await page.goto('http://127.0.0.1:8765/flyDiy/dev.html?profile=phone&gfx=laptop&intro=0&idle=0&phmat=full', { waitUntil: 'load', timeout: 300000 });
  for (let i = 0; i < 600; i++) {
    if (await page.evaluate(() => !!(document.getElementById('gFile') && window.GARAGE_SPEC && window.CAGE_UI_SCENE && window.FLIGHT_PROBE && window.BOOT && BOOT.state === 'gone')).catch(() => false)) break;
    await sleep(2000);
  }
  console.log('garage up', el());
  await page.addScriptTag({ path: path.join(ROOT, 'src', 'vehicle', 'trailer_model.js') });
  const load = async f => {
    await page.setInputFiles('#gFile', path.resolve(f));
    for (let i = 0; i < 150; i++) {
      const st = await page.evaluate(() => { const G = window.CAGE_GEAR; return { car: window.VEHICLE_KIND ? VEHICLE_KIND(GARAGE_SPEC.get()) : null, n: G && G.contacts ? G.contacts.length : 0 }; }).catch(() => ({}));
      if (st.car === 'car' && st.n === 4) break; await sleep(1000);
    }
    await sleep(12000);
  };
  await load(CARGO);
  // the cargo's snapshot: its drawn meshes (the crew's skinned figures out), its contacts, its box - in the cage's frame
  const cargo = await page.evaluate(() => {
    const root = window.CAGE_UI_SCENE; root.updateMatrixWorld(true);
    // (the gear layer's frame: the layers' metres, the contacts' own - the cage root carries the build's scale)
    let gear = null; root.traverse(o => { if (o.name === 'cageLayer:gear') gear = o; });
    const inv = new THREE.Matrix4().copy((gear || root).matrixWorld).invert();
    const g = new THREE.Group(); g.name = 'convoy:cargo';
    const vis = o => { for (let a = o; a && a !== root; a = a.parent) if (!a.visible) return false; return true; };
    // ITS OWN MATERIALS (the user: "the car has lost its livery"): the garage CACHES materials across builds (64 of
    // the roadster's 106 came back on the van) and the skin's hook reads the build-wide uniforms BY REFERENCE
    // (userData.aeroD - the livery's), so the next load repainted the snapshot. Each material is duplicated the
    // skin's own way (AEROSKIN.aeroDupe: the hook and its cache key kept) with DEEP copies of both uniform sets, their
    // textures redrawn into canvases of their own
    // (r186: a clone SHARES its Source - setting the copy's image repointed the original, and the van wore the
    // roadster's livery: the copy gets a Source of its own)
    const cpTex = t => { const t2 = t.clone(), im = t.image; let img = null;
      if (im && im.getContext) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); img = c; }
      else if (im && im.data && im.width) img = { data: im.data.slice(), width: im.width, height: im.height, depth: im.depth };
      if (img) { if (THREE.Source) t2.source = new THREE.Source(img); else t2.image = img; }
      t2.needsUpdate = true; return t2; };
    const cpVal = v => v && v.isTexture ? cpTex(v) : (v && typeof v.clone === 'function') ? v.clone() : Array.isArray(v) ? v.map(cpVal) : (v && v.buffer && v.slice) ? v.slice() : v;
    const cpU = U => { if (!U) return U; const o = {}; for (const k in U) o[k] = { value: cpVal(U[k] && U[k].value) }; return o; };
    const dupe = window.AEROSKIN && AEROSKIN.aeroDupe, made = new Map();
    const own = m => { if (!m) return m; if (made.has(m)) return made.get(m);
      let m2;
      if (dupe && m.userData && (m.userData.aeroU || m.userData.aeroD)) { m2 = dupe(m); m2.userData.aeroU = cpU(m.userData.aeroU); m2.userData.aeroD = cpU(m.userData.aeroD); }
      else { m2 = m.clone(); if (m.onBeforeCompile) m2.onBeforeCompile = m.onBeforeCompile; }
      for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap', 'alphaMap', 'aoMap']) if (m[k] && m[k].isTexture) m2[k] = cpTex(m[k]);
      made.set(m, m2); return m2; };
    let n = 0; const box = new THREE.Box3(), gb = new THREE.Box3();
    root.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !vis(o) || o.isInstancedMesh) return;
      const M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const c = new THREE.Mesh(o.geometry.clone(), Array.isArray(o.material) ? o.material.map(own) : own(o.material)); c.matrixAutoUpdate = false; c.matrix.copy(M);
      c.castShadow = o.castShadow; c.receiveShadow = o.receiveShadow; g.add(c); n++;
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox(); gb.copy(c.geometry.boundingBox).applyMatrix4(M); box.union(gb);
    });
    window.__convoyCargo = g;
    // the tyres as DRAWN: each wheel group's first mesh (the tyre) - its centre and radius (a contact's point is the
    // axle's hub, not the tyre's mid-plane)
    const C = [];
    root.traverse(o => { if (!/^edWheel[LRT]$/.test(o.name || '') || !o.children[0] || !vis(o)) return;
      const tb = new THREE.Box3().setFromObject(o.children[0]).applyMatrix4(inv), c = tb.getCenter(new THREE.Vector3());
      C.push({ p: [c.x, c.y, c.z], R: (tb.max.y - tb.min.y) / 2, w: tb.max.x - tb.min.x }); });
    if (C.length < 4) for (const q of (window.CAGE_GEAR.contacts || [])) C.push({ p: q.p.slice(), R: q.R, w: 0.16 });
    return { n, C, box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z] };
  });
  console.log('cargo snapshot', el(), cargo.n, 'meshes');
  await load(TOW);
  const lay = await page.evaluate(([cargo, ramp]) => {
    const root = window.CAGE_UI_SCENE, G = window.CAGE_GEAR;
    const tow = (G.contacts || []).map(q => ({ p: q.p, R: q.R }));
    const yG = Math.min(...tow.map(q => q.p[1] - q.R));
    const ball = window.CAGE_GEAR_HITCH; if (!ball) throw new Error('the tow build draws no hitch ball');
    // the cargo's axles (its cage frame: z forward)
    const zs = cargo.C.map(q => q.p[2]), zR = Math.min(...zs), zF = Math.max(...zs);
    const rearC = cargo.C.filter(q => Math.abs(q.p[2] - zR) < 0.05), frontC = cargo.C.filter(q => Math.abs(q.p[2] - zF) < 0.05), yC = Math.min(...cargo.C.map(q => q.p[1] - q.R));
    const trOf = L => Math.max(0.6, 2 * Math.max(...L.map(q => Math.abs(q.p[0]))));
    const wb = zF - zR, trackR = trOf(rearC), trackF = trOf(frontC), track = Math.max(trackR, trackF), tyreR = Math.max(...cargo.C.map(q => q.R));
    const xR = 0.25 - wb / 2;                               // the axles straddle the tandem, a little weight on the ball
    const car = { xR, xF: xR + wb, track, trackF, trackR, tyreR, tyreW: Math.max(...cargo.C.map(q => q.w || 0.16)), x0: xR + (cargo.box[2] - zR), x1: xR + (cargo.box[5] - zR) };
    const wheelR = 0.31, axleDx = 0.82, wheelZ = Math.max(0.78, Math.min(0.86, track / 2 - 0.05));
    const Ld = Math.max(car.x1 + 0.1, car.xF + tyreR + 0.5, axleDx / 2 + wheelR + 0.4) + 1.05;
    const Tr = { fit: { kind: 'car', car, Ld }, wheelR, wheelZ, axleDx, ballH: ball[1] - yG, ramp };
    const T = buildTrailerModel(THREE, Tr);
    // the trailer's frame in the cage's: +x forward = cage +z, +y up, +z right = cage -x; its origin under the axles,
    // the ball (trailer x = Ld) on the tow's ball
    const z0 = ball[2] - Ld;
    T.group.matrix.makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(0, yG, z0);
    T.group.matrixWorldNeedsUpdate = true;
    let gear = null; root.traverse(o => { if (o.name === 'cageLayer:gear') gear = o; });
    const hold = new THREE.Group(); hold.name = 'convoy'; (gear || root).add(hold); hold.add(T.group);
    // LEVEL IT: the garage keeps the craft still and tilts the GROUND to its stance, so the two axles' ground points
    // stand at different heights in the cage's frame - a turn about x puts both tyres' bottoms on one line
    const bot = L => { const q = L[0]; return [q.p[1] - q.R, q.p[2]]; };
    const [yr, zr] = bot(rearC), [yf, zf] = bot(frontC);
    const a = Math.atan((yr - yf) / ((zr - zf) || 1));   // (a slope: atan, not atan2 - the run is negative)
    const rot = (y, z) => [y * Math.cos(-a) - z * Math.sin(-a), y * Math.sin(-a) + z * Math.cos(-a)];
    const [yr2] = rot(yr, zr), [, zAx2] = rot(rearC[0].p[1], rearC[0].p[2]);
    const cg = window.__convoyCargo; cg.rotation.x = -a; cg.position.set(0, yG + T.stats.deckY - yr2, z0 + xR - zAx2); hold.add(cg);
    return { levelDeg: +(a * 180 / Math.PI).toFixed(2), rear: rearC.map(q => q.p.map(v => +v.toFixed(3)).concat([+q.R.toFixed(3)])), front: frontC.map(q => q.p.map(v => +v.toFixed(3)).concat([+q.R.toFixed(3)])), yG, ball, Ld, deckY: T.stats.deckY, car, tris: T.stats.tris };
  }, [cargo, RAMP]);
  console.log('convoy', el(), JSON.stringify(lay));
  for (const [yaw, elv, fov] of views) {
    const o = { kind: 'hero', yaw, el: elv, fov: fov || 28, fill: 0.9, w: 1800, h: 1000, ss: 2, bg0: '#2b2724', bg1: '#0a0908', key: 2.2, rim: 2.6 };
    const r = await page.evaluate(`(() => { const body = ${PORTRAIT_BODY}; return body(${JSON.stringify(o)}, window.CAGE_UI_SCENE, null); })()`);
    const f = views.length > 1 ? OUT.replace(/\.png$/, '') + '_' + yaw + '.png' : OUT;
    fs.writeFileSync(f, Buffer.from(r.a, 'base64'));
    console.log('wrote', f, el(), 'eye', JSON.stringify(r.eye), 'dist', r.dist);
  }
  if (logs.length) console.log(logs.slice(-5).join('\n'));
  await b.close();
})().catch(e => { console.error('CONVOY', e); process.exit(1); });
