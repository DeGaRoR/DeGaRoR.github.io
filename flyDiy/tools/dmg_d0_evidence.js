#!/usr/bin/env node
// dmg_d0_evidence.js - DMG-D0 INSTRUMENTS' pictures (G1800-G1809), node only: reports/evidence/DMG-D0/
//   gate_dmgfps.txt / gate_dmginst.txt   the two gates' whole output (run here with --out)
//   dmgfps.json / dmginst.json           their numbers
//   dmgfps.svg       GATE DMGFPS: per case, the 60 fps run's plastic work against sim time, and where every batched schedule
//                    (the brief's nominal fps, the page's own clock, the worker host) ended - each ON the 60 fps line
//   overlay_colours.svg   the damage view's legend (dmg_overlay.js) and the Cub's 30 m/s trunk crash drawn from above
//                    with it, as the Frame / Overlay mode would colour it (the cloud cannot render the game: the coordinator
//                    eyeballs the real view on the box, ?dmgview=1)
// Run: node tools/dmg_d0_evidence.js [--skip-gates]   (--skip-gates: redraw from the JSON already there)
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D0');
fs.mkdirSync(OUT, { recursive: true });
if (!argv.includes('--skip-gates')) {
  for (const [f, tag, out] of [['_dmgfps_check.js', 'dmgfps', ['--out', path.join(OUT, 'dmgfps.json')]], ['_dmg_instruments_check.js', 'dmginst', ['--out', OUT]]]) {
    const r = spawnSync(process.execPath, [path.join(__dirname, f), ...out], { encoding: 'utf8', maxBuffer: 64 << 20 });
    fs.writeFileSync(path.join(OUT, 'gate_' + tag + '.txt'), r.stdout + (r.stderr || ''));
    console.log(f + ': ' + (r.stdout.trim().split('\n').pop()));
  }
}
const FPS = JSON.parse(fs.readFileSync(path.join(OUT, 'dmgfps.json'), 'utf8'));
const INST = JSON.parse(fs.readFileSync(path.join(OUT, 'dmginst.json'), 'utf8'));
// the palette (TREE-CRASH's evidence, the dataviz reference instance): the 60 fps line slot 1 blue, the batched ends slot 2 orange
const COL = { ref: '#2a78d6', inline: '#eb6834', host: '#1f9e89', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', surf: '#fcfcfb' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${COL.surf}"/>${body}</svg>`;
const nice = (a, b, n) => { if (b - a < 1e-9) return [a]; const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const m = [1, 2, 5, 10].find(k => (b - a) / (st * k) <= n) * st; const r = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) r.push(+v.toFixed(6)); return r; };

// ---- dmgfps.svg ----
{
  const ids = Object.keys(FPS.cases).filter(id => !FPS.cases[id].skip && !FPS.cases[id].err);
  const cols = 2, pw = 470, ph = 230, top = 86, W = cols * pw + 20, H = top + Math.ceil(ids.length / cols) * ph + 20;
  let s = `<text x="12" y="22" font-size="15" font-weight="bold" fill="${COL.ink}">GATE DMGFPS - a low frame rate never fakes a yield or a crash</text>`;
  s += `<text x="12" y="40" font-size="11" fill="${COL.ink2}">The plastic work of the 60 fps run (one step a read) against sim time; a dot where each batched run ended - the page's first read at or after</text>`;
  s += `<text x="12" y="54" font-size="11" fill="${COL.ink2}">the 60 fps end (dashed). Every dot sits on the line: bitwise the 60 fps run at that step. The damage layer on.</text>`;
  const lg = (x, y, c, lab, dot) => (dot ? `<circle cx="${x + 9}" cy="${y}" r="4.5" fill="${c}" stroke="${COL.surf}" stroke-width="2"/>` : `<line x1="${x}" x2="${x + 18}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="2"/>`) + `<text x="${x + 24}" y="${y + 4}" font-size="11" fill="${COL.ink}">${esc(lab)}</text>`;
  s += lg(12, 72, COL.ref, '60 fps run', false) + lg(132, 72, COL.inline, 'batched inline (the page)', true) + lg(302, 72, COL.host, 'through the worker host', true);
  ids.forEach((id, k) => {
    const r = FPS.cases[id], x0 = 10 + (k % cols) * pw, y0 = top + Math.floor(k / cols) * ph;
    const pl = 52, pr = 14, pt = 34, pb = 34, w = pw - pl - pr, h = ph - pt - pb;
    const tr = r.workTrace.map(([st, wk]) => [st / 60, wk / 1000]);
    const ends = r.runs.map(x => ({ t: x.end / 60, w: x.st.work / 1000, host: x.kind === 'host' }));
    const xmax = Math.max(r.N / 60, ...ends.map(e => e.t)), ymax0 = Math.max(...tr.map(p => p[1]), ...ends.map(e => e.w));
    const ymax = ymax0 > 0 ? ymax0 * 1.08 : 1;
    const X = t => x0 + pl + t / xmax * w, Y = v => y0 + pt + h - v / ymax * h;
    s += `<text x="${x0 + pl}" y="${y0 + 16}" font-size="12" font-weight="bold" fill="${COL.ink}">${esc(r.label)}</text>`;
    const f = r.ref;
    s += `<text x="${x0 + pl}" y="${y0 + 29}" font-size="10" fill="${COL.ink2}">${esc((f.crashed ? 'CRASHED: ' + f.reason : 'no crash, ' + f.yields + ' yields') + ' - ' + r.runs.length + ' schedules, ' + r.runs.filter(x => x.same && x.verdict && x.endOk).length + ' bitwise')}</text>`;
    for (const v of nice(0, ymax, 4)) s += `<line x1="${x0 + pl}" x2="${x0 + pl + w}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.grid}"/><text x="${x0 + pl - 5}" y="${Y(v) + 3}" font-size="9" text-anchor="end" fill="${COL.ink2}">${v}</text>`;
    for (const v of nice(0, xmax, 5)) s += `<text x="${X(v)}" y="${y0 + pt + h + 13}" font-size="9" text-anchor="middle" fill="${COL.ink2}">${v}</text>`;
    s += `<text x="${x0 + pl + w / 2}" y="${y0 + ph - 8}" font-size="9" text-anchor="middle" fill="${COL.ink2}">sim time (s)</text>`;
    s += `<text x="${x0 + 14}" y="${y0 + pt + h / 2}" font-size="9" text-anchor="middle" fill="${COL.ink2}" transform="rotate(-90 ${x0 + 14} ${y0 + pt + h / 2})">plastic work (kJ)</text>`;
    s += `<line x1="${X(r.refEnd / 60)}" x2="${X(r.refEnd / 60)}" y1="${y0 + pt}" y2="${y0 + pt + h}" stroke="${COL.ink2}" stroke-dasharray="3 3"/>`;
    s += `<polyline fill="none" stroke="${COL.ref}" stroke-width="2" points="${tr.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
    for (const e of ends) s += `<circle cx="${X(e.t).toFixed(1)}" cy="${Y(e.w).toFixed(1)}" r="4.5" fill="${e.host ? COL.host : COL.inline}" stroke="${COL.surf}" stroke-width="2"><title>${esc((e.host ? 'host' : 'inline') + ': ended at ' + e.t.toFixed(3) + ' s, ' + e.w.toFixed(3) + ' kJ')}</title></circle>`;
  });
  fs.writeFileSync(path.join(OUT, 'dmgfps.svg'), svgDoc(W, H, s, 'GATE DMGFPS'));
}

// ---- overlay_colours.svg ----
{
  const hex = rgb => '#' + rgb.map(x => Math.round(255 * x).toString(16).padStart(2, '0')).join('');
  const W = 980, H = 560;
  let s = `<text x="12" y="22" font-size="15" font-weight="bold" fill="${COL.ink}">The damage view (G1804, dmg_overlay.js) - Frame / Overlay mode with ?dmgview=1</text>`;
  s += `<text x="12" y="40" font-size="11" fill="${COL.ink2}">Computed in node by the page's own function; the coordinator eyeballs the real view on the box. One colour a member: broken &gt; set &gt; stress &gt; calm.</text>`;
  INST.legend.forEach((r, i) => {
    const y = 70 + i * 30;
    s += `<rect x="16" y="${y - 12}" width="44" height="18" rx="4" fill="${r.hex}"/><text x="70" y="${y + 2}" font-size="12" fill="${COL.ink}">${esc(r.kind)}</text>`;
    s += `<text x="130" y="${y + 2}" font-size="12" fill="${COL.ink2}">${esc(r.at)}</text><text x="290" y="${y + 2}" font-size="11" fill="${COL.ink2}" font-family="monospace">${r.hex}</text>`;
  });
  // the crash from above (the CG at the centre, x along the track up the page)
  // the members still together (a broken one whose ends have parted is not drawn), fitted into the panel
  const B = INST.crashTop.filter(b => !(b[4] === 'broken' && Math.hypot(b[2] - b[0], b[3] - b[1]) > 4));
  const px0 = 360, px1 = W - 20, py0 = 80, py1 = H - 40;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const b of B) { u0 = Math.min(u0, b[1], b[3]); u1 = Math.max(u1, b[1], b[3]); v0 = Math.min(v0, b[0], b[2]); v1 = Math.max(v1, b[0], b[2]); }
  const sc = Math.min((px1 - px0) / (u1 - u0), (py1 - py0) / (v1 - v0)), cx = (px0 + px1) / 2 - (u0 + u1) / 2 * sc, cy = (py0 + py1) / 2 + (v0 + v1) / 2 * sc;
  s += `<text x="${px0}" y="62" font-size="12" font-weight="bold" fill="${COL.ink}">the Cub, 30 m/s into a trunk, at rest - from above</text>`;
  const k2n = { calm: 0, stress: 1, set: 2, broken: 3 };
  for (const b of B.slice().sort((p, q) => k2n[p[4]] - k2n[q[4]])) {
    const [ax, az, bx, bz, kind, rgb] = b;
    s += `<line x1="${(cx + az * sc).toFixed(1)}" y1="${(cy - ax * sc).toFixed(1)}" x2="${(cx + bz * sc).toFixed(1)}" y2="${(cy - bx * sc).toFixed(1)}" stroke="${hex(rgb)}" stroke-width="${kind === 'calm' ? 1 : 2}"/>`;
  }
  const kc = INST.crashKinds;
  s += `<text x="${px0}" y="${H - 16}" font-size="11" fill="${COL.ink2}">${esc('members: ' + kc.calm + ' calm, ' + kc.stress + ' stressed, ' + kc.set + ' set, ' + kc.broken + ' broken')}</text>`;
  fs.writeFileSync(path.join(OUT, 'overlay_colours.svg'), svgDoc(W, H, s, 'The damage view'));
}
console.log('wrote ' + OUT);
