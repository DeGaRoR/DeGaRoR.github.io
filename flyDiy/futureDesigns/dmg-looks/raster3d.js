// A tiny z-buffered triangle rasteriser for the DMG-LOOKS structure pictures (node only, no dependency).
// Orthographic camera (yaw, pitch), lambert + a little specular, per-triangle colour, optional double-sided back colour.
'use strict';
const PNG = require('./png.js');
function Canvas(w, h, bg) {
  const img = new Uint8Array(w * h * 4), z = new Float32Array(w * h).fill(Infinity);
  for (let i = 0; i < w * h; i++) { img[i * 4] = bg[0] * 255; img[i * 4 + 1] = bg[1] * 255; img[i * 4 + 2] = bg[2] * 255; img[i * 4 + 3] = 255; }
  return { w, h, img, z };
}
// view: { yaw, pitch, scale (px per m), ox, oy (px), cx, cy, cz (m: the point at ox, oy) }
function project(V, p) {
  const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw), cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
  const x = p[0] - V.cx, y = p[1] - V.cy, z = p[2] - V.cz;
  const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;           // yaw about y (up)
  const y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;           // pitch about x
  return [V.ox + x1 * V.scale, V.oy - y2 * V.scale, -z2];   // depth: the viewer is at +z2 (x right, y up), smaller = nearer
}
const LIGHT = (() => { const l = [-0.35, 0.75, 0.55], n = Math.hypot(...l); return l.map(c => c / n); })();
// tri: { p: [[x,y,z]x3], col: [r,g,b], back: [r,g,b] | null (null: back faces drawn with col), spec }
function draw(C, V, tris) {
  const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw), cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
  const viewDir = [-sy * cp, sp, cy * cp];                     // towards the viewer, world space
  for (const t of tris) {
    const A = project(V, t.p[0]), B = project(V, t.p[1]), Cc = project(V, t.p[2]);
    const u = [t.p[1][0] - t.p[0][0], t.p[1][1] - t.p[0][1], t.p[1][2] - t.p[0][2]], w = [t.p[2][0] - t.p[0][0], t.p[2][1] - t.p[0][1], t.p[2][2] - t.p[0][2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n); if (nl < 1e-14) continue; n = n.map(q => q / nl);
    const den = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]); if (Math.abs(den) < 1e-9) continue;
    // facing: the winding's normal in view space (the viewer is at +z2)
    const nz2 = sp * n[1] + cp * (-sy * n[0] + cy * n[2]);
    const front = (nz2 > 0) !== !!V.flip;
    let col = t.col; if (!front) { if (t.back) col = t.back; }
    if (nz2 < 0) n = n.map(q => -q);                             // light the side we see
    const lam = 0.32 + 0.68 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const h = [LIGHT[0] + viewDir[0], LIGHT[1] + viewDir[1], LIGHT[2] + viewDir[2]], hl = Math.hypot(...h);
    const spec = (t.spec || 0) * Math.pow(Math.max(0, (n[0] * h[0] + n[1] * h[1] + n[2] * h[2]) / hl), 24);
    const c = col.map(q => Math.min(1, q * lam + spec));
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], Cc[0]))), x1 = Math.min(C.w - 1, Math.ceil(Math.max(A[0], B[0], Cc[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], Cc[1]))), y1 = Math.min(C.h - 1, Math.ceil(Math.max(A[1], B[1], Cc[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, l1 = ((B[1] - Cc[1]) * (px - Cc[0]) + (Cc[0] - B[0]) * (py - Cc[1])) / den, l2 = ((Cc[1] - A[1]) * (px - Cc[0]) + (A[0] - Cc[0]) * (py - Cc[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const zz = l1 * A[2] + l2 * B[2] + l3 * Cc[2], o = y * C.w + x;
      if (zz >= C.z[o]) continue; C.z[o] = zz;
      C.img[o * 4] = c[0] * 255; C.img[o * 4 + 1] = c[1] * 255; C.img[o * 4 + 2] = c[2] * 255;
    }
  }
}
// a filled disc on top (rivet heads, node balls), in screen space
function dot(C, V, p, rpx, col) { const P = project(V, p);
  for (let y = Math.floor(P[1] - rpx); y <= P[1] + rpx; y++) for (let x = Math.floor(P[0] - rpx); x <= P[0] + rpx; x++) {
    if (x < 0 || y < 0 || x >= C.w || y >= C.h) continue; if ((x + 0.5 - P[0]) ** 2 + (y + 0.5 - P[1]) ** 2 > rpx * rpx) continue;
    const o = y * C.w + x; C.img[o * 4] = col[0] * 255; C.img[o * 4 + 1] = col[1] * 255; C.img[o * 4 + 2] = col[2] * 255; } }
function save(C, file) { require('fs').writeFileSync(file, PNG.encode(C.w, C.h, C.img)); }
module.exports = { Canvas, draw, dot, save, project };
