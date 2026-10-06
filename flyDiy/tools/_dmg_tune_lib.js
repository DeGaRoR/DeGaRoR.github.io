// G1893-G1897 (DMG-TUNE): the standard crashes the sanity table flies on the validated builds, and the instruments that
// say what broke, when, why and as what part. Node only; read-only instruments (sim.onSubstep, sim.damageCaps), so a
// run with the logger on flies the same bits as one without (the logger reads, it never writes).
//
//   crashes(k)            the standard crashes for build k (land builds: a 3 m/s taxi into a trunk, a nose-over into a
//                         35 cm stump at 12 m/s, a 30 m/s trunk on the centreline and 2.5 m out on the wing, a hard
//                         landing at 1.5 x the gear's limit sink; floatplanes: the two trunks, the water drop at 1.5 x,
//                         a float dig-in)
//   runCrash(k, id, o)    flies one, with the break log: { rows, groups, broken by section / part, work, what came off }
//   stampRatios(k)        every member's stamped limits over its physics (the certificate against D1a's material x section)
'use strict';
const path = require('path');
const L = require('./_treecrash_lib.js');

// the ledger section a member is billed to (bm.sec, DMG-D0): the coordinator's own split
const SECS = ['engines', 'bracing', 'wings', 'tail', 'gear', 'fuselage', 'vessel'];
// the PART a member belongs to (61_gen_frame dmgPart, via parts.dmg.part): both ends on one part, or a joint's child
function partOfBeam(def, bi) {
  const b = def.beams[bi], P = def.parts.dmg.part, G = def.parts.dmg.groups;
  if (b.grp >= 0 && G[b.grp]) return G[b.grp].part;
  return P[b.a] === P[b.b] ? P[b.a] : P[b.a] + '|' + P[b.b];
}
const partBase = p => p.replace(/\|.*$/, '').replace(/[0-9]?[LR]?$/, '').replace(/[0-9]$/, '');

const CRASHES = {
  taxi:     { label: '3 m/s taxi into a trunk (centreline, throttle shut)', land: true, kind: 'trunk', o: { D: 4, V: 3, thr: 0, secs: 8 } },
  noseover: { label: 'nose-over: 12 m/s into a 35 cm stump (the wheels stopped)', land: true, kind: 'trunk', o: { D: 12, V: 12, thr: 0, secs: 6, trunk: { r: 0.25, h: 0.35, sink: 0 } } },
  trunk0:   { label: '30 m/s into a trunk, the centreline (4 m AGL)', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 0 } },
  trunk25:  { label: '30 m/s into a trunk 2.5 m out on the wing (4 m AGL)', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 2.5 } },
  hard:     { label: 'hard landing at 1.5 x the gear\'s limit sink (FAR 23.473), V_S0 forward, no lift', kind: 'drop', o: { k473: 1.5, frames: 240 } },
  digin:    { label: 'float dig-in: 120 km/h, 7 m/s down, 30 deg nose-down (DMGGEAR\'s middle row)', water: true, kind: 'water', o: { V: 120 / 3.6, sink: 7, pitch: 30, secs: 5 } },
};
function crashes(k) {
  const fl = /floats/i.test(k);
  return Object.keys(CRASHES).filter(id => (fl ? !CRASHES[id].land : !CRASHES[id].water));
}

// THE BREAK LOG: per substep, every member that broke in it, with what it was doing - 'kink' (crushed past its kink
// strain), 'fold' (bent round a trunk past its fold angle), 'trigger' (the member that let its group go), 'group'
// (taken by its group), 'tension' (brittle at its strength or ductile at its elongation), 'ragged' (spruce's last
// stage) - read from the member's state after the substep (the solver's own fields); and for every group that let
// go, the load of its OTHER breaking members (type 0) one substep before, over their limits: whether the group was
// overloaded as a whole or one member took it
function attachLog(sim, def) {
  const D = sim.damage(), caps = sim.damageCaps(), nb = sim.beams.length, beams = sim.beams;
  const groups = (def.parts && def.parts.dmg && def.parts.dmg.groups) || [];
  const prevR = new Float64Array(nb), curR = new Float64Array(nb);   // the member's force over its limit (+ tension / - compression)
  const grpMembers = new Set(); for (const G of groups) for (const j of G.t0) grpMembers.add(j);
  const gm = [...grpMembers];
  const log = { rows: [], groups: [], seen: 0, gSeen: 0, t0: null };
  const p = sim.p;
  const forceOf = bi => { const b = beams[bi], k = b.broken ? b.kB : b.k, a3 = b.a * 3, b3 = b.b * 3;
    const L_ = Math.hypot(p[b3] - p[a3], p[b3+1] - p[a3+1], p[b3+2] - p[a3+2]); return k * (L_ - b.L0); };
  const ratioOf = bi => { const F = forceOf(bi); return F >= 0 ? F / caps.FY[bi] : F / caps.FC[bi]; };
  sim.onSubstep = () => {
    // the groups first (their trigger), then the members
    const byTrig = new Map(), relNow = new Set();
    for (; log.gSeen < D.groups.length; log.gSeen++) {
      const g = D.groups[log.gSeen], G = groups[g.grp], tb = beams[g.by];
      const others = G.t0.filter(j => j !== g.by).map(j => ({ bi: j, r: prevR[j], broken: false }));
      const trigHow = g.how && g.how !== 'tension' ? g.how : (tb.kink ? 'kink' : (tb.dk > 0 ? 'fold' : (tb.rgN && tb.rgS >= tb.rgN ? 'ragged' : 'tension')));
      // the group's own load before it went: the members that break it, their largest share of their limit (either way)
      const mx = others.reduce((m, o) => Math.max(m, Math.abs(o.r)), 0), mean = others.length ? others.reduce((s, o) => s + Math.abs(o.r), 0) / others.length : 0;
      const row = { t: g.t, key: g.key, by: g.by, how: trigHow, byR: prevR[g.by], n0: G.t0.length, n1: G.t1.length, othersMax: mx, othersMean: mean,
        othersOver: others.filter(o => Math.abs(o.r) >= 0.9).length };
      log.groups.push(row); byTrig.set(g.by, row); relNow.add(g.key);
    }
    for (; log.seen < D.broken.length; log.seen++) {
      const bi = D.broken[log.seen], b = beams[bi];
      // (a member is 'group' - taken - only when a group of its own let go in this same substep; before, it was severed alone)
      const gks = groups.filter(G => G.t0.includes(bi) || G.t1.includes(bi)).map(G => G.key), gk = gks.length ? gks[0] : null;
      const how = byTrig.has(bi) ? 'trigger:' + byTrig.get(bi).how : (gks.some(x => relNow.has(x)) && !b.kink ? 'group' : (b.kink ? 'kink' : b.dk > 0 ? 'fold' : (b.rgN && b.rgS >= b.rgN ? 'ragged' : 'tension')));
      if (log.t0 === null) log.t0 = D.firstBreak ? D.firstBreak.t : null;
      log.rows.push({ groupKey: gk == null ? null : gk, bi, t: +(sim.t || 0).toFixed(5), sec: b.sec, part: partOfBeam(def, bi), cls: b.cls, seam: b.seam || null, grp: b.grp, how, r: prevR[bi],
        FY: caps.FY[bi], FC: caps.FC[bi], phy: caps.PHY ? [caps.PHY[bi*4], caps.PHY[bi*4+1], caps.PHY[bi*4+2]] : null });
    }
    // this substep's ratios become the next one's 'before' (the group members and every member still whole)
    for (let bi = 0; bi < nb; bi++) { if (!beams[bi].broken) curR[bi] = ratioOf(bi); }
    prevR.set(curR);
  };
  return log;
}
// the 'group?' rows: a member taken by a group that let go in the same event (the log reads after the substep)
function settleLog(log) { return log; }

function summarize(sim, def, log, extra) {
  const D = sim.damage(), sec = {}, part = {}, how = {};
  for (const r of log.rows) { sec[r.sec] = (sec[r.sec] || 0) + 1; const pb = partBase(r.part); part[pb] = (part[pb] || 0) + 1; const h = r.how.replace(/^trigger:/, 'trigger-'); how[h] = (how[h] || 0) + 1; }
  // what came off: the pieces now (live members and clusters), every piece but the core's with its parts and mass
  const n = sim.n, uf = new Int32Array(n); for (let i = 0; i < n; i++) uf[i] = i;
  const fd = i => { while (uf[i] !== i) { uf[i] = uf[uf[i]]; i = uf[i]; } return i; };
  for (const b of sim.beams) if (!b.broken) { const x = fd(b.a), y = fd(b.b); if (x !== y) uf[x] = y; }
  const core = fd(def.refs.noseFrame[0]), P = def.parts.dmg.part, off = {};
  for (let i = 0; i < n; i++) { const r = fd(i); if (r === core) continue; const key = r; (off[key] = off[key] || { m: 0, parts: {} }); off[key].m += sim.m[i]; off[key].parts[P[i]] = (off[key].parts[P[i]] || 0) + 1; }
  const offList = Object.values(off).filter(o => o.m > 0.5).map(o => ({ m: +o.m.toFixed(1), parts: Object.keys(o.parts).sort().join('+') })).sort((a, b) => b.m - a.m);
  const grpOff = D.groups.map(g => g.key);
  // the members SET (yielded, not broken) by section, and the largest set of each (a bent wing reads here)
  const setBySec = {}, setMaxBySec = {};
  sim.beams.forEach((b, i) => { if (!b.yielded || b.broken) return; setBySec[b.sec] = (setBySec[b.sec] || 0) + 1;
    const s = Math.abs(b.L0 - b.Lr) / b.Lr + (b.dk > 0 ? b.dk / b.Lr : 0); if (!(setMaxBySec[b.sec] >= s)) setMaxBySec[b.sec] = +s.toFixed(4); });
  return Object.assign({ broken: D.broken.length, set: D.members, work: D.work, crashed: D.crashed, reason: D.reason, gPeak: D.gPeak, bySec: sec, byPart: part, byHow: how,
    groupsOff: grpOff, setBySec, setMaxBySec, off: offList, prop: D.propStrike, firstBreak: D.firstBreak, groups: log.groups, firstT: log.rows.length ? log.rows[0].t : null }, extra || {});
}

// ONE CRASH, logged
function runCrash(k, id, o) {
  const c = CRASHES[id], opts = Object.assign({}, c.o, o || {});
  let log = null, def = null;
  const onStart = (sim, d) => { def = d; log = attachLog(sim, d); };
  let res, extra = {};
  if (c.kind === 'trunk') { res = L.atTrunk(k, Object.assign({}, opts, { onStart })); extra = { reach: res.reach, end: res.end, back: res.reach - res.end }; }
  else if (c.kind === 'drop') {
    const s473 = L.far473(k), dd = L.defOf(k), fwd = dd.params.gen.VsFlap || dd.params.gen.Vs;
    res = L.hardLanding(k, Object.assign({}, opts, { sink: opts.k473 * s473, fwd, onStart })); extra = { sink: opts.k473 * s473, fwd };
  } else res = L.waterCase(k, Object.assign({}, opts, { onStart }));
  const sim = L.lastRun.sim; settleLog(log);
  const out = summarize(sim, def, log, extra);
  out.id = id; out.label = c.label; out.rows = log.rows; out.finite = res.finite;
  sim.onSubstep = null;
  return out;
}

// THE STAMP AGAINST THE PHYSICS, per member: the certificate's limits (sim.damageCaps on a certified sim) over D1a's
// physics (the material x section, the seams, Euler: PHY) - tension yield, tension break, compression
function stampRatios(k) {
  const C = L.core(), defC = L.defOf(k, { cert: true }), sim = C.makeSim(defC, null), caps = sim.damageCaps();
  const out = [];
  for (let bi = 0; bi < sim.beams.length; bi++) {
    const b = sim.beams[bi], PHY = caps.PHY;
    if (!(PHY[bi*4] < Infinity)) continue;
    out.push({ bi, sec: b.sec, cls: b.cls, mat: b.mat, seam: b.seam || null, part: partOfBeam(defC, bi), gear: b.cls === 'gear',
      fy: b.fy0, fu: b.fu, fc: b.fc0, pfy: PHY[bi*4], pfu: PHY[bi*4+1], pfc: PHY[bi*4+2], ty: PHY[bi*4+3], Ft: defC.cert.Ft[bi], Fc: defC.cert.Fc[bi], A: b.A, L: b.L });
  }
  return out;
}

// THE CARD (GATE DMGCERT's test to destruction, the garage's rig on the certified airframe): BROKE AT, the first group
function runCard(k) {
  const C = L.core(), def = L.defOf(k, { cert: true }), sim = C.makeSim(def, null); sim.reset(0);
  const BW = require(path.join(__dirname, '..', 'src', 'viewer', 'bench_worker.js'));
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, def.spec, { destroy: true });
  cfg.ult = 3 * C.GEN_LOAD_ULT; cfg.rampS = 4 * cfg.ult / C.GEN_LOAD_ULT; cfg.surface = 'wing';
  const rig = C.makeLoadTest(sim, def, cfg);
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) rig.step(1 / 60);
  const D = sim.damage(), st = rig.state, fb = D.firstBreak;
  return { brokeAt: st.brokeAt, brokeKey: st.brokeKey || null, brokeSeam: st.brokeSeam || null, verdict: st.verdict, breaks: D.breaks,
    fb: fb && { seam: fb.seam, how: fb.how, cls: fb.cls, tags: def.nodes[sim.beams[fb.beam].a].tag + '-' + def.nodes[sim.beams[fb.beam].b].tag } };
}

module.exports = { runCard, L, SECS, CRASHES, crashes, runCrash, stampRatios, partOfBeam, partBase, attachLog };
