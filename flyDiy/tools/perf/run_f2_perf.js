// F2's budget: the march is the FIRST fog term this study expects to be able to SEE in a frame
// time (FOG-MIST §3b), so it is measured the same way everything else was - A/B/A, each probe
// between two `flat` rows and scored against their mean, because a cross-probe delta minutes
// apart is not a number (§1a).
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const SP = __dirname, FD = path.resolve(__dirname, '..', '..');
const PORT = process.env.FLYDIY_PORT || '8479';
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene';
const M = "ATMO.MIST", DAY = "DAY_CLOCK.set({rh:0.90});";     // a day with mist in it, or nothing is measured
const flat = `flat%=${DAY}${M}.relief=0;${M}.patch=0`;
const probes = [
  flat.replace('%', '0'),
  `land=${DAY}${M}.relief=1;${M}.patch=0;${M}.steps=6`,
  flat.replace('%', '1'),
  `banks=${DAY}${M}.relief=1;${M}.patch=0.85;${M}.steps=6`,
  flat.replace('%', '2'),
  `banks12=${DAY}${M}.relief=1;${M}.patch=0.85;${M}.steps=12`,
  flat.replace('%', '3'),
].join(';;');
const log = fs.openSync(path.join(SP, 'frame_perf_f2.log'), 'w');
const args = ['tools/frame_perf.js', '--url', URL, '--tiers', 'full', '--places', 'stand,forest',
  '--frames', '90', '--label', 'f2', '--probes', probes, '--out', 'tools/perf/frame_perf_f2.json'];
const p = spawn(process.execPath, args, { cwd: FD, stdio: ['ignore', log, log] });
p.on('exit', c => fs.appendFileSync(path.join(SP, 'frame_perf_f2.log'), '\nexit ' + c + '\n'));
