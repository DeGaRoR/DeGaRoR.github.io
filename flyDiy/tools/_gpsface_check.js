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
    createLinearGradient: () => ({ addColorStop: noop }),                    // G2813: the PFD's sky and ground
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
  // G2813: THE PFD - the grid baked off the ground door, then a 20 Hz repaint every call (the attitude, the speed and the
  // position moving), the plain attitude (synthetic vision off), its keys, a tap; and the ground never read again
  let nG = 0;
  const srcG = Object.assign({}, src, { ground: (x, z) => { nG++; return 40 + 300 * Math.sin(x / 1700) * Math.cos(z / 2300); } });
  const o = { Veas: 45, vs: 1.2, roll: 0.1, pitch: 0.05, hdg: 0.3, beta: 0.01 };
  const CKg = { gpsOn: true, cg, nightK: () => 1, sim: { out: o } };
  GPS.bind({ kind: 'glass', units: 'aviation', src: srcG, speeds: { Vs0: 13, Vs1: 15, Vfe: 24, Vh: 50, Vne: 62 } });
  for (let i = 0; i < 400; i++) { cg[0] += 0.8; GPS.tick(1 / 60, CKg); }
  out.svReady = GPS.sv().ready; out.page = GPS.state().page;
  const n0 = nG;
  const measureP = fn => { for (let i = 0; i < 20000; i++) fn(); const M = 3000, per = []; for (let rep = 0; rep < 5; rep++) { global.gc(); const a = newUsed(); for (let i = 0; i < M; i++) fn(); per.push((newUsed() - a) / M); } return Math.min(...per); };
  const fly = () => { cg[0] += 1; cg[2] -= 0.5; cg[1] += 0.05; o.roll = o.roll > 0.6 ? -0.6 : o.roll + 0.002; o.pitch = -o.pitch; o.Veas = 40 + (o.roll + 0.6) * 10; GPS.tick(1 / 20, CKg); };
  out.tickPaintPfd = measureP(fly);
  GPS.key('rngDn'); out.tickPaintPfdPlain = measureP(fly); GPS.key('rngDn');
  out.keyPfd = measureP(() => { GPS.key('rngUp'); GPS.key('rngUp'); });
  out.touch = measureP(() => { GPS.touch(0.5, 0.55); });
  out.groundReads = nG - n0;
  // G2815: A PAIR - the PFD at 20 Hz and the MFD (its map and engine strip) at 4, both off one tick
  CKg.readings = { rpmEng: 2300, oilP: 420000, oilT: 82, fuelFrac: 0.6, volts: 13.9, ampsOut: 1.2 }; CKg.energy = { kind: 'fuel', capacity: 150 };
  CKg.sw = { sw_gps: 1, sw_gps2: 1 };
  GPS.bind({ kind: 'flatPair', units: 'aviation', src: srcG, speeds: { cert: true, Vs0: 13, Vs1: 15, Vfe: 24, Vno: 50, Vne: 62, Vr: 15, rpm: 2700 } });
  for (let i = 0; i < 400; i++) { cg[0] += 0.8; GPS.tick(1 / 60, CKg); }
  out.pairPages = GPS.state(0).page + '/' + GPS.state(1).page;
  out.tickPair = measureP(fly);
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
  // G2814: THE POWER BUTTONS stand ON in flight (the shed draws them OFF: the button out); a click is a switch's - the
  // display off and its load off the bus, and on again. G2815: a pair's second display - its keys (gk1_<key>) and its
  // screen (the 'gps2' material) reach the second unit
  {
    check(CK.sw.sw_gps === 1 && CK.sw.sw_gps2 === 1, 'C G2814: the GPS power buttons ON in flight', CK.sw.sw_gps + ' ' + CK.sw.sw_gps2);
    const g = mk('edGauge_gpspwr', { law: 'switch', drive: 'sw_gps', ax: [0, 0, 1], sgn: 1, k: 0, slide: [0, 0, 0.001], slideDrive: 'sw_gps', padR: 0.006 });
    run(2); const on0 = CK.gpsOn;
    CK.click(g); run(2);
    check(on0 && CK.sw.sw_gps === 0 && !CK.gpsOn, 'C G2814: a click on the power button turns the display off (its load off the bus)', CK.sw.sw_gps + ' ' + CK.gpsOn);
    CK.click(g); run(2);
    check(CK.sw.sw_gps === 1 && CK.gpsOn, 'C ...and on again', CK.sw.sw_gps + ' ' + CK.gpsOn);
    const g2 = mk('edGauge_gps2key_page', { law: 'gpskey', drive: 'gk1_page', ax: [0, 0, 1], sgn: 1, k: 0, slide: [0, 0, 0.0012], slideDrive: 'gk1_page', padR: 0.008 });
    const got = [], W0 = global.window;
    global.window = Object.assign({}, W0 || {}, { FLYDIY_GPS: { key: (k, ui) => { got.push(k + ':' + ui); return true; }, touch: (u, v, ui) => { got.push('tap:' + ui); return true; } } });
    CK.click(g2);
    const mat = new THREE.MeshBasicMaterial(); mat.userData.panelSet = 'gps2';
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), mat); scr.position.set(0, 0, -1);
    const gS = new THREE.Group(); gS.add(scr); gS.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10); cam.lookAt(0, 0, -1); cam.updateMatrixWorld(true);
    const hit = CK.pick(cam, 0, 0, { gauges: [], grp: gS });
    if (hit) CK.click(hit);
    check(got.join() === 'page:1,tap:1' && hit && hit.unit === 1, 'C G2815: the second display\'s key (gk1_page) and a tap on its screen reach the second unit', got.join());
    global.window = W0;
  }
  // G2813: THE GLASS IS A TOUCH SCREEN - a ray onto the GPS's screen (its material the join's 'gps' bucket) picks it with
  // where it landed (the uv), and the click hands that to the GPS while the unit is powered
  {
    const mat = new THREE.MeshBasicMaterial(); mat.userData.panelSet = 'gps';
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.155, 0.093), mat); scr.position.set(0, 0, -1);
    const gS = new THREE.Group(); gS.add(scr); gS.updateMatrixWorld(true);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10); cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); cam.updateMatrixWorld(true);
    const hit = CK.pick(cam, 0.03, 0.02, { gauges: [], grp: gS });
    check(hit && hit.pick === 'gps' && hit.u > 0.53 && hit.u < 0.6 && hit.v > 0.53 && hit.v < 0.6, 'C G2813: a ray onto the GPS screen picks it with its uv (right of centre and up)', hit && [hit.pick, hit.u, hit.v].join(' '));
    const got = [], W0 = global.window; global.window = Object.assign({}, W0 || {}, { FLYDIY_GPS: { touch: (u, v) => { got.push([u, v]); return true; } } });
    const on0 = CK.gpsOn;
    CK.gpsOn = true;
    check(hit && CK.click(hit) && got.length === 1 && got[0][0] === hit.u, 'C ...the click hands the tap to the GPS', JSON.stringify(got));
    CK.gpsOn = false;
    check(hit && !CK.click(hit) && got.length === 1, 'C ...an unpowered unit is handed nothing');
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
  ok(S.rngI === 2 && !S.trkUp && S.page === 'pfd' && S.keysAt === 'below', 'J a new flight (a glass unit, metric): 8 km, north up, the PFD (G2813), the keys under the glass', JSON.stringify([S.rngI, S.page, S.keysAt]));
  // P (G2813) THE PFD: the grid baked off the ground door a slice a frame, then never read again; 20 Hz on the PFD and 4 on
  // the map; its keys (the synthetic vision, its terrain colours, the page round PFD -> MAP -> NAV); the taps
  {
    let nG = 0;
    const srcG = Object.assign({}, src, { ground: (x, z) => { nG++; return 100 + 200 * Math.sin(x / 1500); } });
    const o = { Veas: 40, vs: 0, roll: 0.2, pitch: 0.05, hdg: 0, beta: 0 };
    const CKp = { gpsOn: true, cg, nightK: () => 1, sim: { out: o } };
    GPS.bind({ kind: 'glass', units: 'aviation', src: srcG, speeds: { Vs0: 13, Vs1: 15, Vfe: 24, Vh: 50, Vne: 62 } });
    ok(S.pfd && S.page === 'pfd' && S.svt && S.terr && S.vsp && S.vsp.Vne === 62, 'P a glass unit: its PFD, the synthetic vision and its terrain colours on, the build\'s speeds');
    let i = 0; for (; i < 1000 && !GPS.sv().ready; i++) { cg[0] += 0.5; GPS.tick(1 / 60, CKp); }
    const HN = Math.sqrt(GPS.sv().hf.length);
    ok(GPS.sv().ready && nG === HN * HN, 'P the synthetic vision\'s grid: ' + HN + ' x ' + HN + ' ground reads, a slice a frame (' + i + ' frames)', nG);
    for (let k = 0; k < 600 && S.boot < GPS.BOOT_S + 0.1; k++) GPS.tick(1 / 60, CKp);      // (past the splash: the grid bakes under it)
    const n1 = nG, p1 = S.paints;
    for (let k = 0; k < 120; k++) { cg[0] += 0.5; GPS.tick(1 / 60, CKp); }
    ok(nG === n1, 'P ...and the PFD reads the ground no more', nG - n1);
    ok(Math.abs(S.paints - p1 - 40) <= 2, 'P the PFD repaints at 20 Hz (' + (S.paints - p1) + ' in 2 s)', S.paints - p1);
    const PF = GPS.pf();
    ok(near(PF.hdg, 90, 1e-6) && near(PF.ias, 40, 1e-9) && near(PF.alt, cg[1], 1e-9), 'P it reads the ADAHRS: sim.out\'s heading 0 (+x, 38_nav.js) is 090 on the north-up compass; the speed; the height', PF.hdg + ' ' + PF.ias);
    ok(GPS.key('rngDn') && !S.svt && GPS.key('rngDn') && S.svt, 'P SVT: the synthetic vision off, and on');
    ok(GPS.key('rngUp') && !S.terr && GPS.key('rngUp') && S.terr, 'P TERR: its terrain colours off, and on');
    ok(!GPS.key('orient'), 'P the third key has nothing to do on the PFD');
    ok(GPS.key('page') && S.page === 'map' && GPS.key('page') && S.page === 'nav' && GPS.key('page') && S.page === 'pfd', 'P the page key: PFD -> MAP -> NAV -> PFD');
    GPS.key('page'); const p2 = S.paints;
    for (let k = 0; k < 120; k++) { cg[0] += 0.5; GPS.tick(1 / 60, CKp); }
    ok(Math.abs(S.paints - p2 - 8) <= 1, 'P on the map: back to 4 Hz', S.paints - p2);
    // the taps (u across from the pilot's left, v up)
    const kL = Math.max(18, Math.round(S.H * 0.085)), r0 = S.rngI;
    ok(GPS.touch(1 - 19 / 512, 1 - (Math.round(S.H * 0.15) + 55) / S.H) && S.rngI === r0 - 1, 'P a tap on the map\'s + : the range a step in', S.rngI);
    ok(GPS.touch(1 - 19 / 512, 1 - (Math.round(S.H * 0.15) + 89) / S.H) && S.rngI === r0, 'P ...on its - : back out', S.rngI);
    ok(GPS.touch(0.1, (kL / 2) / S.H) && S.rngI === r0 - 1, 'P a tap on the first key\'s label is that key (RNG -)', S.rngI);
    ok(!GPS.touch(0.3, 0.6), 'P a tap elsewhere on the map does nothing');
    GPS.key('page'); GPS.key('page');
    ok(S.page === 'pfd' && GPS.touch(0.5, 1 - 8 / S.H) && S.page === 'nav', 'P on the PFD a tap on the waypoint bar opens the nav page', S.page);
    ok(GPS.touch(0.5, 0.5) && S.page === 'pfd', 'P ...a tap on the nav page goes back to the PFD', S.page);
    ok(GPS.touch(0.5, (kL + 20) / S.H) && S.page === 'map', 'P ...a tap on the heading arc opens the map', S.page);
    GPS.key('page'); GPS.key('page');
    ok(!GPS.touch(0.5, 0.6) && S.page === 'pfd', 'P a tap on the attitude does nothing');
    CKp.gpsOn = false; for (let k = 0; k < 4; k++) GPS.tick(1 / 60, CKp);
    ok(!GPS.touch(0.5, 1 - 8 / S.H) && !GPS.key('rngDn'), 'P a dark unit takes no tap and no press');
  }
  // Q (G2815) A PAIR OF 10 IN DISPLAYS: two units - the PFD and the MFD with its engine strip - each its own canvas
  // (768 px), material (the join's 'gps' and 'gps2'), page, keys, taps and power button (G2814: CK.sw.sw_gps / sw_gps2)
  {
    const o = { Veas: 45, vs: 0, roll: 0.1, pitch: 0.03, hdg: 0, beta: 0 };
    const CKq = { gpsOn: true, cg, nightK: () => 1, sim: { out: o }, sw: { sw_gps: 1, sw_gps2: 1 },
      readings: { rpmEng: 2300, oilP: 420000, oilT: 82, fuelFrac: 0.6, volts: 13.9, ampsOut: 1.2 }, energy: { kind: 'fuel', capacity: 150 } };
    const srcQ = Object.assign({}, src, { ground: () => 50 });
    GPS.bind({ kind: 'flatPair', units: 'aviation', src: srcQ });
    const A = GPS.state(0), B = GPS.state(1);
    ok(GPS.units() === 2 && A !== B && A.cv !== B.cv && A.cv.width === 768 && B.cv.width === 768 && A.mat !== B.mat &&
       A.mat.userData.panelSet === 'gps' && B.mat.userData.panelSet === 'gps2', 'Q a pair: two units, each its 768 px canvas and its own material (gps, gps2)');
    ok(A.page === 'pfd' && B.page === 'map' && !A.eis && B.eis && A.keysN === 12 && JSON.stringify(A.keySlots) === '[1,2,3,11]',
      'Q the first powers up on the PFD, the second on the map with its engine strip; twelve caps, four that switch', A.page + ' ' + B.page);
    ok(GPS.material(0, null, 1) === B.mat && GPS.material(0, null, 0) === A.mat, 'Q the join\'s second bucket gets the second display\'s material');
    for (let k = 0; k < 600 && (A.boot < GPS.BOOT_S + 0.1 || !GPS.sv().ready); k++) { cg[0] += 0.5; GPS.tick(1 / 60, CKq); }
    const pa = A.paints, pb = B.paints;
    for (let k = 0; k < 120; k++) { cg[0] += 0.5; GPS.tick(1 / 60, CKq); }
    ok(Math.abs(A.paints - pa - 40) <= 2 && Math.abs(B.paints - pb - 8) <= 1, 'Q the PFD at 20 Hz, the MFD at 4 (' + (A.paints - pa) + ' / ' + (B.paints - pb) + ' in 2 s)');
    ok(GPS.key('page', 1) && B.page === 'nav' && A.page === 'pfd', 'Q the MFD\'s page key turns the MFD only');
    GPS.key('page', 1);
    ok(B.page === 'pfd' && GPS.key('page', 1) && B.page === 'map', 'Q ...round MAP -> NAV -> PFD -> MAP');
    const r0 = B.rngI, ra = A.rngI;
    ok(GPS.touch(1 - 19 / 768, 1 - (Math.round(B.H * 0.15) + 55) / B.H, 1) && B.rngI === r0 - 1 && A.rngI === ra, 'Q a tap on the MFD\'s + zooms the MFD only', B.rngI);
    const kL = Math.min(32, Math.max(18, Math.round(A.H * 0.085)));
    ok(!GPS.touch(0.5 / 12, kL / 2 / A.H, 0), 'Q a tap on a cap that does nothing yet (the row\'s first) does nothing');
    const sv0 = A.svt;
    ok(GPS.touch(1.5 / 12, kL / 2 / A.H, 0) && A.svt === !sv0, 'Q a tap on the second cap\'s label is the first key (SVT on the PFD)');
    GPS.key('rngDn', 0);
    CKq.sw.sw_gps2 = 0; for (let k = 0; k < 4; k++) GPS.tick(1 / 60, CKq);
    ok(A.on && !B.on && B.mat.emissiveIntensity === 0, 'Q G2814: the MFD\'s power button off - the MFD dark, the PFD on');
    CKq.sw.sw_gps2 = 1; CKq.sw.sw_gps = 0; for (let k = 0; k < 4; k++) GPS.tick(1 / 60, CKq);
    ok(!A.on && B.on, 'Q ...and the PFD\'s off, the MFD on (booting)');
    GPS.bind({ kind: 'flat', units: 'aviation', src: srcQ });
    ok(GPS.units() === 1 && GPS.state(0).page === 'pfd' && GPS.state(0).cv.width === 768, 'Q one 10 in display: one unit, the PFD, 768 px');
  }
  GPS.bind({ kind: 'glass', units: 'metric', src });
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
    // G2813: the PFD
    check(al.svReady && al.page === 'pfd', 'E G2813: a glass unit powers up on its PFD and its synthetic vision\'s grid is baked', al.svReady + ' ' + al.page);
    check(al.tickPaintPfd < 4 && al.tickPaintPfdPlain < 4, 'E G2813: a PFD repaint (the synthetic vision, the tapes, the arc) allocates nothing - and with the synthetic vision off', al.tickPaintPfd.toFixed(2) + ' / ' + al.tickPaintPfdPlain.toFixed(2) + ' bytes');
    check(al.keyPfd < 4 && al.touch < 4, 'E G2813: a PFD key and a tap on the glass allocate nothing', al.keyPfd.toFixed(2) + ' / ' + al.touch.toFixed(2) + ' bytes');
    check(al.groundReads === 0, 'E G2813: the PFD never reads the ground once its grid is baked (terrainH can bake a raster tile on a far read)', al.groundReads);
    check(al.pairPages === 'pfd/map' && al.tickPair < 4, 'E G2815: a pair (the PFD at 20 Hz, the MFD and its engine strip at 4) ticks and repaints allocating nothing', al.pairPages + ' ' + (al.tickPair != null ? al.tickPair.toFixed(2) : al.tickPair) + ' bytes');
    say('E G2813 bytes a call: the PFD ' + al.tickPaintPfd.toFixed(2) + ' (plain ' + al.tickPaintPfdPlain.toFixed(2) + '), a PFD key ' + al.keyPfd.toFixed(2) + ', a tap ' + al.touch.toFixed(2) + '; G2815 the pair ' + al.tickPair.toFixed(2));
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
  // G2815: the 10 in displays - the metal Cessna (the widest dash) takes the pair, the PFD on the pilot's side, the MFD
  // across the middle, every dial kept; the C172 takes one on either side, but not a second beside it (its arched plate
  // and the yokes leave no 208 mm under the crown); the Cub's one, in the middle, costs it three small gauges
  ['metal', 'bugReports/cessnaMetal (1).json', 'flatPair', 'plate', false, true],
  ['cessna', 'builds/cessna172_2026-09-20_corrected.json', 'flat', 'plate', false, true],
  ['cessna', 'builds/cessna172_2026-09-20_corrected.json', 'flat:copilot', 'plate', false, true],
  ['cessna', 'builds/cessna172_2026-09-20_corrected.json', 'flatPair', 'plate', false, true],
  ['cub', 'builds/cub_2026-09-20_corrected.json', 'flat', 'plate', false, false],
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
  // (G2815: '<kind>:<side>' fits a single 10 in display on that side)
  const [gKind, gside] = gps.split(':');
  if (gps !== 'keep') spec.systems = Object.assign({}, spec.systems, { avionics: Object.assign({}, spec.systems.avionics || {}, { gps: gKind }) }, gside ? { gpsSide: gside } : {});
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
  // G2814 / G2815: the power buttons, and a pair's second display
  const pw = W.CAGE_PANEL.moving.filter(m => /^edGauge_gpspwr/.test(m.name)).map(m => ({ name: m.name, drive: m.drive, law: m.law, slide: m.slide, padR: m.padR }));
  const gk2 = W.CAGE_PANEL.moving.filter(m => /^edGauge_gps2key_/.test(m.name)).map(m => m.drive);
  let gps2Mesh = 0, gps2Mat = null;
  r.scene.traverse(o => { if (o.name === 'edGauge_gps2') { gps2Mesh++; gps2Mat = o.material && o.material.userData && o.material.userData.panelSet; } });
  process.stdout.write(JSON.stringify({ L: { dials: L.dials, switches: L.switches, screens: L.screens, breakers: L.breakers, extraOverflow: L.extraOverflow,
    overflow: L.overflow, yTop: L.yTop, yBot: L.yBot, xLim: L.xLim }, pilotX: args && args.o.side === 'centre' ? 0 : (args && args.o.pilotX) || 0,
    noRoom: sys.noRoom || [], billed: { items: RB.items, avionics: RB.avionics, breakers: RB.breakers.map(b => b.key), dropped: RB.dropped },
    joined: { rows: RJ.rows.map(q => q.key), avionics: RJ.avionics, items: RJ.items },
    moving: mv, gpsMesh, gpsMat, unit, gk, pw, gk2, gps2Mesh, gps2Mat, joinedRows: RJ.rows.filter(q => /^gps:/.test(q.key)), errors: r.errors.length }) + '\n');
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
    const f = C.GEN_AVIONICS.gps[gps.split(':')[0]].face, U = D.unit, h = U.housing, sc = U.screen;
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
    // G2814: its power button - a switch on sw_gps, out in the shed, a press slide, its own pad
    check(D.pw.some(m => m.drive === 'sw_gps' && m.law === 'switch' && m.slide && m.slide[2] > 0 && m.padR > 0), tag + ': its power button (sw_gps, the switch law: a press slide and a pad)', JSON.stringify(D.pw.map(m => m.drive)));
  }
  // G2815: a single 10 in display on the passenger's side; a pair's second display - drawn on its own material with its
  // own keys and power button, or (no room) named and the pair billed as the one display drawn
  if (/:copilot$/.test(gps) && S) check(S.line === 'copilot' && S.cx * D.pilotX < 0, tag + ': the display in front of the passenger (across the middle from the pilot)', S.cx.toFixed(3) + ' / ' + D.pilotX);
  if (gps === 'flatPair') {
    const S2 = (L.screens || []).find(q => q.k === 'gps2'), F1 = C.GEN_AVIONICS.gps.flat, row = D.joinedRows[0];
    if (S2) {
      check(D.gps2Mesh === 1 && D.gps2Mat === 'gps2' && D.gk2.length === 4 && D.gk2.every(d => /^gk1_/.test(d)) && D.pw.some(m => m.drive === 'sw_gps2'),
        tag + ': the MFD drawn - its screen on the second material, its four keys on gk1_<key>, its power button on sw_gps2', [D.gps2Mesh, D.gps2Mat, D.gk2.join(), D.pw.map(m => m.drive).join()].join(' '));
      check(row && row.key === 'gps:flatPair' && near(row.kg, C.GEN_AVIONICS.gps.flatPair.kg, 1e-9), tag + ': the pair billed as two displays', JSON.stringify(row));
    } else {
      check(D.gps2Mesh === 0 && D.noRoom.includes('gps2'), tag + ': no room for the MFD - named, not drawn', D.noRoom.join());
      check(row && near(row.kg, F1.kg, 1e-9) && near(row.price, F1.price, 1e-9) && /no room/.test(row.name), tag + ': ...and billed as the one display drawn', JSON.stringify(row));
    }
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
  check(/window\.FLYDIY_GPS\.bind\(\{ kind: CK\.fit\.avionics\.gps === 'flatPair' && !CK\.gpsPair \? 'flat' : CK\.fit\.avionics\.gps,[^\n]*\n\s*units: CK\.fit\.units, src: gpsSource\(\), speeds: gpsSpeeds\(def\) \}\)/.test(app),
    'H app.js binds the GPS with the cockpit (G2813: the build\'s speeds; G2815: a pair whose MFD had no room as one)');
  check(/m\.panel === 'gps' \|\| m\.panel === 'gps2'/.test(app) && /material\(0, null, m\.panel === 'gps2' \? 1 : 0\)/.test(app), 'H G2815: the flown model\'s second screen gets the second display\'s material');
  check(/ground: \(x, z\) => \(world \? \(world\.terrainHBuild \?/.test(app), 'H G2813: the GPS\'s ground door is the world\'s build read (never a lazy raster bake)');
  check(/m\.panel === 'gps' \|\| m\.panel === 'gps2'\) && window\.FLYDIY_GPS/.test(app), 'H app.js builds the screen on the GPS\'s own material (the editor block need not be loaded; G2815: the second display\'s too)');
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
