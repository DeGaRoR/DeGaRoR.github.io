'use strict';
// src_diff.js <a programs.json.gz> <b programs.json.gz> : the shader SOURCES of two boots of one build, compared.
// Mission 1 test (a): any per-boot number written into GLSL defeats Chrome's program cache.
// Reads shader_bill.js captures ({programs:[], sources:{}}); prints the shape first, then the sets' difference and,
// for every source only one boot has, its nearest twin in the other boot and the first lines that differ.
const fs = require('fs'), zlib = require('zlib'), crypto = require('crypto');
const [A, B] = process.argv.slice(2);
const load = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8'));
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const shape = (J, tag) => {
  console.log(tag, 'top keys:', Object.keys(J).join(', '));
  const P = J.programs || J.progs || [];
  console.log(tag, 'programs:', P.length, 'first keys:', P[0] ? Object.keys(P[0]).join(', ') : '-');
  const S = J.sources || {};
  const ks = Object.keys(S);
  console.log(tag, 'sources:', ks.length, 'first key:', ks[0], 'type:', typeof S[ks[0]], typeof S[ks[0]] === 'object' && S[ks[0]] ? Object.keys(S[ks[0]]).join(',') : '');
};
const texts = J => {            // every distinct shader text of the boot: sha -> text
  const out = new Map(), S = J.sources || {};
  const put = t => { if (typeof t === 'string' && t.length > 40) out.set(sha(t), t); };
  for (const k of Object.keys(S)) { const v = S[k]; if (typeof v === 'string') put(v); else if (v && typeof v === 'object') for (const kk of Object.keys(v)) put(v[kk]); }
  for (const p of (J.programs || J.progs || [])) for (const k of ['vs', 'fs', 'vertex', 'fragment', 'vertexShader', 'fragmentShader', 'srcText']) put(p[k]);
  return out;
};
const ja = load(A), jb = load(B);
shape(ja, 'A'); shape(jb, 'B');
const ta = texts(ja), tb = texts(jb);
const onlyA = [...ta.keys()].filter(k => !tb.has(k)), onlyB = [...tb.keys()].filter(k => !ta.has(k));
console.log('distinct texts: A', ta.size, 'B', tb.size, '| only in A', onlyA.length, '| only in B', onlyB.length);
const lines = t => t.split('\n');
// the text with its numbers blanked, and three's "#define SHADER_NAME <material.name>" line too (PERF-TRACE, 22 Nov:
// the name is in the GLSL but not in three's cache key, so the FIRST material to ask names the program's source)
const NAME = /^\s*#define SHADER_NAME .*$/;
const sig = t => lines(t).slice(0, 400).map(l => NAME.test(l) ? '#define SHADER_NAME ?' : l.replace(/[0-9.]+/g, '#')).join('\n');
const nameOnly = t => lines(t).map(l => NAME.test(l) ? '#define SHADER_NAME ?' : l).join('\n');
{ const na = new Map(), nb = new Set(); for (const [k, t] of ta) na.set(sha(nameOnly(t)), k); for (const [, t] of tb) nb.add(sha(nameOnly(t)));
  let same = 0; for (const [s, k] of na) if (nb.has(s) && !tb.has(k)) same++;
  console.log('texts of A absent from B that B has under ANOTHER SHADER_NAME only:', same); }
const bySig = new Map(); for (const k of onlyB) { const s = sha(sig(tb.get(k))); if (!bySig.has(s)) bySig.set(s, []); bySig.get(s).push(k); }
let twins = 0, shown = 0; const diffLines = new Map();
for (const k of onlyA) {
  const cand = bySig.get(sha(sig(ta.get(k))));
  if (!cand || !cand.length) continue;
  twins++;
  const la = lines(ta.get(k)), lb = lines(tb.get(cand[0]));
  for (let i = 0; i < Math.min(la.length, lb.length); i++) if (la[i] !== lb[i]) {
    const key = la[i].replace(/[0-9.eE+-]+/g, '#').trim().slice(0, 140);
    if (!diffLines.has(key)) diffLines.set(key, { n: 0, a: la[i].trim().slice(0, 200), b: lb[i].trim().slice(0, 200) });
    diffLines.get(key).n++;
  }
}
console.log('only-in-A texts with a twin in B that differs ONLY by numbers (first 400 lines):', twins, 'of', onlyA.length);
for (const [k, v] of [...diffLines.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 40)) { console.log(String(v.n).padStart(5), '|A|', v.a); console.log('      |B|', v.b); shown++; }
if (!shown && onlyA.length) for (const k of onlyA.slice(0, 5)) console.log('no twin:', k, lines(ta.get(k)).slice(0, 3).join(' / ').slice(0, 200));
