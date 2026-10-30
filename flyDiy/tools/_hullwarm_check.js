'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(process.env.HULL_SOURCE || path.join(__dirname, '../src/viewer/app.js'), 'utf8');
const start = src.indexOf('  function craftHullWarm() {'), end = src.indexOf('  function compileCraftLinks() {', start);
assert(start > 0 && end > start, 'loader helper present');
assert(src.includes('.then(() => craftHullWarm()).then(release,'), 'helper awaited before loading hold is released');
async function check(fail) {
  const nested = { visible: true }, hidden = { visible: false }, lamp = { visible: true, isLight: true };
  const material = { visible: true }, mesh = { isMesh: true, geometry: {}, material };
  let dressed = false, calls = 0, warned = 0;
  const disc = { isMesh: true, geometry: {}, material, visible: false, userData: { propDisc: true } };
  const craft = { visible: true, traverseVisible(fn) { assert(dressed); fn(mesh); }, traverse(fn) { fn(mesh); fn(disc); } };
  const sun = { isLight: true, castShadow: true, shadow: {} };
  const scene = { children: [craft, nested, hidden, lamp, sun], traverseVisible(fn) { assert(dressed); fn(sun); fn(lamp); } }, target = {}, snapshots = [];
  class Group { constructor() { this.children = []; } add(o) { this.children.push(o); } }
  function snapshot() {
    assert(dressed); assert.strictEqual(nested.visible, false); assert.strictEqual(hidden.visible, false);
    assert.strictEqual(lamp.visible, true); assert.strictEqual(craft.visible, true);
    snapshots.push(1);
  }
  const c = { WF: { premises: { lamps: { fixedCount: true } } }, window: { WATER: {} },
    WATER: { proto: { hull: true } }, renderer: { compileAsync() {} }, craft, scene,
    THREE: { Group }, PLAIN_RT: () => target, keptGroup: () => ({ KEPT: [] }),
    craftInWorldNow(fn) { assert(!dressed); dressed = true; try { return fn(); } finally { dressed = false; } },
    PROG_WARM: { standIn: (o, m) => ({ ...o, material: m }),
      depthVariants(T, R, groups, opt) { snapshot(); assert.strictEqual(opt.kinds.depth, true); assert.strictEqual(opt.kinds.distance, false); assert.strictEqual(groups[0].children.length, 2, 'hidden prop disc included'); return { helper: { children: [mesh] } }; },
      fogless(sc, fn) { assert.strictEqual(sc, scene); return fn(); } },
    compileSliced(group, rt, sc, fogless, dress) {
      assert.strictEqual(rt, target); assert.strictEqual(sc, scene);
      dress(() => { snapshot(); if (fail && ++calls === 1) throw Error('deliberate task failure'); });
      assert(!dressed); assert(nested.visible); return Promise.resolve();
    },
    warmDrawSliced(sc, rt, label, list, dress) {
      assert.strictEqual(rt, target); assert(list.length); dress(snapshot);
      assert(!dressed); assert(nested.visible); return Promise.resolve();
    }, console: { warn() { warned++; } } };
  vm.createContext(c); vm.runInContext(src.slice(start, end), c);
  try { await c.craftHullWarm(); } catch (e) { if (!fail) throw e; }
  assert(!dressed); assert(nested.visible); assert(!hidden.visible); assert(lamp.visible);
  if (!fail) assert.strictEqual(snapshots.length, 5, 'depth setup, two compile jobs and two draws');
  c.WF.premises.lamps.fixedCount = false; snapshots.length = 0; await c.craftHullWarm();
  assert.strictEqual(snapshots.length, 0, 'no extra warm without fixed light signature');
}
(async () => { await check(false); await check(true); console.log('GATE HULLWARM: PASS'); })().catch(e => { console.error(e); process.exitCode = 1; });
