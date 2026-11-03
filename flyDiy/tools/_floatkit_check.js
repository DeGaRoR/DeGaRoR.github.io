#!/usr/bin/env node
// _floatkit_check.js - GATE FLOATKIT (G3445, FLOAT-KIT): fitting floats fits the certified seaplane propeller, and
// nothing else moves.
//
// The user, 22 Oct: "4 yes" (fitting floats automatically fits the certified seaplane propeller, other planes are
// left alone) and "have a popup or something when we choose floats, it says what else it changes". The kit lives in
// the editor's float layer (tools/_cage_float.js, floatKitStep / floatKitCard) and the propeller in the core
// (60_gen_spec.js: the 'seaplane' pitch class, GEN_SEAPLANE_PROPS per float model). This holds:
//   KIT     the float layer's own step, driven without a scene (GATE STARTER's shim): floats on with no certified
//           model -> the propeller unchanged; the Wipline 2350 -> the 82 x 43 McCauley (D 2.083 m, 2 blades, alu,
//           'seaplane' through GARAGE_SPEC.update) and the old one kept; a model with no row, or the floats off ->
//           the old propeller back EXACTLY; a builder's change after the fit is not fought; A LOAD NEVER REFITS
//           (a saved 2350 floatplane opened is left as it was saved).
//   CARD    the card names what else changes: the propeller (by name), the ventral fin, the water rudders, the weight
//           and the float's rated gross; OK and undo; undo puts the floats off.
//   CLASS   'seaplane' is never 'auto''s pick (GEN_PROP_AUTO_ORDER); 'climb' is master's 0.530 (G3443 reverted).
//   FLOWN   the corrected 172 with the kit's rows, joined as the game loads it: it flies D 2.083, 'seaplane', and the
//           82 x 43's static thrust (FM 0.50: ~3,075 N on the 172's 118 kW); the same airframe with its land
//           propeller flies what it flew.
//
//   node tools/_floatkit_check.js            -> "GATE FLOATKIT: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, FLY = path.join(T, '..');

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); return c; };
const tick = () => new Promise(r => setTimeout(r, 5));

// ---- the panel, headless (GATE STARTER's shim) ----------------------------------------------------------------------
function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj {
    constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; }
    add() { return this; } remove() {} traverse() {}
  }
  global.THREE = new Proxy({}, { get: (t, k) => (k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {}) });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js'])
    require(path.join(T, f));
  return { W: global.window, CORE };
}

(async () => {
  const { W, CORE } = loadPanel();
  const PAGE = W.CAGE_PAGE, KIT = W.CAGE_FLOAT_KIT, CARD = W.CAGE_FLOAT_KIT_CARD;
  const NAMES = CORE.HYDRO.FLOAT_PRESET_NAMES.concat(['custom']);
  const idx = n => NAMES.indexOf(n);
  const SP = CORE.GEN_SEAPLANE_PROPS, ROW = SP['Wipline 2350'];

  console.log('CLASS');
  ok(CORE.GEN_PROP_PITCH.climb.fm === 0.530, "'climb' is master's fm 0.530 (G3443 reverted)");
  ok(CORE.GEN_PROP_PITCH.seaplane && CORE.GEN_PROP_PITCH.seaplane.fm === 0.630, "'seaplane' is its own class, fm 0.630 (FM 0.50)");
  {
    const src = fs.readFileSync(path.join(FLY, 'src', 'core', '60_gen_spec.js'), 'utf8');
    const m = src.match(/const GEN_PROP_AUTO_ORDER = \[([^\]]*)\]/);
    ok(m && !/seaplane/.test(m[1]), "'auto' never picks 'seaplane' (GEN_PROP_AUTO_ORDER: " + (m ? m[1] : 'not found') + ')');
  }
  ok(!!ROW && ROW.D > 2.0 && ROW.D < 2.1 && ROW.pitch === 'seaplane' && /McCauley/.test(ROW.name), "GEN_SEAPLANE_PROPS['Wipline 2350'] = " + (ROW && ROW.name));

  console.log('KIT');
  ok(typeof KIT === 'function' && typeof CARD === 'function', 'the float layer publishes its kit and its card (CAGE_FLOAT_KIT / _CARD)');
  let pitch = 'standard';
  W.GARAGE_SPEC = { get: () => ({ prop: { pitch } }), update: p => { if (p && p.prop && p.prop.pitch) pitch = p.prop.pitch; } };
  const P = Object.assign({}, PAGE.defaults, { cw_propD: 1.905, cw_bladeN: 2, cw_material: 2, gearFloats: 0, fltPreset: idx('custom') });
  PAGE.load();
  ok(KIT(P) === null, 'the first look records and fires nothing');
  P.gearFloats = 1;
  let e = KIT(P);
  ok(e && e.kind === 'floats' && P.cw_propD === 1.905 && +P.fltKit === 0, 'floats on, no catalogue model: the propeller unchanged (' + (e && e.kind) + ', D ' + P.cw_propD + ')');
  P.fltPreset = idx('Wipline 2100');
  e = KIT(P);
  ok(e && e.kind === 'floats' && P.cw_propD === 1.905, 'the 2100 (no certified propeller listed): unchanged');
  P.fltPreset = idx('Wipline 2350');
  e = KIT(P); await tick();
  ok(e && e.kind === 'fit' && P.cw_propD === ROW.D && P.cw_bladeN === 2 && P.cw_material === 2 && +P.fltKit === 1 && pitch === 'seaplane',
     'the 2350: the McCauley fitted (D ' + P.cw_propD + ', ' + P.cw_bladeN + ' blades, material ' + P.cw_material + ', pitch ' + pitch + ')');
  ok(+P.fltKitPrevD === 1.905 && +P.fltKitPrevN === 2 && +P.fltKitPrevMat === 2 && +P.fltKitPrevPitch === 2, 'the old propeller kept in the cage (1.905 m, 2, alu, standard)');
  P.cw_propD = 2.0;
  ok(KIT(P) === null && P.cw_propD === 2.0, "a builder's change after the fit is not fought");
  P.cw_propD = ROW.D;
  P.fltPreset = idx('Wipline 3000');
  e = KIT(P); await tick();
  ok(e && e.kind === 'restore' && P.cw_propD === 1.905 && P.cw_bladeN === 2 && P.cw_material === 2 && +P.fltKit === 0 && pitch === 'standard',
     'a model with no row: the old propeller back exactly (D ' + P.cw_propD + ', pitch ' + pitch + ')');
  P.fltPreset = idx('Wipline 2350'); KIT(P); await tick();
  P.gearFloats = 0;
  e = KIT(P); await tick();
  ok(e && e.kind === 'restore' && P.cw_propD === 1.905 && pitch === 'standard' && +P.fltKit === 0, 'the floats off: the old propeller back (D ' + P.cw_propD + ', pitch ' + pitch + ')');
  {
    const Q = Object.assign({}, PAGE.defaults, { cw_propD: 2.06, cw_bladeN: 2, cw_material: 2, gearFloats: 1, fltPreset: idx('Wipline 2350'), fltKit: 0 });
    PAGE.load();
    ok(KIT(Q) === null && Q.cw_propD === 2.06 && +Q.fltKit === 0, 'A LOAD NEVER REFITS: a saved 2350 floatplane opened keeps its propeller');
  }

  console.log('CARD');
  {
    const els = {};
    const mk = id => ({ id, hidden: true, innerHTML: '', onclick: null });
    global.document = { createElement: () => mk(''), body: { appendChild: el => { els[el.id] = el; } },
      getElementById: id => els[id] || (id === 'fkOk' || id === 'fkUndo' ? (els[id] = mk(id)) : null) };
    const R = Object.assign({}, PAGE.defaults, { cw_propD: 1.905, cw_bladeN: 2, cw_material: 2, gearFloats: 1, fltPreset: idx('Wipline 2350'),
      finOn: 1, finVentralOn: 1, fltRudder: 1 });
    CARD({ kind: 'fit', model: 'Wipline 2350', row: ROW, prev: { D: 1.905, N: 2, pitch: 'standard' } }, R);
    const h = (els.fkCard && els.fkCard.innerHTML) || '';
    ok(/McCauley 1A200\/WFA8243/.test(h) && /1\.91 m/.test(h), 'the card names the propeller and the one it replaces');
    ok(/Ventral fin/.test(h) && /Water rudders/.test(h) && /Weight/.test(h) && /138 kg/.test(h) && /1,157 kg/.test(h), 'the ventral fin, the water rudders, the weight (+138 kg) and the gross (1,157 kg)');
    ok(/id="fkOk"/.test(h) && /id="fkUndo"/.test(h) && els.fkCard.hidden === false, 'OK and undo, shown');
    let built = 0; W.CAGE_UI = { syncSliders: () => {}, build: () => { built++; } };
    if (els.fkUndo && els.fkUndo.onclick) els.fkUndo.onclick();
    ok(R.gearFloats === 0 && built === 1 && els.fkCard.hidden === true, 'undo puts the floats off and rebuilds');
    delete global.document;
  }

  console.log('FLOWN');
  {
    const LB = require(path.join(T, '_load_build.js'));
    const raw = JSON.parse(fs.readFileSync(path.join(FLY, 'builds', 'cessna172_2026-09-20_corrected.json'), 'utf8'));
    const land = LB.gameSpec(JSON.parse(JSON.stringify(raw)));
    const fl = JSON.parse(JSON.stringify(raw)), C = fl.spec.cage;
    C.gearFloats = 1; C.fltPreset = idx('Wipline 2350');
    W.CAGE_FLOAT_APPLY_PRESET(C, 'Wipline 2350');
    pitch = (fl.spec.prop && fl.spec.prop.pitch) || 'standard';
    PAGE.load(); KIT(Object.assign(C, { fltPreset: idx('custom') })); C.fltPreset = idx('Wipline 2350');
    const ev = KIT(C); await tick();
    fl.spec.gear = Object.assign({}, fl.spec.gear, { type: 'floats' });
    fl.spec.prop = Object.assign({}, fl.spec.prop, { pitch });
    const J = LB.gameSpec(fl);
    const shL = CORE.genShakedown(CORE.buildGen(CORE.genMigrateSpec(JSON.parse(JSON.stringify(land))))),
          shF = CORE.genShakedown(CORE.buildGen(CORE.genMigrateSpec(JSON.parse(JSON.stringify(J)))));
    ok(ev && ev.kind === 'fit' && J.prop.D === ROW.D && J.prop.blades === 2 && J.prop.material === 'alu' && J.prop.pitch === 'seaplane',
       'joined as the game loads it: prop D ' + J.prop.D + ', ' + J.prop.blades + ' blades, ' + J.prop.material + ', ' + J.prop.pitch);
    ok(shF.propTstatic > 2950 && shF.propTstatic < 3200, 'the 82 x 43 pulls ' + shF.propTstatic.toFixed(0) + ' N standing (FM 0.50 on 118 kW: ~3,075)');
    ok(shL.propPitch === (land.prop.pitch === 'auto' ? shL.propPitch : land.prop.pitch) && shL.propD === land.prop.D,
       'the land 172 flies its own propeller: ' + shL.propD + ' m, ' + shL.propPitch + ', ' + shL.propTstatic.toFixed(0) + ' N');
  }

  console.log(`\nFLOATKIT: ${checks - fails}/${checks} ok` + (fails ? `, ${fails} FAIL` : ''));
  console.log(`GATE FLOATKIT: ${fails ? 'FAIL' : 'PASS'}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('  FAIL   threw: ' + (e && e.stack || e)); console.log('GATE FLOATKIT: FAIL'); process.exit(1); });
