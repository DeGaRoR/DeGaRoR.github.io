// A/B/A, second pass: the two probes the peer's light_shot contaminated (combo1k5, mistOff),
// plus the cloud march measured PROPERLY - the first run's clouds5 row saved nothing because
// clouds:march read 0.00 ms in all 27 rows: cover was 0, so there was no march to shorten.
// Here cover is set to 0.6 first, and `cloudsOff` / `clouds5` are scored against a CLOUDY base.
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const SP = __dirname, FD = path.resolve(__dirname, '..', '..');   // flyDiy/, from flyDiy/tools/perf/
const PORT = process.env.FLYDIY_PORT || '8479';   // node tools/_serve.js <port> <root> --fallback <main checkout>
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene';
const pre = fs.readFileSync(path.join(SP, 'fog_pre.js'), 'utf8');
const CLOUD = "DAY_CLOCK.set({cloudCover:0.6})";     // the march needs something to march through
const probes = [
  'base0=__FOG.reset()',
  'combo1k5=__FOG.reset();__FOG.far(1950);__FOG.quadsCull(1500)',
  'base1=__FOG.reset()',
  'mistOff=__FOG.reset();ATMO.MIST.on=false',
  'base2=__FOG.reset()',
  'cloudy=__FOG.reset();' + CLOUD,                    // the cloudy baseline
  'cloudy5=__FOG.reset();' + CLOUD + ';CLOUDS.S.maxKm=5',
  'cloudyBase=__FOG.reset();' + CLOUD,                // and back, to score it
].join(';;');
const log = fs.openSync(path.join(SP, 'frame_perf_fog_aba2.log'), 'w');
const args = ['tools/frame_perf.js', '--url', URL, '--tiers', 'full',
  '--places', 'stand', '--frames', '120', '--label', 'fog-aba2', '--pre', pre,
  '--eval', "JSON.stringify({cover: FLIGHT_PROBE.world().day.cloudCover, march: CLOUDS.stats.gpuMs})",
  '--out', 'tools/perf/frame_perf_fog_aba2.json', '--probes', probes];
const p = spawn(process.execPath, args, { cwd: FD, stdio: ['ignore', log, log] });
p.on('exit', c => fs.appendFileSync(path.join(SP, 'frame_perf_fog_aba2.log'), '\nexit ' + c + '\n'));
