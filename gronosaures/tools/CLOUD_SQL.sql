-- ============================================================================
--  Gronosaures et Trilobytes — sauvegarde en ligne
--  Supabase → SQL Editor → New query → Run
--
--  MÊME PROJET que l'Écurie de Légendes. Ce script ne touche NI la table
--  `comptes`, NI ses fonctions : tout est préfixé `atlas_`. Il est réexécutable
--  sans dommage (create if not exists / create or replace).
--
--  Objectif non négociable : Louise ne perd pas une note.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
--  1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.atlas_profils (
  id         uuid primary key default gen_random_uuid(),
  prenom     text        not null,               -- affichage seul, aucune unicité
  code_hash  text        not null,               -- SHA-256 calculé ICI, jamais reçu
  etat       jsonb       not null default '{}'::jsonb,
  cree       timestamptz not null default now(),
  maj        timestamptz not null default now()
);

-- RLS active SANS AUCUNE POLICY : la table devient inaccessible en direct,
-- même avec la clé anon. Tout passe par les fonctions ci-dessous, qui sont
-- `security definer` et donc seules habilitées à la lire.
alter table public.atlas_profils enable row level security;

-- ---------------------------------------------------------------------------
--  2. Le secret
--
--  Le client envoie le code EN CLAIR (sur TLS) ; le serveur le hache et ne
--  stocke que l'empreinte. C'est la seule disposition qui fasse servir le
--  hachage à quelque chose : si le client hachait lui-même et transmettait
--  l'empreinte, celle-ci deviendrait le mot de passe, et qui volerait la base
--  pourrait la rejouer telle quelle.
--
--  Conséquence assumée, et c'est la réponse au cas « appareil perdu » :
--  personne ne peut relire un code, pas même l'administrateur. On ne le
--  RÉCUPÈRE pas, on le REMPLACE — voir la section 6.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_empreinte(p_code text)
returns text
language sql immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(p_code,''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
--  3. Création
--  L'identité est l'uuid, pas le prénom : trois profils peuvent s'appeler
--  Louise sans se gêner.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_creer(
  p_prenom text,
  p_code   text,
  p_etat   jsonb default '{}'::jsonb
)
returns uuid
language sql security definer
set search_path = public, extensions
as $$
  insert into public.atlas_profils (prenom, code_hash, etat)
  values (
    left(coalesce(nullif(trim(p_prenom),''),'Profil'), 24),
    public.atlas_empreinte(p_code),
    coalesce(p_etat, '{}'::jsonb)
  )
  returning id;
$$;

-- ---------------------------------------------------------------------------
--  4. Lecture
--  Sert au démarrage ET à l'adoption d'un profil sur un nouvel appareil :
--  c'est le même geste, uuid + code.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_lire(p_id uuid, p_code text)
returns jsonb
language sql security definer
set search_path = public, extensions
as $$
  select etat
    from public.atlas_profils
   where id = p_id
     and code_hash = public.atlas_empreinte(p_code);
$$;

-- ---------------------------------------------------------------------------
--  5. Écriture, avec FUSION DU CARNET
--
--  Le reste de l'état — crédits, collection, chantiers — supporte un « dernier
--  arrivé gagne » : ces valeurs se reconstituent, une perte de quelques minutes
--  n'est pas grave. Le carnet, non : une note ne se rejoue pas.
--
--  Trois écarts délibérés avec le plan initial.
--
--  a) On dédoublonne sur `eid`, pas sur `t`. `t` est un Date.now() en
--     millisecondes : mesuré sur une partie réelle, 33 entrées de carnet ne
--     portaient que 20 horodatages distincts. Dédoublonner là-dessus aurait
--     détruit treize notes à la première synchronisation. `eid` est un
--     identifiant propre, engendré à la création de l'entrée.
--     Repli `legacy:<t>` pour les carnets antérieurs à `eid`.
--
--  b) Les suppressions sont des PIERRES TOMBALES (`carnetTombes`, liste d'eid),
--     et non un retrait sec : sans elles, une entrée effacée sur un appareil
--     réapparaîtrait à la synchronisation suivante depuis l'autre. La liste
--     est append-only, donc commutative — deux clients qui poussent en même
--     temps aboutissent au même résultat.
--
--  c) La fusion a lieu ICI, côté serveur, jamais côté client : seul le serveur
--     voit les deux versions.
-- ---------------------------------------------------------------------------
create or replace function public.atlas_sauver(
  p_id   uuid,
  p_code text,
  p_etat jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_hash   text := public.atlas_empreinte(p_code);
  v_ancien jsonb;
  v_tombes jsonb;
  v_carnet jsonb;
begin
  select etat into v_ancien
    from public.atlas_profils
   where id = p_id and code_hash = v_hash;

  if not found then
    return null;                      -- identifiants faux : on ne dit pas lequel
  end if;

  -- 5a. Union des pierres tombales (append-only, donc sans conflit possible)
  select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
    into v_tombes
    from jsonb_array_elements_text(
           coalesce(v_ancien->'carnetTombes', '[]'::jsonb) ||
           coalesce(p_etat  ->'carnetTombes', '[]'::jsonb)
         ) x;

  -- 5b. Union des entrées, une seule par eid, la plus récemment modifiée
  --     l'emportant ; les entrées enterrées sont retirées.
  select coalesce(jsonb_agg(e order by (e->>'t')::bigint), '[]'::jsonb)
    into v_carnet
    from (
      select distinct on (coalesce(e->>'eid', 'legacy:' || (e->>'t'))) e
        from jsonb_array_elements(
               coalesce(v_ancien->'carnet', '[]'::jsonb) ||
               coalesce(p_etat  ->'carnet', '[]'::jsonb)
             ) e
       where not (v_tombes ? coalesce(e->>'eid', 'legacy:' || (e->>'t')))
       order by coalesce(e->>'eid', 'legacy:' || (e->>'t')),
                coalesce((e->>'songeT')::bigint, (e->>'t')::bigint, 0) desc
    ) s;

  update public.atlas_profils
     set etat = jsonb_set(
                  jsonb_set(coalesce(p_etat,'{}'::jsonb), '{carnet}', v_carnet, true),
                  '{carnetTombes}', v_tombes, true),
         maj  = now()
   where id = p_id and code_hash = v_hash;

  -- On rend l'état fusionné : le client adopte le carnet du serveur et se
  -- retrouve donc à jour sans second aller-retour.
  select etat into v_ancien from public.atlas_profils where id = p_id;
  return v_ancien;
end $$;

-- ---------------------------------------------------------------------------
--  6. Droits
--
--  Point de sécurité à ne pas manquer : dans PostgreSQL, une fonction est
--  exécutable par PUBLIC par défaut. Une fonction `security definer` laissée
--  ainsi contourne la RLS pour n'importe qui. On révoque donc, puis on accorde
--  explicitement au seul rôle dont l'application a besoin.
--
--  Aucune fonction d'administration n'est exposée ici : ce qui n'existe pas en
--  RPC ne peut pas être appelé depuis un navigateur.
-- ---------------------------------------------------------------------------
revoke all on function public.atlas_empreinte(text) from public;
revoke all on function public.atlas_creer(text, text, jsonb) from public;
revoke all on function public.atlas_lire(uuid, text) from public;
revoke all on function public.atlas_sauver(uuid, text, jsonb) from public;

grant execute on function public.atlas_creer(text, text, jsonb) to anon, authenticated;
grant execute on function public.atlas_lire(uuid, text)          to anon, authenticated;
grant execute on function public.atlas_sauver(uuid, text, jsonb) to anon, authenticated;
-- atlas_empreinte reste interne : elle n'est appelée que par les trois autres,
-- qui s'exécutent avec les droits du propriétaire.

-- ============================================================================
--  ADMINISTRATION — à exécuter dans le SQL Editor, jamais exposé en RPC
-- ============================================================================

-- Retrouver le profil de Louise (le code, lui, est irrécupérable par nature) :
--
--   select id, prenom, cree, maj, jsonb_array_length(etat->'carnet') as notes
--     from public.atlas_profils order by maj desc;

-- APPAREIL PERDU. On ne récupère pas le code, on en pose un nouveau, puis on
-- le saisit sur le nouvel appareil avec l'uuid ci-dessus.
-- Choisir un code lisible, le noter AVANT de lancer la requête :
--
--   update public.atlas_profils
--      set code_hash = public.atlas_empreinte('CODE-QUE-TU-VIENS-DE-CHOISIR')
--    where id = '00000000-0000-0000-0000-000000000000';
--
-- Vérifier ensuite que le couple fonctionne :
--
--   select public.atlas_lire('00000000-0000-0000-0000-000000000000',
--                            'CODE-QUE-TU-VIENS-DE-CHOISIR') is not null;

-- Filet supplémentaire : une copie datée avant toute manipulation.
--
--   create table if not exists public.atlas_sauvegardes (
--     pris timestamptz default now(), id uuid, etat jsonb);
--   insert into public.atlas_sauvegardes (id, etat)
--     select id, etat from public.atlas_profils;
