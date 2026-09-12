// CAGE HINGE LAYER (G238/G239) — THE HARDWARE, ON THE LIVE AEROPLANE.
//
// The second piece of the hinge arc and the one you can see. `GEN_HINGE_KIT`
// (60_gen_spec.js) says what each control surface needs and what each thing
// serves; `_hinge_gen.js` draws the shapes; this finds the surfaces, works out
// where the hardware goes on THIS aeroplane, and hangs it on them.
//
// The audit this answers (futureDesigns/HINGES-ACTUATORS-2026-09-10.md) found
// the aeroplane had no hinge and no actuator geometry anywhere: every control
// surface was a slab that turned about an invisible line, and two fittings —
// the aileron bellcrank cover and the tail inspection ring — were covering
// mechanisms that had never been built.
//
// ---------------------------------------------------------------------------
// WHICH BAG A TRIANGLE GOES IN IS THE WHOLE ANIMATION.
//
// The layer keeps two sets of bags: one for what stays with the airframe, and
// one PER SURFACE for what turns with it. The moving mesh is then handed to
// the surface's own drawn object (`edSurf_ailR` and friends) with
// Object3D.attach, which preserves its world placement and computes the local
// transform — so it inherits the fin group's scale, the explode offset, and,
// once the join has baked it, the surface's own hinge rotation in the flown
// model. Nothing in app.js has to know that a horn exists.
//
// THE ONE EXCEPTION IS THE LINK. A pushrod runs from a bellcrank inside the
// wing to a horn on the aileron: one end is airframe, the other moves. It is
// published as a two-end MEMBER — G179.2's contract, which already flies every
// lift strut and every bracing wire — with the surface that moves its far end
// named on it, and the join and app.js do the rest.
//
// ---------------------------------------------------------------------------
// UNITS. Everything here is in SCENE METRES. The wing layer publishes its
// surfaces already converted (CAGE_WING.surfs); the fin and the stab publish
// theirs in their own sheet coordinates, which this multiplies by FS exactly
// as the join does. The group is NOT scaled — the hardware is metric and does
// not grow with planeScale, the gear layer's rule.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const CG2 = window.CAGE2, K = window.GEAR_KIT, HG = window.HINGE_GEN;
const FIN = window.FIN_GEN;
const revolve = K && K.revolve;
if (!K || !HG) { console.error('cage hinge layer: _gear_kit / _hinge_gen first'); return; }

const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  crs: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                  a[0] * b[1] - a[1] * b[0]],
  nrm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1;
              return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                      a[2] + (b[2] - a[2]) * t],
  len: a => Math.hypot(a[0], a[1], a[2]),
};

// ---- parameters -----------------------------------------------------------
// The trunk's four headings (SLIDER-TRUNK-2026-09-03): what is fitted, what
// TYPE and how many, where it sits, how big it is. A hinge is not a thing a
// builder positions along the aeroplane — it is on the hinge line, which the
// surface decides — so `position` here means the INSET from the surface's
// ends and where along the span the horn stands, which are the two placements
// a real builder actually chooses.
const hgDef = {
  hgOn: 1, hgFamily: 0, hgCount: 0, hgOut: 0.06,
  hgHorn: 1, hgHornAt: 0, hgHornLen: 0.085, hgSize: 1,
  hgFair: 0, hgLink: 1, hgDetail: 1,
};
const FAM = ['as built', 'strap', 'piano'];
PAGE.defaults = Object.assign(hgDef, PAGE.defaults || {});

const GROUP = ['13 · control hardware', [
  ['hgOn', 'hinges & horns', 0, 1, 1, ['off', 'on']],
  ['type', [
    ['hgFamily', 'hinge type', 0, 2, 1, FAM],
    ['hgCount', 'hinges per surface', 0, 6, 1],
  ], { when: P => +P.hgOn }],
  ['position', [
    ['hgOut', 'end inset (of the span)', 0.01, 0.20, 0.005],
    ['hgHornAt', 'horn station (± along the span)', -0.30, 0.30, 0.01,
     { when: P => +P.hgOn && +P.hgHorn }],
  ], { when: P => +P.hgOn }],
  ['size', [
    ['hgHornLen', 'horn reach (m)', 0.03, 0.20, 0.005,
     { when: P => +P.hgOn && +P.hgHorn }],
    ['hgSize', 'hardware size ×', 0.6, 1.8, 0.05],
  ], { when: P => +P.hgOn }],
  ['linkage', [
    ['hgHorn', 'control horns', 0, 1, 1, ['off', 'on']],
    ['hgLink', 'pushrods & cables', 0, 1, 1, ['off', 'on'],
     { when: P => +P.hgOn && +P.hgHorn }],
  ], { when: P => +P.hgOn }],
  ['fairings', [
    ['hgFair', 'hinge fairings', 0, 1, 1, ['off', 'on']],
  ], { when: P => +P.hgOn }],
  ['detail', [
    ['hgDetail', 'detail ×', 0.4, 2.0, 0.1],
  ], { when: P => +P.hgOn }],
], 'open'];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// ---- the surfaces this aeroplane has --------------------------------------
// Each record is what a hinge needs and nothing else: the LINE it turns
// about, the nose radius the cove was built to, the two directions of the
// section at that line, and the drawn object the moving half belongs to.
// WHICH PART THE FIXED HALF IS BOLTED TO (G300, the fitment study P1): a
// rudder's fixed straps, pins and fairings are on its FIN, an elevator's on
// its STAB — and on twin booms those are parts of their own that ride the
// boom's tail (G267.2), so hardware left in the static merge parted from the
// fin under flex (measured by GATE CLIP: 6-14 mm at a ±40 mm anchor throw).
// A wing surface's fixed half is on the wing skin, which is the static
// merge's own binding — null. The name is the join's part `src`; a build
// with no such part (a single boom) keeps the hardware static, as it was.
function hostOf(key) {
  const k = key.replace(/2$/, '');
  if (k === 'rud') return 'edFinSkin' + (key.endsWith('2') ? '2' : '');
  if (k === 'elevR') return 'edStabSkinR';
  if (k === 'elevL') return 'edStabSkinL';
  return null;
}

if (typeof window !== 'undefined') window.CAGE_HINGE_HOST = hostOf;   // GATE HINGE reads it

function surfaceList(scene, P, FS) {
  const out = [];
  const objOf = {};
  scene.traverse(o => {
    if (o.name && o.name.lastIndexOf('edSurf_', 0) === 0)
      objOf[o.name.slice(7)] = o;
  });

  // THE WING'S, already in scene metres (the wing layer converts them: it is
  // the only thing that holds the generator's rest frame)
  const WG = window.CAGE_WING;
  for (const s of (WG && WG.surfs) || []) {
    const nm = s.name;
    if (!objOf[nm]) continue;
    out.push({ key: nm, kind: s.kind, obj: objOf[nm], host: hostOf(nm),
               A: s.line[0], B: s.line[1], r: s.r,
               aft: s.aft, face: V.mul(s.up, -1),      // hardware lives UNDER a wing
               faces: 1, slide: s.slide, chord: s.chord });
  }

  // THE RUDDER. The fin layer publishes its declared hinge as a LINE in the
  // sheet's own (y, z); the sheet is at x = 0 and the group is scaled by FS,
  // which is the same conversion the join does to find the same line.
  const FN = window.CAGE_FIN;
  const TB = window.CAGE_BOOMS;
  if (FN && FN.measure && FN.measure.hinge && FN.measure.hinge.line) {
    const L = FN.measure.hinge.line, F2 = FN.measure.FS || FS;
    const thick = (P.finThick || 0.06) * F2;
    for (const [nm, xo] of TB ? [['rud', TB.x], ['rud2', -TB.x]] : [['rud', 0]]) {
      if (!objOf[nm]) continue;
      out.push({ key: nm, kind: 'rud', obj: objOf[nm], host: hostOf(nm),
                 A: [xo, L[0][0] * F2, L[0][1] * F2],
                 B: [xo, L[1][0] * F2, L[1][1] * F2],
                 r: thick * 0.5, aft: [0, 0, -1], face: [1, 0, 0], faces: 2,
                 slide: null, chord: (FN.measure.chordMean || 0.4) *
                                     (FN.measure.ctlFrac || 0.3) });
    }
  }

  // THE ELEVATORS. The stab is the fin model laid flat (G23), so its hinge
  // line has to go through the same `finToStab` the layer drew with — lay,
  // side and cant — or a canted V-tail's hardware sits in the fin's plane.
  const SB = window.CAGE_STAB;
  if (SB && SB.measure && SB.measure.hinge && SB.measure.hinge.line && SB.lay && FIN) {
    const L = SB.measure.hinge.line, F2 = SB.measure.FS || FS;
    const thick = (P.stThick || 0.05) * F2;
    for (const side of [1, -1]) {
      const nm = 'elev' + (side > 0 ? 'R' : 'L');
      if (!objOf[nm]) continue;
      const lay = Object.assign({}, SB.lay, { side });
      const map = p => FIN.finToStab({ V: [p], F: [] }, lay).V[0];
      const laid = L.map(p => V.mul(map([0, p[0], p[1]]), F2));
      // the slab's own normal, through the same map: the fin's thickness
      // direction laid flat is 'up' on a tailplane and leans on a V
      const o0 = map([0, L[0][0], L[0][1]]);
      const n1 = map([1, L[0][0], L[0][1]]);
      let nrmS = V.nrm(V.sub(n1, o0));
      if (nrmS[1] > 0) nrmS = V.mul(nrmS, -1);          // hardware hangs BELOW
      out.push({ key: nm, kind: 'elev', obj: objOf[nm], host: hostOf(nm),
                 A: laid[0], B: laid[1], r: thick * 0.5,
                 aft: [0, 0, -1], face: nrmS, faces: 1, slide: null,
                 chord: (SB.measure.chordMean || 0.4) * (SB.measure.ctlFrac || 0.3) });
    }
  }
  return out;
}

// an orthonormal frame on the hinge: z along the axis, x aft, y out through
// the face the hardware shows on. Built so z = x × y, which is what
// _hinge_gen's lug calls assume (GEAR_KIT's tang follows the binormal).
function frameOn(p, axis, aftIn, faceIn) {
  const z0 = V.nrm(axis);
  let x = V.sub(aftIn, V.mul(z0, V.dot(aftIn, z0)));
  if (V.len(x) < 1e-6) x = [1, 0, 0];
  x = V.nrm(x);
  let y = V.sub(faceIn, V.mul(x, V.dot(faceIn, x)));
  if (V.len(y) < 1e-6) y = V.crs(z0, x);
  y = V.nrm(y);
  const z = V.nrm(V.crs(x, y));
  return { p, x, y, z };
}

// ---- materials -------------------------------------------------------------
// Two sections, and the split is the one AERO_SEC already uses for hardware:
// what is STEEL is steel whatever colour the aeroplane is (a pinned finish,
// walking tint only), and what is a FAIRING is painted with the part it lies
// on (`wears: 'parent'`, G207 — the rule written for exactly this case).
const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
let FALLBACK = null;
const TINT = { metal: 0x9aa2ab, fair: 0xc8ccd2 };
const fallbackMats = () => (FALLBACK || (FALLBACK = {
  metal: lam(TINT.metal), fair: lam(TINT.fair) }));

function matFor(name) {
  const sec = name === 'fair' ? 'ctlFair' : 'ctlHinge';
  if (window.CAGE_SECMAT) {
    const ms = window.CAGE_SECMAT(sec, { surf: 0, fieldM: 1, tint0: TINT[name] });
    if (ms) return ms;
  }
  const A = window.AEROSKIN;
  if (A && A.aeroHardMat) {
    const m = A.aeroHardMat(THREE, 'hinge', name, TINT[name], {});
    if (m) return m;
  }
  return fallbackMats()[name];
}

// ---- build ----------------------------------------------------------------
let group = null;
const owned = [];                       // the meshes we attached to surfaces
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, P, stat } = ctx;
  dispose(group); group = null;
  for (const o of owned.splice(0)) dispose(o);
  if (!Math.round(P.hgOn === undefined ? 1 : P.hgOn)) return;

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const KIT = (typeof GEN_HINGE_KIT !== 'undefined') ? GEN_HINGE_KIT
            : window.GEN_HINGE_KIT;
  const HC = (typeof GEN_HINGE !== 'undefined') ? GEN_HINGE : window.GEN_HINGE;
  const stationsOf = (typeof genHingeStations === 'function') ? genHingeStations
                   : window.genHingeStations;
  const familyOf = (typeof genHingeFamily === 'function') ? genHingeFamily
                 : window.genHingeFamily;
  if (!KIT || !HC || !stationsOf) {
    if (stat) stat.textContent += '  ·  hinges: no GEN_HINGE_KIT';
    return;
  }

  const surfs = surfaceList(scene, P, FS);
  const sz = Math.max(0.4, +P.hgSize || 1);
  const detail = Math.max(0.35, +P.hgDetail || 1);
  const S0 = {
    gap: HC.gap, t: HC.strapT * Math.sqrt(sz), w: HC.strapW * sz,
    reach: HC.strapReach * sz, pinR: HC.pinR * sz,
    hornT: HC.hornT * sz, hornReach: Math.max(0.02, +P.hgHornLen || HC.hornReach),
    linkR: HC.linkR * sz, cableR: HC.cableR * sz, fairT: HC.fairT,
    detail,
  };

  // `inner` is the hardware that lives INSIDE the wing by design — the
  // bellcrank and the flap's torque-tube pivot — meshed as metal but kept
  // apart so GATE CLIP can allow it where a strap on the skin is not allowed
  // ONE SET OF AIRFRAME BAGS PER HOST: '' is the static merge (the wing's
  // hardware), 'edFinSkin' / 'edStabSkinR' ... the tail parts the halves
  // are bolted to; each set is meshed on its own and tagged `partOf`
  const HG_BAGS_F = HG.HINGE_BAGS.concat(['inner']);
  const bagsFBy = {};
  const bagsFor = host => bagsFBy[host || ''] ||
    (bagsFBy[host || ''] = { metal: K.Bag(), fair: K.Bag(), inner: K.Bag() });
  const perSurf = {};                  // key -> { metal, fair }
  const bagM = key => (perSurf[key] || (perSurf[key] = { metal: K.Bag(), fair: K.Bag() }));

  // the SURFACE's own construction decides how it hangs. genSurfKey is the
  // G213 vocabulary; the cage's per-part rows (wgCons/finCons/stCons) are
  // 0 = 'as the aeroplane', so an unset row falls through to the fuselage's.
  const consOf = kind => {
    const row = kind === 'rud' ? P.finCons : kind === 'elev' ? P.stCons : P.wgCons;
    const n = Math.round(+row || 0);
    if (n === 1) return 'fabric';
    if (n === 2) return 'ply';
    if (n === 3) return 'alloy';
    if (n === 4) return 'carbon';
    const m = String(P.material || (window.GARAGE_SPEC && window.GARAGE_SPEC.get
      && ((window.GARAGE_SPEC.get().fuselage || {}).material)) || 'tubeFabric');
    return (m === 'alu' || m === 'alloy') ? 'alloy' : m === 'carbon' ? 'carbon' : 'fabric';
  };

  const links = [], placed = [];
  for (const s of surfs) {
    const row = KIT[s.kind] || KIT.ail;
    const span = V.len(V.sub(s.B, s.A));
    if (!(span > 0.05) || !(s.r > 1e-4)) continue;
    const fam = Math.round(+P.hgFamily || 0) === 1 ? 'strap'
              : Math.round(+P.hgFamily || 0) === 2 ? 'piano'
              : (familyOf ? familyOf(consOf(s.kind)) : 'strap');
    const inset = Math.max(0.005, Math.min(0.30, +P.hgOut || HC.endInset));
    const nOver = Math.round(+P.hgCount || 0);
    const ts = stationsOf(span, nOver).map(t =>
      inset + (1 - 2 * inset) * ((t - HC.endInset) / Math.max(1e-6, 1 - 2 * HC.endInset)));
    const axis = V.sub(s.B, s.A);
    const S = Object.assign({}, S0, { r: s.r });
    const bm = bagM(s.key);
    const bagsF = bagsFor(s.host);
    // GATE CLIP reads the fixed halves per surface out of the airframe bags
    const tF0 = {}; for (const k of HG_BAGS_F) tF0[k] = bagsF[k].tris;

    // ---- the hinges ------------------------------------------------------
    const faces = row.faces || 1;
    for (const t of ts) {
      const p = V.lerp(s.A, s.B, t);
      for (let f = 0; f < faces; f++) {
        const F = frameOn(p, axis, s.aft, f ? V.mul(s.face, -1) : s.face);
        if (fam === 'piano')
          HG.pianoHinge(bagsF.metal, bm.metal, F, S,
                        span * (1 - 2 * inset) / Math.max(1, ts.length));
        else HG.strapHinge(bagsF.metal, bm.metal, F, S);
      }
    }

    // ---- the fairing, one strip per bay ----------------------------------
    if (Math.round(+P.hgFair || 0))
      for (let i = 0; i < ts.length - 1; i++) {
        const p = V.lerp(s.A, s.B, 0.5 * (ts[i] + ts[i + 1]));
        const len = span * (ts[i + 1] - ts[i]) * 0.94;
        HG.hingeFair(bagsF.fair, frameOn(p, axis, s.aft, s.face),
                     Object.assign({}, S, { fairW: s.r * 1.6 }), len);
      }

    // ---- the horn, and what reaches it -----------------------------------
    if (Math.round(P.hgHorn === undefined ? 1 : P.hgHorn)) {
      const tH = Math.max(0.03, Math.min(0.97,
        (row.hornAt || 0.15) + (+P.hgHornAt || 0)));
      const pH = V.lerp(s.A, s.B, tH);
      for (let f = 0; f < faces; f++) {
        const F = frameOn(pH, axis, s.aft, f ? V.mul(s.face, -1) : s.face);
        const eye = HG.controlHorn(bm.metal, F, S);
        if (!Math.round(P.hgLink === undefined ? 1 : P.hgLink)) continue;
        // WHERE THE OTHER END IS. A pushrod comes up from a bellcrank inside
        // the wing — the one the fittings table has had a cover over since
        // G83; a cable runs straight forward into the fuselage, which is what
        // the tail inspection ring is for; a flap rod comes off the torque
        // tube at the root. All three are AIRFRAME ends: they stay put while
        // the horn swings, which is why the link is a two-end member.
        let pin = null;
        if (row.link === 'pushrod') {
          // THE BELLCRANK SITS JUST FORWARD OF THE HINGE, inside the wing and
          // a little ABOVE the hinge line, so the rod down to the horn is
          // steep. At 280 mm forward and level with the axis — the first cut
          // — the rod ran nearly parallel to the lower skin and read as a
          // stick lying on the wing rather than as a rod coming out of it.
          const bc = HG.at(F, -0.13, -S.r * 0.25, 0);
          HG.bellcrank(bagsF.inner, frameOn(bc, axis, s.aft, s.face), S,
                       V.mul(V.nrm(V.sub(eye, bc)), 0.075),
                       V.mul(F.x, -0.075));
          pin = V.add(bc, V.mul(V.nrm(V.sub(eye, bc)), 0.075));
        } else if (row.link === 'rod') {
          pin = HG.at(F, -0.24, S.r * 1.05, 0);
          revolve(bagsF.inner, pin, F.z,
            [[S.linkR * 1.4, 0], [S.linkR * 1.4, S.w * 0.5]], 10, true);
        } else {
          pin = HG.at(F, -Math.max(0.35, s.chord * 2.0), S.hornReach, 0);
        }
        // THE LINK GETS ITS OWN BAG, and that is not a draw-call accident:
        // the join can only publish a two-end member if the member's vertices
        // are their own object. Merged into the airframe's bag they would be
        // a rod that stayed straight while the horn it is bolted to swung.
        const lb = K.Bag();
        HG.linkRod(lb, pin, eye, S, row.link === 'cable' ? 'cable' : 'pushrod');
        links.push({ key: s.key + (f ? '_b' : ''), surf: s.key,
                     kind: row.link, pin, tip: eye, bag: lb });
      }
    }

    // ---- the Fowler's track and carriage ---------------------------------
    if (s.slide && V.len(s.slide) > 1e-3) {
      const travel = V.len(s.slide);
      for (const t of [0.22, 0.78]) {
        const p = V.lerp(s.A, s.B, t);
        const F = frameOn(p, axis, s.aft, s.face);
        HG.fowlerTrack(bagsF.metal, F, S, travel, travel * 0.22);
        HG.fowlerCarriage(bm.metal, F, S);
      }
    }
    const trisF = {}; for (const k of HG_BAGS_F) trisF[k] = [tF0[k], bagsF[k].tris];
    placed.push({ key: s.key, kind: s.kind, family: fam, n: ts.length,
                  span, r: s.r, serves: row.serves, trisF, host: s.host || '' });
  }

  // ---- into the scene --------------------------------------------------
  group = new THREE.Group();
  group.name = 'cageLayer:hinge';
  let tris = 0;
  // A ROW IS ONLY REAL IF THE BUILD DREW IT (the fittings arc's own rule):
  // `matFor` CLAIMS a livery section, so calling it for an empty bag would put
  // "the hinge fairings" in the material panel of an aeroplane that has none.
  for (const host in bagsFBy) {
    const bagsF = bagsFBy[host];
    for (const k of HG_BAGS_F) {
      if (!bagsF[k].tris) continue;
      tris += bagsF[k].tris;
      const mF = bagsF[k].mesh(group, matFor(k === 'inner' ? 'metal' : k));
      if (!mF) continue;
      mF.name = 'edHinge_' + (host || 'static') + '_' + k;
      mF.userData.hingeBag = k;                // which bag: GATE CLIP's key
      mF.userData.hingeHost = host;
      if (host) mF.userData.partOf = host;     // the join bakes it into that part
    }
  }
  // THE LINKS ARE THEIR OWN OBJECTS, named and carrying their two ends and
  // the surface that moves the far one, so the join can publish each as a
  // member the flown model re-solves every frame.
  for (const L of links) {
    tris += L.bag.tris;
    const m = L.bag.mesh(group, matFor('metal'));
    if (!m) continue;
    m.name = 'edLink_' + L.key;
    m.userData.linkMember = { pin: L.pin, tip: L.tip, surf: L.surf, kind: L.kind };
  }
  scene.add(group);

  // the moving halves ride their surfaces. attach() keeps the world placement
  // and works out the local transform, which is what makes this survive the
  // fin group's scale, the boom offset and the explode slider all at once.
  scene.updateMatrixWorld(true);
  for (const s of surfs) {
    const b = perSurf[s.key];
    if (!b) continue;
    for (const k of HG.HINGE_BAGS) {
      if (!b[k].tris) continue;
      tris += b[k].tris;
      const tmp = new THREE.Group();
      const m = b[k].mesh(tmp, matFor(k));
      if (!m) continue;
      m.name = 'edHinge_' + s.key + '_' + k;
      group.add(m);
      scene.updateMatrixWorld(true);
      s.obj.attach(m);
      owned.push(m);
    }
  }

  window.CAGE_HINGE = { placed, tris, surfs: surfs.map(s => s.key), hostOf,
    links: links.map(L => ({ key: L.key, surf: L.surf, kind: L.kind,
                             pin: L.pin, tip: L.tip })) };
  if (stat)
    stat.textContent += '  ·  hinges: ' + placed.reduce((a, p) => a + p.n, 0) +
      ' on ' + placed.length + ' surfaces (' + tris + ' t)';
};

})();
