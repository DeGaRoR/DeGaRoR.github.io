#!/usr/bin/env node
// _aids_check.js — GATE AIDS (DESIGN-AIDS, the user 3 Nov): the garage's design aids and the certificate's tiers read
// the same numbers, say the right thing on the user's own twin, size their remedies from the model, and tier as the user
// ruled (3 Nov: D1 the float step, the float reserve and the prop clearance refuse; D3 the elevator and the flare are
// commercial; D5 a float build's take-off is the hydroplane test's).
//
//   THE TWIN (_2)   the user's twin-boom pusher on floats as first built (tools/fixtures/aids/twin_busher_floats_2.json,
//                   a copy of builds/candidates/review/Twin_busher_floats_2.json): unstable (pitch.sm fails, safe tier),
//                   the step AHEAD of the CG (aid.step fails, safe: it refuses - D1), the floats under
//                   1.8 x, the prop near the flaps down; the first key issue is the margin and its remedy is sized by the
//                   rebuilt levers (the wing aft 0.35-0.8 m: the user moved it 0.45 m and swept the tips); the floats
//                   moved by the aid's own number land the step inside its band
//   CORNERS         the aids' loading corners (the ledger's arithmetic) against genShakedown's envelope (four rebuilds)
//                   on the Cub: every corner's CG within 3 % of the chord
//   TIERS           a tail-volume fail alone no longer withholds the airworthiness certificate (commercial); the
//                   elevator and the flare are commercial (D3); the promoted rows refuse (D1); a float build's circuit is
//                   its climb (D5: benchCircuit)
//   UI              the quick bar has the indicators' button and no reference-cut button; the menu carries the nine aids
//                   and the reference item; the bench's key-issue card renders the remedy
//
//   node tools/_aids_check.js   (~40 s)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const BJ = require('./_bake_joined.js');
BJ.loadPanel();
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); };
const rd = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec || j; };
// the joined spec and the drawn discs' offsets (the editor's engine record, CAGE_ENG, off the same bake)
let PO = null;
const joined = f => { const B = BJ.bakeJoined(rd(f)); PO = C.genAidPropOff(B.W && B.W.CAGE_ENG); return B.spec; };
const r2 = v => Math.round(v * 100) / 100;

console.log('THE TWIN (_2): what would have helped');
const J2 = joined('tools/fixtures/aids/twin_busher_floats_2.json');
const PO2 = PO, def2 = C.buildGen(J2), sh2 = C.genShakedown(def2, { corners: false }), A2 = C.genDesignAids(def2, sh2, { propOff: PO2 });
const row = (rows, id) => rows.find(r => r.id === id) || {};
const all2 = sh2.design.rows.concat(A2.rows);
ok(row(all2, 'pitch.sm').level === 'fail' && C.genCertTierOf('pitch.sm') === 'safe' && row(all2, 'pitch.sm').tier === undefined, `pitch.sm ${row(all2, 'pitch.sm').level} (${row(all2, 'pitch.sm').value}), safe tier (GEN_CERT_TIER; the sheet's rows carry no tier: master's bytes)`);
const st = row(A2.rows, 'aid.step');
ok(st.level === 'fail' && !st.proposed && C.genCertTierOf('aid.step') === 'safe' && A2.floats.ang < 0 && A2.floats.moveX > 0.3 && A2.floats.moveX < 0.6,
   `aid.step: the step ${r2(A2.floats.ang)} deg (ahead of the CG) -> ${st.fix}`);
ok(row(A2.rows, 'aid.reserve').level === 'fail' && A2.floats.reserve < 1.8, `aid.reserve: ${r2(A2.floats.reserve)} x -> ${row(A2.rows, 'aid.reserve').fix}`);
ok(A2.prop[0] && A2.prop[0].struct != null && A2.prop[0].struct < 0.1 && A2.prop[0].flapsDown, `aid.prop: ${r2(A2.prop[0].struct)} m from ${A2.prop[0].who}`);
ok(A2.lift.length === 2 && A2.lift[0].share > 0.7, 'the lift: wing ' + r2(A2.lift[0].share) + ' of the area at x ' + r2(A2.lift[0].x) + ', stab at ' + r2(A2.lift[1].x));
ok(A2.thrust[0].dy > 0 && A2.thrust[0].Mup < 0, `the thrust line ${r2(A2.thrust[0].dy)} m above the CG: nose-down ${Math.round(-A2.thrust[0].Mup)} N m`);
const T2 = C.genCertTiers(all2);
ok(T2.safe === 'fail' && ['pitch.sm', 'aid.step', 'aid.reserve', 'aid.prop'].every(id => T2.safeFail.some(r => r.id === id)) && T2.comm === 'fail', `tiers: airworthiness ${T2.safe} (${T2.safeFail.map(r => r.id).join(', ')}), commercial ${T2.comm}`);
const K = C.genKeyIssues(def2, sh2, A2, { spec: J2 });
const k0 = K[0] || {}, mW = /wing aft ~([\d.]+) m/.exec(k0.remedy || '');
// AERO-BODY re-pin (PHYSICS_V 8): the pod now closes at its drawn end - the phantom fuselage behind it is gone (-8.4 kg,
// the aft cross-flow 1.31 -> 0.19 m2, the booms' own 0.93 m2), so the NP moves 0.068 m aft and the margin -0.162 -> -0.108:
// the remedy 0.547 -> 0.404 m, written '~0.4'. The band was 0.4-0.8 around the user's 0.45 m; it is 0.35-0.8 (the user's
// move still covers the model's need; above 0.8 or under 0.35 is still a wrong-sized remedy)
ok(k0.id === 'pitch.sm' && mW && +mW[1] >= 0.35 && +mW[1] < 0.8, `key issue 1: ${k0.title} -> ${k0.remedy}`);
ok(K.length >= 3 && K.length <= 5 && K.some(k => k.id === 'aid.step'), 'key issues: ' + K.map(k => k.id).join(', '));
{
  const S = JSON.parse(JSON.stringify(J2)); S.gear.floats.x += A2.floats.moveX;
  const d = C.buildGen(S), A = C.genDesignAids(d, C.genShakedown(d, { corners: false, slim: true }), { propOff: PO2 });
  ok(Math.abs(A.floats.ang - 12) < 2.5 && row(A.rows, 'aid.step').level === 'pass', `the floats moved ${r2(A2.floats.moveX)} m aft: the step ${r2(A.floats.ang)} deg (pass)`);
}
console.log('CORNERS: the ledger against the envelope');
{
  const J = joined('builds/cub_2026-09-20_corrected.json'), d = C.buildGen(J), sh = C.genShakedown(d, {}), A = C.genDesignAids(d, sh, { propOff: PO });
  const E = sh.envelope.corners, Cc = A.range.corners;
  const worst = Math.max(...E.map((e, i) => Math.abs(e.cgX - Cc[i].cgX) / sh.cBar));
  ok(worst < 0.03, 'the Cub: every corner within ' + (worst * 100).toFixed(1) + ' % of the chord (' + E.map((e, i) => e.label + ' ' + r2(e.cgX) + '/' + r2(Cc[i].cgX)).join(', ') + ')');
  const Tc = C.genCertTiers(sh.design.rows.concat(A.rows));
  ok(Tc.safe !== 'fail', 'the Cub: airworthiness ' + Tc.safe + ', commercial ' + Tc.comm + (Tc.warns.length ? ' (' + Tc.warns.map(r => r.id).join(', ') + ')' : ''));
  console.log('TIERS: as the user ruled');
  const S = JSON.parse(JSON.stringify(J)); S.tail.Sv *= 0.3;
  const d2 = C.buildGen(S), s2 = C.genShakedown(d2, { corners: false }), rows = s2.design.rows;
  const vv = row(rows, 'yaw.Vv'), T = C.genCertTiers(rows), safeIds = T.safeFail.map(r => r.id);
  ok(vv.level === 'fail' && C.genCertTierOf('yaw.Vv') === 'comm' && safeIds.indexOf('yaw.Vv') < 0 && T.comm === 'fail',
     `the Cub's fin at 30 %: yaw.Vv ${vv.level} is commercial; airworthiness ${T.safe}${safeIds.length ? ' (on ' + safeIds.join(', ') + ')' : ''}`);
  // every row the old rule failed on still fails the commercial one; of the design check's own rows, the airworthiness
  // fails are a subset of the old (the design check only relaxes; the aids' promoted rows are the only new refusals)
  const oldFail = rows.filter(r => r.level === 'fail').map(r => r.id);
  ok(safeIds.every(id => oldFail.indexOf(id) >= 0) && T.commFail.length === oldFail.length, 'the design check\'s safe fails are a subset of the old fails (' + oldFail.join(', ') + ')');
  ok(C.genCertTierOf('ctl.elevator') === 'comm' && C.genCertTierOf('ctl.flare') === 'comm' && C.genCertTierOf('pitch.Vh') === 'comm',
     'D3: the elevator at the forward CG and the flare are commercial (the tail volumes too)');
  const B0 = require('../src/viewer/bench.js');
  const s4b = { climbRate: 5.68, TORun: 1134, flyableCircuit: false };
  ok(B0.benchCircuit(s4b, true).flies && !B0.benchCircuit(s4b, false).flies && !B0.benchCircuit({ climbRate: 0.2, TORun: 400, flyableCircuit: false }, true).flies,
     'D5: _4b\'s sheet (climb 5.68 m/s, take-off 1134 m) flies a circuit on floats (the hydroplane test judges the take-off), not on wheels');
}
console.log('UI');
{
  const ed = fs.readFileSync(path.join(ROOT, 'src/viewer/editor.js'), 'utf8');
  const q = ed.slice(ed.indexOf('const QUICK = ['), ed.indexOf('const QVIEWS'));
  ok(/\{ k: 'aids'/.test(q) && !/\{ k: 'ref'/.test(q), "the quick bar: the indicators' button, no reference-cut button");
  ok(/function aidsMenuInto/.test(ed) && /cycleCut/.test(ed.slice(ed.indexOf('function aidsMenuInto'))), "the menu carries the reference's cut");
  const app = fs.readFileSync(path.join(ROOT, 'src/viewer/app.js'), 'utf8');
  const keys = /var AID_KEYS = (\[[\s\S]*?\]);/.exec(app);
  const K9 = keys ? (keys[1].match(/\['(\w+)'/g) || []).map(s => s.slice(2, -1)) : [];
  ok(['cg', 'lift', 'thrust', 'floats', 'range', 'tails', 'prop', 'stance', 'doors'].every(k => K9.indexOf(k) >= 0), 'the aids: ' + K9.join(', '));
  ok(/AID_PREF = 'flydiy\.aids'/.test(app), 'the toggles persist (flydiy.aids)');
  const B = require('../src/viewer/bench.js');
  const h = B.benchKeyHtml({ key: K });
  ok(h.indexOf('wing aft') > 0 && h.indexOf('not safe to fly') > 0 && (h.match(/not safe to fly/g) || []).length >= 4, 'the key-issue card renders the remedy and the tiers (the margin and the three promoted rows: not safe to fly)');
}
console.log(`GATE AIDS: ${fails ? 'FAIL' : 'PASS'}`);
process.exit(fails ? 1 : 0);
