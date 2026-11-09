#!/usr/bin/env node
// cowl_study/fitted_report.js - THE USER'S HAND-FITTED COWLS, READ (PROPER-COWLS, 8 Nov): for each build, the firewall
// face (the fuselage's own section there: its width by height), the cowl's aft and front sections as drawn (top,
// waist = widest line, bottom, half-width, all in metres about the face's centre), the thrust line and the engine's
// envelope. The proportions the default must learn.  node tools/cowl_study/fitted_report.js <build.json>...
'use strict';
const SH = require('../_scene_headless.js');
const r3 = v => (v == null || !isFinite(v)) ? null : Math.round(v * 1000) / 1000;
for (const f of process.argv.slice(2)) {
  const j = require(require('path').resolve(f)); const spec = j.spec || j;
  const S = SH.sceneBuild(spec, {}); const W = S.W, CW = W.COWL_GEN, P = S.P;
  const mount = Math.round(+P.engMount || 0);
  const face = W.CAGE_COWL_NOSE_FACE(S.built.sheet, S.FS, mount === 1 ? 'tail' : 'nose');
  // the fuselage's width by height just behind the face (the cage's airframe surface)
  const AF = W.GEAR_GEN && W.GEAR_GEN.cageAirframe ? W.GEAR_GEN.cageAirframe(S.built.sheet, S.FS) : null;
  const prof = [];
  if (AF && face) {
    const zs = face.z + (mount === 1 ? 0.06 : -0.06);
    const pts = []; for (let k = 0; k < 360; k++) { const p = AF.surf(zs, -Math.PI + k / 360 * 2 * Math.PI); pts.push(p); }
    for (let t = -1; t <= 1.0001; t += 0.25) {           // half-width at heights (fractions of the face's half-height)
      const y = face.yc + t * face.halfH; let w = 0;
      for (const p of pts) if (Math.abs(p[1] - y) < 0.02) w = Math.max(w, Math.abs(p[0]));
      prof.push(r3(w));
    }
  }
  const sec = z => { const s = CW.sectionAtZ(z); return { top: r3(s.cy + s.bT), waist: r3(s.cy + s.yw), bot: r3(s.cy - s.bB), halfW: r3(s.a) }; };
  const E = W.CAGE_ENG, env = E && E.resolved && E.resolved.env;
  const ax = CW.axisXY();
  console.log(JSON.stringify({ build: f.split('/').pop(), mount, engine: E && E.name,
    face: face && { halfW: r3(face.halfW), halfH: r3(face.halfH) },
    fuselageHalfWidthAt: '-1,-.75,-.5,-.25,0,.25,.5,.75,1 x halfH: ' + prof.join(' '),
    rows: { aftW: r3(P.cw_aftW), aftH: r3(P.cw_aftH), taperW: P.cw_taperW, taperH: P.cw_taperH, deckH: P.cw_deckH, keelH: P.cw_keelH, waist: P.cw_waist,
            lidRise: P.cw_lidRise, faceRise: P.cw_faceRise, cowlLen: P.cw_cowlLen, deckSweep: P.cw_deckSweep, keelSweep: P.cw_keelSweep, fitNose: P.fitNose },
    aft: sec(0.001), front: sec(+CW.P.cowlLen), thrust: r3(ax.y),
    engine: env && { halfW: r3(Math.max(-env.x0, env.x1)), up: r3(env.y1), down: r3(-env.y0), len: r3(env.length) } }));
}
