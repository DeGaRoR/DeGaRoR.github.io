// F1's saving, A/B/A: the contract ON against OFF on a thick day at the stand (a LOW eye, which
// is where it bites - from above the lid the ridges stand clear and the contract correctly hides
// nothing, FOG-MIST §1f).
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const SP = __dirname, FD = path.resolve(__dirname, '..', '..');
const PORT = process.env.FLYDIY_PORT || '8479';
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene';
const FOG = "DAY_CLOCK.set({rh:0.98});ATMO.MIST.k=4;";
const off = n => `off${n}=${FOG}WORLD.vis.on=false;WORLD.vis.release()`;
const probes = [off(0), `on=${FOG}WORLD.vis.on=true`, off(1), `on2=${FOG}WORLD.vis.on=true`, off(2)].join(';;');
const log = fs.openSync(path.join(SP, 'frame_perf_f1.log'), 'w');
const p = spawn(process.execPath, ['tools/frame_perf.js', '--url', URL, '--tiers', 'full', '--places', 'stand',
  '--frames', '90', '--label', 'f1', '--probes', probes, '--out', 'tools/perf/frame_perf_f1.json',
  '--eval', "JSON.stringify({visM:Math.round(WORLD.vis.visM),hid:WORLD.vis.nHidden})"],
  { cwd: FD, stdio: ['ignore', log, log] });
p.on('exit', c => fs.appendFileSync(path.join(SP, 'frame_perf_f1.log'), '\nexit ' + c + '\n'));
