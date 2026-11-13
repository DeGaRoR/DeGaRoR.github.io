#!/usr/bin/env node
// winch_page.js - the one-file page of the glider launch winch, for a phone: tools/_winch.html with its generator
// inlined, three.js from jsDelivr (r159, the last UMD build: same light units and colour management as the
// vendored r186) and the stills (reports/evidence/WINCH-LAUNCH/winch_*.jpg, from tools/winch_shot.js) embedded.
//
//   node tools/winch_page.js <out.html>
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const out = process.argv[2]; if (!out) { console.error('usage: node tools/winch_page.js <out.html>'); process.exit(1); }
let html = fs.readFileSync(path.join(T, '_winch.html'), 'utf8');
const gen = fs.readFileSync(path.join(T, '_winch_gen.js'), 'utf8');
const EVID = path.join(ROOT, 'reports', 'evidence', 'WINCH-LAUNCH');
const CAPS = { q: 'Three-quarter, cable end', side: 'Side, drawbar left', rear: 'From the launch point: fairleads and guillotines', chute: 'Glider end: drogue, strop, weak link, rings' };
const stills = Object.keys(CAPS).filter(k => fs.existsSync(path.join(EVID, 'winch_' + k + '.jpg')))
  .map(k => ({ src: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(EVID, 'winch_' + k + '.jpg')).toString('base64'), caption: CAPS[k] }));
const swap = (a, b) => { if (!html.includes(a)) throw new Error('missing: ' + a); html = html.replace(a, () => b); };
swap('<script src="../vendor/three.min.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js"></script>');
swap('<script src="_winch_gen.js"></script>', '<script>\n' + gen + '\n</script>\n<script>window.WINCH_STILLS = ' + JSON.stringify(stills) + ';</script>');
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB,', stills.length, 'stills');
