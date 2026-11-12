// diag2.js - DIAGNOSTIC, registered: the drawn aeroplane in the PHYSICS frame (probe_raster2: the join's own datums take the
// editor's scene into the model frame exactly, the drawn airframe surface included), the fiche render (where the plane has
// one) laid on that silhouette by its pixels, and the sim's own model on top. Measures where the sim has a number, flags
// over 3 %, and says what the physics uses for the aft body today.
'use strict';
const fs = require('fs'), zlib = require('zlib');
const C = require('/workspace/pp-wt/flyDiy/tools/flight_core.js');
const TH = { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', bad: '#b5462a', ok: '#55652a', member: 'rgba(43,41,36,.3)',
             struct: '#8fb0c4', ctl: '#6fc2b0', eng: '#e2a056', gear: '#a9bd6e', edge: 'rgba(43,41,36,.55)', float: '#5f7f9a' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x, y, s, o) => { o = o || {}; return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.sz || 13}" fill="${o.c || TH.ink}"${o.w ? ` font-weight="${o.w}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`; };
const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''} stroke-linecap="round"/>`;
const r2 = x => (Math.round(x * 100) / 100).toFixed(2), r0 = x => String(Math.round(x));
const PROJ = { side: p => [p[0], -p[1]], plan: p => [p[2], p[0]], front: p => [p[2], -p[1]] };
function unRle(v) { const m = new Uint8Array(v.W * v.H); let i = 0, c = 0; for (const n of v.rle) { if (c) m.fill(1, i, i + n); i += n; c ^= 1; } return m; }
function png(mask, W, H, rgb, a) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = y * (W * 4 + 1) + 1 + x * 4; if (mask[y * W + x]) { raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = a; } }
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t), d])) >>> 0, 8 + d.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
// a view in metres: the editor's mask (exact) or the fiche's, registered on it
function editorView(v) { const m = unRle(v); return { kind: 'editor', W: v.W, H: v.H, s: v.s, u0: v.u0, v0: v.v0, m,
  at: (u, w) => { const i = Math.floor((u - v.u0) * v.s), j = Math.floor((w - v.v0) * v.s); return i >= 0 && i < v.W && j >= 0 && j < v.H && m[j * v.W + i] === 1; } }; }
// the fiche's mask laid on the editor's: the offset (and on the side, a tilt within 2 degrees) that puts the most of the
// fiche's pixels on the editor's silhouette; its score is the share of the fiche's pixels that land on it
function register(E, F, sf, rots) {
  const pts = []; for (let j = 0; j < F.H; j += 2) for (let i = 0; i < F.W; i += 2) if (F.m[j * F.W + i]) pts.push([i / sf, j / sf]);
  const cE = (() => { let a = 0, b = 0, n = 0; for (let j = 0; j < E.H; j += 2) for (let i = 0; i < E.W; i += 2) if (E.m[j * E.W + i]) { a += E.u0 + i / E.s; b += E.v0 + j / E.s; n++; } return [a / n, b / n]; })();
  const cF = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  let best = null;
  const tryAt = (du, dv, rd) => { const c = Math.cos(rd * Math.PI / 180), s = Math.sin(rd * Math.PI / 180); let h = 0;
    for (const p of pts) { const x = p[0] - cF[0], y = p[1] - cF[1]; if (E.at(cE[0] + du + x * c - y * s, cE[1] + dv + x * s + y * c)) h++; }
    if (!best || h > best.h) best = { du, dv, rd, h }; };
  for (const rd of rots) for (let du = -0.4; du <= 0.4; du += 0.04) for (let dv = -0.4; dv <= 0.4; dv += 0.04) tryAt(du, dv, rd);
  const b0 = best; for (const rd of rots.length > 1 ? [b0.rd - 0.25, b0.rd, b0.rd + 0.25] : [0]) for (let du = b0.du - 0.04; du <= b0.du + 0.04; du += 0.01) for (let dv = b0.dv - 0.04; dv <= b0.dv + 0.04; dv += 0.01) tryAt(du, dv, rd);
  const R = best, c = Math.cos(R.rd * Math.PI / 180), s = Math.sin(R.rd * Math.PI / 180);
  // fiche pixel (i, j) -> metres (u, w); and back
  const toM = (i, j) => { const x = i / sf - cF[0], y = j / sf - cF[1]; return [cE[0] + R.du + x * c - y * s, cE[1] + R.dv + x * s + y * c]; };
  const toPx = (u, w) => { const x = u - cE[0] - R.du, y = w - cE[1] - R.dv; return [(x * c + y * s + cF[0]) * sf, (-x * s + y * c + cF[1]) * sf]; };
  return { kind: 'fiche', W: F.W, H: F.H, s: sf, m: F.m, toM, toPx, rot: R.rd, share: R.h / pts.length, href: F.href,
    at: (u, w) => { const q = toPx(u, w), i = Math.floor(q[0]), j = Math.floor(q[1]); return i >= 0 && i < F.W && j >= 0 && j < F.H && F.m[j * F.W + i] === 1; } };
}

function aftBody(rec, def) {
  const S = def.spec, fu = rec.spec.fuselage || {}, STn = def.parts.ST, end = STn[STn.length - 1].x, mid = STn[Math.floor(STn.length * 0.65)] || STn[STn.length - 2];
  const drawnEnd = rec.probe.bodyEnd, boom = fu.boom || null, tw = S.tail && S.tail.type === 'twinBoom';
  const dep = r2(mid.yt - mid.yb);
  if (fu.profile && !tw) return { kind: 'drawn', text: 'The aero body follows the drawn fuselage' + (boom === 'rod' ? ' and its boom' : '') + ': the join measured its profile, to ' + r2(end) + ' m.' };
  if (tw) return { kind: 'twin', text: 'The tail sits on two booms, but the aero body is a fuselage cone to ' + r2(end) + ' m (the drawn pod ends at ' + r2(drawnEnd) + ' m): the tail-arm floor (AFT-PODS).' };
  if (boom === 'rod') return { kind: 'rod', text: 'A rod is drawn behind the pod, but the aero body is a full fuselage cone to ' + r2(end) + ' m, still ' + dep + ' m deep at ' + r2(mid.x) + ' m: no boom profile was measured (AFT-PODS).' };
  if (fu.profile) return { kind: 'drawn', text: 'The aero body follows the drawn fuselage: the join measured its profile, to ' + r2(end) + ' m.' };
  return { kind: 'family', text: 'The aero body is the family profile to ' + r2(end) + ' m (no profile measured).' };
}

function analyse(rec, fiche) {
  const def = C.buildGen(rec.spec), S = def.spec, n = def.nodes, V = {};
  for (const k of ['side', 'plan', 'front']) {
    const E = editorView(rec.probe.views[k]);
    V[k] = E;
    if (fiche) { const F = { W: fiche.views[k].W, H: fiche.views[k].H, m: new Uint8Array(fs.readFileSync(__dirname + '/fm_' + fiche.mk + '_' + k + '.bin')), href: 'data:image/webp;base64,' + fs.readFileSync(fiche.views[k].file).toString('base64') };
      V[k] = register(E, F, fiche.s, k === 'side' ? [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2] : [0]); V[k].E = E; }
  }
  const P = V.plan, Sd = V.side;
  const plan = (x, z) => P.at(z, x), side = (x, y) => Sd.at(x, -y);
  const st = 0.01;
  const rowWidth = x => { let a = null, b = null; for (let z = -20; z <= 20; z += st) if (plan(x, z)) { if (a === null) a = z; b = z; } return a === null ? 0 : b - a + st; };
  const colRun = (z, x0, x1, xIn) => { const on = x => { for (let g = 0; g <= 0.04; g += st) if (plan(x + g, z)) return true; return false; }, onB = x => { for (let g = 0; g <= 0.04; g += st) if (plan(x - g, z)) return true; return false; };
    if (!plan(xIn, z)) { let best = null; for (let x = x0; x <= x1; x += st) if (plan(x, z) && (best === null || Math.abs(x - xIn) < Math.abs(best - xIn))) best = x; if (best === null) return null; xIn = best; }
    let a = xIn, b = xIn; while (a - st >= x0 - 0.5 && onB(a - st)) a -= st; while (b + st <= x1 + 0.5 && on(b + st)) b += st; while (!plan(a, z) && a < b) a += st; while (!plan(b, z) && b > a) b -= st; return [a, b + st]; };
  const nd = i => n[i].p;
  const edge = q => { const F0 = nd(q.fIn), R0 = nd(q.rIn), d = [0, 1, 2].map(k => R0[k] - F0[k]), Ln = Math.hypot(...d) || 1; return { le: F0[0] - d[0] / Ln * q.chord * 0.15, te: F0[0] + d[0] / Ln * q.chord * 0.85 }; };
  const W0 = def.strips.filter(q => q.kind === 'wing'), ST = def.strips.filter(q => q.kind === 'stab'), FN = def.strips.filter(q => q.kind === 'fin');
  const finds = [], meas = [];
  const cmp = (key, label, drawn, flown, unit, where, note) => { if (drawn == null || flown == null || !isFinite(drawn) || !isFinite(flown) || !drawn) return;
    const d = (flown - drawn) / drawn, row = { key, label, drawn, flown, d, unit: unit || 'm', where, note }; meas.push(row); if (Math.abs(d) > 0.03) finds.push(row); };
  if (W0.length) {
    const semiF = Math.max(...W0.map(q => Math.max(Math.abs(nd(q.fOut)[2]), Math.abs(nd(q.rOut)[2])))), le = Math.min(...W0.map(q => edge(q).le)), te = Math.max(...W0.map(q => edge(q).te));
    let spanD = 0; for (let x = le; x <= te; x += 0.02) spanD = Math.max(spanD, rowWidth(x));
    cmp('span', 'wing span', spanD, 2 * semiF, 'm', { view: 'plan', p: [(le + te) / 2, 0, semiF] }, 'the flown span ends at the last panel; a tip cap outboard carries no lift');
    if (new Set(W0.map(q => q.plane || 0)).size === 1) {
      const zc = semiF * 0.5, s0 = W0.filter(q => nd(q.fOut)[2] > 0).sort((a, b) => Math.abs((nd(a.fIn)[2] + nd(a.fOut)[2]) / 2 - zc) - Math.abs((nd(b.fIn)[2] + nd(b.fOut)[2]) / 2 - zc))[0];
      if (s0) { const e = edge(s0), run = colRun(zc, e.le - 0.6, e.te + 0.6, (e.le + e.te) / 2); if (run) cmp('chord', 'wing chord at half span', run[1] - run[0], s0.chord, 'm', { view: 'plan', p: [e.te, 0, zc] }); }
    }
  }
  if (ST.length) {
    const le = Math.min(...ST.map(q => edge(q).le)), te = Math.max(...ST.map(q => edge(q).te)), semi = Math.max(...ST.map(q => Math.abs(nd(q.fOut)[2])));
    let spanD = 0; for (let x = le - 0.15; x <= te + 0.15; x += 0.01) spanD = Math.max(spanD, rowWidth(x));
    cmp('hspan', 'tailplane span', spanD, 2 * semi, 'm', { view: 'plan', p: [(le + te) / 2, 0, semi] });
    let area = 0; for (let x = le - 0.12; x <= te + 0.12; x += 0.01) area += rowWidth(x) * 0.01;
    cmp('harea', 'tailplane area (gross)', area, ST.reduce((a, q) => a + q.area, 0), 'm²', { view: 'plan', p: [te, 0, semi * 0.55] }, 'the drawn area counts the body under the tail');
    const zc = semi * 0.55, s0 = ST.filter(q => nd(q.fOut)[2] > 0).sort((a, b) => Math.abs((nd(a.fIn)[2] + nd(a.fOut)[2]) / 2 - zc) - Math.abs((nd(b.fIn)[2] + nd(b.fOut)[2]) / 2 - zc))[0];
    if (s0) { const e = edge(s0), zs0 = (nd(s0.fIn)[2] + nd(s0.fOut)[2]) / 2, run = colRun(zs0, e.le - 0.4, e.te + 0.4, (e.le + e.te) / 2);
      if (run) { const arm = Math.max(0.5, e.le - (W0.length ? Math.min(...W0.map(q => edge(q).le)) : 0)), dx = e.le - run[0];
        const row = { key: 'hx', label: 'tailplane position', drawn: run[0], flown: e.le, d: dx / arm, unit: 'm', where: { view: 'plan', p: [e.le, 0, -zs0] }, note: 'its leading edge ' + Math.abs(Math.round(dx * 100)) + ' cm ' + (dx > 0 ? 'aft of' : 'ahead of') + ' the drawn one' };
        meas.push(row); if (Math.abs(row.d) > 0.03) finds.push(row); } }
  }
  if (FN.length) {
    const top = Math.max(...FN.map(q => Math.max(nd(q.fOut)[1], nd(q.rOut)[1]))), root = Math.min(...FN.map(q => Math.min(nd(q.fIn)[1], nd(q.rIn)[1])));
    const le = Math.min(...FN.map(q => Math.min(edge(q).le, nd(q.fOut)[0]))), te = Math.max(...FN.map(q => edge(q).te));
    let yTop = null; for (let y = top + 0.8; y > root; y -= 0.01) { let hit = false; for (let x = le - 0.2; x <= te + 0.2; x += 0.01) if (side(x, y)) { hit = true; break; } if (hit) { yTop = y; break; } }
    if (yTop != null) cmp('fin', 'fin top (height)', yTop, top, 'm', { view: 'side', p: [(le + te) / 2, top, 0] });
  }
  { const STn = def.parts.ST, end = STn[STn.length - 1].x, dEnd = rec.probe.bodyEnd;
    // ...and its DEPTH two thirds of the way down the aft body: a rod drawn where the sim flies a cone (the length agrees)
    { const i = Math.max(1, Math.min(STn.length - 2, Math.round(STn.length * 0.66))), sx = STn[i].x, yc = (STn[i].yt + STn[i].yb) / 2, hs = STn[i].yt - STn[i].yb;
      let a = null, b = null; for (let y = yc - hs / 2 - 0.4; y <= yc + hs / 2 + 0.4; y += 0.005) if (side(sx, y)) { if (a === null) a = y; b = y; }
      const aftK = aftBody(rec, def).kind;
      if (a !== null && (aftK === 'rod' || aftK === 'twin')) cmp('depth', 'aero body depth at ' + r2(sx) + ' m', b - a + 0.005, hs, 'm', { view: 'side', p: [sx, yc, 0] }, 'the sim flies a fuselage section there; the drawing has the rod (AFT-PODS)'); }
    if (dEnd != null) cmp('body', 'aero body length (to its end)', dEnd, end, 'm', { view: 'side', p: [end, (STn[STn.length - 1].yt + STn[STn.length - 1].yb) / 2, 0] }, 'the sim\'s fuselage sections run past the drawn body'); }
  return { def, V, finds, meas, bal: C.genAidBalance(def), src: fiche ? 'fiche' : 'editor', aft: aftBody(rec, def) };
}

function draw(rec, A) {
  const def = A.def, n = def.nodes, S = def.spec, V = A.V;
  // the extents (metres) of the drawn views, the editor's (exact) in every case
  const ext = k => { const E = V[k].E || V[k]; return { u0: E.u0, v0: E.v0, w: E.W / E.s, h: E.H / E.s }; };
  const X = { side: ext('side'), plan: ext('plan'), front: ext('front') };
  const k = Math.min(640 / X.side.w, 200 / X.side.h, 640 / X.plan.w, 450 / X.plan.h, 440 / X.front.w, 200 / X.front.h);
  const boxes = { side: { x: 40, y: 112, w: 660, h: 220 }, front: { x: 720, y: 112, w: 440, h: 220 }, plan: { x: 40, y: 362, w: 660, h: 470 } };
  const out = [`<defs><pattern id="hh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${TH.ctl}" stroke-width="1.6"/></pattern></defs>`,
               `<rect width="1200" height="900" fill="${TH.bg}"/>`, `<rect x="12" y="12" width="1176" height="876" rx="14" fill="none" stroke="${TH.hair}" stroke-width="1.5"/>`];
  const map = {};
  for (const vk of ['side', 'plan', 'front']) {
    const e = X[vk], b = boxes[vk], ox = b.x + (b.w - e.w * k) / 2 - e.u0 * k, oy = b.y + (b.h - e.h * k) / 2 - e.v0 * k;
    map[vk] = p => { const q = PROJ[vk](p); return [ox + q[0] * k, oy + q[1] * k]; };
    const v = V[vk];
    if (v.kind === 'fiche') {
      // the fiche picture placed by its registration: pixel (i, j) -> metres (toM) -> the panel
      const a = v.toM(0, 0), bx = v.toM(1, 0), by = v.toM(0, 1);
      const M = [(bx[0] - a[0]) * k, (bx[1] - a[1]) * k, (by[0] - a[0]) * k, (by[1] - a[1]) * k, ox + a[0] * k, oy + a[1] * k];
      out.push(`<image href="${v.href}" width="${v.W}" height="${v.H}" opacity=".6" transform="matrix(${M.map(x => x.toFixed(5)).join(' ')})"/>`);
    } else {
      const E = v; out.push(`<image href="${png(E.m, E.W, E.H, [176, 166, 148], 125)}" x="${(ox + E.u0 * k).toFixed(1)}" y="${(oy + E.v0 * k).toFixed(1)}" width="${(E.W / E.s * k).toFixed(1)}" height="${(E.H / E.s * k).toFixed(1)}"/>`);
    }
    out.push(T(b.x, b.y - 8, vk === 'side' ? 'SIDE' : vk === 'plan' ? 'FROM ABOVE' : 'FROM THE FRONT', { sz: 11, c: TH.faint, w: 600, ls: 1.4 }));
  }
  const CT = S.controls || {};
  const share = q => q.kind === 'stab' ? (CT.elevator && CT.elevator.chord) || 0 : q.kind === 'fin' ? (CT.rudder && CT.rudder.chord) || 0 : q.ail ? (CT.aileron && CT.aileron.chord) || 0 : q.flap ? (CT.flap && CT.flap.chord) || 0 : 0;
  const quad = (q, M) => { const F0 = n[q.fIn].p, F1 = n[q.fOut].p, R0 = n[q.rIn].p, R1 = n[q.rOut].p;
    const at = (Fp, Rp, t) => { const d = [0, 1, 2].map(j => Rp[j] - Fp[j]), Ln = Math.hypot(...d) || 1; return [0, 1, 2].map(j => Fp[j] + d[j] / Ln * q.chord * (t - 0.15)); };
    const cs = share(q), hinge = 1 - cs, poly = (pts, attr) => `<path d="M${pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')} Z" ${attr}/>`;
    return poly([at(F0, R0, 0), at(F1, R1, 0), at(F1, R1, hinge), at(F0, R0, hinge)].map(M), `fill="${TH.struct}" fill-opacity=".35" stroke="${TH.edge}" stroke-width=".7"`) +
      (cs > 0 ? poly([at(F0, R0, hinge), at(F1, R1, hinge), at(F1, R1, 1), at(F0, R0, 1)].map(M), `fill="url(#hh)" stroke="${TH.ctl}" stroke-width=".8"`) : ''); };
  for (const q of def.strips) out.push(q.kind !== 'fin' ? quad(q, map.plan) : quad(q, map.side));
  for (const q of def.strips) out.push(L(map.front(n[q.fIn].p), map.front(n[q.fOut].p), q.kind === 'fin' ? TH.ctl : TH.struct, 3));
  // the members: all of them, the floats' and hulls' (their 'inner' members) in their own colour
  for (const b of def.beams) { const fl = b.vis === 'inner' && (b.cls === 'gear'); if (b.vis === 'inner' && !fl) continue; const A_ = n[b.a].p, B_ = n[b.b].p;
    for (const vk of ['side', 'plan', 'front']) out.push(L(map[vk](A_), map[vk](B_), fl ? TH.float : TH.member, fl ? 0.7 : 0.55)); }
  const mid = ix => { const a = [].concat(ix || []); if (!a.length) return null; const c = [0, 0, 0]; for (const i of a) for (let q = 0; q < 3; q++) c[q] += n[i].p[q] / a.length; return c; };
  const fd = mid(def.refs.fusDrag), fa = mid(def.refs.fusDragAft), P_ = def.params;
  const disc = (q, a) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(Math.sqrt(a / Math.PI) * k).toFixed(1)}" fill="${TH.ink}" fill-opacity=".06" stroke="${TH.ink}" stroke-width="1.1" stroke-dasharray="4 3"/>`;
  if (fd) out.push(disc(map.side(fd), P_.fusCdA[0]) + disc(map.plan(fd), P_.fusCdA[0]));
  if (fa) out.push(disc(map.side(fa), P_.fusCdAAft[1] * 0.25) + disc(map.plan(fa), P_.fusCdAAft[1] * 0.25));
  const D = (P_.prop && P_.prop.D) || 0;
  // the disc where the blades are DRAWN: the engine station (the mount's flange) moved by the editor's own measure of its hub
  // (64c genAidPropOff off CAGE_ENG, as the design aids take it; FLAGSHIP, 12 Nov: no more fixed 0.12 m). The physics'
  // strike disc still sits at the flange: a thin dashed tick there, in the side view
  const PO = C.genAidPropOff(rec.probe && rec.probe.eng);
  (S.engAt || []).forEach((e, i) => { if (!e) return; const off = PO && PO[i], ex = e.x + (off ? off[0] : 0), ey = e.y + (off ? off[1] : 0);
    out.push(L(map.side([ex, ey - D / 2, e.z]), map.side([ex, ey + D / 2, e.z]), TH.eng, 2.4) + L(map.plan([ex, ey, e.z - D / 2]), map.plan([ex, ey, e.z + D / 2]), TH.eng, 2.4));
    if (off && Math.abs(off[0]) > 0.02) out.push(L(map.side([e.x, e.y - D / 2, e.z]), map.side([e.x, e.y + D / 2, e.z]), TH.eng, 0.9, '3 3'));
    const fc = map.front([ex, ey, e.z]); out.push(`<circle cx="${fc[0].toFixed(1)}" cy="${fc[1].toFixed(1)}" r="${(D / 2 * k).toFixed(1)}" fill="none" stroke="${TH.eng}" stroke-width="1.6"/>`); });
  for (const i of [].concat(def.refs.mains || [], def.refs.tw >= 0 ? [def.refs.tw] : [])) for (const vk of ['side', 'front']) { const q = map[vk](n[i].p); out.push(`<rect x="${(q[0] - 3.5).toFixed(1)}" y="${(q[1] - 3.5).toFixed(1)}" width="7" height="7" fill="${TH.gear}" stroke="${TH.edge}" stroke-width=".6"/>`); }
  // the masses: small (a dot no bigger than 2.6 px) - the planform must stay readable
  for (const q of n) if (q.m > 0.05) for (const vk of ['side', 'plan']) { const a = map[vk](q.p); out.push(`<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="${Math.min(2.6, 0.7 + Math.sqrt(q.m) * 0.22).toFixed(1)}" fill="${TH.ink}" fill-opacity=".55"/>`); }
  const cgY = (() => { let m = 0, y = 0; for (const q of n) { m += q.m; y += q.m * q.p[1]; } return y / m; })();
  const cgM = q => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="7" fill="${TH.bg}" stroke="${TH.ink}" stroke-width="1.5"/><path d="M${q[0] - 7} ${q[1]} A7 7 0 0 1 ${q[0]} ${q[1] - 7} L${q[0]} ${q[1]} Z M${q[0] + 7} ${q[1]} A7 7 0 0 1 ${q[0]} ${q[1] + 7} L${q[0]} ${q[1]} Z" fill="${TH.ink}"/>`;
  const cgS = map.side([A.bal.cgX, cgY, 0]), npS = map.side([A.bal.npX, cgY, 0]), cgP = map.plan([A.bal.cgX, 0, 0]), npP = map.plan([A.bal.npX, 0, 0]);
  out.push(cgM(cgS) + cgM(cgP) + L([npS[0], npS[1] - 22], [npS[0], npS[1] + 22], TH.ink, 1.3, '4 3') + L([npP[0], npP[1] - 30], [npP[0], npP[1] + 30], TH.ink, 1.3, '4 3') + T(npP[0] + 4, npP[1] - 32, 'NP', { sz: 11, w: 600 }) + T(cgP[0] - 10, cgP[1] - 12, 'CG', { sz: 11, w: 600, a: 'end' }));
  A.finds.forEach((f, i) => { const q = map[f.where.view](f.where.p); out.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="13" fill="none" stroke="${TH.bad}" stroke-width="2"/><circle cx="${(q[0] + 13).toFixed(1)}" cy="${(q[1] - 13).toFixed(1)}" r="9" fill="${TH.bad}"/>` + T(q[0] + 13, q[1] - 9, String(i + 1), { sz: 11.5, w: 600, a: 'middle', c: '#fff' })); });
  // header: what it is registered on
  const reg = A.src === 'fiche' ? 'drawn: the fiche render, laid on the editor silhouette (' + ['side', 'plan', 'front'].map(v => r0(100 * V[v].share) + ' %').join(' / ') + ' of its pixels on it)' : 'drawn: the editor\'s shapes and airframe surface';
  out.push(T(40, 46, 'DIAGNOSTIC · THE DRAWN PLANE AGAINST WHAT THE SIM FLIES', { sz: 12, c: TH.faint, w: 600, ls: 1.6 }) + T(40, 72, rec.label, { sz: 22, w: 600 }) + T(1160, 46, rec.file, { sz: 11.5, c: TH.dim, a: 'end' }) +
    T(1160, 64, 'registered on the join\'s own datums (firewall, keel): exact · ' + reg, { sz: 11, c: TH.dim, a: 'end' }));
  let y = 372; const x0 = 730;
  const wrapT = (s, nmax) => { const w = s.split(' '), o = []; let a = ''; for (const x of w) { if ((a + ' ' + x).trim().length > nmax) { o.push(a.trim()); a = x; } else a += ' ' + x; } if (a.trim()) o.push(a.trim()); return o; };
  out.push(T(x0, y - 22, A.finds.length ? 'OFF BY MORE THAN 3 %' : 'NOTHING OFF BY MORE THAN 3 %', { sz: 11, c: A.finds.length ? TH.bad : TH.ok, w: 600, ls: 1.2 }));
  A.finds.forEach((f, i) => { out.push(`<circle cx="${x0 + 9}" cy="${y - 4}" r="9" fill="${TH.bad}"/>` + T(x0 + 9, y, String(i + 1), { sz: 11.5, w: 600, a: 'middle', c: '#fff' }) + T(x0 + 26, y, f.label, { sz: 14, w: 600 }) +
    T(x0 + 26, y + 18, (f.key === 'hx' ? 'drawn LE x ' : 'drawn ') + r2(f.drawn) + ' ' + f.unit + ' · flown ' + r2(f.flown) + ' ' + f.unit + ' · ' + (f.d > 0 ? '+' : '') + r0(f.d * 100) + ' %', { sz: 13, c: TH.bad })); y += 38;
    if (f.note) { for (const ln of wrapT(f.note, 62).slice(0, 2)) { out.push(T(x0 + 26, y - 2, ln, { sz: 11, c: TH.dim })); y += 13; } y += 4; } });
  y += 8; out.push(T(x0, y, 'WITHIN 3 %', { sz: 11, c: TH.ok, w: 600, ls: 1.2 })); y += 19;
  for (const f of A.meas.filter(f => Math.abs(f.d) <= 0.03)) { out.push(T(x0, y, f.label, { sz: 12.5 }) + T(1160, y, r2(f.drawn) + ' / ' + r2(f.flown) + ' ' + f.unit, { sz: 12.5, c: TH.dim, a: 'end' })); y += 18; }
  y += 14; out.push(T(x0, y, 'THE AFT BODY THE PHYSICS FLIES TODAY', { sz: 11, c: A.aft.kind === 'drawn' ? TH.ok : TH.bad, w: 600, ls: 1.2 })); y += 18;
  for (const ln of wrapT(A.aft.text, 64)) { out.push(T(x0, y, ln, { sz: 12, c: TH.ink })); y += 16; }
  if (A.aft.kind === 'twin' || A.aft.kind === 'rod') { for (const ln of wrapT('The AERO-BODY ruling (fly what is drawn) replaces it with the drawn rod, taper or pod.', 64)) { out.push(T(x0, y, ln, { sz: 11.5, c: TH.dim })); y += 15; } }
  y += 8; out.push(T(x0, y, 'CG ' + r0(A.bal.cgX * 100) + ' cm, NP ' + r0(A.bal.npX * 100) + ' cm behind the firewall · margin ' + r0(A.bal.sm * 100) + ' %', { sz: 12, c: TH.dim }));
  const ky = 866; let kx = 40;
  for (const [mark, t] of [[`<rect x="0" y="-9" width="16" height="10" fill="${TH.struct}" fill-opacity=".35" stroke="${TH.edge}"/>`, 'lifting panel'], [`<rect x="0" y="-9" width="16" height="10" fill="url(#hh)" stroke="${TH.ctl}"/>`, 'control surface'],
    [`<circle cx="8" cy="-4" r="6" fill="none" stroke="${TH.ink}" stroke-dasharray="3 2"/>`, 'body drag point'], [`<line x1="0" y1="-4" x2="16" y2="-4" stroke="${TH.eng}" stroke-width="2.4"/>`, 'propeller, where drawn'], [`<line x1="0" y1="-4" x2="16" y2="-4" stroke="${TH.eng}" stroke-width="1" stroke-dasharray="3 3"/>`, 'physics strike disc (flange)'],
    [`<rect x="4" y="-8" width="7" height="7" fill="${TH.gear}"/>`, 'ground contact'], [`<line x1="0" y1="-4" x2="16" y2="-4" stroke="${TH.float}" stroke-width="1.4"/>`, 'float / hull members'], [`<circle cx="8" cy="-4" r="2.4" fill="${TH.ink}" fill-opacity=".55"/>`, 'mass']]) {
    out.push(`<g transform="translate(${kx},${ky})">${mark}</g>` + T(kx + 22, ky, t, { sz: 12, c: TH.dim })); kx += 34 + t.length * 6.4; }
  return `<svg viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">${out.join('')}</svg>`;
}
module.exports = { analyse, draw, png, unRle };
