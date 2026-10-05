#!/usr/bin/env node
// mobile_share_size.js - MOBILE-GARAGE (G1513): HOW BIG IS A BUILD ON THE WIRE - node only, reads the stock builds.
// For each validated build: the envelope, the spec alone, gzip / deflate-raw / brotli, and base64url of deflate-raw
// (what a URL fragment would carry: CompressionStream('deflate-raw') exists in every current browser).
// Then the "FROZEN BASE + PATCH" link: the phone's build as a patch over a stock build the game ships frozen (by content
// hash), for a user who moved N rows - N = 5, 20, 60, 150 random numeric keys of the spec moved by a random step.
// QR capacity reference (ISO 18004, byte mode): version 40-L 2953 B, 25-L 1273 B, 15-L 520 B (a phone camera reads
// v15-v25 off another phone's screen reliably; v40 needs a print).
// Usage: node tools/perf/mobile_share_size.js [--out file.json]
'use strict';
const fs = require('fs'), path = require('path'), z = require('zlib');
const ROOT = path.join(__dirname, '..', '..');
const B = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json',
  floats: 'bugReports/cessnaFloatsWOrks.json', twin: 'tools/fixtures/build_v7_ultralight_2026-09-05.json' };
const dr = b => z.deflateRawSync(Buffer.isBuffer(b) ? b : Buffer.from(b), { level: 9 }).length;
const gz = b => z.gzipSync(Buffer.from(b), { level: 9 }).length;
const br = b => z.brotliCompressSync(Buffer.from(b), { params: { [z.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const b64 = n => Math.ceil(n * 4 / 3);
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
// every numeric leaf of the spec, as a path
const leaves = (o, p = [], out = []) => { for (const k of Object.keys(o)) { const v = o[k], q = p.concat(k);
  if (typeof v === 'number') out.push(q); else if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, q, out); } return out; };
const get = (o, p) => p.reduce((a, k) => a[k], o);
const out = { at: new Date().toISOString(), builds: {}, patch: {} };
console.log('build    envelope  spec-min  gzip  deflRaw  brotli  b64url(deflRaw)  cage-share');
for (const [k, f] of Object.entries(B)) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const spec = JSON.stringify({ v: j.v, name: j.name, spec: j.spec });
  const cage = JSON.stringify(j.spec.cage || {});
  const r = { file: f, envelope: fs.statSync(path.join(ROOT, f)).size, spec: spec.length, gzip: gz(spec), deflateRaw: dr(spec), brotli: br(spec),
    b64url: b64(dr(spec)), cageRaw: cage.length, cageDeflate: dr(cage), numericLeaves: leaves(j.spec).length };
  out.builds[k] = r;
  console.log(k.padEnd(8), String(r.envelope).padStart(8), String(r.spec).padStart(9), String(r.gzip).padStart(5), String(r.deflateRaw).padStart(8),
    String(r.brotli).padStart(7), String(r.b64url).padStart(16), (100 * r.cageRaw / r.spec).toFixed(0).padStart(9) + ' %');
}
// the patch link over a frozen Cub: {b: <8-hex content hash>, p: [[path, value], ...]}
const cub = JSON.parse(fs.readFileSync(path.join(ROOT, B.cub), 'utf8')).spec;
const L = leaves(cub);
console.log('\nfrozen base + patch over the stock Cub (' + L.length + ' numeric leaves):');
console.log('rows moved  patch-json  deflRaw  b64url  QR fits');
for (const n of [5, 20, 60, 150]) {
  const pick = new Set(); while (pick.size < n) pick.add(Math.floor(rnd() * L.length));
  const p = [...pick].map(i => { const q = L[i], v = get(cub, q); return [q.join('.'), +(v * (0.8 + 0.4 * rnd())).toFixed(3)]; });
  const s = JSON.stringify({ b: 'c0ffee12', v: 10, n: 'My Cub', p });
  const d = dr(s), u = b64(d);
  const qr = d <= 520 ? 'v15-L' : d <= 1273 ? 'v25-L' : d <= 2953 ? 'v40-L (print)' : 'no';
  out.patch[n] = { json: s.length, deflateRaw: d, b64url: u, qr };
  console.log(String(n).padStart(10), String(s.length).padStart(11), String(d).padStart(8), String(u).padStart(7), '  ' + qr);
}
const o = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(ROOT, 'reports/evidence/MOBILE-GARAGE/share_size.json'));
fs.writeFileSync(o, JSON.stringify(out, null, 1)); console.log('\n-> ' + path.relative(ROOT, o));
