// probe_bodycg.js - A FUNCTION BODY for tools/_load_build.js (FLYDIY_JOIN_PROBE=<this file>), run by crew_cut/bodycg.js.
// probe body: the seated pilot's (edCrew1) mass centre from its posed bones and Winter's segment fractions, in the crew
// layer's frame; and the seat's back (zBack), its rake, the pedal station
const sc = __scene; sc.updateMatrixWorld(true);
const B = {}, v = new THREE.Vector3();
let fig = null; sc.traverse(o => { if (o.name === 'edCrew1') fig = o; });
if (!fig) return { err: 'no pilot' };
const grp = fig.parent;
fig.traverse(o => { if (o.isBone) { o.getWorldPosition(v); const p = grp.worldToLocal(v.clone()); B[o.name.split(':').pop()] = [p.x, p.y, p.z]; } });
const L = (a, b, t) => B[a] && B[b] ? B[a].map((x, i) => x + (B[b][i] - x) * t) : null;
const segs = [];
const add = (w, p) => { if (p) segs.push([w, p]); };
add(0.081, L('Neck', 'HeadTop_End', 0.5)); add(0.497, L('Hips', 'Neck', 0.5));
for (const s of ['Left', 'Right']) {
  add(0.028, L(s + 'Arm', s + 'ForeArm', 0.436)); add(0.016, L(s + 'ForeArm', s + 'Hand', 0.43)); add(0.006, B[s + 'Hand']);
  add(0.100, L(s + 'UpLeg', s + 'Leg', 0.433)); add(0.0465, L(s + 'Leg', s + 'Foot', 0.433)); add(0.0145, L(s + 'Foot', s + 'ToeBase', 0.5));
}
let W = 0, c = [0, 0, 0]; for (const [w, p] of segs) { W += w; for (let i = 0; i < 3; i++) c[i] += w * p[i]; }
c = c.map(x => x / W);
const A = (window.CAGE_CREW || {}).A || {}, S = ((window.CAGE_CREW || {}).seatsAt || [])[0] || {};
return { cg: c.map(x => +x.toFixed(3)), W: +W.toFixed(3), zBack: S.zBack, hips: B.Hips, segs: segs.length };
