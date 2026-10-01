#!/usr/bin/env node
// tank_seed_ab.js - WHAT THE GAME FLEW BEFORE AND AFTER THE LIFTED SEEDING (G1109, CUB-COCKPIT 2026-10-01)
//
// Before G1109 the energy layer seeded an EMPTY vessel list with its own
// default (one 45 L nose tank), drew it, and on the first layout WROTE IT BACK
// into the spec - so the game flew that list. Now it seeds the resolved
// spec's lifted list (fuel.litres + fuel.tank, the core's genEnergyLift), the
// list the headless flight gates always flew. Per card, both seedings laid
// out as the game does (the joined card, game mode, the crew loaded):
//   the vessel list the layer leaves (what it writes back: bay, litres,
//   station), the fuel mass and the CG the aeroplane is built with from that
//   list (buildGen + genShakedown: full-tanks CG, % MAC), and whether a tank
//   is DRAWN and flown (the fit's ok; G1108 does not fly an unfit one).
// One card a process (the layers' state carries across builds: G1106.2).
//
//   node tools/tank_seed_ab.js [--only cub,caravan] [--json out.json] [--jobs 3]
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const T = __dirname;
if (!argv.includes('--child')) {
  const { spawn } = require('child_process'); const os = require('os');
  const keys = opt('only') ? opt('only').split(',') : require(path.join(T, '_bake_joined.js')).loadPanel().D.ARCHETYPES.map(a => a.key);
  const out = new Array(keys.length); let next = 0;
  const one = () => new Promise(res => {
    const i = next++; if (i >= keys.length) return res(false);
    const jf = path.join(os.tmpdir(), 'seedab_' + keys[i] + '.json');
    const ch = spawn(process.execPath, ['--max-old-space-size=4096', __filename, '--child', '--only', keys[i], '--json', jf], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; ch.stdout.on('data', d => log += d); ch.stderr.on('data', d => log += d);
    ch.on('close', code => {
      let j = null; try { j = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch (e) {}
      out[i] = j || { key: keys[i], error: 'exit ' + code + ' ' + log.split('\n').slice(-2).join(' | ') };
      const f = s => s ? s.vessels.map(v => v.bay + ' ' + v.capacity + ' L' + (v.drawn ? ' drawn' : ' not drawn')).join(' + ') + ', fuel ' + s.fuelKg + ' kg, CG ' + s.cgPct + ' %MAC' : '-';
      console.log('  ' + keys[i].padEnd(14) + (j ? 'before: ' + f(j.before) + '  |  now: ' + f(j.now) + '  |  CG ' + j.dCg_mm + ' mm' : out[i].error));
      res(true);
    });
  });
  const lane = async () => { while (await one()) {} };
  Promise.all(Array.from({ length: +opt('jobs', 3) }, lane)).then(() => { if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1)); });
  return;
}
const SH = require(path.join(T, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                 '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(T, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();
const X = SH.context(); const W = X.ctx; SH.stubCanvas(); console.error = () => {};
const key = opt('only');
const card = D.ARCHETYPES.find(a => a.key === key);
const birth = C.genNormaliseSpec(D.designBake(card.sel, card.over));
const E = W.CAGE_ENERGY;
const lay = seedSpec => {
  // the game: the layer seeded, the card joined, laid out in game mode
  E.fromSpec(birth.energy, seedSpec);
  const spec = BJ.bakeCard(key).spec;
  const def = C.buildGen(spec);
  E.fromSpec(birth.energy, seedSpec);
  SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
  const res = E.results() || [];
  const vessels = E.EN.vessels.map(v => { const r = res.find(q => q.v === v);
    return { bay: v.bay, capacity: +(+v.capacity).toFixed(1), along: v.along, lv: v.lv, dims: v.dims || null, drawn: !!(r && r.ok) }; });
  // the aeroplane built with THAT list (what the game flies once it is written back)
  const S = JSON.parse(JSON.stringify(birth));
  S.energy = Object.assign({}, S.energy, { vessels: E.EN.vessels.map(v => JSON.parse(JSON.stringify(v))) });
  if (E.EN.kind !== 'battery') S.fuel = Object.assign({}, S.fuel, { litres: vessels.reduce((s, v) => s + v.capacity, 0) });
  const d = C.buildGen(S), sh = C.genShakedown(d);
  const dry = C.genShakedown(C.buildGen(C.genSpecAtFuel(d.spec, 0)), { slim: true });
  const full = sh.envelope && sh.envelope.corners && sh.envelope.corners[0];
  const xLE = full && full.cgPct != null && sh.cBar > 0 ? full.cgX - full.cgPct * sh.cBar : null;
  return { vessels, fuelKg: +(sh.mass - dry.mass).toFixed(1), cgX: sh.cgX, cgPct: xLE == null ? null : +((sh.cgX - xLE) / sh.cBar * 100).toFixed(1),
           endH: sh.enduranceCruiseH == null ? null : +sh.enduranceCruiseH.toFixed(2) };
};
const before = lay(null);      // the old seeding: an empty list became the layer's own default
const now = lay(birth);        // the lifted seeding
fs.writeFileSync(opt('json'), JSON.stringify({ key, emptyList: !((birth.energy && birth.energy.vessels) || []).length, before, now,
  dCg_mm: +((now.cgX - before.cgX) * 1000).toFixed(0) }, null, 1));
