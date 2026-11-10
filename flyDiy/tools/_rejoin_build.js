// _rejoin_build.js (G461) — RE-JOIN A SAVED BUILD through the page's own chain
// with an edit set applied to its CAGE dials (and the spec rows the join does
// not own): the recipe every corrected study build was made with (C172 §4,
// the Cub, the Jodel, the Chinook).
//
//   node tools/_rejoin_build.js in.json out.json [edits.json]
//
// edits.json: { cage: { dial: value, ... }, enginePreset: <index in the
// engine layer's list>, engines, energy, fuel, prop, wings, meta } — each
// optional. The cage dials are overwritten, the preset applied through
// CAGE_ENG_APPLY_PRESET, the rest assigned, then tools/_bake_joined.js
// re-measures the whole aeroplane (bench/-free). Prints the leaves that
// changed against the input, and writes out.json as a flydiy-build file.
const fs = require('fs'), path = require('path');
const T = path.resolve('tools');
const BJ = require(path.join(T, '_bake_joined.js'));
const { C } = BJ.loadPanel();
const [inFile, outFile, editsFile] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const spec = JSON.parse(JSON.stringify(raw.spec));
if (editsFile) {
  const E = JSON.parse(fs.readFileSync(editsFile, 'utf8'));
  for (const k in E.cage || {}) spec.cage[k] = E.cage[k];
  if (E.enginePreset) {
    const keep = E.cage && E.cage.engPreset;
    const full = Object.assign(BJ.loadPanel().W.CAGE2.cageDefaults(), spec.cage);
    const W = BJ.loadPanel().W;
    if (!W.CAGE_ENG_APPLY_PRESET) throw new Error('no CAGE_ENG_APPLY_PRESET');
    W.CAGE_ENG_APPLY_PRESET(full, E.enginePreset);
    for (const k of Object.keys(full)) if (/^eng/.test(k)) spec.cage[k] = full[k];
    if (keep != null) spec.cage.engPreset = keep;
    console.log('engine preset applied:', E.enginePreset, 'engPreset', spec.cage.engPreset);
  }
  if (E.engines) spec.engines = E.engines;
  if (E.energy) spec.energy = E.energy;
  if (E.fuel) spec.fuel = E.fuel;
  if (E.prop) Object.assign(spec.prop, E.prop);
  if (E.wings) Object.assign(spec.wings[0], E.wings);
  if (E.meta) Object.assign(spec.meta, E.meta);
}
const r = BJ.bakeJoined(spec);
console.log('join ms', r.ms, 'errors', r.errors, 'sceneErrors', r.sceneErrors && r.sceneErrors.length);
const J = r.spec;
// diff against the input spec (top-level keys and cage/wings/gear/tail/cabin/fuselage leaves)
function leaves(o, pre, out) { for (const k in o) { const v = o[k]; const p = pre ? pre + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, p, out); else out[p] = JSON.stringify(v); } return out; }
const A = leaves(raw.spec, '', {}), B = leaves(J, '', {});
let n = 0; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) { if (A[k] !== B[k]) { n++; if (n <= 60) console.log('  ', k, A[k] && A[k].slice(0, 60), '->', B[k] && B[k].slice(0, 60)); } }
console.log('leaves differing', n);
if (outFile) fs.writeFileSync(outFile, JSON.stringify(Object.assign({}, raw, { spec: J, name: (E => E)(raw.name) })));
