#!/usr/bin/env node
// G2363 (DMG-MOUNTRIG): THE RIG ON ITS CERTIFICATE - every member of each nose-engine build's rig (an end on an ENG / CGE /
// MNT node, and the nose leg's members to the mount's cups) with its certified envelope (66_gen_cert genCertify: the
// governing case's name, tension and compression at limit), its floor (GEN_CERT.kappa x its physics: what a member no case
// loads is stamped at) and whether it sits there. A member on its floor on a side no case loads is printed FLOOR; the
// crankcase (both ends ENG / CGE: it keeps its physics, 30_solver CERT_ENG) is printed as such.
//   node tools/dmg_mountrig_cert.js [builds...]
'use strict';
process.env.FLYDIY_CERT = '1';
const L = require('./_treecrash_lib.js'), C = L.core();
const keys = process.argv.slice(2).length ? process.argv.slice(2) : ['cub', 'jodel', 'metal', 'floats'];
const kN = x => (x / 1e3).toFixed(2).padStart(6);
let floors = 0;
for (const k of keys) {
  const def = L.defOf(k), cert = L.certOf(k), N = def.nodes, K = C.GEN_CERT;
  const sim = C.makeSim(Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true }) }), null);
  const B = sim.beams;   // the members' physics (D1a: fy0 / fu / fc0 before any stamp)
  const rig = t => /^(ENG|CGE|MNT)/.test(t);
  console.log('== ' + L.BUILDS[k].label + ' (kappa ' + K.kappa + ')');
  def.beams.forEach((b, bi) => {
    const ta = N[b.a].tag, tb = N[b.b].tag;
    if (!(rig(ta) || rig(tb))) return;
    const caseM = /^(ENG|CGE)/.test(ta) && /^(ENG|CGE)/.test(tb);
    const fuP = B[bi].fu, fcP = B[bi].fc0, ft = cert.Ft[bi], fc = cert.Fc[bi];
    const fit = !!b.seam, uT = 1.5 * K.m * ft * (fit ? K.uFit : K.uMember), uC = 1.5 * K.m * fc * K.uMember;
    const onT = !caseM && b.cls !== 'gear' && uT <= K.kappa * fuP, onC = !caseM && b.cls !== 'gear' && !b.tens && uC <= K.kappa * fcP;
    if (onT || onC) floors++;
    console.log('  ' + (ta + '-' + tb).padEnd(13) + ' ' + b.cls.padEnd(4) + ' ' + (caseM ? 'case (physics)' : (def.parts.dmg.iso || []).includes(bi) ? 'isolator' : b.cls === 'gear' ? 'nose leg' : 'bearer').padEnd(14)
      + ' Ft' + kN(ft) + ' ' + String(cert.names[cert.byT[bi]] || '-').padEnd(12) + ' Fc' + kN(fc) + ' ' + String(cert.names[cert.byC[bi]] || '-').padEnd(12)
      + ' floor t/c' + kN(K.kappa * fuP) + kN(K.kappa * fcP) + (onT ? '  FLOOR(t)' : '') + (onC ? '  FLOOR(c)' : ''));
  });
}
console.log(floors ? floors + ' member side(s) on the floor' : 'no rig member on its floor');
