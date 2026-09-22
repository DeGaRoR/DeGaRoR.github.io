#!/usr/bin/env node
// light_shot.js - THE LIGHT AT THE CRAFT, MEASURED (2026-09-22)
//
//   node tools/light_shot.js [--url "http://localhost:8487/flyDiy/dev.html?world=jolene"] \
//        [--at x,agl,z] [--cam az,el,dist] [--states all,sun,hemi,env,none] [--out bench/light/stand.png]
//        [--step "<js>" ...] [--boot ms] [--wait ms] [--log]
//
// island_shot's boot (headless Chrome on this machine's GPU, the game rolled out, the fresh
// profile's chooser dismissed), the aeroplane left on its stand (or teleported to --at) and
// HELD, and beside it A GREY SPHERE: a MeshStandardMaterial at linear 0.5, roughness 1,
// metalness 0 - the one material every Standard part of the aeroplane is a case of, with
// nothing of its own to say. Its shading by normal IS the incident light: what the sun, the
// hemisphere and the probe each put on a surface facing up, sideways, down. For every
// switchboard state in --states the rig shoots one frame and reads the sphere back at a
// table of normals (only the ones the eye can see), printing R G B (sRGB 0..255) and the
// GREEN RATIO G / mean(R, B) - the number that names a green cap. A ratio near 1 is grey
// light; the concrete apron should give one.
//
// --step "<js>" (repeatable): after the states, each expression runs in the same page and
// the table is read again - a fix A/B'd against master from one boot.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8487/flyDiy/dev.html?world=jolene');
const AT = opt('at', null) ? opt('at').split(',').map(Number) : null;
const CAM = opt('cam', '0.6,0.12,11').split(',').map(Number);
const STATES = opt('states', 'all,sun,hemi,env,none').split(',');
const OUT = opt('out', 'bench/light/stand.png');
const WAIT = +opt('wait', 8000);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('light_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_light_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// ---- a PNG reader (8-bit RGB/RGBA, non-interlaced; pavement_shot's) ----
function readPNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    else if (type === 'IDAT') idat.push(buf.slice(p + 8, p + 8 + len));
    p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], row = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255; }
    cur.copy(out, y * stride); prev = cur; }
  return { w, h, bpp, data: out };
}
// the mean of a (2k+1)^2 window
const patch = (img, x, y, k) => {
  const s = [0, 0, 0]; let n = 0;
  for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) {
    const px = Math.round(x) + i, py = Math.round(y) + j; if (px < 0 || py < 0 || px >= img.w || py >= img.h) continue;
    const o = (py * img.w + px) * img.bpp; s[0] += img.data[o]; s[1] += img.data[o + 1]; s[2] += img.data[o + 2]; n++; }
  return s.map(v => v / Math.max(1, n));
};

// THE SPHERE, and the table of normals read off it (in the page)
const SPHERE_JS = `(()=>{
  const m = FLIGHT_PROBE.model(), sc = m.grp.parent, s = FLIGHT_PROBE.sim(), cam = FLIGHT_PROBE.camera();
  if (window.LIGHT_SPHERE) { sc.remove(window.LIGHT_SPHERE.sp); window.LIGHT_SPHERE.sp.geometry.dispose(); window.LIGHT_SPHERE.sp.material.dispose(); }
  const cg = s.cgPos(); cam.updateMatrixWorld(true);
  const eye = cam.position.clone(), tgt = new THREE.Vector3(cg[0], cg[1], cg[2]);
  const back = eye.clone().sub(tgt).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
  const R = 0.8, c = tgt.clone().addScaledVector(right, 3.6).add(new THREE.Vector3(0, 0.3, 0));
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }); mat.color.setRGB(0.5, 0.5, 0.5);
  const sp = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), mat); sp.position.copy(c); sp.receiveShadow = true; sp.name = 'LIGHT_SPHERE';
  sc.add(sp);
  window.LIGHT_SPHERE = { sp, R, c, eye };
  return JSON.stringify({ cg, c: c.toArray(), eye: eye.toArray() });
})()`;
const TABLE_JS = `(()=>{
  const { sp, R, c } = window.LIGHT_SPHERE, cam = FLIGHT_PROBE.camera(); cam.updateMatrixWorld(true);
  const eye = cam.position.clone(), W = innerWidth, H = innerHeight;
  const sunV = (WORLD_RIG && FLIGHT_PROBE.world().day) ? FLIGHT_PROBE.world().day.sun : [0, 1, 0];
  const S = new THREE.Vector3(sunV[0], sunV[1], sunV[2]).normalize();
  const toEye = eye.clone().sub(c).normalize(), up = new THREE.Vector3(0, 1, 0), dn = new THREE.Vector3(0, -1, 0);
  const N = { up, 'up-eye': up.clone().add(toEye).normalize(), eye: toEye, 'down-eye': dn.clone().add(toEye).normalize(),
    'down-eye2': dn.clone().multiplyScalar(2).add(toEye).normalize(), down: dn, sun: S, antisun: S.clone().negate() };
  const out = {};
  for (const k in N) { const n = N[k], p = c.clone().addScaledVector(n, R); const vis = n.dot(eye.clone().sub(p)) > 0.08 * eye.distanceTo(p);
    const q = p.clone().project(cam); out[k] = { vis, x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H, n: n.toArray().map(v => +v.toFixed(2)) }; }
  return JSON.stringify(out);
})()`;
const STATE_JS = st => `(()=>{ const on = ${JSON.stringify(st)}; const keep = { sky: 1, runway: 1, lamps: 1 };
  return JSON.stringify(GARAGE_ENV.setWorldLights(k => keep[k] ? true : (on === 'all' ? true : on === 'none' ? false : on.split('+').indexOf(k) >= 0))); })()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  const LOG = argv.includes('--log');
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | '));
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 1200)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text)); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(+opt('boot', 20000));
  let flying = false;
  for (let a = 0; a < +opt('tries', 20) && !flying; a++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText) && typeof FLIGHT_PROBE !== 'undefined' && !!FLIGHT_PROBE.sim() && (()=>{const b=document.getElementById('boot');return !b || b.hidden || b.classList.contains('gone');})()");
  }
  if (!flying) throw new Error('the roll-out never happened');
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
  await sleep(3000);
  // held where it stands (the stand, by default), or moved to --at
  await ev(`(()=>{const s=FLIGHT_PROBE.sim(),w=FLIGHT_PROBE.world();const cg=s.cgPos();
    ${AT ? `const gy=w.terrainH(${AT[0]},${AT[2]});const dx=${AT[0]}-cg[0],dy=(gy+${AT[1]})-cg[1],dz=${AT[2]}-cg[2];
    for(let i=0;i<s.n;i++){s.p[i*3]+=dx;s.p[i*3+1]+=dy;s.p[i*3+2]+=dz;s.v[i*3]=s.v[i*3+1]=s.v[i*3+2]=0;}` : ''}
    const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()`);
  await ev(`FLIGHT_PROBE.camSet(${CAM[0]}, ${CAM[1]}, ${CAM[2]}), 1`);
  await sleep(2500);
  console.log('sphere: ' + await ev(SPHERE_JS));
  console.log('ground under the craft: ' + await ev("(()=>{const w=FLIGHT_PROBE.world(),cg=FLIGHT_PROBE.sim().cgPos();const s=w.surface(cg[0],cg[2]);const g=WORLD_RIG.groundUnder?WORLD_RIG.groundUnder():null;return Object.keys(w.SURFACE).find(k=>w.SURFACE[k]===s)+' ('+s+')'+(g?('  cap '+g.alb.map(v=>v.toFixed(3)).join('/')+'  baked '+(g.baked?g.baked.map(v=>v.toFixed(3)).join('/'):'-')+'  mix '+JSON.stringify(g.mix)+'  r '+g.r.toFixed(0)+' m  bakes '+g.bakes):'');})()").catch(e => 'ERR ' + e.message));
  console.log('day: ' + await ev("(()=>{const d=FLIGHT_PROBE.world().day;const r=WORLD_RIG.get();return d?('sunEl '+d.sunEl.toFixed(1)+' deg, row hemiGnd 0x'+r.hemiGnd.toString(16)+' hemi '+r.hemi):'none';})()").catch(() => 'n/a'));
  await sleep(WAIT);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const read = async (tag, file) => {
    const shot = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    const img = readPNG(Buffer.from(shot.result.data, 'base64'));
    const T = JSON.parse(await ev(TABLE_JS));
    const rows = [];
    for (const k in T) { const t = T[k]; if (!t.vis) continue; const c = patch(img, t.x, t.y, 2);
      const g = c[1] / Math.max(1, (c[0] + c[2]) / 2);
      rows.push(`${k.padEnd(10)} n=[${t.n.join(',')}]  ${c.map(v => String(Math.round(v)).padStart(3)).join(' ')}  G/mean(R,B) ${g.toFixed(2)}`); }
    console.log(`== ${tag}  (${path.basename(file)})\n` + rows.join('\n'));
  };
  for (const st of STATES) {
    console.log('state ' + st + ': on = ' + await ev(STATE_JS(st)));
    await sleep(1500);
    await read(st, OUT.replace(/\.png$/, '_' + st.replace(/\+/g, '-') + '.png'));
  }
  await ev(STATE_JS('all'));
  const STEPS = argv.filter((x, i) => argv[i - 1] === '--step');
  for (let si = 0; si < STEPS.length; si++) {
    console.log('step ' + si + ': ' + await ev(STEPS[si]).catch(e => 'ERR ' + e.message));
    await sleep(4000);
    // THE SPHERE STANDS WHERE THE CRAFT WAS: a step that moves the aeroplane leaves it behind
    // (the first grass run read a sphere 700 m back, in shade - a confident wrong number). Re-place
    // it beside the craft, give the eye and the probe their settle, and print the ground again.
    await ev(`FLIGHT_PROBE.camSet(${CAM[0]}, ${CAM[1]}, ${CAM[2]}), 1`);
    await sleep(2500);
    console.log('  sphere: ' + await ev(SPHERE_JS));
    console.log('  ground under the craft: ' + await ev("(()=>{const w=FLIGHT_PROBE.world(),cg=FLIGHT_PROBE.sim().cgPos();const s=w.surface(cg[0],cg[2]);const g=WORLD_RIG.groundUnder?WORLD_RIG.groundUnder():null;return Object.keys(w.SURFACE).find(k=>w.SURFACE[k]===s)+' ('+s+')'+(g?('  cap '+g.alb.map(v=>v.toFixed(3)).join('/')+'  baked '+(g.baked?g.baked.map(v=>v.toFixed(3)).join('/'):'-')+'  mix '+JSON.stringify(g.mix)+'  r '+g.r.toFixed(0)+' m  bakes '+g.bakes):'');})()").catch(e => 'ERR'));
    await sleep(6000);
    for (const st of STATES) { await ev(STATE_JS(st)); await sleep(1500); await read('step ' + si + ' / ' + st, OUT.replace(/\.png$/, '_s' + si + '_' + st.replace(/\+/g, '-') + '.png')); }
    await ev(STATE_JS('all'));
  }
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('light_shot: ' + e.message); ch.kill(); process.exit(1); });
