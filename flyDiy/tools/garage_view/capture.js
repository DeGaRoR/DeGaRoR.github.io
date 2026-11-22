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
const DO = opt('do', 'graph,refs,card,ground,trees').split(','), TIMES = opt('times', 'now,noon,golden,night').split(',');
const CAP = +opt('cap', 1380);
const M = JSON.parse(fs.readFileSync(path.join(MDIR, 'measure.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

// WHAT IS NOT THE GROUND (hidden for the top-down tiles), by the scene's own names; --hide file.json replaces the list.
// refs hide only the player's aeroplane and the people.
const HIDE_DEF = {
  ground: ['^prop', '^parked', '^resident:', '^hitbox:', '^crowd', '^animal', '^life:', '^premises:life', '^traffic:', '^shed:', '^shell:', '^item:', '^houses:', '^fence', '^tree', '^trees:', '^treeRungs', '^cover:', '^rocks', '^rock-ring', '^cliffs', '^powerline', '^contact:', '^kitlot:', '^city:', '^tram:', '^premises:lamp', '^premises:townkit', '^ghost:', '^snapHint'],
  groundUD: ['fill', 'ser'],          // the fill's rungs and merged impostors (render_world: userData.fill / .ser)
  refs: ['^crowd', '^prop:person_', '^resident:'],
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
  AA.render = function (s) { if (s && s.isScene && s !== (FLIGHT_PROBE.hangarScene && FLIGHT_PROBE.hangarScene())) scene = s; return prev.apply(this, arguments); };
  const hidden = [];
  const GV = {
    scene: () => scene,
    cam: () => { const c = FLIGHT_PROBE.camera(); c.updateMatrixWorld(); return { mw: Array.from(c.matrixWorld.elements), pj: Array.from(c.projectionMatrix.elements), fov: c.fov, aspect: c.aspect, near: c.near, far: c.far,
      pos: [c.position.x, c.position.y, c.position.z], canvas: [FLYDIY_RENDERER.domElement.width, FLYDIY_RENDERER.domElement.height], exposure: FLYDIY_RENDERER.toneMappingExposure }; },
    // hide every visible object whose name matches a pattern or whose userData carries a key; -> what went, by name
    hide: (pats, uds) => { const re = (pats || []).map(p => new RegExp(p)), by = {}; if (!scene) return { error: 'no scene yet' };
      scene.traverse(o => { if (!o.visible || o === scene) return; const n = o.name || '';
        const hit = (n && re.some(r => r.test(n))) || (uds || []).some(k => o.userData && o.userData[k] !== undefined && (o.isMesh || o.isInstancedMesh));
        if (hit) { o.visible = false; hidden.push(o); const k = n.replace(/[:|].*/, ':') || ('(ud ' + o.type + ')'); by[k] = (by[k] || 0) + 1; } });
      return by; },
    show: () => { const n = hidden.length; for (const o of hidden) o.visible = true; hidden.length = 0; return n; },
    craft: v => { const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (c) c.visible = !!v; return !!c; },
    graph: () => { const row = (o, d) => { const m = Array.isArray(o.material) ? o.material[0] : o.material;
        const r = { n: o.name || '', t: o.type, v: o.visible ? 1 : 0, k: o.children.length, ud: Object.keys(o.userData || {}).slice(0, 8).join(','), m: m ? (m.type + (m.name ? ':' + m.name : '')) : '', ro: o.renderOrder || 0,
          c: o.isInstancedMesh ? o.count : undefined, p: [o.position.x, o.position.y, o.position.z].map(v => +v.toFixed(1)) };
        if (d < 3 && o.children.length && o.children.length <= 400) r.ch = o.children.map(c => row(c, d + 1));
        else if (o.children.length) { const by = {}; for (const c of o.children) { const k = (c.name || '-') + '|' + c.type + '|' + Object.keys(c.userData || {}).slice(0, 4).join(','); by[k] = (by[k] || 0) + 1; } r.kinds = by; }
        return r; }; return scene ? row(scene, 0) : null; },
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
    await rig.fly(); await rig.pause();
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
    if (DO.includes('graph')) {
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

    // ---- the card's place: on the apron, 30 m out of the club's door and 22 m to its left (clear of the stand) -----------
    const cardAt = (() => { const p = toWorld(S[0], -S[0].HD - 30, 22); return { x: p[0], z: p[1], y: floorY(S[0]) + 0.03, yaw: S[0].ry }; })();
    const shootCard = async tag => {
      await JJ(`JSON.stringify(GV.card(${cardAt.x}, ${cardAt.y}, ${cardAt.z}, ${cardAt.yaw}, 4))`);
      await eyeAt(cardAt.x, cardAt.y + 12, cardAt.z, yawOf(S[0].doorDir.x, S[0].doorDir.z), -1.5, 30);
      const g = await grab('card_' + tag, { kind: 'card', time: tag, card: await JJ('JSON.stringify(GV._cardInfo)') });
      await rig.ev('GV.cardOff()'); return g;
    };

    // ---- the reference views, hour by hour -----------------------------------------------------------------------------
    if (DO.includes('refs') || DO.includes('card')) for (const tm of TIMES) {
      const r = await setTime(tm); const day = await JJ('JSON.stringify(GV.day())'); log('time ' + tm + ': ' + r + ', sunEl ' + (day.sunEl != null ? (+day.sunEl).toFixed(1) : '?') + ', cloud ' + day.cloudCover);
      await rig.ev('GV.craft(false)'); const hid = await JJ('JSON.stringify(GV.hide(' + JSON.stringify(HIDE.refs) + ', []))');
      if (DO.includes('card')) await shootCard(tm);
      if (DO.includes('refs')) for (const Sd of S) {
        const V = [['door_out', -Sd.HD - 0.3, 1.7, 0, 0], ['door_left', -Sd.HD - 0.3, 1.7, 0, -45], ['door_right', -Sd.HD - 0.3, 1.7, 0, 45], ['door_high', -Sd.HD - 0.3, 4.0, 0, 0], ['apron_out', -Sd.HD - 14, 1.7, 0, 0]];
        for (const [vn, lx, ey, lz, az] of V) {
          const p = toWorld(Sd, lx, lz), a = az * Math.PI / 180, c = Math.cos(Sd.ry), s = Math.sin(Sd.ry), dl = [-Math.cos(a), -Math.sin(a)], dw = [dl[0] * c + dl[1] * s, -dl[0] * s + dl[1] * c];
          await eyeAt(p[0], floorY(Sd) + ey, p[1], yawOf(dw[0], dw[1]), -0.02, 24);
          await grab('ref_' + tm + '_' + Sd.id.replace(/\W/g, '_') + '_' + vn, { kind: 'ref', time: tm, shed: Sd.id, view: vn, eyeRoom: [lx, ey, lz], az, day });
        }
      }
      await rig.ev('GV.show()'); META.steps['refs_' + tm] = { hid, day }; save();
    }

    // ---- the ground from above ---------------------------------------------------------------------------------------------
    if (DO.includes('ground')) {
      const r = await setTime(TIMES.includes('noon') ? 'noon' : 'now'); const day = await JJ('JSON.stringify(GV.day())');
      await rig.ev('GV.craft(false)');
      const hid = await JJ('JSON.stringify(GV.hide(' + JSON.stringify(HIDE.ground) + ', ' + JSON.stringify(HIDE.groundUD) + '))');
      log('ground: ' + r + '; hidden ' + JSON.stringify(hid));
      await JJ(`JSON.stringify(GV.card(${cardAt.x}, ${cardAt.y}, ${cardAt.z}, ${cardAt.yaw}, 4))`);   // the card stays in the tiles: the bridge is in the picture itself
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
      await rig.ev('GV.cardOff()'); await rig.ev('GV.show()'); META.steps.ground = { time: r, day, hid }; save();
    }

    // ---- the species' impostor sheets -------------------------------------------------------------------------------------------
    if (DO.includes('trees')) {
      // the fill's impostor materials carry their atlas (albedo + normal); read back through a framebuffer, layer by layer
      const info = await JJ(`(() => { const sc = GV.scene(), seen = new Map(); if (!sc) return JSON.stringify({ error: 'no scene' });
        sc.traverse(o => { const m = o.material; if (!m || !o.userData || !o.userData.fill) return; const U = m.uniforms || (m.userData && m.userData.shader && m.userData.shader.uniforms) || {};
          for (const k of Object.keys(U)) { const v = U[k] && U[k].value; if (v && v.isTexture && !seen.has(v.uuid)) seen.set(v.uuid, { u: k, name: o.name || '', type: v.constructor && v.constructor.name, arr: !!v.isDataArrayTexture, w: v.image && v.image.width, h: v.image && v.image.height, d: v.image && v.image.depth, hasData: !!(v.image && v.image.data), fmt: v.format, cs: v.colorSpace }); } });
        GV._impTex = seen; return JSON.stringify(Array.from(seen.values())); })()`, 60000);
      META.steps.trees = { textures: info }; log('trees: ' + JSON.stringify(info).slice(0, 600)); save();
      // the array textures that hold their bytes on the CPU are saved raw (RGBA8, layers stacked): the sheets' table comes with TREE_FILL
      const list = Array.isArray(info) ? info.filter(t => t.arr && t.hasData && t.w * t.h * t.d * 4 <= 400e6) : [];
      for (let i = 0; i < list.length; i++) { const t = list[i];
        const tbl = await JJ(`(() => { let tex = null; const sc = GV.scene(); sc.traverse(o => { const m = o.material; if (tex || !m || !o.userData || !o.userData.fill) return; const U = m.uniforms || {}; const v = U[${JSON.stringify(t.u)}] && U[${JSON.stringify(t.u)}].value; if (v && v.isDataArrayTexture && v.image.width === ${t.w} && v.image.depth === ${t.d}) tex = v; });
          GV._tex = tex; return JSON.stringify({ ok: !!tex, bytes: tex ? tex.image.data.length : 0, ctor: tex ? tex.image.data.constructor.name : null }); })()`);
        if (!tbl.ok) continue;
        const per = t.w * t.h * 4, parts = [];
        for (let L = 0; L < t.d; L++) { const b64 = await rig.ev(`(() => { const d = GV._tex.image.data, o = ${L} * ${per}, u = new Uint8Array(d.buffer, d.byteOffset + o, ${per}); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); })()`, 60000); parts.push(Buffer.from(b64, 'base64')); }
        fs.writeFileSync(path.join(OUT, 'imp_' + t.u + '_' + t.w + 'x' + t.h + 'x' + t.d + '.rgba'), Buffer.concat(parts)); log('trees: saved ' + t.u + ' ' + t.w + 'x' + t.h + 'x' + t.d);
      }
      save();
    }
    META.done = true; META.seconds = Math.round((Date.now() - t0) / 1000); save();
    log('done: ' + META.grabs.length + ' grabs, ' + (META.blank || 0) + ' blank, ' + META.seconds + ' s');
  } catch (e) { rc = 1; META.error = String(e && e.stack || e); try { META.why = await rig.why(); } catch (e2) {} save(); console.error('capture FAILED: ' + META.error); }
  await rig.close(); process.exit(rc);
})().catch(e => { console.error('capture FAILED (start): ' + (e && e.stack || e)); process.exit(1); });
