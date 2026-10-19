// ap_smooth_probe.js (G3300, AP-ADAPT) - ONE LEG IN THE GAME'S FLIGHT, every 0.1 s: tools/_tour_lib.js gameHost (the
// worker's host and placement, DAY_CLOCK's day ticked - the 8 kt breeze and its gusts -, the page's pilot with the
// shakedown, the load door's aeroplane). Writes the samples (--json) and prints the smoothness line.
//   node tools/ap_smooth_probe.js --build <file.json|cub|c172> [--order HOME,w3] [--calm] [--damage 0|1] [--profile club|student|..]
//        [--json out.json] [--max 900] [--terrain]
// --damage: 0 by default, the game's (GEN_DAMAGE_DEFAULT false; the page's ?damage=1 turns it on). --profile: the pilot's
// persona (43 PILOT_PROFILES; the career's hired pilot is one), the expert by default
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
process.chdir(ROOT);
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(process.env.PILOT_CORE || path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const B = TR.BUILDS[opt('build', 'cub')] || { key: path.resolve(opt('build')) };
const order = opt('order', 'HOME,w3').split(',');
const def = TR.defOf(C, PT, B.key);
def.params = Object.assign({}, def.params, { damage: opt('damage', '0') === '1' });
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const a = A(order[0]), b = A(order[1]);
const H = TR.gameHost(C, W, def, a, b, { day: argv.includes('--calm') ? null : undefined, damage: def.params.damage, profile: opt('profile') });   // (G3300: gameHost hands the persona to sim_host's pilot.profile, as the page's mkPilot does)
const SM = require(path.join(T, '_ap_smooth_lib.js'));
const R = SM.flyAndMeasure(H, { max: +opt('max', 900), terrain: argv.includes('--terrain') ? (x, z) => W.terrainH(x, z) : null });   // (G3304: --terrain, legAlt's look recomputed)
R.build = path.basename(B.key); R.damage = def.params.damage; R.profile = opt('profile', 'expert'); R.order = order.join(','); R.day = argv.includes('--calm') ? 'calm' : 'game';
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(R));
delete R.rows;
console.log(JSON.stringify(R));
