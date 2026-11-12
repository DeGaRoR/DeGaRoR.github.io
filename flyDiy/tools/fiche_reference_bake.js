#!/usr/bin/env node
// fiche_reference_bake.js - PHYSICS-PAGES: THE REFERENCE SECTION'S DATA, BAKED. A plane against the real one it stands
// for, scored as REAL-FIGURES scores it: real_report.js scorePlane on the newest REAL-CHECK result of the plane
// (reports/evidence/REAL-CHECK-*/<key>.json, its .shape.json merged), the verdicts recomputed from the current
// real_refs.js (real_check.js verdicts) - exactly what `node tools/real_report.js` prints.
//
// WHICH PLANES: REAL-FIGURES' latest report's (A0, 12 Nov): every result in the newest REAL-CHECK folder ("every plane's
// final version, re-flown"), plus the ones that report carries over from an earlier run (--also, default the two V2-172
// Cessnas, kept on their 9 Nov run). Keyed by the FILE the plane's list row names (several REAL-FIGURES keys fly one
// file: the report's own key for it wins), so a list row finds its reference whatever list it sits in; the dropped
// planes (the metal Cessna, its floats) are in no report and get none.
//
// FROM WHERE: REAL-FIGURES' tools and evidence, from the checkout given (--from <a flyDiy folder>, default this one): the
// scores must be the report's, on the references of the day it was made.
//
// Written to media/fiches/references.json { v, report, from, byFile: { <file>: <section data> }, alias: { 'list:50': <file> } };
// fiche_physics.js loads it once, and the board's visible(rec) shows the Reference button only where it has data.
//   node tools/fiche_reference_bake.js [--from <flyDiy folder>] [--also c172v2,c172v2f] [--dry]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const HERE = path.join(__dirname, '..'), FROM = path.resolve(opt('from', HERE));
const OUT = path.join(HERE, 'media', 'fiches', 'references.json');
const FICHE_REF_V = 2;
// the list rows the canon names by number (FLAGSHIP's plane canon: the reproduction Cessna is list:50)
const ALIAS = { 'list:50': 'builds/cessna172r_2026-11-08.json' };

function tools(from) {
  const T = path.join(from, 'tools');
  return { RREP: require(path.join(T, 'real_report.js')), RC: require(path.join(T, 'real_check.js')), RR: require(path.join(T, 'real_refs.js')),
           EV: path.join(from, 'reports', 'evidence') };
}
const runs = EV => (fs.existsSync(EV) ? fs.readdirSync(EV).filter(d => /^REAL-CHECK-\d{4}-\d{2}-\d{2}[a-z]?$/.test(d)).sort() : []);
// the newest result of a REAL-FIGURES plane key, its shape merged; null when it has none
function resultOf(key, from) {
  const X = tools(from || HERE);
  let o = null, sh = null, d0 = null;
  for (const d of runs(X.EV)) { const f = path.join(X.EV, d, key + '.json'), s = path.join(X.EV, d, key + '.shape.json');
    if (fs.existsSync(f)) { o = JSON.parse(fs.readFileSync(f, 'utf8')); d0 = d.slice(11, 21); } if (fs.existsSync(s)) sh = JSON.parse(fs.readFileSync(s, 'utf8')); }
  if (!o) return null; if (sh && sh.shape) o.shape = sh.shape;
  try { o.verdicts = X.RC.verdicts(o); } catch (e) {}
  return { o, date: d0 };
}
const titles = str => { const out = []; for (const ch of String(str || '').split(';')) { const t = ch.split(':')[0].replace(/\(perf_study[^)]*\)/g, '').trim(); if (t && t.length > 3 && !out.includes(t)) out.push(t); } return out; };
const num = v => (typeof v === 'number' && isFinite(v)) ? Math.round(v * 1e4) / 1e4 : Array.isArray(v) ? v.map(num) : v;
const rnd = v => (v == null ? null : Math.round(v));
// the section's data: everything the drawing needs, nothing it has to work out
function referenceOf(key, from) {
  const got = resultOf(key, from); if (!got) return null;
  const X = tools(from || HERE), { o } = got, sc = X.RREP.scorePlane(o), ref = X.RR.REFS[o.ref] || {}, AX = ['geometry', 'specs', 'performance'];
  const items = {};
  for (const a of AX) items[a] = (sc.items[a] || []).map(it => ({ k: it.k, src: it.src || null, ours: num(it.ours), ref: num(it.ref),
    e: num(it.signed != null ? it.signed : it.err), score: rnd(it.score) }));
  return { v: FICHE_REF_V, key, file: o.file || null, date: got.date, label: o.label, refName: ref.name || o.refName || '', overall: rnd(sc.overall),
           conf: sc.confBand || null, geometry: rnd(sc.geometry), specs: rnd(sc.specs), performance: rnd(sc.performance), items,
           refs: { performance: titles(ref.src), dimensions: titles(ref.geoSrc) }, engineNote: o.engineNote || null };
}
// the report's planes: the newest run's results, then the carried-over ones
function reportKeys(from, also) {
  const X = tools(from), R = runs(X.EV), last = R[R.length - 1];
  const keys = last ? fs.readdirSync(path.join(X.EV, last)).filter(f => /^[\w]+\.json$/.test(f) && !/\.shape\.json$/.test(f)).map(f => f.slice(0, -5)) : [];
  return { last, keys: keys.concat((also || []).filter(k => !keys.includes(k))) };
}
module.exports = { referenceOf, resultOf, reportKeys, FICHE_REF_V, ALIAS };

if (require.main === module) {
  const also = opt('also', 'c172v2,c172v2f').split(',').filter(Boolean);
  const { last, keys } = reportKeys(FROM, also), byFile = {};
  for (const k of keys) {
    const D = referenceOf(k, FROM);
    if (!D || !D.file) { console.log(k.padEnd(12), 'no result'); continue; }
    if (byFile[D.file]) { console.log(k.padEnd(12), D.file, 'already', byFile[D.file].key); continue; }
    byFile[D.file] = D;
    console.log(k.padEnd(12), D.file.padEnd(50), 'overall', D.overall, '·', D.geometry, D.specs, D.performance, '(' + D.date + ')');
  }
  const doc = { v: FICHE_REF_V, report: last, from: path.relative(HERE, FROM) || '.', byFile, alias: ALIAS };
  if (argv.includes('--dry')) process.exit(0);
  fs.writeFileSync(OUT, JSON.stringify(doc));
  console.log('fiche_reference_bake: ' + Object.keys(byFile).length + ' planes -> ' + path.relative(HERE, OUT) + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
}
