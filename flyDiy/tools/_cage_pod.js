// _cage_pod.js - THE BELLY POD IN THE GARAGE: ITS SECTION IN THE EDITOR AND ITS MESH ON THE AEROPLANE
// (G2675 / G2677, BELLY-POD-2 for the GAME COORDINATOR).
//
// The user (7 Oct): "please ensure the belly pod goes through all the steps. In my mind, it should be a configurable
// volume from the garage editor." BELLY-POD (G2410) made the pod a part of the core - spec.pod, 60d_gen_pod.js, its
// mass, drag, clearance, bench row and mounts - with no size UI and nothing drawn. This file is both missing halves:
//
// THE SECTION ("Belly pod", under the fuselage; _cage_parts.js names `CAGE_POD` as its panel, the energy layer's
// shape): a part whose controls write the GAME's spec (spec.pod), not the cage's rows - so a build without a pod
// saves exactly the bytes it saved (no new key in spec.cage, none in spec), and the bought aeroplane's fingerprint
// (76_procure procureFp) moves only when a pod is fitted, resized or removed. The rows are the editor's own (div.r,
// span.k, a range and its value; double-click the label for the default), led by what the user asked for:
//   fitted         the switch (off = the key REMOVED from the spec: GARAGE_SPEC.remove - the aeroplane's own bytes)
//   volume         the HOLD in litres (genPodFromVolume: the core bisects the depth on its own resolver, the shape held)
//   shape          long and shallow <-> short and deep (genPodLD: the length over the depth, 12 to 4)
//   nose / tail    the fairings' shares of the length
//   fore / aft     the pod's nose, metres aft of the firewall (double-click: auto, centred on the quarter chord)
//   door           the side the hatch is on
//   dimensions     length / width / depth themselves (GEN_POD.clamp), for the builder who knows the box they want:
//                  ground clearance is a DEPTH question, and the volume view hides it behind two numbers
// and the live readouts, every one the core's own number (genPodReadout): the hold and its floor, the empty mass and
// price, the drag and its cost in cruise and range, the CG shift empty / full, the clearance per attitude - RED with
// the reason when a clearance is under 0.08 m, a strike, a leg under it, or the static margin full under 0.
// A slider DRAG redraws the pod and the readouts that need no shakedown (the hold, the mass, the drag area, the
// clearance); its RELEASE writes the spec (GARAGE_SPEC.update: the aeroplane rebuilt, the shakedown post-idle) and the
// rest follow (app.js calls refresh() when the sheet lands).
//
// THE MESH (a PAGE.post layer, 'cageLayer:pod', after the hinges): genPodShell's loft in the cage's frame
// (gen (x aft, y up, z port) -> cage (z, y + yD, zFw - x): the join's own datums, computed here off the same anatomy
// the join measures - GATE POD holds the two equal), its walls stretched up to 2 cm inside the DRAWN belly at the
// pod's own half-width (the floor is the physics' floor, untouched) so no gap shows, worn in
// the livery's `pod` section (aeroskin.js AERO_SEC: the body's colour, the spats' moulded trim) through CAGE_SECMAT,
// one mesh named `edPod` whose userData.matNames is ['pod'] - so the join's snapshot (CAGE_VISUAL) buckets it as
// section `pod` and the flown aeroplane, the hybrid bake and the parked / fleet capture carry it with no code of
// their own. ABSENT = NOTHING: no group, no geometry, no material asked for, no draw, no program - the layer returns
// before it allocates (GATE POD's draw count and program census).
'use strict';
(() => {
if (typeof window === 'undefined') return;
const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const HAS_DOM = typeof document !== 'undefined' && !!document.createElement;
const inGame = () => !!window.CAGE_IN_GAME;
// the core, by NAME: its functions are the page's globals, but its `const` tables (GEN_POD, GEN_POD_UI) live in the
// page's global LEXICAL scope - never on window - so each is reached by its own identifier
const core = n => {
  switch (n) {
    case 'buildGen': return typeof buildGen !== 'undefined' ? buildGen : undefined;
    case 'genMigrateSpec': return typeof genMigrateSpec !== 'undefined' ? genMigrateSpec : undefined;
    case 'genPodResolve': return typeof genPodResolve !== 'undefined' ? genPodResolve : undefined;
    case 'genPodShell': return typeof genPodShell !== 'undefined' ? genPodShell : undefined;
    case 'genPodReadout': return typeof genPodReadout !== 'undefined' ? genPodReadout : undefined;
    case 'genPodFromVolume': return typeof genPodFromVolume !== 'undefined' ? genPodFromVolume : undefined;
    case 'genPodShapeOf': return typeof genPodShapeOf !== 'undefined' ? genPodShapeOf : undefined;
    case 'GEN_POD': return typeof GEN_POD !== 'undefined' ? GEN_POD : undefined;
    case 'GEN_POD_UI': return typeof GEN_POD_UI !== 'undefined' ? GEN_POD_UI : undefined;
    default: return undefined;
  }
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

// ---- STATE ------------------------------------------------------------------------------------------------------
// POD: the spec's pod block as the section holds it (null: none fitted). MEM: the last sizes, kept while it is off
// (this session only - a removed pod leaves nothing in the file). SRC: the aeroplane it hangs under ({ def } with
// def.spec and def.parts.ST): the garage's own def (app.js hands it over, frame(def)), or - for a spec the editor
// applies with no garage def behind it (the parked capture, a node rig) - built once from that spec, only with a pod.
let POD = null, MEM = null, SRC = null, NEED = null;
const isOn = p => !!(p && typeof p === 'object' && +p.on);
const OVERLAP = 0.02;                     // m: the drawn shell's top edge, inside the drawn belly
const N_AROUND = 16;

function srcOf() {
  if (SRC) return SRC;
  if (!NEED) return null;
  const build = core('buildGen'), mig = core('genMigrateSpec');
  if (typeof build !== 'function') return null;
  try { const d = build(typeof mig === 'function' ? mig(clone(NEED)) : clone(NEED)); SRC = { def: d }; }
  catch (e) { SRC = null; }
  NEED = null;
  return SRC;
}
// the pod resolved under this aeroplane (the core's resolver, the section's own block)
function resolve(pod) {
  const S = srcOf(), res = core('genPodResolve');
  if (!S || !S.def || !S.def.parts || typeof res !== 'function' || !isOn(pod)) return null;
  return res(Object.assign({}, S.def.spec, { pod }), S.def.parts.ST);
}

// ---- THE DATUMS (_cage_join.js G49's: the firewall at the windscreen base ring's keel, y from the cabin keel) -----
function datum(P) {
  const C2 = window.CAGE2, G = window.CAGE_GEAR, AF = G && G.AF, W = window.CAGE_WING;
  if (!C2 || !AF || typeof C2.cageResolve !== 'function') {
    const D = window.CAGE_DATUM;
    return D && D.fwOk ? { zFw: D.zFw, yD: D.yD, from: 'join' } : null;
  }
  const zCab = W && W.anchor ? W.anchor.zCab : 2.0;
  const zs = Math.max(AF.z0 + 0.05, Math.min(AF.z1 - 0.05, zCab - 0.3));
  let fw = null;
  try {
    const R = C2.cageResolve(C2.cageSpec(Object.assign({}, P)));
    const FS = (C2.CAGE_UNIT || 1) * (P.planeScale || 1);
    const zOf2 = name => { const r = R.rings.find(q => q.name === name); const l = r && r.lv && (r.lv.waist || r.lv.keel);
                           return l && isFinite(l.z) ? l.z * FS : null; };
    fw = zOf2('wsFront') != null ? zOf2('wsFront') : zOf2('wsAft') != null ? zOf2('wsAft')
       : zOf2('aeroWsA') != null ? zOf2('aeroWsA') : zOf2('ring');
  } catch (e) { fw = null; }
  if (fw == null) return null;
  return { zFw: fw, yD: AF.surf(zs, 0)[1], from: 'anatomy' };
}

// ---- THE MESH ---------------------------------------------------------------------------------------------------
// the drawn skin's height at a lateral offset under station z (cage frame): the gear's airframe probe (AF.surf(z, a):
// a = 0 the keel, the section's own ray), bisected on the angle whose lateral reach is `half`
function skinY(AF, z, half) {
  if (!AF || typeof AF.surf !== 'function') return null;
  const hw = typeof AF.halfWAt === 'function' ? AF.halfWAt(z) : null;
  let lo = 0, hi = Math.PI / 2;
  if (hw != null && half >= hw) return AF.surf(z, hi)[1];
  for (let k = 0; k < 24; k++) { const m = 0.5 * (lo + hi); if (Math.abs(AF.surf(z, m)[0]) < half) lo = m; else hi = m; }
  return AF.surf(z, 0.5 * (lo + hi))[1];
}
// the shell in the cage frame: positions (Float32Array), index (outward winding), the record the damage hook reads.
// THE FLOOR IS THE PHYSICS' (genPodShell: the resolver's stations, the floor the clearance is measured on); THE WALLS
// MEET THE DRAWN SKIN: the frame's keel line (the lower longerons) and the cage's drawn belly differ by a few
// centimetres, and more at the pod's sides where the belly curves up - so each station's section is stretched from
// its floor until its top edge is OVERLAP inside the drawn skin at the pod's own half-width (never pulled down: a top
// already inside the body stays). With no airframe probe the top is the keel line plus OVERLAP.
function shellCage(R, D, AF) {
  const shell = core('genPodShell');
  const M = shell(R, N_AROUND), W = N_AROUND + 1, n = M.nv, pos = new Float32Array(n * 3);
  const lift = [];
  for (let i = 0; i < R.sta.length; i++) {
    const s = R.sta[i], zc = D.zFw - s.x, top = s.top + D.yD, sk = skinY(AF, zc, s.hw);
    lift.push(Math.max(OVERLAP, sk != null ? sk + OVERLAP - top : OVERLAP));
  }
  for (let v = 0; v < n; v++) {
    const i = Math.floor(v / W), s = R.sta[i];
    const x = M.pos[3 * v], y = M.pos[3 * v + 1], z = M.pos[3 * v + 2];
    const d = s.top - s.bot, f = d > 1e-4 ? (y - s.bot) / d : 1;          // 0 at the floor, 1 at the top edge
    pos[3 * v] = z; pos[3 * v + 1] = y + f * lift[i] + D.yD; pos[3 * v + 2] = D.zFw - x;
  }
  // genPodShell winds (a, c, b) - inward in its own frame; the map to the cage is a rotation (det +1), so the
  // triangles are turned round here to face out
  const idx = new Uint32Array(M.idx.length);
  for (let k = 0; k < M.idx.length; k += 3) { idx[k] = M.idx[k]; idx[k + 1] = M.idx[k + 2]; idx[k + 2] = M.idx[k + 1]; }
  return { pos, idx, nv: n, nt: M.nt, stations: R.sta.length, around: W, lift };
}
let group = null, lastCtx = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};
function draw(ctx) {
  dispose(group); group = null;
  window.CAGE_POD_MESH = null;
  if (!isOn(POD) || !ctx || !ctx.scene) return null;            // ABSENT: nothing allocated, nothing asked for
  const THREE = window.THREE;
  const R = resolve(POD), D = R ? datum(ctx.P || {}) : null;
  if (!R || !D || !THREE) { if (ctx.stat) ctx.stat.textContent += '  ·  belly pod: ' + (!R ? 'no frame to hang on' : 'no datum'); return null; }
  const S = shellCage(R, D, window.CAGE_GEAR && window.CAGE_GEAR.AF);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(S.pos, 3));
  g.setIndex(S.nv > 65535 ? new THREE.Uint32BufferAttribute(S.idx, 1) : new THREE.Uint16BufferAttribute(Uint16Array.from(S.idx), 1));
  g.computeVertexNormals();
  const SM = window.CAGE_SECMAT;
  // the livery's `pod` section: moulded trim in the body's colour (the spats' rule); the fallback for a page slice
  // with no livery (the node rigs, the material view off)
  const mat = (SM && SM('pod', { surf: 0, fieldM: 1, tint0: 0xd8d4c8 }))
    || new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5, metalness: 0.05 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'edPod';
  mesh.userData.matNames = ['pod'];         // the snapshot's bucket key: section `pod` (_cage_join.js G66)
  mesh.castShadow = true; mesh.receiveShadow = true;
  group = new THREE.Group();
  group.name = 'cageLayer:pod';
  group.add(mesh);
  ctx.scene.add(group);
  // what the drawn pod is, for the follow-up damage session (HANDOVER G2675-G2679): the shell's places in the cage
  // frame, its station rings (stations x around), and the pod's own flown nodes once the frame is built with it
  const fr = SRC && SRC.def && SRC.def.parts && SRC.def.parts.podFrame;
  window.CAGE_POD_MESH = { mesh, R, datum: D, stations: S.stations, around: S.around, nv: S.nv, nt: S.nt,
                           nodes: fr ? fr.nodes.slice() : null };
  return mesh;
}
const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  lastCtx = ctx && ctx.scene ? { scene: ctx.scene, P: ctx.P, stat: null } : null;
  draw(ctx);
};
// a redraw between builds (a pod slider's drag, the garage's new def): the layer alone, on the last build's scene
function redraw() { if (lastCtx) draw(lastCtx); }

// ---- THE SPEC SIDE ----------------------------------------------------------------------------------------------
// the editor applied a spec (_cage_ui.js applySpec: a load, a stock design, the parked capture): the pod comes with
// the aeroplane, unconditionally (a spec with no pod has none - the energy layer's rule)
function fromSpec(spec) {
  POD = spec && isOn(spec.pod) ? clone(spec.pod) : null;
  MEM = POD ? clone(POD) : null;              // a new aeroplane: the last one's sizes are not this one's
  SRC = null; NEED = POD ? clone(spec) : null;
  if (HAS_DOM && panel) render();
}
// the garage's own aeroplane, built (app.js after setAircraft('gen')): its frame is the one the pod hangs under
function frame(def) {
  if (!def || !def.parts || !def.spec) return;
  SRC = { def }; NEED = null;
  const p = def.spec.pod;
  POD = isOn(p) ? clone(p) : null;
  if (POD) MEM = clone(POD);
  redraw();
  if (HAS_DOM && panel) render();
}
// THE WRITE: the release of a row, the switch, the door. On: GARAGE_SPEC.update({ pod }) (the aeroplane rebuilt with
// it). Off: the key REMOVED (GARAGE_SPEC.remove) - a pod taken off leaves the aeroplane's own bytes, not `on: 0`
function commit() {
  const G = window.GARAGE_SPEC;
  if (!inGame() || !G) return;
  if (isOn(POD)) { if (G.update) G.update({ pod: clone(POD) }); }
  else if (G.remove) G.remove('pod');
  else if (G.update) G.update({ pod: { on: 0 } });
}
function setOn(on) {
  if (on) POD = Object.assign({}, MEM || {}, { on: 1 });
  else { if (POD) MEM = clone(POD); POD = null; }
  redraw(); render(); commit();
}

// ---- THE READOUTS -----------------------------------------------------------------------------------------------
// the core's numbers for the pod in hand: off the garage's def and its shakedown when they are this pod's (released),
// else the pod resolved on the same frame and the sheet-free rows (a drag in progress)
function readout() {
  const S = srcOf(), RO = core('genPodReadout');
  if (!S || !isOn(POD) || typeof RO !== 'function') return null;
  const d = S.def, live = d.parts && d.parts.pod && JSON.stringify(d.spec.pod) === JSON.stringify(POD);
  if (live) {
    const B = window.FLYDIY_POD, sh = B && B.shake ? B.shake() : null;
    if (!(sh && sh.pod) && B && B.need) B.need();          // the sheet post-idle (app.js shakeSoon -> refresh)
    return RO(d, sh && sh.pod ? sh : null);
  }
  const R = resolve(POD);
  if (!R) return null;
  const dl = Object.assign({}, d, { spec: Object.assign({}, d.spec, { pod: POD }), parts: Object.assign({}, d.parts, { pod: R }) });
  return RO(dl, null);
}

// ---- THE SECTION ------------------------------------------------------------------------------------------------
let panel = null, body = null, wrap = null;
const el = (tag, cls, txt) => { const d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; };
const UI = () => core('GEN_POD_UI') || { litres: [20, 1000], shape: [0, 1] };
const PD = () => core('GEN_POD') || { def: {}, clamp: {} };
// a row the editor's way: label (double-click: the default), the range, its value
function rowRange(parent, k, label, title, lo, hi, step, val, fmt, oninput, onrelease, reset) {
  const d = el('div', 'r'); d.dataset.k = 'pod.' + k; d.dataset.kind = 'range'; d.classList.add('r-range');
  const ks = el('span', 'k', label); ks.title = title + ' (double-click: the default)';
  ks.ondblclick = () => { reset(); };
  const i = document.createElement('input');
  i.type = 'range'; i.id = 'p_pod_' + k; i.min = lo; i.max = hi; i.step = step; i.value = val; i.style.flex = '1';
  const v = el('span', 'v', fmt(+val));
  i.oninput = () => { v.textContent = fmt(+i.value); oninput(+i.value); };
  i.onchange = () => { onrelease(+i.value); };
  d.appendChild(ks); d.appendChild(i); d.appendChild(v); parent.appendChild(d);
  return { d, i, v };
}
function rowCheck(parent, k, label, title, on, onchange) {
  const d = el('div', 'r'); d.dataset.k = 'pod.' + k; d.dataset.kind = 'check'; d.classList.add('r-check');
  const ks = el('span', 'k', label); ks.title = title;
  const c = document.createElement('input'); c.type = 'checkbox'; c.id = 'p_pod_' + k; c.checked = !!on;
  c.onchange = () => onchange(c.checked);
  d.appendChild(ks); d.appendChild(c); parent.appendChild(d);
  return c;
}
const fmtL = v => Math.round(v) + ' L', fmtM = v => (+v).toFixed(2) + ' m', fmtP = v => Math.round(v * 100) + ' %';
const fmtShape = v => (v < 0.2 ? 'long ' : v > 0.8 ? 'deep ' : '') + (+v).toFixed(2);
// the pod's DEFAULT on this aeroplane (GEN_POD.def's dims, the fairings, auto placement)
const podDefault = () => Object.assign({ on: 1 }, clone(PD().def));

// a volume / shape move: the core maps it onto len / width / depth (through GEN_POD.clamp) on this aeroplane's frame
function fromVolume(litres, shape) {
  const S = srcOf(), FV = core('genPodFromVolume');
  if (!S || typeof FV !== 'function') return null;
  const o = FV(Object.assign({}, S.def.spec, { pod: POD }), S.def.parts.ST, litres, shape);
  POD = Object.assign({}, POD, { len: o.len, width: o.width, depth: o.depth });
  return o;
}
let shapeHeld = null;                     // the shape the builder set (the dims round it; the slider keeps theirs)
function render() {
  if (!HAS_DOM || !body) return;
  body.textContent = '';
  const on = isOn(POD);
  rowCheck(body, 'on', 'fitted', 'a moulded cargo pod under the fuselage: freight outside the cabin, at a cost in drag', on, setOn);
  if (!on) {
    body.appendChild(el('div', 'podNote', 'No belly pod. Fit one to carry freight under the fuselage; it costs drag, ground clearance and the CG.'));
    return;
  }
  const R = resolve(POD), G = PD(), K = G.clamp, U = UI();
  const rel = () => { redraw(); readRender(); };
  const done = () => { render(); commit(); };
  const litres = R ? R.litres : 0;
  const shape0 = R ? core('genPodShapeOf')(R.len, R.depth) : 0.5;
  const shape = shapeHeld != null ? shapeHeld : shape0, sh = () => (shapeHeld != null ? shapeHeld : shape0);
  body.appendChild(el('div', 'podG', 'volume'));
  const rv = rowRange(body, 'litres', 'hold volume', 'the hold\'s usable volume, litres (the fairings are not hold)',
    U.litres[0], U.litres[1], 5, Math.round(litres), fmtL,
    v => { fromVolume(v, sh()); rel(); }, v => { fromVolume(v, sh()); done(); },
    () => { POD = Object.assign(podDefault(), { x: POD.x, door: POD.door, loadKg: POD.loadKg }); shapeHeld = null; redraw(); done(); });
  rowRange(body, 'shape', 'shape', 'long and shallow (the least frontal area, the most clearance) to short and deep',
    U.shape[0], U.shape[1], 0.01, shape, fmtShape,
    v => { shapeHeld = v; fromVolume(+rv.i.value, v); rel(); }, v => { shapeHeld = v; fromVolume(+rv.i.value, v); done(); },
    () => { shapeHeld = null; const d = podDefault(); fromVolume(+rv.i.value, core('genPodShapeOf')(d.len, d.depth)); redraw(); done(); });
  const fair = (k, label, title) => rowRange(body, k, label, title, K[k][0], K[k][1], 0.01, R ? R[k] : G.def[k], fmtP,
    v => { POD = Object.assign({}, POD, { [k]: v }); fromVolume(+rv.i.value, sh()); rel(); },
    v => { POD = Object.assign({}, POD, { [k]: v }); fromVolume(+rv.i.value, sh()); done(); },
    () => { POD = Object.assign({}, POD, { [k]: G.def[k] }); fromVolume(+rv.i.value, sh()); redraw(); done(); });
  fair('noseFair', 'nose fairing', 'the rounded nose\'s share of the length');
  fair('tailFair', 'tail fairing', 'the boat-tail\'s share of the length');
  body.appendChild(el('div', 'podG', 'position'));
  const S = srcOf(), ST = S && S.def.parts.ST;
  const xLo = ST ? ST[0].x + 0.15 : K.x[0], xHi = ST && R ? Math.max(xLo, ST[ST.length - 1].x - 0.3 - R.len) : K.x[1];
  rowRange(body, 'x', 'fore / aft', 'the pod\'s nose, metres aft of the firewall (double-click: auto - centred on the wing\'s quarter chord)',
    xLo.toFixed(2), xHi.toFixed(2), 0.01, R ? R.x0 : xLo, v => (POD.x == null ? 'auto ' : '') + fmtM(v),
    v => { POD = Object.assign({}, POD, { x: +v.toFixed(3) }); rel(); }, v => { POD = Object.assign({}, POD, { x: +v.toFixed(3) }); done(); },
    () => { POD = Object.assign({}, POD, { x: null }); redraw(); done(); });
  {
    const d = el('div', 'r'); d.dataset.k = 'pod.door';
    const ks = el('span', 'k', 'door'); ks.title = 'the side the hatch is on';
    const s = document.createElement('select'); s.id = 'p_pod_door'; s.style.flex = '1';
    for (const v of ['left', 'right']) { const o = document.createElement('option'); o.value = v; o.textContent = v + ' side'; if ((POD.door || 'left') === v) o.selected = true; s.appendChild(o); }
    s.onchange = () => { POD = Object.assign({}, POD, { door: s.value }); done(); };
    d.appendChild(ks); d.appendChild(s); body.appendChild(d);
  }
  body.appendChild(el('div', 'podG', 'dimensions'));
  const dim = (k, label, title) => rowRange(body, k, label, title, K[k][0], K[k][1], 0.01, POD[k] != null ? +POD[k] : G.def[k], fmtM,
    v => { shapeHeld = null; POD = Object.assign({}, POD, { [k]: v }); rel(); }, v => { shapeHeld = null; POD = Object.assign({}, POD, { [k]: v }); done(); },
    () => { shapeHeld = null; POD = Object.assign({}, POD, { [k]: G.def[k] }); redraw(); done(); });
  dim('len', 'length', 'nose to tail, metres');
  dim('width', 'width', 'across the floor (cut to 0.95 of the belly)');
  dim('depth', 'depth', 'the floor under the keel - the clearance question');
  body.appendChild(el('div', 'podG', 'what it does'));
  readEl = el('div', 'podRead'); body.appendChild(readEl);
  readRender();
}
let readEl = null;
function readRender() {
  if (!readEl) return;
  readEl.textContent = '';
  const r = readout();
  if (!r) { readEl.appendChild(el('div', 'podL dim', 'measuring...')); return; }
  const line = (k, v, cls) => { const d = el('div', 'podL' + (cls ? ' ' + cls : '')); d.appendChild(el('span', 'podK', k)); d.appendChild(el('span', 'podV', v)); readEl.appendChild(d); return d; };
  const s = (v, d, u) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + (u || '');
  line('hold', Math.round(r.litres) + ' L · floor ' + r.floorM2.toFixed(2) + ' m² (' + r.maxKg + ' kg rated)');
  line('weight · price', '+' + r.emptyKg.toFixed(1) + ' kg empty · ' + Math.round(r.price).toLocaleString('en') + ' cr');
  line('drag', r.cda.toFixed(3) + ' m²' + (r.cruise ? ' · cruise ' + s(r.cruise.dV * 3.6, 1, ' km/h') + (r.dRangeKm != null ? ' · range ' + s(r.dRangeKm, 0, ' km') : '') : ' · cruise / range: measuring'));
  if (r.cgEmpty) {
    line('CG empty', s(r.cgEmpty.shift * 1000, 0, ' mm') + (r.cgEmpty.cgPct != null ? ' (' + (r.cgEmpty.cgPct * 100).toFixed(1) + ' % MAC)' : ''));
    if (r.cgFull) line('CG full', s(r.cgFull.shift * 1000, 0, ' mm') + ' with ' + r.cgFull.loadKg + ' kg · margin ' + r.cgFull.staticMargin.toFixed(2),
                       r.cgFull.staticMargin < 0 ? 'bad' : r.cgFull.staticMargin < 0.05 ? 'warn' : '');
  } else line('CG', 'measuring');
  for (const c of r.clearance)
    line(c.name, c.clear.toFixed(2) + ' m' + (c.deg ? ' (' + c.deg.toFixed(1) + '°)' : ''), !(c.clear > 0) || c.clear < 0.08 ? 'bad' : '');
  for (const why of r.red) readEl.appendChild(el('div', 'podWhy bad', '✕ ' + why));
  for (const why of r.amber) readEl.appendChild(el('div', 'podWhy warn', '! ' + why));
  if (wrap) wrap.dataset.podOk = r.ok ? '1' : '0';
}
function mountPanel() {
  if (!HAS_DOM || panel) return;
  panel = el('details'); panel.dataset.g = 'pod'; panel.open = true;
  const sum = el('summary', null, 'belly pod'); panel.appendChild(sum);
  body = el('div', 'podBody'); panel.appendChild(body);
  wrap = el('div', 'edRoot'); wrap.dataset.panel = 'pod'; wrap.appendChild(panel);
}
function panelElement() { mountPanel(); render(); return wrap; }
function refresh() { if (panel) readRender(); }

window.CAGE_POD = { panel: panelElement, fromSpec, frame, setOn, refresh, redraw, readout,
                    state: () => clone(POD), on: () => isOn(POD), datum, shellCage, resolve,
                    // the node rigs: the frame a spec builds (no garage behind them)
                    _src: () => srcOf() };
})();
