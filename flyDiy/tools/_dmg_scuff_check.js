#!/usr/bin/env node
// GATE DMGSCUFF (G2005, DMG-SCUFF) - THE DAMAGE DRAWN WHERE THE PHYSICS PUT IT, node only (skin_scuff.js's records on the
// skin GATE DMGSKIN measures: genWing's groups and every member's tube, bound as the flown cage snapshot is; two
// synthetic panes on the fuselage's top stations). On the user's validated land builds (the Cub, the Jodel, the metal
// Cessna), damage ON, the cases of _dmg_scuff_lib.js (an intact taxi, a 3 m/s taxi into a trunk, a wing-low slide, a
// nose-over into a stump, the 30 m/s trunk on the centreline):
//   1. ZERO WHEN NOTHING HAPPENED: the intact taxi sends no payload and makes no record; after a crash, a reset makes
//      every record zero again (and the fields read zero: the page's uDmgOn goes back to 0).
//   2. THE SLIDE PAINTS THE SIDE THAT SLID: on the wing-low slide every scraped vertex is on the low (left) side and none
//      faces up (the deck clean); the scrape follows the nodes that slid (30_solver.js scuffAdd).
//   3. THE CRUSH FOLLOWS THE MEMBERS THAT YIELDED: every crushed vertex is bound to an end of a member that took plastic
//      work; the most crushed vertices sit on the most strained members (the top by DMG.wB / (sigY A L)).
//   4. A PANE CRACKS ONLY WHERE ITS FRAME OR NODES TOOK THE HIT: each pane's severity equals the gate's own reading of its
//      nodes (their crush / slide) and its frame's set; the windscreen cracks in the 30 m/s trunk, the rear window does
//      not; nothing cracks on the intact taxi or the slide.
//   5. THE TORN BAND: torn bytes only on records with removed / torn triangles, full (255) only at their edges.
//   6. DETERMINISTIC: the same crash flown twice gives the same bytes (FNV of every record).
//   7. DAMAGE OFF: no payload, no record, in the 30 m/s trunk.
//   8. COST: a place's pass (us), the worst torn band (ms), the worst frame's tick at the page's budget, the hop's bytes.
//   9. THE PAGE (static): app.js calls skin_scuff.js only through scuffFor / scuffAttach / scuffFrame (scuffMat hands
//      back the material it was given with the layer off; scuffFrame returns on its first test); flown_bake.js's band
//      keeps a wrapper only a damage material carries; the solver's records only behind DMG_ON.
// Run: node tools/_dmg_scuff_check.js [--builds cub,jodel,metal]   (one final `GATE DMGSCUFF: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const BUILDS = (argv[argv.indexOf('--builds') + 1] && argv.includes('--builds') ? argv[argv.indexOf('--builds') + 1] : 'cub,jodel,metal').split(',');
const CASE_IDS = ['intact', 'taxi-3', 'slide-L', 'noseover', 'trunk-0'];

if (argv[0] === '--build') {
  const G = require('./_dmg_scuff_lib.js'), { SS, L } = G;
  const k = argv[1], SK = G.skinOf(k), d0 = SK.d0, out = { key: k, label: L.BUILDS[k].label, cases: {} };
  out.skin = { meshes: SK.meshes.length, verts: SK.meshes.reduce((a, m) => a + m.g.nv, 0) };
  const dotL = (p, o) => (p[o] - SK.mid[0]) * SK.left[0] + (p[o + 1] - SK.mid[1]) * SK.left[1] + (p[o + 2] - SK.mid[2]) * SK.left[2];
  for (const c of CASE_IDS) {
    const t0 = Date.now(), r = G.run(k, c, { skin: SK }), D = r.damage, C = { id: c, label: G.CASES[c].label };
    C.phys = { breaks: D.breaks, yields: D.yields, work: Math.round(D.work), scW: Math.round(D.scW || 0), crashed: D.crashed };
    C.payloads = r.payloads; C.passes = r.passes; C.recs = !!r.recs; C.hash = G.hashOf(r.recs); C.tickMax = +r.frameMax.toFixed(2); C.bound = r.bound;
    const n = { crush: 0, scrape: 0, torn: 0, soil: 0, verts: 0, scrapeR: 0, scrapeUp: 0, crushOrphan: 0, torn255Off: 0, tornNoDead: 0 };
    const panes = {};
    if (r.recs) {
      // the members by strain, the nodes of the members that took work
      const F = SS.fields(d0, r.D, SK.B), worked = new Uint8Array(d0.nodes.length);
      for (let bi = 0; bi < d0.beams.length; bi++) if (F.eB[bi] > 0) { worked[d0.beams[bi].a] = 1; worked[d0.beams[bi].b] = 1; }
      const order = Array.from(F.eB).map((e, bi) => [e, bi]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]);
      const sat = order.filter(x => x[0] >= SS.SC.eps1).length, topN = Math.max(20, sat);
      const topNodes = new Set(); for (const [, bi] of order.slice(0, topN)) { topNodes.add(d0.beams[bi].a); topNodes.add(d0.beams[bi].b); }
      const crushed = [];
      for (const R of r.recs) {
        const S = R.sc, nm = R.mesh.nm, Y0 = SK.B.Y0;
        if (S.cls === SS.CLS.glass) {
          // the gate's own reading of the pane: its nodes' hit and its frame's set (skin_scuff.panesOf's rule, re-derived)
          let hit = 0; const nodes = new Set();
          for (const u of S.pl) {
            const K = R.K, src = (R.active && R.w2) ? R.w2 : R.ww; let sw = 0; const ws = [];
            for (let q = 0; q < K; q++) { const w = src[u * K + q]; if (w > 0) { sw += w; ws.push([R.wi[u * K + q], w]); } }
            if (!ws.length) ws.push([R.wi[u * K], 1]), sw = 1;
            let h = 0; for (const [i, w] of ws) { h += (w / sw) * Math.max(F.cN[i], F.sI[i]); if (w / sw > 0.15) nodes.add(i); }
            if (h > hit) hit = h;
          }
          let sm = 0; for (let bi = 0; bi < d0.beams.length; bi++) { const b = d0.beams[bi]; if (F.setM[bi] > sm && (nodes.has(b.a) || nodes.has(b.b))) sm = F.setM[bi]; }
          const sm1 = Math.min(1, Math.max(0, (sm - SS.SC.paneSet0) / (SS.SC.paneSet1 - SS.SC.paneSet0))), sset = sm1 * sm1 * (3 - 2 * sm1);
          const want = Math.max(hit, sset), got = (S.panes && S.panes[0]) ? S.panes[0].sev : 0;
          let bytes = 0; for (let v = 0; v < R.nv; v++) if (S.rec[v * 4]) bytes++;
          panes[nm] = { sev: +got.toFixed(3), gate: +(want >= SS.SC.paneHit0 ? Math.min(1, want) : 0).toFixed(3), hit: +hit.toFixed(3), setMm: +(sm * 1000).toFixed(1), cracked: bytes > 0, verts: R.nv };
          continue;
        }
        const dead = R.dead, i0 = R.idx0 || R.idx;
        const onDead = new Uint8Array(R.nv);
        if (R.active && dead) for (let t = 0; t < R.nt; t++) if (dead[t] === 1 || dead[t] === 2) for (let e = 0; e < 3; e++) onDead[i0[t * 3 + e]] = 1;
        for (let v = 0; v < R.nv; v++) {
          n.verts++;
          const c8 = S.rec[v * 4], s8 = S.rec[v * 4 + 1], t8 = S.rec[v * 4 + 2];
          if (c8) {
            n.crush++; crushed.push([c8, R, v]);
            // bound to an end of a worked member
            const K = R.K, src = (R.active && R.w2) ? R.w2 : R.ww; let ok = false;
            for (let q = 0; q < K; q++) if (src[v * K + q] > 0 && worked[R.wi[v * K + q]]) ok = true;
            if (!R.ww[v * K] && !ok) ok = worked[R.wi[v * K]];
            if (!ok) n.crushOrphan++;
          }
          if (s8) {
            n.scrape++;
            if (S.rec[v * 4 + 3]) n.soil++;
            if (dotL(R.mesh.g.pos, v * 3) < -0.05) n.scrapeR++;                 // on the right (the high side)
            const nr = S.nrm; if (nr[v * 3] * Y0[0] + nr[v * 3 + 1] * Y0[1] + nr[v * 3 + 2] * Y0[2] > 0.5) n.scrapeUp++;   // facing up
          }
          if (t8) { n.torn++; if (!(R.active && dead)) n.tornNoDead++;
            // full (255) only AT the edge: on a gone triangle, or within 1 mm of one (an unwelded seam's twin vertex)
            if (t8 === 255 && !onDead[v]) { const P = R.mesh.g.pos; let near = false;
              for (let w = 0; w < R.nv && !near; w++) if (onDead[w] && Math.hypot(P[v*3] - P[w*3], P[v*3+1] - P[w*3+1], P[v*3+2] - P[w*3+2]) <= 0.001) near = true;
              if (!near) n.torn255Off++; } }
        }
      }
      // the most crushed: the top 50 by byte, ties broken by record order - on the top members' nodes?
      crushed.sort((a, b) => b[0] - a[0]);
      let onTop = 0, top = crushed.slice(0, 50);
      for (const [, R, v] of top) { const K = R.K, src = (R.active && R.w2) ? R.w2 : R.ww; let ok = false; for (let q = 0; q < K; q++) if (src[v * K + q] > 0.2 && topNodes.has(R.wi[v * K + q])) ok = true; if (!R.active && topNodes.has(R.wi[v * K])) ok = true; if (ok) onTop++; }
      n.topN = top.length; n.topOn = onTop; n.topMembers = topN;
    }
    C.n = n; C.panes = panes; C.secs = +((Date.now() - t0) / 1000).toFixed(1);
    // the reset after the crash: every record zero, the fields zero
    if (r.recs && c === 'trunk-0') {
      r.sim.reset(0);
      const P = G.SH.simDmgHop(r.sim, { sB: r.D.sB, sS: r.D.sS, t: -Infinity }, d0.refs.noseFrame[0], 0);
      if (P) G.SV.simViewDmgApply(r.D, P);
      const F2 = SS.fields(d0, r.D, SK.B), st = SS.state(); SS.begin(st, F2, r.recs); while (st.q.length) SS.tick(st, Infinity);
      let nz = 0; for (const R of r.recs) { for (let v = 0; v < R.nv * 4; v++) if (R.sc.rec[v]) nz++; for (let v = 0; v < R.nv; v++) if (R.sc.dir[v * 4] || R.sc.dir[v * 4 + 1] || R.sc.dir[v * 4 + 2]) nz++; }
      C.reset = { payload: !!P, zeroFields: F2.zero, nonzero: nz, any: r.recs.some(R => R.sc.any) };
    }
    out.cases[c] = C;
  }
  // determinism: the 30 m/s trunk again, fresh
  const r2 = G.run(k, 'trunk-0', { skin: SK });
  out.det = { a: out.cases['trunk-0'].hash, b: G.hashOf(r2.recs) };
  // costs, warm, on the last run's records and state
  {
    const F = SS.fields(d0, r2.D, SK.B); let np = 0;
    for (let rep = 0; rep < 2; rep++) { np = 0; const t0 = process.hrtime.bigint(); for (const R of r2.recs) { for (const u of R.sc.pl) SS.place(R, F, u); np += R.sc.pl.length; } out.placeUs = Number(process.hrtime.bigint() - t0) / 1000 / np; }
    let tw = 0; for (const R of r2.recs) { const t0 = process.hrtime.bigint(); SS.tornBand(R); tw = Math.max(tw, Number(process.hrtime.bigint() - t0) / 1e6); }
    out.tornMs = tw;
    const st = SS.state(); SS.begin(st, F, r2.recs); let worst = 0, ticks = 0;
    while (st.q.length) { const t0 = process.hrtime.bigint(); SS.tick(st, 2000); worst = Math.max(worst, Number(process.hrtime.bigint() - t0) / 1e6); ticks++; }
    out.tick2000 = { worst, ticks };
    out.places = np;
  }
  // damage OFF: the trunk at 30 m/s, no payload, no record
  const off = G.run(k, 'trunk-0', { skin: SK, damage: false });
  out.off = { payloads: off.payloads, recs: !!off.recs, scW: off.damage.scW || 0, sW: off.damage.sW ? off.damage.sW.length : 0 };
  // the hop's bytes in the trunk crash (the payloads carrying the scuff's keys)
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const run = k => new Promise(res => {
    const ch = spawn(process.execPath, [__filename, '--build', k], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1500) }); });
  });
  const R = {}, q = BUILDS.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + BUILDS.length + ' builds, damage on)');
  for (const k of BUILDS) {
    const r = R[k];
    console.log((r.label || k) + ': the skin ' + (r.skin ? r.skin.meshes + ' meshes, ' + r.skin.verts + ' vertices (genWing\'s groups, every member\'s tube, two panes)' : '?'));
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    const C = r.cases;
    for (const id of CASE_IDS) {
      const c = C[id], n = c.n;
      console.log('  ' + c.label + ': ' + c.phys.breaks + ' broken, ' + c.phys.yields + ' yields, ' + c.phys.work + ' J plastic, ' + c.phys.scW + ' J slid; '
        + c.payloads + ' payloads, ' + c.passes + ' passes; crush ' + n.crush + ' / scrape ' + n.scrape + ' (soil ' + n.soil + ') / torn ' + n.torn + ' of ' + n.verts + ' vertices; panes '
        + Object.entries(c.panes).map(([nm, P]) => nm + ' ' + P.sev + (P.cracked ? ' cracked' : ' clean') + ' (hit ' + P.hit + ', set ' + P.setMm + ' mm)').join(', ') + ' [' + c.secs + ' s]');
      if (n.crush) yes(n.crushOrphan === 0, id + ': every crushed vertex is bound to an end of a member that took plastic work (' + n.crushOrphan + ' not, of ' + n.crush + ')');
      if (n.topN) yes(n.topOn >= 0.9 * n.topN, id + ': the 50 most crushed vertices sit on the most strained members (' + n.topOn + ' of ' + n.topN + ' on the top ' + n.topMembers + ' by plastic strain)');
      for (const [nm, P] of Object.entries(c.panes)) yes(Math.abs(P.sev - P.gate) < 1e-3 && P.cracked === (P.gate > 0), id + ': the ' + nm + ' cracks exactly as its nodes and frame say (severity ' + P.sev + ', the gate\'s ' + P.gate + ')');
      if (n.torn) yes(n.tornNoDead === 0 && n.torn255Off === 0, id + ': the torn band only where triangles were removed or torn, full only at their edge (' + n.tornNoDead + ' / ' + n.torn255Off + ' off)');
    }
    yes(C.intact.payloads === 0 && !C.intact.recs && C.intact.hash === '811c9dc5', 'intact: no payload, no record, nothing drawn');
    const sl = C['slide-L'].n;
    yes(sl.scrape > 0 && sl.scrapeR === 0, 'the wing-low slide scrapes the low (left) side only: ' + sl.scrape + ' vertices scraped, ' + sl.scrapeR + ' on the right');
    yes(sl.scrapeUp === 0, 'the wing-low slide: no scraped vertex faces up (' + sl.scrapeUp + ')');
    yes(sl.soil === sl.scrape, 'the slide on grass stains what it scraped (' + sl.soil + ' of ' + sl.scrape + ')');
    yes(C['slide-L'].phys.yields === 0 ? C['slide-L'].n.crush === 0 : true, 'the slide without a yield crushes nothing');
    const tp = C['trunk-0'].panes;
    yes(tp.windscreen && tp.windscreen.cracked && tp.rearWindow && !tp.rearWindow.cracked, 'the 30 m/s trunk cracks the windscreen (' + (tp.windscreen && tp.windscreen.sev) + '), not the rear window');
    for (const id of ['intact', 'slide-L']) yes(Object.values(C[id].panes).every(P => !P.cracked), id + ': no pane cracked');
    const rs = C['trunk-0'].reset;
    yes(rs && rs.payload && rs.zeroFields && rs.nonzero === 0 && !rs.any, 'a reset after the crash: a payload, the fields zero, every record byte zero (' + (rs && rs.nonzero) + ' non-zero)');
    yes(r.det.a === r.det.b, 'deterministic: the 30 m/s trunk twice, the same bytes (' + r.det.a + ' / ' + r.det.b + ')');
    yes(r.off.payloads === 0 && !r.off.recs && r.off.sW === 0, 'damage OFF, the 30 m/s trunk: no payload, no record, no slide array (' + r.off.payloads + ')');
    console.log('  cost: ' + r.placeUs.toFixed(3) + ' us a place (' + r.places + ' places), the worst torn band ' + r.tornMs.toFixed(2) + ' ms, a tick of 2000 places at worst ' + r.tick2000.worst.toFixed(2) + ' ms (' + r.tick2000.ticks + ' ticks)');
    yes(r.placeUs < 3 && r.tick2000.worst < 25, 'the pass is cheap enough to budget (a place under 3 us, a 2000-place tick under 25 ms in node)');
  }
  // ---- 9. the page, static ----
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const lines = app.split('\n');
  const a0 = lines.findIndex(l => l.indexOf('---- G2000-G2009 (DMG-SCUFF)') >= 0), a1 = lines.findIndex((l, i) => i > a0 && l.indexOf('G1002 (A6-GROUND') >= 0);
  const outside = lines.map((l, i) => [l, i]).filter(([l, i]) => /SKIN_SCUFF/.test(l) && !(i > a0 && i < a1));
  yes(a0 > 0 && a1 > a0 && outside.length === 0, 'app.js reaches skin_scuff.js only inside its DMG-SCUFF block (' + outside.length + ' outside)');
  yes(/const scuffMat = \(m, kind\) => \{\n\s+if \(!SCUFF \|\|/.test(app) && /const SCUFF = data\.cage \? scuffFor\(curDef\) : null;/.test(app), 'buildModel: scuffMat hands back the material it was given unless the layer is on (scuffFor)');
  yes(/function scuffFrame\(o\) \{\n\s+const at = model && model\.scuff;\n\s+if \(!at \|\| model\.gen\) return;/.test(app), 'scuffFrame returns on its first test with the layer off (no model.scuff)');
  yes(/const SCUFF = data\.cage \? scuffFor[\s\S]*?scuff: scuffAt,/.test(app) && /const scuffAt = SCUFF \? scuffAttach\(/.test(app), 'the attributes are attached only with the layer on (scuffAttach behind SCUFF)');
  const fb = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flown_bake.js'), 'utf8');
  yes(/const re = m\.userData && m\.userData\.scuffRe;\n\s+b = m\.userData && m\.userData\.flownBaked \? copyMat\(m, re \? re\(FB_BAND_HOOK\) : FB_BAND_HOOK/.test(fb), 'flown_bake.js: the baked band keeps a wrapper only a damage material carries (scuffRe)');
  const sol = fs.readFileSync(path.join(ROOT, 'src', 'core', '30_solver.js'), 'utf8');
  // (the call sites in the step: not the definitions, and not scuffTrunk's own call of scuffAdd - reached only through them)
  const calls = sol.split('\n').filter(l => /scuffAdd\(|scuffTrunk\(/.test(l) && !/function scuff/.test(l) && !/if \(st > 0\.05\) scuffAdd/.test(l));
  yes(calls.length >= 2 && calls.every(l => /DMG_ON/.test(l)), 'the solver records the slide only behind DMG_ON (' + calls.length + ' call sites)');
  console.log('GATE DMGSCUFF: ' + (fails ? 'FAIL' : 'PASS') + ' (' + (checks - fails) + '/' + checks + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  process.exit(fails ? 1 : 0);
})();
