#!/usr/bin/env node
// cowl_study/page.js - PROPER-COWLS: the report page - the body cowls (today vs the waistline rule), the pods (today
// vs straight, by engine type) and the engine x mount table.
//   node tools/cowl_study/page.js --body=<plane_shot dir> --pods=<plane_shot dir> --table=<plane_shot dir> --out=<dir>
//        -> <dir>/index.html + <dir>/img/*.jpg (ImageMagick `convert` for the JPGs)
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BODY = arg('body'), PODS = arg('pods'), TAB = arg('table'), OUT = arg('out');
const T = require('./table.js');
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const jpg = (src, name, w, crop) => {
  const dst = path.join(OUT, 'img', name + '.jpg');
  // the hero stills frame the whole aeroplane small in a wide studio: cut to the aeroplane's middle when asked
  const cut = crop ? ['-gravity', 'center', '-crop', crop, '+repage'] : [];
  execFileSync('convert', [src].concat(cut, ['-resize', (w || 900) + 'x', '-quality', '80', '-strip', dst]));
  return 'img/' + name + '.jpg';
};
const ls = d => (d && fs.existsSync(d) ? fs.readdirSync(d) : []).filter(f => /\.png$/.test(f)).sort();
const bodyFiles = ls(BODY), podFiles = ls(PODS), tabFiles = ls(TAB);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fig = (img, alt, lab, cls, alt2) =>
  `<figure class="opt ${cls || ''}"><img src="${img}" alt="${esc(alt)}" loading="lazy"${alt2 ? ` data-alt="${alt2}"` : ''}><figcaption>${esc(lab)}</figcaption></figure>`;

// ---- the body cowls ----------------------------------------------------------------------------------------------
const BODIES = [
  ['cub', 'Piper Cub', 'official', 'Continental A-65, nose'],
  ['jodel', 'Jodel', 'official', 'Continental A-65, nose'],
  ['c172', 'Cessna 172', 'official', 'O-320-class boxer, nose'],
  ['busher', 'Twin busher floats 4b', 'official', 'Rotax 916 iS, pusher on the pod\'s aft face'],
  ['stol', 'STOL Cub', 'candidate', 'Rotax 915 iS, nose'],
  ['tiger', 'Tiger Moth-alike', 'candidate', 'Gipsy Major (inverted in-line), nose'],
  ['ugly', 'ugly bi', 'candidate', 'Continental O-200, nose'],
  ['tboom', 'twinBoomFail', 'candidate', 'Pipistrel E-811, nose'],
];
function bodyBlock([key, name, kind, eng]) {
  const cells = [['today', 'Today (as saved)'], ['waist', 'The body rule']].map(([o, lab]) => {
    const fs2 = bodyFiles.filter(f => f.startsWith(key + '_' + o + '_'));
    if (!fs2.length) return null;
    const imgs = fs2.map((f, i) => jpg(path.join(BODY, f), 'b_' + key + '_' + o + '_' + i, 760));
    return fig(imgs[0], name + ', ' + lab, lab, 'opt-' + o, imgs[1]);
  }).filter(Boolean);
  if (!cells.length) return '';
  return `<section class="plane"><header><h3>${esc(name)}</h3><span class="tag tag-${kind}">${kind}</span><span class="eng">${esc(eng)}</span></header>
<div class="strip two">${cells.join('\n')}</div></section>`;
}

// ---- the pods ------------------------------------------------------------------------------------------------------
const PODLIST = [
  ['flat', 'Boxer (O-320)', 'wider than high, two inlets'],
  ['rotax', 'Rotax 915 iS', 'wide and low, centred on the high shaft'],
  ['inline', 'Inverted in-line (Gipsy Major)', 'taller than wide, boxy corners'],
  ['vee', 'V (Hirth HM 508)', 'a deep oval, rounded corners'],
  ['radial', 'Radial (W-670)', 'round, the open ring'],
  ['turbine', 'Turboprop (PT6A-114A)', 'round, long, the chin grown into the barrel'],
  ['electric', 'Electric (E-811)', 'round, small, closed'],
  ['pylon', 'Over the wing (Rotax 915 on the pylon)', 'the boxer-type pod on its pylon'],
];
function podBlock([key, name, note]) {
  const cells = [['today', 'Today'], ['straight', 'Straight pod']].map(([o, lab]) => {
    const f = podFiles.find(x => x.startsWith(key + '_' + o + '_'));
    return f ? fig(jpg(path.join(PODS, f), 'p_' + key + '_' + o, 700, '70%x66%+0+0'), name + ', ' + lab, lab, 'pod') : null;
  }).filter(Boolean);
  if (!cells.length) return '';
  return `<section class="podrow"><header><h3>${esc(name)}</h3><span class="eng">${esc(note)}</span></header><div class="strip two wide">${cells.join('\n')}</div></section>`;
}

// ---- the table -----------------------------------------------------------------------------------------------------
const typeName = k => (T.TYPES.find(t => t.key === k) || {}).name || k;
const mountName = { nose: 'Nose', pusher: 'Pusher, aft face', wingTop: 'Over the wing', twin: 'Wing nacelles',
                    pushPull: 'Push-pull', three: 'Three (nose + nacelles)', four: 'Four on the wing' };
function todayImg(stem) {
  if (!stem) return null;
  const f = tabFiles.find(x => x.startsWith(stem + '_hero'));
  if (f) return jpg(path.join(TAB, f), 'today_' + stem, 520, '64%x58%+0+0');
  const g = bodyFiles.find(x => x.startsWith(stem.replace(/_today$/, '') + '_today_'));
  return g ? jpg(path.join(BODY, g), 'today_' + stem, 520) : null;
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
  .replace('<!--BODIES-->', BODIES.map(bodyBlock).join('\n'))
  .replace('<!--PODS-->', PODLIST.map(podBlock).join('\n'))
  .replace('<!--ROWS-->', rows);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('page: ' + path.join(OUT, 'index.html') + ', ' + fs.readdirSync(path.join(OUT, 'img')).length + ' images');
