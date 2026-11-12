#!/usr/bin/env node
// _scene_check.js - GATE SCENE (PHOTO-MODE-2 P0, 2026-11-11): the scene file and the pose, in node.
//
//   node tools/_scene_check.js   -> "GATE SCENE: PASS|FAIL", exit 1 on FAIL
//
// 1. THE FORMAT: the design's example and every shots/scenes/*.scene.json normalise clean; a minimal scene is a scene;
//    the wrong `what` / `v`, a bad vector, an eye on its target are refused; ranges clamp with a warning; unknown fields
//    ride along. The JSON Schema beside the design names the same enums as the core (the two cannot drift).
// 2. THE FRAME: a plane-anchored camera to world and back is the identity; at HOME (hdg pi) forward is -x and right -z.
// 3. THE PICTURE: the scene in a PNG's iTXt chunk and back (plain and zlib), every chunk's CRC right, the chunk before
//    IEND, a second put replaces the first, the picture's own chunks untouched, a non-PNG refused; a real build's scene
//    compressed stays small (the user, 11 Nov: "as long as you keep decent file sizes").
// 4. THE POSE (placePose on the stock build): every beam's length kept to 1e-9, the CG where asked, the nose along the
//    heading frame's forward, pitch nose-up +, roll right-wing-down + (MEASURED off sim.axes(), AXES & SIGNS), HOME's
//    pose = placeAtAerodrome's to the bit, seated the same, the speed along the nose.
// 5. THE OUTPUT SIZE: the window's by default, the scene's when it asks, the largest side capped.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));

let fails = 0;
const ok = (c, msg, got) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (got !== undefined ? '  [' + got + ']' : '')); if (!c) fails++; };
const near = (a, b, e) => Math.abs(a - b) <= e;
const D2R = Math.PI / 180;

// ---- 1. the format ------------------------------------------------------------------------------------------------
console.log('1. the format');
const DES = path.join(ROOT, 'futureDesigns', 'photo-mode-2');
const example = JSON.parse(fs.readFileSync(path.join(DES, 'example_cub_lagoon.scene.json'), 'utf8'));
{
  const r = C.sceneNormalise(example);
  ok(r.ok && r.errors.length === 0, 'the design\'s example normalises', r.errors.join('; '));
  ok(r.warnings.length === 0, 'the example needs no clamp', r.warnings.join('; '));
  const min = C.sceneNormalise({ what: 'wingsmith-scene', v: 1, camera: { eye: [0, 2, 8], target: [0, 1, 0], fov: 40 }, time: { preset: 'golden' } });
  ok(min.ok, 'a six-line scene is a scene (a missing field = leave it as it is)', min.errors.join('; '));
  ok(C.sceneNormalise(JSON.stringify(example)).ok, 'a JSON string is read as the object');
  ok(!C.sceneNormalise('{').ok, 'broken JSON is refused');
  ok(!C.sceneNormalise({ what: 'flydiy-build', v: 1 }).ok, 'a build file is not a scene');
  const newer = C.sceneNormalise({ what: 'wingsmith-scene', v: 2 });
  ok(!newer.ok && /newer game/.test(newer.errors[0]), 'a newer version is refused and says so', newer.errors[0]);
  ok(!C.sceneNormalise({ what: 'wingsmith-scene', v: 1, camera: { eye: [0, 1] } }).ok, 'a two-number eye is refused');
  ok(!C.sceneNormalise({ what: 'wingsmith-scene', v: 1, camera: { eye: [1, 2, 3], target: [1, 2, 3] } }).ok, 'an eye on its own target is refused');
  ok(!C.sceneNormalise({ what: 'wingsmith-scene', v: 1, pose: { where: 'orbit' } }).ok, 'an unknown pose.where is refused');
  ok(!C.sceneNormalise({ what: 'wingsmith-scene', v: 1, pose: { where: 'air', at: [0, null, 0] } }).ok, 'in the air without a height is refused');
  const cl = C.sceneNormalise({ what: 'wingsmith-scene', v: 1, camera: { fov: 160 }, pose: { hdg: -90, controls: { aileron: 3 } }, quality: { output: [16384, 9216] } });
  ok(cl.ok && cl.scene.camera.fov === 100 && cl.scene.pose.controls.aileron === 1 && cl.scene.pose.hdg === 270,
     'ranges clamp (fov 160 -> 100, aileron 3 -> 1), a heading wraps (-90 -> 270)', cl.ok && [cl.scene.camera.fov, cl.scene.pose.controls.aileron, cl.scene.pose.hdg].join(' '));
  ok(cl.ok && cl.scene.quality.output[0] === C.SCENE_MAX_SIDE && cl.scene.quality.output[1] === 4608 && cl.warnings.length === 3, 'an output past the largest side is scaled down, aspect kept, each clamp warned (fov, aileron, output; a heading wraps silently)', cl.ok && cl.scene.quality.output.join('x') + ' / ' + cl.warnings.length);
  const ex = C.sceneNormalise(Object.assign({}, example, { mine: { a: 1 } }));
  ok(ex.ok && ex.scene.mine && ex.scene.mine.a === 1, 'an unknown field rides along');
  ok(example.camera.fov === 38 && ex.scene !== example, 'normalising copies (the caller\'s object untouched)');
  // the schema and the core name the same choices
  const sch = JSON.parse(fs.readFileSync(path.join(DES, 'scene.schema.json'), 'utf8')), P = sch.properties;
  const pairs = [['site', P.site.enum], ['worldKind', P.world.properties.kind.enum], ['anchor', P.camera.properties.anchor.enum],
    ['mode', P.camera.properties.mode.enum], ['timePreset', P.time.properties.preset.enum], ['where', P.pose.properties.where.enum],
    ['propLook', P.pose.properties.prop.properties.look.enum], ['rung', P.quality.properties.rung.enum], ['door', P.garage.properties.door.enum]];
  for (const [k, e] of pairs) ok(JSON.stringify(e) === JSON.stringify(C.SCENE_ENUMS[k]), 'schema = core: ' + k, JSON.stringify(e));
  ok(P.what.const === C.SCENE_WHAT && P.v.const === C.SCENE_V, 'schema = core: what / v');
  // every committed scene
  const SD = path.join(ROOT, 'shots', 'scenes');
  const files = fs.existsSync(SD) ? fs.readdirSync(SD).filter(f => /\.scene\.json$/.test(f)) : [];
  for (const f of files) { const r = C.sceneNormalise(fs.readFileSync(path.join(SD, f), 'utf8')); ok(r.ok, 'shots/scenes/' + f, r.errors.join('; ')); }
  console.log('  (' + files.length + ' committed scene' + (files.length === 1 ? '' : 's') + ' in shots/scenes/)');
  ok(C.SCENE_HQ_CAP_S > 0 && C.SCENE_HQ_CAP_S < 60, 'the high-quality shot is capped under a minute', C.SCENE_HQ_CAP_S + ' s');
}

// ---- 1b. the command line (tools/scene.js: what agents run, tools/PHOTO.md) ----------------------------------------
console.log('1b. the command line');
{
  const cp = require('child_process'), os = require('os');
  const run = (...a) => cp.spawnSync(process.execPath, [path.join(T, 'scene.js'), ...a], { encoding: 'utf8' });
  const r1 = run('check', path.join(DES, 'example_cub_lagoon.scene.json'));
  ok(r1.status === 0 && /: ok - "Cub over the lagoon"/.test(r1.stdout), 'scene.js check: the example is ok', r1.status);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-')), bad = path.join(tmp, 'bad.scene.json');
  fs.writeFileSync(bad, JSON.stringify({ what: 'wingsmith-scene', v: 1, camera: { eye: [1, 2] } }));
  const r2 = run('check', bad);
  ok(r2.status === 1 && /REFUSED/.test(r2.stdout), 'scene.js check: a bad scene exits 1 and says why', r2.status);
  const r3 = run('new', '--name', 'gate');
  ok(r3.status === 0 && C.sceneNormalise(r3.stdout).ok, 'scene.js new: writes a scene that normalises', r3.status);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
}

// ---- 2. the frame -------------------------------------------------------------------------------------------------
console.log('2. the frame');
{
  const fr = C.sceneFrame(Math.PI);
  ok(near(fr.f[0], -1, 1e-12) && near(fr.f[2], 0, 1e-12) && near(fr.r[2], -1, 1e-12), 'HOME (hdg pi): forward -x, right -z (+z is the left)', fr.f.map(v => v.toFixed(3)) + ' / ' + fr.r.map(v => v.toFixed(3)));
  let worst = 0;
  for (const h of [0, 0.7, Math.PI, 4.1]) {
    const A = { cg: [120.5, 33.2, -48.1], hdg: h }, cam = { anchor: 'plane', eye: [-9.5, 2.1, 6.0], target: [0.4, 0.2, 0] };
    const w = C.sceneToWorld(cam, A), back = C.sceneFromWorld(w.eye, w.target, A);
    for (let i = 0; i < 3; i++) worst = Math.max(worst, Math.abs(back.eye[i] - cam.eye[i]), Math.abs(back.target[i] - cam.target[i]));
  }
  ok(worst < 1e-9, 'plane-anchored -> world -> plane-anchored is the identity', worst.toExponential(2));
  const wc = C.sceneToWorld({ anchor: 'world', eye: [1, 2, 3], target: [4, 5, 6] }, { cg: [9, 9, 9], hdg: 1 });
  ok(wc.eye.join() === '1,2,3' && wc.target.join() === '4,5,6', 'a world-anchored camera is left as it is');
}

// ---- 3. the picture -----------------------------------------------------------------------------------------------
console.log('3. the picture');
{
  // a real 4x3 PNG (one tEXt of its own, to see it kept), built here with node's zlib
  const crcOf = b => C.sceneCrc32(b, 0, b.length);
  const chunk = (type, data) => { const t = Buffer.from(type, 'ascii'), L = Buffer.alloc(4); L.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crcOf(Buffer.concat([t, data]))); return Buffer.concat([L, t, data, c]); };
  const W = 4, H = 3, ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(H * (1 + W * 3)); for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) & 0xff; for (let y = 0; y < H; y++) raw[y * (1 + W * 3)] = 0;
  const png = new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('tEXt', Buffer.from('Software\0Wingsmith')),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  ok(crcOf(Buffer.from('IEND')) === 0xae426082, 'the CRC32 is PNG\'s (IEND = ae426082)', crcOf(Buffer.from('IEND')).toString(16));
  ok(C.scenePngGet(png) === null, 'a picture without a scene has none');
  const json = JSON.stringify(example), utf8 = new Uint8Array(Buffer.from(json, 'utf8'));
  const allCrc = p => C.scenePngChunks(p).every(ch => crcOf(Buffer.from(p.subarray(ch.at + 4, ch.end - 4))) === Buffer.from(p.subarray(ch.end - 4, ch.end)).readUInt32BE(0));
  for (const z of [false, true]) {
    const bytes = z ? new Uint8Array(zlib.deflateSync(Buffer.from(utf8))) : utf8;
    const out = C.scenePngPut(png, bytes, z), got = C.scenePngGet(out);
    const back = got && Buffer.from(got.compressed ? zlib.inflateSync(Buffer.from(got.bytes)) : Buffer.from(got.bytes)).toString('utf8');
    ok(back === json && got.compressed === z, (z ? 'zlib' : 'plain') + ': the scene comes back byte for byte');
    const types = C.scenePngChunks(out).map(c => c.type).join(' ');
    ok(types === 'IHDR tEXt IDAT iTXt IEND', (z ? 'zlib' : 'plain') + ': the chunk sits before IEND, the picture\'s own chunks kept in order', types);
    ok(allCrc(out), (z ? 'zlib' : 'plain') + ': every chunk\'s CRC is right');
    const two = C.scenePngPut(out, sceneBytes('again'), false);
    ok(C.scenePngChunks(two).filter(c => c.type === 'iTXt').length === 1 && Buffer.from(C.scenePngGet(two).bytes).toString() === 'again', (z ? 'zlib' : 'plain') + ': a second put replaces the first');
    const idat = c => { const ch = C.scenePngChunks(c).find(x => x.type === 'IDAT'); return Buffer.from(c.subarray(ch.at, ch.end)).toString('hex'); };
    ok(idat(out) === idat(png), (z ? 'zlib' : 'plain') + ': the image data untouched');
  }
  ok(C.scenePngPut(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), utf8, false) === null && C.scenePngGet(new Uint8Array(4)) === null, 'a file that is not a PNG is refused, never broken');
  const cut = png.slice(0, png.length - 6);
  ok(C.scenePngPut(cut, utf8, false) === null, 'a truncated PNG is refused');
  // the size with a real build inline (the C172, the biggest build file we keep)
  const bf = path.join(ROOT, 'builds', 'cessna172_2026-09-20.json');
  if (fs.existsSync(bf)) {
    const build = JSON.parse(fs.readFileSync(bf, 'utf8'));
    const sc = Object.assign({}, example, { plane: { ref: 'mine:C172', build } });
    const plain = Buffer.byteLength(JSON.stringify(sc)), zz = zlib.deflateSync(Buffer.from(JSON.stringify(sc))).length;
    ok(C.sceneNormalise(sc).ok, 'a scene with the C172 inline normalises');
    ok(zz < 16 * 1024, 'the C172 scene compressed is under 16 KB in the picture', (plain / 1024).toFixed(1) + ' KB -> ' + (zz / 1024).toFixed(1) + ' KB');
  } else ok(false, 'builds/cessna172_2026-09-20.json is missing');
}
function sceneBytes(s) { return new Uint8Array(Buffer.from(s, 'utf8')); }

// ---- 4. the pose ---------------------------------------------------------------------------------------------------
console.log('4. the pose');
{
  const def = C.buildGen(JSON.parse(JSON.stringify(C.GEN_DEFAULT)));
  const sim = C.makeSim(def, null);
  const fresh = () => { sim.reset(0); if (sim.stance) sim.stance(); };
  const L = () => sim.beams.map(b => Math.hypot(sim.p[b.a * 3] - sim.p[b.b * 3], sim.p[b.a * 3 + 1] - sim.p[b.b * 3 + 1], sim.p[b.a * 3 + 2] - sim.p[b.b * 3 + 2]));
  fresh();
  ok(sim.beams.length > 50 && sim.beams[0].a != null, 'the stock build: ' + sim.n + ' nodes, ' + sim.beams.length + ' beams');
  const L0 = def.nodes.length && (() => { const P = sim.p; for (let i = 0; i < sim.n; i++) { P[i * 3] = def.nodes[i].p[0]; P[i * 3 + 1] = def.nodes[i].p[1]; P[i * 3 + 2] = def.nodes[i].p[2]; } return L(); })();
  const ax0 = sim.axes();
  const rest = { nose: ax0[0].map(v => -v), right: ax0[2] };
  console.log('  (rest datum: nose ' + rest.nose.map(v => v.toFixed(4)).join(', ') + ')');
  const POSES = [{ hdg: Math.PI, pitch: 0, roll: 0 }, { hdg: 0.6, pitch: 12 * D2R, roll: 0 }, { hdg: 2.2, pitch: 0, roll: 25 * D2R },
                 { hdg: 4.0, pitch: -8 * D2R, roll: -40 * D2R }, { hdg: 1.0, pitch: 55 * D2R, roll: 85 * D2R }];
  let worstL = 0, worstCg = 0;
  for (const ps of POSES) {
    fresh();
    const at = [1520, 45.5, -840];
    const cg = C.placePose(sim, def, Object.assign({ at }, ps));
    const Ln = L(); for (let i = 0; i < Ln.length; i++) worstL = Math.max(worstL, Math.abs(Ln[i] - L0[i]));
    const g = sim.cgPos(); for (let i = 0; i < 3; i++) worstCg = Math.max(worstCg, Math.abs(g[i] - at[i]), Math.abs(cg[i] - at[i]));
  }
  ok(worstL < 1e-9, 'every beam keeps its length under every pose (rigid: no strain)', worstL.toExponential(2) + ' m');
  ok(worstCg < 1e-9, 'the mass centre lands where asked', worstCg.toExponential(2) + ' m');
  // the signs, measured off the solver's own axes (relative to the rest datum, which a build may draw a hair off level)
  const nose = () => sim.axes()[0].map(v => -v), right = () => sim.axes()[2];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const restPitch = Math.asin(rest.nose[1]);
  fresh(); C.placePose(sim, def, { at: [0, 50, 0], hdg: 0.6, pitch: 12 * D2R, roll: 0 });
  const n1 = nose(), F1 = C.sceneFrame(0.6);
  ok(near(Math.asin(n1[1]) - restPitch, 12 * D2R, 1e-6), 'pitch +12 deg: the nose UP 12 deg', ((Math.asin(n1[1]) - restPitch) / D2R).toFixed(4));
  const h1 = Math.hypot(n1[0], n1[2]);
  ok(near(n1[0] / h1, F1.f[0], 1e-6) && near(n1[2] / h1, F1.f[2], 1e-6), 'hdg 0.6: the nose along the scene frame\'s forward (cos, 0, sin)', (n1[0] / h1).toFixed(5) + ', ' + (n1[2] / h1).toFixed(5));
  fresh(); C.placePose(sim, def, { at: [0, 50, 0], hdg: 2.2, pitch: 0, roll: 25 * D2R });
  const r2 = right(), restRoll = Math.asin(-rest.right[1]);
  ok(near(Math.asin(-r2[1]) - restRoll, 25 * D2R, 1e-6), 'roll +25 deg: the RIGHT wing down 25 deg', ((Math.asin(-r2[1]) - restRoll) / D2R).toFixed(4));
  const F2 = C.sceneFrame(2.2);
  ok(dot(r2, F2.r) > 0.89, 'the right wing on the scene frame\'s right', dot(r2, F2.r).toFixed(4));
  // HOME's pose IS the spawn identity on the as-built geometry (reset WITHOUT stance: stance pitches a taildragger
  // rigidly onto its three wheels, which placePose does not - it starts from def.nodes), and seats the same either way
  const gH = () => 0;
  sim.reset(0); C.placeAtAerodrome(sim, { hdg: Math.PI, spawn: [0, 0], elev: 0 }); const A = Array.from(sim.p); C.seatOnGround(sim, gH, def.refs); const As = Array.from(sim.p);
  // (reset lifts the as-built geometry as one onto the ground: the same shape, so HOME's CG is the reset's)
  sim.reset(0); const cgHome = sim.cgPos();
  C.placePose(sim, def, { at: cgHome, hdg: Math.PI, pitch: 0, roll: 0 });
  let dP = 0; for (let i = 0; i < A.length; i++) dP = Math.max(dP, Math.abs(sim.p[i] - A[i]));
  ok(dP < 1e-12, 'HOME\'s pose = placeAtAerodrome\'s HOME (the as-built geometry)', dP.toExponential(2));
  C.seatOnGround(sim, gH, def.refs); let dS = 0; for (let i = 0; i < As.length; i++) dS = Math.max(dS, Math.abs(sim.p[i] - As[i]));
  ok(dS < 1e-9, '...and seats on the ground the same', dS.toExponential(2));
  fresh(); C.placeAtAerodrome(sim, { hdg: Math.PI, spawn: [0, 0], elev: 0 }); C.seatOnGround(sim, gH, def.refs); let dT = 0; for (let i = 0; i < As.length; i++) dT = Math.max(dT, Math.abs(sim.p[i] - As[i]));
  ok(dT < 1e-6, 'the roll-out\'s own order (reset, stance, place, seat) lands on the same seated pose', dT.toExponential(2));
  // a ground pose turned: seated, the wheels on the ground
  fresh(); C.placePose(sim, def, { at: [300, 5, -200], hdg: 1.3, pitch: 0, roll: 0 }); C.seatOnGround(sim, gH, def.refs);
  let low = Infinity; for (let i = 0; i < sim.n; i++) low = Math.min(low, sim.p[i * 3 + 1] - (sim.r[i] || 0));
  ok(near(low, 0.01, 1e-6), 'turned and seated: the lowest contact 1 cm over the ground (seatOnGround\'s rule)', (low * 100).toFixed(3) + ' cm');
  // the speed along the nose, the velocities zeroed without it
  fresh(); C.placePose(sim, def, { at: [0, 80, 0], hdg: 0.6, pitch: 12 * D2R, roll: 30 * D2R, speed: 40 });
  const v = sim.cgVel(), vn = Math.hypot(v[0], v[1], v[2]);
  const noseRigid = [Math.cos(12 * D2R) * Math.cos(0.6), Math.sin(12 * D2R), Math.cos(12 * D2R) * Math.sin(0.6)];
  ok(near(vn, 40, 1e-9) && dot(v, noseRigid) / vn > 1 - 1e-9, 'speed 40: every node at 40 m/s along the build\'s nose', vn.toFixed(6) + ' m/s');
  fresh(); for (let i = 0; i < sim.v.length; i++) sim.v[i] = 3; C.placePose(sim, def, { at: [0, 80, 0], hdg: 0.6 });
  ok(sim.v.every(x => x === 0), 'no speed: every velocity zeroed');
  // P2: THE POSE READ BACK (Save this scene): placePose -> scenePoseOf is the identity, and so is the round trip
  let worstA = 0, worstC = 0;
  const angd = (u, v) => Math.abs(Math.atan2(Math.sin(u - v), Math.cos(u - v)));
  for (const ps of POSES.concat([{ hdg: 5.9, pitch: -0.3, roll: 2.6 }, { hdg: 0.01, pitch: 0.9, roll: -1.4 }])) {
    fresh(); const at = [-210.5, 120.25, 3305.75]; C.placePose(sim, def, Object.assign({ at }, ps));
    const q = C.scenePoseOf(sim.p, sim.m, def);
    worstA = Math.max(worstA, angd(q.hdg, ps.hdg), angd(q.pitch, ps.pitch), angd(q.roll, ps.roll));
    for (let i = 0; i < 3; i++) worstC = Math.max(worstC, Math.abs(q.cg[i] - at[i]));
  }
  ok(worstA < 1e-9 && worstC < 1e-9, 'scenePoseOf reads placePose\'s pose back (heading, pitch, roll, CG) over a sweep', worstA.toExponential(2) + ' rad, ' + worstC.toExponential(2) + ' m');
  fresh(); C.placeAtAerodrome(sim, { hdg: 2.0, spawn: [40, -30], elev: 0 }); C.seatOnGround(sim, gH, def.refs);
  const seated = Array.from(sim.p), q2 = C.scenePoseOf(sim.p, sim.m, def);
  fresh(); C.placePose(sim, def, { at: q2.cg, hdg: q2.hdg, pitch: q2.pitch, roll: q2.roll });
  let dR = 0; for (let i = 0; i < seated.length; i++) dR = Math.max(dR, Math.abs(sim.p[i] - seated[i]));
  ok(dR < 1e-9, 'an aeroplane seated by the game, read and put back: every node where it was (Save -> Load)', dR.toExponential(2) + ' m');
  ok(C.scenePoseOf(sim.p, sim.m, { nodes: def.nodes, refs: {} }) === null, 'no body refs: no pose (never a wrong one)');
}

// ---- 5. the output size ----------------------------------------------------------------------------------------------
console.log('5. the output size');
{
  ok(C.sceneOutputSize(null, [1600, 900]).join('x') === '1600x900', 'no size asked: the window\'s');
  ok(C.sceneOutputSize({ output: [1920, 1080] }, [1600, 900]).join('x') === '1920x1080', 'a size asked: that size');
  ok(C.sceneOutputSize({ output: null }, [10000, 5000]).join('x') === C.SCENE_MAX_SIDE + 'x4096', 'a huge window: the largest side capped, aspect kept');
  ok(C.SCENE_SIZES[0] === null && C.SCENE_SIZES.slice(1).every(s => s[0] * 9 === s[1] * 16), 'the bar\'s sizes: the window first, then 16:9 (the Steam page\'s ratio)');
}

console.log('GATE SCENE: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
