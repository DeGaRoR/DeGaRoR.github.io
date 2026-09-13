#!/usr/bin/env node
// _cabin_check.js — GATE CABIN (G343): the baked tram cabin against its
// table, and cabin.js's plan run on the real bin - every part has a role,
// the glass part is there, the windows close into loops and the gasket is
// swept round each at a finer step than the mesh, the livery decals lie in
// the banner's rectangle on both flanks proud of the skin, the uvs are
// metric, the liveries are published and on disk, and the plan is
// deterministic.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const ROOT = path.join(TOOLS, '..');

const fail = [];
let checks = 0;
function check(ok, what, detail) { checks++; if (!ok) fail.push(what + (detail ? ' — ' + detail : '')); return ok; }

// ---- the pack, through the codec the viewer uses
const ctx = { console, Math, JSON, Float32Array, Int8Array, Int16Array, Uint8Array, Uint16Array, Uint32Array, DataView, ArrayBuffer, Object, Array, Set, Map, Number, String, isFinite, atob: s => Buffer.from(s, 'base64').toString('binary') };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
// (the codec's top-level consts are not properties of the context: hand them over)
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'core', '51_prop_codec.js'), 'utf8') + '\nthis.PROP_REG = PROP_REG; this.decodeProp = decodeProp; this.registerPropPack = registerPropPack;', ctx, { filename: '51_prop_codec.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'cabin.js'), 'utf8'), ctx, { filename: 'cabin.js' });
const packsMf = path.join(ROOT, 'src', 'cabin', 'cabin_packs.json');
check(fs.existsSync(packsMf), 'no cabin pack manifest (run python tools/cabin_prep.py)');
const packs = fs.existsSync(packsMf) ? JSON.parse(fs.readFileSync(packsMf, 'utf8')) : [];
for (const f of packs) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'cabin', f), 'utf8'), ctx, { filename: f });
const REG = ctx.PROP_REG, CABIN = ctx.CABIN;
const prop = REG && REG.props && REG.props.tram_cabin;
if (check(!!prop, 'the pack does not carry tram_cabin')) {
  const bin = fs.readFileSync(path.join(ROOT, prop.bin));
  const dec = ctx.decodeProp(prop, bin);
  const names = dec.parts.map(p => p.mat);
  // 1 — every material the file ships is a part with a role, the glass among them
  for (const m of Object.keys(CABIN.ROLE)) check(names.indexOf(m) >= 0, 'the baked cabin has no part ' + m);
  for (const n of names) check(!!CABIN.ROLE[n], 'part ' + n + ' has no role in cabin.js');
  check(prop.bb && prop.bb[4] > 8 && prop.bb[4] < 9.5, 'the cabin is not the height the table declares', JSON.stringify(prop.bb));
  check(prop.bb[1] >= -0.01 && prop.bb[1] < 0.05, 'the cabin does not stand on its floor origin', String(prop.bb[1]));
  check(prop.bb[3] - prop.bb[0] > 3.2 && prop.bb[3] - prop.bb[0] < 3.7, 'the cabin is not 3.4 m across', String(prop.bb[3] - prop.bb[0]));
  // 2 — the plan
  const P = CABIN.plan(dec.parts);
  check(P.roles.length === names.length - 1, 'the plan dressed ' + P.roles.length + ' parts of ' + (names.length - 1));
  check(!!P.glass && P.glass.idx.length >= 3, 'no glass in the plan');
  // metric uvs: a body vertex's uv is one of its coordinates
  const body = P.roles.find(r => r.role === 'body'), bodyPart = dec.parts.find(p => p.mat === 'Yellow');
  let bad = 0;
  for (let i = 0; i < bodyPart.pos.length / 3; i++) {
    const u = body.uv[i * 2], v = body.uv[i * 2 + 1], c = [bodyPart.pos[i * 3], bodyPart.pos[i * 3 + 1], bodyPart.pos[i * 3 + 2]];
    if (!c.some(x => Math.abs(x - u) < 1e-6) || !c.some(x => Math.abs(x - v) < 1e-6)) bad++;
  }
  check(bad === 0, 'the body uvs are not metric', bad + ' vertices');
  // 3 — the gasket: loops found, each swept at a finer step than the mesh's own edges
  const glassPart = dec.parts.find(p => p.mat === 'Windows');
  const loops = CABIN.boundaryLoops(glassPart.pos, glassPart.idx);
  check(loops.length >= 4, 'the windows do not close into loops', loops.length + ' loops');
  check(P.gaskets.loops === loops.length, 'the gasket does not follow every loop');
  check(P.gaskets.idx.length > 0, 'no gasket swept');
  for (const lp of loops) {
    const sm = CABIN.resample(CABIN.chaikin(lp, 3), 0.05);
    check(sm.length > lp.length * 2, 'the gasket is not finer than the window edge', sm.length + ' vs ' + lp.length);
    // the smoothed loop stays within a bead of the drawn contour
    let far = 0;
    for (const q of sm) {
      let d = 1e9;
      for (let i = 0; i < lp.length; i++) {
        const a = lp[i], b = lp[(i + 1) % lp.length], e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * e[0] + (q[1] - a[1]) * e[1] + (q[2] - a[2]) * e[2]) / Math.max(1e-9, e[0] * e[0] + e[1] * e[1] + e[2] * e[2])));
        d = Math.min(d, Math.hypot(q[0] - a[0] - e[0] * t, q[1] - a[1] - e[1] * t, q[2] - a[2] - e[2] * t));
      }
      if (d > 0.08) far++;
    }
    check(far === 0, 'the gasket wanders off the window contour', far + ' points');
  }
  // 4 — the livery: decals on both flanks, inside the banner, proud of the skin, uv in 0..1
  const D = P.decals, R = P.banner;
  check(D.idx.length >= 6, 'no livery decal');
  let left = 0, right = 0, out = 0, uvOut = 0;
  for (let i = 0; i < D.pos.length / 3; i++) {
    const x = D.pos[i * 3], y = D.pos[i * 3 + 1], z = D.pos[i * 3 + 2];
    if (x > 0) right++; else left++;
    if (z < R.z0 - 1e-4 || z > R.z1 + 1e-4 || y < R.y0 - 1e-4 || y > R.y1 + 1e-4) out++;
    if (x > 0 ? x < R.xR - R.flank : x > R.xL + R.flank) out++;
    const u = D.uv[i * 2], v = D.uv[i * 2 + 1];
    if (u < -1e-4 || u > 1 + 1e-4 || v < -1e-4 || v > 1 + 1e-4) uvOut++;
  }
  check(left > 0 && right > 0, 'the livery is not on both flanks', left + '/' + right);
  check(out === 0, 'decal vertices outside the banner', String(out));
  check(uvOut === 0, 'decal uvs outside 0..1', String(uvOut));
  // the words read from either side: u grows against z on +x (right = forward x up), with z on -x
  let wrong = 0;
  for (let t = 0; t < D.idx.length; t += 3) {
    const a = D.idx[t], b = D.idx[t + 1];
    const sx = D.pos[a * 3] > 0 ? 1 : -1, dz = D.pos[b * 3 + 2] - D.pos[a * 3 + 2], du = D.uv[b * 2] - D.uv[a * 2];
    if (Math.abs(dz) > 1e-3 && Math.sign(du) !== -Math.sign(dz) * sx) wrong++;
  }
  check(wrong === 0, 'the livery is mirrored the wrong way', String(wrong));
  // 5 — deterministic
  const Q = CABIN.plan(dec.parts);
  check(Q.gaskets.idx.length === P.gaskets.idx.length && Q.decals.idx.length === P.decals.idx.length, 'the plan is not deterministic');
}
// 6 — the liveries published and on disk
const lmf = path.join(ROOT, 'src', 'viewer', 'cabin_livery.js');
if (check(fs.existsSync(lmf), 'no livery manifest')) {
  const src = fs.readFileSync(lmf, 'utf8');
  for (const k of ['admiralty', 'chatham']) {
    const m = new RegExp(k + ": \\{ img: mk\\('([^']+)'\\), w: (\\d+), h: (\\d+), aspect: ([\\d.]+)").exec(src);
    if (check(!!m, 'livery ' + k + ' not in the manifest')) {
      check(fs.existsSync(path.join(ROOT, m[1])), 'livery ' + k + ' is not on disk', m[1]);
      check(+m[4] > 2.5 && +m[4] < 3.5, 'livery ' + k + ' is not a banner', m[4]);
    }
  }
}

console.log(checks + ' checks');
if (fail.length) { for (const f of fail) console.log('  ! ' + f); console.log('GATE CABIN: FAIL (' + fail.length + ')'); process.exit(1); }
console.log('GATE CABIN: PASS');
