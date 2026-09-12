#!/usr/bin/env node
// GATE HOUSE — the wooden house's verdict (G229).
//
//   node tools/_house_check.js            -> "GATE HOUSE: PASS|FAIL"
//   node tools/_house_check.js --selftest -> negative verification
//   node tools/_house_check.js --table    -> the LOD ledger, per preset
//
// WHAT IT MEASURES, and why these five. The bench draws a house; the things
// that can be WRONG about a generated house are not opinions:
//
//   1 CLEAN GEOMETRY  no NaN, no zero-area triangle, no vertex without a
//     finite UV. The user's ruling for this chantier was geometry first, so
//     this is the headline check rather than a footnote.
//   2 THE WALL MEETS THE ROOF  no wall vertex inside the plan stands above
//     the roof's own underside. A wall poking through its roof is THE bug of
//     parametric buildings: it appears the moment somebody changes the pitch
//     and nothing else notices.
//   3 IT STANDS ON THE SITE  nothing is buried more than a footing's depth
//     below the sloping ground, and every post foot lands on it. A house on a
//     10-degree beach is the whole reason the stance layer exists.
//   4 THE OPENINGS ARE HONEST  every hole is inside its wall and clear of the
//     roof line. The generator DROPS a window it cannot fit; the count is
//     published, and a build that drops them is saying something true.
//   5 THE TWO MESHES ARE THE SAME HOUSE  lod 1 is a construction, not a
//     decimation: it must be far cheaper AND share the silhouette. Both
//     halves are checked, because either one alone is easy to satisfy by
//     cheating (draw nothing / draw everything).
//
// NEGATIVE-VERIFIED: --selftest doctors the measured geometry (moves one
// vertex, adds one degenerate triangle, buries one post, inflates lod 1) and
// requires the matching check to go red. A check that cannot fail is not a
// check.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const SELFTEST = process.argv.includes('--selftest');
const TABLE = process.argv.includes('--table');

// ---------------------------------------------------------------------------
// THE STUB. `_house_kit.js` touches THREE at exactly one point (bag.mesh), and
// the generator's material table at module scope. Everything the checker looks
// at is produced by the kit's plain arrays — so this measures the geometry the
// bench draws, not a re-derivation of it.
// ---------------------------------------------------------------------------
function makeTHREE() {
  function Col(c) { this.hex = c; }
  Col.prototype.setHex = function (h) { this.hex = h; };
  Col.prototype.multiplyScalar = function (k) {
    const c = this.hex, f = v => Math.round(v * k);
    this.hex = (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
    return this;
  };
  function Mat(o) {
    Object.assign(this, { isMat: 1 }, o || {});
    this.color = new Col((o && o.color) || 0);
  }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry {
    constructor() { this.attributes = {}; this.index = null; }
    setAttribute(k, a) { this.attributes[k] = a; }
    setIndex(i) { this.index = i; }
    computeVertexNormals() {}
  }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; }
               set(x, y) { this.x = x; this.y = y; } }
  class Texture {
    constructor(img) { this.image = img; this.repeat = new Vec2(1, 1); }
  }
  return { BufferAttribute, BufferGeometry, Mesh, Texture, Vector2: Vec2,
           Color: Col,
           MeshLambertMaterial: Mat, MeshStandardMaterial: Mat,
           MeshBasicMaterial: Mat, DoubleSide: 2, FrontSide: 0,
           RepeatWrapping: 1000, sRGBEncoding: 3001 };
}

const win = {};
let VMCTX = null;          // kept: the PBR check has to inject a stub library
{
  const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON,
                Float32Array, Object, Array, Set, Map, Number, String,
                isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx;
  VMCTX = ctx;
  vm.createContext(ctx);
  for (const f of ['_house_kit.js', '_house_gen.js', '_shed_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx,
                    { filename: f });
}
const HG = win.HOUSE_GEN, HK = win.HOUSE_KIT, SG = win.SHED_GEN, BG = win.BIG_GEN;

// THE MATERIAL LIBRARY IS READ FROM THE BAKED MANIFEST, not imported: it is a
// browser payload (it builds `new Image()`), so the gate parses the numbers it
// promises out of the generated file. That is the point — the manifest is the
// contract between house_tex_prep.js and the generator, and this is where the
// two are held to it.
function readLibrary() {
  const f = path.join(TOOLS, '..', 'src', 'viewer', 'house_tex.js');
  if (!fs.existsSync(f)) return null;
  const src = fs.readFileSync(f, 'utf8');
  const out = {};
  const re = /(\w+): \{ kind: '(\w+)', name: '([^']*)', tile: ([\d.]+), px: (\d+), metal: ([\d.]+), ribbed: (true|false)([^\n]*)/g;
  let m;
  while ((m = re.exec(src))) {
    // G234: and what the set REFUSES, which rides on the same line
    const tail = m[8] || '';
    const pn = /punch: ([\d.]+)/.exec(tail);
    out[m[1]] = { kind: m[2], name: m[3], tile: +m[4], px: +m[5], metal: +m[6],
                  ribbed: m[7] === 'true',
                  tint: /tint: false/.test(tail) ? false : true,
                  punch: pn ? +pn[1] : undefined,
                  paint: new RegExp(m[1] + '_paint_').test(src) };
  }
  return Object.keys(out).length ? out : null;
}
const LIB = readLibrary();

// THE PIER KIT (G252): the generator carries PIER_KIT — a mirror of the four
// numbers a placer needs per baked prop — and this reads the packs the way the
// bench does (through the hangar's own codec) and the table the baker read,
// so the three cannot drift: table = packs = mirror, in keys and in metres.
function readPierKit() {
  const dir = path.join(TOOLS, '..', 'src', 'pier');
  const mf = path.join(dir, 'pier_packs.json');
  if (!fs.existsSync(mf)) return null;
  const CORE = require('./flight_core.js');
  const sb = { registerPropPack: CORE.registerPropPack, console };
  vm.createContext(sb);
  for (const f of JSON.parse(fs.readFileSync(mf, 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sb, { filename: f });
  const tab = fs.readFileSync(path.join(TOOLS, 'pier_table.py'), 'utf8');
  const declared = [];
  for (const m of tab.matchAll(/^\s{4}P\('([a-z0-9_]+)',\s*'([a-z]+)'/gm))
    declared.push(m[1]);
  // AND THE HANGAR'S OWN PROPS (G273): the yard borrows the bins, the gas
  // bottles, the ladder, the compressor from src/props/, so their packs are
  // read the same way into a second registry, for YARD_KIT to be held against
  const hangar = { props: {}, order: [] };
  const hd = path.join(TOOLS, '..', 'src', 'props');
  const hm = path.join(hd, 'props_packs.json');
  if (fs.existsSync(hm)) {
    const sb2 = { registerPropPack: p => { for (const k of p.order || Object.keys(p.props)) {
                    hangar.props[k] = p.props[k]; hangar.order.push(k); } }, console };
    vm.createContext(sb2);
    for (const f of JSON.parse(fs.readFileSync(hm, 'utf8')))
      vm.runInContext(fs.readFileSync(path.join(hd, f), 'utf8'), sb2, { filename: f });
  }
  return { reg: CORE.PROP_REG, declared, hangar };
}
const PIERK = readPierKit();

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};
if (!check(!!HG && !!HK, 'the house modules did not load headlessly')) {
  console.log('GATE HOUSE: FAIL');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// MEASURE — one pass over the emitted arrays, per build
// ---------------------------------------------------------------------------
function measure(built) {
  const m = { tris: 0, verts: 0, nan: 0, degen: 0, badUV: 0, wildUV: 0,
              stretch: 0, stretchWorst: 0, stretchWhere: [], corner: 0,
              aoBad: 0, aoSum: 0, aoN: 0, aoMissing: 0, aoMin: 1,
              aoUnder: 0, aoUnderN: 0, aoOpen: 0, aoOpenN: 0,
              above: 0, aboveWorst: 0, buried: 0, buriedWorst: 0,
              bbox: { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 },
              lowPost: 1e9, feet: [] };
  const V = built.V, R = built.R, g = built.stats.ground;
  const hasShell = !!R;              // the shed is members, not panels
  for (const k of HG.BAGS) {
    const d = built.bags[k].data();
    m.tris += d.idx.length / 3;
    m.verts += d.pos.length / 3;
    for (let i = 0, j = 0; i < d.pos.length; i += 3, j += 2) {
      const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2];
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { m.nan++; continue; }
      if (!isFinite(d.uv[j]) || !isFinite(d.uv[j + 1])) m.badUV++;
      // UVs ARE METRES: a value past a building's own size means a projector
      // has run away, and it shows as a smear nobody can trace back
      else if (Math.abs(d.uv[j]) > 400 || Math.abs(d.uv[j + 1]) > 400) m.wildUV++;
      if (x < m.bbox.x0) m.bbox.x0 = x; if (x > m.bbox.x1) m.bbox.x1 = x;
      if (y < m.bbox.y0) m.bbox.y0 = y; if (y > m.bbox.y1) m.bbox.y1 = y;
      if (z < m.bbox.z0) m.bbox.z0 = z; if (z > m.bbox.z1) m.bbox.z1 = z;
      // 2 — a wall standing through its own roof. Only the VOLUME's walls:
      // the generator marks where they end in the siding bag, because a
      // dormer's cheek and a belfry's drum are siding too and both of them
      // stand above the roof on purpose.
      // The wall's OWN thickness is inside the roof footprint — the outer face
      // is the half that can be seen standing through the slab.
      if (hasShell && k === 'siding' && i / 3 < (built.stats.wallVerts || 0) &&
          Math.abs(x) <= V.L / 2 + V.wallT / 2 + 1e-3 &&
          Math.abs(z) <= V.w / 2 + V.wallT / 2 + 1e-3) {
        const over = y - R.underAt(x, z);
        if (over > 0.01) { m.above++; m.aboveWorst = Math.max(m.aboveWorst, over); }
      }
      // 12 — THE BAKED OCCLUSION. Every vertex carries one, it is a fraction,
      // and the two ends of the building must disagree: what is UNDER the
      // floor (between the piles, behind the skirt, inside the deck frame) has
      // to be darker than what is high on an open wall. A bake that returns a
      // flat number would pass a range check and fail this one.
      const av = d.ao ? d.ao[i / 3] : undefined;
      if (av === undefined || !isFinite(av)) m.aoMissing++;
      else {
        if (av < -1e-6 || av > 1 + 1e-6) m.aoBad++;
        m.aoSum += av; m.aoN++; if (av < m.aoMin) m.aoMin = av;
        // THE TWO FACES OF THE SAME WALL. Two earlier cuts of this rule were
        // wrong: "under the floor is darker" is false for a building on tall
        // open piles, and "everything inside the plan is darker" picks up the
        // stove pipe standing in the middle of a room three metres from
        // anything, which is legitimately unoccluded. What cannot be argued
        // with is a wall PANEL: its inner face looks into a closed box and its
        // outer face looks at the weather.
        const fy = built.stats.floorY, py = built.stats.plateY;
        if (hasShell && k === 'siding' && i / 3 < (built.stats.wallVerts || 0) &&
            y > fy + 0.15 && y < py - 0.15) {
          const dz = Math.abs(z) - V.w / 2, dx = Math.abs(x) - V.L / 2;
          const side = Math.abs(dz) > Math.abs(dx) ? dz : dx;
          if (Math.abs(side) > V.wallT * 0.2) {
            if (side < 0) { m.aoUnder += av; m.aoUnderN++; }
            else { m.aoOpen += av; m.aoOpenN++; }
          }
        }
      }
      // 3 — buried in the hillside
      const depth = g(x, z) - y;
      if (depth > m.buriedWorst) m.buriedWorst = depth;
      if (depth > 0.80) m.buried++;
    }
    for (let i = 0; i < d.idx.length; i += 3) {
      const a = d.idx[i] * 3, b = d.idx[i + 1] * 3, c = d.idx[i + 2] * 3;
      const u = [d.pos[b] - d.pos[a], d.pos[b + 1] - d.pos[a + 1],
                 d.pos[b + 2] - d.pos[a + 2]];
      const v = [d.pos[c] - d.pos[a], d.pos[c + 1] - d.pos[a + 1],
                 d.pos[c + 2] - d.pos[a + 2]];
      const n = HK.crs(u, v);
      const area = HK.len(n) * 0.5;
      if (area < 1e-9) { m.degen++; continue; }
      // 10 — TEXEL DENSITY ON THE TRIANGLE ITSELF. Every UV in this generator
      // is METRES on the surface, so uv area and world area must AGREE. A face
      // projected under an angle (a sill mapped with world up, a roof mapped
      // from above) collapses one axis and the texture smears — this is the
      // rule that catches it mechanically instead of by looking at a plank.
      const ua = d.uv[d.idx[i] * 2], va = d.uv[d.idx[i] * 2 + 1];
      const ub = d.uv[d.idx[i + 1] * 2], vb = d.uv[d.idx[i + 1] * 2 + 1];
      const uc = d.uv[d.idx[i + 2] * 2], vc = d.uv[d.idx[i + 2] * 2 + 1];
      const uvA = Math.abs((ub - ua) * (vc - va) - (uc - ua) * (vb - va)) * 0.5;
      if (area > 4e-4) {
        const r = uvA / area;
        if (r < 0.25 || r > 4.0) {
          m.stretch++;
          if (r < m.stretchWorst || m.stretchWorst === 0) m.stretchWorst = r;
          if (m.stretchWhere.indexOf(k) < 0) m.stretchWhere.push(k);
        }
      }
    }
  }
  // 11 — THE SHELL CLOSES AT ITS CORNERS. Four panels drawn on the plan
  // rectangle's own centrelines leave a t/2 notch at every corner unless each
  // one runs half a thickness past it; the outer corner point is where that
  // shows. A vertex there means the panels overlap; none means a gap you find
  // later by changing a dimension.
  if (hasShell) {
    const d = built.bags.siding.data();
    const nW = built.stats.wallVerts || 0;
    const hx = V.L / 2 + V.wallT / 2, hz = V.w / 2 + V.wallT / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      let hit = 0;
      for (let i = 0; i < nW * 3 && i < d.pos.length; i += 3)
        if (Math.abs(d.pos[i] - sx * hx) < 0.012 &&
            Math.abs(d.pos[i + 2] - sz * hz) < 0.012) { hit = 1; break; }
      if (!hit) m.corner++;
    }
  }
  return m;
}

// the checks, as data, so --selftest can doctor a measurement and watch each
// one go red instead of trusting that it would have
const RULES = [
  ['no NaN vertex', m => m.nan === 0, m => m.nan + ' vertices'],
  ['no degenerate triangle', m => m.degen === 0, m => m.degen + ' triangles'],
  ['every vertex has a finite UV', m => m.badUV === 0, m => m.badUV + ' bad'],
  ['no UV runs off the building', m => m.wildUV === 0,
   m => m.wildUV + ' vertices past 400 m'],
  ['no wall stands through its roof', m => m.above === 0,
   m => m.above + ' vertices, worst ' + m.aboveWorst.toFixed(3) + ' m'],
  ['nothing is buried in the hillside', m => m.buried === 0,
   m => m.buried + ' vertices, worst ' + m.buriedWorst.toFixed(2) + ' m'],
  ['no face is mapped under an angle', m => m.stretch === 0,
   m => m.stretch + ' triangles, worst ratio ' + m.stretchWorst.toFixed(3) +
        ' in ' + m.stretchWhere.join('/')],
  ['the wall shell closes at its corners', m => m.corner === 0,
   m => m.corner + ' of 4 corners open'],
  ['every vertex carries an occlusion', m => m.aoMissing === 0 && m.aoBad === 0,
   m => m.aoMissing + ' missing, ' + m.aoBad + ' out of [0,1]'],
  ['the bake is not a flat number',
   m => m.aoN === 0 || (m.aoSum / m.aoN > 0.25 && m.aoSum / m.aoN < 0.985),
   m => 'mean ' + (m.aoSum / Math.max(1, m.aoN)).toFixed(3)],
  // THERE IS NO UNIVERSAL INSIDE/OUTSIDE ORDERING, and two cuts of this gate
  // claimed there was. "Under the floor is darker" is false for a building on
  // tall open piles; "the inner face of a wall is darker" is false for a
  // 50-degree gambrel wrapped in a deck and a lean-to, where the WEATHER side
  // is the one in permanent shade. What is always true is that a bake has
  // range and a dark place in it — which is what is held below.
  ['the bake has somewhere genuinely dark',
   m => m.aoN < 50 || m.aoMin < m.aoSum / m.aoN - 0.22,
   m => 'darkest ' + m.aoMin.toFixed(3) + ', mean ' +
        (m.aoSum / Math.max(1, m.aoN)).toFixed(3)],
];

function runRules(tag, m) {
  for (const r of RULES) check(r[1](m), tag + ': ' + r[0], r[2](m));
}

// ---------------------------------------------------------------------------
// THE MATERIAL LIBRARY (G230)
// ---------------------------------------------------------------------------
// 6 SIMILAR TEXEL DENSITY, which is what the user asked for and what nobody
//   notices is missing until one wall is crisp and the one beside it is soup.
//   Density is px / tile_metres; the import derives px from tile for exactly
//   this reason, and the spread across the whole library is held at 2:1.
// 7 THE ROLE TABLE AND THE PAYLOAD AGREE: every set the generator offers for a
//   part exists in the baked manifest AND declares that part in its own `use`
//   list. Two files, one truth, and a rename in either goes red here.
if (!check(!!LIB, 'the baked material library is missing — ' +
           'run tools/house_tex_prep.js')) {
  console.log('GATE HOUSE: FAIL');
  process.exit(1);
}
{
  const dens = [];
  for (const k in LIB) {
    const set = LIB[k];
    const d = set.px / set.tile;
    dens.push(d);
    // 200 was the floor until the corrugated sheets were tiled at 3.6 and 4.8 m
    // — a deliberately coarse covering buys its resolution back with a 1024,
    // and 213 px/m is where that lands
    check(d >= 190 && d <= 600, 'library: ' + k + ' texel density out of band',
          d.toFixed(0) + ' px/m, want 190-600');
    check(set.tile >= 0.5 && set.tile <= 6.5,
          'library: ' + k + ' tile is not a building scale', set.tile + ' m');
    check([256, 512, 1024].indexOf(set.px) >= 0,
          'library: ' + k + ' payload is not a power of two', String(set.px));
  }
  const spread = Math.max.apply(null, dens) / Math.min.apply(null, dens);
  check(spread <= 2.0, 'library: texel density spread too wide',
        spread.toFixed(2) + ':1 across ' + dens.length + ' sets');
  // 7 — THE KIND TABLE AND THE PAYLOAD AGREE, and every role offers only its
  //   own kind. "Finishes, beams and pillars take veneer; walls and floors
  //   take planks; roofs take sheets or tiles" is a rule the generator can be
  //   held to mechanically, and this is where it is held.
  for (const k in HG.SET_KIND) {
    if (!check(!!LIB[k], 'kind table: ' + k + ' is not in the payload')) continue;
    check(LIB[k].kind === HG.SET_KIND[k],
          'kind table: ' + k + ' is ' + LIB[k].kind + ' in the payload but ' +
          HG.SET_KIND[k] + ' in the generator');
  }
  for (const k in LIB)
    check(!!HG.SET_KIND[k], 'the generator does not know the set ' + k);
  for (const role in HG.ROLE_SETS)
    for (const k of HG.ROLE_SETS[role]) {
      if (!check(!!LIB[k], 'role table: ' + role + ' offers ' + k +
                 ', which the payload does not have')) continue;
      // a role may accept SEVERAL kinds (a pile is a log or a sawn post)
      const want = HG.ROLE_KIND[role];
      check(want.indexOf(LIB[k].kind) >= 0,
            'role table: ' + role + ' wants ' + want.join('/') +
            ' and is offered ' + k + ', which is a ' + LIB[k].kind);
    }
  // 21 — WHAT A SET REFUSES IS SAID TWICE, AND THE TWO MUST AGREE (G234).
  //   The payload declares it (tint / punch, from tools/house_tex_prep.js)
  //   and the generator mirrors it in SET_TINT, because the generator has to
  //   be right with no payload loaded. Exactly the SET_KIND situation, and it
  //   drifts the same way: the day someone makes the stain paintable again in
  //   one file only, this says so.
  for (const k in LIB) {
    const g = HG.SET_TINT[k] || {};
    check((g.tint === false) === (LIB[k].tint === false),
          'refusals: ' + k + ' disagrees about the tint',
          'generator ' + (g.tint === false ? 'refuses' : 'allows') +
          ', payload ' + (LIB[k].tint === false ? 'refuses' : 'allows'));
    const a = g.punch === undefined ? -1 : g.punch;
    const b = LIB[k].punch === undefined ? -1 : LIB[k].punch;
    check(a === b, 'refusals: ' + k + ' disagrees about the punch cap',
          'generator ' + a + ', payload ' + b);
    // and a set that refuses the tint must not be carrying a neutral map
    // either: the map IS the recolouring
    if (LIB[k].tint === false)
      check(!LIB[k].paint, 'refusals: ' + k + ' refuses the tint but was ' +
            'baked a paint map');
  }

  // 26 — NO PRESET ASKS FOR A SET ITS ROLE DOES NOT OFFER (G236.2). SET_IDX
  //   clamps a miss to zero so nothing can crash — and that clamp is how four
  //   presets came to ask for a plank on their trim and quietly wear the first
  //   veneer instead, for four G-numbers, with nothing anywhere saying so. The
  //   generator remembers every miss at load; this is where it is read.
  check((HG.SET_MISS || []).length === 0,
        'a preset asks for a set its role does not offer',
        (HG.SET_MISS || []).join(', '));

  // 27 — THE PIER KIT IS ONE THING SAID THREE TIMES (G252): the declared
  //   table (tools/pier_table.py), the baked packs (src/pier/), and the
  //   generator's headless mirror (PIER_KIT) must agree on every key, and the
  //   mirror's metres must be the packs' metres — a module placed by a deckY
  //   the baker did not measure is a module floating or drowned.
  if (!PIERK) check(false, 'pier: no baked packs under src/pier/ (run tools/pier_prep.py)');
  else {
    // the levels of detail (G301) are baked from the table's props, not
    // declared in it: they are held to their full props below (27c)
    const baked = PIERK.reg.order.filter(k => !PIERK.reg.props[k].lodOf);
    check(JSON.stringify(baked) === JSON.stringify(PIERK.declared),
          'pier: the baked packs are not the declared table',
          'baked ' + baked.join(',') + ' / declared ' + PIERK.declared.join(','));
    // 27c - THE LEVELS OF DETAIL (G301): every level names a full prop of
    //   the packs, is the same size (the same bb: a level that shrank would
    //   stand at another height), has fewer triangles than the level before
    //   it, and stands in from a distance that grows down the chain; and
    //   every person has levels, since the people were three quarters of the
    //   village's triangles before them
    const levels = {};
    for (const k of PIERK.reg.order) {
      const p = PIERK.reg.props[k];
      if (!p.lodOf) continue;
      const base = PIERK.reg.props[p.lodOf];
      if (!check(!!base && !base.lodOf, 'lod: ' + k + ' stands in for ' + p.lodOf + ', which is not a full prop of the packs')) continue;
      check(JSON.stringify(p.bb) === JSON.stringify(base.bb), 'lod: ' + k + ' is not the size of ' + p.lodOf);
      check(p.place === base.place, 'lod: ' + k + ' is placed unlike ' + p.lodOf);
      check(Object.keys(p.mats).every(m => base.mats[m] && base.mats[m].map === p.mats[m].map),
            'lod: ' + k + ' wears maps ' + p.lodOf + ' does not');
      (levels[p.lodOf] = levels[p.lodOf] || []).push(p);
    }
    for (const bk in levels) {
      const lv = levels[bk].sort((a, b) => a.lodDist - b.lodDist);
      let prev = PIERK.reg.props[bk], d = 0;
      for (const p of lv) {
        check(p.nt < prev.nt, 'lod: ' + p.key + ' has no fewer triangles than ' + prev.key, p.nt + ' vs ' + prev.nt);
        check(p.lodDist > d, 'lod: ' + p.key + ' does not stand in from farther than ' + prev.key, p.lodDist + ' vs ' + d);
        prev = p; d = p.lodDist;
      }
    }
    // ... and every prop gets exactly the levels the tool's own table says
    // it should (G303: the boats, the cars, the pier modules and the yard
    // joined the people), so a re-baked prop cannot leave its levels stale
    // or missing
    const LT = require('./prop_lod.js');
    for (const k of baked) {
      const want = LT.levelsFor(PIERK.reg.props[k]);
      const have = (levels[k] || []).map(p => p.lodDist);
      check(JSON.stringify(have) === JSON.stringify(want.map(l => l[1])),
            'lod: ' + k + ' has levels ' + have.join('/') + ' m, the table says ' + want.map(l => l[1]).join('/') + ' m (run node tools/prop_lod.js)');
    }
    // the pier's modules, boats and people mirror in PIER_KIT; the yard
    // group mirrors in YARD_KIT (G273) - between them, every baked key
    const mirror = Object.keys(HG.PIER_KIT).concat(Object.keys(HG.YARD_KIT));
    check(baked.every(k => mirror.includes(k)) &&
          Object.keys(HG.PIER_KIT).every(k => baked.includes(k)),
          'pier: PIER_KIT + YARD_KIT do not mirror the packs',
          Object.keys(HG.PIER_KIT).filter(k => !baked.includes(k)).concat(
            baked.filter(k => !mirror.includes(k))).join(','));
    // 27b - YARD_KIT's metres are the packs' metres, pier packs or hangar packs
    for (const k in HG.YARD_KIT) {
      const p = PIERK.reg.props[k] || PIERK.hangar.props[k], K = HG.YARD_KIT[k];
      if (!check(!!p, 'yard: YARD_KIT.' + k + ' is baked nowhere')) continue;
      const near = (a, b, t) => Math.abs(a - b) <= t;
      check(near(K.L, p.dim[2], 0.02) && near(K.W, p.dim[0], 0.02) &&
            near(K.H, p.dim[1], 0.02),
            'yard: YARD_KIT.' + k + ' is not the baked size',
            K.L + 'x' + K.W + 'x' + K.H + ' vs ' + p.dim[2] + 'x' + p.dim[0] + 'x' + p.dim[1]);
      check(!!K.wall === (p.place === 'wall'),
            'yard: YARD_KIT.' + k + ' disagrees with the packs on being a wall mount');
    }
    for (const k of baked) {
      const p = PIERK.reg.props[k], K = HG.PIER_KIT[k];
      if (!K) continue;
      const near = (a, b, t) => Math.abs(a - b) <= t;
      check(near(K.L, p.dim[2], 0.02) && near(K.W, p.dim[0], 0.02) &&
            near(K.H, p.dim[1], 0.02),
            'pier: PIER_KIT.' + k + ' is not the baked size',
            K.L + 'x' + K.W + 'x' + K.H + ' vs ' + p.dim[2] + 'x' + p.dim[0] +
            'x' + p.dim[1]);
      if (p.deck !== undefined)
        check(!!K.deck && near(K.deck[0], p.deck[0], 0.005) &&
              near(K.deck[1], p.deck[1], 0.005), 'pier: PIER_KIT.' + k +
              ' has deck ends the baker did not measure',
              JSON.stringify(K.deck) + ' vs ' + JSON.stringify(p.deck));
      if (p.deckZ !== undefined)
        check(!!K.dz && near(K.dz[0], p.deckZ[0], 0.005) &&
              near(K.dz[1], p.deckZ[1], 0.005), 'pier: PIER_KIT.' + k +
              ' has a deck extent the baker did not measure',
              JSON.stringify(K.dz) + ' vs ' + JSON.stringify(p.deckZ));
      if (K.y0 !== undefined)
        check(near(K.y0, p.bb[1], 0.005), 'pier: PIER_KIT.' + k +
              ' is not at the author\'s level', K.y0 + ' vs ' + p.bb[1]);
      if (p.float !== undefined)
        check(near(K.float, p.float, 1e-6), 'pier: PIER_KIT.' + k +
              ' floats differently from its table row');
      if (p.piles !== undefined)
        check(JSON.stringify(K.piles) === JSON.stringify(p.piles),
              'pier: PIER_KIT.' + k + ' has piles the baker did not find',
              JSON.stringify(K.piles) + ' vs ' + JSON.stringify(p.piles));
      check(HG.PIER_TRIS[k] === p.nt, 'pier: PIER_TRIS.' + k + ' is stale',
            HG.PIER_TRIS[k] + ' vs ' + p.nt);
      // and the bytes are there and decode: the bench will fetch exactly this
      const bin = path.join(TOOLS, '..', p.bin);
      check(fs.existsSync(bin), 'pier: ' + k + ' names a bin that is not on disk', p.bin);
      if (fs.existsSync(bin)) {
        let thr = null;
        try {
          const CORE = require('./flight_core.js');
          const d = CORE.decodeProp(p, new Uint8Array(fs.readFileSync(bin)));
          const nt = d.parts.reduce((a, q) => a + q.idx.length / 3, 0);
          check(nt === p.nt, 'pier: ' + k + ' decodes to a different triangle count');
        } catch (e) { thr = e; }
        check(!thr, 'pier: ' + k + ' does not decode', thr && thr.message);
      }
    }
  }

  // 25 — DRAWN STANDING SEAMS BELONG ON SHEET METAL, AND ON NOTHING ELSE (the
  //   user, of a shake roof carrying a full set of them: "the attached house
  //   has a significant issue with its roof"). SET_SEAM names the coverings
  //   that take them; this holds that list against what the payload says each
  //   covering IS. Every name in it must be a roof set that is metal and not
  //   already ribbed — and, the half that actually caught the bug, no roof set
  //   OUTSIDE it may be metal and unribbed, or the next sheet added to the
  //   library would quietly lose its seams.
  for (const k in HG.SET_SEAM) {
    check(!!LIB[k], 'seams: ' + k + ' is not in the library');
    if (!LIB[k]) continue;
    check(LIB[k].kind === 'roof', 'seams: ' + k + ' is not a roof set');
    check(LIB[k].metal >= 0.3, 'seams: ' + k + ' is not sheet metal',
          'metal ' + LIB[k].metal);
    check(!LIB[k].ribbed, 'seams: ' + k + ' already has its own corrugation');
  }
  for (const k in LIB)
    if (LIB[k].kind === 'roof' && LIB[k].metal >= 0.3 && !LIB[k].ribbed)
      check(!!HG.SET_SEAM[k], 'seams: ' + k + ' is unribbed sheet metal and ' +
            'gets no standing seams');

  // the paint pot only means anything if the paintable sets carry a neutral map
  const painters = Object.keys(LIB).filter(k => LIB[k].paint);
  check(painters.length >= 3, 'library: too few paintable sets',
        painters.join(',') || 'none');
  // and the finish must survive with no payload at all (headless is exactly
  // that case, and so is a page whose media has not landed yet)
  let threw = null;
  try { HG.applyFinish(Object.assign({}, HG.DEF)); } catch (e) { threw = e; }
  check(!threw, 'applyFinish throws without the payload',
        threw && threw.message);

  // 14 — FULL PBR ON EVERY SLOT (the user: "Please confirm that all materials
  //   have full PBR support now"). The payload is images, which a gate has
  //   none of — so a STUB library with the manifest's own keys and numbers is
  //   handed to the generator, the finish is applied, and every material is
  //   asked what it is wearing. Anything but glass must carry albedo, normal
  //   AND roughness, and its normal must actually be pushed.
  {
    const fake = {};
    for (const k in LIB) {
      const img = { complete: true, naturalWidth: 4, addEventListener: () => {} };
      fake[k] = Object.assign({}, LIB[k], { diff: img, nor: img, rough: img,
                                            paint: LIB[k].paint ? img : null });
    }
    // ON THE CONTEXT, not on `window`: the generator reads the bare global
    // `HOUSE_TEX_SETS`, which resolves against the vm's own global object
    VMCTX.HOUSE_TEX_SETS = fake;
    let threw2 = null;
    try { HG.applyFinish(Object.assign({}, HG.DEF)); } catch (e) { threw2 = e; }
    check(!threw2, 'applyFinish throws with a payload', threw2 && threw2.message);
    for (const r of HG.finishReport()) {
      if (r.glassy) continue;
      check(r.full, 'PBR: ' + r.slot + ' is missing a map',
            'albedo ' + r.map + ', normal ' + r.nor + ', roughness ' + r.rough);
      check(r.nrmScale >= 0.9, 'PBR: ' + r.slot + ' has no normal relief',
            String(r.nrmScale));
      check(r.roughness > 0.05, 'PBR: ' + r.slot + ' is mirror smooth',
            String(r.roughness));
    }
    // and every ROLE, not just the defaults: dress each slot from each of its
    // own sets and confirm the maps land every time
    for (const role in HG.ROLE_SETS)
      for (let i = 0; i < HG.ROLE_SETS[role].length; i++) {
        const P2 = Object.assign({}, HG.DEF);
        P2[role + 'Set'] = i;
        try { HG.applyFinish(P2); } catch (e) {
          check(false, 'PBR: dressing ' + role + ' with ' +
                HG.ROLE_SETS[role][i] + ' threw', e.message);
        }
      }
    // 20 — EVERY PAINT BLEND DRESSES, and the glass stays opaque. The blend
    //   is a shader path, so a gate cannot see its colours — but it CAN see
    //   that each mode dresses the wall without throwing and leaves the
    //   material's own colour white (or the tint would be applied twice), and
    //   that the two glass slots are not transparent.
    for (let bmode = 0; bmode <= HG.PAINT_BLENDS.length; bmode++) {
      const P3 = Object.assign({}, HG.DEF, { paintBlend: bmode, wallCol: 1 });
      let threw3 = null;
      try { HG.applyFinish(P3); } catch (e) { threw3 = e; }
      if (!check(!threw3, 'paint blend ' + bmode + ' throws',
                 threw3 && threw3.message)) continue;
      const sid = HG.MAT.siding;
      const ud = sid.userData.paint;
      check(!!ud, 'paint blend: the wall has no paint uniforms');
      if (ud && bmode > 0)
        check(sid.color.hex === 0xffffff || sid.color.getHex === undefined ||
              sid.color.getHex() === 0xffffff,
              'paint blend ' + bmode + ': the tint is applied twice');
    }
    // ...AND THE GENERATOR ACTUALLY OBEYS THEM. Two behaviours, not two
    // tables: a set that refuses the tint comes out white whatever the pot
    // says, and a set that caps the punch pulls the whole house's saturation
    // uniform down below what an uncapped one gives at the same slider.
    for (const role of ['trim', 'deck', 'post']) {
      const i2 = HG.ROLE_SETS[role].indexOf('stain');
      if (i2 < 0) continue;
      const P4 = Object.assign({}, HG.DEF);
      P4[role + 'Set'] = i2; P4[role + 'Col'] = 5;
      HG.applyFinish(P4);
      const m4 = HG.MAT[role];
      check(!m4.color.getHex || m4.color.getHex() === 0xffffff,
            'refusals: the stain was recoloured on the ' + role,
            m4.color.getHex && m4.color.getHex().toString(16));
    }
    {
      const capped = HG.ROLE_SETS.wall.indexOf('board');
      const free = HG.ROLE_SETS.wall.findIndex(
        (k2, i2) => i2 !== capped && !(HG.SET_TINT[k2] || {}).punch);
      if (capped >= 0 && free >= 0) {
        HG.applyFinish(Object.assign({}, HG.DEF,
                                     { wallSet: capped, paintPunch: 1 }));
        const a2 = HG.SHADE_U.uSat.value;
        HG.applyFinish(Object.assign({}, HG.DEF,
                                     { wallSet: free, paintPunch: 1 }));
        const b2 = HG.SHADE_U.uSat.value;
        check(a2 < b2 - 1e-6, 'refusals: the long boards did not cap the punch',
              a2.toFixed(3) + ' vs ' + b2.toFixed(3));
      }
    }
    HG.applyFinish(Object.assign({}, HG.DEF));
    for (const g2 of ['glass', 'pane'])
      check(!HG.MAT[g2].transparent,
            'the ' + g2 + ' is still see-through');
    delete VMCTX.HOUSE_TEX_SETS;
  }
}

// ---------------------------------------------------------------------------
// THE BATTERY
// ---------------------------------------------------------------------------
const rows = [];
// ONE BATTERY, EVERY HOUSE (G253). Rules 16-29 — the jetty, the doors, the
// roof rims, the pier, the lights — lived inline in the preset loop, so the
// forty random houses only ever met the measured-geometry rules and a lamp
// with no glass in it passed because no preset switches its lights on. The
// battery is a function now and the fuzzer runs it too; a preset's row for
// the table is what it returns.
function battery(name, P) {
  const hi = HG.build(P, 0), lo = HG.build(P, 1);
  const mh = measure(hi), ml = measure(lo);
  runRules(name + ' hi', mh);
  runRules(name + ' lo', ml);

  // 5 — the two meshes are the same house
  const ratio = ml.tris / Math.max(1, mh.tris);
  check(mh.tris > 400, name + ': the near mesh is suspiciously thin',
        mh.tris + ' tris');
  // the RATIO is the rule for a building; a shed 3 m long has so little near
  // detail that its far mesh is a third of it and still only 186 triangles,
  // so an absolute floor stands beside the ratio
  check(ratio < 0.30 || ml.tris < 260,
        name + ': lod 1 is not a low-poly mesh',
        'ratio ' + ratio.toFixed(2) + ', ' + ml.tris + ' tris');
  check(ml.tris > 40, name + ': lod 1 collapsed to nothing',
        ml.tris + ' tris');
  const dB = ['x0','y0','z0','x1','y1','z1']
    .map(k => Math.abs(mh.bbox[k] - ml.bbox[k]));
  const worst = Math.max.apply(null, dB);
  // the far mesh drops trim, seams and pads — all of which stand a few
  // centimetres proud — so the silhouettes may differ by that much and no more
  check(worst < 0.32, name + ': the two meshes are not the same silhouette',
        'worst axis ' + worst.toFixed(3) + ' m');

  // 4 — the openings are honest: everything the generator KEPT clears the roof
  for (const o of hi.stats.openings || []) {
    const lim = Math.min(o.underA, o.underB);
    check(o.y1 <= lim + 1e-6,
          name + ': a kept opening breaks the roof line',
          o.kind + ' by ' + (o.y1 - lim).toFixed(3) + ' m');
    check(o.s0 >= -1e-6 && o.s1 <= o.wallL + 1e-6,
          name + ': an opening runs off the end of its wall');
  }
  // 8 THE DRAINAGE (G230). A gutter on every true eave, and a downpipe that
  //   reaches the ground it stands on — cut to the slope like every post.
  if (P.gutter) {
    check(hi.stats.gutterLen > 1,
          name + ': the gutter asked for was not built',
          hi.stats.gutterLen.toFixed(2) + ' m');
    const eaves = hi.R.facets.filter(f => f.eaveTrue)
      .reduce((a, f) => a + Math.hypot(f.q[1][0] - f.q[0][0],
                                       f.q[1][2] - f.q[0][2]), 0);
    check(Math.abs(hi.stats.gutterLen - eaves) < 0.05,
          name + ': the gutter does not run the true eaves',
          hi.stats.gutterLen.toFixed(2) + ' vs ' + eaves.toFixed(2) + ' m');
    if (P.downpipe) {
      const d = hi.stats.downpipe;
      if (check(!!d, name + ': no downpipe was built')) {
        check(d.clear > 0.05 && d.clear < 0.60,
              name + ': the downpipe does not meet the ground',
              d.clear.toFixed(2) + ' m above it');
        const drop = d.top[1] - d.foot[1];
        check(drop > 0.5, name + ': the downpipe is a stub',
              drop.toFixed(2) + ' m of fall');
      }
    }
  }

  // 9 THE DOOR IS NOT A VOID (G231). A leaf must actually stand in the door
  //   opening: trim geometry inside the hole, at lod 0. This is the check
  //   that goes red if the door ever goes back to being a hole with a casing.
  if (P.door && !P.openFront) {
    const d = hi.bags.trim.data();
    const door = (hi.stats.openings || []).find(o => o.kind === 'door');
    if (check(!!door, name + ': the door was dropped')) {
      let inLeaf = 0;
      const yLo = door.y0 + 0.2, yHi = Math.min(door.y1, door.underA) - 0.2;
      for (let i = 0; i < d.pos.length; i += 3) {
        const y = d.pos[i + 1];
        if (y > yLo && y < yHi) inLeaf++;
      }
      check(inLeaf > 20, name + ': nothing hangs in the door opening',
            inLeaf + ' trim vertices at leaf height');
    }
  }

  // 13 — THE DIAL IS A DIAL. ao 0 must leave every vertex lit: a bake you
  //   cannot switch off is a bake you cannot debug.
  {
    const off = HG.build(Object.assign({}, P, { ao: 0 }), 0);
    let lit = true;
    for (const k of HG.BAGS) {
      const d = off.bags[k].data();
      for (const a of d.ao) if (a < 0.999) { lit = false; break; }
      if (!lit) break;
    }
    check(lit, name + ': ao 0 still darkened something');
    check(off.stats.ao === null, name + ': ao 0 still reported a bake');
    // and the same build twice must bake the same shadows
    const a1 = hi.bags.siding.data().ao;
    const a2 = HG.build(P, 0).bags.siding.data().ao;
    let same = a1.length === a2.length;
    if (same) for (let i = 0; i < a1.length; i++)
      if (Math.abs(a1[i] - a2[i]) > 1e-9) { same = false; break; }
    check(same, name + ': the bake is not deterministic');
  }

  // 16 — NO FLIGHT OF STEPS ENDS IN THE SEA. Over water the stair lands on a
  //   LANDING a hand's breadth above the tide, on its own piles.
  if (P.water && P.porch && P.stairs) {
    const st = hi.stats.stair, jt = hi.stats.jetty;
    if (st) {
      const wet = P.waterY;
      if (st.y0 < wet + 0.02)
        check(!!jt, name + ': the stair walks into the water',
              'foot at ' + st.y0.toFixed(2) + ', tide at ' + wet.toFixed(2));
      // ... or, when the pier is a FIXED one (G277), a swell's height above
      // it - the level the fixed runs are at, PIER_DECK - PIER_LOW higher
      const fixed = P.pier && Math.round(P.pierKind === undefined ? 1 : P.pierKind) === 1;
      const lift = fixed ? HG.PIER_DECK - HG.PIER_LOW : 0;
      if (jt) check(jt.y > wet + 0.1 + lift && jt.y < wet + 0.9 + lift,
                    name + ': the landing is not ' + (fixed ? 'a swell above the tide' : 'just above the tide'),
                    jt.y.toFixed(2) + ' vs ' + wet.toFixed(2));
    }
  }
  // 23 — EVERY DOOR OPENS ONTO SOMETHING (the user: "all houses should have
  //   stairs and entrance. The ones who don't have a door hanging several
  //   meters high, not very practical"). The generator publishes, per door,
  //   the platform it found just outside the leaf — deck, stoop, or the ground
  //   when the threshold is low enough to step off. A door with none is a door
  //   two metres up a wall, which is what the sampler was making whenever it
  //   turned the porch off.
  for (const dr of hi.stats.doors || []) {
    check(dr.platform !== null, name + ': a door opens onto nothing',
          'threshold ' + dr.y0.toFixed(2) + ', ground ' +
          (dr.y0 - dr.drop).toFixed(2));
    if (dr.platform !== null)
      check(dr.drop < 0.45, name + ': a door is a step too high above its own ' +
            'landing', dr.drop.toFixed(2) + ' m');
  }

  // 24 — THE BAY IS A BAY. It is the one detail that is allowed to be strange,
  //   so it is held to being worth it: if the generator kept one, it carries
  //   real glass, and it must not have been built where the roof cannot clear
  //   it (bayPlan refuses instead, which is why this is a KEPT check).
  if (P.bay && hi.stats.bay)
    check(hi.stats.bay.area > 1.0, name + ': the bay carries no glass',
          hi.stats.bay.area.toFixed(2) + ' m2');

  // 22 — A FLIGHT ARRIVES WHERE IT SAID IT WOULD, AND A LONG ONE TURNS (the
  //   user: "when the stairs are too long, do a 90° bend in the stairs, with
  //   a little 'palier'"). Two things, and the first is the one that bites:
  //   the plan solves the foot against the ground it lands on, so the treads
  //   times the rise MUST equal the drop from the deck to that foot — the
  //   moment a turn moves the foot sideways onto ground at a different height
  //   and nothing re-solves, the last tread is a step into the air or into
  //   the hill. Then: past STAIR_MAX treads there has to be a landing.
  for (const st of [hi.stats.stair, hi.stats.stoop]) {
    if (!st || !st.n && !st.steps) continue;
    const n2 = st.n || st.steps;
    if (st.y1 !== undefined && st.rise !== undefined)
      check(Math.abs((st.y1 - n2 * st.rise) - st.y0) < 0.06,
            name + ': the stair does not reach its own foot',
            'out by ' + ((st.y1 - n2 * st.rise) - st.y0).toFixed(3) + ' m');
    check(n2 <= HG.STAIR_MAX || st.turns > 0,
          name + ': a ' + n2 + '-tread flight with no landing in it');
  }

  // 28 — THE PATH HAS NO HOLES (G254, the user: "you may do branching, but
  //   you may not leave holes in the path"). Per chain, every module STARTS
  //   where the one before it ENDED (a centimetre) and ENTERS at the height
  //   it EXITED (five centimetres, the kit's own registration); the main chain
  //   starts at the jetty's end and level and ends in the head; a spur's entry
  //   is butted to the side of a run at that run's level; the doorway stands
  //   over a module, not in a gap; every module is over water; every boat is
  //   afloat, at its waterline, clear of the pier and of each other.
  {
    const pr = hi.stats.pier;
    if (P.water && P.pier && hi.stats.jetty)
      check(!!pr, name + ': a house on the water with a jetty grew no pier');
    if (pr) {
      const g2 = hi.stats.ground, wet = P.waterY;
      const walkers = pr.modules.filter(m => !m.aside && !m.over);
      const chains = {};
      for (const m of walkers) (chains[m.chain] = chains[m.chain] || []).push(m);
      for (const cid in chains) {
        const C = chains[cid];
        for (let i = 1; i < C.length; i++) {
          const a = C[i - 1], b = C[i];
          const gap = b.dir > 0 ? b.a0 - a.a1 : a.a0 - b.a1;
          check(Math.abs(gap) < 0.011, name + ': the pier path has a hole in it',
                'chain ' + cid + ' ' + a.key + ' -> ' + b.key + ': ' + gap.toFixed(3) + ' m');
          check(Math.abs(b.hIn - a.hOut) < 0.05, name + ': the pier path has a step in it',
                'chain ' + cid + ' ' + a.key + ' -> ' + b.key + ': ' +
                (b.hIn - a.hOut).toFixed(3) + ' m');
        }
        if (cid === '0') {
          check(Math.abs(C[0].a0 - hi.stats.jetty.z1) < 0.011,
                name + ': the pier does not start at the jetty');
          check(Math.abs(C[0].hIn - hi.stats.jetty.y) < 0.05,
                name + ': the pier does not start at the jetty\'s level');
        } else {
          const r = C[0].off;
          // the spur's ENTRY end: a0 when it runs +x, a1 when it runs -x
          const ent = C[0].dir > 0 ? C[0].a0 : C[0].a1;
          check(!!r && Math.abs(Math.abs(ent - r.x) - r.w / 2) < 0.011,
                name + ': a spur is not butted to the run it branches from');
          check(!!r && Math.abs(C[0].hIn - r.hOut) < 0.05,
                name + ': a spur leaves its run at another level');
        }
        check(C[C.length - 1].key === 'pier_head',
              name + ': a pier chain does not end in its head',
              'chain ' + cid + ': ' + C.map(m => m.key).join(','));
      }
      // EVERY PILE REACHES THE BOTTOM: for each module, each pile whose
      // author-cut foot hangs above the seabed under it must have been carried
      // down, and the generator says how many it drew
      let need = 0;
      for (const m of pr.modules) {
        const K = HG.PIER_KIT[m.key];
        if (!K || !K.piles) continue;
        const c = Math.cos(m.ry), sn = Math.sin(m.ry);
        for (const pl of K.piles) {
          const wx = m.x + pl[0] * c + pl[1] * sn, wz = m.z - pl[0] * sn + pl[1] * c;
          if (g2(wx, wz) <= m.y + pl[3] - 0.05) need++;
        }
      }
      check(pr.pilesDown === need, name + ': a pier pile hangs above the seabed',
            pr.pilesDown + ' carried down of ' + need + ' that hang');
      // and a hull delivered without its motor gets one
      const bare = pr.boats.filter(b => HG.PIER_KIT[b.key].motor).length;
      check(pr.motors === bare, name + ': a runabout has no outboard on it',
            pr.motors + ' of ' + bare);
      for (const m of pr.modules) {
        check(g2(m.x, m.z) < wet, name + ': a pier module stands on dry ground',
              m.key + ' at z ' + m.z.toFixed(1));
        if (m.over) {
          const under = walkers.find(u => u.chain === m.chain && m.z > u.z0 - 0.01 &&
                                     m.z < u.z1 + 0.01 && Math.abs(u.x - m.x) < 0.5);
          check(!!under, name + ': the doorway stands over nothing');
          if (under) check(Math.abs(m.y + HG.PIER_DECK - under.hIn) < 0.05,
                           name + ': the doorway is not at its deck\'s level');
        }
      }
      // THE KINDS (G277): a fixed pier goes DOWN once and never up again;
      // a floating one never changes level; the doorway is at the house end
      {
        const C0 = (chains['0'] || []);
        let descended = false;
        for (const m of C0) {
          if (m.hOut < m.hIn - 0.3) descended = true;
          else if (m.hOut > m.hIn + 0.3)
            check(false, name + ': the pier climbs' + (descended ? ' after coming down' : ''), m.key);
        }
        if (pr.kind === 0) check(!descended, name + ': a floating pier changed level');
        if (pr.kind === 1) check(descended, name + ': a fixed pier never came down to the water');
        const door = pr.modules.find(m => m.over);
        if (door && C0.length)
          check(door.z < C0[0].z1 + 0.01, name + ': the doorway is not at the house end of the pier',
                door.z.toFixed(2) + ' vs first module to ' + C0[0].z1.toFixed(2));
      }
      for (let i = 0; i < pr.boats.length; i++) {
        const b = pr.boats[i], K = HG.PIER_KIT[b.key];
        const bw = b.turned ? K.L : K.W, bl = b.turned ? K.W : K.L;
        check(b.depth >= 0.35 + K.float * K.H, name + ': a boat is beached',
              b.key + ' in ' + b.depth.toFixed(2) + ' m');
        check(Math.abs(b.y - (wet - K.float * K.H)) < 1e-6,
              name + ': a boat is not at its waterline', b.key);
        // and tied up where the pier floats: beside a module at the low level
        const quay = pr.modules.find(m => m.key === b.run && !m.over && !m.aside &&
          Math.abs(b.x - m.x) < (m.axis === 'x' ? (m.b1 - m.b0) : m.w) / 2 + bw / 2 + 0.5 &&
          Math.abs(b.z - m.z) < (m.z1 - m.z0) / 2 + bl / 2 + 0.5);
        check(!!quay && quay.hOut < wet + HG.PIER_LOW - 0.6,
              name + ': a boat is tied to the fixed pier, not the floating one', b.key);
        for (const m of pr.modules) {
          const hw = (m.axis === 'x' ? (m.b1 - m.b0) : m.w) / 2;
          const hz = (m.z1 - m.z0) / 2;
          check(Math.abs(b.x - m.x) >= hw + bw / 2 - 0.01 ||
                Math.abs(b.z - m.z) >= hz + bl / 2 - 0.01,
                name + ': a boat is inside the pier', b.key + ' / ' + m.key);
        }
        for (let j2 = 0; j2 < i; j2++) {
          const c = pr.boats[j2], KC = HG.PIER_KIT[c.key];
          const cw = c.turned ? KC.L : KC.W, cl = c.turned ? KC.W : KC.L;
          const apart = Math.abs(b.x - c.x) >= (bw + cw) / 2 + 0.05 ||
                        Math.abs(b.z - c.z) >= (bl + cl) / 2 + 0.05;
          check(apart, name + ': two boats overlap', b.key + ' / ' + c.key);
        }
      }
    }
  }

  // 29 — NO LIGHT WITHOUT EMITTING GEOMETRY, AND NO GLOW WITHOUT THE SWITCH
  //   (G253, the user: "Let's also generate lights"). The aeroplane's rule
  //   (G96): a published light source has to have glass that glows within
  //   reach of it, or it is a bare point light in space. And the switch is a
  //   switch: with the lights off there is no glowing vertex on the house, no
  //   lamp and no bulb; with the windows on one switch every pane glows.
  //   (This block was lost between G253 and G254 - a patch anchored on the
  //   rule below swallowed it - and put back in G273. A lamp that is a baked
  //   PROP (G273) emits through the prop's own emissive map, which the packs
  //   record; that is its glass.)
  {
    const lit = hi.stats.lit || { windows: 0, panes: 0, bulbs: 0, lights: [] };
    const gd = hi.bags.glass.data();
    let glowing = 0;
    for (let i = 0; i < gd.lit.length; i++) if (gd.lit[i] > 0.5) glowing++;
    if (!P.lights) {
      check(glowing === 0 && lit.windows === 0 && lit.bulbs === 0 &&
            lit.lights.length === 0,
            name + ': something glows with the lights off',
            glowing + ' vertices, ' + lit.lights.length + ' lamps');
    } else {
      if (P.winLink)
        check(lit.windows === lit.panes,
              name + ': one switch, but not every window is lit',
              lit.windows + ' of ' + lit.panes);
      if (P.porchLamp && P.door)
        check(lit.lights.length >= 1, name + ': the lamp by the door is missing');
      for (const L of lit.lights) {
        if (L.prop) {
          const pk = PIERK && PIERK.reg.props[L.prop];
          const emits = !!pk && Object.keys(pk.mats || {}).some(m => pk.mats[m].emis);
          check(emits, name + ': a prop lamp has no emissive in its bake', L.prop);
          // and the bulb the light is stood in is inside the fixture, off the wall
          check(Math.hypot(L.x - L.mx, L.z - L.mz) < (HG.YARD_KIT[L.prop] || { L: 0.2 }).L + 0.01,
                name + ': a prop lamp has its bulb outside the fixture');
          continue;
        }
        let near = 0;
        for (let i = 0; i < gd.lit.length; i++) {
          if (gd.lit[i] < 0.5) continue;
          const dx = gd.pos[i * 3] - L.x, dy = gd.pos[i * 3 + 1] - L.y,
                dz = gd.pos[i * 3 + 2] - L.z;
          if (dx * dx + dy * dy + dz * dz < 0.3 * 0.3) near++;
        }
        check(near >= 4, name + ': a published light has no glass that glows',
              L.kind + ' at ' + L.x.toFixed(2) + ',' + L.z.toFixed(2));
      }
      if (P.stairLights && hi.stats.stair && P.railStyle > 0)
        check(lit.bulbs > 0, name + ': the stair rail has no bulbs on it');
    }
  }

  // 30 — THE PEOPLE STAND ON SOMETHING (G255): each one's feet are on a
  //   walking level the plan knows - the deck's top, the stoop, or a pier
  //   module's own deck - to the centimetre. A figure a hand's breadth into
  //   the boards or floating over them is the wrong metre stick.
  for (const q of hi.stats.people || []) {
    let want = null;
    if (q.on === 'deck') want = hi.stats.floorY - 0.02;
    else if (q.on === 'stoop') want = hi.stats.front && hi.stats.front.y;
    else if (hi.stats.pier) {
      const m = hi.stats.pier.modules.find(u => u.key === q.on &&
        Math.abs(u.z - q.z) < 0.01);
      want = m ? m.hOut : null;
    }
    check(want !== null && Math.abs(q.y - want) < 0.011,
          name + ': a person is not standing on the ' + q.on,
          q.key + ' at ' + q.y.toFixed(3) + (want === null ? '' : ' vs ' + want.toFixed(3)));
    // CHARLES LEANS (G280): his back within 5 cm of the front wall's face,
    // on a stretch of deck that has the wall behind it
    if (q.key === 'person_charles') {
      const K = HG.PIER_KIT.person_charles;
      const wallZ = P.w / 2 - P.wallT / 2;
      check(Math.abs((q.z - K.L / 2) - wallZ) < 0.05, name + ': Charles is not against the wall',
            (q.z - K.L / 2).toFixed(3) + ' vs ' + wallZ.toFixed(3));
      check(Math.abs(q.x) < P.L / 2 - 0.3, name + ': Charles leans where there is no wall');
      check(Math.abs(q.ry) < 0.01, name + ': Charles has his back to the view, not the wall');
    }
  }
  // THE LEANING BAGS ONLY AGAINST A CLOSED BASE (G280)
  for (const q of hi.stats.yard || [])
    if (q.key === 'bags_lean')
      check(Math.round(P.stance) <= 1 || Math.round(P.skirt) > 0,
            name + ': leaning bags with nothing to lean on (open base)');

  // 31 — THE SKIRT IS OPEN unless the house is big and two storeys (G257, the
  //   user: "prefer open skirt in almost all cases, but for large multi story
  //   houses"). One predicate, SKIRT_OK, for the sampler and for this.
  if (Math.round(P.skirt) > 0)
    check(HG.SKIRT_OK(P), name + ': a small or single-storey house has closed its skirt',
          P.storeys + ' storey, ' + (P.L * P.w).toFixed(0) + ' m2');

  // 32 — THE HAND IS A DIAL WITH BOUNDS (G261, the user: "let's get more of
  //   this hand crafted, imperfect look ... Fitment should remain great").
  //   Every member the hand touched reports the most any free end moved and
  //   the most any post turned; the generator's own bounds hold (the widest
  //   room it ever gives is a pile's top slipping along the rim, 45 mm), and
  //   at 0 nothing moved at all - a dial that cannot be switched off cannot
  //   be blamed for a bad fit.
  {
    const h = hi.stats.hand;
    check(!!h && h.lean <= 0.046 && h.twist <= HG.HAND_TWIST + 1e-9,
          name + ': the hand went past its bounds',
          h ? h.lean.toFixed(3) + ' m, ' + h.twist.toFixed(1) + ' deg' : 'no report');
    if (h && (P.hand || 0) === 0)
      check(h.lean === 0 && h.twist === 0,
            name + ': hand 0 still moved something');
  }

  // 33 — EVERY HOUSE HAS A FORM OF CHIMNEY (G262, the user: "All houses
  //   should have a form of chimney"). A stove pipe or a masonry stack, on
  //   every closed building - the one exemption is the open-fronted shelter
  //   (the woodshed), which is not a room anybody heats.
  if (!P.openFront && !P.outbuilding)
    check(!!hi.stats.chimney, name + ': no chimney',
          'chim ' + Math.round(P.chim));

  // 34 — THE YARD STANDS WHERE IT SAYS (G273, the user: "use the existing
  //   appropriate objects we have for the hangar here"). Every placed prop is
  //   a key the kit knows; on the ground it is ON the ground (to two
  //   centimetres) and above the tide; on the deck it is at the deck's level
  //   and inside the deck; on a wall it is on a wall's plane. None is inside
  //   the house unless the floor clears it, none on a stair or a stoop, and
  //   no two overlap in plan. `yard` 0 places nothing.
  {
    const Y = hi.stats.yard || [];
    const g2 = hi.stats.ground;
    const half = P.wallT / 2;
    if (!P.yard) check(Y.length === 0, name + ': yard 0 still placed ' + Y.length);
    const D = P.porch && hi.stats.deckArea > 0
      ? { x0: -P.L * P.porchLenF / 2 + P.porchOff * P.L / 2, x1: P.L * P.porchLenF / 2 + P.porchOff * P.L / 2,
          zIn: P.w / 2 - half, zOut: P.w / 2 - half + P.porchD } : null;
    const st = hi.stats.stair, fr = hi.stats.front, bk = hi.stats.stoop;
    const R = k => { const K = HG.YARD_KIT[k]; return K ? Math.max(K.L, K.W) / 2 : 0; };
    for (let i = 0; i < Y.length; i++) {
      const q = Y[i], K = HG.YARD_KIT[q.key];
      if (!check(!!K, name + ': the yard placed an unknown prop', q.key)) continue;
      const gy = g2(q.x, q.z);
      if (q.on === 'ground') {
        check(Math.abs(q.y - gy) < 0.02, name + ': a yard prop is not on the ground',
              q.key + ' ' + q.y.toFixed(2) + ' vs ' + gy.toFixed(2));
        if (P.water) check(gy > P.waterY + 0.1, name + ': a yard prop stands in the tide', q.key);
        const inHouse = Math.abs(q.x) < P.L / 2 + half + R(q.key) * 0.5 &&
                        Math.abs(q.z) < P.w / 2 + half + R(q.key) * 0.5;
        if (inHouse) check(P.floorY - 0.12 > gy + K.H + 0.05,
                           name + ': a yard prop is inside the house', q.key);
        if (D && q.x > D.x0 && q.x < D.x1 && q.z > D.zIn && q.z < D.zOut)
          check(P.floorY - 0.16 > gy + K.H + 0.05, name + ': a yard prop is inside the deck', q.key);
        if (st) check(Math.abs(q.x - st.x) > P.stairW / 2 + R(q.key) * 0.6 ||
                      q.z < Math.min(st.z0, st.z1) - 0.2 || q.z > Math.max(st.z0, st.z1) + 0.2,
                      name + ': a yard prop stands on the stair', q.key);
        for (const sp of [fr, bk]) if (sp)
          check(Math.abs(q.x - sp.x) > sp.w / 2 + R(q.key) * 0.6 ||
                q.z < Math.min(sp.z, sp.z - sp.side * sp.depth) - 0.05 ||
                q.z > Math.max(sp.z, sp.z - sp.side * sp.depth) + 0.05,
                name + ': a yard prop stands on a stoop', q.key);
      } else if (q.on === 'deck') {
        check(!!D && Math.abs(q.y - (hi.stats.floorY - 0.02)) < 0.011,
              name + ': a deck prop is not at deck level', q.key);
        if (D) check(q.x > D.x0 && q.x < D.x1 && q.z > D.zIn && q.z < D.zOut,
                     name + ': a deck prop is off the deck', q.key);
      } else if (q.on === 'wall') {
        const onX = Math.abs(Math.abs(q.x) - (P.L / 2 + half)) < 0.03;
        const onZ = Math.abs(Math.abs(q.z) - (P.w / 2 + half)) < 0.03;
        check(K.wall && (onX || onZ), name + ': a wall prop is not on a wall', q.key);
      } else check(false, name + ': a yard prop stands on nothing known', q.key + ' ' + q.on);
      for (let j = 0; j < i; j++) {
        const o = Y[j];
        if (o.on === 'wall' || q.on === 'wall') continue;
        check(Math.hypot(q.x - o.x, q.z - o.z) >= (R(q.key) + R(o.key)) * 0.6,
              name + ': two yard props overlap', q.key + ' / ' + o.key);
      }
    }
  }

  // 35 — THE WOODPILE IS A PILE (G273): on the ground, out of the house, out
  //   of the tide, with rounds in it (the far mesh has the block); off the
  //   deck's stair; and its rack is the frame's timber. Off, there is none.
  {
    const W = hi.stats.woodpile;
    if (!P.woodpile) check(!W, name + ': woodpile 0 still stacked one');
    else if (W) {
      const g2 = hi.stats.ground;
      const gmin = g2(W.x, W.z);
      check(Math.abs(W.y - gmin) < 0.02, name + ': the woodpile floats');
      check(hi.stats.lod !== 0 || W.logs >= 6, name + ': the woodpile has ' + W.logs + ' rounds');
      const hx = Math.abs(W.ax[0]) * W.len / 2 + Math.abs(W.out[0]) * W.w / 2;
      const hz = Math.abs(W.ax[1]) * W.len / 2 + Math.abs(W.out[1]) * W.w / 2;
      check(Math.abs(W.x) > P.L / 2 + P.wallT / 2 + hx - 0.02 ||
            Math.abs(W.z) > P.w / 2 + P.wallT / 2 + hz - 0.02,
            name + ': the woodpile is inside the house');
      if (P.water) check(gmin > P.waterY + 0.1, name + ': the woodpile is in the tide');
      const st = hi.stats.stair;
      if (st) check(Math.abs(W.x - st.x) > P.stairW / 2 + hx ||
                    W.z - hz > Math.max(st.z0, st.z1) || W.z + hz < Math.min(st.z0, st.z1),
                    name + ': the woodpile is on the stair');
      for (const q of hi.stats.yard || [])
        if (q.on === 'ground')
          check(Math.abs(q.x - W.x) > hx + 0.1 || Math.abs(q.z - W.z) > hz + 0.1,
                name + ': a yard prop is in the woodpile', q.key);
    }
  }

  // 36 — THE GROUND SHADOW SKIRT LIES ON THE GROUND (G281): every vertex of
  //   it a centimetre over the ground under it (it is polygons on the
  //   terrain, and a patch that floats or sinks is a patch that flickers),
  //   its alpha within [0, 1], one patch per thing that stands on the ground
  //   (the occluder list is published), and none at all with the dial off.
  {
    const sk = hi.bags.aoskirt ? hi.bags.aoskirt.data() : null;
    const on = P.aoGround === undefined || P.aoGround;
    if (!on) check(!sk || sk.idx.length === 0, name + ': aoGround 0 still laid a skirt');
    else if (sk) {
      check(sk.idx.length > 0, name + ': no ground skirt under the house');
      const g2 = hi.stats.ground;
      let off = 0, worst = 0, bad = 0;
      for (let i = 0; i < sk.pos.length; i += 3) {
        const d = sk.pos[i + 1] - (g2(sk.pos[i], sk.pos[i + 2]) + 0.012);
        if (Math.abs(d) > 0.02) { off++; worst = Math.max(worst, Math.abs(d)); }
        const a = sk.lit[i / 3];
        if (!(a >= 0 && a <= 1)) bad++;
      }
      check(off === 0, name + ': the ground skirt is not on the ground', off + ' vertices, worst ' + worst.toFixed(3));
      check(bad === 0, name + ': the ground skirt has an alpha out of range');
      check((hi.stats.groundAO || []).length >= 1 + (hi.stats.posts || 0) * 0,
            name + ': the ground skirt occluders were not published');
    }
  }

  // 17 — a back door that opens onto nothing is not a garden door
  // (a back door inside the lean-to's span opens INTO the shed, onto its
  // floor, and gets no stoop by design - rule 23 holds that it has a platform)
  if (P.backDoor && P.backPorch && !hi.stats.backInLean)
    check(!!hi.stats.stoop, name + ': the back door has no stoop');

  // 19 — EVERY ROOF IS CLOSED WITH ITS FINISH (the user: "there are still
  //   significant issues around the borders of the roofs, all types now ...
  //   ensure that all roofs are properly closed with their finish"). Each
  //   roof — main facet, dormer, lean-to, porch — reports the quad it drew and
  //   which of its edges were free; every free edge must have trim within
  //   reach of its midpoint. A roof that forgets its rim now says so here
  //   rather than in a screenshot.
  if (P.fascia > 0.005) {
    const tr = hi.bags.trim.data();
    const near = (px, py, pz, r) => {
      for (let i = 0; i < tr.pos.length; i += 3) {
        const dx = tr.pos[i] - px, dy = tr.pos[i + 1] - py,
              dz = tr.pos[i + 2] - pz;
        if (dx * dx + dy * dy + dz * dz < r * r) return true;
      }
      return false;
    };
    let bare = 0, tested = 0;
    for (const rim of hi.stats.rims || [])
      for (let i = 0; i < 4; i++) {
        if (!rim.free[i]) continue;
        const a = rim.q[i], b = rim.q[(i + 1) % 4];
        const L2 = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        if (L2 < 0.05) continue;
        tested++;
        // AT THE ENDS, not at the middle: a rim is one long quad and its
        // vertices are at the polyline's corners, so the midpoint of a 7 m
        // eave is 3.5 m from the nearest of them. Both ends carrying trim is
        // what says the board was laid along that edge.
        if (!near(a[0], a[1], a[2], 0.30) || !near(b[0], b[1], b[2], 0.30))
          bare++;
      }
    check(bare === 0, name + ': a free roof edge has no finish on it',
          bare + ' of ' + tested + ' edges');
    check(tested > 2, name + ': no roof edge was finished at all',
          String(tested));
  }

  // determinism: the same numbers twice
  const again = HG.build(P, 0);
  check(again.stats.tris === hi.stats.tris,
        name + ': the build is not deterministic',
        hi.stats.tris + ' then ' + again.stats.tris);

  return { name, hi: mh.tris, lo: ml.tris, ratio,
           ridge: hi.stats.ridgeY, drop: hi.stats.dropped,
           posts: hi.stats.posts, sil: worst };
}
for (const name of Object.keys(HG.PRESETS))
  rows.push(battery(name, Object.assign({}, HG.DEF, HG.PRESETS[name])));

// 18 — THE PRESETS COVER THE SPACE (the user: "in the presets, you don't use
//   saltbox much. Ensure you have a wide variety, covering most of our
//   options"). A generator whose shipped examples exercise a third of its own
//   parameters is a generator nobody will find the rest of. Every value of
//   every SHAPE-BEARING option has to appear in at least one preset, and the
//   gate names the ones that do not.
{
  const all = Object.keys(HG.PRESETS)
    .map(n => Object.assign({}, HG.DEF, HG.PRESETS[n]));
  const has = (label, fn) =>
    check(all.some(fn), 'preset coverage: nothing uses ' + label);
  for (let f = 0; f <= 3; f++)
    has('roof family ' + HG.FAMS[f], P => Math.round(P.roofFam) === f);
  has('a hipped roof', P => !!P.hip);
  for (let st = 0; st <= 4; st++)
    has('stance ' + HG.STANCES[st], P => Math.round(P.stance) === st);
  has('standing in water', P => !!P.water);
  has('a lean-to', P => !!P.lean);
  has('a cupola', P => !!P.cupola);
  has('shed dormers', P => P.dormers > 0 && Math.round(P.dormKind) === 0);
  has('gable dormers', P => P.dormers > 0 && Math.round(P.dormKind) === 1);
  has('an open front', P => !!P.openFront);
  has('stacked cordwood', P => !!P.firewood);
  has('a back door', P => !!P.backDoor);
  for (let r = 0; r <= 2; r++)
    has('porch roof ' + r, P => !!P.porch && Math.round(P.porchRoof) === r);
  for (let k = 0; k <= 3; k++)
    has('skirt ' + k, P => Math.round(P.skirt) === k && P.stance >= 1 &&
                           P.stance <= 3);
  for (let r = 1; r <= 3; r++)
    has('rail style ' + r, P => !!P.porch && Math.round(P.railStyle) === r);
  has('a masonry chimney', P => Math.round(P.chim) === 2);
  has('a fresh finish', P => P.weather < 0.3);
  has('a weathered finish', P => P.weather > 0.6);
  has('a bark pile', P => HG.ROLE_SETS.post[Math.round(P.postSet)] === 'bark');
}

// THE ROOF EXTRAS AND THE STANCES (G231). Every dormer kind on every roof
// family at three pitches, the belfry on four of them, the piles standing in
// water on a steep beach, and the shed that is not a house. These are the
// combinations where a dormer runs past the ridge, a cupola hangs off the
// slope, or an open side leaves the roof carried by nothing.
for (let fam = 0; fam <= 3; fam++)
  for (const pitch of [10, 26, 44])
    for (const kind of [0, 1]) {
      const P = Object.assign({}, HG.DEF, {
        roofFam: fam, pitch: pitch, storeys: 2, dormers: 2, dormKind: kind,
        dormSide: 2, dormW: 1.8, dormH: 1.4, cupola: 1, cupCross: 1,
        gutter: 1, downpipe: 1,
      });
      const tag = 'extras fam' + fam + ' p' + pitch +
                  (kind ? ' gable-dormer' : ' shed-dormer');
      const b = HG.build(P, 0);
      runRules(tag, measure(b));
      const lo = measure(HG.build(P, 1));
      check(lo.tris < b.stats.tris * 0.35, tag + ': lod 1 out of budget',
            lo.tris + ' vs ' + b.stats.tris);
      // a dormer that had to be shortened says so rather than folding the roof
      // either it built them, or it said out loud that the roof cannot carry
      // one — never silently nothing
      check(b.stats.dormers > 0 || b.stats.dormSkipped > 0,
            tag + ': the dormers vanished without a word');
      // 15 — A DORMER EXISTS FOR ITS WINDOW. A blind box on a roof is not a
      //   dormer, and the user found three of them; the generator refuses the
      //   dormer instead of building one that cannot be glazed.
      check(b.stats.dormerWindows === b.stats.dormers,
            tag + ': a dormer was built with no window',
            b.stats.dormerWindows + ' of ' + b.stats.dormers);
      const cup = b.stats.cupola;
      check(!!cup && cup.top > b.stats.ridgeY,
            tag + ': the belfry does not stand above the ridge');
    }

// OVER THE WATER, and on skids: the two stances G231 added.
for (const slope of [8, 18])
  for (const st of [2, 3, 4]) {
    const P = Object.assign({}, HG.DEF, {
      stance: st, slopeZ: slope, water: 1, waterY: -0.25, floorY: 2.0,
      pileBent: 1, brace: 1, openFront: st === 4 ? 1 : 0,
      firewood: st === 4 ? 1 : 0,
      backDoor: 1, backPorch: 1, porch: 1, stairs: 1, porchD: 2.0,
    });
    const tag = 'stance ' + HG.STANCES[st] + ' s' + slope;
    const b = HG.build(P, 0);
    runRules(tag, measure(b));
    if (st === 3)
      check(b.stats.inWater > 0, tag + ': nothing is standing in the water');
    if (st === 4) {
      check(b.stats.posts === 0, tag + ': skids do not have posts',
            String(b.stats.posts));
      check(b.stats.firewood > 20, tag + ': the woodshed is empty',
            String(b.stats.firewood));
    }
    const lo = measure(HG.build(P, 1));
    check(lo.tris < b.stats.tris * 0.40, tag + ': lod 1 out of budget',
          lo.tris + ' vs ' + b.stats.tris);
  }

// THE SWEEP. Presets prove the four photographs; the sweep proves the SPACE —
// every roof family at both extremes of pitch, on a steep site, with the
// windows deliberately too tall for the gable. This is where "a wall through
// its roof" actually appears.
for (let fam = 0; fam <= 3; fam++)
  for (const pitch of [6, 26, 50])
    for (const hip of (fam === 0 ? [0, 1] : [0]))
      for (const slope of [0, 14]) {
        const P = Object.assign({}, HG.DEF, {
          roofFam: fam, pitch: pitch, hip: hip, slopeZ: slope,
          winH: 1.9, storeys: fam === 3 ? 1 : 2, lean: 1, porchRoof: 2,
          gableWin: 1, chim: fam % 2 ? 2 : 1,
        });
        const tag = 'sweep fam' + fam + ' p' + pitch + (hip ? ' hip' : '') +
                    ' s' + slope;
        const b = HG.build(P, 0);
        runRules(tag, measure(b));
        for (const o of b.stats.openings || [])
          check(o.y1 <= Math.min(o.underA, o.underB) + 1e-6,
                tag + ': a kept opening breaks the roof line');
        const lo = measure(HG.build(P, 1));
        check(lo.tris > 20 && lo.tris < b.stats.tris * 0.35,
              tag + ': lod 1 out of budget',
              lo.tris + ' vs ' + b.stats.tris);
      }

// THE RANDOM HOUSE, AS A FUZZER. `randomHouse` samples the decisions a builder
// makes rather than the sliders, which makes it the cheapest coverage in this
// gate: forty seeds walk combinations no preset has (a gambrel on piles in the
// water with a lean-to and a belfry) and every rule above runs on each. A seed
// that goes red is also a REPRODUCTION — `randomHouse(seed)` on the bench
// rebuilds it exactly.
for (let seed = 1; seed <= 40; seed++)
  battery('random seed ' + seed, HG.randomHouse(seed));

// ---------------------------------------------------------------------------
// THE SHED (G232): the second generator, held to the same rules
// ---------------------------------------------------------------------------
// It shares the kit, the material library and the LOD contract, so it shares
// the battery — clean geometry, honest UVs, nothing buried, a far mesh that is
// cheaper and the same shape. What it does NOT share is the wall shell and the
// roof planes: a shed is a pile of members, so those two rules stand down (and
// `measure` says so by looking for the roof model rather than by being told).
if (check(!!SG, 'the shed generator did not load headlessly')) {
  for (const name of Object.keys(SG.PRESETS)) {
    const P = Object.assign({}, SG.DEF, SG.PRESETS[name]);
    const hi = SG.build(P, 0), lo = SG.build(P, 1);
    const mh = measure(hi), ml = measure(lo);
    runRules('shed ' + name + ' hi', mh);
    runRules('shed ' + name + ' lo', ml);
    check(hi.stats.members > 12, 'shed ' + name + ': too few members',
          String(hi.stats.members));
    check(hi.stats.boards > 20, 'shed ' + name + ': too few boards',
          String(hi.stats.boards));
    check(ml.tris < Math.max(300, mh.tris * 0.34),
          'shed ' + name + ': lod 1 out of budget',
          ml.tris + ' vs ' + mh.tris);
    let worst = 0;
    for (const k of ['x0', 'y0', 'z0', 'x1', 'y1', 'z1'])
      worst = Math.max(worst, Math.abs(mh.bbox[k] - ml.bbox[k]));
    check(worst < 0.45, 'shed ' + name + ': the two meshes differ in outline',
          worst.toFixed(3) + ' m');
    const again = SG.build(P, 0);
    check(again.stats.tris === hi.stats.tris,
          'shed ' + name + ': the build is not deterministic');
  }
  // and the same fuzz: twenty sheds nobody designed
  for (let seed = 1; seed <= 20; seed++) {
    const P = SG.randomShed(seed);
    const b = SG.build(P, 0);
    runRules('shed seed ' + seed, measure(b));
    const lo = measure(SG.build(P, 1));
    check(lo.tris < Math.max(300, b.stats.tris * 0.36),
          'shed seed ' + seed + ': lod 1 out of budget',
          lo.tris + ' vs ' + b.stats.tris);
  }
  // SHAKE 0 IS SQUARE JOINERY: the jitter must be a dial, not a constant
  const still = SG.build(Object.assign({}, SG.DEF, { shake: 0 }), 0);
  const shaky = SG.build(Object.assign({}, SG.DEF, { shake: 1.2 }), 0);
  let moved = 0;
  {
    const a = still.bags.siding.data().pos, b2 = shaky.bags.siding.data().pos;
    const n = Math.min(a.length, b2.length);
    for (let i = 0; i < n; i++) if (Math.abs(a[i] - b2[i]) > 0.004) moved++;
  }
  check(moved > 40, 'the shed does not actually shake', moved + ' vertices');
}

// ---------------------------------------------------------------------------
// NEGATIVE VERIFICATION
// ---------------------------------------------------------------------------
if (SELFTEST) {
  const base = measure(HG.build(Object.assign({}, HG.DEF), 0));
  const doctor = (mut, ruleIdx) => {
    const m = JSON.parse(JSON.stringify(base));
    mut(m);
    return !RULES[ruleIdx][1](m);
  };
  const neg = [];
  if (!doctor(m => { m.nan = 3; }, 0)) neg.push('the NaN rule cannot fail');
  if (!doctor(m => { m.degen = 1; }, 1)) neg.push('the degenerate rule cannot fail');
  if (!doctor(m => { m.badUV = 1; }, 2)) neg.push('the UV rule cannot fail');
  if (!doctor(m => { m.above = 1; m.aboveWorst = 0.4; }, 4))
    neg.push('the wall-through-roof rule cannot fail');
  if (!doctor(m => { m.wildUV = 1; }, 3))
    neg.push('the wild-UV rule cannot fail');
  if (!doctor(m => { m.buried = 1; m.buriedWorst = 2; }, 5))
    neg.push('the buried rule cannot fail');
  if (!doctor(m => { m.stretch = 3; m.stretchWorst = 0.02;
                     m.stretchWhere = ['siding']; }, 6))
    neg.push('the stretched-UV rule cannot fail');
  if (!doctor(m => { m.corner = 2; }, 7))
    neg.push('the open-corner rule cannot fail');
  if (!doctor(m => { m.aoMissing = 4; }, 8))
    neg.push('the missing-occlusion rule cannot fail');
  if (!doctor(m => { m.aoSum = m.aoN; }, 9))
    neg.push('the flat-bake rule cannot fail');
  if (!doctor(m => { m.aoMin = m.aoSum / m.aoN; }, 10))
    neg.push('the somewhere-dark rule cannot fail');
  // A DORMER MUST NOT RUN PAST THE RIDGE. At a shallow pitch its own roof
  // crosses the main one beyond the ridge, and the generator must shorten the
  // dormer rather than fold the roof back over itself — the count says so.
  const flat = HG.build(Object.assign({}, HG.DEF, {
    pitch: 9, dormers: 2, dormH: 2.0, dormKind: 0, storeys: 2 }), 0);
  if (!(flat.stats.dormClamped + flat.stats.dormSkipped > 0))
    neg.push('an impossible dormer was neither clamped nor refused');
  if (flat.stats.dormers > 0 && flat.stats.dormClamped === 0)
    neg.push('a dormer was built on a roof that cannot carry it');
  // and the case that must CLAMP rather than refuse: room for a small one
  const tall = HG.build(Object.assign({}, HG.DEF, {
    pitch: 30, dormers: 2, dormH: 2.2, dormKind: 0, storeys: 2 }), 0);
  if (!(tall.stats.dormClamped > 0))
    neg.push('a too-tall dormer was not shortened to fit');
  // and with no door there must be no leaf: the rule reads geometry, not a flag
  const noDoor = HG.build(Object.assign({}, HG.DEF, { door: 0 }), 0);
  if ((noDoor.stats.openings || []).some(o => o.kind === 'door'))
    neg.push('a door appeared with the door switched off');

  // and the two live ones, driven by real geometry rather than a doctored
  // number: a roof pitched flat under a two-storey gable window MUST make the
  // generator drop openings rather than cut them through the roof
  const tight = HG.build(Object.assign({}, HG.DEF, {
    storeys: 2, pitch: 5, winH: 2.2, gableWin: 1, nLeft: 3, nRight: 3 }), 0);
  if (!(tight.stats.dropped > 0))
    neg.push('an impossible window was not dropped');
  for (const o of tight.stats.openings || [])
    if (o.y1 > Math.min(o.underA, o.underB) + 1e-6)
      neg.push('a dropped-window build still kept one through the roof');
  // A DOOR WITH NO DECK UNDER IT (G236). The rule is only worth having if a
  // build reaches it, and this is the build that used to fail it: a house with
  // its porch switched off and its floor two metres up. It must now grow a
  // stoop and a flight of its own.
  const noPorch = HG.build(Object.assign({}, HG.DEF, {
    porch: 0, door: 1, floorY: 2.0, stance: 2 }), 0);
  const dr0 = (noPorch.stats.doors || [])[0];
  if (!dr0) neg.push('a house with a door published no door report');
  else if (dr0.platform === null)
    neg.push('a door with no porch got no stoop');
  if (!noPorch.stats.front) neg.push('the front stoop was not built');

  // THE LIGHTS (G253): on one switch every window glows and the lamp is
  // there; off, nothing on the house glows at all. Two builds of the same
  // house, and the only thing between them is the switch.
  const onH = HG.build(Object.assign({}, HG.DEF, { lights: 1, winLink: 1 }), 0);
  const offH = HG.build(Object.assign({}, HG.DEF, { lights: 0 }), 0);
  const gl = onH.bags.glass.data().lit.filter(v => v > 0.5).length;
  if (!(onH.stats.lit.panes > 0 && onH.stats.lit.windows === onH.stats.lit.panes))
    neg.push('one switch did not light every window');
  if (!(gl > 0)) neg.push('lit windows put no glow on the glass');
  if (!(onH.stats.lit.lights.length === 1)) neg.push('the door lamp did not appear');
  if (!(onH.stats.lit.bulbs > 20)) neg.push('the stair rail got ' + onH.stats.lit.bulbs + ' bulbs');
  if (offH.bags.glass.data().lit.some(v => v > 0.5) || offH.stats.lit.lights.length)
    neg.push('the house glows with the lights off');

  // THE PIER (G252): a house on the water whose stair lands on a jetty grows
  // a pier; the same house with the pier switched off grows none; and the
  // plan is the same plan twice, because the bench and the game will both
  // build from it.
  const wetH = HG.build(Object.assign({}, HG.DEF, {
    stance: 3, floorY: 2.2, water: 1, waterY: -0.6, slopeZ: 12, porch: 1,
    stairs: 1, pier: 1, pierLen: 3, boats: 2, pierKind: 1, pierBranch: 1 }), 0);
  if (!wetH.stats.jetty) neg.push('the pier selftest house has no jetty');
  else if (!wetH.stats.pier) neg.push('a jettied house grew no pier');
  else {
    if (!(wetH.stats.pier.modules.length >= 4))
      neg.push('a three-run pier came out with ' + wetH.stats.pier.modules.length + ' modules');
    // THE KINDS (G277): a fixed pier's head is a level BELOW its jetty (it
    // came down to the water); a floating pier's head is at the jetty's
    // level; a T is two fingers; and the doorway is over the first module
    const hd = wetH.stats.pier.modules.filter(m => m.key === 'pier_head' && m.chain === 0)[0];
    if (!(hd && hd.hIn < wetH.stats.jetty.y - 1.2))
      neg.push('a fixed pier did not come down to the water');
    const flo = HG.build(Object.assign({}, HG.DEF, {
      stance: 3, floorY: 2.2, water: 1, waterY: -0.6, slopeZ: 12, porch: 1,
      stairs: 1, pier: 1, pierLen: 3, boats: 0, pierKind: 0, pierBranch: 2 }), 0).stats.pier;
    const hd2 = flo.modules.filter(m => m.key === 'pier_head' && m.chain === 0)[0];
    if (!(hd2 && Math.abs(hd2.hIn - flo.y) < 0.1))
      neg.push('a floating pier changed level');
    if (!(flo.modules.some(m => m.chain === 1) && flo.modules.some(m => m.chain === 2)))
      neg.push('a T was asked for and two fingers did not grow');
    const door = wetH.stats.pier.modules.find(m => m.over);
    if (!(door && door.z < wetH.stats.pier.modules.filter(m => !m.over)[0].z1))
      neg.push('the doorway is not at the house end');
    const again = HG.build(Object.assign({}, HG.DEF, {
      stance: 3, floorY: 2.2, water: 1, waterY: -0.6, slopeZ: 12, porch: 1,
      stairs: 1, pier: 1, pierLen: 3, boats: 2, pierKind: 1, pierBranch: 1 }), 0);
    if (JSON.stringify(again.stats.pier) !== JSON.stringify(wetH.stats.pier))
      neg.push('the pier plan is not deterministic');
  }
  const dryH = HG.build(Object.assign({}, HG.DEF, {
    stance: 3, floorY: 2.2, water: 1, waterY: -0.6, slopeZ: 12, pier: 0 }), 0);
  if (dryH.stats.pier) neg.push('a pier grew with the pier switched off');

  // A STAIR THAT HAS TO TURN (G234). The rule is only worth having if some
  // build actually reaches it, so this is the build that does: three metres of
  // floor over a fourteen-degree beach is twenty-odd treads, and the flight
  // has to break and turn. Both halves are checked here — that it turned, and
  // that after turning it still lands exactly on the ground it solved for,
  // which is the arithmetic a bend is most likely to break.
  const steep = HG.build(Object.assign({}, HG.DEF, {
    stance: 3, floorY: 3.0, slopeZ: 14, porch: 1, stairs: 1 }), 0);
  const sst = steep.stats.stair;
  if (!sst || !(sst.n > HG.STAIR_MAX))
    neg.push('no build reaches the long-stair rule');
  else {
    if (!(sst.turns > 0)) neg.push('a long stair was built with no landing');
    if (Math.abs((sst.y1 - sst.n * sst.rise) - sst.y0) > 0.06)
      neg.push('a turned stair does not reach its own foot');
  }
  // THE HAND (G261): at 1 the rails, posts and treads are visibly off true
  // and the report says so; at 0 the same house is a machine's work; and the
  // dial is deterministic, or the gate could never hold it.
  const h1 = HG.build(Object.assign({}, HG.DEF, { hand: 1, railStyle: 1 }), 0).stats.hand;
  const h0 = HG.build(Object.assign({}, HG.DEF, { hand: 0, railStyle: 1 }), 0).stats.hand;
  if (!(h1 && h1.members > 8)) neg.push('the hand touched ' + (h1 ? h1.members : 0) + ' members');
  if (!(h1 && h1.lean > 0.008 && h1.twist > 3))
    neg.push('hand 1 barely moved anything (' + (h1 ? h1.lean.toFixed(3) + ' m, ' + h1.twist.toFixed(1) + ' deg' : 'none') + ')');
  if (!(h0 && h0.lean === 0 && h0.twist === 0)) neg.push('hand 0 still moved something');
  if (JSON.stringify(HG.build(Object.assign({}, HG.DEF, { hand: 1, railStyle: 1 }), 0).stats.hand) !== JSON.stringify(h1))
    neg.push('the hand is not deterministic');
  // THE CHIMNEY (G262): the rule reads the build, not the dial - a house with
  // the chimney dialled off publishes none, so the rule can go red
  if (HG.build(Object.assign({}, HG.DEF, { chim: 0 }), 0).stats.chimney)
    neg.push('a house with no chimney published one');
  for (const nm in HG.PRESETS)
    if (!HG.PRESETS[nm].openFront && !HG.PRESETS[nm].outbuilding && Math.round(HG.PRESETS[nm].chim === undefined ? HG.DEF.chim : HG.PRESETS[nm].chim) === 0)
      neg.push('preset ' + nm + ' has no chimney');
  // THE YARD (G273): the default house grows props and a woodpile with
  // rounds in it; with the dials off it grows neither; the same seed twice is
  // the same yard; and the lamp by the door is the baked fixture, published
  // with its prop and its mount.
  const yd = HG.build(Object.assign({}, HG.DEF, { yard: 1, yardK: 1, woodpile: 1 }), 0);
  if (!(yd.stats.yard.length >= 3)) neg.push('the yard placed only ' + yd.stats.yard.length + ' props');
  if (!(yd.stats.woodpile && yd.stats.woodpile.logs > 20)) neg.push('the woodpile is thin');
  if (!(yd.bags.logend.tris > 40 && yd.bags.log.tris > 100)) neg.push('the rounds went into the wrong bags');
  const yd0 = HG.build(Object.assign({}, HG.DEF, { yard: 0, woodpile: 0 }), 0);
  if (yd0.stats.yard.length || yd0.stats.woodpile) neg.push('yard 0 still placed things');
  if (JSON.stringify(HG.build(Object.assign({}, HG.DEF, { yard: 1, yardK: 1, woodpile: 1 }), 0).stats.yard) !==
      JSON.stringify(yd.stats.yard)) neg.push('the yard is not deterministic');
  const lampP = HG.build(Object.assign({}, HG.DEF, { lights: 1, lampKind: 1 }), 0).stats.lit.lights[0];
  if (!(lampP && lampP.prop === 'lamp_wall' && lampP.mx !== undefined)) neg.push('the wall lamp did not mount');
  const lampD = HG.build(Object.assign({}, HG.DEF, { lights: 1, lampKind: 0 }), 0).stats.lit.lights[0];
  if (!(lampD && !lampD.prop)) neg.push('the drawn lantern is gone');
  if (!(yd.stats.path && yd.stats.path.length >= 1)) neg.push('no path from the stair');
  // THE PEOPLE (G280): over the seeds the deck's figure and the pier's each
  // take both names, and Charles turns up against the wall
  {
    const seen = {};
    for (let sd = 1; sd <= 12; sd++) {
      const b = HG.build(Object.assign({}, HG.DEF, { yardSeed: sd, lightSeed: sd * 3, stance: 3, floorY: 2.2,
        water: 1, waterY: -0.6, slopeZ: 12, porch: 1, stairs: 1, pier: 1, pierLen: 3, boats: 0 }), 0);
      for (const q of b.stats.people) seen[q.key] = (seen[q.key] || 0) + 1;
    }
    for (const k of ['person_andrew', 'person_koky', 'person_john', 'person_luke', 'person_charles'])
      if (!seen[k]) neg.push('nobody was ever ' + k);
  }
  // THE SKIRT (G281): the default house lays patches under its posts and
  // its footprint; with the dial off it lays none
  {
    const a = HG.build(Object.assign({}, HG.DEF, { aoGround: 1 }), 0);
    const b = HG.build(Object.assign({}, HG.DEF, { aoGround: 0 }), 0);
    if (!(a.bags.aoskirt.tris > 40)) neg.push('the ground skirt is thin: ' + a.bags.aoskirt.tris);
    if (b.bags.aoskirt.tris !== 0) neg.push('aoGround 0 still laid a skirt');
    if (!(a.stats.groundAO.length > 4)) neg.push('too few occluders published');
  }
  // lod 1 must be a construction: switching it off must actually remove work
  const a0 = HG.build(HG.DEF, 0).stats.tris, a1 = HG.build(HG.DEF, 1).stats.tris;
  if (!(a1 < a0 * 0.3)) neg.push('lod 1 is not cheaper by construction');
  for (const n of neg) fail.push('SELFTEST: ' + n);
  console.log('selftest: ' + (neg.length ? neg.length + ' holes' :
              'every rule proven able to go red'));
}

// ---------------------------------------------------------------------------
if (TABLE || process.env.HOUSE_TABLE) {
  console.log('  preset            hi tris   lo tris  ratio  ridge  posts  ' +
              'dropped  silhouette');
  for (const r of rows)
    console.log('  ' + r.name.padEnd(16) + String(r.hi).padStart(8) +
                String(r.lo).padStart(10) + r.ratio.toFixed(3).padStart(7) +
                r.ridge.toFixed(2).padStart(7) + String(r.posts).padStart(7) +
                String(r.drop).padStart(9) + r.sil.toFixed(3).padStart(12));
}

// THE BIG BUILDINGS (G312): the third generator, held to what a building
// must do - every preset builds in both LODs with finite geometry, the low
// mesh is the same outline for a fraction of the triangles, the walls stay
// inside the footprint plus the overhangs, the sign slot is published where
// the sign was drawn, a roller door that is rolled up leaves its opening
// open (no leaf below the rolled edge), and every material slot is dressed
// (rule 14's reading, the flat cloth and glass excepted).
if (check(!!BG, 'the big generator did not load headlessly')) {
  for (const name of Object.keys(BG.PRESETS)) {
    const P = Object.assign({}, BG.DEF, BG.PRESETS[name]);
    let hi = null, lo = null, threw = null;
    try { hi = BG.build(P, 0); lo = BG.build(P, 1); } catch (e) { threw = e; }
    if (!check(!threw, 'big ' + name + ': build threw', threw && threw.message)) continue;
    let nan = 0, x1 = -1e9, z1 = -1e9, y1 = -1e9, y0 = 1e9;
    for (const k of BG.BAGS) {
      const d = hi.bags[k].data();
      for (let i = 0; i < d.pos.length; i += 3) {
        if (!isFinite(d.pos[i]) || !isFinite(d.pos[i + 1]) || !isFinite(d.pos[i + 2])) { nan++; continue; }
        x1 = Math.max(x1, Math.abs(d.pos[i])); z1 = Math.max(z1, Math.abs(d.pos[i + 2]));
        y1 = Math.max(y1, d.pos[i + 1]); y0 = Math.min(y0, d.pos[i + 1]);
      }
    }
    check(nan === 0, 'big ' + name + ': NaN in the mesh', String(nan));
    check(hi.stats.tris > 400, 'big ' + name + ': too few triangles', String(hi.stats.tris));
    check(lo.stats.tris < hi.stats.tris * 0.7, 'big ' + name + ': the low mesh is not lower', lo.stats.tris + ' vs ' + hi.stats.tris);
    // the reach: the length plus the rake, the width plus the eave, the dock, the canopy, the awning, the sign
    const reachX = P.L / 2 + Math.max(P.rakeOver, 0.35) + 0.6;
    const reachZ = P.w / 2 + Math.max(P.eaveOver, 0.2) + (P.dock ? P.dockD + 1.5 : 0) + (P.canopy ? P.canopyOut + 2.2 : 0) + (P.awning ? 1.5 : 0) + (P.gantry && !P.dock ? 1.8 : 0) + 0.8;
    check(x1 <= reachX + 1e-3 && z1 <= reachZ + 1e-3, 'big ' + name + ': something stands past the reach of the building', x1.toFixed(2) + '/' + reachX.toFixed(2) + ' ' + z1.toFixed(2) + '/' + reachZ.toFixed(2));
    check(y1 > hi.stats.ridge && y0 < P.floorY, 'big ' + name + ': the mesh does not span plinth to stack');
    if (P.sign) { const sg = hi.stats.sign;
      check(sg && sg.w > 0.5 && sg.y > P.floorY + 1.5 && (sg.nz ? Math.abs(sg.x) < P.L / 2 : Math.abs(sg.z) < P.w / 2),
            'big ' + name + ': the sign slot is not on the building'); }
    if (P.rollers > 0) {
      check(hi.stats.rollers.length === Math.round(P.rollers), 'big ' + name + ': the roller doors are not all there');
      // the door bag holds no leaf below the rolled edge of a door that is up
      const d = hi.bags.door.data();
      for (const r of hi.stats.rollers) if (r.open > 0.2) {
        const edge = P.floorY + r.open * r.h - 0.02;
        let below = 0;
        for (let i = 0; i < d.pos.length; i += 3)
          if (Math.abs(d.pos[i] - r.x) < r.w / 2 - 0.2 && d.pos[i + 1] < edge && d.pos[i + 1] > P.floorY + 0.05 && Math.abs(d.pos[i + 2] - P.w / 2) < 0.2) below++;
        check(below === 0, 'big ' + name + ': a rolled-up door still hangs in its opening', String(below));
      }
    }
    // same build twice: the same mesh
    const again = BG.build(P, 0);
    check(again.stats.tris === hi.stats.tris, 'big ' + name + ': the build is not deterministic');
  }
  // the finish: every slot dressed with the stubbed libraries in place -
  // the house's (rule 14 left it on the context) and the hangar's, stubbed
  // the same way for every key the roles name
  {
    const img = { complete: true, naturalWidth: 4, addEventListener: () => {} };
    const hw = {};
    for (const role in BG.ROLE_SETS) for (const [lib, key] of BG.ROLE_SETS[role])
      if (lib === 'hangar') hw[key] = { name: key, diff: img, nor: img, rough: img };
    VMCTX.HANGAR_WALL_SETS = hw;
    const fake = {};
    for (const k in LIB) fake[k] = Object.assign({}, LIB[k], { diff: img, nor: img, rough: img, paint: LIB[k].paint ? img : null });
    VMCTX.HOUSE_TEX_SETS = fake;
    let threw = null;
    try { BG.applyFinish(Object.assign({}, BG.DEF)); } catch (e) { threw = e; }
    check(!threw, 'big: applyFinish throws with the payloads', threw && threw.message);
    for (const r of BG.finishReport())
      check(r.full, 'big PBR: ' + r.slot + ' is missing a map', 'albedo ' + r.map + ', normal ' + r.nor + ', roughness ' + r.rough);
    delete VMCTX.HOUSE_TEX_SETS; delete VMCTX.HANGAR_WALL_SETS;
  }
}

if (fail.length) {
  for (const f of fail.slice(0, 24)) console.log('  ! ' + f);
  if (fail.length > 24) console.log('  ... ' + (fail.length - 24) + ' more');
  console.log('GATE HOUSE: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('GATE HOUSE: PASS');
