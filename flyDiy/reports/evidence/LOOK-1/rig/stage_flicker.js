// LOOK-1-STUDY pass 3: TEMPORAL INSTABILITY, measured without a frame time. For each view and each dial: the same paused
// scene rendered at N sub-pixel camera offsets (Halton 2,3 within +-0.5 px, as a slow pan samples it) + one exact repeat
// of offset 0 (the noise floor). Per-pixel spread across the offsets = what flickers / crawls when the camera moves; the
// mean of the offsets = the image a temporal accumulation (TAA) would converge to. PNGs only; python does the numbers.
// env: L1_OUT, L1_VIEWS (JSON [{key,r0,r1,d,h,light,side,pitch,tag,pre,vars:[{tag,js,undo}]}]), L1_N (offsets, default 6)
const fs = require('fs'), path = require('path');
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
module.exports = async (page, { frames, log }) => {
  const OUT = process.env.L1_OUT; fs.mkdirSync(OUT, { recursive: true });
  const N = +(process.env.L1_N || 6);
  const ev = s => page.evaluate(s);
  const VIEWS = JSON.parse(process.env.L1_VIEWS);
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  const meta = [];
  for (const V of VIEWS) {
    if (V.pre) { await ev(`(()=>{ ${V.pre}; return 1; })()`); await frames(V.preFrames || 10); }
    const pick = JSON.parse(await ev(`JSON.stringify((()=>{ const cg = FLIGHT_PROBE.camGet().target;
      const t = TREE_LOD.find('${V.key}', cg[0], cg[2], ${V.r0 || 15}, ${V.r1 || 600}, 40); const d = DAY_CLOCK.day();
      const L = '${V.light || 'sun'}' === 'sun' ? d.sun : d.moon; const ln = Math.hypot(L[0], L[2]) || 1; let ax = L[0] / ln, az = L[2] / ln;
      const s = '${V.side || 'side'}'; if (s === 'away') { ax = -ax; az = -az; } else if (s === 'side') { const q = ax; ax = -az; az = q; }
      for (const tr of t) { const ex = tr.x + ax * ${V.d}, ez = tr.z + az * ${V.d}; const W = FLIGHT_PROBE.world();
        return { tr, eye: [ex, ez], gy: W && W.terrainH ? W.terrainH(ex, ez) : null }; }
      return null; })())`));
    if (!pick) { log('L1F no tree', V.key); continue; }
    const ey = (pick.gy != null ? pick.gy : pick.tr.y) + V.h;
    const fx = pick.tr.x - pick.eye[0], fz = pick.tr.z - pick.eye[1];
    const yaw0 = Math.atan2(fx, -fz), pitch0 = (V.pitch || 0) * Math.PI / 180;
    const pxA = await ev('((typeof FLIGHT_PROBE.camera === "function" ? FLIGHT_PROBE.camera() : FLIGHT_PROBE.camera).fov * Math.PI / 180) / window.innerHeight');   // radians a pixel (vertical; square pixels)
    for (const X of V.vars) {
      await ev(`(()=>{ ${X.js}; return 1; })()`);
      await ev(`(()=>{ FLIGHT_PROBE.devFree(${pick.eye[0]}, ${ey}, ${pick.eye[1]}, ${yaw0}, ${pitch0}); return 1; })()`);
      await frames(X.frames || 6);
      const offs = []; for (let i = 1; i <= N; i++) offs.push([halton(i, 2) - 0.5, halton(i, 3) - 0.5]);
      offs.push(offs[0]);   // the repeat: the noise floor
      for (let k = 0; k < offs.length; k++) {
        const [ox, oy] = offs[k];
        await ev(`(()=>{ FLIGHT_PROBE.devFree(${pick.eye[0]}, ${ey}, ${pick.eye[1]}, ${yaw0 + ox * pxA}, ${pitch0 + oy * pxA}); return 1; })()`);
        await frames(2);
        const f = path.join(OUT, `${V.tag}_${X.tag}_${k}.png`);
        fs.writeFileSync(f, await page.screenshot({ type: 'png' }));
      }
      log('L1F', V.tag, X.tag, 'done');
      if (X.undo) await ev(`(()=>{ ${X.undo}; return 1; })()`);
    }
    meta.push({ view: V.tag, tree: pick.tr, eye: [pick.eye[0], ey, pick.eye[1]], yaw0, pitch0, pxA, N });
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  return { skipMain: true, n: meta.length };
};
