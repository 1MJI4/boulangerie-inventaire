-- =====================================================================
-- LOI 11 — decisions du 15/10/2026 :
--   * horaires de retrait patisserie reglables JOUR PAR JOUR (lundi ...
--     dimanche) et PAR DATE EXCEPTIONNELLE (ex. un samedi a 11h00) ;
--   * tailles standard des gateaux simples = liste reglable.
--
-- Migration NOUVELLE (la 20261015140000 est deja appliquee en recette) :
-- DONNEES de "Reglage", fonction du CHECK "Reglage_reglement_valide"
-- (meme signature : la contrainte existante l'utilise aussitot pour toute
-- nouvelle ecriture), et deux colonnes NULL sur "LigneCommande" (accord du
-- gerant pour une taille de gateau hors liste, fin de fichier).
--
-- Nouvelles cles (valeurs JSON, lues par src/lib/serveur/reglages.ts) :
--   reglement:patisserie_retrait_par_jour   {"1":"09:00",...,"7":"12:00"}
--       objet, exactement les cles "1".."7" (ISO, 1 = lundi), "HH:MM"
--   reglement:patisserie_retrait_exceptions [{"date":"AAAA-MM-JJ","heure":"HH:MM"}]
--       tableau, dates calendaires valides, une seule entree par date
--   reglement:tailles_gateau                [4,6,8,10,15,20,25,30] (decision du proprietaire, 15/10/2026)
--       tableau non vide d'entiers 1..200 strictement croissants
--
-- Cles OBSOLETES, conservees : reglement:patisserie_retrait_semaine,
-- reglement:patisserie_retrait_week_end, reglement:jours_week_end_iso.
-- Encore lues par la lecture de compatibilite de reglages.ts (base dont
-- cette migration n'est pas appliquee) ; une cle reglement:* ne se supprime
-- pas (declencheur "Reglage_refuser_suppression"). Suppression a une
-- version ulterieure, en deux temps, quand plus rien ne les lit.
--
-- Reprise : "par jour" est initialise depuis les anciennes valeurs
-- semaine / week-end / jours de week-end (donc depuis une valeur modifiee
-- par le gerant le cas echeant) ; a defaut, 09:00 du lundi au vendredi et
-- 12:00 samedi et dimanche (reglement interieur du 15/10/2026).
-- Rejouable : une cle deja presente n'est jamais ecrasee.
-- Retour arriere : voir le bloc commente en fin de fichier.
-- =====================================================================

CREATE OR REPLACE FUNCTION "reglage_heure_valide"(t jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT jsonb_typeof(t) = 'string'
     AND (t #>> '{}') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
$fn$;

-- Date calendaire « AAAA-MM-JJ » reelle (refuse 2026-02-30, 2026-13-01...).
CREATE OR REPLACE FUNCTION "reglage_date_valide"(t jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  s text;
BEGIN
  IF t IS NULL OR jsonb_typeof(t) <> 'string' THEN
    RETURN false;
  END IF;
  s := t #>> '{}';
  IF s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN false;
  END IF;
  BEGIN
    PERFORM make_date(substr(s, 1, 4)::int, substr(s, 6, 2)::int, substr(s, 9, 2)::int);
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN true;
END
$fn$;

CREATE OR REPLACE FUNCTION "reglage_valeur_valide"(c text, v text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  j jsonb;
  elem jsonb;
  cles text[];
  precedent integer;
  n integer;
BEGIN
  IF c IS NULL OR c NOT LIKE 'reglement:%' THEN
    RETURN true; -- les autres reglages (coupes, imprimante...) ne sont pas controles ici
  END IF;
  BEGIN
    j := v::jsonb;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  CASE c
    WHEN 'reglement:acompte_min_pourcent' THEN
      RETURN jsonb_typeof(j) = 'number'
         AND j::text ~ '^[0-9]{1,3}$'
         AND (j::text)::integer BETWEEN 0 AND 100;
    WHEN 'reglement:heure_fermeture',
         'reglement:patisserie_retrait_semaine',   -- OBSOLETE (20261015150000)
         'reglement:patisserie_retrait_week_end' THEN -- OBSOLETE (20261015150000)
      RETURN "reglage_heure_valide"(j);
    WHEN 'reglement:jours_week_end_iso' THEN -- OBSOLETE (20261015150000)
      RETURN jsonb_typeof(j) = 'array'
         AND NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements(j) e
               WHERE jsonb_typeof(e) <> 'number' OR e::text !~ '^[1-7]$')
         AND (SELECT count(*) FROM jsonb_array_elements(j))
           = (SELECT count(DISTINCT e::text) FROM jsonb_array_elements(j) e);
    WHEN 'reglement:familles_patisserie' THEN
      -- Au moins une famille : une liste vide supprimerait les horaires de
      -- retrait sans que personne ne le voie (le plus sur : refuser).
      RETURN jsonb_typeof(j) = 'array'
         AND jsonb_array_length(j) > 0
         AND NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements(j) e
               WHERE jsonb_typeof(e) <> 'string' OR length(btrim(e #>> '{}')) = 0);

    -- LOI 11 — premiere heure de retrait, jour par jour (ISO 1 = lundi).
    -- Les sept jours sont obligatoires : un jour manquant n'aurait pas
    -- d'horaire et laisserait passer n'importe quelle heure.
    WHEN 'reglement:patisserie_retrait_par_jour' THEN
      IF jsonb_typeof(j) <> 'object' THEN
        RETURN false;
      END IF;
      SELECT array_agg(k ORDER BY k) INTO cles FROM jsonb_object_keys(j) k;
      IF cles IS DISTINCT FROM ARRAY['1','2','3','4','5','6','7'] THEN
        RETURN false;
      END IF;
      RETURN NOT EXISTS (SELECT 1 FROM jsonb_each(j) x WHERE NOT "reglage_heure_valide"(x.value));

    -- LOI 11 — dates exceptionnelles : { date, heure }, une seule par date.
    WHEN 'reglement:patisserie_retrait_exceptions' THEN
      IF jsonb_typeof(j) <> 'array' THEN
        RETURN false;
      END IF;
      FOR elem IN SELECT x FROM jsonb_array_elements(j) x LOOP
        IF jsonb_typeof(elem) <> 'object' THEN
          RETURN false;
        END IF;
        SELECT array_agg(k ORDER BY k) INTO cles FROM jsonb_object_keys(elem) k;
        IF cles IS DISTINCT FROM ARRAY['date','heure']
           OR NOT "reglage_date_valide"(elem -> 'date')
           OR NOT "reglage_heure_valide"(elem -> 'heure') THEN
          RETURN false;
        END IF;
      END LOOP;
      RETURN (SELECT count(*) FROM jsonb_array_elements(j))
           = (SELECT count(DISTINCT x ->> 'date') FROM jsonb_array_elements(j) x);

    -- LOI 11 — tailles standard d'un gateau simple (nombre de parts).
    -- Non vide (sinon plus aucun gateau simple ne se commande), entiers
    -- 1..200, strictement croissants (= tries, sans doublon).
    WHEN 'reglement:tailles_gateau' THEN
      IF jsonb_typeof(j) <> 'array' OR jsonb_array_length(j) = 0 THEN
        RETURN false;
      END IF;
      precedent := 0;
      FOR elem IN SELECT x FROM jsonb_array_elements(j) x LOOP
        IF jsonb_typeof(elem) <> 'number' OR elem::text !~ '^[0-9]{1,3}$' THEN
          RETURN false;
        END IF;
        n := (elem::text)::integer;
        IF n < 1 OR n > 200 OR n <= precedent THEN
          RETURN false;
        END IF;
        precedent := n;
      END LOOP;
      RETURN true;
    ELSE
      RETURN false; -- cle reglement:* inconnue : faute de frappe probable
  END CASE;
END
$fn$;

-- Donnees initiales. "par jour" repris des anciennes cles (valeur du gerant
-- conservee) ; a defaut, valeurs du reglement interieur du 15/10/2026.
-- HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°52) : week-end = samedi et dimanche.
WITH anciens AS (
  SELECT
    COALESCE((SELECT "valeur"::jsonb FROM "Reglage" WHERE "cle" = 'reglement:patisserie_retrait_semaine'), '"09:00"'::jsonb) AS semaine,
    COALESCE((SELECT "valeur"::jsonb FROM "Reglage" WHERE "cle" = 'reglement:patisserie_retrait_week_end'), '"12:00"'::jsonb) AS week_end,
    COALESCE((SELECT "valeur"::jsonb FROM "Reglage" WHERE "cle" = 'reglement:jours_week_end_iso'), '[6,7]'::jsonb) AS jours
)
INSERT INTO "Reglage" ("cle", "valeur", "modifieLe")
SELECT
  'reglement:patisserie_retrait_par_jour',
  (SELECT jsonb_object_agg(d::text, CASE WHEN a.jours @> to_jsonb(d) THEN a.week_end ELSE a.semaine END)
     FROM generate_series(1, 7) d)::text,
  CURRENT_TIMESTAMP
FROM anciens a
ON CONFLICT ("cle") DO NOTHING;

INSERT INTO "Reglage" ("cle", "valeur", "modifieLe") VALUES
  ('reglement:patisserie_retrait_exceptions', '[]',              CURRENT_TIMESTAMP),
  ('reglement:tailles_gateau',                '[4,6,8,10,15,20,25,30]', CURRENT_TIMESTAMP)
ON CONFLICT ("cle") DO NOTHING;

-- Verification apres deploiement (doit renvoyer 0 ligne) :
--   SELECT "cle", "valeur" FROM "Reglage"
--   WHERE "cle" LIKE 'reglement:%' AND NOT "reglage_valeur_valide"("cle", "valeur");
--
-- Retour arriere (manuel, a ne lancer qu'apres retour du code precedent) :
--   ALTER TABLE "Reglage" DISABLE TRIGGER "Reglage_refuser_suppression";
--   DELETE FROM "Reglage" WHERE "cle" IN ('reglement:patisserie_retrait_par_jour',
--     'reglement:patisserie_retrait_exceptions', 'reglement:tailles_gateau');
--   ALTER TABLE "Reglage" ENABLE TRIGGER "Reglage_refuser_suppression";
--   puis recreer "reglage_valeur_valide" depuis 20261015140000 et
--   DROP FUNCTION "reglage_heure_valide"(jsonb), "reglage_date_valide"(jsonb);

-- =====================================================================
-- LigneCommande — accord du gerant pour une taille de gateau hors liste
-- standard (LOI 11, decision du 15/10/2026 : « exception possible par le
-- code gerant, tracee »). Meme forme que les autres deverrouillages :
-- nom ET horodatage, ou rien ; nom non vide. Le serveur ne les remplit
-- qu'apres verification du code gerant.
-- La taille elle-meme n'est PAS rejouee par un declencheur : savoir si une
-- ligne est un « gateau simple » releve du domaine (regime, famille) ; elle
-- est controlee par le domaine et rejouee par la route a la synchronisation.
-- Colonnes neuves, toutes NULL : contraintes validees immediatement.
-- =====================================================================
ALTER TABLE "LigneCommande" ADD COLUMN "tailleAutoriseePar" TEXT,
ADD COLUMN "tailleAutoriseeLe" TIMESTAMP(3);

ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_taille_trace"
  CHECK (("tailleAutoriseePar" IS NULL) = ("tailleAutoriseeLe" IS NULL));
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_taille_nom_non_vide"
  CHECK ("tailleAutoriseePar" IS NULL OR length(btrim("tailleAutoriseePar")) > 0);
-- Retour arriere : ALTER TABLE "LigneCommande" DROP COLUMN "tailleAutoriseeLe",
--   DROP COLUMN "tailleAutoriseePar"; (les deux contraintes tombent avec).
