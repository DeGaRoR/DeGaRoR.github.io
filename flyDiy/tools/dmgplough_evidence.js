#!/usr/bin/env node
// G1807-G1809 DMG-PLOUGH evidence: what GATE DMGPLOUGH measures, drawn, and what the plough wave costs.
//   --perf --perf-base <base's tools/flight_core.js>   sim.step(1/60), base / now child processes in alternating pairs,
//        the median of N processes' medians (600 steps each), and the pooled median of every step of every process:
//        the stock build's (the Cub, the metal Cessna; ground and air; nothing touching, damage off) and the water taxi's
//        (the twin and the Cessna on floats at idle on the SEA lane, 3 m/s across)
//   --bits --bits-base <base's tools/flight_core.js>    MD5 of the node positions and velocities after 600 frames, base
//        core vs this one: the land builds (dry air) and the floatplanes at the water taxi (the wave ships OFF: the base
//        to the bit), and the floatplanes with the wave ON (different, as they must be)
//   --plots <dmgplough.json>   trim.svg (the keel trim against the speed through the water: the twin as built, the twin
//        with the thrust at the nose frame, the twin with the wave on; the Cessna as built and with the wave on; the
//        8-12 deg band), law.svg (the wave's amplitude and its pitching moment against Fn on each float), sweep.svg
//        (the twin's lowest pitch against the crosswind, as built and instrumented)
//   --out <dir> (default reports/evidence/DMG-PLOUGH)
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-PLOUGH'));

function loadDef(L, C, key, wave) {
  let def;
  // G2031 (DMG-RECAL): the twin AS THE GAME FLIES IT (tools/_load_build.js `twinFloats`); FLYDIY_RAW_BUILDS=1: the fixture
  def = L.defOf(key === 'twin' ? 'twinFloats' : key === 'cessna' ? 'floats' : key, { elastic: true });
  def = Object.assign({}, def, { params: Object.assign({}, def.params) });
  delete def.params.damage;   // the stock build: the switch's default (off)
  if (wave && def.parts.floats) def.parts = Object.assign({}, def.parts, { floats: def.parts.floats.map(r => Object.assign({}, r, { P: Object.assign({}, r.P, { kWave: 1 }) })) });
  return def;
}
function caseSim(core, key, mode, wave) {
  const L = require(path.join(path.dirname(core), '_treecrash_lib.js'));
  const C = L.core(), def = loadDef(L, C, key, wave);
  let sim;
  if (key === 'twin' || key === 'cessna') {
    const world = C.makeWorld(); world.setWind({ base: [3, 0, 0], gust: 0 });
    const sea = world.aerodromes.find(a => a.id === 'SEA');
    sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
    sim.ctl.thr = mode === 'taxi' ? 0.15 : 0;
  } else {
    const { W, strip } = L.flatWorld(0);
    sim = C.makeSim(def, W); sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: mode === 'air' ? 300 : 0 }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), V = mode === 'air' ? 1.6 * def.params.gen.Vs : 0;
    if (V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
    sim.ctl.thr = mode === 'air' ? 0.75 : 0.3;
  }
  return sim;
}
if (argv[0] === '--perf-child') {
  const sim = caseSim(argv[1], argv[2], argv[3], false);
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  const ms = [];
  for (let f = 0; f < 600; f++) { const a = process.hrtime.bigint(); sim.step(1 / 60); ms.push(Number(process.hrtime.bigint() - a) / 1e6); }
  const sorted = ms.slice().sort((a, b) => a - b);
  console.log('PERF ' + JSON.stringify({ med: sorted[300], p90: sorted[540], mean: ms.reduce((a, b) => a + b, 0) / ms.length, all: ms.map(x => +x.toFixed(4)) }));
  process.exit(0);
}
if (argv[0] === '--bits-child') {
  const sim = caseSim(argv[1], argv[2], argv[3], argv[4] === 'wave');
  for (let f = 0; f < 600; f++) sim.step(1 / 60);
  const h = crypto.createHash('md5'); h.update(Buffer.from(Float64Array.from(sim.p).buffer)); h.update(Buffer.from(Float64Array.from(sim.v).buffer));
  console.log('BITS ' + h.digest('hex'));
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });
const { spawnSync } = require('child_process');
const mine = path.join(__dirname, 'flight_core.js');

if (argv.includes('--perf')) {
  const base = opt('perf-base', null), reps = +opt('perf-reps', 11);
  const one = (core, k, mode) => { const r = spawnSync(process.execPath, [__filename, '--perf-child', core, k, mode], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); return l ? JSON.parse(l.slice(5)) : null; };
  const P = {}, lines = [];
  const CASES = opt('perf-cases', 'cub:ground,cub:air,metal:ground,metal:air,twin:taxi,cessna:taxi').split(',').map(c => c.split(':'));
  for (const [k, mode] of CASES) {
    const rows = { base: [], mine: [] };
    // alternating PAIRS, the order flipped every pair (base-now, now-base, ...)
    for (let rep = 0; rep < reps; rep++) {
      if (rep % 2 === 0) { rows.base.push(one(base, k, mode)); rows.mine.push(one(mine, k, mode)); }
      else { rows.mine.push(one(mine, k, mode)); rows.base.push(one(base, k, mode)); }
    }
    const med = a => { const v = a.filter(Boolean).map(x => x.med).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
    const pooled = a => { const v = [].concat(...a.filter(Boolean).map(x => x.all)).sort((x, y) => x - y); return v[v.length >> 1]; };
    const b = med(rows.base), n = med(rows.mine), pb = pooled(rows.base), pn = pooled(rows.mine);
    P[k + ':' + mode] = { base: b, now: n, pct: (n / b - 1) * 100, pooledBase: pb, pooledNow: pn, pooledPct: (pn / pb - 1) * 100,
                          procs: { base: rows.base.map(x => x && x.med), now: rows.mine.map(x => x && x.med) } };
    const line = `${k} ${mode}: base ${b.toFixed(4)} ms, now ${n.toFixed(4)} ms, ${((n / b - 1) * 100).toFixed(2)} % (the median of ${reps} processes' medians); pooled ${pb.toFixed(4)} -> ${pn.toFixed(4)} ms, ${((pn / pb - 1) * 100).toFixed(2)} % (every step of every process); alternating pairs, 600 steps each`;
    lines.push(line); console.log('perf ' + line);
  }
  const tag = opt('perf-tag', '');
  fs.writeFileSync(path.join(OUT, 'perf' + tag + '.json'), JSON.stringify(P, null, 1));
  fs.writeFileSync(path.join(OUT, 'perf' + tag + '.txt'), lines.join('\n') + '\n');
}
if (argv.includes('--bits')) {
  const base = opt('bits-base', null);
  const one = (core, k, mode, w) => { const r = spawnSync(process.execPath, [__filename, '--bits-child', core, k, mode, w || ''], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('BITS ')); return l ? l.slice(5) : 'ERR ' + (r.stderr || '').slice(-300); };
  const lines = [];
  for (const [k, mode, w] of [['cub', 'ground'], ['cub', 'air'], ['metal', 'ground'], ['metal', 'air'], ['jodel', 'ground'], ['twin', 'taxi'], ['cessna', 'taxi'], ['twin', 'taxi', 'wave'], ['cessna', 'taxi', 'wave']]) {
    const b = one(base, k, mode), n = one(mine, k, mode, w);
    const line = `${k} ${mode}${w ? ' (the wave ON on this core)' : ''}: base ${b} now ${n} ${b === n ? 'IDENTICAL' : 'DIFFERENT'}`;
    lines.push(line); console.log('bits ' + line);
  }
  fs.writeFileSync(path.join(OUT, 'bits.txt'), lines.join('\n') + '\n');
}

// ---- plots (plain SVG, no library) ----------------------------------------------------------------------------------
function svgChart(o) {
  const W = 760, Hh = 420, m = { l: 56, r: 170, t: 34, b: 44 };
  const pw = W - m.l - m.r, ph = Hh - m.t - m.b;
  const sx = x => m.l + (x - o.x0) / (o.x1 - o.x0) * pw, sy = y => m.t + ph - (y - o.y0) / (o.y1 - o.y0) * ph;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" font-family="sans-serif" font-size="12"><rect width="${W}" height="${Hh}" fill="#fff"/>`;
  s += `<text x="${m.l}" y="20" font-size="14" font-weight="bold">${o.title}</text>`;
  if (o.band) s += `<rect x="${m.l}" y="${sy(o.band[1])}" width="${pw}" height="${sy(o.band[0]) - sy(o.band[1])}" fill="#2a9d8f" opacity="0.12"/><text x="${m.l + 4}" y="${sy(o.band[1]) + 13}" fill="#2a9d8f">${o.bandLabel}</text>`;
  for (let i = 0; i <= 5; i++) { const y = o.y0 + (o.y1 - o.y0) * i / 5, x = o.x0 + (o.x1 - o.x0) * i / 5;
    s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(y)}" y2="${sy(y)}" stroke="#ddd"/><text x="${m.l - 6}" y="${sy(y) + 4}" text-anchor="end">${+y.toFixed(2)}</text>`;
    s += `<text x="${sx(x)}" y="${m.t + ph + 16}" text-anchor="middle">${+x.toFixed(2)}</text>`; }
  if (o.y0 < 0 && o.y1 > 0) s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(0)}" y2="${sy(0)}" stroke="#888"/>`;
  s += `<text x="${m.l + pw / 2}" y="${Hh - 8}" text-anchor="middle">${o.xl}</text><text transform="translate(14 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle">${o.yl}</text>`;
  o.series.forEach((se, i) => {
    const pts = se.pts.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(p => `${sx(Math.max(o.x0, Math.min(o.x1, p[0]))).toFixed(1)},${sy(Math.max(o.y0, Math.min(o.y1, p[1]))).toFixed(1)}`).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="${se.c}" stroke-width="1.8"${se.dash ? ' stroke-dasharray="5 3"' : ''}/>`;
    s += `<line x1="${m.l + pw + 12}" x2="${m.l + pw + 34}" y1="${m.t + 10 + i * 18}" y2="${m.t + 10 + i * 18}" stroke="${se.c}" stroke-width="2"${se.dash ? ' stroke-dasharray="5 3"' : ''}/><text x="${m.l + pw + 38}" y="${m.t + 14 + i * 18}">${se.name}</text>`;
  });
  return s + '</svg>';
}
if (argv.includes('--plots')) {
  const J = JSON.parse(fs.readFileSync(opt('plots', path.join(OUT, 'dmgplough.json')), 'utf8'));
  const C = ['#264653', '#e76f51', '#2a9d8f', '#e9c46a', '#8338ec', '#6c757d'];
  if (J.hump) {
    // the calm take-off: keel trim against the speed through the water, while on the water (run columns: T, V, R/W, keel trim, pitch, Fn, a)
    const ser = [['twin:base', 'twin as built', C[0]], ['twin:thrustcg', 'twin, thrust at nose (instr.)', C[2]], ['twin:wave', 'twin, wave ON', C[1], true],
                 ['cessna:base', 'Cessna as built', C[4]], ['cessna:wave', 'Cessna, wave ON', C[3], true]]
      .filter(([k]) => J.hump[k]).map(([k, name, c, dash]) => ({ name, c, dash, pts: J.hump[k].curve.map(r => [r[1], r[3]]) }));
    fs.writeFileSync(path.join(OUT, 'trim.svg'), svgChart({ title: 'The calm take-off: the float keel trim on the water run', xl: 'speed through the water (m/s)', yl: 'keel trim (deg, nose-up +)', x0: 0, x1: 26, y0: -40, y1: 25, band: [8, 12], bandLabel: 'tank band at the hump, 8-12 deg (recalled)', series: ser }));
  }
  if (J.law) {
    const ser = [];
    J.law.forEach((r, i) => { ser.push({ name: `${r.key}: amplitude x100 (m)`, c: C[i * 2], pts: r.curve.map(x => [x.Fn, x.a * 100]) }); ser.push({ name: `${r.key}: moment /100 (N m)`, c: C[i * 2 + 1], dash: true, pts: r.curve.map(x => [x.Fn, -x.dM / 100]) }); });
    fs.writeFileSync(path.join(OUT, 'law.svg'), svgChart({ title: 'The plough wave (forced ON) against Fn on each float, keel 4 deg at rest draft', xl: 'Fn = U / sqrt(g L_wl)', yl: 'amplitude (cm) / moment (hN m, nose-up +)', x0: 0, x1: 1.6, y0: -30, y1: 60, series: ser }));
  }
  if (J.sweep) {
    const ser = [['twin', 'base', 'twin as built', C[0]], ['twin', 'thrustcg', 'twin, thrust at nose (instr.)', C[2]], ['cessna', 'base', 'Cessna as built', C[4]]]
      .map(([k, m, name, c]) => ({ name, c, pts: J.sweep.filter(r => r.key === k && r.mode === m).sort((a, b) => a.wind - b.wind).map(r => [r.wind, r.pitchMin]) }));
    fs.writeFileSync(path.join(OUT, 'sweep.svg'), svgChart({ title: 'The crosswind take-off: the lowest pitch on the water run', xl: 'crosswind (m/s)', yl: 'lowest pitch (deg)', x0: 0, x1: 5, y0: -90, y1: 10, series: ser }));
  }
  console.log('plots written to ' + OUT);
}
