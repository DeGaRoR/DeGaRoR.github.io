# Série astrophysique — conception

Cinq packs qui se lisent comme des récits et où les équations arrivent tard,
toujours après le problème qu'elles résolvent.

**Non implémenté.** Ce document arrête la structure et rédige le premier
niveau ; il manque un mécanisme côté code, décrit à la fin.

---

## Le principe

Une équation n'est intimidante que quand elle précède la question qu'elle
répond. Présentée après — quand on s'est heurté au problème et qu'on aimerait
bien avoir un moyen de le trancher — elle devient un soulagement.

Chaque niveau suit donc le même mouvement :

1. **une situation concrète**, historique de préférence, où quelqu'un ne sait
   pas quelque chose ;
2. **le raisonnement** qui l'a menée à une réponse ;
3. **l'équation**, présentée comme la forme abrégée de ce raisonnement, avec
   chaque symbole nommé ;
4. **un ordre de grandeur** qu'on calcule vraiment, pour que le nombre ait un
   goût ;
5. **les questions**, qui portent sur ce que le récit a dit.

Le point 4 est celui qui fait la différence. « E = mc² » ne veut rien dire tant
qu'on n'a pas vu que le c² est si grand qu'un gramme de matière vaut la
consommation électrique d'une ville pendant une journée. C'est le calcul qui
convainc, pas la formule.

## Ce qu'on suppose du lecteur

Adulte curieux. Sait ce qu'est une vitesse, une distance, une masse. Ne sait
pas — ou ne se rappelle pas — ce qu'est une puissance de dix, un ordre de
grandeur, une proportionnalité inverse. **On ne suppose rien d'autre.**

Corollaire : la première chose à enseigner n'est pas l'astrophysique mais la
lecture d'une équation. D'où le pack 1, qui ne parle presque pas du ciel.

---

## Les cinq packs

### 1 — Lire une équation *(le socle, sans lequel le reste intimide)*

| Niveau | Récit | Ce qu'on acquiert |
|---|---|---|
| 1 | Ératosthène mesure la Terre avec un bâton et une ombre, en −240 | proportion, règle de trois |
| 2 | Combien de grains de sable sur une plage ? | puissances de dix, ordre de grandeur |
| 3 | Pourquoi une lampe éclaire quatre fois moins à deux fois la distance | carré, proportionnalité inverse |
| 4 | Lire `d = v × t` dans les deux sens | isoler une inconnue |

**Équations : `C = 2πR`, `d = v × t`, `I ∝ 1/d²`.** Aucune n'est difficile ;
l'objet est de rendre familier le geste de lire des lettres.

### 2 — La lumière comme messagère

| Niveau | Récit | Ce qu'on acquiert |
|---|---|---|
| 1 | Rømer découvre en 1676 que la lumière met du temps, en observant Io | vitesse finie, `c` |
| 2 | L'année-lumière : voir loin, c'est voir tôt | distance et temps confondus |
| 3 | Newton, le prisme, et ce que les couleurs cachent | spectre |
| 4 | Fraunhofer et les raies noires : lire la composition d'une étoile | signature spectrale |
| 5 | L'effet Doppler, de la sirène d'ambulance au décalage vers le rouge | mouvement lisible |

**Équations : `d = c × t`, `λ` et couleur, `z = Δλ / λ`.**

### 3 — Masse et énergie

| Niveau | Récit | Ce qu'on acquiert |
|---|---|---|
| 1 | Pourquoi le Soleil brille-t-il encore ? Le calcul qui échoue au XIXᵉ | énergie, durée, contradiction |
| 2 | `E = mc²` : ce que c² veut dire quand on le calcule | l'ordre de grandeur qui convainc |
| 3 | Quatre hydrogènes font un hélium — et il en manque 0,7 % | défaut de masse |
| 4 | Combien de temps le Soleil peut-il tenir ? | division, échelle de temps |

### 4 — La gravité, de la pomme aux trous noirs

| Niveau | Récit | Ce qu'on acquiert |
|---|---|---|
| 1 | Newton : la même force fait tomber la pomme et tenir la Lune | universalité |
| 2 | `F = G·m₁m₂/d²` symbole par symbole | lire une équation à quatre lettres |
| 3 | Vitesse de libération : à quelle vitesse faut-il partir ? | énergie et échappement |
| 4 | Et si la vitesse de libération dépassait `c` ? | trou noir, par raisonnement |
| 5 | Einstein : l'espace se courbe, l'éclipse de 1919 | gravité comme géométrie |

### 5 — L'univers a une histoire

| Niveau | Récit | Ce qu'on acquiert |
|---|---|---|
| 1 | Hubble : tout s'éloigne, et d'autant plus vite qu'il est loin | corrélation, loi |
| 2 | `v = H₀ × d` : une équation qui donne un âge | remonter le temps |
| 3 | Le fond diffus, découvert par accident en 1964 | preuve fossile |
| 4 | Ce qu'on ne sait pas : matière noire, énergie noire | l'inconnu comme résultat |

**Ce dernier niveau importe autant que les autres.** Il rejoint la posture de
tout l'atlas — dire ce qu'on ignore fait partie du métier, exactement comme les
fiches à confiance faible.

---

## Premier niveau, rédigé

### Pack 1, niveau 1 — Un bâton, une ombre, et la Terre

**Introduction, cinq volets**

> **I.** Vers −240, à Alexandrie, un homme du nom d'Ératosthène dirige la plus
> grande bibliothèque du monde. On lui rapporte un détail curieux : à Syène, une
> ville au sud, le jour du solstice d'été, le Soleil se reflète au fond des
> puits. Il est exactement à la verticale. Aucune ombre.
>
> **II.** À Alexandrie, le même jour, à la même heure, un bâton planté droit
> fait de l'ombre. Une petite ombre, mais une ombre. Si la Terre était plate,
> les deux villes recevraient les rayons sous le même angle, et le bâton
> d'Alexandrie n'en ferait aucune non plus.
>
> **III.** Ératosthène mesure l'angle : environ 7 degrés. Un tour complet fait
> 360 degrés. Sept degrés, c'est à peu près un cinquantième de tour. Autrement
> dit, la distance d'Alexandrie à Syène représente le cinquantième du tour de la
> Terre.
>
> **IV.** Cette distance, il la connaît : cinq mille stades, d'après le temps que
> mettent les caravanes. Le tour de la Terre vaut donc cinquante fois cinq mille
> stades, soit deux cent cinquante mille. Selon la valeur exacte du stade, cela
> fait entre 39 000 et 46 000 kilomètres. La bonne réponse est 40 075.
>
> **V.** Il n'a pas voyagé. Il n'a pas d'instrument. Il a une ombre, un angle,
> une distance, et une proportion : *ce que l'angle est à 360, la distance l'est
> au tour complet*. C'est toute l'affaire. Une équation n'est rien d'autre que
> cette phrase, écrite plus court.

**Ce que le niveau introduit**

```
    angle        distance
   ───────  =  ───────────
     360          tour
```

Quatre nombres, on en connaît trois, on cherche le quatrième. C'est le geste
qu'on refera dans tous les packs suivants.

**Cinq questions, sur les vingt du niveau**

| | Question | Réponse |
|---|---|---|
| 1 | Que voyait-on au fond des puits de Syène au solstice ? | Le reflet du Soleil, à la verticale |
| 2 | Pourquoi le bâton d'Alexandrie fait-il de l'ombre le même jour ? | Parce que la surface y est inclinée : la Terre est courbe |
| 3 | Sept degrés, c'est environ quelle fraction d'un tour complet ? | Un cinquantième |
| 4 | Que fallait-il connaître en plus de l'angle ? | La distance entre les deux villes |
| 5 | De combien Ératosthène s'est-il trompé, au mieux ? | De moins de 2 % |

**Explications** — chacune redit le raisonnement, jamais le résultat seul. Pour
la 3 : *360 divisé par 7 donne à peu près 51. L'angle mesuré est donc un peu
plus du cinquantième d'un tour, et la distance mesurée le même rapport du tour
de la Terre.*

---

## Ce qu'il manque côté code

Les packs de la Bourse n'ont pas d'introduction : on ouvre, on répond. Cette
série en a besoin, puisque le récit **est** le contenu et que les questions n'en
sont que la vérification.

Trois options, par ordre de coût croissant :

1. **Réutiliser `theorie`.** Le rappel théorique existe déjà, replié, et porte
   maintenant un champ de saisie. On y met le récit. Coût nul, mais il reste
   replié par défaut et rien ne pousse à le lire avant de répondre.
2. **Un drapeau `intro` sur le pack**, qui déroule les volets à la manière d'un
   chantier avant la première question d'un niveau, avec un bouton pour le
   revoir. C'est le mécanisme des chantiers, transposé — donc du code déjà
   écrit et éprouvé.
3. **Des niveaux comme objets à part entière**, chacun avec son récit, sa banque
   et son propre achèvement. Le plus juste, le plus cher.

Je recommande la **2**. Elle réemploie `introSite` et son écran, et elle place le
récit là où il faut : avant les questions, une fois, avec relecture possible.

Deux points annexes : ces packs ne doivent **rien tirer de nouveau** — pas de
créature associée, seulement des crédits ; et il n'y a **aucune image**
astrophysique dans les ressources, donc l'introduction s'appuiera sur le texte
seul, ou sur un fond neutre, jusqu'à ce qu'on en produise.

---

## Question ouverte

Cinq packs de cinq niveaux de vingt questions font **cinq cents questions** à
écrire et à sourcer, dans un atlas qui en compte aujourd'hui mille cent quarante.
C'est un chantier comparable aux sept packs paléontologiques.

Je propose de commencer par **le pack 1 en entier**, de le faire jouer à Louise,
et de ne poursuivre que si le format tient. Écrire cinq cents questions avant de
savoir si le récit-puis-questions fonctionne serait le pire ordre possible.
