#!/usr/bin/env node
// THE SOUND SECTION, IN THE REAL PAGE (G1658, SND-AMB-1; the user: "drop a point sound, draw a polygon sound").
// Headless Chromium (Playwright, swiftshader) on the BUILT index.html served from the repo: the game boots on Jolene, a
// click unlocks the sound (the gesture), the world editor opens (PREMISES_EDITOR.openEditor, as the WORLD menu's button),
// and the editor's own script API (PREMISES_UI handle.cmd - the same paths the mouse runs) drops a POINT SOUND (loons, by
// the stand), draws a SOUND AREA (the harbour bed, over the heath), silences a bed with an OFF area, drags the point,
// probes what is heard. It records what the page says (the record, the renderer's marks, the ambience's drawn sounds and
// targets, the rebuild's cost against a zone's) and screenshots the map and the inspector.
//   node tools/audio/sound_editor_proof.js --url http://127.0.0.1:8777/flyDiy/index.html
//   -> reports/evidence/SND-AMB-1/editor/: map.png, inspector_point.png, inspector_probe.png, proof.json
// (a box with a GPU: drop the swiftshader flags; A0's rigs measure frame times, this proves the paths)
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://127.0.0.1:8777/flyDiy/index.html');
const OUT = path.join(__dirname, '..', '..', 'reports', 'evidence', 'SND-AMB-1', 'editor');
const log = s => console.log('  ' + s);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined;
  const browser = await chromium.launch({ headless: true, executablePath: exe,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load', timeout: 180000 });
  log('loaded in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  await page.waitForFunction(() => window.PREMISES_EDITOR && window.BOOT && window.BOOT.state === 'gone', null, { timeout: 600000, polling: 1000 });
  log('booted in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  // out of the shed (master_bench's own way): keep the build the chooser offers, Roll out, wait for the flight
  await page.evaluate(() => { const k = [...document.querySelectorAll('button, a, span, div')].find(b => /^keep the current build$/i.test((b.textContent || '').trim()) && b.offsetParent); if (k) k.click(); });
  await page.waitForTimeout(800);
  const ro = await page.evaluate(() => { const g = document.getElementById('bGo'); const l = [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent) && b.offsetParent);
    const b = g && g.offsetParent && /roll out/i.test(g.textContent) ? g : l[0]; if (!b) return 'no button'; b.click(); return b.id || 'button'; });
  log('roll out: ' + ro);
  await page.waitForFunction(() => !document.body.classList.contains('mode-ws') && (() => { const L = window.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return !t || t.done; })(), null, { timeout: 900000, polling: 1000 });
  await page.waitForTimeout(3000);
  log('flying at ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  await page.mouse.click(700, 430);   // the gesture: the sound's context, the ambience's source
  await page.waitForTimeout(500);
  const opened = await page.evaluate(async () => {
    const P = window.PREMISES_EDITOR; P.openEditor();
    for (let i = 0; i < 600 && !P.ed; i++) await new Promise(r => setTimeout(r, 200));
    return !!P.ed;
  });
  if (!opened) throw new Error('the editor did not open');
  log('editor open at ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  const proof = await page.evaluate(async () => {
    const P = window.PREMISES_EDITOR, ed = P.ed, R = P.R, out = { steps: [] };
    const settle = ms => new Promise(r => setTimeout(r, ms));
    const step = (what, v) => out.steps.push([what, v]);
    out.audio = { state: window.AUDIO && window.AUDIO.state, ambience: !!window.AMBIENCE, beds: window.AMBIENCE_MODEL ? window.AMBIENCE_MODEL.NB : 0 };
    ed.cmd('section', { name: 'sounds' });
    out.sectionTools = Array.from(document.querySelectorAll('#premPanel button')).map(b => b.textContent.trim()).filter(t => /sound|probe|select/i.test(t)).slice(0, 8);
    // 1. a POINT SOUND: the loons, 80 m off the stand (Jolene's premises frame is the world's: anchor 0, 0, yaw 0)
    ed.cmd('soundPick', { key: 'amb.loons' });
    ed.cmd('tool', { name: 'soundpt' });
    const tz = performance.now();
    const pt = ed.cmd('click', { x: -100, z: 640 });
    out.pointMs = +(performance.now() - tz).toFixed(1);
    step('point sound', pt);
    // 2. a SOUND AREA: the harbour's bed over the heath north of the strip (four corners, closed)
    ed.cmd('soundPick', { key: 'amb.harbour' });
    ed.cmd('tool', { name: 'soundarea' });
    for (const [x, z] of [[150, -700], [450, -700], [450, -400], [150, -400]]) ed.cmd('point', { x, z });
    const ta = performance.now();
    const area = ed.cmd('commit');
    out.areaMs = +(performance.now() - ta).toFixed(1);
    step('sound area', area);
    // 3. an OFF area: the airfield's bed silenced around the stand
    ed.cmd('soundPick', { key: 'amb.airfield' });
    ed.cmd('tool', { name: 'soundarea' });
    for (const [x, z] of [[-260, 620], [-60, 620], [-60, 800], [-260, 800]]) ed.cmd('point', { x, z });
    const off = ed.cmd('commit');
    ed.cmd('set', { id: off, patch: { on: false } });
    step('off area', off);
    // 4. drag the point 30 m east (the editor's three beats)
    ed.cmd('tool', { name: 'select' }); ed.select(pt);
    out.beforeDrag = { pt, selected: ed.selected, entry: JSON.stringify(window.PREMISES_GEN.findById(ed.record(), pt)) };
    const hs = R.handles(pt).map(h => h.key);
    let dragOk = null;
    try {
      dragOk = ed.cmd('dragStart', { key: hs[0] });
      for (let k = 1; k <= 6; k++) ed.cmd('dragMove', { x: -100 + 5 * k, z: 640 });
      ed.cmd('dragEnd');
    } catch (e) { out.dragError = String(e && e.stack || e).split('\n').slice(0, 4).join(' | '); }
    step('drag', { handles: hs, started: dragOk });
    await settle(300);
    const rec = ed.record();
    out.record = rec.layers.sounds;
    out.issues = window.PREMISES_GEN.issues(rec).filter(i => /^sound/.test(i));
    // the renderer's marks: every line R drew for a sound (a point's pin, core and reach rings; an area's outline and reach)
    const marks = [];
    R.scene && 0;
    (function walk(o) { if (!o) return; if (o.name && /^sounds:/.test(o.name)) marks.push(o.name); (o.children || []).forEach(walk); })(R.root || R.group || (window.WORLD && window.WORLD.scene) || null);
    out.marks = marks;
    // the ambience: what it holds of the drawn sounds, and what the probe hears
    const A = window.AMBIENCE;
    out.ambienceSounds = A ? A.state.sn[0] : null;
    out.heardAtPoint = ed.cmd('heard', { x: -70, z: 640 });
    out.heardInArea = ed.cmd('heard', { x: 300, z: -550 });
    out.heardAtStand = ed.cmd('heard', { x: -154, z: 712 });
    // the rebuild's cost: a sound edit (its marks only) against a zone's (a composition)
    const sT0 = performance.now(); ed.cmd('set', { id: pt, patch: { on: true } }); const soundEdit = performance.now() - sT0;
    const z = rec.layers.zones[0];
    let zoneEdit = null;
    if (z) { const zT0 = performance.now(); ed.cmd('set', { id: z.id, patch: { density: z.density } }); zoneEdit = performance.now() - zT0; }
    out.editMs = { sound: +soundEdit.toFixed(1), zone: zoneEdit == null ? null : +zoneEdit.toFixed(1) };
    // the undo stack: three steps back removes the off area's patch, the off area, ...
    return out;
  });
  log('sounds in the record: ' + proof.record.length + ' · marks drawn: ' + proof.marks.length + ' · the ambience holds ' + proof.ambienceSounds);
  // the pictures: the map framed on the stand, the point selected; the inspector after a probe
  await page.evaluate(() => { const P = window.PREMISES_EDITOR, ed = P.ed; const pt = ed.record().layers.sounds[0].id; ed.select(pt);
    if (P.host && P.host.cameras && P.host.cameras.frame) P.host.cameras.frame({ x0: -700, z0: 100, x1: 500, z1: 1100 }); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'map.png') });
  // the editor's panel: its box off the page (an element shot waits for 'stable', which a live page never is)
  const box = async () => page.evaluate(() => { const p = window.PREMISES_EDITOR.panel || document.querySelector('.premPanel'); if (!p) return null; const r = p.getBoundingClientRect(); return r.width > 10 ? { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth), height: Math.min(r.height, innerHeight) } : null; });
  let clip = await box();
  if (clip) await page.screenshot({ path: path.join(OUT, 'inspector_point.png'), clip });
  await page.evaluate(() => { const ed = window.PREMISES_EDITOR.ed; ed.select(null); ed.cmd('tool', { name: 'probe' }); ed.cmd('click', { x: -70, z: 640 }); });
  await page.waitForTimeout(800);
  clip = await box();
  if (clip) await page.screenshot({ path: path.join(OUT, 'inspector_probe.png'), clip });
  proof.errors = errs;
  proof.bootS = +((Date.now() - t0) / 1000).toFixed(1);
  fs.writeFileSync(path.join(OUT, 'proof.json'), JSON.stringify(proof, null, 1));
  console.log(JSON.stringify(proof, null, 1).slice(0, 4000));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
