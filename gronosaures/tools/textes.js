/* ============================================================
   textes.js — inventaire des chaînes d'interface.

   Le premier audit (v71) reposait sur des motifs écrits à la
   main : trois chaînes visées n'ont pas été trouvées parce
   qu'elles étaient coupées autrement dans la source. Un audit
   qui rate sa cible sans le dire ne vaut rien.

   Cet outil extrait les chaînes affichées à l'écran, les
   normalise (retours à la ligne et indentation effacés) et les
   classe par longueur. Le travail de coupe se fait ensuite sur
   une liste complète, pas sur ce qu'on croit se rappeler.

   Usage :
     node tools/textes.js            les vingt plus longues
     node tools/textes.js 50         les cinquante plus longues
     node tools/textes.js --tout     toutes
   ============================================================ */

const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');

const sources = ['app.js', 'index.html'];
const vues = new Map();

/* On ne retient que du texte destiné à l'œil : au moins trois mots, des
   lettres accentuées ou une ponctuation de phrase, et rien qui ressemble à
   du code, à une classe CSS ou à un chemin de fichier. */
const suspect = t =>
  /[{}<>$`]/.test(t) ||
  /^[a-z-]+$/.test(t) ||
  /\.(js|css|png|webp|html|json)/.test(t) ||
  /^https?:/.test(t);

function ajoute(t, source) {
  const n = t.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (n.split(' ').length < 3) return;
  if (suspect(n)) return;
  if (!/[a-zà-ÿ]{3}/i.test(n)) return;
  if (!vues.has(n)) vues.set(n, source);
}

sources.forEach(f => {
  const s = fs.readFileSync(path.join(R, f), 'utf8');
  /* texte entre balises */
  for (const m of s.matchAll(/>([^<>{}`]{12,})</g)) ajoute(m[1], f);
  /* chaînes littérales simples et doubles */
  for (const m of s.matchAll(/'([^'\\\n]{12,})'/g)) ajoute(m[1], f);
  for (const m of s.matchAll(/"([^"\\\n]{12,})"/g)) ajoute(m[1], f);
});

const liste = [...vues.entries()]
  .map(([t, f]) => ({ t, f, n: t.length }))
  .sort((a, b) => b.n - a.n);

const arg = process.argv[2];
const n = arg === '--tout' ? liste.length : (parseInt(arg, 10) || 20);

console.log('\n  CHAÎNES D’INTERFACE — ' + liste.length + ' relevées, '
  + liste.reduce((a, x) => a + x.n, 0) + ' caractères\n');
console.log('  Les plus longues d’abord : c’est là que se cachent les chapeaux');
console.log('  qui expliquent ce que l’écran montre déjà.\n');

liste.slice(0, n).forEach(x => {
  console.log('  ' + String(x.n).padStart(4) + '  ' + x.f.padEnd(11) + x.t);
});

if (n < liste.length) {
  console.log('\n  … ' + (liste.length - n) + ' autres. `node tools/textes.js --tout` pour tout voir.\n');
}
