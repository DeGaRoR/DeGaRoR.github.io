#!/usr/bin/env node
// _rollreal_page.js - THE ROLL-OUT, THE PAGE ITSELF, IN NODE (G1117, ROLLOUT-REAL): dev.html on the recording GL
// (tools/_page_node.js, FRAMECOST's harness), the first boot's Cub, `Roll out` pressed as a player presses it. Held:
//   the shed's check plays, then THE WORLD ROLL (the trip's animWhere 'world', its anim 'played'); every world-roll frame
//   drawn in the world scene with the flight held (the solver's clock still); the aeroplane's last shot pose the stand's
//   (the craft at identity) and THE FLIGHT'S FIRST FRAME'S EYE within one reveal ease step of the shot's last (no jump);
//   what linked meanwhile (programs: at the cut and through the roll); no page error.
//   node tools/_rollreal_page.js [--q 'rollreal=0']   -> "ROLLREAL PAGE: PASS|FAIL" (~3 min, ~3.6 GB: a CPU lock)
'use strict';
const path = require('path');
const { openPage } = require('./_page_node.js');
const argv = process.argv.slice(2);
const Q = (i => i >= 0 ? argv[i + 1] : '')(argv.indexOf('--q'));
const fails = [];
const check = (ok, label, extra) => { console.log((ok ? '  ok     ' : '  FAIL   ') + label + (ok || extra === undefined ? '' : ' — ' + extra)); if (!ok) fails.push(label); };
(async () => {
  const cap = { world: null, rows: [], links0: null };
  const hooks = { afterScript(name, P) {
    if (name !== 'src/viewer/rollanim.js' || !P.win.ROLLANIM) return;
    const R = P.win.ROLLANIM, pw = R.playWorld;
    const hr = () => Number(process.hrtime.bigint()) / 1e6;   // REAL milliseconds (the page's clock is virtual)
    R.playWorld = function (o) { const t = hr(); const h = pw.call(this, o); cap.planMs = hr() - t; cap.world = { o, h, t0: P.win.performance.now() }; return h; };
    // THE CUT: the check's onDone runs it all in one task - the dissolve, rollOutStand, the world's phase, the plan
    const pl = R.play;
    R.play = function (o) { const od = o.onDone; if (od) o.onDone = function () { const t = hr(); const r = od.apply(this, arguments); cap.cutMs = (cap.cutMs || 0) + hr() - t; return r; }; return pl.call(this, o); };
    // a row a frame for the check too (its draws, links, uploads), marked by the phase
    R._rec = () => P.rec.snapshot();
    // a row a frame, at the host's second hook (after placeCamera: the frame's own eye)
    const cm = R.camera;
    R.camera = function () { const r = cm.apply(this, arguments); if (cap.world) row(); return r; };
  } };
  let row = () => {};
  const P = await openPage({ quiet: true, hooks, wip: 'default', query: Q });
  const W = P.win;
  const progs = () => { const R = W.FLYDIY_RENDERER; return R && R.info && R.info.programs ? R.info.programs.length : -1; };
  const recSum = () => { const r = P.rec.snapshot(); let b = 0, d = 0; for (const k in r.bytes) b += r.bytes[k]; for (const k in r.draws) d += r.draws[k]; return { b, d, links: r.links }; };
  let lastRec = null;
  row = () => {
    const o = cap.world.o, h = cap.world.h, rs = recSum(), dl = lastRec ? { d: rs.d - lastRec.d, b: rs.b - lastRec.b, links: rs.links - lastRec.links } : null; lastRec = rs;
    cap.rows.push({ busy: !h.done, t: h.t, cam: [o.camera.position.x, o.camera.position.y, o.camera.position.z],
      craft: [o.craft.position.x, o.craft.position.y, o.craft.position.z, o.craft.quaternion.w], simT: o.sim.t, progs: progs(), parent: o.craft.parent === W.WORLD.scene, gl: dl });
  };
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(30);
  const p0 = progs();
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(tripDone, 900000);
  await P.frames(20);
  const trip = W.FLYDIY_TRIPS[W.FLYDIY_TRIPS.length - 1];
  console.log('ROLLREAL PAGE: trip ' + JSON.stringify({ anim: trip.anim, where: trip.animWhere, world: trip.animWorld, ms: trip.ms, steps: trip.steps.filter(s => s.ran).map(s => s.id) }));
  if (Q.includes('rollreal=0')) {
    check(/^shed/.test(trip.animWhere) && trip.anim === 'played', 'option B played in the shed (' + trip.animWhere + ')');
  } else {
    check(trip.animWhere === 'world' && trip.anim === 'played' && !!cap.world, 'the world roll played (' + trip.animWhere + ', ' + trip.anim + ')', JSON.stringify(trip.animWorld));
    const rows = cap.rows, shot = rows.filter(r => r.busy), after = rows.filter(r => !r.busy);
    check(shot.length > 300, shot.length + ' world-roll frames drawn (' + (shot.length / 60).toFixed(2) + ' s at the rig clock)');
    check(shot.every(r => r.parent), 'every one in the world scene');
    check(shot.every(r => r.simT === shot[0].simT), 'the flight held through it (the solver\'s clock at ' + shot[0].simT + ')', shot[shot.length - 1].simT);
    const last = shot[shot.length - 1], first = after[0];
    check(last && last.craft[0] === 0 && last.craft[1] === 0 && last.craft[2] === 0 && last.craft[3] === 1, 'the last shot frame: the craft at identity (the stand\'s pose)', JSON.stringify(last && last.craft));
    const jump = first ? Math.hypot(first.cam[0] - last.cam[0], first.cam[1] - last.cam[1], first.cam[2] - last.cam[2]) : Infinity;
    const step = shot.length > 2 ? Math.max(...shot.slice(1).map((r, i) => Math.hypot(r.cam[0] - shot[i].cam[0], r.cam[1] - shot[i].cam[1], r.cam[2] - shot[i].cam[2]))) : 0;
    check(jump <= step, 'the hand-over: the flight\'s first eye ' + jump.toFixed(3) + ' m from the shot\'s last - no more than the shot\'s own largest step, ' + step.toFixed(3) + ' m (G1117: the reveal eases in)', jump);
    const g = shot.slice(1).map(r => r.gl).filter(Boolean), g2 = after.slice(1).map(r => r.gl).filter(Boolean), mx = (a, k) => a.length ? Math.max(...a.map(x => x[k])) : 0, md = (a, k) => { const v = a.map(x => x[k]).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : 0; };
    console.log('  THE CUT (the onDone of the check: the dissolve, rollOutStand, the world phase, revealPose, the plan): ' + (cap.cutMs || 0).toFixed(0) + ' ms real, of which the plan ' + (cap.planMs || 0).toFixed(1) + ' ms');
    console.log('  the world roll a frame: draws median ' + md(g, 'd') + ' (max ' + mx(g, 'd') + '), links max ' + mx(g, 'links') + ', upload bytes max ' + mx(g, 'b') + ' / the first flight frames: draws median ' + md(g2, 'd') + ', links max ' + mx(g2, 'links') + ', bytes max ' + mx(g2, 'b'));
    check(mx(g, 'links') === 0, 'no program linked on a world-roll frame', mx(g, 'links'));
    console.log('  programs: ' + p0 + ' before the click, ' + (shot[0] ? shot[0].progs : '-') + ' at the cut, ' + (last ? last.progs : '-') + ' at the shot\'s end, ' + progs() + ' after 20 flight frames');
  }
  const errs = P.errors.filter(e => !/sheet EMPTY/.test(e));
  check(errs.length === 0, 'no page error', errs.slice(0, 3).join(' | '));
  console.log('ROLLREAL PAGE: ' + (fails.length ? 'FAIL (' + fails.join('; ') + ')' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log(e && e.stack); console.log('ROLLREAL PAGE: FAIL'); process.exit(1); });
