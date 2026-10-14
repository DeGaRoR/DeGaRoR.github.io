#!/usr/bin/env node
// GATE CARDS (G3060-G3069, CARDS-CORNER) - NO RESULT CARD IN THE MIDDLE OF THE SCREEN.
//
// The user, 8 Oct: "no more cards in the middle of the screen, ever. That's for enjoying the crash." - and 12 Oct:
// "the certifications, the end of the flight, the crash, all of them should appear in the bottom left, not hide the
// plane." Every card that APPEARS without the player asking (the arrival / end-of-flight card and its crash form, the
// bench's run card and its award / certificate, the career's lines on the arrival card) sits in the lower-left corner
// of the view, compact. A panel the player OPENS (the controls, the credits, the welcome before any aeroplane) may
// stay centred: it is a document, not a result, and it is on the allow-list below by name, with its reason.
//
//   S1  THE SCAN: every CSS rule of src/viewer (the .css files, the CSS blocks inside the .js / .html sources and every
//       `style.cssText = ...` statement) - none CENTRES a box (top AND left in the middle band 20-80 % / vw / vh, or a
//       left of `... / 2` with such a top, with or without translate(-50%, -50%)), and no full-screen host
//       (inset:0) centres its child (place-items / place-content center, or justify-content + align-items center),
//       except the allow-list. The scan proves its reach (files, rules, cssText statements) and every allow-list
//       entry still matches a rule (a stale entry is red: the list stays honest)
//   S2  THE RESULT CARDS' OWN RULES (#arrCard, #bAward, #bRun - any selector, any @media): no left in % / vw, no
//       top but `auto`, no right anchor outside a narrow / phone context, no translate(-50%...) in their rules or
//       their entry keyframes (bAwIn, bRunIn); the base rules anchor left + bottom
//   D   THE BOXES (headless Chrome, --disable-gpu, a bare page with the seven real stylesheets and the cards'
//       markup; SKIP without Chrome; ~3 s): the arrival card (a full one: ten rows, notes, three verbs; and its
//       crash form), the award (a pass with its roundel, a fail with its notes, the master, a wreck's) and the run
//       card, laid out by Chrome:
//         D1 the flight at 1920x1080 and 1280x720: each box in the LOWER-LEFT QUADRANT of the viewport (right <= W/2,
//            top >= H/2), beside the look rail (#flRail, ten buttons, not under the card), and at 1920x1080 none
//            overlaps the central 50 % x 50 % (the crash rule's row)
//         D2 the workshop at 1920x1080 (body.mode-ws, its --ws-left / --ws-right): each box in the lower-left quadrant
//            of the VIEW between the panels
//         D3 a narrow window flying (390x844, no phone profile): the arrival card a bottom sheet, its top below H/2
//         D4 the phone profile (html.phone; 390x844 portrait, 844x390 landscape): the bench's cards on the sheet,
//            never over the view (portrait: top >= the view's height; landscape: left >= the view's width)
//         D5 THE PROBE GOES RED: the master's old rule (#arrCard left/top 50 % + translate) injected - D1 says no
//
//   node tools/_cards_check.js [--verbose] [--no-browser] [--selftest] [--view=<a copy of src/viewer>]  -> "GATE CARDS: PASS|FAIL|SKIP"
//   --selftest: the scan run on the master's old rules (f353a0f89: #arrCard, #bAward, body.mode-fly #bAward, #bRun)
//   and on a centred host / cssText - every one must be caught; the allow-listed ones must not be.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
// --view=<dir>: scan another copy of src/viewer (the negative proof: a checkout of the old sources goes red)
const VIEW = (process.argv.find(a => a.startsWith('--view=')) || '').slice(7) || path.join(ROOT, 'src', 'viewer');
const VERBOSE = process.argv.includes('--verbose');
const NO_BROWSER = process.argv.includes('--no-browser');
const SELFTEST = process.argv.includes('--selftest');
const fails = [];
let nOk = 0;
const check = (ok, label, extra) => {
  if (!ok || VERBOSE) console.log((ok ? '  ok     ' : '  FAIL   ') + label + (extra ? ' - ' + extra : ''));
  if (ok) nOk++; else fails.push(label);
  return ok;
};

// ---- THE ALLOW-LIST: user-opened panels, each with its reason (a key is matched against the rule's selector) ---------
const ALLOW = {
  '#ctlPanel': 'controls.css: the controls panel - the player opens it; a document, not a result',
  '#welcome': 'welcome.js: the first-launch screen - before any aeroplane exists',
  'music.js#musicCredits': 'audio/music.js: the music & sound credits - opened from the sound menu',
  '#flReticle': 'flight.css: the 10 px aiming reticle - the centre IS its meaning, not a card',
  '#gFleet': "editor.css: the fleet popup - the garage's load door, the player opens it",
  '#dfBirth': 'editor.css: the birth overlay - a new aeroplane, the player opens it',
  '#hsStore': "storage_ui.js (HANGAR-STORAGE G2690): the storage screen - the garage's 'storage' button opens it (beside 'load'); its .hsAsk is the Fly confirmation the player asks for, inside it",
};
// the result cards S2 holds by name, and their entry keyframes
const CARDS = ['#arrCard', '#bAward', '#bRun'];
const CARD_KEYFRAMES = ['bAwIn', 'bRunIn'];

// ---- a CSS reader: leaf rules with their @media context (keyframes kept apart) -----------------------------------
function cssRules(text, file, lineBase) {
  const out = [], keyframes = [];
  const src = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));   // comments out, lines kept
  const lineAt = i => (lineBase || 1) + (src.slice(0, i).match(/\n/g) || []).length;
  function walk(i, end, ctx) {
    let pre = '', preAt = i;
    while (i < end) {
      const c = src[i];
      if (c === '{') {
        const close = matchBrace(i);
        const sel = pre.trim();
        if (/^@keyframes/i.test(sel) || /^@-webkit-keyframes/i.test(sel)) keyframes.push({ name: sel.split(/\s+/)[1], body: src.slice(i + 1, close), file, line: lineAt(preAt) });
        else if (/^@(media|supports|container|layer)/i.test(sel)) walk(i + 1, close, ctx.concat(sel));
        else if (!/^@/.test(sel) && sel) out.push({ sel, body: src.slice(i + 1, close), ctx, file, line: lineAt(preAt + (pre.length - pre.trimStart().length)) });
        i = close + 1; pre = ''; preAt = i; continue;
      }
      if (c === '}' || c === ';' && !pre.trim().startsWith('@')) { pre = ''; preAt = i + 1; i++; continue; }
      pre += c; i++;
    }
  }
  function matchBrace(i) { let d = 0; for (let k = i; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return k; } return src.length; }
  walk(0, src.length, []);
  return { rules: out, keyframes };
}
function decls(body) {
  const d = {};
  for (const part of body.split(';')) {
    const k = part.indexOf(':'); if (k < 0) continue;
    const p = part.slice(0, k).trim().toLowerCase(), v = part.slice(k + 1).trim().replace(/\s*!important$/i, '').toLowerCase();
    if (/^[a-z-]+$/.test(p)) d[p] = v;
  }
  return d;
}

// ---- THE CENTRING TEST ------------------------------------------------------------------------------------------
const midBand = v => {
  if (v == null) return false;
  const m = /^(-?\d+(?:\.\d+)?)(%|vw|vh)$/.exec(v.trim());
  if (m) return +m[1] >= 20 && +m[1] <= 80;
  return /^calc\(\s*50(%|vw|vh)/.test(v);   // calc(50% - ...): the middle, nudged
};
const halfLeft = v => v != null && /^calc\(/.test(v) && /\/\s*2\s*\)\s*$/.test(v);
const transCentre = v => v != null && /translate\(\s*-50%\s*,\s*-[2-7]\d(\.\d+)?%\s*\)/.test(v);
function centred(d) {
  const top = d.top, left = d.left;
  const midT = midBand(top), midL = midBand(left) || halfLeft(left);
  if (midT && midL) return 'top ' + top + ' + left ' + left + (transCentre(d.transform) ? ' + ' + d.transform : '');
  const full = d.inset === '0' || d.inset === '0px' || ['top', 'left', 'right', 'bottom'].every(k => d[k] === '0' || d[k] === '0px');
  const pos = d.position === 'fixed' || d.position === 'absolute';
  const centresChild = d['place-items'] === 'center' || d['place-content'] === 'center' ||
    (d['justify-content'] === 'center' && d['align-items'] === 'center');
  if (full && pos && centresChild) return 'a full-screen host (inset 0) centring its child';
  return null;
}
const allowKey = (sel, where) => Object.keys(ALLOW).find(k => k.includes('#') && k.indexOf('.js#') > 0
  ? where === k : sel.split(',').some(s => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(s)));

// ---- THE SOURCES ------------------------------------------------------------------------------------------------
function listSources(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listSources(p));
    else if (/\.(css|js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
// CSS blocks inside a .js / .html source: `selector{decls}` where the selector reads as CSS and the decls carry a
// position or a centring property; and every `.cssText = ...` statement, its string pieces joined
function scanJs(text, rel) {
  const rules = [], keyframes = [];
  // <style> in html, or css held in strings: the leaf blocks whose body is declarations
  const blk = /([#.a-zA-Z@][^{};'"`\n]*)\{([^{}]*)\}/g;
  let m;
  while ((m = blk.exec(text))) {
    const sel = m[1].trim(), body = m[2];
    if (!/^[#.\w][\w\s#.,:>~+\-[\]="()*^$|]*$/.test(sel) || /\b(if|for|while|else|return|function|const|let|var|switch|catch|try|do)\b/.test(sel)) continue;
    if (!/(^|;|\s|')(position|top|left|inset|place-items|place-content|justify-content|transform)\s*:/.test(body)) continue;
    rules.push({ sel, body: body.replace(/['"`]\s*\+\s*['"`]/g, ''), ctx: [], file: rel, line: text.slice(0, m.index).split('\n').length });
  }
  const ct = /\.cssText\s*\+?=\s*/g;
  while ((m = ct.exec(text))) {
    const rest = text.slice(m.index + m[0].length);
    const endM = /['"`]\s*\)?\s*;[ \t]*(\r?\n|$)/.exec(rest);
    const stmt = endM ? rest.slice(0, endM.index + 1) : rest.split('\n')[0];
    const pieces = stmt.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`/g) || [];
    const body = pieces.map(p => p.slice(1, -1)).join('');
    const line = text.slice(0, m.index).split('\n').length;
    // the element: an `.id = '...'` on the few lines above names it
    const above = text.slice(0, m.index).split('\n').slice(-4).join('\n');
    const idm = /\.id\s*=\s*['"]([\w-]+)['"]/.exec(above);
    rules.push({ sel: idm ? '#' + idm[1] : '(cssText)', where: path.basename(rel) + (idm ? '#' + idm[1] : ''), body, ctx: [], file: rel, line, cssText: true });
  }
  return { rules, keyframes };
}

function scanAll(files) {
  const all = [], kfs = [];
  let nCss = 0, nText = 0;
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const text = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.css')) { const r = cssRules(text, rel); all.push(...r.rules); kfs.push(...r.keyframes); nCss++; }
    else { const r = scanJs(text, rel); all.push(...r.rules); nText++; }
  }
  return { rules: all, keyframes: kfs, nCss, nText };
}

// S1 over a rule list -> { bad: [...], allowedHit: Set }
function judgeCentred(rules) {
  const bad = [], hit = new Set();
  for (const r of rules) {
    const why = centred(decls(r.body));
    if (!why) continue;
    const k = allowKey(r.sel, r.where);
    if (k) { hit.add(k); continue; }
    bad.push(r.file + ':' + r.line + ' ' + r.sel + ' (' + why + ')');
  }
  return { bad, hit };
}
// S2 over a rule list
const narrowCtx = r => r.ctx.some(c => /max-width\s*:\s*\d+px/.test(c)) || /html\.phone/.test(r.sel);
function judgeCards(rules, keyframes) {
  const bad = [];
  for (const r of rules) {
    const card = CARDS.find(c => new RegExp(c + '(?![\\w-])').test(r.sel));
    if (!card) continue;
    // a descendant's rule (#bAward canvas, #arrCard #arrHead) positions the child, not the card
    const last = r.sel.split(',').map(s => s.trim().split(/\s+/).pop());
    if (!last.some(s => new RegExp('^' + card + '(?![\\w-])').test(s) || new RegExp('^[\\w.]*' + card + '(?![\\w-])').test(s))) continue;
    const d = decls(r.body);
    const at = r.file + ':' + r.line + ' ' + r.sel;
    if (d.left != null && /(%|vw)/.test(d.left) && !/var\(--ph-sl\)/.test(d.left)) bad.push(at + ': left ' + d.left);
    if (d.top != null && d.top !== 'auto') bad.push(at + ': top ' + d.top);
    if (d.right != null && d.right !== 'auto' && !narrowCtx(r)) bad.push(at + ': right ' + d.right + ' (the corner is the LEFT one)');
    if (d.transform != null && /translate(x)?\(\s*-50%/.test(d.transform)) bad.push(at + ': transform ' + d.transform);
  }
  for (const k of keyframes) if (CARD_KEYFRAMES.includes(k.name) && /translate(x)?\(\s*-50%/i.test(k.body)) bad.push(k.file + ':' + k.line + ' @keyframes ' + k.name + ': a centring translate');
  return bad;
}

// ---- THE SELFTEST: the master's old rules must be caught ----------------------------------------------------------
if (SELFTEST) {
  const OLD = `
#arrCard { position:absolute; left:50%; top:50%;
  transform:translate(-50%,-50%); width:520px; }
#bAward { position:fixed; z-index:62; top:50%;
  left:calc(var(--ws-left, 0px) + (100vw - var(--ws-left, 0px) - var(--ws-right, 0px)) / 2);
  transform:translate(-50%,-50%); width:340px; }
body.mode-fly #bAward { left:50vw; top:38%; }
#bRun { position:fixed; bottom:26px;
  left:calc(var(--ws-left, 0px) + (100vw - var(--ws-left, 0px) - var(--ws-right, 0px)) / 2);
  transform:translateX(-50%); }
@keyframes bAwIn { from { opacity:0; transform:translate(-50%,-46%); } to { opacity:1; transform:translate(-50%,-50%); } }
#someNewCard { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; }
#ctlPanel { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); }
@media (max-width:760px) { #arrCard { right:12px; left:12px; } }
`;
  const r = cssRules(OLD, 'selftest.css');
  const c = judgeCentred(r.rules);
  const s2 = judgeCards(r.rules, r.keyframes);
  check(c.bad.some(b => /#arrCard/.test(b)), 'selftest S1 catches the old #arrCard (left / top 50 % + translate)');
  check(c.bad.some(b => /^\S+ #bAward \(/.test(b)), 'selftest S1 catches the old #bAward (top 50 %, left ... / 2)');
  check(c.bad.some(b => /mode-fly #bAward/.test(b)), 'selftest S1 catches the old body.mode-fly #bAward (50vw / 38 %)');
  check(c.bad.some(b => /#someNewCard/.test(b)), 'selftest S1 catches a full-screen host centring its child');
  check(!c.bad.some(b => /#ctlPanel/.test(b)) && c.hit.has('#ctlPanel'), 'selftest S1 lets the allow-listed #ctlPanel through, and counts it');
  check(s2.some(b => /#bRun.*translatex\(-50%/i.test(b)), 'selftest S2 catches the old #bRun (bottom-centred: translateX(-50%))');
  check(s2.some(b => /@keyframes bAwIn/.test(b)), 'selftest S2 catches the old bAwIn keyframes');
  check(!s2.some(b => /right 12px/.test(b)), 'selftest S2 allows a right anchor in a narrow @media (the bottom sheet)');
  const js = scanJs(`const box = D.createElement('div');\n    box.id = 'myPop';\n    box.style.cssText = 'position:fixed;left:50%;top:50%;' +\n      'transform:translate(-50%,-50%)';\n`, 'self.js');
  check(judgeCentred(js.rules).bad.some(b => /#myPop/.test(b)), 'selftest S1 catches a centred cssText (two string pieces), named by its .id');
  const js2 = scanJs("const css = '#pop{position:fixed;left:50%;top:50%;transform:translate(-50%, -50%)}';\n", 'self2.js');
  check(judgeCentred(js2.rules).bad.some(b => /#pop/.test(b)), 'selftest S1 catches a centred rule inside a JS string');
  console.log('GATE CARDS selftest: ' + (fails.length ? 'FAIL' : 'PASS') + ' (' + nOk + ' ok, ' + fails.length + ' red)');
  process.exit(fails.length ? 1 : 0);
}

// ---- S1 + S2 on the sources -------------------------------------------------------------------------------------
const files = listSources(VIEW);
const S = scanAll(files);
const nCssText = S.rules.filter(r => r.cssText).length;
check(S.nCss >= 7 && S.rules.length > 1100 && nCssText >= 20, 'S1 the scan reaches the sources',
  S.nCss + ' stylesheets, ' + S.nText + ' js / html sources, ' + S.rules.length + ' rules (' + nCssText + ' cssText statements)');
const J = judgeCentred(S.rules);
check(!J.bad.length, 'S1 no result card centred in src/viewer (top + left in the middle band, or a full-screen centring host)',
  J.bad.length ? J.bad.length + ':\n           ' + J.bad.join('\n           ') : '');
const stale = Object.keys(ALLOW).filter(k => !J.hit.has(k));
check(!stale.length, 'S1 every allow-list entry still matches a centred rule (the list stays honest)', stale.length ? 'stale: ' + stale.join(', ') : Object.keys(ALLOW).join(', '));
for (const c of CARDS) check(S.rules.some(r => r.sel.split(',').map(s => s.trim()).includes(c)), 'S1 the scan sees ' + c + "'s own rule");
const C2 = judgeCards(S.rules, S.keyframes);
check(!C2.length, 'S2 the result cards (#arrCard, #bAward, #bRun) anchor left + bottom: no % left, no top, no right outside a narrow context, no centring translate (rules and bAwIn / bRunIn)',
  C2.length ? '\n           ' + C2.join('\n           ') : '');
const base = sel => S.rules.filter(r => r.sel === sel && !r.ctx.length).map(r => decls(r.body)).reduce((a, d) => Object.assign(a, d), {});
for (const c of CARDS) { const d = base(c); check(d.left != null && d.bottom != null, 'S2 ' + c + "'s base rule anchors left and bottom", 'left ' + d.left + ', bottom ' + d.bottom); }

// ---- D: THE BOXES, laid out by Chrome ---------------------------------------------------------------------------
const CHROME = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .find(p => p && fs.existsSync(p));
function finish(skipped) {
  const verdict = fails.length ? 'FAIL' : 'PASS';
  console.log(nOk + ' ok, ' + fails.length + ' red' + (skipped ? ' (D skipped: ' + skipped + ')' : ''));
  console.log('GATE CARDS: ' + verdict);
  process.exit(fails.length ? 1 : 0);
}
if (NO_BROWSER) finish('--no-browser');
else if (!CHROME) finish('no Chrome / Chromium on this machine');
else if (typeof WebSocket === 'undefined') finish('no WebSocket in this node (22+ has it)');
else runDom().then(() => finish(), e => { check(false, 'D the headless page ran', e.message); finish(); });

// the page: the seven stylesheets in dev.html's order and the cards' markup (body.html's #arrCard; bench.js's award)
const SHEETS = ['style.css', 'editor.css', 'flight.css', 'controls.css', 'bench.css', 'blueprint.css', 'phone.css'];
const ROWS = ['outcome', 'flight time', 'distance', 'touchdown', 'off centreline', 'landing run', 'past the aim', 'peak strain', 'career', 'wallet']
  .map((l, i) => '<div><span>' + l + '</span><b>' + (i === 8 ? 'Freight delivered to Metlakatla - paid 1 240' : i === 3 ? '92 km/h · 1.23 m/s' : '1' + i + '.4 km') + '</b></div>').join('');
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${SHEETS.map(s => '<link rel="stylesheet" href="/src/viewer/' + s + '">').join('\n')}
<style id="probe"></style></head><body class="mode-fly">
<canvas id="c"></canvas>
<div id="ui">
  <div id="flRail">${'<button class="flRailBtn"><svg viewBox="0 0 16 16"></svg><span>look</span></button>'.repeat(10)}</div>
  <div id="arrCard"><div id="arrHead"><b id="arrTitle">Arrived at Metlakatla Seaplane Base</b><span id="arrTag">landed</span></div>
    <div id="arrRows">${ROWS}</div>
    <div id="arrNotes"><i>Held the speed on final; the flare was late.</i><i>The roll-out drifted left of the centreline.</i></div>
    <div id="arrBtns"><button id="bLog" class="pri">Log the flight</button><button id="bWhy">What went wrong</button><button id="bBring">Bring it home</button></div></div>
</div>
<div id="bRun"><div class="bRh"><span class="bRk">test</span><span class="bRn">The circuit</span><span class="bRt">0:42</span><button class="bRx">stop</button></div>
  <div class="bRph"><span class="done">take-off</span><span class="now">climb</span><span>circuit</span><span>landing</span></div>
  <div class="bRbar"><i style="width:40%"></i></div><div class="bRlive"><span>alt <b>310 m</b></span><span>speed <b>112 km/h</b></span></div>
  <canvas class="bRtrace" width="400" height="190"></canvas><div class="bRnotes"><div>the climb is slow at this weight</div></div></div>
<div id="bAward"></div>
<script>
const AW = {
  pass: ['', '<div class="bAk">certificate awarded</div><div class="bAn">The circuit</div><canvas width="300" height="300"></canvas><div class="bAs">certified</div><div class="bAv"><b>FLEW THE CIRCUIT</b><br>landing run 212 m · touchdown 1.10 m/s · 34 m past the aim · 6 min</div><div class="bAd">12 Oct 2026 · the sticker is on the fuselage · click to close</div>'],
  fail: ['no', '<div class="bAk">not awarded</div><div class="bAn">The wing loading</div><div class="bAs">failed</div><div class="bAv"><b>TOO HEAVY FOR ITS WING</b><br>62 kg/m² against the 55 the class allows</div><div class="bAf">the wing carries the weight at too high a speed<br>→ more span, more chord, or less weight</div><div class="bAdvice done"><span>what the levers buy</span><div>+0.6 m span: 54 kg/m²</div><div>-40 kg: 55 kg/m²</div></div><div class="bAd">12 Oct 2026 · click to close</div>'],
  master: ['master', '<div class="bAk">airworthiness certificate</div><div class="bAn">F-PXYZ</div><canvas width="360" height="360"></canvas><div class="bAs">airworthy</div><div class="bAv">the bench check, the wing loading and the test flight are held</div><div class="bAd">12 Oct 2026 · the master roundel is on the fuselage · click to close</div>'],
  wreck: ['no wreck', '<div class="bAk">not awarded</div><div class="bAn">The circuit</div><div class="bAs">failed</div><div class="bAv"><b>NOT CERTIFIED</b><br>no landing</div><div class="bAf">→ Not certified - the aeroplane was damaged: the left wing broke at the root.</div><div class="bAd">12 Oct 2026 · click to close</div>'],
};
window.MEASURE = (o) => {
  document.documentElement.className = o.phone ? 'phone' : '';
  document.body.className = o.body;
  document.getElementById('probe').textContent = o.probe || '';
  const arr = document.getElementById('arrCard'), aw = document.getElementById('bAward'), run = document.getElementById('bRun');
  arr.className = o.arr || ''; arr.hidden = !o.showArr;
  run.hidden = !o.showRun;
  aw.hidden = !o.aw; if (o.aw) { aw.className = AW[o.aw][0]; aw.innerHTML = AW[o.aw][1]; }
  const cs = getComputedStyle(document.body);
  const box = el => { if (el.hidden) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  return JSON.stringify({ W: innerWidth, H: innerHeight, wsL: parseFloat(cs.getPropertyValue('--ws-left')) || 0, wsR: parseFloat(cs.getPropertyValue('--ws-right')) || 0,
    phVw: (() => { const p = document.createElement('div'); p.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:var(--ph-vw)'; document.body.appendChild(p); const w = p.getBoundingClientRect().width; p.remove(); return w; })(),   // (a calc() custom property does not resolve through getPropertyValue: measured on a probe)
    arr: box(arr), aw: box(aw), run: box(run), rail: box(document.getElementById('flRail')) });
};
</script></body></html>`;

async function runDom() {
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/' || u === '/index.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(PAGE); return; }
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !/\.css$/.test(f) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': 'text/css' }); r.end(fs.readFileSync(f));
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const port = srv.address().port, dbg = 9100 + (process.pid % 700);
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp_cards_'));
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--remote-debugging-port=' + dbg, '--user-data-dir=' + udd].concat(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []).concat(['about:blank']), { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
  let ws = null;
  try {
    let tgt = null; for (let i = 0; i < 60 && !tgt; i++) { await sleep(250); try { tgt = (await getJSON('http://127.0.0.1:' + dbg + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target from Chrome');
    ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP socket')); });
    let id = 0; const waits = new Map(); ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    await cmd('Page.enable');
    const size = async (w, h, mobile) => { await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile }); await sleep(60); };
    await size(1920, 1080);
    await cmd('Page.navigate', { url: 'http://127.0.0.1:' + port + '/index.html' });
    let ready = false; for (let i = 0; i < 80 && !ready; i++) { await sleep(150); ready = (await cmd('Runtime.evaluate', { expression: 'typeof MEASURE === "function" && document.readyState === "complete" && document.styleSheets.length >= 8', returnByValue: true })).result.result.value; }
    if (!ready) throw new Error('the page never loaded its stylesheets');
    const measure = async o => { const r = await cmd('Runtime.evaluate', { expression: 'MEASURE(' + JSON.stringify(o) + ')', returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return JSON.parse(r.result.result.value); };
    const f1 = v => Math.round(v);
    const say = b => b ? f1(b.l) + ',' + f1(b.t) + ' ' + f1(b.w) + 'x' + f1(b.h) : 'none';
    // the lower-left quadrant of a view [x0, x1] x [0, H]
    const inLL = (b, x0, x1, H) => !!b && b.w > 50 && b.h > 30 && b.l >= x0 - 0.5 && b.r <= (x0 + x1) / 2 + 0.5 && b.t >= H / 2 - 0.5 && b.b <= H + 0.5;
    const meets = (a, b) => !!a && !!b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const offCentre = (b, W, H) => !!b && (b.r <= W * 0.25 + 0.5 || b.l >= W * 0.75 - 0.5 || b.b <= H * 0.25 + 0.5 || b.t >= H * 0.75 - 0.5);

    // D1 THE FLIGHT
    for (const [W, H] of [[1920, 1080], [1280, 720]]) {
      await size(W, H);
      for (const [name, o, key] of [
        ['the arrival card (ten rows, notes, three verbs)', { body: 'mode-fly', showArr: true }, 'arr'],
        ["the crash's arrival card", { body: 'mode-fly', showArr: true, arr: 'bad wreck' }, 'arr'],
        ['the flown award (a pass, its roundel)', { body: 'mode-fly', aw: 'pass' }, 'aw'],
        ['the airworthiness certificate (the master)', { body: 'mode-fly', aw: 'master' }, 'aw'],
        ["a wreck's award (not certified)", { body: 'mode-fly', aw: 'wreck' }, 'aw'],
        ['the run card (a flown test)', { body: 'mode-fly', showRun: true }, 'run'],
      ]) {
        const m = await measure(o), b = m[key];
        check(inLL(b, 0, W, H), `D1 ${W}x${H} flight: ${name} in the lower-left quadrant`, say(b));
        check(!meets(b, m.rail), `D1 ${W}x${H} flight: ${name} beside the look rail, not on it`, say(b) + ' / rail ' + say(m.rail));
        if (W === 1920) check(offCentre(b, W, H), `D1 ${W}x${H} flight: ${name} clear of the central 50 % x 50 %`, say(b));
      }
    }
    // D2 THE WORKSHOP (the view between the panels)
    await size(1920, 1080);
    for (const [name, o, key] of [
      ['the award (a pass)', { body: 'mode-ws', aw: 'pass' }, 'aw'],
      ['the award (a fail with its advisor)', { body: 'mode-ws', aw: 'fail' }, 'aw'],
      ['the airworthiness certificate', { body: 'mode-ws', aw: 'master' }, 'aw'],
      ['the run card', { body: 'mode-ws', showRun: true }, 'run'],
    ]) {
      const m = await measure(o), b = m[key];
      check(m.wsL > 0 && inLL(b, m.wsL, m.W - m.wsR, m.H), `D2 1920x1080 workshop: ${name} in the lower-left quadrant of the view (${m.wsL}..${m.W - m.wsR})`, say(b));
    }
    // D3 A NARROW WINDOW FLYING
    await size(390, 844, true);
    for (const [name, o] of [['the arrival card', { body: 'mode-fly', showArr: true }], ["the crash's card", { body: 'mode-fly', showArr: true, arr: 'bad wreck' }]]) {
      const m = await measure(o), b = m.arr;
      check(!!b && b.t >= m.H / 2 - 0.5 && b.l >= 0 && b.r <= m.W + 0.5 && b.b <= m.H + 0.5, `D3 390x844 narrow flight: ${name} a bottom sheet, its top below the middle`, say(b));
      check(!meets(b, m.rail), `D3 390x844 narrow flight: ${name} beside the look rail`, say(b) + ' / rail ' + say(m.rail));
    }
    // D4 THE PHONE PROFILE
    for (const [W, H, land] of [[390, 844, false], [844, 390, true]]) {
      await size(W, H, true);
      for (const [name, o, key] of [['the award (a fail with its advisor)', { phone: true, body: 'mode-ws', aw: 'fail' }, 'aw'],
        ['the certificate', { phone: true, body: 'mode-ws', aw: 'master' }, 'aw'], ['the run card', { phone: true, body: 'mode-ws', showRun: true }, 'run']]) {
        const m = await measure(o), b = m[key];
        const ok = !!b && b.w > 50 && b.b <= H + 0.5 && b.l >= -0.5 && b.r <= W + 0.5 && (land ? m.phVw > W / 3 && b.l >= m.phVw - 0.5 : b.t >= H * 0.4 - 0.5);
        check(ok, `D4 phone ${W}x${H}: ${name} on the sheet, never over the view (${land ? 'left >= ' + f1(m.phVw) : 'top >= ' + f1(H * 0.4)})`, say(b));
      }
    }
    // D5 THE PROBE GOES RED
    await size(1920, 1080);
    const m = await measure({ body: 'mode-fly', showArr: true, probe: '#arrCard{left:50%!important;top:50%!important;bottom:auto!important;transform:translate(-50%,-50%)!important}' });
    check(!inLL(m.arr, 0, m.W, m.H) && !offCentre(m.arr, m.W, m.H), "D5 the master's old #arrCard rule, injected, is caught (not in the quadrant, over the centre)", say(m.arr));
    check(true, 'D the headless page ran', (await cmd('Browser.getVersion')).result.product);
  } finally {
    try { ws && ws.close(); } catch (e) {}
    try { ch.kill(); } catch (e) {}
    srv.close();
    await sleep(300);
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  }
}
