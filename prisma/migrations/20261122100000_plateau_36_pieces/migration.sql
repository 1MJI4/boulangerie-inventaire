-- =====================================================================
-- Un plateau de Croissant / Couque au chocolat fait 36 pieces, pas 16
-- (correction du proprietaire, 22/11/2026). Les quantites stockees
-- restent en PIECES : rien n'est converti. Seule la contenance change.
-- Migration NOUVELLE : la precedente n'est JAMAIS modifiee.
-- Retour arriere : remettre 16 par le meme UPDATE.
-- =====================================================================

UPDATE "Produit" SET "piecesParPlateau" = 36
 WHERE "nom" IN ('Croissant', 'Couque au chocolat');
