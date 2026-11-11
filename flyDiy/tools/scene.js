#!/usr/bin/env node
// scene.js - THE SCENE FILE FROM THE COMMAND LINE (PHOTO-MODE-2 P0, 2026-11-11). The core's own functions
// (src/core/89_scene.js through tools/flight_core.js), so a scene checked here is a scene the game reads.
// The how-to: tools/PHOTO.md.
//
//   node tools/scene.js check <a.scene.json | picture.png> ...   the verdict per file: errors (exit 1), clamps, a summary
//   node tools/scene.js new [--build <build.json>] [--name "..."] > my.scene.json
//                                                                a minimal scene to edit (the build inline when given)
//   node tools/scene.js put <picture.png> <a.scene.json> [-o out.png]   the scene into the picture (compressed iTXt);
//                                                                default: overwrites nothing, writes <picture>.scene.png
//   node tools/scene.js get <picture.png> [-o a.scene.json]      the scene out of a picture (stdout by default)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const C = require(path.join(__dirname, 'flight_core.js'));
const argv = process.argv.slice(2), cmd = argv.shift();
const opt = k => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const die = m => { console.error('scene.js: ' + m); process.exit(2); };
const isPng = b => b.length > 8 && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71;
const fromPng = buf => { const g = C.scenePngGet(new Uint8Array(buf)); if (!g) return null;
  return Buffer.from(g.compressed ? zlib.inflateSync(Buffer.from(g.bytes)) : Buffer.from(g.bytes)).toString('utf8'); };

if (cmd === 'check') {
  if (!argv.length) die('check <file> ...');
  let bad = 0;
  for (const f of argv) {
    const buf = fs.readFileSync(f);
    let text = buf.toString('utf8');
    if (isPng(buf)) { text = fromPng(buf); if (text == null) { console.log(f + ': a picture with no scene in it'); bad++; continue; } }
    const r = C.sceneNormalise(text);
    if (!r.ok) { console.log(f + ': REFUSED'); for (const e of r.errors) console.log('  error  ' + e); bad++; continue; }
    const S = r.scene, P = S.pose || {}, Cm = S.camera || {}, T = S.time || {};
    const plane = S.plane ? (S.plane.ref || (S.plane.build && S.plane.build.name) || 'a build') + (S.plane.build ? ' (inline, ' + (JSON.stringify(S.plane.build).length / 1024).toFixed(1) + ' KB)' : ' (no build: the page\'s own)') : 'the page\'s own';
    console.log(f + ': ok' + (S.name ? ' - "' + S.name + '"' : ''));
    console.log('  site ' + (S.site || 'flight (default)') + ' · plane ' + plane);
    if (S.pose) console.log('  pose ' + (P.where || '?') + (P.at ? ' at ' + P.at.map(v => v == null ? 'seat' : v).join(', ') : '') + (P.hdg != null ? ' · hdg ' + P.hdg + '°' : '') + (P.pitch != null ? ' pitch ' + P.pitch + '°' : '') + (P.roll != null ? ' roll ' + P.roll + '°' : ''));
    if (S.camera) console.log('  camera ' + (Cm.anchor || 'plane') + (Cm.eye ? ' eye ' + Cm.eye.join(', ') : '') + (Cm.target ? ' → ' + Cm.target.join(', ') : '') + (Cm.fov ? ' · fov ' + Cm.fov + '°' : ''));
    if (S.time) console.log('  time ' + [T.date, T.localHours != null ? T.localHours + ' h local' : T.utc != null ? T.utc + ' h UTC' : T.preset].filter(Boolean).join(' '));
    const q = S.quality || {};
    console.log('  picture ' + (q.output ? q.output.join('x') : 'the window\'s size') + (q.hq ? ' · high quality' : ''));
    for (const w of r.warnings) console.log('  clamp  ' + w);
    console.log('  size ' + (Buffer.byteLength(JSON.stringify(S)) / 1024).toFixed(1) + ' KB, ' + (zlib.deflateSync(Buffer.from(JSON.stringify(S))).length / 1024).toFixed(1) + ' KB in a picture');
  }
  process.exit(bad ? 1 : 0);
} else if (cmd === 'new') {
  const bf = opt('--build'), name = opt('--name') || 'my scene';
  const S = { what: C.SCENE_WHAT, v: C.SCENE_V, name, made: new Date().toISOString(), site: 'flight',
    camera: { anchor: 'plane', eye: [-12, 3, 8], target: [0, 0.5, 0], fov: 40 },
    time: { preset: 'golden', frozen: true },
    quality: { hq: false, output: null } };   // no pose: the aeroplane where the page has it (tools/PHOTO.md, "pose")
  if (bf) { const b = JSON.parse(fs.readFileSync(bf, 'utf8')); S.plane = { ref: 'file:' + path.basename(bf), build: b.what === 'flydiy-build' ? b : { what: 'flydiy-build', v: b.v, name: path.basename(bf, '.json'), spec: b } }; }
  const r = C.sceneNormalise(S); if (!r.ok) die(r.errors.join('; '));
  process.stdout.write(JSON.stringify(r.scene, null, 2) + '\n');
} else if (cmd === 'put') {
  const out = opt('-o'); const [pic, sf] = argv; if (!pic || !sf) die('put <picture.png> <a.scene.json> [-o out.png]');
  const r = C.sceneNormalise(fs.readFileSync(sf, 'utf8')); if (!r.ok) die(sf + ': ' + r.errors.join('; '));
  const png = C.scenePngPut(new Uint8Array(fs.readFileSync(pic)), new Uint8Array(zlib.deflateSync(Buffer.from(JSON.stringify(r.scene)))), true);
  if (!png) die(pic + ': not a PNG this can read');
  const o = out || pic.replace(/\.png$/i, '') + '.scene.png';
  if (path.resolve(o) === path.resolve(pic)) die('-o is the picture itself: write a new file');
  fs.writeFileSync(o, png); console.log(o + ' (' + (png.length / 1024).toFixed(1) + ' KB, the scene ' + "\"" + (r.scene.name || '') + "\")");
} else if (cmd === 'get') {
  const out = opt('-o'); const [pic] = argv; if (!pic) die('get <picture.png> [-o a.scene.json]');
  const t = fromPng(fs.readFileSync(pic)); if (t == null) die(pic + ': no scene in this picture');
  const pretty = JSON.stringify(JSON.parse(t), null, 2) + '\n';
  if (out) { fs.writeFileSync(out, pretty); console.log(out); } else process.stdout.write(pretty);
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 12).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 2 : 0);
}
