#!/usr/bin/env node
// GATE TAILWHEEL (G3800, TAILWHEELS) - THE TAIL CONTACT'S FOUR LAWS, A WHEEL A BOOM, THE INVERTED V ON ITS TIPS.
//
// The user (A0, 3 Nov 2026): "the swivel tailwheel ... let's do it with the skid directly, so we have a set of cool
// tailwheels. We may also authorize tailwheels on dual booms" - "One wheel per boom, same settings for the twin planes.
// And maybe it's the opportunity to do the inverted V-tail and the ability of sticking wheels on top of the inverted V
// fins?". Every row flies tools/tw_probe.js (a flat field, the hand on the sim's own ctl; the circuit by the game's own
// host and pilot from HOME's line-up) as a child process, four at a time:
//
//   node tools/_tailwheel_check.js            -> "GATE TAILWHEEL: PASS|FAIL"
//   node tools/_tailwheel_check.js --show     -> every probe's record
//
// A. THE STEERABLE WHEEL (law 1, the Scott kind, every taildragger's default):
//    1 the Cub pivots 180 deg on the inside toe brake (full rudder, power) within 2 wingspans, the wheel breaking out;
//      released (both brakes, the pedals centred, a little power, the line held on the toe brakes) it RE-LOCKS and
//      rolls straight (under 10 deg);
//    2 a brake-free 180 deg with full rudder and power - Cub, Jodel, Rufus - inside 20 s;
//    3 HOME's circuit on the autopilot (the line-up, the take-off roll, the landing's roll-out): no breakout on the runway,
//      the roll inside 10 deg, the roll-out inside 20 - Cub, Jodel, Rufus.
// B. THE LOCKABLE WHEEL (law 2, the DC-3's): locked, the full-power roll holds straight (under 2 deg, 2 m), never
//    castoring; unlocked, the brake pivot turns 180 deg.
// C. FIXED (law 3) and THE SKID (law 4) on the Tiger Moth-alike: the skid stops it from 12 m/s on grass, no brake, in a
//    measured distance shorter than its wheel's (the skid IS the brake), and on pavement shorter than its wheel's
//    there; the fixed wheel holds the take-off roll.
// D. TWIN BOOMS, A WHEEL A BOOM (the drawn twin made a taildragger by the Undercarriage tile): it stands on both tail
//    contacts, rolls straight, turns 180 deg on the brake; flies the HOME circuit and lands.
// E. THE INVERTED V ON TWIN BOOMS (the Empennage tile's): it stands on its two tip wheels, turns 180 deg on the brake,
//    takes off, flies the HOME circuit and lands (touchdown under 3 m/s, the roll-out inside 20 deg, STOPPED).
// F. THE CONTROLS' SIGNS on the inverted V (the probe at cruise, the generator's twin at 25-55 deg): yaw and pitch the
//    conventional tail's way, the rudder's pitch under 2 % of the elevator's; the design check's tail volumes read its
//    projections (Sh = S cos^2 G, Sv = S sin^2 G).
// G. OLD SAVES: s2Steer 0 and 1 load as the steerable wheel (no key), 2 (G3575's full swivel, the DC-3's) as the
//    lockable one; a spec's `twSwivel: true` clamps to `twMode: 'lock'`.
// I. THE V FROM THE BOOMS, THE OTHER THREE WAYS (G3801, the user 4 Nov: "inverted T-tail, but on the outside ... the
//    upward ... facing towards each other, inwards. So we have all possible options, with little wheels if the V is
//    downward"): down & out stands on its two tip wheels, up & in and up & out on a tailwheel a boom; each turns 180 deg
//    on the brake and flies HOME's circuit; their controls yaw and pitch the conventional tail's way (F's probe, the
//    rudder's pitch under 4 %), the clamp keeps only the four ways, an outward V's reach only on an outward one.
// J. THE PUSHER WITH THE A (G3801, the user 4 Nov: "check the pusher with the A"): the new-plane chooser's own path
//    (tools/_newplane_lib.js judge: bake, the drawing layers, the join, the stance fit) for a twin-boom pusher
//    taildragger - the A: its disc clear of the tail by more than 0.5 m in the joined drawing, the design check's Vv
//    and Vh passing (the vertical arm is the panels' own: lv = lh); the inverted V: the stance fit stands it on its tip
//    wheels inside the 7-17 deg window (the mains lowered), its Vv passing. The fails the chooser stands on for every
//    pusher (the disc through the wing or body) and the twin booms' three-point deck under 7 (the conventional tail's
//    too) are named, not counted.
// H. THE INVERTED V'S HARDWARE (the user, 4 Nov, a picture: "the hinges did not like that" - the elevator's cable lay a
//    metre along the boom to a boss up its flank): on every twin-boom fixture made an inverted V by the Empennage tile,
//    each elevator's link leaves its boom within 0.3 m of the horn, the hinge straps sit on their own panel (inside its
//    box), and the join's declared hinge line is the panel's own (the vertices it catches are the surface's: 'declared');
//    G3801: in all four ways, and the drawn ruddervators' trailing edges swing to PORT on a nose-left pedal on both
//    panels (the join's sgn2, by the hinge axis's own lean).
'use strict';
const path = require('path'), { spawn } = require('child_process');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const SHOW = process.argv.includes('--show');
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };

function probe(args) {
  return new Promise(res => {
    const p = spawn(process.execPath, [path.join(T, 'tw_probe.js'), ...args], { cwd: path.join(T, '..') });
    let out = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', () => {});
    p.on('close', () => {
      const recs = out.split('\n').filter(l => l.startsWith('{')).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
      res(Object.fromEntries(recs.map(r => [r.case, r])));
    });
  });
}
async function pool(jobs, n) {
  const out = new Array(jobs.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; out[k] = await probe(jobs[k]); } }));
  return out;
}

(async () => {
  const t0 = Date.now();
  const JOBS = {
    cub: ['--build', 'cub', '--case', 'pivot,rudder'],
    jodel: ['--build', 'jodel', '--case', 'rudder'],
    rufus: ['--build', 'rufus', '--case', 'rudder'],
    cubC: ['--build', 'cub', '--case', 'circuit'],
    jodelC: ['--build', 'jodel', '--case', 'circuit'],
    rufusC: ['--build', 'rufus', '--case', 'circuit'],
    dc3lk: ['--build', 'dc3', '--case', 'roll'],
    dc3un: ['--build', 'dc3', '--lock', '0', '--case', 'pivot'],
    tigerW: ['--build', 'tiger', '--case', 'stop'],
    tigerS: ['--build', 'tiger', '--cage', 's2Steer=4', '--case', 'stop,stand'],
    tigerSp: ['--build', 'tiger', '--cage', 's2Steer=4', '--surface', 'paved', '--case', 'stop', '--secs', '90'],
    tigerWp: ['--build', 'tiger', '--surface', 'paved', '--case', 'stop', '--secs', '90'],
    tigerF: ['--build', 'tiger', '--cage', 's2Steer=3', '--case', 'roll'],
    twintd: ['--build', 'twintd', '--case', 'stand,roll,pivot,circuit'],
    twiniv: ['--build', 'twiniv', '--case', 'stand,pivot,circuit'],
    ivOut: ['--build', 'twiniv', '--cage', 'stIvDir=1', '--case', 'stand,pivot,circuit'],     // G3801
    bvIn: ['--build', 'twiniv', '--cage', 'stIvDir=2', '--case', 'stand,pivot,circuit'],
    bvOut: ['--build', 'twiniv', '--cage', 'stIvDir=3', '--case', 'stand,pivot,circuit'],
    lazair: ['--build', 'lazair', '--case', 'stand,pivot,circuit'],                              // LAZAIR (K)
  };
  const keys = Object.keys(JOBS);
  const res = await pool(keys.map(k => JOBS[k]), +(process.env.TW_JOBS || 4));
  const R = Object.fromEntries(keys.map((k, i) => [k, res[i] || {}]));
  if (SHOW) for (const k of keys) console.log(k, JSON.stringify(R[k]));
  const g = (k, c) => (R[k] && R[k][c]) || {};

  console.log('A. THE STEERABLE WHEEL (law 1)');
  { const p = g('cub', 'pivot');
    ok(p.t180 != null && p.withinSpans <= 2 && p.castAt != null && !p.crashed,
       `A1 the Cub pivots 180 deg on the brake in ${p.t180} s, the CG within ${p.withinSpans} spans (<= 2), broken out at ${p.castAt} s`);
    ok(p.relockAfterReleaseS != null && p.drift12sDeg < 10,
       `A1 ...released, it re-locks (${p.relockAfterReleaseS} s) and rolls straight (${p.drift12sDeg} deg < 10)`); }
  for (const b of ['cub', 'jodel', 'rufus']) {
    const r = g(b, 'rudder');
    ok(r.t180 != null && r.t180 < 20 && !r.crashed, `A2 ${b}: a brake-free 180 deg on full rudder and power in ${r.t180} s (< 20), the circle ${r.diamM} m`);
  }
  for (const b of ['cub', 'jodel', 'rufus']) {
    const c = g(b + 'C', 'circuit'), br = (c.breakouts || []).filter(q => /^(ROLL|LIFTOFF|ROLLOUT|FLARE)@/.test(q));
    ok(/STOPPED/.test(c.phases || '') && !c.crashed && !br.length && c.rollHdgMaxDeg < 10 && c.rolloutHdgMaxDeg < 20,
       `A3 ${b}: HOME's circuit on the autopilot - no breakout on the runway (${br.length ? br.join(' ') : 'none'}), the roll ${c.rollHdgMaxDeg} deg, the roll-out ${c.rolloutHdgMaxDeg} deg, the touchdown ${c.touchdowns && c.touchdowns[0] ? c.touchdowns[0].sink : '-'} m/s`);
  }
  console.log('B. THE LOCKABLE WHEEL (law 2, the DC-3)');
  { const r = g('dc3lk', 'roll');
    ok(r.castAt == null && r.hdgMaxDeg < 2 && r.crossMaxM < 2 && r.tEnd != null,
       `B locked: the DC-3's full-power roll holds ${r.hdgMaxDeg} deg / ${r.crossMaxM} m (< 2, < 2), never castoring`);
    const p = g('dc3un', 'pivot');
    ok(p.t180 != null && p.t180 < 40 && !p.crashed, `B unlocked: the brake pivot turns 180 deg in ${p.t180} s (< 40)`); }
  console.log('C. FIXED AND THE SKID (laws 3, 4), the Tiger Moth-alike');
  { const w = g('tigerW', 'stop'), s = g('tigerS', 'stop'), sp = g('tigerSp', 'stop'), st = g('tigerS', 'stand');
    ok(st.mode === 4 && st.tailContacts === 1 && st.contacts && st.contacts.tw, `C the skid build stands on its shoe (law ${st.mode})`);
    ok(s.dStop > 0 && w.dStop > 0 && s.dStop < w.dStop,
       `C the skid stops it from 12 m/s on grass, no brake, in ${s.dStop} m / ${s.tStop} s (the wheel's ${w.dStop} m / ${w.tStop} s)`);
    const wp = g('tigerWp', 'stop');
    ok(sp.dStop > 0 && wp.dStop > 0 && sp.dStop < wp.dStop, `C ...on pavement in ${sp.dStop} m (its wheel's ${wp.dStop} m: the mains roll further there, the shoe drags harder)`);
    const f = g('tigerF', 'roll');
    ok(f.tEnd != null && f.hdgMaxDeg < 10 && !f.crashed, `C fixed: the take-off roll ${f.hdgMaxDeg} deg (< 10)`); }
  console.log('D. TWIN BOOMS, A TAILWHEEL A BOOM');
  { const st = g('twintd', 'stand'), r = g('twintd', 'roll'), p = g('twintd', 'pivot'), c = g('twintd', 'circuit');
    ok(st.tailContacts === 2 && st.tailClear && st.tailClear.every(v => v < 0.03) && st.contacts.mains.every(Boolean),
       `D it stands on both tail contacts (clear ${JSON.stringify(st.tailClear)} m) and both mains, deck ${st.deckDeg} deg`);
    ok(r.tEnd != null && r.hdgMaxDeg < 10, `D it rolls straight at full power (${r.hdgMaxDeg} deg)`);
    ok(p.t180 != null && p.withinSpans <= 2, `D it turns 180 deg on the brake in ${p.t180} s within ${p.withinSpans} spans`);
    ok(/STOPPED/.test(c.phases || '') && !c.crashed && c.touchdowns && c.touchdowns.length && c.touchdowns[0].sink < 3,
       `D it flies HOME's circuit and lands (${c.touchdowns && c.touchdowns[0] ? c.touchdowns[0].sink : '-'} m/s), the roll-out ${c.rolloutHdgMaxDeg} deg`); }
  console.log('E. THE INVERTED V ON TWIN BOOMS, ON ITS TIP WHEELS');
  { const st = g('twiniv', 'stand'), p = g('twiniv', 'pivot'), c = g('twiniv', 'circuit');
    ok(st.iv >= 20 && st.tailContacts === 2 && st.tailClear && st.tailClear.every(v => v < 0.03) && st.deckDeg > 0,
       `E it stands on its two tip wheels (the V at ${st.iv} deg, clear ${JSON.stringify(st.tailClear)} m), deck ${st.deckDeg} deg tail-down`);
    ok(p.t180 != null && p.withinSpans <= 2, `E it turns 180 deg on the brake in ${p.t180} s within ${p.withinSpans} spans`);
    ok(/LIFTOFF/.test(c.phases || '') && /STOPPED/.test(c.phases || '') && !c.crashed && c.touchdowns && c.touchdowns.length
       && c.touchdowns[0].sink < 3 && c.rolloutHdgMaxDeg < 20,
       `E it takes off, flies HOME's circuit and lands (${c.touchdowns && c.touchdowns[0] ? c.touchdowns[0].sink : '-'} m/s), the roll-out ${c.rolloutHdgMaxDeg} deg (< 20)`); }

  console.log('F. THE INVERTED V\'S CONTROLS AND VOLUMES');
  { const mk = iv => { const s = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); s.tail.type = 'twinBoom'; s.tail.boomX = 1.2; s.tail.boomLen = 3.5;
                       s.fuselage.boom = 'twin'; if (iv != null) s.tail.ivAngle = iv; return s; };
    const au = d => { const sim = C.makeSim(d, null); sim.reset(0); const V = d.params.ap.VCruise;
      const at = (de, dr) => { sim.ctl.de = de; sim.ctl.dr = dr; return sim.probe([-V, 0, 0]); };
      const b0 = at(0, 0), r = at(0, 0.2), e = at(0.2, 0);
      return { Ydr: (r.yawLeft - b0.yawLeft) / 0.2, Pde: (e.pitchUp - b0.pitchUp) / 0.2, Pdr: (r.pitchUp - b0.pitchUp) / 0.2 }; };
    const conv = au(C.buildGen(mk(null)));
    for (const ang of [25, 35, 45, 55]) {
      const d = C.buildGen(mk(ang)), a = au(d), t = d.spec.tail, G = ang * Math.PI / 180;
      ok(Math.sign(a.Ydr) === Math.sign(conv.Ydr) && Math.sign(a.Pde) === Math.sign(conv.Pde) && Math.abs(a.Pdr) < 0.02 * Math.abs(a.Pde),
         `F ${ang} deg: dYaw/dr ${a.Ydr.toFixed(0)} (twin conv ${conv.Ydr.toFixed(0)}), dPitch/de ${a.Pde.toFixed(0)} (${conv.Pde.toFixed(0)}), x-talk ${(100 * Math.abs(a.Pdr / a.Pde)).toFixed(1)} %`);
      const dc = C.genDesignCheck ? C.genDesignCheck(d) : null, rows = dc && (dc.rows || dc);
      const vh = Array.isArray(rows) ? rows.find(q => q.id === 'pitch.Vh') : null, vv = Array.isArray(rows) ? rows.find(q => q.id === 'yaw.Vv') : null;
      ok(Math.abs(t.Sh - t.ivS * Math.cos(G) ** 2) < 1e-9 && Math.abs(t.Sv - t.ivS * Math.sin(G) ** 2) < 1e-9 && vh && vv,
         `F ${ang} deg: S ${t.ivS.toFixed(2)} m2, the design check's Vh ${vh ? vh.value : '-'} (${vh ? vh.level : '-'}) Vv ${vv ? vv.value : '-'} (${vv ? vv.level : '-'}) on its projections`);
    }
  }
  console.log('G. OLD SAVES');
  { const cs = s => { const x = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); Object.assign(x.gear, s); return C.clampSpec(x).gear || x.gear; };
    const sw = cs({ twSwivel: true });
    ok(sw.twMode === 'lock' && !('twSwivel' in sw), `G a spec's twSwivel: true clamps to twMode 'lock' (${sw.twMode})`);
    ok(cs({}).twMode === undefined && C.buildGen(C.GEN_DEFAULT).params.twMode === undefined, 'G no key: the steerable wheel (params.twMode absent = law 1)');
    const J = require(path.join(T, '_load_build.js'));
    const modeOf = v => J.loadBuild('builds/cub_2026-09-20_corrected.json', { patch: j => { const sp = j.spec || j; sp.cage = Object.assign({}, sp.cage, { s2Steer: v }); return j; } }).spec.gear.twMode;
    const m0 = modeOf(0), m1 = modeOf(1), m2 = modeOf(2);
    ok(m0 === undefined && m1 === undefined && m2 === 'lock', `G the Cub saved with s2Steer 0 / 1 / 2 loads as ${m0 || 'steerable'} / ${m1 || 'steerable'} / ${m2}`); }

  console.log('I. THE V FROM THE BOOMS, THE OTHER THREE WAYS');
  for (const [k, nm, down] of [['ivOut', 'down & out', true], ['bvIn', 'up & in', false], ['bvOut', 'up & out', false]]) {
    const st = g(k, 'stand'), p = g(k, 'pivot'), c = g(k, 'circuit');
    ok(st.iv >= 20 && st.tailContacts === 2 && st.tailClear && st.tailClear.every(v => v < 0.03) && st.deckDeg > 0,
       `I ${nm}: stands on its two ${down ? 'tip wheels' : 'boom tailwheels'} (clear ${JSON.stringify(st.tailClear)} m), deck ${st.deckDeg} deg tail-down`);
    ok(p.t180 != null && p.withinSpans <= 2 && !p.crashed, `I ${nm}: turns 180 deg on the brake in ${p.t180} s within ${p.withinSpans} spans`);
    ok(/LIFTOFF/.test(c.phases || '') && /STOPPED/.test(c.phases || '') && !c.crashed && c.touchdowns && c.touchdowns.length
       && c.touchdowns[0].sink < 3 && c.rolloutHdgMaxDeg < 20,
       `I ${nm}: takes off, flies HOME's circuit and lands (${c.touchdowns && c.touchdowns[0] ? c.touchdowns[0].sink : '-'} m/s), the roll-out ${c.rolloutHdgMaxDeg} deg (< 20)`);
  }
  { const mk = (iv, dir) => { const s = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); s.tail.type = 'twinBoom'; s.tail.boomX = 1.2; s.tail.boomLen = 3.5;
                              s.fuselage.boom = 'twin'; s.tail.ivAngle = iv; s.tail.ivDir = dir; return s; };
    const au = d => { const sim = C.makeSim(d, null); sim.reset(0); const V = d.params.ap.VCruise;
      const at = (de, dr) => { sim.ctl.de = de; sim.ctl.dr = dr; return sim.probe([-V, 0, 0]); };
      const b0 = at(0, 0), r = at(0, 0.2), e = at(0.2, 0);
      return { Ydr: (r.yawLeft - b0.yawLeft) / 0.2, Pde: (e.pitchUp - b0.pitchUp) / 0.2, Pdr: (r.pitchUp - b0.pitchUp) / 0.2 }; };
    for (const dir of ['downOut', 'upIn', 'upOut']) for (const ang of [25, 40, 55]) {
      const d = C.buildGen(mk(ang, dir)), a = au(d);
      ok(d.spec.tail.ivDir === dir && a.Ydr > 0 && a.Pde > 0 && Math.abs(a.Pdr) < 0.04 * Math.abs(a.Pde),
         `I ${dir} ${ang} deg: dYaw/dr ${a.Ydr.toFixed(0)}, dPitch/de ${a.Pde.toFixed(0)} (the conventional's signs), x-talk ${(100 * Math.abs(a.Pdr / a.Pde)).toFixed(1)} % (< 4)`);
    }
    const cs = t => C.clampSpec(Object.assign(mk(35, undefined), { tail: Object.assign(mk(35).tail, t) })).tail;
    const a1 = cs({ ivDir: 'sideways' }), a2 = cs({ ivDir: 'upIn', ivReach: 0.9 }), a3 = cs({ ivDir: 'downOut', ivReach: 5 });
    ok(!('ivDir' in a1) && a2.ivDir === 'upIn' && !('ivReach' in a2) && a3.ivDir === 'downOut' && a3.ivReach === 2.0,
       `I the clamp: an unknown way drops (${a1.ivDir}), an inward V keeps no reach (${a2.ivReach}), an outward one's 5 m reads ${a3.ivReach}`); }

  console.log('J. THE PUSHER WITH THE A (the chooser\'s path)');
  { const NL = require(path.join(T, '_newplane_lib.js')); NL.init();
    const SHj = require(path.join(T, '_scene_headless.js')), THj = SHj.context().THREE;
    const base = { class: 'lsa', gear: 'tail', engArch: 'pusher', engType: 'flat', wing: 'low', planform: 'taper', booms: 'twin' };
    const discClear = spec => {
      const S = SHj.sceneBuild(spec, {}); S.scene.updateMatrixWorld(true);
      const pr = [], tl = []; S.scene.traverse(o => { if (!o.isMesh) return; let a1 = false, a2 = false;
        for (let a = o; a; a = a.parent) { const n = a.name || ''; if (/^edProp/.test(n)) a1 = true; if (/^(edStabSkin|edSurf_elev)/.test(n)) a2 = true; }
        if (a1) pr.push(o); else if (a2) tl.push(o); });
      const pts = os => { const q = []; for (const o of os) { const pa = o.geometry.getAttribute('position'); for (let i = 0; i < pa.count; i++) q.push(new THj.Vector3(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(o.matrixWorld)); } return q; };
      const P = pts(pr), TP = pts(tl); if (!P.length || !TP.length) return null;
      const cx = P.reduce((s, p) => s + p.x, 0) / P.length, cy = P.reduce((s, p) => s + p.y, 0) / P.length;
      const z0 = Math.min(...P.map(p => p.z)), z1 = Math.max(...P.map(p => p.z)), R = Math.max(...P.map(p => Math.hypot(p.x - cx, p.y - cy)));
      let best = Infinity; for (const p of TP) { const dz = p.z < z0 ? z0 - p.z : p.z > z1 ? p.z - z1 : 0; best = Math.min(best, Math.hypot(dz, Math.max(0, Math.hypot(p.x - cx, p.y - cy) - R))); }
      return best; };
    const known = f => /^join: prop: through the (wing|body)/.test(f) || /^stance: three-point deck [0-6]\.\d+ deg \(7-17\)/.test(f);
    for (const [tail, nm] of [['bvIn', 'the A'], ['iv', 'the inverted V']]) {
      const r = NL.judge(Object.assign({}, base, { tail }), { keepSpec: true });
      const d = r.spec ? C.buildGen(JSON.parse(JSON.stringify(r.spec))) : null, dc = d ? C.genDesignCheck(d) : null, rows = dc ? (dc.rows || dc) : [];
      const lv = rows.find(q => q.id === 'yaw.Vv'), lh = rows.find(q => q.id === 'pitch.Vh');
      const clr = r.spec ? discClear(r.spec) : null, other = r.fails.filter(f => !known(f));
      const t = d && d.spec.tail;
      ok(!other.length && clr > 0.5 && lv && lv.level === 'pass' && lh && lh.level === 'pass' && t && Math.abs(t.lv - t.lh) < 1e-9
         && (tail !== 'iv' || (r.m.deck >= 7 && r.m.deck <= 17)),
         `J ${nm} on the chooser's twin-boom pusher taildragger: the disc clears the tail by ${clr == null ? '-' : clr.toFixed(2)} m, Vv ${lv ? lv.value : '-'} Vh ${lh ? lh.value : '-'}, the deck ${r.m.deck} deg` +
         `${other.length ? ' - ' + other.join(' | ') : ''} (named, not counted: ${r.fails.filter(known).join(' | ') || 'none'})`);
    }
  }

  console.log('H. THE INVERTED V\'S HARDWARE');
  { const SH = require(path.join(T, '_scene_headless.js')), PH = require(path.join(T, '_pose_headless.js'));
    const W = SH.context().ctx, THREE = SH.context().THREE;
    for (const dirI of [0, 1, 2, 3])
    for (const f of ['fixtures/test_copies/build_v8_twin-boom_2026-09-11.json', 'fixtures/test_copies/Twin_busher_floats_2.json',
                     'fixtures/test_copies/build_v10_engcfg_pushpull_2026-10-22.json']) {
      const IVT = { stMount: 4, stIvDir: dirI, stCant: 35, stX: 0, stY: 0, stZ: 0, stIvGap: 0.30, finOn: 0 };   // the Empennage tiles' write
      const fx = SH.loadFixture(path.join(T, f)), S = SH.sceneBuild(fx.spec || fx, { over: IVT });
      S.scene.updateMatrixWorld(true);
      const obj = {}; S.scene.traverse(o => { if (o.name) obj[o.name] = obj[o.name] || o; });
      const box = n => obj[n] ? new THREE.Box3().setFromObject(obj[n]) : null;
      const H = PH.surfHinges(S, PH.collect(S, THREE, {}));
      const rows = ['R', 'L'].map(sd => {
        const lk = (W.CAGE_HINGE.links || []).find(L => L.key === 'elev' + sd), len = lk ? Math.hypot(...[0, 1, 2].map(k => lk.pin[k] - lk.tip[k])) : null;
        const pan = box('edStabSkin' + sd); if (pan && box('edSurf_elev' + sd)) pan.union(box('edSurf_elev' + sd));
        const hw = [box('edHinge_elev' + sd + '_metal'), box('edHinge_edStabSkin' + sd + '_metal')].filter(Boolean);
        const on = !!pan && hw.length === 2 && hw.every(b => pan.clone().expandByScalar(0.05).containsBox(b));
        // the drawn ruddervator on a nose-left pedal (dr > 0): its trailing edge (the aft-most vertex) swings to PORT
        // (+x, the cage's port) - the same turn the flown model applies (sgn2 * k2 * dr about the join's hinge)
        const h = H['elev' + sd], sv = obj['edSurf_elev' + sd];
        let te = null; if (sv) { sv.updateMatrixWorld(true); sv.traverse(o => { if (!o.isMesh) return; const pa = o.geometry.getAttribute('position');
          for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(o.matrixWorld); if (!te || v.z < te[2]) te = [v.x, v.y, v.z]; } }); }
        let port = null;
        if (h && te && h.drive2 === 'dr') { const a = h.sgn2 * 0.1, ax = h.axis, v = [0, 1, 2].map(k => te[k] - h.pivot[k]);
          const c = Math.cos(a), s = Math.sin(a), dt = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2];
          const x1 = h.pivot[0] + v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * dt * (1 - c);
          port = x1 - te[0]; }
        return { sd, len, on, from: h && h.hingeFrom, port };
      });
      ok(W.CAGE_STAB.mount === 4 && rows.every(r => r.len != null && r.len < 0.3 && r.on && r.from === 'declared' && r.port > 0),
         `H ${['down & in', 'down & out', 'up & in', 'up & out'][dirI]} ${path.basename(f, '.json')}: the links ${rows.map(r => r.len == null ? '-' : r.len.toFixed(2)).join(' / ')} m (< 0.3), the straps on their panels ${rows.map(r => r.on).join(' / ')}, the hinge ${rows.map(r => r.from).join(' / ')}, the TE to port on dr > 0 ${rows.map(r => r.port == null ? '-' : (1000 * r.port).toFixed(0) + ' mm').join(' / ')}`);
    }
  }

  // K. LAZAIR (24 Nov, the user: "an inverted V tail with a little wheel at each panel tip, on a single boom ... the
  // controls accurate whatever the angle ... the tip wheels an option with their own parameters")
  console.log('K. THE V HUNG DOWN ON A SINGLE BOOM (LAZAIR)');
  { const SH = require(path.join(T, '_scene_headless.js')), LB = require(path.join(T, '_load_build.js'));
    const CHN = 'builds/chinook_2026-09-21_corrected.json', C172 = 'builds/cessna172r_2026-11-08.json';
    // the V-tail tile's writes, the cant below 0 - at -30 on panels of half the drawn span the tips stand just over the
    // mains' ground line (tw_probe's 'lazair'): a stance an aeroplane can have
    const VW = { stCant: -30, stSpan: 0.5, stMount: 1, stX: 0, stY: 0, stZ: 0, finOn: 0 };
    // K1 THE DRAWING (the Chinook's single rod): the panels hang from under the rod, mirrored; a wheel contact under each tip
    // (the tail unit's, as the tail wheel), below the boom; the fin stood down; the flown V's area the drawn panels'
    const fx = SH.loadFixture(path.join(T, '..', CHN));
    const S = SH.sceneBuild(fx.spec || fx, { over: Object.assign({ vtWheels: 1 }, VW) }), W = S.W, THREE = SH.context().THREE;
    S.scene.updateMatrixWorld(true);
    const obj = {}; let finN = 0; S.scene.traverse(o => { if (o.name) obj[o.name] = obj[o.name] || o; if (o.name === 'cageLayer:fin') finN++; });
    const box = n => obj[n] ? new THREE.Box3().setFromObject(obj[n]) : null;
    const bR = box('edStabSkinR'), bL = box('edStabSkinL'), SB = W.CAGE_STAB, GW = W.CAGE_GEAR;
    const tips = GW && GW.vtTips, cs = (GW && GW.contacts || []).filter(c => c.st && c.st.id === 2);
    const mir = !!(bR && bL) && Math.abs(bR.min.x + bL.max.x) < 1e-3 && Math.abs(bR.max.x + bL.min.x) < 1e-3
      && Math.abs(bR.min.y - bL.min.y) < 1e-3 && Math.abs(bR.max.y - bL.max.y) < 1e-3 && Math.abs(bR.min.z - bL.min.z) < 1e-3;
    const rootY = bR && bL ? Math.max(bR.max.y, bL.max.y) : null;
    const under = !!tips && tips.length === 2 && cs.length === 2 && cs.every(c => { const q = tips.find(p => Math.sign(p[0]) === Math.sign(c.p[0]));
      return q && Math.abs(c.p[0] - q[0]) < 1e-3 && Math.abs(c.p[2] - q[2]) < 1e-3 && c.p[1] < q[1] - c.R && c.p[1] + c.R < rootY - 0.1; });
    ok(SB && SB.cant === -30 && mir && under && tips[0][1] < rootY - 0.2 && finN === 0 && GW.vtMode === 'tail',
       `K1 the drawn V at ${SB && SB.cant} deg: the panels mirrored ${mir}, the tips ${tips ? tips.map(q => q.map(v => v.toFixed(3)).join(',')).join(' / ') : '-'} under the root (${rootY == null ? '-' : rootY.toFixed(3)}), a wheel contact under each ${under} (${cs.map(c => c.p.map(v => v.toFixed(3)).join(',')).join(' / ')}), the fin layer ${finN ? 'drawn' : 'stood down'}`);
    const L1 = LB.loadBuild(CHN, { patch: j => { const sp = j.spec || j; sp.cage = Object.assign({}, sp.cage, VW, { vtWheels: 1 }); return j; } }), s1 = L1.spec;
    ok(s1.tail.type === 'v' && s1.tail.vAngle === -30 && SB && SB.measure && Math.abs(s1.tail.Svt - 2 * SB.measure.areaTail) < 1e-9 && !(L1.errors || []).length,
       `K1 the join: tail.type ${s1.tail.type}, vAngle ${s1.tail.vAngle}, Svt ${s1.tail.Svt && s1.tail.Svt.toFixed(4)} m2 = the drawn panels' ${SB && SB.measure ? (2 * SB.measure.areaTail).toFixed(4) : '-'} m2 ${(L1.errors || []).join(' | ')}`);
    // K1b the drawn ruddervators on a nose-left pedal: both trailing edges swing to PORT (the join's sgn2 by the hinge's lean)
    { const PH = require(path.join(T, '_pose_headless.js')), H = PH.surfHinges(S, PH.collect(S, THREE, {}));
      const port = ['R', 'L'].map(sd => { const h = H['elev' + sd], sv = obj['edSurf_elev' + sd]; let te = null;
        if (sv) sv.traverse(o => { if (!o.isMesh) return; const pa = o.geometry.getAttribute('position');
          for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3(pa.getX(i), pa.getY(i), pa.getZ(i)).applyMatrix4(o.matrixWorld); if (!te || v.z < te[2]) te = [v.x, v.y, v.z]; } });
        if (!(h && te && h.drive2 === 'dr')) return null;
        const a = h.sgn2 * 0.1, ax = h.axis, v = [0, 1, 2].map(k => te[k] - h.pivot[k]), c = Math.cos(a), s = Math.sin(a), dt = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2];
        return h.pivot[0] + v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * dt * (1 - c) - te[0]; });
      ok(port.every(p => p != null && p > 0), `K1 the drawn ruddervators' trailing edges to port on dr > 0: ${port.map(p => p == null ? '-' : (1000 * p).toFixed(0) + ' mm').join(' / ')}`); }
    // K2 THE CONTROLS AT ANY ANGLE (the generator's default made a V, up and down, the probe at cruise): the elevator's
    // up pitches nose-up, the rudder's left yaws nose-left; the tail's own sideslip roll couple flips with the V (a V hung
    // down rolls the other way - real); nothing at zero input in symmetric flight
    const au = (d, tailOnly) => {
      if (tailOnly) d = Object.assign({}, d, { strips: d.strips.filter(q => q.kind === 'vtail') });
      const sim = C.makeSim(d, null); sim.reset(0); const V = d.params.ap.VCruise;
      const at = (de, dr, vz) => { sim.ctl.de = de; sim.ctl.dr = dr; return sim.probe([-V, 0, vz || 0]); };
      const b0 = at(0, 0), r = at(0, 0.2), e = at(0.2, 0), sb = at(0, 0, 0.05 * V);
      return { Ydr: (r.yawLeft - b0.yawLeft) / 0.2, Pde: (e.pitchUp - b0.pitchUp) / 0.2, Pdr: (r.pitchUp - b0.pitchUp) / 0.2,
               Rb: sb.rollLeft - b0.rollLeft, y0: b0.yawLeft, r0: b0.rollLeft }; };
    const vOf = a => { const s = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); s.tail.type = 'v'; s.tail.vAngle = a; return C.buildGen(s); };
    for (const ang of [30, 55]) {
      const dU = vOf(ang), dD = vOf(-ang), U = au(dU), Dn = au(dD), Ut = au(dU, true), Dt = au(dD, true);
      for (const [nm, x, d] of [['+' + ang, U, dU], ['-' + ang, Dn, dD]])
        ok(d.spec.tail.type === 'v' && x.Pde > 0 && x.Ydr > 0 && Math.abs(x.Pdr) < 0.02 * x.Pde && Math.abs(x.y0) < 1e-3 * x.Ydr && Math.abs(x.r0) < 1e-3 * x.Ydr,
           `K2 the V at ${nm} deg: dPitchUp/de ${x.Pde.toFixed(0)} (> 0), dYawLeft/dr ${x.Ydr.toFixed(0)} (> 0), the rudder's pitch ${(100 * Math.abs(x.Pdr / x.Pde)).toFixed(1)} % (< 2), at zero input yaw ${x.y0.toExponential(1)} roll ${x.r0.toExponential(1)}`);
      ok(Math.sign(Ut.Rb) === -Math.sign(Dt.Rb) && Ut.Rb !== 0,
         `K2 the tail's sideslip roll couple at ${ang} deg: up ${Ut.Rb.toFixed(1)}, hung down ${Dt.Rb.toFixed(1)} N m (opposite signs)`);
    }
    // K3 THE TIP WHEELS' THREE MODES (the game's load path, the drawn and the flown together)
    const ld = (file, cage) => LB.loadBuild(file, { patch: j => { const sp = j.spec || j; sp.cage = Object.assign({}, sp.cage, cage); return j; } });
    const nodeP = (d, i) => d.nodes[i].p;
    const tw0 = C.buildGen(JSON.parse(JSON.stringify(ld(CHN, Object.assign({ vtWheels: 0 }, VW)).spec)));
    ok(!tw0.spec.gear.vTip && !(tw0.refs.tw2 >= 0) && !tw0.refs.xw && Math.abs(nodeP(tw0, tw0.refs.tw)[2]) < 1e-9,
       `K3 off: no tip contact - the Chinook's one tailwheel on the centreline (z ${nodeP(tw0, tw0.refs.tw)[2].toFixed(3)}), no vTip, no tw2, no extra wheels`);
    const d1 = C.buildGen(JSON.parse(JSON.stringify(s1))), tpp = s1.gear.vTip;
    const isTW = i => i != null && i >= 0 && d1.nodes[i].tag === 'TW', twN = d1.nodes.filter(n => n.tag === 'TW').length;
    ok(!!tpp && tpp.mode === 'tail' && twN === 2 && isTW(d1.refs.tw) && isTW(d1.refs.tw2) && !d1.refs.xw && cs.length === 2
       && Math.abs(Math.abs(nodeP(d1, d1.refs.tw)[2]) - Math.abs(cs[0].p[0])) < 2e-3 && Math.abs(nodeP(d1, d1.refs.tw)[2] + nodeP(d1, d1.refs.tw2)[2]) < 1e-9,
       `K3 as the tail wheel: the tail contacts are the two tips (z ${isTW(d1.refs.tw) ? nodeP(d1, d1.refs.tw)[2].toFixed(3) : '-'} / ${isTW(d1.refs.tw2) ? nodeP(d1, d1.refs.tw2)[2].toFixed(3) : '-'}, drawn x ${cs.map(c => c.p[0].toFixed(3)).join(' / ')}), ${twN} tail nodes, no other`);
    { const sim = C.makeSim(d1, null); sim.reset(0); for (let f = 0; f < 600; f++) sim.step(1 / 60);
      const clr = i => sim.p[i * 3 + 1] - sim.r[i], wh = [...d1.refs.mains, d1.refs.tw, d1.refs.tw2], all = wh.map(clr);
      // ...and on nothing else: no other node within 3 cm of the ground (the tail whole, not folded onto its boom)
      const other = d1.nodes.map((n, i) => i).filter(i => !wh.includes(i) && clr(i) < 0.03);
      ok(all.every(v => Math.abs(v) < 0.03) && !other.length && !(sim.damage && sim.damage().crashed),
         `K3 as the tail wheel: it stands on its mains and both tip wheels, clear ${all.map(v => v.toFixed(3)).join(' / ')} m (< 0.03), nothing else down (${other.map(i => d1.nodes[i].tag).join(',') || 'none'})`); }
    const c0 = C.buildGen(JSON.parse(JSON.stringify(ld(C172, Object.assign({ vtWheels: 0 }, VW)).spec)));
    const L2 = ld(C172, Object.assign({ vtWheels: 2 }, VW)), c2 = C.buildGen(JSON.parse(JSON.stringify(L2.spec)));
    const same = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-9);
    ok(c2.spec.gear.type === 'tricycle' && !!c2.refs.xw && c2.refs.xw.length === 2 && !(c2.refs.tw2 >= 0) && c2.refs.xwFree === 1
       && same(nodeP(c2, c2.refs.tw), nodeP(c0, c0.refs.tw)) && c2.refs.mains.every((m, k) => same(nodeP(c2, m), nodeP(c0, c0.refs.mains[k])))
       && c2.refs.xw.every(i => nodeP(c2, i)[0] > nodeP(c2, c2.refs.mains[0])[0] + 2),
       `K3 extra wheels on the Cessna's tricycle: two more contacts at the tips (${c2.refs.xw ? c2.refs.xw.map(i => nodeP(c2, i).map(v => v.toFixed(2)).join(',')).join(' / ') : '-'}), castoring, the nose wheel and the mains where they were`);
    // K4 THE ROWS MOVE THE DRAWN WHEEL AND THE CONTACT TOGETHER: a 0.30 m wheel on a 0.10 m fork (+0.05 m radius, +0.07 m fork)
    const SZ = { vtWheels: 1, vtD: 0.30, vtFork: 0.10 };
    const S4 = SH.sceneBuild(fx.spec || fx, { over: Object.assign({}, VW, SZ) }), cs4 = (S4.W.CAGE_GEAR.contacts || []).filter(c => c.st && c.st.id === 2);
    const L4 = ld(CHN, Object.assign({}, VW, SZ)), d4 = C.buildGen(JSON.parse(JSON.stringify(L4.spec)));
    const c1 = cs4.length && cs.find(c => Math.sign(c.p[0]) === Math.sign(cs4[0].p[0]));
    const dyDrawn = c1 ? cs4[0].p[1] - c1.p[1] : null;
    const dyFlown = nodeP(d4, d4.refs.tw)[1] - nodeP(d1, d1.refs.tw)[1];
    ok(cs4.length === 2 && cs4.every(c => Math.abs(c.R - 0.15) < 1e-9) && d4.nodes[d4.refs.tw].r === 0.15 && d4.spec.gear.vTip.fork === 0.1
       && dyDrawn != null && Math.abs(dyDrawn - (-0.05 - 0.07)) < 2e-3 && Math.abs(dyFlown - dyDrawn) < 2e-3,
       `K4 vtD 0.30 / vtFork 0.10: the drawn wheel R ${cs4.map(c => c.R).join(' / ')}, its hub ${dyDrawn == null ? '-' : (1000 * dyDrawn).toFixed(0)} mm, the flown contact R ${d4.nodes[d4.refs.tw].r}, ${(1000 * dyFlown).toFixed(0)} mm (-120 each)`);
  }
  { const st = g('lazair', 'stand'), p = g('lazair', 'pivot'), c = g('lazair', 'circuit');
    ok(st.vAngle === -30 && st.tailContacts === 2 && st.tailClear && st.tailClear.every(v => v < 0.03) && st.deckDeg > 0,
       `K5 the Chinook as a Lazair: it stands on its two tip wheels (the V at ${st.vAngle} deg, clear ${JSON.stringify(st.tailClear)} m), deck ${st.deckDeg} deg tail-down`);
    ok(p.t180 != null && p.withinSpans <= 2 && !p.crashed, `K5 it turns 180 deg on the brake in ${p.t180} s within ${p.withinSpans} spans`);
    ok(/LIFTOFF/.test(c.phases || '') && /STOPPED/.test(c.phases || '') && !c.crashed && c.touchdowns && c.touchdowns.length
       && c.touchdowns[0].sink < 3 && c.rolloutHdgMaxDeg < 20,
       `K5 it takes off, flies HOME's circuit and lands (${c.touchdowns && c.touchdowns[0] ? c.touchdowns[0].sink : '-'} m/s), the roll-out ${c.rolloutHdgMaxDeg} deg (< 20)`); }

  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log('GATE TAILWHEEL: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})();
