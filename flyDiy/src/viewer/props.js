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

// aoMap reads uv2, ALWAYS, in every three version that has it. A prop whose
// geometry has only `uv` gets an ao map that samples an attribute that is not
// there — which is not an error, just a prop that renders black. So uv2 is
// aliased onto uv at build time, once, here.
// see the note in app.js: whatever the card allows, not a remembered number
const PROP_ANISO = () =>
  (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;

const PROP_TEX_CACHE = new Map();       // tex id -> THREE.Texture (srgb variant)
const PROP_TEX_CACHE_LIN = new Map();   // tex id -> THREE.Texture (linear)
const PROP_BUILT = new Map();           // prop key -> { group, geos, mats }

function propTexture(THREE, id, srgb) {
  const cache = srgb ? PROP_TEX_CACHE : PROP_TEX_CACHE_LIN;
  let t = cache.get(id);
  if (t) return t;
  const uri = PROP_REG.texs[id];
  if (!uri) return null;
  const img = new Image();
  t = new THREE.Texture(img);
  t.anisotropy = PROP_ANISO();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;   // industrial_storage_cart wraps u to 2
  t.flipY = false;                            // glTF uv origin is top-left
  if (srgb) t.encoding = THREE.sRGBEncoding;
  const ok = () => { t.needsUpdate = true; };
  if (img.complete && img.naturalWidth) ok(); else img.onload = ok;
  img.src = uri;
  cache.set(id, t);
  return t;
}

// The factory. `rec` is the flat material record the baker wrote; nothing here
// branches on which asset it came from.
function propMaterial(THREE, rec) {
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
  if (rec.map) o.map = propTexture(THREE, rec.map, true);
  if (rec.arm) {
    const arm = propTexture(THREE, rec.arm, false);
    o.roughnessMap = arm;
    o.metalnessMap = arm;
    if (rec.ao) { o.aoMap = arm; o.aoMapIntensity = 1.0; }
  }
  if (rec.nor) {
    o.normalMap = propTexture(THREE, rec.nor, false);
    o.normalScale = new THREE.Vector2(rec.norScl, rec.norScl);
  }
  if (rec.emis) {
    o.emissive = new THREE.Color(rec.emis[0], rec.emis[1], rec.emis[2]);
    if (rec.emisMap) o.emissiveMap = propTexture(THREE, rec.emisMap, true);
  }
  if (rec.blend) { o.transparent = true; o.opacity = rec.opacity; }
  const m = new THREE.MeshStandardMaterial(o);
  m.userData.env0 = m.envMapIntensity;
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
function propBuild(THREE, key) {
  let built = PROP_BUILT.get(key);
  if (built) return built;
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
    g.setAttribute('uv2', uv);          // see the note at the top: aoMap needs it
    g.setIndex(new THREE.BufferAttribute(part.idx, 1));
    g.computeBoundingSphere();
    geos.push(g);
    mats.push(propMaterial(THREE, prop.mats[part.mat]));
  }
  built = { prop, geos, mats };
  PROP_BUILT.set(key, built);
  return built;
}

// A placeable instance. Transparent parts go last in the group so a gauge glass
// does not sort in front of the dial behind it.
function fillPropMesh(THREE, key, g) {
  const b = propBuild(THREE, key);
  const order = b.geos.map((_, i) => i)
    .sort((a, c) => (b.mats[a].transparent ? 1 : 0) - (b.mats[c].transparent ? 1 : 0));
  for (const i of order) {
    const m = new THREE.Mesh(b.geos[i], b.mats[i]);
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
  propWarm(key).then(() => {
    fillPropMesh(THREE, key, g);
    g.userData.propPending = false;
    propSetEnv(PROP_ENV);             // late materials wear the current mood
    if (typeof window !== 'undefined' && typeof window.PROP_LANDED === 'function')
      window.PROP_LANDED(key, g);
  }).catch(e => {
    if (typeof console !== 'undefined')
      console.warn('prop ' + key + ' failed to load:', e && e.message);
  });
  return g;
}

// Place one: x/z on the floor plan, y from the prop's own `place` rule, ry in
// radians. Every prop was baked with its origin where it meets the world, so a
// placement site never needs to know how its author exported it.
function propPlace(THREE, key, x, z, ry, y) {
  const g = propMesh(THREE, key);
  g.position.set(x, y || 0, z);
  g.rotation.y = ry || 0;
  return g;
}

// The moods scale every material's own envMapIntensity (r128 has no
// scene.environmentIntensity). Props built after a mood change pick the
// current factor up from here rather than staying at 1.0.
let PROP_ENV = 1.0;
function propSetEnv(f) {
  PROP_ENV = f;
  for (const b of PROP_BUILT.values())
    for (const m of b.mats) m.envMapIntensity = m.userData.env0 * f;
}
function propEnv() { return PROP_ENV; }

function propDispose(key) {
  const b = PROP_BUILT.get(key);
  if (!b) return;
  for (const g of b.geos) g.dispose();
  for (const m of b.mats) m.dispose();
  PROP_BUILT.delete(key);
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { propMesh, propPlace, propBuild, propMaterial, propTexture,
                     propSetEnv, propEnv, propDispose, propWarm, propReady };
