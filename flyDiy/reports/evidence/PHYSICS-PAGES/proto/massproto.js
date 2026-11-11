// massproto.js - MASS & BALANCE prototypes (for AIRCRAFT-LOOKS' Mass & price page): the mass breakdown three ways
// (treemap, sunburst, stacked bar) and one balance panel, from buildGen(spec).parts.ledger, genAidBalance, the designGross,
// genSystemsResolve - on the fiche's cream sheet. Prototype only: the game's page is AIRCRAFT-LOOKS'.
'use strict';
const fs = require('fs');
const C = require('/workspace/pp-wt/flyDiy/tools/flight_core.js');
const { pics } = require('./fp_try.js');
const SPECS = require('./specs.json');
const CAT = { structure: ['Structure', '#8fb0c4'], engine: ['Engine & fuel', '#e2a056'], gear: ['Gear', '#a9bd6e'], systems: ['Systems', '#b99be0'],
              fittings: ['Fittings', '#6fc2b0'], interior: ['Interior', '#e0868a'], finish: ['Finish', '#b7ab9b'], load: ['Crew & cargo', '#d8cdb8'] };
const ROWCAT = { fuselage: 'structure', wings: 'structure', bracing: 'structure', tail: 'structure', stol: 'structure', engines: 'engine', vessel: 'engine', fuel: 'engine',
                 gear: 'gear', panel: 'systems', elec: 'systems', avionics: 'systems', outfit: 'fittings', cabin: 'load', furnish: 'interior', paint: 'finish', cargo: 'load', pod: 'structure' };
const ROWNAME = { fuselage: 'Fuselage', wings: 'Wings', bracing: 'Struts & bracing', tail: 'Tail', stol: 'STOL kit', engines: 'Engine & propeller', vessel: 'Tank', fuel: 'Fuel',
                  gear: 'Undercarriage', panel: 'Instruments', elec: 'Electrics', avionics: 'Radios', outfit: 'Fittings & doors', cabin: 'Crew & passengers', furnish: 'Seats & trim',
                  paint: 'Paint', cargo: 'Cargo', pod: 'Belly pod' };
const TH = { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', edge: 'rgba(43,41,36,.55)', lead: 'rgba(43,41,36,.38)' };
const W = 1200, H = 800;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x, y, s, o) => { o = o || {}; return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.sz || 14}" fill="${o.c || TH.ink}"${o.w ? ` font-weight="${o.w}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`; };
const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''}/>`;
const r0 = x => String(Math.round(x)), r1 = x => (Math.round(x * 10) / 10).toFixed(1);

function data(k) {
  const def = C.buildGen(SPECS[k].spec), Lg = def.parts.ledger, bal = C.genAidBalance(def), S = def.spec;
  const sy = C.genSystemsResolve(S, {});
  const rows = Object.keys(Lg).filter(r => Lg[r].mass > 0.05).map(r => ({ key: r, name: ROWNAME[r] || r, cat: ROWCAT[r] || 'structure', kg: Lg[r].mass, x: Lg[r].mx / Lg[r].mass, payload: !!Lg[r].payload, cost: Lg[r].cost }));
  // the third level where the game itemises: the systems' own rows
  for (const r of rows) if (['panel', 'elec', 'avionics'].includes(r.key)) {
    const it = sy.rows.filter(q => q.group === r.key && q.kg > 0).map(q => ({ name: q.name, kg: q.kg }));
    const s = it.reduce((a, q) => a + q.kg, 0); if (it.length > 1 && Math.abs(s - r.kg) < 0.05 * r.kg + 0.2) r.items = it;
  }
  const M = rows.reduce((a, r) => a + r.kg, 0), MX = rows.reduce((a, r) => a + r.kg * r.x, 0);
  const sub = keys => { const rs = rows.filter(r => !keys.includes(r.key)); const m = rs.reduce((a, r) => a + r.kg, 0); return { m, x: rs.reduce((a, r) => a + r.kg * r.x, 0) / m }; };
  const steps = [['empty', sub(['cabin', 'fuel', 'cargo'])], ['+ crew', sub(['fuel', 'cargo'])], ['+ fuel', sub(['cargo'])], ['+ cargo', { m: M, x: MX / M }]];
  const noFuel = sub(['fuel']);
  return { k, name: pics(k).name, reg: pics(k).reg, pics: pics(k).pics, rows, M, cg: MX / M, bal, mtow: def.parts.designGross, steps, noFuel };
}

// squarified treemap (Bruls et al.): items {v} in a rect -> rects
function squarify(items, x, y, w, h) {
  const out = [], tot = items.reduce((a, i) => a + i.v, 0); if (tot <= 0) return out;
  const scale = w * h / tot; let rest = items.slice().sort((a, b) => b.v - a.v).map(i => Object.assign({}, i, { a: i.v * scale }));
  const worst = (row, side) => { const s = row.reduce((a, r) => a + r.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
  while (rest.length) {
    const side = Math.min(w, h); let row = [rest[0]], i = 1;
    while (i < rest.length && worst(row.concat(rest[i]), side) <= worst(row, side)) { row.push(rest[i]); i++; }
    const s = row.reduce((a, r) => a + r.a, 0);
    if (w >= h) { const cw = s / h; let yy = y; for (const r of row) { const hh = r.a / cw; out.push(Object.assign(r, { x, y: yy, w: cw, h: hh })); yy += hh; } x += cw; w -= cw; }
    else { const ch = s / w; let xx = x; for (const r of row) { const ww = r.a / ch; out.push(Object.assign(r, { x: xx, y, w: ww, h: ch })); xx += ww; } y += ch; h -= ch; }
    rest = rest.slice(i);
  }
  return out;
}
const cats = D => { const c = {}; for (const r of D.rows) (c[r.cat] = c[r.cat] || { key: r.cat, v: 0, rows: [] }).rows.push(r); for (const k in c) c[k].v = c[k].rows.reduce((a, r) => a + r.kg, 0); return Object.values(c); };
const hatch = `<pattern id="ld" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(43,41,36,.22)" stroke-width="1.6"/></pattern>`;
const fillOf = (cat, payload) => payload ? 'url(#ld)' : CAT[cat][1];

function treemap(D, bx, by, bw, bh) {
  const out = [];
  for (const c of squarify(cats(D), bx, by, bw, bh)) {
    const pad = 3, head = c.h > 60 && c.w > 90 ? 20 : 0;
    out.push(`<rect x="${c.x + 1}" y="${c.y + 1}" width="${c.w - 2}" height="${c.h - 2}" rx="3" fill="${CAT[c.key][1]}" fill-opacity=".28" stroke="${TH.edge}" stroke-width="1"/>`);
    if (head) out.push(T(c.x + 7, c.y + 15, CAT[c.key][0] + ' · ' + r0(c.v) + ' kg', { sz: 12.5, w: 600 }));
    for (const r of squarify(c.rows.map(r => Object.assign({ v: r.kg }, r)), c.x + pad, c.y + pad + head, c.w - 2 * pad, c.h - 2 * pad - head)) {
      out.push(`<rect x="${r.x + 1}" y="${r.y + 1}" width="${Math.max(0, r.w - 2)}" height="${Math.max(0, r.h - 2)}" rx="2" fill="${fillOf(c.key, r.payload)}" fill-opacity="${r.payload ? 1 : 0.75}" stroke="${TH.edge}" stroke-width="0.8"/>`);
      if (r.items && r.w > 70 && r.h > 50) for (const q of squarify(r.items.map(q => Object.assign({ v: q.kg }, q)), r.x + 4, r.y + 20, r.w - 8, r.h - 24))
        out.push(`<rect x="${q.x + 0.5}" y="${q.y + 0.5}" width="${Math.max(0, q.w - 1)}" height="${Math.max(0, q.h - 1)}" fill="none" stroke="${TH.edge}" stroke-width="0.6" stroke-dasharray="2 2"/>`);
      if (r.w > 64 && r.h > 30) out.push(T(r.x + 6, r.y + 15, r.name, { sz: 12, w: 500 }) + (r.h > 44 ? T(r.x + 6, r.y + 30, r1(r.kg) + ' kg · ' + r0(100 * r.kg / D.M) + ' %', { sz: 11, c: TH.dim }) : ''));
      else if (r.w > 34 && r.h > 16) out.push(T(r.x + 4, r.y + 13, r0(r.kg), { sz: 10.5, c: TH.dim }));
    }
  }
  return out;
}
function sunburst(D, cx, cy, R) {
  const out = [], C2 = cats(D).sort((a, b) => b.v - a.v);
  const arc = (a0, a1, r0_, r1_) => { const p = (a, r) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]; const lg = a1 - a0 > Math.PI ? 1 : 0;
    const [A, B, Cc, Dd] = [p(a0, r1_), p(a1, r1_), p(a1, r0_), p(a0, r0_)];
    return `M${A[0].toFixed(1)} ${A[1].toFixed(1)} A${r1_} ${r1_} 0 ${lg} 1 ${B[0].toFixed(1)} ${B[1].toFixed(1)} L${Cc[0].toFixed(1)} ${Cc[1].toFixed(1)} A${r0_} ${r0_} 0 ${lg} 0 ${Dd[0].toFixed(1)} ${Dd[1].toFixed(1)} Z`; };
  let a = 0;
  for (const c of C2) {
    const a1 = a + 2 * Math.PI * c.v / D.M;
    out.push(`<path d="${arc(a, a1, R * 0.32, R * 0.62)}" fill="${CAT[c.key][1]}" fill-opacity=".9" stroke="${TH.bg}" stroke-width="1.5"/>`);
    const am = (a + a1) / 2; if (a1 - a > 0.22) out.push(T(cx + R * 0.47 * Math.sin(am), cy - R * 0.47 * Math.cos(am) + 4, r0(100 * c.v / D.M) + ' %', { sz: 12, w: 600, a: 'middle' }));
    let b = a;
    for (const r of c.rows.slice().sort((p, q) => q.kg - p.kg)) {
      const b1 = b + 2 * Math.PI * r.kg / D.M;
      out.push(`<path d="${arc(b, b1, R * 0.64, R)}" fill="${fillOf(c.key, r.payload)}" fill-opacity="${r.payload ? 1 : 0.6}" stroke="${TH.bg}" stroke-width="1.2"/>`);
      const bm = (b + b1) / 2; if (b1 - b > 0.16) { const rx = cx + (R + 12) * Math.sin(bm), ry = cy - (R + 12) * Math.cos(bm); out.push(T(rx, ry + 4, r.name + ' ' + r0(r.kg), { sz: 11.5, a: Math.sin(bm) > 0.1 ? 'start' : Math.sin(bm) < -0.1 ? 'end' : 'middle' })); }
      b = b1;
    }
    a = a1;
  }
  out.push(T(cx, cy - 4, r0(D.M) + ' kg', { sz: 20, w: 600, a: 'middle' }) + T(cx, cy + 16, 'as flown', { sz: 12, c: TH.dim, a: 'middle' }));
  return out;
}
// the sunburst, labelled properly: category names curved along the inner ring where they fit, every outer slice its own
// callout (a leader to a label column, two lines when the name is long, stacked without overlaps, inside the frame)
function wrap2(s, n) { if (s.length <= n) return [s]; const w = s.split(' '); let a = ''; let i = 0; for (; i < w.length; i++) { const t = a ? a + ' ' + w[i] : w[i]; if (t.length > n && a) break; a = t; } return [a, w.slice(i).join(' ')]; }
function sunburst2(D, cx, cy, R, box) {
  const out = [], C2 = cats(D).sort((a, b) => b.v - a.v), r0_ = R * 0.28, r1_ = R * 0.62, r2_ = R * 0.65;
  // the small categories (under 8 %) close the ring: centred on twelve o'clock, so their callouts split left and right
  const smallA = C2.filter(c => c.v / D.M < 0.08).reduce((t, c) => t + 2 * Math.PI * c.v / D.M, 0);
  const arc = (a0, a1, ri, ro) => { const p = (a, r) => [cx + r * Math.sin(a), cy - r * Math.cos(a)], lg = a1 - a0 > Math.PI ? 1 : 0;
    const [A, B, Cc, Dd] = [p(a0, ro), p(a1, ro), p(a1, ri), p(a0, ri)];
    return `M${A[0].toFixed(1)} ${A[1].toFixed(1)} A${ro} ${ro} 0 ${lg} 1 ${B[0].toFixed(1)} ${B[1].toFixed(1)} L${Cc[0].toFixed(1)} ${Cc[1].toFixed(1)} A${ri} ${ri} 0 ${lg} 0 ${Dd[0].toFixed(1)} ${Dd[1].toFixed(1)} Z`; };
  const defs = [], labels = [];
  let a = smallA / 2, id = 0;
  for (const c of C2) {
    const a1 = a + 2 * Math.PI * c.v / D.M, col = CAT[c.key][1];
    out.push(`<path d="${arc(a, a1, r0_, r1_)}" fill="${col}" fill-opacity=".92" stroke="${TH.bg}" stroke-width="2"/>`);
    // the category's name on the ring: along its arc where it fits (read upright: the lower half runs the other way)
    const rm = (r0_ + r1_) / 2, len = (a1 - a) * rm, name = CAT[c.key][0], pct = Math.round(100 * c.v / D.M) + ' %';
    const am = (a + a1) / 2, lower = Math.cos(am) < 0;
    const pth = (r) => { const p0 = [cx + r * Math.sin(lower ? a1 : a), cy - r * Math.cos(lower ? a1 : a)], p1 = [cx + r * Math.sin(lower ? a : a1), cy - r * Math.cos(lower ? a : a1)];
      return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 ${a1 - a > Math.PI ? 1 : 0} ${lower ? 0 : 1} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`; };
    const sub = pct + ' · ' + r0(c.v) + ' kg', two = len > Math.max(name.length * 6.6, sub.length * 6.2) + 12;
    if (two || len > name.length * 6.2 + 6) {
      const k1 = 'cp' + (id++), k2 = 'cp' + (id++);
      defs.push(`<path id="${k1}" d="${pth(rm + (two ? (lower ? -5 : 5) : (lower ? -4 : 4)))}"/><path id="${k2}" d="${pth(rm + (lower ? 11 : -11))}"/>`);
      out.push(`<text font-size="${two ? 12.5 : 11.5}" font-weight="600" fill="${TH.ink}"><textPath href="#${k1}" startOffset="50%" text-anchor="middle">${esc(name)}</textPath></text>`);
      if (two) out.push(`<text font-size="11.5" fill="${TH.ink}"><textPath href="#${k2}" startOffset="50%" text-anchor="middle">${esc(sub)}</textPath></text>`);
    } else if (len > 26) out.push(T(cx + rm * Math.sin(am), cy - rm * Math.cos(am) + 4, pct, { sz: 11, w: 600, a: 'middle' }));
    // the outer ring: the rows
    let b = a;
    for (const r of c.rows.slice().sort((p, q) => q.kg - p.kg)) {
      const b1 = b + 2 * Math.PI * r.kg / D.M;
      out.push(`<path d="${arc(b, b1, r2_, R)}" fill="${fillOf(c.key, r.payload)}" fill-opacity="${r.payload ? 1 : 0.62}" stroke="${TH.bg}" stroke-width="1.5"/>` + (r.payload ? `<path d="${arc(b, b1, r2_, R)}" fill="none" stroke="${col}" stroke-width="1"/>` : ''));
      labels.push({ r, c, am: (b + b1) / 2, small: (b1 - b) < 0.12 });
      b = b1;
    }
    a = a1;
  }
  out.unshift(`<defs>${defs.join('')}</defs>`);
  // the callouts ALL AROUND the ring: each label on a circle outside it, at its slice's own angle, pushed apart along the
  // circle where two would overlap; one straight leader from the slice to its label; every label kept inside the box
  const RL = R + 34, PADX = box.x0 || 40, PADX1 = box.x1 || 690;
  const L2 = labels.map(q => { const lines = wrap2(q.r.name, 16); const w = Math.max(...lines.map(l => l.length), 13) * 6.6, h = 14 * lines.length + 14; return Object.assign(q, { lines, w, h, th: q.am }); }).sort((p, q) => p.am - q.am);
  const place = q => { const x = cx + RL * Math.sin(q.th), y = cy - RL * Math.cos(q.th), sn = Math.sin(q.th), cs = Math.cos(q.th);
    const an = sn > 0.28 ? 'start' : sn < -0.28 ? 'end' : 'middle';
    const bx = an === 'start' ? x : an === 'end' ? x - q.w : x - q.w / 2, by = cs > 0.28 ? y - q.h : cs < -0.28 ? y : y - q.h / 2;
    return { x, y, an, bx: Math.max(PADX, Math.min(PADX1 - q.w, bx)), by: Math.max(box.y0, Math.min(box.y1 - q.h, by)) }; };
  const hit = (a, b) => a.bx < b.bx + b.q.w + 6 && b.bx < a.bx + a.q.w + 6 && a.by < b.by + b.q.h + 2 && b.by < a.by + a.q.h + 2;
  for (let it = 0; it < 400; it++) {
    let moved = false; const P = L2.map(q => Object.assign(place(q), { q }));
    for (let i = 0; i < L2.length; i++) { const j = (i + 1) % L2.length; if (i === j) continue;
      if (hit(P[i], P[j])) { L2[i].th -= 0.012; L2[j].th += 0.012; moved = true; } }
    if (!moved) break;
  }
  for (const q of L2) {
    const p = place(q), ax = cx + (R + 2) * Math.sin(q.am), ay = cy - (R + 2) * Math.cos(q.am);
    // the leader: straight, from the slice to the label's nearest edge
    const ex = Math.max(p.bx - 3, Math.min(p.bx + q.w + 3, ax)), ey = Math.max(p.by - 2, Math.min(p.by + q.h + 2, ay));
    out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${TH.lead}" stroke-width=".9"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="1.6" fill="${TH.ink}"/>`);
    const tx = p.an === 'start' ? p.bx + 14 : p.an === 'end' ? p.bx + q.w : p.bx + q.w / 2 + 7, chip = p.an === 'start' ? p.bx : p.an === 'end' ? p.bx + q.w - Math.max(...q.lines.map(l => l.length)) * 6.6 - 14 : p.bx + q.w / 2 - Math.max(...q.lines.map(l => l.length)) * 3.3 - 7;
    out.push(`<rect x="${chip.toFixed(1)}" y="${(p.by + 2).toFixed(1)}" width="10" height="10" rx="2" fill="${fillOf(q.c.key, q.r.payload)}" stroke="${TH.edge}" stroke-width=".7"/>`);
    q.lines.forEach((ln, i) => out.push(T(tx, p.by + 11 + 14 * i, ln, { sz: 12.5, w: 500, a: p.an })));
    out.push(T(tx, p.by + 11 + 14 * q.lines.length, r1(q.r.kg) + ' kg · ' + (100 * q.r.kg / D.M < 1 ? '<1' : Math.round(100 * q.r.kg / D.M)) + ' %', { sz: 11.5, c: TH.dim, a: p.an }));
  }
  out.push(T(cx, cy - 4, r0(D.M) + ' kg', { sz: 21, w: 600, a: 'middle' }) + T(cx, cy + 16, D.emptyCenter ? 'empty' : 'as flown', { sz: 12, c: TH.dim, a: 'middle' }));
  return out;
}

// AS FLOWN: one bar from zero to the maximum take-off weight - the empty plane (its categories, as in the circle), then
// what is added to it (crew, fuel, cargo), then what is left to the maximum
function loadBar(D, bx, by, bw) {
  const out = [], kx = bw / Math.max(D.mtow, D.M), H = 26; let x = bx;
  out.push(T(bx, by - 14, 'AS FLOWN · WHAT GETS ADDED TO THE EMPTY PLANE', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
  const empty = D.rows.filter(r => !r.payload), emptyKg = empty.reduce((a, r) => a + r.kg, 0);
  for (const c of cats({ rows: empty }).sort((a, b) => b.v - a.v)) { const w = c.v * kx;
    out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1).toFixed(1)}" height="${H}" fill="${CAT[c.key][1]}" fill-opacity=".8" stroke="${TH.edge}" stroke-width=".6"/>`); x += w; }
  out.push(T((bx + x) / 2, by + H / 2 + 4.5, 'empty ' + r0(emptyKg) + ' kg', { sz: 12.5, w: 600, a: 'middle' }));
  const add = [['cabin', 'crew & passengers'], ['fuel', 'fuel'], ['cargo', 'cargo']];
  // the added loads' labels: under their segment, stepped down a row where they would touch the one before
  const placed = [];
  for (const [key, nm] of add) { const r = D.rows.find(q => q.key === key); if (!r || r.kg < 0.5) continue; const w = r.kg * kx;
    out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1).toFixed(1)}" height="${H}" fill="url(#ld)" stroke="${CAT[r.cat === 'load' ? 'finish' : r.cat][1]}" stroke-width="1.4"/>`);
    const lab = '+ ' + nm + ' ' + r0(r.kg) + ' kg', lw = lab.length * 6.4, cxl = x + w / 2;
    let row = 0; while (placed.some(p => p.row === row && Math.abs(p.cx - cxl) < (p.w + lw) / 2 + 8)) row++;
    placed.push({ row, cx: cxl, w: lw });
    const ly = by + H + 22 + 18 * row;
    out.push(L([cxl, by + H + 2], [cxl, ly - 12], TH.lead, 0.8) + T(Math.min(bx + bw, Math.max(bx + lw / 2, cxl)), ly, lab, { sz: 12, a: 'middle' })); x += w; }
  const mxp = bx + D.mtow * kx;
  out.push(T(x - 2, by - (mxp - x < 150 ? 22 : 6), 'as flown ' + r0(D.M) + ' kg', { sz: 12.5, w: 600, a: 'end' }));
  if (D.mtow > D.M) out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${((D.mtow - D.M) * kx - 1).toFixed(1)}" height="${H}" fill="none" stroke="${TH.ink}" stroke-dasharray="3 3"/>` + T(x + (D.mtow - D.M) * kx / 2, by + H / 2 + 4, r0(D.mtow - D.M) + ' kg free', { sz: 11.5, c: TH.dim, a: 'middle' }));
  const mx = bx + D.mtow * kx; out.push(L([mx, by - 10], [mx, by + H + 10], '#b5462a', 1.8) + T(mx, by - 6, 'max ' + r0(D.mtow) + ' kg', { sz: 12, w: 600, c: '#b5462a', a: 'end' }));
  return out;
}
function bars(D, bx, by, bw) {
  const out = [], C2 = cats(D).sort((a, b) => b.v - a.v);
  let x = bx;
  out.push(T(bx, by - 10, 'ONE BAR, 100 % = ' + r0(D.M) + ' kg', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
  for (const c of C2) {
    const w = bw * c.v / D.M;
    let y = by; out.push(`<rect x="${x + 1}" y="${by}" width="${Math.max(0, w - 2)}" height="44" rx="2" fill="${CAT[c.key][1]}" fill-opacity=".85" stroke="${TH.edge}" stroke-width=".8"/>`);
    if (w > 70) out.push(T(x + 6, by + 18, CAT[c.key][0], { sz: 12, w: 600 }) + T(x + 6, by + 34, r0(c.v) + ' kg · ' + r0(100 * c.v / D.M) + ' %', { sz: 11, c: TH.ink }));
    // the rows below, a column per category, a thin bar each
    y = by + 64;
    for (const r of c.rows.slice().sort((p, q) => q.kg - p.kg)) {
      const rw = Math.max(1, (w - 6) * r.kg / c.v);
      out.push(`<rect x="${x + 3}" y="${y}" width="${rw.toFixed(1)}" height="9" rx="1.5" fill="${fillOf(c.key, r.payload)}" fill-opacity="${r.payload ? 1 : 0.75}" stroke="${TH.edge}" stroke-width=".6"/>`);
      if (w > 70) out.push(T(x + 3, y + 22, r.name.slice(0, Math.floor(w / 6.6)), { sz: 11 }) + T(x + w - 4, y + 22, r0(r.kg), { sz: 11, c: TH.dim, a: 'end' }));
      y += 32;
    }
    x += w;
  }
  return out;
}
// the balance, as a weight-and-balance envelope: the side picture with the CG's good range on it, then the chart a handbook
// draws - CG along, weight up, the good range (the game's own margin bands, 5 to 40 % of the mean chord ahead of the
// neutral point) up to the maximum take-off weight, the loading walked from empty, and the fuel burnt back out
function balance(D, bx, by, bw) {
  const out = [], pic = D.pics.side, fr = pic.frame, f = Math.min(bw / pic.W, 170 / pic.H), ox = bx + (bw - pic.W * f) / 2, oy = by;
  const Xp = x => ox + f * (x * pic.s + fr.ox), Yb = oy + pic.H * f;
  const np = D.bal.npX, cb = D.bal.cBar, g0 = np - 0.40 * cb, g1 = np - 0.05 * cb;
  out.push(`<rect x="${Xp(g0).toFixed(1)}" y="${oy - 4}" width="${(Xp(g1) - Xp(g0)).toFixed(1)}" height="${(pic.H * f + 8).toFixed(1)}" fill="#a9bd6e" fill-opacity=".25" stroke="#7d8f45" stroke-dasharray="4 3"/>`);
  out.push(`<image href="${pic.href}" x="${ox.toFixed(1)}" y="${oy}" width="${(pic.W * f).toFixed(1)}" height="${(pic.H * f).toFixed(1)}"/>`);
  out.push(`<circle cx="${Xp(D.cg).toFixed(1)}" cy="${(oy + pic.H * f * 0.55).toFixed(1)}" r="7" fill="${TH.bg}" stroke="${TH.ink}" stroke-width="1.6"/><path d="M${Xp(D.cg) - 7} ${oy + pic.H * f * 0.55} A7 7 0 0 1 ${Xp(D.cg)} ${oy + pic.H * f * 0.55 - 7} L${Xp(D.cg)} ${oy + pic.H * f * 0.55} Z M${Xp(D.cg) + 7} ${oy + pic.H * f * 0.55} A7 7 0 0 1 ${Xp(D.cg)} ${oy + pic.H * f * 0.55 + 7} L${Xp(D.cg)} ${oy + pic.H * f * 0.55} Z" fill="${TH.ink}"/>`);
  // the zoom lines from the range on the picture to the chart below
  const cx0 = bx + 40, cx1 = bx + bw - 10, cy0 = Yb + 36, cy1 = cy0 + 236;
  const xlo = Math.min(g0, ...D.steps.map(s => s[1].x), D.noFuel.x) - 0.08, xhi = Math.max(np, ...D.steps.map(s => s[1].x), D.noFuel.x) + 0.08;
  const mlo = Math.floor(D.steps[0][1].m * 0.9 / 50) * 50, mhi = Math.ceil(D.mtow * 1.06 / 50) * 50;
  const X = x => cx0 + (cx1 - cx0) * (x - xlo) / (xhi - xlo), Y = m => cy1 - (cy1 - cy0) * (m - mlo) / (mhi - mlo);
  out.push(L([Xp(xlo), Yb + 6], [cx0, cy0], TH.lead, 0.8, '2 3') + L([Xp(xhi), Yb + 6], [cx1, cy0], TH.lead, 0.8, '2 3'));
  out.push(`<rect x="${cx0}" y="${cy0}" width="${cx1 - cx0}" height="${cy1 - cy0}" fill="none" stroke="${TH.hair}"/>`);
  // the good range up to MTOW
  out.push(`<rect x="${X(g0).toFixed(1)}" y="${Y(D.mtow).toFixed(1)}" width="${(X(g1) - X(g0)).toFixed(1)}" height="${(cy1 - Y(D.mtow)).toFixed(1)}" fill="#a9bd6e" fill-opacity=".28" stroke="#7d8f45" stroke-width="1.2"/>`);
  out.push(T(X((g0 + g1) / 2), Y(D.mtow) + 18, 'the good range', { sz: 12, c: '#55652a', w: 600, a: 'middle' }));
  out.push(L([cx0, Y(D.mtow)], [cx1, Y(D.mtow)], '#b5462a', 1.4, '6 3') + T(cx1 - 4, Y(D.mtow) - 6, 'max take-off ' + r0(D.mtow) + ' kg', { sz: 12, c: '#b5462a', w: 600, a: 'end' }));
  out.push(L([X(np), cy0], [X(np), cy1], TH.ink, 1.2, '5 3') + T(X(np) - 4, cy1 - 8, 'neutral point', { sz: 11.5, c: TH.dim, a: 'end' }));
  // the axes
  for (let m = mlo; m <= mhi; m += (mhi - mlo > 600 ? 200 : 100)) out.push(L([cx0 - 4, Y(m)], [cx0, Y(m)], TH.faint, 1) + T(cx0 - 7, Y(m) + 4, r0(m), { sz: 10.5, c: TH.faint, a: 'end' }));
  for (let x = Math.ceil(xlo * 10) / 10; x <= xhi; x += 0.1) out.push(L([X(x), cy1], [X(x), cy1 + 4], TH.faint, 1) + T(X(x), cy1 + 16, r0(x * 100), { sz: 10.5, c: TH.faint, a: 'middle' }));
  out.push(T(cx1, cy1 + 32, 'CG, cm behind the firewall', { sz: 11, c: TH.dim, a: 'end' }) + T(cx0 - 34, cy0 - 8, 'kg', { sz: 11, c: TH.dim }));
  // the loading walk
  let prev = null;
  D.steps.forEach(([lab, p], i) => { if (i && Math.abs(p.m - D.steps[i - 1][1].m) < 0.5) return; const q = [X(p.x), Y(p.m)]; if (prev) out.push(`<path d="M${prev[0].toFixed(1)} ${prev[1].toFixed(1)} L${q[0].toFixed(1)} ${q[1].toFixed(1)}" stroke="${TH.ink}" stroke-width="1.6" fill="none"/>`);
    out.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${i === 3 ? 6 : 4.5}" fill="${i === 3 ? TH.ink : TH.bg}" stroke="${TH.ink}" stroke-width="1.5"/>`);
    const lft = i % 2 === 0 && i > 0; out.push(T(q[0] + (lft ? -9 : 9), q[1] + 4, (i ? lab : 'empty') + ' · ' + r0(p.m) + ' kg', { sz: 12, w: i === 3 ? 600 : 400, c: i === 3 ? TH.ink : TH.dim, a: lft ? 'end' : 'start' })); prev = q; });
  const nf = D.noFuel, a = [X(D.cg), Y(D.M)], z = [X(nf.x), Y(nf.m)];
  out.push(`<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${z[0].toFixed(1)} ${z[1].toFixed(1)}" stroke="#c27a3e" stroke-width="1.6" stroke-dasharray="4 3" fill="none"/><circle cx="${z[0].toFixed(1)}" cy="${z[1].toFixed(1)}" r="4.5" fill="${TH.bg}" stroke="#c27a3e" stroke-width="1.5"/>` +
    '');
  const sm = D.bal.sm, band = sm < 0 ? 'behind the neutral point' : sm < 0.05 ? 'close to the neutral point' : sm <= 0.40 ? 'in the good range' : 'far forward';
  out.push(T(bx, cy1 + 58, 'As flown: CG ' + r0(D.cg * 100) + ' cm behind the firewall, ' + band + ',', { sz: 12.5 }) + T(bx, cy1 + 76, r0(sm * 100) + ' % of the mean chord ahead of the neutral point.', { sz: 12.5 }));
  out.push(T(bx, cy1 + 94, r0(D.mtow - D.M) + ' kg below the maximum take-off weight.', { sz: 12.5, c: TH.dim }));
  out.push(`<circle cx="${bx + 4}" cy="${cy1 + 107}" r="4" fill="${TH.bg}" stroke="#c27a3e" stroke-width="1.5"/>` + T(bx + 14, cy1 + 112, 'With the fuel burnt the CG moves ' + Math.abs(Math.round((nf.x - D.cg) * 100)) + ' cm ' + (nf.x >= D.cg ? 'aft' : 'forward') + ' (the dashed line).', { sz: 12.5, c: '#8a5520' }));
  return out;
}
function page(D, variant) {
  const out = [`<defs>${hatch}</defs>`, `<rect width="${W}" height="${H}" fill="${TH.bg}"/>`, `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="none" stroke="${TH.hair}" stroke-width="1.5"/>`];
  out.push(T(48, 58, 'MASS & BALANCE · THE EMPTY PLANE, THEN WHAT IT CARRIES', { sz: 12.5, c: TH.faint, w: 600, ls: 1.8 }));
  const Em = D.rows.filter(r => !r.payload), eKg = Em.reduce((a, r) => a + r.kg, 0), big = cats({ rows: Em }).sort((a, b) => b.v - a.v)[0];
  out.push(T(48, 94, CAT[big.key][0] + ' is ' + r0(100 * big.v / eKg) + ' % of the empty plane; the CG sits ' + r0(D.bal.sm * 100) + ' % ahead of the neutral point', { sz: 24, w: 600 }));
  out.push(T(48, 120, 'Empty ' + r0(D.steps[0][1].m) + ' kg, as flown ' + r0(D.M) + ' kg, maximum ' + r0(D.mtow) + ' kg. The circle is the plane itself; the bar adds what it carries (hatched).', { sz: 14.5, c: TH.dim }));
  out.push(T(W - 48, 58, D.name + '  ' + (D.reg || ''), { sz: 15, w: 600, a: 'end' }) + T(W - 48, H - 32, 'Wingsmith · certified airworthy', { sz: 12, c: TH.faint, a: 'end' }));
  if (variant === 'treemap') out.push(...treemap(D, 48, 150, 600, 590));
  if (variant === 'sunburst') { const Em = D.rows.filter(r => !r.payload), De = Object.assign({}, D, { rows: Em, M: Em.reduce((a, r) => a + r.kg, 0), emptyCenter: true });
    out.push(...sunburst2(De, 360, 392, 122, { x0: 40, x1: 680, y0: 146, y1: 612 })); out.push(...loadBar(D, 48, 668, 620)); }
  if (variant === 'bars') out.push(...bars(D, 48, 180, 620));
  out.push(T(700, 166, 'BALANCE', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
  out.push(...balance(D, 700, 190, 452));
  const uid = 'm' + (++SEQ) + '_';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">${out.join('')}</svg>`
    .replace(/id="(cp\d+|ld)"/g, 'id="' + uid + '$1"').replace(/href="#(cp\d+)"/g, 'href="#' + uid + '$1"').replace(/url\(#ld\)/g, 'url(#' + uid + 'ld)');
}
let SEQ = 0;
module.exports = { data, page };
if (require.main === module) {
  const D = data(process.argv[2] || 'c172');
  fs.writeFileSync(__dirname + '/mass_try.html', `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"></head><body style="margin:0;background:#888">${['treemap', 'sunburst', 'bars'].map(v => '<div style="width:1200px;margin:6px">' + page(D, v) + '</div>').join('')}</body></html>`);
}
