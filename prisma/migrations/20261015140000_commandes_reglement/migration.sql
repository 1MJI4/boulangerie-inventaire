-- =====================================================================
-- Lot 2 — Commandes (reglement interieur, LOI 7 et 11) et idempotence
-- de la synchronisation d'inventaire.
--
-- Migration SEPAREE plutot que reecriture du lot 1 (jamais applique) :
-- les trois migrations du lot 1 ont ete relues et essayees telles quelles ;
-- celle-ci ne contient que ce qui est neuf, et se lit comme la liste des
-- regles que la base rejoue desormais pour la route commandes.
--
-- Ce que la base garantit ici (niveau 3, rejoue meme si une tablette,
-- une synchronisation ou un script contourne l'interface) :
--   1. Reglages du reglement = DONNEES (table "Reglage", cles reglement:*),
--      valeurs controlees, jamais supprimees.
--   2. Commande :
--      - heure de retrait "HH:MM" ou NULL (commande sans patisserie) ;
--      - retrait avant le jour de la prise -> ERR_DATE_PASSEE ; le lendemain
--        est ACCEPTE sans accord (decision du proprietaire du 15/10/2026,
--        LOI 11) ; colonnes accordLendemainPar/Le conservees (historique,
--        nom ET horodatage ou rien) mais elles ne conditionnent plus rien ;
--      - remise : total facture <= total du tarif ; en dessous, nom ET
--        horodatage du gerant obligatoires (ERR_REMISE_NON_AUTORISEE) ;
--      - acompte <= total (ERR_ACOMPTE_SUPERIEUR_TOTAL) et >= pourcentage
--        minimum LU dans "Reglage" (ERR_ACOMPTE_INSUFFISANT) ;
--      - case « demande inhabituelle ».
--   3. LigneCommande :
--      - minimums du tarif applique (LOI 7, ERR_QUANTITE_MIN,
--        ERR_NB_SYMBOLES_MANQUANT) ;
--      - prix unitaire = prix de la version (regimes A/B et C non plancher,
--        ERR_TARIF_INCOHERENT) ; regime C plancher : >= plancher sauf
--        deverrouillage (ERR_SOUS_PLANCHER) ;
--      - totalTarifCentimes de la commande = somme des lignes, juge au
--        COMMIT (ERR_TOTAL_INCOHERENT) ;
--      - nombre de sandwichs d'un pain surprise (nbObjets) > 0 ;
--      - ligne libre (ni produit du catalogue, ni ancien tarif) : prix > 0,
--        a la piece, et accord du gerant trace (ERR_DROIT_INSUFFISANT).
--   4. Releve : saisieId unique (rejeu de la synchronisation compte une fois).
--
-- NON DESTRUCTIF. Aucune colonne supprimee (gateauComplexe est conservee,
-- copiee dans demandeInhabituelle). Les contraintes portant sur d'anciennes
-- colonnes sont NOT VALID : l'historique n'est pas reecrit, les nouvelles
-- ecritures sont controlees. Requete de verification en fin de fichier.
-- =====================================================================

-- =====================================================================
-- 1. REGLAGES DU REGLEMENT INTERIEUR — des DONNEES, jamais des constantes
-- Valeurs JSON (comme les autres reglages : JSON.parse cote serveur).
--   reglement:acompte_min_pourcent        50          entier 0..100
--   reglement:heure_fermeture             "20:00"     inventaire « jamais avant »
--   reglement:patisserie_retrait_semaine  "09:00"
--   reglement:patisserie_retrait_week_end "12:00"
--   reglement:jours_week_end_iso          [6,7]       1 = lundi ... 7 = dimanche
--   reglement:familles_patisserie         ["patisserie","viennoiserie"]
-- Lus par src/lib/serveur/reglages.ts (forme REGLEMENT_COMMANDE du domaine).
-- =====================================================================

CREATE OR REPLACE FUNCTION "reglage_valeur_valide"(c text, v text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  j jsonb;
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
         'reglement:patisserie_retrait_semaine',
         'reglement:patisserie_retrait_week_end' THEN
      RETURN jsonb_typeof(j) = 'string'
         AND (j #>> '{}') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
    WHEN 'reglement:jours_week_end_iso' THEN
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
    ELSE
      RETURN false; -- cle reglement:* inconnue : faute de frappe probable
  END CASE;
END
$fn$;

ALTER TABLE "Reglage" ADD CONSTRAINT "Reglage_reglement_valide"
  CHECK ("reglage_valeur_valide"("cle", "valeur"));

-- Un reglage du reglement se modifie, il ne se supprime pas : sans lui,
-- aucune commande ne pourrait plus etre validee.
CREATE OR REPLACE FUNCTION "reglage_refuser_suppression"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD."cle" LIKE 'reglement:%' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_CONFIGURATION_SERVEUR',
      DETAIL = format('Le reglage %s ne se supprime pas : modifier sa valeur.', OLD."cle"),
      HINT = 'champ=cle';
  END IF;
  RETURN OLD;
END
$fn$;

CREATE TRIGGER "Reglage_refuser_suppression"
  BEFORE DELETE ON "Reglage"
  FOR EACH ROW EXECUTE FUNCTION "reglage_refuser_suppression"();

-- Donnees initiales = reglement interieur du 15/10/2026 (LOI 11).
-- HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°50, 51, 52) : horaires patisserie
-- appliques aussi a la viennoiserie (regle de doute, comme le domaine),
-- 20h00 tous les jours ouverts, week-end = samedi et dimanche.
-- Rejouable : une valeur deja modifiee par le gerant n'est pas ecrasee.
INSERT INTO "Reglage" ("cle", "valeur", "modifieLe") VALUES
  ('reglement:acompte_min_pourcent',        '50',               CURRENT_TIMESTAMP),
  ('reglement:heure_fermeture',             '"20:00"',          CURRENT_TIMESTAMP),
  ('reglement:patisserie_retrait_semaine',  '"09:00"',          CURRENT_TIMESTAMP),
  ('reglement:patisserie_retrait_week_end', '"12:00"',          CURRENT_TIMESTAMP),
  ('reglement:jours_week_end_iso',          '[6,7]',            CURRENT_TIMESTAMP),
  ('reglement:familles_patisserie',         '["patisserie","viennoiserie"]', CURRENT_TIMESTAMP)
ON CONFLICT ("cle") DO NOTHING;

-- Lecture d'un reglage entier (NULL si absent ou illisible).
CREATE OR REPLACE FUNCTION "reglage_entier"(c text) RETURNS integer
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v text;
BEGIN
  SELECT "valeur" INTO v FROM "Reglage" WHERE "cle" = c;
  IF v IS NULL OR v !~ '^\s*[0-9]{1,9}\s*$' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(v)::integer;
END
$fn$;

-- =====================================================================
-- 2. COMMANDE
-- =====================================================================

-- AlterTable
ALTER TABLE "Commande" ALTER COLUMN "retraitHeure" DROP NOT NULL,
ADD COLUMN     "accordLendemainLe" TIMESTAMP(3),
ADD COLUMN     "accordLendemainPar" TEXT,
ADD COLUMN     "demandeInhabituelle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remiseAutoriseeLe" TIMESTAMP(3),
ADD COLUMN     "remiseAutoriseePar" TEXT,
ADD COLUMN     "totalTarifCentimes" INTEGER;

-- R55 — l'ancienne case « gateau complexe » a le meme sens (domaine :
-- gateauComplexe = alias deprecie de demandeInhabituelle). Copie, sans
-- supprimer l'ancienne colonne (suppression en deux temps).
UPDATE "Commande" SET "demandeInhabituelle" = true WHERE "gateauComplexe";

-- R54 — heure de retrait « HH:MM » (00:00 a 23:59), NULL = non precisee
-- (commande sans patisserie). Anciennes lignes : NOT VALID.
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_retrait_heure_format"
  CHECK ("retraitHeure" IS NULL OR "retraitHeure" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') NOT VALID;

-- R53 (ancien) — accord du responsable pour le lendemain : nom ET horodatage,
-- ou rien. Le lendemain n'exige plus d'accord (15/10/2026) : colonnes gardees
-- pour l'historique, sans effet sur l'acceptation d'une commande.
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_accord_lendemain_trace" CHECK (
  ("accordLendemainPar" IS NULL) = ("accordLendemainLe" IS NULL)
  AND ("accordLendemainPar" IS NULL OR length(btrim("accordLendemainPar")) > 0)
);

-- Remise sur le total (validerPrixConvenu) : nom ET horodatage, ou rien.
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_remise_trace" CHECK (
  ("remiseAutoriseePar" IS NULL) = ("remiseAutoriseeLe" IS NULL)
  AND ("remiseAutoriseePar" IS NULL OR length(btrim("remiseAutoriseePar")) > 0)
);

-- LOI 1 — total facture (totalCentimes) jamais au-dessus du total du tarif
-- (totalTarifCentimes = somme des lignes recalculees par le serveur) ; en
-- dessous seulement avec la remise tracee, et jamais 0 EUR ou moins.
-- totalTarifCentimes NULL = commande anterieure au lot 2 (non controlee).
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_total_convenu" CHECK (
  "totalTarifCentimes" IS NULL
  OR (
    "totalTarifCentimes" >= 0
    AND "totalCentimes" <= "totalTarifCentimes"
    AND ("totalCentimes" = "totalTarifCentimes" OR ("remiseAutoriseePar" IS NOT NULL AND "totalCentimes" > 0))
  )
);

-- R52 — l'acompte ne depasse jamais le total. Anciennes lignes : NOT VALID.
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_acompte_max_total"
  CHECK ("acompteCentimes" <= "totalCentimes") NOT VALID;

-- Premier jour ouvert a partir de d (inclus), d'apres "JourFerme".
-- NULL si aucun jour ouvert sur un an (table incoherente).
-- Outil de calcul (jours ouvres, LOI 3) : plus utilise par le declencheur
-- depuis l'abandon du refus du lendemain, garde pour les requetes.
CREATE OR REPLACE FUNCTION "prochain_jour_ouvert"(d date) RETURNS date
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  j date := d;
BEGIN
  IF d IS NULL THEN
    RETURN NULL;
  END IF;
  FOR i IN 0..366 LOOP
    IF ("fermeture_du_jour"(j))."id" IS NULL THEN
      RETURN j;
    END IF;
    j := j + 1;
  END LOOP;
  RETURN NULL;
END
$fn$;

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

-- Se declenche APRES "Commande_refuser_jour_ferme" (ordre alphabetique des
-- declencheurs) : un mardi reste refuse en ERR_JOUR_FERME, avant tout autre
-- controle du reglement.
CREATE TRIGGER "Commande_reglement"
  BEFORE INSERT OR UPDATE OF "acompteCentimes", "totalCentimes", "totalTarifCentimes",
    "remiseAutoriseePar", "remiseAutoriseeLe", "retraitLe"
  ON "Commande"
  FOR EACH ROW EXECUTE FUNCTION "commande_controler_reglement"();

-- =====================================================================
-- 3. LIGNE DE COMMANDE
-- =====================================================================

-- AlterTable
ALTER TABLE "LigneCommande" ADD COLUMN     "ligneLibreAutoriseeLe" TIMESTAMP(3),
ADD COLUMN     "ligneLibreAutoriseePar" TEXT,
ADD COLUMN     "nbObjets" INTEGER;

-- R14 — pain surprise : nombre de sandwichs demandes (le maximum par pain
-- est un AVERTISSEMENT : pas de contrainte, seulement > 0).
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_nbObjets_positif"
  CHECK ("nbObjets" IS NULL OR "nbObjets" > 0);

-- Ligne libre : accord du gerant, nom ET horodatage, ou rien.
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_ligne_libre_trace" CHECK (
  ("ligneLibreAutoriseePar" IS NULL) = ("ligneLibreAutoriseeLe" IS NULL)
  AND ("ligneLibreAutoriseePar" IS NULL OR length(btrim("ligneLibreAutoriseePar")) > 0)
);

-- Controle de ligne du lot 1 complete :
--  * LOI 7 — minimums du tarif APPLIQUE (PrixProduit fige) : quantite >=
--    max(minimum, minimumParSymbole x nbSymboles). Sans nbSymboles sur un
--    produit a minimum par symbole : refus (on ne peut pas verifier).
--  * ligne libre (ni produit du catalogue, ni ancien tarif) : prix > 0, a la
--    piece, accord du gerant trace. HYPOTHÈSE À VALIDER (QUESTIONS-GERANT n°3).
CREATE OR REPLACE FUNCTION "ligne_commande_controler"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  unite_produit   "Unite";
  regime_produit  "RegimePrix";
  produit_version integer;
  plancher        integer;
  base_version    "BasePrix";
  min_simple      integer;
  min_symbole     integer;
  min_applicable  bigint;
BEGIN
  IF NEW."produitCatalogueId" IS NOT NULL THEN
    SELECT "unite", "regimePrix" INTO unite_produit, regime_produit
      FROM "ProduitCatalogue" WHERE "id" = NEW."produitCatalogueId";
    IF NEW."unite" <> unite_produit THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_UNITE_INCOHERENTE',
        DETAIL = format('Quantite saisie en %s, produit vendu en %s.', NEW."unite", unite_produit),
        HINT = 'champ=unite';
    END IF;
    -- Produit du catalogue sans version de tarif : prix invérifiable (R4,
    -- regle de doute). Les lignes anterieures (tarifId seul) n'ont pas de
    -- produitCatalogueId et ne sont pas concernees.
    IF NEW."prixProduitId" IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_INCOHERENT',
        DETAIL = 'Ligne du catalogue sans version de tarif.',
        HINT = 'champ=prixProduitId';
    END IF;
  END IF;

  IF NEW."prixProduitId" IS NOT NULL THEN
    SELECT "produitId", "prixCentimes", "basePrix", "minimum", "minimumParSymbole"
      INTO produit_version, plancher, base_version, min_simple, min_symbole
      FROM "PrixProduit" WHERE "id" = NEW."prixProduitId";
    IF NEW."produitCatalogueId" IS DISTINCT FROM produit_version THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_INCOHERENT',
        DETAIL = 'La version de prix ne correspond pas au produit de la ligne.',
        HINT = 'champ=prixProduitId';
    END IF;

    -- LOI 1 / LOI 6 — prix unitaire = prix de la version, sauf prix
    -- PLANCHER (regime C par personne ou a la piece, = prixEstPlancher du
    -- catalogue, src/catalogue/lectureBase.ts) qui se modifie vers le haut.
    -- Regime A, B, C au kilo ou au forfait, ou regime absent : egalite
    -- stricte (une Canette a 1 c est refusee).
    IF NOT (regime_produit = 'C' AND base_version IN ('personne', 'piece')) THEN
      IF NEW."prixCentimes" IS DISTINCT FROM plancher THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_INCOHERENT',
          DETAIL = format('Prix %s centimes, tarif de la version %s centimes.', NEW."prixCentimes", plancher),
          HINT = 'champ=prixCentimes';
      END IF;
    ELSIF NEW."prixCentimes" < plancher THEN
      IF NEW."sousPlancherAutorisePar" IS NULL
         OR length(btrim(NEW."sousPlancherAutorisePar")) = 0
         OR NEW."sousPlancherAutoriseLe" IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_SOUS_PLANCHER',
          DETAIL = format('Prix par personne sous le plancher (%s centimes).', plancher),
          HINT = 'champ=prixCentimes';
      END IF;
    END IF;

    -- LOI 7 — tout minimum est BLOQUANT (decision du 15/10/2026).
    IF min_symbole IS NOT NULL AND (NEW."nbSymboles" IS NULL OR NEW."nbSymboles" <= 0) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_NB_SYMBOLES_MANQUANT',
        DETAIL = 'Nombre de chiffres ou lettres absent.',
        HINT = 'champ=nbSymboles';
    END IF;
    min_applicable := GREATEST(COALESCE(min_simple, 0)::bigint,
                               COALESCE(min_symbole::bigint * NEW."nbSymboles", 0));
    IF NEW."quantite" < min_applicable THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_QUANTITE_MIN',
        DETAIL = format('minimum=%s', min_applicable),
        HINT = 'champ=quantite';
    END IF;
  END IF;

  -- Ligne libre (« Autre demande ») : ni produit du catalogue, ni ancien tarif.
  IF NEW."produitCatalogueId" IS NULL AND NEW."tarifId" IS NULL THEN
    IF NEW."prixCentimes" <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_MONTANT_NUL',
        DETAIL = 'Ligne libre sans prix.',
        HINT = 'champ=prixCentimes';
    END IF;
    IF NEW."unite" <> 'piece' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_UNITE_INCOHERENTE',
        DETAIL = 'Une ligne libre se compte a la piece.',
        HINT = 'champ=unite';
    END IF;
    IF NEW."ligneLibreAutoriseePar" IS NULL
       OR length(btrim(NEW."ligneLibreAutoriseePar")) = 0
       OR NEW."ligneLibreAutoriseeLe" IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_DROIT_INSUFFISANT',
        DETAIL = 'Prix d''une ligne libre fixe sans accord du gerant.',
        HINT = 'champ=prixCentimes';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

-- Colonnes surveillees elargies (quantite, nbSymboles, ligne libre). Le
-- changement de tarifId seul (ON DELETE SET NULL d'un ancien Tarif) ne
-- declenche PAS le controle : l'historique n'est pas re-juge.
DROP TRIGGER "LigneCommande_controler" ON "LigneCommande";
CREATE TRIGGER "LigneCommande_controler"
  BEFORE INSERT OR UPDATE OF "produitCatalogueId", "prixProduitId", "prixCentimes", "unite",
    "quantite", "nbSymboles", "sousPlancherAutorisePar", "sousPlancherAutoriseLe",
    "ligneLibreAutoriseePar", "ligneLibreAutoriseeLe"
  ON "LigneCommande"
  FOR EACH ROW EXECUTE FUNCTION "ligne_commande_controler"();

-- LOI 1 — "Commande"."totalTarifCentimes" = somme des totaux de lignes,
-- calcules comme le domaine (totalLigne, src/domaine/unites.ts) :
--   piece : quantite x prix ; kg : arrondi half-up de grammes x prix/kg / 1000
--   (= prixAuPoids de src/domaine/argent.ts ; quantite et prix >= 0).
-- Controle en FIN DE TRANSACTION (CONSTRAINT TRIGGER DEFERRABLE INITIALLY
-- DEFERRED) : l'ecriture imbriquee Prisma (commande puis lignes) et la
-- modification (deleteMany + createMany + update) passent par un etat
-- intermediaire incoherent, seul l'etat au COMMIT est juge.
-- totalTarifCentimes NULL = commande anterieure au lot 2 : non controlee.
CREATE OR REPLACE FUNCTION "total_ligne_centimes"(u "Unite", q integer, p integer) RETURNS bigint
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE WHEN u = 'kg' THEN (q::bigint * p + 500) / 1000
              ELSE q::bigint * p END;
$fn$;

CREATE OR REPLACE FUNCTION "commande_verifier_total"(cid integer) RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  attendu bigint;
  somme_lignes bigint;
BEGIN
  SELECT "totalTarifCentimes" INTO attendu FROM "Commande" WHERE "id" = cid;
  IF NOT FOUND OR attendu IS NULL THEN
    RETURN; -- commande supprimee (cascade) ou anterieure au lot 2
  END IF;
  SELECT COALESCE(sum("total_ligne_centimes"("unite", "quantite", "prixCentimes")), 0)
    INTO somme_lignes FROM "LigneCommande" WHERE "commandeId" = cid;
  IF somme_lignes <> attendu THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TOTAL_INCOHERENT',
      DETAIL = format('Total du tarif %s centimes, somme des lignes %s centimes.', attendu, somme_lignes),
      HINT = 'champ=total';
  END IF;
END
$fn$;

CREATE OR REPLACE FUNCTION "commande_total_controler"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_TABLE_NAME = 'Commande' THEN
    PERFORM "commande_verifier_total"(NEW."id");
  ELSE
    IF TG_OP <> 'INSERT' THEN
      PERFORM "commande_verifier_total"(OLD."commandeId");
    END IF;
    IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."commandeId" IS DISTINCT FROM OLD."commandeId") THEN
      PERFORM "commande_verifier_total"(NEW."commandeId");
    END IF;
  END IF;
  RETURN NULL;
END
$fn$;

CREATE CONSTRAINT TRIGGER "Commande_total_lignes"
  AFTER INSERT OR UPDATE OF "totalTarifCentimes" ON "Commande"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "commande_total_controler"();

CREATE CONSTRAINT TRIGGER "LigneCommande_total_commande"
  AFTER INSERT OR UPDATE OF "quantite", "prixCentimes", "unite", "commandeId" OR DELETE ON "LigneCommande"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "commande_total_controler"();

-- =====================================================================
-- 4. INVENTAIRE — idempotence de la synchronisation (regles-metier)
-- Un geste de comptage = un "saisieId" (genere par la tablette). Le meme
-- saisieId recu deux fois n'ecrit qu'un releve (SQLSTATE 23505 / P2002 sur
-- "Releve_saisieId_key" : la route compare alors la valeur, cf.
-- totalInventaire du domaine). NULL pour les releves anterieurs.
-- Pas de saisieId sur "Inventaire" : c'est l'etat AGREGE de la journee
-- (plusieurs saisies par ligne), deja unique par (produitId, dateInventaire).
-- Heure de debut d'inventaire (AVERT_INVENTAIRE_AVANT_FERMETURE) : pas de
-- colonne, c'est "releveA" du premier releve de la journee (horloge de la
-- tablette, transmise par la route).
-- =====================================================================

-- AlterTable
ALTER TABLE "Releve" ADD COLUMN     "saisieId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Releve_saisieId_key" ON "Releve"("saisieId");

ALTER TABLE "Releve" ADD CONSTRAINT "Releve_saisieId_non_vide"
  CHECK ("saisieId" IS NULL OR length(btrim("saisieId")) > 0);

-- =====================================================================
-- VERIFICATION (a lancer avant VALIDATE CONSTRAINT, ne modifie rien) :
--   SELECT id, numero, "retraitHeure" FROM "Commande"
--    WHERE "retraitHeure" IS NOT NULL
--      AND "retraitHeure" !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
--   SELECT id, numero, "acompteCentimes", "totalCentimes" FROM "Commande"
--    WHERE "acompteCentimes" > "totalCentimes";
-- Si vide :
--   ALTER TABLE "Commande" VALIDATE CONSTRAINT "Commande_retrait_heure_format";
--   ALTER TABLE "Commande" VALIDATE CONSTRAINT "Commande_acompte_max_total";
-- =====================================================================
