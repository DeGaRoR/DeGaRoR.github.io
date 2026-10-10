// ============================================================
// THE SHED'S SHADOW CACHE (G2070, GARAGE-LAPTOP, 2026-10-06).
//
// The user's GTX 1660 Ti laptop (i5-9300H) drew the garage on retro at p50 97-104 ms: 4 341-5 874 draws and
// 5.7-6.0 M triangles a frame, 59.5 ms of the CPU submitting them. tools/perf/garage_draws.js (node, the Jodel,
// retro) counts 6 809 draws a frame, and 4 798 of them are SHADOW MAPS - the key's 2048 map (1 277) and the five
// lamps' 1024 maps (~3 500) - every map re-drawn every frame. Yet at rest THREE casters change between frames (the
// beacon's rotor and the pilot dummy): the other 1 700 cast the same depth, frame after frame.
//
// So each shadow-casting light of the shed keeps a STATIC DEPTH: the casters that have held still for K frames,
// drawn into the light's own map by three's own shadow pass (R.shadowMap.render - the same selection, frustum,
// depth materials, sides and alpha as the frame's) and copied out (blitFramebuffer, depth). Each frame:
//   - the baked casters are taken out of the pass (castShadow false for the render, restored after);
//   - one full-screen triangle per light (its customDepthMaterial writes gl_FragDepth = the static depth, texel for
//     texel; it intersects ONLY its own light's shadow frustum, so no other pass and no other light draws it) and the
//     casters that move are drawn into the cleared map: depth-tested, the map is min(static, movers) - the SAME depth
//     the full pass writes (a depth buffer is the nearest fragment whatever the order). The look is unchanged.
// REBAKE (exact, every frame checked before the render, after the scene's matrices are updated - the render then
// skips its own update): a baked caster that moved, deformed (position / index version), changed geometry, material
// (id, version, visible, side, shadowSide, alphaTest, map), instances, or left the pass (hidden, removed, castShadow
// off) -> the whole static set is re-made at once (a ghost in the static depth is never drawn). A light whose pose,
// camera, map size or map changed -> that light is re-baked. Casters still for K frames join at the next bake (no
// more often than every K frames); a caster that moved after joining needs twice as long the next time (up to 32 K),
// so an intermittent mover does not re-bake the room every few frames. A skinned mesh's pose is its bones' world
// matrices and its bind matrix, a morphed one's its influences (a crew member at rest is still); a batched mesh, a
// custom depth material or an onBeforeShadow: always drawn live.
// A rebake frame costs what every frame cost before (the full pass, plus the copies); a drag in the editor keeps
// its moving parts live and re-bakes once when they settle.
// Off: ?shedshadow=0, or SHED_SHADOW.S.on = false (live). Any light it cannot cache (a point light's cube, a
// multi-viewport atlas, VSM) turns it off for the frame. Memory: per light a static depth of the map's size
// (+ an R8 colour the target needs): retro ~45 MB in the shed, released when the garage is left.
// ============================================================
var SHED_SHADOW = (function () {
  'use strict';
  const S = { on: true, K: 8, backoffMax: 5 };
  try { if (typeof location !== 'undefined' && /[?&]shedshadow=0\b/.test(location.search || '')) S.on = false; } catch (e) {}
  const ST = { frames: 0, bakes: 0, lightBakes: 0, why: '', whys: {}, baked: 0, live: 0, lights: 0, off: '', ms: 0, msMax: 0 };
  let R = null, SC = null, CAM = null, frame = 0, lastBake = -1e9, bakedCount = 0, mwau = true, inFrame = false, shFrame = false, owe = '', armed = null;
  const recs = new Map();          // caster -> its record (the pose and what its depth depends on, stillness, baked)
  const LT = new Map();            // light -> { rt, quad, key, map }
  const casters = [], lights = [], restore = [], quadsOn = [], glass = [];
  const T = () => window.THREE;

  // ---- the caster's record: what its shadow depth depends on ----------------------------------------------------
  const posVer = g => { const a = g && g.attributes && g.attributes.position; return a ? (a.isInterleavedBufferAttribute ? a.data.version : a.version) : -1; };
  // what three's depth material copies off the caster's (WebGLShadowMap getDepthMaterial) - not its version: the shed has
  // materials flagged needsUpdate every frame (a version that climbs, the depth unchanged)
  const matSig1 = m => m ? m.id + ':' + (m.visible ? 1 : 0) + ':' + m.side + ':' + m.shadowSide + ':' + m.alphaTest + ':' + (m.alphaToCoverage ? 1 : 0) + ':' +
    (m.map ? m.map.id : 0) + ':' + (m.alphaMap ? m.alphaMap.id : 0) + ':' + (m.displacementMap ? m.displacementMap.id + '/' + m.displacementScale + '/' + m.displacementBias : 0) + ':' +
    (m.clippingPlanes ? m.clippingPlanes.length : 0) + ':' + (m.wireframe ? 1 : 0) : '-';
  const matSig = m => Array.isArray(m) ? m.map(matSig1).join('|') : matSig1(m);
  // the frame's check without a string (one material: its fields against the record's; an array: the signature)
  const MF = ['visible', 'side', 'shadowSide', 'alphaTest', 'alphaToCoverage', 'map', 'alphaMap', 'displacementMap', 'displacementScale', 'displacementBias', 'clippingPlanes', 'wireframe'];
  const matTake = m => Array.isArray(m) || !m ? null : MF.map(k => k === 'clippingPlanes' ? (m[k] ? m[k].length : 0) : m[k]);
  function matSame(r, m) {
    if (Array.isArray(m) || !m || !r.mf) return matSig(m) === r.ms;
    if (m !== r.mat) return false;
    const a = r.mf; for (let i = 0; i < MF.length; i++) { const k = MF[i], v = k === 'clippingPlanes' ? (m[k] ? m[k].length : 0) : m[k]; if (v !== a[i]) return false; }
    return true;
  }
  const live = o => !!(o.isBatchedMesh || o.customDepthMaterial || (o.onBeforeShadow && o.onBeforeShadow !== T().Object3D.prototype.onBeforeShadow));
  // a skinned mesh's pose is its bones' (their world matrices, what three's skeleton reads at the render) and its bind
  // matrix; a morphed mesh's, its influences: a crew member standing still is as still as a crate
  function poseOf(o) {
    const sk = o.isSkinnedMesh && o.skeleton, mi = o.morphTargetInfluences;
    if (!sk && !(mi && mi.length)) return null;
    const n = (sk ? 16 * (sk.bones.length + 1) : 0) + (mi ? mi.length : 0), a = new Float64Array(n); let k = 0;
    if (sk) { for (const b of sk.bones) { a.set(b.matrixWorld.elements, k); k += 16; } a.set(o.bindMatrix.elements, k); k += 16; }
    if (mi) for (let i = 0; i < mi.length; i++) a[k++] = mi[i];
    return a;
  }
  function samePose(a, o) {
    const sk = o.isSkinnedMesh && o.skeleton, mi = o.morphTargetInfluences; let k = 0;
    if (!a) return !sk && !(mi && mi.length);
    if (a.length !== (sk ? 16 * (sk.bones.length + 1) : 0) + (mi ? mi.length : 0)) return false;
    if (sk) { for (const b of sk.bones) { const e = b.matrixWorld.elements; for (let i = 0; i < 16; i++) if (e[i] !== a[k++]) return false; }
      const e = o.bindMatrix.elements; for (let i = 0; i < 16; i++) if (e[i] !== a[k++]) return false; }
    if (mi) for (let i = 0; i < mi.length; i++) if (mi[i] !== a[k++]) return false;
    return true;
  }
  function take(r, o) {
    r.m.set(o.matrixWorld.elements); const g = o.geometry;
    r.g = g; r.pv = posVer(g); r.iv = g && g.index ? g.index.version : -1; r.ds = g ? g.drawRange.start : 0; r.dc = g ? g.drawRange.count : 0;
    r.ms = matSig(o.material); r.mat = o.material; r.mf = matTake(o.material); r.iv2 = o.instanceMatrix ? o.instanceMatrix.version : -1; r.ic = o.isInstancedMesh ? o.count : -1; r.pose = poseOf(o);
    // (G2111: whether it is always live, read here - its inputs are in the signature - not every frame)
    r.live = live(o); r.cdm = o.customDepthMaterial; r.obs = o.onBeforeShadow; r.bm = !!o.isBatchedMesh;
  }
  function same(r, o) {
    const e = o.matrixWorld.elements, m = r.m;
    for (let i = 0; i < 16; i++) if (e[i] !== m[i]) return false;
    const g = o.geometry;
    if (g !== r.g || posVer(g) !== r.pv || (g && g.index ? g.index.version : -1) !== r.iv) return false;
    if (g && (g.drawRange.start !== r.ds || g.drawRange.count !== r.dc)) return false;
    if (o.instanceMatrix && (o.instanceMatrix.version !== r.iv2 || o.count !== r.ic)) return false;
    if (o.customDepthMaterial !== r.cdm || o.onBeforeShadow !== r.obs || !!o.isBatchedMesh !== r.bm) return false;
    if (!samePose(r.pose, o)) return false;
    return matSame(r, o.material);
  }
  const need = r => S.K << Math.min(r.moves, S.backoffMax);

  // ---- the lights: what a light's static depth depends on ----------------------------------------------------------
  function lightKey(L) {
    const a = [], e = L.matrixWorld.elements, t = L.target ? L.target.matrixWorld.elements : null, c = L.shadow.camera;
    a.push(e[12], e[13], e[14]); if (t) a.push(t[12], t[13], t[14]);
    a.push(c.near, c.far, c.zoom, c.left, c.right, c.top, c.bottom, c.fov, L.shadow.mapSize.x, L.shadow.mapSize.y);
    if (L.isSpotLight) a.push(L.angle, L.distance, L.shadow.focus);
    return a.join(',');
  }
  const cacheable = L => (L.isDirectionalLight || L.isSpotLight) && L.shadow.getViewportCount() === 1 && !(L.shadow.map && L.shadow.map.isWebGLCubeRenderTarget);

  // ---- the copy: a full-screen triangle that writes the static depth, drawn only into its own light's map -----------
  function entryFor(L) {
    let E = LT.get(L); if (E) return E;
    const TH = T();
    const g = new TH.BufferGeometry(); g.setAttribute('position', new TH.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const q = new TH.Mesh(g, new TH.MeshBasicMaterial({ side: TH.DoubleSide }));
    q.name = 'shedShadowCopy'; q.castShadow = false; q.receiveShadow = false; q.userData.noPick = true; q.userData.shedShadowCopy = true;
    q.raycast = () => {};
    q.intersectsFrustum = fr => fr === L.shadow.getFrustum();   // only its own light's pass: the main pass, the glass, the probes cull it
    q.customDepthMaterial = new TH.ShaderMaterial({ name: 'shedShadowCopy', uniforms: { tDepth: { value: null } },
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform highp sampler2D tDepth;\nvoid main() { gl_FragDepth = texelFetch(tDepth, ivec2(gl_FragCoord.xy), 0).r; gl_FragColor = vec4(1.0); }',
      side: TH.DoubleSide, depthTest: true, depthWrite: true });
    E = { rt: null, quad: q, key: '', map: null, valid: false };
    LT.set(L, E); return E;
  }
  function staticTarget(E, src) {
    const TH = T(), w = src.width, h = src.height, dt = src.depthTexture;
    if (E.rt && E.rt.width === w && E.rt.height === h && E.rt.depthTexture.type === dt.type) return E.rt;
    if (E.rt) E.rt.dispose();
    const rt = new TH.WebGLRenderTarget(w, h, { format: TH.RedFormat, type: TH.UnsignedByteType, depthBuffer: true, generateMipmaps: false,
      minFilter: TH.NearestFilter, magFilter: TH.NearestFilter });
    rt.texture.name = 'shedShadowStatic';
    rt.depthTexture = new TH.DepthTexture(w, h, dt.type); rt.depthTexture.format = dt.format; rt.depthTexture.compareFunction = null;
    rt.depthTexture.minFilter = rt.depthTexture.magFilter = TH.NearestFilter; rt.depthTexture.name = 'shedShadowStaticDepth';
    E.rt = rt; E.quad.customDepthMaterial.uniforms.tDepth.value = rt.depthTexture;
    return rt;
  }
  function copyDepth(src, dst) {
    const gl = R.getContext(), st = R.state;
    const prev = R.getRenderTarget(), pf = R.getActiveCubeFace(), pm = R.getActiveMipmapLevel();
    R.setRenderTarget(dst);                                     // (sets the target up on its first use)
    const fs = R.properties.get(src).__webglFramebuffer, fd = R.properties.get(dst).__webglFramebuffer;
    let ok = !!(fs && fd && !Array.isArray(fs) && !Array.isArray(fd));
    if (ok) {
      st.bindFramebuffer(gl.READ_FRAMEBUFFER, fs); st.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fd);
      gl.blitFramebuffer(0, 0, src.width, src.height, 0, 0, dst.width, dst.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      st.bindFramebuffer(gl.READ_FRAMEBUFFER, null); st.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    R.setRenderTarget(prev, pf, pm);
    return ok;
  }

  // ---- THE GLASS PASS (G2072) ------------------------------------------------------------------------------------
  // The shed's window panes are three's TRANSMISSION material (hangar.js M.glass, transmission 0.90): every frame three
  // draws the whole opaque list again into a 4x MSAA, mipmapped target for them to sample (garage_draws.js: 949 draws on
  // retro, the Jodel). A pane samples that target at its own pixel (no thickness: no refraction offset), blurred by its
  // roughness (0.06: ~0.7 of a mip). What the target holds where a pane shows is what lies BEHIND the pane.
  // A PANE IS A SLAB: in the room's frame (hangar.js's group: the walls on its axes) each pane - a connected piece of a
  // transmissive mesh, its corners welded - lies within its box; on an axis where the eye is outside that box (the pane's
  // thin one first), every point behind the pane is past the box's near face. So an object wholly on the eye's side of
  // that face is never behind that pane - and one on the eye's side of every pane's face is never behind any: it is left
  // out of the target. The outdoors, the sky and the door's view stay in it; so does anything that reaches past a pane's
  // face (the walls round the windows). Exact where a pane shows; at a pane's pixel next to an object standing in front of
  // it, the 0.7-mip blur no longer mixes that object's colour in (a sub-pixel fringe gone). Checked every frame, else the
  // full pass: every visible transmissive mesh's panes measured (cached per pose and geometry), the eye outside every pane's
  // box; an object's box (its geometry's, in the room's frame) against the faces, G.margin (1 cm) clear; instanced,
  // batched and skinned meshes, and anything outside the scene (three's background box), always drawn.
  // Off: ?shedglass=0, or SHED_SHADOW.G.on = false.
  const G = { on: true, margin: 0.01 };
  try { if (typeof location !== 'undefined' && /[?&]shedglass=0\b/.test(location.search || '')) G.on = false; } catch (e) {}
  const GST = { frames: 0, ok: 0, why: '', skipped: 0, drawn: 0, panes: 0, lo: null, hi: null };
  const transmissive = m => Array.isArray(m) ? m.some(transmissive) : !!(m && m.visible && m.transmission > 0);
  let gInv = null, gOn = false, gIn = false, gRBD = null, gSRT = null, gPrevRBD = null, gPrevSRT = null;
  const gLo = [0, 0, 0], gHi = [0, 0, 0];
  const gRecs = new WeakMap(), gInside = new WeakMap();
  const same16 = (a, b) => { for (let i = 0; i < 16; i++) if (a[i] !== b[i]) return false; return true; };
  // a transmissive mesh's panes: its triangles grouped by shared corners (positions welded at 0.1 mm), each group's box in the
  // room's frame - cached while the mesh, its geometry and the room stand still
  function panesOf(o) {
    const g = o.geometry, pa = g && g.attributes && g.attributes.position;
    if (!pa) return null;
    const e = o.matrixWorld.elements, r = gRecs.get(o);
    if (r && r.g === g && r.pv === posVer(g) && r.iv === (g.index ? g.index.version : -1) && same16(r.m, e) && same16(r.inv, gInv.elements)) return r.panes;
    const TH = T(), M = new TH.Matrix4().multiplyMatrices(gInv, o.matrixWorld), v = new TH.Vector3();
    const n = pa.count, P = new Float64Array(3 * n), weld = new Map(), id = new Int32Array(n);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); P[3 * i] = v.x; P[3 * i + 1] = v.y; P[3 * i + 2] = v.z;
      const k = Math.round(v.x * 1e4) + ',' + Math.round(v.y * 1e4) + ',' + Math.round(v.z * 1e4); let w = weld.get(k); if (w === undefined) { w = i; weld.set(k, i); } id[i] = w; }
    const up = new Int32Array(n); for (let i = 0; i < n; i++) up[i] = i;
    const find = i => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
    const join = (a, b) => { a = find(a); b = find(b); if (a !== b) up[a] = b; };
    const idx = g.index ? g.index.array : null, m = idx ? g.index.count : n;
    for (let t = 0; t + 2 < m; t += 3) { const a = id[idx ? idx[t] : t], b = id[idx ? idx[t + 1] : t + 1], c = id[idx ? idx[t + 2] : t + 2]; join(a, b); join(b, c); }
    const box = new Map();
    for (let t = 0; t < m; t++) { const i = idx ? idx[t] : t, root = find(id[i]); let b = box.get(root); if (!b) { b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; box.set(root, b); }
      for (let k = 0; k < 3; k++) { const x = P[3 * i + k]; if (x < b[k]) b[k] = x; if (x > b[3 + k]) b[3 + k] = x; } }
    const panes = [...box.values()];
    gRecs.set(o, { g, pv: posVer(g), iv: g.index ? g.index.version : -1, m: Float64Array.from(e), inv: Float64Array.from(gInv.elements), panes });
    return panes;
  }
  // an object wholly on the eye's side of every pane's face (its geometry's box, in the room's frame) - once per object a frame
  const _gb = { v: null, M: null };
  // (G2111: the verdict cached per object while its pose, its geometry and the panes' faces (gVer) hold - a 16-float
  // compare instead of eight corners posed, ~900 objects a frame in the transmission pass)
  let gVer = 0, gKey = '';
  function inside(o) {
    let q = gInside.get(o); if (q && q.f === frame) return q.in;
    if (q && q.v === gVer && q.g === o.geometry && q.pv === posVer(o.geometry)) {
      const e = o.matrixWorld.elements, m = q.m; let k = 0; while (k < 16 && e[k] === m[k]) k++;
      if (k === 16) { q.f = frame; return q.in; } }
    let yes = false, root = o; while (root.parent) root = root.parent;   // (the scene's own: never three's background box, which rides the eye)
    if (root === SC && o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.isSkinnedMesh && o.geometry && !transmissive(o.material)) {
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox;
      if (bb && Number.isFinite(bb.min.x) && Number.isFinite(bb.max.x)) {
        const TH = T(), v = _gb.v || (_gb.v = new TH.Vector3()), M = (_gb.M || (_gb.M = new TH.Matrix4())).multiplyMatrices(gInv, o.matrixWorld);
        yes = true;
        for (let c = 0; c < 8 && yes; c++) {
          v.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z).applyMatrix4(M);
          if (v.x < gLo[0] || v.x > gHi[0] || v.y < gLo[1] || v.y > gHi[1] || v.z < gLo[2] || v.z > gHi[2]) yes = false;
        }
      }
    }
    gInside.set(o, { f: frame, in: yes, v: gVer, g: o.geometry, pv: posVer(o.geometry), m: Float64Array.from(o.matrixWorld.elements) }); return yes;
  }
  const isTransRT = t => !!(t && !t.isWebGLCubeRenderTarget && t.texture && t.texture.generateMipmaps && t.samples >= 4 && !t.depthTexture);
  function preGlass(scene, camera, room) {
    gOn = false; GST.frames++;
    if (!G.on) { GST.why = 'off'; return false; }
    if (!glass.length) { GST.why = 'no glass'; return false; }
    if (!room || !room.group) { GST.why = 'no room'; return false; }
    const TH = T(), mg = G.margin;
    gInv = (gInv || new TH.Matrix4()).copy(room.group.matrixWorld).invert();
    const eye = new TH.Vector3().setFromMatrixPosition(camera.matrixWorld).applyMatrix4(gInv), E = [eye.x, eye.y, eye.z];
    gLo[0] = gLo[1] = gLo[2] = -Infinity; gHi[0] = gHi[1] = gHi[2] = Infinity;
    let np = 0;
    for (const o of glass) {
      const panes = panesOf(o);
      if (!panes) { GST.why = 'pane unread: ' + (o.name || o.type); return false; }
      for (const b of panes) {
        // the axis the eye is outside the pane's box on - the pane's thinnest first
        const ax = [0, 1, 2].sort((i, j) => (b[3 + i] - b[i]) - (b[3 + j] - b[j]));
        let k = -1; for (const i of ax) if (E[i] < b[i] || E[i] > b[3 + i]) { k = i; break; }
        if (k < 0) { GST.why = 'eye in a pane\'s box: ' + (o.name || (o.parent && o.parent.name) || o.type); return false; }
        if (E[k] < b[k]) gHi[k] = Math.min(gHi[k], b[k] - mg); else gLo[k] = Math.max(gLo[k], b[3 + k] + mg);
        np++;
      }
    }
    for (let k = 0; k < 3; k++) if (!(E[k] > gLo[k] && E[k] < gHi[k])) { GST.why = 'eye past a pane\'s face'; return false; }
    GST.why = ''; GST.ok++; GST.skipped = 0; GST.drawn = 0; GST.panes = np; GST.lo = gLo.slice(); GST.hi = gHi.slice();
    { const k = gLo.join(',') + '|' + gHi.join(',') + '|' + gInv.elements.join(','); if (k !== gKey) { gKey = k; gVer++; } }   // (G2111: the faces' version)
    gOn = true; gIn = false;
    gPrevSRT = R.setRenderTarget; gPrevRBD = R.renderBufferDirect;
    const srt = gPrevSRT, rbd = gPrevRBD;
    gSRT = function (t) { gIn = isTransRT(t); return srt.apply(this, arguments); };
    gRBD = function (cam, sc, geo, mat, obj) { if (gIn) { if (inside(obj)) { GST.skipped++; return; } GST.drawn++; } return rbd.apply(this, arguments); };
    R.setRenderTarget = gSRT; R.renderBufferDirect = gRBD;
    return true;
  }
  function glassOff() {
    if (!gOn) return;
    if (R.setRenderTarget === gSRT) R.setRenderTarget = gPrevSRT;
    if (R.renderBufferDirect === gRBD) R.renderBufferDirect = gPrevRBD;
    gOn = false; gIn = false;
  }
  // ---- the frame -------------------------------------------------------------------------------------------------
  function walk(o) {
    if (!o.visible) return;
    if ((o.isMesh || o.isLine || o.isPoints) && o.castShadow && !(o.userData && o.userData.shedShadowCopy)) casters.push(o);
    if (o.isMesh && transmissive(o.material)) glass.push(o);
    if (o.isLight && o.castShadow && o.shadow) lights.push(o);
    const ch = o.children; for (let i = 0; i < ch.length; i++) walk(ch[i]);
  }
  // THE BAKE runs INSIDE the frame's render: three's shadow pass draws through the render state renderer.render() sets up
  // (outside it renderBufferDirect has none). A bake frame arms a one-shot wrapper on renderer.shadowMap.render: the
  // static casters alone into the lights' maps (the lights asked), each map's depth copied out, then the frame's pass.
  function bake(Ls, newSet, why, draw) {
    if (newSet) {
      bakedCount = 0;
      for (const [o, r] of recs) { if (r.seen !== frame) { recs.delete(o); continue; } r.baked = !r.live && r.still >= need(r); if (r.baked) bakedCount++; }
      owe = '';
    }
    const off = [];
    for (const o of casters) if (!recs.get(o).baked) { o.castShadow = false; off.push(o); }
    for (const [, E] of LT) E.quad.castShadow = false;
    try { draw(Ls); }
    finally { for (let i = 0; i < off.length; i++) off[i].castShadow = true; }
    for (const L of Ls) {
      const E = entryFor(L), map = L.shadow.map;
      E.valid = !!(map && map.depthTexture && copyDepth(map, staticTarget(E, map)));
      E.key = lightKey(L); E.map = map;
    }
    ST.why = why; ST.whys[why] = (ST.whys[why] || 0) + 1;
    if (newSet) { ST.bakes++; lastBake = frame; } else ST.lightBakes++;
  }
  // the live pass: the baked casters out, each light's copy in (every light needs its static depth, else none leaves)
  function setLive() {
    let n = 0;
    for (const L of lights) { const E = LT.get(L); if (!E || !E.valid || E.map !== L.shadow.map) { ST.baked = 0; ST.live = casters.length; return; } }
    for (const o of casters) { const r = recs.get(o); if (r.baked) { o.castShadow = false; restore.push(o); n++; } }
    // (the copies are in the scene for the render only: outside it the scene's graph is the app's)
    for (const L of lights) { const E = LT.get(L); if (E.quad.parent !== SC) SC.add(E.quad); E.quad.castShadow = true; quadsOn.push(E.quad); }
    ST.baked = n; ST.live = casters.length - n;
  }
  function disarm() { if (armed) { armed.SM.render = armed.orig; armed = null; } }
  function arm(Ls, newSet, why) {
    const SM = R.shadowMap, orig = SM.render;
    armed = { SM, orig };
    SM.render = function (T, sc, cam) {
      disarm();
      try { bake(Ls, newSet, why, L2 => orig.call(SM, L2, sc, cam)); } catch (e) { ST.err = String(e && e.message || e); for (const [, E] of LT) E.valid = false; }
      setLive();
      return orig.call(SM, T, sc, cam);
    };
  }
  // before the garage's render: true when the frame is the cache's (post() must follow the render)
  // room: the shed (hangar.js: { group, dims: { HW, HD, EAVE } }) - the glass pass's box (below); null: no glass skip
  function pre(renderer, scene, camera, room) {
    const t0 = performance.now();
    if (inFrame) post();
    if (SC && SC !== scene) release();
    R = renderer; SC = scene; CAM = camera; frame++;
    scene.updateMatrixWorld();
    casters.length = 0; lights.length = 0; glass.length = 0; walk(scene);
    const sh = preShadow(scene);
    const gl = preGlass(scene, camera, room);
    if (sh) { mwau = scene.matrixWorldAutoUpdate; scene.matrixWorldAutoUpdate = false; }   // updated above: the render need not walk it again
    inFrame = sh || gl;
    const dt = performance.now() - t0; ST.ms = ST.ms ? ST.ms + 0.05 * (dt - ST.ms) : dt; if (dt > ST.msMax) ST.msMax = dt;   // its own cost (the bake's draws are the render's)
    return inFrame;
  }
  function preShadow(scene) {
    if (!S.on || !R.shadowMap.enabled || R.shadowMap.type === T().VSMShadowMap) { ST.off = !S.on ? 'off' : 'type'; if (held()) release(); return false; }
    ST.frames++;
    for (const L of lights) if (!cacheable(L)) { ST.off = 'light'; if (held()) release(); return false; }
    ST.off = '';
    // the casters: still, moved, new
    let dirty = owe, bakedSeen = 0, promote = 0;
    for (let i = 0; i < casters.length; i++) {
      const o = casters[i]; let r = recs.get(o);
      if (!r) { r = { m: new Float64Array(16), still: 0, moves: 0, baked: false, seen: frame, live: false }; take(r, o); recs.set(o, r); }
      else {
        if (r.live || !same(r, o)) { if (r.baked) { r.baked = false; bakedCount--; r.moves++; dirty = dirty || 'moved'; } r.still = 0; take(r, o); }
        else r.still++;
      }
      r.seen = frame;
      if (r.baked) bakedSeen++; else if (!r.live && r.still >= need(r)) promote++;
    }
    if (bakedSeen !== bakedCount) dirty = dirty || 'gone';
    if (!dirty && promote && frame - lastBake >= S.K) dirty = 'joined';
    owe = dirty;                             // a ghost stays owed until a bake has run (a frame that never drew keeps it)
    // the lights
    const stale = [];
    for (const L of lights) { const E = LT.get(L); if (!E || !E.valid || E.map !== L.shadow.map || E.key !== lightKey(L)) stale.push(L); }
    if (dirty) arm(lights.slice(), true, dirty);
    else if (stale.length && bakedCount > 0) arm(stale, false, 'light');   // (nothing baked yet: the full pass, as before)
    else setLive();
    shFrame = true;
    return true;
  }
  function post() {
    glassOff();
    disarm();
    for (let i = 0; i < restore.length; i++) restore[i].castShadow = true;
    restore.length = 0;
    for (let i = 0; i < quadsOn.length; i++) { const q = quadsOn[i]; q.castShadow = false; if (q.parent) q.parent.remove(q); }
    quadsOn.length = 0;
    if (SC && shFrame) SC.matrixWorldAutoUpdate = mwau;
    inFrame = false; shFrame = false;
  }
  // out of the shed: the static depths and the copies go (the next garage frame re-bakes)
  function release() {
    if (inFrame) post();
    for (const [, E] of LT) { if (E.quad.parent) E.quad.parent.remove(E.quad); E.quad.geometry.dispose(); E.quad.material.dispose(); E.quad.customDepthMaterial.dispose(); if (E.rt) E.rt.dispose(); }
    LT.clear(); recs.clear(); bakedCount = 0; lastBake = -1e9; owe = '';
  }
  const held = () => LT.size > 0 || recs.size > 0;
  const stat = () => Object.assign({}, ST, { whys: Object.assign({}, ST.whys), records: recs.size });
  // the casters drawn live this frame and why (the census rig reads it): { name, still, moves, live, need }
  const liveList = () => casters.filter(o => !recs.get(o).baked).map(o => { const r = recs.get(o);
    const g = o.geometry, e = o.matrixWorld.elements, d = [];
    for (let i = 0; i < 16; i++) if (e[i] !== r.m[i]) { d.push('m' + i + ':' + (e[i] - r.m[i])); break; }
    if (g !== r.g) d.push('geo'); if (posVer(g) !== r.pv) d.push('pos'); if ((g && g.index ? g.index.version : -1) !== r.iv) d.push('idx');
    if (g && (g.drawRange.start !== r.ds || g.drawRange.count !== r.dc)) d.push('range'); if (matSig(o.material) !== r.ms) d.push('mat ' + r.ms + ' -> ' + matSig(o.material));
    return { name: o.name || (o.parent && o.parent.name) || o.type, still: r.still, moves: r.moves, live: r.live, need: need(r), diff: d.join(' ') }; });
  const api = { S, G, pre, post, release, held, stat, liveList, glassStat: () => Object.assign({}, GST) };
  if (typeof window !== 'undefined') window.SHED_SHADOW = api;
  return api;
})();
