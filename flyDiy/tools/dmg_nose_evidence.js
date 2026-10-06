#!/usr/bin/env node
// G2013-G2015 (DMG-NOSE): the evidence - reports/evidence/DMG-NOSE/. Before = the base's core (claude/dmg-integration,
// GATE DMGWIND's own --part runs on it: the same staging, the same rows), after = this tree's (GATE DMGNOSE's --json).
//   node tools/dmg_nose_evidence.js --base <the base's flyDiy/tools> --before <json> --after <json>
//        [--out reports/evidence/DMG-NOSE] [--replot]
// --before: the base's rows (an array of GATE DMGWIND --part results: 'sweep' <key> 3.6 <U> and 'offset' <key> 3.6);
// --after: GATE DMGNOSE's --json. The traces (the worst mount member over its limit, substep by substep) fly here, each
// run in its own child process on its own core (--base for before).
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };

// ---- a child: one traced run on the core in `dir` ----
if (argv[0] === '--run') {
  const dir = argv[1], key = argv[2], V = +argv[3], U = +argv[4], th = +argv[5], off = +argv[6];
  const W = require(path.join(dir, '_dmg_wind_lib.js'));
  const a = W.taxi(key, { D: 6, V, wind: W.windVec(U, th), off, trace: true });
  const i0 = a.trace.findIndex(r => r.push > 0), t0 = i0 >= 0 ? a.trace[i0].t : (a.tHit || 0);
  const worst = r => { let m = 0, who = -1; r.m.forEach((q, j) => { if (q != null && Math.abs(q) > m) { m = Math.abs(q); who = j; } }); return [m, who]; };
  const rows = a.trace.filter(r => r.t >= t0 - 0.02 && r.t <= t0 + 0.6).map(r => { const [m, who] = worst(r); return [+(r.t - t0).toFixed(5), +m.toFixed(4), who, r.m.filter(x => x === null).length, r.push]; });
  console.log('RESULT ' + JSON.stringify({ key, V, U, th, off, t0, vImp: a.vImp, mount: a.mountBroken, broken: a.broken, first: a.first, names: a.mountNames, rows: rows.filter((x, i) => i % 2 === 0), nose: a.nose || null }));
  process.exit(0);
}

// ---- the SVGs: plain, light surface ----
const INK = '#0b0b0b', INK2 = '#52514e', MUTED = '#8a8984', GRID = '#e4e3df', SURF = '#fcfcfb';
const S1 = '#2a78d6', S2 = '#eb6834', OK = '#9fc3ea', BAD = '#d9480f', BUILD = { cub: '#2a78d6', jodel: '#2f9e44', metal: '#7048e8' };
const LAB = { cub: 'the user\'s Cub', jodel: 'Jodel', metal: 'metal Cessna', floats: 'Cessna floats', twinFloats: 'twin (one nacelle)' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title, sub) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">\n<rect width="${w}" height="${h}" fill="${SURF}"/>\n` +
  `<text x="24" y="30" font-size="16" font-weight="700" fill="${INK}">${esc(title)}</text>\n` + (sub ? `<text x="24" y="50" font-size="12" fill="${INK2}">${esc(sub)}</text>\n` : '') + body + '</svg>\n';
function axes(x0, y0, w, h, o) {
  const X = x => x0 + (x - o.xr[0]) / (o.xr[1] - o.xr[0]) * w, Y = y => y0 + h - (Math.min(o.yr[1], Math.max(o.yr[0], y)) - o.yr[0]) / (o.yr[1] - o.yr[0]) * h;
  let s = `<text x="${x0}" y="${y0 - 10}" font-size="13" font-weight="600" fill="${INK}">${esc(o.title)}</text>\n`;
  for (const t of o.yt) s += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}"/><text x="${x0 - 6}" y="${Y(t) + 4}" font-size="11" text-anchor="end" fill="${INK2}">${t}</text>\n`;
  for (const t of o.xt) s += `<text x="${X(t)}" y="${y0 + h + 16}" font-size="11" text-anchor="middle" fill="${INK2}">${t}</text>\n`;
  s += `<line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}" stroke="${INK2}"/>`;
  s += `<text x="${x0 + w / 2}" y="${y0 + h + 34}" font-size="11" text-anchor="middle" fill="${INK2}">${esc(o.xl)}</text>\n`;
  s += `<text transform="translate(${x0 - 40},${y0 + h / 2}) rotate(-90)" font-size="11" text-anchor="middle" fill="${INK2}">${esc(o.yl)}</text>\n`;
  return { s, X, Y };
}
const line = (pts, X, Y, color, wd, dash) => `<polyline fill="none" stroke="${color}" stroke-width="${wd || 2}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''} points="${pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>\n`;

// 1. THE CRUSH: force against depth per build - the stack (the spinner's cone, the prop at its hub, the bowl), a
// separation's prop layer dashed, the certificate's nose reaction at limit, and where the calm impact run stopped
function crushSvg(A) {
  const keys = ['cub', 'jodel', 'metal', 'twinFloats'], W = 980, H = 700, pw = 400, ph = 200;
  let body = '';
  keys.forEach((k, i) => {
    const st = A.find(r => r.kind === 'stack' && r.key === k); if (!st || !st.stack) return;
    const N = st.stack.find(x => x); if (!N) return;
    const x0 = 80 + (i % 2) * 480, y0 = 100 + Math.floor(i / 2) * 300;
    const top = Math.max(...N.curve.map(c => c[1])) / 1000, ymax = Math.ceil(Math.max(30, k === 'twinFloats' ? top : st.Flim / 1000, top) / 10) * 10 + 5;
    const ax = axes(x0, y0, pw, ph, { title: LAB[k] + (k === 'twinFloats' ? '' : ' (' + Math.round(st.m) + ' kg)'), xr: [0, 50], yr: [0, ymax], xt: [0, 10, 20, 30, 40, 50], yt: Array.from({ length: Math.floor(ymax / 10) + 1 }, (_, j) => j * 10), xl: 'crush from the spinner\'s tip, cm', yl: 'force, kN' });
    body += ax.s;
    // the layers, shaded bands
    const shade = { spinner: '#e7f0fb', prop: '#fdf0e6', bowl: '#eef6ee' };
    for (const L of N.layers) body += `<rect x="${ax.X(100 * L.d0)}" y="${y0}" width="${ax.X(100 * L.d1) - ax.X(100 * L.d0)}" height="${ph}" fill="${shade[L.name]}"/><text x="${(ax.X(100 * L.d0) + ax.X(100 * L.d1)) / 2}" y="${y0 + 14}" font-size="10" text-anchor="middle" fill="${INK2}">${L.name}</text>\n`;
    body += `<rect x="${ax.X(100 * N.Dc)}" y="${y0}" width="${Math.max(0, ax.X(50) - ax.X(100 * N.Dc))}" height="${ph}" fill="#f1f0ed"/><text x="${(ax.X(100 * N.Dc) + ax.X(50)) / 2}" y="${y0 + 14}" font-size="10" text-anchor="middle" fill="${INK2}">core</text>\n`;
    if (k !== 'twinFloats') body += `<line x1="${x0}" x2="${x0 + pw}" y1="${ax.Y(st.Flim / 1000)}" y2="${ax.Y(st.Flim / 1000)}" stroke="${INK2}" stroke-dasharray="5 4"/><text x="${x0 + pw - 4}" y="${ax.Y(st.Flim / 1000) - 5}" font-size="10" text-anchor="end" fill="${INK2}">the mount certified: 9 g / 1.5 on the nose, ${(st.Flim / 1000).toFixed(1)} kN</text>\n`;
    body += line(N.curve.map(([c, F]) => [100 * c, F / 1000]), ax.X, ax.Y, BUILD[k] || S1, 2.5);
    const P = N.layers.find(x => x.name === 'prop');
    if (P && P.Fsep != null) body += line([[100 * P.d0, P.Fsep / 1000], [100 * P.d1, P.Fsep / 1000]], ax.X, ax.Y, BUILD[k] || S1, 1.5, '4 3') + `<text x="${(ax.X(100 * P.d0) + ax.X(100 * P.d1)) / 2}" y="${ax.Y(P.Fsep / 1000) + 13}" font-size="9" text-anchor="middle" fill="${INK2}">a separation</text>\n`;
    // the calm run at the impact speed: where the crush stopped
    const calm = A.filter(r => r.kind === 'sweep' && r.key === k && r.U === 0).flatMap(r => r.rows)[0];
    if (calm && calm.nose) {
      const x = ax.X(100 * calm.nose.crush), y = ax.Y(calm.nose.F / 1000);
      body += `<circle cx="${x}" cy="${y}" r="5" fill="${BUILD[k]}" stroke="${SURF}" stroke-width="2"/><text x="${x - 8}" y="${y - 10}" font-size="10" text-anchor="end" fill="${INK}">3 m/s, calm: ${(100 * calm.nose.crush).toFixed(0)} cm, ${(calm.nose.J / 1000).toFixed(2)} kJ</text>\n`;
    }
    body += `<text x="${x0}" y="${y0 + ph + 52}" font-size="10" fill="${INK2}">${esc(N.layers.map(x => x.name + ' ' + (100 * (x.d1 - x.d0)).toFixed(0) + ' cm').join(' · ') + ' · the stack ' + (N.W / 1000).toFixed(2) + ' kJ' + (k === 'twinFloats' ? ' (no trunk case on the water)' : '; the 3 m/s taxi ' + (st.E3 / 1000).toFixed(2) + ' kJ'))}</text>\n`;
  });
  return svgDoc(W, H, body, 'The crushable nose: force against crush depth, per build', 'the spinner (Alexander\'s shell crush on the cone), the propeller at its hub (the blade roots), the nose bowl; past the stack the engine itself (core)');
}

// 2. THE MOUNT'S WORST MEMBER OVER ITS LIMIT: a trace before / after (the Cub, a wind that broke it), and every run's peak
function mountSvg(T, Bf, Af, Bo, Ao) {
  const W = 980, H = 720;
  let body = '';
  // top: the traces
  const tr = T.filter(t => t.key === 'cub');
  const ax = axes(80, 100, 820, 220, { title: 'The Cub, ' + (tr[0] ? tr[0].U + ' m/s from ' + tr[0].th + ' deg' : '') + ', started at 3.6 m/s: the worst mount member\'s force over its limit, from first contact',
    xr: [0, 0.6], yr: [0, 1.4], xt: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], yt: [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4], xl: 's after the trunk\'s first push', yl: 'force / its limit' });
  body += ax.s + `<line x1="80" x2="900" y1="${ax.Y(1)}" y2="${ax.Y(1)}" stroke="${INK2}" stroke-dasharray="5 4"/>`;
  for (const t of tr) {
    const c = t.side === 'before' ? S1 : S2, pts = t.rows.map(r => [r[0], r[1]]).filter(p => p[0] >= 0);
    body += line(pts, ax.X, ax.Y, c, 2);
    const br = t.rows.find(r => r[3] > 0);
    if (br) body += `<circle cx="${ax.X(br[0])}" cy="${ax.Y(Math.min(1.4, br[1] || 1))}" r="6" fill="${BAD}" stroke="${SURF}" stroke-width="2"/><text x="${ax.X(br[0]) + 9}" y="${ax.Y(1.25)}" font-size="11" fill="${BAD}">${esc(t.first ? t.first.who + ' ' + t.first.how : 'broke')} - the mount comes off (${t.mount} members)</text>\n`;
    const pk = Math.max(...pts.map(p => p[1]));
    body += `<text x="${ax.X(0.6) - 4}" y="${ax.Y(t.side === 'before' ? 0.32 : 0.18)}" font-size="11" text-anchor="end" fill="${c}">${t.side}: ${t.mount ? t.mount + ' mount members broken' : 'held, worst ' + pk.toFixed(2) + ' of its limit'}${t.nose && t.nose[0] && t.nose[0].crush ? ', the nose crushed ' + (100 * t.nose[0].crush).toFixed(0) + ' cm' : ''}</text>\n`;
  }
  // bottom: every run's peak, per build, before / after (winds 49 + offsets 19)
  const keys = ['cub', 'jodel', 'metal'], y0 = 420, ph = 220;
  const ax2 = axes(80, y0, 820, ph, { title: 'Every run at the impact speed (49 winds + 19 offsets a build): the worst mount member over its limit; red = the mount came off', xr: [0, 6], yr: [0, 1.4], xt: [], yt: [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4], xl: '', yl: 'peak force / its limit' });
  body += ax2.s + `<line x1="80" x2="900" y1="${ax2.Y(1)}" y2="${ax2.Y(1)}" stroke="${INK2}" stroke-dasharray="5 4"/>`;
  keys.forEach((k, i) => {
    for (const [side, rows, j] of [['before', Bf(k).concat(Bo(k)), 0], ['after', Af(k).concat(Ao(k)), 1]]) {
      const xc = ax2.X(2 * i + j + 0.5);
      rows.forEach((r, q) => { const jit = ((q * 37) % 23 - 11) * 2.6; const off = r.mount > 0;
        body += `<circle cx="${(xc + jit).toFixed(1)}" cy="${ax2.Y(off ? Math.max(1.02, r.peak) : r.peak).toFixed(1)}" r="3.2" fill="${off ? BAD : side === 'before' ? S1 : S2}" fill-opacity="${off ? 0.95 : 0.6}"/>`; });
      const nOff = rows.filter(r => r.mount > 0).length;
      body += `<text x="${xc}" y="${y0 + ph + 16}" font-size="11" text-anchor="middle" fill="${side === 'before' ? S1 : S2}">${side}</text><text x="${xc}" y="${y0 + ph + 30}" font-size="11" text-anchor="middle" fill="${nOff ? BAD : INK2}">${nOff} of ${rows.length} off</text>\n`;
    }
    body += `<text x="${ax2.X(2 * i + 1)}" y="${y0 + ph + 48}" font-size="12" font-weight="600" text-anchor="middle" fill="${INK}">${esc(LAB[k])}</text>\n`;
  });
  return svgDoc(W, H, body, 'The engine mount: its worst member over its certified limit, before / after', 'before = claude/dmg-integration (no nose, the centreline nose case only); after = the crushable nose and the corner cases (G2013-G2015)');
}

// 3. THE SWEEP: 5 winds x 12 directions per build, before / after, and the offsets; red = the mount came off
function sweepSvg(Bf, Af, Bo, Ao) {
  const TH = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], US = [0, 2.5, 5, 7.5, 10];
  const keys = ['cub', 'jodel', 'metal'], W = 1000, H = 760, cw = 30, ch = 22;
  let body = '';
  keys.forEach((k, i) => {
    [['before', Bf(k), Bo(k)], ['after', Af(k), Ao(k)]].forEach(([side, rows, offs], j) => {
      const x0 = 110 + j * 460, y0 = 100 + i * 220;
      const nOff = rows.filter(r => r.mount > 0).length, oOff = offs.filter(r => r.mount > 0).length;
      body += `<text x="${x0}" y="${y0 - 12}" font-size="13" font-weight="600" fill="${INK}">${esc(LAB[k])}, ${side}: mount off in ${nOff}/${rows.length} winds, ${oOff}/${offs.length} offsets</text>\n`;
      US.forEach((U, a) => {
        body += `<text x="${x0 - 6}" y="${y0 + a * ch + 15}" font-size="10" text-anchor="end" fill="${INK2}">${U} m/s</text>`;
        TH.forEach((th, b) => {
          if (U === 0 && b > 0) return;
          const r = rows.find(x => x.U === U && (U === 0 || x.th === th)); if (!r) return;
          const w = U === 0 ? cw * 12 - 2 : cw - 2;
          body += `<rect x="${x0 + b * cw}" y="${y0 + a * ch}" width="${w}" height="${ch - 2}" fill="${r.mount > 0 ? BAD : side === 'before' ? OK : '#f6c9a8'}"/>`;
          if (r.mount > 0) body += `<text x="${x0 + b * cw + w / 2}" y="${y0 + a * ch + 15}" font-size="10" text-anchor="middle" fill="#fff">${r.mount}</text>`;
        });
      });
      TH.forEach((th, b) => { body += `<text x="${x0 + b * cw + cw / 2 - 1}" y="${y0 + 5 * ch + 12}" font-size="9" text-anchor="middle" fill="${INK2}">${th}</text>`; });
      body += `<text x="${x0 + 6 * cw}" y="${y0 + 5 * ch + 24}" font-size="9" text-anchor="middle" fill="${INK2}">wind from (deg off the nose)</text>`;
      // the offsets strip
      const oy = y0 + 5 * ch + 36, ow = (12 * cw) / Math.max(1, offs.length);
      offs.forEach((r, q) => { body += `<rect x="${x0 + q * ow}" y="${oy}" width="${ow - 1}" height="14" fill="${r.mount > 0 ? BAD : side === 'before' ? OK : '#f6c9a8'}"/>`; });
      body += `<text x="${x0 - 6}" y="${oy + 11}" font-size="10" text-anchor="end" fill="${INK2}">offset</text><text x="${x0}" y="${oy + 26}" font-size="9" fill="${INK2}">-0.45 m</text><text x="${x0 + 12 * cw}" y="${oy + 26}" font-size="9" text-anchor="end" fill="${INK2}">+0.45 m (no wind)</text>\n`;
    });
  });
  return svgDoc(W, H, body, 'The wind sweep at the impact speed (3 m/s into a 0.6 m trunk), before / after', 'cell = one run, the number = mount members broken (red: the mount came off); the strip under each grid = the trunk moved across the nose, no wind');
}

(async () => {
  const out = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-NOSE')));
  fs.mkdirSync(out, { recursive: true });
  const B = JSON.parse(fs.readFileSync(opt('before'), 'utf8')), A = JSON.parse(fs.readFileSync(opt('after'), 'utf8'));
  const rowsOf = (R, kind, k) => R.filter(r => r.kind === kind && r.key === k && (r.V == null || +r.V === 3.6 || r.job && +r.job[2] === 3.6)).flatMap(r => r.rows || []);
  const Bf = k => rowsOf(B, 'sweep', k), Af = k => rowsOf(A, 'sweep', k), Bo = k => rowsOf(B, 'offset', k), Ao = k => rowsOf(A, 'offset', k);
  let T;
  const runsF = path.join(out, 'traces.json');
  if (argv.includes('--replot') && fs.existsSync(runsF)) T = JSON.parse(fs.readFileSync(runsF, 'utf8'));
  else {
    const { spawnSync } = require('child_process'), base = path.resolve(opt('base'));
    // the Cub's first wind that took its mount off before (the sweep's order), flown on both cores
    const w = Bf('cub').find(r => r.mount > 0 && r.U > 0) || { U: 2.5, th: 30 };
    T = [];
    for (const [side, dir] of [['before', base], ['after', __dirname]]) {
      const r = spawnSync(process.execPath, [__filename, '--run', dir, 'cub', 3.6, w.U, w.th, 0], { encoding: 'utf8', maxBuffer: 1 << 28 });
      const l = (r.stdout || '').split('\n').find(x => x.startsWith('RESULT '));
      if (!l) { process.stderr.write(r.stderr || ''); continue; }
      T.push(Object.assign(JSON.parse(l.slice(7)), { side }));
    }
    fs.writeFileSync(runsF, JSON.stringify(T));
  }
  fs.writeFileSync(path.join(out, 'crush_curve.svg'), crushSvg(A));
  fs.writeFileSync(path.join(out, 'mount_worst.svg'), mountSvg(T, Bf, Af, Bo, Ao));
  fs.writeFileSync(path.join(out, 'sweep.svg'), sweepSvg(Bf, Af, Bo, Ao));
  const sum = {};
  for (const k of ['cub', 'jodel', 'metal']) sum[k] = { winds: { before: Bf(k).filter(r => r.mount > 0).length, after: Af(k).filter(r => r.mount > 0).length, n: Af(k).length },
    offsets: { before: Bo(k).filter(r => r.mount > 0).length, after: Ao(k).filter(r => r.mount > 0).length, n: Ao(k).length },
    peak: { before: Math.max(...Bf(k).concat(Bo(k)).map(r => r.peak)), after: Math.max(...Af(k).concat(Ao(k)).map(r => r.peak)) } };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(sum, null, 1) + '\n');
  console.log(JSON.stringify(sum));
})();
