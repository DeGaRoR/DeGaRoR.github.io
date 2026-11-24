#!/usr/bin/env node
// _pagerig_check.js - GATE PAGERIG (LOOK-1, 15 Nov 2026): the shared page harness tools/page_rig.js holds its contract.
//   node half (the battery, seconds): the module loads and exports start / cli / parseViews; the views file is checked
//     before a slot is spent; the GPU test refuses SwiftShader; the source keeps every RIG-PROCEDURE rule it was built for
//     (no Page.captureScreenshot, Chrome killed by its own PID tree, the flydiy.* wipe, the hard cap, the flying test's
//     five conditions, its own profile folder); the CLI without arguments prints its usage and exits 2.
//   --gpu (BY HAND, in A0's GPU slot: boxlock.sh take gpu ...): the real page - boot, fly, pause, the free eye beside the
//     aircraft, one grab that is not blank, on a real GPU, Chrome closed. [--out dir] keeps the still. ~4-6 min.
//   page-rig-2 (16 Nov; the user via A0: "they keep failing their test runs"): 7 the anchor is the sim's CG, camGet().target the
//     cross-check, an aim at the world origin a MISS (FLIGHT_PROBE.craft() is a Group at 0,0,0); the in-frame projection; the
//     skip to the line-up; _serve.js from the repo; --gpu 6b the aircraft in the chase frame after fly(), 6c-6d an eyeNear grab.
//   page-rig-4 (SEAPLANES 22 Nov): 7o-7p a float / hull build's start dialog (#edLaunch) answered by fly() - water by default;
//     7q-7r flying is not drawing: an open fleet screen / new-plane panel closed (Escape), the AA rendering before fly() returns.
//   node tools/_pagerig_check.js [--gpu [--out <dir>] [--cap 540]]
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const P = require('./page_rig.js'), SRC = fs.readFileSync(path.join(__dirname, 'page_rig.js'), 'utf8');
// 1 the module
ok(['start', 'cli', 'parseViews', 'REAL_GPU', 'SIMT'].every(k => k in P), '1 exports start, cli, parseViews, REAL_GPU, SIMT');
// 2 the views file is checked before a slot is spent
const throws = t => { try { P.parseViews(t); return false; } catch (e) { return true; } };
ok(P.parseViews('[{"name":"a","near":[10,2,-5],"yaw":1,"pitch":0},{"name":"b","x":1,"agl":20,"z":2,"yaw":0,"pitch":0.1}]').length === 2 &&
   P.parseViews('{"views":[{"name":"c","x":1,"y":2,"z":3,"yaw":0,"pitch":0}]}').length === 1, '2a a good views file (array, or { views }) parses');
ok(throws('[]') && throws('[{"name":"a b","x":1,"z":1,"yaw":0,"pitch":0}]') && throws('[{"name":"a","yaw":0,"pitch":0}]') &&
   throws('[{"name":"a","x":1,"z":1,"pitch":0}]') && throws('[{"name":"a","x":1,"z":1,"yaw":0,"pitch":0},{"name":"a","x":1,"z":1,"yaw":0,"pitch":0}]'),
   '2b empty / unsafe name / no position / no yaw / a name twice: refused');
// 3 the GPU test
ok(P.REAL_GPU('ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206) Direct3D11 vs_5_0 ps_5_0, D3D11)') && P.REAL_GPU('ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11)') &&
   !P.REAL_GPU('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)') && !P.REAL_GPU('llvmpipe (LLVM 15.0.7, 256 bits)') && !P.REAL_GPU(null),
   '3 REAL_GPU: NVIDIA / Intel yes; SwiftShader, llvmpipe, none: no');
// 4 the source keeps the procedure's rules
const code = SRC.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
ok(!/captureScreenshot/.test(code), '4a no Page.captureScreenshot (headless shows the canvas see-through)');
ok(/taskkill \/PID ' \+ ch\.pid \+ ' \/T \/F/.test(code) && !/taskkill \/IM|taskkill \/F \/IM|pkill|killall/.test(code), '4b Chrome killed by its own PID tree, never by a pattern');
ok(/\/\^flydiy\\\\\.\//.test(code) && /sessionStorage\.setItem\("page_rig_wiped"/.test(code), '4c the flydiy.* localStorage wipe, once per tab');
ok(/HARD CAP/.test(code) && /process\.exit\(3\)/.test(code) && /clearTimeout\(capT\)/.test(code), '4d the hard cap (exit 3), disarmed by close()');
ok(['mode-fly', 'rollShot', 'mode-ws', "BOOT.state !== 'gone'", 's.t'].every(k => P.SIMT.includes(k)), "4e flying = BOOT gone + mode-fly + no rollShot + no mode-ws + the sim's clock");
ok(/--user-data-dir=' \+ udd/.test(code) && /mkdtempSync/.test(code) && /--headless=new/.test(code), '4f headless=new, a fresh profile folder of its own');
ok(/gl\.readPixels/.test(code) && /AA\.render = function/.test(code), '4g the grab: FLYDIY_AA.render wrapped, readPixels after it');
const parses = js => { try { new Function('return ' + js); return true; } catch (e) { console.log('    ' + e.message); return false; } };
ok(parses(P.PAGE_HOOK) && parses(P.WHY) && parses(P.SIMT), '4h the page-side code (the grab hook, WHY, the flying test) parses');
// 4i the grab hook on a fake page: a 4x10 GL frame (bottom-up rows: the bottom fifth dark, the top fifth bright) comes back
//    upright (the top bright), opaque, its numbers right; a frame never drawn is a MISS in 5 s, not a hang
const fakeGrab = async (draw) => {
  const vm = require('vm'), W = 4, H = 10, gl = { FRAMEBUFFER: 1, RGBA: 2, UNSIGNED_BYTE: 3, bindFramebuffer() {},
    readPixels(x, y, w, h, f, t, px) { for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const o = (r * w + c) * 4, v = r < 2 ? 10 : r >= 8 ? 240 : 120; px[o] = v; px[o + 1] = v; px[o + 2] = v; px[o + 3] = 0; } } };
  let out = null;
  class OC { constructor(w, h) { this.w = w; this.h = h; } getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: d => { out = d.data; } }; }
    convertToBlob() { return Promise.resolve(new Blob([Buffer.from('fake png')])); } }
  const AA = { render() { return 1; } }, R = { getContext: () => gl, domElement: { width: W, height: H }, info: { render: { frame: 7 } } };
  const ctx = { FLYDIY_AA: AA, FLYDIY_RENDERER: R, OffscreenCanvas: OC, btoa: b => Buffer.from(b, 'binary').toString('base64'), setTimeout, Promise, Uint8Array, Math, Error,
    FLIGHT_PROBE: { camGet: () => ({ eye: [1, 2, 3], fov: 50 }) } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(P.PAGE_HOOK, ctx);
  const p = ctx.PAGE_RIG.grab(0); if (draw) AA.render(); const r = await p; return { r, out, aa: ctx.PAGE_RIG.aaCalls() };
};
// 7 PAGE-RIG-2: THE ANCHOR (pure)
{ const A = P.pickAnchor, at = r => (A(r).at || []).join(',');
  const a = A({ cg: [812, 40, -2210], camTarget: [812.5, 40.2, -2209] }), b = A({ cg: [812, 40, -2210], camTarget: [0, 1, 0] });
  ok(a.src === 'cgPos' && at({ cg: [812, 40, -2210], camTarget: [812.5, 40.2, -2209] }) === '812,40,-2210' && !a.notes.length, '7a the anchor is the sim CG, the camera target agreeing');
  ok(b.src === 'cgPos' && b.gap > P.STALE_M && /stale/.test(b.notes.join()), '7b a camera target far from the CG (stale after fly / place): noted, the CG wins', b.gap);
  const c = A({ cg: [0.2, 1, -0.3], camTarget: [640, 22, 300] }), d = A({ cg: null, camTarget: [640, 22, 300] });
  ok(c.src === 'camGet' && d.src === 'camGet' && /origin/.test(c.notes.join()) && /no sim\.cgPos/.test(d.notes.join()), '7c a CG at the origin or none: the camera target, said so');
  const e = A({ cg: [0, 0, 0], camTarget: [1, 0, -1] }), g = A(null), h = A({ cg: [NaN, 0, 4], camTarget: null });
  ok(e.miss && g.miss && h.miss && !e.at && /craft\(\) is a Group at 0,0,0/.test(e.miss), '7d an aim at the world origin (the craft() Group trap) or nothing readable: a MISS, never an eye'); }
// 7e the projection: a fake camera at the origin looking down -z (view = identity), a 90 deg perspective
{ const vm = require('vm'), n = 0.5, fa = 1000, proj = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -(fa + n) / (fa - n), -1, 0, 0, -2 * fa * n / (fa - n), 0];
  const cam = { updateMatrixWorld() {}, matrixWorldInverse: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, projectionMatrix: { elements: proj } };
  const run = p => { const ctx = { FLIGHT_PROBE: { camera: () => cam }, Math }; vm.createContext(ctx); return vm.runInContext(P.INFRAME(p), ctx); };
  const ahead = run([1, 0.5, -20]), behind = run([0, 0, 20]), side = run([40, 0, -20]), none = (() => { const ctx = { FLIGHT_PROBE: {}, Math }; vm.createContext(ctx); return vm.runInContext(P.INFRAME([0, 0, -5]), ctx); })();
  ok(P.frameVerdict(ahead) && Math.abs(ahead.x - 0.05) < 1e-3 && ahead.dist > 20 && !P.frameVerdict(behind) && !behind.front && !P.frameVerdict(side) && !P.frameVerdict(none) && none.err,
     '7e in frame: ahead yes (NDC ' + ahead.x + ', ' + ahead.y + '), behind the eye no, off to the side no, no camera no'); }
// 7f the source: the CG anchor everywhere a plane-relative eye is made, the craft check before a grab, the skip, _serve.js from the repo
{ const code2 = SRC.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(/s\.cgPos\(\)/.test(P.ANCHOR) && /camGet/.test(P.ANCHOR) && !/craft\(\)\s*\./.test(code2), '7f the anchor reads sim.cgPos() + camGet(); nothing aims at FLIGHT_PROBE.craft()');
  ok(/const A = await rig\.anchor\(\); if \(A\.miss\) throw new Error\(A\.miss\); x = A\.at\[0\] \+ v\.near\[0\]/.test(code2) && /rig\.eyeNear = /.test(code2) && /craft: v\.craft != null \? !!v\.craft : Array\.isArray\(v\.near\)/.test(code2),
     '7g a near view and eyeNear read the CG now; a near view grabs with the craft check on');
  ok(/rig\.inFrame\(A\.at, go\.margin\)/.test(code2) && /rig\.misses >= rig\.maxMiss/.test(code2) && /maxMiss: o\.maxMiss \|\| 2/.test(code2), '7h before a plane-relative grab the CG is projected; two misses stop the run');
  ok(/getElementById\('bSkip'\)/.test(code2) && /rig\.skipToLineUp = /.test(code2) && /flag\('skip'\)/.test(code2), "7i skipToLineUp clicks the game's own #bSkip (CLI --skip)");
  ok(/path\.join\(repo, 'flyDiy', 'tools', '_serve\.js'\)/.test(code2) && fs.existsSync(path.join(__dirname, '_serve.js')), '7j _serve.js by absolute path from the repo served (a copy of page_rig.js elsewhere still serves)');
  ok(/INFRAME\(A\.at\)\); rig\.plane\.inFrame = frameVerdict\(v\)/.test(code2), '7k fly() anchors on the CG and records whether the chase camera has it in frame'); }
// (page-rig-3) the settle after a long jump, and one more grab on a BLANK frame (DIRT-STRIP 16 Nov: 2 blanks = 2 misses = a stopped slot)
{ const code3 = SRC.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(parses(P.RAFRATE) && P.SETTLE_RAF >= 10, '7l the frame-rate probe parses; the settle floor is ' + P.SETTLE_RAF + ' frames a second');
  ok(/await rig\.frames\(settle \|\| 60\);\s*await rig\.settleLoad\(\)/.test(code3) && /await rig\.settleLoad\(\);\s*\/\/ \(page-rig-3\) a far eye/.test(SRC),
     '7m place() and every CLI view wait for the frame rate to come back before the grab');
  ok(/if \(r\.info\.blank && go\.retryBlank !== false\)/.test(code3) && /r\.info\.retried = true/.test(code3) && /SETTLE_MS/.test(code3),
     '7n a BLANK grab settles and grabs once more (capped wait), the second frame returned as it is'); }
// (page-rig-4, SEAPLANES 22 Nov) a float / hull build's start dialog (#edLaunch, app.js launchAsk) is answered by fly(): every Go
// only toggled it, and the Super Petrel's 03:18 slot never flew. The answer, on a stub page; fly() asks it after each Go.
{ const stub = (hidden, ks) => { const clicked = []; const el = { hidden, querySelector: q => { const k = (q.match(/data-k=([a-z]+)/) || [])[1]; return ks.includes(k) ? { click: () => clicked.push(k) } : null; } };
    return { doc: { getElementById: id => id === 'edLaunch' ? el : null }, clicked }; };
  const ans = (d, k) => new Function('document', 'return ' + P.LAUNCH_ANSWER(k))(d.doc);
  const w = stub(false, ['water', 'trailer']), t = stub(false, ['water', 'trailer']), h = stub(true, ['water']), m = stub(false, ['trailer']);
  const rw = ans(w, 'water'), rt = ans(t, 'trailer'), rh = ans(h, 'water'), rn = new Function('document', 'return ' + P.LAUNCH_ANSWER())({ getElementById: () => null }), rm = ans(m, 'water');
  ok(rw === 'water' && w.clicked.join() === 'water' && rt === 'trailer' && t.clicked.join() === 'trailer' && rh === null && !h.clicked.length && rn === null && rm === 'no water' && !m.clicked.length,
     '7o the launch dialog: water / trailer clicked when open, nothing when closed or absent (a land build), a missing button named');
  const code4 = SRC.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(/getElementById\('bGo'\)[\s\S]{0,200}LAUNCH_ANSWER\(launch\)/.test(code4) && /fo\.launch === 'trailer' \? 'trailer' : 'water'/.test(code4) && /rig\.fly\(\{ launch: opt\('launch', 'water'\) \}\)/.test(code4),
     "7p fly() answers it after each Go (default 'On the water', fly({ launch: 'trailer' }) / CLI --launch trailer)"); }
// (page-rig-4, AUDIO via A0 22 Nov) FLYING IS NOT DRAWING: the loop returns before the world under a UI hold (the fleet screen,
// the new-plane panel, the fiche's picture: FLYDIY_UI_HOLD) - fly() closes an open screen with ONE Escape and wants the AA to render
{ const holds = w => new Function('window', 'return ' + P.UI_HOLDS)(w);
  const a = holds({ FLEET_SCREEN: { isOpen: () => true }, NEW_PLANE: { isOpen: () => true } }), b = holds({}), c = holds({ FLEET_SCREEN: { isOpen: () => { throw new Error('x'); } } });
  const sent = []; const KE = function (t, o) { this.type = t; this.key = o.key; };
  new Function('document', 'window', 'KeyboardEvent', 'return ' + P.ESCAPE)({ body: { dispatchEvent: e => sent.push(e.key) } }, { dispatchEvent: e => sent.push('window:' + e.key) }, KE);
  ok(a.join() === 'fleet screen,new plane' && !b.length && !c.length && sent.join() === 'Escape' && parses(P.AA_RATE),
     '7q the holds named (fleet screen, new plane; none when absent or throwing); ONE Escape on the page; the AA rate probe parses');
  const code5 = SRC.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok(/uh = await rig\.J\(UI_HOLDS\)[\s\S]{0,200}await rig\.ev\(ESCAPE\)[\s\S]{0,200}aa = await rig\.J\(AA_RATE\); if \(aa > 0\) break/.test(code5)
     && /if \(!\(aa > 0\)\)[\s\S]{0,200}world is HELD/.test(code5) && /uiHolds: \$\{UI_HOLDS\}/.test(code5),
     '7r fly() closes an open screen (Escape), wants AA renders > 0 a second, else throws naming the hold; WHY reports uiHolds'); }
// 5 the CLI's usage
const u = spawnSync(process.execPath, [path.join(__dirname, 'page_rig.js')], { encoding: 'utf8', timeout: 20000 });
ok(u.status === 2 && /usage: node tools\/page_rig\.js --views/.test(u.stderr), '5 the CLI without arguments: usage, exit 2');

(async () => {
  { const { r, out, aa } = await fakeGrab(true), i = r && r.info;
    ok(i && i.w === 4 && i.h === 10 && i.frame === 7 && aa === 1 && out[0] === 240 && out[3] === 255 && out[9 * 4 * 4] === 10 && i.topMean === 240 && i.botMean === 10 && !i.blank && /^[A-Za-z0-9+/=]+$/.test(r.data),
      '4i the grab hook on a fake page: rows flipped upright, alpha opaque, top/bottom means, not blank ' + JSON.stringify(i));
    const t = Date.now(), m = await fakeGrab(false);
    ok(m.r && /no frame drawn in 5 s/.test(m.r.miss) && Date.now() - t < 7000, '4j a frame never drawn: a MISS after 5 s, not a hang'); }
  if (argv.includes('--gpu')) {
    console.log('--gpu: the real page (a GPU slot is required)');
    let rig = null;
    try {
      rig = await P.start({ cap: +opt('cap', 540), name: 'PAGERIG' });
      ok(P.REAL_GPU(rig.gpu), '6a on a real GPU: ' + rig.gpu);
      ok(await rig.fly({ need: false }), '6b flying (sim t rising) after ' + rig.bootS + ' s of boot');
      ok(rig.plane && rig.plane.src === 'cgPos' && rig.plane.inFrame, '6b the anchor is the sim CG and the chase camera has the aircraft in frame after fly() ' + JSON.stringify(rig.plane && { at: rig.plane.target, gap: rig.plane.gap, ndc: rig.plane.ndc }));
      const sk = await rig.skipToLineUp(); console.log('  skipToLineUp ' + JSON.stringify(sk) + ' (a spawn with no taxi hides #bSkip: not a fail)');
      await rig.pause();
      if (rig.plane) {
        const off = [-12, 3, 8];
        await rig.eyeNear(off[0], off[1], off[2], Math.atan2(-off[0], off[2]), Math.atan2(-off[1], Math.hypot(off[0], off[2])));
        await rig.frames(60);
        const b = await rig.grab({ settle: 30 });   // (eyeNear: the CG projected in the frame first, or a MISS)
        console.log('  grab ' + JSON.stringify(b.info));
        ok(b.length > 10000 && b.slice(1, 4).toString() === 'PNG', '6c a PNG came back (' + b.length + ' B)');
        ok(!b.info.blank && b.info.sd > 4 && b.info.bgShare < 0.5, '6d not blank (sd ' + b.info.sd + ', page-background share ' + b.info.bgShare + ')');
        if (opt('out')) { fs.mkdirSync(opt('out'), { recursive: true }); fs.writeFileSync(path.join(opt('out'), 'pagerig.png'), b); console.log('  wrote ' + path.join(opt('out'), 'pagerig.png')); }
      }
      if (rig.errors.length) console.log('  page errors: ' + rig.errors.slice(0, 5).join(' | '));
    } catch (e) { ok(false, '6 the page run: ' + (e && e.message || e)); if (e && e.why) console.log('  WHY ' + JSON.stringify(e.why)); }
    finally { if (rig) await rig.close(); }
  } else console.log('  (the page half runs by hand in a GPU slot: --gpu)');
  console.log(fails ? `GATE PAGERIG: FAIL (${fails})` : 'GATE PAGERIG: PASS');
  process.exit(fails ? 1 : 0);
})();
