#!/usr/bin/env node
// matlib_chrome.js - THE ARRAY SHAPES IN A REAL BROWSER (G943, AS4a-rest). GATE MATLIB holds, on the recording GL, that
// every prop part drawn by MATLIB's array shape reads its record's numbers and its maps' very texels; it cannot compile a
// line of GLSL. This does: headless Chromium (Playwright; SwiftShader by default, --gl gpu for the box's GPU) opens a bare
// page with the real three, MATLIB, the KTX2 path and the prop registry (props, pier, totems, animals), and draws EVERY
// prop key alone, framed, lit by a sun, an ambient and an environment map (the ao's specular occlusion is the envmap's),
// twice: with the RECORDS (?matarr=0, AS4a-EARLY's draw list) and with the ARRAY SHAPES (the default). The same
// transcodes feed both (KTX2.load is one per url). Per key: the pixels compared (8-bit RGBA of the drawing buffer), the
// draws counted; the program's compile log is read back (a shader that does not compile draws nothing - the verdict
// says so). --out <dir> writes the worst keys side by side (A | B | |A-B| x8) as a JPEG.
//
//   node tools/matlib_chrome.js [--keys a,b] [--gl gpu] [--out tools/perf/as4a_rest_evidence] [--size 192]
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const SIZE = +opt('size', 192), OUT = opt('out', null), ONLY = opt('keys', null);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const packs = [].concat(J('src/props/props_packs.json').map(f => 'src/props/' + f), J('src/pier/pier_packs.json').map(f => 'src/pier/' + f),
  J('src/totems/totems_packs.json').map(f => 'src/totems/' + f));
const animals = J('src/animals/animals_index.json').map(f => 'src/animals/' + f)
  .concat(fs.existsSync(path.join(ROOT, 'src/animals/animals_packs.json')) ? J('src/animals/animals_packs.json').map(f => 'src/animals/' + f) : []);
const SCRIPTS = ['vendor/three.min.js', 'src/core/51_prop_codec.js', 'src/core/55_animal_codec.js', 'src/viewer/assets.js', 'src/viewer/matlib.js',
  'src/viewer/ktx2.js', 'src/viewer/ktx2_twins.js', 'src/viewer/props.js'].concat(packs, ['src/viewer/plume.js', 'src/viewer/animals.js'], animals);
const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script>window.FLYDIY_ASSET_BASE = '';</script>
${SCRIPTS.map(s => `<script src="${s}"></script>`).join('\n')}
<script>
const R = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setSize(${SIZE}, ${SIZE}, false);
R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;
window.FLYDIY_RENDERER = R;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0.02, 0.02, 0.03);
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); scene.add(sun); scene.add(new THREE.AmbientLight(0xffffff, 0.25));
// an environment (the ao's specular occlusion is the envmap's): a gradient room, PMREM'd
{ const env = new THREE.Scene(); const g = new THREE.SphereGeometry(10, 32, 16);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 p; void main(){ float y = normalize(p).y; gl_FragColor = vec4(mix(vec3(0.25,0.22,0.2), vec3(0.6,0.75,1.0), y*0.5+0.5), 1.0); }' });
  env.add(new THREE.Mesh(g, m)); scene.environment = new THREE.PMREMGenerator(R).fromScene(env, 0).texture; }
const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
window.KEYS = () => PROP_REG.order.filter(k => !PROP_REG.props[k].lodOf).concat(PROP_REG.order.filter(k => PROP_REG.props[k].lodOf));
window.WARM = async keys => { await Promise.all(keys.map(k => propWarm(k).catch(() => null))); const A = window.ANIMALS, ak = typeof ANIMAL_REG !== 'undefined' ? ANIMAL_REG.order.slice() : [];
  await Promise.all(ak.map(k => A.warm(k).catch(() => null))); return ak; };
// every key built and placed (hidden) FIRST, so the twins all land before the first frame: a frame is drawn per key after
window.BUILD = (keys, akeys) => { const out = {}; for (const k of keys) { try { const g = propMesh(THREE, k); g.visible = false; scene.add(g); out[k] = g; } catch (e) {} }
  for (const k of akeys) { try { const I = ANIMALS.instance(THREE, k); I.root.visible = false; scene.add(I.root); out['animal:' + k] = I.root; } catch (e) {} } window.OBJ = out; return Object.keys(out).length; };
window.LANDED = () => { const c = [...PROP_TEX_CACHE.values(), ...PROP_TEX_CACHE_LIN.values()]; const s = MATLIB.arr.stats();
  return { tex: c.length, landed: c.filter(t => t.isDataTexture || (t.userData && t.userData.ktx2) || (t.image && t.image.width)).length, layers: s.layers, layersLanded: s.landed + s.failed, ktx2: KTX2.stats() }; };
window.SHOT = key => { const o = window.OBJ[key]; if (!o) return null;
  o.visible = true; o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o), sph = box.getBoundingSphere(new THREE.Sphere());
  if (!isFinite(sph.radius) || sph.radius <= 0) { o.visible = false; return null; }
  const d = sph.radius / Math.sin(THREE.MathUtils.degToRad(17.5)) * 1.05;
  cam.position.copy(sph.center).add(new THREE.Vector3(0.62, 0.45, 0.64).normalize().multiplyScalar(d)); cam.near = d / 50; cam.far = d * 4; cam.updateProjectionMatrix(); cam.lookAt(sph.center);
  const c0 = R.info.render.calls; R.info.autoReset = false; R.info.reset(); R.render(scene, cam); const calls = R.info.render.calls; R.info.autoReset = true;
  const gl = R.getContext(), px = new Uint8Array(${SIZE} * ${SIZE} * 4); gl.readPixels(0, 0, ${SIZE}, ${SIZE}, gl.RGBA, gl.UNSIGNED_BYTE, px);
  o.visible = false;
  let s = ''; for (let i = 0; i < px.length; i += 8192) s += String.fromCharCode.apply(null, px.subarray(i, i + 8192));
  return { px: btoa(s), calls };
};
window.PROGRAMS = () => R.info.programs.map(p => ({ name: p.name, key: p.cacheKey.slice(0, 60), diag: p.diagnostics ? JSON.stringify(p.diagnostics).slice(0, 400) : null }));
window.READY = true;
</script></body></html>`;

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
  if (u === '' || u === 'index.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  const ty = u.endsWith('.js') ? 'text/javascript' : u.endsWith('.wasm') ? 'application/wasm' : u.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  r.writeHead(200, { 'content-type': ty }); fs.createReadStream(f).pipe(r);
});

async function run(browser, port, query) {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:' + port + '/index.html' + query, { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 100 && !(await page.evaluate('!!window.READY')); i++) await sleep(200);
  let keys = await page.evaluate('KEYS()');
  if (ONLY) keys = keys.filter(k => ONLY.split(',').includes(k));
  const ak = await page.evaluate(k => WARM(k), keys);
  const n = await page.evaluate(([k, a]) => BUILD(k, a), [keys, ONLY ? [] : ak]);
  let L = null;
  for (let i = 0; i < 600; i++) { L = await page.evaluate('LANDED()'); if (L.landed >= L.tex && L.layersLanded >= L.layers) break; await sleep(500); }
  const shots = {}, all = keys.concat(ONLY ? [] : ak.map(k => 'animal:' + k));
  for (const k of all) shots[k] = await page.evaluate(k => SHOT(k), k);
  const progs = await page.evaluate('PROGRAMS()');
  const stats = await page.evaluate('({ arr: MATLIB.arr.stats(), ktx2: KTX2.stats() })');
  await page.close();
  return { keys: all, n, L, shots, progs, logs, stats };
}

(async () => {
  const exe = opt('chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const args = (opt('gl', 'swiftshader') === 'gpu' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']).concat(['--js-flags=--max-old-space-size=8192']);
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args });
  const t0 = Date.now();
  const A = await run(browser, port, '?matarr=0'), B = await run(browser, port, '');
  await browser.close(); srv.close();
  const rows = [];
  let worstMax = 0, sumMean = 0, n = 0, blank = [], callsA = 0, callsB = 0;
  for (const k of A.keys) {
    const a = A.shots[k], b = B.shots[k]; if (!a || !b) continue;
    const pa = Buffer.from(a.px, 'base64'), pb = Buffer.from(b.px, 'base64');
    let max = 0, sum = 0, diff = 0, lit = 0;
    for (let i = 0; i < pa.length; i += 4) { let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(pa[i + c] - pb[i + c]); m = Math.max(m, d); sum += d; }
      if (m > 2) diff++; if (m > max) max = m; if (pa[i] + pa[i + 1] + pa[i + 2] > 30) lit++; }
    const mean = sum / (pa.length / 4 * 3);
    if (lit > 50 && b.calls === 0) blank.push(k);
    rows.push({ k, max, mean, diffPct: 100 * diff / (pa.length / 4), lit, callsA: a.calls, callsB: b.calls, pa, pb });
    worstMax = Math.max(worstMax, max); sumMean += mean; n++; callsA += a.calls; callsB += b.calls;
  }
  rows.sort((x, y) => y.mean - x.mean);
  const diag = B.progs.filter(p => p.diag && /error|ERROR/.test(p.diag));
  console.log(`matlib_chrome: ${n} keys drawn both ways (records | array shapes), ${SIZE}^2 each, ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log(`  layers: ${JSON.stringify(B.stats.arr)}`);
  console.log(`  ktx2 (records side): ${JSON.stringify(A.stats.ktx2)}`);
  console.log(`  draws (all keys, one frame each): ${callsA} -> ${callsB}; programs ${A.progs.length} -> ${B.progs.length}`);
  console.log(`  pixels: mean |A-B| ${(sumMean / Math.max(1, n)).toFixed(4)} codes over ${n} keys; worst key's max ${worstMax}`);
  console.log('  the 12 keys that moved most (mean |A-B|, max, % pixels > 2 codes):');
  for (const r of rows.slice(0, 12)) console.log(`    ${r.k.padEnd(34)} mean ${r.mean.toFixed(3)} max ${r.max} ${r.diffPct.toFixed(2)} %  draws ${r.callsA} -> ${r.callsB}`);
  if (diag.length) console.log('  SHADER DIAGNOSTICS: ' + JSON.stringify(diag).slice(0, 1500));
  if (blank.length) console.log('  DREW NOTHING with the array shapes: ' + blank.slice(0, 20).join(', '));
  const logs = B.logs.filter(l => !/GPU stall|swiftshader|WebGL-/.test(l));
  if (logs.length) console.log('  page logs (arrays):\n    ' + logs.slice(0, 15).join('\n    '));
  if (OUT) {
    // the worst keys side by side: A | B | |A-B| x8, a PPM converted to JPEG by python (Pillow, the bakers' dependency)
    fs.mkdirSync(OUT, { recursive: true });
    const pick = rows.slice(0, 8), W = SIZE * 3, H = SIZE * pick.length, img = Buffer.alloc(W * H * 3);
    pick.forEach((r, y) => { for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
      const s = ((SIZE - 1 - py) * SIZE + px) * 4;   // readPixels is bottom-up
      for (const [col, src] of [[0, r.pa], [1, r.pb], [2, null]]) { const o = ((y * SIZE + py) * W + col * SIZE + px) * 3;
        for (let c = 0; c < 3; c++) img[o + c] = src ? src[s + c] : Math.min(255, Math.abs(r.pa[s + c] - r.pb[s + c]) * 8); } } });
    const ppm = path.join(OUT, 'worst.ppm');
    fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), img]));
    require('child_process').spawnSync('python3', ['-c', `from PIL import Image; Image.open('${ppm}').save('${path.join(OUT, 'matlib_ab_worst.jpg')}', quality=88)`]);
    fs.unlinkSync(ppm);
    fs.writeFileSync(path.join(OUT, 'matlib_ab_summary.json'), JSON.stringify({ keys: n, size: SIZE, draws: [callsA, callsB], programs: [A.progs.length, B.progs.length], meanAbs: sumMean / Math.max(1, n), worstMax,
      layers: B.stats.arr, worst: rows.slice(0, 20).map(r => ({ key: r.k, mean: +r.mean.toFixed(4), max: r.max, diffPct: +r.diffPct.toFixed(3), draws: [r.callsA, r.callsB] })) }, null, 1) + '\n');
    console.log('  evidence -> ' + path.relative(ROOT, OUT));
  }
  const ok = !diag.length && !blank.length && n > 0 && callsB < callsA;
  console.log('MATLIB CHROME: ' + (ok ? 'PASS' : 'FAIL') + ' (the look: the numbers above and the picture are for the eye; a shader error or a blank key fails)');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
