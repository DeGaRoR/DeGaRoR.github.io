// born_ls4.js <out-prefix> [cageJSON] : the LS4 prototype - the motorglider, the cage page's 'sailplane' preset (the mirrored
// pod), the aero nose, the LS4's sizing in metres; writes <out>.json (the joined spec) and <out>_page.json (the page's save)
const T = '/workspace/DeGaRoR.github.io/flyDiy/tools/';
const BJ = require(T + '_bake_joined.js'), LB = require(T + '_load_build.js');
const { D } = BJ.loadPanel(); const A = D.ARCHETYPES.find(x => x.key === 'motorglider');
const PRE = (global.window && window.CAGE_PAGE && window.CAGE_PAGE.presets && window.CAGE_PAGE.presets.sailplane) || null;
if (!PRE) throw new Error('no sailplane preset');
const extra = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const PS = extra.planeScale || PRE.planeScale, m = v => v / PS;
const LS4 = Object.assign({}, PRE, {
  // the nose: no cowl, no engine drawn (engineless support pending), the aero nose, its tip collapsed into one point
  cowlOn: 0, engOn: 0, aeroNose: 1, aeroWsLen: 0.9, aeroLen: 1.0, aeroTipW: 0.08, aeroTipH: 0.08, aeroDroop: 0,
  noseFinish: 1, noseTip: 0.98, crNoseCap: 0, crFrontCap: 0, noseJointOn: 0, noseDome: 0.3,
  // the wing: 15 m, root 0.90, tip 0.50 (one taper at the LS4's area)
  wgSpan: 15.0, wgChord: 0.90, wgChordTip: 0.50,
  // the gear: one sunk main; the tail: a tiny wheel, no fairing, the shortest leg
  s1X: 0, s1Sink: 0.5, s1R: m(0.19), s1Drop: 0.05, s1Leg: 0,
  s2On: 1, s2Leg: 3, s2Nose: 0, s2R: m(0.10), s2Fair: 0, s2Drop: 0.05, s2_twLegDrop: 0, s2_twSpringDrop: 0.02, s2_twSpringLen: 0.12,
  // the tail
  finDorsal: 0, finVentralOn: 0,
});
const over = { cage: Object.assign({}, A.over && A.over.cage, LS4, extra),
               spec: Object.assign({}, A.over && A.over.spec, { paint: { job: 'self', sweep: 0, base: 0xf3f4f1, trim: 0x17325e } }) };
const sel = Object.assign({}, A.sel, extra._sel || {}); for (const k in sel) if (sel[k] === null) delete sel[k];
delete over.cage._sel;
const s0 = D.designBake(sel, over);
const r = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 });
if (r.errors.length) console.log('join errors', r.errors.slice(0, 3));
const fs = require('fs'), out = process.argv[2];
fs.writeFileSync(out + '.json', JSON.stringify({ name: 'LS4 prototype', spec: r.spec }));
fs.writeFileSync(out + '_page.json', JSON.stringify({ what: 'flydiy-build', v: 10, name: 'LS4 prototype', spec: s0 }));
console.log('saved', out, 'PS', PS);
