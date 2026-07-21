# Sauvegarde en ligne — plan

**Non implémenté.** Ce document fixe les décisions pour qu'elles soient prêtes le
jour où on s'y met, et pour qu'on discute de l'architecture avant d'écrire du
code plutôt qu'après.

Objectif unique et non négociable : **Louise ne perd pas une note.** Tout le
reste — appareils multiples, partage, classements — est secondaire et ne doit
jamais mettre cet objectif en danger.

---

## Ce qu'on reprend d'Écurie de Légendes

Même compte Supabase, même projet. L'architecture éprouvée là-bas :

- une table unique, RLS activée, **inaccessible en direct** ;
- tout passe par des fonctions `security definer` — le client ne fait que des
  appels RPC, jamais de requête sur la table ;
- l'état complet du jeu vit dans une colonne `jsonb` ;
- le code secret n'est jamais stocké en clair, seulement son SHA-256.

Ce qu'on ne reprend pas : le code famille et l'unicité du prénom. Ils servaient
à ce que deux sœurs voient leurs écuries respectives. Ici il n'y a qu'une
joueuse, et la contrainte d'unicité ne ferait que produire des refus de création
incompréhensibles.

---

## Les deux décisions propres à cet atlas

### 1. Code engendré, jamais saisi

À la création d'un profil local, l'application tire un code aléatoire, le range
à côté du profil et ne le montre pas. Louise ne tape rien, ne retient rien.

L'identité est l'`uuid`, pas le prénom. **Trois profils peuvent s'appeler
Louise** sans se gêner : la contrainte d'unicité disparaît.

Conséquence à assumer : un appareil perdu perd l'accès au compte en ligne, comme
un trousseau de clés. C'est acceptable tant que l'appareil est le seul en usage,
et c'est ce qui rend le dispositif invisible. Le code reste affichable dans les
réglages, sous un repli, pour le jour où l'on voudra passer d'un appareil à
l'autre — la migration marche exactement comme celle des chevaux.

### 2. Le carnet fusionne, il n'écrase pas

C'est le point technique important, et c'est celui qui répond à ta demande.

Le reste de l'état — crédits, collection, chantiers ouverts — supporte un
**dernier arrivé gagne** : ces valeurs sont reconstituables et une perte de
quelques minutes n'est pas grave.

Le carnet, non. Une entrée y est irremplaçable : une note, un doute, un songe ne
se rejouent pas. Un `last-write-wins` sur l'état entier suffirait à en effacer
une, silencieusement, si deux onglets ou deux appareils se marchaient dessus.

Le carnet étant **append-only et horodaté** — chaque entrée porte son `t`, qui
est l'instant de sa création — la fusion est triviale et sûre :

```
carnet_fusionné = union par `t` de (carnet_local, carnet_distant)
```

Pour les champs modifiables d'une entrée — `songe`, `note`, `resolu` — on garde
la version dont l'horodatage de modification est le plus récent, d'où l'intérêt
du `songeT` déjà enregistré. Les suppressions demandent un marquage plutôt qu'un
retrait sec, sinon une entrée effacée sur un appareil réapparaîtrait à la
synchronisation suivante.

Cette fusion est faite **côté serveur**, dans la fonction `sauver_etat`, pas
côté client : deux clients qui poussent en même temps doivent aboutir au même
résultat, et seul le serveur voit les deux.

---

## Schéma

```sql
-- ============================================================
--  Gronosaures et Trilobytes — sauvegarde en ligne
--  À coller dans : Supabase → SQL Editor → New query → Run
--  (même projet que l'écurie ; table distincte, rien n'est touché)
-- ============================================================

create table if not exists atlas_profils (
  id         uuid primary key default gen_random_uuid(),
  prenom     text not null,              -- affichage seul : aucune unicité
  code_hash  text not null,              -- SHA-256 du code engendré
  etat       jsonb default '{}'::jsonb,  -- l'état complet, carnet compris
  maj        timestamptz default now()
);

alter table atlas_profils enable row level security;

-- Création : le client engendre le code, n'envoie que son empreinte
create or replace function atlas_creer(p_prenom text, p_code text, p_etat jsonb)
returns uuid
language sql security definer set search_path=public as $$
  insert into atlas_profils(prenom, code_hash, etat)
  values (p_prenom, p_code, coalesce(p_etat,'{}'::jsonb))
  returning id;
$$;

-- Lecture
create or replace function atlas_lire(p_id uuid, p_code text)
returns jsonb
language sql security definer set search_path=public as $$
  select etat from atlas_profils where id=p_id and code_hash=p_code;
$$;

-- Écriture avec FUSION DU CARNET.
-- Le reste de l'état est remplacé ; le carnet est réuni par `t`, jamais écrasé.
create or replace function atlas_sauver(p_id uuid, p_code text, p_etat jsonb)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  ancien jsonb;
  fusion jsonb;
begin
  select etat into ancien from atlas_profils where id=p_id and code_hash=p_code;
  if ancien is null then return null; end if;

  -- union des deux carnets, dédoublonnée sur `t`, la plus récemment
  -- modifiée l'emportant pour une même entrée
  select coalesce(jsonb_agg(e order by (e->>'t')::bigint), '[]'::jsonb)
    into fusion
  from (
    select distinct on ((e->>'t')) e
    from jsonb_array_elements(
           coalesce(ancien->'carnet','[]'::jsonb) ||
           coalesce(p_etat->'carnet','[]'::jsonb)) e
    order by (e->>'t'), coalesce((e->>'songeT')::bigint, 0) desc
  ) s;

  update atlas_profils
     set etat = jsonb_set(p_etat, '{carnet}', fusion),
         maj  = now()
   where id=p_id and code_hash=p_code;

  return fusion;
end $$;
```

---

## Côté client

Reprise directe du fonctionnement d'Écurie, allégé de l'écran de connexion
puisqu'il n'y a rien à saisir.

- **Au démarrage** : si le profil porte un `id` et un code, on lit l'état
  distant et on fusionne le carnet avant d'afficher quoi que ce soit.
- **À chaque `sauver()`** : poussée différée de quelques secondes, pour ne pas
  émettre un appel par lettre tapée dans un songe.
- **Pastille d'état** discrète, comme celle des chevaux : synchronisé, en cours,
  en échec. En échec, on réessaie au prochain enregistrement — la version locale
  reste la référence et rien n'est perdu.
- **Hors ligne** : l'application fonctionne exactement comme aujourd'hui. La
  sauvegarde en ligne est un filet, jamais une dépendance.

---

## Ce qu'on ne fait pas maintenant

- La migration d'un appareil à l'autre. L'architecture la permet — c'est celle
  des chevaux — mais elle demande un écran et une explication, et rien ne
  l'exige aujourd'hui.
- Tout partage ou classement entre joueurs.
- Toute authentification par mot de passe choisi. Elle ne protégerait rien
  d'intéressant et ajouterait un obstacle à chaque ouverture.

---

## Point à trancher avant d'implémenter

La suppression d'une entrée de carnet. Trois options, par ordre de préférence :

1. **Marquage** — l'entrée reste, avec un drapeau `retire`, et n'est plus
   affichée. Sûr, mais le carnet enfle indéfiniment de choses invisibles.
2. **Liste des `t` supprimés**, portée par l'état et respectée à la fusion.
   Léger, correct, demande un peu de code.
3. **Suppression sèche.** Simple, mais une entrée effacée sur un appareil
   réapparaît à la synchronisation suivante depuis un autre.

Tant qu'il n'y a qu'un appareil, les trois se valent. Dès qu'il y en a deux, la
troisième est fausse. Je propose la deuxième, mais c'est à décider, pas à
supposer.
