#!/usr/bin/env node
// _matlib_check.js — GATE MATLIB (AS4a, G920-G924): the families moved onto the material library look EXACTLY as
// they did, uniform for uniform, and use fewer materials and draws to do it.
//
// src/viewer/matlib.js makes one material per distinct RECORD (the same maps, the same values) where the props,
// the pier kit, the animals, the trees and the strip stones each made one per part; the props then draw the parts
// that wear one record as one geometry, and the strip stones are batches per map. `MATLIB.share = false` is the
// library's A/B - every ask a fresh material, as before - and `?rockbatch=0` the stones' instanced path. This gate
// renders each family BOTH WAYS on the real three.js over the RECORDING WebGL2 (tools/_fake_gl.js, the programs
// reflected off their GLSL so three uploads what a driver would make it upload) and holds:
//
//   1. PROPS, PIER, TOTEMS, ANIMALS (the shipped registries, every key, the real geometry bins): every part of every
//      prop and animal is drawn with THE SAME UNIFORMS - the values three's program holds at that part's draw
//      (colours, roughness, metalness, normal scale, env and ao intensity, the matrices), the same textures bound to
//      its samplers (by the prop registry's texture id), under the same program key. A part drawn inside a merged
//      geometry: its triangles are that geometry's slice, vertex for vertex. Fewer materials and fewer draws.
//   2. TREES (the shipped pack, every subject, series and rung): every part the same uniforms (the tint's uHue /
//      uSat / uLight, the cutoff, the leaf flag, the maps) under the same program key; fewer materials.
//   3. THE STRIP STONES (render_world.js standRocks and rockPartsOf, lifted, on the pack's own rocks along a synthetic
//      strip): every stone of the instanced path is in a batch with its geometry, its matrix (to 1e-5 m), its
//      material's values and its caster flag, and nothing else is; the draw's uniforms bar the batching's own
//      (its matrix / id textures) are the instanced draw's; fewer materials and draws. The cliffs ask the same record.
//   4. THE PROGRAM KEYS (M6): the garage's macro and the site's edge fade key the INJECTION, never its values - two
//      patches of different softness are one program, each drawn with its own uFadeK.
//   5. THE LIBRARY: a record asked twice is one material, a scope keeps it apart, a variant is a sibling with the
//      same values, the last release disposes it.
//   SELF-TEST: a colour changed on one record of the shared side turns check 1 red (the comparison can see).
//
//   node tools/_matlib_check.js   -> "GATE MATLIB: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeGL, makeRecorder, THREE_SRC, ROOT } = require('./_fake_gl.js');
const { readGeo } = require('./_media_lib.js');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; return !!c; };

// ---- a page-like context: the real three over the recording GL, a tracker of what each draw is drawn with --------
function env(opts) {
  opts = opts || {};
  const rec = makeRecorder();
  const { gl: gl0, WebGL2RenderingContext, canvas } = makeGL({ rec });
  // THE TRACKER: the program in use, every uniform value it holds (per program, by name), the texture on each unit
  const T = { prog: null, vals: new Map(), unit: 0, units: new Map(), obj: null, draws: [], on: false };
  const TEX0 = gl0.TEXTURE0;
  const flat = a => { const out = []; for (const x of a) { if (x && typeof x === 'object' && typeof x.length === 'number') for (const y of x) out.push(y); else out.push(x); } return out; };
  const gl = new Proxy(gl0, { get(t, p) {
    const f = t[p];
    if (typeof f !== 'function') return f;
    if (p === 'useProgram') return prog => { T.prog = prog; return f(prog); };
    if (p === 'activeTexture') return u => { T.unit = u - TEX0; return f(u); };
    if (p === 'bindTexture') return (tg, tex) => { T.units.set(T.unit, tex || null); return f(tg, tex); };
    if (/^uniform/.test(p)) return (loc, ...a) => {
      if (loc && loc.p !== undefined) { let m = T.vals.get(loc.p); if (!m) T.vals.set(loc.p, m = new Map());
        m.set(loc.name, /^uniformMatrix/.test(p) ? flat(a.slice(1)) : flat(a)); }
      return f(loc, ...a); };
    if (/^draw/.test(p) || /^multiDraw/.test(p)) return (...a) => { if (T.on && T.obj) T.draws.push(snap()); return f(...a); };
    // a batch draws through WEBGL_multi_draw's own functions
    if (p === 'getExtension') return name => { const e = f(name); if (!e || !/multi_draw/.test(name)) return e;
      return new Proxy(e, { get(t2, q) { const g = t2[q]; return (typeof q === 'string' && /^multiDraw/.test(q)) ? (...a) => { if (T.on && T.obj) T.draws.push(snap()); return g(...a); } : g; } }); };
    return f.bind(t);
  } });
  const ctx = { console, performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    WebGL2RenderingContext, navigator: { userAgent: 'node' }, location: { search: opts.query || '' }, FLYDIY_ASSET_BASE: '',
    Image: function () { return { addEventListener() {}, set src(v) { this._src = v; }, get src() { return this._src; }, complete: false }; } };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(THREE_SRC, ctx);
  const THREE = ctx.THREE;
  canvas.getContext = () => gl;
  const R = new THREE.WebGLRenderer({ context: gl, canvas, reversedDepthBuffer: true });
  R.shadowMap.enabled = false;
  ctx.ASSET_FETCH = rel => Promise.resolve(readGeo(rel));
  const load = rel => vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  // the codecs in THIS realm (three checks its typed arrays by its own realm's constructors)
  for (const f of ['51_prop_codec.js', '53_tree_codec.js', '55_animal_codec.js']) load('src/core/' + f);
  load('src/viewer/matlib.js');
  ctx.MATLIB = vm.runInContext('MATLIB', ctx);
  ctx.MATLIB.share = opts.share !== false;
  // which object a draw is for: three reads onBeforeRender just before it sets the program up and draws
  const rbd = R.renderBufferDirect.bind(R);
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) { T.obj = object; T.mat = material; T.geo = geometry; return rbd(camera, scene, geometry, material, object, group); };
  // a draw's state: every uniform its program holds, a sampler's texture named by the caller's own labels
  let texLabel = null;
  function snap() {
    const props = R.properties.get(T.mat), prog = props && props.currentProgram;
    const pid = T.prog && T.prog.id, m = T.vals.get(pid) || new Map(), u = {};
    for (const [k, v] of m) u[k] = v.map(x => typeof x === 'number' ? x : String(x)).join(',');
    for (const [k, v] of m) if (v.length === 1 && Number.isInteger(v[0])) { const t = T.units.get(v[0]); u[k + '@tex'] = t ? (texLabel ? texLabel(t) : 'gl') : '-'; }
    return { obj: T.obj, geo: T.geo, mat: T.mat, key: prog ? prog.cacheKey : '?', u };
  }
  function frame(scene, camera) { T.draws = []; T.on = true; R.render(scene, camera); T.on = false; return T.draws; }
  // a GL texture back to its three texture: the caller's list of [label, texture]
  function labels(list) {
    const byGl = new Map();
    for (const [lab, t] of list) { const p = R.properties.get(t); if (p && p.__webglTexture) byGl.set(p.__webglTexture, lab); }
    texLabel = g => byGl.get(g) || 'gl?';
  }
  return { ctx, THREE, R, rec, T, load, frame, labels, gl };
}
const cam = THREE => { const c = new THREE.PerspectiveCamera(60, 1, 0.1, 1e6); c.position.set(0, 50, 200); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c; };
const lights = (THREE, scene) => { const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 10, 4); scene.add(d); scene.add(new THREE.AmbientLight(0xffffff, 0.3)); };
const noCull = root => root.traverse(o => { o.frustumCulled = false; });
// two draw states the same? (the uniform tables, key for key, and the program key); the first difference named
function sameState(a, b, skip) {
  if (a.key !== b.key) return 'program key ' + a.key.slice(0, 40) + ' vs ' + b.key.slice(0, 40);
  const ks = new Set(Object.keys(a.u).concat(Object.keys(b.u)));
  for (const k of ks) { if (skip && skip.test(k)) continue; if (a.u[k] !== b.u[k]) return k + ': ' + String(a.u[k]).slice(0, 60) + ' vs ' + String(b.u[k]).slice(0, 60); }
  return null;
}

// ---- 1. the props, the pier, the totems and the animals --------------------------------------------------------
function registries(E) {
  E.load('src/viewer/assets.js');   // G903 (AS0b): TEX_FLAT, which props.js reads for a flat map
  E.load('src/viewer/props.js');
  const reg = (dir, idx) => { for (const f of JSON.parse(fs.readFileSync(path.join(ROOT, dir, idx), 'utf8'))) E.load(dir + '/' + f); };
  reg('src/props', 'props_packs.json'); reg('src/pier', 'pier_packs.json'); reg('src/totems', 'totems_packs.json');
  E.load('src/viewer/plume.js'); E.load('src/viewer/animals.js');
  const AI = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'animals', 'animals_index.json'), 'utf8'));
  for (const f of AI) E.load('src/animals/' + f);
  const AP = path.join(ROOT, 'src', 'animals', 'animals_packs.json');
  if (fs.existsSync(AP)) for (const f of JSON.parse(fs.readFileSync(AP, 'utf8'))) E.load('src/animals/' + f);
}
async function propsSide(share, perturb) {
  const E = env({ share }); const { THREE, ctx } = E;
  registries(E);
  const PR = vm.runInContext('PROP_REG', ctx), keys = PR.order.slice();
  await Promise.all(keys.map(k => ctx.propWarm(k).catch(() => null)));
  const AN = ctx.ANIMALS, akeys = vm.runInContext('typeof ANIMAL_REG !== "undefined" ? ANIMAL_REG.order.slice() : []', ctx);
  await Promise.all(akeys.map(k => AN.warm(k).catch(() => null)));
  const scene = new THREE.Scene(); lights(THREE, scene);
  const owner = new Map();   // mesh -> [label per part it draws]
  keys.forEach((k, i) => {
    const g = ctx.propMesh(THREE, k); g.position.set((i % 20) * 7, 0, Math.floor(i / 20) * 7); scene.add(g);
    const b = ctx.propBuild(THREE, k);
    for (const m of g.children) owner.set(m, m.geometry.userData.parts ? m.geometry.userData.parts.map(j => k + '#' + j) : [k + '#' + b.geos.indexOf(m.geometry)]);
  });
  akeys.forEach((k, i) => {
    let I = null; try { I = AN.instance(THREE, k); } catch (e) { return; }
    I.root.position.set(i * 9, 0, -30); scene.add(I.root);
    I.meshes.forEach((m, j) => owner.set(m, [k + '~' + j]));
  });
  if (perturb) { const b = ctx.propBuild(THREE, perturb); b.mats[0].color.r += 1 / 256; }
  noCull(scene); scene.updateMatrixWorld(true);
  E.labels(Object.entries(PR.texs).flatMap(([id]) => { const out = []; for (const [c, s] of [['PROP_TEX_CACHE', 'srgb'], ['PROP_TEX_CACHE_LIN', 'lin']]) { const t = vm.runInContext(c, ctx).get(id); if (t) out.push([id + ':' + s, t]); } return out; }));
  const draws = E.frame(scene, cam(THREE));
  // the maps do not decode here (no Image in node): three binds its empty texture for each, both sides alike, so a
  // part's textures are ALSO compared on its material - every texture slot by the registry's texture id
  const texId = new Map();
  for (const [c, sfx] of [['PROP_TEX_CACHE', 'srgb'], ['PROP_TEX_CACHE_LIN', 'lin']]) for (const [id, t] of vm.runInContext(c, ctx)) texId.set(t, id + ':' + sfx);
  const slots = m => ['map', 'roughnessMap', 'metalnessMap', 'aoMap', 'normalMap', 'emissiveMap', 'alphaMap'].map(k => k + '=' + (m[k] ? texId.get(m[k]) || '?' : '-')).join(' ');
  const byPart = new Map();
  for (const d of draws) for (const lab of owner.get(d.obj) || []) byPart.set(lab, Object.assign({}, d, { u: Object.assign({}, d.u, { '@maps': slots(d.mat) }) }));
  const mats = new Set(); scene.traverse(o => { if (o.material) mats.add(o.material); });
  return { E, ctx, THREE, keys, draws, byPart, mats: mats.size, stats: ctx.MATLIB.stats() };
}
function mergedSlices(S) {
  // every merged geometry is its parts, concatenated, vertex for vertex and index for index
  let n = 0, bad = null;
  for (const k of S.keys) {
    const b = S.ctx.propBuild(S.THREE, k);
    for (const g of b.dgeos) {
      const P = g.userData.parts; if (!P) continue; n++;
      let v = 0, t = 0;
      for (const j of P) {
        const q = b.geos[j], A = q.attributes, cnt = A.position.count;
        for (const [name, w] of [['position', 3], ['normal', 3], ['uv', 2]]) { const src = A[name].array, dst = g.attributes[name].array;
          for (let x = 0; x < cnt * w; x++) if (src[x] !== dst[v * w + x]) { bad = bad || k + ' part ' + j + ' ' + name; break; } }
        const I = q.index.array; for (let x = 0; x < I.length; x++) if (g.index.array[t + x] !== I[x] + v) { bad = bad || k + ' part ' + j + ' index'; break; }
        v += cnt; t += I.length;
      }
      if (v !== g.attributes.position.count || t !== g.index.count) bad = bad || k + ' size';
    }
  }
  return { n, bad };
}
function compareParts(A, B, label) {
  let n = 0, diff = null, missing = null;
  for (const [lab, a] of A.byPart) { const b = B.byPart.get(lab); if (!b) { missing = missing || lab; continue; } n++; const d = sameState(a, b); if (d && !diff) diff = lab + ' - ' + d; }
  return { n, diff, missing, of: A.byPart.size };
}

// ---- 2. the trees ------------------------------------------------------------------------------------------------
async function treesSide(share) {
  const E = env({ share }); const { THREE, ctx } = E;
  E.load('src/viewer/trees_pack.js'); E.load('src/viewer/trees.js');
  await ctx.treeWarm();
  const scene = new THREE.Scene(); lights(THREE, scene);
  const owner = new Map(), texs = [];
  let i = 0;
  for (const e of ctx.treeList('all')) for (const ser of ['rungs', 'stand', 'snag']) {
    const L = e.sub[ser]; if (!L || !L.length) continue;
    for (let r = 0; r < L.length; r++) {
      const b = ctx.treeBuild(THREE, e.key, r, ser);
      b.parts.forEach((q, j) => { const m = new THREE.Mesh(q.geo, q.mat); m.position.set((i % 40) * 30, 0, Math.floor(i / 40) * 30); i++; scene.add(m); owner.set(m, e.key + '|' + ser + '|' + r + '|' + j);
        if (q.mat.map && !texs.some(x => x[1] === q.mat.map)) texs.push(['t' + texs.length, q.mat.map]); });
    }
  }
  noCull(scene); scene.updateMatrixWorld(true);
  // the maps never decode here (no Image in node): three binds its empty texture for every map, both sides alike;
  // the map's identity is compared on the material (the same texture object by URL: trees.js TEX)
  const draws = E.frame(scene, cam(THREE));
  const byPart = new Map();
  for (const d of draws) { const lab = owner.get(d.obj); if (lab) byPart.set(lab, Object.assign({}, d, { u: Object.assign({}, d.u, { '@map': d.mat.map ? 'tex#' + texs.findIndex(x => x[1] === d.mat.map) : '-' }) })); }
  const mats = new Set(); scene.traverse(o => { if (o.material) mats.add(o.material); });
  return { byPart, mats: mats.size, draws: draws.length, ctx, THREE };
}

// ---- 3. the strip stones -----------------------------------------------------------------------------------------
function lift(src, start, end) { const i = src.indexOf(start); const j = src.indexOf(end, i); return i >= 0 && j > i ? src.slice(i, j + end.length) : null; }
async function stonesSide(batch) {
  const E = env({ share: batch, query: batch ? '' : '?rockbatch=0' }); const { THREE, ctx } = E;
  E.load('src/viewer/trees_pack.js'); E.load('src/viewer/trees.js');
  await ctx.treeWarm();
  const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
  const partsSrc = lift(RW, '  const rockPartsOf = () => {', '\n    return (rockParts = out);\n  };');
  const standSrc = lift(RW, '  const standRocks = (field, o, keep) => {', '\n      scene.add(keep(obj));\n    }\n  };');
  if (!partsSrc || !standSrc) return { err: 'rockPartsOf / standRocks not found in render_world.js' };
  const scene = new THREE.Scene(); lights(THREE, scene);
  const world = { terrainH: (x, z) => 2 + 0.01 * x - 0.02 * z, premises: null };
  const mk = new Function('THREE', 'world', 'scene', 'treeList', 'treeBuild', 'MATLIB', 'waterDrawY', 'location',
    'let rockParts = null;\n' + partsSrc + '\n' + standSrc + '\nreturn { rockPartsOf, standRocks };');
  const L = mk(THREE, world, scene, ctx.treeList, ctx.treeBuild, ctx.MATLIB, () => null, ctx.location);
  const wid = 30, len = 1300;
  const field = { at: (x, z) => ({ dEdge: wid / 2 - Math.abs(z) }) };
  const stood = [];
  L.standRocks(field, { id: 'T', seed: 12345, len, wid, band: 4, toWorld: (u, v) => [u, v] }, o => { stood.push(o); return o; });
  scene.updateMatrixWorld(true);
  // every stone: its geometry (by the pack's part), its world matrix, its material's values, its caster flag
  const parts = L.rockPartsOf(), geoLab = new Map();
  parts.forEach((P, i) => P.parts.forEach((q, j) => geoLab.set(q.geo, P.key + '#' + j)));
  const maps = []; for (const P of parts) for (const q of P.parts) if (q.mat.map && !maps.includes(q.mat.map)) maps.push(q.mat.map);   // the pack's maps, in the pack's order
  const matVal = m => [m.type, m.map ? 'map' + maps.indexOf(m.map) : '-', m.roughness, m.metalness, m.color.getHexString(), m.side, m.transparent].join('/');
  const stones = [], M4 = new THREE.Matrix4(), W = new THREE.Matrix4();
  let meshes = 0; const mats = new Set();
  scene.traverse(o => {
    if (o.isInstancedMesh) { meshes++; mats.add(o.material); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M4); W.multiplyMatrices(o.matrixWorld, M4); stones.push([geoLab.get(o.geometry), W.elements.map(v => v.toFixed(5)).join(','), matVal(o.material), o.castShadow ? 1 : 0].join('|')); } }
    else if (o.isBatchedMesh) { meshes++; mats.add(o.material); for (let i = 0; i < o.instanceCount; i++) { if (!o.getVisibleAt(i)) continue; o.getMatrixAt(i, M4); W.multiplyMatrices(o.matrixWorld, M4); stones.push([geoLab.get(o.userData.geos[o.getGeometryIdAt(i)]), W.elements.map(v => v.toFixed(5)).join(','), matVal(o.material), o.castShadow ? 1 : 0].join('|')); } }
  });
  // a frame from above each cell of the strip (the cells' LODs pick their level from the eye): the draws, their states
  let draws = [];
  for (let x = 200; x < len; x += 400) { const c = new THREE.PerspectiveCamera(110, 1, 0.1, 1e5); c.position.set(x, 80, 0); c.lookAt(x, 0, 0.01); c.updateMatrixWorld(); draws = draws.concat(E.frame(scene, c)); }
  // a sampler's UNIT moves (the batch's own textures take the first ones): the map is compared on the material
  const states = new Set(draws.map(d => { const u = Object.assign({}, d.u); for (const k of Object.keys(u)) if (/batching|modelMatrix|modelViewMatrix|normalMatrix|@tex$/.test(k) || (k + '@tex') in d.u) delete u[k]; return JSON.stringify([u, matVal(d.mat)]); }));
  return { stones: stones.sort(), meshes, mats: mats.size, draws: draws.length, states, parts, ctx };
}

// ---- 4. the program keys -----------------------------------------------------------------------------------------
function keysSide() {
  const E = env({}); const { THREE, ctx } = E;
  ctx.ATMO = undefined;
  E.load('src/viewer/site_ground.js');
  const scene = new THREE.Scene(); lights(THREE, scene);
  const a = ctx.siteEdgeFade(THREE, new THREE.MeshStandardMaterial({ color: 0x55aa33 }), 0.34, 10, 10);
  const b = ctx.siteEdgeFade(THREE, new THREE.MeshStandardMaterial({ color: 0x55aa33 }), 0.6, 20, 20);
  const g = new THREE.PlaneGeometry(10, 10); g.rotateX(-Math.PI / 2);
  const ma = new THREE.Mesh(g, a), mb = new THREE.Mesh(g, b); mb.position.x = 20; scene.add(ma, mb);
  const links0 = E.rec.links;
  const draws = E.frame(scene, cam(THREE));
  const dA = draws.find(d => d.obj === ma), dB = draws.find(d => d.obj === mb);
  const HG = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'), 'utf8');
  const hkey = /mat\.customProgramCacheKey = \(\) => ('[^']*'[^;]*);/.exec(HG.slice(HG.indexOf('const macroise')));
  return { links: E.rec.links - links0, dA, dB, hkey: hkey && hkey[1] };
}

// ---- 5. the library itself ---------------------------------------------------------------------------------------
function libSide() {
  const E = env({}); const { THREE, ctx } = E; const ML = ctx.MATLIB;
  const t = new THREE.Texture();
  const p = () => ({ map: t, color: new THREE.Color(0.2, 0.3, 0.4), roughness: 0.7, metalness: 0 });
  const a = ML.shared(THREE, 'std', p()), b = ML.shared(THREE, 'std', p()), c = ML.shared(THREE, 'std', p(), 'mine'),
        d = ML.shared(THREE, 'std', Object.assign(p(), { roughness: 0.70001 })), e = ML.shared(THREE, 'std', Object.assign(p(), { map: new THREE.Texture() }));
  const v = ML.variant(THREE, a, 'inst'), v2 = ML.variant(THREE, a, 'inst');
  let disposed = 0; a.addEventListener('dispose', () => disposed++);
  ML.release(a); const one = disposed; ML.release(b);
  return { same: a === b, scoped: c !== a, byValue: d !== a, byTex: e !== a, variant: v !== a && v === v2 && v.color.equals(a.color) && v.map === a.map && v.roughness === a.roughness,
           release: one === 0 && disposed === 1, row: ML.rowOf(a) === ML.rowOf(b) && ML.rowOf(c) !== ML.rowOf(a), table: ML.table().rows >= 4 };
}

(async () => {
  console.log('GATE MATLIB');
  const t0 = Date.now();
  // 1
  const A = await propsSide(false), B = await propsSide(true);
  const C1 = compareParts(A, B);
  ok(A.byPart.size > 500 && C1.n === A.byPart.size && !C1.missing, '1 every prop / pier / totem / animal part drawn both ways', C1.n + ' of ' + A.byPart.size + ' parts, ' + A.keys.length + ' props, ' + [...A.byPart.keys()].filter(k => k.includes('~')).length + ' animal meshes' + (C1.missing ? '; missing ' + C1.missing : ''));
  ok(!C1.diff, '1 every part drawn with the same uniforms, textures and program key', C1.diff || (C1.n + ' parts, ' + Object.keys((A.draws[0] || { u: {} }).u).length + '+ uniforms a draw'));
  const MS = mergedSlices(B);
  ok(MS.n > 0 && !MS.bad, '1 a merged geometry is its parts, vertex for vertex', MS.bad || MS.n + ' merged draws');
  ok(B.mats < A.mats && B.draws.length < A.draws.length, '1 fewer materials and draws', 'materials ' + A.mats + ' -> ' + B.mats + ', draws ' + A.draws.length + ' -> ' + B.draws.length + '; records asked ' + B.stats.asked + ', made ' + B.stats.made);
  // SELF-TEST: a colour nudged by 1/256 on one record of the shared side
  const Bp = await propsSide(true, A.keys.find(k => /^pier_|^auto_|^car_/.test(k)) || A.keys[0]);
  const Cp = compareParts(A, Bp);
  ok(!!Cp.diff, 'SELF-TEST a record\'s colour nudged 1/256 turns check 1 red', Cp.diff ? Cp.diff.slice(0, 90) : 'not seen');
  // 2
  const TA = await treesSide(false), TB = await treesSide(true);
  const C2 = compareParts(TA, TB);
  ok(TA.byPart.size > 100 && C2.n === TA.byPart.size, '2 every tree part (subject x series x rung) drawn both ways', C2.n + ' of ' + TA.byPart.size + (C2.missing ? '; missing ' + C2.missing : ''));
  ok(!C2.diff, '2 every tree part drawn with the same uniforms (tint, cutoff, leaf), map and program key', C2.diff || C2.n + ' parts');
  ok(TB.mats < TA.mats, '2 fewer tree materials', TA.mats + ' -> ' + TB.mats);
  // 3
  const SA = await stonesSide(false), SB = await stonesSide(true);
  if (!ok(!SA.err && !SB.err, '3 the strip stones lift out of render_world.js', SA.err || SB.err)) {}
  else {
    const same = SA.stones.length === SB.stones.length && SA.stones.every((s, i) => s === SB.stones[i]);
    let first = null; if (!same) for (let i = 0; i < Math.max(SA.stones.length, SB.stones.length); i++) if (SA.stones[i] !== SB.stones[i]) { first = (SA.stones[i] || '-').slice(0, 60) + ' vs ' + (SB.stones[i] || '-').slice(0, 60); break; }
    ok(SA.stones.length > 200 && same, '3 every stone of the instanced path is in a batch: its geometry, matrix, material values and caster flag', SA.stones.length + ' stones' + (first ? '; first difference ' + first : ''));
    const miss = [...SA.states].filter(s => !SB.states.has(s)).length + [...SB.states].filter(s => !SA.states.has(s)).length;
    ok(miss === 0, '3 the stones\' draws hold the same uniforms (bar the batching\'s own)', SA.states.size + ' distinct states instanced, ' + SB.states.size + ' batched');
    ok(SB.mats < SA.mats && SB.meshes < SA.meshes && SB.draws < SA.draws, '3 fewer materials, meshes and draws', 'materials ' + SA.mats + ' -> ' + SB.mats + ', meshes ' + SA.meshes + ' -> ' + SB.meshes + ', draws ' + SA.draws + ' -> ' + SB.draws);
    const CL = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'cliffs.js'), 'utf8');
    ok(/MATLIB\.shared\(THREE, 'std', \{ map: q\.mat\.map \|\| null, roughness: 1, metalness: 0 \}\)/.test(CL), '3 the cliffs ask the stones\' record (one material per map)');
  }
  // 4
  const K = keysSide();
  ok(K.links === 1 && K.dA && K.dB && K.dA.key === K.dB.key, '4 two edge-faded patches of different softness: ONE program', K.links + ' link(s)');
  ok(K.dA && K.dB && K.dA.u.uFadeK !== K.dB.u.uFadeK && +K.dA.u.uFadeK === 0.34 && Math.abs(+K.dB.u.uFadeK - 0.6) < 1e-7, '4 ...each drawn with its own uFadeK', K.dA && K.dB ? K.dA.u.uFadeK + ' / ' + K.dB.u.uFadeK : 'no draws');
  ok(K.hkey === "'site-macro'", '4 the garage\'s macro keys its injection, not its metres and amount', K.hkey);
  // 5
  const L = libSide();
  for (const [k, v] of Object.entries(L)) ok(v, '5 the library: ' + k);
  console.log('  materials by uuid -> the families\' records: props ' + A.mats + ' -> ' + B.mats + ', trees ' + TA.mats + ' -> ' + TB.mats + (SA.mats ? ', strip stones ' + SA.mats + ' -> ' + SB.mats : ''));
  console.log('  wall ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  console.log('GATE MATLIB: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE MATLIB: FAIL'); process.exit(1); });
