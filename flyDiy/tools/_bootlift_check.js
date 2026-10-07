#!/usr/bin/env node
// _bootlift_check.js - GATE BOOTLIFT (G1996, HW-COVERAGE): A LOADING SCREEN LIFTED BEFORE ITS CHAIN ENDED, ON THE PAGE ITSELF
// (tools/_page_node.js: dev.html's own scripts, the real three.js on the recording GL, the virtual clock - GATE ROUNDTRIP's
// harness, so it runs on any box, the cloud's included).
//
// THE USER'S LAPTOP (GTX 1660 Ti, i5-9300H; logs of 5 Oct): the garage load took 120-137 s and the boot watchdog's 120 s hard
// timeout lifted the screen mid-chain.
//   train 35 (log 1): the lift came during the shed's compile; Fly pressed then superseded the chain before 'first light'
//     - the loop's only start - so NO FRAME WAS EVER DRAWN (the roll-out screens gave up on 'nothing landed for 20 s').
//   train 36 (log 2): app.js starts the loop from the boot's done() too - frames drawn; but the flight recorder never marked
//     a REVEAL (a roll-out with nothing left to build has no screen), so the analyzer scored nothing.
// Three children, one page each (one at a time, ~4 GB, a few minutes each):
//   fly    the screen lifted when the boot reaches 'compile' (BOOT.fail - the watchdog's own path), Fly pressed AT ONCE
//          (the chain still running): the roll-out lands (its trip done, its screen gone), the world is DRAWN after it, a
//          reveal is marked (FLIGHT_REC's 'reveal')
//   stay   the same lift, the player stays in the shed: the shed is drawn while the chain finishes under it, the chain
//          ends (its 'landing' logged as lifted), then Fly: the roll-out lands, the world is drawn, a reveal is marked
//          (here with NO roll-out screen at all - the train-36 blind spot)
//   diag   THE SELF-TEST (G1997): index.html?diag=quick's module run to its report on the same harness - every variant
//          measured frames, the census by owner, the report's text, the graphics put back exactly as they were
//   hard   BOOT.opt.hard set to 1 ms as the boot reaches 'world' (the slow machine's case): the boot is NOT lifted while
//          its chain still lands steps (G1995's watchdog) - it ends on its own ('ready'), never 'hard timeout'
//
//   node tools/_bootlift_check.js                       the gate (the three children, one after the other)
//   node tools/_bootlift_check.js --only fly|stay|hard|diag  one of them
//   node tools/_bootlift_check.js --child fly|stay|hard|diag one child, its JSON on stdout's last line
//   BOOTLIFT_QUERY='simw=0'  the page's query (default: the page's own, the physics worker on)
// The RED/GREEN proof against older trains: copy this file into an old tree's tools/ and run it there (HANDOVER G1996).
'use strict';
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const V_MAX = 900000;   // virtual ms an until() may run

async function open(query) {
  const { openPage } = require('./_page_node.js');
  const P = await openPage({ quiet: true, query: [process.env.BOOTLIFT_QUERY || '', query || ''].filter(Boolean).join('&'), workers: /sim_host\.js/ });
  const W = P.win;
  // every render of a main scene, counted by scene (the world's, the shed's, any other) once the renderer exists
  const R = { world: 0, shed: 0, other: 0 };
  P.onFrame(ph => {
    const rr = W.FLYDIY_RENDERER;
    if (ph !== 'start' || !rr || rr.__bl) return;
    rr.__bl = true; const render = rr.render;
    rr.render = function (scene) {
      const ws = W.WORLD && W.WORLD.scene, hs = W.FLIGHT_PROBE && W.FLIGHT_PROBE.hangarScene && W.FLIGHT_PROBE.hangarScene();
      if (scene && scene === ws) R.world++; else if (scene && scene === hs) R.shed++; else R.other++;
      return render.apply(this, arguments);
    };
  });
  return { P, W, R };
}
const inShed = W => !!(W.document.body && W.document.body.classList && W.document.body.classList.contains('mode-ws'));
const reveals = W => { const E = W.FLIGHT_REC && W.FLIGHT_REC.rec && W.FLIGHT_REC.rec.events; return E ? E.filter(e => (Array.isArray(e) ? e[1] : e.kind) === 'reveal').length : 0; };
const trips = W => W.FLYDIY_TRIPS || [];
const lastTrip = W => { const L = trips(W); return L[L.length - 1] || null; };
const bootLog = W => (W.BOOT && W.BOOT.log) || [];
// the garage boot reaching step `id`: the step's own log line (BOOT.current flips back to null between two steps)
const reached = (W, id) => bootLog(W).some(e => e.k === 'step' && e.id === id) || (W.BOOT && W.BOOT.current && W.BOOT.current.id === id && W.BOOT.set === 'garage');

async function lift(ctx, at) {
  const { P, W } = ctx;
  const ok = await P.until(() => W.BOOT && W.BOOT.state === 'loading' && W.BOOT.set === 'garage' && W.BOOT.current && W.BOOT.current.id === at, V_MAX);
  if (!ok) return { lifted: false, why: 'never reached ' + at };
  W.BOOT.fail('hard timeout (GATE BOOTLIFT)');   // the watchdog's own path (boot.js fail -> hide -> the boot's done())
  return { lifted: W.BOOT.state === 'gone', at, busy: typeof W.BOOT.busy === 'function' ? W.BOOT.busy() : null, frameNo: P.frameNo };
}
// Fly, then the roll-out: its trip done and no screen up; then 60 frames - the world drawn, the reveal counted
async function fly(ctx) {
  const { P, W, R } = ctx;
  const n0 = trips(W).length, rv0 = reveals(W);
  const b = W.document.getElementById('bGo'); if (b) b.click();
  const ok = await P.until(() => { const t = lastTrip(W); return trips(W).length > n0 && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'; }, V_MAX);
  const t = lastTrip(W);
  const w0 = R.world; await P.frames(60);
  const fails = bootLog(W).filter(e => e.k === 'fail').map(e => e.reason);
  return { landed: ok, inShed: inShed(W), trip: t ? { kind: t.kind, done: !!t.done, ran: (t.steps || []).filter(s => s.ran).map(s => s.id) } : null,
    screen: W.BOOT.set, worldDrawn: R.world - w0, reveals: reveals(W) - rv0, fails };
}

async function child(which) {
  const ctx = await open(which === 'diag' ? 'diag=quick' : '');
  const { P, W, R } = ctx;
  const out = { which, errors: [] };
  if (which === 'diag') {
    // THE SELF-TEST (G1997, src/viewer/diag.js) run to its report: loaded only under ?diag, it rolls out, measures, puts the
    // graphics back as they were and leaves its report (no timing here - the harness has no GPU timer: the shape is held)
    const g0 = JSON.stringify(W.GFX ? W.GFX.get() : null);
    const ok = await P.until(() => W.FLYDIY_DIAG && (W.FLYDIY_DIAG.report || /stopped/.test(W.FLYDIY_DIAG.state)), V_MAX);
    const D = W.FLYDIY_DIAG || {}, R = D.report;
    out.diag = { ok, state: D.state, variants: R ? R.variants.map(v => v.id + ':' + v.frames) : null, census: R && R.census ? Object.keys(R.census.byOwner).length : null,
      gl: R && R.gl ? { renderer: R.gl.renderer, timer: R.gl.ext.EXT_disjoint_timer_query_webgl2 } : null, worst: R ? R.worst : null, text: D.text ? D.text().split(String.fromCharCode(10)).length : 0,
      restored: JSON.stringify(W.GFX ? W.GFX.get() : null) === g0, held: W.GFX && W.GFX.hw ? W.GFX.hw.state().ticks : null };
  } else if (which === 'hard') {
    // as the boot reaches the world (its slowest steps ahead), the hard timeout shrinks to 1 ms: only a chain that has
    // STOPPED moving may be lifted now
    await P.until(() => reached(W, 'world'), V_MAX);
    if (W.BOOT && W.BOOT.opt) W.BOOT.opt.hard = 1;
    await P.until(() => W.BOOT.state === 'gone', V_MAX);
    const L = bootLog(W);
    out.end = { state: W.BOOT.state, ready: L.some(e => e.k === 'ready'), fails: L.filter(e => e.k === 'fail').map(e => e.reason), steps: L.filter(e => e.k === 'step').map(e => e.id), vS: Math.round(P.clock.t / 1000) };
  } else {
    out.lift = await lift(ctx, 'compile');
    if (which === 'fly') {
      out.fly = await fly(ctx);
    } else {
      // the shed while the lifted chain finishes under it
      const s0 = R.shed; await P.frames(60);
      out.shedDrawn = R.shed - s0;
      await P.until(() => !(typeof W.BOOT.busy === 'function' && W.BOOT.busy()), V_MAX);
      out.chain = { busy: W.BOOT.busy(), landingLifted: bootLog(W).some(e => e.k === 'landing' && e.lifted), steps: bootLog(W).filter(e => e.k === 'step').map(e => e.id) };
      const s1 = R.shed; await P.frames(30);
      out.shedAfter = R.shed - s1;
      out.fly = await fly(ctx);
    }
  }
  out.renders = Object.assign({}, R);
  out.errors = P.errors.filter(e => /^(script |timer: |frame: |FLYDIY_BOOT)/.test(e)).slice(0, 8);
  try { P.close(); } catch (e) {}
  return out;
}

function verdict(r) {
  const lines = [], bad = [];
  const ok = (c, what) => { lines.push((c ? '  ok   ' : '  FAIL ') + what); if (!c) bad.push(what); };
  if (r.fly && r.which === 'fly') {
    ok(r.lift.lifted, 'fly: the screen lifted at ' + r.lift.at + ' (the chain still running: ' + r.lift.busy + ')');
    ok(r.fly.landed && !r.fly.inShed, 'fly: Fly mid-chain - the roll-out landed (trip ' + JSON.stringify(r.fly.trip) + ')');
    ok(r.fly.worldDrawn > 0, 'fly: the world drawn after the roll-out (' + r.fly.worldDrawn + ' renders in 60 frames)');
    ok(r.fly.reveals >= 1, 'fly: a reveal marked (' + r.fly.reveals + ')');
    ok(!r.fly.fails.some(f => /nothing landed/.test(f)), 'fly: no roll-out screen gave up (' + JSON.stringify(r.fly.fails) + ')');
  }
  if (r.which === 'stay') {
    ok(r.lift.lifted, 'stay: the screen lifted at ' + r.lift.at);
    ok(r.shedDrawn > 0, 'stay: the shed drawn while the chain finished under it (' + r.shedDrawn + ' renders in 60 frames)');
    ok(r.chain && !r.chain.busy && r.chain.landingLifted, 'stay: the lifted chain ran to its end (' + JSON.stringify(r.chain && r.chain.steps.slice(-4)) + ')');
    ok(r.shedAfter > 0, 'stay: the shed still drawn after it (' + r.shedAfter + ')');
    ok(r.fly.landed && !r.fly.inShed, 'stay: then Fly - the roll-out landed (' + JSON.stringify(r.fly.trip) + ', the screen: ' + r.fly.screen + ')');
    ok(r.fly.worldDrawn > 0, 'stay: the world drawn (' + r.fly.worldDrawn + ')');
    ok(r.fly.reveals >= 1, 'stay: a reveal marked with or without a roll-out screen (' + r.fly.reveals + ')');
  }
  if (r.which === 'diag') {
    const d = r.diag || {};
    ok(d.ok && d.variants && d.variants.length >= 3 && d.variants.every(v => +v.split(':')[1] > 0), 'diag: ?diag=quick ran to its report, every variant measured frames (' + JSON.stringify(d.variants) + ')');
    ok(d.census > 0 && d.text > 5 && !!d.gl, 'diag: the census by owner (' + d.census + ' owners), the GL facts, the text report (' + d.text + ' lines)');
    ok(d.restored, 'diag: the graphics put back exactly as they were');
  }
  if (r.which === 'hard') {
    ok(r.end.state === 'gone' && r.end.ready && !r.end.fails.some(f => /hard timeout/.test(f)), 'hard: hard = 1 ms from the world on - never lifted while steps land (ready; fails ' + JSON.stringify(r.end.fails) + ', ' + r.end.vS + ' virtual s)');
  }
  ok(!r.errors.length, r.which + ': no page error (' + JSON.stringify(r.errors).slice(0, 300) + ')');
  return { lines, bad };
}

(async () => {
  const ch = opt('child', null);
  if (ch) { const r = await child(ch); console.log(JSON.stringify(r)); process.exit(0); }
  const only = opt('only', null), list = only ? only.split(',') : ['fly', 'stay', 'hard', 'diag'];
  const all = [];
  for (const w of list) {
    const t0 = Date.now();
    const r = await new Promise(res => {
      const p = spawn(process.execPath, ['--max-old-space-size=6144', __filename, '--child', w], { cwd: path.join(__dirname, '..'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let o = '', e = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => e += d);
      p.on('close', code => { const last = o.trim().split('\n').pop(); try { res(JSON.parse(last)); } catch (x) { res({ which: w, crashed: code, errors: [e.slice(-600) || o.slice(-600)] }); } });
    });
    r.wallS = Math.round((Date.now() - t0) / 1000);
    all.push(r);
    const v = r.crashed != null ? { lines: ['  FAIL ' + w + ': the child crashed (' + r.crashed + '): ' + r.errors[0]], bad: ['crash'] } : verdict(r);
    console.log(w + ' (' + r.wallS + ' s)'); for (const l of v.lines) console.log(l);
    r.bad = v.bad;
  }
  if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(all, null, 1));
  const n = all.reduce((a, r) => a + r.bad.length, 0);
  console.log('GATE BOOTLIFT: ' + (n ? 'FAIL (' + n + ')' : 'PASS'));
  process.exit(n ? 1 : 0);
})();
