#!/usr/bin/env node
// GATE REALREFS (REAL-FIGURES made perennial, 12 Nov 2026): a reference figure says what it is, at which conditions, and
// where it comes from - or it does not go in. Lints tools/real_refs.js REFS (the real parents' figures) and PLANES.
// Pure node, ~0.1 s.
//
// THE ROW (REFS[k].rows[ind]): ind is an indicator the report scores (INDICATORS); v a positive number or [lo, hi]; tol
//   in (0, 0.5]; src says what the figure is in the source's words. Its CONDITIONS, stated even when unknown:
//     kg       every performance row: a mass (kg), [lo, hi], 'gross' or 'unknown' (brochures quote solo with half fuel)
//     flaps    the stall and every distance: degrees, 'up', or 'unknown'
//     surface  every distance: 'paved' | 'grass' | 'water' | 'unknown' (a water row: 'water')
//   a second figure of the same indicator (roc2, TOW2) names it in `key`.
// THE TRAIL (FIT_AND_VALIDATE.md section 2): a reference made from 12 Nov on carries
//   variant  the exact type, variant and engine ('Super Petrel LS, Rotax 912iS'; not the XP, not the 914)
//   sources  { id: { what, quality, read: 'YYYY-MM-DD', url | noUrl: '<why: a paper manual...>' } }, quality one of QUALITY
//   and every row `from: '<id>'` (or [id, id] when a second source agrees). real_report grades the row's confidence by its
//   sources' quality (else it guesses from the src text).
//   The 14 references made before carry no trail: they are LEGACY, listed by name below, and printed as a note until
//   each is sourced (then take it off the list). A reference not on the list without its trail is red.
// THE PLANES: every row names a reference that exists, a build file that exists (a branch: row on its branch), and a
//   supersededBy that names a PLANES row.
//
//   node tools/_realrefs_lint.js [--selftest]   -> "GATE REALREFS: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const SELF = process.argv.includes('--selftest');

const INDICATORS = ['empty', 'Vs1', 'V75', 'Vmax', 'roc', 'roc2', 'LD', 'TO', 'TO50', 'LDG', 'LDG50', 'TOW', 'TOW2', 'TOWs', 'TOW50'];
const DIST = /^(TO|TO50|LDG|LDG50|TOW|TOW2|TOWs|TOW50)$/, WATER = /^TOW/;
const QUALITY = { poh: 'the handbook / flight manual or its chart', maker: 'the maker\'s sheet or site', typeSheet: 'a type certificate data sheet',
                  review: 'a flight test in a magazine', encyclopedia: 'Wikipedia and the like', ruling: 'the user\'s ruling', thin: 'one weak source' };
// the references made before the trail (12 Nov 2026): take a key off as its sources are written
const LEGACY = ['cub', 'd112', 'c172r', 'c172f', 'pa18f', 'petrel', 'chinook', 'dc3', 'ruckus', 'camel', 'tigermoth', 'stearman', 'skymaster', 'carboncub'];

const isPos = x => typeof x === 'number' && isFinite(x) && x > 0;
function lintRefs(REFS, PLANES, exists) {
  const bad = [], legacy = [];
  for (const [k, R] of Object.entries(REFS)) {
    const at = 'REFS.' + k;
    for (const f of ['name', 'mtow', 'empty', 'rows', 'dims', 'specs', 'poh']) if (R[f] == null) bad.push(at + ': no ' + f);
    if (R.specs && !R.specs.engine) bad.push(at + '.specs: no engine');
    const sourced = R.sources && typeof R.sources === 'object';
    if (!sourced) { if (LEGACY.includes(k)) legacy.push(k); else bad.push(at + ': no trail (variant, sources, each row\'s from) - a new reference must carry it'); }
    if (sourced) {
      if (!R.variant) bad.push(at + ': no variant (the exact type, variant and engine)');
      for (const [id, s] of Object.entries(R.sources)) {
        const sa = at + '.sources.' + id;
        if (!s || !s.what) bad.push(sa + ': no what');
        if (!s || !QUALITY[s.quality]) bad.push(sa + ': quality ' + (s && s.quality) + ' (one of ' + Object.keys(QUALITY).join(', ') + ')');
        if (!s || !/^\d{4}-\d\d-\d\d$/.test(s.read || '')) bad.push(sa + ': read ' + (s && s.read) + ' (the date it was read, YYYY-MM-DD)');
        if (!s || (!/^https?:\/\//.test(s.url || '') && !s.noUrl)) bad.push(sa + ': no url (or noUrl: why)');
      }
    }
    for (const [ind, r] of Object.entries(R.rows || {})) {
      const ra = at + '.rows.' + ind;
      if (!INDICATORS.includes(ind)) { bad.push(ra + ': not an indicator the report scores'); continue; }
      const v = r.v;
      if (!(isPos(v) || (Array.isArray(v) && v.length === 2 && isPos(v[0]) && isPos(v[1]) && v[0] <= v[1]))) bad.push(ra + ': v ' + JSON.stringify(v));
      if (!(typeof r.tol === 'number' && r.tol > 0 && r.tol <= 0.5)) bad.push(ra + ': tol ' + r.tol);
      if (!r.src || typeof r.src !== 'string') bad.push(ra + ': no src');
      if (/2$/.test(ind) && !INDICATORS.includes(r.key)) bad.push(ra + ': a second figure names its indicator in key');
      const ind0 = r.key || ind;
      if (ind0 !== 'empty') {
        const kg = r.kg;
        if (!(isPos(kg) || kg === 'gross' || kg === 'unknown' || (Array.isArray(kg) && kg.length === 2 && isPos(kg[0]) && kg[0] <= kg[1]))) bad.push(ra + ': kg ' + JSON.stringify(kg) + ' (a mass, [lo, hi], gross or unknown)');
        else if (isPos(kg) && R.mtow && (kg > 1.25 * R.mtow || kg < 0.4 * R.mtow)) bad.push(ra + ': kg ' + kg + ' far from the type\'s gross ' + R.mtow);
      }
      if (ind0 === 'Vs1' || DIST.test(ind0)) {
        const fl = r.flaps;
        if (!((typeof fl === 'number' && fl >= 0 && fl <= 60) || fl === 'up' || fl === 'unknown')) bad.push(ra + ': flaps ' + JSON.stringify(fl) + ' (degrees, up or unknown)');
      }
      if (DIST.test(ind0)) {
        if (!['paved', 'grass', 'water', 'unknown'].includes(r.surface)) bad.push(ra + ': surface ' + JSON.stringify(r.surface));
        else if (WATER.test(ind0) !== (r.surface === 'water')) bad.push(ra + ': surface ' + r.surface + ' on a ' + (WATER.test(ind0) ? 'water' : 'land') + ' figure');
      }
      if (sourced) {
        const fr = [].concat(r.from || []);
        if (!fr.length) bad.push(ra + ': no from (the source id)');
        for (const id of fr) if (!R.sources[id]) bad.push(ra + ': from ' + id + ' names no source');
      }
    }
  }
  for (const [k, P] of Object.entries(PLANES)) {
    const at = 'PLANES.' + k;
    if (!REFS[P.ref]) bad.push(at + ': ref ' + P.ref + ' is no REFS row');
    if (P.supersededBy && !PLANES[P.supersededBy]) bad.push(at + ': supersededBy ' + P.supersededBy + ' is no PLANES row');
    if (P.file && !exists(P.file, P.branch)) bad.push(at + ': ' + P.file + ' not found' + (P.branch ? ' on ' + P.branch : ''));
    if (!P.file && !P.card) bad.push(at + ': neither a file nor a card');
  }
  return { bad, legacy };
}

const prefix = (() => { try { return cp.execSync('git rev-parse --show-prefix', { cwd: ROOT }).toString().trim(); } catch (e) { return ''; } })();
const exists = (f, branch) => fs.existsSync(path.join(ROOT, f)) ||
  (!!branch && (() => { try { cp.execSync('git cat-file -e origin/' + branch + ':' + prefix + f, { cwd: ROOT, stdio: 'ignore' }); return true; } catch (e) { return false; } })());
const { REFS, PLANES } = require(path.join(T, 'real_refs.js'));
const { bad, legacy } = lintRefs(REFS, PLANES, exists);
if (SELF) {
  const cl = o => JSON.parse(JSON.stringify(o)), k0 = 'cub';
  const base = new Set(lintRefs(REFS, PLANES, () => true).bad);
  const red = (name, R, P) => { const r = lintRefs(R, P || PLANES, () => true).bad.filter(x => !base.has(x)); if (!r.length) bad.push('selftest: not red on ' + name); else console.log('  selftest red on ' + name + ': ' + r[0]); };
  let R = cl(REFS); delete R[k0].rows.TO.surface; red('a take-off roll with no surface', R);
  R = cl(REFS); delete R[k0].rows.Vs1.flaps; red('a stall with no flaps', R);
  R = cl(REFS); delete R[k0].rows.roc.kg; red('a climb with no weight', R);
  R = cl(REFS); R[k0].rows.roc.tol = 0; red('a zero tolerance', R);
  R = cl(REFS); R[k0].rows.TO.surface = 'water'; red('a land roll on water', R);
  R = cl(REFS); R.newtype = cl(REFS[k0]); red('a new reference with no trail', R);
  R = cl(REFS); R.newtype = Object.assign(cl(REFS[k0]), { variant: 'J-3C-65', sources: { poh: { what: 'POH', quality: 'poh', read: '2026-11-12', noUrl: 'paper' } } });
  red('a sourced reference whose rows name no source', R);
  for (const id of Object.keys(R.newtype.rows)) R.newtype.rows[id].from = 'poh';
  const extra = lintRefs(R, PLANES, () => true).bad.filter(x => !base.has(x) && !/^REFS\.newtype\.rows\.\w+: (flaps|surface|kg|v|tol)/.test(x));
  if (extra.length) bad.push('selftest: red on a complete sourced reference: ' + extra[0]);
  R.newtype.sources.poh.quality = 'forum'; red('a source of unknown quality', R);
  red('a plane on a missing reference', REFS, Object.assign(cl(PLANES), { x: { file: 'a.json', ref: 'nope' } }));
}
if (legacy.length) console.log('  note: ' + legacy.length + ' references still without their trail (url, date read, quality per source): ' + legacy.join(' '));
for (const b of bad) console.log('  FAIL ' + b);
console.log('GATE REALREFS: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
module.exports = { lintRefs, QUALITY, INDICATORS };
