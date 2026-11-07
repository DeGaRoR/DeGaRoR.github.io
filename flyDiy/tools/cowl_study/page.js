#!/usr/bin/env node
// cowl_study/page.js - PROPER-COWLS (7 Nov 2026): the report page - the option pictures and the engine x mount table.
//   node tools/cowl_study/page.js --opts=<plane_shot dir of the option runs> --table=<plane_shot dir of the table run>
//        --out=<dir>     -> <dir>/index.html + <dir>/img/*.jpg (ImageMagick `convert` for the JPGs)
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OPTS = arg('opts'), TAB = arg('table'), OUT = arg('out');
const T = require('./table.js');
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });
const jpg = (src, name, w, crop) => {
  const dst = path.join(OUT, 'img', name + '.jpg');
  // the hero stills frame the whole aeroplane small in a wide studio: the table's are cut to the aeroplane's middle
  const cut = crop ? ['-gravity', 'center', '-crop', crop, '+repage'] : [];
  execFileSync('convert', [src].concat(cut, ['-resize', (w || 900) + 'x', '-quality', '80', '-strip', dst]));
  return 'img/' + name + '.jpg';
};
const ls = d => (d && fs.existsSync(d) ? fs.readdirSync(d) : []).filter(f => /\.png$/.test(f)).sort();
const optFiles = ls(OPTS), tabFiles = ls(TAB);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- the option pictures ----------------------------------------------------------------------------------------
const PLANES = [
  ['cub', 'Piper Cub', 'official', 'Continental A-65 (flat four), nose'],
  ['jodel', 'Jodel', 'official', 'Continental A-65 (flat four), nose'],
  ['c172', 'Cessna 172', 'official', 'O-320-class flat four, nose'],
  ['busher', 'Twin busher floats 4b', 'official', 'Rotax 916 iS, pusher on the pod\'s aft face'],
  ['stol', 'STOL Cub', 'candidate', 'Rotax 915 iS, nose'],
  ['tiger', 'Tiger Moth-alike', 'candidate', 'Gipsy Major (inverted in-line), nose'],
  ['ugly', 'ugly bi', 'candidate', 'Continental O-200, nose'],
  ['tboom', 'twinBoomFail', 'candidate', 'Pipistrel E-811 (electric), nose'],
  ['dc3', 'DC-3-alike', 'candidate', 'P&W R-1830 radials in wing nacelles'],
];
const OPT = [['today', 'Today'], ['match', 'A · Match'], ['blend', 'B · Blend'], ['own', 'C · Own part']];
function planeBlock(p) {
  const [key, name, kind, eng] = p;
  const cells = OPT.map(([o, lab]) => {
    const fs2 = optFiles.filter(f => f.startsWith(key + '_' + o + '_'));
    if (!fs2.length) return null;
    const imgs = fs2.map((f, i) => jpg(path.join(OPTS, f), key + '_' + o + '_' + i, 760));
    return `<figure class="opt opt-${o}"><img src="${imgs[0]}" alt="${esc(name)}, ${esc(lab)}" loading="lazy"${imgs[1] ? ` data-alt="${imgs[1]}"` : ''}><figcaption>${esc(lab)}</figcaption></figure>`;
  });
  if (cells.every(c => !c)) return '';
  const off = key === 'dc3';
  return `<section class="plane"><header><h3>${esc(name)}</h3><span class="tag tag-${kind}">${kind}</span><span class="eng">${esc(eng)}</span></header>
${off ? '<p class="note">Off the body every option is the pod (round, the engine\'s size, a tail cone): there is no fuselage to match.</p>' : ''}
<div class="strip">${cells.filter(Boolean).join('\n')}</div></section>`;
}

// ---- the table ----------------------------------------------------------------------------------------------------
const typeName = k => (T.TYPES.find(t => t.key === k) || {}).name || k;
const mountName = { nose: 'Nose', pusher: 'Pusher, aft face', wingTop: 'Over the wing', twin: 'Wing nacelles',
                    pushPull: 'Push-pull', three: 'Three (nose + nacelles)', four: 'Four on the wing' };
function todayImg(stem) {
  if (!stem) return null;
  let f = tabFiles.find(x => x.startsWith(stem + '_hero'));
  if (f) return jpg(path.join(TAB, f), 'today_' + stem, 520, '64%x58%+0+0');
  f = optFiles.find(x => x.startsWith(stem + '_at'));
  return f ? jpg(path.join(OPTS, f), 'today_' + stem, 520) : null;
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

const REC = '<b>Recommendation: A, Match, on every nose and pusher face.</b> The fuselage carries straight on to a rounded lip, ' +
  'the spinner sits where the thrust line already is, and cheeks appear only where a boxer\'s heads stand proud of the firewall ' +
  '(the Cub\'s A-65, the C172), sized to the drawn heads. <b>C, the pod, wherever there is no fuselage</b> (pylon, tower, wing ' +
  'nacelles), and a one-click choice for a radial on a slim fuselage. <b>B stays a dial</b> (the barrel\'s taper), not a default: ' +
  'on every boxer its round front is narrower than the engine and needs 10-16 cm cheeks.';
const html = fs.readFileSync(path.join(__dirname, 'page_shell.html'), 'utf8')
  .replace('<!--PLANES-->', PLANES.map(planeBlock).join('\n'))
  .replace('<!--ROWS-->', rows).replace('<!--REC-->', REC);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('page: ' + path.join(OUT, 'index.html') + ', ' + fs.readdirSync(path.join(OUT, 'img')).length + ' images');
