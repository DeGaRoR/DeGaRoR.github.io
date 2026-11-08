#!/usr/bin/env node
// cowl_study/page.js - PROPER-COWLS: the report page. Round 3 (8 Nov): one section per point the user raised on round 2,
// each a before / after strip of lit stills (plane_shot.js), then the engine x mount table.
//   node tools/cowl_study/page.js --body=<plane_shot dir> --pods=<plane_shot dir> --table=<plane_shot dir> --out=<dir>
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DIRS = { body: arg('body'), pods: arg('pods'), table: arg('table') };
const OUT = arg('out');
const T = require('./table.js');
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const jpg = (src, name, w, crop) => {
  const dst = path.join(OUT, 'img', name + '.jpg');
  const cut = crop ? ['-gravity', 'center', '-crop', crop, '+repage'] : [];
  execFileSync('convert', [src].concat(cut, ['-resize', (w || 900) + 'x', '-quality', '80', '-strip', dst]));
  return 'img/' + name + '.jpg';
};
const ls = d => (d && fs.existsSync(d) ? fs.readdirSync(d) : []).filter(f => /\.png$/.test(f)).sort();
const FILES = { body: ls(DIRS.body), pods: ls(DIRS.pods), table: ls(DIRS.table) };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// a cell: [source dir, build-file prefix, caption]; a body cell carries its second view (data-alt) when there is one
function cell([src, prefix, cap]) {
  const fs2 = FILES[src].filter(f => f.startsWith(prefix + '_'));
  if (!fs2.length) return null;
  const pod = src === 'pods';
  const imgs = fs2.map((f, i) => jpg(path.join(DIRS[src], f), src[0] + '_' + prefix + '_' + i, pod ? 700 : 760, pod ? '70%x66%+0+0' : null));
  return `<figure class="opt${pod ? ' pod' : ''}"><img src="${imgs[0]}" alt="${esc(cap)}" loading="lazy"${imgs[1] ? ` data-alt="${imgs[1]}"` : ''}><figcaption>${esc(cap)}</figcaption></figure>`;
}
function strip(title, note, cells) {
  const c = cells.map(cell).filter(Boolean);
  if (!c.length) return '';
  return `<div class="plane"><header><h3>${esc(title)}</h3><span class="eng">${esc(note || '')}</span></header>
<div class="strip n${c.length}">${c.join('\n')}</div></div>`;
}
const SECTIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'page_sections.json'), 'utf8'));
const sections = SECTIONS.map(s => `<section class="point" id="${s.id}"><div class="col"><div class="eyebrow">${esc(s.tag)}</div><h2>${esc(s.title)}</h2>${s.html}</div>
${s.strips.map(st => strip(st.title, st.note, st.cells)).join('\n')}</section>`).join('\n');

// ---- the table -----------------------------------------------------------------------------------------------------
const typeName = k => (T.TYPES.find(t => t.key === k) || {}).name || k;
const mountName = { nose: 'Nose', pusher: 'Pusher, aft face', wingTop: 'Over the wing', twin: 'Wing nacelles',
                    pushPull: 'Push-pull', three: 'Three (nose + nacelles)', four: 'Four on the wing' };
function todayImg(stem) {
  if (!stem) return null;
  const f = FILES.table.find(x => x.startsWith(stem + '_hero'));
  if (f) return jpg(path.join(DIRS.table, f), 'today_' + stem, 520, '64%x58%+0+0');
  const g = FILES.body.find(x => x.startsWith(stem.replace(/_today$/, '') + '_today_'));
  return g ? jpg(path.join(DIRS.body, g), 'today_' + stem, 520) : null;
}
let lastType = null;
const rows = T.ROWS.map(([type, mount, real, refs, stem, straight]) => {
  const img = todayImg(stem);
  const head = type !== lastType ? `<tr class="type"><th colspan="4">${esc(typeName(type))} <span>${esc((T.TYPES.find(t => t.key === type) || {}).eg || '')}</span></th></tr>` : '';
  lastType = type;
  return head + `<tr><td class="mount">${esc(mountName[mount] || mount)}</td>
<td class="real">${esc(real)}<div class="refs">${refs.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join(' · ')}</div></td>
<td class="today">${img ? `<img src="${img}" alt="today: ${esc(typeName(type))}, ${esc(mount)}" loading="lazy">` : '<span class="none">not offered by the chooser today</span>'}</td>
<td class="prop">${esc(straight)}</td></tr>`;
}).join('\n');

const html = fs.readFileSync(path.join(__dirname, 'page_shell.html'), 'utf8')
  .replace('<!--SECTIONS-->', sections)
  .replace('<!--ROWS-->', rows);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('page: ' + path.join(OUT, 'index.html') + ', ' + fs.readdirSync(path.join(OUT, 'img')).length + ' images');
