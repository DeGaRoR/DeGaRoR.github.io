// DMG-LOOKS stretch prototype (node only, nothing in src/ touched): THE ALLOY FRAME SLOT - CRIMPS AND THE RIVET-LINE TEAR.
//
// The member pool's slot for a metal Cessna frame member (a stringer, a former's flange, a longeron), drawn in the
// cage's own section: tools/_cage_gen.js metalAngle - two prisms, a RIVETED leg (against the skin) and an OUTSTANDING
// leg, each `w` wide and T = 5 mm thick (the cage's drawn thickness; the real sheet is ~1-1.6 mm).
//
// CRIMPS (local buckling, then progressive folding). A thin-walled section crushed axially folds in LOBES, one after
// the other, each about 2H long, H ~ (b^2 t)^(1/3) (the superfolding element's half-length: Wierzbicki & Abramowicz,
// J. Appl. Mech. 50 (1983) 727 - the form as recalled, its constant ~1 NOT verified here: a dial, H_K), with b the leg
// width and t the REAL sheet thickness; a fold eats about 0.73 x 2H of length (the effective crushing distance, as
// recalled; a dial, EFF). So the solver's lost chord picks the number of folds: n = ceil(delta / (EFF 2H)), at most 3;
// past 3 folds' worth the member also KINKS at the zone (the steel slot's hinge: two legs that keep their length).
// The lobes alternate out / in, each grows to ~H as its fold closes, the flange edges move most (inextensional:
// displacement ~ distance from the heel), the heel bulges a little.
//
// THE RIVET-LINE TEAR. A riveted flange broken in tension fails through its NET SECTION - the section through a rivet
// hole - and the crack links up hole to hole along the row before it leaves it (link-up: the NASA lap-joint tests,
// study §2.1): from the free edge into hole k, along the rivet line to hole k+1, on to the heel; the outstanding leg
// shears off on a slant. The holes on the crack are ELONGATED (bearing), the rivets stay with the piece still riveted
// to the skin; the other piece shows empty, ovalised holes. Lips curl within 5 mm of the crack; bare alloy at the crack
// and round the torn holes, grey primer elsewhere (the user, 25 Oct); the inside of the shell seen through the crack is
// the fracture face.
// The pool's own program may DISCARD (the aeroplane's one program may not: early-z): the vertex shader collapses what is
// past the crack's coarse bound, the fragment shader cuts the exact zig-zag and the holes. Row 4 shows the difference.
//
//   node alloy_proto.js  -> alloy_slot.png (labelled; Chromium for the labels), the slot's triangle counts (alloy_slot.txt)
'use strict';
const fs = require('fs'), path = require('path'), R3 = require('./raster3d.js'), N = require('./noise.js');
const OUT = __dirname;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => mul(a, 1 / (len(a) || 1));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const SEC = { w: 0.030, T: 0.005, t: 0.0012, rivetD: 0.0032, pitch: 0.022, rivetAt: 0.55 };   // rivetAt: the rivet line, x w from the heel
const H_K = 1.0, EFF = 0.73;
const H = H_K * Math.cbrt(SEC.w * SEC.w * SEC.t);                     // ~10.3 mm for w 30 mm, t 1.2 mm
const COL = { primer: [0.62, 0.63, 0.64], bare: [0.86, 0.88, 0.90], fracture: [0.55, 0.56, 0.58], inside: [0.48, 0.49, 0.50], rivet: [0.70, 0.71, 0.72] };

// the canonical cross-section: per prism a closed loop of 6 points; each point (x along the riveted leg's width, y up the
// outstanding leg) with its leg (0 riveted, 1 outstanding), its distance d from the heel, and u (the developed coordinate:
// -d on the riveted leg, +d on the outstanding one; the heel at 0)
function section() {
  const { w, T } = SEC, R = [], O = [];
  for (const [x, y] of [[0, 0], [w / 2, 0], [w, 0], [w, T], [w / 2, T], [0, T]]) R.push({ x, y, leg: 0, d: x, u: -x });
  for (const [x, y] of [[0, 0], [T, 0], [T, w / 2], [T, w], [0, w], [0, w / 2]]) O.push({ x, y, leg: 1, d: y, u: y });
  return [R, O];
}

// the rings: dense (spacing ~H/2) inside the event zone [z0, z1] (m along), 3 outside on each side
function rings(L0, z0, z1) {
  const S = new Set([0, L0]); z0 = Math.max(0, z0); z1 = Math.min(L0, z1);
  for (let i = 1; i <= 3; i++) { S.add(z0 * i / 4); S.add(z1 + (L0 - z1) * i / 4); }
  const n = Math.max(2, Math.ceil((z1 - z0) / (H / 2))); for (let i = 0; i <= n; i++) S.add(z0 + (z1 - z0) * i / n);
  return [...S].sort((a, b) => a - b);
}

// THE CRUSHED SLOT'S POSE (the vertex shader, in JS): x the station (m along, rest), p a section point; returns world pos
function crushPose(st, x, p) {
  const { L0, A, B } = st, c = len(sub(B, A)), u = nrm(sub(B, A)), Y = st.up, X = nrm([u[1] * Y[2] - u[2] * Y[1], u[2] * Y[0] - u[0] * Y[2], u[0] * Y[1] - u[1] * Y[0]]);
  const delta = Math.max(0, L0 - c), df = EFF * 2 * H, nF = Math.min(3, Math.ceil(delta / df - 1e-9)), dg = Math.max(0, delta - 3 * df);
  const centres = [st.kt1 * L0, st.kt1 * L0 + 2 * H, st.kt1 * L0 - 2 * H];
  let ax = x, lx = 0, ly = 0;
  for (let i = 0; i < nF; i++) {
    const phi = Math.max(0, Math.min(1, (delta - i * df) / df)), ci = centres[i], z = x - ci;
    ax -= phi * df * smooth(-H, H, z);                                  // the fold eats its length across its span
    if (Math.abs(z) < H) { const bump = Math.sin(Math.PI * (z + H) / (2 * H)), a = H * Math.sin(phi * Math.PI / 2) * bump * (i % 2 ? -1 : 1);
      const k = p.d / SEC.w;
      if (p.leg === 0) ly += a * (0.15 + 0.85 * k); else lx += a * (0.15 + 0.85 * k); }
  }
  // the global kink past 3 folds (dg): the zone's two sides keep their length, the hinge pushed along -Y (the open side)
  let pos = add(A, mul(u, ax * (delta > 0 ? (c + dg * 0) / (L0 - (delta - dg)) : 1)));
  if (dg > 0) { const Le = L0 - (delta - dg), a1 = st.kt1 * Le, b1 = Le - a1, cc = c, xx = (a1 * a1 - b1 * b1 + cc * cc) / (2 * cc), hh = Math.sqrt(Math.max(a1 * a1 - xx * xx, 0));
    const t = ax / Le, Hn = add(add(A, mul(u, xx)), mul(Y, -hh));
    pos = t <= st.kt1 ? add(A, mul(sub(Hn, A), t / st.kt1)) : add(Hn, mul(sub(B, Hn), (t - st.kt1) / (1 - st.kt1))); }
  return add(add(pos, mul(X, p.x + lx)), mul(Y, p.y + ly));
}
function todayPose(st, x, p, part) {
  const c = len(sub(st.B, st.A)), u = nrm(sub(st.B, st.A)), Y = st.up, X = nrm([u[1] * Y[2] - u[2] * Y[1], u[2] * Y[0] - u[0] * Y[2], u[0] * Y[1] - u[1] * Y[0]]);
  const off = part === 'B' && st.part ? st.part : [0, 0, 0];
  return add(add(add(add(st.A, mul(u, x * c / st.L0)), mul(X, p.x)), mul(Y, p.y)), off);
}

// THE TEAR: the crack's station (m) at developed coordinate u, the holes, and what a fragment is
function tearOf(st) {
  const { w, pitch, rivetD } = SEC, R = rivetD / 2 * 1.1, ur = -SEC.rivetAt * w, L0 = st.L0, rnd = N.rng(st.seed);
  const k = Math.max(1, Math.round(st.tb * L0 / pitch - 0.5)), xk = (k + 0.5) * pitch, link = rnd() < 0.7, xk1 = link ? xk + pitch : xk;
  const slant = (rnd() < 0.5 ? -1 : 1) * Math.tan(0.6);
  const cut = u => {
    if (u < ur) return xk + 0.0012 * N.fbm1(u * 300, st.seed, 3);                       // free edge -> hole k (net section)
    if (u <= 0) return xk1 + 0.0012 * N.fbm1(u * 300, st.seed + 1, 3);                    // along the row (the jump at ur), on to the heel
    return xk1 + u * slant + 0.0015 * N.fbm1(u * 250, st.seed + 2, 3);                    // the outstanding leg shears on a slant
  };
  const holes = []; for (let j = 0; (j + 0.5) * pitch < L0; j++) { const x = (j + 0.5) * pitch, onCrack = j === k || (link && j === k + 1), near = Math.abs(x - (xk + xk1) / 2) < 2.2 * pitch;
    holes.push({ x, u: ur, r: R, el: onCrack ? 1.9 : near ? 1.25 : 1, onCrack }); }
  let lo = Infinity, hi = -Infinity; for (let u = -w; u <= w; u += w / 40) { const c = cut(u); lo = Math.min(lo, c); hi = Math.max(hi, c); }
  return { cut, holes, lo: lo - 0.002, hi: hi + 0.002, xk, xk1 };
}
function tornPose(st, T, x, p, part, perVertex) {
  // the vertex shader: past the crack's coarse bound -> collapsed onto it; (geometry-only variant: onto cut(u) itself)
  const bnd = perVertex ? T.cut(p.u) : (part === 'A' ? T.hi : T.lo);
  const xs = part === 'A' ? Math.min(x, bnd) : Math.max(x, bnd);
  const dc = Math.abs(xs - T.cut(p.u)), lip = dc < 0.005 ? 0.5 * SEC.T * (1 - dc / 0.005) * (part === 'A' ? 1 : -1) : 0;
  const c = len(sub(st.B, st.A)), u = nrm(sub(st.B, st.A)), Y = st.up, X = nrm([u[1] * Y[2] - u[2] * Y[1], u[2] * Y[0] - u[0] * Y[2], u[0] * Y[1] - u[1] * Y[0]]);
  const off = part === 'B' ? st.part : [0, 0, 0];
  const nrmLeg = p.leg === 0 ? Y : X;
  return { pos: add(add(add(add(add(st.A, mul(u, xs * c / st.L0)), mul(X, p.x)), mul(Y, p.y)), mul(nrmLeg, lip)), off), xs };
}
// the fragment shader: attributes [x (station, m), u, leg-face flat (1 on a wide face of the riveted leg)]
function tornFrag(T, part, fsOn) {
  return (a, front) => {
    const [x, u, flatR] = a, c = T.cut(u);
    if (fsOn) { if (part === 'A' ? x > c : x < c) return null; }
    const d = Math.abs(x - c);
    if (fsOn && flatR > 0.5) for (const h of T.holes) {                                   // the holes (riveted leg's faces)
      const dx = (x - h.x) / (h.r * h.el), du = (u - h.u) / h.r, rr = dx * dx + du * du;
      const kept = !(h.onCrack && part === 'B') && !(h.onCrack && part === 'A' && h.x > c);
      if (rr < 1) { if (kept && !h.onCrack) return { col: COL.rivet, spec: 0.3 }; if (kept) return { col: COL.rivet, spec: 0.3 }; return null; }
      if (rr < 1.6 && h.el > 1) return { col: COL.bare, spec: 0.5 };
    }
    if (!front) return { col: COL.fracture, spec: 0.2 };
    if (d < 0.0025) return { col: COL.bare, spec: 0.5 };
    return { col: COL.primer, spec: 0.1 };
  };
}

function buildMember(st, mode, out) {
  const [R, O] = section(), loops = [R, O];
  const emit = (S, pose, attrOf, colOf, frag) => {
    for (const loop of loops) for (let i = 0; i + 1 < S.length; i++) for (let j = 0; j < loop.length; j++) {
      const p0 = loop[j], p1 = loop[(j + 1) % loop.length];
      const a = pose(S[i], p0), b = pose(S[i], p1), cc = pose(S[i + 1], p1), d = pose(S[i + 1], p0);
      const flat = (p0.leg === 0 && p1.leg === 0 && p0.y === p1.y) ? 1 : 0;      // a wide face of the riveted leg
      const at = (x, p) => [x, p.u, flat];
      const t1 = { p: [a.pos || a, cc.pos || cc, b.pos || b], col: colOf(), back: COL.inside, spec: 0.1 }, t2 = { p: [a.pos || a, d.pos || d, cc.pos || cc], col: colOf(), back: COL.inside, spec: 0.1 };
      if (frag) { t1.attr = [at(a.xs, p0), at(cc.xs, p1), at(b.xs, p1)]; t2.attr = [at(a.xs, p0), at(d.xs, p0), at(cc.xs, p1)]; t1.frag = t2.frag = frag; }
      out.push(t1, t2);
    }
    // end caps (rest-state ends only)
  };
  const L0 = st.L0;
  if (mode === 'rest') { emit(rings(L0, L0 / 2, L0 / 2), (x, p) => todayPose(Object.assign({}, st, { B: add(st.A, mul(nrm(sub(st.B, st.A)), L0)) }), x, p), null, () => COL.primer); return; }
  if (mode === 'today') {
    if (!st.broken) { emit(rings(L0, L0 / 2, L0 / 2), (x, p) => todayPose(st, x, p), null, () => COL.primer); return; }
    for (const part of ['A', 'B']) emit(part === 'A' ? rings(L0 / 2, L0 / 4, L0 / 4) : rings(L0 / 2, L0 / 4, L0 / 4).map(v => v + L0 / 2), (x, p) => todayPose(st, x, p, part), null, () => COL.primer);
    return;
  }
  if (!st.broken) {   // crushed
    const delta = Math.max(0, L0 - len(sub(st.B, st.A))), nF = Math.min(3, Math.ceil(delta / (EFF * 2 * H) - 1e-9));
    const z0 = st.kt1 * L0 - (nF >= 3 ? 3 : 1.2) * H - (nF >= 2 ? 0 : 0), z1 = st.kt1 * L0 + (nF >= 2 ? 3 : 1.2) * H;
    const S = rings(L0, z0, z1); st._rings = S.length;
    emit(S, (x, p) => crushPose(st, x, p), null, () => COL.primer); return;
  }
  const T = tearOf(st), fsOn = mode === 'vsfs', perVertex = mode === 'vsonly';
  for (const part of ['A', 'B']) {
    const S = rings(L0, T.lo - 0.01, T.hi + 0.01).filter(x => part === 'A' ? x <= T.hi + 0.0001 : x >= T.lo - 0.0001);
    if (part === 'A' && S[S.length - 1] < T.hi) S.push(T.hi); if (part === 'B' && S[0] > T.lo) S.unshift(T.lo);
    st._ringsT = (st._ringsT || 0) + S.length;
    emit(S, (x, p) => tornPose(st, T, x, p, part, perVertex), null, () => COL.primer, tornFrag(T, part, fsOn));
  }
}

// ---- the sheet ----
const BG = [0.12, 0.13, 0.15];
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function panel(W, Hh, V, fn) { const C = R3.Canvas(W, Hh, BG), tris = []; fn(tris); R3.draw(C, V, tris); return { C, n: tris.length }; }
async function main() {
  const W = 400, Hh = 220, L0 = 0.45, A = [0, 0, 0], up = [0, 1, 0];
  const V = { yaw: -0.62, pitch: 0.45, scale: 1150, ox: 205, oy: 120, cx: 0.22, cy: 0.01, cz: 0 };
  const VZ = { yaw: -0.35, pitch: 0.9, scale: 4200, ox: 200, oy: 112, cx: 0.0, cy: 0.0, cz: 0 };   // the close-up at the tear (cx set below)
  const rows = [], cells = [], counts = [];
  const tmp = []; const save = (C, n) => { const f = path.join(OUT, '_a_' + n + '.png'); R3.save(C, f); tmp.push(f); return f; };
  const df = EFF * 2 * H;
  for (const [lbl, delta] of [['crushed ' + (0.8 * df * 1000).toFixed(0) + ' mm: 1 fold', 0.8 * df], ['crushed ' + (2.8 * df * 1000).toFixed(0) + ' mm: 3 folds', 2.8 * df], ['crushed ' + ((3 * df + 0.03) * 1000).toFixed(0) + ' mm: 3 folds + a kink', 3 * df + 0.03]]) {
    const B = [L0 - delta, 0, 0], st = { L0, A, B, up, kt1: 0.5, seed: 3 };
    const r = ['rest', 'today', 'proposed'].map(m => { const P = panel(W, Hh, V, t => buildMember(Object.assign({}, st), m, t)); if (m === 'proposed') counts.push([lbl, P.n]); return save(P.C, lbl.replace(/\W+/g, '_') + m); });
    cells.push(r); rows.push([lbl, 'set < 0 (the chord the solver lost)', 'H = ' + (H * 1000).toFixed(1) + ' mm, a fold eats ' + (df * 1000).toFixed(0) + ' mm']);
  }
  const stT = { L0, A, B: [L0, 0, 0], up, tb: 0.5, seed: 11, broken: true, part: [0.018, -0.006, 0.008] };
  const T0 = tearOf(stT);
  const rT = [['today', 'today'], ['vsonly', 'vsonly'], ['vsfs', 'vsfs']].map(([m]) => { const P = panel(W, Hh, V, t => buildMember(Object.assign({}, stT), m, t)); if (m === 'vsfs') counts.push(['torn (two pieces)', P.n]); return save(P.C, 'tear_' + m); });
  cells.push(rT); rows.push(['torn at its rivet line', "'tension', 'kink' past, a fitting", 'cols: today | vertex only | + fragment']);
  const VZ2 = Object.assign({}, VZ, { cx: T0.xk + 0.01 });
  const rZ = ['today', 'vsonly', 'vsfs'].map(m => save(panel(W, Hh, VZ2, t => buildMember(Object.assign({}, stT), m, t)).C, 'tearz_' + m));
  cells.push(rZ); rows.push(['the same, close up', 'from above the riveted leg', 'holes elongated, rivets kept on A']);
  // labels
  const cols = ['rest / today', 'today (as drawn now) / vertex only', 'proposed (the pool slot) / + fragment'];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${3 * (W + 10) + 200}" height="${54 + rows.length * (Hh + 22) + 30}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#1b1d21"/>`;
  svg += `<text x="12" y="26" fill="#eee" font-size="18" font-weight="bold">${esc('ALLOY FRAME SLOT (the metal Cessna): progressive crimps, then a kink; the tear through the rivet line')}</text>`;
  ['rest', 'today (as drawn now)', 'proposed (the pool slot)'].forEach((c, i) => { svg += `<text x="${200 + i * (W + 10) + 6}" y="48" fill="#bbb" font-size="14">${esc(c)}</text>`; });
  rows.forEach((r, j) => { const y = 56 + j * (Hh + 22); svg += `<text x="12" y="${y + 20}" fill="#ddd" font-size="13">${esc(r[0])}</text><text x="12" y="${y + 38}" fill="#999" font-size="11">${esc(r[1])}</text><text x="12" y="${y + 54}" fill="#999" font-size="11">${esc(r[2])}</text>`;
    cells[j].forEach((f, i) => { svg += `<image x="${200 + i * (W + 10)}" y="${y}" width="${W}" height="${Hh}" href="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"/>`; }); });
  svg += `<text x="12" y="${56 + rows.length * (Hh + 22) + 14}" fill="#888" font-size="11">${esc('Rows 4-5 columns: today (a flat cut at mid-span) | the vertex shader alone (the crack at the vertices: a staircase) | + the fragment pass (the exact zig-zag, the holes; the pool program may discard). Grey primer, bare alloy at the crack. Section as the cage draws it (w 30 mm, T 5 mm).')}</text></svg>`;
  const sp = path.join(OUT, '_alloy_slot.svg'); fs.writeFileSync(sp, svg);
  try { const pw = require('playwright'); const b = await pw.chromium.launch(); const pg = await b.newPage(); await pg.setViewportSize({ width: 3 * (W + 10) + 200, height: 56 + rows.length * (Hh + 22) + 30 }); await pg.goto('file://' + sp); await pg.screenshot({ path: path.join(OUT, 'alloy_slot.png') }); await b.close(); fs.unlinkSync(sp); }
  catch (e) { console.log('(no playwright: left as SVG)', e.message); }
  for (const f of tmp) fs.unlinkSync(f);
  // counts: the slot's triangles (as drawn), its rings
  const lines = ['ALLOY SLOT (cage section: 2 prisms x 6-point loops = 12 quads a ring segment = 24 triangles)', 'H = ' + (H * 1000).toFixed(1) + ' mm (H_K ' + H_K + '), a fold eats ' + (df * 1000).toFixed(1) + ' mm (EFF ' + EFF + ')'];
  for (const [l, n] of counts) lines.push(`  ${l.padEnd(34)} ${n} triangles`);
  lines.push('  fragment pass (torn slots only): the crack cut(u) - 3 branches + one 3-octave noise - and the holes within 2.2 pitches (~5 tests)');
  fs.writeFileSync(path.join(OUT, 'alloy_slot.txt'), lines.join('\n') + '\n'); console.log(lines.join('\n'));
}
main();
