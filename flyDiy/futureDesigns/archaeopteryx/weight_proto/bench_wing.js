// bench_wing.js <flyDiy> <keys> [wingMat] : designBake the card, swap every wing to wingMat, certify, then the
// garage's destroy bench (ramp to 3 x ultimate): the g the first part lets go, which part; the wing's mass; W0
const path = require('path'), R = path.resolve(process.argv[2]), T = R + '/tools/';
const BJ = require(T + '_bake_joined.js'), LB = require(T + '_load_build.js'), C = require(T + 'flight_core.js');
const BW = require(path.join(R, 'src', 'viewer', 'bench_worker.js'));
const { D } = BJ.loadPanel();
const mat = process.argv[4] || null;
for (const key of process.argv[3].split(',')) {
  try {
    const A = D.ARCHETYPES.find(x => x.key === key);
    const over = { cage: Object.assign({}, A.over && A.over.cage), spec: Object.assign({}, A.over && A.over.spec) };
    const s0 = D.designBake(Object.assign({}, A.sel), over);
    const sp = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
    if (mat) for (const w of sp.wings) w.material = mat;
    const def0 = C.buildGen(JSON.parse(JSON.stringify(sp)));
    const cert = C.genCertify(def0, {});
    // PROTOTYPE: a construction built for RATED kg is certified as if its aeroplane weighed that - its members (and so
    // their fittings) stamped at min(1, RATED / W0) of this aeroplane's own limit loads
    const RATED = +(process.env.PT_RATED || 0), W0c = def0.parts.gauge && def0.parts.gauge.W0;
    if (RATED > 0 && mat) { const f = Math.min(1, RATED / W0c); let n = 0;
      def0.beams.forEach((b, i) => { if (b.sec === 'wings') { cert.Ft[i] *= f; cert.Fc[i] *= f; n++; } });
      process.stdout.write('[rated ' + RATED + ' kg: ' + n + ' wing members x' + f.toFixed(2) + '] '); }
    const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: true }), cert });
    const sim = C.makeSim(def, null); sim.reset(0);
    const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, def.spec, { destroy: true });
    cfg.ult = 3 * C.GEN_LOAD_ULT; cfg.rampS = 4 * cfg.ult / C.GEN_LOAD_ULT; cfg.surface = 'wing';
    const rig = C.makeLoadTest(sim, def, cfg);
    for (let f = 0; f < 60 * 120 && !rig.state.done; f++) rig.step(1 / 60);
    const st = rig.state, Dm = sim.damage(), fb = Dm.firstBreak, b = fb ? sim.beams[fb.beam] : null;
    const W0 = def0.parts.gauge && def0.parts.gauge.W0;
    console.log((key + (mat ? '+' + mat : '')).padEnd(22), 'W0', W0 ? W0.toFixed(0) : '-', 'kg | wing', def0.parts.ledger.wings.mass.toFixed(1), 'kg, gauge',
      (def0.parts.gauge.wing || 0).toFixed(2), '|', st.verdict, '| first to go:', st.brokeKey || '-', fb ? '(' + fb.cls + ' ' + def.nodes[b.a].tag + '-' + def.nodes[b.b].tag + ', ' + fb.how + ')' : '');
  } catch (e) { console.log(key, 'ERR', e.message.slice(0, 160)); }
}
