// GATE DMGCRASHUI (DMG-D4b, train 41, 2026-10-08): what a crash shows and awards - the page in node (the real three, the
// physics worker as the game runs it AND inline ?simw=0), the user's Cub, damage on (and one run damage OFF):
//   1. HIDE THE BODIES (the user: "hide the bodies, it's not the game for that. Let's destroy machines, not people. And
//      rebuild them."): after a break-up (or the cabin round the eye crushed) no crew mesh is drawn; after Fly again the
//      crew is drawn as it was;
//   2. NO CERTIFICATE ON A DAMAGED AEROPLANE (the user: "it hilariously certifies a crashed plane"): the aeroplane's
//      integrity, sim.damage().structural - { damaged, broken, separated, why } - read the same inline and under the worker
//      (the page's own core is never stepped there: sim_link puts the worker's on it); a crash -> no arrival; a hard landing
//      that breaks a leg -> no arrival, and the card names it ("Not certified - the aeroplane was damaged: ..."); a clean
//      landing -> { damaged: false }, an arrival as before;
//   3. (the centre of the screen after a crash is tools/dmg_crash_ui_rig.js's, on the box: the node page has no layout)
// Flags: --only=worker,inline,off (any of them; default all three)  --child=1 (internal)
const path = require('path'), fs = require('fs'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILD = 'builds/cub_2026-09-20_corrected.json';
const HARD = { V: 30, agl: 1, tr: 0.5, D: 40 };          // DMGUPLOAD's hard staging: the Cub breaks up (105-114 members)
const SINKS = [4, 6, 8, 10];                             // the hard landing: the first sink that breaks the gear and nothing worse

async function child() {
  const out = arg('out'), mode = arg('mode', 'worker'), dmg = arg('damage', '1') !== '0';
  const { openPage } = require('./_page_node.js');
  const R = { mode, damage: dmg, errors: [] };
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILD), 'utf8') };
  const q = (mode === 'inline' ? 'simw=0' : 'simw=1') + (dmg ? '&damage=1' : '');
  const P = await openPage({ quiet: true, storage, query: q, workers: mode === 'inline' ? undefined : /sim_host\.js/ });
  const W = P.win, doc = W.document;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  const tripN = () => (W.FLYDIY_TRIPS || []).length;
  const tripDone = (kind, n0) => { const T = W.FLYDIY_TRIPS || []; const t = T[T.length - 1]; return T.length > n0 && !!(t && t.kind === kind && t.done && W.BOOT.state === 'gone'); };
  const FP = W.FLIGHT_PROBE;
  const live = () => { if (mode === 'inline') return !!(FP.sim() && !FP.over()); const s = W.FLYDIY_SIMW && W.FLYDIY_SIMW.state(); return !!(s && s.phase === 'live' && s.flight && s.flight.live); };
  { const n0 = tripN(); doc.getElementById('bGo').click(); await P.until(() => tripDone('rollout', n0), 900000); for (let i = 0; i < 600 && !live(); i++) await P.frames(1); }
  for (let i = 0; i < 20; i++) await P.frames(1);
  R.live = live();
  if (!R.live) { R.errors = P.errors.slice(0, 20); fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); }
  W.FLYDIY_SKINBREAK = true; W.FLYDIY_WRECK = true; FP.setManual(true);
  const crew = () => { const m = FP.model(), o = []; for (const p of (m && m.people) || []) if (p.inst) for (const x of p.inst.meshes) o.push(x); return o; };
  const crewVis = () => crew().map(x => !!x.visible);
  const structural = () => { const s = FP.structural ? FP.structural() : null; return s ? { damaged: !!s.damaged, broken: s.broken, separated: (s.separated || []).slice(), why: s.why } : null; };
  const wstats = () => W.FLYDIY_WRECK_STATS ? W.FLYDIY_WRECK_STATS() : null;
  const card = () => { const el = doc.getElementById('arrCard'); return el ? { hidden: !!el.hidden, cls: String(el.className || ''), rows: String((doc.getElementById('arrRows') || {}).innerHTML || '') } : null; };
  const award = () => { const el = doc.getElementById('bAward'); return el ? { hidden: !!el.hidden, cls: String(el.className || '') } : null; };
  const brokeUp = () => { const d = FP.damage(); return !!(d && d.brokeUp); };
  const flyAgain = async () => {
    if (!FP.over()) FP.endFlight('stopped');
    for (let i = 0; i < 10; i++) await P.frames(1);
    doc.getElementById('bGo').click();
    for (let i = 0; i < 300 && (FP.over() || (FP.damage() && FP.damage().crashed)); i++) await P.frames(1);
    for (let i = 0; i < 60; i++) await P.frames(1);
    W.FLYDIY_SKINBREAK = true; W.FLYDIY_WRECK = true; FP.setManual(true);
  };
  // a staging: `agl` m up (the lowest node), `fwd` m/s along the heading, `sink` m/s down; a trunk `tr` m `D` m ahead if given
  const stage = async (o) => {
    const sim = FP.sim(), world = FP.world(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
    const c = sim.cgPos(), g = world.terrainH(c[0], c[2]); let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
    let placed = false; FP.place({ at: [c[0], g + o.agl + (c[1] - yMin), c[2]], zeroV: true, dv: [o.fwd * fx, -(o.sink || 0), o.fwd * fz] }).then(() => { placed = true; });
    await P.until(() => placed, 60000);
    if (o.tr) { const c2 = sim.cgPos(), tx = c2[0] + fx * o.D, tz = c2[2] + fz * o.D; world.treeHits.set('fill:crashui', [tx, tz, world.terrainH(tx, tz), o.tr, world.terrainH(tx, tz) + 10]); }
    sim.ctl.thr = 0;
    const tA = sim.t;
    for (let f = 0; f < o.secs * 60 + 900 && sim.t - tA < o.secs; f++) { await P.frames(1); sim.ctl.thr = 0; }
    if (o.tr) { const T = world.treeHits; T.drop ? T.drop('fill:crashui') : T.delete && T.delete('fill:crashui'); }
  };
  const waitOver = async (secs) => { const sim = FP.sim(), tA = sim.t; for (let f = 0; f < secs * 60 + 900 && !FP.over() && sim.t - tA < secs; f++) await P.frames(1); return FP.over(); };
  const TD = { sink: 1, z: 0, x: 0, V: 10 };   // (a touchdown handed to the arrival rule: the rule's verdict, not the pilot's phase)

  R.has = { cert: typeof FP.structural === 'function' && typeof FP.arrival === 'function', crew: !!(wstats() && 'crewOff' in wstats()) };   // (each fix's rows only where it is in)
  R.crew0 = crewVis();
  // ---- a clean landing: 1.5 m/s on the gear, standing
  await stage({ agl: 0.1, fwd: 0, sink: 1.5, secs: 4 });
  const arrival = td => R.has.cert ? FP.arrival(td) : null;
  R.clean = { structural: structural(), arrival: arrival(TD) };
  // ---- a hard landing: the first sink that breaks the gear
  R.hard = null;
  for (const sink of SINKS) {
    await flyAgain();
    await stage({ agl: 0.3, fwd: 8, sink, secs: 4 });
    const s = structural();
    if (s && s.damaged) { let over = await waitOver(20); if (!over) { FP.endFlight('stopped'); for (let i = 0; i < 30; i++) await P.frames(1); over = 'ended by the rig (no crash verdict)'; } R.hard = { sink, structural: s, structuralAfter: structural(), arrival: arrival(TD), over, card: card(), award: award(), brokeUp: brokeUp() }; break; }
  }
  // ---- the crash: the hard staging, a break-up
  await flyAgain();
  await stage(Object.assign({ fwd: HARD.V, sink: 0, secs: 5 }, HARD));
  const W1 = wstats();
  R.crash = { structural: structural(), arrival: arrival(TD), brokeUp: brokeUp(), eyeCut: W1 ? W1.eyeCut : null, crewOff: W1 ? W1.crewOff : null, crew: crewVis(), wreck: W1 ? W1.active : null };
  R.crash.over = await waitOver(25); R.crash.card = card(); R.crash.award = award(); R.crash.crewEnd = crewVis();
  // ---- Fly again: the crew back
  await flyAgain();
  for (let i = 0; i < 60; i++) await P.frames(1);
  R.retry = { crew: crewVis(), structural: structural(), wreck: (wstats() || {}).active };
  R.errors = P.errors.slice(0, 20);
  fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0);
}

function runChild(mode, damage) {
  const out = path.join(os.tmpdir(), 'dmgcrashui_' + process.pid + '_' + mode + (damage === false ? '_off' : '') + '.json');
  const a = [__filename, '--child=1', '--out=' + out, '--mode=' + mode]; if (damage === false) a.push('--damage=0');
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 2 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { mode, failed: 'child exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); return R;
}

function judge(R, say) {
  const f = [], tag = R.mode + (R.damage ? '' : ' (damage OFF)'), bad = m => f.push(tag + ': ' + m), ok = m => say('  ok    ' + tag + ': ' + m);
  if (R.failed) { bad('the run failed: ' + R.failed); return f; }
  if (!R.live) { bad('never flew: ' + JSON.stringify(R.errors || []).slice(0, 300)); return f; }
  const S = x => JSON.stringify(x);
  say('  ' + tag + ': the clean landing ' + S(R.clean) + '\n  ' + tag + ': the hard landing ' + S(R.hard) + '\n  ' + tag + ': the crash ' + S(Object.assign({}, R.crash, { card: R.crash.card ? { hidden: R.crash.card.hidden, cls: R.crash.card.cls } : null })) + '\n  ' + tag + ': Fly again ' + S(R.retry));
  const n0 = (R.crew0 || []).length;
  if (!n0) bad('no crew mesh on the fresh aeroplane: the crew rows test nothing');
  const H = R.has || {};
  if (!H.cert) say('  --    ' + tag + ': the certificate rows skipped (no sim.damage().structural on this tree: fix 2 not in)');
  if (!H.crew) say('  --    ' + tag + ': the crew rows skipped (no crew state in the wreck: fix 1 not in)');
  // 2. the certificate
  if (H.cert) {
  if (!(R.clean.structural && R.clean.structural.damaged === false)) bad('the clean landing reads damaged: ' + S(R.clean.structural)); else ok('the clean landing: { damaged: false }');
  if (!(R.clean.arrival && R.clean.arrival.arrived)) bad('the clean landing is no arrival: ' + S(R.clean.arrival)); else ok('the clean landing arrives (certified as before)');
  }
  if (R.damage) {
    if (H.cert) {
    if (!R.hard) bad('no sink of ' + SINKS.join(' / ') + ' m/s broke anything: the hard-landing rows test nothing');
    else {
      if (R.hard.arrival.arrived) bad('the hard landing that broke ' + R.hard.structural.why + ' ARRIVES (certified)'); else ok('the hard landing (' + R.hard.sink + ' m/s: ' + R.hard.structural.why + ', ' + R.hard.structural.broken + ' broken) is no arrival');
      const named = R.hard.card && !R.hard.card.hidden && R.hard.card.rows.indexOf('Not certified - the aeroplane was damaged: ' + R.hard.structural.why) >= 0;
      if (!named) bad('the card does not say "Not certified - the aeroplane was damaged: ' + R.hard.structural.why + '" (' + S(R.hard.card).slice(0, 300) + ')'); else ok('the card names it: "Not certified - the aeroplane was damaged: ' + R.hard.structural.why + '"');
    }
    if (!(R.crash.structural && R.crash.structural.damaged)) bad('the crash reads whole: ' + S(R.crash.structural)); else ok('the crash: ' + S(R.crash.structural));
    if (R.crash.arrival.arrived) bad('the crash arrives (certified)'); else ok('the crash is no arrival');
    if (R.crash.award && !R.crash.award.hidden && R.crash.award.cls.indexOf('no') < 0) bad('an award card is up after the crash: ' + S(R.crash.award)); else ok('no award card over the crash');
    if (!(R.retry.structural && R.retry.structural.damaged === false)) bad('after Fly again the aeroplane reads damaged: ' + S(R.retry.structural)); else ok('after Fly again: { damaged: false }');
    }
    // 1. the crew
    if (H.crew) {
    const cut = R.crash.brokeUp || !!R.crash.eyeCut || R.crash.crewOff;
    if (!cut) bad('the crash neither broke up nor crushed the cabin: the crew rows test nothing (' + S({ brokeUp: R.crash.brokeUp, eyeCut: R.crash.eyeCut }) + ')');
    else {
      if (R.crash.crew.some(v => v) || R.crash.crewEnd.some(v => v)) bad('a crew mesh is drawn after the break-up (' + S(R.crash.crew) + ' / at the end ' + S(R.crash.crewEnd) + ')'); else ok('after the break-up no crew mesh is drawn (' + R.crash.crew.length + ' hidden)');
    }
    if (S(R.retry.crew) !== S(R.crew0)) bad('after Fly again the crew is not as it was: ' + S(R.retry.crew) + ' against ' + S(R.crew0)); else ok('after Fly again the crew is drawn as before (' + n0 + ' meshes)');
    }
  } else {
    if (H.cert && R.crash.structural && R.crash.structural.damaged) bad('damage OFF reads damaged: ' + S(R.crash.structural)); else ok('damage OFF: the crash reads { damaged: false }');
    if (R.crash.crew.some((v, i) => v !== R.crew0[i]) || R.retry.crew.some((v, i) => v !== R.crew0[i])) bad('damage OFF: the crew changed'); else ok('damage OFF: the crew untouched');
    if (R.crash.crewOff) bad('damage OFF: the wreck hid the crew');
  }
  return f;
}

function parent() {
  const say = m => console.log(m), only = arg('only', null);
  say('GATE DMGCRASHUI - a crash shows the wreck, not the crew, and awards nothing (dev.html, the user\'s Cub; worker and inline)');
  const modes = ['worker', 'inline'].filter(m => !only || only.split(',').includes(m));
  let fails = [];
  const RS = {};
  for (const m of modes) { RS[m] = runChild(m); fails = fails.concat(judge(RS[m], say)); }
  // the same crash, the same verdict: the integrity read the same inline and under the worker
  if (RS.worker && RS.inline && !RS.worker.failed && !RS.inline.failed && RS.worker.crash && RS.inline.crash && (RS.worker.has || {}).cert) {
    const a = RS.worker.crash.structural || {}, b = RS.inline.crash.structural || {};
    say('  the crash, worker ' + JSON.stringify(a) + ' / inline ' + JSON.stringify(b) + ' (the broken count is reported: two runs of one crash are not one run)');
    // (the verdict held equal; the first member to go and the count are two runs' - the worker and the page step the same
    // core on their own clocks - so they are reported, and a different first group is named, not failed)
    if (a.damaged !== b.damaged) fails.push('the integrity differs inline and under the worker: ' + JSON.stringify(a) + ' / ' + JSON.stringify(b));
    else say('  ok    .structural.damaged equal inline and under the worker for the same crash (' + a.damaged + '; why "' + a.why + '" / "' + b.why + '"' + (a.why !== b.why ? ' - the first group differs between the two runs' : '') + ')');
    const h = RS.worker.hard, k = RS.inline.hard;
    if (h && k) say('  the hard landing, worker ' + JSON.stringify(h.structural) + ' at ' + h.sink + ' m/s / inline ' + JSON.stringify(k.structural) + ' at ' + k.sink + ' m/s');
  }
  if (!only || only.split(',').includes('off')) fails = fails.concat(judge(runChild('worker', false), say));   // (damage OFF: the worker, the default; --only=off alone)
  for (const x of fails) say('  FAIL  ' + x);
  console.log('GATE DMGCRASHUI: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}
if (argv.includes('--child=1')) child().catch(e => { console.error(e && e.stack || e); process.exit(2); }); else parent();
