#!/usr/bin/env node
// fiche_reference_bake.js - PHYSICS-PAGES: THE REFERENCE SECTION'S DATA, BAKED. A plane against the real one it stands
// for, scored as REAL-FIGURES scores it: tools/real_report.js scorePlane on the newest REAL-CHECK result of the plane
// (reports/evidence/REAL-CHECK-*/<key>.json, its .shape.json merged), the verdicts recomputed from the current
// real_refs.js (real_check.js verdicts) exactly as the report does. Written beside the plane's fiche pictures:
//   media/fiches/<dir>/reference.json    (fiche_physics.js dataFor reads it; the section draws it)
// Only an official plane whose card IS the file REAL-FIGURES flew gets one (a candidate standing in for it is another
// aeroplane: its score is not this one's).
//   node tools/fiche_reference_bake.js [--dry]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, FLY = path.join(T, '..'), EV = path.join(FLY, 'reports', 'evidence'), OUT = path.join(FLY, 'media', 'fiches');
const RREP = require(path.join(T, 'real_report.js')), RC = require(path.join(T, 'real_check.js')), RR = require(path.join(T, 'real_refs.js'));
const FICHE_REF_V = 1;
const safe = k => k.replace(/[^\w.-]+/g, '_');

// the newest result of a REAL-FIGURES plane key, its shape merged; null when it has none
function resultOf(key) {
  const dirs = fs.existsSync(EV) ? fs.readdirSync(EV).filter(d => /^REAL-CHECK-\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
  let o = null, sh = null, d0 = null;
  for (const d of dirs) { const f = path.join(EV, d, key + '.json'), s = path.join(EV, d, key + '.shape.json');
    if (fs.existsSync(f)) { o = JSON.parse(fs.readFileSync(f, 'utf8')); d0 = d.slice(-10); } if (fs.existsSync(s)) sh = JSON.parse(fs.readFileSync(s, 'utf8')); }
  if (!o) return null; if (sh && sh.shape) o.shape = sh.shape;
  try { o.verdicts = RC.verdicts(o); } catch (e) {}
  return { o, date: d0 };
}
// the sources by their titles (the figures themselves are on the items)
const titles = str => { const out = []; for (const ch of String(str || '').split(';')) { const t = ch.split(':')[0].replace(/\(perf_study[^)]*\)/g, '').trim(); if (t && t.length > 3 && !out.includes(t)) out.push(t); } return out; };
const num = v => (typeof v === 'number' && isFinite(v)) ? Math.round(v * 1e4) / 1e4 : Array.isArray(v) ? v.map(num) : v;
// the section's data: everything the drawing needs, nothing it has to work out
function referenceOf(key) {
  const got = resultOf(key); if (!got) return null;
  const { o } = got, sc = RREP.scorePlane(o), ref = RR.REFS[o.ref] || {}, AX = ['geometry', 'specs', 'performance'];
  const items = {};
  for (const a of AX) items[a] = (sc.items[a] || []).map(it => ({ k: it.k, src: it.src || null, ours: num(it.ours), ref: num(it.ref),
    e: num(it.signed != null ? it.signed : it.err), score: it.score == null ? null : Math.round(it.score) }));
  return { v: FICHE_REF_V, key, date: got.date, label: o.label, refName: ref.name || o.refName || '', overall: sc.overall == null ? null : Math.round(sc.overall),
           conf: sc.confBand || null, geometry: sc.geometry == null ? null : Math.round(sc.geometry), specs: sc.specs == null ? null : Math.round(sc.specs),
           performance: sc.performance == null ? null : Math.round(sc.performance), items,
           refs: { performance: titles(ref.src), dimensions: titles(ref.geoSrc) }, engineNote: o.engineNote || null };
}
module.exports = { referenceOf, resultOf, FICHE_REF_V };

if (require.main === module) {
  const L = JSON.parse(fs.readFileSync(path.join(FLY, 'builds', 'lists', 'plane_lists.json'), 'utf8'));
  const byFile = {}; for (const [k, p] of Object.entries(RR.PLANES)) if (p.file) byFile[p.file] = k;
  let n = 0;
  for (const r of L.planes.filter(p => p.list === 'official' && p.file && p.thumb)) {
    const key = byFile[r.file], D = key ? referenceOf(key) : null, dir = safe(r.thumb);
    if (process.argv.includes('--dry')) { console.log(dir.padEnd(36), key || '-', D ? D.overall + ' (' + D.date + ')' : 'no result'); continue; }
    const f = path.join(OUT, dir, 'reference.json');
    if (!D) { if (fs.existsSync(f)) fs.unlinkSync(f); continue; }
    fs.mkdirSync(path.join(OUT, dir), { recursive: true }); fs.writeFileSync(f, JSON.stringify(D)); n++;
    console.log(dir.padEnd(36), key.padEnd(12), 'overall', D.overall, 'geometry', D.geometry, 'specs', D.specs, 'performance', D.performance, '(' + D.date + ')');
  }
  if (!process.argv.includes('--dry')) console.log('fiche_reference_bake: ' + n + ' planes');
}
