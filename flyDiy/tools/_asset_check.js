#!/usr/bin/env node
// GATE ASSETS (G900, AS0a of futureDesigns/ASSETS-2026-09-27.md) - the asset census as a RATCHET.
//
//   node tools/_asset_check.js              -> "GATE ASSETS: PASS|FAIL"
//   node tools/_asset_check.js --selftest   -> + negative verification (each rule broken in turn)
//   node tools/_asset_check.js --baseline   -> prints ALLOW as measured now, to paste below
//
// The census (tools/asset_census.js, G890) measured what the store carries today: 48 FLAT maps
// (a constant shipped as a texture), 32 byte-identical groups (29 under media/, the other three the
// pa18 source/baked pairs), an 8192 px sky pair, 186 normal maps stored as JPEG, and 176
// `new THREE.*Material` sites in 39 files. None of that is fixed
// here - AS0b, AS1, AS3 and AS4 fix it - but nothing may ADD to it. So today's counts are
// ALLOWED, below, and the gate is red only for something NEW:
//
//   FLAT     a map whose every channel's std is under 2 at 256 px (the census's FLAT_STD) is a
//            constant: it belongs in the material record, not in a 21 MiB texture. Counted per
//            DIRECTORY, so a re-bake that moves a hash (same map, new bytes) is not "new".
//            Needs python + Pillow (the bakers' own dependency): without them this one check
//            is SKIPPED with a line, never failed - the other four still run.
//   DUPES    no new byte-identical file under media/: counted per content hash (the copies of
//            one set of bytes). writeMedia / write_media return the existing copy since G901,
//            so a baker cannot make one any more; this is what catches a hand-dropped file.
//   HUGE     no image over 4096 px on a side: WebGL2 guarantees 2048, many GPUs stop at 4096.
//   JPGNOR   no new normal map (by the bakers' names: _nor, _nor_gl, _normal) stored as JPEG:
//            8x8 blocks tear a vector field (media_lib's `normal` role writes WebP q92).
//   MATS     no new `new THREE.*Material` site outside the files that have them today (and not
//            one more in those): materials are to be made in ONE place, src/viewer/matlib.js
//            (AS4a), which is exempt. The list shrinks as AS4 lands.
//   WRITERS  tools/_media_lib.js writeMedia and tools/media_lib.py write_media fold by content
//            (G901): the same bytes under a second stem return the first file, and nothing new
//            is written. Run for real, in a scratch root, every time.
//
// THE RATCHET TURNS ONE WAY. When a count falls (AS0b drops the flat maps, AS2 the ground
// libraries' copies), the gate says so ("can tighten") and stays green; the session that made
// it fall runs --baseline and pastes the smaller ALLOW. Raising an entry is a decision to write
// down in HANDOVER, never a way to get green.
//
// Scope: media/ only (what Pages serves to players). assets/ holds the bake SOURCES, imported as
// they are ([[import-models-as-is]]); the census still reports them.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const census = require('./asset_census.js');

const ROOT = path.join(__dirname, '..');
const HUGE_PX = 4096;
const MATLIB = 'src/viewer/matlib.js';            // the one place a shared material is made (AS4a)

// ---- ALLOW: what the store and the code carry on 2026-09-27 (bd234d3), measured, not chosen; re-taken by G903 (AS0b):
// the 48 flat maps are constants now, the bark aliases and Remy's second diffuse folded ----
const ALLOW = {
  // BEGIN ALLOW (node tools/_asset_check.js --baseline)
  // flat maps per directory: 0 files
  flat: {

  },
  // byte-identical copies under media/ per content hash (sha256, first 16 hex): 0 groups, 0 redundant files
  dupes: {

  },
  // images over 4096 px per directory: 2 files
  huge: {
    "media/tex/sky": 2,
  },
  // JPEG normal maps per directory: 166 files
  jpgNormal: {
    "media/tex/ground": 63,
    "media/tex/house": 25,
    "media/tex/models/c172": 2,
    "media/tex/trees": 75,
    "media/tex/vessel": 1,
  },
  // 'new THREE.*Material' sites per file: 173 in 35 files
  mats: {
    "src/viewer/aa_resolve.js": 1,
    "src/viewer/aeroskin.js": 3,
    "src/viewer/app.js": 12,
    "src/viewer/atmo.js": 5,
    "src/viewer/blueprint.js": 1,
    "src/viewer/cabin.js": 4,
    "src/viewer/clouds.js": 7,
    "src/viewer/cockpit.js": 1,
    "src/viewer/editor.js": 5,
    "src/viewer/flown_bake.js": 2,
    "src/viewer/guardrail.js": 1,
    "src/viewer/hangar.js": 43,
    "src/viewer/house_tarr.js": 2,
    "src/viewer/lot_tex.js": 1,
    "src/viewer/parked.js": 6,
    "src/viewer/pattern_vis.js": 3,
    "src/viewer/pavement.js": 3,
    "src/viewer/plume.js": 1,
    "src/viewer/post_fx.js": 1,
    "src/viewer/powerline.js": 1,
    "src/viewer/refplane.js": 1,
    "src/viewer/render_premises.js": 23,
    "src/viewer/render_world.js": 18,
    "src/viewer/rock_map.js": 2,
    "src/viewer/shader_warm.js": 2,
    "src/viewer/sky_glare.js": 1,
    "src/viewer/spray.js": 2,
    "src/viewer/water.js": 3,
    "src/viewer/workshop.js": 2,
    "tools/_big_gen.js": 1,
    "tools/_gear_gen.js": 3,
    "tools/_hangar_gen.js": 4,
    "tools/_house_gen.js": 4,
    "tools/_totem_gen.js": 3,
    "tools/_tower_gen.js": 1,
  },
  // END ALLOW
};

const fail = [], notes = [];
const check = (ok, msg) => { if (!ok) fail.push(msg); return !!ok; };

// ---- the measurement: the census's rows -> the five counts --------------------------------------
const dirOf = p => path.posix.dirname(p);
const inc = (o, k, n) => { o[k] = (o[k] || 0) + (n || 1); };
function measure(C) {
  const media = C.tex.filter(t => t.path.startsWith('media/'));
  const M = { flat: {}, dupes: {}, huge: {}, jpgNormal: {}, mats: {}, undecoded: [] };
  const decoded = !C.decodeErr;
  for (const t of media) {
    if (Math.max(t.w || 0, t.h || 0) > HUGE_PX) inc(M.huge, dirOf(t.path));
    if (t.role === 'normal' && t.fmt === 'jpg') inc(M.jpgNormal, dirOf(t.path));
    if (!decoded || !/^(jpg|png|webp)$/.test(t.fmt)) continue;
    if (t.std == null) M.undecoded.push(t.path + (t.err ? ' (' + t.err + ')' : ''));
    else if (t.std < census.FLAT_STD) inc(M.flat, dirOf(t.path));
  }
  if (!decoded) M.flat = null;
  // byte-identical copies under media/ (the census groups by the full sha256; rows carry its first 16 hex)
  for (const g of C.exactDupes) {
    const m = g.filter(r => r.path.startsWith('media/'));
    if (m.length > 1) M.dupes[m[0].sha] = m.length;
  }
  for (const r of C.materials) if (r.sites && r.file !== MATLIB) M.mats[r.file] = r.sites;
  return M;
}

// ---- the ratchet: a count over its allowance is a FAIL; under it, a "can tighten" note ----------
const WHY = {
  flat: 'a FLAT map (every channel std < ' + census.FLAT_STD + ' at 256 px): a constant belongs in the material record',
  dupes: 'a byte-identical copy of a file already in media/: writeMedia / write_media return the existing one',
  huge: 'an image over ' + HUGE_PX + ' px: WebGL2 guarantees 2048, many GPUs stop at 4096',
  jpgNormal: 'a normal map stored as JPEG: media_lib\'s `normal` role writes WebP',
  mats: 'a `new THREE.*Material` site: materials are made in ' + MATLIB + ' (AS4a)',
};
function ratchet(M, A) {
  for (const k of ['flat', 'dupes', 'huge', 'jpgNormal', 'mats']) {
    if (M[k] == null) continue;
    const allow = A[k] || {};
    for (const [key, n] of Object.entries(M[k])) {
      const a = allow[key] || 0;
      check(n <= a, `${k}: ${key} has ${n} (allowed ${a}) - ${WHY[k]}`);
    }
    const slack = Object.entries(allow).filter(([key, a]) => (M[k][key] || 0) < a).map(([key, a]) => `${key} ${M[k][key] || 0}/${a}`);
    if (slack.length) notes.push(`${k} can tighten (run --baseline): ${slack.slice(0, 6).join(', ')}${slack.length > 6 ? ' ... +' + (slack.length - 6) : ''}`);
  }
  if (M.undecoded) check(!M.undecoded.length, `${M.undecoded.length} image(s) under media/ that PIL cannot open: ${M.undecoded.slice(0, 4).join(', ')}`);
}

// ---- WRITERS: the two media writers fold by content, run for real in a scratch root -------------
// A copy of each writer under <tmp>/tools/ has <tmp> as its ROOT, so nothing touches media/.
// `jsWriter` / `pyWriter` are injectable so the selftest can hand in a writer that does not fold.
function scratchRoot() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy_assets_'));
  fs.mkdirSync(path.join(d, 'tools'));
  for (const f of ['_media_lib.js', 'media_lib.py']) fs.copyFileSync(path.join(__dirname, f), path.join(d, 'tools', f));
  return d;
}
const PY_FOLD = String.raw`
import sys, json
sys.path.insert(0, sys.argv[1])
from media_lib import write_media, prune_media
a = write_media('tex/fold', 'bark_a', 'jpg', b'SAME-BYTES')
b = write_media('tex/fold', 'bark_b', 'jpg', b'SAME-BYTES')
c = write_media('tex/fold', 'bark_c', 'jpg', b'OTHER-BYTES')
gone = prune_media('tex/fold', [a, b, c])
print(json.dumps([a, b, c, gone]))
`;
function foldCase(write, prune, listDir) {
  const a = write('tex/fold', 'bark_a', 'jpg', Buffer.from('SAME-BYTES'));
  const b = write('tex/fold', 'bark_b', 'jpg', Buffer.from('SAME-BYTES'));
  const c = write('tex/fold', 'bark_c', 'jpg', Buffer.from('OTHER-BYTES'));
  const gone = prune('tex/fold', [a, b, c]);
  return [a, b, c, gone, listDir()];
}
// the verdict on one writer's run: [a, b, c, pruned, files left]
function foldVerdict(who, r) {
  if (!r) return check(false, `${who}: the fold probe did not run`);
  const [a, b, c, gone, left] = r;
  return check(a === b && c !== a && !gone.length && left.length === 2,
    `${who} does not fold by content: bark_a -> ${a}, bark_b (same bytes) -> ${b}, bark_c -> ${c}, ` +
    `pruned [${gone}], left [${left}] - the same bytes must come back as the first file, one copy on disk`);
}
function checkWriters(jsWriter, pyWriter) {
  const d = scratchRoot();
  const listDir = () => { const p = path.join(d, 'media', 'tex', 'fold'); return fs.existsSync(p) ? fs.readdirSync(p).sort() : []; };
  try {
    const L = jsWriter ? jsWriter(d) : require(path.join(d, 'tools', '_media_lib.js'));
    const jsOk = foldVerdict('tools/_media_lib.js writeMedia', foldCase(L.writeMedia, L.pruneMedia, listDir));
    fs.rmSync(path.join(d, 'media'), { recursive: true, force: true });
    let py = null;
    const bin = ['python3', 'python'].find(p => spawnSync(p, ['-c', 'import hashlib'], { encoding: 'utf8' }).status === 0);
    if (!bin) { notes.push('WRITERS: no python - media_lib.py write_media not probed'); return { js: jsOk, py: null }; }
    const r = pyWriter ? pyWriter(d) : spawnSync(bin, ['-c', PY_FOLD, path.join(d, 'tools')], { encoding: 'utf8' });
    if (r.status === 0) { const j = JSON.parse(r.stdout.trim().split('\n').pop()); py = foldVerdict('tools/media_lib.py write_media', j.concat([listDir()])); }
    else check(false, 'tools/media_lib.py: the fold probe failed: ' + (r.stderr || '').slice(0, 300));
    return { js: jsOk, py };
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

// ---- the run --------------------------------------------------------------------------------------
const t0 = Date.now();
const C = census.staticCensus({ decode: true, gz: false, payloads: false, biomes: false, houses: false, world: false });
if (C.decodeErr && !C.decodeNoPIL) check(false, 'the decode pass failed: ' + C.decodeErr);
const M = measure(C);
const tot = o => o ? Object.values(o).reduce((s, n) => s + n, 0) : 0;
const dupExtra = o => Object.values(o).reduce((s, n) => s + n - 1, 0);

if (process.argv.includes('--baseline')) {
  const lit = (o, ind) => '{\n' + Object.keys(o).sort().map(k => `${ind}  ${JSON.stringify(k)}: ${o[k]},`).join('\n') + `\n${ind}}`;
  if (!M.flat) { console.log('--baseline needs python + Pillow (the flat maps are counted by decoding)'); process.exit(1); }
  console.log(`  // BEGIN ALLOW (node tools/_asset_check.js --baseline)`);
  console.log(`  // flat maps per directory: ${tot(M.flat)} files`);
  console.log(`  flat: ${lit(M.flat, '  ')},`);
  console.log(`  // byte-identical copies under media/ per content hash (sha256, first 16 hex): ${Object.keys(M.dupes).length} groups, ${dupExtra(M.dupes)} redundant files`);
  console.log(`  dupes: ${lit(M.dupes, '  ')},`);
  console.log(`  // images over ${HUGE_PX} px per directory: ${tot(M.huge)} files`);
  console.log(`  huge: ${lit(M.huge, '  ')},`);
  console.log(`  // JPEG normal maps per directory: ${tot(M.jpgNormal)} files`);
  console.log(`  jpgNormal: ${lit(M.jpgNormal, '  ')},`);
  console.log(`  // 'new THREE.*Material' sites per file: ${tot(M.mats)} in ${Object.keys(M.mats).length} files`);
  console.log(`  mats: ${lit(M.mats, '  ')},`);
  console.log(`  // END ALLOW`);
  process.exit(0);
}

ratchet(M, ALLOW);
const W = checkWriters();

// ---- negative verification ------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  console.log('  --selftest: breaking each rule in turn');
  const clone = () => JSON.parse(JSON.stringify(C));
  const probe = mutate => {                    // a census with one thing added: caught iff the ratchet fails
    const before = fail.length, nb = notes.length;
    const X = clone(); mutate(X);
    ratchet(measure(X), ALLOW);
    const caught = fail.length > before;
    fail.length = before; notes.length = nb;
    return caught;
  };
  // the rows the cases add are built from HEADERS, so every case but the flat ones runs without PIL
  const liveRow = C.tex.find(t => t.path.startsWith('media/') && t.fmt === 'jpg' && t.role === 'color' && (t.std == null || t.std > 10));
  const flatRow = C.tex.find(t => t.path.startsWith('media/') && t.std != null && t.std < census.FLAT_STD) || Object.assign({}, liveRow, { std: 0.4 });
  const dupes = C.exactDupes.find(g => g.filter(r => r.path.startsWith('media/')).length > 1);
  const single = C.tex.find(t => t.path.startsWith('media/') && !C.exactDupes.some(g => g.includes(t)));
  const matFile = C.materials.find(r => r.sites > 0);
  const jpg = liveRow && fs.readFileSync(path.join(ROOT, liveRow.path));
  // a PNG of w x h, grey level f(x, y): what a baker could drop in, decoded by the census's own pass
  // (PIL checks every chunk's CRC; zlib.crc32 is node >= 20.15 only, so the table is here)
  const crc32 = buf => { let c = ~0; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const png = (w, h, f) => {
    const raw = Buffer.alloc((w + 1) * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = f(x, y);
    const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8);
      b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length); return b; };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy_assetself_'));
  const decodeOne = (name, buf) => { const p = path.join(tmp, name); fs.writeFileSync(p, buf); const d = census.decodePass([p]); return d.data ? d.data[p] : null; };
  const hasPIL = !C.decodeNoPIL;
  const needsPIL = run => () => { if (!hasPIL) { console.log('    (skipped: no python + Pillow - the flat check itself is skipped here)'); return true; } return run(); };
  const cases = [
    ['the store as it is passes (the allowance is today\'s)', () => probe(() => {}) === false],
    ['a new FLAT map in a new directory', needsPIL(() => probe(X => X.tex.push(Object.assign({}, flatRow, { path: 'media/tex/selftest/flat.00000000.png' }))))],
    ['one flat map more in a directory that has some', needsPIL(() => probe(X => X.tex.push(Object.assign({}, flatRow, { path: dirOf(flatRow.path) + '/another.00000000.' + flatRow.fmt }))))],
    ['PIL decodes a constant PNG as FLAT and a textured one as not (the threshold is live)', needsPIL(() => {
      const f = decodeOne('flat.png', png(64, 64, () => 128)), n = decodeOne('noise.png', png(64, 64, (x, y) => (x * 37 + y * 91) & 255));
      return f && n && f.std < census.FLAT_STD && n.std >= census.FLAT_STD; })],
    ['without PIL the flat check is SKIPPED, never failed, and the others still run', () => {
      const before = fail.length, nb = notes.length;
      const X = clone(); X.decodeErr = 'python with PIL not found'; X.decodeNoPIL = true;
      X.tex.push(Object.assign({}, flatRow, { path: 'media/tex/selftest/flat.00000000.png' }));
      const M0 = measure(X); ratchet(M0, ALLOW); const quiet = fail.length === before && M0.flat === null;
      X.tex.push(Object.assign({}, liveRow, { path: 'media/tex/selftest/x_nor_gl.00000000.jpg', role: 'normal' }));
      ratchet(measure(X), ALLOW); const still = fail.length > before;
      fail.length = before; notes.length = nb; return quiet && still; }],
    ['a new byte-identical copy of a single file', () => probe(X => X.exactDupes.push([Object.assign({}, single), Object.assign({}, single, { path: 'media/tex/selftest/copy.' + single.sha.slice(0, 8) + '.' + single.fmt })]))],
    ['one more copy in an allowed duplicate group', () => probe(X => { const g = X.exactDupes.find(g => g.filter(r => r.path.startsWith('media/')).length > 1 && g[0].sha === dupes[0].sha); g.push(Object.assign({}, g[0], { path: 'media/tex/selftest/third.' + g[0].sha.slice(0, 8) + '.jpg' })); })],
    ['an image over 4096 px (a real PNG header, read by the census)', () => {
      const ii = census.imageInfo(png(8192, 2, () => 0));
      return ii.w === 8192 && probe(X => X.tex.push(Object.assign({ path: 'media/tex/selftest/sky.00000000.png', role: 'color', std: 40 }, ii))); }],
    ['a new JPEG normal map (a real JPEG, named as the bakers name normals)', () => {
      const name = 'wall_nor_gl_1k.00000000.jpg', ii = census.imageInfo(jpg);
      return census.roleOf(name) === 'normal' && ii.fmt === 'jpg' &&
        probe(X => X.tex.push(Object.assign({ path: 'media/tex/selftest/' + name, role: census.roleOf(name), std: 30 }, ii))); }],
    ['a new material site in a new file (the census\'s own pattern)', () => {
      const n = ('const m = new THREE.MeshStandardMaterial({}); const g = new THREE.ShaderMaterial({});'.match(census.MAT_RE) || []).length;
      return n === 2 && probe(X => X.materials.push({ file: 'src/viewer/selftest.js', sites: n, kinds: {} })); }],
    ['one material site more in an allowed file', () => probe(X => { X.materials.find(r => r.file === matFile.file).sites++; })],
    ['... but not in matlib.js (the one place materials are made)', () => probe(X => X.materials.push({ file: MATLIB, sites: 12, kinds: {} })) === false],
    ['a media writer that does not fold by content', () => {
      const before = fail.length, nb = notes.length;
      const naive = d => { const L = require(path.join(d, 'tools', '_media_lib.js')); const crypto = require('crypto');
        return { pruneMedia: L.pruneMedia, writeMedia: (sub, stem, ext, buf) => { const rel = `media/${sub}/${stem}.${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8)}.${ext}`;
          const abs = path.join(d, ...rel.split('/')); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, buf); return rel; } }; };
      const pyNaive = d => spawnSync(['python3', 'python'].find(p => spawnSync(p, ['-c', '1']).status === 0), ['-c',
        PY_FOLD.replace('from media_lib import write_media, prune_media', 'from media_lib import prune_media\nimport media_lib\ndef write_media(s, st, e, r):\n    media_lib._same_bytes = lambda *a: None\n    return media_lib.write_media(s, st, e, r)'),
        path.join(d, 'tools')], { encoding: 'utf8' });
      const r = checkWriters(naive, pyNaive);
      const caught = r.js === false && (r.py === false || r.py === null) && fail.length >= before + (r.py === null ? 1 : 2);
      fail.length = before; notes.length = nb; return caught; }],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    let ok = false;
    try { ok = !!run(); } catch (e) { console.log('    ' + e.message); ok = false; }
    console.log(`  selftest ${ok ? 'caught  ' : 'MISSED  '}${name}`);
    if (!ok) bad++;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  check(bad === 0, `${bad} rule(s) cannot be broken - those checks are inert`);
}

// ---- the report -----------------------------------------------------------------------------------
const media = C.tex.filter(t => t.path.startsWith('media/'));
console.log(`  ${media.length} images under media/ (${C.tex.length - media.length} in assets/, not gated), census ${C.ms} ms`);
console.log(`  FLAT      ${M.flat ? tot(M.flat) + ' (allowed ' + tot(ALLOW.flat) + ')' : 'SKIPPED - ' + (C.decodeErr || '').split(':')[0] + ' (the other checks ran)'}`);
console.log(`  DUPES     ${Object.keys(M.dupes).length} groups, ${dupExtra(M.dupes)} redundant files (allowed ${Object.keys(ALLOW.dupes || {}).length} / ${dupExtra(ALLOW.dupes || {})})`);
console.log(`  HUGE      ${tot(M.huge)} over ${HUGE_PX} px (allowed ${tot(ALLOW.huge)})`);
console.log(`  JPGNOR    ${tot(M.jpgNormal)} JPEG normal maps (allowed ${tot(ALLOW.jpgNormal)})`);
console.log(`  MATS      ${tot(M.mats)} 'new THREE.*Material' sites in ${Object.keys(M.mats).length} files (allowed ${tot(ALLOW.mats)} in ${Object.keys(ALLOW.mats || {}).length})`);
console.log(`  WRITERS   writeMedia ${W.js ? 'folds' : 'DOES NOT fold'}; write_media ${W.py === null ? 'not probed (no python)' : W.py ? 'folds' : 'DOES NOT fold'}`);
for (const n of notes) console.log('  note: ' + n);
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE ASSETS: FAIL');
  process.exit(1);
}
console.log('GATE ASSETS: PASS');
