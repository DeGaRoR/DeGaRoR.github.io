#!/usr/bin/env node
// lods_sheet.js - THE LOD COMPARISON SHEET (LODS-2026-10; the user, 27 Oct: "Can we look into LOD generation and do
// something real clean here, with a comparison sheet?").
//
//   node tools/lods_sheet.js [--out reports/evidence/LODS] [--only <substring>] [--no-kit] [--secs 900]
//     -> one PNG per building (its near mesh and every far rung, same cameras; tools/_lods_rig.js draws them) and
//        index.md (the sheets, the numbers: tris, meshes, switch distance, leak, roof, light ratio, black share)
//
// Headless Chromium on SwiftShader (the cloud image's /opt/node-tools Playwright, as tools/soft_still.js), the repo
// served by tools/_serve.js. The meteo station's generator is read off origin/claude/meteo-code when this checkout has
// none (tools/_lods_lib.js meteoSource). The numbers under each column are tools/_lods_lib.js's, measured in node on
// the same rungs. Slow by nature (a software GL) - never read a frame time off it.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const L = require('./_lods_lib.js');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'LODS')));
const ONLY = opt('only', null), CATS_ONLY = opt('cats', null), SECS = +opt('secs', 900), GAIN = opt('gain', null);   // --gain k: the far fifth (HLOD.gain, the city's farGain) at k - a calibration run
const REPO = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
function findPlaywright() { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('lods_sheet: no playwright'); }

// ---- the buildings ------------------------------------------------------------------------------------------------
const G = L.loadGens(), W = G.win;
const PG = require(path.join(__dirname, '..', 'src', 'core', '27_premises.js'));
const CAT = PG.collect(W);
const itemP = key => { const e = CAT.entries.get(key); return e.params ? e.params({}) : Object.assign({}, W[e.gen].DEF, e.P); };
const presetP = (gen, name) => Object.assign({}, W[gen].DEF, W[gen].PRESETS[name]);
const CASES = [
  ['meteo-station', 'meteo/meteo station - Mount Ardent (site item)', 'METEO_GEN', () => presetP('METEO_GEN', 'meteo station'), 'item'],
  ['school', 'house/school - x4 on Jolene (site item)', 'HOUSE_GEN', () => itemP('house/school'), 'item'],
  ['clinic', 'house/clinic - x5 (site item)', 'HOUSE_GEN', () => itemP('house/clinic'), 'item'],
  ['log-cabin', 'house/log cabin - x7 (site item)', 'HOUSE_GEN', () => itemP('house/log cabin'), 'item'],
  ['church', 'house/church - x2 (site item)', 'HOUSE_GEN', () => itemP('house/church'), 'item'],
  ['net-store', 'shed/net store (site item)', 'SHED_GEN', () => itemP('shed/net store'), 'item'],
  ['club-hangar-long', 'hangar/club hangar, long - HOME (site item)', 'HANGAR_GEN', () => itemP('hangar/club hangar, long'), 'item'],
  ['field-shed', 'hangar/field shed - HOME (site item)', 'HANGAR_GEN', () => itemP('hangar/field shed'), 'item'],
  ['warehouse', 'big/warehouse - x3 (site item)', 'BIG_GEN', () => itemP('big/warehouse'), 'item'],
  ['wwii-tower', 'tower/WWII tower (site item)', 'TOWER_GEN', () => itemP('tower/WWII tower'), 'item'],
  ['plot-shore-cabin', 'village plot: shore cabin (sampled plot)', 'HOUSE_GEN', () => presetP('HOUSE_GEN', 'shore cabin'), 'plot'],
  ['plot-saltbox', 'village plot: saltbox farmhouse (sampled plot)', 'HOUSE_GEN', () => presetP('HOUSE_GEN', 'saltbox farmhouse'), 'plot'],
  ['plot-gambrel', 'village plot: gambrel barn (sampled plot)', 'HOUSE_GEN', () => presetP('HOUSE_GEN', 'gambrel barn'), 'plot'],
  ['out-storage-shed', 'outbuilding: storage shed (built at lod 1, banded on it since LODS-2026-10)', 'HOUSE_GEN', () => presetP('HOUSE_GEN', 'storage shed'), 'out'],
];
const KEYS = { item: ['l1', 'l1s'], plot: ['l1', 'l1s'], out: ['l1', 'l1s'], kit: ['l1', 'kbox', 'city'] };
// the overview's four columns per path: near | what the game shows today | the fix R1 | the fix R2
const OVER = { item: ['near', 'l1', 'l1s'], out: ['near', 'l1', 'l1s'], plot: ['near', 'l1', 'l1s'], kit: ['near', 'l1', 'city', 'cityfin'] };
// THE WHOLE CATALOGUE (--all): what the editor's site palette lists (premises_ui.js sitesPalette: PREMISES_GEN.collect)
function catalogueCases() {
  const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8')), n = {};
  for (const st of (J.layers.sites || [])) for (const it of (st.items || [])) n[it.key] = (n[it.key] || 0) + 1;
  const out = [];
  const add = (key, gen, P, cat) => out.push({ slug: key.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(), title: key + '  [' + cat + ']' + (n[key] ? '  x' + n[key] + ' on Jolene' : ''), gen, P, path: 'item', cat });
  for (const [key, e] of [...CAT.entries].sort((x, y) => (x[0] < y[0] ? -1 : 1))) { const GEN = W[e.gen]; if (!GEN || !GEN.build) continue; add(key, e.gen, e.params ? e.params({}) : Object.assign({}, GEN.DEF, e.P), e.cat || key.split('/')[0]); }
  if (W.METEO_GEN && !CAT.entries.has('meteo/meteo station')) for (const nm of Object.keys(W.METEO_GEN.PRESETS)) add('meteo/' + nm, 'METEO_GEN', presetP('METEO_GEN', nm), 'landmark');
  return out;
}

// the town kit's Metlakatla archetypes (tools/town_kit.js run) and the city pack's far shell for each (city_cook.js)
function kitCases() {
  const TK = require('./town_kit.js'), CC = require('./city_cook.js');
  const R = TK.run({ k: 30 }), BAGS = W.HOUSE_GEN.BAGS, HG = W.HOUSE_GEN;
  const COLS = HG.COLS.map(c => (Array.isArray(c) ? c[1] : c));
  const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const face = (set, col, dflt) => (col > 0 && col < COLS.length && (!set || CC.PAINTABLE.has(set)) ? rgb(COLS[col]) : (CC.MEANS[set] ? CC.MEANS[set].slice(1, 4) : dflt));
  const picks = R.arch.filter(a => /mk_/.test(a.name)).slice(0, 2);
  return picks.map((a, i) => {
    const sh = CC.shellOf(a, a.lods[1], BAGS);
    const wall = face(HG.setFor(a.P, 'wall'), a.P.wallCol, [128, 120, 108]), roof = face(HG.setFor(a.P, 'roof'), a.P.roofCol, [84, 84, 82]);
    const shell = CC.shellFaces(sh).map(([b, out, pts]) => ({ b, rgb: b === 0 ? wall : roof, pts: (() => { const p = pts.map(q => [q[0], q[1] === null ? 0 : q[1], q[2]]);
      const [A, B, C] = p, n = [(B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])];
      return n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0 ? p.reverse() : p; })() }));
    return { slug: 'kit-metlakatla-' + (i + 1), title: 'Metlakatla town kit: archetype ' + a.name + ' (' + (a.members ? a.members.length : '?') + ' plots)', gen: 'HOUSE_GEN', P: a.P, path: 'kit', shell, a };
  });
}

// ---- node's numbers for the columns -------------------------------------------------------------------------------
function auditOf(c) {
  const GEN = W[c.gen], out = {};
  if (c.path === 'kit') {
    const a = c.a, asBags = (Lx) => { const by = new Map(); for (let i = 0; i < Lx.idx.length; i += 3) { const r = Lx.role[Lx.idx[i]]; let b = by.get(r); if (!b) by.set(r, b = { name: W.HOUSE_GEN.BAGS[r], mat: { side: 0, isMeshStandardMaterial: true }, pos: Lx.pos, idx: [] }); b.idx.push(Lx.idx[i], Lx.idx[i + 1], Lx.idx[i + 2]); } return [...by.values()]; };
    const near = asBags(a.lods[0]), F = W.HOUSE_GEN.makeFinish();
    const l1 = asBags(a.lods[1]).filter(b => { const m = F.MAT[b.name]; return m && m.isMeshStandardMaterial && !m.transparent; });
    out.l1 = L.measure(near, l1); out.kbox = L.measure(near, asBags(a.lods[2])); out.city = L.measure(near, [L.polyBag('shell', c.shell.map(f => f.pts))]);
    return out;
  }
  const A = L.audit(GEN, c.P, c.path);
  KEYS[c.path].forEach((k, i) => { if (A.rungs[i]) out[k] = A.rungs[i]; });
  out.R = A.R; out.nearTris = A.nearTris;
  return out;
}

(async () => {
  const ALL = argv.includes('--all');
  let cases = ALL ? catalogueCases() : CASES.map(([slug, title, gen, Pf, pk]) => ({ slug, title, gen, P: Pf(), path: pk }));
  if (!ALL && !argv.includes('--no-kit')) cases = cases.concat(kitCases());
  const DIR = ALL ? path.join(OUT, 'catalogue') : OUT, EXT = ALL ? '.jpg' : '.png';
  if (ONLY) cases = cases.filter(c => c.slug.includes(ONLY));
  if (CATS_ONLY) cases = cases.filter(c => CATS_ONLY.split(',').includes(c.slug.split('-')[0]));
  for (const c of cases) {
    try { c.audit = auditOf(c); } catch (e) { c.audit = { err: String(e.message || e) }; }
    { const re = L.DETAIL_OF[c.gen]; c.detailRe = re ? re.source : null; }
    const R = c.audit.R || 10;
    c.near = L.RULE.near; c.edge = L.edgeOf(R); c.detail = L.detailEdgeOf(R); c.farGain = GAIN != null ? +GAIN : 0.2; c.gain = GAIN != null ? +GAIN : null;
    c.sub = 'path: ' + c.path + '  -  near ' + (c.audit.nearTris || '') + ' tris, radius ' + R.toFixed(1) + ' m  -  ' + ({ item: 'genItem: lod 0 + lod 1 (LODS-2026-10); far = its lod 1 on its finish from R x F / 48 px, its LOD_DETAIL roles leaving at R x F / 9 px',
      plot: 'genHouse: lod 0 + lod 1; far = lod 1 on its finish from R x F / 48 px, its LOD_DETAIL roles leaving at R x F / 9 px', out: 'an outbuilding: built at lod 1, banded on it (LODS-2026-10): far = its own mesh, its detail leaving at R x F / 9 px',
      kit: 'townkit.js: lod 0 < 150 m < lod 1 < 1.2 km < box; the city pack: one merged far shell a cell from 1 km' })[c.path];
  }
  fs.mkdirSync(DIR, { recursive: true });
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null; const results = [];
  try {
    for (let i = 0; ; i++) { const ok = await new Promise(r => http.get('http://127.0.0.1:' + port + '/flyDiy/tools/_lods.html', s => { s.resume(); r(s.statusCode === 200); }).on('error', () => r(false))); if (ok) break; if (i > 60) throw new Error('no server'); await sleep(250); }
    const { chromium } = findPlaywright();
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas'] });
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
    page.setDefaultTimeout(SECS * 1000);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    if (!fs.existsSync(path.join(__dirname, '_meteo_gen.js'))) {
      const { execFileSync } = require('child_process');
      let src = ''; try { src = execFileSync('git', ['show', 'origin/claude/meteo-code:flyDiy/tools/_meteo_gen.js'], { cwd: REPO, encoding: 'utf8' }); } catch (e) {}
      await page.route('**/flyDiy/tools/_meteo_gen.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: src || '/* no meteo generator */' }));
    }
    await page.goto('http://127.0.0.1:' + port + '/flyDiy/tools/_lods.html');
    await page.waitForFunction(() => window.LODS_READY === true);
    for (const c of cases) {
      const t0 = Date.now();
      const spec = { title: c.title, sub: c.sub, gen: c.gen, P: c.P, path: c.path, near: c.near, edge: c.edge, detail: c.detail, farGain: c.farGain, gain: c.gain, shell: c.shell || null, detailRe: c.detailRe, tile: ALL ? 220 : 300, jpeg: ALL,
                     audit: Object.fromEntries(Object.entries(c.audit).filter(([k, v]) => v && typeof v === 'object').map(([k, v]) => [k, { leak: v.leak, hole: v.hole, roof: v.roof }])) };
      try {
        const r = await page.evaluate(s => window.LODS.sheet(s), spec);
        fs.writeFileSync(path.join(DIR, c.slug + EXT), Buffer.from(r.png.split(',')[1], 'base64'));
        results.push({ slug: c.slug, title: c.title, path: c.path, cat: c.cat, stats: r.stats, audit: c.audit, secs: (Date.now() - t0) / 1000 });
        console.log('LODS SHEET ' + c.slug + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
      } catch (e) { console.log('LODS SHEET ' + c.slug + ' FAILED ' + String(e.message || e).slice(0, 300)); results.push({ slug: c.slug, title: c.title, err: String(e.message || e).slice(0, 300) }); }
    }
    // the overviews: near | what the game shows today | the fix R1 | the fix R2 (one image, or one a category with --all)
    const groups = new Map();
    for (const r of results.filter(q => q.stats)) { const k = ALL ? r.cat : 'index'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    for (const [g, list] of groups) {
      const ov = list.map(r => { const st = r.stats, by = k => st.findIndex(s => s.key === k);
        const cols = OVER[r.path].map(by).map(i => (i < 0 ? 0 : i));
        return { title: r.title, tile: ALL ? 220 : 300, png: 'data:image/' + (ALL ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(path.join(DIR, r.slug + EXT)).toString('base64'), cols,
                 labels: cols.map((i, k) => (k === 0 ? 'near, ' + st[i].tris + ' tris' : st[i].name.replace(/^(GAME FAR(, PAST THE DETAIL BAND)?: |FOLLOW-UP: )/, '').slice(0, 24) + ', ' + st[i].tris + ' tris, light x' + st[i].ratio2)) }; });
      const op = await page.evaluate(([l, j]) => window.LODS.overview(l, j), [ov, ALL]);
      fs.writeFileSync(path.join(DIR, (ALL ? 'overview-' + g.replace(/[^a-z0-9]+/gi, '-') : 'index') + (ALL ? '.jpg' : '.png')), Buffer.from(op.split(',')[1], 'base64'));
    }
    if (errs.length) console.log('page errors:\n  ' + [...new Set(errs)].slice(0, 12).join('\n  '));
  } finally { if (browser) await browser.close(); server.kill(); }
  const clean = results.map(r => Object.assign({}, r, { audit: r.audit ? Object.fromEntries(Object.entries(r.audit).map(([k, v]) => [k, v && typeof v === 'object' ? { tris: v.tris, leak: +(v.leak || 0).toFixed(4), hole: +(v.hole || 0).toFixed(4), roof: +(v.roof || 0).toFixed(3), iou: +(v.iou || 0).toFixed(3) } : v])) : null }));
  fs.writeFileSync(path.join(DIR, 'sheet.json'), JSON.stringify(clean, null, 1));
  // the index: every sheet, and under it its rungs' numbers
  const pc = v => (v == null ? '' : (v * 100).toFixed(v < 0.1 ? 1 : 0) + '%');
  const md = ['# LODS - the comparison sheets (' + new Date().toISOString().slice(0, 10) + ')', '',
    'Each sheet: one building, its NEAR mesh and every far rung the game draws of it (render_premises.js\'s own detailOf / lod1Bags / hlodMerge / hlodBoxes, lifted from the file by tools/_lods_rig.js), from the same cameras: **A** close from the air, **B** the far side steeper, **C** at the rung\'s switch distance through the game\'s lens (46 deg, 1080 rows) - true pixels, blown up. Since LODS-2026-10 the far columns ARE the game: every building\'s own lod 1 on its finish, then less its LOD_DETAIL roles past the detail band (the boards before the fix: git history of this folder, commit 90aece7d).', '',
    '![overview](index.png)', '', 'Made by `node tools/lods_sheet.js` (SwiftShader, headless; the numbers: `node tools/lods_audit.js`). Plan: [futureDesigns/LODS-2026-10.md](../../../futureDesigns/LODS-2026-10.md). The whole island\'s table: [audit.md](audit.md).', '',
    '**light** = the rung\'s mean luminance over the near mesh\'s from camera C (1.00 = as bright); **black** = share of the rung\'s pixels darker than sRGB 38 from camera A; **leak** = share of the view looking INTO the building (25 views); **hole** = share of the near view where the rung shows something more than max(1.5 m, R/10) behind the near mesh\'s outside (see-through, a missing roof or storey); **roof** = the near mesh\'s roofed plan still roofed from straight above.', ''];
  if (ALL) { md[0] = '# LODS - the whole catalogue (' + new Date().toISOString().slice(0, 10) + '): every generated asset of the editor\'s site palette'; md.splice(4, 1, ...[...new Set(clean.map(r => r.cat))].map(g => '![' + g + '](overview-' + String(g).replace(/[^a-z0-9]+/gi, '-') + '.jpg)\n')); }
  for (const r of clean) {
    md.push('## ' + r.title, '');
    if (r.err) { md.push('FAILED: ' + r.err, ''); continue; }
    md.push('![' + r.slug + '](' + r.slug + EXT + ')', '', '| rung | tris | meshes | from m | leak | hole | roof | light | black |', '|---|---|---|---|---|---|---|---|---|');
    for (const s of r.stats) { const a = r.audit && r.audit[s.key]; md.push('| ' + s.name + ' | ' + s.tris + ' | ' + s.draws + ' | ' + (s.at ? Math.round(s.at) : '-') + ' | ' + (a ? pc(a.leak) : '') + ' | ' + (a ? pc(a.hole) : '') + ' | ' + (a ? pc(a.roof) : '') + ' | ' + (s.key === 'near' ? '1.00' : s.ratio2.toFixed(2)) + ' | ' + pc(s.black0) + ' |'); }
    md.push('');
  }
  fs.writeFileSync(path.join(DIR, 'index.md'), md.join('\n') + '\n');
  console.log('LODS SHEET: ' + results.filter(r => !r.err).length + '/' + results.length + ' -> ' + path.relative(process.cwd(), DIR));
})().catch(e => { console.error(e); process.exit(1); });
