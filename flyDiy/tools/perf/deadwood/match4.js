// match.js - DEADWOOD-BRIGHT: per bark-only species (and two leafy controls), one tree at the preset's hand-over
// distance, drawn as GEOMETRY (A), as IMPOSTOR (B) and with every tree hidden (C, the mask's reference), from the free
// camera, the sim held, the day frozen. Two views a species: INTO the sun (backlit) and AWAY (sun behind the eye).
// env: DW_TAG (the condition's name), DW_DAY (noon|golden), DW_KEYS (optional ','-list of key prefixes)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
function readPNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; } else if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len)); p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? out[dst + x - bpp] : 0, b = y > 0 ? out[dst - stride + x] : 0, c = (x >= bpp && y > 0) ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x]; if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[dst + x] = v & 255; } }
  return { w, h, bpp, data: out };
}
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return b => { let c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(CRC(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const toLin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

module.exports = async ({ ev, shot, sleep, log, out }) => {
  const TAG = process.env.DW_TAG || 'run', DAY = process.env.DW_DAY || 'noon';
  const KEYS = process.env.DW_KEYS ? process.env.DW_KEYS.split(',') : null;
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  // the pictures without the HUD, and only once the loading overlay is gone (+ 2 s)
  for (let i = 0; i < 60; i++) { const ov = await ev("(() => !![...document.querySelectorAll('div')].find(d => /load/i.test(d.id || '') && d.offsetParent !== null && d.offsetHeight > 200))()"); if (!ov) break; await sleep(1000); }
  await sleep(2000);
  await ev("(() => { const st = document.createElement('style'); st.textContent = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(st); return 1; })()");
  await ev(`(()=>{ DAY_CLOCK.preset('${DAY}'); DAY_CLOCK.rate(0); return 1; })()`);
  await sleep(1500);
  log(TAG, 'as booted: treeShadowed', await ev('String(WORLD.treeShadowed && WORLD.treeShadowed())'), 'uILit', await ev('WORLD.treeLod.lit.value'), 'shadeK', await ev('TREE_LEAF.shadeK()'), 'imp', await ev('JSON.stringify(TREE_LOD.imp())'));
  const lod0 = await ev('JSON.stringify(TREE_LOD.get())');
  const hand = JSON.parse(lod0)[2];
  const D = hand + 10;
  // THE PICKS: per subject with a bark-only sheet, the nearest unoccluded tree into and away from the sun
  const picks = JSON.parse(await ev(`(() => {
    const W = FLIGHT_PROBE.world(), cg = FLIGHT_PROBE.sim().cgPos(), S = WORLD.SUN.clone().normalize();
    const sh = Math.hypot(S.x, S.z), sx = S.x / sh, sz = S.z / sh;
    const atl = WORLD.treeAtlases();
    const subj = [...new Set(atl.map(a => a.key).filter(Boolean))];
    const all = TREE_LOD.drawn(cg[0], cg[2], 3500), N = all.length / 4;
    const want = ${JSON.stringify(KEYS)};
    const res = [];
    for (const key of subj) {
      if (want && !want.some(w => key.indexOf(w) === 0)) continue;
      const dead = /^dead_/.test(key);
      for (const [ser, sname] of (dead ? [[0, 'rungs']] : [[2, 'snag'], [0, 'rungs']])) {
        if (!dead && ser === 0 && !(want && want.length)) { if (!/^(larch|spruce)/.test(key)) continue; }   // two leafy controls by default
        const a = atl.find(q => q.key === key && q.series === sname); if (!a) continue;
        const C = TREE_LOD.find(key, cg[0], cg[2], 0, 3000, 400, ser);
        for (const side of ${JSON.stringify((process.env.DW_SIDES || 'away,side').split(','))}) {
          let best = null;
          for (const t of C) {
            const h = a.cy * t.s, gy = t.y;
            for (let k = -6; k <= 6; k++) {
              const ang = k * 5 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
              // into: the eye on the anti-sun side, looking toward the sun; away: the eye on the sun's side
              let ux = side === 'into' ? -sx : (side === 'side' ? -sz : sx), uz = side === 'into' ? -sz : (side === 'side' ? sx : sz);
              const vx = ux * ca - uz * sa, vz = ux * sa + uz * ca;
              const ex = t.x + vx * ${D}, ez = t.z + vz * ${D};
              let ey = gy + h - ${D} * Math.tan(1.5 * Math.PI / 180);
              const ge = W.terrainH(ex, ez); if (!(ey > ge + 2)) ey = ge + 2;
              // terrain along the line of sight
              let blocked = false;
              for (let i = 1; i < 20; i++) { const f = i / 20, px = ex + (t.x - ex) * f, pz = ez + (t.z - ez) * f, py = ey + (gy + h - ey) * f;
                if (W.terrainH(px, pz) > py - 1.5) { blocked = true; break; } }
              if (blocked) continue;
              let sc = 0;
              const dx = t.x - ex, dz = t.z - ez, L2 = dx * dx + dz * dz;
              for (let j = 0; j < N; j++) { const qx = all[j * 4], qz = all[j * 4 + 2];
                const f = ((qx - ex) * dx + (qz - ez) * dz) / L2; if (f < 0.03) continue;
                const px = ex + dx * f, pz = ez + dz * f, dd = Math.hypot(qx - px, qz - pz);
                if (f < 0.96 && dd < 6) sc += 1;
                else if (f > 1.04 && f < 4 && dd < 4 + 3 * f) sc += 0.3 / f; }
              if (!best || sc < best.sc) best = { key, ser, sname, side, sc: +sc.toFixed(2), t: { x: t.x, y: t.y, z: t.z, s: t.s, d: Math.round(t.d) }, eye: [ex, ey, ez], tgt: [t.x, gy + h, t.z], cy: a.cy, diam: a.diam, layer: a.layer };
              if (best.sc === 0) break;
            }
            if (best && best.sc === 0) break;
          }
          if (best) res.push(best);
        }
      }
    }
    return JSON.stringify(res); })()`));
  log(TAG, 'hand-over', hand, 'm, D', D, '-', picks.length, 'picks');
  // the hide: every tree material off for one view, re-applied after every world update
  await ev(`(() => { window.__DW = { hide: false, craft: null };
    const wu = WORLD.worldUpdate;
    WORLD.worldUpdate = function () { const r = wu.apply(this, arguments);
      const sc = WORLD.scene; const R = sc.getObjectByName('treeRungs');
      if (R) R.visible = !__DW.hide;
      sc.traverse(o => { if (o.isMesh && o.material && o.material.userData && 'atlas' in o.material.userData) { if (__DW.hide) { if (o.__dwv === undefined) o.__dwv = o.visible; o.visible = false; } else if (o.__dwv !== undefined) { o.visible = o.__dwv; o.__dwv = undefined; } } });
      const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (c) c.visible = false;
      return r; };
    FLIGHT_PROBE.camMode('free'); return 1; })()`);
  const FR = n => ev(`(() => new Promise(res => { let k = 0; const t = () => (++k < ${n}) ? requestAnimationFrame(t) : res(k); requestAnimationFrame(t); }))()`);
  const rows = [];

  const keyOf = p => p.key + '|' + p.sname;
  // levels: an object (set live), 'one' (every sheet at 1: the picture as before G2591), else / 'code' (live cleared: the code's IMP_LEVEL)
  const VERIFY = !!process.env.DW_VERIFY;
  const setV = v => ev(`(() => { TREE_LOD.imp({ trunk: ${v.trunk} }); ${v.levels && typeof v.levels === 'object' ? Object.entries(v.levels).map(([k, x]) => `TREE_LOD.impLevel(${JSON.stringify(k)}, ${x});`).join(' ')
    : picks.map(p => `TREE_LOD.impLevel(${JSON.stringify(keyOf(p))}, ${v.levels === 'one' ? 1 : 'null'});`).join(' ')} return 1; })()`);
  const poseOf = async p => {
    const cg = await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())').then(JSON.parse);
    await ev(`FLIGHT_PROBE.place({ by: [${p.eye[0] - cg[0]}, ${p.eye[1] + 30 - cg[1]}, ${p.eye[2] - cg[2]}], zeroV: true }).then(() => 1)`);
    return JSON.parse(await ev(`(() => { const C = DEV_CAM, E = new THREE.Vector3(${p.eye.join(',')}), T = new THREE.Vector3(${p.tgt.join(',')});
      const d = T.clone().sub(E).normalize(); C.pos.copy(E); C.pitch = Math.asin(d.y); C.yaw = Math.atan2(d.x, -d.z);
      const cam = FLIGHT_PROBE.camera(); C.update(); cam.updateMatrixWorld();
      const RC = WORLD.renderer.domElement.getBoundingClientRect(), W = RC.width, H = RC.height, OX = RC.left, OY = RC.top, r = ${p.diam / 2} * ${p.t.s}, y0 = ${p.t.y}, y1 = ${p.t.y} + 2 * ${p.cy} * ${p.t.s};
      const rx = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
      let x0 = 1e9, x1 = -1e9, ya = 1e9, yb = -1e9;
      for (const sx of [-1, 1]) for (const yy of [y0, y1]) { const P = new THREE.Vector3(${p.t.x}, yy, ${p.t.z}).addScaledVector(rx, sx * r).project(cam);
        const px = (P.x * 0.5 + 0.5) * W, py = (1 - (P.y * 0.5 + 0.5)) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); ya = Math.min(ya, py); yb = Math.max(yb, py); }
      const m = 8; x0 = Math.max(0, Math.floor(x0 - m)); ya = Math.max(0, Math.floor(ya - m)); x1 = Math.min(W, Math.ceil(x1 + m)); yb = Math.min(H, Math.ceil(yb + m)); return JSON.stringify({ x: x0 + OX, y: ya + OY, width: Math.max(4, x1 - x0), height: Math.max(4, yb - ya) }); })()`));
  };
  const snap = async (p, nm, set, hide, box) => { await ev(`(() => { TREE_LOD.set(${set}); __DW.hide = ${hide}; return 1; })()`); await FR(30); await sleep(150);
    return readPNG(await shot(path.join('raw', `${TAG}_${p.key.replace(/[^a-z0-9]+/gi, '_')}_${p.sname}_${p.side}_${nm}`), box)); };
  const coreOf = (A, B, C) => { const n = A.w * A.h; let c = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { const o = i * A.bpp, yc = luma(C.data, o);
      if (Math.abs(luma(A.data, o) - yc) > 6 && Math.abs(luma(B.data, o) - yc) > 6) { c++; sa += 0.2126 * toLin(A.data[o]) + 0.7152 * toLin(A.data[o + 1]) + 0.0722 * toLin(A.data[o + 2]);
        sb += 0.2126 * toLin(B.data[o]) + 0.7152 * toLin(B.data[o + 1]) + 0.0722 * toLin(B.data[o + 2]); } } return c ? sb / sa : 0; };
  // ROUND 1: geometry, the picture today, the picture with the trunk's own tint
  const R = [];
  for (const p of picks) {
    const box = await poseOf(p), I = {};
    I.C = await snap(p, 'C', '[10, 10, 10]', true, box);
    I.A = await snap(p, 'A', '[60, 1200, 1200]', false, box);
    await setV({ trunk: 0, levels: 'one' }); I.T = await snap(p, 'today', '[10, 10, 10]', false, box);
    await setV({ trunk: 1, levels: 'one' }); I.K = await snap(p, 'trunk', '[10, 10, 10]', false, box);
    const r = { key: keyOf(p), side: p.side, sc: p.sc, today: +coreOf(I.A, I.T, I.C).toFixed(3), trunk: +coreOf(I.A, I.K, I.C).toFixed(3) };
    R.push({ p, box, r, I }); log(`${r.key.padEnd(56)} ${p.side.padEnd(5)} occl ${String(p.sc).padEnd(5)} core today ${r.today}  trunk fix ${r.trunk}`);
  }
  // THE LEVEL per sheet: the front-lit view's match after the trunk fix (the side view where there is none), darkening only
  const levels = {};
  for (const k of [...new Set(R.map(x => x.r.key))]) { const a = R.find(x => x.r.key === k && x.p.side === 'away') || R.find(x => x.r.key === k);
    const c = a && a.r.trunk; levels[k] = c > 0 ? +Math.max(0.7, Math.min(1, 1 / c)).toFixed(3) : 1; }
  log(TAG, 'levels', JSON.stringify(levels));
  // ROUND 2: the picture fixed (trunk + level), the same poses
  await setV({ trunk: 1, levels: VERIFY ? 'code' : levels });
  for (const x of R) {
    await poseOf(x.p);
    x.I.F = await snap(x.p, 'fixed', '[10, 10, 10]', false, x.box);
    x.r.fixed = +coreOf(x.I.A, x.I.F, x.I.C).toFixed(3);
    log(`${x.r.key.padEnd(56)} ${x.p.side.padEnd(5)} core today ${x.r.today}  fixed ${x.r.fixed}`);
    const order = ['A', 'T', 'F'], A = x.I.A;
    const k = Math.max(1, Math.min(4, Math.floor(360 / A.h))), w = A.w * k, h = A.h * k, gap = 6, W2 = w * 3 + gap * 2, rgb = Buffer.alloc(W2 * h * 3, 255);
    order.forEach((nm, j) => { const I = x.I[nm]; for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const s = (Math.floor(y / k) * I.w + Math.floor(xx / k)) * I.bpp, d2 = (y * W2 + j * (w + gap) + xx) * 3;
      rgb[d2] = I.data[s]; rgb[d2 + 1] = I.data[s + 1]; rgb[d2 + 2] = I.data[s + 2]; } });
    writePNG(path.join(out, `${TAG}_${x.p.key.replace(/[^a-z0-9]+/gi, '_')}_${x.p.sname}_${x.p.side}.png`), W2, h, rgb);
  }
  await ev(`(() => { TREE_LOD.set(${lod0}); __DW.hide = false; return 1; })()`);
  fs.writeFileSync(path.join(out, TAG + '_imp.json'), JSON.stringify({ tag: TAG, day: DAY, hand, levels, rows: R.map(x => x.r) }, null, 1));
  // THE 1 KM FRAME over the densest stand, front-lit: today | fixed
  const st = JSON.parse(await ev(`(() => { const w = FLIGHT_PROBE.world(); const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500); let best = null, bn = -1;
    for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0; for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++; if (n > bn) { bn = n; best = a; } }
    return JSON.stringify({ x: best.x, z: best.z, y: w.terrainH(best.x, best.z) }); })()`));
  const eye = JSON.parse(await ev(`(() => { const S = WORLD.SUN.clone(); const h = Math.hypot(S.x, S.z) || 1; return JSON.stringify([${st.x} + S.x / h * 3200, ${st.y} + 1000, ${st.z} + S.z / h * 3200]); })()`));
  const cg = JSON.parse(await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())'));
  await ev(`FLIGHT_PROBE.place({ by: [${eye[0] - cg[0]}, ${eye[1] + 40 - cg[1]}, ${eye[2] - cg[2]}], zeroV: true }).then(() => 1)`);
  await ev(`(() => { const C = DEV_CAM; C.pos.set(${eye.join(',')}); const d = new THREE.Vector3(${st.x - eye[0]}, 0, ${st.z - eye[2]}).normalize(); C.yaw = Math.atan2(d.x, -d.z); C.pitch = -17 * Math.PI / 180; return 1; })()`);
  await FR(90); await sleep(9000);
  for (const [nm, v] of [['today', { trunk: 0, levels: 'one' }], ['fixed', { trunk: 1, levels: VERIFY ? 'code' : levels }]]) { await setV(v); await FR(40); await sleep(600); await shot(path.join('raw', `${TAG}_1km_${nm}`)); }
};
