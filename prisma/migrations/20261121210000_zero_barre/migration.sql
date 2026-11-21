-- =====================================================================
-- « 0 barre » (21/11/2026) : un produit PAS PRODUIT ce jour-la se distingue d'un zero compte.
-- AJOUT SIMPLE, NON DESTRUCTIF : une colonne booleenne avec valeur par defaut false ;
-- toutes les lignes existantes valent false (aucun comportement ne change pour elles).
-- Retour arriere : ALTER TABLE "Inventaire" DROP COLUMN "nonProduit";
-- =====================================================================

ALTER TABLE "Inventaire" ADD COLUMN "nonProduit" BOOLEAN NOT NULL DEFAULT false;
