// render.js - the PHYSICS-PAGES prototypes: four pictures per plane, SVG, from the numbers the core computed
// (load_*.json, drag.json, elec.json, calib.json) over the baked fiche pictures. Writes gallery.html.
'use strict';
const fs = require('fs'), path = require('path');
const H = __dirname, FI = '/workspace/DeGaRoR.github.io/flyDiy/media/fiches/';
const J = f => JSON.parse(fs.readFileSync(path.join(H, f), 'utf8'));
const DRAG = J('drag.json'), ELEC = J('elec.json'), CAL = J('calib.json');
const LOAD = Object.assign({}, J('load_cub.json'), J('load_c172.json'), J('load_twin.json'));
const SPECS = J('specs.json'), TANKS = J('tanks.json');
const DIR = { cub: 'design_cub', c172: 'list_5', twin: 'cand_Twin_busher_floats_4b.json' };
const NAME = { cub: 'Piper Cub', c172: 'Metal Cessna', twin: 'Twin busher floats 4b' };
const img = (k, v) => 'data:image/webp;base64,' + fs.readFileSync(FI + DIR[k] + '/' + v + '.webp').toString('base64');

// ---- the one palette: a colour per category (the Mass & price page's seven), and the work ramp ----
const CAT = { structure: '#8fb0c4', engine: '#e2a056', gear: '#a9bd6e', systems: '#b99be0',
              fittings: '#6fc2b0', interior: '#e0868a', finish: '#b7ab9b' };
const INK = '#f4efe6', DIM = '#c0b8ac', FAINT = '#97907f', HAIR = 'rgba(255,248,236,.16)', PANEL = '#201d1a';
const RAMP = [[0, [74, 69, 64]], [0.25, [151, 144, 127]], [0.5, [216, 160, 122]], [1, [224, 110, 70]]];
function ramp(u) {
  u = Math.max(0, Math.min(1, u));
  for (let i = 1; i < RAMP.length; i++) if (u <= RAMP[i][0]) {
    const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], t = (u - a) / (b - a);
    return 'rgb(' + ca.map((c, j) => Math.round(c + (cb[j] - c) * t)).join(',') + ')';
  }
  return 'rgb(224,110,70)';
}
const f1 = x => (Math.round(x * 10) / 10).toFixed(1), f0 = x => String(Math.round(x));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x, y, s, o) => { o = o || {}; return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.sz || 15}" fill="${o.c || INK}"` +
  (o.w ? ` font-weight="${o.w}"` : '') + (o.a ? ` text-anchor="${o.a}"` : '') + (o.ls ? ` letter-spacing="${o.ls}"` : '') + `>${esc(s)}</text>`; };
const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''} stroke-linecap="round"/>`;
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif"><rect width="${w}" height="${h}" rx="10" fill="${PANEL}"/>${body}</svg>`;
const eyebrow = (x, y, s) => T(x, y, s.toUpperCase(), { sz: 12, c: FAINT, w: 600, ls: 1.6 });
const tag = (L0, t) => L0.nodes.filter(n => n.tag === t).map(n => n.p);
const mean = ps => ps.length ? [0, 1, 2].map(k => ps.reduce((a, p) => a + p[k], 0) / ps.length) : null;

// lay labels in a band without overlap: items {x, want}, returns x positions
function spread(items, minGap, lo, hi) {
  const s = items.slice().sort((a, b) => a.want - b.want);
  for (let it = 0; it < 60; it++) {
    for (let i = 1; i < s.length; i++) if (s[i].x - s[i - 1].x < minGap) { const m = (s[i].x + s[i - 1].x) / 2; s[i - 1].x = m - minGap / 2; s[i].x = m + minGap / 2; }
    for (const q of s) q.x = Math.max(lo, Math.min(hi, q.x));
  }
  return s;
}

// ===================================================================================================================
// 1. THE LOAD TEST - front view of the sim's own airframe, bent at 3.8 g, members coloured by the work they do
// ===================================================================================================================
function memberName(L0, b) {
  const ta = L0.nodes[b.a].tag, tb = L0.nodes[b.b].tag, z = Math.max(Math.abs(L0.nodes[b.a].p[2]), Math.abs(L0.nodes[b.b].p[2]));
  const where = z < 0.35 * L0.semi ? 'inboard' : z < 0.7 * L0.semi ? 'mid-span' : 'outboard';
  if ((/^S\d/.test(ta) && /^W/.test(tb)) || (/^S\d/.test(tb) && /^W/.test(ta))) return 'lift strut';
  if (ta === 'WF' && tb === 'WF') return 'front spar, ' + where;
  if (ta === 'WR' && tb === 'WR') return 'rear spar, ' + where;
  if (/^W/.test(ta) && /^W/.test(tb)) return 'wing truss, ' + where;
  return b.cls + ' member';
}
function loadTest(k) {
  const L0 = LOAD[k], W = 800, Hh = 480;
  const n = L0.nodes, D = L0.disp, tipM = L0.tipM;
  const K = Math.max(5, Math.round(0.11 * L0.semi / Math.max(1e-4, tipM) / 5) * 5);   // exaggeration, a round number
  const zs = n.map(p => p.p[2]), ys = n.map(p => p.p[1]);
  const span = Math.max(...zs) - Math.min(...zs), hgt = Math.max(...ys) - Math.min(...ys) + 0.3 * span * 0.11, s = Math.min(700 / span, 215 / hgt);
  const cx = W / 2;
  let base = 0;
  const P = (i, ex) => { const p = n[i].p, d = ex ? D[i] : [0, 0, 0]; return [cx - (p[2] + K * d[2]) * s, base - (p[1] + K * d[1]) * s]; };
  { let top = Infinity; for (let i = 0; i < n.length; i++) top = Math.min(top, P(i, 1)[1]); base = 190 - top; }
  let out = '';
  // the ground line and the trestle marks (the fuselage is held, the wing is free)
  out += L([40, base + 0.05 * s + (-Math.min(...ys)) * s], [W - 40, base + 0.05 * s + (-Math.min(...ys)) * s], HAIR, 1);
  // the jig: the wing as built, before the bags
  for (const b of L0.beams) if (b.cls === 'wing' && n[b.a].tag === 'WF' && n[b.b].tag === 'WF') out += L(P(b.a, 0), P(b.b, 0), FAINT, 1.2, '4 5');
  // the members, the busiest drawn last
  const order = L0.beams.map((b, i) => i).sort((a, b) => L0.beams[a].u - L0.beams[b].u);
  const lim = L0.limitYield / 100;   // the rig's own worst reading (its class allowable): the scale's top is its 100 %
  for (const i of order) {
    const b = L0.beams[i]; if (b.vis === 'inner') continue;
    const u = b.u, wingish = b.cls === 'wing' || b.cls === 'wire';
    out += L(P(b.a, 1), P(b.b, 1), wingish ? ramp(0.08 + u / 0.4) : 'rgba(151,144,127,.28)', wingish ? 1.1 + 3 * Math.min(1, u / 0.4) : 0.7);
  }
  // the bags: an arrow at each loaded wing station, pointing the way the lift pulls (the rig turns the plane over)
  const wf = n.map((p, i) => i).filter(i => n[i].tag === 'WF');
  for (const i of wf) { const p = P(i, 1); out += L([p[0], p[1] + 34], [p[0], p[1] + 8], 'rgba(216,160,122,.55)', 1.4) + `<path d="M${(p[0] - 4).toFixed(1)} ${(p[1] + 12).toFixed(1)} L${p[0].toFixed(1)} ${(p[1] + 5).toFixed(1)} L${(p[0] + 4).toFixed(1)} ${(p[1] + 12).toFixed(1)}" fill="none" stroke="rgba(216,160,122,.7)" stroke-width="1.4"/>`; }
  // the tip: jig to bent, the dimension
  const tipI = wf.reduce((a, i) => (n[i].p[2] < n[a].p[2] ? i : a), wf[0]);      // the left tip on screen is +z ... take min z = screen right
  const tipJ = wf.reduce((a, i) => (n[i].p[2] > n[a].p[2] ? i : a), wf[0]);      // +z: screen left
  const pj = P(tipJ, 0), pb = P(tipJ, 1);
  out += L([pj[0] - 18, pj[1]], [pj[0] - 4, pj[1]], DIM, 1) + L([pb[0] - 18, pb[1]], [pb[0] - 4, pb[1]], DIM, 1) + L([pj[0] - 11, pj[1]], [pb[0] - 11, pb[1]], DIM, 1);
  out += T(pb[0] - 20, pb[1] - 30, '+' + f1(tipM * 100) + ' cm', { sz: 22, w: 600 }) + T(pb[0] - 20, pb[1] - 12, 'at the tip, 3.8 g', { sz: 13, c: DIM });
  // the hardest-working member
  const wi = L0.beams.reduce((a, b, i) => (b.u > L0.beams[a].u ? i : a), 0), wb = L0.beams[wi];
  const pa = P(wb.a, 1), pc = P(wb.b, 1), m = [(pa[0] + pc[0]) / 2, (pa[1] + pc[1]) / 2];
  out += `<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="9" fill="none" stroke="${ramp(1)}" stroke-width="1.8"/>`;
  out += T(m[0] + 13, m[1] - 10, f0(wb.u * 100) + ' %', { sz: 12.5, c: ramp(1), w: 600 });
  // the header
  out += eyebrow(32, 40, 'Load test · the certification bench');
  out += T(32, 72, L0.verdict === 'HELD' ? 'Held 5.7 g with nothing bent' : L0.verdict, { sz: 24, w: 600 });
  out += T(32, 94, NAME[k] + ' · ' + f0(L0.W / 9.81) + ' kg in sandbags at 1 g · ' + L0.beams.length + ' members · bending drawn ×' + K, { sz: 13, c: DIM });
  // the legend: the work ramp
  const gx = W - 232, gy = 40;
  out += T(gx, gy, 'HOW HARD EACH MEMBER WORKS', { sz: 10.5, c: FAINT, w: 600, ls: 1.2 });
  for (let i = 0; i < 40; i++) out += `<rect x="${gx + i * 5}" y="${gy + 8}" width="5.4" height="7" fill="${ramp(i / 39)}"/>`;
  out += T(gx, gy + 30, 'idle', { sz: 11, c: FAINT }) + T(gx + 200, gy + 30, '40 % of yield', { sz: 11, c: FAINT, a: 'end' });
  // the footer: three readings
  const ft = [['3.8 g', 'limit load, +' + f1(tipM * 100) + ' cm'], ['5.7 g', 'ultimate, +' + f1(L0.ultPct / 100 * L0.semi * 100) + ' cm, held 1.5 s'],
              [f0(wb.u * 100) + ' %', 'works hardest: ' + memberName(L0, wb) + (wb.t === 'C' ? ', squeezed' : ', pulled')]];
  ft.forEach((r, i) => { const x = 32 + i * 230; out += T(x, Hh - 34, r[0], { sz: 18, w: 600 }) + T(x, Hh - 15, r[1], { sz: 12, c: DIM }); });
  return svg(W, Hh, out, 'Load test of the ' + NAME[k]);
}

// ===================================================================================================================
// 2. THE DRAG - side view, each source a flat plate of the same drag drawn to the plane's own scale
// ===================================================================================================================
const DRAGROW = {
  fuselage: { name: 'Fuselage', cat: 'structure' }, cooling: { name: 'Engine cooling & exhaust', cat: 'engine' },
  screen: { name: 'Windscreen', cat: 'fittings' }, junct: { name: 'Wing & tail roots', cat: 'structure' },
  mainGear: { name: 'Main gear', cat: 'gear' }, third: { name: 'Tail wheel', cat: 'gear' }, struts: { name: 'Lift struts', cat: 'structure' },
  wires: { name: 'Bracing wires', cat: 'structure' }, nacelles: { name: 'Engine nacelle', cat: 'engine' }, pod: { name: 'Belly pod', cat: 'fittings' },
};
function dragPage(k) {
  const L0 = LOAD[k], Dg = DRAG[k], c = CAL[k].side, W = 800, Hh = 520;
  const sp = SPECS[k].spec, tri = sp.gear.type === 'tricycle', floats = sp.gear.type === 'floats';
  const f = Math.min(640 / c.W, 230 / c.H), ox = (W - c.W * f) / 2, oy = 150;
  const r = c.rot * Math.PI / 180;
  const N = p => { const a = p[0], b = -p[1]; return [ox + f * ((a * Math.cos(r) - b * Math.sin(r)) * c.s + c.ox), oy + f * ((a * Math.sin(r) + b * Math.cos(r)) * c.s + c.oy)]; };
  const fus = L0.nodes.filter(q => /^S[2-4][TB]/.test(q.tag)).map(q => q.p);
  const struts = L0.beams.filter(b => b.cls === 'wing' && ((/^S\d/.test(L0.nodes[b.a].tag) && /^W/.test(L0.nodes[b.b].tag)) || (/^S\d/.test(L0.nodes[b.b].tag) && /^W/.test(L0.nodes[b.a].tag))));
  const wires = L0.beams.filter(b => b.cls === 'wire');
  const mid = bs => mean(bs.flatMap(b => [L0.nodes[b.a].p, L0.nodes[b.b].p]));
  const wroot = L0.nodes.filter(q => q.tag === 'WF').sort((a, b) => Math.abs(a.p[2]) - Math.abs(b.p[2]))[0].p;
  const at = {
    fuselage: mean(fus), cooling: mean(tag(L0, 'CGE').concat(tag(L0, 'ENGL'))), screen: mean(tag(L0, 'S0TL').concat(tag(L0, 'S1TL'))),
    junct: [wroot[0] + 0.25, wroot[1] - 0.05, 0],
    mainGear: floats ? mean(tag(L0, 'FLK')) : mean(tag(L0, 'AXLEL').concat(tag(L0, 'AXLEL').map(p => [p[0], p[1] + 0.35, p[2]]))),
    third: tri || floats ? [sp.gear.twX, sp.gear.twY + 0.1, 0] : tag(L0, 'TW')[0],
    struts: struts.length ? mid(struts) : null, wires: wires.length ? mid(wires) : null,
    nacelles: mean(tag(L0, 'ENGL').concat(tag(L0, 'ENGR'))),
  };
  let out = `<image href="${img(k, 'side')}" x="${ox.toFixed(1)}" y="${oy}" width="${(c.W * f).toFixed(1)}" height="${(c.H * f).toFixed(1)}" opacity="0.92"/>`;
  const items = [];
  for (const g in Dg.groups) {
    if (!at[g] || !DRAGROW[g]) continue;
    const R = DRAGROW[g], q = N(at[g]), cda = Dg.groups[g].cda, rad = Math.sqrt(cda / Math.PI) * c.s * f;
    let name = R.name; if (g === 'third' && tri) name = 'Nose wheel'; if (g === 'third' && floats) name = 'Third wheel*'; if (g === 'mainGear' && floats) name = 'Floats*';
    items.push({ g, q, rad, cda, dV: Dg.groups[g].dV * 3.6, name, col: CAT[R.cat] });
  }
  // the discs (the biggest first, so a small one stays visible on top)
  for (const it of items.slice().sort((a, b) => b.rad - a.rad))
    out += `<circle cx="${it.q[0].toFixed(1)}" cy="${it.q[1].toFixed(1)}" r="${Math.max(2.5, it.rad).toFixed(1)}" fill="${it.col}" fill-opacity="0.38" stroke="${it.col}" stroke-width="1.5"/>`;
  // the labels: above the plane for the upper half, below for the lower
  const midY = N(at.fuselage)[1];
  const up = items.filter(i => i.q[1] < midY - 4).map(i => Object.assign(i, { x: i.q[0], want: i.q[0] }));
  const dn = items.filter(i => i.q[1] >= midY - 4).map(i => Object.assign(i, { x: i.q[0], want: i.q[0] }));
  const band = (arr, y, dir) => spread(arr, 132, 105, W - 105).forEach(i => {
    const ly = y;
    out += L([i.q[0], i.q[1] + dir * Math.max(3, i.rad)], [i.x, ly - dir * (dir < 0 ? -6 : 28)], 'rgba(244,239,230,.35)', 0.8);
    out += T(i.x, ly, i.name, { sz: 13.5, a: 'middle', w: 500 }) + T(i.x, ly + 17, '−' + f1(i.dV) + ' km/h', { sz: 13, a: 'middle', c: i.col, w: 600 });
  });
  band(up, oy - 26, -1); band(dn, oy + c.H * f + 30, 1);
  // header
  const big = items.filter(i => i.g !== 'fuselage').sort((a, b) => b.dV - a.dV)[0];
  out += eyebrow(32, 40, 'Drag · where the speed goes');
  out += T(32, 72, 'Your ' + big.name.replace('*', '').toLowerCase() + ' cost ' + f0(big.dV) + ' km/h', { sz: 24, w: 600 });
  out += T(32, 94, 'Cruise ' + f0(Dg.Vc * 3.6) + ' km/h. Each disc is a flat plate with the same drag, drawn to scale.', { sz: 13, c: DIM });
  // footer: the whole drag area at cruise, one bar
  const tot = Dg.axial + Dg.surfCdA, bx = 32, bw = W - 64, by = Hh - 52;
  let x = bx;
  const seg = (v, col, lab) => { const w = bw * v / tot; out += `<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1.5).toFixed(1)}" height="12" rx="2" fill="${col}" fill-opacity="${lab ? 0.85 : 0.55}"/>`; if (lab && w > 70) out += T(x + 2, by + 30, lab, { sz: 11.5, c: DIM }); x += w; };
  seg(Dg.surfCdA, 'rgba(192,184,172,.35)', 'wings & tail ' + f0(100 * Dg.surfCdA / tot) + ' %');
  for (const it of items.slice().sort((a, b) => b.cda - a.cda)) seg(it.cda, it.col, it.cda / tot > 0.09 ? it.name.replace('*', '').toLowerCase() + ' ' + f0(100 * it.cda / tot) + ' %' : '');
  const rest = Dg.axial - items.reduce((a, i) => a + i.cda, 0); if (rest > 1e-4) seg(rest, 'rgba(192,184,172,.2)');
  out += T(W - 32, by + 30, 'all of it: ' + (tot).toFixed(2) + ' m²', { sz: 11.5, c: FAINT, a: 'end' });
  if (floats) out += T(32, Hh - 8, '* floats: the core charges two wheels, a third wheel and legs (genGearCdA); the hulls have no air drag of their own', { sz: 11, c: '#d8a07a' });
  return svg(W, Hh, out, 'Drag sources of the ' + NAME[k]);
}

// ===================================================================================================================
// 3. THE ELECTRICS - plan X-ray: the parts where the frame bills them, every lamp with its amps, the budget
// ===================================================================================================================
function plan(k, W, top, maxH) {
  const c = CAL[k].plan, f = Math.min((W - 64) / c.W, maxH / c.H), ox = (W - c.W * f) / 2, oy = top;
  const N = p => [ox + f * (p[2] * c.s + c.ox), oy + f * (p[0] * c.s + c.oy)];
  return { c, f, ox, oy, N, s: c.s * f };
}
function elecPage(k) {
  const L0 = LOAD[k], E = ELEC[k], sp = SPECS[k].spec, cg = sp.cage || {}, W = 800, Hh = 700;
  const pl = plan(k, W, 112, 410), N = pl.N;
  let out = `<defs><filter id="gr${k}"><feColorMatrix type="saturate" values="0"/></filter></defs>`;
  out += `<image href="${img(k, 'plan')}" x="${pl.ox.toFixed(1)}" y="${pl.oy}" width="${(pl.c.W * pl.f).toFixed(1)}" height="${(pl.c.H * pl.f).toFixed(1)}" opacity="0.2" filter="url(#gr${k})"/>`;
  const SY = CAT.systems;
  const semi = L0.semi, wf = L0.nodes.filter(q => q.tag === 'WF');
  const tipL = wf.reduce((a, q) => (q.p[2] < a.p[2] ? q : a)).p, tipR = wf.reduce((a, q) => (q.p[2] > a.p[2] ? q : a)).p;
  const fw = mean(tag(L0, 'S0BL').concat(tag(L0, 'S0BR'))), panel = mean(tag(L0, 'S0TL').concat(tag(L0, 'S0TR')));
  const eng = mean(tag(L0, 'ENGL').concat(tag(L0, 'ENGR')));
  const fin = (tag(L0, 'FIN')[0]) || mean(tag(L0, 'VF'));
  const tail = L0.nodes.reduce((a, q) => (q.p[0] > a[0] && Math.abs(q.p[2]) < 0.3 ? q.p : a), [0, 0, 0]);
  const bay = cg.li_bayFrac || 0.24, wAt = z => { const q = wf.slice().sort((a, b) => Math.abs(Math.abs(a.p[2]) - Math.abs(z)) - Math.abs(Math.abs(b.p[2]) - Math.abs(z)))[0]; return [q.p[0] - 0.05, q.p[1], z]; };
  const battery = [fw[0] - 0.12, fw[1], 0.12], bus = [panel[0] + 0.25, panel[1], -0.1];
  const lamp = { nav: [[tipL[0], 0, tipL[2] - 0.05], [tipR[0], 0, tipR[2] + 0.05], [tail[0] + 0.05, 0, 0]], beacon: [[fin[0], 0, 0.0]],
                 taxi: [wAt(-bay * semi)], land: [wAt(bay * semi)], flood: [[panel[0] + 0.9, 0, 0]], instr: [[panel[0] + 0.3, 0, 0.18]],
                 pedal: [[panel[0] + 0.15, 0, -0.18]], pax: [[panel[0] + 1.7, 0, 0]] };
  const LCOL = { nav: '#e6dbc9', beacon: '#e08a5a', taxi: '#f4efe6', land: '#f4efe6', flood: '#d9b77e', instr: '#d9b77e', pedal: '#d9b77e', pax: '#d9b77e' };
  // the wire: from the bus to every lamp, square runs along the centreline and the wing's leading edge
  const run = (a, b) => { const A = N(a), B = N(b), m = N([a[0], 0, 0]), m2 = N([b[0], 0, 0]); return `<path d="M${A[0].toFixed(1)} ${A[1].toFixed(1)} L${m[0].toFixed(1)} ${m[1].toFixed(1)} L${m2[0].toFixed(1)} ${m2[1].toFixed(1)} L${B[0].toFixed(1)} ${B[1].toFixed(1)}" fill="none" stroke="${SY}" stroke-opacity="0.55" stroke-width="1.1"/>`; };
  out += run(battery, bus);
  for (const lk in lamp) if (E.lights.some(l => l.key === 'lt_' + lk)) for (const p of lamp[lk]) out += run(bus, p);
  if (E.altA > 0) out += run(eng, bus);
  // the parts, to scale where they have a size
  const box = (p, d, col, lab) => { const q = N(p), w = Math.max(5, d[1] * pl.s), h = Math.max(5, d[0] * pl.s); out += `<rect x="${(q[0] - w / 2).toFixed(1)}" y="${(q[1] - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${col}"/>`; };
  const can = (p, d) => { const q = N(p); out += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${Math.max(3, d / 2 * pl.s).toFixed(1)}" fill="${SY}"/>`; };
  const bat = E.parts.find(p => p.key === 'battery'); if (bat) box(battery, bat.dims, SY);
  const alt = E.parts.find(p => p.key === 'alternator'); if (alt) can([eng[0] + 0.15, 0, -0.12], alt.dia);
  const st = E.parts.find(p => p.key === 'starter'); if (st) can([eng[0] + 0.1, 0, 0.13], st.dia);
  box(bus, [0.06, 0.18], SY);
  for (const lk in lamp) if (E.lights.some(l => l.key === 'lt_' + lk)) for (const p of lamp[lk]) { const q = N(p); out += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="4.2" fill="${LCOL[lk]}" stroke="${PANEL}" stroke-width="1.2"/>`; }
  // callouts: left column (the outside lamps), right column (the bus side)
  const amps = lk => { const l = E.lights.find(q => q.key === 'lt_' + lk); return l ? l.amps : 0; };
  const callout = (p, lx, ly, a, t1, t2) => { const q = N(p); out += L(q, [lx + (a === 'end' ? 6 : -6), ly - 5], 'rgba(244,239,230,.32)', 0.8) + T(lx, ly - 2, t1, { sz: 13.5, a, w: 500 }) + T(lx, ly + 15, t2, { sz: 12, a, c: DIM }); };
  const xL = 120, xR = W - 120;
  callout(lamp.nav[1], W - 70, 140, 'end', 'Navigation lights ×3', amps('nav') + ' A');
  const wy = Math.max(...L0.nodes.filter(q => q.tag === 'WR').map(q => N(q.p)[1])) + 34;
  callout(lamp.land[0], W - 70, wy, 'end', 'Landing light', amps('land') + ' A, ' + (E.breakers.find(b => b.key === 'landLt') || {}).A + ' A breaker');
  callout(lamp.taxi[0], 70, wy, 'start', 'Taxi light', amps('taxi') + ' A, ' + (E.breakers.find(b => b.key === 'taxiLt') || {}).A + ' A breaker');
  callout(lamp.beacon[0], W - 70, 470, 'end', 'Beacon', f1(amps('beacon')) + ' A average (pulsed)');
  const busP = E.parts.find(p => p.key === 'bus');
  callout(lamp.flood[0], W - 70, Math.max(370, wy + 56), 'end', 'Cabin & panel lights', f1(amps('flood') + amps('instr') + amps('pedal') + amps('pax')) + ' A, dimmable');
  // THE LOUPE: the firewall and the panel, magnified, the parts at their own size
  {
    const lc = [150, 440], lr = 92, x0 = Math.min(eng[0], battery[0]) - 0.2, x1 = Math.max(panel[0] + 0.55, eng[0] + 0.35), Z = Math.min(260, (2 * lr - 20) / (x1 - x0));
    const M = p => [lc[0] + p[2] * Z, lc[1] + (p[0] - (x0 + x1) / 2) * Z];
    out += `<clipPath id="lp${k}"><circle cx="${lc[0]}" cy="${lc[1]}" r="${lr}"/></clipPath><circle cx="${lc[0]}" cy="${lc[1]}" r="${lr}" fill="#1a1815" stroke="${SY}" stroke-opacity=".6"/>`;
    let g = '';
    for (const b of L0.beams) { const A = L0.nodes[b.a].p, B = L0.nodes[b.b].p; if (Math.max(A[0], B[0]) > x1 + 0.4 || b.vis === 'inner') continue; g += L(M(A), M(B), 'rgba(143,176,196,.32)', 0.8); }
    const rbox = (p, d, lab) => { const q = M(p), w = d[1] * Z, h = d[0] * Z; g += `<rect x="${(q[0] - w / 2).toFixed(1)}" y="${(q[1] - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${SY}"/>` + T(q[0] + w / 2 + 4, q[1] + 4, lab, { sz: 11, c: INK }); };
    const rcan = (p, d, ln, lab, left0) => { const q = M(p), left = left0 && q[0] - lc[0] > -lr + 75, w = d * Z, h = ln * Z; g += `<rect x="${(q[0] - w / 2).toFixed(1)}" y="${(q[1] - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(w / 2).toFixed(1)}" fill="${SY}" fill-opacity=".85"/>` + T(left ? q[0] - w / 2 - 4 : q[0] + w / 2 + 4, q[1] + 4, lab, { sz: 11, c: INK, a: left ? 'end' : 'start' }); };
    if (bat) rbox(battery, bat.dims, 'battery');
    if (alt) rcan([eng[0] + 0.15, 0, -0.12], alt.dia, alt.len, E.elec.alternator === 'gen20' ? 'generator' : 'alternator', true);
    if (st) rcan([eng[0] + 0.1, 0, 0.13], st.dia, st.len, 'starter');
    rbox(bus, [0.06, 0.18], 'bus');
    out += `<g clip-path="url(#lp${k})">${g}</g>`;
    const nq = N([(x0 + x1) / 2, 0, 0]); out += L([lc[0] + lr * 0.7, lc[1] - lr * 0.7], nq, 'rgba(185,155,224,.4)', 0.8, '3 4');
    const lines = [];
    if (bat) lines.push('Battery · ' + bat.name.replace('lead-acid 12 V, ', 'lead-acid, ') + ' · ' + bat.kg + ' kg');
    if (alt) lines.push(alt.name.replace(/^./, c => c.toUpperCase()) + ' · ' + alt.kg + ' kg');
    if (st) lines.push('Starter · 150 A while cranking · ' + st.kg + ' kg');
    if (busP) lines.push('Bus bar & ' + busP.breakers + ' breakers · ' + f1(busP.kg + E.parts.find(p => p.key === 'wire').kg) + ' kg with the wire');
    lines.forEach((t, i) => { out += T(40, lc[1] + lr + 24 + i * 17, t, { sz: 12, c: i ? DIM : INK }); });
    if (!lines.length) out += T(40, lc[1] + lr + 24, 'No battery, no generator: hand-propped', { sz: 12, c: DIM });
  }
  // header
  out += eyebrow(32, 40, 'Electrics · the bus, part by part');
  const pct = E.night.A / Math.max(1e-6, E.altA) * 100;
  out += T(32, 72, 'Every light on: ' + f1(E.night.A) + ' A of the ' + (E.altA ? E.altA + ' A ' + (E.elec.alternator === 'gen20' ? 'generator' : 'alternator') : 'battery'), { sz: 24, w: 600 });
  out += T(32, 94, 'With the ' + (E.elec.alternator === 'gen20' ? 'generator' : 'alternator') + ' dead at night, the battery lasts ' + f0(E.dark.min) + ' min (the game\'s own bus, run to 9 V).', { sz: 13, c: DIM });
  // the budget bar
  const by = Hh - 66, bx = 32, bw = W - 64, full = Math.max(E.altA, E.night.A) * 1.08, sc = bw / full;
  let x = bx;
  const seg = (a, col, lab) => { const w = a * sc; out += `<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1.5).toFixed(1)}" height="14" rx="2" fill="${col}"/>`; if (lab && w > 46) out += T(x + 2, by + 32, lab, { sz: 11.5, c: DIM }); x += w; };
  seg(E.day.A, SY, 'panel & radios ' + f1(E.day.A) + ' A');
  for (const lk of ['land', 'taxi', 'nav', 'beacon']) if (amps(lk)) seg(amps(lk), lk === 'beacon' ? '#e08a5a' : 'rgba(244,239,230,.75)', lk + ' ' + f1(amps(lk)));
  const cab = amps('flood') + amps('instr') + amps('pedal') + amps('pax'); if (cab) seg(cab, '#d9b77e', '');
  const ax = bx + E.altA * sc;
  out += L([ax, by - 12], [ax, by + 22], INK, 1.4) + T(ax, by - 17, (E.elec.alternator === 'gen20' ? 'generator ' : 'alternator ') + E.altA + ' A', { sz: 12, a: 'end', w: 500 });
  return svg(W, Hh, out, 'Electrical system of the ' + NAME[k]);
}

// ===================================================================================================================
// 4. TANKS & STRUCTURE - plan X-ray: the wing members the sim bends, the fuel bay and its tank
// ===================================================================================================================
function tankPage(k) {
  const L0 = LOAD[k], sp = SPECS[k].spec, W = 800, Hh = 600;
  const pl = plan(k, W, 112, 420), N = pl.N;
  let out = `<defs><filter id="gt${k}"><feColorMatrix type="saturate" values="0"/></filter></defs>`;
  out += `<image href="${img(k, 'plan')}" x="${pl.ox.toFixed(1)}" y="${pl.oy}" width="${(pl.c.W * pl.f).toFixed(1)}" height="${(pl.c.H * pl.f).toFixed(1)}" opacity="0.16" filter="url(#gt${k})"/>`;
  const TK = TANKS[k], v = { bay: TK.bay }, R = TK.res, semi = TK.semi, bayL = TK.bayRes.litres;
  const wf = L0.nodes.filter(q => q.tag === 'WF').map(q => q.p), wr = L0.nodes.filter(q => q.tag === 'WR').map(q => q.p);
  const at = (arr, z) => arr.slice().sort((a, b) => Math.abs(a[2] - z) - Math.abs(b[2] - z))[0];
  // the bay
  const bayDef = TK.bayRes.on === 'wing' ? TK.bayRes.span : null;
  const FUEL = CAT.engine;
  let bayLab = null;
  if (bayDef) {
    for (const sg of [1, -1]) {
      const z0 = sg * bayDef[0] * semi, z1 = sg * bayDef[1] * semi;
      const p = [[at(wf, z0)[0] + 0.05, 0, z0], [at(wf, z1)[0] + 0.05, 0, z1], [at(wr, z1)[0] - 0.05, 0, z1], [at(wr, z0)[0] - 0.05, 0, z0]].map(N);
      out += `<path d="M${p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" fill="${FUEL}" fill-opacity="${(0.12 + 0.5 * R.installedL / bayL).toFixed(2)}" stroke="${FUEL}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
      if (sg > 0) bayLab = N([at(wr, (z0 + z1) / 2)[0], 0, (z0 + z1) / 2]);
    }
  } else {
    const Bx0 = TK.bayRes.x0, Bx1 = TK.bayRes.x1; const S0 = mean(tag(L0, 'S0TR')), hw = Math.abs(S0[2]);
    const p = [[Bx0, 0, -hw * 0.8], [Bx0, 0, hw * 0.8], [Bx1 - 0.02, 0, hw * 0.95], [Bx1 - 0.02, 0, -hw * 0.95]].map(N);
    out += `<path d="M${p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" fill="${FUEL}" fill-opacity="0.45" stroke="${FUEL}" stroke-width="1.4"/>`;
    bayLab = N([(Bx0 + Bx1) / 2, 0, hw]);
  }
  // the structure: every wing and tail member the sim carries, the fuselage truss quieter
  for (const b of L0.beams) {
    if (b.vis === 'inner') continue;
    const A = N(L0.nodes[b.a].p), B = N(L0.nodes[b.b].p);
    const strong = b.cls === 'wing' || b.cls === 'tail';
    const spar = (L0.nodes[b.a].tag === 'WF' && L0.nodes[b.b].tag === 'WF') || (L0.nodes[b.a].tag === 'WR' && L0.nodes[b.b].tag === 'WR');
    out += L(A, B, strong ? CAT.structure : 'rgba(143,176,196,.35)', spar ? 2.2 : strong ? 0.9 : 0.7);
  }
  const nW = L0.beams.filter(b => b.cls === 'wing').length, nT = L0.beams.filter(b => b.cls === 'tail').length, nF = L0.beams.filter(b => b.cls === 'fus').length;
  // callouts
  const fuelKgL = R.contentsKg / R.litres;
  const tLab = bayDef ? (f0(R.litres) + ' L, ' + f0(R.litres / 2) + ' L a side') : (f0(R.litres) + ' L in the nose');
  out += L(bayLab, [W - 150, 150], 'rgba(244,239,230,.32)', 0.8) + T(W - 70, 140, 'Fuel · ' + tLab, { sz: 14, a: 'end', w: 500 }) +
         T(W - 70, 158, f0(R.contentsKg) + ' kg of fuel in a ' + f1(R.vesselKg) + ' kg ' + R.vessel.name.toLowerCase() + ' tank', { sz: 12, a: 'end', c: DIM });
  const sparP = N(at(wf, -0.6 * semi));
  out += L(sparP, [150, 150], 'rgba(244,239,230,.32)', 0.8) + T(70, 140, 'Front & rear spar', { sz: 14, w: 500 }) + T(70, 158, nW + ' wing members, each its own spring', { sz: 12, c: DIM });
  // header
  out += eyebrow(32, 40, 'Inside · the frame the sim bends');
  out += T(32, 72, L0.beams.length + ' members, ' + L0.nodes.length + ' joints, one solver', { sz: 24, w: 600 });
  out += T(32, 94, 'The tank holds ' + f0(R.litres) + ' L. The ' + (bayDef ? 'wing-root bay' : 'nose bay') + ' it sits in could take ' + f0(bayL) + ' L.', { sz: 13, c: DIM });
  // footer
  const ft = [[nW + '', 'wing members'], [nT + '', 'tail members'], [nF + '', 'fuselage members'], [f0(R.contentsKg) + ' kg', 'fuel, full']];
  ft.forEach((r, i) => { const x = 32 + i * 190; out += T(x, Hh - 34, r[0], { sz: 18, w: 600 }) + T(x, Hh - 15, r[1], { sz: 12, c: DIM }); });
  return svg(W, Hh, out, 'Tanks and structure of the ' + NAME[k]);
}

module.exports = { loadTest, dragPage, elecPage, tankPage, NAME, CAT, LOAD, DRAG, ELEC };
if (require.main === module) {
  const k = process.argv[2] || 'cub', which = process.argv[3] || 'load';
  const fn = { load: loadTest, drag: dragPage, elec: elecPage, tank: tankPage }[which];
  fs.writeFileSync(path.join(H, 'out_' + k + '_' + which + '.svg'), fn(k));
}

// ===================================================================================================================
// 5. WHAT THE SIM FLIES - plan above side, one scale: the mass points, the members, the lifting panels and their control
//    surfaces, the two body drag points, the propeller disc, the ground contacts; the drawn plane only as a faint ghost
// ===================================================================================================================
const SIMDEF = {};
function simDef(k) {
  if (SIMDEF[k]) return SIMDEF[k];
  const C = require('./core.js'); return (SIMDEF[k] = C.buildGen(JSON.parse(JSON.stringify(SPECS[k].spec))));
}
function simPage(k) {
  const def = simDef(k), sp = def.spec, n = def.nodes, W = 800;
  const xs = n.map(q => q.p[0]), ys = n.map(q => q.p[1]), zs = n.map(q => q.p[2]);
  const D = (def.params.prop && def.params.prop.D) || 1.8, engI = [].concat(def.refs.engine || []);
  const eng = mean(engI.map(i => n[i].p)), pusher = sp.engAt && sp.engAt[0] && sp.engAt[0].mount === 'pusher';
  const xmin = Math.min(...xs, eng[0] - 0.4), xmax = Math.max(...xs) + 0.5, zext = Math.max(...zs.map(Math.abs)) + 0.2;
  const ymin = Math.min(...ys, eng[1] - D / 2) - 0.1, ymax = Math.max(...ys, eng[1] + D / 2) + 0.1;
  const s = Math.min(560 / (xmax - xmin), 330 / (2 * zext)), X0 = (W - (xmax - xmin) * s) / 2 - xmin * s;
  const PY = 132 + zext * s, SY = PY + zext * s + 40 + ymax * s;   // plan centreline; side datum (y = 0)
  const Hh = Math.round(SY - ymin * s + 118);
  const pl = p => [X0 + p[0] * s, PY + p[2] * s], sd = p => [X0 + p[0] * s, SY - p[1] * s];
  let out = `<defs><filter id="sg${k}"><feColorMatrix type="saturate" values="0"/></filter>` +
    `<pattern id="hz${k}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${CAT.fittings}" stroke-width="1.6"/></pattern></defs>`;
  // the ghosts: the drawn plane, faint, on the calibrated fiche pictures (the plan turned nose-left by its own frame)
  { const c = CAL[k].plan, f = s / c.s;
    out += `<image href="${img(k, 'plan')}" width="${c.W}" height="${c.H}" transform="matrix(0 ${f} ${f} 0 ${(X0 - f * c.oy).toFixed(2)} ${(PY - f * c.ox).toFixed(2)})" opacity="0.3" filter="url(#sg${k})"/>`;
    const cs = CAL[k].side, fs2 = s / cs.s;
    out += `<image href="${img(k, 'side')}" width="${cs.W}" height="${cs.H}" transform="matrix(${fs2} 0 0 ${fs2} ${(X0 - fs2 * cs.ox).toFixed(2)} ${(SY - fs2 * cs.oy).toFixed(2)})" opacity="0.3" filter="url(#sg${k})"/>`; }
  // the lifting panels: a strip's chord quad off its spar nodes (front spar at 15 % of the chord), its control share
  const CT = sp.controls || {};
  const share = st => st.kind === 'stab' ? (CT.elevator && CT.elevator.chord) || 0 : st.kind === 'fin' ? (CT.rudder && CT.rudder.chord) || 0
    : st.ail ? (CT.aileron && CT.aileron.chord) || 0 : st.flap ? (CT.flap && CT.flap.chord) || 0 : 0;
  const quad = (st, P) => {
    const F0 = n[st.fIn].p, F1 = n[st.fOut].p, R0 = n[st.rIn].p, R1 = n[st.rOut].p;
    const at = (F, R, t) => { const d = [0, 1, 2].map(q => R[q] - F[q]), L = Math.hypot(...d) || 1; return [0, 1, 2].map(q => F[q] + d[q] / L * st.chord * (t - 0.15)); };
    const cs = share(st), te = 1, hinge = 1 - cs;
    const body = [at(F0, R0, 0), at(F1, R1, 0), at(F1, R1, hinge), at(F0, R0, hinge)].map(P);
    const ctl = cs > 0 ? [at(F0, R0, hinge), at(F1, R1, hinge), at(F1, R1, te), at(F0, R0, te)].map(P) : null;
    const poly = (pts, fill, op, stroke) => `<path d="M${pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="0.8"/>`;
    return poly(body, CAT.structure, 0.16, 'rgba(143,176,196,.7)') + (ctl ? poly(ctl, `url(#hz${k})`, 0.9, CAT.fittings) : '');
  };
  for (const st of def.strips) if (st.kind !== 'fin') out += quad(st, pl);
  for (const st of def.strips) if (st.kind === 'fin') out += quad(st, sd);
  // the members, thin
  for (const b of def.beams) { if (b.vis === 'inner') continue; const A = n[b.a].p, B = n[b.b].p;
    out += L(pl(A), pl(B), 'rgba(192,184,172,.22)', 0.6) + L(sd(A), sd(B), 'rgba(192,184,172,.22)', 0.6); }
  // the two body drag points: a flat plate of each one's AXIAL drag area (front) and the aft one's side area, to scale
  const fd = mean([].concat(def.refs.fusDrag).map(i => n[i].p)), fa = mean([].concat(def.refs.fusDragAft).map(i => n[i].p));
  const cda = def.params.fusCdA, cdaA = def.params.fusCdAAft;
  const disc = (q, a, col) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(Math.sqrt(a / Math.PI) * s).toFixed(1)}" fill="${col}" fill-opacity=".22" stroke="${col}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  out += disc(sd(fd), cda[0], INK) + disc(sd(fa), cdaA[1] * 0.25, INK);
  // the propeller: a disc of its diameter, edge-on in both views
  const ex = pusher ? eng[0] + 0.25 : eng[0] - 0.12;
  out += L(pl([ex, 0, -D / 2]), pl([ex, 0, D / 2]), CAT.engine, 2.4) + L(sd([ex, eng[1] - D / 2, 0]), sd([ex, eng[1] + D / 2, 0]), CAT.engine, 2.4);
  // the ground contacts
  for (const i of [].concat(def.refs.mains || [], def.refs.tw >= 0 ? [def.refs.tw] : [])) { const q = sd(n[i].p); out += `<rect x="${(q[0] - 4).toFixed(1)}" y="${(q[1] - 4).toFixed(1)}" width="8" height="8" fill="${CAT.gear}"/>`; }
  if (def.parts.floats) for (const q of n.filter(q => q.tag === 'FLK')) { const p = sd(q.p); out += `<rect x="${(p[0] - 2.5).toFixed(1)}" y="${(p[1] - 2.5).toFixed(1)}" width="5" height="5" fill="${CAT.gear}"/>`; }
  // the masses: a dot per node, its area to its kilograms (both views)
  const mr = m => Math.max(0.9, Math.sqrt(m) * 0.95);
  for (const q of n) if (q.m > 0.05) { const a = pl(q.p), b = sd(q.p); out += `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="${mr(q.m).toFixed(1)}" fill="${INK}" fill-opacity=".8"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${mr(q.m).toFixed(1)}" fill="${INK}" fill-opacity=".8"/>`; }
  // callouts
  const engM = engI.reduce((a, i) => a + n[i].m, 0) + n.filter(q => q.tag === 'CGE').reduce((a, q) => a + q.m, 0);
  const call = (q, lx, ly, a, t1, t2, col) => { const lyy = q[1] > ly ? ly + 24 : ly - 18; out += L(q, [a === 'middle' ? lx : lx + (a === 'end' ? -40 : 40), lyy], 'rgba(244,239,230,.32)', 0.8) + T(lx, ly - 2, t1, { sz: 13.5, a, w: 500 }) + (t2 ? T(lx, ly + 15, t2, { sz: 12, a, c: col || DIM }) : ''); };
  const top = def.strips.filter(st => st.kind === 'wing' && n[st.fOut].p[2] < 0).sort((a, b) => n[a.fOut].p[2] - n[b.fOut].p[2]);
  const ailSt = top.find(st => st.ail) || top[0] || def.strips[0], outSt = top[0] || def.strips[0];
  const nW = def.strips.filter(st => st.kind === 'wing').length, nT = def.strips.length - nW;
  call(pl(mean([n[ailSt.rOut].p, n[ailSt.rIn].p])), W - 40, 128, 'end', 'Aileron, flap, elevator, rudder', 'the rear share of a panel: it moves that panel\'s lift', CAT.fittings);
  call(pl(mean([n[outSt.fIn].p, n[outSt.fOut].p])), 40, 128, 'start', nW + ' wing panels, ' + nT + ' tail panels', 'each its own lift and drag curve, at its own airflow');
  const cge = n.find(q => q.tag === 'CGE'); if (cge) call(sd(cge.p), 40, Hh - 60, 'start', 'Engine: ' + Math.round(engM) + ' kg on its mount points', 'power, torque and its gyroscopic pull act there', CAT.engine);
  call(sd([ex, eng[1] + D / 2, 0]), W - 40, Hh - 60, 'end', 'Propeller: a disc ' + D.toFixed(2) + ' m across', 'thrust from its curve, its torque on the airframe', CAT.engine);
  call(sd(fd), W / 2, Hh - 22, 'middle', 'Body: two drag points, the nose and cowl included', 'front ' + cda[0].toFixed(2) + ' m² (gear in it), dashed discs to scale');
  // the Twin's aft point behind its pod (AFT-PODS)
  if (k === 'twin') { const q = pl([fa[0], 0, 0]); out += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="11" fill="none" stroke="#d8a07a" stroke-width="1.4"/>` + T(q[0] + 16, q[1] - 14, 'aft body point behind the drawn pod', { sz: 12, c: '#d8a07a' }); }
  // header
  out += eyebrow(32, 40, 'What the sim flies · the model itself');
  out += T(32, 72, n.length + ' masses, ' + def.beams.length + ' members, ' + def.strips.length + ' lifting panels', { sz: 24, w: 600 });
  out += T(32, 94, 'Plan above, side below, one scale. The rendered plane is the faint ghost behind it.', { sz: 13, c: DIM });
  return svg(W, Hh, out, 'The simulation model of the ' + NAME[k]);
}

// ===================================================================================================================
// 6. THE BREAKING POINT - the load test carried on until a part lets go (the bench to destruction)
// ===================================================================================================================
const GRPNAME = key => { const m = /^(wing|boom)(\d?)([LR]):(\w+)$/.exec(key || ''); if (!m) return key;
  const side = m[3] === 'L' ? 'left' : 'right';
  return m[1] === 'boom' ? side + ' boom attachment' : side + ' ' + (m[4] === 'strut' ? 'lift strut fitting' : m[4] === 'root' ? 'wing root fitting' : m[4]); };
function breakPage(k) {
  const B = J('destroy_' + k + '.json')[k], st = B.st, W = 800, Hh = 520;
  const n = B.nodes, Dp = B.dispBreak || B.dispEnd;
  let tip = 0; n.forEach((q, i) => { if (q.tag === 'WF') tip = Math.max(tip, Math.abs(Dp[i][1])); });
  const K = tip > 0.1 * B.semi ? 1 : Math.max(5, Math.round(0.11 * B.semi / Math.max(1e-4, tip) / 5) * 5);
  const cx = W / 2; let base = 0, s = 1;
  const P = (i, ex) => { const p = n[i].p, d = ex ? Dp[i] : [0, 0, 0]; return [cx - (p[2] + K * d[2]) * s, base - (p[1] + K * d[1]) * s]; };
  { let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < n.length; i++) for (const ex of [0, 1]) { const q = P(i, ex); u0 = Math.min(u0, q[0] - cx); u1 = Math.max(u1, q[0] - cx); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
    s = Math.min(700 / Math.max(2 * Math.abs(u0), 2 * Math.abs(u1)), 230 / (v1 - v0));
    let top = Infinity; for (let i = 0; i < n.length; i++) for (const ex of [0, 1]) top = Math.min(top, P(i, ex)[1]); base = 160 - top; }
  let out = '';
  for (const b of B.beams) if (b.cls === 'wing' && n[b.a].tag === 'WF' && n[b.b].tag === 'WF') out += L(P(b.a, 0), P(b.b, 0), FAINT, 1.1, '4 5');
  const BAD = 'rgb(224,110,70)', WARN = '#d8a07a';
  const brokenSet = new Set(B.broken);
  B.beams.forEach((b, i) => { if (b.vis === 'inner' || brokenSet.has(i) || b.yielded) return; out += L(P(b.a, 1), P(b.b, 1), 'rgba(151,144,127,.35)', 0.8); });
  B.beams.forEach((b, i) => { if (b.vis === 'inner' || brokenSet.has(i) || !b.yielded) return; out += L(P(b.a, 1), P(b.b, 1), WARN, 1.8); });
  B.beams.forEach((b, i) => { if (!brokenSet.has(i)) return; out += L(P(b.a, 1), P(b.b, 1), BAD, 2.2, '5 4'); });
  if (B.firstBreak) { const b = B.beams[B.firstBreak.beam], a = P(b.a, 1), c = P(b.b, 1), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    out += `<circle cx="${m[0].toFixed(1)}" cy="${m[1].toFixed(1)}" r="11" fill="none" stroke="${BAD}" stroke-width="1.8"/>`;
    out += T(m[0] + (m[0] < cx ? -16 : 16), m[1] - 16, (B.firstBreak.how === 'kink' ? 'first to buckle' : 'first to break'), { sz: 12.5, c: BAD, w: 600, a: m[0] < cx ? 'end' : 'start' }); }
  // the ladder: limit, ultimate, first set, first break, the part let go
  const gMax = Math.max(7, (st.brokeAt || 6) * 1.08), lx0 = 40, lx1 = W - 40, ly = Hh - 88, gx = g => lx0 + (lx1 - lx0) * g / gMax;
  out += L([lx0, ly], [lx1, ly], 'rgba(244,239,230,.35)', 1);
  for (let g = 0; g <= gMax; g += (gMax > 10 ? 2 : 1)) out += L([gx(g), ly - 3], [gx(g), ly + 3], FAINT, 1) + T(gx(g), ly + 16, g + ' g', { sz: 10.5, c: FAINT, a: 'middle' });
  const mk = (g, lab, col, up, anc) => { if (g == null) return; const x = gx(g); out += `<circle cx="${x.toFixed(1)}" cy="${ly}" r="4.5" fill="${col}"/>` + L([x, ly - 6], [x, ly - (up ? 34 : 20)], col, 1) +
    T(x + (anc === 'end' ? -5 : anc === 'start' ? 5 : 0), ly - (up ? 38 : 24), lab, { sz: 12, c: col, a: anc || (x > W - 140 ? 'end' : x < 140 ? 'start' : 'middle'), w: 500 }); };
  const near = g => g != null && Math.abs(g - 5.7) < 1.2;
  mk(3.8, 'limit 3.8', DIM, false, st.yieldAt != null && Math.abs(st.yieldAt - 3.8) < 0.8 ? 'end' : null);
  mk(5.7, 'ultimate 5.7', DIM, true, near(st.brokeAt) || near(st.breakAt) ? 'end' : null);
  const same = st.yieldAt != null && st.breakAt != null && Math.abs(st.yieldAt - st.breakAt) < 0.05;
  const bk = st.breakAt != null && Math.abs((st.brokeAt || 0) - st.breakAt) > 0.05 && Math.abs(st.breakAt - (st.yieldAt || 0)) < 1.2;
  if (!same) mk(st.yieldAt, 'first bend ' + st.yieldAt.toFixed(2), WARN, false, Math.abs(st.yieldAt - 3.8) < 0.8 ? 'start' : bk ? 'end' : null);
  if (st.breakAt != null && Math.abs((st.brokeAt || 0) - st.breakAt) > 0.05) mk(st.breakAt, 'first ' + (B.firstBreak && B.firstBreak.how === 'kink' ? 'buckle ' : 'break ') + st.breakAt.toFixed(1), BAD, bk, bk ? 'start' : null);
  mk(st.brokeAt, (same ? 'bends and breaks ' : 'lets go ') + st.brokeAt.toFixed(2), BAD, true, near(st.brokeAt) ? 'start' : null);
  // header
  const seq = B.groups.map(G => GRPNAME(G.key));
  out += eyebrow(32, 40, 'Breaking point · the bench to destruction');
  out += T(32, 72, 'It broke at ' + st.brokeAt.toFixed(1) + ' g: the ' + seq[0], { sz: 24, w: 600 });
  out += T(32, 94, (seq.length > 1 ? 'Then, within 0.3 s: ' + seq.slice(1).join(', ') + '. ' : '') + (K === 1 ? 'Drawn true to scale.' : 'Bending drawn ×' + K + '.'), { sz: 13, c: DIM });
  // footer key
  const ky = Hh - 30; let kx = 32;
  for (const [c, t, d] of [['rgba(151,144,127,.6)', 'held', null], [WARN, 'bent for good (past yield)', null], [BAD, 'broken', '5 4']]) { out += L([kx, ky - 4], [kx + 22, ky - 4], c, 2.2, d) + T(kx + 30, ky, t, { sz: 12, c: DIM }); kx += 52 + t.length * 6.6; }
  out += T(W - 32, ky, B.beams.filter(b => b.yielded).length + ' members bent, ' + B.broken.length + ' broken', { sz: 12, c: FAINT, a: 'end' });
  return svg(W, Hh, out, 'Test to destruction of the ' + NAME[k]);
}
module.exports.simPage = simPage; module.exports.breakPage = breakPage;
