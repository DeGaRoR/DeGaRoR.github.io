#!/usr/bin/env node
// G2373-G2377 (DMG-OCCUPANT, the DEFORM COORDINATOR's DMG block): GATE DMGOCCUPANT - each occupant's band after a crash
// (src/core/34_occupant.js), node only for the physics, the page in node for the card. The user, 7 Oct: "let's stay
// vague ... it's sad and frightening": per occupant ONE of FIVE words, nothing else in the game; the criteria behind a
// band are printed HERE (gate output) and in HANDOVER only.
//
// On the validated builds (tools/_treecrash_lib.js BUILDS: the user's Cub, the Jodel, the metal Cessna; the Cessna on
// floats and the twin on floats on the water; and the Cub with its rear seat filled - a passenger), the certificate on:
//   1. THE BANDS BY CASE (the game's own trigger): the 3 m/s taxi into a trunk (TREECRASH's), the nose-over (DMG-TUNE's
//      12 m/s into a 35 cm stump), the drop at FAR 23.473's limit sink and at 1.5 x it (DMG-TUNE's hard landing), the
//      30 m/s trunk on the centreline and 2.5 m out (4 m AGL); the floats' nose-ins (DMGWRECK's) and their 23.473 drop
//      on the water. Rows: the taxi and the 23.473 drop read 'Unharmed' for every occupant; the 30 m/s centreline reads
//      severe (Heavy or worse) on every land build; every seat aboard has a band; every band one of the five.
//      Each case is flown again with the record's trigger at 1.5 g (a test setting) so the criteria behind an
//      'Unharmed' that never triggered are printed too.
//   2. THE CRITERIA (printed per occupant): the DRI, the Eiband ratios (voluntary / moderate) longitudinal and lateral,
//      FAR 23.562's pulse (peak, velocity change), the restraint's load, the space kept, the cell's worst edge.
//   3. NOTHING WITHOUT THE LAYER: damage OFF - no record (sim.occupants() null, damage().occ absent), no hop payload;
//      damage ON and the recorder off (GEN_OCC.on false) flies the same bits (FNV of p, v) as on: it only reads; an
//      intact flight (30 s level, damage ON) allocates no buffer; the same crash twice, the same bands to the bit.
//   4. THE WIRE (sim_host.js simOccHop): exactly one payload per close, only { name, band } per seat; a reset sends null.
//   5. THE DISPLAY: GEN_OCC.bands is exactly the five words; the page (dev.html?simw=1&damage=1, the user's Cub, the
//      physics worker) crashes into a trunk at 30 m/s; the crash card's text is scanned - only the seat names and the five
//      words may appear for the occupants, and no injury word anywhere in the card or in the page's text (red if found);
//      showArrival's / occLines' own string literals scanned the same way.
//   --selftest: negative verification - a forbidden word in a card's text, in the source's literals, a sixth band word,
//      an extra key on the wire, an occupant record under damage OFF, a wrong DRI: each must turn its row red.
//   node tools/_dmg_occupant_check.js [--selftest] [--no-page] [--out file.json] [--builds cub,jodel,...]
// The runner's contract: exactly one `GATE DMGOCCUPANT: PASS|FAIL` (or DMGOCCUPANT-SELFTEST), exit code to match.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); if (a) return a.slice(k.length + 3); const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
process.env.FLYDIY_CERT = '1';

const FIVE = ['Unharmed', 'Light injuries', 'Heavy injuries', 'Life threatening', 'Fatal injuries'];
const WHO = /^(Pilot|Co-pilot|Passenger( [1-9][0-9]?)?)$/;
// THE SCAN: words that never belong on the card or anywhere in the game's text (the five allowed phrases taken out first)
const STRONG = /\b(fractur\w*|spin(e|al)|vertebr\w*|lumbar|skull|concuss\w*|lacerat\w*|bruis\w*|bleed\w*|blood\w*|haemorrh\w*|hemorrh\w*|trauma\w*|wound\w*|injur\w*|fatal\w*|death|dead|died|dies|kill\w*|coma|paraly\w*|amputat\w*|gore|organs?|whiplash|DRI|Eiband|deceased|corpse|severed|crush(ed)? (the )?(pilot|passenger|occupant)s?)\b/i;
// ...and the body's parts: on the card's own text only (elsewhere 'leg' is a flight's leg, 'head' a heading)
const BODY = /\b(head|neck|chest|arms?|legs?|pelvis|ribs?|femur|brain|spine|limbs?|abdomen|lungs?|heart|liver|hips?|knees?|shoulders?)\b/i;
const strip5 = t => FIVE.reduce((s, w) => s.split(w).join(' '), String(t));
function scanText(t, body) {
  const s = strip5(t), out = [];
  const m1 = s.match(new RegExp(STRONG.source, 'gi')); if (m1) out.push(...m1);
  if (body) { const m2 = s.match(new RegExp(BODY.source, 'gi')); if (m2) out.push(...m2); }
  return out;
}
// a function's string literals (its comments dropped): what it can put on a screen
function literalsOf(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
    if (c === '"' || c === "'" || c === '`') { let j = i + 1, s = ''; while (j < src.length && src[j] !== c) { if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; } s += src[j++]; } out.push(s); i = j + 1; continue; }
    i++;
  }
  return out;
}
function fnSource(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let j = src.indexOf('{', i), depth = 0;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
  return src.slice(i, j + 1);
}
const fnv = (a, b) => { let h = 2166136261; for (const A of [a, b]) { const u = new Uint8Array(A.buffer, A.byteOffset, A.byteLength); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } } return (h >>> 0).toString(16); };

// ============================================================ THE CASES (a child per build)
const LAND = [
  { id: 'taxi', label: 'a 3 m/s taxi into a trunk (TREECRASH\'s, the throttle shut)', kind: 'trunk', o: { D: 4, V: 3, thr: 0, secs: 8 }, want: 'unharmed' },
  { id: 'noseover', label: 'the nose-over: 12 m/s into a 35 cm stump (DMG-TUNE\'s)', kind: 'trunk', o: { D: 12, V: 12, thr: 0, secs: 6, trunk: { r: 0.25, h: 0.35, sink: 0 } } },
  { id: 'far473', label: 'the drop at FAR 23.473\'s limit sink, V_S0 forward, no lift', kind: 'drop', o: { k473: 1.0, frames: 240 }, want: 'unharmed' },
  { id: 'hard', label: 'the drop at 1.5 x FAR 23.473\'s limit sink (DMG-TUNE\'s hard landing)', kind: 'drop', o: { k473: 1.5, frames: 240 } },
  { id: 'trunk0', label: 'a trunk at 30 m/s, the centreline, 4 m AGL', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 0 }, want: 'severe' },
  { id: 'trunk25', label: 'a trunk at 30 m/s, the wing 2.5 m out, 4 m AGL', kind: 'trunk', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 2.5 } },
];
const WATER = [
  { id: 'far473w', label: 'the drop onto the water at FAR 23.473\'s limit sink', kind: 'drop', o: { k473: 1.0, frames: 240 }, want: 'unharmed' },
  { id: 'float-nosein', label: 'the float nose-in (90 km/h, 5 m/s, 20 deg; DMGWRECK\'s)', kind: 'water', o: { V: 90 / 3.6, sink: 5, pitch: 20, secs: 5 } },
  { id: 'nosein-water', label: 'a severe float nose-in (150 km/h, 10 m/s, 60 deg; DMGWRECK\'s)', kind: 'water', o: { V: 150 / 3.6, sink: 10, pitch: 60, secs: 5 } },
];
const ALL_BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats', 'cubFull'];
const casesOf = k => (/floats/i.test(k) ? WATER : k === 'cubFull' ? LAND.filter(c => ['taxi', 'far473', 'trunk0', 'trunk25'].includes(c.id)) : LAND);

function child(k) {
  const L = require('./_treecrash_lib.js');
  const C = L.core();
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  // the Cub with its rear seat filled: a build of its own (the same file, cabin.occupied [1, 1])
  if (k === 'cubFull' && !L.BUILDS.cubFull) L.BUILDS.cubFull = { label: 'Cub, the rear seat filled', build: L.BUILDS.cub.build, patch: j => { const s = j.spec || j; s.cabin = Object.assign({}, s.cabin, { occupied: [1, 1] }); return j; } };
  const out = { key: k, label: L.BUILDS[k].label, cases: [], rows: {} };
  const crit = c => c ? { dri: c.dri, xPk: c.xPk, yPk: c.yPk, zPk: c.zPk, dvX: c.dvX, dvZ: c.dvZ, eibX: c.eibX, eibY: c.eibY, far562: c.far562, restraint: c.restraint,
    space: c.space, cell: c.cell, parted: c.parted, by: c.by, rows: c.rows, samples: c.samples, spaceAt: c.spaceAt, cellAt: c.cellAt } : null;
  // one case flown; `trig` the record's trigger (null: the game's); `hop` the worker's hop read every frame
  const fly = (c, o) => {
    const T0 = C.GEN_OCC.trigG; if (o.trig != null) C.GEN_OCC.trigG = o.trig;
    const on0 = C.GEN_OCC.on; if (o.recOff) C.GEN_OCC.on = false;
    let hop = null, pay = [];
    const onStart = (sim) => { hop = SH.simOccHop(sim); };
    const onFrame = (sim) => { if (hop) { const x = hop(); if (x !== undefined) pay.push({ t: sim.t, x }); } };
    const oo = Object.assign({}, c.o, { onStart, onFrame }, o.elastic ? { elastic: true } : {});
    let r;
    try {
      if (c.kind === 'trunk') r = L.atTrunk(k, oo);
      else if (c.kind === 'drop') { const s473 = L.far473(k), dd = L.defOf(k), fwd = dd.params.gen.VsFlap || dd.params.gen.Vs; r = L.hardLanding(k, Object.assign({}, oo, { sink: c.o.k473 * s473, fwd })); }
      else r = L.waterCase(k, oo);
    } finally { C.GEN_OCC.trigG = T0; C.GEN_OCC.on = on0; }
    const sim = L.lastRun.sim, D = sim.damage(), O = sim.occupants ? sim.occupants() : null;
    const res = D.occ || null;
    const after = { hasOcc: !!O, occKey: 'occ' in D, buf: O ? !!O.state.buf : false, events: O ? O.state.events : 0, open: O ? O.state.st === 2 : false };
    const hash = fnv(sim.p, sim.v), DD = { crashed: D.crashed, reason: D.reason, gPeak: D.gPeak, breaks: D.breaks };
    // the reset: the hop says null once (the page drops the bands), then nothing
    let resetPay = [];
    if (hop && pay.length) { sim.reset(0); for (let f = 0; f < 3; f++) { const x = hop(); if (x !== undefined) resetPay.push(x); } }
    return { r, res, pay, resetPay, after, hash, D: DD };
  };
  for (const c of casesOf(k)) {
    const t0 = Date.now();
    const G = fly(c, {});
    const seats = G.res ? G.res.seats.map(s => ({ name: s.name, band: s.band, crit: crit(s.crit) })) : null;
    // the criteria behind an Unharmed with no record: the same case with the trigger at 1.5 g (a test setting)
    const M = !G.res || G.res.seats.every(s => s.band === 0) ? fly(c, { trig: 1.5 }) : null;
    const row = { id: c.id, label: c.label, want: c.want || null, D: G.D, seats, restraint: G.res ? G.res.restraint : null, restraintDefault: G.res ? G.res.restraintDefault : null,
      seatType: G.res ? G.res.seatType : null, events: G.after.events, open: G.after.open,
      wire: G.pay.map(p => p.x), wireN: G.pay.length, resetPay: G.resetPay,
      measured: M && M.res ? M.res.seats.map(s => ({ name: s.name, band: s.band, crit: crit(s.crit) })) : null,
      seatsAboard: (() => { const O = L.lastRun.sim.occupants(); return O ? O.spec.seats.map(s => s.name) : []; })(),
      secs: (Date.now() - t0) / 1000 };
    out.cases.push(row);
  }
  // 3. NOTHING WITHOUT THE LAYER (the centreline / the severe nose-in): damage OFF, the recorder off against on, twice
  const big = casesOf(k).find(c => c.want === 'severe') || casesOf(k)[casesOf(k).length - 1];
  const off = fly(big, { elastic: true });
  out.rows.off = { hasOcc: off.after.hasOcc, occKey: off.after.occKey, pay: off.pay.length, crashed: off.D.crashed };
  const on1 = fly(big, {}), on2 = fly(big, {}), rOff = fly(big, { recOff: true });
  out.rows.bits = { on: on1.hash, recOff: rOff.hash, again: on2.hash, recOffHasOcc: rOff.after.hasOcc,
    sameBands: JSON.stringify(on1.res && on1.res.seats.map(s => [s.band, s.crit.dri, s.crit.space, s.crit.cell])) === JSON.stringify(on2.res && on2.res.seats.map(s => [s.band, s.crit.dri, s.crit.space, s.crit.cell])) };
  // an intact flight: 30 s level at 400 m, damage ON - no record, no buffer
  if (!/floats/i.test(k)) {
    const def = L.defOf(k), { W, strip } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 400 }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), V = 1.5 * def.params.gen.Vs;
    for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = V * fx; sim.v[i * 3 + 2] = V * fz; }
    sim.ctl.thr = 0.7;
    const hop = SH.simOccHop(sim); let pays = 0;
    for (let f = 0; f < 30 * 60; f++) { sim.step(1 / 60); if (hop && hop() !== undefined) pays++; }
    const O = sim.occupants();
    out.rows.intact = { hasOcc: !!O, buf: O ? !!O.state.buf : null, events: O ? O.state.events : null, pays, armedN: sim.damage().armedN, y: sim.cgPos()[1] };
  }
  return out;
}

// ============================================================ THE PAGE (the crash card, under the physics worker)
async function pageChild() {
  const out = arg('out'), fault = arg('fault', '');
  const { openPage } = require('./_page_node.js');
  const R = { fault, t: {}, errors: [] };
  const t0 = Date.now();
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, 'builds/cub_2026-09-20_corrected.json'), 'utf8') };
  const P = await openPage({ quiet: true, storage, query: 'simw=1&damage=1', workers: /sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  R.t.garage = Date.now() - t0;
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 900000);
  const FP = W.FLIGHT_PROBE, SW = W.FLYDIY_SIMW || null;
  const RD = FP.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  const live = () => { const s = SW && SW.state(); return !!(s && s.phase === 'live' && s.flight && s.flight.live); };
  for (let i = 0; i < 600 && !live(); i++) await P.frames(1);
  R.live = live();
  if (!R.live) { R.errors = P.errors.slice(0, 20); fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); }
  W.FLYDIY_WRECK_FAST = true;
  FP.setManual(true);
  const sim = FP.sim(), world = FP.world();
  R.occView = 'occView' in sim;
  const [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl, V = 30, D = 40;
  const c = sim.cgPos(), g = world.terrainH(c[0], c[2]);
  let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
  let placed = false;
  FP.place({ at: [c[0], g + 4 + (c[1] - yMin), c[2]], zeroV: true, dv: [V * fx, 0, V * fz] }).then(() => { placed = true; });
  await P.until(() => placed, 60000);
  const c2 = sim.cgPos(), tx = c2[0] + fx * D, tz = c2[2] + fz * D, gt = world.terrainH(tx, tz);
  world.treeHits.set('fill:dmgocc', [tx, tz, gt, 0.3, gt + 10]);
  sim.ctl.thr = 0;
  const tA = sim.t, t1 = Date.now();
  // the flight runs to its card (the crash watched: the solver's 'over', the debris' rest, the hold - app.js G1868)
  let occAt = null;
  for (let f = 0; f < 60 * 40 && !FP.over(); f++) { await P.frames(1); if (occAt == null && sim.occView) occAt = +(sim.t - tA).toFixed(2); }
  R.t.crash = Date.now() - t1;
  R.over = FP.over(); R.simT = +(sim.t - tA).toFixed(2); R.occAt = occAt;
  R.occ = FP.occ ? FP.occ() : null;
  R.verdict = FP.damage() ? FP.damage().reason : null;
  const card = W.document.getElementById('arrCard');
  if (fault === 'word' && card) { const rows = W.document.getElementById('arrRows'); rows.innerHTML += '<div><span>Pilot</span><b>spinal fracture</b></div>'; }
  R.cardHidden = card ? !!card.hidden : null;
  R.cardWreck = card && card.classList ? card.classList.contains('wreck') : null;
  const rows = W.document.getElementById('arrRows');
  R.rows = rows ? Array.from(rows.querySelectorAll ? rows.querySelectorAll('div') : []).map(d => [d.querySelector('span') ? d.querySelector('span').textContent : '', d.querySelector('b') ? d.querySelector('b').textContent : '']) : null;
  R.rowsHTML = rows ? rows.innerHTML : null;
  R.cardText = card ? (card.textContent || '') : null;
  R.pageText = W.document.body ? (W.document.body.textContent || '') : '';
  const s1 = SW ? SW.state() : null;
  R.strays = s1 ? s1.strays : null; R.werr = s1 ? s1.errors : null;
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  R.mem = Math.round(process.memoryUsage().rss / 1048576);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
  process.exit(0);
}

// ============================================================ THE PARENT
function spawnJSON(args, tag) {
  const out = path.join(os.tmpdir(), 'dmgocc_' + process.pid + '_' + tag + '.json');
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000', __filename].concat(args, ['--out=' + out]), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: tag + ': child exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const J = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); return J;
}
async function spawnAll(list) {
  // the builds in parallel (one node each), the page beside them
  const { spawn } = require('child_process');
  return Promise.all(list.map(([args, tag]) => new Promise(res => {
    const out = path.join(os.tmpdir(), 'dmgocc_' + process.pid + '_' + tag + '.json');
    const p = spawn(process.execPath, ['--max-old-space-size=6000', __filename].concat(args, ['--out=' + out]), { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', code => { if (code !== 0 || !fs.existsSync(out)) return res({ failed: tag + ': child exit ' + code });
      const J = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); res(J); });
  })));
}

const f1 = x => x == null || !Number.isFinite(+x) ? '-' : (+x).toFixed(1), f2 = x => x == null || !Number.isFinite(+x) ? '-' : (+x).toFixed(2);
const critLine = c => !c ? '(no record)' : 'DRI ' + f1(c.dri) + ' | Eiband x ' + (c.eibX ? f2(c.eibX.vol) + '/' + f2(c.eibX.mod) : '-') + ', y ' + (c.eibY ? f2(c.eibY.vol) + '/' + f2(c.eibY.mod) : '-')
  + ' (voluntary/moderate) | peak x ' + f1(c.xPk) + ' y ' + f1(c.yPk) + ' z ' + f1(c.zPk) + ' g, dV x ' + f1(c.dvX) + ' z ' + f1(c.dvZ) + ' m/s' + (c.far562 ? ' PAST 23.562' : '')
  + ' | restraint ' + f1(c.restraint && c.restraint.load) + '/' + f1(c.restraint && c.restraint.strength) + ' g' + (c.restraint && c.restraint.failed ? ' FAILED' : '')
  + ' | space ' + f2(c.space) + ', cell x' + f2(c.cell) + (c.parted ? ', PARTED' : '') + ' | by ' + (c.by || '-');

// the judge of one build's numbers
function judgeBuild(B, say, bad) {
  if (B.failed) { bad(B.failed); return; }
  say('== ' + B.label + ' (' + B.key + ')');
  for (const c of B.cases) {
    const words = c.seats ? c.seats.map(s => s.name + ': ' + FIVE[s.band]).join(', ') : 'no record - every seat Unharmed';
    say('  ' + c.id.padEnd(13) + ' ' + words + '   [' + (c.D.crashed ? 'crashed: ' + c.D.reason : 'no crash') + '; contact ' + f1(c.D.gPeak) + ' g; ' + c.D.breaks + ' broken; ' + f1(c.secs) + ' s]');
    if (c.seats) for (const s of c.seats) say('      ' + s.name.padEnd(12) + ' ' + critLine(s.crit));
    if (c.measured) for (const s of c.measured) say('      (trigger 1.5 g) ' + s.name.padEnd(12) + ' ' + FIVE[s.band] + ' - ' + critLine(s.crit));
    // every seat aboard has a band, every band one of the five
    const bands = c.seats ? c.seats.map(s => s.band) : c.seatsAboard.map(() => 0);
    if (c.seats && c.seats.length !== c.seatsAboard.length) bad(B.key + ' ' + c.id + ': ' + c.seats.length + ' bands for ' + c.seatsAboard.length + ' seats aboard');
    if (!bands.every(b => Number.isInteger(b) && b >= 0 && b < 5)) bad(B.key + ' ' + c.id + ': a band outside the five ' + JSON.stringify(bands));
    for (const n of c.seatsAboard) if (!WHO.test(n)) bad(B.key + ' ' + c.id + ': a seat name the game does not say: ' + JSON.stringify(n));
    if (c.want === 'unharmed' && !bands.every(b => b === 0)) bad(B.key + ' ' + c.id + ' (' + c.label + ') must read Unharmed: ' + bands.map(b => FIVE[b]).join(', '));
    if (c.want === 'severe' && !(c.seats && c.seats.every(s => s.band >= 2))) bad(B.key + ' ' + c.id + ' (' + c.label + ') should read severe: ' + (c.seats ? c.seats.map(s => FIVE[s.band]).join(', ') : 'no record'));
    if (c.open) bad(B.key + ' ' + c.id + ': the event was still open when the case ended');
    // 4. the wire: one payload per close, { name, band } only, equal to the result's
    if (c.seats) {
      if (c.wireN !== c.events) bad(B.key + ' ' + c.id + ': ' + c.wireN + ' payloads for ' + c.events + ' closed events');
      const last = c.wire[c.wire.length - 1];
      if (!Array.isArray(last) || last.some(x => Object.keys(x).sort().join() !== 'band,name')) bad(B.key + ' ' + c.id + ': the wire carries more than { name, band }: ' + JSON.stringify(last));
      else if (JSON.stringify(last) !== JSON.stringify(c.seats.map(s => ({ name: s.name, band: s.band })))) bad(B.key + ' ' + c.id + ': the wire is not the result: ' + JSON.stringify(last));
      if (!(c.resetPay.length === 1 && c.resetPay[0] === null)) bad(B.key + ' ' + c.id + ': a reset must send null once: ' + JSON.stringify(c.resetPay));
    } else if (c.wireN) bad(B.key + ' ' + c.id + ': a payload with no record');
    if (c.seats && c.restraintDefault !== true) bad(B.key + ' ' + c.id + ': the restraint is not the stated default (the spec carries none): ' + c.restraint);
  }
  const R = B.rows;
  say('  damage OFF: occupants ' + (R.off.hasOcc ? 'PRESENT' : 'none') + ', damage().occ ' + (R.off.occKey ? 'PRESENT' : 'absent') + ', payloads ' + R.off.pay + '; '
      + 'the recorder on / off / again: ' + R.bits.on + ' / ' + R.bits.recOff + ' / ' + R.bits.again + (R.bits.sameBands ? ', the same bands and criteria' : ', DIFFERENT bands'));
  if (R.off.hasOcc || R.off.occKey || R.off.pay) bad(B.key + ': damage OFF - an occupants\' record exists');
  if (R.bits.on !== R.bits.recOff) bad(B.key + ': the recorder moved the physics (the bits with it differ from without)');
  if (R.bits.on !== R.bits.again || !R.bits.sameBands) bad(B.key + ': the same crash twice gave different answers');
  if (R.bits.recOffHasOcc) bad(B.key + ': GEN_OCC.on false still made a record');
  if (R.intact) {
    say('  an intact flight (30 s level, damage ON): buffers ' + (R.intact.buf ? 'ALLOCATED' : 'none') + ', events ' + R.intact.events + ', payloads ' + R.intact.pays + ', armed frames ' + R.intact.armedN + ', ' + f1(R.intact.y) + ' m up');
    if (R.intact.buf || R.intact.events || R.intact.pays) bad(B.key + ': an intact flight made a record');
  }
}
function judgePage(R, say, bad) {
  if (!R) return;
  if (R.failed) { bad(R.failed); return; }
  say('== the page (dev.html?simw=1&damage=1, the user\'s Cub under the physics worker, a trunk at 30 m/s)');
  say('  live ' + R.live + ', the mirror\'s occView ' + R.occView + '; the bands reached the page at ' + R.occAt + ' s; the card at ' + R.simT + ' s (over ' + R.over + '); verdict ' + JSON.stringify(R.verdict) + '; ' + (R.mem || '-') + ' MB');
  say('  the card\'s rows: ' + JSON.stringify(R.rows));
  if (!R.live) { bad('the page: the flight never went live under the worker ' + JSON.stringify(R.errors)); return; }
  if (!R.occView) bad('the page: the worker\'s mirror has no occView');
  if (!R.over || R.cardHidden !== false || !R.cardWreck) bad('the page: no crash card (over ' + R.over + ', hidden ' + R.cardHidden + ', wreck ' + R.cardWreck + ')');
  const occ = Array.isArray(R.occ) ? R.occ : [];
  if (!occ.length) bad('the page: no occupant band reached the card');
  // the occupants' lines: exactly one per occupant, its name and one of the five words
  const occRows = (R.rows || []).filter(([a]) => WHO.test(a));
  if (occRows.length !== occ.length) bad('the page: ' + occRows.length + ' occupant lines for ' + occ.length + ' occupants');
  for (const [a, b] of occRows) if (!FIVE.includes(b)) bad('the page: an occupant line that is not one of the five words: ' + JSON.stringify([a, b]));
  // the occupants' own lines with the body's parts too; the whole card and the page's text with the strong words
  const sc = scanText(occRows.map(r => r.join(' ')).join(' \n '), true).concat(scanText(R.cardText, false)), sp = scanText(R.pageText, false);
  say('  the scan: the card ' + (sc.length ? 'FOUND ' + JSON.stringify(sc) : 'clean') + '; the page\'s text ' + (sp.length ? 'FOUND ' + JSON.stringify(sp.slice(0, 10)) : 'clean') + ' (' + (R.pageText || '').length + ' chars)');
  if (sc.length) bad('the page: an injury word on the crash card: ' + JSON.stringify(sc));
  if (sp.length) bad('the page: an injury word in the page\'s text: ' + JSON.stringify(sp.slice(0, 10)));
  if (R.strays) bad('the page: the page\'s thread stepped the solver under the worker (strays ' + R.strays + ')');
  if ((R.errors || []).length || (R.werr || []).length) bad('the page: errors ' + JSON.stringify(R.errors).slice(0, 300) + ' worker ' + JSON.stringify(R.werr).slice(0, 200));
}
// the source: the five words, the card's own literals
function judgeSource(say, bad, mut) {
  const L = require('./_treecrash_lib.js'), C = L.core();
  const bands = mut && mut.bands ? mut.bands : C.GEN_OCC.bands;
  if (JSON.stringify(bands) !== JSON.stringify(FIVE)) bad('GEN_OCC.bands is not exactly the five words: ' + JSON.stringify(bands));
  let app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  if (mut && mut.src) app = app.replace('function occLines(occ) {', 'function occLines(occ) { const _x = "' + mut.src + '";');
  const lits = [];
  for (const fn of ['showArrival', 'occLines', 'drawArrNotes']) { const s = fnSource(app, fn); if (!s) { bad('app.js: ' + fn + ' not found'); continue; } lits.push(...literalsOf(s)); }
  const hits = scanText(lits.join(' \n '), false);   // (the strong words: the card's code also says a flight's 'leg')
  say('  the card\'s code (showArrival, occLines, drawArrNotes): ' + lits.length + ' string literals, ' + (hits.length ? 'FOUND ' + JSON.stringify(hits) : 'no injury word'));
  if (hits.length) bad('an injury word in the card\'s code: ' + JSON.stringify(hits));
  // the wire's shape (genOccWire on a result carrying its criteria)
  const fake = { seats: [{ name: 'Pilot', seat: 0, band: 2, crit: { dri: 20 } }] };
  const w = mut && mut.wire ? mut.wire(fake) : C.genOccWire(fake);
  if (w.some(x => Object.keys(x).sort().join() !== 'band,name')) bad('the wire carries more than { name, band }: ' + JSON.stringify(w));
}
// the criteria's numerics against closed forms (synthetic pulses)
function judgeMath(say, bad, mut) {
  const L = require('./_treecrash_lib.js'), C = L.core(), dt = 0.001;
  const zeta = mut && mut.zeta != null ? mut.zeta : C.GEN_OCC.dri.zeta, z0 = C.GEN_OCC.dri.zeta;
  C.GEN_OCC.dri.zeta = zeta;
  try {
    // a 10 g step held: DRI = 10 (1 + exp(-zeta pi / sqrt(1 - zeta^2)))
    const N = 600, step = new Float64Array(N).fill(10); for (let i = 0; i < 50; i++) step[i] = 0;
    const d = C.genOccDRI(step, dt).dri, want = 10 * (1 + Math.exp(-z0 * Math.PI / Math.sqrt(1 - z0 * z0)));
    say('  the DRI of a 10 g step: ' + d.toFixed(3) + ' (closed form ' + want.toFixed(3) + ')');
    if (Math.abs(d - want) > 0.02) bad('the DRI of a step is not its closed form: ' + d.toFixed(3) + ' vs ' + want.toFixed(3));
  } finally { C.GEN_OCC.dri.zeta = z0; }
  // a uniform 30 g pulse 0.1 s on x: its plateau 30 g at 0.1 s - Eiband voluntary 30/25, moderate 30/45
  const N = 1000, x = new Float64Array(N); for (let i = 200; i < 300; i++) x[i] = -30;
  const e = C.genOccEiband(x, dt, C.GEN_OCC.eiband.x, 1);
  say('  a 30 g, 0.1 s uniform pulse: Eiband voluntary ' + e.vol.toFixed(3) + ' at ' + e.wV + ' s, moderate ' + e.mod.toFixed(3) + ' at ' + e.wM + ' s (want 1.200 / 0.667 at 0.1 s)');
  if (Math.abs(e.vol - 1.2) > 1e-6 || Math.abs(e.mod - 30 / 45) > 1e-6 || e.wV !== 0.1) bad('the Eiband plateau of a uniform pulse is wrong');
  // FAR 23.562's own longitudinal pulse (a 26 g triangle, 42 ft/s): at the test - not past it; 10 % over both - past it
  const tri = (pk, dv) => { const T = 2 * dv / (pk * 9.81), n = Math.round(T / dt), a = new Float64Array(n + 200), k = new Float64Array(n + 200);
    for (let i = 0; i < n; i++) { const u = i / n, g = pk * (u < 0.5 ? 2 * u : 2 - 2 * u); a[100 + i] = -g; k[100 + i] = -g * 9.81; } return { a, k }; };
  const judge = (pk, dv) => { const P = tri(pk, dv), z = new Float64Array(P.a.length).fill(1), Z = new Float64Array(P.a.length);
    return C.genOccJudge({ N: P.a.length, dt, ax: P.a, ay: Z, az: z, kx: P.k, kz: Z, t0: 0 }, { row: 0, dynamic: false, restraint: 'harness', space: 1, cell: 1, parted: false }); };
  const at = judge(26 * 0.97, 12.8 * 0.97), past = judge(26 * 1.15, 12.8 * 1.1);
  say('  FAR 23.562\'s pulse just under the test (25.2 g, 12.4 m/s): past ' + at.far562 + ', ' + FIVE[at.band] + ' (by ' + at.by + '); 15 % over the peak and 10 % over the dV: past ' + past.far562 + ', ' + FIVE[past.band]);
  if (at.far562 || !past.far562) bad('FAR 23.562\'s reference row misjudges its own test pulse');
}

async function parent() {
  const say = m => console.log(m);
  if (argv.includes('--selftest')) {
    say('DMGOCCUPANT selftest: each row must turn red on its fault');
    const cases = [
      ['a forbidden word on a card\'s text', b => { const s = scanText('Pilot Heavy injuries Passenger spinal fracture', true); if (s.length) b('scan'); }],
      ['a body part on the card\'s text', b => { const s = scanText('Pilot Light injuries, leg', true); if (s.length) b('scan'); }],
      ['the five words alone are clean', b => { const s = scanText('Pilot Unharmed Co-pilot Light injuries Passenger 1 Heavy injuries Passenger 2 Life threatening Passenger 3 Fatal injuries', true); if (!s.length) b('clean'); }, true],
      ['an injury word in the card\'s code', b => judgeSource(() => {}, b, { src: 'concussion' })],
      ['a sixth band word', b => judgeSource(() => {}, b, { bands: FIVE.concat(['Bruised']) })],
      ['a criterion on the wire', b => judgeSource(() => {}, b, { wire: R => R.seats.map(s => ({ name: s.name, band: s.band, dri: s.crit.dri })) })],
      ['a wrong DRI damping', b => judgeMath(() => {}, b, { zeta: 0.3 })],
      ['an occupants\' record under damage OFF', b => judgeBuild({ key: 'x', label: 'fake', cases: [], rows: { off: { hasOcc: true, occKey: true, pay: 1 }, bits: { on: 'a', recOff: 'a', again: 'a', sameBands: true } } }, () => {}, b)],
      ['a recorder that moved the physics', b => judgeBuild({ key: 'x', label: 'fake', cases: [], rows: { off: { hasOcc: false, occKey: false, pay: 0 }, bits: { on: 'a', recOff: 'b', again: 'a', sameBands: true } } }, () => {}, b)],
    ];
    let ok = true;
    for (const [name, fn, wantClean] of cases) { const f = []; fn(m => f.push(m)); const red = f.length > 0; const pass = wantClean ? red : red;
      say('  ' + (pass ? 'ok  ' : 'FAIL') + '  ' + name + (wantClean ? ' (the control: must NOT be red)' : '') + ' -> ' + (red ? (wantClean ? 'clean' : 'red') : (wantClean ? 'RED' : 'NOT red')));
      if (!pass) ok = false; }
    // the page's scan on a card with a forbidden line appended (the page itself, under the worker)
    if (!argv.includes('--no-page')) {
      const R = spawnJSON(['--page', '--fault=word'], 'pagefault'), f = [];
      judgePage(R, () => {}, m => f.push(m));
      const red = f.some(m => /injury word on the crash card/.test(m));
      say('  ' + (red ? 'ok  ' : 'FAIL') + '  a forbidden line on the page\'s crash card -> ' + (red ? 'red' : 'NOT red') + (f.length ? ' (' + f.join(' | ').slice(0, 300) + ')' : ''));
      if (!red) ok = false;
    }
    console.log('GATE DMGOCCUPANT-SELFTEST: ' + (ok ? 'PASS' : 'FAIL'));
    process.exit(ok ? 0 : 1);
  }
  say('GATE DMGOCCUPANT (G2373-G2377) - each occupant\'s band after a crash: one of ' + JSON.stringify(FIVE) + ', the criteria behind it here only');
  const builds = (arg('builds', '') || ALL_BUILDS.join(',')).split(',').filter(Boolean);
  const jobs = builds.map(k => [['--build', k], k]);
  if (!argv.includes('--no-page')) jobs.push([['--page'], 'page']);
  const t0 = Date.now();
  const res = await spawnAll(jobs);
  const fails = [], bad = m => fails.push(m);
  say('== the source');
  judgeSource(say, bad);
  say('== the criteria\'s numerics');
  judgeMath(say, bad);
  const page = argv.includes('--no-page') ? null : res.pop();
  for (const B of res) judgeBuild(B, say, bad);
  judgePage(page, say, bad);
  say('== the table (bands only)');
  for (const B of res) if (!B.failed) say('  ' + B.label.padEnd(26) + B.cases.map(c => c.id + ': ' + (c.seats ? c.seats.map(s => s.name + ' ' + FIVE[s.band]).join(' / ') : 'Unharmed')).join(' | '));
  const o = arg('out'); if (o) fs.writeFileSync(o, JSON.stringify({ builds: res, page }, null, 1));
  for (const m of fails) say('  FAIL  ' + m);
  say('  (wall ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  console.log('GATE DMGOCCUPANT: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}

if (argv.includes('--page')) pageChild().catch(e => { console.error(e && e.stack || e); process.exit(2); });
else if (argv.includes('--build')) { const k = arg('build'); const J = child(k); fs.writeFileSync(arg('out'), JSON.stringify(J)); process.exit(0); }
else parent();
