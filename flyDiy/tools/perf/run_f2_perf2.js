// F2's budget, second pass: the patch noise now runs only where the density can be seen. The
// first pass measured land +0.8 ms and banks +3.3 ms at the stand against a 72.4 ms baseline.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const SP = __dirname, FD = path.resolve(__dirname, '..', '..');
const PORT = process.env.FLYDIY_PORT || '8479';
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene';
const M = "ATMO.MIST", DAY = "DAY_CLOCK.set({rh:0.90});";
const flat = n => `flat${n}=${DAY}${M}.relief=0;${M}.patch=0`;
const probes = [flat(0), `banks=${DAY}${M}.relief=1;${M}.patch=0.85;${M}.steps=6`, flat(1),
                `land=${DAY}${M}.relief=1;${M}.patch=0;${M}.steps=6`, flat(2)].join(';;');
const log = fs.openSync(path.join(SP, 'frame_perf_f2b.log'), 'w');
const p = spawn(process.execPath, ['tools/frame_perf.js', '--url', URL, '--tiers', 'full', '--places', 'stand',
  '--frames', '90', '--label', 'f2b', '--probes', probes, '--out', 'tools/perf/frame_perf_f2b.json'],
  { cwd: FD, stdio: ['ignore', log, log] });
p.on('exit', c => fs.appendFileSync(path.join(SP, 'frame_perf_f2b.log'), '\nexit ' + c + '\n'));
