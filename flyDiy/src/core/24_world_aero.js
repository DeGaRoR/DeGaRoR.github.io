// ============================================================
// WORLD AERODROMES — WORLD-GEN-PROC stage 4 (the point of the exercise).
// A main field per sizeable settlement (candidate ring x 8 headings,
// scored on centreline flatness + cross-clearance + road proximity;
// length/width/surface by town size, >=900 m is paved) and backcountry
// strips on high benches (flat probe, fly-in flagged). Each strip emits
// an oriented grading SDF (the home runway carve, parameterized), a
// surface patch, a tree-exclusion box and a registry record with
// heading + touchdown zone for the future AP integration.
// Deterministic: fixed iteration orders, hash jitter only.
// ============================================================
function bakeAerodromes(D) {
  // D: { terrain(x,z), water(x,z), settlements, meadows, roadNear, SURFACE, salt }
  const t0 = Date.now();
  const { terrain, water, settlements, meadows, roadNear, SURFACE, salt } = D;
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const hash2 = (ix, iz) => {
    let h = (ix * 786433 + iz * 393241 + 65213 + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const strips = [];

  // centreline + shoulder probe: flatness, slope, wetness around a candidate
  function probe(cx, cz, hdg, len, wid) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const K = 11, hs = [];
    let sum = 0;
    for (let i = 0; i < K; i++) {
      const t = (i / (K - 1) - 0.5) * len;
      const h = terrain(cx + dx * t, cz + dz * t);
      hs.push(h); sum += h;
    }
    const elev = sum / K;
    let flat = 0, slopeMax = 0, wet = false;
    for (let i = 0; i < K; i++) {
      flat = Math.max(flat, Math.abs(hs[i] - elev));
      if (i) slopeMax = Math.max(slopeMax, Math.abs(hs[i] - hs[i - 1]) / (len / (K - 1)));
      const t = (i / (K - 1) - 0.5) * len;
      const px = cx + dx * t, pz = cz + dz * t;
      if (hs[i] < 1.2 || water(px, pz) > hs[i]) wet = true;
      for (const s of [-1, 1]) {
        const qx = px - dz * s * wid, qz = pz + dx * s * wid;
        const qh = terrain(qx, qz);
        if (qh < 1.2 || water(qx, qz) > qh) wet = true;
      }
    }
    return { flat, slopeMax, elev, wet };
  }
  const nearMeadow = (x, z, f) => meadows.some(m => Math.hypot(x - m.x, z - m.z) < m.r * f);
  const inHomeZone = (x, z) =>
    (x > -3400 && x < 400 && Math.abs(z) < 500) ||     // circuit band
    (x > -1900 && x < 900 && Math.abs(z) < 900);       // pad + generous margin
  const farFromStrips = (x, z, d) => strips.every(st => Math.hypot(x - st.x, z - st.z) >= d);

  function push(cx, cz, hdg, len, wid, surf, elev, name, kind, flyIn) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const feather = 90 + len * 0.1;
    const ex = Math.abs(dx) * len / 2 + Math.abs(dz) * wid / 2 + feather;
    const ez = Math.abs(dz) * len / 2 + Math.abs(dx) * wid / 2 + feather;
    strips.push({
      id: 'A' + strips.length, name, kind, x: cx, z: cz, hdg, len, wid,
      surface: surf, elev, tdz: [cx - dx * len * 0.25, cz - dz * len * 0.25],
      flyIn: !!flyIn,
      dx, dz, feather, bx0: cx - ex, bx1: cx + ex, bz0: cz - ez, bz1: cz + ez,
    });
  }

  // ---- main field per settlement above the pop threshold ----
  for (let si = 0; si < settlements.length; si++) {
    const s = settlements[si];
    if (s.kind === 'home' || s.pop < 250) continue;
    const len = s.pop >= 800 ? 900 : s.pop >= 450 ? 650 : 480;
    const wid = len >= 900 ? 30 : 22;
    const surf = len >= 900 ? SURFACE.PAVED : SURFACE.GRASS;
    let best = null;
    const r0 = Math.max(320, s.r + 160);
    for (let ri = 0; ri < 3; ri++) for (let ai = 0; ai < 12; ai++) {
      const ang = (ai / 12) * 2 * Math.PI + hash2(si * 37 + ri, ai) * 0.2;
      const cx = s.x + Math.cos(ang) * (r0 + ri * 280);
      const cz = s.z + Math.sin(ang) * (r0 + ri * 280);
      if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8) || !farFromStrips(cx, cz, 1500)) continue;
      if (roadNear(cx, cz) > 1100) continue;   // town fields must be road-reachable
      for (let hi = 0; hi < 8; hi++) {
        const hdg = hi * Math.PI / 8;
        const p = probe(cx, cz, hdg, len, wid);
        if (p.wet || p.flat > 6 || p.slopeMax > 0.06) continue;
        const cost = p.flat + p.slopeMax * 60 + Math.min(2, roadNear(cx, cz) / 600);
        if (!best || cost < best.cost) best = { cx, cz, hdg, cost, elev: p.elev };
      }
    }
    if (best)
      push(best.cx, best.cz, best.hdg, len, wid, surf, best.elev,
           s.name + (len >= 900 ? ' Airfield' : ' Field'), 'main', false);
  }

  // ---- backcountry strips: high benches, fly-in only ----
  {
    const cand = [];
    for (let gx = -11; gx <= 11; gx++) for (let gz = -11; gz <= 11; gz++) {
      for (let j = 0; j < 3; j++) {
        const cx = gx * 1000 + (hash2(gx + 900 + j * 131, gz) - 0.5) * 800;
        const cz = gz * 1000 + (hash2(gx, gz + 900 + j * 131) - 0.5) * 800;
        const h = terrain(cx, cz);
        if (h < 90 || h > 420) continue;
        if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8)) continue;
        if (settlements.some(s => Math.hypot(cx - s.x, cz - s.z) < 1800)) continue;
        let bestH = null;
        for (let hi = 0; hi < 8; hi++) {
          const hdg = hi * Math.PI / 8;
          const p = probe(cx, cz, hdg, 340, 18);
          if (p.wet || p.flat > 5 || p.slopeMax > 0.05) continue;
          if (!bestH || p.flat < bestH.flat) bestH = { hdg, flat: p.flat, elev: p.elev };
        }
        if (bestH) cand.push({ cx, cz, ...bestH });
      }
    }
    cand.sort((a, b) => (a.flat - b.flat) || (a.cx - b.cx) || (a.cz - b.cz));
    const SYL = ['Kar', 'Tyl', 'Ulv', 'Brekk', 'Stein', 'Vass'];
    for (const c of cand) {
      if (strips.filter(st => st.kind === 'strip').length >= 3) break;
      if (!farFromStrips(c.cx, c.cz, 3000)) continue;
      let nm = '';
      for (let v = 0; v < SYL.length; v++) {   // rotate on collision
        nm = SYL[(((hash2(Math.round(c.cx), Math.round(c.cz)) * SYL.length) | 0) + v) % SYL.length] + ' Strip';
        if (!strips.some(st => st.name === nm)) break;
      }
      push(c.cx, c.cz, c.hdg, 340, 18, SURFACE.GRAVEL, c.elev, nm, 'strip', true);
    }
  }

  // ---- queries: oriented grading SDF, surface patch, exclusion box ----
  function grade(x, z, h) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      const du = Math.max(0, Math.abs(lu) - st.len / 2);
      const dv = Math.max(0, Math.abs(lv) - st.wid / 2 - 6);
      const d = Math.hypot(du, dv);
      if (d < st.feather) h += (st.elev - h) * (1 - smf01(d / st.feather));
    }
    return h;
  }
  function surfaceAt(x, z) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 && Math.abs(lv) < st.wid / 2) return st.surface;
    }
    return -1;
  }
  function inBox(x, z, m) {
    for (const st of strips) {
      if (x < st.bx0 - m || x > st.bx1 + m || z < st.bz0 - m || z > st.bz1 + m) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 + m && Math.abs(lv) < st.wid / 2 + m) return true;
    }
    return false;
  }

  return { strips, grade, surfaceAt, inBox, stats: { bakeMs: Date.now() - t0 } };
}
