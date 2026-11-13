// ROCK-STUDY bench (2026-11-13) - see bench.html. One page, one patch, the switches below.
//   BASE        today's rock path, replicated from src/viewer/splat_ground.js + 28b_ground_fields.js RECIPE:
//               five types (heath grassRock 15 m, forest forestAir 17.5/81 m, scree rocksG 41.5/90 m, rock 'cliff' 71.5/79 m,
//               rock past 32-42 deg -> rocksB 51.5/120 m), each hex-tiled (hexN 2, rot 180, depth 0.02), triplanar
//               (triK 8, the side split nx^4 : nz^4), the types height-blended (seam 0.34), the set normals x nrmK 3 faded
//               250-1400 m, the Landsat macro tint at macroNear 0.5 (70 % less on 30-48 deg). NOT replicated: the 5 x 5 vote
//               (a 3 x 3 box per vertex instead), the recolour's hue selection, the pools, the banks, the far tier past 800 m.
//   ?rock=detail  (a) the rock types wear rocksB as a MACRO and the 'cliff' photograph at its own 7 m as a DETAIL (plain
//               tile), and the types' height blend is crisp (seam 0.12): rock edges cut by the texels, grass in the cracks
//   ?tri=bi|one (b) biplanar (the two heaviest planes) / one plane, dithered - for the faces; tri = today's three
//   ?expo=1     (c) rock exposure by slope + curvature (steep and convex bare, ledges and gullies vegetated, talus in the
//               concave foot), macro variation (two noise octaves), wet streaks down the faces from the flow field
//   ?strata=1   (c/e, shader) strata: banding and a bent normal on the faces - ledges in the light, ALU only
//   ?scatter=1  (d) boulders and scree from the game's rock kits, slope / curvature / foot-of-cliff driven, instanced
//   ?skirt=1.25 (e) the cliff skirt: the steep cells re-meshed at this step (m) with displaced ledges (real geometry)
//   ?mesh=1|cliff|scatter  THE MESH WAY (the user's direction after the tests above, 13 Nov): the procedural rock kit
//               (rock_kit.js) laid on the faces as overlapping shards and scattered as outcrops / talus / edge blocks,
//               instanced by (variant, LOD rung); the face's ground switches to the shards' own photograph (?faceset=0 not);
//               ?eco=1 the phone's ladder; ?rset=cliff|darkRock|rocksG the rock's photograph; ?kit=1 the kit on a stand
//   ?view=face|near|slope|high|top|ground  ?w=&h=  ?shadows=0  ?plain=1 (the geometry alone)  ?count=1 (texture fetches per pixel)
'use strict';
(async () => {
const Q = new URLSearchParams(location.search);
const P = { rock: Q.get('rock') || 'base', tri: Q.get('tri') || 'tri', expo: +(Q.get('expo') || 0), strata: +(Q.get('strata') || 0),
  scatter: +(Q.get('scatter') || 0), skirt: +(Q.get('skirt') || 0), view: Q.get('view') || 'face', count: +(Q.get('count') || 0),
  w: +(Q.get('w') || 1280), h: +(Q.get('h') || 720), shadows: Q.get('shadows') === '0' ? 0 : 1, hex: Q.get('hex') === '0' ? 0 : 1 };
const msg = s => { document.getElementById('msg').textContent = s; };
const T0 = performance.now();
const J = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
const B = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.arrayBuffer(); });
const [hdr, bin, rk, rbin, SJ] = await Promise.all([J('data/patch.json'), B('data/patch.bin'), J('data/rocks.json'), B('data/rocks.bin'), J('data/sets.json')]);
const lay = n => { const L = hdr.layout.find(l => l.name === n); return new self[L.type](bin, L.off, L.len); };
const H = lay('h'), CURV = lay('curv'), CODES = lay('codes'), ALB = lay('alb'), FLOW = lay('flow');
const N = hdr.n, ST = hdr.step, HALF = hdr.size / 2;
const hAt = (i, j) => H[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
const hXZ = (x, z) => { const fi = (x + HALF) / ST, fj = (z + HALF) / ST, i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
  return (hAt(i, j) * (1 - u) + hAt(i + 1, j) * u) * (1 - v) + (hAt(i, j + 1) * (1 - u) + hAt(i + 1, j + 1) * u) * v; };
const gradXZ = (x, z, d = 2.5) => [(hXZ(x + d, z) - hXZ(x - d, z)) / (2 * d), (hXZ(x, z + d) - hXZ(x, z - d)) / (2 * d)];
const slopeAt = (x, z) => { const g = gradXZ(x, z); return Math.atan(Math.hypot(g[0], g[1])) * 180 / Math.PI; };
const sample = (A, k, x, z) => { const i = Math.round((x + HALF) / ST), j = Math.round((z + HALF) / ST);
  return A[(Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))) * k]; };
const sampleK = (A, k, c, x, z) => { const i = Math.round((x + HALF) / ST), j = Math.round((z + HALF) / ST);
  return A[(Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))) * k + c]; };

// ---- renderer, scene, light ------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(P.w, P.h); document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !!P.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
const gl = renderer.getContext();
const scene = new THREE.Scene();
const SKY = new THREE.Color(0.55, 0.66, 0.80);
scene.background = SKY; scene.fog = new THREE.FogExp2(SKY.clone(), 0.00022);
const camera = new THREE.PerspectiveCamera(50, P.w / P.h, 1, 20000);
const hemi = new THREE.HemisphereLight(0xbcd2ee, 0x4a4636, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); scene.add(sun); scene.add(sun.target);
sun.castShadow = !!P.shadows; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.2;

// ---- the ground sets: two texture arrays, as the game packs them (colour + height, normal + rough) -----------------------
const KEYS = ['grassRock', 'forestAir', 'rocksG', 'cliff', 'rocksB', 'darkRock'], NL = KEYS.length, PX = 512;
const img = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = u; });
const pix = im => { const c = document.createElement('canvas'); c.width = c.height = PX; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, PX, PX); return x.getImageData(0, 0, PX, PX).data; };
const AD = new Uint8Array(PX * PX * 4 * NL), ND = new Uint8Array(PX * PX * 4 * NL);
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const MEAN0 = [], MRGB = [], GRADE = [], GR2 = [];
await Promise.all(KEYS.map(async (k, L) => {
  const s = SJ.sets[k]; const [d, n, h, r] = await Promise.all([img(s.diff), img(s.nor), img(s.height), img(s.rough)]);
  const dp = pix(d), np = pix(n), hp = pix(h), rp = pix(r), o = L * PX * PX * 4;
  let m = 0, mr = 0, mg = 0, mb = 0;
  for (let i = 0; i < PX * PX; i++) {
    AD[o + i * 4] = dp[i * 4]; AD[o + i * 4 + 1] = dp[i * 4 + 1]; AD[o + i * 4 + 2] = dp[i * 4 + 2]; AD[o + i * 4 + 3] = hp[i * 4];
    ND[o + i * 4] = np[i * 4]; ND[o + i * 4 + 1] = np[i * 4 + 1]; ND[o + i * 4 + 2] = np[i * 4 + 2]; ND[o + i * 4 + 3] = rp[i * 4];
    if ((i & 15) === 0) { const r0 = lin(dp[i * 4]), g0 = lin(dp[i * 4 + 1]), b0 = lin(dp[i * 4 + 2]); m += 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0; mr += r0; mg += g0; mb += b0; }
  }
  MEAN0[L] = m / (PX * PX / 16); MRGB[L] = [mr, mg, mb].map(v => v / (PX * PX / 16));
  const g = s.grade || {}; const c = new THREE.Color(g.gain || '#ffffff');   // (the gain as linear-ish bytes: the game reads '#rrggbb' / 255)
  const hex = (g.gain || '#ffffff').replace('#', ''); const gr = [0, 2, 4].map(q => parseInt(hex.substr(q, 2), 16) / 255);
  GRADE[L] = new THREE.Vector4(gr[0], gr[1], gr[2], g.sat === undefined ? 1 : g.sat);
  GR2[L] = new THREE.Vector4(g.contrast || 1, g.gloss === undefined ? 1 : g.gloss, g.grass || 0, 0);
}));
const mkArr = D => { const t = new THREE.DataArrayTexture(D, PX, PX, NL); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true; return t; };
const TA = mkArr(AD), TN = mkArr(ND);
// the open ground's grass, measured (splat_ground uSGrassC): grassRock's mean after its grade - the colour a rock set's DARK texels walk to
const GRASSC = new THREE.Vector3(MRGB[0][0] * GRADE[0].x, MRGB[0][1] * GRADE[0].y, MRGB[0][2] * GRADE[0].z);
const MEAN = MEAN0.map((m, L) => { const g = GRADE[L]; const lg = 0.2126 * g.x + 0.7152 * g.y + 0.0722 * g.z; return m * lg; });

// the macro's exposure (render_world / splat_ground autoExposure, simplified to this patch): the sets' mean over the albedo's
let la = 0; for (let i = 0; i < N * N; i++) la += 0.2126 * lin(ALB[i * 3]) + 0.7152 * lin(ALB[i * 3 + 1]) + 0.0722 * lin(ALB[i * 3 + 2]);
la /= N * N; const MACEXP = Math.min(6, Math.max(1, (MEAN[0] + MEAN[1] + MEAN[3] + MEAN[4]) / 4 / la));

// ---- the patch mesh (and the skirt, test e) ------------------------------------------------------------------------------
const vNorm = new Float32Array(N * N * 3);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const nx = -(hAt(i + 1, j) - hAt(i - 1, j)) / (2 * ST), nz = -(hAt(i, j + 1) - hAt(i, j - 1)) / (2 * ST), l = Math.hypot(nx, 1, nz);
  vNorm[(j * N + i) * 3] = nx / l; vNorm[(j * N + i) * 3 + 1] = 1 / l; vNorm[(j * N + i) * 3 + 2] = nz / l;
}
const vSlope = k => Math.acos(Math.min(1, vNorm[k * 3 + 1])) * 180 / Math.PI;
const SK = { lo: 38, hi: 50 };
const DIP = { x: Math.cos(0.7), z: Math.sin(0.7), k: Math.tan(18 * Math.PI / 180) };   // the beds' dip (direction, tan) - skirt and shader   // the skirt's mask: 0 under lo deg, 1 over hi
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const vMask = new Float32Array(N * N); for (let k = 0; k < N * N; k++) vMask[k] = P.skirt > 0 ? ss(SK.lo, SK.hi, vSlope(k)) : 0;
// the skirt is a RING round the eye (as a game would draw it): cells within SKR m of the camera (set before the build)
let SKR = 1e9, SKX = 0, SKZ = 0;
const cellSkirt = (i, j) => P.skirt > 0 && Math.hypot(-HALF + (i + 0.5) * ST - SKX, -HALF + (j + 0.5) * ST - SKZ) < SKR && (vMask[j * N + i] > 0 || vMask[j * N + i + 1] > 0 || vMask[(j + 1) * N + i] > 0 || vMask[(j + 1) * N + i + 1] > 0);
function attrsAt(x, z, pos, codes, curv, flow, alb, k4, k2, k1, k3) {
  // nearest-vertex fields for a refined vertex (the fields are 5 m / 10 m data: nearest is honest)
  const i = Math.min(N - 1, Math.max(0, Math.round((x + HALF) / ST))), j = Math.min(N - 1, Math.max(0, Math.round((z + HALF) / ST))), q = j * N + i;
  for (let c = 0; c < 4; c++) codes[k4 + c] = CODES[q * 4 + c]; curv[k2] = CURV[q * 2]; curv[k2 + 1] = CURV[q * 2 + 1]; flow[k1] = FLOW[q];
  for (let c = 0; c < 3; c++) alb[k3 + c] = ALB[q * 3 + c];
}
function buildBase() {
  const pos = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; pos[k * 3] = -HALF + i * ST; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = -HALF + j * ST; }
  const idx = [];
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    if (cellSkirt(i, j)) continue;
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(vNorm, 3));
  g.setAttribute('aCodes', new THREE.BufferAttribute(CODES, 4, true)); g.setAttribute('aCurv', new THREE.BufferAttribute(CURV, 2));
  g.setAttribute('aFlow', new THREE.BufferAttribute(FLOW, 1, true)); g.setAttribute('aAlb', new THREE.BufferAttribute(ALB, 3, true));
  g.setIndex(new THREE.BufferAttribute(N * N > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  return g;
}
// value noise (CPU, the skirt's ledges)
// (murmur3's finaliser over the three words: the first hash here was one weak round, and consecutive seeds came out
// correlated - the placement's random points stood in COLUMNS, seen from the side as rows along the contours)
const hh = (x, y, z) => { let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul((y | 0) + 0x632be5ab, 0x165667b1) ^ Math.imul((z | 0) + 0x7f4a7c15, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const vn3 = (x, y, z) => { const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = x - X, v = y - Y, w = z - Z;
  const s = t => t * t * (3 - 2 * t), a = s(u), b = s(v), c = s(w); let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
    r += hh(X + dx, Y + dy, Z + dz) * (dx ? a : 1 - a) * (dy ? b : 1 - b) * (dz ? c : 1 - c);
  return r; };
function buildSkirt(step) {
  // THE CLIFF SKIRT (test e): every cell the mask touches re-meshed at `step` on ONE shared lattice (welded: a vertex on a
  // cell's edge is its neighbour's too, so the normals are smooth across cells), heights bilinear in the cell (the base
  // mesh's edges are straight lines between its 5 m vertices, so the skirt's border vertices lie ON them: no crack), then
  // each vertex pushed along the downhill by the ROCK LAW, x the mask (0 on any border shared with an un-skirted cell, so
  // the seam is exact). The rock law is BEDDING x JOINTS, the two sets of planes a real face breaks along:
  //   BEDDING: beds of T = 7-13 m (warped by a 3D noise so they are not contour lines), each bed's riser held near vertical
  //     and its top a bench - the stair that approximates the slope, d = -(1 - fr) * run * k, run = T / tan(slope); not
  //     every bed is a ledge (a hashed strength per bed, and a 40 m noise along it);
  //   JOINTS: vertical fractures across the beds - the contour coordinate cut into blocks of 6-14 m, each (block, bed) pair
  //     standing proud or sunk by up to 1.6 m: the risers become columns and blocks;
  //   plus a block noise (2.2 m at 4.5 m, 0.9 m at 1.9 m) so nothing is a plane.
  const sub = Math.max(1, Math.round(ST / step));
  const cells = []; for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) if (cellSkirt(i, j)) cells.push([i, j]);
  const key = new Map(); const P3 = [], CO = [], CU = [], FL = [], AL = []; let nv = 0;
  const tmp4 = new Uint8Array(4), tmp2 = new Float32Array(2), tmp1 = new Uint8Array(1), tmp3 = new Uint8Array(3);
  const vert = (gi, gj) => {
    const k0 = gi * 1048576 + gj; let v = key.get(k0); if (v !== undefined) return v;
    const ci = Math.min(N - 2, Math.floor(gi / sub)), cj = Math.min(N - 2, Math.floor(gj / sub)), u = gi / sub - ci, w = gj / sub - cj;
    const x = -HALF + (ci + u) * ST, z = -HALF + (cj + w) * ST;
    const y = (hAt(ci, cj) * (1 - u) + hAt(ci + 1, cj) * u) * (1 - w) + (hAt(ci, cj + 1) * (1 - u) + hAt(ci + 1, cj + 1) * u) * w;
    const m = (vMask[cj * N + ci] * (1 - u) + vMask[cj * N + ci + 1] * u) * (1 - w) + (vMask[(cj + 1) * N + ci] * (1 - u) + vMask[(cj + 1) * N + ci + 1] * u) * w;
    let X = x, Y = y, Z = z;
    if (m > 0) {
      const g = gradXZ(x, z, 5), gl2 = Math.hypot(g[0], g[1]) || 1e-6, ox = -g[0] / gl2, oz = -g[1] / gl2;   // outward = downhill
      const sl = Math.atan(gl2), T = 8.0 + 8.0 * vn3(x / 60, 0, z / 60);
      // THE BEDS DIP (18 deg toward DIP, plus a 9 m warp at 60 m): flat beds on a dome are its contour lines - rings, a
      // fingerprint (the first trial); dipping beds cut across the contours, as a real massif's do
      const warp = (vn3(x / 23, y / 23, z / 23) - 0.5) * 5.0 + (vn3(x / 60, 1, z / 60) - 0.5) * 9.0;
      const sy = (y + DIP.k * (x * DIP.x + z * DIP.z) + warp) / T, bed = Math.floor(sy), fr = sy - bed;
      const frs = ss(0.0, 0.9, fr);
      const run = Math.min(8, T / Math.tan(Math.max(sl, 0.35)));
      const bedK = 0.12 + 0.88 * ss(0.5, 0.85, hh(bed, 7, 7)), along = ss(0.3, 0.7, vn3(x / 40, bed * 1.7, z / 40));
      const k = 0.9 * m * bedK * (0.25 + 0.75 * along);
      const uC = x * -oz + z * ox, Wj = 5 + 9 * vn3(x / 80, 3, z / 80), jb = Math.floor(uC / Wj + (vn3(x / 15, y / 15, z / 15) - 0.5) * 0.8);
      const joint = (hh(jb, bed, 11) - 0.5) * 4.0 * m;
      const block = ((vn3(x / 4.5, y / 4.5, z / 4.5) - 0.5) * 2.2 + (vn3(x / 1.9 + 5, y / 1.9, z / 1.9) - 0.5) * 0.9) * m;
      const dd = -(1 - frs) * run * k + joint + block;
      X += ox * dd; Z += oz * dd; Y += (vn3(x / 7, y / 7 + 9, z / 7) - 0.5) * 0.6 * m;
    }
    P3.push(X, Y, Z); attrsAt(x, z, null, tmp4, tmp2, tmp1, tmp3, 0, 0, 0, 0);
    CO.push(tmp4[0], tmp4[1], tmp4[2], tmp4[3]); CU.push(tmp2[0], tmp2[1]); FL.push(tmp1[0]); AL.push(tmp3[0], tmp3[1], tmp3[2]);
    key.set(k0, nv); return nv++;
  };
  const idx = [];
  for (const [ci, cj] of cells) for (let b = 0; b < sub; b++) for (let a = 0; a < sub; a++) {
    const gi = ci * sub + a, gj = cj * sub + b;
    const p = vert(gi, gj), q = vert(gi + 1, gj), r = vert(gi, gj + 1), t = vert(gi + 1, gj + 1);
    idx.push(p, r, q, q, r, t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P3), 3));
  g.setAttribute('aCodes', new THREE.BufferAttribute(new Uint8Array(CO), 4, true)); g.setAttribute('aCurv', new THREE.BufferAttribute(new Float32Array(CU), 2));
  g.setAttribute('aFlow', new THREE.BufferAttribute(new Uint8Array(FL), 1, true)); g.setAttribute('aAlb', new THREE.BufferAttribute(new Uint8Array(AL), 3, true));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1)); g.computeVertexNormals();
  return { g, cells: cells.length };
}

// ---- the ground material: MeshStandardMaterial + the splat hook (as the game's near ring) ----------------------------------
const ROCKSET_G = { cliff: 3, darkRock: 5, rocksG: 2 }[Q.get('rset') || 'cliff'] ?? 3;
const ROCKSCALE_G = ({ 3: 6.86, 5: 2.0, 2: 2.03 }[ROCKSET_G] * 1.6).toFixed(2);
const D = {};
D.ROCK_DETAIL = P.rock === 'detail' ? 1 : 0; D.TRI_MODE = P.tri === 'bi' ? 1 : (P.tri === 'one' ? 2 : 0);
D.PLAIN = Q.get('plain') === '1' ? 1 : 0; D.FACESET = Q.get('mesh') && Q.get('faceset') !== '0' ? 1 : 0; D.EXPO = P.expo ? 1 : 0; D.STRATA = P.strata ? 1 : 0; D.COUNT = P.count ? 1 : 0; D.HEX = P.hex ? 1 : 0;
const U = { uA: { value: TA }, uN: { value: TN }, uGrade: { value: GRADE }, uGr2: { value: GR2 }, uMean: { value: MEAN }, uMean0: { value: MEAN0 },
  uMacExp: { value: MACEXP }, uGrassC: { value: GRASSC } };
const GLSL_COMMON = `
uniform highp sampler2DArray uA, uN;
uniform vec4 uGrade[${NL}], uGr2[${NL}];
uniform float uMean[${NL}], uMean0[${NL}], uMacExp; uniform vec3 uGrassC;
varying vec3 vW; varying vec4 vCodes; varying vec2 vCurv; varying float vFlow; varying vec3 vAlb; varying vec3 vNs;
float gCnt = 0.0;
vec3 gSN = vec3(0.0); float gSRough = 0.9;
struct Smp { vec4 c; vec4 n; };
float luma3(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float hash1(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1, 0)), f.x), mix(hash1(i + vec2(0, 1)), hash1(i + vec2(1, 1)), f.x), f.y); }
Smp sFetch(float L, vec2 uv, vec2 cs){
  gCnt += 2.0;
  Smp o; o.c = texture(uA, vec3(uv, L)); o.c.rgb = pow(o.c.rgb, vec3(2.2));
  vec4 nr = texture(uN, vec3(uv, L));
  vec2 t = nr.xy * 2.0 - 1.0; t = vec2(cs.x * t.x + cs.y * t.y, -cs.y * t.x + cs.x * t.y);
  int li = int(L + 0.5); vec4 g = uGrade[li]; vec4 g2 = uGr2[li];
  o.n = vec4(t, nr.z * 2.0 - 1.0, 1.0 - (1.0 - nr.a) * g2.y);
  if (g2.x != 1.0) o.c.rgb = max(vec3(uMean0[li]) + (o.c.rgb - vec3(uMean0[li])) * g2.x, vec3(0.0));
  o.c.rgb *= g.rgb; float l = luma3(o.c.rgb); o.c.rgb = mix(vec3(l), o.c.rgb, g.a);
  // THE GRASS UNDER THE ROCK IS THE GRASS (splat_ground sFetch, uSGrass): the set's dark texels recoloured at constant value
  if (g2.z > 0.001) { float lm = max(uMean[li], 1e-4); float dark = 1.0 - smoothstep(lm * 0.55, lm * 1.25, l);
    o.c.rgb = mix(o.c.rgb, uGrassC / max(luma3(uGrassC), 1e-4) * l, dark * g2.z); }
  return o;
}
vec3 hw3(float ha, float wa, float hb, float wb, float hc, float wc, float depth){
  float ma = max(max(ha + wa, hb + wb), hc + wc) - depth;
  vec3 b = max(vec3(ha + wa, hb + wb, hc + wc) - ma, 0.0); return b / (b.x + b.y + b.z); }
// THE HEX TILE (splat_ground sTile, without its corner-colour fix): three rotated, offset fetches height-blended
Smp sTile(float L, vec2 st, float hexOn){
  if (hexOn < 0.5) return sFetch(L, st, vec2(1.0, 0.0));
  vec2 sk = mat2(1.0, 0.0, -0.57735027, 1.15470054) * (st * 2.0);
  vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
  vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
  vec2 v1 = base + vec2(s, s), v2 = base + vec2(s, 1.0 - s), v3 = base + vec2(1.0 - s, s);
  vec2 r1 = hash2(v1), r2 = hash2(v2), r3 = hash2(v3);
  float a1 = (r1.x - 0.5) * 6.2831853, a2 = (r2.x - 0.5) * 6.2831853, a3 = (r3.x - 0.5) * 6.2831853;
  Smp s1 = sFetch(L, mat2(cos(a1), sin(a1), -sin(a1), cos(a1)) * st + r1 * 7.3, vec2(cos(a1), sin(a1)));
  Smp s2v = sFetch(L, mat2(cos(a2), sin(a2), -sin(a2), cos(a2)) * st + r2 * 7.3, vec2(cos(a2), sin(a2)));
  Smp s3 = sFetch(L, mat2(cos(a3), sin(a3), -sin(a3), cos(a3)) * st + r3 * 7.3, vec2(cos(a3), sin(a3)));
  vec3 h = hw3(s1.c.a, w.x, s2v.c.a, w.y, s3.c.a, w.z, 0.02);
  Smp o; o.c = s1.c * h.x + s2v.c * h.y + s3.c * h.z; o.n = s1.n * h.x + s2v.n * h.y + s3.n * h.z; return o;
}
// THE TRIPLANAR SET (splat_ground sSet): the top plane, and the two side planes where their weight passes 0.01
Smp sSet(float L, float scale, vec3 P, vec3 tw, float hexOn){
  Smp t = sTile(L, P.xz / scale, hexOn);
  Smp o; o.c = t.c * tw.y; o.n = vec4(t.n.x, 0.0, t.n.y, t.n.a) * tw.y;
  if (tw.x > 0.01) { Smp u = sTile(L, P.zy / scale, hexOn); o.c += u.c * tw.x; o.n += vec4(0.0, u.n.y, u.n.x, u.n.a) * tw.x; }
  if (tw.z > 0.01) { Smp u = sTile(L, P.xy / scale, hexOn); o.c += u.c * tw.z; o.n += vec4(u.n.x, u.n.y, 0.0, u.n.a) * tw.z; }
  return o;
}
// a terrain type, near and far scales blended over the detail fade (150-900 m), one sample where they agree
Smp sType(float L, float sN, float sF, vec3 P, vec3 tw, float fw, float hexOn){
  if (abs(sN - sF) < 0.01 * sN || fw < 0.001) return sSet(L, sN, P, tw, hexOn);
  if (fw > 0.999) return sSet(L, sF, P, tw, hexOn);
  Smp a = sSet(L, sN, P, tw, hexOn), b = sSet(L, sF, P, tw, hexOn);
  Smp o; o.c = mix(a.c, b.c, fw); o.n = mix(a.n, b.n, fw); return o;
}
#if ROCK_DETAIL
// (a) THE ROCK, MACRO + DETAIL: rocksB (the aerial of outcrops, 51.5 m) carries the colour and the big shapes; the 'cliff'
// photograph at its own scale (7 m - it was 71.5) modulates it by its texel over its mean, its normal added, its height
// mixed in - faded out by 400 m, where a 7 m tile is a few pixels. The detail is a PLAIN tile (no hex: the macro breaks
// its repeat) on the same planes.
Smp sRock(float Lm, float sN, float sF, vec3 P, vec3 tw, float fw, float d, float hexOn){
  Smp m = sType(Lm, sN, sF, P, tw, fw, hexOn);
  float kd = 1.0 - smoothstep(180.0, 400.0, d);
  if (kd > 0.001) {
    Smp t = sSet(3.0, 7.0, P, tw, 0.0);
    float rel = luma3(t.c.rgb) / max(uMean[3], 1e-3);
    m.c.rgb *= mix(1.0, clamp(rel, 0.2, 3.0), 0.85 * kd);
    m.n.xyz = m.n.xyz * (1.0 - 0.4 * kd) + t.n.xyz * kd;
    m.c.a = mix(m.c.a, t.c.a, 0.6 * kd);
    m.n.w = mix(m.n.w, t.n.w, kd);
  }
  return m;
}
#endif
#if EXPO || STRATA
float fbm2(vec2 p){ return vnoise(p) * 0.5 + vnoise(p * 2.03 + 17.1) * 0.3 + vnoise(p * 4.11 - 5.3) * 0.2; }
#endif
vec3 sSplat(vec3 nGeo){
  vec3 P = vW;
#if PLAIN
  return vec3(0.25);   // (?plain=1: the geometry alone, lit - no sets, no set normals)
#endif
  float slope = degrees(acos(clamp(nGeo.y, 0.0, 1.0)));
  vec3 nTri = normalize(cross(dFdx(vW), dFdy(vW))); nTri *= nTri.y < 0.0 ? -1.0 : 1.0;
  float d = distance(P, cameraPosition);
  float fw = smoothstep(150.0, 900.0, d);
  vec4 cw = vCodes / max(vCodes.x + vCodes.y + vCodes.z + vCodes.w, 1e-3);   // rock, scree, forest, heath
  float wR = cw.x, wS = cw.y, wF = cw.z, wH = cw.w;
#if EXPO
  // (c) EXPOSURE: rock is where the ground is STEEP and CONVEX, whatever the 10 m raster says; a ledge or a gully inside the
  // rock holds soil (heath) or its own talus (scree); the concave foot of a face is scree. vCurv.y: the 20 m Laplacian (m).
  float cv = vCurv.y;
  float steepE = smoothstep(38.0, 56.0, slope), flatE = 1.0 - smoothstep(16.0, 30.0, slope);
  float convexE = clamp(cv * 0.35, 0.0, 0.5) * smoothstep(18.0, 34.0, slope);
  float concE = clamp(-cv * 0.30, 0.0, 0.7);
  float rock = clamp(wR + steepE * 0.85 * (1.0 - wR) + convexE * (1.0 - wR) - flatE * 0.75 * wR, 0.0, 1.0);
  float scree = clamp(wS + concE * wR * (1.0 - steepE) + 0.25 * flatE * wR, 0.0, 1.0 - rock);
  float vegO = max(wF + wH, 1e-3), veg = max(1.0 - rock - scree, 0.0);
  wF = veg * wF / vegO; wH = veg * (wH + (vegO < 0.01 ? 1.0 : 0.0)) / max(vegO, 1e-3);
  wR = rock; wS = scree;
#endif
  float sCliff = smoothstep(32.0, 42.0, slope);
  float wC = wR * sCliff; wR *= 1.0 - sCliff;
  // THE TRIPLANAR WEIGHTS (splat_ground: one side weight |n.xz| against |n.y|, split x : z by nx^4 : nz^4, triK 8)
  vec2 a = pow(vec2(length(nTri.xz), abs(nTri.y)), vec2(8.0)); vec2 h2 = nTri.xz * nTri.xz; h2 *= h2;
  float f = h2.y / max(h2.x + h2.y, 1e-8);
  vec3 tw = vec3(a.x * (1.0 - f), a.y, a.x * f) / max(a.x + a.y, 1e-6);
#if TRI_MODE == 1
  // (b) BIPLANAR: the lightest plane dropped, the two left renormalised (and sharpened a touch, Quilez)
  { float mn = min(tw.x, min(tw.y, tw.z)); tw = max(tw - mn, 0.0); tw = pow(tw, vec3(1.3)); tw /= max(tw.x + tw.y + tw.z, 1e-6); }
#elif TRI_MODE == 2
  // (b) ONE PLANE: picked per pixel by its weight against a screen-space dither (interleaved gradient noise)
  { float r = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    tw = r < tw.x ? vec3(1.0, 0.0, 0.0) : (r < tw.x + tw.y ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0)); }
#endif
  float hexOn = float(${P.hex});
  // the types, each sampled where it weighs (>= 0.004), then height-blended (seam: 0.34 today, 0.12 crisp)
  Smp sH, sF, sS, sR, sC; float bH = 0.0, bF = 0.0, bS = 0.0, bR = 0.0, bC = 0.0;
  sH.c = vec4(0.0); sH.n = vec4(0.0); sF = sH; sS = sH; sR = sH; sC = sH;
  if (wH >= 0.004) sH = sType(0.0, 15.04, 15.0, P, tw, fw, hexOn);
  if (wF >= 0.004) sF = sType(1.0, 17.5, 81.0, P, tw, fw, hexOn);
  if (wS >= 0.004) sS = sType(2.0, 41.5, 90.0, P, tw, fw, hexOn);
#if ROCK_DETAIL
  if (wR >= 0.004) sR = sRock(4.0, 51.5, 120.0, P, tw, fw, d, hexOn);
  if (wC >= 0.004) sC = sRock(4.0, 51.5, 120.0, P, tw, fw, d, hexOn);
  const float SEAM = 0.12;
#else
  if (wR >= 0.004) sR = sType(3.0, 71.5, 79.0, P, tw, fw, hexOn);
#if FACESET
  // (the mesh way: the face's ground wears the rock meshes' own photograph at their scale - one material for the face,
  // the meshes only add the relief; FC5's cliff tool transferred the cliff's texture to the terrain under it the same way)
  if (wC >= 0.004) sC = sType(${ROCKSET_G}.0, ${ROCKSCALE_G}, ${ROCKSCALE_G}, P, tw, fw, hexOn);
#else
  if (wC >= 0.004) sC = sType(4.0, 51.5, 120.0, P, tw, fw, hexOn);
#endif
  const float SEAM = 0.34;
#endif
  float ma = -10.0;
  if (wH >= 0.004) ma = max(ma, sH.c.a + wH); if (wF >= 0.004) ma = max(ma, sF.c.a + wF); if (wS >= 0.004) ma = max(ma, sS.c.a + wS);
  if (wR >= 0.004) ma = max(ma, sR.c.a + wR); if (wC >= 0.004) ma = max(ma, sC.c.a + wC);
  ma -= SEAM;
  bH = wH >= 0.004 ? max(sH.c.a + wH - ma, 0.0) : 0.0; bF = wF >= 0.004 ? max(sF.c.a + wF - ma, 0.0) : 0.0;
  bS = wS >= 0.004 ? max(sS.c.a + wS - ma, 0.0) : 0.0; bR = wR >= 0.004 ? max(sR.c.a + wR - ma, 0.0) : 0.0;
  bC = wC >= 0.004 ? max(sC.c.a + wC - ma, 0.0) : 0.0;
  float tot = max(bH + bF + bS + bR + bC, 1e-5);
  vec3 col = (sH.c.rgb * bH + sF.c.rgb * bF + sS.c.rgb * bS + sR.c.rgb * bR + sC.c.rgb * bC) / tot;
  vec4 nrm = (sH.n * bH + sF.n * bF + sS.n * bS + sR.n * bR + sC.n * bC) / tot;
  float meanL = (uMean[0] * bH + uMean[1] * bF + uMean[2] * bS + uMean[${D.ROCK_DETAIL ? 4 : 3}] * bR + uMean[${D.FACESET ? ROCKSET_G : 4}] * bC) / tot;
  float rockB = (bR + bC) / tot;
#if EXPO
  // (c) MACRO VARIATION on the rock (lichen, oxide, the fresh scar): two octaves, 70 m and 260 m, value and a warm/cool turn
  { float m1 = fbm2(P.xz / 70.0 + P.y / 90.0), m2 = vnoise(P.xz / 260.0 + 3.7);
    vec3 warm = vec3(1.10, 1.0, 0.86), cool = vec3(0.90, 0.98, 1.08);
    col *= mix(vec3(1.0), mix(cool, warm, m2) * (0.78 + 0.44 * m1), rockB); }
  // WET STREAKS down the faces: a noise stretched down the fall line (the contour coordinate across, the height along),
  // stronger where the flow field gathers - dark, smoother
  { vec2 dn = normalize(nGeo.xz + 1e-4); float u = dot(P.xz, vec2(-dn.y, dn.x));
    float st = smoothstep(0.55, 0.85, vnoise(vec2(u / 2.2, P.y / 26.0)) * 0.7 + vFlow * 0.45) * smoothstep(35.0, 55.0, slope) * rockB;
    col *= 1.0 - 0.45 * st; nrm.w = mix(nrm.w, 0.35, st * 0.6); }
#endif
#if STRATA
  // STRATA (shader): beds of ~5 m warped by a noise (not contour lines); a band of value per bed, the bed's top a LEDGE -
  // the normal bent up over its last 12 %, the riser under it shaded - ALU only, no fetch. On the rock's faces only.
  { float steep = smoothstep(30.0, 48.0, slope) * rockB;
    if (steep > 0.01) {
      float warp = (fbm2(P.xz / 40.0 + P.y / 60.0) - 0.5) * 7.0 + (vnoise(P.xz / 60.0 + 4.0) - 0.5) * 9.0;
      float T = 8.0 + 8.0 * vnoise(P.xz / 60.0);
      float sy = (P.y + ${DIP.k.toFixed(4)} * dot(P.xz, vec2(${DIP.x.toFixed(4)}, ${DIP.z.toFixed(4)})) + warp) / T, bed = floor(sy), fr = sy - bed;
      float bedK = 0.12 + 0.88 * smoothstep(0.5, 0.85, hash1(vec2(bed, 7.7)));   // not every bed is a ledge (the skirt's law)
      col *= mix(1.0, 0.78 + 0.44 * hash1(vec2(bed, 3.1)), 0.7 * steep);
      float ledge = smoothstep(0.80, 0.96, fr) * bedK, under = (1.0 - smoothstep(0.0, 0.16, fr)) * bedK;
      vec3 out2 = normalize(vec3(nGeo.x, 0.0, nGeo.z) + 1e-4);
      nrm.xyz += (vec3(0.0, 2.6, 0.0) * ledge - out2 * 1.2 * under) * steep;
      col *= 1.0 - 0.5 * under * steep;
      col *= 1.0 + 0.25 * ledge * steep;
    } }
#endif
  // THE MACRO IN THE NEAR GROUND (splat_ground: macroNear 0.5, macroLum 0.55; 70 % less on the faces, 30-48 deg)
  vec3 mac = pow(vAlb, vec3(2.2)) * uMacExp;
  { float lc = luma3(col); float rel = lc / max(meanL, 1e-3); vec3 tinted = mac * mix(lc / max(luma3(mac), 1e-3), rel, 0.55);
    col = mix(col, tinted, 0.5 * (1.0 - 0.7 * smoothstep(30.0, 48.0, slope))); }
  float nf = 1.0 - smoothstep(250.0, 1400.0, d);
  gSN = nrm.xyz * 3.0 * nf;
  gSRough = clamp(nrm.w, 0.05, 1.0);
  return col;
}
`;
function groundMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.defines = Object.assign({}, D);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 aCodes; attribute vec2 aCurv; attribute float aFlow; attribute vec3 aAlb;
varying vec3 vW; varying vec4 vCodes; varying vec2 vCurv; varying float vFlow; varying vec3 vAlb; varying vec3 vNs;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vW = (modelMatrix * vec4(position, 1.0)).xyz; vCodes = aCodes; vCurv = aCurv; vFlow = aFlow; vAlb = aAlb; vNs = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_COMMON)
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 nS = normalize(vNs); diffuseColor.rgb = sSplat(nS); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = gSRough;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { vec3 pw = (viewMatrix * vec4(gSN, 0.0)).xyz; normal = normalize(normal + pw); }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
#if COUNT
  gl_FragColor = vec4(gCnt / 255.0, 1.0, 0.0, 1.0);
#endif`);
  };
  m.customProgramCacheKey = () => JSON.stringify(D);
  return m;
}
const gMat = groundMat();

// ---- the context: the island round the patch, coarse, the macro's colour (no splat) - so a still has a horizon ----------
{ const CN = 121, CS = 6000, cs = CS / (CN - 1), pos = new Float32Array(CN * CN * 3), col = new Float32Array(CN * CN * 3);
  // the context's heights are the patch's where it covers, a smooth fall to the sea level beyond (no island data in the page)
  for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) { const x = -CS / 2 + i * cs, z = -CS / 2 + j * cs, k = j * CN + i;
    const inside = Math.abs(x) < HALF - 10 && Math.abs(z) < HALF - 10;
    const e = Math.max(Math.abs(x), Math.abs(z)), hEdge = hXZ(Math.max(-HALF, Math.min(HALF, x)), Math.max(-HALF, Math.min(HALF, z)));
    const y = inside ? hXZ(x, z) - 80 : hEdge * Math.max(0, 1 - (e - HALF) / 1800) + 120 * (vn3(x / 700, 0, z / 700) - 0.3) * Math.min(1, (e - HALF) / 400);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; const c = [0.035, 0.05, 0.022]; col[k * 3] = c[0] * MACEXP; col[k * 3 + 1] = c[1] * MACEXP; col[k * 3 + 2] = c[2] * MACEXP; }
  const idx = []; for (let j = 0; j < CN - 1; j++) for (let i = 0; i < CN - 1; i++) { const a = j * CN + i; idx.push(a, a + CN, a + 1, a + 1, a + CN, a + CN + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // (the context hull is built but not drawn: at 50 m it poked through the patch's hollows; the haze is the horizon)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d3442, roughness: 0.3 }));
  sea.position.y = 0; scene.add(sea); }

// ---- (d) THE SCATTER: boulders and scree from the game's rock kits ----------------------------------------------------------
async function buildScatter() {
  // RULES (per candidate on a jittered 2 m lattice, CPU, once): a TALUS field - the concave foot of a face (a cell within
  // 35 m downhill of ground over 45 deg, slope under 40, the 20 m curvature negative) - takes many small and mid blocks; a
  // ROCKY SLOPE (rock or scree code, 22-45 deg) takes sparse mid and large blocks in CLUSTERS (a 40 m noise gates them);
  // none over 50 deg (they fall), few in forest. Size: a power law (many small, few large). Each block leans halfway to the
  // ground's normal, turned at random, sunk 35-50 % of its height; its colour is TINTED to the ground's rock at its foot
  // (instanceColor) and its foot darkened into the ground (the shader, below).
  const kitR = rk.kits.find(k => k.name === 'rocks'), kitC = rk.kits.find(k => k.name === 'coast_rocks_05');
  const loader = new THREE.TextureLoader();
  const tex = u => new Promise(r => loader.load(u, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; r(t); }, undefined, () => r(null)));
  const geoOf = p => { const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rbin, p.pos, p.nv * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rbin, p.nrm, p.nv * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rbin, p.uv, p.nv * 2), 2));
    g.setIndex(new THREE.BufferAttribute(p.wide ? new Uint32Array(rbin, p.idx, p.nt * 3) : new Uint16Array(rbin, p.idx, p.nt * 3), 1)); return g; };
  const mapR = await tex(kitR.subjects[0].parts[0].map), norR = await tex(kitR.subjects[0].parts[0].nor);
  const mapC = await tex(kitC.subjects[0].parts[0].map), norC = await tex(kitC.subjects[0].parts[0].nor);
  if (norR) norR.colorSpace = THREE.NoColorSpace; if (norC) norC.colorSpace = THREE.NoColorSpace;
  const rockMat = (map, nor) => { const m = new THREE.MeshStandardMaterial({ map, normalMap: nor, roughness: 0.95, metalness: 0 });
    m.onBeforeCompile = sh => {   // THE FOOT IN THE GROUND: the lowest 25 % of a block darkened toward the ground's own shade
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFoot; uniform float uH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoot = position.y / max(uH, 1e-3);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFoot;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.08, 0.45, vFoot));');
      sh.uniforms.uH = { value: m.userData.h || 1 }; };
    return m; };
  // candidates
  const cand = []; const R = Math.min(HALF - 20, 500);   // (the bench draws the middle kilometre: every view looks there)
  // steepness within 35 m uphill: a coarse map of max slope over a 7 x 7 vertex window, uphill-biased by height
  for (let z = -R; z < R; z += 2) for (let x = -R; x < R; x += 2) {
    const jx = x + (hh(Math.round(x * 3), Math.round(z * 3), 1) - 0.5) * 2, jz = z + (hh(Math.round(x * 3), Math.round(z * 3), 2) - 0.5) * 2;
    const sl = slopeAt(jx, jz); if (sl > 50) continue;
    const cR = sampleK(CODES, 4, 0, jx, jz) / 255, cS = sampleK(CODES, 4, 1, jx, jz) / 255, cF = sampleK(CODES, 4, 2, jx, jz) / 255;
    const cv = sampleK(CURV, 2, 1, jx, jz);
    // a face uphill: walk 35 m up the gradient and look for slope > 45
    const g = gradXZ(jx, jz, 3), gl2 = Math.hypot(g[0], g[1]) || 1e-6; let face = 0;
    for (let s = 5; s <= 35; s += 5) { const ux = jx + g[0] / gl2 * s, uz = jz + g[1] / gl2 * s; if (slopeAt(ux, uz) > 45) { face = 1 - s / 45; break; } }
    const talus = face * (sl < 42 ? 1 : 0) * (cv < 0.3 ? 1 : 0.4) * (1 - cF * 0.8);
    const clus = ss(0.40, 0.70, vn3(jx / 40, 0, jz / 40));
    const rocky = Math.max(cR, cS) * ss(18, 26, sl) * (1 - ss(44, 50, sl)) * clus * (1 - cF);
    // THE EDGE: where the raster's rock thins into heath (a 3 x 3 box share of 0.15-0.85) blocks break the blend's line
    const edge = (cR > 0.12 && cR < 0.88 ? 1 : 0) * (1 - ss(40, 50, sl)) * (1 - cF) * (0.4 + 0.6 * clus);
    const p = talus * 0.25 + rocky * 0.04 + edge * 0.10;
    if (hh(Math.round(jx * 7), Math.round(jz * 7), 3) < p) cand.push([jx, jz, talus > rocky * 0.16 ? 1 : 0, sl]);
  }
  // instances by subject
  const subs = kitR.subjects.map(s => ({ s, mat: rockMat(mapR, norR), list: [] })).concat([{ s: kitC.subjects[0], mat: rockMat(mapC, norC), list: [], group: 1 }]);
  const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), Qy = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), NN = new THREE.Vector3();
  for (const [x, z, isTalus, sl] of cand) {
    const r1 = hh(Math.round(x * 13), Math.round(z * 13), 5), r2 = hh(Math.round(x * 13), Math.round(z * 13), 6), r3 = hh(Math.round(x * 13), Math.round(z * 13), 7);
    const grp = !isTalus && r3 < 0.12;   // a rocky slope's cluster now and then is the scanned rock group
    const S = grp ? subs[subs.length - 1] : subs[Math.floor(r1 * (subs.length - 1))];
    // size: a power law - talus 0.4-2.5 m, slope blocks 1-5 m (height), the group 0.7-1.6 x its scan
    const pw = Math.pow(1 - r2, 3.0);
    const hTarget = grp ? S.s.h * (0.7 + 0.9 * r2) : (isTalus ? 0.5 + 2.5 * pw : 1.2 + 4.8 * pw);
    const k = hTarget / Math.max(S.s.h, 0.02);
    const g = gradXZ(x, z, 2); NN.set(-g[0], 1, -g[1]).normalize(); NN.lerp(UP, 0.5).normalize();
    Qn.setFromUnitVectors(UP, NN); Qy.setFromAxisAngle(UP, r1 * 6.2832 * 7.0); Qn.multiply(Qy);
    const bury = 0.35 + 0.15 * r3;
    V.set(x, hXZ(x, z) - hTarget * bury, z); SC.set(k * (0.8 + 0.4 * r3), k, k * (0.8 + 0.4 * r2));
    M.compose(V, Qn, SC);
    STAT.placed = (STAT.placed || 0) + 1;
    // THE RING (as the cover ring would draw it): small blocks to 250 m from the eye, blocks over 1.5 m to 600 m
    if (Math.hypot(x - camera.position.x, z - camera.position.z) > (hTarget < 1.5 ? 250 : 600)) continue;
    // the tint: the ground's rock at the foot - the macro's luminance over the kit's own (~0.18), clamped, a little warmth kept
    const ar = lin(sampleK(ALB, 3, 0, x, z)), ag = lin(sampleK(ALB, 3, 1, x, z)), ab = lin(sampleK(ALB, 3, 2, x, z));
    const la2 = (0.2126 * ar + 0.7152 * ag + 0.0722 * ab) * MACEXP;
    const t = Math.min(1.3, Math.max(0.45, la2 / 0.16));
    S.list.push([M.clone(), new THREE.Color(t * 0.97, t * 0.97, t * 0.94)]);
  }
  const root = new THREE.Group(); scene.add(root);
  for (const S of subs) { if (!S.list.length) continue; S.mat.userData.h = S.s.h;
    for (const part of S.s.parts) { const g = geoOf(part); const im = new THREE.InstancedMesh(g, S.mat, S.list.length);
      S.list.forEach((e, i) => { im.setMatrixAt(i, e[0]); im.setColorAt(i, e[1]); });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere(); root.add(im); STAT.rockDraws++; STAT.rockTris += part.nt * S.list.length; }
    STAT.rocks += S.list.length; }
}

// ---- THE MESH WAY (?mesh=1): the procedural rock kit (rock_kit.js) on the cliffs and the slopes, instanced ------------------
// ?mesh=1 everything | ?mesh=cliff the cliff cover alone | ?mesh=scatter outcrops + talus + edge alone | ?kit=1 the kit on a stand
// ?rset=cliff|darkRock|rocksG the rock's set (default cliff: Poly Haven's rock face, 6.86 m - the game's own 'cliff' layer)
const ROCKSET = { cliff: 3, darkRock: 5, rocksG: 2 }[Q.get('rset') || 'cliff'] ?? 3;
const ROCKSCALE = { 3: 6.86, 5: 2.0, 2: 2.03 }[ROCKSET];
// THE ROCK'S MATERIAL. One photograph does everything: its colour, its normal map and its height, read with the SAME
// coordinates on each of three object-space projections (triplanar, the planes blended by the object normal^4), the normal
// map's xy put on each plane's own axes (Golus' whiteout swizzle) - so a crack in the colour IS a crack in the light.
// On top of it, all three tied to the same texels: the crease (aRock.x, the shape's own concavity) darkens; MOSS takes the
// faces that look up, height-blended by the photograph's own height (the moss fills the low texels first, the bumps stay
// bare) in the open ground's colour (grassRock, read from above); the foot (aRock.y under ~0.2) darkens into the ground;
// the instance colour is the island's macro at the rock's foot (the Landsat albedo, as the ground's macro tint).
function rockMat(texScale) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, { uRS: { value: texScale }, uRL: { value: ROCKSET } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec2 aRock; varying vec3 vObj; varying vec3 vObjN; varying vec2 vRock; varying vec3 vBX, vBY, vBZ;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  { mat3 im = mat3(instanceMatrix); vec3 isc = vec3(length(im[0]), length(im[1]), length(im[2]));
    vObj = position * isc; vObjN = normalize(normal / isc); vRock = aRock;
    vBX = normalMatrix * (im[0] / (isc.x * isc.x)); vBY = normalMatrix * (im[1] / (isc.y * isc.y)); vBZ = normalMatrix * (im[2] / (isc.z * isc.z)); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform highp sampler2DArray uA, uN; uniform vec4 uGrade[${NL}], uGr2[${NL}]; uniform float uMean[${NL}], uMean0[${NL}]; uniform vec3 uGrassC;
uniform float uRS, uRL; varying vec3 vObj; varying vec3 vObjN; varying vec2 vRock; varying vec3 vBX, vBY, vBZ;
float gRR = 1.0; vec3 gRN = vec3(0.0, 1.0, 0.0); float gCnt = 0.0;
float luma3(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec4 rA(vec2 uv, float L){ gCnt += 1.0; vec4 c = texture(uA, vec3(uv, L)); c.rgb = pow(c.rgb, vec3(2.2));
  int li = int(L + 0.5); vec4 g = uGrade[li]; vec4 g2 = uGr2[li];
  if (g2.x != 1.0) c.rgb = max(vec3(uMean0[li]) + (c.rgb - vec3(uMean0[li])) * g2.x, vec3(0.0));
  c.rgb *= g.rgb; float l = luma3(c.rgb); c.rgb = mix(vec3(l), c.rgb, g.a); return c; }
vec4 rN(vec2 uv, float L){ gCnt += 1.0; return texture(uN, vec3(uv, L)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 N = normalize(vObjN); vec3 w = pow(abs(N), vec3(4.0)); w /= w.x + w.y + w.z;
    vec3 p = vObj / uRS;
    vec4 cx = vec4(0.0), cy = vec4(0.0), cz = vec4(0.0); vec4 nx = vec4(0.5, 0.5, 1.0, 1.0), ny = nx, nz = nx;
    if (w.x > 0.02) { cx = rA(p.zy, uRL); nx = rN(p.zy, uRL); }
    if (w.y > 0.02) { cy = rA(p.xz + 0.37, uRL); ny = rN(p.xz + 0.37, uRL); }
    if (w.z > 0.02) { cz = rA(p.xy + 0.71, uRL); nz = rN(p.xy + 0.71, uRL); }
    vec4 col = cx * w.x + cy * w.y + cz * w.z;
    vec3 tX = nx.xyz * 2.0 - 1.0, tY = ny.xyz * 2.0 - 1.0, tZ = nz.xyz * 2.0 - 1.0;
    tX.xy *= 1.6; tY.xy *= 1.6; tZ.xy *= 1.6;   // (the photograph's relief, a touch stronger: the rock is seen from metres to hundreds)
    vec3 nX = vec3(tX.xy + N.zy, abs(tX.z) * N.x).zyx, nY = vec3(tY.xy + N.xz, abs(tY.z) * N.y).xzy, nZ = vec3(tZ.xy + N.xy, abs(tZ.z) * N.z);
    gRN = normalize(nX * w.x + nY * w.y + nZ * w.z);
    gRR = nx.a * w.x + ny.a * w.y + nz.a * w.z;
    float h = col.a;
    col.rgb *= mix(1.0, 0.75, clamp(vRock.x * 2.5, 0.0, 1.0));   // the crease
    // moss on what looks up (the world normal of the shape, before the map), filling the low texels first
    vec3 nW = inverseTransformDirection(normalize(vBX * N.x + vBY * N.y + vBZ * N.z), viewMatrix);
    float up = smoothstep(0.62, 0.92, nW.y);
    if (up > 0.01) { vec4 g = rA(vObj.xz / 7.0 + 0.13, 0.0);
      float mk = clamp((up * 0.95 - h) * 3.0, 0.0, 1.0) * 0.85;
      col.rgb = mix(col.rgb, g.rgb, mk); gRR = mix(gRR, 0.95, mk); }
    col.rgb *= mix(0.8, 1.0, smoothstep(0.0, 0.22, vRock.y));   // the foot
    diffuseColor.rgb = col.rgb;
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(gRR, 0.3, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize(vBX * gRN.x + vBY * gRN.y + vBZ * gRN.z);`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
#if COUNT
  gl_FragColor = vec4(gCnt / 255.0, 1.0, 0.0, 1.0);
#endif`);
  };
  m.defines = { COUNT: D.COUNT };
  m.customProgramCacheKey = () => 'rock' + texScale + D.COUNT;
  return m;
}
let KIT = null;
const kitOf = () => KIT || (KIT = ROCK_KIT.make(THREE, { seeds: 4 }));
// THE INSTANCES -> one InstancedMesh per (variant, LOD rung) - the trees' ladder: rung by the distance to the eye, measured
// once per still (a game would re-bin per cell as the eye moves, as the cover ring does)
function drawKit(list) {
  // list: [variant, matrix, colour, dist, small]
  // the ladder (m): ?eco=1 is the phone's - every rung at about half the distance, the far cull at 900 m
  const ECO = Q.get('eco') === '1';
  const L0 = ECO ? { cliff: 60, other: 30 } : { cliff: 140, other: 60 }, L1 = ECO ? 160 : 350, L2 = ECO ? 400 : 800, CULL = ECO ? 900 : 1400;
  const bins = new Map();
  for (const [v, M, c, d] of list) {
    if (d > CULL) continue;
    const lod = d < (v.arch === 'cliff' ? L0.cliff : L0.other) ? 0 : (d < L1 ? 1 : (d < L2 ? 2 : 3));
    const k = v.arch + v.seed + '#' + lod; let b = bins.get(k); if (!b) { b = { v, lod, items: [] }; bins.set(k, b); } b.items.push([M, c]);
  }
  const matC = rockMat(ROCKSCALE * 1.6), matS = rockMat(ROCKSCALE * 0.6);
  const root = new THREE.Group(); scene.add(root);
  for (const b of bins.values()) {
    const im = new THREE.InstancedMesh(b.v.lods[b.lod], b.v.arch === 'cliff' ? matC : matS, b.items.length);
    b.items.forEach((e, i) => { im.setMatrixAt(i, e[0]); im.setColorAt(i, e[1]); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere(); root.add(im);
    STAT.meshDraws = (STAT.meshDraws || 0) + 1; STAT.meshTris = (STAT.meshTris || 0) + b.v.tris[b.lod] * b.items.length;
    STAT['lod' + b.lod] = (STAT['lod' + b.lod] || 0) + b.items.length;
  }
  return root;
}
const tintAt = (x, z, k = 1) => {
  const ar = lin(sampleK(ALB, 3, 0, x, z)), ag = lin(sampleK(ALB, 3, 1, x, z)), ab = lin(sampleK(ALB, 3, 2, x, z));
  const l = (0.2126 * ar + 0.7152 * ag + 0.0722 * ab) * MACEXP, t = (1 + (Math.min(1.4, Math.max(0.6, l / 0.13)) - 1) * 0.3) * k;
  // the macro's light a third and its hue a tenth (the photograph keeps its own colour: it is the ground's too)
  const m = Math.max(1e-4, (ar + ag + ab) / 3);
  return new THREE.Color(t * (0.9 + 0.1 * ar / m), t * (0.9 + 0.1 * ag / m), t * (0.9 + 0.1 * ab / m));
};
function placeMeshRocks(which) {
  const kit = kitOf(), byArch = a => kit.filter(v => v.arch === a);
  const CL = byArch('cliff'), BL = byArch('block'), BO = byArch('boulder'), SL = byArch('slab');
  const list = [], cam = camera.position, R = 700;
  const occ = new Map(); const ocell = 4;   // a coarse occupancy grid: no two pieces on one spot
  const free = (x, z, r) => { const i0 = Math.floor((x - r) / ocell), i1 = Math.floor((x + r) / ocell), j0 = Math.floor((z - r) / ocell), j1 = Math.floor((z + r) / ocell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const o = occ.get(i * 65536 + j); if (o && o > 0.5) return false; } return true; };
  const take = (x, z, r) => { const i0 = Math.floor((x - r) / ocell), i1 = Math.floor((x + r) / ocell), j0 = Math.floor((z - r) / ocell), j1 = Math.floor((z + r) / ocell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) occ.set(i * 65536 + j, 1); };
  const M = new THREE.Matrix4(), Xa = new THREE.Vector3(), Ya = new THREE.Vector3(), Za = new THREE.Vector3(), V = new THREE.Vector3();
  const rand = (x, z, s) => hh(Math.round(x * 3.7), Math.round(z * 3.7), s);
  // 1. THE CLIFF COVER - shards laid ON the face, overlapping like scales: x along the contour, y up the fall line, z out of
  //    the face; each turned a little steeper than the ground (delta 4-16 deg, so its lower end stands proud: a step) and
  //    sunk so 1-3 m of it stands out. The steepest first, each claiming its footprint. The DEM's face is the base they
  //    stand on: nothing has to match a scan's own ground (the mesa of cliffs.js), the shard IS the face's relief.
  if (which !== 'scatter') {
    const C = [];
    // random points (not a lattice: a lattice shows as rows), ~1 per 30 m2
    const NC = Math.round((2 * R) * (2 * R) / 25);
    for (let q = 0; q < NC; q++) {
      const jx = -R + 2 * R * hh(q, 17, 1), jz = -R + 2 * R * hh(q, 17, 2);
      if (Math.hypot(jx - cam.x, jz - cam.z) > R + 300) continue;
      // the slope over 12 m: over 5-6 m the radar DEM's own steps show, and the shards came out in rows along the contours
      const g = gradXZ(jx, jz, 12), s = Math.atan(Math.hypot(g[0], g[1])) * 180 / Math.PI;
      const cR = sampleK(CODES, 4, 0, jx, jz) / 255;
      const pr = Math.min(1, ss(34, 46, s) * (0.5 + 0.5 * cR) + ss(28, 40, s) * cR * 0.5) * (0.55 + 0.9 * (vn3(jx / 50, 5, jz / 50) - 0.5) + 0.45);
      if (pr > 0.15 && rand(jx, jz, 3) < pr) C.push([jx, jz, s, g]);
    }
    C.sort((a, b) => b[2] - a[2]);
    for (const [x, z, s, g] of C) {
      const r = rand(x, z, 4), r2 = rand(x, z, 5), r3 = rand(x, z, 6);
      // the size: a power law - a few big shards (to 40 m) carry the face, many small ones fill between
      const pw = Math.pow(r, 1.5), w = 10 + 25 * pw, hgt = w * (0.45 + 0.35 * r2), th = 0.35 * w;
      if (!free(x, z, w * 0.16)) continue;   // (they OVERLAP heavily, like scales: the claim is an eighth of the width)
      take(x, z, w * 0.16);
      const v = CL[Math.floor(r2 * 97) % CL.length];
      const gl = Math.hypot(g[0], g[1]) || 1e-6, dnx = -g[0] / gl, dnz = -g[1] / gl, sr = s * Math.PI / 180;
      const dl = (2 + 10 * r3) * Math.PI / 180, f = Math.min(sr + dl, 1.48);   // the shard's face angle
      Ya.set(-dnx * Math.cos(f), Math.sin(f), -dnz * Math.cos(f));               // up its length: up the fall line, steeper
      Za.set(dnx * Math.sin(f), Math.cos(f), dnz * Math.sin(f));                 // out of its face
      Xa.crossVectors(Ya, Za).normalize();
      // not all square to the fall line: turned about the face's normal (+-20 deg) and about the vertical (+-25 deg)
      { const q1 = new THREE.Quaternion().setFromAxisAngle(Za, (rand(x, z, 7) - 0.5) * 0.7), q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand(x, z, 8) - 0.5) * 0.87);
        q1.premultiply(q2); Xa.applyQuaternion(q1); Ya.applyQuaternion(q1); Za.applyQuaternion(q1); }
      const sx = w / v.size[0], sy = hgt / v.size[1], sz = th / v.size[2];
      const bb = v.lods[0].boundingBox, zf = bb.max.z * sz, out = 0.5 + 0.075 * w;   // the front's reach, what stands out
      const y0 = hXZ(x, z);
      // origin: the base end a third of its length below the point, sunk along the face's normal so `out` m stands proud
      V.set(x, y0, z).addScaledVector(Ya, -0.45 * hgt).addScaledVector(Za, -(zf - out));
      M.makeBasis(Xa.clone().multiplyScalar(sx), Ya.clone().multiplyScalar(sy), Za.clone().multiplyScalar(sz)); M.setPosition(V);
      list.push([v, M.clone(), tintAt(x, z, 1.0), Math.hypot(x - cam.x, z - cam.z)]);
    }
    STAT.shards = list.length;
  }
  // 2. OUTCROPS, TALUS, THE EDGE - the scatter's rules (test d) with the kit's blocks, boulders and slabs
  if (which !== 'cliff') {
    const n0 = list.length;
    for (let z = -R; z < R; z += 2.5) for (let x = -R; x < R; x += 2.5) {
      const jx = x + (rand(x, z, 11) - 0.5) * 2.4, jz = z + (rand(x, z, 12) - 0.5) * 2.4;
      const d = Math.hypot(jx - cam.x, jz - cam.z); if (d > R + 300) continue;
      const sl = slopeAt(jx, jz); if (sl > 48) continue;
      const cR = sampleK(CODES, 4, 0, jx, jz) / 255, cS = sampleK(CODES, 4, 1, jx, jz) / 255, cF = sampleK(CODES, 4, 2, jx, jz) / 255;
      const cv = sampleK(CURV, 2, 1, jx, jz);
      const g = gradXZ(jx, jz, 3), gl2 = Math.hypot(g[0], g[1]) || 1e-6; let face = 0;
      for (let s = 5; s <= 40; s += 5) { const ux = jx + g[0] / gl2 * s, uz = jz + g[1] / gl2 * s; if (slopeAt(ux, uz) > 44) { face = 1 - s / 50; break; } }
      const clus = ss(0.38, 0.68, vn3(jx / 35, 0, jz / 35));
      const talus = face * (sl < 42 ? 1 : 0) * (cv < 0.4 ? 1 : 0.4) * (1 - cF * 0.85);
      const outcrop = Math.max(cR, cS * 0.6) * ss(20, 30, sl) * clus * (1 - cF) * (cv > -0.2 ? 1 : 0.3);
      const ce = cR + (vn3(jx / 9, 2, jz / 9) - 0.5) * 0.6;   // (the raster's line, broken by a 9 m noise: else the blocks stand in rows along it)
      const edge = (ce > 0.2 && ce < 0.8 ? 1 : 0) * (1 - cF) * clus;
      const pT = talus * 0.14 * (0.3 + 0.7 * clus), pO = outcrop * 0.05, pE = edge * 0.035;
      const r = rand(jx, jz, 13); let kind = null;
      if (r < pT) kind = 'talus'; else if (r < pT + pO) kind = 'outcrop'; else if (r < pT + pO + pE) kind = 'edge'; else continue;
      const r1 = rand(jx, jz, 14), r2 = rand(jx, jz, 15), r3 = rand(jx, jz, 16), pw = Math.pow(1 - r2, 2.6);
      const pool = kind === 'outcrop' ? (r1 < 0.6 ? BL : BO) : (kind === 'talus' ? (r1 < 0.35 ? SL : (r1 < 0.7 ? BL : BO)) : (r1 < 0.5 ? BO : BL));
      const v = pool[Math.floor(r3 * 97) % pool.length];
      const hT = kind === 'outcrop' ? 1.2 + 4.5 * pw : (kind === 'talus' ? 0.35 + 2.4 * pw : 0.6 + 2.8 * pw);
      if (hT > 1.4 && !free(jx, jz, hT * 0.5)) continue; if (hT > 1.4) take(jx, jz, hT * 0.45);
      const k = hT / v.size[1];
      // lean halfway to the ground, turned at random, sunk 25-45 % (a talus block sits, an outcrop is rooted)
      const nY = new THREE.Vector3(-g[0], 1, -g[1]).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.5).normalize();
      const Q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nY).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r1 * 40));
      const bury = kind === 'outcrop' ? 0.35 + 0.15 * r3 : 0.22 + 0.15 * r3;
      const S3 = new THREE.Vector3(k * (0.8 + 0.5 * r3), k, k * (0.8 + 0.5 * r1));
      M.compose(new THREE.Vector3(jx, hXZ(jx, jz) - hT * bury, jz), Q1, S3);
      list.push([v, M.clone(), tintAt(jx, jz), d, hT < 1.4]);
    }
    STAT.blocks = list.length - n0;
    // small blocks give up first: a block under 1.4 m beyond 300 m is not drawn (the ladder's last rung would be a pixel)
    const SMALL = Q.get('eco') === '1' ? 150 : 300;
    for (let i = list.length - 1; i >= n0; i--) if (list[i][4] && list[i][3] > SMALL) list.splice(i, 1);
    STAT.blocksDrawn = list.length - n0;
  }
  return drawKit(list);
}
function kitStand() {
  // ?kit=1: the kit on a flat stand at the patch's centre, every variant at its finest rung, in a 4 x 4 grid
  const kit = kitOf(), cy = 2000; const list = [];
  const stand = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f5a2a, roughness: 1 }));
  stand.position.set(0, cy, 0); stand.receiveShadow = true; scene.add(stand);
  kit.forEach((v, i) => { const col = i % 4, row = Math.floor(i / 4), sz = v.arch === 'cliff' ? 9 : (v.arch === 'slab' ? 4 : 3.5);
    const k = sz / Math.max(v.size[0], v.size[2]);
    const M = new THREE.Matrix4().compose(new THREE.Vector3((col - 1.5) * 13, cy - 0.15, (row - 1.5) * 13), new THREE.Quaternion(), new THREE.Vector3(k, k, k));
    list.push([v, M, new THREE.Color(1, 1, 1), 0]); });
  camera.position.set(0, cy + 17, 34); camera.lookAt(0, cy + 1, -2); camera.updateMatrixWorld();
  sun.target.position.set(0, cy, 0); sun.position.set(0, cy, 0).addScaledVector(SUN, 300); sun.target.updateMatrixWorld();
  const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 10; sc.far = 800; sc.updateProjectionMatrix();
  scene.fog.density = 0.00002;
  return drawKit(list);
}

// ---- the views ---------------------------------------------------------------------------------------------------------
// face: the steepest 40 m disc in the patch's middle 700 m, seen from 230 m down its fall line, 70 m over it
let best = null;
for (let z = -350; z <= 350; z += 10) for (let x = -350; x <= 350; x += 10) {
  let s = 0; for (let a = 0; a < 6; a++) s += slopeAt(x + 20 * Math.cos(a), z + 20 * Math.sin(a)); s /= 6;
  if (!best || s > best[2]) best = [x, z, s]; }
const fg = gradXZ(best[0], best[1], 15), fgl = Math.hypot(fg[0], fg[1]), dnX = -fg[0] / fgl, dnZ = -fg[1] / fgl;
// slope: a rocky slope (rock code > 0.5, 26-38 deg) nearest the face, seen from 70 m
let sl2 = null;
for (let z = -400; z <= 400; z += 10) for (let x = -400; x <= 400; x += 10) {
  const s = slopeAt(x, z), c = sampleK(CODES, 4, 0, x, z) / 255; if (c < 0.6 || s < 26 || s > 38) continue;
  const dd = Math.hypot(x - best[0], z - best[1]); if (!sl2 || dd < sl2[2]) sl2 = [x, z, dd]; }
const VIEWS = {
  face: () => { const tx = best[0], tz = best[1], ty = hXZ(tx, tz); const ex = tx + dnX * 230 + dnZ * 60, ez = tz + dnZ * 230 - dnX * 60;
    return [[ex, Math.max(hXZ(ex, ez) + 30, ty + 55), ez], [tx, ty + 5, tz]]; },
  near: () => { const tx = best[0], tz = best[1], ty = hXZ(tx, tz); const ex = tx + dnX * 105 + dnZ * 35, ez = tz + dnZ * 105 - dnX * 35;
    return [[ex, Math.max(hXZ(ex, ez) + 12, ty + 10), ez], [tx, ty + 10, tz]]; },
  slope: () => { const tx = sl2[0], tz = sl2[1], ty = hXZ(tx, tz); const g = gradXZ(tx, tz, 10), l = Math.hypot(g[0], g[1]); const ex = tx - g[0] / l * 70, ez = tz - g[1] / l * 70;
    return [[ex, Math.max(hXZ(ex, ez) + 14, ty + 18), ez], [tx, ty, tz]]; },
  ground: () => { const tx = sl2[0], tz = sl2[1], ty = hXZ(tx, tz); const g = gradXZ(tx, tz, 10), l = Math.hypot(g[0], g[1]); const ex = tx - g[0] / l * 30, ez = tz - g[1] / l * 30;
    return [[ex, hXZ(ex, ez) + 2.2, ez], [tx, ty + 6, tz]]; },
  top: () => { const tx = best[0], tz = best[1], ty = hXZ(tx, tz); return [[tx + 0.1, ty + 700, tz + 0.1], [tx, ty, tz]]; },
  high: () => { const tx = best[0] - dnX * 60, tz = best[1] - dnZ * 60, ty = hXZ(tx, tz); const ex = tx + dnX * 620 - dnZ * 160, ez = tz + dnZ * 620 + dnX * 160;
    return [[ex, Math.max(ty, hXZ(ex, ez)) + 520, ez], [tx, ty - 80, tz]]; },
};
// the sun: raking the face from its side, 32 deg up (the same for every view and variant)
const sAz = Math.atan2(dnZ, dnX) + 1.1, sEl = 32 * Math.PI / 180;
const SUN = new THREE.Vector3(Math.cos(sAz) * Math.cos(sEl), Math.sin(sEl), Math.sin(sAz) * Math.cos(sEl));
function setView(name) {
  const [e, t] = (VIEWS[name] || VIEWS.face)();
  camera.position.set(e[0], e[1], e[2]); camera.lookAt(t[0], t[1], t[2]); camera.updateMatrixWorld();
  const c = new THREE.Vector3(t[0], t[1], t[2]);
  sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUN, 1500); sun.target.updateMatrixWorld();
  const r = name === 'high' ? 700 : (name === 'face' ? 330 : 180);
  const sc = sun.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 100; sc.far = 3500; sc.updateProjectionMatrix();
}
setView(P.view);
SKX = camera.position.x; SKZ = camera.position.z; SKR = 700;
const base = new THREE.Mesh(buildBase(), gMat); base.castShadow = true; base.receiveShadow = true; scene.add(base);
const STAT = { skirtCells: 0, skirtTris: 0, rocks: 0, rockTris: 0, rockDraws: 0 };
if (P.skirt > 0) { const s = buildSkirt(P.skirt); const m = new THREE.Mesh(s.g, gMat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  STAT.skirtCells = s.cells; STAT.skirtTris = s.g.index.count / 3; }
if (P.scatter) await buildScatter();
if (Q.get('mesh')) placeMeshRocks(Q.get('mesh') === '1' ? 'all' : Q.get('mesh'));
if (Q.get('kit') === '1') { base.visible = false; kitStand(); }

// ---- the API the shot script drives --------------------------------------------------------------------------------------
const render = () => renderer.render(scene, camera);
render(); gl.finish();
async function measure(n = 10) {
  const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); render(); gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); t.push(performance.now() - a); }
  t.sort((a, b) => a - b); return { median: t[n >> 1], min: t[0], max: t[n - 1] };
}
function counts() {   // ?count=1: the mean texture fetches per GROUND pixel (the green flag), and the share of the frame
  render(); const w = P.w, h = P.h, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let n = 0, s = 0, mx = 0; for (let i = 0; i < w * h; i++) if (px[i * 4 + 1] > 128 && px[i * 4 + 2] < 64) { n++; s += px[i * 4]; mx = Math.max(mx, px[i * 4]); }
  return { groundPx: n / (w * h), fetchesPerPx: n ? s / n : 0, maxFetches: mx };
}
const info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs.length,
  stat: STAT, P, view: P.view, faceSlope: best[2], sun: SUN.toArray(), macExp: MACEXP, loadMs: Math.round(performance.now() - T0) });
function fragSource() { const pr = renderer.info.programs.find(p => p.cacheKey && p.cacheKey.indexOf('ROCK_DETAIL') >= 0);
  if (!pr || !pr.program) return null;
  const sh = gl.getAttachedShaders(pr.program).find(x => gl.getShaderParameter(x, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER); if (!sh) return null;
  const ext = gl.getExtension('WEBGL_debug_shaders');
  let src = ext ? ext.getTranslatedShaderSource(sh) : ''; const translated = !!src; if (!src) src = gl.getShaderSource(sh);
  return { chars: src.length, lines: src.split('\n').length, textureSites: (src.match(/texture\s*\(/g) || []).length, translated }; }
window.BENCH = { ready: true, render, measure, counts, info, setView, fragSource, scene, camera, THREE };
render();
msg(`rock=${P.rock} tri=${P.tri} expo=${P.expo} strata=${P.strata} scatter=${P.scatter} skirt=${P.skirt} view=${P.view} | ${renderer.info.render.calls} draws, ${(renderer.info.render.triangles / 1000).toFixed(0)} k tris`);
})().catch(e => { document.getElementById('msg').textContent = 'failed: ' + e.message + '\n' + e.stack; window.BENCH = { ready: false, error: String(e) }; });
