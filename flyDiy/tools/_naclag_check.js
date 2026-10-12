#!/usr/bin/env node
// _naclag_check.js - GATE NACLAG (G2880 NACELLE-LAG, 2026-10-11): A WING-MOUNTED UNIT STANDS ON THIS BUILD'S WING.
//
// The bug (found by COWL-FIT G2860): the cowl's engineFaces read window.CAGE_WING for the over-the-wing pylon and the
// nacelle pair, but the cowl and engine layers run BEFORE _cage_wing.js in the post chain (build.js MANIFEST.editor),
// so they stood on the PREVIOUS build's wing. Load the Savannah-alike card, then the DA62-alike: the nacelles hung at
// the Savannah's leading edge (x 1.61, y +0.75 - a high wing) until the next rebuild, and the flown spec with them
// (the CG 60.4 % MAC / SM -6.3 % against 58.1 % / -2.6 % once rebuilt, headless). The cure (_cage_wing.js
// CAGE_WING_EARLY): a layer that reads the wing before it is published places its units again, once, in the same
// build, when the wing it stood on reads differently.
//
//   node tools/_naclag_check.js            -> "GATE NACLAG: PASS|FAIL"   (~3 min, children in parallel)
//
// The rows, all headless (tools/_bake_joined.js: the page's own chain in the node scene, then the join's export - the
// spec the garage merges and the game flies), each card sequence baked in a FRESH process:
//   1 LINT       every layer file ahead of _cage_wing.js in MANIFEST.editor that reads window.CAGE_WING places through
//                CAGE_WING_EARLY (a new early reader that does not is red here, not on a screenshot)
//   2 PAIRS      card A then card B in one process == card B in a process of its own (its first build, and its
//                steady state - loaded twice): every engine unit's hub (CAGE_ENG.units[].at), every cowl group's
//                place, every value of the joined (flown) spec, the CG % MAC, the static margin, the status line -
//                and B loaded once more after (a rebuild) the same again. All to the bit.
//                Savannah-alike -> DA62-alike (the report's repro: a low wing's nacelles after a high wing),
//                Jodel-alike -> Twin bush hauler (a high strut-braced wing's after a low cantilever one),
//                DA62-alike -> P-38-alike (a wing engine after a wing engine)
//   3 VALIDATED  the validated builds (Cub, Jodel, Cessna 172, Cessna floats) register no early reader and nothing is
//                placed again: no wing engine, no second pass (their bit-identity with master is the session's record)
//   4 SELFTEST   ALWAYS RUN, the doctored tree: CAGE_WING_EARLY.publish stood down in the A -> B process - the lag
//                must come back (savannah -> da62 DIFFERS from the fresh DA62, its rebuild does not): CAUGHT; and the
//                LINT over a doctored layer (a CAGE_WING read with no registration) must go red: CAUGHT
//   --page       (optional, ~12 min, not in the battery) THE PAGE IN NODE (tools/_page_node.js): the garage's own
//                birth flow loads the Savannah-alike card, then the DA62-alike; the DA62's engines and the flown spec's
//                CG / SM (GARAGE_SPEC.get through buildGen) must equal what a plain rebuild (CAGE_UI.build) then makes,
//                and the wing must have placed its early readers again on the load. Measured G2880: 52.26 % / +2.86 %
//                on the load and on the rebuild (master: the report's 55 % / -2 % until the rebuild).
// Exit 1 on any FAIL or a selftest NOT CAUGHT. Internal: --child <k1,k2,...> [--doctor] prints one NACLAG_JSON line a bake.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawn } = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };

const PAIRS = [['savannah', 'da62'], ['jodel', 'twinBush'], ['da62', 'p38']];
const VALIDATED = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json' };

// ---- the child: one fresh process, a sequence of bakes ------------------------------------------------------------
if (argv.includes('--child')) {
  const seq = opt('child', '').split(',').filter(Boolean);
  const doctor = argv.includes('--doctor');
  const BJ = require(path.join(T, '_bake_joined.js'));
  BJ.loadPanel();
  const C = require(path.join(T, 'flight_core.js'));
  const sha = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
  const W0 = require(path.join(T, '_scene_headless.js')).context({}).ctx;
  // THE PANEL'S P IS THE BUILD'S P, AS ON THE PAGE. The wing resolves its lamp bay off window.CAGE_UI.P (the light
  // layer's CAGE_BAY_FROM_P, _cage_wing.js G96) and the headless scene sets CAGE_UI only after its build, for the join
  // (_bake_joined.js) - so headless, a card's wing wore the PREVIOUS bake's lamp bay (none on the first): a P-38-alike's
  // nacelle 0.19 m off and its CG 4 % MAC between its first and second bake in one process. The page never does (its
  // CAGE_UI.P is the P it builds); here the P the sheet is made from is handed to CAGE_UI the moment it exists.
  {
    const CG2 = W0.CAGE2, cfs = CG2.cageFromSpec;
    CG2.cageFromSpec = function () { const P = cfs.apply(this, arguments); W0.CAGE_UI = { P }; return P; };
  }
  // ...AND THE JOIN IS LOADED BEFORE THE FIRST BUILD, AS ON THE PAGE (MANIFEST.editor loads it before _cage_ui). The
  // wing's loft takes the lamp bay's edges as stations off the join's CAGE_JOIN_WING_CUTS (G189); _bake_joined loads
  // the join after its first build, so a process's first wing had no such rows and its bay snapped to the coarse ones
  // - the Twin bush hauler's bay x 1.90-3.12 m instead of 1.75-2.09, over its nacelle at 2.8: the nacelle 0.24 m off.
  BJ.joinIn(W0);
  for (const k of seq) {
    // A CARD LOADS AS THE GARAGE LOADS IT: the editor's load door (CAGE_UI applySpec -> PAGE.load: the starters record
    // the loaded engine instead of reacting to it), and a card is a birth (design_flow birthApply: CAGE_COWL_FIT_NEXT)
    if (W0.CAGE_PAGE && W0.CAGE_PAGE.load) W0.CAGE_PAGE.load();
    if (!k.startsWith('file:') && W0.CAGE_COWL_FIT_NEXT) W0.CAGE_COWL_FIT_NEXT();
    let r;
    if (VALIDATED[k.replace(/^file:/, '')] && k.startsWith('file:')) {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, VALIDATED[k.slice(5)]), 'utf8'));
      r = BJ.bakeJoined(j.spec || j);
    } else r = BJ.bakeCard(k);
    const W = r.W;
    // THE DOCTORED TREE: the wing's early readers stood down from the first bake on (the old chain: a unit stands on
    // whatever wing the previous build published)
    if (doctor && W.CAGE_WING_EARLY && !W.__naclagDoctored) { W.CAGE_WING_EARLY.publish = () => {}; W.__naclagDoctored = 1; }
    const E = W.CAGE_ENG, EW = W.CAGE_WING_EARLY;
    const cowls = [];
    r.scene.traverse(o => { if (o.name === 'cageLayer:cowl' && o.parent && o.parent.name === 'cageLayer:cowl') cowls.push(o.position.toArray()); });
    let sh = null;
    try { sh = C.genShakedown(C.buildGen(r.spec)); } catch (e) { sh = { err: e.message }; }
    const rec = {
      key: k, ms: r.ms,
      units: E && E.units ? E.units.map(u => u.at) : null, mount: E ? E.mount : null,
      cowls, spec: sha(r.spec), cgPct: sh && sh.envelope ? sh.envelope.cgPct : null,
      sm: sh ? sh.staticMargin : null, mass: sh ? sh.mass : null, stat: r.stat,
      readers: EW ? EW.readers : null, again: EW ? EW.last : null,
      specJ: r.spec,
      errors: (r.errors || []).length, sceneErrors: (r.sceneErrors || []).slice(0, 3),
    };
    console.log('NACLAG_JSON ' + JSON.stringify(rec));
  }
  process.exit(0);
}

// ---- the parent ---------------------------------------------------------------------------------------------------
const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label + (extra ? ' - ' + extra : ''));
  if (!ok) fails.push(label);
  return ok;
};
const f3 = a => a ? a.map(v => +(+v).toFixed(3)) : a;
const fmtU = u => u ? JSON.stringify(u.map(f3)) : 'none';
const pct = v => v == null ? '-' : (100 * v).toFixed(2) + ' %';

// 1 LINT, over a layer list and a source reader (so the selftest can doctor either)
function lint(list, src) {
  const wi = list.indexOf('_cage_wing.js');
  const bad = [], seen = [];
  if (wi < 0) return { ok: false, bad: ['no _cage_wing.js in the list'], seen };
  for (const f of list.slice(0, wi)) {
    if (!/^_cage_/.test(f)) continue;
    let code = src(f);
    if (code == null) continue;
    code = code.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
    if (!/\bwindow\.CAGE_WING\b(?!_)/.test(code)) continue;
    seen.push(f);
    if (!/CAGE_WING_EARLY[\s\S]*?\bplace\(/.test(code)) bad.push(f);
  }
  return { ok: !bad.length, bad, seen };
}
function manifestEditor() {
  const s = fs.readFileSync(path.join(T, 'build.js'), 'utf8');
  const m = /editor:\s*\[([\s\S]*?)\n\s*\],/.exec(s);
  return m ? [...m[1].replace(/\/\/.*$/gm, '').matchAll(/'([^']+\.js)'/g)].map(x => x[1]) : [];
}
const readTool = f => { try { return fs.readFileSync(path.join(T, f), 'utf8'); } catch (e) { return null; } };

function child(seq, doctor) {
  return new Promise(res => {
    const a = [__filename, '--child', seq.join(',')].concat(doctor ? ['--doctor'] : []);
    const p = spawn(process.execPath, ['--max-old-space-size=4096'].concat(a), { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => {
      const recs = out.split('\n').filter(l => l.startsWith('NACLAG_JSON ')).map(l => JSON.parse(l.slice(12)));
      res({ seq, doctor, code, recs, err: err.trim().split('\n').slice(-3).join(' | ') });
    });
  });
}
async function pool(jobs, n) {
  const out = new Array(jobs.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } }));
  return out;
}
// THE COMPARISON OF TWO BAKES OF THE SAME CARD - what "the same aeroplane" means here: TO THE BIT. Every engine
// unit's hub, every cowl group's place, every number of the flown spec, the CG, the static margin, the status line.
// (It holds to the bit only with the child's two page-like settings above - the panel's P and the join before the
// first build; without them the harness itself made a card's first bake differ from its second.)
function specDiff(x, y, p, out) {
  if (x === null || y === null || typeof x !== 'object' || typeof y !== 'object') { if (JSON.stringify(x) !== JSON.stringify(y)) out.push(p + ' ' + JSON.stringify(x) + ' vs ' + JSON.stringify(y)); return; }
  for (const k of new Set(Object.keys(x).concat(Object.keys(y)))) specDiff(x[k], y[k], p + '.' + k, out);
}
function same(a, b) {
  const why = [];
  if (!a || !b) return ['missing'];
  if (JSON.stringify(a.units) !== JSON.stringify(b.units)) why.push('engine hubs ' + fmtU(a.units) + ' vs ' + fmtU(b.units));
  if (JSON.stringify(a.cowls) !== JSON.stringify(b.cowls)) why.push('cowls ' + fmtU(a.cowls) + ' vs ' + fmtU(b.cowls));
  const sd = []; specDiff(a.specJ, b.specJ, 'spec', sd);
  if (sd.length) why.push('flown spec: ' + sd.length + ' values (' + sd.slice(0, 3).join('; ') + ')');
  if (a.cgPct !== b.cgPct) why.push('CG ' + pct(a.cgPct) + ' vs ' + pct(b.cgPct));
  if (a.sm !== b.sm) why.push('SM ' + pct(a.sm) + ' vs ' + pct(b.sm));
  if (a.stat !== b.stat) why.push('status line');
  return why;
}

// --page: the garage in the page in node, the user's own repro
async function pageRow() {
  console.log('5. PAGE - the page in node: the Savannah-alike card, then the DA62-alike, then a rebuild');
  const vm = require('vm');
  const { openPage } = require(path.join(T, '_page_node.js'));
  const P = await openPage({ quiet: true, storage: {} });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  await P.until(() => !!(W.CAGE_UI && W.CAGE_DESIGN && W.GARAGE_SPEC), 600000);
  await P.until(() => false, 3000);
  const read = () => {
    const E = W.CAGE_ENG, S = W.GARAGE_SPEC.get();
    let sh = null; try { sh = W.genShakedown(W.buildGen(S)); } catch (e) { sh = null; }
    return { units: E && E.units ? E.units.map(u => u.at) : null, cgPct: sh && sh.envelope ? sh.envelope.cgPct : null,
             sm: sh ? sh.staticMargin : null, again: W.CAGE_WING_EARLY ? W.CAGE_WING_EARLY.last : null };
  };
  const load = async key => {     // design_flow.js birthApply's two calls
    const D = W.CAGE_DESIGN, a = D.ARCHETYPES.find(x => x.key === key);
    const sp = D.designBake(a.sel, a.over);
    if (W.CAGE_COWL_FIT_NEXT) W.CAGE_COWL_FIT_NEXT();
    W.GARAGE_SPEC.set(sp);
    await P.until(() => false, 12000);
  };
  await load('savannah');
  await load('da62');
  const A = read();
  W.CAGE_UI.build(); await P.until(() => false, 6000);
  const B = read();
  console.log('  da62 on the load: hubs ' + fmtU(A.units) + '  CG ' + pct(A.cgPct) + '  SM ' + pct(A.sm) + '  placed again ' + JSON.stringify(A.again));
  console.log('  da62 rebuilt:     hubs ' + fmtU(B.units) + '  CG ' + pct(B.cgPct) + '  SM ' + pct(B.sm));
  check(!!A.units && JSON.stringify(A.units) === JSON.stringify(B.units), 'page: the DA62-alike\'s engines on its load are where its rebuild puts them');
  check(A.cgPct != null && A.cgPct === B.cgPct && A.sm === B.sm, 'page: the flown CG and static margin on the load equal the rebuild\'s');
  check((A.again || []).length > 0, 'page: the wing placed its early readers again on the load', JSON.stringify(A.again));
  void vm;
}

(async () => {
  const t0 = Date.now();
  console.log('GATE NACLAG (G2880): a wing-mounted unit stands on THIS build\'s wing');
  // 1 LINT
  console.log('1. LINT - the early readers of CAGE_WING (MANIFEST.editor, ahead of _cage_wing.js)');
  const L = lint(manifestEditor(), readTool);
  check(L.ok && L.seen.length >= 2, 'every layer ahead of the wing that reads window.CAGE_WING places through CAGE_WING_EARLY',
    'readers: ' + (L.seen.join(', ') || 'none') + (L.bad.length ? '; NOT REGISTERED: ' + L.bad.join(', ') : ''));

  // the processes: each pair (A, B, B again), each B fresh, the validated builds, the doctored pair
  const jobs = [];
  const want = [];
  for (const [a, b] of PAIRS) { want.push({ kind: 'pair', seq: [a, b, b] }); want.push({ kind: 'fresh', seq: [b, b] }); }
  want.push({ kind: 'validated', seq: Object.keys(VALIDATED).map(k => 'file:' + k) });
  want.push({ kind: 'doctor', seq: ['savannah', 'da62', 'da62'], doctor: true });
  for (const w of want) jobs.push(() => child(w.seq, w.doctor).then(r => Object.assign(r, { kind: w.kind })));
  const JOBS = Math.max(1, Math.min(+(process.env.GATES_JOBS_INNER || 0) || require('os').cpus().length, 4));
  const R = await pool(jobs, JOBS);
  for (const r of R) if (r.code !== 0 || r.recs.length !== r.seq.length)
    check(false, 'child ' + r.seq.join('>') + (r.doctor ? ' (doctored)' : '') + ' ran', 'exit ' + r.code + ', ' + r.recs.length + '/' + r.seq.length + ' bakes; ' + r.err);
  const fresh = {};
  // the reference: B in a process of its own, loaded twice - the second load is B's steady state (the first is B's
  // fresh build, which must be it too)
  for (const r of R) if (r.kind === 'fresh' && r.recs[1]) fresh[r.seq[0]] = Object.assign(r.recs[1], { first: r.recs[0] });

  // 2 PAIRS
  console.log('2. PAIRS - card A then card B == card B fresh (its own process); B rebuilt == B');
  for (const r of R.filter(x => x.kind === 'pair')) {
    const [rA, rB, rB2] = r.recs, F = fresh[r.seq[1]];
    if (!rA || !rB || !rB2 || !F) continue;
    const tag = r.seq[0] + ' -> ' + r.seq[1];
    console.log('  ' + tag + ': ' + rB.mount + ' x' + (rB.units ? rB.units.length : 0) + '  hubs ' + fmtU(rB.units) + '  CG ' + pct(rB.cgPct) +
      '  SM ' + pct(rB.sm) + '  placed again ' + JSON.stringify(rB.again) + '  (fresh: CG ' + pct(F.cgPct) + ', SM ' + pct(F.sm) + ')');
    check(!!F.units && F.units.length >= 1 && /wing/.test(F.mount || ''), tag + ': the fresh ' + r.seq[1] + ' stands its engines on the wing', (F.mount || 'no engine') + ' x' + (F.units ? F.units.length : 0));
    const d0 = same(F.first, F);
    check(!d0.length, tag + ': ' + r.seq[1] + '\'s fresh build (the first in its process) is its steady state', d0.join('; '));
    const d1 = same(rB, F);
    check(!d1.length, tag + ': the engines, cowls, flown spec, CG, SM and status line equal a fresh build of ' + r.seq[1], d1.join('; '));
    const d2 = same(rB2, F);
    check(!d2.length, tag + ': ' + r.seq[1] + ' rebuilt is the same aeroplane', d2.join('; '));
    check((rB.again || []).length > 0, tag + ': the second card\'s wing-mounted units were placed again in its own build',
      'placed again ' + JSON.stringify(rB.again) + ', readers ' + JSON.stringify(rB.readers));
    check(!(rB2.again || []).length, tag + ': a rebuild on the same wing places nothing twice', JSON.stringify(rB2.again));
  }

  // 3 VALIDATED
  console.log('3. VALIDATED - no wing engine, no early reader, nothing placed twice');
  const V = R.find(x => x.kind === 'validated');
  if (V) V.recs.forEach((v, i) => {
    const k = V.seq[i].slice(5);
    check(v.mount !== 'wing' && v.mount !== 'wingTop' && !(v.readers || []).length && !(v.again || []).length,
      k + ': ' + (v.mount || 'no engine') + ' mount, no early reader, nothing placed again', 'readers ' + JSON.stringify(v.readers) + ', again ' + JSON.stringify(v.again) +
      '; CG ' + pct(v.cgPct) + ', SM ' + pct(v.sm) + ', spec ' + v.spec);
  });

  // 4 SELFTEST
  console.log('4. SELFTEST - the doctored tree must go red');
  const Dr = R.find(x => x.kind === 'doctor'), F = fresh.da62;
  if (Dr && Dr.recs.length === 3 && F) {
    const dB = same(Dr.recs[1], F), dB2 = same(Dr.recs[2], F);
    console.log('  doctored savannah -> da62: hubs ' + fmtU(Dr.recs[1].units) + '  CG ' + pct(Dr.recs[1].cgPct) + '  SM ' + pct(Dr.recs[1].sm) +
      '; rebuilt: hubs ' + fmtU(Dr.recs[2].units) + '  CG ' + pct(Dr.recs[2].cgPct));
    check(dB.length > 0 && dB.some(w => /engine hubs/.test(w)) && dB.some(w => /CG/.test(w)),
      'CAUGHT: CAGE_WING_EARLY.publish stood down, the DA62-alike after the Savannah-alike stands on the old wing (the lag reproduced)', dB.join('; ') || 'NOT CAUGHT: no difference');
    check(!dB2.length, 'the doctored tree\'s rebuild cures it (the bug\'s own signature: one build late)', dB2.join('; '));
  } else check(false, 'the doctored run and the fresh DA62 exist');
  const docL = lint(manifestEditor(), f => f === '_cage_cowl.js' ? (readTool(f) || '').replace(/CAGE_WING_EARLY/g, 'CAGE_WING_LATE') : readTool(f));
  check(!docL.ok && docL.bad.includes('_cage_cowl.js'), 'CAUGHT: the LINT over a cowl layer that reads the wing without registering goes red', 'bad: ' + docL.bad.join(', '));

  if (argv.includes('--page')) await pageRow();

  console.log('\n' + (fails.length ? fails.length + ' FAIL' : 'all checks pass') + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  console.log('GATE NACLAG: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('GATE NACLAG: FAIL'); process.exit(1); });
