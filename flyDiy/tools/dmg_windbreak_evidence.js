#!/usr/bin/env node
// G1883-G1884 (DMG-WINDBREAK): the evidence - reports/evidence/DMG-WINDBREAK/. Before = the base's core with the
// instruments only (sim.onSubstep / damageCaps / damagePush: read-only, the run's bits unchanged - GATE DMGWIND 4),
// after = this tree's. Each run flies in its own child process (its own core).
//   node tools/dmg_windbreak_evidence.js --base <the base's flyDiy/tools> [--before-gate <json>] [--after-gate <json>]
//        [--out reports/evidence/DMG-WINDBREAK] [--replot]
// (--before-gate / --after-gate: GATE DMGWIND's --json from each core, for the sweeps' grids)
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };

// ---- a child: one run on the core in `dir` ----
if (argv[0] === '--run') {
  const dir = argv[1], kind = argv[2], V = +argv[3], wind = argv[4] === 'on';
  const W = require(path.join(dir, '_dmg_wind_lib.js')), L = W.L, C = L.core();
  let out;
  if (kind === 'trace') {
    const a = W.taxi('cub', { D: 6, V, wind: wind ? W.PAGE_WIND : null, trace: true });
    const i0 = a.trace.findIndex(r => r.push > 0), t0 = i0 >= 0 ? a.trace[i0].t : a.tHit;
    out = { V, wind, t0, vImp: a.vImp, mount: a.mountBroken, broken: a.broken, work: a.work, first: a.first, names: a.mountNames,
      rows: a.trace.filter(r => r.t >= t0 - 0.01 && r.t <= t0 + 0.2).map(r => [+(r.t - t0).toFixed(5), r.m, r.push, r.v]) };
  } else if (kind === 'aero') {
    // THE AIR ON THE NOSE: the frame before the trunk's first push (the page's wind), its rigid velocity, the aero pass
    // alone (sim.probe on a fresh sim of the same build at that pose) with the wind and without - per node, N
    let snap = null;
    const r = L.atTrunk('cub', { D: 6, V, thr: 0, secs: 2, cert: true, wind: W.PAGE_WIND,
      onFrame: sim => { if (sim.trunkHits() === 0) snap = { p: Float64Array.from(sim.p), v: sim.cgVel(), t: sim.t }; } });
    const def = r.def, tg = i => def.nodes[i].tag || String(i), NOSE = ['ENGL', 'ENGR', 'CGE', 'S0BL', 'S0BR', 'S0TL', 'S0TR', 'VSNL', 'VSNR'];
    out = { t: snap.t, v: snap.v, q: 0.5 * 1.225 * Math.hypot(W.PAGE_WIND[0], W.PAGE_WIND[2]) ** 2, cases: {} };
    for (const [nm, w] of [['off', null], ['on', W.PAGE_WIND]]) {
      const { W: Wd } = L.flatWorld(W.ELEV); if (w) Wd.wind = () => w;
      const sim = C.makeSim(L.defOf('cub', { cert: true }), Wd); sim.reset(0); sim.p.set(snap.p);
      const P = sim.probe(snap.v, false), nose = {};
      for (const t of NOSE) { const i = def.nodes.findIndex(n => n.tag === t); if (i >= 0) nose[t] = [sim.f[i*3], sim.f[i*3+1], sim.f[i*3+2]].map(x => +x.toFixed(3)); }
      out.cases[nm] = { total: [P.Fx, P.Fy, P.Fz].map(x => +x.toFixed(2)), nose };
    }
  } else {
    // THE STAGING, frame by frame from the placement: the yaw off the strip and the drift across it (the first quantity
    // the wind parts), flyRun's own steps (_treecrash_lib.js)
    const elev = W.ELEV, { W: Wd, TH, strip } = L.flatWorld(elev);
    if (wind) { const w = W.PAGE_WIND; Wd.wind = () => w; }
    const def = L.defOf('cub', { cert: true }), sim = C.makeSim(def, Wd);
    sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), c00 = sim.cgPos().slice(), rows = [];
    const rec = ph => { const xA = sim.axes()[0], yaw = Math.atan2(-xA[2], -xA[0]) - Math.atan2(fz, fx); const c = sim.cgPos();
      rows.push([+sim.t.toFixed(4), +(((yaw + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI).toFixed(3), +(-((c[0] - c00[0]) * -fz + (c[2] - c00[2]) * fx)).toFixed(4), ph, sim.trunkHits()]); };
    for (let f = 0; f < 120; f++) { sim.step(1 / 60); rec(0); }
    for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
    const c0 = sim.cgPos().slice();
    TH.set('fill:test', [c0[0] + fx * 6, c0[2] + fz * 6, elev, 0.3, elev + 10.05]);
    for (let f = 0; f < 150; f++) { sim.step(1 / 60); rec(1); }
    out = { V, wind, rows };
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the SVGs: plain, light surface, one axis a panel ----
const INK = '#0b0b0b', INK2 = '#52514e', MUTED = '#8a8984', GRID = '#e4e3df', SURF = '#fcfcfb';
const S1 = '#2a78d6', S2 = '#eb6834';                       // blue: wind off / before; orange: wind on / after
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function svgDoc(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">\n<rect width="${w}" height="${h}" fill="${SURF}"/>\n<text x="16" y="26" font-size="16" font-weight="600" fill="${INK}">${esc(title)}</text>\n${body}</svg>\n`;
}
// a line panel: series [{ pts: [[x, y]], color, label, mark: [x, y] | null }]
function panel(x0, y0, w, h, o) {
  const { xr, yr, series } = o; let s = '';
  const X = x => x0 + (x - xr[0]) / (xr[1] - xr[0]) * w, Y = y => y0 + h - (Math.min(yr[1], Math.max(yr[0], y)) - yr[0]) / (yr[1] - yr[0]) * h;
  s += `<text x="${x0}" y="${y0 - 10}" font-size="13" font-weight="600" fill="${INK}">${esc(o.title)}</text>\n`;
  for (const t of o.yt) s += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}" stroke-width="1"/><text x="${x0 - 6}" y="${Y(t) + 4}" font-size="11" text-anchor="end" fill="${INK2}">${t}</text>\n`;
  for (const t of o.xt) s += `<text x="${X(t)}" y="${y0 + h + 16}" font-size="11" text-anchor="middle" fill="${INK2}">${t}</text>\n`;
  s += `<text x="${x0 + w / 2}" y="${y0 + h + 32}" font-size="11" text-anchor="middle" fill="${INK2}">${esc(o.xl)}</text>\n`;
  s += `<text transform="translate(${x0 - 38},${y0 + h / 2}) rotate(-90)" font-size="11" text-anchor="middle" fill="${INK2}">${esc(o.yl)}</text>\n`;
  if (o.ref != null) s += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(o.ref)}" y2="${Y(o.ref)}" stroke="${INK2}" stroke-width="1" stroke-dasharray="4 3"/><text x="${x0 + w - 2}" y="${y0 + 12}" font-size="10" text-anchor="end" fill="${INK2}">dashed: ${esc(o.refLab || '')}</text>\n`;
  for (const se of series) {
    if (!se.pts.length) continue;
    s += `<polyline fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" points="${se.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>\n`;
    if (se.mark) s += `<g stroke="${SURF}" stroke-width="2"><circle cx="${X(se.mark[0])}" cy="${Y(se.mark[1])}" r="5" fill="${se.color}"/></g><text x="${X(se.mark[0]) + 8}" y="${Y(se.mark[1]) - 8}" font-size="11" fill="${INK}">${esc(se.markLab || '')}</text>\n`;
  }
  return s;
}
const legend = (x, y, items) => { let s = '', cx = x; for (const it of items) { s += `<line x1="${cx}" x2="${cx + 22}" y1="${y}" y2="${y}" stroke="${it.color}" stroke-width="3"/><text x="${cx + 28}" y="${y + 4}" font-size="12" fill="${INK}">${esc(it.label)}</text>\n`; cx += 28 + 7 * it.label.length + 30; } return s; };

(async () => {
  const { spawn } = require('child_process');
  const base = path.resolve(opt('base', '')), here = __dirname, out = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-WINDBREAK')));
  // (--replot: the pictures again from the runs.json already in --out)
  const replot = argv.includes('--replot');
  if (!replot && !fs.existsSync(path.join(base, '_dmg_wind_lib.js'))) { console.error('--base <dir>: the base core\'s tools/ with the instruments and _dmg_wind_lib.js'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const run = a => new Promise(res => { const c = spawn(process.execPath, [__filename, '--run'].concat(a.map(String)), { stdio: ['ignore', 'pipe', 'inherit'] });
    let so = ''; c.stdout.on('data', d => { so += d; }); c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : null); }); });
  const jobs = [];
  for (const [who, dir] of [['before', base], ['after', here]]) for (const V of [3, 3.6]) for (const w of ['off', 'on']) jobs.push({ key: who + ':' + V + ':' + w, a: [dir, 'trace', V, w] });
  for (const w of ['off', 'on']) jobs.push({ key: 'stage:' + w, a: [here, 'stage', 3, w] });
  jobs.push({ key: 'aero', a: [here, 'aero', 3, 'on'] });
  let R = {};
  if (replot) R = JSON.parse(fs.readFileSync(path.join(out, 'runs.json'), 'utf8'));
  else {
    const q = jobs.slice();
    await Promise.all(Array.from({ length: 3 }, async () => { while (q.length) { const j = q.shift(); R[j.key] = await run(j.a); console.log('ran ' + j.key); } }));
    // (every other substep kept in the file: the pictures' resolution, half the bytes)
    for (const k in R) if (R[k] && R[k].rows && k.indexOf('stage') < 0) R[k].rows = R[k].rows.filter((x, i) => i % 2 === 0);
    fs.writeFileSync(path.join(out, 'runs.json'), JSON.stringify(R));
  }

  if (replot && !R.aero) R.aero = await run([here, 'aero', 3, 'on']);
  if (R.aero) fs.writeFileSync(path.join(out, 'aero_nose.json'), JSON.stringify(R.aero, null, 1));
  // 1. THE MOUNT'S WORST MEMBER OVER ITS LIMIT, against the time since the trunk's first push
  {
    let body = '';
    const W = 1000, H = 640, pw = 400, ph = 200;
    const cols = [['before', 'BEFORE'], ['after', 'AFTER']], rowsV = [[3, 'the page\'s staging (met at 2.2 m/s)'], [3.6, 'the page\'s impact speed (met at 3.0 m/s)']];
    rowsV.forEach(([V, vl], ri) => cols.forEach(([who, cl], ci) => {
      const ser = ['off', 'on'].map(w => { const r = R[who + ':' + V + ':' + w]; if (!r) return { pts: [], color: S1 };
        const pts = r.rows.map(x => [x[0] * 1000, Math.max(...x[1].map(m => m === null ? 0 : Math.abs(m)))]);
        const bi = r.rows.findIndex(x => x[1].some(m => m === null));
        return { pts: bi >= 0 ? pts.slice(0, bi) : pts, color: w === 'on' ? S2 : S1, mark: bi > 0 ? [pts[bi - 1][0], pts[bi - 1][1]] : null,
          markLab: bi > 0 ? 'mount off (' + r.mount + ' members, ' + (r.first ? r.first.who + ' ' + r.first.how : '') + ')' : '' }; });
      body += panel(90 + ci * 490, 90 + ri * 270, pw, ph, { title: cl + ' - ' + vl, xr: [0, 200], yr: [0, 1.8], xt: [0, 50, 100, 150, 200], yt: [0, 0.5, 1, 1.5],
        xl: 'ms since the trunk\'s first push', yl: 'worst mount member, |F| / limit', ref: 1, refLab: 'its limit (FY tension, FC crush)', series: ser });
    }));
    body += legend(90, 52, [{ color: S1, label: 'wind off' }, { color: S2, label: 'the page\'s wind (5.5 m/s from 112 deg)' }]);
    fs.writeFileSync(path.join(out, 'mount_force.svg'), svgDoc(W, H, body, 'The Cub\'s engine mount in a 3 m/s taxi into a trunk: the worst member over its certified limit'));
  }
  // 2. THE TRUNK'S PUSH ON THE ENGINE'S NODES (the thrust pair + the CG node), the page's wind
  {
    let body = '';
    [[3, 'the page\'s staging'], [3.6, 'the page\'s impact speed']].forEach(([V, vl], ci) => {
      const ser = [['before', S1], ['after', S2]].map(([who, col]) => { const r = R[who + ':' + V + ':on']; return { pts: r ? r.rows.map(x => [x[0] * 1000, x[2] / 1000]) : [], color: col }; });
      body += panel(90 + ci * 490, 90, 400, 230, { title: 'the page\'s wind - ' + vl, xr: [0, 200], yr: [0, 60], xt: [0, 50, 100, 150, 200], yt: [0, 15, 30, 45, 60],
        xl: 'ms since the trunk\'s first push', yl: 'the trunk\'s push on ENGL + ENGR + CGE, kN', series: ser });
    });
    body += legend(90, 52, [{ color: S1, label: 'before: once per member at the node' }, { color: S2, label: 'after: one contact per node' }]);
    fs.writeFileSync(path.join(out, 'push_engine.svg'), svgDoc(1000, 380, body, 'What the trunk pushed the engine with (substep by substep)'));
  }
  // 3. THE FIRST DIVERGENCE: the settle and the roll, wind off / on - the yaw off the strip and the drift across it
  {
    let body = '';
    const off = R['stage:off'], on = R['stage:on'];
    const cont = r => { const c = r.rows.find(x => x[4] > 0); return c ? c[0] : null; };
    [[1, 'yaw off the strip, deg (+ the nose left)', [-1, 3], [-1, 0, 1, 2, 3]], [2, 'drift across the strip, m (+ left)', [-0.3, 0.1], [-0.3, -0.2, -0.1, 0, 0.1]]].forEach(([k, yl, yr, yt], ci) => {
      const ser = [[off, S1], [on, S2]].map(([r, col]) => ({ pts: r ? r.rows.map(x => [x[0], x[k]]) : [], color: col, mark: r && cont(r) != null ? [cont(r), r.rows.find(x => x[0] === cont(r))[k]] : null, markLab: r && cont(r) != null ? 'trunk met' : '' }));
      body += panel(90 + ci * 490, 90, 400, 230, { title: ci ? 'the drift' : 'the yaw', xr: [0, 4.5], yr, xt: [0, 1, 2, 3, 4], yt, xl: 's (0-2 s: the settle in the wind; then 3 m/s, the throttle shut)', yl, ref: 0, series: ser });
    });
    body += legend(90, 52, [{ color: S1, label: 'wind off' }, { color: S2, label: 'the page\'s wind' }]);
    fs.writeFileSync(path.join(out, 'divergence.svg'), svgDoc(1000, 380, body, 'The first quantity the wind parts: where the Cub meets the trunk'));
  }
  // 4. THE SWEEPS (GATE DMGWIND's json, before and after): a grid per build and staging
  const BG = opt('before-gate'), AG = opt('after-gate');
  if (BG && AG) {
    const G = { before: JSON.parse(fs.readFileSync(BG, 'utf8')), after: JSON.parse(fs.readFileSync(AG, 'utf8')) };
    const TH = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], US = [0, 2.5, 5, 7.5, 10];
    const BUILDS = [['cub', 'Cub'], ['jodel', 'Jodel'], ['metal', 'metal Cessna']];
    let body = '', y = 80; const cw = 18, chh = 16, summary = {};
    for (const [V, vl] of [[3, 'THE PAGE\'S STAGING (3 m/s, 6 m) - GATED'], [3.6, 'THE PAGE\'S IMPACT SPEED (~3 m/s at the trunk) - REPORTED']]) {
      body += `<text x="16" y="${y}" font-size="13" font-weight="600" fill="${INK}">${esc(vl)}</text>\n`; y += 14;
      BUILDS.forEach(([k, lab], bi) => ['before', 'after'].forEach((who, wi) => {
        const rows = G[who].filter(r => r.kind === 'sweep' && r.key === k && r.V === V).flatMap(r => r.rows);
        const x0 = 70 + (bi * 2 + wi) * 255, y0 = y + 26;
        const nb = rows.filter(r => r.mount > 0).length; (summary[V + ':' + k] = summary[V + ':' + k] || {})[who] = nb + '/' + rows.length;
        body += `<text x="${x0}" y="${y0 - 8}" font-size="11" fill="${INK}">${esc(lab + ', ' + who + ': ' + nb + '/' + rows.length + ' mount off')}</text>\n`;
        US.forEach((U, ui) => {
          if (bi === 0 && wi === 0) body += `<text x="${x0 - 6}" y="${y0 + ui * (chh + 2) + 12}" font-size="10" text-anchor="end" fill="${INK2}">${U} m/s</text>\n`;
          TH.forEach((th, ti) => { if (U === 0 && ti) return; const r = rows.find(z => z.U === U && (U === 0 || z.th === th)); if (!r) return;
            const fill = !r.hit ? SURF : r.mount > 0 ? S2 : '#cfe0f5', stroke = !r.hit ? MUTED : 'none';
            body += `<rect x="${x0 + ti * (cw + 2)}" y="${y0 + ui * (chh + 2)}" width="${cw}" height="${chh}" rx="2" fill="${fill}" stroke="${stroke}"><title>${esc(lab + ', ' + who + ', ' + U + ' m/s from ' + th + ' deg: ' + (r.hit ? (r.mount ? 'MOUNT OFF (' + r.first + ')' : 'mount held') + ', ' + r.work + ' J, met at ' + (r.vImp || 0).toFixed(2) + ' m/s' : 'missed the trunk'))}</title></rect>\n`; });
        });
        if (bi === 0 && wi === 0) TH.forEach((th, ti) => { if (ti % 3 === 0) body += `<text x="${x0 + ti * (cw + 2) + cw / 2}" y="${y0 + 5 * (chh + 2) + 12}" font-size="9" text-anchor="middle" fill="${INK2}">${th}</text>\n`; });
      }));
      y += 26 + 5 * (chh + 2) + 34;
    }
    body += `<rect x="70" y="${y - 6}" width="14" height="12" rx="2" fill="${S2}"/><text x="90" y="${y + 4}" font-size="12" fill="${INK}">the engine mount broke (its group let go)</text>`;
    body += `<rect x="370" y="${y - 6}" width="14" height="12" rx="2" fill="#cfe0f5"/><text x="390" y="${y + 4}" font-size="12" fill="${INK}">the mount held</text>`;
    body += `<rect x="520" y="${y - 6}" width="14" height="12" rx="2" fill="${SURF}" stroke="${MUTED}"/><text x="540" y="${y + 4}" font-size="12" fill="${INK}">the wind turned it off the trunk</text>`;
    body += `<text x="70" y="${y + 24}" font-size="11" fill="${INK2}">rows: the wind's speed; columns: where it blows FROM, deg off the nose (0 ahead, 90 the right, 180 behind)</text>\n`;
    fs.writeFileSync(path.join(out, 'sweep.svg'), svgDoc(1620, y + 40, body, 'A steady wind 0-10 m/s from every direction: did the engine mount survive the 3 m/s trunk taxi?'));
    // the offsets (no wind)
    let ob = '';
    [[3, 'the page\'s staging'], [3.6, 'the page\'s impact speed']].forEach(([V, vl], ci) => {
      const ser = [['before', S1], ['after', S2]].map(([who, col]) => { const r = G[who].find(z => z.kind === 'offset' && z.V === V); return { pts: r ? r.rows.map(z => [z.off, z.work / 1000]) : [], color: col, rows: r ? r.rows : [] }; });
      const X = x => 90 + ci * 490 + (x + 0.45) / 0.9 * 400, Y = y => 90 + 230 - Math.min(1.6, y) / 1.6 * 230;
      ob += panel(90 + ci * 490, 90, 400, 230, { title: vl, xr: [-0.45, 0.45], yr: [0, 1.6], xt: [-0.4, -0.2, 0, 0.2, 0.4], yt: [0, 0.4, 0.8, 1.2, 1.6], xl: 'the trunk\'s offset across the nose, m (+ toward the left wing)', yl: 'plastic work, kJ', series: ser.map(s => ({ pts: s.pts, color: s.color })) });
      for (const s of ser) for (const z of s.rows) if (z.mount > 0) ob += `<g stroke="${SURF}" stroke-width="2"><circle cx="${X(z.off)}" cy="${Y(z.work / 1000)}" r="5" fill="${s.color}"/></g>\n`;
    });
    ob += legend(90, 52, [{ color: S1, label: 'before (a dot: the mount broke)' }, { color: S2, label: 'after (a dot: the mount broke)' }]);
    fs.writeFileSync(path.join(out, 'offset.svg'), svgDoc(1000, 380, ob, 'No wind: the same taxi with the trunk moved across the nose'));
    fs.writeFileSync(path.join(out, 'sweep_summary.json'), JSON.stringify(summary, null, 1));
  }
  console.log('wrote ' + out);
})();
