#!/usr/bin/env node
// pod_shots.js - THE BELLY POD ON ITS AEROPLANE, AS STILLS, FAST (BELLY-POD-2, G3468). The user (27 Oct): "stop using
// the cage8 for rendering, find something simpler and faster that allows for quick screenshots".
//
// TWO HALVES. (1) NODE draws the aeroplane the way the garage does - the build through the game's load chain
// (tools/_load_build.js: the spec the game flies), then the editor's drawing layers once more on that spec
// (tools/_bake_joined.js -> _scene_headless.js: the real three.js, the same layer files, the pod fitted through its
// layer's own door CAGE_POD.fromSpec, exactly what GATE POD draws) - and DUMPS every visible mesh in the cage frame
// (world matrices applied, one flat colour per material, the pod's meshes tagged) to tools/.joincache/podview/
// (gitignored, rebuilt each run). (2) tools/_pod_view.html draws that dump with three.js alone - no editor, no game,
// no core - and headless Chromium (SwiftShader) takes the stills over CDP: a few seconds a still, not minutes.
//
//   node tools/pod_shots.js [--builds cub,metal] [--out reports/evidence/POD4] [--cams quarter,side,below,aft,front,whole]
//        [--size 1400x800] [--pod '{"on":1,...}'] [--litres 160 --shape 0.5] [--tint 1] [--nopod 1] [--tag x]
//   builds: a key of tools/_load_build.js VALIDATED (cub, jodel, metal, floats ...) or 'metalFix' (the fixture
//   tools/fixtures/cessnaMetal_pod_2026-10-22.json, its pod as written). With no --pod / --litres a build gets the
//   default pod ({ on: 1 }). --tint 1 draws the pod in a flat test colour (the shape alone, not the livery).
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), { spawn } = require('child_process');
const T = __dirname, ROOT = path.join(T, '..'), REPO = path.join(ROOT, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const BUILDS = opt('builds', 'cub,metal').split(',').filter(Boolean);
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/POD4'));
const CAMS = opt('cams', 'quarter,side,below,aft').split(',').filter(Boolean);
const [W, H] = opt('size', '1400x800').split('x').map(Number);
const TINT = opt('tint', '0') === '1', NOPOD = opt('nopod', '0') === '1', TAG = opt('tag', '');
const DUMP = path.join(T, '.joincache', 'podview');

// ---- (1) the drawn aeroplane, dumped --------------------------------------------------------------------------------
function podFor(key, spec, C) {
  if (NOPOD) return null;
  if (opt('pod', null)) return JSON.parse(opt('pod'));
  if (opt('litres', null)) {
    const s = C.genMigrateSpec(JSON.parse(JSON.stringify(spec))); delete s.pod;
    const d0 = C.buildGen(s), v = C.genPodFromVolume(s, d0.parts.ST, +opt('litres'), +opt('shape', 0.5));
    return { on: 1, len: v.len, width: v.width, depth: v.depth };
  }
  return spec.pod && +spec.pod.on ? spec.pod : { on: 1 };
}
function dump(key) {
  const C = require(path.join(T, 'flight_core.js'));
  const LB = require(path.join(T, '_load_build.js'));
  const BJ = require(path.join(T, '_bake_joined.js'));
  const spec = key === 'metalFix'
    ? (j => j.spec || j)(JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'cessnaMetal_pod_2026-10-22.json'), 'utf8')))
    : LB.loadValidated(key).spec;
  const pod = podFor(key, spec, C);
  if (pod) spec.pod = pod; else delete spec.pod;
  // the layer's door first (GATE POD's order: fromSpec, then the build that draws it)
  const SH = require(path.join(T, '_scene_headless.js')), Wn = SH.context().ctx;
  // THE LIVERY, PLAINLY: the editor's section materials (_cage_ui.js secMat -> aeroskin.js) are the page's; here every
  // section a layer asks for wears one flat PBR colour - its finish row's tint, else the layer's own palette colour
  // (tint0), else the paint's base - metal where the finish says metal. Shape, not paint, is what these stills judge.
  const FIN = (spec.finish && spec.finish.sections) || {}, PAINT = spec.paint || {};
  // (the livery's inheritance, as aeroskin.js AERO_SEC has it for the sections a pod still sits among: the pod, the
  // spats, the struts and the hinge fairings wear the body's colour unless their own row says otherwise)
  const PARENT = { pod: 'body', spat: 'body', strut: 'body', ctlFair: 'body', cabane: 'strut', interplane: 'strut' };
  const secCol = (name, g) => { const f = FIN[name] || {}, pf = FIN[PARENT[name]] || {}, ppf = FIN[PARENT[PARENT[name]]] || {};
    const inh = f.tint != null ? f.tint : pf.tint != null ? pf.tint : ppf.tint != null ? ppf.tint : PARENT[name] ? (PAINT.base != null ? PAINT.base : null) : null;
    return { c: inh != null ? inh : (g && g.tint0 != null) ? g.tint0 : (PAINT.base != null ? PAINT.base : 0xd8d4c8),
             metal: f.metal != null ? +f.metal : /alu|metal|steel/i.test(f.fin || '') ? 1 : (PARENT[name] && pf.metal != null) ? +pf.metal : 0,
             rough: f.rough != null ? +f.rough : null }; };
  Wn.CAGE_SECMAT = (name, g) => { const q = secCol(name, g), T3 = Wn.THREE;
    return new T3.MeshStandardMaterial({ color: q.c, metalness: q.metal ? 0.85 : 0.05,
      roughness: q.rough != null ? q.rough : q.metal ? 0.38 : 0.5, side: (g && g.side != null) ? g.side : T3.DoubleSide,
      transparent: !!(g && g.opacity != null && g.opacity < 1), opacity: (g && g.opacity != null) ? g.opacity : 1, name }); };
  if (Wn.CAGE_POD) Wn.CAGE_POD.fromSpec(spec);
  const b = BJ.bakeJoined(spec), Wd = b.W, THREE = Wd.THREE;
  // THE FUSELAGE'S SKIN: the sheet the editor's own build draws (_cage_ui.js meshFrom; excluded from the headless
  // chain), the same cageSheet at the same level, in metres (x CAGE_UNIT x planeScale), one group per section
  {
    const CG2 = Wd.CAGE2, P = Wd.CAGE_UI.P, built = CG2.cageSheet(P, { step: 'crease', level: 2 });
    const m = built.sheet, FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
    const GLASS = /glass|pane|wind|screen|skylight/i, DARK = /joint|seal|paneEdge/;
    const pos = new Float32Array(m.V.length * 3); m.V.forEach((v, i) => { pos[3 * i] = v[0] * FS; pos[3 * i + 1] = v[1] * FS; pos[3 * i + 2] = v[2] * FS; });
    const by = new Map(); m.F.forEach(f => { if (!by.has(f.m)) by.set(f.m, []); const t = by.get(f.m); for (let i = 1; i + 1 < f.v.length; i++) t.push(f.v[0], f.v[i], f.v[i + 1]); });
    const sk = new THREE.BufferGeometry(); sk.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const idx = [], mats = []; let mi = 0;
    for (const [name, tris] of by) { sk.addGroup(idx.length, tris.length, mi++); for (const i of tris) idx.push(i);
      const q = secCol(name, null);
      mats.push(GLASS.test(name) ? new THREE.MeshStandardMaterial({ color: 0x1d2a36, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55, name })
        : DARK.test(name) ? new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6, name })
        : new THREE.MeshStandardMaterial({ color: q.c, metalness: q.metal ? 0.85 : 0.05, roughness: q.rough != null ? q.rough : q.metal ? 0.38 : 0.45, side: THREE.DoubleSide, name })); }
    sk.setIndex(idx); sk.computeVertexNormals();
    const skin = new THREE.Mesh(sk, mats); skin.name = 'cageSkin'; b.scene.add(skin);
  }
  b.scene.updateMatrixWorld(true);
  const shown = o => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
  const layerOf = o => { for (let q = o; q; q = q.parent) if (q.name && /^cageLayer:/.test(q.name)) return q.name.slice(10); return 'body'; };
  const parts = [], bufs = []; let off = 0;
  const put = a => { const u = Buffer.from(a.buffer, a.byteOffset, a.byteLength); bufs.push(u); const o = off; off += u.length; return o; };
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(), im = new THREE.Matrix4();
  b.scene.traverse(o => {
    if (!o.isMesh || !o.geometry || !shown(o)) return;
    const g = o.geometry, P = g.attributes.position, N = g.attributes.normal;
    if (!P || P.count < 3) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every(m => !m || m.visible === false || (m.transparent && m.opacity < 0.05))) return;
    for (let k = 0; k < (o.isInstancedMesh ? o.count : 1); k++) {
      const M = o.matrixWorld.clone();
      if (o.isInstancedMesh) { o.getMatrixAt(k, im); M.multiply(im); }
      nm.getNormalMatrix(M);
      const pos = new Float32Array(P.count * 3), nor = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(M); pos[3 * i] = v.x; pos[3 * i + 1] = v.y; pos[3 * i + 2] = v.z;
        if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[3 * i] = v.x; nor[3 * i + 1] = v.y; nor[3 * i + 2] = v.z; }
      }
      const idx = g.index ? Uint32Array.from(g.index.array) : null;
      const groups = (g.groups && g.groups.length && mats.length > 1) ? g.groups.map(q => ({ s: q.start, n: q.count, m: q.materialIndex }))
        : [{ s: 0, n: idx ? idx.length : P.count, m: 0 }];
      const col = mats.map(m => ({ c: m && m.color ? [m.color.r, m.color.g, m.color.b] : [0.6, 0.6, 0.6],
        r: m && m.roughness != null ? m.roughness : 0.6, mt: m && m.metalness != null ? m.metalness : 0,
        o: m && m.transparent ? (m.opacity == null ? 1 : m.opacity) : 1, side: m ? m.side : 0, name: m && m.name || '' }));
      parts.push({ name: o.name || '', tag: layerOf(o), n: P.count, pos: put(pos), nor: N ? put(nor) : -1,
                   idx: idx ? put(idx) : -1, ni: idx ? idx.length : 0, groups, col });
    }
  });
  const M = Wd.CAGE_POD_MESH;
  const podInfo = M ? { datum: M.datum, nv: M.nv, nt: M.nt, R: { x0: M.R.x0, x1: M.R.x1, xa: M.R.xa, xb: M.R.xb, yBot: M.R.yBot,
    hw: M.R.hw, len: M.R.len, depth: M.R.depth, litres: M.R.litres } } : null;
  fs.mkdirSync(DUMP, { recursive: true });
  const base = key + (NOPOD ? '_nopod' : '');
  fs.writeFileSync(path.join(DUMP, base + '.bin'), Buffer.concat(bufs));
  fs.writeFileSync(path.join(DUMP, base + '.json'), JSON.stringify({ key, pod: pod || null, podInfo, parts, bytes: off,
    errors: b.errors, sceneErrors: b.sceneErrors }));
  return { base, podInfo, n: parts.length, tris: parts.reduce((a, p) => a + (p.ni ? p.ni / 3 : p.n / 3), 0) };
}

// ---- (2) the stills ---------------------------------------------------------------------------------------------------
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  throw new Error('pod_shots: no playwright here');
}
(async () => {
  const done = [];
  for (const k of BUILDS) { const t0 = Date.now(); const d = dump(k); done.push(d);
    console.log(k + ': dumped ' + d.n + ' meshes, ' + Math.round(d.tris) + ' tris in ' + (Date.now() - t0) + ' ms; pod ' + JSON.stringify(d.podInfo && d.podInfo.R)); }
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  const srv = spawn(process.execPath, [path.join(T, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  try {
    await new Promise(r => setTimeout(r, 600));
    const { chromium } = findPlaywright();
    const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
    const pg = await br.newPage({ viewport: { width: W, height: H } });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    const cdp = await pg.context().newCDPSession(pg);
    for (const d of done) {
      await pg.goto('http://127.0.0.1:' + port + '/flyDiy/tools/_pod_view.html?scene=.joincache/podview/' + d.base + (TINT ? '&tint=1' : ''));
      await pg.waitForFunction(() => window.POD_VIEW && window.POD_VIEW.ready, null, { timeout: 120000 });
      for (const c of CAMS) {
        const t0 = Date.now();
        await pg.evaluate(c => window.POD_VIEW.cam(c), c);
        const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const f = path.join(OUT, d.base + '_' + c + (TAG ? '_' + TAG : '') + '.png');
        fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
        console.log('  ' + path.relative(ROOT, f) + ' (' + (Date.now() - t0) + ' ms)');
      }
    }
    if (errs.length) console.log('page errors: ' + errs.slice(0, 5).join(' | '));
    await br.close();
  } finally { srv.kill(); }
})().catch(e => { console.log(String(e && e.stack || e)); process.exitCode = 1; });
