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
        for (const side of ['into', 'away', 'side']) {
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
  for (const p of picks) {
    // the craft to the eye (the shadow camera follows it), the free camera on the tree
    const cg = await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())').then(JSON.parse);
    await ev(`FLIGHT_PROBE.place({ by: [${p.eye[0] - cg[0]}, ${p.eye[1] + 30 - cg[1]}, ${p.eye[2] - cg[2]}], zeroV: true }).then(() => 1)`);
    const box = JSON.parse(await ev(`(() => { const C = DEV_CAM, E = new THREE.Vector3(${p.eye.join(',')}), T = new THREE.Vector3(${p.tgt.join(',')});
      const d = T.clone().sub(E).normalize(); C.pos.copy(E); C.pitch = Math.asin(d.y); C.yaw = Math.atan2(d.x, -d.z);
      const cam = FLIGHT_PROBE.camera(); C.update(); cam.updateMatrixWorld(); cam.updateProjectionMatrix && cam.updateProjectionMatrix();
      const RC = WORLD.renderer.domElement.getBoundingClientRect(), W = RC.width, H = RC.height, OX = RC.left, OY = RC.top, r = ${p.diam / 2} * ${p.t.s}, y0 = ${p.t.y}, y1 = ${p.t.y} + 2 * ${p.cy} * ${p.t.s};
      const rx = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
      let x0 = 1e9, x1 = -1e9, ya = 1e9, yb = -1e9;
      for (const sx of [-1, 1]) for (const yy of [y0, y1]) { const P = new THREE.Vector3(${p.t.x}, yy, ${p.t.z}).addScaledVector(rx, sx * r).project(cam);
        const px = (P.x * 0.5 + 0.5) * W, py = (1 - (P.y * 0.5 + 0.5)) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); ya = Math.min(ya, py); yb = Math.max(yb, py); }
      const m = 8; x0 = Math.max(0, Math.floor(x0 - m)); ya = Math.max(0, Math.floor(ya - m)); x1 = Math.min(W, Math.ceil(x1 + m)); yb = Math.min(H, Math.ceil(yb + m)); return JSON.stringify({ x: x0 + OX, y: ya + OY, width: Math.max(4, x1 - x0), height: Math.max(4, yb - ya) }); })()`));
    const imgs = {};
    const VARS = JSON.parse(process.env.DW_VARS || '{"old":{"lit":1.242,"barkWrap":1,"barkSSS":1,"barkFlat":1.3},"lit09":{"lit":0.9,"barkWrap":1,"barkSSS":1,"barkFlat":1.3},"none":{"lit":0.9,"barkWrap":0,"barkSSS":0,"barkFlat":1},"wrap":{"lit":0.9,"barkWrap":1,"barkSSS":0,"barkFlat":1}}');
    // match3: the geometry per variant too (the shade lift moves both tiers): A_<v>, B_<v>; C once
    const shots = [['C', '[10, 10, 10]', true, null]];
    for (const v of Object.keys(VARS)) shots.push(['A_' + v, '[60, 1200, 1200]', false, VARS[v]], ['B_' + v, '[10, 10, 10]', false, VARS[v]]);
    for (const [nm, set, hide, imp] of shots) {
      await ev(`(() => { TREE_LOD.set(${set}); __DW.hide = ${hide}; ${imp ? 'WORLD.treeLod.lit.value = ' + imp.lit + '; TREE_LEAF.shadeK(' + imp.shade + '); TREE_LOD.imp(' + JSON.stringify(imp) + ');' : ''} return 1; })()`);
      await FR(30); await sleep(150);
      const name = `${TAG}_${p.key.replace(/[^a-z0-9]+/gi, '_')}_${p.sname}_${p.side}_${nm}`;
      imgs[nm] = readPNG(await shot(path.join('raw', name), box));
    }
    await ev(`(() => { TREE_LOD.set(${lod0}); __DW.hide = false; return 1; })()`);
    const A = imgs['A_' + Object.keys(VARS)[0]], Cc = imgs.C, n = A.w * A.h;
    const boxLin = I => { let s = 0; for (let i = 0; i < n; i++) { const o = i * I.bpp; s += 0.2126 * toLin(I.data[o]) + 0.7152 * toLin(I.data[o + 1]) + 0.0722 * toLin(I.data[o + 2]); } return s / n; };
    const mask = I => { let c = 0, s = 0; for (let i = 0; i < n; i++) { const o = i * I.bpp; if (Math.abs(luma(I.data, o) - luma(Cc.data, o)) > 6) { c++; s += 0.2126 * toLin(I.data[o]) + 0.7152 * toLin(I.data[o + 1]) + 0.0722 * toLin(I.data[o + 2]); } } return [c, c ? s / c : 0]; };
    const bA = boxLin(A), bC = boxLin(Cc), mA = mask(A);
    const row = { key: p.key, ser: p.sname, side: p.side, sc: p.sc, d: D, box, boxA: +bA.toFixed(4), boxC: +bC.toFixed(4), pxA: mA[0], linA: +mA[1].toFixed(4), v: {} };
    let line = `${p.key.slice(0, 40).padEnd(40)} ${p.sname.padEnd(5)} ${p.side.padEnd(4)} occl ${String(p.sc).padEnd(5)} box geo ${bA.toFixed(4)} none ${bC.toFixed(4)} |`;
    const core = I => { let c = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { const o = i * I.bpp, yc = luma(Cc.data, o); if (Math.abs(luma(A.data, o) - yc) > 6 && Math.abs(luma(I.data, o) - yc) > 6) { c++;
        sa += 0.2126 * toLin(A.data[o]) + 0.7152 * toLin(A.data[o + 1]) + 0.0722 * toLin(A.data[o + 2]); sb += 0.2126 * toLin(I.data[o]) + 0.7152 * toLin(I.data[o + 1]) + 0.0722 * toLin(I.data[o + 2]); } } return c ? sb / sa : 0; };
    for (const v of Object.keys(VARS)) { const I = imgs['B_' + v], AV = imgs['A_' + v], bB = boxLin(I), bAv = boxLin(AV), m = mask(I);
      const cr = (() => { let c = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { const o = i * I.bpp, yc = luma(Cc.data, o); if (Math.abs(luma(AV.data, o) - yc) > 6 && Math.abs(luma(I.data, o) - yc) > 6) { c++;
        sa += 0.2126 * toLin(AV.data[o]) + 0.7152 * toLin(AV.data[o + 1]) + 0.0722 * toLin(AV.data[o + 2]); sb += 0.2126 * toLin(I.data[o]) + 0.7152 * toLin(I.data[o + 1]) + 0.0722 * toLin(I.data[o + 2]); } } return c ? sb / sa : 0; })();
      // pop: how far the impostor moves the box from its geometry, as a share of what the geometry adds to the empty box
      const pop = (bB - bAv) / Math.max(1e-4, Math.abs(bAv - bC));
      row.v[v] = { boxA: +bAv.toFixed(4), boxB: +bB.toFixed(4), pop: +pop.toFixed(3), px: m[0], lin: +m[1].toFixed(4), core: +cr.toFixed(3) };
      line += ` ${v} pop ${(pop >= 0 ? '+' : '') + pop.toFixed(2)} core ${cr.toFixed(2)} |`; }
    rows.push(row); log(line);
    // the evidence strip: geometry | each variant
    const order = [].concat(...Object.keys(VARS).map(v => ['A_' + v, 'B_' + v]));
    const k = Math.max(1, Math.min(4, Math.floor(360 / A.h))), w = A.w * k, h = A.h * k, gap = 6, W2 = w * order.length + gap * (order.length - 1), rgb = Buffer.alloc(W2 * h * 3, 255);
    order.forEach((nm, j) => { const I = imgs[nm]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (Math.floor(y / k) * I.w + Math.floor(x / k)) * I.bpp, d2 = (y * W2 + j * (w + gap) + x) * 3;
      rgb[d2] = I.data[s]; rgb[d2 + 1] = I.data[s + 1]; rgb[d2 + 2] = I.data[s + 2]; } });
    writePNG(path.join(out, `${TAG}_${p.key.replace(/[^a-z0-9]+/gi, '_')}_${p.sname}_${p.side}.png`), W2, h, rgb);
    log('   strip: ' + order.join(' | '));
  }
  fs.writeFileSync(path.join(out, TAG + '_match.json'), JSON.stringify({ tag: TAG, day: DAY, hand, D, rows, picks }, null, 1));
  // THE CONTEXT STILLS: the default ladder, the larch snag's view pulled back to 2.2 x the hand-over, each variant
  const CV = JSON.parse(process.env.DW_CTX || '["old","none","wrap"]');
  const VARS = JSON.parse(process.env.DW_VARS || '{"old":{"lit":1.242,"barkWrap":1,"barkSSS":1,"barkFlat":1.3},"lit09":{"lit":0.9,"barkWrap":1,"barkSSS":1,"barkFlat":1.3},"none":{"lit":0.9,"barkWrap":0,"barkSSS":0,"barkFlat":1},"wrap":{"lit":0.9,"barkWrap":1,"barkSSS":0,"barkFlat":1}}');
  const ctx = picks.filter(p => /larch/.test(p.key) && p.sname === 'snag');
  for (const p of ctx) {
    const E = [p.tgt[0] + (p.eye[0] - p.tgt[0]) * 2.2, 0, p.tgt[2] + (p.eye[2] - p.tgt[2]) * 2.2];
    await ev(`(() => { const W = FLIGHT_PROBE.world(); const C = DEV_CAM; const E = new THREE.Vector3(${E[0]}, Math.max(W.terrainH(${E[0]}, ${E[2]}) + 25, ${p.tgt[1]} + 12), ${E[2]});
      const T = new THREE.Vector3(${p.tgt.join(',')}); const d = T.sub(E).normalize(); C.pos.copy(E); C.pitch = Math.asin(d.y); C.yaw = Math.atan2(d.x, -d.z); return 1; })()`);
    for (const v of CV) { await ev(`(WORLD.treeLod.lit.value = ${VARS[v].lit}, TREE_LEAF.shadeK(${VARS[v].shade}), TREE_LOD.imp(${JSON.stringify(VARS[v])}), 1)`); await FR(40); await sleep(300); await shot(`${TAG}_context_larch_${p.side}_${v}`); }
  }
};
