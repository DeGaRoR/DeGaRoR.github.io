#!/usr/bin/env node
// DMG-TYRE evidence (G1844-G1846) -> reports/evidence/DMG-TYRE/
//   slip.svg            the side force against the slip angle per tyre class, measured in the solver (GATE DMGTYRE's part 1,
//                       read from its --json line: `node tools/_dmgtyre_check.js --json > x` then --gate-json x)
//   rollout_<w>.csv     the user's Cub's crosswind roll-out at w = 3, 4, 5 m/s straight across HOME, flown by THE PILOT
//                       (tools/pilot_trace.js --csv), on the BASE core (--base: DMG-DAMP's, the Coulomb tyre) and on this one
//   rollout.svg         the roll-out's heading error against the time from touchdown, before / after, per wind
//   rollout.json        the summaries (pilot_trace's JSON line) before / after
//   perf.json/.txt      sim.step(1/60) of the Cub and the metal Cessna (damage off, the default), nothing touching: parked,
//                       taxiing at 8 m/s (the new term's own branch), in the air; the base core against this one in
//                       ALTERNATING child processes, the median of the processes' medians (600 steps each)
// Run: node tools/dmgtyre_evidence.js --base <base's tools/flight_core.js> [--gate-json f] [--no-perf] [--no-traces] [--perf-reps N]
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-TYRE');

// ---- the perf child: sim.step(1/60), nothing touching ----
if (argv[0] === '--perf-child') {
  const core = argv[1], key = argv[2], mode = argv[3];
  const L = require(path.join(path.dirname(core), '_treecrash_lib.js'));
  const C = L.core(), def = L.defOf(key, { elastic: true }), { W, strip } = L.flatWorld(0);
  delete def.params.damage;                                   // the stock build: the switch's default (off)
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: mode === 'air' ? 300 : 0 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), V = mode === 'air' ? 1.6 * def.params.gen.Vs : mode === 'taxi' ? 8 : 0;
  if (V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
  sim.ctl.thr = mode === 'air' ? 0.75 : mode === 'taxi' ? 0.35 : 0.3;
  if (mode === 'taxi') sim.ctl.dr = 0.1;
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  const ms = [];
  for (let f = 0; f < 600; f++) { const a = process.hrtime.bigint(); sim.step(1 / 60); ms.push(Number(process.hrtime.bigint() - a) / 1e6); }
  ms.sort((a, b) => a - b);
  console.log('PERF ' + JSON.stringify({ med: ms[300], p90: ms[540], mean: ms.reduce((a, b) => a + b, 0) / ms.length }));
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const BASE = opt('base', null), MINE = path.join(__dirname, 'flight_core.js');
const COL = { before: '#2a78d6', after: '#eb6834', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', surf: '#fcfcfb', c3: '#1f9e6e', c4: '#8a5cd6', c5: '#c23b6b' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${COL.surf}"/>${body}</svg>`;
// one panel: series [{ pts: [[x, y]], col, dash, label }]
function panel(x0, y0, w, h, xr, yr, series, o) {
  const X = x => x0 + (x - xr[0]) / (xr[1] - xr[0]) * w, Y = y => y0 + h - (y - yr[0]) / (yr[1] - yr[0]) * h;
  let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="${COL.grid}"/>`;
  for (const t of o.xt) s += `<line x1="${X(t)}" y1="${y0}" x2="${X(t)}" y2="${y0 + h}" stroke="${COL.grid}"/><text x="${X(t)}" y="${y0 + h + 14}" font-size="10" fill="${COL.ink2}" text-anchor="middle">${t}</text>`;
  for (const t of o.yt) s += `<line x1="${x0}" y1="${Y(t)}" x2="${x0 + w}" y2="${Y(t)}" stroke="${COL.grid}"/><text x="${x0 - 4}" y="${Y(t) + 3}" font-size="10" fill="${COL.ink2}" text-anchor="end">${t}</text>`;
  for (const b of o.bands || []) s += `<line x1="${x0}" y1="${Y(b.y)}" x2="${x0 + w}" y2="${Y(b.y)}" stroke="${b.col}" stroke-dasharray="2 3"/><text x="${x0 + w - 2}" y="${Y(b.y) - 3}" font-size="9" fill="${b.col}" text-anchor="end">${esc(b.label)}</text>`;
  const clip = 'c' + Math.round(x0) + '_' + Math.round(y0);
  s += `<clipPath id="${clip}"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/></clipPath>`;
  for (const sr of series) s += `<polyline clip-path="url(#${clip})" fill="none" stroke="${sr.col}" stroke-width="1.8"${sr.dash ? ` stroke-dasharray="${sr.dash}"` : ''} points="${sr.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
  s += `<text x="${x0}" y="${y0 - 6}" font-size="12" fill="${COL.ink}">${esc(o.title)}</text>`;
  s += `<text x="${x0 + w / 2}" y="${y0 + h + 28}" font-size="10" fill="${COL.ink2}" text-anchor="middle">${esc(o.xl)}</text>`;
  s += `<text x="${x0 - 30}" y="${y0 + h / 2}" font-size="10" fill="${COL.ink2}" text-anchor="middle" transform="rotate(-90 ${x0 - 30} ${y0 + h / 2})">${esc(o.yl)}</text>`;
  let ly = y0 + 12;
  for (const sr of series.filter(q => q.label)) { s += `<line x1="${x0 + 8}" y1="${ly - 3}" x2="${x0 + 26}" y2="${ly - 3}" stroke="${sr.col}" stroke-width="2"${sr.dash ? ` stroke-dasharray="${sr.dash}"` : ''}/><text x="${x0 + 30}" y="${ly}" font-size="10" fill="${COL.ink}">${esc(sr.label)}</text>`; ly += 13; }
  return s;
}

// ---- the side force against the slip ----
const GJ = opt('gate-json', null);
if (GJ) {
  const line = fs.readFileSync(GJ, 'utf8').split('\n').find(l => l.startsWith('JSON '));
  const res = JSON.parse(line.slice(5));
  const pick = [['cub:tundra', COL.c3, null, 'tundra balloon, cN 4.5 /rad'], ['cub:standard', COL.after, null, 'standard main / nose wheel, cN 8'],
                ['cub:slim', COL.c4, null, 'slim main / tailwheel, cN 10'], ['metal:nosewheel', COL.ink2, '1 3', 'metal Cessna, every wheel cN 8 (tricycle)'],
                ['cub:coulomb', COL.before, '5 3', 'BEFORE: Coulomb at 0.02 m/s (10 m/s)']];
  const series = pick.filter(p => res.slip[p[0]]).map(([k, col, dash, label]) => ({ col, dash, label, pts: res.slip[k].beta.map((b, i) => [b, res.slip[k].FW[i]]) }));
  const zoom = series.map(s => Object.assign({}, s, { pts: s.pts.filter(p => p[0] <= 12) }));
  const body = panel(70, 40, 420, 300, [0, 45], [0, 0.9], series, { title: 'Side force / weight against the slip angle (10 m/s, grass mu 0.8; measured in the solver)', xl: 'slip angle beta (deg)', yl: 'F_y / W', xt: [0, 5, 10, 15, 20, 30, 45], yt: [0, 0.2, 0.4, 0.6, 0.8], bands: [{ y: 0.8, col: COL.ink2, label: 'mu N' }] })
             + panel(570, 40, 360, 300, [0, 12], [0, 0.9], zoom, { title: 'the first 12 deg', xl: 'slip angle beta (deg)', yl: 'F_y / W', xt: [0, 2, 4, 6, 8, 10, 12], yt: [0, 0.2, 0.4, 0.6, 0.8], bands: [] });
  fs.writeFileSync(path.join(OUT, 'slip.svg'), svgDoc(960, 390, body, 'DMG-TYRE: side force against slip angle per tyre class'));
  fs.writeFileSync(path.join(OUT, 'slip.json'), JSON.stringify(res.slip, null, 1));
  console.log('slip.svg written');
}

// ---- the roll-out traces, before / after ----
const WINDS = [3, 4, 5];
function trace(core, w, csv) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(__dirname, 'pilot_trace.js'), path.join(__dirname, '..', 'builds', 'cub_2026-09-20_corrected.json'),
                    '--wind', '0,' + w, '--core', core, '--csv', csv, '--quiet'], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => out += d);
    p.on('close', () => { const l = out.trim().split('\n'); try { resolve(JSON.parse(l[l.length - 1])); } catch (e) { resolve({ error: out.slice(-300) }); } });
  });
}
function rollTrace(csv) {
  const rows = fs.readFileSync(csv, 'utf8').split('\n').slice(1).map(l => l.split(','));
  const i0 = rows.findIndex(r => r[1] === 'ROLLOUT');
  if (i0 < 0) return [];
  return rows.slice(Math.max(0, i0 - 20)).filter(r => ['FLARE', 'ROLLOUT', 'STOPPED'].includes(r[1])).map(r => [+r[0] - +rows[i0][0], +r[8], +r[4], +r[13]]);
}
async function traces() {
  if (!BASE) { console.log('no --base: the traces need the base core'); return; }
  const jobs = [];
  for (const w of WINDS) for (const [tag, core] of [['before', BASE], ['after', MINE]]) jobs.push({ w, tag, core, csv: path.join(OUT, `rollout_${w}_${tag}.csv`) });
  const res = {};
  // three at a time
  for (let k = 0; k < jobs.length; k += 3) {
    const part = jobs.slice(k, k + 3);
    const rs = await Promise.all(part.map(j => trace(j.core, j.w, j.csv)));
    part.forEach((j, i) => { const r = rs[i]; res[j.w + ':' + j.tag] = r.error ? r : { outcome: r.outcome, rollout: r.rollout, landing: r.landing, t: r.t }; console.log('trace', j.w, j.tag, JSON.stringify(res[j.w + ':' + j.tag].rollout || res[j.w + ':' + j.tag])); });
  }
  fs.writeFileSync(path.join(OUT, 'rollout.json'), JSON.stringify(res, null, 1));
  let body = '';
  WINDS.forEach((w, i) => {
    const b = rollTrace(path.join(OUT, `rollout_${w}_before.csv`)), a = rollTrace(path.join(OUT, `rollout_${w}_after.csv`));
    const rb = res[w + ':before'].rollout, ra = res[w + ':after'].rollout;
    body += panel(70 + i * 330, 40, 270, 280, [-2, 18], [-150, 150], [
      { pts: b.map(p => [p[0], p[1]]), col: COL.before, label: `before (Coulomb): swing ${rb ? rb.maxE : '-'} deg` },
      { pts: a.map(p => [p[0], p[1]]), col: COL.after, label: `after (C_alpha): swing ${ra ? ra.maxE : '-'} deg` }],
      { title: `${w} m/s straight across`, xl: 's from touchdown (the roll-out phase)', yl: 'heading error (deg)', xt: [0, 5, 10, 15], yt: [-150, -90, -45, 0, 45, 90, 150],
        bands: [{ y: 15, col: COL.ink2, label: '15 (bad)' }, { y: -15, col: COL.ink2, label: '' }] });
  });
  fs.writeFileSync(path.join(OUT, 'rollout.svg'), svgDoc(1060, 360, body, "DMG-TYRE: the user's Cub's crosswind roll-out, heading error before / after"));
  // a zoomed copy for the after traces
  let body2 = '';
  WINDS.forEach((w, i) => {
    const b = rollTrace(path.join(OUT, `rollout_${w}_before.csv`)), a = rollTrace(path.join(OUT, `rollout_${w}_after.csv`));
    body2 += panel(70 + i * 330, 40, 270, 280, [-2, 18], [-20, 20], [
      { pts: b.map(p => [p[0], p[1]]), col: COL.before, label: 'before (Coulomb)' },
      { pts: a.map(p => [p[0], p[1]]), col: COL.after, label: 'after (C_alpha)' },
      { pts: a.map(p => [p[0], 20 * p[3]]), col: COL.ink2, dash: '1 2', label: 'after: rudder x 20 (rad)' }],
      { title: `${w} m/s across (zoom)`, xl: 's from touchdown', yl: 'heading error (deg)', xt: [0, 5, 10, 15], yt: [-20, -15, -6, 0, 6, 15, 20],
        bands: [{ y: 6, col: COL.c3, label: '6 good' }, { y: -6, col: COL.c3, label: '' }] });
  });
  fs.writeFileSync(path.join(OUT, 'rollout_zoom.svg'), svgDoc(1060, 360, body2, "DMG-TYRE: the Cub's crosswind roll-out (zoom)"));
}

function perf() {
  const one = (core, k, mode) => { const r = spawnSync(process.execPath, [__filename, '--perf-child', core, k, mode], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); return l ? JSON.parse(l.slice(5)) : null; };
  const P = {}, reps = +opt('perf-reps', 15), lines = [];
  for (const k of ['cub', 'metal']) for (const mode of ['ground', 'taxi', 'air']) {
    const rows = { base: [], mine: [] };
    for (let rep = 0; rep < reps; rep++) {
      if (rep % 2) { rows.mine.push(one(MINE, k, mode)); rows.base.push(one(BASE, k, mode)); }
      else { rows.base.push(one(BASE, k, mode)); rows.mine.push(one(MINE, k, mode)); }
    }
    const med = a => { const v = a.filter(Boolean).map(x => x.med).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
    const b = med(rows.base), n = med(rows.mine);
    P[k + ':' + mode] = { base: b, mine: n, pct: (n / b - 1) * 100, runs: rows };
    const l = `${k} ${mode}: base ${b.toFixed(4)} ms, now ${n.toFixed(4)} ms, ${((n / b - 1) * 100).toFixed(2)} % (the median of ${reps} alternating processes' medians, 600 steps each)`;
    lines.push(l); console.log('perf ' + l);
  }
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(P, null, 1));
  fs.writeFileSync(path.join(OUT, 'perf.txt'), lines.join('\n') + '\n');
}

(async () => {
  if (!argv.includes('--no-traces')) await traces();
  if (!argv.includes('--no-perf')) { if (BASE) perf(); else console.log('no --base: no perf'); }
})();
