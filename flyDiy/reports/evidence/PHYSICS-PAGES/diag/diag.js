// diag.js - DIAGNOSTIC: the drawn aeroplane (the headless editor's own meshes, three orthographic silhouettes) against
// what the sim flies (buildGen: strips, members, masses, body drag points, propeller, contacts, CG and NP), for every plane
// REAL-FIGURES validated. Measures the drawn shape where the sim has a number and flags a difference over 3 %.
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const C = require('/workspace/pp-wt/flyDiy/tools/flight_core.js');
const H = __dirname;
const TH = { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', bad: '#b5462a', ok: '#55652a', member: 'rgba(43,41,36,.28)',
             struct: '#8fb0c4', ctl: '#6fc2b0', eng: '#e2a056', gear: '#a9bd6e', edge: 'rgba(43,41,36,.55)' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x, y, s, o) => { o = o || {}; return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.sz || 13}" fill="${o.c || TH.ink}"${o.w ? ` font-weight="${o.w}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`; };
const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''} stroke-linecap="round"/>`;
const r2 = x => (Math.round(x * 100) / 100).toFixed(2), r0 = x => String(Math.round(x));

function unRle(v) { const m = new Uint8Array(v.W * v.H); let i = 0, c = 0; for (const n of v.rle) { if (c) m.fill(1, i, i + n); i += n; c ^= 1; } return m; }
function png(mask, W, Hh, rgb, a) {
  const raw = Buffer.alloc((W * 4 + 1) * Hh);
  for (let y = 0; y < Hh; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W; x++) { const o = y * (W * 4 + 1) + 1 + x * 4; if (mask[y * W + x]) { raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = a; } } }
  const chunk = (t, d) => { const b = Buffer.alloc(8 + d.length + 4); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t), d])) >>> 0, 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(Hh, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
// the frame fit (fiche_physics.js fitFrame's, on any projection): the offset (and the side view's tilt) that puts the most nodes on pixels
function fit(pts, m, W, Hh, s, rots) {
  let best = null;
  for (const rd of rots) {
    const c = Math.cos(rd * Math.PI / 180), sn = Math.sin(rd * Math.PI / 180);
    const A = pts.map(p => (p[0] * c - p[1] * sn) * s), B = pts.map(p => (p[0] * sn + p[1] * c) * s);
    const a0 = Math.min(...A), a1 = Math.max(...A), b0 = Math.min(...B), b1 = Math.max(...B);
    for (let ox = Math.floor(-a0) - 30; ox <= Math.ceil(W - a1) + 30; ox += 1)
      for (let oy = Math.floor(-b0) - 30; oy <= Math.ceil(Hh - b1) + 30; oy += 1) {
        let sc = 0; for (let i = 0; i < A.length; i++) { const u = (A[i] + ox) | 0, v = (B[i] + oy) | 0; if (u >= 0 && u < W && v >= 0 && v < Hh && m[v * W + u]) sc++; }
        if (!best || sc > best.score) best = { ox, oy, rot: rd, score: sc, n: A.length };
      }
  }
  return best;
}
const PROJ = { side: p => [p[0], -p[1]], plan: p => [p[2], p[0]], front: p => [p[2], -p[1]] };

function analyse(rec, fm) {
  const def = C.buildGen(rec.spec), S = def.spec, n = def.nodes, V = {};
  for (const k of ['side', 'plan', 'front']) {
    // the source: the baked fiche's own render (fm) when the plane has one, else the headless editor's silhouettes
    const v = fm ? { W: fm.views[k].W, H: fm.views[k].H, s: fm.s } : rec.probe.views[k];
    const m = fm ? new Uint8Array(fs.readFileSync(__dirname + '/fm_' + rec.key + '_' + k + '.bin')) : unRle(v);
    if (fm) v.href = 'data:image/webp;base64,' + fs.readFileSync(fm.views[k].file).toString('base64');
    const fr = fit(n.map(q => PROJ[k](q.p)), m, v.W, v.H, v.s, k === 'side' ? [-2, -1, -0.5, 0, 0.5, 1, 2] : [0]);
    V[k] = { W: v.W, H: v.H, s: v.s, m, fr, href: v.href || null };
  }
  // drawn measures, in the core's frame (the side's small tilt ignored for the measures)
  const P = V.plan, Sd = V.side, F = V.front;
  const plan = { at: (x, z) => { const u = Math.round(z * P.s + P.fr.ox), v = Math.round(x * P.s + P.fr.oy); return u >= 0 && u < P.W && v >= 0 && v < P.H && P.m[v * P.W + u]; } };
  const side = { at: (x, y) => { const u = Math.round(x * Sd.s + Sd.fr.ox), v = Math.round(-y * Sd.s + Sd.fr.oy); return u >= 0 && u < Sd.W && v >= 0 && v < Sd.H && Sd.m[v * Sd.W + u]; } };
  const rowWidth = (x) => { let a = null, b = null; const v = Math.round(x * P.s + P.fr.oy); if (v < 0 || v >= P.H) return 0; for (let u = 0; u < P.W; u++) if (P.m[v * P.W + u]) { if (a === null) a = u; b = u; } return a === null ? 0 : (b - a + 1) / P.s; };
  const colRun = (z, x0, x1, xIn) => { // the contiguous drawn run along x at span z that holds xIn (plan)
    const st = 1 / P.s; if (!plan.at(xIn, z)) { let best = null; for (let x = x0; x <= x1; x += st) if (plan.at(x, z) && (best === null || Math.abs(x - xIn) < Math.abs(best - xIn))) best = x; if (best === null) return null; xIn = best; }
    // a hinge's cut (the elevator's, the flap's: 12 mm drawn gaps) is bridged: the run goes on over a gap up to 4 cm
    const on = (x) => { for (let g = 0; g <= 0.04; g += st) if (plan.at(x + g, z)) return true; return false; }, onB = (x) => { for (let g = 0; g <= 0.04; g += st) if (plan.at(x - g, z)) return true; return false; };
    let a = xIn, b = xIn; while (a - st >= x0 - 0.5 && onB(a - st)) a -= st; while (b + st <= x1 + 0.5 && on(b + st)) b += st;
    while (!plan.at(a, z) && a < b) a += st; while (!plan.at(b, z) && b > a) b -= st; return [a, b + st]; };
  const strips = def.strips, nd = i => n[i].p;
  const edge = st => { const F0 = nd(st.fIn), R0 = nd(st.rIn), d = [0, 1, 2].map(q => R0[q] - F0[q]), Ln = Math.hypot(...d) || 1; return { le: F0[0] - d[0] / Ln * st.chord * 0.15, te: F0[0] + d[0] / Ln * st.chord * 0.85 }; };
  const W0 = strips.filter(s => s.kind === 'wing'), ST = strips.filter(s => s.kind === 'stab'), FN = strips.filter(s => s.kind === 'fin');
  const finds = [], meas = [];
  const cmp = (key, label, drawn, flown, unit, where, note) => {
    if (drawn == null || flown == null || !isFinite(drawn) || !isFinite(flown) || flown === 0) return;
    const d = (flown - drawn) / drawn; const row = { key, label, drawn, flown, d, unit: unit || 'm', where, note }; meas.push(row); if (Math.abs(d) > 0.03) finds.push(row); };
  // wing span
  if (W0.length) {
    const semiF = Math.max(...W0.map(s => Math.max(Math.abs(nd(s.fOut)[2]), Math.abs(nd(s.rOut)[2]))));
    const le = Math.min(...W0.map(s => edge(s).le)), te = Math.max(...W0.map(s => edge(s).te));
    let spanD = 0; for (let x = le; x <= te; x += 1 / P.s) spanD = Math.max(spanD, rowWidth(x));
    cmp('span', 'wing span', spanD, 2 * semiF, 'm', { view: 'plan', p: [(le + te) / 2, 0, semiF] }, 'the flown span is where the last panel ends; a drawn tip cap outboard of it carries no lift');
    // the chord at half the semispan (one plane; a biplane's two overlap in plan)
    const planes = new Set(W0.map(s => s.plane || 0));
    if (planes.size === 1) {
      const zc = semiF * 0.5, s0 = W0.filter(s => nd(s.fOut)[2] > 0).sort((a, b) => Math.abs((nd(a.fIn)[2] + nd(a.fOut)[2]) / 2 - zc) - Math.abs((nd(b.fIn)[2] + nd(b.fOut)[2]) / 2 - zc))[0];
      if (s0) { const e = edge(s0), run = colRun(zc, e.le - 0.6, e.te + 0.6, (e.le + e.te) / 2);
        if (run) cmp('chord', 'wing chord at half span', run[1] - run[0], s0.chord, 'm', { view: 'plan', p: [e.te, 0, zc] }); }
    }
  }
  // the tailplane
  if (ST.length) {
    const le = Math.min(...ST.map(s => edge(s).le)), te = Math.max(...ST.map(s => edge(s).te)), semi = Math.max(...ST.map(s => Math.abs(nd(s.fOut)[2])));
    let spanD = 0; for (let x = le - 0.15; x <= te + 0.15; x += 1 / P.s) spanD = Math.max(spanD, rowWidth(x));
    cmp('hspan', 'tailplane span', spanD, 2 * semi, 'm', { view: 'plan', p: [(le + te) / 2, 0, semi] });
    // the chord and the leading edge at ONE station, both sides measured there (55 % of the half-span)
    const zc = semi * 0.55, s0 = ST.filter(s => nd(s.fOut)[2] > 0).sort((a, b) => Math.abs((nd(a.fIn)[2] + nd(a.fOut)[2]) / 2 - zc) - Math.abs((nd(b.fIn)[2] + nd(b.fOut)[2]) / 2 - zc))[0];
    if (s0) { const e = edge(s0), zs0 = (nd(s0.fIn)[2] + nd(s0.fOut)[2]) / 2, run = colRun(zs0, e.le - 0.4, e.te + 0.4, (e.le + e.te) / 2);
      // the AREA, not one chord: the sim spreads the tailplane's area over its panels its own way; what flies is the area
      { let px = 0; const v0 = Math.round((le - 0.12) * P.s + P.fr.oy), v1 = Math.round((te + 0.12) * P.s + P.fr.oy);
        for (let v = Math.max(0, v0); v <= Math.min(P.H - 1, v1); v++) for (let u = 0; u < P.W; u++) if (P.m[v * P.W + u]) px++;
        cmp('harea', 'tailplane area (plan, gross)', px / (P.s * P.s), ST.reduce((a, q) => a + q.area, 0), 'm²', { view: 'plan', p: [e.te, 0, zs0] }); }
      if (run) {
        const arm = Math.max(0.5, e.le - (W0.length ? Math.min(...W0.map(q => edge(q).le)) : 0)), dx = e.le - run[0];
        if (Math.abs(dx) > 0.03 * arm) finds.push({ key: 'hx', label: 'tailplane position', drawn: run[0], flown: e.le, d: dx / arm, unit: 'm', where: { view: 'plan', p: [e.le, 0, -zs0] }, note: 'its leading edge ' + Math.abs(Math.round(dx * 100)) + ' cm ' + (dx > 0 ? 'aft of' : 'ahead of') + ' the drawn one (% of the tail arm)' }); } }
  }
  // the fin
  if (FN.length) {
    const top = Math.max(...FN.map(s => Math.max(nd(s.fOut)[1], nd(s.rOut)[1]))), root = Math.min(...FN.map(s => Math.min(nd(s.fIn)[1], nd(s.rIn)[1])));
    const le = Math.min(...FN.map(s => Math.min(edge(s).le, nd(s.fOut)[0]))), te = Math.max(...FN.map(s => edge(s).te));
    let yTop = null; for (let y = top + 0.8; y > root; y -= 1 / Sd.s) { let hit = false; for (let x = le - 0.2; x <= te + 0.2; x += 1 / Sd.s) if (side.at(x, y)) { hit = true; break; } if (hit) { yTop = y; break; } }
    if (yTop != null) cmp('fin', 'fin top (height)', yTop, top, 'm', { view: 'side', p: [(le + te) / 2, top, 0] });
  }
  // where the body ends (the plan's centreline, behind the wing): the first gap - only on a real render (the editor's
  // headless scene carries no fuselage skin: the game generates and poses it at run time)
  if (fm) {
    const STn = def.parts.ST, bodyEnd = STn[STn.length - 1].x, wTe = W0.length ? Math.max(...W0.map(s => edge(s).te)) : 0;
    let x = Math.max(0.5, wTe), drawnEnd = null; const st = 1 / P.s;
    let open = 0; while (x < bodyEnd + 1.5) { if (!plan.at(x, 0) && !plan.at(x, 0.05) && !plan.at(x, -0.05)) { open += st; if (open >= 0.15) { drawnEnd = x - open; break; } } else open = 0; x += st; }
    if (drawnEnd != null && drawnEnd < bodyEnd - 0.05) cmp('body', 'body length (to its end)', drawnEnd, bodyEnd, 'm', { view: 'plan', p: [bodyEnd, 0, 0] }, 'the sim\'s fuselage sections run past the drawn body (the aero body: drag, side area)');
  }
  const bal = C.genAidBalance(def);
  return { def, V, finds, meas, bal, src: fm ? 'fiche' : 'editor' };
}

// ---- the drawing ----------------------------------------------------------------------------------------------------------
function draw(rec, A) {
  const def = A.def, n = def.nodes, S = def.spec, V = A.V;
  const xs = n.map(q => q.p[0]), ys = n.map(q => q.p[1]), zs = n.map(q => q.p[2]);
  // one scale for the three views, from the drawn silhouettes (metres)
  const ext = k => ({ w: V[k].W / V[k].s, h: V[k].H / V[k].s });
  const Ls = ext('side'), Lp = ext('plan'), Lf = ext('front');
  const s = Math.min(640 / Ls.w, 200 / Ls.h, 640 / Lp.w, 450 / Lp.h, 460 / Lf.w, 200 / Lf.h);
  const boxes = { side: { x: 40, y: 112, w: 660, h: 220 }, front: { x: 720, y: 112, w: 440, h: 220 }, plan: { x: 40, y: 362, w: 660, h: 470 } };
  const out = [`<defs><pattern id="hh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${TH.ctl}" stroke-width="1.6"/></pattern></defs>`,
               `<rect width="1200" height="900" fill="${TH.bg}"/>`, `<rect x="12" y="12" width="1176" height="876" rx="14" fill="none" stroke="${TH.hair}" stroke-width="1.5"/>`];
  const map = {};
  for (const k of ['side', 'plan', 'front']) {
    const v = V[k], f = s / v.s, b = boxes[k], ox = b.x + (b.w - v.W * f) / 2, oy = b.y + (b.h - v.H * f) / 2;
    out.push(`<image href="${v.href || png(v.m, v.W, v.H, [176, 166, 148], 120)}" opacity="${v.href ? 0.55 : 1}" x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${(v.W * f).toFixed(1)}" height="${(v.H * f).toFixed(1)}"/>`);
    const r = (v.fr.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
    map[k] = p => { const q = PROJ[k](p); return [ox + f * ((q[0] * c - q[1] * sn) * v.s + v.fr.ox), oy + f * ((q[0] * sn + q[1] * c) * v.s + v.fr.oy)]; };
    out.push(T(b.x, b.y - 8, k === 'side' ? 'SIDE' : k === 'plan' ? 'FROM ABOVE' : 'FROM THE FRONT', { sz: 11, c: TH.faint, w: 600, ls: 1.4 }));
  }
  const CT = S.controls || {};
  const share = st => st.kind === 'stab' ? (CT.elevator && CT.elevator.chord) || 0 : st.kind === 'fin' ? (CT.rudder && CT.rudder.chord) || 0 : st.ail ? (CT.aileron && CT.aileron.chord) || 0 : st.flap ? (CT.flap && CT.flap.chord) || 0 : 0;
  const quad = (st, M) => {
    const F0 = n[st.fIn].p, F1 = n[st.fOut].p, R0 = n[st.rIn].p, R1 = n[st.rOut].p;
    const at = (Fp, Rp, t) => { const d = [0, 1, 2].map(q => Rp[q] - Fp[q]), Ln = Math.hypot(...d) || 1; return [0, 1, 2].map(q => Fp[q] + d[q] / Ln * st.chord * (t - 0.15)); };
    const cs = share(st), hinge = 1 - cs, poly = (pts, attr) => `<path d="M${pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L')} Z" ${attr}/>`;
    return poly([at(F0, R0, 0), at(F1, R1, 0), at(F1, R1, hinge), at(F0, R0, hinge)].map(M), `fill="${TH.struct}" fill-opacity=".35" stroke="${TH.edge}" stroke-width=".7"`) +
      (cs > 0 ? poly([at(F0, R0, hinge), at(F1, R1, hinge), at(F1, R1, 1), at(F0, R0, 1)].map(M), `fill="url(#hh)" stroke="${TH.ctl}" stroke-width=".8"`) : '');
  };
  for (const st of def.strips) { if (st.kind !== 'fin') out.push(quad(st, map.plan)); else out.push(quad(st, map.side)); }
  // the lifting panels edge-on from the front: their front-spar lines, thick
  for (const st of def.strips) out.push(L(map.front(n[st.fIn].p), map.front(n[st.fOut].p), st.kind === 'fin' ? TH.ctl : TH.struct, 3));
  for (const b of def.beams) { if (b.vis === 'inner') continue; const A_ = n[b.a].p, B_ = n[b.b].p; for (const k of ['side', 'plan', 'front']) out.push(L(map[k](A_), map[k](B_), TH.member, 0.55)); }
  // the body's two drag points, the propeller, the contacts, the masses
  const mid = ix => { const a = [].concat(ix || []); if (!a.length) return null; const c = [0, 0, 0]; for (const i of a) for (let q = 0; q < 3; q++) c[q] += n[i].p[q] / a.length; return c; };
  const fd = mid(def.refs.fusDrag), fa = mid(def.refs.fusDragAft), P_ = def.params;
  const disc = (q, a) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(Math.sqrt(a / Math.PI) * s).toFixed(1)}" fill="${TH.ink}" fill-opacity=".08" stroke="${TH.ink}" stroke-width="1.1" stroke-dasharray="4 3"/>`;
  if (fd) out.push(disc(map.side(fd), P_.fusCdA[0]) + disc(map.plan(fd), P_.fusCdA[0]));
  if (fa) out.push(disc(map.side(fa), P_.fusCdAAft[1] * 0.25) + disc(map.plan(fa), P_.fusCdAAft[1] * 0.25));
  const D = (P_.prop && P_.prop.D) || 0, eng = mid(def.refs.engine), pusher = (S.engAt || []).some(e => e && e.mount === 'pusher');
  for (const e of (S.engAt || [eng && { x: eng[0], y: eng[1], z: 0 }]).filter(Boolean)) {
    const ex = e.x + (e.mount === 'pusher' ? 0.25 : -0.12);
    out.push(L(map.side([ex, e.y - D / 2, e.z]), map.side([ex, e.y + D / 2, e.z]), TH.eng, 2.4) + L(map.plan([ex, e.y, e.z - D / 2]), map.plan([ex, e.y, e.z + D / 2]), TH.eng, 2.4));
    const fc = map.front([ex, e.y, e.z]); out.push(`<circle cx="${fc[0].toFixed(1)}" cy="${fc[1].toFixed(1)}" r="${(D / 2 * s).toFixed(1)}" fill="none" stroke="${TH.eng}" stroke-width="1.6"/>`);
  }
  for (const i of [].concat(def.refs.mains || [], def.refs.tw >= 0 ? [def.refs.tw] : [])) for (const k of ['side', 'front']) { const q = map[k](n[i].p); out.push(`<rect x="${(q[0] - 3.5).toFixed(1)}" y="${(q[1] - 3.5).toFixed(1)}" width="7" height="7" fill="${TH.gear}" stroke="${TH.edge}" stroke-width=".6"/>`); }
  for (const q of n) if (q.m > 0.05) for (const k of ['side', 'plan']) { const a = map[k](q.p); out.push(`<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="${Math.max(0.8, Math.sqrt(q.m) * 0.6).toFixed(1)}" fill="${TH.ink}" fill-opacity=".6"/>`); }
  // CG and NP
  const cgY = (() => { let m = 0, y = 0; for (const q of n) { m += q.m; y += q.m * q.p[1]; } return y / m; })();
  const cgS = map.side([A.bal.cgX, cgY, 0]), npS = map.side([A.bal.npX, cgY, 0]), cgP = map.plan([A.bal.cgX, 0, 0]), npP = map.plan([A.bal.npX, 0, 0]);
  const cgMark = q => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="7" fill="${TH.bg}" stroke="${TH.ink}" stroke-width="1.5"/><path d="M${q[0] - 7} ${q[1]} A7 7 0 0 1 ${q[0]} ${q[1] - 7} L${q[0]} ${q[1]} Z M${q[0] + 7} ${q[1]} A7 7 0 0 1 ${q[0]} ${q[1] + 7} L${q[0]} ${q[1]} Z" fill="${TH.ink}"/>`;
  out.push(cgMark(cgS) + cgMark(cgP) + L([npS[0], npS[1] - 22], [npS[0], npS[1] + 22], TH.ink, 1.3, '4 3') + L([npP[0], npP[1] - 30], [npP[0], npP[1] + 30], TH.ink, 1.3, '4 3') + T(npP[0] + 4, npP[1] - 32, 'NP', { sz: 11, w: 600 }) + T(cgP[0] - 10, cgP[1] - 12, 'CG', { sz: 11, w: 600, a: 'end' }));
  // the flags
  A.finds.forEach((f, i) => { const q = map[f.where.view](f.where.p); out.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="13" fill="none" stroke="${TH.bad}" stroke-width="2"/>` + `<circle cx="${(q[0] + 13).toFixed(1)}" cy="${(q[1] - 13).toFixed(1)}" r="9" fill="${TH.bad}"/>` + T(q[0] + 13, q[1] - 9, String(i + 1), { sz: 11.5, w: 600, a: 'middle', c: '#fff' })); });
  // the header and the findings column
  out.push(T(40, 46, 'DIAGNOSTIC · THE DRAWN PLANE AGAINST WHAT THE SIM FLIES', { sz: 12, c: TH.faint, w: 600, ls: 1.6 }) + T(40, 72, rec.label, { sz: 22, w: 600 }) + T(1160, 46, rec.file, { sz: 11.5, c: TH.dim, a: 'end' }) + T(1160, 64, A.src === 'fiche' ? 'drawn: the game\'s own fiche render' : 'drawn: the editor\'s shapes (no body skin: the body is not compared)', { sz: 11.5, c: A.src === 'fiche' ? TH.dim : TH.bad, a: 'end' }));
  let y = 372; const x0 = 730;
  out.push(T(x0, y - 22, A.finds.length ? 'OFF BY MORE THAN 3 %' : 'NOTHING OFF BY MORE THAN 3 %', { sz: 11, c: A.finds.length ? TH.bad : TH.ok, w: 600, ls: 1.2 }));
  A.finds.forEach((f, i) => { out.push(`<circle cx="${x0 + 9}" cy="${y - 4}" r="9" fill="${TH.bad}"/>` + T(x0 + 9, y, String(i + 1), { sz: 11.5, w: 600, a: 'middle', c: '#fff' }) +
    T(x0 + 26, y, f.label, { sz: 14, w: 600 }) + T(x0 + 26, y + 18, (f.key === 'hx' ? 'drawn LE x ' : 'drawn ') + r2(f.drawn) + ' ' + f.unit + ' · flown ' + r2(f.flown) + ' ' + f.unit + ' · ' + (f.d > 0 ? '+' : '') + r0(f.d * 100) + ' %', { sz: 13, c: TH.bad }));
    y += 42; if (f.note) { out.push(T(x0 + 26, y - 6, f.note.slice(0, 64) + (f.note.length > 64 ? '…' : ''), { sz: 11, c: TH.dim })); y += 12; } });
  y += 10; out.push(T(x0, y, 'WITHIN 3 %', { sz: 11, c: TH.ok, w: 600, ls: 1.2 })); y += 20;
  for (const f of A.meas.filter(f => Math.abs(f.d) <= 0.03)) { out.push(T(x0, y, f.label, { sz: 12.5 }) + T(1160, y, r2(f.drawn) + ' / ' + r2(f.flown) + ' ' + f.unit, { sz: 12.5, c: TH.dim, a: 'end' })); y += 19; }
  y += 14; out.push(T(x0, y, 'CG ' + r0(A.bal.cgX * 100) + ' cm, NP ' + r0(A.bal.npX * 100) + ' cm behind the firewall · margin ' + r0(A.bal.sm * 100) + ' % of the mean chord', { sz: 12, c: TH.dim }));
  y += 18; out.push(T(x0, y, 'fit: side ' + V.side.fr.score + '/' + V.side.fr.n + ', plan ' + V.plan.fr.score + '/' + V.plan.fr.n + ', front ' + V.front.fr.score + '/' + V.front.fr.n + ' nodes on the drawing', { sz: 11, c: TH.faint }));
  // the key
  const ky = 862; let kx = 40;
  for (const [mark, t] of [[`<rect x="0" y="-9" width="16" height="10" fill="${TH.struct}" fill-opacity=".35" stroke="${TH.edge}"/>`, 'lifting panel'], [`<rect x="0" y="-9" width="16" height="10" fill="url(#hh)" stroke="${TH.ctl}"/>`, 'control surface'],
    [`<circle cx="8" cy="-4" r="6" fill="none" stroke="${TH.ink}" stroke-dasharray="3 2"/>`, 'body drag point'], [`<line x1="0" y1="-4" x2="16" y2="-4" stroke="${TH.eng}" stroke-width="2.4"/>`, 'propeller disc'],
    [`<rect x="4" y="-8" width="7" height="7" fill="${TH.gear}"/>`, 'ground contact'], [`<circle cx="8" cy="-4" r="3" fill="${TH.ink}" fill-opacity=".6"/>`, 'mass'], [`<rect x="0" y="-9" width="16" height="10" fill="rgb(176,166,148)" fill-opacity=".47"/>`, 'the drawn plane']]) {
    out.push(`<g transform="translate(${kx},${ky})">${mark}</g>` + T(kx + 22, ky, t, { sz: 12, c: TH.dim })); kx += 36 + t.length * 6.4; }
  return `<svg viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">${out.join('')}</svg>`;
}
module.exports = { analyse, draw };
