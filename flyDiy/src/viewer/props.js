// ============================================================
// THE PROP LIBRARY — one factory that turns any baked prop into a three.js
// group, and ONE material recipe that every prop in the batch lands on.
//
// The payloads are built by tools/prop_prep.py from the declared table in
// tools/props_table.py and decoded by src/core/51_prop_codec.js; this file is
// the only place that knows about three.js. The asset editor (propMesh) and
// the hangar (propPlace) both come through here, so a prop looks the same
// wherever it is shown.
//
// THE ONE MATERIAL. Every prop, from a 132-triangle table to a 79 000-triangle
// compressor, is a MeshStandardMaterial with the same three maps:
//     map           sRGB   base colour (with alpha where the author used it)
//     arm           linear R = ambient occlusion, G = roughness, B = metalness
//     normalMap     linear tangent-space, OpenGL convention
// ONE image serves aoMap, roughnessMap and metalnessMap, which is why the
// baker packs them that way: three samplers, one upload, one cache entry. A
// channel the baker found constant is not in the image at all — it arrived as
// a scalar on the material and the map is simply absent, and the same recipe
// still reads correctly with any of the three missing.
//
// r128 notes, same as hangar.js: colour space is `encoding`, not `colorSpace`,
// and there is no scene.environmentIntensity — each material carries its own
// envMapIntensity so the hangar's moods can scale it (installPropMoods).
// ============================================================

// aoMap reads the SECOND uv set, always — named `uv2` up to r150 and `uv1`
// since r151 (W0.5a). A prop whose geometry has only `uv` gets an ao map that
// samples an attribute that is not there — which is not an error, just a prop
// that renders black. So the second set is aliased onto uv at build time,
// once, here.
// see the note in app.js: whatever the card allows, not a remembered number
const PROP_ANISO = () =>
  (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;

const PROP_TEX_CACHE = new Map();       // tex id -> THREE.Texture (srgb variant)
const PROP_TEX_CACHE_LIN = new Map();   // tex id -> THREE.Texture (linear)
const PROP_BUILT = new Map();           // prop key -> { group, geos, mats }

// THE KTX2 TWIN (AS3, G917). `kind` is the slot's (color: map / emissiveMap, data: the arm map, normal): where
// src/viewer/ktx2_twins.js has a twin for (this map, this kind) and the page can take it (KTX2.off(family) is null),
// the twin is fetched and TRANSCODED in the workers (src/viewer/ktx2.js) - no Image, no decode, no RGBA upload, no
// mips made on the main thread, a quarter of the GPU memory - and the texture handed out now is UPGRADED IN PLACE when
// it lands: the same object every material already holds becomes a compressed texture (isCompressedTexture, its
// mipmaps, the target format; flipY is moot - the twin's rows are the map's rows, top first, as flipY = false reads
// them). Until then it has no image and three binds nothing for it, as before an Image decodes. A twin that fails
// (the fetch, the transcode) loads the map itself into the same texture: the old path, late. The loading screen waits
// for either (BOOT's 'propTex'). userData.mean: the map's mean colour from the table (scenery_life's far boxes read
// it where they drew the image into a canvas).
function propTexture(THREE, id, srgb, kind) {
  const cache = srgb ? PROP_TEX_CACHE : PROP_TEX_CACHE_LIN;
  const ck = kind ? id + '|' + kind : id;
  let t = cache.get(ck);
  if (t) return t;
  const uri = PROP_REG.texs[id];
  if (!uri) return null;
  // G903: a FLAT map ships as its constant [r, g, b] - the shared 1x1 (src/viewer/assets.js TEX_FLAT); no twin
  if (Array.isArray(uri)) { t = TEX_FLAT(uri, srgb ? THREE.SRGBColorSpace : ''); cache.set(ck, t); return t; }
  t = new THREE.Texture();
  t.anisotropy = PROP_ANISO();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;   // industrial_storage_cart wraps u to 2
  t.flipY = false;                            // glTF uv origin is top-left
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(ck, t);
  const B = typeof window !== 'undefined' ? window.BOOT : null;
  const image = () => {
    const img = new Image();
    t.image = img;
    const ok = () => { t.needsUpdate = true; };
    if (B) B.img(img, 'propTex');   // the loading screen waits for it
    if (img.complete && img.naturalWidth) ok();
    else img.addEventListener('load', ok, { once: true });
    img.src = uri;
  };
  const twin = (typeof KTX2_TWINS === 'function' && typeof KTX2 !== 'undefined' && typeof ASSET_FETCH === 'function') ? KTX2_TWINS(uri, kind || (srgb ? 'color' : 'data')) : null;
  if (!twin || KTX2.off(twin.fam)) { image(); return t; }
  if (twin.mean) t.userData.mean = twin.mean;
  if (B && B.expect) B.expect('propTex', 1);
  KTX2.load(twin.url, twin.fam).then(r => {
    t.isCompressedTexture = true;
    t.mipmaps = r.mipmaps; t.image = { width: r.width, height: r.height };
    t.format = r.format; t.type = r.type;
    t.generateMipmaps = false;
    t.minFilter = r.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.userData.ktx2 = twin.url;
    t.needsUpdate = true;
    if (B && B.landed) B.landed('propTex', true);
  }, () => { if (typeof KTX2 !== 'undefined' && KTX2._stats) KTX2._stats.fallbacks++; image(); if (B && B.landed) B.landed('propTex', true); });
  return t;
}

// The factory. `rec` is the flat material record the baker wrote; nothing here
// branches on which asset it came from.
// ONE MATERIAL PER RECORD (AS4a, G920): the material is MATLIB's, shared by every
// part, prop, level of detail and animal whose record is the same (the same maps,
// the same values) - the registry's 832 part materials are 275 records (GATE
// MATLIB), mostly because a prop's cut levels wear the full prop's records. `scope` keeps a record's material to itself where a
// caller changes it on its own: a glowing record (the day's hand dims a fixture's
// glass per key, propSetGlowOf) is shared only by the key and its levels.
function propMaterial(THREE, rec, scope) {
  const o = {
    color: new THREE.Color(rec.col[0], rec.col[1], rec.col[2]),
    roughness: rec.rough,
    metalness: rec.metal,
    envMapIntensity: 1.0,
    side: rec.dbl ? THREE.DoubleSide : THREE.FrontSide,
  };
  // FLAT SHADING, when the baker asks for it (G62.11). three computes the
  // normal from the fragment's own derivatives and ignores the attribute, so a
  // structure reads as the flat plates and straight tube it is instead of
  // being smoothed into something upholstered. Only the airframes use it; the
  // furniture is smooth-shaded and stays that way.
  if (rec.flat) o.flatShading = true;
  if (rec.map) o.map = propTexture(THREE, rec.map, true, 'color');
  if (rec.arm) {
    const arm = propTexture(THREE, rec.arm, false, 'data');
    o.roughnessMap = arm;
    o.metalnessMap = arm;
    if (rec.ao) { o.aoMap = arm; o.aoMapIntensity = 1.0; }
  }
  if (rec.nor) {
    o.normalMap = propTexture(THREE, rec.nor, false, 'normal');
    o.normalScale = new THREE.Vector2(rec.norScl, rec.norScl);
  }
  if (rec.emis) {
    o.emissive = new THREE.Color(rec.emis[0], rec.emis[1], rec.emis[2]);
    if (rec.emisMap) o.emissiveMap = propTexture(THREE, rec.emisMap, true, 'color');
  }
  if (rec.blend) { o.transparent = true; o.opacity = rec.opacity; }
  const m = MATLIB.shared(THREE, rec.blend ? 'glass' : rec.emis ? 'glow' : 'std', o, scope);
  m.userData.env0 = 1.0;
  return m;
}

// ---- the geometry bytes (2026-09-01, external media) ----------------------
// A baked prop names its own binary file (prop.bin, media/geo/props/) and the
// bytes are fetched ONCE through ASSET_FETCH, held here until the prop is
// built, then dropped — the decoded arrays are the keeper. A prop whose parts
// still carry b64 (selftest fixtures, unbaked trees) is ready by definition.
const PROP_BINS = new Map();            // prop key -> Uint8Array (fetched, undecoded)
const PROP_WARMS = new Map();           // prop key -> in-flight Promise
function propReady(key) {
  if (PROP_BUILT.has(key) || PROP_BINS.has(key)) return true;
  const p = PROP_REG.props[key];
  return !!p && !p.bin;
}
function propWarm(key) {
  const p = PROP_REG.props[key];
  if (!p) return Promise.reject(new Error('unknown prop: ' + key));
  if (propReady(key)) return Promise.resolve();
  if (typeof window === 'undefined' || typeof window.ASSET_FETCH !== 'function')
    return Promise.reject(new Error('prop ' + key + ': no ASSET_FETCH here'));
  let w = PROP_WARMS.get(key);
  if (!w) {
    w = window.ASSET_FETCH(p.bin).then(buf => { PROP_BINS.set(key, buf); });
    PROP_WARMS.set(key, w);
  }
  return w;
}

// Build the geometry + materials for one prop, ONCE. Later calls for the same
// key hand out fresh Meshes over the same buffers: a hangar with six crates
// uploads one crate.
let PROP_THREE = null;                  // the three the props were built with (propDust's late copies)
function propBuild(THREE, key) {
  let built = PROP_BUILT.get(key);
  if (built) return built;
  PROP_THREE = THREE;
  const prop = PROP_REG.props[key];
  if (!prop) throw new Error('unknown prop: ' + key);
  const dec = decodeProp(prop, PROP_BINS.get(key));
  PROP_BINS.delete(key);                // decoded arrays are the keeper now
  const geos = [], mats = [];
  for (const part of dec.parts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(part.nrm, 3));
    const uv = new THREE.BufferAttribute(part.uv, 2);
    g.setAttribute('uv', uv);
    g.setAttribute('uv1', uv);          // see the note at the top: aoMap needs it
    g.setIndex(new THREE.BufferAttribute(part.idx, 1));
    g.computeBoundingSphere();
    geos.push(g);
    const rec = prop.mats[part.mat];
    // a glowing record belongs to its fixture (the key and its cuts glow together); a dusted key keeps its own
    mats.push(propMaterial(THREE, rec, PROP_DUST.has(key) ? 'dust:' + key : rec.emis ? 'glow:' + (prop.lodOf || key) : ''));
  }
  built = { prop, geos, mats };
  propDraws(THREE, built);
  PROP_BUILT.set(key, built);
  const dust = PROP_DUST.get(key);
  if (dust) for (const m of mats) dustMaterial(m, dust);
  const glow = PROP_GLOW.get(key);
  if (glow != null) glowMaterials(mats, glow);
  return built;
}

// THE DRAW LIST (AS4a M1, G920): the parts of a prop that wear ONE record's material (MATLIB: the same maps and
// values) are one geometry and one draw - a prop's cut levels carry the full prop's records on fewer, coarser parts,
// and a scanned kit piece repeats a record over several (car_junk_l3: 5 parts, 2 records). Only the opaque, unlit
// ones: a transparent part keeps its own draw (fillPropMesh sorts them last) and a glowing one its own mesh (the
// shed's emitter books claim a fixture by its meshes). The parts themselves stay as they were - `geos` / `mats`
// by part, which the cage's baked pieces (app.js, parked.js) and the cabin read by index - and the placements draw
// `dgeos` / `dmats`. The same triangles in the same frame under the same material: the picture is the parts'.
//
// THE ARRAY DRAW LIST (AS4a-rest, G941; MATLIB's array shapes). Where the page can take a record's maps as texture-array
// layers (every map a KTX2 twin, or a flat constant, or none: MATLIB.arr.twin), the record is a ROW and its parts join
// the prop's ARRAY draws: one geometry per (side, flat shading, pages) - in practice one for the whole opaque prop -
// carrying each vertex's row (`mlRow`), drawn once by the shape's material (MATLIB.arr.material). car_buick draws
// 34 -> 18 (tools/matlib_chrome.js; its glass keeps its own). Glass and glow keep their own draws (above); a DUSTED key keeps its
// records (the dust is a hook on the record's material); a map with no twin (raw, or KTX2 off: ?ktx2=0) keeps its
// record, as before AS3. `?matarr=0` is the A/B: the records, as AS4a-EARLY drew them.
function propArrSpec(THREE, rec) {
  if (rec.blend || rec.emis) return null;
  const r = { col: rec.col, opacity: 1, rough: rec.rough, metal: rec.metal, norScl: rec.nor ? rec.norScl : 1, ao: !!(rec.arm && rec.ao), map: null, nor: null, arm: null };
  for (const [slot, kind] of [['map', 'color'], ['nor', 'normal'], ['arm', 'data']]) {
    const id = rec[slot]; if (!id) continue;
    const uri = PROP_REG.texs[id]; if (!uri) continue;   // propTexture's null: the record has no such map
    if (Array.isArray(uri)) { r[slot] = uri; continue; } // G903: a flat map is its constant - the row carries it
    const tw = MATLIB.arr.twin(uri, kind); if (!tw) return null;
    r[slot] = MATLIB.arr.layer(THREE, tw);
  }
  return r;
}
function propMerge(THREE, list, rows) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const row = rows ? new Uint16Array(nv) : null;   // the row per vertex: 2 bytes (the shader reads it as a float)
  let v = 0, t = 0;
  list.forEach((g, p) => {
    const A = g.attributes, n = A.position.count, I = g.index.array;
    pos.set(A.position.array, v * 3); nrm.set(A.normal.array, v * 3); uvs.set(A.uv.array, v * 2);
    if (row) row.fill(rows[p], v, v + n);
    for (let j = 0; j < I.length; j++) idx[t + j] = I[j] + v;
    v += n; t += I.length;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const uv = new THREE.BufferAttribute(uvs, 2);
  g.setAttribute('uv', uv); g.setAttribute('uv1', uv);
  if (row) g.setAttribute('mlRow', new THREE.BufferAttribute(row, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  // ONE COPY OF THE VERTICES: each part's position / normal / uv become VIEWS of the merged arrays (its own slice, the
  // same numbers) - the parts stay whole for their readers (`geos`, the cage's pieces), and the prop's vertices live
  // once in memory. Nothing has uploaded a part yet (propBuild runs before any draw).
  v = 0;
  for (const q of list) {
    const A = q.attributes, n = A.position.count;
    A.position.array = pos.subarray(v * 3, (v + n) * 3); A.normal.array = nrm.subarray(v * 3, (v + n) * 3);
    A.uv.array = uvs.subarray(v * 2, (v + n) * 2); if (A.uv1 && A.uv1 !== A.uv) A.uv1.array = A.uv.array;
    v += n;
  }
  return g;
}
function propDraws(THREE, b) {
  const groups = new Map(), order = [];
  for (const m of b.arrMats || []) MATLIB.release(m);   // a re-draw (propDust after the build) gives its shapes back
  b.arrMats = [];
  const arrOk = MATLIB.arr && MATLIB.arr.on && !PROP_DUST.has(b.prop.key);
  const KINDS = ['map', 'nor', 'arm'];
  b.geos.forEach((g, i) => {
    const m = b.mats[i], lit = m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b);
    const rec = b.prop.mats[b.prop.parts[i].mat];
    const spec = (arrOk && !m.transparent && !lit && rec) ? propArrSpec(THREE, rec) : null;
    if (spec) {
      const side = rec.dbl ? 2 : 0, flat = !!rec.flat, need = {};
      for (const k of KINDS) need[k] = spec[k] && spec[k].page ? spec[k].page : null;
      // (two draws of 16-bit indices are not joined into one of 32 - but the parts of ONE record always are, as
      // AS4a-EARLY joined them: a scanned person the baker cut into 65 535-vertex parts is one draw; and where a part
      // or the draw is past 65 535 already, it is 32-bit anyway)
      const nv = g.attributes.position.count;
      const fits = G => G.nv + nv <= 65535 || G.nv > 65535 || nv > 65535 || G.recs.has(m);
      let G = order.find(G => G.arr && G.side === side && G.flat === flat && KINDS.every(k => !need[k] || !G.pages[k] || G.pages[k] === need[k]) && fits(G));
      if (!G) { G = { arr: true, side, flat, pages: {}, list: [], rows: [], nv: 0, recs: new Set() }; order.push(G); }
      G.nv += nv; G.recs.add(m);
      for (const k of KINDS) if (need[k]) G.pages[k] = need[k];
      G.list.push(g); G.rows.push(MATLIB.arr.row(THREE, spec));
      return;
    }
    const k = (m.transparent || lit || !MATLIB.share) ? 'solo#' + i : m.uuid;
    let G = groups.get(k); if (!G) { groups.set(k, G = { m, list: [] }); order.push(G); }
    G.list.push(g);
  });
  b.dgeos = []; b.dmats = [];
  for (const G of order) {
    if (G.arr) {
      const m = MATLIB.arr.material(THREE, { side: G.side, flat: G.flat, pages: G.pages });
      m.envMapIntensity = m.userData.env0 * PROP_ENV;
      b.arrMats.push(m); b.dmats.push(m);
      const g = propMerge(THREE, G.list, G.rows);
      g.userData.parts = G.list.map(x => b.geos.indexOf(x));   // which parts it draws, and each one's row (GATE MATLIB)
      g.userData.rows = G.rows.slice();
      b.dgeos.push(g);
      continue;
    }
    b.dmats.push(G.m);
    if (G.list.length === 1) { b.dgeos.push(G.list[0]); continue; }
    const g = propMerge(THREE, G.list, null);
    g.userData.parts = G.list.map(x => b.geos.indexOf(x));   // which parts it draws (GATE MATLIB)
    b.dgeos.push(g);
  }
}

// THE FIXTURE'S OWN GLOW (G456; G417's account named a propSetGlowOf that never existed). A lit
// prop - the yard's wall lamp - carries the author's emissive on its glass, at intensity 1 the
// day round; the day's hand sets it: propSetGlowOf(key, k) scales the emissive of every material
// of the prop AND its levels of detail by k over the author's own intensity (kept in userData at
// the first touch), and a prop not built yet takes the last k when it is. Registered per key like
// the dust, so every placement of the fixture glows together (one material a part, shared).
const PROP_GLOW = new Map();             // prop key -> k
function glowMaterials(mats, k) {
  for (const m0 of mats) MATLIB.each(m0, m => {
    if (!m.emissive || (m.emissive.r === 0 && m.emissive.g === 0 && m.emissive.b === 0)) return;
    if (m.userData.emis0 == null) m.userData.emis0 = m.emissiveIntensity;
    m.emissiveIntensity = m.userData.emis0 * k;
  });
}
function propSetGlowOf(key, k) {
  PROP_GLOW.set(key, k);
  const b = PROP_BUILT.get(key);
  if (b) glowMaterials(b.mats, k);
  for (const l of propLevels(key)) { PROP_GLOW.set(l.key, k); const bl = PROP_BUILT.get(l.key); if (bl) glowMaterials(bl.mats, k); }
}

// THE DUST GRADIENT (G283, the user: "Apply a hard layer of dust gradient to
// the white fence, black to transparent vertically, black at the bottom ...
// You could do that with nearly everything, it's also faking AO"). A prop
// stood on the ground is dark at its foot and clean at `h` metres up; the
// darkening is in the prop's OWN frame (its origin is on the ground, its y is
// up), so it goes wherever the prop is stood. Registered per prop key -
// `propDust(key, h, k)` - before or after the prop is built; every instance
// of the key wears it, which is the point of a shared material.
const PROP_DUST = new Map();            // prop key -> { h, k }
function dustMaterial(m, d) {
  const ud = m.userData || (m.userData = {});
  ud.dust = { uDustH: { value: d.h }, uDustK: { value: d.k } };
  if (ud.dusted) return;
  ud.dusted = true;
  const prev = m.onBeforeCompile;
  const NL = String.fromCharCode(10);
  m.onBeforeCompile = sh => {
    if (prev) prev(sh);
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
    sh.uniforms.uDustH = ud.dust.uDustH;
    sh.uniforms.uDustK = ud.dust.uDustK;
    sh.vertexShader = 'varying float vDustY;' + NL + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + NL + '  vDustY = transformed.y;');
    sh.fragmentShader = 'varying float vDustY;' + NL + 'uniform float uDustH, uDustK;' + NL + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>' + NL +
        '  diffuseColor.rgb *= mix(1.0 - uDustK, 1.0, smoothstep(0.0, uDustH, vDustY));');
  };
  m.needsUpdate = true;
}
function propDust(key, h, k) {
  const d = { h: h || 0.4, k: k === undefined ? 0.85 : k };
  PROP_DUST.set(key, d);
  const b = PROP_BUILT.get(key);
  if (!b) return;
  // a record's material is shared with other keys (MATLIB): a key dusted after its build takes its own copies first
  // (the placements made from now on wear them; its meshes already standing keep the plain ones)
  b.mats = b.mats.map((m, i) => { if (m.userData.dusted || MATLIB.users(m) <= 1) return m;
    MATLIB.release(m); const p = b.prop.mats[b.prop.parts[i].mat]; const c = propMaterial(PROP_THREE, p, 'dust:' + key);
    c.envMapIntensity = c.userData.env0 * PROP_ENV; return c; });
  for (const m of b.mats) dustMaterial(m, d);
  propDraws(PROP_THREE, b);
}

// A placeable instance. Transparent parts go last in the group so a gauge glass
// does not sort in front of the dial behind it.
function fillPropMesh(THREE, key, g) {
  const b = propBuild(THREE, key);
  const order = b.dgeos.map((_, i) => i)
    .sort((a, c) => (b.dmats[a].transparent ? 1 : 0) - (b.dmats[c].transparent ? 1 : 0));
  for (const i of order) {
    const m = new THREE.Mesh(b.dgeos[i], b.dmats[i]);
    m.castShadow = true;
    m.receiveShadow = true;
    // SHARED, AND SAID SO. propBuild caches one geometry and one material per
    // prop; a caller tearing down a scene that holds prop instances must not
    // dispose these, or it takes out every future instance of the same prop.
    m.userData.sharedGeo = true;
    g.add(m);
  }
  g.userData.prop = b.prop;
  return g;
}
function propMesh(THREE, key) {
  const g = new THREE.Group();
  g.name = 'prop:' + key;
  if (propReady(key)) return fillPropMesh(THREE, key, g);
  // THE BYTES ARE STILL ON THE WIRE. The caller gets its group NOW — named,
  // placeable, empty — and the meshes land in it when the fetch does. Every
  // placement site keeps working untouched (position and rotation live on the
  // group), and whoever needs to know a prop materialised late (the hangar's
  // emitter books, the env bake) hooks window.PROP_LANDED once. A failed
  // fetch leaves the group empty: the prop is absent, not the room broken.
  g.userData.propPending = true;
  const B = (typeof window !== 'undefined' && window.BOOT) || null;   // the loading screen waits for the bytes
  if (B) B.expect('props');
  propWarm(key).then(() => {
    fillPropMesh(THREE, key, g);      // expects its textures before the landing below
    g.userData.propPending = false;
    propSetEnv(PROP_ENV);             // late materials wear the current mood
    if (typeof window !== 'undefined' && typeof window.PROP_LANDED === 'function')
      window.PROP_LANDED(key, g);
    if (B) B.landed('props');
  }).catch(e => {
    if (typeof console !== 'undefined')
      console.warn('prop ' + key + ' failed to load:', e && e.message);
    if (B) B.landed('props', false, key);
  });
  return g;
}

// THE LEVELS OF DETAIL (G301). tools/prop_lod.js cuts a prop down and bakes
// the cuts as props of their own, each saying which full prop it stands in
// for (`lodOf`) and from how far (`lodDist`, metres). Nothing registers them
// anywhere else: the levels of a key are read off the registry, once, here.
// A key with none places as it always did; a key with levels places a
// THREE.LOD - the renderer picks the level by distance every frame, the
// shadow pass follows the picked level's visibility, and a placement site
// keeps doing what it did (position and rotation live on the object).
const PROP_LEVELS = new Map();          // prop key -> [{ key, dist }] ascending
function propLevels(key) {
  let lv = PROP_LEVELS.get(key);
  if (lv) return lv;
  lv = PROP_REG.order.map(k => PROP_REG.props[k])
    .filter(p => p.lodOf === key)
    .map(p => ({ key: p.key, dist: p.lodDist }))
    .sort((a, b) => a.dist - b.dist);
  PROP_LEVELS.set(key, lv);
  return lv;
}
// PROP_LOD_FORCE (a window global): -1 for the renderer's choice; 0..n to pin
// every LOD prop to that level, so a bench can look at a level up close
function propLodForce() {
  const f = (typeof window !== 'undefined') ? window.PROP_LOD_FORCE : undefined;
  return (f === undefined || f === null) ? -1 : f;
}

// Place one: x/z on the floor plan, y from the prop's own `place` rule, ry in
// radians. Every prop was baked with its origin where it meets the world, so a
// placement site never needs to know how its author exported it.
// THE LAST LEVEL ENDS WHERE THE PROP IS UNDER A PIXEL AND A HALF (PERF 2026-09-23). A THREE.LOD's
// last level draws to infinity: the frame study found the premises' people drawn 5 km away (0.4 px
// tall), and the props with no cut at all - a 5 200-triangle propane bottle - drawn whole from
// every distance: 3 350 visible premises meshes, 9 ms of the frame at 300 m over the field. Every
// placed prop now ends in an EMPTY level at the distance where its diagonal subtends 1.5 px at
// 1080p (46 deg: 1 094 px a radian - 730 x the diagonal, 60 m at least); a prop with no cuts is a
// two-level LOD, itself then nothing. Nothing that covers a pixel is dropped.
const PROP_CULL_K = 730;
function propCullDist(key) {
  const P = PROP_REG.props[key], d = P && P.dim;
  return (d && d.length === 3) ? Math.max(60, PROP_CULL_K * Math.hypot(d[0], d[1], d[2])) : 0;
}
function propPlace(THREE, key, x, z, ry, y) {
  if (propInstWants(key)) { const p = propInstProxy(THREE, key); p.position.set(x, y || 0, z); p.rotation.y = ry || 0; return p; }   // G515 (below)
  const lv = propLevels(key);
  const force = propLodForce(), cull = force >= 0 ? 0 : propCullDist(key);
  let g;
  if ((lv.length || cull) && THREE.LOD) {
    g = new THREE.LOD();
    g.name = 'prop:' + key;
    g.userData.prop = PROP_REG.props[key];
    if (force >= 0) {
      // pinned: one level, at distance 0, whatever the camera does
      const pick = force === 0 || !lv.length ? key : (lv[Math.min(force, lv.length) - 1].key);
      g.addLevel(propMesh(THREE, pick), 0);
    } else {
      g.addLevel(propMesh(THREE, key), 0);
      for (const l of lv) g.addLevel(propMesh(THREE, l.key), l.dist);
      if (cull > (lv.length ? lv[lv.length - 1].dist : 0)) g.addLevel(new THREE.Group(), cull);
    }
  } else g = propMesh(THREE, key);
  g.position.set(x, y || 0, z);
  g.rotation.y = ry || 0;
  return g;
}

// THE INSTANCED PROPS (PERF 2026-09-23, G515). The frame is CPU-bound on its draw count, and the props
// that come by the hundred - the power poles along every road, the scanned fence stretches round every
// plot - were a THREE.LOD each: one draw per pole per material, ~260-400 poles and ~170 fence stretches
// in a view. Once the world attaches the instancer (propInstAttach: the game world only - the garage,
// the benches and the headless rigs place as they always did), propPlace hands such a key a PROXY: an
// empty object with the prop's name, placed and parented exactly as the LOD was - every placement site
// keeps setting its scale, its tilt, its parent. The instancer reads each proxy's final world matrix
// and draws every proxy of a key at its level (the LOD's own levels and distances, the same empty last
// level past a pixel and a half) through ONE InstancedMesh per level per material part. A proxy that is
// hidden (an ancestor's visible, the GRAPHICS power-line switch) or taken out of the scene (an edit's
// rebuild) is not drawn. The picture is the LODs'; the draws are a handful.
const PROP_INST_KEYS = /^(pole_a|pole_b|pole_c|fence_old)$/;
const PROP_INST = { THREE: null, scene: null, root: null, on: true, proxies: [], pending: [], batches: new Map(),
                    eye: null, tick: 0, dirty: true, stats: { proxies: 0, drawn: 0, draws: 0 } };
function propInstAttach(THREE, scene) {
  if (!THREE || !THREE.InstancedMesh || !THREE.Matrix4 || !THREE.Vector3 || !scene) return false;
  if (typeof location !== 'undefined' && /[?&]propinst=0/.test(location.search)) return false;   // ?propinst=0: every prop a LOD (the A/B)
  PROP_INST.THREE = THREE; PROP_INST.scene = scene;
  PROP_INST.root = new THREE.Group(); PROP_INST.root.name = 'propInstances';
  scene.add(PROP_INST.root);
  PROP_INST.eye = new THREE.Vector3(1e9, 0, 0);
  return true;
}
function propInstWants(key) { return !!PROP_INST.scene && PROP_INST.on && PROP_INST_KEYS.test(key) && propLodForce() < 0; }
function propInstProxy(THREE, key) {
  const g = THREE.Object3D ? new THREE.Object3D() : new THREE.Group();
  g.name = 'prop:' + key;
  g.userData.prop = PROP_REG.props[key];
  g.userData.propInst = key;
  PROP_INST.pending.push(g);
  PROP_INST.dirty = true;
  // the bytes of every level on their way now (a LOD would have fetched them at its placement)
  const B = (typeof window !== 'undefined' && window.BOOT) || null;   // the loading screen waits for the bytes, as for a LOD's
  for (const k of [key].concat(propLevels(key).map(l => l.key))) if (!propReady(k) && !PROP_WARMS.has(k)) {
    if (B) B.expect('props');
    propWarm(k).then(() => { PROP_INST.dirty = true; propSetEnv(PROP_ENV); if (B) B.landed('props'); }).catch(e => { if (B) B.landed('props', false, k); });
  }
  return g;
}
// is the proxy in the scene, and shown? (every ancestor visible, up to the scene)
function propInstLive(o) {
  let shown = true;
  for (let p = o; p; p = p.parent) { if (p === PROP_INST.scene) return shown ? 1 : 0; if (!p.visible) shown = false; }
  return -1;   // not (or no longer) in the scene
}
function propInstBatch(levelKey, part) {
  const id = levelKey + '#' + part;
  let b = PROP_INST.batches.get(id);
  if (b) return b;
  if (!propReady(levelKey)) return null;
  const built = propBuild(PROP_INST.THREE, levelKey);
  if (part >= built.dgeos.length) return null;
  // the instanced draw wears the record's INSTANCED sibling (MATLIB.variant): a material drawn by plain meshes and
  // instanced ones re-derives its program at every switch between them in the sorted list
  b = { id, geo: built.dgeos[part], mat: MATLIB.variant(PROP_INST.THREE, built.dmats[part], 'inst'), mesh: null, cap: 0, list: [] };
  PROP_INST.batches.set(id, b);
  return b;
}
function propInstUpdate(camera) {
  const P = PROP_INST, T = P.THREE;
  if (!P.scene || !camera) return;
  // the proxies placed since: in once they stand in the scene (a site adds its group after placing into it)
  if (P.pending.length) {
    const keep = [];
    for (const g of P.pending) {
      if (propInstLive(g) < 0) { if (!g.userData.instAge) g.userData.instAge = 0; if (++g.userData.instAge < 600) keep.push(g); continue; }
      P.proxies.push(g); P.dirty = true;
    }
    P.pending = keep;
  }
  const e = camera.position;
  P.tick++;
  const moved = Math.abs(e.x - P.eye.x) + Math.abs(e.y - P.eye.y) + Math.abs(e.z - P.eye.z) > 1.5;
  if (!P.dirty && !moved && P.tick % 30 !== 0) return;
  P.eye.copy(e); P.dirty = false;
  for (const b of P.batches.values()) b.list.length = 0;
  const zoom = camera.zoom || 1, keep = [];
  let drawn = 0;
  const w = new T.Vector3();
  for (const g of P.proxies) {
    const live = propInstLive(g);
    if (live < 0) continue;             // gone from the scene: dropped
    keep.push(g);
    if (!live) continue;                // hidden
    // the world matrix, as the LOD's would be (the sites set scale and tilt after the placement; a frozen
    // premises group has posed it already, a fresh one is posed here)
    if (g.matrixWorldAutoUpdate !== false) g.updateWorldMatrix(true, false);
    w.setFromMatrixPosition(g.matrixWorld);
    const key = g.userData.propInst, lv = propLevels(key), d = w.distanceTo(e) / zoom;
    let lk = key;
    for (const l of lv) if (d >= l.dist) lk = l.key;
    const cull = propCullDist(key);
    if (cull && d >= cull) continue;    // the empty last level: under a pixel and a half
    for (let part = 0; ; part++) { const b = propInstBatch(lk, part); if (!b) break; b.list.push(g.matrixWorld); }
    drawn++;
  }
  P.proxies = keep;
  let draws = 0;
  for (const b of P.batches.values()) {
    const n = b.list.length;
    if (n > b.cap) {
      if (b.mesh) { P.root.remove(b.mesh); b.mesh.dispose(); }
      b.cap = Math.max(16, n * 2);
      b.mesh = new T.InstancedMesh(b.geo, b.mat, b.cap);
      b.mesh.name = 'propInst:' + b.id; b.mesh.castShadow = true; b.mesh.receiveShadow = true;
      b.mesh.frustumCulled = false;     // the instances span kilometres; their levels already cut them by distance
      b.mesh.userData.sharedGeo = true; b.mesh.matrixAutoUpdate = false;
      P.root.add(b.mesh);
    }
    if (!b.mesh) continue;
    const a = b.mesh.instanceMatrix.array;
    for (let i = 0; i < n; i++) a.set(b.list[i].elements, i * 16);
    b.mesh.count = n; b.mesh.visible = n > 0; b.mesh.instanceMatrix.needsUpdate = true;
    if (n) draws++;
  }
  P.stats.proxies = P.proxies.length; P.stats.drawn = drawn; P.stats.draws = draws; P.stats.pending = P.pending.length;
}

// The moods scale every material's own envMapIntensity (r128 has no
// scene.environmentIntensity). Props built after a mood change pick the
// current factor up from here rather than staying at 1.0.
let PROP_ENV = 1.0;
function propSetEnv(f) {
  PROP_ENV = f;
  for (const b of PROP_BUILT.values())
    for (const m0 of b.mats.concat(b.arrMats || [])) MATLIB.each(m0, m => { m.envMapIntensity = m.userData.env0 * f; });   // the records and the array shapes
}
function propEnv() { return PROP_ENV; }

function propDispose(key) {
  const b = PROP_BUILT.get(key);
  if (!b) return;
  for (const g of new Set(b.geos.concat(b.dgeos || []))) g.dispose();
  for (const m of b.mats.concat(b.arrMats || [])) MATLIB.release(m);   // shared by record / by shape: the last user disposes it
  PROP_BUILT.delete(key);
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { propMesh, propPlace, propBuild, propMaterial, propTexture,
                     propSetEnv, propEnv, propDispose, propWarm, propReady, propDust,
                     propLevels, propSetGlowOf };
