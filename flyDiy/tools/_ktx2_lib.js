// _ktx2_lib.js - KTX2 / BASIS UNIVERSAL IN NODE (AS3, G915-G916): the encoder the bakers call and the decoder the
// gates call. futureDesigns/ASSETS-2026-09-27.md §5.3 M8-M9.
//
// THE ENCODER is Binomial's basisu, the command-line build, v1.16.4 exactly (npm basis_universal@1.16.4-1, pinned in
// package.json beside three and esbuild: `cd flyDiy && npm install`; its bin/ carries the Linux and Windows builds).
// BASISU=<path> overrides the binary; the version it prints is checked (another version would name different bytes).
// Deterministic run to run on one box (checked: three encodes of each role, byte-equal; UASTC's RDO runs
// single-threaded for that, -uastc_rdo_m). A file is NAMED BY ITS INPUT (the source texels + the role's settings +
// the encoder version, `ktx2Name`), not by its own bytes: a re-bake of unchanged texels on a box whose basisu build
// writes other bytes writes nothing, and the gate re-derives every name from the shipped source.
//
// THE ROLES (media_lib's; tools/_media_lib.js encodeTex takes them too):
//   ktx2-color   ETC1S, sRGB metrics, quality 255, mips in the file. ~0.3 B/texel on the wire; the page transcodes
//                it to BC7 (desktop) / ETC2 (mobile) / BC1-3 - 1 B/texel on the GPU (0.5 without alpha on BC1).
//                `mip`: 'srgb' (the default: the GPU's own sRGB-typed generateMipmap - decode, average, encode) or
//                'linear' (a texture the shader decodes: the GPU averaged the ENCODED values - the splat's arrays).
//                `codec: 'uastc'`: the same role in UASTC + RDO (~1 B/texel on the wire before zstd, the GPU's
//                bytes unchanged) - for colour whose FAR look must hold: ETC1S shares one luminance modifier across
//                r, g and b, so a saturated colour with little blue (grass, moss, dirt) comes back with its blue
//                lifted - measured on the ground's colour planes, 8-15 codes of blue in the mips from 16x16 down
//                (the far view desaturated), where UASTC stays within 1 code (tools/_ktx2_check.js check 6).
//                THE GROUND'S ARRAYS USE IT (G916); ETC1S remains the role's default for maps seen near.
//   ktx2-normal  UASTC level 2 + RDO (lambda 1, zstd), linear metrics and mips. ~1 B/texel on the wire before
//                zstd, BC7 / ASTC on the GPU. `twoChannel`: X -> RGB, Y -> A (basisu -separate_rg_to_color_alpha),
//                for a consumer that rebuilds Z; the ground's N plane keeps its four channels (roughness rides
//                in A), so it is written RGBA.
//   ktx2-data    ETC1S, linear, one channel (the source's R, replicated; no alpha): roughness / AO / masks that travel alone.
//                `channels: 3`: a PACKED data map (glTF's ARM: occlusion r, roughness g, metalness b - the props') in UASTC,
//                linear: three unrelated channels are what ETC1S's shared luminance cannot hold.
// Mip filter: box (the GPU's generateMipmap is a 2x2 box; basisu's default kaiser would sharpen the far look).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), vm = require('vm'), crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const BASISU_VERSION = '1.16.4';
const TRANSCODER_DIR = path.join(ROOT, 'vendor', 'ktx2');

// ---- the role table ---------------------------------------------------------------------------------------------
function roleArgs(role, o) {
  o = o || {};
  // UASTC's RDO: lambda (default 1) and dictionary (basisu's default 4096 bytes); a larger lambda trades a little
  // quality for a smaller zstd stream (the plain maps' normal / data twins: 3 and 32 KB)
  const rdo = ['-uastc_rdo_l', String(o.rdo || 1), ...(o.dict ? ['-uastc_rdo_d', String(o.dict)] : []), '-uastc_rdo_m'];
  const mipSpace = o.mip === 'linear' ? ['-mip_linear'] : [];
  const mips = o.noMips ? [] : ['-mipmap', '-mip_filter', 'box'];
  if (role === 'ktx2-color') return o.codec === 'uastc'
    ? ['-uastc', '-uastc_level', '2', ...rdo, ...(o.alpha ? ['-force_alpha'] : []), ...mips, ...mipSpace]
    : ['-q', '255', ...(o.alpha ? ['-force_alpha'] : []), ...mips, ...mipSpace];
  if (role === 'ktx2-normal') return ['-uastc', '-uastc_level', '2', ...rdo, '-linear', ...(o.twoChannel ? ['-separate_rg_to_color_alpha'] : []), ...mips];
  if (role === 'ktx2-data') return o.channels === 3
    ? ['-uastc', '-uastc_level', '2', ...rdo, '-linear', '-no_alpha', ...mips]
    : ['-q', '255', '-linear', '-no_alpha', ...mips];
  throw new Error('ktx2: unknown role ' + role);
}
const ROLES = ['ktx2-color', 'ktx2-normal', 'ktx2-data'];

// ---- the binary -------------------------------------------------------------------------------------------------
let BIN = null;
function basisu() {
  if (BIN) return BIN;
  const cands = [process.env.BASISU,
    path.join(ROOT, 'node_modules', 'basis_universal', 'bin', process.platform === 'win32' ? 'basisu.exe' : 'basisu')].filter(Boolean);
  for (const c of cands) {
    if (!fs.existsSync(c)) continue;
    try { if (process.platform !== 'win32') fs.chmodSync(c, 0o755); } catch (e) {}
    const r = cp.spawnSync(c, ['-version'], { encoding: 'utf8' });
    const m = /Compressor v(\d+\.\d+\.\d+)/.exec((r.stdout || '') + (r.stderr || ''));
    if (!m) continue;
    if (m[1] !== BASISU_VERSION) throw new Error(`ktx2: ${c} is basisu v${m[1]}, not v${BASISU_VERSION} (the names hash the encoder's version: npm install in flyDiy/)`);
    return (BIN = c);
  }
  return null;
}
const hasEncoder = () => { try { return !!basisu(); } catch (e) { return false; } };

// ---- a PNG writer (the encoder's input; no dependency) -----------------------------------------------------------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function pngChunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
function pngRGBA(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ih), pngChunk('IDAT', zlib.deflateSync(raw, { level: 1 })), pngChunk('IEND', Buffer.alloc(0))]);
}

// ---- encode -----------------------------------------------------------------------------------------------------
// the settings a name hashes: the role, its options, the encoder's version
const settingsKey = (role, o) => `${role} ${roleArgs(role, o).join(' ')} basisu ${BASISU_VERSION}`;
// the 8-hex name of (texels, role): sha256 of the RGBA bytes + '\n' + the settings
function ktx2Hash(rgba, w, h, role, o) {
  return crypto.createHash('sha256').update(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength)).update(`\n${w}x${h} ${settingsKey(role, o)}`).digest('hex').slice(0, 8);
}
function ktx2Name(stem, rgba, w, h, role, o) { return `${stem}.${ktx2Hash(rgba, w, h, role, o)}.ktx2`; }
// RGBA8 texels -> KTX2 bytes (Buffer)
function encodeRGBA(rgba, w, h, role, o) {
  const B = basisu();
  if (!B) throw new Error('ktx2: no basisu v' + BASISU_VERSION + ' (cd flyDiy && npm install, or BASISU=<path>)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy_ktx2_'));
  try {
    const inp = path.join(tmp, 'in.png'), out = path.join(tmp, 'out.ktx2');
    // ktx2-data travels as ONE channel: R replicated into G and B, alpha opaque (ETC1S's grey slice)
    if (role === 'ktx2-data' && (!o || o.channels !== 3)) { const g = new Uint8Array(rgba.length); for (let i = 0; i < g.length; i += 4) { g[i] = g[i + 1] = g[i + 2] = rgba[i]; g[i + 3] = 255; } rgba = g; }
    fs.writeFileSync(inp, pngRGBA(w, h, rgba));
    const r = cp.spawnSync(B, [inp, '-ktx2', '-output_file', out, ...roleArgs(role, o)], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0 || !fs.existsSync(out)) throw new Error('ktx2: basisu failed: ' + (r.stderr || r.stdout || '').slice(-600));
    return fs.readFileSync(out);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// the same, in a child process that does not block (a pool of these keeps the cores busy: tools/ktx2_twins.js)
function encodeRGBAAsync(rgba, w, h, role, o, threads) {
  const B = basisu();
  if (!B) return Promise.reject(new Error('ktx2: no basisu v' + BASISU_VERSION));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy_ktx2_'));
  const inp = path.join(tmp, 'in.png'), out = path.join(tmp, 'out.ktx2');
  if (role === 'ktx2-data' && (!o || o.channels !== 3)) { const g = new Uint8Array(rgba.length); for (let i = 0; i < g.length; i += 4) { g[i] = g[i + 1] = g[i + 2] = rgba[i]; g[i + 3] = 255; } rgba = g; }
  fs.writeFileSync(inp, pngRGBA(w, h, rgba));
  return new Promise((res, rej) => {
    const ch = cp.spawn(B, [inp, '-ktx2', '-output_file', out, ...roleArgs(role, o), ...(threads ? ['-max_threads', String(threads)] : [])], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; ch.stderr.on('data', d => { err += d; });
    ch.on('close', code => {
      try { if (code !== 0 || !fs.existsSync(out)) throw new Error('ktx2: basisu failed: ' + err.slice(-600)); res(fs.readFileSync(out)); }
      catch (e) { rej(e); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    });
  });
}

// ---- decode: three@0.186's own transcoder (vendor/ktx2/basis_transcoder.js + .wasm), in node -------------------
let MOD = null;
function transcoder() {
  if (MOD) return MOD;
  const src = fs.readFileSync(path.join(TRANSCODER_DIR, 'basis_transcoder.js'), 'utf8');
  const wasm = fs.readFileSync(path.join(TRANSCODER_DIR, 'basis_transcoder.wasm'));
  const ctx = { console, WebAssembly, performance, setTimeout, clearTimeout, TextDecoder };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.BASIS = BASIS;', ctx);
  MOD = new Promise(res => { const m = { wasmBinary: wasm, onRuntimeInitialized: () => { m.initializeBasis(); res(m); } }; ctx.BASIS(m); });
  return MOD;
}
// the transcoder's target codes (basis_transcoder: transcoder_texture_format)
const TF = { ETC1: 0, ETC2: 1, BC1: 2, BC3: 3, BC4: 4, BC5: 5, BC7_M5: 7, ASTC_4x4: 10, RGBA32: 13 };
// KTX2 bytes -> { width, height, levels, layers, uastc, etc1s, hasAlpha, srgb, mips: [{ w, h, data: RGBA8 }] (layer 0),
//                 gpu: { format, bytes } (the transcode a desktop page makes: BC7) }
async function decode(bytes, opts) {
  const M = await transcoder();
  const k = new M.KTX2File(new Uint8Array(bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes));
  try {
    if (!k.isValid()) throw new Error('ktx2: invalid file');
    if (!k.startTranscoding()) throw new Error('ktx2: startTranscoding failed');
    const out = { width: k.getWidth(), height: k.getHeight(), levels: k.getLevels(), layers: k.getLayers() || 1, faces: k.getFaces(),
      uastc: !!k.isUASTC(), etc1s: !!k.isETC1S(), hasAlpha: !!k.getHasAlpha(), dfdFlags: k.getDFDFlags(), mips: [], gpuBytes: 0 };
    // the DFD's transfer function: 2 = sRGB (KHR_DF_TRANSFER_SRGB)
    out.srgb = typeof k.getDFDTransferFunc === 'function' ? k.getDFDTransferFunc() === 2 : null;
    const nl = opts && opts.levels === 1 ? 1 : out.levels;
    for (let l = 0; l < nl; l++) {
      const info = k.getImageLevelInfo(l, 0, 0);
      const d = new Uint8Array(k.getImageTranscodedSizeInBytes(l, 0, 0, TF.RGBA32));
      if (!k.transcodeImage(d, l, 0, 0, TF.RGBA32, 0, -1, -1)) throw new Error('ktx2: transcode level ' + l + ' failed');
      out.mips.push({ w: info.origWidth, h: info.origHeight, data: d });
      out.gpuBytes += k.getImageTranscodedSizeInBytes(l, 0, 0, TF.BC7_M5) * out.layers;
    }
    if (nl < out.levels) for (let l = nl; l < out.levels; l++) out.gpuBytes += k.getImageTranscodedSizeInBytes(l, 0, 0, TF.BC7_M5) * out.layers;
    return out;
  } finally { k.close(); k.delete(); }
}
// the GPU bytes a KTX2 file costs once transcoded for a desktop (BC7: 1 B/texel, every level), read off the header
// alone (no transcode): levels x layers x ceil(w/4) x ceil(h/4) x 16
function gpuBytesOf(bytes) {
  const b = Buffer.from(bytes.buffer ? bytes.buffer : bytes, bytes.byteOffset || 0, bytes.byteLength || bytes.length);
  const w = b.readUInt32LE(20), h = b.readUInt32LE(24), layers = Math.max(1, b.readUInt32LE(32)), faces = b.readUInt32LE(36), levels = Math.max(1, b.readUInt32LE(40));
  let n = 0;
  for (let l = 0; l < levels; l++) n += Math.ceil(Math.max(1, w >> l) / 4) * Math.ceil(Math.max(1, h >> l) / 4) * 16;
  return n * layers * faces;
}

// ---- quality -----------------------------------------------------------------------------------------------------
// PSNR (dB) over the channels asked, 99 when equal; and each channel's mean drift (codes)
function psnr(a, b, chs) {
  let se = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) for (const c of chs) { const d = a[i + c] - b[i + c]; se += d * d; n++; }
  const m = se / Math.max(1, n); return m ? 10 * Math.log10(255 * 255 / m) : 99;
}
function meanDrift(a, b, chs) {
  let worst = 0;
  for (const c of chs) { let sa = 0, sb = 0, n = 0; for (let i = c; i < a.length; i += 4) { sa += a[i]; sb += b[i]; n++; } worst = Math.max(worst, Math.abs(sa - sb) / Math.max(1, n)); }
  return worst;
}
// the next mip of an RGBA8 image as the GPU's generateMipmap makes it: a 2x2 box, in sRGB-decoded light for the rgb
// channels when `srgb` (an sRGB-typed texture), else on the stored values
const S2L = new Float64Array(256).map((_, v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
const L2S = x => Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
function boxMip(src, w, h, srgb) {
  const W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) {
    const xs = [Math.min(w - 1, 2 * x), Math.min(w - 1, 2 * x + 1)], ys = [Math.min(h - 1, 2 * y), Math.min(h - 1, 2 * y + 1)];
    let s = 0; for (const yy of ys) for (const xx of xs) { const v = src[(yy * w + xx) * 4 + c]; s += srgb && c < 3 ? S2L[v] : v; }
    out[(y * W + x) * 4 + c] = srgb && c < 3 ? L2S(s / 4) : Math.round(s / 4);
  }
  return { w: W, h: H, data: out };
}

module.exports = { BASISU_VERSION, ROLES, roleArgs, settingsKey, ktx2Hash, ktx2Name, encodeRGBA, encodeRGBAAsync, basisu, hasEncoder, pngRGBA,
  transcoder, decode, gpuBytesOf, psnr, meanDrift, boxMip, TF };
