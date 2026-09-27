// ARCH-2026-09-27 probe (node only, not a gate): the physics_perf.js setup (Jolene + premises, stock or a saved build, the pilot's departFrom), as a function
'use strict';
const path = require('path'), fs = require('fs');
const T = require('path').join(__dirname, '..', '..', 'tools');
module.exports = function setup(opts) {
  opts = opts || {};
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  const C = CORE;
  let world;
  if (opts.world === 'none') world = C.makeWorld();
  else {
    const IN = require(path.join(T, 'island_node.js'));
    const boot = IN.islandBoot('jolene');
    world = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
  }
  const spec = opts.build ? (j => j.spec || j)(JSON.parse(fs.readFileSync(opts.build, 'utf8')))
    : JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'build_v9_stock_2026-09-15.json'), 'utf8')).spec;
  const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
  const sim = C.makeSim(def, world); sim.reset(0);
  const home = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  const ap = C.makePilot(sim, def, world, { style: 'normal' });
  const site = typeof C.siteOf === 'function' ? C.siteOf(home.id) : null;
  if (typeof sim.stance === 'function') sim.stance();
  if (site && site.stand) { C.placeAtStand(sim, home, site.stand); ap.setRoute(home, home); ap.departFrom(home, home, site); }
  else { C.placeAtAerodrome(sim, home); ap.setRoute(home, home); }
  return { C, world, def, sim, ap, n: sim.p.length / 3, substeps: def.params.substeps };
};
