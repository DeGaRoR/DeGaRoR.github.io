#!/usr/bin/env node
// GATE SKIS (SKIS, 13 Nov 2026) - the generic ski landing gear: one ski, three mountings (src/core/29c_ski.js; the
// design note futureDesigns/SKIS-2026-11-13.md; A0's references futureDesigns/SKI-REFERENCES-2026-11-13.md).
//
//   node tools/_skis_check.js            -> "GATE SKIS: PASS|FAIL"   (core: sections 1-7)
//   node tools/_skis_check.js --fly      -> "GATE SKISFLY: PASS|FAIL" (full: the two validation planes' circuits)
//   node tools/_skis_check.js --bless    write tools/fixtures/skis/base.json from THIS tree (run it in a base worktree)
//
//  1 ABSENT IS AS TODAY: seven builds without skis (the validated six and the Carbon Cub) build the def, the shakedown
//    sheet and 300 flown steps of the core before the skis, to the bit (tools/_skis_bytes.js, a process a build;
//    tools/fixtures/skis/base.json) - and carry no ski key, no parts.ski
//  2 THE SPEC: clampSpec keeps a ski only on a taildragger's or a tricycle's fixed legs (floats, a hull, a folding gear:
//    dropped), normalises the kinds and bounds, is idempotent, a merge's nulls drop; the garage's ski rows are ABSENT at
//    "no skis" (genStolCageOff, the cage's CAGE_DEFAULT_ABSENT) and the wheel-ski's preview is never saved
//  3 MASS, PRICE, DRAG PAID: a ski weighs, costs and drags by its size and mounting (plain < penetration < wheel-ski);
//    a plain ski REPLACES its wheel (the 31" tundra's 16 kg and its drag come off), the ledger's gear section and the
//    flown CdA carry it; the PC-6's kit inside the references' 100-150 kg
//  4 WHAT IS DRAWN FLIES: the validation cards through the game's own load door (the editor draws, the join measures):
//    spec.gear.ski is the drawn ski (the rows' length, width; the toe, the kind), the tail ski's too
//  5 THE AREA SETS THE PRESSURE (the physics stops the aberrations): on a powder layer (SOFT_GROUND.powder over the
//    HOME field) the sinkage falls as the ski grows, a well-sized ski sinks under 12 cm and lifts off within 120 m with
//    the game's pilot; the same aeroplane on 0.6 x 0.12 m skis sinks to the bed and never leaves (the pilot aborts)
//  6 NO WHEEL BRAKES ON STRAIGHT SKIS: a plain-ski slide-out is the same, to the bit, with the brake held or not; a
//    wheel-ski in wheel mode keeps its wheel brakes (the stop shorter braked)
//  7 THE WHEEL-SKI'S SELECTOR: with no pilot's choice the skis are up over a hard field and down over a soft one; the
//    pilot's selector moves them in the kit's cycle time, the drawn ski with them (out.skiDy), the contact with it
//  FLY (--fly, the full tier): the Carbon Cub on straight skis and the PC-6 on wheel-skis fly the game's circuit off
//    the powder layer and land and stop on it (no brakes: the snow's drag); the PC-6 also off the grass on its wheels
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const FLY = argv.includes('--fly'), BLESS = argv.includes('--bless');
const ID = FLY ? 'SKISFLY' : 'SKIS';
const C = require(path.join(T, 'flight_core.js'));
const LB = require(path.join(T, '_load_build.js'));
const clone = o => JSON.parse(JSON.stringify(o));
let fails = 0;
const ok = (c, label) => { console.log((c ? '  ok   ' : '  FAIL ') + label); if (!c) fails++; };
const BASE_FILE = path.join(T, 'fixtures', 'skis', 'base.json');
const ABSENT = ['builds/cub_2026-09-20_corrected.json', 'builds/jodel_2026-09-20_corrected.json', 'bugReports/cessnaMetal (1).json',
                'bugReports/cessnaFloatsWOrks.json', 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
                'builds/candidates/superpetrel_V4_1.json', 'builds/candidates/carbon_cub_ss.json'];
const CC_CARD = 'tools/fixtures/skis/carbon_cub_ss_skis.json', PC6_CARD = 'tools/fixtures/skis/pc6_skis.json', POD_CARD = 'tools/fixtures/skis/carbon_cub_ss_pod.json';

function bytesAll() {
  return Promise.all(ABSENT.map(f => new Promise(res => {
    cp.execFile(process.execPath, [path.join(T, '_skis_bytes.js'), f], { cwd: ROOT, maxBuffer: 1 << 24, timeout: 600000 }, (e, out) => {
      const line = String(out || '').trim().split('\n').pop();
      try { res([f, JSON.parse(line)]); } catch (x) { res([f, { error: (e && e.message) || 'no output' }]); }
    });
  })));
}
// a world over HOME whose every metre is a soft layer (the SNOW-MUD interface: world.soft)
function softWorld(kind) {
  const W0 = C.makeWorld();
  if (!kind) return W0;
  return Object.assign(Object.create(Object.getPrototypeOf(W0)), W0, { soft: () => C.SOFT_GROUND[kind] });
}
const defOf = (spec, ski) => { const s = clone(spec); if (ski !== undefined) { if (ski) s.gear.ski = ski; else delete s.gear.ski; } return C.buildGen(C.genMigrateSpec(s)); };
function settle(def, W) { const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance(); for (let k = 0; k < 600; k++) sim.step(1 / 60); return sim; }
// the take-off with the game's pilot: distance to lift-off (null: no lift-off in maxS - stuck, or aborted)
function takeoff(def, W, maxS) {
  const sim = settle(def, W), ap = C.makePilot(sim, def, W), x0 = sim.cgPos();
  for (let k = 0; k < (maxS || 25) * 60; k++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB') return { d: Math.hypot(sim.cgPos()[0] - x0[0], sim.cgPos()[2] - x0[2]), t: k / 60, phase: ap.phase };
    if (ap.phase === 'ABORT' || ap.phase === 'STOPPED') return { d: null, t: k / 60, phase: ap.phase, moved: Math.hypot(sim.cgPos()[0] - x0[0], sim.cgPos()[2] - x0[2]) };
  }
  return { d: null, t: maxS || 25, phase: ap.phase, moved: Math.hypot(sim.cgPos()[0] - x0[0], sim.cgPos()[2] - x0[2]) };
}

async function main() {
  if (BLESS) {
    const by = await bytesAll(), builds = {};
    for (const [f, b] of by) { if (b.error) throw new Error(f + ': ' + b.error); builds[f] = b; }
    const cur = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : {};
    fs.writeFileSync(BASE_FILE, JSON.stringify(Object.assign(cur, { what: 'skis-base', builds }), null, 1) + '\n');
    console.log('blessed ' + Object.keys(builds).length + ' builds into ' + path.relative(ROOT, BASE_FILE));
    return;
  }
  const ccSpec = LB.loadBuild(CC_CARD).spec, pcSpec = LB.loadBuild(PC6_CARD).spec;
  const ccBare = LB.loadBuild('builds/candidates/carbon_cub_ss.json').spec;
  if (FLY) return fly(ccSpec, pcSpec);

  console.log('1 ABSENT IS AS TODAY (the core before the skis, to the bit)');
  {
    const BASE = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')).builds;
    for (const [f, b] of await bytesAll()) {
      const r = BASE[f];
      ok(!b.error && r && b.def === r.def && b.sh === r.sh && b.sim === r.sim && b.nodes === r.nodes,
         f + ': def ' + b.def + ', sheet ' + b.sh + ', 300 steps ' + b.sim + (r ? ' (base ' + r.def + ' / ' + r.sh + ' / ' + r.sim + ')' : ' (NO BASE)') + (b.error ? ' ' + b.error : ''));
      ok(b.ski === false, f + ': no ski key, no parts.ski');
    }
  }

  console.log('2 THE SPEC: where a ski can be, its bounds, the latent rows');
  const OFF_ROWS = { gearSki: 0, skiL: 0, skiW: 0, skiTip: 0, skiAt: 0.585, skiInc: 3, skiT: 1, skiTL: 0, skiTW: 0, skiSkin: 0.051, skiBeam: 0.57,
                     skiNotchAt: 0.49, skiMat: 0, skiColor: 0, skiHeelW: 1, skiProt: 0.03 };
  {
    const n = (gear, ski) => { const s = clone(ccBare); Object.assign(s.gear, gear); s.gear.ski = ski; return C.resolveSpec(C.genMigrateSpec(s)).spec.gear; };
    ok(n({}, { kind: 'plain' }).ski && n({}, { kind: 'plain' }).ski.kind === 'plain', 'a taildragger keeps its plain ski');
    ok(!('ski' in n({ type: 'floats' }, { kind: 'plain' })), 'floats: the ski key dropped');
    ok(!('ski' in n({}, null)), 'a merge\'s null: no key');
    const w = n({}, { kind: 'bogus', L: 99, W: -3, prot: 2, ped: 0.3, drop: 0.1, third: { L: 0.01 } }).ski;
    ok(w.kind === 'plain' && w.L === 6 && w.W === 0.08 && !('prot' in w) && w.ped === 0.3 && !('drop' in w) && w.third.L === 0.2,
       'an unknown kind is plain, the bounds hold (L 6 / W 0.08 / ped kept, prot and drop are not a plain ski\'s): ' + JSON.stringify(w));
    const r = n({}, { kind: 'retract', drop: 0.5, time: 0.1, prot: 0.04 }).ski;
    ok(r.drop === 0.3 && r.time === 2 && r.prot === 0.04 && !('ped' in r), 'a wheel-ski: drop and cycle bounded, prot kept, no pedestal row');
    const twice = (() => { const s = clone(ccBare); s.gear.ski = { kind: 'wheel', L: 1.5, W: 0.3, third: {} }; const a = C.resolveSpec(C.genMigrateSpec(s)).spec; return JSON.stringify(a.gear.ski) === JSON.stringify(C.resolveSpec(clone(a)).spec.gear.ski); })();
    ok(twice, 'normalising a normalised ski changes nothing');
    const nul = n({}, { kind: 'plain', L: 1.7, W: 0.3, ped: null, prot: null, drop: null, time: null, third: null });
    ok(JSON.stringify(nul.ski) === '{"kind":"plain","L":1.7,"W":0.3}', 'the join\'s nulls drop: ' + JSON.stringify(nul.ski));
    ok(nul.fairing === 'none' && nul.twFairing === 'none', 'a ski wears no spat (the drawn skis have none)');
    const off = C.genStolCageOff(Object.assign({}, OFF_ROWS, { skiPos: 0.4, s1R: 0.2 }));
    ok(Object.keys(off).join() === 's1R', 'genStolCageOff: the ski rows at "no skis" and the preview are absent (' + Object.keys(off).join() + ')');
    const on = C.genStolCageOff({ gearSki: 1, skiL: 1.7, skiPos: 1, s1R: 0.2 });
    ok(Object.keys(on).join() === 'gearSki,skiL,s1R', 'a ski build keeps its rows, never its preview (' + Object.keys(on).join() + ')');
    const cg = fs.readFileSync(path.join(T, '_cage_gen.js'), 'utf8');
    ok(cg.indexOf(Object.entries(OFF_ROWS).map(([k, v]) => k + ': ' + v).join(', ')) >= 0 && /k === 'skiPos'/.test(cg),
       'the cage saves no ski row at its default (CAGE_DEFAULT_ABSENT) and never the preview (cageToSpec)');
  }

  console.log('3 MASS, PRICE AND DRAG PAID');
  {
    const d0 = defOf(ccBare), dP = defOf(ccBare, { kind: 'plain', L: 1.7, W: 0.305, third: { L: 0.55, W: 0.15 } }),
          dW = defOf(ccBare, { kind: 'wheel', L: 1.7, W: 0.305, third: { L: 0.55, W: 0.15 } }),
          dR = defOf(ccBare, { kind: 'retract', L: 1.7, W: 0.305, third: { L: 0.55, W: 0.15 } });
    const M = d => d.nodes.reduce((a, q) => a + q.m, 0), G = d => d.parts.ledger.gear, cda = d => d.params.fusCdA[0];
    const sP = dP.parts.ski, sW = dW.parts.ski, sR = dR.parts.ski;
    ok(sP.kg < sW.kg && sW.kg < sR.kg && sP.usd < sW.usd && sW.usd < sR.usd && sP.cdA < sW.cdA && sW.cdA < sR.cdA,
       `plain < penetration < wheel-ski: ${sP.kg.toFixed(1)} / ${sW.kg.toFixed(1)} / ${sR.kg.toFixed(1)} kg, $${sP.usd.toFixed(0)} / ${sW.usd.toFixed(0)} / ${sR.usd.toFixed(0)}, CdA ${sP.cdA.toFixed(3)} / ${sW.cdA.toFixed(3)} / ${sR.cdA.toFixed(3)} m2`);
    const wheel = C.GEN_RULES.wheelKg(ccBare.gear.wheelR);
    ok(Math.abs((G(d0).mass - 2 * wheel + 2 * sP.mains.kg) - G(dP).mass) < 0.6 * sP.third.kg + 2.5,
       `a plain ski replaces its wheel: gear ${G(d0).mass.toFixed(1)} kg -> ${G(dP).mass.toFixed(1)} (two ${wheel.toFixed(1)} kg tundras off, two ${sP.mains.kg.toFixed(1)} kg skis on, the tail ski)`);
    ok(G(dW).mass > G(d0).mass + 2 * sW.mains.kg - 1, `a wheel-through ski adds to its wheel: gear ${G(dW).mass.toFixed(1)} kg`);
    ok(G(dP).cost > G(d0).cost - 2 * C.GEN_PRICES.wheel - C.GEN_PRICES.thirdWheel + 0.99 * sP.usd && G(dR).cost > G(d0).cost + 0.99 * sR.usd,
       `the price paid: gear $${G(d0).cost.toFixed(0)} -> plain $${G(dP).cost.toFixed(0)}, wheel-ski $${G(dR).cost.toFixed(0)}`);
    ok(cda(dP) < cda(d0) && cda(dW) > cda(d0) && cda(dR) > cda(dW) && Math.abs(dP.params.gen.drag.ski - sP.cdA) < 1e-12,
       `the flown CdA: ${cda(d0).toFixed(4)} -> plain ${cda(dP).toFixed(4)} (the tundras' drag off) / penetration ${cda(dW).toFixed(4)} / wheel-ski ${cda(dR).toFixed(4)} m2`);
    ok(M(dP) < M(d0) && M(dR) > M(d0), `the aeroplane: ${M(d0).toFixed(1)} kg -> plain ${M(dP).toFixed(1)}, wheel-ski ${M(dR).toFixed(1)}`);
    const kit = defOf(pcSpec).parts.ski;
    ok(kit && kit.kind === 'retract' && kit.kg >= 100 && kit.kg <= 150, `the PC-6's wheel-ski kit: ${kit && kit.kg.toFixed(1)} kg (the references: 100-150 kg), $${kit && kit.usd.toFixed(0)}`);
    // the sizing rule (a ski the spec leaves unsized): pDesign at the share each unit carries
    const auto = defOf(ccBare, { kind: 'plain', third: {} }).parts.ski;
    const g = defOf(ccBare, { kind: 'plain', third: {} }).nodes.reduce((a, q) => a + q.m, 0);
    ok(Math.abs(auto.mains.A * C.SKI_RULES.pDesign - C.SKI_RULES.mainShare * 9.81 * (g - 0)) / (C.SKI_RULES.mainShare * 9.81 * g) < 0.08 && Math.abs(auto.mains.L / auto.mains.W - C.SKI_RULES.ref.L / C.SKI_RULES.ref.W) < 1e-9,
       `an unsized ski is the SS2300 scaled to bear its share at ${C.SKI_RULES.pDesign} Pa: ${auto.mains.L.toFixed(2)} x ${auto.mains.W.toFixed(3)} m, ${auto.mains.A.toFixed(3)} m2 bearing, for ~${g.toFixed(0)} kg`);
  }

  console.log('4 WHAT IS DRAWN FLIES (the game\'s load door: the editor draws, the join measures)');
  {
    const a = ccSpec.gear.ski, b = pcSpec.gear.ski;
    const rows = c => JSON.parse(fs.readFileSync(path.join(ROOT, c), 'utf8')).spec.cage;
    const rc = rows(CC_CARD), rp = rows(PC6_CARD);
    ok(a && a.kind === 'wheel' && a.L === rc.skiL && a.W === rc.skiW && a.skin === 0.051 && a.beam === 0.57 && a.notchAt === 0.49 && a.prot > 0 && a.third && a.third.L === rc.skiTL && a.third.W === rc.skiTW,
       'the Carbon Cub: the SS2300 as drawn - the wheel in its cutout (' + JSON.stringify(a) + ')');
    const ss = defOf(ccSpec).parts.ski.mains;
    ok(Math.abs(ss.kg - C.SKI_RULES.refKg) < 0.02 && Math.abs(ss.Aplan / C.skiPlan(Object.assign({ beam: 0.57, notchAt: 0.49, at: 0.585 }, C.SKI_RULES.ref)).A - 1) < 0.002,
       `the SS2300 flies at its own figures: ${ss.kg.toFixed(2)} kg a ski with rigging (27 lb), ${ss.Aplan.toFixed(3)} m2 of skins, ${ss.A.toFixed(3)} m2 bearing`);
    ok(b && b.kind === 'retract' && b.L === rp.skiL && b.W === rp.skiW && b.prot > 0 && b.drop > 0 && b.third && b.third.L === rp.skiTL && b.third.prot > 0,
       'the PC-6: a wheel-ski as drawn, its tail ski through its wheel (' + JSON.stringify(b) + ')');
    const dc = defOf(ccSpec);
    ok(Math.abs(dc.parts.ski.mains.L - a.L) < 1e-12 && Math.abs(dc.parts.ski.mains.tip - a.tip) < 1e-12, 'the flown ski is the drawn one (length, toe)');
    const join = fs.readFileSync(path.join(T, '_cage_join.js'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    ok(/name === 'edSkiL' \|\| name === 'edSkiR' \|\| name === 'edSkiT'/.test(join) && /kind: 'ski' \+ su\.kind/.test(join) && /skiRigs\.push/.test(app) && /so\.skiPitch/.test(app),
       'the drawn ski is a flown part (the join\'s edSki parts, app.js\'s ski rigs on the solver\'s pitch and selector)');
  }

  console.log('5 THE AREA SETS THE PRESSURE (a powder layer over HOME)');
  {
    const W = softWorld('powder');
    const sizes = [[0.6, 0.12], [1.1, 0.2], [1.7, 0.305]];
    const sinks = sizes.map(([L, Wd]) => { const sim = settle(defOf(ccBare, { kind: 'plain', L, W: Wd, third: { L: 0.55, W: 0.15 } }), W);
                                           return Math.max(sim.out.skiSink[0], sim.out.skiSink[1]); });
    ok(sinks[0] > sinks[1] && sinks[1] > sinks[2], 'the sinkage falls as the ski grows: ' + sizes.map((s, i) => s.join(' x ') + ' m ' + (100 * sinks[i]).toFixed(1) + ' cm').join(', '));
    ok(sinks[2] < 0.12 && sinks[0] > 2 * sinks[2], `a well-sized ski sinks ${(100 * sinks[2]).toFixed(1)} cm (< 12), the 0.6 x 0.12 m ski ${(100 * sinks[0]).toFixed(1)} (to the bed: ${100 * C.SOFT_GROUND.powder.depth} cm)`);
    const good = takeoff(defOf(ccSpec), W), bad = takeoff(defOf(ccBare, { kind: 'plain', L: 0.6, W: 0.12, third: { L: 0.55, W: 0.15 } }), W);
    ok(good.d != null && good.d < 120, `the Carbon Cub on its drawn skis lifts off in ${good.d && good.d.toFixed(0)} m (${good.t.toFixed(1)} s)`);
    ok(bad.d == null, `...on 0.6 x 0.12 m skis it never leaves (${bad.phase} at ${bad.t.toFixed(1)} s, ${bad.moved && bad.moved.toFixed(1)} m moved)`);
  }

  console.log('6 NO WHEEL BRAKES ON STRAIGHT SKIS');
  {
    const slide = (def, W, brake, pre) => {
      const sim = settle(def, W);
      if (pre) pre(sim);
      for (let i = 0; i < sim.n; i++) { sim.v[i * 3] -= 8; }        // a slide-out at 8 m/s down the field (the nose is -x)
      let x0 = sim.cgPos()[0];
      for (let k = 0; k < 60 * 12; k++) { sim.ctl.thr = 0; sim.ctl.brake = brake; sim.step(1 / 60); }
      return { d: x0 - sim.cgPos()[0], p: Array.from(sim.p) };
    };
    const dP = defOf(ccSpec, Object.assign({}, ccSpec.gear.ski, { kind: 'plain', prot: null })), Wp = softWorld('packed');   // (the SS2300 run straight)
    const a = slide(dP, Wp, 0), b = slide(dP, Wp, 1);
    ok(a.p.every((v, i) => v === b.p[i]), `a straight-ski slide-out on packed snow: ${a.d.toFixed(1)} m with the brake held as without - to the bit`);
    const dR = defOf(pcSpec), Wg = softWorld(null);
    const c = slide(dR, Wg, 0), e = slide(dR, Wg, 1);
    ok(e.d < c.d - 2, `a wheel-ski with its skis up keeps its wheel brakes: ${c.d.toFixed(1)} m rolled free, ${e.d.toFixed(1)} braked`);
  }

  console.log('7 THE WHEEL-SKI\'S SELECTOR');
  {
    const dR = defOf(pcSpec), R = dR.parts.ski;
    const g = settle(dR, softWorld(null)), s = settle(dR, softWorld('powder'));
    ok(g.out.ski === 0 && s.out.ski === 1, `unset, the selector follows the surface: skis ${g.out.ski === 0 ? 'up' : 'DOWN'} on grass, ${s.out.ski === 1 ? 'down' : 'UP'} on powder`);
    ok(Math.abs(g.out.skiDy[0] + (R.mains.prot + R.mains.drop)) < 1e-9 && Math.abs(s.out.skiDy[0]) < 1e-9,
       `the drawn ski rides it: ${g.out.skiDy[0].toFixed(3)} m up on grass, ${s.out.skiDy[0].toFixed(3)} down`);
    const ax = dR.refs.mains, axY = () => 0.5 * (g.p[ax[0] * 3 + 1] + g.p[ax[1] * 3 + 1]), y0 = axY();
    g.ctl.ski = 1; let tDown = null;
    for (let k = 0; k < 60 * (R.time + 5); k++) { g.step(1 / 60); if (tDown == null && g.out.ski >= 1) tDown = (k + 1) / 60; }
    ok(tDown != null && Math.abs(tDown - R.time) < 0.1, `the pilot lowers them on the grass: down in ${tDown && tDown.toFixed(2)} s (the kit's ${R.time} s cycle)`);
    // (up, the tyre was the lowest point: the axles rise by the ski's reach below the tyre, `drop`, not by its stroke)
    ok(Math.abs(axY() - y0 - R.mains.drop) < 0.015, `...and the axles rise onto them: +${(100 * (axY() - y0)).toFixed(1)} cm (the ski's ${(100 * R.mains.drop).toFixed(0)} cm below the tyre)`);
  }
  console.log('8 THE BELLY POD ON THE CARBON CUB, END TO END (the garage\'s ventral cargo pod: spec.pod)');
  {
    const podSpec = LB.loadBuild(POD_CARD).spec, d0 = defOf(ccBare), d1 = defOf(podSpec);
    const sh0 = C.genShakedown(d0, { corners: false }), sh1 = C.genShakedown(d1, { corners: false }), R = d1.parts.pod;
    ok(podSpec.pod && podSpec.pod.on === 1 && R && R.len > 1.9 && R.litres > 90 && R.maxKg > 0,
       `the pod survives the game's load door and resolves: ${R && R.len.toFixed(2)} m, ${R && R.litres.toFixed(0)} L, rated ${R && R.maxKg} kg, from ${R && R.x0.toFixed(2)} to ${R && R.x1.toFixed(2)} m aft of the firewall`);
    const L1 = d1.parts.ledger.pod, mac = q => 100 * (q.cgX - q.xLEmac) / q.cBar;
    ok(L1 && L1.mass > 5 && L1.mass < 20 && L1.cost > 0 && sh1.mass > sh0.mass && sh1.cgX > sh0.cgX && sh1.staticMargin > 0.05,
       `mass and balance: the shell ${L1 && L1.mass.toFixed(2)} kg ($${L1 && L1.cost.toFixed(0)}), ${sh0.mass.toFixed(1)} -> ${sh1.mass.toFixed(1)} kg, CG ${mac(sh0).toFixed(1)} -> ${mac(sh1).toFixed(1)} % MAC, static margin ${sh1.staticMargin.toFixed(3)}`);
    const full = clone(podSpec); full.pod.loadKg = R.maxKg; const sh2 = C.genShakedown(defOf(full), { corners: false, slim: true });
    ok(sh2.cgX > sh1.cgX && sh2.staticMargin > 0.05, `the pod full (${R.maxKg} kg): CG ${mac(sh2).toFixed(1)} % MAC, static margin ${sh2.staticMargin.toFixed(3)}`);
    const dr0 = d0.params.gen.drag, dr1 = d1.params.gen.drag;
    ok(dr1.pod > 0.01 && dr1.axial > dr0.axial && sh1.pod && sh1.pod.cruise && sh1.pod.cruise.dRangePct < 0,
       `the drag: axial CdA ${dr0.axial.toFixed(4)} -> ${dr1.axial.toFixed(4)} m2 (the pod ${dr1.pod.toFixed(4)}), the range ${sh1.pod.cruise.dRangePct.toFixed(1)} %`);
    const RO = C.genPodReadout(d1, sh1);
    ok(RO && !(RO.red && RO.red.length), `the garage's readout: no red, clearances ${JSON.stringify(RO.clearance.map(r => [r.id, +r.clear.toFixed(2)]))}`);
    // the cargo path: the hold as the freight packer and the strap see it, on a card measured off the aeroplane (the
    // career's card table holds the catalogue's designs only - a player's build has none: FREIGHT-MODEL's open point)
    const SITE = require(path.join(T, '_freight_site.js'));
    const card0 = SITE.freightMeasureFile('builds/candidates/carbon_cub_ss.json', { id: 'carboncub', label: 'Carbon Cub SS' });
    const card = C.freightCardPod(card0, d1, 0.4);
    const items = [0, 1, 2, 3].map(i => ({ id: 'crate' + i, kind: 'generic', kg: 15, dims: [0.45, 0.3, 0.35] }))
      .concat([0, 1, 2].map(i => ({ id: 'flat' + i, kind: 'generic', kg: 12, dims: [0.5, 0.2, 0.35] })), [{ id: 'rods', kind: 'generic', kg: 4, dims: [1.0, 0.1, 0.1] }]);
    const p0 = C.freightPack(card0, items, { pax: 0 }), p1 = C.freightPack(card, items, { pax: 0 }), rp = C.freightReport(card, p1.placed, { pax: 0 });
    const inPod = p1.placed.filter(q => q.space === 'pod');
    ok(card.pod && inPod.length > 0 && p1.unplaced.length < p0.unplaced.length && rp.pod && rp.pod.ok,
       `the freight: without the pod ${p0.placed.length} of ${items.length} placed, with it ${p1.placed.length} (${inPod.map(q => q.id).join(', ')} in the pod, ${rp.pod && rp.pod.kg} of ${rp.pod && rp.pod.limit} kg)`);
    const adds = C.freightStrapAdds(d1, { items: p1.placed }, { card, yD: 0.4 });
    const podAdds = ((adds && adds.items) || []).filter(q => q.pod);
    ok(podAdds.length === inPod.length, `...strapped onto the pod's own four nodes (${podAdds.length}: a pod torn off takes its freight with it)`);
    // ...and on skis: the pod stands clear with the SS2300s on
    const both = clone(podSpec); both.gear.ski = clone(ccSpec.gear.ski);
    const d3 = defOf(both), RO3 = C.genPodReadout(d3, C.genShakedown(d3, { corners: false }));
    ok(RO3 && !(RO3.red && RO3.red.length), 'the pod and the skis together: no red (' + JSON.stringify(RO3.clearance.map(r => [r.id, +r.clear.toFixed(2)])) + ')');
  }
  console.log(fails ? `GATE ${ID}: FAIL (${fails})` : `GATE ${ID}: PASS`);
  process.exitCode = fails ? 1 : 0;
}

// ---- FLY: the validation planes' circuits ------------------------------------------------------------------------
function circuit(def, W, label, maxS) {
  const sim = settle(def, W), ap = C.makePilot(sim, def, W);
  const log = [], x0 = sim.cgPos();
  let last = '', sinkMax = 0, brakeMax = 0;
  for (let k = 0; k < (maxS || 480) * 60; k++) {
    const t = k / 60;
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { log.push('NaN at ' + t.toFixed(1)); break; }
    if (sim.out.skiSink) sinkMax = Math.max(sinkMax, ...sim.out.skiSink);
    brakeMax = Math.max(brakeMax, sim.ctl.brake || 0);
    if (ap.phase !== last) { const c = sim.cgPos(); log.push(`  t=${t.toFixed(1).padStart(6)} ${ap.phase.padEnd(9)} V=${ap.dbg.V.toFixed(1)} alt=${ap.dbg.alt.toFixed(1)} x=${(c[0] - x0[0]).toFixed(0)} skis=${sim.out.ski != null ? sim.out.ski.toFixed(2) : '-'}`); last = ap.phase; }
    if (ap.phase === 'STOPPED' && t > 20) break;
  }
  console.log(label); console.log(log.join('\n'));
  const td = ap.tdInfo;
  console.log(`  touchdown ${td ? td.sink.toFixed(2) + ' m/s' : '-'}, deepest ski ${(100 * sinkMax).toFixed(1)} cm, brake asked ${brakeMax.toFixed(2)}, crashed ${!!(sim.dmg && sim.dmg.crashed)}`);
  return { stopped: last === 'STOPPED', td, crashed: !!(sim.dmg && sim.dmg.crashed), log, sim };
}
function fly(ccSpec, pcSpec) {
  const a = circuit(defOf(ccSpec), softWorld('powder'), 'the Carbon Cub on straight skis, off and onto powder');
  ok(a.stopped && !a.crashed && a.log.some(l => /CLIMB/.test(l)) && a.log.some(l => /ROLLOUT/.test(l)), 'the Carbon Cub: a circuit on skis, landed and stopped on the snow');
  const b = circuit(defOf(pcSpec), softWorld('powder'), 'the PC-6 on wheel-skis (skis down), off and onto powder');
  ok(b.stopped && !b.crashed && b.log.every(l => !/skis=0\.00/.test(l)), 'the PC-6: a circuit on its skis, landed and stopped on the snow');
  const c = circuit(defOf(pcSpec), softWorld(null), 'the PC-6 on wheel-skis (skis up: on its wheels), off and onto the grass');
  ok(c.stopped && !c.crashed && c.log.every(l => !/skis=1\.00/.test(l)), 'the PC-6: a circuit on its wheels with the skis up');
  console.log(fails ? `GATE ${ID}: FAIL (${fails})` : `GATE ${ID}: PASS`);
  process.exitCode = fails ? 1 : 0;
}
main().catch(e => { console.log(e.stack || e); console.log(`GATE ${ID}: FAIL (threw)`); process.exitCode = 1; });
