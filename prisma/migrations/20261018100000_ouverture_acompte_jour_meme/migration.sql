-- =====================================================================
-- Decisions du proprietaire du 18/10/2026 (LOI 11) :
--   * ACOMPTE sous le pourcentage minimum : n'est plus refuse. Le domaine
--     l'accepte avec un AVERTISSEMENT (AVERT_ACOMPTE_INSUFFISANT), trace
--     avec la commande (colonne "avertissements").
--   * Retrait LE JOUR MEME autorise (la base ne l'a jamais refuse : rien a
--     changer ici, seule une date anterieure au jour de la saisie reste
--     refusee, ERR_DATE_PASSEE).
--   * HEURES D'OUVERTURE du magasin (defaut 06:00 -> 20:00 tous les jours,
--     reglables jour par jour et par date exceptionnelle) : remplacent les
--     horaires de retrait « patisserie » (9h semaine / 12h week-end).
--   * Delai minimum d'un GATEAU A ETAGES : reglage du gerant (defaut 0).
--   * L'heure de debut d'inventaire (R57) devient la fermeture du jour :
--     la cle reglement:heure_fermeture n'est plus lue.
--
-- Migration NOUVELLE : les precedentes sont deja appliquees et ne sont
-- JAMAIS modifiees apres coup.
--
-- 1. "commande_controler_reglement" : meme fonction que dans
--    20261015160000_lendemain_accepte, SANS le refus ERR_ACOMPTE_INSUFFISANT
--    (et donc sans la lecture du reglage reglement:acompte_min_pourcent ni
--    le refus ERR_CONFIGURATION_SERVEUR qui ne servaient qu'a ce minimum).
--    Restent identiques : total convenu / remise (ERR_TOTAL_INCOHERENT,
--    ERR_REMISE_NON_AUTORISEE), acompte superieur au total
--    (ERR_ACOMPTE_SUPERIEUR_TOTAL), date de retrait passee (ERR_DATE_PASSEE).
--    Le declencheur "Commande_reglement" est inchange (meme fonction).
--    Le mardi reste refuse par "Commande_refuser_jour_ferme" (inchange).
-- 2. "reglage_valeur_valide" (CHECK "Reglage_reglement_valide") : nouvelles
--    cles, anciennes cles retirees (elles ne sont plus lues) :
--      reglement:ouverture_par_jour
--        {"1":{"ouverture":"06:00","fermeture":"20:00"}, ... "7":{...}}
--        objet, exactement les cles "1".."7" (ISO, 1 = lundi), chaque jour
--        exactement { ouverture, fermeture } en « HH:MM », ouverture < fermeture
--      reglement:ouverture_exceptions
--        [{"date":"AAAA-MM-JJ","ouverture":"HH:MM","fermeture":"HH:MM"}]
--        dates calendaires valides, une seule entree par date
--      reglement:delai_gateau_etages_jours
--        entier 0..365 (jours ouvres)
--    Restent : reglement:acompte_min_pourcent (lu par le domaine pour
--    l'avertissement), reglement:tailles_gateau.
-- 3. Donnees : les nouvelles cles sont inserees avec les valeurs du
--    proprietaire (ON CONFLICT DO NOTHING : rejouable, n'ecrase rien).
-- 4. Anciennes cles reglement:* que plus rien ne lit : ARCHIVEES (renommees
--    « archive_20261018:<cle> », hors du controle du CHECK et hors de
--    l'espace « reglement: ») plutot que detruites, pour que le retour
--    arriere retrouve les valeurs du gerant. Le declencheur
--    "Reglage_refuser_suppression" n'est pas touche (aucune suppression).
--      reglement:heure_fermeture, reglement:familles_patisserie,
--      reglement:patisserie_retrait_par_jour, reglement:patisserie_retrait_exceptions,
--      reglement:patisserie_retrait_semaine, reglement:patisserie_retrait_week_end,
--      reglement:jours_week_end_iso
--    Les lignes d'archive se suppriment a une version ulterieure.
--
-- Fermetures (decision du 18/10/2026) : seul le mardi est ferme, les jours
-- feries sont OUVERTS, pas de conges. La table "JourFerme" n'est PAS
-- touchee (seule la ligne hebdomadaire « mardi » y figure).
--
-- Retour arriere : voir le bloc commente en fin de fichier.
-- =====================================================================

-- ---- 1. Fonction du reglement, sans le refus de l'acompte minimum ----
-- Regles du reglement rejouees a chaque ecriture de commande.
-- Les codes sont ceux du domaine (src/domaine/messages.ts) ; gestion-erreurs
-- les traduit (src/lib/erreurBase.ts).
CREATE OR REPLACE FUNCTION "commande_controler_reglement"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  jour_saisie date;
BEGIN
  -- ---- Total convenu / remise (validerPrixConvenu) ----
  IF NEW."totalTarifCentimes" IS NOT NULL THEN
    IF NEW."totalCentimes" > NEW."totalTarifCentimes" THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TOTAL_INCOHERENT',
        DETAIL = format('Total %s centimes, tarif %s centimes.', NEW."totalCentimes", NEW."totalTarifCentimes"),
        HINT = 'champ=total';
    END IF;
    IF NEW."totalCentimes" < NEW."totalTarifCentimes"
       AND (NEW."remiseAutoriseePar" IS NULL OR length(btrim(NEW."remiseAutoriseePar")) = 0 OR NEW."remiseAutoriseeLe" IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_REMISE_NON_AUTORISEE',
        DETAIL = format('Total du tarif : %s centimes.', NEW."totalTarifCentimes"),
        HINT = 'champ=total';
    END IF;
  END IF;

  -- ---- Acompte (R52, validerAcompte) ----
  -- Decision du proprietaire du 18/10/2026 : un acompte sous le pourcentage
  -- minimum est ACCEPTE (avertissement du domaine, trace avec la commande).
  -- Seul un acompte superieur au total reste refuse.
  IF TG_OP = 'INSERT'
     OR NEW."acompteCentimes" IS DISTINCT FROM OLD."acompteCentimes"
     OR NEW."totalCentimes"   IS DISTINCT FROM OLD."totalCentimes" THEN
    IF NEW."acompteCentimes" > NEW."totalCentimes" THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_ACOMPTE_SUPERIEUR_TOTAL',
        DETAIL = format('Acompte %s centimes, total %s centimes.', NEW."acompteCentimes", NEW."totalCentimes"),
        HINT = 'champ=acompte';
    END IF;
  END IF;

  -- ---- Date de retrait : passee (R53) ----
  -- Jour de la saisie : a la creation, le jour LOCAL de la prise de commande
  -- (priseLe, horloge de la tablette transmise par la route : une commande
  -- prise hors ligne et synchronisee plus tard est jugee a sa date de prise) ;
  -- a une modification de la date de retrait, le jour du magasin.
  -- Le jour meme et le lendemain ne sont PAS refuses ici : decisions du
  -- proprietaire du 15/10/2026 et du 18/10/2026 (LOI 11).
  -- Seule une date anterieure au jour de la saisie est refusee.
  IF TG_OP = 'INSERT' OR NEW."retraitLe" IS DISTINCT FROM OLD."retraitLe" THEN
    IF TG_OP = 'INSERT' THEN
      jour_saisie := ((NEW."priseLe" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Brussels')::date;
    ELSE
      jour_saisie := "date_du_jour_magasin"();
    END IF;

    IF NEW."retraitLe" < jour_saisie THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_DATE_PASSEE',
        DETAIL = format('Retrait %s, saisie %s.', NEW."retraitLe", jour_saisie),
        HINT = 'champ=retraitLe';
    END IF;
  END IF;

  RETURN NEW;
END
$fn$;

-- ---- 2. Controle des reglages : heures d'ouverture, delai etages ----

-- Plage d'ouverture : exactement { ouverture, fermeture } en « HH:MM »,
-- ouverture STRICTEMENT avant fermeture (comparaison de textes « HH:MM »
-- de meme longueur = comparaison d'heures).
CREATE OR REPLACE FUNCTION "reglage_plage_valide"(p jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  cles text[];
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RETURN false;
  END IF;
  SELECT array_agg(k ORDER BY k) INTO cles FROM jsonb_object_keys(p) k;
  IF cles IS DISTINCT FROM ARRAY['fermeture','ouverture'] THEN
    RETURN false;
  END IF;
  RETURN "reglage_heure_valide"(p -> 'ouverture')
     AND "reglage_heure_valide"(p -> 'fermeture')
     AND (p ->> 'ouverture') < (p ->> 'fermeture');
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
    RETURN true; -- les autres reglages (coupes, imprimante, archives...) ne sont pas controles ici
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

    -- Heures d'ouverture du magasin, jour par jour (ISO 1 = lundi).
    -- Les sept jours sont obligatoires : un jour manquant n'aurait pas
    -- d'horaires et laisserait passer n'importe quelle heure.
    WHEN 'reglement:ouverture_par_jour' THEN
      IF jsonb_typeof(j) <> 'object' THEN
        RETURN false;
      END IF;
      SELECT array_agg(k ORDER BY k) INTO cles FROM jsonb_object_keys(j) k;
      IF cles IS DISTINCT FROM ARRAY['1','2','3','4','5','6','7'] THEN
        RETURN false;
      END IF;
      RETURN NOT EXISTS (SELECT 1 FROM jsonb_each(j) x WHERE NOT "reglage_plage_valide"(x.value));

    -- Dates exceptionnelles : { date, ouverture, fermeture }, une seule par date.
    WHEN 'reglement:ouverture_exceptions' THEN
      IF jsonb_typeof(j) <> 'array' THEN
        RETURN false;
      END IF;
      FOR elem IN SELECT x FROM jsonb_array_elements(j) x LOOP
        IF jsonb_typeof(elem) <> 'object' THEN
          RETURN false;
        END IF;
        SELECT array_agg(k ORDER BY k) INTO cles FROM jsonb_object_keys(elem) k;
        IF cles IS DISTINCT FROM ARRAY['date','fermeture','ouverture']
           OR NOT "reglage_date_valide"(elem -> 'date')
           OR NOT "reglage_plage_valide"(elem - 'date') THEN
          RETURN false;
        END IF;
      END LOOP;
      RETURN (SELECT count(*) FROM jsonb_array_elements(j))
           = (SELECT count(DISTINCT x ->> 'date') FROM jsonb_array_elements(j) x);

    -- Delai minimum d'un gateau a etages, en jours ouvres (0 = aucun).
    WHEN 'reglement:delai_gateau_etages_jours' THEN
      RETURN jsonb_typeof(j) = 'number'
         AND j::text ~ '^[0-9]{1,3}$'
         AND (j::text)::integer BETWEEN 0 AND 365;

    -- Tailles standard d'un gateau simple (nombre de parts) — inchange.
    -- Non vide, entiers 1..200, strictement croissants (= tries, sans doublon).
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
      RETURN false; -- cle reglement:* inconnue (ou retiree) : faute de frappe probable
  END CASE;
END
$fn$;

-- ---- 3. Donnees initiales (decisions du proprietaire, 18/10/2026) ----
-- Rejouable : une cle deja presente (modifiee par le gerant) n'est jamais ecrasee.
INSERT INTO "Reglage" ("cle", "valeur", "modifieLe") VALUES
  ('reglement:ouverture_par_jour',
   '{"1":{"ouverture":"06:00","fermeture":"20:00"},"2":{"ouverture":"06:00","fermeture":"20:00"},"3":{"ouverture":"06:00","fermeture":"20:00"},"4":{"ouverture":"06:00","fermeture":"20:00"},"5":{"ouverture":"06:00","fermeture":"20:00"},"6":{"ouverture":"06:00","fermeture":"20:00"},"7":{"ouverture":"06:00","fermeture":"20:00"}}',
   CURRENT_TIMESTAMP),
  ('reglement:ouverture_exceptions',       '[]', CURRENT_TIMESTAMP),
  ('reglement:delai_gateau_etages_jours',  '0',  CURRENT_TIMESTAMP)
ON CONFLICT ("cle") DO NOTHING;

-- ---- 4. Anciennes cles : archivees (plus rien ne les lit) ----
-- Une archive deja presente (migration rejouee a la main) n'est pas ecrasee :
-- la cle reglement:* restante est alors laissee telle quelle et le CHECK
-- (qui ne la connait plus) refuserait toute future modification — on la
-- signale par la requete de verification ci-dessous.
UPDATE "Reglage" r
SET "cle" = 'archive_20261018:' || r."cle", "modifieLe" = CURRENT_TIMESTAMP
WHERE r."cle" IN (
    'reglement:heure_fermeture',
    'reglement:familles_patisserie',
    'reglement:patisserie_retrait_par_jour',
    'reglement:patisserie_retrait_exceptions',
    'reglement:patisserie_retrait_semaine',
    'reglement:patisserie_retrait_week_end',
    'reglement:jours_week_end_iso')
  AND NOT EXISTS (SELECT 1 FROM "Reglage" a WHERE a."cle" = 'archive_20261018:' || r."cle");

-- Verification apres deploiement (doit renvoyer 0 ligne) :
--   SELECT "cle", "valeur" FROM "Reglage"
--   WHERE "cle" LIKE 'reglement:%' AND NOT "reglage_valeur_valide"("cle", "valeur");
--
-- Retour arriere (manuel, a ne lancer qu'apres retour du code precedent) :
--   1. Remettre les anciennes cles :
--        UPDATE "Reglage" SET "cle" = substr("cle", length('archive_20261018:') + 1)
--        WHERE "cle" LIKE 'archive_20261018:%';
--      (avant : recreer "reglage_valeur_valide" depuis 20261015150000, sinon
--      le CHECK refuse les anciennes cles.)
--   2. Retirer les nouvelles cles (le declencheur interdit la suppression) :
--        ALTER TABLE "Reglage" DISABLE TRIGGER "Reglage_refuser_suppression";
--        DELETE FROM "Reglage" WHERE "cle" IN ('reglement:ouverture_par_jour',
--          'reglement:ouverture_exceptions', 'reglement:delai_gateau_etages_jours');
--        ALTER TABLE "Reglage" ENABLE TRIGGER "Reglage_refuser_suppression";
--      Ordre : DELETE des nouvelles cles AVANT de recreer l'ancienne fonction
--      (l'ancienne fonction ne les connait pas ; une ligne existante n'est
--      pas re-verifiee, mais toute modification serait refusee).
--   3. Recreer "commande_controler_reglement" depuis
--      20261015160000_lendemain_accepte (retablit le refus ERR_ACOMPTE_INSUFFISANT).
--   4. DROP FUNCTION "reglage_plage_valide"(jsonb);
