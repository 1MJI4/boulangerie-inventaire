-- =====================================================================
-- Liste d'INVENTAIRE (21/11/2026) : « Pain shawarma » et « Bagnat » sont le meme
-- produit (une seule ligne « Pain Shawarma - bagnat (blanc/gris) » sur la feuille papier).
-- Les deux paires de produits etaient comptees deux fois (4 lignes au lieu de 2).
--
-- NON DESTRUCTIF : on RENOMME « Pain shawarma blanc / gris » et on RETIRE (actif = false)
-- « Bagnat blanc / gris ». Rien n'est supprime : l'historique des comptages reste lisible.
-- Idempotent : rejouable sans effet. Migration NOUVELLE : les precedentes ne sont jamais modifiees.
--
-- Retour arriere (a la main) :
--   UPDATE "Produit" SET "nom" = 'Pain shawarma blanc' WHERE "nom" = 'Pain shawarma - bagnat blanc';
--   UPDATE "Produit" SET "nom" = 'Pain shawarma gris'  WHERE "nom" = 'Pain shawarma - bagnat gris';
--   UPDATE "Produit" SET "actif" = true WHERE "nom" IN ('Bagnat blanc', 'Bagnat gris');
-- =====================================================================

UPDATE "Produit" SET "nom" = 'Pain shawarma - bagnat blanc'
WHERE "nom" = 'Pain shawarma blanc'
  AND NOT EXISTS (SELECT 1 FROM "Produit" WHERE "nom" = 'Pain shawarma - bagnat blanc');

UPDATE "Produit" SET "nom" = 'Pain shawarma - bagnat gris'
WHERE "nom" = 'Pain shawarma gris'
  AND NOT EXISTS (SELECT 1 FROM "Produit" WHERE "nom" = 'Pain shawarma - bagnat gris');

UPDATE "Produit" SET "actif" = false WHERE "nom" IN ('Bagnat blanc', 'Bagnat gris');
