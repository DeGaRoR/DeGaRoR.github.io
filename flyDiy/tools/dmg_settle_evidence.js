#!/usr/bin/env node
// G2044-G2046 (DMG-SETTLE): THE EVIDENCE - GATE DMGSETTLE's children run twice per build, with the bug as found (--bug: no
// standoff, the scraps riding their node, the bodies on their box's corners) and as fixed, into
// reports/evidence/DMG-SETTLE/: settle_<build>.json (both runs' series) and settle_<build>.svg - each piece's gap over the
// ground through the 15 s (the physics: its lowest node's contact bottom; the drawing: its covering's lowest live vertex,
// a loose piece's island or scrap body), before dashed, after solid - and debris.svg (the stand-ins' drops, held / not).
//   node tools/dmg_settle_evidence.js [--builds cub,jodel,metal] [--from dir]   (--from: reuse the JSON already there)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'reports', 'evidence', 'DMG-SETTLE');
fs.mkdirSync(OUT, { recursive: true });
const BUILDS = String(arg('--builds', 'cub,jodel,metal')).split(',');
const child = (k, bug) => new Promise(res => {
  const ch = spawn(process.execPath, ['--max-old-space-size=6144', path.join(__dirname, '_dmg_settle_check.js'), '--build', k].concat(bug ? ['--bug'] : []), { stdio: ['ignore', 'pipe', 'pipe'] });
  let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
  ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1500) }); });
});

// ---- the drawing (the dataviz reference palette: blue the physics, orange the drawing; text in ink tokens) ----
const CSS = `<style>
:root{--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e4e3df;--zero:#9b9a95;--phys:#2a78d6;--draw:#eb6834;--band:#f0efec}
@media (prefers-color-scheme: dark){:root{--bg:#1a1a19;--ink:#ffffff;--ink2:#c3c2b7;--grid:#383835;--zero:#6f6e69;--phys:#3987e5;--draw:#d95926;--band:#262624}}
svg{background:var(--bg);font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.t{fill:var(--ink);font-size:13px;font-weight:600}.s{fill:var(--ink2);font-size:11px}.a{fill:var(--ink2);font-size:10px}
.g{stroke:var(--grid);stroke-width:1}.z{stroke:var(--zero);stroke-width:1}.band{fill:var(--band)}
.p{stroke:var(--phys);fill:none;stroke-width:2}.d{stroke:var(--draw);fill:none;stroke-width:2}.b{stroke-dasharray:5 4;stroke-width:1.5;opacity:.85}
.pm{fill:var(--phys)}.dm{fill:var(--draw)}
</style>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function panel(x0, y0, w, h, title, sub, lines, yr) {
  // lines: [{ cls, pts: [[t, gap m]], tip }]; yr: [lo, hi] cm
  const [lo, hi] = yr, X = t => x0 + 40 + (w - 50) * t / 15, Y = v => y0 + 34 + (h - 54) * (1 - (v * 100 - lo) / (hi - lo));
  let s = `<g><text class="t" x="${x0 + 4}" y="${y0 + 14}">${esc(title)}</text><text class="s" x="${x0 + 4}" y="${y0 + 28}">${esc(sub)}</text>`;
  // the tolerance band (the gate's: +2 cm over the ground for the drawing)
  s += `<rect class="band" x="${X(0)}" y="${Y(0.02)}" width="${X(15) - X(0)}" height="${Math.max(0, Y(-0.02) - Y(0.02))}"/>`;
  const step = (hi - lo) > 40 ? 10 : 5;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) s += `<line class="${v === 0 ? 'z' : 'g'}" x1="${X(0)}" x2="${X(15)}" y1="${Y(v / 100)}" y2="${Y(v / 100)}"/><text class="a" x="${x0 + 36}" y="${Y(v / 100) + 3}" text-anchor="end">${v}</text>`;
  for (let t = 0; t <= 15; t += 5) s += `<text class="a" x="${X(t)}" y="${y0 + h - 6}" text-anchor="middle">${t} s</text>`;
  for (const L of lines) { if (!L.pts.length) continue;
    const cl = (v) => Math.max(lo / 100, Math.min(hi / 100, v));
    s += `<path class="${L.cls}" d="${L.pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(cl(p[1])).toFixed(1)).join(' ')}"><title>${esc(L.tip)}</title></path>`;
    const e = L.pts[L.pts.length - 1];
    s += `<circle class="${L.cls.indexOf('p') === 0 ? 'pm' : 'dm'}" cx="${X(e[0])}" cy="${Y(cl(e[1]))}" r="${L.cls.indexOf(' b') > 0 ? 2.5 : 4}"><title>${esc(L.tip + ' at ' + e[0] + ' s: ' + (e[1] * 100).toFixed(1) + ' cm')}</title></circle>`; }
  return s + '</g>';
}
function seriesOf(run, cid, label, loose) {
  const c = run.cases.find(x => x.id === cid); if (!c) return { phys: [], draw: [] };
  const phys = [], draw = [];
  for (const row of c.series) {
    const p = row.pieces.find(q => q.label === label && !q.core); if (!p) continue;
    phys.push([row.t, p.node]);
    if (loose) { const b = (row.bodies || []).find(q => q.label && q.label.split('+').includes(String(p.tags.split(',')[0])) && q.x);
      const v = p.any != null ? p.any : (b ? b.lo : null); if (v != null) draw.push([row.t, v]); }
    else if (p.cover != null) draw.push([row.t, p.cover]);
  }
  return { phys, draw };
}
function svgOf(k, before, after) {
  const panels = [];
  for (const cid of ['trunk-0', 'trunk-2.5']) {
    const labels = new Map();
    for (const run of [before, after]) { const c = run.cases.find(x => x.id === cid); if (!c) continue;
      for (const row of c.series) for (const p of row.pieces) if (!p.core && !labels.has(p.label)) labels.set(p.label, p); }
    for (const [label, p] of labels) {
      const loose = p.n < 3, B = seriesOf(before, cid, label, loose), A = seriesOf(after, cid, label, loose);
      const ends = s => s.length ? s[s.length - 1][1] : null, f = v => v == null ? '-' : (v * 100 >= 0 ? '+' : '') + (v * 100).toFixed(1);
      const sub = (loose ? 'drawn (island riding it / its scrap body)' : 'drawn (covering)') + ' at rest: ' + f(ends(B.draw)) + ' -> ' + f(ends(A.draw)) + ' cm; node ' + f(ends(B.phys)) + ' -> ' + f(ends(A.phys)) + ' cm';
      const all = [].concat(B.phys, B.draw, A.phys, A.draw).map(q => q[1] * 100).filter(Number.isFinite);
      const lo = Math.max(-40, Math.floor(Math.min(-5, ...all.map(v => Math.max(v, -40))) / 5) * 5), hi = Math.min(60, Math.ceil(Math.max(5, ...all.filter(v => v < 60)) / 5) * 5);
      panels.push({ title: cid + ' - piece #' + label + ' (' + p.n + ' node' + (p.n > 1 ? 's' : '') + ', ' + p.M + ' kg: ' + p.tags + ')', sub,
        lines: [{ cls: 'p b', pts: B.phys, tip: 'before: lowest node' }, { cls: 'd b', pts: B.draw, tip: 'before: drawn' }, { cls: 'p', pts: A.phys, tip: 'after: lowest node' }, { cls: 'd', pts: A.draw, tip: 'after: drawn' }], yr: [lo, hi] });
    }
  }
  const W = 980, PW = 480, PH = 190, cols = 2, rows = Math.ceil(panels.length / cols), H = 92 + rows * (PH + 14);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="DMG-SETTLE ${k}: each detached piece's gap over the ground, before and after">${CSS}`;
  s += `<text class="t" x="12" y="22" style="font-size:16px">DMG-SETTLE - ${esc(before.label || k)}: each detached piece's height over the ground (cm), 30 m/s trunk break-up</text>`;
  s += `<text class="s" x="12" y="40">blue: its lowest node's contact bottom (the physics) - orange: its lowest drawn point (the covering; a loose node's island / scrap body) - dashed: before (the bug as found), solid: after; shaded: +-2 cm</text>`;
  s += `<line class="p" x1="12" x2="36" y1="60" y2="60"/><text class="s" x="40" y="64">physics after</text><line class="p b" x1="130" x2="154" y1="60" y2="60"/><text class="s" x="158" y="64">physics before</text>`;
  s += `<line class="d" x1="270" x2="294" y1="60" y2="60"/><text class="s" x="298" y="64">drawn after</text><line class="d b" x1="390" x2="414" y1="60" y2="60"/><text class="s" x="418" y="64">drawn before</text>`;
  panels.forEach((P, i) => { s += panel(8 + (i % cols) * (PW + 8), 80 + Math.floor(i / cols) * (PH + 14), PW, PH, P.title, P.sub, P.lines, P.yr); });
  return s + '</svg>';
}
function debrisSvg(R) {
  const rows = []; for (const k of BUILDS) { const b = R[k].before, a = R[k].after; if (!b || !a || b.err || a.err) continue;
    for (const s of a.standins) { const s0 = b.standins.find(x => x.kind === s.kind); rows.push({ k: b.label || k, kind: s.kind, held0: s0 ? s0.held : 0, held1: s.held, n: s.drops, lo0: s0 ? s0.loMin : null }); } }
  const W = 760, H = 70 + rows.length * 22 + 20, X0 = 260, BW = 420, X = v => X0 + BW * v / 20;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="DMG-SETTLE debris: drops held before and after">${CSS}`;
  s += `<text class="t" x="12" y="22" style="font-size:16px">DMG-SETTLE - debris bodies resting HELD by their drawing (of 20 seeded drops)</text>`;
  s += `<text class="s" x="12" y="40">dot hollow: before (contact on the box's 8 corners) - dot solid: after (the drawn part's support points); held = its centre over its drawn points on the ground</text>`;
  for (let v = 0; v <= 20; v += 5) s += `<line class="g" x1="${X(v)}" x2="${X(v)}" y1="54" y2="${H - 20}"/><text class="a" x="${X(v)}" y="${H - 6}" text-anchor="middle">${v}</text>`;
  rows.forEach((r, i) => { const y = 66 + i * 22;
    s += `<text class="s" x="12" y="${y + 4}">${esc(r.k + ' - ' + r.kind)}</text><line class="g" x1="${X(r.held0)}" x2="${X(r.held1)}" y1="${y}" y2="${y}" style="stroke-width:2"/>`;
    s += `<circle cx="${X(r.held0)}" cy="${y}" r="5" style="fill:var(--bg);stroke:var(--draw);stroke-width:2"><title>before: ${r.held0}/${r.n} held</title></circle><circle class="pm" cx="${X(r.held1)}" cy="${y}" r="5"><title>after: ${r.held1}/${r.n} held</title></circle>`;
    s += `<text class="a" x="${X(20) + 10}" y="${y + 4}">${r.held0} -> ${r.held1}</text>`; });
  return s + '</svg>';
}
(async () => {
  const R = {};
  const from = arg('--from', null);
  const jobs = [];
  for (const k of BUILDS) { R[k] = {}; if (from) { const J = JSON.parse(fs.readFileSync(path.join(from, 'settle_' + k + '.json'), 'utf8')); R[k] = J; continue; }
    jobs.push([k, true], [k, false]); }
  const q = jobs.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const [k, bug] = q.shift(); const r = await child(k, bug); R[k][bug ? 'before' : 'after'] = r; console.log(k + (bug ? ' before' : ' after') + (r.err ? ' ERROR ' + r.err : ' done')); } }));
  for (const k of BUILDS) {
    if (!from) fs.writeFileSync(path.join(OUT, 'settle_' + k + '.json'), JSON.stringify(R[k]));
    if (R[k].before && R[k].after && !R[k].before.err && !R[k].after.err) fs.writeFileSync(path.join(OUT, 'settle_' + k + '.svg'), svgOf(k, R[k].before, R[k].after));
  }
  fs.writeFileSync(path.join(OUT, 'debris.svg'), debrisSvg(R));
  console.log('written to ' + path.relative(ROOT, OUT));
})();
