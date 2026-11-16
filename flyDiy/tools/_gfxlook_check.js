#!/usr/bin/env node
// GATE GFXLOOK (GROUND-FX, 2026-11-16) - THE DUST AND THE MUD ARE EDITABLE IN THE WORLD EDITOR.
//
// THE USER, 16 Nov (via A0): "every new world setting must be editable in the WORLD EDITOR (world_rail.js, F9) so the user can
// hand-tune after credits run out ... Dust and mud particles count ... saved in THE LOOK (flydiy.worldlook.v1) + EXPORT, reset
// to defaults". src/viewer/groundfx_look.js is the knobs' table over dust.js (LOOK / L / CLS), aeroweather.js (AERO_MUD) and
// ground_deposit.js (K / PBR / DEF / SP); world_rail.js draws it (the "ground fx" section) and keeps it with the look.
//
//   node tools/_gfxlook_check.js            -> "GATE GFXLOOK: PASS|FAIL"
//   node tools/_gfxlook_check.js --show     -> the groups and their rows
//   node tools/_gfxlook_check.js --selftest -> negative verification
//
// A. THE TABLE: every row names a value the modules hold (none silently dropped; DIRT-STRIP's splashRate shown once dust.js
//    carries it); every kind drawable (a number with its slider's range, a switch, an [r, g, b] colour); every surface class
//    has its card, the wet ones (mud, slush) their throw.
// B. THE LOOK: nothing changed = an empty delta; three edits (a slider, a switch, a colour) = exactly those three in the
//    delta; the delta through JSON (the browser's saved look) puts them back on a fresh page; "full" (an import) sends the
//    rest home; reset = the shipped values; a colour is set IN PLACE (the draw holds the array) and comes back from its hex
//    within a step.
// C. LIVE: dust.js's draw reads the density, the backlit cap and the classes' colours every frame, the drawn sizes per kind;
//    the coat's law reads AERO_MUD each step (a knob moves the next step).
// D. THE WIRING: build.js loads ground_deposit.js and groundfx_look.js after dust.js; the rail's section, the look (now, delta,
//    apply), the export (where, changes) and the reset carry it.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), V = p => path.join(ROOT, 'src', 'viewer', p);
if (typeof document === 'undefined') global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, drawImage() {} }) }) };
const SHOW = process.argv.includes('--show'), SELF = process.argv.includes('--selftest');
const fresh = f => { delete require.cache[require.resolve(V(f))]; return require(V(f)); };
const load = () => { const X = fresh('groundfx_look.js'), H = { dust: fresh('dust.js'), wx: fresh('aeroweather.js'), gd: fresh('ground_deposit.js') }; X.bind(H); return { X, H }; };
const SRC = { rail: fs.readFileSync(V('world_rail.js'), 'utf8'), dust: fs.readFileSync(V('dust.js'), 'utf8'), build: fs.readFileSync(path.join(ROOT, 'tools', 'build.js'), 'utf8'),
  table: fs.readFileSync(V('groundfx_look.js'), 'utf8') };

function run(env, src) {
  const fail = [], ok = (c, m) => { if (!c) fail.push(m); else if (SHOW) console.log('  ok   ' + m); };
  const { X, H } = env();
  // ---- A. THE TABLE
  const declared = (src.table.match(/\['(dust|wx|gd):[A-Za-z0-9_.]+'/g) || []).map(s => s.slice(2, -1)).filter(id => !/\.$/.test(id));   // (the class cards' ids are built per class)
  const G = X.groups(), rows = []; for (const g of G) for (const r of g.rows) rows.push(r);
  const have = new Set(rows.map(r => r[0]));
  const lost = declared.filter(id => !have.has(id) && !(id === 'dust:LOOK.splashRate' && !('splashRate' in H.dust.LOOK)));
  ok(!lost.length, 'A every row names a value the modules hold (' + rows.length + ' rows' + (lost.length ? '; LOST ' + lost.join(', ') : '') + ')');
  const badKind = rows.filter(r => { const k = X.kindOf(r[0]), v = X.get(r[0]);
    return k === 'range' ? !(typeof v === 'number' && isFinite(v) && r.length >= 5 && r[2] < r[3] && r[4] > 0) : k === 'colour' ? !(v.length === 3 && v.every(q => q >= 0 && q <= 1)) : k !== 'switch'; });
  ok(!badKind.length, 'A every row drawable: a number with its range, a switch, a colour' + (badKind.length ? ' (BAD ' + badKind.map(r => r[0]).join(', ') + ')' : ''));
  const clsCards = G.filter(g => g.cls).map(g => g.cls);
  ok(H.dust.CLASSES.every(c => clsCards.includes(c)) && ['mud', 'slush'].every(c => G.find(g => g.cls === c).rows.some(r => /proj\.tread$/.test(r[0]))),
    'A every surface class has its card (' + clsCards.join(', ') + '); mud and slush their throw');
  ok(['clouds', 'sources', 'sizes', 'coat', 'deposit'].every(k => G.find(g => g.k === k)), 'A the groups: the clouds, the sources, the sizes, the coat, the computed deposit');
  if (SHOW) for (const g of G) console.log('    ' + g.title.padEnd(36) + g.rows.map(r => r[1]).join(' | '));
  // ---- B. THE LOOK
  const shipped = JSON.stringify(X.now());
  ok(!Object.keys(X.delta()).length, 'B nothing changed: an empty delta');
  const col0 = H.dust.CLS.mud.col;
  X.set('dust:LOOK.dens', 0.8); X.set('dust:LOOK.v2', false); X.set('dust:CLS.mud.col', X.linOf('#5a4030'));
  const d = X.delta();
  ok(Object.keys(d).sort().join() === ['dust:CLS.mud.col', 'dust:LOOK.dens', 'dust:LOOK.v2'].sort().join(), 'B three edits = those three in the delta (' + Object.keys(d).join(', ') + ')');
  ok(H.dust.CLS.mud.col === col0 && X.hexOf(H.dust.CLS.mud.col) === '#5a4030', 'B a colour is set in place (the draw holds the array) and comes back from its hex');
  const saved = JSON.parse(JSON.stringify(d));
  const B2 = env(); B2.X.defaults(); B2.X.apply(saved, false);
  ok(B2.H.dust.LOOK.dens === 0.8 && B2.H.dust.LOOK.v2 === false && B2.X.hexOf(B2.H.dust.CLS.mud.col) === '#5a4030' && Object.keys(B2.X.delta()).length === 3,
    'B the saved look (through JSON) puts the three back on a fresh page');
  B2.X.set('wx:AERO_MUD.kAcc', 0.2); B2.X.apply({ 'dust:LOOK.dens': 0.7 }, true);
  ok(B2.H.dust.LOOK.dens === 0.7 && B2.H.dust.LOOK.v2 === true && B2.H.wx.AERO_MUD.kAcc === 0.08 && Object.keys(B2.X.delta()).length === 1, 'B an import ("full") sends the rest home');
  X.reset();
  ok(JSON.stringify(X.now()) === shipped && !Object.keys(X.delta()).length && H.dust.CLS.mud.col === col0, 'B reset = the shipped values');
  // ---- C. LIVE
  ok(/mat\.uniforms\.uDens\.value = LOOK\.dens; mat\.uniforms\.uFwdMax\.value = LOOK\.fwdMax;/.test(src.dust) && /if \(!LOOK\.ground \|\| !gotGround\[ci\]\) \{ const c = CLS\[CLASSES\[ci\]\]\.col; colV\[ci\]\.set/.test(src.dust),
    'C the draw reads the density, the backlit cap and the classes’ colours every frame');
  ok(/A\[w \* 4 \+ 1\] = G\.s\[q\] \* \(G\.kind\[q\] === 0 \|\| G\.kind\[q\] === 3 \? LOOK\.gritSize : LOOK\.clodSize\)/.test(src.dust) && /G\.s\[q\] = s;/.test(src.dust), 'C the drawn sizes per kind (the thrown size untouched)');
  const W = H.wx, st = { V: 15, mud: 1, sink: 0.05 }, m1 = W.aeroMudStep(0, 1, st); X.set('wx:AERO_MUD.kAcc', 0.16); const m2 = W.aeroMudStep(0, 1, st); X.reset();
  ok(m2 > 1.9 * m1 && m1 > 0, 'C the coat’s law reads its knob each step (' + m1.toFixed(3) + ' -> ' + m2.toFixed(3) + ' at twice the rate)');
  // ---- D. THE WIRING
  const bi = f => src.build.indexOf("'" + f + "'");
  ok(bi('dust.js') > 0 && bi('ground_deposit.js') > bi('dust.js') && bi('groundfx_look.js') > bi('ground_deposit.js'), 'D build.js loads ground_deposit.js and groundfx_look.js after dust.js');
  ok(/\{ k: 'groundfx', label: 'ground fx'[^\n]*build: buildGroundFx \}/.test(src.rail) && /function buildGroundFx\(body\)/.test(src.rail), 'D the rail’s "ground fx" section');
  ok(/if \(GFXL\(\)\) o\.groundfx = GFXL\(\)\.now\(\);/.test(src.rail) && /const d = GFXL\(\)\.delta\(\); if \(Object\.keys\(d\)\.length\) o\.groundfx = d;/.test(src.rail) &&
     /if \(GFXL\(\) && \(o\.groundfx \|\| full\)\) GFXL\(\)\.apply\(o\.groundfx \|\| \{\}, full\);/.test(src.rail), 'D the look: now, delta (the saved look), apply (boot and import)');
  ok(/groundfx: 'dust: src\/viewer\/dust\.js/.test(src.rail) && /path: 'groundfx\.' \+ k/.test(src.rail) && /GFXL\(\)\.reset\(\); saveLook\(\); open\('file', true\)/.test(src.rail) && /X\.reset\(\); saveLook\(\); open\('groundfx', true\)/.test(src.rail),
    'D the export (where, changes) and the resets');
  return fail;
}

if (SELF) {
  const bad = [];
  const doctor = (name, srcMod, envMod) => {
    const s = Object.assign({}, SRC, srcMod ? srcMod(SRC) : {});
    const env = () => { const e = load(); if (envMod) envMod(e); return e; };
    let f; try { f = run(env, s); } catch (e) { f = ['threw ' + e.message]; }
    if (!f.length) bad.push(name);
  };
  doctor('a row names nothing', s => ({ table: s.table.replace("'dust:L.linger'", "'dust:L.lingerX'") }), e => { delete e.H.dust.L.linger; });
  doctor('a colour replaced, not set in place', null, e => { const set0 = e.X.set; e.X.set = (id, v) => { if (Array.isArray(v)) { const p = id.split(':')[1].split('.'); e.H.dust.CLS[p[1]].col = v.slice(); return true; } return set0(id, v); }; });
  doctor('the density read once', s => ({ dust: s.dust.replace('mat.uniforms.uDens.value = LOOK.dens; ', '') }));
  doctor('the look forgets it', s => ({ rail: s.rail.replace('if (GFXL()) o.groundfx = GFXL().now();', '') }));
  doctor('not applied at boot', s => ({ rail: s.rail.replace('GFXL().apply(o.groundfx || {}, full);', '0;') }));
  doctor('not built', s => ({ build: s.build.replace("'groundfx_look.js',", '') }));
  doctor('the coat knob dead', null, e => { e.X.set = () => true; });
  console.log('GATE GFXLOOK selftest: ' + (bad.length ? 'FAIL (' + bad.join(', ') + ' stayed green)' : 'PASS (every doctored copy went red)'));
  process.exit(bad.length ? 1 : 0);
}
const t0 = Date.now(), fail = run(load, SRC);
for (const f of fail) console.log('  FAIL ' + f);
console.log('  (' + (Date.now() - t0) + ' ms)');
console.log('GATE GFXLOOK: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
