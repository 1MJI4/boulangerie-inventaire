-- Categorisation des produits (zone du magasin + poste de production)
ALTER TABLE "Produit" ADD COLUMN     "categorie" TEXT NOT NULL DEFAULT 'Autres';
ALTER TABLE "Produit" ADD COLUMN     "poste" TEXT NOT NULL DEFAULT 'boulanger';
ALTER TABLE "Produit" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true;

-- "Pas encore compte" doit se distinguer de "il en reste 0"
ALTER TABLE "Inventaire" ALTER COLUMN "quantiteRestante" DROP NOT NULL;

-- Suivi de production au fournil
ALTER TABLE "Inventaire" ADD COLUMN     "faitLe" TIMESTAMP(3);

-- Index de lecture
CREATE INDEX "Produit_ordre_idx" ON "Produit"("ordre");
CREATE INDEX "Produit_poste_idx" ON "Produit"("poste");
CREATE INDEX "Inventaire_dateInventaire_idx" ON "Inventaire"("dateInventaire");
