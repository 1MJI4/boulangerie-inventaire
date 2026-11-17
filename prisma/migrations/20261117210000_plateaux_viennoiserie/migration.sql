-- =====================================================================
-- Previsions de viennoiserie en PLATEAUX (decision du proprietaire,
-- 17/11/2026) : Croissant et Couque au chocolat se demandent par plateau
-- entier de 16 pieces. Le comptage des restes reste en pieces.
--
-- "Produit"."piecesParPlateau" : contenance d'un plateau ; NULL = a la piece.
-- Les quantites (Inventaire, Releve) restent stockees en PIECES : rien n'est
-- converti, aucune donnee existante n'est reinterpretee.
--
-- AJOUT SIMPLE, NON DESTRUCTIF : une colonne nullable sans valeur par defaut,
-- un CHECK, deux lignes renseignees par leur nom exact (liste d'inventaire,
-- LOI 10 — jamais le catalogue de commande). Un nom absent ne fait rien.
--
-- Migration NOUVELLE : les precedentes ne sont JAMAIS modifiees.
--
-- Retour arriere (a la main, sur une copie d'abord) :
--   ALTER TABLE "Produit" DROP CONSTRAINT "Produit_piecesParPlateau_positif";
--   ALTER TABLE "Produit" DROP COLUMN "piecesParPlateau";
-- =====================================================================

ALTER TABLE "Produit" ADD COLUMN "piecesParPlateau" INTEGER;

ALTER TABLE "Produit" ADD CONSTRAINT "Produit_piecesParPlateau_positif"
  CHECK ("piecesParPlateau" IS NULL OR ("piecesParPlateau" BETWEEN 1 AND 200));

UPDATE "Produit" SET "piecesParPlateau" = 16
 WHERE "nom" IN ('Croissant', 'Couque au chocolat');
