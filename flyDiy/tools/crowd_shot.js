#!/usr/bin/env node
// crowd_shot.js - THE PASSENGERS' LINE ON THE REAL PAGE (G3619), FOR THE BOX'S GPU: the stills the user asked for
// ("I'll need to see some passengers queuing screenshots"). The C172 on the sandbox stand with '20 kg of bags + three
// passengers' (?freight=1&strapload=bags20p3:c172), rolled out; the line held (the run's goT pushed out) while the free
// eye looks at it from beside, then released: three stills - 1 the line waiting at the embark point, 2 walking out in
// order, 3 the queue at the cabin door - each with the crowd's state beside it. The eye is ASSERTED (FLYDIY_PREM_EYE
// true, the camera within 0.5 m of where it was put) and each still is checked for people drawn in it.
//   --people a,b,c   the bodies to seat when the page has no FLYDIY_PEOPLE (Game's seam): a stub pool of exactly those
//                    (the still's caption says so); with the seam on the page it is never replaced
//   cd <worktree> && node flyDiy/tools/_serve.js 8152 . --fallback D:/Dev/DeGaRoR.github.io &
//   node flyDiy/tools/crowd_shot.js [--port 8152] [--out <dir>] [--people adam,jody,kate] [--page dev.html] [--diag]   -> "CROWD SHOT: PASS|FAIL"
// Guarded by boxlock (GPU) - never run beside a lock. No --help.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +opt('port', 8152);
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'crowd_shot')));
const PEOPLE = (opt('people', '') || '').split(',').filter(Boolean);
// dev.html by default: the page straight off src/ (a WIP branch's stills need no build); --page index.html for a built one
const BASE = 'http://127.0.0.1:' + PORT + '/flyDiy/' + opt('page', 'dev.html') + '?audio=0&freight=1&strapload=bags20p3:c172';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
// the box's own Chrome over CDP (crowd_probe.js's shim + a screenshot)
async function chrome() {
  const port = 9700 + (process.pid % 200);
  const udd = path.join(os.tmpdir(), 'crowd_shot_' + port + '_' + Date.now());
  const ch = cp.spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=1600,900', '--hide-scrollbars',
    '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192', 'about:blank'], { stdio: 'ignore' });
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no Chrome page on ' + port);
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(), errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push((d.exception && d.exception.description || d.text || '').split('\n')[0]); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  const ev = async (fn, arg) => {
    const expr = typeof fn === 'string' ? fn : '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')';
    const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text));
    return r.result.result.value;
  };
  const shot = async file => { const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
  return { ev, errors, shot, goto: async url => { await cmd('Page.navigate', { url }); await sleep(3000); },
    close: () => { try { ws.close(); } catch (e) {} try { ch.kill(); } catch (e) {} try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} } };
}

(async () => {
  if (!CHROME) { console.error('crowd_shot: no Chrome'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const fails = [], rows = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const P = await chrome();
  await P.goto(BASE);
  for (let k = 0; k < 900; k++) { if (!(await P.ev(() => !(window.BOOT && window.BOOT.state === 'gone')).catch(() => true))) break; await sleep(1000); }
  await sleep(2000);
  // the stub pool BEFORE the stand (fsPeople draws when the load lands) - only when the page has no seam of its own
  const stub = PEOPLE.length ? await P.ev(ks => {
    if (window.FLYDIY_PEOPLE) return false;
    window.FLYDIY_PEOPLE = { pool: () => ks.slice(), char: id => id, client: () => null };
    return true;
  }, PEOPLE) : false;
  await P.ev(() => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
  await sleep(800);
  await P.ev(() => window.FLYDIY_FREIGHT.stand('c172'));
  await sleep(3000);
  await P.ev(() => window.FLYDIY_STRAP.rigLoad('bags20p3', 'c172'));
  await P.ev(() => document.getElementById('edRoll').click());
  for (let k = 0; k < 300; k++) { if (await P.ev(() => !!(window.FLYDIY_HOLDS && !window.FLYDIY_HOLDS().inGarage)).catch(() => false)) break; await sleep(1000); }
  // the line drawn: hold it (the shots need the eye placed and settled)
  let lined = false;
  for (let k = 0; k < 4 * 90 && !lined; k++) {
    await sleep(250);
    lined = await P.ev(() => { const M = window.CROWD && window.CROWD.last, one = M && M.runs[0];
      if (!one || !one.ready || !one.H.some(h => h && h.g.visible)) return false;
      one.R.goT = 1e9; return one.R.people.every(p => p.state === 'line'); }).catch(() => false);
  }
  check(lined, '1 the line is drawn at the embark point, everyone waiting');
  // --diag (G3619, the user 26 Oct: "passengers should have shadows"): what the shadow passes see of each person -
  // castShadow, the near/far layer bits, the world sphere render_world's nearTag measures (it tags only r >= 0.75 m),
  // whether the near map's caster list holds the mesh, and the near map's cache counters
  if (argv.includes('--diag') && lined) {
    await sleep(1500);
    const dg = await P.ev(() => {
      const SN = window.SHADOW_NEAR, one = window.CROWD.last.runs[0], T = window.THREE || (typeof THREE !== 'undefined' ? THREE : null);
      const NL = SN && SN.NEAR_LAYER, FL = SN && SN.FAR_LAYER, sp = T && T.Sphere ? new T.Sphere() : null;
      const listed = new Set(((SN && SN.CACHE && SN.CACHE.near) || []).map(q => q.o));   // the casters the near map last drew with
      const ms = [];
      for (const h of one.H) if (h) for (const sm of h.inst.meshes) {
        const g = sm.geometry; if (g && !g.boundingSphere) g.computeBoundingSphere();
        let r = null; if (sp && g && g.boundingSphere) { sp.copy(g.boundingSphere).applyMatrix4(sm.matrixWorld); r = +sp.radius.toFixed(2); }
        ms.push({ who: h.p.key, name: sm.name, skinned: !!sm.isSkinnedMesh, cast: sm.castShadow, vis: sm.visible && h.g.visible,
          near: NL != null ? sm.layers.isEnabled(NL) : null, far: FL != null ? sm.layers.isEnabled(FL) : null, r, listed: listed.has(sm),
          culled: sm.frustumCulled, depth: !!sm.customDepthMaterial, mat: sm.material && sm.material.type });
      }
      return { sn: !!SN, stat: SN && SN.CACHE ? SN.CACHE.stat : null, S: SN && SN.S ? { cache: SN.S.cache, half: SN.S.half, boxPrune: SN.S.boxPrune } : null, ms };
    }).catch(e => ({ err: String(e && e.message || e) }));
    fs.writeFileSync(path.join(OUT, 'crowd_shadow_diag.json'), JSON.stringify(dg, null, 1));
    console.log('  diag: ' + (dg.ms ? dg.ms.length + ' meshes, cast ' + dg.ms.filter(m => m.cast).length + ', near-layer ' + dg.ms.filter(m => m.near).length +
      ', listed ' + dg.ms.filter(m => m.listed).length + ', r >= 0.75 ' + dg.ms.filter(m => m.r >= 0.75).length : dg.err || 'no SHADOW_NEAR') + ' -> crowd_shadow_diag.json');
  }
  // --probe (G3619, the 08:00 diag: every piece cast, near-layered, listed - and no shadow nor foot blob in a still): what
  // the renderer actually DRAWS of the crowd over two frames - each draw call of a passenger's mesh or the feet's blobs,
  // by pass (a shadow camera or the main one) and viewport; and the feet mesh beside the wheels' (its parent, layers,
  // count, first instance's place) - against the main camera's layers
  if (argv.includes('--probe') && lined) {
    await sleep(1500);
    const pr = await P.ev(() => new Promise(res => {
      const R = window.FLYDIY_RENDERER, one = window.CROWD.last.runs[0], T = window.THREE || (typeof THREE !== 'undefined' ? THREE : null);
      const mine = new Map();
      for (const h of one.H) if (h) for (const sm of h.inst.meshes) mine.set(sm, h.p.key + ':' + sm.name.replace(/^char:[^:]+:/, ''));
      let feet = null, wheels = null, scene = null;
      for (const h of one.H) if (h) { scene = h.g.parent; break; }
      if (scene) for (const c of scene.children) { if (c.name === 'crowd:feet') feet = c; if (c.name === 'contact:blobs') wheels = c; }
      if (feet) mine.set(feet, 'FEET');
      const draws = {}, vp = new T.Vector4();
      let mainCam = null;
      const rd = R.render, rbd = R.renderBufferDirect;
      R.render = function (s, c) { if (s === scene) mainCam = c; return rd.apply(this, arguments); };
      R.renderBufferDirect = function (cam, sc, geo, mat, obj) {
        const k = mine.get(obj);
        if (k) { R.getCurrentViewport(vp);
          const pass = sc === null ? 'shadow@' + vp.x + ',' + vp.y + ' ' + vp.z + 'x' + vp.w : (cam === mainCam ? 'main' : 'other:' + (cam && cam.type));
          const d = draws[k] || (draws[k] = {}); d[pass] = (d[pass] || 0) + 1; d.mat = mat && mat.type; }
        return rbd.apply(this, arguments);
      };
      let n = 0;
      const done = () => {
        R.render = rd; R.renderBufferDirect = rbd;
        const lay = o => o ? o.layers.mask : null, e = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
        const inst0 = m => { if (!m || !m.count) return null; const M4 = new T.Matrix4().fromArray(m.instanceMatrix.array, 0); M4.decompose(e, q, s); return [e.x, e.y, e.z, s.x, s.y, s.z].map(v => +v.toFixed(3)); };
        const p0 = one.H.find(Boolean);
        res({ mainLayers: mainCam ? mainCam.layers.mask : null, shadowOn: R.shadowMap.enabled, shadowAuto: R.shadowMap.autoUpdate,
          meshLayers: [...new Set([...mine.keys()].filter(o => o !== feet).map(lay))],
          feet: feet && { inScene: true, vis: feet.visible, count: feet.count, layers: lay(feet), order: feet.renderOrder, mat: feet.material.type, prog: !!feet.material.program,
            inst0: inst0(feet), person0: p0 ? [p0.g.position.x, p0.g.position.y, p0.g.position.z].map(v => +v.toFixed(3)) : null },
          wheels: wheels && { vis: wheels.visible, count: wheels.count, layers: lay(wheels), inst0: inst0(wheels), sameMat: !!feet && wheels.material === feet.material },
          SN: window.SHADOW_NEAR ? { hook: window.SHADOW_NEAR.HOOK, C1: (({ pruned, full, boxPruned, boxFull, H, dB }) => ({ pruned, full, boxPruned, boxFull, H, dB }))(window.SHADOW_NEAR.C1) } : null,
          draws });
      };
      const step = () => { if (++n > 2) return done(); requestAnimationFrame(step); };
      requestAnimationFrame(step);
    })).catch(e => ({ err: String(e && e.message || e) }));
    fs.writeFileSync(path.join(OUT, 'crowd_probe.json'), JSON.stringify(pr, null, 1));
    const ks = pr.draws ? Object.keys(pr.draws) : [];
    console.log('  probe: ' + (pr.err || ks.length + ' crowd objects drawn; shadow draws ' + ks.filter(k => Object.keys(pr.draws[k]).some(p => p.startsWith('shadow'))).length +
      ', main draws ' + ks.filter(k => pr.draws[k].main).length + ', feet ' + JSON.stringify(pr.draws && pr.draws.FEET || null)) + ' -> crowd_probe.json');
  }
  // the eye beside what is shown: the people's centroid, the line's direction toward the door, 8 m out to one side
  const aim = (side, back, up = 1.7) => P.ev(([side, back, up]) => {
    const M = window.CROWD.last, one = M.runs[0], hs = one.H.filter(h => h && h.g.visible);
    if (!hs.length) return null;
    const c = [0, 0, 0]; for (const h of hs) { c[0] += h.g.position.x; c[1] += h.g.position.y; c[2] += h.g.position.z; }
    c[0] /= hs.length; c[1] /= hs.length; c[2] /= hs.length;
    const to = one.R.P.pts[one.R.P.pts.length - 1];
    let dx = to[0] - c[0], dz = to[1] - c[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const p = [c[0] - dz * side - dx * back, c[1] + up, c[2] + dx * side - dz * back], t = up < 1.7 ? [c[0], c[1] + 0.2, c[2]] : [c[0] + dx * 2, c[1] + 0.9, c[2] + dz * 2];
    const ok = window.FLYDIY_PREM_EYE(p, t);
    return { ok, p, t, n: hs.length, keys: hs.map(h => h.p.key + ':' + h.p.state) };
  }, [side, back, up]);
  const take = async (n, name, side, back, up) => {
    const e = await aim(side, back, up);
    await sleep(1500);
    const st = await P.ev(() => ({ c: window.FLYDIY_CROWD ? window.FLYDIY_CROWD() : null,
      // the free eye's own pose (DEVCAM drives the camera from it every frame)
      cam: window.DEV_CAM ? [window.DEV_CAM.pos.x, window.DEV_CAM.pos.y, window.DEV_CAM.pos.z] : null })).catch(() => ({}));
    const file = path.join(OUT, 'crowd_' + n + '_' + name + '.jpg');
    await P.shot(file);
    const near = e && st.cam ? Math.hypot(st.cam[0] - e.p[0], st.cam[1] - e.p[1], st.cam[2] - e.p[2]) : null;
    check(!!(e && e.ok) && near != null && near < 0.5, `${n} the eye put beside the ${name} (PREM_EYE ${e && e.ok}${near != null ? ', the camera ' + near.toFixed(2) + ' m from it' : ''})`);
    check(!!(e && e.n > 0), `${n} people drawn in the ${name} still: ${e ? e.keys.join(', ') : 'none'}`);
    rows.push({ n, name, file, eye: e, crowd: st.c });
    console.log('     -> ' + file);
  };
  if (lined) {
    await take(1, 'line', 8, 2);
    // the user 26 Oct: the feet - the contact blobs and the sun's shadows on the apron, close and low
    await take(4, 'feet', 3.2, 1.2, 1.1);
    // released: they walk out in order
    await P.ev(() => window.CROWD.last.runs[0].R.go());
    await sleep(3500);
    await take(2, 'walk-out', 9, 0);
    // the queue at the door: the first one turning / boarding
    let atDoor = false;
    for (let k = 0; k < 4 * 60 && !atDoor; k++) { await sleep(250); atDoor = await P.ev(() => { const one = window.CROWD.last.runs[0]; return !!one && one.R.people.some(p => p.state === 'turn' || p.state === 'board'); }).catch(() => false); }
    check(atDoor, '3 the first one reaches the cabin door');
    await take(3, 'door-queue', 7, 4);
  }
  check(!P.errors.length, '4 no page error' + (P.errors.length ? ': ' + P.errors.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'crowd_shot.json'), JSON.stringify({ stub: stub ? PEOPLE : null, rows }, null, 1));
  if (stub) console.log('  note: the page had no FLYDIY_PEOPLE - the bodies are the stub pool ' + PEOPLE.join(', '));
  P.close();
  console.log('CROWD SHOT: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
