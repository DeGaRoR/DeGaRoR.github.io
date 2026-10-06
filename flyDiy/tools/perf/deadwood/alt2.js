// alt.js - the far forest from altitude (A0's sheet): 300 m and 1 km AGL, noon and golden, front-lit, as
// master | fix (bark none) | fix (bark wrap) | fix + the trees' lightness x1.38 (+ a no-trees frame for the mask)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const src = fs.readFileSync(path.join(__dirname, 'match.js'), 'utf8');
eval(src.slice(src.indexOf('function readPNG'), src.indexOf('module.exports')).replace(/^const /gm, 'var '));
module.exports = async ({ ev, shot, sleep, log, out }) => {
  const TAG = process.env.DW_TAG || 'sh';
  await ev("(() => { const st = document.createElement('style'); st.textContent = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(st); return 1; })()");
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  const L0 = await ev('TREE_LEAF.master().light');
  const V = {
    master: { lit: 1.242, shade: 1,    imp: { barkWrap: 1, barkSSS: 1, barkFlat: 1.3, barkSolid: 1, barkCut: 0, barkLit: 1.242 } },
    final:  { lit: 0.9,   shade: 1.38, imp: { barkWrap: 1, barkSSS: 0, barkFlat: 1, barkSolid: 0, barkCut: 0.4, barkLit: 0.9 } },
  };
  // the densest stand within 2.5 km of HOME (imp_audit's TELEPORT rule)
  const st = JSON.parse(await ev(`(() => { const w = FLIGHT_PROBE.world(); const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500); let best = null, bn = -1;
    for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0; for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++; if (n > bn) { bn = n; best = a; } }
    return JSON.stringify({ x: best.x, z: best.z, y: w.terrainH(best.x, best.z), n: bn }); })()`));
  log('stand', st);
  await ev(`(() => { window.__DW = { hide: false }; const wu = WORLD.worldUpdate;
    WORLD.worldUpdate = function () { const r = wu.apply(this, arguments); const sc = WORLD.scene; const R = sc.getObjectByName('treeRungs'); if (R) R.visible = !__DW.hide;
      sc.traverse(o => { if (o.isMesh && o.material && o.material.userData && 'atlas' in o.material.userData) { if (__DW.hide) { if (o.__dwv === undefined) o.__dwv = o.visible; o.visible = false; } else if (o.__dwv !== undefined) { o.visible = o.__dwv; o.__dwv = undefined; } } });
      const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (c) c.visible = false; return r; };
    FLIGHT_PROBE.camMode('free'); DAY_CLOCK.rate(0); return 1; })()`);
  const FR = n => ev(`(() => new Promise(res => { let k = 0; const t = () => (++k < ${n}) ? requestAnimationFrame(t) : res(k); requestAnimationFrame(t); }))()`);
  const res = [];
  // the near views first: the stand's chase camera (before the free camera takes over) is shot in mixd-style below via DW_NEAR
  const cg0 = JSON.parse(await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())'));
  const edge = JSON.parse(await ev(`(() => { const W = FLIGHT_PROBE.world(), cg = ${JSON.stringify(cg0)}; const all = TREE_LOD.drawn(cg[0], cg[2], 450); let best = null;
    for (let a = 0; a < 72; a++) { const az = a * 5 * Math.PI / 180, dx = Math.sin(az), dz = -Math.cos(az); let n = 0, near = 0;
      for (let i = 0; i < all.length; i += 4) { const x = all[i] - cg[0], z = all[i + 2] - cg[2], d = Math.hypot(x, z); if (d < 1) continue;
        const c = (x * dx + z * dz) / d; if (c < Math.cos(5 * Math.PI / 180)) continue; if (d < 60) near++; else if (d < 450) n++; }
      if (!near && (!best || n > best.n)) best = { az, n }; }
    return JSON.stringify({ eye: [cg[0], W.terrainH(cg[0], cg[2]) + 1.8, cg[2]], yaw: best.az }); })()`));
  for (const day of ['noon', 'golden']) {
    await ev(`(DAY_CLOCK.preset('${day}'), DAY_CLOCK.rate(0), 1)`);
    await ev(`(() => { const C = DEV_CAM; C.pos.set(${edge.eye.join(',')}); C.yaw = ${edge.yaw}; C.pitch = 2 * Math.PI / 180; return 1; })()`);
    await FR(60); await sleep(2500);
    for (const k of Object.keys(V)) { const v = V[k]; await ev(`(() => { WORLD.treeLod.lit.value = ${v.lit}; TREE_LOD.imp(${JSON.stringify(v.imp)}); TREE_LEAF.shadeK(${v.shade}); return 1; })()`);
      await FR(40); await sleep(500); await shot(path.join('raw', `${TAG}_edge_${day}_${k}`)); }
  }
  for (const [agl, hd, pitch] of [[300, 1400, -11], [1000, 3200, -17]]) {
    for (const day of ['noon', 'golden']) {
      await ev(`(DAY_CLOCK.preset('${day}'), DAY_CLOCK.rate(0), 1)`);
      // the eye on the sun's side of the stand (front-lit), agl over the stand's ground
      const eye = JSON.parse(await ev(`(() => { const S = WORLD.SUN.clone(); const h = Math.hypot(S.x, S.z) || 1; const ex = ${st.x} + S.x / h * ${hd}, ez = ${st.z} + S.z / h * ${hd};
        return JSON.stringify([ex, ${st.y} + ${agl}, ez]); })()`));
      const cg = JSON.parse(await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())'));
      await ev(`FLIGHT_PROBE.place({ by: [${eye[0] - cg[0]}, ${eye[1] + 40 - cg[1]}, ${eye[2] - cg[2]}], zeroV: true }).then(() => 1)`);
      await ev(`(() => { const C = DEV_CAM; C.pos.set(${eye.join(',')}); const d = new THREE.Vector3(${st.x - eye[0]}, 0, ${st.z - eye[2]}).normalize();
        C.yaw = Math.atan2(d.x, -d.z); C.pitch = ${pitch} * Math.PI / 180; return 1; })()`);
      await FR(90); await sleep(12000); await ev('WORLD.treeSettled ? WORLD.treeSettled() : 1'); await FR(60); await sleep(2000);
      const imgs = {};
      for (const [nm, v, hide] of Object.keys(V).map(k => [k, V[k], false]).concat([['none', V.final, true]])) {
        await ev(`(() => { WORLD.treeLod.lit.value = ${v.lit}; TREE_LOD.imp(${JSON.stringify(v.imp)}); TREE_LEAF.shadeK(${v.shade}); __DW.hide = ${hide}; return 1; })()`);
        await FR(40); await sleep(500);
        imgs[nm] = readPNG(await shot(path.join('raw', `${TAG}_${agl}m_${day}_${nm}`)));
      }
      await ev(`(() => { __DW.hide = false; return 1; })()`);
      // the trees' own pixels (differ from the no-trees frame), the mean linear luminance per variant
      const N = imgs.none, n = N.w * N.h, row = { agl, day };
      const mk = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const o = i * N.bpp; if (Math.abs(luma(imgs.master.data, o) - luma(N.data, o)) > 4) mk[i] = 1; }
      let line = `${String(agl).padStart(5)} m ${day.padEnd(6)} trees ${(mk.reduce((a, b) => a + b, 0) / n * 100).toFixed(1)} % of the frame |`;
      for (const k of Object.keys(V)) { const I = imgs[k]; let s = 0, c = 0, f = 0;
        for (let i = 0; i < n; i++) { const o = i * I.bpp, y = 0.2126 * toLin(I.data[o]) + 0.7152 * toLin(I.data[o + 1]) + 0.0722 * toLin(I.data[o + 2]); f += y; if (mk[i]) { s += y; c++; } }
        row[k] = { trees: +(s / c).toFixed(4), frame: +(f / n).toFixed(4) }; line += ` ${k} ${(s / c).toFixed(4)} |`; }
      log(line); res.push(row);
    }
  }
  fs.writeFileSync(path.join(out, TAG + '_alt.json'), JSON.stringify({ stand: st, res }, null, 1));
};
