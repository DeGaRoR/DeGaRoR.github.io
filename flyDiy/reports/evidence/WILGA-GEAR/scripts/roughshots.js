// render the host's side view with its legs posed at chosen moments of the rough-strip landing (quickshot, the garage's preview row)
process.env.CORE = '/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js';
const { host, C } = require('./host.js'); const G = C.GEAR_LEVER, fs = require('fs'), cp = require('child_process');
const def = host(0).def, LV = def.parts.lever, sd = LV.sides[0], N = def.nodes;
const L = G.gearLeverInit({ piv: [0,1,2].map(k => 0.5*(N[sd.pi].p[k]+N[sd.po].p[k])), ax: [0,0,1], w: 0.06, axle: N[sd.axle].p.slice(), horn: N[sd.h].p.slice(), top: N[sd.u].p.slice() });
const R = JSON.parse(fs.readFileSync(__dirname + '/rough.json', 'utf8')), OUT = '/tmp/claude-0/-workspace-DeGaRoR-github-io/87d1e332-cdaa-5b4d-9fd2-f5d4f14e6cc0/scratchpad/rough/';
const pick = (process.argv[2] || '0,20,30,58,100,160').split(',').map(Number);
const OV = { s1Leg: 4, s1Drop: 0.80, s1R: 0.25, s1X: 1.415, s1Z: 1.45, s1Fair: 0, s1LegFair: 0, s2Leg: 3, s2Z: 0.10, s2X: 0, s2R: 0.064, s2Fair: 0, s2LegFair: 0, s2Steer: 1 };
const meta = [];
for (const i of pick) {
  const r = R.rec[i], s = (r.sL + r.sR) / 2, ang = G.gearLeverAngOf(L, 's', Math.max(0, s), LV.geom.comp), pos = +(ang / LV.geom.comp).toFixed(3);
  const over = Object.assign({}, OV, { gearLvPos: pos });
  const o = cp.execFileSync('node', ['tools/quickshot.js', 'builds/cessna172_2026-09-20_corrected.json', OUT + 'f' + i, '--over', JSON.stringify(over), '--views', 'side', '--w', '1000'], { cwd: '/workspace/DeGaRoR.github.io/flyDiy', encoding: 'utf8' });
  const fr = /frame side: \[([^\]]+)\]/.exec(o)[1].split(',').map(Number);
  meta.push({ i, t: r.t, s, pos, frame: fr, cg: r.cg, pitch: r.pitch, axL: r.axL, axR: r.axR, tw: r.tw });
  console.log(i, r.t, 'stroke', (s*1000).toFixed(0), 'pos', pos);
}
fs.writeFileSync(OUT + 'meta.json', JSON.stringify({ A: R.A, lam: R.lam, S: R.S, meta, trace: R.rec.map(r => [r.t, r.sL, r.sR]) }));
