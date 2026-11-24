#!/usr/bin/env node
// _aids_check.js — GATE AIDS (DESIGN-AIDS, the user 3 Nov): the garage's design aids and the certificate's tiers read
// the same numbers, say the right thing on the user's own twin, size their remedies from the model, and tier as the user
// ruled (3 Nov: D1 the float step, the float reserve and the prop clearance refuse; D3 the elevator and the flare are
// commercial; D5 a float build's take-off is the hydroplane test's).
//
//   THE TWIN (_2)   the user's twin-boom pusher on floats as first built (tools/fixtures/test_copies/Twin_busher_floats_2.json,
//                   a copy of tools/fixtures/test_copies/Twin_busher_floats_2.json): unstable (pitch.sm fails, safe tier),
//                   the step AHEAD of the CG (aid.step fails, safe: it refuses - D1), the floats under
//                   1.8 x, the prop near the flaps down; the first key issue is the margin and its remedy is sized by the
//                   rebuilt levers (the wing aft 0.4-0.8 m: the user moved it 0.45 m and swept the tips); the floats
//                   moved by the aid's own number land the step inside its band
//   CORNERS         the aids' loading corners (the ledger's arithmetic) against genShakedown's envelope (four rebuilds)
//                   on the Cub: every corner's CG within 3 % of the chord
//   TIERS           a tail-volume fail alone no longer withholds the airworthiness certificate (commercial); the
//                   elevator and the flare are commercial (D3); the promoted rows refuse (D1); a float build's circuit is
//                   its climb (D5: benchCircuit)
//   PROP DISCS      (LAZAIR-TWIN, 24 Nov) the user's Lazair (two engines on the wing): two discs mirrored at the frame's
//                   engines, each the drawn blade's radius, square to its axis, every disc judged; moved in until they
//                   meet, a fail that sizes the spacing; its nose wheel a bumper (it rests on the V tips). The user's
//                   Minimax (one nose tractor): the disc at the drawn hub and radius, clear as built, a smaller drawn prop
//                   never fails, a disc grown into the ground fails
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
const J2 = joined('tools/fixtures/test_copies/Twin_busher_floats_2.json');
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
ok(k0.id === 'pitch.sm' && mW && +mW[1] > 0.4 && +mW[1] < 0.8, `key issue 1: ${k0.title} -> ${k0.remedy}`);
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
console.log('PROP DISCS: every disc where it is drawn, in its own plane (LAZAIR-TWIN, 24 Nov)');
{
  // THE RULE, ON EVERY KIND (the user: "The prop check fix should be generic"): a nose tractor (the Cub, the metal
  // Cessna), the twin on floats (a wing pair), the twin-boom pusher on floats (_2), the user's Lazair (a pair on a hung
  // wing) and Minimax (a nose tractor) - one disc per powered engine, each at its engine's drawn hub (the station + the
  // editor's own hub offset), its radius the drawn blade's, square to its axis, a wing pair on its own sides (at the
  // frame's engine nodes), every disc judged and the row the worst
  const CASES = [['the Cub', 'builds/cub_2026-09-20_corrected.json'], ['the metal Cessna', null],
                 ['the twin on floats', null], ['the twin-boom pusher (_2)', 'tools/fixtures/test_copies/Twin_busher_floats_2.json'],
                 ['the Lazair', 'tools/fixtures/lazair_user_2026-11-24.json'], ['the Minimax', 'tools/fixtures/minimax_derived_2026-11-24.json']];
  const LBv = require('./_load_build.js').VALIDATED;
  CASES[1][1] = LBv.metal && LBv.metal.build; CASES[2][1] = LBv.twinFloats && LBv.twinFloats.build;
  for (const [lab, file] of CASES) {
    if (!file) { ok(false, lab + ': no build file'); continue; }
    const J = joined(file), Pd = PO, d = C.buildGen(J), A = C.genDesignAids(d, C.genShakedown(d, { corners: false, slim: true }), { propOff: Pd });
    const live = (J.engines || []).filter(e => !e.none).length, at = d.spec.engAt || [];
    const engZ = k => { const I = d.refs.engine || [], K = d.refs.engineOf || I.map(() => 0); let z = 0, n = 0; for (let j = 0; j < I.length; j++) if (K[j] === k) { z += d.nodes[I[j]].p[2]; n++; } return n ? z / n : NaN; };
    const bad = [];
    A.prop.forEach((q, i) => {
      const o = Pd && Pd[i], e = at[i] || {};
      if (!o) bad.push(i + ': not drawn');
      else {
        if (Math.abs(q.at[0] - (e.x + o[0])) > 1e-9 || Math.abs(q.at[1] - (e.y + o[1])) > 1e-9) bad.push(i + ': off the drawn hub');
        if (o[2] > 0 && Math.abs(q.R - o[2]) > 1e-9) bad.push(i + ': not the drawn radius');
      }
      if (Math.abs(Math.hypot(...q.dir) - 1) > 1e-9) bad.push(i + ': no axis');
      if (e.mount === 'wing' && !(Math.sign(q.at[2]) === Math.sign(engZ(i)) && Math.abs(q.at[2] - engZ(i)) < 0.25)) bad.push(i + ': not on its own side (z ' + r2(q.at[2]) + ', its engine ' + r2(engZ(i)) + ')');
      if (!q.level) bad.push(i + ': not judged');
    });
    const pr = row(A.rows, 'aid.prop'), RK = { pass: 0, warn: 1, fail: 2 }, worst = A.prop.reduce((w, q) => RK[q.level] > RK[w] ? q.level : w, 'pass');
    ok(A.prop.length === live && !bad.length && pr.level === worst,
       `${lab}: ${A.prop.length} disc(s) for ${live} engine(s), ${A.prop.map(q => (q.side < 0 ? 'port ' : q.side > 0 ? 'stbd ' : '') + 'R ' + r2(q.R) + ' at [' + q.at.map(r2).join(', ') + '] ' + q.level).join('; ')} -> aid.prop ${pr.level}${bad.length ? ' - ' + bad.join(', ') : ''}`);
  }
}
{
  // THE USER'S LAZAIR (tools/fixtures/lazair_user_2026-11-24.json): two pushers' engines on the wing (engines[] stores
  // both at |z| 0.952, the frame mirrors them by side). The marker drew one disc over the other: both stood at +z
  const J = joined('tools/fixtures/lazair_user_2026-11-24.json'), PL = PO, d = C.buildGen(J);
  const A = C.genDesignAids(d, C.genShakedown(d, { corners: false, slim: true }), { propOff: PL });
  const eL = d.nodes.find(n => n.tag === 'ENGL'), eR = d.nodes.find(n => n.tag === 'ENGR');
  const D0 = A.prop[0] || {}, D1 = A.prop[1] || {};
  ok(A.prop.length === 2 && D0.at && D1.at && Math.abs(D0.at[2] + D1.at[2]) < 1e-9 && Math.abs(D0.at[0] - D1.at[0]) < 1e-9 && Math.abs(D0.at[1] - D1.at[1]) < 1e-9 &&
     eL && eR && Math.abs(D0.at[2] - eL.p[2]) < 1e-6 && Math.abs(D1.at[2] - eR.p[2]) < 1e-6,
     `the Lazair: two discs, mirrored at the frame's engines (port z ${r2(D0.at && D0.at[2])} at ENGL ${r2(eL && eL.p[2])}, starboard ${r2(D1.at && D1.at[2])} at ENGR ${r2(eR && eR.p[2])})`);
  ok(PL && PL.length === 2 && PL.every(o => o && o[2] > 0) && Math.abs(D0.R - PL[0][2]) < 1e-9 && Math.abs(D1.R - PL[1][2]) < 1e-9 && D0.drawn && D1.drawn,
     `the Lazair: each disc's radius the drawn blade's (${r2(D0.R)} / ${r2(D1.R)} m, the editor's ${PL ? PL.map(o => o && r2(o[2])).join(' / ') : 'none'})`);
  ok([D0, D1].every(q => q.dir && q.dir[0] === -1 && q.dir[1] === 0 && q.dir[2] === 0),
     'the Lazair: each disc square to its own thrust axis (no tilt: the y-z plane)');
  const pr = row(A.rows, 'aid.prop'), worst = A.prop.reduce((w, q) => (q.level === 'fail' || (q.level === 'warn' && w !== 'fail')) ? q.level : w, 'pass');
  ok(pr.level === worst && A.prop.every(q => q.level), `the Lazair: aid.prop judges every disc (${A.prop.map(q => q.level).join(', ')} -> ${pr.level}): ${pr.why}`);
  // the stance: the user's nose wheel is a bumper - the Lazair rests on its mains and the V tips' wheels
  const sr = row(A.rows, 'aid.stance');
  ok(A.stance && A.stance.bumper && !A.stance.trike && sr.level !== 'fail' && /bumper/.test(sr.why || ''),
     `the Lazair: the stance a taildragger's on its tips, the nose wheel a bumper (${sr.level}: ${sr.why})`);
  // the pair moved in until the discs' circles meet (0.4 m either side of the centreline, 1.05 m discs): a fail that
  // names the other disc and sizes the spacing
  const S2 = JSON.parse(JSON.stringify(J)); for (const e of S2.engines) e.z = 0.4;
  const d2 = C.buildGen(S2), A3 = C.genDesignAids(d2, C.genShakedown(d2, { corners: false, slim: true }), { propOff: PL }), p3 = row(A3.rows, 'aid.prop');
  ok(p3.level === 'fail' && A3.prop.every(q => q.discOver != null) && /apart centre to centre/.test(p3.fix) && /disc/.test(p3.why),
     `the Lazair, the nacelles 0.4 m out: the discs meet (fail) -> ${p3.fix}`);
  // the pair moved out to 0.62 m: the discs clear each other; the fuselage in the disc's circle is said with its own fix
  const S3 = JSON.parse(JSON.stringify(J)); for (const e of S3.engines) e.z = 0.62;
  const d3 = C.buildGen(S3), A4 = C.genDesignAids(d3, C.genShakedown(d3, { corners: false, slim: true }), { propOff: PL });
  ok(A4.prop.every(q => q.discOver == null), `the Lazair, the nacelles 0.62 m out: the discs clear each other (${A4.prop.map(q => q.level + (q.who ? ' ' + q.who : '')).join(', ')})`);
}
{
  // THE USER'S MINIMAX (tools/fixtures/minimax_derived_2026-11-24.json, the spec of the user's 24 Nov build): one nose
  // tractor, the drawn prop the cowl page's (cw_propD 1.72) - the disc at the drawn hub, its radius the drawn one
  const J = joined('tools/fixtures/minimax_derived_2026-11-24.json'), PM = PO, d = C.buildGen(J);
  const sh = C.genShakedown(d, { corners: false, slim: true });
  const A = C.genDesignAids(d, sh, { propOff: PM }), D0 = A.prop[0] || {}, pr = row(A.rows, 'aid.prop');
  ok(A.prop.length === 1 && D0.drawn && PM && PM[0] && Math.abs(D0.R - PM[0][2]) < 1e-9 && Math.abs(D0.R - 0.86) < 0.01 && D0.at[2] === 0,
     `the Minimax: one disc on the centreline at the drawn hub (x ${r2(D0.at && D0.at[0])}, y ${r2(D0.at && D0.at[1])}), its radius the drawn ${r2(D0.R)} m`);
  ok(pr.level !== 'fail', `the Minimax as built: the prop clears (${pr.level}: ${pr.why})`);
  // a smaller drawn propeller never fails where the larger one cleared; a disc grown into the ground fails
  const small = C.genDesignAids(d, sh, { propOff: PM.map(o => o && [o[0], o[1], 0.5]) }), ps = row(small.rows, 'aid.prop');
  ok(ps.level === 'pass' || (ps.level === pr.level && pr.level !== 'fail'), `the Minimax, a 1.0 m drawn propeller: ${ps.level} (${ps.why})`);
  const gH = D0.ground != null ? D0.ground : 0, big = C.genDesignAids(d, sh, { propOff: PM.map(o => o && [o[0], o[1], D0.R + gH + 0.1]) }), pb = row(big.rows, 'aid.prop');
  ok(pb.level === 'fail' && big.prop[0].ground < 0 && /raise the disc/.test(pb.fix), `the Minimax, the drawn disc 10 cm into the ground: fail -> ${pb.fix}`);
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
