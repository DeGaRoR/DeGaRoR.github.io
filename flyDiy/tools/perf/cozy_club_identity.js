#!/usr/bin/env node
// cozy_club_identity.js - G2315 WORKS-COZY: THE SANDBOX'S CLUB IS BUILT CALL FOR CALL AS BEFORE. hangar.js of a base tree
// and of this tree each build the club (its own dims, every kit, interior and exterior) under GATE HANGAR's stubbed THREE,
// instrumented: every geometry's constructor and its arguments, every object's place / turn / scale, every light's
// colour, intensity, distance, angle and shadow, in the order built - and the two logs compared, entry for entry. A third
// build (this tree, layout 'cozy' named in the club) must equal them too: the layout applies to its own shell alone.
// Usage: node tools/perf/cozy_club_identity.js --base <hangar.js of the base tree> [--out <json>]     (node only, seconds)
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const CORE = require('../flight_core.js');
const gate = fs.readFileSync(path.join(ROOT, 'tools', '_hangar_check.js'), 'utf8');
const mkSrc = gate.slice(gate.indexOf('function mkTHREE('), gate.indexOf('function runB('));
const mkTHREE = new Function(mkSrc + '\nreturn mkTHREE;')();
const srcG = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'site_ground.js'), 'utf8');
function build(srcH, opts) {
  const T = mkTHREE([]), log = [];
  // the instrument: every constructor of THREE that makes a thing records its arguments
  const I = {};
  for (const k of Object.keys(T)) {
    const C = T[k];
    if (typeof C !== 'function' || !/^[A-Z]/.test(k) || !C.prototype) { I[k] = C; continue; }
    I[k] = class extends C { constructor(...a) { super(...a); log.push(['new', k, JSON.stringify(a, (kk, v) => typeof v === 'number' ? +v.toFixed(9) : (v && v.constructor && v.constructor.name === 'Float32Array' ? 'f32[' + v.length + ']' : v)).slice(0, 400)]); } };
  }
  const doc = { createElement: tag => tag === 'canvas' ? { width: 0, height: 0, getContext: () => T._canvas2d(), toDataURL: () => 'data:,' } : {} };
  const api = new Function('THREE', 'document', 'window', 'console', 'hangarLayout', '"use strict";\n' + srcG + '\n' + srcH + '\nreturn { genHangarBuild };')(
    I, doc, {}, { log() {}, warn() {}, info() {}, error() {} }, CORE.hangarLayout);
  const room = api.genHangarBuild(I, CORE.SHELLS.club.dims, opts);
  const f = v => +(+v).toFixed(9);
  const walk = (o, d) => {
    const e = ['obj', d, o.constructor && o.constructor.name, o.name || '', [o.position.x, o.position.y, o.position.z].map(f), [o.rotation.x, o.rotation.y, o.rotation.z].map(f), [o.scale.x, o.scale.y, o.scale.z].map(f), !!o.visible, !!o.castShadow];
    if (o.intensity !== undefined) e.push(['light', f(o.intensity), o.color ? [o.color.r, o.color.g, o.color.b].map(f) : null, o.distance, o.angle, o.penumbra, o.decay, o.target ? [o.target.position.x, o.target.position.z].map(f) : null]);
    log.push(e);
    for (const c of o.children || []) walk(c, d + 1);
  };
  walk(room.group, 0);
  return { log, lamp: room.lampRig ? room.lampRig() : null, dims: room.dims };
}
const base = fs.readFileSync(path.resolve(opt('base', '')), 'utf8');
const here = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'), 'utf8');
const out = {};
for (const [tag, opts] of [['interior', { shell: 'club' }], ['exterior', { shell: 'club', exterior: true }]]) {
  const A = build(base, opts), B = build(here, opts), C = build(here, Object.assign({ layout: 'cozy' }, opts));
  const diff = (X, Y) => { let n = 0, first = null; const m = Math.max(X.log.length, Y.log.length);
    for (let i = 0; i < m; i++) if (JSON.stringify(X.log[i]) !== JSON.stringify(Y.log[i])) { n++; if (!first) first = { i, base: X.log[i], here: Y.log[i] }; }
    return { entries: [X.log.length, Y.log.length], differ: n, first }; };
  out[tag] = { base_vs_here: diff(A, B), base_vs_here_cozyNamed: diff(A, C), lamp: [A.lamp, B.lamp, C.lamp] };
  console.log(tag + ': ' + A.log.length + ' entries; base vs this tree ' + out[tag].base_vs_here.differ + ' differ; vs this tree with layout cozy named ' + out[tag].base_vs_here_cozyNamed.differ + ' differ');
}
const pass = Object.values(out).every(o => !o.base_vs_here.differ && !o.base_vs_here_cozyNamed.differ);
console.log('CLUB IDENTITY: ' + (pass ? 'PASS' : 'FAIL'));
if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify(out, null, 1));
process.exit(pass ? 0 : 1);
