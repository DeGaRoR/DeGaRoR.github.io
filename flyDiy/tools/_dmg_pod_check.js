#!/usr/bin/env node
// GATE DMGPOD (G3463 / G3464, BELLY-POD-2) - THE BELLY POD WITH THE DAMAGE LAYER ON: ITS OWN BREAK GROUP, ITS SCRAPE, A
// BELLY LANDING, AND THE FREIGHT IN IT AT RISK.
//
//   node tools/_dmg_pod_check.js             -> "GATE DMGPOD: PASS|FAIL"
//   node tools/_dmg_pod_check.js --show      -> every check's line
//   node tools/_dmg_pod_check.js --selftest  -> the rules broken in their own sources (a doctored core each), each must go red
//
// A. THE PART: on every validated build with the default pod, 61_gen_frame's damage table has the group `pod:mount`
//    (anchor the body, joint 'mount') whose breaking members are exactly the pod's 16 hangers (parts.podFrame.hangers),
//    the 6 braces inside the part; no generator issue; the hangers 4130 steel sized by GEN_POD's rule (the full pod's 9 g
//    forward or the gross bearing at bearG g, the larger), the braces E-glass. No pod: no `pod` group, no DMG.pod, the
//    integrity record's keys as they were.
// B. THE BELLY LANDING (the metal Cessna, the user's; damage on; flat turf at sea level, the touchdown speed 1.1 x a
//    stall on the probe's CLmax 1.9; GEAR UP: the wheels' contact radii pulled 0.6 m into the wells - the stand-in for a
//    retracted or collapsed gear, which the generator does not model): on the wheels at 1.5 m/s the pod is never
//    touched; gear up at 1.5 m/s it is CRUSHED (members set, the group holding) and its freight AT RISK; gear up at
//    3 m/s it is TORN OFF at its fittings (the group broken, its 16 hangers) and its freight LOST - in the integrity
//    record's words (sim.damage().structural: damaged, why = the pod's own, not "the landing gear broke"). The Jodel
//    gear up at 1.5 m/s: torn off (its light gross sizes light fittings - reported). Twice the same verdict to the bit.
// C. THE SCRAPE: the record is the solver's own contact (each node's slid metres, the friction's work, its peak load);
//    the wear is work / (eAbr x the node's patch); the tiers' thresholds; a node never touched reads 0.
// D. THE FREIGHT: an item packed in the pod (76_ freightCardPod / freightPack) rides the pod's four nodes by lever (the
//    moment is the item's own); a pod torn off makes the career's stop record carry `podLost` and the carry stage NOT
//    delivered, with the reason; a pod that holds delivers as before.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest');
const clone = o => JSON.parse(JSON.stringify(o));
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function belly(C, L, LB, key, o) {
  const spec = clone(LB.loadValidated(key).spec); if (o.pod !== false) spec.pod = { on: 1 };
  const d0 = C.buildGen(spec);
  const def = Object.assign({}, d0, { params: Object.assign({}, d0.params, { damage: true }), nodes: d0.nodes.map(n => Object.assign({}, n)) });
  if (o.up) for (const i of d0.refs.mains.concat(d0.refs.tw != null && d0.refs.tw >= 0 ? [d0.refs.tw] : [])) def.nodes[i].r = -0.6;
  const { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const fwd = 1.1 * Math.sqrt(2 * sim.totalM * 9.81 / (1.225 * d0.params.gen.Sw * 1.9));
  let ymin = 1e9; for (let i = 0; i < sim.n; i++) ymin = Math.min(ymin, sim.p[i * 3 + 1]);
  const lift = 0.02 - ymin, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  for (let i = 0; i < sim.n; i++) { sim.p[i * 3 + 1] += lift; sim.v[i * 3] = fwd * fx; sim.v[i * 3 + 1] = -o.sink; sim.v[i * 3 + 2] = fwd * fz; }
  sim.ctl.thr = 0;
  let t = 0; for (let f = 0; f < 60 * (o.secs || 6); f++) { sim.step(1 / 60); t += 1 / 60; if (t > 3 && Math.hypot(sim.v[0], sim.v[2]) < 0.3) break; }
  const D = sim.damage();
  return { def: d0, sim, D, P: o.pod === false ? null : C.genPodDamage(d0, D), S: D.structural, fwd,
           sig: [D.breaks, D.yields, D.groups.map(g => g.key).join(','), D.pod ? Array.from(D.pod.work).join(',') : ''].join('|') };
}

function runChecks(C, quiet) {
  const L = require(path.join(T, '_treecrash_lib.js')), LB = require(path.join(T, '_load_build.js'));
  let checks = 0, fails = 0; const lines = [];
  const ok = (c, m) => { checks++; if (!c) { fails++; lines.push('  FAIL ' + m); } else if (SHOW && !quiet) lines.push('  ok   ' + m); return !!c; };
  const rep = s => { if (!quiet) lines.push('  ' + s); };
  const GP = C.GEN_POD, CR = C.GEN_CRASH;

  // ===== A. THE PART =====
  for (const k of ['cub', 'jodel', 'metal', 'floats']) {
    const spec = clone(LB.loadValidated(k).spec), d0 = C.buildGen(clone(spec));
    spec.pod = { on: 1 }; const d = C.buildGen(spec), F = d.parts.podFrame, R = d.parts.pod;
    const G = d.parts.dmg.groups.find(g => g.key === 'pod:mount');
    ok(!d0.parts.dmg.groups.some(g => g.part === 'pod') && !d0.parts.podFrame, k + ': no pod, no pod group and no podFrame');
    if (!ok(!!G && G.part === 'pod' && G.joint === 'mount' && G.anchor === 'body', k + ': the group pod:mount (anchor the body, joint mount)')) continue;
    ok(JSON.stringify(G.t0.slice().sort((a, b) => a - b)) === JSON.stringify(F.hangers.slice().sort((a, b) => a - b)) && !G.t1.length,
       k + ': its breaking members are exactly the 16 hangers (' + G.t0.length + ')');
    ok(F.braces.every(b => d.beams[b].grp < 0 && d.beams[b].seam === null), k + ': the 6 braces inside the part, no joint');
    ok(F.hangers.every(b => d.beams[b].seam === 'fitting'), k + ': every hanger a fitting');
    ok(!d.parts.dmg.issues.length, k + ': no generator issue in the damage table (' + d.parts.dmg.issues.join('; ') + ')');
    const gross = F.bearKg;
    const hA = Math.max(GP.mountG * 9.81 * (R.shellKg + R.maxKg) * GP.mountShare / (1.15 * CR[GP.mountMat].tu), GP.bearG * 9.81 * gross / 16 / CR[GP.mountMat].cy);
    ok(F.hangers.every(b => d.beams[b].mat === GP.mountMat && Math.abs(d.beams[b].A / hA - 1) < 0.02), k + ': the hangers 4130 at ' + (hA * 1e6).toFixed(1) + ' mm2 (the larger of the 9 g forward and the ' + GP.bearG + ' g bearing of ' + gross.toFixed(0) + ' kg)');
    ok(F.braces.every(b => d.beams[b].mat === GP.shellMat && d.beams[b].A > 0), k + ': the braces E-glass');
  }

  // ===== B. THE BELLY LANDING =====
  const rDown = belly(C, L, LB, 'metal', { sink: 1.5, up: false });
  const rUp15 = belly(C, L, LB, 'metal', { sink: 1.5, up: true });
  const rUp30 = belly(C, L, LB, 'metal', { sink: 3.0, up: true });
  const rUp30b = belly(C, L, LB, 'metal', { sink: 3.0, up: true });
  const rJ = belly(C, L, LB, 'jodel', { sink: 1.5, up: true });
  const rNone = belly(C, L, LB, 'metal', { sink: 1.5, up: true, pod: false });
  const fmt = (lab, r) => lab + ': ' + r.P.state + ', freight ' + r.P.freight + ' - slid ' + Math.max(...r.P.slide).toFixed(1) + ' m, worn ' + (r.P.wornMax * 1000).toFixed(2) + ' mm, members set ' + r.P.members.set + ' / broken ' + r.P.members.broken + ' of ' + r.P.members.of + ', groups [' + r.D.groups.map(g => g.key).join(', ') + '], peak loads ' + Array.from(r.D.pod.fnPeak).map(v => (v / 1000).toFixed(1)).join(' / ') + ' kN; structural: ' + (r.S.damaged ? 'DAMAGED - ' + r.S.why : 'whole');
  rep('-- belly landings, damage on (touchdown ' + rUp15.fwd.toFixed(1) + ' m/s on turf) --');
  rep(fmt('metal Cessna on its wheels, 1.5 m/s', rDown));
  rep(fmt('metal Cessna gear up, 1.5 m/s', rUp15));
  rep(fmt('metal Cessna gear up, 3.0 m/s', rUp30));
  rep(fmt('the Jodel gear up, 1.5 m/s', rJ));
  ok(rDown.P.state === 'clean' && !rDown.P.touched && !rDown.S.damaged, 'on its wheels at 1.5 m/s: the pod never touched, the aeroplane whole');
  ok(rUp15.P.state === 'crushed' && rUp15.P.freight === 'at risk' && !rUp15.P.torn && rUp15.P.members.set > 0, 'gear up at 1.5 m/s: CRUSHED, its freight at risk, the fittings holding');
  ok(rUp15.S.damaged && rUp15.S.pod && /belly pod crushed/.test(rUp15.S.why || ''), 'gear up at 1.5 m/s: the integrity record says the pod (' + rUp15.S.why + ')');
  ok(rUp30.P.state === 'torn off' && rUp30.P.freight === 'lost' && rUp30.D.groups.some(g => g.key === 'pod:mount') && rUp30.P.members.broken >= 16,
     'gear up at 3 m/s: TORN OFF at its fittings (the group, its 16 hangers), its freight lost');
  ok(rUp30.S.damaged && /belly pod torn off/.test(rUp30.S.why || '') && !/landing gear/.test(rUp30.S.why || ''), 'gear up at 3 m/s: the record\'s words are the pod\'s, never "the landing gear broke" (' + rUp30.S.why + ')');
  ok(rUp30.sig === rUp30b.sig && JSON.stringify(rUp30.P) === JSON.stringify(rUp30b.P), 'twice the same landing, the same verdict to the bit');
  ok(rJ.P.state === 'torn off', 'the Jodel gear up at 1.5 m/s: torn off (its light gross sizes light fittings)');
  ok(!('pod' in rNone.D) && JSON.stringify(Object.keys(rNone.S)) === JSON.stringify(['damaged', 'broken', 'separated', 'why']), 'no pod: no DMG.pod, the integrity record\'s keys as they were');

  // ===== C. THE SCRAPE =====
  {
    const P = rUp15.P, R = rUp15.def.parts.pod, patch = (R.xb - R.xa) * 2 * R.hw / 4;
    ok(Math.abs(P.patch - patch) < 1e-12, 'the patch is a quarter of the floor (' + patch.toFixed(4) + ' m2)');
    ok(P.worn.every((w, k) => Math.abs(w - P.work[k] / (C.GEN_POD_DMG.eAbr * patch)) < 1e-15), 'the wear is the friction work over eAbr x the patch');
    ok(P.slide.some(v => v > 0) && P.work.every((w, k) => (P.slide[k] > 0) === (w > 0)), 'the touched nodes slid and did work; the others nothing');
    const D0 = { pod: { slide: [0, 0, 0, 0], work: [0, 0, 0, 0], fnPeak: [0, 0, 0, 0], tFirst: -1 }, broken: [], groups: [], wB: new Float64Array(rUp15.def.beams.length) };
    const tier = w => { const D = clone(D0); D.wB = D0.wB; D.pod.work[2] = w * C.GEN_POD_DMG.eAbr * patch; D.pod.slide[2] = 1; return C.genPodDamage(rUp15.def, D).state; };
    ok(tier(0) === 'scuffed' && tier(0.0004) === 'scuffed' && tier(0.0006) === 'ground' && tier(0.0021) === 'holed' && C.genPodDamage(rUp15.def, D0).state === 'clean',
       'the tiers at their bounds: scuffed under ' + C.GEN_POD_DMG.scuff * 1000 + ' mm, ground under ' + C.GEN_POD_DMG.skin * 1000 + ' mm, holed past it, clean untouched');
    ok(C.genPodDamage(rUp15.def, Object.assign(clone(D0), { wB: D0.wB, pod: Object.assign(clone(D0.pod), { work: [0, 0, 0.0021 * C.GEN_POD_DMG.eAbr * patch, 0], slide: [0, 0, 1, 0] }) })).freight === 'at risk', 'holed: its freight at risk');
  }

  // ===== D. THE FREIGHT =====
  {
    const env = JSON.parse(rd('tools/fixtures/cessnaMetal_pod_2026-10-22.json'));
    const def = C.buildGen(C.genMigrateSpec(env.spec)), card = C.freightCardPod(C.FREIGHT_CARDS.c172, def, 0.4);
    const items = [{ id: 'skibag', kind: 'long', kg: 9, dims: [1.0, 0.25, 0.1] }, { id: 'flat1', kind: 'box', kg: 20, dims: [0.5, 0.4, 0.15] }].concat(C.freightItems({ kg: 240 }, 'goods.parts'));
    const P = C.freightPack(card, items, { pax: 1 }), inPod = P.placed.filter(p => p.space === 'pod');
    ok(inPod.length > 0, 'the packer puts what the cabin cannot take within its limits into the pod (' + inPod.map(p => p.id).join(', ') + ')');
    const rec = C.freightLoadRecord(card, { v: 1, card: card.id, pax: 1, seatsOut: [], items: C.freightSplit(items), placed: P.placed });
    const R = C.freightStrapAdds(def, C.freightAccepted(rec), { yD: 0.4, card }), PN = def.parts.podFrame.nodes;
    let m = 0, mx = 0, mz = 0; for (const [i, kg] of R.adds) if (PN.includes(i)) { m += kg; mx += kg * def.nodes[i].p[0]; mz += kg * def.nodes[i].p[2]; }
    const want = inPod.reduce((a, p) => a + p.kg, 0), wx = inPod.reduce((a, p) => a + p.kg * 0.5 * (p.at.x0 + p.at.x1), 0);
    ok(Math.abs(m - want) < 1e-9 && Math.abs(mx - wx) < 1e-6, 'the pod\'s items ride its four nodes, their mass and moment their own (' + m.toFixed(1) + ' kg at ' + (mx / Math.max(1e-9, m)).toFixed(3) + ' m)');
    const items2 = C.freightStopItems(rec, null);
    ok(items2.some(p => p.space === 'pod'), 'the stop items say which rode in the pod');
    const base = { how: 'stopped', aero: 'X', slot: 's', occupants: 1, items: items2, row: { from: 'A', to: 'X', t: 60 } };
    const sLost = C.careerStopRecord(Object.assign({}, base, { structural: { damaged: true, why: 'belly pod torn off', podFreight: 'lost' } }));
    const sHeld = C.careerStopRecord(Object.assign({}, base, { structural: { damaged: true, why: 'belly pod crushed', podFreight: 'at risk' } }));
    const sNone = C.careerStopRecord(Object.assign({}, base, { structural: { damaged: false, why: null } }));
    ok(sLost.structural.podLost === Math.round(want * 1000) / 1000 && !('podLost' in sHeld.structural) && !('podLost' in sNone.structural),
       'a torn-off pod: the stop record carries podLost (' + sLost.structural.podLost + ' kg); held or none: no key');
    ok(/G3464/.test(rd('src/core/73_contracts.js')) && /S\.podLost > 0\) return \{ st: 'no'/.test(rd('src/core/73_contracts.js')), 'the carry stage is not delivered when the pod\'s freight was lost (73_contracts)');
    ok(/podFreight: S\.pod\.freight/.test(rd('src/viewer/app.js')), 'the page hands the pod\'s freight verdict to the stop record (app.js careerStructural)');
  }
  // the drawn pod rides its own nodes in a wreck (the page's binding, by source: the box verifies it on screen)
  ok(/sec === 'pod'\) \{[\s\S]{0,400}E\.fixed = podN\.map/.test(rd('src/viewer/app.js')), 'the drawn pod rides its four nodes once something breaks (app.js brkInhStep: a rigid binding on podFrame.nodes)');
  return { checks, fails, lines };
}

// ---- selftest: doctored cores ----
const DOCTORS = [
  ['the pod a part of the body', 'src/core/61_gen_frame.js', "    if (t === 'POD') return { p: 'pod', r: 4, base: 'pod' };", ''],
  ['the fittings at the gear tube\'s section', 'src/core/61_gen_frame.js', 'const b0 = beams.length, KM = { noMass: true, kMul: GP.mountK, cMul: 0.1, A: hA }', 'const b0 = beams.length, KM = { noMass: true, kMul: GP.mountK, cMul: 0.1 }'],
  ['the scrape not recorded', 'src/core/30_solver.js', 'P4.work[k] += kf * sp * sp * dt;', 'P4.work[k] += 0;'],
  ['the pod\'s words lost to the gear\'s', 'src/core/30_solver.js', '(podBad && (!fp || PODM.has(fp.beam))) ? pod.say', '(podBad && !fp) ? pod.say'],
  ['the wear ten times slower', 'src/core/60d_gen_pod.js', 'worn[k] = S.work[k] / (GEN_POD_DMG.eAbr * patch);', 'worn[k] = S.work[k] / (10 * GEN_POD_DMG.eAbr * patch);'],
  ['the pod\'s freight on the rings', 'src/core/78_freight_strap.js', "    if (p.space === 'pod' && def.parts.podFrame && def.parts.pod) {", '    if (false) {'],
];
function main() {
  const t0 = Date.now();
  if (SELF) {
    let caught = 0;
    for (const [name, file, from, to] of DOCTORS) {
      const r = cp.spawnSync(process.execPath, [__filename, '--doctor', JSON.stringify([file, from, to])], { encoding: 'utf8', maxBuffer: 1 << 26 });
      const red = /GATE DMGPOD: FAIL/.test(r.stdout);
      if (red) caught++;
      console.log('  ' + (red ? 'caught ' : 'MISSED ') + name);
    }
    console.log('  ' + caught + ' of ' + DOCTORS.length + ' caught');
    console.log('GATE DMGPOD: ' + (caught === DOCTORS.length ? 'PASS' : 'FAIL'));
    process.exitCode = caught === DOCTORS.length ? 0 : 1;
    return;
  }
  const di = argv.indexOf('--doctor');
  let C;
  if (di >= 0) {
    // the built core with one rule broken (GATE POD's way: the generated text, doctored, loaded through FLYDIY_CORE)
    const [, from, to] = JSON.parse(argv[di + 1]);
    const base = fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8');
    if (!base.includes(from)) { console.log('  the anchor is gone: ' + from); console.log('GATE DMGPOD: PASS'); return; }
    const tmp = path.join(os.tmpdir(), 'dmgpod_core_' + process.pid + '.js');
    fs.writeFileSync(tmp, base.split(from).join(to));
    process.env.FLYDIY_CORE = tmp;
    C = require(path.join(T, '_treecrash_lib.js')).core();
  } else C = require(path.join(T, '_treecrash_lib.js')).core();
  const r = runChecks(C, di >= 0);
  for (const l of r.lines) console.log(l);
  console.log('  ' + r.checks + ' checks, ' + r.fails + ' failed (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  console.log('GATE DMGPOD: ' + (r.fails ? 'FAIL' : 'PASS'));
  process.exitCode = r.fails ? 1 : 0;
}
main();
