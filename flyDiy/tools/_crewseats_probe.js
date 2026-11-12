// _crewseats_probe.js (CREW-SEATS G2715, 2026-11-10) - A FUNCTION BODY, not a module: tools/_load_build.js runs it in the
// page context after the load chain's last build (FLYDIY_JOIN_PROBE=<this file>), the editor's drawn scene on __scene,
// the career's door onto the seats set before the first build (FLYDIY_CREW_JOB_SET). It reports what the crew layer
// seated and what the join takes of it: the seats' list the join bills (seatsAt), the crew layer's live occupants (who,
// which seat, the job's or the build's, in the scene or not), the chairs on the layer and in the ghost (the build's crew
// the job left out: the tank fit's alone), the join's live-people door on the job's passengers, and THE SNAPSHOT (the
// flown payload): its vertex count, its people, its crewJob row. Read by GATE CREWSEATS (tools/_crewseats_check.js).
const CW = window.CAGE_CREW, J = window.CAGE_JOIN;
if (!CW || !J) return { err: 'no crew layer or no join' };
let crew = null;
__scene.traverse(o => { if (o.name === 'cageLayer:crew') crew = o; });
if (!crew) return { err: 'no crew group in the scene' };
const names = [];
crew.traverse(o => { if (o.name && /^ed(Seat|Crew)\d+$/.test(o.name)) names.push(o.name); });
const G = CW.ghost || null;
const ghost = G ? G.children.map(c => c.name) : [];
const verts = root => { let n = 0; if (root) root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) n += o.geometry.attributes.position.count; }); return n; };
const seatVerts = (CW.seatsAt || []).map((s, i) => {
  const nm = 'edSeat' + (i + 1);
  return { onLayer: verts(crew.getObjectByName(nm)), inGhost: G ? verts(G.getObjectByName(nm)) : 0 };
});
const rootOf = o => { let q = o; while (q && q.parent) q = q.parent; return q; };
const live = (CW.live || []).map(o => ({ idx: o.live.idx, role: o.live.role, key: o.live.key, job: !!o.live.job,
  dressed: !!o.char, inScene: rootOf(o.fig) === rootOf(crew) }));
// the job's passengers' meshes drawn on the stand (the tank fit skips them by the fig's `crewJob` tag)
let jobMeshes = 0, jobTagged = 0;
crew.traverse(o => {
  if (!/^edCrew\d+$/.test(o.name || '')) return;
  if (o.userData && o.userData.crewJob) { jobTagged++; o.traverse(m => { if (m.isMesh) jobMeshes++; }); }
});
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
let lp = null;
try { lp = typeof J.livePeople === 'function' ? J.livePeople(I4, o => !!(o.live && o.live.job)).map(r => ({ idx: r.idx, job: !!r.job, key: r.key, figM: r.figM.length })) : 'no door'; }
catch (e) { lp = 'ERR ' + String(e && e.message || e).slice(0, 160); }
let snap = null;
try {
  const vis = J.snapshot(window.GARAGE_SPEC.get());
  let nv = 0;
  const add = gs => { for (const k in (gs || {})) if (gs[k] && gs[k].pos) nv += gs[k].pos.length / 3; };
  add(vis.groups);
  for (const p of vis.parts || []) add(p.groups);
  snap = { nv, people: (vis.people || []).map(r => ({ idx: r.idx, role: r.role, key: r.key, job: !!r.job })), crewJob: vis.crewJob || null };
} catch (e) { snap = { err: String(e && e.message || e).slice(0, 200) }; }
return { job: CW.job || null, seatsAt: CW.seatsAt, names: names.sort(), ghost, seatVerts, live, jobMeshes, jobTagged, lp, snap };
