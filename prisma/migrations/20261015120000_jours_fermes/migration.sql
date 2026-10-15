-- =====================================================================
-- Lot 1 — LOI 3 : jours de fermeture, niveau PERSISTANCE.
--
-- La liste des jours fermes est une DONNEE (table "JourFerme"), jamais une
-- constante : le mardi n'apparait qu'une fois, comme donnee initiale.
-- Le declencheur de "Commande" lit cette table ; il ne contient ni « 2 »
-- ni « mardi ».
--
-- NON DESTRUCTIF : nouvelle table + declencheur. Les commandes existantes
-- ne sont pas touchees ; le controle ne joue qu'a la creation d'une
-- commande ou au CHANGEMENT de sa date de retrait (une commande ancienne
-- posee un mardi reste modifiable pour son statut, son acompte, etc.).
--
-- Codes leves (MESSAGE = code, DETAIL = libelle de la fermeture,
-- HINT = 'champ=retraitLe') — message humain par `gestion-erreurs` :
--   ERR_JOUR_FERME      « Fermé le mardi — choisissez un autre jour de retrait. »
--   ERR_PERIODE_CONGES  (R1c) fermeture de nature `conges`
-- =====================================================================

-- CreateEnum
CREATE TYPE "NatureFermeture" AS ENUM ('hebdomadaire', 'ferie', 'exceptionnel', 'conges', 'ouverture_exceptionnelle');

-- CreateTable
CREATE TABLE "JourFerme" (
    "id" SERIAL NOT NULL,
    "nature" "NatureFermeture" NOT NULL,
    "jourSemaineIso" INTEGER,
    "dateDebut" DATE,
    "dateFin" DATE,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,
    "creePar" TEXT,

    CONSTRAINT "JourFerme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourFerme_nature_actif_idx" ON "JourFerme"("nature", "actif");

-- CreateIndex
CREATE INDEX "JourFerme_dateDebut_idx" ON "JourFerme"("dateDebut");

-- Auteur : nom declare, texte trace (pas de comptes par employe, 15/10/2026).
ALTER TABLE "JourFerme" ADD CONSTRAINT "JourFerme_creePar_non_vide"
  CHECK ("creePar" IS NULL OR length(btrim("creePar")) > 0);

-- Forme des lignes :
--  hebdomadaire -> jourSemaineIso 1..7 (ISO : 1 = lundi ... 7 = dimanche),
--                  dateDebut / dateFin = periode d'application, optionnelles ;
--  autres       -> jourSemaineIso NULL, dateDebut obligatoire,
--                  dateFin incluse (NULL = un seul jour).
ALTER TABLE "JourFerme" ADD CONSTRAINT "JourFerme_forme" CHECK (
      (("nature" = 'hebdomadaire') = ("jourSemaineIso" IS NOT NULL))
  AND ("jourSemaineIso" IS NULL OR "jourSemaineIso" BETWEEN 1 AND 7)
  AND ("nature" = 'hebdomadaire' OR "dateDebut" IS NOT NULL)
  AND ("dateFin" IS NULL OR "dateDebut" IS NULL OR "dateFin" >= "dateDebut")
  AND length(btrim("libelle")) > 0
);

-- ---------------------------------------------------------------------
-- Donnee initiale — la SEULE occurrence du mardi dans la base.
-- HYPOTHÈSE À VALIDER (R1, QUESTIONS-GERANT n°1) : fermeture hebdomadaire
-- le mardi, sans date de debut ni de fin. Rejouable : pas de doublon.
-- ---------------------------------------------------------------------
INSERT INTO "JourFerme" ("nature", "jourSemaineIso", "libelle", "modifieLe")
SELECT 'hebdomadaire', 2, 'mardi', CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "JourFerme" WHERE "nature" = 'hebdomadaire' AND "jourSemaineIso" = 2
);

-- ---------------------------------------------------------------------
-- fermeture_du_jour(d) : la ligne de "JourFerme" qui ferme la date d, ou
-- une ligne vide (id NULL) si le magasin est ouvert ce jour-la.
-- Utilisable par le serveur (rejeu des validations a la synchronisation).
-- Priorite :
--   1. une `ouverture_exceptionnelle` active couvrant d -> ouvert
--      (HYPOTHÈSE À VALIDER : sortie laissee au gerant pour ouvrir, par
--      exemple, un mardi avant Noel, sans desactiver la regle du mardi)
--   2. une periode de `conges` -> ERR_PERIODE_CONGES
--   3. toute autre fermeture active (hebdomadaire, ferie, exceptionnel)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "fermeture_du_jour"(d date) RETURNS "JourFerme"
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  f "JourFerme";
BEGIN
  IF d IS NULL THEN
    RETURN f;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "JourFerme" o
    WHERE o."actif"
      AND o."nature" = 'ouverture_exceptionnelle'
      AND d BETWEEN o."dateDebut" AND COALESCE(o."dateFin", o."dateDebut")
  ) THEN
    RETURN f;
  END IF;

  SELECT j.* INTO f
  FROM "JourFerme" j
  WHERE j."actif"
    AND j."nature" <> 'ouverture_exceptionnelle'
    AND (
      (j."nature" = 'hebdomadaire'
        AND j."jourSemaineIso" = EXTRACT(ISODOW FROM d)::integer
        AND (j."dateDebut" IS NULL OR d >= j."dateDebut")
        AND (j."dateFin"   IS NULL OR d <= j."dateFin"))
      OR
      (j."nature" <> 'hebdomadaire'
        AND d BETWEEN j."dateDebut" AND COALESCE(j."dateFin", j."dateDebut"))
    )
  ORDER BY (j."nature" = 'conges') DESC, j."id"
  LIMIT 1;

  RETURN f;
END
$fn$;

-- LOI 3, niveau 3 — refus en base d'une date de retrait fermee.
CREATE OR REPLACE FUNCTION "commande_refuser_jour_ferme"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  f "JourFerme";
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."retraitLe" IS NOT DISTINCT FROM OLD."retraitLe" THEN
      RETURN NEW;
    END IF;
  END IF;

  f := "fermeture_du_jour"(NEW."retraitLe");
  IF f."id" IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = CASE WHEN f."nature" = 'conges' THEN 'ERR_PERIODE_CONGES' ELSE 'ERR_JOUR_FERME' END,
      DETAIL  = f."libelle",
      HINT    = 'champ=retraitLe';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER "Commande_refuser_jour_ferme"
  BEFORE INSERT OR UPDATE OF "retraitLe" ON "Commande"
  FOR EACH ROW EXECUTE FUNCTION "commande_refuser_jour_ferme"();
