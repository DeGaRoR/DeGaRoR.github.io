#!/usr/bin/env node
// SEA-PETREL task 4: what the Super Petrel costs against the Cub and the twin floatplane, the same machine, counts and
// ratios only. node cost.js [--root /workspace/base] [--keys cub,twinFloats,petrel] [--frames 600] [--scene 1]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.resolve(opt('root', '/workspace/base'));
const T = path.join(ROOT, 'flyDiy', 'tools');
const KEYS = opt('keys', 'cub,twinFloats,petrel').split(',');
const FR = +opt('frames', 600), SCENE = opt('scene', '1') === '1';
const LB = require(path.join(T, '_load_build.js'));
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const TW = TR.tourWorld(C, IN, fs), W = TW.W;
const A = id => W.aerodromes.find(q => q.id === id);
const res = {};
for (const key of KEYS) {
  const spec = LB.loadValidated(key).spec;
  const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
  def.params = Object.assign({}, def.params, { damage: true });
  const r = res[key] = { nodes: def.nodes.length, members: (def.beams || []).length, substeps: def.params.substeps,
    massKg: +def.nodes.reduce((m, q) => m + q.m, 0).toFixed(1), engNodes: (def.refs.engine || []).length };
  const fl = (def.parts && def.parts.floats) || [];
  r.floats = fl.length; r.floatKinds = fl.map(f => f.hull ? 'hull' : f.tip ? 'tip' : f.spon ? 'spon' : 'float').join(',');
  // the solver: idle on its start, the game's placement (HOME for a land build, SEA for a water one), then a straight
  // tow on the water / ground at full power is not the AP - so: rest frames, and a cruise frames block in the air
  const water = r.floats > 0;
  const H = TR.gameHost(C, W, def, A(water ? 'SEA' : 'HOME'), A(water ? 'mk_sea' : 'w3'), { day: null, damage: true });
  const sim = H.sim;
  const HY = sim.out && sim.out.hydro;
  if (HY) { r.hydroEvery = HY.every; r.hydroHz = +(60 * def.params.substeps / HY.every).toFixed(0); r.hydroPanels = HY.floats.map(f => f.F.panels.length); r.hydroPanelsSum = r.hydroPanels.reduce((a, b) => a + b, 0); }
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  let t0 = process.hrtime.bigint();
  for (let i = 0; i < FR; i++) sim.step(1 / 60);
  r.restUsPerFrame = +(Number(process.hrtime.bigint() - t0) / 1000 / FR).toFixed(0);
  r.restWet = HY ? HY.wet : 0;
  // the air: a fresh sim placed 300 m over the sea, at 1.3 x its stall, level, the throttle at 0.6 (no AP: the solver alone)
  const s2 = C.makeSim(def, W); s2.reset(0);
  const cg = s2.cgPos(), V = (def.params.vStall || 25) * 1.3;
  for (let i = 0; i < s2.n; i++) { s2.p[i * 3] += 2000 - cg[0]; s2.p[i * 3 + 1] += 300 - cg[1]; s2.p[i * 3 + 2] += -6000 - cg[2]; s2.v[i * 3] = -V; s2.v[i * 3 + 1] = 0; s2.v[i * 3 + 2] = 0; }
  if (s2.ctl) s2.ctl.thr = 0.6;
  for (let i = 0; i < 30; i++) s2.step(1 / 60);
  t0 = process.hrtime.bigint();
  for (let i = 0; i < FR; i++) s2.step(1 / 60);
  r.airUsPerFrame = +(Number(process.hrtime.bigint() - t0) / 1000 / FR).toFixed(0);
  const cg2 = s2.cgPos(); r.airSane = isFinite(cg2[1]);
  if (SCENE) {
    const SH = require(path.join(T, '_scene_headless.js'));
    const S = SH.sceneBuild(spec, { garage: spec });
    let meshes = 0, inst = 0, tris = 0, groups = 0; const mats = new Set(), geos = new Set(); const byTop = {};
    S.scene.traverse(o => {
      if (!o.isMesh || o.visible === false) return;
      let vis = true; for (let q = o; q; q = q.parent) if (q.visible === false) vis = false;
      if (!vis) return;
      meshes++; if (o.isInstancedMesh) inst++;
      const g = o.geometry, n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
      const tri = n / 3 * (o.isInstancedMesh ? o.count : 1); tris += tri; geos.add(g.uuid);
      const M = Array.isArray(o.material) ? o.material : [o.material];
      M.forEach(m => m && mats.add(m.uuid));
      const dc = Array.isArray(o.material) && g.groups && g.groups.length ? g.groups.length : 1; groups += dc;
      let top = o; while (top.parent && top.parent !== S.scene) top = top.parent;
      const k = top.name || top.type; const b = byTop[k] || (byTop[k] = { meshes: 0, tris: 0 }); b.meshes++; b.tris += tri;
    });
    r.scene = { meshes, instanced: inst, drawCallsUpper: groups, triangles: Math.round(tris), materials: mats.size, geometries: geos.size, errors: (S.errors || []).length, byLayer: byTop };
  }
  console.log(key + ' ' + JSON.stringify(r));
}
fs.writeFileSync(opt('out', '/tmp/claude-0/sp/cost.json'), JSON.stringify(res, null, 1));
