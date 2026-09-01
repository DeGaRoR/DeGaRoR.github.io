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
// EXTERNALIZED 2026-09-01: base.jpg and gain.png land as real files under
// media/tex/sky/ and HANGAR_SKY_GRADE carries their URLs — the rows and the
// GLSL stay inline (they are numbers and code, not pictures).
//
// Run after `python tools/sky_prep.py`: node tools/sky_tex_prep.js
// The output is committed, like the model payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');
const SUB = 'tex/sky';

const ROOT = path.join(__dirname, '..');
// THE PAYLOAD IS ONE PICTURE AND A TABLE OF UNIFORMS. A row carries no image
// of its own: the fragment shader makes that hour out of the single base
// panorama plus the gain map that restores the range its JPEG clipped. See
// tools/sky_grade.py, which holds both halves of the grade.
const SRC = path.join(ROOT, 'assets', 'hangar_sky');
const OUT = path.join(ROOT, 'src', 'viewer', 'hangar_sky.js');

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'skies.json'), 'utf8'));

// the fields the room actually runs on. Everything else in skies.json is the
// working — kept there so the numbers can be argued with, not shipped.
//
// The key light's intensity ships as `keyI`, not `key`: `key` is the row's own
// identifier, and an object literal carrying the same name twice keeps only the
// last one — which silently cost every row its identity the first time round.
const bake = (f, ext) => writeMedia(SUB, f.replace(/\.(jpg|png)$/, ''), ext,
  fs.readFileSync(path.join(SRC, f)));
const num = n => (Array.isArray(n) ? `[${n.map(x => +x.toFixed(6)).join(', ')}]`
                                   : String(+Number(n).toFixed(6)));
const NL = '\n';

let rows = '', report = [];
for (const s of manifest.skies) {
  rows += `    { key: '${s.key}', name: '${s.name}',` + NL +
    `      // measured off ${s.src}: sun ` +
    `${s.measured.direct >= 0.5 ? 'hard' : 'diffuse'} ` +
    `(direct ${s.measured.direct}), level ${s.measured.level}` + NL +
    `      sunUV: [${s.sunUV[0]}, ${s.sunUV[1]}], hasSun: ${s.hasSun},` + NL +
    `      yaw: ${s.yaw},   // sun ${s.sunOff}° off the door axis` + NL +
    `      keyI: ${s.keyI}, kc: ${s.kc}, hemi: ${s.hemi}, top: ${s.top},` + NL +
    `      hemiSky: ${s.skyColor}, hemiGnd: ${s.gndColor},` + NL +
    `      env: ${s.env}, lamp: ${s.lamp}, ex: ${s.ex},` + NL +
    `      bg: ${s.bg}, card: ${s.card}, panel: ${s.panel}, shaft: ${s.shaft},` + NL +
    // Both shapes were shipped side by side while the two were compared
    // (5.30 vs 5.27 ms/frame, whole-frame difference 0.09/255). The precomputed
    // half is retired with the panoramas that fed it.
    `      u: { ${Object.keys(s.u).map(k => `${k}: ${num(s.u[k])}`).join(', ')} } },` + NL;
  report.push(s.key);
}

// THE ONE PICTURE (lab only): the base panorama, the per-channel gain map that
// carries the range its JPEG clipped, and the GLSL that turns the two back into
// radiance and grades it. All three written by `python tools/sky_prep.py --lab`.
const baseRel = bake('base.jpg', 'jpg');
const gainRel = bake('gain.png', 'png');
const runtime = `
// ---- the runtime grade: ONE panorama, every hour --------------------------
// base.jpg is the alps display equirect. gain.png is log2(radiance /
// display-linear) PER CHANNEL over ${manifest.gmax.toFixed(1)} stops — zero
// everywhere the base did not clip, which is why it costs a tenth of a
// megabyte and not eight. Together they put the float radiance back in front
// of the shader, and every row above is then a set of uniforms, not a picture.
// The two files live under media/tex/sky/ (hash-in-filename); gradeTextures
// hands their URLs straight to new Image(), exactly as it did the data URIs.
const HANGAR_SKY_GRADE = (() => {
  ${BASE_DECL}
  return {
    k: ${manifest.baseExposure}, gmax: ${manifest.gmax}, peak: ${manifest.basePeak},
    glsl: ${JSON.stringify(fs.readFileSync(path.join(SRC, '_grade.glsl'), 'utf8'))},
    base: B + '${baseRel}',
    gain: B + '${gainRel}',
  };
})();
`;

const head = `// GENERATED FILE - DO NOT EDIT. Built by tools/sky_tex_prep.js
// from assets/hangar_sky/ — ONE panorama (${manifest.source}) graded into
// ${manifest.skies.length} hours by tools/sky_grade.py, each measured exactly as a
// delivered sky would be. The four Kloppenheim panoramas this set replaced
// were retired on 2026-08-29: a whole day out of one picture costs less than
// six baked ones, and a new hour costs a row of uniforms rather than an asset.`;

const body = `${head}
//
// One row per hour: the light rig measured off that hour's own graded
// radiance — where the sun is, what colour it is, how directional it is — and
// the uniforms the fragment shader needs to make its picture. hangar.js's
// moods ARE these rows.
const HANGAR_SKIES = (() => {
  const rows = [
${rows}  ];
  // no row carries a picture: the shader makes every one of them from the
  // single base panorama below
  return rows;
})();
${runtime}`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, [baseRel, gainRel]);
console.log(path.relative(ROOT, OUT).split(path.sep).join('/') +
  ` (${(body.length / 1024).toFixed(1)} KB) + 2 files in media/${SUB}/ — ` +
  `${report.length} hours from ONE panorama: ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
