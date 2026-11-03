#!/usr/bin/env node
// aids_verdict_shot.js - THE BENCH CHECK'S CARD, BEFORE AND AFTER (DESIGN-AIDS, 2026-11-03), for the evidence: the
// build's own sheet and aids (node: buildGen + genShakedown + genDesignAids, the page's numbers), the bench's own
// BENCH_TESTS 'shake' run on a node api, its own renderers (benchKeyHtml, benchDesignHtml, benchCommLine) and its own
// stylesheet (bench.css), laid out as the award card lays them out (bench.js award()). BEFORE = the card as master had
// it (every design-check fail rejects; the 13 rows in one list); AFTER = the key issues first, the warnings, the
// commercial line, the full report folded (shown closed, then open).
//
//   node flyDiy/tools/aids_verdict_shot.js --build <file.json> --out <dir> [--name tb2] [--root <flyDiy root for the core>]
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const FLY = path.resolve(opt('root', path.join(__dirname, '..')));
const C = require(path.join(FLY, 'tools/flight_core.js'));
const BJ = require(path.join(FLY, 'tools/_bake_joined.js'));
BJ.loadPanel();
global.genCertTiers = C.genCertTiers;
const B = require(path.join(__dirname, '..', 'src/viewer/bench.js'));
const out = opt('out', '.'), name = opt('name', 'build');
const BK = BJ.bakeJoined(JSON.parse(fs.readFileSync(opt('build'), 'utf8')).spec), J = BK.spec;
const def = C.buildGen(J), sh = C.genShakedown(def, { corners: false }), A = C.genDesignAids(def, sh, { propOff: C.genAidPropOff(BK.W && BK.W.CAGE_ENG) });
const LV = C.genAidLevers(def, sh, J);
const api = { shake: () => sh, aids: () => A, hasFloats: () => !!(def.parts && def.parts.floats && def.parts.floats.length), keyIssues: (s, a, lv) => C.genKeyIssues(def, s, a, { spec: J, lv: lv || LV, levers: false }) };
const T = B.BENCH_TESTS.find(t => t.id === 'shake');
const rNew = T.run(api);
// master's rule: every design-check fail rejects, no aids, no key issues
const dOld = sh.design.rows.map(r => ({ id: r.id, label: r.label, level: r.level, value: r.value, unit: r.unit, limit: r.limit, why: r.why, fix: r.fix }));
const fOld = dOld.filter(r => r.level === 'fail');
const rOld = { ok: !!sh.flyableCircuit && !fOld.length, verdict: !sh.flyableCircuit ? 'WILL NOT FLY A CIRCUIT' : fOld.length ? 'FLIES, BUT THE DESIGN FAILS' : 'FLIES A CIRCUIT',
  note: rNew.note, why: fOld.map(r => r.label.toLowerCase() + ' fails (' + r.value + (r.unit ? ' ' + r.unit : '') + ')').join('; '),
  fix: fOld.map(r => r.fix).filter(Boolean).join('; '), design: { verdict: sh.design.verdict, rows: dOld } };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const head = (r, nm) => '<div class="bAk">' + (r.ok ? 'certificate awarded' : 'not awarded') + '</div><div class="bAn">' + nm + '</div>' +
  '<div class="bAs">' + (r.ok ? 'certified' : 'failed') + '</div><div class="bAv"><b>' + esc(r.verdict) + '</b>' + (r.note ? '<br>' + esc(r.note) : '') + '</div>';
const before = '<div class="bAward no">' + head(rOld, 'Bench check') +
  (!rOld.ok && (rOld.why || rOld.fix) ? '<div class="bAf">' + (rOld.why ? esc(rOld.why) + '<br>' : '') + (rOld.fix ? '→ ' + esc(rOld.fix) : '') + '</div>' : '') +
  B.benchDesignHtml(rOld.design) + '<div class="bAd">today · click to close</div></div>';
const after = open => '<div class="bAward ' + (rNew.ok ? '' : 'no') + '">' + head(rNew, 'Bench check') + B.benchKeyHtml(rNew) +
  (B.benchCommLine(rNew) ? '<div class="bAc">' + esc(B.benchCommLine(rNew)) + '</div>' : '') +
  '<details class="bFull"' + (open ? ' open' : '') + '><summary>full report</summary>' + B.benchDesignHtml(rNew.design) + '</details>' +
  '<div class="bAd">today · click to close</div></div>';
const css = fs.readFileSync(path.join(__dirname, '..', 'src/viewer/bench.css'), 'utf8')
  .replace(/#bAward/g, '.bAward');
// the game's own vendored faces (style.css's @font-face), inlined: the card in the garage's type, never a fallback serif
const font = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(__dirname, '..', 'vendor/fonts', f)).toString('base64');
const FACES = "@font-face{font-family:'IBM Plex Sans';font-weight:100 700;src:url(" + font('plex-sans-var.woff2') + ") format('woff2')}" +
  "@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(" + font('plex-mono-500.woff2') + ") format('woff2')}";
const page = (body, w, phone) => '<!doctype html><html class="' + (phone ? 'phone' : '') + '"><meta charset="utf-8"><style>' + FACES +
  "body{margin:0;background:#141210;color:#f4efe6;font:400 12px/1.5 'IBM Plex Sans',system-ui,sans-serif;padding:16px;}" +
  ':root,.bAward{--ed-panel:#201d1a;--ed-plate:rgba(32,29,26,.97);--ed-ink:#f4efe6;--ed-dim:#c0b8ac;--ed-faint:#97907f;--ed-acc:#e6dbc9;--ed-acc-ink:#221f1b;--ed-acc-soft:rgba(230,219,201,.14);--ed-hair:rgba(255,248,236,.09);--ed-border:rgba(255,248,236,.14);--ed-btn-bg:rgba(255,255,255,.06);--ed-btn-bd:rgba(255,255,255,.18);--ed-warn:#d8a07a;--ed-bad:#e08a5a;--ed-val:#e6dbc9}' +
  css + '.bAward .bAs{animation:none!important;opacity:1!important;transform:none!important}.bAward{position:static!important;width:' + w + 'px!important;max-height:none!important;animation:none!important;display:inline-block;vertical-align:top;margin:0 14px 14px 0}' +
  '.lab{font:600 10px/1 sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#97907f;margin:0 0 6px}</style>' + body;
fs.mkdirSync(out, { recursive: true });
const pages = {
  [name + '_verdict_before.html']: page('<div class="lab">before (master): the bench check\'s card</div>' + before, 340),
  [name + '_verdict_after.html']: page('<div class="lab">after: key issues first, the full report one tap away</div>' + after(false), 340),
  [name + '_verdict_after_full.html']: page('<div class="lab">after: the full report opened</div>' + after(true), 340),
  [name + '_verdict_phone.html']: page('<div class="lab">after, phone width (the compact list)</div>' + after(false), 328, true),
};
for (const k in pages) fs.writeFileSync(path.join(out, k), pages[k]);
console.log(JSON.stringify({ old: { ok: rOld.ok, verdict: rOld.verdict, fails: fOld.map(r => r.id) },
  now: { ok: rNew.ok, verdict: rNew.verdict, comm: rNew.comm, key: rNew.key.map(k => ({ id: k.id, tier: k.tier, level: k.level, proposed: k.proposed, what: k.what, remedy: k.remedy })) } }, null, 1));
(async () => {
  let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
  const br = await pw.chromium.launch();
  for (const k in pages) {
    const ph = /phone/.test(k);
    const p = await br.newPage({ viewport: { width: ph ? 360 : 400, height: 400 } });
    await p.setContent(pages[k]); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, k.replace(/\.html$/, '.png')), fullPage: true });
    fs.unlinkSync(path.join(out, k));
  }
  await br.close();
})();
