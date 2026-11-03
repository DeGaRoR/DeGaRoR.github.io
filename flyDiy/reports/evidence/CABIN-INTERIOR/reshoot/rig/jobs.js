// CABIN-RESHOOT job list + a small queue (node jobs.js <concurrency> [filter-regex])
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const S = path.resolve(__dirname, '..'), CODE = path.join(S, 'code/flyDiy'), B = path.join(S, 'b'), OUT = path.join(S, 'shots');
const CAB = { q34: 'cab:-125/-4/3.4', side: 'cab:-100/-4/3.6', ws: 'cab:170/2/2.4/0.25/0.05' };
const ROOF = ['in:roofHdr', 'in:roofHdrLo', 'in:roofGraze'];
const SEAT = { twin: [0.052, 0.5549, 1.8899], cub: [0, 0.6258, 1.6761], c172: [0.052, 0.7032, 1.7312] };   // AFTER's console lamp seat (headless probe)
const REAR = { twin: [0.245, 0.614, 0.946], cub: [0.037, 0.498, 0.193], c172: [0.209, 0.760, 0.775] };    // the rear roof lamp's cup top (probe)
const FRONT = { twin: [0.245, 0.621, 1.856], cub: [0.037, 0.698, 1.573], c172: [0.129, 0.770, 1.830] };   // BEFORE's front roof lamp's cup top
const IN = k => ['in:inUp', 'in:inSide', 'in:inRear', 'in:inLamp/' + SEAT[k].join('/') + '/inLamp'];
const at = (n, p) => ['in:roofAt/' + p.join('/') + '/' + n, 'in:roofAtNW/' + p.join('/') + '/' + n + 'NW'];
const J = [];
for (const k of ['twin', 'cub', 'c172']) for (const ba of ['before', 'after']) {
  J.push({ id: k + '_' + ba + '_day', builds: [k + '_' + ba + '_day'], views: [CAB.q34, CAB.side, CAB.ws, ...ROOF, ...IN(k), ...at('roofLampRear', REAR[k]), ...at('roofLampFront', FRONT[k])], qs: 'idle=0' });
  J.push({ id: k + '_' + ba + '_lamps', builds: [k + '_' + ba + '_lamps'], views: [CAB.q34, CAB.side, CAB.ws], qs: 'idle=0&day=dusk' });
  J.push({ id: k + '_' + ba + '_dusk', builds: [k + '_' + ba + '_dusk'], views: [CAB.q34, CAB.ws, ...IN(k)], qs: 'idle=0&day=dusk', extra: ['--dim', '0.12'] });
  J.push({ id: k + '_' + ba + '_skin', builds: [k + '_' + ba + '_skin'], views: [CAB.q34], qs: 'idle=0', extra: ['--body-alpha', '0.05'] });
}
for (const ba of ['before', 'after']) J.push({ id: 'twin_' + ba + '_lite', builds: ['twin_' + ba + '_lite'], views: [CAB.q34, CAB.ws], qs: 'idle=0', extra: ['--phmat', 'lite'] });
J.push({ id: 'cub_fresh', builds: ['cub_before_fresh', 'cub_after_fresh'], views: [CAB.ws], qs: 'idle=0' });
for (const c of ['can1_twin', 'can2_twin', 'can3_mosquito', 'open_tigermoth', 'sky_c172', 'sky_twin']) J.push({ id: 'canopy_' + c, builds: [c], views: [CAB.q34, 'in:inUp'], qs: 'idle=0' });
// the twin's wing runs through its cabin (ray pick, 3 Nov): the same inside views with the wing layer hidden by the rig
for (const ba of ['before', 'after']) J.push({ id: 'twin_' + ba + '_wingoff', builds: ['twin_' + ba + '_day'], views: ['in:inUpNW', 'in:inRearNW', 'in:inLampNW/' + [0.052, 0.5549, 1.8899].join('/') + '/inLampNW', 'in:inSideNW'], qs: 'idle=0' });
module.exports = J;
if (require.main === module) {
  const N = +process.argv[2] || 2, re = new RegExp(process.argv[3] || '.');
  const q = J.filter(j => re.test(j.id) && !fs.existsSync(path.join(OUT, j.id, 'DONE')));
  console.log(q.length, 'jobs:', q.map(j => j.id).join(' '));
  let run = 0; const T0 = Date.now(), LATE = (+process.argv[4] || 45) * 60000;
  // resume: a single-build job skips the views whose PNG is already there
  const fileOf = (b, v) => b + '_' + (/^in:/.test(v) ? (v.split('/').length === 5 ? v.split('/')[4] : v.slice(3).split('/')[0]) : v.replace(/[:/]/g, '-')) + '.png';
  const next = () => {
    if (!q.length || Date.now() - T0 > LATE) { if (!run) console.log(q.length ? 'BATCH OVER, ' + q.length + ' jobs left' : 'ALL DONE'); return; }
    const j = q.shift(); run++;
    const dir = path.join(OUT, j.id); fs.mkdirSync(dir, { recursive: true });
    if (j.builds.length === 1) { const left = j.views.filter(v => !fs.existsSync(path.join(dir, fileOf(j.builds[0], v)))); if (left.length < j.views.length) console.log('resume', j.id, (j.views.length - left.length) + ' done'); j.views = left; }
    if (!j.views.length) { fs.writeFileSync(path.join(dir, 'DONE'), '0'); run--; return next(); }
    const args = ['tools/plane_shot_cab.js', '--build', j.builds.map(b => path.join(B, b + '.json')).join(','), '--out', dir, '--size', '1800x1000', '--qs', j.qs, '--views', j.views.join(','), '--secs', '7000', ...(j.extra || [])];
    const log = fs.openSync(path.join(dir, 'log' + (fs.existsSync(path.join(dir, 'log.txt')) ? '_' + Date.now() : '') + '.txt'), 'w');
    const t0 = Date.now(); console.log('start', j.id);
    const p = spawn('node', args, { cwd: CODE, stdio: ['ignore', log, log] });
    p.on('exit', code => { fs.closeSync(log); fs.writeFileSync(path.join(dir, 'DONE'), String(code)); run--; console.log('end', j.id, 'exit', code, ((Date.now() - t0) / 60000).toFixed(1) + ' min'); next(); });
  };
  for (let i = 0; i < N; i++) next();
}
