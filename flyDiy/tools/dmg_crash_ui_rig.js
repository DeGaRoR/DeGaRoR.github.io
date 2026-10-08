// DMG-D4b (train 41; the user: "no more cards in the middle of the screen, ever. That's for enjoying the crash"): THE
// CENTRE OF THE SCREEN AFTER A CRASH, on the box (real Chrome through tools/live_driver.js - the node page has no layout).
// The page booted and rolled out (the job's boot.sh), ?damage=1, the physics worker (the default) or ?simw=0: the hard
// staging (30 m/s, 1 m up, a 0.5 m trunk 40 m ahead: the Cub breaks up), the flight's end (its card) + 2 s, then every
// visible element of the interface is measured: none may enter the central 50 % x 50 % of the view (the bound: x in
// [25 %, 75 %] of innerWidth, y in [25 %, 75 %] of innerHeight). A still is saved. Elements the size of the view (the
// interface's own containers) are not cards; the WebGL canvas is the wreck itself.
// Usage: node tools/dmg_crash_ui_rig.js --cmd=8572 --out=<dir> --tag=<worker|inline>
const http = require('http'), fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const CMD = +arg('cmd', 8572), OUT = arg('out', '.'), TAG = arg('tag', 'worker');
const post = (route, body) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port: CMD, path: route, method: 'POST' }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }); r.on('error', rej); r.end(body); });
const get = route => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: CMD, path: route }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }).on('error', rej));
const run = async js => { const b = await post('/run', js); try { return JSON.parse(b); } catch (e) { return b; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STAGE = `
  const FP = FLIGHT_PROBE; window.FLYDIY_SKINBREAK = true; window.FLYDIY_WRECK = true; FP.setManual(true);
  const sim = FP.sim(), world = FP.world(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
  const c = sim.cgPos(), g = world.terrainH(c[0], c[2]); let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
  await FP.place({ at: [c[0], g + 1 + (c[1] - yMin), c[2]], zeroV: true, dv: [30 * fx, 0, 30 * fz] });
  const c2 = sim.cgPos(), tx = c2[0] + fx * 40, tz = c2[2] + fz * 40;
  world.treeHits.set('fill:crashui', [tx, tz, world.terrainH(tx, tz), 0.5, world.terrainH(tx, tz) + 10]); sim.ctl.thr = 0;
  window.__crashUiT0 = performance.now();
  return JSON.stringify({ placed: true, simw: !!(window.FLYDIY_SIMW && FLYDIY_SIMW.state().flight) });`;

const MEASURE = `
  const W = innerWidth, H = innerHeight, x0 = W * 0.25, x1 = W * 0.75, y0 = H * 0.25, y1 = H * 0.75, all = [], bad = [];
  for (const el of document.querySelectorAll('body *')) {
    if (/^(CANVAS|SCRIPT|STYLE|LINK|META|TEMPLATE)$/.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility !== 'visible' || +cs.opacity === 0) continue;
    let gone = false; for (let q = el.parentElement; q; q = q.parentElement) { const s = getComputedStyle(q); if (s.display === 'none' || +s.opacity === 0) { gone = true; break; } }
    if (gone) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H) continue;
    if (r.width >= 0.8 * W && r.height >= 0.8 * H) continue;   // (the interface's own full-view containers: not cards)
    const txt = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const bd = cs.borderStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0;
    if (!(txt || bg || bd || cs.backgroundImage !== 'none' || /^(IMG|BUTTON|INPUT|SELECT|svg)$/.test(el.tagName))) continue;
    const id = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
    const box = { id, r: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], text: (el.textContent || '').trim().slice(0, 50) };
    all.push(box);
    if (r.left < x1 && r.right > x0 && r.top < y1 && r.bottom > y0) bad.push(box);
  }
  const FP = FLIGHT_PROBE, S = FP.structural ? FP.structural() : null, WS = window.FLYDIY_WRECK_STATS ? FLYDIY_WRECK_STATS() : null;
  return JSON.stringify({ view: [W, H], bound: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)], over: FP.over(), damage: FP.damage(), structural: S,
    crewOff: WS ? WS.crewOff : null, arrCard: (() => { const e = document.getElementById('arrCard'); return e ? { hidden: e.hidden, cls: e.className } : null; })(),
    award: (() => { const e = document.getElementById('bAward'); return e ? { hidden: e.hidden, cls: e.className } : null; })(), visible: all.length, inCentre: bad, all });`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('stage', await run(STAGE));
  // the crash runs in real time; the card waits for the wreck (G1868's watch): up to 60 s, then the overlay + 2 s
  let over = false;
  for (let i = 0; i < 120 && !over; i++) { await sleep(500); over = await run('return FLIGHT_PROBE.over();') === true; }
  await run("const T = FLIGHT_PROBE.world().treeHits; T.drop ? T.drop('fill:crashui') : T.delete && T.delete('fill:crashui'); return 1;");
  await sleep(2000);
  const M = await run(MEASURE);
  await get('/shot?f=' + encodeURIComponent(path.join(OUT, 'crash_ui_' + TAG + '.png')));
  fs.writeFileSync(path.join(OUT, 'crash_ui_' + TAG + '.json'), JSON.stringify(Object.assign({ tag: TAG, over }, M), null, 1));
  const ok = over && M && M.inCentre && M.inCentre.length === 0;
  console.log('CRASHUI ' + TAG + ': the flight ended ' + over + '; view ' + (M && M.view) + ', the central bound ' + (M && JSON.stringify(M.bound)) + '; ' + (M ? M.visible : '?') + ' visible elements, in the centre: ' + JSON.stringify(M && M.inCentre));
  console.log('  card ' + JSON.stringify(M && M.arrCard) + ', award ' + JSON.stringify(M && M.award) + ', structural ' + JSON.stringify(M && M.structural) + ', crew hidden ' + (M && M.crewOff));
  console.log('CRASHUI ' + TAG + ': ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('CRASHUI rig error', e && e.stack); process.exit(2); });
