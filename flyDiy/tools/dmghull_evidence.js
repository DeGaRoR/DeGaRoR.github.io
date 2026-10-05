#!/usr/bin/env node
// G1849 DMG-HULL evidence: what GATE DMGHULL measures, drawn, and what it costs.
//   --perf --perf-base <base's tools/flight_core.js>   sim.step(1/60), alternating base / now child processes, the
//        median of N processes' medians (600 steps each): the stock build's (the Cub, the metal Cessna; ground and air;
//        nothing touching, damage off) and the water taxi's (the twin and the Cessna on floats at idle on the SEA lane,
//        3 m/s across)
//   --bits --bits-base <base's tools/flight_core.js>    MD5 of the node positions and velocities after 600 frames, base
//        core vs this one: the land builds (dry air: G1847 never runs) and the floatplanes with kSide 0 (the term off is
//        the base to the bit)
//   --plots <dmghull.json (now)> [<dmghull.json (base)>]  side_force.svg (the side force against the slip angle, each
//        float at its hump and on its step, against the base's panels), heading_<w>.svg (the twin's crosswind take-off
//        at 2 / 4 / 5 m/s: heading swing and pitch, base and now)
//   --out <dir> (default reports/evidence/DMG-HULL)
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-HULL'));

function loadDef(L, C, key, kSide0) {
  let def;
  if (key === 'twin') {
    const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json'), 'utf8')).spec;
    spec.gear.type = 'floats';
    def = C.buildGen(C.genMigrateSpec(spec));
  } else def = L.defOf(key === 'cessna' ? 'floats' : key, { elastic: true });
  def = Object.assign({}, def, { params: Object.assign({}, def.params) });
  delete def.params.damage;   // the stock build: the switch's default (off)
  if (kSide0 && def.parts.floats) def.parts = Object.assign({}, def.parts, { floats: def.parts.floats.map(r => Object.assign({}, r, { P: Object.assign({}, r.P, { kSide: 0 }) })) });
  return def;
}
// one case's sim, placed: land builds on a flat strip (ground / air), the floatplanes on the SEA lane
function caseSim(core, key, mode, kSide0) {
  const L = require(path.join(path.dirname(core), '_treecrash_lib.js'));
  const C = L.core(), def = loadDef(L, C, key, kSide0);
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
  const sim = caseSim(argv[1], argv[2], argv[3], !!process.env.DMGHULL_K0);   // DMGHULL_K0: the term off on this core (its own cost, same code)
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  const ms = [];
  for (let f = 0; f < 600; f++) { const a = process.hrtime.bigint(); sim.step(1 / 60); ms.push(Number(process.hrtime.bigint() - a) / 1e6); }
  ms.sort((a, b) => a - b);
  console.log('PERF ' + JSON.stringify({ med: ms[300], p90: ms[540], mean: ms.reduce((a, b) => a + b, 0) / ms.length }));
  process.exit(0);
}
if (argv[0] === '--bits-child') {
  const sim = caseSim(argv[1], argv[2], argv[3], argv[4] === 'k0');
  for (let f = 0; f < 600; f++) sim.step(1 / 60);
  const h = crypto.createHash('md5'); h.update(Buffer.from(Float64Array.from(sim.p).buffer)); h.update(Buffer.from(Float64Array.from(sim.v).buffer));
  console.log('BITS ' + h.digest('hex'));
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });
const { spawnSync } = require('child_process');
const mine = path.join(__dirname, 'flight_core.js');

if (argv.includes('--perf')) {
  const base = opt('perf-base', null), reps = +opt('perf-reps', 9);
  const one = (core, k, mode) => { const r = spawnSync(process.execPath, [__filename, '--perf-child', core, k, mode], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); return l ? JSON.parse(l.slice(5)) : null; };
  const P = {};
  const lines = [];
  const CASES = opt('perf-cases', 'cub:ground,cub:air,metal:ground,metal:air,twin:taxi,cessna:taxi').split(',').map(c => c.split(':'));
  for (const [k, mode] of CASES) {
    const rows = { base: [], mine: [] };
    for (let rep = 0; rep < reps; rep++) { rows.base.push(one(base, k, mode)); rows.mine.push(one(mine, k, mode)); }
    const med = a => { const v = a.filter(Boolean).map(x => x.med).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
    const b = med(rows.base), n = med(rows.mine);
    P[k + ':' + mode] = { base: b, now: n, pct: (n / b - 1) * 100, runs: rows };
    const line = `${k} ${mode}: base ${b.toFixed(4)} ms, now ${n.toFixed(4)} ms, ${((n / b - 1) * 100).toFixed(2)} % (the median of ${reps} processes' medians, 600 steps each, alternating)`;
    lines.push(line); console.log('perf ' + line);
  }
  const tag = opt('perf-tag', '');
  fs.writeFileSync(path.join(OUT, 'perf' + tag + '.json'), JSON.stringify(P, null, 1));
  fs.writeFileSync(path.join(OUT, 'perf' + tag + '.txt'), lines.join('\n') + '\n');
}
if (argv.includes('--bits')) {
  const base = opt('bits-base', null);
  const one = (core, k, mode, k0) => { const r = spawnSync(process.execPath, [__filename, '--bits-child', core, k, mode, k0 || ''], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('BITS ')); return l ? l.slice(5) : 'ERR ' + (r.stderr || '').slice(-300); };
  const lines = [];
  for (const [k, mode, k0] of [['cub', 'ground'], ['cub', 'air'], ['metal', 'ground'], ['metal', 'air'], ['jodel', 'ground'], ['twin', 'taxi', 'k0'], ['cessna', 'taxi', 'k0'], ['twin', 'taxi'], ['cessna', 'taxi']]) {
    const b = one(base, k, mode), n = one(mine, k, mode, k0);
    const line = `${k} ${mode}${k0 ? ' (kSide 0)' : ''}: base ${b} now ${n} ${b === n ? 'IDENTICAL' : 'DIFFERENT'}`;
    lines.push(line); console.log('bits ' + line);
  }
  fs.writeFileSync(path.join(OUT, 'bits.txt'), lines.join('\n') + '\n');
}

// ---- the plots ---------------------------------------------------------------------------------------------------
const PLOTS = argv.indexOf('--plots');
if (PLOTS >= 0) {
  const now = JSON.parse(fs.readFileSync(argv[PLOTS + 1], 'utf8'));
  const baseP = argv[PLOTS + 2] && !argv[PLOTS + 2].startsWith('--') ? JSON.parse(fs.readFileSync(argv[PLOTS + 2], 'utf8')) : null;
  const COL = { a: '#2a6fdb', b: '#d9822b', c: '#2e9e5b', d: '#b34fb3', grid: '#c8ccd2', ink: '#333' };
  const svg = (W, H, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif" font-size="12"><rect width="${W}" height="${H}" fill="#fff"/><text x="12" y="20" font-size="14" fill="${COL.ink}">${title}</text>${body}</svg>`;
  const axes = (x0, y0, w, h, xr, yr, xl, yl, xt, yt) => {
    const X = x => x0 + (x - xr[0]) / (xr[1] - xr[0]) * w, Y = y => y0 + h - (y - yr[0]) / (yr[1] - yr[0]) * h;
    let b = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="${COL.grid}"/>`;
    for (const t of xt) b += `<line x1="${X(t)}" y1="${y0}" x2="${X(t)}" y2="${y0 + h}" stroke="${COL.grid}" stroke-width="0.5"/><text x="${X(t)}" y="${y0 + h + 14}" text-anchor="middle" fill="${COL.ink}">${t}</text>`;
    for (const t of yt) b += `<line x1="${x0}" y1="${Y(t)}" x2="${x0 + w}" y2="${Y(t)}" stroke="${COL.grid}" stroke-width="0.5"/><text x="${x0 - 4}" y="${Y(t) + 4}" text-anchor="end" fill="${COL.ink}">${t}</text>`;
    b += `<text x="${x0 + w / 2}" y="${y0 + h + 30}" text-anchor="middle" fill="${COL.ink}">${xl}</text><text x="${x0 - 40}" y="${y0 + h / 2}" text-anchor="middle" fill="${COL.ink}" transform="rotate(-90 ${x0 - 40} ${y0 + h / 2})">${yl}</text>`;
    return { b, X, Y };
  };
  const poly = (pts, X, Y, col, dash) => `<polyline fill="none" stroke="${col}" stroke-width="1.8"${dash ? ' stroke-dasharray="5 3"' : ''} points="${pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
  const ticks = (lo, hi, n) => { const s = (hi - lo) / n, o = []; for (let i = 0; i <= n; i++) o.push(+(lo + i * s).toPrecision(3)); return o; };
  // side force vs slip
  if (now.law) {
    let body = '', x0 = 80;
    const panels = [];
    for (const r of now.law) for (const where of ['hump', 'step']) if (r.curves[where]) panels.push({ r, where, c: r.curves[where] });
    const W = 80 + panels.length * 300, H = 360;
    panels.forEach((P, i) => {
      const ymax = Math.max(...P.c.map(x => Math.max(x[1], Math.min(x[2], 3 * Math.max(...P.c.map(y => y[1])))))) * 1.1;
      const A = axes(x0 + i * 300, 50, 240, 240, [0, 90], [0, ymax], 'slip angle (deg)', i === 0 ? 'lateral force on one float (N)' : '', [0, 15, 30, 45, 60, 75, 90], ticks(0, ymax, 4));
      body += A.b + poly(P.c.map(x => [x[0], x[1]]), A.X, A.Y, COL.a) + poly(P.c.map(x => [x[0], Math.min(x[2], ymax)]), A.X, A.Y, COL.b, true) + poly(P.c.map(x => [x[0], Math.min(x[1] + x[2], ymax)]), A.X, A.Y, COL.c);
      const ps = P.r[P.where];
      body += `<text x="${x0 + i * 300}" y="44" fill="${COL.ink}">${P.r.key === 'twin' ? 'twin' : 'Cessna'}, ${P.where}: ${ps.U.toFixed(1)} m/s, keel ${ps.draft.toFixed(2)} m, ${ps.trim.toFixed(1)} deg</text>`;
    });
    body += `<text x="80" y="${H - 14}" fill="${COL.a}">G1847 side force (pi/2 rho T^2 U v per station; Jones' sin b cos b)</text><text x="460" y="${H - 14}" fill="${COL.b}">the base's panels (cross-flow, planing bottom) - dashed, clipped</text><text x="900" y="${H - 14}" fill="${COL.c}">sum</text>`;
    fs.writeFileSync(path.join(OUT, 'side_force.svg'), svg(W, H, body, 'DMG-HULL G1847: the float\'s lateral force against the slip angle at a fixed speed (rigid bench, as GATE DMGHULL measures it)'));
  }
  // heading traces
  if (now.sweep) for (const w of [2, 4, 5]) {
    const n = now.sweep.find(r => r.key === 'twin' && r.wind === w && r.tr), b = baseP && baseP.sweep && baseP.sweep.find(r => r.key === 'twin' && r.wind === w && r.tr);
    if (!n) continue;
    const tmax = 15;
    const A = axes(80, 50, 640, 220, [0, tmax], [-180, 180], 't (s)', 'heading swing (deg)', [0, 3, 6, 9, 12, 15], [-180, -90, -30, 0, 30, 90, 180]);
    const Bp = axes(80, 340, 640, 160, [0, tmax], [-90, 30], 't (s)', 'pitch (deg)', [0, 3, 6, 9, 12, 15], [-90, -60, -30, 0, 30]);
    const cut = tr => tr.filter(x => x[0] <= tmax);
    let body = A.b + Bp.b;
    if (b) body += poly(cut(b.tr).map(x => [x[0], x[1]]), A.X, A.Y, COL.b) + poly(cut(b.tr).map(x => [x[0], Math.max(-90, x[2])]), Bp.X, Bp.Y, COL.b);
    body += poly(cut(n.tr).map(x => [x[0], x[1]]), A.X, A.Y, COL.a) + poly(cut(n.tr).map(x => [x[0], Math.max(-90, x[2])]), Bp.X, Bp.Y, COL.a);
    const cls = r => r.ok ? `lift-off ${r.lift.toFixed(1)} s, swing ${r.swing.toFixed(1)} deg` : r.noseOver ? `NOSE-OVER (pitch ${r.pitchMin.toFixed(0)} deg)` : r.yawLoop ? 'YAW LOOP' : 'fail';
    body += `<text x="80" y="535" fill="${COL.a}">now (G1847): ${cls(n)}</text>` + (b ? `<text x="420" y="535" fill="${COL.b}">base (DMG-DAMP, no side force): ${cls(b)}</text>` : '');
    fs.writeFileSync(path.join(OUT, `heading_${w}.svg`), svg(760, 550, body, `DMG-HULL: the twin on floats, ${w} m/s across - heading swing and pitch`));
  }
}
