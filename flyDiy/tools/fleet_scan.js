#!/usr/bin/env node
// FLEET SCAN (PETREL-LS, 10 Nov 2026; a tool since 12 Nov): every build in the tree through the game's load path
// (LB.loadBuild -> buildGen -> genShakedown), one line each - mass, static margin, CG and neutral point, the tail's
// fitted taper and the post gap. Run it on the base tree and on the changed one, then diff: the fleet impact of a physics
// or join change, before it lands (FIT_AND_VALIDATE.md section 8; 43 builds, ~2 min a tree).
//
//   node tools/fleet_scan.js --json=<out.json> [--only=<substring>]   scan this tree (VALIDATED, builds/, builds/candidates/)
//   node tools/fleet_scan.js --diff=<base.json>,<new.json> [--sm=0.5]   the builds whose margin moved more than --sm points,
//                                                                       or whose mass moved more than 0.5 kg, or that fail
// A base tree: a clean worktree at the base commit (`git worktree add <dir> <commit>`), built (node tools/build.js), and
// this file copied in if it is not there yet.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const args = process.argv.slice(2), opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const f2 = (v, d = 2) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '-');
if (opt('diff')) {
  const [a, b] = opt('diff').split(',').map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const tol = +opt('sm', 0.5), rows = [];
  for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
    const x = a[k] || {}, y = b[k] || {};
    const why = x.err !== y.err ? 'error: ' + (y.err || 'fixed (was ' + x.err + ')') : !a[k] ? 'new' : !b[k] ? 'gone'
      : Math.abs((y.sm || 0) - (x.sm || 0)) > tol ? 'margin' : Math.abs((y.mass || 0) - (x.mass || 0)) > 0.5 ? 'mass' : null;
    if (why) rows.push([k, why, x, y]);
  }
  rows.sort((p, q) => Math.abs((q[3].sm || 0) - (q[2].sm || 0)) - Math.abs((p[3].sm || 0) - (p[2].sm || 0)));
  for (const [k, why, x, y] of rows) console.log(k.padEnd(56) + ' ' + why.padEnd(8) + ' SM ' + f2(x.sm, 1).padStart(6) + ' -> ' + f2(y.sm, 1).padStart(6) +
    '  mass ' + f2(x.mass, 1) + ' -> ' + f2(y.mass, 1) + (y.err ? '  ' + y.err : ''));
  console.log(rows.length + ' of ' + Object.keys(b).length + ' builds moved (margin over ' + tol + ' pt, mass over 0.5 kg, or an error)');
  process.exit(0);
}
const C = require(path.join(T, 'flight_core.js')), LB = require(path.join(T, '_load_build.js'));
const ls = d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.json')).map(f => d + '/' + f) : [];
let files = [...new Set([...Object.values(LB.VALIDATED || {}).map(v => v.build).filter(Boolean), ...ls('builds'), ...ls('builds/candidates')])];
if (opt('only')) files = files.filter(f => f.includes(opt('only')));
const out = {}, t0 = Date.now();
for (const f of files) {
  try {
    const S = LB.loadBuild(f).spec, def = C.buildGen(S), sh = C.genShakedown(def, { slim: true }), t = S.tail || {};
    out[f] = { mass: def.nodes.reduce((a, n) => a + n.m, 0), sm: sh.staticMargin * 100, cgX: sh.cgX, npX: sh.npX,
               vTaper: t.vTaper, hTaper: t.hTaper, postGap: S.fuselage && S.fuselage.postGap };
    const o = out[f];
    console.log(f.padEnd(56) + ' ' + f2(o.mass, 1).padStart(7) + ' kg  SM ' + f2(o.sm, 1).padStart(6) + '  cg ' + f2(o.cgX, 3) + ' np ' + f2(o.npX, 3) +
                '  vTaper ' + f2(o.vTaper) + ' hTaper ' + f2(o.hTaper) + ' postGap ' + f2(o.postGap));
  } catch (e) { out[f] = { err: String(e.message).slice(0, 120) }; console.log(f.padEnd(56) + ' ERR ' + out[f].err); }
}
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
console.log(files.length + ' builds in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
