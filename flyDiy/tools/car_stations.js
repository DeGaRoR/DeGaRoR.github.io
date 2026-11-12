// CAR STATIONS (CAR-3, 12 Nov; the user marked the Power Wagon's sections on the overlay: 1 the bonnet's front face,
// 2 its straight part, 3 the nose section, 4 the cabin, 5 passenger bay 1, 6 passenger bay 2) - the build's own
// section boundaries in metres, read off the cage's rings (CAGE2.cageSpec + buildCage2: the rings' names and stations)
// and the cowl's rows, measured from the body's aft end. A TOOL, not a gate.
//   node tools/car_stations.js build.json [--over '{"row":v}']
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const file = argv.find(a => !a.startsWith('--') && a !== opt('over'));
const BJ = require(path.join(__dirname, '_bake_joined.js'));
const { W } = BJ.loadPanel();
const C2 = W.CAGE2;
const spec = JSON.parse(fs.readFileSync(file, 'utf8')).spec;
const P = Object.assign({}, C2.CAGE_DEFAULT, spec.cage, JSON.parse(opt('over') || '{}'));
const FS = (C2.CAGE_UNIT || 1) * (P.planeScale || 1);
const S = C2.cageSpec(P), R = C2.cageResolve(S);
const rz = r => { const l = r.lv && (r.lv.waist || r.lv.keel); return l && isFinite(l.z) ? l.z * FS : null; };
const rings = R.rings.map(r => ({ name: r.name, z: rz(r) })).filter(r => r.z != null && r.name);
const z0 = Math.min(...rings.map(r => r.z));
const at = n => { const r = rings.find(q => q.name === n); return r ? r.z : null; };
console.log('RINGS (m from the aft end): ' + rings.map(r => r.name + ' ' + (r.z - z0).toFixed(3)).join(', '));
const zFw = C2.cageFirewallZ(C2.cageNamedZ(R, FS));
const cw = k => +(spec.cage['cw_' + k] != null ? spec.cage['cw_' + k] : NaN);
const cowlLen = cw('cowlLen'), lidLen = cw('lidLen');
console.log('FIREWALL ' + (zFw - z0).toFixed(3) + ' m; cowl straight ' + cowlLen + ' + front ' + lidLen + ' (cowl rows, metres)');
