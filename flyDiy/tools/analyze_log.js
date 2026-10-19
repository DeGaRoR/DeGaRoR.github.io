#!/usr/bin/env node
// analyze_log.js - READS A FLIGHT LOG (G620: src/viewer/flight_recorder.js, the graphics flyout's `save log`)
// and says what the frame did, phase by phase - and scores the ROLLOUT targets.
//
//   node tools/analyze_log.js <flydiy-flightlog-*.json[.gz]> [--gate] [--json out.json] [--worst N] [--all]
//        [--flight] [--takeoff N|all] [--trace a:b]   (G3322: the flight and the take-offs only; a take-off's table; the
//        flight columns between page seconds a and b)
//
// Prints:
//   - the session: build, browser, GPU, screen / canvas / DPR, graphics settings, aeroplane, the recorder's cost,
//     the loading screens (each run of the boot's steps with their ms). Times are PAGE time (s since the page began)
//   - per PHASE (boot, shed, stand, taxi, take-off, climb, cruise, descent, approach, landing, paused): frames,
//     seconds, mean fps, the fps percentiles (p50 / p10 / p1 - the frame interval's p50 / p90 / p99 inverted), the
//     worst interval, the seconds slower than 30 fps, and the mean CPU split / GPU / draws
//   - the WORST frames (default 20, after the reveal): the interval, what the frame BEFORE it did (a long
//     interval is the previous frame's work plus whatever ran between the two - the split says which), the
//     time outside the loop, and the events in the interval (long tasks and the scripts that held them, shader
//     links, premises built, settings, GC-ish drops, marks)
//   - seconds slower than 30 fps and the longest such stretch; frames over 100 ms; long tasks over 1 s
//   - EDITOR (G3082): the scenery editor's actions (premises_ui's 'edit' events - an edit's rebuild by step, a select,
//     a drag's moves, the autosave, the checks, the open): per class the count, the median and the worst ms; then the
//     slowest actions with what ran and the frame interval each one landed in
//   - THE ROLLOUT TARGETS (PASS / FAIL each): no frame over 100 ms after the reveal; never more than 3 s in a
//     row below 30 fps; the stand and the taxi at a median of 50 fps or better; no task over 1 s.
//     `--gate` exits 1 when any fails (else the tool exits 0 whatever it finds).
//   - THE FRAME-LENGTH DISTRIBUTION (G1360, tools/frame_dist.js): over the scored frames, a histogram (< 20, 20-40,
//     40-60, 60-100, 100-250, 250-1000, > 1000 ms), p50 / p90 / p99 / p99.9, the share of frames over 1.5x and 3x
//     THEIR cap's frame time (the recorder's `cap` column; the rig clock / uncapped = 60 Hz), the frames over 100 ms
//     and 1 s; and one line of it per phase (A.dist, phases[].dist in --json)
//   - G3322 (FLIGHTREC-DETAIL, format v2): THE FLIGHT - each flight as it began (the 'flight' events: the build's name
//     and spec hash, damage and why, who flew, the route, the day and its wind, the world) and the day's wind changes;
//     then THE TAKE-OFFS: each run the autopilot called ROLL (from the HOLD / LINEUP to whatever followed the ROLL /
//     LIFTOFF run, plus 5 s): the heading it held against the roll's own (the nose at the start - or, in a v1 log, the
//     track over the first 30 m), the drift off the line it started on, the pilot's LIFTOFF and the wheels off (the CG
//     0.5 m up), when the tail came up (the pitch 2 deg under the three-point attitude, held 0.3 s), the rudder's and
//     the aileron's extremes and reversals on the roll and in the 5 s after the lift-off, the bank, the sideslip, the
//     brakes, the wind at the start split into head and cross, and how the run ended; and a 0.5 s table of the first
//     one (`--takeoff N` for another, `--takeoff all` for every one). `--trace a:b` prints the same columns every
//     0.25 s between page seconds a and b. A v1 log (no flight columns) gets the position-only half of all this.
//
// DEFINITIONS (they are the scorer's, so they are written down):
//   - a FRAME is a rendered one (the frame cap's skipped refreshes are not frames); its interval `dt` is rAF's
//     own clock since the rendered frame before it, so a freeze is an interval like any other.
//   - an interval that spans the page being HIDDEN (a tab away) is not a frame: dropped from everything.
//   - the REVEAL is the FIRST roll-out screen gone (the `reveal` event; the boot's state 'gone' on the set 'rollout';
//     a screen that gives up on its hard timeout lifts early, and what follows is in plain sight); frames under a
//     loading screen (the boot flag) are the `boot` phase, frames in the shed the `shed` - neither counts for a target.
//   - SLOWER THAN 30 FPS: an interval over 35 ms (1000/30 and 5 % for the display's jitter); a STRETCH is a run
//     of them that may carry up to two quick frames inside it as long as its own mean stays under 30 fps (a
//     33/50 ms alternation is 24 fps, and a stretch). Its length is the sum of its intervals.
//   - the PHASE: the loading screens -> boot; the shed -> shed; the sim paused -> paused; else from the
//     autopilot's phase where it names one (DEPART/TAXI/LINEUP/HOLD/STOP ground; ROLL / LIFTOFF take-off;
//     CLIMB; CRUISE / ENROUTE; APPROACH / INBOUND / FLARE / GOAROUND approach; ROLLOUT landing) and from the
//     aeroplane itself under the hand or an unknown phase (CG under 3 m above the ground = on the ground;
//     < 0.5 m/s stand, >= 15 m/s take-off, else taxi; in the air climb / descent over 1.5 m/s, else cruise).
//     STAND is any ground phase at under 0.5 m/s.
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const FD = require('./frame_dist.js');

function load(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  return JSON.parse(buf.toString('utf8'));
}

const GROUND_AP = new Set(['DEPART', 'TAXI', 'LINEUP', 'HOLD', 'STOP', 'STOPPED', 'ROLL', 'ROLLOUT']);
const PHASE_ORDER = ['boot', 'shed', 'stand', 'taxi', 'take-off', 'climb', 'cruise', 'descent', 'approach', 'landing', 'paused'];

// the log as frames: an array of plain rows (the columns by name) and the header's tables
function frames(log) {
  const H = log.header || {}, Fr = log.frames || {}, cols = H.cols || Object.keys(Fr).filter(k => Array.isArray(Fr[k]) && k !== 't');
  const n = (Fr.t || []).length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = { i, t: Fr.t[i] };
    for (const c of cols) { const a = Fr[c]; r[c] = a ? (a[i] == null ? NaN : a[i]) : NaN; }
    out[i] = r;
  }
  return out;
}

// ---- G3322: THE FLIGHT'S COLUMNS ---------------------------------------------------------------------------------------
// Bearings are GRID degrees (the recorder's: 0 = north = -z, 90 = east = +x); `num` is a real number (a v1 log's missing
// column is NaN, a JSON null is NaN)
const R2D = 180 / Math.PI;
const num = x => typeof x === 'number' && x === x;
const angDiff = (a, b) => ((a - b + 540) % 360 + 360) % 360 - 180;   // a - b, -180..180
const bearing = (a, b) => (Math.atan2(b.x - a.x, -(b.z - a.z)) * R2D + 360) % 360;   // grid, from a to b
const circMean = a => { let s = 0, c = 0; for (const d of a) { s += Math.sin(d / R2D); c += Math.cos(d / R2D); } return a.length ? (Math.atan2(s, c) * R2D + 360) % 360 : null; };
// extremes and REVERSALS of a control over frames: a reversal is the sign flipping between two excursions past the
// deadband (a hand - or a servo - going one way, then the other)
function swing(rows, k, db) {
  let mn = Infinity, mx = -Infinity, rev = 0, sgn = 0, n = 0, tMn = null, tMx = null;
  for (const r of rows) {
    const v = r[k]; if (!num(v)) continue;
    n++; if (v < mn) { mn = v; tMn = r.t; } if (v > mx) { mx = v; tMx = r.t; }
    if (Math.abs(v) > db) { const s = v > 0 ? 1 : -1; if (sgn && s !== sgn) rev++; sgn = s; }
  }
  return n ? { min: mn, max: mx, rev, tMin: tMn, tMax: tMx } : null;
}
// the largest |value| with its sign and moment
function peak(rows, f) {
  let best = null, at = null;
  for (const r of rows) { const v = f(r); if (num(v) && (best == null || Math.abs(v) > Math.abs(best))) { best = v; at = r.t; } }
  return best == null ? null : { v: best, t: at };
}
const median = a => { const s = a.filter(num).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
// THE TAKE-OFFS: every run the autopilot called ROLL (entered from anything but LIFTOFF), through its ROLL / LIFTOFF
// frames (a ROLL after the LIFTOFF - back on the runway - is the same run), plus up to 5 s of what followed
function takeoffs(rows, FL) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], p = i > 0 ? rows[i - 1].ap : '';
    if (r.ap !== 'ROLL' || p === 'ROLL' || p === 'LIFTOFF') continue;
    let k = i;
    while (k + 1 < rows.length && (rows[k + 1].ap === 'ROLL' || rows[k + 1].ap === 'LIFTOFF') && rows[k + 1].t - r.t < 120000) k++;
    let e = k;
    while (e + 1 < rows.length && rows[e + 1].t - rows[k].t < 5000 && !((rows[e + 1].flags | 0) & FL.garage)) e++;
    out.push(takeoffOf(rows.slice(i, e + 1), k - i, rows[i - 1] || null));
    i = k;
  }
  return out;
}
function takeoffOf(seg, kEnd, before) {
  const s0 = seg[0], T = r => (r.t - s0.t) / 1000;
  const haveHdg = seg.some(r => num(r.hdg)), haveCtl = seg.some(r => num(r.rud)), havePitch = seg.some(r => num(r.pitch));
  // the reference: the nose at the roll's start (v2), else the track over the first 30 m rolled
  const p30 = seg.find(r => num(r.x) && Math.hypot(r.x - s0.x, r.z - s0.z) >= 30);
  const trk30 = p30 ? bearing(s0, p30) : null;
  let ref = haveHdg ? circMean(seg.filter(r => T(r) <= 0.5 && num(r.hdg)).map(r => r.hdg)) : null, refHow = 'the nose at the roll\'s start';
  if (ref == null) { ref = trk30; refHow = 'the track over the first 30 m (no heading column: a v1 log)'; }
  // per frame: the heading off the reference (the nose; else the track over the last 0.5 s), the drift off the line
  // the roll began on (+ right), the distance down it
  const c = ref != null ? Math.cos(ref / R2D) : 0, s = ref != null ? Math.sin(ref / R2D) : 0;
  let j0 = 0;
  for (let i = 0; i < seg.length; i++) {
    const r = seg[i];
    while (j0 < i && seg[j0].t < r.t - 500) j0++;
    const q = seg[j0];
    r.trk = (q !== r && num(r.x) && Math.hypot(r.x - q.x, r.z - q.z) > 0.5) ? bearing(q, r) : NaN;
    r.dh = ref == null ? NaN : num(r.hdg) ? angDiff(r.hdg, ref) : num(r.trk) ? angDiff(r.trk, ref) : NaN;
    const dx = r.x - s0.x, dz = r.z - s0.z;
    r.xt = ref == null ? NaN : dx * c + dz * s;          // right of the line +
    r.along = ref == null ? NaN : dx * s - dz * c;       // down the line
  }
  const agl0 = median(seg.filter(r => T(r) <= 1).map(r => r.agl));
  const iLo = seg.findIndex(r => r.ap === 'LIFTOFF');
  const iOff = seg.findIndex(r => num(r.agl) && num(agl0) && r.agl > agl0 + 0.5);
  const iL = iLo >= 0 ? (iOff >= 0 ? Math.min(iLo, iOff) : iLo) : iOff;
  const roll = seg.slice(0, iL >= 0 ? iL : kEnd + 1), air = iL >= 0 ? seg.filter((r, i) => i >= iL && r.t - seg[iL].t <= 5000) : [];
  // the tail: the three-point attitude (the pitch over the first 0.5 s) and the first frame 2 deg under it, held 0.3 s
  let tail = null;
  if (havePitch) {
    const p0 = median(seg.filter(r => T(r) <= 0.5).map(r => r.pitch));
    let at = null;
    for (let i = 0; i < roll.length && at == null; i++) {
      if (!(roll[i].pitch < p0 - 2)) continue;
      let ok = true; for (let k = i; k < roll.length && roll[k].t - roll[i].t <= 300; k++) if (!(roll[k].pitch < p0 - 2)) { ok = false; break; }
      if (ok) at = roll[i];
    }
    tail = { pitch0: p0, level: !(p0 > 2), up: at ? { t: at.t, T: T(at), spd: at.spd, ias: at.ias, pitch: at.pitch } : null };
  }
  const W0 = seg.filter(r => T(r) <= 0.5);
  const wspd = median(W0.map(r => r.wspd)), wdir = circMean(W0.filter(r => num(r.wdir)).map(r => r.wdir));
  const wind = num(wspd) ? { spd: wspd, dir: wdir, head: wdir != null && ref != null ? wspd * Math.cos(angDiff(wdir, ref) / R2D) : null,
    cross: wdir != null && ref != null ? wspd * Math.sin(angDiff(wdir, ref) / R2D) : null } : null;   // cross > 0: from the right
  const at = r => r ? { t: r.t, T: T(r), along: r.along, spd: r.spd, ias: r.ias, dh: r.dh, xt: r.xt, bank: r.bank, pitch: r.pitch, agl: r.agl - agl0 } : null;
  const ctlOf = rows => ({ rud: swing(rows, 'rud', 0.05), ail: swing(rows, 'ail', 0.05), elev: swing(rows, 'elev', 0.05),
    brake: peak(rows, r => r.brake), brd: peak(rows, r => r.brd), thr: swing(rows, 'thr', 2) });
  let aglMax = null;   // the highest the CG rose over the roll's start
  for (const r of seg.slice(0, kEnd + 1)) { const h = r.agl - agl0; if (num(h) && (!aglMax || h > aglMax.v)) aglMax = { v: h, t: r.t }; }
  const after = seg[kEnd + 1] ? seg[kEnd + 1].ap : null;
  const backOn = iLo >= 0 && seg.slice(iLo, kEnd + 1).some(r => r.ap === 'ROLL');
  const o = {
    t: s0.t, from: before ? before.ap : null, x: s0.x, z: s0.z, ref, refHow, trk30, haveHdg, haveCtl, agl0, wind, tail,
    liftoffPilot: iLo >= 0 ? at(seg[iLo]) : null, wheelsOff: iOff >= 0 ? at(seg[iOff]) : null,
    roll: { s: roll.length ? T(roll[roll.length - 1]) : 0, dh: peak(roll, r => r.dh), xt: peak(roll, r => r.xt), bank: peak(roll, r => r.bank), beta: peak(roll, r => r.beta), ctl: ctlOf(roll) },
    air: air.length ? { dh: peak(air, r => r.dh), xt: peak(air, r => r.xt), bank: peak(air, r => r.bank), beta: peak(air, r => r.beta), ctl: ctlOf(air) } : null,
    aglMax, end: { T: T(seg[kEnd]), after, backOn, last: at(seg[seg.length - 1]) },
  };
  Object.defineProperty(o, 'rows', { value: seg, enumerable: false });   // (the table's; kept out of --json)
  return o;
}
// the flight columns of one frame, as a table row (and its head)
const TROW_HEAD = '      s  ap        spd   ias   dhdg    xt  dagl  pitch  bank  beta |   ail   rud  elev   thr  brk   brd | wind';
function trow(r, t0, agl0) {
  const f = (x, w, d) => (num(x) ? x.toFixed(d) : '-').padStart(w);
  return f((r.t - t0) / 1000, 7, 2) + '  ' + String(r.ap || '').padEnd(8) + f(r.spd, 6, 1) + f(r.ias, 6, 1) + f(r.dh, 7, 1) + f(r.xt, 6, 1) + f(r.agl - (num(agl0) ? agl0 : 0), 6, 2) +
    f(r.pitch, 7, 1) + f(r.bank, 6, 1) + f(r.beta, 6, 1) + ' |' + f(r.ail, 6, 2) + f(r.rud, 6, 2) + f(r.elev, 6, 2) + f(r.thr, 6, 2) + f(r.brake, 5, 2) + f(r.brd, 6, 2) +
    ' | ' + (num(r.wspd) ? r.wspd.toFixed(1) + ' m/s' + (num(r.wdir) ? ' from ' + r.wdir.toFixed(0) : '') : '-');
}
// a table of rows at one row per `step` seconds (the first frame at or after each step)
function table(rows, t0, agl0, step) {
  const L = [TROW_HEAD]; let next = -1e9;
  for (const r of rows) if (r.t >= next) { L.push(trow(r, t0, agl0)); next = r.t + step * 1000; }
  return L;
}

function analyze(log, opt) {
  opt = opt || {};
  const H = log.header || {}, FL = H.flags || { garage: 1, running: 2, held: 4, manual: 8, away: 16, freeze: 32, boot: 64, gpuForeign: 128, noRender: 256 };
  const SL = H.slots || ['script', 'solver', 'world', 'prem', 'cover', 'fill', 'scene', 'hud', 'mirror', 'render', 'shadow', 'shader', 'other'];
  const phNames = (H.codes && H.codes.phase) || [''], camNames = (H.codes && H.codes.cam) || [''];
  const rows = frames(log);
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], detail: e[3] })).sort((a, b) => a.t - b.t);
  // the reveal: the FIRST roll-out screen gone - from then on the player sees the world (a loading screen that gives up
  // on its hard timeout lifts early and its steps finish in plain sight: a second `reveal` later, and those frames count)
  let revealT = null;
  const reveals = events.filter(e => e.kind === 'reveal').map(e => e.t);
  if (reveals.length) revealT = reveals[0];
  if (revealT == null && H.revealAt != null && H.revealAt >= 0) revealT = H.revealAt;
  // G1995 (HW-COVERAGE): a log from before the recorder marked a screenless roll-out (the world built in the one loading:
  // no roll-out screen, so no `reveal` - the GTX 660 log of 4 Oct, the 1660 Ti's of 5 Oct): the reveal is INFERRED as the
  // first frame of a running flight out of the shed and under no screen, and the report says it was inferred
  let revealInferred = false;
  if (revealT == null) {
    for (const r of rows) { const fl = r.flags | 0; if (!(fl & FL.boot) && !(fl & FL.garage) && !(fl & FL.held) && (fl & FL.running)) { revealT = r.t - 1e-3; revealInferred = true; break; } }
  }
  const t0 = rows.length ? rows[0].t : 0;
  // the phase of each frame
  for (const r of rows) {
    const fl = r.flags | 0, ph = phNames[r.phase | 0] || '';
    r.away = !!(fl & FL.away) || !(r.dt === r.dt);
    r.cam = camNames[r.cam | 0] || '';
    r.ap = ph;
    let p;
    if ((fl & FL.held) || (fl & FL.boot)) p = 'boot';
    else if (fl & FL.garage) p = 'shed';
    else if (!(fl & FL.running)) p = 'paused';
    else {
      const manual = !!(fl & FL.manual), spd = r.spd === r.spd ? r.spd : 0, agl = r.agl === r.agl ? r.agl : 0, vs = r.vs === r.vs ? r.vs : 0;
      const known = !manual && ph;
      if (known && (ph === 'ROLL' || ph === 'LIFTOFF')) p = 'take-off';
      else if (known && ph === 'ROLLOUT') p = 'landing';
      else if (known && GROUND_AP.has(ph)) p = spd < 0.5 ? 'stand' : 'taxi';
      else if (known && ph === 'CLIMB') p = 'climb';
      else if (known && (ph === 'CRUISE' || ph === 'ENROUTE' || ph === 'TURNBACK')) p = 'cruise';
      else if (known && (ph === 'APPROACH' || ph === 'INBOUND' || ph === 'FLARE' || ph === 'GOAROUND')) p = 'approach';
      else if (agl < 3) p = spd < 0.5 ? 'stand' : spd >= 15 ? 'take-off' : 'taxi';
      else p = vs > 1.5 ? 'climb' : vs < -1.5 ? 'descent' : 'cruise';
    }
    r.ph = p;
    r.after = revealT != null && r.t > revealT;
  }
  const pct = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN;
  // ---- per phase
  const byPhase = {};
  for (const r of rows) {
    if (r.away) continue;
    const P = byPhase[r.ph] || (byPhase[r.ph] = { frames: 0, ms: 0, dts: [], caps: [], slowMs: 0, split: {}, gpu: 0, gpuN: 0, calls: 0, tris: 0, work: 0 });
    P.frames++; P.ms += r.dt; P.dts.push(r.dt); P.caps.push(r.cap); P.work += r.work || 0;
    if (r.dt > 35) P.slowMs += r.dt;
    for (const s of SL) P.split[s] = (P.split[s] || 0) + (r[s] || 0);
    if (r.gpu === r.gpu) { P.gpu += r.gpu; P.gpuN++; }
    P.calls += r.calls || 0; P.tris += r.tris || 0;
  }
  const phases = [];
  for (const name of PHASE_ORDER.concat(Object.keys(byPhase).filter(k => PHASE_ORDER.indexOf(k) < 0))) {
    const P = byPhase[name]; if (!P) continue;
    const s = P.dts.slice().sort((a, b) => a - b);
    const split = {}; for (const k of SL) split[k] = P.split[k] / P.frames;
    phases.push({ phase: name, frames: P.frames, seconds: P.ms / 1000, meanFps: P.frames * 1000 / P.ms,
      fpsP50: 1000 / pct(s, 0.5), fpsP10: 1000 / pct(s, 0.9), fpsP1: 1000 / pct(s, 0.99), worstMs: s[s.length - 1],
      slowS: P.slowMs / 1000, workMs: P.work / P.frames, split, gpuMs: P.gpuN ? P.gpu / P.gpuN : null, gpuFrames: P.gpuN,
      calls: P.calls / P.frames, ktris: P.tris / P.frames / 1000, dist: FD.dist(P.dts, P.caps) });
  }
  // ---- the frames that count for the targets: after the reveal, off the loading screens
  // the frames the targets score: after the reveal, in the world (a loading screen and the shed are not the roll-out's)
  const scope = rows.filter(r => !r.away && r.ph !== 'boot' && r.ph !== 'shed' && (opt.all || (revealT != null && r.after)));
  const dist = FD.dist(scope.map(r => r.dt), scope.map(r => r.cap));   // G1360: the scored frames' distribution
  const scopeName = opt.all ? 'every frame off the loading screens' : revealT != null ? 'after the reveal' : 'NO REVEAL IN THIS LOG (never rolled out) - nothing to score';
  // ---- slower than 30 fps: stretches
  const stretches = [];
  {
    let run = null, pendN = 0, pendMs = 0, prev = null;
    const close = () => { if (run) stretches.push(run); run = null; pendN = 0; pendMs = 0; };
    for (const r of scope) {
      if (prev && r.i !== prev.i + 1) close();   // a gap (the boot, a tab away) ends a stretch
      prev = r;
      if (r.dt > 35) {
        if (run) { run.ms += pendMs + r.dt; run.frames += pendN + 1; run.end = r.t; }
        else run = { start: r.t - r.dt, end: r.t, ms: r.dt, frames: 1, phase: r.ph };
        pendN = 0; pendMs = 0;
      } else if (run) {
        pendN++; pendMs += r.dt;
        if (pendN > 2 || (run.frames + pendN) * 1000 / (run.ms + pendMs) >= 30) close();
      }
    }
    close();
  }
  stretches.sort((a, b) => b.ms - a.ms);
  const slowS = stretches.reduce((a, s) => a + s.ms, 0) / 1000;
  // ---- the worst frames, and what preceded them
  const byI = new Map(rows.map(r => [r.i, r]));
  const evIn = (a, b) => events.filter(e => {
    const end = e.t + (e.ms && (e.kind === 'longtask' || e.kind === 'loaf' || e.kind === 'link' || e.kind === 'linkwait' || e.kind === 'prem') ? e.ms : 0);
    return end >= a && e.t <= b && e.kind !== 'boot';
  });
  const topSplit = r => SL.map(k => [k, r[k] || 0]).filter(x => x[1] >= 0.05).sort((a, b) => b[1] - a[1]);
  const worst = scope.slice().sort((a, b) => b.dt - a.dt).slice(0, opt.worst || 20).map(r => {
    const p = byI.get(r.i - 1) || null;
    return { i: r.i, t: r.t, sinceReveal: revealT != null ? (r.t - revealT) / 1000 : null, dt: r.dt, phase: r.ph, ap: r.ap, cam: r.cam,
      before: p ? { work: p.work, split: topSplit(p), gpu: p.gpu === p.gpu ? p.gpu : null, calls: p.calls, ktris: (p.tris || 0) / 1000, owed: p.owed, taken: p.taken } : null,
      outside: p ? r.dt - (p.work || 0) : null,
      events: evIn(r.t - r.dt, r.t) };
  });
  const over100 = scope.filter(r => r.dt > 100).sort((a, b) => b.dt - a.dt);
  const longTasks = events.filter(e => e.kind === 'longtask' && e.ms > 1000).map(e => {
    const loaf = events.filter(x => x.kind === 'loaf' && x.t <= e.t + e.ms && x.t + x.ms >= e.t);
    return Object.assign({}, e, { afterReveal: revealT != null && e.t > revealT, loaf: loaf.map(x => x.detail) });
  });
  const evCount = {}; for (const e of events) evCount[e.kind] = (evCount[e.kind] || 0) + 1;
  // ---- THE EDITOR (G3082): its actions, by class (the detail's first word: open, select, drag, release, move, set, add,
  // delete, undo:, redo, autosave, checks ...), and the frame each one landed in (the action's event is logged as it ends)
  const edits = events.filter(e => e.kind === 'edit').map(e => {
    const d = String(e.detail || ''), cls = (d.split(/[ ·]/)[0] || '?').replace(/:$/, '');
    const fr = rows.find(r => r.t >= e.t) || null;
    return { t: e.t, ms: e.ms, cls, detail: d, frame: fr ? fr.dt : null };
  });
  const editor = (() => {
    if (!edits.length) return null;
    const by = {};
    for (const e of edits) (by[e.cls] = by[e.cls] || []).push(e.ms || 0);
    const classes = Object.keys(by).map(k => { const a = by[k].slice().sort((x, y) => x - y); return { cls: k, n: a.length, med: a[(a.length - 1) >> 1], worst: a[a.length - 1] }; }).sort((a, b) => b.worst - a.worst);
    return { n: edits.length, classes, slowest: edits.slice().sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, opt.worst || 20), over100: edits.filter(e => e.ms > 100).length, over1s: edits.filter(e => e.ms > 1000).length };
  })();
  // G1357: the frames the catcher kept (post_fx.js catcher: a frame apart from both neighbours, with its state and a 64 x 36 JPEG)
  const catches = events.filter(e => e.kind === 'catch' && e.detail && typeof e.detail === 'object').map(e => Object.assign({ t: e.t }, e.detail));
  // ---- the loading screens: each run of the boot's steps (the shed's, the roll-out's), from the boot's own log
  const boots = [];
  {
    const BL = (H.boot && H.boot.log) || [];
    let cur = null;
    for (const e of BL) {
      if (e.k === 'run') { cur = { set: e.set, t: e.t, steps: [], goneT: null, shaders: null }; boots.push(cur); }
      else if (cur && e.k === 'step') cur.steps.push({ id: e.id, ms: e.ms == null ? null : e.ms, programs: e.programs });
      else if (cur && e.k === 'shaders') cur.shaders = e.total;
      else if (cur && e.k === 'gone' && cur.goneT == null) cur.goneT = e.t;
    }
    for (const b of boots) b.screenMs = b.goneT != null ? b.goneT - b.t : null;
  }
  // ---- the targets
  const stand = phases.find(p => p.phase === 'stand'), taxi = phases.find(p => p.phase === 'taxi');
  const scoped = ph => { const s = scope.filter(r => r.ph === ph).map(r => r.dt).sort((a, b) => a - b); return s.length ? { frames: s.length, fps: 1000 / pct(s, 0.5) } : null; };
  const st2 = scoped('stand'), tx2 = scoped('taxi');
  const haveScope = scope.length > 0;
  const targets = [
    { id: 'frame100', what: 'no frame over 100 ms after the reveal', ok: haveScope && over100.length === 0,
      got: haveScope ? over100.length + ' over 100 ms' + (over100.length ? ' (worst ' + over100[0].dt.toFixed(0) + ' ms)' : '') : 'no frames to score' },
    { id: 'slow3s', what: 'never more than 3 s in a row below 30 fps', ok: haveScope && !(stretches.length && stretches[0].ms > 3000),
      got: haveScope ? (stretches.length ? 'longest ' + (stretches[0].ms / 1000).toFixed(2) + ' s (' + stretches[0].phase + ')' : 'none') : 'no frames to score' },
    { id: 'stand50', what: 'the stand at a median of 50 fps or better', ok: !!(st2 && st2.fps >= 50),
      got: st2 ? st2.fps.toFixed(1) + ' fps median over ' + st2.frames + ' frames' : 'no stand frames after the reveal' },
    { id: 'taxi50', what: 'the taxi at a median of 50 fps or better', ok: !!(tx2 && tx2.fps >= 50),
      got: tx2 ? tx2.fps.toFixed(1) + ' fps median over ' + tx2.frames + ' frames' : 'no taxi frames after the reveal' },
    { id: 'task1s', what: 'no task over 1 s (the whole log, the loading screens included)', ok: longTasks.length === 0,
      got: longTasks.length + ' over 1 s' + (longTasks.length ? ' (' + longTasks.filter(x => x.afterReveal).length + ' after the reveal; worst ' + Math.max(...longTasks.map(x => x.ms)).toFixed(0) + ' ms)' : '') },
  ];
  // G2933 (TREE-STREAM): the forest fill's need -> ready latency, one 'tree' event a part the eye could see the fill of
  // (render_world.js landPart: 'base|fill cx,cz at D m [swap] [hot] | F fr, walk+build X ms, queue Q[, urgent]')
  const treeEv = events.filter(e => e.kind === 'tree' && e.ms != null).map(e => {
    const d = String(e.detail || ''), m = /^(base|fill) (-?\d+),(-?\d+) at (\d+) m/.exec(d);
    return { t: e.t, ms: e.ms, part: m ? m[1] : '?', at: m ? +m[4] : null, swap: / swap/.test(d), hot: / hot/.test(d), urgent: /urgent/.test(d), detail: d };
  });
  // G3322: THE FLIGHT - each one as it began (the 'flight' events; a v1 log has none), the day's wind as it changed, the
  // pilot's profile a frame (header.codes.pilot) and the take-offs
  const piNames = (H.codes && H.codes.pilot) || [''];
  for (const r of rows) r.pilotName = piNames[r.pilot | 0] || '';
  const flights = events.filter(e => e.kind === 'flight').map(e => Object.assign({ at: e.t }, e.detail && typeof e.detail === 'object' ? e.detail : {}));
  const winds = events.filter(e => e.kind === 'wind').map(e => Object.assign({ at: e.t }, e.detail && typeof e.detail === 'object' ? e.detail : {}));
  const tos = takeoffs(rows, FL);
  const flightCols = rows.some(r => num(r.hdg) || num(r.rud));
  const A = { flight: { v: H.v || 1, cols: flightCols, flights, winds, header: H.flight || null, buildSpec: !!H.buildSpec }, takeoffs: tos,
    trees: treeEv, hwsteps: events.filter(e => e.kind === 'hwstep'), skies: events.filter(e => e.kind === 'sky'), header: H, t0, revealT, revealInferred, reveals, frames: rows.length, boots, scopeName, scopeFrames: scope.length, dist, phases, worst, stretches: stretches.slice(0, 10), slowS,
    over100: over100.slice(0, 30).map(r => ({ i: r.i, t: r.t, dt: r.dt, phase: r.ph })), over100N: over100.length, longTasks, evCount, catches, catcher: H.catcher || null, targets, editor };
  Object.defineProperty(A, 'rows', { value: rows, enumerable: false });   // G3322: --trace's (kept out of --json)
  return A;
}

// ---- G3322: the flight's text ------------------------------------------------------------------------------------------
const windTxt = w => !w ? 'calm (no wind declared)' : (w.kts != null ? (+w.kts).toFixed(1) + ' kt' : w.mps != null ? (+w.mps).toFixed(1) + ' m/s' : '?') +
  ' from ' + (w.dirDeg != null ? w.dirDeg : '?') + (w.gust ? ', gust ' + w.gust : '') + (w.breeze ? ', breeze ' + w.breeze : '');
const hhmm = u => num(u) ? String(Math.floor(u / 3600) % 24).padStart(2, '0') + ':' + String(Math.floor(u / 60) % 60).padStart(2, '0') : '?';
function flightTxt(f) {
  const b = f.build || {}, d = f.damage || {}, p = f.pilot || {}, r = f.route || {}, y = f.day || null;
  return [
    'the build ' + (b.name || '?') + (b.stock ? ' (the stock build)' : '') + (b.hash ? ' (spec hash ' + b.hash + (b.v != null ? ', v' + b.v : '') + ', ' + b.chars + ' chars)' : '') + (b.reg ? ' ' + b.reg : ''),
    'damage ' + (d.on ? 'ON' : 'off') + ' (' + (d.param != null ? 'the build\'s params.damage' : d.url != null ? 'the page\'s ?damage=' + (d.url ? 1 : 0) : 'GEN_DAMAGE_DEFAULT ' + d.dflt) + ')',
    'pilot ' + (p.style || '?') + ' / ' + (p.profile || '?') + (p.persona && p.persona !== p.profile ? ' (persona ' + p.persona + ')' : '') + (p.career ? ', the career\'s crew' : '') + (p.manual ? ', BY HAND' : '') + (p.custom ? ' custom ' + JSON.stringify(p.custom) : ''),
    'route ' + (r.from || '?') + ' > ' + (r.to || '?') + ' (base ' + (r.base || '?') + (r.spawn ? ', spawn ' + r.spawn : '') + (r.ap ? '; the pilot\'s ' + r.ap.from + ' > ' + r.ap.to : '') + ')',
    'day ' + (y ? (y.date || '?') + ' ' + hhmm(y.utc) + ' UTC, wind ' + windTxt(y.wind) + (y.cloudType ? ', ' + y.cloudType + ' ' + y.cloudCover : '') : '?'),
    'world ' + (f.world || '?') + (f.simw ? ', the physics worker' : ', inline'),
  ];
}
function flightReport(A, opt) {
  const F = A.flight || {}, L = [];
  const f1 = x => (num(x) ? x.toFixed(1) : '-'), f2 = x => (num(x) ? x.toFixed(2) : '-'), sg = x => (num(x) ? (x >= 0 ? '+' : '') + x.toFixed(1) : '-'),
        s2 = x => (num(x) ? (x >= 0 ? '+' : '') + x.toFixed(2) : '-');
  const ts = t => (t / 1000).toFixed(1) + ' s';
  L.push('THE FLIGHT (G3322; log format v' + (F.v || 1) + (F.cols ? '' : ' - no flight columns: positions, speed and the phase only') + ')');
  if (!F.flights || !F.flights.length) {
    if (F.header) for (const l of flightTxt(F.header)) L.push('  ' + l);
    else L.push('  no flight record in this log (a v1 log, or no flight begun)');
  }
  for (const f of F.flights || []) {
    L.push('  flight ' + (f.n || '?') + ' at ' + ts(f.at) + (f.t != null ? ' (sim t ' + f.t + ' s)' : '') + ':');
    for (const l of flightTxt(f)) L.push('    ' + l);
  }
  for (const w of F.winds || []) L.push('  the day\'s wind ' + (w.first ? 'at the start' : 'CHANGED') + ' at ' + ts(w.at) + ': ' + windTxt(w.spec || { kts: w.kts, dirDeg: w.dirDeg, gust: w.gust }));
  if (A.header && A.header.buildSpec) L.push('  the build\'s spec rides in the header (buildSpec): tools/log_replay.js writes it out');
  L.push('');
  const TO = A.takeoffs || [];
  L.push('THE TAKE-OFFS: ' + TO.length + ' (each run the autopilot called ROLL; dhdg = the heading off the roll\'s own, xt = off the line it began on, + right; rudder + = nose LEFT)');
  TO.forEach((o, k) => {
    L.push('  #' + (k + 1) + ' at ' + ts(o.t) + ' (from ' + (o.from || '?') + ') at x ' + f1(o.x) + ' z ' + f1(o.z) + ': the reference heading ' + f1(o.ref) + ' = ' + o.refHow);
    if (o.wind) L.push('     the wind at the start ' + f1(o.wind.spd) + ' m/s from ' + f1(o.wind.dir) + ': head ' + sg(o.wind.head) + ', cross ' + sg(o.wind.cross) + (num(o.wind.cross) ? (o.wind.cross >= 0 ? ' (from the right)' : ' (from the left)') : ''));
    const pk = (p, u) => p ? sg(p.v) + u + ' at ' + f1((p.t - o.t) / 1000) + ' s' : '-';
    const sw = (w, n) => w ? n + ' ' + f2(w.min) + '..' + f2(w.max) + ' (' + w.rev + ' reversal' + (w.rev === 1 ? '' : 's') + ')' : n + ' -';
    const ctl = c => [sw(c.rud, 'rudder'), sw(c.ail, 'aileron'), sw(c.elev, 'elevator'), 'brake max ' + (c.brake ? f2(c.brake.v) : '-'), 'diff brake ' + (c.brd ? sg(c.brd.v) : '-'),
      'throttle ' + (c.thr ? f2(c.thr.min) + '..' + f2(c.thr.max) : '-')].join(', ');
    const R = o.roll;
    L.push('     the roll ' + f1(R.s) + ' s: the heading most off ' + pk(R.dh, ' deg') + ', the drift ' + pk(R.xt, ' m') + ', bank ' + pk(R.bank, ' deg') + ', slip ' + pk(R.beta, ' deg'));
    if (o.haveCtl) L.push('       ' + ctl(R.ctl));
    if (o.tail) L.push('     the tail: ' + (o.tail.level ? 'a level sit (pitch ' + f1(o.tail.pitch0) + ' deg at the start: a nose wheel?)' :
      o.tail.up ? 'up at ' + f1(o.tail.up.T) + ' s, ' + f1(o.tail.up.spd) + ' m/s (ias ' + f1(o.tail.up.ias) + '), pitch ' + f1(o.tail.pitch0) + ' -> ' + f1(o.tail.up.pitch) : 'it never came up (the pitch stayed within 2 deg of the ' + f1(o.tail.pitch0) + ' deg three-point attitude)'));
    else L.push('     the tail: unknown (no pitch column)');
    const pt = (n, a) => a ? '     ' + n + ' at ' + f1(a.T) + ' s, ' + f1(a.along) + ' m down the line, ' + f1(a.spd) + ' m/s (ias ' + f1(a.ias) + '), dhdg ' + sg(a.dh) + ', xt ' + sg(a.xt) + ' m, bank ' + sg(a.bank) + ', pitch ' + f1(a.pitch) + ', ' + s2(a.agl) + ' m up' : '     ' + n + ': none';
    L.push(pt('the pilot\'s LIFTOFF', o.liftoffPilot));
    L.push(pt('the wheels off (CG +0.5 m)', o.wheelsOff));
    if (o.air) {
      L.push('     the 5 s after the lift-off: the heading most off ' + pk(o.air.dh, ' deg') + ', the drift ' + pk(o.air.xt, ' m') + ', bank ' + pk(o.air.bank, ' deg') + ', slip ' + pk(o.air.beta, ' deg'));
      if (o.haveCtl) L.push('       ' + ctl(o.air.ctl));
    }
    L.push('     the end: ' + f1(o.end.T) + ' s after the roll began' + (o.end.backOn ? ', BACK ON THE RUNWAY (ROLL after LIFTOFF)' : '') + (o.end.after ? ', then ' + o.end.after : '') +
      '; the highest ' + (o.aglMax ? s2(o.aglMax.v) : '-') + ' m; last seen dhdg ' + sg(o.end.last && o.end.last.dh) + ', xt ' + sg(o.end.last && o.end.last.xt) + ' m');
  });
  // the table: the first take-off (--takeoff N: that one; all: every one), one row per 0.5 s (longer runs: 40 rows)
  const pick = opt.takeoff === 'all' ? TO.map((o, k) => k) : [Math.max(0, (+opt.takeoff || 1) - 1)].filter(k => k < TO.length);
  for (const k of pick) {
    const o = TO[k], rows = o.rows || [], dur = rows.length ? (rows[rows.length - 1].t - rows[0].t) / 1000 : 0;
    L.push('  #' + (k + 1) + ' frame by frame (s since the roll began; dagl over the roll\'s start)');
    for (const l of table(rows, o.t, o.agl0, Math.max(0.5, dur / 40))) L.push('   ' + l);
  }
  // --trace a:b - the flight columns every 0.25 s between page seconds a and b
  if (opt.trace && A.rows) {
    const [a, b] = String(opt.trace).split(':').map(Number);
    const rows = A.rows.filter(r => r.t >= a * 1000 && r.t <= b * 1000);
    L.push('  TRACE ' + a + ' s .. ' + b + ' s (page time; ' + rows.length + ' frames; dhdg and xt only inside a take-off)');
    for (const l of table(rows, a * 1000, NaN, 0.25)) L.push('   ' + l);
  }
  L.push('');
  return L;
}

// ---- the text ------------------------------------------------------------------------------------------------------
function report(A, opt) {
  opt = opt || {};
  const H = A.header, L = [];
  const f1 = x => (x == null || !(x === x) ? '-' : x.toFixed(1)), f0 = x => (x == null || !(x === x) ? '-' : x.toFixed(0));
  const ts = t => (t / 1000).toFixed(1) + ' s';   // page time (performance.now: since the page began to load)
  L.push('FLIGHT LOG ' + (H.sid || '?') + '  started ' + (H.started || '?') + '  saved ' + (H.saved || '?'));
  L.push('  build ' + (H.build || '?') + ' (core ' + (H.core || '?') + ', server ' + (H.server || '?') + ')  world ' + (H.world || '?') + '  ' + (H.url || ''));
  L.push('  browser ' + (H.ua || '?'));
  if (H.gpu) L.push('  GPU ' + (H.gpu.unmaskedRenderer || H.gpu.renderer || '?') + ' (' + (H.gpu.unmaskedVendor || H.gpu.vendor || '?') + ')');
  L.push('  screen ' + (H.screen ? H.screen.w + 'x' + H.screen.h : '?') + '  canvas ' + (H.canvas ? H.canvas.w + 'x' + H.canvas.h : '?') + '  DPR ' + (H.dpr || '?') + '  cores ' + (H.cores || '?') + (H.memGB ? '  ' + H.memGB + ' GB' : ''));
  if (H.gfx) L.push('  graphics ' + Object.keys(H.gfx).map(k => k + '=' + H.gfx[k]).join(' '));
  if (H.pace) L.push('  frame clock ' + H.pace.mode + (H.pace.legacy ? ' (rig clock)' : '') + ', cap ' + H.pace.cap + ', auto went down ' + (H.pace.stats ? H.pace.stats.down : '?') + 'x / up ' + (H.pace.stats ? H.pace.stats.up : '?') + 'x');
  if (H.aircraft) L.push('  aeroplane ' + (H.aircraft.name || H.aircraft.key || '?') + ', ' + (H.aircraft.nodes || '?') + ' nodes, ' + (H.aircraft.massKg || '?') + ' kg');
  if (H.overhead) L.push('  the recorder: ' + (H.overhead.frameUsMean != null ? H.overhead.frameUsMean + ' us a frame, measured live on ' + H.overhead.sampled + ' sampled frames (max ' + H.overhead.frameUsMax + ' us; budget 200)' + (H.overhead.gpuTimerUsMean ? ' + the GPU timer\'s GL calls ' + H.overhead.gpuTimerUsMean + ' us'  : '') : H.overhead.endUsMean + ' us a frame at its end()') + (H.gpuTimer ? '; GPU timer: ' + H.gpuTimer.ok + ' frames timed, ' + H.gpuTimer.disjoint + ' disjoint, another module\'s timer seen ' + H.gpuTimer.foreignFrames + 'x' : '; no GPU timer in this browser'));
  L.push('  ' + A.frames + ' frames' + (A.revealT != null ? ', the reveal at ' + ts(A.revealT) + (A.revealInferred ? ' (INFERRED: no reveal marked - the first running flight frame; G1995)' : '') + (A.reveals.length > 1 ? ' (the roll-out screen went ' + A.reveals.length + ' times: ' + A.reveals.map(ts).join(', ') + ')' : '') : ', NO REVEAL (the roll-out screen never went)') + '; events: ' + Object.keys(A.evCount).map(k => k + ' ' + A.evCount[k]).join(', '));
  for (const b of A.boots || []) {
    L.push('  loading screen ' + (b.set || '?') + ': ' + (b.screenMs != null ? (b.screenMs / 1000).toFixed(1) + ' s' : 'never lifted') + (b.shaders ? ', ' + b.shaders + ' shaders' : '') +
      ' - ' + b.steps.map(s => s.id + ' ' + (s.ms != null ? (s.ms >= 1000 ? (s.ms / 1000).toFixed(1) + ' s' : s.ms + ' ms') : '?')).join(', '));
  }
  // G1995: the runtime step-down's moves (gfx_settings.js GFX.hw)
  // G1532b.1: the sky at the reveal and 10 s later - the cloud pass, the day's cover, the resolve target (the user's no-clouds-from-boot)
  for (const e of A.skies || []) { const d = e.detail || {}, c = d.clouds || {}, y = d.day || {}, a = d.aa || {};
    L.push('  SKY ' + (d.at || '?') + ' at ' + ts(e.t) + ': clouds ' + c.mode + (c.active ? ' ACTIVE' : ' inactive') + ' (ready ' + c.ready + ', baked ' + c.baked + ', sky cover ' + c.cover + ')'
      + ' - the day cloudCover ' + y.cloudCover + ' ' + y.cloudType + (y.upper ? ' +' + y.upper + ' upper' : '') + ' - aa ' + a.tier + ' samples ' + a.samples + ', target ' + (a.target || 'NONE')); }
  for (const e of A.hwsteps || []) { const d = e.detail || {}; L.push('  STEP-DOWN at ' + ts(e.t) + ': ' + d.from + ' -> ' + d.to + ' (' + d.fps + ' fps in the ' + d.kind + ', GPU ' + d.gpuMs + ' ms, JS ' + d.workMs + ' ms' + (d.reload ? '; the lighter build at the next load: ' + d.reload.join(', ') : '') + ')'); }
  L.push('');
  // G3322: the flight and its take-offs first - what the user saw happen - then the frames
  for (const l of flightReport(A, opt)) L.push(l);
  if (opt.flightOnly) return L.join('\n');
  L.push('PER PHASE (every frame of the phase, the loading screens their own)');
  L.push('  phase       frames     s   mean  p50  p10   p1 fps   worst ms  <30fps s   cpu ms   gpu ms  draws  ktris   cpu split (ms/frame, top)');
  for (const p of A.phases) {
    const top = Object.keys(p.split).map(k => [k, p.split[k]]).filter(x => x[1] >= 0.05).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0] + ' ' + x[1].toFixed(1)).join(', ');
    L.push('  ' + p.phase.padEnd(10) + String(p.frames).padStart(7) + f0(p.seconds).padStart(6) + f1(p.meanFps).padStart(7) + f0(p.fpsP50).padStart(5) + f0(p.fpsP10).padStart(5) + f0(p.fpsP1).padStart(5) +
      f0(p.worstMs).padStart(11) + f1(p.slowS).padStart(10) + f1(p.workMs).padStart(9) + f1(p.gpuMs).padStart(9) + f0(p.calls).padStart(7) + f0(p.ktris).padStart(7) + '   ' + top);
  }
  L.push('');
  L.push('FRAME-LENGTH DISTRIBUTION (' + A.scopeName + '; the cap\'s frame time is each frame\'s own cap, 60 Hz when uncapped)');
  if (A.dist) for (const l of FD.table(A.dist, '  ')) L.push(l);
  for (const p of A.phases) if (p.dist && p.dist.n) L.push('  ' + p.phase.padEnd(10) + FD.line(p.dist));
  L.push('');
  L.push('THE WORST ' + A.worst.length + ' FRAMES (' + A.scopeName + '; an interval is the frame before it plus what ran between them)');
  for (const w of A.worst) {
    L.push('  ' + f0(w.dt).padStart(6) + ' ms at ' + ts(w.t) + (w.sinceReveal != null ? ' (reveal +' + w.sinceReveal.toFixed(1) + ' s)' : '') + '  ' + w.phase + (w.ap ? ' [' + w.ap + ']' : '') + (w.cam ? ' cam ' + w.cam : ''));
    if (w.before) L.push('         the frame before: work ' + f1(w.before.work) + ' ms (' + w.before.split.map(x => x[0] + ' ' + x[1].toFixed(1)).join(', ') + ')' +
      '  gpu ' + f1(w.before.gpu) + '  draws ' + f0(w.before.calls) + '  ' + f0(w.before.ktris) + 'k tris  steps ' + w.before.taken + '/' + w.before.owed + '  outside the loop ' + f1(Math.max(0, w.outside)) + ' ms');
    for (const e of w.events.slice(0, 8)) L.push('         ' + e.kind + (e.ms != null ? ' ' + f1(e.ms) + ' ms' : '') + (e.detail != null ? ': ' + String(e.detail).slice(0, 160) : ''));
    if (w.events.length > 8) L.push('         (+' + (w.events.length - 8) + ' more events)');
  }
  L.push('');
  L.push('SLOWER THAN 30 FPS (' + A.scopeName + '): ' + A.slowS.toFixed(1) + ' s in ' + A.stretches.length + '+ stretches; the longest: ' +
    (A.stretches.length ? A.stretches.slice(0, 5).map(s => (s.ms / 1000).toFixed(2) + ' s at ' + ts(s.start) + ' (' + s.phase + ', ' + s.frames + ' frames)').join('; ') : 'none'));
  L.push('FRAMES OVER 100 MS (' + A.scopeName + '): ' + A.over100N + (A.over100N ? ' - ' + A.over100.slice(0, 12).map(r => f0(r.dt) + ' ms at ' + ts(r.t) + ' ' + r.phase).join('; ') : ''));
  L.push('LONG TASKS OVER 1 S (the whole log): ' + A.longTasks.length);
  for (const e of A.longTasks) L.push('  ' + f0(e.ms) + ' ms at ' + ts(e.t) + (e.afterReveal ? ' (after the reveal)' : ' (before the reveal)') + (e.detail ? ' ' + e.detail : '') + (e.loaf.length ? ' - ' + e.loaf.join(' | ').slice(0, 300) : ''));
  L.push('');
  if (A.editor) {
    const E = A.editor;
    L.push('EDITOR (G3082 - the scenery editor\'s actions): ' + E.n + ', ' + E.over100 + ' over 100 ms, ' + E.over1s + ' over 1 s');
    L.push('  action        n   median ms   worst ms');
    for (const c of E.classes) L.push('  ' + c.cls.padEnd(12) + String(c.n).padStart(3) + f0(c.med).padStart(12) + f0(c.worst).padStart(11));
    L.push('  the slowest (ms, at, the frame it landed in, what ran):');
    for (const e of E.slowest) L.push('  ' + f0(e.ms).padStart(6) + ' ms at ' + ts(e.t) + (e.frame != null ? '  frame ' + f0(e.frame) + ' ms' : '') + '  ' + e.detail.slice(0, 220));
    L.push('');
  }
  if (A.catcher || A.catches.length) {
    const K = A.catcher;
    L.push('CAUGHT FRAMES (G1357 - a frame apart from both neighbours): ' + A.catches.length + (K ? ' (the catcher: ' + K.taps + ' taps, ' + K.reads + ' reads, ' + K.skipped +
      ' skipped busy, its cost ' + K.tapUs + ' us a tap (max ' + K.tapUsMax + '), ' + K.readUs + ' us a read)' : ''));
    for (const c of A.catches) L.push('  ' + ts(c.t) + '  ' + c.why + ': mean ' + c.prev + ' -> ' + c.mean + ' -> ' + c.next + ', sky ' + c.sky + ', white ' + c.white +
      ' | exposure base ' + c.exposureBase + ' eyeK ' + c.eyeK + ' far ' + c.far + ' near ' + c.near + ' camY ' + c.camY + ' cloud shadow ' + c.cloudShadow + ' in-cloud ' + c.inCloudRho +
      ' hidden quadrants ' + c.visHidden + ' | post ' + (c.post ? Object.keys(c.post).filter(k => c.post[k] !== 'off').map(k => k + ' ' + c.post[k]).join(' ') : '-') + (c.jpeg ? ' [jpeg]' : ''));
    L.push('');
  }
  if (A.trees && A.trees.length) {
    // the fill's parts as they landed: new ones (a chunk the ring reached) and swaps (an edit's), the near ones apart
    const T = A.trees, q = (a, k) => { const s2 = a.map(x => x.ms).sort((x, y) => x - y); return s2.length ? s2[Math.min(s2.length - 1, Math.floor(k * s2.length))] : null; };
    const row = (name, a) => a.length ? '  ' + name.padEnd(30) + String(a.length).padStart(6) + (f0(q(a, 0.5)) + ' ms').padStart(11) + (f0(q(a, 0.9)) + ' ms').padStart(11) + (f0(Math.max(...a.map(x => x.ms))) + ' ms').padStart(11) : null;
    L.push('TREE STREAM (G2933: the forest fill, need -> ready; a stand card stands in meanwhile)');
    L.push('  parts                          count     median        p90      worst');
    for (const x of [row('new, inside 1.5 km', T.filter(e => !e.swap && e.at != null && e.at < 1500)), row('new, 1.5 km to the dense edge', T.filter(e => !e.swap && e.at != null && e.at >= 1500)),
                     row('swaps (an edit)', T.filter(e => e.swap && !e.hot)), row('hot swaps (an exclusion)', T.filter(e => e.hot)), row('on the urgent budget', T.filter(e => e.urgent))]) if (x) L.push(x);
    const late = T.filter(e => e.ms > 20000).sort((a, b) => b.ms - a.ms);
    L.push('  over 20 s: ' + late.length + (late.length ? ' - ' + late.slice(0, 6).map(e => (e.ms / 1000).toFixed(1) + ' s at ' + ts(e.t) + ' (' + e.detail.slice(0, 60) + ')').join('; ') : ''));
    L.push('');
  }
  L.push('THE ROLLOUT TARGETS');
  for (const g of A.targets) L.push('  ' + (g.ok ? 'PASS' : 'FAIL') + '  ' + g.what + ': ' + g.got);
  L.push('ROLLOUT: ' + (A.targets.every(g => g.ok) ? 'PASS' : 'FAIL (' + A.targets.filter(g => !g.ok).map(g => g.id).join(', ') + ')'));
  return L.join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const VAL = ['--json', '--worst', '--catches', '--takeoff', '--trace'];   // (G3322: the flags that take a value)
  const file = argv.find((a, i) => !a.startsWith('--') && VAL.indexOf(argv[i - 1]) < 0);
  if (!file) { console.error('usage: node tools/analyze_log.js <flydiy-flightlog.json[.gz]> [--gate] [--json out.json] [--worst N] [--all] [--catches dir] [--flight] [--takeoff N|all] [--trace a:b]'); process.exit(2); }
  const opt = { all: argv.includes('--all'), flightOnly: argv.includes('--flight') };
  const wi = argv.indexOf('--worst'); if (wi >= 0) opt.worst = +argv[wi + 1];
  const ti = argv.indexOf('--takeoff'); if (ti >= 0) opt.takeoff = argv[ti + 1];   // G3322: N (1-based) or all
  const tr = argv.indexOf('--trace'); if (tr >= 0) opt.trace = argv[tr + 1];      // G3322: a:b page seconds
  const A = analyze(load(file), opt);
  console.log(report(A, opt));
  const ji = argv.indexOf('--json'); if (ji >= 0) fs.writeFileSync(argv[ji + 1], JSON.stringify(A, null, 1));
  // --catches <dir>: the caught frames' JPEGs, one file each (G1357)
  const ci = argv.indexOf('--catches');
  if (ci >= 0) { const dir = argv[ci + 1]; fs.mkdirSync(dir, { recursive: true }); let n = 0;
    for (const c of A.catches) if (c.jpeg) { fs.writeFileSync(require('path').join(dir, 'catch_' + String(n++).padStart(2, '0') + '_f' + c.f + '.jpg'), Buffer.from(c.jpeg.split(',')[1], 'base64')); }
    console.log(n + ' caught frame(s) written to ' + dir); }
  if (argv.includes('--gate')) process.exit(A.targets.every(g => g.ok) ? 0 : 1);
}
module.exports = { load, frames, analyze, report };
