// glint_bisect.js - WHICH OBJECT MAKES THE HOT PIXELS (A2-GLINT G960) - a PAGE EXPRESSION like glint_probe.js
//
// The raycast of glint_probe names the surface under a pixel's centre; a firefly is ONE of the pixel's eight MSAA
// samples, often from another object's sliver, so the centre can lie. This walks the scene instead: it reads the
// resolve target (radiance), marks the bad pixels (luminance over window.GLINT_BAD_L, default 20, or any channel
// negative), then hides one visible subtree at a time, lets the paused game draw two frames, and counts what is
// left. A subtree whose hiding removes bad pixels is descended into (its children tried in turn), down to meshes:
// the result names the meshes (with their material's type, name and flags) that the bad pixels come from.
(async () => {
  const R = FLIGHT_PROBE.renderer(), rt = FLYDIY_AA.target();
  const W = rt.width, H = rt.height, BAD = window.GLINT_BAD_L || 20, buf = new Uint16Array(W * H * 4);
  const h2f = h => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023;
    if (e === 0) return s * m * 5.960464477539063e-8; if (e === 31) return m ? NaN : s * Infinity; return s * Math.pow(2, e - 15) * (1 + m / 1024); };
  const frames = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const bad = async () => {
    await frames(3);
    R.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    let n = 0, neg = 0, hot = 0;
    for (let i = 0; i < W * H; i++) {
      const r = h2f(buf[i * 4]), g = h2f(buf[i * 4 + 1]), b = h2f(buf[i * 4 + 2]);
      const ng = r < 0 || g < 0 || b < 0, ht = !(0.2126 * r + 0.7152 * g + 0.0722 * b < BAD);
      if (ng) neg++; if (ht) hot++; if (ng || ht) n++;
    }
    return { n, neg, hot };
  };
  let root = null; for (const k in window.WORLD) { const v = window.WORLD[k]; if (v && v.isObject3D) { root = v; break; } }
  while (root && root.parent) root = root.parent;
  const base = await bad();
  const out = { base, found: [], tried: 0 };
  if (!base.n) return JSON.stringify(out);
  const hasMesh = o => { let y = false; o.traverse(c => { if (c.isMesh || c.isPoints || c.isLine || c.isSprite) y = true; }); return y; };
  const label = o => { let p = o.name || o.type; for (let q = o.parent, k = 0; q && k < 3; q = q.parent, k++) if (q.name) p = q.name + '/' + p; return p; };
  const matOf = o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return ''; const ud = m.userData || {};
    return (m.name || m.type) + (ud.hookGlass ? ' GLASS' : '') + (ud.hookHouse ? ' HOUSE' : '') + (m.isShaderMaterial ? ' SHADER' : '') + ' r' + m.roughness + ' m' + m.metalness + ' t' + !!m.transparent + ' vc' + !!m.vertexColors; };
  // descend: try each visible child with content; a child whose hiding drops the count is a culprit - recurse into it
  async function descend(o, depth, cur) {
    const kids = o.children.filter(c => c.visible && hasMesh(c));
    if (!kids.length || depth > 9) { out.found.push({ obj: label(o), mat: matOf(o), drop: cur }); return; }
    let any = false;
    for (const c of kids) {
      if (out.tried > 400) return;
      c.visible = false; const r = await bad(); c.visible = true; out.tried++;
      const drop = base.n - r.n;
      if (drop > 0 && drop >= Math.max(1, 0.1 * cur)) { any = true; await descend(c, depth + 1, drop); }
    }
    if (!any) out.found.push({ obj: label(o) + ' (whole)', mat: matOf(o), drop: cur });
  }
  await descend(root, 0, base.n);
  out.after = await bad();
  return JSON.stringify(out);
})()
