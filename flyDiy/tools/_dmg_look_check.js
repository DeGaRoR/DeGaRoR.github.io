#!/usr/bin/env node
// GATE DMGLOOK (G3770-G3773, DMG-LOOKS: src/viewer/dmg_members.js says what and why) - THE STRUCTURE BY MATERIAL, node
// only. On every validated land build's flown cage snapshot (tools/_dmg_wall_lib.js, headless), damage ON, the
// certificate stamped, the brief's crashes (the 30 m/s trunk on the centreline and 2.5 m out, the 12 m/s nose-over, the
// 3 m/s taxi into a trunk: tools/_dmg_wall_study.js go), the wreck bound by inheritance as app.js brkCage binds it, the
// records' events every frame from the first break, three ways side by side on the same crash:
//   ref - master's skin_break.js (git show <base>:flyDiy/src/viewer/skin_break.js), as it stands today;
//   off - this tree's, the switch OFF (?dmglook unset: OPT.looks false);
//   on  - this tree's, the switch ON: dmg_members.js plan() at each break event, the records' R.look.
// Gated:
//   a. OFF IS MASTER: every record's index after every event, off against ref - the same bytes;
//   b. THE PARTING RULE (on): no triangle of a member's own places (all three on it) is removed by a break of a member
//      RELEASED (a fitting, a cluster's cut, a group: whole with the part that came off) nor of a KINKED member on one
//      piece (unparted) - unless the pool draws it; today's (ref) count of the same printed beside it;
//   c. THE POOL'S PLAN: at most SLOTS slots, each a member the snapshot draws (R.mem), hide exactly the slotted members;
//      the plan's cost at an event under 2 ms (the worst; measure() once a binding reported);
//   d. THE POSE (dmg_members.js pose, the vertex shader's mirror) on every slot at three moments of the wreck (the first
//      plan with slots, the middle, the end): every vertex finite; a WHOLE member's piece 0 starts on its end a and
//      piece 1 ends on its end b (the centreline within 1 mm of the live nodes), a bent whole member's centreline keeps
//      its rest length (within 3 %: two legs meeting at a crease); a STUB starts on its own node (within 1 mm) and
//      reaches no farther than its leg plus its lip or its slivers (+1 mm);
//   e. damage OFF / nothing broken: no plan is made (the page's brkLook runs only once something is broken - brkCage).
// Run: node tools/_dmg_look_check.js [--only cub,jodel] [--cases trunk-0,noseover] [--par 3] [--base origin/master]
// (one final `GATE DMGLOOK: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), { spawn, execSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const BUILDS = ['cub', 'jodel', 'metal'], CASES = 'trunk-0,trunk-2.5,noseover,taxi';
const PLAN_MS = 2, END_MM = 1e-3, LEN_TOL = 0.03;

// ---------------------------------------------------------------------------------------------------------------------
// ONE BUILD (a child): node _dmg_look_check.js --child <build> --cases ... --ref <file> --out <json>
function child(k, cases, refFile, outFile) {
  const WS = require('./_dmg_wall_study.js');
  const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
  const SBR = require(refFile);
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
  const DM = require(path.join(ROOT, 'src', 'viewer', 'dmg_members.js'));
  const P = WS.prepare(k), n = P.def.nodes.length, nb = P.def.beams.length;
  const out = { build: k, cases: [] };
  for (const cid of cases.split(',')) {
    const t0 = Date.now(), G = WS.go(k, WS.CASES[cid]), sim = G.sim, core = P.def.refs.noseFrame[0];
    const hop = SH.simDmgHop0(), D = SV.simViewDmgState(n, nb);
    const mk = (Sb, looks) => {
      Sb.OPT.looks = looks;
      const recs = P.groups.map(g => SB_make(Sb, g));
      const E = recs.map((R, i) => { const g = P.groups[i], e = { R, cv: g.cv, obj: g.obj };
        if (g.layer.indexOf('cowl') >= 0) { e.cowl = new Uint8Array(g.nv); for (let v = 0; v < g.nv; v++) if (g.layer[v] === 'cowl') e.cowl[v] = 1; } return e; });
      Sb.bindInherit(E, P.T, P.rest);
      Sb.OPT.looks = false;
      return { Sb, recs, E, NF: {} };
    };
    const SB_make = (Sb, g) => Sb.make({ nv: g.nv, idx: g.idx.slice() }, Sb.INH_K, { fabric: P.fabric && g.cv.indexOf(Sb.INH.cover) >= 0, cage: true, pos: g.bD, rest: P.rest, weld: true, rideAll: true });
    let ref = null, off = null, on = null, M = null, Pl = null, lastV = -1;
    const m = { events: 0, offDiff: 0, offFirst: null, relCut: 0, relCutRef: 0, kinkCut: 0, kinkCutRef: 0, slotsMax: 0, slotBad: 0, hideBad: 0,
      planMs: 0, planN: 0, measureMs: 0, pose: [], poseBad: 0, poseWorst: null, modes: {}, parts: null, nonFinite: 0 };
    const poseAt = new Set();
    let firstSlots = -1;
    // the members' own removed triangles, by the rule's class (released / unparted kink), on a scheme
    const cutsOf = (sc, memOf) => { let rel = 0, kink = 0;
      for (let ri = 0; ri < sc.recs.length; ri++) { const R = sc.recs[ri], MM = memOf[ri]; if (!MM || !R.dead) continue; const ix = R.idx0 || R.idx;
        for (let t = 0; t < R.nt; t++) { if (R.dead[t] !== 1) continue; const bi = MM[ix[t * 3]]; if (bi < 0 || MM[ix[t * 3 + 1]] !== bi || MM[ix[t * 3 + 2]] !== bi) continue;
          if (Pl && Pl.hide[bi]) continue;
          const c = D.how ? D.how[bi] : 0, b = P.def.beams[bi], one = !D.pc || D.pc[b.a] === D.pc[b.b];
          if (c === 5 || c === 6 || c === 8) rel++; else if (c === 2 && one) kink++; } }
      return { rel, kink }; };
    for (let s = 1; s <= G.N; s++) {
      sim.step(1 / 60);
      const PI = SH.simDmgHop(sim, hop, core, 0); if (PI) SV.simViewDmgApply(D, PI);
      if (!D.br.length) continue;
      if (!ref) { ref = mk(SBR, false); off = mk(SB, false); on = mk(SB, true);
        const t1 = process.hrtime.bigint(); M = DM.measure(on.recs, P.T, P.rest); m.measureMs = Number(process.hrtime.bigint() - t1) / 1e6; }
      if (D.vB !== lastV) {
        lastV = D.vB;
        const t1 = process.hrtime.bigint(); Pl = DM.plan(P.T, D, M, P.rest, Pl); const ms = Number(process.hrtime.bigint() - t1) / 1e6;
        m.planMs = Math.max(m.planMs, ms); m.planN++;
        for (const R of on.recs) R.look = Pl;
        // c: the plan
        m.slotsMax = Math.max(m.slotsMax, Pl.slots.length);
        if (Pl.slots.length > DM.SLOTS) m.slotBad++;
        const sl = new Set(); for (const q of Pl.slots) { sl.add(q.bi); if (!M.drawn[q.bi]) m.slotBad++; }
        for (let bi = 0; bi < nb; bi++) if (!!Pl.hide[bi] !== sl.has(bi)) m.hideBad++;
        if (Pl.slots.length && firstSlots < 0) firstSlots = s;
      }
      for (const sc of [ref, off, on]) for (const R of sc.recs) sc.Sb.event(R, P.T, D, P.rest, R.g.pos);
      m.events++;
      // a: off against ref, every record's index
      for (let ri = 0; ri < ref.recs.length; ri++) { const a = ref.recs[ri].idx, b = off.recs[ri].idx;
        if (a.length !== b.length) { m.offDiff++; continue; }
        for (let q = 0; q < a.length; q++) if (a[q] !== b[q]) { m.offDiff++; if (!m.offFirst) m.offFirst = { step: s, rec: ri, at: q }; break; } }
      // b: the parting rule
      const memOf = on.recs.map(R => R.mem);
      const cOn = cutsOf(on, memOf), cRef = cutsOf(ref, memOf);
      m.relCut = Math.max(m.relCut, cOn.rel); m.kinkCut = Math.max(m.kinkCut, cOn.kink);
      m.relCutRef = Math.max(m.relCutRef, cRef.rel); m.kinkCutRef = Math.max(m.kinkCutRef, cRef.kink);
      SB.nodeFrames(on.NF, P.T, D, P.rest, sim.p, true);
      // d: the pose, at three moments
      const mid = firstSlots > 0 ? Math.round((firstSlots + G.N) / 2) : -1;
      if (Pl && Pl.slots.length && (s === firstSlots || s === mid || s === G.N)) poseCheck(s);
    }
    function poseCheck(s) {
      const U = { data: null, used: 0, slots: [], beams: null, frames: 0, ms: 0, msMax: 0, events: 0, tex: { needsUpdate: false } };
      U.data = new Float32Array(DM.SLOTS * DM.TX * 4);
      const mesh = { userData: { look: U }, geometry: { setDrawRange() {} }, visible: false, position: { set() {} }, updateMatrix() {} };
      const O = [sim.p[0], sim.p[1], sim.p[2]];
      DM.assign(mesh, Pl, M, P.T, P.rest); DM.frame(mesh, sim.p, on.NF.q, O);
      let bad = 0, worst = null;
      const note = (why, q, v) => { bad++; if (!worst || v > worst.v) worst = { why, bi: q.bi, mode: q.mode, v: +(+v).toFixed(4) }; };
      for (let j = 0; j < U.used; j++) {
        const S = DM.slotTexels(mesh, j), q = U.slots[j];
        const A = [S[0], S[1], S[2]], B = [S[4], S[5], S[6]], L0 = S[19], r = S[24], hh = S[25];
        const ctr = (u, pc) => { const c = [0, 0, 0]; for (let k = 0; k < DM.AROUND; k++) { const p = DM.pose(S, u, k, pc); for (let e = 0; e < 3; e++) c[e] += p[e] / DM.AROUND;
          for (let e = 0; e < 9; e++) if (!Number.isFinite(p[e])) { m.nonFinite++; note('non-finite', q, 1); } } return c; };
        const d = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
        const c = d(A, B), mode = S[7], live = (mode === DM.MODE.kink || mode === DM.MODE.crush) && c > DM.KINK_STRETCH * L0 ? (mode === DM.MODE.kink ? DM.MODE.torn : DM.MODE.sliver) : mode;
        m.modes[live] = (m.modes[live] || 0) + 1;
        if (live === DM.MODE.torn || live === DM.MODE.sliver) {
          for (const pc of [0, 1]) { const st = ctr(0, pc), own = pc ? B : A, e0 = d(st, own); if (e0 > END_MM) note('stub start off its node', q, e0);
            const tb = S[27], legL = (pc ? 1 - tb : tb) * L0, reach = live === DM.MODE.sliver ? legL + 6 * 2 * Math.max(r, hh) : legL + 0.9 * r;
            for (let i = 0; i < DM.RINGS; i++) { const u = i / (DM.RINGS - 1); for (let k = 0; k < DM.AROUND; k++) { const p = DM.pose(S, u, k, pc); if (p[8] > reach + 1e-3) note('stub past its reach', q, p[8] - reach); } } }
        } else {
          const s0 = ctr(0, 0), s1 = ctr(1, 1), e0 = d(s0, A), e1 = d(s1, B);
          if (live !== DM.MODE.crush) { if (e0 > END_MM + 0.05 * r) note('whole: piece 0 off end a', q, e0); if (e1 > END_MM + 0.05 * r) note('whole: piece 1 off end b', q, e1); }
          if (c < L0 * 0.9995 && live !== DM.MODE.crush) {   // bent: the legs keep the rest length
            let Lc = 0, prev = null; for (const pc of [0, 1]) for (let i = 0; i < DM.RINGS; i++) { const cc = ctr(i / (DM.RINGS - 1), pc); if (prev) Lc += d(prev, cc); prev = cc; }
            const rel = Math.abs(Lc - L0) / L0; if (rel > LEN_TOL) note('bent: centreline length off its rest', q, rel); }
        }
      }
      m.pose.push({ step: s, slots: U.used, bad });
      m.poseBad += bad; if (worst && (!m.poseWorst || worst.v > m.poseWorst.v)) m.poseWorst = Object.assign({ step: s }, worst);
    }
    // e: damage off - the same crash with nothing broken at all (the taxi): no break, no plan (the page asks for none)
    if (Pl) { let w = 0, u = 0, st = 0; for (const x of Pl.part) { if (x !== x) continue; if (x < 0) u++; else if (x === 0 || x === 1) w++; else st++; } m.parts = { whole: w, unparted: u, station: st }; }
    out.cases.push(Object.assign({ id: cid, ms: Date.now() - t0, broken: D.br.length, planned: !!Pl, slots: Pl ? Pl.slots.length : 0 }, m));
  }
  fs.writeFileSync(outFile, JSON.stringify(out));
}

// ---------------------------------------------------------------------------------------------------------------------
if (argv[0] === '--child') { child(argv[1], opt('cases', CASES), opt('ref', null), opt('out', null)); process.exit(0); }

const only = opt('only', null), keys = BUILDS.filter(k => !only || only.split(',').includes(k)), PAR = +opt('par', 3), cases = opt('cases', CASES);
const base = opt('base', 'origin/master');
const refFile = path.join(os.tmpdir(), 'dmglook_sb_ref_' + process.pid + '.js');
fs.writeFileSync(refFile, execSync('git show ' + base + ':flyDiy/src/viewer/skin_break.js', { cwd: ROOT, maxBuffer: 1 << 26 }));
const t0 = Date.now();
const one = k => new Promise(res => {
  const outF = path.join(os.tmpdir(), 'dmglook_' + k + '_' + process.pid + '.json');
  const p = spawn(process.execPath, ['--max-old-space-size=4096', __filename, '--child', k, '--cases', cases, '--ref', refFile, '--out', outF], { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('exit', code => { let r = null; try { r = JSON.parse(fs.readFileSync(outF, 'utf8')); fs.unlinkSync(outF); } catch (e) {} res({ k, code, r }); });
});
(async () => {
  const res = [], q = keys.slice();
  await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) res.push(await one(q.shift())); }));
  try { fs.unlinkSync(refFile); } catch (e) {}
  let ok = true;
  const yes = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) ok = false; };
  for (const k of keys) {
    const R = res.find(x => x.k === k);
    if (!R || !R.r) { yes(false, k + ': the child failed (exit ' + (R && R.code) + ')'); continue; }
    for (const c of R.r.cases) {
      const tag = k + ' ' + c.id + ' (' + (c.ms / 1000).toFixed(0) + ' s, broken ' + c.broken + ', ' + c.events + ' event frames, slots ' + c.slots + ' max ' + c.slotsMax + ')';
      if (!c.broken) { yes(!c.planned, tag + ' e. nothing broken: no plan'); continue; }
      yes(c.offDiff === 0, tag + ' a. off = master: ' + c.offDiff + ' record-events differ' + (c.offFirst ? ' (first ' + JSON.stringify(c.offFirst) + ')' : ''));
      yes(c.relCut === 0 && c.kinkCut === 0, tag + ' b. the parting rule: own triangles cut on released members ' + c.relCut + ' (today ' + c.relCutRef + '), on unparted kinks ' + c.kinkCut + ' (today ' + c.kinkCutRef + ')');
      yes(c.slotBad === 0 && c.hideBad === 0 && c.planMs < PLAN_MS, tag + ' c. the plan: slots in bounds and drawn (bad ' + c.slotBad + '), hide = slots (bad ' + c.hideBad + '), worst plan ' + c.planMs.toFixed(2) + ' ms over ' + c.planN + ' events (measure ' + c.measureMs.toFixed(1) + ' ms once); stations ' + JSON.stringify(c.parts));
      yes(c.poseBad === 0 && c.nonFinite === 0, tag + ' d. the pose: ' + c.pose.map(p => p.slots + ' slots @' + p.step + (p.bad ? ' bad ' + p.bad : '')).join(', ') + ' - modes ' + JSON.stringify(c.modes) + (c.poseWorst ? ' worst ' + JSON.stringify(c.poseWorst) : ''));
    }
  }
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  console.log('GATE DMGLOOK: ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
})();
