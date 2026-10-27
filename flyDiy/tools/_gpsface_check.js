#!/usr/bin/env node
// GATE GPSFACE (G2805, AVIONICS-GPS phase 2) - THE GPS ON THE PANEL AND THE POWER BEHIND IT.
//
//   node tools/_gpsface_check.js             -> "GATE GPSFACE: PASS|FAIL"
//   node tools/_gpsface_check.js --selftest  -> a doctored bus and a doctored face must go red
//
// What it holds, and how each failure would read if nothing said so:
//   A  THE CATALOGUE AND THE RESOLVER (60_gen_spec.js): every GPS row draws a face (a unit, a screen inside it); a
//      powered dial and a radio each get a breaker, sized over what it feeds, the lights theirs under names apart
//      from the radios'; the installed parts are the bill's own electrics rows (the bus + the wire = the harness
//      row, exactly) and the frame's ledger bills exactly the resolver's electrics - nothing moved in mass
//   B  THE BUS (31_elec.js): the GPS is alive only with the master on, the avionics master on, its breaker in and
//      the volts there; a breaker opens over its rating and stays open until pushed; the field breaker stops the
//      alternator; a bus with no breakers sums its loads exactly as it always did
//   C  THE COCKPIT (cockpit.js): the switches and the breakers the hand works reach the bus every frame - the GPS,
//      a turn needle, a lamp go dark with theirs; a tripped breaker pops out under the hand; the avionics cap
//      lights with its own switch whether or not the lights are fitted (W1)
//   D  THE FACE (gps_face.js) on a recording canvas: its material is the join's `gps` bucket; it boots, then
//      repaints at 4 Hz and uploads only then; power cut = one dark paint and no glow; the track samples every
//      2 s; the leg is the plan's (else the destination, direct); the desired track and the ground speed are
//      the geometry's; no readback anywhere in the file
//   E  NO ALLOCATION (a child under --expose-gc, GATE CITYHOST's method: new-space bytes a call, warmed, the
//      least of five windows): the bus's step, the face's tick between repaints and WITH a repaint
//   F  THE DASH (the headless scene with the crew and panel layers, the validated saves as the game loads them -
//      tools/_load_build.js; G2808, the glass panel): the screen goes FIRST, in front of the pilot - every GPS kind,
//      on the plate on the pilot's line where the plate holds it there (the Cessnas, the Cub), clear of every dial
//      and switch; a glass unit fits both Cessnas with every dial still on the dash; what the dash has no room for
//      (the Jodel's glass costs it four gauges, Rufus's three) is named, not drawn, and NOT BILLED - the join's `noRoom` is the
//      layout's overflow, and the core's bill on the joined spec carries none of it; the breakers drawn are the
//      billed ones, each a moving part on cb_<key>; a portable with no room on the plate stands in its cradle on
//      the pilot's line, clear of the compass
//   G  THE BAY (_eng_mesh.js): the battery case is the fitted battery's size, on the firewall plate; without the
//      fit's dims it is the 17 x 13 cm box it always was
//   H  THE WIRING: the manifest, app.js's bind / tick / material, the shed's avionics click
'use strict';
const fs = require('fs'), path = require('path'), v8 = require('v8');
const T = __dirname, ROOT = path.join(T, '..');
const SELFTEST = process.argv.includes('--selftest');

// ---- a recording 2D canvas (no DOM in node) ----
function fakeCanvas(w, h, record) {
  const calls = record ? { fillRect: 0, drawImage: 0, fillText: 0, stroke: 0, getImageData: 0 } : null;
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', font: '', lineWidth: 1, lineJoin: '', textAlign: '', textBaseline: '',
    fillRect: record ? () => { calls.fillRect++; } : noop, drawImage: record ? () => { calls.drawImage++; } : noop,
    fillText: record ? () => { calls.fillText++; } : noop, stroke: record ? () => { calls.stroke++; } : noop,
    getImageData: () => { if (calls) calls.getImageData++; return null; },
    beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, closePath: noop, fill: noop, rect: noop, clip: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, setTransform: noop, clearRect: noop, strokeRect: noop,
  };
  return { width: w, height: h, getContext: () => ctx, calls };
}

// =====================================================================================================================
// E (the child): allocation, bytes a call
// =====================================================================================================================
if (process.argv.includes('--alloc')) {
  const C = require(path.join(T, 'flight_core.js'));
  global.GEN_AVIONICS = C.GEN_AVIONICS;
  global.THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  const GPS = require(path.join(ROOT, 'src', 'viewer', 'gps_face.js'));
  GPS.setCanvas((w, h) => fakeCanvas(w, h, false));
  const newUsed = () => v8.getHeapSpaceStatistics().find(s => s.space_name === 'new_space').space_used_size;
  const measure = fn => { for (let i = 0; i < 300000; i++) fn(); const M = 20000, per = []; for (let rep = 0; rep < 5; rep++) { global.gc(); const a = newUsed(); for (let i = 0; i < M; i++) fn(); per.push((newUsed() - a) / M); } return Math.min(...per); };
  const out = {};
  // the bus, breakers and the avionics bus in play
  const R = C.genSystemsResolve({ systems: { fit: 'ifr', avionics: { gps: 'panel' } } }, { lights: ['nav', 'beacon', 'land', 'taxi', 'flood', 'instr'] });
  const bus = C.makeBus({ battAh: R.battAh, altA: R.altA, loads: R.loads, breakers: R.breakers });
  let rpm = 0;
  out.busStep = measure(() => { rpm = rpm > 2400 ? 0 : rpm + 7; bus.step(1 / 60, rpm, false); });
  out.busPowered = measure(() => { bus.powered('gps'); bus.powered('turn'); });
  // the face: a moving aeroplane, the plan's leg, the map
  const map = { width: 1024, height: 1024 }, box = { x0: -12000, z0: -12000, size: 24000 };
  const fields = [{ x: 1000, z: -2000, name: 'HOME', kind: 'strip' }, { x: -5000, z: 3000, name: 'Brekk', kind: 'strip' }];
  const plan = { legs: [{ A: [0, 0], B: [3000, -4000], name: 'WP1' }, { A: [3000, -4000], B: [6000, -1000], name: 'WP2' }], legI: 0 };
  const src = { map: () => map, box: () => box, fields: () => fields, plan: () => plan, dest: () => null };
  GPS.bind({ kind: 'portable', units: 'aviation', src });
  const cg = [0, 300, 0];
  const CK = { gpsOn: true, cg, nightK: () => 1 };
  for (let i = 0; i < 200; i++) { cg[0] += 0.8; GPS.tick(1 / 60, CK); }      // past the boot
  // between repaints: dt so small the paint interval is never reached in a window
  out.tickIdle = measure(() => { cg[0] += 0.001; GPS.tick(1e-7, CK); });
  // every call a repaint (dt = the interval): the repaint path itself
  out.tickPaint = measure(() => { cg[0] += 1; cg[2] -= 0.5; GPS.tick(0.25, CK); });
  // G2812: the softkeys' pages - track-up (the map turned) and the nav page - repaint allocation-free too
  GPS.key('orient');
  out.tickPaintTrk = measure(() => { cg[0] += 1; cg[2] -= 0.5; GPS.tick(0.25, CK); });
  GPS.key('orient'); GPS.key('page');
  out.tickPaintNav = measure(() => { cg[0] += 1; cg[2] -= 0.5; GPS.tick(0.25, CK); });
  GPS.key('page');
  out.key = measure(() => { GPS.key('rngUp'); GPS.key('rngDn'); });
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const C = require(path.join(T, 'flight_core.js'));
const fail = []; let checks = 0;
const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra !== undefined ? ' - ' + extra : '')); return ok; };
const say = s => console.log('  ' + s);
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-9 : t);
const cl = o => JSON.parse(JSON.stringify(o));
const LIT = ['nav', 'beacon', 'land', 'taxi', 'flood', 'instr', 'pedal', 'pax'];

// =====================================================================================================================
// A THE CATALOGUE AND THE RESOLVER
// =====================================================================================================================
{
  for (const [k, r] of Object.entries(C.GEN_AVIONICS.gps)) {
    if (k === 'none') continue;
    const f = r.face;
    check(f && f.w > 0.05 && f.h > 0.03 && f.sw > 0 && f.sh > 0 && f.sw < f.w && f.sh < f.h, 'A gps ' + k + ' draws a face: a unit with its screen inside', JSON.stringify(f));
    check(!r.later, 'A gps ' + k + ' is drawn now (no `later`)');
  }
  const R = C.genSystemsResolve({ systems: { fit: 'ifr', avionics: { gps: 'panel' } } }, { lights: LIT });
  const cb = k => R.breakers.find(b => b.key === k);
  for (const l of R.loads) {
    const b = cb(l.cb);
    check(!!b && b.A >= l.amps * C.GEN_ELEC_PARTS.breakerMargin - 1e-9, 'A load ' + l.key + ' has its breaker, rated over 1.4 x its draw', b && b.A);
  }
  check(R.loads.filter(l => /^(com|xpdr|nav|gps)$/.test(l.key)).every(l => l.av) && R.loads.filter(l => !/^(com|xpdr|nav|gps)$/.test(l.key)).every(l => !l.av),
    'A the radios (and only they) ride the avionics bus');
  check(!!cb('gps') && !!cb('nav') && !!cb('navLt') && cb('nav').feeds[0] === 'nav' && cb('navLt').feeds.includes('nav') && cb('navLt').group === 'lights',
    'A the NAV receiver and the navigation lights have breakers of their own (nav / navLt)');
  check(!!cb('field') && cb('field').A === C.GEN_ELEC_PARTS.fieldA, 'A the alternator has its field breaker');
  check(!!cb('cabinLt') && ['flood', 'instr', 'pedal', 'pax'].every(k => cb('cabinLt').feeds.includes(k)), 'A the cabin lamps share one breaker');
  const keys = R.breakers.map(b => b.key);
  check(new Set(keys).size === keys.length, 'A no two breakers share a key', keys.join());
  const Rn = C.genSystemsResolve({ systems: { fit: 'ifr' } }, { lights: [] });
  check(Rn.breakers.every(b => b.group !== 'lights'), 'A no light fitted, no light breaker');
  const Rm = C.genSystemsResolve({ systems: { fit: 'minimal', avionics: { gps: 'portable' } } });
  check(Rm.breakers.length === 0 && Rm.avionics.gps === 'none' && Rm.dropped.some(d => d.key === 'gps' && /no battery/.test(d.why)),
    'A no battery: the GPS is dropped and said, no breakers at all');
  // the parts are the bill's electrics, broken out: nothing added, nothing lost
  const elecKg = R.rows.filter(r => r.group === 'elec').reduce((a, r) => a + r.kg, 0);
  const partsKg = R.parts.reduce((a, p) => a + p.kg, 0);
  check(near(elecKg, partsKg, 1e-9), 'A the installed parts weigh exactly the electrics rows', elecKg + ' vs ' + partsKg);
  const hr = R.rows.find(r => r.key === 'harness'), bp = R.parts.find(p => p.key === 'bus'), wp = R.parts.find(p => p.key === 'wire');
  check(hr && bp && wp && bp.kg + wp.kg === hr.kg && bp.kg > 0 && wp.kg > 0, 'A the bus and the wire are the harness row, exactly', hr && (bp.kg + ' + ' + wp.kg + ' vs ' + hr.kg));
  check(R.parts.find(p => p.key === 'battery').at === 'firewallLow' && R.parts.find(p => p.key === 'alternator').at === 'engine' &&
        R.parts.find(p => p.key === 'starter').at === 'engine' && bp.at === 'panel', 'A each part says where the frame bills it');
  check(Array.isArray(R.parts.find(p => p.key === 'battery').dims) && R.parts.find(p => p.key === 'alternator').len > 0, 'A the parts carry their sizes');
  // the frame bills exactly the resolver's electrics (no mass moved by G2801)
  const spec = C.resolveSpec(Object.assign(cl(C.GEN_DEFAULT), { systems: { fit: 'ifr', avionics: { gps: 'panel' } } })).spec;
  const def = C.buildGen(spec), L = def.parts.ledger, Rs = C.genSystemsResolve(spec);
  check(near(L.elec.mass, Rs.bill.elec.kg, 1e-9) && near(L.avionics.mass, Rs.bill.avionics.kg, 1e-9), 'A the ledger bills the resolver\'s electrics and avionics exactly',
    L.elec.mass + ' / ' + Rs.bill.elec.kg);
  // the bill is what it was: the resolver's rows, ignoring the new records, equal the rows without lights
  check(JSON.stringify(C.genSystemsResolve({ systems: { fit: 'ifr' } }).rows) === JSON.stringify(C.genSystemsResolve({ systems: { fit: 'ifr' } }, { lights: LIT }).rows),
    'A the lights change the breaker panel, never the bill');
}

// =====================================================================================================================
// B THE BUS
// =====================================================================================================================
function busSuite(makeBus, tag) {
  const out = [];
  const ok = (c, l) => out.push([!!c, l]);
  const R = C.genSystemsResolve({ systems: { fit: 'basic', avionics: { gps: 'portable' } } }, { lights: ['nav'] });
  const bus = makeBus({ battAh: R.battAh, altA: R.altA, loads: R.loads.concat([{ key: 'sw_nav', amps: 2.5, cb: 'navLt' }]), breakers: R.breakers });
  bus.step(1, 0, false);
  ok(bus.powered('gps') && bus.powered('com') && bus.powered('fuel'), 'B master on, avionics on: the GPS, the COM, the fuel gauge alive');
  bus.avionics = false; bus.step(1, 0, false);
  ok(!bus.powered('gps') && !bus.powered('com') && bus.powered('fuel'), 'B the avionics master off: the GPS and the COM dark, the fuel gauge not');
  const lAv = bus.loadA;
  bus.avionics = true; bus.step(1, 0, false);
  ok(near(bus.loadA - lAv, R.loads.filter(l => l.av).reduce((a, l) => a + l.amps, 0), 1e-9), 'B the avionics bus\'s draw is exactly the radios\'');
  bus.cb.gps = false; bus.step(1, 0, false);
  ok(!bus.powered('gps') && bus.powered('com'), 'B the GPS breaker pulled: the GPS alone dark');
  bus.cb.gps = true; bus.master = false; bus.step(1, 0, false);
  ok(!bus.powered('gps') && !bus.powered('fuel') && !bus.ok, 'B the master off: everything dark');
  bus.master = true; bus.soc = 0; bus.step(1, 0, false);
  ok(!bus.powered('gps') && bus.V < 9, 'B a flat battery, the alternator not turning: dark');
  bus.step(1, 2300, false);
  ok(bus.altOn && bus.powered('gps'), 'B the alternator turning: the bus is back and the GPS with it');
  // (the model reads any charge above nothing as 11.8 V: the second of charging above left a little - flat again)
  bus.soc = 0; bus.cb.field = false; bus.step(1, 2300, false);
  ok(!bus.altOn && !bus.powered('gps'), 'B the field breaker out: the alternator makes nothing, the flat battery cannot carry');
  bus.cb.field = true; bus.soc = 1; bus.step(1, 0, false);
  bus.setLoad('sw_nav', 30, 'navLt'); bus.step(1, 0, false);
  ok(bus.cb.navLt === false && bus.tripped.navLt === true && !bus.powered('sw_nav') && bus.powered('gps'), 'B a load over its breaker\'s rating opens it (and only it)');
  bus.setLoad('sw_nav', 2.5); bus.step(1, 0, false);
  ok(bus.cb.navLt === false, 'B an open breaker stays open until pushed');
  bus.cb.navLt = true; bus.step(1, 0, false);
  ok(bus.powered('sw_nav') && bus.cb.navLt === true, 'B pushed in, it holds again');
  // a bus with no breakers: the old sum, the old life
  const b0 = makeBus({ battAh: 16, altA: 20, loads: [{ key: 'a', amps: 1 }, { key: 'b', amps: 2 }] });
  b0.step(1, 0, false); const s0 = b0.loadA; b0.on.b = false; b0.step(1, 0, false);
  ok(s0 === 3 && b0.loadA === 1 && b0.powered('a') && !b0.powered('b'), 'B no breakers, no avionics bus: the loads sum as they always did');
  return out;
}
for (const [c, l] of busSuite(C.makeBus)) check(c, l);

// =====================================================================================================================
// C THE COCKPIT
// =====================================================================================================================
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
global.THREE = THREE;
{
  global.genSystemsResolve = C.genSystemsResolve; global.makeBus = C.makeBus; global.GEN_INSTR = C.GEN_INSTR;
  global.GEN_LIGHT_AMPS = C.GEN_LIGHT_AMPS; global.GEN_LIGHT_BREAKER = C.GEN_LIGHT_BREAKER; global.GEN_AVIONICS = C.GEN_AVIONICS;
  delete require.cache[require.resolve(path.join(ROOT, 'src', 'viewer', 'cockpit.js'))];
  const CKm = require(path.join(ROOT, 'src', 'viewer', 'cockpit.js'));
  const CK = CKm.make(THREE);
  const AX = [1, 0, 0];
  const mk = (name, c) => { const g = new THREE.Group(); g.name = name; return { obj: g, c, home: [0, 0, 0] }; };
  const gauges = [
    mk('edGauge_turn_plane', { law: 'lin', gauge: 'turn', hand: 'plane', drive: 'r', ax: AX, sgn: 1, stops: [[-1, -30], [1, 30]] }),
    mk('edGauge_cb_turn', { law: 'switch', drive: 'cb_turn', ax: [0, 0, 1], sgn: 1, k: 0, slide: [0, 0, -0.004], slideDrive: 'cb_turn', padR: 0.007 }),
  ];
  const grp = new THREE.Group(); for (const g of gauges) grp.add(g.obj);
  const capMat = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 0 });
  const navMat = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 0 });
  const lamps = [{ mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), capMat), key: 'avionics', kind: 'cup' },
                 { mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), navMat), key: 'nav', kind: 'lens' }];
  const model = { grp, gauges, lamps, mats: {}, meshes: {}, people: [], data: { lights: { on: true, nav: 1 } } };
  const eng = [{ running: true, key: 'both', crank: 0 }];
  const sim = { out: { Veas: 40, vs: 0, roll: 0, pitch: 0, hdg: 0, r: 0.2, beta: 0, rpm: [2300], rpmEng: [2300], nz: 1 },
                fuel: { kind: 'fuel', frac: 0.8, litres: 35 }, eng, cgPos: () => [0, 300, 0], setEngine: () => {} };
  const spec = C.resolveSpec(Object.assign(cl(C.GEN_DEFAULT), { systems: { fit: 'ifr', avionics: { gps: 'portable' } } })).spec;
  CK.bind(model, model.data, sim, spec, { fieldElev: 0 });
  const run = n => { for (let i = 0; i < n; i++) CK.frame(1 / 60, sim, { t: i / 60 }); };
  run(60);
  check(CK.gpsFit && CK.gpsOn, 'C a fitted GPS is alive with the master and the avionics master on');
  check(Array.isArray(CK.cbKeys) && CK.cbKeys.includes('gps') && CK.cbKeys.includes('turn') && CK.cbKeys.includes('navLt') && CK.cbSw.every(k => CK.sw[k] === 0),
    'C the breakers bind in, one cb_<key> each', CK.cbKeys && CK.cbKeys.join());
  CK.sw.sw_avionics = 0; run(2);
  check(!CK.gpsOn, 'C the avionics master off: the GPS dark');
  CK.lightOn = false; CK.glow(0);
  check(capMat.emissiveIntensity === 0, 'C W1: the avionics cap is dark with its switch off');
  CK.sw.sw_avionics = 1; run(2); CK.glow(0);
  check(CK.gpsOn && capMat.emissiveIntensity > 0, 'C W1: ...and lit with it on, the lights layer off or not', capMat.emissiveIntensity);
  CK.lightOn = true;
  CK.sw.cb_gps = 1; run(2);
  check(!CK.gpsOn, 'C the GPS breaker pulled (cb_gps 1): the GPS dark');
  CK.sw.cb_gps = 0; run(2);
  check(CK.gpsOn, 'C pushed in: alive again');
  // the turn needle on its breaker
  run(120);
  const rOn = CK.readings.r;
  CK.sw.cb_turn = 1; run(180);
  check(Math.abs(rOn) > 0.1 && Math.abs(CK.readings.r) < 0.01, 'C the turn coordinator\'s breaker pulled: its reading relaxes to rest', rOn + ' -> ' + CK.readings.r);
  // the switch law flips the breaker as it flips a toggle (the click), and the slide poses it out
  CK.click(gauges[1]);
  check(CK.sw.cb_turn === 0, 'C a click on a pulled breaker pushes it in');
  CK.click(gauges[1]); CK.pose(model);
  check(CK.sw.cb_turn === 1, 'C ...and a click pulls it');
  // a lamp on its breaker
  CK.sw.cb_turn = 0; CK.sw.sw_nav = 1; CK.handSw.sw_nav = true; run(2); CK.glow(0);
  const lit = navMat.emissiveIntensity;
  CK.sw.cb_navLt = 1; run(2); CK.glow(0);
  check(lit > 0 && navMat.emissiveIntensity === 0, 'C the nav lights\' breaker pulled: the lens dark with its switch on', lit + ' -> ' + navMat.emissiveIntensity);
  // a trip pops the button under the hand
  CK.sw.cb_navLt = 0; run(2);
  CK.bus.setLoad('sw_nav', 99, 'navLt');
  const LA = CK.bus.loads; void LA;
  // (the frame re-sets the light's load from its switch every frame: overload it through the bus's own door)
  CK.bus.step(1 / 60, 2300, false);
  for (let i = 0; i < CK.cbKeys.length; i++) if (CK.bus.cb[CK.cbKeys[i]] === false) CK.sw[CK.cbSw[i]] = 1;
  check(CK.sw.cb_navLt === 1 && CK.bus.tripped.navLt, 'C an overload trips the breaker and it stands out under the hand');
  // G2812: A GPS SOFTKEY (the `gpskey` law): a click presses it in (the slide) and hands the key to the GPS - only while
  // the unit is powered; the press lets go by itself; its own pick pad
  {
    const g = mk('edGauge_gpskey_page', { law: 'gpskey', drive: 'gk_page', ax: [0, 0, 1], sgn: 1, k: 0, slide: [0, 0, 0.0012], slideDrive: 'gk_page', padR: 0.008 });
    const got = [], W0 = global.window; global.window = Object.assign({}, W0 || {}, { FLYDIY_GPS: { key: k => { got.push(k); return true; } } });
    const on0 = CK.gpsOn;
    CK.gpsOn = true; const took = CK.click(g); const mP = { gauges: [g], grp }; CK.pose(mP);
    check(took && got.join() === 'page' && g.obj.position.z > 0.001, 'C a GPS softkey: the click presses it in and hands "page" to the GPS', got.join() + ' ' + g.obj.position.z);
    CK.gpsOn = false; CK.click(g);
    check(got.length === 1, 'C ...an unpowered unit is handed nothing (the key still moves)', got.join());
    CK.gkUntil.gk_page = 0; CK.pose(mP);
    check(g.obj.position.z === 0, 'C ...and the key lets go by itself', g.obj.position.z);
    CK.padSwitches({ gauges: [g] });
    const pad = g.obj.children.find(q => q.userData && q.userData.pickPad);
    check(pad && pad.geometry.parameters.radius === 0.008, 'C ...its own pick pad', pad && pad.geometry.parameters.radius);
    CK.gpsOn = on0; global.window = W0;
  }
  // the pick pad of a breaker is its own size
  CK.padSwitches({ gauges: [mk('edGauge_cb_x', { law: 'switch', drive: 'cb_x', ax: [0, 0, 1], k: 0, slide: [0, 0, -0.004], padR: 0.007 })] });
  {
    const g = mk('edGauge_cb_y', { law: 'switch', drive: 'cb_y', ax: [0, 0, 1], k: 0, slide: [0, 0, -0.004], padR: 0.007 });
    CK.padSwitches({ gauges: [g] });
    const pad = g.obj.children.find(c => c.userData.pickPad);
    check(pad && pad.geometry.parameters.radius === 0.007, 'C a breaker\'s pick pad is its own 7 mm (not the 16 mm a toggle\'s is)', pad && pad.geometry.parameters.radius);
  }
  delete global.genSystemsResolve; delete global.makeBus; delete global.GEN_INSTR;
}

// =====================================================================================================================
// D THE FACE
// =====================================================================================================================
function faceSuite(GPS) {
  const out = [];
  const ok = (c, l, x) => out.push([!!c, l, x]);
  const cvs = [];
  GPS.setCanvas((w, h) => { const c = fakeCanvas(w, h, true); cvs.push(c); return c; });
  const m = GPS.material();
  ok(m && m.userData.panelSet === 'gps' && m.map && m.emissiveMap === m.map, 'D the screen\'s material is the join\'s `gps` bucket, its map its glow');
  const map = { width: 1024, height: 1024 }, box = { x0: -12000, z0: -12000, size: 24000 };
  const fields = [{ x: 1000, z: -2000, name: 'HOME', kind: 'strip' }];
  const plan = { legs: [{ A: [0, 0], B: [4000, 0], name: 'EAST' }, { A: [4000, 0], B: [4000, -3000], name: 'NORTH' }], legI: 0 };
  let dest = null;
  const src = { map: () => map, box: () => box, fields: () => fields, plan: () => plan, dest: () => dest };
  GPS.bind({ kind: 'panel', units: 'aviation', src });
  const S = GPS.state(), f = C.GEN_AVIONICS.gps.panel.face;
  ok(near(S.aspect, f.sw / f.sh, 1e-9) && S.cv.width === 512, 'D bound to a GPS 175: the canvas at its screen\'s aspect', S.aspect);
  const cg = [0, 300, 0];
  const CK = { gpsOn: false, cg, nightK: () => 1 };
  const u0 = S.uploads;
  for (let i = 0; i < 120; i++) GPS.tick(1 / 60, CK);
  ok(S.paints === 0 && S.uploads === u0 && S.mat.emissiveIntensity === 0, 'D unpowered: nothing painted, nothing uploaded, no glow');
  // power on, fly east at 50 m/s for 12 s
  CK.gpsOn = true;
  const p0 = S.paints;
  for (let i = 0; i < 720; i++) { cg[0] += 50 / 60; GPS.tick(1 / 60, CK); }
  const paints = S.paints - p0, expect = (12 - GPS.BOOT_S) * GPS.HZ;
  ok(Math.abs(paints - expect) <= 2, 'D powered: it boots, then repaints at 4 Hz (' + paints + ' in 12 s, ~' + expect.toFixed(0) + ')', paints);
  ok(S.uploads - u0 <= paints + 2, 'D the texture is uploaded only when it was repainted (+ the boot page)', (S.uploads - u0) + ' uploads');
  ok(S.mat.emissiveIntensity > 0, 'D powered: the screen glows');
  ok(near(S.gs, 50, 1), 'D the ground speed is the aeroplane\'s over the ground (50 m/s)', S.gs);
  ok(near(S.trk * 57.29578, 90, 1), 'D the track flown east reads 090', S.trk * 57.29578);
  ok(S.trN >= 5 && S.trN <= 7, 'D the track sampled every 2 s', S.trN);
  const W = GPS.waypoint(cg[0], cg[2]);
  ok(W.on && W.name === 'EAST' && W.bx === 4000 && near(W.dtk, 90, 1e-6), 'D the active leg is the plan\'s: EAST, desired track 090', JSON.stringify(W));
  plan.legI = 1;
  const W2 = GPS.waypoint(cg[0], cg[2]);
  ok(W2.name === 'NORTH' && near(((W2.dtk % 360) + 360) % 360, 0, 1e-6), 'D the next leg: NORTH, 000 (north is -z)', W2.dtk);
  plan.legs = []; dest = { x: -3000, z: 0, name: 'Brekk' };
  const W3 = GPS.waypoint(cg[0], cg[2]);
  ok(W3.on && W3.name === 'Brekk' && W3.ax === cg[0] && near(W3.dtk, 270, 1e-6), 'D no plan: the destination, direct from here (270)', JSON.stringify(W3));
  const cv = S.cv, calls = cv.calls;
  ok(calls.drawImage > 0 && calls.fillText > 0, 'D the map page draws the baked map and its numbers');
  ok(calls.getImageData === 0, 'D nothing read back from the canvas');
  // power cut: one dark paint, then nothing
  CK.gpsOn = false;
  const pc = S.uploads;
  for (let i = 0; i < 240; i++) GPS.tick(1 / 60, CK);
  ok(S.uploads === pc + 1 && S.mat.emissiveIntensity === 0, 'D power cut: one dark paint, no glow, then nothing', (S.uploads - pc) + ' uploads');
  // power back: the boot page first
  CK.gpsOn = true; const pb = S.paints;
  for (let i = 0; i < 60; i++) GPS.tick(1 / 60, CK);
  ok(S.paints === pb, 'D power back: the boot page holds before the map', S.paints - pb);
  // J (G2812) THE SOFTKEYS: four, switching only - the range a step each way (clamped at its ends), north-up / track-up,
  // the page; the glass repainted at once; a unit dark or booting takes no press; a new flight powers up on 4 nm, north up
  CK.gpsOn = true; for (let i = 0; i < 200; i++) { cg[0] += 0.8; GPS.tick(1 / 60, CK); }
  ok(JSON.stringify(GPS.KEYS) === '["rngDn","rngUp","orient","page"]', 'J four softkeys: rngDn, rngUp, orient, page', JSON.stringify(GPS.KEYS));
  ok(S.rngI === 2 && !S.trkUp && S.page === 'map' && S.keys === 4 && S.keysAt === 'left', 'J bound to a GPS 175: 4 nm, north up, the map; its four keys in a column on the left', JSON.stringify([S.rngI, S.trkUp, S.page, S.keys, S.keysAt]));
  const u1 = S.uploads, f1 = calls.fillText;
  ok(GPS.key('rngDn') && S.rngI === 1 && S.uploads === u1 + 1 && calls.fillText > f1, 'J RNG -: 2 nm, repainted at once (the labels and the numbers drawn)', S.rngI);
  GPS.key('rngDn'); GPS.key('rngDn');
  ok(S.rngI === 0, 'J ...down to 1 nm and no further', S.rngI);
  for (let i = 0; i < 8; i++) GPS.key('rngUp');
  ok(S.rngI === GPS.RANGES.aviation.length - 1, 'J RNG +: up to 16 nm and no further', S.rngI);
  ok(GPS.key('orient') && S.trkUp && GPS.key('orient') && !S.trkUp, 'J the orientation key: track up, and back to north up');
  ok(GPS.key('page') && S.page === 'nav' && GPS.key('page') && S.page === 'map', 'J the page key: the nav page, and back to the map');
  GPS.key('page'); const fN = calls.fillText; GPS.tick(0.25, CK);
  ok(S.page === 'nav' && calls.fillText > fN, 'J the nav page repaints at 4 Hz like the map', calls.fillText - fN);
  GPS.key('page');
  ok(!GPS.key('bogus'), 'J an unknown key is no key');
  CK.gpsOn = false; for (let i = 0; i < 4; i++) GPS.tick(1 / 60, CK);
  ok(!GPS.key('rngDn') && S.rngI === GPS.RANGES.aviation.length - 1, 'J a dark unit takes no press');
  CK.gpsOn = true; GPS.tick(1 / 60, CK);
  ok(!GPS.key('orient') && !S.trkUp, 'J a booting unit takes no press');
  GPS.bind({ kind: 'glass', units: 'metric', src });
  ok(S.rngI === 2 && !S.trkUp && S.page === 'map' && S.keysAt === 'below', 'J a new flight (a glass unit, metric): 8 km, north up, the map, the keys under the glass', JSON.stringify([S.rngI, S.keysAt]));
  GPS.bind({ kind: 'panel', units: 'aviation', src });
  // a parked aeroplane's capture builds the panel for another build mid-flight: the bound unit is not touched
  CK.gpsOn = true; for (let i = 0; i < 200; i++) GPS.tick(1 / 60, CK);
  const cvB = S.cv, aB = S.aspect, kB = S.kind, onB = S.on;
  const mB = GPS.material(C.GEN_AVIONICS.gps.glass.face.sw / C.GEN_AVIONICS.gps.glass.face.sh, 'glass');
  ok(mB === S.mat && S.cv === cvB && S.aspect === aB && S.kind === kB && S.on === onB,
    'D bound to a flight, a panel build for another aeroplane (another unit) neither resizes, renames nor resets it');
  GPS.standby();
  ok(!S.on && !S.bound && S.mat.emissiveIntensity === 0, 'D the shed: standby, unlit, released');
  GPS.material(C.GEN_AVIONICS.gps.glass.face.sw / C.GEN_AVIONICS.gps.glass.face.sh, 'glass');
  ok(S.kind === 'glass' && near(S.aspect, C.GEN_AVIONICS.gps.glass.face.sw / C.GEN_AVIONICS.gps.glass.face.sh, 1e-9),
    'D ...and in the shed the panel names and sizes the unit it drew');
  return out;
}
{
  const GPS = require(path.join(ROOT, 'src', 'viewer', 'gps_face.js'));
  for (const [c, l, x] of faceSuite(GPS)) check(c, l, x);
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'gps_face.js'), 'utf8');
  check(!/getImageData|readPixels|toDataURL|toBlob/.test(src.replace(/\/\/[^\n]*/g, '')), 'D gps_face.js reads nothing back (no getImageData / readPixels / toDataURL / toBlob)');
}

// =====================================================================================================================
// E NO ALLOCATION
// =====================================================================================================================
{
  let al = null;
  try {
    al = JSON.parse(require('child_process').execFileSync(process.execPath, ['--expose-gc', '--max-semi-space-size=64', __filename, '--alloc'],
      { encoding: 'utf8', timeout: 240000 }));
  } catch (e) { al = { err: String(e.message || e).slice(0, 300) }; }
  if (al && !al.err) {
    check(al.busStep < 4, 'E the bus\'s step (breakers, the avionics bus) allocates nothing', al.busStep.toFixed(2) + ' bytes');
    check(al.busPowered < 4, 'E bus.powered allocates nothing', al.busPowered.toFixed(2) + ' bytes');
    check(al.tickIdle < 4, 'E the GPS\'s tick between repaints allocates nothing', al.tickIdle.toFixed(2) + ' bytes');
    check(al.tickPaint < 4, 'E the GPS\'s tick WITH a repaint allocates nothing (the strings cached, the frame module state)', al.tickPaint.toFixed(2) + ' bytes');
    check(al.tickPaintTrk < 4 && al.tickPaintNav < 4, 'E G2812: the track-up map and the nav page repaint allocating nothing', al.tickPaintTrk.toFixed(2) + ' / ' + al.tickPaintNav.toFixed(2) + ' bytes');
    check(al.key < 4, 'E G2812: a softkey press (its repaint) allocates nothing', al.key.toFixed(2) + ' bytes');
    say('E bytes a call: bus.step ' + al.busStep.toFixed(2) + ', bus.powered ' + al.busPowered.toFixed(2) + ', GPS tick ' + al.tickIdle.toFixed(2) + ', GPS repaint ' + al.tickPaint.toFixed(2) +
        ' (track-up ' + al.tickPaintTrk.toFixed(2) + ', nav ' + al.tickPaintNav.toFixed(2) + '), a key ' + al.key.toFixed(2));
  } else check(false, 'E the allocation child ran', al && al.err);
}

// =====================================================================================================================
// F THE DASH (the validated saves through the headless scene, the panel layers in)
// =====================================================================================================================
// [name, save, gps kind, where the screen goes, on the pilot's line, every dial on the dash]
const PANELS = [
  ['cub', 'builds/cub_2026-09-20_corrected.json', 'glass', 'plate', true, true],
  ['cub', 'builds/cub_2026-09-20_corrected.json', 'portable', 'plate', true, true],
  ['cessna', 'builds/cessna172_2026-09-20_corrected.json', 'glass', 'plate', true, true],
  // the shipped metal Cessna (tools/_load_build.js VALIDATED.metal): A0's evidence build for tools/avionics_stills.js
  ['metal', 'bugReports/cessnaMetal (1).json', 'glass', 'plate', true, true],
  ['metal', 'bugReports/cessnaMetal (1).json', 'portable', 'plate', true, true],
  // the Jodel's short plate: a portable there would cost dials, so it stands in its cradle on the pilot's line; the
  // glass unit fits only in the middle, and four gauges give way to it
  ['jodel', 'builds/jodel_2026-09-20_corrected.json', 'portable', 'coaming', true, true],
  ['jodel', 'builds/jodel_2026-09-20_corrected.json', 'glass', 'plate', false, false],
  // Rufus's glass unit in front of the pilot: G2812's unit (193 x 115 round its screen, 198 x 159 before) leaves every dial
  // its place (it cost the DG and the oil gauges)
  ['rufus', 'builds/rufus_2026-10-18_certified.json', 'glass', 'plate', true, true],
];
function dashOf(file, gps) {
  // one scene context per process is the layers' contract: each case its own child
  const r = require('child_process').execFileSync(process.execPath, [__filename, '--dash', file, gps], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 << 20 });
  return JSON.parse(r.split('\n').filter(l => l.startsWith('{')).pop());
}
if (process.argv.includes('--dash')) {
  const i = process.argv.indexOf('--dash'), file = process.argv[i + 1], gps = process.argv[i + 2];
  const SH = require(path.join(T, '_scene_headless.js'));
  for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js', '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { C: CC } = BJ.loadPanel();
  const W = SH.context().ctx; SH.stubCanvas();
  // the spec the GAME flies for the save (tools/_load_build.js: the page's own load chain - GATE JOINPARITY's rule)
  const s0 = require(path.join(T, '_load_build.js')).loadBuild(file).spec;
  const cerr = console.error; console.error = () => {};
  const spec = cl(s0);
  if (gps !== 'keep') spec.systems = Object.assign({}, spec.systems, { avionics: Object.assign({}, spec.systems.avionics || {}, { gps }) });
  delete spec.systems.noRoom;
  const def = CC.buildGen(cl(spec));
  W.CAGE_ENERGY.fromSpec(spec.energy, spec);
  W.CAGE_PANEL.fromSpec(spec.systems);
  // catch the layout's arguments (the pilot's line)
  let args = null;
  const lay0 = W.PANEL_GEN.layout;
  W.PANEL_GEN.layout = (A, o) => { args = { A, o }; return lay0(A, o); };
  const r = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
  W.PANEL_GEN.layout = lay0;
  W.CAGE_UI = { P: r.P };                      // the rows the build read (the fitted lights: the breaker panel's)
  console.error = cerr;
  const L = W.CAGE_PANEL.last().layout;
  // what the join writes, and the core's bill on the spec it writes it into
  const sys = W.CAGE_PANEL.toSpec();
  const RJ = CC.genSystemsResolve(Object.assign({}, spec, { systems: sys }));
  const RB = W.CAGE_PANEL.resolve(null, true);
  const mv = W.CAGE_PANEL.moving.filter(m => /^edGauge_cb_/.test(m.name)).map(m => ({ name: m.name, drive: m.drive, law: m.law, slide: m.slide, padR: m.padR }));
  let gpsMat = null, gpsMesh = 0;
  r.scene.traverse(o => { if (o.name === 'edGauge_gps') { gpsMesh++; gpsMat = o.material && o.material.userData && o.material.userData.panelSet; } });
  // G2812: the unit in its own frame (the bag meshes' vertices are the group's): the housing (the biggest), the screen,
  // the keys (their gauges: position, size), the meshes beside them (the knob's three)
  let unit = null;
  r.scene.traverse(o => { if (o.name === 'edGps' && !unit) {
    const bb = m => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(v => +v.toFixed(5)); };
    const meshes = o.children.filter(q => q.isMesh), area = b => (b[3] - b[0]) * (b[4] - b[1]);
    const boxes = meshes.map(m => ({ name: m.name, b: bb(m) })).sort((a, c) => area(c.b) - area(a.b));
    const keys = o.children.filter(q => /^edGauge_gpskey_/.test(q.name)).map(g => { const m = g.children.find(q => q.isMesh); const b = m ? bb(m) : null;
      return { name: g.name, x: +g.position.x.toFixed(5), y: +g.position.y.toFixed(5), b }; });
    unit = { housing: boxes[0] && boxes[0].b, screen: (boxes.find(q => q.name === 'edGauge_gps') || {}).b, meshes: meshes.length, keys };
  } });
  const gk = W.CAGE_PANEL.moving.filter(m => /^edGauge_gpskey_/.test(m.name)).map(m => ({ name: m.name, drive: m.drive, law: m.law, slide: m.slide, padR: m.padR }));
  process.stdout.write(JSON.stringify({ L: { dials: L.dials, switches: L.switches, screens: L.screens, breakers: L.breakers, extraOverflow: L.extraOverflow,
    overflow: L.overflow, yTop: L.yTop, yBot: L.yBot, xLim: L.xLim }, pilotX: args && args.o.side === 'centre' ? 0 : (args && args.o.pilotX) || 0,
    noRoom: sys.noRoom || [], billed: { items: RB.items, avionics: RB.avionics, breakers: RB.breakers.map(b => b.key), dropped: RB.dropped },
    joined: { rows: RJ.rows.map(q => q.key), avionics: RJ.avionics, items: RJ.items },
    moving: mv, gpsMesh, gpsMat, unit, gk, errors: r.errors.length }) + '\n');
  process.exit(0);
}
for (const [name, file, gps, want, onLine, allDials] of PANELS) {
  let D = null;
  const tag = 'F ' + name + ' + ' + gps;
  try { D = dashOf(file, gps); } catch (e) { check(false, tag + ' builds headless', String(e.message).slice(0, 200)); continue; }
  const L = D.L, Dp = L.dials.filter(d => !d.coaming);
  check(D.errors === 0, tag + ': the scene builds clean');
  const S = (L.screens || []).find(q => q.k === 'gps');
  const where = S ? (S.coaming ? 'coaming' : 'plate') : 'none';
  check(where === want, tag + ': the GPS ' + (want === 'none' ? 'finds no room and is named' : 'stands ' + (want === 'plate' ? 'on the plate' : 'in its glareshield cradle')), where);
  if (want === 'none') check(L.extraOverflow.includes('gps') && D.gpsMesh === 0, tag + ': named in extraOverflow, nothing drawn');
  else check(D.gpsMesh === 1 && D.gpsMat === 'gps', tag + ': one screen, on the GPS\'s own material (the join\'s `gps` bucket)', D.gpsMesh + ' ' + D.gpsMat);
  if (S && onLine) check(Math.abs(S.cx - D.pilotX) <= 0.0026, tag + ': the screen in front of the pilot (on the pilot\'s line)', S.cx.toFixed(3) + ' / ' + D.pilotX.toFixed(3));
  // G2812: THE UNIT AS ITS FACE - the housing w along x and h along y (it was drawn on its side), the screen inside it
  // at its size, four softkeys on the face and off the glass (each a `gpskey` gauge: a press slide, its own pad), the
  // dual knob only where the catalogue fits one
  if (S && D.unit && D.unit.housing) {
    const f = C.GEN_AVIONICS.gps[gps].face, U = D.unit, h = U.housing, sc = U.screen;
    check(near(h[3] - h[0], f.w, 0.0006) && near(h[4] - h[1], f.h, 0.0006), tag + ': the housing is the face, ' + (f.w * 1000).toFixed(0) + ' x ' + (f.h * 1000).toFixed(0) + ' mm, landscape',
          ((h[3] - h[0]) * 1000).toFixed(1) + ' x ' + ((h[4] - h[1]) * 1000).toFixed(1));
    check(sc && near(sc[3] - sc[0], f.sw, 1e-4) && near(sc[4] - sc[1], f.sh, 1e-4) && sc[0] >= h[0] && sc[3] <= h[3] && sc[1] >= h[1] && sc[4] <= h[4] && sc[2] < h[2],
          tag + ': the screen at its size, inside the housing, in front of it', JSON.stringify(sc));
    const inFace = k => k.x + k.b[3] <= h[3] + 1e-6 && k.x + k.b[0] >= h[0] - 1e-6 && k.y + k.b[1] >= h[1] - 1e-6 && k.y + k.b[4] <= h[4] + 1e-6;
    const offGlass = k => k.x + k.b[3] <= sc[0] || k.x + k.b[0] >= sc[3] || k.y + k.b[4] <= sc[1] || k.y + k.b[1] >= sc[4];
    check(U.keys.length === 4 && U.keys.every(k => k.b && inFace(k) && offGlass(k)), tag + ': four softkeys on the face, off the glass', U.keys.length);
    check(D.gk.length === 4 && D.gk.every(m => m.law === 'gpskey' && /^gk_(rngDn|rngUp|orient|page)$/.test(m.drive) && m.slide && m.slide[2] > 0 && m.padR > 0),
          tag + ': each softkey a gauge on the gpskey law (gk_<key>, a press slide, its own pad)', JSON.stringify(D.gk.map(m => m.drive)));
    check((U.meshes > 3) === !!f.knob, tag + ': ' + (f.knob ? 'the dual knob fitted' : 'no knob (a portable)'), U.meshes + ' meshes');
  }
  if (S && !S.coaming) {
    const x0 = S.cx - S.w / 2, x1 = S.cx + S.w / 2, y0 = S.cy - S.h / 2, y1 = S.cy + S.h / 2;
    const hitDial = Dp.find(d => { const nx = Math.max(x0, Math.min(d.cx, x1)), ny = Math.max(y0, Math.min(d.cy, y1)); return Math.hypot(nx - d.cx, ny - d.cy) < d.r; });
    const hitSw = L.switches.find(s => s.x > x0 - 0.008 && s.x < x1 + 0.008 && s.y > y0 - 0.008 && s.y < y1 + 0.008);
    check(!hitDial && !hitSw, tag + ': the GPS clear of every dial and switch', (hitDial && hitDial.k) || (hitSw && hitSw.k));
    check(x0 >= -L.xLim - 1e-6 && x1 <= L.xLim + 1e-6 && y1 <= L.yTop + 1e-6 && y0 >= L.yBot - 1e-6, tag + ': the GPS inside the plate');
  }
  let ov = null;
  for (let a = 0; a < Dp.length; a++) for (let b = a + 1; b < Dp.length; b++) if (Math.hypot(Dp[a].cx - Dp[b].cx, Dp[a].cy - Dp[b].cy) < Dp[a].r + Dp[b].r - 1e-6) ov = Dp[a].k + '/' + Dp[b].k;
  check(!ov, tag + ': no two dials overlap', ov);
  const swHit = L.switches.find(s => Dp.some(d => Math.abs(s.x - d.cx) < d.r + 0.008 && s.y > d.cy - d.r - 0.028 + 1e-9 && s.y < d.cy + d.r));
  check(!swHit, tag + ': no switch under a dial', swHit && swHit.k);
  if (allDials) check(!L.overflow.length, tag + ': every dial on the dash beside the screen', L.overflow.join());
  else check(L.overflow.length > 0, tag + ': gauges give way to the screen (named)', L.overflow.join());
  // NO ROOM = NOT BILLED: the join writes the layout's overflow as `noRoom`, and the core's bill on that spec carries
  // none of it - no dial row, no radio row, no breaker
  const lostAll = L.overflow.concat(L.extraOverflow);
  check(JSON.stringify(D.noRoom.slice().sort()) === JSON.stringify(lostAll.slice().sort()), tag + ': the join\'s noRoom is the layout\'s overflow', D.noRoom.join());
  const billedLost = lostAll.filter(k => D.joined.items.includes(k) || (D.joined.avionics[k] && D.joined.avionics[k] !== 'none') ||
    D.joined.rows.some(q => q === k || q.startsWith(k + ':')));
  check(!billedLost.length, tag + ': nothing the dash has no room for is billed (the core, on the joined spec)', billedLost.join());
  check(L.overflow.every(k => D.billed.dropped.some(q => q.key === k && /no room/.test(q.why))), tag + ': the column names each one "no room on the dash"');
  const row = (L.breakers && L.breakers.row) || [];
  check(row.map(b => b.k).sort().join() === D.billed.breakers.slice().sort().join(), tag + ': the breakers drawn are the billed ones', row.length + ' drawn / ' + D.billed.breakers.length);
  if (allDials) check(!L.extraOverflow.some(x => /^breaker:/.test(x)), tag + ': every breaker found room', L.extraOverflow.join());
  check(D.moving.length === row.length && D.moving.every(m => m.law === 'switch' && /^cb_/.test(m.drive) && m.slide && m.padR === 0.007),
    tag + ': each breaker a moving part on cb_<key>, a slide and its own pad', D.moving.length);
  const hitB = row.find(b => Dp.some(d => Math.hypot(d.cx - b.x, d.cy - b.y) < d.r + 0.009));
  check(!hitB, tag + ': no breaker on a dial', hitB && hitB.k);
  say(tag + ': GPS ' + where + (S ? ' at ' + S.cx.toFixed(3) + ', ' + S.cy.toFixed(3) + ' (pilot ' + D.pilotX.toFixed(3) + ')' : '') + '; ' +
      Dp.length + ' dials' + (L.overflow.length ? ', no room: ' + L.overflow.join(' ') : '') + '; ' + row.length + ' breakers in ' +
      ((L.breakers && L.breakers.rows) || []).length + ' row(s)' + (L.extraOverflow.length ? ', no room: ' + L.extraOverflow.join(' ') : ''));
}
// THE CRADLE (pure layout): a portable with no room on a tiny plate stands on the glareshield on the pilot's line,
// clear of the compass in the middle; a panel-mounted unit there is named
{
  const PG = require(path.join(T, '_panel_gen.js'));
  const tiny = { dashTop: 0.86, dashLip: 0.79, dashAftZ: 2.0, zDash: 2.0, halfW: 0.30, floorAt: () => 0 };
  const base = { items: ['asi', 'alt', 'compass'], side: 'pilot', pilotX: 0.18, radios: [], elec: { hasBus: true, altA: 20 } };
  // (a unit taller than the 90 mm the band always offers)
  const Lc = PG.layout(tiny, Object.assign({}, base, { screens: [{ k: 'gps', w: 0.135, h: 0.096, sw: 0.111, sh: 0.067, cradle: true }] }));
  const Sc = Lc.screens.find(q => q.k === 'gps');
  check(Sc && Sc.coaming && Math.abs(Sc.cx - 0.18) < 1e-9, 'F cradle: a portable with no room on the plate stands on the glareshield on the pilot\'s line', Sc && Sc.cx);
  const Lc0 = PG.layout(tiny, Object.assign({}, base, { pilotX: 0.02, screens: [{ k: 'gps', w: 0.135, h: 0.096, cradle: true }] }));
  const S0 = Lc0.screens.find(q => q.k === 'gps');
  check(S0 && S0.coaming && Math.abs(S0.cx) - S0.w / 2 >= 0.035 + 0.014 - 1e-9, 'F cradle: ...slid clear of the compass when the pilot sits in the middle', S0 && S0.cx);
  const Lp = PG.layout(tiny, Object.assign({}, base, { screens: [{ k: 'gps', w: 0.159, h: 0.1, cradle: false }] }));
  check(!Lp.screens.length && Lp.extraOverflow.includes('gps'), 'F cradle: a panel unit with no room is named, not drawn');
}

// =====================================================================================================================
// G THE BAY
// =====================================================================================================================
{
  global.window = global.window || {};
  const EG = require(path.join(T, '_eng_gen.js'));
  void EG;
  let EM = null;
  try { EM = require(path.join(T, '_eng_mesh.js')); } catch (e) {}
  EM = EM && EM.engMeshBuild ? EM : (global.window.ENG_MESH || null);
  if (EM && EM.engMeshBuild) {
    const base = { arch: 'flat', cyl: 4, battOn: 1, fwOn: 1, fwW: 0.8, fwH: 0.7 };
    const bbOf = M => { const p = M.parts.find(q => q.name === 'battBox'); if (!p) return null;
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = p.v0; i < p.v1; i++) { const v = M.V[i]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } }
      return { w: mx[0] - mn[0], h: mx[1] - mn[1], d: mx[2] - mn[2], y0: mn[1], y1: mx[1] }; };
    const b0 = bbOf(EM.engMeshBuild(Object.assign({}, base)));
    const dims = C.GEN_ELEC_PARTS.battery.lead.dims;
    const b1 = bbOf(EM.engMeshBuild(Object.assign({}, base, { battDims: dims })));
    check(b0 && near(b0.w, 0.17, 0.004) && near(b0.h, 0.13, 0.004), 'G no fit\'s dims: the 17 x 13 cm box it always was', b0 && b0.w.toFixed(3) + ' x ' + b0.h.toFixed(3));
    check(b1 && near(b1.w, dims[0], 0.004) && near(b1.h, dims[2], 0.004) && near(b1.d, dims[1], 0.006), 'G the fitted battery\'s own case (PC680: 178 x 168, 79 deep)', b1 && [b1.w, b1.h, b1.d].map(x => x.toFixed(3)).join(' x '));
    check(b1 && b1.y0 >= -base.fwH / 2 - 1e-6 && b1.y1 <= base.fwH / 2 + 1e-6 && b1.y0 < b0.y0, 'G ...low on the firewall plate, inside it (where the frame bills it)', b1 && b1.y0.toFixed(3));
    const b2 = bbOf(EM.engMeshBuild(Object.assign({}, base, { battOn: 0 })));
    check(!b2, 'G no battery: no case');
  } else check(false, 'G the engine mesh builder loads');
  const ce = fs.readFileSync(path.join(T, '_cage_eng.js'), 'utf8');
  check(/function bayElec\(\)/.test(ce) && /spec\.battOn = BE\.battOn; spec\.genOn = BE\.genOn; spec\.starter = BE\.starter;/.test(ce) &&
        /battOn: P => !bayElec\(\)/.test(ce), 'G the engine layer draws the bay\'s electrics from the fit (bayElec), its own rows only with no fit');
}

// =====================================================================================================================
// H THE WIRING
// =====================================================================================================================
{
  const build = fs.readFileSync(path.join(T, 'build.js'), 'utf8');
  check(build.indexOf("'gps_face.js'") > build.indexOf("'cockpit.js'") && build.indexOf("'gps_face.js'") < build.indexOf("'app.js'"),
    'H build: gps_face.js after cockpit.js, before app.js');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const iF = app.indexOf('if (CK) CK.frame(simDt, sim, ap,'), iT = app.indexOf('window.FLYDIY_GPS.tick(simDt, CK)');
  check(iF > 0 && iT > iF && iT - iF < 400, 'H app.js ticks the GPS right after CK.frame');
  check(/window\.FLYDIY_GPS\.bind\(\{ kind: CK\.fit\.avionics\.gps, units: CK\.fit\.units, src: gpsSource\(\) \}\)/.test(app), 'H app.js binds the GPS with the cockpit');
  check(/m\.panel === 'gps' && window\.FLYDIY_GPS/.test(app), 'H app.js builds the screen on the GPS\'s own material (the editor block need not be loaded)');
  check(/avionics: 'swAvionics'/.test(app), 'H W2: the shed\'s avionics click is the shed\'s swAvionics');
  {
    const iG = app.indexOf('function enterGarage()');
    check(iG > 0 && app.indexOf('window.FLYDIY_GPS.standby()', iG) > iG && app.indexOf('window.FLYDIY_GPS.standby()', iG) - iG < 1500,
      'H app.js: entering the garage puts the GPS back in standby (the flight releases it)');
  }
  const ck = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'cockpit.js'), 'utf8');
  check(/bus\.avionics = !!CK\.sw\.sw_avionics/.test(ck) && !/bus\.on\.com = /.test(ck), 'H cockpit.js: the avionics master is the avionics bus (COM / XPDR / NAV / GPS), not two loads');
}

// =====================================================================================================================
// I THE DRAWN CABIN (G2809, the user of 25 Oct: "Wysiwyg, and as billed for all"): a spec carrying the editor's
// measured cabin (outfit.drawn, outfit.ctl) bills a chair at every seat drawn, the board and the lining off the drawn
// surfaces (the Raymer lump steps aside), the control stations drawn; the same spec with no drawing bills as before
// =====================================================================================================================
{
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cessna172_2026-09-20_corrected.json'), 'utf8'));
  const S0 = cl(base.spec || base);
  delete (S0.outfit || {}).drawn; delete (S0.outfit || {}).ctl;
  const ledg = S => C.buildGen(cl(S)).parts.ledger;
  const L0 = ledg(S0);
  const D = { board: 0.32, dash: 0.51, shoulder: 0.51, door: 2.67, floor: 1.53, console: 0 };
  const S1 = cl(S0); S1.outfit = Object.assign({}, S1.outfit, { seats: 'sling', drawn: D, ctl: { stations: 2, kind: 'yoke' } });
  const L1 = ledg(S1);
  const O = C.GEN_OUTFIT, T = C.GEN_TRIM.light, seat = C.GEN_SEATS.sling;
  const nSeats = Array.isArray(S1.cabin && S1.cabin.seatsX) ? S1.cabin.seatsX.length : (S1.cabin && S1.cabin.seats);
  const trimKg = (D.shoulder + D.door + D.console) * T.pad + D.floor * (O.floorPlyKgM2 + T.cover);
  check(Math.abs(L1.furnish.mass - (seat.kg * nSeats + trimKg)) < 1e-6,
    'I the furnishing row is a chair at every seat drawn plus the drawn lining at the trim\'s densities (no Raymer lump)',
    L1.furnish.mass.toFixed(3) + ' / ' + (seat.kg * nSeats + trimKg).toFixed(3));
  check(C.genFurnK(S1) === 0 && C.genFurnK(S0) > 0, 'I the Raymer fraction steps aside on a drawn cabin, and only there');
  const S2 = cl(S1); S2.outfit.trim = 'full';
  const L2 = ledg(S2);
  const fullKg = (D.shoulder + D.door + D.console) * C.GEN_TRIM.full.pad + D.floor * (O.floorPlyKgM2 + C.GEN_TRIM.full.cover);
  check(Math.abs((L2.furnish.mass - L1.furnish.mass) - (fullKg - trimKg)) < 1e-6, 'I the trim is the drawn surfaces\' finish (light -> lined and quiet)');
  const S3 = cl(S1); S3.outfit.ctl = { stations: 1, kind: 'stick' };
  const L3 = ledg(S3);
  check(Math.abs((L1.outfit.mass - L3.outfit.mass) - (O.ctlDualKg + 2 * O.ctlStationKg.yoke)) < 1e-6, 'I the controls: a second station and the yokes\' columns billed as drawn');
  const S4 = cl(S1); S4.outfit.drawn = Object.assign({}, D, { board: 0, dash: 0 });
  const L4 = ledg(S4);
  check(Math.abs((L1.outfit.mass - L4.outfit.mass) - (D.board * O.panelKgM2 + D.dash * O.dashShellKgM2)) < 1e-6, 'I the panel board and its shell billed off the drawn dash (no dash, no board)');
  check(JSON.stringify(ledg(S0)) === JSON.stringify(L0), 'I a spec with no drawing bills as it always did (deterministic)');
  say('I drawn cabin: furnish ' + L1.furnish.mass.toFixed(2) + ' kg (' + nSeats + ' chairs, lining ' + trimKg.toFixed(2) + ' kg) against ' + L0.furnish.mass.toFixed(2) + ' kg undrawn');
}

// =====================================================================================================================
// --selftest: a doctored bus and a doctored face must go red
// =====================================================================================================================
if (SELFTEST) {
  let pass = true;
  const doctoredBus = cfg => { const b = C.makeBus(cfg); const p = b.powered; b.powered = k => (k === 'gps' ? b.ok : p(k)); return b; };
  const red1 = busSuite(doctoredBus).some(([c]) => !c);
  console.log('  selftest a bus whose GPS ignores the avionics master and its breaker ' + (red1 ? 'CAUGHT' : 'MISSED')); pass = pass && red1;
  delete require.cache[require.resolve(path.join(ROOT, 'src', 'viewer', 'gps_face.js'))];
  const G2 = require(path.join(ROOT, 'src', 'viewer', 'gps_face.js'));
  const t0 = G2.tick; G2.tick = (dt, CK) => { const s = G2.state(); const r = t0(dt, CK); if (CK.gpsOn) s.acc = 1; return r; };   // a face that repaints every frame
  const red2 = faceSuite(G2).some(([c]) => !c);
  console.log('  selftest a face that repaints every frame ' + (red2 ? 'CAUGHT' : 'MISSED')); pass = pass && red2;
  console.log('GATE GPSFACE: ' + (pass ? 'PASS' : 'FAIL (selftest)'));
  process.exit(pass ? 0 : 1);
}

for (const f of fail) console.log('  FAIL   ' + f);
console.log('  ' + checks + ' checks, ' + fail.length + ' failed');
console.log('GATE GPSFACE: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
