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
        elec: { hasBus: true, altA: 20 }, extLights: ['taxi', 'beacon', 'land', 'nav'], intLights: ['flood', 'instr', 'pedal', 'pax'] });
      const D = L.dials, by = {}; for (const d of D) by[d.k] = d;
      let overlap = null;
      for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
        const p = D[i], q = D[j];
        // the compass bowl stands ON the coaming: its foot is half a radius
        // under its centre, not a whole one
        if (p.coaming || q.coaming) {
          const c = p.coaming ? p : q, o = p.coaming ? q : p;
          if (c.cy - c.r * 0.5 < o.cy + o.r - 1e-6 && Math.abs(c.cx - o.cx) < c.r + o.r) overlap = p.k + '/' + q.k;
          continue;
        }
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
      check(L.switches.length === 11 && L.switches[0].k === 'key' && L.switches.every(s => Math.abs(s.x) <= L.xLim), 'layout ' + nm + ': the switch row, key first, inside', L.switches.length);
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
  // ---- 8. SESSION 4: THE JOIN, THE FLIGHT, THE COCKPIT ---------------------
  // The snapshot is taken in the browser, so the join's contract is read
  // off its source; cockpit.js is pure enough to RUN here (three.js loads
  // in node) against a stand-in model and a stand-in sim, which is where
  // the laws, the switches, the bus, the lamps and the pick are proven.
  {
    const fs = require('fs');
    const join = fs.readFileSync(path.join(__dirname, '_cage_join.js'), 'utf8');
    check(/CAGE_PANEL\.moving\)[^\n]*\n[^\n]*kind: 'gauge'/.test(join), 'join: every CAGE_PANEL.moving part is a kind:gauge part');
    check(/lastIndexOf\('edGauge_', 0\) === 0/.test(join), 'join: edGauge_* is in the pivot walk');
    check(/kud\.panelSet \? 'G' \+ kud\.panelSet/.test(join) && /kud\.lampKey \? 'Lp'/.test(join) && /kud\.lampCup \? 'Lc'/.test(join),
      'join: the faces and each lamp\'s lens and cup are their own buckets');
    check(/ud\.panelSet \? \{ panel: ud\.panelSet \}/.test(join) && /lamp: ud\.lampKey, lampCol/.test(join) && /lampCup: ud\.lampCup, lampCol/.test(join),
      'join: the bucket records carry panel / lamp / lampCup');
    check(/m0\.userData\.panelSet \|\|/.test(join) && /m0\.userData\.propMat\)\)/.test(join), 'join: a faces bucket and a textured piece keep their uv');
    check(/out2\.ctl\.stops = stops/.test(join) && /out2\.ctl\.perSI = c\.per \/ S\.k/.test(join) && /out2\.ctl\.steps = c\.steps/.test(join),
      'join: a gauge part carries its law as a table (stops / perSI / steps)');
    check(/lights\.on = !!\+Pl\.lightOn/.test(join) && /cageM, people, lights[,\s}]/.test(join), 'join: the snapshot carries the switch positions');
    const light = fs.readFileSync(path.join(__dirname, '_cage_light.js'), 'utf8');
    check(/m\.userData\.lampKey = key; m\.userData\.lampCol = col;/.test(light) && /m\.userData\.lampCup = key;/.test(light) && /lensMat, cupMat \};/.test(light),
      'light layer: the lens and the cup say which light they are, and the factories are published');
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'app.js'), 'utf8');
    check(/m\.panel && window\.CAGE_PANEL && window\.CAGE_PANEL\.material/.test(app), 'app: a panel bucket takes the atlas material');
    check(/\(m\.lamp \|\| m\.lampCup\) && window\.CAGE_LIGHT/.test(app) && /src\.clone\(\)/.test(app), 'app: a lamp bucket takes a CLONED lens / cup');
    check(/pt\.kind === 'gauge' && pt\.ctl/.test(app) && /gauges\.push\(\{ obj: pg, c: pt\.ctl/.test(app), 'app: gauge parts build like controls, into model.gauges');
    check(/gauges, lamps, mats, meshes, data,/.test(app), 'app: the model record carries gauges, lamps, mats, meshes');
    for (const call of ['CK.bind(model', 'CK.pose(model)', 'CK.frame(1 / 60, sim, ap)', "CK.cockpitView(cam.mode === 'cockpit', model)", 'CK.pick(camera', 'CK.click(hit, e.button)'])
      check(app.includes(call), 'app: calls ' + call);
    check(/if \(cam\.mode === 'cockpit'\) \{ headCam\.enter\(\); return; \}/.test(app), 'app: rolling out into the cockpit seats the head');
    const build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
    check(/'31_elec\.js'/.test(build) && build.indexOf("'30_solver.js'") < build.indexOf("'31_elec.js'"), 'build: 31_elec.js in the core after the solver');
    check(build.indexOf("'cockpit.js'") > build.indexOf("'editor.js'") && build.indexOf("'cockpit.js'") < build.indexOf("'app.js'"), 'build: cockpit.js between editor.js and app.js');
    check(typeof C.makeBus === 'function', 'core: makeBus exported');
    // ---- cockpit.js, run ----
    const THREE = require(path.join(__dirname, '..', 'vendor', 'three.min.js'));
    const CKm = require(path.join(__dirname, '..', 'src', 'viewer', 'cockpit.js'));
    check(typeof CKm.make === 'function' && typeof CKm.interp === 'function', 'cockpit: exports make / interp');
    check(near(CKm.interp([[0, 0], [10, 90], [20, 270]], 5), 45) && near(CKm.interp([[0, 0], [10, 90]], 50), 90) && near(CKm.interp([[0, 0], [10, 90]], -5), 0),
      'cockpit: interp is piecewise linear and pegs at both ends');
    global.genSystemsResolve = C.genSystemsResolve; global.makeBus = C.makeBus; global.GEN_INSTR = C.GEN_INSTR;
    const CK = CKm.make(THREE);
    const mk = (name, c) => { const g = new THREE.Group(); g.name = name; return { obj: g, c, home: [0, 0, 0] }; };
    const stops = []; for (let i = 0; i <= 24; i++) stops.push([i * 2, i * 10]);          // 0..48 m/s -> 0..240 deg
    const AX = [1, 0, 0];
    const gauges = [
      mk('edGauge_asi_v', { law: 'lin', gauge: 'asi', hand: 'v', drive: 'ias', ax: AX, sgn: 1, stops }),
      mk('edGauge_fuel_q', { law: 'lin', gauge: 'fuel', hand: 'q', drive: 'fuelFrac', ax: AX, sgn: 1, stops: [[0, 0], [1, 90]] }),
      mk('edGauge_clock_m', { law: 'turn', gauge: 'clock', hand: 'm', drive: 'clockM', ax: AX, sgn: 1, perSI: 60 }),
      mk('edGauge_ai_ball', { law: 'ball', gauge: 'ai', drive: 'roll', ax: AX, sgn: 1, ax2: [0, 0, 1], sgn2: 1 }),
      mk('edGauge_dg_card', { law: 'card', gauge: 'dg', drive: 'hdg', ax: AX, sgn: 1 }),
      mk('edGauge_sw_nav', { law: 'switch', drive: 'sw_nav', ax: AX, sgn: 1, k: 0.42 }),
      mk('edGauge_sw_flood', { law: 'knob', drive: 'sw_flood', ax: AX, sgn: 1 }),
      mk('edGauge_key', { law: 'key', drive: 'key', ax: AX, sgn: 1, k: Math.PI / 6, steps: 5 }),
    ];
    const grp = new THREE.Group(); for (const g of gauges) grp.add(g.obj);
    gauges[5].obj.position.set(0, 0, 1);                       // the nav switch, a metre ahead of the camera
    const lensMat = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 0 });
    const lamps = [{ mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lensMat), key: 'nav', kind: 'lens' }];
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1)); body.visible = true;
    const model = { grp, gauges, lamps, mats: {}, meshes: {}, people: [{ key: 'ch1', inst: { meshes: [body] } }],
                    data: { lights: { on: true, nav: 0, beacon: 1 }, people: [{ key: 'ch1', role: 'pilot' }] } };
    const eng = [{ running: true, key: 'both', crank: 0 }];
    const sim = { out: { Veas: 0, vs: 0, roll: 0, pitch: 0, hdg: 0, r: 0, beta: 0, rpm: [0], rpmEng: [0], nz: 1 },
                  fuel: { frac: 0.8 }, eng, cgPos: () => [0, 120, 0], setEngine: (i, p) => { if (p.key) eng[i].key = p.key; if (p.key === 'off') eng[i].running = false; if (p.start) { eng[i].crank = 1; eng[i].running = true; } } };
    const spec = withSys({ fit: 'basic' });
    CK.bind(model, model.data, sim, spec, { fieldElev: 100, pilotKey: 'ch1' });
    check(CK.sw.sw_beacon === 1 && CK.sw.sw_nav === 0 && CK.sw.sw_master === 1 && CK.key === 'both', 'cockpit: the switches start where the design drew them, master on, key at BOTH');
    check(CK.bus && CK.bus.battAh === 16 && CK.bus.altA === 20, 'cockpit: the bus is the fit\'s (16 Ah, 20 A)', CK.bus && CK.bus.battAh);
    check(grp.children.filter(o => o.children.some(c => c.userData.pickPad)).length === 3, 'cockpit: a pick pad on the switch, the knob and the key, none on a hand');
    // a still aeroplane on the ground: the venturi makes no suction
    for (let i = 0; i < 300; i++) CK.frame(1 / 60, sim, { t: i / 60 });
    check(!CK.gyroOk && near(CK.readings.roll, CKm.REST.roll, 0.05), 'cockpit: below 20 m/s the venturi gyro is dead and the ball lies at rest');
    check(CK.busOk && near(CK.readings.volts, 12.7, 0.15) && CK.readings.fuelFrac > 0.7, 'cockpit: the battery carries the bus at rest; the fuel gauge reads', CK.readings.volts);
    check(near(CK.readings.alt, 20, 0.01), 'cockpit: the altimeter reads height above the field it left', CK.readings.alt);
    // in flight: the readings arrive through their lags, the alternator carries the bus
    sim.out.Veas = 30; sim.out.roll = 0.3; sim.out.hdg = Math.PI / 2; sim.out.rpm = [2200]; sim.out.rpmEng = [2200];
    for (let i = 0; i < 300; i++) CK.frame(1 / 60, sim, { t: 5 + i / 60 });
    check(CK.gyroOk && near(CK.readings.roll, 0.3, 0.01) && near(CK.readings.ias, 30, 0.1), 'cockpit: in flight the gyro erects and the readings follow');
    check(near(CK.readings.hdg, 90, 0.5), 'cockpit: heading in degrees, the nav way round', CK.readings.hdg);
    check(near(CK.readings.volts, 14.1, 0.01), 'cockpit: at cruise the alternator holds 14.1 V');
    // the pose: each law
    CK.pose(model);
    const ang = g => { const q = g.obj.quaternion; return 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), q.w) * Math.sign(q.x + q.y + q.z || 1); };
    check(near(ang(gauges[0]) * 180 / Math.PI, 150, 0.5), 'pose: a lin hand turns by its stops (30 m/s -> 150 deg)', ang(gauges[0]) * 180 / Math.PI);
    check(near(ang(gauges[1]) * 180 / Math.PI, 72, 2), 'pose: the fuel hand reads the fraction', ang(gauges[1]) * 180 / Math.PI);
    check(near(ang(gauges[4]) * 180 / Math.PI, 90, 0.5), 'pose: the DG card turns to the heading');
    check(near(ang(gauges[3]), -0.3, 0.01), 'pose: the ball rolls against the aeroplane');
    check(near(ang(gauges[5]), -0.42, 1e-6), 'pose: a switch off lies at -k');
    check(near(ang(gauges[7]) * 180 / Math.PI, 90, 1e-6), 'pose: the key at BOTH is three steps of 30 deg');
    // the click: the switch through the pick, the lamp answers at once
    const cam = new THREE.PerspectiveCamera(50, 1, 0.01, 10); cam.position.set(0, 0, 0); cam.lookAt(0, 0, 1); cam.updateMatrixWorld(true);
    grp.updateMatrixWorld(true);
    const hit = CK.pick(cam, 0, 0, model);
    check(hit && hit.c.drive === 'sw_nav', 'pick: a ray through the pad finds the switch', hit && hit.c.drive);
    check(CK.click(hit, 0) && CK.sw.sw_nav === 1 && near(lensMat.emissiveIntensity, 2.4, 1e-6), 'click: the switch goes on and its lens glows the same frame', lensMat.emissiveIntensity);
    CK.pose(model); check(near(ang(gauges[5]), 0.42, 1e-6), 'pose: ...and the bat is thrown');
    check(CK.click(hit, 0) && CK.sw.sw_nav === 0 && lensMat.emissiveIntensity === 0, 'click: again, and it is off and dark');
    check(CK.click(gauges[6], 0) && near(CK.sw.sw_flood, 0.25) && CK.click(gauges[6], 2) && near(CK.sw.sw_flood, 0), 'click: a knob steps up by a quarter, right-click steps down');
    // the key: OFF kills the engine, START cranks and springs back to BOTH
    for (let i = 0; i < 3; i++) CK.click(gauges[7], 2);
    check(CK.key === 'off' && !eng[0].running, 'key: turned back to OFF the engine stops', CK.key);
    for (let i = 0; i < 4; i++) CK.click(gauges[7], 0);
    check(CK.key === 'start' && eng[0].crank > 0, 'key: START asks the solver to crank');
    eng[0].crank = 0; CK.frame(1 / 60, sim, { t: 9 });
    check(CK.key === 'both' && CK.sw.key === 3, 'key: ...and springs back to BOTH once it catches');
    // master off: the bus dies, the electric gauge rests, the lamp is dark whatever its switch
    CK.sw.sw_nav = 1; CK.sw.sw_master = 0;
    for (let i = 0; i < 200; i++) CK.frame(1 / 60, sim, { t: 10 + i / 60 });
    check(!CK.busOk && lensMat.emissiveIntensity === 0, 'master off: a dead bus, and the nav lens is dark with its switch on');
    CK.pose(model); check(near(ang(gauges[1]), 0, 1e-6), 'master off: the electric fuel gauge lies at its rest stop');
    // the cockpit view hides the pilot and gives it back
    CK.cockpitView(true, model); check(!body.visible, 'cockpit view: the pilot\'s body is hidden');
    CK.cockpitView(false, model); check(body.visible, 'cockpit view: ...and shown again outside it');
    delete global.genSystemsResolve; delete global.makeBus; delete global.GEN_INSTR;
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
