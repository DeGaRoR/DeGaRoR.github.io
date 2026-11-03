#!/usr/bin/env node
// ============================================================================
// GATE CERTGATES — certification gates the career's missions (CERT-GATES, the
// user 3 Nov: "you can fly an uncertified plane, but you cannot engage it in
// any mission in the story mode"; briefs/cert-gates-design-2026-11-03.md).
// ============================================================================
// What is held, in blocks:
//   THE NEED       contractCertNeed: every board job, the loan job, a client
//                  order, a timed competition, an authored contract that pays
//                  or carries -> COMMERCIAL; an unpaid empty flight ->
//                  AIRWORTHINESS; a shady job -> nothing.
//   THE PLANE      careerCertOf: a maker's airframe and the story's starter
//                  hold both until modified; a bench signature holds its
//                  tiers (a warn is a certificate) on ITS fingerprint only; a
//                  modified airframe or a new fingerprint holds none.
//   ACCEPT         a job is refused when no plane of the fleet holds what it
//                  needs (the words say which); accepted when one does; a
//                  shady job is accepted with no certificate at all; a client
//                  order is never refused at accept (its plane is built later).
//   THE STOP       a stop whose plane is not certified for a job moves nothing
//                  of it (no pick-up, no delivery) and the job STAYS accepted
//                  (B); the same stop certified moves it; a stop with no
//                  certificate facts (an older caller) is judged as before.
//   THE SAVE       procureOnSaveCert drops a signature a new f3 outgrew and
//                  keeps one signed on the build saved.
//   THE BENCH      careerSignOfBench: no current check -> nothing signed; the
//                  airworthiness held + a commercial fail -> safe only, the
//                  fails named (the fleet card's "(doors)").
//   SHADY          offered at most once per refresh, from the second refresh
//                  on, never after it crashed; never passengers; a parcel of
//                  5-20 kg, a survey or a ferry; a strip of 400 m or less on
//                  most; pays ECON_SHADY.payX the board's own pay for the same
//                  record; gains no reputation; a crash with one accepted
//                  fails it and costs every provider ECON_SHADY.crashRep.
//   THE PAGE       app.js signs at the bench's change and at the roll-out,
//                  hands the flying plane's certificate to the stop record,
//                  warns at the roll-out and the next leg; the fleet card
//                  draws careerCertLine.
//
//   node tools/_certgates_check.js             -> "GATE CERTGATES: PASS|FAIL"
//   node tools/_certgates_check.js --selftest  -> the core doctored one rule at a
//                  time (each must turn a check red), then the real run
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = path.join(__dirname, '..');
const CORE_PATH = path.join(__dirname, 'flight_core.js');
const SELF = process.argv.includes('--selftest');
const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
const MENU = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_menu.js'), 'utf8');

function loadCore(doctor) {
  let src = fs.readFileSync(CORE_PATH, 'utf8');
  if (doctor) { const s2 = doctor(src); if (s2 === src) throw new Error('the doctor changed nothing'); src = s2; }
  const m = new Module(CORE_PATH, module);
  m.filename = CORE_PATH; m.paths = Module._nodeModulePaths(__dirname);
  m._compile(src, CORE_PATH);
  return m.exports;
}

function run(C, app, menu, log) {
  const fails = [];
  const ok = (cond, what) => { if (!cond) fails.push(what); if (log) log((cond ? '  ok   ' : '  FAIL ') + what); };
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---- a career with one plane of its own, built on the board (no maker's certificate)
  const base = () => {
    const d = C.careerNew({ seed: 'certgates' });
    d.fleet.Mine = { hangar: null, aero: 'HOME' };
    d.career.airframes.Mine = { from: 'board', design: null, model: null, factory: false, modified: false, fp: 'F1', at: 0 };
    return C.careerRefresh(d);
  };
  const signed = (d, safe, comm, fp, why) => { d = clone(d); d.career.airframes.Mine.sign = { fp: fp || 'F1', safe, comm, when: 0, why: why || '' }; return C.careerRefresh(d); };
  const firstJob = d => d.career.contracts.offered.find(id => /^job:/.test(id));

  // THE NEED
  const d0 = base();
  const job = C.careerContract(d0, firstJob(d0));
  ok(!!job && C.contractCertNeed(job) === 'comm', 'need: a board job needs the commercial certificate (' + (job && job.id) + ')');
  const survey = (() => { for (const id of d0.career.contracts.offered) { const r = C.careerContract(d0, id); if (r && /^job:/.test(id) && C.contractSubsOf(r).some(s => s.do === 'survey')) return r; } return null; })();
  ok(!survey || C.contractCertNeed(survey) === 'comm', 'need: a board survey needs the commercial certificate (A)' + (survey ? '' : ' (none offered: skipped)'));
  ok(C.contractCertNeed(C.econLoanJob(d0, 'loan:field:1')) === 'comm', 'need: the Trust\'s loan job needs the commercial certificate');
  ok(C.contractCertNeed({ kind: 'build', stages: [], pay: {} }) === 'comm', 'need: a client order needs the commercial certificate');
  ok(C.contractCertNeed({ kind: 'mission', timers: [{}], stages: [], pay: {} }) === 'comm', 'need: a timed competition needs the commercial certificate');
  ok(C.contractCertNeed({ kind: 'mission', stages: [{ subs: [{ do: 'fly', from: 'HOME', to: 'w2' }] }], pay: { base: 0 } }) === 'safe', 'need: an unpaid empty flight needs the airworthiness certificate');
  ok(C.contractCertNeed({ kind: 'mission', stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w2', load: { kg: 0, pax: 1 } }] }], pay: { base: 0 } }) === 'comm', 'need: an unpaid flight with a passenger needs the commercial certificate');
  ok(C.contractCertNeed({ kind: 'job', shady: 'parcel', stages: [], pay: {} }) === null, 'need: a shady job needs nothing');

  // THE PLANE
  const of = A => C.careerCertOf(A);
  const both = c => c.safe && c.comm, none = c => !c.safe && !c.comm;
  ok(both(of({ factory: true, modified: false })), 'plane: a maker\'s airframe holds both');
  ok(none(of({ factory: false, modified: true })), 'plane: a modified airframe with no signature holds none');
  ok(both(of({ from: 'story', story: 'starter', factory: false, modified: false })), 'plane: the story\'s starter (pre-certified) holds both');
  ok(none(of({ from: 'story', story: 'starter', factory: false, modified: true })), 'plane: the story\'s starter modified holds none');
  ok(none(of({ from: 'story', story: 'client', factory: false, modified: false })), 'plane: the client\'s Cub holds none until its bench');
  ok(both(of({ sign: { fp: 'F1', safe: 'pass', comm: 'warn' } })), 'plane: a signature pass + warn holds both (a warn is a certificate)');
  const sf = of({ sign: { fp: 'F1', safe: 'warn', comm: 'fail', why: 'doors' } });
  ok(sf.safe && !sf.comm, 'plane: a signature with a commercial fail holds the airworthiness one only');
  ok(none(of({ sign: { fp: 'F1', safe: 'fail', comm: 'fail' } })), 'plane: a failed bench holds none');
  ok(none(C.careerCertOf({ sign: { fp: 'F1', safe: 'pass', comm: 'pass' } }, 'F2')), 'plane: a signature on another fingerprint holds none');
  ok(both(C.careerCertOf({ sign: { fp: 'F1', safe: 'pass', comm: 'pass' } }, 'F1')), 'plane: a signature on its own fingerprint holds both');
  ok(/commercial ✗ \(doors\)/.test(C.careerCertLine({ sign: { fp: 'F1', safe: 'pass', comm: 'fail', why: 'doors' } })), 'plane: the fleet card says "airworthy ✓ · commercial ✗ (doors)"');
  ok(/run the bench/.test(C.careerCertLine({ factory: false })), 'plane: the fleet card of an unsigned plane says "run the bench"');

  // THE BENCH
  ok(C.careerSignOfBench({ passed: true, comm: null }, 'F1') === null, 'bench: no current check signs nothing');
  const sg = C.careerSignOfBench({ passed: true, comm: { verdict: 'fail', fails: ['aid.doors'] } }, 'F1', 3);
  ok(sg && sg.safe === 'pass' && sg.comm === 'fail' && sg.why === 'doors' && sg.fp === 'F1', 'bench: held + a commercial fail signs safe only, "doors" named');
  const sg2 = C.careerSignOfBench({ passed: false, comm: { verdict: 'pass', fails: [] } }, 'F1');
  ok(sg2 && sg2.safe === 'fail' && sg2.comm === 'fail', 'bench: the airworthiness tests not held sign neither');
  const s1 = C.careerSign(d0, 'Mine', sg);
  ok(s1.ok && s1.doc.career.airframes.Mine.sign.fp === 'F1' && !d0.career.airframes.Mine.sign, 'bench: careerSign writes a clone');
  ok(C.careerSign(s1.doc, 'Mine', sg).doc === s1.doc, 'bench: the same signature leaves the same document');

  // ACCEPT
  const jid = firstJob(d0);
  const r0 = C.careerAccept(d0, jid);
  ok(!r0.ok && /commercial certificate/.test(r0.why) && /run the bench/.test(r0.why), 'accept: a job refused with no certified plane, the words name it (' + r0.why + ')');
  ok(C.careerAccept(signed(d0, 'pass', 'fail', 'F1', 'doors'), jid).ok === false, 'accept: an airworthy-only fleet is refused a board job');
  const dC = signed(d0, 'pass', 'pass');
  const r1 = C.careerAccept(dC, jid);
  ok(r1.ok, 'accept: a commercially certified plane takes the job');
  const dF = clone(d0); dF.career.airframes.Mine = { from: 'maker', factory: true, modified: false, fp: 'F1' };
  ok(C.careerAccept(C.careerRefresh(dF), jid).ok, 'accept: a maker\'s plane takes the job');
  const dE = clone(d0); delete dE.fleet.Mine; delete dE.career.airframes.Mine;
  ok(C.careerAccept(C.careerRefresh(dE), jid).ok, 'accept: a fleet with no plane at all (a new career before its voucher) is not refused');

  // THE STOP (B: the job kept)
  const D = r1.doc, rec = C.careerContract(D, jid), s0 = rec.stages[0].subs[0];
  const at = s0.do === 'carry' || s0.do === 'survey' || s0.do === 'fly' ? s0.from : s0.to;
  const stop = cert => C.careerStopRecord(Object.assign({ how: 'stopped', aero: at, slot: 'Mine', occupants: 1 + ((s0.load && s0.load.pax) || 0), cargoKg: (s0.load && s0.load.kg) || 0, hour: 12 }, cert ? { cert } : {}));
  const sN = C.contractOnStop(D, jid, stop({ safe: true, comm: false, why: 'no commercial certificate' }));
  ok(!sN.ok && /not certified for this job/.test(sN.why) && sN.doc === D && D.career.contracts.accepted.includes(jid), 'stop: an uncertified plane moves nothing, the job stays accepted (' + sN.why + ')');
  const sY = C.contractOnStop(D, jid, stop({ safe: true, comm: true, why: '' }));
  const sL = C.contractOnStop(D, jid, stop(null));
  ok(sY.ok === sL.ok && sY.why === sL.why, 'stop: a certified plane is judged exactly as a stop with no certificate facts (' + (sY.ok ? 'moved' : sY.why) + ')');
  ok(!!C.careerStopRecord({ cert: { safe: 1, comm: 0 } }).cert && C.careerStopRecord({}).cert === undefined, 'stop: the record carries the certificate only when handed one');
  const oN = C.careerOnStop(D, stop({ safe: false, comm: false, why: 'x' }));
  ok(oN.doc.career.contracts.accepted.includes(jid), 'stop: careerOnStop keeps the job accepted (B)');

  // THE SAVE
  if (typeof C.procureOnSave === 'function' && typeof C.procureFp === 'function') {
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8'));
    const S = spec.spec || spec, fpA = C.procureFp(S);
    const S2 = clone(S); S2.wing = Object.assign({}, S2.wing || {}, { span: ((S2.wing && S2.wing.span) || 10) + 0.7 });
    const fpB = C.procureFp(S2);
    const dd = clone(d0); dd.career.airframes.Mine.fp = fpA; dd.career.airframes.Mine.sign = { fp: fpA, safe: 'pass', comm: 'pass' };
    const v1 = C.procureOnSave(dd, 'Mine', S2, null);
    ok(fpA !== fpB && v1.ok && !v1.doc.career.airframes.Mine.sign, 'save: a new f3 drops the signature');
    const dd2 = clone(dd); dd2.career.airframes.Mine.sign.fp = fpB;
    const v2 = C.procureOnSave(dd2, 'Mine', S2, null);
    ok(v2.ok && v2.doc.career.airframes.Mine.sign && v2.doc.career.airframes.Mine.sign.fp === fpB, 'save: a signature on the saved build is kept');
  } else ok(false, 'save: procureOnSave / procureFp not in the core');

  // SHADY
  const at0 = C.econShadyOffer(d0);
  ok(at0 === null && !d0.career.contracts.offered.some(id => /^shady:/.test(id)), 'shady: none at the first refresh (epoch 0)');
  const later = n => { const d = clone(d0); for (let i = 0; i < n; i++) d.career.contracts.done.push({ id: 'x' + i, at: 0, pay: 0 }); return C.careerRefresh(d); };
  const kinds = {}, X = C.ECON_SHADY;
  let short = 0, all = 0, night = 0, payOk = true, paxNone = true, kgOk = true, gain0 = true, onePer = true;
  for (let e = 1; e <= 40; e++) {
    const d = later(e * 3);
    const ids = d.career.contracts.offered.filter(id => /^shady:/.test(id));
    if (ids.length !== 1) onePer = false;
    const r = ids.length ? C.careerContract(d, ids[0]) : null;
    if (!r) continue;
    all++; kinds[r.shady] = (kinds[r.shady] || 0) + 1;
    const subs = C.contractSubsOf(r);
    if (subs.some(s => s.load && s.load.pax > 0)) paxNone = false;
    for (const s of subs) if (s.load && (s.load.kg < X.kg[0] || s.load.kg > X.kg[1])) kgOk = false;
    if (subs.some(s => ['to', 'at'].some(k => s[k] && C.CONTRACT_FIELDS[s[k]] && C.CONTRACT_FIELDS[s[k]].len <= X.shortM))) short++;
    if (r.night) night++;
    if (r.rep.gain !== 0) gain0 = false;
    const plain = clone(r); delete plain.shady; plain.pay = { base: 0 };
    const want = Math.round(C.contractPay(plain).total * X.payX / C.CONTRACT_PAY.round) * C.CONTRACT_PAY.round;
    if (r.pay.total !== want || C.contractPayTotal(r, {}, null) !== want) payOk = false;
  }
  ok(onePer && all === 40, 'shady: exactly one per refresh from the second (' + all + '/40)');
  ok(paxNone, 'shady: never a passenger');
  ok(kgOk, 'shady: a parcel weighs ' + X.kg[0] + '-' + X.kg[1] + ' kg');
  ok(Object.keys(kinds).every(k => ['parcel', 'survey', 'ferry'].includes(k)) && Object.keys(kinds).length === 3, 'shady: a parcel, a survey, a ferry (' + JSON.stringify(kinds) + ')');
  ok(short >= all * 0.5, 'shady: leans to the short strips (' + short + '/' + all + ' to a strip of ' + X.shortM + ' m or less)');
  ok(payOk, 'shady: pays ' + X.payX + 'x the board\'s pay for the same record');
  ok(gain0, 'shady: no reputation');
  const dS = later(3), sid = dS.career.contracts.offered.find(id => /^shady:/.test(id));
  const aS = C.careerAccept(dS, sid);
  ok(aS.ok, 'shady: accepted with no certified plane');
  if (aS.ok) {
    const A = aS.doc, rs = C.careerContract(A, sid), u = rs.stages[0].subs[0];
    const st0 = C.careerStopRecord({ how: 'stopped', aero: u.from || u.to, slot: 'Mine', occupants: 1, cargoKg: (u.load && u.load.kg) || 0, hour: 12, cert: { safe: false, comm: false, why: 'x' } });
    const m = C.contractOnStop(A, sid, st0);
    ok(m.ok || !/not certified/.test(m.why), 'shady: an uncertified plane is not refused at the stop (' + (m.ok ? 'moved' : m.why) + ')');
    const before = {}; for (const p of Object.keys(A.career.providers)) { A.career.providers[p].rep = 2; before[p] = 2; }
    const cr = C.careerOnStop(A, C.careerStopRecord({ how: 'crashed', wrecked: true, slot: 'Mine' }));
    const P = cr.doc.career.providers;
    ok(cr.ok && !cr.doc.career.contracts.accepted.includes(sid) && Object.keys(P).every(p => Math.abs(P[p].rep - (2 - X.crashRep)) < 1e-9),
       'shady: a crash fails it and costs every provider ' + X.crashRep);
    ok(!C.careerRefresh(cr.doc).career.contracts.offered.includes(sid), 'shady: a crashed one is not offered again');
  }

  // THE PAGE
  ok(/careerSignNow\(\)/.test(app) && /function careerSignNow/.test(app), 'page: app.js signs (careerSignNow)');
  ok(/function syncGoLabel\(\) \{[^]*?careerSignNow\(\)/.test(app), 'page: the bench\'s change signs (syncGoLabel)');
  ok(/routesRollRefused\(\)\) return;[^\n]*\n\s*if \(CAREER_DEV\) \{ careerSignNow\(\); careerCertWarn\(\); \}/.test(app), 'page: the roll-out signs and warns');
  ok(/function nextLeg\(\) \{[^]*?careerCertWarn\(true\)/.test(app), 'page: the next leg warns');
  ok(/careerStopRecord\(\{[^]*?cert: careerFlightCert\(\)/.test(app), 'page: the stop record carries the flying plane\'s certificate');
  ok(/BENCH_FP_OUT/.test((app.match(/function careerFlightCert\(\) \{[^]*?\n  \}/) || [''])[0]), 'page: the flying plane is judged on the roll-out\'s fingerprint');
  ok(/certLine/.test(menu) && /f\.certLine/.test(menu), 'page: the fleet card draws the certificate line');
  return fails;
}

if (SELF) {
  const DOCTORS = [
    ['the need: a board job needs nothing', s => s.replace("if (rec.shady) return null;", "if (rec.shady || rec.kind === 'job') return null;")],
    ['the plane: a modified maker\'s plane keeps its certificate', s => s.replace("if (!A.modified && (A.factory ||", "if ((A.factory ||")],
    ['the plane: any fingerprint holds', s => s.replace("if (fp != null && fp !== S.fp)", "if (false)")],
    ['accept: no refusal', s => s.replace("if (need && rec.kind !== 'build' && !careerFleetHolds(doc, need))", "if (false)")],
    ['the stop: no refusal', s => s.replace("if (need && stop.cert && !stop.cert[need])", "if (false)")],
    ['the save: the signature kept on a new f3', s => s.replace("if (R.sign && R.sign.fp !== fp) delete R.sign;", "")],
    ['shady: pays the board rate', s => s.replace("P.total * ECON_SHADY.payX", "P.total * 1")],
    ['shady: a passenger', s => s.replace("load: { kg: ctDraw(rng, ECON_SHADY.kg[0], ECON_SHADY.kg[1], 1, 1), pax: 0 }", "load: { kg: ctDraw(rng, ECON_SHADY.kg[0], ECON_SHADY.kg[1], 1, 1), pax: 1 }")],
    ['shady: no crash loss', s => s.replace("P.rep = Math.max(0, +((P.rep || 0) - ECON_SHADY.crashRep).toFixed(3));", "")],
    ['shady: offered at the first refresh', s => s.replace("if (e < ECON_SHADY.fromEpoch) return null;", "")],
  ];
  let bad = 0;
  for (const [what, doc] of DOCTORS) {
    let red;
    try { red = run(loadCore(doc), APP, MENU, null).length > 0; } catch (e) { red = /the doctor changed nothing/.test(e.message) ? null : true; }
    console.log('  selftest ' + what + ': ' + (red === null ? 'NOT APPLIED' : red ? 'red (ok)' : 'GREEN (bad)'));
    if (!red) bad++;
  }
  const pageDoc = [['the page: no sign at the roll-out', APP.replace('if (CAREER_DEV) { careerSignNow(); careerCertWarn(); }', ''), MENU],
                   ['the page: no certificate at the stop', APP.replace('cert: careerFlightCert()', ''), MENU],
                   ['the page: no fleet card line', APP, MENU.replace(/f\.certLine/g, 'f.x')]];
  for (const [what, a, m] of pageDoc) {
    const red = (a === APP && m === MENU) ? null : run(loadCore(null), a, m, null).length > 0;
    console.log('  selftest ' + what + ': ' + (red === null ? 'NOT APPLIED' : red ? 'red (ok)' : 'GREEN (bad)'));
    if (!red) bad++;
  }
  if (bad) { console.log('GATE CERTGATES: FAIL (' + bad + ' selftest(s) did not turn red)'); process.exit(1); }
}
const fails = run(loadCore(null), APP, MENU, console.log);
console.log(fails.length ? 'GATE CERTGATES: FAIL (' + fails.length + ')' : 'GATE CERTGATES: PASS');
process.exit(fails.length ? 1 : 0);
