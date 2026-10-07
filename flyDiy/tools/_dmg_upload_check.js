#!/usr/bin/env node
// GATE DMGUPLOAD (DMG-D4b; the coordinators' ask, 2026-10-06) - WHAT THE GPU HOLDS AFTER A WRECK IS WHAT THE CPU HOLDS.
// Found on the box: after a 30 m/s break-up, the shed and a roll-out, the stand drew a stretched ghost of the crash while
// every CPU array of the aeroplane was healed - and a forced re-upload of every attribute cleared it: a heal wrote a CPU
// array back WITHOUT the upload three (or the hybrid bake's fold) needs. DMG-WALL's DMGWALLPATH could not see it: it reads
// the CPU arrays, and stubs the render after the roll-out (so nothing is ever uploaded).
//
//   node tools/_dmg_upload_check.js                 -> "GATE DMGUPLOAD: PASS|FAIL"
//   node tools/_dmg_upload_check.js --selftest      -> the bug as it was (D4b's heal marking off, G2352's owed upload
//                                                      unguarded) must turn it red on a fold; so must G2352 alone off
//   --fault=nomark|noowe|aswas  a fix taken out on the gate's own runs (the A/B; the selftest runs aswas and noowe)
//   --fakebake=0  the page without the flown bake's fake (the gate as D4b left it: no fold in the node page)
//   --only=cub|metal   --secs=S (sim seconds of the crash, default 5)
//
// THE PAGE ITSELF IN NODE (tools/_page_node.js): dev.html?simw=1&damage=1 - the DEFAULT mode (the solver in a worker
// thread), the real three.js r186 rendering into the RECORDING WebGL2, which is wrapped here: every buffer three uploads
// (bufferData, bufferSubData, a range or whole) is SHADOWED byte for byte - the GPU's copy, as the driver would hold it.
// The garage boot, Roll out; the GPU's copy against the CPU's (fresh: must agree); the 30 m/s trunk crash (4 m up, a trunk
// 40 m ahead, through the worker); the shed; Roll out; frames rendered; then, asserted:
//   1 the crash broke members on the page (else the path tests nothing);
//   2 EVERY DRAWN ATTRIBUTE AND INDEX of the flown model (its folds, its merges, the rest): the GPU's copy equals its CPU
//     array, byte for byte - a mismatch is a stale buffer (the CPU written without the upload), named with its mesh;
//   3 no page or worker error.
// G2350 (DMG-FOLDNODE): THE FOLDS ARE IN IT. The node page makes no real flown bake (the recording GL's read-back is zeros),
// so before G2350 the flown model had no fold here and this gate passed with D4b's fix taken out. The page now runs with
// _page_node's opts.fakeBake (flown_bake.js fakeSet, test only: a 1x1 zero atlas, no GL pass, no unwrap) - forPayload,
// buildModel, mergeModel's folds and views, the range uploads and the hybrid are the game's - and asserted besides:
//   4 the flown bake was the fake (FB.last.hit 'fake'), the hybrid on, folds made; drawn fold buffers were checked
//     fresh and after the path (a fold's position / normal is where a heal's write goes stale);
//   --selftest: the bug as it was (window.FLYDIY_HEAL_NOMARK = true and window.FLYDIY_FOLD_NOOWE = true) must go red ON A
//     FOLD, and so must FLYDIY_FOLD_NOOWE alone (G2352 off, D4b's mark on: with the folds in the page D4b's mark alone left
//     the Cub's fuselage fold stale - the lost whole upload was the ghost here, see flown_bake.js G2352).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };

// ---- the GL shadow: the bytes of every buffer as three uploaded them ----
// (a Proxy over the recording GL - its own Proxy has no set trap, a method cannot be replaced on it - handed to the page by
// _page_node's opts.glWrap; every context the page makes shares one shadow)
function shadowGL() {
  const S = { cur: new Map(), bytes: new Map(), ofArray: new Map(), uploads: 0, subs: 0, contexts: 0 };
  const wrapGL = gl => { S.contexts++;
    const bind = (t, b) => { S.cur.set(t, b); return gl.bindBuffer(t, b); };
    const data = (t, src, usage, srcOff, len) => {
      const b = S.cur.get(t);
      if (b && src && typeof src === 'object' && src.buffer) {
        const es = src.BYTES_PER_ELEMENT || 1, o = (srcOff || 0) * es, n = len ? len * es : src.byteLength - o;
        S.bytes.set(b, new Uint8Array(src.buffer, src.byteOffset + o, n).slice()); S.ofArray.set(src, b); S.uploads++;
      } else if (b && typeof src === 'number') S.bytes.set(b, new Uint8Array(src));
      return gl.bufferData(t, src, usage, srcOff, len);
    };
    const sub = (t, dstOff, src, srcOff, len) => {
      const b = S.cur.get(t), sh = b && S.bytes.get(b);
      if (sh && src && src.buffer) {
        const es = src.BYTES_PER_ELEMENT || 1, so = (srcOff || 0) * es, n = len ? len * es : src.byteLength - so;
        sh.set(new Uint8Array(src.buffer, src.byteOffset + so, n), dstOff); S.subs++;
      }
      return gl.bufferSubData(t, dstOff, src, srcOff, len);
    };
    return new Proxy(gl, { get(t, p) { if (p === 'bindBuffer') return bind; if (p === 'bufferData') return data; if (p === 'bufferSubData') return sub; return t[p]; } });
  };
  return { S, wrapGL };
}
// every drawn attribute / index of the flown model against its GPU copy -> the stale ones
function staleOf(W, S) {
  const m = W.FLIGHT_PROBE.model(), out = [], seen = new Set(), CL = {}, CK = {}; let checked = 0, never = 0;
  if (!m || !m.grp) return { none: true };
  m.grp.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    let vis = o.visible; for (let q = o.parent; q && vis; q = q.parent) vis = q.visible; if (!vis) return;
    const g = o.geometry, cls = o.userData && o.userData.flownMerge ? 'fold' : (o.userData && o.userData.still ? 'still' : 'mesh');
    CL[cls] = (CL[cls] || 0) + 1;
    const list = Object.entries(g.attributes).map(([k, a]) => [k, a]); if (g.index) list.push(['index', g.index]);
    for (const [k, a] of list) {
      if (!a || !a.array || a.isInterleavedBufferAttribute || seen.has(a.array)) continue; seen.add(a.array);
      const b = S.ofArray.get(a.array); if (!b) { never++; continue; }
      const sh = S.bytes.get(b), cpu = new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength); checked++; CK[cls] = (CK[cls] || 0) + 1;
      if (!sh || sh.length !== cpu.length) { out.push({ mesh: o.name || o.type, cls, attr: k, why: 'size ' + (sh && sh.length) + ' vs ' + cpu.length }); continue; }
      let bad = 0, first = -1; const es = a.array.BYTES_PER_ELEMENT || 4;
      for (let i = 0; i < cpu.length; i += es) { let d = false; for (let j = 0; j < es; j++) if (sh[i + j] !== cpu[i + j]) { d = true; break; } if (d) { bad++; if (first < 0) first = i / es; } }
      if (bad) out.push({ mesh: o.name || o.type, cls, attr: k, elements: bad, of: cpu.length / es, first, version: a.version });
    }
  });
  return { checked, never, stale: out, classes: CL, checkedBy: CK };
}

// ============================================================ THE CHILD: one build, one page
async function child() {
  const out = arg('out'), fault = arg('fault', ''), SECS = +arg('secs', 5), key = arg('build', 'cub'), dmg = arg('damage', '1') !== '0';
  // (the staging: the mild one by default - 4 m up, 30 m/s, a 0.3 m trunk 40 m ahead; STAGES.hard the breaking-up one)
  const SV = +arg('V', 30), SAGL = +arg('agl', 4), STR = +arg('tr', 0.3), SD = +arg('D', 40), PROBE = arg('probe', '0') === '1';
  const { openPage } = require('./_page_node.js');
  const R = { key, fault, damage: dmg, errors: [] };
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[key]), 'utf8') };
  const SG = shadowGL(), S = SG.S;
  const fake = arg('fakebake', '1') !== '0';   // (G2350: --fakebake=0 the gate as D4b left it - no fold in the node page)
  const P = await openPage({ quiet: true, storage, query: dmg ? 'simw=1&damage=1' : 'simw=1', workers: /sim_host\.js/, glWrap: SG.wrapGL, fakeBake: fake });
  R.fakeBake = fake;
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  if (fault === 'nomark' || fault === 'aswas') W.FLYDIY_HEAL_NOMARK = true;   // (D4b's heal marking off)
  if (fault === 'noowe' || fault === 'aswas') W.FLYDIY_FOLD_NOOWE = true;     // (G2352 off: a fold's owed whole upload a range can replace)
  if (fault === 'noreset') W.FLYDIY_ROLL_NORESET = true;   // (the selftest: the shot's wreck reset off - the bug as it was)
  const tripN = () => (W.FLYDIY_TRIPS || []).length;
  const tripDone = (kind, n0) => { const T = W.FLYDIY_TRIPS || []; const t = T[T.length - 1]; return T.length > n0 && !!(t && t.kind === kind && t.done && W.BOOT.state === 'gone'); };
  const SW = () => W.FLYDIY_SIMW || null;
  const live = () => { const s = SW() && SW().state(); return !!(s && s.phase === 'live' && s.flight && s.flight.live); };
  // (the render KEPT: the uploads are what is measured)
  // THE SHOT'S SHAPE (the roll-out shot plays before the stand's reset: after a crash it posed the WRECK): each frame of the
  // roll-out trip, the sim's nodes rigidly fitted to the design's rest (WRECK_DEBRIS.fit) - the worst residual (m)
  const shapeNow = () => { try { const sim = W.FLIGHT_PROBE.sim(), def = W.FLIGHT_PROBE.def(), n = def.nodes.length, rest = new Float64Array(n * 3), ids = [];
      def.nodes.forEach((nd, i) => { rest[i*3] = nd.p[0]; rest[i*3+1] = nd.p[1]; rest[i*3+2] = nd.p[2]; ids.push(i); });
      const F = W.WRECK_DEBRIS.fit(ids, rest, sim.p), R = F.R; let worst = 0;
      for (const i of ids) { const d = [rest[i*3] - F.cr[0], rest[i*3+1] - F.cr[1], rest[i*3+2] - F.cr[2]];
        const x = F.cl[0] + R[0]*d[0] + R[1]*d[1] + R[2]*d[2], y = F.cl[1] + R[3]*d[0] + R[4]*d[1] + R[5]*d[2], z = F.cl[2] + R[6]*d[0] + R[7]*d[1] + R[8]*d[2];
        const e = Math.hypot(sim.p[i*3] - x, sim.p[i*3+1] - y, sim.p[i*3+2] - z); if (e > worst) worst = e; }
      return worst; } catch (e) { return -1; } };
  const rollOut = async (watch) => { const n0 = tripN(); W.document.getElementById('bGo').click();
    if (watch) { watch.frames = 0; watch.worst = 0; watch.shot = 0; for (let i = 0; i < 6000 && !tripDone('rollout', n0); i++) { await P.frames(1); watch.frames++;
        if (W.document.body.classList.contains('rollShot')) { watch.shot++; const w = shapeNow(); if (w > watch.worst) watch.worst = w; } } }
    await P.until(() => tripDone('rollout', n0), 900000);
    for (let i = 0; i < 600 && !live(); i++) await P.frames(1); return live(); };
  const rollIn = async () => { const n0 = tripN(); const b = W.document.getElementById('bHangar2'); if (!b) return false; b.click(); await P.until(() => tripDone('rollin', n0), 900000); for (let i = 0; i < 30; i++) await P.frames(1); return true; };
  R.shot0 = {}; R.live0 = await rollOut(R.shot0); R.shot0.worst = +R.shot0.worst.toFixed(3);
  for (let i = 0; i < 10; i++) await P.frames(1);
  R.fresh = staleOf(W, S);
  if (!R.live0) { R.errors = P.errors.slice(0, 20); fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); }
  // ---- the crash (DMGWALLPATH's): 4 m up, 30 m/s, a trunk 40 m ahead, through the worker
  const FP = W.FLIGHT_PROBE; W.FLYDIY_SKINBREAK = true; W.FLYDIY_WRECK = true; FP.setManual(true);
  { const sim = FP.sim(), world = FP.world(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
    const c = sim.cgPos(), g = world.terrainH(c[0], c[2]); let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
    let placed = false; FP.place({ at: [c[0], g + SAGL + (c[1] - yMin), c[2]], zeroV: true, dv: [SV * fx, 0, SV * fz] }).then(() => { placed = true; });
    await P.until(() => placed, 60000);
    const c2 = sim.cgPos(), tx = c2[0] + fx * SD, tz = c2[2] + fz * SD, gt = world.terrainH(tx, tz);
    world.treeHits.set('fill:upload', [tx, tz, gt, STR, gt + 10]); sim.ctl.thr = 0;
    const tA = sim.t; let br = 0;
    for (let f = 0; f < SECS * 60 + 600 && sim.t - tA < SECS; f++) { await P.frames(1); const DS = W.FLYDIY_DMG_STATE ? W.FLYDIY_DMG_STATE() : null; br = Math.max(br, DS && DS.br ? DS.br.length : 0); }
    world.treeHits.drop ? world.treeHits.drop('fill:upload') : world.treeHits.delete && world.treeHits.delete('fill:upload');
    R.crash = { br, wreck: W.FLYDIY_WRECK_STATS ? (W.FLYDIY_WRECK_STATS().bodies || []).length : null, stage: { V: SV, agl: SAGL, tr: STR, D: SD } }; }
  if (PROBE) { fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); }   // (--probe=1: the crash only - the staging sweep)
  // ---- the shed, then Roll out, then frames rendered
  await rollIn();
  R.shot1 = {}; R.live1 = await rollOut(R.shot1); R.shot1.worst = +R.shot1.worst.toFixed(3); R.rollResets = W.FLYDIY_ROLL_RESETS || 0;
  for (let i = 0; i < 20; i++) await P.frames(1);
  R.after = staleOf(W, S);
  // (G2350: read, never forPayload - that call resets the folds' list)
  try { const FB = W.FLOWN_BAKE, L = FB && FB.FB.last, F = FB && FB.folds ? FB.folds() : [];
    R.bake = { module: !!FB, hit: L ? L.hit : null, cm: L ? L.cm : null, hybrid: !!(FB && FB.FB.hybrid), hyT: FB ? FB.FB.hyT : null, folds: F.length,
               foldMeshes: F.reduce((k, f) => k + ((f.meshes || []).length), 0), views: F.reduce((k, f) => k + ((f.live || []).length), 0), merge: FB ? FB.FB.merge || null : null }; } catch (e) { R.bake = { err: String(e && e.message) }; }
  R.gl = { uploads: S.uploads, subs: S.subs, contexts: S.contexts };
  R.healUploads = (W.FLYDIY_HEAL_UPLOAD || {}).n || 0;
  const s1 = SW() ? SW().state() : null;
  R.workerErrors = s1 && s1.errors ? s1.errors.slice(0, 10) : [];
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close(); process.exit(0);
}

// ============================================================ THE PARENT
// the crash stagings: the mild one (the child's defaults) and the breaking-up one (chosen by a --probe sweep on train 39 + TUNE)
const STAGES = { hard: { id: 'hard', V: 40, agl: 2, tr: 0.5, D: 40 } }, HARD_MIN = 100;
function runChild(key, fault, secs, damage, stage) {
  const out = path.join(os.tmpdir(), 'dmgupload_' + process.pid + '_' + key + (fault ? '_' + fault : '') + (damage === false ? '_off' : '') + (stage ? '_' + stage.id : '') + '.json');
  const a = [__filename, '--child=1', '--out=' + out, '--build=' + key, '--secs=' + secs, '--fakebake=' + arg('fakebake', '1')]; if (fault) a.push('--fault=' + fault); if (damage === false) a.push('--damage=0');
  if (stage) for (const k of ['V', 'agl', 'tr', 'D']) if (stage[k] != null) a.push('--' + k + '=' + stage[k]);
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 2 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { key, failed: 'child exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); return R;
}
function judge(R, say) {
  const f = [], bad = m => f.push(R.key + ': ' + m);
  if (R.failed) { bad(R.failed); return f; }
  if (!R.live0) { bad('the first roll-out never went live under the worker'); return f; }
  const st = X => X && X.stale ? X.stale : [];
  say('  ' + R.key + ': fresh - ' + (R.fresh.checked || 0) + ' drawn buffers checked, ' + st(R.fresh).length + ' stale; the crash ' + JSON.stringify(R.crash)
      + '; after the shed and the roll-out (live ' + R.live1 + ') - ' + (R.after.checked || 0) + ' checked, ' + st(R.after).length + ' STALE; uploads ' + JSON.stringify(R.gl) + '; drawn meshes by class ' + JSON.stringify(R.after.classes || {}) + '; the flown bake ' + JSON.stringify(R.bake || null));
  for (const s of st(R.after).slice(0, 12)) say('      stale: ' + JSON.stringify(s));
  say('  ' + R.key + ' THE ROLL-OUT SHOT: fresh - ' + JSON.stringify(R.shot0) + '; after the crash - ' + JSON.stringify(R.shot1) + ' (the shot’s wreck resets ' + R.rollResets + ')');
  if (R.damage !== false && R.shot1 && R.shot1.shot && R.shot1.worst > 0.3) bad('THE ROLL-OUT SHOT POSED THE WRECK after the crash: its nodes ' + R.shot1.worst + ' m off the aeroplane as built (fresh ' + (R.shot0 && R.shot0.worst) + ' m)');
  if (R.damage !== false && !(R.shot1 && R.shot1.shot)) say('  ' + R.key + ' (note: no roll-out shot frames seen after the crash - the shot row tests nothing)');
  if (st(R.fresh).length) bad('a fresh roll-out already holds stale buffers: ' + JSON.stringify(st(R.fresh).slice(0, 4)));
  if (R.damage === false) {   // DAMAGE OFF: the same path, no break - and the heal's upload marking never fires (no extra upload)
    say('  ' + R.key + ' DAMAGE OFF: the heal upload marking fired ' + R.healUploads + ' times; ' + st(R.after).length + ' stale');
    if (R.healUploads) bad('damage OFF: the heal marked folds for upload ' + R.healUploads + ' times (an extra upload with damage off)');
  } else if (!(R.crash && R.crash.br > 0)) bad('the crash broke nothing on the page - the path tests nothing');
  if (!R.live1) bad('the roll-out after the shed never went live');
  if (!(R.after && R.after.checked > 0)) bad('no drawn buffer of the flown model was checked after the path');
  if (R.fakeBake) {   // G2350: the folds are in the page, and drawn
    const B = R.bake || {}, fk = X => (X && X.checkedBy && X.checkedBy.fold) || 0;
    say('  ' + R.key + ': fold buffers checked fresh ' + fk(R.fresh) + ', after ' + fk(R.after) + ' (by class ' + JSON.stringify(R.after.checkedBy || {}) + ')');
    if (B.hit !== 'fake') bad('the flown bake was not the test\'s fake (FB.last.hit ' + JSON.stringify(B.hit) + ')');
    if (!B.hybrid || !(B.foldMeshes > 0)) bad('no hybrid fold was made (' + JSON.stringify(B) + ')');
    if (!(fk(R.fresh) > 0) || !(fk(R.after) > 0)) bad('no drawn fold buffer checked (fresh ' + fk(R.fresh) + ', after ' + fk(R.after) + ')');
  }
  if (st(R.after).length) bad('STALE GPU BUFFERS after crash -> the shed -> roll-out (the CPU written without the upload): ' + st(R.after).slice(0, 6).map(s => s.cls + ':' + s.mesh + '.' + s.attr + ' ' + (s.elements || s.why)).join(', '));
  if ((R.errors || []).length || (R.workerErrors || []).length) bad('errors: page ' + JSON.stringify(R.errors).slice(0, 300) + ', worker ' + JSON.stringify(R.workerErrors).slice(0, 200));
  return f;
}
function parent() {
  const secs = +arg('secs', 5), say = m => console.log(m), only = arg('only', null), keys = Object.keys(BUILDS).filter(k => !only || only.split(',').includes(k));
  if (argv.includes('--selftest')) {
    // two faults, each must go red ON A FOLD, with the fold rows themselves holding (else the red tests nothing):
    //   aswas - the code as it was before D4b's fix: the heal's marking off (FLYDIY_HEAL_NOMARK) AND the owed whole upload
    //           unguarded (FLYDIY_FOLD_NOOWE);
    //   noowe - D4b's fix alone (the mark on, G2352 off): the fuselage fold a rig writes every frame stays stale.
    // (--fault=nomark alone - G2352 on, the mark off - is GREEN on this path: every heal write here bumps a member's
    // version while the model is hidden in the shed, so the fold owes itself the whole upload anyway; G2352's report)
    say('DMGUPLOAD selftest: each fix off must turn it red on a fold');
    let all = true;
    for (const [fault, what] of [['aswas', 'the heal\'s upload marking off and the owed whole upload unguarded (the bug as it was)'], ['noowe', 'the fold\'s owed whole upload unguarded (G2352 off, D4b\'s mark on)']]) {
      say(' ' + fault + ': ' + what);
      const R = runChild('cub', fault, secs), f = judge(R, say), red = f.some(x => /STALE/.test(x)), onFold = ((R.after && R.after.stale) || []).some(x => x.cls === 'fold');
      const foldRows = !!R.fakeBake && !f.some(x => /fake|fold was made|fold buffer checked/.test(x));
      say('  ' + (red ? 'ok  ' : 'FAIL') + '  ' + fault + ' turned the stale-buffer row red' + (f.length ? ': ' + f.join(' | ') : ''));
      say('  ' + (onFold ? 'ok  ' : 'FAIL') + '  a stale buffer is a FOLD\'s (' + ((R.after && R.after.stale) || []).filter(x => x.cls === 'fold').length + ' fold buffers stale)');
      say('  ' + (foldRows ? 'ok  ' : 'FAIL') + '  the fake bake made the folds and they were drawn and checked');
      all = all && red && onFold && foldRows;
    }
    console.log('GATE DMGUPLOAD-SELFTEST: ' + (all ? 'PASS' : 'FAIL')); process.exit(all ? 0 : 1);
  }
  say('GATE DMGUPLOAD - what the GPU holds after a wreck is what the CPU holds (dev.html?simw=1&damage=1: crash -> the shed -> roll-out)');
  let fails = [];
  const pf = arg('fault', '');   // (G2350: --fault=nomark|noowe|aswas on the gate's own runs - a fix's A/B; the gate's verdict then reads it)
  if (pf) say('  (fault ' + pf + ')');
  for (const k of keys) fails = fails.concat(judge(runChild(k, pf, secs), say));
  // (train 41: the mild staging above kept; on the train-39 physics - DRIVE2, WALL, TUNE - it broke the Cub only a little
  // (12 members). A breaking-up Cub is staged too, so the folds' heal is tested on a real wreck)
  if (keys.includes('cub') && arg('hard', '1') !== '0') {
    say('  cub, THE HARD STAGING (' + JSON.stringify(STAGES.hard) + '): the wreck must break up (' + HARD_MIN + '+ members)');
    const R = runChild('cub', pf, secs, undefined, STAGES.hard), f = judge(R, say), br = R.crash ? R.crash.br : 0;
    if (!(br >= HARD_MIN)) f.push('cub (hard): the hard staging broke ' + br + ' members, not a break-up (' + HARD_MIN + '+): it tests the mild case again');
    fails = fails.concat(f);
  }
  fails = fails.concat(judge(runChild(keys[0], '', secs, false), say));   // (damage OFF: one build)
  for (const x of fails) say('  FAIL  ' + x);
  console.log('GATE DMGUPLOAD: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}
if (argv.includes('--child=1')) child().catch(e => { console.error(e && e.stack || e); process.exit(2); }); else parent();
