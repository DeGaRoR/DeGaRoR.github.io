// dt_sheet.js - THE PROJECTION ON THE DRAWING, ONE IMPLEMENTATION (QUICKSHOT-ONE, 15 Nov 2026; A0's call: the Drafting
// Table's sheet logic, hosted by quickshot). quickshot.js --sheet and table.js check --png both end here; the in-game page
// (flyDiy/drafting.html) maps its views with the same dt_core toPx / fromPx (quarter turns, the free tilt, the two scales).
//
//   const SH = require('./dt_sheet.js');
//   SH.compose({ ref, B, sheet, renders, title, T, dims }) -> { W, H, rgba, views: { side: {x0, y0, W, H} ... } }
//     ref      the plane's reference block (ref.views: box, ox, oy, k, ky, rot, rotAt, flip; ref.marks)
//     B        { tris, parts } in the TABLE FRAME (dt_build's: a aft of the spinner's tip, h above the thrust line, s
//              starboard), the parts the table colours and measures
//     sheet    the drawing, decoded ({ W, H, rgba }: dt_png.decode) or null (then white paper, no veil)
//     renders  { view: { rgb, mask } } our shaded render in the view's own box pixels (quickshot draws it through
//              SH.viewProjector), or null
//     T        dt_core.compare's table (the key measurements); dims: SH.dims(ref, B)
//   Per view, top to bottom side / top / front: the drawing faded, our render over it, THE RED VEIL where our parts
//   fall outside the drawing's lines (the paper reached from the box's edge without crossing ink: photo_match's
//   ovls_threeview.py idea, measured on the sheet), our outline in the parts' colours (dt_core.edges), the drawing's
//   marks; then the score table and the dimensions diff (outline.js's), in the soft canvas's stand-in face.
'use strict';
const C = require('./dt_core.js');
const CS = require('../_canvas_soft.js');

// a view's projector: table frame (a, h, s) -> [x, y] in the view box's pixels (x right, y down) + depth (bigger =
// nearer the eye), through dt_core's own proj + toPx - the one mapping
function viewProjector(V, view) {
  const [x0, y0] = V.box;
  return (a, h, s) => { const q = C.proj(view, a, h, s), p = C.toPx(V, q[0], q[1]); return [p[0] - x0, p[1] - y0, q[2]]; };
}
// the drawing's paper OUTSIDE its lines in a box: ink (grey < 170, grown a pixel so a hairline gap does not leak), then
// a flood from the box's edge over the paper
function outsideOf(sheet, box) {
  const [x0, y0, x1, y1] = box.map(Math.round), W = x1 - x0, H = y1 - y0, ink = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = x0 + x, sy = y0 + y; if (sx < 0 || sy < 0 || sx >= sheet.W || sy >= sheet.H) continue;
    const i = (sy * sheet.W + sx) * 4, g = sheet.rgba[i + 3] ? (sheet.rgba[i] + sheet.rgba[i + 1] + sheet.rgba[i + 2]) / 3 : 255;
    if (g < 170) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) ink[Y * W + X] = 1; }
  }
  const st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const i = st.pop(); if (out[i] || ink[i]) continue; out[i] = 1; const x = i % W, y = (i - x) / W;
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W); }
  return out;
}
const hexRGB = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

// OUTLINE.JS'S DIMENSIONS DIFF: the build's overall extents (table frame) against the reference's published figures
function dims(ref, B) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < B.tris.length; i += 3) for (let k = 0; k < 3; k++) { const v = B.tris[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  const ours = { length: hi[0] - lo[0], height: hi[1] - lo[1], span: hi[2] - lo[2] };
  return ['length', 'span', 'height'].map(k => { const f = C.figValue(ref || {}, 'geometry.' + k);
    return { k, ours: ours[k], ref: f, diff: f != null ? ours[k] - f : null, pct: f ? (ours[k] - f) / f * 100 : null }; });
}
const f3 = v => v == null ? '-' : (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3));
function tableLines(T, D, title) {
  const L = [];
  if (title) L.push(title);
  if (D) { L.push('DIMENSIONS (OURS / FIGURE)');
    for (const d of D) L.push(d.k.toUpperCase().padEnd(8) + f3(d.ours).padStart(8) + ' / ' + f3(d.ref).padStart(7) + (d.diff != null ? '  ' + (d.diff >= 0 ? '+' : '') + d.diff.toFixed(3) + ' M ' + (d.pct >= 0 ? '+' : '') + d.pct.toFixed(1) + '%' : '')); }
  if (T) { L.push(''); L.push('KEY MEASUREMENTS ' + T.pass + ' / ' + T.n + ' INSIDE TOLERANCE');
    for (const r of T.rows) L.push((r.ok == null ? ' ' : r.ok ? '+' : 'X') + ' ' + String(r.label).slice(0, 30).padEnd(30) + f3(r.ours).padStart(8) + f3(r.ref).padStart(8) +
      (r.diff == null ? '' : ((r.diff >= 0 ? '+' : '') + f3(r.diff)).padStart(8))); }
  return L;
}

function compose(o) {
  const ref = o.ref, B = o.B, sheet = o.sheet, renders = o.renders || {};
  const panels = [];
  for (const view of C.VIEWS) {
    const V = ref.views && ref.views[view]; if (!V || !V.box) continue;
    const [x0, y0, x1, y1] = V.box.map(Math.round), W = x1 - x0, H = y1 - y0;
    const img = new Uint8ClampedArray(W * H * 4);
    // the drawing, faded (the table's own fade)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o4 = (y * W + x) * 4; let g = 255;
      if (sheet) { const sx = x0 + x, sy = y0 + y;
        if (sx >= 0 && sy >= 0 && sx < sheet.W && sy < sheet.H) { const si = (sy * sheet.W + sx) * 4; g = sheet.rgba[si + 3] ? (sheet.rgba[si] + sheet.rgba[si + 1] + sheet.rgba[si + 2]) / 3 : 255; } }
      const v = 255 - (255 - g) * 0.45; img[o4] = img[o4 + 1] = img[o4 + 2] = v; img[o4 + 3] = 255;
    }
    // our render over it, half and half, the drawing's ink kept on top
    const R = renders[view];
    if (R) for (let i = 0; i < W * H; i++) if (R.mask[i]) {
      const o4 = i * 4, ink = img[o4] < 200;
      for (let k = 0; k < 3; k++) img[o4 + k] = ink ? img[o4 + k] * 0.55 : img[o4 + k] * 0.4 + R.rgb[i * 3 + k] * 0.6;
    }
    // the parts as the table measures them (dt_core.raster, front-most part a pixel), the veil and the outline
    const id = C.raster(view, B.tris, B.parts, V, W, H, x0, y0), E = C.edges(id, W, H);
    const out = sheet ? outsideOf(sheet, V.box) : null;
    let veil = 0;
    if (out) for (let i = 0; i < W * H; i++) if (id[i] && C.PARTS[id[i]] !== 'inside' && out[i]) {
      const o4 = i * 4; img[o4] = img[o4] * 0.45 + 255 * 0.55; img[o4 + 1] = img[o4 + 1] * 0.45 + 40 * 0.55; img[o4 + 2] = img[o4 + 2] * 0.45 + 40 * 0.55; veil++;
    }
    for (let i = 0; i < W * H; i++) { const e = E[i]; if (!e) continue; const c = hexRGB(C.COLOURS[C.PARTS[e]] || '#000000'), o4 = i * 4; img[o4] = c[0]; img[o4 + 1] = c[1]; img[o4 + 2] = c[2]; }
    for (const k of Object.keys(ref.marks || {})) {
      const m = ref.marks[k]; if (m.view !== view || !m.pts) continue;
      for (const p of m.pts) for (let d = -3; d <= 3; d++) for (const [dx, dy] of [[d, 0], [0, d]]) {
        const x = Math.round(p[0] - x0 + dx), y = Math.round(p[1] - y0 + dy);
        if (x < 0 || y < 0 || x >= W || y >= H) continue; const o4 = (y * W + x) * 4; img[o4] = img[o4 + 1] = img[o4 + 2] = 0;
      }
    }
    const cv = CS.canvas(W, H); cv.data.set(img);
    const g = cv.getContext('2d'); g.font = '20px mono'; g.textBaseline = 'top';
    g.fillStyle = '#ffffff'; g.fillRect(4, 4, 15 * 14 + 10, 22);
    g.fillStyle = '#b01818'; g.fillText(view.toUpperCase() + (veil ? ' VEIL ' + (veil / (V.k * (V.ky || V.k))).toFixed(2) + ' M2' : ''), 8, 8);
    panels.push({ view, W, H, data: cv.data, veilM2: veil / (V.k * (V.ky || V.k)) });
  }
  // the table and the dimensions, two columns of the stand-in face
  const lines = tableLines(o.T, o.dims, o.title), per = Math.ceil(lines.length / 2), CH = 18, CWch = 14;
  const colW = Math.max(...lines.map(l => l.length), 10) * CWch + 30;
  const TW = 2 * colW, TH = per * CH + 20;
  const W = Math.max(TW, ...panels.map(p => p.W)), H = panels.reduce((s, p) => s + p.H, 0) + TH;
  const cv = CS.canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  let y = 0; const boxes = {};
  for (const p of panels) {
    const d = cv.data;
    for (let r = 0; r < p.H; r++) d.set(p.data.subarray(r * p.W * 4, (r + 1) * p.W * 4), ((y + r) * W) * 4);
    boxes[p.view] = { x0: 0, y0: y, W: p.W, H: p.H, veilM2: +p.veilM2.toFixed(3) }; y += p.H;
  }
  g.font = '20px mono'; g.textBaseline = 'top'; g.fillStyle = '#10141a';
  lines.forEach((l, i) => { const c = i < per ? 0 : 1, r = i % per; g.fillStyle = /^X /.test(l) ? '#b01818' : '#10141a'; g.fillText(l, 10 + c * colW, y + 10 + r * CH); });
  return { W, H, rgba: Buffer.from(cv.data.buffer, cv.data.byteOffset, cv.data.byteLength), views: boxes, lines };
}

module.exports = { compose, viewProjector, outsideOf, dims, tableLines };
