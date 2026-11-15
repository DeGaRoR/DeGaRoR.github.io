#!/usr/bin/env node
// mud_shots.js - THE MUD ON THE GPU: the clods the wheels throw, the prop's wash over mud, and the mud coat on the aeroplane
// (DIRT-DUST for A0, 15 Nov 2026; the user: "I would like to see the mud projections as particles and on the plane").
// On the shared harness tools/page_rig.js (RIG-PROCEDURE.md): its server, Chrome on the real GPU, the boot wait, the grab
// read after FLYDIY_AA.render, the hard cap, WHY on a miss. This file adds only the mud and the eyes.
//
//   node tools/mud_shots.js --out <dir> [--cap 1500] [--build cub] [--look softmud|mud] [--q k=v] [--taxi 60 (s of taxi traced before the skip to line-up)]
//
// THE MUD. Nothing in the world is mud by default (SNOW-MUD: a strip or an area record places it). In the garage, before the
// roll-out, HOME's own strip in the premises record is given the look `softmud` (SURFACE 12) and recomposed through the world
// editor's path (WORLD.premises.setRecord + rebuild, WORLD.refreshGround over the extent, WORLD.repaintStrips - app.js
// stageCompose's own steps). Checked: world.surface at the strip's centre is 12 and the pavement there is class mud. If that
// fails (MODE B, said in the JSON): the main thread's world.surface reads 12 within 900 m of HOME's strip, as GATE MUDFLY
// does in node, and the dust's class is forced to mud - the clods and the coat are the game's, the ground drawn is not mud.
// THE FLIGHT: the Cub through the garage's door and the roll-out (dust_shots' proven flow); the pilot's own taxi and take-off.
// THE EYES: the game paused with #bPause at each moment (the dust steps on dt 0 while paused: the clods hang where they are),
// then free eyes (FLIGHT_PROBE.devFree) placed in the run's own frame (d = along the run, n = beside it, on the sun's side):
//   clean_rear34 / clean_front34   at HOLD, the threshold, before any mud
//   wash_rear / wash_side          2.5 s into the roll, full power at a walking pace (the prop's wall jet over mud)
//   roll_side / roll_rear34 / roll_front34   mid-roll (IAS > 11 m/s): the clods and the spatter off the wheels
//   muddy_rear34 / muddy_front34   the last of the ground run (IAS > 15.5): the same eyes as clean_*, the coat built
//   trail                          6 s after the lift-off: the strip behind, what hangs
// Writes <out>/mud_<eye>.png and <out>/mud_shots.json (base sha, GPU, the mud's mode, every eye, the coat, the trace).
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const PR = require(path.join(__dirname, 'page_rig.js'));
const LB = require(path.join(__dirname, '_load_build.js'));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', 'D:/Dev/flydiy-notes/evidence/mud-fx-2026-11-15');
const CAP = +opt('cap', 1500);
const LOOK = opt('look', 'softmud'), CODE = LOOK === 'mud' ? 11 : 12;
const BUILD = (() => { const b = opt('build', 'cub'); return LB.VALIDATED[b] ? LB.VALIDATED[b].build : b; })();
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const say = s => console.log('[' + new Date().toTimeString().slice(0, 8) + '] mud_shots: ' + s);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(path.isAbsolute(BUILD) ? BUILD : path.join(ROOT, BUILD), 'utf8')), spec = raw.spec || raw;
  let sha = null; try { sha = execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) {}
  const rec = { at: new Date().toISOString(), base: sha || 'a git archive copy (see README)', build: BUILD, look: LOOK, code: CODE, eyes: {}, trace: [], coat: {} };
  const save = () => fs.writeFileSync(path.join(OUT, 'mud_shots.json'), JSON.stringify(rec, null, 1));
  const rig = await PR.start({ cap: CAP, page: 'index.html', size: opt('size', '1600x900'), q: opt('q', ''), name: 'mud_shots' });
  rec.gpu = rig.gpu; rec.bootS = rig.bootS; rec.url = rig.url;
  const ev = rig.ev, J = rig.J;
  let misses = 0;
  try {
    // ---- the garage: the build, settled
    const ready = '(window.BOOT && BOOT.state === "gone" && !(typeof BOOT.busy === "function" && BOOT.busy()) && window.GARAGE_SPEC && window.FLIGHT_PROBE && !(window.CAGE_CREW_PENDING && CAGE_CREW_PENDING()))';
    for (let i = 0; i < 120; i++) { if (await ev(ready).catch(() => false)) break; await sleep(2000); }
    await ev('(()=>{window.GARAGE_SPEC.set(' + JSON.stringify(spec) + ');return 1})()');
    { let last = null, same = 0;
      for (let i = 0; i < 150; i++) { await sleep(2000); const sx = await ev(ready + ' ? JSON.stringify(GARAGE_SPEC.get()) : null').catch(() => null);
        if (!sx) continue; if (sx === last) { if (++same >= 2) break; } else { last = sx; same = 0; } } }
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
    say('build set at ' + Math.round((Date.now() - T0) / 1000) + ' s');

    // ---- THE MUD (mode A): HOME's strip in the premises record -> softmud, recomposed the world editor's way
    rec.mudA = await J(`(() => { const W = FLIGHT_PROBE.world(), o = {}, LOOK = ${JSON.stringify(LOOK)}, CODE = ${CODE};
      o.aeros = (W.aerodromes || []).filter(a => a.premises || a.id === 'HOME').slice(0, 14).map(a => ({ id: a.id, prem: !!a.premises, look: a.look, surface: a.surface, x: Math.round(a.x), z: Math.round(a.z), len: a.len }));
      const rec = W.premises && W.premises.rec, R = window.WORLD && WORLD.premises;
      if (!rec || !R || !R.setRecord || !R.rebuild) { o.A = 'no premises record or renderer'; return o; }
      const rec2 = JSON.parse(JSON.stringify(rec)), rws = (rec2.layers && rec2.layers.runways) || [], rw = rws.find(r => r.id === 'HOME');
      o.runways = rws.map(r => r.id + ':' + r.look);
      if (!rw) { o.A = 'no HOME runway in the premises record'; return o; }
      o.was = { look: rw.look, surface: rw.surface }; rw.look = LOOK; rw.surface = CODE;
      const t0 = performance.now();
      try { R.setRecord(rec2); R.rebuild(null);
        const ov = W.premises.overlay;
        if (ov && WORLD.refreshGround) { const F = ov.frame, e = ov.extent, c = [F.toWorld(e.x0, e.z0), F.toWorld(e.x1, e.z0), F.toWorld(e.x1, e.z1), F.toWorld(e.x0, e.z1)];
          WORLD.refreshGround({ x0: Math.min(...c.map(q => q[0])), z0: Math.min(...c.map(q => q[1])), x1: Math.max(...c.map(q => q[0])), z1: Math.max(...c.map(q => q[1])) }); }
        if (WORLD.repaintStrips) WORLD.repaintStrips();
      } catch (e) { o.err = String(e && e.message || e).slice(0, 300); }
      o.ms = Math.round(performance.now() - t0);
      const H = (W.aerodromes || []).find(a => a.id === 'HOME'), ov = W.premises.overlay;
      o.home = H ? { look: H.look, surface: H.surface, x: +H.x.toFixed(1), z: +H.z.toFixed(1), hdg: +H.hdg.toFixed(4), len: H.len, wid: H.wid } : null;
      if (H) { o.surfAt = W.surface(H.x, H.z); const q = ov && ov.pavedAt ? ov.pavedAt(H.x, H.z, 0) : null; o.paveAt = q ? q.cls : null; }
      o.A = o.surfAt === CODE ? 'ok' : 'the strip does not read mud';
      return o; })()`).catch(e => ({ A: 'threw: ' + String(e.message || e).slice(0, 300) }));
    rec.mode = rec.mudA && rec.mudA.A === 'ok' ? 'A' : 'B';
    say('mud A: ' + JSON.stringify(rec.mudA).slice(0, 900)); save();

    // ---- THE ROLL-OUT (dust_shots' flow: one click, the cover waited out)
    const coverGone = '(window.BOOT && BOOT.state === "gone" && !(typeof BOOT.busy === "function" && BOOT.busy()))';
    const isFlying = "(()=>{try{const ap=FLIGHT_PROBE.ap();return !!(ap&&ap.phase)}catch(e){return false}})()";
    let flying = false;
    for (let a = 0; a < 3 && !flying; a++) {
      await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(4000);
      for (let i = 0; i < 150; i++) { if (await ev(coverGone).catch(() => false)) break;
        await ev("(()=>{const f=document.getElementById('bootFly');if(window.BOOT&&BOOT.state==='waiting'&&f&&!f.disabled)f.click();return 1})()").catch(() => 0); await sleep(2000); }
      await sleep(3000); flying = await ev(isFlying).catch(() => false);
      say('roll-out click ' + (a + 1) + ': flying ' + flying + ' at ' + Math.round((Date.now() - T0) / 1000) + ' s');
    }
    if (!flying) { rec.why = await rig.why(); save(); throw new Error('the roll-out never happened'); }
    rig.flying = true;

    // ---- MODE B (the record path failed): the main thread's surface and the dust's class read mud round HOME's strip
    const H = rec.mudA && rec.mudA.home;
    if (rec.mode === 'B') rec.mudB = await J(`(() => { const W = FLIGHT_PROBE.world(), c = FLIGHT_PROBE.camGet().target, CODE = ${CODE};
      const cx = ${H ? H.x : 'c[0]'}, cz = ${H ? H.z : 'c[2]'}, s0 = W.surface.bind(W);
      W.surface = (x, z) => Math.hypot(x - cx, z - cz) < 900 ? CODE : s0(x, z);
      const F = window.DUST_FX && DUST_FX.make && DUST_FX.make(), ci = window.DUST.CLASSES.indexOf('mud');
      if (F) { const e0 = F.env.cls.bind(F.env); F.env.cls = (x, z) => Math.hypot(x - cx, z - cz) < 900 ? ci : e0(x, z); }
      return { at: [cx, cz], dust: !!F, ci, surfNow: W.surface(c[0], c[2]) }; })()`).catch(e => ({ err: String(e.message || e) }));
    if (rec.mudB) say('MODE B: ' + JSON.stringify(rec.mudB));
    rec.sun = await J("(()=>{try{const d=window.DAY_CLOCK&&DAY_CLOCK.day&&DAY_CLOCK.day();return d&&d.sun?Array.from(d.sun).map(v=>+v.toFixed(3)):null}catch(e){return null}})()").catch(() => null);
    save();

    // ---- the eyes in the run's frame
    const PAUSE = async () => { await ev("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return b&&b.textContent})()"); await rig.frames(3); };
    const RESUME = async () => { await ev("(()=>{const b=document.getElementById('bPause');if(b&&/resume|run/i.test(b.textContent))b.click();return b&&b.textContent})()"); await rig.frames(2);
      const t = await ev("(()=>{const b=document.getElementById('bPause');return b&&b.textContent})()"); if (!/pause/i.test(t || '')) throw new Error('RESUME failed: #bPause reads ' + t); };
    // (15 Nov slot: the button reads 'Run' when paused, not 'Resume' - the first run never resumed and sat paused at HOLD 11 min)
    // the plane's place: camGet().target, the drawn CG (cgD). The craft Group sits at the ORIGIN - its parts are posed in world space:
    // the 17:05 slot shot ten stills of the grass at 0,0,0. The sim's own cgPos beside it, their gap logged
    const where = () => J(`(() => { const t = FLIGHT_PROBE.camGet().target, s0 = FLIGHT_PROBE.sim(); let g0 = null; try { g0 = s0 && s0.cgPos ? Array.from(s0.cgPos()) : null; } catch (e) {} const c = t;
      const W = FLIGHT_PROBE.world(), s = FLIGHT_PROBE.sim(), o = s && s.out || {};
      return { P: c.map(v => +v.toFixed(2)), sim: g0 && g0.map(v => +(+v).toFixed(2)), gap: g0 ? +Math.hypot(g0[0] - t[0], g0[1] - t[1], g0[2] - t[2]).toFixed(2) : null, g: +W.terrainH(c[0], c[2]).toFixed(2), surf: W.surface(c[0], c[2]), softZ: o.softZ != null ? +(+o.softZ).toFixed(3) : null,
        softW: o.softW ? Array.from(o.softW).map(v => +(+v).toFixed(3)) : null, coat: (typeof AERO_WX !== 'undefined' && AERO_WX.live) ? +AERO_WX.live.m.toFixed(3) : 0,
        puffs: window.DUST_FX && DUST_FX.fx ? DUST_FX.fx.sys.P.live : null, v: s && s.v ? Array.from(s.v).slice(0, 3).map(v => +(+v).toFixed(2)) : null }; })()`);
    // d: along the run (HOME's hdg, the sign that points from the aeroplane to the strip's far end); n: beside it, on the sun's side
    let D = null, N = null;
    const frameAt = w => {
      let d = H ? [Math.cos(H.hdg), Math.sin(H.hdg)] : [1, 0];
      if (H) { const far = [H.x + d[0] * H.len / 2, H.z + d[1] * H.len / 2], far2 = [H.x - d[0] * H.len / 2, H.z - d[1] * H.len / 2];
        if (Math.hypot(far2[0] - w.P[0], far2[1] - w.P[2]) > Math.hypot(far[0] - w.P[0], far[1] - w.P[2])) d = [-d[0], -d[1]]; }
      let n = [-d[1], d[0]];
      if (rec.sun && rec.sun[0] * n[0] + rec.sun[2] * n[1] < 0) n = [-n[0], -n[1]];
      return { d, n };
    };
    // an eye at P + a*d + b*n, h over the ground, looking at P + ta*d (tdy over the CG)
    const shoot = async (name, w, a, b, h, ta, tdy) => {
      const P = w.P, ex = P[0] + D[0] * a + N[0] * b, ez = P[2] + D[1] * a + N[1] * b;
      const gy = await ev('FLIGHT_PROBE.world().terrainH(' + ex + ',' + ez + ')'), ey = gy + h;
      const tx = P[0] + D[0] * (ta || 0), tz = P[2] + D[1] * (ta || 0), ty = P[1] + (tdy || 0);
      const dx = tx - ex, dy = ty - ey, dz = tz - ez, yaw = Math.atan2(dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      await rig.eye(ex, ey, ez, yaw, pitch); await rig.frames(20);
      const inF = await J(`(() => { const cam = FLIGHT_PROBE.camera(); if (!cam) return { ok: null }; cam.updateMatrixWorld(true);
        const v = cam.position.clone().set(${P[0]}, ${P[1]}, ${P[2]}), d = v.distanceTo(cam.position); v.project(cam);
        return { ok: v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95, ndc: [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(4)], dist: +d.toFixed(1) }; })()`).catch(e => ({ ok: null, err: String(e.message || e) }));
      if (w.gap != null && w.gap > 5) { inF.warn = 'the aim point is ' + w.gap + ' m from FLIGHT_PROBE.sim().cgPos() (which ran stale on 14 Nov): a WARNING, not a miss'; say('WARNING ' + name + ': ' + inF.warn); }
      if (Math.hypot(P[0], P[2]) < 1) { inF.ok = false; inF.why = 'the aim point is the world origin'; }
      if (inF.ok === false) { misses++; rec.eyes[name] = { eye: [ex, ey, ez].map(v => +v.toFixed(2)), yaw, pitch, at: w, inFrame: inF, why: inF.why || 'the aim point is not in the frame' }; say('MISS ' + name + ': plane not in frame ' + JSON.stringify(inF));
        save(); if (misses >= 2) throw new Error('two misses: stop (RIG-PROCEDURE 4)'); return; }
      try { const png = await rig.grab({ settle: 6 }); const f = path.join(OUT, 'mud_' + name + '.png'); fs.writeFileSync(f, png);
        rec.eyes[name] = { eye: [ex, ey, ez].map(v => +v.toFixed(2)), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), at: w, info: png.info && { mean: png.info.mean, sd: png.info.sd, blank: png.info.blank }, inFrame: inF };
        say('wrote ' + f + ' (' + png.length + ' B' + (png.info && png.info.blank ? ', BLANK' : '') + ')');
        if (png.info && png.info.blank) { misses++; rec.eyes[name].why = await rig.why(); }
      } catch (e) { misses++; rec.eyes[name] = { err: String(e.message || e), why: e.why || null }; say('MISS ' + name + ': ' + e.message); }
      save(); if (misses >= 2) throw new Error('two misses: stop (RIG-PROCEDURE 4)');
    };

    // ---- THE TAXI, A MINUTE OF IT, THEN THE GAME'S OWN "Skip to line-up" (#bSkip: placeLinedUp - the aeroplane at the runway
    // hold, lined up, engine running, the pilot at HOLD). 15 Nov 15:15 slot: the taxi took 665 s (Sat on master ~190 s) - the
    // minute's trace (speed over the ground, throttle, rpm, the surface under the craft) says whether the Cub bogs on the soft mud.
    const TAXI_S = +opt('taxi', 60);
    const tq = () => J("(()=>{const W=FLIGHT_PROBE.world(),s=FLIGHT_PROBE.sim(),o=s&&s.out||{},ap=FLIGHT_PROBE.ap();const c=FLIGHT_PROBE.camGet().target;"
      + "return {ph:ap&&ap.phase,P:c.map(v=>+v.toFixed(2)),surf:W.surface(c[0],c[2]),thr:s&&s.ctl&&s.ctl.thr!=null?+(+s.ctl.thr).toFixed(3):null,rpm:o.rpm!=null?Math.round(o.rpm):null,softZ:o.softZ!=null?+(+o.softZ).toFixed(3):null}})()");
    rec.taxi = [];
    for (let t0 = Date.now(), prev = null; Date.now() - t0 < TAXI_S * 1000;) {
      const q = await tq().catch(e => ({ err: String(e.message || e) })); q.t = Math.round((Date.now() - t0) / 1000);
      if (prev && q.P && prev.P) q.gs = +(Math.hypot(q.P[0] - prev.P[0], q.P[2] - prev.P[2]) / Math.max(1, q.t - prev.t)).toFixed(2);
      rec.taxi.push(q); say('taxi ' + JSON.stringify(q)); prev = q; if (q.ph && !/DEPART|TAXI|LINEUP|STOP/.test(q.ph)) break; await sleep(5000);
    }
    rec.skip = await ev("(()=>{const b=document.getElementById('bSkip');if(!b)return 'none';if(b.hidden)return 'hidden';if(b.disabled)return 'disabled: '+b.title;b.click();return 'clicked'})()").catch(e => 'err ' + e.message);
    say('skip to line-up: ' + rec.skip);
    if (rec.skip === 'clicked') { await sleep(3000);
      for (let i = 0; i < 150; i++) { if (await ev(coverGone).catch(() => false)) break; await sleep(2000); }
      await rig.frames(30); rec.lined = await tq().catch(() => null); say('lined up: ' + JSON.stringify(rec.lined)); }
    save();

    // ---- the take-off, the pilot's own
    let last = null, holdDone = false, washDone = false, midDone = false, lateDone = false, liftT = 0, rollT = 0, mid = null;
    const tEnd = Date.now() + Math.max(60, CAP - (Date.now() - T0) / 1000 - 45) * 1000;
    while (Date.now() < tEnd) {
      const s = await J("(()=>{const ap=FLIGHT_PROBE.ap(),sim=FLIGHT_PROBE.sim();return {ph:ap.phase,ias:sim&&sim.out?(sim.out.ias!=null?sim.out.ias:sim.out.V):null}})()").catch(() => null);
      if (!s) { await sleep(300); continue; }
      if (s.ph !== last) { rec.trace.push([((Date.now() - T0) / 1000).toFixed(1), s.ph, s.ias]); last = s.ph; say(s.ph + ' ias=' + s.ias); save(); }
      if (!holdDone && (s.ph === 'HOLD' || s.ph === 'ROLL')) { holdDone = true; await PAUSE(); const w = await where(); ({ d: D, n: N } = frameAt(w)); rec.frame = { d: D, n: N, at: w };
        rec.coat.hold = w.coat; say('hold ' + JSON.stringify(w));
        await shoot('clean_rear34', w, -7, 5, 0.9, 0, -0.5); await shoot('clean_front34', w, 7, 5.5, 0.9, 0, -0.5); await RESUME(); continue; }
      if (s.ph === 'ROLL' && !rollT) rollT = Date.now();
      if (rollT && !washDone && Date.now() - rollT > 2500) { washDone = true; await PAUSE(); const w = await where(); say('wash ' + JSON.stringify(w));
        await shoot('wash_rear', w, -16, 7, 3.0, -3, -0.8); await shoot('wash_side', w, -2, 11, 1.2, -3, -0.6); await RESUME(); continue; }
      if (rollT && !midDone && s.ias > 11 && s.ph === 'ROLL') { midDone = true; await PAUSE(); const w = await where(); mid = w; say('mid ' + JSON.stringify(w));
        await shoot('roll_side', w, -3, 12, 1.3, -2, -0.6); await shoot('roll_rear34', w, -15, 7, 2.2, -2, -0.5); await shoot('roll_front34', w, 12, 6, 1.0, -1, -0.6); await RESUME(); continue; }
      if (rollT && !lateDone && s.ias > 15.5 && s.ph === 'ROLL') { lateDone = true; await PAUSE(); const w = await where(); rec.coat.late = w.coat; say('late ' + JSON.stringify(w));
        await shoot('muddy_rear34', w, -7, 5, 0.9, 0, -0.5); await shoot('muddy_front34', w, 7, 5.5, 0.9, 0, -0.5); await RESUME(); continue; }
      if (s.ph === 'LIFTOFF' && !liftT) liftT = Date.now();
      if (liftT && Date.now() - liftT > 6000) { await PAUSE(); const w = await where(); rec.coat.air = w.coat; say('air ' + JSON.stringify(w));
        if (mid) await shoot('trail', mid, -10, 16, 5, 25, -1.0);
        break; }
      await sleep(100);
    }
    rec.done = true; rec.misses = misses; rec.ageS = Math.round((Date.now() - T0) / 1000); save();
    say('done: ' + Object.keys(rec.eyes).length + ' eyes, ' + misses + ' misses, coat ' + JSON.stringify(rec.coat) + ', mode ' + rec.mode);
  } catch (e) { rec.error = String(e.message || e); save(); say('ERROR ' + rec.error); process.exitCode = 1; }
  finally { await rig.close(); }
})();
