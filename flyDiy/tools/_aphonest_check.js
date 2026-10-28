#!/usr/bin/env node
// GATE APHONEST - THE AUTOPILOT SAYS WHAT IT DOES, AND THE PAGE KNOWS WHAT IT FLIES (G3560-G3569, AP-HONEST; the user's
// playtest of 24 Oct: aborts and go-arounds with no visible reason, silent re-routes, "Short of Jumbo Mine Street" long
// after the aeroplane stopped going there, the plan not on the map, the toggle back to the autopilot flying elsewhere).
//
//   node tools/_aphonest_check.js              -> "GATE APHONEST: PASS|FAIL"
//   node tools/_aphonest_check.js --selftest   -> each fault below must turn the page half red
//   --pure (the words alone, no page)   --json=<file>
//
// 1 THE WORDS (pure, src/viewer/ap_why.js): every go-around reason 43_pilot.js can give (its goAround('...') literals,
//   read off the source) has a player's sentence (none falls through to the raw note); every code AP_WHY shows is one the
//   pilot says; a refused strip's three verdicts (strip-too-short, go-around, divert) are ONE event, the divert, naming
//   the strip it diverts to and the one it left with its numbers in km/h; the hand-back's line names the To.
// 2 THE PAGE UNDER THE PHYSICS WORKER (tools/_page_node.js, dev.html?simw=1 - the default build from HOME, a real
//   worker thread, one process): rolled out, the flight live in the worker, then
//   A  THE WORKER'S ROUTE REACHES THE PAGE: a To handed to the WORKER'S pilot alone (FLYDIY_SIMW.dest - the page's pilot is
//      not told) -> within 40 frames the page's ap.route.to is that aerodrome's record (sim_link routeCopy, G3610), the map's API
//      (FLYDIY_APROUTE) says so, and the pilot's 'new-destination' verdict - said in the worker - is a row in #apWhy;
//   B  THE TOGGLE KEEPS THE PLAN: manual on, 20 frames, manual off -> FLYDIY_PLAN.get()'s To, its owner and the live
//      route unchanged, and a 'plan' row says the To it flies;
//   C  A GO-AROUND AND A DIVERT, FORCED: the worker's snapshots altered on their way (the harness sees each message first)
//      as the worker's would read had its pilot gone round, then refused the strip and diverted - the report with the
//      verdicts appended, the route's ids moved to another strip - -> a 'go-around' row, then a 'divert' row on top naming
//      both strips in plain words; the page's ap.route.to the diversion's (so the end card cannot say "Short of" the
//      field it left), the brief's trip line says "diverted", FLYDIY_APROUTE diverted; #apWhy in the DOM, not hidden,
//      a child of #flTop (the bar's empty third column, the top right - never the screen's centre); no page error.
// NEGATIVE-VERIFIED (--selftest): 'noroute' strips the route from every snapshot (A's route and C's divert route go red),
//   'noreport' strips the report (A's and C's rows go red).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const { AP_WHY } = require(path.join(ROOT, 'src', 'viewer', 'ap_why.js'));

// ============================================================ 1 THE WORDS
function pure() {
  const fails = [], say = s => console.log(s), bad = m => { fails.push(m); say('  FAIL ' + m); };
  const SRC = fs.readFileSync(path.join(ROOT, 'src', 'core', '43_pilot.js'), 'utf8');
  // every goAround reason: the literal's head, made a note with numbers where the source concatenates them
  const lits = [...SRC.matchAll(/goAround\('([^']*)'\s*(\+[^;]*)?\)/g)].map(m => ({ head: m[1], rest: m[2] || '' }));
  const SAMPLE = {
    'fast on the short final: ': 'fast on the short final: 31.0 m/s for 27.5',
    'final took ': 'final took 241 s',
    'floating on the short field with ': 'floating on the short field with 80 m left, 120 m to stop',
    'floating with ': 'floating with 95 m left',
    'high on the slope ': 'high on the slope 412 m out',
    'off the centreline by ': 'off the centreline by 14 m on short final',
    'past the aim at ': 'past the aim at 9 m',
    'terrain under the approach': 'terrain under the approach',
    'the strip is too short for ': 'the strip is too short for 23.4 m/s',
    'under the strip ': 'under the strip 420 m out',
    'unstabilised approach at ': 'unstabilised approach at 85 m: fast 31.2 m/s for 27.0',
    'bounced ': 'bounced 2.4 m off the touch at 24.1 m/s',
  };
  say('1 THE WORDS (src/viewer/ap_why.js against 43_pilot.js\'s own reasons)');
  if (lits.length < 8) bad('only ' + lits.length + ' goAround reasons read off 43_pilot.js (the reader is blind)');
  for (const L of lits) {
    const note = SAMPLE[L.head];
    if (!note) { bad('a go-around reason with no words: "' + L.head + '..." (add it to ap_why.js GA and to this gate\'s SAMPLE)'); continue; }
    const w = AP_WHY.gaWords(note + ' (attempt 1)');
    if (!w || w === note) bad('"' + L.head + '..." falls through to the raw note');
    else say('  ' + L.head.trim().padEnd(36) + ' -> ' + w);
  }
  for (const why of ['slow 22.0 m/s for 25.0', 'fast 31.2 m/s for 27.0', 'high 14 m on the slope', 'low 9 m on the slope', 'sinking 4.2 m/s', '12 m off the centreline', 'not configured (flap 0.20 for 1.00)'])
    if (AP_WHY.steady(why) === why) bad('the stabilised gate\'s "' + why + '" has no words');
  // every code shown is one the pilot says (a renamed code would leave a dead row)
  const said = new Set([...SRC.matchAll(/say\('([a-z-]+)'/g)].map(m => m[1]).concat(['go-around']));
  for (const c of Object.keys(AP_WHY.SHOW)) if (!said.has(c)) bad('AP_WHY shows "' + c + '", which 43_pilot.js never says');
  // a refused strip is one event
  const T1 = { id: 'mine', name: 'Jumbo Mine Street' }, T2 = { id: 's13', name: 'Strip 13' };
  const D = AP_WHY.batch(divertVerdicts(300, T1.name, T2.name), { to: T2 });
  if (!D || D.kind !== 'divert') bad('a refused strip\'s three verdicts are not one divert: ' + JSON.stringify(D));
  else {
    say('  divert: ' + D.head + ' | ' + D.line);
    if (D.head !== 'Diverting to ' + T2.name) bad('the divert head does not name the strip it goes to: ' + D.head);
    if (!D.line.includes(T1.name) || !/km\/h/.test(D.line)) bad('the divert line does not say why in km/h at the strip it left: ' + D.line);
  }
  const G = AP_WHY.batch([{ t: 10, code: 'go-around', note: 'high on the slope 412 m out (attempt 1)' }], { to: T1 });
  if (!G || G.kind !== 'go-around' || G.head !== 'Going around at ' + T1.name || G.line !== 'too high on the approach') bad('the go-around event: ' + JSON.stringify(G));
  if (AP_WHY.batch([{ t: 1, code: 'pivot', note: 'x' }, { t: 2, code: 'vx-climb', note: 'y' }], {}) !== null) bad('a batch with nothing to tell made an event');
  const Pn = AP_WHY.plan({ to: T1, from: T2 });
  if (!/Jumbo Mine Street/.test(Pn.line)) bad('the hand-back line does not name the To: ' + Pn.line);
  const Pc = AP_WHY.plan({ to: T1, from: T1 });
  if (!/circuit/.test(Pc.line)) bad('the hand-back line on a circuit: ' + Pc.line);
  return fails;
}
// what 43_pilot.js judgeHeld says, in its order, when it refuses a strip and diverts
function divertVerdicts(t, from, to) {
  return [
    { t, code: 'strip-too-short', note: from + ': the elevator holds 23.4 m/s, the short-field stop from it needs 231 m, 180 m are left past the aim and the float - not landing there' },
    { t, code: 'go-around', note: 'the strip is too short for 23.4 m/s (attempt 1)' },
    { t, code: 'divert', note: 'diverting to ' + to + ' (900 m, 3.2 km): ' + from + ' is too short for the speed this aeroplane holds' },
  ];
}

// ============================================================ 2 THE PAGE (a child process: ~3.5 GB)
async function child() {
  const out = arg('out'), fault = arg('fault', '');
  const { openPage } = require('./_page_node.js');
  const R = { fault, steps: {}, errors: [], t: {} };
  const t0 = Date.now();
  let W = null, tamper = null;
  // the worker's messages, seen (and altered) before the page takes them
  const tap = (w, m) => {
    if (!m || m.kind !== 'snap' || !m.meta || !m.meta.ap) return;
    const A = m.meta.ap;
    if (fault === 'noroute') delete A.route;
    if (fault === 'noreport') delete A.report;
    if (tamper && W) {
      if (tamper.route && fault !== 'noroute') A.route = W.JSON.parse(JSON.stringify(tamper.route));
      if (tamper.report && fault !== 'noreport') { A.report = W.JSON.parse(JSON.stringify(tamper.report)); tamper.report = null; tamper.sent = (tamper.sent || 0) + 1; }
    }
  };
  const P = await openPage({ quiet: true, storage: {}, query: 'simw=1', workers: /sim_host\.js/, onWorkerMessage: tap });
  W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  R.t.garage = Date.now() - t0;
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 900000);
  const FP = W.FLIGHT_PROBE, SW = W.FLYDIY_SIMW;
  const RD = FP.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  if (W.TEST_FLIGHT && W.TEST_FLIGHT.rate) W.TEST_FLIGHT.rate(2);
  const until = async (cond, maxFrames) => { for (let i = 0; i < maxFrames && !cond(); i++) await P.frames(1); return !!cond(); };
  const live = await until(() => SW && SW.live() && SW.state().lastStep > 120, 4000);
  R.live = live; R.simw = SW ? { phase: SW.state().phase, reason: SW.state().reason } : null;
  const rid = a => (a && a.id) || null;
  const routeIds = () => { const r = FP.ap().route; return r ? { from: rid(r.from), to: rid(r.to) } : null; };
  const rows = () => W.FLYDIY_APWHY.log();
  const aeros = FP.world().aerodromes;
  const here = routeIds();
  R.start = { route: here, phase: FP.ap().phase, plan: W.FLYDIY_PLAN.get() };
  // two long land strips that are not where it stands
  const long = aeros.filter(a => a.id && a.id !== (here && here.from) && !a.water && a.surface !== 4 && a.kind !== 'water' && a.len >= 700);
  const T1 = long[0], T2 = long[1];
  R.T1 = T1 && { id: T1.id, name: T1.name }; R.T2 = T2 && { id: T2.id, name: T2.name };
  if (!live || !T1 || !T2) { R.abort = !live ? 'the worker flight never went live' : 'no two long strips on this island'; return done(); }
  // A: the worker's pilot alone is handed a To
  const n0 = rows().length;
  SW.dest(T1.id);
  R.A = { ok: await until(() => (routeIds() || {}).to === T1.id, 40), route: null, rows: null };
  await P.frames(4);
  R.A.route = routeIds(); R.A.syncs = SW.state().routeCopies || 0; R.A.miss = 0;   // (G3610's routeCopy carries the worker's route)
  R.A.rows = rows().slice(n0); R.A.map = W.FLYDIY_APROUTE.get(); if (R.A.map) R.A.map = { to: R.A.map.to, from: R.A.map.from, diverted: R.A.map.diverted, legs: R.A.map.legs ? R.A.map.legs.length : null };
  // B: the toggle keeps the plan
  const plan0 = W.FLYDIY_PLAN.get(), n1 = rows().length;
  FP.setManual(true); await P.frames(20);
  R.B = { manualOn: FP.manual() };
  FP.setManual(false); await P.frames(20);
  R.B.manualOff = !FP.manual(); R.B.plan0 = plan0; R.B.plan1 = W.FLYDIY_PLAN.get(); R.B.rows = rows().slice(n1); R.B.route = routeIds();
  // C: a go-around, then a refused strip and a divert, as the worker's snapshots would carry them
  const rep = () => JSON.parse(JSON.stringify(FP.ap().report || { verdicts: [], outcome: null, landing: null, phases: [] }));
  const tNow = Math.round((FP.ap().t || 0) * 10) / 10;
  const n2 = rows().length;
  { const r = rep(); r.verdicts.push({ t: tNow, code: 'go-around', note: 'high on the slope 412 m out (attempt 1)' }); tamper = { report: r }; }
  await until(() => tamper.sent >= 1, 40); await P.frames(4);
  R.C = { ga: rows().slice(n2) };
  const n3 = rows().length;
  { const r = rep(); r.verdicts.push(...divertVerdicts(tNow + 5, T1.name, T2.name)); tamper = { report: r, route: { from: T1.id, to: T2.id } }; }
  await until(() => tamper.sent >= 1, 40); await P.frames(6);
  R.C.dv = rows().slice(n3); R.C.route = routeIds(); R.C.top = W.FLYDIY_APWHY.rows()[0] || null;
  const el = W.document.getElementById('apWhy');
  R.C.dom = el ? { hidden: !!el.hidden, text: el.textContent, inTop: !!(el.parentNode && el.parentNode.id === 'flTop'),
    // G3747: in the fl2 layout with the AP's words folded (the default), the phase line's warn dot says there is a reason
    fl2: W.document.body.classList.contains('fl2'), fold: !W.document.body.classList.contains('fl2Ap'),
    dot: !!(W.document.getElementById('rail') && W.document.getElementById('rail').classList.contains('awNew')) } : null;
  R.C.trip = (W.document.getElementById('flRouteV') || {}).textContent || null;
  R.C.map = W.FLYDIY_APROUTE.get(); if (R.C.map) R.C.map = { to: R.C.map.to, diverted: R.C.map.diverted, why: R.C.map.why, gaveUp: R.C.map.gaveUp };
  // G3748: the MAP screen's layer (map_menu.js G3523 hook) - the To ringed, the field it gave up on crossed
  { const L = W.FLYDIY_MAP_LAYERS && W.FLYDIY_MAP_LAYERS.aproute; let o = null; try { o = L ? L({ X: x => x / 10, Y: z => z / 10, zr: 1, near: 0.1, aeros: {}, place: () => null }) : null; } catch (e) { o = { err: e.message }; }
    R.C.layer = o ? { err: o.err || null, ring: /mmApTo/.test(o.svg || ''), cross: /mmApGaveUp/.test(o.svg || ''), line: /mmApRoute/.test(o.svg || '') } : null; }
  tamper = null;
  return done();
  function done() {
    R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
    R.mem = Math.round(process.memoryUsage().rss / 1048576); R.t.all = Date.now() - t0;
    fs.writeFileSync(out, JSON.stringify(R));
    P.close();
    process.exit(0);
  }
}
function runChild(fault) {
  const out = path.join(os.tmpdir(), 'aphonest_' + process.pid + (fault ? '_' + fault : '') + '.json');
  const a = [__filename, '--child=1', '--out=' + out]; if (fault) a.push('--fault=' + fault);
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 2 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: 'child exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
  return R;
}
function judge(R, say) {
  const fails = [], bad = m => { fails.push(m); say('  FAIL ' + m); };
  if (R.failed) { bad(R.failed); return fails; }
  if (R.abort) { bad(R.abort); return fails; }
  say('  start: ' + JSON.stringify(R.start.route) + ' in ' + R.start.phase + ', plan ' + R.start.plan.to + ' by ' + R.start.plan.by + '; T1 ' + R.T1.name + ', T2 ' + R.T2.name);
  // A
  say('  A route after the worker\'s To: ' + JSON.stringify(R.A.route) + ' (copies ' + R.A.syncs + '), rows ' + JSON.stringify(R.A.rows.map(r => r.head)));
  if (!R.A.ok || !R.A.route || R.A.route.to !== R.T1.id) bad('A: the page\'s ap.route did not follow the worker\'s pilot to ' + R.T1.id + ' (' + JSON.stringify(R.A.route) + ')');
  if (!R.A.map || !R.A.map.to || R.A.map.to.id !== R.T1.id) bad('A: FLYDIY_APROUTE does not name the To the worker flies: ' + JSON.stringify(R.A.map));
  if (!R.A.rows.some(r => r.kind === 'dest' && r.head.includes(R.T1.name))) bad('A: the worker\'s "new-destination" verdict made no #apWhy row naming ' + R.T1.name);
  // B
  const P0 = R.B.plan0, P1 = R.B.plan1;
  say('  B manual on ' + R.B.manualOn + ', off ' + R.B.manualOff + '; plan ' + JSON.stringify({ to: P0.to, by: P0.by, live: P0.live }) + ' -> ' + JSON.stringify({ to: P1.to, by: P1.by, live: P1.live }) + '; rows ' + JSON.stringify(R.B.rows.map(r => r.head + ': ' + r.line)));
  if (!R.B.manualOn || !R.B.manualOff) bad('B: the toggle did not go manual and back (no INP on the page?)');
  if (P0.to !== P1.to || P0.want !== P1.want || P0.by !== P1.by || JSON.stringify(P0.live) !== JSON.stringify(P1.live)) bad('B: the toggle changed the plan');
  if (!R.B.rows.some(r => r.kind === 'plan' && r.line.includes(R.T1.name))) bad('B: the hand-back said no plan naming ' + R.T1.name);
  // C
  say('  C go-around rows ' + JSON.stringify(R.C.ga.map(r => r.head + ': ' + r.line)));
  say('  C divert rows ' + JSON.stringify(R.C.dv.map(r => r.head + ': ' + r.line)) + '; route ' + JSON.stringify(R.C.route) + '; trip "' + R.C.trip + '"');
  say('  C #apWhy ' + JSON.stringify(R.C.dom));
  if (!R.C.ga.some(r => r.kind === 'go-around' && r.line === 'too high on the approach')) bad('C: the forced go-around made no row with its reason');
  const dv = R.C.dv.find(r => r.kind === 'divert');
  if (!dv) bad('C: the forced divert made no row');
  else {
    if (dv.head !== 'Diverting to ' + R.T2.name) bad('C: the divert head: ' + dv.head);
    if (!dv.line.includes(R.T1.name) || !/km\/h/.test(dv.line)) bad('C: the divert line does not say why: ' + dv.line);
    if (R.C.dv.filter(r => r.kind === 'go-around').length) bad('C: the divert\'s own go-around made a second row');
  }
  if (!R.C.route || R.C.route.to !== R.T2.id) bad('C: the page\'s ap.route.to is not the diversion\'s ' + R.T2.id + ': ' + JSON.stringify(R.C.route));
  if (!R.C.top || R.C.top.kind !== 'divert') bad('C: the newest #apWhy row is not the divert');
  say('  C map layer ' + JSON.stringify(R.C.layer));
  if (!R.C.layer || R.C.layer.err || !R.C.layer.ring || !R.C.layer.line) bad('C: the MAP layer does not draw the AP route + the To: ' + JSON.stringify(R.C.layer));
  if (R.C.map && R.C.map.gaveUp && !(R.C.layer && R.C.layer.cross)) bad('C: the MAP layer does not cross the field it gave up on');
  if (!R.C.dom || R.C.dom.hidden || !R.C.dom.inTop || !R.C.dom.text.includes('Diverting to')) bad('C: #apWhy is not shown in #flTop with the divert: ' + JSON.stringify(R.C.dom));
  if (R.C.dom && R.C.dom.fl2 && R.C.dom.fold && !R.C.dom.dot) bad('C: fl2, the AP words folded, a divert to read - no warn dot on #rail: ' + JSON.stringify(R.C.dom));
  if (!R.C.trip || !/diverted/.test(R.C.trip)) bad('C: the brief\'s trip line does not say diverted: ' + R.C.trip);
  if (!R.C.map || !R.C.map.diverted || !R.C.map.to || R.C.map.to.id !== R.T2.id) bad('C: FLYDIY_APROUTE: ' + JSON.stringify(R.C.map));
  if (R.errors.length) bad('page errors: ' + R.errors.slice(0, 3).join(' | '));
  say('  (' + Math.round(R.t.all / 1000) + ' s, ' + R.mem + ' MB)');
  return fails;
}

(async () => {
  if (arg('child')) return child();
  const say = s => console.log(s);
  const out = { pure: pure() };
  if (!argv.includes('--pure')) {
    say('2 THE PAGE UNDER THE PHYSICS WORKER (dev.html?simw=1, the default build)');
    const R = runChild('');
    out.page = judge(R, say);
    if (argv.includes('--selftest')) {
      for (const f of ['noroute', 'noreport']) {
        say('SELFTEST ' + f + ' (must go red)');
        const F = judge(runChild(f), s => say('  ' + s));
        out['self_' + f] = F.length;
        if (!F.length) out.pure.push('selftest ' + f + ' stayed green');
      }
    }
  }
  const jf = arg('json'); if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
  const fails = out.pure.length + (out.page ? out.page.length : 0);
  console.log('GATE APHONEST: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
