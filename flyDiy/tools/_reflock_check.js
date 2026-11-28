// _reflock_check.js - GATE REFLOCK (REF-LOCK, the user 21 Nov 2026: "it's a lot better when sliders are hidden when the
// value is editable only after unlocking from the reference section. We do that in some section, but mostly not. Can we
// have this for all?"). ONE RULE for a locked garage row (_cage_ui.js rowLock): a frame row that FOLLOWS the reference
// section (`follow`, its "follows" tick) and a row LINKED to another (`link`) - while locked the slider, its number box
// and its metres readout are hidden (the label and the tick stay, so it can be unlocked); unlocked, they show.
//
//   1  rowLock itself (run alone in a vm): locked hides all three widgets of a follow row and of a link row, unlocked
//      shows them; a follow row is also disabled while it follows, a link row never is
//   2  EVERY lock path goes through it: syncFollow and syncSliders' follow and link branches call rowLock, and no
//      other code in _cage_ui.js hides or greys a follow / link row's widgets on its own (one mechanism)
//   3  the rows: every `follow` row and every `link` row the garage pages declare is a row the rule covers (the two
//      option names mkRow reads), so a new locked row cannot bypass it
//
// --selftest: the rule as it was (the follow rows only greyed: disabled, still drawn) must FAIL row 1 - the gate is
// not blind.
// Usage: node tools/_reflock_check.js [--selftest]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = __dirname;
let fails = 0;
const ok = (c, label, extra) => { console.log((c ? '  ok     ' : '  FAIL   ') + label + (extra != null ? '  [' + extra + ']' : '')); if (!c) fails++; };
const UI = fs.readFileSync(path.join(T, '_cage_ui.js'), 'utf8');

// the function's source, by brace matching from its header
function fnSource(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}
const widget = () => ({ style: { display: '' }, disabled: false });
const metaOf = kind => ({ el: widget(), vf: widget(), mu: widget(),
  row: { cls: new Set(), classList: { toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, _s: new Set() } },
  followEl: kind === 'follow' ? {} : null, linkEl: kind === 'link' ? {} : null });
const shown = m => [m.el, m.vf, m.mu].filter(e => e.style.display !== 'none').length;

function rule1(src, tag) {
  const f = fnSource(src, 'rowLock');
  if (!f) { ok(false, tag + '1 rowLock exists in _cage_ui.js'); return false; }
  const ctx = {}; vm.createContext(ctx); vm.runInContext(f + '\nthis.rowLock = rowLock;', ctx);
  let good = true;
  for (const kind of ['follow', 'link']) {
    const m = metaOf(kind);
    ctx.rowLock(m, true);
    const h = shown(m) === 0;
    good = good && h;
    ok(h, tag + '1 a locked ' + kind + ' row shows no slider, number box or readout', shown(m) + ' of 3 shown');
    if (kind === 'follow') ok(m.el.disabled === true, tag + '1 ...and a following row is disabled while it follows');
    ctx.rowLock(m, false);
    const s = shown(m) === 3;
    good = good && s;
    ok(s, tag + '1 unlocked, the ' + kind + ' row shows all three', shown(m) + ' of 3 shown');
    if (kind === 'link') ok(m.el.disabled === false, tag + '1 a link row is never disabled by the rule');
  }
  return good;
}

if (process.argv.includes('--selftest')) {
  // the rule as it was for the follow rows: greyed, still drawn
  const OLD = 'function rowLock(meta, locked) {\n  if (meta.el) meta.el.disabled = !!locked;\n  if (meta.vf) meta.vf.disabled = !!locked;\n}\n';
  const f0 = fails;
  const caught = (() => { const save = console.log; console.log = () => {}; try { return !rule1(OLD, 'selftest '); } finally { console.log = save; } })();
  fails = f0;
  ok(caught, 'selftest: the old grey-only rule fails row 1 (the gate sees a locked row that still shows its slider)');
}

console.log('REFLOCK 1 - the rule');
rule1(UI, '');

console.log('REFLOCK 2 - one mechanism');
{
  const sf = fnSource(UI, 'syncFollow') || '', ss = fnSource(UI, 'syncSliders') || '';
  ok(/rowLock\(meta,\s*on\)/.test(sf), '2 syncFollow locks through rowLock');
  const fb = ss.slice(ss.indexOf('if (meta.followEl)'), ss.indexOf('if (meta.followEl)') + 400);
  ok(/rowLock\(meta,\s*on\)/.test(fb), '2 syncSliders\' follow branch locks through rowLock');
  const lb = ss.slice(ss.indexOf('if (meta.linkEl)'), ss.indexOf('if (meta.linkEl)') + 500);
  ok(/rowLock\(meta,\s*on\)/.test(lb), '2 syncSliders\' link branch locks through rowLock');
  // no path of its own: outside rowLock, nothing in the two syncs sets a widget's display or a follow row's disabled
  const rest = (sf + ss).replace(/rowLock\([^)]*\)/g, '');
  ok(!/\b(el|meta\.el|meta\.vf|meta\.mu)\.style\.display\s*=/.test(rest) && !/\b(el|meta\.el|meta\.vf)\.disabled\s*=\s*on\b/.test(rest),
     '2 no other code in the syncs hides or greys a locked row\'s widgets');
}

console.log('REFLOCK 3 - every locked row is a row the rule covers');
{
  // (mkRow is an arrow function: its option handling is read directly)
  ok(/if \(opts\.follow\) \{[\s\S]{0,700}meta\.followEl = fc;/.test(UI), '3 mkRow gives every `follow` row its followEl (the rule\'s follow key)');
  ok(/if \(opts\.link\) \{[\s\S]{0,700}meta\.linkEl = lc;/.test(UI), '3 mkRow gives every `link` row its linkEl (the rule\'s link key)');
  // the pages' declared locked rows, counted (a report: every one of them goes through mkRow's two branches above)
  let nF = 0, nL = 0;
  for (const f of fs.readdirSync(T).filter(n => /^_cage_.*\.js$|^_gear_page\.js$|^_eng_page\.js$/.test(n))) {
    const s = fs.readFileSync(path.join(T, f), 'utf8');
    nF += (s.match(/\bfollow:\s*['"(a-zA-Z]/g) || []).length; nL += (s.match(/\blink:\s*\{/g) || []).length;
  }
  ok(nF > 0 && nL > 0, '3 the pages declare locked rows: ' + nF + ' follow, ' + nL + ' link - all drawn by mkRow, all locked by rowLock');
}

console.log(fails ? 'GATE REFLOCK: FAIL (' + fails + ')' : 'GATE REFLOCK: PASS');
process.exit(fails ? 1 : 0);
