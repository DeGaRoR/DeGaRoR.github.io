// _lods_rig.js - the page half of the LOD comparison sheet (tools/_lods.html; the driver is tools/lods_sheet.js).
//
// window.LODS.sheet(spec) -> { png (data URL), stats }: one building (spec.gen, spec.P, spec.path), its rungs built
// the way the game builds them, each drawn from the same three cameras:
//   A  close, from the air (az 35, el 25)      B  close, the other side, steeper (az 215, el 55)
//   C  AT ITS SWITCH DISTANCE through the game's own lens (46 deg, 1080 rows), the true pixels blown up x k
// The far rungs' code is render_premises.js's, lifted from the file (lift() below): if the game's rule changes, the
// sheet changes with it.
'use strict';
(() => {
const T = THREE;
// ---- the game's far-town code, lifted ---------------------------------------------------------------------------
function liftFrom(src, name) {
  let i = src.indexOf('\n  function ' + name + '(');
  let fn = i >= 0;
  if (!fn) i = src.indexOf('\n  const ' + name + ' =');
  if (i < 0) throw new Error('lods rig: no ' + name + ' in render_premises.js');
  i++;
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (c === '/' && n === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '/' && n === '*') { j = src.indexOf('*/', j) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') { for (j++; j < src.length && src[j] !== c; j++) if (src[j] === '\\') j++; continue; }
    if (c === '{' || c === '(' || c === '[') { d++; if (c === '{') started = true; }
    else if (c === '}' || c === ')' || c === ']') { d--; if (fn && started && d === 0 && c === '}') return src.slice(i, j + 1); }
    else if (!fn && c === ';' && d === 0) return src.slice(i, j + 1);
  }
  throw new Error('lods rig: ' + name + ' never closes');
}
const LIFTED = ['areaOf', 'DETAIL', 'detailOf', 'HLOD', 'lodMat', 'farGain', 'LOD1_SHELL', 'lod1Bags', 'texMean', 'meanKey', 'meanMiss', 'meanLater', 'meanOf', 'hlodMerge', 'BOX_F', 'hlodBoxes'];
let G = null;
async function game() {
  if (G) return G;
  const src = await (await fetch('../src/viewer/render_premises.js', { cache: 'no-store' })).text();
  const code = LIFTED.map(n => liftFrom(src, n)).join('\n') + '\nlet texCv = null;\nreturn { DETAIL, detailOf, HLOD, lodMat, farGain, lod1Bags, meanOf, hlodMerge, hlodBoxes, LOD1_SHELL };';
  G = new Function('THREE', code)(T);
  G.HLOD.group = new T.Group();
  return G;
}

// ---- the stage ----------------------------------------------------------------------------------------------------
const cv = document.getElementById('c');
const R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
R.setClearColor(0x000000, 0);
const scene = new T.Scene();
const sun = new T.DirectionalLight(0xfff1dc, 2.6); sun.position.set(-0.55, 0.62, 0.56).multiplyScalar(100); scene.add(sun); scene.add(sun.target);
scene.add(new T.HemisphereLight(0xbcd2ee, 0x4a4436, 0.85));
{ // an environment for the metals and the ambient: a sky dome over a ground, through PMREM (the game has its sky's)
  const env = new T.Scene(), g = new T.SphereGeometry(50, 32, 16), col = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 50, c = y > 0 ? new T.Color(0.55, 0.68, 0.86).lerp(new T.Color(0.80, 0.86, 0.92), 1 - y) : new T.Color(0.25, 0.24, 0.20); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  env.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  scene.environment = new T.PMREMGenerator(R).fromScene(env, 0.02).texture;
}
const cam = new T.PerspectiveCamera(46, 1, 0.1, 5000);
const holder = new T.Group(); scene.add(holder);

// ---- the building's maps, decoded before anything is merged (meanOf answers from TEX_MEANS by file anyway) ----------
async function mapsReady(F, ms) {
  const imgs = new Set();
  for (const k in F.MAT) { const m = F.MAT[k]; if (!m) continue; for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t && t.image && t.image.addEventListener) imgs.add(t.image); }
  const t0 = performance.now();
  for (const im of imgs) while (!(im.complete && im.naturalWidth) && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 50));
  for (const k in F.MAT) { const m = F.MAT[k]; if (m) for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.needsUpdate = true; }
}

// ---- the rungs ----------------------------------------------------------------------------------------------------
const bagsGroup = (GEN, built, F) => { const g = new T.Group(); for (const k of (built.BAGS || GEN.BAGS)) if (built.bags[k] && F.MAT[k]) built.bags[k].mesh(g, F.MAT[k]); g.updateMatrixWorld(true); return g; };
const triCount = o => { let t = 0; o.traverse(m => { if (m.isMesh && m.geometry && m.geometry.index) t += m.geometry.index.count / 3; }); return t; };
const drawCount = o => { let d = 0; o.traverse(m => { if (m.isMesh) d++; }); return d; };
// a building without a lod 1 (an item; an outbuilding on its lod 1): detailOf's keep merged plain (hlodCell's bagsH), and its box
function farOfItem(grp) {
  const D = G.detailOf(grp);
  const bags = D.keep.filter(m => m.geometry.index).map(m => ({ m, M: m.matrixWorld, h: m.parent, box: true, D }));
  const H = G.hlodMerge(bags, G.lodMat('hard'), false);
  const box = H ? G.hlodBoxes(H.HB, G.lodMat('hard')) : null;
  if (H) H.mesh.visible = true; if (box) box.visible = true;
  return { mesh: H && H.mesh, box, keep: D.keep.map(m => nameOf(grp, m)) };
}
let NAMES = new Map();
const nameOf = (grp, m) => NAMES.get(m) || '?';
function named(GEN, built, F, g) { let i = 0; for (const k of (built.BAGS || GEN.BAGS)) if (built.bags[k] && F.MAT[k] && built.bags[k].raw().idx.length) { const m = g.children[i++]; if (m) NAMES.set(m, k); } }

async function rungsOf(spec) {
  const GEN = window[spec.gen];
  if (!GEN) throw new Error('no generator ' + spec.gen);
  const P = Object.assign({}, GEN.DEF, spec.P);
  const F = GEN.makeFinish(); GEN.applyFinish(P, F);
  await mapsReady(F, 20000);
  const out = [];
  const b0 = GEN.build(P, 0, F); b0.BAGS = b0.BAGS || GEN.BAGS;
  if (spec.path === 'plot' || spec.path === 'kit') {
    const g0 = bagsGroup(GEN, b0, F);
    out.push({ key: 'near', name: 'NEAR (lod 0)', obj: g0, at: 0 });
    const L1 = G.lod1Bags(GEN, P, F); const root = L1.root; root.updateMatrixWorld(true);
    out.push({ key: 'l1', name: spec.path === 'kit' ? 'KIT LOD 1 (150 m)' : 'FAR TOWN: LOD 1 (its finish)', obj: root, at: spec.edge });
    if (spec.path === 'plot') {
      const sh = new T.Group(); for (const m of L1) if (m.userData.shell) sh.add(new T.Mesh(m.geometry, m.material)); sh.updateMatrixWorld(true);
      out.push({ key: 'l1s', name: 'LOD 1 SHELLS (detail band)', obj: sh, at: spec.detail });
      const bags = L1.filter(m => m.geometry.index).map(m => ({ m, M: root.matrixWorld, h: root, box: m.userData.box, D: { c: new T.Vector3(), R: 1 } }));
      const H = G.hlodMerge(bags, G.lodMat('hard'), false); H.mesh.visible = true;
      out.push({ key: 'l1p', name: 'LOD 1 PLAIN (no-stack fallback)', obj: H.mesh, at: spec.edge });
    } else {
      // the kit's box (town_kit.js boxLod: the shell roles' extent, 85 %, the walls siding, the top roof) and the city
      // pack's far shell (city_cook.js shellFaces, its vertex colour x the cook's farGain)
      const bx = new T.Group(), lo = [1e9, 0, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const m of root.children) if (/^(siding|roof|rib|trim|stone)$/.test(m.name)) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; lo[0] = Math.min(lo[0], b.min.x); lo[2] = Math.min(lo[2], b.min.z); hi[0] = Math.max(hi[0], b.max.x); hi[1] = Math.max(hi[1], b.max.y); hi[2] = Math.max(hi[2], b.max.z); }
      const top = lo[1] + 0.85 * (hi[1] - lo[1]);
      const quad = (pts, mat) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1].map((v, i) => v * (i % 2 ? top : hi[0] - lo[0])), 2)); g.setAttribute('aHouseAO', new T.Float32BufferAttribute([1, 1, 1, 1], 1)); g.setAttribute('aHouseLit', new T.Float32BufferAttribute([0, 0, 0, 0], 1)); g.setAttribute('aHouseWin', new T.Float32BufferAttribute(new Array(12).fill(0), 3));   // (the kit's box: ao 1, as town_kit.js boxLod)
        g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); bx.add(new T.Mesh(g, mat)); };
      const [x0, , z0] = lo, [x1, , z1] = hi, W = F.MAT.siding, RF = F.MAT.roof;
      quad([[x0, 0, z1], [x1, 0, z1], [x1, top, z1], [x0, top, z1]], W); quad([[x1, 0, z0], [x0, 0, z0], [x0, top, z0], [x1, top, z0]], W);
      quad([[x1, 0, z1], [x1, 0, z0], [x1, top, z0], [x1, top, z1]], W); quad([[x0, 0, z0], [x0, 0, z1], [x0, top, z1], [x0, top, z0]], W);
      quad([[x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]], RF);
      out.push({ key: 'kbox', name: 'KIT BOX (1.2 km)', obj: bx, at: 1200 });
      if (spec.shell) {
        const pos = [], col = [], idx = [];
        for (const f of spec.shell) { const b = pos.length / 3; for (const p of f.pts) { pos.push(p[0], p[1], p[2]); col.push(f.rgb[0] / 255, f.rgb[1] / 255, f.rgb[2] / 255); } for (let k = 1; k + 1 < f.pts.length; k++) idx.push(b, b + k, b + k + 1); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
        const m = G.lodMat('hard').clone(); m.color.setScalar(spec.farGain);   // render_premises.js: shell.color.setScalar(CITY.city.lod.farGain)
        out.push({ key: 'city', name: 'CITY FAR SHELL (1 km)', obj: new T.Mesh(g, m), at: 1000 });
      }
    }
    return { out, F, P, GEN };
  }
  // an item (lod 0 near) / an outbuilding (lod 1 near too: it is built at lod 1 only)
  const nearB = spec.path === 'out' ? GEN.build(P, 1, F) : b0; nearB.BAGS = nearB.BAGS || GEN.BAGS;
  const g0 = bagsGroup(GEN, nearB, F); NAMES = new Map(); named(GEN, nearB, F, g0);
  out.push({ key: 'near', name: spec.path === 'out' ? 'NEAR (its lod 1: outbuildings are built at lod 1)' : 'NEAR (lod 0)', obj: g0, at: 0 });
  const far = farOfItem(g0);
  out.push({ key: 'far', name: 'GAME FAR: KEEP ' + far.keep.join('+'), obj: far.mesh, at: spec.near });
  if (far.box) out.push({ key: 'box', name: 'GAME BOX (1.2 km)', obj: far.box, at: 1200 });
  if (spec.path === 'item') {   // what the same generator's own lod 1 would give (the plan's fix, not the game today)
    const b1 = GEN.build(P, 1, F); b1.BAGS = b1.BAGS || GEN.BAGS;
    const g1 = new T.Group(); for (const k of b1.BAGS) { const mt = F.MAT[k]; if (b1.bags[k] && mt && mt.isMeshStandardMaterial && !mt.transparent) b1.bags[k].mesh(g1, mt); } g1.updateMatrixWorld(true);
    out.push({ key: 'prop', name: 'PROPOSED: ITS OWN LOD 1', obj: g1, at: spec.near, proposed: true });
  }
  return { out, F, P, GEN };
}

// ---- drawing ------------------------------------------------------------------------------------------------------
function frame(obj) { const b = new T.Box3().setFromObject(obj); const s = b.getBoundingSphere(new T.Sphere()); return s; }
function shot(obj, S, az, el, dist, W, H, view) {
  while (holder.children.length) holder.remove(holder.children[0]);
  if (obj) holder.add(obj);
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  cam.position.set(S.center.x + dist * Math.cos(e) * Math.sin(a), S.center.y + dist * Math.sin(e), S.center.z + dist * Math.cos(e) * Math.cos(a));
  cam.lookAt(S.center);
  if (view) cam.setViewOffset(view.fw, view.fh, view.x, view.y, view.w, view.h); else cam.clearViewOffset();
  cam.aspect = W / H; cam.updateProjectionMatrix();
  R.setSize(W, H, false); R.render(scene, cam);
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(cv, 0, 0);
  return c;
}
// the building's pixels: mean luminance (linear) and the share that is near-black
function lumOf(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, L = 0, blk = 0;
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; n++; const l = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); L += l; if (Math.max(d[i], d[i + 1], d[i + 2]) < 38) blk++; }
  return { n, L: n ? L / n : 0, black: n ? blk / n : 0 };
}
const TILE = 300;
function backdrop(x, X, Y) { const g = x.createLinearGradient(0, Y, 0, Y + TILE); g.addColorStop(0, '#9fb9d6'); g.addColorStop(0.62, '#c9d6e2'); g.addColorStop(0.63, '#6f7d5a'); g.addColorStop(1, '#55613f'); x.fillStyle = g; x.fillRect(X, Y, TILE, TILE); }

async function sheet(spec) {
  await game();
  // (the calibration run: HLOD.gain / gainItem and the city's farGain as asked; the game's own values otherwise)
  if (!G.gain0) G.gain0 = [G.HLOD.gain, G.HLOD.gainItem];
  G.HLOD.gain = spec.gain != null ? spec.gain : G.gain0[0]; G.HLOD.gainItem = spec.gain != null ? Math.max(spec.gain, G.gain0[1]) : G.gain0[1];
  const { out } = await rungsOf(spec);
  const near = out[0], S = frame(near.obj), R0 = S.radius;
  const F1080 = 540 / Math.tan(23 * Math.PI / 180);
  const cols = out.length, HEAD = 92, ROWL = 22, Wd = cols * TILE, Ht = HEAD + 3 * (TILE + ROWL) + 30;
  const C = document.createElement('canvas'); C.width = Wd; C.height = Ht;
  const x = C.getContext('2d');
  x.fillStyle = '#1c1f24'; x.fillRect(0, 0, Wd, Ht);
  x.fillStyle = '#fff'; x.font = 'bold 17px sans-serif'; x.fillText(spec.title, 10, 22);
  x.font = '12px sans-serif'; x.fillStyle = '#b8c0cc'; x.fillText(spec.sub || '', 10, 40);
  const stats = [];
  const ROWS = [['A  close, from the air (az 35, el 25)', 35, 25, false], ['B  close, the far side, steeper (az 215, el 55)', 215, 55, false], ['C  at its switch distance, the game lens (46 deg / 1080 rows), true pixels x k', 35, 25, true]];
  const lumNear = {};
  for (let ci = 0; ci < cols; ci++) {
    const r = out[ci], X = ci * TILE;
    const st = { key: r.key, name: r.name, tris: r.obj ? triCount(r.obj) : 0, draws: r.obj ? drawCount(r.obj) : 0, at: r.at };
    for (let ri = 0; ri < 3; ri++) {
      const [label, az, el, far] = ROWS[ri], Y = HEAD + ri * (TILE + ROWL) + ROWL;
      if (ci === 0) { x.fillStyle = '#8fa0b4'; x.font = '12px sans-serif'; x.fillText(label, 6, Y - 6); }
      backdrop(x, X, Y);
      let c;
      if (!far) c = shot(r.obj, S, az, el, R0 * 2.75, TILE, TILE);
      else {
        // the true pixels: the full 1920 x 1080 frame's focal length, only the window round the building rendered
        const dist = Math.max(r.at || out[1].at || 150, 20), rpx = R0 * F1080 / dist, w = Math.max(8, Math.ceil(rpx * 2.3));
        c = shot(r.obj, S, az, el, dist, w, w, { fw: 1920, fh: 1080, x: 960 - w / 2, y: 540 - w / 2, w, h: w });
        st.px = w; st.dist = Math.round(dist);
      }
      x.imageSmoothingEnabled = !far;
      x.drawImage(c, 0, 0, c.width, c.height, X, Y, TILE, TILE);
      const lm = lumOf(c);
      if (ci === 0) lumNear[ri] = lm;
      st['L' + ri] = +lm.L.toFixed(4); st['black' + ri] = +lm.black.toFixed(3); st['ratio' + ri] = lumNear[ri].L ? +(lm.L / lumNear[ri].L).toFixed(2) : 0;
      if (far) { x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(X, Y + TILE - 18, TILE, 18); x.fillStyle = '#fff'; x.font = '11px sans-serif'; x.fillText(st.dist + ' m  -  ' + c.width + ' px wide' + (ci ? '  -  light x' + st['ratio2'] : ''), X + 6, Y + TILE - 5); }
    }
    // the column's head
    x.fillStyle = r.proposed ? '#9fe0a0' : (ci === 0 ? '#ffffff' : '#ffd27a'); x.font = 'bold 12px sans-serif';
    const words = r.name.split(' '); let line = '', ly = 58;
    for (const w of words) { if (x.measureText(line + w).width > TILE - 12) { x.fillText(line, X + 6, ly); ly += 14; line = ''; } line += w + ' '; }
    x.fillText(line, X + 6, ly);
    const a = (spec.audit || {})[r.key];
    x.font = '11px sans-serif'; x.fillStyle = '#c8d0da';
    x.fillText(st.tris + ' tris, ' + st.draws + ' mesh' + (st.draws > 1 ? 'es' : '') + (r.at ? ', from ' + Math.round(r.at) + ' m' : '') + (a ? '  |  hole ' + (a.hole * 100).toFixed(1) + '%  leak ' + (a.leak * 100).toFixed(1) + '%  roof ' + Math.round(a.roof * 100) + '%' : ''), X + 6, HEAD - 4);
    stats.push(st);
    x.strokeStyle = '#000'; x.strokeRect(X + 0.5, HEAD, TILE - 1, Ht - HEAD - 30);
  }
  x.fillStyle = '#8fa0b4'; x.font = '11px sans-serif';
  x.fillText('light x = the rung\'s mean luminance over the near mesh\'s, same camera.  hole = share of the view showing something far behind the near outside; leak = share looking INTO the building; roof = roofed plan still roofed from above (tools/lods_audit.js).', 8, Ht - 10);
  return { png: C.toDataURL('image/png'), stats };
}
// the overview: from each sheet, row A of the near column, the game's first far rung and the green (or last) one
async function overview(list) {
  const T2 = 200, LB = 20, PER = 2, n = list.length, rows = Math.ceil(n / PER), Wd = PER * (3 * T2 + 12), Ht = 40 + rows * (T2 + LB + 10);
  const C = document.createElement('canvas'); C.width = Wd; C.height = Ht; const x = C.getContext('2d');
  x.fillStyle = '#1c1f24'; x.fillRect(0, 0, Wd, Ht);
  x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.fillText('LODS - near | the game\'s far rung today | the fix (its own lod 1; for a plot / the kit: the far town as built)', 8, 24);
  for (let i = 0; i < n; i++) {
    const it = list[i], im = new Image(); im.src = it.png; await im.decode();
    const X = (i % PER) * (3 * T2 + 12), Y = 40 + Math.floor(i / PER) * (T2 + LB + 10);
    x.fillStyle = '#cfd6df'; x.font = '12px sans-serif'; x.fillText(it.title.slice(0, 80), X + 4, Y + 14);
    it.cols.forEach((c, k) => { x.drawImage(im, c * TILE, 92 + 22, TILE, TILE, X + k * T2, Y + LB, T2, T2); x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(X + k * T2, Y + LB + T2 - 16, T2, 16); x.fillStyle = k === 2 ? '#9fe0a0' : (k ? '#ffd27a' : '#fff'); x.font = '11px sans-serif'; x.fillText(it.labels[k].slice(0, 34), X + k * T2 + 4, Y + LB + T2 - 4); });
  }
  return C.toDataURL('image/png');
}
window.LODS = { sheet, game, overview };
window.LODS_READY = true;
})();
