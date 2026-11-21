-- =====================================================================
-- Produits PROPOSES par les vendeurs au comptage (21/11/2026).
-- AJOUT SIMPLE, NON DESTRUCTIF : une table neuve, rien d'existant touche.
-- Retour arriere : DROP TABLE "ProduitPropose";
-- =====================================================================

CREATE TABLE "ProduitPropose" (
  "id" SERIAL NOT NULL,
  "nom" TEXT NOT NULL,
  "nomNormalise" TEXT NOT NULL,
  "quantite" INTEGER,
  "unite" "Unite" NOT NULL DEFAULT 'piece',
  "journee" DATE NOT NULL,
  "propositionPar" TEXT NOT NULL,
  "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statut" TEXT NOT NULL DEFAULT 'a_valider',
  "produitId" INTEGER,
  "traiteLe" TIMESTAMP(3),
  "traitePar" TEXT,
  CONSTRAINT "ProduitPropose_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProduitPropose_statut_valide" CHECK ("statut" IN ('a_valider', 'ajoute', 'exception')),
  CONSTRAINT "ProduitPropose_quantite_positive" CHECK ("quantite" IS NULL OR "quantite" >= 0)
);
CREATE INDEX "ProduitPropose_statut_creeLe_idx" ON "ProduitPropose"("statut", "creeLe");
CREATE INDEX "ProduitPropose_nomNormalise_journee_idx" ON "ProduitPropose"("nomNormalise", "journee");
