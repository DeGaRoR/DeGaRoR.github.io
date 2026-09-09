#!/usr/bin/env node
// ============================================================
// TREE INSPECT (W0a) — what is in assets/treesRaw, and what it costs.
//
// futureDesigns/WORLD-V2.md §8.3 R1 asks for a real near tree: a trunk mesh
// plus alpha-tested leaf cards, 2-8 k triangles, 3-5 species x 2-3 age
// classes. This tool is what turns a folder of downloads into that decision.
//
// THIS TOOL DECIDES WHAT A TREE IS, AND tools/_trees.html ONLY DRAWS IT.
// The first version derived the grouping twice — here by mesh name, and again
// in the page — and both were wrong in different ways. A pack's own node
// GRAPH is the truth, and only this side can see it, so the index it writes
// carries the finished grouping (node indices and all) and the page looks
// nothing up for itself. Same rule as tools/props_table.py and _props.html.
//
// FOUR THINGS THE NAMES CANNOT TELL YOU, MEASURED HERE INSTEAD:
//
//  1. WHERE ONE TREE ENDS. Packs split a tree into trunk and foliage as
//     SEPARATE nodes, and the indices do not correspond: in
//     low_poly_forest_tree_pack, `Tree_Trunk_01` stands at x=-45.8 while
//     `Tree_Branches_01` stands at x=-24.1 — pairing them by name pairs the
//     wrong halves. Their FOOTPRINTS pair correctly, so parts are merged by
//     overlapping XZ box, computed from accessor min/max through the node
//     transforms (no binary read: glTF stores POSITION bounds).
//
//  2. WHERE THE LODs ARE. Two conventions in one folder: the pine pack hangs
//     `X_LOD0..X_Billboard_LOD3` UNDER the tree node, the fir pack lays
//     `X_LOD0..X_LOD3` beside it as SIBLINGS. Both are folded to one chain.
//
//  3. HOW BIG IT ACTUALLY IS. pine_tree_low-poly measures 739.61 m — about
//     40x oversize. A height in metres is the only thing that catches that,
//     and it is reported rather than silently corrected.
//
//  4. WHETHER THE FOLIAGE CAN CUT AT ALL. A material in BLEND or MASK whose
//     base-colour texture carries NO ALPHA CHANNEL renders solid whatever the
//     cutoff — so the PNG colour type / JPEG marker is read out of the image
//     header, and an asset that cannot cut is flagged.
//
// The rule that governs what happens next: IMPORT AS-IS. Where a pack ships
// an LOD chain, that chain IS the chain — this tool reports it, it never
// proposes to build another one.
//
//   node tools/tree_inspect.js            inspect + write tools/_trees_index.json
//   node tools/tree_inspect.js --print    also print the per-group table
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

const RAW = path.join(__dirname, '..', 'assets', 'treesRaw');
const OUT = path.join(__dirname, '_trees_index.json');
// --trace=<substring> prints every group of the matching asset, with its box
const TRACE_ARG = (process.argv.find(a => a.startsWith('--trace')) || '').split('=')[1] || null;
let TRACE = false;

// ---- zip: walk the central directory, inflate only the entry we want ------
function zipEntries(file) {
  const buf = fs.readFileSync(file);
  let eo = -1;                                    // end-of-central-directory
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw new Error('no EOCD (zip64, or not a zip)');
  const n = buf.readUInt16LE(eo + 10);
  let off = buf.readUInt32LE(eo + 16);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20), usize = buf.readUInt32LE(off + 24);
    const nLen = buf.readUInt16LE(off + 28), eLen = buf.readUInt16LE(off + 30),
          cLen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    out.push({ name: buf.toString('utf8', off + 46, off + 46 + nLen), method, csize, usize, lho });
    off += 46 + nLen + eLen + cLen;
  }
  return { buf, entries: out };
}
function zipRead(z, e) {
  const b = z.buf;
  const nLen = b.readUInt16LE(e.lho + 26), eLen = b.readUInt16LE(e.lho + 28);
  const start = e.lho + 30 + nLen + eLen;
  const data = b.subarray(start, start + e.csize);
  return e.method === 0 ? data : zlib.inflateRawSync(data);
}

// ---- 4x4 column-major, enough for node transforms ------------------------
function trsOf(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const m = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
             2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
             2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
             0, 0, 0, 1];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] *= s[c];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0; for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function xf(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
          m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
          m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

// ---- glTF arithmetic -----------------------------------------------------
function primTris(g, p) {
  const mode = p.mode === undefined ? 4 : p.mode;
  let n = 0;
  if (p.indices !== undefined) n = g.accessors[p.indices].count;
  else if (p.attributes && p.attributes.POSITION !== undefined) n = g.accessors[p.attributes.POSITION].count;
  if (mode === 4) return n / 3;                     // TRIANGLES
  if (mode === 5 || mode === 6) return Math.max(0, n - 2);   // STRIP / FAN
  return 0;
}

// ---- geometry identity ---------------------------------------------------
// A SCENE is not a pack: `the_landscape_is_a_forest_in_the_mountains` holds
// 944 nodes and 546 meshes, and they are TEN geometries copied — 271 of one
// card, 101 of another. Nothing in the names says so (they are content
// hashes), the meshes are not shared by index, and node count is meaningless.
// The only honest identity is the GEOMETRY ITSELF, so hash the POSITION and
// index bytes plus the material name and collapse the duplicates, keeping a
// count. On a pack of distinct trees this changes nothing.
function geomSig(g, bin, meshNodes, nodes) {
  const h = crypto.createHash('sha1');
  for (const ni of meshNodes) {
    const m = g.meshes[nodes[ni].mesh];
    for (const p of m.primitives) {
      // Hash the ACCESSOR's own byte range, not its bufferView's. Exporters
      // pack many accessors into one bufferView, so hashing the view makes
      // every mesh in a pack collide — which collapsed three distinct Poly
      // Haven variants into one and emptied the pine pack of trees.
      const bytesOf = ai => {
        const a = g.accessors[ai];
        if (a.bufferView === undefined || !bin) return null;
        const bv = g.bufferViews[a.bufferView];
        const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
        const comp = COMP_BYTES[a.componentType] || 4;
        const n = NUM_COMP[a.type] || 1;
        const len = bv.byteStride ? (a.count - 1) * bv.byteStride + comp * n : a.count * comp * n;
        return bin.subarray(start, Math.min(start + len, bin.length));
      };
      const posA = g.accessors[p.attributes.POSITION];
      h.update(String(posA.count) + ':' + (posA.min || []).join(',') + ':' + (posA.max || []).join(','));
      const pos = bytesOf(p.attributes.POSITION);
      if (pos) h.update(pos); else h.update('nopos');
      if (p.indices !== undefined) {
        h.update('i' + g.accessors[p.indices].count);
        const ix = bytesOf(p.indices); if (ix) h.update(ix);
      }
      h.update(String(p.material !== undefined ? (g.materials[p.material].name || p.material) : '-'));
    }
  }
  return h.digest('hex').slice(0, 12);
}

const COMP_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NUM_COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

// ---- reading actual geometry --------------------------------------------
// Everything above works off accessor METADATA. Splitting a welded mesh needs
// the vertices themselves, so this is the one place the tool decodes them.
function readAcc(g, bin, i) {
  const a = g.accessors[i];
  const n = NUM_COMP[a.type] || 1, cb = COMP_BYTES[a.componentType] || 4;
  const out = a.componentType === 5126 ? new Float32Array(a.count * n)
            : a.componentType === 5125 ? new Uint32Array(a.count * n)
            : new Uint16Array(a.count * n);
  if (a.bufferView === undefined || !bin) return out;
  const bv = g.bufferViews[a.bufferView];
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const stride = bv.byteStride || n * cb;
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
    const o = base + k * stride + c * cb;
    if (o + cb > bin.byteLength) continue;
    out[k * n + c] = a.componentType === 5126 ? dv.getFloat32(o, true)
      : a.componentType === 5125 ? dv.getUint32(o, true)
      : a.componentType === 5123 ? dv.getUint16(o, true)
      : a.componentType === 5121 ? dv.getUint8(o) : dv.getInt16(o, true);
  }
  return out;
}

// ---- pulling individual subjects out of a welded mesh --------------------
// A merged-by-material export has no separable trees: `Trunk_Oak` is EVERY
// oak trunk in one mesh. But a tree is a connected island of triangles, and
// islands are recoverable — union-find over the index buffer, then each
// island translated to its own origin and hashed so that the same tree
// stamped forty times is ONE geometry with a count.
//
// This is the only honest way to answer "what unique trees are in here",
// and it is confined to welded files, where nothing else can answer at all.
function splitComponents(g, bin, meshIdx, world) {
  const out = [];
  for (const p of g.meshes[meshIdx].primitives) {
    if (p.indices === undefined || p.attributes.POSITION === undefined) continue;
    const idx = readAcc(g, bin, p.indices);
    const pos = readAcc(g, bin, p.attributes.POSITION);
    const nv = pos.length / 3;
    if (!nv || idx.length < 3) continue;
    const parent = new Int32Array(nv);
    for (let i = 0; i < nv; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    for (let t = 0; t + 2 < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t + 1], idx[t + 2]); }
    const groups = new Map();
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const r = find(idx[t]);
      let G = groups.get(r);
      if (!G) { G = { tris: 0, vs: new Set() }; groups.set(r, G); }
      G.tris++; G.vs.add(idx[t]); G.vs.add(idx[t + 1]); G.vs.add(idx[t + 2]);
    }
    for (const G of groups.values()) {
      const lb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const v of G.vs) for (let d = 0; d < 3; d++) {
        const c = pos[v * 3 + d];
        if (c < lb[d]) lb[d] = c;
        if (c > lb[3 + d]) lb[3 + d] = c;
      }
      // hash the island in ITS OWN frame, quantised to a centimetre, so the
      // same tree at two positions collapses to one geometry
      const h = crypto.createHash('sha1');
      const vs = [...G.vs].sort((a, b) => a - b);
      h.update(String(G.tris) + ':' + vs.length);
      for (const v of vs) for (let d = 0; d < 3; d++)
        h.update(String(Math.round((pos[v * 3 + d] - lb[d]) * 100)) + ',');
      // The world box needs ALL EIGHT corners — two are only correct without
      // rotation — and the HEIGHT must come from that box, not from the local
      // one, or a mesh carrying a scale reports a 44-triangle trunk 39 m tall.
      const wb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let k = 0; k < 8; k++) {
        const w = xf(world, [k & 1 ? lb[3] : lb[0], k & 2 ? lb[4] : lb[1], k & 4 ? lb[5] : lb[2]]);
        for (let d = 0; d < 3; d++) {
          if (w[d] < wb[d]) wb[d] = w[d];
          if (w[d] > wb[3 + d]) wb[3 + d] = w[d];
        }
      }
      out.push({
        sig: h.digest('hex').slice(0, 12),
        tris: G.tris,
        local: lb.slice(),
        h: wb[4] - wb[1],
        box: wb,
        material: p.material,
      });
    }
  }
  return out;
}

// ---- image headers: can this texture cut at all? -------------------------
// A PNG's IHDR colour type is byte 25: 4 = grey+alpha, 6 = RGBA. Anything
// else, and every JPEG, has no alpha channel — so a MASK or BLEND material
// wearing it renders SOLID whatever the cutoff. That is the whole explanation
// for a "very solid" low-poly tree, and it is a fact in the file.
function alphaOf(bytes) {
  if (!bytes || bytes.length < 26) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {     // PNG
    const ct = bytes[25];
    return { fmt: 'png', bits: bytes[24], colorType: ct, hasAlpha: ct === 4 || ct === 6 };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { fmt: 'jpeg', hasAlpha: false };
  return null;
}

// ---- is this file allowed to ship? ---------------------------------------
// GATE MEDIA polices what lands in media/; this is the check one step
// upstream, because a licence is a property of the SOURCE and gets forgotten
// between the download and the bake. CC-BY and CC0 may ship with attribution;
// "SKETCHFAB Standard" and its relatives may NOT be redistributed at all, so
// such a file is a local reference and nothing else — the bench says so in
// red and no bake tool should ever read one.
function licenceOf(credit) {
  const text = (credit && credit.license) || '';
  if (!text) return { text: '', ok: null, why: 'no licence in the file' };
  if (/CC0|public\s*domain/i.test(text)) return { text, ok: true, why: 'CC0 — no attribution required' };
  if (/CC[-_ ]?BY/i.test(text)) return { text, ok: true, why: 'CC-BY — attribution required, see CREDITS.md' };
  return { text, ok: false, why: 'NOT a redistributable licence — local reference only, never bake into media/' };
}

// FOUR KINDS (user, 2026-09-08): tree, shrub, billboard, terrain.
// A ROCK IS PART OF THE GROUND, not a subject of its own — it is scattered
// with the terrain and never against the trees — so the rock layer goes back
// where it came from. Everything that is not a plant IS the terrain: the
// road, the grass, the leaf litter, the boulders, the reference plane. All of
// it is kept IN PLACE, because the point of keeping it is to scatter our own
// trees onto it.
// Every term is anchored to the START OF A NAME SEGMENT, because a substring
// match is a trap: "Background_Tree_Atlas" contains "ground", and thirteen
// billboard cards were classified as terrain on the strength of it.
const SEG = t => new RegExp('(?:^|[_\s.\-])(?:' + t + ')', 'i');

const FURNITURE = /checker|ref[_ ]?plane|^plane([_.\d]*)$|backdrop|^back$|^sun$|^ground$|^floor$/i;
// What reads as a TREE's own geometry when a file is welded by material.
const TREE_MAT = SEG('trunk|bark|foliage|canopy|branch|leaf|leaves|needle|crown|tree|' +
  'pine|fir|spruce|cedar|larch|birch|oak|maple|willow|alder|hemlock');
const PROP = SEG('rock|stone|boulder|log|stump|cliff|fence|cobble');
// Ground COVER is the layer §8.3's ladder never mentions and a forest floor
// cannot do without: grass, leaf litter, bush. Its own kind, because it
// scatters by a different rule from a tree and reads at a different range.
const COVER = SEG('grass|leaves|litter|bush|fern|moss|shrub|weed|vegetation|flower');
// The ground ITSELF — a road, a puddle, mud, dirt, a far terrain shell.
const GROUND = SEG('road|dirt|mud|puddle|gravel|terrain|ground|sand|soil|path|trail');
// A pack may ship trees that are ALREADY billboards — low_poly_forest_tree_pack
// carries thirteen 26-33 m "Background_Tree_Atlas" cards at ~100 triangles
// each. They are not near assets and they are not a defect either: they are
// somebody's R2 rung, and worth having as a comparison for our own bake.
const CARD_MAT = /atlas|billboard|impostor|imposter/i;

// ============================================================
// THE GROUPING — a pack's node graph, read once
// ============================================================
function group(g, bin) {
  const nodes = g.nodes || [];
  const scene = g.scenes[g.scene || 0];

  // 1. descend past wrapper nodes (Sketchfab_model / *.fbx / RootNode): a
  //    single child that carries no mesh of its own is not a subject.
  let roots = (scene.nodes || []).slice(), M = IDENT, guard = 0;
  // The descent can overshoot INTO a single tree, because a tree node often
  // carries no mesh of its own (fir_tree: RootNode -> Tree_0 -> {trunk mesh,
  // Tree_1}). The merge below repairs the geometry; what it cannot repair is
  // the NAME, so the last non-generic wrapper is kept as the container's name
  // and used when the whole file collapses to one subject.
  let containerName = null;
  const GENERIC = /^(sketchfab_model|rootnode|root|scene|.*\.fbx|.*\.blend)$/i;
  while (roots.length === 1 && nodes[roots[0]].mesh === undefined &&
         (nodes[roots[0]].children || []).length && guard++ < 16) {
    const nm = nodes[roots[0]].name || '';
    if (nm && !GENERIC.test(nm)) containerName = nm;
    M = mul(M, trsOf(nodes[roots[0]]));
    roots = nodes[roots[0]].children;
  }

  // 2. EXPAND the two LOD conventions into one shape. The pine pack hangs
  //    `Pine_big_1_LOD0 .. _Billboard_LOD3` UNDER the tree node; the fir pack
  //    lays `Christmas tree_LOD0..LOD3` beside it. Lifting the rungs of the
  //    first case up to element level makes both fold identically at step 3 —
  //    without this the pine pack reports one element per tree carrying the
  //    SUM of its chain (21,632 tris for a tree whose LOD0 is 11,844).
  const subjects = [];
  for (const ri of roots) {
    const kids = nodes[ri].children || [];
    const rungs = kids.filter(c => /[_ ]LOD\d+\s*$/i.test(nodes[c].name || ''));
    if (rungs.length && nodes[ri].mesh === undefined) {
      const up = trsOf(nodes[ri]);
      for (const c of kids) subjects.push({ node: c, pre: up });
    } else subjects.push({ node: ri, pre: IDENT });
  }

  // 2b. IS THIS A PACK OR A SCENE? A pack's container children are its
  //     subjects. A SCENE's are arbitrary bundles: `the_landscape_is_a_forest`
  //     puts 546 meshes under 25 children, and those 546 are ten geometries
  //     copied — so grouping by child would fuse a forest into three lumps.
  //     The test is not node count, which means nothing; it is GEOMETRY
  //     REUSE. Census every mesh-bearing node, hash it, and if most of the
  //     hashes repeat, the file is a scene and each MESH NODE is a subject.
  const census = [];
  for (const ri of roots) (function scan(i, m) {
    const n = nodes[i];
    if (n.mesh !== undefined) census.push({ node: i, parent: m });
    const mm = mul(m, trsOf(n));
    for (const c of (n.children || [])) scan(c, mm);
  })(ri, M);

  let sceneMode = false;
  if (census.length > 30) {
    const seen = new Set();
    for (const c of census) seen.add(geomSig(g, bin, [c.node], nodes));
    sceneMode = seen.size / census.length < 0.5;
  }
  if (sceneMode) {
    subjects.length = 0;
    for (const c of census) subjects.push({ node: c.node, pre: null, abs: c.parent });
  }

  // 3. every subject, with its world box, its triangles and the mesh node
  //    indices under it (the page addresses meshes by these).
  const els = [];
  for (const sub of subjects) {
    const ri = sub.node;
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let tris = 0;
    const meshNodes = [], mats = new Set();
    const walk = (ni, m) => {
      const n = nodes[ni], mm = mul(m, trsOf(n));
      if (n.mesh !== undefined) {
        meshNodes.push(ni);
        for (const p of g.meshes[n.mesh].primitives) {
          tris += primTris(g, p);
          if (p.material !== undefined) mats.add(p.material);
          const a = g.accessors[p.attributes.POSITION];
          if (!a || !a.min) continue;
          for (let k = 0; k < 8; k++) {
            const w = xf(mm, [k & 1 ? a.max[0] : a.min[0],
                              k & 2 ? a.max[1] : a.min[1],
                              k & 4 ? a.max[2] : a.min[2]]);
            for (let d = 0; d < 3; d++) {
              if (w[d] < box[d]) box[d] = w[d];
              if (w[d] > box[3 + d]) box[3 + d] = w[d];
            }
          }
        }
      }
      for (const c of (n.children || [])) walk(c, mm);
    };
    walk(ri, sub.abs ? sub.abs : mul(M, sub.pre));
    if (!meshNodes.length) continue;                 // lights, empties
    els.push({
      name: nodes[ri].name || ('node' + ri),
      root: ri, meshNodes, tris: Math.round(tris), mats: [...mats],
      box: isFinite(box[0]) ? box : null,
    });
  }

  // 3a. MERGED-BY-MATERIAL EXPORT — the third shape in this folder, and the
  //     one that defeats every rule above. `update_dirt_road_through_forest`
  //     welds every instance of a material into ONE mesh: 27 meshes for 26
  //     materials, node names all `Background_Tree_Atlas.0xx` (a leftover
  //     from the author's other pack) and each subject spread across the
  //     whole scene. Footprints therefore all overlap and the material sets
  //     are disjoint BY CONSTRUCTION, so part-merging fuses the lot — it made
  //     three lumps, one of 328,953 triangles.
  //     The identity here is the MATERIAL. Detect the shape, name each
  //     subject after its material, and do not part-merge.
  const oneMatEach = els.length >= 8 && els.every(e => e.mats.length === 1);
  const distinctMats = new Set(els.map(e => e.mats[0])).size;
  const byMaterial = oneMatEach && distinctMats >= els.length * 0.8;
  if (byMaterial) for (const e of els)
    e.name = (g.materials[e.mats[0]] && g.materials[e.mats[0]].name) || e.name;

  //     And once the shape is known, the TREES can be pulled out of it. A
  //     welded `Trunk_Oak` is every oak trunk in one mesh; its islands are
  //     the individual trunks, and the atlas mesh beside it holds their
  //     crowns. Split both, pair a trunk with the card standing in the same
  //     place, and a scene that offered "2 trees" offers its real ones.
  //     Every other material — grass, road, litter, rock — stays whole and
  //     becomes TERRAIN in place, which is what it is for.
  if (byMaterial) {
    // Litter and grass call themselves "leaves" and would be split as trees;
    // they are the forest FLOOR, so the ground vocabulary wins here.
    const treeEls = els.filter(e => (TREE_MAT.test(e.name) || CARD_MAT.test(e.name)) &&
      !COVER.test(e.name) && !GROUND.test(e.name));
    if (treeEls.length) {
      const inst = [];
      for (const e of treeEls) {
        const nd = e.meshNodes[0];
        if (nd === undefined || nodes[nd].mesh === undefined) continue;
        let wm = M;
        (function acc(i, m) {                       // world matrix of this node
          const mm = mul(m, trsOf(nodes[i]));
          if (i === nd) { wm = mm; return true; }
          for (const c of (nodes[i].children || [])) if (acc(c, mm)) return true;
          return false;
        })(e.root, M);
        for (const c of splitComponents(g, bin, nodes[nd].mesh, wm)) {
          c.node = nd; c.card = CARD_MAT.test(e.name); c.src = e.name;
          inst.push(c);
        }
      }
      // ONE SUBJECT PER MATERIAL, with its island COUNT and a representative.
      //
      // The first attempt tried to dedupe the islands into "unique tree
      // geometries" by hashing each one in its own frame. It collapsed 12,948
      // islands to 12,945 — because a scattered instance is randomly ROTATED,
      // and translating to the origin removes only the offset. Making the
      // hash rotation-invariant is a far bigger job than this file is worth,
      // and it would still be answering the wrong question: what the author
      // wants to know is how many trees are in here and what one looks like.
      //
      // So: count the islands per material, and keep the MEDIAN-sized one as
      // the thing you can look at. A median rather than the largest, because
      // the largest island in a welded stand is usually two trees touching.
      const bySrc = new Map();
      for (const c of inst) {
        if (!bySrc.has(c.src)) bySrc.set(c.src, []);
        bySrc.get(c.src).push(c);
      }
      const keep = els.filter(e => !(TREE_MAT.test(e.name) || CARD_MAT.test(e.name)) ||
        COVER.test(e.name) || GROUND.test(e.name));
      els.length = 0;
      for (const e of keep) els.push(e);
      for (const [src, list] of bySrc) {
        list.sort((a, b) => a.tris - b.tris);
        const rep = list[Math.floor(list.length / 2)];
        els.push({
          name: src, root: rep.node, meshNodes: [rep.node],
          tris: rep.tris, mats: [], box: rep.box,
          copies: list.length,
          islands: list.length,
          // the page draws the welded mesh CLIPPED to this local box — the
          // only way to show one island without repeating the split there
          clips: [{ node: rep.node, local: rep.local }],
          forcedKind: rep.card ? 'billboard' : 'tree',
        });
      }
      if (TRACE) console.log('   welded: ' + inst.length + ' islands across ' +
        bySrc.size + ' materials');
    }
  }

  // 3b. COLLAPSE IDENTICAL GEOMETRY. A scene repeats one card hundreds of
  //     times; a pack of distinct trees is untouched by this. The
  //     representative keeps the tallest instance, because a card staked at
  //     different scales is still one asset and its useful size is its
  //     largest.
  const bySig = new Map();
  for (const e of els) {
    e.sig = geomSig(g, bin, e.meshNodes, nodes);
    const prior = bySig.get(e.sig);
    if (!prior) { if (e.copies === undefined) e.copies = 1; bySig.set(e.sig, e); continue; }
    prior.copies++;
    const hp = prior.box ? prior.box[4] - prior.box[1] : 0;
    const he = e.box ? e.box[4] - e.box[1] : 0;
    if (he > hp) { prior.box = e.box; prior.root = e.root; prior.meshNodes = e.meshNodes; }
  }
  const unique = [...bySig.values()];
  els.length = 0;
  for (const e of unique) els.push(e);

  // 4. fold the rungs: `X_LOD2` and `X_Billboard_LOD3` are levels of X.
  const lodInside = ri => {
    let found = false;
    const w = i => {
      // end-anchored: a RUNG is `X_LOD1`, whereas `Spruce_LOD0_M_Bark.001_0`
      // is a mesh inside one. Matching anywhere marked spruce_tree's bark and
      // foliage as two chains and stopped them merging into one tree.
      if (/[_ ]LOD\d+\s*$/i.test(nodes[i].name || '')) found = true;
      for (const c of (nodes[i].children || [])) w(c);
    };
    w(ri);
    return found;
  };
  const groups = new Map();
  for (const e of els) {
    const own = /^(.*?)[_ ](?:billboard[_ ])?LOD(\d+)\s*$/i.exec(e.name);
    const key = own ? own[1].trim() : e.name;
    const lod = own ? +own[2] : null;
    if (!groups.has(key)) groups.set(key, { key, els: [], lods: {}, chainInside: false });
    const G = groups.get(key);
    G.els.push(e);
    if (lod === null) {
      if (lodInside(e.root)) G.chainInside = true;
      G.lods[0] = (G.lods[0] || 0) + e.tris;
    } else G.lods[lod] = (G.lods[lod] || 0) + e.tris;
  }

  // 5. merge co-located PARTS. After LOD folding, any two groups whose XZ
  //    footprints overlap are the same subject split into trunk and foliage —
  //    the step names could not do (see the header, §1).
  const list = [...groups.values()].map(G => {
    // The box is ONE RUNG's box, not the union of the chain's. The pine pack
    // parks LOD0..LOD3 side by side for comparison, so a union spans ~20 m
    // and a 12.9 m pine gets a 300 m2 footprint — which read as terrain.
    const lowest = G.els.reduce((m, e) => {
      const l = /[_ ](?:billboard[_ ])?LOD(\d+)\s*$/i.exec(e.name);
      const lv = l ? +l[1] : 0;
      return m === null || lv < m ? lv : m;
    }, null);
    const sized = G.els.filter(e => {
      const l = /[_ ](?:billboard[_ ])?LOD(\d+)\s*$/i.exec(e.name);
      return (l ? +l[1] : 0) === lowest;
    });
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const e of (sized.length ? sized : G.els)) {
      if (!e.box) continue;
      for (let d = 0; d < 3; d++) {
        if (e.box[d] < box[d]) box[d] = e.box[d];
        if (e.box[3 + d] > box[3 + d]) box[3 + d] = e.box[3 + d];
      }
    }
    return { key: G.key, els: G.els, lods: G.lods, chainInside: G.chainInside, box, parts: 1,
             copies: G.els.reduce((m, e) => Math.max(m, e.copies || 1), 1),
             islands: G.els.reduce((m, e) => Math.max(m, e.islands || 0), 0) };
  });
  const overlapXZ = (a, b) => a.box && b.box && isFinite(a.box[0]) && isFinite(b.box[0]) &&
    a.box[0] <= b.box[3] && b.box[0] <= a.box[3] &&
    a.box[2] <= b.box[5] && b.box[2] <= a.box[5];
  // Overlap alone is not enough: Poly Haven stacks its three whole variants
  // on the same origin, and merging those would report one 11 M-triangle
  // tree that does not exist. The discriminator is MATERIALS — a trunk and
  // its foliage never share one (bark vs branches, Tree_0Mat vs Tree_1Mat),
  // while two whole trees from one pack always do. So: merge on overlapping
  // footprints ONLY when the material sets are disjoint.
  const matsOf = G => { const s = new Set(); for (const e of G.els) for (const m of e.mats) s.add(m); return s; };
  const disjoint = (a, b) => {
    const A = matsOf(a), B = matsOf(b);
    if (!A.size || !B.size) return false;
    for (const m of A) if (B.has(m)) return false;
    return true;
  };
  const multiLevel = G => Object.keys(G.lods).length > 1 || G.chainInside;

  // FURNITURE IS REMOVED BEFORE THE MERGE, and the ordering is the whole
  // point: a ground plane's footprint covers every subject in the file and
  // its material (`waldboden`, a checker, a backdrop) is disjoint from all of
  // them, so a merge that runs first lets the GROUND EAT A TREE — which is
  // exactly what happened to vegetation_set_pine's fourth pine.
  const isFurniture = G => {
    const ok = isFinite(G.box[0]);
    const h = ok ? G.box[4] - G.box[1] : 0;
    const foot = ok ? (G.box[3] - G.box[0]) * (G.box[5] - G.box[2]) : 0;
    return FURNITURE.test(G.key) || (h < 2 && foot > 200);
  };
  const furniture = list.filter(isFurniture);
  for (const G of furniture) { G.kind = 'terrain'; G.h = G.box[4] - G.box[1]; G.tris = G.lods[0] || 0; }

  const merged = [];
  for (const G of list) {
    if (G.kind === 'furniture') continue;
    // a LOD chain deliberately stacks its rungs in one place — never merge
    // two groups that each carry more than one level, or the chain collapses
    // Part-merging is for a subject SPLIT IN TWO, and three things say this
    // is not that: a multi-level group (its rungs stack in one place), a
    // deduplicated representative (copies > 1 means instanced, not split),
    // and a wild size mismatch. Without the copies guard, the forest scene —
    // where every footprint overlaps every other inside 35 m — fuses its ten
    // distinct assets into three.
    const sizeLike = (a, b) => {
      const fa = (a.box[3] - a.box[0]) * (a.box[5] - a.box[2]);
      const fb = (b.box[3] - b.box[0]) * (b.box[5] - b.box[2]);
      return fa > 0 && fb > 0 && Math.max(fa, fb) / Math.min(fa, fb) < 25;
    };
    const mergeable = X => !byMaterial && !multiLevel(X) && (X.copies || 1) === 1;
    const host = !mergeable(G) ? null
      : merged.find(H => mergeable(H) && overlapXZ(H, G) && disjoint(H, G) && sizeLike(H, G));
    if (host) {
      host.els = host.els.concat(G.els);
      host.lods[0] = (host.lods[0] || 0) + (G.lods[0] || 0);
      for (let d = 0; d < 3; d++) {
        host.box[d] = Math.min(host.box[d], G.box[d]);
        host.box[3 + d] = Math.max(host.box[3 + d], G.box[3 + d]);
      }
      // the shorter of the two names is the less part-specific one
      if (G.key.length < host.key.length) host.key = G.key;
      host.parts++;
    } else merged.push(G);
  }

  const isScene = byMaterial || sceneMode;
  // 6. classify. Kind decides which rail the group appears under, and the
  //    project wants the shrubs and the rocks too — they are the same scatter
  //    problem as the trees, and a forest floor with neither is a lawn.
  for (const G of merged) {
    if (G.kind) continue;                 // pre-classified (the ground itself)
    G.merged = byMaterial;      // welded by material: not a separable subject
    const h = isFinite(G.box[0]) ? G.box[4] - G.box[1] : 0;
    G.h = h;
    G.tris = Object.keys(G.lods).reduce((s, k) => s + G.lods[k], 0);
    const matNames = [...new Set([].concat.apply([], G.els.map(e => e.mats)))]
      .map(i => (g.materials[i] && g.materials[i].name) || '').join(' ');
    const foot = isFinite(G.box[0]) ? (G.box[3] - G.box[0]) * (G.box[5] - G.box[2]) : 0;
    // A ground that is only flat is furniture and gets ignored; a ground with
    // RELIEF is terrain, and the user asked to keep it as a test display.
    // In a merged-by-material export EVERY subject carries the whole scene's
    // footprint, so the geometric ground test answers "terrain" for all of
    // them — including 70 k triangles of oak trunk. There, only the name
    // (which IS the material) means anything.
    // A tree recovered from a welded mesh already knows what it is.
    const forced = G.els.reduce((f, e) => f || e.forcedKind, null);
    // A BILLBOARD is a tree too — it is only a tree drawn as a card, and the
    // two will coexist in the world. It keeps its own kind so the ladder can
    // tell which rung an asset already is, not because it is not a tree.
    if (forced) G.kind = forced;
    else if ((CARD_MAT.test(matNames) || CARD_MAT.test(G.key)) && !multiLevel(G)) G.kind = 'billboard';
    // A card is TALL and thin. Requiring height as well as a low triangle
    // count keeps a 63-triangle rock 0.85 m high out of the billboard rail.
    else if (G.tris <= 64 && h > 1.5 && !multiLevel(G)) G.kind = 'billboard';
    else if (PROP.test(G.key)) G.kind = 'terrain';    // rocks belong to the ground
    // In a SCENE, everything that is not a plant or a rock is the ground —
    // road, litter, grass, backdrop — and it is kept in place to scatter on.
    else if (isScene && (GROUND.test(G.key) || COVER.test(G.key))) G.kind = 'terrain';
    else if (!byMaterial && foot > 300 && G.tris > 200 && h < Math.sqrt(foot) * 0.6) G.kind = 'terrain';
    else if (GROUND.test(G.key)) G.kind = 'terrain';
    else if (COVER.test(G.key)) G.kind = h < 4 ? 'shrub' : 'tree';
    else if (h < 4) G.kind = 'shrub';
    else G.kind = 'tree';
  }
  if (merged.length === 1 && containerName) merged[0].key = containerName;
  for (const G of furniture) merged.push(G);
  if (TRACE) for (const G of merged)
    console.log('   trace  ' + String(G.kind).padEnd(10) + G.key.padEnd(26) +
      G.h.toFixed(2) + 'm  parts=' + G.parts + '  tris=' + G.tris +
      '  lods=' + JSON.stringify(G.lods) +
      '  box=' + G.box.map(v => v.toFixed(1)).join(','));
  return merged;
}

function readGLB(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const total = buf.readUInt32LE(8);
  let off = 12, json = null, bin = null;
  while (off + 8 <= total) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len));
    else if (type === 0x004e4942) bin = buf.subarray(off + 8, off + 8 + len);
    off += 8 + len; off += (4 - (off % 4)) % 4;
  }
  return { json, bin, binLen: bin ? bin.length : 0 };
}

function analyse(name, g, ctx) {
  const groups = group(g, ctx.bin);

  // images: size and, crucially, whether they carry an alpha channel
  let texBytes = 0;
  const images = (g.images || []).map((im, i) => {
    let bytes = 0, head = null;
    if (im.bufferView !== undefined && ctx.bin) {
      const bv = g.bufferViews[im.bufferView];
      bytes = bv.byteLength;
      const o = bv.byteOffset || 0;
      head = alphaOf(ctx.bin.subarray(o, o + 32));
    } else if (im.uri && ctx.texSize) {
      bytes = ctx.texSize(im.uri);
      head = /\.jpe?g$/i.test(im.uri) ? { fmt: 'jpeg', hasAlpha: false } : null;
    }
    texBytes += bytes;
    return { i, name: im.name || im.uri || '', kb: Math.round(bytes / 1024),
             fmt: head ? head.fmt : null, hasAlpha: head ? head.hasAlpha : null };
  });

  const baseImg = m => {
    const t = m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture;
    if (!t) return null;
    const tex = g.textures[t.index];
    return tex && tex.source !== undefined ? tex.source : null;
  };
  const mats = (g.materials || []).map(m => {
    const src = baseImg(m);
    const img = src !== null && images[src] ? images[src] : null;
    const alpha = m.alphaMode || 'OPAQUE';
    return {
      name: m.name || '?', alpha,
      cutoff: alpha === 'MASK' ? (m.alphaCutoff !== undefined ? m.alphaCutoff : 0.5) : null,
      doubleSided: !!m.doubleSided,
      img: src,
      // the finding: a cutout material whose texture has no alpha channel
      cannotCut: alpha !== 'OPAQUE' && img ? img.hasAlpha === false : false,
    };
  });

  const shape = G => ({
    name: G.key, kind: G.kind, h: +G.h.toFixed(2), tris: G.tris, parts: G.parts,
    copies: G.copies || 1, islands: G.islands || 0, merged: !!G.merged,
    // TERRAIN is drawn where it stands: it is the surface we will scatter
    // onto, so its own coordinates are the point of keeping it.
    inPlace: G.kind === 'terrain',
    origin: isFinite(G.box[0]) ? [ +G.box[0].toFixed(2), +G.box[1].toFixed(2), +G.box[2].toFixed(2) ] : null,
    // islands cut out of a welded mesh: the page draws the mesh clipped here
    clips: [].concat.apply([], G.els.map(e => e.clips || [])),
    lods: Object.keys(G.lods).sort((a, b) => a - b)
      .map(k => ({ lod: +k, tris: Math.round(G.lods[k]) })),
    chainInside: !!G.chainInside,
    // how the page finds this group's meshes: by glTF NODE INDEX, never name
    els: G.els.map(e => {
      const m = /^(.*?)[_ ](?:billboard[_ ])?LOD(\d+)\s*$/i.exec(e.name);
      return { node: e.root, lod: m ? +m[2] : null, tris: e.tris, name: e.name,
               clips: e.clips || null };
    }),
  });
  const kinds = k => groups.filter(G => G.kind === k).map(shape);
  const trees = kinds('tree').sort((a, b) => b.h - a.h);
  const shrubs = kinds('shrub').sort((a, b) => b.h - a.h);
  const billboards = kinds('billboard').sort((a, b) => b.h - a.h);
  const terrain = kinds('terrain').sort((a, b) => b.tris - a.tris);

  // a stand of conifers is 15-60 m; far outside that is a unit problem in the
  // export, and it is the reason to MEASURE rather than trust
  const hs = trees.filter(t => !t.merged).map(t => t.h);
  const tallest = hs.length ? Math.max.apply(null, hs) : 0;

  return {
    name,
    tris: Math.round((g.meshes || []).reduce((s, m) =>
      s + m.primitives.reduce((t, p) => t + primTris(g, p), 0), 0)),
    meshes: (g.meshes || []).length,
    materials: mats,
    alphaBlend: mats.filter(m => m.alpha === 'BLEND').length,
    alphaMask: mats.filter(m => m.alpha === 'MASK').length,
    cannotCut: mats.filter(m => m.cannotCut).length,
    images: images.length, imageList: images,
    texMB: +(texBytes / 1048576).toFixed(2),
    generator: (g.asset && g.asset.generator) || '?',
    // Sketchfab writes author / licence / source into asset.extras, which is
    // where the c172's CC-BY attribution already comes from (CREDITS.md). An
    // attribution that is READ is an attribution that cannot be invented.
    credit: (g.asset && g.asset.extras) || null,
    licence: licenceOf(g.asset && g.asset.extras),
    // 546 meshes that are ten geometries is the number that matters
    rawMeshes: (g.meshes || []).length,
    rawNodes: (g.nodes || []).length,
    extensions: [].concat(g.extensionsUsed || [], g.extensionsRequired || [])
      .filter((v, i, a) => a.indexOf(v) === i),
    trees, shrubs, billboards, terrain,
    weldedTrees: groups.filter(G => G.els.some(e => e.clips)).length,
    tallest: +tallest.toFixed(2),
    scaleFlag: hs.length ? (tallest > 90 || tallest < 3) : false,
    // what a sane export would have measured, so the page can offer the view
    // side by side without pretending the asset is fixed
    scaleHint: hs.length && (tallest > 90 || tallest < 3) ? +(22 / tallest).toFixed(5) : 1,
  };
}

// ---- run -----------------------------------------------------------------
const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).sort() : [];
const report = [];

for (const f of files) {
  const full = path.join(RAW, f);
  const st = fs.statSync(full);
  if (!st.isFile()) continue;
  const lower = f.toLowerCase();
  try {
    if (lower.endsWith('.glb')) {
      const r0 = readGLB(full);
      TRACE = !!(TRACE_ARG && f.indexOf(TRACE_ARG) >= 0);
      const r = analyse(f, r0.json, { bin: r0.bin });
      TRACE = false;
      r.kind = 'glb';
      r.fileMB = +(st.size / 1048576).toFixed(2);
      r.binMB = +(r0.binLen / 1048576).toFixed(2);
      r.renderable = true;
      report.push(r);
    } else if (lower.endsWith('.zip')) {
      const z = zipEntries(full);
      const ge = z.entries.find(e => e.name.toLowerCase().endsWith('.gltf'));
      if (!ge) continue;
      const g = JSON.parse(zipRead(z, ge).toString('utf8'));
      const texOf = uri => {
        const base = uri.split('/').pop();
        const e = z.entries.find(x => x.name.endsWith(base));
        return e ? e.usize : 0;
      };
      const r = analyse(f, g, { texSize: texOf });
      r.kind = 'gltf-in-zip';
      r.fileMB = +(st.size / 1048576).toFixed(2);
      r.binMB = +((g.buffers || []).reduce((s, b) => s + (b.byteLength || 0), 0) / 1048576).toFixed(2);
      // A browser is not going to hold a 900 MB vertex buffer. These are the
      // offline-render trees: a bake source and a look reference, not a near
      // asset — the bench says so rather than trying to draw them.
      r.renderable = false;
      r.gltfEntry = ge.name;
      report.push(r);
    }
  } catch (e) {
    report.push({ name: f, kind: 'error', error: e.message, fileMB: +(st.size / 1048576).toFixed(2) });
  }
}

fs.writeFileSync(OUT, JSON.stringify(
  { generated: new Date().toISOString(), raw: 'assets/treesRaw', assets: report }, null, 1));

const pad = (s, n) => String(s).padStart(n);
const totMB = report.reduce((s, r) => s + (r.fileMB || 0), 0);
console.log('\nassets/treesRaw — ' + report.length + ' assets, ' + totMB.toFixed(0) + ' MB on disk\n');
console.log('  ' + 'asset'.padEnd(44) + pad('MB', 7) + pad('tris', 11) +
            pad('tree', 6) + pad('shrub', 6) + pad('bboard', 7) + pad('terr', 6) + pad('tallest', 9) + '  notes');
for (const r of report) {
  if (r.kind === 'error') { console.log('  ' + r.name.padEnd(44) + '  ERROR ' + r.error); continue; }
  const notes = [];
  if (!r.renderable) notes.push('offline');
  if (r.scaleFlag) notes.push('SCALE x' + (1 / r.scaleHint).toFixed(0));
  if (r.licence && r.licence.ok === false) notes.push('LICENCE ' + r.licence.text.split(' (')[0]);
  if (r.terrain && r.terrain.length) notes.push('terrain');
  const cop = [].concat(r.trees, r.shrubs, r.billboards, r.terrain).reduce((m, x) => Math.max(m, x.copies || 1), 1);
  if (cop > 1) notes.push(r.rawMeshes + ' meshes -> ' +
    (r.trees.length + r.shrubs.length + r.billboards.length + r.terrain.length) + ' unique');
  if (r.cannotCut) notes.push(r.cannotCut + ' cutout w/o alpha');
  if (r.alphaBlend) notes.push(r.alphaBlend + ' BLEND');
  const chains = r.trees.filter(t => t.lods.length > 1 || t.chainInside).length;
  if (chains) notes.push(chains + ' LOD chains');
  console.log('  ' + r.name.padEnd(44) + pad(r.fileMB, 7) + pad(r.tris.toLocaleString(), 11) +
    pad(r.trees.length, 6) + pad(r.shrubs.length, 6) + pad(r.billboards.length, 7) +
    pad(r.terrain.length, 6) +
    pad(r.tallest ? r.tallest.toFixed(1) + 'm' : '—', 9) + '  ' + notes.join(' · '));
}
if (process.argv.indexOf('--print') >= 0) {
  for (const r of report) {
    if (r.kind === 'error') continue;
    console.log('\n### ' + r.name + '  (' + r.fileMB + ' MB)');
    for (const t of r.trees.concat(r.shrubs))
      console.log('    ' + (t.kind === 'shrub' ? '~' : ' ') + t.name.padEnd(30) +
        pad(t.h.toFixed(1) + 'm', 8) + pad(t.copies > 1 ? 'x' + t.copies : '', 7) + '  ' +
        (t.parts > 1 ? t.parts + ' parts' : '       ') + '  ' +
        t.lods.map(l => 'L' + l.lod + ' ' + l.tris.toLocaleString()).join(' · ') +
        (t.chainInside ? '  (chain inside)' : ''));
    if (r.billboards.length) console.log('    billboards: ' + r.billboards.length + ' — ' +
      r.billboards.map(c => c.h.toFixed(1) + 'm/' + c.tris + 't' + (c.copies > 1 ? ' x' + c.copies : '')).slice(0, 10).join(', '));
    if (r.terrain.length) console.log('    terrain: ' + r.terrain.map(t =>
      t.name.slice(0, 14) + ' ' + t.tris.toLocaleString() + ' tris').join(', '));
    if (r.licence) console.log('    licence: ' + (r.licence.ok === true ? 'OK — ' :
      r.licence.ok === false ? 'BLOCKED — ' : 'UNKNOWN — ') + r.licence.why);
    if (r.weldedTrees) console.log('    ' + r.weldedTrees + ' trees cut out of welded meshes');
  }
}
console.log('\nwrote ' + path.relative(path.join(__dirname, '..'), OUT) + '\n');
