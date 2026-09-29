#!/usr/bin/env node
// ground_layers_chrome.js - WHAT THE OLD GROUND LIBRARIES PACKED, MEASURED IN A REAL BROWSER (G912, AS2).
//
// The one ground library (tools/ground_tex_prep.js) cooks the texture-array layers OFFLINE that pavement.js
// library() and splat_ground.js buildArrays used to pack in the page (Image -> canvas drawImage -> getImageData ->
// the channel shuffle). The promise is THE SAME TEXELS PER LAYER. This tool is the reference: it checks out the
// OLD code and media at a commit (default b3bf0431, the base AS2 started from), runs the two OLD packing functions
// VERBATIM in headless Chrome/Chromium over the old manifests (every key: 19 splat sets, 35 pavement sets), and
// writes the SHA-256 of every layer each library packed, plus the SHA-256 of every map file the lot's and the
// site's manifests named (they bound plain textures: their texels are their files' bytes) to
//   tools/perf/ground_layers_before.json
// which GATE GROUNDLIB then holds the cooked layers (and the lot's / site's views) to, per library and key,
// in node, without a browser. Run once per such migration; needs git and a Chrome (or the container's
// Playwright Chromium). ~20 s.
//
// G903 (AS0b, train 16) made a flat map a constant: the old code at such a base fills the layer with it, and a flat
// map's fingerprint is 'flat:r,g,b' (GATE GROUNDLIB holds the table's constant to it).
//
//   node tools/ground_layers_chrome.js [--base <commit>] [--out <file>]
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BASE = opt('base', 'b3bf0431');
const OUT = opt('out', path.join(ROOT, 'tools', 'perf', 'ground_layers_before.json'));
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: ROOT, encoding: 'utf8' }).trim();
const PREFIX = path.relative(REPO, ROOT).split(path.sep).join('/');   // 'flyDiy'
const show = rel => execFileSync('git', ['show', `${BASE}:${PREFIX}/${rel}`], { cwd: REPO, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// the two OLD functions, cut out of the old sources verbatim
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cannot find ' + a); return src.slice(i, j); };
const PAV = cut(show('src/viewer/pavement.js').toString(), '  function library(THREE, keys, done) {', '  // THE SHARED LIBRARY');
const SPL = cut(show('src/viewer/splat_ground.js').toString(), '  function buildArrays(sets, U, R, done) {', "  // THE MACRO'S EXPOSURE");

const CHROME = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('ground_layers_chrome: no Chrome found (set CHROME=)'); process.exit(3); }

const PAGE = `<!doctype html><html><body><script>window.FLYDIY_ASSET_BASE = '';</script>
<script src="src/viewer/splat_tex.js"></script><script src="src/viewer/pavement_tex.js"></script>
<script src="src/viewer/lot_tex.js"></script><script src="src/viewer/site_tex.js"></script>
<script>
const THREE = { RGBAFormat: 1023, UnsignedByteType: 1009, RepeatWrapping: 1000, LinearMipmapLinearFilter: 1008, LinearFilter: 1006, SRGBColorSpace: 'srgb',
  DataArrayTexture: function (d, w, h, n) { this.image = { data: d, width: w, height: h, depth: n }; } };
const hex = async u8 => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map(b => b.toString(16).padStart(2, '0')).join('');
const MATS = [], applyOne = () => {};
${PAV}
${SPL}
window.RUN = async () => {
  const out = { pavement: {}, splat: {} };
  const keys = Object.keys(PAVEMENT_TEX_SETS);
  const L = await new Promise(r => library(THREE, keys, r));
  const S = 512 * 512 * 4;
  for (let i = 0; i < keys.length; i++) out.pavement[keys[i]] = { A: await hex(L.texA.image.data.subarray(i * S, (i + 1) * S)), N: await hex(L.texN.image.data.subarray(i * S, (i + 1) * S)) };
  const [a, n] = await new Promise(r => buildArrays(SPLAT_TEX_SETS, {}, { knobs: { aniso: 16 } }, (x, y) => r([x, y])));
  for (let i = 0; i < SPLAT_TEX_SETS.length; i++) out.splat[SPLAT_TEX_SETS[i].key] = { A: await hex(a.image.data.subarray(i * S, (i + 1) * S)), N: await hex(n.image.data.subarray(i * S, (i + 1) * S)) };
  // G903 (train 16): a FLAT map is its [r, g, b] in the manifest, no file - recorded as 'flat:r,g,b'
  const url = im => Array.isArray(im) ? 'flat:' + im.join(',') : im.src.replace(location.origin + '/', '');
  for (const [lib, T] of [['lot', LOT_TEX_SETS], ['site', SITE_TEX_SETS]]) { out[lib] = {}; for (const k in T) out[lib][k] = { diff: url(T[k].diff), nor: url(T[k].nor), rough: url(T[k].rough) }; }
  out.pavementMaps = {}; for (const k of keys) out.pavementMaps[k] = { diff: url(PAVEMENT_TEX_SETS[k].diff), nor: url(PAVEMENT_TEX_SETS[k].nor), rough: url(PAVEMENT_TEX_SETS[k].rough), height: url(PAVEMENT_TEX_SETS[k].height) };
  out.splatMaps = {}; for (const s of SPLAT_TEX_SETS) out.splatMaps[s.key] = { diff: url(s.diff), nor: url(s.nor), rough: url(s.rough), height: url(s.height) };
  return JSON.stringify(out);
};
</script></body></html>`;

const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
  if (u === '' || u === 'index.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
  let b = null; try { b = show(u); } catch (e) {}
  if (!b) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : u.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' }); r.end(b);
});
srv.listen(0, async () => {
  const port = srv.address().port, dbg = 9500 + (process.pid % 400);
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp_groundlayers_'));
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + dbg, '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu'].concat(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []).concat(['about:blank']), { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
  const done = code => { try { ch.kill(); } catch (e) {} srv.close(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} process.exit(code); };
  try {
    let tgt = null; for (let i = 0; i < 50 && !tgt; i++) { await sleep(300); try { tgt = (await getJSON('http://127.0.0.1:' + dbg + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map(); ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    await cmd('Page.enable'); await cmd('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html' });
    let ready = false; for (let i = 0; i < 100 && !ready; i++) { await sleep(200); ready = (await cmd('Runtime.evaluate', { expression: 'typeof RUN === "function"', returnByValue: true })).result.result.value; }
    const r = await cmd('Runtime.evaluate', { expression: 'RUN()', awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    const o = JSON.parse(r.result.result.value);
    // the plain-texture libraries (and every map, for the record): the files' own bytes at the base
    const files = {};
    for (const lib of ['lot', 'site', 'pavementMaps', 'splatMaps']) for (const k in o[lib]) for (const m in o[lib][k]) { const f = o[lib][k][m]; if (f.startsWith('flat:')) continue; o[lib][k][m] = files[f] || (files[f] = sha(show(f))); }
    const res = { base: BASE, chrome: (await cmd('Browser.getVersion')).result.product, made: 'tools/ground_layers_chrome.js', layer: 'SHA-256 of the 512x512 RGBA8 layer as the old code packed it in the page',
      splat: o.splat, pavement: o.pavement, lot: o.lot, site: o.site, maps: { splat: o.splatMaps, pavement: o.pavementMaps } };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
    console.log(`ground_layers_chrome: ${Object.keys(o.splat).length} splat + ${Object.keys(o.pavement).length} pavement layers packed by the old code in ${res.chrome}; ` +
      `${Object.keys(o.lot).length} lot + ${Object.keys(o.site).length} site sets -> ${path.relative(ROOT, OUT)}`);
    done(0);
  } catch (e) { console.error('ground_layers_chrome:', e.message); done(1); }
});
