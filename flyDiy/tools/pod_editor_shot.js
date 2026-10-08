#!/usr/bin/env node
// pod_editor_shot.js - THE BELLY POD'S SECTION ON THE REAL PAGE (G2675-G2679, BELLY-POD-2). index.html served by
// tools/_serve.js in headless Chromium on SwiftShader. STILLS OF A LOADED PAGE ONLY: the boot overlay gone (BOOT.state
// 'gone', #boot hidden) and 2 s more. One boot; on each validated build, loaded into the garage WITHOUT a pod:
//   the tree's "Belly pod" node clicked, the section's `fitted` box ticked (the editor's own door: GARAGE_SPEC.update),
//   the volume slider moved (the range's own input / change events) on the three fitting builds, the shakedown
//   awaited (the section's readouts off "measuring"), the camera low on the quarter, and the still:
//     cub / c172 / floats   the pod fitted and sized - every readout, no red
//     jodel                 the default pod - REFUSED in red: full, its static margin goes negative (the Jodel's
//                           refusal, GATE POD's trials)
//   then on the Cub the box unticked: the spec's `pod` key GONE (GARAGE_SPEC.remove), the mesh gone.
// The page's own answers go to shots.json (the section's text, its red lines, the spec's pod, the drawn mesh).
//
//   node tools/_serve.js 8125 &   node tools/pod_editor_shot.js [--out reports/evidence/POD2] [--port 8125]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
  catch (e2) { console.log('pod_editor_shot: no playwright here - nothing pictured'); process.exit(0); }
}
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/POD2'));
const PORT = +opt('port', 8125);
const URL0 = 'http://127.0.0.1:' + PORT + '/flyDiy/index.html?audio=0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BUILDS = [
  { k: 'cub', file: 'builds/cub_2026-09-20_corrected.json', litres: 160, note: 'the user\'s Cub: a 160 L pod fitted' },
  { k: 'c172', file: 'builds/cessna172_2026-09-20_corrected.json', litres: 160, note: 'the Cessna 172: a 160 L pod fitted' },
  { k: 'floats', file: 'bugReports/cessnaFloatsWOrks.json', litres: 220, note: 'the Cessna on floats: a 220 L pod, clear of the water' },
  { k: 'jodel', file: 'builds/jodel_2026-09-20_corrected.json', litres: null, note: 'the Jodel: the default pod - refused in red (full, the static margin negative)' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const fails = [], errs = [], index = [];
  const check = (c, what) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what); return c; };
  const ev = (pg, fn, arg) => pg.evaluate(fn, arg);
  const until = async (pg, fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pg.evaluate(fn, arg)) return true; } catch (e) {} await sleep(500); } return false; };
  const pg = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  pg.on('pageerror', e => errs.push(String(e).slice(0, 400)));
  const t0 = Date.now();
  await pg.goto(URL0);
  await until(pg, () => window.BOOT && window.BOOT.state === 'gone' && (() => { const b = document.getElementById('boot'); return !b || getComputedStyle(b).display === 'none' || b.classList.contains('gone'); })(), 900000);
  await sleep(2000);
  await ev(pg, () => { const b = [...document.querySelectorAll('#dfBirth button')].find(e => /keep the current/i.test(e.textContent)); if (b) b.click(); });
  await sleep(800);
  console.log('pod_editor_shot: the page up in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  const probe = () => ev(pg, () => {
    const sec = document.querySelector('.edRoot[data-panel="pod"]'), sp = window.GARAGE_SPEC.get();
    return { hasPodKey: 'pod' in sp, pod: sp.pod || null, panel: sec ? sec.innerText.replace(/\n+/g, ' | ').slice(0, 1400) : null,
             red: sec ? [...sec.querySelectorAll('.podWhy.bad')].map(e => e.textContent) : [],
             redRows: sec ? sec.querySelectorAll('.podL.bad').length : 0,
             mesh: !!window.CAGE_POD_MESH, tris: window.CAGE_POD_MESH ? window.CAGE_POD_MESH.nt : 0,
             measuring: sec ? /measuring/.test(sec.innerText) : null, boot: window.BOOT && window.BOOT.state };
  });
  for (const B of BUILDS) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, B.file), 'utf8')), spec = j.spec || j;
    delete spec.pod;
    await ev(pg, s => { window.GARAGE_SPEC.set(s); }, spec);
    await until(pg, () => !!(window.GARAGE_SPEC.resolved && window.GARAGE_SPEC.resolved()), 120000);
    await sleep(3000);
    await ev(pg, () => { const n = document.querySelector('#edTree .edN[data-p="pod"]'); if (n) n.click(); });
    await until(pg, () => !!document.getElementById('p_pod_on'), 20000);
    const p0 = await probe();
    check(!p0.hasPodKey && !p0.mesh, B.k + ': loaded with no pod - no key in the spec, nothing drawn');
    await ev(pg, () => { const c = document.getElementById('p_pod_on'); c.checked = true; c.onchange(); });
    await until(pg, () => !!document.getElementById('p_pod_litres') && !!window.CAGE_POD_MESH, 60000);
    if (B.litres) {
      await ev(pg, L => { const i = document.getElementById('p_pod_litres'); i.value = L; i.oninput(); i.onchange(); }, B.litres);
      await sleep(500);
    }
    await until(pg, () => { const s = document.querySelector('.edRoot[data-panel="pod"]'); return s && !/measuring/.test(s.innerText); }, 120000);
    await ev(pg, () => window.FLIGHT_PROBE && window.FLIGHT_PROBE.camSet(1.95, -0.18, 7.5));
    await sleep(2500);
    const st = await probe();
    const f = 'pod_editor_' + B.k + '.jpg';
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 84, timeout: 180000 });
    index.push(Object.assign({ build: B.k, file: f, note: B.note }, st));
    console.log('  ' + f + '  ' + B.note + '\n    ' + (st.panel || '').slice(0, 600));
    check(st.hasPodKey && st.pod && +st.pod.on === 1 && st.mesh && !st.measuring, B.k + ': fitted from the section - the spec carries it, the mesh is drawn, every readout measured');
    if (B.litres) check(st.red.length === 0, B.k + ': no red (' + st.red.join('; ') + ')');
    else check(st.red.some(r => /static margin/.test(r)), B.k + ': REFUSED in red - ' + st.red.join('; '));
    if (B.k === 'jodel') continue;
  }
  // the Cub again: the box unticked -> the key removed, the mesh gone
  {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, BUILDS[0].file), 'utf8')), spec = j.spec || j;
    spec.pod = { on: 1 };
    await ev(pg, s => { window.GARAGE_SPEC.set(s); }, spec);
    await until(pg, () => !!window.CAGE_POD_MESH, 120000);
    await ev(pg, () => { const n = document.querySelector('#edTree .edN[data-p="pod"]'); if (n) n.click(); });
    await until(pg, () => !!document.getElementById('p_pod_on'), 20000);
    await ev(pg, () => { const c = document.getElementById('p_pod_on'); c.checked = false; c.onchange(); });
    await sleep(3000);
    const st = await probe();
    check(!st.hasPodKey && !st.mesh, 'cub: unticked - the spec\'s pod key REMOVED (the aeroplane\'s own bytes), the mesh gone');
    index.push(Object.assign({ build: 'cub', file: null, note: 'unticked: the key removed' }, st));
  }
  check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ what: 'BELLY-POD-2 editor stills (G2675): a loaded page only (BOOT gone, #boot hidden, + 2 s)', renderer: 'SwiftShader (headless Chromium)', fails, errors: errs, shots: index }, null, 1) + '\n');
  await browser.close();
  console.log('pod_editor_shot: ' + (fails.length ? fails.length + ' FAILED' : 'all checks ok') + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  process.exitCode = fails.length ? 1 : 0;
})().catch(e => { console.log(String(e && e.stack || e)); process.exitCode = 1; });
