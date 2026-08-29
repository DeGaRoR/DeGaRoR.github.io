#!/usr/bin/env node
// sky_tex_prep.js — bakes the hangar's SKY SET into src/viewer/hangar_sky.js:
// one display equirect per time of day, each with the light rig measured off
// its own HDR.
//
// SOURCE: assets/hangar_sky/ — the .jpg display images and skies.json, both
// written by `python tools/sky_prep.py` from the Poly Haven CC0 .hdr sources.
// That tool is where the tone curve, the day-cycle levels and every measured
// number live; this one only carries them into the artifact. Run it first.
//
// WHY THE IMAGES ARE NOT PRE-DECODED, unlike the walls and the floor. Those
// are 1k tiles; these are 4k equirects, and five of them decoded at once is
// ~170 MB of bitmap for four skies nobody is looking at. So each row hands out
// an `img()` and the cache holds exactly ONE — asking for a different sky
// drops the last one for the collector. The cost is a re-decode when a mood is
// switched back to, which is a few hundred milliseconds against a mood change
// that already re-bakes the environment and the floor shadow.
//
// Run after `python tools/sky_prep.py`: node tools/sky_tex_prep.js
// The output is committed, like the model payloads.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'hangar_sky');
const OUT = path.join(ROOT, 'src', 'viewer', 'hangar_sky.js');

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'skies.json'), 'utf8'));

// the fields the room actually runs on. Everything else in skies.json is the
// working — kept there so the numbers can be argued with, not shipped.
//
// The key light's intensity ships as `keyI`, not `key`: `key` is the row's own
// identifier, and an object literal carrying the same name twice keeps only the
// last one — which silently cost every row its identity the first time round.
const uri = f => 'data:image/jpeg;base64,' +
  fs.readFileSync(path.join(SRC, f)).toString('base64');

let rows = '', report = [];
for (const s of manifest.skies) {
  rows += `    { key: '${s.key}', name: '${s.name}',\n` +
    `      // measured off ${s.src}: sun ${s.measured.direct >= 0.5 ? 'hard' : 'diffuse'}` +
    ` (direct ${s.measured.direct}), level ${s.measured.level}\n` +
    `      sunUV: [${s.sunUV[0]}, ${s.sunUV[1]}], hasSun: ${s.hasSun},\n` +
    `      yaw: ${s.yaw},   // sun ${s.sunOff}° off the door axis\n` +
    `      keyI: ${s.keyI}, kc: ${s.kc}, hemi: ${s.hemi}, top: ${s.top},\n` +
    `      hemiSky: ${s.skyColor}, hemiGnd: ${s.gndColor},\n` +
    `      env: ${s.env}, lamp: ${s.lamp}, ex: ${s.ex},\n` +
    `      bg: ${s.bg}, card: ${s.card}, panel: ${s.panel}, shaft: ${s.shaft},\n` +
    `      src: '${uri(s.file)}' },\n`;
  report.push(`${s.key} ${(fs.statSync(path.join(SRC, s.file)).size / 1048576).toFixed(2)} MB`);
}

const body = `// GENERATED FILE - DO NOT EDIT. Built by tools/sky_tex_prep.js from
// assets/hangar_sky/ (Poly Haven CC0 HDRIs, tone-mapped and MEASURED by
// tools/sky_prep.py). One row per time of day: the picture the door looks out
// at, and the light rig read off that picture's own HDR — where the sun is,
// what colour it is, how directional it is. hangar.js's moods ARE these rows.
//
// \`img()\` decodes on demand and the cache holds ONE: five 4k equirects
// decoded at once is ~170 MB of bitmap for four skies nobody is looking at.
const HANGAR_SKIES = (() => {
  const rows = [
${rows}  ];
  if (typeof Image === 'undefined') return rows;   // headless: the data still reads
  let liveKey = null, live = null;
  for (const r of rows) r.img = () => {
    if (liveKey === r.key) return live;
    liveKey = r.key;
    live = new Image();
    live.src = r.src;
    return live;
  };
  return rows;
})();
`;
fs.writeFileSync(OUT, body);
console.log(`src/viewer/hangar_sky.js (${(body.length / 1048576).toFixed(1)} MB) — ` +
  report.join(', '));
