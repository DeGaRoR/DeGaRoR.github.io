#!/usr/bin/env node
// G3800 THE CARDS' BAKED PICTURES (the user, 2 Nov: "what we need now is mostly a VIGNETTE"): the side profile of every
// aeroplane the game offers without the player having built it - the garage's stock designs and the candidate pool
// (builds/candidates/index.json) - drawn by plane_shot.js's profile view (the page's own renderer, the dark studio, the
// left side orthographic, level on its gear as it stands) at 480 x 240 and written as 240 x 120 webp into
// media/thumbs/, with media/thumbs/index.json { thumbs: { key: file } } - what PLANE_THUMB.get(key) serves. Keys:
// 'stock:<name>' (GARAGE_SPEC.stock()'s names) and 'cand:<file>' (the candidate index's `file`, e.g.
// 'cand:tigermoth_2026-10.json'), and 'design:<id>' (the Market's builds, CONTRACT_DESIGNS' own files with the twin's
// floats patch; not the stock presets, they may not be the same aeroplane). The player's own builds are drawn in the
// page (plane_thumb.js), never here. 'list:<n>' (THUMBS-ROUND3): a row of builds/lists/plane_lists.json that no other door
// reaches, its `over` sections laid as the garage lays them. --keys bakes only the named 'cand:' / 'list:' keys and leaves
// every other picture and index row as it is (--only rewrites the index with what it baked). 'arch:<key>' (PLANE-RENDERS R1): a design
// card's plane as the new-aeroplane card bakes it, for the authored recreations' cards.
//   node tools/thumb_bake.js [--gpu] [--secs 600] [--only stock|cand|design] [--keys <key,key>] [--keep <dir>] [--dry]
// One plane_shot boot (a box run: the GPU lock, a slot). Python 3 + Pillow (webp) does the resize. Exit 0 = every
// candidate and at least one stock design has its picture; a missing Market build is named, the Market's rows keep their glyph.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2), flag = k => argv.includes('--' + k), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(ROOT, 'media', 'thumbs'), VIEW = 'profile/0.9/480x240', SUFFIX = '_profile-0.9-480x240.png';
const only = opt('only', '');
const cands = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'candidates', 'index.json'), 'utf8')).planes.map(p => p.file);
const KEYS = opt('keys', '') ? opt('keys', '').split(',') : null;
const want = k => !KEYS && (!only || only === k);
const designs = vm.runInNewContext('(' + fs.readFileSync(path.join(ROOT, 'src', 'core', '72_contract_data.js'), 'utf8').match(/const CONTRACT_DESIGNS = (\{[\s\S]*?\n\});/)[1] + ')');
const designIds = want('design') ? Object.keys(designs) : [];
const builds = [];
if (want('stock')) builds.push('stock:*');
if (want('cand')) for (const f of cands) builds.push(path.join(ROOT, 'builds', 'candidates', f));
const tmp = opt('keep', null) || fs.mkdtempSync(path.join(os.tmpdir(), 'thumb_bake_'));
fs.mkdirSync(tmp, { recursive: true });
// the Market's builds, last (a run out of time loses these first): each file's spec as procureBaseSpec makes it, the floats patch applied
for (const id of designIds) {
  const D = designs[id], t = JSON.parse(fs.readFileSync(path.join(ROOT, D.build), 'utf8')), s = t.spec || t;
  if (D.patch === 'floats') { s.gear = Object.assign({}, s.gear, { type: 'floats' }); s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); }
  const f = path.join(tmp, 'design_' + id + '.json');
  fs.writeFileSync(f, JSON.stringify({ what: 'flydiy-build', design: id, spec: s }));
  builds.push(f);
}
for (const k of KEYS || []) {
  if (k.startsWith('cand:') && cands.includes(k.slice(5))) builds.push(path.join(ROOT, 'builds', 'candidates', k.slice(5)));
  else if (k.startsWith('list:')) {
    const row = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'lists', 'plane_lists.json'), 'utf8')).planes.find(p => String(p.n) === k.slice(5));
    if (!row || !row.file) { console.log('thumb_bake: no file on the list for ' + k); process.exit(1); }
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, row.file), 'utf8')), s = t.spec || t;
    for (const sec in row.over || {}) s[sec] = Object.assign({}, s[sec], row.over[sec]);
    const f = path.join(tmp, 'list_' + row.n + '.json');
    fs.writeFileSync(f, JSON.stringify({ what: 'flydiy-build', spec: s }));
    builds.push(f);
  } else if (/^arch:./.test(k)) builds.push(k);   // PLANE-RENDERS R1: a design card's plane, baked in the page (plane_shot arch:)
  else { console.log('thumb_bake: --keys takes cand:, list: and arch: keys, not ' + k); process.exit(1); }
}
const args = [path.join(__dirname, 'plane_shot.js'), '--views', VIEW, '--out', tmp, '--secs', opt('secs', '600'), '--build', builds.join(',')];
if (flag('gpu')) args.push('--gpu');
console.log('thumb_bake: ' + builds.length + ' entries (' + (KEYS ? 'keys' : only || 'stock + cand + design') + ') -> ' + tmp);
if (flag('dry')) { console.log('node ' + args.map(a => /[\s,]/.test(a) ? JSON.stringify(a) : a).join(' ')); process.exit(0); }
const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
// what came out: <base>_profile-0.9-480x240.png, base = the candidate's file name, or stock_<slug> for a stock design
// (plane_shot wrote <tmp>/stock_<slug>.json with { stock: <the name> })
const index = { what: 'flydiy-thumbs', v: 1, baked: new Date().toISOString().slice(0, 10), view: VIEW, thumbs: KEYS ? JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')).thumbs : {} };
const jobs = [];
for (const png of fs.readdirSync(tmp).filter(f => f.endsWith(SUFFIX)).sort()) {
  const base = png.slice(0, -SUFFIX.length);
  let key = null, file = null;
  const cand = cands.find(c => c.replace(/\.json$/i, '') === base);
  if (cand) { key = 'cand:' + cand; file = 'cand_' + base.replace(/[^\w.-]+/g, '_') + '.webp'; }
  else if (/^list_\d+$/.test(base)) { key = 'list:' + base.slice(5); file = base + '.webp'; }
  else if (/^design_/.test(base) && designs[base.slice(7)]) { key = 'design:' + base.slice(7); file = base + '.webp'; }
  else if (/^arch_/.test(base)) {
    let k = null; try { k = JSON.parse(fs.readFileSync(path.join(tmp, base + '.json'), 'utf8')).arch; } catch (e) {}
    if (k) { key = 'arch:' + k; file = base + '.webp'; }
  }
  else if (/^stock_/.test(base)) {
    let nm = null; try { nm = JSON.parse(fs.readFileSync(path.join(tmp, base + '.json'), 'utf8')).stock; } catch (e) {}
    if (nm) { key = 'stock:' + nm; file = base + '.webp'; }
  }
  if (!key) { console.log('thumb_bake: not offered, skipped ' + png); continue; }
  jobs.push([path.join(tmp, png), path.join(OUT, file)]);
  index.thumbs[key] = file;
}
fs.mkdirSync(OUT, { recursive: true });
const py = path.join(tmp, '_resize.py'), jf = path.join(tmp, '_jobs.json');
fs.writeFileSync(py, 'import sys, json\nfrom PIL import Image\nfor a, b in json.load(open(sys.argv[1])):\n    Image.open(a).convert("RGB").resize((240, 120), Image.LANCZOS).save(b, "WEBP", quality=86, method=6)\n    print("thumb", b)\n');
fs.writeFileSync(jf, JSON.stringify(jobs));
const p = jobs.length ? spawnSync('python', ['-I', py, jf], { stdio: 'inherit' }) : { status: 1 };
if (p.status === 0) fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
const keys = Object.keys(index.thumbs), gotStock = keys.filter(k => k.startsWith('stock:')).length, gotDesign = keys.filter(k => k.startsWith('design:')).length;
const missing = KEYS ? KEYS.filter(k => !index.thumbs[k]) : want('cand') ? cands.filter(c => !index.thumbs['cand:' + c]) : [], noDesign = designIds.filter(id => !index.thumbs['design:' + id]);
console.log('thumb_bake: ' + gotStock + ' stock + ' + (keys.length - gotStock - gotDesign) + ' candidate + ' + gotDesign + ' market pictures -> ' + OUT +
  (missing.length ? ' | MISSING ' + missing.join(', ') : '') + (noDesign.length ? ' | NO MARKET PICTURE ' + noDesign.join(', ') : '') + ' | plane_shot exit ' + r.status + ', resize exit ' + p.status);
process.exit(r.status === 0 && p.status === 0 && !missing.length && (!want('stock') || gotStock > 0) ? 0 : 1);
