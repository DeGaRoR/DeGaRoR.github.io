#!/usr/bin/env node
// Gate: THE SIM DOES NOT LIE (G115) — the quality review's P-3, held as four
// joins, each asserted in the DIRECTION a builder would feel:
//   S1  the undercarriage has drag: spats buy it back, fat tyres cost it,
//       and the DEFAULT build barely moves (the delta-from-reference-gear
//       rule preserves the Cub-derived calibration).
//   S2  the ground has a surface: a paved run accelerates further than the
//       grass datum in the same seconds, from the same aeroplane.
//   S4  the fin flies its own aspect ratio, and reshaping it moves the
//       measured weathervane number (Cn_beta) the right way.
//   S7/S8  the plaque agrees with itself: TORun is roll + a DERIVED air
//       segment that lengthens when climb is weak, and Vs / VsFlap /
//       VsRatio are one instrument.
// node tools/test_honest.js            -> the battery
// node tools/test_honest.js --selftest -> negative verification
'use strict';
const { makeSim, makeWorld, buildGen, genShakedown, genTORunAt,
        placeAtAerodrome, GROUND_SURF } = require('./flight_core.js');

const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label +
    (ok || !extra ? '' : ' — ' + extra));
  if (!ok) fails.push(label);
  return ok;
};

// ---------------------------------------------------------------------------
// the checks as named functions over plain numbers, so --selftest can doctor
// ---------------------------------------------------------------------------
function checkGear(o) {
  check(Math.abs(o.stockDelta) < 0.010,
    'gear: the stock build is the reference — its drag delta is ~zero (' +
    o.stockDelta.toFixed(4) + ' m²)');
  check(o.spat < o.stock,
    'gear: spats BUY drag back (' + o.spat.toFixed(3) + ' < ' +
    o.stock.toFixed(3) + ' m² axial)');
  check(o.fatTyres > o.stock + 0.005,
    'gear: doubling the tyres COSTS drag (' + o.fatTyres.toFixed(3) + ' m²)');
  check(o.cantilever < o.stock,
    'gear: dropping the lift struts shows up (' + o.cantilever.toFixed(3) + ' m²)');
  // G121.2: the third wheel's own fairing — priced where drawn, inert where not
  check(o.twSpatTrike < o.twBareTrike - 0.008,
    'gear: a nosewheel spat buys drag on a trike (' + o.twSpatTrike.toFixed(3) +
    ' < ' + o.twBareTrike.toFixed(3) + ' m²)');
  // G133 INVERTED G121.2's exact-equality here, deliberately: the castor
  // draws its own shell now, so the tailwheel spat that had to move NOTHING
  // must now move something — the old assertion would be the original lie.
  check(o.twSpatTD < o.stock - 0.004,
    'gear: a tailwheel spat buys drag now the castor draws one (' +
    o.twSpatTD.toFixed(3) + ' < ' + o.stock.toFixed(3) + ' m²)');
  // G133: the leg fairing is its own purchase, and the trouser's leg number
  // finally has geometry behind it (the shroud _gear_gen draws)
  check(o.legFairOnly < o.stock - 0.004,
    'gear: a leg fairing alone buys drag (' + o.legFairOnly.toFixed(3) +
    ' < ' + o.stock.toFixed(3) + ' m²)');
  // G133: the droplet is priced — a long fine run-out beats a stub tail
  check(o.dropletLong < o.dropletShort - 0.003,
    'gear: the tail droplet shades the spat\'s own Cd (' +
    o.dropletLong.toFixed(3) + ' < ' + o.dropletShort.toFixed(3) + ' m²)');
  // G133: the fairings WEIGH — and carbon buys some of that weight back
  check(o.spatMass > o.stockMass + 3 && o.carbonMass < o.spatMass - 1,
    'gear: spats weigh (' + o.spatMass.toFixed(1) + ' vs ' +
    o.stockMass.toFixed(1) + ' kg) and carbon is lighter (' +
    o.carbonMass.toFixed(1) + ')');
}
function checkSurface(o) {
  check(o.paved > o.grass + 2,
    'surface: the same aeroplane accelerates further on pavement (' +
    o.paved.toFixed(0) + ' m vs ' + o.grass.toFixed(0) + ' m grass in 8 s)');
  // G121.3: the off-strip rows — every biome class the classifier answers
  // has a row, the directions read like the ground they name, and water is
  // the violent one: a wheel in a lake is not on a lawn.
  check(o.rows === 8, 'surface: all eight ground classes carry a row (' +
    o.rows + ')');
  check(o.screeCRR > o.grassCRR * 2 && o.waterCRR > o.screeCRR
        && o.waterBrake === 0,
    'surface: scree rolls hard, water harder, and brakes do NOTHING in water');
  check(o.scree < o.grass - 2,
    'surface: the same run over scree falls short of the grass datum (' +
    o.scree.toFixed(0) + ' m vs ' + o.grass.toFixed(0) + ' m)');
  check(o.water < o.scree - 2,
    'surface: and a lakebed run barely moves at all (' +
    o.water.toFixed(0) + ' m) — ditching decelerates like it means it');
  // G130: HOME IS THE CALIBRATION DATUM, AND IT ROLLS ON ITS DECLARED GRASS.
  // The classifier used to answer FOREST_FLOOR over most of HOME's run (the
  // registry's `surface:` was read by nothing), so the moment G121.3 priced
  // that class, every gate that rolls off HOME baselined THROUGH the wrong
  // ground and stayed green. The pin: the real HOME roll must match the
  // flat grass stub, whose only surface answer IS the datum row. 4 m
  // absorbs the strip's grading; the 2× CRR band cost tens of metres.
  check(Math.abs(o.grass - o.grassStub) < 4,
    'surface: HOME rolls like its declared grass, not like the forest (' +
    o.grass.toFixed(0) + ' m vs stub ' + o.grassStub.toFixed(0) + ' m)');
}
function checkFin(o) {
  check(o.aFin < o.aTail,
    'fin: its own lift slope, off its own AR (' + o.aFin.toFixed(2) +
    ' < the stab\'s ' + o.aTail.toFixed(2) + ')');
  check(o.aTall > o.aFin,
    'fin: a taller fin has the steeper slope (' + o.aTall.toFixed(2) + ')');
  check(o.cnStock > 0.03 && o.cnStock < 0.25,
    'fin: the stock weathervane number is in the fleet\'s band (' +
    o.cnStock.toFixed(3) + ')');
  check(o.cnSmall < o.cnStock * 0.75,
    'fin: halving the fin area weakens the weathervane (' +
    o.cnSmall.toFixed(3) + ' < ' + o.cnStock.toFixed(3) + ')');
}
// G185: THE TRUSS PAYS. A wired biplane's bracing is a real drag area; taking
// its wires away lowers it; an I-strut is cleaner than an N; and the second
// plane of a sesquiplane flies its OWN, lower, lift slope.
function checkBrace(o) {
  check(o.bip > 0.10,
    'brace: a wired biplane pays its truss (' + o.bip.toFixed(3) + ' m² > 0.10)');
  check(o.noWires < o.bip - 0.05,
    'brace: no wires, less drag (' + o.noWires.toFixed(3) + ' < ' + o.bip.toFixed(3) + ' - 0.05)');
  check(o.iStrut < o.nStrut,
    'brace: an I-strut is cleaner than an N (' + o.iStrut.toFixed(3) + ' < ' + o.nStrut.toFixed(3) + ')');
  check(o.aLower < o.aUpper,
    'brace: the sesquiplane\'s short plane flies its own lower slope (' +
    o.aLower.toFixed(2) + ' < ' + o.aUpper.toFixed(2) + ')');
  check(o.mono === 0,
    'brace: a monoplane pays nothing here (' + o.mono + ')');
}
function checkPlaque(o) {
  check(o.torun === o.roll + o.air,
    'plaque: TORun IS roll + air, no padding factor (' + o.roll + ' + ' +
    o.air + ' = ' + o.torun + ')');
  check(o.airWeak > o.air * 1.3,
    'plaque: a weak climber pays a LONGER air segment (' + o.airWeak +
    ' m vs ' + o.air + ' m)');
  check(Math.abs(o.vs - o.vsMeas) < 1e-9,
    'plaque: the displayed stall IS the measured one');
  check(Math.abs(o.vsRatio - o.vsFlap / o.vs) < 0.02,
    'plaque: Vs, VsFlap and VsRatio are one instrument (' +
    o.vsRatio.toFixed(3) + ' vs ' + (o.vsFlap / o.vs).toFixed(3) + ')');
}

// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  // a fixture that satisfies every OTHER gear check, so each probe can
  // break exactly one thing (G133 widened the surface; the old trio each
  // doctored one number against a base that now fails three new checks)
  const GEARBASE = { stockDelta: 0.001, stock: 0.05, spat: 0.03,
    fatTyres: 0.09, cantilever: 0.04, twSpatTrike: 0.04, twBareTrike: 0.06,
    twSpatTD: 0.044, legFairOnly: 0.042, dropletLong: 0.038,
    dropletShort: 0.043, spatMass: 624.5, stockMass: 620, carbonMass: 622.7 };
  const gearDoc = over => Object.assign({}, GEARBASE, over);
  const probes = [
    ['a fat gear that moved nothing', checkGear,
     gearDoc({ fatTyres: 0.051 })],
    ['a calibration quietly shifted', checkGear,
     gearDoc({ stockDelta: 0.05 })],
    ['a tailwheel spat that moves nothing (the G121.2 lie, inverted)',
     checkGear, gearDoc({ twSpatTD: 0.05 })],
    ['a leg fairing that moves nothing', checkGear,
     gearDoc({ legFairOnly: 0.0499 })],
    ['a droplet slider that moves nothing', checkGear,
     gearDoc({ dropletLong: 0.0429 })],
    ['a weightless spat', checkGear,
     gearDoc({ spatMass: 620.5 })],
    ['a surface that does nothing', checkSurface,
     { paved: 100, grass: 99, rows: 8, grassCRR: 0.05, screeCRR: 0.14,
       waterCRR: 0.35, waterBrake: 0, scree: 80, water: 30, grassStub: 99 }],
    ['a lake that reads as lawn', checkSurface,
     { paved: 110, grass: 99, rows: 8, grassCRR: 0.05, screeCRR: 0.14,
       waterCRR: 0.35, waterBrake: 0, scree: 80, water: 98, grassStub: 99 }],
    ['the home strip reading as forest', checkSurface,
     { paved: 110, grass: 82, rows: 8, grassCRR: 0.05, screeCRR: 0.14,
       waterCRR: 0.35, waterBrake: 0, scree: 70, water: 30, grassStub: 99 }],
    ['a fin still on the stab\'s AR', checkFin,
     { aFin: 3.3, aTail: 3.3, aTall: 3.4, cnStock: 0.08, cnSmall: 0.04 }],
    ['a fin slider that moves nothing', checkFin,
     { aFin: 2.6, aTail: 3.3, aTall: 3.0, cnStock: 0.08, cnSmall: 0.079 }],
    ['the padding factor sneaking back', checkPlaque,
     { torun: 396, roll: 220, air: 126, airWeak: 300, vs: 18, vsMeas: 18,
       vsFlap: 16, vsRatio: 16 / 18 }],
    ['two stall instruments again', checkPlaque,
     { torun: 346, roll: 220, air: 126, airWeak: 300, vs: 18, vsMeas: 18.7,
       vsFlap: 16, vsRatio: 16 / 18.7 }],
    ['a truss that costs nothing', checkBrace,
     { bip: 0.02, noWires: 0.01, iStrut: 0.05, nStrut: 0.06, aLower: 4.0, aUpper: 4.4, mono: 0 }],
    ['wires that cost nothing', checkBrace,
     { bip: 0.15, noWires: 0.14, iStrut: 0.05, nStrut: 0.06, aLower: 4.0, aUpper: 4.4, mono: 0 }],
    ['a second plane on the first plane\'s polar', checkBrace,
     { bip: 0.15, noWires: 0.07, iStrut: 0.05, nStrut: 0.06, aLower: 4.4, aUpper: 4.4, mono: 0 }],
    ['a monoplane charged for a truss', checkBrace,
     { bip: 0.15, noWires: 0.07, iStrut: 0.05, nStrut: 0.06, aLower: 4.0, aUpper: 4.4, mono: 0.01 }],
  ];
  let caught = 0;
  for (const [nm, fn, o] of probes) {
    const before = fails.length;
    fn(o);
    const ok = fails.length > before;
    fails.length = before;
    console.log(`  selftest ${nm.padEnd(38)} ${ok ? 'CAUGHT' : 'MISSED'}`);
    if (ok) caught++;
  }
  const pass = caught === probes.length;
  console.log('GATE HONEST: ' + (pass ? 'PASS' : 'FAIL (selftest: ' +
    (probes.length - caught) + ' missed)'));
  process.exit(pass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// measure
// ---------------------------------------------------------------------------
const axial = def => def.params.fusCdA[0];
const stockDef = buildGen();

console.log('-- S1: the undercarriage has drag --');
const genMass = def => def.params.gen.mass;
checkGear({
  stockDelta: stockDef.params.gen.gearDCdA,
  stock: axial(stockDef),
  spat: axial(buildGen({ gear: { fairing: 'full' } })),
  fatTyres: axial(buildGen({ gear: { wheelR: 0.40 } })),
  cantilever: axial(buildGen({ bracing: { type: 'cantilever' } })),
  twSpatTrike: axial(buildGen({ gear: { type: 'tricycle', twR: 0.16,
                                        twFairing: 'spat' } })),
  twBareTrike: axial(buildGen({ gear: { type: 'tricycle', twR: 0.16 } })),
  twSpatTD: axial(buildGen({ gear: { twFairing: 'spat' } })),
  // G133: the new instruments, each measured through the whole pipeline
  legFairOnly: axial(buildGen({ gear: { legFair: 'fair' } })),
  dropletLong: axial(buildGen({ gear: { fairing: 'spat', fairTail: 1.6 } })),
  dropletShort: axial(buildGen({ gear: { fairing: 'spat', fairTail: 0.7 } })),
  spatMass: genMass(buildGen({ gear: { fairing: 'spat' } })),
  stockMass: genMass(stockDef),
  carbonMass: genMass(buildGen({ gear: { fairing: 'spat',
                                         fairMat: 'carbon' } })),
});

console.log('-- S2: the ground has a surface --');
function rollDist(aeroId) {
  const world = makeWorld();
  const def = buildGen();
  const sim = makeSim(def, world); sim.reset(0);
  const rec = world.aerodromes.find(a => a.id === aeroId) ||
              world.aerodromes[0];
  placeAtAerodrome(sim, rec);
  const p0 = sim.cgPos();
  sim.ctl.thr = 1;
  for (let s = 0; s < 8 * 60; s++) sim.step(1 / 60);
  const p1 = sim.cgPos();
  return Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
}
// the off-strip classes are staged with a STUB world — flat ground of one
// declared class — because a real scree slope is a mountainside and a real
// lake has no run-up; the solver reads world.surface either way, so the
// stub exercises the same line the biome classifier feeds.
function rollOn(cls) {
  const stub = { terrainH: () => 0, surface: () => cls, treesNear: () => [] };
  const def = buildGen();
  const sim = makeSim(def, stub); sim.reset(0);
  const p0 = sim.cgPos();
  sim.ctl.thr = 1;
  for (let s2 = 0; s2 < 8 * 60; s2++) sim.step(1 / 60);
  return Math.hypot(sim.cgPos()[0] - p0[0], sim.cgPos()[2] - p0[2]);
}
const world0 = makeWorld();
const pavedRec = world0.aerodromes.find(a => a.surface === 5);
if (!pavedRec) { console.log('GATE HONEST: FAIL (no paved strip in the registry)'); process.exit(1); }
checkSurface({ grass: rollDist('HOME'), paved: rollDist(pavedRec.id),
  rows: Object.keys(GROUND_SURF).length,
  grassCRR: GROUND_SURF[0][0], screeCRR: GROUND_SURF[2][0],
  waterCRR: GROUND_SURF[4][0], waterBrake: GROUND_SURF[4][1],
  scree: rollOn(2), water: rollOn(4), grassStub: rollOn(0) });

console.log('-- S4: the fin is real --');
const tallDef = buildGen({ tail: { vHeight: 1.9 } });
const smallFin = buildGen({ tail: { Sv: stockDef.spec.tail.Sv * 0.5 } });
checkFin({
  aFin: stockDef.params.polarFin.a3d,
  aTail: stockDef.params.polarTail.a3d,
  aTall: tallDef.params.polarFin.a3d,
  cnStock: genShakedown(stockDef).cnBeta,
  cnSmall: genShakedown(smallFin).cnBeta,
});

console.log('-- S9: the truss pays (G185) --');
{
  const bipSpec = over => {
    const sp = { wings: [
      { position: 'parasol', cabaneH: 0.50, chord: 1.4, span: 9, taper: 1 },
      { position: 'low', chord: 1.4, span: 9, taper: 1, stagger: 0.35 } ],
      bracing: { type: 'cantilever', interplane: 'N', interplaneAt: 0.62, wires: 'both', cabane: 'N' } };
    if (over) over(sp);
    return sp;
  };
  const g = sp => buildGen(sp).params.gen;
  const bip = g(bipSpec()), noW = g(bipSpec(s => { s.bracing.wires = 'none'; }));
  const iS = g(bipSpec(s => { s.bracing.interplane = 'I'; s.bracing.wires = 'none'; }));
  const nS = g(bipSpec(s => { s.bracing.wires = 'none'; }));
  const sesq = buildGen(bipSpec(s => { s.wings[1].span = 6.5; s.wings[1].chord = 1.1; }));
  const PW = sesq.params.polarWings || [sesq.params.polarWing, sesq.params.polarWing];
  checkBrace({ bip: bip.braceDCdA || 0, noWires: noW.braceDCdA || 0,
               iStrut: iS.braceDCdA || 0, nStrut: nS.braceDCdA || 0,
               aLower: PW[1] ? PW[1].a3d : 0, aUpper: PW[0].a3d,
               mono: stockDef.params.gen.braceDCdA || 0 });
}

console.log('-- S7/S8: the plaque agrees with itself --');
{
  const world = makeWorld();
  const sim = makeSim(stockDef, world); sim.reset(0);
  const W = sim.totalM * 9.81;
  const r = genTORunAt(sim, stockDef, W);
  const weakDef = buildGen({ cargo: { len: 1.2, kg: 220 } });
  const sim2 = makeSim(weakDef, world); sim2.reset(0);
  const r2 = genTORunAt(sim2, weakDef, sim2.totalM * 9.81);
  // the one-instrument check runs on a FLAPPED build: GATE GEN's own
  // contract says a flapless aeroplane answers with NO VsFlap cell at all
  // (absence is the honest signal for "no device"), so the agreement of the
  // three cells is asserted where the three cells exist.
  const flapDef = buildGen({ controls: { flap: { type: 'slotted' } } });
  const sh = genShakedown(flapDef);
  checkPlaque({
    torun: r.TORun, roll: r.sRoll, air: r.air, airWeak: r2.air,
    vs: sh.Vs, vsMeas: flapDef.params.gen.VsMeas,
    vsFlap: sh.VsFlap, vsRatio: sh.VsRatio,
  });
}

if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log('GATE HONEST: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
