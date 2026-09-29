#!/usr/bin/env node
// tarr_cook.js - THE TOWN'S TEXTURE-ARRAY LAYERS, COOKED OFFLINE (G840, C2c of QUEUE-C; futureDesigns/ARCH-2026-09-27.md
// §3.2 (a), §3.4 step 4).
//
// The town on texture arrays (src/viewer/house_tarr.js, G574) assembled its two stacks IN THE PAGE: every house map it
// was asked for drawn into a 2D canvas at 512 x 512, read back with getImageData and shuffled channel by channel on the
// main thread (the colour layers alpha 255; the normal's rgb with the rough map's green in alpha) - ~84 MB with the
// mips over Jolene, at the roll-out. This tool does that ONCE: it runs the page's own `HOUSE_TARR.packer` (the same
// function the page keeps as its fallback) in headless Chrome over EVERY set of the house library (house_tex.js), and
// writes each layer as the bytes it made:
//   media/tex/house_tarr/<a|nr>_<set>[_<map>].<h8 of the raw layer>.gz.bin    one gzip stream a layer (ASSET_FETCH
//                                                                             gunzips by the suffix, off the thread)
//   src/viewer/house_tarr_pack.js                                             the manifest the page reads
// plus each colour map's 4 x 4 channel sums (render_premises meanOf, the far town's colour), so the far-town merge reads
// no pixels either.
//
// WHY CHROME AND NOT A NODE RESAMPLER: 1024 sets are halved and 256 sets doubled by the canvas's own 'high' smoothing,
// which no offline filter reproduces bit for bit (AS2's array_cook.js refuses a resample for that reason). Running the
// page's packer in the browser gives the page's texels. The canvas is a willReadFrequently one - the CPU path, the same
// in a headed page on a GPU - and Chrome runs here with --disable-gpu: this tool needs no GPU lock. The page proves it
// on the box: ?tarrcheck=1 draws every cooked layer with the canvas too and reports same / differ (house_tarr stats).
//
// THE FORMAT IS ONE SWITCH (house_tarr.js FMTS): the pack says fmt 'raw'; AS3's KTX2 (a compressed array per stack,
// transcoded in workers) plugs in as another format next to raw, from the same raw layers (AS2/AS3's array_cook.js
// encodes a raw plane to KTX2 by role: ktx2-color for the albedo, ktx2-normal for the normal+rough).
//
// THE PRICE, out loud: a raw layer is 1 MiB (gzip keeps most of it: they are photographs). Every set is cooked (any
// island or the editor may wear any set); a page fetches only the layers its bake asks for. Re-cook when house_tex.js
// (the library) or the packer changes - GATE TARR holds the pack to the library and to the packer's source hash.
//
//   node tools/tarr_cook.js [--px 512] [--report] [--chrome <exe>]
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { writeMedia, mediaRel } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const PX = +opt('px', 512);
const REPORT = flag('report');
const SUB = 'tex/house_tarr';
const PACK = path.join(ROOT, 'src', 'viewer', 'house_tarr_pack.js');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// the packer's own source (the page's code the cook ran): a change to it is a stale cook (GATE TARR)
function packerHash(src) {
  src = src || fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'house_tarr.js'), 'utf8');
  const a = src.indexOf('  function packer(px, doc) {'), b = src.indexOf('  // a map\'s name in the pack', a);
  if (a < 0 || b < 0) throw new Error('tarr_cook: house_tarr.js no longer has packer() .. keyOf - follow it');
  return sha(src.slice(a, b)).slice(0, 16);
}
// the library the cook read (house_tex.js): its set keys and map paths, in order
function libraryHash(src) {
  src = src || fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'house_tex.js'), 'utf8');
  return sha(src.replace(/\r/g, '')).slice(0, 16);
}

const CHROME = [opt('chrome', null), process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && fs.existsSync(p));

const PAGE = `<!doctype html><html><body><script>window.FLYDIY_ASSET_BASE = '';</script>
<script src="src/viewer/house_tex.js"></script>
<script src="src/viewer/house_tarr.js"></script>
<script>
const hex = async u8 => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map(b => b.toString(16).padStart(2, '0')).join('');
const load = img => (Array.isArray(img) || !img || img.complete) ? Promise.resolve() : new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
const ok = img => Array.isArray(img) || (img && img.complete && img.naturalWidth > 0);
window.OUT = [];
window.RUN = async px => {
  const T = HOUSE_TARR, P = T.packer(px, document), S = HOUSE_TEX_SETS, sums = {}, bad = [];
  for (const set of Object.keys(S)) {
    const s = S[set];
    for (const map of ['diff', 'paint']) {
      const img = s[map]; if (!img) continue;
      await load(img); if (!ok(img)) { bad.push(set + '.' + map); continue; }
      const key = T.keyA(img); if (!key) { bad.push(set + '.' + map + ' (no key)'); continue; }
      if (!OUT.some(o => o.key === key)) { const d = P.albedo(img); OUT.push({ key, stem: 'a_' + set + '_' + map, d, sha: await hex(d) }); }
      if (!Array.isArray(img)) sums[T.keyOf(img)] = T.sums16(img, document);
    }
    const n = s.nor || null, r = s.rough || null;
    await load(n); await load(r);
    if ((n && !ok(n)) || (r && !ok(r))) { bad.push(set + '.nr'); continue; }
    const key = T.keyN(n, r); if (!key) { bad.push(set + '.nr (no key)'); continue; }
    if (!OUT.some(o => o.key === key)) { const d = P.nr(n, r); OUT.push({ key, stem: 'nr_' + set, d, sha: await hex(d) }); }
  }
  return JSON.stringify({ n: OUT.length, list: OUT.map(o => ({ key: o.key, stem: o.stem, sha: o.sha, len: o.d.length })), sums, bad, ua: navigator.userAgent });
};
// one layer as base64, in slices (a whole layer in one CDP answer is ~1.4 MB: fine)
window.B64 = i => { const d = OUT[i].d; let s = ''; for (let j = 0; j < d.length; j += 0x8000) s += String.fromCharCode.apply(null, d.subarray(j, j + 0x8000)); return btoa(s); };
</script></body></html>`;

function serve() {
  return http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '');
    if (u === '' || u === 'index.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
    const f = path.join(ROOT, ...u.split('/'));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : u.endsWith('.jpg') ? 'image/jpeg' : u.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
    r.end(fs.readFileSync(f));
  });
}

function main() {
  if (!CHROME) { console.error('tarr_cook: no Chrome found (--chrome <exe> or CHROME=)'); process.exit(3); }
  const srv = serve();
  srv.listen(0, '127.0.0.1', async () => {
    const port = srv.address().port, dbg = 9400 + (process.pid % 500);
    const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'tarrc_'));
    const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + dbg, '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + udd, 'about:blank'], { stdio: 'ignore' });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
    let ws = null;
    const done = code => { try { if (ws) ws.close(); } catch (e) {} try { ch.kill(); } catch (e) {} srv.close(); setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} process.exit(code); }, 500); };
    try {
      let tgt = null; for (let i = 0; i < 60 && !tgt; i++) { await sleep(300); try { tgt = (await getJSON('http://127.0.0.1:' + dbg + '/json')).find(t => t.type === 'page'); } catch (e) {} }
      if (!tgt) throw new Error('no page target');
      ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
      let id = 0; const waits = new Map(); ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
      const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
      const ev = async (expr, await_) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: !!await_, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result.result.value; };
      await cmd('Page.enable'); await cmd('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html' });
      let ready = false; for (let i = 0; i < 100 && !ready; i++) { await sleep(200); try { ready = await ev('typeof RUN === "function" && typeof HOUSE_TARR === "object" && typeof HOUSE_TEX_SETS === "object"'); } catch (e) {} }
      if (!ready) throw new Error('the cook page did not load');
      const t0 = Date.now();
      const R = JSON.parse(await ev('RUN(' + PX + ')', true));
      const version = (await cmd('Browser.getVersion')).result.product;
      console.log('tarr_cook: ' + R.n + ' layers packed at ' + PX + ' in ' + version + ' (' + (Date.now() - t0) + ' ms)' + (R.bad.length ? '; NOT COOKED: ' + R.bad.join(', ') : ''));
      const layers = {}, S = PX * PX * 4;
      let raw = 0, gz = 0, wrote = 0;
      for (let i = 0; i < R.list.length; i++) {
        const L = R.list[i], buf = Buffer.from(await ev('B64(' + i + ')'), 'base64');
        if (buf.length !== S || sha(buf) !== L.sha) throw new Error('tarr_cook: layer ' + L.key + ' came back ' + buf.length + ' bytes, sha ' + sha(buf).slice(0, 8) + ' (the page said ' + L.sha.slice(0, 8) + ')');
        const rel = REPORT ? mediaRel(SUB, L.stem, 'gz.bin', buf) : writeMedia(SUB, L.stem, 'gz.bin', buf);
        const abs = path.join(ROOT, ...rel.split('/'));
        raw += buf.length; if (!REPORT) { gz += fs.statSync(abs).size; wrote++; }
        layers[L.key] = rel;
      }
      console.log('  raw ' + (raw / 1048576).toFixed(1) + ' MiB' + (REPORT ? '' : ' -> ' + (gz / 1048576).toFixed(1) + ' MiB gzipped on disk (' + wrote + ' files)'));
      if (REPORT) { console.log('nothing written (--report).'); done(0); return; }
      // prune what this cook no longer names (this directory is the cook's alone)
      const dir = path.join(ROOT, 'media', ...SUB.split('/')), keep = new Set(Object.values(layers).map(r => path.basename(r)));
      let pruned = 0; for (const f of fs.readdirSync(dir)) if (!keep.has(f)) { fs.unlinkSync(path.join(dir, f)); pruned++; }
      const pack = { v: 1, px: PX, fmt: 'raw', packer: packerHash(), library: libraryHash(), chrome: version, layers: sortObj(layers), sums: sortObj(R.sums) };
      fs.writeFileSync(PACK, '// GENERATED FILE - DO NOT EDIT. Built by tools/tarr_cook.js (G840): the town\'s texture-array layers, cooked offline\n' +
        '// by house_tarr.js\'s own packer in headless Chrome - one gzip stream a layer under media/tex/house_tarr/ (the raw\n' +
        '// px x px RGBA8 bytes the canvas pass made), keyed a|<colour map> / nr|<normal map>|<rough map> (the map\'s media\n' +
        '// path, flat:r,g,b for a constant); sums: each colour map\'s 4 x 4 channel sums (the far town\'s mean, meanOf).\n' +
        'const HOUSE_TARR_PACK = ' + JSON.stringify(pack, null, 1) + ';\n' +
        "if (typeof window !== 'undefined') window.HOUSE_TARR_PACK = HOUSE_TARR_PACK;\n" +
        "if (typeof module !== 'undefined' && module.exports) module.exports = HOUSE_TARR_PACK;\n");
      console.log('  pack: src/viewer/house_tarr_pack.js (' + Object.keys(layers).length + ' layers, ' + Object.keys(R.sums).length + ' sums)' + (pruned ? '; pruned ' + pruned : ''));
      done(0);
    } catch (e) { console.error('tarr_cook:', e.message); done(1); }
  });
}
const sortObj = o => Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {});

module.exports = { packerHash, libraryHash, SUB, PACK };
if (require.main === module) main();
