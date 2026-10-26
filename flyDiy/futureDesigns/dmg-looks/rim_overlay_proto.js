// DMG-LOOKS stretch prototype (node only, nothing in src/ touched): THE P2 RIM OVERLAY, OPTION B (the user's ruling,
// 25 Oct) - what it draws and what it costs.
//
// The skin keeps its own program and draws as today (BASE: the paint, the torn geometry of P1b). The OVERLAY is a second
// draw over it: the SAME ridden vertices (DMG-SKINGPU's buffers), its OWN index (the rim triangles only: those with a
// place within RIM_BAND of the torn edge) and its OWN per-place attribute aRim (the edge distance e, P1b's field), a
// small program made and linked at roll-out (ground_scar.js's rule), drawn with polygon offset and alpha. Its fragment
// shader turns e + noise into the finish's bands: bare alloy, then the GREY primer (the user), then chipped paint (2024
// skin); frayed thread and the undoped band (fabric); pale fibre and a delamination line (composite); raw wood (ply).
// Where no band applies it writes nothing (alpha 0): an overlay can colour, never remove - the shape is P1b's.
//
//   node rim_overlay_proto.js   -> rim_overlay.png (rows: the four finishes; cols: base | the overlay alone | both),
//                                  rim_overlay.txt (rim triangles against the panel's)
'use strict';
const fs = require('fs'), path = require('path'), PNG = require('./png.js'), N = require('./noise.js');
const TP = require('./tear_proto.js');
const { W, H, HS } = TP;
const RIM_BAND = 0.03;           // m: a triangle with a place within this of the torn edge is in the overlay's index
const MPX = 0.002, MARGIN = 16, SEP = 0.05, PW = Math.round((W + SEP) / MPX) + 2 * MARGIN, PH = Math.round(H / MPX) + 2 * MARGIN;
const BG = [0.17, 0.18, 0.20], BLACK = [0.06, 0.06, 0.07];
const LIGHT = (() => { const l = [-0.45, 0.55, 0.70], n = Math.hypot(...l); return l.map(c => c / n); })();
// the overlay's bands: e (m, + noise) -> colour or null (alpha 0)
const BANDS = {
  alu: (e, x, y, s) => e < 0.003 ? [0.84, 0.86, 0.88] : e < 0.012 ? [0.62, 0.63, 0.64]
    : e < 0.03 && N.v2(x * 160, y * 160, s) > 0.42 + 14 * (e - 0.012) ? [0.84, 0.86, 0.88] : null,
  fabric: (e, x, y, s) => e < 0.004 ? (N.v2(x * 420, y * 50, s) > 0.45 ? [0.86, 0.83, 0.73] : [0.74, 0.71, 0.62])
    : e < 0.010 && N.v2(x * 90, y * 90, s + 1) > 0.35 + 50 * (e - 0.004) ? [0.80, 0.77, 0.68] : null,
  composite: (e, x, y, s) => e < 0.005 ? [0.78, 0.80, 0.72] : e < 0.0075 ? [0.40, 0.41, 0.38] : null,
  ply: (e, x, y, s) => e < 0.012 ? (N.v2(x * 30, y * 300, s) > 0.5 ? [0.86, 0.70, 0.46] : [0.78, 0.60, 0.38]) : e < 0.02 && N.v2(x * 120, y * 120, s) > 0.5 ? [0.66, 0.50, 0.30] : null,
};

function render(img, oy, IW, ox, prof, key, ev, M, seed, pass) {
  const { P, T, nt } = M;
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const o = ((oy + y) * IW + ox + x) * 4, c = pass === 'overlay' ? BLACK : BG; img[o] = c[0] * 255; img[o + 1] = c[1] * 255; img[o + 2] = c[2] * 255; img[o + 3] = 255; }
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= PW || y >= PH) return; const o = ((oy + y) * IW + ox + x) * 4; img[o] = Math.min(255, c[0] * 255); img[o + 1] = Math.min(255, c[1] * 255); img[o + 2] = Math.min(255, c[2] * 255); };
  const scr = v => { const dx = ev.side[v] ? SEP : 0, z = ev.off[v * 3 + 2]; return [MARGIN + (P[v * 3] + ev.off[v * 3] + dx) / MPX, MARGIN + (H - (P[v * 3 + 1] + ev.off[v * 3 + 1]) - 0.6 * z) / MPX]; };
  let rimTris = 0;
  for (let t = 0; t < nt; t++) {
    if (ev.dead[t]) continue;
    const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
    const inRim = Math.min(ev.e[a], ev.e[b], ev.e[c]) < RIM_BAND; if (inRim) rimTris++;
    if (pass === 'overlay' && !inRim) continue;
    const A = scr(a), B = scr(b), C = scr(c);
    const p = v => [P[v * 3] + ev.off[v * 3], P[v * 3 + 1] + ev.off[v * 3 + 1], ev.off[v * 3 + 2]];
    const pa = p(a), pb = p(b), pc = p(c), u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n); n = n.map(q => q / nl); if (n[2] < 0) n = n.map(q => -q);
    const lam = 0.35 + 0.65 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const x0 = Math.floor(Math.min(A[0], B[0], C[0])), x1 = Math.ceil(Math.max(A[0], B[0], C[0])), y0 = Math.floor(Math.min(A[1], B[1], C[1])), y1 = Math.ceil(Math.max(A[1], B[1], C[1]));
    const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den, l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const wx = (px - MARGIN) * MPX, wy = H - (py - MARGIN) * MPX;
      if (pass === 'base') { put(x, y, prof.paint.map(q => q * lam)); continue; }
      const e = l1 * ev.e[a] + l2 * ev.e[b] + l3 * ev.e[c] + 0.004 * N.fbm2(wx * 90, wy * 90, seed + 21, 3);
      const col = BANDS[key](Math.max(0, e), wx, wy, seed + 5);
      if (pass === 'overlay') { if (col) put(x, y, col.map(q => q * lam)); else put(x, y, [0.12, 0.12, 0.14]); }
      else put(x, y, (col || prof.paint).map(q => q * lam));
    }
  }
  return rimTris;
}

async function main() {
  const keys = ['alu', 'fabric', 'composite', 'ply'], M = TP.grid(W, H, HS), seed = 1935, gap = 10;
  const IW = 3 * PW + 2 * gap, IH = keys.length * PH + (keys.length - 1) * gap, img = new Uint8Array(IW * IH * 4);
  const lines = ['RIM OVERLAY (option B) on the 1.2 x 0.8 m test panel (' + M.nt + ' triangles, 3.5 cm): rim band ' + RIM_BAND * 100 + ' cm'];
  keys.forEach((k, i) => { const prof = TP.PROFILES[k], ev = TP.event(M, prof, seed + i + 1), oy = i * (PH + gap); let rim = 0;
    ['base', 'overlay', 'both'].forEach((pass, j) => { const r = render(img, oy, IW, j * (PW + gap), prof, k, ev, M, seed + i + 1, pass); if (j === 0) rim = r; });
    const live = ev.dead.reduce((s, d) => s + (d ? 0 : 1), 0);
    lines.push(`  ${k.padEnd(10)} rim triangles ${rim} of ${live} live (${(100 * rim / live).toFixed(1)} %) for a 0.8 m tear: ${(rim / 0.8).toFixed(0)} a metre`); });
  const tmp = path.join(__dirname, '_rim.png'); fs.writeFileSync(tmp, PNG.encode(IW, IH, img));
  // labels
  const L = 190, svgW = IW + L, svgH = IH + 64;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#1b1d21"/>`;
  svg += `<text x="12" y="24" fill="#eee" font-size="17" font-weight="bold">P2 RIM OVERLAY (option B): the skin as drawn, the overlay's own draw, both</text>`;
  ['base (the skin program, unchanged)', 'the overlay alone (rim triangles; black = alpha 0)', 'both'].forEach((c, j) => { svg += `<text x="${L + j * (PW + gap) + 4}" y="46" fill="#bbb" font-size="13">${c}</text>`; });
  ['2024-T3 skin', 'doped fabric', 'composite', 'plywood'].forEach((r, i) => { svg += `<text x="12" y="${60 + i * (PH + gap) + 20}" fill="#ddd" font-size="14">${r}</text>`; });
  svg += `<image x="${L}" y="54" width="${IW}" height="${IH}" href="data:image/png;base64,${fs.readFileSync(tmp).toString('base64')}"/></svg>`;
  const sp = path.join(__dirname, '_rim.svg'); fs.writeFileSync(sp, svg);
  try { const pw = require('playwright'); const b = await pw.chromium.launch(); const pg = await b.newPage(); await pg.setViewportSize({ width: svgW, height: svgH }); await pg.goto('file://' + sp); await pg.screenshot({ path: path.join(__dirname, 'rim_overlay.png') }); await b.close(); fs.unlinkSync(sp); fs.unlinkSync(tmp); }
  catch (e) { console.log('(no playwright)', e.message); }
  fs.writeFileSync(path.join(__dirname, 'rim_overlay.txt'), lines.join('\n') + '\n'); console.log(lines.join('\n'));
}
main();
