-- =====================================================================
-- Lot 1 — Catalogue versionne (LOI 1), unites (LOI 2), regimes (LOI 6),
-- favoris (LOI 4), seuils en donnees (LOI 7).
--
-- NON DESTRUCTIF : uniquement des ajouts (types, colonnes, table, index,
-- contraintes, declencheurs). Aucune colonne ni ligne supprimee.
-- La table "Tarif" (prix ecrases sur place) est conservee telle quelle et
-- devient OBSOLETE ; son retrait se fera en deux temps, a un lot ulterieur.
--
-- Codes d'erreur leves par les declencheurs (MESSAGE = code, DETAIL =
-- precision lisible, HINT = 'champ=<nom>') — traduits en message humain par
-- `gestion-erreurs`, jamais montres bruts a un employe (LOI 9) :
--   ERR_TARIF_IMMUABLE, ERR_TARIF_PASSE, ERR_TARIF_CHEVAUCHEMENT,
--   ERR_UNITE_INCOHERENTE, ERR_UNITE_FIGEE, ERR_REGIME_FIGE,
--   ERR_TARIF_INCOHERENT, ERR_SOUS_PLANCHER, ERR_DROIT_INSUFFISANT,
--   ERR_PRODUIT_EN_DOUBLE (SQLSTATE 23505)
-- =====================================================================

-- CreateEnum
CREATE TYPE "Unite" AS ENUM ('piece', 'kg');

-- CreateEnum
CREATE TYPE "RegimePrix" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "BasePrix" AS ENUM ('piece', 'kg', 'personne', 'forfait');

-- ---------------------------------------------------------------------
-- Produit : identite STABLE. Son id ne change jamais quand un prix change.
-- Reprise des donnees : les produits existants sont tous comptes a la piece
-- (aucun des 4 produits au kilo n'existe dans "Produit" au 15/10/2026) ->
-- unite = 'piece' par defaut est exact. regimePrix reste NULL (= non
-- renseigne, invendable) : le regime ne se devine pas, il est pose par
-- l'import du catalogue (`catalogue-prix`).
-- ---------------------------------------------------------------------

-- LOI 5 — le libelle n'est plus unique : « Baguette » existe en plusieurs
-- sous-categories dans le CSV, et un meme nom peut exister en regime A et C.
-- L'identite du catalogue devient "cleCatalogue" (unique). L'unicite par nom
-- est conservee, par declencheur, pour les produits hors catalogue (voir
-- plus bas) : aucune protection existante n'est perdue.
-- DropIndex
DROP INDEX "Produit_nom_key";

-- CreateIndex
CREATE INDEX "Produit_nom_idx" ON "Produit"("nom");

-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "cleCatalogue" TEXT,
ADD COLUMN     "estFavori" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "regimePrix" "RegimePrix",
ADD COLUMN     "sousCategorie" TEXT,
ADD COLUMN     "unite" "Unite" NOT NULL DEFAULT 'piece';

-- CreateIndex
CREATE UNIQUE INDEX "Produit_cleCatalogue_key" ON "Produit"("cleCatalogue");

-- CreateIndex
CREATE INDEX "Produit_regimePrix_actif_idx" ON "Produit"("regimePrix", "actif");

-- Un produit hors catalogue (cleCatalogue NULL, saisi avant le lot 1 ou par
-- l'ecran de gestion des produits) reste unique par nom, comme avant.
-- SQLSTATE 23505 (unique_violation) : meme erreur qu'avec l'ancien index.
CREATE OR REPLACE FUNCTION "produit_nom_unique_hors_catalogue"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW."cleCatalogue" IS NULL AND EXISTS (
    SELECT 1 FROM "Produit" p
    WHERE p."nom" = NEW."nom" AND p."cleCatalogue" IS NULL AND p."id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'ERR_PRODUIT_EN_DOUBLE',
      DETAIL = format('Un produit nomme « %s » existe deja.', NEW."nom"),
      HINT = 'champ=nom';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "Produit_nom_unique_hors_catalogue"
  BEFORE INSERT OR UPDATE OF "nom", "cleCatalogue" ON "Produit"
  FOR EACH ROW EXECUTE FUNCTION "produit_nom_unique_hors_catalogue"();

-- ---------------------------------------------------------------------
-- PrixProduit : une ligne par periode de validite [valideDu ; valideAu]
-- (bornes INCLUSES, valideAu NULL = en cours). Porte aussi la TVA et les
-- seuils (LOI 7), versionnes avec le tarif.
-- ---------------------------------------------------------------------

-- CreateTable
CREATE TABLE "PrixProduit" (
    "id" SERIAL NOT NULL,
    "prixCentimes" INTEGER NOT NULL,
    "basePrix" "BasePrix" NOT NULL,
    "valideDu" DATE NOT NULL,
    "valideAu" DATE,
    "tauxTvaEmporterPb" INTEGER,
    "tauxTvaSurPlacePb" INTEGER,
    "minimum" INTEGER,
    "minimumParSymbole" INTEGER,
    "maximum" INTEGER,
    "versionCode" TEXT,
    "source" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produitId" INTEGER NOT NULL,
    "creePar" TEXT,

    CONSTRAINT "PrixProduit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrixProduit_valideDu_idx" ON "PrixProduit"("valideDu");

-- CreateIndex
CREATE UNIQUE INDEX "PrixProduit_produitId_valideDu_key" ON "PrixProduit"("produitId", "valideDu");

-- AddForeignKey (RESTRICT : un produit qui a un tarif ne se supprime jamais)
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Auteur du tarif : nom declare, texte trace (decision du 15/10/2026 :
-- pas de comptes par employe, donc pas de cle vers une table d'identites).
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_creePar_non_vide"
  CHECK ("creePar" IS NULL OR length(btrim("creePar")) > 0);

-- LOI 1 — centimes entiers, strictement positifs.
-- HYPOTHÈSE À VALIDER : aucun produit n'est au catalogue a 0 EUR (vrai dans
-- le CSV 2026-09). Un article offert se traite sur la commande, pas au tarif.
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_prix_positif"
  CHECK ("prixCentimes" > 0);
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_periode_coherente"
  CHECK ("valideAu" IS NULL OR "valideAu" >= "valideDu");
-- R9 — TVA en points de base (600 = 6 %) ; NULL = a confirmer par le comptable.
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_tva_bornee" CHECK (
      ("tauxTvaEmporterPb" IS NULL OR "tauxTvaEmporterPb" BETWEEN 0 AND 10000)
  AND ("tauxTvaSurPlacePb" IS NULL OR "tauxTvaSurPlacePb" BETWEEN 0 AND 10000)
);
-- LOI 7 — seuils strictement positifs, dans l'unite de base du produit.
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_seuils_positifs" CHECK (
      ("minimum" IS NULL OR "minimum" > 0)
  AND ("maximum" IS NULL OR "maximum" > 0)
  AND ("minimumParSymbole" IS NULL OR "minimumParSymbole" > 0)
  AND ("minimum" IS NULL OR "maximum" IS NULL OR "maximum" >= "minimum")
);

-- Reprise des donnees : AUCUNE copie automatique depuis "Tarif".
-- HYPOTHÈSE À VALIDER : "Tarif" et "Produit" n'ont jamais ete rapproches
-- (schema : « aucun rapprochement ») et les prix de "Tarif" ont pu etre
-- ecrases sur place ; les recopier inventerait une date d'effet. Les
-- versions de prix sont creees par l'import du CSV (`catalogue-prix`).

-- Date « du jour » du magasin (Belgique), pas celle du serveur (UTC).
CREATE OR REPLACE FUNCTION "date_du_jour_magasin"() RETURNS date
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT (now() AT TIME ZONE 'Europe/Brussels')::date
$fn$;

-- LOI 1 — un nouveau tarif n'ecrase jamais l'ancien.
--  * insertion / modification : pas de chevauchement de periodes pour un
--    meme produit (serialise par un verrou sur la ligne Produit) ;
--  * basePrix 'kg' si et seulement si le produit est au kilo (LOI 2) ;
--  * version deja en vigueur (valideDu <= aujourd'hui) : prix, base, seuils,
--    produit et date de debut figes ; TVA modifiable seulement de NULL vers une valeur
--    (completion d'une donnee « a confirmer ») ; date de fin modifiable,
--    mais jamais dans le passe (au plus tot : hier) ;
--  * suppression : seulement d'une version pas encore entree en vigueur.
-- Procedure de changement de prix (dans une transaction) :
--   1. UPDATE version courante SET valideAu = <nouvelle date> - 1
--   2. INSERT nouvelle version valideDu = <nouvelle date>, valideAu NULL
CREATE OR REPLACE FUNCTION "prix_produit_controler"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  aujourdhui    date := "date_du_jour_magasin"();
  unite_produit "Unite";
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."valideDu" <= aujourdhui THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_IMMUABLE',
        DETAIL = 'Un tarif entre en vigueur ne se supprime pas : fermer sa periode et creer une nouvelle version.',
        HINT = 'champ=valideDu';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
   IF OLD."valideDu" <= aujourdhui THEN
    IF NEW."produitId" IS DISTINCT FROM OLD."produitId"
       OR NEW."prixCentimes" IS DISTINCT FROM OLD."prixCentimes"
       OR NEW."basePrix" IS DISTINCT FROM OLD."basePrix"
       OR NEW."valideDu" IS DISTINCT FROM OLD."valideDu"
       OR NEW."minimum" IS DISTINCT FROM OLD."minimum"
       OR NEW."minimumParSymbole" IS DISTINCT FROM OLD."minimumParSymbole"
       OR NEW."maximum" IS DISTINCT FROM OLD."maximum"
       OR (OLD."tauxTvaEmporterPb" IS NOT NULL
           AND NEW."tauxTvaEmporterPb" IS DISTINCT FROM OLD."tauxTvaEmporterPb")
       OR (OLD."tauxTvaSurPlacePb" IS NOT NULL
           AND NEW."tauxTvaSurPlacePb" IS DISTINCT FROM OLD."tauxTvaSurPlacePb") THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_IMMUABLE',
        DETAIL = 'Un tarif entre en vigueur ne se modifie pas : creer une nouvelle version datee.',
        HINT = 'champ=prixCentimes';
    END IF;
    IF NEW."valideAu" IS DISTINCT FROM OLD."valideAu" AND (
         (OLD."valideAu" IS NOT NULL AND OLD."valideAu" < aujourdhui - 1)
      OR (NEW."valideAu" IS NOT NULL AND NEW."valideAu" < aujourdhui - 1)) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_PASSE',
        DETAIL = 'La periode passee d''un tarif ne se reecrit pas.',
        HINT = 'champ=valideAu';
    END IF;
   END IF;
  END IF;

  -- Pas de chevauchement. Le verrou NO KEY UPDATE serialise les ecritures de
  -- tarif d'un meme produit sans bloquer les inventaires (FOR KEY SHARE).
  SELECT "unite" INTO unite_produit FROM "Produit" WHERE "id" = NEW."produitId" FOR NO KEY UPDATE;

  -- LOI 2 — un prix au kilo pour un produit au kilo, et seulement lui.
  IF (NEW."basePrix" = 'kg') IS DISTINCT FROM (unite_produit = 'kg') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_UNITE_INCOHERENTE',
      DETAIL = format('Prix exprime par %s, produit compte en %s.', NEW."basePrix", unite_produit),
      HINT = 'champ=basePrix';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PrixProduit" p
    WHERE p."produitId" = NEW."produitId"
      AND p."id" <> NEW."id"
      AND daterange(p."valideDu", p."valideAu", '[]')
          && daterange(NEW."valideDu", NEW."valideAu", '[]')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_CHEVAUCHEMENT',
      DETAIL = 'Une autre version de prix couvre deja cette periode : fermer la version courante d''abord.',
      HINT = 'champ=valideDu';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "PrixProduit_controler"
  BEFORE INSERT OR UPDATE OR DELETE ON "PrixProduit"
  FOR EACH ROW EXECUTE FUNCTION "prix_produit_controler"();

-- ---------------------------------------------------------------------
-- LOI 2 / LOI 6 — l'unite et le regime d'un produit sont figes des qu'il a
-- un historique : les changer reinterpreterait les quantites (pieces <->
-- grammes) et les prix (prix fixe <-> plancher) deja enregistres.
-- Passer de NULL a un regime reste permis (premiere affectation).
-- Sortie : creer un nouveau produit et archiver l'ancien (actif = false).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "produit_controler"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW."unite" IS DISTINCT FROM OLD."unite" AND (
       EXISTS (SELECT 1 FROM "PrixProduit"   WHERE "produitId" = OLD."id")
    OR EXISTS (SELECT 1 FROM "Inventaire"    WHERE "produitId" = OLD."id")
    OR EXISTS (SELECT 1 FROM "Releve"        WHERE "produitId" = OLD."id")
    OR EXISTS (SELECT 1 FROM "LigneCommande" WHERE "produitId" = OLD."id")) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_UNITE_FIGEE',
      DETAIL = 'Ce produit a deja un historique : creer un nouveau produit plutot que changer son unite.',
      HINT = 'champ=unite';
  END IF;
  IF OLD."regimePrix" IS NOT NULL
     AND NEW."regimePrix" IS DISTINCT FROM OLD."regimePrix"
     AND (EXISTS (SELECT 1 FROM "PrixProduit"   WHERE "produitId" = OLD."id")
       OR EXISTS (SELECT 1 FROM "LigneCommande" WHERE "produitId" = OLD."id")) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_REGIME_FIGE',
      DETAIL = 'Ce produit a deja des prix ou des commandes : creer un nouveau produit plutot que changer son regime.',
      HINT = 'champ=regimePrix';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "Produit_controler"
  BEFORE UPDATE OF "unite", "regimePrix" ON "Produit"
  FOR EACH ROW EXECUTE FUNCTION "produit_controler"();

-- ---------------------------------------------------------------------
-- Inventaire / Releve — unite figee sur chaque ligne (pieces ou GRAMMES).
-- Reprise des donnees : toutes les lignes existantes sont a la piece
-- (aucun produit au kilo en inventaire) -> DEFAULT 'piece' exact.
-- ---------------------------------------------------------------------

-- AlterTable
ALTER TABLE "Inventaire" ADD COLUMN     "unite" "Unite" NOT NULL DEFAULT 'piece';

-- AlterTable
ALTER TABLE "Releve" ADD COLUMN     "unite" "Unite" NOT NULL DEFAULT 'piece';

-- Quantites jamais negatives. NOT VALID : s'applique a toute nouvelle
-- ecriture sans bloquer la migration sur d'eventuelles lignes anciennes
-- (a controler avec la requete de verification, puis VALIDATE CONSTRAINT).
ALTER TABLE "Inventaire" ADD CONSTRAINT "Inventaire_quantites_positives" CHECK (
      ("quantiteRestante" IS NULL OR "quantiteRestante" >= 0)
  AND ("quantiteProduite" IS NULL OR "quantiteProduite" >= 0)
  AND ("quantitePrevue"   IS NULL OR "quantitePrevue"   >= 0)
  AND ("quantiteCommande" IS NULL OR "quantiteCommande" >= 0)
) NOT VALID;

ALTER TABLE "Releve" ADD CONSTRAINT "Releve_quantite_positive"
  CHECK ("quantiteRestante" >= 0) NOT VALID;

-- LOI 2 — la ligne doit etre dans l'unite du produit. Un ancien ecran qui
-- compterait a la piece un produit au kilo est REFUSE, pas accepte en silence.
CREATE OR REPLACE FUNCTION "unite_ligne_controler"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  unite_produit "Unite";
BEGIN
  IF NEW."produitId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "unite" INTO unite_produit FROM "Produit" WHERE "id" = NEW."produitId";
  IF unite_produit IS NOT NULL AND NEW."unite" <> unite_produit THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_UNITE_INCOHERENTE',
      DETAIL = format('Quantite saisie en %s, produit vendu en %s.', NEW."unite", unite_produit),
      HINT = 'champ=unite';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "Inventaire_unite_controler"
  BEFORE INSERT OR UPDATE OF "unite", "produitId" ON "Inventaire"
  FOR EACH ROW EXECUTE FUNCTION "unite_ligne_controler"();

CREATE TRIGGER "Releve_unite_controler"
  BEFORE INSERT OR UPDATE OF "unite", "produitId" ON "Releve"
  FOR EACH ROW EXECUTE FUNCTION "unite_ligne_controler"();

-- ---------------------------------------------------------------------
-- LigneCommande — produit stable + version de tarif appliquee (R4) + unite.
-- Reprise des donnees : les lignes existantes gardent tarifId et
-- prixCentimes (prix deja fige a la prise de commande). produitId et
-- prixProduitId restent NULL : pas de rapprochement Tarif -> Produit sans
-- le catalogue (ce serait deviner l'identite d'apres le nom).
-- unite = 'piece' pour l'existant : la saisie decimale etait impossible.
-- HYPOTHÈSE À VALIDER : d'anciennes lignes « (au kg) » peuvent porter un
-- nombre de kilos entier ou de pieces ; elles ne sont PAS converties en
-- grammes (sens inconnu) — voir la requete de verification du rapport.
-- ---------------------------------------------------------------------

-- AlterTable
ALTER TABLE "LigneCommande" ADD COLUMN     "nbSymboles" INTEGER,
ADD COLUMN     "prixProduitId" INTEGER,
ADD COLUMN     "produitId" INTEGER,
ADD COLUMN     "sousPlancherAutoriseLe" TIMESTAMP(3),
ADD COLUMN     "sousPlancherAutorisePar" TEXT,
ADD COLUMN     "unite" "Unite" NOT NULL DEFAULT 'piece';

-- CreateIndex
CREATE INDEX "LigneCommande_produitId_idx" ON "LigneCommande"("produitId");

-- CreateIndex
CREATE INDEX "LigneCommande_prixProduitId_idx" ON "LigneCommande"("prixProduitId");

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_prixProduitId_fkey" FOREIGN KEY ("prixProduitId") REFERENCES "PrixProduit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Colonnes neuves : contraintes valides immediatement.
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_nbSymboles_positif"
  CHECK ("nbSymboles" IS NULL OR "nbSymboles" > 0);
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_deverrouillage_trace"
  CHECK (("sousPlancherAutorisePar" IS NULL) = ("sousPlancherAutoriseLe" IS NULL));
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_deverrouillage_nom_non_vide"
  CHECK ("sousPlancherAutorisePar" IS NULL OR length(btrim("sousPlancherAutorisePar")) > 0);

-- Colonnes anciennes : NOT VALID (nouvelles ecritures seulement).
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_quantite_positive"
  CHECK ("quantite" > 0) NOT VALID;
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_prix_positif"
  CHECK ("prixCentimes" >= 0) NOT VALID;

-- LOI 1 — montants de commande jamais negatifs (audit : reste du negatif).
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_montants_positifs"
  CHECK ("totalCentimes" >= 0 AND "acompteCentimes" >= 0) NOT VALID;

-- LOI 2 + LOI 6 — controles de la ligne de commande :
--  * unite = unite du produit ;
--  * la version de tarif appartient bien au produit ;
--  * regime C : prix/personne < plancher de la version -> refus
--    (ERR_SOUS_PLANCHER), sauf deverrouillage trace : nom declare
--    (sousPlancherAutorisePar) ET horodatage (sousPlancherAutoriseLe).
-- Decision du 15/10/2026 : pas de comptes par employe. La base ne peut
-- donc plus verifier qu'une personne est gerant ; elle exige seulement la
-- trace. Le serveur ne doit renseigner ces deux champs qu'apres
-- verification du code gerant (dependance securite / regles-metier).
-- HYPOTHÈSE À VALIDER : déverrouillage tracé par nom déclaré, vérifié par le code gérant côté serveur
-- Les minimums (LOI 7) ne sont PAS encore rejoues ici : la regle vit dans
-- `src/domaine/` (regles-metier) et sera traduite en base ensuite.
CREATE OR REPLACE FUNCTION "ligne_commande_controler"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  unite_produit   "Unite";
  regime_produit  "RegimePrix";
  produit_version integer;
  plancher        integer;
BEGIN
  IF NEW."produitId" IS NOT NULL THEN
    SELECT "unite", "regimePrix" INTO unite_produit, regime_produit
      FROM "Produit" WHERE "id" = NEW."produitId";
    IF NEW."unite" <> unite_produit THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_UNITE_INCOHERENTE',
        DETAIL = format('Quantite saisie en %s, produit vendu en %s.', NEW."unite", unite_produit),
        HINT = 'champ=unite';
    END IF;
  END IF;

  IF NEW."prixProduitId" IS NOT NULL THEN
    SELECT "produitId", "prixCentimes" INTO produit_version, plancher
      FROM "PrixProduit" WHERE "id" = NEW."prixProduitId";
    IF NEW."produitId" IS DISTINCT FROM produit_version THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_TARIF_INCOHERENT',
        DETAIL = 'La version de prix ne correspond pas au produit de la ligne.',
        HINT = 'champ=prixProduitId';
    END IF;

    IF regime_produit = 'C' AND NEW."prixCentimes" < plancher THEN
      IF NEW."sousPlancherAutorisePar" IS NULL
         OR length(btrim(NEW."sousPlancherAutorisePar")) = 0
         OR NEW."sousPlancherAutoriseLe" IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ERR_SOUS_PLANCHER',
          DETAIL = format('Prix par personne sous le plancher (%s centimes).', plancher),
          HINT = 'champ=prixCentimes';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "LigneCommande_controler"
  BEFORE INSERT OR UPDATE OF "produitId", "prixProduitId", "prixCentimes", "unite", "sousPlancherAutorisePar", "sousPlancherAutoriseLe"
  ON "LigneCommande"
  FOR EACH ROW EXECUTE FUNCTION "ligne_commande_controler"();
