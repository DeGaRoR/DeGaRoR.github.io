// glint_probe.js - WHAT IS HOT IN THE FRAME, BEFORE THE TONE MAP (A2-GLINT G960, playtest 2026-09-26)
//
// A PAGE EXPRESSION, not a node script: shadowsky_shots.js evaluates it as a view's "report" (or paste it into the
// F8 console). It reads the resolve pass's target (FLYDIY_AA.target(): under `compositing: linear` the frame as
// RADIANCE, half float, MSAA-resolved - what the bloom's threshold pass reads) and returns one JSON line:
//   - exp: the renderer's exposure (applied in the blit, NOT in what the bloom reads);
//   - n / nan / inf / neg: pixels, and how many hold a NaN, an Inf or a negative value in any channel;
//   - over: how many pixels' luminance is over 1.6 (the soft bloom's threshold), 4, 16, 64, 256, 1024;
//   - ff: FIREFLIES - pixels over 1.6 AND over 6x the mean of their 8 neighbours (a lone glint, not a lit area);
//   - max, p999: the brightest luminance and the 99.9th percentile;
//   - top: the hottest (deduplicated) pixels, each raycast into the scene: the mesh, its material, the distance,
//     the flags the house generator leaves (glass / house / tarr town) - which material makes the glints.
// With window.GLINT_PROBE_N set, that many top pixels are raycast (default 16).
(async () => {
  const R = FLIGHT_PROBE.renderer(), AA = window.FLYDIY_AA, rt = AA && AA.target && AA.target();
  if (!rt) return JSON.stringify({ err: 'no resolve target (aa off and no post pass?)' });
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const W = rt.width, H = rt.height, half = rt.texture.type === THREE.HalfFloatType;
  const raw = half ? new Uint16Array(W * H * 4) : new Uint8Array(W * H * 4);
  R.readRenderTargetPixels(rt, 0, 0, W, H, raw);
  // half -> float (the IEEE 754 binary16 layout; 0x7c00 exponent = Inf / NaN)
  const h2f = h => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
    if (e === 0) return s * m * 5.960464477539063e-8; if (e === 31) return m ? NaN : s * Infinity; return s * Math.pow(2, e - 15) * (1 + m / 1024); };
  const L = new Float32Array(W * H);
  let nan = 0, inf = 0, neg = 0, max = 0;
  const TH = [1.6, 4, 16, 64, 256, 1024], over = TH.map(() => 0);
  for (let i = 0; i < W * H; i++) {
    let r, g, b;
    if (half) { r = h2f(raw[i * 4]); g = h2f(raw[i * 4 + 1]); b = h2f(raw[i * 4 + 2]); } else { r = raw[i * 4] / 255; g = raw[i * 4 + 1] / 255; b = raw[i * 4 + 2] / 255; }
    if (r !== r || g !== g || b !== b) { nan++; L[i] = -1; continue; }
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) { inf++; L[i] = 1e9; continue; }
    if (r < 0 || g < 0 || b < 0) neg++;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; L[i] = l;
    if (l > max) max = l;
    for (let k = 0; k < TH.length; k++) if (l > TH[k]) over[k]++;
  }
  let ff = 0; const hot = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, l = L[i]; if (!(l > 1.6)) continue;
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) s += Math.max(0, L[i + dy * W + dx]);
    const iso = l > 6 * (s / 8);
    if (iso) ff++;
    hot.push([l, x, y, iso ? 1 : 0]);
  }
  hot.sort((a, b) => b[0] - a[0]);
  const srt = Array.from(L).filter(v => v >= 0).sort((a, b) => a - b), p999 = srt[Math.floor(srt.length * 0.999)] || 0;
  // the hottest pixels, at least 12 px apart, raycast
  const pick = [], N = window.GLINT_PROBE_N || 16;
  for (const h of hot) { if (pick.length >= N) break; if (pick.every(p => Math.abs(p[1] - h[1]) + Math.abs(p[2] - h[2]) > 12)) pick.push(h); }
  const cam = typeof FLIGHT_PROBE.camera === 'function' ? FLIGHT_PROBE.camera() : FLIGHT_PROBE.camera;
  let root = null; for (const k in window.WORLD) { const v = window.WORLD[k]; if (v && v.isObject3D) { root = v; break; } }
  while (root && root.parent) root = root.parent;
  const rc = new THREE.Raycaster();
  const top = pick.map(([l, x, y, iso]) => {
    const px = { l: +l.toPrecision(4), x, y: H - 1 - y, iso };
    const i = (y * W + x) * 4; if (half) px.rgb = [h2f(raw[i]), h2f(raw[i + 1]), h2f(raw[i + 2])].map(v => +v.toPrecision(3));
    if (!root) return px;
    rc.setFromCamera(new THREE.Vector2((x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1), cam);
    // the fullscreen quads (the clouds' composite, the post passes') are not what the pixel shows
    const hits = rc.intersectObject(root, true).filter(h => h.object.visible !== false && h.object.material && h.distance > 0.5 && h.object.name !== 'cloudComposite' && !(h.object.material.depthTest === false));
    const h0 = hits[0]; if (!h0) { px.hit = 'sky/none'; return px; }
    const o = h0.object, m = Array.isArray(o.material) ? o.material[(h0.face && h0.face.materialIndex) || 0] : o.material, ud = (m && m.userData) || {};
    let path = o.name || o.type; for (let p = o.parent, k = 0; p && k < 3; p = p.parent, k++) if (p.name) path = p.name + '/' + path;
    px.hit = path; px.d = Math.round(h0.distance); px.at = [h0.point.x, h0.point.y, h0.point.z].map(Math.round);
    px.mat = (m.name || m.type) + (ud.hookGlass ? ' GLASS' : '') + (ud.hookHouse ? ' HOUSE' : '') + (ud.tarr || ud.tarrGlass ? ' TARR' : '') + (m.isShaderMaterial ? ' SHADER' : '');
    px.rm = [m.roughness, m.metalness, m.envMapIntensity].map(v => v === undefined ? null : +(+v).toFixed(2));
    return px;
  });
  return JSON.stringify({ W, H, exp: +R.toneMappingExposure.toFixed(3), n: W * H, nan, inf, neg, max: +max.toPrecision(4), p999: +p999.toPrecision(3), over: Object.fromEntries(TH.map((t, k) => [t, over[k]])), ff, top });
})()
