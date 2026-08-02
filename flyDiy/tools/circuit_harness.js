// circuit_harness.js — shared full-circuit gate harness.
// Every formula here is transcribed verbatim from the pre-dedup gates;
// the metric-identity rule applies: numbers printed by a gate before and
// after adopting this harness must match at printed precision.
const { makeSim, makeAutopilot, makeWorld } = require('./flight_core.js');

// Standard per-step pipeline:
//   ap.update -> sim.step -> strain split (gear/chassis) -> NaN abort ->
//   rolloutPitchMin -> CRUISE elevator chatter -> tip-flap measurement ->
//   custom onStep -> phase-transition log -> break 5 s after STOPPED.
function runCircuit(cfg) {
  const {
    id, build,
    perturb,                 // { z, v } lateral offset + velocity noise amplitude
    settleS = 10,            // parked idle before engaging (catches parked instabilities)
    maxS = 300,
    tip,                     // { tag, midZ, tipZ, tol } wing flap probe nodes
    flapDuring = ph => ph !== 'ROLL' && ph !== 'STOPPED',
    world = makeWorld(),
    onStep,                  // (ctx) => void — gate-specific collectors
    lines,                   // (ctx) => [string] — REPLACES standard report lines
    extraLines,              // (ctx) => [string] — appended after standard lines
    checks,                  // (ctx) => { label: bool, ... }
  } = cfg;

  const def = build();
  const sim = makeSim(def, world);
  sim.reset(0);
  // mandatory asymmetric start: symmetric ICs mask directional instabilities
  for (let i = 0; i < sim.n; i++) { sim.p[i*3+2] += perturb.z; sim.v[i*3+2] += perturb.v * Math.sin(i * 2.7); }
  for (let s0 = 0; s0 < settleS * 60; s0++) sim.step(1/60);
  const ap = makeAutopilot(sim, def);

  const iW0 = def.nodes.findIndex(n => n.tag === tip.tag && Math.abs(n.p[2] - tip.midZ) < tip.tol && n.p[2] > 0);
  const iW1 = def.nodes.findIndex(n => n.tag === tip.tag && Math.abs(n.p[2] - tip.tipZ) < tip.tol && n.p[2] > 0);

  const ctx = {
    sim, ap, def, world, id,
    t: 0, smaxCh: 0, smaxGr: 0, rollPitchMin: 99,
    flapMin: 99, flapMax: -99, chat: 0, chatN: 0,
    log: [], custom: {}, step: null,
    chatRate() { return this.chat / Math.max(1, this.chatN) * 57.3 * 60; },
  };
  let deP = 0, lastPhase = '';

  for (let s0 = 0; s0 < maxS * 60; s0++) {
    const t = s0 / 60;
    ctx.t = t;
    ap.update(1/60); sim.step(1/60);
    for (const b of sim.beams) {
      if (b.gear) ctx.smaxGr = Math.max(ctx.smaxGr, Math.abs(b.strain));
      else ctx.smaxCh = Math.max(ctx.smaxCh, Math.abs(b.strain));
    }
    if (sim.stats().bad) { console.log(`NaN t=${t.toFixed(1)} ${ap.phase}`); console.log(`GATE ${id}: FAIL (NaN)`); process.exit(1); }
    if (ap.phase === 'ROLLOUT') ctx.rollPitchMin = Math.min(ctx.rollPitchMin, ap.dbg.th * 57.3);
    if (ap.phase === 'CRUISE') { ctx.chat += Math.abs(sim.ctl.de - deP); ctx.chatN++; }
    deP = sim.ctl.de;
    {
      const [xB, yB, zB] = sim.axes();
      const dx = sim.p[iW1*3]-sim.p[iW0*3], dy = sim.p[iW1*3+1]-sim.p[iW0*3+1], dz = sim.p[iW1*3+2]-sim.p[iW0*3+2];
      const ty = dx*yB[0]+dy*yB[1]+dz*yB[2];
      const flap = Math.atan2(ty, Math.abs(dx*zB[0]+dy*zB[1]+dz*zB[2])) * 57.3; // deg vs body
      ctx.step = { t, flap, ty, axes: [xB, yB, zB] };
      if (flapDuring(ap.phase)) { ctx.flapMin = Math.min(ctx.flapMin, flap); ctx.flapMax = Math.max(ctx.flapMax, flap); }
    }
    if (onStep) onStep(ctx);
    if (ap.phase !== lastPhase) {
      ctx.log.push(`t=${t.toFixed(1).padStart(6)} -> ${ap.phase} V=${ap.dbg.V.toFixed(1)} alt=${ap.dbg.alt.toFixed(1)} x=${sim.cgPos()[0].toFixed(0)} z=${ap.dbg.z.toFixed(1)}`);
      lastPhase = ap.phase;
    }
    if (ap.phase === 'STOPPED' && t > 5) break;
  }

  ctx.cg = sim.cgPos();
  ctx.td = ap.tdInfo;
  console.log(ctx.log.join('\n'));
  const out = lines ? lines(ctx) : standardLines(ctx, cfg);
  if (extraLines) out.push(...extraLines(ctx));
  console.log(out.join('\n'));

  const results = checks(ctx);
  const failed = Object.keys(results).filter(k => !results[k]);
  if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
  const pass = failed.length === 0;
  console.log(pass ? `GATE ${id}: PASS` : `GATE ${id}: FAIL`);
  process.exitCode = pass ? 0 : 1;
  return { pass, ctx };
}

function standardLines(ctx, cfg) {
  const { cg, td } = ctx;
  const L = [];
  if (td) L.push(`TOUCHDOWN: sink=${td.sink.toFixed(2)} m/s x=${td.x.toFixed(0)} z=${td.z.toFixed(1)} V=${(td.V*3.6).toFixed(0)} km/h`);
  L.push(`STOP: x=${cg[0].toFixed(0)} z=${cg[2].toFixed(1)} rolloutPitchMin=${ctx.rollPitchMin.toFixed(1)} strain ch=${(ctx.smaxCh*100).toFixed(1)}% gr=${(ctx.smaxGr*100).toFixed(0)}%`);
  L.push(`WING${cfg.wingNote ? ` (${cfg.wingNote})` : ''}: flap ${ctx.flapMin.toFixed(1)}..${ctx.flapMax.toFixed(1)} deg | chatter ${ctx.chatRate().toFixed(1)} deg/s`);
  return L;
}

module.exports = { runCircuit };
