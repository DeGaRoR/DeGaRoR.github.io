'use strict';
// Real three program-key test on fake GL; no browser, GPU, or timing claim.
const assert = require('assert');
const { boot } = require('./_fake_gl.js');
async function main() {
  const B = boot(), { THREE: T, renderer: R, links } = B;
  B.load('src/viewer/shader_warm.js');
  const W = B.ctx.PROG_WARM, sc = new T.Scene(), camera = new T.PerspectiveCamera();
  const sun = new T.DirectionalLight(0xffffff, 1); sun.castShadow = true;
  sc.add(sun); sc.add(new T.HemisphereLight()); sc.fog = new T.Fog(0x445566, 100, 1000);
  const pool = [];
  for (let i = 0; i < 8; i++) { const l = new T.PointLight(); l.visible = false; pool.push(l); sc.add(l); }
  const geo = new T.BoxGeometry(), mats = [], meshes = [];
  for (const side of [T.FrontSide, T.DoubleSide]) {
    const m = new T.MeshStandardMaterial({ side }); mats.push(m);
    const o = new T.Mesh(geo, m); o.castShadow = o.receiveShadow = true; sc.add(o); meshes.push(o);
  }
  const inst = new T.InstancedMesh(geo, mats[0], 2); inst.castShadow = true; inst.receiveShadow = true; sc.add(inst);
  const hidden = new T.Group(); hidden.visible = false; hidden.add(new T.PointLight()); sc.add(hidden);
  const target = new T.WebGLRenderTarget(16, 16), depthTarget = new T.WebGLRenderTarget(8, 8);
  R.setRenderTarget(target); R.compile(sc, camera);
  const pointers = mats.map(m => R.properties.get(m).currentProgram);
  const before = links.length;
  let scheduled = 0;
  const opt = { want: true, pool, target, depthTarget, schedule(fn) { scheduled++; setTimeout(fn, 0); } };
  const p = W.lampVariants(T, R, sc, camera, opt);
  assert.strictEqual(links.length, before, 'no compile in the request/lamp-on task');
  const ready = await p;
  assert(scheduled >= ready.jobs, 'at most one compile per scheduled frame');
  assert(pool.every(l => !l.visible), 'day pool remains hidden during preparation');
  mats.forEach((m, i) => assert.strictEqual(R.properties.get(m).currentProgram, pointers[i], 'live currentProgram untouched'));
  assert.strictEqual(R.getRenderTarget(), target);
  pool.forEach(l => { l.visible = true; });
  const linked = links.length;
  R.compile(sc, camera);
  assert.strictEqual(links.length, linked, 'real lamp activation keys only ready cached programs');
  const depth = W.depthVariants(T, R, [sc]).helper;
  const fog = sc.fog; sc.fog = null; R.setRenderTarget(depthTarget);
  R.compile(depth, camera, sc); sc.fog = fog;
  assert.strictEqual(links.length, linked, 'real night shadow variants already linked');
  assert(ready.jobs < 16, 'shared depth variants deduplicate across meshes');
  // Dawn uses its own prepared count; retain both sets until their replacements.
  const dawn = await W.lampVariants(T, R, sc, camera, { ...opt, want: false });
  pool.forEach(l => { l.visible = false; });
  const dawnLinks = links.length; R.setRenderTarget(target); R.compile(sc, camera);
  assert.strictEqual(links.length, dawnLinks, 'dawn keys match too');
  // A rejected compile must reject preparation, never resolve readiness.
  const compile = R.compileAsync; R.compileAsync = () => Promise.reject(Error('deliberate driver failure'));
  await assert.rejects(W.lampVariants(T, R, sc, camera, opt), /deliberate driver failure/);
  R.compileAsync = compile;
  ready.dispose(); dawn.dispose();
  console.log('GATE DUSKISOLATED: PASS (real three: day/night/depth keys, live pointers, deferred dispatch, failure)');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
