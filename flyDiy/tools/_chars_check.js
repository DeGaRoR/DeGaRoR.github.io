#!/usr/bin/env node
// GATE CHARS (CHARACTERS G2970) - the crowd's passengers: the cast and the clips as baked, the run that walks them, the
// fade that boards them, and what they may cost. Node only (the vendor three for the fade's materials), ~1 s.
//   1 TABLE  tools/chars_table.py CAST / CROWD_CLIPS == src/chars/crowd_pack.json: every member (a reuse names a crew
//            manifest), every clip, the roles walk / idle / queue / sit each naming a clip that exists
//   2 PACKS  the round trip: each member's manifest is the media file its name hashes, its geometry the .gz.bin whose
//            AS-IS bytes hash to its name; decodeChar reads every mesh inside its slice, the joint indices inside the
//            skeleton, the weights summing to one, the inverse binds finite; triangles as the manifest says
//   3 CLIPS  each clip's bin hashes to its name, decodes to frames x joints x 4 unit quaternions, frames = dur x fps + 1;
//            a walk carries its travel (rootV) and one bob per frame; the joints the crowd poses exist on every member
//   4 RUN    src/viewer/crowd.js's run on a straight and a bent path: everyone boards, in seat order; nobody closer than
//            the spacing to the one ahead, nobody passes; the walker is at the door's foot facing the door when the
//            fade starts; through the fade the walker's weight and the seat's add to one; it ends at the SEAT's pose
//   5 FADE   fadeObjects on real three materials: 0 hides, a part draws the twin (its own program key, the original's
//            uniforms by reference), 1 is the seated figure's OWN material again - the crew layer's occupant untouched
//   6 BUDGET a member's wire (geometry + the KTX2 it draws) <= memberMiB, the cast's <= castMiB, a clip <= clipKiB,
//            triangles <= tris (CROWD_BUDGET)
//   7 LAZY   crowd.js is a MANIFEST.lazy file; the built page carries neither its code nor a cast manifest
//   node tools/_chars_check.js          -> "GATE CHARS: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { readGeo } = require('./_media_lib.js');
const CODEC = require(path.join(ROOT, 'src', 'core', '52_char_codec.js'));
const CR = require(path.join(ROOT, 'src', 'viewer', 'crowd.js'));

let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const sha8 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 8);
const nameHash = rel => { const m = /\.([0-9a-f]{8})\.(?:gz\.bin|bin|json)$/.exec(rel); return m ? m[1] : null; };
const MiB = b => b / 1048576;

// ---- the declared table (python reads its own file; the bakers do the same) --------------------------------------
function table() {
  for (const py of ['python', 'python3', 'py']) {
    const r = cp.spawnSync(py, ['-c', 'import sys, json; sys.path.insert(0, sys.argv[1]); import chars_table as T; ' +
      'print(json.dumps(dict(CHARS=T.CHARS, ANIMS=T.ANIMS, CAST=getattr(T, "CAST", []), CLIPS=getattr(T, "CROWD_CLIPS", []), ' +
      'SIT=getattr(T, "CROWD_SIT", None), BUDGET=getattr(T, "CROWD_BUDGET", {}))))', __dirname], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return JSON.parse(r.stdout);
  }
  return null;
}
// a boot manifest (src/chars/<key>_char.js / _anim.js) -> its record
function bootManifest(file) {
  let got = null;
  const ctx = { registerChar: c => { got = c; }, registerCharAnim: a => { got = a; }, FLYDIY_ASSET_BASE: '' };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'chars', file), 'utf8'), ctx);
  return got;
}

const T = table();
const PACKF = path.join(ROOT, 'src', 'chars', 'crowd_pack.json');
const P = fs.existsSync(PACKF) ? JSON.parse(fs.readFileSync(PACKF, 'utf8')) : null;
verdict(!!T, '0 the table reads (tools/chars_table.py through python)');
verdict(!!P, '0 src/chars/crowd_pack.json is baked (python tools/char_prep.py)');

// ---- 1 TABLE == PACK ----------------------------------------------------------------------------------------------
const members = {};   // key -> { c: manifest, reuse, rel }
if (T && P) {
  const want = T.CAST.map(r => r.key), got = (P.cast || []).map(c => c.key);
  verdict(JSON.stringify(want) === JSON.stringify(got), `1 the cast in table order: ${got.join(', ')}` + (JSON.stringify(want) === JSON.stringify(got) ? '' : ` (table: ${want.join(', ')})`));
  for (const c of P.cast || []) {
    if (c.reuse) {
      const f = c.key + '_char.js', ok = fs.existsSync(path.join(ROOT, 'src', 'chars', f)) && T.CHARS.some(r => r.key === c.key);
      verdict(ok, `1 ${c.key}: reuses the crew's manifest ${f}`);
      if (ok) members[c.key] = { c: bootManifest(f), reuse: true };
    } else {
      const ok = !!c.man && fs.existsSync(path.join(ROOT, c.man));
      verdict(ok, `1 ${c.key}: its manifest ${c.man || '(none)'} is on disk`);
      if (ok) members[c.key] = { c: JSON.parse(fs.readFileSync(path.join(ROOT, c.man), 'utf8')), rel: c.man };
    }
  }
  const cw = T.CLIPS.map(r => r.key).sort(), cg = Object.keys(P.clips || {}).sort();
  verdict(JSON.stringify(cw) === JSON.stringify(cg), `1 the clips: ${cg.join(', ')}`);
  for (const role of ['walk', 'idle', 'queue', 'sit']) {
    const ks = (P.roles || {})[role] || [];
    const ok = ks.length > 0 && ks.every(k => (P.clips || {})[k] || (role === 'sit' && fs.existsSync(path.join(ROOT, 'src', 'chars', k + '_anim.js'))));
    verdict(ok, `1 role ${role}: ${ks.join(', ') || '(none)'}`);
  }
}

// ---- 2 PACKS: the round trip --------------------------------------------------------------------------------------
const wire = {};   // key -> bytes on the wire (geometry + KTX2)
let ktx2Boot = {};
try { ktx2Boot = require(path.join(ROOT, 'src', 'chars', 'chars_ktx2.js')).CHAR_KTX2_TABLE || {}; } catch (e) {}
for (const key of Object.keys(members)) {
  const { c, rel } = members[key];
  if (rel) {
    const raw = fs.readFileSync(path.join(ROOT, rel));
    verdict(sha8(raw) === nameHash(rel), `2 ${key}: the manifest's bytes hash to its name (${path.basename(rel)})`);
  }
  let bin = null;
  try { bin = readGeo(c.bin); } catch (e) {}
  verdict(!!bin && sha8(Buffer.from(bin)) === nameHash(c.bin), `2 ${key}: the geometry's as-is bytes hash to its name (${path.basename(c.bin)})`);
  if (!bin) continue;
  let dec = null, err = '';
  try { dec = CODEC.decodeChar(c, bin); } catch (e) { err = e.message; }
  verdict(!!dec, `2 ${key}: decodeChar reads every mesh inside its slice` + (err ? ' - ' + err : ''));
  if (!dec) continue;
  const nJ = c.joints.length;
  let badJ = 0, badW = 0, tris = 0, nv = 0;
  for (const m of dec.meshes) {
    tris += m.nt; nv += m.nv;
    for (let i = 0; i < m.jt.length; i++) if (m.jt[i] >= nJ) badJ++;
    for (let v = 0; v < m.nv; v++) { const s = m.wt[4 * v] + m.wt[4 * v + 1] + m.wt[4 * v + 2] + m.wt[4 * v + 3]; if (Math.abs(s - 1) > 0.02) badW++; }
  }
  const ibmOk = dec.ibm.length === 16 * nJ && dec.ibm.every(Number.isFinite);
  verdict(badJ === 0 && badW === 0 && ibmOk, `2 ${key}: ${nJ} joints, ${nv} vertices - ${badJ} joint indices outside, ${badW} weights not summing to 1, inverse binds ${ibmOk ? 'finite' : 'BAD'}`);
  if (c.tris != null) verdict(c.tris === tris, `2 ${key}: ${tris} triangles as its manifest says (${c.tris})`);
  members[key].tris = tris;
  // the wire: the gzip the page fetches + the KTX2 it draws (the pack's rows for a cast member, the boot table's for a reuse)
  let w = fs.statSync(path.join(ROOT, c.bin)).size;
  const row = (P && P.ktx2 && P.ktx2[key]) || ktx2Boot[key];
  if (row) for (const u of Object.keys(row.files || {})) if (fs.existsSync(path.join(ROOT, u))) w += fs.statSync(path.join(ROOT, u)).size;
  verdict(!!row, `2 ${key}: its KTX2 budget row (${P && P.ktx2 && P.ktx2[key] ? 'crowd_pack.json' : 'chars_ktx2.js'})`);
  wire[key] = w;
}

// ---- 3 CLIPS ------------------------------------------------------------------------------------------------------
const POSED = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const clipBytes = {};
for (const [k, a] of Object.entries((P && P.clips) || {})) {
  let bin = null;
  try { bin = readGeo(a.bin); } catch (e) {}
  verdict(!!bin && sha8(Buffer.from(bin)) === nameHash(a.bin), `3 clip ${k}: its bytes hash to its name (${path.basename(a.bin || '?')})`);
  if (!bin) continue;
  clipBytes[k] = fs.statSync(path.join(ROOT, a.bin)).size;
  let q = null;
  try { q = CODEC.decodeCharAnim(a, bin); } catch (e) {}
  let off = 0;
  if (q) for (let i = 0; i < q.length; i += 4) if (Math.abs(Math.hypot(q[i], q[i + 1], q[i + 2], q[i + 3]) - 1) > 1e-3) off++;
  const nf = Math.round(a.dur * a.fps) + 1;
  verdict(!!q && q.length === a.frames * a.joints.length * 4 && off === 0 && a.frames === nf,
    `3 clip ${k}: ${a.frames} frames x ${a.joints.length} joints @ ${a.fps} fps (${a.dur.toFixed(2)} s), ${off} quaternions off unit`);
  const miss = POSED.filter(n => !a.joints.includes(n));
  verdict(!miss.length, `3 clip ${k}: drives the body (${miss.length ? 'missing ' + miss.join(',') : POSED.length + ' joints'})`);
  verdict(Array.isArray(a.bob) && a.bob.length === a.frames && a.rootV >= 0, `3 clip ${k}: root travel ${a.rootV} m/s, ${a.bob ? a.bob.length : 0} bob samples`);
  if (a.role === 'walk') verdict(a.rootV === 0 || (a.rootV > 0.6 && a.rootV < 2.2), `3 clip ${k}: a walk's travel is a walking pace (${a.rootV} m/s; 0 = in place, the default speed)`);
  for (const key of Object.keys(members)) {
    const names = new Set(members[key].c.nodes.map(n => n.n.replace(/^.*:/, '')));
    const lack = POSED.filter(n => a.joints.includes(n) && !names.has(n));
    if (lack.length) verdict(false, `3 clip ${k} on ${key}: no joint ${lack.join(', ')}`);
  }
}

// ---- 4 RUN --------------------------------------------------------------------------------------------------------
function drive(path_, seats, opts) {
  const R = CR.run(Object.assign({ path: path_, seats }, opts || {}), { rootV: 1.4, queueClips: 2, bob: t => 0.02 * Math.sin(t * 6) });
  const dt = 1 / 30, sp = R.spec.spacing;
  let worst = Infinity, passed = 0, sum = 0, atDoor = Infinity, faceErr = 0, steps = 0;
  const L = R.P.L, end = path_[path_.length - 1];
  const seen = new Set();
  while (!R.done() && steps < 30 * 600) {
    R.step(dt); steps++;
    let ahead = null;
    for (const p of R.people) {
      if (p.state === 'wait' || p.state === 'seated') continue;
      if (ahead) { worst = Math.min(worst, ahead.s - p.s); if (p.s > ahead.s + 1e-9) passed++; }
      if (p.state === 'board') {
        sum = Math.max(sum, Math.abs(p.stand + p.seatW - 1));
        if (!seen.has(p.i)) {
          seen.add(p.i);
          atDoor = Math.min(atDoor, -Math.hypot(p.x - end[0], p.z - end[1]));
          faceErr = Math.max(faceErr, Math.abs(Math.atan2(Math.sin(p.yaw - R.face), Math.cos(p.yaw - R.face))));
        }
      }
      ahead = p;
    }
  }
  return { R, worst, passed, sum, atDoor: -atDoor, faceErr, steps, sp, L };
}
{
  const seats = [1, 2, 3, 4].map(i => ({ seat: i, key: 'k' + i, pose: { seat: i, m: [i, 0, 0] } }));
  // the door is beside the fuselage: the last leg arrives at it square, and the person turns a quarter to face it
  for (const [name, pth, face] of [['straight 30 m', [[0, 0], [30, 0]], 0], ['bent: out of a door, round a wing', [[0, 0], [0, 8], [14, 12], [20, 4]], -2.4]]) {
    const D = drive(pth, seats, { face });
    const order = D.R.boarded.join(',');
    verdict(D.R.done(), `4 ${name}: all ${seats.length} board (${(D.steps / 30).toFixed(1)} s)`);
    verdict(order === '1,2,3,4', `4 ${name}: in seat order (${order})`);
    verdict(D.worst >= D.sp - 1e-6 && D.passed === 0, `4 ${name}: nobody closer than ${D.sp} m to the one ahead (closest ${D.worst.toFixed(3)} m), ${D.passed} passings`);
    verdict(D.atDoor < 0.03 && D.faceErr < 1e-6, `4 ${name}: the fade starts at the door's foot (${D.atDoor.toFixed(3)} m) facing the door (${D.faceErr.toExponential(1)} rad)`);
    verdict(D.sum < 1e-9, `4 ${name}: walker + seat = 1 through every fade (worst ${D.sum.toExponential(1)})`);
    const endOk = D.R.people.every((p, i) => p.stand === 0 && p.seatW === 1 && p.pose === seats[i].pose);
    verdict(endOk, `4 ${name}: it ends at the SEAT's pose - the walker gone, the seat's figure whole, the seat's own pose record`);
  }
  // THE ROUTE: the aeroplane on its stand (nose +x, the door 1.3 m off the centreline on -z), starts aft (the hangar
  // behind it), forward (the propeller's side), abeam far, and the far side aft, abeam, forward - the path ends square at the door,
  // its last leg the queue's line, and no leg comes within 1.2 m of the fuselage's line (tail 6 m aft to nose 2 m ahead)
  {
    const door = [0, -1.3], out = [0, -1], fwd = [1, 0];
    const segD = (p, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1;
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2));
      return Math.hypot(p[0] - a[0] - vx * u, p[1] - a[1] - vz * u); };
    const fus = [[-6, 0], [2, 0]];
    // the closest two segments come, by sampling (a path leg vs the fuselage's line)
    const legGap = (a, b) => { let m = Infinity; for (let k = 0; k <= 50; k++) { const t = k / 50; m = Math.min(m, segD([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], fus[0], fus[1])); } return m; };
    for (const [name, from] of [['aft (the hangar behind)', [-20, 4]], ['forward (the propeller side)', [25, 3]], ['abeam, far out', [0, -30]], ['aft, the far side', [-15, 12]], ['abeam, the far side', [1, 10]], ['forward, the far side', [20, 10]], ['forward, the door side', [25, -5]]]) {
      const R = CR.route({ door, out, fwd, from, n: 4 });
      const P = R.path, n = P.length, last = P[n - 1], prev = P[n - 2];
      const endOk = Math.hypot(last[0] - door[0], last[1] - door[1]) < 1e-9;
      const square = prev && Math.abs((prev[0] - last[0]) * fwd[0] + (prev[1] - last[1]) * fwd[1]) < 1e-9 && (prev[0] - last[0]) * out[0] + (prev[1] - last[1]) * out[1] >= 4 * 0.9;
      let gap = Infinity;
      for (let i = 1; i < n - 1; i++) gap = Math.min(gap, legGap(P[i - 1], P[i]));
      verdict(endOk && square && gap >= 1.2 && Math.abs(R.face - Math.atan2(-out[0], -out[1])) < 1e-12,
        `4 route from ${name}: ${n} points, ends at the door with the queue's line square to it, closest to the fuselage ${gap.toFixed(2)} m, faces the door`);
    }
  }
  // the queue bends with a short path: six people, a path for three - nobody leaves before there is room
  const D = drive([[0, 0], [2.2, 0]], [1, 2, 3, 4, 5, 6].map(i => ({ seat: i })));
  verdict(D.R.done() && D.passed === 0 && D.worst >= D.sp - 1e-6, `4 a path shorter than the queue: everyone boards, none closer than the spacing (closest ${D.worst.toFixed(3)} m)`);
}

// ---- 5 FADE -------------------------------------------------------------------------------------------------------
{
  const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  const hook = function (shader) { shader.uniforms.uInside = this.userData.aeroU.uInside; };
  const own = new THREE.MeshStandardMaterial({ alphaTest: 0.5 });
  own.userData.aeroU = { uInside: { value: new THREE.Vector2(1, 0) } };
  own.onBeforeCompile = hook;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), own);
  CR.fadeObjects(THREE, [mesh], 0);
  verdict(mesh.visible === false && mesh.material === own, '5 w 0: the seated figure hidden, its own material kept');
  CR.fadeObjects(THREE, [mesh], 0.4);
  const tw = mesh.material;
  verdict(mesh.visible && tw !== own && tw.userData.crowdFade.value === 0.4 && tw.alphaTest === 0.5,
    '5 w 0.4: the twin draws it, uFade 0.4, the cutout kept');
  verdict(/^crowdFade\|/.test(tw.customProgramCacheKey()) && tw.userData.aeroU === own.userData.aeroU,
    '5 the twin: its own program key, the original\'s uniforms by reference (not a JSON copy)');
  const sh = { uniforms: {}, vertexShader: '#include <common>', fragmentShader: '#include <common>\n#include <clipping_planes_fragment>' };
  tw.onBeforeCompile.call(tw, sh);
  verdict(sh.uniforms.uInside === own.userData.aeroU.uInside && sh.uniforms.uFade === tw.userData.crowdFade && /discard/.test(sh.fragmentShader),
    '5 the twin\'s hook runs the original\'s first, then the dissolve');
  CR.fadeObjects(THREE, [mesh], 1);
  verdict(mesh.visible && mesh.material === own, '5 w 1: the seated figure is its OWN material again (the crew layer\'s occupant untouched)');
  const walker = CR.fadeTwin(THREE, own, 0);
  verdict(walker.userData.aeroU.uInside.value.x === 0 && own.userData.aeroU.uInside.value.x === 1,
    '5 a walker\'s twin: outdoors (uInside 0), the seated material still indoors');
}

// ---- 6 BUDGET -----------------------------------------------------------------------------------------------------
if (T && P) {
  const B = Object.assign({ memberMiB: 6, castMiB: 30, clipKiB: 400, tris: 60000 }, T.BUDGET || {});
  let sum = 0;
  for (const [k, w] of Object.entries(wire)) {
    sum += w;
    verdict(MiB(w) <= B.memberMiB, `6 ${k}: ${MiB(w).toFixed(2)} MiB on the wire (<= ${B.memberMiB})`);
    verdict(members[k].tris <= B.tris, `6 ${k}: ${members[k].tris} triangles (<= ${B.tris})`);
  }
  verdict(MiB(sum) <= B.castMiB, `6 the cast: ${MiB(sum).toFixed(2)} MiB on the wire (<= ${B.castMiB})`);
  for (const [k, b] of Object.entries(clipBytes)) verdict(b / 1024 <= B.clipKiB, `6 clip ${k}: ${(b / 1024).toFixed(0)} KiB (<= ${B.clipKiB})`);
}

// ---- 7 LAZY -------------------------------------------------------------------------------------------------------
{
  const build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  verdict(/\['src\/viewer', 'crowd\.js'\]/.test(build), '7 crowd.js is a MANIFEST.lazy file (build.js)');
  const page = fs.existsSync(path.join(ROOT, 'index.html')) ? fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') : '';
  const inl = /crowdIgn|registerChar\(\(c => \{[^]{0,400}"cast":1/.test(page) || /media\/chars\//.test(page);
  verdict(!!page && !inl, '7 index.html inlines no crowd code and names no cast manifest');
  verdict(!fs.readdirSync(path.join(ROOT, 'src', 'chars')).some(f => /_char\.js$/.test(f) && P && (P.cast || []).some(c => !c.reuse && f === c.key + '_char.js')),
    '7 no cast member has a boot manifest (src/chars/<key>_char.js)');
}

console.log('GATE CHARS: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
