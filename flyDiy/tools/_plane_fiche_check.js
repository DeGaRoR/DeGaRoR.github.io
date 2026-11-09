#!/usr/bin/env node
// GATE PLANEFICHE - AIRCRAFT-BOARD: plane_fiche.js, the fiche's generator. Pure node (~1 s), its source and its pure parts;
// the drawing itself needs a page (a box run). What is held:
//   THE VIEWS     six, the user's "inverse hero" among them: the same lens from above, whole, wings on
//   THE AWARD     refused without the airworthiness certificate; a stored fiche is never removed but by forget, and a new one
//                 is stored only once drawn ("a plane having received one does not lose it")
//   THE MATTE     on a known draw: a solid pixel, a half-covered one, the background out, the row order, the crop
//   THE CLONE     Material.clone() drops the finish's shader step: dup carries it back (the twin's white wing, 4 Nov)
//   THE TARGET    display-space (aa_resolve.js's flag), restored; build.js loads it after plane_thumb.js
// PLANE-RENDERS R3 (8 Nov), the fiche in the game (src/viewer/fiche_board.js):
//   THE LIVE DRAW  the shed holds its frame (FLYDIY_UI_HOLD) for the whole draw and is let go in the finally; the studio's
//                  programs compiled in slices (FLIGHT_PROBE.compileScreen) before the first picture and again after the cut;
//                  a picture is several tasks (black, white, matte + encode); no shot mode (it re-insets the canvas)
//   THE AWARD      bench.js calls FICHE_BOARD.certified() beside BENCH_CERTIFIED (the story's slot is never taken); in a stub
//                  page: nothing drawn at the call, nor while the certificate's card is up, nor without a save's name, nor out
//                  of the garage; one draw once all hold; a certificate gone before then draws nothing; a save without a
//                  pending award draws nothing
//   THE DOORS      garage.js: saved() at a save, forget() at both deletes, rowButton() on the fleet's rows; card_drag.js
//                  registers #pfBoard (by its header) and #pfNote; build.js loads fiche_board.js after plane_fiche.js; the
//                  share goes through navigator.share with files, else a saved file
// THE USER'S RULES (9 Nov, on the Cub's fiche - flyDiy/HANDOVER.md, "FICHE RULES"):
//   THE SPINNING PROP  the hero's propeller is the game's disc (prop_disc.js) at full weight, the blades hidden; the hero only
//   THE TITLE          the plane's own display name, never a file key ("piperCub" -> "Piper Cub" through the baked index's `file`)
//   THE CUTAWAY        its eye pinned (50 round, 15 up: lower than the old 28, it reads wider); placed under the hero's measured
//                      wing line on the board and in the shared picture
//   THE SIGNATURE      the game's name from its one place (GAME_NAMES.game) + " · certified airworthy"
//   THE FRAME          a thin quiet rounded line round the whole sheet, on the board and in the shared picture
//   node tools/_plane_fiche_check.js [--selftest]  -> "GATE PLANEFICHE: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SELF = process.argv.includes('--selftest');
process.on('unhandledRejection', () => {});   // (a break's stray store call in a page with no IndexedDB: its own check reports it)
function load(src, W) {
  const ctx = { window: W, console, performance: { now: () => 0 }, Uint8ClampedArray, Uint8Array, Promise, JSON, Math, Map };
  vm.runInNewContext(src, ctx);
  return W.PLANE_FICHE;
}
async function run(S) {
  const { F, B } = S;
  const FB = S.FB, BE = S.BE, G = S.G, CD = S.CD;
  const fails = []; let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  ok(/const VIEWS = \['hero', 'above', 'side', 'plan', 'front', 'cutaway'\]/.test(F), 'the six views');
  ok(/shoot\('hero', heroCam\(T, F, HERO_W \/ HERO_H, 38, -28\)/.test(F), 'the hero: yaw 38, from below');
  ok(/shoot\('above', heroCam\(T, F, HERO_W \/ HERO_H, 38, 28\)/.test(F), 'the inverse hero: the same yaw, from above');
  ok(/38, 28\), HERO_W, HERO_H, false, CUT_STUDIO, F\)/.test(F), 'the inverse hero: its own lights, not the below view\'s');
  ok(/room\.forEach\(\(l, i\) => \{ l\.intensity = roomI\[i\] \* st\.room; \}\)/.test(F) && /room: 0\.35/.test(F) && /room\.forEach\(\(l, i\) => \{ l\.intensity = roomI\[i\]; \}\);\n\s*discsOff\(discs\);\n\s*if \(cut\) cutOff/.test(F), 'a view from above dims the room, and the room is put back');
  ok(/m\.n === w \* h\) throw/.test(F) && /m\.edge\) throw/.test(F), 'a picture that drew nothing or touches its frame stops the fiche');
  ok(/numbers\(spec, F, opts\.title \|\| opts\.name\)/.test(F) && /name: title \|\| \(spec\.meta/.test(F), 'the name is the save\'s or the list\'s, before the file\'s');
  ok(F.indexOf("only.includes('above')") < F.indexOf("V.xray = 1"), 'the inverse hero is drawn before the cut: whole, wings on');
  ok(/c\.onBeforeCompile = m\.onBeforeCompile; c\.customProgramCacheKey = m\.customProgramCacheKey/.test(F), 'dup carries the shader step');
  ok(/rt\.isXRRenderTarget = true/.test(F), 'the target is display-space');
  ok(/cutOff\(cut\)[\s\S]{0,400}R\.setRenderTarget\(rt0\)[\s\S]{0,600}root\.rotation\.x = pitch0/.test(F), 'the page is put back in a finally');
  ok(/draw\(o\)\.then\(async rec => \{ if \(o\.store !== false && rec\.name\) await tx\('readwrite', s => s\.put\(rec\)\)/.test(F), 'stored only once drawn');
  ok((F.match(/\.delete\(/g) || []).length === 1 && /forget\(name\) \{ return tx\('readwrite', s => s\.delete\(name\)\)/.test(F), 'only forget removes a fiche');
  ok(/'plane_thumb\.js', 'plane_fiche\.js'/.test(B), 'build.js loads it after plane_thumb.js');
  // ---- R3: the live draw
  ok(/hold\(true\); held = true;/.test(F) && /if \(held\) hold\(false\);\n\s*\}/.test(F) && /window\.FLYDIY_UI_HOLD\(!!on\)/.test(F), 'the shed holds its frame for the draw, let go in the finally');
  ok(F.indexOf("await warm('the pictures')") > 0 && F.indexOf("await warm('the pictures')") < F.indexOf("shoot('hero'"), 'the studio\'s programs before the first picture');
  ok(/await P\.compileScreen\(root, S\)/.test(F) && F.indexOf("cut = cutOn(") < F.indexOf("await warm('the cutaway')") && F.indexOf("await warm('the cutaway')") < F.indexOf("shoot('cutaway'"), 'the cutaway\'s programs after its cut, before its picture');
  ok(/const k = one\(black\); await yieldTask\(/.test(F) && /const wt = one\(white\); await yieldTask\(/.test(F), 'a picture is several tasks');
  ok(!/SHOT_MODE/.test(F), 'no shot mode (it re-insets the canvas)');
  ok(/names\(\) \{ return tx\('readonly', s => s\.getAllKeys\(\)\)/.test(F), 'the store lists its names');
  // ---- THE USER'S RULES (9 Nov)
  {
    const iD = F.indexOf("discs.push(...heroDiscs(T, root))"), iW = F.indexOf("await warm('the pictures')"), iH = F.indexOf("shoot('hero'"), iO = F.indexOf('discsOff(discs);   // the other views'), iA = F.indexOf("shoot('above'");
    ok(iD > 0 && iD < iW && iW < iH && iH < iO && iO < iA && /if \(only\.includes\('hero'\)\) discs\.push/.test(F), 'RULE the spinning prop: the discs made before the warm, for the hero only, taken off before the next view');
    ok(/PD\.make\(T, pg, tmp, \[0, 0, 1\]\)/.test(F) && /dc\.update\(2400, 0, 1, 0\)/.test(F) && /for \(const m of real\) m\.visible = false;/.test(F), 'RULE the spinning prop: the game\'s disc at full weight, the blades hidden');
    ok(/room\.forEach\(\(l, i\) => \{ l\.intensity = roomI\[i\]; \}\);\n\s*discsOff\(discs\);/.test(F), 'RULE the spinning prop: put back in the finally');
    ok(/const CUT_YAW = 50, CUT_EL = 15;/.test(F) && /shoot\('cutaway', heroCam\(T, Fc, CUT_W \/ CUT_H, CUT_YAW, CUT_EL\)/.test(F), 'RULE the cutaway\'s eye: 50 round, 15 up');
    ok(/if \(name === 'hero'\) data\.heroWingY = wingLine\(m, w\);/.test(F), 'RULE the cutaway: the hero\'s wing line measured on its picture');
    ok(/const title = titleOf\(name, await baked\(\)/.test(FB) && /nmS = titleOf\(d\.name \|\| name, bakedIdx\)/.test(FB) && /g\.fillText\(titleOf\(d\.name/.test(FB), 'RULE the title: the draw, the board and the share all through titleOf');
    ok(!/flyDiy ·/.test(FB) && /g\.fillText\(sig\(\)/.test(FB) && /sg\.textContent = sig\(\)/.test(FB) && /GAME_NAMES\.game/.test(FB), 'RULE the signature: the game\'s name from its one place, on the board and the share');
    ok(/^\s*game:\s*'[^']+',/m.test(S.N), 'RULE the signature: 01_names.js holds the game\'s name');
    ok(/\.pfFrame \{[^}]*border:1px solid #[0-9a-f]{6};[^}]*border-radius:\d+px/.test(FB) && /fr\.appendChild\(top\)/.test(FB) && /g\.roundRect\(24, 24, Wd - 48, Ht - 48, 28\)/.test(FB) && /g\.stroke\(\);/.test(FB), 'RULE the frame: a thin rounded line, on the board and the share');
    ok(/hr \? cutPlace\(d\.heroWingY, hr\.h, ch\)/.test(FB) && /const p = cutPlace\(d\.heroWingY, hero\.offsetHeight, c\.offsetHeight\)/.test(FB), 'RULE the cutaway: placed by cutPlace on the board and the share');
  }
  // ---- R3: the doors
  ok(/window\.BENCH_CERTIFIED\(\); \} catch \(e\) \{\} \}\n[^\n]*\n\s*if \(!wasPassed && passed\(\) && window\.FICHE_BOARD\) \{ try \{ window\.FICHE_BOARD\.certified\(\); \} catch \(e\) \{\} \}/.test(BE), 'bench.js awards the fiche beside BENCH_CERTIFIED');
  ok(!/BENCH_CERTIFIED\s*=/.test(FB), 'the story\'s slot is not taken');
  ok(/PLANE_THUMB\.saved\(name\); \} catch \(e\) \{\}\n[^\n]*\n\s*try \{ if \(window\.FICHE_BOARD\) window\.FICHE_BOARD\.saved\(name\)/.test(G), 'garage.js: a save tells the fiche (an unsaved plane\'s waits for its name)');
  ok((G.match(/window\.FICHE_BOARD\.forget\(n\)/g) || []).length === 2, 'garage.js: both deletes forget the fiche');
  ok(/window\.FICHE_BOARD\.rowButton\(row, n\)/.test(G), 'garage.js: the fleet\'s rows carry the fiche\'s door');
  ok(/\['#pfBoard', 'fiche', '\.pfHead'\]/.test(CD) && /\['#pfNote', 'ficheNote', ''\]/.test(CD), 'card_drag.js: the board and its line are draggable');
  ok(/'plane_fiche\.js', 'fiche_board\.js'/.test(B), 'build.js loads fiche_board.js after plane_fiche.js');
  ok(/navigator\.canShare\(\{ files: \[file\] \}\) && navigator\.share/.test(FB) && /a\.download = fname/.test(FB), 'the share: the device\'s sheet with the file, else a saved file');
  // the award in a stub page: timers by hand
  {
    const timers = []; let gens = 0, el = null;
    const node = () => ({ style: {}, hidden: false, appendChild() {}, prepend() {}, remove() {}, querySelector: () => null, addEventListener() {}, set innerHTML(v) {}, set textContent(v) {} });
    const D = { createElement: node, getElementById: id => (id === 'bAward' ? el : null), body: node(), head: node(), hidden: false };
    const sb = { cert: true, name: '', garage: true };
    const Wb = {
      FLYDIY_HOLDS: () => ({ inGarage: sb.garage, craftAway: false, holdRender: false, rollHold: false }),
      BENCH_STATE: () => ({ passed: sb.cert }), BENCH_FP: () => 'fp', CAGE_UI_SCENE: { parent: {} },
      GARAGE_SPEC: { name: () => sb.name, get: () => ({ a: 1 }) }, dispatchEvent() {},
      PLANE_FICHE: { get: () => Promise.resolve(null), generate: () => { gens++; return Promise.resolve({ name: sb.name, pics: {}, data: {} }); }, _hashOf: () => 'h', names: () => Promise.resolve([]) },
    };
    const ctx = { window: Wb, document: D, console, setTimeout: f => { timers.push(f); return timers.length; }, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, Promise, URL: {}, CustomEvent: function () {} };
    let FBapi = null;
    try { vm.runInNewContext(FB, ctx); FBapi = Wb.FICHE_BOARD; } catch (e) { fails.push('fiche_board.js does not load: ' + e.message); }
    if (FBapi) {
      const tick = async () => { const f = timers.shift(); if (f) f(); for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };
      let guard = 0;
      FBapi.certified(); ok(gens === 0, 'the award: nothing drawn at the certificate\'s call');
      el = { hidden: false }; sb.name = 'Cubby'; await tick();
      ok(gens === 0 && FBapi.pending, 'the award: nothing drawn while the certificate\'s card is up');
      el.hidden = true; sb.name = ''; await tick();
      ok(gens === 0 && FBapi.pending, 'the award: an unsaved plane waits for its name');
      sb.name = 'Cubby'; FBapi.saved('Cubby'); guard = 0; while (timers.length && gens === 0 && guard++ < 20) await tick();
      ok(gens === 1 && !FBapi.pending, 'the award: one draw once the card is closed and the plane has a name');
      FBapi.saved('Cubby'); await tick(); ok(gens === 1, 'the award: a save without a pending award draws nothing');
      FBapi.certified(); sb.cert = false; guard = 0; while (timers.length && guard++ < 20) await tick();
      ok(gens === 1 && !FBapi.pending, 'the award: a certificate gone before the draw draws nothing');
      sb.cert = true; sb.garage = false; FBapi.certified(); await tick(); await tick();
      ok(gens === 1, 'the award: nothing drawn while the plane is out of the garage');
      sb.garage = true; guard = 0; while (timers.length && gens === 1 && guard++ < 20) await tick();
      ok(gens === 2, 'the award: drawn when it is back on the stand');
    }
  }
  // THE USER'S RULES, run: the board's helpers (the real baked index), the wing line on a known silhouette
  {
    const Wr = {}, ctx = { window: Wr, document: {}, console, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, Promise, URL: {}, GAME_NAMES: { game: 'Wingsmith' } };
    try { vm.runInNewContext(FB, ctx); } catch (e) {}
    const A = Wr.FICHE_BOARD, IDX = (S.IDX && S.IDX.fiches) || {};
    if (!A || !A.titleOf) fails.push('RULE the board\'s helpers are not there'); else {
      checks++;
      ok(A.titleOf('piperCub', IDX) === 'Piper Cub', 'RULE the title: the official Cub loaded from its file is "Piper Cub", not "piperCub" (' + A.titleOf('piperCub', IDX) + ')');
      ok(A.titleOf('Cubby', IDX) === 'Cubby' && A.titleOf('build', IDX) === 'build', 'RULE the title: a player\'s own name stays; a name two files share maps to neither');
      const L = (S.LISTS && S.LISTS.planes) || [], off = L.filter(p => p.list === 'official' && p.thumb && IDX[p.thumb]);
      ok(off.length >= 5 && off.every(p => typeof IDX[p.thumb].file === 'string'), 'RULE the title: every baked official fiche names its file (' + off.length + ')');
      ok(A.sig() === 'Wingsmith · certified airworthy', 'RULE the signature: "' + A.sig() + '"');
      // the cutaway under the wing: the hero 300 tall, its wing line at 0.31, a cutaway 160 tall
      const p = A.cutPlace(0.31, 300, 160), p0 = A.cutPlace(null, 300, 160);
      ok(p.top > p.wingPx && p.top >= 93 + 6 && p.foot === p.top + 160, 'RULE the cutaway: its box starts below the hero\'s wing line (' + JSON.stringify(p) + ')');
      ok(p0.top > 0.25 * 300, 'RULE the cutaway: an old fiche (no wing line) still sits low');
    }
  }
  // the pure parts, in a stub page
  const W = { BENCH_STATE: () => ({ passed: false }), BENCH_FP: () => 'fpA', GARAGE_SPEC: { get: () => ({ a: 1 }) } };
  let api = null;
  try { api = load(F, W); } catch (e) { fails.push('the file does not load: ' + e.message); return { fails, checks }; }
  // two pixels wide, two rows, rows bottom-up: the corner background; a solid red; half-covered white; background
  const k = [0, 0, 0, 255, 200, 0, 0, 255, 100, 100, 100, 255, 0, 0, 0, 255], wt = [255, 255, 255, 255, 200, 0, 0, 255, 227, 227, 227, 255, 255, 255, 255, 255];
  const m = api._matte(new Uint8Array(k), new Uint8Array(wt), 2, 2);
  ok(m.n === 2, 'the matte: two pixels of aeroplane');
  ok(m.d[4 * 0 + 3] > 120 && m.d[4 * 0 + 3] < 135 && m.d[0] > 190, 'the matte: top-left is the half-covered row-bottom-up pixel, its colour unmixed');
  ok(m.d[4 * 1 + 3] === 0 && m.d[4 * 3 + 3] === 255 && m.d[4 * 3] === 200, 'the matte: the solid pixel whole, the background out');
  let refused = null; try { refused = await api.award('x'); } catch (e) {}
  ok(refused && refused.refused === 'no certificate', 'no certificate: no fiche');
  const s = api.stale({ fp: 'fpOld', hash: api._hashOf({ a: 1 }) });
  ok(s.cert === true && s.paint === false, 'a lapsed certificate marks the fiche, it does not remove it');
  ok(api.stale({ fp: 'fpA', hash: 'other' }).paint === true, 'a repaint marks the fiche');
  {   // the wing line: 20 x 10, a wing tip in the right-hand band at rows 1-2, the fuselage low on the left (rows 6-8)
    const w = 20, h = 10, d = new Uint8ClampedArray(w * h * 4);
    const px = (x, y) => { d[(y * w + x) * 4 + 3] = 255; };
    for (let x = 17; x < 20; x++) { px(x, 1); px(x, 2); }
    for (let x = 0; x < 12; x++) for (let y = 6; y < 9; y++) px(x, y);
    const wl = api._wingLine({ d, x0: 0, y0: 1, x1: 19, y1: 8 }, w);
    ok(wl === +((2 - 1 + 1) / 8).toFixed(3), 'RULE the cutaway: the wing line is the right band\'s lowest row (' + wl + ')');
  }
  return { fails, checks };
}
(async () => {
  const S = { F: rd('src/viewer/plane_fiche.js'), B: rd('tools/build.js'), FB: rd('src/viewer/fiche_board.js'), BE: rd('src/viewer/bench.js'),
              G: rd('src/viewer/garage.js'), CD: rd('src/viewer/card_drag.js'), N: rd('src/core/01_names.js'),
              IDX: JSON.parse(rd('media/fiches/index.json')), LISTS: JSON.parse(rd('builds/lists/plane_lists.json')) };
  const F = S.F, FB = S.FB;
  const base = await run(S);
  if (!SELF) {
    for (const m of base.fails) console.log('  FAIL ' + m);
    console.log('  ' + base.checks + ' checks');
    console.log('GATE PLANEFICHE: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
    process.exit(base.fails.length ? 1 : 0);
  }
  const BREAKS = [
    ['the inverse hero from below', F.replace('HERO_W / HERO_H, 38, 28)', 'HERO_W / HERO_H, 38, -28)')],
    ['the shader step dropped', F.replace('c.onBeforeCompile = m.onBeforeCompile; ', '')],
    ['a fiche without a certificate', F.replace("if (!st || !st.passed) return { refused: 'no certificate' };", '')],
    ['stored before it is drawn', F.replace("if (o.store !== false && rec.name) await tx", 'if (0) await tx')],
    ['a stale fiche removed', F.replace('if (!rec) return null;', "if (!rec) return null; tx('readwrite', s => s.delete(rec.name));")],
    ['the matte upside down', F.replace('const row = (h - 1 - y) * w * 4;', 'const row = y * w * 4;')],
    ['the target linear', F.replace('rt.isXRRenderTarget = true;', '')],
    ['the top view on the below lights', F.replace('false, CUT_STUDIO, F);   // its eye', 'false, STUDIO, F);   // its eye')],
    ['the room left dim', F.replace('room.forEach((l, i) => { l.intensity = roomI[i]; });', '')],
    ['the room at full on a top view', F.replace('room: 0.35', 'room: 1')],
    ['the frame check off', F.replace("if (m.edge) throw new Error('the ' + name + ' picture touches its frame');", '')],
    ['the file\'s name first', F.replace('numbers(spec, F, opts.title || opts.name)', 'numbers(spec, F)')],
  ].map(([n, f]) => [n, 'F', f]).concat([
    ['R3: the shed drawn under the studio', 'F', F.replace('hold(true); held = true;', 'held = true;')],
    ['R3: no programs before the pictures', 'F', F.replace("await warm('the pictures');", '')],
    ['R3: the cutaway uncompiled', 'F', F.replace("await warm('the cutaway');", '')],
    ['R3: one picture in one task', 'F', F.replace("const k = one(black); await yieldTask(name + ' on black');", 'const k = one(black);')],
    ['R3: the award drawn at the call', 'FB', FB.replace('function certified() { pending = true; if (!looking) looking = setTimeout(look, 1200); }', 'function certified() { pending = true; look(); }')],
    ['R3: the award over the certificate\'s card', 'FB', FB.replace("const aw = document.getElementById('bAward'); if (aw && !aw.hidden) return false;", '')],
    ['R3: drawn without its certificate', 'FB', FB.replace('if (!certNow()) { pending = false; return; }', '')],
    ['R3: a save draws', 'FB', FB.replace('function saved() { if (pending && !looking)', 'function saved() { pending = true; if (!looking)')],
    ['R3: drawn out of the garage', 'FB', FB.replace('if (H && (!H.inGarage || H.craftAway', 'if (H && (H.craftAway')],
    ['R3: the bench\'s call gone', 'BE', S.BE.replace('window.FICHE_BOARD.certified();', '0;')],
    ['RULE: the hero\'s blades still', 'F', F.replace("if (only.includes('hero')) discs.push(...heroDiscs(T, root));", '')],
    ['RULE: the disc left on for every view', 'F', F.replace('discsOff(discs);   // the other views', '//')],
    ['RULE: the cutaway from the old height', 'F', F.replace('CUT_YAW = 50, CUT_EL = 15', 'CUT_YAW = 50, CUT_EL = 28')],
    ['RULE: no wing line', 'F', F.replace("if (name === 'hero') data.heroWingY = wingLine(m, w);", '')],
    ['RULE: the wing line from the left band', 'F', F.replace('xa = m.x1 - Math.max(1, Math.round(cw * WING_BAND)) + 1', 'xa = m.x0')],
    ['RULE: the file key as the title', 'FB', FB.replace('const title = titleOf(name, await baked().catch(() => ({})));', 'const title = label(name);')],
    ['RULE: titleOf a no-op', 'FB', FB.replace('if (b && b.file && b.file === k) return b.name || k;', '')],
    ['RULE: the old signature', 'FB', FB.replace("g.fillText(sig(), Wd - 70, 1556)", "g.fillText('flyDiy · certified airworthy', 2060, 1560)")],
    ['RULE: no game name in the table', 'N', S.N.replace(/^\s*game:.*\n/m, '')],
    ['RULE: no frame on the share', 'FB', FB.replace('if (g.roundRect) g.roundRect(24, 24, Wd - 48, Ht - 48, 28); else g.rect(24, 24, Wd - 48, Ht - 48);', '')],
    ['RULE: the cutaway at the top', 'FB', FB.replace('const under = (wy + GAP) * heroH;', 'const under = 0;')],
    ['RULE: the shared index without files', 'IDX', JSON.parse(JSON.stringify(S.IDX, (k, v) => (k === 'file' ? undefined : v)))],
  ]);
  let bad = 0;
  for (const [nm, k, f2] of BREAKS) { if (f2 === S[k]) { console.log('  selftest ' + nm + ': the break did not apply'); bad++; continue; } const r = await run(Object.assign({}, S, { [k]: f2 })); if (!r.fails.length) { console.log('  selftest ' + nm + ': NOT caught'); bad++; } }
  console.log('  selftest: ' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' caught');
  console.log('GATE PLANEFICHE: ' + (bad || base.fails.length ? 'FAIL' : 'PASS'));
  for (const m of base.fails) console.log('  FAIL ' + m);
  process.exit(bad || base.fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL the check itself threw: ' + (e && e.message)); console.log('GATE PLANEFICHE: FAIL (the check threw)'); process.exit(1); });
