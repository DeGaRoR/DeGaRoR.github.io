#!/usr/bin/env node
// G1857 (DMG-D4c THE WALL): THE USER'S YELLOW TEST. "The Cub has a clear indication: it should be yellow, even crashed.
// If you see grey/black, it means the inside leaks to the outside." The real page on the cloud's software GPU
// (tools/soft_still.js, SOFT-GPU G1460), the user's Cub (builds/cub_2026-09-20_corrected.json), damage on, the physics
// inline (?simw=0), the live shader (?fbake=0: every section on its own material, so each can be told apart), the two
// wrecks of D4a's stills (tools/dmg_skin_stills.js, its staging verbatim): the 30 m/s trunk 2.5 m out on the left wing
// and the severe nose-in on the ground. Each camera, one moment of the physics, drawn twice - AFTER (the wall:
// skin_wall.js) and BEFORE (window.FLYDIY_SKINWALL = false: the inside on its own nodes, G1851's drawing - the branch
// base's) - and each of those twice:
//   - the PICTURE (the still, as the game draws it);
//   - the CENSUS PASS: the world hidden, the clear black, every aeroplane mesh on a flat unlit colour by what it is -
//     the fuselage covering (aeroskin's skin roles) GREEN, the other exterior skins (wing, tail, cowl: no section, an
//     exterior finish) CYAN, the INSIDE WALL (the liners, the frames, the sills, the door pads, the firewall: the wall's
//     layers) RED, the cabin furniture (the dash, the seats, the crew: D4b's GATE CLIP) BLUE, everything that is really
//     not yellow (glazing, struts, tyres, the prop, the engine, the beads) WHITE. The aeroplane's own pixels are the
//     non-black ones. The stripe and the registration are painted on the covering (green), not a part of their own, so
//     they never count;
//   - the FACE PASS: the covering alone (everything else hidden), coloured by the face the camera sees - its OUTSIDE
//     green, its inside face magenta. A red pixel of the census with the covering's OUTSIDE behind it is the inside
//     standing out through the covering: THE LEAK (red-over-outside / (green + cyan + red)). A red pixel with the
//     covering's inside face behind it, or none, is the cabin seen through a hole where the covering has gone (a torn
//     fuselage shows its inside, as a real one does): counted apart, as `hole`.
//   Also, on the picture: the share of the covering-or-inside pixels (by the census) that are not the covering's yellow
//   (hue 35-65 deg, saturation over 0.35) - the user's own eye, stripe and letters included (a constant per view).
//   node tools/dmg_wall_stills.js [--out reports/evidence/DMG-D4c] [--size 1280x720]   (tens of minutes: SwiftShader)
// Also a --stage module for soft_still.js: module.exports = async (page, { frames, shot, log }).
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D4c')));

// ---- in the page: a wreck staged and stepped (inline sim) - tools/dmg_skin_stills.js stagePage, verbatim ----
function stagePage(o) {
  const P = window.FLIGHT_PROBE, sim = P.sim(), world = P.world();
  if (sim.dmgState) return { err: 'the physics is in the worker: open with ?simw=0' };
  if (window.__skinStep) sim.step = window.__skinStep; else window.__skinStep = sim.step;
  const step = window.__skinStep;
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  sim.reset(0);
  placeAtAerodrome(sim, strip);
  const n = sim.n, p = sim.p, v = sim.v, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  for (let i = 0; i < n; i++) { p[i*3] += 60 * fx; p[i*3+2] += 60 * fz; }
  const c0 = sim.cgPos(), ground = world.terrainH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - (sim.r[i] || 0));
  if (o.kind === 'trunk') {
    for (let i = 0; i < n; i++) { p[i*3+1] += ground - yMin + o.agl; v[i*3] = o.V * fx; v[i*3+1] = 0; v[i*3+2] = o.V * fz; }
    const c = sim.cgPos(), tx = c[0] + fx * o.D - fz * o.off, tz = c[2] + fz * o.D + fx * o.off;
    world.treeHits.set('fill:skinstill', [tx, tz, ground, o.r, ground + o.h]);
    const scene = P.craft().parent;
    if (window.__skinTrunk) scene.remove(window.__skinTrunk);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r * 1.15, o.h, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
    m.position.set(tx, ground + o.h / 2, tz); m.castShadow = true; scene.add(m); window.__skinTrunk = m;
  } else {
    if (window.__skinTrunk) { P.craft().parent.remove(window.__skinTrunk); window.__skinTrunk = null; }
    world.treeHits.drop && world.treeHits.drop('fill:skinstill');
    const [xA, , zR] = sim.axes(), cg = sim.cgPos(), th = -o.pitch * Math.PI / 180, k = zR, cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const d = [p[i*3] - cg[0], p[i*3+1] - cg[1], p[i*3+2] - cg[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
      const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
      for (let j = 0; j < 3; j++) p[i*3+j] = cg[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
    }
    let y2 = Infinity; for (let i = 0; i < n; i++) y2 = Math.min(y2, p[i*3+1] - (sim.r[i] || 0));
    const hl = Math.hypot(xA[0], xA[2]);
    for (let i = 0; i < n; i++) { p[i*3+1] += ground + 0.3 - y2; v[i*3] = -o.V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -o.V * xA[2] / hl; }
  }
  sim.ctl.thr = 0;
  const t0 = performance.now();
  let s = 0;
  for (; s < o.steps; s++) { step(1 / 60); if (sim.damage().over && s > 60) break; }
  sim.step = () => {};
  const D = sim.damage();
  return { ms: Math.round(performance.now() - t0), steps: s, over: !!D.over, crashed: D.crashed, reason: D.reason, broken: D.broken.length,
           groups: (D.groups || []).map(g => g.key), brokeUp: !!D.brokeUp, cg: sim.cgPos().map(x => +x.toFixed(2)) };
}

// ---- in the page: the census pass on (flat colours by class, the world hidden) or off (everything put back) ----
function censusPass(on) {
  const P = window.FLIGHT_PROBE, md = P.model(), craft = P.craft(), scene = craft.parent, r = window.FLYDIY_RENDERER;
  if (on === 2) {
    // the covering alone, by the face the camera sees: its OUTSIDE green, its inside face magenta (the rest hidden)
    const S = window.__census, fm = new THREE.ShaderMaterial({ side: THREE.DoubleSide, toneMapped: false, fog: false,
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = gl_FrontFacing ? vec4(0.0, 1.0, 0.0, 1.0) : vec4(1.0, 0.0, 1.0, 1.0); }' });
    S.hid = [];
    for (const [o] of S.mats) { if (S.cls.get(o) === 'cover' || S.cls.get(o) === 'skin') o.material = fm; else if (o.visible) { o.visible = false; S.hid.push(o); } }
    return true;
  }
  if (on) {
    const A = window.AEROSKIN, SWL = window.SKIN_WALL, names = new Map();
    for (const nm in md.meshes) { const m = md.meshes[nm]; if (!m) continue; if (!names.has(m)) names.set(m, []); names.get(m).push(nm); }
    const COL = { cover: 0x00ff00, skin: 0x00ffff, wall: 0xff0000, furn: 0x0000ff, other: 0xffffff };
    const mats = {}; for (const k in COL) mats[k] = new THREE.MeshBasicMaterial({ color: COL[k], side: THREE.DoubleSide, toneMapped: false, fog: false });
    const classOf = (o) => {
      const L = names.get(o) || (o.userData && o.userData.still) || null;
      const nm = L && L[0]; const rec = nm && md.mats ? md.mats[nm] : null;
      if (!rec) return 'other';
      if (rec.char || rec.panel || rec.lamp || rec.lampCup || rec.ves) return rec.char ? 'furn' : 'other';
      if (rec.sec) {
        if (SWL.isOuter(rec.sec, A)) return 'cover';
        if (SWL.isWall(rec.sec, A)) return 'wall';
        if (rec.inside) return 'furn';
        return 'other';
      }
      if (rec.inside) return 'furn';
      if (rec.fin === 'glass' || rec.opacity < 1 || rec.spin || rec.propMat) return 'other';
      if (rec.fin && /^(fabric|ply|alclad|composite)$/.test(rec.fin)) return 'skin';
      return 'other';
    };
    const S = window.__census = { mats: [], vis: [], bg: scene.background, fog: scene.fog, clr: new THREE.Color(), alpha: r.getClearAlpha(), n: {}, cls: new Map(), hid: [] };
    r.getClearColor(S.clr);
    craft.traverse(o => { if (!o.isMesh && !o.isSkinnedMesh) return; const c = classOf(o); S.cls.set(o, c); S.n[c] = (S.n[c] || 0) + 1; S.mats.push([o, o.material]); o.material = mats[c]; });
    for (const ch of scene.children) if (ch !== craft && ch.visible && !ch.isLight) { S.vis.push(ch); ch.visible = false; }
    scene.background = null; scene.fog = null; r.setClearColor(0x000000, 1);
    return S.n;
  }
  const S = window.__census; if (!S) return null;
  for (const [o, m] of S.mats) o.material = m;
  for (const o of S.hid) o.visible = true;
  for (const ch of S.vis) ch.visible = true;
  scene.background = S.bg; scene.fog = S.fog; r.setClearColor(S.clr, S.alpha);
  window.__census = null;
  return true;
}

// the two PNGs (the picture and its census pass) counted in a blank page
async function count(page, pic, ids, face) {
  const p = await page.context().browser().newPage();
  try {
    return await p.evaluate(async ([A, B, F]) => {
      const px = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const x = await px(A), y = await px(B), f = await px(F), n = x.length / 4;
      const K = { cover: [0, 255, 0], skin: [0, 255, 255], wall: [255, 0, 0], furn: [0, 0, 255], other: [255, 255, 255] };
      const c = { cover: 0, skin: 0, wall: 0, furn: 0, other: 0, edge: 0, aero: 0, outerPix: 0, notYellow: 0, wallOut: 0, wallHole: 0, furnOut: 0 };
      for (let i = 0; i < n; i++) {
        const r = y[4 * i], g = y[4 * i + 1], b = y[4 * i + 2];
        if (r + g + b < 30) continue;                     // the clear: not the aeroplane
        c.aero++;
        let best = null, bd = 60;
        for (const k in K) { const d = Math.abs(r - K[k][0]) + Math.abs(g - K[k][1]) + Math.abs(b - K[k][2]); if (d < bd) { bd = d; best = k; } }
        if (!best) { c.edge++; continue; }                // a blended edge pixel: neither
        c[best]++;
        // behind an inside pixel: the covering's OUTSIDE face (the inside stands out through the covering: a LEAK), or
        // its inside face / nothing (the interior seen through a hole where the covering is gone)
        if (best === 'wall' || best === 'furn') {
          const fr = f[4 * i], fg = f[4 * i + 1], fb = f[4 * i + 2], front = fg > 160 && fr < 100 && fb < 100;
          if (best === 'wall') { if (front) c.wallOut++; else c.wallHole++; } else if (front) c.furnOut++;
        }
        if (best === 'cover' || best === 'skin' || best === 'wall') {
          // the picture's own colour there: the covering's yellow? (hue 35-65 deg, saturation > 0.35, value > 0.2)
          c.outerPix++;
          const R = x[4 * i] / 255, G = x[4 * i + 1] / 255, Bb = x[4 * i + 2] / 255, mx = Math.max(R, G, Bb), mn = Math.min(R, G, Bb), dl = mx - mn;
          let h = 0; if (dl > 0) { if (mx === R) h = 60 * (((G - Bb) / dl) % 6); else if (mx === G) h = 60 * ((Bb - R) / dl + 2); else h = 60 * ((R - G) / dl + 4); }
          if (h < 0) h += 360;
          const sat = mx > 0 ? dl / mx : 0;
          if (!(h >= 35 && h <= 65 && sat > 0.35 && mx > 0.2)) c.notYellow++;
        }
      }
      const outer = c.cover + c.skin + c.wall;
      c.leak = outer ? c.wallOut / outer : 0;             // THE LEAK: the inside wall standing out through the covering, over what the outside shows
      c.hole = outer ? c.wallHole / outer : 0;            // the interior seen through holes (the covering gone there)
      c.inside = outer ? c.wall / outer : 0;              // every inside-wall pixel, either way
      c.furnLeak = outer ? c.furnOut / outer : 0;         // the furniture out through the covering (D4b's GATE CLIP)
      c.notYellowShare = c.outerPix ? c.notYellow / c.outerPix : 0;
      return c;
    }, [pic.toString('base64'), ids.toString('base64'), face.toString('base64')]);
  } finally { await p.close(); }
}

async function stage(page, { frames, shot, log }) {
  const R = { shots: [] };
  const scenes = [
    { id: 'wing', label: 'the trunk 2.5 m out on the left wing (30 m/s, 4 m up)', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 2.5, r: 0.3, h: 10, steps: 420 },
      cams: [[200, 22, 16], [250, 55, 26], [20, 18, 14]] },
    { id: 'nosein', label: 'the severe nose-in on the ground (180 km/h, 10 m/s, 60 deg nose-down)', o: { kind: 'ground', V: 50, sink: 10, pitch: 60, steps: 360 },
      cams: [[150, 20, 12], [235, 28, 14], [330, 35, 12]] },
  ];
  for (const sc of scenes) {
    const st = await page.evaluate(stagePage, sc.o);
    log('staged', sc.id, JSON.stringify(st));
    if (st.err) { R.err = st.err; return R; }
    await page.evaluate(() => { window.FLYDIY_SKINWALL = true; });
    await frames(3);
    for (let ci = 0; ci < sc.cams.length; ci++) {
      const [az, el, dist] = sc.cams[ci];
      await page.evaluate(([a, e, d]) => FLIGHT_PROBE.camSet(a * Math.PI / 180, e * Math.PI / 180, d), [az, el, dist]);
      for (const on of [true, false]) {
        await page.evaluate(x => { window.FLYDIY_SKINWALL = x; }, on);
        await frames(3);
        const stats = await page.evaluate(() => ({ skin: window.FLYDIY_SKINBREAK_STATS ? FLYDIY_SKINBREAK_STATS() : null,
          wall: (() => { const m = FLIGHT_PROBE.model(), W = m && m.brk && m.brk.wall; return W && !W.none ? { bound: W.bound, unbound: W.unbound, posed: W.posed, events: W.events || 0 } : null; })() }));
        const base = sc.id + '_' + (ci + 1) + '_' + (on ? 'after' : 'before');
        const A = await shot(path.join(OUT, base + '.jpg'));
        const pic = await page.screenshot({ type: 'png' });
        const cls = await page.evaluate(censusPass, true);
        await frames(2);
        const ids = await page.screenshot({ type: 'png' });
        fs.writeFileSync(path.join(OUT, base + '_census.png'), ids);
        await page.evaluate(censusPass, 2);
        await frames(2);
        const face = await page.screenshot({ type: 'png' });
        fs.writeFileSync(path.join(OUT, base + '_face.png'), face);
        await page.evaluate(censusPass, false);
        const C = await count(page, pic, ids, face);
        log('census', base, JSON.stringify(C));
        R.shots.push({ scene: sc.id, label: sc.label, cam: [az, el, dist], wall: on, file: path.relative(path.join(__dirname, '..'), path.join(OUT, base + '.jpg')),
                       census: C, classes: cls, stats, picture: A, physics: st });
      }
    }
    await page.evaluate(() => { window.FLYDIY_SKINWALL = true; });
  }
  R.skipMain = true;
  return R;
}
module.exports = stage;

if (require.main === module) {
  const S = require('./soft_still.js');
  const size = opt('size', '1280x720').split('x').map(Number);
  const o = Object.assign(S.parse(), { build: path.join(__dirname, '..', 'builds', 'cub_2026-09-20_corrected.json'), q: 'damage=1&simw=0&fog=0&fbake=0', size,
    stage: __filename, out: path.join(OUT, 'stand.jpg'), secs: +opt('secs', 7200), day: 'noon', page: opt('page', 'index.html') });
  fs.mkdirSync(OUT, { recursive: true });
  S.still(o).then(R => {
    fs.writeFileSync(path.join(OUT, 'stills.json'), JSON.stringify(R, null, 1));
    const rows = (R.stage && R.stage.shots || []).map(s => [s.scene, s.cam.join(','), s.wall ? 'after' : 'before', s.census && +(s.census.leak * 100).toFixed(3), s.census && +(s.census.hole * 100).toFixed(2), s.census && +(s.census.notYellowShare * 100).toFixed(2)]);
    console.log('WALL_STILLS ' + JSON.stringify({ rows, errors: R.errors, err: R.stage && R.stage.err, t: R.t }));
    process.exit(R.stage && !R.stage.err ? 0 : 1);
  }, e => { console.log('WALL_STILLS_FAIL ' + (e && e.stack || e)); process.exit(1); });
}
