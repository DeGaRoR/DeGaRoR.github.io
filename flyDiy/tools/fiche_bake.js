#!/usr/bin/env node
// fiche_bake.js - PLANE-RENDERS R3: THE OFFICIAL PLANES' FICHES, BAKED (the user, 7 Nov: official planes ship with their fiche, "a
// loading time that not everybody has, at the price of a few pictures. That's acceptable").
//
// The Official list (builds/lists/plane_lists.json, list 'official') drawn by the game's own generator (plane_fiche.js
// PLANE_FICHE.generate, store off) in ONE garage page (tools/plane_shot.js --probe ... --probe-out), each plane loaded by the
// user's door (the fleet's Import), its fiche's pictures handed back as base64 and written to
//   media/fiches/<key>/<view>.webp   + media/fiches/index.json { what: 'flydiy-fiches', fiches: { <list key>: { name, data, pics: { view: file } } } }
// keyed by the list's picture key (design:cub, list:5, cand:<file>, stock:<name>) - the key fiche_board.js and the All planes
// screen ask by. The fiche's name is the list's. A plane that fails keeps its old fiche (nothing pruned after a miss).
//
//   node tools/fiche_bake.js --gpu [--secs 900] [--only <key,key>] [--keep <dir>]   (a box run: one Chrome, the graphics card)
//   node tools/fiche_bake.js --dry                                                  the list and the files, no browser
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const FLY = path.join(__dirname, '..'), OUT = path.join(FLY, 'media', 'fiches');
const argv = process.argv.slice(2), flag = k => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const L = JSON.parse(fs.readFileSync(path.join(FLY, 'builds', 'lists', 'plane_lists.json'), 'utf8'));
const only = opt('only', '') ? opt('only').split(',') : null;
const rows = L.planes.filter(p => p.list === 'official' && p.file && p.thumb && (!only || only.includes(p.thumb)));
const safe = k => k.replace(/[^\w.-]+/g, '_');
if (flag('dry')) { for (const r of rows) console.log(r.thumb.padEnd(40), r.name.padEnd(28), r.file); process.exit(0); }
const keep = opt('keep', null), work = keep || fs.mkdtempSync(path.join(os.tmpdir(), 'fiche_bake_'));
fs.mkdirSync(work, { recursive: true });
// the probe: the plane on the stand, its fiche drawn (no store), its pictures and numbers handed back
const PROBE = `(async () => {
  const P = window.PLANE_FICHE; if (!P) return { error: 'no PLANE_FICHE' };
  try { if (window.NEW_PLANE && NEW_PLANE.isOpen()) NEW_PLANE.close(); } catch (e) {}
  const t0 = performance.now();
  const rec = await P.generate({ name: 'bake', store: false });
  const b64 = b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(b); });
  const files = {}; for (const [k, b] of Object.entries(rec.pics)) files[k] = await b64(b);
  return { ms: Math.round(performance.now() - t0), time: P.lastTime, data: rec.data, files };
})()`;
const probeFile = path.join(work, 'fiche_probe.js'); fs.writeFileSync(probeFile, PROBE);
const builds = rows.map(r => path.join(FLY, r.file));
const secs = +opt('secs', '900');
const args = [path.join(__dirname, 'plane_shot.js'), '--secs', String(secs), '--views', '', '--out', work, '--build', builds.join(','),
              '--probe', probeFile, '--probe-out', '--probe-secs', '300'].concat(flag('gpu') ? ['--gpu'] : []);
console.log('fiche_bake:', rows.length, 'official plane(s) ->', path.relative(FLY, OUT));
const p = spawnSync(process.execPath, args, { cwd: FLY, stdio: 'inherit', timeout: (secs + 60) * 1000 });
// the index: the old one kept for a plane that failed
let index = { what: 'flydiy-fiches', fiches: {} };
try { const o = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')); if (o && o.fiches) index.fiches = o.fiches; } catch (e) {}
let done = 0, kb = 0; const missed = [];
for (const r of rows) {
  const base = path.basename(r.file).replace(/\.json$/i, ''), pf = path.join(work, base + '_probe.json');
  let v = null; try { v = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch (e) {}
  if (!v || v.error || !v.files || !v.files.hero) { missed.push(r.thumb + (v && v.error ? ' (' + String(v.error).slice(0, 80) + ')' : '')); continue; }
  const dir = safe(r.thumb), pics = {};
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const [view, b] of Object.entries(v.files)) { const f = dir + '/' + view + '.webp', buf = Buffer.from(b, 'base64'); fs.writeFileSync(path.join(OUT, f), buf); pics[view] = f; kb += buf.length / 1024; }
  const data = Object.assign({}, v.data, { name: r.name });
  index.fiches[r.thumb] = { name: r.name, data, pics };
  done++;
  console.log('fiche_bake:', r.thumb, r.name, v.ms + ' ms', Object.keys(pics).join(','), 'worst task ' + JSON.stringify(v.time && v.time.worst));
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
console.log('fiche_bake: ' + done + ' of ' + rows.length + ' baked, ' + Math.round(kb) + ' KB' + (missed.length ? '; missed: ' + missed.join(', ') : '') + (p.status ? '; plane_shot exit ' + p.status : ''));
if (!keep) try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) {}
process.exit(done === rows.length ? 0 : 2);
