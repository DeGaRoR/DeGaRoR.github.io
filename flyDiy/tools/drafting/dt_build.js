// dt_build.js - THE DRAFTING TABLE'S BUILD: a plane file (or an archetype card) through the GARAGE'S OWN generator,
// out as triangles tagged by PART, in metres, in the table's frame. Design: tools/DRAFTING_TABLE.md.
//
// It runs where the garage's editor files are loaded as globals: a node vm context (dt_node.js) or the page's worker
// (dt_worker.js). Nothing here makes geometry: the body is CAGE2.cageSheet, every other part is a garage layer drawn by
// CAGE_PAGE.post, exactly as the garage draws them (the same files, the same order). This file only reads the result.
//
//   DT_BUILD.birth(W, key)                 -> spec        an archetype card's birth spec (CAGE_DESIGN.designBake)
//   DT_BUILD.build(W, spec, over, opts)    -> { P, tris, parts, frame, ms, errors }
//       spec  a plane file's spec ({cage, ...}) - the cage rows are its source of truth
//       over  rows laid over the cage (a slider being tried)
//       opts  { level: 0 (the sheet's subdivision; 0 is the draft, 2 the garage's), detail: false }
//   tris: Float32Array, 9 floats a triangle, in the TABLE FRAME (metres):
//       a = metres AFT of the spinner's tip, h = metres ABOVE the thrust line, s = metres to starboard
//       stored per vertex as (a, h, s)
//   parts: Uint8Array, one PART id a triangle (DT_BUILD.PARTS)
//   frame: { tipZ, hubY, FS } - how the garage's world maps to the table frame (z fore, y up, x span)
(function (root) {
  'use strict';
  // THE PARTS: what the outline draws as its own line, and the key measurements read
  const PARTS = ['none', 'body', 'glass', 'pillar', 'waist', 'wing', 'strut', 'fin', 'stab', 'cowl', 'engine',
    'gear', 'float', 'other', 'screen'];
  const PID = {}; PARTS.forEach((p, i) => { PID[p] = i; });
  // the body sheet's materials (_cage_gen.js face tags): glazing, seams, what is inside (left out)
  const GLASS = /window|windshield|pane$|^drawnPane|skylight|bubble|canopy|glass/i;
  const SEAM_PILLAR = /^pillar/;
  const SEAM_WAIST = /^waistband/;
  // (the skin is 'body', 'joint', 'aluminium', 'toele' (tôle: the sheet-metal panels) and 'shoulder': all kept - leaving
  // toele out made the fuselage see-through, the user caught it 11 Nov)
  const INSIDE = /ceilingLoop|floorLoop|bulkhead|firewall|fireProof|fireSeal|^tube|cloth|dash|plywood|floorBoard|seat|reveal|paneEdge/;
  // the layers the outline needs (the others are fittings, lamps, hinges: detail the drafting never reads)
  const LAYER_PART = { cowl: 'cowl', eng: 'engine', wing: 'wing', brace: 'strut', gear: 'gear', float: 'float',
    fin: 'fin', stab: 'stab', pod: 'body' };

  function birth(W, key) {
    const D = W.CAGE_DESIGN;
    const a = D.ARCHETYPES.find(x => x.key === key);
    if (!a) throw new Error('no archetype ' + key + ' (one of: ' + D.ARCHETYPES.map(x => x.key).join(' ') + ')');
    return D.designBake(a.sel, a.over);
  }

  function partOfMesh(layer, o) {
    const n = (o.name || '') + ' ' + (o.parent && o.parent.name || '');
    if (layer === 'wing' && /strut|jury/i.test(n)) return 'strut';
    if (layer === 'eng' && /cowl/i.test(n)) return 'cowl';
    return LAYER_PART[layer] || null;
  }

  // TWO PASSES by default: some garage layers read what a LATER layer published on the previous build (the order's own
  // rule, _cage_chain.js), so the first build in a fresh context, or after a big change, is one pass stale. The garage
  // runs builds continuously; a headless check settles with a second pass (opts.passes: 1 for a drag preview).
  function build(W, spec, over, opts) {
    opts = opts || {};
    const passes = opts.passes == null ? 2 : opts.passes;
    for (let i = 1; i < passes; i++) buildOnce(W, spec, over, opts);
    return buildOnce(W, spec, over, opts);
  }
  function buildOnce(W, spec, over, opts) {
    const t0 = Date.now();
    const THREE = W.THREE, CG2 = W.CAGE2, PAGE = W.CAGE_PAGE;
    W.GARAGE_SPEC = { get: () => spec };
    const P = CG2.cageFromSpec(spec || null);
    if (over) Object.assign(P, over);
    const built = CG2.cageSheet(P, { step: PAGE.defaultStep || 'crease', level: opts.level == null ? 0 : opts.level });
    const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
    const scene = new THREE.Scene();
    const errors = [];
    try { if (PAGE.post) PAGE.post({ scene, spec: built.spec, mesh: built.sheet, P, stat: { textContent: '' } }); }
    catch (e) { errors.push('post: ' + (e && e.message || e)); }
    scene.updateMatrixWorld(true);
    // ---- collect, in the garage's world (x span, y up, z fore) ----
    const xyz = [], pid = [];
    const sh = built.sheet;
    for (const f of sh.F) {
      if (f.v.length < 3 || INSIDE.test(f.m)) continue;
      const part = /^windshield/.test(f.m) ? 'screen' : GLASS.test(f.m) ? 'glass' : SEAM_PILLAR.test(f.m) ? 'pillar' : SEAM_WAIST.test(f.m) ? 'waist' : 'body';
      for (let t = 1; t + 1 < f.v.length; t++) {
        for (const i of [f.v[0], f.v[t], f.v[t + 1]]) xyz.push(sh.V[i][0] * FS, sh.V[i][1] * FS, sh.V[i][2] * FS);
        pid.push(PID[part]);
      }
    }
    const v = new THREE.Vector3();
    const vis = o => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
    let engZ = -1e9; const engPts = [];
    scene.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !vis(o)) return;
      let layer = ''; for (let q = o; q; q = q.parent) if (/^cageLayer:/.test(q.name || '')) { layer = q.name.slice(10); break; }
      const part = partOfMesh(layer, o);
      if (!part) return;
      const p = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : p.count;
      for (let i = 0; i + 2 < n; i += 3) {
        for (let e = 0; e < 3; e++) {
          v.fromBufferAttribute(p, idx ? idx.getX(i + e) : i + e).applyMatrix4(o.matrixWorld);
          xyz.push(v.x, v.y, v.z);
          if (part === 'engine') { if (v.z > engZ) engZ = v.z; engPts.push(v.x, v.y, v.z); }
        }
        pid.push(PID[part]);
      }
    });
    // ---- the table frame: the spinner's tip and the thrust line ----
    let tipZ = -1e9; for (let i = 2; i < xyz.length; i += 3) if (xyz[i] > tipZ) tipZ = xyz[i];
    let hubY = 0, nh = 0;
    if (engPts.length) {           // the thrust line: the mean height of the engine layer's points within 3 cm of its tip
      for (let i = 0; i < engPts.length; i += 3) if (engPts[i + 2] > engZ - 0.03) { hubY += engPts[i + 1]; nh++; }
      hubY = nh ? hubY / nh : 0;
    }
    const tris = new Float32Array(xyz.length);
    for (let i = 0; i < xyz.length; i += 3) {
      tris[i] = tipZ - xyz[i + 2];          // a: aft of the tip
      tris[i + 1] = xyz[i + 1] - hubY;      // h: above the thrust line
      tris[i + 2] = xyz[i];                 // s: span
    }
    return { P, spec: built.spec, tris, parts: Uint8Array.from(pid), frame: { tipZ, hubY, FS }, ms: Date.now() - t0, errors };
  }

  // THE GARAGE'S OWN ROW DEFINITIONS: every [key, label, min, max, step, opts] row in the page's trees, by key
  function rowDefs(W) {
    const out = {};
    const walk = (a, path) => {
      if (!Array.isArray(a)) return;
      if (typeof a[0] === 'string' && typeof a[1] === 'string' && typeof a[2] === 'number' && typeof a[3] === 'number') {
        if (!out[a[0]]) out[a[0]] = { key: a[0], label: a[1], min: a[2], max: a[3], step: a[4], dim: a[5] && a[5].dim, group: path };
        return;
      }
      const name = typeof a[0] === 'string' && Array.isArray(a[1]) ? a[0] : null;
      for (const x of a) walk(x, name ? (path ? path + ' / ' : '') + name : path);
    };
    const PAGE = W.CAGE_PAGE || {};
    walk(PAGE.groupsOverride, '');
    if (W.CAGE_PARTS && W.CAGE_PARTS.groups) walk(W.CAGE_PARTS.groups, '');
    return out;
  }

  const api = { PARTS, PID, birth, build, rowDefs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DT_BUILD = api;
})(typeof self !== 'undefined' ? self : this);
