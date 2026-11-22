#!/usr/bin/env node
// GARAGE-VIEW, step 2: THE CAPTURE - one page run on the GPU (tools/page_rig.js, RIG-PROCEDURE.md) that brings back
// everything the hangars' outdoor scene is built and judged from:
//   graph    the world scene's graph (names, types) and the drawn forest (TREE_FILL.census), as census.js does in node
//   refs     THE REFERENCE VIEWS: the game's world from each hangar's door - the same eyes as the garage (the door's
//            centre at 1.7 m straight out, 45 deg left and right, a higher eye), at each asked hour, the player's
//            aeroplane and the people hidden
//   card     a CALIBRATION CARD (grey steps and ground colours as an sRGB texture on a Standard material, flat on the
//            apron) shot from above at each hour: what a known texture value becomes under the world's light and tone
//            map - the bridge from a captured ground pixel back to a texture value, and from the world's light to the garage's
//   ground   THE GROUND FROM ABOVE in tiles (the user, 22 Nov: "a high resolution picture right in front of the garage,
//            where it will be seen closeup, and merge with a global lower resolution one for the whole pavement"): the
//            eye straight down (the free eye at -1.5 rad; every tile's camera matrices are kept, the tiles are
//            rectified against the measured terrain by ground_merge.js), trees, vehicles, aeroplanes, people and the
//            3D grass hidden - the ground alone. NEAR tiles from 12 m (about 1.1 cm a pixel) in front of each door,
//            MID from 120 m (11 cm) over the whole pavement, WIDE from 1200 m
//   trees    the impostor sheets of the species the census found (albedo + normal), for the far trees' cards
//   garage   TODAY'S GARAGE from the same eyes (before the flight: the page boots in the shed; FLYDIY_ROOM_EYE), the club
//            and the large hangar (GARAGE_ENV.setShell), at each asked hour - the 'before' of every side by side
//   slices   WHAT STANDS LOW BETWEEN THE APRON AND THE TREES, IN LAYERS: the shrubs, the ferns, the flowers, the rocks, the
//            barrels, the fences, the lights - the cover ring and the small props, which no list exports - as the game draws
//            them from the middle of the sheds, cut into rings of distance by the camera's near and far planes (60-95,
//            95-135, 135-185, 185-250, 250-700 m). Each ring twice: with them, and with everything that stands hidden (the
//            ground alone): the difference is the layer. Trees, buildings and vehicles are out of both (they are cards and
//            real shapes). Under a covered sky, like the props, with their card.
//   far      THE FAR WORLD AS A BAND: from the middle of the two sheds, all round, everything nearer than 700 m clipped
//            away (the camera's near plane: the sky's dome goes with it), with and without the aerial perspective, and
//            the same frames with the whole scene hidden (the background, to cut the band out); a 30 degree lens
//
//   node tools/garage_view/capture.js --measure <dir with measure.json> --out <dir> [--do graph,refs,card,ground,trees]
//        [--times now,noon,golden,night] [--cap 1380] [--hide hide.json] [--q k=v] [--page index.html]
// A GPU RUN: only in a slot from A0, under ONE cpu token, the gpu lock taken inside the slot script (boxlock.sh).
// Everything is written as it comes (capture.json is rewritten after every step): a run cut by its cap keeps what it got.
'use strict';
const fs = require('fs'), path = require('path');
const T = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const MDIR = opt('measure', path.join(T, 'perf', 'garage_view')), OUT = opt('out', path.join(MDIR, 'capture'));
const DO = opt('do', 'refs,card,ground,props,trees,far').split(','), TIMES = opt('times', 'now,noon,golden,night').split(',');
const CAP = +opt('cap', 1380);
const TAGS = opt('tag', 'today').split(',');   // the garage step's pictures: 'today' (the room as it is), 'gview' (the cooked scene switched on), or both in one boot
const M = JSON.parse(fs.readFileSync(path.join(MDIR, 'measure.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

// WHAT IS NOT THE GROUND (hidden for the top-down tiles), by the scene's own names; --hide file.json replaces the list.
// refs hide only the player's aeroplane and the people.
const HIDE_DEF = {
  // (the world scene's inventory, 22 Nov: the trees are the fill's instanced meshes (userData.fill / .ser) and 'treeRungs'; everything
  // that stands is under 'premises:houses' (houses, props, parked aircraft), 'propInstances', 'shed:*'; the ground is the terrain tiles,
  // 'premises:ground' / ':lots' / ':roads' (their rails and poles apart), 'pavement:*', 'ground:*'; the cars' prints stay)
  ground: ['^treeRungs', '^shed:', '^shell:', '^propInst', '^prop:', '^premises:(houses|trees|traffic|animals|life|town|tram)$', '^rocks', '^rock-ring', '^cliffs', '^contact:', '^coverRing', '^cover:',
    '^parked', '^resident:', '^crowd', '^animal', '^fleetStand', '^rail:', '^poles:', '^powerline', '^scar:', '^dust'],
  groundUD: ['fill', 'ser', 'rwyLight', 'rwyGlow'],
  refs: ['^crowd'],
};
const HIDE = opt('hide') ? JSON.parse(fs.readFileSync(opt('hide'), 'utf8')) : HIDE_DEF;

const S = M.sheds;
const toWorld = (Sd, lx, lz) => { const c = Math.cos(Sd.ry), s = Math.sin(Sd.ry); return [Sd.x + lx * c + lz * s, Sd.z - lx * s + lz * c]; };
const floorY = Sd => (Sd.ySite !== null && Sd.ySite !== undefined ? Sd.ySite : Sd.y);
// the free eye's yaw for a world direction (devCam: fwd = (sin yaw cos p, sin p, -cos yaw cos p))
const yawOf = (dx, dz) => Math.atan2(dx, -dz);

// ---- the page's half ---------------------------------------------------------------------------------------------
const PAGE = `(() => {
  if (window.GV) return 'GV ok (again)';
  const AA = window.FLYDIY_AA; let scene = null; const prev = AA.render;
  let lastPj = null;
  AA.render = function (s, cam) { const world = s && s.isScene && s !== (FLIGHT_PROBE.hangarScene && FLIGHT_PROBE.hangarScene()); if (world) scene = s;
    // a rig's lens for this frame only (GV.over = { near, fov }): set as the frame is drawn, put back after it
    let sv = null; if (GV.over && world && cam && cam.isPerspectiveCamera) { sv = [cam.near, cam.fov, cam.far]; if (GV.over.near) cam.near = GV.over.near; if (GV.over.far) cam.far = GV.over.far; if (GV.over.fov) cam.fov = GV.over.fov; cam.updateProjectionMatrix(); lastPj = { pj: Array.from(cam.projectionMatrix.elements), fov: cam.fov, near: cam.near }; }
    // THE HIDE, ENFORCED: what GV.hide named goes down for THIS draw and comes back after it (the fill's partition, the LODs and
    // the thrift set .visible themselves every frame); the lights' shadows at strength 0 for the draw (a uniform: no program moves)
    let en = null; const E = GV.enforce;
    if (world && (E || GV.enforceSolo)) { en = [];
      if (E && E.all) { for (const o of s.children) if (o.visible && !o.isLight) { o.visible = false; en.push(o); } }
      else if (E) s.traverse(o => { if (o === s || !o.visible) return; const n = o.name || '';
        if ((n && E.re.some(r => r.test(n))) || E.uds.some(k => o.userData && o.userData[k] !== undefined && (o.isMesh || o.isInstancedMesh))) { o.visible = false; en.push(o); const k = n.replace(/[:|].*/, ':') || ('(ud ' + o.type + ')'); E.by[k] = (E.by[k] || 0) + 1; } });
      if (GV.enforceSolo) for (const o of GV.enforceSolo) if (o.visible) { o.visible = false; en.push(o); }
      if (E && E.noShadow) s.traverse(o => { if (o.isLight && o.shadow && o.shadow.intensity !== undefined) { en.push([o, o.shadow.intensity]); o.shadow.intensity = 0; } });
      if (E) E.frames++; }
    const r = prev.apply(this, arguments);
    if (en) for (const x of en) { if (Array.isArray(x)) x[0].shadow.intensity = x[1]; else x.visible = true; }
    if (sv) { cam.near = sv[0]; cam.fov = sv[1]; cam.far = sv[2]; cam.updateProjectionMatrix(); }
    return r; };
  const hidden = [];
  const GV = {
    scene: () => scene,
    cam: () => { const c = FLIGHT_PROBE.camera(); c.updateMatrixWorld(); const O = GV.over && lastPj ? lastPj : null; return { mw: Array.from(c.matrixWorld.elements), pj: O ? O.pj : Array.from(c.projectionMatrix.elements), fov: O ? O.fov : c.fov, aspect: c.aspect, near: O ? O.near : c.near, far: c.far, over: !!O,
      pos: [c.position.x, c.position.y, c.position.z], canvas: [FLYDIY_RENDERER.domElement.width, FLYDIY_RENDERER.domElement.height], exposure: FLYDIY_RENDERER.toneMappingExposure }; },
    // hide what a name pattern or a userData key names, from now on, at every draw (the render wrap enforces it); a second call adds
    // to the first. o.noShadow: the sun's shadows off too. -> the count so far by name (of the last frames drawn)
    hide: (pats, uds, o) => { const E = GV.enforce || (GV.enforce = { re: [], uds: [], by: {}, frames: 0, noShadow: false, all: false });
      for (const p of pats || []) E.re.push(new RegExp(p)); for (const k of uds || []) if (!E.uds.includes(k)) E.uds.push(k); if (o && o.noShadow) E.noShadow = true; E.by = {}; E.frames = 0; return { patterns: E.re.length, keys: E.uds.length, noShadow: E.noShadow }; },
    hidden: () => { const E = GV.enforce; if (!E || !E.frames) return {}; const o = {}; for (const k of Object.keys(E.by)) o[k] = Math.round(E.by[k] / E.frames); return o; },
    show: () => { GV.enforce = null; return 1; },
    hideAll: () => { GV.enforce = { re: [], uds: [], by: {}, frames: 0, noShadow: false, all: true }; return 1; },
    craft: v => true,   // (never hidden: slot 1)
    graph: () => { const sig = o => { const m = Array.isArray(o.material) ? o.material[0] : o.material, g = o.geometry;
      return [o.name ? o.name.replace(/[:|].*/, ':*') : '-', o.type, o.isInstancedMesh ? 'inst' : '', m ? m.type + (m.name ? ':' + m.name : '') : '', g ? Object.keys(g.attributes || {}).sort().join('+') : '', Object.keys(o.userData || {}).slice(0, 6).join(','), 'ro' + (o.renderOrder || 0), o.visible ? '' : 'HIDDEN', m && m.transparent ? 'transp' : '', m && m.userData && m.userData.progOwner ? 'own=' + m.userData.progOwner : ''].join('|'); };
    const V3 = new THREE.Vector3();
    const row = (o, d) => { const r = { n: o.name || '', s: sig(o), k: o.children.length, v: o.visible ? 1 : 0, groups: {}, ch: [] };
      for (const c of o.children) { if (c.children.length && d < 5) r.ch.push(row(c, d + 1)); else { const s = sig(c), G = r.groups[s] || (r.groups[s] = { n: 0, p: [] }); G.n++;
        if (G.p.length < 3) { c.getWorldPosition(V3); let rad = 0; if (c.geometry) { if (!c.geometry.boundingSphere) c.geometry.computeBoundingSphere(); rad = c.geometry.boundingSphere ? c.geometry.boundingSphere.radius : 0; } G.p.push([+V3.x.toFixed(0), +V3.y.toFixed(0), +V3.z.toFixed(0), +rad.toFixed(0), c.isInstancedMesh ? c.count : 0]); } } }
      return r; };
      return scene ? row(scene, 0) : null; },
    // the world boxes of what stands at given places (buildings, vehicles): the scene's objects whose own origin is within r
    boxes: (list, r) => { const B = new THREE.Box3(), P = new THREE.Vector3(), out = []; if (!scene) return out;
      const cand = []; scene.traverse(o => { if (o.name && /^(item:|prop:|parkedAt:|shed:|houses:near)/.test(o.name)) cand.push(o); });
      for (const it of list) { let best = null, bd = r; for (const o of cand) { o.getWorldPosition(P); const d = Math.hypot(P.x - it.x, P.z - it.z); if (d < bd) { bd = d; best = o; } }
        if (best) { B.setFromObject(best); out.push({ id: it.id, name: best.name, d: +bd.toFixed(2), min: B.min.toArray().map(v => +v.toFixed(2)), max: B.max.toArray().map(v => +v.toFixed(2)) }); } else out.push({ id: it.id, name: null }); }
      return out; },
    // THE CARD: 6 x 4 patches of sRGB texture values on a Standard material, flat on the ground at (x, z), turned by yaw
    card: (x, y, z, yaw, size) => { if (GV._card) { GV._card.visible = true; return GV._cardInfo; }
      const cols = [[0,0,0],[36,36,36],[73,73,73],[109,109,109],[146,146,146],[182,182,182],[219,219,219],[255,255,255],
        [70,90,50],[100,120,70],[130,150,90],[90,105,60],[120,110,80],[150,140,110],[100,85,65],[140,120,95],
        [150,148,141],[120,118,112],[90,88,84],[180,178,170],[200,60,50],[60,120,200],[230,200,60],[128,128,128]];
      const cv = document.createElement('canvas'); cv.width = 96; cv.height = 64; const g = cv.getContext('2d');
      cols.forEach((c, i) => { g.fillStyle = 'rgb(' + c.join(',') + ')'; g.fillRect((i % 6) * 16, Math.floor(i / 6) * 16, 16, 16); });
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
      const geo = new THREE.PlaneGeometry(size * 1.5, size); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat); m.name = 'gv:card'; m.position.set(x, y, z); m.rotation.y = yaw; m.receiveShadow = true; m.castShadow = false; scene.add(m);
      GV._card = m; GV._cardInfo = { cols, at: [x, y, z], yaw, w: size * 1.5, h: size, grid: [6, 4] }; return GV._cardInfo; },
    cardOff: () => { if (GV._card) GV._card.visible = false; return !!GV._card; },
    // WHAT STANDS NEAR: the direct children of 'premises:houses' (a house's bag group, a prop's LOD, a parked aircraft) and the
    // world's own sheds, within r of (x, z) -> [{ i, name, c: [x, y, z] box centre, r: its radius, min, max }]
    things: (x, z, r) => { const out = [], B = new THREE.Box3(), C = new THREE.Vector3(), S3 = new THREE.Vector3(); GV._things = [];
      const MB = new THREE.Box3();
      const body = o => { B.makeEmpty(); const bag = !!(o.userData && o.userData.bagMeshes); o.updateMatrixWorld(true);
        o.traverse(m => { if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return; const mat = Array.isArray(m.material) ? m.material[0] : m.material;
          if (mat && (mat.transparent && !mat.alphaTest) && m.renderOrder > 0) return; if (bag && !(m.userData && m.userData.merged) && !m.visible) return;
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); MB.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); B.union(MB); }); };
      const take = o => { body(o); if (B.isEmpty()) B.setFromObject(o); if (B.isEmpty()) return; B.getCenter(C); B.getSize(S3); if (Math.hypot(C.x - x, C.z - z) > r) return;
        GV._things.push(o); out.push({ i: GV._things.length - 1, name: o.name || (o.children[0] && o.children[0].name) || '', ud: Object.keys(o.userData || {}).slice(0, 5).join(','), c: C.toArray().map(v => +v.toFixed(2)), r: +(S3.length() / 2).toFixed(2), min: B.min.toArray().map(v => +v.toFixed(2)), max: B.max.toArray().map(v => +v.toFixed(2)) }); };
      scene.traverse(o => { if (o.name === 'premises:houses') for (const c of o.children) take(c); else if (/^shed:/.test(o.name || '')) take(o); });
      return out; },
    // one thing alone among its kind: its siblings (the other things within reach) go down at every draw, until solo(null)
    solo: i => { const T = GV._things || []; if (i == null) { GV.enforceSolo = null; return 0; } GV.enforceSolo = T.filter((o, k) => k !== i); return GV.enforceSolo.length; },
    // its drawn triangles NOW (the visible meshes under it, the instances stood, world metres): positions + normals + index, base64
    mesh: i => { const o = (GV._things || [])[i]; if (!o) return null; const P = [], Nn = [], I = [], parts = []; const v = new THREE.Vector3(), n = new THREE.Vector3(), M4 = new THREE.Matrix4(), N3 = new THREE.Matrix3();
      const vis = m => { for (let q = m; q && q !== o.parent; q = q.parent) if (!q.visible) return false; return true; };
      o.updateMatrixWorld(true);
      // (a HOUSE is drawn through a merged batch: its own meshes stay under its bag group, hidden, flagged merged - they are its shape)
      const bag = !!(o.userData && o.userData.bagMeshes);
      o.traverse(m => { if (!(m.isMesh) || !m.geometry || !m.geometry.attributes.position || !(vis(m) || (bag && m.userData && m.userData.merged))) return; const mat = Array.isArray(m.material) ? m.material[0] : m.material;
        if (mat && (mat.transparent && !mat.alphaTest) && m.renderOrder > 0) return;   // the glows and the AO skirts: decals, not the body
        const g = m.geometry, pa = g.attributes.position, na = g.attributes.normal, ix = g.index, cnt = m.isInstancedMesh ? m.count : 1;
        for (let k = 0; k < cnt; k++) { if (m.isInstancedMesh) { m.getMatrixAt(k, M4); M4.premultiply(m.matrixWorld); } else M4.copy(m.matrixWorld); N3.getNormalMatrix(M4);
          const base = P.length / 3;
          for (let j = 0; j < pa.count; j++) { v.fromBufferAttribute(pa, j).applyMatrix4(M4); P.push(v.x, v.y, v.z); if (na) { n.fromBufferAttribute(na, j).applyMatrix3(N3).normalize(); Nn.push(n.x, n.y, n.z); } else Nn.push(0, 1, 0); }
          const dr = g.drawRange || { start: 0, count: Infinity }, tot = ix ? ix.count : pa.count, e = Math.min(tot, dr.start + dr.count);
          for (let j = dr.start; j + 2 < e; j += 3) I.push(base + (ix ? ix.getX(j) : j), base + (ix ? ix.getX(j + 1) : j + 1), base + (ix ? ix.getX(j + 2) : j + 2)); }
        parts.push({ n: m.name || '', mat: mat ? mat.type + (mat.name ? ':' + mat.name : '') : '', verts: pa.count * cnt, alphaTest: mat ? mat.alphaTest || 0 : 0, side: mat ? mat.side : 0 }); });
      const b64 = a => { let s = ''; const u = new Uint8Array(a.buffer); for (let q = 0; q < u.length; q += 32768) s += String.fromCharCode.apply(null, u.subarray(q, q + 32768)); return btoa(s); };
      return JSON.stringify({ verts: P.length / 3, tris: I.length / 3, parts, pos: b64(new Float32Array(P)), nrm: b64(new Float32Array(Nn)), idx: b64(new Uint32Array(I)) }); },
    day: () => { const d = FLIGHT_PROBE.world().day; return { sunEl: d.sunEl, cloudCover: d.cloudCover, cloudType: d.cloudType, sun: d.sun ? Array.from(d.sun.toArray ? d.sun.toArray() : d.sun) : null, local: d.localHours, utc: d.utc, turbidity: d.turbidity }; },
  };
  window.GV = GV; return 'GV ok';
})()`;

(async () => {
  const RIG = require(path.join(T, 'page_rig.js'));
  const t0 = Date.now(), log = (...a) => console.log('[gv ' + ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + ' s]', ...a);
  const META = { what: 'GARAGE-VIEW capture', made: new Date().toISOString(), do: DO, times: TIMES, hide: HIDE, steps: {}, grabs: [] };
  const save = () => fs.writeFileSync(path.join(OUT, 'capture.json'), JSON.stringify(META));
  const rig = await RIG.start({ cap: CAP, size: '1600x900', q: opt('q', ''), page: opt('page', 'index.html'), name: 'garage-view' });
  let rc = 0;
  // a page call's value as JSON (a call that already returns JSON text is taken as it is); ms: its own time limit
  const JJ = async (expr, ms) => { const t = await rig.ev('Promise.resolve(' + expr + ').then(v => typeof v === "string" ? v : JSON.stringify(v === undefined ? null : v))', ms); return t == null ? null : JSON.parse(t); };
  // THE PAGE'S LIGHT STATE in one line (the renderer's exposure and its parts, the sky's scale, the eased lights, the day): read in the
  // garage and in the world at the same hour, the two lines name the factor a picture cannot (22 Nov: the night's sky blown out in the garage)
  const STATE_JS = '(() => { const o = {}; try { const R = window.FLYDIY_RENDERER, G = window.GFX, A = window.ATMO, L = window.LIGHT_RIG, E = window.LIGHT_EASE, d = FLIGHT_PROBE.world().day;' +
    ' o.tmExp = R ? R.toneMappingExposure : null; o.base = G && G.exposureBase ? G.exposureBase() : null; o.eye = G && G.eye ? G.eye() : null; o.P = L && L.P ? L.P() : null;' +
    ' o.scale = A && A.U ? A.U.scale.value : null; o.lutGain = A && A.U && A.U.lutGain ? A.U.lutGain.value : null; o.stars = A && A.U && A.U.stars ? A.U.stars.value : null; o.eMoon = A && A.U && A.U.eMoon ? A.U.eMoon.value : null;' +
    ' o.ap = A && A.apUniforms ? Array.from(A.apUniforms.uAtmoAP.value) : null; o.mist = A && A.apUniforms ? Array.from(A.apUniforms.uMist.value).slice(0, 16) : null;' +
    ' o.le = E ? { on: E.on, sunI: E.sunI, hemiI: E.hemiI, ex: E.ex, tEx: E.tEx } : null; o.rig = window.WORLD_RIG && WORLD_RIG.worldAlbedo ? (w => ({ hemiI: w.hemiI, gnd: w.gnd }))(WORLD_RIG.worldAlbedo()) : null;' +
    ' o.day = { sunEl: d.sunEl, utc: d.utc, moonPhase: d.moonPhase, moonEl: d.moon ? Math.asin(d.moon[1]) * 57.2958 : null, cloudCover: d.cloudCover };' +
    ' o.nightEye = L && L.nightU ? Array.from(L.nightU.uNightEye.value.toArray ? L.nightU.uNightEye.value.toArray() : L.nightU.uNightEye.value) : null; } catch (e) { o.err = e.message; } return JSON.stringify(o); })()';
  try {
    META.gpu = rig.gpu; save();
    // ---- TODAY'S GARAGE, from the same eyes (the page boots in the shed) ---------------------------------------------------
    if (DO.includes('garage')) {
      const info = async () => JJ('(() => { const D = GARAGE_ENV._debug && GARAGE_ENV._debug(), h = D && D.hangar; return JSON.stringify(h ? { shell: h.shell || (GARAGE_ENV.shell && GARAGE_ENV.shell()), dims: h.dims, door: h.door, body: document.body.className, fov: FLIGHT_PROBE.camGet().fov, day: (() => { const d = FLIGHT_PROBE.world().day; return { sunEl: d.sunEl, cloudCover: d.cloudCover }; })() } : { err: "no room", body: document.body.className }); })()');
      const gshot = async (name, extra) => { const b = await rig.grab({ craft: false, settle: 10 }); fs.writeFileSync(path.join(OUT, name + '.png'), b); META.grabs.push(Object.assign({ name, info: b.info }, extra)); if (b.info.blank) { log('BLANK ' + name); META.blank = (META.blank || 0) + 1; } };
      const utc0 = await JJ('FLIGHT_PROBE.world().day.utc');
      // THE ROOMS ARE THE SITE'S SHEDS, each at its own plot (the player's document through the rigs' door, FLYDIY_PLAYER.set:
      // a plot not held is acquired with the site's shell, then the garage goes there as the map's "go" does). The first
      // run of 22 Nov stood both shells at HOME: the large hangar's views were 70 m off its own door.
      const doc0 = await JJ('JSON.stringify(window.FLYDIY_PLAYER ? FLYDIY_PLAYER.doc() : null)');
      const FIELD = (M.site && M.site.field) || 'HOME';
      const roomAt = async (id, shell) => JJ(`(async () => { try { const P = window.FLYDIY_PLAYER, id = ${JSON.stringify(id)}, shell = ${JSON.stringify(shell)}, field = ${JSON.stringify(FIELD)}; let d = P.doc();
          if (!d.sheds[id]) {
            // (the plot's shed as playerAcquire writes it - the shell's dims with the plot's own over them, its kits - WITHOUT the price book:
            //  playerAcquire's plotPrice calls econShellPrice, the career's, which the sandbox page does not define - 22 Nov, every room but HOME refused)
            const O = typeof BASE_OFFERS !== 'undefined' ? BASE_OFFERS[field] : null, PL = O && O.plots ? O.plots[id] : null, SH = typeof SHELLS !== 'undefined' ? SHELLS[shell] : null;
            if (!PL || !SH) return JSON.stringify({ ok: false, why: 'no offer for ' + field + ' / ' + id + ', or no shell ' + shell });
            d.sheds[id] = { shell, kits: (PL.kits || (typeof HANGAR_KITS_DEFAULT !== 'undefined' ? HANGAR_KITS_DEFAULT : [])).slice(), base: field, tenure: 'own',
              dims: Object.assign({}, SH.dims, (PL.dims && PL.dims[shell]) || {}), price: 0, since: Math.round(d.clock || 0) };
            P.set(d); }
          if (P.doc().here !== id) { const g = await P.gotoGarage(id); if (!g.ok && g.why !== 'you are there') return JSON.stringify({ ok: false, why: 'goto: ' + g.why }); }
          const sh = P.doc().sheds[id]; let set = '';
          if (sh.shell !== shell) set = String(GARAGE_ENV.setShell(shell));
          return JSON.stringify({ ok: true, here: P.doc().here, shell: P.doc().sheds[id].shell, base: sh.base, set }); } catch (e) { return JSON.stringify({ ok: false, why: e.message }); } })()`, 160000);
      const ROOMS = opt('rooms') ? opt('rooms').split(',') : null;   // (--rooms HOME: only these sheds' rooms)
      for (const TAG of TAGS) for (const Rm of S) { const shell = Rm.shell || 'club'; if (ROOMS && !ROOMS.includes(Rm.id)) continue;
        if (TAG === 'gview') await rig.ev('window.FLYDIY_GVIEW_ON = true');
        { const r = await roomAt(Rm.id, shell); log('garage: room ' + Rm.id + ' (' + shell + ') -> ' + JSON.stringify(r)); await rig.frames(60); await rig.settleLoad(); await rig.frames(120);
          if (!r || !r.ok) { META.steps['garage_' + TAG + '_' + shell] = { err: 'room ' + Rm.id + ': ' + (r && r.why) }; save(); continue; } }
        const I = await info(); log('garage ' + shell + ': ' + JSON.stringify(I)); if (!I || I.err) { META.steps['garage_' + TAG + '_' + shell] = I; continue; }
        // the cooked scene, when this run asks for it (?gview=1): wait for it to land in THIS room (30 s), and say what it is
        if (TAG === 'gview' || /gview=1/.test(opt('q', ''))) { let G = null; for (let k = 0; k < 30 && !G; k++) { G = await JJ('(() => { const g = window.FLYDIY_GVIEW, h = GARAGE_ENV._debug().hangar; return JSON.stringify(g && h.gview && h.gview() ? { stats: g.stats, buildMs: g.buildMs, shedWorld: h.shedWorld() } : null); })()'); if (!G) await rig.frames(30); }
          I.gview = G; log('garage ' + shell + ': gview ' + JSON.stringify(G)); await rig.frames(90); }
        const HD = I.dims.HD, HWd = I.dims.HW;
        // (--variants file.json: a list of garage_view.js S overrides shot from the same eyes, the first entry null = as it stands; --varviews: which views)
        const VARS = opt('variants') ? JSON.parse(fs.readFileSync(opt('variants'), 'utf8')) : [null], VARV = opt('varviews', 'door_out,inside').split(',');
        const S0G = TAG === 'gview' && VARS.length > 1 ? await JJ('JSON.stringify(GARAGE_VIEW.S)') : null;
        for (const tm of TIMES) {
          // 'now' is the hour the page booted in (put back for the second pass: the first one ends at night)
          if (tm === 'now') await rig.ev('(() => { try { DAY_CLOCK.set({ utc: ' + utc0 + ' }); return 1; } catch (e) { return 0; } })()');
          else await rig.ev(`(() => { try { DAY_CLOCK.preset(${JSON.stringify(tm)}); return 1; } catch (e) { return 0; } })()`);
          await rig.frames(90); await rig.settleLoad(); await rig.frames(60);
          if (TAG === 'gview') { const st = await JJ('(() => { const h = GARAGE_ENV._debug().hangar; return JSON.stringify(h.gviewState ? h.gviewState() : null); })()'); (META.steps.gvstate = META.steps.gvstate || {})[shell + '_' + tm] = st; log('gview state ' + shell + ' ' + tm + ': ' + JSON.stringify(st).slice(0, 520));
            const ps = await JJ(STATE_JS); (META.steps.pstate = META.steps.pstate || {})['garage_' + shell + '_' + tm] = ps; log('page state garage ' + shell + ' ' + tm + ': ' + JSON.stringify(ps)); }
          const V = [['door_out', -HD - 0.3, 1.7, 0, 0], ['door_left', -HD - 0.3, 1.7, 0, -45], ['door_right', -HD - 0.3, 1.7, 0, 45], ['door_high', -HD - 0.3, 4.0, 0, 0], ['inside', HD * 0.55, 2.2, -HWd * 0.25, null], ['back', -HD * 0.55, 1.8, 0, 180], ['back_high', HD - 2.5, (I.dims.EAVE || 6) - 1.3, 0, 180]];   // (back_high: 2.5 m from the window, past the lamps)
          for (let vk = 0; vk < VARS.length; vk++) { const VT = TAG + (vk ? 'v' + vk : '');
            if (TAG === 'gview' && VARS.length > 1) { await rig.ev('Object.assign(GARAGE_VIEW.S, ' + JSON.stringify(Object.assign({}, S0G, VARS[vk] || {})) + ')'); await rig.frames(90); log('variant ' + vk + ': ' + JSON.stringify(VARS[vk])); }
            else if (vk) break;
          for (const [vn, lx, ey, lz, az] of (vk ? V.filter(q => VARV.includes(q[0])) : V)) {
            // (back: the eye looks at the back wall's high window from the floor; back_high: level through it, the eye at its height)
            const a = az === null ? -Math.atan2(HWd * 0.25, HD * 1.55) : az * Math.PI / 180, t = vn === 'back' ? [HD, (I.dims.EAVE || 6) - 1.3, 0] : vn === 'back_high' ? [HD + 50, ey - 1.0, 0] : [lx - Math.cos(a) * 50, ey - 1.0, lz - Math.sin(a) * 50];
            await rig.ev('FLYDIY_ROOM_EYE(' + JSON.stringify([lx, ey, lz]) + ', ' + JSON.stringify(t) + ')'); await rig.frames(16);
            await gshot(VT + '_' + tm + '_' + shell + '_' + vn, { kind: 'garage', tag: VT, time: tm, shell, view: vn, eyeRoom: [lx, ey, lz], az: az === null ? +(a * 180 / Math.PI).toFixed(1) : az });
          }
          }
          if (TAG === 'gview' && VARS.length > 1) { await rig.ev('Object.assign(GARAGE_VIEW.S, ' + JSON.stringify(S0G) + ')'); await rig.frames(30); }
        }
        META.steps['garage_' + TAG + '_' + shell] = I; save();
      }
      await rig.ev('FLYDIY_ROOM_EYE(null)');
      // (the player's document as it was found, the garage back where it stood)
      if (doc0) await JJ('(async () => { try { FLYDIY_PLAYER.set(' + JSON.stringify(doc0) + '); if (FLYDIY_PLAYER.doc().here !== ' + JSON.stringify(doc0.here || 'HOME') + ') await FLYDIY_PLAYER.gotoGarage(' + JSON.stringify(doc0.here || 'HOME') + '); DAY_CLOCK.preset("afternoon"); return 1; } catch (e) { return 0; } })()', 160000); await rig.frames(60); await rig.settleLoad();
    }
    // a run that asked for the garage's pictures only ends here (no flight)
    if (!DO.some(k => k !== 'garage')) { META.done = true; META.seconds = Math.round((Date.now() - t0) / 1000); save(); log('done (the garage only): ' + META.grabs.length + ' grabs, ' + (META.blank || 0) + ' blank, ' + META.seconds + ' s'); await rig.close(); process.exit(0); }
    await rig.fly(); await rig.pause();
    // the player's aeroplane off the stand: on the ground 30 m BEHIND the large hangar, paused - out of every door view and off the
    // apron (slot 1, 22 Nov: with it placed 400 m up and hidden the page stopped answering; nothing is hidden or lifted now)
    { const SL = S[S.length - 1], q = toWorld(SL, SL.HD + 30, 0); await rig.place(q[0], q[1], 1.2, 30); }   // (the LAST shed of the site: one shed is its own last)
    // ALIVE: two frames drawn within 20 s, or the step that came before is named and the run stops (a page that hangs holds the slot)
    const alive = async tag => { try { await rig.ev('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))', 20000); } catch (e) { log('NOT ALIVE after ' + tag); META.hungAfter = tag; save(); throw new Error('the page stopped drawing after: ' + tag); } };
    log(await rig.ev(PAGE)); await rig.frames(4);
    META.plane = rig.plane; META.cam0 = await JJ('JSON.stringify(GV.cam())'); META.day0 = await JJ('JSON.stringify(GV.day())');
    log('flying, paused; fov ' + META.cam0.fov + ', canvas ' + META.cam0.canvas + ', day ' + JSON.stringify(META.day0));
    const grab = async (name, extra) => {
      const b = await rig.grab({ craft: false, settle: 6 });
      fs.writeFileSync(path.join(OUT, name + '.png'), b);
      const cam = await JJ('JSON.stringify(GV.cam())');
      const g = Object.assign({ name, info: b.info, cam }, extra || {}); META.grabs.push(g); if (b.info.blank) { log('BLANK ' + name); META.blank = (META.blank || 0) + 1; }
      return g;
    };
    const eyeAt = async (x, y, z, yaw, pitch, settle) => { await rig.eye(x, y, z, yaw, pitch); await rig.frames(settle || 20); };
    const setTime = async t => { if (t === 'now') return 'now';
      const r = await rig.ev(`(() => { try { DAY_CLOCK.preset(${JSON.stringify(t)}); return 'preset ' + ${JSON.stringify(t)}; } catch (e) { return 'FAILED ' + e.message; } })()`);
      await rig.frames(30); await rig.settleLoad(); await rig.frames(60); return r; };
    // THE SITE MAY BE FAR FROM WHERE THE PAGE BOOTED (the Cabin Strip is 16 km from HOME): the eye stands at the first door and
    // turns once round, the loads settle, before any picture - the fill plants its trees round the eye, the world streams by distance
    { const Sd = S[0], y0 = floorY(Sd) + 1.7, yw = yawOf(Sd.doorDir.x, Sd.doorDir.z);
      for (let k = 0; k < 4; k++) { await eyeAt(Sd.doorCentre.x, y0, Sd.doorCentre.z, yw + k * Math.PI / 2, -0.02, 40); await rig.settleLoad(); }
      await eyeAt(Sd.doorCentre.x, y0, Sd.doorCentre.z, yw, -0.02, 120); await rig.settleLoad(); await alive('the warm-up at the site'); log('warm at the site (' + Sd.id + ')'); }

    // ---- the world's own light state at each hour, and one picture from the first door (the garage's twin lines: 'page state garage') --------
    if (DO.includes('probe')) for (const tm of TIMES) { const Sd = S[0];
      await setTime(tm); await eyeAt(Sd.doorCentre.x, floorY(Sd) + 1.7, Sd.doorCentre.z, yawOf(Sd.doorDir.x, Sd.doorDir.z), -0.02, 300);   // (300 frames: the eased lights and the eye settle)
      const ps = await JJ(STATE_JS); (META.steps.pstate = META.steps.pstate || {})['world_' + tm] = ps; save(); log('page state world ' + tm + ': ' + JSON.stringify(ps));
      await grab('probe_' + tm + '_door_out', { kind: 'probe', time: tm }); }

    // ---- graph + census + the boxes of what stands there --------------------------------------------------------------
    if (DO.includes('graph')) {   // (slot 1 brought the graph, the census and the boxes: not asked again by default)
      const G = await JJ('JSON.stringify(GV.graph())', 60000); fs.writeFileSync(path.join(OUT, 'scene_graph.json'), JSON.stringify(G));
      const h = 1500, cx = M.mid.x, cz = M.mid.z;
      const C = await JJ(`(() => { const L = TREE_FILL.census ? TREE_FILL.census(${cx - h}, ${cz - h}, ${cx + h}, ${cz + h}) : null; if (!L) return JSON.stringify(null);
        const keys = [], ki = new Map(), flat = []; for (const t of L) { if (!ki.has(t.key)) { ki.set(t.key, keys.length); keys.push(t.key); }
          flat.push(ki.get(t.key), t.ser, +t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2), +t.yaw.toFixed(3), +t.s.toFixed(3), +t.sy.toFixed(3), +t.h.toFixed(2), t.town); }
        return JSON.stringify({ n: L.length, keys, rec: 10, trees: flat }); })()`, 120000);
      if (C) { fs.writeFileSync(path.join(OUT, 'census.json'), JSON.stringify(Object.assign({ what: 'GARAGE-VIEW census (the game page, GPU run)', box: [cx - h, cz - h, cx + h, cz + h], fields: ['key', 'ser', 'x', 'y', 'z', 'yaw', 's', 'sy', 'h', 'town'] }, C))); }
      const things = M.buildings.map((b, i) => ({ id: 'b' + i, x: b.x, z: b.z })).concat(M.objects.filter(o => o.kind === 'aircraft' || /^(auto_|truck_|machine_)/.test(o.key)).map(o => ({ id: o.id, x: o.x, z: o.z })), S.map(s => ({ id: 'shed:' + s.id, x: s.x, z: s.z })));
      META.boxes = await JJ('JSON.stringify(GV.boxes(' + JSON.stringify(things) + ', 6))', 60000);
      META.steps.graph = { top: G ? G.k : null, census: C ? C.n : null, species: C ? C.keys.length : null, boxes: META.boxes.filter(b => b.name).length + '/' + META.boxes.length }; log('graph ' + JSON.stringify(META.steps.graph)); save();
    }

    // ---- the card's place: on the apron, 60 m straight out of the club's door (past the near tiles; hidden in every other picture) --
    // THE CARD LIES ON OPEN GROUND, AT THE GROUND'S OWN HEIGHT (the Cabin Strip, 22 Nov: 60 m out of the door at the shed's floor height was a
    // forested slope - the card stood buried under a tree, every curve read off it was noise: a white strip, a blue cabin, blue summits).
    // sites/<pack>.json card: { out } says how far out of the first door (default 60: an apron); over a grass strip it floats 0.6 m (the blades)
    const cardAt = await (async () => { const out = (M.site && M.site.card && +M.site.card.out) || 60, p = toWorld(S[0], -S[0].HD - out, 0), gy = await JJ(`FLIGHT_PROBE.world().terrainH(${p[0]}, ${p[1]})`);
      return { x: p[0], z: p[1], y: (Number.isFinite(gy) ? gy : floorY(S[0])) + ((M.site && M.site.ground && M.site.ground.cover) ? 0.6 : 0.03), yaw: S[0].ry }; })();
    const shootCard = async (tag, h) => {
      await JJ(`JSON.stringify(GV.card(${cardAt.x}, ${cardAt.y}, ${cardAt.z}, ${cardAt.yaw}, 4))`);
      await eyeAt(cardAt.x, cardAt.y + (h || 12), cardAt.z, yawOf(S[0].doorDir.x, S[0].doorDir.z), -1.5, 30);
      const g = await grab('card_' + tag, { kind: 'card', time: tag, h: h || 12, card: await JJ('JSON.stringify(GV._cardInfo)') }); await rig.ev('GV.cardOff()'); return g; };

    // ---- the ground from above ---------------------------------------------------------------------------------------------
    let groundDone = false;
    const ground = async (r) => { groundDone = true;
      // no cloud shadow in the ground's pictures: the cover to 0 for the tiles and their card, put back after
      const cc0 = (await JJ('JSON.stringify(GV.day())')).cloudCover; await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: 0 })'); await rig.frames(60);
      const day = await JJ('JSON.stringify(GV.day())');
      await rig.ev('GV.craft(false)');
      await shootCard('ground12', 12); await shootCard('ground120', 120);
      // (a site whose ground IS its low cover - a grass strip: sites/<pack>.json ground: { cover: true } - keeps the cover ring in the tiles:
      //  seen from above the blades are the ground's colour; the Cabin Strip's first tiles, 22 Nov, came out bare and pale without them)
      const HG = (M.site && M.site.ground && M.site.ground.cover) ? HIDE.ground.filter(q => !/cover/.test(q)) : HIDE.ground;
      await JJ('JSON.stringify(GV.hide(' + JSON.stringify(HG) + ', ' + JSON.stringify(HIDE.groundUD) + ', { noShadow: true }))'); await rig.frames(6);
      const hid = await JJ('JSON.stringify(GV.hidden())'); log('ground: ' + r + '; hidden a frame (no sun shadow) ' + JSON.stringify(hid)); await alive('ground hide');
      const cam = META.cam0, tanV = Math.tan(cam.fov * Math.PI / 360), asp = cam.canvas[0] / cam.canvas[1];
      // a tile set: the eye h over the ground, straight down, the picture's top toward the club door's line; the tiles
      // overlap by 12 %. `rect` in a shed's room frame [lx0, lx1, lz0, lz1], or a world box round the middle
      const tiles = async (tag, h, pts, yaw) => { let n = 0; for (const q of pts) { const gy = await JJ(`FLIGHT_PROBE.world().terrainH(${q[0]}, ${q[1]})`);
          await eyeAt(q[0], gy + h, q[1], yaw, -1.5, h > 300 ? 60 : 16); if (h > 300 && n === 0) await rig.settleLoad();
          await grab('ground_' + tag + '_' + String(n).padStart(2, '0'), { kind: 'ground', set: tag, h, at: [q[0], gy, q[1]] }); n++; } return n; };
      const fp = h => [2 * h * tanV, 2 * h * tanV * asp];   // the footprint: along the eye's up (the picture's height), across
      const yawD = yawOf(S[0].doorDir.x, S[0].doorDir.z);
      // (the frames' sizes are the SITE's: sites/<pack>.json through measure.json; the first site's as the defaults)
      const SN = Object.assign({ out: 46, in: 6, side: 10 }, (M.site && M.site.near) || {}), SM = Object.assign({ u: 560, v: 460, out: 110 }, (M.site && M.site.mid) || {});
      // NEAR: 12 m up, in front of each door: 6 m inside the sill to 46 m out, the door's width + 10 m each side
      for (const Sd of S) { const [fu, fa] = fp(12), st = [fu * 0.88, fa * 0.88], pts = [];
        const x0 = -Sd.HD - SN.out, x1 = -Sd.HD + SN.in, z0 = -Sd.door.w / 2 - SN.side, z1 = Sd.door.w / 2 + SN.side;
        for (let lx = x1 - fu / 2; lx > x0 - st[0] / 2; lx -= st[0]) for (let lz = z0 + fa / 2 - 2; lz < z1 + st[1] / 2; lz += st[1]) pts.push(toWorld(Sd, lx, lz));
        const n = await tiles('near_' + Sd.id.replace(/\W/g, '_'), 12, pts, yawD); META.steps['ground_near_' + Sd.id] = { tiles: n, footprint: [fu, fa], rect: [x0, x1, z0, z1] }; save(); log('near ' + Sd.id + ': ' + n + ' tiles'); }
      // MID: 120 m up, the whole pavement: 560 x 460 m round the two sheds' middle, pushed 110 m out of the doors
      { const [fu, fa] = fp(120), st = [fu * 0.88, fa * 0.88], pts = [], c = [M.mid.x + S[0].doorDir.x * SM.out, M.mid.z + S[0].doorDir.z * SM.out], d = [S[0].doorDir.x, S[0].doorDir.z], t = [-d[1], d[0]];
        for (let u = -SM.u / 2 + fu / 2; u < SM.u / 2 + st[0] / 2; u += st[0]) for (let v = -SM.v / 2 + fa / 2; v < SM.v / 2 + st[1] / 2; v += st[1]) pts.push([c[0] + d[0] * u + t[0] * v, c[1] + d[1] * u + t[1] * v]);
        const n = await tiles('mid', 120, pts, yawD); META.steps.ground_mid = { tiles: n, footprint: [fu, fa], centre: c }; save(); log('mid: ' + n + ' tiles'); }
      // WIDE: 1200 m up, one picture over the middle, and one 800 m out of the doors
      { const d = [S[0].doorDir.x, S[0].doorDir.z]; const n = await tiles('wide', 1200, [[M.mid.x + d[0] * 200, M.mid.z + d[1] * 200], [M.mid.x + d[0] * 1000, M.mid.z + d[1] * 1000]], yawD); META.steps.ground_wide = { tiles: n, footprint: fp(1200) }; save(); log('wide: ' + n + ' tiles'); }
      await rig.ev('GV.show()'); await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: ' + (+cc0 || 0) + ' })'); await rig.frames(30);
      META.steps.ground = { time: r, day, hid, cloudCoverBack: cc0 }; save();
    };

    // ---- the reference views, hour by hour -----------------------------------------------------------------------------
    if (DO.includes('refs') || DO.includes('card')) for (const tm of TIMES) {
      const r = await setTime(tm); const day = await JJ('JSON.stringify(GV.day())'); log('time ' + tm + ': ' + r + ', sunEl ' + (day.sunEl != null ? (+day.sunEl).toFixed(1) : '?') + ', cloud ' + day.cloudCover);
      const hid = {}; await alive('time ' + tm);
      if (DO.includes('card')) { await shootCard(tm); await alive('card ' + tm); }
      if (DO.includes('refs')) for (const Sd of S) {
        const V = [['door_out', -Sd.HD - 0.3, 1.7, 0, 0], ['door_left', -Sd.HD - 0.3, 1.7, 0, -45], ['door_right', -Sd.HD - 0.3, 1.7, 0, 45], ['door_high', -Sd.HD - 0.3, 4.0, 0, 0], ['apron_out', -Sd.HD - 14, 1.7, 0, 0]];
        for (const [vn, lx, ey, lz, az] of V) {
          const p = toWorld(Sd, lx, lz), a = az * Math.PI / 180, c = Math.cos(Sd.ry), s = Math.sin(Sd.ry), dl = [-Math.cos(a), -Math.sin(a)], dw = [dl[0] * c + dl[1] * s, -dl[0] * s + dl[1] * c];
          await eyeAt(p[0], floorY(Sd) + ey, p[1], yawOf(dw[0], dw[1]), -0.02, 24);
          await grab('ref_' + tm + '_' + Sd.id.replace(/\W/g, '_') + '_' + vn, { kind: 'ref', time: tm, shed: Sd.id, view: vn, eyeRoom: [lx, ey, lz], az, day });
        }
      }
      if (DO.includes('refs')) {   // WHAT STANDS BEHIND each shed (its back window): the world's own sheds hidden, the garage's two back eyes
        await JJ('JSON.stringify(GV.hide(["^shed:", "^shell:"], [], {}))'); await rig.frames(6);
        for (const Sd of S) { const wy = (Sd.EAVE || 6) - 1.3, c = Math.cos(Sd.ry), s = Math.sin(Sd.ry), yw = yawOf(c, -s);   // (room +x in the world)
          for (const [vn, lx, ey, pt] of [['back', -Sd.HD * 0.55, 1.8, Math.atan2(wy - 1.8, Sd.HD * 1.55)], ['back_high', Sd.HD - 2.5, wy, -0.02]]) { const p = toWorld(Sd, lx, 0);
            await eyeAt(p[0], floorY(Sd) + ey, p[1], yw, pt, 24);
            await grab('ref_' + tm + '_' + Sd.id.replace(/\W/g, '_') + '_' + vn, { kind: 'ref', time: tm, shed: Sd.id, view: vn, eyeRoom: [lx, ey, 0], az: 180, day }); } }
        await rig.ev('GV.show()'); await rig.frames(6); }
      META.steps['refs_' + tm] = { hid, day }; save(); log('refs ' + tm + ': ' + META.grabs.length + ' grabs so far');
      if (tm === 'noon' && DO.includes('ground')) await ground('preset noon (with the noon views)');
    }

    if (DO.includes('ground') && !groundDone) await ground(await setTime(TIMES.includes('noon') ? 'noon' : 'now'));

    // ---- what stands near: its real triangles, and its picture from each door's direction ----------------------------------------
    // (the buildings and vehicles are the game's own generators and array materials: no exporter of their materials would stay true.
    // So each is exported as GEOMETRY only and PHOTOGRAPHED from the directions the two doors see it - closer, same line of sight -
    // under a covered sky (soft, shadowless: an albedo-like picture); the cook textures the triangles by projecting them through
    // those pictures' own cameras. The card under the same sky is the bridge to texture values.)
    if (DO.includes('props')) {
      await setTime(TIMES.includes('noon') ? 'noon' : 'now');
      const cc0 = (await JJ('JSON.stringify(GV.day())')).cloudCover; await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: 1 })'); await rig.frames(90);
      await rig.ev('GV.craft(false)'); await shootCard('props', 12);
      // the eye near the things first: the houses and the props stand by distance (their LODs, the thrift)
      await eyeAt(S[0].doorCentre.x, floorY(S[0]) + 1.7, S[0].doorCentre.z, yawOf(S[0].doorDir.x, S[0].doorDir.z), -0.02, 40);
      const all = await JJ('JSON.stringify(GV.things(' + M.mid.x + ', ' + M.mid.z + ', 260))', 60000); await alive('things');
      await JJ('JSON.stringify(GV.hide(["^propInstances$", "^contact:", "^crowd", "^animal"], [], { noShadow: true }))');   // no sun shadow in the things' pictures, and nobody (nor a barrel) standing before them
      const keep = all.filter(t => t.r > 0.6 && t.r < 60 && !/^parkedAt:|person_/.test(t.name));
      log('props: ' + all.length + ' things within 260 m, ' + keep.length + ' kept (no parked aircraft, no people, nothing under 0.6 m)');
      const tanV = Math.tan(META.cam0.fov * Math.PI / 360), PR = [];
      let done = 0;
      for (const t of keep) {
        if ((Date.now() - t0) / 1000 > CAP - (+opt('reserve', 330))) { log('props: stopping at ' + done + '/' + keep.length + ' (the slot)'); break; }
        const shots = [];
        await JJ('GV.solo(' + t.i + ')');
        // from each door's eye, and from the point between them: the same line of sight, the thing filling ~60 % of the picture's height
        // (a site of ONE shed: its door, 25 m out of it, and 18 m to each side of that point - a thing wants more than one line of sight)
        const eyes = S.map(Sd => [Sd.doorCentre.x, floorY(Sd) + 1.7, Sd.doorCentre.z]); { const SL = S[S.length - 1], mx = (S[0].doorCentre.x + SL.doorCentre.x) / 2 + S[0].doorDir.x * 25, mz = (S[0].doorCentre.z + SL.doorCentre.z) / 2 + S[0].doorDir.z * 25;
          eyes.push([mx, floorY(S[0]) + 1.7, mz]); if (S.length === 1) for (const sd of [-18, 18]) eyes.push([mx - S[0].doorDir.z * sd, floorY(S[0]) + 1.7, mz + S[0].doorDir.x * sd]); }
        for (let e = 0; e < eyes.length; e++) {
          const E = eyes[e], d = [t.c[0] - E[0], t.c[1] - E[1], t.c[2] - E[2]], L = Math.hypot(d[0], d[1], d[2]); if (L < 1) continue;
          if (E[0] > t.min[0] - 2 && E[0] < t.max[0] + 2 && E[2] > t.min[2] - 2 && E[2] < t.max[2] + 2) continue;   // the eye stands in the thing itself (a shed from its own door)
          const u = d.map(v => v / L), D = Math.min(L, Math.max(t.r * 1.15, t.r / tanV / 0.6)), ex = t.c[0] - u[0] * D, ey = Math.max(t.c[1] - u[1] * D, t.min[1] + 0.4), ez = t.c[2] - u[2] * D;
          const pitch = Math.asin(Math.max(-1, Math.min(1, (t.c[1] - ey) / Math.hypot(t.c[0] - ex, t.c[1] - ey, t.c[2] - ez))));
          await eyeAt(ex, ey, ez, yawOf(u[0], u[2]), pitch, 14);
          const g = await grab('prop_' + String(t.i).padStart(2, '0') + '_' + e, { kind: 'prop', thing: t.i, eye: e, thingName: t.name }); shots.push(g.name);
        }
        // its triangles as drawn from the last eye (the LOD the doors see is the LOD exported)
        const m = await JJ('GV.mesh(' + t.i + ')', 60000);
        if (m) { fs.writeFileSync(path.join(OUT, 'prop_' + String(t.i).padStart(2, '0') + '.json'), JSON.stringify(Object.assign({ thing: t, shots }, m))); }
        PR.push({ i: t.i, name: t.name, r: t.r, c: t.c, verts: m ? m.verts : 0, tris: m ? m.tris : 0, shots }); done++;
      }
      await JJ('GV.solo(null)'); await rig.ev('GV.show()'); await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: ' + (+cc0 || 0) + ' })'); await rig.frames(30);
      META.steps.props = { all, kept: PR, cloudCoverBack: cc0 }; save(); log('props: ' + done + ' things, ' + PR.reduce((a, p) => a + p.tris, 0) + ' triangles');
    }

    // ---- what stands low, in rings of distance ------------------------------------------------------------------------------------
    if (DO.includes('slices')) {
      await setTime(TIMES.includes('noon') ? 'noon' : 'now');
      const cc0 = (await JJ('JSON.stringify(GV.day())')).cloudCover; await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: 1 })'); await rig.frames(90);
      if (!META.grabs.some(g => g.name === 'card_props')) await shootCard('props', 12);
      const SLC = (M.site && M.site.slices) || {}, RINGS = (opt('rings') ? opt('rings').split(',') : SLC.rings || [60, 72, 86, 104, 125, 150, 180, 220, 270, 340, 700]).map(Number), FOVS = +SLC.fov || 30,   // (sites/<pack>.json slices: { rings, fov } - a steep site wants a taller lens, a small one nearer rings)
       YAW0 = yawOf(S[0].doorDir.x, S[0].doorDir.z), YAWS = [-80, -40, 0, 40, 80].map(d => YAW0 + d * Math.PI / 180), gy = await JJ(`FLIGHT_PROBE.world().terrainH(${M.mid.x}, ${M.mid.z})`), eye = [M.mid.x, gy + 2.0, M.mid.z];
      const pass = async tag => { let n = 0; for (let r = 0; r + 1 < RINGS.length; r++) { if ((Date.now() - t0) / 1000 > CAP - 200) { log('slices ' + tag + ': stopping at ring ' + r + ' (the slot: the far band and the sheets come after)'); break; }
          await rig.ev('GV.over = { near: ' + RINGS[r] + ', far: ' + RINGS[r + 1] + ', fov: ' + FOVS + ' }');
          for (let k = 0; k < YAWS.length; k++) { await eyeAt(eye[0], eye[1], eye[2], YAWS[k], 0.02, k === 0 ? 24 : 8); await grab('slice_' + tag + '_' + String(r).padStart(2, '0') + '_' + k, { kind: 'slice', pass: tag, ring: r, near: RINGS[r], far: RINGS[r + 1], k, yaw: YAWS[k], eye }); n++; } } return n; };
      // the eye at the middle first: the cover ring plants round it
      await eyeAt(eye[0], eye[1], eye[2], YAW0, 0.02, 60); await rig.settleLoad(); await rig.frames(60);
      await JJ('JSON.stringify(GV.hide(' + JSON.stringify(['^treeRungs', '^premises:houses$', '^shed:', '^shell:', '^parked', '^contact:', '^fleetStand', '^animal', '^premises:(animals|life)$', '^crowd', '^resident:'])   /* (nothing alive in the rings: an elk stood baked by the Cabin Strip's tower) */ + ', ' + JSON.stringify(['fill', 'ser']) + ', { noShadow: true }))'); await rig.frames(6);
      const hidA = await JJ('JSON.stringify(GV.hidden())'); await alive('slices hide A');
      const nA = await pass('all');
      await JJ('JSON.stringify(GV.hide(' + JSON.stringify(HIDE.ground) + ', ' + JSON.stringify(HIDE.groundUD) + ', { noShadow: true }))'); await rig.frames(6);
      const hidB = await JJ('JSON.stringify(GV.hidden())'); await alive('slices hide B');
      const nB = await pass('ground');
      await rig.ev('GV.over = null'); await rig.ev('GV.show()');
      await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: ' + (+cc0 || 0) + ' })'); await rig.frames(30);
      META.steps.slices = { rings: RINGS, fov: FOVS, eye, grabs: nA + nB, hidA, hidB, cloudCoverBack: cc0 }; save(); log('slices: ' + (nA + nB) + ' grabs over ' + (RINGS.length - 1) + ' rings');
    }

    // ---- the far world as a band -------------------------------------------------------------------------------------------------
    if (DO.includes('far')) {
      await setTime(TIMES.includes('noon') ? 'noon' : 'now');
      const cc0 = (await JJ('JSON.stringify(GV.day())')).cloudCover; await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: 0 })'); await rig.frames(60);
      await rig.ev('GV.craft(false)');
      const NEARF = +opt('farnear', 700), FOVF = 30, gy = await JJ(`FLIGHT_PROBE.world().terrainH(${M.mid.x}, ${M.mid.z})`), eye = [M.mid.x, gy + 3, M.mid.z];
      await rig.ev('GV.over = { near: ' + NEARF + ', fov: ' + FOVF + ' }');
      let n = 0;
      for (const ap of [1, 0]) {
        await rig.ev('ATMO.setAP(' + (ap ? 'true' : 'false') + ')'); await rig.frames(20);
        // (the rows: one lens covers -11 .. 19 degrees; a site whose band goes higher (sites/<pack>.json far.top: a valley's summits) takes more rows, 26 degrees apart)
        const FTOP = (M.site && M.site.far && +M.site.far.top) || 13, ROWS = 1 + Math.max(0, Math.ceil((FTOP - 17) / 26));
        for (let rw = 0; rw < ROWS; rw++) for (let k = 0; k < 9; k++) { const yaw = k * 40 * Math.PI / 180, rt = rw ? 'r' + rw + '_' : '';
          await eyeAt(eye[0], eye[1], eye[2], yaw, 0.07 + rw * 26 * Math.PI / 180, 20);
          await grab('far_' + (ap ? 'ap' : 'clear') + '_' + rt + k, { kind: 'far', ap, k, row: rw, yawDeg: k * 40, near: NEARF, eye }); n++;
          if (ap === 1) { await JJ('GV.hideAll()'); await rig.frames(4); await grab('far_bg_' + rt + k, { kind: 'farbg', k, row: rw, yawDeg: k * 40 }); await rig.ev('GV.show()'); await rig.frames(4); n++; }
        }
      }
      await rig.ev('ATMO.setAP(true)'); await rig.ev('GV.over = null');
      await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: ' + (+cc0 || 0) + ' })'); await rig.frames(30);
      META.steps.far = { near: NEARF, fov: FOVF, eye, grabs: n, cloudCoverBack: cc0 }; save(); log('far: ' + n + ' grabs');
    }

    // ---- the species' impostor sheets -------------------------------------------------------------------------------------------
    if (DO.includes('trees')) {
      // TREE_FILL.sheets(): every baked sheet's facts; sheetRead(layer, which): its bytes. Kept: the sheets of the species the
      // census found within 900 m (their living 'rungs' series and their 'snag'). Each sheet travels as two opaque PNGs
      // (the colour with alpha forced to 1, the alpha as grey): a canvas would premultiply the colour away otherwise
      const sheets = await JJ('JSON.stringify(TREE_FILL.sheets ? TREE_FILL.sheets() : null)', 60000);
      fs.writeFileSync(path.join(OUT, 'sheets.json'), JSON.stringify(sheets));
      const cenF = fs.existsSync(path.join(OUT, 'census.json')) ? path.join(OUT, 'census.json') : path.join(MDIR, 'census.json');
      const want = new Set();
      if (fs.existsSync(cenF)) { const C = JSON.parse(fs.readFileSync(cenF, 'utf8')), R = C.rec; for (let i = 0; i < C.trees.length; i += R) if (Math.hypot(C.trees[i + 2] - M.mid.x, C.trees[i + 4] - M.mid.z) < 900) want.add(C.keys[C.trees[i]] + '|' + ['rungs', 'stand', 'snag'][C.trees[i + 1]]); }
      const pick = (sheets || []).filter(a => !want.size || want.has(a.key + '|' + a.series));
      log('trees: ' + (sheets ? sheets.length : 0) + ' sheets baked, ' + pick.length + ' wanted (' + want.size + ' species-series within 900 m)');
      await rig.ev(`(() => { GV.sheetPng = async (layer, which) => { const px = TREE_FILL.sheetRead(layer, which); if (!px) return null; const N = Math.round(Math.sqrt(px.length / 4));
          const enc = async alpha => { const c = new OffscreenCanvas(N, N), x = c.getContext('2d'), d = x.createImageData(N, N), o = d.data;
            for (let i = 0; i < px.length; i += 4) { if (alpha) { o[i] = o[i + 1] = o[i + 2] = px[i + 3]; } else { o[i] = px[i]; o[i + 1] = px[i + 1]; o[i + 2] = px[i + 2]; } o[i + 3] = 255; }
            x.putImageData(d, 0, 0); const b = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); };
          return JSON.stringify({ N, rgb: await enc(false), a: await enc(true) }); }; return 'ok'; })()`);
      let nS = 0;
      for (const a of pick) for (const which of ['col', 'nrm']) {
        const r = await JJ('GV.sheetPng(' + a.layer + ', ' + JSON.stringify(which) + ')', 90000); if (!r) { log('trees: no bytes for layer ' + a.layer + ' ' + which); continue; }
        const base = 'sheet_' + String(a.layer).padStart(3, '0') + '_' + which;
        fs.writeFileSync(path.join(OUT, base + '_rgb.png'), Buffer.from(r.rgb, 'base64')); fs.writeFileSync(path.join(OUT, base + '_a.png'), Buffer.from(r.a, 'base64')); nS++;
      }
      await rig.ev('FLYDIY_RENDERER.resetState && FLYDIY_RENDERER.resetState()');
      META.steps.trees = { sheets: sheets ? sheets.length : 0, wanted: pick.map(a => a.layer + ':' + a.key + '|' + a.series), saved: nS }; log('trees: ' + nS + ' sheet images saved'); save();
    }
    META.done = true; META.seconds = Math.round((Date.now() - t0) / 1000); save();
    log('done: ' + META.grabs.length + ' grabs, ' + (META.blank || 0) + ' blank, ' + META.seconds + ' s');
  } catch (e) { rc = 1; META.error = String(e && e.stack || e); try { META.why = await rig.why(); } catch (e2) {} save(); console.error('capture FAILED: ' + META.error); }
  await rig.close(); process.exit(rc);
})().catch(e => { console.error('capture FAILED (start): ' + (e && e.stack || e)); process.exit(1); });
