#!/usr/bin/env node
// dmg_members_evidence.js - DMG-D1a MEMBERS' pictures (G1810-G1817), node only: reports/evidence/DMG-D1a/
//   breakorder.svg      the bench to destruction (the garage's rig, damage on, the bags ramped to 60 g), each validated
//                       build: the members broken against the bags' load factor, each dot its seam's colour; the
//                       first member and the first group named
//   front_<build>.svg   the wing seen from ahead on the bench, the frame the first group let go: the members broken,
//                       coloured by seam (dashed), the rest grey
//   ragged.svg          a spruce member letting go on the bench (G1814): its force against time through its stages,
//                       per substep, against its strength, 60 % and 30 %
//   topdown_<case>.svg  TREECRASH's wing into a trunk at 30 m/s, 2.5 m out: the beams from above 0.6 s after the first break, broken
//                       members by seam, the kinked ones (their floors, G1813) marked
//   runs.json           every run's numbers
// Run: node tools/dmg_members_evidence.js
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./_treecrash_lib.js');
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D1a');
fs.mkdirSync(OUT, { recursive: true });
// the dataviz reference instance: the categorical slots 1-4 for the seams (validated: light, all checks pass; the
// two light hues are under 3:1, so every chart carries its legend with the labels), grey for a member with none
const SEAMCOL = { fitting: '#2a78d6', rivet: '#eb6834', bond: '#1baf7a', opening: '#eda100', none: '#8a8984' };
const COL = { ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', beam: '#c9c8c2', surf: '#fcfcfb', ref: '#52514e' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${COL.surf}"/>${body}</svg>`;
const txt = (x, y, s, o) => `<text x="${x}" y="${y}" font-size="${(o && o.size) || 11}" fill="${(o && o.fill) || COL.ink2}"${o && o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o && o.bold ? ' font-weight="bold"' : ''}>${esc(s)}</text>`;
const legend = (x, y) => Object.entries(SEAMCOL).map(([k, c], i) => `<rect x="${x + i * 92}" y="${y - 9}" width="10" height="10" rx="2" fill="${c}"/>` + txt(x + i * 92 + 14, y, k === 'none' ? 'no seam' : k)).join('');
const seamOf = b => b.seam || 'none';
const C = L.core();
const RUNS = {};

// ---- the bench to destruction, recorded ----
function bench(k, traceBeam) {
  const def = L.defOf(k), spec = def.spec, sim = C.makeSim(def, null); sim.reset(0);
  const ULT = 60;
  const rig = C.makeLoadTest(sim, def, { material: spec.fuselage && spec.fuselage.material, wingMaterial: C.genSurfKey(spec, 'wing', 0), surface: 'wing', ult: ULT, rampS: ULT / 5.7 * 2 });
  const trace = [];
  if (traceBeam != null) {   // per substep: the rig steps the sim one substep a call
    const step0 = sim.step.bind(sim), b = sim.beams[traceBeam];
    sim.step = function (dt, n) { const r = step0(dt, n); const a3 = b.a * 3, b3 = b.b * 3;
      const Lc = Math.hypot(sim.p[b3] - sim.p[a3], sim.p[b3 + 1] - sim.p[a3 + 1], sim.p[b3 + 2] - sim.p[a3 + 2]);
      trace.push([sim.t, b.k * (Lc - b.L0), b.rgS, b.broken ? 1 : 0]); if (trace.length > 400000) trace.splice(0, 200000); return r; };
  }
  const breaks = [];
  let seen = 0, g0 = null, snap = null;
  for (let f = 0; f < 60 * 60 && !rig.state.done; f++) {
    rig.step(1 / 60);
    const D = sim.damage();
    for (; seen < D.broken.length; seen++) { const bi = D.broken[seen], b = sim.beams[bi]; breaks.push({ bi, n: rig.state.n, seam: seamOf(b), cls: b.cls }); }
    if (!g0 && D.groups.length) g0 = { key: D.groups[0].key, n: rig.state.n, t: D.groups[0].t };
    if (g0 && !snap) snap = { p: Array.from(sim.p), broken: D.broken.slice() };
    if (g0 && sim.t - g0.t > 0.5) break;
  }
  const D = sim.damage();
  return { def, sim, breaks, g0, snap, first: D.firstBreak, rag: D.rag.slice(), trace };
}

const KEYS = Object.keys(L.BUILDS);
const BR = {};
for (const k of KEYS) { BR[k] = bench(k); const r = BR[k];
  RUNS['bench:' + k] = { first: r.first, firstSeam: r.first && seamOf(r.sim.beams[r.first.beam]), firstAt: r.breaks.length ? r.breaks[0].n : null, group: r.g0, breaks: r.breaks.map(x => [x.n, x.seam, x.cls]) };
  console.log('bench', k, 'first', r.breaks[0] && r.breaks[0].n.toFixed(2), 'g', r.breaks[0] && r.breaks[0].seam, 'group', r.g0 && r.g0.key + ' @ ' + r.g0.n.toFixed(2)); }

// ---- breakorder.svg: small multiples, one row a build ----
{
  const W = 860, rowH = 120, top = 58, padL = 150, padR = 30, xMax = 32;
  const X = n => padL + (W - padL - padR) * Math.min(n, xMax) / xMax;
  let body = txt(10, 22, 'DMG-D1a: the bench to destruction - the members broken against the bags\' load factor (g)', { size: 15, bold: true, fill: COL.ink }) + legend(10, 44);
  KEYS.forEach((k, i) => {
    const r = BR[k], y0 = top + i * rowH + 18, y1 = y0 + rowH - 40, nMax = Math.max(1, r.breaks.length);
    const Y = c => y1 - (y1 - y0) * c / nMax;
    body += txt(10, y0 + 12, L.BUILDS[k].label, { size: 12, bold: true, fill: COL.ink });
    body += txt(10, y0 + 28, r.breaks.length + ' members broken');
    body += `<line x1="${padL}" y1="${y1}" x2="${W - padR}" y2="${y1}" stroke="${COL.grid}"/>`;
    for (let g = 0; g <= xMax; g += 4) body += `<line x1="${X(g)}" y1="${y0}" x2="${X(g)}" y2="${y1}" stroke="${COL.grid}" stroke-width="0.5"/>` + (i === KEYS.length - 1 ? txt(X(g), y1 + 14, g + ' g', { anchor: 'middle' }) : '');
    body += `<line x1="${X(5.7)}" y1="${y0}" x2="${X(5.7)}" y2="${y1}" stroke="${COL.ref}" stroke-dasharray="3 3"/>` + (i === 0 ? txt(X(5.7) + 3, y0 + 8, 'ultimate 5.7 g', { size: 10 }) : '');
    let pts = `${X(0)},${y1}`;
    r.breaks.forEach((b, j) => { pts += ` ${X(b.n)},${Y(j)} ${X(b.n)},${Y(j + 1)}`; });
    body += `<polyline points="${pts}" fill="none" stroke="${COL.ink2}" stroke-width="1.5"/>`;
    r.breaks.forEach((b, j) => { body += `<circle cx="${X(b.n)}" cy="${Y(j + 1)}" r="4" fill="${SEAMCOL[b.seam]}" stroke="${COL.surf}" stroke-width="1.5"><title>${esc(b.cls + ' ' + b.seam + ' at ' + b.n.toFixed(2) + ' g')}</title></circle>`; });
    const f = r.breaks[0];
    if (f) body += txt(X(f.n) - 6, y0 + 12, 'first: ' + f.cls + ' ' + (f.seam === 'none' ? '(no seam)' : f.seam) + ' at ' + f.n.toFixed(1) + ' g; first group ' + (r.g0 ? r.g0.key + ' at ' + r.g0.n.toFixed(1) + ' g' : '-'), { anchor: 'end', fill: COL.ink });
  });
  fs.writeFileSync(path.join(OUT, 'breakorder.svg'), svgDoc(W, top + KEYS.length * rowH + 20, body, 'DMG-D1a break order on the bench'));
}

// ---- front_<build>.svg: the wing from ahead, 0.25 s after the first group ----
for (const k of KEYS) {
  const r = BR[k]; if (!r.snap) continue;
  const sim = r.sim, P = r.snap.p, br = new Set(r.snap.broken), ax = sim.axes();   // inverted on the trestles: read it in its own axes
  const c = sim.cgPos(), loc = i => { const d = [P[i * 3] - c[0], P[i * 3 + 1] - c[1], P[i * 3 + 2] - c[2]]; return [d[0] * ax[2][0] + d[1] * ax[2][1] + d[2] * ax[2][2], d[0] * ax[1][0] + d[1] * ax[1][1] + d[2] * ax[1][2]]; };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < sim.n; i++) { const [x, y] = loc(i); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const W = 860, H = 380, s = Math.min((W - 40) / (x1 - x0), (H - 90) / (y1 - y0 + 1e-6)), ox = 20 - x0 * s, oy = 70 + y1 * s;
  let body = txt(10, 22, 'DMG-D1a: ' + L.BUILDS[k].label + ' on the bench, the frame the first group let go (' + (r.g0 ? r.g0.key + ' at ' + r.g0.n.toFixed(1) + ' g' : '-') + ') - from ahead, body axes', { size: 14, bold: true, fill: COL.ink }) + legend(10, 46);
  const lines = [[], []];
  sim.beams.forEach((b, i) => { const [ax_, ay] = loc(b.a), [bx, by] = loc(b.b), on = br.has(i);
    lines[on ? 1 : 0].push(`<line x1="${(ox + ax_ * s).toFixed(1)}" y1="${(oy - ay * s).toFixed(1)}" x2="${(ox + bx * s).toFixed(1)}" y2="${(oy - by * s).toFixed(1)}" stroke="${on ? SEAMCOL[seamOf(b)] : COL.beam}" stroke-width="${on ? 2 : 1}"${on ? ' stroke-dasharray="5 2"' : ''}/>`); });
  body += lines[0].join('') + lines[1].join('');
  fs.writeFileSync(path.join(OUT, 'front_' + k + '.svg'), svgDoc(W, H, body, 'DMG-D1a ' + k + ' on the bench'));
}

// ---- ragged.svg: one spruce member, per substep ----
{
  const k = KEYS.find(kk => { const r = BR[kk]; for (let i = 0; i < r.rag.length; i += 3) if (r.rag[i + 1] >= 2) return true; return false; });
  if (k) {
    const r0 = BR[k], ids = []; for (let i = 0; i < r0.rag.length; i += 3) if (!ids.includes(r0.rag[i])) ids.push(r0.rag[i]);
    const bi = ids.find(id => { let s = 0; for (let i = 0; i < r0.rag.length; i += 3) if (r0.rag[i] === id) s = Math.max(s, r0.rag[i + 1]); return s >= r0.sim.beams[id].rgN && r0.sim.beams[id].rgN === 3; }) ?? ids[0];
    const r = bench(k, bi), b = r.sim.beams[bi];
    const st = []; for (let i = 0; i < r.rag.length; i += 3) if (r.rag[i] === bi) st.push([r.rag[i + 1], r.rag[i + 2]]);
    const tc = st[0][1], tr = r.trace.filter(x => x[0] > tc - 0.004 && x[0] < st[st.length - 1][1] + 0.003);
    const W = 860, H = 380, padL = 70, padR = 30, top = 60, bot = 320, Fy = b.fy0 / 1000;
    const X = t => padL + (W - padL - padR) * (t - (tc - 0.004)) / ((st[st.length - 1][1] + 0.003) - (tc - 0.004));
    const fMax = Math.max(Fy * 1.1, ...tr.map(x => x[1] / 1000)), fMin = Math.min(0, ...tr.map(x => x[1] / 1000));
    const Y = f => bot - (bot - top) * (f - fMin) / (fMax - fMin);
    let body = txt(10, 22, 'DMG-D1a (G1814): a spruce member lets go in ' + b.rgN + ' stages on the ' + L.BUILDS[k].label + '\'s bench - its axial force, per substep', { size: 14, bold: true, fill: COL.ink });
    body += txt(10, 42, L.BUILDS[k].label + ' member ' + bi + ' (' + b.cls + ', ' + (b.seam || 'no seam') + '), its strength ' + Fy.toFixed(1) + ' kN (the +-15 % scatter in); crack to gone ' + (1000 * (st[st.length - 1][1] - st[0][1])).toFixed(2) + ' ms');
    for (const [fr, lab] of [[1, 'strength'], [0.6, '60 %'], [0.3, '30 %']]) body += `<line x1="${padL}" y1="${Y(Fy * fr)}" x2="${W - padR}" y2="${Y(Fy * fr)}" stroke="${COL.ref}" stroke-dasharray="3 3"/>` + txt(W - padR - 2, Y(Fy * fr) - 4, lab, { anchor: 'end', size: 10 });
    body += `<line x1="${padL}" y1="${Y(0)}" x2="${W - padR}" y2="${Y(0)}" stroke="${COL.grid}"/>`;
    for (let t = -4; tc + t / 1000 <= st[st.length - 1][1] + 0.003; t++) body += `<line x1="${X(tc + t / 1000)}" y1="${bot}" x2="${X(tc + t / 1000)}" y2="${bot + 4}" stroke="${COL.ink2}"/>` + txt(X(tc + t / 1000), bot + 16, t + ' ms', { anchor: 'middle', size: 10 });
    const step = Fy > 40 ? 20 : Fy > 10 ? 5 : 1;
    for (let f = Math.ceil(fMin / step) * step; f <= fMax; f += step) body += txt(padL - 6, Y(f) + 4, f.toFixed(0), { anchor: 'end', size: 10 });
    body += `<polyline points="${tr.map(x => X(x[0]).toFixed(1) + ',' + Y(x[1] / 1000).toFixed(1)).join(' ')}" fill="none" stroke="${SEAMCOL.fitting}" stroke-width="2"/>`;
    st.forEach(([s, t]) => { body += `<line x1="${X(t)}" y1="${top}" x2="${X(t)}" y2="${bot}" stroke="${COL.ink2}" stroke-width="0.6"/>` + txt(X(t) + 3, top + 10, s === 1 ? 'crack' : s >= b.rgN ? 'gone' : 'stage ' + s, { size: 10, fill: COL.ink }); });
    body += txt(padL - 40, top - 6, 'kN', { size: 11 });
    fs.writeFileSync(path.join(OUT, 'ragged.svg'), svgDoc(W, H, body, 'DMG-D1a ragged break'));
    RUNS.ragged = { build: k, beam: bi, stages: st, Fy };
  }
}

// ---- topdown_<case>.svg: the wing into a trunk at 30 m/s, 2.5 m out ----
for (const k of KEYS.filter(kk => !/floats/i.test(kk))) {
  const r = L.atTrunk(k, { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 2.5, every: 6 }), sim = L.lastRun.sim, D = sim.damage();
  const tW = D.firstBreak ? D.firstBreak.t + 0.6 : 2, fr = r.frames.reduce((a, f) => (Math.abs(f.t - tW) < Math.abs(a.t - tW) ? f : a), r.frames[0]), br = new Set(fr.broken);
  RUNS['trunk:' + k] = { first: D.firstBreak, groups: D.groups.map(G => [G.key, G.t]), breaks: D.breaks, floors: D.floors, cracks: D.cracks };
  const xs = fr.beams.flat().map(q => q[0]), zs = fr.beams.flat().map(q => q[1]);
  const x0 = Math.min(...xs, r.trunk[0]) - 1, x1 = Math.max(...xs, r.trunk[0]) + 1, z0 = Math.min(...zs, r.trunk[1]) - 1, z1 = Math.max(...zs, r.trunk[1]) + 1;
  const W = 860, H = 560, s = Math.min((W - 40) / (x1 - x0), (H - 90) / (z1 - z0)), ox = 20 - x0 * s, oy = 70 - z0 * s;
  let body = txt(10, 22, 'DMG-D1a: ' + L.BUILDS[k].label + ' at 30 m/s, the wing 2.5 m out - 0.6 s after the first break, from above (' + fr.broken.length + ' broken; kinked ringed)', { size: 14, bold: true, fill: COL.ink }) + legend(10, 46);
  const lines = [[], []];
  fr.beams.forEach(([a, b], i) => { const on = br.has(i), bm = sim.beams[i];
    lines[on ? 1 : 0].push(`<line x1="${(ox + a[0] * s).toFixed(1)}" y1="${(oy + a[1] * s).toFixed(1)}" x2="${(ox + b[0] * s).toFixed(1)}" y2="${(oy + b[1] * s).toFixed(1)}" stroke="${on ? SEAMCOL[seamOf(bm)] : COL.beam}" stroke-width="${on ? 2 : 1}"${on ? ' stroke-dasharray="5 2"' : ''}/>`);
    if (bm.kink) lines[1].push(`<circle cx="${(ox + (a[0] + b[0]) / 2 * s).toFixed(1)}" cy="${(oy + (a[1] + b[1]) / 2 * s).toFixed(1)}" r="6" fill="none" stroke="${COL.ink}" stroke-width="1.2"/>`); });
  body += lines[0].join('') + lines[1].join('');
  body += `<circle cx="${ox + r.trunk[0] * s}" cy="${oy + r.trunk[1] * s}" r="${Math.max(3, r.trunkR * s)}" fill="#52514e"/>` + txt(ox + r.trunk[0] * s + Math.max(3, r.trunkR * s) + 4, oy + r.trunk[1] * s + 4, 'trunk');
  body += txt(10, H - 12, 'by the end (5 s): first member ' + (D.firstBreak ? D.firstBreak.cls + ' ' + (D.firstBreak.seam || '(no seam)') + ' (' + D.firstBreak.how + ')' : '-') + '; groups ' + (D.groups.map(G => G.key).join(', ') || '-') + '; ' + D.breaks + ' broken, ' + D.floors + ' kink floors, ' + D.cracks + ' spruce cracks', { fill: COL.ink });
  fs.writeFileSync(path.join(OUT, 'topdown_wing30_' + k + '.svg'), svgDoc(W, H, body, 'DMG-D1a ' + k + ' wing into a trunk'));
}
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(RUNS, null, 1));
console.log('wrote', fs.readdirSync(OUT).join(', '));
