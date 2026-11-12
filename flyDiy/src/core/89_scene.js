// ============================================================
// THE SCENE (PHOTO-MODE-2 P0, 2026-11-11): one picture's whole setting as a small file - the camera, the time and the
// weather, the plane (its build inline), its pose, the picture's quality and size. ONE format for the player's photo
// bar and for Claude's headless rigs (tools/scene_shot.js, P5). Design: futureDesigns/PHOTO-MODE-2-2026-11-11.md §3;
// the JSON Schema beside it (photo-mode-2/scene.schema.json) - GATE SCENE holds the two to the same enums.
// Pure: no THREE, no DOM, no world. What lives here:
//   sceneNormalise(doc)         -> { ok, scene, errors, warnings }: a parsed scene, its ranges clamped, unknown fields kept
//   sceneToWorld(cam, anchor)   -> { eye, target }: a plane-anchored camera into world metres (anchor = { cg, hdg })
//   sceneFromWorld(eye, target, anchor) -> { eye, target }: the reverse (what the bar saves)
//   sceneOutputSize(q, win)     -> [w, h]: the saved picture's size (the window's by default; the user, 11 Nov)
//   scenePngPut(png, bytes, z)  -> a new PNG with the scene in its one `iTXt` chunk (z: the bytes are a zlib stream)
//   scenePngGet(png)            -> { bytes, compressed } | null
// The compression itself is the caller's (CompressionStream('deflate') in a page, zlib in node): both write the zlib
// stream iTXt's method 0 names, and the core stays free of either.
// ============================================================
const SCENE_WHAT = 'wingsmith-scene', SCENE_V = 1, SCENE_PNG_KEY = 'wingsmith-scene';
// THE HIGH-QUALITY SHOT'S HARD CAP (the user, 11 Nov: "let's cap it under 1 minute at least"): past it the shot is
// taken with whatever has streamed in, and the report says how far it got. Seconds, from the shutter to the file.
const SCENE_HQ_CAP_S = 55;
const SCENE_ENUMS = {
  site: ['garage', 'flight'],
  worldKind: ['island', 'analytic'],
  anchor: ['plane', 'world'],
  mode: ['free', 'orbit', 'chase', 'cockpit', 'wing', 'tower'],
  timePreset: ['dawn', 'morning', 'noon', 'afternoon', 'golden', 'sunset', 'dusk', 'night'],
  where: ['ground', 'water', 'air', 'stand'],
  propLook: ['still', 'blur'],
  rung: ['auto', 'A', 'B', 'C', 'D', 'E'],
  door: ['open', 'closed'],
};
// the picture's sizes the bar offers (null = the window's), and the largest side a shot may ask for
const SCENE_SIZES = [null, [1920, 1080], [2560, 1440], [3840, 2160]];
const SCENE_MAX_SIDE = 8192;

function sceneNormalise(doc) {
  const errors = [], warnings = [];
  if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch (e) { return { ok: false, scene: null, errors: ['not JSON: ' + e.message], warnings }; } }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, scene: null, errors: ['not an object'], warnings };
  if (doc.what !== SCENE_WHAT) errors.push('what: "' + SCENE_WHAT + '" expected, got ' + JSON.stringify(doc.what));
  if (doc.v !== SCENE_V) errors.push('v: ' + SCENE_V + ' expected, got ' + JSON.stringify(doc.v) + (typeof doc.v === 'number' && doc.v > SCENE_V ? ' (a newer game wrote it)' : ''));
  const S = JSON.parse(JSON.stringify(doc));   // a copy: unknown fields ride along and are written back
  const num = (o, k, lo, hi, where) => {
    if (!o || o[k] == null) return;
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) { errors.push(where + '.' + k + ': a number expected'); return; }
    if (o[k] < lo || o[k] > hi) { const c = Math.min(hi, Math.max(lo, o[k])); warnings.push(where + '.' + k + ' ' + o[k] + ' -> ' + c); o[k] = c; }
  };
  const vec = (o, k, where, nulls) => {
    if (!o || o[k] == null) return;
    const v = o[k];
    if (!Array.isArray(v) || v.length !== 3 || !v.every(x => (nulls && x === null) || (typeof x === 'number' && Number.isFinite(x))))
      errors.push(where + '.' + k + ': [x, y, z] expected' + (nulls ? ' (numbers or null)' : ''));
  };
  const one = (o, k, list, where) => { if (o && o[k] != null && list.indexOf(o[k]) < 0) errors.push(where + '.' + k + ': one of ' + list.join(' / ') + ', got ' + JSON.stringify(o[k])); };
  const obj = (k) => { if (S[k] != null && (typeof S[k] !== 'object' || Array.isArray(S[k]))) { errors.push(k + ': an object expected'); S[k] = null; } return S[k]; };
  one(S, 'site', SCENE_ENUMS.site, 'scene');
  const W = obj('world'); if (W) one(W, 'kind', SCENE_ENUMS.worldKind, 'world');
  const C = obj('camera');
  if (C) {
    one(C, 'anchor', SCENE_ENUMS.anchor, 'camera'); one(C, 'mode', SCENE_ENUMS.mode, 'camera');
    vec(C, 'eye', 'camera'); vec(C, 'target', 'camera');
    num(C, 'roll', -180, 180, 'camera'); num(C, 'fov', 10, 100, 'camera');
    if (C.eye && C.target && C.eye.every((x, i) => x === C.target[i])) errors.push('camera: the eye is ON the target');
  }
  const T = obj('time');
  if (T) {
    if (T.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(T.date)) errors.push('time.date: YYYY-MM-DD expected');
    num(T, 'localHours', 0, 24, 'time'); num(T, 'utc', 0, 24, 'time'); one(T, 'preset', SCENE_ENUMS.timePreset, 'time');
  }
  const Wx = obj('weather');
  if (Wx) { num(Wx, 'cloudCover', 0, 1, 'weather'); if (Wx.wind) { num(Wx.wind, 'kts', 0, 120, 'weather.wind'); num(Wx.wind, 'gust', 0, 5, 'weather.wind'); } }
  const G = obj('garage'); if (G) { one(G, 'door', SCENE_ENUMS.door, 'garage'); if (S.site !== 'garage') warnings.push('garage: set, but the site is ' + (S.site || 'flight') + ' (ignored)'); }
  const Pl = obj('plane');
  if (Pl && Pl.build != null) {
    const b = Pl.build;
    if (typeof b !== 'object' || Array.isArray(b)) errors.push('plane.build: the garage\'s build envelope (or a bare spec) expected');
    else if (b.what != null && b.what !== 'flydiy-build') errors.push('plane.build.what: "flydiy-build" expected');
  }
  const Po = obj('pose');
  if (Po) {
    one(Po, 'where', SCENE_ENUMS.where, 'pose'); vec(Po, 'at', 'pose', true);
    num(Po, 'agl', 0, 5000, 'pose'); num(Po, 'pitch', -90, 90, 'pose'); num(Po, 'roll', -180, 180, 'pose');
    if (Po.hdg != null) { if (typeof Po.hdg !== 'number' || !Number.isFinite(Po.hdg)) errors.push('pose.hdg: a number expected'); else Po.hdg = ((Po.hdg % 360) + 360) % 360; }
    if (Po.where === 'air' && Po.at && Po.at[1] == null && Po.agl == null) errors.push('pose: in the air, at[1] or agl is needed');
    const K = Po.controls;
    if (K) { for (const k of ['elevator', 'aileron', 'rudder']) num(K, k, -1, 1, 'pose.controls'); for (const k of ['flaps', 'gear', 'throttle']) num(K, k, 0, 1, 'pose.controls'); }
    if (Po.prop) { one(Po.prop, 'look', SCENE_ENUMS.propLook, 'pose.prop'); num(Po.prop, 'rpm', 0, 10000, 'pose.prop'); }
    num(Po, 'canopy', 0, 1, 'pose');
  }
  const Q = obj('quality');
  if (Q) {
    one(Q, 'rung', SCENE_ENUMS.rung, 'quality');
    if (Q.output != null) {
      const o = Q.output;
      if (!Array.isArray(o) || o.length !== 2 || !o.every(x => Number.isInteger(x) && x >= 64)) errors.push('quality.output: [w, h] in whole pixels (64 or more) expected, or null');
      else if (Math.max(o[0], o[1]) > SCENE_MAX_SIDE) { const k = SCENE_MAX_SIDE / Math.max(o[0], o[1]); Q.output = [Math.round(o[0] * k), Math.round(o[1] * k)]; warnings.push('quality.output ' + o.join('x') + ' -> ' + Q.output.join('x') + ' (the largest side is ' + SCENE_MAX_SIDE + ')'); }
    }
    if (Q.hq != null && typeof Q.hq !== 'boolean') errors.push('quality.hq: true / false expected');
  }
  return { ok: errors.length === 0, scene: errors.length ? null : S, errors, warnings };
}

// THE HEADING FRAME (§3.1): x forward along the heading, y up, z to the right; the plane's pitch and roll do not turn it,
// so a re-posed aeroplane keeps its framing. hdg is placePose's (radians, the nose along (cos hdg, 0, sin hdg)).
function sceneFrame(hdg) {
  const f = [Math.cos(hdg), 0, Math.sin(hdg)], r = [-Math.sin(hdg), 0, Math.cos(hdg)];
  return { f, u: [0, 1, 0], r };
}
function sceneToWorld(cam, anchor) {
  if (!cam || cam.anchor === 'world' || !anchor) return { eye: cam && cam.eye ? cam.eye.slice() : null, target: cam && cam.target ? cam.target.slice() : null };
  const F = sceneFrame(anchor.hdg), c = anchor.cg;
  const w = v => v ? [0, 1, 2].map(i => c[i] + v[0] * F.f[i] + v[1] * F.u[i] + v[2] * F.r[i]) : null;
  return { eye: w(cam.eye), target: w(cam.target) };
}
function sceneFromWorld(eye, target, anchor) {
  if (!anchor) return { eye: eye ? eye.slice() : null, target: target ? target.slice() : null };
  const F = sceneFrame(anchor.hdg), c = anchor.cg;
  const l = v => { if (!v) return null; const d = [v[0] - c[0], v[1] - c[1], v[2] - c[2]];
    return [d[0] * F.f[0] + d[2] * F.f[2], d[1], d[0] * F.r[0] + d[2] * F.r[2]]; };
  return { eye: l(eye), target: l(target) };
}

// the saved picture's size: the scene's, else the window's (the user, 11 Nov: "choose it, with default being your
// window size"); the largest side held to SCENE_MAX_SIDE, the aspect kept
function sceneOutputSize(q, win) {
  let o = q && Array.isArray(q.output) ? q.output : [Math.round(win[0]), Math.round(win[1])];
  const k = Math.min(1, SCENE_MAX_SIDE / Math.max(o[0], o[1]));
  return [Math.max(64, Math.round(o[0] * k)), Math.max(64, Math.round(o[1] * k))];
}

// ---- THE SCENE INSIDE THE PICTURE (§3.4): one iTXt chunk before IEND ------------------------------------------------
let SCENE_CRC_T = null;
function sceneCrc32(buf, a, b) {
  if (!SCENE_CRC_T) { SCENE_CRC_T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; SCENE_CRC_T[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = a; i < b; i++) c = SCENE_CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const SCENE_PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
// walk the chunks: [{ type, at (the chunk's first byte), len (its data's), end (the next chunk's first byte) }] or null
function scenePngChunks(png) {
  if (!png || png.length < 8 || SCENE_PNG_SIG.some((x, i) => png[i] !== x)) return null;
  const out = []; let at = 8;
  while (at + 12 <= png.length) {
    const len = ((png[at] << 24) | (png[at + 1] << 16) | (png[at + 2] << 8) | png[at + 3]) >>> 0;
    const type = String.fromCharCode(png[at + 4], png[at + 5], png[at + 6], png[at + 7]);
    const end = at + 12 + len;
    if (end > png.length) return null;
    out.push({ type, at, len, end });
    at = end;
    if (type === 'IEND') break;
  }
  return out.length && out[out.length - 1].type === 'IEND' ? out : null;
}
const sceneAscii = s => Uint8Array.from(s, ch => ch.charCodeAt(0) & 0xff);
// is this iTXt chunk ours? -> { compressed, bytes } | null
function sceneChunkRead(png, ch) {
  const d0 = ch.at + 8, d1 = d0 + ch.len, key = SCENE_PNG_KEY;
  if (ch.len < key.length + 5) return null;
  for (let i = 0; i < key.length; i++) if (png[d0 + i] !== key.charCodeAt(i)) return null;
  let p = d0 + key.length;
  if (png[p] !== 0) return null;
  const compressed = png[p + 1] === 1; p += 3;                 // the flag, the method (0, zlib)
  while (p < d1 && png[p] !== 0) p++; p++;                     // the language tag
  while (p < d1 && png[p] !== 0) p++; p++;                     // the translated keyword
  if (p > d1) return null;
  return { compressed, bytes: png.slice(p, d1) };
}
function scenePngGet(png) {
  const C = scenePngChunks(png);
  if (!C) return null;
  for (const ch of C) if (ch.type === 'iTXt') { const r = sceneChunkRead(png, ch); if (r) return r; }
  return null;
}
// a new PNG: every chunk as it was, minus an older scene of ours, plus this one before IEND. `bytes` is the UTF-8 JSON
// (compressed false) or its zlib stream (compressed true). A PNG this cannot read comes back null - never a broken file
function scenePngPut(png, bytes, compressed) {
  const C = scenePngChunks(png);
  if (!C) return null;
  const head = sceneAscii(SCENE_PNG_KEY);
  const len = head.length + 1 + 2 + 1 + 1 + bytes.length;      // key \0 flag method lang\0 tkey\0 text
  const chunk = new Uint8Array(12 + len);
  chunk[0] = len >>> 24; chunk[1] = (len >>> 16) & 0xff; chunk[2] = (len >>> 8) & 0xff; chunk[3] = len & 0xff;
  chunk.set(sceneAscii('iTXt'), 4); chunk.set(head, 8);
  let p = 8 + head.length;
  chunk[p++] = 0; chunk[p++] = compressed ? 1 : 0; chunk[p++] = 0; chunk[p++] = 0; chunk[p++] = 0;
  chunk.set(bytes, p);
  const crc = sceneCrc32(chunk, 4, 8 + len);
  chunk[8 + len] = crc >>> 24; chunk[9 + len] = (crc >>> 16) & 0xff; chunk[10 + len] = (crc >>> 8) & 0xff; chunk[11 + len] = crc & 0xff;
  const keep = C.filter(ch => !(ch.type === 'iTXt' && sceneChunkRead(png, ch)));
  const iend = keep[keep.length - 1];
  let size = 8 + chunk.length; for (const ch of keep) size += ch.end - ch.at;
  const out = new Uint8Array(size); out.set(png.subarray(0, 8), 0);
  let o = 8;
  for (const ch of keep) { if (ch === iend) { out.set(chunk, o); o += chunk.length; } out.set(png.subarray(ch.at, ch.end), o); o += ch.end - ch.at; }
  return out;
}

// ---- THE POSE READ BACK (P2: "Save this scene" takes the aeroplane as it is) ------------------------------------------
// The body frame as the solver takes it (30_solver bodyAxes: the firewall ring to the tail post, the up pair), off ANY
// set of node positions - the live sim's or the build's rest geometry (def.nodes) - made orthonormal and right-handed:
// x aft, y up, z = x * y (the LEFT side). -> [x, y, z] or null
function sceneAxesOf(P, refs) {
  if (!refs || !refs.noseFrame || !refs.tailMid || !refs.upLo || !refs.upHi) return null;
  const at = i => (P.length && typeof P[0] === 'object') ? P[i].p : [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  const avg = ids => { const o = [0, 0, 0]; for (const i of ids) { const q = at(i); o[0] += q[0]; o[1] += q[1]; o[2] += q[2]; } return o.map(v => v / ids.length); };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const x = nrm(sub(avg(refs.tailMid), avg(refs.noseFrame)));
  const u = sub(avg(refs.upHi), avg(refs.upLo));
  const y = nrm(sub(u, x.map(v => v * dot(u, x))));
  return [x, y, cross(x, y)];
}
// the aeroplane's pose in placePose's terms (radians; the CG off the masses) from the live nodes against the rest ones:
// R = B_now * B_rest^T = Ry(pi - hdg) * Rz(-pitch) * Rx(-roll) (placePose's three turns), read back. GATE SCENE holds
// placePose -> scenePoseOf to 1e-9 over a sweep of poses. -> { cg, hdg, pitch, roll } or null
function scenePoseOf(p, m, def) {
  const n = def.nodes.length;
  const A = sceneAxesOf(p, def.refs), B = sceneAxesOf(def.nodes, def.refs);
  if (!A || !B) return null;
  let cx = 0, cy = 0, cz = 0, mt = 0;
  for (let i = 0; i < n; i++) { const w = m ? m[i] : def.nodes[i].m; cx += p[i * 3] * w; cy += p[i * 3 + 1] * w; cz += p[i * 3 + 2] * w; mt += w; }
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[r][c] = A[0][r] * B[0][c] + A[1][r] * B[1][c] + A[2][r] * B[2][c];
  const a = Math.asin(Math.max(-1, Math.min(1, R[1][0])));
  const th = Math.atan2(-R[2][0], R[0][0]), b = Math.atan2(-R[1][2], R[1][1]);
  const wrap = v => { v %= 2 * Math.PI; return v < 0 ? v + 2 * Math.PI : v; };
  return { cg: [cx / mt, cy / mt, cz / mt], hdg: wrap(Math.PI - th), pitch: -a, roll: -b };
}
