-- Ligne libre (« Autre demande ») : le vendeur dit « 8 quoi » (pièces, personnes,
-- parts, ou un mot à lui). Colonne facultative : les lignes existantes restent
-- à NULL et s'impriment comme avant (« N × »). Aucune donnée réécrite.
ALTER TABLE "LigneCommande" ADD COLUMN "uniteLibre" TEXT;

ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_uniteLibre_valide"
  CHECK ("uniteLibre" IS NULL OR (char_length(btrim("uniteLibre")) BETWEEN 1 AND 30));
