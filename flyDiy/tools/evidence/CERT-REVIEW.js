#!/usr/bin/env node
// CERT-REVIEW.js - DOES THE BENCH WITHDRAW A CERTIFICATE NOBODY CHANGED? (G3550, CERT-REVIEW evidence; the review:
// futureDesigns/CERT-REVIEW-2026-10.md). Headless Chromium (Playwright; SwiftShader on a cloud box, the GPU on A0's) on
// the real game page (dev.html), the editor up, for each build asked:
//   1 THE LOAD DOOR (GARAGE_SPEC.set - the door the shelf, the fleet and an import enter by): the live bench fingerprint
//     (window.BENCH_FP()) sampled every second for --secs s. A build whose fingerprint moves after the load, with no
//     input touched, is a build whose certificate the bench withdraws on its own (BENCH_DIRTY: "the build changed").
//   2 THE SLOT DOOR WITH A CERTIFICATE (GARAGE_SPEC.load of a slot written here): the same build, its plaque holding one
//     bench check certificate stamped with the fingerprint step 1 SETTLED on (the moment a player would press "run"),
//     sampled again - BENCH_STATE().stale and the row's reason each second. "kept" = the bench kept it the whole time.
//   3 --file builds: the file's OWN plaque through the slot door (the Rufus story file: is its stamp valid on this tree?).
//
//   node tools/evidence/CERT-REVIEW.js [--only floats,cub,metal,jodel] [--files builds/rufus_2026-10-18_certified.json]
//                                      [--secs 45] [--out reports/evidence/CERT-REVIEW]
// Prints one line per build and a CERTREVIEW {...} JSON summary; writes <out>/cert_review.json. No stills (nothing
// visual is claimed): ~4 min a boot under SwiftShader, one boot per build.
'use strict';
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const T = path.join(__dirname, '..'), FLY = path.join(T, '..'), REPO = path.join(FLY, '..');
const LB = require(path.join(T, '_load_build.js'));
const ONLY = opt('only', 'floats,cub').split(',').filter(k => k && k !== 'none');   // --only none: the files alone
const FILES = opt('files', 'builds/rufus_2026-10-18_certified.json').split(',').filter(Boolean);
const SECS = +opt('secs', 45);
const OUT = path.resolve(opt('out', path.join(FLY, 'reports', 'evidence', 'CERT-REVIEW')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function findPlaywright() { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); }
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

async function boot(browser, port) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  [page error] ' + String(e && e.message).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://127.0.0.1:' + port + '/flyDiy/dev.html', { timeout: 120000 });
  const ready = () => page.evaluate(() => !!(window.BOOT && BOOT.state === 'gone' && window.GARAGE_SPEC && window.BENCH_STATE &&
                                             !(window.CAGE_CREW_PENDING && CAGE_CREW_PENDING()))).catch(() => false);
  for (let i = 0; i < 600 && !(await ready()); i++) await sleep(2000);
  if (!(await ready())) throw new Error('the page never booted');
  await sleep(3000);
  return { ctx, page };
}
// one sample: the live fingerprint and what the bench holds
const sample = page => page.evaluate(() => {
  let fp = null, st = null;
  try { fp = window.BENCH_FP ? window.BENCH_FP() : null; } catch (e) { fp = 'ERR'; }
  try {
    const S = window.BENCH_STATE();
    const r = S.results && S.results.shake;
    st = { any: S.any, passed: S.passed, stale: S.stale, shake: r ? (r.stale ? 'withdrawn: ' + (r.why || '?') : r.ok ? 'held' : 'not ok') : null };
  } catch (e) { st = { err: e.message }; }
  return { fp, st };
});
async function watch(page, secs) {
  const out = [];
  for (let s = 0; s < secs; s++) { out.push(await sample(page)); await sleep(1000); }
  return out;
}
const fpSeq = S => { const seq = []; for (const x of S) if (!seq.length || seq[seq.length - 1] !== x.fp) seq.push(x.fp); return seq; };

async function runBuild(browser, port, key, envIn) {
  const t0 = Date.now();
  const { ctx, page } = await boot(browser, port);
  try {
    const spec = envIn.spec || envIn;
    // 1. the load door, nothing touched
    await page.evaluate(s => { GARAGE_SPEC.set(s); }, spec);
    const A = await watch(page, SECS);
    const seqA = fpSeq(A), settled = seqA[seqA.length - 1];
    // 2. the slot door, a certificate stamped on the settled fingerprint
    let B = null, seqB = null, kept = null;
    if (settled && settled !== 'ERR') {
      const env = { what: 'flydiy-build', v: 1, name: 'certreview', spec,
        plaque: { when: '2026-10-24', trimUse: true, results: { shake: { verdict: 'FLIES A CIRCUIT', ok: true, fills: 'plaque',
          note: 'CERT-REVIEW evidence: stamped on the settled fingerprint', when: '2026-10-24', fp: settled, fps: 'f2' } } },
        log: { built: '2026-10-24', tests: [], flights: [] } };
      await page.evaluate(e => { localStorage.setItem('flydiy.build.certreview', JSON.stringify(e)); GARAGE_SPEC.load('certreview'); }, env);
      B = await watch(page, SECS);
      seqB = fpSeq(B);
      kept = B.every(x => x.st && x.st.shake === 'held');
    }
    // 3. the file's own plaque, when it carries one
    let C = null;
    if (envIn.plaque && envIn.plaque.results) {
      const env = Object.assign({}, envIn, { name: 'certreviewown' });
      await page.evaluate(e => { localStorage.setItem('flydiy.build.certreviewown', JSON.stringify(e)); GARAGE_SPEC.load('certreviewown'); }, env);
      const W = await watch(page, Math.min(SECS, 20));
      const own = {}; for (const k in envIn.plaque.results) own[k] = envIn.plaque.results[k].fp || null;
      C = { stored: own, live: fpSeq(W), last: W[W.length - 1].st };
    }
    return { key, secs: Math.round((Date.now() - t0) / 1000), loadDoor: { fps: seqA, moved: seqA.length > 1 },
             slotDoor: B ? { fps: seqB, kept, first: B[0].st, last: B[B.length - 1].st } : null, ownPlaque: C };
  } finally { await ctx.close(); }
}

(async () => {
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(T, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  process.on('exit', () => { try { server.kill('SIGKILL'); } catch (e) {} });
  await sleep(600);
  const { chromium } = findPlaywright();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const jobs = ONLY.map(k => [k, () => { const B = LB.VALIDATED[k]; let j = JSON.parse(fs.readFileSync(path.join(FLY, B.build), 'utf8')); if (B.patch) j = B.patch(j); return j; }])
    .concat(FILES.map(f => [path.basename(f, '.json'), () => JSON.parse(fs.readFileSync(path.resolve(FLY, f), 'utf8'))]));
  const res = [];
  for (const [k, get] of jobs) {
    try {
      const r = await runBuild(browser, port, k, get());
      res.push(r);
      console.log(k.padEnd(28) + ' load door fp ' + r.loadDoor.fps.join(' -> ') + (r.loadDoor.moved ? '  MOVED with no input' : '  steady') +
                  (r.slotDoor ? ' | certificate on the settled fp: ' + (r.slotDoor.kept ? 'KEPT' : 'WITHDRAWN (' + JSON.stringify(r.slotDoor.last) + ')') + ', fp ' + r.slotDoor.fps.join(' -> ') : '') +
                  (r.ownPlaque ? ' | own plaque ' + JSON.stringify(r.ownPlaque.stored) + ' live ' + r.ownPlaque.live.join(' -> ') + ' ' + JSON.stringify(r.ownPlaque.last) : '') +
                  '  (' + r.secs + ' s)');
    } catch (e) { console.log(k.padEnd(28) + ' FAILED ' + e.message); res.push({ key: k, error: e.message }); process.exitCode = 1; }
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'cert_review.json'), JSON.stringify({ at: new Date().toISOString(), secs: SECS, res }, null, 1));
  console.log('CERTREVIEW ' + JSON.stringify(res.map(r => ({ k: r.key, moved: r.loadDoor && r.loadDoor.moved, kept: r.slotDoor && r.slotDoor.kept, err: r.error || undefined }))));
  process.exit(process.exitCode || 0);
})();
