// A/B/A: the fog study's headline numbers, each comparison LOCAL IN TIME.
// Why: in the 27-row run the same workload read 33.5 and 42.9 ms twenty minutes apart
// (the card settles from boost under sustained load, and the rig's own Chrome saturates
// it). A cross-probe delta taken minutes apart is not a number. Here every probe sits
// between two `base` rows and is scored against their MEAN.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const SP = __dirname, FD = path.resolve(__dirname, '..', '..');   // flyDiy/, from flyDiy/tools/perf/
const PORT = process.env.FLYDIY_PORT || '8479';   // node tools/_serve.js <port> <root> --fallback <main checkout>
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene';
const pre = fs.readFileSync(path.join(SP, 'fog_pre.js'), 'utf8');
const B = 'base%=__FOG.reset()';
const probes = [
  B.replace('%', '0'),
  'far1k5=__FOG.reset();__FOG.far(1500)',
  B.replace('%', '1'),
  'quads1k5=__FOG.reset();__FOG.quadsCull(1500)',
  B.replace('%', '2'),
  'combo1k5=__FOG.reset();__FOG.far(1950);__FOG.quadsCull(1500);CLOUDS.S.maxKm=2',
  B.replace('%', '3'),
  'mistOff=__FOG.reset();ATMO.MIST.on=false',
  B.replace('%', '4'),
].join(';;');
const log = fs.openSync(path.join(SP, 'frame_perf_fog_aba.log'), 'w');
const args = ['tools/frame_perf.js', '--url', URL, '--tiers', 'full',
  '--places', 'stand', '--frames', '120', '--label', 'fog-aba', '--pre', pre,
  '--out', 'tools/perf/frame_perf_fog_aba.json', '--probes', probes];
const p = spawn(process.execPath, args, { cwd: FD, stdio: ['ignore', log, log] });
p.on('exit', c => fs.appendFileSync(path.join(SP, 'frame_perf_fog_aba.log'), '\nexit ' + c + '\n'));
