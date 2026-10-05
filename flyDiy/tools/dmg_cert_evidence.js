#!/usr/bin/env node
// dmg_cert_evidence.js - DMG-D2a CERTIFICATE's evidence (G1830-G1834), node only: reports/evidence/DMG-D2a/
//   envelope.json     per build: the per-member envelope at limit by class (members, the median and largest share of
//                     their physics yield), which case governs how many members, the floor's share, the cost
//   envelope.svg      the governing cases per build (tension), one bar a case
//   breakat.svg       the bench to destruction on the certified airframe (the free test, ruling dm6): the members
//                     broken against the bags' load factor, LIMIT / ULTIMATE / the band [1.5, 1.5 m] x limit marked;
//                     and the bad design (its struts or wing root at half the section the certificate asks) under it
//   kappa.json/.svg   the census for the floor: per kappa, the members on the floor and the bench's first joint
//                     (linear, from the stamped limits) - why 0.1
//   runs.json         every run's numbers
// Run: node tools/dmg_cert_evidence.js [--plot: redraw the plots from runs.json]
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./_treecrash_lib.js');
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D2a');
fs.mkdirSync(OUT, { recursive: true });
const C = L.core(), K = C.GEN_CERT;
const COL = { ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', surf: '#fcfcfb', ref: '#52514e', bad: '#d03c3c', one: '#2a78d6', two: '#eb6834', three: '#1baf7a', four: '#eda100' };
const SEAMCOL = { fitting: '#2a78d6', rivet: '#eb6834', bond: '#1baf7a', opening: '#eda100', none: '#8a8984' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${COL.surf}"/>${body}</svg>`;
const txt = (x, y, s, o) => `<text x="${x}" y="${y}" font-size="${(o && o.size) || 11}" fill="${(o && o.fill) || COL.ink2}"${o && o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o && o.bold ? ' font-weight="bold"' : ''}>${esc(s)}</text>`;
const KEYS = Object.keys(L.BUILDS), RUNS = {};
const BW = require(path.join(__dirname, '..', 'src', 'viewer', 'bench_worker.js'));

function destroy(def) {
  const sim = C.makeSim(def, null); sim.reset(0);
  const cfg = BW.benchLoadCfg({ genSurfKey: C.genSurfKey }, def.spec, { destroy: true, surface: 'wing' });
  cfg.ult = 3 * C.GEN_LOAD_ULT; cfg.rampS = 4 * cfg.ult / C.GEN_LOAD_ULT;
  const rig = C.makeLoadTest(sim, def, cfg), breaks = [];
  let seen = 0;
  for (let f = 0; f < 60 * 120 && !rig.state.done; f++) {
    rig.step(1 / 60);
    const D = sim.damage();
    for (; seen < D.broken.length; seen++) { const b = sim.beams[D.broken[seen]]; breaks.push([rig.state.n, b.seam || 'none', b.cls]); }
  }
  const st = rig.state;
  return { verdict: st.verdict, brokeAt: st.brokeAt, brokeKey: st.brokeKey, brokeSeam: st.brokeSeam, yieldAt: st.yieldAt, breakAt: st.breakAt, breaks };
}
function badOf(k, def, sim, phys) {
  const bad = Object.assign({}, L.defOf(k, { cert: false })), groups = bad.parts.dmg.groups;
  const strut = groups.filter(G => /:strut$/.test(G.key)), root = groups.filter(G => /:root$/.test(G.key));
  const pick = new Set((strut.length ? strut : root).flatMap(G => G.t0));
  bad.beams = bad.beams.map((b, i) => (pick.has(i) ? Object.assign({}, b, { A: b.A * Math.min(1 / 3, 0.5 * sim.beams[i].fu / phys.beams[i].fu) }) : b));
  bad.spec = Object.assign({}, bad.spec, { meta: Object.assign({}, bad.spec.meta || {}, { badDesign: 1 }) });
  bad.cert = C.genCertify(bad, { world: bad.parts.floats ? C.makeWorld() : null });
  return { what: strut.length ? 'lift struts' : 'wing root', def: bad };
}
let ENV = {}, DES = {}, BAD = {}, KAP = {};
const PLOT = process.argv.includes('--plot');
if (PLOT) ({ envelope: ENV, destroy: DES, bad: BAD, kappa: KAP } = JSON.parse(fs.readFileSync(path.join(OUT, 'runs.json'), 'utf8')));
for (const k of PLOT ? [] : KEYS) {
  const t0 = Date.now(), cert = L.certOf(k), ms = Date.now() - t0;
  const def = L.defOf(k, { cert: true }), sim = C.makeSim(def, null), phys = C.makeSim(L.defOf(k, { cert: false }), null);
  // the envelope by class
  const cls = {}, gov = {};
  for (let i = 0; i < def.beams.length; i++) {
    const b = sim.beams[i], p = phys.beams[i]; if (b.cls === 'gear' || !(p.fy0 < Infinity)) continue;
    const c = cls[b.cls] || (cls[b.cls] = { n: 0, r: [], floorT: 0 });
    c.n++; c.r.push(cert.Ft[i] / p.fy0); if (!(b.fu > K.kappa * p.fu * (1 + 1e-9))) c.floorT++;
    const g = cert.names[cert.byT[i]] || 'none'; gov[g] = (gov[g] || 0) + 1;
  }
  for (const c of Object.values(cls)) { c.r.sort((a, b) => a - b); c.median = c.r[c.r.length >> 1]; c.max = c.r[c.r.length - 1]; delete c.r; }
  ENV[k] = { ms, msParts: cert.ms, cases: cert.names, cls, gov, speeds: cert.speeds, aero: cert.aero, sink: cert.sink, flownNz: cert.flownNz };
  // to destruction, and the bad design
  DES[k] = destroy(def);
  const bd = badOf(k, def, sim, phys); BAD[k] = Object.assign({ what: bd.what }, destroy(bd.def));
  // the kappa census: the stamp redone at each kappa, the bench's first joint (linear) and the members on the floor
  KAP[k] = [0.05, 0.1, 0.15, 0.2, 0.3].map(kap => {
    const k0 = K.kappa; K.kappa = kap;
    const s2 = C.makeSim(def, null); K.kappa = k0;
    let g = Infinity, floor = 0, n = 0;
    for (let i = 0; i < def.beams.length; i++) { const b = s2.beams[i], p = phys.beams[i]; if (b.cls === 'gear' || !(p.fy0 < Infinity)) continue; n++;
      if (!(b.fu > kap * p.fu * (1 + 1e-9))) floor++;
      if (b.seam && cert.cases.bench.t[i] > 1) g = Math.min(g, C.GEN_LOAD_LIMIT * b.fu / cert.cases.bench.t[i]); }
    return { kappa: kap, floor, n, firstJoint: g };
  });
  console.log(k, 'cert', ms, 'ms; broke at', DES[k].brokeAt && DES[k].brokeAt.toFixed(2), DES[k].brokeKey, '; bad', BAD[k].verdict, BAD[k].breakAt && BAD[k].breakAt.toFixed(2),
    '; kappa', KAP[k].map(x => x.kappa + ':' + x.floor + '/' + x.n + '@' + x.firstJoint.toFixed(2)).join(' '));
}
RUNS.envelope = ENV; RUNS.destroy = DES; RUNS.bad = BAD; RUNS.kappa = KAP; RUNS.rules = K;
if (!PLOT) {
  fs.writeFileSync(path.join(OUT, 'envelope.json'), JSON.stringify(ENV, null, 1));
  fs.writeFileSync(path.join(OUT, 'kappa.json'), JSON.stringify(KAP, null, 1));
  fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(RUNS, null, 1));
}

// ---- envelope.svg: which case governs how many members (tension), one row a build ----
{
  const cases = [...new Set(KEYS.flatMap(k => Object.keys(ENV[k].gov)))];
  const W = 900, rowH = 30, top = 100, padL = 140, bw = (W - padL - 20) / cases.length;
  let body = txt(10, 22, 'DMG-D2a: the case that sets each member\'s tension limit (members per case)', { size: 15, bold: true, fill: COL.ink });
  cases.forEach((c, j) => { body += `<text transform="translate(${padL + j * bw + bw / 2},${top - 6}) rotate(-40)" font-size="10" fill="${COL.ink2}">${esc(c)}</text>`; });
  KEYS.forEach((k, i) => {
    const y = top + 30 + i * rowH, g = ENV[k].gov, mx = Math.max(...Object.values(g));
    body += txt(10, y + 14, L.BUILDS[k].label, { size: 12, bold: true, fill: COL.ink });
    cases.forEach((c, j) => { const v = g[c] || 0; const h = (rowH - 8) * v / mx;
      body += `<rect x="${padL + j * bw + 3}" y="${y + rowH - 8 - h}" width="${bw - 6}" height="${h}" fill="${COL.one}"><title>${esc(c + ': ' + v)}</title></rect>` + (v ? txt(padL + j * bw + bw / 2, y + rowH - 10 - h, String(v), { size: 9, anchor: 'middle' }) : ''); });
  });
  fs.writeFileSync(path.join(OUT, 'envelope.svg'), svgDoc(W, top + 40 + KEYS.length * rowH, body, 'DMG-D2a governing cases'));
}
// ---- breakat.svg: to destruction and the bad design ----
{
  const W = 900, rowH = 112, top = 64, padL = 160, padR = 30, xMax = 9;
  const X = n => padL + (W - padL - padR) * Math.min(n, xMax) / xMax;
  let body = txt(10, 22, 'DMG-D2a: the bench to destruction on the certified airframe (free) - members broken against the bags\' g', { size: 15, bold: true, fill: COL.ink });
  body += Object.entries(SEAMCOL).map(([s, c], i) => `<rect x="${10 + i * 92}" y="${35}" width="10" height="10" rx="2" fill="${c}"/>` + txt(24 + i * 92, 44, s === 'none' ? 'no seam' : s)).join('') + txt(480, 44, 'red: the bad design (struts / root at half the section asked)', { fill: COL.bad });
  KEYS.forEach((k, i) => {
    const y0 = top + i * rowH + 10, y1 = y0 + rowH - 34;
    const d = DES[k], b = BAD[k], nMax = Math.max(1, d.breaks.length, b.breaks.length);
    const Y = c => y1 - (y1 - y0) * c / nMax;
    body += txt(10, y0 + 12, L.BUILDS[k].label, { size: 12, bold: true, fill: COL.ink }) + txt(10, y0 + 28, 'broke at ' + (d.brokeAt ? d.brokeAt.toFixed(2) + ' g' : '-')) + txt(10, y0 + 42, (d.brokeKey || '') + ' (' + (d.brokeSeam || '') + ')') + txt(10, y0 + 56, 'bad design: first break ' + (b.breakAt ? b.breakAt.toFixed(2) + ' g' : '-'), { fill: COL.bad });
    body += `<rect x="${X(1.5 * 3.8)}" y="${y0}" width="${X(1.5 * K.m * 3.8) - X(1.5 * 3.8)}" height="${y1 - y0}" fill="${COL.grid}"/>`;
    for (let g = 0; g <= xMax; g += 1) body += `<line x1="${X(g)}" y1="${y0}" x2="${X(g)}" y2="${y1}" stroke="${COL.grid}" stroke-width="0.5"/>` + (i === KEYS.length - 1 ? txt(X(g), y1 + 14, g + ' g', { anchor: 'middle' }) : '');
    for (const [g, lab] of [[3.8, 'limit'], [5.7, 'ultimate']]) body += `<line x1="${X(g)}" y1="${y0}" x2="${X(g)}" y2="${y1}" stroke="${COL.ref}" stroke-dasharray="3 3"/>` + (i === 0 ? txt(X(g) + (g > 5 ? -3 : 3), y0 + 8, lab, { size: 10, anchor: g > 5 ? 'end' : undefined }) : '');
    for (const [R, col] of [[b, COL.bad], [d, COL.ink2]]) {
      let pts = `${X(0)},${y1}`; R.breaks.forEach((q, j) => { pts += ` ${X(q[0])},${Y(j)} ${X(q[0])},${Y(j + 1)}`; });
      body += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5"/>`;
      if (R === d) R.breaks.forEach((q, j) => { body += `<circle cx="${X(q[0])}" cy="${Y(j + 1)}" r="3.5" fill="${SEAMCOL[q[1]]}" stroke="${COL.surf}" stroke-width="1"><title>${esc(q[2] + ' ' + q[1] + ' at ' + q[0].toFixed(2) + ' g')}</title></circle>`; });
    }
  });
  fs.writeFileSync(path.join(OUT, 'breakat.svg'), svgDoc(W, top + KEYS.length * rowH + 24, body, 'DMG-D2a to destruction'));
}
// ---- kappa.svg: the bench's first joint against kappa ----
{
  const W = 640, H = 300, padL = 60, padB = 40, top = 40, kx = [0.05, 0.1, 0.15, 0.2, 0.3], gMin = 5, gMax = 10;
  const X = kk => padL + (W - padL - 160) * (kk - 0.05) / 0.25, Y = g => H - padB - (H - padB - top) * (Math.min(g, gMax) - gMin) / (gMax - gMin);
  const cols = [COL.one, COL.two, COL.three, COL.four, '#7a5cc4'];
  let body = txt(10, 22, 'DMG-D2a: the floor kappa - the bench\'s first joint (g) against kappa', { size: 14, bold: true, fill: COL.ink });
  for (let g = gMin; g <= gMax; g += 1) body += `<line x1="${padL}" y1="${Y(g)}" x2="${W - 160}" y2="${Y(g)}" stroke="${COL.grid}"/>` + txt(padL - 6, Y(g) + 4, g + ' g', { anchor: 'end' });
  kx.forEach(kk => { body += txt(X(kk), H - padB + 16, String(kk), { anchor: 'middle' }); });
  body += `<rect x="${padL}" y="${Y(1.5 * K.m * 3.8)}" width="${W - 160 - padL}" height="${Y(5.7) - Y(1.5 * K.m * 3.8)}" fill="${COL.grid}" opacity="0.8"/>` + txt(W - 158, Y(5.85), 'the card\'s band', { size: 10 });
  KEYS.forEach((k, i) => { const pts = KAP[k].map(x => `${X(x.kappa)},${Y(x.firstJoint) + (i - 2) * 2}`).join(' ');   // 2 px apart: they coincide
    body += `<polyline points="${pts}" fill="none" stroke="${cols[i]}" stroke-width="2"/>` + KAP[k].map(x => `<circle cx="${X(x.kappa)}" cy="${Y(x.firstJoint) + (i - 2) * 2}" r="2.5" fill="${cols[i]}"><title>${esc(L.BUILDS[k].label + ' kappa ' + x.kappa + ': first joint ' + x.firstJoint.toFixed(2) + ' g, ' + x.floor + '/' + x.n + ' on the floor')}</title></circle>`).join('') + txt(W - 150, top + 16 + i * 16, L.BUILDS[k].label, { fill: cols[i] }); });
  body += `<line x1="${X(K.kappa)}" y1="${top}" x2="${X(K.kappa)}" y2="${H - padB}" stroke="${COL.ref}" stroke-dasharray="4 3"/>` + txt(X(K.kappa) + 4, top + 10, 'kappa ' + K.kappa, { size: 10 });
  fs.writeFileSync(path.join(OUT, 'kappa.svg'), svgDoc(W, H, body, 'DMG-D2a kappa census'));
}
console.log('wrote', fs.readdirSync(OUT).join(', '));
