#!/usr/bin/env node
// parked_cook.js - THE PARKED AEROPLANES COOKED OFFLINE (G805, the architecture queue's C0b; QUEUE-C-2026-09-27 C0 item 3).
// A sibling of premises_cook.js / world_prep.js: what the roll-out screen made on every run - each parked aeroplane
// captured through the editor (a round trip, 2-3 s a key) and its far rungs baked on the GPU (G569) - is made HERE,
// once, for the keys that are the same on every machine ('arch:' archetypes, 'stock:' designs), and shipped.
//
//   node tools/parked_cook.js                    # cook the keys the shipped premises park, write media/parked + the manifest
//   node tools/parked_cook.js --keys arch:cub,arch:c172 --only    # cook these, keep the manifest's others (no prune)
//   node tools/parked_cook.js --keys all         # every archetype and stock design the page lists
//   node tools/parked_cook.js --report           # cook in memory, print the sizes, write nothing
//   node tools/parked_cook.js --check            # no browser: is the manifest's build this tree's build? (exit 1 if not)
//   options: --page index.html (default; dev.html runs the loose src/) --port 8623 --fallback <main checkout>
//            --stale-ok (cook although a source is newer than the page - the signature would lie: debugging only)
//
// HOW. A headless Chrome on this box's GPU (the rigs' way: bench_eval.js) opens the game page with ?parkcook=0 (the cook
// off: nothing is read from an earlier cook) and ?world=none (the garage is all a capture needs; the bake writes albedo,
// normal and the gloss terms unlit), waits for the garage boot, and for each key calls PARKED.cookPack(key): THE PAGE'S
// OWN capture (CAGE_UI round trip + CAGE_JOIN.snapshot) and THE PAGE'S OWN bake (parked.js bakeData: the unwrap, the
// flown shaders drawn in atlas space, the dilation, the cut rungs) - nothing here re-implements either - then
// cookEncode's container (parked.js says the layout). The bytes come back over CDP and are written with
// _media_lib.writeMedia as ONE gzip stream per key, `media/parked/<key>.<h8 of the as-is bytes>.gz.bin` (GATE MEDIA:
// referenced == present; this tool owns media/parked and prunes it after a full cook), and src/core/parked_packs.json
// names them with their SIGNATURES (parked.js cookSig: the spec, FLYDIY_BUILD, the bake's and the cook's versions).
//
// WHEN TO COOK. The signature carries the game's build id and parked.js's own source, so ANY source change the build
// hashes (the core, the inlined viewer, the editor) or any edit of parked.js leaves the cook stale: the page then
// refuses it key by key and captures live, exactly as before (never a wrong aeroplane, only a
// slow roll-out; BOOT.log says 'stale'). Cook on the built tree that ships - after a merge train's build - with the
// page that build wrote (index.html). `--check` says whether the committed manifest matches version.json's build.
// THE PRICE, out loud (world_prep's rule): every cooked byte is in git history for ever. A key is ~1-2 MB gzipped
// (three 1024^2 RGB atlases, the rungs); a re-cook of unchanged bytes writes nothing (content-addressed), but any
// change to the aeroplane pipeline re-writes every key. Cook the keys the shipped worlds park, not every archetype.
// A GPU TOOL: hold the box's gpu lock (tools/perf/boxlock.sh take gpu <who>) while it runs.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');                // flyDiy/
const REPO = path.join(ROOT, '..');
const OUT = path.join(ROOT, 'src', 'core', 'parked_packs.json');
const SUB = 'parked';                                    // media/parked, this tool's own
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const REPORT = flag('report'), ONLY = flag('only'), CHECK = flag('check'), STALE_OK = flag('stale-ok');
const PAGE = opt('page', 'index.html');
const PORT = +opt('port', 8623), DPORT = 9700 + (process.pid % 80);
const FALLBACK = opt('fallback', fs.existsSync('D:/Dev/DeGaRoR.github.io/flyDiy') && path.resolve(REPO).toLowerCase() !== path.resolve('D:/Dev/DeGaRoR.github.io').toLowerCase() ? 'D:/Dev/DeGaRoR.github.io' : null);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

// ---- the keys: the aircraft objects of every shipped premises fixture ------------------------------------------
function fixtureKeys() {
  const dir = path.join(ROOT, 'tools', 'fixtures'), keys = new Set();
  const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') {
    if (o.kind === 'aircraft' && typeof o.key === 'string' && /^(arch|stock):/.test(o.key)) keys.add(o.key);
    for (const k in o) walk(o[k]); } };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) walk(readJSON(path.join(dir, f)));
  return [...keys].sort();
}

// ---- --check: the manifest against this tree's build, no browser ----------------------------------------------
if (CHECK) {
  const man = readJSON(OUT), ver = readJSON(path.join(ROOT, 'version.json'));
  const want = fixtureKeys();
  if (!man) { console.log('parked_cook --check: no manifest (' + path.relative(ROOT, OUT) + ')'); process.exit(1); }
  const missing = want.filter(k => !(man.keys || {})[k]);
  const same = ver && man.build === ver.build;
  console.log('parked_cook --check: manifest build ' + man.build + ', this tree ' + (ver && ver.build) + (same ? ' (same)' : ' (STALE: every key is captured live until a re-cook)') +
    '; keys ' + Object.keys(man.keys || {}).join(', ') + (missing.length ? '; NOT COOKED: ' + missing.join(', ') : ''));
  process.exit(same && !missing.length ? 0 : 1);
}

// ---- the page must be the build it signs ----------------------------------------------------------------------
function newestSource() {
  let best = { t: 0, f: null };
  const scan = (dir, re) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f), st = fs.statSync(p);
    if (st.isDirectory()) { if (!/^(node_modules|perf|fixtures)$/.test(f)) scan(p, re); } else if (re.test(f) && st.mtimeMs > best.t) best = { t: st.mtimeMs, f: p }; } };
  scan(path.join(ROOT, 'src'), /\.(js|css|html)$/);
  // the editor and the generators (tools/_*.js) ride in the page; the gates (_*_check.js) do not
  for (const f of fs.readdirSync(path.join(ROOT, 'tools'))) if (/^_.*\.js$/.test(f) && !/_check\.js$/.test(f)) { const st = fs.statSync(path.join(ROOT, 'tools', f)); if (st.mtimeMs > best.t) best = { t: st.mtimeMs, f: path.join(ROOT, 'tools', f) }; }
  return best;
}
const pageFile = path.join(ROOT, PAGE);
if (!fs.existsSync(pageFile)) { console.error('parked_cook: no ' + PAGE + ' - run node tools/build.js'); process.exit(2); }
{
  const ns = newestSource(), pt = fs.statSync(pageFile).mtimeMs;
  if (ns.t > pt + 1000) {
    const msg = 'parked_cook: ' + path.relative(ROOT, ns.f) + ' is newer than ' + PAGE + ' - the page is not the build it would sign (run node tools/build.js)';
    if (!STALE_OK) { console.error(msg); process.exit(2); }
    console.warn(msg + ' (--stale-ok)');
  }
}

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('parked_cook: no Chrome found'); process.exit(2); }
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });

(async () => {
  // the static server: this tree, the main checkout's gitignored data behind it; the answer must be OURS (rollout_perf's G733 rule)
  const sa = [path.join(__dirname, '_serve.js'), String(PORT), REPO].concat(FALLBACK ? ['--fallback', FALLBACK] : []);
  const server = spawn(process.execPath, sa, { stdio: 'ignore' });
  let serverExit = null; server.on('exit', c => { serverExit = c; });
  const udd = path.join(os.tmpdir(), 'pkc_' + DPORT + '_' + Date.now());
  let ch = null;
  const cleanup = () => { try { if (ch) ch.kill(); } catch (e) {} try { server.kill(); } catch (e) {} setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} }, 1500); };
  try {
    for (let i = 0; i < 40; i++) {
      if (serverExit !== null) throw new Error('the static server exited - port ' + PORT + ' is taken; pass --port');
      const root = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + PORT + '/flyDiy/version.json', r => { r.resume(); res(r.headers['x-serve-root'] ? decodeURIComponent(r.headers['x-serve-root']) : '(unnamed)'); }); rq.on('error', () => res(null)); });
      if (root) { if (path.resolve(root).toLowerCase() !== path.resolve(REPO).toLowerCase()) throw new Error('port ' + PORT + ' serves ' + root + ', not this tree'); break; }
      await sleep(250);
    }
    ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DPORT, '--window-size=1280,800', '--hide-scrollbars', '--no-first-run',
      '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
    let tgt = null;
    for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no Chrome page');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.error('  page exception: ' + String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).split('\n')[0]);
      if (m.method === 'Runtime.consoleAPICalled' && /^parked:/.test((m.params.args[0] && m.params.args[0].value) || '')) console.log('  ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ')); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async (expr, ms) => {
      const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms || 120000).then(() => ({ timeout: 1 }))]);
      if (r.timeout) throw new Error('page: timed out on ' + expr.slice(0, 60));
      if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text)));
      return r.result.result.value;
    };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    const url = 'http://localhost:' + PORT + '/flyDiy/' + PAGE + '?parkcook=0&world=none';
    const t0 = Date.now();
    await cmd('Page.navigate', { url });
    // the garage boot done: the editor stands, the boot's own 'parked' step ran (PARKED.ready), no chain left
    let ok = false;
    for (let i = 0; i < 240 && !ok; i++) { await sleep(1000); try { ok = await ev("!!(window.PARKED && PARKED.ready && window.CAGE_UI && window.CAGE_JOIN && window.GARAGE_SPEC && window.BOOT && !(BOOT.busy && BOOT.busy()) && window.FLYDIY_RENDERER)", 5000); } catch (e) {} }
    if (!ok) throw new Error('the garage never booted (' + url + ')');
    const info = await ev(`(() => { const R = window.FLYDIY_RENDERER, gl = R.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info');
      return { build: window.FLYDIY_BUILD || null, gpu: x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), cook: PARKED.COOK.on,
               keys: PARKED.keys().map(k => k[0]).filter(k => /^(arch|stock):/.test(k)) }; })()`);
    const ver = readJSON(path.join(ROOT, 'version.json'));
    console.log('parked_cook: ' + PAGE + ' build ' + info.build + ' (version.json ' + (ver && ver.build) + '), booted in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s on ' + info.gpu);
    if (info.cook) throw new Error('the page has the cook ON - ?parkcook=0 did not reach it');
    if (/swiftshader|llvmpipe|software/i.test(info.gpu)) throw new Error('a software renderer (' + info.gpu + '): cook on the GPU');
    if (!info.build || (ver && info.build !== ver.build)) throw new Error('the page\'s build ' + info.build + ' is not version.json\'s ' + (ver && ver.build));
    const want = opt('keys', null) === 'all' ? info.keys : opt('keys', null) ? opt('keys').split(',').filter(Boolean) : fixtureKeys();
    for (const k of want) if (!info.keys.includes(k)) throw new Error('the page lists no ' + k + ' (' + info.keys.length + ' keys: ' + info.keys.slice(0, 6).join(', ') + ' ...)');
    console.log('  keys: ' + want.join(', '));

    const { writeMedia, pruneMedia } = require('./_media_lib.js');
    const man = ONLY ? (readJSON(OUT) || { keys: {} }) : { keys: {} };
    const keep = [];
    const CH = 3 << 20;
    for (const key of want) {
      const t1 = Date.now();
      const n = await ev(`PARKED.cookPack(${JSON.stringify(key)}).then(u => { window.__pkc = u; return u.length; })`, 300000);
      const parts = [];
      for (let off = 0; off < n; off += CH)
        parts.push(Buffer.from(await ev(`(() => { const u = window.__pkc, e = Math.min(u.length, ${off + CH}); let s = '';
          for (let i = ${off}; i < e; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, Math.min(e, i + 0x8000))); return btoa(s); })()`), 'base64'));
      await ev('(window.__pkc = null, 1)');
      const buf = Buffer.concat(parts);
      if (buf.length !== n) throw new Error(key + ': ' + buf.length + ' bytes came over, the page made ' + n);
      if (buf.toString('latin1', 0, 4) !== 'PKC1') throw new Error(key + ': not a cook container');
      const hl = buf.readUInt32LE(4), hdr = JSON.parse(buf.toString('latin1', 8, 8 + hl));
      if (hdr.key !== key || hdr.build !== info.build) throw new Error(key + ': the header says ' + hdr.key + ' / ' + hdr.build);
      const gz = zlib.gzipSync(buf, { level: 9 });
      const secs = ((Date.now() - t1) / 1000).toFixed(1);
      const tris = hdr.L.map(l => l.nt);
      console.log('  ' + key + ': ' + (buf.length / 1048576).toFixed(2) + ' MB as is, ' + (gz.length / 1048576).toFixed(2) + ' MB gzipped; rungs ' + tris.join(' / ') + ' tris; ' +
        (hdr.stats ? hdr.stats.charts + ' charts, ' + hdr.stats.cm + ' cm a texel; ' : '') + 'pitch ' + (hdr.stance.pitch * 180 / Math.PI).toFixed(2) + ' deg; ' + secs + ' s');
      if (REPORT) continue;
      const rel = writeMedia(SUB, key.replace(/[^A-Za-z0-9]+/g, '_'), 'gz.bin', buf);
      keep.push(rel);
      man.keys[key] = { src: rel, sig: hdr.sig, kb: Math.round(fs.statSync(path.join(ROOT, ...rel.split('/'))).size / 1024), rawKb: Math.round(buf.length / 1024), tris };
    }
    if (!REPORT) {
      const keys = {}; for (const k of Object.keys(man.keys).sort()) keys[k] = man.keys[k];
      const out = { note: 'GENERATED by tools/parked_cook.js - do not edit. Each src is one gzip stream (parked.js cookDecode); a key is used only where the page\'s own cookSig equals sig.',
                    v: 1, cooked: new Date().toISOString().slice(0, 10), build: info.build, gpu: info.gpu, keys };
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
      console.log('  wrote ' + path.relative(ROOT, OUT) + ' (' + Object.keys(keys).length + ' keys)');
      if (!ONLY) { const gone = pruneMedia(SUB, keep); if (gone.length) console.log('  pruned ' + gone.length + ': ' + gone.join(', ')); }
    }
    try { await cmd('Browser.close'); } catch (e) {}
    ws.close();
  } finally { cleanup(); }
})().catch(e => { console.error('parked_cook: ' + (e && e.message || e)); process.exitCode = 1; });
