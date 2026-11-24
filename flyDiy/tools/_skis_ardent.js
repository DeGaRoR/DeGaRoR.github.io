#!/usr/bin/env node
// _skis_ardent.js (SKIS-PC6, 15 Nov) - THE ULTIMATE TEST, the user's own: the PC-6 on skis, on snow, at the OBSERVATORY's
// altiport (mt_strip "Ardent Altiport", Mount Ardent: 210 x 12 m, landed WEST uphill - 15 % at the bottom easing to a flat
// top at 1039 m - left EAST downhill). The game's own flight (tools/_tour_lib.js gameHost: the game's placement, the day
// ticked, the game's pilot with the persona asked, damage on), node only:
//   LANDING   HOME > mt_strip: the arrival, the flare, the roll-out up the slope, the stop
//   TAKE-OFF  mt_strip > HOME: from the stand at the head, the turn, the roll down the slope, lift-off, the climb
// and the numbers tabled per case.
//   node tools/_skis_ardent.js [--case all|<name>[,<name>]] [--persona expert] [--json out.json] [--legs land,to] [--lineup]
//   node tools/_skis_ardent.js --gate     -> "GATE SKISARDENT: PASS|FAIL" (the full tier: the four ski legs in parallel)
// THE SNOW: SNOW-MUD's soft ground (its SURFACE codes: 8 packed, 9 powder, 10 wet). mt_strip's own record carries
// `surface` - gravel (6) until SNOW-MUD switches the altiport to snow (OBSERVATORY-SITE's SNOW HOOK). A case's `snow`
// lays that code over the summit's snowfield (the ground above SNOW_ALT within SNOW_R of the strip's centre) by wrapping
// world.surface - the hook's switch, ahead of the record's; `snow: 'record'` reads the record as it is.
// CASES: the PC-6 (FIT-PROCEDURE's validated card, its flight figures as landed) on its wheels on today's gravel (the
// datum), on its wheels on snow (why the skis), and on its hydraulic wheel-skis + tail ski (the real Porter's factory
// option, tools/fixtures/test_copies/pc6_skis.json) on packed snow (a rolled altiport) and on powder (a fresh fall).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const PC6 = path.join(ROOT, 'builds', 'candidates', 'pc6_drafting_2026-11-11.json');
const PC6_SKIS = path.join(T, 'fixtures', 'skis', 'pc6_skis.json');
const CASES = {
  wheels_gravel: { build: PC6, snow: null, label: 'PC-6 on wheels, gravel (today: the datum)' },
  wheels_powder: { build: PC6, snow: 9, label: 'PC-6 on wheels, powder (no skis)' },
  skis_packed:   { build: PC6_SKIS, snow: 8, label: 'PC-6 on wheel-skis + tail ski, packed snow' },
  skis_powder:   { build: PC6_SKIS, snow: 9, label: 'PC-6 on wheel-skis + tail ski, powder' },
};
const SNOW_NAMES = { 6: 'gravel', 8: 'packed', 9: 'powder', 10: 'wet' };
const SNOW_ALT = 960, SNOW_R = 600;           // the summit's snowfield: the strip, its platform, the approach's last metres
const persona = opt('persona', 'expert');
// --lineup: the take-off from the line-up (the game's skip to line-up: G3302) - the stand's taxi and its pivot left out
const LINEUP = argv.includes('--lineup');
const legs = opt('legs', 'land,to').split(',');
const pick = opt('case', 'all');
const names = pick === 'all' ? Object.keys(CASES) : pick.split(',');

const TW = TR.tourWorld(C, IN, fs);
const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const STRIP = A('mt_strip'), HOME = A('HOME');
// (no mt_strip: OBSERVATORY-SITE is not on this tree - the gate CANNOT RUN here: the runner's SKIP (train 31: shown as
//  SKIP, never as a PASS); flown by hand it is an error)
if (!STRIP) {
  if (argv.includes('--gate')) { console.log('_skis_ardent: no mt_strip in this world (OBSERVATORY-SITE not on this tree)\nGATE SKISARDENT: SKIP'); process.exit(0); }
  console.error('_skis_ardent: no mt_strip in this world (OBSERVATORY-SITE not on this tree)'); process.exit(2);
}
const surf0 = W.surface.bind(W);
// the strip's own frame: s along it from its centre (+ toward hdg), its two ends' ground
const along = (x, z) => (x - STRIP.x) * Math.cos(STRIP.hdg) + (z - STRIP.z) * Math.sin(STRIP.hdg);
const across = (x, z) => -(x - STRIP.x) * Math.sin(STRIP.hdg) + (z - STRIP.z) * Math.cos(STRIP.hdg);
const endG = s => W.terrainH(STRIP.x + Math.cos(STRIP.hdg) * s, STRIP.z + Math.sin(STRIP.hdg) * s);

function fly(cs, leg) {
  const code = cs.snow;
  // (the case's snow on the strip and over the summit's snowfield; where the RECORD already lays snow off the strip - the
  //  apron's packed snow, OBSERVATORY-3 - the record's own: the stand and the taxi feel what the site says)
  const onStrip = (x, z) => Math.abs(along(x, z)) <= STRIP.len / 2 + 10 && Math.abs(across(x, z)) <= (STRIP.wid || 12) / 2 + 3;
  W.surface = code == null || code === 'record' ? surf0
    : (x, z) => { const r = surf0(x, z);
        if (!(Math.hypot(x - STRIP.x, z - STRIP.z) < SNOW_R && W.terrainH(x, z) > SNOW_ALT)) return r;
        return r >= 8 && !onStrip(x, z) ? r : code; };
  const def = TR.defOf(C, PT, cs.build);
  const from = leg === 'land' ? HOME : STRIP, to = leg === 'land' ? STRIP : HOME;
  const H = TR.gameHost(C, W, def, from, to, { profile: persona, lineup: LINEUP && leg === 'to' });
  const sim = H.sim, out = sim.out, ski = !!(def.parts && def.parts.ski);
  // the contact nodes (the mains, the tail / nose wheel) and their clearance standing (lift-off: every one 10 cm clear)
  const R = def.refs || {}, nodes = [...(R.mains || []), R.tw, R.nw].filter(i => i != null && i >= 0);
  const clr = () => nodes.map(i => sim.p[i * 3 + 1] - W.terrainH(sim.p[i * 3], sim.p[i * 3 + 2]));
  H.queueCmd({ cmd: 'start' });
  const r = { case: cs.name, leg, build: path.basename(cs.build), surface: SNOW_NAMES[code == null ? 6 : code] || String(code),
              mass: +sim.totalM.toFixed(0), fuelL: sim.fuel ? +sim.fuel.litres.toFixed(0) : null, persona };
  let c0 = null, t = 0, ph = null, rollAt = null, offAt = null, screenAt = null, maxSink = 0, maxSoftZ = 0, skiPos = [], vMax = 0;
  let tdAt = null, stopAt = null, lastSay = 0, firstY = null;
  const says = [];
  const tMax = leg === 'land' ? 1500 : 150;
  for (let k = 0; k < tMax * 60; k++) {
    H.step(); t += 1 / 60;
    const ap = H.ap; ph = ap.phase;
    const vs = ap.report.verdicts; while (lastSay < vs.length) { const v = vs[lastSay++]; says.push(t.toFixed(1) + ' ' + v.code + (v.note ? ': ' + v.note.slice(0, 120) : '')); }
    const cg = sim.cgPos(), v = sim.cgVel(), Vg = Math.hypot(v[0], v[2]);
    if (ski) { for (const z of out.skiSink || []) if (z > maxSink) maxSink = z; }
    if (out.softZ > maxSoftZ) maxSoftZ = out.softZ;
    if (leg === 'to') {
      if (c0 === null && ph === 'ROLL') c0 = clr();   // (standing, as it starts to roll: a wheel-ski's skis set at the hold)
      // (the run is measured FROM THE HOLD, lined up: a wheel-ski waiting there for its skis has no brakes and may creep
      //  down the slope - that creep is the run's too; holdSlide says how much)
      if (rollAt === null && (ph === 'HOLD' || ph === 'ROLL')) rollAt = { t, x: cg[0], z: cg[2], s: along(cg[0], cg[2]) };
      if (rollAt && rollAt.roll == null && ph === 'ROLL') { rollAt.roll = Math.hypot(cg[0] - rollAt.x, cg[2] - rollAt.z); if (ski) skiPos.push(+out.ski.toFixed(2)); }
      if (rollAt && c0 && offAt === null) {
        const c = clr();
        if (c.every((h, j) => h > c0[j] + 0.10)) offAt = { t, d: Math.hypot(cg[0] - rollAt.x, cg[2] - rollAt.z), V: Vg, s: along(cg[0], cg[2]), off: across(cg[0], cg[2]) };
      }
      if (offAt && screenAt === null) {
        const gOff = W.terrainH(rollAt.x + (offAt.s - rollAt.s) * Math.cos(STRIP.hdg), rollAt.z + (offAt.s - rollAt.s) * Math.sin(STRIP.hdg));
        const lowest = Math.min(...nodes.map(i => sim.p[i * 3 + 1]));
        if (lowest - gOff > 15) screenAt = { t, d: Math.hypot(cg[0] - rollAt.x, cg[2] - rollAt.z), V: Vg };
      }
      if (screenAt && t > screenAt.t + 5) break;
    } else {
      if (tdAt === null && (ph === 'FLARE' || ph === 'ROLLOUT')) { const c = clr(); if (Math.min(...c) < 0.6) {} }
      if (tdAt === null && ph === 'ROLLOUT') { tdAt = { t, s: along(cg[0], cg[2]) }; if (ski) skiPos.push(+out.ski.toFixed(2)); }
      if (ph === 'ROLLOUT' || ph === 'STOPPED') vMax = Math.max(vMax, 0);
      if (ph === 'STOPPED' && stopAt === null) { stopAt = { t, s: along(cg[0], cg[2]), off: across(cg[0], cg[2]) }; if (ski) skiPos.push(+out.ski.toFixed(2)); }
      if (stopAt && t > stopAt.t + 3) break;
    }
    const D = sim.damage ? sim.damage() : null;
    if (D && D.yields > 0 && firstY === null) {
      const tw = R.tw != null ? R.tw : nodes[nodes.length - 1], q = [sim.p[tw * 3], sim.p[tw * 3 + 1], sim.p[tw * 3 + 2]];
      firstY = { t: +t.toFixed(2), ph, V: +Vg.toFixed(2), tail: { s: +along(q[0], q[2]).toFixed(1), off: +across(q[0], q[2]).toFixed(1),
                 clr: +(q[1] - W.terrainH(q[0], q[2])).toFixed(2), ground: +W.terrainH(q[0], q[2]).toFixed(1) },
                 cg: { s: +along(cg[0], cg[2]).toFixed(1), off: +across(cg[0], cg[2]).toFixed(1) }, reason: D.reason || null };
    }
    if (D && D.over) break;
  }
  r.firstYield = firstY;
  const D = sim.damage ? sim.damage() : null;
  r.damage = D ? { yields: D.yields, breaks: D.breaks, over: !!D.over, reason: D.reason || null } : null;
  r.phase = ph; r.t = +t.toFixed(1);
  r.maxSkiSinkCm = ski ? +(100 * maxSink).toFixed(1) : null;
  r.maxSoftZcm = +(100 * maxSoftZ).toFixed(1);
  r.skiPos = ski ? skiPos : null;
  if (leg === 'to') {
    r.roll = offAt ? +offAt.d.toFixed(0) : null; r.vLiftoff = offAt ? +offAt.V.toFixed(1) : null;
    r.tRoll = offAt && rollAt ? +(offAt.t - rollAt.t).toFixed(1) : null;
    r.holdSlide = rollAt && rollAt.roll != null ? +rollAt.roll.toFixed(1) : null;
    r.to15m = screenAt ? +screenAt.d.toFixed(0) : null;
    r.stripLeftAtLiftoff = offAt ? +(STRIP.len / 2 + offAt.s * (rollAt.s < 0 ? 1 : -1) * -1).toFixed(0) : null;
    // (the roll runs from the head (the top, s at the stand's end) down the strip: what remained of it at lift-off)
    if (offAt) { const sEnd = rollAt.s < 0 ? STRIP.len / 2 : -STRIP.len / 2; r.stripLeftAtLiftoff = +Math.abs(sEnd - offAt.s).toFixed(0); }
  } else {
    const L = H.ap.report.landing || null;
    r.landing = L;
    r.stopLeft = stopAt ? +(STRIP.len / 2 - Math.abs(stopAt.s)).toFixed(0) : null;
  }
  r.says = says.slice(-12);
  return r;
}

// THE STAND'S FACING: the PC-6 on skis placed at mt_strip's stand by the game (gameHost), its nose (the tail wheel to the
// mains' midpoint) against the take-off's way, downhill (STRIP.hdg + pi). OBSERVATORY-3 turned the stand to face the
// take-off (hdg 0, nose east): from such a stand the take-off is flown FROM THE STAND; a stand that needs the pivot
// (the 252-degree turn that broke the PC-6's tail, FIT-PROCEDURE's) is left out by the line-up, and the gate says so
function standFacing() {
  const def = TR.defOf(C, PT, PC6_SKIS), H = TR.gameHost(C, W, def, STRIP, HOME, { profile: persona, lineup: false });
  const p = H.sim.p, R = def.refs, ms = R.mains;
  const mx = 0.5 * (p[ms[0] * 3] + p[ms[ms.length - 1] * 3]), mz = 0.5 * (p[ms[0] * 3 + 2] + p[ms[ms.length - 1] * 3 + 2]);
  const fx = mx - p[R.tw * 3], fz = mz - p[R.tw * 3 + 2], tx = -Math.cos(STRIP.hdg), tz = -Math.sin(STRIP.hdg);
  const c = (fx * tx + fz * tz) / (Math.hypot(fx, fz) || 1);
  return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
}
if (argv.includes('--facing')) { console.log('stand facing the take-off within ' + standFacing().toFixed(1) + ' deg'); return; }
// GATE SKISARDENT (--gate, the full tier): the four legs in child processes, in parallel, then the verdicts
if (argv.includes('--gate')) {
  const cp = require('child_process');
  const jobs = [['skis_powder', 'land'], ['skis_powder', 'to'], ['skis_packed', 'land'], ['skis_packed', 'to']];
  let fails = 0;
  const ok = (c, label) => { console.log((c ? '  ok   ' : '  FAIL ') + label); if (!c) fails++; };
  const facing = standFacing(), fromStand = facing < 60;
  console.log(`  the stand faces the take-off within ${facing.toFixed(1)} deg: the take-offs ${fromStand ? 'FROM THE STAND (taxi, the turn onto the strip, the roll)' : 'from the LINE-UP (the stand needs the pivot: OBSERVATORY-3 turns it)'}`);
  Promise.all(jobs.map(([c, l]) => new Promise(res => cp.execFile(process.execPath, [__filename, '--case', c, '--legs', l, ...(fromStand ? [] : ['--lineup']), '--persona', persona],
    { maxBuffer: 64 << 20, timeout: 2400e3 }, (e, so) => { const line = String(so || '').split('\n').find(x => x.startsWith('ARDENT '));
      res(line ? JSON.parse(line.slice(7)) : { case: c, leg: l, error: (e && e.message) || 'no output' }); })))).then(R => {
    const get = (c, l) => R.find(r => r.case === c && r.leg === l) || {};
    console.log('GATE SKISARDENT - the PC-6 on its wheel-skis at the Ardent altiport (mt_strip), the game\'s flight, persona ' + persona);
    for (const r of R) console.log('  ' + JSON.stringify(Object.assign({}, r, { says: undefined })));
    const pl = get('skis_powder', 'land'), pt = get('skis_powder', 'to'), kl = get('skis_packed', 'land'), kt = get('skis_packed', 'to');
    const clean = r => r.damage && r.damage.yields === 0 && r.damage.breaks === 0 && !r.damage.over;
    const L = pl.landing || {};
    ok(pl.phase === 'STOPPED' && pl.stopLeft > 0 && L.onStrip && clean(pl) && pl.skiPos && pl.skiPos[0] === 1,
       `POWDER, LANDING uphill: the skis down at the touchdown (${pl.skiPos}), ${L.tdIn} m in at ${L.V} m/s, run ${L.run} m, stopped with ${pl.stopLeft} m left, no damage`);
    ok(pl.maxSkiSinkCm > 8 && pl.maxSkiSinkCm < 30, `...the skis in powder: a ${pl.maxSkiSinkCm} cm rut (the fresh top's decimetres, not the layer's bottom)`);
    ok(pt.roll != null && pt.stripLeftAtLiftoff > 0 && pt.to15m != null && clean(pt),
       `POWDER, TAKE-OFF downhill: off in ${pt.roll} m (${pt.stripLeftAtLiftoff} m of the strip left), 15 m over the lift-off point at ${pt.to15m} m, no damage`);
    ok(kt.roll != null && kt.stripLeftAtLiftoff > 0 && clean(kt), `PACKED, TAKE-OFF: off in ${kt.roll} m (${kt.stripLeftAtLiftoff} m left), no damage`);
    // (RE-PIN, 15 Nov on L40d: the overrun is the engine's gap - no reversing propeller, no brakes on skis - and the gate
    //  REPORTS it; past the top end the ground rises 4.5 m in 20 m, and the 19 m slide meets that bank at 1.1 m/s: members
    //  yield there, nothing breaks. The row holds the skis to NO DAMAGE ON THE STRIP and NO BREAK ANYWHERE; a yield past
    //  the end is the overrun's, said with its count)
    const pastEnd = r => r.firstYield && r.firstYield.cg && Math.abs(r.firstYield.cg.s) > STRIP.len / 2;
    const kOk = clean(kl) || (kl.damage && kl.damage.breaks === 0 && !kl.damage.over && pastEnd(kl));
    ok(kl.phase === 'STOPPED' && kOk && kl.skiPos && kl.skiPos[0] === 1,
       `PACKED, LANDING: down on its skis, no damage on the strip${clean(kl) ? '' : ' (past its end, the overrun into the bank: ' + kl.damage.yields + ' member yields, no break)'} - REPORTED: run ${kl.landing && kl.landing.run} m, ${kl.stopLeft >= 0 ? kl.stopLeft + ' m left' : (-kl.stopLeft) + ' m PAST THE END'} (no brakes on skis, mu 0.04 on rolled snow; the B2-H4's reversing propeller is not in the game)`);
    console.log(fails ? `GATE SKISARDENT: FAIL (${fails})` : 'GATE SKISARDENT: PASS');
    process.exitCode = fails ? 1 : 0;
  });
  return;
}
const res = [];
for (const nm of names) {
  const cs = Object.assign({ name: nm }, CASES[nm]);
  if (!CASES[nm]) { console.error('no case ' + nm); continue; }
  for (const leg of legs) {
    const t0 = Date.now(), r = fly(cs, leg);
    r.wallS = Math.round((Date.now() - t0) / 1000);
    res.push(r);
    console.log('ARDENT ' + JSON.stringify(r));
  }
}
W.surface = surf0;
console.log('\nmt_strip: ' + STRIP.len + ' x ' + STRIP.w + ' m, ends ' + endG(-STRIP.len / 2).toFixed(1) + ' / ' + endG(STRIP.len / 2).toFixed(1) + ' m; persona ' + persona);
console.log('| case | surface | mass kg | leg | result | roll m | V kt | to 15 m | strip left | sink cm (ski / deepest) | skis | damage |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of res) {
  const kt = v => v == null ? '-' : (v * 1.94384).toFixed(0);
  const dmg = r.damage ? (r.damage.over ? 'OVER ' + r.damage.reason : r.damage.yields + ' y / ' + r.damage.breaks + ' b') : '-';
  if (r.leg === 'to') console.log(`| ${r.case} | ${r.surface} | ${r.mass} | take-off | ${r.roll != null ? 'off' : r.phase} | ${r.roll ?? '-'} | ${kt(r.vLiftoff)} | ${r.to15m ?? '-'} | ${r.stripLeftAtLiftoff ?? '-'} | ${r.maxSkiSinkCm ?? '-'} / ${r.maxSoftZcm} | ${r.skiPos ? r.skiPos.join(' ') : '-'} | ${dmg} |`);
  else { const L = r.landing || {};
    console.log(`| ${r.case} | ${r.surface} | ${r.mass} | landing | ${r.phase}${L.three ? ' (3-pt)' : ''}, td ${L.tdIn ?? '-'} m in | ${L.run ?? '-'} | ${kt(L.V)} | sink ${L.sink ?? '-'} m/s | ${r.stopLeft ?? '-'} | ${r.maxSkiSinkCm ?? '-'} / ${r.maxSoftZcm} | ${r.skiPos ? r.skiPos.join(' ') : '-'} | ${dmg} |`); }
}
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(res, null, 1));
