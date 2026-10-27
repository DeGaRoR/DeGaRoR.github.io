#!/usr/bin/env node
// DMG-LOOKS: THE BEFORE / AFTER STILLS IN THE REAL GAME, FROM A CLOUD SESSION (no GPU: tools/soft_still.js, SwiftShader).
// The real page, ?damage=1&simw=0 (the crash stepped in the page: the solver the worker runs), one validated build per
// boot, each crash staged as the gates stage it (tools/dmg_skin_stills.js's staging: the trunk is the physics' own,
// drawn as a brown cylinder), stepped until the wreck is at rest, FROZEN, then shot from fixed cameras:
//   BEFORE   the page as it is (master's look)
//   AFTER    the same frozen frame after `--after "<js>"` runs in the page (Deform's switch, e.g.
//            --after "window.FLYDIY_DMGLOOKS = true"), then a few frames; a URL-switch is a second run: --q 'looks=1' --tag after
// so the two stills of a pair are the same physics from the same camera. Then a side-by-side sheet per build.
//   node futureDesigns/dmg-looks/looks_stills.js --build cub|jodel|metal [--scenes trunk0,trunk25,noseover]
//        [--after "<js>"] [--q 'k=v'] [--tag before|after] [--size 1280x720] [--secs 7200]
//   node futureDesigns/dmg-looks/looks_stills.js --sheet cub      (pairs what is on disk into stills/<build>_sheet.png)
// Writes futureDesigns/dmg-looks/stills/<build>_<scene>_<cam>_<tag>.jpg and <build>_<tag>.json. Slow: a software GL
// (a boot is 10-20 min, a frame seconds) - never read a frame time off it.
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = path.join(__dirname, 'stills');
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };
const SCENES = {
  trunk0: { label: '30 m/s into a trunk, the centreline, 4 m up', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 0, r: 0.3, h: 10, steps: 1200 }, cams: [[200, 32, 14], [120, 26, 9], [300, 60, 18]] },
  trunk25: { label: '30 m/s, the trunk 2.5 m out on the left wing', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 2.5, r: 0.3, h: 10, steps: 1200 }, cams: [[200, 32, 16], [250, 60, 26]] },
  noseover: { label: '12 m/s on the ground into a 35 cm stump', o: { kind: 'trunk', D: 12, agl: 0, V: 12, off: 0, r: 0.25, h: 0.35, steps: 900 }, cams: [[200, 30, 9], [90, 26, 7]] },
};

// ---- in the page: a wreck staged and stepped (inline sim), then frozen (tools/dmg_skin_stills.js stagePage) ----
function stagePage(o) {
  const P = window.FLIGHT_PROBE, sim = P.sim(), world = P.world();
  if (sim.dmgState) return { err: 'the physics is in the worker: open with ?simw=0' };
  if (window.__lkStep) sim.step = window.__lkStep; else window.__lkStep = sim.step;
  const step = window.__lkStep;
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  // A CONTROLLED SCENE, the same for BEFORE and AFTER: the world's own trees out of the physics (only the staged trunk
  // is hit - the gates' flat-world crashes) and out of the picture (every instanced vegetation mesh outside the
  // aeroplane hidden; the cover ring is off by ?cover=0). The first runs' wrecks fell into the island's trees.
  if (world.treeHits && world.treeHits.keys) for (const k of world.treeHits.keys()) if (k !== 'fill:looks') world.treeHits.drop(k);
  { const craft = P.craft(), under = o => { for (let q = o; q; q = q.parent) if (q === craft) return true; return false; }; let hid = 0;
    craft.parent.traverse(m => { if (m.isInstancedMesh && m.visible && !under(m)) { m.visible = false; hid++; } }); window.__lkHid = hid; }
  sim.reset(0);
  placeAtAerodrome(sim, strip);
  const n = sim.n, p = sim.p, v = sim.v, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  // 250 m down the runway: the paved strip is clear of trees and the pylon (the first runs' wrecks ended under the
  // world's own trees, 60 m in, where no camera could see them)
  const SL = strip.len || strip.length || strip.L || 600, AT = o.at != null ? o.at : Math.min(120, 0.45 * SL);
  for (let i = 0; i < n; i++) { p[i*3] += AT * fx; p[i*3+2] += AT * fz; }
  const c0 = sim.cgPos(), ground = world.terrainH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - (sim.r[i] || 0));
  for (let i = 0; i < n; i++) { p[i*3+1] += ground - yMin + o.agl; v[i*3] = o.V * fx; v[i*3+1] = 0; v[i*3+2] = o.V * fz; }
  const c = sim.cgPos(), tx = c[0] + fx * o.D - fz * o.off, tz = c[2] + fz * o.D + fx * o.off;
  world.treeHits.set('fill:looks', [tx, tz, ground, o.r, ground + o.h]);
  const scene = P.craft().parent;
  if (window.__lkTrunk) scene.remove(window.__lkTrunk);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r * 1.15, o.h, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
  m.position.set(tx, ground + o.h / 2, tz); m.castShadow = true; scene.add(m); window.__lkTrunk = m;
  sim.ctl.thr = 0;
  const t0 = performance.now(); let s = 0;
  // stepped until the wreck and its pieces are at rest on the ground (every node under 0.25 m/s for a second), at most o.steps
  let calm = 0;
  for (; s < o.steps; s++) { step(1 / 60); let vm = 0; for (let i = 0; i < n; i++) vm = Math.max(vm, Math.hypot(v[i*3], v[i*3+1], v[i*3+2]));
    calm = vm < 0.25 ? calm + 1 : 0; if (calm > 60) break; }
  sim.step = () => {};
  const D = sim.damage();
  // THE WRECK'S SPREAD: the 10th-90th percentile box of every node (pieces and all), for the cameras
  const q = (arr, f) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor((a.length - 1) * f)]; };
  const xs = [], ys = [], zs = []; for (let i = 0; i < n; i++) { xs.push(p[i*3]); ys.push(p[i*3+1]); zs.push(p[i*3+2]); }
  const lo = [q(xs, 0.1), q(ys, 0.1), q(zs, 0.1)], hi = [q(xs, 0.9), q(ys, 0.9), q(zs, 0.9)];
  const centre = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], radius = Math.max(2.5, 0.5 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]));
  return { centre, radius, hdg: strip.hdg, at: AT, stripLen: SL, hiddenVeg: window.__lkHid, ms: Math.round(performance.now() - t0), steps: s, atRest: calm > 60, crashed: D.crashed, reason: D.reason, broken: D.broken.length, cg: sim.cgPos().map(x => +x.toFixed(2)) };
}

function stageFor(build, scenes, after, tag) {
  return async (page, { frames, shot, log }) => {
    const R = { build, shots: [] };
    for (const id of scenes) {
      const sc = SCENES[id]; if (!sc) continue;
      const st = await page.evaluate(stagePage, sc.o);
      log('staged', build, id, JSON.stringify(st));
      if (st.err) { R.err = st.err; return R; }
      await frames(3);                                         // the page's frames carry the wreck (the events, the riding)
      for (let ci = 0; ci < sc.cams.length; ci++) {
        const [az, el, dist] = sc.cams[ci];
        // a free camera aimed at the wreck's spread: az from the runway heading (comparable across builds), the distance
        // at least the camera's and enough to fit the spread (~2.2 x its radius for the page's ~50 deg field)
        await page.evaluate(([a, e, d, st]) => {
          const C = st.centre, D = Math.max(d, 2.2 * st.radius), A = st.hdg + Math.PI + a * Math.PI / 180, E = e * Math.PI / 180;
          const eye = [C[0] + D * Math.cos(E) * Math.cos(A), C[1] + D * Math.sin(E), C[2] + D * Math.cos(E) * Math.sin(A)];
          const dx = C[0] - eye[0], dy = C[1] - eye[1], dz = C[2] - eye[2];
          return FLIGHT_PROBE.devFree(eye[0], eye[1], eye[2], Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
        }, [az, el, dist, st]);
        const sets = after ? [[tag, null], ['after', after]] : [[tag, null]];
        for (const [t, js] of sets) {
          if (js) { await page.evaluate(new Function(js)); await frames(3); } else await frames(2);
          const info = await page.evaluate(() => { const r = window.FLIGHT_PROBE && FLIGHT_PROBE.renderer && FLIGHT_PROBE.renderer(); return r && r.info ? { calls: r.info.render.calls, tris: r.info.render.triangles } : null; });
          const file = path.join(OUT, build + '_' + id + '_' + (ci + 1) + '_' + t + '.jpg');
          const A = await shot(file);
          R.shots.push({ scene: id, label: sc.label, cam: [az, el, dist], tag: t, file: path.relative(ROOT, file), picture: A, info, physics: st });
        }
        if (after) { /* the next camera starts from the BEFORE look again only if the switch can be undone: left on */ }
      }
    }
    R.skipMain = true;
    return R;
  };
}

async function sheet(build) {
  // pairs on disk -> one PNG: rows = scene x camera, cols = before | after (or before alone)
  const files = fs.readdirSync(OUT).filter(f => f.startsWith(build + '_') && f.endsWith('.jpg'));
  const keys = [...new Set(files.map(f => f.replace(/_(before|after)\.jpg$/, '')))].sort();
  if (!keys.length) { console.log('no stills for', build); return; }
  const W = 640, H = 360, rows = keys.map(k => [k, ['before', 'after'].map(t => files.includes(k + '_' + t + '.jpg') ? path.join(OUT, k + '_' + t + '.jpg') : null)]);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * W + 30 + 160}" height="${40 + rows.length * (H + 10)}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#1b1d21"/>`;
  svg += `<text x="170" y="26" fill="#ddd" font-size="16">before (master)</text><text x="${170 + W + 10}" y="26" fill="#ddd" font-size="16">after (DMG-LOOKS)</text>`;
  rows.forEach(([k, pr], j) => { const y = 36 + j * (H + 10); svg += `<text x="10" y="${y + 20}" fill="#bbb" font-size="13">${k.replace(build + '_', '')}</text>`;
    pr.forEach((f, i) => { if (f) svg += `<image x="${170 + i * (W + 10)}" y="${y}" width="${W}" height="${H}" href="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}"/>`; else svg += `<rect x="${170 + i * (W + 10)}" y="${y}" width="${W}" height="${H}" fill="#26282c"/><text x="${170 + i * (W + 10) + 20}" y="${y + 30}" fill="#777" font-size="13">not shot yet</text>`; }); });
  svg += '</svg>';
  const sp = path.join(OUT, '_' + build + '_sheet.svg'); fs.writeFileSync(sp, svg);
  const pw = require('playwright'), b = await pw.chromium.launch(), pg = await b.newPage();
  await pg.setViewportSize({ width: 2 * W + 30 + 160, height: 40 + rows.length * (H + 10) }); await pg.goto('file://' + sp);
  await pg.screenshot({ path: path.join(OUT, build + '_sheet.jpg'), type: 'jpeg', quality: 82 }); await b.close(); fs.unlinkSync(sp);
  console.log('wrote', path.join(OUT, build + '_sheet.jpg'));
}

if (require.main === module) {
  if (opt('sheet', null)) { sheet(opt('sheet')).then(() => process.exit(0)); return; }
  const build = opt('build', 'cub'), scenes = opt('scenes', 'trunk0,trunk25,noseover').split(','), after = opt('after', null), tag = opt('tag', 'before');
  const S = require(path.join(ROOT, 'tools', 'soft_still.js'));
  const size = opt('size', '1280x720').split('x').map(Number);
  fs.mkdirSync(OUT, { recursive: true });
  const stageFile = path.join(require('os').tmpdir(), 'looks_stage_' + process.pid + '.js');
  // soft_still requires the stage by path: a tiny module that hands back this file's stage
  fs.writeFileSync(stageFile, `module.exports = require(${JSON.stringify(__filename)}).stageFor(${JSON.stringify(build)}, ${JSON.stringify(scenes)}, ${JSON.stringify(after)}, ${JSON.stringify(tag)});\n`);
  const q = 'damage=1&simw=0&fog=0&cover=0' + (opt('q', null) ? '&' + opt('q') : '');
  const o = Object.assign(S.parse(), { build: path.join(ROOT, BUILDS[build]), q, size, stage: stageFile, out: path.join(OUT, '_stand_' + build + '.jpg'), secs: +opt('secs', 7200), day: 'noon' });
  S.still(o).then(R => {
    try { fs.unlinkSync(stageFile); } catch (e) {}
    fs.writeFileSync(path.join(OUT, build + '_' + tag + '.json'), JSON.stringify(R, null, 1));
    console.log('LOOKS_STILLS ' + JSON.stringify({ shots: (R.stage && R.stage.shots || []).map(s => s.file), errors: R.errors, err: R.stage && R.stage.err, t: R.t }));
    process.exit(R.stage && !R.stage.err ? 0 : 1);
  }, e => { console.log('LOOKS_STILLS_FAIL ' + (e && e.stack || e)); process.exit(1); });
}
module.exports = { stageFor, SCENES, BUILDS, sheet };
