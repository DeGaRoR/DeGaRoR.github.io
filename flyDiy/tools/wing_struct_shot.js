// wing_struct_shot.js - WING-STRUCTURE's pictures in a cloud box (no GPU): the page in headless Chromium (Playwright,
// SwiftShader WebGL), a build loaded on the stand, and
//   --fiche views   the fiche's own draw (PLANE_FICHE.generate, store off) - e.g. cutaway,hero
//   --garage views  the garage's camera presets (q, s, f, t, under) with the see-inside view (x) or the cutaway box (c)
//                   on: e.g. qx,qc,underc
//   node tools/wing_struct_shot.js --build builds/jodel_2026-09-20_corrected.json --out /tmp/ws/jodel --fiche cutaway
//   node tools/wing_struct_shot.js --validated cub --out /tmp/ws/cub --garage qc,underc
// Serves the repository itself (port 8450 + pid) unless --url is given. Slow on software GL: minutes a build.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const OUT = opt('out', '/tmp/wing_struct');
const FICHE = (opt('fiche', '') || '').split(',').filter(Boolean);
const GARAGE = (opt('garage', '') || '').split(',').filter(Boolean);
const W = +opt('w', 1600), H = +opt('h', 1000);
let BUILD = opt('build', null);
const VAL = opt('validated', null);
if (VAL) BUILD = { val: VAL };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
function serve(port) {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      const f = path.join(ROOT, u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(port, () => res(s));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const port = 8450 + (process.pid % 300);
  const srv = opt('url', null) ? null : await serve(port);
  const URL = opt('url', 'http://localhost:' + port + '/flyDiy/dev.html' + (argv.includes('--crash') ? '?damage=1&simw=0' : ''));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  const LOG = argv.includes('--log');
  pg.on('pageerror', e => console.error('page error: ' + String(e.message).slice(0, 300)));
  pg.on('console', m => { if (LOG || /FICHE EDGE/.test(m.text()) || (m.type() === 'error' && /wing struct/i.test(m.text()))) console.log('page ' + m.type() + ': ' + m.text().slice(0, 400)); });
  pg.setDefaultTimeout(600000);
  const t0 = Date.now(), el = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
  // --noedge (a debug of the rig only): plane_fiche.js served with its frame-touch refusal turned into a log line, so the
  // picture that would be refused can be seen
  if (argv.includes('--noedge')) await pg.route('**/plane_fiche.js*', async route => {
    const r = await route.fetch(); let t = await r.text();
    t = t.replace("if (m.edge) throw new Error('the ' + name + ' picture touches its frame');", "if (m.edge) console.warn('FICHE EDGE ' + name + ' ' + JSON.stringify([m.x0, m.y0, m.x1, m.y1, w, h]));");
    await route.fulfill({ response: r, body: t });
  });
  // the fiche is drawn in the garage's STUDIO (its matte takes the background's share: the shed's floor and walls would
  // fill the frame - plane_fiche.js refuses a picture that touches its frame); --shed keeps the shed
  if (!argv.includes('--shed')) await pg.addInitScript(() => { try { localStorage.setItem('flydiy.garageStudio', '1'); } catch (e) {} });
  await pg.goto(URL, { waitUntil: 'load' });
  await pg.waitForFunction(() => !!(window.CAGE_UI && window.GARAGE_SPEC && window.FLIGHT_PROBE && window.CAGE_UI_SCENE), null, { timeout: 900000, polling: 2000 });
  console.log('wing_struct_shot: garage up ' + el());
  await pg.waitForFunction(() => window.BOOT && /^(ready|gone|waiting)$/.test(window.BOOT.state), null, { timeout: 1500000, polling: 3000 });
  await pg.evaluate(() => { if (window.BOOT && window.BOOT.state === 'waiting') [...document.querySelectorAll('button')].filter(x => /continue/i.test(x.textContent || '')).forEach(x => x.click()); return 1; });
  console.log('wing_struct_shot: boot ' + await pg.evaluate(() => window.BOOT.state) + ' ' + el());
  await sleep(4000);
  const LIST = [];
  // a VARIANT: key@row - the validated build with its wings' construction row set (cub@aluFabric, cub@steel), so every
  // kind of structure is drawn on an aeroplane the game flies; key+light - its lamp fitted (the bay's pocket)
  if (BUILD && BUILD.val) for (const k0 of BUILD.val.split(',')) LIST.push({ key: k0.replace(/[@+]/g, '_'), spec: () => {
    const [k, row] = k0.replace(/\+(light|plain)$/, '').split('@'), sp = require('./_load_build.js').loadValidated(k).spec;
    // key+plain: the build's decal patterns off for the picture (the Petrel's dark pattern hid its inside - the user 9 Nov)
    if (/\+plain$/.test(k0)) {
      if (sp.finish && sp.finish.decals) for (const d of Object.keys(sp.finish.decals)) if (/^m\d+On$/.test(d)) sp.finish.decals[d] = 0;
      // ...and the exterior in white gelcoat (the root section `body`: the carbon row's raw finish is near black)
      sp.finish = Object.assign({}, sp.finish); sp.finish.sections = Object.assign({}, sp.finish.sections, { body: { fin: 'gelcoat' } });
      sp.__plainSkin = 1;   // (every exterior section too, read off the page's AEROSKIN roles below: a hull's skin is not under body)
    }
    if (row) { for (const w of sp.wings || []) w.material = row;   // (the garage reads its own row: wgCons, _cage_wing.js's states)
      const st = [null, 'carbon', 'steel', 'fabric', 'alloy', 'aluFabric', 'glass'].indexOf(row);
      if (st > 0) sp.cage = Object.assign({}, sp.cage, { wgCons: st }); }
    if (/\+light$/.test(k0)) sp.cage = Object.assign({}, sp.cage, { lightOn: 1, li_land: 1 });
    return sp; } });
  else if (BUILD) for (const f of BUILD.split(',')) LIST.push({ key: path.basename(f).replace(/\.json$/, ''), spec: () => { const j = JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')); return j.spec || j; } });
  if (!LIST.length) LIST.push({ key: 'stand', spec: () => null });
  let first = true;
  for (const B of LIST) {
  const OUTk = LIST.length > 1 ? OUT + '_' + B.key : OUT;
  const spec = B.spec();
  if (spec) {
    await pg.evaluate(s => {
      if (s.__plainSkin) { delete s.__plainSkin; try { for (const k of Object.keys(AERO_ROLE)) if (['skin', 'rail', 'pillar', 'liner', 'struct'].includes(AERO_ROLE[k]) && !(s.finish.sections[k] && s.finish.sections[k].fin)) s.finish.sections[k] = { fin: 'gelcoat' }; } catch (e) {} }
      window.GARAGE_SPEC.set(s); const f = document.getElementById('gFleet'); if (f) f.style.display = 'none'; return 1; }, spec);
    console.log('wing_struct_shot: ' + B.key + ' set ' + el());
  }
  await sleep(first ? +opt('wait', 20000) : +opt('wait2', 15000));
  await pg.evaluate(() => { [...document.querySelectorAll('button,a,div')].filter(x => /keep the current build/i.test(x.textContent || '') && x.children.length === 0).forEach(x => x.click()); return 1; });
  await sleep(2000);
  // the panels away, the aeroplane alone (garage_shot.js --clean)
  await pg.evaluate(() => { const c = document.querySelector('canvas'), keep = new Set(); let e = c; while (e) { keep.add(e); e = e.parentElement; }
    document.querySelectorAll('body *').forEach(el => { if (!keep.has(el) && !el.contains(c)) el.style.visibility = 'hidden'; });
    try { if (window.FLIGHT_PROBE.balanceShow) window.FLIGHT_PROBE.balanceShow(false); } catch (e) {} return 1; });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const info = await pg.evaluate(() => { const W = window.CAGE_WING, E = window.CAGE_ENG;
    return JSON.stringify({ name: (window.GARAGE_SPEC.get().meta || {}).name, wing: !!W, def: !!(W && W.def),
      eng: E ? { mount: E.mount, fwW: E.spec && E.spec.fwW, units: (E.units || []).map(u => ({ at: u.at && u.at.map(v => +v.toFixed(2)), faceZ: u.faceZ && +u.faceZ.toFixed(2) })) } : null }); });
  console.log('wing_struct_shot: ' + info);
  if (argv.includes('--boxes')) console.log('wing_struct_shot: boxes ' + await pg.evaluate(() => {
    const T = window.THREE, V = window.CAGE_VIEW, x0 = V.xray; V.xray = 1; window.CAGE_UI.build();
    const out = {}, S = window.CAGE_UI_SCENE;
    const bx = o => { const b = new T.Box3().setFromObject(o); return [b.min, b.max].map(v => [v.x, v.y, v.z].map(n => +n.toFixed(2))); };
    S.traverse(o => { if (/^cageLayer:(wing|wingStruct)$/.test(o.name || '')) { out[o.name] = bx(o); o.children.forEach(c => { if (c.userData && c.userData.wingStruct) out[c.name] = bx(c); }); } });
    out.root = bx(S); out.info = window.CAGE_WINGSTRUCT && window.CAGE_WINGSTRUCT.layer() ? window.CAGE_WINGSTRUCT.layer().userData.wingStruct.planes.map(p => [p.kind, p.halves]) : null;
    V.xray = x0; window.CAGE_UI.build(); return JSON.stringify(out); }));
  for (const v0 of FICHE) {
    const v = v0.replace(/-nows$/, ''), nows = v0 !== v;   // 'cutaway-nows': the cutaway with the structure off (master's)
    const r = await pg.evaluate(async ([v, nows]) => {
      const keep = window.CAGE_WINGSTRUCT; if (nows) window.CAGE_WINGSTRUCT = null;
      let rec; try { rec = await window.PLANE_FICHE.generate({ name: 'ws', only: [v], store: false }); }
      catch (e) { return { err: String(e && e.message || e) }; } finally { window.CAGE_WINGSTRUCT = keep; }
      const L = window.CAGE_WINGSTRUCT && window.CAGE_WINGSTRUCT.layer();
      const blob = rec.pics[v]; if (!blob) return null;
      const buf = new Uint8Array(await blob.arrayBuffer()); let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), time: window.PLANE_FICHE.lastTime, ws: L ? L.userData.wingStruct : null };
    }, [v, nows]);
    if (!r || r.err) { console.log('wing_struct_shot: ' + v0 + ' refused: ' + (r && r.err)); continue; }
    const f = OUTk + '_fiche_' + v0 + '.webp'; fs.writeFileSync(f, Buffer.from(r.b64, 'base64'));
    console.log('wing_struct_shot: wrote ' + f + ' ' + JSON.stringify(r.time) + ' ' + el());
  }
  const PRE = { q: [0.85, 0.22, 11], s: [Math.PI / 2, 0.05, 12], f: [0, 0.08, 11], t: [0.6, 1.25, 12], under: [0.6, -0.30, 10], low: [2.3, 0.10, 9.5] };
  for (const v of GARAGE) {
    const base = v.replace(/[xc]+$/, ''), xr = /x/.test(v.slice(base.length)), cut = /c/.test(v.slice(base.length));
    await pg.evaluate(([xr, cut]) => {
      const x = document.getElementById('xray'); if (x && x.checked !== xr) x.click();
      const c = document.getElementById('cutaway'); if (c && c.checked !== cut) c.click();
      return 1;
    }, [xr, cut]);
    await sleep(3000);
    const p = PRE[base] || PRE.q;
    await pg.evaluate(p => { window.FLIGHT_PROBE.camSet(p[0], p[1], p[2]); return 1; }, p);
    await sleep(6000);
    const f = OUTk + '_garage_' + v + '.png';
    await pg.screenshot({ path: f });
    console.log('wing_struct_shot: wrote ' + f + ' ' + el());
  }
  first = false;
  }
  // ---- THE CRASH (--crash): the last build rolled out and staged into a trunk off the centreline (the wing strikes it),
  // dmg_wreck_stills.js's own staging and eye (its page functions, read off its file), then the same frozen frame shot
  // with the wing's structure and without it (its meshes hidden: the covering's tears as before WING-STRUCTURE)
  if (argv.includes('--crash')) {
    const src = fs.readFileSync(path.join(__dirname, 'dmg_wreck_stills.js'), 'utf8');
    const fnOf = name => { const i = src.indexOf((/^page(Stage|RunOn)/.test(name) ? 'async ' : '') + 'function ' + name + '(');
      if (i < 0) throw new Error('no ' + name + ' in dmg_wreck_stills.js'); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
    const FN = ['pageRunOn', 'pageStageW', 'pageStage', 'pageView'].map(fnOf).join('\n');
    const pev = (body, arg) => pg.evaluate(new Function('arg', '"use strict"; return (async () => { ' + FN + '\n' + body + ' })();'), arg);
    // the roll-out: the stand's own button, then a live flight
    await pg.evaluate(() => { const g = document.getElementById('bGo'); if (g) g.click(); return g ? g.textContent : null; });
    await pg.waitForFunction(() => { const P = window.FLIGHT_PROBE; try { return !!(P && P.sim() && P.model() && !P.inGarage()); } catch (e) { return !!(P && P.sim() && P.sim().t > 0.2); } }, null, { timeout: 1800000, polling: 3000 });
    await sleep(15000);
    console.log('wing_struct_shot: rolled out ' + el());
    const off = +opt('off', 2.5);
    // software GL draws the world at seconds a frame: the crash runs on a postage stamp, the stills at full size
    await pg.setViewportSize({ width: 320, height: 200 }); await sleep(3000);
    // (the page-stepped mode, ?simw=0 - the stills rig's: staged, then stepped two steps a frame in the page; the worker
    // mode never advanced in a headless cloud page)
    const CO = { kind: 'trunk', D: 40, agl: 4, V: 30, off, steps: +opt('steps', 1200) };
    await pev('return await pageStage(arg);', Object.assign({}, CO, { placeOnly: true }));
    const r = await pev('return await pageStage(arg);', Object.assign({}, CO, { run: true }));
    console.log('wing_struct_shot: crash run ' + JSON.stringify(r && { err: r.err, broken: r.broken, crashed: r.crashed, simT: r.simT, frames: r.frames }).slice(0, 300));
    // ...and on until the wreck has broken and stands (or 6 min)
    for (let i = 0; i < 120; i++) {
      const st = await pg.evaluate(() => { const P = window.FLIGHT_PROBE, D = P.damage && P.damage(); const W = window.FLYDIY_WRECK_STATS ? window.FLYDIY_WRECK_STATS() : null;
        return { crashed: !!(D && D.crashed), broken: D && D.broken ? D.broken.length : 0, rest: !!(W && W.bodies.every(b => b.asleep)), t: P.sim().t }; });
      if (i % 10 === 0) console.log('wing_struct_shot: crash state ' + JSON.stringify(st));
      if (st.crashed && st.broken && st.rest && i > 5) break;
      await sleep(3000);
    }
    await pg.evaluate(() => { const pz = document.getElementById('bPause'); if (pz && /pause/i.test(pz.textContent)) pz.click(); return 1; });
    await pg.setViewportSize({ width: W, height: H }); await sleep(5000);
    console.log('wing_struct_shot: crash ' + JSON.stringify(r && { crashed: r.crashed, broken: r.broken, wall: r.wall, frameMed: r.frameMed, err: r.err }) + ' ' + el());
    const ws = await pg.evaluate(() => { const m = window.FLIGHT_PROBE.model(); return m && m.wsInfo ? m.wsInfo.planes.map(p => [p.kind, p.halves]) : null; });
    console.log('wing_struct_shot: wreck structure ' + JSON.stringify(ws));
    for (const cam of (opt('cams', 'brkq:18:7,q34:20:12').split(','))) {
      const [a, e2, d] = cam.split(':'); const az = isNaN(+a) ? a : +a;
      if (a === 'wsq' || a === 'wss') {   // the free eye on the WING's breaks: the median of the broken wing members' live ends
        await pg.evaluate(([a, el, dist]) => {
          const P = window.FLIGHT_PROBE, sim = P.sim(), df = P.def(), Dm = sim.damage(), p = sim.p, WN = new Set();
          for (const Pl of (df.parts.planes || [df.parts])) for (const sd of ['L', 'R']) { const f = Pl.wf && Pl.wf[sd]; if (f) for (const i of (f.F || []).concat(f.R || [])) WN.add(i); }
          const xs = [], ys = [], zs = [];
          for (const bi of Dm.broken) { const b = sim.beams[bi]; if (!(WN.has(b.a) && WN.has(b.b))) continue; for (const i of [b.a, b.b]) { xs.push(p[i * 3]); ys.push(p[i * 3 + 1]); zs.push(p[i * 3 + 2]); } }
          const med = A => { A.sort((x, y) => x - y); return A[A.length >> 1]; };
          const g = sim.cgPos(), c = xs.length ? [med(xs), med(ys), med(zs)] : g;
          const [xA] = sim.axes(), h = Math.atan2(-xA[2], -xA[0]) + (a === 'wss' ? Math.PI / 2 : 0.7), e = el * Math.PI / 180;
          const E = [c[0] + dist * Math.cos(e) * Math.cos(h), c[1] + dist * Math.sin(e), c[2] + dist * Math.cos(e) * Math.sin(h)];
          const dx = c[0] - E[0], dy = c[1] - E[1], dz = c[2] - E[2];
          P.devFree(E[0], E[1], E[2], Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
          return 1; }, [a, +e2, +d]);
        await sleep(1500);
      } else await pev('return await pageView(arg);', [az, +e2, +d]);
      await pg.evaluate(() => { const c = document.querySelector('canvas'), keep = new Set(); let e = c; while (e) { keep.add(e); e = e.parentElement; }
        document.querySelectorAll('body *').forEach(x => { if (!keep.has(x) && !x.contains(c)) x.style.visibility = 'hidden'; }); return 1; });
      for (const on of [true, false]) {
        await pg.evaluate(on => { const m = window.FLIGHT_PROBE.model(); for (const r of (m && m.wsRigs) || []) r.mesh.visible = on; return 1; }, on);
        await sleep(5000);
        const f = OUT + '_crash_' + String(a) + '_' + (on ? 'with' : 'without') + '.png';
        await pg.screenshot({ path: f }); console.log('wing_struct_shot: wrote ' + f + ' ' + el());
      }
    }
  }
  await b.close(); if (srv) srv.close();
})().catch(e => { console.error('wing_struct_shot: ' + (e && e.stack || e)); process.exit(1); });
