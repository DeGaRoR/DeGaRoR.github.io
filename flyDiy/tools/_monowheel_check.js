#!/usr/bin/env node
// GATE MONOWHEEL (the Archaeopteryx study's stage 1, futureDesigns/archaeopteryx/CONFIG_STUDY.md section 4) - THE SINGLE
// WHEEL, THE WINGTIP SKID, THE NOSE SKID.
//
// The user (11 Nov 2026): "a true single-wheel gear type, we will reuse it on other gliders"; "can't it be just a new
// wingtip type?" then "do the skid under any tip type. It's better"; "the front has a skid not a wheel".
//
//   node tools/_monowheel_check.js            -> "GATE MONOWHEEL: PASS|FAIL"
//   node tools/_monowheel_check.js --show     -> every probe's record
//
// A. THE SPEC: gear.mono is a flag on a wheeled gear (taildragger / tricycle) - kept there, gone on floats or a hull and
//    when false; a monowheel drops the retraction and the trailing link (both are built per side). The wingtip skid
//    (wings[0].tipSkid) clamps to GEN_TIP_SKID.h, goes when 0, never rides the second plane. A two-wheel build carries
//    neither key (its spec and def are what they were).
// B. THE FRAME: one axle node ('AXLEC') on the centreline, refs.mains holding it once, no degenerate member, one wheel
//    billed (lighter and cheaper than the pair, the same gear otherwise); the skids: one shoe a side (refs.skids),
//    mirrored, at genTipSkidZ's station, its contact h under the drawn skin - the drawn hoop's lowest point (the wing
//    payload's pitot group) within 5 mm of the shoe's contact.
// C. THE CERT: the ground loads exist on one main (genCertGroundLoads: the side load, the braked roll, the tail or nose
//    cases), and a monowheel's drag counts one wheel.
// D. THE MOTOR GLIDER ON ONE WHEEL AND A TAIL SKID (the motorglider card, Undercarriage > Monowheel, the third unit's
//    spring back at the tail): parked it settles on the wheel, the tail skid and ONE wingtip skid - nothing else of the
//    aeroplane on the ground; the take-off roll reaches 25 m/s without a crash; the autopilot flies HOME's circuit from
//    the line-up and stops.
// E. THE NOSE SKID (the Undercarriage tile's Monowheel as it comes: the spring at the nose, the Skid row): the join
//    measures a tricycle on one wheel, the nose unit flies the skid's law (params.twMode 4), and parked it settles on
//    the wheel, the nose skid and one wingtip skid.
// F. THE EDITOR: the tile reads 'mono' on a centreline main; leaving it for a pair brings the pair's half track back.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const SHOW = process.argv.includes('--show');
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const r3 = v => Math.round(v * 1000) / 1000;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'monowheel-'));

const { D } = BJ.loadPanel();
// a card born as the shed births it (designBake + the load door), the Undercarriage tile's Monowheel laid on, and any
// cage rows over it - the resolved, joined spec
function born(key, cage, sel) {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: Object.assign({}, A.over && A.over.spec) };
  const s0 = D.designBake(Object.assign({}, A.sel, sel || {}), over);
  const r = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 });
  return { spec: r.spec, errors: r.errors || [], bake: s0 };
}
const flat = () => ({ terrainH: () => 0, waterH: () => -1e9, surface: () => 0, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } });
// parked on a flat field from the stance, `secs` s: every node on the ground (its contact at the drawn surface: r less
// the standoff), by tag
function park(def, secs) {
  const sim = C.makeSim(def, flat());
  sim.reset(0); if (sim.stance) sim.stance();
  for (let f = 0; f < 60 * secs; f++) sim.step(1 / 60);
  const down = [];
  for (let i = 0; i < def.nodes.length; i++) {
    const y = sim.p[i * 3 + 1] - (def.nodes[i].r - (def.nodes[i].so || 0));
    if (y < 0.012) down.push(i);
  }
  return { sim, down };
}
function probe(args) {
  return new Promise(res => {
    const p = spawn(process.execPath, [path.join(T, 'tw_probe.js'), ...args], { cwd: path.join(T, '..') });
    let out = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', () => {});
    p.on('close', () => {
      const recs = out.split('\n').filter(l => l.startsWith('{')).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
      res(Object.fromEntries(recs.map(r => [r.case, r])));
    });
  });
}

(async () => {
  const t0 = Date.now();
  const MONO = { gearLayout: 'mono' };
  // the motor glider on one wheel ahead of its CG and a tail skid (a sailplane's gear): the Monowheel tile, the third
  // unit's spring back at the tail, the wheel at the taildragger's station
  const mgT = born('motorglider', { s2Nose: 0, s2Z: 0.06, s1Z: 2.0 }, MONO);
  const fT = path.join(TMP, 'mg_mono_tail.json');
  fs.writeFileSync(fT, JSON.stringify({ name: 'motorglider monowheel', spec: mgT.spec }));
  const jobs = probe(['--build', fT, '--case', 'roll,circuit']);

  console.log('A. THE SPEC');
  { const cs = g => { const x = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); Object.assign(x.gear, g); return C.clampSpec(x).gear; };
    const td = cs({ type: 'taildragger', mono: true }), tr = cs({ type: 'tricycle', mono: true, retract: { time: 6 }, suspension: 'lever' });
    const fl = cs({ type: 'floats', mono: true }), off = cs({ type: 'taildragger', mono: false });
    ok(td.mono === true && tr.mono === true && !('mono' in fl) && !('mono' in off),
       `A mono kept on a taildragger and a tricycle (${td.mono}, ${tr.mono}), gone on floats and when false`);
    ok(!tr.retract && tr.suspension !== 'lever', `A a monowheel drops the retraction and the trailing link (retract ${!!tr.retract}, ${tr.suspension})`);
    const wk = h => { const x = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); x.wings[0].tipSkid = h; return C.clampSpec(x).wings[0].tipSkid; };
    ok(wk(0.5) === C.GEN_TIP_SKID.h[1] && wk(0.001) === C.GEN_TIP_SKID.h[0] && wk(0) === undefined && wk('x') === undefined,
       `A the tip skid clamps (0.5 -> ${wk(0.5)}, 0.001 -> ${wk(0.001)}) and goes when 0 or not a number`);
    const d0 = C.buildGen(C.GEN_DEFAULT);
    ok(!('mono' in d0.spec.gear) && !('tipSkid' in d0.spec.wings[0]) && d0.refs.mains.length === 2 && !d0.refs.skids,
       'A the default (two wheels, no skid) carries neither key: two mains, no skids'); }

  console.log('B. THE FRAME');
  const defT = C.buildGen(JSON.parse(JSON.stringify(mgT.spec)));
  { const M = defT.refs.mains, n = M.length === 1 ? defT.nodes[M[0]] : null;
    ok(defT.spec.gear.mono === true && M.length === 1 && n && n.tag === 'AXLEC' && Math.abs(n.p[2]) < 1e-9 && !(defT.parts.degenerate || []).length,
       `B one axle node on the centreline (${n ? n.tag + ' z ' + n.p[2] : '-'}), refs.mains ${JSON.stringify(M)}, no degenerate member`);
    const two = born('motorglider', {}, {}), d2 = C.buildGen(JSON.parse(JSON.stringify(two.spec)));
    const L = d => d.parts.ledger.gear || { mass: 0, cost: 0 };
    ok(L(defT).mass < L(d2).mass && L(defT).cost < L(d2).cost && d2.refs.mains.length === 2,
       `B one wheel billed: the gear ${L(defT).mass.toFixed(1)} kg / ${Math.round(L(defT).cost)} (the pair's ${L(d2).mass.toFixed(1)} kg / ${Math.round(L(d2).cost)})`);
    const S = defT.refs.skids || [], a = S[0] != null ? defT.nodes[S[0]].p : null, b = S[1] != null ? defT.nodes[S[1]].p : null;
    ok(S.length === 2 && a && b && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(a[2] + b[2]) < 1e-9,
       `B two skid shoes, mirrored (${a ? a.map(r3).join(',') : '-'})`);
    const w0 = defT.spec.wings[0], zS = C.genTipSkidZ(w0, defT.spec.geom.semi);
    ok(a && Math.abs(Math.abs(a[2]) - zS) < 0.03, `B the shoe at genTipSkidZ's station (${a ? r3(Math.abs(a[2])) : '-'} m, ${r3(zS)})`);
    // the drawn hoop: the wing payload's pitot group, its lowest vertex near each shoe against the shoe's contact
    const W = C.genWing(defT), g = W.groups.pitot, FR = C.genRestFrame(defT);
    let worst = 0;
    for (const i of S) {
      const c = FR.to(defT.nodes[i].p), yC = c[1] - defT.nodes[i].r;
      let yMin = Infinity;
      for (let v = 0; v < g.nv; v++) { const x = g.pos[v * 3], y = g.pos[v * 3 + 1], z = g.pos[v * 3 + 2];
        if (Math.hypot(x - c[0], z - c[2]) < 0.6) yMin = Math.min(yMin, y); }
      worst = Math.max(worst, Math.abs(yMin - yC));
    }
    ok(S.length === 2 && worst < 0.005, `B the drawn hoop's underside on the shoe's contact (worst ${(worst * 1000).toFixed(1)} mm < 5)`); }

  console.log('C. THE CERT AND THE DRAG');
  { const L = C.genCertGroundLoads ? C.genCertGroundLoads(defT) : null, names = L ? L.map(q => q[0]) : [];
    ok(names.includes('gSideR') && names.includes('gBrake') && (names.includes('gTailObs') || names.includes('gNoseAft')),
       `C the ground loads on one main: ${names.join(' ') || 'none'}`);
    const g2 = JSON.parse(JSON.stringify(defT.spec)); delete g2.gear.mono;
    const a1 = C.genGearCdA(defT.spec, defT.spec.geom.semi), a2 = C.genGearCdA(g2, defT.spec.geom.semi);
    ok(a1 < a2, `C a monowheel's gear drag counts one wheel (${a1.toFixed(4)} m2, the pair's ${a2.toFixed(4)})`); }

  console.log('D. THE MOTOR GLIDER ON ONE WHEEL AND A TAIL SKID');
  { const { down } = park(defT, 10), tags = down.map(i => defT.nodes[i].tag);
    const M = defT.refs.mains[0], tw = defT.refs.tw, S = defT.refs.skids || [];
    const onSkid = S.filter(i => down.includes(i)).length;
    const other = down.filter(i => i !== M && i !== tw && !S.includes(i));
    ok(down.includes(M) && down.includes(tw) && onSkid === 1 && !other.length,
       `D parked: the wheel, the tail skid and one wingtip skid on the ground (${tags.join(' ')})`);
    const R = await jobs; if (SHOW) console.log(JSON.stringify(R));
    const r = R.roll || {}, c = R.circuit || {};
    ok(r.Vend >= 25 && !r.crashed && r.hdgMaxDeg < 15, `D the take-off roll: ${r.Vend} m/s in ${r.tEnd} s, the heading ${r.hdgMaxDeg} deg (< 15), no crash`);
    ok(/LIFTOFF/.test(c.phases || '') && /STOPPED/.test(c.phases || '') && !c.crashed,
       `D HOME's circuit on the autopilot: ${c.phases || '-'}${c.crashed ? ' CRASHED ' + c.reason : ''}, the touchdown ${c.touchdowns && c.touchdowns[0] ? c.touchdowns[0].sink : '-'} m/s`); }

  console.log('E. THE NOSE SKID');
  { const ar = born('motorglider', { s1Z: 0.95 }, MONO), d = C.buildGen(JSON.parse(JSON.stringify(ar.spec)));
    const tw = d.refs.tw;
    ok(d.spec.gear.type === 'tricycle' && d.spec.gear.mono === true && d.spec.gear.twMode === 'skid' && d.params.twMode === 4
       && tw >= 0 && d.nodes[tw].p[0] < d.nodes[d.refs.mains[0]].p[0],
       `E the tile's Monowheel: a ${d.spec.gear.type} on one wheel, the nose unit ahead flying the skid's law (twMode ${d.params.twMode})`);
    const { down } = park(d, 10), S = d.refs.skids || [];
    ok(down.includes(d.refs.mains[0]) && down.includes(tw) && S.filter(i => down.includes(i)).length === 1,
       `E parked on the wheel, the nose skid and one wingtip skid (${down.map(i => d.nodes[i].tag).join(' ')})`); }

  console.log('F. THE EDITOR');
  { const row = D.DESIGN_ROWS ? D.DESIGN_ROWS.find(r => r.key === 'gearLayout') : null;
    const P = Object.assign({}, mgT.bake.cage || {}, { s1On: 1, s1X: 0, hullOn: 0, gearFloats: 0 });
    ok(row && row.read(P) === 'mono' && row.read(Object.assign({}, P, { s1X: 0.86 })) !== 'mono',
       `F the Undercarriage tile reads 'mono' on a centreline main (${row ? row.read(P) : '-'})`);
    const tail = row ? row.options.find(o => o.value === 'tail') : null, fx = tail && tail.writes.cage.s1X;
    ok(typeof fx === 'function' && fx({ s1X: 0 }) === 0.86 && fx({ s1X: 1.1 }) === 1.1,
       'F leaving the single wheel for a pair brings the pair\'s half track back (0 -> 0.86), a pair keeps its own'); }

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(fails.length ? 'GATE MONOWHEEL: FAIL (' + fails.length + ')' : 'GATE MONOWHEEL: PASS');
  process.exit(fails.length ? 1 : 0);
})();
