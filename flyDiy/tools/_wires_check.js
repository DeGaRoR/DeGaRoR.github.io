#!/usr/bin/env node
// GATE WIRES (PHYSICS-AUDIT step 2, 2026-11-21; reports/PHYSICS-AUDIT-2026-11-21.md N6, N7): the bracing wires' drag is
// the wires the aeroplane has.
//   THE TAIL'S BRACE WIRES  the frame braces every conventional stab's tips to the fin post with four tension wires (the
//       lattice's own; nothing draws them), and the drag billed all four on every build - a cantilever alloy or composite
//       tailplane paid for cables it does not carry (0.02-0.07 m2: a quarter of a sailplane's whole drag). Now: by the
//       STAB'S OWN SKIN (a fabric-covered stab is wire-braced, a stressed-skin one is not), or as the row states it
//       (tail.brace 'wires' | 'none', the stab layer's stBrace). The structure does not move: the same members, the same
//       masses; only the drag and the members' `ext` flag.
//   A BIPLANE'S FLYING WIRES  round cable at Cd 1.0 (as ever), or streamline wire (bracing.wireSection 'streamline', the
//       brace layer's bpWireSec) at GEN_DRAG.wire.cdStream on the same thickness.
// 1. a fabric stab pays its wires, to the bit of the old sum (length x wireD x 1.0)
// 2. an alloy / carbon / glass stab pays none - and its frame is the fabric-stab frame's own (nodes, beams, masses)
// 3. the row outranks the skin, both ways
// 4. a biplane's wires: round = the old sum; streamline = cdStream / cdRound of the wires' share, the struts untouched
// 5. the keys: clampSpec deletes anything but the stated values; genStolCageOff drops the rows at 0
// 6. NO CERTIFICATE IS WITHDRAWN FOR A ROW NOBODY TOUCHED: the join states both keys as null at the rows' default (A3);
//    a null hashes as the absent key in every fingerprint the game keeps (the bench's, the certificate rule's, the
//    procurement's) - and a streamline wire, or a stated tail bracing, IS another aeroplane
//    (found red on 2026-11-22: GATE BENCH, the shipped Rufus's body 68880996 against the stamped cc88a9ce)
//   node tools/_wires_check.js  -> "GATE WIRES: PASS|FAIL"   (seconds)
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const bad = [];
const check = (c, m) => { console.log((c ? '  ok     ' : '  FAIL   ') + m); if (!c) bad.push(m); return c; };
const clone = o => JSON.parse(JSON.stringify(o));
const near = (a, b, t = 1e-12) => Math.abs(a - b) <= t * Math.max(1, Math.abs(a), Math.abs(b));
const isTail = (def, b) => /^HT|^FIN/.test(def.nodes[b.a].tag || '') || /^HT|^FIN/.test(def.nodes[b.b].tag || '');
const wireLen = (def, tail, extOnly) => def.beams.filter(b => b.cls === 'wire' && isTail(def, b) === tail && (!extOnly || b.ext)).reduce((a, b) => a + b.L, 0);
const build = f => { const s = clone(C.GEN_DEFAULT); f(s); return C.buildGen(s); };
const wD = C.GEN_RULES.wireD, W = C.GEN_DRAG.wire;

// ---- 1-3: the tail ---------------------------------------------------------------------------------------------------
const stock = build(() => {});
const stabKey = C.genSurfKey(stock.spec, 'stab');
console.log('the stock build: stab skin ' + stabKey + ', tail brace wires ' + wireLen(stock, true).toFixed(2) + ' m, billed ' + stock.params.gen.tailBraceDCdA.toFixed(4) + ' m2');
check(wireLen(stock, true) > 1 && near(stock.params.gen.tailBraceDCdA, wireLen(stock, true) * wD * 1.0, 1e-9), '1. the stock (fabric) stab pays its four wires, the old sum: length x wireD x 1.0');
check(C.genTailBraced(stock.spec) === true, '1. ...and genTailBraced says so');
for (const m of ['alloy', 'carbon', 'glass']) {
  const d = build(s => { s.tail = Object.assign({}, s.tail, { stabMaterial: m }); });
  const w = build(s => { s.tail = Object.assign({}, s.tail, { stabMaterial: m, brace: 'wires' }); });
  check(d.params.gen.tailBraceDCdA === 0 && wireLen(d, true, true) === 0, '2. a ' + m + ' stab pays no brace wires (0 m2, none exposed)');
  check(wireLen(d, true) > 1 && d.nodes.length === w.nodes.length && d.beams.length === w.beams.length &&
        d.nodes.every((n, i) => n.m === w.nodes[i].m) && d.beams.every((b, i) => b.k === w.beams[i].k && b.L === w.beams[i].L),
        '2. ...its frame is the wire-braced one\'s own (the members stand, the masses and the stiffness the same)');
  check(w.params.gen.tailBraceDCdA > 0 && near(w.params.gen.tailBraceDCdA, wireLen(w, true) * wD * 1.0, 1e-9), '3. ...and the row "wires" on a ' + m + ' stab bills them');
  check(near(w.params.fusCdA[0] - d.params.fusCdA[0], w.params.gen.tailBraceDCdA, 1e-9), '3. ...the body row differs by exactly that');
}
const none = build(s => { s.tail = Object.assign({}, s.tail, { brace: 'none' }); });
check(none.params.gen.tailBraceDCdA === 0 && near(stock.params.fusCdA[0] - none.params.fusCdA[0], stock.params.gen.tailBraceDCdA, 1e-9), '3. the row "none" on a fabric stab takes them off, and nothing else');

// ---- 4: a biplane's flying wires ---------------------------------------------------------------------------------------
const bipSpec = s => { s.wings = [Object.assign({}, s.wings[0], { position: 'low' }), Object.assign({}, s.wings[0], { position: 'high' })];
                       s.bracing = Object.assign({}, s.bracing, { type: 'cantilever', interplane: 'N', wires: 'both' }); };
let round = null, stream = null;
try { round = build(bipSpec); stream = build(s => { bipSpec(s); s.bracing.wireSection = 'streamline'; }); } catch (e) { check(false, '4. a biplane builds (' + e.message + ')'); }
if (round && stream) {
  const Lw = wireLen(round, false, true);
  console.log('a biplane: flying / landing wires ' + Lw.toFixed(2) + ' m; truss ' + round.params.gen.braceDCdA.toFixed(4) + ' m2 round, ' + stream.params.gen.braceDCdA.toFixed(4) + ' streamline');
  check(Lw > 4, '4. the biplane has its wires (' + Lw.toFixed(1) + ' m)');
  check(near(round.params.gen.braceDCdA - stream.params.gen.braceDCdA, Lw * wD * (W.cdRound - W.cdStream), 1e-9), '4. streamline wires take (cdRound - cdStream) x length x wireD off the truss, the struts untouched');
  check(W.cdRound === 1.0, '4. a round cable is the Cd 1.0 it always was');
  check(round.nodes.length === stream.nodes.length && round.beams.every((b, i) => b.k === stream.beams[i].k), '4. ...the structure the same');
  check(stream.spec.bracing.wireSection === 'streamline' && !('wireSection' in round.spec.bracing), '4. the resolved spec states it only when set');
}

// ---- 5: the keys -------------------------------------------------------------------------------------------------------
const junk = build(s => { s.tail = Object.assign({}, s.tail, { brace: 'struts' }); s.bracing = Object.assign({}, s.bracing, { wireSection: null }); });
check(!('brace' in junk.spec.tail) && !('wireSection' in junk.spec.bracing), '5. clampSpec deletes anything but the stated values (absent = the default)');
check(!('brace' in stock.spec.tail), '5. the stock spec carries no tail.brace');
const cg = C.genStolCageOff({ stBrace: 0, bpWireSec: 0, wgSpan: 9 });
check(!('stBrace' in cg) && !('bpWireSec' in cg) && cg.wgSpan === 9, '5. genStolCageOff drops the two rows at 0');
const cg1 = C.genStolCageOff({ stBrace: 2, bpWireSec: 1 });
check(cg1.stBrace === 2 && cg1.bpWireSec === 1, '5. ...and keeps them when set');

// ---- 6: the stated null is the absent key in every hash ----------------------------------------------------------------
{
  const fs = require('fs'), vm = require('vm');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'bench.js'), 'utf8'), m = { exports: {} };
  vm.runInNewContext(src, Object.assign({ module: m, exports: m.exports, console, Math, JSON, parseFloat, isFinite, Number, String, Array, Object,
    Uint8ClampedArray, Infinity, setTimeout, clearTimeout, setInterval, clearInterval, performance, Date, Symbol },
    { certMajorOf: C.certMajorOf, certStrip: C.certStrip, certGroupsChanged: C.certGroupsChanged, certChangeLine: C.certChangeLine }), { filename: 'bench.js' });
  const BE = m.exports;
  const plain = clone(C.GEN_DEFAULT);
  const nul = clone(plain); nul.bracing = Object.assign({}, nul.bracing, { wireSection: null }); nul.tail = Object.assign({}, nul.tail, { brace: null });
  const strm = clone(plain); strm.bracing = Object.assign({}, strm.bracing, { wireSection: 'streamline' });
  const brc = clone(plain); brc.tail = Object.assign({}, brc.tail, { brace: 'none' });
  const hashes = { 'the bench certificate (benchFingerprint)': o => BE.benchFingerprint(o, null),
                   'the certificate rule (certStrip -> certMajorOf)': o => C.certMajorOf(C.certStrip(o)).fp,
                   'the procurement (procureFp)': o => C.procureFp(o),
                   'the procurement, first scheme (procureFpP1)': o => C.procureFpP1(o) };
  for (const [lbl, h] of Object.entries(hashes)) {
    let a = null, b = null, c = null, d = null; try { a = h(plain); b = h(nul); c = h(strm); d = h(brc); } catch (e) { check(false, '6. ' + lbl + ' hashes (' + e.message + ')'); continue; }
    check(!!a && a === b, '6. ' + lbl + ': wireSection null and tail.brace null hash as the absent keys (' + a + ')');
    check(c !== a && d !== a, '6. ...and a streamline wire, or a tail stated unbraced, is another aeroplane');
  }
  // the join does state them (so the garage's merge can take a row back off): the three biplane cards say streamline
  const D = require(path.join(__dirname, '_cage_design.js'));
  const cards = (D.ARCHETYPES || []).filter(a => a.over && a.over.cage && Math.round(+a.over.cage.bpWireSec || 0) === 1).map(a => a.key);
  check(['tigermoth', 'stearman', 'camel'].every(k => cards.includes(k)), '6. the Tiger Moth, Stearman and Camel cards state streamline wire (their bpWireSec row: ' + cards.join(' ') + ')');
}

console.log('GATE WIRES: ' + (bad.length ? 'FAIL' : 'PASS'));
process.exit(bad.length ? 1 : 0);
