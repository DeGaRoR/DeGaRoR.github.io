#!/usr/bin/env node
// dmg_glass_stills.js - G3623 (DMG-GLASS): THE COCKPIT STILLS OF A GLASS MARK, FROM A CLOUD SESSION (tools/soft_still.js:
// the real page on SwiftShader). A0's page run, 28 Oct: "FLYDIY_GLASS_TEST(1) and (0.3) DO return a mark at the
// windscreen's middle, but NOTHING shows in the cockpit view". Per build, at the stand, the cockpit camera:
//   FACES   each flown pane (aeroFinish 'glass'): its side, one pass or two, its triangles facing the eye or away (the
//           flown panes are single sheets wound outward: from the seat all of them face away - a FrontSide pane, and a
//           crack on it, was never drawn there);
//   PLACE   FLYDIY_GLASS_TEST(1)'s point on the screen (craft -> world through uCraftInv's inverse, then the camera);
//   NOISE   two frames with no mark, inside a 300 px crop round that point (the live scene moves a little);
//   MARK    FLYDIY_GLASS_TEST(1), then (0.3): the crop against the no-mark frame - pixels brighter / darker by 24+ codes;
//   CLEARED FLYDIY_GLASS_TEST(null): the crop against the no-mark frame again.
// Writes <out>/<build>_{none,mark1,mark03}.jpg (the whole view), <build>_{none,mark1,mark03,cleared}_crop.png, and a
// line DMG_GLASS_STILLS {json} per build.
//   node tools/dmg_glass_stills.js [--builds cub,metal] [--out <dir>] [--page dev.html] [--at view]
// (--at view: the mark on the glazing's point nearest the middle of the view - FLYDIY_GLASS_TEST(sev, 'view') - not the
// windscreen's middle, which the metal Cessna's left seat sees only at its top right edge)
// (dev.html is the parts: run node tools/build.js first if the manifest moved. Slow: ~20 min a build on SwiftShader.)
// As a soft_still.js --stage module (what the driver passes it): module.exports, GS_OUT / GS_TAG from the environment.
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const BUILDS = { cub: null, jodel: 'builds/jodel_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };

module.exports = async (page, { frames, shot, log }) => {
  const OUT = process.env.GS_OUT || '.', TAG = process.env.GS_TAG || 'x', AT = process.env.GS_AT || null;   // (null: the windscreen's middle)
  const faces = await page.evaluate(() => {
    const P = window.FLIGHT_PROBE, M = P.model(), cam = P.camera(), e = cam.getWorldPosition(new THREE.Vector3()), out = [];
    M.grp.updateMatrixWorld(true);
    M.grp.traverse(o => {
      if (!o.isMesh) return; const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || !m.userData || m.userData.aeroFinish !== 'glass') return;
      const g = o.geometry, Pa = g.attributes.position, ix = g.index, n = ix ? ix.count / 3 : Pa.count / 3;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3(), ctr = new THREE.Vector3();
      let front = 0, back = 0; const scr = !!(m.userData.aeroU && m.userData.aeroU.uGlass && m.userData.aeroU.uGlass.value.y > 0.5);
      for (let t = 0; t < n; t++) {
        const i0 = ix ? ix.getX(t * 3) : t * 3, i1 = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, i2 = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(Pa, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(Pa, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(Pa, i2).applyMatrix4(o.matrixWorld);
        nn.subVectors(b, a).cross(c.clone().sub(a)); ctr.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        if (nn.dot(e.clone().sub(ctr)) > 0) front++; else back++;
      }
      out.push({ screen: scr, side: m.side, single: !!m.forceSinglePass, tris: n, facingEye: front, awayFromEye: back });
    });
    return { mode: P.camModeNow(), panes: out };
  });
  log('FACES ' + JSON.stringify(faces));
  // the mark's place on the screen
  const place = await page.evaluate(at => {
    const r = window.FLYDIY_GLASS_TEST(1, at); window.FLYDIY_GLASS_TEST(null); if (!r) return null;
    const U = AEROSKIN.aeroSharedU(THREE), cam = window.FLIGHT_PROBE.camera(), inv = U.uCraftInv.value.clone().invert();
    const s = new THREE.Vector3(r.p[0], r.p[1], r.p[2]).applyMatrix4(inv).project(cam), cv = window.FLYDIY_RENDERER.domElement, W = cv.clientWidth, H = cv.clientHeight;
    return { r, sx: Math.round((s.x + 1) / 2 * W), sy: Math.round((1 - s.y) / 2 * H), W, H, onScreen: Math.abs(s.x) < 1 && Math.abs(s.y) < 1 && s.z < 1 };
  }, AT);
  log('PLACE ' + JSON.stringify(place));
  if (!place) return { skipMain: true, err: 'no mark (FLYDIY_GLASS_TEST null: is dmg_glass.js in the page?)' };
  const C = 150, x0 = Math.max(0, Math.min(place.W - 2 * C, place.sx - C)), y0 = Math.max(0, Math.min(place.H - 2 * C, place.sy - C)), clip = { x: x0, y: y0, width: 2 * C, height: 2 * C };
  const diff = (a, b) => page.evaluate(async ([a, b]) => {
    const ld = u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const A = await ld(a), B = await ld(b), c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const x = c.getContext('2d');
    x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data; x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
    let ch = 0, br = 0, dk = 0;
    for (let i = 0; i < da.length; i += 4) { const la = da[i] + da[i + 1] + da[i + 2], lb = db[i] + db[i + 1] + db[i + 2]; if (Math.abs(la - lb) > 6) ch++; if (lb > la + 24) br++; if (lb < la - 24) dk++; }
    return { ch, br, dk, px: da.length / 4 };
  }, ['data:image/png;base64,' + a.toString('base64'), 'data:image/png;base64,' + b.toString('base64')]);
  const crop = async name => { const b = await page.screenshot({ type: 'png', clip }); fs.writeFileSync(path.join(OUT, TAG + '_' + name + '_crop.png'), b); return b; };
  await frames(2); await crop('none'); await shot(path.join(OUT, TAG + '_none.jpg'));
  await frames(3); const base = await page.screenshot({ type: 'png', clip });
  const c0 = fs.readFileSync(path.join(OUT, TAG + '_none_crop.png'));
  const res = { faces, place, noise: await diff(c0, base) };
  log('NOISE ' + JSON.stringify(res.noise));
  for (const sev of [1, 0.3]) {
    const k = String(sev).replace('.', '');
    await page.evaluate(([s, at]) => window.FLYDIY_GLASS_TEST(s, at), [sev, AT]); await frames(3);
    const c1 = await crop('mark' + k); await shot(path.join(OUT, TAG + '_mark' + k + '.jpg'));
    res['m' + k] = await diff(base, c1); log('MARK ' + sev + ' ' + JSON.stringify(res['m' + k]));
  }
  await page.evaluate(() => window.FLYDIY_GLASS_TEST(null)); await frames(3);
  res.cleared = await diff(base, await crop('cleared')); log('CLEARED ' + JSON.stringify(res.cleared));
  return { skipMain: true, res };
};

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const out = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'dmg-glass'))); fs.mkdirSync(out, { recursive: true });
  for (const b of opt('builds', 'cub,metal').split(',')) {
    const a = [path.join(__dirname, 'soft_still.js'), '--page', opt('page', 'dev.html'), '--place', 'stand', '--cam', 'cockpit', '--size', '960x540', '--secs', '2300',
      '--stage', __filename, '--out', path.join(out, b + '_main.jpg')].concat(BUILDS[b] ? ['--build', BUILDS[b]] : []);
    const r = cp.spawnSync(process.execPath, a, { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { GS_OUT: out, GS_TAG: b + (opt('at', null) ? '_' + opt('at') : ''), GS_AT: opt('at', '') }), encoding: 'utf8', maxBuffer: 1 << 26 });
    const lines = (r.stdout || '').split('\n'), pick = k => lines.filter(l => l.includes(k + ' ')).map(l => l.slice(l.indexOf(k + ' ') + k.length + 1));
    console.log('DMG_GLASS_STILLS ' + JSON.stringify({ build: b, exit: r.status, faces: pick('FACES')[0], place: pick('PLACE')[0], noise: pick('NOISE')[0], mark: pick('MARK'), cleared: pick('CLEARED')[0] }));
    if (r.status !== 0) console.log((r.stdout || '').slice(-1500) + (r.stderr || '').slice(-1500));
  }
}
