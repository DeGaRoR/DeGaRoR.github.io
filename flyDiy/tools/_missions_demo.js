#!/usr/bin/env node
// ============================================================================
// THE DEMO PACK (MISSIONS-P1/P2) — writes src/missions/demo_p1.json: one mission
// per new runtime piece, on Jolene between HOME and Ridgeback Strip (w3), for the
// local session that draws P1 (the props, the shutter, the markers) to fly them:
//   demo.gates   a speed run: two balloon gates timed (medals), a ring, land at w3
//   demo.rally   a rally on an embedded route: checkpoints + splits DERIVED here
//   demo.photo   a photo over a point (an AGL band), Kate's line; land at HOME
//   demo.order   an aircraft order: the size (their Field shed), preferences, sold
//   demo.client  an order on the client's own Cub (startFrom), handed back
//   demo.rules   a carry under the failure rules (crash / injury / freight / damage)
//   demo.bush    park on a tie-down spot at w3, wait there, Adam's line
// The pack is GATE MISSIONS'd like every pack (it validates, installs whole).
//   node tools/_missions_demo.js            write the pack
//   node tools/_missions_demo.js --check    exit 1 when the file differs from a fresh one
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { loadMissions } = require('./_missions_lib.js');
const M = loadMissions();
const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'fleet_spots_pack.js'), 'utf8'), { window: w });
const SPOTS = w.FLEET_SPOTS_PACK.aero;
const t = s => ({ t: s, draft: true });
const base = { provider: 'clients', rep: { provider: 'clients', gain: 0.5 } };
const gate = (x, z, alt) => ({ gate: [[x - 60, z], [x + 60, z]], alt: { max: alt, ref: 'agl' }, prop: 'balloons', dir: 349 });
const rally = M.missionRallyDerive(Object.assign({ id: 'demo.rally', kind: 'challenge', title: 'ms.demo.rally.title', brief: 'ms.demo.rally.brief', client: 'adam',
  legs: [], route: { v: 1, id: 'demo-rally', name: 'Demo rally', end: 'home', margin: 60, pts: [
    { x: -300, z: -900, alt: 300, ref: 'msl', V: null }, { x: 900, z: -1700, alt: 350, ref: 'msl', V: null },
    { x: 1500, z: -3200, alt: 350, ref: 'msl', V: null }, { x: 300, z: -3600, alt: 250, ref: 'msl', V: null }] },
  rally: { refKmh: 160, r: 300 }, pay: { base: 2600, bonus: [{ crit: 'medal', by: 'gold', pct: 50 }] } }, base));
rally.legs.push({ steps: [{ do: 'land', place: 'HOME' }] });
rally.timers[0].medals = [{ medal: 'gold', le: rally.timers[0].target }, { medal: 'silver', le: Math.round(rally.timers[0].target * 1.2) }];
const pack = {
  what: 'flydiy-missions', v: 1, id: 'demo_p1', title: 'ms.demo.title',
  campaigns: [{ id: 'demo', title: 'ms.demo.title', provider: 'clients', order: 'any', chapters: [
    { id: 'demo.speed', title: 'ms.demo.speed', order: 'seq', missions: ['demo.gates', 'demo.rally'] },
    { id: 'demo.misc', title: 'ms.demo.misc', order: 'any', missions: ['demo.photo', 'demo.order', 'demo.client', 'demo.rules', 'demo.bush'] }] }],
  missions: [
    Object.assign({ id: 'demo.gates', kind: 'challenge', title: 'ms.demo.gates.title', brief: 'ms.demo.gates.brief', client: 'adam',
      legs: [{ order: 'seq', steps: [
        { id: 'g1', do: 'pass', place: gate(-441, -500, 150) },
        { id: 'g2', do: 'pass', place: gate(-636, -1500, 150) },
        { id: 'r1', do: 'pass', place: { ring: [-734, 120, -2000], r: 10, dir: 349, prop: 'donut' } },
        { do: 'land', place: 'w3', say: { who: 'adam', text: 'ms.demo.gates.say' } }] }],
      timers: [{ id: 'speed', start: 'g1', stop: 'g2', target: { refKmh: 160 }, medals: [{ medal: 'gold', le: 25 }, { medal: 'silver', le: 32 }, { medal: 'bronze', le: 40 }] }],
      rules: { crash: 'fail', injury: 'fail', damage: 'assess' },
      pay: { base: 2200, bonus: [{ crit: 'medal', by: 'gold', pct: 100 }, { crit: 'medal', by: 'silver', pct: 50 }] } }, base),
    Object.assign(rally, { needs: { after: ['demo.gates'] } }),
    Object.assign({ id: 'demo.photo', kind: 'contract', title: 'ms.demo.photo.title', brief: 'ms.demo.photo.brief', client: 'kate',
      legs: [{ steps: [{ id: 'shot', do: 'photo', place: { pt: [200, -1200], r: 250, alt: { min: 100, max: 500, ref: 'agl' } }, say: { who: 'kate', text: 'ms.demo.photo.say' } },
                       { do: 'land', place: 'HOME' }] }],
      pay: { base: 1400 } }, base),
    Object.assign({ id: 'demo.order', kind: 'build', title: 'ms.demo.order.title', brief: 'ms.demo.order.brief', client: 'adam',
      legs: [{ steps: [{ do: 'deliver', place: 'HOME', require: { plane: [
        { k: 'seats', op: '>=', v: 2 }, { k: 'spanM', op: '<=', v: 10.5 }, { k: 'heightM', op: '<=', v: 2.6 }, { k: 'lengthM', op: '<=', v: 7.5 },
        { k: 'fitsShed', op: '==', v: 'field' }, { k: 'toDistM', op: '<=', v: 250, at: { pax: 1 } }] } }] }],
      prefs: [{ k: 'engines', v: 1, need: 'mandatory' }, { k: 'gear', v: 'taildragger', need: 'bonus', pct: 10 }],
      pay: { base: 42000 }, followUp: { prefer: ['heightM'] } }, base),
    Object.assign({ id: 'demo.client', kind: 'build', title: 'ms.demo.client.title', brief: 'ms.demo.client.brief', client: 'adam', startFrom: 'cub',
      legs: [{ steps: [{ do: 'deliver', place: 'HOME', require: { plane: [{ k: 'seats', op: '>=', v: 2 }, { k: 'tasKmh', op: '>=', v: 120, at: { pax: 1, kg: 0 } }] } }] }],
      pay: { base: 18000 } }, base),
    Object.assign({ id: 'demo.rules', kind: 'contract', title: 'ms.demo.rules.title', brief: 'ms.demo.rules.brief', client: 'adam',
      legs: [{ steps: [{ do: 'carry', from: 'HOME', place: 'w3', load: { kg: 25, pax: ['david'] } }] }],
      rules: { crash: 'fail', injury: { fail: 'Light injuries' }, freight: 'fail', damage: 'assess' },
      pay: { base: 1800 } }, base),
    Object.assign({ id: 'demo.bush', kind: 'contract', title: 'ms.demo.bush.title', brief: 'ms.demo.bush.brief', client: 'adam',
      legs: [{ steps: [{ do: 'land', place: 'w3' }] },
             { order: 'seq', steps: [{ do: 'park', place: { spot: 'w3:' + SPOTS.w3[0][3] } }, { do: 'wait', place: 'w3', require: { waitMin: 30 } },
                                     { do: 'talk', place: 'w3', say: { who: 'adam', text: 'ms.demo.bush.say' } }] }],
      pay: { base: 1200 } }, base),
  ],
  sites: [],
  text: {
    'ms.demo.title': t('Demo missions (P1/P2)'), 'ms.demo.speed': t('Speed'), 'ms.demo.misc': t('The rest'),
    'ms.demo.gates.title': t('Between the balloons'), 'ms.demo.gates.brief': t('Two gates on the way to Ridgeback Strip, timed, then the ring. Low: 150 m at most.'),
    'ms.demo.gates.say': t('That was quick. Again?'),
    'ms.demo.rally.title': t('The demo rally'), 'ms.demo.rally.brief': t('Coordinates and split times only. Back home after the last.'),
    'ms.demo.photo.title': t('A picture of the hill'), 'ms.demo.photo.brief': t('Over the hill, between 100 and 500 m above it: the shutter does the rest.'),
    'ms.demo.photo.say': t('Got it - that one goes on the wall.'),
    'ms.demo.order.title': t('One for the field shed'), 'ms.demo.order.brief': t('Two seats, short take-off, and it has to fit my shed: 14 x 18 m, a 3.6 m eave.'),
    'ct.demo.order.follow': t('It fits. Could the next one be lower?'),
    'ms.demo.client.title': t('Make my old plane faster'), 'ms.demo.client.brief': t('Here is my old plane. 120 km/h with a passenger, then bring it back.'),
    'ct.demo.client.follow': t('Faster still?'),
    'ms.demo.rules.title': t('Careful with David'), 'ms.demo.rules.brief': t('David and his gear to Ridgeback Strip. Not a scratch on either.'),
    'ms.demo.bush.title': t('Wait for me'), 'ms.demo.bush.brief': t('Land at Ridgeback, tie down on the first spot, wait half an hour.'),
    'ms.demo.bush.say': t('Thanks for waiting. Let us go.'),
  },
};
const why = M.missionPackValidate(pack, { spots: SPOTS });
if (why.length) { console.error('the demo pack does not validate:\n  ' + why.join('\n  ')); process.exit(1); }
const out = path.join(ROOT, 'src', 'missions', 'demo_p1.json'), txt = JSON.stringify(pack, null, 1) + '\n';
if (process.argv.includes('--check')) { const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === txt; console.log(same ? 'demo_p1.json = fresh' : 'demo_p1.json differs'); process.exit(same ? 0 : 1); }
fs.writeFileSync(out, txt);
console.log('wrote ' + path.relative(ROOT, out) + ': ' + pack.missions.length + ' missions; the rally\'s target ' + rally.timers[0].target + ' s over ' + rally.legs[0].steps.length + ' checkpoints');
