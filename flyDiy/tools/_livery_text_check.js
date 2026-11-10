#!/usr/bin/env node
// GATE LIVERYTEXT (LIVERY-TEXT, 9 Nov) - the livery's text pieces: up to six lines a plane besides the registration,
// each on its own distance-field page, in six faces fetched on first use.
//
//   node tools/_livery_text_check.js [--verbose]   -> "GATE LIVERYTEXT: PASS|FAIL", non-zero on FAIL
//
// THE USER'S ANSWERS (9 Nov, via A0) are what it holds the code to: six pieces; one line of 24 characters; the livery
// layer's placement; both sides reading right or one side only; an outline offered and off; real bold and italic only
// where the face ships them (never synthesised) and a slant; the registration a text piece with a fixed role; the
// official planes exactly as they were; fonts from google/fonts only, each licence kept and credited.
//
// WHAT RUNS: aeroskin.js itself under the vendor three.js, its canvas a stub that records what is drawn (the face, the
// text) and FontFace a stub that "loads" - so the stand-in, the arrival and the redraw run as in the page. The panel
// (_cage_ui.js) and the finish view (editor.js) are read as source.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const VERBOSE = process.argv.includes('--verbose');
let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('  FAIL ' + m + (x != null ? ' — ' + x : '')); } else if (VERBOSE) console.log('  ok   ' + m); };

// ---- the page, stubbed: a 2D context that records, a FontFace that arrives when told -------------------------------
const drawn = [];   // { font, text } per fillText
const ctx = () => {
  const c = { font: '', letterSpacing: '0px' };
  for (const k of ['save', 'restore', 'clearRect', 'translate', 'scale', 'transform', 'strokeText', 'putImageData', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'arc', 'rect', 'clip', 'setTransform', 'drawImage'])
    c[k] = () => {};
  c.measureText = t => ({ width: 48 * String(t || '').length, actualBoundingBoxAscent: 70, actualBoundingBoxDescent: 20 });
  c.fillText = (t) => { drawn.push({ font: c.font, text: t }); };
  c.getImageData = (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
  c.createLinearGradient = c.createRadialGradient = () => ({ addColorStop() {} });
  return c;
};
const pending = [];
global.FontFace = class { constructor(fam, src, d) { this.family = fam; this.src = src; this.d = d; }
  load() { return new Promise(res => pending.push(() => res(this))); } };
global.CustomEvent = class { constructor(t) { this.type = t; } };
const events = [];
global.window = { GFX: { budget: () => ({ aeroAtlas: 512 }) }, dispatchEvent: e => events.push(e.type) };   // (128 px pages: a fast field)
global.document = { createElement: () => ({ width: 0, height: 0, getContext: ctx }), fonts: { add() {} } };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const A = Object.assign({}, require(path.join(ROOT, 'src', 'viewer', 'aeroskin.js')), window.AEROSKIN || {});   // (the page's door has the drawing half)
const SKIN = rd('src/viewer/aeroskin.js'), UI = rd('tools/_cage_ui.js'), ED = rd('src/viewer/editor.js');
const tick = () => new Promise(r => setTimeout(r, 5));
const lastFont = page => { for (let i = drawn.length - 1; i >= 0; i--) if (drawn[i].page === page) return drawn[i].font; return null; };

(async () => {
  // 1. THE SLOTS: fifteen, the shader's and the module's; six pages of their own
  ok(A.AERO_MAXD === 15 && /#define AERO_MAXD 15\n/.test(SKIN), 'fifteen decal slots, the module and the shader agree', A.AERO_MAXD);
  ok(A.AERO_TXT_N === 6 && A.AERO_TXT_MAX === 24, 'six pieces of one 24-character line');
  const taken = new Set([0, 6, 7].concat(A.AERO_KIT_PAGES));
  ok(A.AERO_TXT_PAGES.join(',') === '8,9,10,11,12,13' && A.AERO_TXT_PAGES.every(p => !taken.has(p) && p < A.AERO_ATLAS_N * A.AERO_ATLAS_N),
     'the pieces\' pages are the atlas\'s free ones (not the registration, the kit, the strip or the master)');
  ok(A.AERO_KIT_LAYERS + 4 + A.AERO_TXT_N <= A.AERO_MAXD, 'every marking the panel offers has a slot (5 kit + 6 text + 2 registrations + 2 stickers)');

  // 2. OFF AND EMPTY BY DEFAULT, and the registration's new keys inert
  const D0 = A.aeroDecalMerge({});
  ok([1, 2, 3, 4, 5, 6].every(i => D0['t' + i + 'On'] === 0 && D0['t' + i + 'Txt'] === ''), 'every piece is off and empty by default');
  ok(D0.regFace === null && D0.regLine === null && D0.regSide === 0 && !D0.regI && !D0.regSl, 'the registration\'s face, outline and side default to the old drawing');
  ok(!/regOut/.test((SKIN.split('const AERO_DEC_DEF = {')[1] || '').split('};')[0]), 'the retired keyline (regOut) is still read by nothing');

  // 3. THE OFFICIAL PLANES EXACTLY AS THEY WERE: no build carries a piece or a new registration key; each one's list
  //    holds no text page, its registration drawn in its old row's face, no outline, on both sides
  const files = fs.readdirSync(path.join(ROOT, 'builds')).filter(f => /\.json$/.test(f)).map(f => 'builds/' + f);
  let nb = 0, bad = [];
  for (const f of files) {
    let spec; try { spec = JSON.parse(rd(f)); } catch (e) { continue; }
    if (!spec || typeof spec !== 'object') continue;
    const dec = (spec.finish && spec.finish.decals) || {};
    if (Object.keys(dec).some(k => /^t\d|^reg(Face|B|I|Sl|Line|Side)$/.test(k))) bad.push(f + ' carries a new key');
    const D = A.aeroDecalMerge(spec);
    drawn.length = 0;
    const r = A.aeroDecalsFor(THREE, D, { reg: (spec.meta && spec.meta.reg) || 'F-TEST', trim: 0x1b3a5c });
    if (r.list.some(d => d.page >= 8 && d.page <= 13)) bad.push(f + ' wears a text page');
    const reg = r.list.find(d => d.page === 0);
    if (!reg || reg.one) bad.push(f + ' registration not on both sides');
    const want = A.AERO_DEC_FONTS[Math.max(0, Math.min(3, Math.round(+D.regFont || 0)))].css;
    if (drawn.length && drawn[0].font !== want) bad.push(f + ' registration face ' + drawn[0].font);
    nb++;
  }
  ok(nb >= 5 && !bad.length, 'the official builds (' + nb + ') wear what they wore', bad.slice(0, 4).join('; '));
  for (let k = 0; k < 4; k++) ok(A.aeroTxtFont(k).css === A.AERO_DEC_FONTS[k].css && A.aeroTxtFont(k).sl === 0,
                                 'the registration\'s old row ' + k + ' draws exactly as before');

  // 4. NEVER A SYNTHESISED STYLE: every bold / italic the panel can ask for names a real file (or a weight the page ships)
  let synth = [];
  for (const F of A.AERO_TXT_FACES) for (const b of [0, 1]) for (const i of [0, 1]) {
    const s = A.aeroTxtStyle(F, b, i);
    if (F.files ? !F.files[s.st] : ![F.r, F.b].includes(s.w) || s.it) synth.push(F.key + ' b' + b + ' i' + i);
    if (i && !F.it && s.it) synth.push(F.key + ' italic without a file');
  }
  ok(!synth.length && A.AERO_TXT_FACES.length === 8, 'bold and italic only where the face ships them (8 faces)', synth.join(', '));

  // 5. A PIECE: drawn on its page with the stand-in, then in its own face when the file arrives - and the list remade
  const D = A.aeroDecalMerge({ finish: { decals: { t3On: 1, t3Txt: 'Hélène du Lac', t3Face: 'lobster2', t3B: 1, t3I: 1, t3Sl: 0.2,
    t3Side: 2, t3Line: 0xffffff, t3H: 0.4, t3L: 1.5, t3C: 0.1, t1On: 1, t1Txt: 'x'.repeat(30) + '\u0007' } } });
  const tag = page => { const n0 = drawn.length; return () => { for (let i = n0; i < drawn.length; i++) drawn[i].page = page; }; };
  drawn.length = 0;
  const r = A.aeroDecalsFor(THREE, D, { reg: 'F-HLNE', trim: 0x1b3a5c });
  A.aeroSetDecals(THREE, r.list);
  const p10 = r.list.find(d => d.page === 10), p8 = r.list.find(d => d.page === 8);
  ok(!!p10 && p10.sdf === 1 && p10.one === 2 && p10.sL === 1.5 && p10.sC === 0.1 && p10.mode === 'field', 'the piece is on its page, a distance field, on one side, where it was placed', JSON.stringify(p10));
  ok(!!p10 && Math.abs(p10.h * 0.0 + p10.h) > 0.4, 'the height is the letters\' (the page rect is larger than the glyphs)');
  const lob = drawn.filter(d => /Hélène/.test(d.text));
  ok(lob.length >= 1 && lob.every(d => /^700 96px "IBM Plex Sans"/.test(d.font)), 'until the face arrives the piece is drawn in IBM Plex Sans, never a fake italic', lob[0] && lob[0].font);
  const long = drawn.find(d => /^x+/.test(d.text));
  ok(!!long && long.text.length === 24 && !/\u0007/.test(long.text), 'one line of 24 characters, nothing that is not a letter', long && long.text.length);
  ok(r.list.indexOf(p8) < r.list.findIndex(d => d.page === 0), 'the pieces sit under the registration (it is mixed last of the letters)');
  ok(pending.length >= 1, 'the face is asked for (a FontFace for Lobster Two Bold Italic)', pending.length);
  drawn.length = 0;
  while (pending.length) pending.shift()();
  await tick(); await tick();
  const lob2 = drawn.filter(d => /Hélène/.test(d.text));
  ok(lob2.length >= 1 && /italic 700 96px "LT Lobster Two"/.test(lob2[lob2.length - 1].font), 'the face arrived: the page drawn again in Lobster Two Bold Italic', lob2.length && lob2[lob2.length - 1].font);
  ok(events.includes('aero-face'), 'the panel is told (aero-face)');

  // 6. THE REGISTRATION AS A PIECE: a face picked draws it through the same path; its side and outline are a piece's
  drawn.length = 0;
  const DR = A.aeroDecalMerge({ finish: { decals: { regFace: 'jost', regB: 1, regSide: 1, regLine: 0x000000 } } });
  const rr = A.aeroDecalsFor(THREE, DR, { reg: 'F-JOST', trim: 0x1b3a5c });
  A.aeroSetDecals(THREE, rr.list);   // (the list on the aeroplane is the one an arrival makes again)
  while (pending.length) pending.shift()();
  await tick(); await tick();
  ok(rr.list.find(d => d.page === 0).one === 1, 'the registration on one side when asked');
  ok(drawn.some(d => d.text === 'F-JOST' && /700 96px "LT Jost"/.test(d.font)), 'the registration in a picked face (Jost Bold)', drawn.filter(d => d.text === 'F-JOST').map(d => d.font).join(' | '));

  // 7. A FULL LIVERY: every kit layer, every piece, the wing registration, two stickers - the kit gives way, never a letter
  window.AERO_EXTRA_DECALS = () => [{ page: 6, on: { tail: 1 } }, { page: 7, on: { body: 1 } }];
  const full = { wregOn: 1 };
  for (let i = 1; i <= 5; i++) full['m' + i + 'On'] = 1;
  for (let i = 1; i <= 6; i++) { full['t' + i + 'On'] = 1; full['t' + i + 'Txt'] = 'Line ' + i; }
  const rf = A.aeroDecalsFor(THREE, A.aeroDecalMerge({ finish: { decals: full } }), { reg: 'F-FULL', trim: 0 });
  const pages = rf.list.map(d => d.page);
  ok(rf.list.length <= A.AERO_MAXD && [8, 9, 10, 11, 12, 13, 0, 6, 7].every(p => pages.includes(p)) && pages.filter(p => p === 0).length === 2,
     'a full livery fits fifteen: six lines, both registrations, the strip and the master', pages.join(','));
  delete window.AERO_EXTRA_DECALS;

  // 8. THE SHADER'S ONE SIDE: 1 the +x side (the stickers'), 2 the other; uDecE.z carries it
  ok(/float aSg = \(aOne > 1\.5\) \? -1\.0 : 1\.0;/.test(SKIN) && /step\(-0\.02, aeroA\.x \* aSg\) \* step\(0\.0, vCraftNrm\.x \* aSg\)/.test(SKIN)
     && /mix\(1\.0, aSide, step\(0\.5, aOne\)\)/.test(SKIN), 'the shader puts a one-side marking on either side');
  ok(/d\.one === true \? 1 : Math\.max\(0, Math\.min\(2, Math\.round\(\+d\.one \|\| 0\)\)\)/.test(SKIN), 'the stickers\' true stays side 1; a piece\'s 2 reaches the shader');

  // 9. THE FILES: each named by its content; a reserved font name ships whole (WOFF 1.0 of the original: its own name
  //    table still says so); every family's licence beside it and credited
  const CRED = rd('CREDITS.md');
  for (const F of A.AERO_TXT_FACES) {
    if (!F.files) continue;
    const fam = F.name, ofl = path.join(ROOT, F.ofl || 'media/fonts/none');
    ok(fs.existsSync(ofl), fam + ': its licence is kept beside it', ofl);
    const rfn = fs.existsSync(ofl) && /Reserved Font Names? "/.test(fs.readFileSync(ofl, 'utf8').split('\n').slice(0, 6).join(' '));
    ok(new RegExp('\\*\\*' + fam + '\\*\\*').test(CRED), fam + ': credited in CREDITS.md');
    for (const st of Object.keys(F.files)) {
      const p = path.join(ROOT, F.files[st]);
      if (!fs.existsSync(p)) { ok(false, fam + ' ' + st + ': the file is there', F.files[st]); continue; }
      const buf = fs.readFileSync(p), m = /\.([0-9a-f]{8})\.(woff2?)$/.exec(p);
      ok(!!m && crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8) === m[1], fam + ' ' + st + ': named by its content');
      if (rfn) {
        let named = false;
        if (buf.slice(0, 4).toString('latin1') === 'wOFF') {
          const nt = buf.readUInt16BE(12);
          for (let i = 0; i < nt; i++) {
            const o = 44 + 20 * i;
            if (buf.slice(o, o + 4).toString('latin1') !== 'name') continue;
            const at = buf.readUInt32BE(o + 4), cl = buf.readUInt32BE(o + 8), ol = buf.readUInt32BE(o + 12);
            const t = cl < ol ? zlib.inflateSync(buf.slice(at, at + cl)) : buf.slice(at, at + cl);
            named = t.includes(Buffer.from(fam, 'utf16le').swap16()) || t.includes(Buffer.from(fam, 'latin1'));
          }
        }
        ok(named, fam + ' ' + st + ': a reserved font name ships whole (a WOFF 1.0 of the original, its name intact)');
      }
    }
  }

  // 10. THE PANEL AND THE FINISH VIEW (source): the registration's rows are a piece's; six pieces under a heading
  ok(/txtRows\('reg', null, true\);/.test(UI) && /DECG\.cur = 'txt';/.test(UI) && /txtRows\(q, det, false\);/.test(UI), 'the panel: the registration and six pieces share their face rows');
  ok(/regFace: null, regB: 1, regI: 0, regSl: 0, regLine: null, regSide: 0,/.test(UI), 'the editor\'s own decal keys carry the registration\'s new ones (a key missing there is dropped on load)');
  ok(/A\.AERO_TXT_LDEF && A\.AERO_TXT_FIELDS && A\.AERO_TXT_N/.test(UI) && /DEC_DEF\[key\] = A\.AERO_TXT_LDEF\[k\]/.test(UI), 'the pieces\' keys are folded into DEC_DEF (so they save and load)');
  ok(/'the left side only', 'the right side only'/.test(UI) && /'outline'/.test(UI) && /'slant'/.test(UI), 'sides, outline and slant are offered');
  ok(/by\.txt\.length\) emitEls\(p0, 'lettering'/.test(ED), 'the finish view gives the lettering its own heading');
  ok(/window\.addEventListener\('aero-face'/.test(UI), 'the panel redraws when a face arrives');

  console.log(n + ' checks');   // run_gates reads the verdict line exact: "GATE <ID>: PASS" and nothing after it
  console.log((fails ? 'GATE LIVERYTEXT: FAIL (' + fails + ' of ' + n + ')' : 'GATE LIVERYTEXT: PASS'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('GATE LIVERYTEXT: FAIL (' + (e && e.stack || e) + ')'); process.exit(1); });
