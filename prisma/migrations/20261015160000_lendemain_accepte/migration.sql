-- =====================================================================
-- LOI 11 — commande pour le LENDEMAIN acceptee (decision du proprietaire,
-- 15/10/2026 : « generalement acceptees ») + gateau a etages (delai).
--
-- Migration NOUVELLE : la 20261015140000 est deja appliquee (recette, et
-- toute base deployee depuis le lot 2) et n'est JAMAIS modifiee apres coup —
-- `migrate deploy` ne la rejouerait pas et le refus resterait en place.
--
-- 1. "commande_controler_reglement" : meme fonction que dans 20261015140000,
--    SANS le refus ERR_COMMANDE_LENDEMAIN. Seule une date de retrait
--    anterieure au jour de la saisie reste refusee (ERR_DATE_PASSEE).
--    CREATE OR REPLACE : passe aussi sur une base ou la fonction a deja ete
--    corrigee a la main.
-- 2. Declencheur "Commande_reglement" recree SANS les colonnes
--    accordLendemainPar / accordLendemainLe (elles ne conditionnent plus
--    rien). Les colonnes et leur CHECK "Commande_accord_lendemain_trace"
--    restent (historique, nom ET horodatage ou rien).
--    "prochain_jour_ouvert"(date) est conservee (calcul en jours ouvres,
--    LOI 3), plus appelee par le declencheur.
--    Le mardi reste refuse par "Commande_refuser_jour_ferme" (inchange).
-- 3. "ProduitCatalogue"."etages" : nombre d'etages d'un gateau a etages
--    (mariage, piece montee). NULL = pas un gateau a etages. Lu par le
--    domaine pour le delai de commande (delais.gateauAEtages,
--    src/domaine/commande.ts) ; ecrit par l'import du catalogue, et rempli
--    ici pour les fiches deja importees (cles exactes, voir section 3).
--
-- Retour arriere : voir le bloc commente en fin de fichier.
-- =====================================================================

-- ---- 1. Fonction du reglement, sans le refus du lendemain ----
-- Regles du reglement rejouees a chaque ecriture de commande.
-- Les codes sont ceux du domaine (src/domaine/messages.ts) ; gestion-erreurs
-- les traduit (src/lib/erreurBase.ts).
CREATE OR REPLACE FUNCTION "commande_controler_reglement"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  jour_saisie date;
  pourcent    integer;
  minimum     bigint;
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
  IF TG_OP = 'INSERT'
     OR NEW."acompteCentimes" IS DISTINCT FROM OLD."acompteCentimes"
     OR NEW."totalCentimes"   IS DISTINCT FROM OLD."totalCentimes" THEN
    IF NEW."acompteCentimes" > NEW."totalCentimes" THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_ACOMPTE_SUPERIEUR_TOTAL',
        DETAIL = format('Acompte %s centimes, total %s centimes.', NEW."acompteCentimes", NEW."totalCentimes"),
        HINT = 'champ=acompte';
    END IF;
    pourcent := "reglage_entier"('reglement:acompte_min_pourcent');
    IF pourcent IS NULL OR pourcent < 0 OR pourcent > 100 THEN
      -- Sans le reglage, on ne sait pas dire : on refuse (regle de doute).
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_CONFIGURATION_SERVEUR',
        DETAIL = 'Reglage reglement:acompte_min_pourcent absent ou illisible.',
        HINT = 'champ=acompte';
    END IF;
    -- Arrondi au centime SUPERIEUR (= partMinimale de src/domaine/argent.ts).
    minimum := (NEW."totalCentimes"::bigint * pourcent + 99) / 100;
    IF NEW."acompteCentimes" < minimum THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_ACOMPTE_INSUFFISANT',
        DETAIL = format('minimum=%s;pourcentage=%s', minimum, pourcent),
        HINT = 'champ=acompte';
    END IF;
  END IF;

  -- ---- Date de retrait : passee (R53) ----
  -- Jour de la saisie : a la creation, le jour LOCAL de la prise de commande
  -- (priseLe, horloge de la tablette transmise par la route : une commande
  -- prise hors ligne et synchronisee plus tard est jugee a sa date de prise) ;
  -- a une modification de la date de retrait, le jour du magasin.
  -- Le lendemain (et le jour meme) ne sont PAS refuses ici : decision du
  -- proprietaire du 15/10/2026, plus d'accord du responsable (LOI 11).
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

-- ---- 2. Declencheur, sans les colonnes d accord du lendemain ----
-- Se declenche APRES "Commande_refuser_jour_ferme" (ordre alphabetique des
-- declencheurs) : un mardi reste refuse en ERR_JOUR_FERME, avant tout autre
-- controle du reglement.
DROP TRIGGER IF EXISTS "Commande_reglement" ON "Commande";
CREATE TRIGGER "Commande_reglement"
  BEFORE INSERT OR UPDATE OF "acompteCentimes", "totalCentimes", "totalTarifCentimes",
    "remiseAutoriseePar", "remiseAutoriseeLe", "retraitLe"
  ON "Commande"
  FOR EACH ROW EXECUTE FUNCTION "commande_controler_reglement"();

-- ---- 3. Gateau a etages (delai de commande, LOI 3 jours ouvres) ----
-- Colonne neuve, toute NULL : contrainte validee immediatement.
ALTER TABLE "ProduitCatalogue" ADD COLUMN "etages" INTEGER;
ALTER TABLE "ProduitCatalogue" ADD CONSTRAINT "ProduitCatalogue_etages_positif"
  CHECK ("etages" IS NULL OR "etages" > 0);

-- Remplissage des fiches DEJA importees : sans lui, une base dont le catalogue
-- a ete importe avant cette migration garde etages NULL et perd le delai
-- « gateau a etages » (un mariage pour le lendemain serait accepte) tant que
-- l'import n'est pas relance.
-- Source : data/tarifs-sur-commande_2026-10.json, champ "etages" des lignes
-- "gateaux-sur-commande/gateau-de-mariage" (2) et
-- "gateaux-sur-commande/piece-montee" (3). Par cle catalogue EXACTE, jamais
-- par le nom. "etages IS NULL" : n'ecrase jamais une valeur deja posee.
-- Une base sans ces fiches (catalogue jamais importe) : 0 ligne, sans effet ;
-- l'import les creera avec leurs etages.
UPDATE "ProduitCatalogue" SET "etages" = 2
  WHERE "cleCatalogue" = 'gateaux-sur-commande/gateau-de-mariage' AND "etages" IS NULL;
UPDATE "ProduitCatalogue" SET "etages" = 3
  WHERE "cleCatalogue" = 'gateaux-sur-commande/piece-montee' AND "etages" IS NULL;

-- Retour arriere (manuel, apres retour du code precedent) :
--   ALTER TABLE "ProduitCatalogue" DROP COLUMN "etages";  -- en deux temps :
--     d'abord cesser de la lire/ecrire, la supprimer a la version suivante.
--   Puis recreer "commande_controler_reglement" et le declencheur
--   "Commande_reglement" depuis 20261015140000 (retablit le refus du lendemain).
