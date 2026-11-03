// bay_stage.js - THE BAYS' STILLS, staged at the stand by tools/soft_still.js (BAY-MIRROR, 2026-11-03)
//
//   node tools/soft_still.js --page index.html --build bugReports/cessnaFloats.json --q 'world=jolene&idle=0&intro=0' \
//        --size 1280x720 --secs 5400 --stage tools/perf/bay_stage.js --out <dir>/stand.jpg
//   env BAY_OUT=<dir> (the stills' directory, default reports/evidence/BAY-MIRROR), BAY_TAG=before|after (the file suffix),
//       BAY_VIEWS=a,b (a subset), BAY_FRAMES=4 (the frames drawn on a view before its still), BAY_MIRROR=auto (the row),
//       BAY_WATER=simple (the water tier: gamer's), BAY_WIND=5 (m/s: the sea pinned A 0.018 W, L 3 + 1.4 W - the ring study's)
//
// At the stand: the run PAUSED, the sea and the wind pinned (a before and an after see the same trains at the same clock),
// the reflections row set (the software rung's potato has them off; the stills are about the mirror), the free eye; then per
// view the floatplane placed (afloat at its rest height, or at a height over the water), the eye placed and aimed, N frames,
// a still. Fixed coordinates on Jolene, so the two runs are the same picture:
//   sbay_float   the main south bay (the fjord: Purple Lake's powerhouse at its head, the two canneries, the net pens), afloat
//                mid-fjord, the eye 6 m up behind it, looking up the fjord to its head
//   sbay_300     the same fjord from 300 m: the aircraft 300 m over its lower half, the eye behind and above, looking up it
//   pchest_float Port Chester (Metlakatla's bay: Cedar Harbour's cannery, the Port Chester powerhouse), afloat, eye 6 m up
//   lake_float   a drawn lake (tools/perf/water_places.js's finder), afloat, the eye 8 m up - the comparison
//   open_float   the open sea 3 km off the west coast, afloat, the eye 6 m up - the sea that must not change
//   open_300     the same open sea from 300 m
// Never read a frame time off SwiftShader.
'use strict';
const path = require('path');
const WP = require('./water_places.js');
const V = {
  sbay_float:   { x: 300, z: -3600, agl: 0, eye: [300, 6, -3560], look: [-300, 0, -5600] },
  sbay_300:     { x: 2000, z: -2400, agl: 300, eye: [2900, 360, -400], look: [-200, 0, -5400] },
  pchest_float: { x: -1700, z: -8800, agl: 0, eye: [-1750, 6, -8840], look: [-1250, 0, -8500] },
  lake_float:   { lake: true, agl: 0, back: 30, up: 8, side: 6 },
  open_float:   { x: -10500, z: -9000, agl: 0, eye: [-10540, 6, -9040], look: [-6000, 0, -8000] },
  open_300:     { x: -10500, z: -9000, agl: 300, eye: [-11200, 360, -10200], look: [-6000, 0, -8000] },
};
module.exports = async (page, { frames, shot, log }) => {
  const OUT = path.resolve(process.env.BAY_OUT || path.join(__dirname, '..', '..', 'reports', 'evidence', 'BAY-MIRROR'));
  const TAG = process.env.BAY_TAG || 'shot', N = +(process.env.BAY_FRAMES || 4), WIND = +(process.env.BAY_WIND || 5);
  const views = (process.env.BAY_VIEWS || Object.keys(V).join(',')).split(',').filter(k => V[k]);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const R = { tag: TAG, wind: WIND, views: {} };
  await ev(() => { const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); });
  R.h0 = await ev(() => { const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world(), c = s.cgPos(); const wy = WORLD.waterDrawY ? WORLD.waterDrawY(c[0], c[2]) : null;
    return Math.max(0.5, c[1] - Math.max(w.terrainH(c[0], c[2]), Number.isFinite(wy) ? wy : -1e9)); });
  // the rest height afloat: the floats' own draft is a few dm under the CG's stand height on wheels/floats on the grass
  await ev(([W, mir, tier]) => { FLIGHT_PROBE.world().setSea({ A: 0.018 * W, L: 3 + 1.4 * W, dir: 0.4 }); WATER.setWind(W, 0.4);
    WATER.set({ mirror: mir, tier }); return 1; }, [WIND, process.env.BAY_MIRROR || 'auto', process.env.BAY_WATER || 'simple']);
  R.state0 = await ev(() => ({ gfx: window.GFX && GFX.get ? (({ preset, water, mirror }) => ({ preset, water, mirror }))(GFX.get()) : null, mirrorMode: WATER.mirror.mode, tier: WATER.S.tier,
    calmField: !!(FLIGHT_PROBE.world().calmField && FLIGHT_PROBE.world().calmField()), shaderCalm: !!(WATER.uniforms && WATER.uniforms.uWCalmOn && WATER.uniforms.uWCalmOn.value) }));
  log('bay_stage', JSON.stringify(R.state0));
  // THE WATER PROGRAM'S TEXTURE UNITS, read off the GL program (sampler_census.js's rule, G424: a declared-but-unsampled
  // sampler costs nothing, so the source's count is not the answer) - every linked program that has the water's uniforms
  R.samplers = await ev(() => { const r = window.FLYDIY_RENDERER, gl = r && r.getContext(), out = [];
    const ST = gl ? [gl.SAMPLER_2D, gl.SAMPLER_CUBE, gl.SAMPLER_3D, gl.SAMPLER_2D_ARRAY, gl.SAMPLER_2D_SHADOW, gl.SAMPLER_2D_ARRAY_SHADOW, gl.SAMPLER_CUBE_SHADOW, gl.INT_SAMPLER_2D, gl.UNSIGNED_INT_SAMPLER_2D] : [];
    for (const p of (r && r.info.programs) || []) { const P = p.program; if (!P) continue; const n = gl.getProgramParameter(P, gl.ACTIVE_UNIFORMS); let water = false, units = 0; const names = [];
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(P, i); if (!u) continue; if (/^uWMirror4$|^uWBody/.test(u.name)) water = true; if (ST.includes(u.type)) { units += u.size; names.push(u.name.replace(/\[0\]$/, '') + (u.size > 1 ? '[' + u.size + ']' : '')); } }
      if (water) out.push({ units, max: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS), names }); }
    return out; });
  log('bay_stage samplers', JSON.stringify(R.samplers));
  // the free eye (the camera rail's pill), the HUD stays hidden (soft_still's style)
  await ev(() => { const Rl = window.FLYDIY_RAIL, f = document.getElementById('flFly'); if (Rl) Rl.open(f && !f.hidden ? null : 'camera'); });
  await new Promise(r => setTimeout(r, 1500));
  const free = await ev(() => { const p = [...document.querySelectorAll('#flFlyBody .pill')].find(b => b.textContent.trim() === 'free'); if (!p) return 0; p.click(); return 1; });
  await ev(() => { const Rl = window.FLYDIY_RAIL, f = document.getElementById('flFly'); if (Rl) Rl.open(f && !f.hidden ? null : 'camera'); });
  if (!free) throw new Error('bay_stage: no free-eye pill');
  for (const name of views) {
    let P = V[name];
    if (P.lake) { await ev(WP.FIND); const L = await ev(() => window.__WP && __WP.lake ? { x: __WP.lake.x, z: __WP.lake.z, n: __WP.lake.n } : null);
      if (!L) { log('bay_stage: no lake found'); continue; }
      const n = L.n || { dx: 1, dz: 0 }, v = P;
      P = { x: L.x, z: L.z, agl: 0, eye: [L.x - n.dx * v.back + n.dz * v.side, v.up, L.z - n.dz * v.back - n.dx * v.side], look: [L.x + n.dx * 300, 0, L.z + n.dz * 300] }; }
    const lvl = await ev(([x, z]) => { const y = WORLD.waterDrawY ? WORLD.waterDrawY(x, z) : null; return Number.isFinite(y) ? y : 0; }, [P.x, P.z]);
    const y = P.agl > 0.5 ? lvl + P.agl : lvl + R.h0 - 0.25;
    await ev(async ([x, y, z]) => { const s = FLIGHT_PROBE.sim(), c = s.cgPos(); await FLIGHT_PROBE.place({ by: [x - c[0], y - c[1], z - c[2]], zeroV: true }); return 1; }, [P.x, y, P.z]);
    const ex = P.eye[0], ey = lvl + P.eye[1], ez = P.eye[2], dx = P.look[0] - ex, dz = P.look[2] - ez, dy = lvl + P.look[1] - ey;
    await ev(([ex, ey, ez, yaw, pitch]) => { const c = DEV_CAM; c.pos.set(ex, ey, ez); c.yaw = yaw; c.pitch = pitch; return 1; }, [ex, ey, ez, Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]);
    await frames(N);
    const file = path.join(OUT, name + '_' + TAG + '.jpg');
    const A = await shot(file);
    R.views[name] = { file: path.basename(file), eye: [ex, ey, ez].map(t => +t.toFixed(1)), at: [P.x, +y.toFixed(2), P.z], level: lvl, pic: A,
      state: await ev(([x, z]) => { const w = FLIGHT_PROBE.world(); return { mirror: WATER.mirror.on, mirrorW: +(WATER.mirror.w || 0).toFixed(3), ringW: WATER.mirror.ringW, plane: WATER.mirror.plane,
        lake: WATER.mirror.lake, calm: w.calmAt ? +w.calmAt(x, z).toFixed(3) : null }; }, [P.x, P.z]) };
    log('bay_stage', name, JSON.stringify(R.views[name].state));
  }
  require('fs').writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(R, null, 1));
  return Object.assign(R, { skipMain: true });
};
