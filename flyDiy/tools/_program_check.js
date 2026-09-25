#!/usr/bin/env node
// _program_check.js — GATE PROGRAMS (G570): the programs a boot links are the same every boot, and the
// roll-out's compile step warms the ones the first frames draw with.
//
// The warm roll-out spent 16-26 s in its compile step (futureDesigns/PERF-2026-09-23.md G570). A census of
// two boots (headless Chrome, every linkProgram recorded with the boot step it ran in - tools/program_census.js)
// found no program whose source changes from boot to boot, but a first frame that still linked the shadow
// pass's whole depth set (the warm-up compiled other programs), the passes outside the scene, and programs
// re-linked by materials made and disposed per bake. This gate runs THE REAL three.js (vendor/three.min.js,
// r186) in node on a fake WebGL2 context that records every shader source and every link, so it holds the
// game's warm-up to three's own rules rather than to a copy of them:
//
//   1. THE DEPTH WARM-UP IS THE SHADOW PASS. A caster zoo (sides, map, alphaTest, alpha to coverage,
//      instancing with and without colour, a batch, skinning, draw groups, a custom depth material with its
//      own hook and key) under a shadow-casting sun: PROG_WARM.depthVariants compiled as app.js compiles it,
//      then the real frame rendered - the frame must link NOTHING new. The old warm-up (RGBA packing, one per
//      side, no lights) is run as the CONTROL and must miss (the gate can see the fault it guards).
//   2. NO PER-BOOT VALUE IN A PROGRAM. Two boots (a fresh three, a fresh context, fresh materials each): the
//      same program keys and the same sources, and no key or source carries a uuid, a time or a counter.
//   3. A BAKE LINKS EACH PROGRAM ONCE. The rock map's sprite bake (rock_map.js) with six subjects sharing two
//      programs links two, and a recentre re-links none; a kept PMREMGenerator bakes twice on one link.
//   4. THE PASSES OUTSIDE THE SCENE ARE LISTED. aa_resolve, post_fx and clouds each publish warmList() and the
//      roll-out's compile step compiles them (source check: those modules need a live GL to build).
//
//   node tools/_program_check.js   -> "GATE PROGRAMS: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };

// ---- the real three on a fake WebGL2 (tools/_fake_gl.js) ----------------------------------------------
const { boot } = require('./_fake_gl.js');
const keysOf = R => R.info.programs.map(p => p.cacheKey);

// ---- the caster zoo: every kind of object the world casts from -------------------------------------
function zoo(B) {
  const { THREE } = B;
  const sc = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sc.add(sun); sc.add(new THREE.HemisphereLight());
  sc.fog = new THREE.Fog(0xaabbcc, 100, 5000);   // the world has fog; the shadow pass draws with none (the second census's re-links)
  const near = new THREE.DirectionalLight(0x000000, 1); near.castShadow = true; sc.add(near);   // shadow_near's black light
  const tex = new THREE.Texture(); tex.image = { width: 4, height: 4 };
  const box = new THREE.BoxGeometry(), put = (o, cast) => { o.castShadow = cast !== false; o.receiveShadow = true; sc.add(o); return o; };
  const std = o => new THREE.MeshStandardMaterial(o);
  put(new THREE.Mesh(box, std({})));                                                        // plain, front
  put(new THREE.Mesh(box, std({ side: THREE.DoubleSide, map: tex })));                       // a map, no alpha test: the shared depth takes the map
  put(new THREE.Mesh(box, std({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })));      // alpha-tested leaves: a depth material of its own
  put(new THREE.Mesh(box, std({ map: tex, alphaToCoverage: true })));                       // the flower cards
  put(new THREE.Mesh(box, std({ side: THREE.BackSide })));
  put(new THREE.Mesh(box, new THREE.MeshPhysicalMaterial({ clearcoat: 1 })));
  put(new THREE.Mesh(box, std({ shadowSide: THREE.DoubleSide })));
  const inst = put(new THREE.InstancedMesh(box, std({ map: tex }), 3));
  const instC = put(new THREE.InstancedMesh(box, std({ map: tex, alphaTest: 0.3 }), 3)); instC.setColorAt(0, new THREE.Color(1, 0, 0));
  // the draw groups: each group's material casts its own
  const g2 = box.clone(); g2.clearGroups(); g2.addGroup(0, 18, 0); g2.addGroup(18, 18, 1);
  put(new THREE.Mesh(g2, [std({}), std({ map: tex, alphaTest: 0.5 })]));
  // a custom depth material with its own hook and key (the impostors', the tree cards')
  const cd = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  cd.onBeforeCompile = sh => { sh.uniforms.uNearB = { value: 1 }; sh.vertexShader = 'uniform float uNearB;\n' + sh.vertexShader; };
  cd.customProgramCacheKey = () => 'gate-impDepth';
  const ci = put(new THREE.InstancedMesh(box, std({ map: tex, alphaTest: 0.5 }), 2)); ci.customDepthMaterial = cd; ci.setColorAt(0, new THREE.Color(0, 1, 0));
  // a skinned caster (the people)
  const bone = new THREE.Bone(); const skinG = box.clone();
  const n = skinG.attributes.position.count; skinG.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4)); skinG.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).fill(0.25), 4));
  const sk = put(new THREE.SkinnedMesh(skinG, std({ side: THREE.DoubleSide }))); sk.add(bone); sk.bind(new THREE.Skeleton([bone]));
  // a batch with colours (life's kit)
  if (THREE.BatchedMesh) { const bm = new THREE.BatchedMesh(4, 200, 400, std({ side: THREE.DoubleSide })); const gid = bm.addGeometry(box); const iid = bm.addInstance(gid); bm.setColorAt(iid, new THREE.Color(1, 1, 1)); put(bm); }
  // not a caster: must not add a depth program
  put(new THREE.Mesh(box, std({ color: 0x00ff00 })), false);
  inst.count = 3;
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); cam.position.set(0, 2, 8); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  sc.updateMatrixWorld(true);
  return { sc, cam };
}

console.log('GATE PROGRAMS');
const WARM_SRC = path.join('src', 'viewer', 'shader_warm.js');

// ---- 1. the depth warm-up is the shadow pass ----------------------------------------------------------
function warmThenFrame(useOld) {
  const B = boot(); B.load(WARM_SRC);
  const { THREE, renderer: R, ctx } = B, W = ctx.PROG_WARM;
  const { sc, cam } = zoo(B);
  const plain = new THREE.WebGLRenderTarget(4, 4);
  // the scene's own pass first (compilePass(scene) in app.js), then the depth helper - as the roll-out does
  R.compile(sc, cam);
  if (useOld) {   // THE CONTROL: app.js's warm-up before G570, verbatim in effect
    const helper = new THREE.Scene(), seen = new Set(), defDepth = new Map();
    const SIDE = m => m.side === THREE.DoubleSide ? THREE.DoubleSide : m.side === THREE.BackSide ? THREE.FrontSide : THREE.BackSide;
    const add = (o, mat) => { const key = mat.uuid + (o.isInstancedMesh ? ':i' : ':m') + (o.isSkinnedMesh ? ':s' : ''); if (seen.has(key)) return; seen.add(key); helper.add(W.standIn(o, mat)); };
    sc.traverse(o => { if (!o.isMesh || !o.castShadow) return; if (o.customDepthMaterial) { add(o, o.customDepthMaterial); return; }
      const m = Array.isArray(o.material) ? o.material[0] : o.material; const s = SIDE(m); let d = defDepth.get(s);
      if (!d) { d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: s }); defDepth.set(s, d); } add(o, d); });
    R.setRenderTarget(plain); R.compile(helper, cam); R.setRenderTarget(null);
  } else {
    const { helper } = W.depthVariants(THREE, R, [sc]);
    R.setRenderTarget(plain); W.fogless(sc, () => R.compile(helper, cam, sc)); R.setRenderTarget(null);
  }
  const before = new Set(keysOf(R)), nLinks = B.links.length;
  R.render(sc, cam);
  const late = keysOf(R).filter(k => !before.has(k));
  return { late, lateLinks: B.links.length - nLinks, warmed: before.size, depthLate: late.filter(k => /^(depth|distance)/.test(k) || /gate-impDepth/.test(k)) };
}
{
  const now = warmThenFrame(false), old = warmThenFrame(true);
  ok(now.late.length === 0 && now.lateLinks === 0, '1 the first frame links nothing the compile step did not (' + now.warmed + ' programs warmed)', now.late.length ? now.late.map(k => k.slice(0, 40)).join(' / ') : undefined);
  ok(old.depthLate.length >= 4, '1 CONTROL: the old warm-up (RGBA packing, per side, no lights) leaves the shadow pass its own programs to link', old.depthLate.length + ' depth programs on the first frame');
}
// a point light's shadow draws distance programs: warmed too
{
  const B = boot(); B.load(WARM_SRC); const { THREE, renderer: R, ctx } = B;
  const sc = new THREE.Scene(), pl = new THREE.PointLight(0xffffff, 1); pl.castShadow = true; sc.add(pl);
  const tex = new THREE.Texture(); tex.image = { width: 4, height: 4 };
  for (const m of [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5 })]) { const o = new THREE.Mesh(new THREE.BoxGeometry(), m); o.castShadow = true; sc.add(o); }
  const cam = new THREE.PerspectiveCamera(); cam.position.z = 5; sc.updateMatrixWorld(true);
  R.compile(sc, cam); const { helper } = ctx.PROG_WARM.depthVariants(THREE, R, [sc]);
  R.setRenderTarget(new THREE.WebGLRenderTarget(4, 4)); R.compile(helper, cam, sc); R.setRenderTarget(null);
  const before = new Set(keysOf(R)); R.render(sc, cam);
  const late = keysOf(R).filter(k => !before.has(k));
  ok(late.length === 0, '1 a point light\'s shadow (distance programs) is warmed too', late.length ? late.map(k => k.slice(0, 30)).join(' / ') : undefined);
}
// the stand-in shares the caster's data and never moves the caster
{
  const B = boot(); B.load(WARM_SRC); const { THREE, renderer: R, ctx } = B; const { sc } = zoo(B);
  const n0 = sc.children.length; let heard = 0; sc.children[3].addEventListener('added', () => heard++);
  const { helper, n } = ctx.PROG_WARM.depthVariants(THREE, R, [sc]);
  ok(sc.children.length === n0 && helper.children.every(s => Object.getPrototypeOf(s).parent === sc) && heard === 0,
     '1 the warm-up\'s stand-ins leave the casters where they are (' + n + ' stand-ins; none of the casters\' listeners fired)');
}

// ---- 2. no per-boot value in a program -----------------------------------------------------------------
{
  const run = () => { const B = boot(); B.load(WARM_SRC); const { THREE, renderer: R, ctx } = B; const { sc, cam } = zoo(B);
    R.compile(sc, cam); const { helper } = ctx.PROG_WARM.depthVariants(THREE, R, [sc]);
    R.setRenderTarget(new THREE.WebGLRenderTarget(4, 4)); ctx.PROG_WARM.fogless(sc, () => R.compile(helper, cam, sc)); R.setRenderTarget(null); R.render(sc, cam);
    return { keys: keysOf(R).slice().sort(), srcs: B.links.map(l => l.vs + '\u0000' + l.fs).sort() }; };
  const a = run(), b = run();
  ok(a.keys.length > 10 && JSON.stringify(a.keys) === JSON.stringify(b.keys), '2 two boots key the same programs', a.keys.length + ' programs');
  ok(JSON.stringify(a.srcs) === JSON.stringify(b.srcs), '2 two boots link the same sources', a.srcs.length + ' links');
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const bad = a.keys.filter(k => UUID.test(k)).concat(a.srcs.filter(s => UUID.test(s)).map(s => 'source'));
  ok(bad.length === 0, '2 no program key or source carries a uuid', bad.length ? bad.slice(0, 3).join(' / ') : undefined);
}
// the game's own cache keys: a customProgramCacheKey reading a per-boot value (a uuid, an id, a clock, Math.random)
// is a new program every boot - the static half of the census's (a)
{
  const dir = path.join(ROOT, 'src', 'viewer'), bad = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    const re = /customProgramCacheKey\s*=\s*(?:\(\)\s*=>|function\s*\(\)\s*\{)([^\n;]*)/g; let m;
    while ((m = re.exec(src))) if (/\.uuid|\.id\b|Math\.random|Date\.now|performance\.now|\+\+/.test(m[1])) bad.push(f + ': ' + m[1].trim().slice(0, 60));
  }
  ok(bad.length === 0, '2 no customProgramCacheKey in src/viewer reads a uuid, an id, a clock or a counter', bad.join(' / ') || undefined);
}

// ---- 3. a bake links each program once -------------------------------------------------------------------
{
  const B = boot(); const { THREE, renderer: R, ctx } = B; B.load(path.join('src', 'viewer', 'rock_map.js'));
  const tex = n => { const t = new THREE.Texture(); t.image = { width: 4, height: 4, complete: true }; t.name = n; return t; };
  const maps = [tex('a'), tex('b'), tex('c')], box = new THREE.BoxGeometry();
  // six subjects, three maps, two of them cut: two programs (plain, cut)
  const subj = (key, map, cut) => ({ c: { place: { cut } }, P: [{ key, r0: 1, parts: [{ geo: box, mat: { map } }] }] });
  const protos = [subj('p1', maps[0], 0), subj('p2', maps[1], 0), subj('p3', maps[2], 0.2), subj('p4', maps[0], 0.2), subj('p5', maps[1], 0), subj('p6', maps[2], 0.3)];
  const recs = protos.map((s, i) => ({ p: s.P[0], x: i * 5, z: 0, s: 1, yaw: 0, col: i % 2 ? [1, 0.9, 0.8] : null }));
  const cover = { rockProtos: () => protos, rockPlan: (cx, cz) => (cx === 0 && cz === 0 ? recs : null) };
  const gU = { uRockRect: { value: new THREE.Vector4() }, uRockMap: { value: null }, uRockFade: { value: new THREE.Vector4() } };
  const camera = { position: new THREE.Vector3(0, 10, 0) };
  const RM = ctx.ROCK_MAP.make(THREE, { renderer: R, world: {}, cover, camera, gU });
  const n0 = B.links.length;
  for (let i = 0; i < 400; i++) RM.update();
  const bakeLinks = B.links.length - n0;
  const distinct = new Set(B.links.slice(n0).map(l => l.vs + '\u0000' + l.fs)).size;
  camera.position.set(5000, 10, 0); for (let i = 0; i < 400; i++) RM.update();   // recentre: a rebuild and a render
  camera.position.set(0, 10, 0); for (let i = 0; i < 400; i++) RM.update();
  const after = B.links.length - n0 - bakeLinks;
  ok(bakeLinks > 0 && bakeLinks === distinct, '3 the rock map\'s sprite bake and map link each program once', bakeLinks + ' links, ' + distinct + ' distinct');
  ok(after === 0, '3 a recentre of the rock map re-links nothing', after + ' links');
}
{
  const B = boot(); const { THREE, renderer: R } = B;
  const cube = new THREE.WebGLCubeRenderTarget(16); const pm = new THREE.PMREMGenerator(R);
  const n0 = B.links.length; pm.fromCubemap(cube.texture); const n1 = B.links.length; pm.fromCubemap(cube.texture); const n2 = B.links.length;
  pm.dispose(); const pm2 = new THREE.PMREMGenerator(R); pm2.fromCubemap(cube.texture); const n3 = B.links.length;
  ok(n1 > n0 && n2 === n1 && n3 > n2, '3 a kept PMREMGenerator bakes again on no link; a new one after a dispose links again (three\'s rule the kept one avoids)', (n1 - n0) + ' / ' + (n2 - n1) + ' / ' + (n3 - n2) + ' links');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const body = app.slice(app.indexOf('function bakeHangarEnv()'), app.indexOf('function bakeHangarEnv()') + 12000);
  ok(!/new THREE\.PMREMGenerator/.test(body) && !/\bpm2?\.dispose\(\)/.test(body), '3 bakeHangarEnv keeps its generators (envGen), none made or disposed per bake');
}

// ---- 4. the passes outside the scene are listed and compiled -------------------------------------------
{
  const rd = f => fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
  const app = rd('app.js'), cdv = app.slice(app.indexOf('function compileDepthVariants()'), app.indexOf('function compileDepthVariants()') + 4000);
  ok(/warmList:/.test(rd('aa_resolve.js')) && /function warmList\(\)/.test(rd('post_fx.js')) && /function warmList\(\)/.test(rd('clouds.js')), '4 aa_resolve, post_fx and clouds publish warmList()');
  ok(/aa\.warmList\(\)/.test(cdv) && /POST_FX\.warmList\(\)/.test(cdv) && /CLOUDS\.warmList\(\)/.test(cdv) && /PROG_WARM\.passes/.test(cdv) && /PROG_WARM\.depthVariants\(THREE, renderer, \[scene\]\)/.test(cdv) && /PROG_WARM\.fogless\(scene, \(\) => compilePass\(helper, PLAIN_RT\(\), scene\)\)/.test(cdv),
     '4 the roll-out\'s compile step warms the depth variants in the lit scene and every listed pass');
  // the global's name is its own: app.js already had a `const SHADER_WARM` (the warm-launch localStorage key), which
  // shadowed the module inside app.js's scope - the step threw and warmed nothing (the first census after the change)
  const clash = fs.readdirSync(path.join(ROOT, 'src', 'viewer')).filter(f => f.endsWith('.js') && f !== 'shader_warm.js')
    .filter(f => /(?:const|let|var|function|class)\s+PROG_WARM\b/.test(rd(f)));
  ok(clash.length === 0, '4 nothing else in src/viewer declares PROG_WARM', clash.join(', ') || undefined);
  const build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  ok(build.indexOf("'shader_warm.js'") > 0 && build.indexOf("'shader_warm.js'") < build.indexOf("'app.js'"), '4 shader_warm.js ships before app.js');
}

console.log('GATE PROGRAMS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
