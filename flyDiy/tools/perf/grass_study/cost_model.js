// THE GRASS COST MODEL (G2550): today's cover-ring reed vs the proposed tuft field, per preset and view.
// Counts only - submitted triangles (vertex work), live instances, card pixels (fragment invocations incl. the
// transparent texels the mask discards), opaque pixels, draws. Geometry measured off the shipped bin (reed_geo.js, tufts.js).
const U = 1;   // units of the patch geometry; scale s turns units into metres
const PATCH = { tris: (1157 + 517 + 236) / 3, side: (203083 + 86428 + 36302) / 3, top: 125.3 };   // side: mean of X/Z projected card area (u2)
const TUFT = { tris: 42.4, side: 7240, top: 103.8 };   // K = 3 cards (tufts.js)
const C = 0.0722;                                    // the mask's kept share of card area (reed_alpha.py: 2.03/16.0 ... ~12 %; side-weighted 0.072-0.125)
const KEEP_ALPHA = 0.12, DMIN = +(process.env.DMIN || 3);
const vfov = 46 * Math.PI / 180, aspect = 16 / 9;
const smooth = (lo, hi, v) => { const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))); return t * t * (3 - 2 * t); };
// cfg: { kind: 'patch'|'tuft', rho (instances/m2 planted, after blotch), s (scale u->m), near, reach, taper, aglFull, aglOff,
//        cell, B (cells/block), trunc (count truncation), band }
function frame(cfg, view, seed) {
  const H = 1080 * view.scale, W = H * aspect, f = H / (2 * Math.tan(vfov / 2));
  const G = cfg.kind === 'patch' ? PATCH : TUFT;
  let rnd = seed * 9301 + 49297; const R = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
  const ex = R() * cfg.cell * cfg.B, ez = R() * cfg.cell * cfg.B, ey = view.h, yaw = R() * Math.PI * 2, pitch = view.pitch * Math.PI / 180;
  const fwd = [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
  const right = [-Math.sin(yaw), 0, Math.cos(yaw)];
  const up = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]].map(v => -v);
  const th = Math.tan(vfov / 2), tw = th * aspect;
  const proj = (x, y, z) => { const d = [x - ex, y - ey, z - ez]; const zc = d[0]*fwd[0]+d[1]*fwd[1]+d[2]*fwd[2]; if (zc < 0.5) return null;
    const xc = d[0]*right[0]+d[2]*right[2], yc = d[0]*up[0]+d[1]*up[1]+d[2]*up[2]; return [xc / zc, yc / zc, zc]; };
  const inF = p => p && Math.abs(p[0]) <= tw && Math.abs(p[1]) <= th;
  const aglK = 1 - smooth(cfg.aglFull, cfg.aglOff, ey);
  const keep = d => Math.pow(1 - Math.max(0, Math.min(1, (d - cfg.near) / Math.max(1, cfg.reach - cfg.near))), 1 + 2 * cfg.taper) * aglK;
  const C_ = cfg.cell, BS = C_ * cfg.B, Rpl = cfg.reach + C_;
  let tris = 0, live = 0, px = 0, draws = 0;
  if (aglK > 0.001) {
    const nb = Math.ceil((Rpl + BS) / BS) + 1;
    for (let bj = -nb; bj <= nb; bj++) for (let bi = -nb; bi <= nb; bi++) {
      const bx0 = (Math.floor(ex / BS) + bi) * BS, bz0 = (Math.floor(ez / BS) + bj) * BS;
      // planted cells of this block
      let nInst = 0;
      for (let cj = 0; cj < cfg.B; cj++) for (let ci = 0; ci < cfg.B; ci++) { const cx = bx0 + (ci + 0.5) * C_, cz = bz0 + (cj + 0.5) * C_;
        if ((cx - ex) ** 2 + (cz - ez) ** 2 <= Rpl * Rpl) nInst += cfg.rho * C_ * C_; }
      if (!nInst) continue;
      const dx = Math.max(bx0 - ex, 0, ex - bx0 - BS), dz = Math.max(bz0 - ez, 0, ez - bz0 - BS), dmin = Math.hypot(dx, ey, dz);
      if (dmin >= cfg.reach) continue;                           // the ring's reach test (3-D, nearest point)
      // frustum test of the block's sphere (approximate: any of 25 sample points in view, or the eye inside)
      let vis = dx === 0 && dz === 0;
      for (let k = 0; k <= 4 && !vis; k++) for (let l = 0; l <= 4 && !vis; l++) for (const yy of [0, 1]) if (inF(proj(bx0 + BS * k / 4, yy, bz0 + BS * l / 4))) { vis = true; break; }
      if (!vis) continue;
      const kmax = Math.min(1, keep(dmin) * (1 + cfg.band));
      const sub = cfg.trunc ? nInst * kmax : nInst;
      tris += sub * G.tris; draws += cfg.draws;
    }
    // pixels: integrate the ground in a polar grid around the eye
    const NR = 220, NA = 360;
    for (let ir = 0; ir < NR; ir++) {
      const r0 = Math.pow(ir / NR, 2) * cfg.reach, r1 = Math.pow((ir + 1) / NR, 2) * cfg.reach, r = (r0 + r1) / 2, dA = Math.PI * (r1 * r1 - r0 * r0) / NA;
      for (let ia = 0; ia < NA; ia++) {
        const a = (ia + 0.5) / NA * Math.PI * 2, x = ex + r * Math.cos(a), z = ez + r * Math.sin(a);
        const hM = G.top * cfg.s * 0.5;
        const p = proj(x, hM, z); if (!inF(p)) continue;
        const d = Math.max(1.0, Math.hypot(r, ey - hM)), k = keep(d); if (k <= 0 || r < DMIN) continue;
        const n = cfg.rho * dA * k; live += n;
        const cosb = Math.hypot(r, 0) / Math.hypot(r, ey - hM);      // a vertical card seen from above is foreshortened
        const sideM2 = G.side * cfg.s * cfg.s;
        const pxi = Math.min(sideM2 * cosb * (f / d) ** 2, W * H);   // a card can not cover more than the screen
        px += n * pxi;
      }
    }
  }
  return { tris, live, px, draws, W, H };
}
function avg(cfg, view) { const o = { tris: 0, live: 0, px: 0, draws: 0 }; const N = 24; let W, H;
  for (let s = 1; s <= N; s++) { const r = frame(cfg, view, s); for (const k in o) o[k] += r[k] / N; W = r.W; H = r.H; }
  o.over = o.px / (W * H); o.opaque = o.px * KEEP_ALPHA / (W * H); return o; }
module.exports = { avg, PATCH, TUFT };
if (require.main === module) {
  const VIEWS = { stand: { h: 1.7, pitch: -4 }, taxi: { h: 1.7, pitch: -2 }, agl10: { h: 10, pitch: -6 }, agl30: { h: 30, pitch: -8 }, agl60: { h: 60, pitch: -8 }, agl150: { h: 150, pitch: -8 } };
  const BLOTCH = 0.55, LAND = +(process.env.LAND || 0.62);
  const today = (density, reach, scale, sz) => ({ kind: 'patch', rho: 0.48 * density * BLOTCH * LAND, s: 0.012 * sz, near: 50, reach, taper: 0.5, aglFull: 60, aglOff: 150, cell: 32, B: 4, trunc: false, band: 0.25, draws: 3, scale });
  const CFG = JSON.parse(process.env.CFG || 'null');
  const rows = CFG ? CFG : {
    'today gamer/current (full)': today(2, 220, 1, 0.75),
    'today retro (lean)': today(1, 120, 0.85, 0.75),
    'today retro (lean) + trunc': Object.assign(today(1, 120, 0.85, 0.75), { trunc: true }),
    'today gamer + trunc': Object.assign(today(2, 220, 1, 0.75), { trunc: true }),
  };
  for (const [name, cfg] of Object.entries(rows)) {
    console.log('== ' + name);
    for (const [vn, v] of Object.entries(VIEWS)) { const o = avg(cfg, Object.assign({ scale: cfg.scale }, v));
      console.log(`  ${vn.padEnd(7)} tris ${(o.tris / 1e6).toFixed(2)} M | draws ${o.draws.toFixed(0)} | live ${(o.live / 1e3).toFixed(1)} k | card px ${(o.px / 1e6).toFixed(2)} M (overdraw ${o.over.toFixed(2)}) | opaque ${(o.opaque * 100).toFixed(1)} % of screen`); }
  }
}
