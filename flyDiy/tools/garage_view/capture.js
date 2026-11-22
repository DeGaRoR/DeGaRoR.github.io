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
const TAG = opt('tag', 'today');   // the garage step's pictures: 'today' (the room as it is) or e.g. 'gview' (run with --q gview=1)
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
    let sv = null; if (GV.over && world && cam && cam.isPerspectiveCamera) { sv = [cam.near, cam.fov]; if (GV.over.near) cam.near = GV.over.near; if (GV.over.fov) cam.fov = GV.over.fov; cam.updateProjectionMatrix(); lastPj = { pj: Array.from(cam.projectionMatrix.elements), fov: cam.fov, near: cam.near }; }
    const r = prev.apply(this, arguments);
    if (sv) { cam.near = sv[0]; cam.fov = sv[1]; cam.updateProjectionMatrix(); }
    return r; };
  const hidden = [];
  const GV = {
    scene: () => scene,
    cam: () => { const c = FLIGHT_PROBE.camera(); c.updateMatrixWorld(); const O = GV.over && lastPj ? lastPj : null; return { mw: Array.from(c.matrixWorld.elements), pj: O ? O.pj : Array.from(c.projectionMatrix.elements), fov: O ? O.fov : c.fov, aspect: c.aspect, near: O ? O.near : c.near, far: c.far, over: !!O,
      pos: [c.position.x, c.position.y, c.position.z], canvas: [FLYDIY_RENDERER.domElement.width, FLYDIY_RENDERER.domElement.height], exposure: FLYDIY_RENDERER.toneMappingExposure }; },
    // hide every visible object whose name matches a pattern or whose userData carries a key; -> what went, by name
    hide: (pats, uds) => { const re = (pats || []).map(p => new RegExp(p)), by = {}; if (!scene) return { error: 'no scene yet' };
      scene.traverse(o => { if (!o.visible || o === scene) return; const n = o.name || '';
        const hit = (n && re.some(r => r.test(n))) || (uds || []).some(k => o.userData && o.userData[k] !== undefined && (o.isMesh || o.isInstancedMesh));
        if (hit) { o.visible = false; hidden.push(o); const k = n.replace(/[:|].*/, ':') || ('(ud ' + o.type + ')'); by[k] = (by[k] || 0) + 1; } });
      return by; },
    show: () => { const n = hidden.length; for (const o of hidden) o.visible = true; hidden.length = 0; return n; },
    hideAll: () => { let n = 0; if (scene) for (const o of scene.children) if (o.visible && !o.isLight) { o.visible = false; hidden.push(o); n++; } return n; },
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
      const take = o => { B.setFromObject(o); if (B.isEmpty()) return; B.getCenter(C); B.getSize(S3); if (Math.hypot(C.x - x, C.z - z) > r) return;
        GV._things.push(o); out.push({ i: GV._things.length - 1, name: o.name || (o.children[0] && o.children[0].name) || '', ud: Object.keys(o.userData || {}).slice(0, 5).join(','), c: C.toArray().map(v => +v.toFixed(2)), r: +(S3.length() / 2).toFixed(2), min: B.min.toArray().map(v => +v.toFixed(2)), max: B.max.toArray().map(v => +v.toFixed(2)) }); };
      scene.traverse(o => { if (o.name === 'premises:houses') for (const c of o.children) take(c); else if (/^shed:/.test(o.name || '')) take(o); });
      return out; },
    // one thing alone among its kind (its siblings hidden), or all back
    solo: i => { const T = GV._things || []; GV._solo = GV._solo || []; for (const o of GV._solo) o.visible = true; GV._solo = [];
      if (i == null) return 0; for (let k = 0; k < T.length; k++) if (k !== i && T[k].visible) { T[k].visible = false; GV._solo.push(T[k]); } return GV._solo.length; },
    // its drawn triangles NOW (the visible meshes under it, the instances stood, world metres): positions + normals + index, base64
    mesh: i => { const o = (GV._things || [])[i]; if (!o) return null; const P = [], Nn = [], I = [], parts = []; const v = new THREE.Vector3(), n = new THREE.Vector3(), M4 = new THREE.Matrix4(), N3 = new THREE.Matrix3();
      const vis = m => { for (let q = m; q && q !== o.parent; q = q.parent) if (!q.visible) return false; return true; };
      o.updateMatrixWorld(true);
      o.traverse(m => { if (!(m.isMesh) || !m.geometry || !m.geometry.attributes.position || !vis(m)) return; const mat = Array.isArray(m.material) ? m.material[0] : m.material;
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
  try {
    META.gpu = rig.gpu; save();
    // ---- TODAY'S GARAGE, from the same eyes (the page boots in the shed) ---------------------------------------------------
    if (DO.includes('garage')) {
      const info = async () => JJ('(() => { const D = GARAGE_ENV._debug && GARAGE_ENV._debug(), h = D && D.hangar; return JSON.stringify(h ? { shell: h.shell || (GARAGE_ENV.shell && GARAGE_ENV.shell()), dims: h.dims, door: h.door, body: document.body.className, fov: FLIGHT_PROBE.camGet().fov, day: (() => { const d = FLIGHT_PROBE.world().day; return { sunEl: d.sunEl, cloudCover: d.cloudCover }; })() } : { err: "no room", body: document.body.className }); })()');
      const gshot = async (name, extra) => { const b = await rig.grab({ craft: false, settle: 10 }); fs.writeFileSync(path.join(OUT, name + '.png'), b); META.grabs.push(Object.assign({ name, info: b.info }, extra)); if (b.info.blank) { log('BLANK ' + name); META.blank = (META.blank || 0) + 1; } };
      for (const shell of ['club', 'works']) {
        if (shell === 'works') { const r = await rig.ev("(() => { try { return String(GARAGE_ENV.setShell('works')); } catch (e) { return 'FAILED ' + e.message; } })()", 140000); log('garage: setShell works -> ' + r); await rig.frames(60); await rig.settleLoad(); await rig.frames(120); }
        const I = await info(); log('garage ' + shell + ': ' + JSON.stringify(I)); if (!I || I.err) { META.steps['garage_' + shell] = I; continue; }
        // the cooked scene, when this run asks for it (?gview=1): wait for it to land in THIS room (30 s), and say what it is
        if (/gview=1/.test(opt('q', ''))) { let G = null; for (let k = 0; k < 30 && !G; k++) { G = await JJ('(() => { const g = window.FLYDIY_GVIEW, h = GARAGE_ENV._debug().hangar; return JSON.stringify(g && h.gview && h.gview() ? { stats: g.stats, buildMs: g.buildMs, shedWorld: h.shedWorld() } : null); })()'); if (!G) await rig.frames(30); }
          I.gview = G; log('garage ' + shell + ': gview ' + JSON.stringify(G)); await rig.frames(90); }
        const HD = I.dims.HD, HWd = I.dims.HW;
        for (const tm of TIMES) {
          if (tm !== 'now') { await rig.ev(`(() => { try { DAY_CLOCK.preset(${JSON.stringify(tm)}); return 1; } catch (e) { return 0; } })()`); await rig.frames(90); await rig.settleLoad(); await rig.frames(60); }
          const V = [['door_out', -HD - 0.3, 1.7, 0, 0], ['door_left', -HD - 0.3, 1.7, 0, -45], ['door_right', -HD - 0.3, 1.7, 0, 45], ['door_high', -HD - 0.3, 4.0, 0, 0], ['inside', HD * 0.55, 2.2, -HWd * 0.25, null]];
          for (const [vn, lx, ey, lz, az] of V) {
            const a = az === null ? -Math.atan2(HWd * 0.25, HD * 1.55) : az * Math.PI / 180, t = [lx - Math.cos(a) * 50, ey - 1.0, lz - Math.sin(a) * 50];
            await rig.ev('FLYDIY_ROOM_EYE(' + JSON.stringify([lx, ey, lz]) + ', ' + JSON.stringify(t) + ')'); await rig.frames(16);
            await gshot(TAG + '_' + tm + '_' + shell + '_' + vn, { kind: 'garage', tag: TAG, time: tm, shell, view: vn, eyeRoom: [lx, ey, lz], az: az === null ? +(a * 180 / Math.PI).toFixed(1) : az });
          }
        }
        META.steps['garage_' + shell] = I; save();
      }
      await rig.ev('FLYDIY_ROOM_EYE(null)');
      await rig.ev("(() => { try { GARAGE_ENV.setShell('club'); DAY_CLOCK.preset('afternoon'); return 1; } catch (e) { return 0; } })()", 140000); await rig.frames(60); await rig.settleLoad();
    }
    await rig.fly(); await rig.pause();
    // the player's aeroplane off the stand: on the ground 30 m BEHIND the large hangar, paused - out of every door view and off the
    // apron (slot 1, 22 Nov: with it placed 400 m up and hidden the page stopped answering; nothing is hidden or lifted now)
    { const q = toWorld(S[1], S[1].HD + 30, 0); await rig.place(q[0], q[1], 1.2, 30); }
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
    const cardAt = (() => { const p = toWorld(S[0], -S[0].HD - 60, 0); return { x: p[0], z: p[1], y: floorY(S[0]) + 0.03, yaw: S[0].ry }; })();
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
      const hid = await JJ('JSON.stringify(GV.hide(' + JSON.stringify(HIDE.ground) + ', ' + JSON.stringify(HIDE.groundUD) + '))');
      log('ground: ' + r + '; hidden ' + JSON.stringify(hid)); await alive('ground hide');
      const cam = META.cam0, tanV = Math.tan(cam.fov * Math.PI / 360), asp = cam.canvas[0] / cam.canvas[1];
      // a tile set: the eye h over the ground, straight down, the picture's top toward the club door's line; the tiles
      // overlap by 12 %. `rect` in a shed's room frame [lx0, lx1, lz0, lz1], or a world box round the middle
      const tiles = async (tag, h, pts, yaw) => { let n = 0; for (const q of pts) { const gy = await JJ(`FLIGHT_PROBE.world().terrainH(${q[0]}, ${q[1]})`);
          await eyeAt(q[0], gy + h, q[1], yaw, -1.5, h > 300 ? 60 : 16); if (h > 300 && n === 0) await rig.settleLoad();
          await grab('ground_' + tag + '_' + String(n).padStart(2, '0'), { kind: 'ground', set: tag, h, at: [q[0], gy, q[1]] }); n++; } return n; };
      const fp = h => [2 * h * tanV, 2 * h * tanV * asp];   // the footprint: along the eye's up (the picture's height), across
      const yawD = yawOf(S[0].doorDir.x, S[0].doorDir.z);
      // NEAR: 12 m up, in front of each door: 6 m inside the sill to 46 m out, the door's width + 10 m each side
      for (const Sd of S) { const [fu, fa] = fp(12), st = [fu * 0.88, fa * 0.88], pts = [];
        const x0 = -Sd.HD - 46, x1 = -Sd.HD + 6, z0 = -Sd.door.w / 2 - 10, z1 = Sd.door.w / 2 + 10;
        for (let lx = x1 - fu / 2; lx > x0 - st[0] / 2; lx -= st[0]) for (let lz = z0 + fa / 2 - 2; lz < z1 + st[1] / 2; lz += st[1]) pts.push(toWorld(Sd, lx, lz));
        const n = await tiles('near_' + Sd.id.replace(/\W/g, '_'), 12, pts, yawD); META.steps['ground_near_' + Sd.id] = { tiles: n, footprint: [fu, fa], rect: [x0, x1, z0, z1] }; save(); log('near ' + Sd.id + ': ' + n + ' tiles'); }
      // MID: 120 m up, the whole pavement: 560 x 460 m round the two sheds' middle, pushed 110 m out of the doors
      { const [fu, fa] = fp(120), st = [fu * 0.88, fa * 0.88], pts = [], c = [M.mid.x + S[0].doorDir.x * 110, M.mid.z + S[0].doorDir.z * 110], d = [S[0].doorDir.x, S[0].doorDir.z], t = [-d[1], d[0]];
        for (let u = -280 + fu / 2; u < 280 + st[0] / 2; u += st[0]) for (let v = -230 + fa / 2; v < 230 + st[1] / 2; v += st[1]) pts.push([c[0] + d[0] * u + t[0] * v, c[1] + d[1] * u + t[1] * v]);
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
      const keep = all.filter(t => t.r > 0.6 && t.r < 60 && !/^parkedAt:|person_/.test(t.name));
      log('props: ' + all.length + ' things within 260 m, ' + keep.length + ' kept (no parked aircraft, no people, nothing under 0.6 m)');
      const tanV = Math.tan(META.cam0.fov * Math.PI / 360), PR = [];
      let done = 0;
      for (const t of keep) {
        if ((Date.now() - t0) / 1000 > CAP - 330) { log('props: stopping at ' + done + '/' + keep.length + ' (the slot)'); break; }
        const shots = [];
        await JJ('GV.solo(' + t.i + ')');
        // from each door's eye, and from the point between them: the same line of sight, the thing filling ~60 % of the picture's height
        const eyes = [[S[0].doorCentre.x, floorY(S[0]) + 1.7, S[0].doorCentre.z], [S[1].doorCentre.x, floorY(S[1]) + 1.7, S[1].doorCentre.z], [(S[0].doorCentre.x + S[1].doorCentre.x) / 2 + S[0].doorDir.x * 25, floorY(S[0]) + 1.7, (S[0].doorCentre.z + S[1].doorCentre.z) / 2 + S[0].doorDir.z * 25]];
        for (let e = 0; e < eyes.length; e++) {
          const E = eyes[e], d = [t.c[0] - E[0], t.c[1] - E[1], t.c[2] - E[2]], L = Math.hypot(d[0], d[1], d[2]); if (L < 1) continue;
          const u = d.map(v => v / L), D = Math.min(L, Math.max(t.r * 1.15, t.r / tanV / 0.6)), ex = t.c[0] - u[0] * D, ey = Math.max(t.c[1] - u[1] * D, t.min[1] + 0.4), ez = t.c[2] - u[2] * D;
          const pitch = Math.asin(Math.max(-1, Math.min(1, (t.c[1] - ey) / Math.hypot(t.c[0] - ex, t.c[1] - ey, t.c[2] - ez))));
          await eyeAt(ex, ey, ez, yawOf(u[0], u[2]), pitch, 14);
          const g = await grab('prop_' + String(t.i).padStart(2, '0') + '_' + e, { kind: 'prop', thing: t.i, eye: e, name: t.name }); shots.push(g.name);
        }
        // its triangles as drawn from the last eye (the LOD the doors see is the LOD exported)
        const m = await JJ('GV.mesh(' + t.i + ')', 60000);
        if (m) { fs.writeFileSync(path.join(OUT, 'prop_' + String(t.i).padStart(2, '0') + '.json'), JSON.stringify(Object.assign({ thing: t, shots }, m))); }
        PR.push({ i: t.i, name: t.name, r: t.r, c: t.c, verts: m ? m.verts : 0, tris: m ? m.tris : 0, shots }); done++;
      }
      await JJ('GV.solo(null)'); await rig.ev('FLIGHT_PROBE.world().setDay({ cloudCover: ' + (+cc0 || 0) + ' })'); await rig.frames(30);
      META.steps.props = { all, kept: PR, cloudCoverBack: cc0 }; save(); log('props: ' + done + ' things, ' + PR.reduce((a, p) => a + p.tris, 0) + ' triangles');
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
        for (let k = 0; k < 9; k++) { const yaw = k * 40 * Math.PI / 180;
          await eyeAt(eye[0], eye[1], eye[2], yaw, 0.07, 20);
          await grab('far_' + (ap ? 'ap' : 'clear') + '_' + k, { kind: 'far', ap, k, yawDeg: k * 40, near: NEARF, eye }); n++;
          if (ap === 1) { const hid = await JJ('GV.hideAll()'); await rig.frames(4); await grab('far_bg_' + k, { kind: 'farbg', k, yawDeg: k * 40, hid }); await rig.ev('GV.show()'); await rig.frames(4); n++; }
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
