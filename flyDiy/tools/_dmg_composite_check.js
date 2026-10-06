#!/usr/bin/env node
// GATE DMGCOMPOSITE (G2047-G2049, DMG-COMPOSITE) - the composite build certifies, flies, and breaks as a laminate breaks
// (tools/_dmg_composite_lib.js; GEN_MATERIALS.glass, GEN_CRASH carbon / glass, 30_solver.js dmgMember / beamKink /
// beamYield, skin_break.js shellTear). Node only, damage ON (the build's own params.damage: true; the default stays off):
//   1. THE BUILD (builds/composite_jodel_2026-10-07.json): the validated Jodel's geometry in E-glass the garage's way - the
//      construction tile on glassfibre reaches spec.fuselage.material 'glass' and every surface 'as the aeroplane' is the
//      glass row; its members are glass but the steel bearer, its glue lines (the ribs, the box webs, the shell's
//      centreline, the cabin-to-tailcone joint) bonds
//   2. IT CERTIFIES (genCertify, GEN_CERT_V as it was): every laminate member brittle on the stamp (its yield IS its
//      break, crushed at once); the bench to the limit and to 1.2 x leaves NO set and breaks nothing; to the ultimate it
//      HELD; to destruction BROKE AT within [1.5, 1.5 m] x the limit (+2.5 %, GATE DMGCERT's band), the first member a
//      joint's; with the layer off every limit is infinite and nothing is stamped
//   3. IT FLIES: the pilot's circuit from HOME (ROLL .. LIFTOFF .. FINAL .. STOPPED) on the certificate's limits, nothing
//      yielded or broken
//   4. IT BREAKS BRITTLE: DMG-TUNE's standard crashes (the 3 m/s taxi, the nose-over, 30 m/s on the centreline and 2.5 m
//      out, the drop at 1.5 x FAR 23.473) - in every one NO laminate member set (yielded and not broken: a laminate has no
//      plastic range); the 30 m/s trunks break it into pieces (more than one piece off the core); the taxi and the drop
//      break no laminate member
//   5. THE SHELL CRACKS, IT NEVER STRETCHES: the generated skin over the 30 m/s centreline crash with skin_break.js's
//      records (shellTear): every frame from the first break, no live triangle's edge past (1 + SHELL_TEAR) x its rest +
//      SHELL_ABS (5 % + 1 cm against fabric's 15 %), every position finite; triangles removed on the breaks; the shell rides
//      more than one piece
//   6. DAMAGE OFF UNCHANGED: the validated Cub, Jodel and metal Cessna flown into the 30 m/s trunk with the layer off land
//      on the base's bytes (reports/evidence/DMG-COMPOSITE/off_ref.json: their hash on claude/dmg-tune 849058d8)
// Run: node tools/_dmg_composite_check.js            (one final `GATE DMGCOMPOSITE: PASS|FAIL`; the parts in children)
//      node tools/_dmg_composite_check.js --selftest (every check proven able to go red: doctored results, and the
//                                                     glass row made ductile, which the set check must catch)
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const REF = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-COMPOSITE', 'off_ref.json');
const OFFCASE = { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 };

if (argv[0] === '--part') {
  const M = require('./_dmg_composite_lib.js'), C = M.L.core(), what = argv[1];
  // (--ductile: the selftest's doctored glass row - a plastic range the set check must catch)
  if (argv.includes('--ductile')) Object.assign(C.GEN_CRASH.glass, { etu: 0.02, ecu: 0.03, thf: 0.3 });
  let out;
  if (what === 'card') out = M.card('composite');
  else if (what === 'fly') out = M.fly('composite');
  else if (what === 'crash') out = { crashes: argv[2].split(',').map(id => M.crash('composite', id)) };
  else if (what === 'skin') out = M.skin('composite', 'trunk0');
  else if (what === 'off') {
    const crypto = require('crypto');
    out = { hashes: {} };
    for (const k of ['cub', 'jodel', 'metal']) {
      M.L.atTrunk(k, Object.assign({ elastic: true }, OFFCASE));
      const sim = M.L.lastRun.sim, h = crypto.createHash('sha1');
      h.update(Buffer.from(Float64Array.from(sim.p).buffer)); h.update(Buffer.from(Float64Array.from(sim.v).buffer));
      out.hashes[k] = h.digest('hex').slice(0, 16);
    }
  }
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n', () => process.exit(0));
  return;
}

// ---- THE JUDGE: the checks over the parts' results (pure - the selftest doctors its input) ----
function judge(R, ref) {
  const out = [], yes = (id, ok, msg) => out.push({ id, ok: !!ok, msg });
  const c = R.card, s = c.sheet, lim = c.limit, bandHi = 1.5 * c.m * lim * 1.025;
  yes('build', s.material === 'glass' && s.wing === 'glass' && s.fin === 'glass' && s.stab === 'glass' && s.mats.glass > 300 && s.seams.bond > 0,
    'the build: fuselage ' + s.material + ', wing ' + s.wing + ', fin ' + s.fin + ', stab ' + s.stab + '; members ' + JSON.stringify(s.mats) + '; laminate seams ' + JSON.stringify(s.seams) +
    ' - ' + s.mass + ' kg, CG ' + s.cgMAC + ' % MAC, V_S ' + s.Vs + ' m/s');
  yes('brittle', c.lamN > 0 && c.brittle === c.lamN && c.ecu0 === c.lamN, 'every laminate member brittle on the stamp: ' + c.brittle + ' / ' + c.lamN + ' break at their yield, ' + c.ecu0 + ' crushed at once (ecu 0)');
  yes('off', c.offInf, 'with the layer off every limit is infinite and the certificate is not stamped');
  yes('lim', c.lim10.set === 0 && c.lim10.breaks === 0 && c.lim12.set === 0 && c.lim12.breaks === 0,
    'the bench to the limit (' + lim.toFixed(2) + ' g) and to 1.2 x: no set (' + c.lim10.set + ', ' + c.lim12.set + '), nothing broken (' + c.lim10.breaks + ', ' + c.lim12.breaks + ') - a laminate has no set past its limit');
  yes('ult', c.ultR.breaks === 0 && /HELD/.test(c.ultR.verdict) && c.ultR.set === 0, 'to the ultimate (' + c.ult.toFixed(2) + ' g): ' + c.ultR.verdict + ', ' + c.ultR.set + ' set, ' + c.ultR.breaks + ' broken');
  const d = c.destroy;
  yes('brokeAt', d.brokeAt != null && d.brokeAt >= 1.5 * lim && d.brokeAt <= bandHi && d.lamSet === 0,
    'BROKE AT ' + (d.brokeAt == null ? '-' : d.brokeAt.toFixed(2)) + ' g (' + d.brokeKey + ', ' + d.brokeSeam + ') within [' + (1.5 * lim).toFixed(2) + ', ' + bandHi.toFixed(2) + '] g; ' + d.lamSet + ' laminate members set on the way');
  yes('firstJoint', d.fb && (d.fb.seam || d.fb.mat === 'glass'), 'the first member broken: ' + (d.fb ? (d.fb.seam || 'a plain member') + ' (' + d.fb.cls + ' ' + d.fb.tags + ', ' + d.fb.mat + ', ' + d.fb.how + ')' : '-'));
  const f = R.fly, ph = f.phases || [];
  yes('flies', ph.indexOf('LIFTOFF') >= 0 && ph.indexOf('FINAL') > ph.indexOf('LIFTOFF') && ph[ph.length - 1] === 'STOPPED' && f.finite && f.yields === 0 && f.breaks === 0,
    'the circuit: ' + ph.join(' > ') + ' in ' + f.t + ' s, n_z max ' + f.nzMax + ', ' + f.yields + ' yields, ' + f.breaks + ' broken');
  const X = {}; for (const r of R.crashes) X[r.id] = r;
  const fmt = r => r.broken + ' broken (' + Object.entries(r.bySec).map(([a, b]) => a + ' ' + b).join(', ') + '), how ' + JSON.stringify(r.lamBySeam) + ', ' + r.lamSet + ' laminate set, pieces off: ' + (r.off.map(o => o.parts + ' ' + o.m + ' kg').join('; ') || '-');
  yes('noSet', R.crashes.length === 5 && R.crashes.every(r => r.lamSet === 0 && r.finite !== false),
    'no laminate member set and whole in any crash: ' + R.crashes.map(r => r.id + ' ' + r.lamSet).join(', ') + ' (a crushed one is broken at once)');
  yes('calm', X.taxi && X.hard && X.taxi.lamBroken === 0 && X.hard.lamBroken === 0, 'the 3 m/s taxi and the drop at 1.5 x FAR 23.473 break no laminate member: ' + (X.taxi ? X.taxi.lamBroken : '-') + ', ' + (X.hard ? X.hard.lamBroken : '-'));
  yes('pieces', X.trunk0 && X.trunk25 && X.trunk0.off.length >= 1 && X.trunk25.off.length >= 1 && X.trunk0.lamBroken > 0,
    'the 30 m/s trunks break it into pieces - centreline: ' + (X.trunk0 ? fmt(X.trunk0) : '-') + ' || 2.5 m out: ' + (X.trunk25 ? fmt(X.trunk25) : '-'));
  const k = R.skin;
  yes('shell', k.shell && !k.fabric && k.frames > 0 && k.excess <= 0 && k.finite && k.removed > 0 && k.shellPieces > 1,
    'the shell over the centreline crash (' + k.frames + ' frames broken, ' + k.tris + ' triangles): worst live edge ' + (k.excess > 0 ? '+' : '') + (1000 * k.excess).toFixed(1) +
    ' mm past 5 % + 1 cm (worst stretch x' + k.stretch + '), ' + k.removed + ' removed of which ' + k.torn + ' cracked, on ' + k.shellPieces + ' pieces');
  yes('offBytes', ref && R.off && ['cub', 'jodel', 'metal'].every(b => R.off.hashes[b] === ref.hashes[b]),
    'damage OFF: the Cub, the Jodel, the metal Cessna into the 30 m/s trunk on the base\'s bytes (' + (R.off ? JSON.stringify(R.off.hashes) : '-') + ' vs ' + (ref ? ref.base : '-') + ')');
  return out;
}

const { spawn } = require('child_process');
const child = args => new Promise(res => {
  const ch = spawn(process.execPath, [__filename, '--part'].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
  let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
  ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { err: se.slice(-1500) }); });
});
async function pool(jobs, n) {
  const out = new Array(jobs.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = i++; out[j] = await child(jobs[j]); } }));
  return out;
}
async function runAll(extra) {
  const jobs = [['card'], ['fly'], ['crash', 'taxi,noseover,hard'], ['crash', 'trunk0,trunk25'], ['skin'], ['off']].map(a => a.concat(extra || []));
  const P = await pool(jobs, +((argv.find(a => a.startsWith('--jobs=')) || '').slice(7) || 3));
  const err = P.find(p => p.err); if (err) { console.log(err.err); return null; }
  return { card: P[0], fly: P[1], crashes: P[2].crashes.concat(P[3].crashes), skin: P[4], off: P[5] };
}

(async () => {
  const t0 = Date.now(), ref = fs.existsSync(REF) ? JSON.parse(fs.readFileSync(REF, 'utf8')) : null;
  if (argv.includes('--selftest')) {
    // (a) a real run's results judged clean, then each check doctored red; (b) the glass row made ductile: the set checks
    const R = await runAll();
    if (!R) { console.log('GATE DMGCOMPOSITE: FAIL (selftest: a part died)'); process.exit(1); }
    const base = judge(R, ref), clean = base.every(x => x.ok);
    const J = () => JSON.parse(JSON.stringify(R));
    const DOC = {
      build: r => { r.card.sheet.wing = 'fabric'; }, brittle: r => { r.card.brittle--; }, off: r => { r.card.offInf = false; },
      lim: r => { r.card.lim12.set = 3; }, ult: r => { r.card.ultR.verdict = 'BROKE UP'; r.card.ultR.breaks = 4; },
      brokeAt: r => { r.card.destroy.brokeAt = 7.3; }, firstJoint: r => { r.card.destroy.fb = null; },
      flies: r => { r.fly.phases = ['ROLL']; }, noSet: r => { r.crashes[0].lamSet = 2; }, calm: r => { r.crashes.find(c => c.id === 'taxi').lamBroken = 5; },
      pieces: r => { r.crashes.find(c => c.id === 'trunk0').off = []; }, shell: r => { r.skin.excess = 0.08; },
      offBytes: r => { r.off.hashes.jodel = '0000000000000000'; },
    };
    const caught = [], missed = [];
    for (const id of Object.keys(DOC)) { const r = J(); DOC[id](r); const res = judge(r, ref); const x = res.find(q => q.id === id); (x && !x.ok && res.filter(q => !q.ok).length === 1 ? caught : missed).push(id); }
    const D = await pool([['crash', 'trunk0,noseover', '--ductile']], 1);
    const ductCaught = D[0].crashes && D[0].crashes.some(c => c.lamSet > 0);
    console.log('selftest: the real run ' + (clean ? 'clean' : 'NOT clean: ' + base.filter(x => !x.ok).map(x => x.id).join(', ')) + '; doctored red: ' + caught.length + ' / ' + Object.keys(DOC).length +
      (missed.length ? ' (missed ' + missed.join(', ') + ')' : '') + '; the glass row made ductile (etu 0.02, ecu 0.03, a fold): ' +
      (D[0].crashes ? D[0].crashes.map(c => c.id + ' ' + c.lamSet + ' set').join(', ') : 'ERR') + ' - ' + (ductCaught ? 'caught' : 'MISSED'));
    const ok = clean && !missed.length && ductCaught;
    console.log('GATE DMGCOMPOSITE: ' + (ok ? 'PASS' : 'FAIL') + ' (selftest, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
    process.exit(ok ? 0 : 1);
  }
  const R = await runAll();
  if (!R) { console.log('GATE DMGCOMPOSITE: FAIL (a part died)'); process.exit(1); }
  console.log('DMGCOMPOSITE - ' + R.card.sheet.k + ' (' + path.basename(require('./_dmg_composite_lib.js').BUILD) + '), damage on, the certificate stamped (' + (R.card.certMs / 1000).toFixed(0) + ' s, GEN_CERT_V ' + R.card.certV + ')');
  const res = judge(R, ref);
  for (const x of res) console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + '  ' + x.msg);
  for (const r of R.crashes) console.log('  REPORT  ' + r.id + ': ' + r.broken + ' broken, ' + (r.work / 1000).toFixed(1) + ' kJ of member work, steel set ' + r.steelSet + (r.crashed ? ', CRASHED (' + r.reason + ')' : '') + (r.back != null ? ', back ' + r.back.toFixed(2) + ' m' : ''));
  if (argv.includes('--out')) fs.writeFileSync(argv[argv.indexOf('--out') + 1], JSON.stringify(R, null, 1));
  const ok = res.every(x => x.ok);
  console.log('GATE DMGCOMPOSITE: ' + (ok ? 'PASS' : 'FAIL') + ' (' + res.filter(x => x.ok).length + '/' + res.length + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  process.exit(ok ? 0 : 1);
})();
