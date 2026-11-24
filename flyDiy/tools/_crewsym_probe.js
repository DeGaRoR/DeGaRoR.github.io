// _crewsym_probe.js (KNEE-SYM, 2026-11-23) - A FUNCTION BODY, not a module: tools/_load_build.js runs it in the page
// context after the load chain's last build (FLYDIY_JOIN_PROBE=<this file>), the editor's drawn scene on __scene. It
// reads the PILOT's joints (edCrew1) in the pilot's own frame (the fig's: +x across, +y up, +z the pilot's forward),
// measured from the hips, so GATE CREWSYM (tools/_crewsym_check.js) can mirror the left side onto the right.
let fig = null;
__scene.traverse(o => { if (!fig && o.name === 'edCrew1') fig = o; });
if (!fig) return { err: 'no edCrew1 (the pilot) in the scene' };
fig.updateWorldMatrix(true, true);
const BONES = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
  'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'];
const found = {};
fig.traverse(o => { if (!o.isBone && o.type !== 'Bone' && !o.isObject3D) return;
  const nm = String(o.name || '').replace(/^.*[:|]/, '').replace(/^mixamorig/, '');
  if (BONES.includes(nm) && !found[nm]) found[nm] = o; });
const miss = BONES.filter(b => !found[b]);
if (miss.length) return { err: 'bones missing: ' + miss.join(' ') };
const read = () => { fig.updateWorldMatrix(true, true);
  const inv = fig.matrixWorld.clone().invert();
  const at = o => { const v = o.getWorldPosition(new fig.position.constructor()).applyMatrix4(inv); return [v.x, v.y, v.z]; };
  const H = at(found.Hips), sc = fig.scale.x || 1, J = {};
  for (const b of BONES) { const p = at(found[b]); J[b] = [0, 1, 2].map(k => +((p[k] - H[k]) * sc).toFixed(4)); }
  return J; };
const out = { joints: read(), figScale: fig.scale.x || 1 };
// THE SHED'S CASE: the aeroplane TURNED (the crew layer's group a quarter turn about up, as the shed lies it along world
// x) and the pilot's legs solved again by the crew layer's own solver (CAGE_CREW.ik.solveGripJob, the editor's), the
// poles derived afresh as at a build - a pose that hung on the world's axes comes out different (and lopsided) here
const CW = window.CAGE_CREW, IK = CW && CW.ik;
const occ = (CW && CW.live || []).find(o => o.fig === fig || (o.live && o.live.idx === 1 && o.live.role !== 'pax'));
let grp = fig; while (grp && grp.name !== 'cageLayer:crew' && grp.parent) grp = grp.parent;
if (!IK || !occ || !grp) { out.turned = { err: 'no solver / live pilot / crew group: ' + [!!IK, !!occ, !!grp].join(',') }; return out; }
const legs = (occ.live.jobs || []).filter(j => j.chain === 'legL' || j.chain === 'legR');
if (legs.length < 2) { out.turned = { err: 'the pilot has ' + legs.length + ' leg job(s)' }; return out; }
const cage = (window.GARAGE_SPEC && window.GARAGE_SPEC.get && (window.GARAGE_SPEC.get() || {}).cage) || {};
const ctx = { s: occ.live.s || 1, palm: occ.live.palm || 0, elbows: +cage.pilElbows || 0, knees: +cage.pilKnees || 0, base: null, notes: null, poleFig: null };
const solveAt = rot => { grp.rotation.y = rot; grp.updateMatrixWorld(true);
  for (const j of legs) IK.solveGripJob(occ, { chain: j.chain, a: j.a, label: j.label }, ctx); return read(); };
const r0 = grp.rotation.y;
solveAt(r0);                                                              // (one warm solve: the first from the build's pose settles ~6 mm)
out.resolved = { joints: solveAt(r0), knees: ctx.knees };          // the same solve, the aeroplane as it lies
out.turned = { joints: solveAt(r0 + Math.PI / 2), legs: legs.length };   // and a quarter turn round
grp.rotation.y = r0; grp.updateMatrixWorld(true);
return out;
