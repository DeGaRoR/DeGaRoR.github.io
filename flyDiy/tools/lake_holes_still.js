#!/usr/bin/env node
// lake_holes_still.js - THE LAKES' CONSTRUCTION, PICTURED (LAKE-HOLES G1339). Two worlds composed in node on Jolene with
// its premises - BEFORE (a tree of the base: --before <its flyDiy dir>) and AFTER (this tree) - and for each view the
// ground the near ring draws there (its own 17.6 m grid, `INNER` 4500 / 512, the heights off each world's terrainH: the
// fine disc of 5 m tiles within 700 m of the eye, geomorphed to the ring at its rim - BEFORE's took the ring's shape within
// 30 m of a lake, render_world FINE.build) with the lake field the ground shader
// reads (the renderer's own copy, lakeR, lifted from each tree's render_world.js) and each lake's quad at the level that
// tree draws it (lakeY, lifted). The ground program of BEFORE discards a metre inside the field, as every island ground
// program did (`lsd > 1.0`); AFTER's does not. Drawn in headless Chromium (SwiftShader) by a reduced renderer: the
// island's tint, one sun, the water's field fade and column - NOT the game's shading - a sky dome over the horizon and a RED
// clear colour under it, so that any red below the horizon is a hole through the ground (counted: `holes`, stills.json). The game's own pictures are tools/lake_holes_shot.js's (a GPU box).
//
//   node tools/_serve.js 8125 &   node tools/lake_holes_still.js --before <dir of the base's flyDiy> --out reports/evidence/LAKE-HOLES
//        [--views far,near,air,far2] [--w 960 --h 540] [--q 82] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const BEFORE = opt('before', null), OUT = opt('out', 'reports/evidence/LAKE-HOLES');
const VW = +opt('w', 960), VH = +opt('h', 540), Q = +opt('q', 82), PORT = +opt('port', 8125);
// [eye x, eye height over the lake's level (or the ground, `agl`), eye z] -> [look-at x, height over the level, z]; the window drawn
const VIEWS = {
  far:  { eye: [-410, 1.8, -550], at: [-150, 2.0, -480], lake: [-289, -526], R: 900, label: 'a far shore from the water, eye 1.8 m over it' },
  near: { eye: [-300, 1.8, -485], at: [-300, 1.0, -435], lake: [-289, -526], R: 600, label: 'a near shore, 40 m off' },
  air:  { eye: [-700, 220, -200], at: [-280, 0, -540], lake: [-289, -526], R: 1400, agl: true, label: 'from the air, 220 m' },
  far2: { eye: [-1500, 1.8, -330], at: [-1430, 3.0, -60], lake: [-1454, -216], R: 900, label: 'another lake\'s far shore (-1454, -216)' },
};
const names = opt('views', Object.keys(VIEWS).join(',')).split(',');
const INNER = 4500, SEG = 2 * INNER / 512;
const lift = (src, a, b) => { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error('lift: ' + a.slice(0, 50)); return src.slice(i, j); };

function tree(dir) {
  // a fresh require of each tree's core (flight_core.js defines globals; a child process per tree keeps them apart)
  const { execFileSync } = require('child_process');
  const js = `
    const path = require('path'), fs = require('fs'); const DIR = ${JSON.stringify(dir)};
    require(path.join(DIR, 'tools', 'flight_core.js'));
    const W = require(path.join(DIR, 'tools', 'island_node.js')).islandWorld('jolene', { premises: fs.readFileSync(path.join(DIR, 'tools', 'fixtures', 'island_jolene.json'), 'utf8') });
    const RW = fs.readFileSync(path.join(DIR, 'src', 'viewer', 'render_world.js'), 'utf8');
    const lift = ${lift.toString()};
    const blkR = lift(RW, '    const lakeR = (() => {', '    let islandTex = null');
    const blkY = lift(RW, '          const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, qx = (L.x1 - L.x0) / 4, qz = (L.z1 - L.z0) / 4;', '          g.translate(cx, lakeY, cz);');
    const blkS = lift(RW, '        const lakeTexels = L => {', '        let filled = 0;');
    const env = new Function('ISLA', 'world', 'console', blkR + '\\n' + blkS + '\\nreturn { lakeR, lakeRsd, lakeTexels, isSea };')(W.island, W, { log() {} });
    const lakeYOf = new Function('world', 'L', blkY + '\\nreturn lakeY;').bind(null, W);
    const OLD_BLEND = RW.includes('sm(-30, -6, lakeSD(x, z))');
    const views = ${JSON.stringify(VIEWS)}, names = ${JSON.stringify(names)}, SEG = ${SEG}, INNER = ${INNER};
    const out = {};
    for (const n of names) { const V = views[n];
      const L = W.island.lakes.find(L => Math.hypot((L.x0 + L.x1) / 2 - V.lake[0], (L.z0 + L.z1) / 2 - V.lake[1]) < 20);
      const y = lakeYOf(L);
      // the ring's grid over the window round the lake (the ring's own vertices: -INNER + k SEG)
      const c = V.lake, k0 = Math.floor((c[0] - V.R + INNER) / SEG), k1 = Math.ceil((c[0] + V.R + INNER) / SEG), m0 = Math.floor((c[1] - V.R + INNER) / SEG), m1 = Math.ceil((c[1] + V.R + INNER) / SEG);
      const nx = k1 - k0 + 1, nz = m1 - m0 + 1, H = [], T = [];
      const G = W.island.grid;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = -INNER + (k0 + i) * SEG, z = -INNER + (m0 + j) * SEG; H.push(+W.terrainH(x, z).toFixed(3));
        const gi = Math.max(0, Math.min(G.w - 1, Math.floor((x - G.x0) / G.cell))), gj = Math.max(0, Math.min(G.h - 1, Math.floor((z - G.z0) / G.cell))), q = (gj * G.w + gi) * 3;
        T.push(W.island.tint[q], W.island.tint[q + 1], W.island.tint[q + 2]); }
      // THE FINE DISC (render_world FINE): 5 m vertices within FR of the eye, geomorphed to the ring's own triangles over the
      // last FB metres; BEFORE's tiles blended to the ring's shape within 30 m of a lake (lk), AFTER's are the surface itself
      const e0 = V.eye, FR = 700, FB = 120, ST = 5, RW = nx;
      const ringY = (i, j) => H[Math.max(0, Math.min(nz - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
      const coarseAt = (x, z) => { const gx = (x - (-INNER + k0 * SEG)) / SEG, gz = (z - (-INNER + m0 * SEG)) / SEG, ix = Math.floor(gx), iz = Math.floor(gz), fu = gx - ix, fv = gz - iz;
        const a = ringY(ix, iz), b = ringY(ix, iz + 1), cc = ringY(ix + 1, iz + 1), d = ringY(ix + 1, iz);
        return fu + fv <= 1 ? (1 - fu - fv) * a + fv * b + fu * d : (fu + fv - 1) * cc + (1 - fu) * b + (1 - fv) * d; };
      const smf = (lo, hi, v) => { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); return t * t * (3 - 2 * t); };
      const fx0 = Math.max(-INNER + k0 * SEG, Math.floor((e0[0] - FR - 10) / ST) * ST), fx1 = Math.min(-INNER + k1 * SEG, Math.ceil((e0[0] + FR + 10) / ST) * ST);
      const fz0 = Math.max(-INNER + m0 * SEG, Math.floor((e0[2] - FR - 10) / ST) * ST), fz1 = Math.min(-INNER + m1 * SEG, Math.ceil((e0[2] + FR + 10) / ST) * ST);
      const fnx = Math.round((fx1 - fx0) / ST) + 1, fnz = Math.round((fz1 - fz0) / ST) + 1, FH = [], FT = [];
      for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) { const x = fx0 + i * ST, z = fz0 + j * ST, h = W.terrainH(x, z), co = coarseAt(x, z);
        const lk = OLD_BLEND ? smf(-30, -6, env.lakeRsd(x, z)) : 0, hf = h * (1 - lk) + co * lk;
        const fk = 1 - smf(FR - FB, FR, Math.hypot(x - e0[0], z - e0[2]));
        FH.push(+(co + (hf - co) * fk).toFixed(3));
        const gi = Math.max(0, Math.min(G.w - 1, Math.floor((x - G.x0) / G.cell))), gj = Math.max(0, Math.min(G.h - 1, Math.floor((z - G.z0) / G.cell))), q = (gj * G.w + gi) * 3;
        FT.push(W.island.tint[q], W.island.tint[q + 1], W.island.tint[q + 2]); }
      // the field over the window at 5 m (the shader's bilinear field, sampled; the page filters it again)
      const fs5 = 5, fn = Math.ceil(2 * V.R / fs5) + 1, F = [];
      for (let j = 0; j < fn; j++) for (let i = 0; i < fn; i++) F.push(Math.max(-127, Math.min(127, Math.round(env.lakeRsd(c[0] - V.R + i * fs5, c[1] - V.R + j * fs5) / 4))));
      const e = V.eye, a = V.at, ey = V.agl ? W.terrainH(e[0], e[2]) + e[1] : y + e[1], ay = V.agl ? W.terrainH(a[0], a[2]) + a[1] : y + a[1];
      // every lake quad the renderer draws over the window (its rules, lifted: not the sea's, not filled), at its level
      const quads = [];
      for (const M of W.island.lakes) { if (M.level <= 0.2 || M.cells < 3) continue;
        if (M.x1 < c[0] - V.R || M.x0 > c[0] + V.R || M.z1 < c[1] - V.R || M.z0 > c[1] + V.R) continue;
        if (env.isSea(M) || !env.lakeTexels(M).inside) continue;
        quads.push([M.x0, M.z0, M.x1, M.z1, lakeYOf(M)]); }
      out[n] = { quads, FR, fine: { x0: fx0, z0: fz0, nx: fnx, nz: fnz, H: FH, T: FT }, R: V.R, y, x0: -INNER + k0 * SEG, z0: -INNER + m0 * SEG, nx, nz, H, T, f: { x0: c[0] - V.R, z0: c[1] - V.R, n: fn, s: fs5, v: F }, eye: [e[0], ey, e[2]], at: [a[0], ay, a[2]], box: [L.x0, L.z0, L.x1, L.z1] };
    }
    process.stdout.write(JSON.stringify(out));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', js], { maxBuffer: 1 << 28 }).toString());
}

const PAGE = (data, cut, w, h) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<script src="http://localhost:${PORT}/flyDiy/vendor/three.min.js"></script><script>
const D = ${JSON.stringify(data)}, CUT = ${cut ? 1 : 0};
const R = new THREE.WebGLRenderer({ antialias: true }); R.setSize(${w}, ${h}); R.setClearColor(0xc0392b, 1); document.body.appendChild(R.domElement);
const S = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(46, ${w} / ${h}, 0.5, 20000);
cam.position.set(...D.eye); cam.lookAt(new THREE.Vector3(...D.at));
// the field texture (sd / 4 + 128, as the game packs it), linear
const F = D.f, fb = new Uint8Array(F.n * F.n * 4); for (let k = 0; k < F.v.length; k++) { fb[k * 4] = F.v[k] + 128; fb[k * 4 + 3] = 255; }
const ft = new THREE.DataTexture(fb, F.n, F.n, THREE.RGBAFormat); ft.magFilter = ft.minFilter = THREE.LinearFilter; ft.needsUpdate = true;
const U = { uF: { value: ft }, uFR: { value: new THREE.Vector4(F.x0, F.z0, (F.n - 1) * F.s, 0) } };
const sdGLSL = 'uniform sampler2D uF; uniform vec4 uFR; float sdAt(vec2 xz){ vec2 uv = (xz - uFR.xy) / uFR.z; uv = uv * (1.0 - 1.0 / ' + F.n + '.0) + 0.5 / ' + F.n + '.0; if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return -400.0; return (texture2D(uF, uv).r * 255.0 - 128.0) * 4.0; }';
// the ground: the ring's grid and the fine disc's (each discarding the other's side of the disc's edge, as the game's
// do), the tint, the bed's dark peat inside the line (the game's paint), one sun
const grid = (G, st) => { const g = new THREE.PlaneGeometry(1, 1, G.nx - 1, G.nz - 1), p = g.attributes.position, col = new Float32Array(G.nx * G.nz * 3);
  for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) { const k = j * G.nx + i; p.setXYZ(k, G.x0 + i * st, G.H[k], G.z0 + j * st);
    for (let c = 0; c < 3; c++) col[k * 3 + c] = Math.pow(G.T[k * 3 + c] / 255, 2.2); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g; };
const g = grid(D, ${SEG}), gf = grid(D.fine, 5);
// (PlaneGeometry's faces a-b-d / b-c-d, its rows now along +z: wound counter-clockwise seen from above - the ring's own split)
const groundMat = side => { const gm = new THREE.MeshLambertMaterial({ vertexColors: true });
gm.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\nvarying vec3 vW;\\n' + sdGLSL)
    .replace('#include <color_fragment>', '#include <color_fragment>\\n' + (side < 0 ? ' if (distance(vW.xz, cameraPosition.xz) < ' + D.FR.toFixed(1) + ') discard;\\n' : ' if (distance(vW.xz, cameraPosition.xz) > ' + D.FR.toFixed(1) + ') discard;\\n') +
      ' float lsd = sdAt(vW.xz);\\n' + (CUT ? ' if (lsd > 1.0) discard;\\n' : '') + ' diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.055, 0.035), smoothstep(-1.0, 3.0, lsd));'); };
  gm.customProgramCacheKey = () => 'ground' + side;   // (two sides, one hook's source: three would share the first's program)
  return gm; };
S.add(new THREE.Mesh(g, groundMat(-1))); S.add(new THREE.Mesh(gf, groundMat(1)));
// each lake's quad at its drawn level (every one the renderer draws over the window): the field's fade (-2 .. +2 m) and the game's lake column (water.js wDepth: 1.2 m of
// depth a metre of field, to 8 m; a muskeg lake's absorption ~1.5 / m) - opaque a couple of metres in, the bed showing
// through the shallows only - with the sky's sheen (Schlick)
const wm = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: true,
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'varying vec3 vW; ' + sdGLSL + ' void main(){ float sd = sdAt(vW.xz), a = smoothstep(-2.0, 2.0, sd); if (a <= 0.0) discard; vec3 v = normalize(vW - cameraPosition); float fr = 0.02 + 0.98 * pow(1.0 - abs(v.y), 5.0); float col = 1.0 - exp(-1.5 * clamp(sd * 1.2, 0.0, 8.0)); gl_FragColor = vec4(mix(vec3(0.03, 0.04, 0.035), vec3(0.62, 0.72, 0.82), fr), a * max(col, fr)); }' });
for (const q of D.quads) { const wq = new THREE.PlaneGeometry(q[2] - q[0] + 8, q[3] - q[1] + 8); wq.rotateX(-Math.PI / 2); wq.translate((q[0] + q[2]) / 2, q[4], (q[1] + q[3]) / 2); S.add(new THREE.Mesh(wq, wm)); }
// the sky: a dome down to the dip the drawn window can hold (centred on the eye) - under it the clear colour, red: a hole
// shows as red
const THR = Math.max(0.004, (D.eye[1] - (D.y - 6)) / (D.R * 0.7));   // the dip past which a ray must meet the ground drawn
{ const sg = new THREE.SphereGeometry(15000, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2 + Math.atan(THR)); const sm = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vy; void main(){ gl_FragColor = vec4(mix(vec3(0.78, 0.84, 0.90), vec3(0.33, 0.52, 0.78), pow(max(vy, 0.0), 0.5)), 1.0); }' });
  const sky = new THREE.Mesh(sg, sm); sky.position.copy(cam.position); sky.renderOrder = -1; S.add(sky); }
S.add(new THREE.HemisphereLight(0xbcd0e8, 0x3a3020, 1.1)); const sun = new THREE.DirectionalLight(0xfff2e0, 2.2); sun.position.set(-0.5, 0.8, 0.3); S.add(sun);
R.render(S, cam);
// THE HOLES, COUNTED: a pixel still the clear colour whose ray dips under the horizon by more than the window can hold
// (the ground is drawn out to D.R round the lake) is the ground seen THROUGH - the gap
{ const gl = R.getContext(), W = ${w}, Hh = ${h}, px = new Uint8Array(W * Hh * 4); gl.readPixels(0, 0, W, Hh, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const inv = cam.projectionMatrixInverse, mw = cam.matrixWorld, v = new THREE.Vector3(); let holes = 0;
  const thr = THR;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4;
    if (Math.abs(px[k] - 192) > 6 || Math.abs(px[k + 1] - 57) > 6 || Math.abs(px[k + 2] - 43) > 6) continue;   // (the clear colour)
    v.set((x + 0.5) / W * 2 - 1, (y + 0.5) / Hh * 2 - 1, 0.5).applyMatrix4(inv).applyMatrix4(mw).sub(cam.position).normalize();
    if (-v.y > thr) holes++; }
  window.__holes = holes; }
window.__done = true;
</script>`;

(async () => {
  if (!BEFORE) throw new Error('--before <the base tree\'s flyDiy dir>');
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const A = { before: tree(BEFORE), after: tree(ROOT) };
  console.log('worlds composed', ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  page ' + m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('  pageerror: ' + e.message.slice(0, 300)));
  const report = {};
  for (const n of names) for (const tag of ['before', 'after']) {
    const D = A[tag][n];
    const html = path.join(OUT, '_page.html'); fs.writeFileSync(html, PAGE(D, tag === 'before', VW, VH));
    await page.goto('file://' + path.resolve(html)); await page.waitForFunction('window.__done === true', null, { timeout: 120000 });
    // the red pixels below the horizon: the holes (the clear colour seen through the ground)
    const holes = await page.evaluate('window.__holes');
    const file = path.join(OUT, tag + '_' + n + '.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: Q });
    report[tag + '_' + n] = { level: +D.y.toFixed(2), eye: D.eye.map(v => +v.toFixed(1)), holes, kb: +(fs.statSync(file).size / 1024).toFixed(0) };
    console.log(tag, n, JSON.stringify(report[tag + '_' + n]));
  }
  fs.unlinkSync(path.join(OUT, '_page.html'));
  fs.writeFileSync(path.join(OUT, 'stills.json'), JSON.stringify(report, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
