// POSE HEADLESS — the flown model's MEMBERSHIP, applied to the editor's
// scene (GATE CLIP, P0). Pure over a THREE scene; node and browser.
//
// WHAT MOVES IN FLIGHT IS DECIDED BY NAME. The join (tools/_cage_join.js
// snapshotAt) walks every mesh's ancestors for `edSurf_*`, `edLink_*`,
// `edFit_*`, `edEng*`, the wheels and legs, and — on twin booms only —
// `edBoom*`, `edFinSkin*`, `edFinVentral*`, `edStabSkin*`; anything it does
// not recognise is the static merge, rigid in the body frame outside the
// wing box. This module reproduces THAT rule, and the viewer's poses over
// it, so a fitting that the join would leave behind while its surface
// travels is measured here before it is flown. It does not re-solve the
// aeroplane: the magnitudes are envelopes (full declared travel, a stated
// wing-flex parabola, a stated tail-anchor throw), the memberships are the
// join's own, and the hinge is the one the join bakes — cageSurfHinge on
// the same vertices, about the layer's declared line (cageSurfLine /
// cageSurfPlane), in the cage frame where the map is a pure rotation and
// clearance is invariant.
//
//   collect(S, THREE, opts)   -> objects: [{ mesh, name, chain, layer, kind,
//                                 surf, base (Float64Array world xyz),
//                                 idx (Uint32Array), n }]
//   poses(S, objects)         -> [{ name, label, apply: obj -> Float64Array
//                                 | null (unmoved) }]
// `S` is a sceneBuild result ({ scene, W (the layer context), FS, P }).
'use strict';
(() => {
const NODE = typeof module !== 'undefined' && module.exports;

const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  crs: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  nrm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
// Rodrigues, right-handed about a unit axis
function rotAbout(p, pivot, axis, ang) {
  const v = V3.sub(p, pivot), c = Math.cos(ang), s = Math.sin(ang);
  const r = V3.add(V3.add(V3.mul(v, c), V3.mul(V3.crs(axis, v), s)),
                   V3.mul(axis, V3.dot(axis, v) * (1 - c)));
  return V3.add(pivot, r);
}

// ---- the join's walk, as a classifier -------------------------------------
// twin: the join's TBp — the boom/tail skins are parts only on twin booms
function classify(chain, ud, twin) {
  // P1 (G300): fixed hardware names the part it is bolted to; a name this
  // build has no part for (a single boom's fin) is the static merge
  for (const u of ud) if (u && u.partOf) { const pk = partKind(u.partOf, twin); return pk || { kind: 'static', partOf: u.partOf }; }
  for (const a of chain) {
    if (!a) continue;
    if (a.startsWith('edProp') || a.startsWith('edSpinner')) return { kind: 'prop' };
    if (a === 'edWheelL' || a === 'edWheelR' || a === 'edWheelT') return { kind: 'wheel', name: a };
    if (a.startsWith('edLeg') || a === 'edCastorT') return { kind: 'gear', name: a };
    if (a.startsWith('edSurf_')) return { kind: 'surf', surf: a.slice(7), name: a };
    if (a.startsWith('edLink_')) return { kind: 'link', surf: a.slice(7).replace(/_b$/, ''), name: a };
    if (a.startsWith('edCtl_') || a.startsWith('edGauge_')) return { kind: 'cockpit' };
    if (a === 'edFit_liftstrut' || a === 'edFit_cabane' || a === 'edFit_interplane' || a === 'edFit_wire')
      return { kind: 'strut', name: a };
    if (a.startsWith('edEng')) return { kind: 'eng' };
    const pk = partKind(a, twin);
    if (pk) return pk;
  }
  return { kind: 'static' };
}
function partKind(name, twin) {
  // a tag may name a control surface (the tail's white light on the rudder)
  if (name.startsWith('edSurf_')) return { kind: 'surf', surf: name.slice(7), name };
  if (!twin) return null;
  if (name.startsWith('edBoom')) return { kind: 'boom', name };
  if (name.startsWith('edFinSkin') || name.startsWith('edFinVentral') || name.startsWith('edFinFillet') ||
      name.startsWith('edStabSkin'))
    return { kind: 'anchor', name };
  return null;
}

function collect(S, THREE) {
  const W = S.W || {};
  const twin = !!(W.CAGE_BOOMS);
  const out = [];
  const v = new THREE.Vector3();
  S.scene.updateMatrixWorld(true);
  S.scene.traverse(o => {
    if (!o.isMesh) return;
    const chain = [], ud = [];
    let a = o, layer = null;
    while (a && a !== S.scene) {
      chain.push(a.name || '');
      ud.push(a.userData);
      if (a.name && a.name.startsWith('cageLayer:')) layer = a.name.slice(10);
      a = a.parent;
    }
    const g = o.geometry, pos = g.attributes.position, idx = g.index;
    const base = new Float64Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      base[3 * i] = v.x; base[3 * i + 1] = v.y; base[3 * i + 2] = v.z;
    }
    const n = idx ? idx.count : pos.count;
    const I = new Uint32Array(n);
    for (let i = 0; i < n; i++) I[i] = idx ? idx.getX(i) : i;
    const cls = classify(chain, ud, twin);
    out.push(Object.assign({ mesh: o, name: o.name || '', chain, layer, base, idx: I,
                             nv: pos.count, ud: o.userData || {} }, cls));
  });
  return out;
}

// ---- the hinges, in the cage frame ----------------------------------------
// cage (x lateral, y up, z forward) -> the join's body axes at zero pitch
// (x aft, y up, z port = cage +x): a proper rotation, so a hinge measured
// there maps back with the same angle
const toModel = c => [-c[2], c[1], c[0]];
const toCage = m => [m[2], m[1], -m[0]];

function surfHinges(S, objects) {
  const W = S.W || {};
  const J = (NODE ? require('./_cage_join.js') : W.CAGE_JOIN_PURE) || {};
  const hinges = {};
  const bySurf = {};
  for (const o of objects) if (o.kind === 'surf') (bySurf[o.surf] = bySurf[o.surf] || []).push(o);
  const WGs = (W.CAGE_WING && W.CAGE_WING.surfs) || [];
  const travel = W.genTravel || (typeof genTravel === 'function' ? genTravel : null);
  const spec = W.GARAGE_SPEC && W.GARAGE_SPEC.get ? W.GARAGE_SPEC.get() : null;
  for (const surf in bySurf) {
    // the surface's OWN vertices: the edSurf_ mesh(es), not the hardware
    // hanging under them (the join sees the same — hardware is attached
    // after the surface is drawn and baked into the part, but the hinge
    // is measured on the surface's own groups first)
    const pts = [];
    for (const o of bySurf[surf]) {
      if (o.name && o.name.startsWith('edHinge_')) continue;
      for (let i = 0; i < o.nv; i++) pts.push(toModel([o.base[3 * i], o.base[3 * i + 1], o.base[3 * i + 2]]));
    }
    if (!pts.length) continue;
    const line = J.cageSurfLine ? J.cageSurfLine(surf, { FIN: W.CAGE_FIN, STAB: W.CAGE_STAB, FIN_GEN: W.FIN_GEN }) : null;
    const hplane = line && J.cageSurfPlane ? J.cageSurfPlane(line, toModel) : null;
    const h = J.cageSurfHinge ? J.cageSurfHinge(pts, surf, { cant: W.CAGE_STAB ? W.CAGE_STAB.cant : 0, hinge: hplane }) : null;
    if (!h) continue;
    const S2k = surf.replace(/2$/, '');
    const which = S2k.startsWith('ail') ? 'aileron' : S2k.startsWith('flap') ? 'flap'
                : S2k.startsWith('rud') ? 'rudder' : 'elevator';
    const ft = spec && spec.controls && spec.controls.flap;
    const k = travel ? travel(which, ft && ft.type) : 0.45;
    const wRec = WGs.find(w => w.name === surf);
    hinges[surf] = { pivot: toCage(h.pivot), axis: V3.nrm(toCage(h.axis)), drive: h.drive, sgn: h.sgn,
                     drive2: h.drive2, sgn2: h.sgn2, k, hingeFrom: h.hingeFrom,
                     slide: wRec && wRec.slide ? wRec.slide : null };
  }
  return hinges;
}

// ---- the poses --------------------------------------------------------------
// u: { da, de, dr, flap } in [-1, 1]; a surface turns by sgn*k*u(drive)
// (+ its second drive), a Fowler slides by slide*flap
function surfDelta(o, H, u) {
  const h = H[o.surf];
  if (!h) return null;
  let ang = h.sgn * h.k * (u[h.drive] || 0);
  if (h.drive2) ang += h.sgn2 * h.k * (u[h.drive2] || 0);
  const sl = h.slide && u.flap > 0 ? V3.mul(h.slide, u.flap) : null;
  if (Math.abs(ang) < 1e-9 && !sl) return null;
  const out = new Float64Array(o.base.length);
  for (let i = 0; i < o.nv; i++) {
    let p = [o.base[3 * i], o.base[3 * i + 1], o.base[3 * i + 2]];
    p = rotAbout(p, h.pivot, h.axis, ang);
    if (sl) p = V3.add(p, sl);
    out[3 * i] = p[0]; out[3 * i + 1] = p[1]; out[3 * i + 2] = p[2];
  }
  return out;
}

// the wing box the viewer binds by (app.js cageCfg), in the cage frame:
// |x| >= zRoot + 0.06, z within the chord band, y above the spar line. A
// synthetic parabola over it — tipY of the semispan, the same field on
// every vertex that is IN the box, nothing on one that is not — so the box
// edge's own discontinuity (the class of tear the viewer's strut rule
// exists for) is what this pose measures. Labelled synthetic in the verdict.
function flexField(S) {
  const W = S.W || {}, CW = W.CAGE_WING;
  if (!CW || !CW.def) return null;
  const def = CW.def, PT = def.parts || {}, W2 = def.spec && def.spec.wing;
  if (!W2 || W2.xLE == null) return null;
  const zR = (PT.zRoot || 0.5) + 0.06;
  const semi = CW.semi || (W2.span * 0.5);
  const sw = Math.max(Math.abs(+W2.tipX || 0), Math.abs(+W2.crankX || 0));
  const swS = (+W2.tipX || 0) < 0 ? -sw : sw;
  // body x (aft) band -> cage z (forward) band, through the layer's map
  const nodeCage = CW.nodeCage;
  if (!nodeCage) return null;
  const xLo = W2.xLE - 0.15 + Math.min(0, swS), xHi = W2.xLE + W2.chord + 0.25 + Math.max(0, swS);
  const zHi = nodeCage([xLo, 0, 0])[2], zLo = nodeCage([xHi, 0, 0])[2];
  let yMin = -Infinity;
  try {
    const F = PT.wf.R.F;
    yMin = Math.min(nodeCage(def.nodes[F[0]].p)[1], nodeCage(def.nodes[F[F.length - 1]].p)[1]) - 0.30;
  } catch (e) {}
  const tipY = 0.05 * semi;                // 5 % of the semispan at the tip
  const inBox = p => Math.abs(p[0]) >= zR && p[2] >= zLo && p[2] <= zHi && p[1] >= yMin;
  const dyAt = p => { const s = Math.max(0, (Math.abs(p[0]) - zR) / Math.max(1e-6, semi - zR)); return tipY * s * s; };
  return { inBox, dyAt, zR, semi, tipY, band: [zLo, zHi], yMin };
}

function poses(S, objects) {
  const W = S.W || {};
  const H = surfHinges(S, objects);
  const twin = !!W.CAGE_BOOMS;
  const list = [];
  list.push({ name: 'rest', label: 'rest', apply: () => null });
  const FULL = { da: 1, de: 1, dr: 1, flap: 1 }, NEG = { da: -1, de: -1, dr: -1, flap: 0 };
  for (const [nm, u] of [['+full', FULL], ['-full', NEG]])
    list.push({ name: nm, label: nm + ' travel (da de dr ' + u.da + ', flap ' + u.flap + ')',
                apply: o => o.kind === 'surf' ? surfDelta(o, H, u) : null });
  const FX = flexField(S);
  if (FX) list.push({ name: 'flex', label: 'wing flex (synthetic parabola, tip ' + (FX.tipY * 1000).toFixed(0) + ' mm, box |x| >= ' + FX.zR.toFixed(2) + ')',
    apply: o => {
      if (o.kind === 'prop' || o.kind === 'eng' || o.kind === 'cockpit') return null;
      let moved = false;
      const out = new Float64Array(o.base.length);
      if (o.kind === 'strut' && o.ud.strutMembers && o.ud.strutMembers.length) {
        // the strut follows its own two ends (app.js G140): root delta 0,
        // tip delta the field's at the tip, linear along the member
        const M = o.ud.strutMembers.map(m => ({ pin: m.pin, tip: m.tip, d: dyOf(m.tip) }));
        for (let i = 0; i < o.nv; i++) {
          const p = [o.base[3 * i], o.base[3 * i + 1], o.base[3 * i + 2]];
          let best = null, bd = Infinity;
          for (const m of M) {
            const ab = V3.sub(m.tip, m.pin), L2 = V3.dot(ab, ab) || 1;
            const t = Math.max(0, Math.min(1, V3.dot(V3.sub(p, m.pin), ab) / L2));
            const q = V3.add(m.pin, V3.mul(ab, t));
            const d = V3.len(V3.sub(p, q));
            if (d < bd) { bd = d; best = { t, m }; }
          }
          const dy = best ? best.t * best.m.d : 0;
          if (dy) moved = true;
          out[3 * i] = p[0]; out[3 * i + 1] = p[1] + dy; out[3 * i + 2] = p[2];
        }
        return moved ? out : null;
      }
      for (let i = 0; i < o.nv; i++) {
        const p = [o.base[3 * i], o.base[3 * i + 1], o.base[3 * i + 2]];
        const dy = FX.inBox(p) ? FX.dyAt(p) : 0;
        if (dy) moved = true;
        out[3 * i] = p[0]; out[3 * i + 1] = p[1] + dy; out[3 * i + 2] = p[2];
      }
      return moved ? out : null;
    } });
  function dyOf(p) { return FX && FX.inBox(p) ? FX.dyAt(p) : 0; }
  if (twin) {
    const TB = W.CAGE_BOOMS;
    const throwY = 0.040;
    for (const sgn of [1, -1]) {
      list.push({ name: 'tail' + (sgn > 0 ? '+' : '-'),
        label: 'tail anchor ' + (sgn > 0 ? '+' : '-') + (throwY * 1000).toFixed(0) + ' mm (synthetic throw; twin-boom parts ride it, static stays)',
        apply: o => {
          const rides = o.kind === 'anchor' ||
            (o.kind === 'surf' && (o.layer === 'fin' || o.layer === 'stab')) ||
            (o.kind === 'link' && /^(rud|elev)/.test(o.surf));
          if (!rides && o.kind !== 'boom') return null;
          const out = new Float64Array(o.base.length);
          for (let i = 0; i < o.nv; i++) {
            const p = [o.base[3 * i], o.base[3 * i + 1], o.base[3 * i + 2]];
            let t = 1;
            if (o.kind === 'boom') t = Math.max(0, Math.min(1, (TB.zRoot - p[2]) / Math.max(1e-6, TB.zRoot - TB.zTip)));
            out[3 * i] = p[0]; out[3 * i + 1] = p[1] + sgn * throwY * t; out[3 * i + 2] = p[2];
          }
          return out;
        } });
    }
  }
  return { list, hinges: H, flex: FX, twin };
}

const API = { collect, poses, classify, surfHinges, flexField, rotAbout, toModel, toCage };
if (NODE) module.exports = API;
if (typeof window !== 'undefined') window.POSE_HEADLESS = API;
})();
