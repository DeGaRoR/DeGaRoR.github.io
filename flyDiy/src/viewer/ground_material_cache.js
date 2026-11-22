// Opt-in material-cache prototype and live integration (?groundcache=1).
// Splits a captured ground program into a material-only MRT bake and a lit
// texture reader. Runtime lighting is retained; no material feature is dropped.
(function (root) {
  'use strict';
  function requireOne(text, token) {
    if (text.split(token).length !== 2) throw Error('material cache: expected one ' + token);
    return text.indexOf(token);
  }
  function blockEnd(text, start) {
    const open = text.indexOf('{', start); let depth = 1, i = open + 1;
    for (; depth && i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; }
    if (depth) throw Error('material cache: unclosed material block');
    return i;
  }
  function deriveSources(vs, fs, options) {
    const space = options && options.space || 'screen';
    const packed = !!(options && options.packed);
    if (space !== 'screen' && space !== 'world') throw Error('material cache: unknown space');
    const main = requireOne(fs, 'void main() {');
    const head = fs.slice(0, main), body = fs.slice(main);
    const physical = requireOne(body, 'PhysicalMaterial material;');
    // Finish before lighting, fog, exposure and output conversion. Preserve
    // the complete material computation, including its grading and shore work.
    let bakeHead = head;
    if (!/uniform\s+(?:highp\s+)?vec3\s+cameraPosition\s*;/.test(head)) {
      // Helpers in the header already reference the eye. GLSL needs its
      // declaration BEFORE those functions, not merely before main().
      const version = /^#version[^\n]*\n/.exec(head), offset = version ? version[0].length : 0;
      bakeHead = head.slice(0, offset) + '\nuniform highp vec3 cameraPosition;\n' + head.slice(offset);
    }
    if (packed) bakeHead = bakeHead.replace(/layout\s*\(location\s*=\s*0\)\s*out highp vec4 pc_fragColor\s*;/, '').replace(/^#define gl_FragColor pc_fragColor\s*$/gm, '');
    const bakeFs = (bakeHead + (packed ? '\nlayout(location = 0) out highp uvec4 cachePacked;\n' : '\nlayout(location = 1) out highp vec4 cacheNormal;\n') + body.slice(0, physical) +
      (packed ? '\n vec3 cacheN = normalize(inverseTransformDirection(normal, viewMatrix)) * 0.5 + 0.5;\n cachePacked = uvec4(packHalf2x16(diffuseColor.rg), packHalf2x16(vec2(diffuseColor.b, roughnessFactor)), packHalf2x16(cacheN.xy), packHalf2x16(vec2(cacheN.z, 1.0)));\n}\n' :
      '\n gl_FragColor = vec4(diffuseColor.rgb, roughnessFactor);\n cacheNormal = vec4(normalize(inverseTransformDirection(normal, viewMatrix)) * 0.5 + 0.5, 1.0);\n}\n'))
      .replace(/\bcameraPosition\b/g, 'uMaterialBakeEye');
    const start = requireOne(body, '{ vec2 guv = (vWPi.xz - uGGrid.xy) / uGGrid.zw;');
    const end = blockEnd(body, start);
    const mapStart = body.indexOf('#ifdef USE_MAP');
    const multiply = body.indexOf('diffuseColor *= sampledDiffuseColor;', mapStart);
    const mapEnd = body.indexOf('#endif', multiply) + '#endif'.length;
    if (mapStart < 0 || multiply < mapStart || mapEnd > start) throw Error('material cache: unexpected map layout');
    const roughStart = body.indexOf('float roughnessFactor = roughness;', end);
    if (options && options.completeMaterial && roughStart < end) throw Error('material cache: missing material boundary');
    let lit = body.slice(0, mapStart) + body.slice(mapEnd, start) +
      (space === 'screen' ? '\n vec2 cachedUv = gl_FragCoord.xy / uMaterialCacheSize;\n' :
        '\n vec2 cachedUv = (vWPi.xz - uMaterialCacheRect.xy) / uMaterialCacheRect.zw;\n cachedUv.y = 1.0 - cachedUv.y;\n') +
      (packed ? ' uvec4 cacheWords = texture(uMaterialCachePacked, cachedUv);\n vec4 cachedGround = vec4(unpackHalf2x16(cacheWords.r), unpackHalf2x16(cacheWords.g));\n vec3 cachedNormal = vec3(unpackHalf2x16(cacheWords.b), unpackHalf2x16(cacheWords.a).x);\n' : ' vec4 cachedGround = texture2D(map, cachedUv);\n') +
      ' diffuseColor.rgb = cachedGround.rgb;\n' + body.slice(options && options.completeMaterial ? roughStart : end);
    // map is now the prepared linear colour/roughness image, not the old
    // macro-albedo map. Remove its original multiply before reading the cache.
    const rough = 'if (uSplatOn > 0.5) roughnessFactor = 1.0 - (1.0 - gSRough) * uSNrm.y;';
    const norm = 'if (uSplatOn > 0.5) { vec3 pw = (viewMatrix * vec4(gSN, 0.0)).xyz; normal = normalize(normal + pw); }';
    requireOne(lit, rough); requireOne(lit, norm);
    lit = lit.replace(rough, 'roughnessFactor = cachedGround.a;')
      .replace(norm, 'normal = normalize((viewMatrix * vec4(' + (packed ? 'cachedNormal' : 'texture2D(uMaterialCacheNormal, cachedUv).xyz') + ' * 2.0 - 1.0, 0.0)).xyz);');
    const litFs = head + (packed ? '\nuniform highp usampler2D uMaterialCachePacked;\n' : '\nuniform sampler2D uMaterialCacheNormal;\n') + '\nuniform vec4 uMaterialCacheRect;\nuniform vec2 uMaterialCacheSize;\n' + lit;
    return { vs, originalFs: fs, bakeFs, litFs, space, packed };
  }
  // Three adds these headers itself for RawShaderMaterial. Keeping the
  // captured MeshStandardMaterial header causes a GLSL macro redefinition.
  const raw = s => s.replace(/^#version[^\n]*\n/, '')
    .replace(/^#define SHADER_(?:TYPE|NAME)[^\n]*\n/gm, '');
  function sourcesFor(renderer, material, options) {
    const p = renderer.properties.get(material), program = p.currentProgram;
    if (!program || !program.vertexShader || !program.fragmentShader) throw Error('material cache: compile the reference material first');
    const gl = renderer.getContext();
    return { sources: deriveSources(gl.getShaderSource(program.vertexShader), gl.getShaderSource(program.fragmentShader), options), uniforms: p.uniforms };
  }
  function makeProbe(THREE, renderer, mesh, options) {
    const o = options || {}, captured = o.reference ? { sources: deriveSources(o.reference.vs, o.reference.fs, o), uniforms: o.reference.uniforms } : sourcesFor(renderer, mesh.material, o), S = captured.sources;
    if (!captured.uniforms) throw Error('material cache: reference uniforms unavailable');
    let sourceScene = o.sourceScene || mesh;
    while (sourceScene.parent) sourceScene = sourceScene.parent;
    const shadowLights = [];
    sourceScene.traverseVisible(light => { if (light.isLight && light.castShadow && light.shadow) shadowLights.push(light); });
    const shadowUniforms = {};
    if (captured.uniforms.sunShadowMatrix && captured.uniforms.sunShadowMatrix.value.length)
      throw Error('material cache: cascaded sun capture requires explicit support');
    // r186 binds shadow textures directly from its light state, outside the
    // ordinary material uniform dictionary. Raw diagnostic programs must copy
    // those bindings too. Match matrix identity to retain the exact light order.
    for (const kind of ['directional', 'spot', 'point']) {
      const matrices = captured.uniforms[kind + 'ShadowMatrix'];
      if (!matrices || !matrices.value.length) continue;
      shadowUniforms[kind + 'ShadowMap'] = { value: matrices.value.map(matrix => {
        const light = shadowLights.find(light => light.shadow.matrix === matrix);
        if (!light || !light.shadow.map) throw Error('material cache: missing reference ' + kind + ' shadow map');
        const map = light.shadow.map;
        return map.texture.format === THREE.RGFormat ? map.texture : map.depthTexture || map.texture;
      }), needsUpdate: true };
    }
    // Source light wrappers may have needsUpdate=false after a world draw;
    // a new raw program needs its own initial uploads and wrapper ownership.
    const uniforms = () => {
      const result = Object.fromEntries(Object.entries(Object.assign({}, captured.uniforms, shadowUniforms))
        .map(([name, uniform]) => [name, Object.assign({}, uniform, { needsUpdate: true })]));
      if (o.ambient) result.ambientLightColor = { value: o.ambient.slice() };
      if (o.keyLight && result.directionalLights && result.directionalLights.value.length) {
        result.directionalLights.value = result.directionalLights.value.map((light, index) => index ? light :
          Object.assign({}, light, { color: new THREE.Color(...o.keyLight.color), direction: new THREE.Vector3(...o.keyLight.direction).normalize() }));
      }
      return result;
    };
    const create = (fragmentShader, U) => new THREE.RawShaderMaterial({ userData: { progOwner: 'terrain / ground cache / tile bake' },
      vertexShader: raw(S.vs), fragmentShader: raw(fragmentShader), glslVersion: THREE.GLSL3,
      uniforms: U, side: mesh.material.side, depthTest: true, depthWrite: true,
      // Frozen reference light uniforms: the comparison scene must not replace
      // the world's prepared lighting with its own empty light list.
      lights: false, toneMapped: false
    });
    const size = o.size || 256, width = o.cacheWidth || size, height = o.cacheHeight || size, rect = o.rect;
    if (!rect || rect.length !== 4) throw Error('material cache: rect [x,z,width,depth] required');
    const target = new THREE.WebGLRenderTarget(width, height, {
      count: S.packed ? 1 : 2, type: S.packed ? THREE.UnsignedIntType : THREE.HalfFloatType, format: S.packed ? THREE.RGBAIntegerFormat : THREE.RGBAFormat,
      minFilter: S.space === 'screen' ? THREE.NearestFilter : THREE.LinearFilter, magFilter: S.space === 'screen' ? THREE.NearestFilter : THREE.LinearFilter,
      depthBuffer: true, generateMipmaps: false
    });
    for (const t of target.textures) { t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; }
    const U = uniforms(); U.uMaterialBakeEye = { value: new THREE.Vector3() };
    const bakeMaterial = create(S.bakeFs, U), referenceMaterial = create(S.originalFs, uniforms());
    const L = uniforms();
    if (S.packed) L.uMaterialCachePacked = { value: target.textures[0] };
    else { L.map = { value: target.textures[0] }; L.uMaterialCacheNormal = { value: target.textures[1] }; }
    L.uMaterialCacheRect = { value: new THREE.Vector4(...rect) };
    L.uMaterialCacheSize = { value: new THREE.Vector2(width, height) };
    const litMaterial = create(S.litFs, L);
    const scene = new THREE.Scene(), object = new THREE.Mesh(mesh.geometry, bakeMaterial);
    mesh.updateWorldMatrix(true, false); object.matrix.copy(mesh.matrixWorld); object.matrixAutoUpdate = false;
    object.frustumCulled = false; scene.add(object);
    const top = new THREE.OrthographicCamera(-rect[2] / 2, rect[2] / 2, rect[3] / 2, -rect[3] / 2, .1, 20000);
    top.position.set(rect[0] + rect[2] / 2, o.height || 10000, rect[1] + rect[3] / 2);
    top.up.set(0, 0, -1); top.lookAt(rect[0] + rect[2] / 2, 0, rect[1] + rect[3] / 2); top.updateMatrixWorld(true);
    const check = material => {
      const p = renderer.properties.get(material).currentProgram;
      const gl = renderer.getContext();
      if (!p) throw Error('material cache: no prepared shader program');
      if (!gl.getProgramParameter(p.program, gl.LINK_STATUS))
        throw Error('material cache: shader failed to link: ' + gl.getProgramInfoLog(p.program) +
          '\nvertex: ' + gl.getShaderInfoLog(p.vertexShader) + '\nfragment: ' + gl.getShaderInfoLog(p.fragmentShader));
    };
    async function compile(material, camera) {
      object.material = material; await renderer.compileAsync(scene, camera); check(material);
    }
    async function bake(eye, camera) {
      const bakeCamera = S.space === 'screen' ? camera || top : top;
      U.uMaterialBakeEye.value.copy(eye);
      await compile(bakeMaterial, bakeCamera);
      const previous = renderer.getRenderTarget(), auto = renderer.autoClear;
      try { renderer.autoClear = true; renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, bakeCamera); }
      finally { renderer.setRenderTarget(previous); renderer.autoClear = auto; }
      return target;
    }
    return { sources: S, target, scene, object, top, bakeMaterial, referenceMaterial, litMaterial, compile, bake,
      dispose() { for (const m of [bakeMaterial, referenceMaterial, litMaterial]) m.dispose(); target.dispose(); } };
  }
  function expandIncludes(source, chunks, stack) {
    return source.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_, name) => {
      if (!(name in chunks)) throw Error('material cache: unknown shader chunk ' + name);
      const chain = stack || [];
      if (chain.includes(name)) throw Error('material cache: recursive shader chunk ' + name);
      return expandIncludes(chunks[name], chunks, chain.concat(name));
    });
  }
  // Experimental live integration. Original materials/hooks remain untouched:
  // compilation and rendering use derived standard materials, with the normal
  // renderer lighting path. No source is obtained from a compiled GL program.
  function install(THREE, renderer, options) {
    const packed = !!(options && options.packed);
    const pairs = new WeakMap(), all = new Set();
    const target = new THREE.WebGLRenderTarget(1, 1, { count: packed ? 1 : 2, type: packed ? THREE.UnsignedIntType : THREE.HalfFloatType,
      format: packed ? THREE.RGBAIntegerFormat : THREE.RGBAFormat,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
    for (const texture of target.textures) { texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = false; }
    const eye = { value: new THREE.Vector3() }, size = { value: new THREE.Vector2(1, 1) };
    const stats = { packed, pairs: 0, sourceBuilds: 0, renders: 0, width: 1, height: 1, bytes: 16, failures: [], sources: [], slowDraws: [] };
    const originalCompile = renderer.compile, originalRender = renderer.render;
    const invisible = new THREE.Material(); invisible.visible = false; invisible.userData.progOwner = 'terrain / ground cache / invisible placeholder (never drawn)';
    const builderLights = new THREE.Scene();
    builderLights.matrixWorldAutoUpdate = false;
    let inside = false;
    function eligible(material) { return material && material.groundFamily && material.isMeshStandardMaterial && !material.groundCacheRole; }
    function sync(pair) {
      const m = pair.original;
      for (const clone of [pair.baker, pair.lit]) {
        for (const key of ['envMap', 'envMapIntensity', 'roughness', 'metalness', 'side', 'opacity', 'transparent', 'depthTest', 'depthWrite',
          'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'flatShading', 'vertexColors', 'dithering', 'fog', 'toneMapped', 'alphaTest']) clone[key] = m[key];
        clone.color.copy(m.color); clone.emissive.copy(m.emissive); clone.emissiveIntensity = m.emissiveIntensity;
        if (clone.envMapRotation && m.envMapRotation) clone.envMapRotation.copy(m.envMapRotation);
        if (pair.version !== m.version) clone.needsUpdate = true;
      }
      pair.baker.map = m.map; pair.lit.map = packed ? m.map : target.textures[0]; pair.version = m.version;
    }
    function materialPair(material) {
      if (!eligible(material)) return null;
      let pair = pairs.get(material);
      if (!pair) {
        pair = { original: material, baker: material.clone(), lit: material.clone(), version: -1 };
        for (const [role, clone] of [['baker', pair.baker], ['lit', pair.lit]]) {
          clone.groundCacheRole = role; clone.groundFamily = material.groundFamily;
          if (packed && role === 'baker') clone.glslVersion = THREE.GLSL3;
          clone.name = (material.name || 'ground') + ':cache-' + role;
          clone.customProgramCacheKey = () => material.customProgramCacheKey() + '|material-cache-v2:' + (packed ? 'packed:' : 'mrt:') + role;
          clone.onBeforeCompile = (shader, activeRenderer) => {
            material.onBeforeCompile.call(material, shader, activeRenderer);
            const expanded = expandIncludes(shader.fragmentShader, THREE.ShaderChunk);
            const source = deriveSources(shader.vertexShader, expanded, { space: 'screen', completeMaterial: true, packed });
            shader.fragmentShader = role === 'baker' ? source.bakeFs : source.litFs;
            if (role === 'baker') shader.uniforms.uMaterialBakeEye = eye;
            else {
              shader.uniforms.uMaterialCacheSize = size;
              if (packed) shader.uniforms.uMaterialCachePacked = { value: target.textures[0] };
              else shader.uniforms.uMaterialCacheNormal = { value: target.textures[1] };
              shader.uniforms.uMaterialCacheRect = { value: new THREE.Vector4() };
            }
            stats.sourceBuilds++;
            stats.sources.push({ role, t: performance.now(), phase: root && root.BOOT && root.BOOT.current && root.BOOT.current.id,
              key: clone.customProgramCacheKey(), length: shader.fragmentShader.length });
          };
        }
        pairs.set(material, pair); all.add(pair); stats.pairs++;
      }
      sync(pair); return pair;
    }
    function entries(scene, visible) {
      const found = [];
      scene[visible ? 'traverseVisible' : 'traverse'](object => {
        if (!(object.isMesh || object.isPoints || object.isLine || object.isSprite) || !object.material) return;
        const input = Array.isArray(object.material) ? object.material : [object.material];
        const mapped = input.map(materialPair);
        if (mapped.some(Boolean)) {
          if (!mapped.every(Boolean)) throw Error('material cache: mixed ground/non-ground material array');
          found.push({ object, original: object.material, pairs: mapped, array: Array.isArray(object.material) });
        }
      });
      return found;
    }
    function swap(list, role) { for (const e of list) e.object.material = role ? (e.array ? e.pairs.map(p => p[role]) : e.pairs[0][role]) : e.original; }
    renderer.compile = function (scene, camera, lights) {
      if (inside) return originalCompile.apply(this, arguments);
      const list = entries(scene, false);
      if (!list.length) return originalCompile.apply(this, arguments);
      const previous = renderer.getRenderTarget(); let result;
      try {
        swap(list, 'lit'); result = originalCompile.call(this, scene, camera, lights);
        // Only ground builders belong in the material target. Recompiling the
        // complete scene here would create linear-output aircraft/building
        // variants that the real render never uses.
        const helper = new THREE.Group();
        for (const entry of list) for (const pair of entry.pairs) {
          const proxy = root && root.PROG_WARM ? root.PROG_WARM.standIn(entry.object, pair.baker) : entry.object.clone(false);
          proxy.material = pair.baker; helper.add(proxy);
        }
        renderer.setRenderTarget(target);
        // Material construction ends before lighting. A fixed zero-light
        // signature avoids recompiling it for every lamp/shadow configuration.
        builderLights.fog = (lights || scene).fog;
        builderLights.environment = (lights || scene).environment;
        for (const material of originalCompile.call(this, helper, camera, builderLights)) result.add(material);
        return result;
      } finally { renderer.setRenderTarget(previous); swap(list, null); }
    };
    renderer.render = function (scene, camera) {
      if (inside || scene.overrideMaterial) return originalRender.apply(this, arguments);
      const list = entries(scene, true);
      if (!list.length) return originalRender.apply(this, arguments);
      const previous = renderer.getRenderTarget(), cubeFace = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      const viewport = previous ? previous.viewport : renderer.getViewport(new THREE.Vector4()).multiplyScalar(renderer.getPixelRatio());
      const width = Math.max(1, Math.round(viewport.z)), height = Math.max(1, Math.round(viewport.w));
      if (target.width !== width || target.height !== height) { target.setSize(width, height); size.value.set(width, height); stats.width = width; stats.height = height; stats.bytes = width * height * 16; }
      camera.getWorldPosition(eye.value);
      const keep = new Set(list.map(e => e.object)), hidden = [], hiddenLights = [], background = scene.background;
      const shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate, auto = renderer.autoClear;
      const shadowRender = renderer.shadowMap.render;
      const clearColor = renderer.getClearColor(new THREE.Color()).clone(), clearAlpha = renderer.getClearAlpha();
      try {
        inside = true;
        if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
        // Render ONLY ground references in a separate scene, without changing
        // their parents/transforms. Full-scene shadow hooks can reveal parked
        // proxy meshes even when shadowMap.autoUpdate is false.
        builderLights.children = list.filter(entry => { for (let p = entry.object.parent; p; p = p.parent) if (keep.has(p)) return false; return true; }).map(entry => entry.object);
        builderLights.fog = scene.fog; builderLights.environment = scene.environment;
        builderLights.traverseVisible(object => { if (object.isLight || object.isLightProbeGrid) hiddenLights.push(object); });
        for (const light of hiddenLights) light.visible = false;
        builderLights.traverseVisible(object => { if ((object.isMesh || object.isPoints || object.isLine || object.isSprite) && !keep.has(object)) { hidden.push([object, object.material]); object.material = invisible; } });
        renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
        renderer.shadowMap.render = () => {};
        renderer.setClearColor(0, 0);
        swap(list, 'baker'); renderer.setRenderTarget(target); renderer.autoClear = true; renderer.clear();
        const bakeStart = performance.now(); originalRender.call(this, builderLights, camera); const bakeMs = performance.now() - bakeStart;
        for (const [object, material] of hidden) object.material = material;
        for (const light of hiddenLights) light.visible = true;
        renderer.shadowMap.render = shadowRender;
        renderer.setClearColor(clearColor, clearAlpha);
        scene.background = background; renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeeds;
        renderer.autoClear = auto; renderer.setRenderTarget(previous, cubeFace, mip); swap(list, 'lit');
        const litStart = performance.now(), result = originalRender.call(this, scene, camera), litMs = performance.now() - litStart;
        if (bakeMs + litMs > 100 && stats.slowDraws.length < 100) stats.slowDraws.push({ t: bakeStart, bakeMs, litMs, width, height,
          phase: root && root.BOOT && root.BOOT.current && root.BOOT.current.id });
        stats.renders++; return result;
      } catch (error) { stats.failures.push(String(error)); throw error; }
      finally {
        inside = false; for (const [object, material] of hidden) object.material = material; scene.background = background;
        for (const light of hiddenLights) light.visible = true;
        builderLights.children = []; renderer.shadowMap.render = shadowRender;
        renderer.setClearColor(clearColor, clearAlpha);
        renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeeds; renderer.autoClear = auto;
        renderer.setRenderTarget(previous, cubeFace, mip); swap(list, null);
      }
    };
    return { stats, ownsTexture: texture => target.textures.includes(texture), materials: material => { const p = materialPair(material); return p ? [p.lit, p.baker] : [material]; },
      reference(mesh) {
        const pair = materialPair(mesh.material), gl = renderer.getContext();
        if (!pair) throw Error('material cache: no reference pair');
        const lit = renderer.properties.get(pair.lit), baker = renderer.properties.get(pair.baker);
        if (!lit.currentProgram || !baker.currentProgram) throw Error('material cache: pair not prepared');
        const lfs = gl.getShaderSource(lit.currentProgram.fragmentShader), bfs = gl.getShaderSource(baker.currentProgram.fragmentShader);
        const main = requireOne(lfs, 'void main() {'), physical = requireOne(lfs.slice(main), 'PhysicalMaterial material;') + main;
        const bm = requireOne(bfs, 'void main() {'), writer = requireOne(bfs, packed ? '\n vec3 cacheN = normalize(inverseTransformDirection' : '\n gl_FragColor = vec4(diffuseColor.rgb, roughnessFactor);');
        const head = lfs.slice(0, main).replace(/^uniform\s+(?:highp\s+)?(?:u?sampler2D|vec[24])\s+uMaterialCache(?:Packed|Normal|Rect|Size)\s*;\s*$/gm, '');
        const fs = head + bfs.slice(bm, writer).replace(/\buMaterialBakeEye\b/g, 'cameraPosition') + lfs.slice(physical);
        return { vs: gl.getShaderSource(lit.currentProgram.vertexShader), fs,
          uniforms: Object.assign({}, lit.uniforms, { map: { value: pair.original.map } }) };
      },
      dispose() { renderer.compile = originalCompile; renderer.render = originalRender; target.dispose(); invisible.dispose(); for (const p of all) { p.baker.dispose(); p.lit.dispose(); } all.clear(); } };
  }
  const api = { deriveSources, sourcesFor, makeProbe, expandIncludes, install };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GROUND_MATERIAL_CACHE = api;
})(typeof window !== 'undefined' ? window : null);
