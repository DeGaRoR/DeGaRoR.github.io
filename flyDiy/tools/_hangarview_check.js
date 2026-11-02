#!/usr/bin/env node
// _hangarview_check.js - GATE HANGARVIEW (G3630-G3639 HANGAR-VIEW, 25 Oct): THE VIEW OUT OF THE GARAGE DOOR IS THE WORLD.
// src/viewer/hangar_view.js captures six faces of the world from the room's centre (colour + distance atlases) and draws
// them in the room as a sphere displaced by the captured distance. Against the real vendor/three.min.js under node:
//   1 THE FACES PAIR: each capture camera (90 deg, its basis from FACES in the shed's frame, turned by the shed's node)
//     projects a direction to the NDC the lookup computes (dot(d, R) / dot(d, F), dot(d, U) / dot(d, F)), and the lookup
//     picks the face whose camera saw it - capture and lookup are one convention
//   2 THE DISTANCE: a point D m out, projected by a reversed-depth camera (three's own makePerspective) and by the
//     logarithmic buffer's formula, comes back D from the resolve's inversion (0.5 m to 20 km, 1e-3 relative)
//   3 THE SEAMS: app.js captures at the boot after the warm draw, defers a return's recapture a face a frame, keeps the
//     craft's lights in the world (craftInWorldNow) and links the view's programs before the reveal; hangar.js's
//     outdoorsShow hides the outdoors' span and the sky and keeps 'room:polish'; the build manifest carries the file
//   4 NO READBACK: the view's file reads nothing back from the GPU (readRenderTargetPixels / readPixels / getBufferSubData)
// Usage: node tools/_hangarview_check.js. Exit 1 on any FAIL. No --help.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, detail) => { if (!c) fails++; console.log((c ? '  PASS ' : '  FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const HV = require(path.join(ROOT, 'src', 'viewer', 'hangar_view.js'));

// 1 the faces pair
{
  const node = new THREE.Object3D(); node.position.set(812.5, 41.2, -2210); node.rotation.y = 0.73; node.updateMatrixWorld(true);
  const basis = HV.FACES.map(f => { const F = new THREE.Vector3(f[0], f[1], f[2]), U = new THREE.Vector3(f[3], f[4], f[5]); return { F, U, R: U.clone().cross(F.clone().negate()) }; });
  const cam = new THREE.PerspectiveCamera(90, 1, 0.5, 20000);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), C = new THREE.Vector3(0, 2, 0).applyMatrix4(node.matrixWorld);
  let worst = 0, wrongFace = 0, n = 0, seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4000; i++) {
    const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); if (d.lengthSq() < 1e-3) continue; d.normalize();   // the shed's frame
    // the lookup (hangar_view.js GLSL_FACE, in JS)
    let k = 0, mx = d.dot(basis[0].F); for (let j = 1; j < 6; j++) { const t = d.dot(basis[j].F); if (t > mx) { mx = t; k = j; } }
    const fx = d.dot(basis[k].R) / mx, fy = d.dot(basis[k].U) / mx;
    // the capture's camera k, as capture() poses it
    const F = basis[k].F.clone().transformDirection(node.matrixWorld), U = basis[k].U.clone().transformDirection(node.matrixWorld), R = basis[k].R.clone().transformDirection(node.matrixWorld);
    m.makeBasis(R, U, F.clone().negate()); q.setFromRotationMatrix(m);
    cam.position.copy(C); cam.quaternion.copy(q); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    const P = d.clone().transformDirection(node.matrixWorld).multiplyScalar(250).add(C).project(cam);
    if (Math.abs(P.x) > 1 + 1e-6 || Math.abs(P.y) > 1 + 1e-6) wrongFace++;
    worst = Math.max(worst, Math.abs(P.x - fx), Math.abs(P.y - fy)); n++;
  }
  ok(wrongFace === 0 && worst < 1e-5, '1 THE FACES PAIR: the lookup\'s face and NDC are the capture camera\'s own (a turned shed)', n + ' directions, worst ' + worst.toExponential(2) + ', off-face ' + wrongFace);
}

// 2 the distance resolve inverts the depth (reversed float and logarithmic)
{
  const n = HV.S.near, f = HV.S.far, P = new THREE.Matrix4();
  P.makePerspective(-n, n, n, -n, n, f, THREE.WebGLCoordinateSystem, true);   // three's reversed projection (90 deg)
  const e = P.elements;
  let worstR = 0, worstL = 0;
  for (const D of [0.5, 0.8, 2, 11, 42, 150, 600, 2500, 9000, 19999]) {
    for (const [x, y] of [[0, 0], [0.7, -0.4], [-1, 1]]) {
      const zv = -D / Math.sqrt(1 + x * x + y * y);              // view depth of the point D m along that ray
      const w = -zv, zc = e[10] * zv + e[14], d = zc / w;        // reversed [0, 1]: the depth buffer's value
      const wR = f * n / ((f - n) * d + n);                      // the resolve's inversion (hangar_view.js distMat)
      worstR = Math.max(worstR, Math.abs(wR * Math.sqrt(1 + x * x + y * y) - D) / D);
      const dl = Math.log2(1 + w) / Math.log2(f + 1);           // three's logdepthbuf: log2(1 + w) * logDepthBufFC * 0.5
      const wL = Math.pow(2, dl * Math.log2(f + 1)) - 1;
      worstL = Math.max(worstL, Math.abs(wL * Math.sqrt(1 + x * x + y * y) - D) / D);
    }
  }
  ok(worstR < 1e-3 && worstL < 1e-3, '2 THE DISTANCE: the resolve inverts three\'s reversed depth and the logarithmic buffer', 'worst relative: reversed ' + worstR.toExponential(2) + ', log ' + worstL.toExponential(2));
}

// 3 the seams, in the sources
{
  const src = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const app = src('src/viewer/app.js'), han = src('src/viewer/hangar.js'), hv = src('src/viewer/hangar_view.js'), build = src('tools/build.js'), rw = src('src/viewer/render_world.js');
  ok(/revealPlant\(120, 0, \(\) => inGarage\)\)\.then\(\(\) => hviewBoot\(\)\)/.test(app), '3a the boot captures after the warm draw and the stand\'s grass (under the screen)');
  ok(/compileSliced\(hview\.group, aa && aa\.target \? aa\.target\(\) : null, hangarScene\)/.test(app), '3b the view\'s programs are linked before the reveal');
  ok(/if \(inShed\) hviewTick\(\);/.test(app) && /hviewHold = 45;/.test(app) && /hviewCapture\(\[hviewFace\]\)/.test(app), '3c a return\'s recapture is deferred, a face a shed frame');
  ok(/craftInWorldNow\(\(\) => \{\s*craft\.traverse\(o => \{ if \(\(o\.isMesh/.test(app), '3d the capture keeps the craft\'s lights in the world (its meshes hidden)');
  ok(/outdoorsShow: on => \{/.test(han) && /o\.name !== 'room:polish'/.test(han) && /skyMesh\.visible = !muted\.sky && !viewOut/.test(han), '3e hangar.js outdoorsShow: the outdoors\' span and the sky; the walls\' polish stays');
  ok(/'hangar\.js',\s*\n\s*'hangar_view\.js'/.test(build), '3f the build manifest carries hangar_view.js after hangar.js');
  ok(/exposureNow: \(\) => LE\.ex/.test(rw), '3g the world hands its eased exposure (the capture is lit as the world shows it)');
  ok(/HVIEW_N = \{ laptop: 768, potato: 768, retro: 768/.test(app) && /G\.soft && G\.soft\(\)\) return 0/.test(app), '3h potato / laptop / retro at 768, none on a software renderer');
  ok(/linear: hviewLinear\(\)/.test(app) && /cap\.isXRRenderTarget = !lin;/.test(hv) && /if \(uLin > 0\.5\) \{ c = pow\(c, vec3\(2\.2\)\); c = uK \* c/.test(hv) && /hviewGain\(\);   \/\/ \(the mood moves/.test(app),
    '3i the capture is drawn as the world frame is (the linear split: radiance, decoded in the room under the exposure ratio; else display-space)');
  ok(/camera\.position\.set\(HVIEW_C\[0\], HVIEW_C\[1\], HVIEW_C\[2\]\)\.applyMatrix4\(node\.matrixWorld\)/.test(app) && /camera\.position\.copy\(keepEye\)/.test(app) && /if \(first && WF\.worldUpdate\)/.test(app),
    '3j the world is updated and drawn from the capture eye (the main camera there, put back after every face)');
  ok(/if \(!hviewWant \|\| hviewBooting/.test(app), '3k the shed frames never capture while the boot does (one set, six faces)');
  // 4 no readback
  ok(!/readRenderTargetPixels|readPixels|getBufferSubData/.test(hv), '4 NO READBACK in hangar_view.js (the distance reaches the mesh by a vertex fetch)');
}
console.log(fails ? 'GATE HANGARVIEW: FAIL (' + fails + ')' : 'GATE HANGARVIEW: PASS');
process.exit(fails ? 1 : 0);
