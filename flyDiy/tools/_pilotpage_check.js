#!/usr/bin/env node
// GATE PILOTPAGE (G3320, the PILOT COORDINATOR, 19 Oct) - THE PILOT FLOWN IN THE PAGE, NOT ONLY IN NODE.
//
// The user (18 Oct, through A0): "the pilot tests should ensure to do some actual browser-based flying. Not for all
// tests, but to validate, in case the numerical simulations would not be fully representative." And the Rufus B
// repro of 18-19 Oct showed what a node-only bar misses: the user flies the STUDENT, every rig flew the default
// expert - node reproduced the swing the moment it flew the student.
//
//   node tools/_pilotpage_check.js            -> "GATE PILOTPAGE: PASS|FAIL (n)"
//   --only=cub_expert,rufus_student   --keep (the run's files kept: casts, samples, reports)   --out=<dir>
//
// A GPU job on a QUIET box (the page's legs at the user's dilation): boxlock.sh take gpu <who> "TIMED-free ..."
// first. Run when 43_pilot / 39b_servos / 38_nav / src/core change (A0, 18 Oct); ~30 min for the default list.
//
// THE LEGS are tools/pilotpage_legs.json - ONE list (the build paths, the order, the persona, the page query, the
// accepted known faults): a leg of kind 'judge' is held to the bar, 'info' is printed and never red. Per leg:
//   the PAGE: tools/tour_real.js (a headed Chrome on the GPU, the page from this tree, the build in the WIP slot, the
//     route pref from the order, the persona set in the shed's #selPersona, damage the game's default, 2x);
//   the NODE twin (node: true legs - the default pilot only, tour_real_node has no persona): tools/tour_real_node.js
//     --game, then tools/tour_real_report.js holds the page's track to node's.
// THE BAR (judge legs):
//   1 the leg stopped at its To (STOPPED, the pilot's outcome 'completed'), the page rig named no fault (no crash,
//     no To-picker failure, no time-out);
//   2 node twins: the page's touchdown within bar.tdDeltaM (60 m) of node's, and no stretch of the page's track more
//     than bar.stretchM (50 m) from node's (tour_real_report's 'every stretch over 20 m');
//   3 a known class (leg.known) is printed beside the leg, never excused silently.
// The node twins run FIRST, in parallel (CPU), the page legs after them one at a time (the GPU, a quiet CPU).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, spawnSync } = require('child_process');

const T = __dirname, ROOT = path.resolve(T, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const KEEP = argv.includes('--keep');
const LIST = JSON.parse(fs.readFileSync(path.join(T, 'pilotpage_legs.json'), 'utf8'));
const ONLY = opt('only', null) ? new Set(opt('only').split(',')) : null;
const LEGS = LIST.legs.filter(L => !ONLY || ONLY.has(L.id));
const BAR = Object.assign({ tdDeltaM: 60, stretchM: 50 }, LIST.bar || {});
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
// (the disk rule, 19 Oct: the run's files under the system temp, removed at the end unless --keep)
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'pilotpage_' + stamp)));
fs.mkdirSync(OUT, { recursive: true });
const log = s => console.log(s);
const node = process.execPath;

function runNodeTwin(L) {
  return new Promise(res => {
    const out = path.join(OUT, L.id + '_node.json');
    const p = spawn(node, ['--max-old-space-size=2048', path.join(T, 'tour_real_node.js'), '--root', ROOT, '--game', '--build', L.build,
      '--order', L.order, '--damage', String(L.damage || 0), '--out', out], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('close', code => res({ code, out, err: err.slice(-400) }));
  });
}

function runPage(L) {
  const dir = path.join(OUT, L.id);
  const a = [path.join(T, 'tour_real.js'), '--root', ROOT, '--build', L.build, '--order', L.order, '--damage', String(L.damage || 0),
    '--rate', '2', '--cast-nth', '60', '--out', dir];
  if (L.persona) a.push('--persona', L.persona);
  if (L.q) a.push('--q', L.q);
  const r = spawnSync(node, a, { encoding: 'utf8', timeout: (L.timeoutMin || 15) * 60_000, maxBuffer: 64 << 20 });
  const txt = (r.stdout || '') + (r.stderr || '');
  const udd = (txt.match(/profile (\S*tour_real_udd_\S+)/) || [])[1];
  if (udd && !KEEP) try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  let legs = null; try { legs = JSON.parse(fs.readFileSync(path.join(dir, 'legs.json'), 'utf8')); } catch (e) {}
  return { dir, legs, timedOut: !!(r.error && r.error.code === 'ETIMEDOUT'), tail: txt.split('\n').filter(Boolean).slice(-3).join(' | ') };
}

function compare(L, pageDir, nodeJson) {
  const out = path.join(OUT, L.id + '_cmp');
  spawnSync(node, [path.join(T, 'tour_real_report.js'), '--root', ROOT, '--page', pageDir, '--node', nodeJson, '--out', out, '--no-media'],
    { encoding: 'utf8', timeout: 5 * 60_000 });
  try { return JSON.parse(fs.readFileSync(path.join(out, 'compare.json'), 'utf8')).legs[0]; } catch (e) { return null; }
}

(async () => {
  log('PILOTPAGE: ' + LEGS.length + ' legs (' + LEGS.map(L => L.id).join(', ') + ') · out ' + OUT);
  const twins = {};
  const nodeLegs = LEGS.filter(L => L.node);
  if (nodeLegs.length) {
    log('  node twins first (' + nodeLegs.map(L => L.id).join(', ') + ')');
    const rs = await Promise.all(nodeLegs.map(runNodeTwin));
    nodeLegs.forEach((L, i) => { twins[L.id] = rs[i]; log('    ' + L.id + ' node exit ' + rs[i].code + (rs[i].code ? ' ' + rs[i].err : '')); });
  }
  let red = 0;
  for (const L of LEGS) {
    const t0 = Date.now(), P = runPage(L);
    const G = P.legs && P.legs.legs && P.legs.legs[0];
    const rep = G && G.report && G.report.report;
    const why = [];
    if (P.timedOut) why.push('the page rig timed out');
    if (!G) why.push('no leg recorded (' + P.tail + ')');
    else {
      if (!(G.stop && G.stop.ph === 'STOPPED')) why.push('not STOPPED at ' + L.order.split(',').pop() + ' (' + (G.stop ? G.stop.ph : G.report && G.report.phase) + ')');
      if (!rep || rep.outcome !== 'completed') why.push("the pilot's outcome " + (rep ? rep.outcome : 'none'));
      if (G.faults && G.faults.length) why.push('rig faults ' + G.faults.map(f => f.k + (f.note ? ': ' + String(f.note).slice(0, 80) : '')).join('; '));
    }
    let cmpNote = '';
    if (L.node && G) {
      const tw = twins[L.id];
      const C = tw && !tw.code ? compare(L, P.dir, tw.out) : null;
      if (!C) why.push('no page-vs-node comparison');
      else {
        const td = C.delta && C.delta.td, runs = (C.dev && C.dev.runs) || [];
        const worst = runs.reduce((m, r) => Math.max(m, r.max || 0), 0);
        cmpNote = ' · vs node: touchdown ' + (td == null ? '-' : td.toFixed(1) + ' m') + ', track p95 ' + (C.dev ? C.dev.p95 : '-') + ' m, worst stretch ' + worst.toFixed(0) + ' m';
        if (td == null || Math.abs(td) > BAR.tdDeltaM) why.push('touchdown ' + (td == null ? 'missing' : td.toFixed(1) + ' m') + ' from node\'s (bar ' + BAR.tdDeltaM + ')');
        if (worst > BAR.stretchM) why.push('the page flew ' + worst.toFixed(0) + ' m off node\'s track (bar ' + BAR.stretchM + ')');
      }
    }
    const land = rep && rep.landing ? ' · touch ' + rep.landing.V + ' m/s, sink ' + rep.landing.sink + ', ' + rep.landing.tdIn + ' m in' + (rep.landing.onStrip === false ? ' OFF THE STRIP' : '') : '';
    const verd = rep && rep.verdicts ? ' · said ' + [...new Set(rep.verdicts.map(v => v.code))].join(',') : '';
    const head = L.id + ' (' + L.order + ', ' + (L.persona || 'expert') + ', ' + ((Date.now() - t0) / 60000).toFixed(1) + ' min)';
    if (L.kind === 'info') log('INFO ' + head + (why.length ? ': ' + why.join('; ') : ': clean') + land + verd + (L.known ? ' [known: ' + L.known + ']' : ''));
    else if (why.length) { red++; log('FAIL ' + head + ': ' + why.join('; ') + land + verd + cmpNote + (L.known ? ' [known: ' + L.known + ']' : '')); }
    else log('PASS ' + head + land + verd + cmpNote + (L.known ? ' [known: ' + L.known + ']' : ''));
  }
  if (!KEEP) try { fs.rmSync(OUT, { recursive: true, force: true }); } catch (e) {}
  log(red ? 'GATE PILOTPAGE: FAIL (' + red + ')' : 'GATE PILOTPAGE: PASS');
  process.exit(red ? 1 : 0);
})();
