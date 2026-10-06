#!/usr/bin/env node
// GATE DMGDETERMINISM (G2353-G2356, DMG-DETERMINISM) - the same crash is the same bits in every V8 tier, node only.
//
// DMG-COMPOSITE (G2048) found the Jodel's 30 m/s centreline trunk at 154 broken in one run and 204 in another, the Cub
// 125 / 169, the metal Cessna 178 / 208, and read it as V8's optimiser (one untaken branch in beamYield). G2353 measured
// it: the 204 / 169 / 208 rows are, TO THE BIT (a474fbbd6ba2b8fe, 8873243509ec2bb5, 44b1e9ea5f39a293), what the COMMITTED
// generated core flies - tools/flight_core.js as git holds it (train 37's, built from master): a tree whose generated
// files were put back from git before a commit ran the old core until the next build. No tier ever moved a number:
// every crash below is one hash under the interpreter, the baseline compiler, Maglev, TurboFan and their mixes, with the
// untaken branch and without. The fix is at the cause: node refuses a stale core (tools/_core_fresh.js, called by the
// core itself and by the crash library).
//
// The checks:
//   1. FRESH: this tree's core is the one its src/core builds; a core whose header disagrees with its sources is refused
//      (the library throws) - a core from before G2353, which cannot check itself, is refused by the library
//   2. THE TIERS: on the Cub, the Jodel and the metal Cessna, damage ON with the certificate stamped (computed once, in
//      its own child, as the game's bench thread hands it over), the 3 m/s taxi, the nose-over, the 30 m/s trunk on the
//      centreline and 2.5 m out; damage OFF the 30 m/s centreline and a 20 s flight at full power - each one sha1 of
//      the final sim.p / sim.v under every tier flag set (TIERS); the certificate itself under the interpreter and
//      TurboFan (one hash)
//   3. THE BRANCH (--branch, in the evidence): G2048's untaken `if (!(b.ecu > 0)) return;` after the kink re-added to the
//      generated core (FLYDIY_CORE): the same hashes as without it, in every tier
//   4. THE PAGE (when Chromium is there - playwright, the installed browser; else REPORTED as not run, never a pass): the
//      same crashes in a page (tools/_dmg_parity_run.js - atTrunk's state path, bit for bit: its node run is checked
//      against the library's hash here) on this core, the certificate handed in, against node's hashes; and the Math.*
//      the solver calls (sin, cos, atan, atan2, asin, sqrt, hypot, pow, exp, log) on 200 000 inputs each, bit for bit
// --selftest: the gate goes red (a) with the op as it was - a stale core (the committed one, or a header doctored) loads
// and flies (expected: refused), (b) with one coordinate nudged by 1 ulp in one tier's child (expected: a hash differs -
// and the count moves: the chaos the ensemble (GATE TREECRASH's ensemble rows) is for)
// Run: node tools/_dmg_determinism_check.js [--full] [--branch] [--json f] [--selftest]   (one final
// `GATE DMGDETERMINISM: PASS|FAIL`; children DMGDET_JOBS at once, default 3)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const argv = process.argv.slice(2);
const T = __dirname;

// the tier flag sets (node 22 / V8 12.4: Maglev is off by default, so the default is Ignition -> Sparkplug -> TurboFan)
const TIERS = {
  turbofan: [],                                     // the default
  ignition: ['--max-opt=0'],                        // the interpreter only
  sparkplug: ['--max-opt=1'],                       // + the baseline compiler
  maglev: ['--maglev', '--max-opt=2'],              // + Maglev, no TurboFan
  maglevTf: ['--maglev'],                           // every tier
  noOpt: ['--no-opt'],                              // G2048's flag
  alwaysTf: ['--always-turbofan'],                  // TurboFan from the first call
};
const LAND = ['cub', 'jodel', 'metal'];
const ON = ['taxi', 'noseover', 'trunk0', 'trunk25'], OFF = ['trunk0', 'flight'];

// ---- a child ----
if (argv[0] === '--child') {
  const L = require('./_treecrash_lib.js');
  const [kind, k, id, dmg] = argv.slice(1);
  const t0 = Date.now(), H = a => require('crypto').createHash('sha1').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex').slice(0, 16);
  let out;
  if (kind === 'cert') {
    const c = L.certOf(k);
    if (id && id !== '-') fs.writeFileSync(path.join(id, k + '.json'), JSON.stringify({ nb: c.nb, Ft: Array.from(c.Ft), Fc: Array.from(c.Fc) }));
    out = { kind, k, hash: H(c.Ft) + H(c.Fc).slice(0, 8) };
  } else {
    const o = Object.assign({}, L.STANDARD[id].o, dmg === 'off' ? { elastic: true, cert: false } : { cert: true });
    // the selftest's nudge: one coordinate 1 ulp up as the run starts (Float64Array: the next double)
    if (process.env.FLYDIY_DET_NUDGE === '1') o.onStart = sim => { const f = new Float64Array([sim.p[0]]), u = new BigInt64Array(f.buffer); u[0] += 1n; sim.p[0] = f[0]; };
    const r = L.atTrunk(k, o);
    out = { kind, k, id, dmg, hash: L.stateHash(r.sim), broken: r.dmg.broken.length, work: +r.dmg.work.toFixed(1), crashed: r.dmg.crashed, finite: r.finite };
  }
  out.s = (Date.now() - t0) / 1000;
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n', () => process.exit(0));
  return;
}

const { spawn } = require('child_process');
const JOBS = +(process.env.DMGDET_JOBS || 3);
function child(flags, args, env) {
  return new Promise(res => {
    const c = spawn(process.execPath, flags.concat([__filename, '--child'], args), { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', code => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { err: (se || so).slice(-600), code }); });
  });
}
async function pool(jobs) {
  const R = new Array(jobs.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, async () => { while (i < jobs.length) { const j = i++; R[j] = Object.assign({ tier: jobs[j].tier, tag: jobs[j].tag }, await jobs[j].run()); } }));
  return R;
}

// the generated core with G2048's untaken branch re-added (a temp file: FLYDIY_CORE)
function branchCore(dir) {
  const src = fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8');
  const a = "b.kink = true; b.Lf = L; b.Ff = fc; beamBreak(bi, 'kink'); }";
  if (src.split(a).length !== 2) throw new Error('the kink line not found once in the core');
  const f = path.join(dir, 'flight_core_branch.js');
  fs.writeFileSync(f, src.replace(a, "b.kink = true; b.Lf = L; b.Ff = fc; beamBreak(bi, 'kink'); if (!(b.ecu > 0)) return; }"));
  return f;
}

// a tree of symlinks round a doctored core: its header disagrees with the sources (the stale case, made on purpose)
function staleTree(dir, coreText) {
  const t = path.join(dir, 'stale'), tools = path.join(t, 'tools');
  fs.mkdirSync(path.join(t, 'src'), { recursive: true }); fs.mkdirSync(tools, { recursive: true });
  fs.symlinkSync(path.join(T, '..', 'src', 'core'), path.join(t, 'src', 'core'));
  fs.symlinkSync(path.join(T, 'build.js'), path.join(tools, 'build.js'));
  fs.writeFileSync(path.join(tools, 'flight_core.js'), coreText);
  return path.join(tools, 'flight_core.js');
}

(async () => {
  const t0 = Date.now(), FULL = argv.includes('--full'), BRANCH = argv.includes('--branch'), SELF = argv.includes('--selftest');
  const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmgdet-'));
  let checks = 0, fails = 0;
  const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
  const F = require('./_core_fresh.js');
  const report = { tiers: TIERS, rows: [], certs: [], branch: [], selftest: null };
  let selfPageRed = null;   // (the page's selftest, when Chromium is there)

  // 1. FRESH
  console.log('1. the core is fresh; a stale core is refused');
  const fr = F.fresh(path.join(T, 'flight_core.js'));
  yes(fr.ok && fr.judged, 'tools/flight_core.js is the core src/core builds (body-sha256 ' + fr.header + ')');
  const cur = fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8');
  const doct = staleTree(dir, cur.replace(/^\/\/ body-sha256: \w+\n/m, '// body-sha256: 0000000000000000\n'));
  let threw = false; try { F.assertFresh(doct); } catch (e) { threw = /STALE CORE/.test(e.message); }
  yes(threw && !F.fresh(doct).ok, 'a core whose header is not its sources\' hash is refused (STALE CORE)');

  // the certificates, once each, in their own child (the game's bench thread); and each under the interpreter
  const certDir = path.join(dir, 'certs'); fs.mkdirSync(certDir);
  const CT = FULL ? ['turbofan', 'ignition', 'maglevTf'] : ['turbofan', 'ignition'];
  const certR = await pool([].concat(...LAND.map(k => CT.map(tier => ({ tier, tag: k, run: () => child(TIERS[tier], ['cert', k, tier === 'turbofan' ? certDir : '-']) })))));
  report.certs = certR;
  console.log('2. the tiers (' + (FULL ? 'every flag set' : 'the interpreter, Sparkplug, Maglev, TurboFan, --no-opt') + ')');
  for (const k of LAND) {
    const r = certR.filter(x => x.tag === k), hs = new Set(r.map(x => x.hash));
    yes(r.every(x => x.hash) && hs.size === 1, k + ': the certificate under ' + r.map(x => x.tier + ' ' + (x.hash || 'ERR ' + x.err)).join(', '));
  }
  const tiers = FULL ? Object.keys(TIERS) : ['turbofan', 'ignition', 'sparkplug', 'maglev', 'noOpt'];
  const cases = [].concat(...LAND.map(k => ON.map(id => [k, id, 'on']).concat(OFF.map(id => [k, id, 'off']))));
  const env = { FLYDIY_CERT_DIR: certDir };
  const jobs = [];
  for (const [k, id, dmg] of cases) for (const tier of tiers) jobs.push({ tier, tag: k + '/' + id + '/' + dmg, run: () => child(TIERS[tier], ['run', k, id, dmg], env) });
  // the slow tiers first (the pool's tail is then the fast ones)
  const slow = t => (t === 'ignition' ? 0 : t === 'sparkplug' || t === 'noOpt' ? 1 : 2);
  jobs.sort((a, b) => slow(a.tier) - slow(b.tier));
  const R = await pool(jobs);
  report.rows = R;
  for (const [k, id, dmg] of cases) {
    const tag = k + '/' + id + '/' + dmg, r = R.filter(x => x.tag === tag), hs = new Set(r.map(x => x.hash)), base = r.find(x => x.tier === 'turbofan');
    yes(r.every(x => x.hash && x.finite) && hs.size === 1, tag + ': ' + (base ? base.broken + ' broken, ' + base.work + ' J, ' : '') + (hs.size === 1 ? 'one hash ' + [...hs][0] + ' under ' + r.length + ' tier sets'
      : r.map(x => x.tier + ' ' + (x.hash ? x.hash + ' (' + x.broken + ')' : 'ERR ' + x.err)).join(', ')));
  }

  // 3. the branch re-added
  if (BRANCH) {
    console.log('3. G2048\'s untaken branch re-added (beamYield: `if (!(b.ecu > 0)) return;` after the kink)');
    const bf = branchCore(dir), bt = FULL ? tiers : ['turbofan', 'ignition', 'noOpt'];
    const bj = [];
    for (const [k, id, dmg] of cases) for (const tier of bt) bj.push({ tier, tag: k + '/' + id + '/' + dmg, run: () => child(TIERS[tier], ['run', k, id, dmg], Object.assign({ FLYDIY_CORE: bf }, env)) });
    bj.sort((a, b) => slow(a.tier) - slow(b.tier));
    const B = await pool(bj);
    report.branch = B;
    for (const [k, id, dmg] of cases) {
      const tag = k + '/' + id + '/' + dmg, r = B.filter(x => x.tag === tag), base = R.find(x => x.tag === tag && x.tier === 'turbofan');
      yes(r.every(x => x.hash === base.hash), tag + ' with the branch: ' + r.map(x => x.tier + ' ' + (x.hash || 'ERR ' + x.err)).join(', ') + ' (without: ' + base.hash + ')');
    }
  }

  // 4. THE PAGE
  {
    console.log('4. the page (headless Chromium) against node');
    const P = require('./_dmg_parity_run.js'), C = require('./flight_core.js'), crypto = require('crypto'), L = require('./_treecrash_lib.js');
    const sha = r => crypto.createHash('sha1').update(Buffer.from(r.p.buffer)).update(Buffer.from(r.v.buffer)).digest('hex').slice(0, 16);
    const specOf = k => { const j = JSON.parse(fs.readFileSync(path.join(T, '..', L.BUILDS[k].build), 'utf8')); return j.spec || j; };
    const certJ = k => JSON.parse(fs.readFileSync(path.join(certDir, k + '.json'), 'utf8'));
    // (the parity script flies the library's bits: one case checked here, in node)
    { const r = P.run(C, specOf('jodel'), certJ('jodel'), 'trunk0', 0), lib = R.find(x => x.tag === 'jodel/trunk0/on' && x.tier === 'turbofan');
      yes(lib && sha(r) === lib.hash, 'the parity script in node: the Jodel\'s centreline ' + sha(r) + ' = the library\'s ' + (lib && lib.hash)); }
    let chromium = null;
    try { ({ chromium } = require('playwright')); } catch (e) {
      try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); } catch (e2) { /* none */ } }
    let br = null; if (chromium) try { br = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}); } catch (e) { br = null; }
    if (!br) console.log('  REPORT  no Chromium here (playwright or its browser missing): the page was NOT compared');
    else {
      const pg = await br.newPage();
      await pg.setContent('<!doctype html><meta charset="utf-8"><title>parity</title>');
      await pg.addScriptTag({ path: path.join(T, 'flight_core.js') }); await pg.addScriptTag({ path: path.join(T, '_dmg_parity_run.js') });
      const ver = br.version();
      report.page = { chromium: ver, node: process.versions.v8, rows: [] };
      for (const [k, id, dmg] of cases) {
        const r = await pg.evaluate(([spec, cert, id]) => {
          const C = { buildGen, genMigrateSpec, makeWorld, TREE_HITS, OBSTACLES, makeSim, placeAtAerodrome }, x = DMG_PARITY.run(C, spec, cert, id, 0), u = new Uint8Array(x.p.byteLength + x.v.byteLength);
          u.set(new Uint8Array(x.p.buffer), 0); u.set(new Uint8Array(x.v.buffer), x.p.byteLength);
          let b64 = ''; for (let i = 0; i < u.length; i += 8192) b64 += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
          return { bytes: btoa(b64), broken: x.broken, work: x.work, ms: x.ms };
        }, [specOf(k), dmg === 'on' ? certJ(k) : null, id]);
        r.hash = crypto.createHash('sha1').update(Buffer.from(r.bytes, 'base64')).digest('hex').slice(0, 16); delete r.bytes;
        const nd = R.find(x => x.tag === k + '/' + id + '/' + dmg && x.tier === 'turbofan');
        report.page.rows.push(Object.assign({ tag: k + '/' + id + '/' + dmg, node: nd && nd.hash }, r));
        yes(nd && r.hash === nd.hash, k + '/' + id + '/' + dmg + ': Chromium ' + ver + ' ' + r.hash + ' (' + r.broken + ' broken, ' + r.work.toFixed(1) + ' J) - node ' + (nd ? nd.hash + ' (' + nd.broken + ')' : '-'));
      }
      // the Math.* functions, bit for bit, node against the page: the BUILTINS (reported - what a page computes without
      // the core's Math) and THE CORE'S Math (checked - the shadow 00_registry.js puts over sin, cos, pow); 200 000
      // seeded arguments each, built from exact operations only (powers of two by multiplication)
      const ops = ['sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'sqrt', 'hypot', 'pow', 'exp', 'log', 'cbrt', 'tanh'];
      const mathSweep = (M, ops) => {
        let s = 7; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return (s >>> 0) / 4294967296; };
        const P2 = [1 / 131072]; for (let i = 1; i < 35; i++) P2.push(P2[i - 1] * 2);
        const out = {};
        for (const op of ops) {
          const N = 200000, o = new Float64Array(N);
          for (let i = 0; i < N; i++) {
            const x = (rnd() - 0.5) * P2[Math.floor(rnd() * 34)], y = (rnd() - 0.5) * P2[Math.floor(rnd() * 20) + 7], z = rnd() * 2 - 1;
            o[i] = op === 'atan2' ? M.atan2(x, y) : op === 'asin' || op === 'acos' ? M[op](z) : op === 'hypot' ? M.hypot(x, y, z) : op === 'pow' ? M.pow(M.abs(x), y)
              : op === 'log' || op === 'sqrt' ? M[op](M.abs(x)) : M[op](x);
          }
          out[op] = Array.from(o);
        }
        return out;
      };
      const C = require('./flight_core.js'), coreMath = { sin: C.fsin, cos: C.fcos, pow: C.fpow };
      const mN = mathSweep(globalThis.Math, ops);
      const mB = await pg.evaluate('(' + mathSweep.toString() + ')(globalThis.Math, ' + JSON.stringify(ops) + ')');
      const mC = await pg.evaluate('(' + mathSweep.toString() + ')(Math, ' + JSON.stringify(ops) + ')');   // (the page's lexical Math: the core's)
      const cnt = (A, B) => ops.map(op => { let d = 0; for (let i = 0; i < A[op].length; i++) if (!Object.is(A[op][i], B[op][i])) d++; return [op, d]; });
      const dB = cnt(mN, mB), dC = cnt(mN, mC);
      report.page.mathBuiltin = dB; report.page.mathCore = dC;
      console.log('  REPORT  the BUILTINS, Chromium ' + ver + ' against node ' + process.versions.v8 + ' (200 000 arguments each): ' + dB.map(([op, d]) => op + ' ' + d).join(', ') + ' differ');
      yes(dC.every(([, d]) => d === 0), 'THE CORE\'S Math in the page against node\'s builtins: ' + dC.map(([op, d]) => op + ' ' + d).join(', ') + ' differ');
      // the core's own sin / cos / pow against node's builtins, in node, over the awkward arguments too (any double's bits,
      // the huge reductions, the specials; integer exponents)
      { let s = 99, bad = 0, n = 0; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return (s >>> 0) / 4294967296; };
        const fb = new Float64Array(1), ub = new Uint32Array(fb.buffer), bits = () => { ub[0] = (rnd() * 4294967296) >>> 0; ub[1] = (rnd() * 4294967296) >>> 0; return fb[0]; };
        const sp = [0, -0, Infinity, -Infinity, NaN, 1, -1, 0.5, -0.5, 2, -2, 3, 1e-310, 1e308, 5e-324, Math.PI, Math.PI / 2, 1e22, 2 ** 53, 0.1];
        for (let i = 0; i < 300000; i++) { const x = i % 3 ? (rnd() - 0.5) * 2 ** Math.floor(rnd() * 80 - 40) : bits(), y = i % 3 === 1 ? Math.floor((rnd() - 0.5) * 40) : i % 3 ? (rnd() - 0.5) * 64 : bits();
          n++; if (!Object.is(C.fsin(x), Math.sin(x)) || !Object.is(C.fcos(x), Math.cos(x)) || !Object.is(C.fpow(Math.abs(x), y), Math.pow(Math.abs(x), y)) || !Object.is(C.fpow(x, y), Math.pow(x, y))) bad++; }
        for (const a of sp) { if (!Object.is(C.fsin(a), Math.sin(a)) || !Object.is(C.fcos(a), Math.cos(a))) bad++; for (const b of sp) if (!Object.is(C.fpow(a, b), Math.pow(a, b))) bad++; }
        report.coreVsNode = { n, bad };
        yes(bad === 0, 'the core\'s fsin / fcos / fpow against node\'s Math.sin / cos / pow: ' + bad + ' of ' + n + ' arguments (+ the specials) differ'); }
      // SELFTEST (with --selftest): the page with the builtins put back (the op as it was) must go red
      if (SELF) {
        const pg2 = await br.newPage();
        await pg2.setContent('<!doctype html><meta charset="utf-8"><title>parity, builtins</title>');
        const raw = fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8').replace('o.sin = fsin; o.cos = fcos; o.pow = fpow; return o;', 'return o;');
        await pg2.addScriptTag({ content: raw }); await pg2.addScriptTag({ path: path.join(T, '_dmg_parity_run.js') });
        const k = 'jodel', id = 'trunk0';
        const r = await pg2.evaluate(([spec, cert, id]) => {
          const C = { buildGen, genMigrateSpec, makeWorld, TREE_HITS, OBSTACLES, makeSim, placeAtAerodrome }, x = DMG_PARITY.run(C, spec, cert, id, 0), u = new Uint8Array(x.p.byteLength + x.v.byteLength);
          u.set(new Uint8Array(x.p.buffer), 0); u.set(new Uint8Array(x.v.buffer), x.p.byteLength);
          let b64 = ''; for (let i = 0; i < u.length; i += 8192) b64 += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
          return { bytes: btoa(b64), broken: x.broken, work: x.work };
        }, [specOf(k), certJ(k), id]);
        const h = crypto.createHash('sha1').update(Buffer.from(r.bytes, 'base64')).digest('hex').slice(0, 16), nd = R.find(x => x.tag === k + '/' + id + '/on' && x.tier === 'turbofan');
        report.selftestPage = { hash: h, broken: r.broken, work: r.work, node: nd && nd.hash };
        selfPageRed = nd && h !== nd.hash;
        console.log('  ' + (selfPageRed ? 'red ' : 'MISS') + '  SELFTEST the page with the builtin sin / cos / pow (the core as it was): the Jodel\'s centreline ' + h + ' (' + r.broken + ' broken, ' + r.work.toFixed(1) + ' J) against node\'s ' + (nd && nd.hash));
      }
      await br.close();
    }
  }

  // the selftest: with the op as it was (a stale core flies), and a 1-ulp nudge in one tier's child
  if (SELF) {
    console.log('SELFTEST (each must go red)');
    // (a) the committed core (from git) in a tree: its header is not the sources' - did the library refuse it?
    let committed = null;
    try { committed = require('child_process').execSync('git show HEAD:flyDiy/tools/flight_core.js', { cwd: path.join(T, '..'), maxBuffer: 64e6 }).toString(); } catch (e) { /* no git */ }
    const sf = staleTree(path.join(dir, 'c'), committed || cur.replace(/^\/\/ body-sha256: \w+\n/m, '// body-sha256: 0000000000000000\n'));
    const st = F.fresh(sf);
    const redA = !st.ok;
    console.log('  ' + (redA ? 'red ' : 'MISS') + '  ' + (committed ? 'the committed core (git HEAD)' : 'a doctored header') + ': fresh() ' + (st.ok ? 'passes it' : 'refuses it (' + st.header + ' vs ' + st.now + ')'));
    const [a, b] = await pool([{ tier: 'turbofan', tag: 'jodel/trunk0', run: () => child([], ['run', 'jodel', 'trunk0', 'on'], env) },
      { tier: 'turbofan+nudge', tag: 'jodel/trunk0', run: () => child([], ['run', 'jodel', 'trunk0', 'on'], Object.assign({ FLYDIY_DET_NUDGE: '1' }, env)) }]);
    const redB = a.hash && b.hash && a.hash !== b.hash;
    console.log('  ' + (redB ? 'red ' : 'MISS') + '  the Jodel\'s 30 m/s centreline, one coordinate 1 ulp up: ' + a.hash + ' (' + a.broken + ' broken, ' + a.work + ' J) vs ' + b.hash + ' (' + b.broken + ', ' + b.work + ' J)');
    report.selftest = { stale: { ok: st.ok, header: st.header, now: st.now, committed: !!committed }, nudge: [a, b] };
    yes(redA && redB && selfPageRed !== false, 'the selftest: every doctored case red' + (selfPageRed === null ? ' (the page\'s not run: no Chromium)' : ''));
  }

  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* the temp dir stays */ }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  console.log('GATE DMGDETERMINISM: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
