/* ============================================================
   couverture.js — chaque question de fouille trouve-t-elle sa
   réponse dans ce que le chantier a montré ?

   Le reproche de Louise : on lui pose des questions sur des
   créatures que rien n'a décrites, donc elle répond au hasard.
   Ce n'est pas de la difficulté, c'est un défaut.

   Méthode. Pour chaque question, on constitue le CORPUS de son
   chantier — les cinq volets d'introduction, plus le nom, le
   groupe, l'âge et la description des six créatures. On cherche
   ensuite si la réponse y figure, en comparant des formes
   normalisées (sans accents, sans casse, sans ponctuation).

   Trois verdicts :
     TROUVÉ   la réponse apparaît telle quelle dans le corpus
     PARTIEL  ses mots porteurs y sont, dispersés
     ABSENT   rien ne s'y rapporte

   Un ABSENT n'est pas forcément une faute : « En 1938 » peut
   relever d'une culture générale légitime. Mais une question dont
   la réponse est absente ET qui porte sur une créature du chantier
   est un vrai problème, et c'est ce que la liste isole.

   Usage : node tools/couverture.js [SITE]
   ============================================================ */

const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');

const ctx = {};
new Function(fs.readFileSync(path.join(R, 'data.js'), 'utf8')
  + ';Object.assign(this,{SITES,CREATURES,QUIZ_PALEO});').call(ctx);

/* --- normalisation : on compare du sens, pas de la typographie --- */
const nu = s => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’']/g, ' ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* Mots vides : leur présence ne prouve rien. */
const VIDES = new Set(('le la les un une des du de d au aux et ou a en dans sur '
  + 'par pour avec sans sous vers chez est sont etait etaient ce cette ces son '
  + 'sa ses leur leurs qui que quoi dont ou il elle ils elles on ne pas plus '
  + 'tres tout tous toute toutes meme aussi comme entre').split(' '));

const porteurs = s => nu(s).split(' ').filter(m => m.length > 3 && !VIDES.has(m));

/* --- corpus d'un chantier --- */
function corpus(siteId) {
  const s = ctx.SITES.find(x => x.id === siteId);
  const cs = ctx.CREATURES.filter(c => c.site === siteId);
  const morceaux = [];
  if (s) {
    morceaux.push(s.nom, s.court, s.region, s.ere, s.age, s.accroche);
    (s.intro || []).forEach(v => morceaux.push(typeof v === 'string' ? v : (v && (v.txt || v.t))));
  }
  cs.forEach(c => morceaux.push(c.nom, c.groupe, c.age, c.taille, c.desc, c.confiance));
  return nu(morceaux.filter(Boolean).join(' '));
}

/* --- verdict pour une question --- */
function juger(q, corp) {
  const rep = nu(q.r);
  if (rep && corp.includes(rep)) return { v: 'TROUVE', part: 1 };
  const mots = porteurs(q.r);
  if (!mots.length) return { v: 'ABSENT', part: 0 };
  const vus = mots.filter(m => corp.includes(m));
  const part = vus.length / mots.length;
  if (part >= 0.6) return { v: 'PARTIEL', part };
  return { v: 'ABSENT', part };
}

/* Une question porte-t-elle sur une créature du chantier ? C'est ce qui
   distingue un manque gênant d'une question de culture générale. */
function surCreature(q, siteId) {
  const cs = ctx.CREATURES.filter(c => c.site === siteId);
  const t = nu(q.q + ' ' + q.r);
  return cs.some(c => {
    const genre = nu(c.nom).split(' ')[0];
    return genre.length > 3 && t.includes(genre);
  });
}

const filtre = process.argv[2];
const sites = ctx.SITES.filter(s => !filtre || s.id === filtre);
const total = { TROUVE: 0, PARTIEL: 0, ABSENT: 0 };
const graves = [];

console.log('\n  COUVERTURE DES QUESTIONS DE FOUILLE');
console.log('  chaque réponse est-elle appuyée par l’introduction ou une fiche ?\n');

sites.forEach(s => {
  const corp = corpus(s.id);
  const qs = ctx.QUIZ_PALEO.filter(q => q.site === s.id);
  if (!qs.length) return;
  const c = { TROUVE: 0, PARTIEL: 0, ABSENT: 0 };
  qs.forEach(q => {
    const j = juger(q, corp);
    c[j.v]++; total[j.v]++;
    if (j.v === 'ABSENT' && surCreature(q, s.id)) graves.push({ site: s.id, q });
  });
  const pct = Math.round((c.TROUVE + c.PARTIEL) / qs.length * 100);
  const barre = '█'.repeat(Math.round(pct / 5)).padEnd(20, '·');
  console.log('  ' + s.id.padEnd(6) + barre + ' ' + String(pct).padStart(3) + '%   '
    + c.TROUVE + ' trouvées · ' + c.PARTIEL + ' partielles · ' + c.ABSENT + ' absentes');
});

const n = total.TROUVE + total.PARTIEL + total.ABSENT;
console.log('\n  ENSEMBLE   ' + total.TROUVE + ' trouvées · ' + total.PARTIEL
  + ' partielles · ' + total.ABSENT + ' absentes  (' + n + ' questions)');
console.log('  appuyées   ' + Math.round((total.TROUVE + total.PARTIEL) / n * 100) + ' %');

if (graves.length) {
  console.log('\n  À REPRENDRE — réponse absente du chantier ET question portant sur');
  console.log('  une de ses créatures. C’est là qu’on répond au hasard.\n');
  graves.forEach(g => {
    console.log('  ' + g.site + ' ' + g.q.id);
    console.log('     Q : ' + g.q.q);
    console.log('     R : ' + g.q.r + '\n');
  });
} else {
  console.log('\n  Aucune question sur une créature du chantier ne reste sans appui.\n');
}
