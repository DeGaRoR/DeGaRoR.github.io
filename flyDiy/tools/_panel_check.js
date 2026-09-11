#!/usr/bin/env node
// GATE PANEL — the panel arc's verdict, growing with the arc.
//
//   node tools/_panel_check.js             -> "GATE PANEL: PASS|FAIL"
//   node tools/_panel_check.js --selftest  -> negative verification
//   node tools/_panel_check.js --show      -> print the bills
//
// SESSION 2 (2026-09-11) SCOPE: THE FIT AS A LIST. What is protected, and
// how each failure would read if nothing said so:
//   - a catalogue row with no mass, no price or no power class bills a free
//     instrument (the G3 rule: nothing on the aeroplane is free)
//   - a tier that names a key the catalogue lost quietly fits fewer dials
//   - an electric dial on a build with no battery is DEAD, not cheaper — the
//     resolver must drop it and say why, never bill it
//   - the ledger must bill EXACTLY the resolver's rows (panel + elec +
//     avionics), on the nodes the fit sits on, or the two keepers drift
//   - a v8 save (`systems: {fit}` alone) must resolve to the same fit a
//     fresh default does — the section grew, no field changed home
//   - the aerials read the itemised radios: a custom fit with a COM grows its
//     blade, a minimal one carries none
//   - the Instruments part's door is real (GATE PARTS §8 also checks it)
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));

const SELFTEST = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');
const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};
const cl = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const withSys = sy => C.resolveSpec(Object.assign(cl(C.GEN_DEFAULT), { systems: sy })).spec;

function run() {
  fail.length = 0;
  const { GEN_INSTR: I, GEN_ELEC: E, GEN_AVIONICS: A, GEN_SYSTEMS: T } = C;

  // ---- 1. THE CATALOGUES ---------------------------------------------------
  for (const [k, r] of Object.entries(I)) {
    check(typeof r.name === 'string' && r.name, 'instr ' + k + ' has a name');
    check(r.kg > 0 && r.price > 0, 'instr ' + k + ' weighs and costs something',
      r.kg + ' kg ' + r.price + ' cr');
    check(['none', 'elec', 'vac'].includes(r.power), 'instr ' + k + ' declares its power class');
    check(r.d === 0 || (r.d >= 0.05 && r.d <= 0.09), 'instr ' + k + ' has a real cut-out or none', r.d);
    if (r.power === 'elec') check(r.amps >= 0, 'instr ' + k + ' draws amps');
  }
  for (const [g, tab] of Object.entries(E)) {
    if (g === 'harness') { check(E.harness.kg > 0 && E.harness.price > 0, 'the harness weighs and costs'); continue; }
    check(!!tab.none && tab.none.kg === 0 && tab.none.price === 0, 'elec ' + g + ' has a free `none`');
    for (const [k, r] of Object.entries(tab)) if (k !== 'none')
      check(r.kg > 0 && r.price > 0, 'elec ' + g + ':' + k + ' weighs and costs');
  }
  check(E.battery.lead.Ah > 0 && E.battery.lithium.Ah > 0, 'batteries carry Ah');
  check(E.alternator.gen20.A === 20 && E.alternator.alt60.A === 60, 'alternators carry amps');
  for (const [g, tab] of Object.entries(A)) {
    check(!!tab.none && tab.none.kg === 0 && tab.none.price === 0, 'avionics ' + g + ' has a free `none`');
    for (const [k, r] of Object.entries(tab)) if (k !== 'none')
      check(r.kg > 0 && r.price > 0 && r.amps > 0, 'avionics ' + g + ':' + k + ' weighs, costs and draws');
  }
  for (const [t, row] of Object.entries(T)) {
    if (row.items) for (const k of row.items) check(!!I[k], 'tier ' + t + ' names a real dial', k);
    for (const [g, v] of Object.entries(row.elec)) check(!!E[g][v], 'tier ' + t + ' elec ' + g + ' is real', v);
    for (const [g, v] of Object.entries(row.avionics)) check(!!A[g][v], 'tier ' + t + ' avionics ' + g + ' is real', v);
  }
  check(T.custom.items === null, 'the custom tier derives nothing itself');

  // ---- 2. THE RESOLVER ------------------------------------------------------
  const rMin = C.genSystemsResolve({ systems: { fit: 'minimal' } });
  const rBas = C.genSystemsResolve({ systems: { fit: 'basic' } });
  const rIfr = C.genSystemsResolve({ systems: { fit: 'ifr' } });
  if (SHOW) for (const [n, r] of [['minimal', rMin], ['basic', rBas], ['ifr', rIfr]]) {
    console.log('  ' + n + ': ' + r.items.length + ' dials · ' + r.kg.toFixed(1) + ' kg · ' + r.price + ' cr' +
      (r.hasBus ? ' · bus ' + r.loads.reduce((a, l) => a + l.amps, 0).toFixed(2) + ' A' : ' · no bus'));
    for (const x of r.rows) console.log('     ' + x.group.padEnd(9) + x.name.padEnd(34) + x.kg.toFixed(2).padStart(6) + ' kg' + String(x.price).padStart(6) + ' cr');
  }
  check(!rMin.hasBus && rMin.loads.length === 0 && rMin.dropped.length === 0,
    'minimal: no electrics, nothing dropped');
  check(rMin.kg < rBas.kg && rBas.kg < rIfr.kg && rMin.price < rBas.price && rBas.price < rIfr.price,
    'the tiers order by mass and price', [rMin, rBas, rIfr].map(r => r.kg.toFixed(1)).join(' < '));
  check(rBas.items.includes('ai') && rBas.items.includes('clock') && rBas.items.includes('tacho') &&
        rBas.items.includes('fuel') && rBas.items.includes('compass') && rBas.items.includes('vsi'),
    'basic carries the user\'s minimum set');
  check(rIfr.avionics.xpdr === 'modeS' && rIfr.avionics.com === 'compact', 'ifr carries the radios');
  // a dead instrument is dropped, named, and never billed
  const rDead = C.genSystemsResolve({ systems: { fit: 'minimal', items: ['asi', 'turn', 'ai', 'dg', 'fuel'] } });
  check(rDead.items.length === 1 && rDead.items[0] === 'asi', 'minimal + electric/vacuum dials fits only the asi');
  check(rDead.dropped.length === 4 && rDead.dropped.every(d => /no (battery|suction)/.test(d.why)),
    'the dropped dials say why', JSON.stringify(rDead.dropped));
  check(near(rDead.kg, I.asi.kg) && rDead.price === I.asi.price, 'dropped dials bill nothing');
  // a venturi feeds the gyros, a battery the rest
  const rFed = C.genSystemsResolve({ systems: { fit: 'minimal', items: ['asi', 'turn', 'ai'],
    elec: { battery: 'lead', vac: 'venturi' } } });
  check(rFed.items.length === 3 && rFed.dropped.length === 0 && rFed.hasBus, 'a battery and a venturi feed them');
  check(rFed.rows.some(r => r.key === 'harness'), 'a bus brings its harness');
  // a radio on a build with no battery is dropped too
  const rRad = C.genSystemsResolve({ systems: { fit: 'minimal', avionics: { com: 'compact' } } });
  check(rRad.avionics.com === 'none' && rRad.dropped.some(d => d.key === 'com'), 'a radio with no bus is dropped');
  // the fuel gauge bills a sender per tank
  const two = { systems: { fit: 'basic' }, energy: { vessels: [{ bay: 'nose', capacity: 30 }, { bay: 'wing', capacity: 30 }] } };
  const rTwo = C.genSystemsResolve(two);
  const fuelRow = k => k.rows.find(r => r.key === 'fuel');
  check(near(fuelRow(rTwo).kg - fuelRow(rBas).kg, I.fuel.perTank.kg), 'two tanks, two senders');
  // dedupe and unknown keys
  const rDup = C.genSystemsResolve({ systems: { fit: 'custom', items: ['asi', 'asi', 'nope', 'alt'] } });
  check(rDup.items.join() === 'asi,alt', 'a list is deduped and unknown keys are ignored');
  // units and side
  check(C.genSystemsResolve({ systems: { fit: 'basic', units: 'metric', side: 'centre' } }).units === 'metric',
    'units per build');
  check(C.genSystemsResolve({ systems: { fit: 'basic', units: 'furlongs' } }).units === 'aviation',
    'unknown units fall back');

  // ---- 3. THE SPEC: defaults, clamp, the old shape --------------------------
  const S0 = C.resolveSpec(cl(C.GEN_DEFAULT)).spec;
  check(S0.systems.fit === 'basic' && S0.systems.items === null && S0.systems.elec.battery === null,
    'the default spec derives its fit from the tier (nulls kept)');
  const old = Object.assign(cl(C.GEN_DEFAULT), { systems: { fit: 'ifr' } });
  const rOld = C.genSystemsResolve(C.resolveSpec(old).spec);
  check(JSON.stringify(rOld.items) === JSON.stringify(rIfr.items) && near(rOld.kg, rIfr.kg),
    'a v8-shaped save (fit alone) resolves to the tier exactly');
  const cust = withSys({ fit: 'custom' });
  check(Array.isArray(cust.systems.items) && cust.systems.items.length === T.basic.items.length,
    'a custom fit with no list is handed the basic one');
  const bad = withSys({ fit: 'custom', items: ['asi', 'zzz', 'asi'], units: 'x', side: 'y',
    elec: { battery: 'plutonium' }, avionics: { com: 'shortwave' } });
  check(bad.systems.items.join() === 'asi' && bad.systems.units === 'aviation' && bad.systems.side === 'pilot' &&
        bad.systems.elec.battery === null && bad.systems.avionics.com === null,
    'clampSpec cleans a wild systems section', JSON.stringify(bad.systems));

  // ---- 4. THE LEDGER bills the resolver's rows, where the fit sits ----------
  const build = sy => C.buildGen(withSys(sy));
  for (const [t, r] of [['minimal', rMin], ['basic', rBas], ['ifr', rIfr]]) {
    const d = build({ fit: t }), L = d.parts.ledger;
    const kg = (L.panel ? L.panel.mass : 0) + (L.elec ? L.elec.mass : 0) + (L.avionics ? L.avionics.mass : 0);
    const cr = (L.panel ? L.panel.cost : 0) + (L.elec ? L.elec.cost : 0) + (L.avionics ? L.avionics.cost : 0);
    check(near(kg, r.kg, 1e-6) && near(cr, r.price, 1e-6),
      'ledger ' + t + ': panel + elec + avionics = the resolver\'s bill',
      kg.toFixed(3) + ' vs ' + r.kg.toFixed(3) + ' kg, ' + cr + ' vs ' + r.price);
    check(!L.systems, 'ledger ' + t + ': the old lump is gone');
    check(!(L.panel && L.panel.payload) && !(L.elec && L.elec.payload), 'ledger ' + t + ': the fit is empty weight');
  }
  // the battery sits low on the firewall: its kilos land on the S0BL/S0BR nodes
  // (to 50 g: the gear is placed by the CG, and a heavier firewall moves a leg
  // root's share of member mass by a few grams)
  {
    const dN = build({ fit: 'minimal' }), dB = build({ fit: 'minimal', elec: { battery: 'lead' } });
    const at = (d, tag) => { const i = d.nodes.findIndex(n => n.tag === tag); return i < 0 ? null : d.nodes[i].m; };
    const dBL = at(dB, 'S0BL') - at(dN, 'S0BL'), dTL = at(dB, 'S0TL') - at(dN, 'S0TL');
    check(dBL != null && near(dBL, 0.5 * E.battery.lead.kg, 0.05),
      'the battery\'s kilos land on the firewall\'s lower pair', dBL);
    check(dTL != null && near(dTL, 0.5 * E.harness.kg, 0.05),
      'and the harness alone on the top pair', dTL);
  }
  // an unchanged spec answers differently than before: PHYSICS_V says so
  check(C.PHYSICS_V >= 3, 'PHYSICS_V was bumped for the itemised ledger');

  // ---- 5. THE AERIALS read the radios ----------------------------------------
  const needs = sy => C.genAccessNeeds(withSys(sy));
  const list = sy => C.genAccessList(needs(sy)).map(f => f.key);
  check(needs({ fit: 'minimal' }).avionics.com === false && !list({ fit: 'minimal' }).includes('commAerial'),
    'minimal: no COM, no comm aerial');
  check(list({ fit: 'basic' }).includes('commAerial') && !list({ fit: 'basic' }).includes('xpdrAerial'),
    'basic: a comm aerial and no transponder blade');
  check(list({ fit: 'ifr' }).includes('xpdrAerial') && list({ fit: 'ifr' }).includes('navAerial'),
    'ifr: the transponder blade and the nav aerial');
  check(list({ fit: 'minimal', elec: { battery: 'lead' }, avionics: { xpdr: 'modeS' } }).includes('xpdrAerial'),
    'a custom minimal with a transponder grows its blade');
  check(!list({ fit: 'minimal', avionics: { xpdr: 'modeS' } }).includes('xpdrAerial'),
    '...but not without a battery (the transponder is dropped)');

  // ---- 6. THE PART'S DOOR ---------------------------------------------------
  {
    const fs = require('fs');
    const parts = fs.readFileSync(path.join(__dirname, '_cage_parts.js'), 'utf8');
    check(/key: 'instruments'[\s\S]{0,200}panel: 'CAGE_PANEL'/.test(parts), 'the Instruments part names CAGE_PANEL');
    const layer = fs.readFileSync(path.join(__dirname, '_cage_panel.js'), 'utf8');
    check(/window\.CAGE_PANEL = \{\s*panel: /.test(layer), 'CAGE_PANEL exports its panel first');
    const lists = ['_cage8.html', 'build.js', '_parts_check.js'].map(f =>
      fs.readFileSync(path.join(__dirname, f), 'utf8').includes('_cage_panel.js'));
    check(lists.every(Boolean), 'the layer is in the three lists', lists.join());
  }

  // ---- 7. SESSION 3: THE FACES, THE LAWS, THE LAYOUT, THE MIRROR RULE -----
  // _panel_gen.js is pure and loads here; what it says a needle does and
  // where a dial sits is what the layer draws and what session 4 turns.
  {
    const G = require(path.join(__dirname, '_panel_gen.js'));
    const facts = { Vs0: 15, Vs1: 17.5, Vh: 45, Vfe: 27, Vne: 56, rpm: 2300 };
    for (const units of ['aviation', 'metric']) {
      for (const [k, F] of Object.entries(G.FACES)) {
        const S = G.scaleOf(k, units, facts);
        check(S.max > S.min && S.sweep > 0 && S.sweep <= 360, 'face ' + k + ' has a scale', units);
        for (const H of F.hands) {
          if (H.law === 'lin') {
            const lo = S.dead != null ? S.dead : S.min;
            const aLo = G.angleOf(k, H, lo / S.k, units, facts), aHi = G.angleOf(k, H, S.max / S.k, units, facts);
            check(Math.abs(aHi - (S.a0 + S.sweep)) < 1e-6, 'law ' + k + '.' + H.name + ': the max sits at the end of the sweep', units + ' ' + aHi);
            check(aHi > aLo, 'law ' + k + '.' + H.name + ': clockwise with the reading', units);
            let prev = -1e9, mono = true;
            for (let i = 0; i <= 20; i++) { const a = G.angleOf(k, H, (S.min + (S.max - S.min) * i / 20) / S.k, units, facts); if (a < prev - 1e-9) mono = false; prev = a; }
            check(mono, 'law ' + k + '.' + H.name + ': monotone', units);
            check(G.angleOf(k, H, (S.max / S.k) * 1.5, units, facts) <= S.a0 + S.sweep * 1.02 + 1e-9, 'law ' + k + '.' + H.name + ': a reading past the scale stops at the peg', units);
          }
          if (H.law === 'turn') {
            check(Math.abs(G.angleOf(k, H, 0, units, facts)) < 1e-9, 'law ' + k + '.' + H.name + ': zero at 12 o\'clock', units);
            check(Math.abs(G.angleOf(k, H, (H.per / S.k) * 0.25, units, facts) - 90) < 1e-6, 'law ' + k + '.' + H.name + ': a quarter period is 3 o\'clock', units);
            check(Math.abs(G.angleOf(k, H, (H.per / S.k) * 1.25, units, facts) - 90) < 1e-6, 'law ' + k + '.' + H.name + ': and wraps', units);
          }
          check(!H.drive || typeof H.drive === 'string', 'hand ' + k + '.' + H.name + ' names its drive');
        }
      }
    }
    // the ASI: the arcs sit where the aeroplane's numbers are, in order
    const Sa = G.scaleOf('asi', 'aviation', facts);
    check(Sa.arcs.length === 4, 'asi: white, green, yellow arcs and the red line', Sa.arcs.length);
    check(Math.abs(Sa.arcs[1].from - facts.Vs1 * Sa.k) < 1e-9 && Math.abs(Sa.arcs[1].to - facts.Vh * Sa.k) < 1e-9, 'asi: the green arc is Vs1..Vh');
    check(Sa.max >= facts.Vne * Sa.k * 1.05, 'asi: the scale runs past Vne', Sa.max);
    // the tacho's red line is the rated speed
    const St = G.scaleOf('tacho', 'aviation', facts);
    check(St.arcs.some(a => a.col === '#e8332a' && a.from < 2300 && a.to > 2300), 'tacho: the red line straddles the rated rpm');
    // the mirror rule: the pilot's LEFT (cage +x) is the LEFT of the picture
    // (small u); up is up (large v)
    const uL = G.faceUV(0, 0.02, 0, 0, 0, 0.08)[0], uR = G.faceUV(0, -0.02, 0, 0, 0, 0.08)[0];
    check(uL < uR, 'mirror rule: cage +x (port, the pilot\'s left) reads at small u', uL + ' vs ' + uR);
    const vUp = G.faceUV(0, 0, 0.02, 0, 0, 0.08)[1], vDn = G.faceUV(0, 0, -0.02, 0, 0, 0.08)[1];
    check(vUp > vDn, 'mirror rule: up is up');
    // the layout: the standard T on three cabins, nothing overlapping, all
    // inside, the compass on the coaming, the switches along the bottom
    const A = (halfW, top, lip) => ({ dashTop: top, dashLip: lip, dashAftZ: 2.0, zDash: 2.0, halfW, floorAt: () => 0 });
    const full = ['asi', 'alt', 'vsi', 'aiE', 'turn', 'dg', 'compass', 'clock', 'tacho', 'oilP', 'oilT', 'fuel', 'volts', 'hobbs'];
    for (const [nm, a, px] of [['cub', A(0.55, 0.86, 0.52), 0], ['wide', A(0.75, 0.90, 0.50), 0.30], ['narrow', A(0.40, 0.80, 0.60), 0]]) {
      const L = G.layout(a, { items: full, side: 'pilot', pilotX: px, radios: ['com', 'xpdr'],
        elec: { hasBus: true, altA: 20 }, extLights: ['taxi', 'beacon', 'land', 'nav'], intLights: ['flood', 'instr', 'panel', 'pedal', 'pax'] });
      const D = L.dials, by = {}; for (const d of D) by[d.k] = d;
      let overlap = null;
      for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
        const p = D[i], q = D[j];
        if (Math.hypot(p.cx - q.cx, p.cy - q.cy) < p.r + q.r - 1e-6) overlap = p.k + '/' + q.k;
      }
      check(!overlap, 'layout ' + nm + ': no two dials overlap', overlap);
      check(D.every(d => Math.abs(d.cx) + d.r <= L.xLim + 1e-6), 'layout ' + nm + ': every dial inside the panel');
      check(D.filter(d => !d.coaming).every(d => d.cy + d.r <= a.dashTop + 1e-6 && d.cy - d.r >= a.dashLip - 1e-6), 'layout ' + nm + ': every dial inside the band');
      if (by.asi && by.aiE && by.alt) check(by.asi.cx > by.aiE.cx && by.aiE.cx > by.alt.cx && Math.abs(by.asi.cy - by.alt.cy) < 1e-9,
        'layout ' + nm + ': the T — ASI at the pilot\'s left of the AI, the altimeter at its right, one row');
      if (by.dg && by.aiE) check(Math.abs(by.dg.cx - by.aiE.cx) < 1e-9 && by.dg.cy < by.aiE.cy, 'layout ' + nm + ': the DG under the AI');
      if (by.vsi && by.alt) check(Math.abs(by.vsi.cx - by.alt.cx) < 1e-9 && by.vsi.cy < by.alt.cy, 'layout ' + nm + ': the VSI under the altimeter');
      if (by.compass) check(by.compass.coaming && by.compass.cy > a.dashTop, 'layout ' + nm + ': the compass on the coaming');
      check(L.switches.length === 12 && L.switches[0].k === 'key' && L.switches.every(s => Math.abs(s.x) <= L.xLim), 'layout ' + nm + ': the switch row, key first, inside', L.switches.length);
      check(L.switches.every(s => s.y < Math.min(...D.filter(d => !d.coaming).map(d => d.cy - d.r)) + 1e-9), 'layout ' + nm + ': the switches under the dials');
      check(D.length + L.overflow.length >= full.length - 1, 'layout ' + nm + ': every dial placed or reported (' + L.overflow.join(',') + ')');
    }
    // the painters write only: a no-op context (UISMOKE's) must not throw
    const noop = new Proxy({}, { get: () => () => noop, set: () => true });
    let threw = null;
    try {
      G.paintAtlas(noop, Object.keys(G.PAINT).map((p, i) => ({ key: p, slot: i, painter: p, wide: p === 'compassStrip' ? 4 : 1 })), 'aviation', facts);
    } catch (e) { threw = e; }
    check(!threw, 'painters run against a no-op context (the UISMOKE contract)', threw && threw.message);
    // the layer's material table matches aeroskin's hardware row both ways
    const fs = require('fs');
    const layer = fs.readFileSync(path.join(__dirname, '_cage_panel.js'), 'utf8');
    const skin = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'aeroskin.js'), 'utf8');
    const mat = (layer.match(/const MAT = \{([\s\S]*?)\n\};/) || [])[1] || '';
    const names = [...mat.matchAll(/^\s{2}([a-z]+):/gm)].map(m => m[1]);
    const hard = (skin.match(/\n  panel: \{([\s\S]*?)\},/) || [])[1] || '';
    check(names.length >= 10 && names.every(n => new RegExp('\\b' + n + ':').test(hard)), 'every panel material has an AERO_HARD.panel row', names.filter(n => !new RegExp('\\b' + n + ':').test(hard)).join(','));
    check(/face: null/.test(hard), 'the atlas face takes no finish');
    // the crew delegates, the light layer leaves the switches, the editor
    // maps the names, the instrument light is real
    const crew = fs.readFileSync(path.join(__dirname, '_cage_crew.js'), 'utf8');
    check(/window\.CAGE_PANEL\.build\(group, A, P, pilot\.x\)/.test(crew), 'the crew layer delegates the panel to CAGE_PANEL.build');
    const light = fs.readFileSync(path.join(__dirname, '_cage_light.js'), 'utf8');
    check(/CAGE_PANEL\.switches\)\) buildSwitches/.test(light), 'the light layer leaves the switch row to the panel');
    check(/instr: \{[^}]*byPanel: true/.test(light) && !/instr: \{[^}]*later: true/.test(light), 'the instrument light is real (byPanel), not deferred');
    const ed = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'editor.js'), 'utf8');
    check(/\^edGauge\|\^edPanel\/, 'instruments'/.test(ed), 'the editor maps edGauge_* to the Instruments part');
    check(/edGauge_' \+ d\.k \+ '_' \+ H\.name/.test(layer) && /'edGauge_sw_' \+ key/.test(layer) && /'edGauge_key'/.test(layer),
      'every hand, switch and the key is a named edGauge_* group');
  }
  return fail.length === 0;
}

let ok = run();
if (SELFTEST) {
  // (a) a free instrument: the catalogue check must catch it
  const p0 = C.GEN_INSTR.clock.price; C.GEN_INSTR.clock.price = 0;
  const a = !run(); C.GEN_INSTR.clock.price = p0;
  // (b) a tier naming a dial that does not exist
  C.GEN_SYSTEMS.basic.items.push('ghost');
  const b = !run(); C.GEN_SYSTEMS.basic.items.pop();
  ok = run();
  console.log('selftest: free instrument ' + (a ? 'caught' : 'MISSED') + ', ghost dial ' + (b ? 'caught' : 'MISSED'));
  if (!a || !b) ok = false;
}
if (!ok) for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE PANEL: ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
