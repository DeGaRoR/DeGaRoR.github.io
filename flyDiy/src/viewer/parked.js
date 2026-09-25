// parked.js — AEROPLANES AS PROPS (G411, the user: "builds as props: can we
// have the game generate some airplanes-as-props, that we can place in the
// scenery and automatically manage the LOD levels? Ensure that layers after
// layers are removed as we get away from the plane ... No physics, just
// visual. Maybe a rough hitbox ... Fuselage, wing, engine+prop and tail
// separate and correct").
//
// WHAT A PARKED AEROPLANE IS. The SAME aeroplane the game flies — the cage
// editor's build, frozen by CAGE_JOIN.snapshot into the payload buildModel
// consumes (groups by material, parts about their pivots, the surface field,
// the material records that name their AEROSKIN finish) — stood still on its
// wheels in the world, with no solver under it. There is no second model
// path: the perfect model IS the snapshot, and this file only decides what
// of it to show at which distance.
//
// HOW IT IS MADE (the capture). The editor builds ONE aeroplane, so a parked
// one is captured by a ROUND TRIP through it: the user's editor state is
// read (GARAGE_SPEC.get), the parked spec is applied (CAGE_UI.applySpec),
// the snapshot taken (CAGE_JOIN.snapshot), the user's spec re-applied.
// Synchronous, in one task, so the editor's debounced hooks (the autosave's
// commit, the bench's fingerprint) fire on the RESTORED state: measured, the
// join's export is byte-identical before and after (the C172 archetype
// through the user's Cub: 3.6 s apply, 5.1 s snapshot, 1.5 s restore in the
// Browser pane). It runs under the loading screen (app.js's `parked` boot
// step) for the objects the world declares, and on demand when the world
// editor stands a new one.
//
// THE ONE THING A SHARED SHADER NEEDS. AEROSKIN's decals, weathering sources,
// cabin box and craft-space matrix are ONE uniform block shared by reference
// across every AEROSKIN material — a fact about THE aeroplane (aeroskin.js
// says so). A second aeroplane on the same block would wear the player's
// registration in the player's frame and the player's exhaust streaks. So a
// parked aeroplane gets a block OF ITS OWN: the editor sets the shared block
// up for the parked spec during the round trip (its own decal draw, its own
// sources), this file CLONES the block's values and a copy of the decal
// atlas at that moment, restores the shared block afterwards, and every
// material it builds points `userData.aeroD` at the clone. The shader is
// the same program; only the block differs — one program per finish, as
// before.
//
// THE LADDER (THREE.LOD): layers come off as you walk away, by IDENTITY:
//   L0    0 m   everything — interior, instruments, lamps, controls, links
//   L1   30 m   the exterior: the interior buckets (inside / char / panel /
//               lamp), the gauges, the cockpit controls, the pushrods and
//               the wires are gone; same materials, same geometry
//   L2  120 m   the exterior DECIMATED (54_decimate.js in a Worker) to ~12 %,
//               the same materials (the surface field rides through the cut
//               per wedge, so the livery and the weathering stay), the
//               buckets MERGED per material — some 25 draws instead of 110
//   L3  450 m   decimated to ~2.5 %, one vertex-coloured Standard material
//               for paint, one for bare metal, one for glass — three draws
//   L4 2500 m   nothing
// L0 IS SHELVED (G571, the user: "get rid of L0 for now (keep available for
// possible later reactivation, but transparent to the game) and have L1 by
// default ... allow plenty of planes"). By default a placement is built
// WITHOUT L0: L1 stands from 0 m, so no interior bucket, gauge, control or
// link is ever built or drawn, and with the bake in hand a parked aeroplane
// is ONE draw on ONE material at every distance it is drawn at. The rung is
// kept whole behind `PARKED.L0` (true = the full ladder above, for every
// placement built after the switch).
// L2/L3 arrive from the Worker seconds after L0/L1 (L1 stands in for them
// until then); the cut geometry is cached per key in IndexedDB so a second
// boot skips the decimation.
//
// THE FAR LEVELS BAKED (G569). The ladder above still costs a draw per
// material: ~135 at L1, ~60 at L2, for each aeroplane. A parked aeroplane
// never changes, so from L1 out it is ONE mesh with ONE standard material:
// the exterior is cut into charts (triangles sharing an edge and the axis
// they face), each laid flat on its mean facing, turned to its smallest box
// and packed into one atlas; then the FLOWN SHADER ITSELF (each bucket's own
// AEROSKIN material on this aeroplane's block — livery, weathering, grammar,
// relief) is drawn in atlas space and its albedo, normal (object space) and
// clear coat / roughness / metalness written out instead of lit. L1 is the
// full exterior on that atlas, L2 and L3 the same mesh decimated (a chart
// border is a seam the decimator keeps, so the atlas holds). The panes bake
// opaque: a dark slab with the glass's own gloss, which is what they were
// past L0. Baked once per build, kept in IndexedDB (`bake`, keyed by the
// build's content and the game's build id); a boot finds it there. Without
// a WebGL renderer (headless) the per-material ladder above stands.
//
// THE STANCE. The snapshot is in the MODEL frame (x aft, y up, z left, the
// join's pitch calibration) and its origin is the mount's. The wheels are
// parts with their axle and radius, so the resting pitch is solved off them
// — the angle at which the mains' and the third wheel's tyre bottoms share a
// height — and the whole thing lifted so the tyres sit on y = 0. Then the
// model is turned nose to +x: the object's frame is nose +x, up +y, right +z
// (the record's `yaw` is rotation.y, like every premises object).
//
// THE HITBOX. Rough, but each box is the right part: the fuselage (the body
// sections), the wing (surface class 1 + ailerons/flaps), the tail (class 2
// + rudder/elevators + fins/stab parts), one box per ENGINE (the engine and
// prop parts plus every bucket standing wholly ahead of the fuselage — the
// cowl), the gear, the floats. Axis-aligned in the object's own frame, so an
// oriented box in the world; `PARKED.hitbox(grp)` reads them, `PARKED.boxes`
// draws them.
//
// KEYS. 'arch:<key>' an archetype (CAGE_DESIGN.designBake), 'stock:<name>' a
// stock design, 'mine:<slot>' one of your own saved builds — GARAGE_SPEC's
// stockSpec / slotSpec doors (G411). The parked spec flies nobody: the pilot
// dummy and every seat's occupancy are switched off before the capture.
'use strict';
(function () {
  const PARKED_V = 2;                       // the IndexedDB schema (2: the `bake` store)
  const LEVELS = { L1: 30, L2: 120, L3: 450, cull: 2500 };
  const CUT = { L2: [0.12, 6000], L3: [0.025, 1500] };   // [share of the exterior, floor]
  const ATLAS_PX = 2048;                    // the per-craft atlas copy (the shared one is 4096)
  const WEAR = { age: 0.45, flight: 0.5, bush: 0.25, rain: 0.2 };   // a parked aeroplane has flown
  const GLASS_FAR_A = 0.8;                  // the multiply pass's slab where no cabin stands behind the pane (L1+)
  const W = (typeof window !== 'undefined') ? window : globalThis;
  const REC = {};                           // key -> the captured record
  const PENDING = [];                       // groups placed before their capture
  const log = (...a) => { if (W.PARKED && W.PARKED.quiet) return; console.log('parked:', ...a); };

  // ---- the keys and their specs ----------------------------------------------
  function keys() {
    const out = [];
    const D = W.CAGE_DESIGN;
    if (D && D.ARCHETYPES) for (const a of D.ARCHETYPES)
      if (!(D.archInactive && D.archInactive(a))) out.push(['arch:' + a.key, 'archetype · ' + a.name]);
    const G = W.GARAGE_SPEC;
    if (G && G.stock) try { for (const n of G.stock()) out.push(['stock:' + n, 'stock · ' + n]); } catch (e) {}
    if (G && G.list) try { for (const n of G.list()) out.push(['mine:' + n, 'yours · ' + n]); } catch (e) {}
    return out;
  }
  // the whole spec a key names, as the build would fly it — a copy, nobody aboard
  function specOf(key) {
    if (typeof key !== 'string') return null;
    const i = key.indexOf(':');
    const kind = key.slice(0, i), name = key.slice(i + 1);
    let spec = null;
    try {
      if (kind === 'arch') {
        const D = W.CAGE_DESIGN;
        const a = D && D.ARCHETYPES && D.ARCHETYPES.find(q => q.key === name);
        if (a) spec = D.designBake(a.sel, a.over);
      } else if (kind === 'stock') spec = W.GARAGE_SPEC && W.GARAGE_SPEC.stockSpec ? W.GARAGE_SPEC.stockSpec(name) : null;
      else if (kind === 'mine') spec = W.GARAGE_SPEC && W.GARAGE_SPEC.slotSpec ? W.GARAGE_SPEC.slotSpec(name) : null;
    } catch (e) { console.warn('parked: spec of', key, e && e.message); spec = null; }
    if (!spec) return null;
    return emptyCockpit(spec);
  }
  // NOBODY ABOARD: the pilot dummy (dumOn), the co-pilot's seat (cabOcc) and
  // every bay's occupancy (paxOcc<n>) are cage rows — deviations from the
  // template — so writing zeros is the whole of it. The lights off too.
  function emptyCockpit(spec) {
    const s = JSON.parse(JSON.stringify(spec));
    s.cage = Object.assign({}, s.cage || {});
    s.cage.dumOn = 0; s.cage.cabOcc = 0;
    for (let n = 1; n <= 6; n++) s.cage['paxOcc' + n] = 0;
    s.cage.lightOn = 0;
    return s;
  }

  // ---- the shared block: clone, copy back ---------------------------------------
  // a uniform's value is a number, a texture (shared by reference), a Vector /
  // Matrix / Color (cloned) or an array of those
  const cloneVal = v => {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (v.isTexture) return v;
    if (Array.isArray(v)) return v.map(cloneVal);
    if (typeof v.clone === 'function') return v.clone();
    return v;
  };
  const copyVal = (dst, src) => {
    if (src == null || typeof src === 'number' || typeof src === 'boolean' || src.isTexture) return src;
    if (Array.isArray(src)) { for (let i = 0; i < src.length; i++) dst[i] = copyVal(dst[i], src[i]); return dst; }
    if (dst && typeof dst.copy === 'function') { dst.copy(src); return dst; }
    return cloneVal(src);
  };
  function cloneBlock(U) { const out = {}; for (const k in U) out[k] = { value: cloneVal(U[k].value) }; return out; }
  function copyBlock(U, from) { for (const k in from) { if (!U[k]) U[k] = { value: cloneVal(from[k].value) }; else U[k].value = copyVal(U[k].value, from[k].value); } }

  // ---- the capture ---------------------------------------------------------------
  const canCapture = () => !!(W.CAGE_UI && W.CAGE_UI.applySpec && W.CAGE_JOIN && W.CAGE_JOIN.snapshot && W.GARAGE_SPEC && W.GARAGE_SPEC.get && W.THREE);
  function capture(key, spec0) {
    if (REC[key]) return REC[key];
    if (!canCapture()) return null;
    const THREE = W.THREE, A = W.AEROSKIN, WX = (typeof W.AEROWX !== 'undefined') ? W.AEROWX : null;
    const spec = spec0 || specOf(key);
    if (!spec) { console.warn('parked: no spec for', key); return null; }
    const E = W.CAGE_UI, J = W.CAGE_JOIN, G = W.GARAGE_SPEC;
    const t0 = performance.now();
    // THE USER'S AEROPLANE AS THE EDITOR HOLDS IT: the join's export merged over
    // the shelf (what a roll-out would fly), not the shelf alone — a fresh
    // session's shelf has no cage, and applySpec of a cage-less spec loads the
    // TEMPLATE over the page's own aeroplane. Measured: applySpec(preview(export))
    // leaves the export byte-identical.
    const mine = (G.preview && J.export) ? G.preview(J.export()) : G.get();
    const U = A ? A.aeroSharedU(THREE) : null;
    const saved = U ? cloneBlock(U) : null;
    const macro0 = (WX && WX.aeroWxSetMacro) ? Object.assign({}, WX.aeroWxSetMacro(THREE, null)) : null;
    const extra = W.AERO_EXTRA_DECALS;         // the bench's stickers are the player's, not this one's
    let vis = null, block = null, atlas = null, panel = {};
    try {
      W.AERO_EXTRA_DECALS = null;
      E.applySpec(spec);
      const flown = G.preview ? G.preview(spec) : spec;
      vis = J.snapshot(flown);
      if (vis && U) {
        // the block as the editor left it for THIS aeroplane, made explicit with
        // the payload's own numbers (the flight side's calls, on the same door)
        const hasGlass = Object.keys(vis.mats).some(k => vis.mats[k] && vis.mats[k].fin === 'glass');
        if (A.aeroSetCabin) A.aeroSetCabin(THREE, { coverage: hasGlass ? 1 : 0.4 });
        if (A.aeroSetFootwell) A.aeroSetFootwell(THREE, vis.footwell || null);
        if (A.aeroSetHoles) A.aeroSetHoles(THREE, vis.holes || null);
        if (A.aeroApplySpecDecals) A.aeroApplySpecDecals(THREE, flown);
        if (WX && WX.aeroWxSetSources) WX.aeroWxSetSources(THREE, Object.assign({ pivot: 1 }, vis.weather || {}));
        if (WX && WX.aeroWxSetSpiral && A.aeroDecalMerge) WX.aeroWxSetSpiral(THREE, A.aeroDecalMerge(flown));
        if (WX && WX.aeroWxSetMacro) WX.aeroWxSetMacro(THREE, WEAR);
        block = cloneBlock(U);
        atlas = copyAtlas(THREE, A);
        block.tAtlas = { value: atlas };
        // the instrument faces: the atlas the editor painted for THIS panel, copied
        panel = capturePanel(THREE, vis);
      }
    } catch (e) { console.error('parked: capture', key, e); vis = null; }
    finally {
      W.AERO_EXTRA_DECALS = extra;
      try { E.applySpec(mine); } catch (e) { console.error('parked: restore', e); }
      try { if (E.decalImagesFrom && G.images) E.decalImagesFrom(G.images() || {}); } catch (e) {}
      if (U && saved) copyBlock(U, saved);
      if (WX && macro0) WX.aeroWxSetMacro(THREE, macro0);
    }
    if (!vis) return null;
    const rec = { key, spec, vis, block, atlas, panel, t: Math.round(performance.now() - t0), far: null };
    let tris = 0; for (const k in vis.groups) tris += vis.groups[k].idx.length / 3;
    for (const p of vis.parts) for (const k in p.groups) tris += p.groups[k].idx.length / 3;
    rec.tris = tris;
    REC[key] = rec;
    log(key, 'captured:', tris, 'tris,', Object.keys(vis.mats).length, 'buckets, in', rec.t, 'ms');
    fillPending(key);
    return rec;
  }
  function copyAtlas(THREE, A) {
    try {
      const src = A.aeroAtlas(THREE), cv0 = src.image;
      const cv = document.createElement('canvas');
      cv.width = cv.height = ATLAS_PX;
      cv.getContext('2d').drawImage(cv0, 0, 0, cv0.width, cv0.height, 0, 0, ATLAS_PX, ATLAS_PX);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = W.FLYDIY_ANISO || 8;
      t.needsUpdate = true;
      return t;
    } catch (e) { return null; }
  }
  // the panel's atlas material is the SAME instance the editor painted, its
  // map the canvas the painters wrote: for a parked aeroplane the faces are
  // copied off it now, before the user's panel is painted back
  function capturePanel(THREE, vis) {
    const out = {};
    const CP = W.CAGE_PANEL;
    if (!CP || !CP.material) return out;
    const sets = new Set();
    for (const k in vis.mats) if (vis.mats[k] && vis.mats[k].panel) sets.add(vis.mats[k].panel);
    for (const set of sets) {
      try {
        const pm = CP.material(set);
        if (!pm) continue;
        const m = dupe(pm, null);
        for (const slot of ['map', 'emissiveMap', 'alphaMap']) {
          const t = pm[slot];
          if (!t || !t.image || !t.image.getContext) continue;
          const cv = document.createElement('canvas');
          cv.width = t.image.width; cv.height = t.image.height;
          cv.getContext('2d').drawImage(t.image, 0, 0);
          const t2 = new THREE.CanvasTexture(cv);
          t2.colorSpace = t.colorSpace; t2.flipY = t.flipY; t2.anisotropy = t.anisotropy;
          t2.wrapS = t.wrapS; t2.wrapT = t.wrapT; t2.needsUpdate = true;
          m[slot] = t2;
        }
        m.emissiveIntensity = 0;
        out[set] = m;
      } catch (e) {}
    }
    return out;
  }

  // ---- the stance: the resting pitch off the wheels -------------------------------
  // model frame (x aft, y up). Rotating the aeroplane by th about z takes a
  // point (x, y) to (x cos - y sin, x sin + y cos); a tyre's bottom is its axle
  // turned, less R. Two stations (the mains' mean and the third wheel) share a
  // height at: (xm - xt) sin + (ym - yt) cos = Rm - Rt. Floats and the wheel-
  // less stand level on their lowest point.
  function stance(vis) {
    const wh = { m: [], t: [] };
    for (const p of vis.parts) {
      if (p.kind === 'mainsL' || p.kind === 'mainsR') wh.m.push(p);
      else if (p.kind === 'tw') wh.t.push(p);
    }
    let th = 0;
    if (wh.m.length && wh.t.length) {
      const mean = ps => { let x = 0, y = 0, R = 0; for (const p of ps) { x += p.pivot[0]; y += p.pivot[1]; R += p.R || 0; } return [x / ps.length, y / ps.length, R / ps.length]; };
      const [xm, ym, Rm] = mean(wh.m), [xt, yt, Rt] = mean(wh.t);
      const Acoef = xm - xt, Bcoef = ym - yt, C = Rm - Rt;
      const r = Math.hypot(Acoef, Bcoef);
      if (r > 1e-6 && Math.abs(C / r) <= 1) {
        const phi = Math.atan2(Bcoef, Acoef), s = Math.asin(C / r);
        // two solutions; the one nearest level is the stance
        const c1 = s - phi, c2 = Math.PI - s - phi;
        const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
        th = Math.abs(wrap(c1)) < Math.abs(wrap(c2)) ? wrap(c1) : wrap(c2);
      }
    }
    // the lift: the lowest tyre bottom (or the lowest vertex) to y = 0
    const cs = Math.cos(th), sn = Math.sin(th);
    let low = Infinity;
    const wheels = wh.m.concat(wh.t);
    if (wheels.length) for (const p of wheels) low = Math.min(low, p.pivot[0] * sn + p.pivot[1] * cs - (p.R || 0));
    else {
      const scan = (g, dx, dy) => { const q = g.pos; for (let i = 0; i < q.length; i += 3) low = Math.min(low, (q[i] + dx) * sn + (q[i + 1] + dy) * cs); };
      for (const k in vis.groups) scan(vis.groups[k], 0, 0);
      for (const p of vis.parts) for (const k in p.groups) scan(p.groups[k], p.stretch ? 0 : p.pivot[0], p.stretch ? 0 : p.pivot[1]);
    }
    if (!isFinite(low)) low = 0;
    return { pitch: th, lift: -low };
  }

  // ---- what shows at which level ---------------------------------------------------
  const isInterior = m => !!(m && (m.inside || m.char || m.panel || m.lamp || m.lampCup));
  const PART_L1 = p => !(p.kind === 'gauge' || p.kind === 'ctlMove' || p.kind === 'ctlLink' || p.kind === 'wire');
  const isClear = m => !!(m && (m.fin === 'glass' || (m.opacity != null && m.opacity < 1)));

  // ---- the materials: the flight's own factory calls, on the craft's own block ----
  // AEROSKIN POOLS its materials by key (aeroskin.js's AERO_POOL): the same
  // finish and tint on the parked aeroplane and on the player's IS one
  // object, so pointing its `aeroD` at the parked block would repaint the
  // player. Every pooled material is DUPLICATED here — a fresh instance of
  // the same class with the same fields, defines and hook (Material.copy
  // would JSON-clone userData, textures and all: the userData is moved aside
  // for the copy and re-attached shallow, the per-finish uniforms shared by
  // reference as the pool shares them) — and the copy takes the block. A
  // ShaderMaterial (the glass tint) takes it into its own uniforms instead.
  // THE HOOK AS THE MATERIAL WAS GIVEN IT. Since G432.2 atmo.js makes
  // Material.prototype.onBeforeCompile an ACCESSOR: a material's own hook is
  // kept on `_atmoHook` and served back wrapped in the aerial perspective's
  // inject, so it is no longer an OWN property of anything. G411's
  // hasOwnProperty test then found nothing and every copy went out HOOKLESS -
  // a plain Standard / Physical material wearing the finish's scalars: no
  // decals (the C172's whole livery is a marking-kit decal over bare alclad),
  // no weathering, no surface grammar, and the glass without its shader - a
  // flat additive film of its body colour, the milky blue pane. Read the raw
  // hook from either place and hand it to the copy through the same door
  // (the setter), so the copy compiles the flown aeroplane's program.
  function hookOf(m) {
    if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) return m.onBeforeCompile;
    return m._atmoHook || null;
  }
  function dupe(m, block) {
    if (!m) return m;
    const ud = m.userData; m.userData = {};
    let c;
    try { c = new m.constructor(); c.copy(m); } finally { m.userData = ud; }
    c.userData = Object.assign({}, ud, block ? { aeroD: block } : {}, { parked: 1 });
    if (m.defines) c.defines = Object.assign({}, m.defines);
    for (const k of ['clearcoat', 'clearcoatRoughness', 'transmission', 'envMapIntensity'])
      if (m[k] !== undefined && c[k] !== undefined) c[k] = m[k];
    const hook = hookOf(m);
    if (hook) c.onBeforeCompile = hook;
    if (block && c.isShaderMaterial && c.uniforms) for (const k in block) if (c.uniforms[k]) c.uniforms[k] = block[k];
    c.needsUpdate = true;
    return c;
  }
  function makeMats(THREE, rec, block) {
    const A = W.AEROSKIN, vis = rec.vis, mats = vis.mats, cache = {};
    const onBlock = m => dupe(m, block);
    const spec = rec.spec;
    const matFor = function (mn) {
      if (cache[mn]) return cache[mn];
      const m = mats[mn] || { color: 0x808080 };
      const op = m.opacity !== undefined ? m.opacity : 1;
      if (A && m.fin) {
        if (m.fin === 'glass') {
          const g = A.aeroGlass(THREE, Object.assign(A.aeroGlassSpec ? A.aeroGlassSpec(spec) : {},
            { tintLin: m.color, opacity: op, ext: m.gext, fieldM: m.fieldM || 1,
              wear: m.wearM != null ? m.wearM : 1, screen: m.sec === 'windshield' ? 1 : 0 }));
          return cache[mn] = onBlock(g);
        }
        const s = A.aeroMaterial(THREE, { finish: m.fin, tintLin: m.color,
          grm: m.grm || '', struct: m.grm ? 1 : 0, opacity: op, fieldM: m.fieldM || 1,
          surf: m.surf ? 1 : 0, boxDet: m.boxDet || 0, boxPlane: m.boxPlane || 0,
          detRot: m.detRot || 0, spin: m.spin || 0, hole: m.sec === 'dashFace' ? 1 : 0,
          wing: m.wing || 0, tileK: m.tileK, roughK: m.roughK, nrmK: m.nrmK,
          ccK: m.ccK, fieldK: m.fieldK, fieldLK: m.fieldLK, inside: m.inside || 0,
          decals: m.noDec ? 0 : 1, memF: m.memF || null, metalK: m.metalK || 0,
          ribM: m.ribM, wearK: m.wearK, wearM: m.wearM, side: THREE.DoubleSide });
        return cache[mn] = onBlock(s);
      }
      if (m.panel && rec.panel && rec.panel[m.panel]) return cache[mn] = rec.panel[m.panel];
      if (m.propMat && typeof W.propBuild === 'function') {
        try {
          const [pk, pm] = m.propMat.split('|');
          const b = W.propBuild(THREE, pk);
          const i = b.prop.parts.findIndex(q => q.mat === pm);
          if (i >= 0) return cache[mn] = b.mats[i];
        } catch (e) {}
      }
      if ((m.lamp || m.lampCup) && W.CAGE_LIGHT) {
        const src = m.lamp && W.CAGE_LIGHT.lensMat ? W.CAGE_LIGHT.lensMat(m.lamp, 1.0, m.lampCol)
                  : m.lampCup && W.CAGE_LIGHT.cupMat ? W.CAGE_LIGHT.cupMat(1.0, m.lampCol, true, m.lampCup, m.lampK) : null;
        if (src) { const lm = src.clone(); lm.userData = Object.assign({}, src.userData); lm.emissiveIntensity = 0;
                   const hook = hookOf(src); if (hook) lm.onBeforeCompile = hook;   // clone() drops it too
                   return cache[mn] = lm; }
      }
      if (m.ves && W.CAGE_ENERGY && W.CAGE_ENERGY.material)
        return cache[mn] = W.CAGE_ENERGY.material({ set: m.ves, tint: m.color, hueRad: m.vesHue || 0, hueOn: !!m.vesHueOn });
      const std = new THREE.MeshStandardMaterial({
        color: m.color !== undefined ? m.color : 0xaad4ea, side: THREE.DoubleSide,
        transparent: op < 1, opacity: op, depthWrite: op >= 1,
        ...(m.alphaTest ? { alphaTest: m.alphaTest } : {}),
        roughness: m.rough !== undefined ? m.rough : 0.72, metalness: m.metal !== undefined ? m.metal : 0 });
      // a plain inside bucket takes the cabin's darkness through the small hook —
      // its own instance already, so the block goes straight on
      if (m.inside && A && A.aeroCabinHook) { A.aeroCabinHook(THREE, std, 1); if (block) std.userData.aeroD = block; }
      return cache[mn] = std;
    };
    matFor.block = block;
    // THE PANE'S MULTIPLY PASS (aeroskin.js's glass family: a pane is a
    // multiply companion under the add pass), one per pane material and
    // level kind rather than one per mesh. `dark` is for the levels with NO
    // CABIN behind the glass (L1 and past): there the eye looks through both
    // flanks at the sky, and a pane that transmits 70 % reads as a milky
    // sheet of it - the parked Cub at 40 m. A real cabin seen from outside
    // is a dim room lit through its own windows, so past L0 the slab stops
    // most of what is behind it (GLASS_FAR_A) and the add pass - the
    // reflection, unchanged - carries the pane, as it does on the flown
    // aeroplane over its dark interior.
    const tints = new Map();
    matFor.tint = (m0, dark) => {
      const k = m0.uuid + (dark ? '|dark' : '');
      if (tints.has(k)) return tints.get(k);
      const t = dupe(A.aeroGlassTint(THREE, { tintLin: m0.color.getHex(), opacity: m0.opacity }), block);
      if (dark && t.uniforms && t.uniforms.uA) t.uniforms.uA = { value: Math.max(+t.uniforms.uA.value || 0, GLASS_FAR_A) };
      tints.set(k, t);
      return t;
    };
    return matFor;
  }
  function geoOf(THREE, g) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(g.uv || new Float32Array((g.pos.length / 3) * 2), 2));
    if (g.srf) geo.setAttribute('aStruct', new THREE.BufferAttribute(g.srf, 4));
    if (g.nrm) geo.setAttribute('normal', new THREE.BufferAttribute(g.nrm, 3)); else geo.computeVertexNormals();
    geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
    return geo;
  }
  // one level's meshes, over shared geometries (built once per record) and the
  // record's materials; `full` includes the interior and the small parts
  function levelMeshes(THREE, rec, matFor, full) {
    const A = W.AEROSKIN, vis = rec.vis, geos = rec.geos;
    const root = new THREE.Group();
    const add = (k, g, at) => {
      const m = vis.mats[k];
      if (!full && isInterior(m)) return;
      const geo = geos.get(g) || (geos.set(g, geoOf(THREE, g)), geos.get(g));
      const mesh = new THREE.Mesh(geo, matFor(k));
      const clear = isClear(m);
      mesh.renderOrder = clear ? 10 : 0;
      mesh.castShadow = !clear; mesh.receiveShadow = true;
      if (at) mesh.position.set(at[0], at[1], at[2]);
      if (A && A.aeroGlassCompanion && m && m.fin === 'glass')
        A.aeroGlassCompanion(THREE, mesh, mesh.material, m0 => matFor.tint(m0, !full));
      root.add(mesh);
    };
    for (const k in vis.groups) add(k, vis.groups[k], null);
    for (const p of vis.parts) {
      if (!full && !PART_L1(p)) continue;
      for (const k in p.groups) add(k, p.groups[k], p.stretch ? null : p.pivot);
    }
    return root;
  }

  // ---- the far levels: the exterior as one wedge mesh, cut in a Worker -------------
  // the exterior's buckets concatenated (pivots applied), a bucket id per wedge,
  // and the three material classes the far levels draw
  function exteriorMesh(rec) {
    const vis = rec.vis;
    const parts = [];
    for (const k in vis.groups) if (!isInterior(vis.mats[k])) parts.push([k, vis.groups[k], null]);
    for (const p of vis.parts) { if (!PART_L1(p)) continue; for (const k in p.groups) if (!isInterior(vis.mats[k])) parts.push([k, p.groups[k], p.stretch ? null : p.pivot]); }
    let nv = 0, nt = 0;
    for (const [, g] of parts) { nv += g.pos.length / 3; nt += g.idx.length / 3; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = new Uint32Array(nt * 3), wb = new Uint16Array(nv);
    const srf = new Float32Array(nv * 4), uv = new Float32Array(nv * 2);   // per wedge, for the L2 materials
    const buckets = [];
    let vo = 0, io = 0;
    const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const [k, g, at] of parts) {
      const b = buckets.length;
      const m = vis.mats[k] || {};
      buckets.push({ key: k, color: m.color != null ? m.color : 0x808080, metal: m.metal || 0, rough: m.rough != null ? m.rough : 0.7, glass: isClear(m) });
      const n = g.pos.length / 3;
      for (let i = 0; i < n; i++) {
        const x = g.pos[i * 3] + (at ? at[0] : 0), y = g.pos[i * 3 + 1] + (at ? at[1] : 0), z = g.pos[i * 3 + 2] + (at ? at[2] : 0);
        pos[(vo + i) * 3] = x; pos[(vo + i) * 3 + 1] = y; pos[(vo + i) * 3 + 2] = z;
        if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (z < bb[2]) bb[2] = z;
        if (x > bb[3]) bb[3] = x; if (y > bb[4]) bb[4] = y; if (z > bb[5]) bb[5] = z;
        wb[vo + i] = b;
      }
      if (g.nrm) nrm.set(g.nrm, vo * 3);
      if (g.srf) srf.set(g.srf, vo * 4);
      if (g.uv) uv.set(g.uv.subarray(0, n * 2), vo * 2);
      for (let i = 0; i < g.idx.length; i++) idx[io + i] = g.idx[i] + vo;
      vo += n; io += g.idx.length;
    }
    for (let a = 0; a < 3; a++) { if (bb[a + 3] - bb[a] < 1e-3) bb[a + 3] = bb[a] + 1e-3; }
    return { pos, nrm, idx, wb, buckets, bb, nt, srf, uv };
  }
  // the worker: the decimator's own source plus a job that quantises, cuts
  // each target from the previous level's mesh, and hands the levels back
  const WORKER_JOB = `
self.onmessage = function (e) {
  const D = e.data, bb = D.bb, nv = D.pos.length / 3;
  const sx = 65535 / (bb[3] - bb[0]), sy = 65535 / (bb[4] - bb[1]), sz = 65535 / (bb[5] - bb[2]);
  const q = new Int16Array(nv * 3), n8 = new Int8Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    q[i * 3] = Math.round((D.pos[i * 3] - bb[0]) * sx) - 32768;
    q[i * 3 + 1] = Math.round((D.pos[i * 3 + 1] - bb[1]) * sy) - 32768;
    q[i * 3 + 2] = Math.round((D.pos[i * 3 + 2] - bb[2]) * sz) - 32768;
    n8[i * 3] = Math.max(-127, Math.min(127, Math.round(D.nrm[i * 3] * 127)));
    n8[i * 3 + 1] = Math.max(-127, Math.min(127, Math.round(D.nrm[i * 3 + 1] * 127)));
    n8[i * 3 + 2] = Math.max(-127, Math.min(127, Math.round(D.nrm[i * 3 + 2] * 127)));
  }
  let M = { nv, nt: D.idx.length / 3, pos: q, nrm: n8, idx: D.idx };
  const out = [], t0 = Date.now();
  for (const target of D.targets) {
    const r = meshDecimate(M, bb, target, D.opt);
    M = { nv: M.nv, nt: r.nt, pos: M.pos, nrm: M.nrm, idx: Uint32Array.from(r.idx) };
    out.push({ idx: M.idx, pos: M.pos.slice(), nt: r.nt, ms: Date.now() - t0 });
  }
  const tr = []; for (const o of out) { tr.push(o.idx.buffer, o.pos.buffer); }
  self.postMessage({ out, nrm: n8 }, tr.concat([n8.buffer]));
};`;
  let workerURL = null;
  function decimateAsync(job, cb) {
    const SRC = (typeof MESH_DECIMATE_SRC !== 'undefined') ? MESH_DECIMATE_SRC : (W.MESH_DECIMATE_SRC || null);
    if (!SRC) { cb(null, 'no decimator'); return; }
    const run = () => {
      try {
        if (!workerURL) workerURL = URL.createObjectURL(new Blob([SRC + '\n' + WORKER_JOB], { type: 'text/javascript' }));
        const w = new Worker(workerURL);
        w.onmessage = e => { w.terminate(); cb(e.data, null); };
        w.onerror = e => { w.terminate(); cb(null, e && e.message || 'worker error'); };
        w.postMessage(job);
      } catch (e) {
        // no Worker (file://, a sandbox): the same job on the main thread, later
        console.warn('parked: no worker, decimating inline:', e && e.message);
        setTimeout(() => {
          try {
            const scope = { onmessage: null, postMessage: (d) => cb(d, null) };
            new Function('self', 'meshDecimate', WORKER_JOB)(scope, (typeof meshDecimate === 'function') ? meshDecimate : W.meshDecimate);
            scope.onmessage({ data: job });
          } catch (e2) { cb(null, e2 && e2.message); }
        }, 0);
      }
    };
    run();
  }
  // a cut level back into meshes, three vertices a triangle (a few thousand
  // triangles: unwelded is fine). With `matFor` (L2) the triangles are grouped
  // by the MATERIAL their bucket resolves to — the real one, on the craft's
  // block, with the surface field and the uv the wedges kept through the cut
  // — so the livery, the weathering and the finish stay and the draw count is
  // the number of distinct materials. Without (L3): paint / metal / glass,
  // vertex colours, three draws.
  function farLevel(THREE, ext, lvl, nrm, matFor) {
    const bb = ext.bb, sx = (bb[3] - bb[0]) / 65535, sy = (bb[4] - bb[1]) / 65535, sz = (bb[5] - bb[2]) / 65535;
    const groups = new Map();       // material (or class) -> { mat, ts, clear }
    for (let t = 0; t < lvl.nt; t++) {
      const b = ext.buckets[ext.wb[lvl.idx[t * 3]]];
      let key, mat;
      if (matFor) { mat = matFor(b.key); key = mat; }
      else { key = b.glass ? 2 : (b.metal >= 0.5 ? 1 : 0); mat = null; }
      let g = groups.get(key);
      if (!g) groups.set(key, g = { mat, ts: [], clear: !!b.glass, cls: matFor ? -1 : key });
      g.ts.push(t);
    }
    const root = new THREE.Group();
    const col = new THREE.Color();
    for (const g of groups.values()) {
      const ts = g.ts, n = ts.length;
      const P = new Float32Array(n * 9), N = new Float32Array(n * 9);
      const C = matFor ? null : new Float32Array(n * 9);
      const S = matFor ? new Float32Array(n * 12) : null, U = matFor ? new Float32Array(n * 6) : null;
      let o = 0;
      for (const t of ts) {
        const b = ext.buckets[ext.wb[lvl.idx[t * 3]]];
        if (C) col.setHex(b.color);
        for (let e = 0; e < 3; e++) {
          const w = lvl.idx[t * 3 + e], v = o / 3;
          P[o] = bb[0] + (lvl.pos[w * 3] + 32768) * sx; P[o + 1] = bb[1] + (lvl.pos[w * 3 + 1] + 32768) * sy; P[o + 2] = bb[2] + (lvl.pos[w * 3 + 2] + 32768) * sz;
          N[o] = nrm[w * 3] / 127; N[o + 1] = nrm[w * 3 + 1] / 127; N[o + 2] = nrm[w * 3 + 2] / 127;
          if (C) { C[o] = col.r; C[o + 1] = col.g; C[o + 2] = col.b; }
          if (S) { S[v * 4] = ext.srf[w * 4]; S[v * 4 + 1] = ext.srf[w * 4 + 1]; S[v * 4 + 2] = ext.srf[w * 4 + 2]; S[v * 4 + 3] = ext.srf[w * 4 + 3];
                   U[v * 2] = ext.uv[w * 2]; U[v * 2 + 1] = ext.uv[w * 2 + 1]; }
          o += 3;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      if (C) geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
      if (S) { geo.setAttribute('aStruct', new THREE.BufferAttribute(S, 4)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); }
      const mat = g.mat ? g.mat
        : g.cls === 2 ? new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.15, metalness: 0.0, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: g.cls === 1 ? 0.35 : 0.6, metalness: g.cls === 1 ? 0.9 : 0.0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = g.clear ? 10 : 0;
      mesh.castShadow = !g.clear; mesh.receiveShadow = true;
      // L2's panes are the real glass too: the add pass alone (all this level
      // drew until now) is a film of the pane's body colour over the sky
      const AS = W.AEROSKIN;
      if (matFor && matFor.tint && AS && AS.aeroGlassCompanion && mat.userData && mat.userData.aeroFinish === 'glass')
        AS.aeroGlassCompanion(THREE, mesh, mat, m0 => matFor.tint(m0, true));
      root.add(mesh);
    }
    return root;
  }
  function cutFar(THREE, rec, onDone) {
    if (rec.far || rec.cutting) { if (rec.far && onDone) onDone(rec.far); return; }
    rec.cutting = true;
    const ext = exteriorMesh(rec);
    const targets = ['L2', 'L3'].map(L => Math.max(CUT[L][1], Math.round(CUT[L][0] * ext.nt)));
    const job = { pos: ext.pos, nrm: ext.nrm, idx: ext.idx, bb: ext.bb, targets };
    const t0 = performance.now();
    decimateAsync(job, (res, err) => {
      rec.cutting = false;
      if (!res) { console.warn('parked: far levels of', rec.key, 'not cut:', err); return; }
      rec.far = { ext: { bb: ext.bb, wb: ext.wb, buckets: ext.buckets }, levels: res.out, nrm: res.nrm, ms: Math.round(performance.now() - t0) };
      log(rec.key, 'far levels:', res.out.map(o => o.nt).join(' / '), 'tris of', ext.nt, 'in', rec.far.ms, 'ms');
      cachePut(rec).catch(() => {});
      if (onDone) onDone(rec.far);
    });
  }

  // ---- IndexedDB: the far levels, so a second boot skips the cut ----------------------
  const DB = { name: 'flydiy.parked', store: 'far', p: null };
  function db() {
    if (DB.p) return DB.p;
    DB.p = new Promise((res, rej) => {
      try {
        const rq = indexedDB.open(DB.name, PARKED_V);
        rq.onupgradeneeded = () => { const d = rq.result; for (const st of [DB.store, 'bake']) if (!d.objectStoreNames.contains(st)) d.createObjectStore(st); };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    });
    return DB.p;
  }
  const cacheKey = rec => rec.key + '|' + rec.tris + '|' + Object.keys(rec.vis.mats).length + '|' + ((typeof GEN_SPEC_V !== 'undefined') ? GEN_SPEC_V : 0);
  async function cacheGet(rec) {
    try {
      const d = await db();
      return await new Promise((res, rej) => { const tx = d.transaction(DB.store, 'readonly'); const rq = tx.objectStore(DB.store).get(cacheKey(rec)); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); });
    } catch (e) { return null; }
  }
  async function cachePut(rec) {
    if (!rec.far) return;
    const d = await db();
    await new Promise((res, rej) => { const tx = d.transaction(DB.store, 'readwrite'); tx.objectStore(DB.store).put({ far: rec.far, when: Date.now() }, cacheKey(rec)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }

  // ---- THE FAR LEVELS BAKED (G569): one atlas, one material, one draw a level ----------
  // S the atlas side (1024: the C172's 97 m2 of exterior at ~1.4 cm a texel, twice what
  // a 1080p eye resolves at 30 m); gutter the texels round each chart; glassK what of
  // the pane's tint the opaque slab keeps; seam the decimator's weight on a chart border
  const BAKE = { on: true, V: 1, S: 1024, gutter: 1, glassK: 0.12, seam: 12 };

  // THE UNWRAP. The snapshot's buckets are triangle soups, so the positions are welded
  // first (on a 17-bit grid over the box). A CHART is the triangles that share an edge
  // and face the same way (the axis their winding's normal leans on most, signed) — a
  // height field over that axis, so laid flat it does not fold over itself. Each chart
  // is projected on its own mean facing (the axis itself when that would turn a
  // triangle over), turned to the smallest box round its hull, long side along u, and
  // never mirrored: every triangle stays counter-clockwise in the atlas, so the bake
  // sees each face from its front. The boxes are packed bottom-left under a skyline and
  // the texel density searched until they just fit. Out: the welded mesh (a wedge per
  // chart and position — a chart border is a seam), its atlas uv, and each corner's uv
  // for the bake's soups.
  function unwrap(ext, opt) {
    const S = (opt && opt.S) || BAKE.S, G = (opt && opt.gutter != null) ? opt.gutter : BAKE.gutter;
    const nt = ext.nt, P = ext.pos, I = ext.idx, NR = ext.nrm, nv = P.length / 3, bb = ext.bb;
    const kx = 131071 / (bb[3] - bb[0]), ky = 131071 / (bb[4] - bb[1]), kz = 131071 / (bb[5] - bb[2]);
    const pid = new Int32Array(nv), pmap = new Map();
    let np = 0;
    for (let i = 0; i < nv; i++) {
      const k = Math.round((P[i * 3] - bb[0]) * kx) * 17179869184 + Math.round((P[i * 3 + 1] - bb[1]) * ky) * 131072 + Math.round((P[i * 3 + 2] - bb[2]) * kz);
      let p = pmap.get(k); if (p === undefined) { p = np++; pmap.set(k, p); } pid[i] = p;
    }
    pmap.clear();
    const fn = new Float32Array(nt * 3), area = new Float32Array(nt), lab = new Uint8Array(nt);
    for (let t = 0; t < nt; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-14) { nx = NR[a] + NR[b] + NR[c]; ny = NR[a + 1] + NR[b + 1] + NR[c + 1]; nz = NR[a + 2] + NR[b + 2] + NR[c + 2]; const m = Math.hypot(nx, ny, nz) || 1; nx /= m; ny /= m; nz /= m; }
      else { nx /= l; ny /= l; nz /= l; }
      fn[t * 3] = nx; fn[t * 3 + 1] = ny; fn[t * 3 + 2] = nz; area[t] = l * 0.5;
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      lab[t] = ax >= ay && ax >= az ? (nx >= 0 ? 0 : 1) : ay >= az ? (ny >= 0 ? 2 : 3) : (nz >= 0 ? 4 : 5);
    }
    // the charts (union-find over the edges a facing shares)
    const par = new Int32Array(nt); for (let t = 0; t < nt; t++) par[t] = t;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const emap = new Map();
    for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) {
      let a = pid[I[t * 3 + e]], b = pid[I[t * 3 + (e + 1) % 3]];
      if (a === b) continue;
      if (a > b) { const s = a; a = b; b = s; }
      const k = (a * np + b) * 6 + lab[t], o = emap.get(k);
      if (o === undefined) emap.set(k, t); else { const ra = find(t), rb = find(o); if (ra !== rb) par[ra] = rb; }
    }
    emap.clear();
    const cid = new Int32Array(nt), roots = new Map();
    let nc = 0;
    for (let t = 0; t < nt; t++) { const r = find(t); let c = roots.get(r); if (c === undefined) { c = nc++; roots.set(r, c); } cid[t] = c; }
    const cStart = new Int32Array(nc + 1); for (let t = 0; t < nt; t++) cStart[cid[t] + 1]++;
    for (let c = 0; c < nc; c++) cStart[c + 1] += cStart[c];
    const cTri = new Int32Array(nt), at = cStart.slice(0, nc);
    for (let t = 0; t < nt; t++) cTri[at[cid[t]]++] = t;
    // each chart flat, turned, in its box
    const stamp = new Int32Array(np).fill(-1), wloc = new Int32Array(np), cornerW = new Int32Array(nt * 3);
    const wCorner = [], wU = [], wV = [], charts = [];
    const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const basis = N => { const up = Math.abs(N[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const U = [up[1] * N[2] - up[2] * N[1], up[2] * N[0] - up[0] * N[2], up[0] * N[1] - up[1] * N[0]], l = Math.hypot(U[0], U[1], U[2]);
      U[0] /= l; U[1] /= l; U[2] /= l;
      return [U, [N[1] * U[2] - N[2] * U[1], N[2] * U[0] - N[0] * U[2], N[0] * U[1] - N[1] * U[0]]]; };   // U x V = N
    let nw = 0, nAxis = 0;
    for (let c = 0; c < nc; c++) {
      const t0 = cStart[c], t1 = cStart[c + 1], w0 = nw;
      let Nx = 0, Ny = 0, Nz = 0, A = 0;
      for (let i = t0; i < t1; i++) { const t = cTri[i]; Nx += fn[t * 3] * area[t]; Ny += fn[t * 3 + 1] * area[t]; Nz += fn[t * 3 + 2] * area[t]; A += area[t];
        for (let e = 0; e < 3; e++) { const v = I[t * 3 + e], p = pid[v];
          if (stamp[p] !== c) { stamp[p] = c; wloc[p] = nw++; wCorner.push(v); wU.push(0); wV.push(0); }
          cornerW[t * 3 + e] = wloc[p]; } }
      const project = ([U, V]) => { for (let w = w0; w < nw; w++) { const v = wCorner[w] * 3; wU[w] = P[v] * U[0] + P[v + 1] * U[1] + P[v + 2] * U[2]; wV[w] = P[v] * V[0] + P[v + 1] * V[1] + P[v + 2] * V[2]; } };
      const folds = () => { for (let i = t0; i < t1; i++) { const t = cTri[i], a = cornerW[t * 3], b = cornerW[t * 3 + 1], d = cornerW[t * 3 + 2];
        if ((wU[b] - wU[a]) * (wV[d] - wV[a]) - (wV[b] - wV[a]) * (wU[d] - wU[a]) < -1e-3 * area[t] - 1e-12) return true; } return false; };
      const nl = Math.hypot(Nx, Ny, Nz);
      let ok = false;
      if (nl > 1e-9 * (A + 1e-12)) { project(basis([Nx / nl, Ny / nl, Nz / nl])); ok = !folds(); }
      if (!ok) { nAxis++; project(basis(AX[lab[cTri[t0]]])); }
      // the smallest box, over the hull's edge directions (90 sampled turns round a long hull)
      const pts = []; for (let w = w0; w < nw; w++) pts.push(w);
      pts.sort((a, b) => wU[a] - wU[b] || wV[a] - wV[b]);
      const cross = (o, a, b) => (wU[a] - wU[o]) * (wV[b] - wV[o]) - (wV[a] - wV[o]) * (wU[b] - wU[o]);
      const lo = [], hi = [];
      for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
      const hull = pts.length > 2 ? lo.slice(0, -1).concat(hi.slice(0, -1)) : pts;
      const angles = [];
      if (hull.length > 1 && hull.length <= 200) for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; angles.push(Math.atan2(wV[b] - wV[a], wU[b] - wU[a])); }
      else for (let i = 0; i < 90; i++) angles.push(i * Math.PI / 180);
      let best = null;
      for (const th of angles) {
        const cs = Math.cos(th), sn = Math.sin(th);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of hull) { const x = wU[p] * cs + wV[p] * sn, y = -wU[p] * sn + wV[p] * cs; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const ar = (x1 - x0) * (y1 - y0);
        if (!best || ar < best.ar - 1e-12) best = { ar, cs, sn, w: x1 - x0, h: y1 - y0 };
      }
      let { cs, sn, w, h } = best;
      if (h > w) { const c2 = -sn, s2 = cs; cs = c2; sn = s2; const s = w; w = h; h = s; }   // a quarter turn more, not a mirror
      let x0 = Infinity, y0 = Infinity;
      for (let q = w0; q < nw; q++) { const x = wU[q] * cs + wV[q] * sn, y = -wU[q] * sn + wV[q] * cs; wU[q] = x; wV[q] = y; if (x < x0) x0 = x; if (y < y0) y0 = y; }
      for (let q = w0; q < nw; q++) { wU[q] -= x0; wV[q] -= y0; }
      charts.push({ w0, w1: nw, w: Math.max(w, 1e-6), h: Math.max(h, 1e-6), area: A, x: 0, y: 0 });
    }
    // the packing: tallest first, each box where its top stands lowest under the skyline
    const order = charts.map((c, i) => i).sort((a, b) => charts[b].h - charts[a].h || charts[b].w - charts[a].w);
    const rectOf = (c, s) => [Math.max(1, Math.ceil(c.w * s)) + 2 * G, Math.max(1, Math.ceil(c.h * s)) + 2 * G];
    function pack(s, commit) {
      let sky = [{ x: 0, y: 0, w: S }];
      for (const i of order) {
        const c = charts[i], [rw, rh] = rectOf(c, s);
        if (rw > S) return false;
        let by = Infinity, bx = -1;
        for (let k = 0; k < sky.length; k++) {
          const x = sky[k].x; if (x + rw > S) break;
          let y = 0, wl = rw, j = k;
          while (wl > 0) { if (sky[j].y > y) y = sky[j].y; wl -= sky[j].w; j++; }
          if (y + rh <= S && y < by) { by = y; bx = x; }
        }
        if (bx < 0) return false;
        if (commit) { c.x = bx; c.y = by; }
        const next = [];
        for (const g of sky) {
          if (g.x + g.w <= bx || g.x >= bx + rw) { next.push(g); continue; }
          if (g.x < bx) next.push({ x: g.x, y: g.y, w: bx - g.x });
          if (g.x + g.w > bx + rw) next.push({ x: bx + rw, y: g.y, w: g.x + g.w - bx - rw });
        }
        next.push({ x: bx, y: by + rh, w: rw });
        next.sort((a, b) => a.x - b.x);
        sky = [];
        for (const g of next) { const l = sky[sky.length - 1]; if (l && l.y === g.y && l.x + l.w === g.x) l.w += g.w; else sky.push(g); }
      }
      return true;
    }
    let bbA = 0; for (const c of charts) bbA += c.w * c.h;
    let lo = 0, hi = Math.sqrt(S * S / Math.max(bbA, 1e-9)) * 1.2;
    while (pack(hi, false)) { lo = hi; hi *= 1.3; }
    if (!lo) { lo = hi; while (lo > 1e-3 && !pack(lo, false)) lo *= 0.85; }
    for (let it = 0; it < 10; it++) { const m = (lo + hi) / 2; if (pack(m, false)) lo = m; else hi = m; }
    const s = lo;
    if (!pack(s, true)) return null;
    // the atlas coordinates (a chart under a texel is stretched to one, so the bake reaches it)
    const uv = new Float32Array(nw * 2);
    let texels = 0;
    for (const c of charts) {
      const sx = c.w * s < 1 ? 1 / c.w : s, sy = c.h * s < 1 ? 1 / c.h : s;
      texels += Math.max(1, Math.ceil(c.w * s)) * Math.max(1, Math.ceil(c.h * s));
      for (let q = c.w0; q < c.w1; q++) { uv[q * 2] = (c.x + G + wU[q] * sx) / S; uv[q * 2 + 1] = (c.y + G + wV[q] * sy) / S; }
    }
    const pos = new Float32Array(nw * 3), nrm = new Float32Array(nw * 3), idx = new Uint32Array(nt * 3), cornerUV = new Float32Array(nt * 6);
    for (let w = 0; w < nw; w++) { const v = wCorner[w] * 3; pos[w * 3] = P[v]; pos[w * 3 + 1] = P[v + 1]; pos[w * 3 + 2] = P[v + 2]; }
    for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) {
      const w = cornerW[t * 3 + e], v = I[t * 3 + e] * 3;
      idx[t * 3 + e] = w; cornerUV[(t * 3 + e) * 2] = uv[w * 2]; cornerUV[(t * 3 + e) * 2 + 1] = uv[w * 2 + 1];
      nrm[w * 3] += NR[v] * area[t]; nrm[w * 3 + 1] += NR[v + 1] * area[t]; nrm[w * 3 + 2] += NR[v + 2] * area[t];
    }
    for (let w = 0; w < nw; w++) { const l = Math.hypot(nrm[w * 3], nrm[w * 3 + 1], nrm[w * 3 + 2]); if (l > 0) { nrm[w * 3] /= l; nrm[w * 3 + 1] /= l; nrm[w * 3 + 2] /= l; } else nrm[w * 3 + 1] = 1; }
    return { S, gutter: G, density: s, charts: nc, axis: nAxis, fill: texels / (S * S), nv: nw, nt, pos, nrm, uv, idx, cornerUV, rects: charts };
  }

  // THE BAKE VARIANT OF A MATERIAL: its own hook first (the flown program, on this
  // aeroplane's block), then two splices at the very end of main — the vertex lands at
  // its atlas texel instead of the screen, the fragment writes what the lighting would
  // have read (uBakeOut 0 the albedo in sRGB, 1 the normal in the level's frame, 2 the
  // clear coat / roughness / metalness) instead of the lit colour. One wrapper per source
  // hook, its text the program's cache key, so each flown program has one bake twin.
  const BAKE_U = { uBakeOut: { value: 0 } };
  const BAKE_WRAP = new Map();
  const BAKE_FS = `
  {
    vec3 bkN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    vec3 bkA = clamp(diffuseColor.rgb, 0.0, 1.0);
    float bkR = 0.8, bkM = 0.0, bkC = 0.0;
  #ifdef STANDARD
    bkR = roughnessFactor; bkM = metalnessFactor;
  #endif
  #ifdef USE_CLEARCOAT
    bkC = material.clearcoat;
  #endif
    if (uBakeGlass > 0.0) { bkA *= uBakeGlass; bkM = 0.0; bkC = 0.0; }
    gl_FragColor = uBakeOut < 0.5 ? vec4(sRGBTransferOETF(vec4(bkA, 1.0)).rgb, 1.0)
                 : uBakeOut < 1.5 ? vec4(bkN * 0.5 + 0.5, 1.0)
                 : vec4(clamp(bkC, 0.0, 1.0), clamp(bkR, 0.0, 1.0), clamp(bkM, 0.0, 1.0), 1.0);
  }
`;
  function bakeHook(h) {
    let w = BAKE_WRAP.get(h);
    if (w) return w;
    w = function (sh, r) {
      if (h) h.call(this, sh, r);
      sh.uniforms.uBakeOut = BAKE_U.uBakeOut;
      sh.uniforms.uBakeGlass = { value: +(this.userData.parkedBakeGlass || 0) };
      sh.vertexShader = 'attribute vec2 aBakeUv;\n' + sh.vertexShader.replace(/\}\s*$/, '  gl_Position = vec4(aBakeUv * 2.0 - 1.0, 0.0, 1.0);\n}\n');
      sh.fragmentShader = 'uniform float uBakeOut;\nuniform float uBakeGlass;\n' + sh.fragmentShader.replace(/\}\s*$/, BAKE_FS + '}\n');
    };
    w.toString = () => 'parked.bake|' + BAKE.V + '|' + (h ? h.toString() : '');
    BAKE_WRAP.set(h, w);
    return w;
  }
  function bakeRenderer() {
    const R = (W.PARKED && W.PARKED.renderer) || W.FLYDIY_RENDERER || null;
    return R && R.isWebGLRenderer && typeof R.readRenderTargetPixels === 'function' ? R : null;
  }
  const craftP = THREE => new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  // the flown materials, drawn into the atlas: each bucket's corners as a soup carrying the
  // snapshot's own attributes and the corner's atlas uv; the edges first (lines reach the
  // charts too small for a texel centre), the faces over them; read back, then every
  // unwritten texel takes its nearest written one's value so no mip reaches the black
  async function bakeAtlas(THREE, R, rec, ext, uw) {
    const S = uw.S, vis = rec.vis;
    const block = rec.block ? Object.assign({}, rec.block, { uCraftInv: { value: craftP(THREE) } }) : null;
    const matFor = makeMats(THREE, rec, block);
    const tris = new Map();
    for (let t = 0; t < ext.nt; t++) { const b = ext.wb[ext.idx[t * 3]]; let l = tris.get(b); if (!l) tris.set(b, l = []); l.push(t); }
    const solid = new THREE.Scene(), wire = new THREE.Scene(), made = [];
    let ccW = 0, ccR = 0;
    for (const [b, ts] of tris) {
      const key = ext.buckets[b].key, m = vis.mats[key] || {};
      let src = null;
      try { src = matFor(key); } catch (e) { src = null; }
      if (!src || !src.isMeshStandardMaterial) src = new THREE.MeshStandardMaterial({ color: src && src.color ? src.color : (m.color != null ? m.color : 0x808080), roughness: 0.6 });
      const n = ts.length * 3, p = new Float32Array(n * 3), q = new Float32Array(n * 3), u = new Float32Array(n * 2), s = new Float32Array(n * 4), a = new Float32Array(n * 2);
      for (let i = 0; i < ts.length; i++) for (let e = 0; e < 3; e++) {
        const c = ts[i] * 3 + e, v = ext.idx[c], o = i * 3 + e;
        p[o * 3] = ext.pos[v * 3]; p[o * 3 + 1] = ext.pos[v * 3 + 1]; p[o * 3 + 2] = ext.pos[v * 3 + 2];
        q[o * 3] = ext.nrm[v * 3]; q[o * 3 + 1] = ext.nrm[v * 3 + 1]; q[o * 3 + 2] = ext.nrm[v * 3 + 2];
        u[o * 2] = ext.uv[v * 2]; u[o * 2 + 1] = ext.uv[v * 2 + 1];
        s[o * 4] = ext.srf[v * 4]; s[o * 4 + 1] = ext.srf[v * 4 + 1]; s[o * 4 + 2] = ext.srf[v * 4 + 2]; s[o * 4 + 3] = ext.srf[v * 4 + 3];
        a[o * 2] = uw.cornerUV[c * 2]; a[o * 2 + 1] = uw.cornerUV[c * 2 + 1];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(q, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(u, 2)); geo.setAttribute('aStruct', new THREE.BufferAttribute(s, 4));
      geo.setAttribute('aBakeUv', new THREE.BufferAttribute(a, 2));
      for (const wf of [false, true]) {
        const bm = dupe(src, block);
        bm.userData.parkedBakeGlass = m.fin === 'glass' ? BAKE.glassK : 0;
        bm.onBeforeCompile = bakeHook(hookOf(bm));
        bm.transparent = false; bm.blending = THREE.NoBlending; bm.depthTest = false; bm.depthWrite = false;
        bm.side = THREE.DoubleSide; bm.alphaTest = 0; bm.wireframe = wf; bm.needsUpdate = true;
        const mesh = new THREE.Mesh(geo, bm);
        mesh.frustumCulled = false;
        (wf ? wire : solid).add(mesh);
        made.push(bm);
      }
      if (src.clearcoat > 0) { ccW += ts.length; ccR += ts.length * (src.clearcoatRoughness || 0); }
      made.push(geo);
    }
    const cam = new THREE.PerspectiveCamera();
    cam.matrixAutoUpdate = false; cam.matrixWorld.identity(); cam.matrixWorldInverse.identity();
    const rt = new THREE.WebGLRenderTarget(S, S, { depthBuffer: false, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    // the programs off the main thread where the driver can (KHR_parallel_shader_compile).
    // compile() is synchronous and keys each program on the target bound AT THE CALL (a
    // render target has no tone map and a linear output), so the target is bound for the
    // call only - the game draws its own frames while the link finishes
    if (R.compileAsync) {
      const prev = R.getRenderTarget();
      let p = null;
      try { R.setRenderTarget(rt); p = R.compileAsync(solid, cam); } catch (e) { p = null; } finally { R.setRenderTarget(prev); }
      if (p) { try { await p; } catch (e) {} }
    }
    const prevRT = R.getRenderTarget(), prevAC = R.autoClear, cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha();
    const prevSM = R.shadowMap.enabled;
    const out = [];
    try {
      R.shadowMap.enabled = false;
      R.autoClear = false;
      R.setRenderTarget(rt);
      R.setClearColor(0x000000, 0);
      for (let k = 0; k < 3; k++) {
        BAKE_U.uBakeOut.value = k;
        for (const m of made) if (m.isMaterial) m.uniformsNeedUpdate = true;
        R.clear(true, false, false);
        R.render(wire, cam);
        R.render(solid, cam);
        const buf = new Uint8Array(S * S * 4);
        R.readRenderTargetPixels(rt, 0, 0, S, S, buf);
        out.push(buf);
      }
    } finally {
      R.setRenderTarget(prevRT); R.setClearColor(cc, ca); R.autoClear = prevAC; R.shadowMap.enabled = prevSM;
      rt.dispose();
      for (const m of made) m.dispose();
    }
    const cov = dilate(out, S);
    if (cov < 0.05) throw new Error('the bake wrote ' + (cov * 100).toFixed(1) + ' % of the atlas');
    return { tex: out, S, cov, ccR: ccW ? ccR / ccW : 0.1, cc: ccW > 0 };
  }
  // every texel the bake did not write takes its nearest written neighbour's (a
  // breadth-first flood, four-connected); returns the share that was written
  function dilate(bufs, S) {
    const n = S * S, src = new Int32Array(n).fill(-1), queue = new Int32Array(n), A = bufs[0];
    let qt = 0;
    for (let i = 0; i < n; i++) if (A[i * 4 + 3] > 0) { src[i] = i; queue[qt++] = i; }
    const written = qt;
    if (!written) return 0;
    for (let qh = 0; qh < qt; qh++) {
      const i = queue[qh], x = i % S, s = src[i];
      if (x > 0 && src[i - 1] < 0) { src[i - 1] = s; queue[qt++] = i - 1; }
      if (x < S - 1 && src[i + 1] < 0) { src[i + 1] = s; queue[qt++] = i + 1; }
      if (i >= S && src[i - S] < 0) { src[i - S] = s; queue[qt++] = i - S; }
      if (i < n - S && src[i + S] < 0) { src[i + S] = s; queue[qt++] = i + S; }
    }
    for (const B of bufs) for (let i = 0; i < n; i++) {
      const s = src[i];
      if (s !== i) { B[i * 4] = B[s * 4]; B[i * 4 + 1] = B[s * 4 + 1]; B[i * 4 + 2] = B[s * 4 + 2]; }
      B[i * 4 + 3] = 255;
    }
    return written / n;
  }
  // the unwrapped mesh cut to the far rungs' targets, in the Worker, a chart border a
  // seam it keeps (W_SEAM) — L1's wedges, so every rung reads the same atlas
  function cutBaked(uw, cb) {
    const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < uw.nv; i++) for (let a = 0; a < 3; a++) { const v = uw.pos[i * 3 + a]; if (v < bb[a]) bb[a] = v; if (v > bb[a + 3]) bb[a + 3] = v; }
    for (let a = 0; a < 3; a++) if (bb[a + 3] - bb[a] < 1e-3) bb[a + 3] = bb[a] + 1e-3;
    const targets = ['L2', 'L3'].map(L => Math.max(CUT[L][1], Math.round(CUT[L][0] * uw.nt)));
    decimateAsync({ pos: uw.pos, nrm: uw.nrm, idx: uw.idx, bb, targets, opt: { W_SEAM: BAKE.seam } }, (res, err) => {
      if (!res) { cb(null, err); return; }
      cb(res.out.map(o => rungOf(uw, bb, o, res.nrm)), null);
    });
  }
  // a cut rung as its own compact mesh: the wedges it still uses, where the cut left
  // them (a wedge with no twin moved), each with its atlas uv
  function rungOf(uw, bb, lvl, n8) {
    const map = new Int32Array(uw.nv).fill(-1);
    let n = 0;
    for (let i = 0; i < lvl.idx.length; i++) if (map[lvl.idx[i]] < 0) map[lvl.idx[i]] = n++;
    const pos = new Float32Array(n * 3), nrm = new Int8Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(lvl.idx.length);
    const sx = (bb[3] - bb[0]) / 65535, sy = (bb[4] - bb[1]) / 65535, sz = (bb[5] - bb[2]) / 65535;
    for (let w = 0; w < uw.nv; w++) {
      const j = map[w]; if (j < 0) continue;
      pos[j * 3] = bb[0] + (lvl.pos[w * 3] + 32768) * sx; pos[j * 3 + 1] = bb[1] + (lvl.pos[w * 3 + 1] + 32768) * sy; pos[j * 3 + 2] = bb[2] + (lvl.pos[w * 3 + 2] + 32768) * sz;
      nrm[j * 3] = n8[w * 3]; nrm[j * 3 + 1] = n8[w * 3 + 1]; nrm[j * 3 + 2] = n8[w * 3 + 2];
      uv[j * 2] = uw.uv[w * 2]; uv[j * 2 + 1] = uw.uv[w * 2 + 1];
    }
    for (let i = 0; i < lvl.idx.length; i++) idx[i] = map[lvl.idx[i]];
    return { pos, nrm, uv, idx };
  }
  const n8Of = f => { const o = new Int8Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(-127, Math.min(127, Math.round(f[i] * 127))); return o; };
  // the record's far levels as data (what the cache keeps) -> three objects every
  // placement of the build shares: ONE material, a geometry per rung
  function bakedFrom(THREE, d) {
    const tex = (data, srgb) => {
      const t = new THREE.DataTexture(data, d.S, d.S, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.flipY = false; t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = W.FLYDIY_ANISO || 8;
      t.needsUpdate = true;
      return t;
    };
    const map = tex(d.tex[0], true), nmap = tex(d.tex[1], false), orm = tex(d.tex[2], false);
    const o = { map, normalMap: nmap, normalMapType: THREE.ObjectSpaceNormalMap, roughnessMap: orm, metalnessMap: orm,
                roughness: 1, metalness: 1, side: THREE.DoubleSide };
    const mat = d.cc ? new THREE.MeshPhysicalMaterial(Object.assign(o, { clearcoat: 1, clearcoatMap: orm, clearcoatRoughness: d.ccR }))
                     : new THREE.MeshStandardMaterial(o);
    mat.name = 'parked:baked';
    mat.userData.parkedBaked = 1;
    const geos = d.L.map(L => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(L.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(L.nrm, 3, true));
      g.setAttribute('uv', new THREE.BufferAttribute(L.uv, 2));
      g.setIndex(new THREE.BufferAttribute(L.idx, 1));
      g.computeBoundingSphere();
      return g;
    });
    return { mat, geos, S: d.S, tris: d.L.map(L => L.idx.length / 3), ms: d.ms || 0 };
  }
  // THE BAKE'S KEY: the build's whole content (its spec, which carries the livery and the
  // finishes), what the capture made of it, the game's build (the shaders the bake ran)
  // and this file's bake version — any of them moving bakes again
  function hash(str) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ str.length;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 13); }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  const bakeKey = rec => rec.bakeKey || (rec.bakeKey = [BAKE.V, BAKE.S, BAKE.gutter, BAKE.glassK, rec.tris, Object.keys(rec.vis.mats).length,
    (typeof GEN_SPEC_V !== 'undefined') ? GEN_SPEC_V : 0, W.FLYDIY_BUILD || 'dev', hash(JSON.stringify(rec.spec || {})), JSON.stringify(WEAR)].join('|'));
  // the textures ride compressed where the browser can (gzip streams): ~12 MB raw a build
  async function squeeze(u8) {
    if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return u8;
    try { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); } catch (e) { return u8; }
  }
  async function unsqueeze(v, n) {
    if (v && v.length === n) return v;
    return new Uint8Array(await new Response(new Blob([v]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  async function bakeGet(rec) {
    try {
      const d = await db();
      const v = await new Promise((res, rej) => { const tx = d.transaction('bake', 'readonly'); const rq = tx.objectStore('bake').get(rec.key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); });
      if (!v || v.ck !== bakeKey(rec)) return null;
      const n = v.S * v.S * 4;
      v.tex = await Promise.all(v.tex.map(t => unsqueeze(t, n)));
      return v.tex.every(t => t.length === n) ? v : null;
    } catch (e) { return null; }
  }
  async function bakePut(rec, data) {
    const v = Object.assign({}, data, { ck: bakeKey(rec), when: Date.now() });
    v.tex = await Promise.all(data.tex.map(squeeze));
    const d = await db();
    await new Promise((res, rej) => { const tx = d.transaction('bake', 'readwrite'); tx.objectStore('bake').put(v, rec.key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
  // the record's baked far levels: from the cache, else baked now (a frame later, off the
  // capture's task), handed to every placement waiting on them; null = the ladder stands
  function farBaked(THREE, rec, onDone) {
    if (rec.baked !== undefined && !rec.baking) { onDone(rec.baked); return; }
    (rec.bakeWait || (rec.bakeWait = [])).push(onDone);
    if (rec.baking) return;
    rec.baking = true;
    const done = bk => { rec.baking = false; rec.baked = bk || null; const w = rec.bakeWait; rec.bakeWait = [];
      for (const f of w) { try { f(rec.baked); } catch (e) { console.error('parked: bake handoff', e); } } };
    const t0 = performance.now();
    bakeGet(rec).then(hit => {
      if (hit) { const bk = bakedFrom(THREE, hit); log(rec.key, 'far levels baked (cache):', bk.tris.join(' / '), 'tris in', Math.round(performance.now() - t0), 'ms'); done(bk); return; }
      setTimeout(() => bakeNow(THREE, rec).then(done, e => { console.warn('parked: bake of', rec.key, 'failed, the ladder stands:', e && e.message || e); done(null); }), 0);
    });
  }
  async function bakeNow(THREE, rec) {
    const R = bakeRenderer();
    if (!R) return null;
    const t0 = performance.now();
    const ext = exteriorMesh(rec);
    const uw = unwrap(ext, { S: BAKE.S, gutter: BAKE.gutter });
    if (!uw) throw new Error('the charts do not pack');
    const t1 = performance.now();
    const at = await bakeAtlas(THREE, R, rec, ext, uw);
    const t2 = performance.now();
    const rungs = await new Promise((res, rej) => cutBaked(uw, (r, err) => r ? res(r) : rej(new Error(err || 'no cut'))));
    const data = { S: at.S, tex: at.tex, cc: at.cc, ccR: at.ccR,
                   L: [{ pos: uw.pos, nrm: n8Of(uw.nrm), uv: uw.uv, idx: uw.idx }].concat(rungs),
                   stats: { charts: uw.charts, axis: uw.axis, fill: +uw.fill.toFixed(3), cm: +(100 / uw.density).toFixed(2), cov: +at.cov.toFixed(3) } };
    data.ms = Math.round(performance.now() - t0);
    log(rec.key, 'far levels baked:', uw.charts, 'charts,', data.stats.cm, 'cm a texel,', (uw.fill * 100).toFixed(0), '% of the atlas; unwrap', Math.round(t1 - t0),
        'ms, bake', Math.round(t2 - t1), 'ms, total', data.ms, 'ms;', data.L.map(L => L.idx.length / 3).join(' / '), 'tris');
    bakePut(rec, data).catch(e => console.warn('parked: bake not cached', e && e.message || e));
    return bakedFrom(THREE, data);
  }

  // ---- the hitbox --------------------------------------------------------------------
  // boxes by identity, in the object's frame (nose +x, up +y, right +z, tyres on y = 0)
  function hitboxOf(rec, st) {
    const vis = rec.vis, cs = Math.cos(st.pitch), sn = Math.sin(st.pitch);
    const boxes = {};
    const grow = (name, g, at) => {
      const B = boxes[name] || (boxes[name] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
      const q = g.pos, dx = at ? at[0] : 0, dy = at ? at[1] : 0, dz = at ? at[2] : 0;
      for (let i = 0; i < q.length; i += 3) {
        const x0 = q[i] + dx, y0 = q[i + 1] + dy, z0 = q[i + 2] + dz;
        // the stance about z, the lift, then the turn nose-to-+x (x, z negated)
        const x = -(x0 * cs - y0 * sn), y = x0 * sn + y0 * cs + st.lift, z = -z0;
        if (x < B[0]) B[0] = x; if (y < B[1]) B[1] = y; if (z < B[2]) B[2] = z;
        if (x > B[3]) B[3] = x; if (y > B[4]) B[4] = y; if (z > B[5]) B[5] = z;
      }
    };
    // the body first: its extent decides what is "ahead of it"
    let noseX = Infinity;     // model-frame min x of the body sections (the firewall side)
    for (const k in vis.groups) { const m = vis.mats[k]; if (m && m.sec && !isInterior(m)) { const q = vis.groups[k].pos; for (let i = 0; i < q.length; i += 3) if (q[i] < noseX) noseX = q[i]; } }
    const named = [];
    for (const k in vis.groups) {
      const m = vis.mats[k] || {}, g = vis.groups[k];
      if (isInterior(m)) continue;
      if (m.wing === 1) grow('wing', g, null);
      else if (m.wing === 2) grow('tail', g, null);
      else if (m.sec) grow('fuselage', g, null);
      else if (m.fin || m.ves) {
        // hardware: a bucket standing wholly ahead of the body is the cowl's
        let mx = -Infinity; const q = g.pos; for (let i = 0; i < q.length; i += 3) if (q[i] > mx) mx = q[i];
        if (isFinite(noseX) && mx < noseX + 0.05) grow('engine', g, null);
      }
    }
    for (const p of vis.parts) {
      const at = p.stretch ? null : p.pivot;
      let name = null;
      if (/^(mainsL|mainsR|tw|legL|legR|legT|castorT)$/.test(p.kind)) name = 'gear';
      else if (p.kind.lastIndexOf('surf_ail', 0) === 0 || p.kind.lastIndexOf('surf_flap', 0) === 0) name = 'wing';
      else if (p.kind.lastIndexOf('surf_', 0) === 0 || p.kind === 'fin' || p.kind === 'stab') name = 'tail';
      else if (p.kind === 'eng' || p.kind === 'prop') name = 'engine' + ((p.unit || 0) ? p.unit : '');
      else if (p.kind === 'boom') name = 'fuselage';
      else if (p.kind === 'floatL' || p.kind === 'floatR') name = 'floats';
      if (!name) continue;
      for (const k in p.groups) grow(name, p.groups[k], at);
    }
    for (const name of ['fuselage', 'wing', 'tail', 'engine', 'gear', 'floats'].concat(Object.keys(boxes).filter(n => /^engine\d/.test(n)).sort()))
      if (boxes[name] && isFinite(boxes[name][0])) named.push({ name, min: boxes[name].slice(0, 3).map(v => +v.toFixed(3)), max: boxes[name].slice(3).map(v => +v.toFixed(3)) });
    return named;
  }
  function drawBoxes(THREE, grp) {
    const hb = grp.userData.hitbox || [];
    const COL = { fuselage: 0xffb040, wing: 0x40c0ff, tail: 0xb080ff, engine: 0xff5050, gear: 0x80ff80, floats: 0x40e0e0 };
    for (const b of hb) {
      const box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
      const h = new THREE.Box3Helper(box, COL[b.name.replace(/\d+$/, '')] || 0xffffff);
      h.name = 'hitbox:' + b.name;
      grp.add(h);
    }
  }

  // ---- the object: build, place ------------------------------------------------------
  // THE CRAFT FRAME IS PER PLACEMENT. The decals' box projections, the
  // weathering's sources and the cabin box read craft metres through
  // uCraftInv (world -> x lateral, y aft, z up) — a fact about WHERE this
  // aeroplane stands, so two Cubs parked apart cannot share it. Each placed
  // object gets a block of its own (the record's entries by reference, its
  // own uCraftInv) and materials of its own on it; the geometry stays the
  // record's. The matrix is the model-frame group's world matrix inverted,
  // exactly as aeroSetCraft does it for the flown build (x aft is `along`,
  // aft-positive; z left is `lateral`, y up).
  function build(THREE, rec, grp) {
    if (!rec.geos) rec.geos = new Map();
    const st = rec.stance || (rec.stance = stance(rec.vis));
    const block = rec.block ? Object.assign({}, rec.block, { uCraftInv: { value: new THREE.Matrix4() } }) : null;
    const matFor = makeMats(THREE, rec, block);
    const lod = new THREE.LOD();
    lod.name = 'parked:' + rec.key;
    const models = [];
    const frame = level => {
      // model (x aft) -> stance (pitch about z, lifted) -> nose to +x
      const inner = new THREE.Group(); inner.rotation.z = st.pitch; inner.position.y = st.lift; inner.add(level);
      const flip = new THREE.Group(); flip.rotation.y = Math.PI; flip.add(inner);
      models.push(level);
      return flip;
    };
    // L0 only when the switch asks for it (G571); without it L1 is the first rung, from 0 m,
    // and every rung past it sits one index lower (`o`, L1's index)
    const full = !!W.PARKED.L0, o = full ? 1 : 0;
    if (full) lod.addLevel(frame(mergeLevel(THREE, levelMeshes(THREE, rec, matFor, true))), 0);
    const L1 = frame(mergeLevel(THREE, levelMeshes(THREE, rec, matFor, false)));
    lod.addLevel(L1, full ? LEVELS.L1 : 0);
    // the far rungs stand in as L1 until the cut lands (a clone shares geometry and materials)
    const stand2 = L1.clone(), stand3 = L1.clone();
    lod.addLevel(stand2, LEVELS.L2);
    lod.addLevel(stand3, LEVELS.L3);
    lod.addLevel(new THREE.Group(), LEVELS.cull);
    const swap = (lv, obj) => { const old = lod.levels[lv].object; lod.remove(old); lod.levels[lv].object = obj; lod.add(obj); return old; };
    const setFar = far => {
      const ext = exteriorMesh(rec);       // the same order the cut was made in: srf and uv per wedge
      const L2 = frame(farLevel(THREE, ext, far.levels[0], far.nrm, matFor)), L3 = frame(farLevel(THREE, ext, far.levels[1], far.nrm, null));
      swap(o + 1, L2); swap(o + 2, L3);
    };
    const ladder = () => {
      if (rec.far) setFar(rec.far);
      else cacheGet(rec).then(hit => { if (hit && hit.far) { rec.far = hit.far; log(rec.key, 'far levels from the cache'); setFar(rec.far); } else cutFar(THREE, rec, setFar); });
    };
    // THE BAKED RUNGS (G569): L1 out, one mesh on the build's atlas each; until they land
    // (or where there is nothing to bake with) the per-material ladder stands. L1's merged
    // meshes were this placement's own geometry: freed with it (the singletons are the
    // record's, shared with L0 and every other placement). Without L0 the baked L1 is the
    // aeroplane from 0 m.
    const setBaked = bk => {
      if (!bk) { ladder(); return; }
      const old = [0, 1, 2].map(i => swap(o + i, frame(bakedLevel(THREE, bk, i))));
      const gone = new Set();
      for (const o of old) o.traverse(m => { if (m.isMesh && m.name === 'parked:merged' && m.geometry) gone.add(m.geometry); });
      for (const g of gone) g.dispose();
    };
    if (BAKE.on && rec.block && bakeRenderer()) farBaked(THREE, rec, setBaked);
    else ladder();
    lod.userData.hitbox = hitboxOf(rec, st);
    lod.userData.parked = rec.key;
    lod.userData.stance = st;
    if (W.PARKED.boxes) drawBoxes(THREE, lod);
    if (grp) {
      grp.add(lod);
      // the craft frame off the model group's world matrix (the holder's parent
      // is the world's own group at the origin, or the holder is not placed yet)
      grp.updateWorldMatrix(true, true);
      if (block) {
        const P = new THREE.Matrix4().set(0, 0, 1, 0,  1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 1);
        block.uCraftInv.value.copy(P).multiply(new THREE.Matrix4().copy(models[0].matrixWorld).invert());
      }
      lod.userData.craftInv = block ? block.uCraftInv : null;
    }
    return lod;
  }
  // a baked rung: the record's geometry for it under the record's one material
  function bakedLevel(THREE, bk, i) {
    const g = new THREE.Group(), m = new THREE.Mesh(bk.geos[i], bk.mat);
    m.name = 'parked:baked'; m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return g;
  }
  // A PARKED LEVEL MERGED BY MATERIAL (G565): five parked aeroplanes by the stand drew ~1 000 times (213 meshes at L0,
  // 114 at L1, a part each) for 117 / 74 materials. A parked aeroplane never moves, so a level's meshes that share a
  // material (and its render flags and attribute set) become one mesh in the level's frame - the look is the same:
  // the shaders read craft space through uCraftInv, which the level's frame keeps.
  function mergeLevel(THREE, level) {
    level.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(level.matrixWorld).invert(), rel = new THREE.Matrix4(), nm = new THREE.Matrix3();
    const groups = new Map();
    level.traverse(m => {
      if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || Array.isArray(m.material) || !m.geometry || !m.geometry.index) return;
      const g = m.geometry; if (g.morphAttributes && Object.keys(g.morphAttributes).length) return;
      const at = Object.keys(g.attributes).sort();
      if (at.some(k => g.attributes[k].isInterleavedBufferAttribute)) return;
      const key = m.material.uuid + '|' + m.renderOrder + '|' + m.castShadow + m.receiveShadow + m.visible + '|' + (m.customDepthMaterial ? m.customDepthMaterial.uuid : '') + '|' +
        at.map(k => k + ':' + g.attributes[k].itemSize + g.attributes[k].array.constructor.name + g.attributes[k].normalized).join(',');
      let l = groups.get(key); if (!l) groups.set(key, l = []); l.push(m);
    });
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const g0 = list[0].geometry, names = Object.keys(g0.attributes);
      let nV = 0, nI = 0; for (const m of list) { nV += m.geometry.attributes.position.count; nI += m.geometry.index.count; }
      const arrays = {}; for (const k of names) arrays[k] = new g0.attributes[k].array.constructor(nV * g0.attributes[k].itemSize);
      const idx = new Uint32Array(nI); let vo = 0, io = 0;
      for (const m of list) {
        const g = m.geometry, n = g.attributes.position.count;
        rel.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(rel); const e = rel.elements, q = nm.elements;
        for (const k of names) {
          const A = g.attributes[k].array, D = arrays[k], sz = g.attributes[k].itemSize;
          if (k === 'position') for (let i = 0; i < n; i++) { const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2], o = (vo + i) * 3;
            D[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; D[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; D[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
          else if (k === 'normal') for (let i = 0; i < n; i++) { const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2], o = (vo + i) * 3;
            const X = q[0] * x + q[3] * y + q[6] * z, Y = q[1] * x + q[4] * y + q[7] * z, Z = q[2] * x + q[5] * y + q[8] * z, L = Math.hypot(X, Y, Z) || 1; D[o] = X / L; D[o + 1] = Y / L; D[o + 2] = Z / L; }
          else D.set(A.subarray(0, n * sz), vo * sz);
        }
        const ix = g.index.array; for (let i = 0; i < g.index.count; i++) idx[io + i] = ix[i] + vo;
        vo += n; io += g.index.count;
      }
      const out = new THREE.BufferGeometry();
      for (const k of names) out.setAttribute(k, new THREE.BufferAttribute(arrays[k], g0.attributes[k].itemSize, g0.attributes[k].normalized));
      out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
      const m0 = list[0], mesh = new THREE.Mesh(out, m0.material);
      mesh.castShadow = m0.castShadow; mesh.receiveShadow = m0.receiveShadow; mesh.renderOrder = m0.renderOrder; mesh.visible = m0.visible;
      if (m0.customDepthMaterial) mesh.customDepthMaterial = m0.customDepthMaterial;
      mesh.name = 'parked:merged';
      for (const m of list) if (m.parent) m.parent.remove(m);
      level.add(mesh);
    }
    return level;
  }
  // stand one at (x, y, z) turned by yaw (rotation.y); returns the group at once
  // — filled now when the key is captured, or when its capture lands
  function place(THREE, key, x, y, z, yaw) {
    const grp = new THREE.Group();
    grp.name = 'parkedAt:' + key;
    grp.position.set(x, y, z); grp.rotation.y = yaw || 0;
    grp.userData.parkedKey = key;
    const rec = REC[key] || (W.PARKED.ready ? capture(key) : null);
    if (rec) build(THREE, rec, grp);
    else PENDING.push({ key, grp, THREE });
    return grp;
  }
  function fillPending(key) {
    for (let i = PENDING.length - 1; i >= 0; i--) {
      const p = PENDING[i];
      if (p.key !== key) continue;
      PENDING.splice(i, 1);
      if (p.grp.parent) build(p.THREE, REC[key], p.grp);   // an orphaned holder was torn down
    }
  }
  // the boot step: capture what the world asked for (every pending key), then
  // the module is `ready` and later placements capture on the spot
  function captureAll() {
    const want = new Set(PENDING.map(p => p.key));
    let n = 0;
    for (const key of want) { if (!REC[key] && capture(key)) n++; }
    W.PARKED.ready = true;
    // a key with no spec (a slot deleted since) leaves an empty holder, and says so
    for (const p of PENDING.slice()) if (!REC[p.key]) console.warn('parked: nothing to stand for', p.key);
    return n;
  }
  const trisOf = grp => { let n = 0; grp.traverse(o => { if (o.isMesh && o.geometry && o.visible) { const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return n; };

  W.PARKED = { keys, specOf, capture, captureAll, place, build, stance, hitboxOf, records: REC, pending: PENDING,
               LEVELS, CUT, WEAR, ready: false, boxes: false, L0: false /* the interior rung, shelved: G571 */, quiet: false, trisOf, drawBoxes, exteriorMesh, cloneBlock, copyBlock,
               dupe, levelMeshes, farLevel, cutFar, isInterior, PART_L1,   // GATE PARKED drives these headless
               // G569, the baked far rungs: the dials, the unwrap, the assembly, the bake's own hook, and
               // the cache's key and door (bakeClear drops every build's bake: the next boot bakes again)
               BAKE, unwrap, dilate, bakedFrom, bakedLevel, bakeHook, farBaked, bakeKey, renderer: null,
               bakeClear: () => db().then(d => new Promise((res, rej) => { const tx = d.transaction('bake', 'readwrite'); tx.objectStore('bake').clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); })),
               // the record's far levels as the object holds them, for the gate's numbers
               hitbox: grp => { let hb = null; grp.traverse(o => { if (!hb && o.userData && o.userData.hitbox) hb = o.userData.hitbox; }); return hb; } };
})();
