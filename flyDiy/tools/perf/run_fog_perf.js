// detached runner: spawns frame_perf.js with an args ARRAY (no shell quoting), logs to frame_perf_fog.log
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const SP = __dirname, FD = path.resolve(__dirname, '..', '..');   // flyDiy/, from flyDiy/tools/perf/
const PORT = process.env.FLYDIY_PORT || '8479';   // node tools/_serve.js <port> <root> --fallback <main checkout>
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene';
const pre = fs.readFileSync(path.join(SP, 'fog_pre.js'), 'utf8');
const probes = [
  'base=__FOG.reset()',
  'mistOff=__FOG.reset();ATMO.MIST.on=false',
  'apOff=__FOG.reset();__FOG.apOff()',
  'far3k=__FOG.reset();__FOG.far(3000)',
  'far1k5=__FOG.reset();__FOG.far(1500)',
  'quads1k5=__FOG.reset();__FOG.quadsCull(1500)',
  'clouds5=__FOG.reset();CLOUDS.S.maxKm=5',
  'combo3k=__FOG.reset();__FOG.far(3900);__FOG.quadsCull(3000);CLOUDS.S.maxKm=4',
  'combo1k5=__FOG.reset();__FOG.far(1950);__FOG.quadsCull(1500);CLOUDS.S.maxKm=2',
].join(';;');
const log = fs.openSync(path.join(SP, 'frame_perf_fog.log'), 'w');
const args = ['tools/frame_perf.js', '--url', URL, '--tiers', 'full', '--places', 'stand,forest,sea',
  '--frames', '120', '--quiet', '--quiet-max', '40', '--label', 'fog-study', '--pre', pre, '--eval', '__FOG.count()', '--out', 'tools/perf/frame_perf_fog.json', '--probes', probes];
const p = spawn(process.execPath, args, { cwd: FD, stdio: ['ignore', log, log] });
p.on('exit', c => { fs.appendFileSync(path.join(SP, 'frame_perf_fog.log'), '\nexit ' + c + '\n'); });
