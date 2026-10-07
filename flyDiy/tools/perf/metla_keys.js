#!/usr/bin/env node
// metla_keys.js - METLA-COOK (G2060): WHICH PROGRAMS DOES THE TOWN BRING? The page in node (GATE FRAMECOST's census: the
// garage boot, the roll-out, the stand, the taxi pin, the hybrid's flips), once with ?town=0 and once with ?town=1. Every
// program three creates is recorded with the boot step / view it fell in, its cacheKey, the HASH OF ITS GLSL as the driver
// gets it (Chrome's program cache keys on the source: a source a town-off profile never linked is a COLD link on the first
// town-on visit, however warm the profile) and the JS stack that made it. The read-out: the sources only the town makes,
// where they are made (a prelink under the screen, or a frame in flight) and by whom; the per-step program counts.
//   node tools/perf/metla_keys.js [--sides off,on] [--out <dir>] [--metla]   (--metla: FRAMECOST_METLAKATLA's view too)
//   node tools/perf/metla_keys.js --child off|on <out.json>                   (one side - what the parent spawns)
// A census: take `boxlock.sh take cpu <who>` first (two ~4 GB node children, minutes each).
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const fnvh = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; };

async function child(side, out) {
  process.env.FRAMECOST_QUERY = side === 'on' ? 'town=1' : 'town=0';
  const FC = require('../_framecost_check.js'), PN = require('../_page_node.js');
  const PROGS = [], SRC = {};
  let P0 = null, wrapped = false, phase = 'boot';
  const wrap = P => {
    if (wrapped) return; const R = P.win.FLYDIY_RENDERER; if (!R || !R.info || !R.info.programs) return;
    wrapped = true; const gl = R.getContext();
    const srcOf = p => { try { return [p.vertexShader, p.fragmentShader].map(sh => (sh && gl.getShaderSource(sh)) || '').join(' //---- '); } catch (e) { return ''; } };
    const arr = R.info.programs, push = arr.push;
    arr.push = function () {
      for (const p of arguments) {
        const W = P.win, FP = W.FLIGHT_PROBE; let cam = null;
        try { const c = FP && (typeof FP.camera === 'function' ? FP.camera() : FP.camera); if (c) cam = [Math.round(c.position.x), Math.round(c.position.z)]; } catch (e) {}
        const s = srcOf(p), h = fnvh(s); if (!SRC[h]) SRC[h] = s;
        PROGS.push({ mark: FC.bootMark.cur || phase, frame: P.frameNo, name: p.name, key: String(p.cacheKey), src: h, cam, what: CX,
          stack: String(new Error().stack).split('\n').slice(2, 18).map(l => l.trim().replace(/\(.*[\/\\]/, '(')).join(' < ') });
      }
      return push.apply(this, arguments);
    };
    // in flight, WHAT a compile was asked for: the root's name and path, its meshes' material names, where it stands
    let CX = null;
    for (const fn of ['compile', 'compileAsync']) { const f0 = R[fn]; R[fn] = function (root) {
      const prev = CX;
      if (phase === 'flight' && root && root.isObject3D) { try { const T = P.win.THREE, b = new T.Box3().setFromObject(root), c = b.getCenter(new T.Vector3()), mats = new Set(); let n = 0;
        root.traverse(o => { if (o.isMesh) { n++; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (m && mats.size < 4) mats.add((m.name || m.type) + (m.customProgramCacheKey && m.customProgramCacheKey !== T.Material.prototype.customProgramCacheKey ? '{' + String(m.customProgramCacheKey()).slice(0, 40) + '}' : '')); } });
        const path = []; for (let o = root; o && path.length < 4; o = o.parent) path.push(o.name || o.type);
        CX = fn + ' ' + path.join('<') + ' meshes ' + n + ' at ' + Math.round(c.x) + ',' + Math.round(c.z) + ' mats ' + [...mats].join(' ; '); } catch (e) { CX = fn + ' ?' + e.message; } }
      try { return f0.apply(this, arguments); } finally { CX = prev; } }; }
  };
  // the census opens its page through _page_node's openPage at call time: wrap it to add our hook and keep the page
  const open = PN.openPage;
  PN.openPage = async function (o) {
    const h = o.hooks || {}, a = h.afterScript;
    o.hooks = Object.assign({}, h, { afterScript(n, P) { if (a) a.call(this, n, P); P0 = P; wrap(P); } });
    const P = await open.call(this, o); P0 = P; wrap(P);
    // the post-boot phase from the page's own state: the trip log and the camera (stand / taxi pin / Metlakatla)
    const f0 = P.onFrame; P.onFrame = function (fn) { return f0.call(this, function (ph, n) { if (ph === 'start') { const W = P.win, T = W.FLYDIY_TRIPS, t = T && T[T.length - 1];
      if (W.BOOT && W.BOOT.state === 'gone' && t && t.kind === 'rollout' && t.done) phase = 'flight'; } return fn.apply(this, arguments); }); };
    return P;
  };
  const r = await FC.census('cub');
  const W = P0 && P0.win;
  fs.writeFileSync(out, JSON.stringify({ side, query: process.env.FRAMECOST_QUERY, progs: PROGS, src: SRC,
    town: W && W.FLYDIY_TOWN ? { all: !!W.FLYDIY_TOWN.all, n: W.FLYDIY_TOWN.n || 0 } : null, health: r.health, boot: Object.fromEntries(Object.entries(r.boot || {}).map(([k, v]) => [k, v.links || 0])) }));
  process.exit(0);
}

function read(dir) {
  const L = s => JSON.parse(fs.readFileSync(path.join(dir, 'keys_' + s + '.json'), 'utf8'));
  const A = L('off'), B = L('on');
  const srcA = new Set(A.progs.map(p => p.src)), keyA = new Set(A.progs.map(p => p.key));
  const newSrc = B.progs.filter(p => !srcA.has(p.src)), newKey = B.progs.filter(p => !keyA.has(p.key));
  const where = p => p.mark + (p.mark === 'flight' ? '@f' + p.frame + (p.cam ? ' cam ' + p.cam.join(',') : '') : '');
  console.log('town ' + JSON.stringify(A.town) + ' -> ' + JSON.stringify(B.town));
  console.log('programs: off ' + A.progs.length + ' (' + srcA.size + ' sources), on ' + B.progs.length + ' (' + new Set(B.progs.map(p => p.src)).size + ' sources)');
  const by = L2 => { const o = {}; for (const p of L2) o[p.mark] = (o[p.mark] || 0) + 1; return o; };
  const bA = by(A.progs), bB = by(B.progs);
  console.log('by step (off -> on): ' + Object.keys(Object.assign({}, bA, bB)).map(k => k + ' ' + (bA[k] || 0) + '->' + (bB[k] || 0)).join(', '));
  console.log('\nSOURCES ONLY THE TOWN MAKES: ' + newSrc.length + ' programs (' + new Set(newSrc.map(p => p.src)).size + ' sources); keys only the town makes: ' + newKey.length);
  for (const p of newSrc) {
    // the off side's nearest program of the same name: what differs in the key
    let best = null, bd = 1e9; const pp = p.key.split(',');
    for (const q of A.progs) { if (q.name !== p.name) continue; const qq = q.key.split(','); if (qq.length !== pp.length) continue; let d = 0; for (let i = 0; i < pp.length; i++) if (pp[i] !== qq[i]) d++; if (d < bd) { bd = d; best = qq; } }
    const diffs = best ? pp.map((v, i) => v !== best[i] ? '#' + i + ':' + best[i].slice(0, 20) + '->' + v.slice(0, 20) : null).filter(Boolean).join(' ') : 'no twin';
    console.log('  ' + where(p).padEnd(34) + ' ' + String(p.name).slice(0, 28).padEnd(28) + ' src ' + p.src + ' | ' + (diffs || 'same key, other source') + '\n      ' + (p.what ? 'WHAT ' + p.what + '\n      ' : '') + p.stack.slice(0, 400));
  }
  const gone = A.progs.filter(p => !new Set(B.progs.map(q => q.src)).has(p.src));
  console.log('\nsources only the town-OFF page makes: ' + gone.length + ' ' + JSON.stringify(gone.map(p => where(p) + ' ' + p.name)));
  console.log('\nlinks by boot step (off -> on): ' + Object.keys(Object.assign({}, A.boot, B.boot)).filter(k => (A.boot[k] || 0) !== (B.boot[k] || 0)).map(k => k + ' ' + (A.boot[k] || 0) + '->' + (B.boot[k] || 0)).join(', '));
}

(async () => {
  if (argv.includes('--child')) return child(opt('child'), argv[argv.indexOf('--child') + 2]);
  const dir = path.resolve(opt('out', path.join(__dirname, 'metla_keys')));
  if (argv.includes('--read')) return read(dir);
  fs.mkdirSync(dir, { recursive: true });
  const { spawnSync } = require('child_process');
  for (const side of opt('sides', 'off,on').split(',')) {
    const t = Date.now(); console.log('== ' + side);
    const env = Object.assign({}, process.env); if (argv.includes('--metla')) env.FRAMECOST_METLAKATLA = '1';
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', '--expose-gc', __filename, '--child', side, path.join(dir, 'keys_' + side + '.json')], { stdio: ['ignore', 'inherit', 'pipe'], env, maxBuffer: 1 << 28 });
    console.log('   exit ' + r.status + ' in ' + ((Date.now() - t) / 1000).toFixed(0) + ' s' + (r.status ? ': ' + String(r.stderr).slice(-2000) : ''));
  }
  read(dir);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
